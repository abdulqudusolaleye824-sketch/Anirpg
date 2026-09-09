// ═══════════════════════════════════════════════════════════════
// Astra — Central Activity Tracker
//
// Single source of truth for tracking gameplay activities across
// Quests (DailyQuestSystem) and Achievements (AchievementManager).
// Automatically auto-claims rewards and broadcasts completion notifications.
// ═══════════════════════════════════════════════════════════════

'use strict';

const QuestDispatcher = require('./QuestDispatcher');
const AchievementManager = require('./AchievementManager');

/**
 * Track an activity event across both Daily Quests and Achievements.
 *
 * @param {object} player - db.users[sender]
 * @param {string} type - action type ('kill', 'boss', 'pvp', 'craft', 'shop', 'sell', 'scroll', 'pet', 'feed', 'up_spent', 'casino_win', etc.)
 * @param {number} amount - count or value to increment/compare
 * @param {object} [extra] - extra filtering properties ({ rank, rarity, stat, etc. })
 * @param {object} [sock] - Baileys socket for notification dispatch
 * @param {string} [jid] - player's JID
 * @param {string} [chatId] - group chat JID
 */
async function trackActivity(player, type, amount = 1, extra = {}, sock = null, jid = null, chatId = null) {
  if (!player) return [];

  const notes = [];

  // 1. Track Quests
  try {
    const questNote = QuestDispatcher.trackAndNotify(player, type, amount, sock, jid, chatId);
    if (questNote) notes.push(questNote);
  } catch (e) {
    console.warn(`[TRACKER] Quest error (${type}):`, e.message);
  }

  // 2. Track Achievements
  try {
    const newlyUnlocked = AchievementManager.track(player, type, amount, extra);
    if (newlyUnlocked.length > 0) {
      // Anti-spam throttle: max 1 achievement notification per player per chat per 60s (unless >2 achievements batched)
      const throttleKey = (player.id || jid || '') + ':' + (chatId || '');
      const now = Date.now();
      const last = AchievementManager._throttleGet ? AchievementManager._throttleGet(throttleKey) : 0;
      // Also check global throttle map if exists
      let lastTime = 0;
      try { lastTime = (global.achievementThrottle && global.achievementThrottle.get(throttleKey)) || 0; } catch {}
      const isThrottled = (now - lastTime) < 60000 && newlyUnlocked.length < 3;
      if (!isThrottled) {
        try { if (global.achievementThrottle) global.achievementThrottle.set(throttleKey, now); } catch {}
        const achNote = AchievementManager.buildNotification(newlyUnlocked, player);
        if (achNote) notes.push(achNote);
      } else {
        console.log(`[TRACKER] Throttled achievement spam for ${player.name} in ${chatId} (${newlyUnlocked.length} unlocks)`);
      }
    }
  } catch (e) {
    console.warn(`[TRACKER] Achievement error (${type}):`, e.message);
  }

  // 3. Dispatch combined notifications if present and not already dispatched by QuestDispatcher
  if (notes.length > 0 && sock && chatId) {
    try {
      const mentions = jid ? [jid] : [];
      await sock.sendMessage(chatId, { text: notes.join('\n\n'), mentions });
    } catch (e) {}
  }

  return notes;
}

/**
 * Snapshot check helper — evaluates real-time player stats against snapshot achievements
 * (e.g. level thresholds, total Nexus, total Mana Stones, bank balance, upgrade points).
 */
async function checkSnapshotAchievements(player, sock = null, jid = null, chatId = null) {
  if (!player) return;

  try {
    const levelAch = AchievementManager.track(player, 'level', player.level || 1);
    const goldAch = AchievementManager.track(player, 'gold_total', player.gold || 0);
    const bankAch = AchievementManager.track(player, 'bank_gold', player.bankGold || 0);
    const crystalAch = AchievementManager.track(player, 'crystals_total', player.manaCrystals || 0);

    const allUnlocked = [...levelAch, ...goldAch, ...bankAch, ...crystalAch];
    if (allUnlocked.length > 0) {
      // Throttle snapshot achievements too (level/gold spam)
      const throttleKey2 = (player.id || jid || '') + ':' + (chatId || '') + ':snap';
      const now2 = Date.now();
      let last2 = 0;
      try { last2 = (global.achievementThrottle && global.achievementThrottle.get(throttleKey2)) || 0; } catch {}
      if ((now2 - last2) >= 60000) {
        try { if (global.achievementThrottle) global.achievementThrottle.set(throttleKey2, now2); } catch {}
        const achNote = AchievementManager.buildNotification(allUnlocked, player);
        if (achNote && sock && chatId) {
          const mentions2 = jid ? [jid] : [];
          await sock.sendMessage(chatId, { text: achNote, mentions: mentions2 });
        }
      } else {
        console.log(`[TRACKER] Throttled snapshot spam for ${player.name}`);
      }
    }
  } catch (e) {}
}

module.exports = {
  trackActivity,
  checkSnapshotAchievements,
};
