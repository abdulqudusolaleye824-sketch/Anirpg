'use strict';

const { RARITY_EMOJI, getRandomGear } = require('./GearCatalog');

// ═══════════════════════════════════════════════════════════════
// GEAR SYSTEM - 6 Slots, Durability, Rarity, Stat Bonuses
// ═══════════════════════════════════════════════════════════════

const GEAR_SLOTS = ['helmet','chestplate','boots','cloak','vambrace','ring'];

const SLOT_INFO = {
  helmet:     { emoji: '⛑️',  name: 'Helmet',     primaryStats: ['hp','statusResist'],       desc: 'Protects your mind and body' },
  chestplate: { emoji: '🦺',  name: 'Chestplate', primaryStats: ['def','hp'],                desc: 'Core armor — your lifeline' },
  boots:      { emoji: '👢',  name: 'Boots',      primaryStats: ['speed','def'],             desc: 'Keeps you light on your feet' },
  cloak:      { emoji: '🧥',  name: 'Cloak',      primaryStats: ['evasion','statusResist'],  desc: 'Wraps you in shadow' },
  vambrace:   { emoji: '🥋',  name: 'Vambrace',   primaryStats: ['atk','crit'],             desc: 'Your striking arm, perfected' },
  ring:       { emoji: '💍',  name: 'Ring',       primaryStats: ['critDmg','special'],      desc: 'Magic flows through every gem' }
};

const RARITY_CONFIG = {
  common:    { emoji: '⚪', maxDurability: 20,  statMult: 1.0,  label: 'Common'    },
  uncommon:  { emoji: '🟢', maxDurability: 35,  statMult: 1.5,  label: 'Uncommon'  },
  rare:      { emoji: '🔵', maxDurability: 50,  statMult: 2.5,  label: 'Rare'      },
  epic:      { emoji: '🟣', maxDurability: 75,  statMult: 4.0,  label: 'Epic'      },
  legendary: { emoji: '🟠', maxDurability: 100, statMult: 7.0,  label: 'Legendary' },
  mythic:    { emoji: '🌌', maxDurability: 150, statMult: 12.0, label: 'Mythic'    }
};

const RANK_STAT_BASE = { 'F':2,'E':4,'D':7,'C':12,'B':18,'A':26,'S':36,'Beyond':50 };

// Special ring effects pool
const RING_SPECIALS = [
  { id: 'burnOnHit',    desc: '15% chance to inflict Burn on hit',       effectType: 'burn',      chance: 0.15 },
  { id: 'poisonOnHit',  desc: '20% chance to inflict Poison on hit',     effectType: 'poison',    chance: 0.20 },
  { id: 'lifesteal5',   desc: 'Lifesteal 5% of damage dealt',            effectType: 'lifesteal', value: 0.05  },
  { id: 'lifesteal10',  desc: 'Lifesteal 10% of damage dealt',           effectType: 'lifesteal', value: 0.10  },
  { id: 'stunOnCrit',   desc: '25% chance to Stun on critical hit',      effectType: 'stun',      chance: 0.25 },
  { id: 'blindOnHit',   desc: '15% chance to inflict Blind on hit',      effectType: 'blind',     chance: 0.15 },
  { id: 'healOnKill',   desc: 'Heal 8% max HP on killing blow',          effectType: 'healOnKill',value: 0.08  }
];

function generateGear(dungeonRank, rarity, playerLevel) {
  const slot = GEAR_SLOTS[Math.floor(Math.random() * GEAR_SLOTS.length)];
  return generateGearForSlot(slot, dungeonRank, rarity, playerLevel);
}

function generateGearForSlot(slot, dungeonRank, rarity, playerLevel) {
  const rc = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  const slotInfo = SLOT_INFO[slot];

  // Map slot names to catalog slot keys
  const catalogSlotMap = {
    helmet: 'helm', chestplate: 'chest', boots: 'boot',
    cloak: 'cloak', vambrace: 'vam', ring: 'ring'
  };
  const catalogSlot = catalogSlotMap[slot] || slot;

  // Pull from named catalog first
  const catalogPiece = getRandomGear(catalogSlot, rarity);

  if (catalogPiece) {
    return {
      id: Date.now() + '_' + Math.random().toString(36).slice(2,7),
      catalogId: catalogPiece.id,
      name: catalogPiece.name,
      slot,
      rarity,
      emoji: rc.emoji + slotInfo.emoji,
      durability: rc.maxDurability,
      maxDurability: rc.maxDurability,
      stats: { ...catalogPiece.stats },
      special: catalogPiece.special || null,
      desc: catalogPiece.desc,
      lore: catalogPiece.lore,
      type: 'gear',
      isGear: true,
      droppedAt: Date.now()
    };
  }

  // Fallback: procedural generation if catalog piece not found
  const base = RANK_STAT_BASE[dungeonRank] || 2;
  const mult = rc.statMult;
  const lvlBonus = 1 + (playerLevel || 1) * 0.02;
  const statVal = Math.floor(base * mult * lvlBonus);
  const stats = {};
  for (const s of slotInfo.primaryStats) {
    if (s === 'special') continue;
    stats[s] = statVal;
  }
  const gear = {
    id: Date.now() + '_' + Math.random().toString(36).slice(2,7),
    name: rc.label + ' ' + slotInfo.name,
    slot, rarity,
    emoji: rc.emoji + slotInfo.emoji,
    durability: rc.maxDurability,
    maxDurability: rc.maxDurability,
    stats, type: 'gear', isGear: true, droppedAt: Date.now()
  };
  if (slot === 'ring') {
    const special = RING_SPECIALS[Math.floor(Math.random() * RING_SPECIALS.length)];
    gear.special = special;
    gear.stats.special = special.id;
  }
  return gear;
}

// Get combined stat bonuses from all equipped gear
function getEquippedBonuses(player) {
  const equipped = player.equippedGear || {};
  const bonuses = { hp: 0, atk: 0, def: 0, speed: 0, crit: 0, critDmg: 0, evasion: 0, statusResist: 0, specials: [] };

  for (const slot of GEAR_SLOTS) {
    const piece = equipped[slot];
    if (!piece) continue;
    const st = piece.stats || {};
    if (st.hp)           bonuses.hp           += st.hp;
    if (st.atk)          bonuses.atk          += st.atk;
    if (st.def)          bonuses.def          += st.def;
    if (st.speed)        bonuses.speed        += st.speed;
    if (st.crit)         bonuses.crit         += st.crit;
    if (st.critDmg)      bonuses.critDmg      += st.critDmg;
    if (st.evasion)      bonuses.evasion      += st.evasion;
    if (st.statusResist) bonuses.statusResist += st.statusResist;
    if (piece.special)            bonuses.specials.push(piece.special);
  }
  return bonuses;
}

// Reduce durability of all equipped gear by 1 after a dungeon
// Returns list of broken piece names
function tickDurability(player) {
  const equipped = player.equippedGear || {};
  const broken = [];

  for (const slot of GEAR_SLOTS) {
    const piece = equipped[slot];
    if (!piece) continue;
    piece.durability = (piece.durability || 1) - 1;
    if (piece.durability <= 0) {
      broken.push({ slot, name: piece.name });
      delete equipped[slot];
    }
  }
  return broken;
}

// Push #87/#88: passive self-mending while resting in the bag — +1 durability
// per hour (Pro: per 30 min). Push #88: ONLY the item in slot #1 of the
// weapons bag (and slot #1 of the gear bag) mends — use /swap to choose which.
// Lazy (elapsed-time) so it needs no timers; index.js also ticks it every
// 10 min for everyone so it restores even for hunters who go quiet.
function mendingSlots(player) {
  const items = player && player.inventory && Array.isArray(player.inventory.items) ? player.inventory.items : [];
  const w = items.find(i => i && i.isWeapon) || null;
  const g = items.find(i => i && (i.isGear || i.type === 'gear') && !i.isWeapon) || null;
  return { weapon: w, gear: g };
}
function regenUnequippedDurability(player, now = Date.now()) {
  if (!player) return 0;
  const items = player.inventory && Array.isArray(player.inventory.items) ? player.inventory.items : [];
  if (!items.length) { player._durRegenAt = now; return 0; }
  const isPro = !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > now);
  const stepMs = (isPro ? 30 : 60) * 60 * 1000;
  let last = Number(player._durRegenAt) || 0;
  if (!last || last > now) { player._durRegenAt = now; return 0; }
  const steps = Math.floor((now - last) / stepMs);
  if (steps <= 0) return 0;
  let healed = 0;
  const slots = mendingSlots(player);
  for (const it of [slots.weapon, slots.gear]) {
    if (!it || typeof it !== 'object') continue;
    const max = Number(it.maxDurability);
    if (!max || it.durability == null || it.durability >= max) continue;
    const before = Number(it.durability) || 0;
    it.durability = Math.min(max, before + steps);
    healed += it.durability - before;
  }
  player._durRegenAt = last + steps * stepMs;
  return healed;
}

// Equip a gear piece — old piece despawns (not returned to inventory)
function equipGear(player, gearItem) {
  if (!player.equippedGear) player.equippedGear = {};
  const slot = gearItem.slot;
  // Old piece just gets deleted — no return to inventory
  player.equippedGear[slot] = gearItem;
  // Remove from inventory
  if (player.inventory?.items) {
    const idx = player.inventory.items.findIndex(i => i.id === gearItem.id);
    if (idx !== -1) player.inventory.items.splice(idx, 1);
  }
  return true;
}

// Unequip a slot — piece despawns
function unequipGear(player, slot) {
  if (!player.equippedGear?.[slot]) return false;
  const piece = player.equippedGear[slot];
  delete player.equippedGear[slot];
  return piece;
}

// Format equipped gear for display
function formatEquipped(player) {
  const equipped = player.equippedGear || {};
  let msg = '';
  for (const slot of GEAR_SLOTS) {
    const info = SLOT_INFO[slot];
    const piece = equipped[slot];
    if (piece) {
      const rc = RARITY_CONFIG[piece.rarity] || RARITY_CONFIG.common;
      const statLines = Object.entries(piece.stats || {})
        .filter(([k]) => k !== 'special')
        .map(([k,v]) => `+${v} ${k.toUpperCase()}`)
        .join(', ');
      const dur = `${piece.durability ?? '?'}/${piece.maxDurability ?? '?'}`;
      msg += `${info.emoji} *${info.name}*: ${rc.emoji} ${piece.name}\n`;
      msg += `   📊 ${statLines} | 🔧 Durability: ${dur}\n`;
      if (piece.special) msg += `   ✨ ${piece.special.desc}\n`;
    } else {
      msg += `${info.emoji} *${info.name}*: _Empty_\n`;
    }
  }
  return msg;
}

// Effective battle stats = base stats + equipped-gear bonuses.
// Use this everywhere stats are DISPLAYED or FOUGHT with so equipped
// gear always reflects (profile, /me, combat damage, power rating).
function getEffectiveStats(player) {
  const b = (player && player.stats) || {};
  let g = { hp: 0, atk: 0, def: 0, speed: 0, crit: 0, critDmg: 0, evasion: 0, statusResist: 0 };
  try { g = getEquippedBonuses(player) || g; } catch (e) {}
  return {
    hp:         b.hp || 0,
    maxHp:      (b.maxHp || 100) + (g.hp || 0),
    atk:        (b.atk || 0) + (g.atk || 0),
    def:        (b.def || 0) + (g.def || 0),
    speed:      (b.speed || 0) + (g.speed || 0),
    critChance: (b.critChance || 0) + (g.crit || 0),
    critDamage: b.critDamage || 150,
    magicPower: b.magicPower || 0,
    lifesteal:  b.lifesteal || 0,
    energy:     b.energy || 0,
    maxEnergy:  b.maxEnergy || 100,
  };
}

// Push #85: the HP ceiling a hunter can actually fill — base + gear + title
// (+ Last Gift). Regen/heals used to cap at stats.maxHp while /stats showed
// maxHp+gear, so "900/1200" never filled. One function, used everywhere.
function effectiveMaxHp(player) {
  if (!player || !player.stats) return 100;
  let g = 0, t = 0, w = 0, gift = 1;
  try { g = getEquippedBonuses(player).hp || 0; } catch (e) {}
  try { t = require('./TitleSystem').getEquippedBoost(player).maxHp || 0; } catch (e) {}
  try { w = player.weapon?.hp || 0; } catch (e) {}
  try { gift = require('./PetManager').lastGiftMultiplier(player) || 1; } catch (e) {}
  return Math.max(1, Math.floor(((player.stats.maxHp || 100) + g + t + w) * gift));
}

module.exports = {
  regenUnequippedDurability,
  mendingSlots,
  effectiveMaxHp,
  GEAR_SLOTS, SLOT_INFO, RARITY_CONFIG,
  generateGear, generateGearForSlot,
  getEquippedBonuses, getEffectiveStats, tickDurability,
  equipGear, unequipGear, formatEquipped
};
