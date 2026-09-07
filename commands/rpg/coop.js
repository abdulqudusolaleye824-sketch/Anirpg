const BossManager = require('../../rpg/dungeons/BossManager');
const LevelUpManager = require('../../rpg/utils/LevelUpManager');
const ImprovedCombat = require('../../rpg/utils/ImprovedCombat');

module.exports = {
  name: 'coop',
  description: '🤝 Pokemon-style Co-op battles',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You are not registered!' }, { quoted: msg });
    }

    if (!db.coopBattles) db.coopBattles = {};

    const action = args[0]?.toLowerCase();

    // ═══════════════════════════════════════════════════════════════
    // COOP MENU
    // ═══════════════════════════════════════════════════════════════
    if (!action) {
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤝 CO-OP SYSTEM 🤝
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Team up for epic raids!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/coop create - Start raid (2-5 players)
/coop join - Join active raid
/coop attack - Basic attack
/coop skills - View your skills
/coop use [#] - Use skill by number
/coop items - View items
/coop item [#] - Use item
/coop leave - Leave raid
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 Defeat raid bosses together!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE COOP RAID
    // ═══════════════════════════════════════════════════════════════
    if (action === 'create') {
      if (db.coopBattles[chatId]) {
        return sock.sendMessage(chatId, {
          text: '❌ A raid is already active in this chat!'
        }, { quoted: msg });
      }

      const raidBoss = BossManager.generateRaidBoss(player.level);

      db.coopBattles[chatId] = {
        boss: raidBoss,
        players: {
          [sender]: {
            name: player.name,
            hp: player.stats.maxHp,
            energy: player.stats.maxEnergy,
            damage: 0
          }
        },
        bossHP: raidBoss.maxHp,
        startTime: Date.now(),
        creator: sender
      };

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤝 RAID CREATED! 🤝
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐉 Raid Boss: ${raidBoss.name}
⭐ Level: ${raidBoss.level}
❤️ HP: ${raidBoss.maxHp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 PLAYERS (1/5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ ${player.name} (Lv.${player.level})
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ Join now with /coop join!
⏰ Waiting for more players...
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // JOIN COOP RAID
    // ═══════════════════════════════════════════════════════════════
    if (action === 'join') {
      const raid = db.coopBattles[chatId];

      if (!raid) {
        return sock.sendMessage(chatId, {
          text: '❌ No active raid in this chat!\n\nUse /coop create to start one.'
        }, { quoted: msg });
      }

      if (raid.players[sender]) {
        return sock.sendMessage(chatId, {
          text: '❌ You already joined this raid!'
        }, { quoted: msg });
      }

      if (Object.keys(raid.players).length >= 5) {
        return sock.sendMessage(chatId, {
          text: '❌ Raid is full! (Max 5 players)'
        }, { quoted: msg });
      }

      raid.players[sender] = {
        name: player.name,
        hp: player.stats.maxHp,
        energy: player.stats.maxEnergy,
        damage: 0
      };

      saveDatabase();

      const playerList = Object.entries(raid.players)
        .map(([id, p], i) => `${i + 1}️⃣ ${p.name}`)
        .join('\n');

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ${player.name} JOINED THE RAID!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐉 ${raid.boss.name} (Lv.${raid.boss.level})
❤️ HP: ${raid.bossHP}/${raid.boss.maxHp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 PLAYERS (${Object.keys(raid.players).length}/5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${playerList}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ Everyone can now attack!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // Check if player is in raid
    const raid = db.coopBattles[chatId];

    if (!raid) {
      return sock.sendMessage(chatId, {
        text: '❌ No active raid!\n\nUse /coop create or /coop join'
      }, { quoted: msg });
    }

    if (!raid.players[sender]) {
      return sock.sendMessage(chatId, {
        text: '❌ You are not in this raid!\n\nUse /coop join to participate.'
      }, { quoted: msg });
    }

    const playerData = raid.players[sender];
    const boss = raid.boss;

    // ═══════════════════════════════════════════════════════════════
    // COOP ATTACK
    // ═══════════════════════════════════════════════════════════════
    if (action === 'attack') {
      const weaponBonus = player.weapon?.bonus || 0;
      let damage = Math.max(1, (player.stats.atk + weaponBonus) - Math.floor(boss.def / 2));

      const isCrit = Math.random() < 0.1;
      if (isCrit) damage = Math.floor(damage * 2);

      raid.bossHP -= damage;
      playerData.damage += damage;

      let narrative = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      narrative += `⚔️ ${player.name} attacked!\n`;
      if (isCrit) narrative += `💥 CRITICAL HIT!\n`;
      narrative += `💥 Dealt ${damage} damage to ${boss.name}!\n`;
      narrative += `🐉 ${boss.name}: ❤️ ${Math.max(0, raid.bossHP)}/${boss.maxHp}\n`;
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      // Check victory
      if (raid.bossHP <= 0) {
        const rewards = BossManager.getRaidRewards(boss, Object.keys(raid.players).length);
        
        narrative += `\n🎉 RAID BOSS DEFEATED! 🎉\n\n`;
        narrative += `👥 DAMAGE DEALT:\n`;
        
        const sortedPlayers = Object.entries(raid.players)
          .sort((a, b) => b[1].damage - a[1].damage);

        sortedPlayers.forEach(([id, p], i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '⭐';
          narrative += `${medal} ${p.name}: ${p.damage} damage\n`;
        });

        narrative += `\n🎁 EVERYONE GETS:\n`;
        narrative += `✨ XP: +${rewards.xp}\n`;
        narrative += `💎 Mana Stones: +${rewards.crystals}\n`;
        narrative += `💠 Nexus: +${rewards.gold}\n`;

        // Distribute rewards
        for (const playerId of Object.keys(raid.players)) {
          const p = db.users[playerId];
          if (p) {
            p.xp += rewards.xp;
            p.manaCrystals += rewards.crystals;
            p.gold = (p.gold || 0) + rewards.gold;
            LevelUpManager.checkAndApplyLevelUps(p, saveDatabase, sock, chatId);
          }
        }

        delete db.coopBattles[chatId];
        saveDatabase();

        return sock.sendMessage(chatId, { text: narrative }, { quoted: msg });
      }

      // Boss AOE attack (hits everyone)
      const bossAttackType = Math.random();
      let bossDamage;

      if (bossAttackType < 0.3) {
        bossDamage = Math.max(1, boss.atk - Math.floor(player.stats.def / 2));
        narrative += `\n🐉 ${boss.name} used AOE attack!\n`;
      } else {
        bossDamage = Math.max(1, Math.floor(boss.atk * 1.5) - Math.floor(player.stats.def / 2));
        narrative += `\n🔥 ${boss.name} used ${boss.specialAttack}!\n`;
      }

      narrative += `💥 All raiders took damage!\n`;
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      // Apply damage to all players
      let allDefeated = true;
      for (const [id, p] of Object.entries(raid.players)) {
        const playerInRaid = db.users[id];
        if (playerInRaid) {
          const actualDamage = Math.max(1, bossDamage - Math.floor(playerInRaid.stats.def / 3));
          p.hp -= actualDamage;
          
          if (p.hp > 0) allDefeated = false;
          
          narrative += `👤 ${p.name}: ${actualDamage} dmg → ❤️ ${Math.max(0, p.hp)}\n`;
        }
      }

      // Check if all players defeated
      if (allDefeated) {
        narrative += `\n\n💀 ALL RAIDERS DEFEATED!\n\n`;
        narrative += `❌ Everyone lost 5% gold`;

        for (const playerId of Object.keys(raid.players)) {
          const p = db.users[playerId];
          if (p) {
            p.gold = Math.floor((p.gold || 0) * 0.95);
          }
        }

        delete db.coopBattles[chatId];
        saveDatabase();

        return sock.sendMessage(chatId, { text: narrative }, { quoted: msg });
      }

      saveDatabase();
      return sock.sendMessage(chatId, { text: narrative }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // COOP SKILLS MENU
    // ═══════════════════════════════════════════════════════════════
    if (action === 'skills') {
      const menu = ImprovedCombat.getSkillsMenu(player);
      return sock.sendMessage(chatId, { text: menu }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // COOP USE SKILL
    // ═══════════════════════════════════════════════════════════════
    if (action === 'use') {
      const skillNum = parseInt(args[1]);

      if (!skillNum || skillNum < 1 || !player.skills?.active) {
        return sock.sendMessage(chatId, {
          text: '❌ Invalid skill number!\n\nUse /coop skills to see your skills.'
        }, { quoted: msg });
      }

      const skill = player.skills.active[skillNum - 1];

      if (!skill) {
        return sock.sendMessage(chatId, {
          text: `❌ Skill ${skillNum} not found!`
        }, { quoted: msg });
      }

      // Check cooldown
      const cooldownCheck = ImprovedCombat.checkCooldown(player, skill.name);
      if (!cooldownCheck.ready) {
        return sock.sendMessage(chatId, { text: cooldownCheck.message }, { quoted: msg });
      }

      // Check energy
      if (playerData.energy < skill.energyCost) {
        return sock.sendMessage(chatId, {
          text: `❌ Not enough ${player.energyType}!\nNeed: ${skill.energyCost}\nHave: ${playerData.energy}`
        }, { quoted: msg });
      }

      // Use skill
      playerData.energy -= skill.energyCost;
      player.lastSkillUse[skill.name] = Date.now();

      const weaponBonus = player.weapon?.bonus || 0;
      let damage = Math.max(1, (skill.damage + weaponBonus) - Math.floor(boss.def / 2));

      const isCrit = Math.random() < 0.15;
      if (isCrit) damage = Math.floor(damage * 2);

      raid.bossHP -= damage;
      playerData.damage += damage;

      let narrative = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      narrative += `✨ ${player.name} used ${skill.name}!\n`;
      if (isCrit) narrative += `💥 CRITICAL HIT!\n`;
      narrative += `💥 Dealt ${damage} damage to ${boss.name}!\n`;
      narrative += `💙 ${player.energyType}: ${playerData.energy}/${player.stats.maxEnergy}\n`;
      narrative += `🐉 ${boss.name}: ❤️ ${Math.max(0, raid.bossHP)}/${boss.maxHp}\n`;
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      // Check victory
      if (raid.bossHP <= 0) {
        const rewards = BossManager.getRaidRewards(boss, Object.keys(raid.players).length);
        
        narrative += `\n🎉 RAID BOSS DEFEATED! 🎉\n\n`;
        narrative += `👥 DAMAGE DEALT:\n`;
        
        const sortedPlayers = Object.entries(raid.players)
          .sort((a, b) => b[1].damage - a[1].damage);

        sortedPlayers.forEach(([id, p], i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '⭐';
          narrative += `${medal} ${p.name}: ${p.damage} damage\n`;
        });

        narrative += `\n🎁 EVERYONE GETS:\n`;
        narrative += `✨ XP: +${rewards.xp}\n`;
        narrative += `💎 Mana Stones: +${rewards.crystals}\n`;
        narrative += `💠 Nexus: +${rewards.gold}\n`;

        for (const playerId of Object.keys(raid.players)) {
          const p = db.users[playerId];
          if (p) {
            p.xp += rewards.xp;
            p.manaCrystals += rewards.crystals;
            p.gold = (p.gold || 0) + rewards.gold;
            LevelUpManager.checkAndApplyLevelUps(p, saveDatabase, sock, chatId);
          }
        }

        delete db.coopBattles[chatId];
        saveDatabase();

        return sock.sendMessage(chatId, { text: narrative }, { quoted: msg });
      }

      saveDatabase();
      return sock.sendMessage(chatId, { text: narrative }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // COOP LEAVE
    // ═══════════════════════════════════════════════════════════════
    if (action === 'leave') {
      delete raid.players[sender];

      if (Object.keys(raid.players).length === 0) {
        delete db.coopBattles[chatId];
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: '❌ Raid ended! (No players remaining)'
        }, { quoted: msg });
      }

      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `✅ ${player.name} left the raid!\n\n${Object.keys(raid.players).length} players remaining.`
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: '❌ Invalid command!\n\nUse /coop for options.'
    }, { quoted: msg });
  }
};