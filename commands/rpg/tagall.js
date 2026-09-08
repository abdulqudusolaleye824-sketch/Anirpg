/**
 * /tagall — @mention every member in the group (Group Admins + Mods + Owners).
 *
 * Pings all participants via the `mentions` array.
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');

module.exports = {
  name: 'tagall',
  description: '📢 Tag all members in the group (Group Admins / Mods / Owners)',
  aliases: ['mentionall', 'tag', 'all'],

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: '❌ This command only works in group chats!',
      }, { quoted: msg });
    }

    // Check if sender is Bot Mod/Owner OR a Group Admin in this group
    let isAuthorized = Mod.canModerate(db, sender);
    if (!isAuthorized) {
      try {
        const meta = await sock.groupMetadata(chatId);
        const senderBare = Mod.bare(sender);
        const participant = meta.participants.find(p => p.id === sender || Mod.bare(p.id) === senderBare);
        if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
          isAuthorized = true;
        }
      } catch (e) { /* ignore metadata errors */ }
    }

    if (!isAuthorized) {
      return sock.sendMessage(chatId, {
        text: '❌ *Group Admins / Mods / Owners only.*\n\nYou need to be a group admin or bot mod to use /tagall.',
      }, { quoted: msg });
    }

    const message = args.join(' ') || '📢 Announcement';

    try {
      const groupMetadata = await sock.groupMetadata(chatId);
      const participants = groupMetadata.participants.map((p) => p.id);

      if (!participants || participants.length === 0) {
        return sock.sendMessage(chatId, {
          text: '❌ Could not fetch group members.',
        }, { quoted: msg });
      }

      const text = [
        '📢 *GROUP ANNOUNCEMENT* 📢',
        '',
        message,
      ].join('\n');

      await sock.sendMessage(chatId, {
        text,
        mentions: participants,
      }, { quoted: msg });
    } catch (error) {
      return sock.sendMessage(chatId, {
        text: '❌ *Failed to send announcement.*\n\nMake sure the bot is an admin.',
      }, { quoted: msg });
    }
  },
};
