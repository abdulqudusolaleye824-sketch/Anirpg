// ═══════════════════════════════════════════════════════════════
// QUEST MANAGER - Fixed: rewards applied, auto-complete, async init
// ═══════════════════════════════════════════════════════════════

const QUEST_DATABASE = require('./QuestDatabase');
const fs = require('fs');
const path = require('path');

class QuestManager {
  constructor() {
    this.questsFile = path.join(__dirname, '../data/playerQuests.json');
    this.playerQuests = new Map();
    this.loadSync(); // sync load so data is ready immediately
  }

  loadSync() {
    try {
      const raw = fs.readFileSync(this.questsFile, 'utf8');
      const quests = JSON.parse(raw);
      this.playerQuests = new Map(Object.entries(quests));
    } catch (e) {
      this.playerQuests = new Map();
    }
  }

  save() {
    try {
      const dir = path.dirname(this.questsFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const obj = Object.fromEntries(this.playerQuests);
      fs.writeFileSync(this.questsFile, JSON.stringify(obj, null, 2));
    } catch (e) {
      console.error('QuestManager save error:', e.message);
    }
  }

  // Used by /clear: drop cached quest data AND reset the on-disk store so the
  // stale in-memory quests don't get re-saved after a wipe.
  clearAll() {
    this.playerQuests = new Map();
    try { fs.writeFileSync(this.questsFile, '{}', 'utf-8'); } catch (e) { console.error('QuestManager clearAll error:', e.message); }
  }

  getPlayerData(playerId) {
    if (!this.playerQuests.has(playerId)) {
      this.playerQuests.set(playerId, {
        active: {},
        completed: [],
        available: [],
        dailyReset: Date.now() + 24 * 60 * 60 * 1000,
        weeklyReset: Date.now() + 7 * 24 * 60 * 60 * 1000,
        reputation: {},
        achievements: [],
        titles: []
      });
    }
    return this.playerQuests.get(playerId);
  }

  getAvailableQuests(playerId, playerLevel) {
    const playerData = this.getPlayerData(playerId);
    const available = [];

    for (const [category, quests] of Object.entries(QUEST_DATABASE)) {
      for (const [questId, quest] of Object.entries(quests)) {
        if (playerData.active[questId]) continue;
        if (playerData.completed.includes(questId) && !['daily','weekly'].includes(quest.type)) continue;
        if (quest.level && playerLevel < quest.level) continue;
        if (quest.prerequisites) {
          if (!quest.prerequisites.every(p => playerData.completed.includes(p))) continue;
        }
        available.push({ ...quest, category });
      }
    }
    return available;
  }

  startQuest(playerId, questId) {
    const playerData = this.getPlayerData(playerId);
    let quest = null, category = null;

    for (const [cat, quests] of Object.entries(QUEST_DATABASE)) {
      if (quests[questId]) { quest = quests[questId]; category = cat; break; }
    }
    if (!quest) return { success: false, message: '❌ Quest not found!' };
    if (playerData.active[questId]) return { success: false, message: '⚠️ Quest already active!' };
    if (Object.keys(playerData.active).length >= 5) return { success: false, message: '❌ You can only have 5 active quests at a time!' };

    playerData.active[questId] = {
      ...quest, category, startTime: Date.now(),
      objectives: quest.objectives.map(obj => {
        // Normalize objectives that lack a 'count' field
        if (obj.count === undefined) {
          if (obj.type === 'level') obj.count = 1;
          else if (obj.type === 'pvp_streak') obj.count = obj.streak || 1;
          else obj.count = 1;
        }
        return { ...obj, current: 0 };
      })
    };
    this.save();
    return { success: true, message: '✅ Quest started: ' + quest.name, quest: playerData.active[questId], dialogue: quest.dialogue?.start || '' };
  }

  // Update progress — returns array of update objects including completed quests
  updateProgress(playerId, progressData) {
    const playerData = this.getPlayerData(playerId);
    const updates = [];

    for (const [questId, quest] of Object.entries(playerData.active)) {
      let questUpdated = false;

      quest.objectives.forEach(objective => {
        if (objective.current >= objective.count) return;
        let updated = false;

        switch (objective.type) {
          case 'kill':
            if (progressData.type === 'kill' && (objective.target === 'any' || objective.target === progressData.target)) {
              objective.current += progressData.count || 1; updated = true;
            }
            break;
          case 'dungeon_clear':
            if (progressData.type === 'dungeon_clear' && (objective.floor === 'any' || objective.floor === progressData.floor)) {
              objective.current += 1; updated = true;
            }
            break;
          case 'boss_kill':
            if (progressData.type === 'boss_kill' && (objective.target === 'any' || objective.target === progressData.target)) {
              objective.current += 1; updated = true;
            }
            break;
          case 'skill_use':
            if (progressData.type === 'skill_use') { objective.current += 1; updated = true; }
            break;
          case 'pvp_win':
            if (progressData.type === 'pvp_win') { objective.current += 1; updated = true; }
            break;
          case 'pvp_participate':
            if (progressData.type === 'pvp_participate') { objective.current += 1; updated = true; }
            break;
          case 'pvp_streak':
            if (progressData.type === 'pvp_streak') {
              objective.current = Math.max(objective.current, progressData.streak || 0); updated = true;
            }
            break;
          case 'level':
            if (progressData.type === 'level' && progressData.level >= objective.level) {
              objective.current = 1; updated = true;
              objective.count = 1; // level objectives are binary (reached or not)
            }
            break;
          case 'gold_total':
            if (progressData.type === 'gold_total' && progressData.amount >= (objective.amount || objective.count)) {
              objective.current = objective.count; updated = true;
            }
            break;
          case 'collect':
            if (progressData.type === 'collect' && progressData.item === objective.item) {
              objective.current += progressData.count || 1; updated = true;
            }
            break;
        }

        if (updated) {
          const cap = objective.count || 1;
          objective.current = Math.min(objective.current, cap);
          questUpdated = true;
        }
      });

      if (questUpdated) {
        const isComplete = quest.objectives.every(obj => obj.current >= (obj.count || 1));
        updates.push({ questId, questName: quest.name, type: isComplete ? 'completed' : 'progress', quest });
      }
    }

    if (updates.length > 0) this.save();
    return updates;
  }

  // Complete a quest and apply rewards to the actual player object
  completeQuest(playerId, questId, player) {
    const playerData = this.getPlayerData(playerId);
    const quest = playerData.active[questId];
    if (!quest) return { success: false, message: '❌ Quest not active!' };

    const allComplete = quest.objectives.every(obj => obj.current >= (obj.count || 1));
    if (!allComplete) return { success: false, message: '⚠️ Quest objectives not complete yet!' };

    if (!['daily','weekly'].includes(quest.type)) {
      playerData.completed.push(questId);
    }

    // Apply rewards to actual player object
    const rewards = quest.rewards || {};
    let rewardDesc = '';

    if (rewards.exp && player) {
      player.xp = (player.xp || 0) + rewards.exp;
      rewardDesc += '+' + rewards.exp + ' XP ';
    }
    if (rewards.gold && player) {
      player.gold = (player.gold || 0) + rewards.gold;
      rewardDesc += '+' + rewards.gold.toLocaleString() + ' Nexus ';
    }
    if (rewards.crystals && player) {
      player.manaCrystals = (player.manaCrystals || 0) + rewards.crystals;
      rewardDesc += '+' + rewards.crystals + ' Mana Stones ';
    }
    if (rewards.items && player) {
      if (!player.inventory) player.inventory = {};
      if (!player.inventory.items) player.inventory.items = [];
      for (const item of rewards.items) {
        player.inventory.items.push({ ...item });
        rewardDesc += item.name + ' ';
      }
    }
    if (rewards.title && player) {
      if (!player.titles) player.titles = [];
      if (!player.titles.includes(rewards.title)) player.titles.push(rewards.title);
    }
    if (rewards.unlocks) {
      for (const uid of rewards.unlocks) {
        if (!playerData.available.includes(uid)) playerData.available.push(uid);
      }
    }

    delete playerData.active[questId];
    this.save();

    return {
      success: true,
      message: '🎉 Quest completed: ' + quest.name,
      rewardDesc: rewardDesc.trim(),
      quest,
      dialogue: quest.dialogue?.complete || ''
    };
  }

  abandonQuest(playerId, questId) {
    const playerData = this.getPlayerData(playerId);
    if (!playerData.active[questId]) return { success: false, message: '❌ Quest not active!' };
    const quest = playerData.active[questId];
    delete playerData.active[questId];
    this.save();
    return { success: true, message: '🚫 Abandoned: ' + quest.name };
  }

  checkAndResetTimedQuests(playerId) {
    const playerData = this.getPlayerData(playerId);
    const now = Date.now();
    let reset = false;

    if (now >= playerData.dailyReset) {
      for (const [qid, q] of Object.entries(playerData.active)) {
        if (q.type === 'daily') delete playerData.active[qid];
      }
      playerData.dailyReset = now + 24 * 60 * 60 * 1000;
      reset = true;
    }
    if (now >= playerData.weeklyReset) {
      for (const [qid, q] of Object.entries(playerData.active)) {
        if (q.type === 'weekly') delete playerData.active[qid];
      }
      playerData.weeklyReset = now + 7 * 24 * 60 * 60 * 1000;
      reset = true;
    }
    if (reset) this.save();
    return reset;
  }

  getActiveQuests(playerId) {
    return Object.values(this.getPlayerData(playerId).active);
  }

  getQuestInfo(questId) {
    for (const [category, quests] of Object.entries(QUEST_DATABASE)) {
      if (quests[questId]) return { ...quests[questId], category };
    }
    return null;
  }

  getProgressString(quest) {
    let progress = '';
    quest.objectives.forEach((obj, i) => {
      const total = obj.count || 1;
      const pct = Math.min(100, Math.floor((obj.current / total) * 100));
      const filled = Math.floor(pct / 10);
      const bar = '🟢'.repeat(filled) + '⚪'.repeat(10 - filled);
      progress += (i+1) + '. ' + obj.desc + '\n';
      progress += '   ' + bar + ' ' + obj.current + '/' + total + ' (' + pct + '%)\n';
    });
    return progress;
  }

  getReputation(playerId, faction) {
    return this.getPlayerData(playerId).reputation[faction] || 0;
  }

  generateProgressBar(current, count) {
    const pct = Math.min(100, Math.floor((current / Math.max(1, count)) * 100));
    const filled = Math.floor(pct / 10);
    return '🟢'.repeat(filled) + '⚪'.repeat(10 - filled);
  }

  getReputationLevel(amount) {
    if (amount >= 10000) return '👑 Exalted';
    if (amount >= 5000)  return '⭐ Revered';
    if (amount >= 2000)  return '🔥 Honored';
    if (amount >= 500)   return '✅ Friendly';
    if (amount >= 0)     return '😐 Neutral';
    return '⚠️ Unfriendly';
  }
}

module.exports = new QuestManager();
