/**
 * /mute — Silence a user from using bot commands (mods + owners only).
 * Like /ban but the bot silently ignores the muted user (no "you are banned"
 * notice to them). Optionally temporary:
 *   /mute @user [minutes]      → mute for N minutes
 *   /mute @user                → mute until unmuted
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');

module.exports = {
  name: 'mute',
  description: '🔇 Silently ignore a user from bot commands',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Mod.canModerate(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ *Mods / Owners only.*\n\nYou need mod permissions to use /mute.',
      }, { quoted: msg });
    }

    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;

    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: [
          '🔇 *MUTE A USER*',
          '',
          '📌 Usage:',
          '  /mute @user [minutes]',
          '  /mute @user 60     (mute 60 min)',
          '  /mute @user        (mute indefinitely)',
          '',
          'Reply to their message and type /mute [minutes].',
        ].join('\n'),
      }, { quoted: msg });
    }

    if (Mod.bare(targetId) === Mod.bare(sender)) {
      return sock.sendMessage(chatId, { text: '❌ You cannot mute yourself!' }, { quoted: msg });
    }
    if (Mod.isProtected(db, targetId)) {
      return sock.sendMessage(chatId, {
        text: '❌ That user is an *Owner/Co-Owner/Mod* — you cannot mute them.',
      }, { quoted: msg });
    }

    const duration = parseInt(args.find((a) => /^\d+$/.test(a)));
    const durationText = duration > 0 ? `${duration} min` : 'until /unmute';

    Mod.muteUser(db, targetId, sender, duration || 0);
    saveDatabase();

    const u = Mod.getUser(db, targetId);
    await sock.sendMessage(chatId, {
      text: [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '🔇 *USER MUTED* 🔇',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        `👤 User: ${u?.name || '@' + Mod.bare(targetId)}`,
        `⏰ Duration: ${durationText}`,
        `👮 By: @${Mod.bare(sender)}`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '_Their commands will be silently ignored._',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
      mentions: mentionedJid ? [targetId, sender] : [sender],
    }, { quoted: msg });

    // No DM to the muted user (mute is SILENT by design)
  },
};
