// AniRPG — verification harness for Push #64 (AstraLink web surface retired;
// pairing is now the owner's DM command /link <bot>, QR printed in the console).
//
// What this push did:
//   • astralink.html is gone from the repo; the page-serving block is removed.
//   • /api/qr, /api/qr-status, /api/release-device-slots,
//     /api/request-pairing-code, /api/link-success are all gone (404).
//   • Ops endpoints survive: /health, /api/bot-status, /api/personalities,
//     /api/db-health.
//   • /link <bot> (DM, owner-only) starts pairing; the QR renders in the
//     console via QRCode.toString(…, {type:'terminal'}) and rotates every
//     QR_VALID_MS.
//   • The Baileys pairing core (startAstraLink, in-flight reuse, slot release,
//     403 handling, getWaVersion from #63) is untouched.
'use strict';
process.chdir(__dirname);
process.env.PORT = process.env.PORT || '3994';
process.env.AUTH_DIR = '/tmp/a64test/auth';
process.env.DATA_DIR = '/tmp/a64test/data';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); console.log(`  ✅ ${n}`); pass++; } catch (e) { console.log(`  ❌ ${n}\n       ${e.message}`); fail++; } };
const PENDING = [];
const at = (n, f) => { PENDING.push({ n, f }); };

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
const msmSrc = fs.readFileSync(path.join(__dirname, 'bots/MultiSocketManager.js'), 'utf8');
const idxSrc = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
const KEY = 'hinata';
const GOOD = '2@' + 'A'.repeat(43) + '=' + ',' + 'B'.repeat(43) + '=' + ',' + 'abcd1234EFGH5678ijkl9012';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const get = async (p, opts) => {
  const r = await fetch(`http://127.0.0.1:${process.env.PORT}${p}`, opts);
  return { status: r.status, json: await r.json().catch(() => null) };
};
function inject(over = {}) {
  const s = MSM._pairing();
  s[KEY] = { status: 'awaiting_qr', method: 'qr', qr: GOOD, qrDataUrl: 'data:image/png;base64,FAKE', error: null, jid: null, code: null, phoneNumber: null, startedAt: Date.now(), ...over };
  return s[KEY];
}
function clearInject() { delete MSM._pairing()[KEY]; }

console.log('\nAniRPG — Push #64 verification: AstraLink retired, /link in the console\n');

// ── 1. the web surface is really gone ───────────────────────────────────────
console.log('\n── 1. the AstraLink web surface is gone ──');
t('astralink.html no longer exists in the repo working copy', () => {
  assert.ok(!fs.existsSync(path.join(__dirname, 'astralink.html')), 'astralink.html should be deleted');
});
t('index.js no longer serves a page or any pairing route', () => {
  assert.ok(!idxSrc.includes('astralink.html'), 'index.js still references the page file');
  for (const r of ['/api/qr', '/api/qr-status', '/api/release-device-slots', '/api/request-pairing-code', '/api/link-success']) {
    assert.ok(!idxSrc.includes(`_path === '${r}'`), `route ${r} still present in index.js`);
  }
  assert.ok(!idxSrc.includes('UI_PATH'), 'UI_PATH constant should be gone');
  assert.ok(!idxSrc.includes('alRateOk'), 'rate limiter for the removed routes should be gone');
});
t('ops endpoints remain declared', () => {
  for (const r of ['/health', '/api/bot-status', '/api/personalities', '/api/db-health']) {
    assert.ok(idxSrc.includes(`_path === '${r}'`), `ops route ${r} missing`);
  }
});

// ── 2. the /link command (owner DM → console QR) ────────────────────────────
console.log('\n── 2. /link <bot>: owner-only, DM-only, console QR ──');
t('/link handler exists and is DM-only', () => {
  assert.ok(msmSrc.includes("if (!isGroup && isCommand && commandName === 'link')"), '/link must only handle DMs');
});
t('/link is owner-gated via Perms.isBotOwner and silent to strangers', () => {
  const i = msmSrc.indexOf("commandName === 'link'");
  const block = msmSrc.slice(i, i + 4000);
  assert.ok(block.includes('Perms.isBotOwner(db, sender)'), 'must check Perms.isBotOwner');
  assert.ok(/if \(!isOwner\) return;/.test(block), 'non-owners must be dropped silently');
});
t('/link resolves the bot, throttles 30s, and reports online/blocked states', () => {
  const i = msmSrc.indexOf("commandName === 'link'");
  const block = msmSrc.slice(i, i + 7000);
  assert.ok(block.includes('PersonalityManager.resolvePersonality(targetArg)'), 'must resolve the bot name');
  assert.ok(block.includes('_linkKickAt[targetKey]'), 'must throttle repeat attempts');
  assert.ok(/< 30000/.test(block), 'throttle window must be 30s');
  assert.ok(block.includes('botSockets[targetKey]?.user?.id'), 'must short-circuit already-linked bots');
  assert.ok(block.includes('sess.blocked'), 'must report 403-blocked numbers instead of hammering');
  assert.ok(block.includes('startAstraLink(targetKey, authDir, getDatabase, saveDatabase'), 'must actually start the pairing');
});
t('the QR is printed to the CONSOLE as terminal blocks (scannable from a screenshot)', () => {
  assert.ok(msmSrc.includes("QRCode.toString(qr, { type: 'terminal', small: false, margin: 2 })"),
    'console QR must use qrcode terminal output with large blocks');
  assert.ok(msmSrc.includes('ALWAYS scan the NEWEST one'), 'the rotation warning must be printed');
});
t('boot log points at the new flow, not the retired page', () => {
  assert.ok(idxSrc.includes('DM /link <bot> (owner)'), 'boot hint must mention /link');
  assert.ok(!idxSrc.includes('link via the AstraLink site'), 'old hint should be gone');
});

// ── 3. the pairing core it leans on is intact ───────────────────────────────
console.log('\n── 3. pairing core still intact under the new surface ──');
t('getLatestQr: a fresh code is valid with a countdown; a stale/dead one is not', () => {
  MSM._sockets()[KEY] = { user: null };
  inject({ qrAt: Date.now() - 2000, qrSeq: 7 });
  let q = MSM.getLatestQr(KEY);
  assert.strictEqual(q.valid, true, 'fresh code marked invalid');
  assert.ok(q.expiresIn > 0 && q.expiresIn <= MSM.QR_VALID_MS, `expiresIn ${q.expiresIn}`);
  inject({ qrAt: Date.now() - (MSM.QR_VALID_MS + 40000), qrSeq: 8 });
  q = MSM.getLatestQr(KEY);
  assert.strictEqual(q.valid, false, 'dead code still offered');
  assert.strictEqual(q.expired, true);
  delete MSM._sockets()[KEY];
  inject({ qrAt: Date.now() });
  q = MSM.getLatestQr(KEY);
  assert.strictEqual(q.valid, false, 'code from a dead socket offered as scannable');
  clearInject();
});
at('startAstraLink: an in-flight pairing is reused, not restarted (Push #55 guard)', async () => {
  clearInject();
  const r1 = await MSM.startAstraLink(KEY, process.env.AUTH_DIR, () => ({}), () => {}, { pairingMode: 'qr', forceRelink: true });
  assert.ok(r1.success === true, 'first start should succeed: ' + JSON.stringify(r1));
  const r2 = await MSM.startAstraLink(KEY, process.env.AUTH_DIR, () => ({}), () => {}, { pairingMode: 'qr', forceRelink: true });
  assert.strictEqual(r2.reused, true, 'second start within 5min must reuse the in-flight session, got: ' + JSON.stringify(r2));
  clearInject();
  delete MSM._pairing()[KEY];
});
at('/api/bot-status still reports a 403 block for the ops surface', async () => {
  require('./index.js');
  await sleep(7000);
  const PM = require('./bots/PersonalityManager');
  // plant a linked bot + a blocked pairing session for it
  const jid = '2349063387817@s.whatsapp.net';
  const hadLinked = PM.linkedNumbers[jid];
  PM.linkedNumbers[jid] = 'lunar';
  const s = MSM._pairing();
  s.lunar = { status: 'blocked', method: 'qr', qr: null, error: null, jid: null, code: null, startedAt: Date.now() - 60000,
    blocked: { code: 403, reason: 'WhatsApp refused this number with 403 forbidden', at: Date.now() - 60000, attempts: 4 } };
  const r = await get('/api/bot-status');
  assert.strictEqual(r.status, 200, 'bot-status should be 200, got ' + r.status);
  assert.ok(Array.isArray(r.json.bots), 'bots array missing');
  const lunar = r.json.bots.find(b => b.key === 'lunar');
  assert.ok(lunar, 'lunar should appear in bot-status');
  assert.strictEqual(lunar.blocked && lunar.blocked.code, 403, 'the 403 block must be surfaced to the ops API');
  assert.strictEqual(lunar.blocked.attempts, 4);
  clearInject();
  delete s.lunar;
  if (hadLinked === undefined) delete PM.linkedNumbers[jid]; else PM.linkedNumbers[jid] = hadLinked;
});
at('the removed pairing routes really 404 (GET and POST)', async () => {
  for (const p of ['/api/qr?personality=' + KEY, '/api/qr-status?personality=' + KEY, '/api/release-device-slots', '/api/request-pairing-code', '/api/link-success', '/astralink', '/']) {
    const g = await get(p);
    assert.strictEqual(g.status, 404, `GET ${p} should be 404, got ${g.status}`);
  }
  const posts = await fetch(`http://127.0.0.1:${process.env.PORT}/api/request-pairing-code`, { method: 'POST', body: '{}' });
  assert.strictEqual(posts.status, 404, 'POST /api/request-pairing-code should be 404');
  const h = await get('/health');
  assert.strictEqual(h.status, 200, '/health must survive');
  assert.strictEqual(h.json.status, 'ok');
});

(async () => {
  for (const { n, f } of PENDING) {
    try { await f(); console.log(`  ✅ ${n}`); pass++; }
    catch (e) { console.log(`  ❌ ${n}\n       ${e.message}`); fail++; }
  }
  console.log(`\n${fail === 0 ? '✅ ALL' : '❌ SOME'} — ${pass}/${pass + fail} checks passed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
