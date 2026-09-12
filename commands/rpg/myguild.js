// ═══════════════════════════════════════════════════════════════
// /myguild — View your guild's weekly Guild Points (GP) leaderboard
// ═══════════════════════════════════════════════════════════════

'use strict';

const WeeklyGuildWar = require('../../rpg/utils/WeeklyGuildWar');

module.exports = {
  name: 'myguild',
  aliases: ['myg', 'guildpts', 'guildgp'],
  description: '📊 View ranked weekly Guild Points (GP) for your guildmates',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const player = db.users?.[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    }
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    WeeklyGuildWar.checkWeeklyReset(db, saveDatabase);

    const guild = WeeklyGuildWar.findGuildForPlayer(db, sender);
    if (!guild) {
      return sock.sendMessage(chatId, {
        text: '❌ You are not in a guild! Join or create one with /guild create or /guild join.'
      }, { quoted: msg });
    }

    // Rank all members in the guild by weeklyGP
    const members = (guild.members || []).map(m => {
      const pid = typeof m === 'object' ? m.id : m;
      const rank = typeof m === 'object' ? m.rank : 'Member';
      const u = db.users?.[pid];
      return {
        id: pid,
        name: u?.name || pid.split('@')[0],
        rank,
        weeklyGP: u?.weeklyGP || 0,
        totalGP: u?.totalGP || 0
      };
    });

    members.sort((a, b) => b.weeklyGP - a.weeklyGP);

    // Calculate guild rank in server
    const allGuilds = Object.values(db.guilds || {});
    allGuilds.sort((a, b) => (b.weeklyGP || 0) - (a.weeklyGP || 0));
    const serverRankIndex = allGuilds.findIndex(g => g.name === guild.name);
    const serverRankText = serverRankIndex >= 0 ? `#${serverRankIndex + 1}` : 'Unranked';

    const { days, hours, mins } = WeeklyGuildWar.getTimeRemainingInWeek();

    const memberLines = members.map((m, i) => {
      const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤';
      const roleTag = m.rank === 'Leader' || m.rank === 'Guild Master' ? '👑' : m.rank === 'Vice' || m.rank === 'Vice GM' ? '⭐' : m.rank === 'Officer' ? '🛡️' : '';
      return `${i+1}. ${rankIcon} *${m.name}* ${roleTag}\n   📊 Weekly GP: *+${m.weeklyGP.toLocaleString()} GP*`;
    });

    const myIdx = members.findIndex(m => m.id === sender);
    // Batch-47: guild icon + bio show here (/guild icon, /guild bio).
    const _gIcon47 = guild.icon ? `${guild.icon} ` : '';
    const text = [
      ...(pro ? [UI.PRO_BAR, `🏰 *${_gIcon47}${guild.name.toUpperCase()} — WEEKLY GP RANKINGS* 💎`, UI.PRO_BAR] : [`🏰 *${_gIcon47}${guild.name.toUpperCase()} — WEEKLY GP RANKINGS*`, UI.FREE_BAR]),
      ...(guild.bio ? [`📝 _${guild.bio}_`] : []),
      `👑 Leader: *${db.users?.[guild.leader]?.name || guild.leader.split('@')[0]}*`,
      `🏆 Server Rank: *${serverRankText}* of ${allGuilds.length}`,
      `📊 Guild Weekly GP: *${(guild.weeklyGP || 0).toLocaleString()} GP*`,
      `⏰ Cycle Ends In: *${days}d ${hours}h ${mins}m* (Sat 23:59)`,
      FRAME,
      `👥 *MEMBER WEEKLY BREAKDOWN (${members.length}):*`,
      ``,
      ...memberLines,
      ``,
      FRAME,
      `💡 *Earn GP from:* Gate Clears, Upgrades, Signings, PvP Wins, and Level Ups!`,
      ...(pro ? [FRAME, UI.PRO_MINI, myIdx >= 0 ? `💎 *PRO CONTRIBUTOR* — you rank *#${myIdx + 1}* of ${members.length} (+${members[myIdx].weeklyGP.toLocaleString()} GP)` : `💎 *PRO CONTRIBUTOR* — earn GP to rank!`] : [FRAME, UI.upsell()]),
    ].join('\n');

    return sock.sendMessage(chatId, { text }, { quoted: msg });
  }
};
