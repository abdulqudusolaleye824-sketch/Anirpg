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
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const sub = args[0]?.toLowerCase();

    // ── LEADERBOARD ──────────────────────────────────────────
    if (sub === 'top' || sub === 'leaderboard' || sub === 'lb') {
      const board = AuraSystem.getLeaderboard(db, 15);
      if (board.length === 0) return sock.sendMessage(chatId, { text: 'No data yet.' }, { quoted: msg });

      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `✨ *GLOBAL AURA LEADERBOARD* 💎`, UI.PRO_BAR] : [`✨ *GLOBAL AURA LEADERBOARD*`, UI.FREE_BAR]),
          ``,
          board.join('\n'),
          ``,
          FRAME,
          `✨ Your Aura: *${(player.aura || 0).toLocaleString()}*`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO AURA* — 5h farm cooldown active`] : [UI.upsell()]),
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
          text: (pro ? `${UI.PRO_BAR}\n⏳ *AURA FARM COOLDOWN* 💎\n${UI.PRO_BAR}\n\nYou must wait *${formatDuration(remaining)}* before farming aura again!\n⚡ *(PRO 50% reduced cooldown active!)*\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO AURA* — 5h farm cooldown` : `⏳ *AURA FARM COOLDOWN*\n${UI.FREE_BAR}\n\nYou must wait *${formatDuration(remaining)}* before farming aura again!\n${UI.FREE_BAR}\n${UI.upsell()}`)
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
          text: (pro ? `${UI.PRO_BAR}\n✨ *AURA HARVEST SUCCESSFUL!* 💎 ${has100Pct ? '(🌟 100% PRO STAR BOOST ACTIVE!)' : ''}\n${UI.PRO_BAR}\n\nGained +*${gained}* Aura! Total: *${player.aura.toLocaleString()}*\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO AURA* — ${player.aura.toLocaleString()} banked` : `✨ *AURA HARVEST SUCCESSFUL!*\n${UI.FREE_BAR}\n\nGained +*${gained}* Aura! Total: *${player.aura.toLocaleString()}*\n${UI.FREE_BAR}\n${UI.upsell()}`)
        }, { quoted: msg });
      } else {
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: (pro ? `${UI.PRO_BAR}\n💨 *AURA FARM FAILED* 💎\n${UI.PRO_BAR}\n\nThe wild energy dispersed.\n💡 🌟 reactions grant 5-second 100% windows! (/prostore)\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO AURA* — retry after cooldown` : `💨 *Aura farm failed!* The wild energy dispersed.\n💡 Pro players get random 🌟 reactions granting 5-second 100% success rate windows! (/prostore)\n${UI.FREE_BAR}`)
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
          ...(pro ? [UI.PRO_BAR, `✨ *${guildName} — AURA BOARD* 💎`, UI.PRO_BAR] : [`✨ *${guildName} — AURA BOARD*`, UI.FREE_BAR]),
          ``,
          board.join('\n') || 'No guild members found.',
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO AURA* — ${board.length} guildmates ranked`] : [UI.upsell()]),
        ].join('\n')
      }, { quoted: msg });
    }

    // ── TITLE LIST & PERKS ───────────────────────────────────
    if (sub === 'titles' || sub === 'perks') {
      const lines = [
        ...(pro ? [UI.PRO_BAR, `✨ *AURA TITLE TIERS & PERKS* 💎`, UI.PRO_BAR] : [`✨ *AURA TITLE TIERS & PERKS*`, UI.FREE_BAR]),
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
      lines.push(FRAME, ...(pro ? [UI.PRO_MINI, `💎 *PRO AURA* — ${(player.aura||0).toLocaleString()} banked`] : [UI.upsell()]));
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
      if (!next) return `${UI.bar(1, 1, 10, pro)} MAX`;
      return `${UI.bar(aura - title.min, next.min - title.min, 10, pro)} ${aura - title.min}/${next.min - title.min}`;
    })();

    const lines = [
      ...(pro ? [UI.PRO_BAR, `✨ *HUNTER AURA & PRESTIGE* 💎`, UI.PRO_BAR] : [`✨ *HUNTER AURA & PRESTIGE*`, UI.FREE_BAR]),
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
      FRAME,
      `📌 /aura farm    — Harvest wild aura (10h cooldown)`,
      `📌 /aura top     — Global aura leaderboard`,
      `📌 /aura guild   — Guild aura leaderboard`,
      `📌 /aura titles  — View all tier perks`,
      FRAME,
      ...(pro ? [UI.PRO_MINI, next ? `💎 *PRO AURA* — ${(next.min - aura).toLocaleString()} to ${next.title}` : `💎 *PRO AURA* — MAX TIER 👑`] : [UI.upsell()]),
    ];

    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  }
};
