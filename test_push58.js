// AniRPG — Push #58 harness: the AstraLink admin gate + remote deploy.
// Boots the real HTTP server (stubs for WhatsApp/redis/etc.) and drives the
// routes over the network, because "who can call what on a public port" is the
// whole point of the change.
'use strict';
process.chdir(__dirname);
process.env.PORT = '3997';
process.env.AUTH_DIR = '/tmp/a58test/auth';
process.env.DATA_DIR = '/tmp/a58test/data';
process.env.ASTRALINK_DEPLOY_LOG_DIR = '/tmp/a58test/logs';
process.env.ASTRALINK_DEPLOY_CMD = "echo '🚀 deploy dry run'; echo ' ✅ DEPLOY COMPLETE'";
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
fs.mkdirSync('/tmp/a58test/logs', { recursive: true });
fs.mkdirSync('/tmp/a58test/data', { recursive: true });

const G = require('./utils/AstraLinkGuard');
const MSM = require('./bots/MultiSocketManager');
const BASE = `http://127.0.0.1:${process.env.PORT}`;
const call = async (p, opts) => { const r = await fetch(BASE + p, opts); return { status: r.status, json: await r.json().catch(() => null) }; };
const POST = (p, body) => call(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });

// ═══ 1. the guard itself ═══════════════════════════════════
console.log('\n── 1. AstraLinkGuard ──');
const fakeRes = () => { const out = {}; return { res: { writeHead(c) { out.code = c; }, end(s) { out.body = s; } }, out }; };
t('locked mode fails CLOSED when no token is configured', () => {
  delete process.env.ASTRALINK_ADMIN_TOKEN;
  const { res, out } = fakeRes();
  assert.strictEqual(G.gate(res, { headers: {} }, { searchParams: new URLSearchParams() }, { mode: 'locked' }), false, 'allowed with no secret set!');
  const body = JSON.parse(out.body);
  assert.strictEqual(out.code, 503); assert.strictEqual(body.disabled, true);
  assert.match(body.error, /ASTRALINK_ADMIN_TOKEN/, 'the refusal does not say how to enable it');
});
t('wrong token is 401, right token passes — via query, header or bearer', () => {
  process.env.ASTRALINK_ADMIN_TOKEN = 'unit-test-secret-value';
  const mk = () => fakeRes();
  let a = mk(); assert.strictEqual(G.gate(a.res, { headers: {} }, { searchParams: new URLSearchParams('token=nope') }, { mode: 'locked' }), false); assert.strictEqual(a.out.code, 401);
  for (const [hdr, qs] of [[{ 'x-astralink-token': 'unit-test-secret-value' }, ''], [{}, 'token=unit-test-secret-value'], [{ authorization: 'Bearer unit-test-secret-value' }, '']]) {
    assert.strictEqual(G.gate(mk().res, { headers: hdr }, { searchParams: new URLSearchParams(qs) }, { mode: 'locked' }), true, `rejected a valid ${JSON.stringify(hdr)} ${qs}`);
  }
  assert.strictEqual(G.tokenOk({ headers: {} }, { searchParams: new URLSearchParams('token=unit-test-secret-valu') }), false, 'a prefix of the token was accepted');
  process.env.ASTRALINK_ADMIN_TOKEN = '';
});
t('soft mode keeps linking usable but rate-limits it', () => {
  G._buckets.clear();
  let allowed = 0, limited = 0;
  for (let i = 0; i < 20; i++) { const { res } = fakeRes(); if (G.gate(res, { headers: {} }, { searchParams: new URLSearchParams() }, { mode: 'soft', bucket: 'unit' })) allowed++; else limited++; }
  assert.strictEqual(allowed, 6, `allowed ${allowed}`);
  assert.ok(limited >= 14, 'no throttle');
  G._buckets.clear();
});

// ═══ 2. the real routes, unauthenticated (the state the public port is in) ═══
console.log('\n── 2. public port, no token configured ──');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const _boot = async () => {
  await at('the server comes up and the page still loads', async () => {
    require('./index.js');
    await sleep(7000);
    const h = await call('/health');
    assert.strictEqual(h.status, 200); assert.strictEqual(h.json.status, 'ok');
    const page = await fetch(`${BASE}/astralink`); const html = await page.text();
    assert.ok(html.includes('id="adminBar"'), 'the Owner ops panel is not in the page');
    assert.ok(html.includes('id="admTok"') && html.includes('opsDeploy'), 'no token field / deploy button');
  });
  await at('destructive endpoints refuse, and say how to unlock them', async () => {
    const rel = await POST('/api/release-device-slots', { personality: 'gojo' });
    assert.strictEqual(rel.status, 503, `release-device-slots answered ${rel.status}`);
    assert.strictEqual(rel.json.disabled, true);
    assert.match(rel.json.error, /ASTRALINK_ADMIN_TOKEN/);
    const dep = await POST('/api/deploy');
    assert.strictEqual(dep.status, 503, `deploy answered ${dep.status}`);
    assert.strictEqual(dep.json.disabled, true);
    const st = await call('/api/deploy-status');
    assert.strictEqual(st.status, 503, 'deploy-status leaks state without a token');
    assert.ok(!fs.existsSync('/tmp/a58test/logs') || fs.readdirSync('/tmp/a58test/logs').length === 0, 'a deploy ran without authorization');
  });
  await at('linking itself is NOT locked out — only throttled', async () => {
    const bad = await POST('/api/request-pairing-code', { personality: 'nope', phoneNumber: '2348012345678' });
    assert.ok(bad.status === 400 || bad.status === 200, `unknown personality should be validated, got ${bad.status}`);
    assert.notStrictEqual(bad.status, 503, 'pairing was disabled outright');
    const q = await call('/api/qr?personality=gojo&now=1');
    assert.strictEqual(q.status, 200); assert.notStrictEqual(q.json.error, undefined);
    let throttled = 0, accepted = 0;
    // now=1 keeps each call instant, so all of them land inside one rate window
    for (let i = 0; i < 14; i++) {
      const r = await call('/api/qr?personality=lunar&fresh=1&now=1');
      if (r.status === 429) throttled++; else accepted++;
    }
    assert.strictEqual(accepted, 6, `expected 6 allowed then throttling, got ${accepted} accepted / ${throttled} blocked`);
    assert.ok(throttled >= 8, 'an anonymous visitor can hammer fresh pairings with no limit');
  });

  // ═══ 3. with a token configured ═══════════════════════════
  console.log('\n── 3. token configured: the owner can actually deploy ──');
  await at('token checks are enforced on every state-changing route', async () => {
    process.env.ASTRALINK_ADMIN_TOKEN = 'harness-admin-token';
    assert.strictEqual((await POST('/api/deploy')).status, 401, 'deploy ran with no token');
    assert.strictEqual((await call('/api/deploy-status')).status, 401, 'status readable with no token');
    assert.strictEqual((await POST('/api/release-device-slots', { personality: 'gojo' })).status, 401, 'release ran with a missing token');
    const wrong = await POST('/api/deploy?token=harness-admin-toke');
    assert.strictEqual(wrong.status, 401, 'a near-miss token was accepted');
  });
  await at('the right token runs the deploy and reports it', async () => {
    const tok = '?token=harness-admin-token';
    const r = await POST(`/api/deploy${tok}`);
    assert.strictEqual(r.status, 200, `deploy refused: ${JSON.stringify(r.json)}`);
    assert.strictEqual(r.json.started, true);
    assert.ok(r.json.headBefore && r.json.headBefore.length >= 6, 'no HEAD reported');
    assert.ok(!JSON.stringify(r.json).includes('harness-admin-token'), 'the response echoes the token');
    await sleep(2500);
    const st = await call(`/api/deploy-status${tok}`);
    assert.strictEqual(st.status, 200);
    assert.strictEqual(st.json.state, 'complete', `deploy did not finish: ${JSON.stringify(st.json).slice(0, 200)}`);
    assert.match(st.json.logTail, /DEPLOY COMPLETE/);
    assert.ok(/^[0-9a-f]{7,40}$/.test(st.json.head), `HEAD not reported: ${st.json.head}`);
    const files = fs.readdirSync('/tmp/a58test/logs').filter(f => f.startsWith('deploy-'));
    assert.strictEqual(files.length, 1, `${files.length} deploy logs written`);
    const log = fs.readFileSync(`/tmp/a58test/logs/${files[0]}`, 'utf8');
    assert.ok(!log.includes('harness-admin-token'), 'the token was written into the deploy log');
  });
  await at('a running deploy cannot be stacked on top of itself', async () => {
    fs.writeFileSync('/tmp/a58test/data/.deploy.lock', String(process.pid));
    const r = await POST('/api/deploy?token=harness-admin-token');
    assert.strictEqual(r.status, 409, `second deploy accepted (${r.status})`);
    assert.match(r.json.error, /already running/i);
    fs.rmSync('/tmp/a58test/data/.deploy.lock', { force: true });
  });
  await at('a stranger still cannot unlink an online bot through pairing', async () => {
    const K = 'kira';
    MSM._sockets()[K] = { user: { id: '555555555@s.whatsapp.net' } };   // linked and live
    process.env.ASTRALINK_ADMIN_TOKEN = '';
    G._buckets.clear();
    const anon = await POST('/api/request-pairing-code', { personality: K, phoneNumber: '2348012345678' });
    assert.strictEqual(anon.status, 401, `pairing an ONLINE bot was allowed anonymously (${anon.status})`);
    assert.match(anon.json.error, /online/i, 'the refusal does not explain that this unlinks it');
    // Put the secret back: with no token configured there is no owner to honour,
    // and 401 for an online bot would be the correct answer. (This assertion used
    // to pass vacuously because a query string kept the request off the route.)
    process.env.ASTRALINK_ADMIN_TOKEN = 'harness-admin-token';
    const tokd = await POST(`/api/request-pairing-code?token=harness-admin-token`, { personality: K, phoneNumber: 'bad' });
    assert.notStrictEqual(tokd.status, 401, `the token was not honoured for the owner (${JSON.stringify(tokd.json).slice(0, 140)})`);
    assert.strictEqual(tokd.status, 400, 'a bad phone number must be rejected by validation, not the gate');
    delete MSM._sockets()[K];
  });
  t('the token never reaches stdout or the UI markup', () => {
    const src = fs.readFileSync('index.js', 'utf8');
    const line = src.split('\n').find(l => l.includes('AstraLink deploy started'));
    assert.ok(!/token/i.test(line), `the deploy log line risks the token: ${line.trim()}`);
    const html = fs.readFileSync('astralink.html', 'utf8');
    assert.ok(!/localStorage\.setItem\([^)]*ASTRALINK/.test(html));
    assert.ok(html.includes("type=\"password\""), 'the token field is not masked');
    assert.ok(src.includes("x-astralink-token, authorization"), 'CORS does not allow the token header');
  });
  t('.env.example documents the secret and the knobs', () => {
    const env = fs.readFileSync('.env.example', 'utf8');
    assert.ok(env.includes('ASTRALINK_ADMIN_TOKEN='), 'no ASTRALINK_ADMIN_TOKEN entry');
    assert.match(env, /openssl rand -hex 24/, 'no way to generate one');
    assert.ok(env.includes('ASTRALINK_QR_TTL_MS'), 'the QR lifetime knob is undocumented');
  });
};
_boot().then(() => Promise.allSettled(PENDING)).then(() => {
  console.log(`\n${fail === 0 ? '✅' : '❌'} Push #58 harness — PASS ${pass} FAIL ${fail} (${PENDING.length} async)`);
  process.exit(fail ? 1 : 0);
});
