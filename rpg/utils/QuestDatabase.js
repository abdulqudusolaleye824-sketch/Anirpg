// ═══════════════════════════════════════════════════════════════
// QUEST DATABASE - Complex Multi-Type Quest System
// ═══════════════════════════════════════════════════════════════

const QUEST_DATABASE = {
  // ═══════════════════════════════════════════════════════════════
  // STORY QUESTS - Main storyline progression
  // ═══════════════════════════════════════════════════════════════
  story: {
    'prologue_awakening': {
      id: 'prologue_awakening',
      name: '🌟 The Awakening',
      description: 'A mysterious power stirs within you. Prove yourself worthy by completing basic training.',
      type: 'story',
      chapter: 1,
      level: 1,
      objectives: [
        { type: 'kill', target: 'any', count: 5, current: 0, desc: 'Defeat 5 monsters' },
        { type: 'skill_use', count: 3, current: 0, desc: 'Use any skill 3 times' },
        { type: 'level', level: 2, current: 0, desc: 'Reach level 2' }
      ],
      rewards: {
        exp: 100,
        gold: 72,
        items: [{ name: 'Beginner\'s Sword', type: 'weapon', rarity: 'common' }],
        unlocks: ['prologue_first_dungeon']
      },
      dialogue: {
        start: '🌟 *A voice echoes in your mind...*\n\n"Chosen one, your journey begins. Show me your strength."',
        complete: '🎊 "Excellent! You\'ve proven yourself. But this is only the beginning..."',
        inProgress: '⚔️ Continue your training, warrior.'
      }
    },

    'prologue_first_dungeon': {
      id: 'prologue_first_dungeon',
      name: '🏰 Into the Depths',
      description: 'Ancient ruins have been discovered. Venture into the dungeons and prove your worth.',
      type: 'story',
      chapter: 1,
      level: 2,
      prerequisites: ['prologue_awakening'],
      objectives: [
        { type: 'dungeon_clear', floor: 'any', count: 1, current: 0, desc: 'Clear 1 dungeon' },
        { type: 'collect', item: 'Ancient Mana Stone', count: 1, current: 0, desc: 'Collect the Ancient Mana Stone' }
      ],
      rewards: {
        exp: 250,
        gold: 218,
        items: [{ name: 'Adventurer\'s Pack', type: 'accessory', rarity: 'uncommon' }],
        unlocks: ['chapter1_shadow_threat']
      },
      dialogue: {
        start: '🏰 "The ancient ruins call to you. What secrets lie within?"',
        complete: '✨ "The crystal pulses with power. Its energy feels... familiar."',
        inProgress: '🗺️ The dungeon awaits your return.'
      }
    },

    'chapter1_shadow_threat': {
      id: 'chapter1_shadow_threat',
      name: '👹 Rising Shadows',
      description: 'Dark forces gather. Investigate reports of shadow creatures near the village.',
      type: 'story',
      chapter: 2,
      level: 5,
      prerequisites: ['prologue_first_dungeon'],
      objectives: [
        { type: 'kill', target: 'Shadow Beast', count: 10, current: 0, desc: 'Defeat 10 Shadow Beasts' },
        { type: 'dungeon_clear', floor: 'any', count: 2, current: 0, desc: 'Clear 2 dungeons' },
        { type: 'pvp_win', count: 1, current: 0, desc: 'Win 1 PVP battle' }
      ],
      rewards: {
        exp: 500,
        gold: 435,
        items: [
          { name: 'Shadow Cloak', type: 'armor', rarity: 'rare' },
          { name: 'Darkness Gem', type: 'material', rarity: 'rare' }
        ],
        unlocks: ['chapter1_corrupted_guardian']
      },
      dialogue: {
        start: '⚡ "The shadows grow stronger. We need your help, hero!"',
        complete: '🛡️ "You\'ve pushed back the darkness... for now."',
        inProgress: '👹 Shadow creatures still lurk in the area.'
      }
    },

    'chapter1_corrupted_guardian': {
      id: 'chapter1_corrupted_guardian',
      name: '🔥 The Corrupted Guardian',
      description: 'A powerful guardian has been corrupted by shadow magic. Defeat it to save the realm.',
      type: 'story',
      chapter: 2,
      level: 8,
      prerequisites: ['chapter1_shadow_threat'],
      isBoss: true,
      objectives: [
        { type: 'boss_kill', target: 'Corrupted Guardian', count: 1, current: 0, desc: 'Defeat the Corrupted Guardian' }
      ],
      rewards: {
        exp: 1000,
        gold: 1088,
        items: [
          { name: 'Guardian\'s Blade', type: 'weapon', rarity: 'epic' },
          { name: 'Purification Stone', type: 'quest_item', rarity: 'legendary' }
        ],
        title: 'Shadow Slayer',
        unlocks: ['chapter2_ancient_prophecy']
      },
      dialogue: {
        start: '⚔️ "The corrupted guardian blocks your path. Its eyes glow with malevolent energy."',
        complete: '🌟 "As the guardian falls, the corruption fades. Peace returns... but at what cost?"',
        inProgress: '🔥 The guardian awaits. Prepare yourself well.'
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // DAILY QUESTS - Reset every 24 hours
  // ═══════════════════════════════════════════════════════════════
  daily: {
    'daily_monster_slayer': {
      id: 'daily_monster_slayer',
      name: '⚔️ Daily Hunt',
      description: 'Defeat monsters to earn rewards.',
      type: 'daily',
      resetTime: 24, // hours
      objectives: [
        { type: 'kill', target: 'any', count: 20, current: 0, desc: 'Defeat 20 monsters' }
      ],
      rewards: {
        exp: 150,
        gold: 145,
        items: [{ name: 'Daily Chest', type: 'chest', rarity: 'common' }]
      }
    },

    'daily_dungeon_crawler': {
      id: 'daily_dungeon_crawler',
      name: '🏰 Dungeon Expedition',
      description: 'Complete dungeons to earn rewards.',
      type: 'daily',
      resetTime: 24,
      objectives: [
        { type: 'dungeon_clear', floor: 'any', count: 3, current: 0, desc: 'Clear 3 dungeons' }
      ],
      rewards: {
        exp: 200,
        gold: 218,
        items: [{ name: 'Explorer\'s Cache', type: 'chest', rarity: 'uncommon' }]
      }
    },

    'daily_pvp_warrior': {
      id: 'daily_pvp_warrior',
      name: '🗡️ Arena Challenge',
      description: 'Prove your strength in PVP.',
      type: 'daily',
      resetTime: 24,
      objectives: [
        { type: 'pvp_participate', count: 3, current: 0, desc: 'Participate in 3 PVP battles' }
      ],
      rewards: {
        exp: 180,
        gold: 290,
        items: [{ name: 'Warrior\'s Token', type: 'currency', rarity: 'rare' }]
      }
    },

    'daily_skill_master': {
      id: 'daily_skill_master',
      name: '✨ Skill Training',
      description: 'Practice your abilities.',
      type: 'daily',
      resetTime: 24,
      objectives: [
        { type: 'skill_use', count: 15, current: 0, desc: 'Use skills 15 times' }
      ],
      rewards: {
        exp: 120,
        gold: 116,
        items: [{ name: 'Skill Scroll Fragment', type: 'material', rarity: 'uncommon' }]
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // WEEKLY QUESTS - Reset every 7 days
  // ═══════════════════════════════════════════════════════════════
  weekly: {
    'weekly_raid_master': {
      id: 'weekly_raid_master',
      name: '👑 Weekly Raid',
      description: 'Complete high-level content.',
      type: 'weekly',
      resetTime: 168, // hours (7 days)
      objectives: [
        { type: 'dungeon_clear', floor: 'any', count: 5, current: 0, desc: 'Clear 5 dungeons' },
        { type: 'boss_kill', target: 'any', count: 3, current: 0, desc: 'Defeat 3 bosses' }
      ],
      rewards: {
        exp: 1500,
        gold: 1450,
        items: [
          { name: 'Weekly Raid Chest', type: 'chest', rarity: 'epic' },
          { name: 'Raid Token', type: 'currency', rarity: 'epic' }
        ]
      }
    },

    'weekly_pvp_champion': {
      id: 'weekly_pvp_champion',
      name: '🏆 Arena Champion',
      description: 'Dominate the arena.',
      type: 'weekly',
      resetTime: 168,
      objectives: [
        { type: 'pvp_win', count: 10, current: 0, desc: 'Win 10 PVP battles' },
        { type: 'pvp_streak', count: 3, current: 0, desc: 'Get a 3-win streak' }
      ],
      rewards: {
        exp: 1200,
        gold: 2175,
        items: [
          { name: 'Champion\'s Trophy', type: 'accessory', rarity: 'epic' },
          { name: 'Glory Points', type: 'currency', amount: 50 }
        ]
      }
    },

    'weekly_collector': {
      id: 'weekly_collector',
      name: '📦 Treasure Hunter',
      description: 'Gather valuable materials.',
      type: 'weekly',
      resetTime: 168,
      objectives: [
        { type: 'collect', item: 'rare_material', count: 20, current: 0, desc: 'Collect 20 rare materials' },
        { type: 'collect', item: 'epic_material', count: 5, current: 0, desc: 'Collect 5 epic materials' }
      ],
      rewards: {
        exp: 1000,
        gold: 1160,
        items: [
          { name: 'Collector\'s Box', type: 'chest', rarity: 'epic' },
          { name: 'Enhancement Stone', type: 'material', rarity: 'rare' }
        ]
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // SIDE QUESTS - Optional content
  // ═══════════════════════════════════════════════════════════════
  side: {
    'side_blacksmith_favor': {
      id: 'side_blacksmith_favor',
      name: '🔨 Blacksmith\'s Request',
      description: 'The blacksmith needs materials for a special project.',
      type: 'side',
      level: 3,
      objectives: [
        { type: 'collect', item: 'Iron Ore', count: 10, current: 0, desc: 'Collect 10 Iron Ore' },
        { type: 'collect', item: 'Coal', count: 5, current: 0, desc: 'Collect 5 Coal' }
      ],
      rewards: {
        exp: 300,
        gold: 290,
        items: [{ name: 'Forged Weapon', type: 'weapon', rarity: 'uncommon' }],
        reputation: { faction: 'Blacksmith Guild', amount: 50 }
      },
      dialogue: {
        start: '🔨 "Hey adventurer! I need materials. Can you help?"',
        complete: '⚒️ "Perfect! Here, take this weapon I crafted for you."',
        inProgress: '🔥 Still need those materials, friend.'
      }
    },

    'side_lost_pet': {
      id: 'side_lost_pet',
      name: '🐕 Lost Companion',
      description: 'A villager\'s pet has gone missing in the forest.',
      type: 'side',
      level: 4,
      objectives: [
        { type: 'explore', location: 'Dark Forest', current: 0, desc: 'Explore the Dark Forest' },
        { type: 'rescue', target: 'Lost Pet', count: 1, current: 0, desc: 'Find and rescue the pet' }
      ],
      rewards: {
        exp: 250,
        gold: 218,
        items: [{ name: 'Pet Collar', type: 'accessory', rarity: 'uncommon' }],
        unlocks: ['pet_system'],
        reputation: { faction: 'Village', amount: 30 }
      },
      dialogue: {
        start: '😢 "Please find my pet! I heard noises from the Dark Forest..."',
        complete: '🥰 "Thank you so much! Please, take this as thanks!"',
        inProgress: '🐾 Keep searching the forest...'
      }
    },

    'side_ancient_library': {
      id: 'side_ancient_library',
      name: '📚 Knowledge Seeker',
      description: 'Collect ancient tomes for the scholar.',
      type: 'side',
      level: 6,
      objectives: [
        { type: 'collect', item: 'Ancient Tome', count: 5, current: 0, desc: 'Find 5 Ancient Tomes' },
        { type: 'dungeon_clear', floor: 'any', count: 1, current: 0, desc: 'Clear 1 dungeon' }
      ],
      rewards: {
        exp: 500,
        gold: 435,
        items: [
          { name: 'Wisdom Scroll', type: 'consumable', rarity: 'rare' },
          { name: 'Skill Book', type: 'skill_unlock', rarity: 'rare' }
        ],
        reputation: { faction: 'Scholars', amount: 75 }
      },
      dialogue: {
        start: '📖 "Ancient knowledge awaits in those dungeons. Retrieve the tomes!"',
        complete: '🧙 "Marvelous! These contain forgotten spells..."',
        inProgress: '📚 The tomes are still out there.'
      }
    },

    'side_merchant_caravan': {
      id: 'side_merchant_caravan',
      name: '🛡️ Caravan Guard',
      description: 'Protect the merchant caravan from bandits.',
      type: 'side',
      level: 7,
      objectives: [
        { type: 'defend', waves: 3, current: 0, desc: 'Survive 3 waves of bandits' },
        { type: 'kill', target: 'Bandit', count: 15, current: 0, desc: 'Defeat 15 bandits' }
      ],
      rewards: {
        exp: 600,
        gold: 725,
        items: [
          { name: 'Merchant\'s Gratitude', type: 'accessory', rarity: 'rare' },
          { name: 'Trade Permit', type: 'quest_item', rarity: 'uncommon' }
        ],
        reputation: { faction: 'Merchants', amount: 100 }
      },
      dialogue: {
        start: '💠 "Bandits have been attacking! We need protection!"',
        complete: '🎉 "You saved our caravan! Take this reward!"',
        inProgress: '⚔️ The bandits are still out there...'
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // CHAIN QUESTS - Multi-part quest lines
  // ═══════════════════════════════════════════════════════════════
  chain: {
    'dragon_legacy_1': {
      id: 'dragon_legacy_1',
      name: '🐉 Dragon\'s Legacy - Part I',
      description: 'Ancient dragon lore speaks of a legendary artifact.',
      type: 'chain',
      chainId: 'dragon_legacy',
      part: 1,
      level: 10,
      objectives: [
        { type: 'collect', item: 'Dragon Scale Fragment', count: 5, current: 0, desc: 'Collect 5 Dragon Scale Fragments' },
        { type: 'kill', target: 'Drake', count: 3, current: 0, desc: 'Defeat 3 Drakes' }
      ],
      rewards: {
        exp: 800,
        gold: 725,
        items: [{ name: 'Dragon Tracker', type: 'quest_item', rarity: 'rare' }],
        unlocks: ['dragon_legacy_2']
      },
      dialogue: {
        start: '🐉 "The dragons hold ancient secrets. Find their traces..."',
        complete: '✨ "The fragments resonate with power. There\'s more to discover."',
        inProgress: '🔍 Search for dragon traces.'
      }
    },

    'dragon_legacy_2': {
      id: 'dragon_legacy_2',
      name: '🐉 Dragon\'s Legacy - Part II',
      description: 'Follow the trail to the Dragon\'s Lair.',
      type: 'chain',
      chainId: 'dragon_legacy',
      part: 2,
      level: 12,
      prerequisites: ['dragon_legacy_1'],
      objectives: [
        { type: 'explore', location: 'Dragon\'s Lair', current: 0, desc: 'Find the Dragon\'s Lair' },
        { type: 'boss_kill', target: 'Ancient Dragon', count: 1, current: 0, desc: 'Defeat the Ancient Dragon' }
      ],
      rewards: {
        exp: 1500,
        gold: 1450,
        items: [
          { name: 'Dragon Heart', type: 'material', rarity: 'legendary' },
          { name: 'Dragon Fang Blade', type: 'weapon', rarity: 'epic' }
        ],
        unlocks: ['dragon_legacy_3']
      },
      dialogue: {
        start: '⚡ "The lair awaits. Steel yourself for battle!"',
        complete: '🔥 "The dragon falls, but its legacy lives on..."',
        inProgress: '🗻 The dragon awaits in its lair.'
      }
    },

    'dragon_legacy_3': {
      id: 'dragon_legacy_3',
      name: '🐉 Dragon\'s Legacy - Finale',
      description: 'Claim the ultimate dragon artifact.',
      type: 'chain',
      chainId: 'dragon_legacy',
      part: 3,
      level: 15,
      prerequisites: ['dragon_legacy_2'],
      objectives: [
        { type: 'craft', item: 'Dragon Soul Weapon', count: 1, current: 0, desc: 'Forge the Dragon Soul Weapon' },
        { type: 'equip', item: 'Dragon Soul Weapon', count: 1, current: 0, desc: 'Equip the legendary weapon' }
      ],
      rewards: {
        exp: 2500,
        gold: 2900,
        items: [{ name: 'Dragon Soul Weapon', type: 'weapon', rarity: 'legendary' }],
        title: 'Dragonborn',
        achievement: 'dragon_master'
      },
      dialogue: {
        start: '⚒️ "Use the dragon heart to forge a legendary weapon!"',
        complete: '👑 "You are now one with the dragon\'s power. You are Dragonborn!"',
        inProgress: '🔨 The forging awaits.'
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // ACHIEVEMENT QUESTS - Special challenges
  // ═══════════════════════════════════════════════════════════════
  achievement: {
    'achieve_first_blood': {
      id: 'achieve_first_blood',
      name: '⚔️ First Blood',
      description: 'Defeat your first monster.',
      type: 'achievement',
      hidden: false,
      objectives: [
        { type: 'kill', target: 'any', count: 1, current: 0, desc: 'Defeat 1 monster' }
      ],
      rewards: {
        exp: 50,
        gold: 36,
        achievement: 'first_blood',
        title: 'Monster Slayer'
      }
    },

    'achieve_centurion': {
      id: 'achieve_centurion',
      name: '💯 Centurion',
      description: 'Defeat 100 monsters.',
      type: 'achievement',
      hidden: false,
      objectives: [
        { type: 'kill', target: 'any', count: 100, current: 0, desc: 'Defeat 100 monsters' }
      ],
      rewards: {
        exp: 1000,
        gold: 725,
        achievement: 'centurion',
        title: 'Veteran Slayer'
      }
    },

    'achieve_dungeon_master': {
      id: 'achieve_dungeon_master',
      name: '🏰 Dungeon Master',
      description: 'Clear dungeons to prove your mastery.',
      type: 'achievement',
      hidden: false,
      objectives: [
        { type: 'dungeon_clear', floor: 'any', count: 5, current: 0, desc: 'Clear 5 dungeons' }
      ],
      rewards: {
        exp: 2000,
        gold: 2175,
        achievement: 'dungeon_master',
        title: 'Dungeon Conqueror'
      }
    },

    'achieve_undefeated': {
      id: 'achieve_undefeated',
      name: '🏆 Undefeated',
      description: 'Win 10 PVP battles in a row.',
      type: 'achievement',
      hidden: false,
      objectives: [
        { type: 'pvp_streak', count: 10, current: 0, desc: 'Win 10 battles in a row' }
      ],
      rewards: {
        exp: 1500,
        gold: 2900,
        achievement: 'undefeated',
        title: 'Arena Legend'
      }
    },

    'achieve_wealthy': {
      id: 'achieve_wealthy',
      name: '💠 Merchant King',
      description: 'Accumulate 10,000 gold.',
      type: 'achievement',
      hidden: false,
      objectives: [
        { type: 'gold_total', amount: 10000, current: 0, desc: 'Accumulate 10,000 gold' }
      ],
      rewards: {
        exp: 800,
        achievement: 'wealthy',
        title: 'Nexus Hoarder'
      }
    }
  }
};

module.exports = QUEST_DATABASE;