// ═════════════════════════════════════════════════
// AniRPG — SQLite WhatsApp auth store (Push #99)
//
// Replaces Baileys' useMultiFileAuthState for every linked bot.
//
// WHY: production auth folders had grown to 20,000–38,000 files per bot
// (Hinata: 31,426 pre-key files). Every reconnect read them one by one,
// concurrent writes raced, and a half-written session file = "Bad MAC" on
// the next message from that contact → the bot looked deaf → got recycled →
// "bots going off and on". Two bots (kira, mikasa) also lost their login
// because creds.json was written non-atomically and a crash left a 0-byte
// file behind.
//
// WHAT: every Signal key lives in ONE SQLite file (<DATA_DIR>/database/auth.sqlite),
// written in transactions — never a partial write, never a 38k-file folder.
// creds are stored in SQLite AND mirrored atomically (tmp + rename) to
// <authDir>/<bot>/creds.json so every existing file-based helper (backup,
// restore, quarantine, "is this number registered?") keeps working, and the
// last 5 good creds are kept in a backup table so an empty/corrupt creds can
// never kill a bot again.
//
// First boot per bot imports the legacy folder (keeping only the newest
// 1,000 pre-keys), then moves the old key files to <DATA_DIR>/auth-legacy/<bot>/.
'use strict';

const fs = require('fs');
const path = require('path');

const PREKEY_KEEP = 1000;          // newest pre-keys kept (WhatsApp holds ~30 uploaded; 1000 is generous)
const PREKEY_PRUNE_AT = 2000;      // prune when a bot's pre-key rows exceed this
const CREDS_BACKUPS = 5;
const KNOWN_TYPES = [              // longest first — used to split legacy file names
  'app-state-sync-version', 'app-state-sync-key', 'sender-key-memory', 'sender-key',
  'pre-key', 'session', 'device-list', 'lid-mapping', 'tctoken', 'identity', 'lid',
];

let _db = null;
let _file = null;
let _deps = null;   // { BufferJSON, initAuthCreds, proto } — baileys, injected for tests

function _loadDeps() {
  if (_deps) return _deps;
  const b = require('@whiskeysockets/baileys');
  _deps = { BufferJSON: b.BufferJSON, initAuthCreds: b.initAuthCreds, proto: b.proto };
  return _deps;
}
/** Tests inject stand-ins so the module runs without baileys. */
function _setDeps(d) { _deps = d; }

function init(dataDir, opts = {}) {
  if (_db) return _file;
  const Database = opts.Database || require('better-sqlite3');
  const dir = path.join(dataDir, 'database');
  fs.mkdirSync(dir, { recursive: true });
  _file = opts.file || path.join(dir, 'auth.sqlite');
  _db = new Database(_file);
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('busy_timeout = 5000');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS auth_keys (
      bot TEXT NOT NULL, type TEXT NOT NULL, id TEXT NOT NULL,
      data TEXT NOT NULL, updated_at INTEGER NOT NULL,
      PRIMARY KEY (bot, type, id)
    );
    CREATE INDEX IF NOT EXISTS auth_keys_bot_type ON auth_keys (bot, type);
    CREATE TABLE IF NOT EXISTS auth_creds (
      bot TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_creds_backup (
      bot TEXT NOT NULL, data TEXT NOT NULL, saved_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS auth_creds_backup_bot ON auth_creds_backup (bot, saved_at);
    CREATE TABLE IF NOT EXISTS auth_meta (
      bot TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (bot, key)
    );
  `);
  try { const r = slimAll(); if (r.rows) console.log(`🧬 SqliteAuth: slimmed ${r.rows} oversized Signal record(s) — ${(r.bytesSaved / 1048576).toFixed(1)} MB of dead skipped-message keys dropped`); } catch (e) {} // Push #103k-c
  return _file;
}
/** Push #103k-c: one pass over every oversized session / sender-key row (boot + /dbstatus). */
function slimAll() {
  _assert();
  const rows = _db.prepare(`SELECT bot, type, id, data FROM auth_keys WHERE type IN ('session','sender-key') AND length(data) > ?`).all(Math.floor(SLIM_AT_BYTES * 1.3));
  const up = _db.prepare('UPDATE auth_keys SET data = ? WHERE bot = ? AND type = ? AND id = ?');
  let n = 0, saved = 0;
  const tx = _db.transaction(() => {
    for (const r of rows) {
      let v; try { v = _de(r.data); } catch { continue; }
      const sv = slimKey(r.type, v); if (sv === v) continue;
      const out = _ser(sv); saved += Math.max(0, r.data.length - out.length);
      up.run(out, r.bot, r.type, r.id); n++;
    }
  });
  tx();
  return { rows: n, bytesSaved: saved, scanned: rows.length };
}
function isAvailable() { return !!_db; }
function _assert() { if (!_db) throw new Error('SqliteAuth not initialised — call init(dataDir) first'); }

// ── serialisation ──────────────────────────────────────────────
function _ser(v) { const { BufferJSON } = _loadDeps(); return JSON.stringify(v, BufferJSON.replacer); }
function _de(s) { const { BufferJSON } = _loadDeps(); return JSON.parse(s, BufferJSON.reviver); }
// ── Push #103k-c: SLIM the Signal records that make the bots slow ───────────────
// Live 10-22 profile (90 s): 4.9 s inside SenderKeyRecord.deserialize + 2.8 s roughSizeOfObject + sqlite writes —
// 33 sender-key records of ~450 KB (2000 skipped message keys each) and 1:1 sessions of up to 1.6 MB. Every message
// from such a sender makes EVERY bot parse + revive 2000 Buffers + re-serialise + walk the object for the cache.
// Skipped message keys only matter for out-of-order delivery; keeping the newest MSG_KEYS_KEEP is more than WhatsApp
// itself tolerates. Applied on READ and WRITE, so the file shrinks as records are touched.
const MSG_KEYS_KEEP = Number(process.env.SIGNAL_MSG_KEYS_KEEP || 120);
const SLIM_AT_BYTES = 24 * 1024;
const _slimStats = { senderKey: 0, session: 0, bytesSaved: 0 };
function _toJsonString(v) {
  if (typeof v === 'string') return v;
  if (v && (Buffer.isBuffer(v) || v instanceof Uint8Array)) return Buffer.from(v).toString('utf8');
  return null;
}
function _slimSenderKey(v) {
  const str = _toJsonString(v); if (!str || str.length < SLIM_AT_BYTES) return v;
  let arr; try { arr = JSON.parse(str); } catch { return v; }
  if (!Array.isArray(arr)) return v;
  let changed = false;
  for (const st of arr) {
    const mk = st && st.senderMessageKeys;
    if (Array.isArray(mk) && mk.length > MSG_KEYS_KEEP) {
      mk.sort((x, y) => (Number(x.iteration) || 0) - (Number(y.iteration) || 0));
      st.senderMessageKeys = mk.slice(mk.length - MSG_KEYS_KEEP);
      changed = true;
    }
  }
  if (!changed) return v;
  const out = Buffer.from(JSON.stringify(arr), 'utf8');
  _slimStats.senderKey++; _slimStats.bytesSaved += Math.max(0, str.length - out.length);
  return out;
}
function _slimSession(v) {
  const str = _toJsonString(v); if (!str || str.length < SLIM_AT_BYTES) return v;
  let obj; try { obj = JSON.parse(str); } catch { return v; }
  const sessions = obj && (obj._sessions || obj.sessions); if (!sessions || typeof sessions !== 'object') return v;
  let changed = false;
  for (const sid of Object.keys(sessions)) {
    const chains = sessions[sid] && (sessions[sid]._chains || sessions[sid].chains); if (!chains) continue;
    for (const ck of Object.keys(chains)) {
      const mk = chains[ck] && chains[ck].messageKeys; if (!mk || typeof mk !== 'object') continue;
      const ids = Object.keys(mk);
      if (ids.length > MSG_KEYS_KEEP) {
        ids.sort((x, y) => Number(x) - Number(y));
        for (const drop of ids.slice(0, ids.length - MSG_KEYS_KEEP)) delete mk[drop];
        changed = true;
      }
    }
  }
  if (!changed) return v;
  const out = Buffer.from(JSON.stringify(obj), 'utf8');
  _slimStats.session++; _slimStats.bytesSaved += Math.max(0, str.length - out.length);
  return out;
}
function slimKey(type, v) {
  try {
    if (v === null || v === undefined) return v;
    if (type === 'sender-key') return _slimSenderKey(v);
    if (type === 'session') return _slimSession(v);
  } catch (e) {}
  return v;
}
function slimStats() { return { ..._slimStats, keep: MSG_KEYS_KEEP }; }

function _credsLooksValid(c) { return !!(c && typeof c === 'object' && c.noiseKey && c.signedIdentityKey); }
function _credsRegistered(c) { return !!(c && (c.registered || (c.me && c.me.id))); }

// ── atomic creds.json mirror ───────────────────────────────────
function _writeFileAtomic(file, text) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}
function _readCredsFile(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw || !raw.trim()) return null;
    const c = _de(raw);
    return _credsLooksValid(c) ? c : null;
  } catch { return null; }
}

// ── creds ──────────────────────────────────────────────────────
function loadCreds(bot) {
  _assert();
  const row = _db.prepare('SELECT data FROM auth_creds WHERE bot = ?').get(bot);
  if (row) { try { const c = _de(row.data); if (_credsLooksValid(c)) return { creds: c, source: 'sqlite' }; } catch {} }
  const b = _db.prepare('SELECT data FROM auth_creds_backup WHERE bot = ? ORDER BY saved_at DESC').all(bot);
  for (const r of b) { try { const c = _de(r.data); if (_credsLooksValid(c)) return { creds: c, source: 'sqlite-backup' }; } catch {} }
  return null;
}
function saveCreds(bot, creds, mirrorFile) {
  _assert();
  if (!_credsLooksValid(creds)) return false;
  const now = Date.now();
  const text = _ser(creds);
  const tx = _db.transaction(() => {
    _db.prepare('INSERT OR REPLACE INTO auth_creds (bot, data, updated_at) VALUES (?, ?, ?)').run(bot, text, now);
    // Only REGISTERED creds are worth a backup slot (a fresh pairing blob is not).
    if (_credsRegistered(creds)) {
      const last = _db.prepare('SELECT data, saved_at FROM auth_creds_backup WHERE bot = ? ORDER BY saved_at DESC LIMIT 1').get(bot);
      if (!last || now - last.saved_at > 60_000) {           // at most one backup/minute
        _db.prepare('INSERT INTO auth_creds_backup (bot, data, saved_at) VALUES (?, ?, ?)').run(bot, text, now);
        _db.prepare(`DELETE FROM auth_creds_backup WHERE bot = ? AND saved_at NOT IN
                     (SELECT saved_at FROM auth_creds_backup WHERE bot = ? ORDER BY saved_at DESC LIMIT ?)`).run(bot, bot, CREDS_BACKUPS);
      }
    }
  });
  tx();
  if (mirrorFile) { try { _writeFileAtomic(mirrorFile, text); } catch (e) { console.error(`⚠️ SqliteAuth [${bot}] creds.json mirror failed: ${e.message}`); } }
  return true;
}

// ── keys ───────────────────────────────────────────────────────
function getKeys(bot, type, ids) {
  _assert();
  const out = {};
  if (!ids || !ids.length) return out;
  const stmt = _db.prepare('SELECT data FROM auth_keys WHERE bot = ? AND type = ? AND id = ?');
  const { proto } = _loadDeps();
  for (const id of ids) {
    const row = stmt.get(bot, type, String(id));
    if (!row) { out[id] = undefined; continue; }
    let v = null;
    try { v = _de(row.data); } catch { v = null; }
    v = slimKey(type, v); // Push #103k-c
    if (type === 'app-state-sync-key' && v && proto?.Message?.AppStateSyncKeyData?.fromObject) {
      v = proto.Message.AppStateSyncKeyData.fromObject(v);
    }
    out[id] = v;
  }
  return out;
}
function setKeys(bot, data) {
  _assert();
  const now = Date.now();
  const up = _db.prepare('INSERT OR REPLACE INTO auth_keys (bot, type, id, data, updated_at) VALUES (?, ?, ?, ?, ?)');
  const del = _db.prepare('DELETE FROM auth_keys WHERE bot = ? AND type = ? AND id = ?');
  let writes = 0;
  const tx = _db.transaction(() => {
    for (const type in data) {
      const bucket = data[type] || {};
      for (const id in bucket) {
        const v = bucket[id];
        if (v === null || v === undefined) del.run(bot, type, String(id));
        else up.run(bot, type, String(id), _ser(slimKey(type, v)), now); // Push #103k-c: slim before it hits disk
        writes++;
      }
    }
  });
  tx();
  return writes;
}
function countKeys(bot, type) {
  _assert();
  return type
    ? _db.prepare('SELECT COUNT(*) AS n FROM auth_keys WHERE bot = ? AND type = ?').get(bot, type).n
    : _db.prepare('SELECT COUNT(*) AS n FROM auth_keys WHERE bot = ?').get(bot).n;
}
/** Drop the oldest pre-keys once a bot holds more than PREKEY_PRUNE_AT. */
function prunePreKeys(bot, keep = PREKEY_KEEP, at = PREKEY_PRUNE_AT) {
  _assert();
  const n = countKeys(bot, 'pre-key');
  if (n <= at) return 0;
  const r = _db.prepare(`DELETE FROM auth_keys WHERE bot = ? AND type = 'pre-key' AND id NOT IN
    (SELECT id FROM auth_keys WHERE bot = ? AND type = 'pre-key' ORDER BY CAST(id AS INTEGER) DESC LIMIT ?)`).run(bot, bot, keep);
  return r.changes;
}
/** Sessions/sender keys only — the "fresh handshake" used by the deaf-socket healer. */
function purgeSessions(bot) {
  _assert();
  return _db.prepare(`DELETE FROM auth_keys WHERE bot = ? AND type IN ('session','sender-key','sender-key-memory')`).run(bot).changes;
}
/** Everything for a bot (relink / quarantine). Creds backups are kept unless wipeBackups. */
function wipe(bot, { wipeBackups = false } = {}) {
  _assert();
  const tx = _db.transaction(() => {
    _db.prepare('DELETE FROM auth_keys WHERE bot = ?').run(bot);
    _db.prepare('DELETE FROM auth_creds WHERE bot = ?').run(bot);
    _db.prepare('DELETE FROM auth_meta WHERE bot = ?').run(bot);
    if (wipeBackups) _db.prepare('DELETE FROM auth_creds_backup WHERE bot = ?').run(bot);
  });
  tx();
}
function stats(bot) {
  _assert();
  const rows = _db.prepare('SELECT type, COUNT(*) AS n FROM auth_keys WHERE bot = ? GROUP BY type').all(bot);
  const byType = {}; for (const r of rows) byType[r.type] = r.n;
  const creds = _db.prepare('SELECT updated_at FROM auth_creds WHERE bot = ?').get(bot);
  const backups = _db.prepare('SELECT COUNT(*) AS n FROM auth_creds_backup WHERE bot = ?').get(bot).n;
  return { bot, keys: byType, total: rows.reduce((a, r) => a + r.n, 0), credsAt: creds ? creds.updated_at : null, credsBackups: backups };
}
function listBots() {
  _assert();
  const s = new Set();
  for (const r of _db.prepare('SELECT DISTINCT bot FROM auth_creds').all()) s.add(r.bot);
  for (const r of _db.prepare('SELECT DISTINCT bot FROM auth_keys').all()) s.add(r.bot);
  return [...s];
}

// ── legacy folder import ───────────────────────────────────────
function _splitLegacyName(file) {
  if (!file.endsWith('.json') || file === 'creds.json') return null;
  const stem = file.slice(0, -5);
  for (const t of KNOWN_TYPES) {
    if (stem.startsWith(t + '-')) return { type: t, id: stem.slice(t.length + 1).replace(/__/g, '/') };
  }
  const i = stem.indexOf('-');
  if (i <= 0) return null;
  return { type: stem.slice(0, i), id: stem.slice(i + 1).replace(/__/g, '/') };
}
/**
 * Import a legacy multi-file folder into SQLite (idempotent: skipped when the
 * bot already has rows, unless force). Returns counts. Afterwards the key
 * files are MOVED to <legacyDir>/<bot>/ (never deleted) when moveTo is given.
 */
function importLegacyDir(bot, botAuthDir, { moveTo = null, force = false, keepPreKeys = PREKEY_KEEP } = {}) {
  _assert();
  const res = { bot, imported: 0, skippedPreKeys: 0, moved: 0, creds: false, files: 0 };
  if (!fs.existsSync(botAuthDir)) return res;
  if (!force && countKeys(bot) > 0) return res;
  let files;
  try { files = fs.readdirSync(botAuthDir); } catch { return res; }
  res.files = files.length;
  // Decide which pre-keys survive: the newest `keepPreKeys` by numeric id.
  const preIds = [];
  const parsed = [];
  for (const f of files) {
    const p = _splitLegacyName(f);
    if (!p) continue;
    parsed.push([f, p]);
    if (p.type === 'pre-key') { try { if (fs.statSync(path.join(botAuthDir, f)).size > 2) preIds.push(Number(p.id)); } catch {} }
  }
  preIds.sort((a, b) => b - a);
  const preCut = preIds.length > keepPreKeys ? preIds[keepPreKeys - 1] : -Infinity;
  const now = Date.now();
  const up = _db.prepare('INSERT OR REPLACE INTO auth_keys (bot, type, id, data, updated_at) VALUES (?, ?, ?, ?, ?)');
  const tx = _db.transaction(() => {
    for (const [f, p] of parsed) {
      if (p.type === 'pre-key' && Number(p.id) < preCut) { res.skippedPreKeys++; continue; }
      let raw;
      try { raw = fs.readFileSync(path.join(botAuthDir, f), 'utf8'); if (!raw.trim()) continue; JSON.parse(raw); } catch { continue; }
      up.run(bot, p.type, p.id, raw, now);   // already BufferJSON-encoded on disk
      res.imported++;
    }
  });
  tx();
  const c = _readCredsFile(path.join(botAuthDir, 'creds.json'));
  if (c) { saveCreds(bot, c, null); res.creds = true; }
  _db.prepare('INSERT OR REPLACE INTO auth_meta (bot, key, value) VALUES (?, ?, ?)').run(bot, 'imported_at', String(now));
  if (moveTo) {
    const dest = path.join(moveTo, bot);
    try { fs.mkdirSync(dest, { recursive: true }); } catch {}
    for (const [f] of parsed) {
      try { fs.renameSync(path.join(botAuthDir, f), path.join(dest, f)); res.moved++; }
      catch { try { fs.rmSync(path.join(botAuthDir, f), { force: true }); res.moved++; } catch {} }
    }
  }
  return res;
}

// ── Baileys-compatible auth state ──────────────────────────────
/**
 * Drop-in for useMultiFileAuthState(botAuthDir):
 *   const { state, saveCreds } = await useSqliteAuthState(bot, botAuthDir)
 * Also returns `source` ('sqlite' | 'sqlite-backup' | 'creds.json' | 'fresh').
 */
async function useSqliteAuthState(bot, botAuthDir, { legacyDir = null } = {}) {
  _assert();
  const { initAuthCreds } = _loadDeps();
  fs.mkdirSync(botAuthDir, { recursive: true });
  const credsFile = path.join(botAuthDir, 'creds.json');
  // 1) import a legacy folder once
  try {
    const r = importLegacyDir(bot, botAuthDir, { moveTo: legacyDir });
    if (r.imported || r.moved) console.log(`🗄️ SqliteAuth [${bot}] imported ${r.imported} keys (dropped ${r.skippedPreKeys} stale pre-keys), moved ${r.moved} legacy files`);
  } catch (e) { console.error(`⚠️ SqliteAuth [${bot}] legacy import failed: ${e.message}`); }
  // 2) creds: sqlite → sqlite backup → creds.json → fresh
  let creds = null, source = 'fresh';
  const fromDb = loadCreds(bot);
  if (fromDb) { creds = fromDb.creds; source = fromDb.source; }
  if (!creds) { const c = _readCredsFile(credsFile); if (c) { creds = c; source = 'creds.json'; } }
  if (!creds) creds = initAuthCreds();
  if (source !== 'sqlite') { try { saveCreds(bot, creds, credsFile); } catch {} }
  else { try { if (!_readCredsFile(credsFile)) _writeFileAtomic(credsFile, _ser(creds)); } catch {} }
  let sinceLastPrune = 0;
  return {
    source,
    state: {
      creds,
      keys: {
        get: async (type, ids) => getKeys(bot, type, ids),
        set: async (data) => {
          setKeys(bot, data);
          if (data && data['pre-key'] && ++sinceLastPrune >= 50) { sinceLastPrune = 0; try { prunePreKeys(bot); } catch {} }
        },
      },
    },
    saveCreds: async () => { saveCreds(bot, creds, credsFile); },
  };
}

/** True when creds in SQLite (or the mirror file) say this bot is registered. */
function credsRegistered(bot, botAuthDir) {
  try { const r = loadCreds(bot); if (r) return _credsRegistered(r.creds); } catch {}
  if (botAuthDir) { const c = _readCredsFile(path.join(botAuthDir, 'creds.json')); if (c) return _credsRegistered(c); }
  return false;
}

function close() { try { _db && _db.close(); } catch {} _db = null; _file = null; }

module.exports = { slimKey, slimStats, slimAll,
  init, isAvailable, close, useSqliteAuthState, importLegacyDir,
  loadCreds, saveCreds, getKeys, setKeys, countKeys, prunePreKeys, purgeSessions, wipe, stats, listBots, credsRegistered,
  PREKEY_KEEP, PREKEY_PRUNE_AT, CREDS_BACKUPS,
  _setDeps, _splitLegacyName, _writeFileAtomic, _readCredsFile,
};
