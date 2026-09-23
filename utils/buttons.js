// ═══════════════════════════════════════════════════════════════
// buttons — native WhatsApp interactive-button system (Baileys 7).
//
// WHY THE PREVIOUS ATTEMPT NEVER RENDERED: it relayed an
// interactiveMessage with NO stanza nodes attached. WhatsApp only renders
// interactive messages when the send stanza carries the binary nodes the
// official client emits — a `biz` wrapper holding
// `interactive(native_flow)` / `native_flow(mixed)` — plus a `bot` node on
// direct (non-group) chats — and when the message is MD-patched
// (documentWithCaption wrapper). This module does all of that, following the
// empirically-derived recipe (itsukichan-compatible getButtonArgs).
//
// SEND PATH (primary → fallback, delivery always guaranteed):
//   1. generateWAMessageFromContent + relayMessage with additionalNodes
//      (native tappable buttons).
//   2. On ANY failure: utils/textMenu numbered menu built from the SAME
//      button list (quick replies + list rows become numbered options,
//      URL buttons become tappable links, copy/call become text lines).
//   3. Call sites keep their own plain-text fallback underneath.
//
// TAP ROUTING: quick-reply / list-row ids SHOULD be full `/commands`
// (e.g. `/pass 2`). A tap arrives as that exact text, so it flows through
// the normal command pipeline with zero new dispatch code. Relayed sends
// bypass the sendMessage wrapper, so each relayed id is recorded in the
// own-send registry (batch-17) to keep echoes out of the AI/handler path.
//
// LIMITS: max 3 buttons per interactive message (overflow continues in
// follow-up messages); single_select always travels alone (it is a full
// picker). Max 10 buttons per call.
// ═══════════════════════════════════════════════════════════════
'use strict';

const MAX_PER_MESSAGE = 3;
const MAX_TOTAL = 10;
const LABEL_MAX = 30;
const TITLE_MAX = 60;
const FOOTER_DEFAULT = 'Astra™ 2026';

// generateWAMessageFromContent — lazy/optional so the module loads anywhere.
// _injectBaileys() lets tests (and future Baileys majors) supply it.
let _genWA = null;
let _prepMedia = null;
try {
  const b = require('@whiskeysockets/baileys');
  _genWA = (b && b.generateWAMessageFromContent) || null;
  _prepMedia = (b && b.prepareWAMessageMedia) || null;
} catch (e) { _genWA = null; _prepMedia = null; }
function _injectBaileys(obj) {
  if (obj && typeof obj.generateWAMessageFromContent === 'function') {
    _genWA = obj.generateWAMessageFromContent;
  }
  if (obj && typeof obj.prepareWAMessageMedia === 'function') {
    _prepMedia = obj.prepareWAMessageMedia;
  }
}

// ── Builders: [label, value] pairs → native-flow entries ──────────────
function _pair(p) {
  const a = Array.isArray(p) ? p : [p && (p.label || p.text), p && (p.id || p.value || p.url || p.code)];
  return { label: String(a[0] || '').slice(0, LABEL_MAX), value: String(a[1] || '') };
}

/** Tap-back buttons. ids SHOULD be full `/commands` so taps just execute. */
function quickReplies(pairs) {
  return (pairs || []).slice(0, MAX_TOTAL).map((p) => {
    const { label, value } = _pair(p);
    return { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: label || 'Tap', id: value }) };
  }).filter((b) => { try { return !!JSON.parse(b.buttonParamsJson).id; } catch (e) { return false; } });
}

/** Buttons that open a URL in the browser. */
function urlButtons(pairs) {
  return (pairs || []).slice(0, MAX_TOTAL).map((p) => {
    const { label, value } = _pair(p);
    return { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: label || 'Open', url: value, merchant_url: value }) };
  }).filter((b) => { try { return !!JSON.parse(b.buttonParamsJson).url; } catch (e) { return false; } });
}

/** Buttons that copy text (codes, referral links) to the clipboard. */
function copyButtons(pairs) {
  return (pairs || []).slice(0, MAX_TOTAL).map((p) => {
    const { label, value } = _pair(p);
    return { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: label || 'Copy', copy_code: value }) };
  }).filter((b) => { try { return !!JSON.parse(b.buttonParamsJson).copy_code; } catch (e) { return false; } });
}

/**
 * In-button picker list. sections = [{ title, rows: [{ id, title,
 * description?, header? }] }]. Row ids SHOULD be full `/commands`.
 */
function singleSelect(title, sections) {
  const clean = (sections || []).map((s) => {
    const rows = (s.rows || []).map((r) => {
      const row = { id: String(r.id || ''), title: String(r.title || 'Option').slice(0, TITLE_MAX) };
      if (r.description) row.description = String(r.description).slice(0, 120);
      if (r.header) row.header = String(r.header).slice(0, TITLE_MAX);
      return row;
    }).filter((r) => r.id);
    return { title: String(s.title || 'Options').slice(0, TITLE_MAX), rows };
  }).filter((s) => s.rows.length);
  if (!clean.length) return [];
  return [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: String(title || 'Choose').slice(0, TITLE_MAX), sections: clean }) }];
}

// ── Stanza nodes (the part the old system was missing) ────────────────
/** biz → interactive(native_flow v1) → native_flow(v9 mixed). */
function _bizNode() {
  return {
    tag: 'biz', attrs: {},
    content: [{
      tag: 'interactive', attrs: { type: 'native_flow', v: '1' },
      content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
    }],
  };
}

/** Direct chats need this or interactive content will not render. */
function _botNode() {
  return { tag: 'bot', attrs: { biz_bot: '1' } };
}

function _isGroup(jid) {
  return String(jid || '').endsWith('@g.us');
}

/** Multi-device patch: wrap interactive content in documentWithCaption. */
function _patchMd(message) {
  if (!message || typeof message !== 'object') return message;
  if (message.documentWithCaptionMessage && message.documentWithCaptionMessage.message) return message;
  if (message.buttonsMessage || message.listMessage || message.interactiveMessage) {
    return { documentWithCaptionMessage: { message: Object.assign({}, message) } };
  }
  return message;
}

/** Chunk into ≤3-per-message; a picker always travels alone. */
function _chunk(buttons) {
  const out = [];
  let cur = [];
  const flush = () => { if (cur.length) { out.push(cur); cur = []; } };
  for (const b of buttons || []) {
    if (b && b.name === 'single_select') { flush(); out.push([b]); continue; }
    cur.push(b);
    if (cur.length >= MAX_PER_MESSAGE) flush();
  }
  flush();
  return out;
}

function _buildContent(bodyText, footerText, title, chunk, mentions, imageMessage) {
  const im = {
    nativeFlowMessage: {
      buttons: chunk.map((b) => ({ name: b.name || 'quick_reply', buttonParamsJson: b.buttonParamsJson })),
    },
  };
  // A header is EITHER text or media — imageMessage wins and the caller
  // folds the title into the body (batch-22 single-message sends).
  if (imageMessage) im.header = { imageMessage, hasMediaAttachment: true };
  else if (title) im.header = { title: String(title).slice(0, TITLE_MAX) };
  if (bodyText) im.body = { text: bodyText };
  im.footer = { text: footerText || FOOTER_DEFAULT };
  if (mentions && mentions.length) im.contextInfo = { mentionedJid: mentions.slice() };
  return { interactiveMessage: im };
}

async function _relayChunk(sock, chatId, content, quoted, group) {
  const nodes = [_bizNode()];
  if (!group) nodes.push(_botNode());
  const userJid = (sock.authState && sock.authState.creds && sock.authState.creds.me && sock.authState.creds.me.id) || (sock.user && sock.user.id);
  const genOpts = { logger: sock.logger, timestamp: new Date() };
  if (userJid) genOpts.userJid = userJid;
  if (quoted) genOpts.quoted = quoted;
  const waMsg = _genWA(chatId, content, genOpts);
  waMsg.message = _patchMd(waMsg.message);
  // Push #78: relayMessage bypassed the sendMessage wrapper → no pacing, no
  // rate-overlimit backoff, no empty guard. Under spam that is exactly where
  // the blank bubbles came from (a rate-limited interactive relays as an
  // empty frame). Pace it like every other send and back off on overlimit.
  const _bodyTxt = String((content.interactiveMessage && content.interactiveMessage.body && content.interactiveMessage.body.text) || '').replace(/[\u200b-\u200f\u2060-\u206f\ufeff]/g, '').trim();
  if (!/[\p{L}\p{N}]/u.test(_bodyTxt) && !(content.interactiveMessage && content.interactiveMessage.header && content.interactiveMessage.header.imageMessage)) throw new Error('refusing to relay an empty interactive message'); // Push #87: needs ≥1 letter/digit
  let MSMp = null; try { MSMp = require('../bots/MultiSocketManager'); } catch (e) {}
  const _key = (() => { try { const all = MSMp && MSMp.getAllSockets ? MSMp.getAllSockets() : {}; for (const [k, s] of Object.entries(all)) if (s === sock) return k; } catch (e) {} return 'sock'; })();
  const _delays = [2000, 4000, 8000, 16000];
  for (let i = 0; ; i++) {
    try {
      if (MSMp && typeof MSMp._pace === 'function') { try { await MSMp._pace(_key, chatId); } catch (e) {} }
      await sock.relayMessage(chatId, waMsg.message, { messageId: waMsg.key.id, additionalNodes: nodes });
      break;
    } catch (e) {
      if (/rate-overlimit|overlimit|429/i.test(String(e && e.message || e)) && i < _delays.length) { await new Promise((r) => setTimeout(r, _delays[i])); continue; }
      throw e;
    }
  }
  // relayMessage bypasses the sendMessage wrapper — record the id here so
  // our own interactive echoes never reach the AI/handler path (batch-17).
  try {
    const MSM = require('../bots/MultiSocketManager');
    if (MSM && typeof MSM._recordSentId === 'function') MSM._recordSentId(waMsg.key && waMsg.key.id);
  } catch (e) { /* registry is best-effort; fromMe guard still applies */ }
  return (waMsg.key && waMsg.key.id) || null;
}

function _parseParams(b) {
  try { return JSON.parse((b && b.buttonParamsJson) || '{}'); } catch (e) { return {}; }
}

/** Derive the numbered-menu fallback from the SAME button list. */
function _fallbackPlan(text, buttons) {
  const options = [];
  const links = [];
  const extra = [];
  for (const b of buttons || []) {
    const p = _parseParams(b);
    if (b.name === 'quick_reply') {
      if (p.id) options.push({ label: p.display_text || 'Tap', command: String(p.id) });
    } else if (b.name === 'single_select') {
      for (const s of p.sections || []) {
        for (const r of s.rows || []) {
          if (r.id) options.push({ label: r.title || 'Tap', command: String(r.id) });
        }
      }
    } else if (b.name === 'cta_url') {
      if (p.url) links.push([p.display_text || 'Link', p.url]);
    } else if (b.name === 'cta_copy') {
      if (p.copy_code) extra.push(`📋 *${p.display_text || 'Code'}:* \`${p.copy_code}\``);
    } else if (b.name === 'cta_call') {
      if (p.phone_number) extra.push(`📞 *${p.display_text || 'Call'}:* ${p.phone_number}`);
    }
  }
  return { options: options.slice(0, 10), links, extra };
}

function _linkBlock(links) {
  if (!links.length) return '';
  try {
    const TM = require('./textMenu');
    if (TM && typeof TM.linkLines === 'function') return '\n\n' + TM.linkLines(links);
  } catch (e) { /* fall through to manual lines */ }
  return '\n\n' + links.map(([label, url]) => `🔗 *${label}*\n   ${url}`).join('\n\n');
}

/**
 * Send text + native buttons. opts = { text, footer?, title?, image?, mentions?,
 * mimetype?, buttons }. Returns { mode, chunks, ids } where mode is
 * 'interactive' (native buttons relayed), 'interactive-media' (image
 * header + buttons in ONE message), 'menu' (numbered fallback),
 * or 'plain' (text/link fallback). Throws only if every layer fails.
 */
async function sendButtons(sock, chatId, opts, quoted) {
  const o = opts || {};
  const text = o.text || '';
  const footer = o.footer || '';
  const title = o.title || null;
  const image = o.image || null;
  const mimetype = o.mimetype || 'image/jpeg';
  const mentions = Array.isArray(o.mentions) ? o.mentions.filter(Boolean) : [];
  const clean = (o.buttons || []).filter((b) => b && b.buttonParamsJson).slice(0, MAX_TOTAL);

  if (!clean.length) {
    let sent;
    const _m = mentions.length ? { mentions } : {};
    if (image) sent = await sock.sendMessage(chatId, { image, caption: text || '', mimetype, ..._m }, quoted ? { quoted } : {});
    else sent = await sock.sendMessage(chatId, { text: text || '.', ..._m }, quoted ? { quoted } : {});
    return { mode: 'plain', chunks: 0, ids: [(sent && sent.key && sent.key.id) || null] };
  }

  // ── Primary: native interactive ──
  const canInteractive = typeof _genWA === 'function' && sock && typeof sock.relayMessage === 'function';
  if (canInteractive) {
    try {
      const group = _isGroup(chatId);
      // Batch-22: ONE message (image header + buttons) when the socket can
      // upload media; otherwise the classic image-then-buttons 2-step.
      let headerMedia = null;
      if (image) {
        try {
          const up = (sock && typeof sock.waUploadToServer === 'function')
            ? (...a) => sock.waUploadToServer(...a)
            : null;
          if (_prepMedia && up) {
            const up1 = await _prepMedia({ image, mimetype }, { upload: up });
            if (up1 && up1.imageMessage) headerMedia = up1.imageMessage;
          }
        } catch (e) { headerMedia = null; }
      }
      if (image && !headerMedia) {
        await sock.sendMessage(chatId, { image, caption: text || '', mimetype, ...(mentions.length ? { mentions } : {}) }, quoted ? { quoted } : {});
      }
      const chunks = _chunk(clean);
      const ids = [];
      for (let i = 0; i < chunks.length; i++) {
        let body = i === 0 ? (text || 'Tap a button below:') : 'More options:';
        const t0 = i === 0 ? title : null;
        const hm = i === 0 ? headerMedia : null;
        if (hm && t0) body = `*${t0}*\n\n${body}`;
        const content = _buildContent(body, footer, hm ? null : t0, chunks[i], mentions, hm);
        ids.push(await _relayChunk(sock, chatId, content, i === 0 ? quoted : null, group));
      }
      return { mode: headerMedia ? 'interactive-media' : 'interactive', chunks: chunks.length, ids };
    } catch (e) {
      console.error('buttons interactive failed, menu fallback:', e.message);
    }
  }

  // ── Fallback: numbered menu / links / plain from the same buttons ──
  const plan = _fallbackPlan(text, clean);
  let body = text || '';
  if (plan.extra.length) body += (body ? '\n\n' : '') + plan.extra.join('\n');
  body += _linkBlock(plan.links);
  if (!body) body = '.';

  if (plan.options.length) {
    try {
      const TextMenu = require('./textMenu');
      if (TextMenu && typeof TextMenu.sendMenu === 'function') {
        const id = await TextMenu.sendMenu(sock, chatId, { body, options: plan.options, footer, image: image || null, mimetype, mentions }, quoted);
        return { mode: 'menu', chunks: 0, ids: [id] };
      }
    } catch (e) {
      console.error('buttons menu fallback failed, plain fallback:', e.message);
    }
  }
  let sent;
  const _m2 = mentions.length ? { mentions } : {};
  if (image) sent = await sock.sendMessage(chatId, { image, caption: body, mimetype, ..._m2 }, quoted ? { quoted } : {});
  else sent = await sock.sendMessage(chatId, { text: body, ..._m2 }, quoted ? { quoted } : {});
  return { mode: 'plain', chunks: 0, ids: [(sent && sent.key && sent.key.id) || null] };
}

/**
 * Classic listMessage — a REAL tappable button for ordinary linked WhatsApp
 * numbers. Interactive native_flow buttons (quick replies) are only rendered
 * by some clients, which is why /quiz questions dropped as a numbered text
 * block: the send "succeeded", the button just never existed. Tapping a row
 * sends that row's id as a normal message, so ids should be commands.
 * opts = { text, title, buttonText, footer, sectionTitle, rows:[{id,title,description}] }
 */
async function sendList(sock, chatId, opts = {}, quoted = null) {
  const rows = (opts.rows || [])
    .filter((r) => r && r.id && r.title)
    .slice(0, 10)
    .map((r) => {
      const row = { rowId: String(r.id), title: String(r.title).slice(0, 72) };
      if (r.description) row.description = String(r.description).slice(0, 120);
      return row;
    });
  if (!rows.length || !sock || typeof sock.sendMessage !== 'function') return { mode: 'none', rows: rows.length };
  try {
    await sock.sendMessage(chatId, {
      list: {
        title: String(opts.title || 'Choose').slice(0, 96),
        text: opts.text || '',
        buttonText: String(opts.buttonText || '⚡ Choose').slice(0, 30),
        footerText: String(opts.footer || '').slice(0, 96) || undefined,
        sections: [{ title: String(opts.sectionTitle || 'Options').slice(0, 24), rows }],
      },
    }, quoted ? { quoted } : {});
    return { mode: 'list', rows: rows.length, chunks: 1 };
  } catch (e) {
    console.error('buttons list failed:', e.message);
    return { mode: 'failed', error: e.message, rows: rows.length };
  }
}

module.exports = {
  sendList,
  quickReplies,
  urlButtons,
  copyButtons,
  singleSelect,
  sendButtons,
  _bizNode,
  _botNode,
  _isGroup,
  _patchMd,
  _chunk,
  _buildContent,
  _fallbackPlan,
  _injectBaileys,
};
