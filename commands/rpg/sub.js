// sub.js — Push #96h-t: anyone in a group can see its subscription
// (subscribed date, expiry date, days remaining). Read-only.
const AstralGroups = require('../../rpg/utils/AstralGroups');

function _fmt(ts) { try { return new Date(ts).toUTCString().slice(5, 16); } catch (e) { return '—'; } }

function render(db, chatId, now = Date.now()) {
  const e = AstralGroups.getEntry(db, chatId);
  if (!e) return `ℹ️ *This group is not registered* — an owner can run */setgroup <type>* here.`;
  const info = AstralGroups.typeInfo(e.type);
  const lines = [`📋 *GROUP SUBSCRIPTION*`, `${info.emoji || '🌐'} Type: *${info.name || e.type}*${e.isMain ? ' (main)' : ''}`];
  if (e.isMain || AstralGroups.isNeverExpiring(e)) {
    lines.push(`📅 Registered: ${_fmt(e.setAt || e.startsAt || now)}`, `♾️ Subscription: *never expires*`);
    return lines.join('\n');
  }
  const status = AstralGroups.statusOf(db, chatId, now);
  const days = AstralGroups.daysLeft(db, chatId, now);
  lines.push(`📅 Subscribed: ${e.startsAt ? _fmt(e.startsAt) : '—'}`);
  lines.push(`⏳ Expires: ${e.expiresAt ? _fmt(e.expiresAt) : '— (no subscription yet)'}`);
  if (e.expiresAt) lines.push(status === 'expired' ? `🔴 *EXPIRED* — an owner can renew with */renew*` : `🟢 *${days} day${days === 1 ? '' : 's'} remaining*`);
  else lines.push(`🟡 Status: ${status || 'pending'}`);
  if (e.subscriber) lines.push(`👤 Subscriber: ${e.subscriber}`);
  return lines.join('\n');
}

module.exports = {
  name: 'sub',
  aliases: ['subscription', 'substatus'],
  description: '📋 Show this group\'s subscription (subscribed date, expiry, days left)',
  render,
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!String(chatId).endsWith('@g.us')) return sock.sendMessage(chatId, { text: '❌ Run */sub* inside the group you want to check.' }, { quoted: msg });
    return sock.sendMessage(chatId, { text: render(db, chatId) }, { quoted: msg });
  },
};
