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

// Push #103j (BUG-132/133, owner): every OWNED weapon / gear piece climbs the #103i rank power ladder once, exactly like the
// store now sells it (atk / def / hp / magicPower × gearMult(rank)). Idempotent: a piece is scaled only while its stats still
// sit inside the PRE-ladder band for its rank (so pass / store items minted after #103i are never doubled), then flagged _ladder.
const KEY3 = 'gear_ladder_103j';
const PRE_W = { E: [50, 80], D: [75, 110], C: [100, 150], B: [150, 250], A: [300, 550], S: [800, 2000] };
const PRE_D = { E: [20, 45], D: [40, 70], C: [60, 110], B: [100, 170], A: [160, 300], S: [350, 900] };
const PRE_H = { E: [50, 100], D: [90, 160], C: [150, 260], B: [240, 420], A: [400, 800], S: [900, 2400] };
const RAR_RANK = { common: 'E', uncommon: 'D', rare: 'C', epic: 'B', legendary: 'A', mythic: 'S', mythical: 'S' };
function _ladderRank(item) {
  const r = String(item.rank || '').toUpperCase(); if (PRE_W[r]) return r;
  return RAR_RANK[String(item.rarity || '').toLowerCase()] || null;
}
function _ladderOne(item) {
  if (!item || typeof item !== 'object' || item._ladder) return false;
  const isWeapon = !!(item.isWeapon || String(item.type || '').toLowerCase() === 'weapon' || (item.attack != null && !item.stats));
  const isGear = !!(item.isGear || (item.stats && typeof item.stats === 'object' && (item.slot || /armor|gear/i.test(String(item.type || '')))));
  if (!isWeapon && !isGear) return false;
  const rank = _ladderRank(item); if (!rank) return false;
  let m = 1; try { m = require('./RankPower').gearMult(rank); } catch (e) { return false; }
  if (!(m > 1)) { item._ladder = true; return false; }
  const slack = 1.25;
  if (isWeapon) {
    const a = Number(item.attack || item.bonus || 0);
    if (!(a > 0) || a > PRE_W[rank][1] * slack) { item._ladder = true; return false; } // already on the ladder (or nothing to scale)
    const na = Math.round(a * m); item.attack = na; item.bonus = na;
    if (item.magicPower != null) item.magicPower = Math.round(Number(item.magicPower) * m);
  } else {
    const st = item.stats; const d = Number(st.def || 0), h = Number(st.hp || st.maxHp || 0);
    if ((d > PRE_D[rank][1] * slack) || (h > PRE_H[rank][1] * slack)) { item._ladder = true; return false; }
    if (!(d > 0 || h > 0 || Number(st.atk) > 0 || Number(st.magicPower) > 0)) { item._ladder = true; return false; }
    for (const k of ['atk', 'def', 'hp', 'maxHp', 'magicPower']) if (Number(st[k]) > 0) st[k] = Math.round(Number(st[k]) * m);
  }
  item._ladder = true; item._ladderAt = Date.now(); item._ladderMult = m;
  return true;
}
function runGearLadder(db) {
  if (!db || !db.users) return 0;
  db.migrations = db.migrations || {};
  if (db.migrations[KEY3]) return 0;
  let n = 0;
  for (const u of Object.values(db.users)) {
    if (!u || typeof u !== 'object') continue;
    try {
      for (const it of (u.inventory && Array.isArray(u.inventory.items) ? u.inventory.items : [])) if (_ladderOne(it)) n++;
      for (const it of Object.values(u.equippedGear || {})) if (_ladderOne(it)) n++;
      if (u.weapon && typeof u.weapon === 'object' && _ladderOne(u.weapon)) n++;
      for (const it of (Array.isArray(u.weapons) ? u.weapons : [])) if (_ladderOne(it)) n++;
    } catch (e) {}
  }
  db.migrations[KEY3] = { at: Date.now(), scaled: n };
  return n;
}
module.exports = { run, runRankPower, runGearLadder, _upgradeOne, _ladderOne, KEY, KEY2, KEY3 };
