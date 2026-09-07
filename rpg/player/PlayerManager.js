const classDefinitions = {
  // Common Classes (50% total)
  Warrior: {
    rarity: 'common',
    energyType: 'Stamina',
    energyColor: '💪',
    baseStats: {
      hp: 120, maxHp: 120, atk: 15, def: 10,
      energy: 100, maxEnergy: 100, speed: 85,
    },
    weapon: { name: 'Iron Sword', bonus: 5 },
    levelWeapons: [
      { level: 10, name: 'Steel Blade', bonus: 10 },
      { level: 20, name: 'War Axe', bonus: 16 },
      { level: 30, name: 'Titan Sword', bonus: 22 },
      { level: 40, name: 'Warlord Blade', bonus: 28 },
      { level: 50, name: 'Colossus Edge', bonus: 35 },
    ],
    skills: [
      { name: 'Power Strike', damage: 25, energyCost: 10, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'weaken', chance: 0.25, duration: 2 } },
      { name: 'Shield Bash', damage: 20, energyCost: 8, cooldown: 8, level: 1, maxLevel: 5,
        effect: { type: 'stun', chance: 0.3, duration: 1 } }
    ],
    passive: [
      { name: 'Iron Will', effect: '+10% DEF passively applied each fight' }
    ]
  },

  Mage: {
    rarity: 'common',
    energyType: 'Mana',
    energyColor: '💙',
    baseStats: {
      hp: 80, maxHp: 80, atk: 20, def: 5,
      energy: 120, maxEnergy: 120, speed: 75,
    },
    weapon: { name: "Mage's Staff", bonus: 8 },
    levelWeapons: [
      { level: 10, name: 'Enchanted Staff', bonus: 14 },
      { level: 20, name: 'Mana Stone Rod', bonus: 20 },
      { level: 30, name: 'Arcane Scepter', bonus: 27 },
      { level: 40, name: 'Void Staff', bonus: 34 },
      { level: 50, name: 'Omega Catalyst', bonus: 42 },
    ],
    skills: [
      { name: 'Fireball', damage: 30, energyCost: 15, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'burn', chance: 0.35, duration: 3 } },
      { name: 'Ice Shard', damage: 25, energyCost: 12, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'freeze', chance: 0.25, duration: 2 } }
    ],
    passive: [
      { name: 'Arcane Knowledge', effect: '+15% Spell Damage on all skills' }
    ]
  },

  Archer: {
    rarity: 'common',
    energyType: 'Focus',
    energyColor: '🎯',
    baseStats: {
      hp: 100, maxHp: 100, atk: 18, def: 8,
      energy: 110, maxEnergy: 110, speed: 95,
    },
    weapon: { name: "Hunter's Bow", bonus: 7 },
    levelWeapons: [
      { level: 10, name: 'Recurve Bow', bonus: 12 },
      { level: 20, name: 'Elven Bow', bonus: 18 },
      { level: 30, name: 'Shadow Bow', bonus: 24 },
      { level: 40, name: 'Explosive Crossbow', bonus: 30 },
      { level: 50, name: 'Deadeye Longbow', bonus: 38 },
    ],
    skills: [
      { name: 'Arrow Barrage', damage: 28, energyCost: 12, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'bleed', chance: 0.3, duration: 3 } },
      { name: 'Headshot', damage: 35, energyCost: 18, cooldown: 12, level: 1, maxLevel: 5,
        effect: { type: 'blind', chance: 0.4, duration: 2 } }
    ],
    passive: [
      { name: 'Eagle Eye', effect: '+10% Critical Chance on all attacks' }
    ]
  },

  Rogue: {
    rarity: 'common',
    energyType: 'Energy',
    energyColor: '⚡',
    baseStats: {
      hp: 90, maxHp: 90, atk: 22, def: 7,
      energy: 105, maxEnergy: 105, speed: 110,
    },
    weapon: { name: 'Iron Dagger', bonus: 9 },
    levelWeapons: [
      { level: 10, name: 'Serrated Blade', bonus: 14 },
      { level: 20, name: 'Venom Knife', bonus: 20 },
      { level: 30, name: 'Shadow Dagger', bonus: 26 },
      { level: 40, name: 'Void Blade', bonus: 32 },
      { level: 50, name: 'Reaper Dagger', bonus: 40 },
    ],
    skills: [
      { name: 'Shadow Strike', damage: 32, energyCost: 14, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'bleed', chance: 0.35, duration: 3 } },
      { name: 'Poison Dagger', damage: 20, energyCost: 10, cooldown: 8, level: 1, maxLevel: 5,
        effect: { type: 'poison', chance: 0.5, duration: 4 } }
    ],
    passive: [
      { name: 'Stealth Master', effect: '+15% Dodge chance passively' }
    ]
  },

  // Legendary Classes (top tier — Berserker is the 2nd strongest overall)
  Berserker: {
    rarity: 'legendary',
    energyType: 'Rage',
    energyColor: '💢',
    baseStats: {
      hp: 220, maxHp: 220, atk: 60, def: 8,
      energy: 90, maxEnergy: 90, speed: 90,
    },
    weapon: { name: 'Berserker Axe', bonus: 20 },
    levelWeapons: [
      { level: 10, name: 'Rage Cleaver',     bonus: 28 },
      { level: 20, name: 'Blood Axe',        bonus: 38 },
      { level: 30, name: 'Wrath Hammer',     bonus: 48 },
      { level: 40, name: 'Titan Maul',       bonus: 60 },
      { level: 50, name: 'Annihilator',      bonus: 75 },
    ],
    skills: [
      { name: 'Rage Strike',    damage: 50, energyCost: 20, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'weaken', chance: 0.45, duration: 2 } },
      { name: 'Blood Frenzy',   damage: 45, energyCost: 18, cooldown: 9,  level: 1, maxLevel: 5,
        effect: { type: 'bleed',   chance: 0.55, duration: 3 } },
      { name: 'Crimson Cyclone',damage: 60, energyCost: 30, cooldown: 14, level: 1, maxLevel: 5,
        effect: { type: 'bleed',   chance: 0.6,  duration: 2 } }
    ],
    passive: [
      { name: 'Rampage',           effect: '+20% ATK when HP < 50%' },
      { name: 'Pain is Power',     effect: '+10% ATK per 10% HP missing' },
      { name: 'Unbreakable Will',  effect: 'Cannot be killed below 1 HP once per fight' }
    ]
  },

  // Healer class (epic) — pure support, zero damage from skills
  Healer: {
    rarity: 'epic',
    energyType: 'Mana',
    energyColor: '💖',
    baseStats: {
      hp: 110, maxHp: 110, atk: 8, def: 18,
      energy: 130, maxEnergy: 130, speed: 85,
    },
    weapon: { name: 'Healer Staff', bonus: 6 },
    levelWeapons: [
      { level: 10, name: 'Mana Stone Rod',       bonus: 11 },
      { level: 20, name: 'Blessed Wand',     bonus: 17 },
      { level: 30, name: 'Solar Scepter',    bonus: 23 },
      { level: 40, name: 'Divine Reliquary', bonus: 30 },
      { level: 50, name: 'Sanctified Heart', bonus: 38 },
    ],
    skills: [
      // All skills are heal or buff (damage = 0). Custom command: /heal
      { name: 'Healing Light', damage: 0, energyCost: 18, cooldown: 4, level: 1, maxLevel: 5,
        effect: { type: 'heal', healPercent: 0.25, target: 'ally' } },
      { name: 'Purify',        damage: 0, energyCost: 24, cooldown: 6, level: 1, maxLevel: 5,
        effect: { type: 'heal_cleanse', healPercent: 0.20, target: 'ally' } },
      { name: 'Renew',         damage: 0, energyCost: 32, cooldown: 8, level: 1, maxLevel: 5,
        effect: { type: 'heal_energy', healPercent: 0.30, energyPercent: 0.15, target: 'ally' } },
      { name: 'Sanctuary',     damage: 0, energyCost: 40, cooldown: 12, level: 1, maxLevel: 5,
        effect: { type: 'heal_aoe', healPercent: 0.18, target: 'party' } },
      { name: 'Divine Grace',  damage: 0, energyCost: 55, cooldown: 18, level: 1, maxLevel: 5,
        effect: { type: 'heal_cleanse_aoe', healPercent: 0.30, target: 'party' } },
      { name: 'Mass Renewal',  damage: 0, energyCost: 60, cooldown: 20, level: 1, maxLevel: 5,
        effect: { type: 'heal_energy_aoe', healPercent: 0.22, energyPercent: 0.08, target: 'party' } },
      { name: 'Blessed Shield',damage: 0, energyCost: 28, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'buff', buffType: 'shield', shieldPercent: 0.40, duration: 3, target: 'ally' } },
      { name: 'Aura of Light', damage: 0, energyCost: 45, cooldown: 14, level: 1, maxLevel: 5,
        effect: { type: 'buff', buffType: 'aura_heal', healPercent: 0.25, duration: 2, target: 'party' } },
      { name: 'Mana Spring',   damage: 0, energyCost: 22, cooldown: 8, level: 1, maxLevel: 5,
        effect: { type: 'energy_restore', energyPercent: 0.30, target: 'ally' } },
      { name: 'Rebirth',       damage: 0, energyCost: 90, cooldown: 60, level: 1, maxLevel: 3,
        effect: { type: 'resurrect', healPercent: 0.50, target: 'ally' } }
    ],
    passive: [
      { name: 'Blessed Touch',     effect: 'All heals +20% effectiveness' },
      { name: 'Sanctified Soul',   effect: 'Healing received is +15% stronger' }
    ]
  },

  Paladin: {
    rarity: 'rare',
    energyType: 'Faith',
    energyColor: '✨',
    baseStats: {
      hp: 130, maxHp: 130, atk: 17, def: 12,
      energy: 115, maxEnergy: 115, speed: 70,
    },
    weapon: { name: 'Holy Mace', bonus: 10 },
    levelWeapons: [
      { level: 10, name: 'Blessed Hammer', bonus: 16 },
      { level: 20, name: 'Sacred Blade', bonus: 22 },
      { level: 30, name: 'Divine Lance', bonus: 29 },
      { level: 40, name: 'Avenging Sword', bonus: 36 },
      { level: 50, name: 'Judgment Hammer', bonus: 44 },
    ],
    skills: [
      { name: 'Holy Smite', damage: 28, energyCost: 15, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'weaken', chance: 0.35, duration: 2 } },
      { name: 'Divine Shield', damage: 0, energyCost: 20, cooldown: 15, level: 1, maxLevel: 5,
        effect: { type: 'shield', duration: 3, healPercent: 0.15 } }
    ],
    passive: [
      { name: 'Divine Protection', effect: '+15% DEF and 10% heal on skill use' }
    ]
  },

  Necromancer: {
    rarity: 'rare',
    energyType: 'Mana',
    energyColor: '💀',
    baseStats: {
      hp: 85, maxHp: 85, atk: 23, def: 6,
      energy: 130, maxEnergy: 130, speed: 65,
    },
    weapon: { name: "Death's Staff", bonus: 11 },
    levelWeapons: [
      { level: 10, name: 'Bone Wand', bonus: 17 },
      { level: 20, name: 'Soul Scepter', bonus: 23 },
      { level: 30, name: 'Lich Staff', bonus: 30 },
      { level: 40, name: 'Necrotic Rod', bonus: 38 },
      { level: 50, name: 'Reaper Staff', bonus: 47 },
    ],
    skills: [
      { name: 'Death Bolt', damage: 35, energyCost: 18, cooldown: 11, level: 1, maxLevel: 5,
        effect: { type: 'fear', chance: 0.3, duration: 2 } },
      { name: 'Life Drain', damage: 25, energyCost: 15, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'lifesteal', percent: 0.4, poison: { chance: 0.25, duration: 3 } } }
    ],
    passive: [
      { name: 'Dark Arts', effect: '+10% Spell Power, 15% lifesteal on kill' }
    ]
  },

  Assassin: {
    rarity: 'rare',
    energyType: 'Energy',
    energyColor: '🌑',
    baseStats: {
      hp: 95, maxHp: 95, atk: 24, def: 7,
      energy: 110, maxEnergy: 110, speed: 120,
    },
    weapon: { name: 'Shadow Blade', bonus: 11 },
    levelWeapons: [
      { level: 10, name: 'Venom Stiletto', bonus: 17 },
      { level: 20, name: 'Shadow Fang', bonus: 23 },
      { level: 30, name: 'Void Dagger', bonus: 30 },
      { level: 40, name: 'Assassin Blade', bonus: 38 },
      { level: 50, name: 'Death\'s Whisper', bonus: 47 },
    ],
    skills: [
      { name: 'Lethal Strike', damage: 38, energyCost: 16, cooldown: 11, level: 1, maxLevel: 5,
        effect: { type: 'bleed', chance: 0.45, duration: 4 } },
      { name: 'Smoke Bomb', damage: 15, energyCost: 12, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'blind', chance: 0.7, duration: 2 } }
    ],
    passive: [
      { name: 'Critical Mastery', effect: '+25% Critical Damage on all attacks' }
    ]
  },

  // Epic Classes (15% total)
  DragonKnight: {
    rarity: 'epic',
    energyType: 'Dragon Force',
    energyColor: '🐉',
    baseStats: {
      hp: 150, maxHp: 150, atk: 28, def: 14,
      energy: 125, maxEnergy: 125, speed: 90,
    },
    weapon: { name: 'Dragon Blade', bonus: 15 },
    levelWeapons: [
      { level: 10, name: 'Flame Sword', bonus: 22 },
      { level: 20, name: 'Dragon Fang', bonus: 30 },
      { level: 30, name: 'Drake Slayer', bonus: 38 },
      { level: 40, name: 'Elder Dragon Blade', bonus: 47 },
      { level: 50, name: 'Apocalypse Edge', bonus: 58 },
    ],
    skills: [
      { name: 'Dragon Slash', damage: 45, energyCost: 22, cooldown: 13, level: 1, maxLevel: 5,
        effect: { type: 'bleed', chance: 0.35, duration: 3 } },
      { name: 'Dragon Roar', damage: 30, energyCost: 18, cooldown: 11, level: 1, maxLevel: 5,
        effect: { type: 'fear', chance: 0.4, duration: 2 } },
      { name: 'Flame Breath', damage: 40, energyCost: 20, cooldown: 12, level: 1, maxLevel: 5,
        effect: { type: 'burn', chance: 0.6, duration: 3 } }
    ],
    passive: [
      { name: 'Dragon Scales', effect: '+20% DEF, immunity to burn stacks' }
    ]
  },

  // Legendary Classes (5% total)
  Devourer: {
    rarity: 'legendary',
    energyType: 'Blood',
    energyColor: '🩸',
    baseStats: {
      hp: 110, maxHp: 110, atk: 30, def: 10,
      energy: 80, maxEnergy: 80, speed: 120,
    },
    weapon: { name: "Devourer's Scythe", bonus: 15 },
    levelWeapons: [
      { level: 10, name: 'Blood Reaper', bonus: 22 },
      { level: 20, name: 'Soul Harvester', bonus: 30 },
      { level: 30, name: 'Void Scythe', bonus: 40 },
      { level: 40, name: 'Crimson Fang', bonus: 50 },
      { level: 50, name: 'Abyssal Reaper', bonus: 62 },
    ],
    skills: [
      { name: 'Soul Devour', damage: 50, energyCost: 25, cooldown: 12, level: 1, maxLevel: 5,
        effect: { type: 'lifesteal', percent: 0.4, fear: { chance: 0.3, duration: 2 } } },
      { name: 'Dark Pulse', damage: 45, energyCost: 20, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'bleed', chance: 0.4, duration: 3 } },
      { name: 'Blood Feast', damage: 35, energyCost: 15, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'lifesteal', percent: 0.5, poison: { chance: 0.25, duration: 2 } } }
    ],
    passive: [
      { name: 'Life Steal', effect: 'Heal 20% of damage dealt passively' },
      { name: 'Blood Rage', effect: '+30% ATK when HP < 40%' }
    ]
  },

  // ═══════════════════════════════════════════════════════
  // DIVINE CLASS — BOT OWNER EXCLUSIVE (221951679328499)
  // Cannot be rolled, reset to, or held by any other hunter
  // ═══════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════
  // NEW CLASSES — added for variety
  // ═══════════════════════════════════════════════════════════════

  // ── COMMON ──────────────────────────────────────────────────

  // ── COMMON ──────────────────────────────────────────────────
  Knight: {
    rarity: 'common',
    energyType: 'Stamina',
    energyColor: '⚔️',
    baseStats: {
      hp: 130, maxHp: 130, atk: 13, def: 14,
      energy: 100, maxEnergy: 100, speed: 78,
      critChance: 4, critDamage: 1.4
    },
    weapon: { name: 'Knight Sword', bonus: 6 },
    levelWeapons: [
      { level: 10, name: 'Steel Longsword', bonus: 11 },
      { level: 20, name: 'Guardian Blade', bonus: 17 },
      { level: 30, name: 'Holy Sword', bonus: 23 },
      { level: 40, name: 'Champion Sword', bonus: 30 },
      { level: 50, name: 'Excalibur', bonus: 38 },
    ],
    skills: [
      { name: 'Shield Bash', damage: 20, energyCost: 12, cooldown: 3, level: 1, maxLevel: 5,
        effect: { type: 'stun', chance: 0.30, duration: 1 } },
      { name: 'Charge', damage: 25, energyCost: 15, cooldown: 3, level: 1, maxLevel: 5,
        effect: { type: 'stun', chance: 0.20, duration: 1 } },
    ],
    passive: [
      { name: 'Iron Will', effect: '+15% DEF, damage below 20% HP reduced 30%' }
    ]
  },

  // ── RARE ────────────────────────────────────────────────────
  Ranger: {
    rarity: 'rare',
    energyType: 'Focus',
    energyColor: '🎯',
    baseStats: {
      hp: 105, maxHp: 105, atk: 20, def: 8,
      energy: 110, maxEnergy: 110, speed: 105,
      critChance: 12, critDamage: 1.9
    },
    weapon: { name: 'Composite Bow', bonus: 9 },
    levelWeapons: [
      { level: 10, name: 'Hunter Bow', bonus: 14 },
      { level: 20, name: 'Elven Longbow', bonus: 21 },
      { level: 30, name: 'Shadow Bow', bonus: 28 },
      { level: 40, name: 'Storm Bow', bonus: 36 },
      { level: 50, name: 'Godslayer Bow', bonus: 45 },
    ],
    skills: [
      { name: 'Aimed Shot', damage: 35, energyCost: 18, cooldown: 3, level: 1, maxLevel: 5,
        effect: { type: 'bleed', chance: 0.40, duration: 2 } },
      { name: 'Rapid Fire', damage: 18, energyCost: 12, cooldown: 2, level: 1, maxLevel: 5,
        effect: { type: 'slow', chance: 0.30, duration: 2 } },
    ],
    passive: [
      { name: 'Eagle Eye', effect: '+12% crit chance, +25% damage on first strike each battle' }
    ]
  },

  // ── EPIC ────────────────────────────────────────────────────
  Monk: {
    rarity: 'common',
    energyType: 'Chi',
    energyColor: '🌀',
    baseStats: {
      hp: 105, maxHp: 105, atk: 14, def: 8,
      energy: 120, maxEnergy: 120, speed: 110,
      critChance: 8, critDamage: 1.6
    },
    weapon: { name: 'Iron Fists', bonus: 4 },
    levelWeapons: [
      { level: 10, name: 'Steel Knuckles', bonus: 9 },
      { level: 20, name: 'Dragon Gauntlets', bonus: 15 },
      { level: 30, name: 'Thunder Fists', bonus: 21 },
      { level: 40, name: 'Sacred Palm', bonus: 27 },
      { level: 50, name: 'Heavenly Strike', bonus: 34 },
    ],
    skills: [
      { name: 'Rapid Strikes', damage: 18, energyCost: 8, cooldown: 6, level: 1, maxLevel: 5,
        effect: { type: 'bleed', chance: 0.20, duration: 2 } },
      { name: 'Chi Burst', damage: 28, energyCost: 15, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'stun', chance: 0.25, duration: 1 } },
    ],
    passive: [
      { name: 'Fluid Motion', effect: '+12% speed, dodges 8% of all attacks' }
    ]
  },

  Shaman: {
    rarity: 'common',
    energyType: 'Spirit',
    energyColor: '🌿',
    baseStats: {
      hp: 95, maxHp: 95, atk: 13, def: 7,
      energy: 110, maxEnergy: 110, speed: 88,
      critChance: 5, critDamage: 1.5
    },
    weapon: { name: 'Spirit Staff', bonus: 6 },
    levelWeapons: [
      { level: 10, name: 'Tribal Totem', bonus: 11 },
      { level: 20, name: 'Ancestral Rod', bonus: 17 },
      { level: 30, name: 'Voodoo Staff', bonus: 23 },
      { level: 40, name: 'Elder Scepter', bonus: 29 },
      { level: 50, name: 'World Serpent Staff', bonus: 36 },
    ],
    skills: [
      { name: 'Hex Bolt', damage: 22, energyCost: 12, cooldown: 8, level: 1, maxLevel: 5,
        effect: { type: 'weaken', chance: 0.35, duration: 2 } },
      { name: 'Serpent Totem', damage: 15, energyCost: 10, cooldown: 8, level: 1, maxLevel: 5,
        effect: { type: 'poison', chance: 0.50, duration: 3 } },
    ],
    passive: [
      { name: "Nature's Bond", effect: 'Regenerate 3% HP per turn in dungeon' }
    ]
  },

  // ── RARE ────────────────────────────────────────────────────
  BloodKnight: {
    rarity: 'rare',
    energyType: 'Blood',
    energyColor: '🩸',
    baseStats: {
      hp: 135, maxHp: 135, atk: 22, def: 9,
      energy: 90, maxEnergy: 90, speed: 80,
      critChance: 7, critDamage: 1.7,
      lifesteal: 8
    },
    weapon: { name: 'Crimson Blade', bonus: 9 },
    levelWeapons: [
      { level: 10, name: 'Bloodsteel Sword', bonus: 14 },
      { level: 20, name: 'Vampiric Edge', bonus: 20 },
      { level: 30, name: 'Sanguine Cleaver', bonus: 26 },
      { level: 40, name: 'Soul Reaper', bonus: 33 },
      { level: 50, name: 'Eternal Thirst', bonus: 42 },
    ],
    skills: [
      { name: 'Blood Drain', damage: 30, energyCost: 18, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'lifesteal', percent: 0.35 } },
      { name: 'Crimson Strike', damage: 35, energyCost: 20, cooldown: 12, level: 1, maxLevel: 5,
        effect: { type: 'bleed', chance: 0.60, duration: 3 } },
    ],
    passive: [
      { name: 'Vampiric Hunger', effect: '+8% lifesteal on all attacks' }
    ]
  },

  SpellBlade: {
    rarity: 'rare',
    energyType: 'Arcane',
    energyColor: '💜',
    baseStats: {
      hp: 110, maxHp: 110, atk: 20, def: 8,
      energy: 105, maxEnergy: 105, speed: 92,
      critChance: 9, critDamage: 1.75
    },
    weapon: { name: 'Runic Sword', bonus: 8 },
    levelWeapons: [
      { level: 10, name: 'Enchanted Blade', bonus: 13 },
      { level: 20, name: 'Arcane Saber', bonus: 19 },
      { level: 30, name: 'Spellforged Edge', bonus: 25 },
      { level: 40, name: 'Mythril Runeblade', bonus: 32 },
      { level: 50, name: 'Void Sword', bonus: 40 },
    ],
    skills: [
      { name: 'Spellstrike', damage: 32, energyCost: 16, cooldown: 9, level: 1, maxLevel: 5,
        effect: { type: 'weaken', chance: 0.30, duration: 2 } },
      { name: 'Arcane Slash', damage: 28, energyCost: 14, cooldown: 8, level: 1, maxLevel: 5,
        effect: { type: 'burn', chance: 0.40, duration: 2 } },
    ],
    passive: [
      { name: 'Runic Infusion', effect: '+15% skill damage, weapons count as magic' }
    ]
  },

  // ── EPIC ────────────────────────────────────────────────────
  Summoner: {
    rarity: 'epic',
    energyType: 'Essence',
    energyColor: '🔮',
    baseStats: {
      hp: 100, maxHp: 100, atk: 18, def: 8,
      energy: 130, maxEnergy: 130, speed: 86,
      critChance: 6, critDamage: 1.55
    },
    weapon: { name: "Summoner's Tome", bonus: 7 },
    levelWeapons: [
      { level: 10, name: 'Bound Grimoire', bonus: 12 },
      { level: 20, name: 'Spirit Codex', bonus: 18 },
      { level: 30, name: 'Ancient Pact Tome', bonus: 25 },
      { level: 40, name: 'Void Compendium', bonus: 32 },
      { level: 50, name: 'Eldritch Manuscript', bonus: 41 },
    ],
    skills: [
      { name: 'Summon Wraith', damage: 26, energyCost: 20, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'fear', chance: 0.35, duration: 2 } },
      { name: 'Void Pact', damage: 35, energyCost: 25, cooldown: 14, level: 1, maxLevel: 5,
        effect: { type: 'weaken', chance: 0.50, duration: 3 } },
    ],
    passive: [
      { name: 'Eternal Pact', effect: 'Summon deals 15% extra damage; pet abilities trigger 20% more' }
    ]
  },

  // ── LEGENDARY ───────────────────────────────────────────────
  Phantom: {
    rarity: 'legendary',
    energyType: 'Shadow',
    energyColor: '🌑',
    baseStats: {
      hp: 105, maxHp: 105, atk: 32, def: 8,
      energy: 100, maxEnergy: 100, speed: 140,
      critChance: 15, critDamage: 2.2
    },
    weapon: { name: 'Shadow Dagger', bonus: 14 },
    levelWeapons: [
      { level: 10, name: 'Void Blade', bonus: 20 },
      { level: 20, name: 'Nightmare Edge', bonus: 28 },
      { level: 30, name: 'Wraith Fang', bonus: 36 },
      { level: 40, name: 'Soul Cutter', bonus: 44 },
      { level: 50, name: "Oblivion's Touch", bonus: 55 },
    ],
    skills: [
      { name: 'Phase Strike', damage: 40, energyCost: 22, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'blind', chance: 0.55, duration: 2 } },
      { name: 'Shadow Collapse', damage: 48, energyCost: 28, cooldown: 14, level: 1, maxLevel: 5,
        effect: { type: 'fear', chance: 0.45, duration: 2 } },
    ],
    passive: [
      { name: 'Ethereal Form', effect: '+15% crit chance, +25% dodge chance, deals true damage on crits' }
    ]
  },


  // ═══════════════════════════════════════════════════════════════
  // BATCH 2 NEW CLASSES
  // ═══════════════════════════════════════════════════════════════

  // ── COMMON ──────────────────────────────────────────────────
  Warlord: {
    rarity: 'common',
    energyType: 'Command',
    energyColor: '👑',
    baseStats: {
      hp: 125, maxHp: 125, atk: 16, def: 12,
      energy: 90, maxEnergy: 90, speed: 78,
      critChance: 5, critDamage: 1.5
    },
    weapon: { name: 'War Banner', bonus: 6 },
    levelWeapons: [
      { level: 10, name: "General's Blade", bonus: 11 },
      { level: 20, name: 'Conquest Sword', bonus: 17 },
      { level: 30, name: "Warlord's Fang", bonus: 23 },
      { level: 40, name: 'Legendary Reaper', bonus: 30 },
      { level: 50, name: 'Godslayer', bonus: 38 },
    ],
    skills: [
      { name: 'War Cry', damage: 0, energyCost: 10, cooldown: 8, level: 1, maxLevel: 5,
        effect: { type: 'buff', stat: 'atk', percent: 0.30, duration: 3 } },
      { name: 'Cleave', damage: 22, energyCost: 14, cooldown: 8, level: 1, maxLevel: 5,
        effect: { type: 'aoe', splashPercent: 0.50 } },
    ],
    passive: [
      { name: 'Iron Will', effect: '+15 DEF, take 10% reduced damage from all sources' }
    ]
  },

  // ── RARE ────────────────────────────────────────────────────
  Elementalist: {
    rarity: 'rare',
    energyType: 'Elements',
    energyColor: '🌊',
    baseStats: {
      hp: 95, maxHp: 95, atk: 19, def: 7,
      energy: 125, maxEnergy: 125, speed: 90,
      critChance: 10, critDamage: 1.8
    },
    weapon: { name: 'Elemental Orb', bonus: 8 },
    levelWeapons: [
      { level: 10, name: 'Storm Mana Stone', bonus: 13 },
      { level: 20, name: 'Primal Shard', bonus: 19 },
      { level: 30, name: 'World Core', bonus: 26 },
      { level: 40, name: 'Chaos Orb', bonus: 33 },
      { level: 50, name: 'Omega Element', bonus: 43 },
    ],
    skills: [
      { name: 'Tidal Wave', damage: 28, energyCost: 18, cooldown: 9, level: 1, maxLevel: 5,
        effect: { type: 'slow', chance: 0.45, duration: 2 } },
      { name: 'Inferno', damage: 30, energyCost: 20, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'burn', chance: 0.55, duration: 3 } },
    ],
    passive: [
      { name: 'Primal Attunement', effect: '+20% damage for each element type used this battle' }
    ]
  },

  // ── EPIC ────────────────────────────────────────────────────
  ShadowDancer: {
    rarity: 'epic',
    energyType: 'Rhythm',
    energyColor: '💃',
    baseStats: {
      hp: 100, maxHp: 100, atk: 26, def: 7,
      energy: 110, maxEnergy: 110, speed: 130,
      critChance: 14, critDamage: 2.0
    },
    weapon: { name: 'Shadow Fans', bonus: 11 },
    levelWeapons: [
      { level: 10, name: 'Phantom Blades', bonus: 17 },
      { level: 20, name: 'Void Tonfas', bonus: 24 },
      { level: 30, name: 'Twilight Daggers', bonus: 31 },
      { level: 40, name: 'Eclipse Fans', bonus: 39 },
      { level: 50, name: 'Oblivion Claws', bonus: 49 },
    ],
    skills: [
      { name: 'Dance of Death', damage: 35, energyCost: 18, cooldown: 8, level: 1, maxLevel: 5,
        effect: { type: 'bleed', chance: 0.50, duration: 3 } },
      { name: 'Moonwalk', damage: 0, energyCost: 15, cooldown: 8, level: 1, maxLevel: 5,
        effect: { type: 'dodge', percent: 1.0, duration: 1 } },
    ],
    passive: [
      { name: 'Rhythm of Battle', effect: '+10% crit for each consecutive hit. Resets on miss.' }
    ]
  },

  // ── LEGENDARY ───────────────────────────────────────────────
  Chronomancer: {
    rarity: 'legendary',
    energyType: 'Time',
    energyColor: '⏳',
    baseStats: {
      hp: 108, maxHp: 108, atk: 28, def: 9,
      energy: 115, maxEnergy: 115, speed: 115,
      critChance: 12, critDamage: 2.0
    },
    weapon: { name: 'Time Staff', bonus: 13 },
    levelWeapons: [
      { level: 10, name: 'Chrono Wand', bonus: 19 },
      { level: 20, name: 'Temporal Rod', bonus: 27 },
      { level: 30, name: 'Hourglass Scepter', bonus: 35 },
      { level: 40, name: 'Epoch Breaker', bonus: 43 },
      { level: 50, name: 'Infinity Clock', bonus: 54 },
    ],
    skills: [
      { name: 'Time Slow', damage: 30, energyCost: 20, cooldown: 10, level: 1, maxLevel: 5,
        effect: { type: 'slow', chance: 1.0, duration: 2 } },
      { name: 'Rewind', damage: 0, energyCost: 25, cooldown: 12, level: 1, maxLevel: 5,
        effect: { type: 'selfHeal', percent: 0.30 } },
    ],
    passive: [
      { name: 'Time Lord', effect: 'Cooldowns reduced by 1 turn. 10% chance to take no damage.' }
    ]
  },

  Senku: {
    rarity: 'divine',
    energyType: 'Science',
    energyColor: '⚗️',
    baseStats: {
      hp: 143,
      maxHp: 143,
      atk: 39,
      def: 13,
      energy: 104,
      maxEnergy: 104,
  speed: 88,
    },
    weapon: { name: 'Kingdom of Science Staff', bonus: 20 },
    levelWeapons: [
      { level: 10, name: 'Nitro Formula Flask', bonus: 28 },
      { level: 20, name: 'Revive Stone Cannon', bonus: 38 },
      { level: 30, name: 'Science Blaster Mk2', bonus: 48 },
      { level: 40, name: 'Perseus Reactor', bonus: 60 },
      { level: 50, name: '10 Billion% Catalyst', bonus: 75 },
    ],
    skills: [
      { name: 'Nitro Burst',     damage: 65, energyCost: 28, cooldown: 12, level: 1, maxLevel: 5, unlocksAtLevel: 1,  effect: { type: 'burn',      chance: 0.6,  duration: 3 } },
      { name: '10 Billion%',     damage: 80, energyCost: 35, cooldown: 15, level: 1, maxLevel: 5, unlocksAtLevel: 5,  effect: { type: 'stun',      chance: 0.5,  duration: 2 } },
      { name: 'Stone Formula',   damage: 55, energyCost: 22, cooldown: 10, level: 1, maxLevel: 5, unlocksAtLevel: 10, effect: { type: 'freeze',    chance: 0.55, duration: 3 } },
      { name: 'Revival Serum',   damage: 0,  energyCost: 30, cooldown: 18, level: 1, maxLevel: 5, unlocksAtLevel: 20, effect: { type: 'lifesteal', percent: 0.75 } },
      { name: 'Senku Overdrive', damage: 95, energyCost: 45, cooldown: 20, level: 1, maxLevel: 5, unlocksAtLevel: 30, effect: { type: 'bleed',     chance: 0.7,  duration: 4 } }
    ],
    passive: [
      { name: 'Scientific Genius',    effect: '+40% Skill Damage' },
      { name: 'Immortal Formula',     effect: 'Heal 30% of damage dealt' },
      { name: '10 Billion% Resolve',  effect: '+50% ATK when HP < 30%' }
    ]
  }
};

class PlayerManager {
  static classDefinitions = classDefinitions;

  static getClassByRarity(rarity) {
    const classList = Object.keys(classDefinitions).filter(
      key => classDefinitions[key].rarity === rarity
    );
    // Weighted pool — ultra-rare classes get fewer tickets within their tier
    // Legendary (newest first): Berserker=8, Devourer=6, Phantom=4, Chronomancer=4
    // Epic: DragonKnight=6, Summoner=4, ShadowDancer=5
    // Rare: all equal
    // Common: all equal
    const pool = [];
    for (const cls of classList) {
      let tickets = 10;
      if (cls === 'DragonKnight') tickets = 6;   // rarer epic
      if (cls === 'Summoner')     tickets = 4;   // rarest epic
      if (cls === 'ShadowDancer') tickets = 5;   // rarer epic (batch 2)
      if (cls === 'Devourer')     tickets = 6;   // rarer legendary
      if (cls === 'Phantom')      tickets = 4;   // rarest legendary
      if (cls === 'Chronomancer') tickets = 4;   // rarest legendary (batch 2)
      if (cls === 'Berserker')    tickets = 8;   // 2nd-strongest legendary — still rare
      if (cls === 'Senku')        tickets = 0;   // never rolled (owner-only)
      for (let i = 0; i < tickets; i++) pool.push(cls);
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ──────────────────────────────────────────────────────────────────────
  // NOTE: The old `rollRandomClass()` function was removed in the
  // class-system overhaul. Class assignment now happens through
  // `SoloLevelingCore.checkClassAssignment()` + `ClassSystem.applyClassToPlayer()`,
  // which uses the live CLASS_POOL and ASSIGNED_CLASSES map.
  //
  // Special-class JIDs (owner, co-owner, etc.) are now handled in
  // rpg/utils/SoloLevelingCore.js — see ASSIGNED_CLASSES there.
  // ──────────────────────────────────────────────────────────────────────

  static createNewPlayer(userId, userName, className) {
    const classDef = classDefinitions[className];

    if (!classDef) {
      console.error(`❌ Class definition not found: ${className}`);
      return null;
    }

    return {
      userId,
      name: userName || 'Adventurer',
      class: {
        name: className,
        rarity: classDef.rarity
      },
      level: 1,
      xp: 0,
      stats: {
        hp: classDef.baseStats.hp,
        maxHp: classDef.baseStats.maxHp,
        atk: classDef.baseStats.atk,
        def: classDef.baseStats.def,
        energy: classDef.baseStats.energy,
        maxEnergy: classDef.baseStats.maxEnergy,
        speed: classDef.baseStats.speed || 100,
        critChance: classDef.baseStats.critChance || 5,
        critDamage: classDef.baseStats.critDamage || 1.5,
        accuracy: classDef.baseStats.accuracy || 90
      },
      energyType: classDef.energyType,
      energyColor: classDef.energyColor,
      weapon: { ...classDef.weapon },
      skills: {
        active: classDef.skills.filter(s => (s.unlocksAtLevel || 1) <= 1).map(s => ({...s})),
        locked: classDef.skills.filter(s => (s.unlocksAtLevel || 1) > 1).map(s => ({...s})),
        passive: classDef.passive ? classDef.passive.map(p => ({...p})) : [],
        ultimate: null
      },
      inventory: {
        healthPotions: 3,
        manaPotions: 0,
        energyPotions: 2,
        reviveTokens: 1,
        items: []
      },
      equippedGear: {},
      friends: null,
      titles: [],
      gold: 0,
      manaCrystals: 0,
      artifacts: [],
      dungeon: {
        currentBattle: null,
        cooldownUntil: 0,
        gatesCleared: 0
      },
      boss: {
        currentBattle: null,
        cooldownUntil: 0,
        bossesDefeated: 0
      },
      pvp: {
        wins: 0,
        losses: 0,
        rank: 'Unranked'
      },
      pvpElo: 1000,
      pvpWins: 0,
      pvpLosses: 0,
      pvpStreak: 0,
      dailyQuest: {
        lastClaimed: 0,
        streak: 0
      },
      statusEffects: [],
      comboCount: 0,
      lastSkillUse: {},
      skillCooldowns: {},
      registeredAt: Date.now()
    };
  }

  static calculateLevelUpXP(level) {
    return Math.floor(200 * Math.pow(level, 1.8));
  }

  static applyLevelUp(player) {
    player.level++;
    player.stats.maxHp += 10;
    player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + 10);
    player.stats.maxEnergy += 5;
    player.stats.energy = Math.min(player.stats.maxEnergy, player.stats.energy + 5);
    player.stats.atk += 3;
    player.stats.def += 2;

    // Auto-upgrade weapon based on level
    const className = typeof player.class === 'string' ? player.class : player.class?.name;
    const classDef = classDefinitions[className];
    if (classDef?.levelWeapons) {
      const eligible = classDef.levelWeapons.filter(w => w.level <= player.level);
      if (eligible.length > 0) {
        const best = eligible[eligible.length - 1];
        if (!player.weapon || player.weapon.bonus < best.bonus) {
          player.weapon = { name: best.name, bonus: best.bonus };
        }
      }
    }
  }
}

module.exports = PlayerManager;