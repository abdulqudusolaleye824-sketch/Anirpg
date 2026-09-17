#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// AniRPG — console pairing CLI (Push #67)
//
// The classic link flow, straight from the terminal:
//
//     node link.js <botname>
//
// Starts a pairing socket for <botname> and the QR prints in THIS terminal
// (rotating every QR_VALID_MS — screenshot the NEWEST one and scan it with
// the bot's phone). Works even when NO bot is online — that is how the very
// first number gets linked. For day-to-day linking while a bot is online,
// use the owner DM command /link <bot> instead (same flow, same console QR).
//
// Partial sessions are kept on disk: if you Ctrl+C before scanning, the next
// run (or the bot's own boot) picks the pairing back up.
'use strict';
require('dotenv').config();

const path = require('path');
const fs = require('fs');

const name = (process.argv[2] || '').toLowerCase();
const PM = require('./bots/PersonalityManager');
const MSM = require('./bots/MultiSocketManager');

if (!name) {
  console.log('Usage: node link.js <botname>');
  console.log('Bots:  ' + PM.getAllPersonalities().join(', '));
  process.exit(1);
}
if (!PM.getAllPersonalities().includes(name)) {
  console.error(`Unknown bot "${name}". Bots: ${PM.getAllPersonalities().join(', ')}`);
  process.exit(1);
}

const DATA_DIR = process.env.DATA_DIR || __dirname;
const AUTH_DIR = process.env.AUTH_DIR || path.join(DATA_DIR, 'auth');
const DB_FILE  = path.join(DATA_DIR, 'database', 'database.json');

// Minimal DB shim — linking only needs the session bookkeeping, not game data.
// The JSON mirror is read/written directly so the real bot (if running) and
// this CLI can never disagree about what is linked.
let database = { users: {}, banlist: {}, botMods: [], botOwners: [] };
try { if (fs.existsSync(DB_FILE)) database = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); } catch (e) { console.warn('⚠️ could not read', DB_FILE, '—', e.message); }
const getDatabase = () => database;
const saveDatabase = () => {
  try {
    database.__savedAt = Date.now();
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    const tmp = DB_FILE + '.link-tmp';
    fs.writeFileSync(tmp, JSON.stringify(database));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) { console.warn('⚠️ could not save', DB_FILE, '—', e.message); }
};

console.log(`🔗 Pairing "${name}" — the QR will print below within a few seconds.`);
console.log(`   (rotates every ${Math.round((MSM.QR_VALID_MS || 20000) / 1000)}s — screenshot the NEWEST one,\n   scan it with ${PM.getDisplayName(name)}'s phone, then Ctrl+C here.)`);

MSM.startAstraLink(name, AUTH_DIR, getDatabase, saveDatabase, {
  pairingMode: 'qr',
  forceRelink: true,
}).then((r) => {
  if (r && r.reused) console.log('ℹ️ A pairing was already in flight — its QR is in this terminal (or was printed just before).');
  else console.log('✅ Pairing socket started — waiting for the QR…');
}).catch((e) => {
  console.error('❌ Could not start pairing:', e.message);
  process.exit(1);
});

// Keep the process alive while the pairing socket runs.
process.on('SIGINT', () => {
  console.log('\n👋 Stopping (partial session kept — re-run `node link.js ' + name + '` to continue).');
  try { MSM.getAllSockets ? Object.values(MSM.getAllSockets() || {}).forEach(s => { try { s.end(); } catch {} }) : null; } catch {}
  process.exit(0);
});
