// ═══════════════════════════════════════════════════════════════
// AniRPG — SQLite live store (Push #65)
//
// The game database's LIVE copy is now a SQLite file
// (<DATA_DIR>/database/database.sqlite): one row per top-level
// collection, written atomically in a single transaction.
// The in-memory `database` object is still the source of truth for
// all 381 call sites — this module only persists it, behind the
// existing getDatabase()/saveDatabase() interface.
//
// database.json is now a BACKUP mirror (still written, still
// snapshot-able); MongoDB Atlas is the off-host mirror. If the
// native better-sqlite3 module ever fails to load (weird platform,
// broken install), this degrades to a no-op with a loud warning and
// the JSON mirror remains the live copy — the bot never dies for a
// storage upgrade.
'use strict';

const fs = require('fs');
const path = require('path');

let _db = null;        // open better-sqlite3 handle
let _dbFile = null;    // absolute path
let _available = false;
let _failLogged = false;

/**
 * Open (or create) the SQLite file under <dataDir>/database/.
 * Safe to call once at boot; never throws.
 */
function init(dataDir) {
  if (_db) return _dbFile;
  try {
    const Database = require('better-sqlite3');
    const dir = path.join(dataDir, 'database');
    fs.mkdirSync(dir, { recursive: true });
    _dbFile = path.join(dir, 'database.sqlite');
    _db = new Database(_dbFile);
    _db.pragma('journal_mode = WAL');
    _db.pragma('synchronous = NORMAL');
    _db.exec(`
      CREATE TABLE IF NOT EXISTS collections (
        name       TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    _available = true;
    return _dbFile;
  } catch (e) {
    _available = false;
    _db = null;
    if (!_failLogged) {
      _failLogged = true;
      console.error(`🚨 SQLite live store UNAVAILABLE (${e.message}) — falling back to the JSON mirror as the live copy. Run \`npm rebuild better-sqlite3\` on this machine to re-enable it.`);
    }
    return null;
  }
}

/** True when the SQLite engine is live (better-sqlite3 loaded + file open). */
function isAvailable() { return _available && !!_db; }

/**
 * Load the whole database object from SQLite.
 * Returns null when the file is missing or holds no rows (caller then
 * falls back to JSON/Mongo/fresh, exactly as before this push).
 */
function load() {
  if (!isAvailable()) return null;
  try {
    const rows = _db.prepare('SELECT name, data FROM collections').all();
    if (!rows.length) return null;
    const out = {};
    for (const r of rows) {
      try { out[r.name] = JSON.parse(r.data); }
      catch (e) { console.error(`⚠️ SQLite: corrupt row "${r.name}" skipped (${e.message}) — the rest of the DB is intact`); }
    }
    return Object.keys(out).length ? out : null;
  } catch (e) {
    console.error('❌ SQLite load failed:', e.message);
    return null;
  }
}

/**
 * Persist the whole in-memory object atomically (one transaction).
 * Top-level keys are stored as rows, so a partially-corrupted file can
 * never wipe the whole database. Returns true on success.
 */
function save(obj) {
  if (!isAvailable() || !obj || typeof obj !== 'object') return false;
  try {
    const names = Object.keys(obj);
    const now = Date.now();
    const upsert = _db.prepare('INSERT OR REPLACE INTO collections (name, data, updated_at) VALUES (?, ?, ?)');
    const del = _db.prepare('DELETE FROM collections WHERE name = ?');
    const setMeta = _db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
    const tx = _db.transaction(() => {
      for (const n of names) {
        const v = obj[n];
        if (v === undefined) continue; // JSON.stringify(undefined) is not a string
        upsert.run(n, JSON.stringify(v), now);
      }
      const inMem = new Set(names);
      for (const r of _db.prepare('SELECT name FROM collections').all()) {
        if (!inMem.has(r.name)) del.run(r.name);
      }
      setMeta.run('last_saved_at', String(now));
    });
    tx();
    return true;
  } catch (e) {
    console.error('❌ SQLite save failed:', e.message);
    return false;
  }
}

/** Diagnostics for /api/db-health. */
function info() {
  if (!isAvailable()) return { available: false };
  try {
    let lastSavedAt = null;
    try {
      const m = _db.prepare("SELECT value FROM meta WHERE key = 'last_saved_at'").get();
      if (m) lastSavedAt = Number(m.value) || null;
    } catch {}
    let rows = 0;
    try { rows = _db.prepare('SELECT COUNT(*) AS n FROM collections').get().n; } catch {}
    let bytes = 0;
    try { bytes = fs.statSync(_dbFile).size; } catch {}
    return {
      available: true,
      file: _dbFile,
      bytes,
      rows,
      lastSavedAt,
      ageSec: lastSavedAt ? Math.round((Date.now() - lastSavedAt) / 1000) : null,
    };
  } catch (e) {
    return { available: true, error: e.message };
  }
}

/** Release the handle (process shutdown). */
function close() {
  try { if (_db) _db.close(); } catch {}
  _db = null;
  _available = false;
}

module.exports = { init, load, save, info, close, isAvailable };
