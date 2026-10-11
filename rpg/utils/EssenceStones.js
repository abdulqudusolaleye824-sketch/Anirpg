// ═══════════════════════════════════════════════════════════════
// Astra — Essence Stones (Push #97)
//
// One essence stone per gate rank (E → S). They drop from gate beasts (small
// chance) and bosses (always) and are consumed by crafting: EVERY recipe needs
// essence stones of the rank that matches the scroll's rarity —
//   Common = E · Uncommon = D · Rare = C · Epic = B · Legendary = A · Mythic = S
// Powerful pieces (weapons / artifacts, Legendary+, high stats) need more.
// Mining a cleared floor can also turn one up.
// ═══════════════════════════════════════════════════════════════
'use strict';

const RI = require('./RewardInventory');

const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];
const RARITY_TO_RANK = { common: 'E', uncommon: 'D', rare: 'C', epic: 'B', legendary: 'A', mythic: 'S' };
const RANK_EMOJI = { E: '🪨', D: '🟢', C: '🔵', B: '🟣', A: '🟡', S: '🔴' };
// Drop odds per beast kill (final blow) and boss kill — rarer the higher the rank.
const BEAST_DROP = { E: 0.14, D: 0.12, C: 0.10, B: 0.09, A: 0.08, S: 0.07 };
const BOSS_DROP = { E: [1, 2], D: [1, 2], C: [1, 3], B: [1, 3], A: [2, 3], S: [2, 4] };

function normRank(rank) { const r = String(rank || 'E').toUpperCase().replace(/[^EDCBAS]/g, '')[0]; return RANKS.includes(r) ? r : 'E'; }
function nameFor(rank) { return `${normRank(rank)}-Rank Essence Stone`; }
function emojiFor(rank) { return RANK_EMOJI[normRank(rank)] || '🪨'; }
function rankForRarity(rarity) { return RARITY_TO_RANK[String(rarity || 'common').toLowerCase()] || 'E'; }
function isEssence(name) { return /^[EDCBAS]-Rank Essence Stone$/i.test(String(name || '').trim()); }
function rankOf(name) { const m = String(name || '').match(/^([EDCBAS])-Rank Essence Stone$/i); return m ? m[1].toUpperCase() : null; }

// How many stones a recipe needs. Base 1; weapons / artifacts 2; Legendary+ +1; very strong stats +1.
function requiredFor(recipe, rarity) {
  if (!recipe) return { rank: rankForRarity(rarity), count: 1, name: nameFor(rankForRarity(rarity)) };
  const rank = rankForRarity(rarity || recipe.rarity);
  let n = 1;
  const t = String(recipe.type || '').toLowerCase();
  if (t === 'weapon' || t === 'weapons' || t === 'artifact' || t === 'artifacts') n += 1;
  const rr = String(rarity || recipe.rarity || '').toLowerCase();
  if (rr === 'legendary' || rr === 'mythic') n += 1;
  const st = recipe.stats || {};
  const power = Math.abs(Number(st.atk || st.bonus || 0)) + Math.abs(Number(st.def || 0)) + Math.abs(Number(st.hp || 0)) / 10;
  if (power >= 400) n += 1;
  return { rank, count: n, name: nameFor(rank) };
}

function count(player, rank) { return RI.countMaterial(player, nameFor(rank)); }
function consume(player, rank, n) { return RI.consumeMaterial(player, nameFor(rank), n); }

// Grant n stones as ONE stacked material entry (count field) so the inventory does not fill with singles.
function grant(player, rank, n = 1) {
  const r = normRank(rank); const nm = nameFor(r); const q = Math.max(1, Math.floor(Number(n) || 1));
  RI.ensureInventory(player);
  const items = player.inventory.items;
  const hit = items.find(it => it && String(it.type || '').toLowerCase() === 'essence' && String(it.name || '') === nm);
  if (hit) { hit.count = Math.max(1, Number(hit.count) || 1) + q; return hit; }
  const entry = { name: nm, type: 'essence', rarity: ({ E: 'common', D: 'uncommon', C: 'rare', B: 'epic', A: 'legendary', S: 'mythic' })[r], emoji: emojiFor(r), count: q, source: 'gate', acquiredAt: Date.now(), lore: `Condensed mana of a ${r}-rank beast. Crafting ${r}-rank gear needs it.` };
  items.push(entry);
  return entry;
}

function rollBeastDrop(rank, rng = Math.random) { return rng() < (BEAST_DROP[normRank(rank)] || 0.1) ? 1 : 0; }
function rollBossDrop(rank, rng = Math.random) { const [a, b] = BOSS_DROP[normRank(rank)] || [1, 2]; return a + Math.floor(rng() * (b - a + 1)); }

module.exports = { RANKS, RARITY_TO_RANK, BEAST_DROP, BOSS_DROP, normRank, nameFor, emojiFor, rankForRarity, isEssence, rankOf, requiredFor, count, consume, grant, rollBeastDrop, rollBossDrop };
