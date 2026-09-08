// ═══════════════════════════════════════════════════════════════
// ENHANCED ARTIFACT SYSTEM - With Upgrades, Sets, Fusion, Combat
// ═══════════════════════════════════════════════════════════════

const ARTIFACT_DATABASE = {
  // ═══════════════════════════════════════════════════════════════
  // LEGENDARY WEAPONS
  // ═══════════════════════════════════════════════════════════════
  'Excalibur': {
    name: 'Excalibur',
    type: 'weapon',
    rarity: 'legendary',
    emoji: '⚔️',
    description: 'The legendary sword of kings. Radiates holy power.',
    set: 'Holy Knight',  // ✅ NEW: Set bonus system
    stats: {
      attack: 150,
      defense: 30,
      speed: 20
    },
    abilities: [
      {
        name: 'Divine Slash',
        description: '+50% damage vs dark enemies',
        effect: 'damage_vs_dark',
        value: 50
      },
      {
        name: 'King\'s Blessing',
        description: 'Regenerate 5% HP per turn',
        effect: 'regen_hp',
        value: 5
      }
    ],
    requirements: {
      level: 50,
      class: ['Warrior', 'Paladin']
    }
  },

  'Mjolnir': {
    name: 'Mjolnir',
    type: 'weapon',
    rarity: 'legendary',
    emoji: '🔨',
    description: 'Thor\'s legendary hammer. Controls lightning.',
    set: 'Thunder God',
    stats: {
      attack: 180,
      defense: 40,
      speed: -10
    },
    abilities: [
      {
        name: 'Lightning Strike',
        description: '30% chance to stun enemy for 2 turns',
        effect: 'stun_chance',
        value: 30,
        procChance: 30
      },
      {
        name: 'Thunder God',
        description: '+100% damage with lightning skills',
        effect: 'boost_lightning',
        value: 100
      }
    ],
    requirements: {
      level: 60,
      class: ['Warrior', 'Berserker']
    }
  },

  'Staff of Eternity': {
    name: 'Staff of Eternity',
    type: 'weapon',
    rarity: 'legendary',
    emoji: '🪄',
    description: 'Ancient staff that bends time and space.',
    set: 'Archmage',
    stats: {
      attack: 120,
      defense: 20,
      magicPower: 200
    },
    abilities: [
      {
        name: 'Time Warp',
        description: 'Reduce all skill cooldowns by 50%',
        effect: 'cooldown_reduction',
        value: 50
      },
      {
        name: 'Arcane Mastery',
        description: '+80% magic damage',
        effect: 'magic_damage',
        value: 80
      },
      {
        name: 'Mana Font',
        description: 'Skills cost 30% less mana',
        effect: 'mana_cost_reduction',
        value: 30
      }
    ],
    requirements: {
      level: 55,
      class: ['Mage', 'Necromancer']
    }
  },

  'Shadow Fang': {
    name: 'Shadow Fang',
    type: 'weapon',
    rarity: 'legendary',
    emoji: '🗡️',
    description: 'Dagger forged in absolute darkness.',
    set: 'Assassin\'s Shadow',
    stats: {
      attack: 140,
      defense: 10,
      speed: 60,
      critChance: 40
    },
    abilities: [
      {
        name: 'Assassinate',
        description: '25% chance for instant kill on enemies <30% HP',
        effect: 'execute',
        value: 25,
        procChance: 25
      },
      {
        name: 'Shadow Cloak',
        description: '+50% dodge chance',
        effect: 'dodge',
        value: 50
      },
      {
        name: 'Lethal Poison',
        description: 'Attacks inflict deadly poison',
        effect: 'poison_attacks',
        value: 100
      }
    ],
    requirements: {
      level: 50,
      class: ['Assassin', 'Rogue']
    }
  },

  'Gungnir': {
    name: 'Gungnir',
    type: 'weapon',
    rarity: 'legendary',
    emoji: '🗡️',
    description: 'Odin\'s spear that never misses its target.',
    set: 'Allfather',
    stats: {
      attack: 160,
      defense: 20,
      speed: 40,
      accuracy: 100
    },
    abilities: [
      {
        name: 'Perfect Aim',
        description: 'Attacks never miss',
        effect: 'cannot_miss',
        value: 100
      },
      {
        name: 'Piercing Strike',
        description: 'Ignore 70% of enemy defense',
        effect: 'penetration',
        value: 70
      },
      {
        name: 'Rune Magic',
        description: '+30% magic resistance',
        effect: 'magic_resist',
        value: 30
      }
    ],
    requirements: {
      level: 58,
      class: ['Warrior', 'Paladin', 'DragonKnight']
    }
  },

  'Frostmourne': {
    name: 'Frostmourne',
    type: 'weapon',
    rarity: 'legendary',
    emoji: '⚔️',
    description: 'Cursed runeblade that steals souls.',
    set: 'Lich King',
    stats: {
      attack: 170,
      defense: 30,
      magicPower: 100
    },
    abilities: [
      {
        name: 'Soul Reaper',
        description: 'Killing blows grant permanent +5 attack',
        effect: 'kill_bonus_atk',
        value: 5
      },
      {
        name: 'Frozen Heart',
        description: '50% chance to freeze on hit',
        effect: 'freeze_chance',
        value: 50,
        procChance: 50
      },
      {
        name: 'Unholy Strength',
        description: '+100% damage to living enemies',
        effect: 'damage_vs_living',
        value: 100
      }
    ],
    requirements: {
      level: 62,
      class: ['Warrior', 'Necromancer', 'Berserker']
    }
  },

  'Dragonslayer': {
    name: 'Dragonslayer',
    type: 'weapon',
    rarity: 'legendary',
    emoji: '🗡️',
    description: 'Massive sword designed to slay dragons.',
    set: 'Dragon Hunter',
    stats: {
      attack: 200,
      defense: 40,
      speed: -20,
      critDamage: 50
    },
    abilities: [
      {
        name: 'Dragon Bane',
        description: '+300% damage vs dragons and beasts',
        effect: 'damage_vs_dragons',
        value: 300
      },
      {
        name: 'Heavy Impact',
        description: '40% chance to stun for 1 turn',
        effect: 'stun_chance',
        value: 40,
        procChance: 40
      },
      {
        name: 'Titan\'s Grip',
        description: 'Ignore size penalties',
        effect: 'size_ignore',
        value: 100
      }
    ],
    requirements: {
      level: 55,
      class: ['Warrior', 'Berserker']
    }
  },

  'Moonlight Bow': {
    name: 'Moonlight Bow',
    type: 'weapon',
    rarity: 'legendary',
    emoji: '🏹',
    description: 'Ethereal bow blessed by the moon goddess.',
    set: 'Lunar Grace',
    stats: {
      attack: 130,
      speed: 50,
      critChance: 35,
      dodge: 25
    },
    abilities: [
      {
        name: 'Moonlight Arrow',
        description: 'Arrows pierce through all enemies',
        effect: 'pierce_all',
        value: 100
      },
      {
        name: 'Silent Shot',
        description: 'First attack each battle is guaranteed crit',
        effect: 'first_crit',
        value: 100
      },
      {
        name: 'Lunar Blessing',
        description: 'Restore 5 energy per enemy killed',
        effect: 'kill_energy',
        value: 5
      }
    ],
    requirements: {
      level: 52,
      class: ['Archer']
    }
  },

  'Bloodthirster': {
    name: 'Bloodthirster',
    type: 'weapon',
    rarity: 'legendary',
    emoji: '🔪',
    description: 'Cursed blade that feeds on blood.',
    set: 'Vampire Lord',
    stats: {
      attack: 145,
      speed: 55,
      critChance: 45,
      lifesteal: 25
    },
    abilities: [
      {
        name: 'Vampiric Strike',
        description: 'Heal 40% of damage dealt',
        effect: 'lifesteal',
        value: 40
      },
      {
        name: 'Blood Rage',
        description: '+10% attack for each enemy killed (max 100%)',
        effect: 'rampage',
        value: 10
      },
      {
        name: 'Crimson Edge',
        description: 'All attacks apply bleed',
        effect: 'bleed_attacks',
        value: 100
      }
    ],
    requirements: {
      level: 54,
      class: ['Assassin', 'Berserker', 'Devourer']
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // LEGENDARY ARMOR
  // ═══════════════════════════════════════════════════════════════
  'Dragon Scale Armor': {
    name: 'Dragon Scale Armor',
    type: 'armor',
    rarity: 'legendary',
    emoji: '🛡️',
    description: 'Impenetrable armor made from ancient dragon scales.',
    set: 'Dragon Hunter',
    stats: {
      defense: 200,
      hp: 500,
      fireResist: 80
    },
    abilities: [
      {
        name: 'Dragon Heart',
        description: 'Immune to burn and fire damage',
        effect: 'fire_immunity',
        value: 100
      },
      {
        name: 'Scale Barrier',
        description: 'Reduce all damage by 30%',
        effect: 'damage_reduction',
        value: 30
      },
      {
        name: 'Regeneration',
        description: 'Heal 3% max HP every turn',
        effect: 'regen_hp',
        value: 3
      }
    ],
    requirements: {
      level: 55,
      class: ['Warrior', 'Paladin', 'Berserker']
    }
  },

  'Cloak of Shadows': {
    name: 'Cloak of Shadows',
    type: 'armor',
    rarity: 'legendary',
    emoji: '🧥',
    description: 'Mystical cloak that bends light around the wearer.',
    set: 'Assassin\'s Shadow',
    stats: {
      defense: 80,
      speed: 50,
      dodge: 40
    },
    abilities: [
      {
        name: 'Invisibility',
        description: 'First attack in battle always crits',
        effect: 'guaranteed_first_crit',
        value: 100
      },
      {
        name: 'Phase Shift',
        description: '60% chance to dodge attacks',
        effect: 'dodge',
        value: 60
      },
      {
        name: 'Shadow Step',
        description: '+100% speed in dungeons',
        effect: 'dungeon_speed',
        value: 100
      }
    ],
    requirements: {
      level: 50,
      class: ['Assassin', 'Rogue']
    }
  },

  'Armor of the Immortal': {
    name: 'Armor of the Immortal',
    type: 'armor',
    rarity: 'legendary',
    emoji: '🛡️',
    description: 'Armor that makes its wearer nearly unkillable.',
    set: 'Immortal',
    stats: {
      defense: 180,
      hp: 800,
      regen: 5
    },
    abilities: [
      {
        name: 'Undying',
        description: 'Survive lethal damage once per battle with 1 HP',
        effect: 'survive_lethal',
        value: 1
      },
      {
        name: 'Fortify',
        description: 'Reduce all damage by 25%',
        effect: 'damage_reduction',
        value: 25
      },
      {
        name: 'Titan Blood',
        description: 'Regenerate 4% max HP per turn',
        effect: 'regen_hp',
        value: 4
      }
    ],
    requirements: {
      level: 60,
      class: ['Warrior', 'Paladin', 'Berserker']
    }
  },

  'Robe of the Archmage': {
    name: 'Robe of the Archmage',
    type: 'armor',
    rarity: 'legendary',
    emoji: '👘',
    description: 'Enchanted robes woven with pure magic.',
    set: 'Archmage',
    stats: {
      defense: 100,
      magicPower: 180,
      mana: 250,
      magicResist: 60
    },
    abilities: [
      {
        name: 'Spell Amplification',
        description: '+75% magic damage',
        effect: 'magic_damage',
        value: 75
      },
      {
        name: 'Mana Shield',
        description: 'Convert 50% damage to mana cost instead of HP',
        effect: 'mana_shield',
        value: 50
      },
      {
        name: 'Arcane Flux',
        description: 'Restore 8% max mana per turn',
        effect: 'mana_regen',
        value: 8
      }
    ],
    requirements: {
      level: 56,
      class: ['Mage', 'Necromancer']
    }
  },

  'Plate of the Crusader': {
    name: 'Plate of the Crusader',
    type: 'armor',
    rarity: 'legendary',
    emoji: '🛡️',
    description: 'Holy armor blessed by divine light.',
    set: 'Holy Knight',
    stats: {
      defense: 170,
      hp: 600,
      holyPower: 100
    },
    abilities: [
      {
        name: 'Divine Protection',
        description: 'Immune to curses and dark magic',
        effect: 'curse_immunity',
        value: 100
      },
      {
        name: 'Righteous Fury',
        description: '+150% damage vs undead and demons',
        effect: 'damage_vs_evil',
        value: 150
      },
      {
        name: 'Healing Light',
        description: 'Heal 2% HP when dealing damage',
        effect: 'damage_heal',
        value: 2
      }
    ],
    requirements: {
      level: 58,
      class: ['Paladin']
    }
  },

  'Shadowweave Armor': {
    name: 'Shadowweave Armor',
    type: 'armor',
    rarity: 'legendary',
    emoji: '🥋',
    description: 'Armor made from pure shadows.',
    set: 'Assassin\'s Shadow',
    stats: {
      defense: 90,
      speed: 60,
      dodge: 45,
      critChance: 30
    },
    abilities: [
      {
        name: 'Shadow Form',
        description: '+55% dodge chance',
        effect: 'dodge',
        value: 55
      },
      {
        name: 'Backstab Master',
        description: '+100% crit damage',
        effect: 'crit_damage',
        value: 100
      },
      {
        name: 'Vanish',
        description: 'Avoid one attack per battle automatically',
        effect: 'auto_dodge',
        value: 1
      }
    ],
    requirements: {
      level: 54,
      class: ['Assassin']
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // LEGENDARY ACCESSORIES
  // ═══════════════════════════════════════════════════════════════
  'Ring of Eternal Life': {
    name: 'Ring of Eternal Life',
    type: 'ring',
    rarity: 'legendary',
    emoji: '💍',
    description: 'Ancient ring that grants immortality.',
    set: 'Immortal',
    stats: {
      hp: 1000,
      defense: 50
    },
    abilities: [
      {
        name: 'Resurrection',
        description: 'Auto-revive once per day at 50% HP',
        effect: 'auto_revive',
        value: 50
      },
      {
        name: 'Life Drain',
        description: 'Heal 15% of damage dealt',
        effect: 'lifesteal',
        value: 15
      },
      {
        name: 'Immortal',
        description: 'Cannot die from poison/burn',
        effect: 'dot_immunity',
        value: 100
      }
    ],
    requirements: {
      level: 65
    }
  },

  'Amulet of the Archmage': {
    name: 'Amulet of the Archmage',
    type: 'amulet',
    rarity: 'legendary',
    emoji: '📿',
    description: 'Contains the power of a thousand mages.',
    set: 'Archmage',
    stats: {
      magicPower: 250,
      mana: 200
    },
    abilities: [
      {
        name: 'Spell Mastery',
        description: 'All spells deal +100% damage',
        effect: 'spell_damage',
        value: 100
      },
      {
        name: 'Infinite Mana',
        description: 'Mana regenerates 10% per turn',
        effect: 'mana_regen',
        value: 10
      },
      {
        name: 'Magic Barrier',
        description: 'Block next magical attack (1/battle)',
        effect: 'magic_shield',
        value: 1
      }
    ],
    requirements: {
      level: 60,
      class: ['Mage', 'Necromancer']
    }
  },

  'Crown of the Lich King': {
    name: 'Crown of the Lich King',
    type: 'helmet',
    rarity: 'legendary',
    emoji: '👑',
    description: 'Dark crown that grants control over death.',
    set: 'Lich King',
    stats: {
      hp: 300,
      mana: 300,
      defense: 100
    },
    abilities: [
      {
        name: 'Undead Army',
        description: 'Summon +2 additional undead minions',
        effect: 'summon_bonus',
        value: 2
      },
      {
        name: 'Death\'s Touch',
        description: 'Attacks have 20% chance to instantly kill',
        effect: 'death_touch',
        value: 20,
        procChance: 20
      },
      {
        name: 'Soul Harvest',
        description: 'Restore 50 HP per enemy killed',
        effect: 'kill_heal',
        value: 50
      }
    ],
    requirements: {
      level: 70,
      class: ['Necromancer']
    }
  },

  'Eye of Horus': {
    name: 'Eye of Horus',
    type: 'amulet',
    rarity: 'legendary',
    emoji: '👁️',
    description: 'Ancient Egyptian artifact of protection.',
    set: 'Ancient Egypt',
    stats: {
      defense: 80,
      hp: 400,
      magicResist: 50
    },
    abilities: [
      {
        name: 'Divine Sight',
        description: '+100% accuracy, cannot be blinded',
        effect: 'perfect_sight',
        value: 100
      },
      {
        name: 'Protection',
        description: 'Block 30% of incoming damage',
        effect: 'damage_block',
        value: 30
      },
      {
        name: 'Resurrection',
        description: 'Revive with 30% HP once per day',
        effect: 'auto_revive',
        value: 30
      }
    ],
    requirements: {
      level: 50
    }
  },

  'Heart of the Phoenix': {
    name: 'Heart of the Phoenix',
    type: 'amulet',
    rarity: 'legendary',
    emoji: '🔥',
    description: 'Eternal flame that never dies.',
    set: 'Phoenix',
    stats: {
      hp: 500,
      fireResist: 100,
      regen: 10
    },
    abilities: [
      {
        name: 'Rebirth',
        description: 'Revive with full HP once per week',
        effect: 'phoenix_revive',
        value: 100
      },
      {
        name: 'Eternal Flame',
        description: 'Immune to burn and ice effects',
        effect: 'element_immunity',
        value: 100
      },
      {
        name: 'Rising Ashes',
        description: 'Heal 15% max HP per turn',
        effect: 'regen_hp',
        value: 15
      }
    ],
    requirements: {
      level: 65
    }
  },

  'Boots of Hermes': {
    name: 'Boots of Hermes',
    type: 'boots',
    rarity: 'legendary',
    emoji: '👢',
    description: 'Winged boots that grant incredible speed.',
    set: 'Greek Gods',
    stats: {
      speed: 100,
      dodge: 40
    },
    abilities: [
      {
        name: 'Lightning Speed',
        description: 'Always attack first',
        effect: 'priority',
        value: 100
      },
      {
        name: 'Afterimage',
        description: '+60% dodge chance',
        effect: 'dodge',
        value: 60
      },
      {
        name: 'Double Strike',
        description: '30% chance to attack twice',
        effect: 'double_attack',
        value: 30,
        procChance: 30
      }
    ],
    requirements: {
      level: 52
    }
  },

  'Gauntlets of Might': {
    name: 'Gauntlets of Might',
    type: 'gloves',
    rarity: 'legendary',
    emoji: '🥊',
    description: 'Gauntlets that multiply physical strength.',
    set: 'Titan',
    stats: {
      attack: 120,
      critDamage: 60
    },
    abilities: [
      {
        name: 'Crushing Blow',
        description: '+80% critical damage',
        effect: 'crit_damage',
        value: 80
      },
      {
        name: 'Power Overwhelming',
        description: 'Basic attacks deal +100% damage',
        effect: 'basic_attack_boost',
        value: 100
      },
      {
        name: 'Titan\'s Strength',
        description: 'Ignore enemy armor',
        effect: 'true_damage',
        value: 50
      }
    ],
    requirements: {
      level: 50,
      class: ['Warrior', 'Berserker']
    }
  },

  'Pendant of Wisdom': {
    name: 'Pendant of Wisdom',
    type: 'amulet',
    rarity: 'legendary',
    emoji: '📿',
    description: 'Grants ancient knowledge and power.',
    set: 'Scholar',
    stats: {
      magicPower: 150,
      mana: 200,
      intelligence: 100
    },
    abilities: [
      {
        name: 'Sage Mind',
        description: '+50% experience gain',
        effect: 'exp_boost',
        value: 50
      },
      {
        name: 'Quick Learner',
        description: 'Reduce skill cooldowns by 40%',
        effect: 'cooldown_reduction',
        value: 40
      },
      {
        name: 'Mana Mastery',
        description: 'Skills cost 25% less mana',
        effect: 'mana_cost_reduction',
        value: 25
      }
    ],
    requirements: {
      level: 55,
      class: ['Mage', 'Necromancer']
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // MYTHIC TIER (Ultra Rare)
  // ═══════════════════════════════════════════════════════════════
  'Infinity Gauntlet': {
    name: 'Infinity Gauntlet',
    type: 'gloves',
    rarity: 'mythic',
    emoji: '🧤',
    description: 'Ultimate power. Control reality itself.',
    set: 'Infinity',
    stats: {
      attack: 300,
      defense: 200,
      hp: 1000,
      magicPower: 300
    },
    abilities: [
      {
        name: 'Reality Stone',
        description: '+50% all stats',
        effect: 'all_stats',
        value: 50
      },
      {
        name: 'Time Stone',
        description: 'Act twice per turn',
        effect: 'double_turn',
        value: 100
      },
      {
        name: 'Power Stone',
        description: 'All attacks deal +200% damage',
        effect: 'damage_boost',
        value: 200
      },
      {
        name: 'Space Stone',
        description: 'Teleport - avoid all damage (2/battle)',
        effect: 'dodge_all',
        value: 2
      }
    ],
    requirements: {
      level: 100
    }
  },

  'Book of the Ancients': {
    name: 'Book of the Ancients',
    type: 'tome',
    rarity: 'mythic',
    emoji: '📖',
    description: 'Contains all knowledge and magic ever created.',
    set: 'Ancient',
    stats: {
      magicPower: 500,
      mana: 500,
      intelligence: 200
    },
    abilities: [
      {
        name: 'Omniscience',
        description: 'Learn all skills from all classes',
        effect: 'all_skills',
        value: 100
      },
      {
        name: 'Forbidden Magic',
        description: 'Cast any spell without cost',
        effect: 'free_spells',
        value: 100
      },
      {
        name: 'Rewrite Reality',
        description: 'Change any combat result once per day',
        effect: 'rewrite',
        value: 1
      }
    ],
    requirements: {
      level: 100,
      class: ['Mage', 'Necromancer']
    }
  },

  // EPIC TIER
  'Demon Slayer': {
    name: 'Demon Slayer',
    type: 'weapon',
    rarity: 'epic',
    emoji: '⚔️',
    description: 'Blessed sword effective against dark creatures.',
    set: 'Holy Knight',
    stats: {
      attack: 90,
      holyPower: 60,
      defense: 15
    },
    abilities: [
      {
        name: 'Holy Edge',
        description: '+200% damage vs demons and undead',
        effect: 'damage_vs_demons',
        value: 200
      },
      {
        name: 'Purifying Light',
        description: 'Attacks heal 10% of damage dealt',
        effect: 'lifesteal',
        value: 10
      }
    ],
    requirements: {
      level: 35,
      class: ['Warrior', 'Paladin']
    }
  },

  'Assassin\'s Creed': {
    name: 'Assassin\'s Creed',
    type: 'weapon',
    rarity: 'epic',
    emoji: '🗡️',
    description: 'Hidden blade of legendary assassins.',
    set: 'Assassin\'s Shadow',
    stats: {
      attack: 80,
      speed: 45,
      critChance: 30
    },
    abilities: [
      {
        name: 'Silent Kill',
        description: '+50% damage from stealth',
        effect: 'stealth_damage',
        value: 50
      },
      {
        name: 'Quick Strike',
        description: '+35% critical chance',
        effect: 'crit_chance',
        value: 35
      }
    ],
    requirements: {
      level: 30,
      class: ['Assassin']
    }
  },

  'Storm Caller': {
    name: 'Storm Caller',
    type: 'weapon',
    rarity: 'epic',
    emoji: '🌩️',
    description: 'Staff that commands the storm.',
    set: 'Thunder God',
    stats: {
      attack: 70,
      magicPower: 120,
      speed: 20
    },
    abilities: [
      {
        name: 'Lightning Surge',
        description: '+80% lightning damage',
        effect: 'lightning_damage',
        value: 80
      },
      {
        name: 'Chain Reaction',
        description: '25% chance to hit adjacent enemies',
        effect: 'chain_attack',
        value: 25,
        procChance: 25
      }
    ],
    requirements: {
      level: 38,
      class: ['Mage']
    }
  },

  'Berserker\'s Fury': {
    name: 'Berserker\'s Fury',
    type: 'weapon',
    rarity: 'epic',
    emoji: '🪓',
    description: 'Axe that grows stronger in battle.',
    set: 'Berserker',
    stats: {
      attack: 110,
      critDamage: 40,
      speed: -10
    },
    abilities: [
      {
        name: 'Battle Rage',
        description: '+5% damage per 10% HP lost',
        effect: 'low_hp_damage',
        value: 5
      },
      {
        name: 'Bloodlust',
        description: 'Heal 15% of damage dealt',
        effect: 'lifesteal',
        value: 15
      }
    ],
    requirements: {
      level: 40,
      class: ['Berserker', 'Warrior']
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅ NEW: ARTIFACT SET BONUSES
// ═══════════════════════════════════════════════════════════════
const ARTIFACT_SETS = {
  'Holy Knight': {
    name: 'Holy Knight',
    bonuses: {
      2: { effect: '+20% damage vs undead/demons', stats: { holyPower: 50 } },
      4: { effect: '+30% defense, immune to curses', stats: { defense: 100 } },
      6: { effect: 'Auto-revive once per battle at 50% HP', stats: { hp: 500 } }
    }
  },
  'Assassin\'s Shadow': {
    name: 'Assassin\'s Shadow',
    bonuses: {
      2: { effect: '+25% crit chance', stats: { critChance: 25 } },
      4: { effect: '+50% crit damage', stats: { critDamage: 50 } },
      6: { effect: 'Guaranteed crit on first attack', stats: { speed: 50 } }
    }
  },
  'Archmage': {
    name: 'Archmage',
    bonuses: {
      2: { effect: '+30% magic power', stats: { magicPower: 100 } },
      4: { effect: 'Skills cost 25% less mana', stats: { mana: 200 } },
      6: { effect: 'All spells have 20% chance to cast twice', stats: { magicPower: 200 } }
    }
  },
  'Dragon Hunter': {
    name: 'Dragon Hunter',
    bonuses: {
      2: { effect: '+100% damage vs dragons', stats: { attack: 50 } },
      4: { effect: 'Immune to fire damage', stats: { fireResist: 100 } },
      6: { effect: '+500 HP, +100 defense', stats: { hp: 500, defense: 100 } }
    }
  },
  'Immortal': {
    name: 'Immortal',
    bonuses: {
      2: { effect: 'Regenerate 5% HP per turn', stats: { regen: 5 } },
      4: { effect: 'Reduce all damage by 20%', stats: { hp: 1000 } },
      6: { effect: 'Survive lethal damage once per battle', stats: { defense: 150 } }
    }
  },
  'Thunder God': {
    name: 'Thunder God',
    bonuses: {
      2: { effect: '+50% lightning damage', stats: { attack: 50 } },
      4: { effect: '40% chance to stun on hit', stats: { attack: 100 } },
      6: { effect: 'Lightning attacks hit all enemies', stats: { magicPower: 150 } }
    }
  },
  'Lich King': {
    name: 'Lich King',
    bonuses: {
      2: { effect: '+2 summon limit', stats: { magicPower: 50 } },
      4: { effect: 'Summons deal +100% damage', stats: { attack: 80 } },
      6: { effect: 'Killing blows grant +10 HP permanently', stats: { hp: 300 } }
    }
  },
  'Vampire Lord': {
    name: 'Vampire Lord',
    bonuses: {
      2: { effect: '+20% lifesteal', stats: { lifesteal: 20 } },
      4: { effect: '+10% damage for each kill', stats: { attack: 50 } },
      6: { effect: 'Heal to full HP on kill once per battle', stats: { critChance: 30 } }
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// RARITY TIERS & DROP RATES
// ═══════════════════════════════════════════════════════════════
const RARITY_INFO = {
  common: {
    color: '⚪',
    dropRate: 50,
    name: 'Common',
    statMultiplier: 1.0,
    maxEnhancement: 5
  },
  uncommon: {
    color: '🟢',
    dropRate: 30,
    name: 'Uncommon',
    statMultiplier: 1.3,
    maxEnhancement: 10
  },
  rare: {
    color: '🔵',
    dropRate: 15,
    name: 'Rare',
    statMultiplier: 1.6,
    maxEnhancement: 12
  },
  epic: {
    color: '🟣',
    dropRate: 4,
    name: 'Epic',
    statMultiplier: 2.0,
    maxEnhancement: 15
  },
  legendary: {
    color: '🟠',
    dropRate: 0.9,
    name: 'Legendary',
    statMultiplier: 3.0,
    maxEnhancement: 20
  },
  mythic: {
    color: '🔴',
    dropRate: 0.1,
    name: 'Mythic',
    statMultiplier: 5.0,
    maxEnhancement: 25
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅ NEW: ENHANCEMENT COSTS
// ═══════════════════════════════════════════════════════════════
function getEnhancementCost(currentLevel, rarity) {
  const baseCost = 100;
  const rarityMultiplier = {
    common: 1,
    uncommon: 1.5,
    rare: 2,
    epic: 3,
    legendary: 5,
    mythic: 10
  };
  
  const cost = Math.floor(baseCost * Math.pow(1.5, currentLevel) * rarityMultiplier[rarity]);
  const crystals = Math.floor(cost / 10);
  
  return { gold: cost, crystals };
}

// ═══════════════════════════════════════════════════════════════
// ✅ NEW: ENHANCEMENT SUCCESS RATE
// ═══════════════════════════════════════════════════════════════
function getEnhancementSuccessRate(currentLevel) {
  if (currentLevel < 5) return 100;
  if (currentLevel < 10) return 80;
  if (currentLevel < 15) return 60;
  if (currentLevel < 20) return 40;
  return 20;
}

// ═══════════════════════════════════════════════════════════════
// GET ARTIFACT BY NAME
// ═══════════════════════════════════════════════════════════════
function getArtifact(name) {
  return ARTIFACT_DATABASE[name] || null;
}

// ═══════════════════════════════════════════════════════════════
// CHECK IF PLAYER CAN EQUIP ARTIFACT
// ═══════════════════════════════════════════════════════════════
function canEquipArtifact(player, artifact) {
  const requirements = artifact.requirements || {};
  
  // Check level
  if (requirements.level && player.level < requirements.level) {
    return {
      can: false,
      reason: `Requires level ${requirements.level} (you are level ${player.level})`
    };
  }
  
  // Check class
  if (requirements.class) {
    const playerClass = typeof player.class === 'object' ? player.class.name : player.class;
    if (!requirements.class.includes(playerClass)) {
      return {
        can: false,
        reason: `Only ${requirements.class.join('/')} can equip this`
      };
    }
  }
  
  return { can: true };
}

// ═══════════════════════════════════════════════════════════════
// GET ARTIFACT DISPLAY
// ═══════════════════════════════════════════════════════════════
function getArtifactDisplay(artifact, enhancement = 0, showRequirements = true) {
  const rarity = RARITY_INFO[artifact.rarity] || RARITY_INFO.common;
  const enhancementSuffix = enhancement > 0 ? ` +${enhancement}` : '';
  
  let display = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  display += `${artifact.emoji} ${artifact.name}${enhancementSuffix}\n`;
  display += `${rarity.color} ${rarity.name} ${artifact.type.toUpperCase()}\n`;
  if (artifact.set) display += `🎯 Set: ${artifact.set}\n`;
  display += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  display += `📜 ${artifact.description}\n`;
  display += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  // Stats with enhancement bonus
  display += `📊 STATS:\n`;
  for (const [stat, baseValue] of Object.entries(artifact.stats)) {
    const enhancedValue = Math.floor(baseValue * (1 + (enhancement * 0.1)));
    const sign = enhancedValue >= 0 ? '+' : '';
    display += `   ${sign}${enhancedValue} ${stat.toUpperCase()}`;
    if (enhancement > 0) {
      display += ` (base: ${baseValue})`;
    }
    display += '\n';
  }
  
  // Abilities
  if (artifact.abilities && artifact.abilities.length > 0) {
    display += `\n✨ ABILITIES:\n`;
    artifact.abilities.forEach((ability, i) => {
      display += `   ${i + 1}. ${ability.name}\n`;
      display += `      ${ability.description}\n`;
    });
  }
  
  // Requirements
  if (showRequirements && artifact.requirements) {
    display += `\n⚠️ REQUIREMENTS:\n`;
    if (artifact.requirements.level) {
      display += `   Level ${artifact.requirements.level}+\n`;
    }
    if (artifact.requirements.class) {
      display += `   Class: ${artifact.requirements.class.join('/')}\n`;
    }
  }
  
  // Enhancement info
  if (enhancement > 0) {
    display += `\n⭐ ENHANCEMENT: +${enhancement}\n`;
    display += `   Stat Bonus: +${enhancement * 10}%\n`;
  }
  
  display += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  
  return display;
}

// ═══════════════════════════════════════════════════════════════
// GET ALL ARTIFACTS BY RARITY
// ═══════════════════════════════════════════════════════════════
function getArtifactsByRarity(rarity) {
  return Object.values(ARTIFACT_DATABASE).filter(a => a.rarity === rarity);
}

// ═══════════════════════════════════════════════════════════════
// GET ALL ARTIFACTS BY TYPE
// ═══════════════════════════════════════════════════════════════
function getArtifactsByType(type) {
  return Object.values(ARTIFACT_DATABASE).filter(a => a.type === type);
}

// ═══════════════════════════════════════════════════════════════
// GET RANDOM ARTIFACT DROP (for rewards)
// ═══════════════════════════════════════════════════════════════
function getRandomArtifactDrop(playerLevel) {
  // Higher level = better drop rates
  const luckBonus = Math.floor(playerLevel / 10) * 0.1;
  
  const roll = Math.random() * 100;
  let selectedRarity = 'common';
  
  // Check from highest to lowest rarity
  if (roll < RARITY_INFO.mythic.dropRate * (1 + luckBonus)) {
    selectedRarity = 'mythic';
  } else if (roll < RARITY_INFO.legendary.dropRate * (1 + luckBonus)) {
    selectedRarity = 'legendary';
  } else if (roll < RARITY_INFO.epic.dropRate * (1 + luckBonus)) {
    selectedRarity = 'epic';
  } else if (roll < RARITY_INFO.rare.dropRate * (1 + luckBonus)) {
    selectedRarity = 'rare';
  } else if (roll < RARITY_INFO.uncommon.dropRate) {
    selectedRarity = 'uncommon';
  }
  
  // Get random artifact of selected rarity
  const artifacts = getArtifactsByRarity(selectedRarity);
  if (artifacts.length === 0) return null;
  
  return artifacts[Math.floor(Math.random() * artifacts.length)];
}

// ═══════════════════════════════════════════════════════════════
// ✅ NEW: CALCULATE TOTAL STATS WITH ARTIFACTS EQUIPPED + ENHANCEMENT
// ═══════════════════════════════════════════════════════════════
function calculateStatsWithArtifacts(player) {
  const baseStats = { ...player.stats };
  
  if (!player.artifacts || !player.artifacts.equipped) {
    return baseStats;
  }
  
  const equipped = player.artifacts.equipped;
  const enhancedArtifacts = player.artifacts.enhanced || {};
  
  // Add stats from each equipped artifact
  for (const slot in equipped) {
    const artifactName = equipped[slot];
    if (!artifactName) continue;
    
    const artifact = getArtifact(artifactName);
    if (!artifact) continue;
    
    // Get enhancement level
    const enhancement = enhancedArtifacts[artifactName] || 0;
    
    // Add artifact stats with enhancement bonus
    for (const [stat, baseValue] of Object.entries(artifact.stats)) {
      const enhancedValue = Math.floor(baseValue * (1 + (enhancement * 0.1)));
      
      if (baseStats[stat] !== undefined) {
        baseStats[stat] += enhancedValue;
      } else {
        baseStats[stat] = enhancedValue;
      }
    }
  }
  
  // ✅ ADD SET BONUSES
  const setBonuses = getActiveSetBonuses(player);
  for (const bonus of setBonuses) {
    if (bonus.stats) {
      for (const [stat, value] of Object.entries(bonus.stats)) {
        if (baseStats[stat] !== undefined) {
          baseStats[stat] += value;
        } else {
          baseStats[stat] = value;
        }
      }
    }
  }
  
  return baseStats;
}

// ═══════════════════════════════════════════════════════════════
// ✅ NEW: GET ACTIVE SET BONUSES
// ═══════════════════════════════════════════════════════════════
function getActiveSetBonuses(player) {
  if (!player.artifacts || !player.artifacts.equipped) return [];
  
  const equipped = player.artifacts.equipped;
  const setCounts = {};
  
  // Count equipped items per set
  for (const slot in equipped) {
    const artifactName = equipped[slot];
    if (!artifactName) continue;
    
    const artifact = getArtifact(artifactName);
    if (!artifact || !artifact.set) continue;
    
    setCounts[artifact.set] = (setCounts[artifact.set] || 0) + 1;
  }
  
  // Get active bonuses
  const activeBonuses = [];
  for (const [setName, count] of Object.entries(setCounts)) {
    const setData = ARTIFACT_SETS[setName];
    if (!setData) continue;
    
    // Check which bonuses are active
    for (const [threshold, bonus] of Object.entries(setData.bonuses)) {
      if (count >= parseInt(threshold)) {
        activeBonuses.push({
          set: setName,
          pieces: threshold,
          ...bonus
        });
      }
    }
  }
  
  return activeBonuses;
}

// ═══════════════════════════════════════════════════════════════
// GET ACTIVE ARTIFACT ABILITIES
// ═══════════════════════════════════════════════════════════════
function getActiveArtifactAbilities(player) {
  const abilities = [];
  
  if (!player.artifacts || !player.artifacts.equipped) {
    return abilities;
  }
  
  const equipped = player.artifacts.equipped;
  
  for (const slot in equipped) {
    const artifactName = equipped[slot];
    if (!artifactName) continue;
    
    const artifact = getArtifact(artifactName);
    if (!artifact || !artifact.abilities) continue;
    
    abilities.push(...artifact.abilities);
  }
  
  return abilities;
}

// ═══════════════════════════════════════════════════════════════
// ✅ NEW: ENHANCE ARTIFACT
// ═══════════════════════════════════════════════════════════════
function enhanceArtifact(player, artifactName) {
  const artifact = getArtifact(artifactName);
  if (!artifact) {
    return { success: false, message: '❌ Artifact not found!' };
  }
  
  // Initialize enhanced tracking
  if (!player.artifacts.enhanced) {
    player.artifacts.enhanced = {};
  }
  
  const currentLevel = player.artifacts.enhanced[artifactName] || 0;
  const maxLevel = RARITY_INFO[artifact.rarity].maxEnhancement;
  
  if (currentLevel >= maxLevel) {
    return { 
      success: false, 
      message: `❌ ${artifactName} is already at max enhancement (+${maxLevel})!` 
    };
  }
  
  // Get cost
  const cost = getEnhancementCost(currentLevel, artifact.rarity);
  
  // Check if player has enough resources
  if ((player.gold || 0) < cost.gold) {
    return {
      success: false,
      message: `❌ Not enough Nexus! Need ${cost.gold} 💠 (you have ${player.gold || 0} 💠)`
    };
  }
  
  if ((player.manaCrystals || 0) < cost.crystals) {
    return {
      success: false,
      message: `❌ Not enough mana crystals! Need ${cost.crystals} (you have ${player.manaCrystals || 0})`
    };
  }
  
  // Calculate success rate
  const successRate = getEnhancementSuccessRate(currentLevel);
  const roll = Math.random() * 100;
  
  // Deduct cost
  player.gold -= cost.gold;
  player.manaCrystals -= cost.crystals;
  
  if (roll < successRate) {
    // Success!
    player.artifacts.enhanced[artifactName] = currentLevel + 1;
    
    return {
      success: true,
      enhanced: true,
      message: `✨ Enhancement successful!`,
      newLevel: currentLevel + 1,
      artifact,
      cost
    };
  } else {
    // Failed
    return {
      success: true,
      enhanced: false,
      message: `💔 Enhancement failed!`,
      level: currentLevel,
      artifact,
      cost
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// ✅ NEW: FUSE ARTIFACTS (Combine duplicates)
// ═══════════════════════════════════════════════════════════════
function fuseArtifacts(player, artifact1Name, artifact2Name) {
  // Must be same artifact
  if (artifact1Name !== artifact2Name) {
    return {
      success: false,
      message: '❌ Can only fuse identical artifacts!'
    };
  }
  
  const artifact = getArtifact(artifact1Name);
  if (!artifact) {
    return { success: false, message: '❌ Artifact not found!' };
  }
  
  // Check if player has 2 copies
  const inventory = player.artifacts.inventory;
  const count = inventory.filter(a => a === artifact1Name).length;
  
  if (count < 2) {
    return {
      success: false,
      message: `❌ You need 2 copies of ${artifact1Name} to fuse!`
    };
  }
  
  // Remove both copies
  const index1 = inventory.indexOf(artifact1Name);
  inventory.splice(index1, 1);
  const index2 = inventory.indexOf(artifact1Name);
  inventory.splice(index2, 1);
  
  // Add back one with +1 enhancement
  inventory.push(artifact1Name);
  
  if (!player.artifacts.enhanced) {
    player.artifacts.enhanced = {};
  }
  
  const currentLevel = player.artifacts.enhanced[artifact1Name] || 0;
  player.artifacts.enhanced[artifact1Name] = currentLevel + 1;
  
  return {
    success: true,
    message: `🔥 Fusion successful!`,
    artifact,
    newLevel: currentLevel + 1
  };
}

// ═══════════════════════════════════════════════════════════════
// ✅ COMBAT INTEGRATION FUNCTIONS (for dungeon.js / pvp.js)
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate combat bonuses from equipped artifacts
 * @param {string} playerId - Player's WhatsApp ID
 * @returns {object|null} - Combat bonuses or null
 */
function calculateCombatBonus(playerId) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    // Load player data
    const dbPath = path.join(__dirname, '../data/playerData.json');
    if (!fs.existsSync(dbPath)) return null;
    
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const player = db[playerId];
    
    if (!player || !player.artifacts || !player.artifacts.equipped) {
      return null;
    }
    
    // Calculate total bonuses from equipped artifacts
    let bonuses = {
      atk: 0,
      def: 0,
      hp: 0,
      speed: 0,
      critChance: 0,
      critDamage: 0,
      magicPower: 0,
      lifesteal: 0
    };
    
    const equipped = player.artifacts.equipped;
    const enhanced = player.artifacts.enhanced || {};
    
    // Add stats from each equipped artifact
    for (const slot in equipped) {
      const artifactName = equipped[slot];
      if (!artifactName) continue;
      
      const artifact = getArtifact(artifactName);
      if (!artifact) continue;
      
      // Get enhancement level
      const enhancement = enhanced[artifactName] || 0;
      
      // Calculate enhanced stats
      for (const [stat, baseValue] of Object.entries(artifact.stats)) {
        const enhancedValue = Math.floor(baseValue * (1 + (enhancement * 0.1)));
        
        // Map stat names to combat bonus keys
        if (stat === 'attack') bonuses.atk += enhancedValue;
        else if (stat === 'defense') bonuses.def += enhancedValue;
        else if (stat === 'hp') bonuses.hp += enhancedValue;
        else if (stat === 'speed') bonuses.speed += enhancedValue;
        else if (stat === 'critChance') bonuses.critChance += enhancedValue;
        else if (stat === 'critDamage') bonuses.critDamage += enhancedValue;
        else if (stat === 'magicPower') bonuses.magicPower += enhancedValue;
        else if (stat === 'lifesteal') bonuses.lifesteal += enhancedValue;
      }
    }
    
    // Add set bonuses
    const setBonuses = getActiveSetBonuses(player);
    for (const bonus of setBonuses) {
      if (bonus.stats) {
        for (const [stat, value] of Object.entries(bonus.stats)) {
          if (stat === 'attack') bonuses.atk += value;
          else if (stat === 'defense') bonuses.def += value;
          else if (stat === 'hp') bonuses.hp += value;
          else if (stat === 'speed') bonuses.speed += value;
          else if (stat === 'critChance') bonuses.critChance += value;
          else if (stat === 'critDamage') bonuses.critDamage += value;
          else if (stat === 'magicPower') bonuses.magicPower += value;
          else if (stat === 'lifesteal') bonuses.lifesteal += value;
        }
      }
    }
    
    return {
      bonuses,
      equipped: Object.values(equipped).filter(Boolean),
      setBonuses: setBonuses.map(b => `${b.set} (${b.pieces})`),
      enhancementLevels: enhanced
    };
    
  } catch (error) {
    console.error('Error calculating combat bonus:', error);
    return null;
  }
}

/**
 * Get player's artifact data (for checking abilities/effects)
 * @param {string} playerId - Player's WhatsApp ID
 * @returns {object|null} - Player's artifact data or null
 */
function getPlayerArtifacts(playerId) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    // Load player data
    const dbPath = path.join(__dirname, '../data/playerData.json');
    if (!fs.existsSync(dbPath)) return null;
    
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const player = db[playerId];
    
    if (!player || !player.artifacts) {
      return null;
    }
    
    // Get full artifact details for equipped items
    const equippedDetails = {};
    const equipped = player.artifacts.equipped || {};
    const enhanced = player.artifacts.enhanced || {};
    
    for (const [slot, artifactName] of Object.entries(equipped)) {
      if (!artifactName) continue;
      
      const artifact = getArtifact(artifactName);
      if (!artifact) continue;
      
      equippedDetails[slot] = {
        ...artifact,
        enhancement: enhanced[artifactName] || 0,
        slot
      };
    }
    
    return {
      equipped: equippedDetails,
      inventory: player.artifacts.inventory || [],
      enhanced: enhanced,
      abilities: getActiveArtifactAbilities(player)
    };
    
  } catch (error) {
    console.error('Error getting player artifacts:', error);
    return null;
  }
}
function calculateCombatBonusFromPlayer(player) {
  if (!player || !player.artifacts || !player.artifacts.equipped) return null;

  let bonuses = { atk: 0, def: 0, hp: 0, speed: 0, critChance: 0, critDamage: 0, magicPower: 0, lifesteal: 0 };
  const equipped = player.artifacts.equipped;
  const enhanced = player.artifacts.enhanced || {};

  for (const slot in equipped) {
    const artifactName = equipped[slot];
    if (!artifactName) continue;
    const artifact = getArtifact(artifactName);
    if (!artifact) continue;
    const enhancement = enhanced[artifactName] || 0;
    for (const [stat, baseValue] of Object.entries(artifact.stats)) {
      const val = Math.floor(baseValue * (1 + enhancement * 0.1));
      if (stat === 'attack') bonuses.atk += val;
      else if (stat === 'defense') bonuses.def += val;
      else if (stat === 'hp') bonuses.hp += val;
      else if (stat === 'speed') bonuses.speed += val;
      else if (stat === 'critChance') bonuses.critChance += val;
      else if (stat === 'critDamage') bonuses.critDamage += val;
      else if (stat === 'magicPower') bonuses.magicPower += val;
      else if (stat === 'lifesteal') bonuses.lifesteal += val;
    }
  }

  const setBonuses = getActiveSetBonuses(player);
  for (const bonus of setBonuses) {
    if (bonus.stats) {
      for (const [stat, value] of Object.entries(bonus.stats)) {
        if (stat === 'attack') bonuses.atk += value;
        else if (stat === 'defense') bonuses.def += value;
        else if (stat === 'hp') bonuses.hp += value;
      }
    }
  }

  return { bonuses, equipped: Object.values(equipped).filter(Boolean) };
}
// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// GET TOTAL STAT BONUSES FROM ALL EQUIPPED ARTIFACTS
// ═══════════════════════════════════════════════════════════════
function getEquippedArtifactStats(player) {
  const bonuses = { atk: 0, def: 0, hp: 0, maxHp: 0, speed: 0, critChance: 0, critDamage: 0, energy: 0, maxEnergy: 0 };
  if (!player?.artifacts?.equipped) return bonuses;
  
  // Use ARTIFACT_DATABASE (the correct variable name in this file)
  const ArtifactCatalog = ARTIFACT_DATABASE || {};
  
  for (const [slot, artifactName] of Object.entries(player.artifacts.equipped)) {
    if (!artifactName) continue;
    
    // Find artifact in inventory or catalog
    let artifact = null;
    if (Array.isArray(player.artifacts.inventory)) {
      artifact = player.artifacts.inventory.find(a => (a.name || a) === artifactName);
    }
    // Try ARTIFACT_DATABASE directly (it's a flat key-value object)
    if (!artifact) {
      const found = ArtifactCatalog[artifactName];
      if (found) artifact = found;
    }
    if (!artifact || typeof artifact === 'string') continue;
    
    const enhancement = player.artifacts?.enhanced?.[artifactName] || 0;
    const stats = artifact.stats || artifact.bonus || {};
    
    for (const [stat, val] of Object.entries(stats)) {
      const value = enhancement > 0 ? Math.floor(val * (1 + enhancement * 0.1)) : val;
      const key = stat.toLowerCase();
      if (key === 'atk' || key === 'attack')      bonuses.atk      += value;
      else if (key === 'def' || key === 'defense') bonuses.def      += value;
      else if (key === 'hp' || key === 'maxhp')   { bonuses.hp += value; bonuses.maxHp += value; }
      else if (key === 'spd' || key === 'speed')   bonuses.speed    += value;
      else if (key === 'crit')                      bonuses.critChance += value;
      else if (key === 'critdamage' || key === 'crit_damage') bonuses.critDamage += value;
      else if (key === 'energy' || key === 'maxenergy') { bonuses.energy += value; bonuses.maxEnergy += value; }
    }
  }
  return bonuses;
}


module.exports = {
  getEquippedArtifactStats,
  ARTIFACT_DATABASE,
  ARTIFACT_SETS,
  RARITY_INFO,
  getArtifact,
  canEquipArtifact,
  getArtifactDisplay,
  getArtifactsByRarity,
  getArtifactsByType,
  getRandomArtifactDrop,
  calculateStatsWithArtifacts,
  getActiveArtifactAbilities,
  getActiveSetBonuses,
  enhanceArtifact,
  fuseArtifacts,
  getEnhancementCost,
  getEnhancementSuccessRate,
  // ✅ NEW: Combat integration functions
  calculateCombatBonus,
  calculateCombatBonusFromPlayer,
  getPlayerArtifacts
};