/**
 * /mute — MOD-LEVEL command. Works like /ban but GROUP-RESTRICTED:
 *   - The muted player can't use commands in this group.
 *   - EVERY message they send (including commands) is silently deleted
 *     by the bot while muted.
 *   - Bot must be a group admin to delete the messages.
 *   - Optional duration in minutes; omit for indefinite (until /unmute).
 *
 *   /mute @user [minutes]   → mute for N minutes
 *   /mute @user             → mute until /unmute
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');
const GroupAdmin = require('../../rpg/utils/GroupAdmin');
const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'mute',
  description: '🔇 Group-restricted mute (mod level) — deletes the user\u2019s messages',
  category: 'mod',
  usage: '/mute @user [minutes]',
  availability: 'Mods / Owners (bot must be group admin)',
  where: 'Groups only',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const proM = UI.isPro(db.users[sender]);

    if (!Mod.canModerate(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ *Mods / Owners only.*\n\nYou need mod permissions to use /mute.',
      }, { quoted: msg });
    }
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }

    // Confirm the bot is a group admin (needed to delete muted messages).
    const gate = await GroupAdmin.requireGroupAdmin(sock, chatId, sender, db);
    if (!gate.ok) {
      return sock.sendMessage(chatId, { text: '❌ I need to be a *group admin* to mute + delete messages.' }, { quoted: msg });
    }

    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;

    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: [
          (proM ? UI.PRO_BAR : UI.FREE_BAR),
          '🔇 *MUTE A USER*',
          proM ? (UI.PRO_MINI + '\n' + '🔇 PRO GAVEL') : null,
          proM ? `📊 Muted in this group: *${Object.keys(db.groupMutes?.[chatId] || {}).length}*` : null,
          proM ? '' : null,
          '📌 Usage:',
          '  /mute @user [minutes]',
          '  /mute @user 60     (mute 60 min)',
          '  /mute @user        (mute until /unmute)',
          '',
          'Reply to their message and type /mute [minutes].',
          '',
          '_Muted users have all their messages deleted here._',
          (proM ? UI.PRO_BAR : UI.FREE_BAR),
        ].filter(x => x !== null).join('\n'),
      }, { quoted: msg });
    }

    if (Mod.bare(targetId) === Mod.bare(sender)) {
      return sock.sendMessage(chatId, { text: '❌ You cannot mute yourself!' }, { quoted: msg });
    }
    if (GroupAdmin.isProtected(db, targetId)) {
      return sock.sendMessage(chatId, {
        text: '❌ That user is an *Owner/Co-Owner/Mod* — you cannot mute them.',
      }, { quoted: msg });
    }

    const duration = parseInt(args.find((a) => /^\d+$/.test(a)));
    const durationText = duration > 0 ? `${duration} min` : 'until /unmute';

    Mod.groupMute(db, chatId, targetId, sender, duration || 0);
    saveDatabase();

    const u = Mod.getUser(db, targetId);
    return sock.sendMessage(chatId, {
      text: [
        (proM ? UI.PRO_BAR : UI.FREE_BAR),
        '🔇 *USER MUTED* 🔇',
        `👤 User: ${u?.name || '@' + Mod.bare(targetId)}`,
        `⏰ Duration: ${durationText}`,
        `👮 By: @${Mod.bare(sender)}`,
        proM ? (UI.PRO_MINI + '\n' + '🔇 PRO GAVEL') : null,
        proM ? `📊 Muted in this group: *${Object.keys(db.groupMutes?.[chatId] || {}).length}*` : null,
        '_Their messages here will be deleted silently._',
        (proM ? UI.PRO_BAR : UI.FREE_BAR),
      ].filter(x => x !== null).join('\n'),
      mentions: mentionedJid ? [targetId, sender] : [sender],
    }, { quoted: msg });
  },
};
