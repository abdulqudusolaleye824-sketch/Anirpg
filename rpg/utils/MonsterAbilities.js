// ============================================
// FILE: rpg/utils/MonsterAbilities.js
// Complete Monster Ability Descriptions & Effects
// ============================================

class MonsterAbilities {
  // ═══════════════════════════════════════════════════════════════
  // MONSTER ABILITY DATABASE
  // ═══════════════════════════════════════════════════════════════
  static abilities = {
    // ========== F-RANK MONSTER ABILITIES ==========
    'Bounce': {
      name: 'Bounce',
      animation: '🟢 The slime bounces up high...\n💥 BOUNCE! It crashes down with surprising force!\n💫 The impact sends shockwaves!',
      damageMultiplier: 1.2,
      statusEffect: null
    },
    
    'Acid Spit': {
      name: 'Acid Spit',
      animation: '🟢 The slime gurgles ominously...\n💚 ACID SPIT! Corrosive liquid sprays out!\n🔥 The acid sizzles on contact!',
      damageMultiplier: 1.3,
      statusEffect: { type: 'poison', chance: 40, duration: 3, damage: 5 }
    },
    
    'Club Smash': {
      name: 'Club Smash',
      animation: '👺 The goblin raises its crude club high...\n💥 CLUB SMASH! A devastating overhead strike!\n⚡ The blow leaves you dazed!',
      damageMultiplier: 1.4,
      statusEffect: { type: 'stun', chance: 20, duration: 1 }
    },
    
    'Sneak Attack': {
      name: 'Sneak Attack',
      animation: '👺 The goblin disappears into shadows...\n🗡️ SNEAK ATTACK! A blade strikes from nowhere!\n💨 You barely saw it coming!',
      damageMultiplier: 1.8,
      statusEffect: { type: 'bleed', chance: 35, duration: 3, damage: 4 }
    },
    
    'Web Shot': {
      name: 'Web Shot',
      animation: '🕷️ The spider rears back, mandibles clicking...\n🕸️ WEB SHOT! Sticky webs fly toward you!\n⚠️ The threads entangle your movement!',
      damageMultiplier: 1.1,
      statusEffect: { type: 'slow', chance: 50, duration: 2 }
    },
    
    'Poison Bite': {
      name: 'Poison Bite',
      animation: '🕷️ The spider lunges with fangs bared...\n🦷 POISON BITE! Venomous fangs pierce flesh!\n☠️ Deadly toxins course through your veins!',
      damageMultiplier: 1.3,
      statusEffect: { type: 'poison', chance: 60, duration: 4, damage: 6 }
    },
    
    'Bone Throw': {
      name: 'Bone Throw',
      animation: '💀 The skeleton reaches for a bone...\n🦴 BONE THROW! A sharp bone missile flies!\n💥 It strikes with deadly accuracy!',
      damageMultiplier: 1.2,
      statusEffect: null
    },
    
    'Rattle': {
      name: 'Rattle',
      animation: '💀 The skeleton shakes violently...\n🎵 RATTLE! An unholy cacophony fills the air!\n😱 The sound chills you to your core!',
      damageMultiplier: 0.8,
      statusEffect: { type: 'fear', chance: 40, duration: 2 }
    },
    
    'Bite': {
      name: 'Bite',
      animation: '🧟 The zombie lunges with rotting jaws...\n🦷 BITE! Decaying teeth sink deep!\n🩸 The wound festers with infection!',
      damageMultiplier: 1.3,
      statusEffect: { type: 'poison', chance: 45, duration: 3, damage: 5 }
    },
    
    'Grasp': {
      name: 'Grasp',
      animation: '🧟 The zombie reaches out with dead hands...\n🖐️ GRASP! Cold fingers grip you tight!\n❄️ The deathly touch drains your strength!',
      damageMultiplier: 1.1,
      statusEffect: { type: 'weaken', chance: 35, duration: 2 }
    },

    // ========== E-RANK MONSTER ABILITIES ==========
    'Charge': {
      name: 'Charge',
      animation: '👹 The orc bellows and charges forward...\n💨 CHARGE! Unstoppable momentum!\n💥 The impact sends you flying!',
      damageMultiplier: 1.6,
      statusEffect: { type: 'stun', chance: 30, duration: 1 }
    },
    
    'Berserker Rage': {
      name: 'Berserker Rage',
      animation: '👹 The orc\'s eyes glow red with fury...\n😡 BERSERKER RAGE! Primal anger unleashed!\n🔥 Each strike grows more savage!',
      damageMultiplier: 2.0,
      statusEffect: { type: 'bleed', chance: 50, duration: 3, damage: 8 }
    },
    
    'Pack Tactics': {
      name: 'Pack Tactics',
      animation: '🐺 The wolf howls to rally its pack...\n👥 PACK TACTICS! Coordinated assault!\n⚔️ They strike from multiple angles!',
      damageMultiplier: 1.7,
      statusEffect: null
    },
    
    'Howl': {
      name: 'Howl',
      animation: '🐺 The wolf throws back its head...\n🌙 HOWL! A bone-chilling cry echoes!\n😨 Your resolve wavers!',
      damageMultiplier: 0.5,
      statusEffect: { type: 'fear', chance: 60, duration: 3 }
    },
    
    'Shadow Strike': {
      name: 'Shadow Strike',
      animation: '👤 The bandit melts into darkness...\n🗡️ SHADOW STRIKE! A blade from the void!\n💀 You never saw them move!',
      damageMultiplier: 1.9,
      statusEffect: { type: 'bleed', chance: 40, duration: 3, damage: 7 }
    },
    
    'Smoke Bomb': {
      name: 'Smoke Bomb',
      animation: '👤 The bandit throws a mysterious orb...\n💨 SMOKE BOMB! Thick clouds billow out!\n👁️ You can\'t see anything!',
      damageMultiplier: 0.8,
      statusEffect: { type: 'blind', chance: 70, duration: 2 }
    },
    
    'Dark Bolt': {
      name: 'Dark Bolt',
      animation: '🧙‍♂️ The cultist chants forbidden words...\n⚫ DARK BOLT! Unholy energy crackles!\n💀 The darkness burns like acid!',
      damageMultiplier: 1.5,
      statusEffect: { type: 'curse', chance: 45, duration: 4 }
    },
    
    'Curse': {
      name: 'Curse',
      animation: '🧙‍♂️ The cultist points with twisted fingers...\n☠️ CURSE! Malevolent magic wraps around you!\n🌀 Your strength drains away!',
      damageMultiplier: 0.7,
      statusEffect: { type: 'weaken', chance: 80, duration: 5 }
    },

    // ========== D-RANK MONSTER ABILITIES ==========
    'Fireball': {
      name: 'Fireball',
      animation: '🔥 The golem\'s core glows white-hot...\n☄️ FIREBALL! A blazing sphere erupts!\n🌋 The flames engulf everything!',
      damageMultiplier: 1.8,
      statusEffect: { type: 'burn', chance: 60, duration: 4, damage: 10 }
    },
    
    'Slam': {
      name: 'Slam',
      animation: '🔥 The golem raises massive fists...\n💥 SLAM! The ground shakes violently!\n🌍 You can barely keep your footing!',
      damageMultiplier: 2.2,
      statusEffect: { type: 'stun', chance: 40, duration: 1 }
    },
    
    'Dive Bomb': {
      name: 'Dive Bomb',
      animation: '🦅 The harpy soars high into the sky...\n🎯 DIVE BOMB! A deadly plunge from above!\n💥 The impact is devastating!',
      damageMultiplier: 2.0,
      statusEffect: { type: 'stun', chance: 35, duration: 1 }
    },
    
    'Screech': {
      name: 'Screech',
      animation: '🦅 The harpy opens its beak wide...\n📢 SCREECH! An ear-piercing wail!\n😖 Your head throbs with pain!',
      damageMultiplier: 1.2,
      statusEffect: { type: 'confuse', chance: 55, duration: 2 }
    },
    
    'Venomous Strike': {
      name: 'Venomous Strike',
      animation: '🐍 The wyvern\'s tail whips forward...\n🦂 VENOMOUS STRIKE! The stinger pierces!\n☠️ Lethal poison floods your system!',
      damageMultiplier: 1.7,
      statusEffect: { type: 'poison', chance: 70, duration: 5, damage: 12 }
    },
    
    'Wing Gust': {
      name: 'Wing Gust',
      animation: '🐍 The wyvern beats its massive wings...\n🌪️ WING GUST! A violent windstorm!\n💨 You\'re thrown back helplessly!',
      damageMultiplier: 1.4,
      statusEffect: { type: 'knockback', chance: 60, duration: 1 }
    },

    // ========== C-RANK MONSTER ABILITIES ==========
    'Dive Claw': {
      name: 'Dive Claw',
      animation: '🦅 The griffon circles, eyes locked on prey...\n🦅 DIVE CLAW! Razor talons descend!\n🩸 The claws tear through armor!',
      damageMultiplier: 2.3,
      statusEffect: { type: 'bleed', chance: 65, duration: 4, damage: 15 }
    },
    
    'Majestic Roar': {
      name: 'Majestic Roar',
      animation: '🦅 The griffon rears back majestically...\n🦁 MAJESTIC ROAR! A sound of pure power!\n😱 Your courage falters!',
      damageMultiplier: 1.0,
      statusEffect: { type: 'fear', chance: 75, duration: 3 }
    },
    
    'Petrifying Gaze': {
      name: 'Petrifying Gaze',
      animation: '🐍 The basilisk locks eyes with you...\n👁️ PETRIFYING GAZE! Stone-cold death stare!\n🗿 Your body begins to harden!',
      damageMultiplier: 1.5,
      statusEffect: { type: 'petrify', chance: 50, duration: 2 }
    },
    
    'Acid Breath': {
      name: 'Acid Breath',
      animation: '🐍 The basilisk inhales deeply...\n💚 ACID BREATH! Corrosive mist sprays out!\n🔥 Your skin burns and blisters!',
      damageMultiplier: 2.0,
      statusEffect: { type: 'poison', chance: 80, duration: 5, damage: 15 }
    },
    
    'Lightning Strike': {
      name: 'Lightning Strike',
      animation: '🐉 Storm clouds gather around the drake...\n⚡ LIGHTNING STRIKE! Thunder and fury!\n💥 Electricity courses through you!',
      damageMultiplier: 2.5,
      statusEffect: { type: 'paralyze', chance: 60, duration: 2 }
    },
    
    'Dragon Breath': {
      name: 'Dragon Breath',
      animation: '🐉 The drake\'s throat glows with power...\n🔥 DRAGON BREATH! A torrent of flames!\n🌋 Everything is consumed by fire!',
      damageMultiplier: 2.8,
      statusEffect: { type: 'burn', chance: 85, duration: 5, damage: 20 }
    },

    // ========== B-RANK MONSTER ABILITIES ==========
    'Cleave': {
      name: 'Cleave',
      animation: '⚔️ The minotaur swings its massive axe...\n🪓 CLEAVE! The blade splits the air!\n💥 Nothing can withstand this strike!',
      damageMultiplier: 3.0,
      statusEffect: { type: 'bleed', chance: 70, duration: 5, damage: 20 }
    },
    
    'Bull Rush': {
      name: 'Bull Rush',
      animation: '⚔️ The minotaur lowers its horns...\n🐂 BULL RUSH! Unstoppable charging fury!\n💥 The impact breaks bones!',
      damageMultiplier: 2.7,
      statusEffect: { type: 'stun', chance: 60, duration: 2 }
    },
    
    'Elemental Fury': {
      name: 'Elemental Fury',
      animation: '🌪️ The djinn commands the elements...\n🌊🔥⚡❄️ ELEMENTAL FURY! Nature\'s wrath!\n🌀 Fire, water, earth, and air converge!',
      damageMultiplier: 2.9,
      statusEffect: { type: 'burn', chance: 50, duration: 4, damage: 18 }
    },
    
    'Whirlwind': {
      name: 'Whirlwind',
      animation: '🌪️ The djinn spins into a vortex...\n🌀 WHIRLWIND! A cyclone of destruction!\n💨 You\'re caught in the maelstrom!',
      damageMultiplier: 2.4,
      statusEffect: { type: 'confuse', chance: 70, duration: 3 }
    },
    
    'Soul Drain': {
      name: 'Soul Drain',
      animation: '👻 The wraith reaches into your essence...\n💀 SOUL DRAIN! Your life force is siphoned!\n❄️ Cold darkness fills your being!',
      damageMultiplier: 2.6,
      statusEffect: { type: 'weaken', chance: 80, duration: 5 }
    },
    
    'Spectral Touch': {
      name: 'Spectral Touch',
      animation: '👻 The wraith phases through reality...\n🌫️ SPECTRAL TOUCH! Ethereal claws pass through armor!\n💀 Your soul itself is wounded!',
      damageMultiplier: 2.8,
      statusEffect: { type: 'curse', chance: 65, duration: 4 }
    },

    // ========== A-RANK MONSTER ABILITIES ==========
    'Hellfire': {
      name: 'Hellfire',
      animation: '👿 The demon raises its arms to the sky...\n🔥 HELLFIRE! Infernal flames rain down!\n🌋 The very ground melts beneath you!',
      damageMultiplier: 3.5,
      statusEffect: { type: 'burn', chance: 90, duration: 6, damage: 25 }
    },
    
    'Demon Form': {
      name: 'Demon Form',
      animation: '👿 The demon\'s body transforms hideously...\n😈 DEMON FORM! True evil revealed!\n💀 Its power multiplies exponentially!',
      damageMultiplier: 4.0,
      statusEffect: { type: 'fear', chance: 85, duration: 4 }
    },
    
    'Meteor Strike': {
      name: 'Meteor Strike',
      animation: '🐲 The dragon summons cosmic power...\n☄️ METEOR STRIKE! A flaming boulder descends!\n💥 The explosion is cataclysmic!',
      damageMultiplier: 4.5,
      statusEffect: { type: 'burn', chance: 95, duration: 6, damage: 30 }
    },
    
    'Ancient Roar': {
      name: 'Ancient Roar',
      animation: '🐲 The dragon unleashes millennia of fury...\n🌋 ANCIENT ROAR! The sound shatters mountains!\n😱 Pure terror overwhelms you!',
      damageMultiplier: 3.8,
      statusEffect: { type: 'fear', chance: 90, duration: 5 }
    },

    // ========== S-RANK BOSS ABILITIES ==========
    'Apocalypse': {
      name: 'Apocalypse',
      animation: '💀 Reality itself begins to unravel...\n🌌 APOCALYPSE! The end of all things!\n💀 Existence itself is threatened!',
      damageMultiplier: 5.0,
      statusEffect: { type: 'doom', chance: 100, duration: 10, damage: 50 }
    },
    
    'Void Touch': {
      name: 'Void Touch',
      animation: '💀 The lich extends a skeletal hand...\n⚫ VOID TOUCH! The touch of oblivion!\n💀 Your very essence begins to fade!',
      damageMultiplier: 4.8,
      statusEffect: { type: 'curse', chance: 95, duration: 8 }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // GET MONSTER ABILITY INFO
  // ═══════════════════════════════════════════════════════════════
  static getAbility(abilityName) {
    return this.abilities[abilityName] || {
      name: abilityName,
      animation: `💥 The monster uses ${abilityName}!\n⚡ A powerful attack!\n💥 You take damage!`,
      damageMultiplier: 1.5,
      statusEffect: null
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // EXECUTE MONSTER ABILITY
  // ═══════════════════════════════════════════════════════════════
  static executeAbility(monster, target, abilityName) {
    const ability = this.getAbility(abilityName);
    
    // Calculate base damage
    const baseDamage = monster.atk || 10;
    const damageMultiplier = ability.damageMultiplier || 1.5;
    
    // Apply damage multiplier
    let damage = Math.floor(baseDamage * damageMultiplier);
    
    // Apply target defense (30% reduction)
    const defenseReduction = (target.def || 0) * 0.3;
    damage = Math.max(10, damage - Math.floor(defenseReduction));
    
    // Random variance (±10%)
    const variance = 0.9 + Math.random() * 0.2;
    damage = Math.floor(damage * variance);
    
    return {
      damage,
      animation: ability.animation,
      statusEffect: ability.statusEffect,
      abilityName: ability.name
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // CHECK IF MONSTER SHOULD USE ABILITY
  // ═══════════════════════════════════════════════════════════════
  static shouldUseAbility(monster) {
    if (!monster.abilities || monster.abilities.length === 0) return false;
    
    // Skill usage chance based on rank
    const skillChances = {
      'F': 60,
      'E': 65,
      'D': 70,
      'C': 75,
      'B': 80,
      'A': 85,
      'S': 90
    };
    
    const chance = skillChances[monster.rank] || 60;
    return Math.random() * 100 < chance;
  }

  // ═══════════════════════════════════════════════════════════════
  // GET RANDOM ABILITY FROM MONSTER
  // ═══════════════════════════════════════════════════════════════
  static getRandomAbility(monster) {
    if (!monster.abilities || monster.abilities.length === 0) {
      return null;
    }
    return monster.abilities[Math.floor(Math.random() * monster.abilities.length)];
  }
}

module.exports = MonsterAbilities;