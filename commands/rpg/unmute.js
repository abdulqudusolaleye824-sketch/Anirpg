/**
 * /unmute — Let a GROUP-muted user use bot commands again (mods + owners only).
 *   /unmute @user   → target by mention
 *   /unmute          → target the replied-to user
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');
const GroupAdmin = require('../../rpg/utils/GroupAdmin');

module.exports = {
  name: 'unmute',
  description: '🔊 Unmute a user so they can use the bot in this group',
  category: 'mod',
  usage: '/unmute @user',
  availability: 'Mods / Owners',
  where: 'Groups only',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Mod.canModerate(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ *Mods / Owners only.*\n\nYou need mod permissions to use /unmute.',
      }, { quoted: msg });
    }
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ This command only works in groups.' }, { quoted: msg });
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

    if (!Mod.isGroupMuted(db, chatId, targetId)) {
      return sock.sendMessage(chatId, {
        text: 'ℹ️ This user is *not muted* in this group.',
      }, { quoted: msg });
    }

    // No bot-admin requirement to unmute.
    const gate = await GroupAdmin.requireGroupAdmin(sock, chatId, sender, db);
    if (!gate.ok) {
      return sock.sendMessage(chatId, { text: '❌ I need to be a *group admin* for that.' }, { quoted: msg });
    }

    Mod.groupUnmute(db, chatId, targetId);
    saveDatabase();

    const u = Mod.getUser(db, targetId);
    return sock.sendMessage(chatId, {
      text: [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '🔊 *USER UNMUTED* 🔊',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        `👤 User: ${u?.name || '@' + Mod.bare(targetId)}`,
        `👮 By: @${Mod.bare(sender)}`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '_They can use the bot in this group again._',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
      mentions: mentionedJid ? [targetId, sender] : [sender],
    }, { quoted: msg });
  },
};
