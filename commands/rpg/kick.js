/**
 * /kick (alias /remove) — Remove a user from the group.
 * Group-admin tier: the user AND the bot must both be group admins.
 * Owners / Co-Owners may use it even if they're not a group admin.
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');
const GroupAdmin = require('../../rpg/utils/GroupAdmin');

module.exports = {
  name: 'kick',
  aliases: ['remove'],
  description: '👢 Kick a user from the group',
  category: 'admin',
  usage: '/kick @user    (or reply to their message)',
  availability: 'Group admins (bot must be admin)',
  where: 'Groups only',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const gate = await GroupAdmin.requireGroupAdmin(sock, chatId, sender, db);
    if (!gate.ok) return sock.sendMessage(chatId, { text: gate.err }, { quoted: msg });

    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;

    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: '👢 *KICK A USER*\n\n📌 Usage: /kick @user\n\nReply to their message and type /kick.',
      }, { quoted: msg });
    }

    if (Mod.bare(targetId) === Mod.bare(sender)) {
      return sock.sendMessage(chatId, { text: '❌ You cannot kick yourself!' }, { quoted: msg });
    }
    if (GroupAdmin.isProtected(db, targetId)) {
      return sock.sendMessage(chatId, {
        text: '❌ That user is an *Owner/Co-Owner/Mod* — you cannot kick them.',
      }, { quoted: msg });
    }

    try {
      await sock.groupParticipantsUpdate(chatId, [targetId], 'remove');
      const u = Mod.getUser(db, targetId);
      return sock.sendMessage(chatId, {
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
