// ═══════════════════════════════════════════════════════════════
// PARTY ROLE SYSTEM - Class Roles + Combo Synergies
// ═══════════════════════════════════════════════════════════════

const ROLES = {
  Warrior:     { role: 'Tank',      emoji: '🛡️' },
  Paladin:     { role: 'Healer',    emoji: '💊' },
  Mage:        { role: 'DPS',       emoji: '🔮' },
  Archer:      { role: 'DPS',       emoji: '🎯' },
  Assassin:    { role: 'Burst',     emoji: '⚡' },
  Rogue:       { role: 'Disruptor', emoji: '🎭' },
  Berserker:   { role: 'Bruiser',   emoji: '💢' },
  DragonKnight:{ role: 'Vanguard',  emoji: '🐉' },
  Necromancer: { role: 'Support',   emoji: '💀' },
  Devourer:    { role: 'Wildcard',  emoji: '🌑' },
  Senku:       { role: 'Genius',    emoji: '🧪' }
};

// Per-class role bonuses applied when in a party
const ROLE_BONUSES = {
  Warrior:      { type: 'damageAbsorb',   value: 0.20, desc: 'Absorbs 20% of damage meant for allies' },
  Paladin:      { type: 'passiveHeal',    value: 0.05, desc: 'Heals lowest HP ally 5% max HP per turn' },
  Mage:         { type: 'aoeSplash',      value: 0.15, desc: 'Skills splash 15% damage to all enemies' },
  Archer:       { type: 'partyCrit',      value: 0.15, desc: '+15% crit chance for whole party' },
  Assassin:     { type: 'firstStrike',    value: 1,    desc: 'First strike on every dungeon floor' },
  Rogue:        { type: 'randomDebuff',   value: 0.20, desc: '20% chance to apply random debuff each turn' },
  Berserker:    { type: 'rageAura',       value: 0.10, desc: '+10% party ATK when Berserker HP below 50%' },
  DragonKnight: { type: 'defShred',       value: 0.15, desc: 'Reduces all enemy DEF by 15%' },
  Necromancer:  { type: 'partyLifesteal', value: 0.10, desc: '+10% lifesteal for whole party' },
  Devourer:     { type: 'atkSteal',       value: 0.05, desc: 'Steals 5% enemy ATK and adds to party pool' },
  Senku:        { type: 'expBoost',       value: 0.20, desc: '+20% XP and gold for party after clear' }
};

// Combo synergies — checked at dungeon/boss start
const COMBOS = [
  {
    classes: ['Warrior','Paladin'],
    bonus: { type: 'comboHealTank', desc: 'Paladin heals doubled; Warrior absorbs 30% for party' },
    mods: { damageAbsorb: 0.30, healMult: 2.0 }
  },
  {
    classes: ['Mage','Archer'],
    bonus: { type: 'comboCritSplash', desc: 'Archer crits trigger Mage AOE splash; +10% crit damage' },
    mods: { critDamageBonus: 0.10, critTriggerSplash: true }
  },
  {
    classes: ['Assassin','Rogue'],
    bonus: { type: 'comboBurstDisrupt', desc: '+15% crit for both; Rogue debuffs last +1 turn' },
    mods: { critBonus: 0.15, debuffDurationBonus: 1 }
  },
  {
    classes: ['Berserker','DragonKnight'],
    bonus: { type: 'comboBruteForce', desc: 'Enemy DEF shred stacks to 25%; Berserker rage triggers at 60% HP' },
    mods: { defShred: 0.25, rageThreshold: 0.60 }
  },
  {
    classes: ['Necromancer','Devourer'],
    bonus: { type: 'comboDarkPact', desc: 'Lifesteal stacks to 20%; Devourer steals DEF instead of ATK' },
    mods: { lifestealBonus: 0.20, devourerStealsDef: true }
  },
  {
    classes: ['Paladin','DragonKnight'],
    bonus: { type: 'comboHolyDragon', desc: 'DragonKnight gains +15% DEF; Paladin holy skills add Burn' },
    mods: { dragonDefBonus: 0.15, holyAddsBurn: true }
  },
  {
    classes: ['Warrior','Berserker'],
    bonus: { type: 'comboIronRage', desc: 'Berserker survives at 1HP instead of dying; Warrior +10% ATK' },
    mods: { berserkerSurvive: true, warriorAtkBonus: 0.10 }
  },
  {
    classes: ['Mage','Necromancer'],
    bonus: { type: 'comboDarkMagic', desc: 'Necromancer lifesteal applies to Mage AOE hits' },
    mods: { aoeLifesteal: true }
  },
  {
    classes: ['Archer','Assassin'],
    bonus: { type: 'comboDeadlyDuo', desc: 'Assassin first strike is guaranteed crit; Archer +5% crit' },
    mods: { firstStrikeCrit: true, archerCritBonus: 0.05 }
  }
];

// Build active bonuses for a party composition
function getPartyBonuses(members) {
  const classes = members.map(m => {
    const c = m.class;
    return typeof c === 'string' ? c : c?.name || 'Warrior';
  });

  const bonuses = {
    roles: [],
    combos: [],
    mods: {}
  };

  // Role bonuses
  for (const cls of classes) {
    const role = ROLE_BONUSES[cls];
    if (role) bonuses.roles.push({ class: cls, ...role });
  }

  // Combo synergies
  for (const combo of COMBOS) {
    const hasAll = combo.classes.every(c => classes.includes(c));
    if (hasAll) {
      bonuses.combos.push(combo);
      Object.assign(bonuses.mods, combo.mods);
    }
  }

  // Role mods
  for (const role of bonuses.roles) {
    bonuses.mods[role.type] = role.value;
  }

  return bonuses;
}

// Get role info for a class
function getRole(className) {
  return ROLES[className] || { role: 'Fighter', emoji: '⚔️' };
}

// Build party bonus summary string for display
function formatBonusSummary(bonuses) {
  if (!bonuses.roles.length && !bonuses.combos.length) return '';
  let msg = '\n⚔️ *PARTY BONUSES ACTIVE*\n';
  for (const r of bonuses.roles) {
    msg += `${ROLES[r.class]?.emoji || '⚔️'} ${r.class} [${ROLES[r.class]?.role}]: ${r.desc}\n`;
  }
  for (const c of bonuses.combos) {
    msg += `✨ *COMBO* ${c.classes.join(' + ')}: ${c.bonus.desc}\n`;
  }
  return msg;
}

module.exports = { ROLES, ROLE_BONUSES, COMBOS, getPartyBonuses, getRole, formatBonusSummary };
