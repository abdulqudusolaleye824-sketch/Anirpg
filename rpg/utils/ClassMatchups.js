// ═══════════════════════════════════════════════════════════════
// CLASS MATCHUPS - Weakness, Resistance, and Immunity System
// ═══════════════════════════════════════════════════════════════

const CLASS_MATCHUPS = {
  Warrior: {
    weakTo: [],
    strongAgainst: [],
    immuneTo: ['fear', 'silence'],
    resistances: { weaken: 0.4, blind: 0.3, stun: 0.2 },
    passives: []
  },
  Mage: {
    weakTo: ['Archer'],
    strongAgainst: [],
    immuneTo: [],
    resistances: {},
    passives: []
  },
  Archer: {
    weakTo: ['Rogue'],
    strongAgainst: ['Mage'],
    immuneTo: ['blind'],
    resistances: { burn: 0.5, freeze: 0.5 },
    passives: ['eagle_eye_passive']
  },
  Assassin: {
    weakTo: ['DragonKnight'],
    strongAgainst: [],
    immuneTo: ['weaken', 'fear'],
    resistances: { blind: 0.3, poison: 0.3 },
    passives: []
  },
  Rogue: {
    weakTo: ['DragonKnight'],
    strongAgainst: ['Archer', 'Paladin'],
    immuneTo: ['burn', 'freeze'],
    resistances: { blind: 0.2, fear: 0.3 },
    passives: []
  },
  Berserker: {
    weakTo: [],
    strongAgainst: ['DragonKnight', 'Necromancer'],
    immuneTo: [],
    resistances: { fear: 0.5, weaken: 0.5 },
    passives: ['berserk_immunity_on_rage']
  },
  Paladin: {
    weakTo: ['Rogue'],
    strongAgainst: ['Devourer'],
    immuneTo: [],
    resistances: { fear: 0.3, burn: 0.3, freeze: 0.3, poison: 0.3, bleed: 0.3, weaken: 0.3, stun: 0.3, paralyze: 0.3, silence: 0.3, blind: 0.3 },
    passives: ['holy_aura']
  },
  Necromancer: {
    weakTo: ['Berserker'],
    strongAgainst: [],
    immuneTo: [],
    resistances: { fear: 0.5, silence: 0.5, burn: 0.5, freeze: 0.5, poison: 0.5, stun: 0.5, paralyze: 0.5, blind: 0.5, weaken: 0.5 },
    passives: ['undead_resistance']
  },
  DragonKnight: {
    weakTo: ['Berserker'],
    strongAgainst: ['Assassin', 'Rogue'],
    immuneTo: ['stun'],
    resistances: { fear: 0.7, weaken: 0.5 },
    passives: ['dragon_scales']
  },
  Devourer: {
    weakTo: ['Paladin'],
    strongAgainst: [],
    immuneTo: ['fear'],
    resistances: { weaken: 0.3, bleed: 0.3 },
    passives: ['adaptive_evolution']
  },
  Senku: {
    weakTo: ['Berserker'],
    strongAgainst: [],
    immuneTo: [],
    resistances: { fear: 0.3, weaken: 0.3, blind: 0.3, silence: 0.3, paralyze: 0.3, burn: 0.3, freeze: 0.3, poison: 0.3, stun: 0.3, bleed: 0.3 },
    passives: ['scientific_nullify', 'accuracy_aura', 'always_first']
  }
};

// Damage multiplier when class A fights class B
// Returns { multiplier, message }
function getMatchupMultiplier(attackerClass, defenderClass) {
  const attacker = CLASS_MATCHUPS[attackerClass];
  if (!attacker) return { multiplier: 1.0, message: null };

  if (attacker.strongAgainst?.includes(defenderClass)) {
    return { multiplier: 1.25, message: `⚡ ${attackerClass} has the advantage over ${defenderClass}! (+25% damage)` };
  }
  if (attacker.weakTo?.includes(defenderClass)) {
    return { multiplier: 0.80, message: `⚠️ ${attackerClass} is at a disadvantage against ${defenderClass}! (-20% damage)` };
  }
  return { multiplier: 1.0, message: null };
}

// Check if a status effect should be resisted
// Returns { resisted: bool, reducedDuration: number }
function checkEffectResistance(defenderClass, effectType) {
  if (defenderClass === 'Warrior') {
    return { resisted: true, reducedDuration: 0 };
  }

  const matchup = CLASS_MATCHUPS[defenderClass];
  if (!matchup) return { resisted: false, reducedDuration: 0 };

  if (matchup.immuneTo?.includes(effectType)) {
    return { resisted: true, reducedDuration: 0 };
  }

  const resistance = matchup.resistances?.[effectType] || 0;
  if (resistance > 0 && Math.random() < resistance) {
    return { resisted: true, reducedDuration: 0 };
  }

  return { resisted: false, reducedDuration: 0 };
}

// Get class name from player object
function getClassName(player) {
  if (typeof player.class === 'string') return player.class;
  return player.class?.name || 'Warrior';
}

module.exports = { CLASS_MATCHUPS, getMatchupMultiplier, checkEffectResistance, getClassName };
