/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — AttackPatternDB                     ║
 * ║  750 martial techniques, numbered, rank-gated        ║
 * ║  No mana cost. No class ties. Pure martial art.      ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Ranks & numbering:
 *   E-Rank:  1  – 150   (Nexus only)
 *   D-Rank:  151 – 300  (Nexus only)
 *   C-Rank:  301 – 450  (Nexus or Mana Stones)
 *   B-Rank:  451 – 550  (Mana Stones only)
 *   A-Rank:  551 – 650  (Mana Stones only + special effects)
 *   S-Rank:  651 – 750  (Both Nexus + Mana Stones)
 *
 * Special effects (A-Rank and above, 1–3 turn duration):
 *   weaken   — target deals -30% damage for duration
 *   stun     — target skips next turn
 *   bleed    — target loses HP each turn
 *   paralyze — target speed/dodge reduced by 50%
 */

'use strict';

// ── Effect definitions ────────────────────────────────────────────────────────
const EFFECTS = {
  weaken:   { label: 'Weakened',    emoji: '💔', desc: 'Deals -30% damage', statKey: 'weakened'   },
  stun:     { label: 'Stunned',     emoji: '⚡', desc: 'Skips next turn',   statKey: 'stunned'     },
  bleed:    { label: 'Bleeding',    emoji: '🩸', desc: 'Loses HP each turn', statKey: 'bleeding'   },
  paralyze: { label: 'Paralyzed',   emoji: '🔱', desc: 'Speed/dodge -50%',  statKey: 'paralyzed'   },
};

// ── Rank config ───────────────────────────────────────────────────────────────
const RANK_CONFIG = {
  E: { range: [1,   150], dmgMult: 1.0,  nexus: 800,    stones: 0,     hasEffect: false },
  D: { range: [151, 300], dmgMult: 1.3,  nexus: 3000,   stones: 0,     hasEffect: false },
  C: { range: [301, 450], dmgMult: 1.7,  nexus: 10000,  stones: 80,    hasEffect: false },
  B: { range: [451, 550], dmgMult: 2.2,  nexus: 0,      stones: 400,   hasEffect: false },
  A: { range: [551, 650], dmgMult: 3.0,  nexus: 0,      stones: 1500,  hasEffect: true  },
  S: { range: [651, 750], dmgMult: 4.5,  nexus: 100000, stones: 3000,  hasEffect: true  },
};

// ── Martial arts style pools ──────────────────────────────────────────────────
const STYLE_PREFIXES = [
  'Iron','Stone','Shadow','Thunder','Void','Blood','Dragon','Phantom','Steel','Dark',
  'Crimson','Azure','Nexusen','Silver','Obsidian','Jade','Amber','Onyx','Scarlet','Ashen',
  'Frozen','Blazing','Raging','Silent','Swift','Brutal','Ancient','Broken','Wild','Hollow',
];

const STYLE_WORDS = [
  'Fist','Palm','Claw','Strike','Slash','Kick','Elbow','Knee','Stomp','Slam',
  'Thrust','Sweep','Dash','Surge','Barrage','Rend','Crush','Shatter','Pierce','Cleave',
  'Grapple','Throw','Lock','Break','Twist','Snap','Smash','Burst','Lance','Torrent',
];

const STYLE_SUFFIXES = [
  'Form','Style','Technique','Method','Path','Step','Dance','Art','Strike','Stance',
  'Kata','Flow','Drive','Surge','Rush','Wave','Spiral','Coil','Blast','Sequence',
];

const FLAVOUR_LINES = [
  'A precision strike honed over a thousand repetitions.',
  'The body becomes the weapon. No room for hesitation.',
  'Strikes like iron, flows like water.',
  'Born from pain. Refined by necessity.',
  'The first rule of survival — hit harder.',
  'Silence before the strike. Thunder upon contact.',
  'Not taught. Earned.',
  'Every movement conserved. Every hit decisive.',
  'A technique with no wasted motion.',
  'The path of the fist needs no enlightenment.',
  'Drawn from the oldest fighting traditions.',
  'Efficient. Brutal. Effective.',
  'The opponent sees only the result, never the setup.',
  'Speed is the weapon. The body is the blade.',
  'A student of pain becomes a master of endings.',
  'No mana. No class. Just will and impact.',
  'The purest expression of martial strength.',
  'Those who master this rarely need anything else.',
  'Forged in combat. Proven in blood.',
  'A technique that asks only one thing — commit.',
];

// ── Seeded random (deterministic by attack number) ────────────────────────────
function seededRand(seed, max) {
  const x = Math.sin(seed + 1) * 10000;
  return Math.floor((x - Math.floor(x)) * max);
}

// ── Get rank for a number ─────────────────────────────────────────────────────
function getRankForNumber(num) {
  for (const [rank, cfg] of Object.entries(RANK_CONFIG)) {
    if (num >= cfg.range[0] && num <= cfg.range[1]) return rank;
  }
  return null;
}

// ── Generate a single attack pattern (deterministic) ─────────────────────────
function generateAttack(num) {
  const rank = getRankForNumber(num);
  if (!rank) return null;

  const cfg    = RANK_CONFIG[rank];
  const seed   = num * 7919; // large prime for spread

  const prefix  = STYLE_PREFIXES[seededRand(seed,      STYLE_PREFIXES.length)];
  const word    = STYLE_WORDS   [seededRand(seed + 1,  STYLE_WORDS.length)];
  const suffix  = STYLE_SUFFIXES[seededRand(seed + 2,  STYLE_SUFFIXES.length)];
  const flavour = FLAVOUR_LINES [seededRand(seed + 3,  FLAVOUR_LINES.length)];

  const name = `${prefix} ${word} ${suffix}`;

  // Damage multiplier has slight variation per attack
  const variation = 0.85 + (seededRand(seed + 4, 31) / 100); // 0.85–1.15
  const dmgMult   = parseFloat((cfg.dmgMult * variation).toFixed(2));

  // Special effect (A-rank and S-rank only)
  let effect = null;
  if (cfg.hasEffect) {
    const effectKeys = Object.keys(EFFECTS);
    const hasEff     = seededRand(seed + 5, 100) < 60; // 60% chance of having an effect
    if (hasEff) {
      const effKey  = effectKeys[seededRand(seed + 6, effectKeys.length)];
      const duration = 1 + seededRand(seed + 7, 3); // 1–3 turns
      const chance   = 25 + seededRand(seed + 8, 51); // 25–75% proc chance
      effect = { type: effKey, duration, chance, ...EFFECTS[effKey] };
    }
  }

  // Price (3x = shop rotation price)
  const baseNexus  = cfg.nexus;
  const baseStones = cfg.stones;

  return {
    id:          num,
    rank,
    name,
    flavour,
    dmgMult,
    effect,
    cost: {
      nexus:  baseNexus,
      stones: baseStones,
      // Shop rotation is 3x
      shopNexus:  baseNexus  * 3,
      shopStones: baseStones * 3,
    },
    noMana: true,
  };
}

// ── Batch generate for display ────────────────────────────────────────────────
function getAttacksInRange(from, to) {
  const attacks = [];
  for (let i = from; i <= Math.min(to, 750); i++) {
    attacks.push(generateAttack(i));
  }
  return attacks.filter(Boolean);
}

function getAttacksByRank(rank) {
  const cfg = RANK_CONFIG[rank];
  if (!cfg) return [];
  return getAttacksInRange(cfg.range[0], cfg.range[1]);
}

// ── Rank emoji ────────────────────────────────────────────────────────────────
const RANK_EMOJI = { E:'⚫', D:'🟤', C:'🔵', B:'🟢', A:'🟡', S:'🔴' };

function formatAttack(atk, compact = false) {
  const re = RANK_EMOJI[atk.rank] || '⬜';
  const effLine = atk.effect
    ? `${atk.effect.emoji} ${atk.effect.label} (${atk.effect.chance}% | ${atk.effect.duration}t)`
    : 'No effect';

  if (compact) {
    return `${re} *#${atk.id}* ${atk.name} [${atk.rank}] ×${atk.dmgMult}${atk.effect ? ' ' + atk.effect.emoji : ''}`;
  }

  const costLine = atk.rank === 'S'
    ? `${atk.cost.nexus.toLocaleString()} Nexus + ${atk.cost.stones.toLocaleString()} Mana Stones`
    : atk.cost.nexus > 0 && atk.cost.stones > 0
    ? `${atk.cost.nexus.toLocaleString()} Nexus OR ${atk.cost.stones.toLocaleString()} Mana Stones`
    : atk.cost.nexus > 0
    ? `${atk.cost.nexus.toLocaleString()} Nexus`
    : `${atk.cost.stones.toLocaleString()} Mana Stones`;

  return [
    `${re} *#${atk.id} — ${atk.name}*`,
    `Rank: ${atk.rank}-Rank | ×${atk.dmgMult} ATK`,
    `Effect: ${effLine}`,
    `Cost: ${costLine}`,
    `_${atk.flavour}_`,
  ].join('\n');
}

module.exports = {
  generateAttack,
  getAttacksInRange,
  getAttacksByRank,
  getRankForNumber,
  formatAttack,
  RANK_CONFIG,
  RANK_EMOJI,
  EFFECTS,
};
