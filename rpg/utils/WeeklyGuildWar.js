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
    resolveWeeklyWar(db, finishedWeek, saveDatabase);
    db.guildWarWeekly.currentWeek = currentWeek;
    if (saveDatabase) saveDatabase();
  }
}

function resolveWeeklyWar(db, weekKey, saveDatabase) {
  const allGuilds = Object.values(db.guilds || {});
  const activeGuilds = allGuilds.filter(g => (g.weeklyGP || 0) > 0);
  activeGuilds.sort((a, b) => (b.weeklyGP || 0) - (a.weeklyGP || 0));

  const winners = {
    first: activeGuilds[0] || null,
    second: activeGuilds[1] || null,
    third: activeGuilds[2] || null
  };

  // 1. Award 1st Place (Gold Victory Card)
  if (winners.first) {
    awardVictoryCardToGuildMembers(db, winners.first, 'gvc_gold');
  }

  // 2. Award 2nd Place (Silver Victory Card)
  if (winners.second) {
    awardVictoryCardToGuildMembers(db, winners.second, 'gvc_silver');
  }

  // 3. Award 3rd Place (Bronze Victory Card)
  if (winners.third) {
    awardVictoryCardToGuildMembers(db, winners.third, 'gvc_bronze');
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

  // Reset weekly GP for all guilds and members
  for (const g of allGuilds) {
    g.weeklyGP = 0;
  }
  for (const [, u] of allUsers) {
    u.weeklyGP = 0;
  }

  if (saveDatabase) saveDatabase();
}

function awardVictoryCardToGuildMembers(db, guild, cardType) {
  if (!guild || !Array.isArray(guild.members)) return;
  for (const m of guild.members) {
    const pid = typeof m === 'object' ? m.id : m;
    const player = db.users?.[pid];
    if (player) {
      if (!player.inventory) player.inventory = {};
      if (!player.inventory.cards) player.inventory.cards = {};
      player.inventory.cards[cardType] = (player.inventory.cards[cardType] || 0) + 1;
    }
  }
}

function addGP(db, playerId, points, saveDatabase) {
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
  getWeekKey,
  getTimeRemainingInWeek,
  checkWeeklyReset,
  resolveWeeklyWar,
  addGP,
  findGuildForPlayer,
};
