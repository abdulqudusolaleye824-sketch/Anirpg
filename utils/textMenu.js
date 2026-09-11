// ═══════════════════════════════════════════════════════════════
// textMenu — 1000%-guaranteed button replacement.
// WhatsApp interactive/native-flow buttons render unreliably across
// clients and accounts, so menus are plain numbered text — which ALWAYS
// delivers — plus reply-to-select, which ALWAYS parses:
//   • Quote the menu and reply with the number, OR
//   • Just send the number on its own (within 2 minutes).
// URL actions (support links etc.) are sent as raw tappable links,
// which every WhatsApp client renders as tappable.
// No Baileys interactive APIs are used anywhere in this module.
// ═══════════════════════════════════════════════════════════════
'use strict';

const sessions = {}; // chatId -> { msgId, options, requester, createdAt, quoteUntil, plainUntil }
const QUOTE_WINDOW_MS = 5 * 60 * 1000;
const PLAIN_WINDOW_MS = 2 * 60 * 1000;

const NUM_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

function prune() {
  const now = Date.now();
  for (const k of Object.keys(sessions)) {
    if (now > sessions[k].quoteUntil) delete sessions[k];
  }
}

/**
 * Send a numbered menu. options = [{ label, command }].
 * Returns the sent-message key id (or null).
 */
async function sendMenu(sock, chatId, opts = {}, quoted) {
  const { body = '', options = [], footer = '', image = null, mimetype = 'image/jpeg', mentions = [] } = opts;
  const lines = [body];
  const clean = (options || []).slice(0, 10);
  clean.forEach((o, i) => {
    lines.push(`${NUM_EMOJI[i] || `${i + 1}.`} ${o.label}`);
  });
  lines.push('');
  lines.push('👆 *Reply with the number* (or quote this and reply the number)');
  if (footer) { lines.push(footer); }
  const text = lines.join('\n');

  const _extra = (mentions && mentions.length) ? { mentions } : {};
  let sent = null;
  if (image) {
    sent = await sock.sendMessage(chatId, { image, caption: text, mimetype, ..._extra }, quoted ? { quoted } : {});
  } else {
    sent = await sock.sendMessage(chatId, { text, ..._extra }, quoted ? { quoted } : {});
  }
  try {
    prune();
    const msgId = sent?.key?.id || null;
    sessions[chatId] = {
      msgId,
      options: clean.map(o => ({ label: String(o.label), command: String(o.command) })),
      createdAt: Date.now(),
      quoteUntil: Date.now() + QUOTE_WINDOW_MS,
      plainUntil: Date.now() + PLAIN_WINDOW_MS,
    };
  } catch (e) {}
  return sent?.key?.id || null;
}

/**
 * Try to resolve an incoming plain-text message into a menu command.
 * Returns { command, label } or null.
 */
function resolve(chatId, text, quotedId) {
  try {
    prune();
    const s = sessions[chatId];
    if (!s || !s.options.length) return null;
    const t = String(text || '').trim();
    if (!/^\d{1,2}$/.test(t)) return null;
    const n = parseInt(t, 10);
    if (n < 1 || n > s.options.length) return null;
    const now = Date.now();
    const isQuoteMatch = quotedId && s.msgId && quotedId === s.msgId && now <= s.quoteUntil;
    const isPlainMatch = now <= s.plainUntil;
    if (!isQuoteMatch && !isPlainMatch) return null;
    return s.options[n - 1];
  } catch (e) { return null; }
}

/**
 * Format URL actions as tappable plain-text links (replaces cta_url buttons).
 * pairs = [[label, url], ...]
 */
function linkLines(pairs) {
  return (pairs || []).map(([label, url]) => `🔗 *${label}*\n   ${url}`).join('\n\n');
}

module.exports = { sendMenu, resolve, linkLines, NUM_EMOJI };
