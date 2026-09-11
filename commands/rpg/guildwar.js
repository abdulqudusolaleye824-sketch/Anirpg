// ═══════════════════════════════════════════════════════════════
// GUILD WAR — Weekly Contest Leaderboard & MVP Tracker
// ═══════════════════════════════════════════════════════════════

'use strict';

const WeeklyGuildWar = require('../../rpg/utils/WeeklyGuildWar');

module.exports = {
  name: 'guildwar',
  aliases: ['gw', 'war'],
  description: '🏆 Weekly Guild War contest leaderboard & rewards',

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
    const myGuild = Object.values(db.guilds || {}).find(g => g.members && g.members.some(m => (m.id || m) === sender));

    // Check for weekly rollover
    WeeklyGuildWar.checkWeeklyReset(db, saveDatabase);

    const sub = (args[0] || 'board').toLowerCase();

    // ── /guildwar history ──────────────────────────────────────────
    if (sub === 'history' || sub === 'past') {
      const history = db.guildWarWeekly?.history || [];
      if (history.length === 0) {
        return sock.sendMessage(chatId, { text: '📜 No completed weekly guild wars recorded yet.' }, { quoted: msg });
      }

      const histLines = [];
      history.slice(-5).reverse().forEach((h, i) => {
        histLines.push(`*Week ${h.weekKey}:*`);
        histLines.push(`  🥇 1st: *${h.first?.name || 'None'}* (${(h.first?.gp || 0).toLocaleString()} GP)`);
        histLines.push(`  🥈 2nd: *${h.second?.name || 'None'}* (${(h.second?.gp || 0).toLocaleString()} GP)`);
        histLines.push(`  🥉 3rd: *${h.third?.name || 'None'}* (${(h.third?.gp || 0).toLocaleString()} GP)`);
        histLines.push(`  🌟 MVP: *${h.mvp?.name || 'None'}* (${(h.mvp?.gp || 0).toLocaleString()} GP) — +20,000 Nexus`);
        histLines.push(``);
      });
      const titles = myGuild ? history.filter(h => h.first?.name === myGuild.name).length : 0;
      const text = UI.card(player, {
        icon: '📜', title: 'WEEKLY GUILD WAR HISTORY',
        lines: histLines,
        proLines: myGuild ? [`💎 *PRO WAR DESK* — ${myGuild.name} titles: *${titles}*`] : [`💎 *PRO WAR DESK* — join a guild to chase titles`],
        tip: '/guildwar for the live board',
      });
      return sock.sendMessage(chatId, { text }, { quoted: msg });
    }

    // ── /guildwar (leaderboard & info) ────────────────────────────
    const allGuilds = Object.values(db.guilds || {});
    allGuilds.sort((a, b) => (b.weeklyGP || 0) - (a.weeklyGP || 0));

    // Find current MVP across all players
    let topMvpJid = null;
    let topMvpGP  = 0;
    for (const [jid, u] of Object.entries(db.users || {})) {
      const ugp = u.weeklyGP || 0;
      if (ugp > topMvpGP) {
        topMvpGP = ugp;
        topMvpJid = jid;
      }
    }
    const mvpUser = topMvpJid ? db.users?.[topMvpJid] : null;
    const mvpName = mvpUser?.name || (topMvpJid ? topMvpJid.split('@')[0] : 'None');

    const { days, hours, mins } = WeeklyGuildWar.getTimeRemainingInWeek();

    const topLines = allGuilds.slice(0, 10).map((g, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🛡️';
      const gm = db.users?.[g.leader]?.name || g.leader.split('@')[0];
      return `${medal} *${i+1}. ${g.name}* (GM: ${gm})\n   📊 Weekly GP: *${(g.weeklyGP || 0).toLocaleString()} GP*`;
    });

    const myRank = myGuild ? allGuilds.findIndex(g => g === myGuild) + 1 : 0;
    const above = myRank > 1 ? allGuilds[myRank - 2] : null;
    const gap = above ? (above.weeklyGP || 0) - (myGuild.weeklyGP || 0) : 0;
    const text = UI.card(player, {
      icon: '⚔️', title: 'WEEKLY GUILD WAR CONTEST',
      lines: [
        `⏰ Cycle Ends: *${days}d ${hours}h ${mins}m* (Sat 23:59)`,
        `🏆 MVP Candidate: *${mvpName}* (*+${topMvpGP.toLocaleString()} GP*)`,
        ``,
        `🏆 *TOP GUILDS LEADERBOARD:*`,
        ...(topLines.length ? topLines : ['  _(No Guild GP recorded this week yet)_']),
        ``,
        `🎁 *WEEKLY REWARDS (Auto Sat 23:59):*`,
        `🥇 Gold GVC — /use GVC --gold`,
        `🥈 Silver GVC — /use GVC --silver`,
        `🥉 Bronze GVC — /use GVC --bronze`,
        `🌟 Weekly MVP: +20,000 Nexus (any guild!)`,
        ``,
        `💡 *EARN GP:* Gate Clears • Upgrades • Signings • PvP Wins • Level-ups`,
        `📌 */myguild* — your guild's member breakdown`,
      ],
      proLines: myGuild
        ? [`💎 *PRO WAR DESK*`, `  🛡️ ${myGuild.name} rank *#${myRank}* · ${UI.num(myGuild.weeklyGP)} GP` + (above ? ` · *${UI.num(gap)}* behind ${above.name}` : ` · leading the pack!`)]
        : [`💎 *PRO WAR DESK* — join a guild to earn GP`],
      tip: 'PvP wins feed your guild GP',
    });

    return sock.sendMessage(chatId, { text }, { quoted: msg });
  }
};
