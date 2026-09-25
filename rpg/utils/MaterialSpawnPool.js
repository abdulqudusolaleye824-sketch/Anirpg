'use strict';
// Push #88f — spawn pools are built FROM THE RECIPE BOOK, so what spawns is
// what /craft actually needs. Weighted by how many recipes use a material.
//   common  → materials of Common recipes      (String, Leather, Wood, E-Rank Mana Essence…)
//   rare    → materials of Uncommon+Rare recipes (Iron Ingot, Steel Ingot, Shadow Silk…)
//   epic    → materials of Epic recipes          (Demonic Alloy, Abyssal Stone, Void Metal…)
const EMOJI = { ingot: '🔩', ore: '⛏️', essence: '💠', silk: '🕸️', leather: '🦌', string: '🧵', wood: '🪵', bone: '🦴', stone: '🪨', core: '🔮', metal: '⚙️', alloy: '⚙️', shard: '💎', feather: '🪶', blood: '🩸', pelt: '🐾', fang: '🦷', claw: '🐾', heart: '❤️‍🔥', scale: '🐉', dust: '✨' };
let _cache = null;
function build() {
  if (_cache) return _cache;
  const pools = { common: {}, rare: {}, epic: {} };
  try {
    const C = require('./CraftingSystem');
    const tierOf = { Common: 'common', Uncommon: 'rare', Rare: 'rare', Epic: 'epic' };
    for (const [rar, tier] of Object.entries(tierOf)) {
      const book = (C.RECIPES || {})[rar] || {};
      for (const list of Object.values(book)) for (const r of (list || [])) for (const m of Object.keys(r.materials || {})) pools[tier][m] = (pools[tier][m] || 0) + 1;
    }
  } catch (e) {}
  // fallbacks so a broken recipe import never produces an empty spawn
  if (!Object.keys(pools.common).length) Object.assign(pools.common, { Leather: 5, String: 5, Wood: 4, 'Iron Ore': 4, 'Bone Fragment': 3 });
  if (!Object.keys(pools.rare).length) Object.assign(pools.rare, { 'Iron Ingot': 5, 'Steel Ingot': 4, 'Shadow Silk': 3 });
  if (!Object.keys(pools.epic).length) Object.assign(pools.epic, { 'Demonic Alloy': 3, 'Abyssal Stone': 3, 'Void Metal': 2 });
  _cache = pools; return pools;
}
function emojiFor(name) { const n = String(name).toLowerCase(); for (const [k, e] of Object.entries(EMOJI)) if (n.includes(k)) return e; return '📦'; }
function weightedPick(map, exclude = new Set()) {
  const entries = Object.entries(map).filter(([k]) => !exclude.has(k));
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (!total) return null;
  let r = Math.random() * total;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}
// One spawn = a BUNDLE: 3 distinct materials of the rolled tier, 2-4 units each
// (epic tier 1-2). Returned as [{ name, qty, rarity, emoji }].
function rollBundle(tier = 'common', count = 3) {
  const pools = build();
  const map = pools[tier] || pools.common;
  const out = []; const seen = new Set();
  for (let i = 0; i < count; i++) {
    const name = weightedPick(map, seen); if (!name) break; seen.add(name);
    const qty = tier === 'epic' ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 3);
    out.push({ name, qty, rarity: tier, emoji: emojiFor(name), type: 'material' });
  }
  return out;
}
function rollTier() { const r = Math.random() * 100; return r < 55 ? 'common' : r < 85 ? 'rare' : 'epic'; }
function grantBundle(player, bundle) {
  const RI = require('./RewardInventory');
  RI.ensureInventory(player);
  if (!player.materials || typeof player.materials !== 'object') player.materials = {};
  for (const b of bundle) {
    player.materials[b.name] = (player.materials[b.name] || 0) + b.qty;
    for (let i = 0; i < b.qty; i++) RI.grantItem(player, { name: b.name, type: 'material', rarity: b.rarity, emoji: b.emoji, isMaterial: true, desc: 'Crafting material — see /craft.' }, 'spawn');
  }
}
const describe = (bundle) => bundle.map(b => `${b.emoji} *${b.name}* ×${b.qty}`).join('\n');
module.exports = { build, rollBundle, rollTier, grantBundle, describe, emojiFor };
