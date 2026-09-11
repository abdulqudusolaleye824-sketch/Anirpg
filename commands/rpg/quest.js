// ═══════════════════════════════════════════════════════════════
// QUEST COMMAND — Daily Quest System
// ═══════════════════════════════════════════════════════════════

const { ensureDailyQuests, claimQuestReward, formatDailyQuests, checkStreakMilestone } = require('../../rpg/utils/DailyQuestSystem');

module.exports = {
  name: 'quest',
  aliases: ['quests', 'dailyquests', 'q'],
  description: 'Manage and view your daily quests',
  usage: '/quest OR /quest claim <id>',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    try {
      const chatId = msg.key.remoteJid;
      const db = getDatabase();
      const player = db.users[sender];

      if (!player) {
        return await sock.sendMessage(chatId, {
          text: '❌ You don\'t have a character! Use `/register` to start your adventure.'
        }, { quoted: msg });
      }
      const UI = require('../../rpg/utils/UI');
      const pro = UI.isPro(player);
      const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

      // ── Auto-activate daily quests ──────────────────────────────
      const dailyRefreshed = ensureDailyQuests(player);
      if (dailyRefreshed) saveDatabase();

      // ── Check streak milestone (one-time) ──────────────────────
      const milestone = checkStreakMilestone(player);
      if (milestone) saveDatabase();

      const subCommand = (args[0] || '').toLowerCase();

      if (subCommand === 'claim' && args[1]) {
        const claimId = args[1];
        const claimResult = claimQuestReward(player, claimId);
        if (!claimResult.success) {
          return sock.sendMessage(chatId, { text: '❌ ' + claimResult.error }, { quoted: msg });
        }
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: (pro ? `${UI.PRO_BAR}\n🎁 *DAILY QUEST REWARD!* 💎\n${UI.PRO_BAR}\n` : `🎁 *DAILY QUEST REWARD!*\n${UI.FREE_BAR}\n`) + `✅ ${claimResult.quest.name}\n\n💠 +${(claimResult.reward.gold||0).toLocaleString()} Nexus\n💎 +${(claimResult.reward.crystals||0)} Mana Stones\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO STREAK* — ${player.dailyQuests?.streak || 0}-day streak` : `\n${UI.upsell()}`)
        }, { quoted: msg });
      }

      // Display Daily Quests Board directly for /quest, /quest daily, or any default invocation
      let txt = formatDailyQuests(player);
      if (milestone) {
        txt += `\n\n🎊 *MILESTONE UNLOCKED: ${milestone.label}!*\n🎁 ${milestone.bonus}`;
      }

      return await sock.sendMessage(chatId, { text: txt }, { quoted: msg });

    } catch (error) {
      console.error('Error in quest command:', error);
      const chatId = msg.key.remoteJid;
      await sock.sendMessage(chatId, {
        text: '❌ An error occurred while processing your quest command.'
      }, { quoted: msg });
    }
  }
};
