// ═══════════════════════════════════════════════════════════════
// STAT ALLOCATION SYSTEM - Balanced Progression
// ═══════════════════════════════════════════════════════════════

// Push #103f: every UP source DOUBLED (level-up 10, raid boss 50…) and allocation caps raised by 110%.
const UP_REWARDS = {
  dungeonClear: { easy: 6, medium: 10, hard: 16, nightmare: 24 },
  bossDefeat: { miniBoss: 10, raidBoss: 50, legendaryBoss: 80 },
  pvpWin: 8,
  pvpRanked: 16,
  levelUp: 10,
  questComplete: { story: 6, side: 4, daily: 2, weekly: 10 },
  achievement: 20
};
const CAP_MULT = 2.1; // Push #103f: allocation thresholds +110%

// 10-26 (owner): per-point values ×2.5 (HP 10→25, ATK/DEF 2→5, MAGIC/MR 3→7, SPD 1→2) to match the rank ladder;
// HP/ATK/DEF/MAGIC points also ride the awakening-rank multiplier (Push #103j).
const STAT_CONFIG = {
  hp: {
    name: 'HP', emoji: '❤️', description: 'Maximum Health Points',
    costPerPoint: 1, valuePerPoint: 25, baseMax: 50,
    recommended: 'Tank, Paladin'
  },
  atk: {
    name: 'ATK', emoji: '⚔️', description: 'Physical Attack Power',
    costPerPoint: 1, valuePerPoint: 5, baseMax: 40,
    recommended: 'Warrior, Berserker, Assassin'
  },
  def: {
    name: 'DEF', emoji: '🛡️', description: 'Physical Defense',
    costPerPoint: 1, valuePerPoint: 5, baseMax: 40,
    recommended: 'Paladin, Warrior'
  },
  magicPower: {
    name: 'MAGIC', emoji: '✨', description: 'Magic Attack Power',
    costPerPoint: 1, valuePerPoint: 7, baseMax: 30,
    recommended: 'Mage, Necromancer'
  },
  magicResist: { // Push #103b
    name: 'MAGIC RES', emoji: '🔰', description: 'Magic Resistance — resists statuses/debuffs when above the caster\'s Magic Power',
    costPerPoint: 1, valuePerPoint: 7, baseMax: 30,
    recommended: 'Knight, Paladin, Druid, Monk'
  },
  speed: {
    name: 'SPEED', emoji: '💨', description: 'Attack Speed & Dodge',
    costPerPoint: 2, valuePerPoint: 2, baseMax: 25,
    recommended: 'Assassin, Archer'
  },
  critChance: {
    name: 'CRIT', emoji: '💥', description: 'Critical Hit Chance (%)',
    costPerPoint: 3, valuePerPoint: 1, baseMax: 8,
    recommended: 'Assassin, Archer'
  },
  critDamage: {
    name: 'CRIT DMG', emoji: '🔥', description: 'Critical Damage Multiplier (%)',
    costPerPoint: 3, valuePerPoint: 2, baseMax: 12,
    recommended: 'Assassin, Berserker'
  },
  lifesteal: {
    name: 'LIFESTEAL', emoji: '💚', description: 'HP Drain on Hit (%)',
    costPerPoint: 4, valuePerPoint: 1, baseMax: 5,
    recommended: 'Necromancer, Devourer'
  },
  energy: {
    name: 'ENERGY', emoji: '⚡', description: 'Maximum Energy Capacity (+5 per point)',
    costPerPoint: 1, valuePerPoint: 5, baseMax: 50,
    recommended: 'All Classes'
  }
};

// ─── Dynamic allocation cap: scales with player level ────────────────────────
// Formula: baseMax + floor(level * scaleFactor)
// This means the cap grows as the player levels up.
const STAT_SCALE_FACTOR = {
  hp:          3.0,   // +3 per level
  atk:         2.0,   // +2 per level
  def:         2.0,
  magicPower:  1.5,
  magicResist: 1.5,
  speed:       1.0,
  critChance:  0.2,
  critDamage:  0.4,
  lifesteal:   0.15,
  energy:      3.0
};

function getMaxAllocations(statName, level = 1) {
  const config = STAT_CONFIG[statName];
  if (!config) return 0;
  const scale = STAT_SCALE_FACTOR[statName] || 1;
  return Math.floor((config.baseMax + Math.floor(level * scale)) * CAP_MULT);
}

function initializeStatAllocations(player) {
  if (!player.statAllocations) {
    player.statAllocations = {
      hp: 0, atk: 0, def: 0, magicPower: 0, magicResist: 0,
      speed: 0, critChance: 0, critDamage: 0, lifesteal: 0
    };
  }
  if (player.upgradePoints === undefined) {
    player.upgradePoints = Math.floor(player.level * 2);
  }
  return player;
}

function awardUpgradePoints(player, source, difficulty = null) {
  initializeStatAllocations(player);
  
  let pointsAwarded = 0;
  switch(source) {
    case 'dungeon': pointsAwarded = UP_REWARDS.dungeonClear[difficulty] || 3; break;
    case 'boss': pointsAwarded = UP_REWARDS.bossDefeat[difficulty] || 5; break;
    case 'pvp': pointsAwarded = UP_REWARDS.pvpWin; break;
    case 'pvpRanked': pointsAwarded = UP_REWARDS.pvpRanked; break;
    case 'levelUp': pointsAwarded = UP_REWARDS.levelUp; break;
    case 'quest': pointsAwarded = UP_REWARDS.questComplete[difficulty] || 2; break;
    case 'achievement': pointsAwarded = UP_REWARDS.achievement; break;
    default: pointsAwarded = 2;
  }
  
  player.upgradePoints = (player.upgradePoints || 0) + pointsAwarded;
  
  return {
    awarded: pointsAwarded,
    total: player.upgradePoints,
    message: `\n✨ +${pointsAwarded} Upgrade Point${pointsAwarded > 1 ? 's' : ''}! (Total: ${player.upgradePoints} UP)`
  };
}

function allocateStat(player, statName, amount = 1) {
  initializeStatAllocations(player);
  const UI = require('./UI');
  const aPro = UI.isPro(player || {});
  const FRAME = aPro ? UI.PRO_BAR : UI.FREE_BAR;
  
  const statConfig = STAT_CONFIG[statName];
  if (!statConfig) return { success: false, message: `❌ Invalid stat: ${statName}` };
  
  const currentAllocations = player.statAllocations[statName] || 0;
  const maxAlloc = getMaxAllocations(statName, player.level || 1);
  if (currentAllocations >= maxAlloc) {
    return { success: false, message: `❌ ${statConfig.name} is already maxed at your level! (${currentAllocations}/${maxAlloc})\nLevel up to increase the cap!` };
  }
  
  const remainingCap = maxAlloc - currentAllocations;
  if (amount > remainingCap) {
    return { success: false, message: `❌ Can only allocate ${remainingCap} more point${remainingCap > 1 ? 's' : ''} to ${statConfig.name}!` };
  }
  
  const totalCost = statConfig.costPerPoint * amount;
  if (player.upgradePoints < totalCost) {
    return { success: false, message: `❌ Not enough Upgrade Points!\n\nNeed: ${totalCost} UP\nHave: ${player.upgradePoints} UP` };
  }
  
  player.upgradePoints -= totalCost;
  player.statAllocations[statName] = currentAllocations + amount;
  
  let statIncrease = statConfig.valuePerPoint * amount;
  try { const RP = require('./RankPower'); if (RP.STATS.includes(statName)) statIncrease = Math.round(statIncrease * RP.mult(player)); } catch (e) {} // Push #103j (BUG-140): the card shows the real, rank-scaled gain
  applyAllocationsToStats(player);
  
  return {
    success: true,
    message: (aPro ? `${UI.PRO_BAR}\n✅ STAT ALLOCATED! 💎\n${UI.PRO_BAR}\n\n${statConfig.emoji} ${statConfig.name} +${statIncrease}\n\n${UI.PRO_BAR}\n📊 ALLOCATIONS\n${UI.PRO_BAR}\n${statConfig.name}: ${player.statAllocations[statName]}/${maxAlloc} (Lv.${player.level} cap)\n\n💎 Upgrade Points Spent: ${totalCost}\n💎 Remaining: ${player.upgradePoints} UP\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO STATS* — +${statIncrease} ${statConfig.name}` : `✅ STAT ALLOCATED!\n${UI.FREE_BAR}\n\n${statConfig.emoji} ${statConfig.name} +${statIncrease}\n\n${UI.FREE_BAR}\n📊 ALLOCATIONS\n${UI.FREE_BAR}\n${statConfig.name}: ${player.statAllocations[statName]}/${maxAlloc} (Lv.${player.level} cap)\n\n💎 Upgrade Points Spent: ${totalCost}\n💎 Remaining: ${player.upgradePoints} UP\n${UI.FREE_BAR}\n${UI.upsell()}`),
    statIncrease,
    totalCost,
    remaining: player.upgradePoints
  };
}

function applyAllocationsToStats(player) {
  if (!player.statAllocations) return;
  
  // ✅ FIX: Only set baseStats if it doesn't exist yet - never overwrite existing
  if (!player.baseStats) {
    player.baseStats = {
      hp: player.stats.maxHp || 100,
      atk: player.stats.atk || 10,
      def: player.stats.def || 5,
      magicPower: player.stats.magicPower || 0,
      speed: player.stats.speed || 100,
      critChance: player.stats.critChance || 0,
      critDamage: player.stats.critDamage || 0,
      lifesteal: player.stats.lifesteal || 0,
      maxEnergy: player.stats.maxEnergy || 100
    };
  }
  // Ensure existing baseStats has maxEnergy (for players created before this patch)
  if (!player.baseStats.maxEnergy) {
    // Only set if no energy has been allocated yet
    const energyAllocated = player.statAllocations?.energy || 0;
    const energyConfig = STAT_CONFIG['energy'];
    const allocBonus = energyAllocated * (energyConfig?.valuePerPoint || 5);
    player.baseStats.maxEnergy = Math.max(1, (player.stats.maxEnergy || 100) - allocBonus);
  }
  
  // Push #103h: awakening-rank power layer (E×1 … S×42.9) on base HP/ATK/DEF/Magic — see RankPower.js.
  const _hp0 = Number(player.stats.hp); // Fix (10-26): re-cap HP only AFTER an active transformation is re-laid (else the form's HP pool is lost)
  let _rm = 1; try { _rm = require('./RankPower').mult(player); } catch (e) { _rm = 1; }
  const _rk = (k, v) => (_rm !== 1 && require('./RankPower').STATS.includes(k)) ? Math.round(v * _rm) : v;
  for (const k of ['hp', 'atk', 'def', 'magicPower']) if (player.statAllocations[k] == null) player.statAllocations[k] = 0; // every rank-scaled stat is recomputed
  for (const [statName, allocations] of Object.entries(player.statAllocations)) {
    const config = STAT_CONFIG[statName];
    if (!config) continue;
    
    const bonus = allocations * config.valuePerPoint;
    
    if (statName === 'hp') {
      player.stats.maxHp = _rk('hp', (player.baseStats.hp || 100) + bonus); // Push #103j (BUG-140): allocated points ride the rank multiplier too
      let _cap = player.stats.maxHp;
      try { _cap = require('./GearSystem').effectiveMaxHp(player); } catch (e) {}
      if (player.stats.hp > _cap) player.stats.hp = _cap;
    } else if (statName === 'energy') {
      const baseEnergy = player.baseStats.maxEnergy || player.stats.maxEnergy || 100;
      player.stats.maxEnergy = baseEnergy + bonus;
      if (player.stats.energy > player.stats.maxEnergy) {
        player.stats.energy = player.stats.maxEnergy;
      }
    } else {
      player.stats[statName] = _rk(statName, (player.baseStats[statName] || 0) + bonus); // Push #103j (BUG-140): rank-scaled stats scale their allocations
    }
  }
  try { if (player.transform && require('./Transformation').reapply(player) && Number.isFinite(_hp0)) { let cap = player.stats.maxHp; try { cap = require('./GearSystem').effectiveMaxHp(player); } catch (e) {} player.stats.hp = Math.min(_hp0, cap); } } catch (e) {} // Fix (10-26): keep an active form's bonus after a rebuild
}

function resetAllocations(player) {
  initializeStatAllocations(player);
  const UI = require('./UI');
  const rPro = UI.isPro(player || {});
  const FRAME = rPro ? UI.PRO_BAR : UI.FREE_BAR;
  
  let totalPointsSpent = 0;
  for (const [statName, allocations] of Object.entries(player.statAllocations)) {
    const config = STAT_CONFIG[statName];
    if (config) totalPointsSpent += allocations * config.costPerPoint;
  }
  
  if (totalPointsSpent === 0) {
    return { success: false, message: '❌ You have no stat allocations to reset!' };
  }
  
  const resetCost = 200000; // Push #88e: flat 200k Nexus
  if ((player.gold || 0) < resetCost) {
    return { success: false, message: `❌ Not enough Nexus to reset stats!\n\nCost: ${resetCost.toLocaleString()} 💠\nYou have: ${player.gold || 0} 💠` };
  }
  
  player.gold -= resetCost;
  try { require('./TransactionLog').logSpend(player, 'stat_reset', resetCost, 0); } catch (e) {}
  player.upgradePoints = (player.upgradePoints || 0) + totalPointsSpent;
  player.statAllocations = { hp: 0, atk: 0, def: 0, magicPower: 0, magicResist: 0, speed: 0, critChance: 0, critDamage: 0, lifesteal: 0, energy: 0 };
  
  applyAllocationsToStats(player);
  
  return {
    success: true,
    message: (rPro ? `${UI.PRO_BAR}\n♻️ STATS RESET! 💎\n${UI.PRO_BAR}\n\n💠 Cost: ${resetCost} 💠\n💎 Refunded: ${totalPointsSpent} UP\n\n${UI.PRO_BAR}\nAll stat allocations have been reset!\nYou can now re-allocate your points.\n\n💎 Upgrade Points: ${player.upgradePoints} UP\n💠 Remaining Nexus: ${player.gold} 💠\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO STATS* — ${totalPointsSpent} UP refunded` : `♻️ STATS RESET!\n${UI.FREE_BAR}\n\n💠 Cost: ${resetCost} 💠\n💎 Refunded: ${totalPointsSpent} UP\n\n${UI.FREE_BAR}\nAll stat allocations have been reset!\nYou can now re-allocate your points.\n\n💎 Upgrade Points: ${player.upgradePoints} UP\n💠 Remaining Nexus: ${player.gold} 💠\n${UI.FREE_BAR}\n${UI.upsell()}`),
    pointsRefunded: totalPointsSpent,
    goldSpent: resetCost
  };
}

function getStatAllocationDisplay(player) {
  initializeStatAllocations(player);
  const UI = require('./UI');
  const dPro = UI.isPro(player || {});
  const FRAME = dPro ? UI.PRO_BAR : UI.FREE_BAR;
  const className = (player.class && typeof player.class === 'object') ? player.class.name : (player.class || 'Unawakened');
  
  let display = dPro ? `${UI.PRO_BAR}\n💎 STAT ALLOCATION SYSTEM 💎\n${UI.PRO_BAR}\n\n👤 ${player.name} | ${className} Lv.${player.level}\n💎 Upgrade Points: ${player.upgradePoints} UP\n\n${UI.PRO_BAR}\n📊 CURRENT ALLOCATIONS\n${UI.PRO_BAR}\n\n` : `💎 STAT ALLOCATION SYSTEM\n${UI.FREE_BAR}\n\n👤 ${player.name} | ${className} Lv.${player.level}\n💎 Upgrade Points: ${player.upgradePoints} UP\n\n${UI.FREE_BAR}\n📊 CURRENT ALLOCATIONS\n${UI.FREE_BAR}\n\n`;

  for (const [statName, config] of Object.entries(STAT_CONFIG)) {
    const maxAlloc = getMaxAllocations(statName, player.level || 1);
    const allocations = player.statAllocations[statName] || 0;
    const totalBonus = allocations * config.valuePerPoint;
    const percentage = Math.floor((allocations / maxAlloc) * 100);
    
    display += `${config.emoji} ${config.name}\n`;
    display += `   Allocated: ${allocations}/${maxAlloc} [Lv.${player.level} cap (${percentage}%)\n`;
    display += `   Bonus: +${totalBonus}${statName.includes('Chance') || statName.includes('Damage') || statName === 'lifesteal' ? '%' : ''}\n`;
    display += `   Cost: ${config.costPerPoint} UP per point\n\n`;
  }
  
  display += `${FRAME}\n📜 COMMANDS\n${FRAME}\n/upgrade allocate <stat> <amount>\n  Example: /upgrade allocate atk 5\n\n/upgrade reset\n  Reset all allocations (costs 200,000 💠)\n\n/upgrade guide\n  See stat recommendations\n${FRAME}` + (dPro ? `\n${UI.PRO_MINI}\n💎 *PRO STATS* — ${player.upgradePoints} UP banked` : `\n${UI.upsell()}`);

  return display;
}

function getStatGuide(playerClass, player = null) {
  const UI = require('./UI');
  const gPro = UI.isPro(player || {});
  const FRAME = gPro ? UI.PRO_BAR : UI.FREE_BAR;
  const className = (playerClass && typeof playerClass === 'object') ? playerClass.name : (playerClass || 'Unawakened');
  
  const guides = {
    Warrior: { priority: ['atk', 'hp', 'def', 'critDamage'], description: 'Focus on ATK and HP for sustained damage and survivability.' },
    Mage: { priority: ['magicPower', 'hp', 'critChance', 'speed'], description: 'Maximize MAGIC power, with HP for survivability.' },
    Assassin: { priority: ['critChance', 'critDamage', 'atk', 'speed'], description: 'Stack CRIT and SPEED for devastating burst damage.' },
    Archer: { priority: ['atk', 'critChance', 'speed', 'critDamage'], description: 'Balance ATK, CRIT, and SPEED for consistent DPS.' },
    Paladin: { priority: ['hp', 'def', 'atk', 'lifesteal'], description: 'Tank stats first (HP/DEF), then ATK for damage.' },
    Berserker: { priority: ['atk', 'critDamage', 'lifesteal', 'hp'], description: 'All-in on ATK and CRIT DMG with lifesteal sustain.' },
    Necromancer: { priority: ['magicPower', 'hp', 'lifesteal', 'def'], description: 'MAGIC and lifesteal for dark magic sustain.' },
    Devourer: { priority: ['lifesteal', 'atk', 'hp', 'critDamage'], description: 'Lifesteal-focused build with high ATK.' }
  };
  
  const guide = guides[className] || guides.Warrior;
  
  let display = gPro ? `${UI.PRO_BAR}\n📚 STAT GUIDE - ${className} 💎\n${UI.PRO_BAR}\n\n💡 ${guide.description}\n\n${UI.PRO_BAR}\n🎯 RECOMMENDED PRIORITY\n${UI.PRO_BAR}\n\n` : `📚 STAT GUIDE - ${className}\n${UI.FREE_BAR}\n\n💡 ${guide.description}\n\n${UI.FREE_BAR}\n🎯 RECOMMENDED PRIORITY\n${UI.FREE_BAR}\n\n`;

  guide.priority.forEach((stat, index) => {
    const config = STAT_CONFIG[stat];
    if (config) {
      display += `${index + 1}. ${config.emoji} ${config.name}\n`;
      display += `   ${config.description}\n`;
      display += `   Cost: ${config.costPerPoint} UP = +${(() => { try { const RP = require('./RankPower'); return RP.STATS.includes(stat) ? Math.round(config.valuePerPoint * RP.mult(player)) : config.valuePerPoint; } catch (e) { return config.valuePerPoint; } })()} ${config.name}\n\n`;
    }
  });
  
  display += `${FRAME}\n💡 GENERAL TIPS\n${FRAME}\n\n1️⃣ Start with your main damage stat\n2️⃣ Add survivability (HP/DEF)\n3️⃣ Invest in multipliers (CRIT)\n4️⃣ SPEED is expensive but valuable\n5️⃣ Don't be Black!\n${FRAME}` + (gPro ? `\n${UI.PRO_MINI}\n💎 *PRO STATS* — ${className} path` : `\n${UI.upsell()}`);

  return display;
}

function getTotalStats(player) {
  initializeStatAllocations(player);
  applyAllocationsToStats(player);
  return { base: player.baseStats || {}, allocated: player.statAllocations || {}, current: player.stats || {} };
}

function getRecommendations(player) {
  initializeStatAllocations(player);

  const recommendations = [];
  const className = (player.class && typeof player.class === 'object') ? player.class.name : (player.class || 'Unawakened');
  const allocations = player.statAllocations || {};
  const upAvailable = player.upgradePoints || 0;
  
  if (upAvailable === 0) {
    recommendations.push('💎 Earn more Upgrade Points by clearing dungeons, defeating bosses, or winning PVP!');
    return recommendations;
  }
  
  const classGuides = {
    'Warrior': ['atk', 'hp', 'def'],
    'Mage': ['magicPower', 'hp', 'critChance'],
    'Assassin': ['critChance', 'critDamage', 'atk'],
    'Archer': ['atk', 'critChance', 'speed'],
    'Paladin': ['hp', 'def', 'atk'],
    'Berserker': ['atk', 'critDamage', 'lifesteal'],
    'Necromancer': ['magicPower', 'lifesteal', 'hp']
  };
  
  const priority = classGuides[className] || ['atk', 'hp', 'def'];
  const primaryStat = priority[0];
  const primaryAllocations = allocations[primaryStat] || 0;
  const primaryMax = getMaxAllocations(primaryStat, player.level || 1);
  
  if (primaryAllocations < primaryMax * 0.3) {
    const statName = STAT_CONFIG[primaryStat]?.name || primaryStat;
    const cost = STAT_CONFIG[primaryStat]?.costPerPoint || 1;
    const canAfford = Math.floor(upAvailable / cost);
    recommendations.push(`⭐ Focus on ${statName} first! (${primaryAllocations}/${primaryMax} allocated)`);
    recommendations.push(`💡 You can add ${canAfford} points to ${statName} right now!`);
  }
  
  if (player.stats.hp < player.stats.maxHp * 0.3) {
    recommendations.push('⚠️ Your HP is critically low! Use /use or allocate HP points.');
  }
  
  if (upAvailable >= 3) {
    const nextStat = priority.find(stat => {
      const current = allocations[stat] || 0;
      const max = getMaxAllocations(stat, player.level || 1);
      return current < max * 0.7;
    });
    if (nextStat) {
      recommendations.push(`📈 Recommended: /upgrade allocate ${nextStat} 5`);
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ Your stat allocation looks solid!');
    recommendations.push(`💎 You have ${upAvailable} UP available to allocate.`);
  }
  
  return recommendations;
}

// ─── Fix allocation caps for a player (e.g. after /fixskills) ────────────────
// Ensures no stat has more allocations than the current level cap allows.
// If over-cap, excess allocations are refunded as Upgrade Points.
function fixAllocations(player) {
  initializeStatAllocations(player);
  const level = player.level || 1;
  let refunded = 0;
  const log = [];

  for (const statName of Object.keys(STAT_CONFIG)) {
    const current = player.statAllocations[statName] || 0;
    const cap = getMaxAllocations(statName, level);
    if (current > cap) {
      const excess = current - cap;
      const refundPoints = excess * (STAT_CONFIG[statName].costPerPoint || 1);
      player.statAllocations[statName] = cap;
      player.upgradePoints = (player.upgradePoints || 0) + refundPoints;
      refunded += refundPoints;
      log.push(`  🔧 ${STAT_CONFIG[statName].name}: ${current} → ${cap} (+${refundPoints} UP refunded)`);
    }
  }

  if (refunded > 0) applyAllocationsToStats(player);

  return { refunded, log };
}

module.exports = {
  UP_REWARDS,
  STAT_CONFIG,
  getMaxAllocations,
  initializeStatAllocations,
  awardUpgradePoints,
  allocateStat,
  applyAllocationsToStats,
  resetAllocations,
  fixAllocations,
  getStatAllocationDisplay,
  getStatGuide,
  getTotalStats,
  getRecommendations
};