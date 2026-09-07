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
 * World boss hit:     random 500–2,000 XP
 * World boss kill:    random 20,000–80,000 XP
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
  worldboss_hit:     [500,    2000   ],
  worldboss_kill:    [20000,  80000  ],
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
  const amount   = Math.floor(rand(range[0], range[1]) * rankMult * extraMult);

  // Add XP immediately — synchronous
  player.xp = (player.xp || 0) + amount;

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
