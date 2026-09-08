// ssub.js — Start a 30-day subscription window on a non-main group (owner/co-owner)
// Usage: /ssub | <subscriber name>
const AstralGroups = require('../../rpg/utils/AstralGroups');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'ssub',
  description: '💳 [Owner] Start a 30-day subscription window for this group',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotOwner(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Owner / Co-Owner only!' }, { quoted: msg });
    }
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ Run this inside the group you are subscribing.' }, { quoted: msg });
    }

    // /ssub | <name> — subscriber name is everything after the '|'
    const full = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const name = full.split('|')[1]?.trim();
    const subscriberName = name || args.filter((a) => !a.startsWith('/') && !a.startsWith('|')).join(' ') || null;

    const res = AstralGroups.ssub(db, chatId, subscriberName);
    if (!res.success) return sock.sendMessage(chatId, { text: `❌ ${res.reason}` }, { quoted: msg });
    saveDatabase();

    const days = AstralGroups.daysLeft(db, chatId);
    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💳 *SUBSCRIPTION STARTED*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🎮 Server: ✦ 𝐀𝐬𝐭𝐫𝐚™\n👤 Subscriber: ${res.subscriber || 'Unnamed'}\n⏳ Duration: *30 days* (expires in ${days}d)\n\n✅ The bot is now active in this group.\n🔁 Renew anytime with /renew\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg });
  },
};
