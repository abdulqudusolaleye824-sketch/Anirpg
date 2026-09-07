// ═══════════════════════════════════════════════════════════════
// /approveserf — Mod confirms a serf request
//
//   /approveserf --<CODE>             approve
//   /approveserf list                 show all pending requests
//   /approveserf pending @user        show a specific player's pending
//
// Must be run in the Mod GC, or by an owner in any chat.
// ═══════════════════════════════════════════════════════════════

'use strict';

const SerfManager        = require('../../rpg/utils/SerfManager');
const PersonalityManager = require('../../bots/PersonalityManager');
const AutoRedirect       = require('../../rpg/utils/AutoRedirect');
const { OWNER_JID, COOWNER_JID } = require('../../utils/constants');

function isModOrOwner(sender, db) {
  const num  = (sender.split('@')[0] || '').split(':')[0].replace(/[^0-9]/g, '');
  const own  = (OWNER_JID.split('@')[0] || '').replace(/[^0-9]/g, '');
  const co   = (COOWNER_JID.split('@')[0] || '').replace(/[^0-9]/g, '');
  if (num === own || num === co) return true;
  return (db.botMods || []).some(j => {
    const m = (j.split('@')[0] || '').split(':')[0].replace(/[^0-9]/g, '');
    return m === num;
  });
}

module.exports = {
  name: 'approveserf',
  aliases: ['approve'],
  description: '🔧 Mod: approve a serf request',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db     = getDatabase();

    if (!isModOrOwner(sender, db)) {
      return sock.sendMessage(chatId, {
        text: '❌ Mods/owners only.',
      }, { quoted: msg });
    }

    const sub = (args[0] || '').toLowerCase();

    // ── /approveserf list ─────────────────────────────────────
    if (sub === 'list' || sub === 'pending' || sub === 'all') {
      const pending = SerfManager.listPending(db);
      if (pending.length === 0) {
        return sock.sendMessage(chatId, {
          text: '✅ No pending serf requests right now.',
        }, { quoted: msg });
      }

      let txt = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      txt += '🔧 *PENDING SERF REQUESTS*\n';
      txt += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      for (const r of pending) {
        const info = PersonalityManager.getPersonalityInfo(r.botKey);
        txt += `\`${r.code}\` — @${r.playerJid.split('@')[0]} → ${info?.emoji || '🤖'} *${info?.displayName || r.botKey}* (${r.minutesLeft}m left)\n`;
      }
      txt += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      txt += 'Approve with `/approveserf --<CODE>`\n';
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /approveserf pending @user ────────────────────────────
    if (sub === 'show' || sub === 'check') {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (mentioned.length === 0) {
        return sock.sendMessage(chatId, {
          text: '❌ Tag a player. Usage: `/approveserf pending @user`',
        }, { quoted: msg });
      }
      const req = SerfManager.getPendingRequest(db, mentioned[0]);
      if (!req) {
        return sock.sendMessage(chatId, {
          text: `ℹ️ @${mentioned[0].split('@')[0]} has no pending serf request.`,
          mentions: mentioned,
        }, { quoted: msg });
      }
      const info = PersonalityManager.getPersonalityInfo(req.botKey);
      return sock.sendMessage(chatId, {
        text:
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          '🔧 *PENDING SERF REQUEST*\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
          `👤 @${req.playerJid.split('@')[0]}\n` +
          `🤖 ${info?.emoji || '🤖'} *${info?.displayName || req.botKey}*\n` +
          `🔑 Code: \`${req.code}\`\n` +
          `⏳ Expires in ${Math.max(0, Math.ceil((req.expiresAt - Date.now()) / 60000))}m\n\n` +
          `Approve: \`/approveserf --${req.code}\``,
        mentions: [req.playerJid],
      }, { quoted: msg });
    }

    // ── /approveserf --<CODE> ─────────────────────────────────
    // Accept either /approveserf --CODE or /approveserf CODE
    let code = null;
    for (const a of args) {
      const m = a.match(/^--?([A-Z0-9]{5,10})$/);
      if (m) { code = m[1].toUpperCase(); break; }
    }
    if (!code) {
      return sock.sendMessage(chatId, {
        text:
          '❌ Usage: `/approveserf --<CODE>`\n\n' +
          'Example: `/approveserf --A3K9P2M`\n' +
          'Or: `/approveserf list` to see pending requests.',
      }, { quoted: msg });
    }

    const result = SerfManager.approveRequest(db, code, sender);
    if (!result.success) {
      return sock.sendMessage(chatId, {
        text: `❌ ${result.error}`,
      }, { quoted: msg });
    }
    saveDatabase();

    const info     = PersonalityManager.getPersonalityInfo(result.botKey);
    const serf     = SerfManager.getSerf(db, result.playerJid);
    const playerDb = db.users?.[result.playerJid];
    const playerName = playerDb?.name || result.playerJid.split('@')[0];

    // Confirm in the chat where /approveserf was run
    await sock.sendMessage(chatId, {
      text:
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '✅ *SERF APPROVED*\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        `👤 ${playerName} → ${info?.emoji || '🤖'} *${info?.displayName || result.botKey}*\n\n` +
        'Only this bot can now DM them. The bot itself will see\n' +
        'them as its serf and react accordingly.\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      mentions: [result.playerJid],
    }, { quoted: msg });

    // DM the player confirming the approval
    try {
      const dmJid = result.playerJid.endsWith('@lid')
        ? result.playerJid.replace(/@lid$/, '@s.whatsapp.net')
        : result.playerJid;
      await sock.sendMessage(dmJid, {
        text:
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          '⚓ *SERF CONFIRMED*\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
          `Your bot serf is now: ${info?.emoji || '🤖'} *${info?.displayName || result.botKey}*\n\n` +
          '✅ This bot is the only one allowed to DM you.\n' +
          '❌ All other bots are blocked from messaging you.\n\n' +
          'Tip: send the bot a message in any group to start chatting.\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      });
    } catch (e) {
      // Non-fatal — player will see it next time they open the chat
    }
  },
};
