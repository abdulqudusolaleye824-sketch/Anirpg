/**
 * /unmute — Let a muted user use bot commands again (mods + owners only).
 *   /unmute @user   → target by mention
 *   /unmute          → target the replied-to user
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');

module.exports = {
  name: 'unmute',
  description: '🔊 Unmute a user so they can use bot commands again',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Mod.canModerate(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ *Mods / Owners only.*\n\nYou need mod permissions to use /unmute.',
      }, { quoted: msg });
    }

    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;

    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: [
          '🔊 *UNMUTE A USER*',
          '',
          '📌 Usage:',
          '  /unmute @user',
          '',
          'Reply to their message and type /unmute.',
        ].join('\n'),
      }, { quoted: msg });
    }

    if (!Mod.isMuted(db, targetId)) {
      return sock.sendMessage(chatId, {
        text: 'ℹ️ This user is *not muted*.',
      }, { quoted: msg });
    }

    Mod.unmuteUser(db, targetId);
    saveDatabase();

    const u = Mod.getUser(db, targetId);
    await sock.sendMessage(chatId, {
      text: [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '🔊 *USER UNMUTED* 🔊',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        `👤 User: ${u?.name || '@' + Mod.bare(targetId)}`,
        `👮 By: @${Mod.bare(sender)}`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '_They can use bot commands again._',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
      mentions: mentionedJid ? [targetId, sender] : [sender],
    }, { quoted: msg });

    try {
      await sock.sendMessage(targetId, {
        text: '🔊 You have been *unmuted*. You can use bot commands again.',
      });
    } catch (_) {}
  },
};
