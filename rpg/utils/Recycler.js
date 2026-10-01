// ═══════════════════════════════════════════════════════════════
// Push #89 — MATERIAL RECYCLER (PRO)
// Turn several UNWANTED crafting materials of the same gate rank into ONE
// material you actually need for a scroll recipe. Costs Nexus per output.
//   • Rank of a material = the gate rank whose monsters drop it (bestiary).
//   • "Needed" = any material a player's un-crafted scroll recipe still lacks.
//   • "Unwanted" = same-rank materials that no scroll of theirs needs.
//   • RATIO unwanted → 1 needed; NEXUS_COST per rank per output.
// ═══════════════════════════════════════════════════════════════
'use strict';
const RI = require('./RewardInventory');

const RATIO = 3;
const NEXUS_COST = { E: 500, D: 1500, C: 4000, B: 10000, A: 25000, S: 60000 };
const RANK_ORDER = ['E', 'D', 'C', 'B', 'A', 'S'];

let _rankMap = null;
function materialRanks() {
  if (_rankMap) return _rankMap;
  _rankMap = {};
  try {
    const SL = require('../data/SoloLevelingMonsters');
    for (const [rank, list] of Object.entries(SL.SL_MONSTERS || {})) {
      const r = String(rank).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1) || 'E';
      for (const m of list || []) for (const d of m.drops || []) {
        const k = norm(d);
        // keep the LOWEST rank a material drops at (it is that rank's material)
        if (!_rankMap[k] || RANK_ORDER.indexOf(r) < RANK_ORDER.indexOf(_rankMap[k].rank)) _rankMap[k] = { rank: r, name: d };
      }
    }
  } catch (e) {}
  // Push #96h-n: the bestiary drop table (MonsterDrops.js — Void Essence, Wraith Soul …) counts too.
  try {
    const MD = require('../data/MonsterDrops');
    const RMAP = { F: 'E', E: 'E', D: 'D', C: 'C', B: 'B', A: 'A', S: 'S', DISASTER: 'S' };
    for (const [rank, blk] of Object.entries(MD.MONSTER_DROPS || {})) {
      const r = RMAP[String(rank).toUpperCase()] || 'E';
      const lists = [...((blk && blk.monsters) || []), ...((blk && blk.bosses) || [])];
      for (const m of lists) for (const d of [...(m.drops || []), m.primary, m.secondary].filter(Boolean)) {
        const k = norm(d);
        if (!_rankMap[k] || RANK_ORDER.indexOf(r) < RANK_ORDER.indexOf(_rankMap[k].rank)) _rankMap[k] = { rank: r, name: d };
      }
    }
    for (const [rank, list] of Object.entries(MD.BASE_MATERIALS || {})) { const r = RMAP[String(rank).toUpperCase()] || 'E'; for (const d of list || []) { const k = norm(d); if (!_rankMap[k]) _rankMap[k] = { rank: r, name: d }; } }
  } catch (e) {}
  return _rankMap;
}
function norm(n) { return String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function rankOf(name) {
  const m = materialRanks()[norm(name)];
  if (m) return m.rank;
  const em = String(name || '').match(/^([EDCBAS])-Rank/i);
  return em ? em[1].toUpperCase() : null;
}
function canonicalName(name) { const m = materialRanks()[norm(name)]; return m ? m.name : String(name || '').trim(); }

// All materials a player holds → [{ name, count, rank }]
function holdings(player) {
  try { RI.migrateLegacy(player); } catch (e) {}
  const acc = {};
  const add = (name, c) => { const k = norm(name); if (!k) return; if (!acc[k]) acc[k] = { name: canonicalName(name), count: 0, rank: rankOf(name) }; acc[k].count += c; };
  for (const it of (player.inventory?.items || [])) {
    if (!it || typeof it !== 'object') { if (typeof it === 'string') add(it, 1); continue; }
    if (it.isGear || it.isWeapon || it.slot) continue;
    const t = String(it.type || it.kind || 'material').toLowerCase();
    if (!['material', 'materials', 'ingredient', 'resource', 'ore', 'essence'].includes(t)) continue;
    add(it.name, Math.max(1, Number(it.count || it.qty || it.quantity || 1) || 1));
  }
  for (const m of (player.inventory?.materials || [])) { const nm = m && typeof m === 'object' ? m.name : m; add(nm, m && typeof m === 'object' ? Math.max(1, Number(m.count || m.qty || 1) || 1) : 1); }
  for (const [k, v] of Object.entries(player.materials || {})) if (Number(v) > 0) add(k, Math.floor(Number(v)));
  return Object.values(acc).filter(x => x.count > 0);
}

// Materials the player's un-crafted scrolls still need → [{ name, need, have, rank, for }]
function needed(player) {
  const out = {};
  for (const sc of (player.inventory?.scrolls || [])) {
    if (!sc || sc.crafted || !sc.recipe || !sc.recipe.materials) continue;
    for (const [mat, qty] of Object.entries(sc.recipe.materials)) {
      const have = RI.countMaterial(player, mat);
      const k = norm(mat);
      if (!out[k]) out[k] = { name: mat, need: 0, have, rank: rankOf(mat), for: [] };
      out[k].need += Number(qty) || 0;
      if (!out[k].for.includes(sc.recipe.output)) out[k].for.push(sc.recipe.output);
    }
  }
  return Object.values(out).filter(x => x.have < x.need).map(x => ({ ...x, missing: x.need - x.have }));
}
function neededSet(player) { const s = new Set(); for (const sc of (player.inventory?.scrolls || [])) if (sc && !sc.crafted && sc.recipe && sc.recipe.materials) for (const m of Object.keys(sc.recipe.materials)) s.add(norm(m)); return s; }

// Plan a recycle of `target`: which unwanted same-rank materials will be fed.
function plan(player, target, count = 1) {
  const name = canonicalName(target);
  const rank = rankOf(name);
  if (!rank) return { ok: false, error: `*${target}* is not a gate crafting material.` };
  const keep = neededSet(player);
  const unwanted = holdings(player).filter(h => h.rank === rank && h.name !== name && !keep.has(norm(h.name))).sort((a, b) => b.count - a.count);
  const pool = unwanted.reduce((a, h) => a + h.count, 0);
  const maxOut = Math.floor(pool / RATIO);
  const n = Math.max(1, Math.min(Number(count) || 1, maxOut || 0));
  const cost = (NEXUS_COST[rank] || 1000) * n;
  if (maxOut < 1) return { ok: false, error: `You need at least ${RATIO} unwanted *${rank}-rank* materials to recycle into *${name}* (you have ${pool}).`, rank, unwanted, pool };
  // spread consumption across the biggest stacks first
  let left = n * RATIO; const feed = [];
  for (const h of unwanted) { if (left <= 0) break; const take = Math.min(h.count, left); feed.push({ name: h.name, take }); left -= take; }
  return { ok: true, name, rank, n, maxOut, cost, feed, pool, unwanted };
}

function execute(player, target, count = 1) {
  const p = plan(player, target, count);
  if (!p.ok) return p;
  if ((player.gold || 0) < p.cost) return { ok: false, error: `Not enough Nexus — recycling ${p.n}× *${p.name}* costs 💠 ${p.cost.toLocaleString()} (you have ${(player.gold || 0).toLocaleString()}).` };
  for (const f of p.feed) { if (!RI.consumeMaterial(player, f.name, f.take)) return { ok: false, error: `Could not consume ${f.take}× ${f.name}.` }; }
  player.gold -= p.cost;
  RI.grantItem(player, { name: p.name, type: 'material', rarity: 'common', source: 'recycle', count: p.n });
  player.stats_history = player.stats_history || {}; player.stats_history.recycled = (player.stats_history.recycled || 0) + p.n;
  return { ...p, executed: true, have: RI.countMaterial(player, p.name) };
}

module.exports = { materialRanks, RATIO, NEXUS_COST, rankOf, canonicalName, holdings, needed, plan, execute };
