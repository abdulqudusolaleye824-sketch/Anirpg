// AniRPG — Push #58 harness (rewritten for Push #61).
// Push #58 built the AstraLink admin gate; Push #61 removed it entirely: the
// port is open to everyone, no token, and the deploy endpoints are gone.
// This harness now asserts exactly that — the secret is nowhere, linking works
// anonymously, and the only thing left between a stranger and the
// state-changing routes is the rate limit.
'use strict';
process.chdir(__dirname);
process.env.PORT = '3997';
process.env.AUTH_DIR = '/tmp/a58test/auth';
process.env.DATA_DIR = '/tmp/a58test/data';
delete process.env.ASTRALINK_ADMIN_TOKEN;
const assert = require('assert');
const fs = require('fs');
const Module = require('module');

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); console.log(`  ✅ ${n}`); pass++; } catch (e) { console.log(`  ❌ ${n}\n       ${e.message}`); fail++; } };
const PENDING = [];
const at = (n, f) => { const pr = (async () => { try { await f(); console.log(`  ✅ ${n}`); pass++; } catch (e) { console.log(`  ❌ ${n}\n       ${e.message}`); fail++; } })(); PENDING.push(pr); return pr; };

function universal() {
  const fn = function () {};
  return new Proxy(fn, { get(tg, k) { if (k === Symbol.toPrimitive) return () => 1; if (k === 'then') return undefined; if (typeof k === 'symbol') return undefined; return universal(); }, apply: () => universal(), construct: () => universal(), has: () => true });
}
const STUB = ['@whiskeysockets/baileys', 'pino', 'qrcode', 'qrcode-terminal', 'ws', 'express', 'pm2', 'mongoose', 'ioredis', 'axios', 'node-cron', 'openai', '@google/generative-ai', '@huggingface/inference'];
const _load = Module._load;
Module._load = function (r, p, i) {
  if (STUB.some((s) => r === s || r.startsWith(s + '/'))) return universal();
  try { return _load.call(Module, r, p, i); } catch (e) { if (e.code === 'MODULE_NOT_FOUND') return universal(); throw e; }
};
process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {});
fs.rmSync('/tmp/a58test', { recursive: true, force: true });
fs.mkdirSync('/tmp/a58test/data', { recursive: true });

const MSM = require('./bots/MultiSocketManager');
const BASE = `http://127.0.0.1:${process.env.PORT}`;
const call = async (p, opts) => { const r = await fetch(BASE + p, opts); return { status: r.status, json: await r.json().catch(() => null) }; };
const POST = (p, body) => call(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ═══ 1. the token layer is gone ═══════════════════════════
console.log('\n── 1. no token anywhere ──');
t('utils/AstraLinkGuard.js is deleted from the repo', () => {
  assert.ok(!fs.existsSync('utils/AstraLinkGuard.js'), 'the guard file is still in the repo');
});
t('index.js has no token machinery left', () => {
  const src = fs.readFileSync('index.js', 'utf8');
  assert.ok(!/AstraLinkGuard|ASTRALINK_ADMIN_TOKEN|ADMIN_API_TOKEN|tokenOk|x-astralink-token/.test(src), 'index.js still references the token layer');
  assert.ok(!/\/api\/deploy/.test(src), 'the deploy endpoints survived');
  assert.ok(src.includes('alRateOk'), 'the rate-limit brake is gone');
});
t('the page has no owner-ops panel and no token field', () => {
  const html = fs.readFileSync('astralink.html', 'utf8');
  assert.ok(!/adminBar|admTok|opsDeploy|opsStatus|ASTRALINK_ADMIN_TOKEN|astralinkAdminToken/.test(html), 'the page still carries the token UI');
});
t('.env.example no longer documents the secret', () => {
  const env = fs.readFileSync('.env.example', 'utf8');
  assert.ok(!env.includes('ASTRALINK_ADMIN_TOKEN'), 'the secret is still documented');
  assert.ok(!env.includes('ASTRALINK_DEPLOY_CMD'), 'the deploy knob is still documented');
  assert.ok(env.includes('ASTRALINK_RATE_LIMIT'), 'the rate-limit knob is now undocumented');
});

// ═══ 2. the real routes on the open port ═══════════════════
console.log('\n── 2. open port, nobody needs a secret ──');
const _boot = async () => {
  await at('the server comes up and the page still loads', async () => {
    require('./index.js');
    await sleep(7000);
    const h = await call('/health');
    assert.strictEqual(h.status, 200); assert.strictEqual(h.json.status, 'ok');
    const page = await fetch(`${BASE}/astralink`); const html = await page.text();
    assert.ok(html.includes('Enter Your WhatsApp Number'), 'the page is not the link page');
    assert.ok(!html.includes('id="adminBar"'), 'the Owner ops panel is still in the page');
  });
  await at('the deploy endpoints are gone — 404, and nothing runs', async () => {
    const dep = await POST('/api/deploy');
    assert.strictEqual(dep.status, 404, `deploy answered ${dep.status} — the route survived`);
    const st = await call('/api/deploy-status');
    assert.strictEqual(st.status, 404, 'deploy-status is still reachable');
  });
  await at('linking is open: validation, not a token wall', async () => {
    const bad = await POST('/api/request-pairing-code', { personality: 'nope', phoneNumber: '2348012345678' });
    assert.strictEqual(bad.status, 400, `unknown personality should be a validation 400, got ${bad.status}`);
    assert.ok(!/token|secret|disabled/i.test(bad.json.error || ''), `the error still smells of the gate: ${bad.json.error}`);
    const bogus = await POST('/api/release-device-slots', { personality: 'zzz' });
    assert.strictEqual(bogus.status, 400, `release answered ${bogus.status}`);
  });
  await at('re-pairing an online bot is allowed now (the 401 unlink wall is down)', async () => {
    const K = 'kira';
    MSM._sockets()[K] = { user: { id: '555555555@s.whatsapp.net' } };   // linked and live
    const r = await POST('/api/request-pairing-code', { personality: K, phoneNumber: 'bad' });
    assert.strictEqual(r.status, 400, `expected a validation 400, got ${r.status} — the token wall is still up`);
    delete MSM._sockets()[K];
  });
  await at('the only thing left is the rate limit', async () => {
    let throttled = 0, accepted = 0;
    // now=1 keeps each call instant, so all of them land inside one rate window
    for (let i = 0; i < 14; i++) {
      const r = await call('/api/qr?personality=lunar&fresh=1&now=1');
      if (r.status === 429) throttled++; else accepted++;
    }
    assert.strictEqual(accepted, 6, `expected 6 allowed then throttling, got ${accepted} accepted / ${throttled} blocked`);
    assert.ok(throttled >= 8, 'a visitor can hammer fresh pairings with no limit');
  });
};
_boot().then(() => Promise.allSettled(PENDING)).then(() => {
  console.log(`\n${fail === 0 ? '✅' : '❌'} Push #58 harness (rewritten for Push #61) — PASS ${pass} FAIL ${fail} (${PENDING.length} async)`);
  process.exit(fail ? 1 : 0);
});
