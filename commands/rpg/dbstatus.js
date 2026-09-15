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

    // Push #32: snapshot ladder + owner backup state.
    let snapCount = '?', snapNew = '';
    const lastOwner = db.__lastOwnerSnapAt ? new Date(db.__lastOwnerSnapAt).toISOString().replace('T', ' ').slice(0, 19) : 'never';
    try {
      const sroots = [];
      if (process.env.DATA_DIR) sroots.push(path.join(process.env.DATA_DIR, 'database', 'snapshots'));
      sroots.push(path.join(__dirname, '..', '..', 'database', 'snapshots'));
      for (const sd of sroots) {
        if (fs.existsSync(sd)) {
          const fl = fs.readdirSync(sd).filter(f => f.endsWith('.json')).sort();
          if (fl.length) { snapCount = fl.length; snapNew = fl[fl.length - 1]; break; }
        }
      }
    } catch {}
    // Push #33: diverged snapshot = a Mongo write was refused.
    let diverged = false;
    try {
      const sroots2 = [];
      if (process.env.DATA_DIR) sroots2.push(path.join(process.env.DATA_DIR, 'database', 'snapshots'));
      sroots2.push(path.join(__dirname, '..', '..', 'database', 'snapshots'));
      for (const sd of sroots2) {
        if (fs.existsSync(sd) && fs.readdirSync(sd).some(f => f.startsWith('diverged-'))) { diverged = true; break; }
      }
    } catch {}
    const memDot = users > 0 ? '✅' : '🔥';
    // Push #47: why-is-it-slow visibility + the avatar-blob audit (base64 images
    // stored inside the game document were the single biggest serialize cost).
    let perfSection = '';
    try {
      const PerfMonitor = require('../../rpg/utils/PerfMonitor');
      const BlobStore = require('../../rpg/utils/BlobStore');
      const inlineBytes = BlobStore.inlineBlobBytes(db);
      const withImg = Object.values(db.users || {}).filter(u => u && (u.profileImage || u.profileImageRef)).length;
      perfSection = `\n${PerfMonitor.format()}\n` +
        `  🖼️ avatars: *${withImg}* referenced · inline bytes: *${(inlineBytes / 1024).toFixed(0)}KB*` +
        (inlineBytes > 256 * 1024
          ? `\n  ⚠️ *${(inlineBytes / 1048576).toFixed(1)}MB of base64 still inside the document.* These migrate to disk on the next /profile of each player, or move them now: see rpg/utils/BlobStore.`
          : `\n  ✅ no large inline blobs in the document`);
    } catch (e) { perfSection = `\n⚠️ perf readout unavailable: ${e.message}`; }

    return sock.sendMessage(chatId, {
      text: [
        `🛡️ *DATABASE HEALTH*`,
        `━━━━━━━━━━━━━━━━━━━`,
        `${memDot} *MEMORY:* 👥 ${users} players · ⭐ ${mods} mods · 🔑 ${keys} keys`,
        `   🌀 ${agates} active gates · 🏠 ${regGCs} registered GCs`,
        `   💾 last save: ${savedAt}`,
        `   📸 snapshots: ${snapCount}${snapNew ? ` (newest ${snapNew})` : ''}`,
        `   📩 owner backup: ${lastOwner}`,
        ...(diverged ? ['   ⚠️ DIVERGED: a Mongo write was refused — investigate, then /dbforce confirm'] : []),
        `   ⏱️ uptime: ${Math.floor(process.uptime() / 60)}m`,
        ``,
        `💽 *JSON MIRROR:*`,
        ...mirrorLines,
        ``,
        ...perfSection.split('\n').filter(l => String(l).trim()),
        ``,
        `☁️ Mongo side: /api/db-health`,
      ].join('\n'),
    }, { quoted: msg });
  },
};
