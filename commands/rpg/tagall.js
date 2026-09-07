/**
 * /tagall — @mention every member in the group (mods + owners only).
 *
 * The message TEXT stays clean (no visible list of @numbers) — everyone is
 * pinged via the `mentions` array, so WhatsApp notifies them but the bubble
 * shows only the announcement. The message/reason is shown at the top so the
 * announcement text is clear.
 *
 *   /tagall [message]
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');

module.exports = {
  name: 'tagall',
  description: '📢 Tag all members in the group',
  aliases: ['mentionall', 'tag', 'all'],

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Mod.canModerate(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ *Mods / Owners only.*\n\nYou need mod permissions to use /tagall.',
      }, { quoted: msg });
    }

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: '❌ This command only works in groups!',
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

      // Clean text — mention EVERYONE silently via `mentions`, no visible tags.
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
