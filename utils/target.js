// Push #96d: ONE target resolver for every "tag" command.
// Triple scan — @mention → replied-to message author → bare number / @number arg.
'use strict';
function contextInfo(msg) {
  const m = msg && msg.message; if (!m) return null;
  return m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo || m.videoMessage?.contextInfo
    || m.buttonsResponseMessage?.contextInfo || m.interactiveResponseMessage?.contextInfo || m.conversation?.contextInfo || null;
}
function quotedAuthor(msg) {
  const ci = contextInfo(msg);
  const p = ci && ci.quotedMessage ? ci.participant : null;
  return p ? String(p) : null;
}
function mentioned(msg) {
  const ci = contextInfo(msg);
  const list = (ci && Array.isArray(ci.mentionedJid)) ? ci.mentionedJid.filter(Boolean) : [];
  return list;
}
function numberArg(args) {
  for (const a of (args || [])) {
    const d = String(a || '').replace(/^@/, '').replace(/[^\d]/g, '');
    if (d.length >= 7 && d.length <= 15) return `${d}@s.whatsapp.net`;
  }
  return null;
}
// Returns the first target JID found (mention > reply > number arg) or null.
function resolve(msg, args) {
  const m = mentioned(msg); if (m.length) return m[0];
  const q = quotedAuthor(msg); if (q) return q;
  return numberArg(args);
}
// All targets (mentions + reply author), de-duplicated.
function resolveAll(msg, args) {
  const out = [...mentioned(msg)];
  const q = quotedAuthor(msg); if (q && !out.includes(q)) out.push(q);
  if (!out.length) { const n = numberArg(args); if (n) out.push(n); }
  return out;
}
module.exports = { resolve, resolveAll, quotedAuthor, mentioned, numberArg, contextInfo };
