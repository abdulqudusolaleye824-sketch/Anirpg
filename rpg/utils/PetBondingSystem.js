/**
 * ╔══════════════════════════════════════════════════════╗
 * ║    Astra — Pet Bonding, Hunger & Compatibility      ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Bonding (0–100):
 *   Increases by: feeding, battling together, /pet play
 *   Decreases by: ignoring pet (hunger ticks up, bonding drops)
 *   Bonus: Each 10 points adds +1% to all stats from pet
 *
 * Hunger (0–100):
 *   Starts at 0 (full). Increases over time.
 *   At hunger ≥ 50: pet performs at 75% effectiveness
 *   At hunger ≥ 80: pet refuses to battle
 *   Reset by feeding (/pet feed)
 *
 * Compatibility (0–100):
 *   Based on: player class vs pet role vs pet type
 *   Static — calculated once when pet is assigned
 *   High compatibility → bonus stat scaling
 *   Formula: base 50 + role match +20 + type synergy +30
 *
 * Compatibility Table:
 *   Warrior/Knight/Berserker → attack pets +20
 *   Mage/Elementalist/Necromancer → support pets +20
 *   Rogue/Assassin/ShadowDancer → scavenger pets +20
 *   Type synergies: fire+warrior=+15, void+phantom=+20, etc.
 */

'use strict';

// ── Hunger tick rate ──────────────────────────────────────────────────────────
// How many hunger points per hour of real-time
const HUNGER_PER_HOUR = 6; // 0→100 in ~16.7 hours

// ── Role → class affinities ───────────────────────────────────────────────────
const ROLE_AFFINITIES = {
  attack:    ['Warrior', 'Knight', 'Berserker', 'BloodKnight', 'Warlord', 'DragonKnight', 'Monster'],
  support:   ['Mage', 'Elementalist', 'Necromancer', 'Paladin', 'Shaman', 'Chronomancer', 'Summoner'],
  scavenger: ['Rogue', 'Assassin', 'ShadowDancer', 'Phantom', 'Ranger', 'Devourer'],
};

// ── Type → class synergies (additive) ────────────────────────────────────────
const TYPE_SYNERGIES = {
  fire:    { Warrior: 15, Berserker: 20, DragonKnight: 25 },
  ice:     { Mage: 15, Chronomancer: 20, Elementalist: 25 },
  void:    { Phantom: 25, Devourer: 20, ShadowDancer: 15 },
  shadow:  { Assassin: 20, ShadowDancer: 25, Rogue: 15 },
  poison:  { Ranger: 20, Rogue: 15, Assassin: 15 },
  thunder: { Elementalist: 20, Warlord: 15, SpellBlade: 20 },
  basic:   {},
  ancient: { Summoner: 20, Necromancer: 15, Elementalist: 15 },
  beast:   { Warrior: 10, Berserker: 15, Ranger: 20 },
};

// ── Calculate compatibility ───────────────────────────────────────────────────
function calculateCompatibility(playerClass, petRole, petType) {
  let compat = 50;

  const className = typeof playerClass === 'object' ? (playerClass?.name || '') : (playerClass || '');

  // Role match
  const roleMatch = ROLE_AFFINITIES[petRole] || [];
  if (roleMatch.includes(className)) compat += 20;

  // Type synergy
  const typeSynergy = TYPE_SYNERGIES[petType] || {};
  if (typeSynergy[className]) compat += typeSynergy[className];

  // Cap
  return Math.min(100, Math.max(0, compat));
}

// ── Compatibility label ───────────────────────────────────────────────────────
function getCompatLabel(compat) {
  if (compat >= 90) return '🔥 Perfect Sync';
  if (compat >= 75) return '✨ Great Bond';
  if (compat >= 55) return '🟢 Good Match';
  if (compat >= 40) return '🟡 Neutral';
  return '🔴 Mismatch';
}

// ── Update hunger (call on any pet interaction) ───────────────────────────────
function updateHunger(pet) {
  if (!pet || !pet.lastFed) return;
  const hoursPassed = (Date.now() - pet.lastFed) / 3600000;
  pet.hunger = Math.min(100, (pet.hunger || 0) + Math.floor(hoursPassed * HUNGER_PER_HOUR));
  pet.lastFed = Date.now();

  // Hunger affects bonding if very hungry
  if (pet.hunger >= 80 && pet.bonding > 0) {
    pet.bonding = Math.max(0, pet.bonding - 1);
  }
}

// ── Feed pet ──────────────────────────────────────────────────────────────────
function feedPet(pet, foodQuality = 'basic') {
  if (!pet) return { success: false, error: 'No active pet.' };

  const hungerReduction = { basic: 30, premium: 55, legendary: 100 }[foodQuality] || 30;
  const bondingGain     = { basic: 2,  premium: 5,  legendary: 10  }[foodQuality] || 2;

  pet.hunger  = Math.max(0, (pet.hunger || 0) - hungerReduction);
  pet.bonding = Math.min(100, (pet.bonding || 0) + bondingGain);
  pet.lastFed = Date.now();

  return {
    success: true,
    hungerAfter: pet.hunger,
    bondingAfter: pet.bonding,
    bondingGain,
  };
}

// ── Play with pet (increases bonding) ────────────────────────────────────────
function playWithPet(pet) {
  if (!pet) return { success: false, error: 'No active pet.' };
  if ((pet.hunger || 0) >= 80) return { success: false, error: `${pet.name || 'Your pet'} is too hungry to play! Feed it first.` };

  const gain   = 3 + Math.floor(Math.random() * 4); // 3–6
  pet.bonding  = Math.min(100, (pet.bonding || 0) + gain);
  pet.hunger   = Math.min(100, (pet.hunger || 0) + 5); // playing makes them a bit hungry

  return { success: true, bondingGain: gain, bondingAfter: pet.bonding };
}

// ── Battle bonding gain ───────────────────────────────────────────────────────
function onBattleWithPet(pet) {
  if (!pet) return;
  const gain = pet.hunger < 50 ? 2 : 1;
  pet.bonding = Math.min(100, (pet.bonding || 0) + gain);
  pet.battles = (pet.battles || 0) + 1;
}

// ── Get effective pet bonus (after hunger + bonding + compat) ─────────────────
function getEffectivePetBonus(petData, baseStats, compatibility) {
  if (!petData || !baseStats) return { atk: 0, def: 0, hp: 0 };

  updateHunger(petData);

  // Hunger penalty
  const hunger = petData.hunger || 0;
  let hungerMult = 1.0;
  if (hunger >= 80) hungerMult = 0.0;       // pet refuses to battle
  else if (hunger >= 50) hungerMult = 0.75;  // 25% penalty

  // Bonding bonus (+1% per 10 bonding)
  const bondingBonus = 1 + ((petData.bonding || 0) / 10 * 0.01);

  // Compatibility bonus
  const compatMult = 1 + ((compatibility || 50) - 50) / 200; // ±25%

  const mult = hungerMult * bondingBonus * compatMult;

  return {
    atk: Math.floor((baseStats.atk || 0) * mult),
    def: Math.floor((baseStats.def || 0) * mult),
    hp:  Math.floor((baseStats.hp  || 0) * mult),
    cantBattle: hunger >= 80,
  };
}

// ── Bonding label ─────────────────────────────────────────────────────────────
function getBondingLabel(bonding) {
  if (bonding >= 90) return '💜 Soulbound';
  if (bonding >= 70) return '❤️ Loyal';
  if (bonding >= 50) return '🧡 Friendly';
  if (bonding >= 30) return '💛 Warming Up';
  return '🩶 Stranger';
}

// ── Hunger label ──────────────────────────────────────────────────────────────
function getHungerLabel(hunger) {
  if (hunger >= 80) return '😤 Starving (refuses to fight)';
  if (hunger >= 60) return '😩 Very Hungry (-25% effectiveness)';
  if (hunger >= 40) return '😕 Hungry';
  if (hunger >= 20) return '😊 Satisfied';
  return '🍖 Full';
}

// ── Format pet card ───────────────────────────────────────────────────────────
function formatPetCard(petData, compatibility) {
  if (!petData) return '_No active pet._';
  updateHunger(petData);

  const bond    = petData.bonding     || 0;
  const hunger  = petData.hunger      || 0;
  const compat  = compatibility       || 50;
  const bondBar = buildBar(bond,   100, 8);
  const hungBar = buildBar(hunger, 100, 8);

  return [
    `${petData.emoji || '🐾'} *${petData.nickname || petData.name}*`,
    `  Role: ${petData.role} | Type: ${petData.type}`,
    `  Lv.${petData.level} | ${petData.rarity} | Battles: ${petData.battles||0}`,
    ``,
    `  ❤️ Bonding: ${bondBar} ${bond}% — ${getBondingLabel(bond)}`,
    `  🍖 Hunger:  ${hungBar} ${hunger}% — ${getHungerLabel(hunger)}`,
    `  🔗 Compat:  ${compat}% — ${getCompatLabel(compat)}`,
    ``,
    `  ⚔️ ATK: ${petData.stats?.atk||0} | 🛡️ DEF: ${petData.stats?.def||0} | ❤️ HP: ${petData.stats?.hp||0}`,
    ``,
    `  💡 /pet feed — feed your pet`,
    `  💡 /pet play — bond with your pet`,
  ].join('\n');
}

function buildBar(value, max, length) {
  const filled = Math.round((value / max) * length);
  return '[' + '█'.repeat(Math.min(filled, length)) + '░'.repeat(Math.max(0, length - filled)) + ']';
}

module.exports = {
  calculateCompatibility,
  getCompatLabel,
  getBondingLabel,
  getHungerLabel,
  updateHunger,
  feedPet,
  playWithPet,
  onBattleWithPet,
  getEffectivePetBonus,
  formatPetCard,
  ROLE_AFFINITIES,
  TYPE_SYNERGIES,
  HUNGER_PER_HOUR,
};
