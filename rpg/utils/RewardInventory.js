// ═══════════════════════════════════════════════════════════════
// RewardInventory — single source of truth for item rewards
//
// inventory.items[] is the ONLY live bucket (/inv displays it,
// /gear + /equip read it). Legacy buckets (weapons/armor/
// accessories/materials) are migrated into items on every grant.
// artifacts/scrolls/potions/cards/keyStones are separate systems
// and are NEVER touched here.
// ═══════════════════════════════════════════════════════════════

'use strict';

const WEARABLE = ['weapon', 'weapons', 'armor', 'accessory', 'accessories', 'ring'];
const LEGACY_BUCKETS = ['weapons', 'armor', 'accessories', 'materials'];

function ensureInventory(player) {
  if (!player.inventory) player.inventory = {};
  if (!Array.isArray(player.inventory.items)) player.inventory.items = [];
  return player.inventory;
}

// Normalize ANY reward item into inventory.items.
// Wearables get the gear shape (/gear equip + /inv tiers work).
// Everything else keeps its fields + gets type/rarity/source.
// `extra` is merged into gear entries only (e.g. { seasonal: true }).
function grantItem(player, item, source = 'reward', extra = {}) {
  if (!item) return null;
  const inv = ensureInventory(player);
  const type = String(item.type || 'material').toLowerCase();
  if (!WEARABLE.includes(type)) {
    const entry = { ...item, type: item.type || 'material', rarity: item.rarity || 'common', source: item.source || source, acquiredAt: Date.now() };
    inv.items.push(entry);
    return entry;
  }
  const slot = (type === 'weapon' || type === 'weapons') ? 'weapon' : (type === 'armor' ? 'armor' : 'accessory');
  const stats = {};
  const atk = item.stats?.atk ?? item.stats?.bonus ?? item.atk ?? item.bonus ?? 0;
  if (atk) stats.atk = atk;
  const map = [['def', 'def'], ['hp', 'hp'], ['speed', 'speed'], ['spd', 'speed'],
    ['crit', 'critChance'], ['critChance', 'critChance'],
    ['magicPower', 'magicPower'], ['lifesteal', 'lifesteal'], ['energy', 'energy']];
  for (const [k, sk] of map) {
    const v = item.stats?.[sk] ?? item.stats?.[k] ?? item[k];
    if (v) stats[sk] = v;
  }
  if (item.special || item.stats?.special) stats.special = item.special || item.stats.special;
  const entry = {
    name: item.name, type: 'gear', isGear: true, slot,
    rarity: item.rarity || 'rare',
    durability: item.durability || 100,
    maxDurability: item.maxDurability || item.durability || 100,
    stats, lore: item.lore || item.desc || '',
    source: item.source || source, acquiredAt: Date.now(),
    ...extra,
  };
  inv.items.push(entry);
  return entry;
}

// Move legacy-bucket entries into items (normalized). Idempotent.
// Returns number of entries migrated.
function migrateLegacy(player) {
  if (!player || !player.inventory) return 0;
  const inv = player.inventory;
  let n = 0;
  for (const bucket of LEGACY_BUCKETS) {
    const arr = inv[bucket];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    for (const raw of arr) {
      const item = (raw && typeof raw === 'object') ? raw : { name: String(raw), type: 'material' };
      grantItem(player, item, item.source || 'legacy');
      n++;
    }
    inv[bucket] = [];
  }
  return n;
}

// Count a material by exact name across items + legacy bucket.
function countMaterial(player, name) {
  if (!player || !name) return 0;
  let n = 0;
  for (const it of (player.inventory?.items || [])) {
    if (it && String(it.type || '').toLowerCase() === 'material' && it.name === name) n++;
  }
  for (const m of (player.inventory?.materials || [])) {
    const nm = (m && typeof m === 'object') ? m.name : m;
    if (nm === name) n++;
  }
  return n;
}

// Atomically consume qty of a material (items first, then legacy).
// Returns true only if the full qty was consumed.
function consumeMaterial(player, name, qty) {
  if (!player || !name || !(qty > 0)) return false;
  if (countMaterial(player, name) < qty) return false;
  let remaining = qty;
  const inv = player.inventory || {};
  if (Array.isArray(inv.items)) {
    inv.items = inv.items.filter(it => {
      if (remaining > 0 && it && String(it.type || '').toLowerCase() === 'material' && it.name === name) { remaining--; return false; }
      return true;
    });
  }
  if (remaining > 0 && Array.isArray(inv.materials)) {
    inv.materials = inv.materials.filter(m => {
      const nm = (m && typeof m === 'object') ? m.name : m;
      if (remaining > 0 && nm === name) { remaining--; return false; }
      return true;
    });
  }
  return remaining === 0;
}

module.exports = { ensureInventory, grantItem, migrateLegacy, countMaterial, consumeMaterial };
