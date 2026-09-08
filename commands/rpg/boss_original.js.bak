// ========================================
// FILE 2: commands/rpg/boss.js - FIXED WITH HP BARS & WORKING SKILLS
// ========================================
const BossManager = require('../../rpg/dungeons/BossManager');
const ImprovedCombat = require('../../rpg/utils/ImprovedCombat');
const { updatePlayerNexus } = require('../../rpg/utils/NexusManager');
const TaxSystem = require('../../rpg/utils/TaxSystem');
const BarSystem = require('../../rpg/utils/BarSystem');
const LevelUpManager = require('../../rpg/utils/LevelUpManager');

module.exports = {
  name: 'boss',
  description: 'Fight powerful boss monsters',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { 
        text: '❌ You are not registered! Use /register first.' 
      }, { quoted: msg });
    }

    const subCommand = args[0]?.toLowerCase();
    const className = typeof player.class === 'string' ? player.class : (player.class?.name || 'Warrior');

    // ============================================
    // SUB-COMMAND: /boss list
    // ============================================
    if (subCommand === 'list') {
      const availableBosses = BossManager.getAvailableBosses(player.level);
      
      if (availableBosses.length === 0) {
        return sock.sendMessage(chatId, { 
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 BOSS BATTLES 👑
━━━━━━━━━━━━━━━━━━━━━━━━━━━
No bosses available at your level!

Keep grinding and level up! 💪
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
        }, { quoted: msg });
      }

      let bossListText = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 AVAILABLE BOSSES 👑
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your Level: ${player.level}
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      availableBosses.forEach((boss, index) => {
        bossListText += `${index + 1}. ${boss.emoji} ${boss.name}\n`;
        bossListText += `   📊 Rank: ${boss.rank}\n`;
        bossListText += `   ⚔ Level: ${boss.minLevel}\n`;
        bossListText += `   💠 Rewards: ~${boss.baseNexusReward || 200}g\n\n`;
      });

      bossListText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Use /boss fight to battle!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: bossListText }, { quoted: msg });
    }

    // ============================================
    // SUB-COMMAND: /boss fight
    // ============================================
    if (subCommand === 'fight' || !subCommand) {
      // Check if player is alive
      if (player.stats.hp <= 0) {
        return sock.sendMessage(chatId, { 
          text: '❌ You are dead! Use a revive token or heal first.' 
        }, { quoted: msg });
      }

      // Check if already in boss battle
      if (player.inBossBattle) {
        const battle = player.currentBossBattle;
        const boss = battle.boss;
        
        const hpBar = BarSystem.getHPBar(player.stats.hp, player.stats.maxHp);
        const energyBar = BarSystem.getEnergyBar(player.stats.energy, player.stats.maxEnergy, className);
        const bossHPBar = BarSystem.getMonsterHPBar(boss);

        const menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ BOSS BATTLE IN PROGRESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 ${player.name}
❤️ HP: ${player.stats.hp}/${player.stats.maxHp}
${hpBar}

${player.energyColor || '💙'} ${player.energyType || 'Energy'}: ${player.stats.energy}/${player.stats.maxEnergy}
${energyBar}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

${boss.emoji} ${boss.name}
${bossHPBar}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 COMMANDS
/boss attack - Basic attack
/boss use [skill name] - Use skill
/boss flee - Retreat
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        return sock.sendMessage(chatId, { text: menu }, { quoted: msg });
      }

      // Get available bosses
      const availableBosses = BossManager.getAvailableBosses(player.level);
      
      if (availableBosses.length === 0) {
        return sock.sendMessage(chatId, { 
          text: `❌ No bosses available at Level ${player.level}!\n\nKeep leveling up! 💪` 
        }, { quoted: msg });
      }

      // Select random boss
      const selectedBoss = availableBosses[Math.floor(Math.random() * availableBosses.length)];
      const boss = BossManager.generateBoss(selectedBoss, player.level);

      // Initialize boss battle
      player.inBossBattle = true;
      player.currentBossBattle = {
        boss: boss,
        turn: 1,
        playerDamageDealt: 0,
        bossDamageDealt: 0,
        startTime: Date.now()
      };

      saveDatabase();

      const bossHPBar = BarSystem.getMonsterHPBar(boss);
      const playerHPBar = BarSystem.getHPBar(player.stats.hp, player.stats.maxHp);
      const playerEnergyBar = BarSystem.getEnergyBar(player.stats.energy, player.stats.maxEnergy, className);

      const startMessage = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 BOSS ENCOUNTER! 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${boss.emoji} ${boss.name}
"${boss.title}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${bossHPBar}

📊 Rank: ${boss.rank}
⚔ ATK: ${boss.stats.atk}
🛡 DEF: ${boss.stats.def}
💥 Abilities: ${boss.abilities.join(', ')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 ${player.name}
❤️ HP: ${player.stats.hp}/${player.stats.maxHp}
${playerHPBar}

${player.energyColor || '💙'} ${player.energyType || 'Energy'}: ${player.stats.energy}/${player.stats.maxEnergy}
${playerEnergyBar}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 COMMANDS
/boss attack
/boss use [skill name]
/boss flee
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: startMessage }, { quoted: msg });
    }

    // ============================================
    // SUB-COMMAND: /boss use [skill] - ✅ FIXED!
    // ============================================
    if (subCommand === 'use') {
      if (!player.inBossBattle) {
        return sock.sendMessage(chatId, { 
          text: '❌ You are not in a boss battle!' 
        }, { quoted: msg });
      }

      const skillName = args.slice(1).join(' ').toLowerCase();
      if (!skillName) {
        return sock.sendMessage(chatId, { 
          text: '❌ Specify a skill! Example: /boss use fireball' 
        }, { quoted: msg });
      }

      const battle = player.currentBossBattle;
      const boss = battle.boss;

      // ✅ FIX: Properly format entities
      const playerEntity = {
        name: player.name,
        stats: { ...player.stats },
        skills: player.skills,
        class: { name: className },
        energyType: player.energyType || 'Energy',
        energyColor: player.energyColor || '💙'
      };

      const bossEntity = {
        name: boss.name,
        stats: { ...boss.stats },
        skills: {},
        abilities: boss.abilities || []
      };

      // Execute skill
      const result = ImprovedCombat.executeSkill(playerEntity, bossEntity, skillName);

      if (!result.success) {
        return sock.sendMessage(chatId, { 
          text: `❌ ${result.message}` 
        }, { quoted: msg });
      }

      // Update stats
      player.stats = playerEntity.stats;
      boss.stats = bossEntity.stats;
      battle.turn++;
      battle.playerDamageDealt += result.damage || 0;

      let battleMessage = result.message + '\n\n';

      // Check if boss defeated
      if (boss.stats.hp <= 0) {
        return handleBossVictory(sock, chatId, player, boss, battle, db, saveDatabase, sender);
      }

      // Boss counter-attack
      const bossAction = executeBossAction(boss, player);
      battleMessage += bossAction.message + '\n\n';
      battle.bossDamageDealt += bossAction.damage || 0;

      // Check if player defeated
      if (player.stats.hp <= 0) {
        return handleBossDefeat(sock, chatId, player, boss, battle, saveDatabase);
      }

      saveDatabase();

      // Show updated status with bars
      const playerHPBar = BarSystem.getHPBar(player.stats.hp, player.stats.maxHp);
      const playerEnergyBar = BarSystem.getEnergyBar(player.stats.energy, player.stats.maxEnergy, className);
      const bossHPBar = BarSystem.getMonsterHPBar(boss);

      battleMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      battleMessage += `👤 ${player.name}\n`;
      battleMessage += `❤️ HP: ${player.stats.hp}/${player.stats.maxHp}\n`;
      battleMessage += `${playerHPBar}\n\n`;
      battleMessage += `${player.energyColor || '💙'} ${player.energyType || 'Energy'}: ${player.stats.energy}/${player.stats.maxEnergy}\n`;
      battleMessage += `${playerEnergyBar}\n\n`;
      battleMessage += `${boss.emoji} ${boss.name}\n`;
      battleMessage += `${bossHPBar}\n`;
      battleMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: battleMessage }, { quoted: msg });
    }

    // ============================================
    // SUB-COMMAND: /boss attack
    // ============================================
    if (subCommand === 'attack') {
      if (!player.inBossBattle) {
        return sock.sendMessage(chatId, { 
          text: '❌ You are not in a boss battle!' 
        }, { quoted: msg });
      }

      const battle = player.currentBossBattle;
      const boss = battle.boss;

      // Calculate damage
      const weaponAtk = player.weapon?.bonus || 0;
      const totalAtk = player.stats.atk + weaponAtk;
      const damage = Math.max(1, totalAtk - Math.floor(boss.stats.def * 0.5));

      boss.stats.hp -= damage;
      battle.turn++;
      battle.playerDamageDealt += damage;

      let battleMessage = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      battleMessage += `⚔ ${player.name} attacks!\n`;
      battleMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      battleMessage += `💥 Dealt ${damage} damage!\n\n`;

      // Check if boss defeated
      if (boss.stats.hp <= 0) {
        return handleBossVictory(sock, chatId, player, boss, battle, db, saveDatabase, sender);
      }

      // Boss counter-attack
      const bossAction = executeBossAction(boss, player);
      battleMessage += bossAction.message + '\n\n';
      battle.bossDamageDealt += bossAction.damage || 0;

      // Check if player defeated
      if (player.stats.hp <= 0) {
        return handleBossDefeat(sock, chatId, player, boss, battle, saveDatabase);
      }

      saveDatabase();

      // Show updated status
      const playerHPBar = BarSystem.getHPBar(player.stats.hp, player.stats.maxHp);
      const playerEnergyBar = BarSystem.getEnergyBar(player.stats.energy, player.stats.maxEnergy, className);
      const bossHPBar = BarSystem.getMonsterHPBar(boss);

      battleMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      battleMessage += `👤 ${player.name}\n`;
      battleMessage += `❤️ HP: ${player.stats.hp}/${player.stats.maxHp}\n`;
      battleMessage += `${playerHPBar}\n\n`;
      battleMessage += `${player.energyColor || '💙'} ${player.energyType || 'Energy'}: ${player.stats.energy}/${player.stats.maxEnergy}\n`;
      battleMessage += `${playerEnergyBar}\n\n`;
      battleMessage += `${boss.emoji} ${boss.name}\n`;
      battleMessage += `${bossHPBar}\n`;
      battleMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: battleMessage }, { quoted: msg });
    }

    // ============================================
    // SUB-COMMAND: /boss flee
    // ============================================
    if (subCommand === 'flee') {
      if (!player.inBossBattle) {
        return sock.sendMessage(chatId, { 
          text: '❌ You are not in a boss battle!' 
        }, { quoted: msg });
      }

      const fleeHp = Math.floor(player.stats.maxHp * 0.3);
      player.stats.hp = Math.max(1, player.stats.hp - fleeHp);
      player.inBossBattle = false;
      player.currentBossBattle = null;
      saveDatabase();

      const hpBar = BarSystem.getHPBar(player.stats.hp, player.stats.maxHp);

      return sock.sendMessage(chatId, { 
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏃 FLED FROM BOSS!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lost ${fleeHp} HP from exhaustion

❤️ HP: ${player.stats.hp}/${player.stats.maxHp}
${hpBar}
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
      }, { quoted: msg });
    }

    // Default: Show help
    return sock.sendMessage(chatId, { 
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 BOSS BATTLES 👑
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/boss list - View bosses
/boss fight - Start battle
/boss attack - Basic attack
/boss use [skill] - Use skill
/boss flee - Retreat
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
    }, { quoted: msg });
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function executeBossAction(boss, player) {
  const useAbility = Math.random() < 0.4 && boss.abilities.length > 0;

  if (useAbility) {
    const ability = boss.abilities[Math.floor(Math.random() * boss.abilities.length)];
    const damage = Math.floor(boss.stats.atk * 1.5);
    player.stats.hp -= damage;

    return {
      damage: damage,
      message: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
${boss.emoji} ${boss.name} used ${ability}!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💥 You take ${damage} damage!
❤ Your HP: ${Math.max(0, player.stats.hp)}/${player.stats.maxHp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    };
  } else {
    const damage = Math.max(1, boss.stats.atk - Math.floor(player.stats.def * 0.5));
    player.stats.hp -= damage;

    return {
      damage: damage,
      message: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
${boss.emoji} ${boss.name} attacks!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💥 You take ${damage} damage!
❤ Your HP: ${Math.max(0, player.stats.hp)}/${player.stats.maxHp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    };
  }
}

function handleBossVictory(sock, chatId, player, boss, battle, db, saveDatabase, sender) {
  // Calculate rewards
  const xpReward = BossManager.calculateBossRewards(boss, player.level).xp;
  const crystalReward = BossManager.calculateBossRewards(boss, player.level).crystals;
  const goldReward = BossManager.calculateBossRewards(boss, player.level).gold;

  // Apply rewards
  player.xp += xpReward;
  player.manaCrystals = (player.manaCrystals || 0) + crystalReward;
  updatePlayerNexus(player, goldReward);

  // ✅ TRACK BOSSES FOR RANK PROGRESSION
  if (!player.bossesDefeated) {
    player.bossesDefeated = {
      total: 0,
      byRank: { F: 0, E: 0, D: 0, C: 0, B: 0, A: 0, S: 0 }
    };
  }
  player.bossesDefeated.total++;
  player.bossesDefeated.byRank[boss.rank]++;

  // Generate loot
  const loot = BossManager.generateBossLoot(boss, player.level);
  let lootMessage = '';
  
  if (loot && loot.length > 0) {
    player.inventory = player.inventory || { items: [] };
    player.inventory.items = player.inventory.items || [];
    
    loot.forEach(item => {
      player.inventory.items.push(item);
      lootMessage += `\n🎁 ${item.name} (${item.rarity})`;
    });
  }

  // Clear battle
  player.inBossBattle = false;
  player.currentBossBattle = null;

  saveDatabase();

  // Check level ups
  LevelUpManager.checkAndApplyLevelUps(player, saveDatabase, sock, chatId);

  const victoryMessage = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 BOSS DEFEATED! 🏆
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${boss.emoji} ${boss.name} has fallen!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎁 REWARDS:
💫 +${xpReward} XP
💎 +${crystalReward} Mana Stones
💠 +${goldReward} Nexus${lootMessage}

━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  return sock.sendMessage(chatId, { text: victoryMessage }, { quoted: msg });
}

function handleBossDefeat(sock, chatId, player, boss, battle, saveDatabase) {
  const goldLoss = Math.floor((player.gold || 0) * 0.3);
  updatePlayerNexus(player, -goldLoss);
  
  player.stats.hp = 0;
  player.inBossBattle = false;
  player.currentBossBattle = null;
  
  saveDatabase();

  return sock.sendMessage(chatId, { 
    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💀 DEFEAT 💀
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${boss.emoji} ${boss.name} defeated you!

💠 Lost ${goldLoss} gold (30%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use /use revive or a revive token.
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
  }, { quoted: msg });
}