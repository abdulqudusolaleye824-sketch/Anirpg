// AniRPG — Push #60 harness: routes match on the PATH, not the raw request line.
'use strict';
process.chdir(__dirname);
process.env.PORT = '3998';
process.env.AUTH_DIR = '/tmp/a60test/auth';
process.env.DATA_DIR = '/tmp/a60test/data';
process.env.ASTRALINK_ADMIN_TOKEN = 'harness-60-token';
delete process.env.ASTRALINK_IN_CONTAINER;
delete process.env.ASTRALINK_DEPLOY_CMD;
const assert = require('assert');
const fs = require('fs');
const Module = require('module');

let pass = 0, fail = 0;
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
fs.rmSync('/tmp/a60test', { recursive: true, force: true });
fs.mkdirSync('/tmp/a60test/data', { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const PersonalityManager = require('./bots/PersonalityManager');
const MSM = require('./bots/MultiSocketManager');
const BASE = `http://127.0.0.1:${process.env.PORT}`;
const raw = async (p, opts) => { const r = await fetch(BASE + p, opts); const t = await r.text(); return { status: r.status, text: t, json: (() => { try { return JSON.parse(t); } catch (e) { return null; } })() }; };

require('./index.js');

(async () => {
  await sleep(7000);
  console.log('\n── the path, not the query string ──');
  await at('the pairing page loads with a query string and with a trailing slash', async () => {
    const a = await raw('/astralink');
    assert.strictEqual(a.status, 200, `plain /astralink → ${a.status}`);
    assert.ok(a.text.includes('<html') || a.text.includes('<!DOCTYPE'), 'not HTML');
    for (const p of ['/astralink/', '/astralink?personality=gojo', '/astralink.html?tok=x', '/astralink/?x=1']) {
      const r = await raw(p);
      assert.strictEqual(r.status, 200, `${p} → ${r.status} (the route still compares req.url verbatim)`);
      assert.ok(r.text.length > 5000, `${p} returned a stub`);
    }
  });
  await at('/health and /api/bot-status survive the cache-buster every dashboard appends', async () => {
    const h = await raw('/health?ts=123');
    assert.strictEqual(h.status, 200, `/health?ts=… → ${h.status}`);
    assert.strictEqual(h.json.status, 'ok');
    // The route lists linked numbers; give it one the way a real link would.
    PersonalityManager.linkedNumbers['2348001112223@s.whatsapp.net'] = 'kira';
    MSM._pairing()['kira'] = { status: 'blocked', blocked: { code: 403, reason: 'harness', at: 1, attempts: 1 } };
    const b = await raw('/api/bot-status?x=1');
    assert.strictEqual(b.status, 200, `/api/bot-status?x=1 → ${b.status}`);
    assert.ok(Array.isArray(b.json.bots), 'bots array missing');
    assert.notStrictEqual(b.json.primary.connected, undefined, 'the status payload changed shape');
    const row = (b.json.bots || []).find((x) => x.key === 'kira');
    assert.ok(row, 'kira missing from bot-status');
    assert.strictEqual(row.blocked.code, 403, 'the blocked field from #59 was lost');
    delete PersonalityManager.linkedNumbers['2348001112223@s.whatsapp.net'];
    delete MSM._pairing()['kira'];
  });
  await at('the ops routes accept a token in the query string', async () => {
    const r = await raw('/api/deploy-status?token=harness-60-token');
    assert.strictEqual(r.status, 200, `deploy-status → ${r.status}`);
    assert.ok(/^[0-9a-f]{7,}/.test(r.json.head), `head not reported: ${r.json.head}`);
    const p = await raw('/api/qr-status?personality=gojo');
    assert.strictEqual(p.status, 200, `qr-status → ${p.status}`);
    const rel = await raw('/api/release-device-slots?token=harness-60-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personality: 'nobody' }) });
    assert.ok(rel.status === 400 || rel.status === 502 || rel.status === 200, `release accepted an unknown personality: ${rel.status} ${rel.text.slice(0, 120)}`);
  });
  await at('tightened: POST /api/deploy-status can no longer trigger a deploy', async () => {
    const r = await raw('/api/deploy-status?token=harness-60-token', { method: 'POST' });
    assert.strictEqual(r.status, 404, `a POST to the status route did something (${r.status})`);
    assert.ok(!fs.existsSync('/tmp/a60test/data/.deploy.lock'), 'a deploy lock appeared anyway');
  });
  await at('an unknown path is still a 404 (nothing over-matched)', async () => {
    const r = await raw('/astralink-x?y=1');
    assert.strictEqual(r.status, 404);
    const g = await raw('/api/nope');
    assert.strictEqual(g.status, 404);
  });
  await at('a hostile request line does not crash the server', async () => {
    // Raw socket on purpose: fetch()/URL would normalise `..` away before sending.
    const net = require('net');
    const st = await new Promise((resolve) => {
      const sock = net.connect(process.env.PORT, '127.0.0.1', () => {
        sock.write('GET /../../etc/passwd HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n');
      });
      let buf = '';
      sock.setTimeout(4000, () => { sock.destroy(); resolve('timeout'); });
      sock.on('data', (d) => { buf += d.toString(); });
      sock.on('end', () => resolve((buf.match(/^HTTP\/1\.1 (\d+)/) || [])[1] || 'garbage'));
      sock.on('error', () => resolve('conn-error'));
    });
    assert.ok(['400', '404'].includes(st), `weird path produced ${st}`);
    const h = await raw('/health');
    assert.strictEqual(h.status, 200, 'the server died on a weird path');
  });

  console.log(`\n${fail === 0 ? '✅' : '❌'} Push #60 harness: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
