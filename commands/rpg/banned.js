/**
 * /banned — List every banned user (mods + owners only).
 * Lists each banned user and TAGS (@mention) them in the message.
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');
const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'banned',
  description: '🚫 List all banned users',
  aliases: ['banlist', 'bannedlist'],

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const proB = UI.isPro(db.users[sender]);

    if (!Mod.canModerate(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ *Mods / Owners only.*\n\nYou need mod permissions to view banned users.',
      }, { quoted: msg });
    }

    if (!db.bannedUsers) db.bannedUsers = {};

    const entries = Object.entries(db.bannedUsers); // [key, rec]
    if (entries.length === 0) {
      return sock.sendMessage(chatId, {
        text: [
          (proB ? UI.PRO_BAR : UI.FREE_BAR),
          '✅ *No banned users.*',
          (proB ? UI.PRO_BAR : UI.FREE_BAR),
        ].join('\n'),
      }, { quoted: msg });
    }

    const lines = [(proB ? UI.PRO_BAR : UI.FREE_BAR), '🚫 *BANNED USERS* 🚫', `Total: ${entries.length}`,
      ...(proB ? [(UI.PRO_MINI + '\n🚫 PRO GAVEL'), `📊 *${entries.length}* banned users on record`, ''] : [])];
    const mentions = [];

    entries.forEach(([key, rec], i) => {
      const u = Mod.getUser(db, key);
      const n = u?.name || key;
      const bannedBy = rec.bannedBy ? '@' + rec.bannedBy.split('@')[0].split(':')[0] : 'Unknown';
      const gmt = rec.bannedAtGMT || (rec.bannedAt ? new Date(rec.bannedAt).toUTCString() : '?');
      const gcInfo = rec.gcName ? `${rec.gcName} (${rec.gc || '?'})` : (rec.gc || 'Unknown GC');
      lines.push(`${i + 1}. ${n} (@${key})`);
      lines.push(`   👮 Banned by: ${bannedBy}`);
      lines.push(`   📝 Reason: ${rec.reason || 'No reason'}`);
      lines.push(`   📍 GC: ${gcInfo}`);
      lines.push(`   🕒 Time (GMT): ${gmt}`);
      lines.push('');
      mentions.push(`${key}@s.whatsapp.net`);
      if (rec.bannedBy) mentions.push(rec.bannedBy);
    });

    lines.push('Use /unban [user] to unban someone.');
    lines.push((proB ? UI.PRO_BAR : UI.FREE_BAR));

    await sock.sendMessage(chatId, {
      text: lines.join('\n'),
      mentions,
    }, { quoted: msg });
  },
};
