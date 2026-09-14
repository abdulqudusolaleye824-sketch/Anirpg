/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — /dbstatus                         ║
 * ║  Owner-only database mirror health (Push #31)        ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Shows live memory counts + the on-disk JSON mirror state so a wipe can
 * be diagnosed from chat. The Mongo side is visible at /api/db-health.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'dbstatus',
  aliases: ['dbhealth', 'dbinfo'],
  description: '🛡️ Database mirror health (owner only)',
  category: 'admin',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ *Owner only.*' }, { quoted: msg });
    }

    const users   = Object.keys(db.users || {}).length;
    const mods    = (db.botMods || []).length;
    const keys    = Object.keys(db.gateKeys || {}).length;
    const agates  = Object.keys(db.activeGates || {}).length;
    const regGCs  = Object.keys(db.registeredGCs || {}).length;
    const savedAt = db.__savedAt ? new Date(db.__savedAt).toISOString().replace('T', ' ').slice(0, 19) : 'never';

    // JSON mirror — same resolution as index.js (DATA_DIR, else repo root).
    const roots = [];
    if (process.env.DATA_DIR) roots.push(process.env.DATA_DIR);
    roots.push(path.join(__dirname, '..', '..'));
    const seen = new Set();
    const mirrorLines = [];
    for (const r of roots) {
      const p = path.join(r, 'database', 'database.json');
      if (seen.has(p)) continue;
      seen.add(p);
      try {
        if (!fs.existsSync(p)) { mirrorLines.push(`  📄 ${p}\n     ❌ missing`); continue; }
        const st = fs.statSync(p);
        let ju = '?';
        try { ju = Object.keys(JSON.parse(fs.readFileSync(p, 'utf-8')).users || {}).length; } catch (_) {}
        mirrorLines.push(`  📄 ${p}\n     ✅ ${(st.size / 1024).toFixed(1)}KB · 👥 ${ju} users · ${st.mtime.toISOString().replace('T', ' ').slice(0, 19)}`);
      } catch (e) { mirrorLines.push(`  📄 ${p}\n     ❌ ${e.message}`); }
    }

    const memDot = users > 0 ? '✅' : '🔥';
    return sock.sendMessage(chatId, {
      text: [
        `🛡️ *DATABASE HEALTH*`,
        `━━━━━━━━━━━━━━━━━━━`,
        `${memDot} *MEMORY:* 👥 ${users} players · ⭐ ${mods} mods · 🔑 ${keys} keys`,
        `   🌀 ${agates} active gates · 🏠 ${regGCs} registered GCs`,
        `   💾 last save: ${savedAt}`,
        `   ⏱️ uptime: ${Math.floor(process.uptime() / 60)}m`,
        ``,
        `💽 *JSON MIRROR:*`,
        ...mirrorLines,
        ``,
        `☁️ Mongo side: /api/db-health`,
      ].join('\n'),
    }, { quoted: msg });
  },
};
