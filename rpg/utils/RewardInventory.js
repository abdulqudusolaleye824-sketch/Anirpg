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

// CRITICAL: slots MUST be GearSystem slots (helmet/chestplate/boots/cloak/
// vambrace/ring) — /gear equip reads SLOT_INFO[slot].emoji and crashes on
// anything else. Reward-type → real-slot map:
const SLOT_MAP = {
  weapon: 'vambrace', weapons: 'vambrace',   // striking arm (ATK/crit)
  armor: 'chestplate',                        // core armor (DEF/HP)
  ring: 'ring',                               // jewelry
  accessory: 'ring', accessories: 'ring',     // trinkets ride the ring slot
};
const VALID_SLOTS = new Set(['helmet', 'chestplate', 'boots', 'cloak', 'vambrace', 'ring']);

// Repair pass: remap any gear already stored with a non-GearSystem slot
// (e.g. 'weapon'/'armor'/'accessory' from earlier builds) and rescue
// pieces parked under bogus equippedGear keys back into items.
function repairGearSlots(player) {
  if (!player) return 0;
  let fixed = 0;
  const items = player.inventory?.items;
  if (Array.isArray(items)) {
    for (const it of items) {
      if (!it || !it.isGear) continue;
      if (!VALID_SLOTS.has(it.slot)) {
        it.slot = SLOT_MAP[it.slot] || SLOT_MAP[it.type] || 'vambrace';
        fixed++;
      }
      if (!it.stats || typeof it.stats !== 'object') { it.stats = {}; fixed++; }
      // equipGear removes by id — id-less gear would delete the WRONG item.
      if (!it.id) { it.id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); fixed++; }
    }
  }
  if (player.equippedGear && typeof player.equippedGear === 'object') {
    for (const k of Object.keys(player.equippedGear)) {
      if (VALID_SLOTS.has(k)) continue;
      const piece = player.equippedGear[k];
      delete player.equippedGear[k];
      const real = VALID_SLOTS.has(piece?.slot) ? piece.slot : (SLOT_MAP[k] || 'vambrace');
      if (piece) piece.slot = real;
      if (piece && !player.equippedGear[real]) player.equippedGear[real] = piece;
      else if (piece && Array.isArray(items)) items.push(piece);
      fixed++;
    }
  }
  return fixed;
}
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
  if (!SLOT_MAP[type]) {
    const entry = { ...item, type: item.type || 'material', rarity: item.rarity || 'common', source: item.source || source, acquiredAt: Date.now() };
    inv.items.push(entry);
    return entry;
  }
  repairGearSlots(player); // heal any bad-slot gear from earlier builds
  const slot = SLOT_MAP[type];
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
    id: item.id || ('g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
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

// Push #84: material detection rewritten — crafting used to see "have 0"
// for materials the player clearly owned. Now matches by NORMALISED name
// (case/space/punctuation-insensitive) across EVERY place a material can
// live, and no longer requires type === 'material' (store/pass/craft
// grants used 'Material', 'ingredient', or no type at all):
//   • inventory.items (any non-gear, non-weapon, non-consumable entry)
//   • inventory.materials (legacy list)
//   • player.materials {name: count}  (artifact spawns / old drops)
const _GEARISH = new Set(['weapon','armor','armour','gear','helmet','chest','chestplate','legs','boots','gloves','ring','amulet','accessory','shield','artifact','potion','consumable','food','petfood','pet_food','scroll','card','egg','pet']);
function _normName(n) { return String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function _isMaterialish(it) {
  if (!it || typeof it !== 'object') return true; // bare string entries in legacy list
  if (it.isGear || it.isWeapon || it.slot) return false;
  const t = String(it.type || it.kind || '').toLowerCase();
  if (!t) return true;
  if (t === 'material' || t === 'materials' || t === 'ingredient' || t === 'resource' || t === 'ore' || t === 'essence') return true;
  return !_GEARISH.has(t);
}
function countMaterial(player, name) {
  if (!player || !name) return 0;
  const want = _normName(name);
  if (!want) return 0;
  let n = 0;
  for (const it of (player.inventory?.items || [])) {
    if (it && _isMaterialish(it) && _normName(it.name) === want) n += Math.max(1, Number(it.count || it.qty || it.quantity || 1) || 1);
  }
  for (const m of (player.inventory?.materials || [])) {
    const nm = (m && typeof m === 'object') ? m.name : m;
    if (_normName(nm) === want) n += (m && typeof m === 'object') ? Math.max(1, Number(m.count || m.qty || 1) || 1) : 1;
  }
  for (const [k, v] of Object.entries(player.materials || {})) {
    if (_normName(k) === want && Number(v) > 0) n += Math.floor(Number(v));
  }
  return n;
}

// Atomically consume qty of a material (items first, then legacy list, then
// player.materials counters). Returns true only if the full qty was consumed.
function consumeMaterial(player, name, qty) {
  if (!player || !name || !(qty > 0)) return false;
  if (countMaterial(player, name) < qty) return false;
  const want = _normName(name);
  let remaining = qty;
  const inv = player.inventory || {};
  if (Array.isArray(inv.items)) {
    const keep = [];
    for (const it of inv.items) {
      if (remaining > 0 && it && _isMaterialish(it) && _normName(it.name) === want) {
        const c = Math.max(1, Number(it.count || it.qty || it.quantity || 1) || 1);
        if (c <= remaining) { remaining -= c; continue; }
        // partial stack
        const left = c - remaining; remaining = 0;
        if (it.count != null) it.count = left; else if (it.qty != null) it.qty = left; else it.quantity = left;
      }
      keep.push(it);
    }
    inv.items = keep;
  }
  if (remaining > 0 && Array.isArray(inv.materials)) {
    inv.materials = inv.materials.filter(m => {
      const nm = (m && typeof m === 'object') ? m.name : m;
      if (remaining > 0 && _normName(nm) === want) { remaining--; return false; }
      return true;
    });
  }
  if (remaining > 0 && player.materials) {
    for (const k of Object.keys(player.materials)) {
      if (remaining <= 0) break;
      if (_normName(k) !== want) continue;
      const have = Math.floor(Number(player.materials[k]) || 0);
      const take = Math.min(have, remaining);
      player.materials[k] = have - take; remaining -= take;
      if (player.materials[k] <= 0) delete player.materials[k];
    }
  }
  return remaining === 0;
}

module.exports = { ensureInventory, grantItem, migrateLegacy, countMaterial, consumeMaterial, repairGearSlots, SLOT_MAP, VALID_SLOTS };
