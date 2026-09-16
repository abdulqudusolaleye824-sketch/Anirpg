// AniRPG — Push #59 harness: a WhatsApp 403 is treated as a block, and the
// deploy endpoints stop pretending they can update a Docker container.
'use strict';
process.chdir(__dirname);
process.env.PORT = '3999';
process.env.AUTH_DIR = '/tmp/a59test/auth';
process.env.DATA_DIR = '/tmp/a59test/data';
process.env.ASTRALINK_DEPLOY_LOG_DIR = '/tmp/a59test/logs';
// Deliberately NOT set at boot: the container guard must refuse ./deploy.sh.
delete process.env.ASTRALINK_DEPLOY_CMD;
process.env.ASTRALINK_IN_CONTAINER = '1';
process.env.ASTRALINK_ADMIN_TOKEN = 'harness-59-token';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
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
fs.rmSync('/tmp/a59test', { recursive: true, force: true });
fs.mkdirSync('/tmp/a59test/logs', { recursive: true });
fs.mkdirSync('/tmp/a59test/data', { recursive: true });

const MSM = require('./bots/MultiSocketManager');
const PersonalityManager = require('./bots/PersonalityManager');
const BASE = `http://127.0.0.1:${process.env.PORT}`;
const call = async (p, opts) => { const r = await fetch(BASE + p, opts); return { status: r.status, json: await r.json().catch(() => null), text: undefined }; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ═══ 1. the policy itself (pure, real code) ═══════════════
console.log('\n── 1. reconnectPolicy ──');
t('403 is reported as a block with an actionable reason', () => {
  const p = MSM.reconnectPolicy({ code: 403, attempt: 1 });
  assert.strictEqual(p.blocked, true);
  assert.match(p.reason, /403/);
  assert.match(p.reason, /request a review/i, 'the operator is not told what actually fixes it');
  assert.match(p.reason, /QR/i, 'the operator is not told that re-scanning cannot help');
});
t('403 backs off minutes→hours, so the block stops being hammered', () => {
  const steps = [1, 2, 3, 4, 5, 6, 40].map((n) => MSM.reconnectPolicy({ code: 403, attempt: n }).backoffMs);
  assert.deepStrictEqual(steps.slice(0, 6), [300000, 600000, 1200000, 2400000, 4800000, 9600000], JSON.stringify(steps));
  assert.ok(steps.every((ms) => ms >= 300000), 'the first blocked retry is still too eager');
  assert.ok(steps[6] >= 3600000, `long-run backoff collapsed to ${steps[6]}ms — that is a reconnect storm`);
  assert.ok(steps[6] <= 6 * 3600000, 'backoff escaped its ceiling');
});
t('ordinary closes ramp up and stop at BOT_RECONNECT_MAX_MS (not 30s forever)', () => {
  assert.strictEqual(MSM.reconnectPolicy({ code: 428, attempt: 1 }).backoffMs, 3000);
  assert.strictEqual(MSM.reconnectPolicy({ code: 500, attempt: 5 }).backoffMs, 11000);
  assert.strictEqual(MSM.reconnectPolicy({ code: 428, attempt: 5000 }).backoffMs, MSM.RECONNECT_MAX_MS);
  assert.strictEqual(MSM.reconnectPolicy({ code: 428, attempt: 3 }).blocked, false, 'an ordinary close must not be labelled a block');
  assert.strictEqual(MSM.RECONNECT_MAX_MS, 300000, 'the documented default changed');
});
t('515 restartRequired stays fast (it wants a quick fresh connect, not a wait)', () => {
  assert.strictEqual(MSM.reconnectPolicy({ code: 515, attempt: 9, restartRequired: true }).backoffMs, 1200);
});

// ═══ 2. block state is visible to the API ══════════════════
console.log('\n── 2. the block reaches the operator ──');
const K = 'kira';
MSM._pairing()[K] = {
  status: 'blocked', method: 'qr', phoneNumber: null, code: null, qr: null, qrDataUrl: null,
  jid: null, startedAt: Date.now(),
  error: 'blocked', blocked: { code: 403, reason: 'simulated 403 for the harness', at: 1234, attempts: 7 },
};
t('getLatestQr surfaces the block instead of "waiting for a code"', () => {
  const q = MSM.getLatestQr(K);
  assert.strictEqual(q.blocked.code, 403);
  assert.strictEqual(q.blocked.attempts, 7);
  assert.strictEqual(q.status, 'blocked');
});
t('bot-status carries the block per bot', () => {
  const all = MSM.listPairingSessions();
  assert.strictEqual(all[K].blocked.code, 403);
  assert.strictEqual(all.gojo, undefined, 'a persona with no pairing session should not be invented');
});

// ═══ 3. the live routes ════════════════════════════════════
console.log('\n── 3. routes ──');
const _boot = (async () => {
  require('./index.js');
  await sleep(7000);
})();

(async () => {
  await _boot;
  await at('server is up', async () => {
    const h = await call('/health');
    assert.strictEqual(h.status, 200); assert.strictEqual(h.json.status, 'ok');
  });
  await at('a blocked number is refused politely, not re-paired', async () => {
    const r = await call(`/api/qr?personality=${K}&now=1`);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.blocked, true, JSON.stringify(r.json).slice(0, 200));
    assert.strictEqual(r.json.success, false);
    assert.match(r.json.error, /simulated 403/);
    assert.strictEqual(r.json.retryInMs, 600000, 'the page is told to keep hammering');
    assert.ok(!r.json.qr && !r.json.dataUri, 'a code was handed out anyway');
  });
  await at('an explicit "New code" (fresh=1) still forces a retry', async () => {
    const r = await call(`/api/qr?personality=${K}&fresh=1&now=1&token=harness-59-token`);
    assert.notStrictEqual(r.json.blocked, true, `the manual retry was refused too (${JSON.stringify(r.json).slice(0, 160)})`);
  });
  await at('/api/bot-status reports the block for that bot', async () => {
    // The route lists *linked* numbers; register kira the way a real link would.
    PersonalityManager.linkedNumbers['2348001112223@s.whatsapp.net'] = K;
    // (the fresh=1 check above legitimately cleared the marker — that is the
    //  retry hatch working — so put the block back to test the listing)
    MSM._pairing()[K] = { status: 'blocked', error: 'blocked', blocked: { code: 403, reason: 'simulated 403 for the harness', at: 1234, attempts: 7 } };
    const r = await call('/api/bot-status');
    assert.strictEqual(r.status, 200);
    const row = (r.json.bots || []).find((b) => b.key === K);
    assert.ok(row, `${K} missing from bot-status`);
    assert.ok(row.blocked, 'no blocked field: the UI cannot show 403');
    assert.match(row.blocked.reason, /simulated 403/);
  });
  await at('deploy inside a container refuses instead of lying', async () => {
    const r = await call('/api/deploy?token=harness-59-token', { method: 'POST' });
    assert.strictEqual(r.status, 409, `got ${r.status}: ${JSON.stringify(r.json)}`);
    assert.strictEqual(r.json.inContainer, true);
    assert.match(r.json.error, /container/i);
    assert.match(r.json.error, /auto-update\.sh/, 'the refusal does not name the thing that does work');
    assert.strictEqual(fs.readdirSync('/tmp/a59test/logs').filter((f) => f.startsWith('deploy-')).length, 0, 'a useless deploy ran anyway');
    assert.ok(!fs.existsSync('/tmp/a59test/data/.deploy.lock'), 'a lock was left behind by a refused deploy');
  });
  await at('…and obeys ASTRALINK_DEPLOY_CMD when the operator knows better', async () => {
    process.env.ASTRALINK_DEPLOY_CMD = "echo '🚀 host deploy'; echo ' ✅ DEPLOY COMPLETE'";
    const r = await call('/api/deploy?token=harness-59-token', { method: 'POST' });
    assert.strictEqual(r.status, 200, JSON.stringify(r.json).slice(0, 200));
    assert.strictEqual(r.json.started, true);
    assert.ok(!JSON.stringify(r.json).includes('harness-59-token'), 'the token was echoed back');
    await sleep(2500);
    const st = await call('/api/deploy-status?token=harness-59-token');
    assert.strictEqual(st.json.state, 'complete', JSON.stringify(st.json).slice(0, 200));
    assert.match(st.json.logTail, /DEPLOY COMPLETE/);
    assert.ok(!JSON.stringify(st.json).includes('harness-59-token'), 'the token reached the log tail');
  });
  await at('deploy-status names the running build (no .git needed)', async () => {
    const vf = path.join(__dirname, 'VERSION');
    const had = fs.existsSync(vf);
    const before = had ? fs.readFileSync(vf, 'utf8') : null;
    fs.writeFileSync(vf, 'feedface (🚫 Push #59: test subject)\nextra noise\n');
    const viaFile = await call('/api/deploy-status?token=harness-59-token');
    assert.strictEqual(viaFile.json.head, 'feedface (🚫 Push #59: test subject)', `VERSION not honoured: ${viaFile.json.head}`);
    assert.notStrictEqual(viaFile.json.head, 'unknown', 'still blind about which build is live');
    if (had) fs.writeFileSync(vf, before); else fs.rmSync(vf, { force: true });
  });
  await at('a stranger cannot reach any of it: 401 with a token set, 503 fail-closed without', async () => {
    const a = await call('/api/deploy', { method: 'POST' });
    assert.strictEqual(a.status, 401, `deploy with no token answered ${a.status}`);
    assert.strictEqual(a.json.needsToken, true);
    process.env.ASTRALINK_ADMIN_TOKEN = '';
    const b = await call('/api/deploy', { method: 'POST' });
    assert.strictEqual(b.status, 503, `unconfigured deploy answered ${b.status} — must fail CLOSED`);
    assert.strictEqual(b.json.disabled, true);
    assert.match(b.json.error, /ASTRALINK_ADMIN_TOKEN/);
    process.env.ASTRALINK_ADMIN_TOKEN = 'harness-59-token';
  });
  delete MSM._pairing()[K];
  delete MSM._sockets()[K];
  delete PersonalityManager.linkedNumbers['2348001112223@s.whatsapp.net'];
  t('UI + docs cover the block and the knobs', () => {
    const html = fs.readFileSync('astralink.html', 'utf8');
    assert.match(html, /blocked this number/i, 'the pairing page never mentions the block');
    assert.match(html, /Request a review/i, 'the page does not say what to do on the phone');
    assert.match(html, /BLOCKED/, 'no blocked chip in Bot status');
    assert.match(html, /blockedIds/, 'a blocked persona is still selectable as if it were free');
    const src = fs.readFileSync('index.js', 'utf8');
    assert.match(src, /q\.blocked && !wantFresh/, 'the qr route lost the block check');
    assert.match(src, /ASTRALINK_IN_CONTAINER|\/\.dockerenv/, 'the container guard was removed');
    const env = fs.readFileSync('.env.example', 'utf8');
    assert.match(env, /BOT_RECONNECT_MAX_MS/, 'the reconnect ceiling is undocumented');
    const git = fs.readFileSync('.gitignore', 'utf8');
    assert.match(git, /^VERSION$/m, 'the host-generated VERSION file would be committed by auto-update');
  });

  console.log(`\n${fail === 0 ? '✅' : '❌'} Push #59 harness: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
