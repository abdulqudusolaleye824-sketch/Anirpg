/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — CCTV Mode                           ║
 * ║  Per-group activity tracking & status reports        ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Tracks per-group:
 *  - Every command used (who, what, when)
 *  - Message activity counts per user
 *  - Most active users
 *  - Command frequency leaderboard
 *
 * Commands:
 *  /cctv on|off        — toggle tracking for this GC (owner/coowner)
 *  /cctv status        — full activity report for this GC
 *  /cctv logs [n]      — last N command logs (default 20)
 *  /cctv top           — most active users in this GC
 *  /cctv clear         — wipe this GC's logs (owner/coowner)
 *  /statusreport       — cross-group summary (owner/coowner only)
 */

'use strict';

const { OWNER_JID, COOWNER_JID, stripDevice } = require('../utils/constants');

// ── In-memory ring buffer ─────────────────────────────────────────────────────
// cctvLogs[chatId] = [ { sender, name, command, timestamp }, ... ]
const cctvLogs  = {};   // per-group command logs
const MAX_LOGS  = 200;  // max logs kept per group in memory
const MAX_GROUPS = 200; // max distinct groups tracked in memory (prevent leak)
const _cctvLastTouch = {}; // for periodic cleanup

// Periodic cleanup — drop logs for groups with no activity in 24h
setInterval(() => {
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  let pruned = 0;
  for (const chatId of Object.keys(cctvLogs)) {
    if (now - (_cctvLastTouch[chatId] || 0) > TWENTY_FOUR_HOURS) {
      delete cctvLogs[chatId];
      delete _cctvLastTouch[chatId];
      pruned++;
    }
  }
  if (pruned > 0) console.log(`🧹 Pruned CCTV logs for ${pruned} inactive groups`);
}, 60 * 60 * 1000); // check every hour

// ── Helpers ───────────────────────────────────────────────────────────────────
function normaliseJid(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function isPrivileged(sender, db) {
  // Use shared constants module so OWNER_JID/COOWNER_JID stay in sync
  // across the whole bot. db._config values are still honored as a
  // database-driven override (takes precedence over env/defaults).
  const ownerJid   = stripDevice(db._config?.ownerJid   || OWNER_JID);
  const coOwnerJid = stripDevice(db._config?.coOwnerJid || COOWNER_JID || '');
  const sNum = normaliseJid(sender);
  return normaliseJid(ownerJid) === sNum
      || normaliseJid(coOwnerJid) === sNum
      || (db.botMods || []).some(a => normaliseJid(a) === sNum);
}

function formatTime(ts) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function shortJid(jid) {
  return jid?.split('@')[0] || '?';
}

// ── Core tracking function — called by rpgCommandHandler ─────────────────────
/**
 * Record a command usage for a group's CCTV log.
 * Call this from rpgCommandHandler whenever a command fires.
 */
function recordCommand(chatId, sender, senderName, command, db) {
  if (!chatId?.endsWith('@g.us')) return; // groups only

  // Check if CCTV is on for this group
  if (!db.groupSettings?.[chatId]?.cctvEnabled) return;

  if (!cctvLogs[chatId]) cctvLogs[chatId] = [];

  cctvLogs[chatId].push({
    sender,
    name: senderName || shortJid(sender),
    command,
    timestamp: Date.now(),
  });
  _cctvLastTouch[chatId] = Date.now();

  // If we have too many distinct groups, drop the oldest-touched one
  if (Object.keys(cctvLogs).length > MAX_GROUPS) {
    let oldest = null, oldestTime = Infinity;
    for (const [gid, ts] of Object.entries(_cctvLastTouch)) {
      if (ts < oldestTime) { oldestTime = ts; oldest = gid; }
    }
    if (oldest) {
      delete cctvLogs[oldest];
      delete _cctvLastTouch[oldest];
    }
  }

  // Trim to max
  if (cctvLogs[chatId].length > MAX_LOGS) {
    cctvLogs[chatId] = cctvLogs[chatId].slice(-MAX_LOGS);
  }

  // Also persist to DB (lightweight — just counts)
  if (!db.cctv) db.cctv = {};
  if (!db.cctv[chatId]) db.cctv[chatId] = { commandCount: {}, userActivity: {} };

  const cctv = db.cctv[chatId];
  cctv.commandCount[command] = (cctv.commandCount[command] || 0) + 1;
  cctv.userActivity[sender]  = (cctv.userActivity[sender]  || 0) + 1;
  cctv.lastUpdated = Date.now();
}

// ── /cctv command ─────────────────────────────────────────────────────────────
const cctv = {
  name: 'cctv',
  description: 'Group activity tracking and logs',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db     = getDatabase();

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: '❌ CCTV only works in group chats.',
      }, { quoted: msg });
    }

    const sub = (args[0] || 'status').toLowerCase();

    // ── /cctv on ────────────────────────────────────────────────────────────
    if (sub === 'on') {
      if (!isPrivileged(sender, db)) {
        return sock.sendMessage(chatId, { text: '❌ Owner/co-owner only.' }, { quoted: msg });
      }
      if (!db.groupSettings)         db.groupSettings = {};
      if (!db.groupSettings[chatId]) db.groupSettings[chatId] = {};
      db.groupSettings[chatId].cctvEnabled = true;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: '📹 *CCTV MODE ON* — All commands in this group are now being logged.',
      }, { quoted: msg });
    }

    // ── /cctv off ───────────────────────────────────────────────────────────
    if (sub === 'off') {
      if (!isPrivileged(sender, db)) {
        return sock.sendMessage(chatId, { text: '❌ Owner/co-owner only.' }, { quoted: msg });
      }
      if (!db.groupSettings)         db.groupSettings = {};
      if (!db.groupSettings[chatId]) db.groupSettings[chatId] = {};
      db.groupSettings[chatId].cctvEnabled = false;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: '📴 *CCTV MODE OFF* — Logging stopped for this group.',
      }, { quoted: msg });
    }

    // ── /cctv logs [n] ──────────────────────────────────────────────────────
    if (sub === 'logs') {
      if (!isPrivileged(sender, db)) {
        return sock.sendMessage(chatId, { text: '❌ Owner/co-owner only.' }, { quoted: msg });
      }

      const n    = Math.min(parseInt(args[1]) || 20, 50);
      const logs = (cctvLogs[chatId] || []).slice(-n).reverse();

      if (logs.length === 0) {
        return sock.sendMessage(chatId, {
          text: '📋 No logs yet. Make sure CCTV is on (/cctv on).',
        }, { quoted: msg });
      }

      const lines = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📹 *CCTV LOGS* (last ${logs.length})`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        '',
        ...logs.map(l =>
          `🕒 ${formatTime(l.timestamp)}\n👤 ${l.name} (${shortJid(l.sender)})\n📌 /${l.command}`
        ),
        '',
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ];

      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    // ── /cctv top ───────────────────────────────────────────────────────────
    if (sub === 'top') {
      if (!isPrivileged(sender, db)) {
        return sock.sendMessage(chatId, { text: '❌ Owner/co-owner only.' }, { quoted: msg });
      }

      const cData = db.cctv?.[chatId];
      if (!cData?.userActivity || Object.keys(cData.userActivity).length === 0) {
        return sock.sendMessage(chatId, {
          text: '📊 No activity data yet.',
        }, { quoted: msg });
      }

      const top = Object.entries(cData.userActivity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

      const lines = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📊 *MOST ACTIVE USERS*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        '',
        ...top.map(([jid, count], i) => {
          const p = db.users?.[jid];
          const name = p?.name || shortJid(jid);
          return `${medals[i]} *${name}* — ${count} commands`;
        }),
        '',
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ];

      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    // ── /cctv clear ─────────────────────────────────────────────────────────
    if (sub === 'clear') {
      if (!isPrivileged(sender, db)) {
        return sock.sendMessage(chatId, { text: '❌ Owner/co-owner only.' }, { quoted: msg });
      }

      cctvLogs[chatId] = [];
      if (db.cctv?.[chatId]) delete db.cctv[chatId];
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: '🗑️ CCTV logs cleared for this group.',
      }, { quoted: msg });
    }

    // ── /cctv status (default) ───────────────────────────────────────────────
    const cData    = db.cctv?.[chatId] || {};
    const settings = db.groupSettings?.[chatId] || {};
    const isOn     = !!settings.cctvEnabled;
    const logs     = cctvLogs[chatId] || [];

    // Command frequency from DB
    const cmdFreq = Object.entries(cData.commandCount || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cmd, n]) => `   /${cmd}: ${n}×`)
      .join('\n') || '   None yet';

    const totalCmds = Object.values(cData.commandCount || {}).reduce((s, n) => s + n, 0);
    const totalUsers = Object.keys(cData.userActivity || {}).length;
    const lastLog = logs[logs.length - 1];

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📹 *CCTV STATUS*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `Status: ${isOn ? '🟢 ON' : '🔴 OFF'}`,
      `Total Commands Logged: ${totalCmds}`,
      `Unique Users Tracked: ${totalUsers}`,
      `Logs in Memory: ${logs.length}/${MAX_LOGS}`,
      lastLog ? `Last Activity: ${formatTime(lastLog.timestamp)}` : `Last Activity: —`,
      ``,
      `📊 Top Commands:`,
      cmdFreq,
      ``,
      `📌 /cctv logs — view recent logs`,
      `📌 /cctv top  — most active users`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  },
};

// ── /statusreport — cross-group summary (owner/coowner only) ─────────────────
const statusreport = {
  name: 'statusreport',
  aliases: ['sr'],
  description: 'Full bot status report across all groups (owner/coowner only)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!isPrivileged(sender, db)) {
      return sock.sendMessage(chatId, {
        text: '❌ Owner/co-owner only.',
      }, { quoted: msg });
    }

    const users  = Object.values(db.users || {});
    const groups = Object.keys(db.groupSettings || {});
    const now    = Date.now();

    // Active players (used a command in last 24h)
    const active24h = users.filter(u => u.lastActive && now - u.lastActive < 86400000).length;
    const active1h  = users.filter(u => u.lastActive && now - u.lastActive < 3600000).length;

    // Per-group activity
    const groupLines = groups.map(gid => {
      const settings = db.groupSettings[gid] || {};
      const cData    = db.cctv?.[gid] || {};
      const total    = Object.values(cData.commandCount || {}).reduce((s, n) => s + n, 0);
      const cctvOn   = settings.cctvEnabled ? '📹' : '  ';
      const shortId  = gid.split('@')[0].slice(-8);
      return `${cctvOn} ...${shortId} — ${total} cmds`;
    }).slice(0, 15); // cap at 15 groups

    // Bot sockets status
    let socketLines = '   Not loaded';
    try {
      const MSM = require('./MultiSocketManager');
      const sockets = MSM.getAllSockets();
      socketLines = Object.keys(sockets).length > 0
        ? Object.entries(sockets).map(([k]) => `   🟢 ${k}`).join('\n')
        : '   No secondary bots connected';
    } catch(e) {}

    const uptime = process.uptime();
    const uptimeStr = `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m`;

    const memMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📡 *✦ 𝐀𝐬𝐭𝐫𝐚™ STATUS REPORT*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `🕒 ${new Date().toLocaleString('en-GB')}`,
      `⏱️ Uptime: ${uptimeStr}`,
      `💾 Memory: ${memMB}MB`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👥 PLAYERS`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Total Registered: ${users.length}`,
      `Active (1h): ${active1h}`,
      `Active (24h): ${active24h}`,
      `Banned: ${Object.keys(db.bannedUsers || {}).length}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🌐 GROUPS (${groups.length})`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ...(groupLines.length ? groupLines : ['   No groups tracked']),
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🤖 BOT SOCKETS`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      socketLines,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  },
};

module.exports = { recordCommand, cctv, statusreport };
