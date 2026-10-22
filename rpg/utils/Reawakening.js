// Push #103k (owner call): REAWAKENING — a second awakening that can only go UP.
//   • Trigger: a hunter FALLS in a gate raid, an instance or a PvP duel.
//   • Global cap: at most 3 reawakenings per rolling 365 days across ALL of Astra (not per player);
//     a hunter can reawaken once per 365 days.
//   • Result: never S. Max B. An A-rank result only for a hunter who is ALREADY B (very low chance).
//     A-rank and S-rank hunters cannot reawaken. Lower ranks are likelier to trigger.
//   • Stats: same recalibration /bleep does (pure floor → class bonuses → upgrade points re-applied).
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];
const YEAR_MS = 365 * 24 * 3600e3;
const GLOBAL_CAP = 3;
// Chance (per death) that the reawakening stirs, by CURRENT rank. Deaths are frequent — these are tiny on purpose.
const TRIGGER_PCT = { E: 1.2, D: 0.8, C: 0.45, B: 0.08 };
// Result weights by current rank (only upward, never S, A only from B).
const RESULT_W = {
  E: [['D', 60], ['C', 30], ['B', 10]],
  D: [['C', 75], ['B', 25]],
  C: [['B', 100]],
  B: [['A', 100]],
};
const EMOJI = { E: '⚪', D: '🟢', C: '🔵', B: '🟣', A: '🟠', S: '🔴' };

function _table(db) { if (!db.reawakening || typeof db.reawakening !== 'object') db.reawakening = { log: [] }; if (!Array.isArray(db.reawakening.log)) db.reawakening.log = []; return db.reawakening; }
function _bare(j) { return String(j || '').split('@')[0].split(':')[0]; }
function rankOf(p) { const r = String((p && p.awakenRank) || 'E').toUpperCase().replace(/[^A-Z]/g, ''); return RANKS.includes(r) ? r : 'E'; }

/** Reawakenings used in the last 365 days (global). */
function usedThisYear(db, now = Date.now()) { return _table(db).log.filter(e => e && now - (e.at || 0) < YEAR_MS); }
function globalLeft(db, now = Date.now()) { return Math.max(0, GLOBAL_CAP - usedThisYear(db, now).length); }
function playerUsedThisYear(db, jid, now = Date.now()) { const b = _bare(jid); return usedThisYear(db, now).some(e => _bare(e.jid) === b); }
function nextSlotAt(db, now = Date.now()) { const u = usedThisYear(db, now).sort((a, b) => a.at - b.at); return u.length >= GLOBAL_CAP ? u[0].at + YEAR_MS : now; }

/** Can this hunter reawaken at all (ignoring the dice)? */
function eligible(db, jid, player, now = Date.now()) {
  if (!db || !player) return { ok: false, why: 'no-player' };
  const r = rankOf(player);
  if (!RESULT_W[r]) return { ok: false, why: 'rank' }; // A / S never reawaken
  if (globalLeft(db, now) <= 0) return { ok: false, why: 'global-cap' };
  if (playerUsedThisYear(db, jid, now)) return { ok: false, why: 'player-cap' };
  try { if (require('../../utils/permissions').isBotOwner(db, jid)) return { ok: false, why: 'owner' }; } catch (e) {}
  return { ok: true, rank: r };
}

function rollResult(rank, rnd = Math.random) {
  const w = RESULT_W[rank]; if (!w) return null;
  const total = w.reduce((s, [, x]) => s + x, 0); let r = rnd() * total;
  for (const [to, x] of w) { r -= x; if (r <= 0) return to; }
  return w[w.length - 1][0];
}

// Same recalibration /bleep performs (kept in one place so both paths stay identical).
function recalibrate(player, newRank) {
  const { rankFloorAtLevel } = require('../../commands/rpg/bleep');
  const CP = require('./ClassPower'); const SAS = require('./StatAllocationSystem');
  if (!player.stats) player.stats = {};
  const level = Math.max(1, Number(player.level) || 1);
  const floorNow = rankFloorAtLevel(newRank, level);
  const rec = player.classBonusApplied;
  if (rec && rec.bonuses && !rec.legacy) { try { CP._remove(player, rec.bonuses); } catch (e) {} }
  delete player.classBonusApplied;
  if (!player.baseStats) player.baseStats = { hp: player.stats.maxHp || 100, atk: player.stats.atk || 10, def: player.stats.def || 5, speed: player.stats.speed || 100, maxEnergy: player.stats.maxEnergy || 100 };
  for (const key of ['hp', 'atk', 'def', 'speed', 'maxEnergy']) {
    player.baseStats[key] = floorNow[key];
    if (key === 'hp') player.stats.maxHp = floorNow[key]; else player.stats[key] = floorNow[key];
  }
  player.awakenRank = newRank;
  try { CP.ensureClassBonuses(player); } catch (e) {}
  try { SAS.applyAllocationsToStats(player); } catch (e) {}
  let cap = player.stats.maxHp; try { cap = require('./GearSystem').effectiveMaxHp(player); } catch (e) {}
  player.stats.hp = Math.min(Math.max(1, player.stats.hp || 1), cap);
  player.stats.energy = Math.min(player.stats.energy || 0, player.stats.maxEnergy || 100);
}

/**
 * Roll a reawakening for a hunter who just fell. Returns null (nothing happened) or
 * { from, to, lines } — lines are the announcement for the chat where they fell (call AFTER the fight resolves;
 * the reawakening never saves the hunter from that death).
 */
function tryOnDeath(db, jid, player, context = 'gate', opts = {}) {
  const now = opts.now || Date.now();
  const e = eligible(db, jid, player, now); if (!e.ok) return null;
  const rnd = opts.rnd || Math.random;
  const pct = TRIGGER_PCT[e.rank] || 0;
  if (!(opts.force || rnd() * 100 < pct)) return null;
  const to = rollResult(e.rank, rnd); if (!to || RANKS.indexOf(to) <= RANKS.indexOf(e.rank) || to === 'S') return null;
  const from = e.rank;
  const before = { hp: player.stats?.maxHp, atk: player.stats?.atk, def: player.stats?.def, speed: player.stats?.speed, en: player.stats?.maxEnergy };
  recalibrate(player, to);
  const after = { hp: player.stats.maxHp, atk: player.stats.atk, def: player.stats.def, speed: player.stats.speed, en: player.stats.maxEnergy };
  _table(db).log.push({ at: now, jid, name: player.name, from, to, context });
  player.reawakenings = (Number(player.reawakenings) || 0) + 1; player.lastReawakenAt = now;
  const left = globalLeft(db, now);
  const lines = [
    `✦ ━━━━━━━━━━━━━━ ✦`,
    `🌠 *REAWAKENING!*`,
    `✦ ━━━━━━━━━━━━━━ ✦`,
    `As *${player.name}* falls, the System stirs — the gate between life and death cracks open, and something long sealed answers.`,
    ``,
    `${EMOJI[from]} *${from}-Rank* → ${EMOJI[to]} *${to}-Rank*`,
    `❤️ ${Number(before.hp || 0).toLocaleString()} → *${after.hp.toLocaleString()}* · ⚔️ ${before.atk} → *${after.atk}* · 🛡️ ${before.def} → *${after.def}* · 💨 ${before.speed} → *${after.speed}* · ⚡ ${before.en} → *${after.en}*`,
    ``,
    `_A reawakening is one of the rarest events in Astra — ${left} left this year across the whole world._`,
    `✦ ━━━━━━━━━━━━━━ ✦`,
  ];
  return { from, to, lines, left };
}

/** Status line for /reawakening (owner & players). */
function statusText(db, now = Date.now()) {
  const used = usedThisYear(db, now).sort((a, b) => a.at - b.at);
  const left = GLOBAL_CAP - used.length;
  const L = [`🌠 *REAWAKENING* — ${left}/${GLOBAL_CAP} left this year (world-wide)`];
  if (used.length) { L.push(''); for (const e of used) L.push(`• *${e.name || _bare(e.jid)}* ${EMOJI[e.from]} ${e.from} → ${EMOJI[e.to]} ${e.to} · ${new Date(e.at).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: '2-digit', month: 'short', year: 'numeric' })} _(${e.context})_`); }
  if (left <= 0) L.push(``, `⏳ Next slot opens ${new Date(nextSlotAt(db, now)).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: '2-digit', month: 'short', year: 'numeric' })}.`);
  L.push(``, `It stirs only when a hunter FALLS (gate, instance or PvP). Never S. B at most — A only for a hunter already B. It only ever goes up.`);
  return L.join('\n');
}

module.exports = { RANKS, YEAR_MS, GLOBAL_CAP, TRIGGER_PCT, RESULT_W, rankOf, usedThisYear, globalLeft, playerUsedThisYear, nextSlotAt, eligible, rollResult, recalibrate, tryOnDeath, statusText };
