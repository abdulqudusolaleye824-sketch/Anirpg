// AniRPG — verification harness for Push #66 (Atlas mirror → typed DatabaseMirror schema)
//
// What this push did:
//   • The raw `mongodb` driver is gone from index.js (it was the only user).
//   • The Atlas mirror is now a mongoose `DatabaseMirror` schema — the same
//     schema layer typegoose builds on (typed fields + Mixed payload +
//     strict:false), with NO build step (this repo is plain JS; the
//     decorator-only typegoose packages can't run here).
//   • Doc shape: { _id: 'main', doc: <game DB>, userCount, botPush, updatedAt }
//   • Legacy docs (fields spread at top level, pre-#66) are still readable —
//     _mirrorToDb() handles both shapes and the first save rewrites the doc.
//   • Writes (coalesced flush, shutdown flush) use the schema shape; the
//     arming check and /api/db-health understand both shapes.
//
// This harness runs against a REAL in-memory MongoDB (mongodb-memory-server):
//   • the real _mirrorToDb() function, extracted from index.js source
//   • the real connectMongo() path via the live index.js server
'use strict';
process.chdir(__dirname);
process.env.PORT = process.env.PORT || '3992';
process.env.DATA_DIR = '/tmp/a66test/data';
process.env.AUTH_DIR = '/tmp/a66test/auth';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); console.log(`  ✅ ${n}`); pass++; } catch (e) { console.log(`  ❌ ${n}\n       ${e.message}`); fail++; } };
const PENDING = [];
const at = (n, f) => { PENDING.push({ n, f }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const idxSrc = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

// ── stub loader for index.js's deps (as in the other harnesses) — EXCEPT
// mongoose / better-sqlite3 / quick.db, which are installed and must be REAL.
function universal() {
  const fn = function () {};
  return new Proxy(fn, {
    get(tg, k) { if (k === Symbol.toPrimitive) return () => 1; if (k === 'then') return undefined; if (typeof k === 'symbol') return undefined; return universal(); },
    apply: () => universal(), construct: () => universal(), has: () => true,
  });
}
const STUB = ['@whiskeysockets/baileys', 'pino', 'qrcode', 'qrcode-terminal', 'ws', 'express', 'pm2', 'ioredis', 'axios', 'node-cron', 'openai', '@google/generative-ai', '@huggingface/inference'];
const _load = Module._load;
Module._load = function (r, p, i) {
  if (STUB.some((s) => r === s || r.startsWith(s + '/'))) return universal();
  try {
    return _load.call(Module, r, p, i);
  } catch (e) {
    // NEVER stub native-binding candidates: better-sqlite3 (via the `bindings`
    // package) probes several absolute .node paths and relies on the
    // MODULE_NOT_FOUND of the misses to walk to the next candidate.
    if (e.code === 'MODULE_NOT_FOUND' && !(r.startsWith('/') && /\.node$/.test(r))) return universal();
    throw e;
  }
};
process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {});

// Extract the REAL _mirrorToDb from production source (it is a pure function).
function extractMirrorToDb() {
  const m = idxSrc.match(/function _mirrorToDb\(m\) \{[\s\S]*?\n\}/);
  assert.ok(m, '_mirrorToDb not found in index.js');
  return eval('(' + m[0] + ')');
}
const _mirrorToDb = extractMirrorToDb();

// A realistic game-DB shape.
function fakeDb(n) {
  const users = {};
  for (let i = 0; i < n; i++) users[String(200000 + i)] = { name: 'P' + i, level: 1, gold: 100 + i, stats: { atk: 5 } };
  return { users, banlist: {}, botMods: ['m@lid'], botOwners: ['o@lid'], __savedAt: Date.now() };
}

console.log('\nAniRPG — Push #66 verification: DatabaseMirror schema on a REAL in-memory Mongo\n');

at('boot a real in-memory MongoDB', async () => {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  global.__mongod = await MongoMemoryServer.create();
  console.log(`     (in-memory mongod at ${global.__mongod.getUri()})`);
});

at('schema-shape doc writes and reads back through the REAL _mirrorToDb()', async () => {
  const mongoose = require('mongoose');
  await mongoose.connect(global.__mongod.getUri());
  const schema = new mongoose.Schema({
    _id: { type: String },
    doc: { type: mongoose.Schema.Types.Mixed },
    userCount: { type: Number, default: 0 },
    botPush: { type: Number, default: null },
    updatedAt: { type: Number, default: Date.now },
  }, { strict: false });
  const Model = mongoose.models.DatabaseMirror || mongoose.model('DatabaseMirror', schema);
  const db = fakeDb(50);
  await Model.replaceOne({ _id: 'main' },
    { _id: 'main', doc: db, userCount: 50, botPush: 66, updatedAt: Date.now() }, { upsert: true });
  const stored = await Model.findOne({ _id: 'main' });
  assert.ok(stored, 'doc not stored');
  assert.strictEqual(stored.userCount, 50, 'typed userCount must persist');
  assert.strictEqual(stored.botPush, 66, 'typed botPush must persist');
  const back = _mirrorToDb(stored);
  assert.ok(back, '_mirrorToDb returned null for a schema doc');
  assert.deepStrictEqual(Object.keys(back.users).length, 50);
  assert.strictEqual(back.botMods[0], 'm@lid');
  assert.strictEqual(back.__savedAt, db.__savedAt);
  assert.strictEqual(back.userCount, undefined, 'schema metadata must not leak into the game DB');
});

at('a LEGACY doc (pre-#66, fields spread at top level) is still readable', async () => {
  const mongoose = require('mongoose');
  const Model = mongoose.models.DatabaseMirror;
  const legacy = fakeDb(7);
  // write it the OLD way: raw spread shape, __v from the driver era
  await Model.deleteOne({ _id: 'legacy-probe' });
  await Model.collection.insertOne({ _id: 'legacy-probe', ...legacy, __v: 4 });
  const found = await Model.findOne({ _id: 'legacy-probe' });
  assert.ok(found, 'legacy doc not found via the model');
  const back = _mirrorToDb(found);
  assert.ok(back, '_mirrorToDb returned null for a legacy doc');
  assert.strictEqual(Object.keys(back.users).length, 7, 'legacy users must survive');
  assert.strictEqual(back.__v, undefined, '__v must not leak into the game DB');
  assert.strictEqual(back.userCount, undefined, 'schema keys must not leak from a legacy doc');
  await Model.deleteOne({ _id: 'legacy-probe' });
});

at('an empty/missing doc yields null (boot falls back to local stores)', async () => {
  assert.strictEqual(_mirrorToDb(null), null);
  assert.strictEqual(_mirrorToDb({ _id: 'main', __v: 0 }), null, 'schema metadata alone is not a game DB');
});

at('the live index.js server connects with mongoose and reports the mirror via /api/db-health', async () => {
  // real mongoose (NOT stubbed) + the memory server as MONGODB_URI
  process.env.MONGODB_URI = global.__mongod.getUri();
  require('./index.js');
  await sleep(8000);
  const r = await (await fetch(`http://127.0.0.1:${process.env.PORT}/api/db-health`)).json();
  assert.ok(r.ok, 'db-health 500: ' + JSON.stringify(r));
  assert.strictEqual(r.mongo.configured, true, 'mongo must be configured');
  assert.strictEqual(r.mongo.connected, true, 'mongoose.connect must have succeeded — ' + JSON.stringify(r.mongo));
  assert.strictEqual(r.mongo.doc === null || r.mongo.doc.schema === 'push66' || r.mongo.doc.schema === 'legacy', true,
    'doc info must be null or schema-tagged: ' + JSON.stringify(r.mongo.doc));
  // the sqlite + updates surfaces from #65 ride along on the same endpoint
  assert.ok(r.sqlite && typeof r.sqlite.available === 'boolean', 'sqlite info missing');
  assert.ok(r.updates && r.updates.available, 'updates info missing');
});

console.log('\n── static: the driver is really gone, the schema is really wired ──');
t('index.js no longer requires the raw mongodb driver', () => {
  const code = idxSrc.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.ok(!code.includes("require('mongodb')"), 'raw driver still imported');
  assert.ok(idxSrc.includes("require('mongoose')"), 'mongoose import missing');
});
t('the DatabaseMirror schema has the typed fields + Mixed payload + strict:false', () => {
  assert.ok(idxSrc.includes("mongoose.model('DatabaseMirror', databaseMirrorSchema())"), 'model registration missing');
  for (const field of ['doc: { type: mongoose.Schema.Types.Mixed }', 'userCount: { type: Number', 'botPush: { type: Number', 'updatedAt: { type: Number']) {
    assert.ok(idxSrc.includes(field), 'schema field missing: ' + field);
  }
  assert.ok(idxSrc.includes('strict: false'), 'schema must be strict:false (the game DB is open-shaped)');
});
t('connect uses mongoose.connect; shutdown uses mongoose disconnect', () => {
  assert.ok(idxSrc.includes('mongoose.connect(MONGO_URI'), 'connectMongo must use mongoose.connect');
  assert.ok(idxSrc.includes('await mongoClient.disconnect()'), 'shutdown must disconnect mongoose');
  assert.ok(!idxSrc.includes('new MongoClient'), 'raw MongoClient still used');
});
t('every write path uses the schema shape (_mirrorDocToWrite)', () => {
  const n = (idxSrc.match(/_mirrorDocToWrite\(\)/g) || []).length;
  assert.ok(n >= 3, 'expected _mirrorDocToWrite() in >=3 places (def + 2 write sites), found ' + n);
});
t('package.json: mongoose in, raw mongodb driver out', () => {
  const pj = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  assert.ok(pj.dependencies.mongoose, 'mongoose missing');
  assert.ok(!pj.dependencies.mongodb, 'raw mongodb driver should be removed');
  assert.ok(!pj.dependencies.typegoose, 'the deprecated typegoose stub must not be a dependency');
});

(async () => {
  for (const { n, f } of PENDING) {
    try { await f(); console.log(`  ✅ ${n}`); pass++; }
    catch (e) { console.log(`  ❌ ${n}\n       ${e.message}`); fail++; }
  }
  try { if (global.__mongod) await global.__mongod.stop(); } catch {}
  const mongoose = (() => { try { return require('mongoose'); } catch { return null; } })();
  if (mongoose) { try { await mongoose.disconnect(); } catch {} }
  console.log(`\n${fail === 0 ? '✅ ALL' : '❌ SOME'} — ${pass}/${pass + fail} checks passed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
