/**
 * /unban — Let a banned user use the bot again (mods + owners only).
 *   /unban @user   → target by mention
 *   /unban          → target the replied-to user
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');
const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'unban',
  description: '✅ Unban a user',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const proU = UI.isPro(db.users[sender]);

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
          (proU ? UI.PRO_BAR : UI.FREE_BAR),
          '✅ *UNBAN A USER*',
          proU ? (UI.PRO_MINI + '\n✅ PRO GAVEL') : null,
          proU ? `📊 Currently banned: *${Object.keys(db.bannedUsers || {}).length}*` : null,
          proU ? '' : null,
          '📌 Usage:',
          '  /unban @user',
          '',
          'Reply to their message and type /unban.',
          (proU ? UI.PRO_BAR : UI.FREE_BAR),
        ].filter(x => x !== null).join('\n'),
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
        (proU ? UI.PRO_BAR : UI.FREE_BAR),
        '✅ *USER UNBANNED* ✅',
        `👤 User: ${u?.name || '@' + Mod.bare(targetId)}`,
        `👮 By: @${Mod.bare(sender)}`,
        proU ? (UI.PRO_MINI + '\n✅ PRO GAVEL') : null,
        proU ? `📊 Remaining banned: *${Object.keys(db.bannedUsers || {}).length}*` : null,
        '_They can use the bot again._',
        (proU ? UI.PRO_BAR : UI.FREE_BAR),
      ].filter(x => x !== null).join('\n'),
      mentions: mentionedJid ? [targetId, sender] : [sender],
    }, { quoted: msg });
  },
};
