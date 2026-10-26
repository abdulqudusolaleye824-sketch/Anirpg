'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Push #103b — SKILL ACQUISITION BY RUNE STONE
//   • A class skill is LEARNED only by using its Rune Stone (/rune use <name>).
//   • Core ladder: the stone for slot N drops at Lv.5×N (LevelUpManager).
//     From Lv.15, every 5 levels there is a PAIR_CHANCE at two bonus stones
//     for skills above the hunter's level (early access).
//   • Rank-locked skills (B / A / S): the stone is handed over automatically
//     the moment the hunter's live Hunter Rank (/rank) reaches the requirement.
//     The skill is castable only WHILE the rank holds — drop below it and
//     every rank-guarded skill locks again, regain it and they return.
//   • player.skills.learned = [names]; stones live in inventory (soulbound).
// ═══════════════════════════════════════════════════════════════════════════
const RANK_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'National', 'Beyond'];
const PAIR_CHANCE = 0.35;

function _norm(n) { return String(n || '').toLowerCase().trim(); }
function _learnedArr(player) {
  if (!player.skills || typeof player.skills !== 'object') player.skills = {};
  if (!Array.isArray(player.skills.learned)) player.skills.learned = [];
  return player.skills.learned;
}
function isLearned(player, name) { if (!player) return false; const n = _norm(name); return _learnedArr(player).some(x => _norm(x) === n); }
function learn(player, name) { if (!player || !name) return false; if (isLearned(player, name)) return false; _learnedArr(player).push(String(name)); return true; }
function forget(player, name) { const arr = _learnedArr(player); const n = _norm(name); const i = arr.findIndex(x => _norm(x) === n); if (i >= 0) arr.splice(i, 1); return i >= 0; }

// ── Hunter rank (live, from /rank's power formula) ─────────────────────────
const _rankMemo = new WeakMap(); // player → { r, at } (a sync touches 26 entries; compute once per ~1.5s)
function rankOf(player) {
  if (!player || typeof player !== 'object') return 'F';
  const hit = _rankMemo.get(player); const now = Date.now();
  if (hit && now - hit.at < 1500) return hit.r;
  let r = 'F';
  // Push #103h (owner): the AWAKENING rank drives every rank-based mechanic — rank-locked skills included.
  r = String(player.awakenRank || player.hunterRank || player.rank || '').toUpperCase().replace(/-?RANK$/, '').trim();
  if (!RANK_ORDER.includes(r)) { try { const R = require('../../commands/rpg/rank'); r = R.getRank(R.calcPower(player).total).cur.rank; } catch (e) { r = 'E'; } } // unawakened legacy records only
  _rankMemo.set(player, { r, at: now });
  return r;
}
function rankIdx(r) { const i = RANK_ORDER.indexOf(String(r || 'F')); return i < 0 ? 0 : i; }
function rankMeets(player, req) { if (!req) return true; return rankIdx(rankOf(player)) >= rankIdx(req); }

// ── Stones ─────────────────────────────────────────────────────────────────
function _RS() { return require('./RuneStones'); }
function hasStone(player, skillName) { try { return _RS().has(player, skillName); } catch (e) { return false; } }
function grantStone(player, entry, source) {
  try {
    return _RS().grant(player, { skill: entry.name, kind: 'class', level: entry.unlocksAtLevel || 0, source: source || 'class_skill', lore: entry.rankReq
      ? `A ${entry.rankReq}-Rank rune. ${entry.name} answers only to a hunter who HOLDS that rank — fall below it and the rune goes quiet.`
      : `Carved for ${entry.name}. Use it (/rune use) and the technique is yours.` });
  } catch (e) { return null; }
}
function stonesOf(player) { return ((player && player.inventory && player.inventory.items) || []).filter(i => i && i.isRuneStone && (i.skillKind || 'class') === 'class'); }
function removeStone(player, stone) { const items = player.inventory.items; const i = items.indexOf(stone); if (i >= 0) items.splice(i, 1); }

// ── Roster helpers ─────────────────────────────────────────────────────────
function roster(player) { try { return require('./SkillCatalog').getRoster(player); } catch (e) { return []; } }
function entryByName(player, name) { const n = _norm(name); return roster(player).find(e => _norm(e.name) === n) || null; }

/** Stones the hunter is entitled to right now that are neither learned nor in the bag. */
function entitled(player, opts = {}) {
  const lvl = Number(player.level || 1);
  const out = [];
  for (const e of roster(player)) {
    if (!e) continue;
    if (e.rankReq) { if (!rankMeets(player, e.rankReq)) continue; }
    else if ((e.unlocksAtLevel || 999) > lvl) continue;
    if (isLearned(player, e.name) || (!opts.ignoreStones && hasStone(player, e.name))) continue;
    out.push(e);
  }
  return out;
}
/** Hand over every entitled stone (migration, /recon, rank-ups). Returns the stones granted. */
function grantEntitled(player, source) {
  const got = [];
  for (const e of entitled(player)) { const st = grantStone(player, e, source || 'entitled'); if (st) got.push({ entry: e, stone: st }); }
  return got;
}
/** Level-up hook: the slot's own stone, plus (Lv.15+) a chance at a bonus PAIR from above the hunter's level. */
// Learn every entitled skill directly (no stones) — owner tooling / tests.
function learnEntitled(player) { const got = []; for (const e of entitled(player, { ignoreStones: true })) { if (learn(player, e.name)) got.push(e.name); for (const st of stonesOf(player)) if (_norm(st.skill) === _norm(e.name)) removeStone(player, st); } try { require('./SkillCatalog').syncPlayerSkills(player); } catch (e) {} return got; }
function onLevel(player, level, rng = Math.random) {
  const out = { stone: null, pair: [] };
  const rs = roster(player);
  if (!rs.length) return out;
  const own = rs.find(e => e && !e.rankReq && e.unlocksAtLevel === level);
  if (own && !isLearned(player, own.name) && !hasStone(player, own.name)) out.stone = grantStone(player, own, 'level');
  if (level >= 15 && level % 5 === 0 && rng() < PAIR_CHANCE) {
    const pool = rs.filter(e => e && !e.rankReq && (e.unlocksAtLevel || 0) > level && !isLearned(player, e.name) && !hasStone(player, e.name));
    for (let k = 0; k < 2 && pool.length; k++) { const i = Math.floor(rng() * pool.length); const [e] = pool.splice(i, 1); const st = grantStone(player, e, 'bonus_pair'); if (st) out.pair.push(st); }
  }
  return out;
}
/** Rank hook (cheap — call from the command path): new rank stones, and the set of names that just (un)locked. */
function syncRank(player) {
  if (!player || !player.class) return { stones: [], rank: 'F', changed: false };
  const r = rankOf(player);
  const prev = player._rankSeen || null;
  const stones = [];
  for (const e of roster(player)) if (e && e.rankReq && rankMeets(player, e.rankReq) && !isLearned(player, e.name) && !hasStone(player, e.name)) { const st = grantStone(player, e, 'rank'); if (st) stones.push({ entry: e, stone: st }); }
  player._rankSeen = r;
  return { stones, rank: r, changed: prev !== r };
}

// ── /rune use ──────────────────────────────────────────────────────────────
function useStone(player, query) {
  const q = _norm(query).replace(/^rune stone\s*[—-]\s*/, '');
  if (!q) return { ok: false, error: 'Which rune? `/rune use <skill name>` or `/rune use all`.' };
  const stones = stonesOf(player);
  if (!stones.length) return { ok: false, error: 'You hold no class rune stones. They drop every 5 levels (and from rank-ups).' };
  let stone = stones.find(s => _norm(s.skill) === q) || stones.find(s => _norm(s.skill).startsWith(q)) || stones.find(s => _norm(s.skill).includes(q));
  if (!stone && /^\d+$/.test(q)) stone = stones[parseInt(q, 10) - 1] || null;
  if (!stone) return { ok: false, error: `No rune stone matching *${query}*. See \`/rune\`.` };
  const e = entryByName(player, stone.skill);
  if (!e) return { ok: false, error: `🪨 *${stone.skill}* belongs to another class's ladder — it will wake if you ever walk that path again.`, stone };
  if (e.rankReq && !rankMeets(player, e.rankReq)) return { ok: false, error: `🔒 *${e.name}* needs *${e.rankReq}-Rank*. You are ${rankOf(player)}-Rank — the rune stays dormant until you climb.`, stone };
  if (isLearned(player, e.name)) { removeStone(player, stone); return { ok: false, error: `You already know *${e.name}* — the duplicate rune crumbles.` }; }
  learn(player, e.name); removeStone(player, stone);
  try { require('./SkillCatalog').syncPlayerSkills(player); } catch (err) {}
  return { ok: true, entry: e, stone };
}
function useAll(player) {
  const out = { learned: [], skipped: [] };
  for (const st of stonesOf(player).slice()) {
    const r = useStone(player, st.skill);
    if (r.ok) out.learned.push(r.entry); else out.skipped.push({ stone: st, why: r.error });
  }
  return out;
}

module.exports = { learnEntitled, RANK_ORDER, PAIR_CHANCE, isLearned, learn, forget, rankOf, rankIdx, rankMeets, hasStone, grantStone, stonesOf, removeStone, entitled, grantEntitled, onLevel, syncRank, useStone, useAll, entryByName };
