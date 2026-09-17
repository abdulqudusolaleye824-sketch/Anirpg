// AniRPG — verification harness for Push #67 (console pairing CLI: node link.js)
//
// Closes the "first link" gap: /link (owner DM) needs an ONLINE bot to
// receive it, but the very first number has nothing online yet. `node link.js
// <bot>` runs the pairing straight from the terminal — same startAstraLink
// path, same console QR (Push #64) — so a fresh machine can be linked with
// nothing but a terminal.
'use strict';
process.chdir(__dirname);
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); console.log(`  ✅ ${n}`); pass++; } catch (e) { console.log(`  ❌ ${n}\n       ${e.message}`); fail++; } };

const src = fs.readFileSync(path.join(__dirname, 'link.js'), 'utf8');
const msmSrc = fs.readFileSync(path.join(__dirname, 'bots/MultiSocketManager.js'), 'utf8');

console.log('\nAniRPG — Push #67 verification: node link.js <bot> (console pairing)\n');

t('the CLI file exists and is a node script', () => {
  assert.ok(src.startsWith('#!'), 'shebang missing');
  assert.ok(src.includes("require('dotenv').config()"), 'must load .env (DATA_DIR/AUTH_DIR)');
});
t('it validates the bot name and lists available bots', () => {
  assert.ok(src.includes("PM.getAllPersonalities().includes(name)"), 'must check the bot exists');
  assert.ok(src.includes("Unknown bot"), 'must report unknown bots');
  assert.ok(src.includes('Usage: node link.js'), 'usage line');
});
t('it starts the REAL pairing path (startAstraLink, qr mode, forceRelink)', () => {
  assert.ok(src.includes('MSM.startAstraLink(name, AUTH_DIR, getDatabase, saveDatabase'), 'must call startAstraLink with the real auth dir + db');
  assert.ok(src.includes("pairingMode: 'qr'"), 'must pair by QR');
  assert.ok(src.includes('forceRelink: true'), 'must be able to relink a stale session');
});
t('it uses the JSON mirror for session bookkeeping (atomic tmp+rename)', () => {
  assert.ok(src.includes('database.json'), 'must read/write the JSON mirror');
  assert.ok(src.includes('.link-tmp'), 'writes must be atomic (tmp + rename)');
});
t('the QR actually prints in the terminal (Push #64 console path is what link.js relies on)', () => {
  assert.ok(msmSrc.includes("QRCode.toString(qr, { type: 'terminal', small: false, margin: 2 })"), 'MSM must render terminal QRs');
});
t('Ctrl+C keeps the partial session and exits cleanly', () => {
  assert.ok(src.includes("process.on('SIGINT'"), 'must handle Ctrl+C');
  assert.ok(src.includes('partial session kept'), 'must tell the user the session survives');
});

console.log(`\n${fail === 0 ? '✅ ALL' : '❌ SOME'} — ${pass}/${pass + fail} checks passed\n`);
process.exit(fail === 0 ? 0 : 1);
