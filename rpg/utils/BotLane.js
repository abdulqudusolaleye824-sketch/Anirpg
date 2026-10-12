// ════════════════════════════════════════════════════════════════════
// BOT LANES — Push #97
//
// Every linked bot runs in its own LANE: an isolated execution context that
// follows a message from the socket that heard it through every await, timer
// and helper until the reply leaves. The lane is what makes battle flows
// private to the bot that runs them:
//
//   • every inbound message is handled inside `run(botKey, …)`;
//   • `current()` tells any module which bot is doing the work — no plumbing;
//   • battles (gate raids, dungeon parties, labyrinths) are stamped with the
//     lane that opened them; another bot's lane may not drive them unless the
//     owning bot is dead/killed (then the group's live bot takes over, announced);
//   • per-lane scratch (`scratch()`) replaces module-level "last result" slots
//     so two fights resolving at the same time can never read each other;
//   • `/kill <bot>` parks a lane: the killed bot drops EVERY inbound message
//     (owner included), never sends, is skipped by every "pick a socket"
//     helper, and keeps ignoring the world until `/reset <bot>` from another
//     bot (or a restart) brings it back.
//
// Bots linked in the future get a lane automatically — a lane is just the key.
// ════════════════════════════════════════════════════════════════════
'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const als = new AsyncLocalStorage();
const _killed = new Map(); // botKey -> { at, by }
let _msm = null; // lazy MultiSocketManager (never required in tests)

function run(botKey, fn) {
  const store = { bot: botKey || null, scratch: {}, at: Date.now() };
  return als.run(store, fn);
}
function current() { const s = als.getStore(); return s && s.bot ? s.bot : null; }
function scratch() { const s = als.getStore(); if (!s) return _fallbackScratch; return s.scratch; }
const _fallbackScratch = {}; // timers / tests outside any lane

// ── kill / reset ──────────────────────────────────────────────────
function kill(botKey, by) { if (!botKey) return false; _killed.set(botKey, { at: Date.now(), by: by || null }); return true; }
function reset(botKey) { return _killed.delete(botKey); }
function isKilled(botKey) { return !!botKey && _killed.has(botKey); }
function killedList() { return [..._killed.entries()].map(([k, v]) => ({ key: k, ...v })); }

// ── bot name resolution (for /kill <bot> & /reset <bot>) ──────────
function resolveBotKey(nameOrKey) {
  const q = String(nameOrKey || '').trim().toLowerCase().replace(/^@/, '');
  if (!q) return null;
  let PM = null; try { PM = require('../../bots/PersonalityManager'); } catch (e) { return null; }
  const keys = (PM.getAllPersonalities && PM.getAllPersonalities()) || [];
  for (const k of keys) if (k.toLowerCase() === q) return k;
  for (const k of keys) { let d = ''; try { d = String(PM.getDisplayName(k) || ''); } catch (e) {} if (d.toLowerCase() === q) return k; }
  for (const k of keys) { let d = ''; try { d = String(PM.getDisplayName(k) || ''); } catch (e) {} if (d.toLowerCase().startsWith(q) || k.toLowerCase().startsWith(q)) return k; }
  return null;
}
function displayName(botKey) {
  try { return require('../../bots/PersonalityManager').getDisplayName(botKey) || botKey; } catch (e) { return botKey || 'bot'; }
}

// ── battle ownership ──────────────────────────────────────────────
// Stamp a battle object with the lane that opened it (no-op when already owned).
function claim(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (!obj.botKey) { const b = current(); if (b) obj.botKey = b; }
  return obj.botKey || null;
}
// May the current lane drive this battle? Returns null when fine, otherwise
// { error } (refuse) or { takeover: oldKey } (owner is dead/killed → we take it).
function check(obj, opts = {}) {
  // Push #100: lane OWNERSHIP REMOVED at the owner's request — every linked bot
  // drives every raid/dungeon/labyrinth. (The multi-bot "tripling" was the per-
  // socket tickers, fixed separately.) /kill + /reset remain.
  return null;
  // eslint-disable-next-line no-unreachable
  if (!obj || typeof obj !== 'object') return null;
  const me = current();
  const owner = obj.botKey || null;
  if (!owner || !me || owner === me) { if (!owner && me) obj.botKey = me; return null; }
  const usable = _ownerUsable(owner, opts);
  if (usable) {
    return { error: `⚔️ This ${opts.what || 'battle'} is being run by *${displayName(owner)}* — send your commands to that bot.` };
  }
  obj.botKey = me;
  return { takeover: owner, line: `🔁 *${displayName(me)}* takes over this ${opts.what || 'battle'} — *${displayName(owner)}* is not available.` };
}
function _ownerUsable(key, opts) {
  if (isKilled(key)) return false;
  if (opts && typeof opts.usable === 'function') { try { return !!opts.usable(key); } catch (e) { return false; } }
  try { if (!_msm) _msm = require('../../bots/MultiSocketManager'); return !!(_msm.isBotUsable && _msm.isBotUsable(key)); } catch (e) { return true; }
}
// Test hook: pretend-usable resolver.
function _setUsableResolver(fn) { _msm = fn ? { isBotUsable: fn } : null; }

module.exports = { run, current, scratch, kill, reset, isKilled, killedList, resolveBotKey, displayName, claim, check, _setUsableResolver };
