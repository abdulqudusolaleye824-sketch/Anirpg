// ═══════════════════════════════════════════════════════════════
// COMPLETE BOSS SYSTEM - LEVELS 1-100, ALL RANKS
// ═══════════════════════════════════════════════════════════════

const BOSS_DATABASE = {
  // ═══════════════════════════════════════════════════════════════
  // F-RANK BOSSES (Levels 1-10)
  // ═══════════════════════════════════════════════════════════════
  F: [
    {
      name: 'Giant Slime King',
      emoji: '👑',
      title: 'Lord of the Slimes',
      rank: 'F',
      minLevel: 1,
      maxLevel: 5,
      statMultiplier: 1.8, // 3x player stats
      abilities: ['Acid Spit', 'Bounce', 'Toxic Sludge'],
      baseGoldReward: 150,
      description: 'A massive slime that absorbed countless weaker slimes'
    },
    {
      name: 'Goblin Warchief',
      emoji: '👺',
      title: 'Savage Leader',
      rank: 'F',
      minLevel: 3,
      maxLevel: 8,
      statMultiplier: 1.9,
      abilities: ['Slash', 'Backstab', 'Battle Cry'],
      baseGoldReward: 180,
      description: 'Cunning and vicious goblin commander'
    },
    {
      name: 'Wolf Alpha',
      emoji: '🐺',
      title: 'Pack Leader',
      rank: 'F',
      minLevel: 5,
      maxLevel: 10,
      statMultiplier: 2.0,
      abilities: ['Bite', 'Howl', 'Pack Tactics'],
      baseGoldReward: 200,
      description: 'The strongest wolf in the forest'
    },
    {
      name: 'Corrupted Treant',
      emoji: '🌳',
      title: 'Twisted Guardian',
      rank: 'F',
      minLevel: 7,
      maxLevel: 12,
      statMultiplier: 2.2,
      abilities: ['Root Strangle', 'Thorn Barrage', 'Poison Spores'],
      baseGoldReward: 220,
      description: 'Ancient tree corrupted by dark magic'
    }
  ],

  // ═══════════════════════════════════════════════════════════════
  // E-RANK BOSSES (Levels 10-20)
  // ═══════════════════════════════════════════════════════════════
  E: [
    {
      name: 'Skeleton Knight',
      emoji: '💀',
      title: 'Undead Warrior',
      rank: 'E',
      minLevel: 10,
      maxLevel: 15,
      statMultiplier: 2.5,
      abilities: ['Bone Slash', 'Death Grip', 'Corpse Explosion'],
      baseGoldReward: 300,
      description: 'Fallen knight cursed to eternal battle'
    },
    {
      name: 'Fire Elemental',
      emoji: '🔥',
      title: 'Living Flame',
      rank: 'E',
      minLevel: 12,
      maxLevel: 18,
      statMultiplier: 2.7,
      abilities: ['Fireball', 'Flame Burst', 'Inferno'],
      baseGoldReward: 350,
      description: 'Pure fire given sentience'
    },
    {
      name: 'Giant Spider Queen',
      emoji: '🕷️',
      title: 'Web Weaver',
      rank: 'E',
      minLevel: 14,
      maxLevel: 20,
      statMultiplier: 2.8,
      abilities: ['Poison Bite', 'Web Trap', 'Swarm'],
      baseGoldReward: 400,
      description: 'Mother of thousands of spiders'
    },
    {
      name: 'Orc Chieftain',
      emoji: '👹',
      title: 'Brutal Commander',
      rank: 'E',
      minLevel: 16,
      maxLevel: 22,
      statMultiplier: 3.0,
      abilities: ['Crushing Blow', 'War Cry', 'Berserk Rage'],
      baseGoldReward: 450,
      description: 'Strongest warrior of the orc tribe'
    }
  ],

  // ═══════════════════════════════════════════════════════════════
  // D-RANK BOSSES (Levels 20-35)
  // ═══════════════════════════════════════════════════════════════
  D: [
    {
      name: 'Frost Wyrm',
      emoji: '🐉',
      title: 'Ice Dragon',
      rank: 'D',
      minLevel: 20,
      maxLevel: 28,
      statMultiplier: 3.3,
      abilities: ['Frost Breath', 'Ice Shard', 'Blizzard'],
      baseGoldReward: 600,
      description: 'Young dragon of eternal winter'
    },
    {
      name: 'Vampire Lord',
      emoji: '🧛',
      title: 'Blood Sovereign',
      rank: 'D',
      minLevel: 23,
      maxLevel: 30,
      statMultiplier: 3.5,
      abilities: ['Life Drain', 'Blood Feast', 'Hypnosis'],
      baseGoldReward: 700,
      description: 'Ancient vampire who feeds on heroes'
    },
    {
      name: 'Corrupted Golem',
      emoji: '🗿',
      title: 'Stone Colossus',
      rank: 'D',
      minLevel: 26,
      maxLevel: 33,
      statMultiplier: 3.8,
      abilities: ['Earthquake', 'Stone Fist', 'Rock Armor'],
      baseGoldReward: 800,
      description: 'Massive construct of living stone'
    },
    {
      name: 'Dark Sorcerer',
      emoji: '🧙',
      title: 'Master of Shadows',
      rank: 'D',
      minLevel: 29,
      maxLevel: 35,
      statMultiplier: 4.0,
      abilities: ['Dark Curse', 'Shadow Bolt', 'Void Blast'],
      baseGoldReward: 900,
      description: 'Wizard who fell to dark magic'
    }
  ],

  // ═══════════════════════════════════════════════════════════════
  // C-RANK BOSSES (Levels 35-50)
  // ═══════════════════════════════════════════════════════════════
  C: [
    {
      name: 'Thunder Drake',
      emoji: '⚡',
      title: 'Storm Bringer',
      rank: 'C',
      minLevel: 35,
      maxLevel: 42,
      statMultiplier: 4.5,
      abilities: ['Lightning Bolt', 'Thunder Strike', 'Storm Fury'],
      baseGoldReward: 1200,
      description: 'Dragon that commands lightning itself'
    },
    {
      name: 'Lich King',
      emoji: '👻',
      title: 'Death Eternal',
      rank: 'C',
      minLevel: 38,
      maxLevel: 45,
      statMultiplier: 4.8,
      abilities: ['Death Coil', 'Army of Dead', 'Soul Harvest'],
      baseGoldReward: 1400,
      description: 'Necromancer who achieved immortality'
    },
    {
      name: 'Demon Commander',
      emoji: '😈',
      title: 'Infernal General',
      rank: 'C',
      minLevel: 41,
      maxLevel: 48,
      statMultiplier: 5.0,
      abilities: ['Inferno Wave', 'Demon Form', 'Hell Fire'],
      baseGoldReward: 1600,
      description: 'High-ranking demon from the abyss'
    },
    {
      name: 'Ancient Hydra',
      emoji: '🐍',
      title: 'Multi-Headed Terror',
      rank: 'C',
      minLevel: 44,
      maxLevel: 50,
      statMultiplier: 5.5,
      abilities: ['Venom Nova', 'Regeneration', 'Multiple Bites'],
      baseGoldReward: 1800,
      description: 'Legendary beast with nine heads'
    }
  ],

  // ═══════════════════════════════════════════════════════════════
  // B-RANK BOSSES (Levels 50-65)
  // ═══════════════════════════════════════════════════════════════
  B: [
    {
      name: 'Elder Dragon',
      emoji: '🐲',
      title: 'Ancient Wyrm',
      rank: 'B',
      minLevel: 50,
      maxLevel: 57,
      statMultiplier: 6.0,
      abilities: ['Dragon Breath', 'Tail Sweep', 'Wing Tempest', 'Dragon Fear'],
      baseGoldReward: 2500,
      description: 'Centuries-old dragon of immense power'
    },
    {
      name: 'Archlich',
      emoji: '💀',
      title: 'Master of Undeath',
      rank: 'B',
      minLevel: 53,
      maxLevel: 60,
      statMultiplier: 6.5,
      abilities: ['Death Nova', 'Plague', 'Lich Form', 'Soul Reap'],
      baseGoldReward: 2800,
      description: 'Most powerful of all liches'
    },
    {
      name: 'Phoenix',
      emoji: '🔥',
      title: 'Eternal Flame',
      rank: 'B',
      minLevel: 56,
      maxLevel: 63,
      statMultiplier: 7.0,
      abilities: ['Rebirth', 'Flame Nova', 'Solar Flare', 'Ash Storm'],
      baseGoldReward: 3000,
      description: 'Immortal bird of fire that never truly dies'
    },
    {
      name: 'Kraken',
      emoji: '🦑',
      title: 'Terror of the Deep',
      rank: 'B',
      minLevel: 59,
      maxLevel: 65,
      statMultiplier: 7.5,
      abilities: ['Tentacle Crush', 'Whirlpool', 'Tidal Wave', 'Ink Cloud'],
      baseGoldReward: 3300,
      description: 'Massive sea monster from the darkest depths'
    }
  ],

  // ═══════════════════════════════════════════════════════════════
  // A-RANK BOSSES (Levels 65-80)
  // ═══════════════════════════════════════════════════════════════
  A: [
    {
      name: 'Titan Overlord',
      emoji: '⛰️',
      title: 'World Shaker',
      rank: 'A',
      minLevel: 65,
      maxLevel: 72,
      statMultiplier: 15.0,
      abilities: ['Meteor Strike', 'Earthquake', 'Titan Slam', 'Mountain Crash'],
      baseGoldReward: 4500,
      description: 'Ancient giant that can level mountains'
    },
    {
      name: 'Demon Lord',
      emoji: '👿',
      title: 'Prince of Hell',
      rank: 'A',
      minLevel: 68,
      maxLevel: 75,
      statMultiplier: 16.0,
      abilities: ['Inferno Wave', 'Soul Drain', 'Demon Form', 'Hell Gate'],
      baseGoldReward: 5000,
      description: 'Ruler of an entire layer of hell'
    },
    {
      name: 'Ancient Leviathan',
      emoji: '🐋',
      title: 'Ocean Destroyer',
      rank: 'A',
      minLevel: 71,
      maxLevel: 78,
      statMultiplier: 17.0,
      abilities: ['Tidal Annihilation', 'Deep Sea Pressure', 'Tsunami', 'Maelstrom'],
      baseGoldReward: 5500,
      description: 'Colossal sea beast from before time'
    },
    {
      name: 'Void Dragon',
      emoji: '🌌',
      title: 'Destroyer of Worlds',
      rank: 'A',
      minLevel: 74,
      maxLevel: 80,
      statMultiplier: 18.0,
      abilities: ['Void Blast', 'Reality Tear', 'Absolute Zero', 'Dimension Break'],
      baseGoldReward: 6000,
      description: 'Dragon from the space between dimensions'
    }
  ],

  // ═══════════════════════════════════════════════════════════════
  // S-RANK BOSSES (Levels 80-90)
  // ═══════════════════════════════════════════════════════════════
  S: [
    {
      name: 'Celestial Guardian',
      emoji: '✨',
      title: 'Heaven\'s Warden',
      rank: 'S',
      minLevel: 80,
      maxLevel: 85,
      statMultiplier: 20.0,
      abilities: ['Divine Judgment', 'Holy Wrath', 'Celestial Strike', 'Heaven\'s Fury', 'Purification'],
      baseGoldReward: 8000,
      description: 'Guardian sent by the gods themselves'
    },
    {
      name: 'Primordial Dragon',
      emoji: '🐉',
      title: 'First of Dragons',
      rank: 'S',
      minLevel: 83,
      maxLevel: 88,
      statMultiplier: 22.0,
      abilities: ['Primordial Flame', 'Dragon\'s Reign', 'Ancient Power', 'Cataclysm', 'Draconic Might'],
      baseGoldReward: 9000,
      description: 'The first dragon, born from chaos itself'
    },
    {
      name: 'Archfiend',
      emoji: '😈',
      title: 'King of Demons',
      rank: 'S',
      minLevel: 86,
      maxLevel: 90,
      statMultiplier: 24.0,
      abilities: ['Apocalypse', 'Soul Annihilation', 'Infernal Dominion', 'Damnation', 'Hell\'s Wrath'],
      baseGoldReward: 10000,
      description: 'Supreme ruler of all demons'
    }
  ],

  // ═══════════════════════════════════════════════════════════════
  // SS-RANK BOSSES (Levels 90-95)
  // ═══════════════════════════════════════════════════════════════
  SS: [
    {
      name: 'World Eater',
      emoji: '🌍',
      title: 'Devourer of Planets',
      rank: 'SS',
      minLevel: 90,
      maxLevel: 93,
      statMultiplier: 28.0,
      abilities: ['Planet Crush', 'Cosmic Devour', 'Gravity Collapse', 'Universal Hunger', 'World End'],
      baseGoldReward: 15000,
      description: 'Entity that consumes entire worlds'
    },
    {
      name: 'Time Weaver',
      emoji: '⏰',
      title: 'Master of Time',
      rank: 'SS',
      minLevel: 92,
      maxLevel: 95,
      statMultiplier: 30.0,
      abilities: ['Time Stop', 'Temporal Rift', 'Age Decay', 'Time Loop', 'Causality Break'],
      baseGoldReward: 18000,
      description: 'Being that controls the flow of time itself'
    }
  ],

  // ═══════════════════════════════════════════════════════════════
  // NATIONAL-RANK BOSSES (Levels 95-98)
  // ═══════════════════════════════════════════════════════════════
  National: [
    {
      name: 'Shadow Monarch',
      emoji: '👑',
      title: 'King of Death',
      rank: 'National',
      minLevel: 95,
      maxLevel: 97,
      statMultiplier: 35.0,
      abilities: ['Army Summon', 'Shadow Exchange', 'Absolute Dominion', 'Death\'s Touch', 'Monarch\'s Domain', 'Shadow Extraction'],
      baseGoldReward: 25000,
      description: 'Absolute ruler of all shadows and death'
    },
    {
      name: 'Heaven\'s Architect',
      emoji: '🏛️',
      title: 'Creator God',
      rank: 'National',
      minLevel: 96,
      maxLevel: 98,
      statMultiplier: 40.0,
      abilities: ['Creation', 'Divine Punishment', 'Reality Warp', 'Absolute Authority', 'God\'s Will', 'Universe Remake'],
      baseGoldReward: 30000,
      description: 'God-like entity that shapes reality'
    }
  ],

  // ═══════════════════════════════════════════════════════════════
  // BEYOND-RANK BOSSES (Levels 98-100)
  // ═══════════════════════════════════════════════════════════════
  Beyond: [
    {
      name: 'The Absolute Being',
      emoji: '🌟',
      title: 'Creator of All',
      rank: 'Beyond',
      minLevel: 98,
      maxLevel: 100,
      statMultiplier: 50.0,
      abilities: ['Absolute Creation', 'Absolute Destruction', 'Omnipotence', 'Existence Erasure', 'Final Judgment', 'End of All Things', 'Rebirth'],
      baseGoldReward: 50000,
      description: 'The supreme being that created everything'
    },
    {
      name: 'Void Incarnate',
      emoji: '⚫',
      title: 'The End of Existence',
      rank: 'Beyond',
      minLevel: 99,
      maxLevel: 100,
      statMultiplier: 55.0,
      abilities: ['Void Consumption', 'Nothingness', 'Anti-Creation', 'Reality Deletion', 'Entropy', 'Absolute Void', 'Universal Collapse'],
      baseGoldReward: 60000,
      description: 'Pure void that seeks to return all to nothing'
    }
  ]
};

// ═══════════════════════════════════════════════════════════════
// BOSS GENERATION
// ═══════════════════════════════════════════════════════════════

function getAvailableBosses(playerLevel) {
  const available = [];
  
  for (const rank in BOSS_DATABASE) {
    BOSS_DATABASE[rank].forEach(bossTemplate => {
      // Boss available if player level is within range
      if (playerLevel >= bossTemplate.minLevel && playerLevel <= bossTemplate.maxLevel + 5) {
        available.push(bossTemplate);
      }
    });
  }
  
  return available;
}

function generateBoss(bossTemplate, playerLevel) {
  // Boss = ~3x a regular dungeon monster at same level
  // Should be very hard solo, manageable with a party of 2-3
  // Player at level N: HP~100+(N*10), ATK~10+(N*3), DEF~5+(N*2)
  const baseHP  = 120 + (playerLevel * 30);
  const baseATK = 12  + (playerLevel * 3.5);
  const baseDEF = 6   + (playerLevel * 1.8);

  const boss = {
    name: bossTemplate.name,
    emoji: bossTemplate.emoji,
    title: bossTemplate.title,
    rank: bossTemplate.rank,
    level: playerLevel,
    description: bossTemplate.description,
    abilities: [...bossTemplate.abilities],
    stats: {
      hp:    Math.floor(baseHP  * bossTemplate.statMultiplier),
      maxHp: Math.floor(baseHP  * bossTemplate.statMultiplier),
      atk:   Math.floor(baseATK * bossTemplate.statMultiplier),
      def:   Math.floor(baseDEF * bossTemplate.statMultiplier),
      speed: 100
    },
    statusEffects: [],
    buffs: [],
    baseGoldReward: bossTemplate.baseGoldReward
  };
  
  return boss;
}

function calculateBossRewards(boss, playerLevel) {
  // Rank multipliers
  const rankMultipliers = {
    'F': 1.0,
    'E': 1.5,
    'D': 2.0,
    'C': 3.0,
    'B': 4.5,
    'A': 6.0,
    'S': 8.0,
    'SS': 12.0,
    'National': 20.0,
    'Beyond': 30.0
  };
  
  const multiplier = rankMultipliers[boss.rank] || 1.0;
  
  return {
    xp:       Math.floor((100 + playerLevel * 10) * multiplier * 7.5),
    gold:     Math.floor(boss.baseGoldReward * multiplier * 1.45 * 100),
    crystals: Math.floor((7.25 + Math.floor(playerLevel / 10)) * multiplier * 2.5)
  };
}

function generateBossLoot(boss, playerLevel) {
  const { GEAR_CATALOG, CATALOG_BY_RARITY, getRandomGear } = require('../utils/GearCatalog');
  const loot = [];

  // Rarity pool by rank — guaranteed at least 1 item always drops
  const rankRarityPool = {
    'F': ['common', 'uncommon'],
    'E': ['uncommon', 'rare'],
    'D': ['rare', 'rare', 'epic'],
    'C': ['rare', 'epic', 'epic'],
    'B': ['epic', 'epic', 'legendary'],
    'A': ['epic', 'legendary', 'legendary'],
    'S': ['legendary', 'legendary', 'mythic'],
    'SS': ['legendary', 'mythic', 'mythic'],
    'National': ['mythic', 'mythic'],
    'Beyond': ['mythic', 'mythic']
  };

  const slots = ['weapon', 'chest', 'helmet', 'ring', 'gloves', 'boots'];
  const pool = rankRarityPool[boss.rank] || rankRarityPool['F'];

  // Always drop 1-2 real gear pieces from GearCatalog
  const dropCount = ['S','SS','National','Beyond'].includes(boss.rank) ? 2 : 1;
  for (let i = 0; i < dropCount; i++) {
    const rarity = pool[Math.floor(Math.random() * pool.length)];
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const gear = getRandomGear(slot, rarity);
    if (gear) {
      loot.push({
        ...gear,
        type: 'gear',
        equipped: false,
        durability: gear.maxDurability || 100,
        source: boss.name
      });
    }
  }

  // Bonus consumable drop (70% chance)
  if (Math.random() < 0.7) {
    const consumables = [
      { name: 'Boss HP Potion', type: 'item', effect: 'hp', healAmount: 150 + playerLevel * 5, rarity: 'rare' },
      { name: 'Energy Elixir', type: 'item', effect: 'energy', healAmount: 80 + playerLevel * 2, rarity: 'rare' },
      { name: 'Power Shard', type: 'item', effect: 'buff', buffStat: 'atk', buffAmount: 15, duration: 3, rarity: 'epic' },
      { name: 'Iron Skin Charm', type: 'item', effect: 'buff', buffStat: 'def', buffAmount: 15, duration: 3, rarity: 'epic' },
    ];
    loot.push(consumables[Math.floor(Math.random() * consumables.length)]);
  }

  return loot;
}

// ═══════════════════════════════════════════════════════════════
// BOSS RANKING INFO
// ═══════════════════════════════════════════════════════════════

function getBossRankInfo(rank) {
  const rankInfo = {
    'F': {
      color: '⚪',
      difficulty: 'Easy',
      recommendedLevel: '1-10',
      description: 'Entry level threats'
    },
    'E': {
      color: '🟢',
      difficulty: 'Normal',
      recommendedLevel: '10-20',
      description: 'Moderate challenge'
    },
    'D': {
      color: '🔵',
      difficulty: 'Hard',
      recommendedLevel: '20-35',
      description: 'Dangerous enemies'
    },
    'C': {
      color: '🟡',
      difficulty: 'Very Hard',
      recommendedLevel: '35-50',
      description: 'Serious threats'
    },
    'B': {
      color: '🟠',
      difficulty: 'Extreme',
      recommendedLevel: '50-65',
      description: 'Legendary creatures'
    },
    'A': {
      color: '🔴',
      difficulty: 'Insane',
      recommendedLevel: '65-80',
      description: 'World-ending monsters'
    },
    'S': {
      color: '🟣',
      difficulty: 'Nightmare',
      recommendedLevel: '80-90',
      description: 'God-like beings'
    },
    'SS': {
      color: '⚫',
      difficulty: 'Impossible',
      recommendedLevel: '90-95',
      description: 'Beyond mortal comprehension'
    },
    'National': {
      color: '💎',
      difficulty: 'Death Wish',
      recommendedLevel: '95-98',
      description: 'Nation-level threats'
    },
    'Beyond': {
      color: '🌟',
      difficulty: 'BEYOND',
      recommendedLevel: '98-100',
      description: 'Existence-ending entities'
    }
  };
  
  return rankInfo[rank] || rankInfo['F'];
}

// ═══════════════════════════════════════════════════════════════
// BOSS STATISTICS
// ═══════════════════════════════════════════════════════════════

function getTotalBossCount() {
  let total = 0;
  for (const rank in BOSS_DATABASE) {
    total += BOSS_DATABASE[rank].length;
  }
  return total;
}

function getBossesByRank(rank) {
  return BOSS_DATABASE[rank] || [];
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  BOSS_DATABASE,
  getAvailableBosses,
  generateBoss,
  calculateBossRewards,
  generateBossLoot,
  getBossRankInfo,
  getTotalBossCount,
  getBossesByRank
};