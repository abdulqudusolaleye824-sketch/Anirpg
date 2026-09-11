/**
 * ╔══════════════════════════════════════════════════════╗
 * ║       Astra — Guild Points & War Points             ║
 * ║  GP: earned by guild activity                        ║
 * ║  WP: earned by Guild Wars                            ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Guild Points (GP):
 *   - Dungeon clear by guild member: +15 GP
 *   - Guild raid boss kill: +50 GP
 *   - Member donation: +1 GP per 5,000 Nexus donated
 *   - Daily quest completion: +5 GP
 *   - World boss contribution: +20 GP
 *
 * Guild War Points (WP):
 *   - Win a Guild War: +100 WP
 *   - Lose a Guild War: +10 WP (consolation)
 *   - MVP of a war (most kills): +25 WP bonus
 *   - Perfect war victory (no losses): +50 WP bonus
 *
 * GP Ranks (by cumulative GP):
 *   Iron     0–999     ⚫
 *   Bronze   1,000     🟤
 *   Silver   5,000     ⬜
 *   Nexus     15,000    🟡
 *   Platinum 35,000    🩵
 *   Diamond  75,000    💎
 *   Legend   150,000   👑
 */

'use strict';

const GP_RANKS = [
  { name: 'Iron',     emoji: '⚫', min: 0      },
  { name: 'Bronze',   emoji: '🟤', min: 1000   },
  { name: 'Silver',   emoji: '⬜', min: 5000   },
  { name: 'Nexus',     emoji: '🟡', min: 15000  },
  { name: 'Platinum', emoji: '🩵', min: 35000  },
  { name: 'Diamond',  emoji: '💎', min: 75000  },
  { name: 'Legend',   emoji: '👑', min: 150000 },
];

function getGPRank(totalGP) {
  for (let i = GP_RANKS.length - 1; i >= 0; i--) {
    if (totalGP >= GP_RANKS[i].min) return GP_RANKS[i];
  }
  return GP_RANKS[0];
}

// ── Award Guild Points ────────────────────────────────────────────────────────
function awardGP(guild, amount, reason) {
  if (!guild) return;
  if (!guild.guildPoints) guild.guildPoints = 0;
  if (!guild.gpLog) guild.gpLog = [];
  guild.guildPoints += amount;
  guild.gpLog.push({ amount, reason, at: Date.now() });
  if (guild.gpLog.length > 50) guild.gpLog = guild.gpLog.slice(-50);
}

// ── Award War Points ──────────────────────────────────────────────────────────
function awardWP(guild, amount, reason) {
  if (!guild) return;
  if (!guild.warPoints) guild.warPoints = 0;
  if (!guild.wpLog) guild.wpLog = [];
  guild.warPoints += amount;
  guild.wpLog.push({ amount, reason, at: Date.now() });
  if (guild.wpLog.length > 50) guild.wpLog = guild.wpLog.slice(-50);
}

// ── GP from dungeon clear ─────────────────────────────────────────────────────
function onDungeonClear(guild) {
  awardGP(guild, 15, 'Dungeon clear');
}

// ── GP from guild raid kill ───────────────────────────────────────────────────
function onGuildRaidKill(guild) {
  awardGP(guild, 50, 'Guild raid boss defeated');
}

// ── GP from donation ──────────────────────────────────────────────────────────
function onDonation(guild, goldAmount) {
  const gpEarned = Math.floor(goldAmount / 5000);
  if (gpEarned > 0) awardGP(guild, gpEarned, `Donation: ${goldAmount.toLocaleString()} gold`);
  return gpEarned;
}

// ── GP from daily quest ───────────────────────────────────────────────────────
function onDailyQuestComplete(guild) {
  awardGP(guild, 5, 'Daily quest completed');
}

// ── GP from world boss ────────────────────────────────────────────────────────
function onWorldBossContribution(guild) {
  awardGP(guild, 20, 'World boss contribution');
}

// ── WP from Guild War result ──────────────────────────────────────────────────
function onGuildWarResult(winnerGuild, loserGuild, mvpBonus = false, perfectVictory = false) {
  let winnerWP = 100;
  if (mvpBonus)      winnerWP += 25;
  if (perfectVictory) winnerWP += 50;
  awardWP(winnerGuild, winnerWP, `Guild War victory${perfectVictory?' (Perfect)':''}${mvpBonus?' + MVP':''}`);
  awardWP(loserGuild,  10,       'Guild War participation');
}

// ── Format guild points display ───────────────────────────────────────────────
function formatGuildPoints(guild) {
  const gp   = guild.guildPoints || 0;
  const wp   = guild.warPoints   || 0;
  const rank = getGPRank(gp);
  const nextRankIdx = GP_RANKS.findIndex(r => r.name === rank.name) + 1;
  const nextRank    = GP_RANKS[nextRankIdx];
  const toNext      = nextRank ? ` | ${(nextRank.min - gp).toLocaleString()} to ${nextRank.name}` : ' | MAX RANK';

  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏰 *${guild.name}* — Guild Points`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `${rank.emoji} Rank: *${rank.name}*${toNext}`,
    `🏅 Guild Points: *${gp.toLocaleString()} GP*`,
    `⚔️ War Points:   *${wp.toLocaleString()} WP*`,
    ``,
    `📊 *HOW TO EARN GP:*`,
    `  +15 — Dungeon clear`,
    `  +50 — Guild raid boss kill`,
    `  +1  — Per 5,000 Nexus donated`,
    `  +5  — Daily quest complete`,
    `  +20 — World boss contribution`,
    ``,
    `📊 *HOW TO EARN WP:*`,
    `  +100 — Win a Guild War`,
    `  +25  — MVP of a war`,
    `  +50  — Perfect victory (no losses)`,
    `  +10  — Participation (even if lost)`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');
}

// ── CENTRAL GP LEDGER ─────────────────────────────────────────────────────────
// Single entry point for ALL guild-point changes. Keeps every ledger in sync:
//   • player.weeklyGP / player.totalGP (weekly war leaderboard + lifetime)
//   • guild.weeklyGP / guild.totalGP   (weekly war leaderboard + lifetime)
//   • guild.guildPoints + gpLog        (GP ranks + audit trail)
// Negative amounts are floored at 0 (ledgers never go negative).
// opts: { quest(bool: dispatch 'gp' daily-quest), sock, jid, chatId, saveDatabase }
function addGuildGP(db, playerId, points, reason, opts = {}) {
  try {
    if (!db || !playerId || !points) return 0;
    try { require('./WeeklyGuildWar').checkWeeklyReset(db, opts.saveDatabase || null); } catch(e){}
    const player = db.users?.[playerId];
    const _hadGP = (player?.weeklyGP || 0) > 0;
    if (player) {
      player.weeklyGP = Math.max(0, (player.weeklyGP || 0) + points);
      player.totalGP  = Math.max(0, (player.totalGP  || 0) + points);
    }
    // Guild War participation: first GP of the week = entered the war
    if (points > 0 && !_hadGP && player) {
      try { require('./QuestDispatcher').trackAndNotify(player, 'gw', 1, opts.sock || null, opts.jid || playerId, opts.chatId || null); } catch(e){}
    }
    const guild = findPlayerGuild(playerId, db);
    if (guild) {
      guild.weeklyGP = Math.max(0, (guild.weeklyGP || 0) + points);
      guild.totalGP  = Math.max(0, (guild.totalGP  || 0) + points);
      awardGP(guild, points, reason || 'GP adjustment');
      if (guild.guildPoints < 0) guild.guildPoints = 0;
    }
    // Daily-quest wiring: GP earned counts toward Guild Pillar etc.
    if (opts.quest && points > 0 && player) {
      try { require('./QuestDispatcher').trackAndNotify(player, 'gp', points, opts.sock || null, opts.jid || playerId, opts.chatId || null); } catch(e){}
    }
    if (opts.saveDatabase) { try { opts.saveDatabase(); } catch(e){} }
    return points;
  } catch(e){ return 0; }
}

// ── Find player's guild ───────────────────────────────────────────────────────
function findPlayerGuild(sender, db) {
  if (!db.guilds) return null;
  return Object.values(db.guilds).find(g =>
    g.members && (g.members.includes(sender) ||
    g.members.some(m => (typeof m === 'object' ? m.id : m) === sender))
  ) || null;
}

module.exports = {
  GP_RANKS,
  getGPRank,
  awardGP,
  awardWP,
  onDungeonClear,
  onGuildRaidKill,
  onDonation,
  onDailyQuestComplete,
  onWorldBossContribution,
  onGuildWarResult,
  formatGuildPoints,
  findPlayerGuild,
  addGuildGP,
};
