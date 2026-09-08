// announce.js — owner/co-owner DMs the bot: /announce <text>
// Broadcasts <text> to the announcements GC (set via /setspace announcement)
// with a full /tagall effect (mentions every member).
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'announce',
  aliases: ['globalannounce'],
  description: '📢 [Owner] Broadcast an announcement to the announcements group (tag all)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotOwner(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Owner / Co-Owner only!' }, { quoted: msg });
    }

    const text = args.join(' ').trim();
    if (!text) {
      return sock.sendMessage(chatId, {
        text: `📌 Usage: */announce <message>*\n\n(Set the announcements group first with */setspace announcement*.)`,
      }, { quoted: msg });
    }

    const announceGC = db.announceGC;
    if (!announceGC) {
      return sock.sendMessage(chatId, {
        text: `❌ No announcements group is set.\nRun */setspace announcement* inside the target group first.`,
      }, { quoted: msg });
    }

    try {
      const gm = await sock.groupMetadata(announceGC);
      const participants = (gm.participants || gm.members || []).map(p => (typeof p === 'string' ? p : p.id)).filter(Boolean);

      const announcement = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📢 *ANNOUNCEMENT*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        text,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n');

      await sock.sendMessage(announceGC, {
        text: announcement,
        mentions: participants,
      });

      return sock.sendMessage(chatId, {
        text: `✅ Announcement broadcast to the announcements group.\n📢 *${text.replace(/\n+/g, ' ').slice(0, 60)}${text.length > 60 ? '…' : ''}*\n👥 Tagged ${participants.length} members.`,
      }, { quoted: msg });
    } catch (err) {
      console.error('[announce] failed:', err.message);
      return sock.sendMessage(chatId, {
        text: `❌ Could not announce. Make sure the bot is an admin of the announcements group and has access to it.`,
      }, { quoted: msg });
    }
  },
};
