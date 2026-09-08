// ═══════════════════════════════════════════════════════════════
// RESTART COMMAND — Restarts linked bots or process via PM2
//
// Usage:
//   /restart          — Restarts ALL linked bots
//   /restart <bot>    — Restarts a specific bot (e.g. /restart hinata)
// ═══════════════════════════════════════════════════════════════

'use strict';

const path = require('path');
const Perms = require('../../utils/permissions');
const PersonalityManager = require('../../bots/PersonalityManager');
const MultiSocketManager = require('../../bots/MultiSocketManager');

module.exports = {
  name: 'restart',
  aliases: ['reboot', 'botrestart'],
  description: '🔄 Restart all linked bots or a specific bot (Mod/Owner)',
  usage: '/restart [bot_name]',
  category: 'system',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot mods and owners can use /restart.'
      }, { quoted: msg });
    }

    const targetArg = args[0]?.trim();

    // ── 1. Restart Specific Bot ──────────────────────────────────────────────
    if (targetArg) {
      const pKey = PersonalityManager.resolvePersonality(targetArg);
      if (!pKey) {
        const allBots = PersonalityManager.getAllPersonalities().join(', ');
        return sock.sendMessage(chatId, {
          text: `❌ Unknown bot personality: *${targetArg}*\n\nAvailable bots: ${allBots}`
        }, { quoted: msg });
      }

      const displayName = PersonalityManager.getDisplayName(pKey);

      await sock.sendMessage(chatId, {
        text: `🔄 *Restarting 1 bot:* ${displayName} (\`${pKey}\`)…`
      }, { quoted: msg });

      const completionText = `✨ *Successfully restarted ${displayName}!* 🤖⚡`;

      try {
        const existingSock = MultiSocketManager.getSocket(pKey);
        if (existingSock) {
          try { existingSock.end(undefined); } catch (e) {}
        }

        const AUTH_DIR = process.env.AUTH_DIR || path.join(process.cwd(), 'auth');
        const rpgCommandHandler = require('../../handlers/rpgCommandHandler');

        await MultiSocketManager.connectBot(pKey, AUTH_DIR, getDatabase, saveDatabase, {
          rpgCommandHandler
        });

        // Send completion message via active socket
        const newSock = MultiSocketManager.getSocket(pKey) || sock;
        return await newSock.sendMessage(chatId, { text: completionText }, { quoted: msg });
      } catch (err) {
        console.error(`❌ Error restarting bot ${pKey}:`, err.message);
        return sock.sendMessage(chatId, {
          text: `❌ Failed to restart bot *${displayName}*: ${err.message}`
        }, { quoted: msg });
      }
    }

    // ── 2. Restart ALL Linked Bots ──────────────────────────────────────────
    const allSockets = MultiSocketManager.getAllSockets();
    const activeKeys = Object.keys(allSockets);
    const count = activeKeys.length || 1;

    const completionText = `✨ *Successfully restarted ${count} bot(s)!* 🚀⚡\n\nAll ${count} linked bot sockets are back online and ready.`;

    // Save pending notice to DB in case PM2 process restart interrupts socket
    db.pendingRestartNotice = { chatId, text: completionText };
    saveDatabase();

    await sock.sendMessage(chatId, {
      text: `🔄 *Restarting ${count} bot(s)…*\n\nRe-establishing connections for all linked bot personalities.`
    }, { quoted: msg });

    try {
      const AUTH_DIR = process.env.AUTH_DIR || path.join(process.cwd(), 'auth');
      const rpgCommandHandler = require('../../handlers/rpgCommandHandler');

      for (const key of activeKeys) {
        const s = allSockets[key];
        if (s) {
          try { s.end(undefined); } catch (e) {}
        }
        await MultiSocketManager.connectBot(key, AUTH_DIR, getDatabase, saveDatabase, {
          rpgCommandHandler
        });
        await new Promise(r => setTimeout(r, 600));
      }

      // Deliver completion message directly
      const activeSock = MultiSocketManager.getAnySocket() || sock;
      await activeSock.sendMessage(chatId, { text: completionText }, { quoted: msg });

      delete db.pendingRestartNotice;
      saveDatabase();

      // Check if running under PM2 for process-level restart fallback
      if (process.env.pm_id !== undefined || process.env.PM2_HOME) {
        try {
          const pm2 = require('pm2');
          pm2.connect((err) => {
            if (!err) {
              pm2.restart('all', () => {
                pm2.disconnect();
              });
            }
          });
        } catch (e) {}
      }

      return;

    } catch (err) {
      console.error('❌ Error restarting all bots:', err.message);
      return sock.sendMessage(chatId, {
        text: `❌ Failed to restart all bots: ${err.message}`
      }, { quoted: msg });
    }
  }
};
