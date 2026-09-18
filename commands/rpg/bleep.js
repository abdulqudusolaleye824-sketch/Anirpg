// ═══════════════════════════════════════════════════════════════
// /bleep <RANK> @player — OWNER rank recalibration (Push #68)
//
// Changes a player's awakening rank and applies the rank's stat floor as a
// PURE IMPROVEMENT: every stat is raised to at least the new rank's base
// stats (never lowered), plus the upgrade-point / mana-stone bonus delta.
// Level, class, XP and everything else are untouched.
//
// Usage:
//   /bleep S @player        — mention the target
//   /bleep A 2348012345678  — or bare phone number
//   /bleep B HunterName     — or exact player name
// ═══════════════════════════════════════════════════════════════

'use strict';

const Perms = require('../../utils/permissions');
const { AWAKENING_RANKS } = require('../../rpg/utils/SoloLevelingCore');

// Same starter-bonus packages register.js uses (kept local on purpose —
// /bleep must not drag the whole registration flow into scope).
const RANK_BONUSES = {
  E: { manaStones: 500,   upgradePoints: 3  },
  D: { manaStones: 800,   upgradePoints: 4  },
  C: { manaStones: 1200,  upgradePoints: 6  },
  B: { manaStones: 2000,  upgradePoints: 8  },
  A: { manaStones: 3500,  upgradePoints: 12 },
  S: { manaStones: 6000,  upgradePoints: 20 },
};

const VALID_RANKS = Object.keys(AWAKENING_RANKS);

function findPlayer(db, args, mentionedId) {
  // 1) mention
  if (mentionedId && db.users?.[mentionedId]) return { jid: mentionedId, player: db.users[mentionedId] };
  const arg = (args[1] || '').trim();
  if (!arg) return null;
  const bareNum = arg.replace(/\D/g, '');
  // 2) bare phone number
  if (bareNum.length >= 8) {
    for (const [k, u] of Object.entries(db.users || {})) {
      if (!u) continue;
      if (k.replace(/\D/g, '') === bareNum || String(u.id || '').replace(/\D/g, '') === bareNum) {
        return { jid: k, player: u };
      }
    }
  }
  // 3) exact name
  const nameQuery = (args.slice(1).join(' ')).trim().toLowerCase();
  if (nameQuery) {
    for (const [k, u] of Object.entries(db.users || {})) {
      if (u?.name && String(u.name).toLowerCase() === nameQuery) return { jid: k, player: u };
    }
  }
  return null;
}

module.exports = {
  name: 'bleep',
  aliases: ['bloop'],
  description: '[OWNER] /bleep <E|D|C|B|A|S> @player — change rank + apply stat bonuses (no level/class change)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotOwner(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Bot owner only.' }, { quoted: msg });
    }

    const rankArg = (args[0] || '').toUpperCase();
    if (!VALID_RANKS.includes(rankArg)) {
      return sock.sendMessage(chatId, {
        text: `❌ Usage: */bleep <${VALID_RANKS.join('|')}>* @player\nExample: */bleep S @Hunter*`,
      }, { quoted: msg });
    }

    const mentionedId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const found = findPlayer(db, args, mentionedId);
    if (!found) {
      return sock.sendMessage(chatId, {
        text: '❌ Target not found. Mention the player (or give their number / exact name).',
      }, { quoted: msg });
    }

    const { jid: targetJid, player } = found;
    const oldRank = player.awakenRank || 'E';
    if (oldRank === rankArg) {
      return sock.sendMessage(chatId, {
        text: `ℹ️ *${player.name}* is already *${rankArg}-Rank*.`,
        mentions: [targetJid],
      }, { quoted: msg });
    }

    const rd = AWAKENING_RANKS[rankArg];
    const oldRd = AWAKENING_RANKS[oldRank] || AWAKENING_RANKS.E;

    // ── Stat floor: pure improvement, stat-by-stat ─────────────────────────
    if (!player.stats) player.stats = {};
    if (!player.baseStats) player.baseStats = { ...player.stats };
    const statLines = [];
    for (const key of Object.keys(rd.baseStats)) {
      const floor = rd.baseStats[key] || 0;
      if ((player.stats[key] || 0) < floor) {
        statLines.push(`  ${key}: *${(player.stats[key] || 0).toLocaleString()} → ${floor.toLocaleString()}*`);
        player.stats[key] = floor;
      }
      if ((player.baseStats[key] || 0) < floor) player.baseStats[key] = floor;
    }

    // ── Bonus delta (mana stones + upgrade points) ─────────────────────────
    const ob = RANK_BONUSES[oldRank] || RANK_BONUSES.E;
    const nb = RANK_BONUSES[rankArg] || RANK_BONUSES.E;
    const manaDelta = Math.max(0, nb.manaStones - ob.manaStones);
    const upDelta = Math.max(0, nb.upgradePoints - ob.upgradePoints);
    if (manaDelta > 0) player.manaCrystals = (player.manaCrystals || 0) + manaDelta;
    if (upDelta > 0) player.upgradePoints = (player.upgradePoints || 0) + upDelta;

    player.awakenRank = rankArg;
    player.bleepedBy = sender;
    player.bleepedAt = Date.now();
    try { saveDatabase(); } catch (e) {}

    const lines = [
      `🔔 *BLEEP! RANK RECALIBRATED*`,
      ``,
      `👤 Hunter: *${player.name}*`,
      `${oldRd.emoji} *${oldRank}-Rank* → ${rd.emoji} *${rankArg}-Rank*`,
      ``,
      statLines.length
        ? `📈 *STAT IMPROVEMENT:*${statLines.join('\n')}`
        : `📈 Stats already above the ${rankArg}-rank floor — no stat changes needed.`,
      manaDelta > 0 ? `💎 +${manaDelta.toLocaleString()} Mana Stones` : null,
      upDelta > 0 ? `📈 +${upDelta} Upgrade Points` : null,
      ``,
      `ℹ️ Level, class & XP untouched — rank + stat floor only.`,
    ].filter(l => l !== null);

    return sock.sendMessage(chatId, { text: lines.join('\n'), mentions: [targetJid] }, { quoted: msg });
  },
};
