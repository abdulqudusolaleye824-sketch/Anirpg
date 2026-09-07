// ═══════════════════════════════════════════════════════════════
// DUNGEON TOWER MANAGER
// Each dungeon type has 10 floors.
// Floors 1-4: regular monsters
// Floor 5: SUB-BOSS (medium boss)
// Floors 6-9: stronger monsters
// Floor 10: FLOOR BOSS (full boss fight)
// After each floor the party chooses: Advance or Leave
// ═══════════════════════════════════════════════════════════════

// ── DUNGEON TYPES ─────────────────────────────────────────────
// Each type has themed monsters per floor tier, a sub-boss, a final boss,
// an atmosphere description, and special passive effects.

const DUNGEON_TYPES = {
  // ── TIER 1: Levels 1–10 ──────────────────────────────────────
  goblin_forest: {
    id: 'goblin_forest',
    name: '🌲 Goblin Forest',
    rankRequired: 'F',
    minLevel: 1, maxLevel: 10,
    description: 'A rotting forest overrun by goblins and their feral pets.',
    atmosphere: [
      '🌲 The trees groan as you push deeper into goblin territory.',
      '🍄 Crude traps line the path. Watch your step.',
      '🔥 Goblin campfires glow in the distance.',
      '🌿 The underbrush rustles. Something is watching.',
    ],
    // monsters[tier] — tier 0 = floors 1-4, tier 1 = floors 6-9
    monsters: {
      tier0: ['Slime', 'Goblin', 'Rat', 'Wolf Pup'],
      tier1: ['Goblin', 'Wolf Pup', 'Imp', 'Spider'],
    },
    subBoss: {
      name: 'Goblin Champion',     emoji: '⚔️', rank: 'F',
      hpMult: 3.5, atkMult: 2.0, defMult: 1.8,
      abilities: ['Slash', 'War Cry', 'Charge'],
      dialogue: ['You go no further, human!', 'ME SMASH YOU GOOD!', 'CHAMPION WILL NOT FALL!'],
    },
    finalBoss: {
      name: 'Goblin Warchief',     emoji: '👺', rank: 'E',
      hpMult: 6.0, atkMult: 3.0, defMult: 2.5,
      abilities: ['War Howl', 'Blade Storm', 'Berserk Charge', 'Goblin Horde'],
      dialogue: ['THE FOREST IS MINE!', 'YOUR BONES WILL DECORATE MY THRONE!', 'UNLEASH THE HORDE!'],
    },
    passiveEffect: null,
    rewards: { xpMult: 1.0, goldMult: 1.0, crystalMult: 1.0 },
  },

  spider_den: {
    id: 'spider_den',
    name: '🕸️ Spider Den',
    rankRequired: 'F',
    minLevel: 2, maxLevel: 10,
    description: 'A cave system choked with webs. Poison is everywhere.',
    atmosphere: [
      '🕸️ Thick webs stretch wall to wall. You cut through carefully.',
      '🕷️ Egg sacs line the ceiling. Thousands of eyes watch you.',
      '💀 Cocooned remains hang from the rafters.',
      '🌑 The air is thick with venom mist.',
    ],
    monsters: {
      tier0: ['Spider', 'Bat', 'Slime', 'Rat'],
      tier1: ['Giant Spider', 'Bat', 'Spider', 'Imp'],
    },
    subBoss: {
      name: 'Broodmother Scout',   emoji: '🕷️', rank: 'F',
      hpMult: 3.5, atkMult: 2.0, defMult: 1.6,
      abilities: ['Venom Spray', 'Web Trap', 'Quick Bite'],
      dialogue: ['You disturb the nest!', '*scuttles menacingly*', 'The eggs... PROTECT THE EGGS!'],
    },
    finalBoss: {
      name: 'Giant Spider Queen',  emoji: '🕷️', rank: 'E',
      hpMult: 6.0, atkMult: 3.2, defMult: 2.2,
      abilities: ['Venom Nova', 'Web Cocoon', 'Brood Swarm', 'Paralysis Bite'],
      dialogue: ['ALL WHO ENTER THE DEN ARE PREY!', 'FEEL MY VENOM FILL YOUR VEINS!', '*lets out a deafening screech*'],
    },
    passiveEffect: { type: 'poison_floor', desc: '☠️ Poison mist deals 2% max HP each turn if unresisted.' },
    rewards: { xpMult: 1.05, goldMult: 1.0, crystalMult: 1.1 },
  },

  graveyard_crypts: {
    id: 'graveyard_crypts',
    name: '💀 Graveyard Crypts',
    rankRequired: 'F',
    minLevel: 3, maxLevel: 10,
    description: 'Ancient crypts beneath a forgotten graveyard. The dead don\'t rest here.',
    atmosphere: [
      '💀 Bones crunch underfoot. The dead are everywhere.',
      '👻 Ghostly whispers echo through the stone corridors.',
      '🕯️ Ancient candles flicker with blue flame — lit by unseen hands.',
      '⚰️ A coffin shifts. Then goes still. You keep moving.',
    ],
    monsters: {
      tier0: ['Skeleton', 'Zombie', 'Bat', 'Rat'],
      tier1: ['Skeleton', 'Ghoul', 'Zombie', 'Wraith'],
    },
    subBoss: {
      name: 'Crypt Keeper',        emoji: '⚰️', rank: 'F',
      hpMult: 3.5, atkMult: 1.9, defMult: 2.0,
      abilities: ['Rattle', 'Bone Throw', 'Raise Dead'],
      dialogue: ['The crypt is sacred. LEAVE!', 'I will add your bones to my collection...', 'REST WITH US... FOREVER!'],
    },
    finalBoss: {
      name: 'Skeleton Knight',     emoji: '💀', rank: 'E',
      hpMult: 6.5, atkMult: 3.0, defMult: 3.0,
      abilities: ['Death Slash', 'Bone Shield', 'Soul Rend', 'Undying Will'],
      dialogue: ['THE KNIGHT ETERNAL AWAKENS!', 'DEATH IS MY GIFT TO YOU!', '*eyes glow with purple fire*'],
    },
    passiveEffect: { type: 'undead_resilience', desc: '🦴 Undead enemies have 15% chance to ignore killing blows.' },
    rewards: { xpMult: 1.1, goldMult: 1.05, crystalMult: 1.05 },
  },

  // ── TIER 2: Levels 11–20 ─────────────────────────────────────
  demon_cavern: {
    id: 'demon_cavern',
    name: '🔥 Demon Cavern',
    rankRequired: 'D',
    minLevel: 11, maxLevel: 20,
    description: 'A hellish cavern flooded with demonic energy. Heat warps reality.',
    atmosphere: [
      '🔥 Lava rivers light the cavern in hellish red.',
      '💀 Demonic runes pulse on every surface.',
      '😈 Laughter echoes from deeper chambers. Not human laughter.',
      '⚡ The air itself burns. Every breath is agony.',
    ],
    monsters: {
      tier0: ['Lesser Demon', 'Wyvern', 'Dark Mage', 'Ogre'],
      tier1: ['Wyvern', 'Dark Mage', 'Banshee', 'Cerberus'],
    },
    subBoss: {
      name: 'Demon Sentinel',      emoji: '😈', rank: 'D',
      hpMult: 3.5, atkMult: 2.2, defMult: 1.8,
      abilities: ['Hellfire', 'Dark Chains', 'Demon Rush'],
      dialogue: ['YOU TRESPASS IN HELL!', 'BURN IN THE MASTER\'S NAME!', 'None pass the sentinel!'],
    },
    finalBoss: {
      name: 'Demon Overlord',      emoji: '👿', rank: 'C',
      hpMult: 7.0, atkMult: 3.5, defMult: 2.8,
      abilities: ['Inferno Nova', 'Soul Shatter', 'Demon Form', 'Hellgate'],
      dialogue: ['I HAVE WAITED EONS FOR THIS!', 'YOUR SOUL WILL FUEL MY ASCENSION!', '*the cavern shakes as he rises*'],
    },
    passiveEffect: { type: 'fire_floor', desc: '🔥 Standing on lava tiles deals 3% HP per turn. Guard reduces this.' },
    rewards: { xpMult: 1.3, goldMult: 1.2, crystalMult: 1.2 },
  },

  cursed_castle: {
    id: 'cursed_castle',
    name: '🏰 Cursed Castle',
    rankRequired: 'D',
    minLevel: 12, maxLevel: 20,
    description: 'A noble castle twisted by a vampire lord\'s curse. Blood stains every stone.',
    atmosphere: [
      '🏰 The castle groans as if alive. Portraits on the walls track your movement.',
      '🩸 Fresh blood leads down the corridor ahead.',
      '🧛 Shadows move faster than they should.',
      '🌕 Moonlight streams through broken windows, illuminating nothing good.',
    ],
    monsters: {
      tier0: ['Vampire', 'Dark Mage', 'Ogre', 'Banshee'],
      tier1: ['Vampire', 'Banshee', 'Chimera', 'Griffon'],
    },
    subBoss: {
      name: 'Castle Warden',       emoji: '🏰', rank: 'D',
      hpMult: 4.0, atkMult: 2.0, defMult: 2.5,
      abilities: ['Dark Slash', 'Cursed Ground', 'Iron Will'],
      dialogue: ['The master will hear of this intrusion!', 'No mortal breaches these walls!', 'TURN BACK OR PERISH!'],
    },
    finalBoss: {
      name: 'Vampire Lord',        emoji: '🧛', rank: 'C',
      hpMult: 7.0, atkMult: 3.8, defMult: 2.5,
      abilities: ['Blood Drain', 'Bat Swarm', 'Hypnotic Gaze', 'Blood Nova', 'True Vampire Form'],
      dialogue: ['Centuries of waiting... and THIS is what challenges me?', 'YOUR BLOOD... SMELLS DIVINE!', '*wings unfurl from shadow*'],
    },
    passiveEffect: { type: 'blood_curse', desc: '🩸 Vampiric aura: enemies lifesteal 10% of damage dealt.' },
    rewards: { xpMult: 1.25, goldMult: 1.3, crystalMult: 1.15 },
  },

  // ── TIER 3: Levels 21–30 ─────────────────────────────────────
  volcano_depths: {
    id: 'volcano_depths',
    name: '🌋 Volcano Depths',
    rankRequired: 'C',
    minLevel: 21, maxLevel: 30,
    description: 'The living heart of an active volcano. Ancient dragons sleep here.',
    atmosphere: [
      '🌋 The ground cracks. Magma seeps through the floor.',
      '🐉 A distant rumble shakes the tunnels. Something massive breathes below.',
      '🔥 The heat is near-unbearable. Your gear might not survive.',
      '💎 Volcanic gems glow in the walls, beautiful and dangerous.',
    ],
    monsters: {
      tier0: ['Phoenix', 'Greater Demon', 'Hydra', 'Dragon Whelp'],
      tier1: ['Hydra', 'Dragon Whelp', 'Demon Knight', 'Elemental Lord'],
    },
    subBoss: {
      name: 'Fire Drake',          emoji: '🐉', rank: 'C',
      hpMult: 4.0, atkMult: 2.5, defMult: 2.0,
      abilities: ['Flame Breath', 'Tail Sweep', 'Heat Scale'],
      dialogue: ['*roars and breathes fire*', 'YOU DARE WAKE THE DRAKE?!', 'THIS IS MY LAIR!'],
    },
    finalBoss: {
      name: 'Ancient Volcano Dragon', emoji: '🐲', rank: 'B',
      hpMult: 8.0, atkMult: 4.0, defMult: 3.2,
      abilities: ['Magma Surge', 'Dragon Roar', 'Wing Crush', 'Lava Nova', 'Volcanic Awakening'],
      dialogue: ['I HAVE SLEPT FOR A THOUSAND YEARS... AND YOU DISTURB ME?!', 'FEEL THE WRATH OF THE VOLCANO!', '*the mountain erupts*'],
    },
    passiveEffect: { type: 'volcanic', desc: '🌋 Volcanic heat: all parties take 5% max HP on entering each floor.' },
    rewards: { xpMult: 1.5, goldMult: 1.4, crystalMult: 1.4 },
  },

  frozen_citadel: {
    id: 'frozen_citadel',
    name: '❄️ Frozen Citadel',
    rankRequired: 'C',
    minLevel: 22, maxLevel: 30,
    description: 'A citadel sealed in eternal ice. Those who enter rarely return.',
    atmosphere: [
      '❄️ Ice coats everything. Your breath mists before you.',
      '🌨️ A blizzard rages inside the halls. The cold is supernatural.',
      '💎 Frozen soldiers stand at their posts, eyes open, dead for centuries.',
      '🌑 The Frost Wyrm\'s roar echoes through the walls.',
    ],
    monsters: {
      tier0: ['Frost Giant', 'Basilisk', 'Undead Knight', 'Death Knight'],
      tier1: ['Frost Giant', 'Death Knight', 'Undead Knight', 'Elemental Lord'],
    },
    subBoss: {
      name: 'Frost Sentinel',      emoji: '❄️', rank: 'C',
      hpMult: 4.0, atkMult: 2.3, defMult: 2.8,
      abilities: ['Blizzard', 'Ice Armor', 'Frost Lance'],
      dialogue: ['NONE SHALL PASS THE FROST GATE!', 'THE COLD WILL CLAIM YOU.', '*ice spreads from every step*'],
    },
    finalBoss: {
      name: 'Frost Wyrm',          emoji: '🐉', rank: 'B',
      hpMult: 8.5, atkMult: 3.8, defMult: 3.5,
      abilities: ['Blizzard Breath', 'Freeze Pulse', 'Ice Storm', 'Arctic Coil', 'Absolute Zero'],
      dialogue: ['THE CITADEL WILL BE YOUR TOMB!', 'FREEZE AND BE PRESERVED... FOREVER!', '*the temperature drops to absolute zero*'],
    },
    passiveEffect: { type: 'freeze_floor', desc: '❄️ Frozen floor: 15% chance each turn that a player is frozen for 1 turn.' },
    rewards: { xpMult: 1.5, goldMult: 1.35, crystalMult: 1.5 },
  },

  // ── TIER 4: Levels 31–40 ─────────────────────────────────────
  elder_dragon_lair: {
    id: 'elder_dragon_lair',
    name: '🐉 Elder Dragon Lair',
    rankRequired: 'B',
    minLevel: 31, maxLevel: 40,
    description: 'The nesting ground of an elder dragon. Few have seen it and lived.',
    atmosphere: [
      '🐉 Ancient bones of heroes litter the floor.',
      '💎 Unimaginable treasure glints in the darkness.',
      '🔥 The walls are scorched from centuries of dragonfire.',
      '👑 You feel like prey. Because you are.',
    ],
    monsters: {
      tier0: ['Young Dragon', 'Demon Lord', 'Ancient Basilisk', 'Titan Spawn'],
      tier1: ['Demon Lord', 'Titan Spawn', 'Elder Lich', 'Young Dragon'],
    },
    subBoss: {
      name: 'Dragon Warden',       emoji: '🐉', rank: 'B',
      hpMult: 4.5, atkMult: 2.8, defMult: 2.5,
      abilities: ['Dragon Breath', 'Wing Attack', 'Roar', 'Scale Armor'],
      dialogue: ['*a thunderous roar shakes the lair*', 'LEAVE... OR BECOME ASH!', 'The Elder sleeps. You will not wake them.'],
    },
    finalBoss: {
      name: 'Elder Dragon',        emoji: '🐲', rank: 'A',
      hpMult: 10.0, atkMult: 5.0, defMult: 4.0,
      abilities: ['Ancient Flame', 'Dragon God Roar', 'Scale Fortress', 'Wing Tornado', 'Dragonheart Pulse', 'Elder\'s Wrath'],
      dialogue: [
        'I WATCHED EMPIRES RISE AND FALL. YOU ARE NOTHING.',
        'THE LAST FOOL WHO CHALLENGED ME... THEIR ASHES ARE STILL HERE.',
        '*THE ELDER DRAGON OPENS ITS EYES... THE WHOLE LAIR SHUDDERS*',
      ],
    },
    passiveEffect: { type: 'draconic_aura', desc: '🐉 Draconic aura: party ATK +15% but enemies also deal +10% damage.' },
    rewards: { xpMult: 2.0, goldMult: 1.8, crystalMult: 1.8 },
  },
};

// ── Floor scaling ─────────────────────────────────────────────
// Stats scale per floor within the dungeon (Floor 1 = base, Floor 10 = much harder)
function getFloorStatMult(floor) {
  // floors 1-10, each floor is progressively harder
  const mults = [1.0, 1.12, 1.25, 1.40, 1.55, 1.72, 1.90, 2.10, 2.32, 2.55];
  return mults[Math.min(floor - 1, 9)] || 1.0;
}

function isBossFloor(floor) { return floor === 5 || floor === 10; }
function isSubBossFloor(floor) { return floor === 5; }
function isFinalBossFloor(floor) { return floor === 10; }

// ── Generate a monster for a specific floor ───────────────────
function generateFloorMonster(dungeonType, floor, avgPlayerLevel) {
  const dt    = DUNGEON_TYPES[dungeonType];
  if (!dt) return null;

  const tier  = floor <= 5 ? 'tier0' : 'tier1';
  const pool  = dt.monsters[tier];
  const name  = pool[Math.floor(Math.random() * pool.length)];
  const mult  = getFloorStatMult(floor);
  const lvl   = Math.max(dt.minLevel, Math.min(dt.maxLevel, avgPlayerLevel + Math.floor(floor / 2)));

  // Base stats derived from level
  const baseHp  = Math.floor(lvl * 180 * mult);
  const baseAtk = Math.floor(lvl * 20  * mult);
  const baseDef = Math.floor(lvl * 10  * mult);

  // Find abilities from template if available
  const ABILITIES_MAP = {
    'Slime': ['Bounce', 'Acid Spit'], 'Goblin': ['Slash', 'Quick Strike'],
    'Rat': ['Quick Bite', 'Swarm'], 'Bat': ['Dive', 'Screech'],
    'Spider': ['Web Shot', 'Poison Bite'], 'Skeleton': ['Bone Throw', 'Rattle'],
    'Zombie': ['Bite', 'Infect'], 'Wolf Pup': ['Pounce', 'Howl'],
    'Imp': ['Fire Bolt', 'Teleport'], 'Dire Wolf': ['Howl', 'Savage Bite', 'Pack Tactics'],
    'Orc': ['Smash', 'Roar', 'Charge'], 'Troll': ['Regenerate', 'Club Swing'],
    'Giant Spider': ['Poison Bite', 'Web Trap', 'Venom Spray'],
    'Ghoul': ['Life Drain', 'Shadow Claw', 'Paralysis Touch'],
    'Harpy': ['Dive Bomb', 'Wind Slash', 'Screech'],
    'Minotaur': ['Charge', 'Gore', 'Rampage'],
    'Wraith': ['Phase', 'Soul Drain', 'Fear'], 'Gargoyle': ['Stone Skin', 'Dive Attack'],
    'Lesser Demon': ['Hellfire', 'Dark Slash'], 'Wyvern': ['Flame Breath', 'Tail Sweep'],
    'Ogre': ['Ground Slam', 'Rock Throw', 'Berserk'],
    'Dark Mage': ['Shadow Bolt', 'Curse', 'Dark Shield'],
    'Manticore': ['Tail Spikes', 'Savage Bite', 'Poison Sting'],
    'Vampire': ['Blood Drain', 'Shadow Step', 'Hypnotize'],
    'Cerberus': ['Triple Bite', 'Flame Breath', 'Hellhound Fury'],
    'Chimera': ['Multi-Strike', 'Poison Sting', 'Fire Breath'],
    'Iron Golem': ['Metal Fist', 'Iron Shield', 'Earthquake'],
    'Banshee': ['Wail', 'Curse of Death', 'Soul Scream'],
    'Griffon': ['Dive Claw', 'Wing Slash', 'Screech'],
    'Greater Demon': ['Inferno', 'Dark Chains', 'Demon Lord Form'],
    'Basilisk': ['Petrifying Gaze', 'Venom Fang', 'Coil Strike'],
    'Frost Giant': ['Blizzard', 'Ice Hammer', 'Frost Armor'],
    'Phoenix': ['Flame Nova', 'Rebirth', 'Fire Storm'],
    'Hydra': ['Regeneration', 'Multi-Bite', 'Acid Spit'],
    'Demon Knight': ['Dark Slash', 'Hell Armor', 'Blade Storm'],
    'Dragon Whelp': ['Fire Breath', 'Claw Strike', 'Dragon Roar'],
    'Undead Knight': ['Deathly Strike', 'Bone Shield', 'Dark Aura'],
    'Shadow Beast': ['Shadow Claw', 'Void Step', 'Dark Pounce'],
    'Elemental Lord': ['Elemental Blast', 'Storm Fury', 'Element Shift'],
    'Death Knight': ['Death Strike', 'Unholy Aura', 'Soul Rend'],
    'Young Dragon': ['Dragon Breath', 'Wing Attack', 'Roar', 'Tail Sweep'],
    'Demon Lord': ['Hell Storm', 'Demon Form', 'Dark Strike', 'Infernal Chains'],
    'Ancient Basilisk': ['Stone Gaze', 'Venom Nova', 'Coil', 'Death Stare'],
    'Titan Spawn': ['Rock Slide', 'Ground Punch', 'Stone Skin', 'Earthquake'],
    'Elder Lich': ['Death Wave', 'Soul Drain', 'Dark Curse', 'Lich Form'],
  };

  return {
    name,
    emoji: getMonsterEmoji(name),
    rank: dt.rankRequired,
    level: lvl,
    floor,
    stats: { hp: baseHp, maxHp: baseHp, atk: baseAtk, def: baseDef, speed: 80 },
    abilities: ABILITIES_MAP[name] || ['Strike', 'Defend'],
    statusEffects: [],
  };
}

function generateFloorBoss(dungeonType, floor, avgPlayerLevel) {
  const dt   = DUNGEON_TYPES[dungeonType];
  if (!dt) return null;

  const template = floor === 5 ? dt.subBoss : dt.finalBoss;
  const lvl      = Math.max(dt.minLevel, Math.min(dt.maxLevel + 5, avgPlayerLevel + 3));
  const baseMult = getFloorStatMult(floor);

  // Boss stats: base level stats × template multipliers × floor scaling
  const baseHp  = Math.floor(lvl * 180 * baseMult * template.hpMult);
  const baseAtk = Math.floor(lvl * 20  * baseMult * template.atkMult);
  const baseDef = Math.floor(lvl * 10  * baseMult * template.defMult);

  return {
    name: template.name,
    emoji: template.emoji,
    rank: template.rank,
    level: lvl,
    floor,
    isBoss: true,
    isSubBoss: floor === 5,
    isFinalBoss: floor === 10,
    stats: { hp: baseHp, maxHp: baseHp, atk: baseAtk, def: baseDef, speed: 90 },
    abilities: template.abilities,
    dialogue: template.dialogue,
    statusEffects: [],
  };
}

function getMonsterEmoji(name) {
  const map = {
    Slime:'🟢', Goblin:'👺', Rat:'🐀', Bat:'🦇', Spider:'🕷️',
    Skeleton:'💀', Zombie:'🧟', 'Wolf Pup':'🐺', Imp:'😈',
    'Dire Wolf':'🐺', Orc:'👹', Troll:'👾', 'Giant Spider':'🕷️',
    Ghoul:'👻', Harpy:'🦅', Minotaur:'🐂', Wraith:'👤', Gargoyle:'🗿',
    'Lesser Demon':'😈', Wyvern:'🐉', Ogre:'👹', 'Dark Mage':'🧙',
    Manticore:'🦁', Vampire:'🧛', Cerberus:'🐕', Chimera:'🦁',
    'Iron Golem':'🤖', Banshee:'👻', Griffon:'🦅',
    'Greater Demon':'👿', Basilisk:'🐍', 'Frost Giant':'❄️',
    Phoenix:'🔥', Hydra:'🐉', 'Demon Knight':'⚔️', 'Dragon Whelp':'🐲',
    'Undead Knight':'💀', 'Shadow Beast':'👤', 'Elemental Lord':'💨',
    'Death Knight':'☠️', 'Young Dragon':'🐉', 'Demon Lord':'👿',
    'Ancient Basilisk':'🐍', 'Titan Spawn':'⛰️', 'Elder Lich':'💀',
  };
  return map[name] || '👹';
}

// ── Dungeon type selector ─────────────────────────────────────
function getAvailableTypes(playerLevel) {
  return Object.values(DUNGEON_TYPES).filter(dt =>
    dt.minLevel <= playerLevel && dt.maxLevel >= Math.max(1, playerLevel - 5)
  );
}

// ── Advance-or-leave prompt ───────────────────────────────────
function getAdvancePrompt(floor, bossDefeated, rewards) {
  const nextFloor = floor + 1;
  const isLastFloor = floor === 10;

  if (isLastFloor) {
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏆 *ALL FLOORS CLEARED!*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `You have conquered this dungeon!\n` +
      `Claim your final rewards!`;
  }

  const dangerWarnings = {
    5:  '⚠️ Floor 5 is a SUB-BOSS floor! Prepare accordingly.',
    10: '💀 Floor 10 is the FINAL BOSS! Turn back now or face legend.',
    7:  '🔺 Floor 7+ — monsters are significantly stronger.',
  };
  const warning = dangerWarnings[nextFloor] || '';

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ *FLOOR ${floor} CLEARED!*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    (rewards ? `💰 Floor Reward:\n${rewards}\n\n` : '') +
    `${warning ? warning + '\n\n' : ''}` +
    `🎯 *CHOOSE:*\n` +
    `/dungeon advance — Push to Floor ${nextFloor}\n` +
    `/dungeon leave   — Exit & keep rewards\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⏰ *60 seconds to decide!*\n` +
    `(All party members must vote advance, OR leader decides)`;
}

// ── Floor reward calculation ──────────────────────────────────
function calcFloorRewards(dungeonType, floor, avgLevel, partySize) {
  const dt = DUNGEON_TYPES[dungeonType] || {};
  const rm = dt.rewards || { xpMult:1, goldMult:1, crystalMult:1 };
  const floorMult = 1 + (floor - 1) * 0.15; // +15% per floor
  const bossMult  = isBossFloor(floor) ? 2.5 : 1.0;
  const sizeMult  = Math.max(1, 1 + (partySize - 1) * 0.1); // +10% per extra member (capped)

  return {
    xp:       Math.floor(avgLevel * 80  * floorMult * bossMult * rm.xpMult),
    gold:     Math.floor(avgLevel * 35  * floorMult * bossMult * rm.goldMult),
    crystals: Math.floor(avgLevel * 12  * floorMult * bossMult * rm.crystalMult),
    up:       isBossFloor(floor) ? Math.floor(floor / 2) : 1,
  };
}

// ── Boss intro text ───────────────────────────────────────────
function getBossIntro(boss, floor) {
  const isSubBoss = floor === 5;
  const lines = boss.dialogue || ['*prepares to fight*'];
  const line  = lines[Math.floor(Math.random() * lines.length)];

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    (isSubBoss
      ? `⚔️ *FLOOR ${floor} — SUB-BOSS!*\n`
      : `💀 *FLOOR ${floor} — FINAL BOSS!*\n`) +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `${boss.emoji} *${boss.name}* appears!\n\n` +
    `💬 *"${line}"*\n`;
}

module.exports = {
  DUNGEON_TYPES,
  getAvailableTypes,
  getFloorStatMult,
  isBossFloor,
  isSubBossFloor,
  isFinalBossFloor,
  generateFloorMonster,
  generateFloorBoss,
  getAdvancePrompt,
  calcFloorRewards,
  getBossIntro,
  getMonsterEmoji,
};
