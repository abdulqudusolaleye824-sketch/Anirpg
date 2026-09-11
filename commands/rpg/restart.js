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

// NOTE: /restart re-establishes WhatsApp connections with the SAME code.
// Code updates deploy via git push (Railway rebuilds) — /restart never
// pulls code. The completion message stamps the running build sha so you
// can always see exactly what is live.
function buildSha() {
  if (process.env.RAILWAY_GIT_COMMIT_SHA) return String(process.env.RAILWAY_GIT_COMMIT_SHA).slice(0, 7);
  try {
    const out = require('child_process').execSync('git rev-parse --short HEAD', { timeout: 5000 }).toString().trim();
    if (out) return out;
  } catch (e) {}
  return 'unknown';
}

let _restarting = false; // cross-invocation lock: no stacked /restarts

// Best-effort ack across sockets: the invoking socket may be half-dead, so
// on failure every other online socket is tried until one send lands.
async function sendAck(chatId, text, msg, preferredSock) {
  const tried = new Set();
  const candidates = [preferredSock];
  try {
    const all = MultiSocketManager.getAllSockets() || {};
    for (const k of Object.keys(all)) {
      if (all[k]?.user?.id) candidates.push(all[k]);
    }
  } catch (e) {}
  for (const s of candidates) {
    if (!s || tried.has(s)) continue;
    tried.add(s);
    try {
      await s.sendMessage(chatId, { text }, { quoted: msg });
      return true;
    } catch (e) {}
  }
  return false;
}

// Wait until at least one socket is verifiably online (user.id present).
// connectBot() returns BEFORE the websocket opens, so sending the completion
// message immediately after it fires into the void — this wait is what was
// missing (the "no restart completion message" bug).
async function waitForOnline(timeoutMs = 45000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const all = MultiSocketManager.getAllSockets() || {};
      const hit = Object.keys(all).find(k => all[k]?.user?.id);
      if (hit) return all[hit];
    } catch (e) {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return null;
}

async function sendCompletion(toSock, chatId, text, msg) {
  const candidates = [toSock, MultiSocketManager.getAnySocket()].filter(Boolean);
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const s of candidates) {
      try {
        await s.sendMessage(chatId, { text }, { quoted: msg });
        return true;
      } catch (e) { lastErr = e; }
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  if (lastErr) console.error('restart completion send failed:', lastErr.message);
  return false;
}

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

    if (_restarting) {
      return sock.sendMessage(chatId, {
        text: '⏳ A restart is already in progress — hold on, the completion message will land when the bots are back.'
      }, { quoted: msg });
    }
    _restarting = true;
    try {

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
      const sha = buildSha();

      await sendAck(chatId, `🔄 *Restarting 1 bot:* ${displayName} (\`${pKey}\`)…`, msg, sock);

      const completionText = `✨ *Successfully restarted ${displayName}!* 🤖⚡\n\n🔖 Build: \`${sha}\`\n📌 Code updates deploy via GitHub push — /restart refreshes connections only.`;

      // Persisted BEFORE the restart: if anything dies mid-flight, the
      // connection-verified handler delivers this notice on next boot.
      db.pendingRestartNotice = { chatId, text: completionText };
      saveDatabase();

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

        // Wait for a TRULY online socket, then confirm delivery before
        // clearing the persisted notice.
        const onlineSock = await waitForOnline(45000);
        const delivered = await sendCompletion(onlineSock || sock, chatId, completionText, msg);
        if (delivered) {
          delete db.pendingRestartNotice;
          saveDatabase();
        }
        return;
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

    const shaAll = buildSha();
    const completionText = `✨ *Successfully restarted ${count} bot(s)!* 🚀⚡\n\nAll ${count} linked bot sockets are back online and ready.\n🔖 Build: \`${shaAll}\`\n📌 Code updates deploy via GitHub push — /restart refreshes connections only.`;

    // Save pending notice to DB in case PM2 process restart interrupts socket
    db.pendingRestartNotice = { chatId, text: completionText };
    saveDatabase();

    await sendAck(chatId, `🔄 *Restarting ${count} bot(s)…*\n\nRe-establishing connections for all linked bot personalities.`, msg, sock);

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

      // Wait for a TRULY online socket, then deliver. The persisted notice
      // is cleared ONLY on confirmed delivery — otherwise the
      // connection-verified handler delivers it when a socket comes up.
      const onlineSock = await waitForOnline(60000);
      const delivered = await sendCompletion(onlineSock || sock, chatId, completionText, msg);
      if (delivered) {
        delete db.pendingRestartNotice;
        saveDatabase();
      }

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
    } finally {
      _restarting = false;
    }
  },

  _waitForOnline: waitForOnline,
  _buildSha: buildSha,
  _isRestarting: () => _restarting,
};
