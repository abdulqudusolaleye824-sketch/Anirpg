// ═══════════════════════════════════════════════════════════════
// AURA COMMAND — View aura, leaderboard, and title
// ═══════════════════════════════════════════════════════════════

const { AuraSystem, AURA_TITLES } = require('../../rpg/utils/AuraSystem');
const { AWAKENING_RANKS } = require('../../rpg/utils/SoloLevelingCore');

module.exports = {
  name: 'aura',
  aliases: ['rep', 'prestige', 'fame'],
  description: '✨ View your Aura and the Aura leaderboard',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

    const sub = args[0]?.toLowerCase();

    // ── LEADERBOARD ──────────────────────────────────────────
    if (sub === 'top' || sub === 'leaderboard' || sub === 'lb') {
      const board = AuraSystem.getLeaderboard(db, 15);
      if (board.length === 0) return sock.sendMessage(chatId, { text: 'No data yet.' }, { quoted: msg });

      const myRank = Object.values(db.users || {})
        .filter(u => u && !u.banned)
        .sort((a, b) => (b.aura || 0) - (a.aura || 0))
        .findIndex(u => u.id === sender || Object.keys(db.users).find(k => db.users[k] === u && k === sender));

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `✨ *AURA LEADERBOARD*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          board.join('\n'),
          ``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `✨ Your Aura: *${(player.aura || 0).toLocaleString()}*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n')
      }, { quoted: msg });
    }

    // ── GUILD LEADERBOARD ────────────────────────────────────
    if (sub === 'guild') {
      const guildName = player.guild;
      if (!guildName) return sock.sendMessage(chatId, { text: '❌ You are not in a guild.' }, { quoted: msg });
      const board = AuraSystem.getGuildLeaderboard(db, guildName, 15);
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `✨ *${guildName} — AURA BOARD*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          board.join('\n') || 'No guild members found.',
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n')
      }, { quoted: msg });
    }

    // ── TITLE LIST ───────────────────────────────────────────
    if (sub === 'titles') {
      const lines = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `✨ *AURA TITLE TIERS*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
      ];
      for (const tier of AURA_TITLES) {
        const current = (player.aura || 0) >= tier.min;
        lines.push(`${current ? '✅' : '🔒'} ${tier.emoji} *${tier.title}* — ${tier.min.toLocaleString()}+ Aura`);
        lines.push(`    ${tier.description}`);
      }
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    // ── DEFAULT: MY AURA ─────────────────────────────────────
    const aura = player.aura || 0;
    const title = AuraSystem.getAuraTitle(aura);
    const next = AURA_TITLES.find(t => t.min > aura);
    const rank = player.awakenRank || 'E';
    const rankData = AWAKENING_RANKS[rank];
    const streak = player.pvpStreak || 0;

    const progressBar = (() => {
      if (!next) return `[${'█'.repeat(10)}] MAX`;
      const pct = Math.min(10, Math.floor(((aura - title.min) / (next.min - title.min)) * 10));
      return `[${'█'.repeat(pct)}${'░'.repeat(10 - pct)}] ${aura - title.min}/${next.min - title.min}`;
    })();

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `✨ *AURA*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `👤 *${player.name}* ${rankData.emoji} [${rank}-Rank]`,
      ``,
      `${title.emoji} *${title.title}*`,
      `✨ Aura: *${aura.toLocaleString()}*`,
      `📊 ${progressBar}`,
      next ? `📈 Next: *${next.title}* at ${next.min.toLocaleString()}` : `👑 MAX TITLE REACHED`,
      ``,
      `⚔️ PvP Win Streak: *${streak}*`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📌 /aura top — global leaderboard`,
      `📌 /aura guild — guild leaderboard`,
      `📌 /aura titles — all title tiers`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `*How to gain Aura:*`,
      `⚔️ PvP wins`,
      `🚪 Gate clears`,
      `🎭 Class awakening`,
      `🏆 Top raider in a gate`,
    ];

    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  }
};