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

  // Push #76: same rule as /store — if a price lists BOTH currencies you pay
  // both; otherwise you pay whichever one is listed.
  if (nexusNeeded > 0 && stonesNeeded > 0) {
    if ((player.gold || 0) < nexusNeeded) {
      return { success: false, error: `Not enough Nexus.\nNeed: ${nexusNeeded.toLocaleString()} | Have: ${(player.gold||0).toLocaleString()}` };
    }
    if ((player.manaCrystals || 0) < stonesNeeded) {
      return { success: false, error: `Not enough Mana Stones.\nNeed: ${stonesNeeded.toLocaleString()} | Have: ${(player.manaCrystals||0).toLocaleString()}` };
    }
    player.gold -= nexusNeeded;
    player.manaCrystals -= stonesNeeded;
  } else if (nexusNeeded > 0) {
    if ((player.gold || 0) < nexusNeeded) {
      return { success: false, error: `Not enough Nexus.\nNeed: ${nexusNeeded.toLocaleString()} | Have: ${(player.gold||0).toLocaleString()}` };
    }
    player.gold -= nexusNeeded;
  } else if (stonesNeeded > 0) {
    if ((player.manaCrystals || 0) < stonesNeeded) {
      return { success: false, error: `Not enough Mana Stones.\nNeed: ${stonesNeeded.toLocaleString()} | Have: ${(player.manaCrystals||0).toLocaleString()}` };
    }
    player.manaCrystals -= stonesNeeded;
  }

  // Push #71: ledger the spend (whichever currency branch actually charged)
  try {
    const TL = require('./TransactionLog');
    const paidN = Math.max(0, (_preGold71 || 0) - (player.gold || 0));
    const paidM = Math.max(0, (_preMana71 || 0) - (player.manaCrystals || 0));
    TL.logSpend(player, 'pattern_buy', paidN, paidM, `#${attackId}`);
  } catch (e) {}

  // Purchase
  player.attackPatterns.owned.push(attackId);
  // Push #88d: remember what was PAID so /attacks sell can refund exactly 10% of it.
  try {
    if (!player.attackPatterns.paid) player.attackPatterns.paid = {};
    player.attackPatterns.paid[attackId] = { nexus: Math.max(0, (_preGold71 || 0) - (player.gold || 0)), stones: Math.max(0, (_preMana71 || 0) - (player.manaCrystals || 0)), at: Date.now() };
  } catch (e) {}
  shopItem.units -= 1;
  saveDatabase();

  return { success: true, attack: atk };
}

// ── Push #88d: sell a pattern back to the shop for 10% of what was paid ──────
// (a 90% LOSS — patterns are not an investment). Falls back to 10% of the
// shop price if the purchase predates price tracking. Equipped patterns are
// unequipped first. The unit goes back on the shelf if it is in today's shop.
const SELL_BACK_PCT = 10;
function sellToShop(attackId, sender, db, saveDatabase) {
  const player = db.users?.[sender];
  if (!player) return { success: false, error: 'Not registered.' };
  const ap = player.attackPatterns || { owned: [], equipped: [] };
  if (!ap.owned.includes(attackId)) return { success: false, error: `You don't own Attack #${attackId}.` };
  const atk = generateAttack(attackId);
  if (!atk) return { success: false, error: 'Unknown attack pattern.' };
  const paid = (ap.paid || {})[attackId] || null;
  const baseN = paid ? paid.nexus : (atk.cost.shopNexus || 0);
  const baseS = paid ? paid.stones : (atk.cost.shopStones || 0);
  const refundN = Math.floor(baseN * SELL_BACK_PCT / 100);
  const refundS = Math.floor(baseS * SELL_BACK_PCT / 100);
  ap.owned = ap.owned.filter(id => id !== attackId);
  ap.equipped = (ap.equipped || []).filter(id => id !== attackId);
  if (ap.paid) delete ap.paid[attackId];
  player.gold = (player.gold || 0) + refundN;
  player.manaCrystals = (player.manaCrystals || 0) + refundS;
  if (player.inventory) player.inventory.gold = player.gold;
  try { require('./TransactionLog').logCredit(player, 'pattern_sell', refundN, refundS, `#${attackId}`); } catch (e) {}
  try { const shop = ensureShopFresh(db); const it = (shop.items || []).find(i => i.id === attackId); if (it) it.units += 1; } catch (e) {}
  if (saveDatabase) saveDatabase();
  return { success: true, attack: atk, refundNexus: refundN, refundStones: refundS, paidNexus: baseN, paidStones: baseS, pct: SELL_BACK_PCT };
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

module.exports = { ensureShopFresh, purchaseFromShop, sellToShop, SELL_BACK_PCT, getShopDisplay, getShopStats, SHOP_SIZE };
