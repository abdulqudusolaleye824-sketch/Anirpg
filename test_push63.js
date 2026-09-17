// AniRPG — verification harness for Push #63 (WhatsApp version lookup that
// cannot stall pairing).
//
// Bug: connectBot did `await fetchLatestBaileysVersion()` — Baileys implements
// that as a bare fetch to raw.githubusercontent.com with NO timeout, cache or
// fallback. When GitHub stalls from the VPS, connectBot hung forever BEFORE
// the socket existed: session stuck at "starting", page stuck on "opening a
// pairing session…", no QR, no 403, no error, and every retry re-hit the
// same hang. Pairing could silently never even try.
//
// Fix: getWaVersion() — 6h cache, hard 8s timeout, fallback to the version
// bundled with the installed Baileys build. connectBot and revokeSessionDir
// both route through it.
'use strict';
process.chdir(__dirname);
process.env.PORT = process.env.PORT || '3996';
process.env.AUTH_DIR = '/tmp/a63test/auth';
process.env.DATA_DIR = '/tmp/a63test/data';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); console.log(`  ✅ ${n}`); pass++; } catch (e) { console.log(`  ❌ ${n}\n       ${e.message}`); fail++; } };
// Behavioural tests share the module's version cache, so they run strictly
// one after another (never in parallel).
const PENDING = [];
const at = (n, f) => { PENDING.push({ n, f }); };

// Set during the stall test: a `then` that never settles its callbacks, so
// any await/promise-race on a stub value hangs — exactly like Baileys'
// fetchLatestBaileysVersion() does when GitHub never answers.
let UNIVERSAL_THEN = undefined;
function universal() {
  const fn = function () {};
  return new Proxy(fn, {
    get(tg, k) { if (k === Symbol.toPrimitive) return () => 1; if (k === 'then') return UNIVERSAL_THEN; if (typeof k === 'symbol') return undefined; return universal(); },
    apply: () => universal(), construct: () => universal(), has: () => true,
  });
}
const STUB = ['@whiskeysockets/baileys', 'pino', 'qrcode', 'qrcode-terminal', 'ws', 'express', 'pm2', 'mongoose', 'ioredis', 'axios', 'node-cron', 'openai', '@google/generative-ai', '@huggingface/inference'];
const _load = Module._load;
Module._load = function (r, p, i) {
  if (STUB.some((s) => r === s || r.startsWith(s + '/'))) return universal();
  try { return _load.call(Module, r, p, i); } catch (e) { if (e.code === 'MODULE_NOT_FOUND') return universal(); throw e; }
};
process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {});

const MSM = require('./bots/MultiSocketManager');
const src = fs.readFileSync(path.join(__dirname, 'bots/MultiSocketManager.js'), 'utf8');

console.log('\nAniRPG — Push #63 verification: WA version lookup cannot stall pairing\n');

// ── static checks ───────────────────────────────────────────────────────────
t('connectBot uses getWaVersion() (no bare await fetchLatestBaileysVersion)', () => {
  assert(src.includes('const version = await getWaVersion();'), 'connectBot must call getWaVersion()');
  // The only remaining fetchLatestBaileysVersion references: the import, and
  // the one guarded call inside getWaVersion's Promise.race (never awaited
  // alone). Check code lines only, not comments.
  const code = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  const bare = code.match(/await\s+fetchLatestBaileysVersion\(\)/g) || [];
  assert.strictEqual(bare.length, 0, 'no unguarded `await fetchLatestBaileysVersion()` may remain, found ' + bare.length);
  assert(code.includes('fetchLatestBaileysVersion(),'), 'getWaVersion still attempts the live fetch (raced, not awaited alone)');
});
t('revokeSessionDir routes through getWaVersion() too', () => {
  assert(src.includes('const ver = { version: await getWaVersion() };'), 'revokeSessionDir must use getWaVersion()');
});
t('getWaVersion has a hard 8s timeout raced against the fetch', () => {
  assert(/Promise\.race\(\[\s*fetchLatestBaileysVersion\(\),/.test(src), 'fetch must be raced against a timeout');
  assert(/setTimeout\(\(\) => rej\(new Error\('WA version fetch timed out \(8s\)'\)\), 8000\)/.test(src), 'timeout must be 8000ms and reject');
});
t('fallback chain: stale cache, then version bundled with the Baileys build', () => {
  assert(src.includes('_bundledWaVersion()'), 'must have a bundled-version fallback');
  assert(src.includes("require.resolve('@whiskeysockets/baileys/lib/Defaults/index.js')"), 'bundled version must be read from the installed Baileys build');
  assert(src.includes('[2, 3000, 1023601545]'), 'last-resort literal kept for unresolvable installs');
});

// ── behavioural checks (real timer, stubbed network) ────────────────────────
at('THE BUG FIX: hung GitHub fetch cannot stall getWaVersion (>8s, never 60s+)', async () => {
  assert.strictEqual(typeof MSM.getWaVersion, 'function', 'getWaVersion must be exported');
  MSM._waVersionTestReset();
  const realFetch = global.fetch;
  global.fetch = () => new Promise(() => {});       // GitHub stalls forever — exactly the VPS failure mode
  UNIVERSAL_THEN = () => {};                        // (and the stubbed Baileys call hangs too)
  const started = Date.now();
  let v = null;
  try { v = await MSM.getWaVersion(); } finally { global.fetch = realFetch; UNIVERSAL_THEN = undefined; }
  const ms = Date.now() - started;
  assert.ok(Array.isArray(v), 'must still return a version, got: ' + typeof v);
  assert.strictEqual(v.length, 3, 'version must be [major, minor, patch]');
  assert.strictEqual(v[0], 2, 'major must be 2');
  assert.ok(v[2] > 1000000000, 'patch looks like a real WA build number: ' + v.join('.'));
  assert.ok(ms >= 7500, 'timeout path should take ~8s, took ' + ms + 'ms (suspiciously fast)');
  assert.ok(ms < 15000, 'must resolve well under any previous "forever"; took ' + ms + 'ms');
  console.log(`     (fell back to ${v.join('.')} after ${ms}ms of GitHub silence)`);
});

at('second call is served from the 6h cache (no re-fetch, same reference)', async () => {
  const v1 = await MSM.getWaVersion();
  const started = Date.now();
  const v2 = await MSM.getWaVersion();
  assert.strictEqual(v2, v1, 'cache must return the same reference');
  assert.ok(Date.now() - started < 50, 'cached call must be instant, took ' + (Date.now() - started) + 'ms');
});

at('bundled-version reader parses [2, 3000, N] (or degrades to the literal)', () => {
  const v = MSM._bundledWaVersion();
  assert.ok(Array.isArray(v) && v.length === 3 && v[0] === 2, 'plausible version: ' + JSON.stringify(v));
  assert.ok(v[2] > 1000000000, 'patch is a real WA build number: ' + v.join('.'));
});

at('connectBot body: version is fetched AFTER creds/state, before socket — and cannot reject the session', () => {
  // connectBot must not die from a version failure: getWaVersion never throws
  // (every branch returns an array).
  const start = src.indexOf('async function connectBot');
  const rest = src.slice(start);
  const nextDecl = rest.indexOf('\nfunction ');
  const nextAsync = rest.indexOf('\nasync function ');
  const end = Math.min(nextDecl === -1 ? Infinity : start + nextDecl, nextAsync === -1 ? Infinity : start + nextAsync);
  const body = src.slice(start, end === Infinity ? undefined : end);
  assert(body.includes('const version = await getWaVersion();'), 'connectBot must obtain the version via getWaVersion()');
  const versionIdx = body.indexOf('const version = await getWaVersion();');
  const socketIdx = body.indexOf('makeWASocket');
  assert(versionIdx !== -1 && socketIdx !== -1 && versionIdx < socketIdx, 'version must be resolved before the socket is created');
});

(async () => {
  for (const { n, f } of PENDING) {
    try { await f(); console.log(`  ✅ ${n}`); pass++; }
    catch (e) { console.log(`  ❌ ${n}\n       ${e.message}`); fail++; }
  }
  console.log(`\n${fail === 0 ? '✅ ALL' : '❌ SOME'} — ${pass}/${pass + fail} checks passed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
