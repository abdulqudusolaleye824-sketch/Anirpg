/**
 * /kick (alias /remove) — Remove a user from the group.
 * Group-admin tier: the user AND the bot must both be group admins.
 * Owners / Co-Owners may use it even if they're not a group admin.
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');
const GroupAdmin = require('../../rpg/utils/GroupAdmin');
const UI = require('../../rpg/utils/UI');

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
    const proK = UI.isPro(db.users[sender]);

    const gate = await GroupAdmin.requireGroupAdmin(sock, chatId, sender, db);
    if (!gate.ok) return sock.sendMessage(chatId, { text: gate.err }, { quoted: msg });

    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;

    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: [
          (proK ? UI.PRO_BAR : UI.FREE_BAR),
          '👢 *KICK A USER*',
          '',
          '📌 Usage: /kick @user',
          '',
          'Reply to their message and type /kick.',
          (proK ? UI.PRO_BAR : UI.FREE_BAR),
        ].join('\n'),
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
          (proK ? UI.PRO_BAR : UI.FREE_BAR),
          '👢 *USER KICKED* 👢',
          `👤 User: ${u?.name || '@' + Mod.bare(targetId)}`,
          `👮 By: @${Mod.bare(sender)}`,
          proK ? (UI.PRO_MINI + '\n👢 PRO GAVEL') : null,
          proK ? `📋 Group removal — they can rejoin; /ban blocks bot-wide` : null,
          (proK ? UI.PRO_BAR : UI.FREE_BAR),
        ].filter(x => x !== null).join('\n'),
        mentions: mentionedJid ? [targetId, sender] : [sender],
      }, { quoted: msg });
    } catch (error) {
      return sock.sendMessage(chatId, {
        text: '❌ *Failed to kick user.*\n\nMake sure the bot is an admin in this group.',
      }, { quoted: msg });
    }
  },
};
