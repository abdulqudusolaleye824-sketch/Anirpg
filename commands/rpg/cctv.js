/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — CCTV Mode                         ║
 * ║  Per-group activity tracking & command stats         ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * /cctv on|off      — toggle logging for this GC (owner/coowner)
 * /cctv log         — show last 20 activity entries
 * /cctv stats       — command usage breakdown
 * /cctv clear       — wipe log for this GC
 */

'use strict';

// ── helpers ───────────────────────────────────────────────────────────────────
function isPrivileged(sender, db) {
  const Perms = require('../../utils/permissions');
  return Perms.isBotMod(db, sender);
}

function ts(ms) {
  return new Date(ms).toLocaleString('en-GB', { hour12: false });
}

// ── Record an event (called from index.js on every message) ──────────────────
function record(db, chatId, sender, text, saveDatabase) {
  if (!db.cctv) db.cctv = {};
  if (!db.cctv[chatId]) return; // not enabled for this GC
  if (!db.cctv[chatId].enabled) return;

  const entry = {
    t:      Date.now(),
    sender: sender.split('@')[0],
    text:   text.slice(0, 120), // cap length
  };

  if (!db.cctv[chatId].log) db.cctv[chatId].log = [];
  db.cctv[chatId].log.push(entry);

  // Keep only last 200 entries per group
  if (db.cctv[chatId].log.length > 200) {
    db.cctv[chatId].log = db.cctv[chatId].log.slice(-200);
  }

  // Track command stats
  if (text.startsWith('/')) {
    const cmd = text.split(' ')[0].slice(1).toLowerCase();
    if (!db.cctv[chatId].cmdStats) db.cctv[chatId].cmdStats = {};
    db.cctv[chatId].cmdStats[cmd] = (db.cctv[chatId].cmdStats[cmd] || 0) + 1;
  }

  // Track per-user message count
  if (!db.cctv[chatId].userActivity) db.cctv[chatId].userActivity = {};
  const uid = sender.split('@')[0];
  if (!db.cctv[chatId].userActivity[uid]) {
    db.cctv[chatId].userActivity[uid] = { messages: 0, commands: 0, lastSeen: 0 };
  }
  db.cctv[chatId].userActivity[uid].messages++;
  if (text.startsWith('/')) db.cctv[chatId].userActivity[uid].commands++;
  db.cctv[chatId].userActivity[uid].lastSeen = Date.now();
}

// ── Command module ────────────────────────────────────────────────────────────
module.exports = {
  name:        'cctv',
  description: 'Group activity tracker (owner/co-owner only)',
  usage:       '/cctv on|off|log|stats|clear|top',
  category:    'admin',

  record, // exported so index.js can call it

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db     = getDatabase();
    const sub    = (args[0] || '').toLowerCase();

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ CCTV only works in group chats.' }, { quoted: msg });
    }

    // Read-only subs anyone can use in a cctv-enabled group
    const readOnly = ['log', 'stats', 'top'];
    if (!readOnly.includes(sub) && !isPrivileged(sender, db)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the owner or co-owner can configure CCTV mode.',
      }, { quoted: msg });
    }

    if (!db.cctv) db.cctv = {};
    if (!db.cctv[chatId]) db.cctv[chatId] = { enabled: false, log: [], cmdStats: {}, userActivity: {} };

    // ── /cctv on ──────────────────────────────────────────────────
    if (sub === 'on') {
      db.cctv[chatId].enabled = true;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: [
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '📹 *CCTV MODE — ENABLED*',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          'All group activity is now being logged.',
          '👁️ /cctv log   — view recent activity',
          '📊 /cctv stats — command usage',
          '🏆 /cctv top   — most active members',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── /cctv off ─────────────────────────────────────────────────
    if (sub === 'off') {
      db.cctv[chatId].enabled = false;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: '📹 *CCTV MODE — DISABLED*\nActivity logging stopped for this group.',
      }, { quoted: msg });
    }

    // ── /cctv clear ───────────────────────────────────────────────
    if (sub === 'clear') {
      db.cctv[chatId].log          = [];
      db.cctv[chatId].cmdStats     = {};
      db.cctv[chatId].userActivity = {};
      saveDatabase();
      return sock.sendMessage(chatId, { text: '🗑️ CCTV log cleared.' }, { quoted: msg });
    }

    // ── /cctv log ─────────────────────────────────────────────────
    if (sub === 'log') {
      if (!db.cctv[chatId].enabled) {
        return sock.sendMessage(chatId, { text: '📹 CCTV is not enabled in this group.\nUse /cctv on to enable.' }, { quoted: msg });
      }
      const log = (db.cctv[chatId].log || []).slice(-20).reverse();
      if (!log.length) {
        return sock.sendMessage(chatId, { text: '📹 No activity logged yet.' }, { quoted: msg });
      }
      const lines = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '📹 *CCTV — RECENT ACTIVITY*',
        `📊 Showing last ${log.length} entries`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        ...log.map(e => `🕒 ${ts(e.t)}\n👤 @${e.sender}: ${e.text}`),
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ];
      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    // ── /cctv stats ───────────────────────────────────────────────
    if (sub === 'stats') {
      if (!db.cctv[chatId].enabled) {
        return sock.sendMessage(chatId, { text: '📹 CCTV is not enabled in this group.\nUse /cctv on to enable.' }, { quoted: msg });
      }
      const cmdStats = db.cctv[chatId].cmdStats || {};
      const sorted = Object.entries(cmdStats).sort((a, b) => b[1] - a[1]).slice(0, 15);
      const totalCmds = Object.values(cmdStats).reduce((s, v) => s + v, 0);

      if (!sorted.length) {
        return sock.sendMessage(chatId, { text: '📊 No command usage recorded yet.' }, { quoted: msg });
      }

      const lines = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '📊 *CCTV — COMMAND STATS*',
        `🔢 Total commands used: ${totalCmds}`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        ...sorted.map(([cmd, count], i) => {
          const bar = '█'.repeat(Math.min(10, Math.round(count / Math.max(...sorted.map(s => s[1])) * 10)));
          return `${i + 1}. /${cmd} — ${count}x\n   ${bar}`;
        }),
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ];
      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    // ── /cctv top ─────────────────────────────────────────────────
    if (sub === 'top') {
      if (!db.cctv[chatId].enabled) {
        return sock.sendMessage(chatId, { text: '📹 CCTV is not enabled in this group.\nUse /cctv on to enable.' }, { quoted: msg });
      }
      const ua = db.cctv[chatId].userActivity || {};
      const sorted = Object.entries(ua).sort((a, b) => b[1].messages - a[1].messages).slice(0, 10);

      if (!sorted.length) {
        return sock.sendMessage(chatId, { text: '🏆 No activity data yet.' }, { quoted: msg });
      }

      const medals = ['🥇', '🥈', '🥉'];
      const lines = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '🏆 *CCTV — MOST ACTIVE MEMBERS*',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        ...sorted.map(([uid, data], i) => {
          const medal = medals[i] || `${i + 1}.`;
          const lastSeen = data.lastSeen ? ts(data.lastSeen) : 'never';
          return `${medal} @${uid}\n   💬 ${data.messages} msgs  ⚡ ${data.commands} cmds\n   🕒 Last seen: ${lastSeen}`;
        }),
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ];
      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    // ── default: show status ──────────────────────────────────────
    const state = db.cctv[chatId]?.enabled ? '🟢 ON' : '🔴 OFF';
    const count = (db.cctv[chatId]?.log || []).length;
    return sock.sendMessage(chatId, {
      text: [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '📹 *CCTV MODE*',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        `Status: ${state}`,
        `Logged entries: ${count}`,
        '',
        '📌 Subcommands:',
        '/cctv on       — enable logging',
        '/cctv off      — disable logging',
        '/cctv log      — view recent activity',
        '/cctv stats    — command usage breakdown',
        '/cctv top      — most active members',
        '/cctv clear    — wipe log (owner only)',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
    }, { quoted: msg });
  },
};
