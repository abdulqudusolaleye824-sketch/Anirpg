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
      // Batch-41: NO throttle — every unlock notifies THE INSTANT it is
      // accomplished. (The old 60s gate is deleted; multi-unlocks from one
      // event still batch into a single message via buildNotification.)
      const achNote = AchievementManager.buildNotification(newlyUnlocked, player);
      if (achNote) notes.push(achNote);
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
      // Batch-41: NO throttle — snapshot unlocks notify instantly too.
      const achNote = AchievementManager.buildNotification(allUnlocked, player);
      if (achNote && sock && chatId) {
        const mentions2 = jid ? [jid] : [];
        await sock.sendMessage(chatId, { text: achNote, mentions: mentions2 });
      }
    }
  } catch (e) {}
}

module.exports = {
  trackActivity,
  checkSnapshotAchievements,
};
