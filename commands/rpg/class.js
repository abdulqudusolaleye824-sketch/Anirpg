// ═══════════════════════════════════════════════════════════════
// /class — View your class, quality, and skills
// ═══════════════════════════════════════════════════════════════

'use strict';

const { CLASS_DATA, formatClassInfo, getQualityLabel, ALL_CLASSES } = require('../../rpg/utils/ClassSystem');

module.exports = {
  name: 'class',
  aliases: ['myclass', 'cls'],
  description: 'View your class info and skills',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();

    // Allow viewing another player's class
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const targetId     = mentionedJid || sender;
    const player       = db.users?.[targetId];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: mentionedJid ? `❌ That player is not registered.` : `❌ Register first! Use /register`,
      }, { quoted: msg });
    }

    // ── No class yet ──────────────────────────────────────────────────────────
    if (!player.class) {
      const threshold = player.classAwakeningThreshold;
      const currentXp = player.xp || 0;
      const remaining = threshold ? Math.max(0, threshold - currentXp) : null;

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🎭 *CLASS STATUS*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `${player.name} has not awakened a class yet.`,
          ``,
          remaining !== null
            ? `⚡ Awakening threshold set. Keep earning XP...`
            : `⚡ Awakening triggers between 50,000–150,000 total XP.`,
          ``,
          `There are *${ALL_CLASSES.length}* possible classes.`,
          `The pull is random. Quality is random.`,
          `Neither can be changed.`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── Has class ─────────────────────────────────────────────────────────────
    const data    = CLASS_DATA[player.class] || {};
    const quality = player.classQuality || 0;
    const qualLabel = getQualityLabel(quality);

    const stars = quality >= 90 ? '⭐⭐⭐⭐⭐'
                : quality >= 70 ? '⭐⭐⭐⭐'
                : quality >= 50 ? '⭐⭐⭐'
                : quality >= 30 ? '⭐⭐'
                : '⭐';

    const skillLines = (player.classSkills || data.skills || []).map((s, i) =>
      `  ${i+1}. *${s.name}*\n     ${s.desc || ''}`
    );

    // Stat bonuses at this quality
    const bonusLines = Object.entries(data.maxBonuses || {}).map(([stat, max]) => {
      const actual = Math.floor(Math.max(0.10, quality/100) * max);
      const label  = stat === 'hp' ? 'HP' : stat === 'atk' ? 'ATK' : stat === 'def' ? 'DEF'
        : stat === 'speed' ? 'Speed' : stat === 'maxEnergy' ? 'Energy' : stat === 'magicPower' ? 'Magic Pwr' : stat;
      return `  ${actual > 0 ? '+' : ''}${actual} ${label}`;
    }).filter(Boolean);

    const awakenDate = player.classAwakenedAt
      ? new Date(player.classAwakenedAt + 3600000).toISOString().slice(0,10)
      : 'Unknown';

    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `${data.emoji || '🎭'} *${player.name}'s CLASS*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `*${player.class}*`,
        `_${data.lore || ''}_`,
        ``,
        `✨ Quality: *${quality}%* ${stars}`,
        `   ${qualLabel}`,
        `📅 Awakened: ${awakenDate}`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📊 *STAT BONUSES:*`,
        ...bonusLines,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `⚡ *CLASS SKILLS:*`,
        ...skillLines,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    }, { quoted: msg });
  },
};
