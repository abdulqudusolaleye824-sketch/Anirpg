// ═══════════════════════════════════════════════════════════════
// AniRPG — QuickDB update tracking (Push #65)
//
// quick.db (a tiny key/value store on better-sqlite3) tracks the bot's
// VERSION and update state, the way the reference stack does:
//   • push number of the running code
//   • last boot time + boot count
//   • the previous push (so a deploy is visible in the boot log)
//
// Separate file (updates.sqlite) from the game DB, so a bloated or
// damaged game store can never touch update state — and vice versa.
// Degrades to a no-op if quick.db fails to load (storage upgrade must
// never take the bot down).
'use strict';

const path = require('path');

// Bump this with every push that changes behavior. The boot log reports
// "updated N → M" when the stored value differs from the running code.
const BOT_VERSION = 65;

let _db = null;

/** Open the QuickDB file under <dataDir>/database/. Never throws. */
function init(dataDir) {
  if (_db) return _db;
  try {
    const { QuickDB } = require('quick.db');
    const dir = path.join(dataDir, 'database');
    require('fs').mkdirSync(dir, { recursive: true });
    _db = new QuickDB({ filePath: path.join(dir, 'updates.sqlite') });
    return _db;
  } catch (e) {
    console.error(`⚠️ QuickDB update tracking unavailable (${e.message}) — continuing without it.`);
    _db = null;
    return null;
  }
}

/** Record a boot; returns the update info that was written. */
async function recordBoot() {
  if (!_db) return null;
  try {
    const prev = (await _db.get('state')) || {};
    const next = {
      push: BOT_VERSION,
      prevPush: prev.push === undefined ? null : prev.push,
      lastBoot: Date.now(),
      boots: (prev.boots || 0) + 1,
    };
    await _db.set('state', next);
    if (next.prevPush !== null && next.prevPush !== BOT_VERSION) {
      console.log(`📦 Bot updated: push #${next.prevPush} → #${BOT_VERSION} (boot #${next.boots})`);
    } else {
      console.log(`📦 Bot push #${BOT_VERSION} (boot #${next.boots})`);
    }
    return next;
  } catch (e) {
    console.error('⚠️ QuickDB recordBoot failed:', e.message);
    return null;
  }
}

/** Current update state (for /api/db-health). */
async function getUpdateInfo() {
  if (!_db) return { available: false };
  try {
    return { available: true, running: BOT_VERSION, ...(await _db.get('state')) || {} };
  } catch (e) {
    return { available: true, running: BOT_VERSION, error: e.message };
  }
}

/** Close the handle (process shutdown). */
async function close() {
  try { if (_db && _db.close) await _db.close(); } catch {}
  _db = null;
}

module.exports = { init, recordBoot, getUpdateInfo, close, BOT_VERSION };
