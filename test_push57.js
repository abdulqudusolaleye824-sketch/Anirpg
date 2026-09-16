// AniRPG — verification harness for Push #57 (AstraLink QR linking)
// Boots the real AstraLink HTTP surface and proves a pairing code is only ever
// presented while it is still alive on WhatsApp's side.
'use strict';
process.chdir(__dirname);
process.env.PORT = process.env.PORT || '3998';
process.env.AUTH_DIR = '/tmp/a57test/auth';
process.env.DATA_DIR = '/tmp/a57test/data';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); console.log(`  ✅ ${n}`); pass++; } catch (e) { console.log(`  ❌ ${n}\n       ${e.message}`); fail++; } };
const PENDING = [];
// Route tests share one live server and one pairing session per key, so they are
// awaited one after another — a parallel suite would clear each other's state.
const at = (n, f) => { const pr = (async () => { try { await f(); console.log(`  ✅ ${n}`); pass++; } catch (e) { console.log(`  ❌ ${n}\n       ${e.message}`); fail++; } })(); PENDING.push(pr); return pr; };

function universal() {
  const fn = function () {};
  return new Proxy(fn, {
    get(tg, k) { if (k === Symbol.toPrimitive) return () => 1; if (k === 'then') return undefined; if (typeof k === 'symbol') return undefined; return universal(); },
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
const KEY = 'hinata';
const GOOD = '2@' + 'A'.repeat(43) + '=' + ',' + 'B'.repeat(43) + '=' + ',' + 'abcd1234EFGH5678ijkl9012';

const get = async (p, opts) => {
  const r = await fetch(`http://127.0.0.1:${process.env.PORT}${p}`, opts);
  return { status: r.status, json: await r.json().catch(() => null), text: '' };
};
function inject(over = {}) {
  const s = MSM._pairing();
  s[KEY] = { status: 'awaiting_qr', method: 'qr', qr: GOOD, qrDataUrl: 'data:image/png;base64,FAKE', error: null, jid: null, code: null, phoneNumber: null, startedAt: Date.now(), ...over };
  return s[KEY];
}
function clearInject() {
  const s = MSM._pairing(); delete s[KEY];
  const socks = MSM._sockets(); delete socks[KEY];
}

console.log('\n── 1. QR validity rules (module) ──');
t('a pairing ref is validated before it is ever rendered', () => {
  assert.strictEqual(MSM.isPlausibleQr(GOOD), true);
  for (const bad of ['', null, undefined, 'https://example.com', '2@onlyone', '2@a,b', '2@a,b,c', 'x'.repeat(60) + ',,']) {
    assert.strictEqual(MSM.isPlausibleQr(bad), false, `accepted ${JSON.stringify(String(bad))}`);
  }
  assert.strictEqual(MSM.isPlausibleQr('2@' + 'a'.repeat(20) + ',' + 'b'.repeat(20) + ',' + 'c'.repeat(20)), true);
});
t('the QR lifetime is a sane window and stays env-tunable', () => {
  assert.ok(MSM.QR_VALID_MS >= 15000 && MSM.QR_VALID_MS <= 5 * 60000, `QR_VALID_MS = ${MSM.QR_VALID_MS}`);
});
t('a code with no session, or a malformed one, is never reported valid', () => {
  clearInject();
  let q = MSM.getLatestQr('nobody');
  assert.strictEqual(q.valid, false); assert.strictEqual(q.expiresIn, 0);
  inject({ qr: 'garbage', qrAt: Date.now() });
  q = MSM.getLatestQr(KEY);
  assert.strictEqual(q.valid, false, 'malformed code marked valid');
  clearInject();
});
t('a live code reports its remaining life; a stale one reports expired', () => {
  MSM._sockets()[KEY] = { user: null };                    // pairing socket, not yet linked
  inject({ qrAt: Date.now() - 2000, qrSeq: 7 });
  let q = MSM.getLatestQr(KEY);
  assert.strictEqual(q.valid, true, 'fresh code marked invalid');
  assert.strictEqual(q.seq, 7); assert.ok(q.expiresIn > 0 && q.expiresIn < MSM.QR_VALID_MS, `expiresIn ${q.expiresIn}`);
  inject({ qrAt: Date.now() - (MSM.QR_VALID_MS + 40000), qrSeq: 8 });
  q = MSM.getLatestQr(KEY);
  assert.strictEqual(q.valid, false, 'dead code still offered');
  assert.strictEqual(q.expired, true); assert.strictEqual(q.expiresIn, 0);
  delete MSM._sockets()[KEY];
  inject({ qrAt: Date.now() });                             // code exists but its socket died
  q = MSM.getLatestQr(KEY);
  assert.strictEqual(q.valid, false, 'code from a dead socket offered as scannable');
  clearInject();
});

console.log('\n── 2. the relink path no longer orphans WhatsApp device slots ──');
t('a snapshot is staged for logout BEFORE the creds are deleted', () => {
  const src = fs.readFileSync('bots/MultiSocketManager.js', 'utf8');
  const stage = src.indexOf('_revokeSnapshotAsync(authDir, personalityKey)');
  const wipe = src.indexOf('if (fs.existsSync(botAuthDir)) fs.rmSync(botAuthDir, { recursive: true, force: true });');
  assert.ok(stage > 0 && wipe > stage, 'creds are wiped before the old session is released');
  assert.ok(/sock\.logout\(\)/.test(src), 'no real logout is ever attempted');
  assert.ok(!/QRCode\.toDataURL\(qr,\s*\{[^}]*#7CFFD0/.test(src), 'QR still rendered on a tinted background');
});
t('revokeSessionDir refuses politely when there is nothing to release', async () => {
  const dir = '/tmp/a57test/empty-auth';
  fs.mkdirSync(dir, { recursive: true });
  const r = await MSM.revokeSessionDir('/tmp/a57test/empty-auth', 'nobody');
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /no registered session/);
  fs.mkdirSync(path.join(dir, 'nobody-here'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'nobody-here', 'creds.json'), JSON.stringify({ registered: false }));
  const r2 = await MSM.revokeSessionDir('/tmp/a57test/empty-auth', 'nobody-here');
  assert.match(r2.reason, /never registered/);
});

console.log('\n── 3. the real AstraLink HTTP routes ──');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const _routeTests = async () => {
await at('the server answers the AstraLink endpoints', async () => {
  require('./index.js');
  await sleep(7000);
  const h = await get('/health');
  assert.strictEqual(h.status, 200); assert.strictEqual(h.json.status, 'ok');
  const s = await get(`/api/qr-status?personality=${KEY}`);
  assert.strictEqual(s.status, 200);
  for (const k of ['seq', 'ageMs', 'expiresIn', 'valid', 'expired', 'ttlMs', 'connected']) assert.ok(k in s.json, `qr-status missing ${k}`);
});
await at('a live code is served with its countdown; a dead one is refused', async () => {
  MSM._sockets()[KEY] = { user: null };
  inject({ qrAt: Date.now() - 1500, qrSeq: 11 });
  const r = await get(`/api/qr?personality=${KEY}&now=1`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.success, true, `live code refused: ${JSON.stringify(r.json)}`);
  assert.strictEqual(r.json.seq, 11);
  assert.ok(r.json.dataUri && r.json.expiresIn > 0 && r.json.refreshInMs > 0, 'no countdown payload');
  inject({ qrAt: Date.now() - (MSM.QR_VALID_MS + 5000), qrSeq: 12 });
  const dead = await get(`/api/qr?personality=${KEY}&now=1`);
  assert.strictEqual(dead.json.success, false, 'an EXPIRED code was served as if scannable');
  assert.strictEqual(dead.json.expired, true);
  assert.match(dead.json.error, /NEXT code/i, 'the user is not told to scan the new one');
  assert.ok(dead.json.retryInMs > 0, 'no retry hint');
  delete MSM._sockets()[KEY];
  clearInject();
});
await at('a button press can never wipe a live, linked bot', async () => {
  MSM._sockets()[KEY] = { user: { id: '1234@s.whatsapp.net' } };
  inject({ status: 'connected', qr: GOOD, qrAt: Date.now(), qrSeq: 13 });
  const r = await get(`/api/qr?personality=${KEY}&now=1&fresh=1`);
  assert.strictEqual(r.json.alreadyConnected, true, `live bot was not short-circuited: ${JSON.stringify(r.json)}`);
  assert.strictEqual(MSM._pairing()[KEY].qr, GOOD, 'the pairing session was torn down anyway');
  clearInject();
});
await at('nothing to pair yet responds instantly instead of hanging', async () => {
  clearInject();
  const t0 = Date.now();
  const r = await get(`/api/qr?personality=${KEY}&now=1`);
  const ms = Date.now() - t0;
  assert.ok(ms < 3000, `took ${ms}ms — the page would show a long loading screen`);
  assert.strictEqual(r.json.success, false);
  assert.strictEqual(r.json.phase, 'waiting');
  assert.ok(r.json.retryInMs > 0, 'no retryInMs for the UI to schedule with');
});
await at('bad input and the device-slot route are handled, and the page still serves', async () => {
  assert.strictEqual((await get('/api/qr')).status, 400);
  assert.strictEqual((await get('/api/qr?personality=nope')).status, 400);
  // Push #58 gated this endpoint behind ASTRALINK_ADMIN_TOKEN, because the port is
  // public. Refusing outright with no secret configured is the contract now.
  const locked = await get('/api/release-device-slots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personality: KEY }) });
  assert.strictEqual(locked.status, 503, `unauthenticated release was not refused (${locked.status})`);
  assert.strictEqual(locked.json.disabled, true);
  process.env.ASTRALINK_ADMIN_TOKEN = 'push57-route-token';
  const rel = await get('/api/release-device-slots?token=push57-route-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personality: KEY }) });
  assert.ok([200, 502].includes(rel.status), `release route returned ${rel.status}`);
  assert.match(JSON.stringify(rel.json), /device slot|registered session|online right now|linked/i);
  const bogus = await get('/api/release-device-slots?token=push57-route-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personality: 'zzz' }) });
  assert.strictEqual(bogus.status, 400);
  delete process.env.ASTRALINK_ADMIN_TOKEN;
  const page = await fetch(`http://127.0.0.1:${process.env.PORT}/astralink`);
  const html = await page.text();
  assert.ok(html.includes('id="qrTimerFill"'), 'the countdown bar is not in the page');
  assert.ok(html.includes('function newQrCode') && html.includes('function releaseSlots'), 'the QR controls are not wired');
  assert.ok(html.includes('id="adminBar"') && html.includes('ASTRALINK_ADMIN_TOKEN'), 'the owner-ops token UI is missing');
  assert.ok(html.includes('free old device slots') || html.includes('Free old device slots'), 'no slot-release button label');
  assert.ok(/data\.seq !== _qrSeq|seq !== _qrSeq/.test(html), 'the picture is repainted from stale data instead of only on a new code');
  assert.ok(html.includes("Couldn&#39;t log in"), 'the 4-device explanation is missing');
});
};

// The module-level cases above are synchronous and already counted; the route
// cases need the server up, so they run (and are awaited) inside _routeTests.
_routeTests().then(() => Promise.allSettled(PENDING)).then(() => {
  console.log(`\n${fail === 0 ? '✅' : '❌'} Push #57 harness — PASS ${pass} FAIL ${fail} (${PENDING.length} async)`);
  process.exit(fail ? 1 : 0);
});
