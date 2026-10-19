'use strict';
// Push #103h (BUG-114): gear crafted BEFORE the #103 forge rewrite carried level-scaled stats far below the
// store grade its scroll rarity promised (a Legendary crown with DEF 76 next to the store's DEF 250+).
// One-shot: every pre-#103 crafted piece (source 'craft', no rank) is re-rolled at store grade for its rarity;
// stats only ever go UP (max of old/new per stat, extra old stats kept), durability keeps its ratio.
const KEY = 'crafted_upgrade_103h';

function _upgradeOne(item, player) {
  if (!item || typeof item !== 'object' || item.source !== 'craft' || item.rank) return false;
  const Armory = require('./ArmoryStore');
  const rarity = String(item.rarity || 'Common');
  const isWeapon = !!(item.isWeapon || String(item.type || '').toLowerCase() === 'weapon');
  const recipe = isWeapon ? { output: item.name, type: 'weapon', subtype: 'weapons' }
    : { output: item.name, type: 'armor', subtype: item.slot || item.subtype || 'chestplate' };
  let fresh; try { fresh = Armory.craftInstance(recipe, rarity, player || { level: 1 }); } catch (e) { return false; }
  if (!fresh) return false;
  item.rank = fresh.rank;
  if (isWeapon) {
    const a = Math.max(Number(item.attack || item.bonus || 0), Number(fresh.attack || 0));
    item.attack = a; item.bonus = a; if (!item.effects || !item.effects.length) item.effects = fresh.effects || [];
  } else {
    item.stats = item.stats || {};
    for (const [k, v] of Object.entries(fresh.stats || {})) item.stats[k] = Math.max(Number(item.stats[k] || 0), Number(v || 0));
    if (fresh.resist && fresh.resist.length && !(item.resist && item.resist.length)) item.resist = fresh.resist;
    if (fresh.immune && fresh.immune.length && !(item.immune && item.immune.length)) item.immune = fresh.immune;
    if (fresh.turnReduce && !item.turnReduce) item.turnReduce = fresh.turnReduce;
    if (fresh.special && !item.special) item.special = fresh.special;
  }
  const oldMax = Math.max(1, Number(item.maxDurability) || 1);
  if (!(Number(item.maxDurability) > 0)) { item.maxDurability = fresh.maxDurability; item.durability = fresh.maxDurability; }
  else if ((Number(fresh.maxDurability) || 0) > oldMax) {
    const ratio = Math.min(1, (Number(item.durability) || 0) / oldMax);
    item.maxDurability = fresh.maxDurability; item.durability = Math.max(1, Math.round(fresh.maxDurability * ratio));
  }
  item.upgraded103h = true;
  return true;
}

function run(db) {
  if (!db || !db.users) return 0;
  db.migrations = db.migrations || {};
  if (db.migrations[KEY]) return 0;
  let n = 0;
  for (const [jid, u] of Object.entries(db.users)) {
    if (!u || typeof u !== 'object') continue;
    const p = Object.assign({ jid }, u);
    for (const it of (u.inventory && Array.isArray(u.inventory.items) ? u.inventory.items : [])) if (_upgradeOne(it, p)) n++;
    for (const it of Object.values(u.equippedGear || {})) if (_upgradeOne(it, p)) n++;
    if (u.weapon && _upgradeOne(u.weapon, p)) n++;
  }
  db.migrations[KEY] = { at: Date.now(), upgraded: n };
  return n;
}

// Push #103h: awakening-rank power layer — recompute every hunter's stats once (idempotent afterwards).
const KEY2 = 'rank_power_103h';
function runRankPower(db) {
  if (!db || !db.users) return 0;
  db.migrations = db.migrations || {};
  if (db.migrations[KEY2]) return 0;
  const SAS = require('./StatAllocationSystem');
  let n = 0;
  for (const u of Object.values(db.users)) {
    if (!u || !u.stats || !u.class) continue;
    try { SAS.initializeStatAllocations(u); SAS.applyAllocationsToStats(u); n++; } catch (e) {}
  }
  db.migrations[KEY2] = { at: Date.now(), recomputed: n };
  return n;
}
module.exports = { run, runRankPower, _upgradeOne, KEY, KEY2 };
