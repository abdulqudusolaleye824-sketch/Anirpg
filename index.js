// Load .env file FIRST — before any other code reads process.env
require('dotenv').config();

const fs = require('fs');
let cachedConfig = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose'); // Push #66: the schema layer (what typegoose builds on) — typed mirror doc, no build step
const rpgCommandHandler = require('./handlers/rpgCommandHandler');
const PlayerMigration = require('./rpg/utils/PlayerMigration');
const RegenManager = require('./rpg/utils/RegenManager');
const GateManager = require('./rpg/dungeons/GateManager');
const SeasonManager = require('./rpg/utils/SeasonManager');
const Announcer = require('./rpg/utils/Announcer');

// ── Astra Multi-Bot System ───────────────────────────────────────────────────
const PersonalityManager  = require('./bots/PersonalityManager');
const AIHandler           = require('./bots/AIHandler');
const MultiSocketManager  = require('./bots/MultiSocketManager');
// Push #81: console ring buffer — last 400 lines readable at /api/logs so the
// box can be diagnosed from a phone browser without SSH.
const _logRing = [];
const _BOOT_AT = Date.now();
for (const lvl of ['log', 'error', 'warn']) {
  const orig = console[lvl].bind(console);
  console[lvl] = (...a) => {
    try {
      const line = a.map((x) => (typeof x === 'string' ? x : (x && x.stack) ? x.stack : (() => { try { return JSON.stringify(x); } catch (e) { return String(x); } })())).join(' ');
      _logRing.push(`${new Date().toISOString().slice(11, 19)} ${lvl === 'log' ? ' ' : lvl === 'warn' ? 'W' : 'E'} ${line.slice(0, 600)}`);
      if (_logRing.length > 400) _logRing.shift();
    } catch (e) {}
    orig(...a);
  };
}
const _OPS_PASSWORD = String(process.env.LINK_PASSWORD || process.env.BOT_LINK_PASSWORD || 'astra2026');
function _opsAuthed(req) {
  try {
    const u = new URL(req.url || '/', 'http://localhost');
    return (u.searchParams.get('key') || req.headers['x-ops-key'] || '') === _OPS_PASSWORD;
  } catch (e) { return false; }
}
const { recordCommand }   = require('./bots/CCTVManager');
const GateKeyManager      = require('./rpg/dungeons/GateKeyManager');
const SerfManager         = require('./rpg/utils/SerfManager');
const Perms               = require('./utils/permissions');

// ── OWNER DIAGNOSTIC ────────────────────────────────────────────────────────
// Prints the owner/co-owner the bot is using, and the normalised number, so
// you can see at a glance whether OWNER_JID is being read from .env.
// If this shows a "placeholder"/wrong number, OWNER_JID isn't set in .env.
{
  const o = process.env.OWNER_JID || require('./utils/constants').OWNER_JID || '(none)';
  const c = process.env.COOWNER_JID || require('./utils/constants').COOWNER_JID || '(none)';
  const norm = (j) => String(j || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  console.log(`🧑‍💼 OWNER_JID   = ${o}  (normalised: ${norm(o)})`);
  console.log(`🤝 COOWNER_JID = ${c}  (normalised: ${norm(c)})`);
  console.log('   Sending /start as a different number than these = "Only owner" message.');
}

// Register linked WhatsApp numbers → personalities from env
const PERSONALITY_KEYS = ['hinata','lunar','aria','kira','zephyr','nova','void','seraph','echo','raven','jinx'];
for (const key of PERSONALITY_KEYS) {
  const envJid = process.env[`BOT_${key.toUpperCase()}`];
  if (envJid) {
    PersonalityManager.registerLinkedNumber(envJid.trim(), key);
    console.log(`🤖 Registered bot: ${key} → ${envJid}`);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ── MongoDB setup (OPTIONAL) ─────────────────────────────────
// Mongo is used when MONGODB_URI is set. If it's missing, the bot
// runs fully on the local JSON database instead — so you can host
// it locally with no DB setup. A Mongo URI is only needed for
// production/multi-device deployments.
const MONGO_URI = process.env.MONGODB_URI || '';
if (!MONGO_URI) {
  console.log('ℹ️  MONGODB_URI not set — running on the local SQLite/JSON database (Mongo optional).');
}
let mongoClient = null;       // the mongoose instance (kept name for the call sites)
let mongoDb = null;
let mongoCollection = null;   // the DatabaseMirror model

// Push #66 — the Atlas mirror is now a real SCHEMA (the mongoose layer that
// typegoose sits on: typed fields, indexes, timestamps — with no build step,
// since this repo is plain JS). One document holds the whole database:
//   { _id: 'main', doc: <game DB>, userCount, botPush, updatedAt }
// Docs written before this push spread the game-DB fields at the top level;
// loadFromMongoDoc() still understands that legacy shape and the first save
// rewrites it into the schema shape transparently.
function databaseMirrorSchema() {
  return new mongoose.Schema({
    _id: { type: String },
    doc: { type: mongoose.Schema.Types.Mixed },  // the full game DB (loose by design)
    userCount: { type: Number, default: 0 },     // denormalized — health checks without parsing
    botPush: { type: Number, default: null },    // which push wrote this doc
    updatedAt: { type: Number, default: Date.now },
  }, { strict: false });
}
// Push #66 helper: a mirror doc (new or legacy shape) → the game-DB object.
function _mirrorToDb(m) {
  if (!m) return null;
  const raw = typeof m.toObject === 'function' ? m.toObject({ virtuals: false }) : m;
  if (raw.doc && typeof raw.doc === 'object') return raw.doc;          // Push #66 shape
  const { _id, __v, doc, userCount, botPush, updatedAt, ...rest } = raw; // legacy: spread fields
  return Object.keys(rest).length ? rest : null;
}
function _mirrorDocToWrite() {
  return {
    _id: 'main',
    doc: database,
    userCount: Object.keys(database.users || {}).length,
    botPush: (typeof Updates !== 'undefined' && Updates.BOT_VERSION) || null,
    updatedAt: Date.now(),
  };
}

// ── Owner / co-owner JIDs (single source of truth) ──────────────────────────
const { OWNER_JID, COOWNER_JID, PRIVILEGED_JIDS } = require('./utils/constants');

// ── Bot lifecycle ────────────────────────────────────────────────────────────
// ALL bots are equal. Every bot:
//   - Handles RPG commands in groups
//   - Reacts to AI chat in groups when its personality is active
//   - Sends DMs to its serf (welcome DM is the only bypass)
//
// "AstraLink host" — whichever bot socket we use to issue pairing codes —
// is just whichever socket the HTTP API happens to call. There is no
// special "primary" bot anymore.
// Push #64: the AstraLink web page is RETIRED. Pairing now happens via the
// owner's DM command `/link <bot>` — the QR prints in the console (pm2 logs /
// Oracle terminal) and rotates every QR_VALID_MS. The only routes left on this
// port are read-only ops endpoints (/health, /api/bot-status, /api/personalities,
// /api/db-health).
const { spawn } = require('child_process');
let _astralinkHostKey = null;
let _astralinkHostSock = null;

async function connectMongo() {
  if (!MONGO_URI) return false; // Mongo optional — no URI means local DB only
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000, autoIndex: true });
    mongoClient = mongoose;
    mongoCollection = mongoose.models.DatabaseMirror
      || mongoose.model('DatabaseMirror', databaseMirrorSchema());
    console.log('✅ MongoDB connected successfully! (DatabaseMirror schema — Push #66)');
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    return false;
  }
}

// Push #23: returns the doc (or null) WITHOUT assigning — startup() picks the
// fresher of Mongo vs JSON before committing to either.
async function loadFromMongoDoc() {
  try {
    const doc = await mongoCollection.findOne({ _id: 'main' });
    const db = _mirrorToDb(doc); // Push #66: understands the schema shape AND the legacy spread shape
    if (db) {
      if (doc.doc === undefined) console.log('📦 Legacy Atlas doc detected — it will be rewritten to the DatabaseMirror schema on the next save (Push #66).');
      return db;
    }
    return null;
  } catch (err) {
    console.error('❌ MongoDB load failed:', err.message);
    return null;
  }
}

let saveTimeout = null;
let _bootUsers = 0; // Push #31: users present at boot (write-guard baseline)
let _bootAt = 0;    // Push #31: boot timestamp
let _lastSnapAt = 0;       // Push #32: last hourly snapshot
let _bootHealth = {};      // Push #32: degraded-boot flags for /api/db-health
const _pendingOwnerAlarms = []; // Push #32: owner DM alarm queue (flushed when a socket is up)
let _mongoArmed = false;   // Push #33: Atlas write arming (arm-on-first-write)
let _divergeAlarmAt = 0;   // Push #33: throttle for the divergence alarm
function _snapDir() { try { return path.join(path.dirname(DB_PATH), 'snapshots'); } catch { return null; } }
// Push #32 (L2): timestamped snapshot writer. Best-effort, sync, never throws.
function writeDbSnapshot(tag, obj) {
  try {
    const sd = _snapDir();
    if (!sd) return null;
    fs.mkdirSync(sd, { recursive: true });
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; // Push #32: seconds included — same-minute boots never collide
    const fp = path.join(sd, `${tag}-${stamp}.json`);
    fs.writeFileSync(fp, JSON.stringify(obj || database)); // compact (Push #47)
    return fp;
  } catch { return null; }
}
// Push #32 (L2): prune to 24h of hourlies + newest-per-day x7 + 12 boot snaps.
// Fail-closed: only our own prefixed files are ever deleted.
function pruneSnapshots() {
  try {
    const sd = _snapDir();
    if (!sd || !fs.existsSync(sd)) return;
    const files = fs.readdirSync(sd).filter(f => /^(snap|boot)-.*\.json$/.test(f));
    const now = Date.now();
    const mtime = (f) => { try { return fs.statSync(path.join(sd, f)).mtimeMs; } catch { return 0; } };
    const snaps = files.filter(f => f.startsWith('snap-'));
    const boots = files.filter(f => f.startsWith('boot-'));
    const keep = new Set();
    const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
    const byDay = {};
    for (const f of snaps) {
      const t = mtime(f);
      if (now - t < 24 * 3600 * 1000) { keep.add(f); continue; }
      const d = dayOf(t);
      if (!byDay[d] || t > byDay[d].t) byDay[d] = { f, t };
    }
    Object.values(byDay).sort((a, b) => b.t - a.t).slice(0, 7).forEach(x => keep.add(x.f));
    const keepFinal = new Set(snaps.filter(f => keep.has(f)).sort((a, b) => mtime(b) - mtime(a)).slice(0, 40));
    for (const f of snaps) if (!keepFinal.has(f)) { try { fs.unlinkSync(path.join(sd, f)); } catch {} }
    boots.sort((a, b) => mtime(b) - mtime(a)).slice(12).forEach(f => { try { fs.unlinkSync(path.join(sd, f)); } catch {} });
  } catch {}
}
function maybeHourlySnapshot() {
  if (Date.now() - _lastSnapAt < 3600 * 1000) return;
  _lastSnapAt = Date.now();
  writeDbSnapshot('snap');
  pruneSnapshots();
}
// ═══════════════════════════════════════════════════════════════
// Push #47 — persistence CPU budget (this is what was making the bot crawl)
//
// 381 `saveDatabase()` call sites used to each trigger: a pretty-printed
// JSON.stringify of the WHOLE document (indent costs ~2-3x), a SECOND full
// stringify purely for the Mongo size guard, and then the driver's own
// serialize. With hundreds of players the loop was blocked for hundreds of ms
// per save on a throttled Oracle VM — slow commands, missed WhatsApp
// keepalives, and a Mongo doc bumping into its 16MB ceiling.
//
// Now: the document is serialized ONCE per write window (compact), that string
// feeds the file write and the size guard, and writes are coalesced into a
// minimum interval with a bounded maximum wait (so a busy group can never
// starve persistence, and an idle one never spins).
// ═══════════════════════════════════════════════════════════════
const SAVE_MIN_INTERVAL_MS = parseInt(process.env.SAVE_MIN_INTERVAL_MS || '1200', 10);
const SAVE_MAX_WAIT_MS     = parseInt(process.env.SAVE_MAX_WAIT_MS || '6000', 10);
let _snap = { str: null, at: 0, bytes: 0 };
let _saveDirty = false;
let _saveFirstDirtyAt = 0;
let _saveTimer = null;
let _lastWriteAt = 0;
const PerfMonitor = require('./rpg/utils/PerfMonitor');
const perfCounters = PerfMonitor.counters;

/** Compact JSON of the live document, memoised for `maxAgeMs`. */
function serializeDb(maxAgeMs) {
  const now = Date.now();
  if (_snap.str && (now - _snap.at) < (maxAgeMs || 0)) { perfCounters.coalescedSaves++; return _snap; }
  const t0 = Date.now();
  const str = JSON.stringify(database);
  _snap = { str, at: now, bytes: Buffer.byteLength(str) };
  perfCounters.serializes++;
  perfCounters.lastSerializeMs = Date.now() - t0;
  return _snap;
}

let pendingMongoWrite = null;
let _lastMongoFlush = 0; // Batch-47: max-wait bookkeeping (see below)
let _mongoSizeWarnAt = 0; // Push #23: throttle for the oversize-mirror warning
async function saveToMongo() {
  if (!mongoCollection) return;
  // Push #24: starvation-proof scheduling. The old clearTimeout+reschedule
  // meant constant activity (>1 save/2s across 5 bots) reset the timer
  // FOREVER and the mirror never flushed (batch-47's _waitMs was dead code
  // next to a hardcoded 2000ms). Now: trailing write scheduled ONCE (750ms),
  // plus a leading-edge flush whenever the mirror is >5s stale.
  const _now = Date.now();
  if (_now - _lastMongoFlush > 5000 && !pendingMongoWrite && !saveTimeout) {
    _doMongoWrite();
    return;
  }
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    _doMongoWrite();
  }, 750);
}

function _doMongoWrite() {
    pendingMongoWrite = (async () => {
      try {
        // Push #23: size guard — never let a bloated DB silently kill the
        // mirror again. Skip + warn (throttled) instead of error-spamming.
        let _approx = 0;
        // Push #47: reuse the memoised serialization instead of stringifying the
        // whole document a second time just to measure it.
        try { _approx = serializeDb(250).bytes; } catch (e) { _approx = 0; }
        if (_approx > 14 * 1024 * 1024) {
          const _now = Date.now();
          if (_now - _mongoSizeWarnAt > 3600 * 1000) {
            _mongoSizeWarnAt = _now;
            console.error(`🚨 MongoDB mirror SKIPPED: database is ${(_approx / 1048576).toFixed(1)}MB (limit 16MB). JSON fallback is the live copy — investigate bloat!`);
          }
          return;
        }
        // Push #31: NEVER let an emptied in-memory DB clobber a fuller mirror.
        // Legit flows never delete all users — 0 users after a non-empty boot
        // means a bad load, and the mirror is the only surviving copy.
        const _memUsers = Object.keys(database.users || {}).length;
        if (_memUsers === 0 && _bootUsers > 0) {
          console.error(`🛡️ Mongo mirror PROTECTED: refusing to overwrite ${_bootUsers} users with an empty DB. Investigate the load path!`);
          return;
        }
        // Push #33: arm-on-first-write — never touch Atlas until we've SEEN the remote side.
        // Closes the fresh-boot + late-Mongo cement (boot=0 bypassed the #31 check).
        if (!_mongoArmed) {
          const _forceFlag = (() => { try { return path.join(path.dirname(DB_PATH), 'FORCE_ARM'); } catch { return null; } })();
          let _remoteUsers = -1;
          try {
            const _rd = await mongoCollection.findOne({ _id: 'main' });
            const _rdDb = _mirrorToDb(_rd); // Push #66: schema or legacy shape
            _remoteUsers = _rdDb ? Object.keys(_rdDb.users || {}).length : 0;
          } catch { _remoteUsers = -1; }
          if (_remoteUsers < 0) return; // Atlas unreachable — JSON mirror covers; retry arming on next save
          if (_forceFlag && fs.existsSync(_forceFlag)) {
            try { fs.unlinkSync(_forceFlag); } catch {}
            console.error(`⚠️ Mongo force-arm consumed: proceeding with ${_memUsers} users over remote ${_remoteUsers}.`);
            _mongoArmed = true;
          } else if (_remoteUsers > _memUsers) {
            if (Date.now() - _divergeAlarmAt > 3600 * 1000) { // throttled: no alarm/log spam
              _divergeAlarmAt = Date.now();
              console.error(`🛡️ MONGO DIVERGED: remote has ${_remoteUsers} users, memory has ${_memUsers} — REFUSING to overwrite. Owner alerted.`);
              try { writeDbSnapshot('diverged'); } catch {}
              _pendingOwnerAlarms.push(`🛡️ *MONGO DIVERGENCE — WRITE REFUSED* 🛡️\n\nAtlas holds ${_remoteUsers} users but memory has ${_memUsers}. I refused to overwrite Atlas — your data is safe on BOTH sides.\n\nLocal copy preserved in snapshots/diverged-*.json. Investigate, then /dbforce confirm — or restart to reload from Atlas.`);
            }
            return;
          } else {
            _mongoArmed = true;
          }
        }
        // Push #66: the typed DatabaseMirror document (game DB in `doc` +
        // schema metadata). replaceOne on the model applies the schema.
        await mongoCollection.replaceOne(
          { _id: 'main' },
          _mirrorDocToWrite(),
          { upsert: true }
        );
        _lastMongoFlush = Date.now();
      } catch (err) {
        console.error('❌ MongoDB save failed:', err.message);
        try {
          fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
          fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2));
          console.warn('⚠️  Wrote JSON fallback after Mongo failure');
        } catch(e) {
          console.error('❌ JSON fallback also failed:', e.message);
        }
      } finally {
        pendingMongoWrite = null;
      }
    })();
}

// ── Persistent data paths ─────────────────────────────────────
const DATA_DIR   = process.env.DATA_DIR || __dirname;
const AUTH_DIR   = process.env.AUTH_DIR || path.join(DATA_DIR, 'auth');
const DB_PATH    = path.join(DATA_DIR, 'database', 'database.json');

// Push #65: SQLite becomes the LIVE copy of the game DB (atomic, single file,
// one row per top-level collection); JSON demotes to a backup mirror and Atlas
// stays the off-host mirror. QuickDB (updates.sqlite) tracks push/version state.
// Both degrade to no-ops with a loud warning if their native module fails —
// a storage upgrade must never take the bot down.
const Storage = require('./db/Storage');
const Updates = require('./db/updates');
Storage.init(DATA_DIR);
Updates.init(DATA_DIR);

const fs_sync = require('fs');
[AUTH_DIR, path.dirname(DB_PATH)].forEach(d => {
  if (!fs_sync.existsSync(d)) fs_sync.mkdirSync(d, { recursive: true });
});

// Initialize database
let database = { users: {}, banlist: {}, dailyQuests: {}, botMods: [], botOwners: [] };
const loadDatabase = (memDoc = null) => {
  try {
    if (memDoc) {
      // Push #65: adopt a doc loaded from the SQLite live store (or a fuller
      // backup mirror) — it runs the exact same normalization as the file path.
      database = memDoc;
    } else if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      database = JSON.parse(data);

      PlayerMigration.migrateAllPlayers(database);

      // ── Migrate botAdmins → botMods (one-shot, July 2026) ────────
      if (database.botAdmins) {
        if (!database.botMods) database.botMods = [];
        const OWNER_JID  = require('./utils/constants').OWNER_JID;
        const COOWNER_JID = require('./utils/constants').COOWNER_JID;
        for (const jid of database.botAdmins) {
          if (jid === OWNER_JID || jid === COOWNER_JID) continue;
          if (!database.botMods.includes(jid)) database.botMods.push(jid);
        }
        delete database.botAdmins;
        console.log('🔄 Migrated botAdmins → botMods');
      }
      if (!database.botMods)   database.botMods   = [];
      if (!database.botOwners) database.botOwners = [];

      let fixedPlayers = 0;
      let removedPlayers = 0;

      for (const userId in database.users) {
        const player = database.users[userId];

        if (!player) {
          console.log(`⚠️ Removing corrupted player: ${userId}`);
          delete database.users[userId];
          removedPlayers++;
          continue;
        }

        if (!player.statusEffects) player.statusEffects = [];
        if (!player.comboCount) player.comboCount = 0;

        if (!player.stats) {
          console.error(`⚠️ Player ${userId} has no stats! Removing.`);
          delete database.users[userId];
          removedPlayers++;
          continue;
        }

        let leveled = false;
        while (true) {
          // Must be the SAME curve the game uses (SoloLevelingCore). The old
          // local 200*level^1.8 formula is ~250x cheaper than the real one at
          // low levels, so every boot re-levelled players and subtracted XP
          // they had legitimately banked. Push #54.
          const xpNeeded = require('./rpg/utils/SoloLevelingCore').getXpRequired(player.level);
          if (player.xp >= xpNeeded) {
            player.level++;
            player.xp -= xpNeeded;
            player.stats.maxHp += 10;
            player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + 10);

            if (player.stats.maxMana !== undefined && player.stats.maxEnergy === undefined) {
              player.stats.maxEnergy = player.stats.maxMana;
              player.stats.energy = player.stats.mana;
              delete player.stats.mana;
              delete player.stats.maxMana;
            }

            player.stats.maxEnergy += 5;
            player.stats.energy = Math.min(player.stats.maxEnergy, player.stats.energy + 5);
            player.stats.atk += 3;
            player.stats.def += 2;
            leveled = true;
          } else {
            break;
          }
        }

        if (player.pvpElo    === undefined) player.pvpElo    = 1000;
        if (player.pvpWins   === undefined) player.pvpWins   = 0;
        if (player.pvpLosses === undefined) player.pvpLosses = 0;
        if (player.pvpStreak === undefined) player.pvpStreak = 0;
        if (!Array.isArray(player.titles))  player.titles    = [];
        if (!player.bannerState)            player.bannerState = {};
        if (!player.summonArtifacts)        player.summonArtifacts = [];
        if (!player.summonWeapons)          player.summonWeapons = {};
        if (!player.constellations)          player.constellations = {};

        if (player.gold < 0) {
          console.log(`⚠️ Fixed negative gold for ${player.name}: ${player.gold} → 0`);
          player.gold = 0;
          leveled = true;
        }

        if (!player.inventory) {
          player.inventory = {
            healthPotions: 0,
            manaPotions: 0,
            energyPotions: 0,
            reviveTokens: 0
          };
          leveled = true;
        }

        if (leveled) {
          fixedPlayers++;
        }
      }

      if (database.guilds) {
        let guildsFixed = 0;
        let guildsRemoved = 0;
        for (const guildId in database.guilds) {
          const guild = database.guilds[guildId];
          if (!guild.leader) {
            delete database.guilds[guildId];
            guildsRemoved++;
            continue;
          }
          if (!database.users[guild.leader]) {
            delete database.guilds[guildId];
            guildsRemoved++;
            continue;
          }
          if (!guild.members || !Array.isArray(guild.members)) {
            guild.members = [{ id: guild.leader, name: database.users[guild.leader]?.name || 'Unknown', rank: 'Leader', joinedAt: Date.now() }];
            guildsFixed++;
          }
          const validMembers = guild.members.filter(m => database.users[m.id]);
          if (validMembers.length !== guild.members.length) {
            guild.members = validMembers;
            guildsFixed++;
          }
          if (!guild.members.some(m => m.id === guild.leader)) {
            guild.members.push({ id: guild.leader, name: database.users[guild.leader]?.name || 'Unknown', rank: 'Leader', joinedAt: Date.now() });
            guildsFixed++;
          }
        }
        if (guildsFixed > 0 || guildsRemoved > 0) {
          console.log(`✅ Fixed ${guildsFixed} guild(s), removed ${guildsRemoved} broken guild(s)`);
        }
      }

      if (fixedPlayers > 0 || removedPlayers > 0) {
        saveDatabase();
        console.log(`✅ Auto-fixed ${fixedPlayers} player(s), removed ${removedPlayers} corrupted player(s)`);
      }

      let battlesCleared = 0;
      const BATTLE_STALE_MS = 10 * 60 * 1000;
      for (const userId in database.users) {
        const player = database.users[userId];
        if (player?.pvpBattle && Date.now() - (player.pvpBattle.startTime || 0) > BATTLE_STALE_MS) {
          const b = player.pvpBattle;
          if (b.petPassiveAtk) player.stats.atk = Math.max(0, (player.stats.atk||0) - b.petPassiveAtk);
          if (b.petPassiveDef) player.stats.def = Math.max(0, (player.stats.def||0) - b.petPassiveDef);
          if (b.petPassiveSpd) player.stats.speed = Math.max(0, (player.stats.speed||0) - b.petPassiveSpd);
          player.pvpBattle = null;
          player.statusEffects = [];
          player.buffs = [];
          battlesCleared++;
        }
      }
      if (battlesCleared > 0) {
        console.log(`⚔️ Cleared ${battlesCleared} orphaned PvP battle(s) on startup`);
        saveDatabase();
      }

      if (database.pendingChallenges) {
        const now = Date.now();
        let staleChallenges = 0;
        for (const targetId in database.pendingChallenges) {
          if (now - (database.pendingChallenges[targetId].timestamp || 0) > 90_000) {
            delete database.pendingChallenges[targetId];
            staleChallenges++;
          }
        }
        if (staleChallenges > 0) console.log(`🧹 Cleared ${staleChallenges} stale PvP challenge(s)`);
      }

      if (database.pendingTrades) {
        const now = Date.now();
        const TRADE_EXPIRE_MS = 24 * 60 * 60 * 1000;
        let staleTrades = 0;
        for (const userId in database.pendingTrades) {
          const t = database.pendingTrades[userId];
          if (!t || (t.timestamp && now - t.timestamp > TRADE_EXPIRE_MS)) {
            delete database.pendingTrades[userId];
            staleTrades++;
          }
        }
        if (staleTrades > 0) console.log(`🧹 Cleared ${staleTrades} stale trade offer(s)`);
      }

      console.log('✅ Database loaded successfully');
      console.log(`👥 ${Object.keys(database.users).length} players loaded`);
    } else {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      saveDatabase();
      console.log('✅ New database created');
    }
  } catch (error) {
    console.error('❌ Error loading database:', error);
  }
};

const getDatabase = () => database;
// Push #32: owner notice loop (L4 daily snapshot DM + degraded alarms).
async function flushOwnerLoop() {
  try {
    const MSM = require('./bots/MultiSocketManager');
    const SerfDM = require('./rpg/utils/SerfDM');
    const socks = (MSM.getAllSockets && MSM.getAllSockets()) || {};
    const liveSock = Object.values(socks).find(s => s?.user?.id);
    if (!liveSock) return; // no socket yet — retry next tick
    while (_pendingOwnerAlarms.length) {
      const text = _pendingOwnerAlarms[0];
      try {
        const r = await SerfDM.sendSerfDM(liveSock, database, OWNER_JID, { text });
        if (r && r.ok) _pendingOwnerAlarms.shift();
        else break;
      } catch { break; }
    }
    const memUsers = Object.keys(database.users || {}).length;
    const lastSnap = database.__lastOwnerSnapAt || 0;
    if (memUsers > 0 && Date.now() - lastSnap > 20 * 3600 * 1000) {
      const stamp = new Date().toISOString().slice(0, 10);
      const buf = Buffer.from(JSON.stringify(database));
      try {
        const r = await SerfDM.sendSerfDM(liveSock, database, OWNER_JID, {
          document: buf, fileName: `anirpg-db-${stamp}.json`, mimetype: 'application/json',
          caption: `💾 *ANIRPG DAILY BACKUP — ${stamp}*\n👥 ${memUsers} players · ⭐ ${(database.botMods || []).length} mods\nKeep this file: it restores the whole bot.`,
        });
        if (r && r.ok) { database.__lastOwnerSnapAt = Date.now(); saveDatabase(); }
      } catch (e) { console.error('owner snapshot send failed:', e.message); }
    }
  } catch (e) { /* never crash for notices */ }
}

// ── JSON write queue ─────────────────────────────────────────────────────────
let _jsonWriteRunning = false;
let _jsonWriteDirty  = false;
let _jsonWriteInFlight = null;

async function _writeJsonBackup() {
  if (_jsonWriteRunning) { _jsonWriteDirty = true; return _jsonWriteInFlight; }
  _jsonWriteRunning = true;
  _jsonWriteInFlight = (async () => {
    try {
      // Push #31: same protection for the JSON mirror (the .1 rotation is
      // only hourly — don't poison the live copy with an empty DB).
      if (Object.keys(database.users || {}).length === 0 && _bootUsers > 0) {
        console.error(`🛡️ JSON mirror PROTECTED: refusing to overwrite ${_bootUsers} users with an empty DB.`);
        return;
      }
      // Push #47: compact serialization (was pretty-printed with a 2-space
      // indent — 2-3x the CPU and ~2.5x the bytes for zero benefit; this file is
      // a machine-read mirror, not something a human edits).
      const snapshot = serializeDb(400).str;
      const _writeT0 = Date.now();
      const tmpPath = DB_PATH + '.tmp';
      await fs.promises.mkdir(path.dirname(DB_PATH), { recursive: true });
      // Push #23: hourly rotating backup — a second on-disk generation.
      try {
        const prev = DB_PATH + '.1';
        let need = true;
        try {
          const st = await fs.promises.stat(prev);
          need = (Date.now() - st.mtimeMs) > 3600 * 1000;
        } catch { need = true; }
        if (need && fs.existsSync(DB_PATH)) {
          await fs.promises.copyFile(DB_PATH, prev);
        }
      } catch {}
      await fs.promises.writeFile(tmpPath, snapshot);
      await fs.promises.rename(tmpPath, DB_PATH);
      perfCounters.writes++;
      perfCounters.lastWriteMs = Date.now() - _writeT0;
      _lastWriteAt = Date.now();
      _snap.at = 0;                      // this snapshot is now consumed
      try { maybeHourlySnapshot(); } catch {} // Push #32: L2 generations
    } catch (e) {
      console.error('❌ JSON backup save failed:', e.message);
    } finally {
      // Batch-47 CRITICAL: capture-then-clear. The old order cleared
      // _jsonWriteDirty BEFORE testing it, so every save that landed
      // while a write was in-flight was silently DROPPED (stale DB,
      // minutes of progress lost on any restart).
      const _needAgain = _jsonWriteDirty;
      _jsonWriteRunning = false;
      _jsonWriteDirty  = false;
      _jsonWriteInFlight = null;
      if (_needAgain) {
        setImmediate(() => _writeJsonBackup());
      }
    }
  })();
  return _jsonWriteInFlight;
}

const saveDatabase = () => {
  // Push #23: stamp every save so boot can pick the FRESHER mirror.
  try { database.__savedAt = Date.now(); } catch {}
  _saveDirty = true;
  try { perfCounters.savesRequested++; } catch (e) {}
  if (!_saveFirstDirtyAt) _saveFirstDirtyAt = Date.now();
  const now = Date.now();
  const sinceWrite = now - _lastWriteAt;
  const waited = now - _saveFirstDirtyAt;
  // Outside combat/queue bursts this writes immediately; under load it merges
  // every save inside the window into ONE serialize + ONE file write, and the
  // max-wait bound guarantees the mirrors can never be starved (the exact bug
  // Push #24 fixed for Mongo — the JSON path still had it).
  if (!_saveTimer && sinceWrite >= SAVE_MIN_INTERVAL_MS) { _flushSaveNow(); return; }
  if (_saveTimer) return;
  const delay = Math.max(0, Math.min(SAVE_MIN_INTERVAL_MS - sinceWrite, SAVE_MAX_WAIT_MS - waited));
  _saveTimer = setTimeout(() => { _saveTimer = null; _flushSaveNow(); }, delay);
  if (_saveTimer.unref) _saveTimer.unref();
};

function _flushSaveNow() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  _saveDirty = false;
  _saveFirstDirtyAt = 0;
  // Push #65: the SQLite live store is written FIRST — it is synchronous and
  // atomic, so the crash-safe copy always leads the (async) mirrors.
  try { Storage.save(database); } catch (e) {}
  try { saveToMongo(); } catch (e) {}
  try { _writeJsonBackup(); } catch (e) {}
}

/** Force a write right now (shutdown / critical mutation). */
async function flushSaveNow(reason) {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  const wasDirty = _saveDirty;
  _saveDirty = false; _saveFirstDirtyAt = 0;
  try { database.__savedAt = Date.now(); } catch {}
  try { Storage.save(database); } catch (e) {} // Push #65: live store first
  try { await _writeJsonBackup(); } catch (e) {}
  try { await _doMongoWrite(); } catch (e) {}
  if (wasDirty) { /* nothing pending beyond what we just wrote */ }
  return true;
}

async function flushJsonBackup() {
  // Push #47: anything still waiting inside the coalescing window is written
  // before we return, so a save that landed microseconds before shutdown cannot
  // be lost.
  if (_saveDirty || _saveTimer) {
    try { await flushSaveNow('flushJsonBackup'); } catch (e) {}
  }
  if (_jsonWriteInFlight) {
    await Promise.race([
      _jsonWriteInFlight,
      new Promise((_, rej) => setTimeout(() => rej(new Error('json flush timeout')), 3000))
    ]);
  }
}

// ── Group join/leave announcers (shared by all bots) ──────────────
// Only the active bot in the group posts the group announcement.
// The welcome DM is NOT sent here — it's sent after the user
// completes /register (in commands/rpg/register.js), and that DM
// uses safeSendDM with the `welcome` bypass flag.
const CREATOR_ID  = require('./utils/constants').OWNER_NUMBER;
const COOWNER_ID  = '194592469209292';

const JOIN_NARUTO = [
  "⚡ *THE CHOSEN ONE ARRIVES.*\nNaruto — creator of this world — has entered the server.\nAll who stand before him, bow. 🌀",
  "🌟 The heavens tremble. *@naruto* steps in.\nWhere he walks, legends are born.",
  "💥 Reality cracks. The bot's creator materializes from thin air.\n*Naruto* is here. You're in safe hands.",
  "🌀 *CREATOR ONLINE.* The architect of this realm descends.\nAll hail the one who built your adventure.",
  "⚡ A familiar energy fills the room. The one who made it all possible — *Naruto* — has arrived."
];

const JOIN_COOWNER = [
  "👑 *CO-OWNER IN THE BUILDING.*\nThe second throne is occupied. Walk carefully.",
  "🔥 Co-owner detected. Adjust your behavior accordingly. *Or don't — see what happens.*",
  "💎 A pillar of the server just walked in. Respect where it's due.",
  "🌑 The co-owner arrives. The energy shifts. The vibe changes. Welcome.",
  "⚔️ Co-owner online. The chain of command is complete."
];

const JOIN_MSGS = [
  `⚔️ *A new soul has entered the battlefield.*\n\n@{tag} just walked through the gates. The dungeon doesn't care if you're ready.\n\nWill you rise... or be forgotten like the rest?\n\n🩸 *Welcome to the guild. Don't die on the first floor.*`,
  `🌀 *The gates creak open.*\n\n@{tag} steps into the unknown. No map. No guide. Just instinct.\n\n📌 */register [name]* — your legend starts now.`,
  `💥 *NEW CHALLENGER DETECTED.*\n\n@{tag} has arrived. The monsters are already watching.\n\nDon't let them feast. 🔥`,
  `🌟 *A familiar energy stirs in the air...*\n\n@{tag} descended from somewhere better and chose HERE.\n\nHonored. Now prove you belong. ⚡`,
  `🐉 *Even the dragons looked up.*\n\n@{tag} just walked in. Something about them feels... dangerous.\n\n📌 */register [name]* to begin your ascent.`,
  `🌌 *From the void, a warrior emerges.*\n\n@{tag} has joined the realm. The board shifts.\n\nEvery legend starts somewhere. This is yours.`,
  `🎯 *Locked in. Loaded. Ready.*\n\n@{tag} just entered the arena and the crowd went silent.\n\nLet's see if the hype is real. ⚔️`,
  `🌊 *The tide brought something new.*\n\n@{tag} arrived. Whether storm or calm, only time will tell.\n\nWelcome. */register [name]* to start.`,
  `🔮 *Fate led you here.*\n\n@{tag} answered the call that most people ignore.\n\nThe dungeon awaits. Are you ready?`,
  `👊 *They didn't knock. They just walked in.*\n\n@{tag} owns this entrance energy and we respect it.\n\nGet registered. Get strong. Get legendary. 💎`,
  `🏹 *A shadow moves at the edge of the forest.*\n\n@{tag} has arrived, silent and purposeful.\n\nThe hunt begins. */register [name]*`,
  `⭐ *One more star added to the sky.*\n\n@{tag} joins the constellation of warriors who dared to show up.\n\nShine bright. Or burn out. Your choice. 🔥`,
  `🗡️ *Steel hits the floor as the newcomer draws their blade.*\n\n@{tag} is here. No pleasantries. Just purpose.\n\nWelcome to the battlefield.`,
  `💀 *The grim reaper looked up... and put the pen down.*\n\n@{tag} isn't going anywhere yet. They just got here.\n\n📌 */register [name]* — let the journey begin.`,
  `🌿 *Something stirs in the wilderness.*\n\n@{tag} emerged from wherever they were hiding.\n\nThe real world is overrated anyway. Welcome home. ⚔️`,
  `🔥 *Heat signature detected. New warrior incoming.*\n\n@{tag} has entered the compound.\n\nThe monsters have been notified. Good luck.`,
  `🏆 *The trophy case just got more competitive.*\n\n@{tag} stepped into the arena.\n\nEvery rank starts at zero. Grind or be left behind.`,
  `💫 *A ripple in the server. Then silence. Then —*\n\n@{tag} appeared.\n\nThe timeline adjusted itself. Welcome.`,
  `🌑 *From the darkness, a presence emerges.*\n\n@{tag} walks among us now.\n\nFriend or foe? Only the dungeons will decide. ⚔️`,
  `🎮 *Player spawned.*\n\n@{tag} loaded into the world. Stats: unknown. Potential: limitless.\n\nStart your journey — */register [name]*`
];

const LEAVE_MSGS = [
  `💔 *The battlefield lost a soldier.*\n\n@{tag} has left. No fanfare. No explanation.\n\nJust an empty seat and a story that ends here.`,
  `🌑 *A light went out.*\n\n@{tag} departed. The server felt it.\n\nMay wherever they went treat them better than the dungeon did.`,
  `🚶 *They walked away without looking back.*\n\n@{tag} is gone. Some people know when to leave.\n\nRespect the exit.`,
  `❄️ *Gone cold.*\n\n@{tag} ghosted without a goodbye. No message. No warning.\n\nJust... gone. We'll pour one out.`,
  `💨 *Blink and you'd have missed it.*\n\n@{tag} vanished like smoke.\n\nThe void claims another.`,
  `🌊 *Returned to the sea.*\n\n@{tag} sailed off. The horizon swallowed them whole.\n\nFair winds, warrior. Fair winds.`,
  `🎭 *The curtain fell.*\n\n@{tag} left the stage.\n\nThe show continues without them.`,
  `⚡ *Signal lost.*\n\n@{tag} disconnected. The server grid has one fewer node.\n\nMaybe they'll respawn somewhere better.`,
  `🌌 *Returned to the void.*\n\n@{tag} faded. All things come and go.\n\nThe dungeon remembers everyone it loses.`,
  `🕯️ *The torch goes dark.*\n\n@{tag}'s flame is out.\n\nSomeone else will carry it now.`,
  `🏃 *No warning. No countdown.*\n\n@{tag} dipped. Clean exit.\n\nNot everyone needs a goodbye.`,
  `💀 *Name removed from the roster.*\n\n@{tag} has been erased from the active ranks.\n\nThe dungeon doesn't pause for departures.`,
  `🌙 *Last login: now.*\n\n@{tag} logged off and didn't come back.\n\nPeace to wherever they ended up.`,
  `📭 *An empty seat remains.*\n\n@{tag} left it behind. Someone else will fill it eventually.`,
  `🎲 *Cashed out.*\n\n@{tag} folded their hand and walked away from the table.\n\nSmart exit or early quit — only time will tell.`,
  `🗺️ *Left to find other realms.*\n\n@{tag} packed up and headed somewhere unknown.\n\nMay the dungeons out there be kinder.`,
  `🔇 *Silence where there was sound.*\n\n@{tag} went quiet. Permanently.\n\nThe server noticed the gap they left.`,
  `🎯 *Missed the mark and moved on.*\n\n@{tag} is gone.\n\nCome back when you're ready to aim again.`,
  `🌿 *Back to the wild.*\n\n@{tag} returned to wherever adventurers go when they disappear.`,
  `⚔️ *The sword is sheathed.*\n\n@{tag} chose to walk away from the fight.\n\nEvery warrior picks their battles. This one's done.`
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── onGroupJoin: dispatched by whichever bot is active in the group.
// All bots in the group receive the join event, but only the active one
// posts the group announcement. The welcome DM is sent separately after
// the user completes /register (see commands/rpg/register.js).
async function onGroupJoin(sock, personalityKey, chatId, participants, action) {
  // Single-sender design: GroupNoticeManager.announceMembership (called from
  // MultiSocketManager, event path + stub fallback with dedup) is now THE
  // only welcome/goodbye sender. This hook stays as a no-op so the
  // onGroupJoin option keeps working — joins must never double-send.
  return;
  if (action !== 'add' && action !== 'remove') return;
  const db = getDatabase();
  const settings = db.groupSettings?.[chatId];
  if (settings?.announcements === false) return;

  // For groups: only the active bot handles group announcements.
  // (Every bot receives the event, but only the active one actually
  // posts the message.)
  const activeKey = PersonalityManager.getActiveBot(chatId);
  if (activeKey && activeKey !== personalityKey) return; // not the active bot — stay silent

  for (const participant of participants) {
    const numStr  = participant.replace(/[^0-9]/g, '');
    const tag     = participant;
    const tagNum  = numStr;
    let text = '';
    const mentions = [participant];

    if (action === 'add') {
      if (numStr === CREATOR_ID) {
        text = pick(JOIN_NARUTO) + '\n\n@' + tagNum;
        try { await sock.sendMessage(chatId, { text, mentions }); } catch(e) { console.error('Greeting send error:', e.message); }
      } else if (numStr === COOWNER_ID) {
        text = pick(JOIN_COOWNER) + '\n\n@' + tagNum;
        try { await sock.sendMessage(chatId, { text, mentions }); } catch(e) { console.error('Greeting send error:', e.message); }
      } else {
        text = pick(JOIN_MSGS).replace('{tag}', tagNum);
        try { await sock.sendMessage(chatId, { text, mentions }); } catch(e) { console.error('Greeting send error:', e.message); }
      }
    } else {
      text = pick(LEAVE_MSGS).replace('{tag}', tagNum);
      try { await sock.sendMessage(chatId, { text, mentions }); } catch(e) { console.error('Leave msg send error:', e.message); }
    }
  }
}

// ── AstraLink API + Health check server ───────────────────────
const http = require('http');
const HEALTH_PORT = parseInt(process.env.PORT || '3000');

http.createServer(async (req, res) => {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Push #60: `req.url` still carries the query string, so every exact match below
  // was really "no query string allowed" — a pasted phone link like
  // `/astralink?personality=gojo` 404'd. Route on the path; handlers that want
  // the query parse it themselves. The Push #61 token era is over: no route
  // here reads a token anymore.
  let _path = req.url || '/';
  try { _path = new URL(_path, 'http://localhost').pathname; } catch (e) {}
  _path = _path.replace(/\/+$/, '') || '/';

  // ── Health check ──────────────────────────────────────
  if (req.method === 'GET' && _path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      botsConnected: Object.values(MultiSocketManager.getAllSockets() || {})
        .filter(s => s?.user?.id).length,
      uptime: process.uptime(),
    }));
  }

  // ── GET /api/bot-status ──────────────────────────────────────
  if (req.method === 'GET' && _path === '/api/bot-status') {
    try {
      const allSockets = MultiSocketManager.getAllSockets();
      const linkedJids = Object.keys(PersonalityManager.linkedNumbers || {});
      const bots = [];
      const _psAll = MultiSocketManager.listPairingSessions ? MultiSocketManager.listPairingSessions() : {};
      const seen = new Set();
      for (const jid of linkedJids) {
        const key = PersonalityManager.linkedNumbers[jid];
        if (seen.has(key)) continue;  // dedupe double-registered numbers
        seen.add(key);
        const displayName = PersonalityManager.getDisplayName(key);
        const connected = !!allSockets[key] && !!allSockets[key].user?.id;
        const botJid = connected ? (allSockets[key].user?.id || null) : null;

        let activeNow = false;
        try { activeNow = PersonalityManager.anyActive(key); } catch (e) {}
        bots.push({
          key, displayName,
          emoji: PersonalityManager.getPersonalityInfo(key)?.emoji || '🤖',
          theme: PersonalityManager.getPersonalityInfo(key)?.theme || 'Unknown',
          jid: botJid || jid, connected, active: activeNow,
          // A 403 is a block, not a dropped link — the page must say which.
          blocked: (_psAll[key] && _psAll[key].blocked) || null,
        });
      }

      const hostSock = MultiSocketManager.getHostSocket();
      const primaryConnected = !!hostSock && !!hostSock.user?.id;
      const primaryJid = primaryConnected ? hostSock.user?.id : null;
      const hostKey = MultiSocketManager.getHostKey();
      const primaryObj = {
        displayName: hostKey ? PersonalityManager.getDisplayName(hostKey) : 'No Active Host',
        connected: primaryConnected,
        jid: primaryJid,
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ primary: primaryObj, bots, total: bots.length, serverTime: Date.now() }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  // ── GET /api/personalities ───────────────────────────────────
  if (req.method === 'GET' && _path === '/api/personalities') {
    const personalities = PersonalityManager.getAllPersonalities()
      .map(k => PersonalityManager.getPersonalityInfo(k));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ personalities }));
  }

  // ── Push #31: GET /api/db-health (DB diagnostics, no Termux needed) ──
  if (req.method === 'GET' && _path === '/api/db-health') {
    try {
      const memUsers = Object.keys((typeof database !== 'undefined' && database.users) || {}).length;
      let jsonInfo = null;
      try {
        if (fs.existsSync(DB_PATH)) {
          const st = fs.statSync(DB_PATH);
          jsonInfo = { bytes: st.size, mtime: new Date(st.mtimeMs).toISOString(), ageSec: Math.round((Date.now() - st.mtimeMs) / 1000) };
          // Push #50: only parse the mirror when it is small enough to parse
          // cheaply. This endpoint used to read + JSON.parse the ENTIRE mirror
          // (multi-MB once avatars lived in it) on every poll — from the AstraLink
          // dashboard that is itself a source of the stall it was meant to debug.
          if (st.size <= 4 * 1024 * 1024) {
            try {
              const jd = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
              jsonInfo.users = Object.keys(jd.users || {}).length;
              jsonInfo.savedAt = jd.__savedAt ? new Date(jd.__savedAt).toISOString() : null;
            } catch (e) { jsonInfo.parseError = e.message; }
          } else {
            jsonInfo.users = memUsers;
            jsonInfo.note = 'mirror >4MB — skipped inline parse to keep the loop free; counts come from memory';
          }
        }
      } catch (e) { jsonInfo = { error: e.message }; }
      let mongoInfo = { configured: !!MONGO_URI, connected: !!mongoCollection };
      if (mongoCollection) {
        try {
          const doc = await mongoCollection.findOne({ _id: 'main' });
          const _d = _mirrorToDb(doc); // Push #66: schema or legacy shape
          mongoInfo.doc = doc ? {
            users: Object.keys((_d || {}).users || {}).length,
            savedAt: (_d && _d.__savedAt) ? new Date(_d.__savedAt).toISOString() : (doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null),
            userCount: doc.userCount !== undefined ? doc.userCount : null,
            botPush: doc.botPush !== undefined ? doc.botPush : null,
            schema: doc.doc !== undefined ? 'push66' : 'legacy',
          } : null;
        } catch (e) { mongoInfo.error = e.message; }
      }
      let snapInfo = null; // Push #32: snapshot ladder state
      try {
        const sd = _snapDir();
        const sfiles = fs.readdirSync(sd).filter(f => f.endsWith('.json')).sort();
        snapInfo = { count: sfiles.length, newest: sfiles[sfiles.length - 1] || null };
      } catch { snapInfo = null; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        ok: true, uptime: process.uptime(), bootUsers: _bootUsers, bootHealth: _bootHealth,
        memUsers, dataDir: DATA_DIR, authDir: AUTH_DIR, dbPath: DB_PATH,
        // Push #50: live perf readout (loop lag, serialize cost, write count and
        // the saveDatabase()-calls-per-write ratio — the last one is how you can
        // tell the coalescer is doing its job).
        perf: (() => { try { return PerfMonitor.snapshot(); } catch (e) { return { error: e.message }; } })(),
        blobs: (() => {
          try {
            const BlobStore = require('./rpg/utils/BlobStore');
            return { dir: BlobStore.root(), inlineBytesInDoc: BlobStore.inlineBlobBytes(database) };
          } catch (e) { return { error: e.message }; }
        })(),
        lastOwnerSnapAt: database.__lastOwnerSnapAt || null,
        snapshots: snapInfo,
        mongo: mongoInfo, json: jsonInfo,
        // Push #65: the new live store + QuickDB update state
        sqlite: (() => { try { return Storage.info(); } catch (e) { return { available: false, error: e.message }; } })(),
        updates: await Updates.getUpdateInfo(),
        serverTime: Date.now(),
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }

  // ── Push #81: OPS endpoints (password = link password, ?key=…) ─────────
  // /api/logs        → last 400 console lines (text)
  // /api/trace       → per-bot inbound trace (received / handled / drop reasons)
  // /api/restart     → graceful shutdown → docker restarts the container
  // /version         → VERSION file + process uptime
  if (req.method === 'GET' && _path === '/version') {
    let v = 'unknown'; try { v = fs.readFileSync(path.join(__dirname, 'VERSION'), 'utf-8').trim(); } catch (e) { try { v = require('./package.json').version; } catch (e2) {} }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ version: v, uptimeSec: Math.round(process.uptime()), bootedAt: new Date(_BOOT_AT).toISOString(), pid: process.pid, node: process.version, memMB: Math.round(process.memoryUsage().rss / 1048576) }));
  }
  if (_path === '/api/logs' || _path === '/api/trace' || _path === '/api/restart') {
    if (!_opsAuthed(req)) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'unauthorized — add ?key=<link password>' })); }
    if (_path === '/api/logs') {
      let n = 400; try { n = Math.min(400, Math.max(20, parseInt(new URL(req.url, 'http://localhost').searchParams.get('n') || '400', 10) || 400)); } catch (e) {}
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(`# pid ${process.pid} up ${Math.round(process.uptime())}s booted ${new Date(_BOOT_AT).toISOString()}\n` + _logRing.slice(-n).join('\n'));
    }
    if (_path === '/api/trace') {
      let tr = {}; try { tr = MultiSocketManager.getInboundTrace ? MultiSocketManager.getInboundTrace() : {}; } catch (e) {}
      const socks = MultiSocketManager.getAllSockets() || {};
      const bots = {};
      for (const k of new Set([...Object.keys(socks), ...Object.keys(tr)])) {
        const sck = socks[k];
        bots[k] = { connected: !!(sck && sck.user && sck.user.id), ws: (() => { try { return sck && sck.ws ? sck.ws.readyState : null; } catch (e) { return null; } })(), ...(tr[k] || {}) };
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ uptimeSec: Math.round(process.uptime()), bots }, null, 2));
    }
    if (_path === '/api/restart') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, note: 'graceful shutdown in 1s — container restarts automatically' }));
      console.log('🔁 /api/restart requested via HTTP');
      setTimeout(() => gracefulShutdown('HTTP restart'), 1000);
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));

// Push #37: the HTTP port is the single-instance lock — EADDRINUSE means a
// live copy already runs, so a would-be ghost MUST die here instead of
// booting empty and poisoning the JSON mirror (the 02:00 incident).
}).listen(HEALTH_PORT, () => {
  console.log(`🌐 API server on port ${HEALTH_PORT} (ops endpoints only — pairing is via /link, QR in console)`);
}).on('error', (e) => {
  if (e && e.code === 'EADDRINUSE') {
    console.error(`🛡️ Another bot instance already holds port ${HEALTH_PORT} — refusing to start (no ghost writes).`);
    process.exit(1);
  }
  console.error('API server error:', e && e.message);
});
// ─────────────────────────────────────────────────────────────

// ── Crash protection ───────────────────────────────────────────
let _unhandledCount = 0;
let _lastUnhandledLog = 0;

// Batch-47 CRITICAL: synchronous JSON snapshot. Sync (not queued) so it
// CANNOT be lost no matter how the process dies next.
function saveDatabaseSyncNow(reason) {
  try {
    // Push #37: an empty/stale second process must never cement over the file
    // (the 02:00 ghost's kill-shot). Fail-open on unreadable files; allow a
    // 1-user race (a legit /hakai seconds before SIGTERM) so deletions stick.
    const _memSd = Object.keys(database.users || {}).length;
    try {
      if (fs.existsSync(DB_PATH)) {
        const _f = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        const _fu = Object.keys(_f.users || {}).length;
        if ((_memSd === 0 && _fu > 0) || (_fu - _memSd >= 2)) {
          console.error(`🛡️ Sync snapshot SKIPPED (${reason}): memory has ${_memSd} users, file has ${_fu} — refusing to shrink the mirror.`);
          return false;
        }
      }
    } catch (_) { /* fail-open: unreadable file → proceed */ }
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(database));
    try { Storage.save(database); } catch (e) {} // Push #65: crash-safe live store too
    console.log(`💾 Sync DB snapshot written (${reason || 'manual'})`);
    return true;
  } catch (e) {
    console.error('❌ Sync DB snapshot failed:', e.message);
    return false;
  }
}

process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION — saving DB before crash:', err);
  try { saveDatabase(); } catch(e) { console.error('DB save on crash failed:', e); }
  saveDatabaseSyncNow('uncaughtException');
});

// Batch-47 CRITICAL: hosts (Railway/PM2) stop bots with SIGTERM. There was
// NO handler, so every restart/death silently dropped the last minutes of
// progress. Now: cancel the mongo debounce, force one final Mongo write
// (10s cap), take a sync JSON snapshot, THEN exit.
let _shuttingDown = false;
async function gracefulShutdown(signal) {
  if (_shuttingDown) return;
  _shuttingDown = true;
  console.log(`🛑 ${signal} received — flushing database before exit...`);
  try { if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; } } catch (e) {}
  try {
    if (pendingMongoWrite) {
      await Promise.race([pendingMongoWrite, new Promise((r) => setTimeout(r, 8000))]);
    }
  } catch (e) {}
  try {
    // Push #31: same empty-DB protection on the shutdown flush.
    const _memUsersSd = Object.keys(database.users || {}).length;
    if (_mongoArmed && (_memUsersSd > 0 || _bootUsers === 0)) { // Push #33: never flush unverified
    if (mongoCollection) {
      await Promise.race([
        mongoCollection.replaceOne({ _id: 'main' }, _mirrorDocToWrite(), { upsert: true }), // Push #66: schema shape
        new Promise((_, rej) => setTimeout(() => rej(new Error('final mongo flush timeout')), 10000)),
      ]);
      console.log('💾 Final MongoDB flush complete.');
    }
    } else {
      console.error(`🛡️ Shutdown Mongo flush SKIPPED: refusing to overwrite ${_bootUsers} users with an empty/unverified DB.`);
    }
  } catch (e) {
    console.error('❌ Final MongoDB flush failed:', e.message);
  }
  saveDatabaseSyncNow(signal);
  try { Storage.close(); } catch (e) {}      // Push #65
  try { await Updates.close(); } catch (e) {} // Push #65
  try { if (mongoClient) await mongoClient.disconnect(); } catch (e) {} // Push #66: mongoose
  process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  _unhandledCount++;
  const now = Date.now();
  if (now - _lastUnhandledLog > 30_000) {
    console.error(`⚠️  [SILENT unhandledRejection] total in last window: ${_unhandledCount}`);
    console.error('   Reason:', reason);
    _lastUnhandledLog = now;
    _unhandledCount = 0;
  } else {
    _unhandledCount++;
  }
});

// Auto-save every 2 minutes
setInterval(saveDatabase, 2 * 60 * 1000);

// Daily quest reset — timezone-aware (BOT_TIMEZONE, default Africa/Lagos/WAT)
const { getWATDayKey, ensureDailyQuests } = require('./rpg/utils/DailyQuestSystem');
const TimeUtil = require('./rpg/utils/TimeUtil');
let _lastWATDayKey = getWATDayKey();

function _wipeAndReseedAllDailyQuests() {
  if (database.dailyQuests) {
    for (const uid of Object.keys(database.dailyQuests)) {
      const entry = database.dailyQuests[uid];
      if (!entry || entry.dayKey !== _lastWATDayKey) {
        delete database.dailyQuests[uid];
      }
    }
  }
  let reseeded = 0;
  for (const uid of Object.keys(database.users || {})) {
    const player = database.users[uid];
    if (!player) continue;
    if (!player.dailyQuests || player.dailyQuests.dayKey !== _lastWATDayKey) {
      const streak = player.dailyQuests?.streak || 0;
      const milestones = player.dailyQuests?.milestones || [];
      player.dailyQuests = { streak, milestones, dayKey: null, quests: [] };
      const refreshed = ensureDailyQuests(player);
      if (refreshed) reseeded++;
    }
  }
  return reseeded;
}

function _scheduleNextWATMidnight() {
  const utcMs = Date.now();
  const nextMidnightUTC = TimeUtil.nextMidnight(TimeUtil.DEFAULT_TZ, utcMs);
  const waitMs = nextMidnightUTC - utcMs;
  const safeWait = Math.max(60_000, Math.min(waitMs, 24 * 60 * 60 * 1000));
  console.log(`⏰ Next local-midnight refresh (${TimeUtil.DEFAULT_TZ}) in ${Math.round(safeWait/60000)} min (at ${new Date(nextMidnightUTC).toISOString().replace('T', ' ').slice(0, 16)} UTC)`);
  setTimeout(() => {
    _lastWATDayKey = getWATDayKey();
    const count = _wipeAndReseedAllDailyQuests();
    console.log(`🌅 WAT midnight! Re-seeded daily quests for ${count} players`);
    try {
      if (database.community?.main_groupId) {
        MultiSocketManager.getAnySocket()?.sendMessage(database.community.main_groupId, {
          text: '🌅 *DAILY QUEST REFRESH!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nNew 4 quests for today — /quest daily to see them!\n\n💡 Quests auto-complete as you play and rewards are granted instantly.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        }).catch(()=>{});
      }
    } catch(e) {}
    saveDatabase();
    _scheduleNextWATMidnight();
  }, safeWait);
}

// Push #56 — the Weekly Guild War now closes on a timer AND announces its
// victory card. Before this, resolution only happened when somebody happened to
// earn GP or open /guildwar, and even then the 🥇🥈🥉 cards were dropped into
// inventories in total silence — so winners never saw a victory card.
let _lastWarWeekKey = null;
function _announceWeeklyWarIfClosed() {
  try {
    const WGW = require('./rpg/utils/WeeklyGuildWar');
    const week = WGW.getWeekKey();
    const stale = database.guildWarWeekly && database.guildWarWeekly.currentWeek && database.guildWarWeekly.currentWeek !== week;
    if (!stale) { _lastWarWeekKey = week; return; }
    _lastWarWeekKey = week;
    const summary = WGW.checkWeeklyReset(database, saveDatabase);
    if (!summary) return;
    const text = WGW.buildResultsCard(summary, database);
    if (!text) { console.log('🏆 Weekly Guild War resolved (no podium to announce)'); return; }
    const targets = [...new Set([
      database.announceGC,
      database.community && database.community.main_groupId,
    ].filter(Boolean))];
    const sock = MultiSocketManager.getAnySocket ? MultiSocketManager.getAnySocket() : MultiSocketManager.getHostSocket();
    if (!sock || !targets.length) {
      console.log('🏆 Weekly Guild War resolved — no announcement target/socket yet (results are stored, /guildwar shows them)');
      return;
    }
    for (const jid of targets) {
      try { Promise.resolve(sock.sendMessage(jid, { text })).catch(() => {}); } catch (e) {}
    }
    for (const g of [summary.first, summary.second, summary.third]) {
      if (g) console.log(`🏆 ${g.name}: ${g.granted}/${g.size} victory card(s) granted (${g.gp} GP)`);
    }
    if (summary.mvp) console.log(`⭐ Weekly MVP: ${summary.mvp.name} (${summary.mvp.gp} GP)`);
    saveDatabase();
  } catch (e) {
    console.error('weekly war scheduler error:', e.message);
  }
}
setInterval(_announceWeeklyWarIfClosed, 10 * 60 * 1000).unref?.();

setInterval(() => {
  const currentKey = getWATDayKey();
  if (currentKey !== _lastWATDayKey) {
    _lastWATDayKey = currentKey;
    const count = _wipeAndReseedAllDailyQuests();
    console.log(`🌅 WAT day-key changed → re-seeded daily quests for ${count} players`);
    saveDatabase();
  }
}, 60 * 1000);

// Out-of-battle passive HP + energy regeneration (rates are per SECOND and the
// manager computes from elapsed time, so the TICK interval only controls how fast
// the numbers visibly move — it does not change how much a player recovers).
// Push #47: 5s → 10s, with a cheap pre-filter so healthy players cost nothing.
// The old loop ran a full in-battle check (which walks every active gate) for
// every single player, twice a second, for every bot.
let _regenMod = null;
setInterval(() => {
  try {
    if (!database?.users) return;
    if (!_regenMod) _regenMod = require('./rpg/utils/RegenManager');
    for (const uId in database.users) {
      const u = database.users[uId];
      if (!u || !u.stats) continue;
      const hurt = (u.stats.hp || 0) < (u.stats.maxHp || 0);
      const thirsty = typeof u.stats.energy === 'number' && (u.stats.energy || 0) < (u.stats.maxEnergy || 0);
      const locked = u.regenLockUntil && u.regenLockUntil > Date.now();
      // Nothing to do and no lock to clear → skip the expensive in-battle scan.
      if (!hurt && !thirsty && !locked) { u.lastRegenTime = Date.now(); u.lastEnergyRegenTime = Date.now(); continue; }
      _regenMod.applyPassiveRegen(u, database);
    }
  } catch (e) { /* never let the regen tick take the bot down */ }
}, 10000);

// Push #47: event-loop lag watchdog (logs when something blocks the loop).
setInterval(() => { try { PerfMonitor.tick(); } catch (e) {} }, 1000).unref?.();

setTimeout(() => {
  const count = _wipeAndReseedAllDailyQuests();
  if (count > 0) console.log(`📋 Initial daily quest re-seed on startup: ${count} players`);
  _scheduleNextWATMidnight();
}, 10_000);

// Bank interest — check every 6 hours, pay monthly
setInterval(() => {
  if (!database.banks) return;
  const BankingSystem = require('./rpg/banking/BankingSystem');
  let paid = 0;
  for (const bankId in database.banks) {
    const result = BankingSystem.collectMonthlyInterest(database, bankId);
    if (result.success && result.interest > 0) {
      const bank = database.banks[bankId];
      const owner = database.users[bank.owner];
      if (owner) {
        owner.gold = (owner.gold || 0) + result.interest;
        console.log(`🏦 Bank interest paid: ${result.interest}g to ${owner.name} (${bank.name})`);
        paid++;
      }
    }
  }
  if (paid > 0) saveDatabase();
}, 6 * 60 * 60 * 1000);

setTimeout(() => {
  if (!database.seasonStart) {
    database.seasonStart = Date.now();
    saveDatabase();
    console.log('📅 Season 1 started');
  }
}, 3000);

setInterval(() => {
  if (!database.afkUsers) return;
  const now = Date.now();
  const AFK_EXPIRE_MS = 8 * 60 * 60 * 1000;
  let expired = 0;
  for (const [userId, afk] of Object.entries(database.afkUsers)) {
    if (now - afk.since > AFK_EXPIRE_MS) {
      delete database.afkUsers[userId];
      expired++;
    }
  }
  if (expired > 0) {
    saveDatabase();
    console.log(`🧹 Auto-cleared ${expired} expired AFK status(es)`);
  }
}, 30 * 60 * 1000);

// ── Bot scheduler: every bot handles RPG commands + AI chat ─────────
// Push #82: one place builds a bot's boot options, so bots started later via
// /link (DM) or the heartbeat get the SAME command handler as bots booted here.
function buildBotOptions(personalityKey) {
  return {
    rpgCommandHandler,
    onGroupJoin: async (sock, chatId, participants, action) => {
      await onGroupJoin(sock, personalityKey, chatId, participants, action);
    },
  };
}
try { MultiSocketManager.setBootOptionsFactory(buildBotOptions); } catch (e) {}

function startBotScheduler(personalityKey) {
  // Each bot's connectBot call passes an `onGroupJoin` callback that
  // knows the bot's personalityKey, so the join handler can filter out
  // non-active bots (preventing multiple welcome messages).
  MultiSocketManager.connectBot(personalityKey, AUTH_DIR, getDatabase, saveDatabase, buildBotOptions(personalityKey)).then(sock => {
    // Per-bot init: regen system (any bot that connects, runs it)
    try {
      RegenManager.initAllPlayers(getDatabase, saveDatabase, sock);
      const playerCount = Object.keys(database.users || {}).length;
      console.log(`🌟 Regen system ready (${personalityKey}, ${playerCount} players)`);
    } catch (error) {
      console.error('❌ Failed to initialize regeneration:', error.message);
    }

    // Per-bot init: start gate spawning for every group that has /set spawn --true.
    // Idempotent (one timer per chat). Uses the bot's own socket.
    try {
      const GateSpawner = require('./handlers/gateSpawner');
      const spawns = (database.gateSpawns || {});
      for (const [chatId, enabled] of Object.entries(spawns)) {
        if (enabled && chatId.endsWith('@g.us')) {
          GateSpawner.initialize(sock, chatId, getDatabase, saveDatabase);
        }
      }
    } catch (e) {
      console.error('❌ GateSpawner bootstrap error:', e.message);
    }
    // Push #87: Pro GC 5h epic spawn loop (idempotent per chat).
    try { require('./rpg/utils/ProGC').bootAll(sock, getDatabase, saveDatabase); } catch (e) { console.error('❌ ProGC bootstrap error:', e.message); }
  }).catch(err => {
    console.error(`❌ Failed to start bot [${personalityKey}]:`, err.message);
  });
}

// ========================================
// BOOT ALL CONFIGURED BOTS
// ========================================
async function startup() {
  const mongoOk = await connectMongo();
  // ── Push #23: freshest-wins persistence ──────────────────────────
  // Mongo and JSON are both mirrors; boot loads whichever is NEWER so a
  // stale/failed mirror can never wipe live data again.
  let mongoDoc = null;
  if (mongoOk) mongoDoc = await loadFromMongoDoc();
  let jsonDoc = null, jsonAt = 0;
  try {
    if (fs.existsSync(DB_PATH)) {
      jsonDoc = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      try { jsonAt = jsonDoc.__savedAt || fs.statSync(DB_PATH).mtimeMs; } catch { jsonAt = jsonDoc.__savedAt || 0; }
    }
  } catch (e) {
    console.error('⚠️  JSON database unreadable, ignoring:', e.message);
    jsonDoc = null;
  }
  // Push #65: SQLite is the LIVE copy. Mongo + JSON are backup mirrors, and
  // the fuller-wins invariant is preserved at the new top of the stack: if a
  // backup holds MORE users than SQLite, adopt the backup and RESEED SQLite.
  const sqliteDoc = Storage.load();
  const _selSu = sqliteDoc ? Object.keys(sqliteDoc.users || {}).length : -1;
  const sqliteAt = (sqliteDoc && sqliteDoc.__savedAt) || 0;
  const mongoAt = (mongoDoc && mongoDoc.__savedAt) || 0;
  const _kb = (d) => { try { return Math.round(Buffer.byteLength(JSON.stringify(d)) / 1024); } catch { return 0; } };
  const _fmtT = (t) => t ? new Date(t).toISOString() : 'none';
  // Push #37: load the FULLER side (count wins; timestamp breaks ties). Time
  // alone let a newer-but-emptier JSON beat a fuller Mongo — the 02:00 boot
  // loaded 0 users over Mongo's 4.
  const _selMu = mongoDoc ? Object.keys(mongoDoc.users || {}).length : -1;
  const _selJu = jsonDoc ? Object.keys(jsonDoc.users || {}).length : -1;
  let _loadedFrom = 'fresh';
  const _mongoWins = mongoDoc && ((_selMu > _selJu) || (_selMu === _selJu && mongoAt >= jsonAt));
  const _backupDoc = _mongoWins ? mongoDoc : jsonDoc;
  const _backupUsers = _backupDoc ? Object.keys(_backupDoc.users || {}).length : -1;
  if (sqliteDoc) {
    if (_backupDoc && _backupUsers > _selSu) {
      // Divergence: a backup mirror is FULLER than the live store — adopt it.
      _loadedFrom = _mongoWins ? 'mongo' : 'json';
      _pendingOwnerAlarms.push(`🛡️ *SQLITE DIVERGED AT BOOT* 🛡️\n\n${_mongoWins ? 'Atlas' : 'JSON'} holds ${_backupUsers} users but the SQLite live store has ${_selSu}. I adopted the fuller backup and reseeded SQLite — your data is safe on both sides.\n\nBoot: ${new Date().toISOString()}`);
      loadDatabase(_backupDoc); // same normalization as every other path
      try { Storage.save(database); } catch (e) {}
      console.log(`✅ Database loaded from ${_mongoWins ? 'MongoDB' : 'JSON'} (fuller than SQLite) — live store reseeded`);
    } else {
      _loadedFrom = 'sqlite';
      loadDatabase(sqliteDoc); // runs the exact same boot normalization as the file path
      console.log(`✅ Database loaded from SQLite live store (${Object.keys(database.users || {}).length} players)`);
      console.log(`💾 Persistence: SQLite ${_kb(sqliteDoc)}KB (@${_fmtT(sqliteAt)}) vs Mongo ${_kb(mongoDoc)}KB (@${_fmtT(mongoAt)}) vs JSON ${_kb(jsonDoc)}KB (@${_fmtT(jsonAt)}) → loaded SQLITE`);
    }
    if (mongoOk) await saveToMongo(); // keep the off-host mirror current
  } else if (_mongoWins) {
    _loadedFrom = 'mongo';
    database = mongoDoc;
    console.log(`✅ Database loaded from MongoDB (${Object.keys(database.users || {}).length} players)`);
    console.log(`💾 Persistence: Mongo ${_kb(mongoDoc)}KB (@${_fmtT(mongoAt)}) vs JSON ${_kb(jsonDoc)}KB (@${_fmtT(jsonAt)}) → loaded MONGO`);
    try { if (Storage.save(database)) console.log(`🗄️ SQLite live store seeded from MongoDB (${_selMu} players)`); } catch (e) {}
  } else if (jsonDoc) {
    _loadedFrom = 'json';
    loadDatabase(); // re-reads the same file + runs migrations
    console.log(`💾 Persistence: Mongo ${_kb(mongoDoc)}KB (@${_fmtT(mongoAt)}) vs JSON ${_kb(jsonDoc)}KB (@${_fmtT(jsonAt)}) → loaded JSON`);
    try { if (Storage.save(database)) console.log(`🗄️ SQLite live store seeded from JSON (${_selJu} players)`); } catch (e) {}
    if (!mongoDoc && mongoOk) console.log('📦 Migrated existing JSON data to MongoDB!');
    await saveToMongo(); // heal the mirror with the fresh state
  } else {
    console.log('💾 Persistence: no SQLite doc, no Mongo doc, no JSON file → starting FRESH');
    // Push #31: leave a marker so an empty boot is provable after the fact.
    try {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(path.join(path.dirname(DB_PATH), `empty-boot-${Date.now()}.marker`),
        `fresh boot at ${new Date().toISOString()} — no SQLite doc, no Mongo doc, no JSON file`);
    } catch {}
  }
  // Push #31: baseline for the write-path guard below.
  try { _bootUsers = Object.keys(database.users || {}).length; _bootAt = Date.now(); } catch {}
  // Push #32: snapshot both mirrors at boot (before anything can mutate them).
  try { if (mongoDoc) writeDbSnapshot('boot-mongo', mongoDoc); } catch {}
  try { if (jsonDoc) writeDbSnapshot('boot-json', jsonDoc); } catch {}
  try { pruneSnapshots(); } catch {}
  // Push #32: degraded-boot detection → owner alarm (flushed when a socket is up).
  _bootHealth = { mongoOk: !!mongoOk, hadSqliteDoc: !!sqliteDoc, hadMongoDoc: !!mongoDoc, hadJsonDoc: !!jsonDoc, fresh: (!sqliteDoc && !mongoDoc && !jsonDoc) };
  _bootHealth.loadedFrom = _loadedFrom; // Push #37: prove the selection remotely
  _bootHealth.mongoUsers = _selMu;
  _bootHealth.jsonUsers = _selJu;
  _bootHealth.sqliteUsers = _selSu;   // Push #65: prove the live-store selection remotely
  // Push #65: record this boot in QuickDB (push version, boot count, prev→now).
  Updates.recordBoot().catch(() => {});
  // Push #33: mirrors disagreed at boot → alarm (loser already snapshotted above).
  try {
    const _mu = mongoDoc ? Object.keys(mongoDoc.users || {}).length : -1;
    const _ju = jsonDoc ? Object.keys(jsonDoc.users || {}).length : -1;
    if (_mu >= 0 && _ju >= 0 && _mu !== _ju) {
      _bootHealth.disagree = { mongoUsers: _mu, jsonUsers: _ju };
      _pendingOwnerAlarms.push(`⚠️ *MIRRORS DISAGREED AT BOOT* ⚠️\n\nAtlas: ${_mu} users · JSON: ${_ju} users. Kept the fuller side; the other is preserved in snapshots/boot-*.json.\n\nBoot: ${new Date().toISOString()}`);
    }
  } catch {}
  if (!sqliteDoc && !mongoDoc && !jsonDoc) {
    _pendingOwnerAlarms.push(`🔥 *BOT BOOTED FRESH — NO DATA FOUND* 🔥\n\nNo Mongo doc and no JSON file at boot. If you expected data, avoid saves and investigate mirrors first.\n\nBoot: ${new Date().toISOString()}`);
  } else if (!mongoOk) {
    _pendingOwnerAlarms.push(`⚠️ *BOT BOOTED WITHOUT MONGO* ⚠️\n\nRunning on the JSON mirror only. The off-host copy is stale until Mongo reconnects.\n\nBoot: ${new Date().toISOString()}`);
  }

  // Push #35: repair already-registered blessed players to their guaranteed rank.
  try {
    const _fixed = require('./commands/rpg/register')._repairBlessedRanks(database);
    if (_fixed > 0) { console.log(`🛠️ Repaired ${_fixed} blessed rank(s).`); saveDatabase(); }
  } catch (e) { console.error('blessed-rank repair failed:', e.message); }

  // ── Push #23: evict auth backups from the game DB (moved to disk) ──
  try {
    const dbNow = getDatabase();
    if (dbNow && dbNow.authBackups && Object.keys(dbNow.authBackups).length > 0) {
      const keys = Object.keys(dbNow.authBackups);
      let freed = 0;
      try { freed = Buffer.byteLength(JSON.stringify(dbNow.authBackups)); } catch {}
      // Mirror each backup to disk first (best effort) so nothing is lost.
      try {
        const bdir = path.join(AUTH_DIR, '..', 'auth-backups');
        fs.mkdirSync(bdir, { recursive: true });
        for (const k of keys) {
          try {
            const f = path.join(bdir, k + '.json');
            if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify({ files: (dbNow.authBackups[k] && dbNow.authBackups[k].files) || {}, updatedAt: (dbNow.authBackups[k] && dbNow.authBackups[k].updatedAt) || Date.now() }));
          } catch {}
        }
      } catch {}
      delete dbNow.authBackups;
      saveDatabase();
      console.log(`🧹 Moved auth backups out of game DB → disk (freed ${(freed / 1048576).toFixed(1)}MB, bots: ${keys.join(',')}). Mongo mirror unblocked.`);
    }
  } catch (e) {
    console.error('authBackups migration error:', e.message);
  }

  GateKeyManager.loadFromDB(getDatabase());
  console.log('🚪 GateKeyManager loaded');

  // Batch-50: revive persisted gates/raids into memory so a redeploy
  // resumes exactly where it stopped (no forgotten gates or raids).
  try {
    const { GateManager } = require('./rpg/dungeons/GateManager');
    GateManager.rehydrateFromDb(getDatabase());
  } catch (e) {
    console.error('⚠️ Could not rehydrate gates:', e.message);
  }

  // Restore per-group active/present bot choices so a redeploy/restart does
  // NOT silently reset which bot each group is on (the "bots switched on
  // their own after redeploy" bug). Only /start or /switch changes a group's
  // active bot; those choices persist in the DB.
  try {
    PersonalityManager.bindPersistence(getDatabase, saveDatabase);
    PersonalityManager.loadPersisted();
    console.log('👑 Active/present bot mappings restored from DB');
  } catch (e) {
    console.error('⚠️ Could not restore personality mappings:', e.message);
  }

  // ── Offline 3-Day Database Backup & Daily Item Spawner Schedulers ────
  try {
    const OfflineBackupManager = require('./rpg/utils/OfflineBackupManager');
    OfflineBackupManager.startScheduler(getDatabase, saveDatabase);
    console.log('🔒 Offline 3-day database backup scheduler initialized');

    const DailyItemSpawner = require('./handlers/itemSpawner');
    DailyItemSpawner.startScheduler(MultiSocketManager, getDatabase, saveDatabase);
    console.log('📦 Daily item spawner scheduler initialized');
  } catch (e) {
    console.error('⚠️ Scheduler init error:', e.message);
  }

  // Push #32: owner notice loop (alarms + daily snapshot DM).
  setTimeout(() => { try { flushOwnerLoop(); } catch {} }, 45_000);
  setInterval(() => { try { flushOwnerLoop(); } catch {} }, 60_000);
  setInterval(() => {
    try {
      GateKeyManager.checkExpiredKeys(null, getDatabase(), saveDatabase);
    } catch(e) {
      console.error('Gate key expiry check error:', e.message);
    }
  }, 30 * 60 * 1000);

  // ── Weekly guild-hire contract payouts ────────────────────────────────
  // Auto-deducts each active contract's weekly wage from the guild treasury
  // and pays the hired hunter once per elapsed week.
  setInterval(() => {
    try {
      const CM = require('./rpg/utils/GuildContractManager');
      const db = getDatabase();
      let any = false;
      for (const guildId of Object.keys(db.guilds || {})) {
        const res = CM.processWeeklyPay(db, guildId, null);
        if (res.length) any = true;
      }
      if (any) saveDatabase();
    } catch(e) {
      console.error('Guild contract payout error:', e.message);
    }
  }, 60 * 60 * 1000); // Push #87: hourly (was 6h) — idempotent, catches up elapsed weeks
  // Push #87: also run once shortly after boot so a restart never delays payday.
  setTimeout(() => {
    try {
      const CM = require('./rpg/utils/GuildContractManager');
      const db = getDatabase();
      let any = false;
      for (const guildId of Object.keys(db.guilds || {})) { if (CM.processWeeklyPay(db, guildId, null).length) any = true; }
      if (any) saveDatabase();
    } catch (e) { console.error('Guild contract boot payout error:', e.message); }
  }, 90 * 1000);

  // ── Spawn ALL configured bots in parallel ─────────────────────
  // No "primary" or "secondary" — every bot is equal. We boot every bot that
  // is either (a) configured via a BOT_* env var OR (b) already linked through
  // AstraLink (has a saved auth session). This reconciles the two ways bots
  // get set up, so bots linked on the website still reconnect after a restart
  // and don't show as "dormant".
  const ALL_PERSONALITY_KEYS = PersonalityManager.getAllPersonalities();
  const linkedKeys = [];
  for (const key of ALL_PERSONALITY_KEYS) {
    if (process.env['BOT_' + key.toUpperCase()]) linkedKeys.push(key);
  }

  // Push #82: BOT_BOOT_KEYS=hinata,mikasa forces the exact boot list (no
  // creds.json needed — an empty folder boots to a QR). BOT_NO_AUTH_RESTORE=1
  // disables the backup restore below AND purges db.authBackups, so a wiped,
  // corrupt (Bad MAC) session can never resurrect itself from Mongo.
  const _forcedBoot = String(process.env.BOT_BOOT_KEYS || '').split(/[,\s]+/).map((k) => k.trim().toLowerCase()).filter((k) => k && ALL_PERSONALITY_KEYS.includes(k));
  const _noRestore = /^(1|true|yes)$/i.test(String(process.env.BOT_NO_AUTH_RESTORE || ''));
  if (_noRestore) {
    try {
      const dbNR = getDatabase();
      if (dbNR && dbNR.authBackups) { delete dbNR.authBackups; saveDatabase(); console.log('🧹 BOT_NO_AUTH_RESTORE: purged db.authBackups'); }
      const bdir = path.join(AUTH_DIR, '..', 'auth-backups');
      if (fs.existsSync(bdir)) { fs.rmSync(bdir, { recursive: true, force: true }); console.log('🧹 BOT_NO_AUTH_RESTORE: removed auth-backups/'); }
    } catch (e) { console.error('BOT_NO_AUTH_RESTORE purge error:', e.message); }
  }
  if (_forcedBoot.length) {
    for (const k of _forcedBoot) { try { fs.mkdirSync(path.join(AUTH_DIR, k), { recursive: true }); } catch (e) {} }
    // Push #85: BOT_BOOT_KEYS is the MINIMUM, not the ceiling. Any bot that was
    // linked later via /link has a registered creds.json on disk — it must come
    // back after /restart hard too, otherwise "all 20 bots" silently shrinks to
    // the env list every reboot.
    for (const key of ALL_PERSONALITY_KEYS) {
      if (_forcedBoot.includes(key)) continue;
      try {
        const cf = path.join(AUTH_DIR, key, 'creds.json');
        if (!fs.existsSync(cf)) continue;
        const c = JSON.parse(fs.readFileSync(cf, 'utf8'));
        if (c && (c.registered || c.me?.id)) _forcedBoot.push(key);
      } catch (e) {}
    }
    console.log(`🤖 BOT_BOOT_KEYS set — booting: ${_forcedBoot.join(', ')} (env list + every registered session on disk)`);
    for (const key of _forcedBoot) {
      startBotScheduler(key);
      await new Promise(r => setTimeout(r, 1500));
    }
    console.log('✅ All bots startup initiated (forced list)');
    return;
  }

  // ── RESTORE PERSISTED AUTH ──────────────────────────────────────
  // If auth files are gone, restore each backed-up personality from the
  // disk backups (current scheme) or legacy DB backups, before checking disk.
  try {
    if (_noRestore) throw new Error('BOT_NO_AUTH_RESTORE set — skipping auth restore');
    const dbTmp = getDatabase();
    const diskBackups = {};
    try {
      const bdir = path.join(AUTH_DIR, '..', 'auth-backups');
      if (fs.existsSync(bdir)) {
        for (const f of fs.readdirSync(bdir)) {
          if (!f.endsWith('.json')) continue;
          const key = f.slice(0, -5);
          if (!ALL_PERSONALITY_KEYS.includes(key)) continue;
          try { diskBackups[key] = JSON.parse(fs.readFileSync(path.join(bdir, f), 'utf8')); } catch {}
        }
      }
    } catch {}
    const allBackups = { ...((dbTmp && dbTmp.authBackups) || {}), ...diskBackups };
    {
      for (const key of Object.keys(allBackups)) {
        if (!ALL_PERSONALITY_KEYS.includes(key)) continue;
        const authDir = path.join(AUTH_DIR, key);
        const credsFile = path.join(authDir, 'creds.json');
        if (!fs.existsSync(credsFile)) {
          try {
            const backup = allBackups[key];
            if (backup?.files && Object.keys(backup.files).length > 0) {
              fs.mkdirSync(authDir, { recursive: true });
              for (const [rel, b64] of Object.entries(backup.files)) {
                const full = path.join(authDir, rel);
                fs.mkdirSync(path.dirname(full), { recursive: true });
                fs.writeFileSync(full, Buffer.from(b64, 'base64'));
              }
              console.log(`♻️  [startup] Restored auth for [${key}] from backup`);
            }
          } catch (e) {
            console.error(`⚠️  [startup] restore failed for [${key}]:`, e.message);
          }
        }
      }
    }
  } catch (e) {
    console.error('startup restore error:', e.message);
  }

  // Also include any personality with a saved, registered AstraLink session or DB backup
  for (const key of ALL_PERSONALITY_KEYS) {
    const authDir = path.join(AUTH_DIR, key);
    const credsFile = path.join(authDir, 'creds.json');
    try {
      if (fs.existsSync(credsFile)) {
        const creds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
        if (creds && (creds.registered || creds.me)) {
          if (!linkedKeys.includes(key)) linkedKeys.push(key);
        }
      }
    } catch (e) {}
  }

  // Also check db.linkedBots, legacy db.authBackups, and disk auth backups
  const db = getDatabase();
  if (db) {
    const botKeysFromDB = new Set([
      ...Object.keys(db.linkedBots || {}),
      ...Object.keys(db.authBackups || {})
    ]);
    try {
      const bdir = path.join(AUTH_DIR, '..', 'auth-backups');
      if (fs.existsSync(bdir)) {
        for (const f of fs.readdirSync(bdir)) {
          if (f.endsWith('.json')) botKeysFromDB.add(f.slice(0, -5));
        }
      }
    } catch {}
    for (const key of botKeysFromDB) {
      if (ALL_PERSONALITY_KEYS.includes(key) && !linkedKeys.includes(key)) {
        linkedKeys.push(key);
      }
    }
  }

  if (linkedKeys.length === 0) {
    console.log('ℹ️  No bots configured/linked. Add BOT_HINATA= to .env or link a new number: DM /link <bot> (owner) — the QR appears in the console.');
    return;
  }

  console.log(`🤖 Booting/linking ${linkedKeys.length} bot(s): ${linkedKeys.join(', ')}`);
  for (const key of linkedKeys) {
    startBotScheduler(key);
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log('✅ All bots startup initiated');

  // ── Init per-system schedulers that don't depend on any particular bot ─
  // Push #47: this called GuildWar.resolveExpiredWars() — a method that has
  // never existed on commands/rpg/guildwar.js (exports name/aliases/description/
  // execute only). Every 10 minutes it threw TypeError into an empty catch, so
  // the weekly war never resolved on schedule and GVC victory cards paid late
  // or not at all. The real resolver is WeeklyGuildWar.
  const WeeklyGuildWar = require('./rpg/utils/WeeklyGuildWar');
  setInterval(() => {
    try {
      const db = getDatabase();
      WeeklyGuildWar.checkWeeklyReset(db, saveDatabase);
    } catch (e) {
      console.error('⚠️ Weekly Guild War scheduler failed:', e.message);
    }
  }, 10 * 60 * 1000);
  console.log('⚔️ Guild War system initialized');
}

startup();

// ── Push #50: diagnostics/test surface ─────────────────────────────────────
// Nothing in the app requires index.js (it is the entrypoint), so exposing these
// is safe and lets the persistence layer be exercised without mocking it —
// which is exactly how the write-coalescing below was verified.
module.exports = {
  __internals: {
    get saveDatabase() { return saveDatabase; },
    get flushSaveNow() { return flushSaveNow; },
    get database() { return database; },
    perf: PerfMonitor,
  },
};
