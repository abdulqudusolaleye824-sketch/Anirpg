/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — AttackShop                          ║
 * ║  Daily rotating attack pattern shop                  ║
 * ║  15–35 units per item, sells out silently            ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

const { generateAttack, getRankForNumber, RANK_CONFIG } = require('./AttackPatternDB');

// ── Shop state (persisted to DB) ──────────────────────────────────────────────
// db.attackShop = {
//   lastReset: timestamp,
//   items: [ { id, units } ]   // id = attack number, units = remaining stock
// }

const SHOP_SIZE        = 12;  // Number of attacks in shop at once
const MIN_UNITS        = 15;
const MAX_UNITS        = 35;
const ROTATION_MS      = 24 * 60 * 60 * 1000; // 24 hours

// ── Seeded shop rotation ──────────────────────────────────────────────────────
function getDayKey() {
  // WAT day key
  const wat = new Date(Date.now() + 3600000);
  return `${wat.getUTCFullYear()}-${wat.getUTCMonth()}-${wat.getUTCDate()}`;
}

function seededShuffle(arr, seed) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const x = Math.sin(seed + i) * 10000;
    const j = Math.floor((x - Math.floor(x)) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateDailyShop(dayKey) {
  // Use day key as seed
  let seed = 0;
  for (let i = 0; i < dayKey.length; i++) seed += dayKey.charCodeAt(i) * (i + 1);

  // Pick attacks across all ranks — weighted toward lower ranks
  const weights = { E: 4, D: 3, C: 2, B: 1.5, A: 1, S: 0.5 };
  const pool = [];

  for (const [rank, cfg] of Object.entries(RANK_CONFIG)) {
    const count = Math.floor(weights[rank] * 3);
    const rangeSize = cfg.range[1] - cfg.range[0] + 1;
    for (let i = 0; i < count; i++) {
      const x = Math.sin(seed + rank.charCodeAt(0) + i * 997) * 100000;
      const offset = Math.floor(Math.abs(x) % rangeSize);
      pool.push(cfg.range[0] + offset);
    }
  }

  // Deduplicate and shuffle
  const unique  = [...new Set(pool)];
  const shuffled = seededShuffle(unique, seed);
  const selected = shuffled.slice(0, SHOP_SIZE);

  return selected.map(id => ({
    id,
    units: MIN_UNITS + Math.floor(Math.abs(Math.sin(seed + id) * 10000) % (MAX_UNITS - MIN_UNITS + 1)),
  }));
}

// ── Ensure shop is fresh ──────────────────────────────────────────────────────
function ensureShopFresh(db) {
  const dayKey = getDayKey();

  if (!db.attackShop || db.attackShop.dayKey !== dayKey) {
    db.attackShop = {
      dayKey,
      lastReset: Date.now(),
      items: generateDailyShop(dayKey),
    };
  }
  return db.attackShop;
}

// ── Purchase an attack from shop ──────────────────────────────────────────────
function purchaseFromShop(attackId, sender, db, saveDatabase) {
  const shop   = ensureShopFresh(db);
  const player = db.users?.[sender];
  if (!player) return { success: false, error: 'Not registered.' };

  const shopItem = shop.items.find(i => i.id === attackId);
  if (!shopItem) return { success: false, error: `Attack #${attackId} is not in today's shop.` };
  if (shopItem.units <= 0) return { success: false, error: `Attack #${attackId} is sold out.` };

  const atk = generateAttack(attackId);
  if (!atk) return { success: false, error: 'Invalid attack number.' };

  // Ensure player has attack inventory
  if (!player.attackPatterns) player.attackPatterns = { owned: [], equipped: [] };

  // Check if already owned
  if (player.attackPatterns.owned.includes(attackId)) {
    return { success: false, error: `You already own Attack #${attackId}.` };
  }

  // Calculate shop price (3x base)
  const nexusNeeded  = atk.cost.shopNexus;
  const stonesNeeded = atk.cost.shopStones;
  const rank         = atk.rank;

  // S-rank requires BOTH
  if (rank === 'S') {
    if ((player.gold || 0) < nexusNeeded) {
      return { success: false, error: `Not enough Nexus.\nNeed: ${nexusNeeded.toLocaleString()} | Have: ${(player.gold||0).toLocaleString()}` };
    }
    if ((player.manaCrystals || 0) < stonesNeeded) {
      return { success: false, error: `Not enough Mana Stones.\nNeed: ${stonesNeeded.toLocaleString()} | Have: ${(player.manaCrystals||0).toLocaleString()}` };
    }
    player.gold -= nexusNeeded;
    player.manaCrystals -= stonesNeeded;
  }
  // C-rank: Nexus OR Mana Stones (prefer Nexus first, fallback to stones)
  else if (rank === 'C') {
    if ((player.gold || 0) >= nexusNeeded) {
      player.gold -= nexusNeeded;
    } else if ((player.manaCrystals || 0) >= stonesNeeded) {
      player.manaCrystals -= stonesNeeded;
    } else {
      return { success: false, error: `Not enough currency.\nNeed: ${nexusNeeded.toLocaleString()} Nexus OR ${stonesNeeded.toLocaleString()} Mana Stones` };
    }
  }
  // Nexus only (E, D)
  else if (nexusNeeded > 0) {
    if ((player.gold || 0) < nexusNeeded) {
      return { success: false, error: `Not enough Nexus.\nNeed: ${nexusNeeded.toLocaleString()} | Have: ${(player.gold||0).toLocaleString()}` };
    }
    player.gold -= nexusNeeded;
  }
  // Mana Stones only (B, A)
  else if (stonesNeeded > 0) {
    if ((player.manaCrystals || 0) < stonesNeeded) {
      return { success: false, error: `Not enough Mana Stones.\nNeed: ${stonesNeeded.toLocaleString()} | Have: ${(player.manaCrystals||0).toLocaleString()}` };
    }
    player.manaCrystals -= stonesNeeded;
  }

  // Purchase
  player.attackPatterns.owned.push(attackId);
  shopItem.units -= 1;
  saveDatabase();

  return { success: true, attack: atk };
}

// ── Get shop display ──────────────────────────────────────────────────────────
function getShopDisplay(db) {
  const shop = ensureShopFresh(db);
  return shop.items.map(item => {
    const atk = generateAttack(item.id);
    return { ...atk, inStock: item.units > 0 };
  });
}

// ── Get shop stats (owner/coowner only) ───────────────────────────────────────
function getShopStats(db) {
  const shop = ensureShopFresh(db);
  return {
    dayKey:    shop.dayKey,
    lastReset: shop.lastReset,
    items: shop.items.map(item => {
      const atk = generateAttack(item.id);
      return {
        id:        item.id,
        name:      atk?.name || `#${item.id}`,
        rank:      atk?.rank || '?',
        unitsLeft: item.units,
        soldOut:   item.units <= 0,
      };
    }),
  };
}

module.exports = { ensureShopFresh, purchaseFromShop, getShopDisplay, getShopStats, SHOP_SIZE };
