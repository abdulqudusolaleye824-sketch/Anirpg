// ═══════════════════════════════════════════════════════════════
// WEEKLY GUILD WAR & GUILD POINTS (GP) SYSTEM
// Cycle: Sunday 00:00 WAT -> Saturday 23:59 WAT
// ═══════════════════════════════════════════════════════════════

'use strict';

function getWeekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function normaliseJid(jid) {
  if (!jid) return '';
  const raw = String(jid).split('@')[0].split(':')[0].toLowerCase();
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.length > 0 ? digits : raw;
}

/**
 * Push #47: JID-tolerant player lookup. Guild member ids and db.users keys can
 * disagree on the device half (@lid vs @s.whatsapp.net, or a :device suffix), and
 * the payout used an exact `db.users[pid]` — those members silently got no
 * victory card. Exact key first (fast path), then the digit-normalised form.
 */
function findPlayer(db, id) {
  if (!db?.users || !id) return null;
  if (db.users[id]) return db.users[id];
  const want = normaliseJid(id);
  if (!want) return null;
  for (const [jid, user] of Object.entries(db.users)) {
    if (normaliseJid(jid) === want) return user;
  }
  return null;
}

function findGuildForPlayer(db, playerId) {
  if (!db?.guilds) return null;
  const pNum = normaliseJid(playerId);
  if (!pNum) return null;
  return Object.values(db.guilds).find(g =>
    g.members && g.members.some(m => {
      const id = typeof m === 'object' ? m.id : m;
      return normaliseJid(id) === pNum;
    })
  ) || null;
}

function getTimeRemainingInWeek() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 6 = Sat
  const satEnd = new Date(now);
  
  const daysUntilSat = (6 - day + 7) % 7;
  satEnd.setDate(now.getDate() + daysUntilSat);
  satEnd.setHours(23, 59, 59, 999);

  const diffMs = Math.max(0, satEnd - now);
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);

  return { days, hours, mins, diffMs, satEnd };
}

function checkWeeklyReset(db, saveDatabase) {
  if (!db) return;
  if (!db.guildWarWeekly) {
    db.guildWarWeekly = {
      currentWeek: getWeekKey(),
      history: []
    };
  }

  const currentWeek = getWeekKey();
  if (db.guildWarWeekly.currentWeek !== currentWeek) {
    const finishedWeek = db.guildWarWeekly.currentWeek;
    const summary = resolveWeeklyWar(db, finishedWeek, saveDatabase);
    db.guildWarWeekly.currentWeek = currentWeek;
    if (saveDatabase) saveDatabase();
    return summary;   // Push #56: the caller announces the podium
  }
  return null;
}

/**
 * The Guild War victory card (Push #56).
 *
 * The awards themselves were already granted — into `player.inventory.cards`
 * in total silence — and nothing announced them, so from the guilds' side
 * Weekly Guild War "had no victory card". Pure function, so it is testable.
 */
function buildResultsCard(summary, db) {
  if (!summary) return null;
  const { first, second, third, mvp } = summary;
  if (!first && !second && !third && !mvp) return null;
  const CARD = '━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const rowFor = (g, medal, label) => {
    if (!g) return null;
    const parts = [`${medal} *${g.name}* — ${Number(g.gp || 0).toLocaleString()} GP`];
    if (g.error) parts.push(`    ⚠️ ${g.error}`);
    else parts.push(`    🎫 ${label} ×${Number(g.granted || 0)} — one per member${g.flag ? ` (*/use GVC ${g.flag}*)` : ''}`);
    return parts.join('\n');
  };
  const lines = [
    CARD,
    '🏆 *WEEKLY GUILD WAR — FINAL RESULTS*',
    CARD,
    `📅 War week: *${summary.weekKey || 'closed'}*`,
    '',
    rowFor(first, '🥇', 'GOLD victory cards') || '🥇 No guild defended the top spot this week.',
    rowFor(second, '🥈', 'SILVER victory cards'),
    rowFor(third, '🥉', 'BRONZE victory cards'),
    '',
    mvp
      ? `⭐ *WEEKLY MVP:* ${mvp.name} — ${Number(mvp.gp || 0).toLocaleString()} GP\n    🎁 +20,000 💠 Nexus · title *Weekly Guild War MVP*`
      : '⭐ No MVP this week — nobody earned GP.',
    '',
    `🎫 Cards are already in your inventory: */use GVC --gold* · *--silver* · *--bronze*`,
    `📊 Your standing + next war: */guildwar*`,
    CARD,
  ].filter((l) => l !== null && l !== undefined);
  return lines.join('\n');
}

function resolveWeeklyWar(db, weekKey, saveDatabase) {
  const allGuilds = Object.values(db.guilds || {});
  // Push #47: re-derive weekly totals from members right before ranking. A
  // guild's weeklyGP is only recomputed when someone earns GP, so a guild whose
  // last addGP landed before the week flipped could rank at 0 despite earning.
  for (const g of allGuilds) {
    if (!Array.isArray(g.members)) continue;
    let sum = 0;
    for (const m of g.members) {
      const u = findPlayer(db, typeof m === 'object' ? m.id : m);
      if (u) sum += u.weeklyGP || 0;
    }
    if (sum > (g.weeklyGP || 0)) g.weeklyGP = sum;
  }
  const activeGuilds = allGuilds.filter(g => (g.weeklyGP || 0) > 0);
  activeGuilds.sort((a, b) => (b.weeklyGP || 0) - (a.weeklyGP || 0));

  const winners = {
    first: activeGuilds[0] || null,
    second: activeGuilds[1] || null,
    third: activeGuilds[2] || null
  };

  // 1. Award 1st Place (Gold Victory Card)
  const awarded = {};
  if (winners.first) {
    awarded.first = awardVictoryCardToGuildMembers(db, winners.first, 'gvc_gold');
  }

  // 2. Award 2nd Place (Silver Victory Card)
  if (winners.second) {
    awarded.second = awardVictoryCardToGuildMembers(db, winners.second, 'gvc_silver');
  }

  // 3. Award 3rd Place (Bronze Victory Card)
  if (winners.third) {
    awarded.third = awardVictoryCardToGuildMembers(db, winners.third, 'gvc_bronze');
  }

  // 4. Resolve Weekly MVP across ALL players in the game
  const allUsers = Object.entries(db.users || {});
  let mvpUserJid = null;
  let maxUserGP = 0;

  for (const [jid, u] of allUsers) {
    const userGP = u.weeklyGP || 0;
    if (userGP > maxUserGP) {
      maxUserGP = userGP;
      mvpUserJid = jid;
    }
  }

  let mvpName = null;
  if (mvpUserJid && maxUserGP > 0) {
    const mvpUser = db.users[mvpUserJid];
    mvpUser.gold = (mvpUser.gold || 0) + 20000; // MVP gets 20,000 Nexus
    mvpName = mvpUser.name || mvpUserJid.split('@')[0];
    if (!mvpUser.titles) mvpUser.titles = [];
    if (!mvpUser.titles.includes('Weekly Guild War MVP')) {
      mvpUser.titles.push('Weekly Guild War MVP');
    }
  }

  // Record history
  if (!db.guildWarWeekly) db.guildWarWeekly = { currentWeek: getWeekKey(), history: [] };
  if (!db.guildWarWeekly.history) db.guildWarWeekly.history = [];
  
  db.guildWarWeekly.history.push({
    weekKey,
    resolvedAt: Date.now(),
    first: winners.first ? { name: winners.first.name, gp: winners.first.weeklyGP } : null,
    second: winners.second ? { name: winners.second.name, gp: winners.second.weeklyGP } : null,
    third: winners.third ? { name: winners.third.name, gp: winners.third.weeklyGP } : null,
    mvp: mvpUserJid ? { jid: mvpUserJid, name: mvpName, gp: maxUserGP } : null
  });

  // Push #56: snapshot the podium's GP before the wipe — the results card has
  // to report what the guild actually scored, not the zero it is about to get.
  const finalGp = {
    first: winners.first ? (winners.first.weeklyGP || 0) : 0,
    second: winners.second ? (winners.second.weeklyGP || 0) : 0,
    third: winners.third ? (winners.third.weeklyGP || 0) : 0,
  };

  // Reset weekly GP for all guilds and members
  for (const g of allGuilds) {
    g.weeklyGP = 0;
  }
  for (const [, u] of allUsers) {
    u.weeklyGP = 0;
  }

  if (saveDatabase) saveDatabase();

  // Push #56: return a summary so the podium can be announced, with the number
  // of cards ACTUALLY granted — a guild whose members could not be located is
  // reported honestly instead of claiming a clean sweep.
  const sizeOf = (g) => (g && Array.isArray(g.members)) ? g.members.length : 0;
  const pack = (g, flag, res, gp) => g ? {
    name: g.name || 'Unnamed Guild',
    gp: Number(gp != null ? gp : (g.weeklyGP || 0)),
    size: sizeOf(g),
    granted: res ? res.granted : 0,
    flag,
    error: (res && res.granted > 0) || !sizeOf(g) ? null : 'members could not be located — no cards granted',
  } : null;
  return {
    weekKey,
    first: pack(winners.first, '--gold', awarded.first, finalGp.first),
    second: pack(winners.second, '--silver', awarded.second, finalGp.second),
    third: pack(winners.third, '--bronze', awarded.third, finalGp.third),
    mvp: mvpUserJid ? { jid: mvpUserJid, name: mvpName, gp: maxUserGP } : null,
  };
}

function awardVictoryCardToGuildMembers(db, guild, cardType) {
  if (!guild || !Array.isArray(guild.members)) return { granted: 0, total: 0 };
  let granted = 0;
  for (const m of guild.members) {
    const pid = typeof m === 'object' ? m.id : m;
    const player = findPlayer(db, pid); // was db.users?.[pid] — exact key missed JID twins
    if (player) {
      if (!player.inventory) player.inventory = {};
      if (!player.inventory.cards) player.inventory.cards = {};
      player.inventory.cards[cardType] = (player.inventory.cards[cardType] || 0) + 1;
      granted++;
    }
  }
  return { granted, total: guild.members.length };
}

function addGP(db, playerId, points, saveDatabase) {
  // Central ledger: weekly + lifetime + guild.guildPoints + gp quest stay in sync
  try {
    const GPS = require('./GuildPointsSystem');
    if (GPS.addGuildGP) { GPS.addGuildGP(db, playerId, points, 'Weekly war GP', { saveDatabase, quest: points > 0, jid: playerId }); return; }
  } catch(e){}
  try {
    if (!db || !playerId || !points) return;
    checkWeeklyReset(db, saveDatabase);

    const player = db.users?.[playerId];
    if (!player) return;

    player.weeklyGP = (player.weeklyGP || 0) + points;
    player.totalGP  = (player.totalGP  || 0) + points;

    const guild = findGuildForPlayer(db, playerId);
    if (guild) {
      guild.weeklyGP = (guild.weeklyGP || 0) + points;
      guild.totalGP  = (guild.totalGP  || 0) + points;
    }

    if (saveDatabase) saveDatabase();
  } catch(e) {}
}

module.exports = {
  buildResultsCard,
  findPlayer,
  getWeekKey,
  getTimeRemainingInWeek,
  checkWeeklyReset,
  resolveWeeklyWar,
  addGP,
  findGuildForPlayer,
};
