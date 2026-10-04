'use strict';
// Push #96h-z18: GROUP MODERATION for EVERY group message (the old anti-link lived inside the command
// handler, which only ever ran for messages starting with "/" — so links were never caught).
//   • Anti-link   — ON by default; /antilink off disables (gs.antiLinkOff = true). 3 strikes: warn → 5-min mute → kick.
//   • Anti-mention — ON by default; /antimention off disables (gs.antiMentionOff = true). A non-admin who
//     mentions the group in their status is kicked on the spot.
// Owners / mods / group admins / our own bots are exempt. Only the group's ACTIVE bot runs this (caller's job).
const DEFAULT_ALLOWED = ['instagram.com', 'pinterest.', 'pinterest.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'chat.whatsapp.com', 'wa.me'];
const LINK_RE = /(https?:\/\/\S+|www\.\S+|\b[a-z0-9-]+\.(?:com|net|org|me|ly|gg|io|xyz|app|link|site|tv|co|info|biz|online|store|shop|club|live|fun|top|cc|to|us|uk|ng|in|de|fr|es|ru|cn|jp|br|za|ke|gh|ca|au)(?:\/\S*)?\b)/i;
function settings(db, chatId) { if (!db.groupSettings) db.groupSettings = {}; if (!db.groupSettings[chatId]) db.groupSettings[chatId] = {}; return db.groupSettings[chatId]; }
function antiLinkOn(db, chatId) { const gs = (db.groupSettings || {})[chatId] || {}; return !gs.antiLinkOff; }
function antiMentionOn(db, chatId) { const gs = (db.groupSettings || {})[chatId] || {}; return !gs.antiMentionOff; }
function unwrap(m) {
  let x = m || {}; for (let i = 0; i < 4 && x; i++) {
    const inner = x.ephemeralMessage?.message || x.viewOnceMessage?.message || x.viewOnceMessageV2?.message || x.viewOnceMessageV2Extension?.message || x.documentWithCaptionMessage?.message || x.editedMessage?.message;
    if (!inner) break; x = inner;
  } return x || {};
}
function textOf(m) { const x = unwrap(m); return x.conversation || x.extendedTextMessage?.text || x.imageMessage?.caption || x.videoMessage?.caption || x.documentMessage?.caption || ''; }
function isStatusMention(m) { const x = unwrap(m); return !!(x.groupStatusMentionMessage || x.statusMentionMessage); }
function hasBadLink(db, chatId, text) {
  if (!text || !LINK_RE.test(text)) return false;
  const gs = (db.groupSettings || {})[chatId] || {}; const allowed = (gs.allowed && gs.allowed.length) ? gs.allowed : DEFAULT_ALLOWED;
  const hits = text.match(new RegExp(LINK_RE.source, 'gi')) || [];
  return hits.some(h => !allowed.some(d => h.toLowerCase().includes(String(d).toLowerCase())));
}
/**
 * ctx: { sender, exempt:boolean (owner/mod/bot), isGroupAdmin: async(jid)=>bool, bare:(jid)=>string }
 * Returns 'link' | 'mention' | null.
 */
async function check(sock, msg, db, saveDatabase, ctx) {
  const chatId = msg?.key?.remoteJid; if (!chatId || !String(chatId).endsWith('@g.us') || !msg.message || msg.key.fromMe) return null;
  const sender = ctx.sender; if (!sender || ctx.exempt) return null;
  const mention = antiMentionOn(db, chatId) && isStatusMention(msg.message);
  const link = !mention && antiLinkOn(db, chatId) && hasBadLink(db, chatId, textOf(msg.message));
  if (!mention && !link) return null;
  try { if (ctx.isGroupAdmin && await ctx.isGroupAdmin(sender)) return null; } catch (e) {}
  const tag = `@${String(sender).split('@')[0].split(':')[0]}`;
  try { await sock.sendMessage(chatId, { delete: msg.key }); } catch (e) {}
  if (mention) {
    try { await sock.groupParticipantsUpdate(chatId, [sender], 'remove'); } catch (e) {}
    try { await sock.sendMessage(chatId, { text: `🪓 ${tag} *kicked* — mentioning this group in your status is not allowed here.`, mentions: [sender] }); } catch (e) {}
    return 'mention';
  }
  if (!db.antiLinkStrikes) db.antiLinkStrikes = {};
  const rec = db.antiLinkStrikes[sender] || (db.antiLinkStrikes[sender] = { count: 0 });
  rec.count++; rec.at = Date.now(); const n = rec.count;
  try {
    if (n === 1) await sock.sendMessage(chatId, { text: `⚠️ ${tag} *WARNING* — links are not allowed here.\n⛔ Next: *5-minute mute*, then *kick*.`, mentions: [sender] });
    else if (n === 2) { if (!db.mutedUsers) db.mutedUsers = {}; db.mutedUsers[sender] = { endsAt: Date.now() + 5 * 60 * 1000 }; await sock.sendMessage(chatId, { text: `🔇 ${tag} *muted for 5 minutes* — repeated links.`, mentions: [sender] }); }
    else { await sock.groupParticipantsUpdate(chatId, [sender], 'remove'); delete db.antiLinkStrikes[sender]; await sock.sendMessage(chatId, { text: `🪓 ${tag} *kicked* — repeated link spam.`, mentions: [sender] }); }
  } catch (e) {}
  try { if (typeof saveDatabase === 'function') saveDatabase(); } catch (e) {}
  return 'link';
}
module.exports = { check, settings, antiLinkOn, antiMentionOn, hasBadLink, isStatusMention, textOf, unwrap, DEFAULT_ALLOWED, LINK_RE };
