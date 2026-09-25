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
  // Push #88g: the docker image has no .git — the deploy writes VERSION ("<sha> (<msg>)").
  try { const v = require('fs').readFileSync(require('path').join(process.cwd(), 'VERSION'), 'utf8').trim(); const m = v.match(/^([0-9a-f]{7,40})/i); if (m) return m[1].slice(0, 7); if (v) return v.slice(0, 24); } catch (e) {}
  try { const pv = require('../../package.json').version; if (pv) { try { require('child_process').execSync('git rev-parse --short HEAD', { timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return `v${pv}`; } } } catch (e) {}
  try {
    const out = require('child_process').execSync('git rev-parse --short HEAD', { timeout: 5000 }).toString().trim();
    if (out) return out;
  } catch (e) {}
  return 'unknown';
}

let _restarting = false; // cross-invocation lock: no stacked /restarts

// Push #55: which personalities SHOULD be connected. /restart used to iterate
// `getAllSockets()` — but a bot whose socket had already been dropped from the
// registry was therefore never reconnected ("restarted 1 bot(s)" while nothing
// was actually online, and a bot that died mid-ban could never be brought back
// by /restart). The desired set now comes from the persisted link records and
// the auth folders on disk.
function linkableKeys(db) {
  const out = new Set();
  try {
    for (const k of Object.keys(MultiSocketManager.getAllSockets() || {})) out.add(k);
  } catch (e) {}
  try {
    for (const k of (PersonalityManager.getAllPersonalities() || [])) {
      if (db?.linkedBots?.[k]) out.add(k);
    }
  } catch (e) {}
  try {
    const AUTH_DIR = process.env.AUTH_DIR || path.join(process.cwd(), 'auth');
    for (const f of require('fs').readdirSync(AUTH_DIR)) {
      const k = f.replace(/\/.*/, '');
      if (!k || k === 'auth-backups') continue;
      try {
        if (require('fs').existsSync(path.join(AUTH_DIR, k, 'creds.json'))) out.add(k);
      } catch (e) {}
    }
  } catch (e) {}
  return [...out].sort();
}

// One glanceable line per bot, so a mod can see WHY the group went quiet.
function healthFooter() {
  try {
    const rep = MultiSocketManager.botHealthReport?.() || [];
    if (!rep.length) return '';
    return `\n\n📶 *BOT HEALTH*\n` + rep.map(r => {
      // Push #86: "hearing" = fresh inbound in the last 4 min. A bot that is
      // connected but deaf is the silent-bot bug — say so instead of ✅.
      const deaf = r.online && r.usable && r.lastInboundAgoSec != null && r.lastInboundAgoSec > 240;
      const icon = !r.online ? '🔴' : !r.usable ? '⚠️' : deaf ? '🙉' : '✅';
      const state = !r.online ? 'offline' : !r.usable ? 'connected but not sending' : deaf ? `deaf — last heard ${Math.round(r.lastInboundAgoSec / 60)} min ago (auto-recycling)` : r.lastInboundAgoSec == null ? 'connected, nothing heard yet' : `replying (heard ${r.lastInboundAgoSec}s ago)`;
      return `  ${icon} *${r.key}* — ${state}${r.sendFails ? ` (${r.sendFails} send fail${r.sendFails > 1 ? 's' : ''}${r.lastErr ? `: ${r.lastErr}` : ''})` : ''}`;
    }).join('\n');
  } catch (e) { return ''; }
}

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

    // Push #74: `/restart hard` — full process restart (Docker/PM2 bring it
    // back). Use when the sockets are alive but everything is sluggish:
    // clears every in-memory queue, timer and half-dead websocket at once.
    if (targetArg === 'hard' || targetArg === 'process') {
      db.pendingRestartNotice = { chatId, text: `✨ *Process restarted!* 🚀 Build \`${buildSha()}\` — fresh memory, fresh sockets.` };
      saveDatabase();
      await sendAck(chatId, `♻️ *Hard restart* — the whole process is going down and coming back (≈20–60s). Messages sent while it's down are ignored, not replayed.`, msg, sock);
      setTimeout(() => { try { process.exit(0); } catch (e) {} }, 1500);
      return;
    }
    // Every /restart: drop the pre-restart backlog + reset takeover/health state.
    try { MultiSocketManager.markRestart?.(); } catch (e) {}

    // Push #55: `/restart health` — diagnosis without reconnecting anything.
    if (targetArg === 'health' || targetArg === 'status') {
      const rep = MultiSocketManager.botHealthReport?.() || [];
      const lines = Object.keys(db.registeredGCs || {}).length;
      const stuck = rep.filter(r => r.online && !r.usable);
      return sock.sendMessage(chatId, {
        text: [
          `📶 *BOT HEALTH* — ${rep.filter(r => r.usable).length}/${rep.length} replying`,
          ``,
          ...(rep.length ? rep.map(r =>
            `${r.usable ? '✅' : r.online ? '⚠️' : '🔴'} *${r.key}* · ws ${r.wsOpen ? 'open' : 'closed'} · ${r.sendFails} failed send${r.sendFails === 1 ? '' : 's'}` +
            (r.lastErr ? `\n   ↳ ${r.lastErr}` : '') +
            (r.lastOkAt ? `\n   last good send ${Math.round((Date.now() - r.lastOkAt) / 1000)}s ago` : '\n   no successful send since boot')
          ) : ['No sockets registered.']),
          ``,
          `*${lines}* group(s) with the bot registered.`,
          stuck.length ? `⚠️ *${stuck.map(s => s.key).join(', ')}* ${stuck.length > 1 ? 'are' : 'is'} connected but NOT answering — groups have been handed to a working bot automatically; run */restart* to repair them.` : '✅ Every registered bot is answering.',
        ].join('\n'),
      }, { quoted: msg });
    }

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

      // Push #55: a bot that accumulated send failures is treated as mute for
      // routing; a restart must clear that verdict or it stays benched.
      try { MultiSocketManager.clearSendHealth?.(pKey); } catch (e) {}
      await sendAck(chatId, `🔄 *Restarting 1 bot:* ${displayName} (\`${pKey}\`)…`, msg, sock);

      const completionText = `✨ *Successfully restarted ${displayName}!* 🤖⚡\n\n🔖 Build: \`${sha}\`${healthFooter()}`;

      // Persisted BEFORE the restart: if anything dies mid-flight, the
      // connection-verified handler delivers this notice on next boot.
      db.pendingRestartNotice = { chatId, text: completionText };
      saveDatabase();

      try {
        const existingSock = MultiSocketManager.getSocket(pKey);
        if (existingSock) {
          // Push #88g: full teardown — listeners off, ws closed — and a short
          // beat so the old socket can't still be flushing while the new one
          // distributes fresh sender keys (that overlap painted blank bubbles).
          try { existingSock.ev.removeAllListeners(); } catch (e) {}
          try { existingSock.end(undefined); } catch (e) {}
          try { existingSock.ws?.close?.(); } catch (e) {}
          await new Promise(r => setTimeout(r, 1500));
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
    // Push #55: reconnect every bot that SHOULD be linked, not just the ones
    // that still have a live socket — that is what makes /restart able to
    // recover a bot that dropped (or was dropped by a ban).
    const activeKeys = linkableKeys(db);
    const count = activeKeys.length;
    if (!count) {
      return sock.sendMessage(chatId, {
        text: `🔴 *No linked bots found.*\n\nNothing to restart — no auth session exists on this server, so the bots must be paired again from the AstraLink page (QR or pairing code).\n\nIf they were linked before, the auth folder moved: check \`AUTH_DIR\` (currently \`${process.env.AUTH_DIR || path.join(process.cwd(), 'auth')}\`).`,
      }, { quoted: msg });
    }
    try { MultiSocketManager.clearSendHealth?.(); } catch (e) {}

    const shaAll = buildSha();
    const completionText = `✨ *Successfully restarted ${count} bot(s)!* 🚀⚡\n\nAll ${count} linked bot sockets are back online and ready.\n🔖 Build: \`${shaAll}\`${healthFooter()}`;

    // Save pending notice to DB in case PM2 process restart interrupts socket
    db.pendingRestartNotice = { chatId, text: completionText };
    saveDatabase();

    await sendAck(chatId, `🔄 *Restarting ${count} bot(s)…*\n\nRe-establishing connections for all linked bot personalities.`, msg, sock);

    try {
      const AUTH_DIR = process.env.AUTH_DIR || path.join(process.cwd(), 'auth');
      const rpgCommandHandler = require('../../handlers/rpgCommandHandler');

      const _reLinked = [];
      for (const key of activeKeys) {
        const s = allSockets[key];
        if (s) {
          try { s.end(undefined); } catch (e) {}
        } else {
          _reLinked.push(key); // had no socket at all — this is a rescue, not a refresh
        }
        try {
          await MultiSocketManager.connectBot(key, AUTH_DIR, getDatabase, saveDatabase, {
            rpgCommandHandler
          });
        } catch (e) {
          console.error(`[restart] connectBot(${key}) failed:`, e.message);
        }
        // Push #55: stagger in parallel-ish bursts instead of one blocking
        // 600ms sleep per bot — 5 bots used to burn 3s of dead air before the
        // first reconnect even started.
        await new Promise(r => setTimeout(r, 200));
      }
      if (_reLinked.length) console.log(`[restart] re-established missing sockets for: ${_reLinked.join(', ')}`);

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
