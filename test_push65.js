// AniRPG — verification harness for Push #65 (SQLite live store + QuickDB updates)
//
// What this push did:
//   • db/Storage.js — the game DB's LIVE copy is now database.sqlite
//     (one row per top-level collection, atomic transactional writes, WAL).
//   • db/updates.js — quick.db (QuickDB) tracks push version / boot state in
//     a separate updates.sqlite.
//   • index.js — boot loads SQLite first (fuller-backup-wins preserved: a
//     Mongo/JSON mirror with MORE users is adopted and SQLite reseeded);
//     every flush path (coalesced, forced, crash-sync) writes the live store
//     FIRST; JSON is now a backup mirror; /api/db-health reports both.
//   • Both modules degrade to no-ops with a loud warning if their native
//     module fails — a storage upgrade never takes the bot down.
'use strict';
process.chdir(__dirname);
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); console.log(`  ✅ ${n}`); pass++; } catch (e) { console.log(`  ❌ ${n}\n       ${e.message}`); fail++; } };
const PENDING = [];
const at = (n, f) => { PENDING.push({ n, f }); };

const Storage = require('./db/Storage');
const Updates = require('./db/updates');
const idxSrc = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

// A realistic game-DB shape: nested players, arrays, nulls, numbers, strings.
function fakeDb(nUsers) {
  const users = {};
  for (let i = 0; i < nUsers; i++) {
    users[String(100000 + i)] = {
      name: 'Player' + i, level: (i % 50) + 1, xp: i * 13, gold: 5000 - i,
      stats: { maxHp: 100 + i, hp: 100 + i, atk: 10, def: 5, energy: 20 },
      inventory: { healthPotions: 2, manaPotions: 0, energyPotions: 1, reviveTokens: 0 },
      titles: ['Newbie'], pvpElo: 1000, nullField: null,
    };
  }
  return {
    users,
    banlist: {},
    dailyQuests: { questA: { done: 3 } },
    botMods: ['555@lid'],
    botOwners: ['111@lid', '222@lid'],
    guilds: { g1: { leader: '100000', members: [{ id: '100000', name: 'Player0', rank: 'Leader' }] } },
    afkUsers: {},
    __savedAt: Date.now(),
  };
}

const TMP = '/tmp/a65test';
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

console.log('\nAniRPG — Push #65 verification: SQLite live store + QuickDB updates\n');

console.log('── 1. the SQLite engine (real better-sqlite3) ──');
t('init opens the file and reports available', () => {
  const f = Storage.init(TMP);
  assert.ok(f && fs.existsSync(f), 'database.sqlite should exist at ' + f);
  assert.strictEqual(Storage.isAvailable(), true);
});
at('save + load round-trips a realistic DB exactly', async () => {
  const db = fakeDb(120);
  assert.strictEqual(Storage.save(db), true, 'save should succeed');
  Storage.close();
  Storage.init(TMP);
  const back = Storage.load();
  assert.ok(back, 'load returned null');
  assert.deepStrictEqual(Object.keys(back).sort(), Object.keys(db).sort(), 'top-level keys differ');
  assert.deepStrictEqual(back.users, db.users, 'users collection differs');
  assert.deepStrictEqual(back.guilds, db.guilds, 'guilds differ');
  assert.strictEqual(back.botMods[0], '555@lid');
  assert.strictEqual(back.users['100000'].nullField, null, 'null values must survive');
});
at('save() drops collections that vanished from memory', async () => {
  Storage.close(); Storage.init(TMP);
  let cur = Storage.load();
  assert.ok(cur.pendingTrades === undefined);
  cur = { ...cur, pendingTrades: { a: { timestamp: 1 } } };
  Storage.save(cur);
  delete cur.pendingTrades;
  Storage.save(cur);
  const back = Storage.load();
  assert.strictEqual(back.pendingTrades, undefined, 'removed collection still present');
});
at('load() returns null on an empty store (boot falls back to mirrors)', async () => {
  const TMP2 = '/tmp/a65test2';
  fs.rmSync(TMP2, { recursive: true, force: true });
  Storage.close(); Storage.init(TMP2);
  assert.strictEqual(Storage.load(), null);
  Storage.close(); Storage.init(TMP);
});
at('info() reports rows, bytes and last-saved age (after the round-trip populated it)', async () => {
  const i = Storage.info();
  assert.strictEqual(i.available, true);
  assert.ok(i.rows > 5, 'rows: ' + i.rows);
  assert.ok(i.bytes > 1000, 'bytes: ' + i.bytes);
  assert.ok(i.lastSavedAt > 0 && i.ageSec >= 0);
});
at('a 1000-user DB saves fast enough to not stall commands', async () => {
  const big = fakeDb(1000);
  const t0 = Date.now();
  assert.strictEqual(Storage.save(big), true);
  const ms = Date.now() - t0;
  assert.ok(ms < 1000, '1000-user save took ' + ms + 'ms');
  console.log(`     (1000 users saved in ${ms}ms)`);
});
at('a corrupt single row does not poison the rest of the DB', async () => {
  Storage.close(); Storage.init(TMP);
  // corrupt one row directly
  const Database = require('better-sqlite3');
  const raw = new Database(path.join(TMP, 'database', 'database.sqlite'));
  raw.prepare("UPDATE collections SET data = '{corrupt' WHERE name = 'guilds'").run();
  raw.close();
  const back = Storage.load();
  assert.ok(back, 'load returned null despite one corrupt row');
  assert.strictEqual(back.guilds, undefined, 'corrupt row should be skipped');
  assert.ok(back.users, 'the rest of the DB must load');
  assert.ok(Object.keys(back.users).length > 0);
});

console.log('\n── 2. QuickDB update tracking (real quick.db) ──');
at('recordBoot() tracks boots, and a push bump is reported', async () => {
  Updates.close();
  fs.rmSync('/tmp/a65test-updates', { recursive: true, force: true }); // fresh state each run
  Updates.init('/tmp/a65test-updates');
  const b1 = await Updates.recordBoot();
  assert.ok(b1 && b1.boots === 1, 'first boot: ' + JSON.stringify(b1));
  assert.strictEqual(b1.prevPush, null);
  assert.strictEqual(b1.push, Updates.BOT_VERSION);
  const b2 = await Updates.recordBoot();
  assert.strictEqual(b2.boots, 2, 'second boot count');
  const info = await Updates.getUpdateInfo();
  assert.strictEqual(info.available, true);
  assert.strictEqual(info.running, Updates.BOT_VERSION);
  assert.strictEqual(info.boots, 2);
  Updates.close();
});

console.log('\n── 3. index.js wiring (static) ──');
t('boot loads SQLite FIRST and reseeds it when a backup is fuller', () => {
  assert.ok(idxSrc.includes('const sqliteDoc = Storage.load();'), 'boot must load the live store');
  const iSqlite = idxSrc.indexOf('const sqliteDoc = Storage.load();');
  const iDiverge = idxSrc.indexOf('SQLITE DIVERGED AT BOOT');
  const iReseed = idxSrc.indexOf('live store reseeded');
  assert.ok(iSqlite > 0 && iDiverge > iSqlite && iReseed > iDiverge, 'divergence → adopt backup → reseed SQLite must exist');
});
t('first-boot seeding: no SQLite yet → seed from whichever mirror won', () => {
  assert.ok(idxSrc.includes('SQLite live store seeded from MongoDB'), 'mongo-wins must seed SQLite');
  assert.ok(idxSrc.includes('SQLite live store seeded from JSON'), 'json-wins must seed SQLite');
});
t('every write path persists the live store (coalesced, forced, crash-sync, shutdown)', () => {
  const n = (idxSrc.match(/Storage\.save\(database\)/g) || []).length;
  assert.ok(n >= 3, 'expected Storage.save(database) in >=3 write paths, found ' + n);
  const flush = idxSrc.slice(idxSrc.indexOf('function _flushSaveNow'), idxSrc.indexOf('function _flushSaveNow') + 700);
  const iStore = flush.indexOf('Storage.save(database)');
  const iMongo = flush.indexOf('saveToMongo()');
  const iJson = flush.indexOf('_writeJsonBackup()');
  assert.ok(iStore > 0 && iStore < iMongo && iStore < iJson, 'the live store must be written BEFORE the mirrors');
  const syncNow = idxSrc.slice(idxSrc.indexOf('function saveDatabaseSyncNow'), idxSrc.indexOf('function saveDatabaseSyncNow') + 2000);
  assert.ok(syncNow.includes('Storage.save(database)'), 'crash-sync snapshot must include the live store');
});
t('loadDatabase accepts an in-memory doc so SQLite adopts run normalization', () => {
  assert.ok(idxSrc.includes('const loadDatabase = (memDoc = null) => {'), 'loadDatabase must take a doc');
  assert.ok(idxSrc.includes('loadDatabase(sqliteDoc)'), 'the sqlite path must run the same normalization');
});
t('/api/db-health reports the live store and update state', () => {
  assert.ok(idxSrc.includes('sqlite: (() => { try { return Storage.info();'), 'db-health must expose sqlite info');
  assert.ok(idxSrc.includes('updates: await Updates.getUpdateInfo()'), 'db-health must expose updates');
});
t('package.json declares both new dependencies', () => {
  const pj = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  assert.ok(pj.dependencies['better-sqlite3'], 'better-sqlite3 missing');
  assert.ok(pj.dependencies['quick.db'], 'quick.db missing');
});
t('degradation: a failed native load can never crash boot', () => {
  const s = fs.readFileSync(path.join(__dirname, 'db', 'Storage.js'), 'utf8');
  assert.ok(s.includes('better-sqlite3') && /try \{[\s\S]*?require\('better-sqlite3'\)[\s\S]*?catch \(e\)/.test(s), 'Storage.init must be wrapped');
  const u = fs.readFileSync(path.join(__dirname, 'db', 'updates.js'), 'utf8');
  assert.ok(/try \{[\s\S]*?require\('quick\.db'\)[\s\S]*?catch \(e\)/.test(u), 'Updates.init must be wrapped');
});

(async () => {
  for (const { n, f } of PENDING) {
    try { await f(); console.log(`  ✅ ${n}`); pass++; }
    catch (e) { console.log(`  ❌ ${n}\n       ${e.message}`); fail++; }
  }
  console.log(`\n${fail === 0 ? '✅ ALL' : '❌ SOME'} — ${pass}/${pass + fail} checks passed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
