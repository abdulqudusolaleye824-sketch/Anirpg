// ═══════════════════════════════════════════════════════════════
// Quest Progress Hook
// Helper to wire quest-progress tracking + inline progress bar
// into existing gameplay commands without rewriting each one.
//
// Usage in a command:
//
//   const { applyQuestProgress } = require('../../rpg/utils/QuestProgressHook');
//   ...
//   // After a successful kill:
//   const { result, text } = applyQuestProgress(player, 'kill', 1, baseText);
//   await sock.sendMessage(chatId, { text }, { quoted: msg });
//   if (result.justClaimed.length) { /* maybe DM a celebration */ }
//
// ═══════════════════════════════════════════════════════════════

'use strict';

const { trackQuestProgress, getInlineProgress, ensureDailyQuests } = require('./DailyQuestSystem');

/**
 * Track quest progress for an event, then append the relevant
 * daily-quest progress bars to the output text. Returns both
 * the raw result and the augmented text.
 *
 * @param {object} player     - db.users[sender]
 * @param {string} type       - quest type: 'kill', 'pvp', 'craft', etc.
 * @param {number} amount     - how much to add (default 1)
 * @param {string} baseText   - existing command output
 * @returns {{ result, text }}
 */
function applyQuestProgress(player, type, amount = 1, baseText = '') {
  // Make sure daily quests are seeded before we try to track
  ensureDailyQuests(player);

  const result = trackQuestProgress(player, type, amount);
  const inline = getInlineProgress(player, type);

  let text = baseText;
  if (inline) text += inline;

  if (result.justClaimed && result.justClaimed.length) {
    const q = result.justClaimed[0];
    text += `\n\n🎁 *QUEST COMPLETE: ${q.name}* — auto-claimed!\n   💠 +${(q.reward.gold||0).toLocaleString()} Nexus | 💎 +${q.reward.crystals||0} Mana Stones`;
  }

  return { result, text };
}

module.exports = { applyQuestProgress };
