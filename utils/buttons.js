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
try {
  const b = require('@whiskeysockets/baileys');
  _genWA = (b && b.generateWAMessageFromContent) || null;
} catch (e) { _genWA = null; }
function _injectBaileys(obj) {
  if (obj && typeof obj.generateWAMessageFromContent === 'function') {
    _genWA = obj.generateWAMessageFromContent;
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

function _buildContent(bodyText, footerText, title, chunk) {
  const im = {
    nativeFlowMessage: {
      buttons: chunk.map((b) => ({ name: b.name || 'quick_reply', buttonParamsJson: b.buttonParamsJson })),
    },
  };
  if (title) im.header = { title: String(title).slice(0, TITLE_MAX) };
  if (bodyText) im.body = { text: bodyText };
  im.footer = { text: footerText || FOOTER_DEFAULT };
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
  await sock.relayMessage(chatId, waMsg.message, { messageId: waMsg.key.id, additionalNodes: nodes });
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
 * Send text + native buttons. opts = { text, footer?, title?, image?,
 * mimetype?, buttons }. Returns { mode, chunks, ids } where mode is
 * 'interactive' (native buttons relayed), 'menu' (numbered fallback),
 * or 'plain' (text/link fallback). Throws only if every layer fails.
 */
async function sendButtons(sock, chatId, opts, quoted) {
  const o = opts || {};
  const text = o.text || '';
  const footer = o.footer || '';
  const title = o.title || null;
  const image = o.image || null;
  const mimetype = o.mimetype || 'image/jpeg';
  const clean = (o.buttons || []).filter((b) => b && b.buttonParamsJson).slice(0, MAX_TOTAL);

  if (!clean.length) {
    let sent;
    if (image) sent = await sock.sendMessage(chatId, { image, caption: text || '', mimetype }, quoted ? { quoted } : {});
    else sent = await sock.sendMessage(chatId, { text: text || '.' }, quoted ? { quoted } : {});
    return { mode: 'plain', chunks: 0, ids: [(sent && sent.key && sent.key.id) || null] };
  }

  // ── Primary: native interactive ──
  const canInteractive = typeof _genWA === 'function' && sock && typeof sock.relayMessage === 'function';
  if (canInteractive) {
    try {
      const group = _isGroup(chatId);
      if (image) {
        await sock.sendMessage(chatId, { image, caption: text || '', mimetype }, quoted ? { quoted } : {});
      }
      const chunks = _chunk(clean);
      const ids = [];
      for (let i = 0; i < chunks.length; i++) {
        const body = i === 0 ? (text || 'Tap a button below:') : 'More options:';
        const content = _buildContent(body, footer, i === 0 ? title : null, chunks[i]);
        ids.push(await _relayChunk(sock, chatId, content, i === 0 ? quoted : null, group));
      }
      return { mode: 'interactive', chunks: chunks.length, ids };
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
        const id = await TextMenu.sendMenu(sock, chatId, { body, options: plan.options, footer, image: image || null, mimetype }, quoted);
        return { mode: 'menu', chunks: 0, ids: [id] };
      }
    } catch (e) {
      console.error('buttons menu fallback failed, plain fallback:', e.message);
    }
  }
  let sent;
  if (image) sent = await sock.sendMessage(chatId, { image, caption: body, mimetype }, quoted ? { quoted } : {});
  else sent = await sock.sendMessage(chatId, { text: body }, quoted ? { quoted } : {});
  return { mode: 'plain', chunks: 0, ids: [(sent && sent.key && sent.key.id) || null] };
}

module.exports = {
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
