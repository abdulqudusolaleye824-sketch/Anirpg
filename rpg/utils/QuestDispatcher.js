// ═══════════════════════════════════════════════════════════════
// Quest Dispatcher — centralized quest progress + notification
//
// Wraps trackQuestProgress with auto-claim + DM notification
// so the player sees what they earned the moment they earn it.
//
// Usage:
//   const { trackAndNotify } = require('./QuestDispatcher');
//   // In any command that does gameplay (kill, craft, etc.):
//   const note = trackAndNotify(player, 'kill', 1, sock, sender);
//   if (note) await sock.sendMessage(chatId, { text: note }, { quoted: msg });
//
// The function is fully safe to call without a socket — it just
// returns the notification text without sending.
// ═══════════════════════════════════════════════════════════════

'use strict';

const { trackQuestProgress, ensureDailyQuests, checkStreakMilestone, buildProgressBar } = require('./DailyQuestSystem');

/**
 * Track quest progress for a single event type and build a notification
 * message if any quests were completed or the daily set just finished.
 *
 * @param {object} player   - db.users[sender]
 * @param {string} type     - quest type ('kill', 'pvp', 'craft', etc.)
 * @param {number} amount   - how much to add
 * @param {object} [sock]   - optional socket; used to deliver the message
 * @param {string} [jid]    - player's JID (needed for the DM)
 * @param {string} [chatId] - group chat JID; if given, the completion is posted
 *                             to that chat and @mentions the player (jid).
 * @returns {string|null}   - notification text (null if nothing happened)
 */
function trackAndNotify(player, type, amount = 1, sock = null, jid = null, chatId = null) {
  if (!player) return null;
  const before = JSON.stringify(player.dailyQuests?.quests || []);
  const result = trackQuestProgress(player, type, amount);
  const after  = JSON.stringify(player.dailyQuests?.quests || []);

  // No change at all → no notification
  if (before === after && !result.milestone) return null;

  let txt = '';
  // ── Quest auto-completed ─────────────────────────────────────
  if (result.justClaimed && result.justClaimed.length) {
    for (const q of result.justClaimed) {
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      txt += `🎁 *DAILY QUEST COMPLETE!*\n`;
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      txt += `✅ *${q.name}*\n`;
      txt += `   ${q.desc}\n`;
      txt += `   💠 +${(q.reward.gold||0).toLocaleString()} Nexus\n`;
      txt += `   💎 +${q.reward.crystals||0} Mana Stones\n`;
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    }
  }

  // ── Streak milestone hit ─────────────────────────────────────
  if (result.milestone) {
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `🏆 *STREAK MILESTONE: ${result.milestone.label}!*\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `🔥 ${result.milestone.bonus}\n`;
    txt += `💡 Milestones grant a one-time bonus. Keep your streak alive!\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  }

  // ── All 4 daily quests done ──────────────────────────────────
  if (player.dailyQuests?.quests?.length === 4 &&
      player.dailyQuests.quests.every(q => q.claimed)) {
    const streak = player.dailyQuests.streak || 0;
    txt += `🌟 *All 4 daily quests done!*\n`;
    txt += `🔥 Streak: *${streak} day${streak===1?'':'s'}*\n\n`;
  }

  if (!txt.trim()) return null;
  const t = txt.trim();

  // Post to the group chat and @mention the player → whole group sees it.
  if (sock && chatId && jid) {
    try { sock.sendMessage(chatId, { text: t, mentions: [jid] }); } catch (e) { /* best effort */ }
    return null; // already delivered to the chat; don't let callers duplicate it
  }
  // No group chat → DM the player (backward compat for pvp.js).
  if (sock && jid) {
    try { sock.sendMessage(jid, { text: t }); } catch (e) { /* best effort */ }
  }
  return t;
}

/**
 * Force the player's daily quests to be (re-)evaluated for today.
 * Returns a "welcome to today" message if new quests were generated,
 * null if the player already had today's quests.
 */
function ensureTodayQuests(player, sock = null, jid = null) {
  if (!player) return null;
  const refreshed = ensureDailyQuests(player);
  if (!refreshed) return null;
  let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `📋 *NEW DAILY QUESTS*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `Your 4 quests for today have been auto-assigned!\n\n`;
  for (const q of player.dailyQuests.quests) {
    txt += `⏳ *${q.name}*\n`;
    txt += `   ${q.desc}\n`;
    txt += `   ${buildProgressBar(0, q.target)} 0/${q.target}\n`;
    txt += `   💠 +${q.reward.gold.toLocaleString()} Nexus | 💎 +${q.reward.crystals} 💎\n\n`;
  }
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `💡 They complete automatically as you play!\n`;
  if (sock && jid) {
    try { sock.sendMessage(jid, { text: txt }); } catch(e) {}
  }
  return txt;
}

module.exports = { trackAndNotify, ensureTodayQuests };
