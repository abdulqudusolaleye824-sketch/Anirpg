'use strict';
// Push #88e — the three health-potion tiers as ONE source of truth.
//   lower  (10%)  common    inventory.lowerHealthPotions   (legacy mirror: inventory.healthPotions)
//   medium (25%)  rare      inventory.mediumHealthPotions
//   higher (50%)  EPIC      inventory.higherHealthPotions
// `healthPotions` used to double-count the lower tier (bought/dropped +1 to
// both, but /use only decremented one of them). normalise() collapses that.
const TIERS = [
  { tier: 'lower',  key: 'lowerHealthPotions',  name: 'Lower Health Potion',  emoji: '🩹', pct: 10, rarity: 'common' },
  { tier: 'medium', key: 'mediumHealthPotions', name: 'Medium Health Potion', emoji: '🧪', pct: 25, rarity: 'rare' },
  { tier: 'higher', key: 'higherHealthPotions', name: 'Higher Health Potion', emoji: '🍷', pct: 50, rarity: 'epic' },
];
const CAP_88E = 3; // one-shot cap applied to every player's potions + pet food

function tierOf(t) { return TIERS.find(x => x.tier === t || x.key === t || x.name.toLowerCase() === String(t || '').toLowerCase()) || null; }

function normalise(player) {
  if (!player) return;
  if (!player.inventory) player.inventory = {};
  const inv = player.inventory;
  const lower = Math.max(inv.lowerHealthPotions | 0, inv.healthPotions | 0);
  inv.lowerHealthPotions = lower;
  inv.healthPotions = lower; // legacy mirror — always equal from here on
  inv.mediumHealthPotions = inv.mediumHealthPotions | 0;
  inv.higherHealthPotions = inv.higherHealthPotions | 0;
}
function count(player, tier) { normalise(player); const t = tierOf(tier); return t ? (player.inventory[t.key] | 0) : 0; }
function add(player, tier, qty = 1) {
  normalise(player); const t = tierOf(tier); if (!t) return 0;
  player.inventory[t.key] = (player.inventory[t.key] | 0) + qty;
  if (t.tier === 'lower') player.inventory.healthPotions = player.inventory.lowerHealthPotions;
  return player.inventory[t.key];
}
function consume(player, tier, qty = 1) {
  normalise(player); const t = tierOf(tier); if (!t) return false;
  if ((player.inventory[t.key] | 0) < qty) return false;
  player.inventory[t.key] -= qty;
  if (t.tier === 'lower') player.inventory.healthPotions = player.inventory.lowerHealthPotions;
  return true;
}
function listForInventory(player) {
  normalise(player);
  return TIERS.filter(t => (player.inventory[t.key] | 0) > 0).map(t => ({ ...t, count: player.inventory[t.key] | 0 }));
}

// One-shot economy reset: every player's health potions (each tier) and each
// pet-food type capped at 3 units. Idempotent — flagged on db._potionCap88e.
function capAllPlayers(db, cap = CAP_88E) {
  if (!db || !db.users) return { done: false, touched: 0 };
  if (db._potionCap88e) return { done: true, touched: 0, already: true };
  let touched = 0;
  for (const p of Object.values(db.users)) {
    if (!p || typeof p !== 'object') continue;
    try {
      normalise(p);
      const inv = p.inventory;
      let hit = false;
      for (const t of TIERS) if ((inv[t.key] | 0) > cap) { inv[t.key] = cap; hit = true; }
      inv.healthPotions = inv.lowerHealthPotions;
      if ((inv.energyPotions | 0) > cap) { inv.energyPotions = cap; hit = true; }
      if ((inv.manaPotions | 0) > cap) { inv.manaPotions = cap; hit = true; }
      if (inv.petFood && typeof inv.petFood === 'object') {
        for (const k of Object.keys(inv.petFood)) if ((inv.petFood[k] | 0) > cap) { inv.petFood[k] = cap; hit = true; }
      }
      if (Array.isArray(inv.items)) {
        // legacy pet-food entries stored as items[] rows — keep at most `cap` per name
        const seen = {};
        inv.items = inv.items.filter(it => { if (!it || !it.isPetFood) return true; seen[it.name] = (seen[it.name] | 0) + 1; if (seen[it.name] > cap) { hit = true; return false; } return true; });
      }
      if (hit) touched++;
    } catch (e) {}
  }
  db._potionCap88e = { at: Date.now(), cap, touched };
  return { done: true, touched };
}

module.exports = { TIERS, CAP_88E, tierOf, normalise, count, add, consume, listForInventory, capAllPlayers };
