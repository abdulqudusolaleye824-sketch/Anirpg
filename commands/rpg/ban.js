/**
 * /ban — Ban a user from using the bot (mods + owners only).
 *
 * Input:
 *   /ban @user [reason]      → ban by mention
 *   /ban [reason]            → ban the replied-to user
 *
 * A banned user is fully blocked at the command handler: whenever they send any
 * command, the bot replies with their ban reason. Keyed by bare number so it
 * actually matches at enforcement time (fixes "ban didn't really ban").
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');

module.exports = {
  name: 'ban',
  description: '🚫 Ban a user from using the bot',
  aliases: ['banuser'],

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!db.bannedUsers) db.bannedUsers = {};

    // ── Permission: owner / co-owner / mod ────────────────────────────
    if (!Mod.canModerate(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ *Mods / Owners only.*\n\nYou need mod permissions to use /ban.',
      }, { quoted: msg });
    }

    // ── Resolve target (mention > replied-to) ─────────────────────────
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;

    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: [
          '🚫 *BAN A USER*',
          '',
          '📌 Usage:',
          '  /ban @user [reason]',
          '  /ban @user spamming',
          '',
          'Reply to their message and type /ban [reason].',
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── Guards ───────────────────────────────────────────────────────
    if (Mod.bare(targetId) === Mod.bare(sender)) {
      return sock.sendMessage(chatId, { text: '❌ You cannot ban yourself!' }, { quoted: msg });
    }
    if (Mod.isProtected(db, targetId)) {
      return sock.sendMessage(chatId, {
        text: '❌ That user is an *Owner/Co-Owner/Mod* — you cannot ban them.',
      }, { quoted: msg });
    }
    if (Mod.isBanned(db, targetId)) {
      const u = Mod.getUser(db, targetId);
      return sock.sendMessage(chatId, {
        text: `ℹ️ *${u?.name || '@' + Mod.bare(targetId)}* is already banned.`,
        mentions: mentionedJid ? [targetId] : undefined,
      }, { quoted: msg });
    }

    // ── Ban ──────────────────────────────────────────────────────────
    const reason = args.join(' ').replace(/^@\S+\s*/, '') || 'No reason provided';
    const key = Mod.bare(targetId);
    const u = Mod.getUser(db, targetId);
    const name = u?.name || key;

    Mod.banUser(db, targetId, sender, reason);
    saveDatabase();

    await sock.sendMessage(chatId, {
      text: [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '🚫 *USER BANNED* 🚫',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        `👤 User: ${name}`,
        `📝 Reason: ${reason}`,
        `👮 By: @${Mod.bare(sender)}`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '_They can no longer use any bot command._',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
      mentions: mentionedJid ? [targetId, sender] : [sender],
    }, { quoted: msg });

    // Notify the banned user (DM, best-effort)
    try {
      await sock.sendMessage(targetId, {
        text: [
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '🚫 *YOU HAVE BEEN BANNED* 🚫',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          `📝 Reason: ${reason}`,
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          'You can no longer use bot commands.',
          'Contact a mod to appeal.',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        ].join('\n'),
      });
    } catch (_) {}
  },
};
