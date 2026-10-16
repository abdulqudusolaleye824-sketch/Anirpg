// ═══════════════════════════════════════════════════════════════
// Astra — Per-player command cooldowns (Push #97)
//
// EVERY command has a cooldown of 5–50 s that applies to the player who used
// it only (other hunters are unaffected). Owners are exempt. Pro hunters get
// 25% off. Owner overrides live in db.cmdCooldowns[name] = seconds.
//   • rarely used / daily / owner spawn → 5 s
//   • spam-prone battle commands (attack…) → 30 s
//   • casino / gambling → 50 s
//   • everything else → 8 s
// ═══════════════════════════════════════════════════════════════
'use strict';

const DEFAULT_S = 8, MIN_S = 5, MAX_S = 50;
const TABLE = {
  // 50 s — gambling
  casino: 50, slots: 50, gamble: 50, bet: 50, coinflip: 50, dice: 50, rob: 50, steal: 50, lottery: 50, guess: 50,
  // 30 s — spam-prone battle actions
  attack: 30, a: 30, attacks: 30, skill: 30, s: 30, cast: 30, hit: 30, strike: 30, hunt: 30, fight: 30, pvp: 30, duel: 30, battle: 30, teampvp: 30, boss: 30, catch: 15 /* Push #102h BUG-060 */, summon: 20, domain: 20,
  // 15 s — raid helpers
  heal: 15, buff: 15, guard: 15, flee: 15, revive: 15, mine: 15, party: 10, gateraid: 15, dungeon: 15, instance: 10, labyrinth: 10, event: 15,
  // 5 s — rarely used / daily / owner-side
  daily: 5, weekly: 5, claim: 5, help: 5, menu: 5, register: 5, link: 5, ping: 5, rules: 5, version: 5, bots: 5, start: 5, starts: 5, afk: 5,
  spawn: 5, spawnstatus: 5, killspawn: 5, artifactspawn: 5, addxp: 5, addnexus: 5, addup: 5, addmana: 5, exile: 5, kill: 5, reset: 5, closeall: 5, openall: 5, dbdump: 5, bots: 5, bugs: 5, bug: 5, announce: 5, broadcast: 5, restart: 5, maintenance: 5, closegate: 5, forceclear: 5, update: 5,
  ban: 5, unban: 5, mute: 5, unmute: 5, warn: 5, kick: 5, promote: 5, demote: 5, disable: 5, enable: 5, open: 5, close: 5, confirm: 5, cancel: 5,
};
const _last = new Map(); // `${sender}|${cmd}` → timestamp (per process; a restart simply clears cooldowns)

function secondsFor(cmd, db) {
  const n = String(cmd || '').toLowerCase();
  const over = db && db.cmdCooldowns && Number(db.cmdCooldowns[n]);
  const s = over > 0 ? over : (TABLE[n] != null ? TABLE[n] : DEFAULT_S);
  return Math.max(MIN_S, Math.min(MAX_S, s));
}
function _isOwner(db, sender) { try { return !!require('../../utils/permissions').isBotOwner(db, sender); } catch (e) { return false; } }
function _isPro(player) { try { return !!require('./UI').isPro(player || {}); } catch (e) { return false; } }

// Returns null when the command may run (and arms the cooldown), else { left, total, text }.
const NO_COOLDOWN = new Set(['hi', 'hello', 'hey', 'botpersonality']); // Push #102d: greeting the bot is never throttled
function check(db, sender, cmd, opts = {}) {
  if (!sender || !cmd) return null;
  if (NO_COOLDOWN.has(String(cmd).toLowerCase())) return null;
  if (opts.exempt || _isOwner(db, sender)) return null;
  const player = db && db.users ? db.users[sender] : null;
  let total = secondsFor(cmd, db);
  if (_isPro(player)) total = Math.max(MIN_S, Math.round(total * 0.75));
  const key = `${sender}|${String(cmd).toLowerCase()}`;
  const now = opts.now || Date.now();
  const last = _last.get(key) || 0;
  const left = Math.ceil((last + total * 1000 - now) / 1000);
  if (last && left > 0) return { left, total, text: `⏳ *This command is still on cooldown for you* — *${left}s* left (${cmd}: ${total}s${_isPro(player) ? ', Pro −25%' : ''}).` };
  _last.set(key, now);
  if (_last.size > 50000) { for (const [k, v] of _last) if (now - v > 120000) _last.delete(k); }
  return null;
}
function clear(sender, cmd) { if (cmd) _last.delete(`${sender}|${String(cmd).toLowerCase()}`); else for (const k of [..._last.keys()]) if (k.startsWith(`${sender}|`)) _last.delete(k); }
function setOverride(db, cmd, seconds) {
  const n = String(cmd || '').toLowerCase(); const s = Number(seconds);
  if (!n || !(s >= MIN_S && s <= MAX_S)) return { ok: false, error: `❌ Seconds must be ${MIN_S}–${MAX_S}.` };
  if (!db.cmdCooldowns) db.cmdCooldowns = {};
  db.cmdCooldowns[n] = s;
  return { ok: true, line: `⏱️ */${n}* cooldown set to *${s}s* per player (Pro ${Math.max(MIN_S, Math.round(s * 0.75))}s, owners exempt).` };
}
function table(db) { const names = new Set([...Object.keys(TABLE), ...Object.keys((db && db.cmdCooldowns) || {})]); return [...names].sort().map(n => ({ cmd: n, seconds: secondsFor(n, db) })); }

// Push #102h (BUG-084): every command cooldown still ticking for this hunter (for /cooldowns).
function active(db, sender, now = Date.now()) {
  const out = []; if (!sender) return out;
  const player = db && db.users ? db.users[sender] : null; const pro = _isPro(player);
  for (const [k, last] of _last) {
    if (!k.startsWith(`${sender}|`)) continue;
    const cmd = k.slice(sender.length + 1);
    let total = secondsFor(cmd, db); if (pro) total = Math.max(MIN_S, Math.round(total * 0.75));
    const left = Math.ceil((last + total * 1000 - now) / 1000);
    if (left > 0) out.push({ cmd, left, total });
  }
  return out.sort((a, b) => b.left - a.left);
}
module.exports = { active, TABLE, DEFAULT_S, MIN_S, MAX_S, secondsFor, check, clear, setOverride, table, _last };
