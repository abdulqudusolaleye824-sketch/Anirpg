// setspace.js — designate THIS group as the Announcements group (owner/co-owner)
//   /setspace announcement  → make this group the bot's Announcements GC
// The owner/co-owner then DMs the bot with /announce <text> and it broadcasts
// here with a full /tagall effect. No other features.
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'setspace',
  aliases: ['setsa', 'announcementspace'],
  description: '📢 [Owner] Set this group as the Announcements group',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotOwner(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Owner / Co-Owner only!' }, { quoted: msg });
    }

    const sub = (args[0] || '').toLowerCase();
    if (sub !== 'announcement' && sub !== 'announce') {
      return sock.sendMessage(chatId, {
        text: `📌 Usage: */setspace announcement* — run inside the group you want to be the Announcements group.`,
      }, { quoted: msg });
    }

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: `❌ Run */setspace announcement* inside the group you want as the Announcements group (not a DM).`,
      }, { quoted: msg });
    }

    db.announceGC = chatId;
    saveDatabase();
    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📢 *ANNOUNCEMENTS GROUP SET*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nThis group is now the bot's Announcements group.\n\n✅ Owners/co-owners can now DM the bot:\n   */announce <message>*\n\nIt will be broadcast here, tagging all members (like /tagall).`,
    }, { quoted: msg });
  },
};
