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

// Push #94: what a hunter of `rank` at `level` has with NOTHING else on top —
// rank base stats + the rank's per-level growth (same numbers LevelUpManager uses).
const RANK_GROWTH_MULT = { E: 1.0, D: 1.1, C: 1.2, B: 1.35, A: 1.55, S: 1.8 };
function rankFloorAtLevel(rank, level) {
  const rd = AWAKENING_RANKS[rank] || AWAKENING_RANKS.E;
  const b = rd.baseStats || {};
  const m = RANK_GROWTH_MULT[rank] || 1;
  const L = Math.max(0, (Number(level) || 1) - 1);
  return {
    hp: (b.hp || 80) + L * Math.floor(10 * m),
    atk: (b.atk || 8) + L * Math.floor(3 * m),
    def: (b.def || 5) + L * Math.floor(2 * m),
    speed: b.speed || 90,
    maxEnergy: (b.maxEnergy || 80) + L * Math.floor(5 * m),
  };
}

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
  rankFloorAtLevel,
  name: 'bleep',
  aliases: ['bloop'],
  description: '[OWNER] /bleep <E|D|C|B|A|S> @player — promote OR demote: pure stats reset to the rank\'s level floor (upgrade points + class bonuses re-applied)',

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

    const mentionedId = require('../../utils/target').resolve(msg, []);
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

    // ── Push #94: TRUE RANK RECALIBRATION ──────────────────────────────────
    // The hunter's PURE stats (rank base + per-level rank growth, no upgrade
    // points, no class bonuses, no gear) are SET to the new rank's floor at
    // their current level — up on promotion, DOWN on demotion — then class
    // bonuses and upgrade-point allocations are laid back on top. A B-rank who
    // pumped points above S-rank numbers still gets the S floor underneath.
    if (!player.stats) player.stats = {};
    const level = Math.max(1, Number(player.level) || 1);
    const floorNow = rankFloorAtLevel(rankArg, level);
    const statLines = [];
    const CPb = require('../../rpg/utils/ClassPower');
    const SASb = require('../../rpg/utils/StatAllocationSystem');
    // 1) peel class bonuses off (they are recorded, so this is exact)
    const rec = player.classBonusApplied;
    if (rec && rec.bonuses && !rec.legacy) { try { CPb._remove(player, rec.bonuses); } catch (e) {} }
    delete player.classBonusApplied;
    // 2) pure floor → baseStats (allocation-free base)
    if (!player.baseStats) player.baseStats = { hp: player.stats.maxHp || 100, atk: player.stats.atk || 10, def: player.stats.def || 5, speed: player.stats.speed || 100, maxEnergy: player.stats.maxEnergy || 100 };
    const _alloc = (k) => { try { const a = (player.statAllocations || {})[k === 'maxEnergy' ? 'energy' : k] || 0; const cfg = SASb.STAT_CONFIG ? SASb.STAT_CONFIG[k === 'maxEnergy' ? 'energy' : k] : null; return a * ((cfg && cfg.valuePerPoint) || 0); } catch (e) { return 0; } };
    for (const key of ['hp', 'atk', 'def', 'speed', 'maxEnergy']) {
      const before = Number(player.baseStats[key]) || 0;
      const after = floorNow[key];
      if (before !== after) statLines.push(`  ${key === 'hp' ? 'maxHp' : key}: base *${before.toLocaleString()} → ${after.toLocaleString()}*${_alloc(key) ? ` (+${_alloc(key)} from upgrade points kept)` : ''}`);
      player.baseStats[key] = after;
      if (key === 'hp') player.stats.maxHp = after; else player.stats[key] = after;
    }
    // 3) class bonuses back on, 4) upgrade-point allocations back on
    try { CPb.ensureClassBonuses(player); } catch (e) {}
    try { SASb.applyAllocationsToStats(player); } catch (e) {}
    let _cap = player.stats.maxHp; try { _cap = require('../../rpg/utils/GearSystem').effectiveMaxHp(player); } catch (e) {}
    player.stats.hp = Math.min(Math.max(1, player.stats.hp || 1), _cap);
    player.stats.energy = Math.min(player.stats.energy || 0, player.stats.maxEnergy || 100);
    const promoted = VALID_RANKS.indexOf(rankArg) > VALID_RANKS.indexOf(oldRank);

    // ── Bonus delta (mana stones + upgrade points) — promotions only ────────
    const ob = RANK_BONUSES[oldRank] || RANK_BONUSES.E;
    const nb = RANK_BONUSES[rankArg] || RANK_BONUSES.E;
    const manaDelta = promoted ? Math.max(0, nb.manaStones - ob.manaStones) : 0;
    const upDelta = promoted ? Math.max(0, nb.upgradePoints - ob.upgradePoints) : 0;
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
        ? `${promoted ? '📈 *PROMOTED — pure stats set to the ' : '📉 *DEMOTED — pure stats set to the '}${rankArg}-rank Lv.${level} floor:*\n${statLines.join('\n')}`
        : `📊 Pure stats already match the ${rankArg}-rank Lv.${level} floor.`,
      `⚔️ Now: ❤️ ${player.stats.maxHp} · ⚔️ ${player.stats.atk} · 🛡️ ${player.stats.def} · 💨 ${player.stats.speed} · ⚡ ${player.stats.maxEnergy} (class bonuses + upgrade points re-applied)`,
      manaDelta > 0 ? `💎 +${manaDelta.toLocaleString()} Mana Stones` : null,
      upDelta > 0 ? `📈 +${upDelta} Upgrade Points` : null,
      ``,
      `ℹ️ Level, class, XP & upgrade points untouched — rank + level floor only.`,
    ].filter(l => l !== null);

    return sock.sendMessage(chatId, { text: lines.join('\n'), mentions: [targetJid] }, { quoted: msg });
  },
};
