// ═══════════════════════════════════════════════════════════════
// /daily - 24hr cooldown, 1000-day streak, milestone rewards
// ═══════════════════════════════════════════════════════════════

const AchievementManager = require('../../rpg/utils/AchievementManager');
const BP = require('../../rpg/utils/BattlePass');
const SeasonManager = require('../../rpg/utils/SeasonManager');
const LevelUpManager = require('../../rpg/utils/LevelUpManager');
const DC = require('../../rpg/utils/DailyChallenges');
const { canClaimDaily, formatDuration, timestampWAT } = require('../../rpg/utils/NigerianTime');
const { awardXP } = require('../../rpg/utils/SilentXP');
let TitleSystem; try { TitleSystem = require('../../rpg/utils/TitleSystem'); } catch(e) {}

// Daily uses a ROLLING 24h window: claimable again exactly 24h after the
// player's last claim (NOT a WAT-midnight reset). Each player's own timing
// defines their day. Streak resets if they miss more than a full window.

// Milestone rewards every 10 days up to 1000
// NOTE: deliberately modest so the economy isn't flooded. Long streaks are a
// loyalty reward, not a money printer — the sweetener is the pet/title/items.
function getMilestoneReward(streak) {
  const milestones = {
    10:   { gold: 1500,          crystals: 10,     label: 'Week+ Hunter' },
    20:   { gold: 3000,          crystals: 20,    items: 3,  label: 'Dedicated' },
    30:   { gold: 5000,          crystals: 35,    pet: 'common', label: 'Monthly Warrior' },
    50:   { gold: 8000,          crystals: 60,    pet: 'rare',   label: 'Committed' },
    100:  { gold: 15000,         crystals: 150,   items: 10, pet: 'epic',      label: 'Centurion' },
    200:  { gold: 30000,         crystals: 350,  pet: 'legendary', label: 'Veteran' },
    365:  { gold: 60000,         crystals: 1000,  pet: 'legendary', title: 'Veteran', label: 'Year One' },
    500:  { gold: 100000,        crystals: 2000, pet: 'legendary', title: 'Elite',   label: 'Half-Thousand' },
    700:  { gold: 200000,        crystals: 4000, pet: 'legendary', title: 'Legend',  label: 'Seven Hundred' },
    1000: { gold: 500000,        crystals: 10000,pet: 'divine',   title: 'Mythic Hunter', label: 'Mythic' }
  };

  // Check every 10-day interval
  for (const day of [1000,700,500,365,200,100,50,30,20,10]) {
    if (streak === day) return { ...milestones[day], day };
  }
  return null;
}

// Base daily reward scales slightly with streak, then caps so it stays modest.
function getBaseReward(streak) {
  const tier = Math.min(Math.floor(streak / 10), 30);
  return {
    gold:     600 + tier * 80,
    crystals: 3  + Math.floor(tier / 5),
    xp:       0   // XP handled by SilentXP (awardXP) separately
  };
}

module.exports = {
  name: 'daily',
  aliases: ['daily2'],
  description: 'Claim your daily rewards and grow your streak',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: '❌ You are not registered!\nUse /register [name] to begin your journey.'
      }, { quoted: msg });
    }

    // Ensure daily data exists on player object
    if (!player.dailyQuest) player.dailyQuest = { lastClaimed: 0, streak: 0 };

    // ── /daily (no arg) → the daily REWARD CLAIM ──────────────────────────

    const now = Date.now();
    const last = player.dailyQuest.lastClaimed || 0;

    // Rolling 24h window — claimable again 24h after the last claim
    const { canClaim, msRemaining } = canClaimDaily(last);

    if (!canClaim) {
      return sock.sendMessage(chatId, {
        text: [
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '⏳ *ALREADY CLAIMED*',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          `You already claimed your daily rewards.`,
          `Next claim in 24h — *${formatDuration(msRemaining)}* remaining.`,
          '',
          `🔥 Current Streak: *${player.dailyQuest.streak} day${player.dailyQuest.streak===1?'':'s'}*`,
          "Don't break it — the rewards only get better.",
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        ].join('\n')
      }, { quoted: msg });
    }

    // Streak logic — if the gap from the last claim exceeds 2 full windows
    // (i.e. a whole 24h period was skipped), the streak resets to 0.
    const twoDaysAgo = now - 2 * 86400000;
    if (last > 0 && last < twoDaysAgo) {
      player.dailyQuest.streak = 0;
    }
    player.dailyQuest.streak = (player.dailyQuest.streak || 0) + 1;
    player.dailyQuest.lastClaimed = now;
    // Daily Quest System: only tick Devoted quest on successful claim (not on Already Claimed)
    try { const { trackAndNotify } = require('../../rpg/utils/QuestDispatcher'); trackAndNotify(player, 'daily', 1, sock, sender, chatId); } catch(e){}
    DC.trackProgress(player, 'claim_daily', 1);
    try { const WK=require('./weekly'); WK.trackWeeklyProgress(player,'daily_streak',1); } catch(e) {}
    try { const BP2=require('../../rpg/utils/BattlePass'); BP2.addPassXP(player,'daily_claim'); } catch(e) {}
    try { if (TitleSystem) { const nt=TitleSystem.checkAndAwardTitles(player); if (nt.length) { const nm=nt.map(id=>TitleSystem.TITLES[id]?.display||id).join(', '); sock.sendMessage(chatId,{text:`🎖️ *NEW TITLE UNLOCKED!*\n${nm}\n\n/title to equip it!`,mentions:[sender]}); } } } catch(e) {}

    const streak = player.dailyQuest.streak;
    const base = getBaseReward(streak);
    const milestone = getMilestoneReward(streak);

    // Apply base rewards (with seasonal multipliers)
    const seasonXpMult   = SeasonManager.getXpMult();
    const seasonNexusMult = SeasonManager.getNexusMult();
    const activeEvent    = SeasonManager.getActiveEvent();
    const dailyMult      = activeEvent?.bonuses?.dailyBonusMult || 1;
    const finalNexus      = Math.floor(base.gold     * seasonNexusMult * dailyMult);
    const finalCrystals  = base.crystals;
    player.gold         = (player.gold || 0)         + finalNexus;
    // XP awarded (also shown in the rewards summary)
    const xpAward = awardXP(player, 'daily_claim', saveDatabase, sock, chatId);
    const finalXp = xpAward?.amount || 0;
    player.manaCrystals = (player.manaCrystals || 0) + finalCrystals;

    // Level up check via LevelUpManager (unlocks skills, weapons, UP)
    const levelResult = LevelUpManager.checkAndApplyLevelUps(player, saveDatabase, sock, chatId);
    const levelUps = levelResult?.levelsGained || 0;

    // Track achievement
    const AchMgr = AchievementManager;
    const achUnlocks = AchMgr.track(player, 'daily_quests', 1);

    // Award Weekly GP and Battle Pass XP for claiming daily
    try { require('../../rpg/utils/WeeklyGuildWar').addGP(db, sender, 100, saveDatabase); } catch(e) {}
    try { require('../../rpg/utils/BattlePass').addPassXP(player, 'daily_claim'); } catch(e) {}

    saveDatabase();

    // Build the message
    const streakTitle = streak >= 365 ? '🌌 MYTHIC' : streak >= 100 ? '🏆 LEGENDARY' :
                        streak >= 30  ? '🔥 BLAZING' : streak >= 7 ? '⚡ RISING' : '📅 ACTIVE';

    const lines = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '☀️  *DAILY REWARD CLAIMED*',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      `🔥 Streak: *${streak} day${streak===1?'':'s'}* — ${streakTitle}`,
      '',
      '🎁 *TODAY\'S REWARDS*',
      `💠 +${finalNexus.toLocaleString()} Nexus${seasonNexusMult>1?' ('+seasonNexusMult+'× '+SeasonManager.getActiveEvent()?.emoji+')':''}`,
      `💎 +${finalCrystals} Mana Stones`,
      `✨ +${finalXp} XP${seasonXpMult>1?' ('+seasonXpMult+'× '+SeasonManager.getActiveEvent()?.emoji+')':''}`,
    ];

    if (milestone) {
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      lines.push(`🌟 *DAY ${milestone.day} MILESTONE — ${milestone.label.toUpperCase()}!*`);
      lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (milestone.gold) {
        player.gold += milestone.gold;
        lines.push(`💠 +${milestone.gold.toLocaleString()} Bonus Nexus`);
      }
      if (milestone.crystals) {
        player.manaCrystals += milestone.crystals;
        lines.push(`💎 +${milestone.crystals.toLocaleString()} Bonus Mana Stones`);
      }
      if (milestone.items) {
        if (!player.inventory) player.inventory = {};
        player.inventory.healthPotions = (player.inventory.healthPotions || 0) + milestone.items;
        lines.push(`🧪 +${milestone.items} Health Potions`);
      }
      if (milestone.pet) {
        lines.push(`🐾 ${milestone.pet.charAt(0).toUpperCase() + milestone.pet.slice(1)} Pet Token added!`);
        if (!player.inventory) player.inventory = {};
        if (!player.inventory.items) player.inventory.items = [];
        player.inventory.items.push({
          name: milestone.pet.charAt(0).toUpperCase() + milestone.pet.slice(1) + ' Pet Token',
          type: 'PetToken', rarity: milestone.pet
        });
      }
      if (milestone.title) {
        if (!player.titles) player.titles = [];
        if (!player.titles.includes(milestone.title)) player.titles.push(milestone.title);
        lines.push(`🎖️ Title Unlocked: *"${milestone.title}"*`);
      }
      saveDatabase();
    }

    if (levelUps > 0) {
      lines.push('');
      lines.push(`🎉 *LEVEL UP x${levelUps}!* → Now Level ${player.level}`);
    }

    const next10 = 10 - (streak % 10);
    lines.push('');
    lines.push(`📅 *${streak} / 1000 days*`);
    lines.push(`⏭️ Next milestone bonus in ${next10} day${next10 === 1 ? '' : 's'}`);
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });

    // Achievement notifications
    if (achUnlocks.length > 0) {
      const note = AchMgr.buildNotification(achUnlocks, player);
      if (note) await sock.sendMessage(chatId, { text: note, mentions: [sender] }, { quoted: msg });
    }
  }
};