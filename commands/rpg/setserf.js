// ═══════════════════════════════════════════════════════════════
// /setserf — Choose your bot serf
//
// A "serf" is the one personality bot allowed to DM you. All other
// bots are blocked from sending you DMs (welcome DM is the only
// exception, sent on first join). The assignment is gated by mod
// approval — a 7-character code is generated and posted to the
// Mod GC, where any mod must run /approveserf --<code> to confirm.
//
// Usage:
//   /setserf @bot                — pick the bot you mentioned
//   /setserf                     — if you reply to a bot's message,
//                                   the bot is the one being selected
//   /setserf status              — see your current serf + pending
//   /setserf cancel              — discard a pending (unapproved) code
// ═══════════════════════════════════════════════════════════════

'use strict';

const PersonalityManager = require('../../bots/PersonalityManager');
const SerfManager       = require('../../rpg/utils/SerfManager');
const AutoRedirect      = require('../../rpg/utils/AutoRedirect');
const Perms             = require('../../utils/permissions');

/**
 * Resolve which bot the user is referring to.
 * Priority:
 *   1. Mentioned JID in args[0]  (if it matches a linked bot)
 *   2. The bot whose message was quoted/replied to
 *   3. The active bot in this group chat
 */
function resolveBotKey(args, msg, db) {
  // 1. Mentioned JID
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (mentioned.length > 0) {
    for (const jid of mentioned) {
      const key = PersonalityManager.getPersonalityForJid(jid);
      if (key) return { key, jid };
    }
  }

  // 2. Replied-to / quoted message — its sender
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (quoted) {
    const key = PersonalityManager.getPersonalityForJid(quoted);
    if (key) return { key, jid: quoted };
  }

  // 3. Active bot in this group
  const chatId = msg.key.remoteJid;
  if (chatId?.endsWith('@g.us')) {
    const activeKey = PersonalityManager.getActiveBot(chatId);
    if (activeKey) {
      // Find the JID for the active key
      const linked = PersonalityManager.linkedNumbers || {};
      for (const [jid, key] of Object.entries(linked)) {
        if (key === activeKey) return { key, jid };
      }
      return { key: activeKey, jid: null };
    }
  }

  return null;
}

module.exports = {
  name: 'setserf',
  aliases: ['serf'],
  description: '⚓ Choose your bot serf (mod-approved)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db     = getDatabase();
    const sub    = (args[0] || '').toLowerCase();

    // ── /setserf status ────────────────────────────────────────
    if (sub === 'status' || sub === 'info' || sub === 'check') {
      const serf = SerfManager.getSerf(db, sender);
      const pending = SerfManager.getPendingRequest(db, sender);

      let txt = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      txt += '⚓ *YOUR SERF STATUS*\n';
      txt += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

      if (serf) {
        const info = PersonalityManager.getPersonalityInfo(serf.botKey);
        txt += `✅ *Current serf:* ${info?.emoji || '🤖'} *${info?.displayName || serf.botKey}* (${serf.botKey})\n`;
        txt += `   Approved: ${new Date(serf.approvedAt).toLocaleString()}\n`;
        if (serf.approvedBy) txt += `   By: @${serf.approvedBy.split('@')[0]}\n`;
      } else {
        txt += '❌ *No serf set.*\n';
        txt += '   Run `/setserf @bot` to pick one.\n';
      }

      if (pending) {
        const mins = Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 60000));
        txt += `\n⏳ *Pending code:* \`${pending.code}\` (expires in ${mins}m)\n`;
        txt += `   Awaiting mod approval in the Mod GC.\n`;
      }

      txt += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      txt += '💡 Only your serf bot can DM you.\n';
      txt += '💡 Welcome DM works for everyone once.\n';
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /setserf cancel ────────────────────────────────────────
    if (sub === 'cancel' || sub === 'abort') {
      const ok = SerfManager.cancelRequest(db, sender);
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: ok
          ? '✅ Pending serf request cancelled.\n\nRun `/setserf @bot` to start over.'
          : 'ℹ️ You don\'t have a pending serf request.',
      }, { quoted: msg });
    }

    // ── /setserf @bot (or reply to a bot's message) ────────────
    if (!Perms.isRegistered(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Register first with `/register <name>`.',
      }, { quoted: msg });
    }

    const bot = resolveBotKey(args, msg, db);
    if (!bot || !bot.key) {
      return sock.sendMessage(chatId, {
        text:
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          '⚓ *CHOOSE YOUR SERF*\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
          'A *serf* is the one personality bot allowed to DM you.\n' +
          'All other bots are blocked from sending you DMs.\n\n' +
          '*How to pick:*\n' +
          '• `/setserf @botname` — pick the bot you mention\n' +
          '• Reply to a bot message with `/setserf`\n\n' +
          '*A mod will need to confirm your choice* with a 7-char code\n' +
          'posted in the Mod GC.\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          '*Available bots:*\n' +
          PersonalityManager.getAllPersonalities()
            .map(k => {
              const info = PersonalityManager.getPersonalityInfo(k);
              return `  ${info.emoji} ${info.displayName} (${k})`;
            }).join('\n'),
      }, { quoted: msg });
    }

    // Don't let the player choose a bot for which we don't have a JID
    // (e.g. the bot was never linked via BOT_<KEY>=... env var)
    if (!bot.jid) {
      return sock.sendMessage(chatId, {
        text:
          `❌ I can't find a linked WhatsApp number for *${bot.key}*.\n\n` +
          `The bot admin must set \`BOT_${bot.key.toUpperCase()}=<phone>@s.whatsapp.net\` in .env first.`,
      }, { quoted: msg });
    }

    // Generate a 7-char code and a request
    const result = SerfManager.createRequest(db, sender, bot.key, bot.jid, chatId);
    if (!result.success) {
      return sock.sendMessage(chatId, { text: `❌ ${result.error}` }, { quoted: msg });
    }
    saveDatabase();

    const info     = PersonalityManager.getPersonalityInfo(bot.key);
    const playerDb = db.users?.[sender];
    const playerName = playerDb?.name || sender.split('@')[0];

    // ── Notify the player (in chat) ────────────────────────────
    await sock.sendMessage(chatId, {
      text:
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '⚓ *SERF REQUEST CREATED*\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        `You chose: ${info?.emoji || '🤖'} *${info?.displayName || bot.key}*\n\n` +
        `🔑 *Your code:* \`${result.code}\`\n` +
        `⏳ Expires in 30 minutes.\n\n` +
        'A mod will confirm in the Mod GC using:\n' +
        `\`/approveserf --${result.code}\`\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '💡 The bot will NOT DM you until a mod approves.\n' +
        '💡 Run `/setserf status` to check progress.\n' +
        '💡 Run `/setserf cancel` to discard and pick a different bot.\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      mentions: [sender],
    }, { quoted: msg });

    // ── Post the code to the Mod GC (if configured) ────────────
    const modGroupId = AutoRedirect._getCfg(db).mods?.groupId;
    if (modGroupId) {
      const expiresAt = new Date(result.expiresAt).toLocaleString();
      try {
        await sock.sendMessage(modGroupId, {
          text:
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            '🔧 *NEW SERF APPROVAL REQUEST*\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            `👤 *Player:* @${sender.split('@')[0]} (${playerName})\n` +
            `🤖 *Requested serf:* ${info?.emoji || '🤖'} *${info?.displayName || bot.key}* (${bot.key})\n` +
            `📍 *Requested in:* ${chatId}\n\n` +
            `🔑 *Code:* \`${result.code}\`\n` +
            `⏳ *Expires:* ${expiresAt}\n\n` +
            'A mod must run:\n' +
            `\`/approveserf --${result.code}\`\n\n` +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            '⚠️ Verify that the player has saved the bot\'s number on WhatsApp before approving.\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          mentions: [sender],
        });
      } catch (e) {
        console.error('❌ Failed to post serf request to Mod GC:', e.message);
        await sock.sendMessage(chatId, {
          text:
            '⚠️ I couldn\'t post the request to the Mod GC. A mod still needs to approve manually:\n' +
            `\`/approveserf --${result.code}\`\n` +
            '(Tell them in any group chat.)',
        }, { quoted: msg });
      }
    } else {
      // No Mod GC configured — tell the player to inform a mod
      await sock.sendMessage(chatId, {
        text:
          '⚠️ *No Mod GC is configured yet.*\n\n' +
          'A mod still needs to run:\n' +
          `\`/approveserf --${result.code}\`\n\n` +
          '(Owner: register the Mod GC with `/setgroup mods` inside it.)',
      }, { quoted: msg });
    }
  },
};
