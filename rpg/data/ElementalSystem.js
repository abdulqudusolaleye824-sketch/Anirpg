// ═══════════════════════════════════════════════════════════════
// ELEMENTAL INFUSION SYSTEM — Astra
//
// Elements: Fire, Water, Lightning, Wind, Earth
// Effects:
//   Fire      → Burns (damage over time)
//   Water     → Freezes (skip turn)
//   Lightning → Stuns (miss next attack)
//   Wind      → Weakens (reduces enemy ATK)
//   Earth     → Boosts wielder ATK
//
// Infusion strength scales with gate/monster rank
// Multiple infusions allowed — but reduce durability & raise mana cost
// ═══════════════════════════════════════════════════════════════

// ─── INFUSION TIERS (scale with rank) ───────────────────────────
const INFUSION_TIERS = {
  F:        { multiplier: 1.0,  label: 'Faint' },
  E:        { multiplier: 1.5,  label: 'Weak' },
  D:        { multiplier: 2.0,  label: 'Minor' },
  C:        { multiplier: 3.0,  label: 'Moderate' },
  B:        { multiplier: 4.5,  label: 'Strong' },
  A:        { multiplier: 6.0,  label: 'Powerful' },
  S:        { multiplier: 8.0,  label: 'Supreme' },
  DISASTER: { multiplier: 12.0, label: 'Catastrophic' },
};

// ─── BASE EFFECT VALUES (scaled by INFUSION_TIERS multiplier) ───
const ELEMENT_BASE_EFFECTS = {
  Fire:      { effect: 'burn',    description: 'Burns target (DoT)',               baseDamagePercent: 5  },
  Water:     { effect: 'freeze',  description: 'Freezes target (skip turn)',       baseChance: 20        },
  Lightning: { effect: 'stun',    description: 'Stuns target (miss next attack)',  baseChance: 20        },
  Wind:      { effect: 'weaken',  description: 'Weakens target (reduces ATK)',     baseAtkReduction: 10  },
  Earth:     { effect: 'empower', description: 'Boosts wielder ATK',              baseAtkBoost: 10      },
};

// ─── MULTI-INFUSION COSTS ────────────────────────────────────────
const MULTI_INFUSION_PENALTIES = {
  1: { durabilityDrain: 1.0, manaCostMult: 1.0  }, // normal
  2: { durabilityDrain: 2.5, manaCostMult: 1.8  }, // dual
  3: { durabilityDrain: 5.0, manaCostMult: 3.0  }, // triple (brutal)
};

// ─── ELEMENTAL MONSTERS PER RANK ────────────────────────────────
// existing = already in MonsterDrops.js (just tagged here)
// new      = added to the pool
const ELEMENTAL_MONSTERS = {

  F: [
    // ── Existing monsters tagged ──────────────────────────────
    { name: 'Imp',           element: 'Fire',      infusion: 'Faint Fire Infusion',      existing: true  },
    { name: 'Acid Slime',    element: 'Water',     infusion: 'Faint Water Infusion',     existing: true  },
    { name: 'Giant Worm',    element: 'Earth',     infusion: 'Faint Earth Infusion',     existing: true  },
    // ── New elemental monsters ────────────────────────────────
    { name: 'Ember Sprite',       element: 'Fire',      infusion: 'Faint Fire Infusion',
      drops: ['Ember Core', 'Scorch Dust', 'Flame Shard', 'Ash Residue'],             existing: false },
    { name: 'Puddle Slime',       element: 'Water',     infusion: 'Faint Water Infusion',
      drops: ['Water Core', 'Damp Residue', 'Slick Gel', 'Murky Droplet'],            existing: false },
    { name: 'Spark Bug',          element: 'Lightning', infusion: 'Faint Lightning Infusion',
      drops: ['Spark Core', 'Static Dust', 'Tiny Volt Sac', 'Buzzing Scale'],        existing: false },
    { name: 'Dust Sprite',        element: 'Wind',      infusion: 'Faint Wind Infusion',
      drops: ['Wind Core', 'Gust Dust', 'Breeze Shard', 'Hollow Feather'],           existing: false },
    { name: 'Mud Imp',            element: 'Earth',     infusion: 'Faint Earth Infusion',
      drops: ['Earth Core', 'Dirt Clump', 'Pebble Shard', 'Clay Chunk'],             existing: false },
  ],

  E: [
    // ── Existing monsters tagged ──────────────────────────────
    { name: 'Frost Wolf',    element: 'Water',     infusion: 'Weak Water Infusion',      existing: true  },
    { name: 'Stone Golem',   element: 'Earth',     infusion: 'Weak Earth Infusion',      existing: true  },
    { name: 'Gravel Golem',  element: 'Earth',     infusion: 'Weak Earth Infusion',      existing: true  },
    { name: 'Harpy',         element: 'Wind',      infusion: 'Weak Wind Infusion',       existing: true  },
    // ── New elemental monsters ────────────────────────────────
    { name: 'Flame Goblin',       element: 'Fire',      infusion: 'Weak Fire Infusion',
      drops: ['Flame Goblin Core', 'Scorch Hide', 'Ember Fang', 'Fire Goblin Ash'],  existing: false },
    { name: 'Frost Lizardman',    element: 'Water',     infusion: 'Weak Water Infusion',
      drops: ['Frost Scale', 'Ice Lizard Core', 'Frozen Claw', 'Frost Venom Sac'],  existing: false },
    { name: 'Storm Harpy',        element: 'Lightning', infusion: 'Weak Lightning Infusion',
      drops: ['Storm Harpy Core', 'Volt Feather', 'Thunder Beak', 'Spark Talon'],   existing: false },
    { name: 'Gale Sprite',        element: 'Wind',      infusion: 'Weak Wind Infusion',
      drops: ['Gale Core', 'Wind Sprite Cloth', 'Breeze Fang', 'Storm Shard'],      existing: false },
    { name: 'Iron Golem',         element: 'Earth',     infusion: 'Weak Earth Infusion',  existing: true  },
  ],

  D: [
    // ── Existing monsters tagged ──────────────────────────────
    { name: 'Ice Bear',      element: 'Water',     infusion: 'Minor Water Infusion',     existing: true  },
    { name: 'Frost Grizzly', element: 'Water',     infusion: 'Minor Water Infusion',     existing: true  },
    { name: 'Tundra Yeti',   element: 'Water',     infusion: 'Minor Water Infusion',     existing: true  },
    { name: 'Earth Drake',   element: 'Earth',     infusion: 'Minor Earth Infusion',     existing: true  },
    { name: 'Magma Hound',   element: 'Fire',      infusion: 'Minor Fire Infusion',      existing: true  },
    { name: 'Stone Titan',   element: 'Earth',     infusion: 'Minor Earth Infusion',     existing: true  },
    // ── New elemental monsters ────────────────────────────────
    { name: 'Cinder Drake',       element: 'Fire',      infusion: 'Minor Fire Infusion',
      drops: ['Cinder Drake Core', 'Magma Scale', 'Ember Fang', 'Lava Hide'],       existing: false },
    { name: 'Glacial Serpent',    element: 'Water',     infusion: 'Minor Water Infusion',
      drops: ['Glacial Core', 'Ice Serpent Scale', 'Frost Fang', 'Frozen Eye'],     existing: false },
    { name: 'Volt Crawler',       element: 'Lightning', infusion: 'Minor Lightning Infusion',
      drops: ['Volt Core', 'Shock Chitin', 'Static Claw', 'Spark Gland'],           existing: false },
    { name: 'Tempest Bat',        element: 'Wind',      infusion: 'Minor Wind Infusion',
      drops: ['Tempest Core', 'Gale Wing', 'Storm Fang', 'Wind Bat Hide'],          existing: false },
    { name: 'Mud Titan',          element: 'Earth',     infusion: 'Minor Earth Infusion',
      drops: ['Mud Titan Core', 'Dense Clay Shard', 'Earth Titan Hide', 'Rock Fist'],existing: false },
  ],

  C: [
    // ── Existing monsters tagged ──────────────────────────────
    { name: 'Scorchwing',    element: 'Fire',      infusion: 'Moderate Fire Infusion',   existing: true  },
    { name: 'Hellhound',     element: 'Fire',      infusion: 'Moderate Fire Infusion',   existing: true  },
    { name: 'Dusk Elemental',element: 'Wind',      infusion: 'Moderate Wind Infusion',   existing: true  },
    { name: 'Mana Stone Beast', element: 'Water',     infusion: 'Moderate Water Infusion',  existing: true  },
    { name: 'Gem Golem',     element: 'Earth',     infusion: 'Moderate Earth Infusion',  existing: true  },
    // ── New elemental monsters ────────────────────────────────
    { name: 'Inferno Wyvern',     element: 'Fire',      infusion: 'Moderate Fire Infusion',
      drops: ['Inferno Core', 'Blaze Scale', 'Scorched Fang', 'Fire Wyvern Eye'],   existing: false },
    { name: 'Tidal Colossus',     element: 'Water',     infusion: 'Moderate Water Infusion',
      drops: ['Tidal Core', 'Wave Hide', 'Frost Colossus Eye', 'Ice Bone'],         existing: false },
    { name: 'Thunder Gargoyle',   element: 'Lightning', infusion: 'Moderate Lightning Infusion',
      drops: ['Thunder Core', 'Volt Stone Wing', 'Storm Gargoyle Eye', 'Spark Hide'],existing: false },
    { name: 'Cyclone Specter',    element: 'Wind',      infusion: 'Moderate Wind Infusion',
      drops: ['Cyclone Core', 'Gale Specter Cloth', 'Wind Wisp', 'Storm Eye'],      existing: false },
    { name: 'Quake Troll',        element: 'Earth',     infusion: 'Moderate Earth Infusion',
      drops: ['Quake Core', 'Tremor Hide', 'Earth Troll Tusk', 'Ground Shard'],     existing: false },
  ],

  B: [
    // ── Existing monsters tagged ──────────────────────────────
    { name: 'Thunder Hawk',  element: 'Lightning', infusion: 'Strong Lightning Infusion', existing: true  },
    { name: 'Storm Eagle',   element: 'Lightning', infusion: 'Strong Lightning Infusion', existing: true  },
    { name: 'Tempest Griffin',element:'Lightning', infusion: 'Strong Lightning Infusion', existing: true  },
    { name: 'Infernal Golem',element: 'Fire',      infusion: 'Strong Fire Infusion',      existing: true  },
    { name: 'Void Elemental',element: 'Wind',      infusion: 'Strong Wind Infusion',      existing: true  },
    { name: 'Ashen Drake',   element: 'Fire',      infusion: 'Strong Fire Infusion',      existing: true  },
    // ── New elemental monsters ────────────────────────────────
    { name: 'Blazing Ogre',       element: 'Fire',      infusion: 'Strong Fire Infusion',
      drops: ['Blazing Core', 'Flame Ogre Hide', 'Magma Tusk', 'Ember Knuckle'],    existing: false },
    { name: 'Glacial Specter',    element: 'Water',     infusion: 'Strong Water Infusion',
      drops: ['Glacial Specter Core', 'Frost Wisp', 'Ice Phantom Cloth', 'Frozen Soul'],existing: false },
    { name: 'Gale Crusader',      element: 'Wind',      infusion: 'Strong Wind Infusion',
      drops: ['Gale Core', 'Storm Plate Shard', 'Wind Crusader Brand', 'Cyclone Eye'],existing: false },
    { name: 'Tremor Serpent',     element: 'Earth',     infusion: 'Strong Earth Infusion',
      drops: ['Tremor Core', 'Quake Scale', 'Earth Fang', 'Ground Serpent Eye'],    existing: false },
    { name: 'Volt Hydra',         element: 'Lightning', infusion: 'Strong Lightning Infusion',
      drops: ['Volt Hydra Core', 'Thunder Scale', 'Storm Fang', 'Lightning Eye'],   existing: false },
  ],

  A: [
    // ── Existing monsters tagged ──────────────────────────────
    { name: 'Young Flame Drake', element: 'Fire',      infusion: 'Powerful Fire Infusion',      existing: true  },
    { name: 'Infernal Titan',    element: 'Fire',      infusion: 'Powerful Fire Infusion',      existing: true  },
    { name: 'Doom Elemental',    element: 'Wind',      infusion: 'Powerful Wind Infusion',      existing: true  },
    { name: 'Abyss Python',      element: 'Water',     infusion: 'Powerful Water Infusion',     existing: true  },
    { name: 'Chaos Behemoth',    element: 'Earth',     infusion: 'Powerful Earth Infusion',     existing: true  },
    // ── New elemental monsters ────────────────────────────────
    { name: 'Sovereign Flame Drake', element: 'Fire',      infusion: 'Powerful Fire Infusion',
      drops: ['Sovereign Flame Core', 'Royal Ember Scale', 'Inferno Eye', 'Sovereign Ash'],      existing: false },
    { name: 'Abyssal Glacier',       element: 'Water',     infusion: 'Powerful Water Infusion',
      drops: ['Abyssal Ice Core', 'Deep Frost Hide', 'Null Ice Fang', 'Abyss Glacier Eye'],      existing: false },
    { name: 'Heaven Hawk',           element: 'Lightning', infusion: 'Powerful Lightning Infusion',
      drops: ['Heaven Thunder Core', 'Divine Volt Feather', 'Sky Storm Talon', 'Thunder God Eye'],existing: false },
    { name: 'Cosmic Gale Beast',     element: 'Wind',      infusion: 'Powerful Wind Infusion',
      drops: ['Cosmic Wind Core', 'Star Gale Hide', 'Void Breeze Claw', 'Cosmic Eye'],           existing: false },
    { name: 'Ancient Earth Titan',   element: 'Earth',     infusion: 'Powerful Earth Infusion',
      drops: ['Ancient Earth Core', 'Primordial Stone', 'World Pillar Shard', 'Titan Ground Eye'],existing: false },
  ],

  S: [
    // ── Existing monsters tagged ──────────────────────────────
    { name: 'Red Dragon',          element: 'Fire',      infusion: 'Supreme Fire Infusion',      existing: true  },
    { name: 'Inferno Dragon',      element: 'Fire',      infusion: 'Supreme Fire Infusion',      existing: true  },
    { name: 'Crimson Wyrm',        element: 'Fire',      infusion: 'Supreme Fire Infusion',      existing: true  },
    { name: 'Void Wraith',         element: 'Wind',      infusion: 'Supreme Wind Infusion',      existing: true  },
    { name: 'Ancient Dragon',      element: 'Earth',     infusion: 'Supreme Earth Infusion',     existing: true  },
    { name: 'Catastrophe Elemental',element:'Lightning', infusion: 'Supreme Lightning Infusion', existing: true  },
    // ── New elemental monsters ────────────────────────────────
    { name: 'God Flame Dragon',        element: 'Fire',      infusion: 'Supreme Fire Infusion',
      drops: ['God Flame Core', 'Divine Fire Scale', 'Eternal Ember', 'Sovereign Fire Eye'],      existing: false },
    { name: 'Eternal Glacier Wyrm',    element: 'Water',     infusion: 'Supreme Water Infusion',
      drops: ['Eternal Ice Core', 'Glacier God Scale', 'Null Frost Fang', 'Eternal Ice Eye'],     existing: false },
    { name: 'Heaven Thunder Sovereign',element: 'Lightning', infusion: 'Supreme Lightning Infusion',
      drops: ['Heaven Volt Core', 'Divine Thunder Scale', 'God Lightning Eye', 'Sky Sovereign Brand'],existing: false },
    { name: 'World Gale Sovereign',    element: 'Wind',      infusion: 'Supreme Wind Infusion',
      drops: ['World Wind Core', 'Sovereign Gale Hide', 'Reality Breeze Shard', 'God Wind Eye'],  existing: false },
    { name: 'Earth God Colossus',      element: 'Earth',     infusion: 'Supreme Earth Infusion',
      drops: ['Earth God Core', 'World Pillar Hide', 'Divine Ground Shard', 'Earth God Eye'],     existing: false },
  ],

  DISASTER: [
    // ── Existing monsters tagged ──────────────────────────────
    { name: 'Catastrophe Beast',   element: 'Fire',      infusion: 'Catastrophic Fire Infusion',      existing: true  },
    { name: 'Entropy God',         element: 'Lightning', infusion: 'Catastrophic Lightning Infusion',  existing: true  },
    { name: 'God of Ruin',         element: 'Earth',     infusion: 'Catastrophic Earth Infusion',     existing: true  },
    { name: 'Void Monarch',        element: 'Wind',      infusion: 'Catastrophic Wind Infusion',      existing: true  },
    { name: 'Oblivion Wyrm',       element: 'Water',     infusion: 'Catastrophic Water Infusion',     existing: true  },
    // ── New elemental monsters ────────────────────────────────
    { name: 'Apocalypse Flame God',    element: 'Fire',      infusion: 'Catastrophic Fire Infusion',
      drops: ['Apocalypse Fire Core', 'World Flame Scale', 'End-of-Days Ember', 'Ruin Fire Eye'],     existing: false },
    { name: 'Null Tide Sovereign',     element: 'Water',     infusion: 'Catastrophic Water Infusion',
      drops: ['Null Tide Core', 'Void Glacier Hide', 'World Frost Fang', 'Null Tide Eye'],            existing: false },
    { name: 'God of Thunder Ruin',     element: 'Lightning', infusion: 'Catastrophic Lightning Infusion',
      drops: ['Thunder Ruin Core', 'Apocalypse Volt Scale', 'World Thunder Eye', 'Ruin Storm Brand'],  existing: false },
    { name: 'World Storm Deity',       element: 'Wind',      infusion: 'Catastrophic Wind Infusion',
      drops: ['World Storm Core', 'Apocalypse Gale Hide', 'Reality Wind Shard', 'Storm Deity Eye'],   existing: false },
    { name: 'Primordial Earth God',    element: 'Earth',     infusion: 'Catastrophic Earth Infusion',
      drops: ['Primordial Earth Core', 'World Pillar God Shard', 'Reality Ground Hide', 'Earth Deity Eye'],existing: false },
  ],
};

// ─── HELPER FUNCTIONS ────────────────────────────────────────────

/**
 * Get all elemental monsters for a rank (existing + new)
 */
function getElementalMonsters(rank) {
  return ELEMENTAL_MONSTERS[rank] || [];
}

/**
 * Get new monsters to ADD to MonsterDrops pool for a rank
 */
function getNewElementalMonsters(rank) {
  return (ELEMENTAL_MONSTERS[rank] || []).filter(m => !m.existing);
}

/**
 * Check if a monster is elemental and return its infusion drop
 * Returns infusion string or null
 */
function rollElementalDrop(monsterName, rank) {
  const rankList = ELEMENTAL_MONSTERS[rank] || [];
  const match = rankList.find(m => m.name === monsterName);
  if (!match) return null;
  // 35% drop chance same as regular monsters
  return Math.random() <= 0.35 ? match.infusion : null;
}

/**
 * Build infusion effect object for crafting
 */
function buildInfusionEffect(element, rank, infusionCount = 1) {
  const tier = INFUSION_TIERS[rank] || INFUSION_TIERS['F'];
  const base = ELEMENT_BASE_EFFECTS[element];
  if (!base) return null;

  const penalty = MULTI_INFUSION_PENALTIES[Math.min(infusionCount, 3)];

  const effect = {
    element,
    rank,
    tier: tier.label,
    effect: base.effect,
    description: base.description,
    durabilityDrainMult: penalty.durabilityDrain,
    manaCostMult: penalty.manaCostMult,
  };

  // Scale effect values by tier multiplier
  if (base.baseDamagePercent) effect.damagePercent = +(base.baseDamagePercent * tier.multiplier).toFixed(1);
  if (base.baseChance)        effect.chance         = Math.min(95, +(base.baseChance * tier.multiplier).toFixed(1));
  if (base.baseAtkReduction)  effect.atkReduction   = +(base.baseAtkReduction * tier.multiplier).toFixed(1);
  if (base.baseAtkBoost)      effect.atkBoost       = +(base.baseAtkBoost * tier.multiplier).toFixed(1);

  return effect;
}

/**
 * Format infusion effects for display
 */
function formatInfusionEffects(infusions) {
  const ICONS = { Fire: '🔥', Water: '💧', Lightning: '⚡', Wind: '🌪️', Earth: '🪨' };
  return infusions.map(inf => {
    const icon = ICONS[inf.element] || '✨';
    let val = '';
    if (inf.damagePercent) val = `${inf.damagePercent}% HP/turn`;
    else if (inf.chance)   val = `${inf.chance}% chance`;
    else if (inf.atkReduction) val = `-${inf.atkReduction}% ATK`;
    else if (inf.atkBoost)     val = `+${inf.atkBoost}% ATK`;
    return `${icon} ${inf.tier} ${inf.element}: ${inf.description} (${val})`;
  }).join('\n');
}

module.exports = {
  ELEMENTAL_MONSTERS,
  INFUSION_TIERS,
  ELEMENT_BASE_EFFECTS,
  MULTI_INFUSION_PENALTIES,
  getElementalMonsters,
  getNewElementalMonsters,
  rollElementalDrop,
  buildInfusionEffect,
  formatInfusionEffects,
};
