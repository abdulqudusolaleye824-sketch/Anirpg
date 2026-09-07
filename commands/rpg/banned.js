/**
 * /banned — List every banned user (mods + owners only).
 * Lists each banned user and TAGS (@mention) them in the message.
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');

module.exports = {
  name: 'banned',
  description: '🚫 List all banned users',
  aliases: ['banlist', 'bannedlist'],

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Mod.canModerate(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ *Mods / Owners only.*\n\nYou need mod permissions to view banned users.',
      }, { quoted: msg });
    }

    if (!db.bannedUsers) db.bannedUsers = {};

    const entries = Object.entries(db.bannedUsers); // [key, rec]
    if (entries.length === 0) {
      return sock.sendMessage(chatId, {
        text: '✅ *No banned users.*',
      }, { quoted: msg });
    }

    const lines = ['━━━━━━━━━━━━━━━━━━━━━━━━━━━', '🚫 *BANNED USERS* 🚫', '━━━━━━━━━━━━━━━━━━━━━━━━━━━', `Total: ${entries.length}`, '━━━━━━━━━━━━━━━━━━━━━━━━━━━'];
    const mentions = [];

    entries.forEach(([key, rec], i) => {
      const u = Mod.getUser(db, key);
      const n = u?.name || key;
      lines.push(`${i + 1}. ${n}`);
      lines.push(`   @${key}`);
      lines.push(`   📝 ${rec.reason || 'No reason'}`);
      lines.push(`   📅 ${rec.bannedAt ? new Date(rec.bannedAt).toLocaleDateString() : '?'}`);
      lines.push('');
      mentions.push(`${key}@s.whatsapp.net`);
    });

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('Use /unban [user] to unban someone.');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await sock.sendMessage(chatId, {
      text: lines.join('\n'),
      mentions,
    }, { quoted: msg });
  },
};
