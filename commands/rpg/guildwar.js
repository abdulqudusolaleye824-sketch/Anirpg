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

    // Check for weekly rollover
    WeeklyGuildWar.checkWeeklyReset(db, saveDatabase);

    const sub = (args[0] || 'board').toLowerCase();

    // ── /guildwar history ──────────────────────────────────────────
    if (sub === 'history' || sub === 'past') {
      const history = db.guildWarWeekly?.history || [];
      if (history.length === 0) {
        return sock.sendMessage(chatId, { text: '📜 No completed weekly guild wars recorded yet.' }, { quoted: msg });
      }

      const lines = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📜 *WEEKLY GUILD WAR HISTORY*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ];

      history.slice(-5).reverse().forEach((h, i) => {
        lines.push(`*Week ${h.weekKey}:*`);
        lines.push(`  🥇 1st: *${h.first?.name || 'None'}* (${(h.first?.gp || 0).toLocaleString()} GP)`);
        lines.push(`  🥈 2nd: *${h.second?.name || 'None'}* (${(h.second?.gp || 0).toLocaleString()} GP)`);
        lines.push(`  🥉 3rd: *${h.third?.name || 'None'}* (${(h.third?.gp || 0).toLocaleString()} GP)`);
        lines.push(`  🌟 MVP: *${h.mvp?.name || 'None'}* (${(h.mvp?.gp || 0).toLocaleString()} GP) — +20,000 Nexus`);
        lines.push(``);
      });

      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
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

    const text = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚔️ *WEEKLY GUILD WAR CONTEST*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⏰ Cycle Ends: *${days}d ${hours}h ${mins}m* (Sat 23:59)`,
      `🏆 Current MVP Candidate: *${mvpName}* (*+${topMvpGP.toLocaleString()} GP*)`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🏆 *TOP GUILDS LEADERBOARD:*`,
      ``,
      ...(topLines.length ? topLines : ['  _(No Guild GP recorded this week yet)_']),
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🎁 *WEEKLY REWARDS (Auto-Distributed Sat 23:59):*`,
      `🥇 *1st Place*: Gold Guild Victory Card (/use GVC --gold -> 15k Nexus + 3k MS)`,
      `🥈 *2nd Place*: Silver Guild Victory Card (/use GVC --silver -> 10k Nexus + 2k MS)`,
      `🥉 *3rd Place*: Bronze Guild Victory Card (/use GVC --bronze -> 5k Nexus + 2k MS)`,
      `🌟 *Weekly MVP Hunter*: +20,000 Nexus (any guild!)`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💡 *EARN GP FOR YOUR GUILD:*`,
      `Gate Clears • Upgrades • Signings • PvP Wins • Leveling Up`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📌 Run */myguild* to view member breakdown for your guild!`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');

    return sock.sendMessage(chatId, { text }, { quoted: msg });
  }
};
