/**
 * /kick — Remove a user from the group (mods + owners only). Bot must be admin.
 *   /kick @user   → target by mention
 *   /kick          → target the replied-to user
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');

module.exports = {
  name: 'kick',
  description: '👢 Kick user from the group',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Mod.canModerate(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ *Mods / Owners only.*\n\nYou need mod permissions to use /kick.',
      }, { quoted: msg });
    }

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: '❌ This command only works in groups!',
      }, { quoted: msg });
    }

    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;

    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: [
          '👢 *KICK A USER*',
          '',
          '📌 Usage: /kick @user',
          '',
          'Reply to their message and type /kick.',
        ].join('\n'),
      }, { quoted: msg });
    }

    if (Mod.bare(targetId) === Mod.bare(sender)) {
      return sock.sendMessage(chatId, { text: '❌ You cannot kick yourself!' }, { quoted: msg });
    }
    if (Mod.isProtected(db, targetId)) {
      return sock.sendMessage(chatId, {
        text: '❌ That user is an *Owner/Co-Owner/Mod* — you cannot kick them.',
      }, { quoted: msg });
    }

    try {
      await sock.groupParticipantsUpdate(chatId, [targetId], 'remove');
      const u = Mod.getUser(db, targetId);
      await sock.sendMessage(chatId, {
        text: [
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '👢 *USER KICKED* 👢',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          `👤 User: ${u?.name || '@' + Mod.bare(targetId)}`,
          `👮 By: @${Mod.bare(sender)}`,
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        ].join('\n'),
        mentions: mentionedJid ? [targetId, sender] : [sender],
      }, { quoted: msg });
    } catch (error) {
      return sock.sendMessage(chatId, {
        text: '❌ *Failed to kick user.*\n\nMake sure the bot is an admin in this group.',
      }, { quoted: msg });
    }
  },
};
