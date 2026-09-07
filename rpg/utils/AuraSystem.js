// ═══════════════════════════════════════════════════════════════
// AURA SYSTEM — Solo Leveling Social/Rep Mini-Game
//
// Aura is the social currency of the hunter world.
// You gain it by winning PvP, clearing hard gates, performing
// well in raids, and reaching milestones.
// High aura = recognition = prestige.
//
// Aura leaderboard is per-guild AND global.
// ═══════════════════════════════════════════════════════════════

// ─── AURA TITLE THRESHOLDS ───────────────────────────────────────
const AURA_TITLES = [
  { min: 0,       title: 'Unknown',          emoji: '⬛', description: 'No one knows who you are.' },
  { min: 100,     title: 'Rookie Hunter',     emoji: '🟫', description: 'You\'ve started making a name for yourself.' },
  { min: 500,     title: 'Rising Hunter',     emoji: '🟦', description: 'Word is spreading about you.' },
  { min: 1500,    title: 'Recognized Hunter', emoji: '🟩', description: 'The Association knows your name.' },
  { min: 4000,    title: 'Notable Hunter',    emoji: '🟨', description: 'Other hunters respect you.' },
  { min: 10000,   title: 'Elite Hunter',      emoji: '🟧', description: 'You\'re among the top tier.' },
  { min: 25000,   title: 'Legendary Hunter',  emoji: '🟥', description: 'Your name causes gates to tremble.' },
  { min: 60000,   title: 'National Hero',     emoji: '💜', description: 'The government watches your every move.' },
  { min: 150000,  title: 'World-Class Hunter',emoji: '🌟', description: 'You\'re known across every country.' },
  { min: 500000,  title: 'Sovereign',         emoji: '👑', description: 'An existence beyond human measure.' },
];

// ─── AURA GAIN EVENTS ─────────────────────────────────────────────
const AURA_GAINS = {
  pvpWin:          { amount: 25,   message: '⚡ +25 Aura (PvP Win)' },
  pvpWinStreak3:   { amount: 75,   message: '🔥 +75 Aura (3-Win Streak!)' },
  pvpWinStreak5:   { amount: 200,  message: '💥 +200 Aura (5-Win Streak!!)' },
  pvpWinStreak10:  { amount: 500,  message: '🌟 +500 Aura (10-Win Streak!!!)' },
  gateClear_F:     { amount: 5,    message: '⬛ +5 Aura (F-Gate Cleared)' },
  gateClear_E:     { amount: 15,   message: '⚫ +15 Aura (E-Gate Cleared)' },
  gateClear_D:     { amount: 40,   message: '🟤 +40 Aura (D-Gate Cleared)' },
  gateClear_C:     { amount: 100,  message: '🔵 +100 Aura (C-Gate Cleared)' },
  gateClear_B:     { amount: 250,  message: '🟢 +250 Aura (B-Gate Cleared)' },
  gateClear_A:     { amount: 600,  message: '🟡 +600 Aura (A-Gate Cleared)' },
  gateClear_S:     { amount: 1500, message: '🔴 +1500 Aura (S-Gate Cleared)' },
  gateClear_DISASTER: { amount: 5000, message: '🟣 +5000 Aura (DISASTER Gate Cleared!!)' },
  bossKill:        { amount: 30,   message: '💀 +30 Aura (Boss Killed)' },
  topRaider:       { amount: 100,  message: '🏆 +100 Aura (Top Raider in Gate)' },
  levelMilestone:  { amount: 50,   message: '📈 +50 Aura (Level Milestone)' },
  classUnlock:     { amount: 200,  message: '🎭 +200 Aura (Class Awakened)' },
  firstGate:       { amount: 50,   message: '🚪 +50 Aura (First Gate Cleared!)' },
  guildFounder:    { amount: 300,  message: '🏰 +300 Aura (Guild Founded)' },
  weeklyTop3:      { amount: 500,  message: '🥇 +500 Aura (Weekly Top 3)' },
};

// ─── AURA LOSS EVENTS ─────────────────────────────────────────────
const AURA_LOSSES = {
  pvpLoss:         { amount: 10,  message: '📉 -10 Aura (PvP Loss)' },
  fleeFromGate:    { amount: 50,  message: '🏃 -50 Aura (Fled from Gate)' },
  deathInGate:     { amount: 30,  message: '💀 -30 Aura (Died in Gate)' },
  gateAbandoned:   { amount: 100, message: '⛔ -100 Aura (Gate Abandoned)' },
};

// ─── AURA SYSTEM CLASS ────────────────────────────────────────────
class AuraSystem {

  // Get player's current aura title
  static getAuraTitle(aura = 0) {
    let current = AURA_TITLES[0];
    for (const tier of AURA_TITLES) {
      if (aura >= tier.min) current = tier;
      else break;
    }
    return current;
  }

  // Add aura to player — returns new total + if title changed
  static addAura(player, eventKey) {
    const event = AURA_GAINS[eventKey];
    if (!event) return null;

    const oldAura = player.aura || 0;
    const oldTitle = this.getAuraTitle(oldAura);

    player.aura = oldAura + event.amount;

    const newTitle = this.getAuraTitle(player.aura);
    const titleChanged = newTitle.title !== oldTitle.title;

    if (titleChanged) {
      player.auraTitle = newTitle.title;
    }

    return {
      gained: event.amount,
      message: event.message,
      newTotal: player.aura,
      titleChanged,
      newTitle: titleChanged ? newTitle : null,
    };
  }

  // Remove aura from player
  static removeAura(player, eventKey) {
    const event = AURA_LOSSES[eventKey];
    if (!event) return null;

    const oldAura = player.aura || 0;
    player.aura = Math.max(0, oldAura - event.amount);

    return {
      lost: event.amount,
      message: event.message,
      newTotal: player.aura,
    };
  }

  // Add raw aura amount (for custom events)
  static addRawAura(player, amount, reason = '') {
    const oldTitle = this.getAuraTitle(player.aura || 0);
    player.aura = (player.aura || 0) + amount;
    const newTitle = this.getAuraTitle(player.aura);
    const titleChanged = newTitle.title !== oldTitle.title;
    if (titleChanged) player.auraTitle = newTitle.title;
    return { gained: amount, newTotal: player.aura, titleChanged, newTitle: titleChanged ? newTitle : null, reason };
  }

  // Format aura display for profile
  static formatAura(player) {
    const aura = player.aura || 0;
    const title = this.getAuraTitle(aura);
    const next = AURA_TITLES.find(t => t.min > aura);
    const progress = next ? `${(aura - title.min).toLocaleString()} / ${(next.min - title.min).toLocaleString()} to *${next.title}*` : `MAX`;

    return [
      `${title.emoji} *${title.title}*`,
      `✨ Aura: *${aura.toLocaleString()}*`,
      `📊 Progress: ${progress}`,
    ].join('\n');
  }

  // Get global aura leaderboard from db
  static getLeaderboard(db, limit = 10) {
    const users = Object.values(db.users || {})
      .filter(u => u && !u.banned)
      .sort((a, b) => (b.aura || 0) - (a.aura || 0))
      .slice(0, limit);

    return users.map((u, i) => {
      const title = this.getAuraTitle(u.aura || 0);
      const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${rankEmoji} *${u.name}* — ${(u.aura || 0).toLocaleString()} ✨ ${title.emoji} ${title.title}`;
    });
  }

  // Get guild aura leaderboard
  static getGuildLeaderboard(db, guildName, limit = 10) {
    const guild = db.guilds?.[guildName];
    if (!guild) return [];

    const members = (guild.members || [])
      .map(jid => db.users[jid])
      .filter(Boolean)
      .sort((a, b) => (b.aura || 0) - (a.aura || 0))
      .slice(0, limit);

    return members.map((u, i) => {
      const title = this.getAuraTitle(u.aura || 0);
      const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${rankEmoji} *${u.name}* — ${(u.aura || 0).toLocaleString()} ✨ ${title.emoji}`;
    });
  }

  // PvP win streak aura event key
  static getPvpStreakEvent(streak) {
    if (streak >= 10) return 'pvpWinStreak10';
    if (streak >= 5)  return 'pvpWinStreak5';
    if (streak >= 3)  return 'pvpWinStreak3';
    return 'pvpWin';
  }

  // Gate clear aura event key
  static getGateClearEvent(gateRank) {
    return `gateClear_${gateRank}`;
  }
}

module.exports = { AuraSystem, AURA_TITLES, AURA_GAINS, AURA_LOSSES };