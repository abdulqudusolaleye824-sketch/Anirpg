// PetDatabase.js — Complete Pet System
// All pets start as common eggs. At level 3 they evolve into real creatures.
// Three pet roles: attack, support, scavenger

// ── EGG TEMPLATES (what players find/hatch) ──────────────────
const EGG_TYPES = {
  common_egg: {
    id: 'common_egg',
    name: 'Common Egg',
    emoji: '🥚',
    rarity: 'common',
    desc: 'A plain egg. Something is inside...',
    hatchLevel: 3,
    possiblePets: ['slime_pup', 'forest_sprite', 'stone_golem_baby', 'wind_fairy', 'mud_crawler'],
  },
  fire_egg: {
    id: 'fire_egg',
    name: 'Fire Egg',
    emoji: '🔥🥚',
    rarity: 'uncommon',
    desc: 'Warm to the touch. Smells like ash.',
    hatchLevel: 3,
    possiblePets: ['flame_fox', 'ember_lizard', 'pyro_bird'],
  },
  shadow_egg: {
    id: 'shadow_egg',
    name: 'Shadow Egg',
    emoji: '🌑🥚',
    rarity: 'rare',
    desc: 'Dark and cold. Something dangerous stirs within.',
    hatchLevel: 3,
    possiblePets: ['shadow_wolf', 'void_bat', 'dark_serpent'],
  },
  ancient_egg: {
    id: 'ancient_egg',
    name: 'Ancient Egg',
    emoji: '✨🥚',
    rarity: 'epic',
    desc: 'Covered in glowing runes. Incredibly rare.',
    hatchLevel: 3,
    possiblePets: ['lightning_drake', 'crystal_phoenix', 'abyss_demon'],
  },
};

// ── SPAWN WEIGHTS FOR DUNGEONS ─────────────────────────────────
// Common eggs spawn most often, ancient eggs almost never
const EGG_SPAWN_WEIGHTS = {
  common_egg: 65,
  fire_egg: 25,
  shadow_egg: 8,
  ancient_egg: 2,
};

// ── PET DATABASE ──────────────────────────────────────────────
// Each pet has a role: 'attack', 'support', or 'scavenger'
// attack   — fights alongside player, deals damage
// support  — buffs/heals the player
// scavenger — finds extra loot/Nexus after fights (but weak/vulnerable)

const PET_DATABASE = {

  // ─── ATTACK PETS ────────────────────────────────────────────

  slime_pup: {
    id: 'slime_pup',
    name: 'Slime Pup',
    emoji: '🟢',
    rarity: 'common',
    role: 'attack',
    type: 'basic',
    description: 'A bouncy little slime that loves to fight.',
    baseStats: { hp: 300, atk: 25, def: 15, spd: 40 },
    growthRates: { hp: 25, atk: 8, def: 4, spd: 5 },
    abilities: [
      { level: 1,  name: 'Bounce',    desc: 'Deals 15 damage',        damage: 15, type: 'physical' },
      { level: 5,  name: 'Acid Spit', desc: 'Deals 25 poison damage', damage: 25, type: 'poison', effect: { poison: 2 } },
      { level: 10, name: 'Slam',      desc: 'Deals 40 damage',        damage: 40, type: 'physical' },
    ],
    evolution: {
      level: 10,
      options: [
        { id: 'king_slime',   name: 'King Slime 👑',   requires: {} },
        { id: 'metal_slime',  name: 'Metal Slime ⚙️',  requires: { item: 'Iron Ore' } },
      ]
    },
    catchRate: 80,
    habitat: ['dungeon', 'forest'],
  },

  flame_fox: {
    id: 'flame_fox',
    name: 'Flame Fox',
    emoji: '🦊🔥',
    rarity: 'uncommon',
    role: 'attack',
    type: 'fire',
    description: 'A quick fox wreathed in flames. Burns whatever it bites.',
    baseStats: { hp: 280, atk: 40, def: 12, spd: 70 },
    growthRates: { hp: 20, atk: 12, def: 3, spd: 8 },
    abilities: [
      { level: 1,  name: 'Fire Bite',  desc: 'Burns the enemy for 20 dmg',     damage: 20, type: 'fire', effect: { burn: 2 } },
      { level: 5,  name: 'Flame Dash', desc: 'Charges through for 35 dmg',     damage: 35, type: 'fire' },
      { level: 10, name: 'Inferno',    desc: 'Scorches for 60 dmg + 3t burn',  damage: 60, type: 'fire', effect: { burn: 3 } },
    ],
    evolution: {
      level: 10,
      options: [
        { id: 'nine_tail_fox', name: 'Nine-Tail Fox 🦊✨', requires: {} },
      ]
    },
    catchRate: 50,
    habitat: ['volcano', 'dungeon_fire'],
  },

  shadow_wolf: {
    id: 'shadow_wolf',
    name: 'Shadow Wolf',
    emoji: '🐺🌑',
    rarity: 'rare',
    role: 'attack',
    type: 'shadow',
    description: 'A wolf born in darkness. Its howl freezes enemies in fear.',
    baseStats: { hp: 350, atk: 55, def: 20, spd: 80 },
    growthRates: { hp: 30, atk: 14, def: 5, spd: 9 },
    abilities: [
      { level: 1,  name: 'Shadow Bite',  desc: 'Rends for 30 dmg',              damage: 30, type: 'shadow' },
      { level: 5,  name: 'Howl',         desc: '+20% ATK for 2 turns',          damage: 0,  type: 'buff', effect: { atkBuff: 20, duration: 2 } },
      { level: 10, name: 'Void Strike',  desc: 'Deals 70 shadow damage',        damage: 70, type: 'shadow', effect: { blind: 1 } },
    ],
    evolution: {
      level: 10,
      options: [
        { id: 'alpha_shadow_wolf', name: 'Alpha Shadow Wolf 🐺👑', requires: {} },
      ]
    },
    catchRate: 25,
    habitat: ['shadow_realm', 'dungeon_deep'],
  },

  lightning_drake: {
    id: 'lightning_drake',
    name: 'Lightning Drake',
    emoji: '⚡🐉',
    rarity: 'epic',
    role: 'attack',
    type: 'lightning',
    description: 'A young dragon crackling with electricity. Storms follow it.',
    baseStats: { hp: 450, atk: 80, def: 30, spd: 90 },
    growthRates: { hp: 40, atk: 18, def: 7, spd: 10 },
    abilities: [
      { level: 1,  name: 'Thunder Bite',   desc: 'Deals 45 lightning dmg',       damage: 45, type: 'lightning' },
      { level: 5,  name: 'Chain Lightning', desc: 'Hits for 60 + stuns 1t',      damage: 60, type: 'lightning', effect: { stun: 1 } },
      { level: 10, name: 'Storm Breath',   desc: 'Devastates for 100 dmg',       damage: 100, type: 'lightning', effect: { stun: 2 } },
    ],
    evolution: {
      level: 10,
      options: [
        { id: 'storm_dragon', name: 'Storm Dragon ⚡🐲', requires: {} },
      ]
    },
    catchRate: 10,
    habitat: ['storm_peaks', 'ancient_dungeon'],
  },

  // ─── SUPPORT PETS ────────────────────────────────────────────

  forest_sprite: {
    id: 'forest_sprite',
    name: 'Forest Sprite',
    emoji: '🌿✨',
    rarity: 'common',
    role: 'support',
    type: 'nature',
    description: 'A tiny spirit that heals wounds and blesses hunters.',
    baseStats: { hp: 200, atk: 5, def: 10, spd: 50, healPower: 20 },
    growthRates: { hp: 15, atk: 1, def: 3, spd: 4, healPower: 5 },
    abilities: [
      { level: 1,  name: 'Heal',       desc: 'Restores 10% of your max HP',      damage: 0, type: 'heal',   healPct: 0.10 },
      { level: 5,  name: 'Barrier',    desc: '+15 DEF for 2 turns',              damage: 0, type: 'buff',   effect: { defBuff: 15, duration: 2 } },
      { level: 10, name: 'Full Bloom', desc: 'Restores 25% HP + removes 1 debuff', damage: 0, type: 'heal', healPct: 0.25, cleanse: true },
    ],
    evolution: {
      level: 10,
      options: [
        { id: 'ancient_treant', name: 'Ancient Treant 🌳', requires: {} },
        { id: 'bloom_guardian', name: 'Bloom Guardian 🌸', requires: {} },
      ]
    },
    catchRate: 70,
    habitat: ['forest', 'dungeon_garden'],
  },

  wind_fairy: {
    id: 'wind_fairy',
    name: 'Wind Fairy',
    emoji: '💨🧚',
    rarity: 'common',
    role: 'support',
    type: 'wind',
    description: 'A fairy that rides the wind. Boosts your speed and dodge.',
    baseStats: { hp: 180, atk: 8, def: 8, spd: 90, healPower: 10 },
    growthRates: { hp: 12, atk: 2, def: 2, spd: 10, healPower: 3 },
    abilities: [
      { level: 1,  name: 'Wind Boost', desc: '+20 SPD for 2 turns',       damage: 0, type: 'buff',   effect: { spdBuff: 20, duration: 2 } },
      { level: 5,  name: 'Gale Ward',  desc: '+10% dodge for 3 turns',    damage: 0, type: 'buff',   effect: { dodgeBuff: 10, duration: 3 } },
      { level: 10, name: 'Cyclone',    desc: 'Party ATK +15% for 3 turns',damage: 0, type: 'buff',   effect: { atkBuff: 15, duration: 3 } },
    ],
    evolution: {
      level: 10,
      options: [
        { id: 'storm_sylph', name: 'Storm Sylph 🌪️', requires: {} },
      ]
    },
    catchRate: 65,
    habitat: ['sky', 'forest'],
  },

  crystal_phoenix: {
    id: 'crystal_phoenix',
    name: 'Mana Stone Phoenix',
    emoji: '🔮🦅',
    rarity: 'epic',
    role: 'support',
    type: 'holy',
    description: 'A legendary bird of crystal. Can revive fallen hunters once.',
    baseStats: { hp: 400, atk: 20, def: 40, spd: 60, healPower: 60 },
    growthRates: { hp: 35, atk: 3, def: 10, spd: 5, healPower: 12 },
    abilities: [
      { level: 1,  name: 'Mana Stone Heal',  desc: 'Restores 20% HP',              damage: 0, type: 'heal',   healPct: 0.20 },
      { level: 5,  name: 'Holy Barrier',  desc: 'Absorbs next hit completely',  damage: 0, type: 'shield', effect: { shield: 1 } },
      { level: 10, name: 'Rebirth',       desc: 'Revives you at 30% HP (once)', damage: 0, type: 'revive', effect: { revive: 0.30, once: true } },
    ],
    evolution: {
      level: 10,
      options: [
        { id: 'divine_phoenix', name: 'Divine Phoenix 🌟🦅', requires: {} },
      ]
    },
    catchRate: 8,
    habitat: ['holy_ground', 'ancient_dungeon'],
  },

  // ─── SCAVENGER PETS ─────────────────────────────────────────
  // Scavengers are WEAK and VULNERABLE — they die easily
  // But they find extra Nexus/loot after every fight

  mud_crawler: {
    id: 'mud_crawler',
    name: 'Mud Crawler',
    emoji: '🪱',
    rarity: 'common',
    role: 'scavenger',
    type: 'earth',
    description: 'An ugly little creature that sniffs out treasure. Very fragile.',
    baseStats: { hp: 100, atk: 5, def: 5, spd: 20, scavengeRate: 0.15 },
    growthRates: { hp: 8, atk: 1, def: 1, spd: 2, scavengeRate: 0.02 },
    abilities: [
      { level: 1,  name: 'Dig',         desc: 'Finds 5-15% bonus Nexus after battle',  damage: 0, type: 'scavenge', goldBonus: 0.10 },
      { level: 5,  name: 'Treasure Nose',desc: 'Chance to find rare item after fight', damage: 0, type: 'scavenge', itemChance: 0.10 },
      { level: 10, name: 'Hoard Instinct',desc: '+25% Nexus from all sources',         damage: 0, type: 'scavenge', goldBonus: 0.25 },
    ],
    evolution: {
      level: 10,
      options: [
        { id: 'gold_beetle', name: 'Nexus Beetle 🪲💰', requires: {} },
      ]
    },
    catchRate: 75,
    habitat: ['dungeon', 'cave'],
    vulnerable: true, // can die in battle
  },

  void_bat: {
    id: 'void_bat',
    name: 'Void Bat',
    emoji: '🦇🌑',
    rarity: 'rare',
    role: 'scavenger',
    type: 'shadow',
    description: 'A bat from the void. Finds rare loot but flees from combat.',
    baseStats: { hp: 120, atk: 8, def: 5, spd: 100, scavengeRate: 0.25 },
    growthRates: { hp: 10, atk: 2, def: 1, spd: 12, scavengeRate: 0.03 },
    abilities: [
      { level: 1,  name: 'Echo Sense',   desc: '+20% item drop rate after fights',   damage: 0, type: 'scavenge', dropBonus: 0.20 },
      { level: 5,  name: 'Shadow Loot',  desc: 'Chance to double Nexus drops',        damage: 0, type: 'scavenge', goldDouble: 0.15 },
      { level: 10, name: 'Void Harvest', desc: 'Find rare/epic items more often',    damage: 0, type: 'scavenge', rarityBoost: true },
    ],
    evolution: {
      level: 10,
      options: [
        { id: 'void_dragon_bat', name: 'Void Dragon Bat 🦇🐉', requires: {} },
      ]
    },
    catchRate: 20,
    habitat: ['shadow_realm', 'deep_dungeon'],
    vulnerable: true,
  },

  stone_golem_baby: {
    id: 'stone_golem_baby',
    name: 'Stone Golem Baby',
    emoji: '🪨🤏',
    rarity: 'common',
    role: 'scavenger',
    type: 'earth',
    description: 'A tiny golem that collects shiny rocks and minerals.',
    baseStats: { hp: 150, atk: 10, def: 20, spd: 15, scavengeRate: 0.12 },
    growthRates: { hp: 12, atk: 2, def: 5, spd: 1, scavengeRate: 0.015 },
    abilities: [
      { level: 1,  name: 'Collect',      desc: '+10% crystals after dungeons',        damage: 0, type: 'scavenge', crystalBonus: 0.10 },
      { level: 5,  name: 'Mine',         desc: 'Find crafting materials after fights',damage: 0, type: 'scavenge', materialFind: true },
      { level: 10, name: 'Stone Hoard',  desc: '+20% crystals + materials',           damage: 0, type: 'scavenge', crystalBonus: 0.20, materialFind: true },
    ],
    evolution: {
      level: 10,
      options: [
        { id: 'crystal_golem', name: 'Mana Stone Golem 💎🪨', requires: {} },
      ]
    },
    catchRate: 70,
    habitat: ['cave', 'mine', 'dungeon'],
    vulnerable: false, // golems are tanky even as scavengers
  },

  // ─── EVOLVED FORMS ───────────────────────────────────────────

  king_slime: {
    id: 'king_slime', name: 'King Slime', emoji: '👑🟢', rarity: 'uncommon', role: 'attack', type: 'basic',
    description: 'The royal slime. Commands other slimes to fight for it.',
    baseStats: { hp: 600, atk: 55, def: 35, spd: 45 },
    growthRates: { hp: 40, atk: 14, def: 8, spd: 5 },
    abilities: [
      { level: 1, name: 'Royal Slam', desc: 'Deals 50 damage', damage: 50, type: 'physical' },
      { level: 5, name: 'Summon Slimes', desc: 'Deals 30 dmg x2', damage: 30, type: 'physical', hits: 2 },
      { level: 10, name: 'Crown Crush', desc: 'Deals 90 damage', damage: 90, type: 'physical' },
    ],
    catchRate: 0, habitat: [],
  },

  nine_tail_fox: {
    id: 'nine_tail_fox', name: 'Nine-Tail Fox', emoji: '🦊✨', rarity: 'rare', role: 'attack', type: 'fire',
    description: 'Ancient fox spirit. Each tail channels a different element.',
    baseStats: { hp: 550, atk: 90, def: 30, spd: 95 },
    growthRates: { hp: 35, atk: 20, def: 6, spd: 10 },
    abilities: [
      { level: 1, name: 'Fox Fire', desc: 'Deals 60 fire damage', damage: 60, type: 'fire', effect: { burn: 3 } },
      { level: 5, name: 'Nine Flames', desc: 'Hits 3x for 30 each', damage: 30, type: 'fire', hits: 3 },
      { level: 10, name: 'Soul Blaze', desc: 'Deals 120 damage', damage: 120, type: 'fire', effect: { burn: 4 } },
    ],
    catchRate: 0, habitat: [],
  },

  ancient_treant: {
    id: 'ancient_treant', name: 'Ancient Treant', emoji: '🌳✨', rarity: 'rare', role: 'support', type: 'nature',
    description: 'A wise old tree spirit. Heals massively and shields the party.',
    baseStats: { hp: 800, atk: 10, def: 80, spd: 20, healPower: 80 },
    growthRates: { hp: 60, atk: 1, def: 18, spd: 2, healPower: 15 },
    abilities: [
      { level: 1, name: 'Ancient Heal', desc: 'Restores 30% HP', damage: 0, type: 'heal', healPct: 0.30 },
      { level: 5, name: 'Root Ward', desc: 'DEF +30 for 3 turns', damage: 0, type: 'buff', effect: { defBuff: 30, duration: 3 } },
      { level: 10, name: 'Forest Sanctuary', desc: 'Heal 40% HP + full DEF buff', damage: 0, type: 'heal', healPct: 0.40, effect: { defBuff: 40, duration: 3 } },
    ],
    catchRate: 0, habitat: [],
  },

  gold_beetle: {
    id: 'gold_beetle', name: 'Nexus Beetle', emoji: '🪲💰', rarity: 'uncommon', role: 'scavenger', type: 'earth',
    description: 'Covered in golden shell. Sniffs out treasure anywhere.',
    baseStats: { hp: 200, atk: 8, def: 30, spd: 25, scavengeRate: 0.30 },
    growthRates: { hp: 15, atk: 1, def: 7, spd: 2, scavengeRate: 0.04 },
    abilities: [
      { level: 1, name: 'Nexus Sense', desc: '+25% Nexus after every fight', damage: 0, type: 'scavenge', goldBonus: 0.25 },
      { level: 5, name: 'Beetle Dig', desc: 'Find materials and potions', damage: 0, type: 'scavenge', materialFind: true, potionFind: true },
      { level: 10, name: 'Golden Hoard', desc: '+40% Nexus + rare item chance', damage: 0, type: 'scavenge', goldBonus: 0.40, itemChance: 0.20 },
    ],
    catchRate: 0, habitat: [], vulnerable: true,
  },
};

// ── PET FOOD DATABASE ─────────────────────────────────────────
const PET_FOOD = {
  // General foods
  kibble:        { name: 'Monster Kibble',     emoji: '🌾', hungerRestore: 30, bondingBonus: 5,  xpBonus: 10, cost: 300,  types: ['beast', 'basic'] },
  meat:          { name: 'Raw Meat',           emoji: '🥩', hungerRestore: 35, bondingBonus: 6,  xpBonus: 15, cost: 500,  types: ['fire', 'beast'] },
  fish:          { name: 'Fresh Fish',         emoji: '🐟', hungerRestore: 30, bondingBonus: 7,  xpBonus: 15, cost: 400,  types: ['ice', 'water'] },
  herb:          { name: 'Healing Herb',       emoji: '🌿', hungerRestore: 25, bondingBonus: 5,  xpBonus: 10, cost: 200,  types: ['poison', 'basic'] },
  bone:          { name: 'Dense Bone',         emoji: '🦴', hungerRestore: 25, bondingBonus: 6,  xpBonus: 12, cost: 300,  types: ['shadow', 'void'] },
  magic_berry:   { name: 'Magic Berry',        emoji: '🫐', hungerRestore: 45, bondingBonus: 12, xpBonus: 35, cost: 1500, types: ['thunder', 'ancient'] },
  royal_feed:    { name: 'Royal Monster Feed', emoji: '🍲', hungerRestore: 70, bondingBonus: 18, xpBonus: 60, cost: 3500, types: ['ancient', 'beast'] },

  // Type-specific preferred foods
  ember_meat:    { name: 'Ember Meat',         emoji: '🥩🔥', hungerRestore: 50, bondingBonus: 15, xpBonus: 40, cost: 2000, types: ['fire'] },
  flame_berry:   { name: 'Flame Berry',        emoji: '🍓🔥', hungerRestore: 40, bondingBonus: 12, xpBonus: 30, cost: 1200, types: ['fire'] },
  glacier_fish:  { name: 'Glacier Fish',       emoji: '🐟❄️', hungerRestore: 50, bondingBonus: 15, xpBonus: 40, cost: 2000, types: ['ice'] },
  frost_fruit:   { name: 'Frost Fruit',        emoji: '🍎❄️', hungerRestore: 40, bondingBonus: 12, xpBonus: 30, cost: 1200, types: ['ice'] },
  dark_marrow:   { name: 'Dark Marrow',        emoji: '🦴🌑', hungerRestore: 50, bondingBonus: 15, xpBonus: 40, cost: 2000, types: ['shadow', 'void'] },
  void_nectar:   { name: 'Void Nectar',        emoji: '🏺🕳️', hungerRestore: 60, bondingBonus: 20, xpBonus: 50, cost: 3000, types: ['void', 'shadow'] },
  venom_shroom:  { name: 'Venom Mushroom',     emoji: '🍄☣️', hungerRestore: 40, bondingBonus: 12, xpBonus: 30, cost: 1200, types: ['poison'] },
  toxic_grub:    { name: 'Toxic Grub',         emoji: '🐛☣️', hungerRestore: 45, bondingBonus: 14, xpBonus: 35, cost: 1500, types: ['poison'] },
  volt_beetle:   { name: 'Volt Beetle',        emoji: '🪲⚡', hungerRestore: 50, bondingBonus: 15, xpBonus: 40, cost: 2000, types: ['thunder'] },
  spark_nut:     { name: 'Spark Nut',          emoji: '🌰⚡', hungerRestore: 40, bondingBonus: 12, xpBonus: 30, cost: 1200, types: ['thunder'] },
  beast_feast:   { name: 'Beast Feast',        emoji: '🍖👑', hungerRestore: 80, bondingBonus: 25, xpBonus: 80, cost: 5000, types: ['ancient', 'beast'] },
};

// ── HELPER: roll a random egg type based on weights ───────────
function rollEggType() {
  const total = Object.values(EGG_SPAWN_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [eggId, weight] of Object.entries(EGG_SPAWN_WEIGHTS)) {
    roll -= weight;
    if (roll <= 0) return eggId;
  }
  return 'common_egg';
}

// ── HELPER: hatch egg into a random pet of that egg type ──────
function hatchEgg(eggId) {
  const eggDef = EGG_TYPES[eggId];
  if (!eggDef) return null;
  const pool = eggDef.possiblePets;
  const petId = pool[Math.floor(Math.random() * pool.length)];
  return PET_DATABASE[petId] || null;
}

module.exports = { PET_DATABASE, PET_FOOD, EGG_TYPES, EGG_SPAWN_WEIGHTS, rollEggType, hatchEgg };