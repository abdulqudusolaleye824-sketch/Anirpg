// ═══════════════════════════════════════════════════════════════
// QUEST COMMAND - Player Quest Interface
// ═══════════════════════════════════════════════════════════════

const QuestManager   = require('../../rpg/utils/QuestManager');
const { ensureDailyQuests, claimQuestReward, trackQuestProgress, formatDailyQuests, checkStreakMilestone } = require('../../rpg/utils/DailyQuestSystem');
const BarSystem = require('../../rpg/utils/BarSystem');

module.exports = {
  name: 'quest',
  aliases: ['q', 'quests', 'mission'],
  description: 'Manage your quests and view quest board',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    try {
      // ✅ CORRECT chatId extraction (from handler: msg.key.remoteJid)
      const chatId = msg.key.remoteJid;
      const db = getDatabase();
      const player = db.users[sender];
      
      if (!player) {
        return await sock.sendMessage(chatId, {
          text: '❌ You don\'t have a character! Use `/register` to start your adventure.'
        }, { quoted: msg });
      }

      const subCommand = (args[0] || 'list').toLowerCase();

      // Check and reset timed quests (if method exists)
      if (typeof QuestManager.checkAndResetTimedQuests === 'function') {
        QuestManager.checkAndResetTimedQuests(sender);
      }

      // ── Auto-activate daily quests ──────────────────────────────
      const dailyRefreshed = ensureDailyQuests(player);
      if (dailyRefreshed) saveDatabase();

      // ── Check streak milestone (one-time) ──────────────────────
      const milestone = checkStreakMilestone(player);
      if (milestone) saveDatabase();

      switch (subCommand) {
        case 'list':
        case 'board':
        case 'available':
          return await this.showAvailableQuests(sock, chatId, sender, player, msg);

        case 'active':
        case 'current':
          return await this.showActiveQuests(sock, chatId, sender, msg);

        case 'start':
        case 'accept':
        case 'take':
          const questId = args[1];
          if (!questId) {
            return await sock.sendMessage(chatId, {
              text: '❌ Usage: `/quest start <questId>`\nUse `/quest list` to see available quests.'
            }, { quoted: msg });
          }
          return await this.startQuest(sock, chatId, sender, questId, msg);

        case 'complete':
        case 'claim':
        case 'finish':
          const completeId = args[1];
          if (!completeId) {
            return await sock.sendMessage(chatId, {
              text: '❌ Usage: `/quest complete <questId>`\nUse `/quest active` to see your active quests.'
            }, { quoted: msg });
          }
          return await this.completeQuest(sock, chatId, sender, completeId, player, saveDatabase, msg);

        case 'abandon':
        case 'cancel':
        case 'drop':
          const abandonId = args[1];
          if (!abandonId) {
            return await sock.sendMessage(chatId, {
              text: '❌ Usage: `/quest abandon <questId>`'
            }, { quoted: msg });
          }
          return await this.abandonQuest(sock, chatId, sender, abandonId, msg);

        case 'info':
        case 'details':
        case 'view':
          const infoId = args[1];
          if (!infoId) {
            return await sock.sendMessage(chatId, {
              text: '❌ Usage: `/quest info <questId>`'
            }, { quoted: msg });
          }
          return await this.showQuestInfo(sock, chatId, sender, infoId, msg);

        case 'track':
        case 'progress':
          return await this.showActiveQuests(sock, chatId, sender, msg);

        case 'reputation':
        case 'rep':
          return await this.showReputation(sock, chatId, sender, msg);

        case 'achievements':
        case 'achieve':
          return await this.showAchievements(sock, chatId, sender, msg);

        case 'daily':
        case 'dailies': {
          let txt = formatDailyQuests(player);
          // Append milestone notification if one was just earned
          if (milestone) {
            txt += `\n\n🎊 *MILESTONE UNLOCKED: ${milestone.label}!*\n🎁 ${milestone.bonus}`;
          }
          return await sock.sendMessage(chatId, { text: txt }, { quoted: msg });
        }

        case 'claim':
          const claimId = args[1];
          if (claimId && claimId.startsWith('dq_')) {
            // Manual claim — usually unnecessary now since auto-claim handles it
            const claimResult = claimQuestReward(player, claimId);
            if (!claimResult.success) return sock.sendMessage(chatId, { text: '❌ ' + claimResult.error }, { quoted: msg });
            saveDatabase();
            return sock.sendMessage(chatId, {
              text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *DAILY QUEST REWARD!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ ' + claimResult.quest.name + '\n\n💠 +' + (claimResult.reward.gold||0).toLocaleString() + ' Nexus\n💎 +' + (claimResult.reward.crystals||0) + ' Mana Stones\n\n💡 Daily quests auto-claim when complete!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━'
            }, { quoted: msg });
          }
          // Fall through to original complete handler
          return await this.completeQuest(sock, chatId, sender, claimId, player, saveDatabase, msg);

        default:
          return await sock.sendMessage(chatId, {
            text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 QUEST COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 View Quests:
• /quest list - Available quests
• /quest active - Your active quests
• /quest info <id> - Quest details

⚔️ Manage Quests:
• /quest start <id> - Accept quest
• /quest complete <id> - Claim rewards
• /quest abandon <id> - Drop quest

📊 Progress:
• /quest reputation - View faction rep
• /quest achievements - View achievements
• /quest daily - Today's 4 daily quests (auto-claim)

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          }, { quoted: msg });
      }
    } catch (error) {
      console.error('Error in quest command:', error);
      const chatId = msg.key.remoteJid;
      await sock.sendMessage(chatId, {
        text: '❌ An error occurred while processing your quest command.'
      }, { quoted: msg });
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // SHOW AVAILABLE QUESTS
  // ═══════════════════════════════════════════════════════════════
  async showAvailableQuests(sock, chatId, senderId, player, msg) {
    const available = QuestManager.getAvailableQuests(senderId, player.level);

    if (available.length === 0) {
      return await sock.sendMessage(chatId, {
        text: '📜 No quests available at your level.\n\n💡 Complete more quests or level up to unlock new adventures!'
      }, { quoted: msg });
    }

    // Group by category
    const grouped = {
      story: [],
      daily: [],
      weekly: [],
      side: [],
      chain: [],
      achievement: []
    };

    available.forEach(quest => {
      if (grouped[quest.category]) {
        grouped[quest.category].push(quest);
      }
    });

    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '📜 QUEST BOARD\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    // Story Quests
    if (grouped.story.length > 0) {
      message += '📖 *STORY QUESTS*\n';
      grouped.story.forEach(quest => {
        message += `\n${quest.name || 'Unknown Quest'}\n`;
        message += `   ID: ${quest.id}\n`;
        message += `   Lvl ${quest.level || 1} | Ch.${quest.chapter || 1}\n`;
        message += `   ${quest.description || 'No description'}\n`;
      });
      message += '\n';
    }

    // Daily Quests
    if (grouped.daily.length > 0) {
      const playerData = QuestManager.getPlayerData(senderId);
      const hoursLeft = Math.floor((playerData.dailyReset - Date.now()) / (1000 * 60 * 60));

      message += `⏰ *DAILY QUESTS* (Reset in ${Math.max(0, hoursLeft)}h)\n`;
      grouped.daily.forEach(quest => {
        message += `\n${quest.name || 'Unknown Quest'}\n`;
        message += `   ID: ${quest.id}\n`;
        message += `   ${quest.description || 'No description'}\n`;
      });
      message += '\n';
    }

    // Weekly Quests
    if (grouped.weekly.length > 0) {
      const playerData = QuestManager.getPlayerData(senderId);
      const daysLeft = Math.floor((playerData.weeklyReset - Date.now()) / (1000 * 60 * 60 * 24));

      message += `📅 *WEEKLY QUESTS* (Reset in ${Math.max(0, daysLeft)}d)\n`;
      grouped.weekly.forEach(quest => {
        message += `\n${quest.name || 'Unknown Quest'}\n`;
        message += `   ID: ${quest.id}\n`;
        message += `   ${quest.description || 'No description'}\n`;
      });
      message += '\n';
    }

    // Side Quests
    if (grouped.side.length > 0) {
      message += '🎯 *SIDE QUESTS*\n';
      grouped.side.forEach(quest => {
        message += `\n${quest.name || 'Unknown Quest'}\n`;
        message += `   ID: ${quest.id}\n`;
        message += `   Lvl ${quest.level || 1}\n`;
        message += `   ${quest.description || 'No description'}\n`;
      });
      message += '\n';
    }

    // Chain Quests
    if (grouped.chain.length > 0) {
      message += '🔗 *QUEST CHAINS*\n';
      grouped.chain.forEach(quest => {
        message += `\n${quest.name || 'Unknown Quest'}\n`;
        message += `   ID: ${quest.id}\n`;
        message += `   Lvl ${quest.level || 1} | Part ${quest.part || 1}\n`;
        message += `   ${quest.description || 'No description'}\n`;
      });
      message += '\n';
    }

    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '💡 Use `/quest start <id>` to accept\n';
    message += '💡 Use `/quest info <id>` for details';

    await sock.sendMessage(chatId, { text: message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // SHOW ACTIVE QUESTS
  // ═══════════════════════════════════════════════════════════════
  async showActiveQuests(sock, chatId, senderId, msg) {
    const active = QuestManager.getActiveQuests(senderId);

    if (active.length === 0) {
      return await sock.sendMessage(chatId, {
        text: '📭 You have no active quests.\n\nUse `/quest list` to see available quests!'
      }, { quoted: msg });
    }

    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '⚔️ YOUR ACTIVE QUESTS\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    active.forEach((quest, index) => {
      message += `${index + 1}. ${quest.name || 'Unknown Quest'}\n`;
      message += `   ID: ${quest.id}\n`;
      message += `   Type: ${(quest.type || 'unknown').toUpperCase()}\n\n`;

      // ✅ FIX: Show objectives with proper null checks
      if (quest.objectives && quest.objectives.length > 0) {
        quest.objectives.forEach((obj, objIndex) => {
          // ✅ FIX: Add null checks and default values to prevent NaN%
          const current = obj.current || 0;
          const count = obj.count || 1; // Prevent division by zero
          const desc = obj.desc || 'Unknown objective';
          
          const percent = Math.min(100, Math.floor((current / count) * 100));
          const bar = QuestManager.generateProgressBar(current, count);
          
          message += `   ${objIndex + 1}. ${desc}\n`;
          message += `      ${bar} ${current}/${count} (${percent}%)\n`;
        });

        // Check if completable
        const isComplete = quest.objectives.every(obj => (obj.current || 0) >= (obj.count || 1));
        if (isComplete) {
          message += `\n   ✅ *READY TO COMPLETE!*\n`;
          message += `   Use: /quest complete ${quest.id}\n`;
        }
      } else {
        message += `   ⚠️ No objectives found\n`;
      }

      message += '\n';
    });

    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += `Active: ${active.length}/5 quests`;

    await sock.sendMessage(chatId, { text: message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // START QUEST
  // ═══════════════════════════════════════════════════════════════
  async startQuest(sock, chatId, senderId, questId, msg) {
    const result = QuestManager.startQuest(senderId, questId);

    let message = '';
    if (result.success) {
      message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      message += '📜 QUEST ACCEPTED\n';
      message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

      if (result.dialogue) {
        message += `${result.dialogue}\n\n`;
      }

      message += `${result.quest.name || 'Unknown Quest'}\n`;
      message += `Type: ${(result.quest.type || 'unknown').toUpperCase()}\n\n`;

      message += '*Objectives:*\n';
      if (result.quest.objectives && result.quest.objectives.length > 0) {
        result.quest.objectives.forEach((obj, index) => {
          const count = obj.count || 1;
          const desc = obj.desc || 'Unknown objective';
          message += `${index + 1}. ${desc} (0/${count})\n`;
        });
      } else {
        message += 'No objectives\n';
      }

      message += '\n*Rewards:*\n';
      if (result.quest.rewards) {
        if (result.quest.rewards.exp) message += `⭐ ${result.quest.rewards.exp} EXP\n`;
        if (result.quest.rewards.gold) message += `💠 ${result.quest.rewards.gold} Nexus\n`;
        if (result.quest.rewards.items && result.quest.rewards.items.length > 0) {
          result.quest.rewards.items.forEach(item => {
            message += `🎁 ${item.name || 'Unknown Item'}\n`;
          });
        }
        if (result.quest.rewards.title) message += `🏆 Title: ${result.quest.rewards.title}\n`;
      }

      message += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      message += '💡 Track progress: /quest active';
    } else {
      message = result.message;
    }

    await sock.sendMessage(chatId, { text: message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // COMPLETE QUEST
  // ═══════════════════════════════════════════════════════════════
  async completeQuest(sock, chatId, senderId, questId, player, saveDatabase, msg) {
    // QuestManager.completeQuest applies rewards directly to player object
    const result = QuestManager.completeQuest(senderId, questId, player);

    if (!result.success) {
      return await sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
    }

    saveDatabase();

    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '🎉 QUEST COMPLETED!\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    if (result.dialogue) {
      message += `${result.dialogue}\n\n`;
    }

    message += `✅ ${result.quest ? result.quest.name : 'Quest'}\n\n`;
    message += '*Rewards Received:*\n';

    // NOTE: QuestManager.completeQuest already applied rewards to the player
    // (exp, gold, crystals, items). We just need to display them.
    // Only the title is added here (the manager also adds it, but we
    // dedupe to be safe).
    const rewards = result.quest?.rewards;
    if (rewards) {
      if (rewards.exp)        message += `⭐ +${rewards.exp} EXP\n`;
      if (rewards.gold)       message += `💠 +${rewards.gold.toLocaleString()} Nexus\n`;
      if (rewards.crystals)   message += `💎 +${rewards.crystals} Mana Stones\n`;
      if (rewards.items?.length > 0) {
        rewards.items.forEach(item => {
          message += `🎁 ${item.name || 'Unknown Item'} (${item.rarity || 'common'})\n`;
        });
      }
      if (rewards.title) {
        message += `\n🏆 *NEW TITLE:* ${rewards.title}\n`;
      }
      if (rewards.unlocks?.length > 0) {
        message += `\n🔓 New quest${rewards.unlocks.length > 1 ? 's' : ''} unlocked!\n`;
      }
    }

    message += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    await sock.sendMessage(chatId, { text: message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // ABANDON QUEST
  // ═══════════════════════════════════════════════════════════════
  async abandonQuest(sock, chatId, senderId, questId, msg) {
    const result = QuestManager.abandonQuest(senderId, questId);
    await sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // SHOW QUEST INFO
  // ═══════════════════════════════════════════════════════════════
  async showQuestInfo(sock, chatId, senderId, questId, msg) {
    const quest = QuestManager.getQuestInfo(questId);

    if (!quest) {
      return await sock.sendMessage(chatId, {
        text: '❌ Quest not found!'
      }, { quoted: msg });
    }

    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += `${quest.name || 'Unknown Quest'}\n`;
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    message += `*Description:*\n${quest.description || 'No description'}\n\n`;

    message += `*Type:* ${(quest.type || 'unknown').toUpperCase()}\n`;
    if (quest.level) message += `*Level Required:* ${quest.level}\n`;
    if (quest.chapter) message += `*Chapter:* ${quest.chapter}\n`;
    if (quest.chainId) message += `*Chain:* ${quest.chainId} (Part ${quest.part || 1})\n`;

    message += '\n*Objectives:*\n';
    if (quest.objectives && quest.objectives.length > 0) {
      quest.objectives.forEach((obj, index) => {
        message += `${index + 1}. ${obj.desc || 'Unknown objective'}\n`;
      });
    } else {
      message += 'No objectives\n';
    }

    message += '\n*Rewards:*\n';
    if (quest.rewards) {
      if (quest.rewards.exp) message += `⭐ ${quest.rewards.exp} EXP\n`;
      if (quest.rewards.gold) message += `💠 ${quest.rewards.gold} Nexus\n`;
      if (quest.rewards.items && quest.rewards.items.length > 0) {
        quest.rewards.items.forEach(item => {
          message += `🎁 ${item.name || 'Unknown Item'} (${item.rarity || 'common'})\n`;
        });
      }
      if (quest.rewards.title) message += `🏆 Title: ${quest.rewards.title}\n`;
      if (quest.rewards.reputation) {
        message += `🤝 +${quest.rewards.reputation.amount} ${quest.rewards.reputation.faction} Rep\n`;
      }
    }

    if (quest.prerequisites && quest.prerequisites.length > 0) {
      message += '\n*Prerequisites:*\n';
      quest.prerequisites.forEach(prereq => {
        message += `• ${prereq}\n`;
      });
    }

    message += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += `💡 Use: /quest start ${quest.id}`;

    await sock.sendMessage(chatId, { text: message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // SHOW REPUTATION
  // ═══════════════════════════════════════════════════════════════
  async showReputation(sock, chatId, senderId, msg) {
    const playerData = QuestManager.getPlayerData(senderId);
    const rep = playerData.reputation || {};

    if (Object.keys(rep).length === 0) {
      return await sock.sendMessage(chatId, {
        text: '📊 You haven\'t gained any reputation yet.\n\nComplete quests to earn reputation with various factions!'
      }, { quoted: msg });
    }

    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '🤝 FACTION REPUTATION\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    for (const [faction, amount] of Object.entries(rep)) {
      const level = QuestManager.getReputationLevel(amount);
      message += `${faction}\n`;
      message += `${level} (${amount})\n\n`;
    }

    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    await sock.sendMessage(chatId, { text: message }, { quoted: msg });
  },

  // ═══════════════════════════════════════════════════════════════
  // SHOW ACHIEVEMENTS
  // ═══════════════════════════════════════════════════════════════
  async showAchievements(sock, chatId, senderId, msg) {
    const playerData = QuestManager.getPlayerData(senderId);
    const achievements = playerData.achievements || [];
    const titles = playerData.titles || [];

    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '🎖️ YOUR ACHIEVEMENTS\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    if (achievements.length > 0) {
      message += '*Unlocked Achievements:*\n';
      achievements.forEach(achievement => {
        message += `✅ ${achievement}\n`;
      });
      message += '\n';
    } else {
      message += '📭 No achievements yet.\n\n';
    }

    if (titles.length > 0) {
      message += '*Earned Titles:*\n';
      titles.forEach(title => {
        message += `🏆 ${title}\n`;
      });
    } else {
      message += '📭 No titles yet.\n';
    }

    message += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    await sock.sendMessage(chatId, { text: message }, { quoted: msg });
  }
};