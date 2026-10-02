/**
 * /resetpro [@hunter | reply]  — OWNER ONLY (Push #96h-q)
 * Wipes a hunter's PRO status and Pro-only perks (lock, custom emoji, auto-mend, tier, expiry).
 * Currency, items, cards, keys, boxes, level — everything else stays. No target = yourself.
 */
'use strict';
const Perms = require('../../utils/permissions');

function findUser(db, jid) { if (!jid) return null; const b = String(jid).split(':')[0].split('@')[0]; return db.users?.[jid] || db.users?.[`${b}@s.whatsapp.net`] || Object.values(db.users || {}).find(u => u && u.jid && String(u.jid).split('@')[0] === b) || null; }

function resetPro(p) {
  const had = { pro: !!(p.isPro || p.proStatus), expires: p.proExpiresAt || null, tier: p.proTier || null };
  p.isPro = false; p.proStatus = false; p.proExpiresAt = null; delete p.proTier;
  p.profileLocked = false;
  if (p.customEmoji) { p.lastCustomEmoji = p.customEmoji; delete p.customEmoji; }
  if (p.autoMend) p.autoMend = false;
  p.proResetAt = Date.now();
  return had;
}

module.exports = {
  name: 'resetpro', aliases: ['wipepro', 'unpro'],
  description: '👑 Owner: wipe a hunter\'s Pro status + perks (currency stays)',
  usage: '/resetpro [@hunter]', category: 'admin', ownerOnly: true, resetPro,
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Owner only.' }, { quoted: msg });
    const targetJid = require('../../utils/target').resolve(msg, args) || sender;
    const target = findUser(db, targetJid);
    if (!target) return sock.sendMessage(chatId, { text: '❌ That hunter is not registered.' }, { quoted: msg });
    const had = resetPro(target); saveDatabase();
    return sock.sendMessage(chatId, { text: [`🧹 *PRO RESET — ${target.name}*`, had.pro ? `Was Pro${had.expires ? ` (until ${new Date(had.expires).toLocaleDateString()})` : ''}${had.tier ? ` · tier ${had.tier}` : ''}.` : `Was not Pro — perks cleared anyway.`, `✅ Pro status, profile lock, custom emoji, auto-mend removed.`, `💠 Nexus, 💎 Mana Stones, items, cards, keys and boxes untouched.`].join('\n'), mentions: [targetJid] }, { quoted: msg });
  },
};
