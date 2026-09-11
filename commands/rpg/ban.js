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
const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'ban',
  description: '🚫 Ban a user from using the bot',
  aliases: ['banuser'],

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const proBn = UI.isPro(db.users[sender]);

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
          (proBn ? UI.PRO_BAR : UI.FREE_BAR),
          '🚫 *BAN A USER*',
          proBn ? (UI.PRO_MINI + '\n' + '🚫 PRO GAVEL') : null,
          proBn ? `📊 Currently banned: *${Object.keys(db.bannedUsers || {}).length}*` : null,
          proBn ? '' : null,
          '📌 Usage:',
          '  /ban @user [reason]',
          '  /ban @user spamming',
          '',
          'Reply to their message and type /ban [reason] or /ban | <reason>.',
          (proBn ? UI.PRO_BAR : UI.FREE_BAR),
        ].filter(x => x !== null).join('\n'),
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
    let reason = args.join(' ').replace(/^@\S+\s*/, '') || 'No reason provided';
    // New config: support /ban | <reason>  and /ban @user | <reason>
    if (reason.includes('|')) {
      const parts = reason.split('|');
      // If pipe at start, take after pipe; otherwise take after first pipe
      reason = parts.slice(1).join('|').trim() || parts[0].trim() || 'No reason provided';
    }
    const key = Mod.bare(targetId);
    const u = Mod.getUser(db, targetId);
    const name = u?.name || key;
    // Capture GC info for audit
    let gcName = chatId;
    try {
      const gmd = await sock.groupMetadata(chatId).catch(()=>null);
      if (gmd && gmd.subject) gcName = gmd.subject;
    } catch {}
    const bannedAtGMT = new Date().toUTCString();
    Mod.banUser(db, targetId, sender, reason, { gc: chatId, gcName, bannedAtGMT });
    // Also store GMT directly for quick display
    if (db.bannedUsers[key]) db.bannedUsers[key].bannedAtGMT = bannedAtGMT;
    saveDatabase();

    await sock.sendMessage(chatId, {
      text: [
        (proBn ? UI.PRO_BAR : UI.FREE_BAR),
        '🚫 *USER BANNED* 🚫',
        `👤 User: ${name} (@${key})`,
        `📝 Reason: ${reason}`,
        `👮 Banned by: @${Mod.bare(sender)}`,
        `📍 GC: ${gcName} (${chatId})`,
        `🕒 Time (GMT): ${bannedAtGMT}`,
        proBn ? (UI.PRO_MINI + '\n' + '🚫 PRO GAVEL') : null,
        proBn ? `📊 Total banned: *${Object.keys(db.bannedUsers || {}).length}*` : null,
        '_They can no longer use any bot command._',
        (proBn ? UI.PRO_BAR : UI.FREE_BAR),
      ].filter(x => x !== null).join('\n'),
      mentions: mentionedJid ? [targetId, sender] : [sender],
    }, { quoted: msg });

    // Notify the banned user (DM, best-effort)
    try {
      await sock.sendMessage(targetId, {
        text: [
          (UI.isPro(Mod.getUser(db, targetId)) ? UI.PRO_BAR : UI.FREE_BAR),
          '🚫 *YOU HAVE BEEN BANNED* 🚫',
          `📝 Reason: ${reason}`,
          'You can no longer use bot commands.',
          'Contact a mod to appeal.',
          (UI.isPro(Mod.getUser(db, targetId)) ? UI.PRO_BAR : UI.FREE_BAR),
        ].join('\n'),
      });
    } catch (_) {}
  },
};
