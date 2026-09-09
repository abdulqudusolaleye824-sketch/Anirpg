// ═══════════════════════════════════════════════════════════════
// AURA COMMAND — View aura, leaderboard, title tiers & active perks
// ═══════════════════════════════════════════════════════════════

'use strict';

const { AuraSystem, AURA_TITLES } = require('../../rpg/utils/AuraSystem');
const { AWAKENING_RANKS } = require('../../rpg/utils/SoloLevelingCore');

module.exports = {
  name: 'aura',
  aliases: ['rep', 'prestige', 'fame'],
  description: '✨ View your Aura, active perks, and the Aura leaderboard',

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

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `✨ *GLOBAL AURA LEADERBOARD*`,
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

    // ── AURAFARM ──────────────────────────────────────────────
    if (sub === 'farm' || sub === 'aurafarm') {
      if (!player.cooldowns) player.cooldowns = {};
      const isPro = !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
      const COOLDOWN_MS = isPro ? (5 * 60 * 60 * 1000) : (10 * 60 * 60 * 1000); // 5h for Pro, 10h for standard
      const lastFarm = player.cooldowns.auraFarm || 0;
      const now = Date.now();

      if (now - lastFarm < COOLDOWN_MS) {
        const { formatDuration } = require('../../rpg/utils/NigerianTime');
        const remaining = COOLDOWN_MS - (now - lastFarm);
        return sock.sendMessage(chatId, {
          text: `⏳ *AURA FARM COOLDOWN*\n\nYou must wait *${formatDuration(remaining)}* before farming aura again! ${isPro ? '\n⚡ *(PRO 50% Reduced Cooldown Active!)*' : ''}`
        }, { quoted: msg });
      }

      player.cooldowns.auraFarm = now;

      const has100Pct = isPro && player.auraFarmBoostUntil && Date.now() <= player.auraFarmBoostUntil;
      const success = has100Pct || Math.random() < 0.35;

      if (success) {
        const gained = has100Pct ? 50 : Math.floor(Math.random() * 20) + 10;
        player.aura = (player.aura || 0) + gained;
        if (has100Pct) player.auraFarmBoostUntil = 0; // consume boost
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `✨ *AURA HARVEST SUCCESSFUL!* ${has100Pct ? '(🌟 100% PRO STAR BOOST ACTIVE!)' : ''}\n\nGained +*${gained}* Aura! Total: *${player.aura.toLocaleString()}*`
        }, { quoted: msg });
      } else {
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `💨 *Aura farm failed!* The wild energy dispersed.\n💡 Pro players get random 🌟 reactions granting 5-second 100% success rate windows! (/prostore)`
        }, { quoted: msg });
      }
    }

    // ── GUILD AURA ───────────────────────────────────────────
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

    // ── TITLE LIST & PERKS ───────────────────────────────────
    if (sub === 'titles' || sub === 'perks') {
      const lines = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `✨ *AURA TITLE TIERS & PERKS*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
      ];
      for (const tier of AURA_TITLES) {
        const current = (player.aura || 0) >= tier.min;
        const icon = current ? '✅' : '🔒';
        lines.push(`${icon} ${tier.emoji} *${tier.title}* — ${tier.min.toLocaleString()}+ Aura`);
        lines.push(`   💭 ${tier.description}`);
        lines.push(`   🎁 *Active Perks:* ${tier.perks}`);
        lines.push(``);
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
      `✨ *HUNTER AURA & PRESTIGE*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `👤 Hunter: *${player.name}* ${rankData.emoji} [${rank}-Rank]`,
      `${title.emoji} Title Tier: *${title.title}*`,
      `✨ Current Aura: *${aura.toLocaleString()}*`,
      `📊 ${progressBar}`,
      next ? `📈 Next Tier: *${next.title}* at ${next.min.toLocaleString()} Aura` : `👑 MAX TIER REACHED`,
      ``,
      `🎁 *ACTIVE TIER PERKS:*`,
      `👉 ${title.perks}`,
      ``,
      `⚔️ PvP Win Streak: *${streak}*`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📌 /aura farm    — Harvest wild aura (10h cooldown)`,
      `📌 /aura top     — Global aura leaderboard`,
      `📌 /aura guild   — Guild aura leaderboard`,
      `📌 /aura titles  — View all tier perks`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  }
};
