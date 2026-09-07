// ═══════════════════════════════════════════════════════════════
// SOLO LEVELING CORE — The foundation of the entire SL rework
// Handles: Awakening Ranks, Power Rating, XP Tables, Class Assignment
// ═══════════════════════════════════════════════════════════════

// ─── AWAKENING RANKS ─────────────────────────────────────────────
// Your rank is your POTENTIAL, not your current power.
// It determines which gates you can enter and your stat ceiling.
const AWAKENING_RANKS = {
  E: {
    label: 'E-Rank', emoji: '⚫', color: 'grey',
    gateAccess: ['F', 'E'],
    statMultiplier: 1.0,
    spawnChance: 0.40, // 40% of players awaken as E-rank
    baseStats: { hp: 80, atk: 8, def: 5, speed: 90, maxEnergy: 80 },
    description: 'The weakest awakeners. Most people who awaken are E-rank.',
    xpMultiplier: 1.0,
  },
  D: {
    label: 'D-Rank', emoji: '🟤', color: 'brown',
    gateAccess: ['F', 'E', 'D'],
    statMultiplier: 1.3,
    spawnChance: 0.30, // 30%
    baseStats: { hp: 110, atk: 12, def: 8, speed: 95, maxEnergy: 100 },
    description: 'Below-average awakeners. Still weak, but more potential.',
    xpMultiplier: 1.1,
  },
  C: {
    label: 'C-Rank', emoji: '🔵', color: 'blue',
    gateAccess: ['F', 'E', 'D', 'C'],
    statMultiplier: 1.7,
    spawnChance: 0.15, // 15%
    baseStats: { hp: 150, atk: 18, def: 12, speed: 100, maxEnergy: 120 },
    description: 'Mid-tier awakeners. Respected, but not feared.',
    xpMultiplier: 1.2,
  },
  B: {
    label: 'B-Rank', emoji: '🟢', color: 'green',
    gateAccess: ['F', 'E', 'D', 'C', 'B'],
    statMultiplier: 2.2,
    spawnChance: 0.08, // 8%
    baseStats: { hp: 200, atk: 26, def: 18, speed: 108, maxEnergy: 145 },
    description: 'Above-average awakeners. Known by name in the industry.',
    xpMultiplier: 1.35,
  },
  A: {
    label: 'A-Rank', emoji: '🟡', color: 'gold',
    gateAccess: ['F', 'E', 'D', 'C', 'B', 'A'],
    statMultiplier: 3.0,
    spawnChance: 0.05, // 5%
    baseStats: { hp: 280, atk: 38, def: 28, speed: 118, maxEnergy: 175 },
    description: 'Elite awakeners. The top 5% of hunters worldwide.',
    xpMultiplier: 1.5,
  },
  S: {
    label: 'S-Rank', emoji: '🔴', color: 'red',
    gateAccess: ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'DISASTER'],
    statMultiplier: 4.5,
    spawnChance: 0.02, // 2%
    baseStats: { hp: 420, atk: 62, def: 45, speed: 135, maxEnergy: 220 },
    description: 'The pinnacle of human potential. Feared by all. Known by few.',
    xpMultiplier: 2.0,
  },
};

// ─── XP REQUIREMENTS ──────────────────────────────────────────────
// Anchors: Level 1→2 = 50,000 XP | Level 14→15 = ~1,700,000 XP
// Formula: xpNeeded = floor(50000 * 1.3116^(level-1))
// Exponential growth — mid game takes months, endgame is legendary
// XP is earned silently from all actions (commands, dungeons, crafting)
// It is NEVER shown as a reward — only level ups are announced

const XP_BASE       = 50000;
const XP_MULTIPLIER = 1.3116;  // derived from anchors above

function getXpRequired(level) {
  if (level < 1) return XP_BASE;
  // Cap at level 96 to avoid MAX_SAFE_INTEGER overflow
  // (1.3116^95 ≈ 9e13 × 50000 = 4.5e18, well past 2^53).
  // Past 96 the formula loses integer precision. Players past that level
  // are at the practical cap anyway.
  const safeLevel = Math.min(level, 96);
  return Math.floor(XP_BASE * Math.pow(XP_MULTIPLIER, safeLevel - 1));
}

// Total XP needed from level 1 to reach target level
function getTotalXpToLevel(targetLevel) {
  let total = 0;
  for (let i = 1; i < targetLevel; i++) {
    total += getXpRequired(i);
  }
  return total;
}

// ─── POWER RATING ─────────────────────────────────────────────────
// A single number representing overall strength.
// Used for gate eligibility display and leaderboards.
function calculatePowerRating(stats, gear = [], pet = null) {
  const baseStats = stats || {};
  let power = 0;

  // Weighted stat contributions
  power += (baseStats.hp || 0) * 0.3;
  power += (baseStats.atk || 0) * 8;
  power += (baseStats.def || 0) * 5;
  power += (baseStats.speed || 0) * 2;
  power += (baseStats.maxEnergy || 0) * 0.5;
  power += (baseStats.magicPower || 0) * 7;
  power += (baseStats.critChance || 0) * 50;
  power += (baseStats.critDamage || 0) * 20;
  power += (baseStats.lifesteal || 0) * 40;

  // Gear bonus
  if (Array.isArray(gear)) {
    for (const item of gear) {
      power += (item.powerBonus || item.bonus || 0) * 3;
    }
  }

  // Pet bonus
  if (pet && pet.stats) {
    power += ((pet.stats.atk || 0) + (pet.stats.def || 0)) * 2;
  }

  return Math.floor(power);
}

// ─── POWER RANK LABEL ─────────────────────────────────────────────
function getPowerLabel(power) {
  if (power < 1000) return { label: 'Unranked', emoji: '⬜' };
  if (power < 3000) return { label: 'F-Class', emoji: '⬛' };
  if (power < 7000) return { label: 'E-Class', emoji: '⚫' };
  if (power < 15000) return { label: 'D-Class', emoji: '🟤' };
  if (power < 30000) return { label: 'C-Class', emoji: '🔵' };
  if (power < 60000) return { label: 'B-Class', emoji: '🟢' };
  if (power < 120000) return { label: 'A-Class', emoji: '🟡' };
  return { label: 'S-Class', emoji: '🔴' };
}

// ─── RANDOM AWAKENING RANK ASSIGNMENT ────────────────────────────
function rollAwakeningRank() {
  const roll = Math.random();
  let cumulative = 0;
  for (const [rank, data] of Object.entries(AWAKENING_RANKS)) {
    cumulative += data.spawnChance;
    if (roll < cumulative) return rank;
  }
  return 'E'; // fallback
}

// ─── BUILD INITIAL PLAYER STATS FROM RANK ────────────────────────
function buildStartingStats(rank) {
  const rankData = AWAKENING_RANKS[rank] || AWAKENING_RANKS['E'];
  const base = rankData.baseStats;

  // Small random variance (±10%) to make each awakening unique
  const variance = () => 0.9 + Math.random() * 0.2;

  return {
    hp:         Math.floor(base.hp * variance()),
    maxHp:      Math.floor(base.hp * variance()),
    atk:        Math.floor(base.atk * variance()),
    def:        Math.floor(base.def * variance()),
    speed:      Math.floor(base.speed * variance()),
    energy:     base.maxEnergy,
    maxEnergy:  base.maxEnergy,
    magicPower: 0,
    critChance: 2 + (rank === 'S' ? 5 : rank === 'A' ? 3 : rank === 'B' ? 2 : 0),
    critDamage: 150,
    lifesteal:  0,
  };
}

// ─── AWAKENING NARRATIVE MESSAGES ─────────────────────────────────
const AWAKENING_MESSAGES = {
  E: [
    '「System」 Awakening rank confirmed: *E-Rank.*\n    Your gate access is limited. Your power, barely measurable.\n    But every hunter started somewhere.',
    '「System」 You are *E-Rank.* The bottom of the food chain.\n    The system acknowledges your awakening... reluctantly.',
  ],
  D: [
    '「System」 Awakening rank confirmed: *D-Rank.*\n    A slight spark of mana detected. More than most. Not yet enough.',
    '「System」 You are *D-Rank.* Below average, but with room to grow.\n    The gates will test you accordingly.',
  ],
  C: [
    '「System」 Awakening rank confirmed: *C-Rank.*\n    Mana circuit detected. You have genuine potential, hunter.',
    '「System」 You are *C-Rank.* Mid-tier awakener.\n    The Association will take note of you.',
  ],
  B: [
    '「System」 Awakening rank confirmed: *B-Rank.*\n    Strong mana resonance. You are above most who awaken.\n    The guilds will want you.',
    '「System」 You are *B-Rank.* Few awaken at this level.\n    Your name will circulate among the Association.',
  ],
  A: [
    '「System」 ⚠️ Awakening rank confirmed: *A-RANK.*\n    Exceptional mana circuit. You are elite among elites.\n    The top guilds will fight over you.',
    '「System」 Rare awakening detected: *A-Rank.*\n    You are in the top 5% of all awakened hunters on record.\n    Do not waste this gift.',
  ],
  S: [
    '「System」 ‼️ ANOMALY DETECTED. Awakening rank: *S-RANK.*\n    An S-Rank awakener emerges only once in a generation.\n    The Association has been notified. Your awakening has been recorded.',
    '「System」 WARNING: Extreme mana signature.\n    Confirmed: *S-Rank Awakening.*\n    You stand at the peak of human potential.\n    Handle your power carefully, hunter.',
  ],
};

function getAwakeningMessage(rank) {
  const msgs = AWAKENING_MESSAGES[rank] || AWAKENING_MESSAGES['E'];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

// ─── CLASS ASSIGNMENT (happens later, not at registration) ────────
// Any rank can roll any class. All 24 classes are in every pool.
// (The rank still determines the awakening's starting stats, just not
// the class itself — see AWAKENING_RANKS.baseStats. Senku is still
// owner-only via ASSIGNED_CLASSES below.)
const ALL_PLAYABLE_CLASSES = [
  'Warrior', 'Archer', 'Rogue', 'Mage', 'Knight',
  'Monk', 'Shaman', 'Assassin', 'Ranger',
  'Paladin', 'Warlord', 'SpellBlade', 'Berserker', 'BloodKnight', 'Summoner',
  'DragonKnight', 'Necromancer', 'ShadowDancer', 'Chronomancer', 'Elementalist',
  'Phantom', 'Devourer', 'Healer',
  // ⚠️ Senku is intentionally NOT in this list — it's owner-exclusive.
];

const CLASS_POOL = {
  E: ALL_PLAYABLE_CLASSES,
  D: ALL_PLAYABLE_CLASSES,
  C: ALL_PLAYABLE_CLASSES,
  B: ALL_PLAYABLE_CLASSES,
  A: ALL_PLAYABLE_CLASSES,
  S: ALL_PLAYABLE_CLASSES,
};

// ─── HARDCODED CLASS ASSIGNMENTS ──────────────────────────────────
// Players in this map always get the assigned class on awakening.
// Used for special roles: owner, co-owner, and a few specific players.
// 'Senku' is the divine class — only the owner (221951679328499@lid) can hold it.
const ASSIGNED_CLASSES = {
  '221951679328499@lid': 'Senku',   // Owner (Senku) — divine class
  '194592469209292@lid': 'Berserker',// Co-owner (Naruto)
  // The 3 player JIDs that were previously hardcoded in dead code —
  // now properly mapped so they actually get their class on awakening.
  '95000851443902@lid':   'Devourer',
  '950000851443902@lid':  'Devourer',
  '950008514439021@lid':  'Devourer',
  '179998338113754@lid':  'DragonKnight',
};

// Roll for class assignment — called by LevelUpManager at milestone levels
// Takes the player object (not just userId) so we can check hardcoded assignments.
function rollClassAssignment(player) {
  // 1. Check hardcoded assignments first (owner, co-owner, special players)
  if (player && player.id && ASSIGNED_CLASSES[player.id]) {
    return ASSIGNED_CLASSES[player.id];
  }

  // 2. Otherwise roll from the rank-appropriate pool
  const rank = player.awakenRank || 'E';
  const pool = CLASS_POOL[rank] || CLASS_POOL['E'];
  return pool[Math.floor(Math.random() * pool.length)];
}

// Class assignment check — call this in LevelUpManager after level up
// Returns className if assigned, null if not yet
function checkClassAssignment(player) {
  if (player.class) return null; // Already has a class

  // Hardcoded JIDs (owner, co-owner, etc.) get their class immediately
  // on the first eligible level-up, with no random delay.
  if (player.id && ASSIGNED_CLASSES[player.id]) {
    const level = player.level || 1;
    const rank = player.awakenRank || 'E';
    const minLevels = { E: 15, D: 12, C: 10, B: 8, A: 6, S: 4 };
    const minLevel = minLevels[rank] || 15;
    if (level >= minLevel) return rollClassAssignment(player);
    return null;
  }

  const level = player.level || 1;
  const rank = player.awakenRank || 'E';

  // Minimum level to get class depends on rank
  const minLevels = { E: 15, D: 12, C: 10, B: 8, A: 6, S: 4 };
  const minLevel = minLevels[rank] || 15;

  if (level < minLevel) return null;

  // Chance per level after minimum: 8% per level check
  // By level 30, you're almost guaranteed to have a class
  const chance = Math.min(0.08 * (level - minLevel + 1), 0.95);
  if (Math.random() < chance) {
    return rollClassAssignment(player);
  }

  return null;
}

// ─── GATE RANK vs PLAYER RANK CHECK ───────────────────────────────
function canEnterGate(playerRank, gateRank) {
  const rankData = AWAKENING_RANKS[playerRank];
  if (!rankData) return false;
  return rankData.gateAccess.includes(gateRank);
}

// ─── STAT POINTS ON LEVEL UP (SL style) ──────────────────────────
// Each level up gives stat points based on rank
function getStatPointsOnLevelUp(rank, level) {
  const basePoints = { E: 3, D: 4, C: 5, B: 6, A: 8, S: 10 };
  const base = basePoints[rank] || 3;
  // Bonus points at milestone levels
  const milestoneBonus = (level % 10 === 0) ? 5 : 0;
  return base + milestoneBonus;
}

module.exports = {
  AWAKENING_RANKS,
  getXpRequired,
  getTotalXpToLevel,
  calculatePowerRating,
  getPowerLabel,
  rollAwakeningRank,
  buildStartingStats,
  getAwakeningMessage,
  checkClassAssignment,
  rollClassAssignment,
  canEnterGate,
  getStatPointsOnLevelUp,
  CLASS_POOL,
  ASSIGNED_CLASSES,
};