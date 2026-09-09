/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — AttackPatternDB                     ║
 * ║  750 martial techniques, numbered, rank-gated        ║
 * ║  No mana cost per use. Cooldown based. Pure martial art.      ║
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
 * Each attack now has:
 * - atkMult, defMult, speedMult, critMult, accuracy
 * - cooldown (30s to 600s, 50% off for Pro)
 * - unique price per attack (2-3x more expensive than before)
 * - long description for effective moves
 * - status effect properly wired
 */

'use strict';

// ── Effect definitions ────────────────────────────────────────────────────────
const EFFECTS = {
  weaken:   { label: 'Weakened',    emoji: '💔', desc: 'Deals -30% damage for duration', statKey: 'weakened'   },
  stun:     { label: 'Stunned',     emoji: '⚡', desc: 'Skips next turn',   statKey: 'stunned'     },
  bleed:    { label: 'Bleeding',    emoji: '🩸', desc: 'Loses HP each turn (4% max HP)', statKey: 'bleeding'   },
  paralyze: { label: 'Paralyzed',   emoji: '🔱', desc: 'Speed/dodge -50%',  statKey: 'paralyzed'   },
  burn:     { label: 'Burning',     emoji: '🔥', desc: 'Burns for 5% max HP per turn', statKey: 'burn' },
  poison:   { label: 'Poisoned',    emoji: '☠️', desc: 'Poison 3% max HP per turn', statKey: 'poison' },
  freeze:   { label: 'Frozen',      emoji: '❄️', desc: 'Cannot act, -20% DEF', statKey: 'freeze' },
};

// ── Rank config — 2.5x more expensive, unique pricing via variation ───────
const RANK_CONFIG = {
  E: { range: [1,   150], dmgMult: 1.0,  nexus: 2000,   stones: 0,     hasEffect: false, cooldown: [30, 90] },
  D: { range: [151, 300], dmgMult: 1.3,  nexus: 7500,   stones: 0,     hasEffect: false, cooldown: [60, 150] },
  C: { range: [301, 450], dmgMult: 1.7,  nexus: 25000,  stones: 200,   hasEffect: false, cooldown: [90, 240] },
  B: { range: [451, 550], dmgMult: 2.2,  nexus: 0,      stones: 1000,  hasEffect: false, cooldown: [120, 360] },
  A: { range: [551, 650], dmgMult: 3.0,  nexus: 0,      stones: 3750,  hasEffect: true,  cooldown: [180, 480] },
  S: { range: [651, 750], dmgMult: 4.5,  nexus: 250000, stones: 7500,  hasEffect: true,  cooldown: [300, 600] },
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

const LONG_DESCRIPTIONS = {
  E: [
    'A fundamental form drilled until muscle memory replaces thought. The user chambers, exhales, and drives the full weight of the body through a single point. Unflashy but reliable — the kind of technique that wins brawls when fancy arts fail. Low cooldown, modest power, perfect for grinding.',
    'Footwork first, strike second. This pattern teaches distance: a half-step in, a snap, a half-step out. Not meant to finish fights, but to create openings. The low Nexus cost reflects its accessibility, but a master can chain it endlessly between heavier arts.',
  ],
  D: [
    'Momentum is the weapon. The user drops the center of gravity and rotates the hips, turning a simple limb into a piston. The impact shudders through guard and forces the defender to respect range. Heavier than E-rank, it begins to demand breathing control.',
    'A transitional art that bridges basic and intermediate. It flows from block to counter in one beat, punishing opponents who overextend. The speed is not blinding, but the timing is oppressive — learn its rhythm and you control the pace.',
  ],
  C: [
    'The first rank where “technique” becomes “art.” The user visualizes the target’s centerline and splits it with a coiled release — shoulder, elbow, wrist in sequence, each adding acceleration. The air cracks. It can be paid with Nexus or Mana, reflecting its dual nature. A true guild standard.',
    'Pressure and release. This art stores tension in the legs like a drawn bow, then unloads it upward through the torso. The defender feels not just impact but lift — their stance breaks. Requires commitment; miss and you are open, land and you dictate the next exchange.',
  ],
  B: [
    'Mana Stones are the price because mana is the medium. The strike is preceded by a half-breath that ignites latent energy along the striking limb — not a spell, but a reinforcement. The hit lands with a dull thud that echoes. Only Mana-holders can sustain its practice; the cooldown is a forced meditation to realign the channels.',
    'A high-intermediate pattern that trades pure attack for utility: the motion ends with the user’s guard already reset, speed subtly elevated. It does not hit hardest, but it lets the next heavy art arrive a fraction sooner. Veterans use it to stitch combos together.',
  ],
  A: [
    'Elite. The technique is incomplete without its status effect — the form is designed to deliver not just trauma but a lingering condition: weakened muscles, torn vessels, or locked nerves. The user must pay a steep Mana Stone toll and endure a long cooldown, but a single clean application can tilt an entire duel. The description is long because the setup is long: breathing, visualization, feint, then true line. Opponents who know the tell try to dodge; those who don’t, suffer.',
    'A-rank arts are where martial and supernatural blur. The strike is accompanied by a sharp exhale that disrupts the target’s equilibrium — not magic, but a shockwave that rattles the inner ear and slows reactions. The extended cooldown is not just balance; it is the body recovering from the g-force of its own technique. Use it to open, not to spam.',
  ],
  S: [
    'National-level. The price (quarter-million Nexus + 7.5k Mana Stones) is a gate. The cooldown (5–10 minutes, halved for Pro) is a chasm. What you get is a disaster in miniature: a full-body commitment where attack, defense, speed, and critical potential are all multiplied, accuracy is near-perfect, and a status effect is almost guaranteed. The motion is long, described in three acts — approach (a feint so convincing the defender commits), binding (a parry or grip that strips their defense), and annihilation (a rotational release that converts all stored momentum into a single vector). Legends name their S-arts because they are events, not moves.',
    'If A-rank blurs martial and supernatural, S-rank erases the line. The user enters a brief, self-induced trance where time dilates; the strike is not thrown but placed. Defense is not ignored — it is inverted, using the opponent’s guard as a fulcrum to amplify penetration. Speed spikes as the nervous system is overclocked, then crashes. Crit is not chance but inevitability for a heart-beat. The 10-minute cooldown is mercy — without it, the user’s own joints would fail. Pro hunters cut it in half through sheer conditioning.',
  ],
};

// ── Seeded random (deterministic by attack number) ────────────────────────────
function seededRand(seed, max) {
  const x = Math.sin(seed + 1) * 10000;
  return Math.floor((x - Math.floor(x)) * max);
}

function seededFloat(seed, min, max) {
  const x = Math.sin(seed + 1) * 10000;
  const frac = x - Math.floor(x);
  return min + frac * (max - min);
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
  const seed   = num * 7919;

  const prefix  = STYLE_PREFIXES[seededRand(seed,      STYLE_PREFIXES.length)];
  const word    = STYLE_WORDS   [seededRand(seed + 1,  STYLE_WORDS.length)];
  const suffix  = STYLE_SUFFIXES[seededRand(seed + 2,  STYLE_SUFFIXES.length)];
  const flavour = FLAVOUR_LINES [seededRand(seed + 3,  FLAVOUR_LINES.length)];

  const name = `${prefix} ${word} ${suffix}`;

  // Base multipliers with variation per attack — ensures no two attacks are identical
  const dmgVariation = 0.85 + (seededRand(seed + 4, 31) / 100); // 0.85–1.15
  const dmgMult   = parseFloat((cfg.dmgMult * dmgVariation).toFixed(2));

  // New stats — randomized per attack within rank-appropriate bounds
  const atkMult   = parseFloat(seededFloat(seed + 10, 0.9, 1.6).toFixed(2));
  const defMult   = parseFloat(seededFloat(seed + 11, 0.8, 1.35).toFixed(2));
  const speedMult = parseFloat(seededFloat(seed + 12, 0.85, 1.45).toFixed(2));
  const critMult  = parseFloat(seededFloat(seed + 13, 1.25, 2.4).toFixed(2));
  const accuracy  = 70 + seededRand(seed + 14, 31); // 70–100%

  // Longer description for more effective moves — S/A get long, E/D short
  let description;
  const longPool = LONG_DESCRIPTIONS[rank];
  const baseLong = longPool[seededRand(seed + 15, longPool.length)];
  // For high dmgMult, append an extra effectiveness line
  if (dmgMult >= cfg.dmgMult * 1.05) {
    description = baseLong + ' This particular execution is among the stronger variants of its rank — the multiplier sits above the rank average, rewarding precise timing with outsized impact. Expect a longer cooldown to match.';
  } else if (dmgMult <= cfg.dmgMult * 0.95) {
    description = baseLong + ' This variant trades a fraction of power for consistency; its accuracy and cooldown are slightly more forgiving, ideal for chaining.';
  } else {
    description = baseLong;
  }

  // Special effect (A-rank and S-rank only, but now also low chance for B)
  let effect = null;
  if (cfg.hasEffect) {
    const effectKeys = Object.keys(EFFECTS);
    const hasEff     = seededRand(seed + 5, 100) < 70; // 70% chance for A/S
    if (hasEff) {
      const effKey  = effectKeys[seededRand(seed + 6, effectKeys.length)];
      const duration = 1 + seededRand(seed + 7, 3); // 1–3 turns
      const chance   = 35 + seededRand(seed + 8, 46); // 35–80% proc chance
      effect = { type: effKey, duration, chance, ...EFFECTS[effKey] };
    }
  } else if (rank === 'B' && seededRand(seed + 5, 100) < 15) {
    // 15% chance for B to have a weak effect (1 turn, low chance)
    const effKey = Object.keys(EFFECTS)[seededRand(seed + 6, Object.keys(EFFECTS).length)];
    const duration = 1;
    const chance = 20 + seededRand(seed + 8, 21); // 20–40%
    effect = { type: effKey, duration, chance, ...EFFECTS[effKey] };
  }

  // Unique price per attack — 2-3x more expensive than old, with per-attack variation
  // Base is rank cost, variation 0.85–1.35 ensures uniqueness
  const priceVar = 0.85 + (seededRand(seed + 20, 51) / 100); // 0.85–1.35
  const baseNexus  = Math.floor(cfg.nexus * priceVar);
  const baseStones = Math.floor(cfg.stones * priceVar);

  // Cooldown — more effective = longer, up to 10 min for S
  const [cdMin, cdMax] = cfg.cooldown;
  const cdRange = cdMax - cdMin;
  // Scale cooldown with dmgMult and effect presence
  const effBonus = effect ? 30 : 0;
  const dmgBonus = Math.floor((dmgMult / cfg.dmgMult - 0.85) * 80); // -0 to +~24
  const cooldownSec = Math.min(600, Math.max(cdMin, cdMin + Math.floor(cdRange * (0.3 + seededRand(seed+30, 70)/100)) + effBonus + dmgBonus));
  const cooldownMs = cooldownSec * 1000;

  return {
    id:          num,
    rank,
    name,
    flavour,
    description,
    dmgMult,
    atkMult,
    defMult,
    speedMult,
    critMult,
    accuracy,
    effect,
    cooldownMs,
    cooldownSec,
    cost: {
      nexus:  baseNexus,
      stones: baseStones,
      shopNexus:  baseNexus * 3,
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
    return `${re} *#${atk.id}* ${atk.name} [${atk.rank}] ×${atk.dmgMult} Atk×${atk.atkMult} Def×${atk.defMult} Spd×${atk.speedMult} Crit×${atk.critMult} ${atk.accuracy}% ${atk.effect ? atk.effect.emoji : ''}`;
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
    `Rank: ${atk.rank}-Rank | Dmg×${atk.dmgMult} Atk×${atk.atkMult} Def×${atk.defMult} Spd×${atk.speedMult} Crit×${atk.critMult} Acc ${atk.accuracy}%`,
    `Effect: ${effLine}`,
    `Cooldown: ${Math.ceil(atk.cooldownSec/60)}m ${atk.cooldownSec%60}s ${atk.cooldownMs ? `(${atk.cooldownSec}s)` : ''} | Cost: ${costLine}`,
    `_${atk.description}_`,
  ].join('\n');
}

function getCooldownForPro(atk, isPro) {
  if (!isPro) return atk.cooldownMs;
  return Math.floor(atk.cooldownMs * 0.5); // 50% off for Pro
}

module.exports = {
  generateAttack,
  getAttacksInRange,
  getAttacksByRank,
  getRankForNumber,
  getCooldownForPro,
  RANK_CONFIG,
  RANK_EMOJI,
  formatAttack,
  EFFECTS,
};
