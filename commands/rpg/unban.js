/**
 * /unban — Let a banned user use the bot again (mods + owners only).
 *   /unban @user   → target by mention
 *   /unban          → target the replied-to user
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');

module.exports = {
  name: 'unban',
  description: '✅ Unban a user',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Mod.canModerate(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ *Mods / Owners only.*\n\nYou need mod permissions to use /unban.',
      }, { quoted: msg });
    }

    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;

    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: [
          '✅ *UNBAN A USER*',
          '',
          '📌 Usage:',
          '  /unban @user',
          '',
          'Reply to their message and type /unban.',
        ].join('\n'),
      }, { quoted: msg });
    }

    if (!Mod.isBanned(db, targetId)) {
      return sock.sendMessage(chatId, {
        text: 'ℹ️ This user is *not banned*.',
      }, { quoted: msg });
    }

    Mod.unbanUser(db, targetId);
    saveDatabase();

    const u = Mod.getUser(db, targetId);
    await sock.sendMessage(chatId, {
      text: [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '✅ *USER UNBANNED* ✅',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        `👤 User: ${u?.name || '@' + Mod.bare(targetId)}`,
        `👮 By: @${Mod.bare(sender)}`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '_They can use the bot again._',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
      mentions: mentionedJid ? [targetId, sender] : [sender],
    }, { quoted: msg });

    try {
      await sock.sendMessage(targetId, {
        text: '✅ You have been *unbanned*. You can use the bot again.',
      });
    } catch (_) {}
  },
};
