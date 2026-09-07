// ═══════════════════════════════════════════════════════════════
// ACHIEVEMENT MANAGER - Fixed: snapshot vs accumulative tracking
// Rewards actually applied. No fake unlocks.
// ═══════════════════════════════════════════════════════════════

const { ACHIEVEMENTS } = require('./AchievementDatabase');

// These achievement types compare against the player's REAL current value
// NOT an accumulated delta sum
const SNAPSHOT_TYPES = new Set([
  'level','gold_total','bank_gold','crystals_total',
  'stat_value','pvp_streak','pet_bonding','legendary_pet_bond',
  'pets_owned','days_played'
]);

class AchievementManager {
  // Store achievements inside player object — no separate file needed
  getPlayer(player) {
    if (!player.achievements) {
      player.achievements = { unlocked: [], progress: {} };
    }
    return player.achievements;
  }

  // Track an event and return newly unlocked achievements
  // For snapshot types: value = actual current value (e.g. player.level = 47)
  // For accumulative: value = how much to add (e.g. killed 1 monster)
  track(player, type, value = 1, extra = {}) {
    const pd = this.getPlayer(player);
    const newlyUnlocked = [];

    for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
      if (pd.unlocked.includes(id)) continue;
      const cond = ach.condition;
      if (cond.type !== type) continue;

      // Extra filters (rank, rarity, stat)
      if (cond.rank   && extra.rank   !== cond.rank)   continue;
      if (cond.rarity && extra.rarity !== cond.rarity) continue;
      if (cond.stat   && extra.stat   !== cond.stat)   continue;

      if (!pd.progress[id]) pd.progress[id] = 0;

      if (SNAPSHOT_TYPES.has(type)) {
        // For snapshot: set to the actual current value
        pd.progress[id] = Math.max(pd.progress[id], value);
      } else {
        // Accumulative: add the delta
        pd.progress[id] += value;
      }

      if (pd.progress[id] >= cond.count) {
        pd.unlocked.push(id);
        // Apply rewards directly to player
        player.gold         = (player.gold || 0)         + (ach.reward.gold     || 0);
        player.xp           = (player.xp || 0)           + (ach.reward.xp       || 0);
        player.manaCrystals = (player.manaCrystals || 0) + (ach.reward.crystals || 0);
        newlyUnlocked.push(ach);
      }
    }

    // Meta: track achievements_unlocked count — one pass, no recursion
    if (newlyUnlocked.length > 0) {
      const metaId = 'achievement_hunter_10';
      const meta50 = 'achievement_hunter_50';
      const metaAll = 'completionist';
      const totalUnlocked = pd.unlocked.length;

      for (const mid of [metaId, meta50, metaAll]) {
        if (pd.unlocked.includes(mid)) continue;
        const ach = ACHIEVEMENTS[mid];
        if (!ach) continue;
        pd.progress[mid] = totalUnlocked;
        if (totalUnlocked >= ach.condition.count) {
          pd.unlocked.push(mid);
          player.gold         = (player.gold || 0)         + (ach.reward.gold     || 0);
          player.xp           = (player.xp || 0)           + (ach.reward.xp       || 0);
          player.manaCrystals = (player.manaCrystals || 0) + (ach.reward.crystals || 0);
          newlyUnlocked.push(ach);
        }
      }
    }

    return newlyUnlocked;
  }

  // Build notification message for newly unlocked achievements
  buildNotification(achievements) {
    if (!achievements.length) return null;
    let msg = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏆 ACHIEVEMENT UNLOCKED!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    for (const ach of achievements) {
      const g = ach.reward.gold     > 0 ? '+' + ach.reward.gold.toLocaleString() + 'g ' : '';
      const x = ach.reward.xp       > 0 ? '+' + ach.reward.xp + 'xp ' : '';
      const c = ach.reward.crystals > 0 ? '+' + ach.reward.crystals + '💎' : '';
      msg += ach.name + '\n';
      msg += '📖 ' + ach.desc + '\n';
      msg += '🎁 ' + (g + x + c || 'No reward') + '\n\n';
    }
    msg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    return msg;
  }

  // Display for /achievements command
  getDisplay(player, category) {
    const pd = this.getPlayer(player);
    const total = Object.keys(ACHIEVEMENTS).length;
    const unlocked = pd.unlocked.length;

    let msg = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    msg += '🏆 ACHIEVEMENTS — ' + (player.name || 'Hunter') + '\n';
    msg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    msg += 'Progress: ' + unlocked + '/' + total + ' (' + Math.floor(unlocked/total*100) + '%)\n';
    msg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    const groups = {};
    for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
      if (category && ach.category.toLowerCase() !== category.toLowerCase()) continue;
      if (!groups[ach.category]) groups[ach.category] = { unlocked: [], locked: [] };
      const done = pd.unlocked.includes(id);
      const progress = pd.progress[id] || 0;
      const pct = Math.min(100, Math.floor(progress / ach.condition.count * 100));
      const entry = done ? '✅ ' + ach.name : '⬜ ' + ach.name + ' (' + pct + '%)';
      groups[ach.category][done ? 'unlocked' : 'locked'].push(entry);
    }

    for (const [cat, items] of Object.entries(groups)) {
      const catTotal = items.unlocked.length + items.locked.length;
      msg += '📂 ' + cat + ' (' + items.unlocked.length + '/' + catTotal + ')\n';
      for (const e of items.unlocked) msg += '  ' + e + '\n';
      for (const e of items.locked.slice(0, 3)) msg += '  ' + e + '\n';
      if (items.locked.length > 3) msg += '  ... +' + (items.locked.length - 3) + ' more locked\n';
      msg += '\n';
    }

    msg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    msg += '💡 /achievements <category> to filter';
    return msg;
  }
}

module.exports = new AchievementManager();
