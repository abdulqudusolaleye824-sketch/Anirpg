// DungeonManager.js — Tower Dungeon System
// 8 Dungeon Types × 20 Floors each
// Boss every 5 floors (Floors 5, 10, 15, 20)

const DUNGEON_TYPES = {
  forest: {
    id: 'forest', name: '🌲 Whispering Forest', shortName: 'Forest', emoji: '🌲',
    minLevel: 1, rank: 'F',
    description: 'Ancient trees hide forgotten dangers. Wolves howl in the dark.',
    atmosphere: ['🌿 Leaves rustle ominously around you...','🦉 An owl watches from above.','🍄 Glowing mushrooms light your path.','🕸️ Massive webs stretch between the trees.','🌫️ A thick mist rolls through the undergrowth.'],
    monsters: [
      { name: 'Slime',        emoji: '🟢', baseHp: 290, baseAtk: 48,  baseDef: 41, abilities: ['Bounce','Acid Spit'] },
      { name: 'Goblin',       emoji: '👺', baseHp: 300, baseAtk: 50,  baseDef: 42, abilities: ['Slash','Quick Strike'] },
      { name: 'Wolf Pup',     emoji: '🐺', baseHp: 305, baseAtk: 54,  baseDef: 42, abilities: ['Pounce','Howl'] },
      { name: 'Giant Spider', emoji: '🕷️', baseHp: 295, baseAtk: 49,  baseDef: 42, abilities: ['Web Shot','Poison Bite'] },
      { name: 'Imp',          emoji: '😈', baseHp: 300, baseAtk: 56,  baseDef: 41, abilities: ['Fire Bolt','Teleport'] },
    ],
    floorBosses: {
      5:  { name: 'Giant Slime King', emoji: '🟢', baseHp: 3200,  baseAtk: 280, baseDef: 160, abilities: ['Acid Nova','Split','Toxic Engulf'],          desc: 'A pulsating mass of toxic ooze that absorbs everything.' },
      10: { name: 'Goblin Warchief',  emoji: '👺', baseHp: 5800,  baseAtk: 380, baseDef: 220, abilities: ['War Cry','Frenzy','Goblin Horde'],           desc: 'Scarred and battle-hardened. His war drum shakes the earth.' },
      15: { name: 'Alpha Wolf',       emoji: '🐺', baseHp: 9200,  baseAtk: 520, baseDef: 300, abilities: ['Pack Howl','Savage Lunge','Blood Frenzy'],   desc: 'Ancient. Massive. This wolf has hunted for a thousand years.' },
      20: { name: 'Forest Ancient',   emoji: '🌳', baseHp: 16000, baseAtk: 800, baseDef: 480, abilities: ["Root Crush","Nature's Wrath","Ancient Bark","Verdant Doom"], desc: 'FINAL BOSS: A sentient forest spirit corrupted by darkness.' }
    }
  },
  cave: {
    id: 'cave', name: '⛰️ Shattered Caverns', shortName: 'Cave', emoji: '⛰️',
    minLevel: 5, rank: 'F',
    description: 'Deep beneath the earth. No light. No mercy.',
    atmosphere: ['💧 Water drips into an unseen abyss.','🦇 Bats scatter at your footsteps.','💎 Gemstones glitter in the dark walls.','🌋 The ground trembles faintly.','🕯️ Something watches from the shadows.'],
    monsters: [
      { name: 'Bat',        emoji: '🦇', baseHp: 285, baseAtk: 51, baseDef: 40, abilities: ['Dive','Screech'] },
      { name: 'Rat',        emoji: '🐀', baseHp: 285, baseAtk: 47, baseDef: 40, abilities: ['Quick Bite','Swarm'] },
      { name: 'Skeleton',   emoji: '💀', baseHp: 310, baseAtk: 52, baseDef: 43, abilities: ['Bone Throw','Rattle'] },
      { name: 'Cave Troll', emoji: '👾', baseHp: 420, baseAtk: 68, baseDef: 58, abilities: ['Club Swing','Regenerate'] },
      { name: 'Rock Golem', emoji: '🪨', baseHp: 450, baseAtk: 62, baseDef: 72, abilities: ['Stone Fist','Rock Armor'] },
    ],
    floorBosses: {
      5:  { name: 'Mana Stone Golem', emoji: '🪨', baseHp: 3600,  baseAtk: 300, baseDef: 200, abilities: ['Stone Fist','Mana Stone Armor','Rockslide'],     desc: 'A living statue of pure crystal. Its body deflects strikes.' },
      10: { name: 'Cave Worm',     emoji: '🐛', baseHp: 6200,  baseAtk: 420, baseDef: 240, abilities: ['Tunnel Strike','Acid Spray','Swallow'],       desc: 'Blind but deadly. Senses vibrations from miles away.' },
      15: { name: 'Stone Dragon',  emoji: '🐉', baseHp: 10000, baseAtk: 580, baseDef: 360, abilities: ['Rock Breath','Tail Slam','Petrify Roar'],     desc: 'Older than the mountain. Each scale harder than steel.' },
      20: { name: 'Earth Titan',   emoji: '⛰️', baseHp: 18000, baseAtk: 860, baseDef: 540, abilities: ['Earthquake','Mountain Crush','Iron Shell','World Shatter'], desc: 'FINAL BOSS: A primordial titan of stone and magma.' }
    }
  },
  ruins: {
    id: 'ruins', name: '🏛️ Cursed Ruins', shortName: 'Ruins', emoji: '🏛️',
    minLevel: 10, rank: 'E',
    description: 'A fallen empire. Its dead refuse to rest.',
    atmosphere: ['🗿 Ancient statues watch with hollow eyes.','📜 Crumbling scrolls litter the floor.','🔮 Magic circles glow with faint power.','💀 The stench of undeath fills the air.','🕯️ Phantom lights flicker in empty halls.'],
    monsters: [
      { name: 'Undead Soldier', emoji: '💀', baseHp: 460, baseAtk: 78,  baseDef: 62, abilities: ['Bone Strike','Undying Rage'] },
      { name: 'Wraith',         emoji: '👤', baseHp: 410, baseAtk: 88,  baseDef: 48, abilities: ['Phase','Soul Drain','Fear'] },
      { name: 'Dark Mage',      emoji: '🧙', baseHp: 430, baseAtk: 98,  baseDef: 55, abilities: ['Shadow Bolt','Curse','Dark Shield'] },
      { name: 'Gargoyle',       emoji: '🗿', baseHp: 450, baseAtk: 83,  baseDef: 65, abilities: ['Stone Skin','Dive Attack','Stone Gaze'] },
      { name: 'Cursed Knight',  emoji: '⚔️', baseHp: 490, baseAtk: 92,  baseDef: 70, abilities: ['Dark Slash','Hell Guard'] },
    ],
    floorBosses: {
      5:  { name: 'Skeleton Knight',  emoji: '💀', baseHp: 5200,  baseAtk: 480,  baseDef: 300, abilities: ['Death Slash','Bone Shield','Undying'],           desc: 'Bound to this hall for eternity. Will not fall.' },
      10: { name: 'Lich Apprentice',  emoji: '🧙', baseHp: 8800,  baseAtk: 640,  baseDef: 360, abilities: ['Death Bolt','Soul Drain','Curse Aura'],          desc: 'A sorcerer who traded his life for immortality.' },
      15: { name: 'Phantom Overlord', emoji: '👻', baseHp: 13500, baseAtk: 820,  baseDef: 440, abilities: ['Spectral Slash','Phase Shift','Haunting Scream'], desc: 'Commander of the dead. His presence saps the will to fight.' },
      20: { name: 'Ruin Colossus',    emoji: '🏛️', baseHp: 22000, baseAtk: 1100, baseDef: 650, abilities: ['Collapse','Ancient Curse','Stone Smash','Ruin Nova'], desc: 'FINAL BOSS: A construct animated by thousands of dead souls.' }
    }
  },
  volcano: {
    id: 'volcano', name: '🌋 Magma Depths', shortName: 'Volcano', emoji: '🌋',
    minLevel: 20, rank: 'D',
    description: 'Rivers of lava. Air that scorches. Only the strongest survive.',
    atmosphere: ['🔥 The heat is almost unbearable.','🌋 Lava bubbles through cracks in the floor.','💨 Toxic fumes drift through tunnels.','🌡️ Your equipment grows dangerously hot.','⚡ Eruptions shake the walls.'],
    monsters: [
      { name: 'Fire Imp',      emoji: '😈', baseHp: 640, baseAtk: 118, baseDef: 72,  abilities: ['Fire Bolt','Hellfire'] },
      { name: 'Lava Golem',    emoji: '🔴', baseHp: 720, baseAtk: 110, baseDef: 105, abilities: ['Molten Fist','Lava Shield'] },
      { name: 'Magma Serpent', emoji: '🐍', baseHp: 660, baseAtk: 125, baseDef: 78,  abilities: ['Flame Bite','Acid Spit'] },
      { name: 'Fire Drake',    emoji: '🐉', baseHp: 700, baseAtk: 130, baseDef: 88,  abilities: ['Flame Breath','Claw Strike'] },
      { name: 'Ash Demon',     emoji: '👿', baseHp: 680, baseAtk: 140, baseDef: 80,  abilities: ['Hellstorm','Dark Slash'] },
    ],
    floorBosses: {
      5:  { name: 'Fire Elemental', emoji: '🔥', baseHp: 8500,  baseAtk: 780,  baseDef: 480,  abilities: ['Inferno','Magma Burst','Flame Shield'],       desc: 'Pure concentrated fire. Its body burns through metal.' },
      10: { name: 'Magma Titan',    emoji: '🌋', baseHp: 14000, baseAtk: 1050, baseDef: 680,  abilities: ['Lava Wave','Volcanic Smash','Molten Armor'],  desc: "Born from an eruption. Carries the mountain's fury." },
      15: { name: 'Inferno Dragon', emoji: '🐲', baseHp: 20000, baseAtk: 1350, baseDef: 820,  abilities: ['Dragon Inferno','Tail Sweep','Melt'],         desc: 'A dragon of living magma. Its roar melts armor.' },
      20: { name: 'Volcano God',    emoji: '☄️', baseHp: 34000, baseAtk: 1900, baseDef: 1100, abilities: ['Eruption','Meteor Rain','Pyroclasm','Absolute Burn'], desc: 'FINAL BOSS: An ancient fire deity. Its awakening could destroy the world.' }
    }
  },
  ocean: {
    id: 'ocean', name: '🌊 Abyssal Depths', shortName: 'Ocean', emoji: '🌊',
    minLevel: 25, rank: 'D',
    description: 'Underwater ruins. Crushing pressure. Ancient predators lurk.',
    atmosphere: ['🌊 The current pushes against you constantly.','🦈 Something large circles in the darkness below.','🐙 Tentacles brush past your feet.','💎 Bioluminescent creatures light the abyss.','🫧 Bubbles rise from something beneath you.'],
    monsters: [
      { name: 'Sea Serpent',    emoji: '🐍', baseHp: 850, baseAtk: 155, baseDef: 100, abilities: ['Coil','Venom Fang'] },
      { name: 'Kraken Spawn',   emoji: '🐙', baseHp: 900, baseAtk: 148, baseDef: 112, abilities: ['Tentacle Grab','Ink Cloud'] },
      { name: 'Shark Warrior',  emoji: '🦈', baseHp: 820, baseAtk: 162, baseDef: 98,  abilities: ['Bite','Death Roll'] },
      { name: 'Deep Specter',   emoji: '👻', baseHp: 780, baseAtk: 170, baseDef: 90,  abilities: ['Soul Drain','Phase'] },
      { name: 'Tide Elemental', emoji: '💧', baseHp: 860, baseAtk: 158, baseDef: 108, abilities: ['Tidal Surge','Water Whip'] },
    ],
    floorBosses: {
      5:  { name: 'Giant Shark',          emoji: '🦈', baseHp: 11000, baseAtk: 1050, baseDef: 600,  abilities: ['Feeding Frenzy','Death Roll','Bleed Out'],          desc: 'Twenty meters of teeth. Smells blood from miles away.' },
      10: { name: 'Kraken Elder',         emoji: '🐙', baseHp: 18000, baseAtk: 1380, baseDef: 800,  abilities: ['Tentacle Slam','Ink Cloud','Crush'],                desc: 'Ancient. Intelligent. Has sunk a hundred ships.' },
      15: { name: 'Sea Dragon',           emoji: '🐉', baseHp: 26000, baseAtk: 1700, baseDef: 980,  abilities: ['Tidal Roar','Depth Charge','Water Coffin'],         desc: 'Apex predator of the deep. Moves like lightning.' },
      20: { name: 'Abyssal Leviathan',    emoji: '🌊', baseHp: 44000, baseAtk: 2400, baseDef: 1400, abilities: ['Abyss Crush','Tsunami Wave','Depth Terror','Ocean Collapse'], desc: 'FINAL BOSS: A god-beast from before recorded history.' }
    }
  },
  demonCastle: {
    id: 'demonCastle', name: "🏰 Demon's Citadel", shortName: 'Demon Castle', emoji: '🏰',
    minLevel: 30, rank: 'C',
    description: 'The stronghold of a demon lord. Pure evil radiates from its walls.',
    atmosphere: ['😈 The air tastes of sulfur and blood.','🔥 Hellfire torches line the black stone halls.','👿 Demonic symbols pulse with dark energy.','💀 The screams of the damned echo endlessly.','🌑 Unnatural darkness swallows your light.'],
    monsters: [
      { name: 'Demon Guard',   emoji: '👿', baseHp: 1100, baseAtk: 210, baseDef: 140, abilities: ['Dark Slash','Hell Guard'] },
      { name: 'Hell Knight',   emoji: '⚔️', baseHp: 1200, baseAtk: 225, baseDef: 165, abilities: ['Infernal Strike','Hell Armor'] },
      { name: 'Shadow Fiend',  emoji: '🌑', baseHp: 1050, baseAtk: 240, baseDef: 130, abilities: ['Shadow Claw','Void Step'] },
      { name: 'Soul Reaper',   emoji: '☠️', baseHp: 1080, baseAtk: 255, baseDef: 138, abilities: ['Soul Rend','Death Mark'] },
      { name: 'Blood Cultist', emoji: '🩸', baseHp: 1020, baseAtk: 265, baseDef: 128, abilities: ['Blood Ritual','Dark Pact'] },
    ],
    floorBosses: {
      5:  { name: 'Corrupted Golem',     emoji: '🗿', baseHp: 18000, baseAtk: 1600, baseDef: 1000, abilities: ['Chaos Smash','Dark Pulse','Iron Fortress'],          desc: 'A golem twisted beyond recognition by demonic energy.' },
      10: { name: 'Vampire Lord',        emoji: '🧛', baseHp: 28000, baseAtk: 2100, baseDef: 1300, abilities: ['Blood Drain','Bat Swarm','Crimson Shroud'],          desc: 'Ancient nobility of the damned. Centuries of hatred.' },
      15: { name: 'Archdemon',           emoji: '😈', baseHp: 40000, baseAtk: 2800, baseDef: 1700, abilities: ['Hellstorm','Dark Dominion','Soul Devour'],           desc: 'One of the seven great demons. Its presence crushes the will.' },
      20: { name: 'Demon Lord Zarith',   emoji: '👹', baseHp: 65000, baseAtk: 3800, baseDef: 2300, abilities: ['Oblivion Blast','Throne of Chaos','Dark Singularity','Demon Apotheosis'], desc: "FINAL BOSS: The citadel's ruler. Ten thousand years of conquest." }
    }
  },
  crystalMines: {
    id: 'crystalMines', name: '💎 Mana Stone Mines', shortName: 'Mana Stone Mines', emoji: '💎',
    minLevel: 35, rank: 'C',
    description: 'Enchanted minerals mutated everything inside. Beautiful. Deadly.',
    atmosphere: ['💎 Mana Stone formations sing with a faint hum.','🌈 Prismatic light refracts in all directions.','⚡ Static electricity crackles through the air.','🔮 Your magic feels unstable here.','✨ Mana crystals pulse with dangerous energy.'],
    monsters: [
      { name: 'Mana Stone Wasp',  emoji: '🐝', baseHp: 1300, baseAtk: 290, baseDef: 185, abilities: ['Mana Stone Sting','Shard Burst'] },
      { name: 'Gem Golem',     emoji: '💎', baseHp: 1500, baseAtk: 275, baseDef: 220, abilities: ['Mana Stone Fist','Gem Armor'] },
      { name: 'Prism Drake',   emoji: '🐲', baseHp: 1400, baseAtk: 310, baseDef: 200, abilities: ['Prism Breath','Claw Strike'] },
      { name: 'Mana Specter',  emoji: '🔮', baseHp: 1280, baseAtk: 325, baseDef: 175, abilities: ['Mana Drain','Arcane Bolt'] },
      { name: 'Mana Stone Titan', emoji: '🗿', baseHp: 1600, baseAtk: 300, baseDef: 240, abilities: ['Shatter Slam','Diamond Shield'] },
    ],
    floorBosses: {
      5:  { name: 'Gem Colossus',     emoji: '💎', baseHp: 25000, baseAtk: 2200, baseDef: 1400, abilities: ['Mana Stone Shatter','Prism Blast','Diamond Skin'],          desc: 'A golem of pure gemstone. Each strike sends shards flying.' },
      10: { name: 'Mana Dragon',      emoji: '🐉', baseHp: 38000, baseAtk: 2900, baseDef: 1800, abilities: ['Arcane Breath','Mana Drain','Mana Stone Storm'],            desc: 'A dragon that feeds on magic. Spellcasters beware.' },
      15: { name: 'Mana Stone Queen',    emoji: '👑', baseHp: 55000, baseAtk: 3600, baseDef: 2200, abilities: ['Prismatic Nova','Mana Stone Prison','Resonance Blast'],     desc: 'The sentient core of the mines. A hundred layered crystals.' },
      20: { name: 'Absolute Mana Stone', emoji: '✨', baseHp: 88000, baseAtk: 4800, baseDef: 3000, abilities: ['Perfect Refraction','Crystallize','Harmonic Explosion','Total Resonance'], desc: 'FINAL BOSS: A being of pure crystallized mana.' }
    }
  },
  shadowRealm: {
    id: 'shadowRealm', name: '🌑 Shadow Realm', shortName: 'Shadow Realm', emoji: '🌑',
    minLevel: 45, rank: 'B',
    description: 'A dimension of pure shadow. Reality bends. Sanity crumbles.',
    atmosphere: ['🌑 There is no light here. Only shadow.','👁️ Dozens of eyes open in the darkness.','🌀 The void whispers your name over and over.','💀 The concept of death feels different here.','🕳️ Parts of the floor simply do not exist.'],
    monsters: [
      { name: 'Shadow Clone',    emoji: '👤', baseHp: 1800, baseAtk: 420, baseDef: 260, abilities: ['Shadow Strike','Clone'] },
      { name: 'Void Wraith',     emoji: '🌌', baseHp: 1750, baseAtk: 445, baseDef: 245, abilities: ['Void Touch','Phaserift'] },
      { name: 'Dark Phantom',    emoji: '👻', baseHp: 1900, baseAtk: 410, baseDef: 280, abilities: ['Phantom Claw','Scream'] },
      { name: 'Shadow Titan',    emoji: '🌑', baseHp: 2100, baseAtk: 400, baseDef: 320, abilities: ['Shadow Crush','Dark Barrier'] },
      { name: 'Nightmare Beast', emoji: '😱', baseHp: 1950, baseAtk: 460, baseDef: 270, abilities: ['Fear','Nightmare Bite'] },
    ],
    floorBosses: {
      5:  { name: 'Shadow Incarnate', emoji: '🌑', baseHp: 38000,  baseAtk: 3400, baseDef: 2100, abilities: ['Void Strike','Shadow Copy','Darkness Surge'],          desc: 'A being that IS shadow. You cannot touch what you cannot see.' },
      10: { name: 'Phantom King',     emoji: '👑', baseHp: 58000,  baseAtk: 4400, baseDef: 2800, abilities: ['Royal Phantasm','Spectral Army','Deaths Embrace'],     desc: 'King of this void dimension. Has conquered a thousand realms.' },
      15: { name: 'Void Leviathan',   emoji: '🌀', baseHp: 82000,  baseAtk: 5600, baseDef: 3500, abilities: ['Void Tear','Reality Erase','Cosmic Hunger'],           desc: 'A creature that devours dimensions. This realm is its stomach.' },
      20: { name: 'The Darkness',     emoji: '🕳️', baseHp: 130000, baseAtk: 7500, baseDef: 4800, abilities: ['Absolute Void','Existence Denial','Shadow Apocalypse','End of Light'], desc: 'FINAL BOSS: The primordial Darkness before creation. Theoretically undefeatable.' }
    }
  }
};

function _getRankByFloor(floor) {
  if (floor <= 5)  return 'F';
  if (floor <= 10) return 'E';
  if (floor <= 15) return 'D';
  return 'C';
}

function scaleMonsterForFloor(baseMonster, playerLevel, floor) {
  // Gentler scaling — monsters should be beatable at the required level
  const floorMult  = 1 + (floor - 1) * 0.10;  // was 0.18
  const levelMult  = 1 + (playerLevel - 1) * 0.03;  // was 0.05
  const combined   = floorMult * levelMult;
  return {
    name: baseMonster.name,
    emoji: baseMonster.emoji,
    level: playerLevel + Math.floor(floor * 0.5),
    rank: _getRankByFloor(floor),
    abilities: [...(baseMonster.abilities || ['Strike'])],
    isElite: false,
    isBoss: false,
    stats: {
      hp:    Math.floor(baseMonster.baseHp  * combined * 0.5),  // 50% of original
      maxHp: Math.floor(baseMonster.baseHp  * combined * 0.5),
      atk:   Math.floor(baseMonster.baseAtk * combined * 0.5),
      def:   Math.floor(baseMonster.baseDef * combined * 0.5),
      speed: 80 + floor * 2
    },
    statusEffects: []
  };
}

function scaleBossForFloor(bossDef, playerLevel, floor) {
  const levelMult  = 1 + (playerLevel - 1) * 0.03;  // was 0.04
  const isFinal    = floor === 20;
  const finalMult  = isFinal ? 1.8 : 1;  // was 2.5
  const hp  = Math.floor(bossDef.baseHp  * levelMult * finalMult * 0.45);  // 45% of original
  const atk = Math.floor(bossDef.baseAtk * levelMult * finalMult * 0.45);
  const def = Math.floor(bossDef.baseDef * levelMult * finalMult * 0.45);
  return {
    name: bossDef.name,
    emoji: bossDef.emoji,
    desc: bossDef.desc,
    level: playerLevel + floor,
    rank: _getRankByFloor(floor),
    isBoss: true,
    isFinalBoss: isFinal,
    isElite: false,
    abilities: [...bossDef.abilities],
    stats: { hp, maxHp: hp, atk, def, speed: 100 + floor },
    statusEffects: []
  };
}

function calculateFloorRewards(floor, playerLevel, isBoss) {
  const base = {
    xp:       Math.floor((600 + floor * 320) * (1 + playerLevel * 0.08)),
    gold:     Math.floor((2000 + floor * 900) * (1 + playerLevel * 0.05)),
    crystals: Math.floor((15  + floor * 6)   * (1 + playerLevel * 0.02)),
  };
  if (isBoss) {
    base.xp       = Math.floor(base.xp * 8);
    base.gold     = Math.floor(base.gold * 6);
    base.crystals = Math.floor(base.crystals * 5);
    base.upgradePoints = floor === 20 ? 15 : floor === 15 ? 10 : floor === 10 ? 6 : 4;
  }
  return base;
}

const BOSS_LOOT = {
  5:  [{ name: 'Health Potion', type: 'Potion', rarity: 'common' }, { name: 'Energy Potion', type: 'Potion', rarity: 'common' }],
  10: [{ name: 'Revive Token', type: 'Consumable', rarity: 'uncommon' }, { name: 'Luck Potion', type: 'Consumable', rarity: 'uncommon', isLuckPotion: true }],
  15: [{ name: 'Rare Gem', type: 'QuestItem', rarity: 'rare' }, { name: 'Ancient Mana Stone', type: 'QuestItem', rarity: 'rare', isQuestItem: true }],
  20: [{ name: 'Legendary Fragment', type: 'QuestItem', rarity: 'legendary', isQuestItem: true }, { name: 'Revive Token', type: 'Consumable', rarity: 'uncommon' }]
};

class DungeonManager {
  static getAvailableTypes(playerLevel) {
    return Object.values(DUNGEON_TYPES).filter(d => d.minLevel <= playerLevel);
  }
  static getDungeonType(id) { return DUNGEON_TYPES[id] || null; }
  static getAllTypes() { return Object.values(DUNGEON_TYPES); }
  static isBossFloor(floor) { return floor % 5 === 0; }

  static getFloorMonster(dungeonTypeId, floor, playerLevel) {
    const dtype = DUNGEON_TYPES[dungeonTypeId];
    if (!dtype) return null;
    const pool = dtype.monsters;
    const idx  = Math.min(Math.floor((floor - 1) / 4), pool.length - 1);
    const vari = floor % pool.length;
    return scaleMonsterForFloor(pool[(idx + vari) % pool.length], playerLevel, floor);
  }

  static getFloorBoss(dungeonTypeId, floor, playerLevel) {
    const dtype = DUNGEON_TYPES[dungeonTypeId];
    if (!dtype) return null;
    const bossDef = dtype.floorBosses[floor];
    if (!bossDef) return null;
    return scaleBossForFloor(bossDef, playerLevel, floor);
  }

  static getFloorRewards(floor, playerLevel, isBoss) {
    return calculateFloorRewards(floor, playerLevel, isBoss);
  }

  static getBossLoot(floor) {
    return BOSS_LOOT[floor] ? [...BOSS_LOOT[floor]] : [];
  }

  static formatDungeonList(types) {
    return types.map((d, i) =>
      `${i+1}. ${d.emoji} *${d.name}*\n   📊 Req. Lv${d.minLevel}+ | Rank ${d.rank}\n   💭 ${d.description}\n   🏆 20 Floors | Bosses at F5, F10, F15, F20`
    ).join('\n\n');
  }

  // ── Legacy compat ────────────────────────────────────────────
  static getAvailableDungeons(playerLevel) {
    return this.getAvailableTypes(playerLevel).map(d => ({
      name: d.name, description: d.description, rank: d.rank,
      minLevel: d.minLevel, maxLevel: d.minLevel + 30,
      monsters: d.monsters.map(m => m.name), _dungeonTypeId: d.id
    }));
  }

  static generateDungeon(template, playerLevel) {
    const typeId = template._dungeonTypeId || 'forest';
    const firstMonster = this.getFloorMonster(typeId, 1, playerLevel);
    return {
      name: template.name, rank: template.rank,
      typeId, currentFloor: 1, maxFloors: 20,
      monstersDefeated: 0, totalMonsters: 1,
      turn: 1, startTime: Date.now(), floorsCleared: [],
      currentMonster: firstMonster, monsters: []
    };
  }

  static calculateMonsterRewards(monster, playerLevel) {
    const rankMults = { 'F':1, 'E':1.5, 'D':2, 'C':3, 'B':4 };
    const mult = rankMults[monster.rank] || 1;
    const lvlB = 1 + (playerLevel * 0.03);
    const eliB = monster.isElite ? 3 : 1;
    const bosB = monster.isBoss ? 5 : 1;
    // XP no longer in reward object — awarded silently via SilentXP
    return {
      crystals: Math.floor(14   * mult * lvlB * 1.17 * eliB * bosB),
      gold:     Math.floor(2900 * mult * lvlB * 3.03 * eliB * bosB)
    };
  }

  static generateDungeonLoot(dungeon, playerLevel) {
    try {
      const GearSystem = require('../utils/GearSystem');
      const rank = dungeon.rank || 'F';
      const roll = Math.random();
      const loot = [];
      if (roll < 0.4) {
        const gear = GearSystem.generateGear(rank, 'uncommon', 1);
        if (gear) { gear.from = dungeon.name; loot.push(gear); }
      } else if (roll < 0.7) {
        loot.push({ name: 'Health Potion', type: 'Potion', rarity: 'common' });
        if (Math.random() < 0.5) loot.push({ name: 'Energy Potion', type: 'Potion', rarity: 'common' });
      } else {
        loot.push({ name: 'Iron Ore', type: 'QuestItem', rarity: 'common', isQuestItem: true });
      }
      return loot;
    } catch(e) { return []; }
  }
}

module.exports = DungeonManager;
module.exports.DUNGEON_TYPES = DUNGEON_TYPES;