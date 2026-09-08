// renew.js — Extend a non-main group's subscription by 30 days (owner/co-owner)
const AstralGroups = require('../../rpg/utils/AstralGroups');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'renew',
  description: '💳 [Owner] Extend this group\u2019s subscription by 30 days',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotOwner(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Owner / Co-Owner only!' }, { quoted: msg });
    }
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ Run this inside the group you are renewing.' }, { quoted: msg });
    }

    const res = AstralGroups.renew(db, chatId);
    if (!res.success) return sock.sendMessage(chatId, { text: `❌ ${res.reason}` }, { quoted: msg });
    saveDatabase();

    const days = AstralGroups.daysLeft(db, chatId);
    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💳 *SUBSCRIPTION RENEWED*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🎮 Server: ✦ 𝐀𝐬𝐭𝐫𝐚™\n⏳ New expiry: *${days} days* from now\n\n✅ The bot is active again in this group.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg });
  },
};
