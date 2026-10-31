'use strict';
// Push #103h (owner): the AWAKENING rank multiplies a hunter's base HP / ATK / DEF / Magic Power.
// Ratios set by the owner: D = 2×E, C = 2×D, B = 1.75×C, A = 1.75×B, S = 3.5×A (SS = 1.5×S).
// Applied as a LAYER in StatAllocationSystem.applyAllocationsToStats (stats = round(base × mult) + allocations),
// so baseStats stay untouched and the layer is idempotent and reversible.
const MULT = { F: 1, E: 1, D: 2, C: 4, B: 7, A: 12.25, S: 42.875, SS: 64.31, National: 64.31, Beyond: 64.31 };
const STATS = ['hp', 'atk', 'def', 'magicPower'];
function rankOf(p) {
  const r = String((p && (p.awakenRank || p.hunterRank || p.rank)) || 'E').toUpperCase().replace(/-?RANK$/, '').trim();
  return MULT[r] != null ? r : 'E';
}
function mult(p) { return MULT[rankOf(p)] || 1; }
// 10-30 (owner): Upgrade Points ride the rank ladder, and SS hunters get +10% more per point on top.
const UP_SS_BONUS = 1.10;
function upMult(p) { const r = rankOf(p); return (MULT[r] || 1) * (r === 'SS' || r === 'National' || r === 'Beyond' ? UP_SS_BONUS : 1); }
// Push #103i (owner): monsters AND gear climb the same ladder with 25% less of the buff: 1 + (mult − 1) × 0.75.
function rankMult(rank) { const r = String(rank || 'E').toUpperCase().replace(/[^A-Z]/g, ''); return MULT[r] || 1; }
// 10-30 (owner): B-rank and above beasts climb the FULL hunter ladder (hunters were one-shotting S gates with millions of
// damage against 100k-HP beasts). C-rank and below stay on the softer 75% curve so the early game remains easy.
// HP additionally doubles for B+ (monsterHpMult) — the threat is a long fight, not a bigger hit.
const EASY_RANKS = new Set(['F', 'E', 'D', 'C']);
const MONSTER_HP_X = 2;
function monsterMult(rank) { const r = String(rank || 'E').toUpperCase().replace(/[^A-Z]/g, ''); const m = rankMult(r); return EASY_RANKS.has(r) ? 1 + (m - 1) * 0.75 : m; }
function monsterHpMult(rank) { const r = String(rank || 'E').toUpperCase().replace(/[^A-Z]/g, ''); return monsterMult(r) * (EASY_RANKS.has(r) ? 1 : MONSTER_HP_X); }
function gearMult(rank) { return 1 + (rankMult(rank) - 1) * 0.75; } // gear unchanged (hunters untouched)
module.exports = { MULT, STATS, rankOf, mult, upMult, UP_SS_BONUS, rankMult, monsterMult, monsterHpMult, gearMult, EASY_RANKS, MONSTER_HP_X };
