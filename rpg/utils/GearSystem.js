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
    if (piece.stats.hp)           bonuses.hp           += piece.stats.hp;
    if (piece.stats.atk)          bonuses.atk          += piece.stats.atk;
    if (piece.stats.def)          bonuses.def          += piece.stats.def;
    if (piece.stats.speed)        bonuses.speed        += piece.stats.speed;
    if (piece.stats.crit)         bonuses.crit         += piece.stats.crit;
    if (piece.stats.critDmg)      bonuses.critDmg      += piece.stats.critDmg;
    if (piece.stats.evasion)      bonuses.evasion      += piece.stats.evasion;
    if (piece.stats.statusResist) bonuses.statusResist += piece.stats.statusResist;
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
      const statLines = Object.entries(piece.stats)
        .filter(([k]) => k !== 'special')
        .map(([k,v]) => `+${v} ${k.toUpperCase()}`)
        .join(', ');
      const dur = `${piece.durability}/${piece.maxDurability}`;
      msg += `${info.emoji} *${info.name}*: ${rc.emoji} ${piece.name}\n`;
      msg += `   📊 ${statLines} | 🔧 Durability: ${dur}\n`;
      if (piece.special) msg += `   ✨ ${piece.special.desc}\n`;
    } else {
      msg += `${info.emoji} *${info.name}*: _Empty_\n`;
    }
  }
  return msg;
}

module.exports = {
  GEAR_SLOTS, SLOT_INFO, RARITY_CONFIG,
  generateGear, generateGearForSlot,
  getEquippedBonuses, tickDurability,
  equipGear, unequipGear, formatEquipped
};
