/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — SilentXP                            ║
 * ║  XP awarded silently. Never shown as a reward.       ║
 * ║  Level ups announced separately.                     ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Per command:        random 1–100 XP
 * Dungeon floor:      random 500–2,000 XP
 * Dungeon boss:       random 5,000–15,000 XP
 * Dungeon complete:   random 10,000–40,000 XP
 * Gate complete:      random 8,000–30,000 XP
 * Gate boss:          random 15,000–60,000 XP
 * PvP win:            random 1,000–5,000 XP
 * PvP loss:           random 100–500 XP
 * Craft (by rarity):  scales with rarity
 * Quest complete:     random 2,000–10,000 XP
 * Daily claim:        random 500–2,000 XP
 * Weekly claim:       random 5,000–15,000 XP
 * Monthly claim:      random 20,000–60,000 XP
 */

'use strict';

// ── Random int between min and max inclusive ──────────────────────────────────
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Rank XP multipliers ───────────────────────────────────────────────────────
const RANK_XP_MULT = {
  E: 1.0,
  D: 1.1,
  C: 1.25,
  B: 1.4,
  A: 1.6,
  S: 2.0,
};

// ── FLAT pass-XP tables (BASE amounts; multipliers applied below) ────────
// Battle pass-XP used to scale at 20% of the player-EXP roll — one dungeon
// clear (10k-40k EXP) paid 4-128 BP levels and completed the whole pass.
// It is now FLAT per action. Actions that already have a dedicated direct
// award (PvP wins → pvp.js) is 0 here so
// no event ever pays twice.
const BP_BATTLE_FLAT = {
  dungeon_floor: 15, dungeon_boss: 40, dungeon_complete: 100,
  gate_boss: 40, gate_complete: 60,
  pvp_win: 0, pvp_loss: 10, duel_win: 40,
};
// Astra pass had the same bug class (15% of EXP on EVERYTHING) — flat for
// battle actions. Non-battle keeps the old 15% (bounded ranges only).
const ASTRA_BATTLE_FLAT = {
  dungeon_floor: 25, dungeon_boss: 60, dungeon_complete: 200,
  gate_boss: 80, gate_complete: 120,
  pvp_win: 0, pvp_loss: 15, duel_win: 60,
};

// ── XP ranges per action ──────────────────────────────────────────────────────
const XP_RANGES = {
  command:           [1,      100    ],
  pvp_win:           [1000,   5000   ],
  pvp_loss:          [100,    500    ],
  duel_win:          [500,    3000   ],
  dungeon_floor:     [500,    2000   ],
  dungeon_boss:      [5000,   15000  ],
  dungeon_complete:  [10000,  40000  ],
  gate_complete:     [8000,   30000  ],
  gate_boss:         [15000,  60000  ],
  craft_common:      [200,    800    ],
  craft_uncommon:    [800,    2500   ],
  craft_rare:        [2500,   8000   ],
  craft_epic:        [8000,   25000  ],
  craft_legendary:   [25000,  80000  ],
  craft_mythic:      [80000,  250000 ],
  quest_complete:    [2000,   10000  ],
  daily_claim:       [500,    2000   ],
  weekly_claim:      [5000,   15000  ],
  monthly_claim:     [20000,  60000  ],
  achievement:       [1000,   5000   ],
  guild_activity:    [100,    500    ],
  trade_complete:    [200,    1000   ],
};

/**
 * Award XP silently to a player.
 * Level up check happens IMMEDIATELY — no trigger needed.
 * Announcement fires async (fire-and-forget) so it never blocks.
 *
 * @param {object}   player
 * @param {string}   action       — key from XP_RANGES (default: 'command')
 * @param {Function} saveDatabase
 * @param {object}   sock         — Baileys socket (for level up message)
 * @param {string}   chatId
 * @param {number}   [extraMult]  — optional seasonal/event multiplier
 * @returns {{ leveledUp: boolean, levelsGained: number }}
 */
function awardXP(player, action = 'command', saveDatabase, sock, chatId, extraMult = 1) {
  if (!player) return { leveledUp: false, levelsGained: 0 };

  const range    = XP_RANGES[action] || XP_RANGES.command;
  const rankMult = RANK_XP_MULT[player.awakenRank || 'E'] || 1.0;

  // ── Gate-abandon debuff ────────────────────────────────────────────────
  // A group that let a gate sit unbought for 23h gets −70% XP for 48h
  // (applied only to members present at spawn; previously farmed XP is
  // unaffected). Here we simply cut the multiplier to 0.3 → 100 XP ⇒ 30.
  if (player.xpPenaltyUntil && player.xpPenaltyUntil > Date.now()) {
    extraMult *= 0.3;
  }

  // ── Pro Subscription 2x EXP Boost ─────────────────────────────────────
  const isPro = !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
  if (isPro) {
    extraMult *= 2.0;
  }

  // ── Premium Pass EXP ──────────────────────────────────────────────
  // Astra Pass premium comes WITH Pro — it is NOT an extra double. Only
  // Battle Pass premium doubles on top of Pro. Hard rule: NO 8x anywhere.
  // free 1x · Pro 2x · BP-premium 2x · Pro + BP-premium 4x (max).
  const _bpPrem = !!(player.battlePass && player.battlePass.premium);
  if (_bpPrem) extraMult *= 2.0;

  const baseRoll = rand(range[0], range[1]) * rankMult;
  const amount   = Math.floor(baseRoll * extraMult);

  // Add XP immediately — synchronous
  player.xp = (player.xp || 0) + amount;
  player.totalXp = (player.totalXp || 0) + amount; // lifetime XP (never resets at level-up)

  // ── Astra Pass XP (ALL activities) ───────────────────────────────────
  if (!player.astraPass) {
    player.astraPass = { level: 1, xp: 0, claimedFree: [], claimedPremium: [] };
  }
  // Battle actions pay FLAT astra XP (Pro 2x); everything else keeps the
  // old 15%-of-EXP (safe — non-battle ranges are small and bounded).
  const _astraFlat = ASTRA_BATTLE_FLAT[action];
  const astraXpGained = (_astraFlat != null)
    ? Math.floor(_astraFlat * (isPro ? 2 : 1))
    : Math.max(10, Math.floor(amount * 0.15));
  player.astraPass.xp = (player.astraPass.xp || 0) + astraXpGained;
  const { xpForLevel: _apNeed } = require('./AstraPass');
  while (player.astraPass.level < 50 && player.astraPass.xp >= _apNeed(player.astraPass.level)) {
    player.astraPass.xp -= _apNeed(player.astraPass.level);
    player.astraPass.level++;
  }

  // ── Battle Pass XP (BATTLE ACTIVITIES ONLY) ──────────────────────────
  const BATTLE_ACTIONS = new Set([
    'pvp_win', 'pvp_loss', 'duel_win',
    'dungeon_floor', 'dungeon_boss', 'dungeon_complete',
    'gate_complete', 'gate_boss',
  ]);
  if (BATTLE_ACTIONS.has(action)) {
    if (!player.battlePass) {
      player.battlePass = { level: 1, xp: 0, claimed: [], premium: false };
    }
    // EXACT rule: Pro 2x, BP-premium 2x, both combined 4x — computed from
    // the BASE roll so EXP multipliers never compound into pass XP.
    const bpMult = (isPro ? 2 : 1) * (_bpPrem ? 2 : 1);
    const bpXpGained = Math.floor((BP_BATTLE_FLAT[action] || 0) * bpMult);
    player.battlePass.xp = (player.battlePass.xp || 0) + bpXpGained;
    const { xpForLevel: _bpNeed } = require('./BattlePass');
    while (player.battlePass.level < 40 && player.battlePass.xp >= _bpNeed(player.battlePass.level)) {
      player.battlePass.xp -= _bpNeed(player.battlePass.level);
      player.battlePass.level++;
    }
  }

  // ── Class awakening (50k–150k lifetime XP, per-player random point) ──────
  // Fires as soon as cumulative XP crosses the player's threshold. Uses
  // player.totalXp (level-progress `player.xp` resets each level-up and would
  // never reach 50k — this was the old bug).
  if (!player.class) {
    try {
      // Backfill lifetime XP for players registered before this counter existed:
      // seed it with the cumulative XP needed to reach their current level.
      if (player.totalXp == null) {
        const SLC = require('./SoloLevelingCore');
        player.totalXp = (SLC.getTotalXpToLevel && SLC.getTotalXpToLevel(player.level || 1)) || 0;
      }
      const { tryClassAwaken } = require('./ClassSystem');
      tryClassAwaken(player, sock, chatId);
    } catch (e) {
      console.warn('[SILENT] Class awaken check failed:', e.message);
    }
  }

  // Delegate entirely to LevelUpManager which has its own while(true) loop
  // that handles multiple level ups in one call. Do NOT add another loop here.
  try {
    const LevelUpManager = require('./LevelUpManager');
    const result = LevelUpManager.checkAndApplyLevelUps(player, saveDatabase, sock, chatId);
    return {
      leveledUp:    result?.leveledUp    || false,
      levelsGained: result?.levelsGained || 0,
      amount,   // actual XP awarded — so callers can display it if they want
    };
  } catch(e) {
    console.error('SilentXP level check error:', e.message);
    return { leveledUp: false, levelsGained: 0, amount };
  }
}

/**
 * Shorthand for per-command XP trickle.
 * Called from rpgCommandHandler after every successful command.
 */
function awardCommandXP(player, saveDatabase, sock, chatId) {
  return awardXP(player, 'command', saveDatabase, sock, chatId);
}

module.exports = { awardXP, awardCommandXP, XP_RANGES, RANK_XP_MULT };
