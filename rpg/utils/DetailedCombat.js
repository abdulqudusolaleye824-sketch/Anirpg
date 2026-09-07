// ═══════════════════════════════════════════════════════════════
// ULTRA-DETAILED POKEMON-STYLE COMBAT SYSTEM - FIXED
// ═══════════════════════════════════════════════════════════════

const SkillDescriptions = require('./SkillDescriptions');

// ═══════════════════════════════════════════════════════════════
// SKILL TYPE DEFINITIONS (Like Pokemon Types)
// ═══════════════════════════════════════════════════════════════
const SKILL_TYPES = {
  // Mage Skills
  'Fireball': { type: 'Fire', emoji: '🔥', pp: 10 },
  'Ice Shard': { type: 'Ice', emoji: '❄️', pp: 12 },
  'Lightning Bolt': { type: 'Lightning', emoji: '⚡', pp: 10 },
  'Arcane Missile': { type: 'Arcane', emoji: '✨', pp: 15 },
  'Meteor Strike': { type: 'Fire', emoji: '☄️', pp: 5 },
  'Blizzard': { type: 'Ice', emoji: '🌨️', pp: 5 },
  'Chain Lightning': { type: 'Lightning', emoji: '⚡', pp: 8 },
  'Time Stop': { type: 'Arcane', emoji: '⏰', pp: 3 },
  
  // Warrior Skills
  'Power Strike': { type: 'Physical', emoji: '⚔️', pp: 15 },
  'Whirlwind': { type: 'Physical', emoji: '🌪️', pp: 10 },
  'Shield Bash': { type: 'Physical', emoji: '🛡️', pp: 12 },
  'Rage': { type: 'Buff', emoji: '😤', pp: 5 },
  'Earthquake': { type: 'Ground', emoji: '🌍', pp: 5 },
  'Berserker Rage': { type: 'Buff', emoji: '💢', pp: 3 },
  'Execute': { type: 'Physical', emoji: '🗡️', pp: 5 },
  'Last Stand': { type: 'Buff', emoji: '🛡️', pp: 3 },
  
  // Assassin Skills
  'Backstab': { type: 'Dark', emoji: '🗡️', pp: 15 },
  'Shadow Step': { type: 'Dark', emoji: '🌑', pp: 10 },
  'Poison Blade': { type: 'Poison', emoji: '☠️', pp: 12 },
  'Poison Dagger': { type: 'Poison', emoji: '☠️', pp: 12 },
  'Smoke Bomb': { type: 'Dark', emoji: '💨', pp: 8 },
  'Death Mark': { type: 'Dark', emoji: '💀', pp: 5 },
  'Assassination': { type: 'Dark', emoji: '🎯', pp: 3 },
  'Shadow Clone': { type: 'Dark', emoji: '👥', pp: 5 },
  'Void Strike': { type: 'Void', emoji: '🌌', pp: 3 },
  'Lethal Strike': { type: 'Dark', emoji: '💀', pp: 10 },
  
  // Necromancer Skills
  'Life Drain': { type: 'Dark', emoji: '🩸', pp: 12 },
  'Summon Undead': { type: 'Death', emoji: '☠️', pp: 8 },
  'Bone Spear': { type: 'Death', emoji: '🦴', pp: 10 },
  'Corpse Explosion': { type: 'Death', emoji: '💥', pp: 8 },
  'Death Coil': { type: 'Death', emoji: '🌀', pp: 5 },
  'Army of the Dead': { type: 'Death', emoji: '👻', pp: 3 },
  'Soul Harvest': { type: 'Dark', emoji: '👻', pp: 5 },
  'Lich Form': { type: 'Death', emoji: '💀', pp: 2 },
  
  // Paladin Skills
  'Holy Strike': { type: 'Holy', emoji: '✝️', pp: 12 },
  'Divine Shield': { type: 'Holy', emoji: '🛡️', pp: 5 },
  'Smite': { type: 'Holy', emoji: '⚡', pp: 10 },
  'Consecration': { type: 'Holy', emoji: '✨', pp: 8 },
  'Judgment': { type: 'Holy', emoji: '⚖️', pp: 5 },
  'Holy Wrath': { type: 'Holy', emoji: '☀️', pp: 3 },
  'Divine Storm': { type: 'Holy', emoji: '🌟', pp: 5 },
  'Avenging Wrath': { type: 'Holy', emoji: '😇', pp: 2 }
};

// ═══════════════════════════════════════════════════════════════
// HELPER: Convert skill display name to database key
// ═══════════════════════════════════════════════════════════════
function convertSkillName(displayName) {
  const nameMap = {
    'Poison Dagger': 'poisonDagger',
    'Poison Blade': 'poisonBlade',
    'Shadow Strike': 'shadowStrike',
    'Lethal Strike': 'lethalStrike',
    'Backstab': 'backstab',
    'Smoke Bomb': 'smokeBomb',
    'Fireball': 'fireball',
    'Ice Shard': 'iceShard',
    'Lightning Bolt': 'lightningBolt',
    'Arcane Blast': 'arcaneBlast',
    'Holy Smite': 'holySmite',
    'Divine Shield': 'divineShield',
    'Healing Light': 'healingLight',
    'Judgement': 'judgement',
    'Armor Break': 'armorBreak',
    'Shield Bash': 'shieldBash',
    'Taunt': 'taunt',
    'Last Stand': 'lastStand',
    'Power Shot': 'powerShot',
    'Multi Shot': 'multiShot',
    'Aimed Shot': 'aimedShot',
    'Trap': 'trap',
    'Healing Touch': 'healingTouch',
    'Nature\'s Wrath': 'naturesWrath',
    'Entangle': 'entangle',
    'Wild Growth': 'wildGrowth',
    'Berserk': 'berserk',
    'Whirlwind': 'whirlwind',
    'Battle Cry': 'battleCry',
    'Execute': 'execute',
    'Dark Pact': 'darkPact',
    'Soul Drain': 'soulDrain',
    'Curse': 'curse',
    'Shadow Bolt': 'shadowBolt',
    'Stealth': 'stealth',
    'Critical Strike': 'criticalStrike',
    'Poison': 'poison',
    'Dual Strike': 'dualStrike'
  };
  
  return nameMap[displayName] || displayName;
}

// ═══════════════════════════════════════════════════════════════
// GET SKILL TYPE INFO
// ═══════════════════════════════════════════════════════════════
function getSkillInfo(skillName) {
  return SKILL_TYPES[skillName] || { type: 'Normal', emoji: '⚪', pp: 10 };
}

// ═══════════════════════════════════════════════════════════════
// GENERATE BATTLE START MENU (Pokemon-style)
// ═══════════════════════════════════════════════════════════════
function getBattleStartMenu(player, enemy, isPlayer1Turn = true) {
  const currentTurn = isPlayer1Turn ? player.name : enemy.name;
  
  let menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  menu += `⚔️ BATTLE IN PROGRESS\n`;
  menu += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // Player Status
  menu += `👤 ${player.name}  Lv. ${player.level}\n`;
  menu += `❤️ HP: ${player.currentHP || player.stats.maxHp} / ${player.stats.maxHp}\n\n`;
  
  menu += `VS\n\n`;
  
  // Enemy Status
  menu += `👹 ${enemy.name}  Lv. ${enemy.level}\n`;
  menu += `❤️ HP: ${enemy.currentHP || enemy.maxHp} / ${enemy.maxHp}\n`;
  
  menu += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  menu += `⏰ ${currentTurn}'s turn!\n`;
  menu += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  menu += `Use one of the options given below @${player.phoneNumber}\n`;
  menu += `- To fight use /pvp attack\n`;
  menu += `- To use skills use /pvp skills\n`;
  menu += `- To use items use /battle items\n`;
  menu += `- To run away use /battle run\n`;
  
  return menu;
}

// ═══════════════════════════════════════════════════════════════
// GET SKILLS MENU (Pokemon Move List Style)
// ═══════════════════════════════════════════════════════════════
function getDetailedSkillsMenu(player) {
  let menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  menu += `📖 ${player.name}'s Skills\n`;
  menu += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  if (!player.skills?.active || player.skills.active.length === 0) {
    menu += `❌ No skills learned yet!\n`;
    return menu;
  }
  
  player.skills.active.forEach((skill, index) => {
    const skillInfo = getSkillInfo(skill.name);
    const skillKey = convertSkillName(skill.name);
    const skillData = SkillDescriptions.getSkillDescription(skillKey);
    
    menu += `#${index + 1}\n`;
    menu += `❓ Skill: ${skillInfo.emoji} ${skill.name}\n`;
    menu += `〽 PP: ${skillInfo.pp}\n`;
    menu += `🎗 Type: ${skillInfo.type}\n`;
    menu += `🎃 Power: ${skill.damage}\n`;
    menu += `💙 ${player.energyType} Cost: ${skill.energyCost}\n`;
    menu += `🎐 Cooldown: ${skill.cooldown || 0}s\n`;
    
    if (skillData && skillData.effect) {
      menu += `🧧 Description: ${skillData.effect}\n`;
    }
    
    menu += `\nUse /battle use ${index + 1} to use this skill.\n`;
    menu += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  });
  
  menu += `\n💙 ${player.energyType}: ${player.stats.energy}/${player.stats.maxEnergy}`;
  
  return menu;
}

// ═══════════════════════════════════════════════════════════════
// GENERATE ATTACK NARRATIVE (Ultra Detailed)
// ═══════════════════════════════════════════════════════════════
function generateAttackNarrative(attacker, defender, damage, isCrit = false) {
  let narrative = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  narrative += `⚔️ ${attacker.name} used Basic Attack!\n`;
  
  if (isCrit) {
    narrative += `💥 CRITICAL HIT!\n`;
  }
  
  narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  narrative += `💥 Dealt ${damage} damage to ${defender.name}!\n`;
  narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // HP Status
  narrative += `👤 ${attacker.name}: ❤️ ${attacker.currentHP}/${attacker.stats?.maxHp || attacker.maxHp}\n`;
  narrative += `👹 ${defender.name}: ❤️ ${Math.max(0, defender.currentHP)}/${defender.maxHp || defender.stats?.maxHp}\n`;
  
  return narrative;
}

// ═══════════════════════════════════════════════════════════════
// GENERATE SKILL NARRATIVE - FIXED TO SHOW ANIMATIONS!
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// GENERATE SKILL NARRATIVE - FINAL FIX
// Replace this function in your DetailedCombat.js
// ═══════════════════════════════════════════════════════════════
function generateSkillNarrative(attacker, defender, skill, damage, isCrit = false, effects = null) {
  const skillInfo = getSkillInfo(skill.name);
  
  // ✅ FIX: Get className and pass it to getSkillDescription
  const className = attacker.class?.name || attacker.class || 'Warrior';
  const skillData = SkillDescriptions.getSkillDescription(className, skill.name);
  
  let narrative = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  narrative += `✨ ${attacker.name} used ${skill.name}!\n`;
  narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  // ✅ Use .animation property for combat description
  if (skillData && skillData.animation) {
    narrative += skillData.animation + '\n';
  } else if (skillData && skillData.description) {
    narrative += skillData.description + '\n';
  } else {
    // Fallback
    narrative += `✨ You channel your power...\n`;
    narrative += `💥 The attack connects!\n`;
    narrative += `⚡ Devastating impact!\n`;
  }
  
  narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  if (isCrit) {
    narrative += `💥 CRITICAL HIT!\n`;
  }
  
  narrative += `💥 Dealt ${damage} damage to ${defender.name}!\n`;
  narrative += `💙 ${attacker.energyType}: ${attacker.stats.energy}/${attacker.stats.maxEnergy}\n`;
  
  // Additional Effects
  if (effects) {
    narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    narrative += `✨ Additional Effects:\n`;
    
    if (effects.statChanges) {
      effects.statChanges.forEach(change => {
        narrative += `📊 ${change.stat} of ${change.target} ${change.change > 0 ? 'rose' : 'fell'} by ${Math.abs(change.change)}\n`;
      });
    }
    
    if (effects.healing) {
      narrative += `💚 ${attacker.name} restored ${effects.healing} HP\n`;
    }
    
    if (effects.statusEffect) {
      narrative += `🌀 ${defender.name} is now ${effects.statusEffect}!\n`;
    }
  }
  
  narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // HP and Energy Status
  narrative += `👤 ${attacker.name}:\n`;
  narrative += `   ❤️ HP: ${attacker.currentHP}/${attacker.stats?.maxHp || attacker.maxHp}\n`;
  narrative += `   💙 ${attacker.energyType}: ${attacker.stats.energy}/${attacker.stats.maxEnergy}\n\n`;
  narrative += `👹 ${defender.name}:\n`;
  narrative += `   ❤️ HP: ${Math.max(0, defender.currentHP)}/${defender.maxHp || defender.stats?.maxHp}\n`;
  
  return narrative;
}
// ═══════════════════════════════════════════════════════════════
// GENERATE FAINT MESSAGE
// ═══════════════════════════════════════════════════════════════
function generateFaintMessage(defeated, winner) {
  let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💀 ${defeated.name} fainted!\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `🏆 ${winner.name} won the battle!\n`;
  
  return message;
}

// ═══════════════════════════════════════════════════════════════
// GENERATE XP GAIN MESSAGE
// ═══════════════════════════════════════════════════════════════
function generateXPGainMessage(player, xpGained, leveledUp = false, newLevel = 0) {
  let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `✨ ${player.name} gained ${xpGained} XP\n`;
  
  if (leveledUp) {
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🎉 ${player.name} grew to Level ${newLevel}!\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📊 Stats increased!\n`;
    message += `   ❤️ HP: +${Math.floor(newLevel * 5)}\n`;
    message += `   ⚔️ ATK: +${Math.floor(newLevel * 2)}\n`;
    message += `   🛡️ DEF: +${Math.floor(newLevel * 1.5)}\n`;
  }
  
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  return message;
}

// ═══════════════════════════════════════════════════════════════
// SKILL LEARNING PROMPT (Pokemon Style)
// ═══════════════════════════════════════════════════════════════
function generateSkillLearnPrompt(player, newSkill, currentSkills) {
  if (currentSkills.length < 4) {
    return null; // Auto-learn if less than 4 skills
  }
  
  const skillInfo = getSkillInfo(newSkill.name);
  const skillKey = convertSkillName(newSkill.name);
  const skillData = SkillDescriptions.getSkillDescription(skillKey);
  
  let prompt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  prompt += `🎓 SKILL LEARNING\n`;
  prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  prompt += `@${player.phoneNumber}, your Hunter ${player.name} is trying to learn ${newSkill.name}.\n`;
  prompt += `But a Hunter can't learn more than 4 skills.\n`;
  prompt += `Delete a skill to learn this new one.\n`;
  prompt += `[This will automatically be cancelled if you don't continue within 60 seconds]\n\n`;
  
  prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  prompt += `📝 New Skill Details\n`;
  prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  prompt += `❓ Skill: ${skillInfo.emoji} ${newSkill.name}\n`;
  prompt += `〽 PP: ${skillInfo.pp}\n`;
  prompt += `🎗 Type: ${skillInfo.type}\n`;
  prompt += `🎃 Power: ${newSkill.damage}\n`;
  prompt += `💙 ${player.energyType} Cost: ${newSkill.energyCost}\n`;
  
  if (skillData && skillData.effect) {
    prompt += `🧧 Description: ${skillData.effect}\n\n`;
  }
  
  prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  prompt += `Current Skills | ${player.name}\n`;
  prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  currentSkills.forEach((skill, index) => {
    const info = getSkillInfo(skill.name);
    const key = convertSkillName(skill.name);
    const description = SkillDescriptions.getSkillDescription(key);
    
    prompt += `\n#${index + 1}\n`;
    prompt += `❓ Skill: ${info.emoji} ${skill.name}\n`;
    prompt += `〽 PP: ${info.pp}\n`;
    prompt += `🎗 Type: ${info.type}\n`;
    prompt += `🎃 Power: ${skill.damage}\n`;
    prompt += `💙 ${player.energyType} Cost: ${skill.energyCost}\n`;
    
    if (description && description.effect) {
      prompt += `🧧 Description: ${description.effect}\n`;
    }
    
    prompt += `\nUse /learn ${index + 1} to delete this skill and learn the new one.\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  });
  
  prompt += `\nUse /learn cancel if you don't want to learn ${newSkill.name}.`;
  
  return prompt;
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════
module.exports = {
  getSkillInfo,
  getBattleStartMenu,
  getDetailedSkillsMenu,
  generateAttackNarrative,
  generateSkillNarrative,
  generateFaintMessage,
  generateXPGainMessage,
  generateSkillLearnPrompt,
  SKILL_TYPES
};