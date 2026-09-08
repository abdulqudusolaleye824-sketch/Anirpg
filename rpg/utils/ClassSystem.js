/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         Astra — ClassSystem (auto-loader)                 ║
 * ║                                                            ║
 * ║  Class data lives in per-file modules under rpg/classes/,  ║
 * ║  organized by tier:                                        ║
 * ║    rpg/classes/common/    (Warrior, Mage, Knight, etc.)     ║
 * ║    rpg/classes/rare/                                       ║
 * ║    rpg/classes/epic/                                       ║
 * ║    rpg/classes/legendary/                                  ║
 * ║    rpg/classes/divine/    (Senku — owner only)             ║
 * ║    rpg/classes/monster/   (Monster class + 50 variants)    ║
 * ║                                                            ║
 * ║  To add a new class:                                       ║
 * ║    1. Create rpg/classes/<tier>/<Name>.js                 ║
 * ║    2. Export { name, emoji, lore, maxBonuses, skills }     ║
 * ║    3. Add tier mapping in scripts/split-classes.js        ║
 * ║       (or just put the file in the right tier dir)        ║
 * ║    4. Restart the bot (or call CS.reload())                ║
 * ║                                                            ║
 * ║  To re-extract from the legacy inline form, run:           ║
 * ║    node scripts/split-classes.js                          ║
 * ║                                                            ║
 * ║  ════════════════════════════════════════════════════════   ║
 * ║  CLASS QUALITY — see rpg/classes/QUALITY.md for spec       ║
 * ║  ════════════════════════════════════════════════════════   ║
 * ║                                                            ║
 * ║  Rules:                                                    ║
 * ║   - Rank defines STARTING STATS only, not class access    ║
 * ║   - All 24 classes + 50 Monster variants available         ║
 * ║   - Awakening triggers at a random XP point: 50,000-150,000║
 * ║   - Class quality: 1-100 (uniform roll, fixed at           ║
 * ║     awakening). Scales stat bonuses & skill potency         ║
 * ║     LINEARLY: floor(max × quality / 100)                   ║
 * ║   - Quality tier labels (display only, not mechanical):    ║
 * ║       Common 1-29  | Uncommon 30-49 | Rare 50-69            ║
 * ║       Epic 70-84  | Legendary 85-94 | Mythic 95-100        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Load ASSIGNED_CLASSES from SoloLevelingCore if available — defines which
// JIDs are owner/co-owner and which class they get. Used here to give
// privileged players a guaranteed 100% class quality.
let _ASSIGNED_CLASSES = {};
try {
  const SLC = require('./SoloLevelingCore');
  _ASSIGNED_CLASSES = SLC.ASSIGNED_CLASSES || {};
} catch (_) {
  // If SoloLevelingCore isn't reachable, fall back to the empty map.
  // (owner/co-owner checks will be no-ops, which is the safe default.)
}

/**
 * Returns true if the given (player, className) pair is a privileged
 * assignment — i.e. this class is in the hardcoded ASSIGNED_CLASSES map
 * for this JID. Such players always get 100% quality.
 */
function isPrivilegedAssignment(player, className) {
  if (!player || !player.id) return false;
  const { OWNER_JID, COOWNER_JID } = require('../../utils/constants');
  const bareId = player.id.split('@')[0].split(':')[0];
  const ownerBare = (OWNER_JID || '').split('@')[0].split(':')[0];
  const coownerBare = (COOWNER_JID || '').split('@')[0].split(':')[0];

  if (bareId === ownerBare) return true;
  if (bareId === coownerBare) return true;
  if (_ASSIGNED_CLASSES[player.id] === className) return true;
  if (_ASSIGNED_CLASSES[bareId] === className) return true;

  return false;
}

// ── Auto-loader ──────────────────────────────────────────────────────────────
const CLASSES_DIR = path.join(__dirname, '..', 'classes');

const TIERS = ['common', 'rare', 'epic', 'legendary', 'divine', 'monster'];

/**
 * Load a single class file. Busts the require cache so updates
 * take effect on the next call to reload().
 */
function loadClassFile(tier, file) {
  const fullPath = path.join(CLASSES_DIR, tier, file);
  delete require.cache[require.resolve(fullPath)];
  return require(fullPath);
}

/**
 * Build the full class data map. Each key is a class name; value is
 * the exported object from the per-file module.
 *
 * Monster variant files (rpg/classes/monster/<id>.js) are intentionally
 * NOT included here — they live in MONSTER_VARIANTS instead. We detect
 * them by the presence of an `id` field (only variants have ids).
 */
function buildClassData() {
  const map = {};
  for (const tier of TIERS) {
    const dir = path.join(CLASSES_DIR, tier);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const mod = loadClassFile(tier, file);
      // Only classes (have `name` but no `id`); skip variants (have `id`)
      if (mod && mod.name && !mod.id) {
        mod.rarity = tier;
        map[mod.name] = mod;
      }
    }
  }
  return map;
}

/**
 * Build the monster variants array. Skips the wrapper Monster.js
 * (which IS a class definition, not a variant).
 */
function buildMonsterVariants() {
  const dir = path.join(CLASSES_DIR, 'monster');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'Monster.js');
  return files.map(f => loadClassFile('monster', f)).filter(Boolean);
}

// ── Build in-memory data on module load ─────────────────────────────────────
let _CLASS_DATA       = buildClassData();
let _MONSTER_VARIANTS  = buildMonsterVariants();

/**
 * Re-scan rpg/classes/ and rebuild the in-memory data. Useful after
 * editing a class file and want to see the change without restarting.
 */
function reload() {
  _CLASS_DATA      = buildClassData();
  _MONSTER_VARIANTS = buildMonsterVariants();
  // Recompute ALL_CLASSES (any class file may have been added/renamed).
  // Use splice so we mutate the existing array in place (the const-bound
  // reference is shared with everyone who already imported this module).
  ALL_CLASSES.length = 0;
  ALL_CLASSES.push(...Object.keys(_CLASS_DATA));
}

// ── List of all class names (recomputed on each reload) ─────────────────────
const ALL_CLASSES = Object.keys(_CLASS_DATA);

// ── Quality bounds & helpers ─────────────────────────────────────────────────
// Quality is an integer in [1, 100]. See rpg/classes/QUALITY.md for the full spec.
const MIN_AWAKEN_QUALITY = 1;
const MAX_AWAKEN_QUALITY = 100;

/**
 * Roll a class quality value. Uniform distribution over [MIN, MAX].
 * Returned as a 1-100 integer. This is the canonical way to roll quality —
 * other code should use this helper rather than inlining the random call.
 */
function rollQuality() {
  return MIN_AWAKEN_QUALITY + Math.floor(Math.random() * (MAX_AWAKEN_QUALITY - MIN_AWAKEN_QUALITY + 1));
}

/**
 * Apply quality as a linear multiplier to a max value.
 * Returns floor(max * quality / 100), clamped to ≥0.
 */
function applyQuality(maxValue, quality) {
  if (typeof maxValue !== 'number' || isNaN(maxValue)) return 0;
  if (typeof quality !== 'number' || isNaN(quality))   return 0;
  return Math.max(0, Math.floor(maxValue * quality / 100));
}

/**
 * Tier label for display (Common / Uncommon / Rare / Epic / Legendary / Mythic).
 * Purely cosmetic — no mechanical effect. Ranges are inclusive on the lower bound.
 */
function getQualityLabel(quality) {
  if (quality >= 95) return '✨ Mythic';
  if (quality >= 85) return '💎 Legendary';
  if (quality >= 70) return '🟣 Epic';
  if (quality >= 50) return '🔵 Rare';
  if (quality >= 30) return '🟢 Uncommon';
  return '⚪ Common';
}

/**
 * Compact 5-star display. Maps quality to a 0..5 star count:
 *   100 -> ★★★★★,  90 -> ★★★★☆,  75 -> ★★★★☆,  60 -> ★★★☆☆,
 *    45 -> ★★☆☆☆,  30 -> ★★☆☆☆,  15 -> ★☆☆☆☆,   1 -> ☆☆☆☆☆
 * Uses filled (★) and empty (☆) stars — WhatsApp-friendly.
 */
function formatQualityStars(quality) {
  if (typeof quality !== 'number' || isNaN(quality) || quality <= 0) return '☆☆☆☆☆';
  // Bucketed mapping: 5/4/3/2/1 stars at the listed thresholds.
  let stars = 0;
  if (quality >= 90) stars = 5;
  else if (quality >= 70) stars = 4;
  else if (quality >= 50) stars = 3;
  else if (quality >= 30) stars = 2;
  else if (quality >= 10) stars = 1;
  else                       stars = 0;
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

// ── Roll a class awakening ───────────────────────────────────────────────────
function rollClassAwakening() {
  const idx = Math.floor(Math.random() * ALL_CLASSES.length);
  return ALL_CLASSES[idx];
}

// ── Roll a monster variant ───────────────────────────────────────────────────
function rollMonsterVariant() {
  return _MONSTER_VARIANTS[Math.floor(Math.random() * _MONSTER_VARIANTS.length)];
}

// ── Apply a class to a player ───────────────────────────────────────────────
function applyClassToPlayer(player, className) {
  const data = _CLASS_DATA[className];
  if (!data) return false;

  // Quality is rolled ONCE at awakening and is permanent. If the player
  // already has one (e.g. from a previous awakening or migration), keep it.
  // EXCEPTION: owner and co-owner always awaken at 100% quality (their classes
  // are mapped via ASSIGNED_CLASSES in SoloLevelingCore.js — we read the map
  // dynamically so the policy stays in one place).
  let quality = player.classQuality;
  if (!quality) {
    quality = isPrivilegedAssignment(player, className)
      ? MAX_AWAKEN_QUALITY
      : rollQuality();
    player.classQuality = quality;
  }

  // Apply stat bonuses scaled by quality
  for (const [stat, max] of Object.entries(data.maxBonuses || {})) {
    const bonus = applyQuality(max, quality);
    if (stat === 'hp' || stat === 'maxHp') {
      player.stats.maxHp = (player.stats.maxHp || 100) + bonus;
      player.stats.hp    = Math.min(player.stats.hp || 100, player.stats.maxHp);
    } else if (stat === 'maxEnergy') {
      player.stats.maxEnergy = (player.stats.maxEnergy || 100) + bonus;
    } else if (stat === 'lifesteal' || stat === 'critChance' || stat === 'magicPower') {
      player.stats[stat] = (player.stats[stat] || 0) + bonus;
    } else if (bonus > 0 || (bonus < 0 && player.stats[stat])) {
      player.stats[stat] = (player.stats[stat] || 0) + bonus;
    }
  }

  // Assign class skills scaled by quality
  player.classSkills = (data.skills || []).map(skill => ({
    name:       skill.name,
    type:       skill.type,
    potency:    applyQuality(skill.maxPotency, quality),
    desc:       (skill.desc || '')
                  .replace(/{p}/g, String(applyQuality(skill.maxPotency, quality)))
                  .replace(/{p\/(\d+)}/g, (_, d) => String(Math.floor(applyQuality(skill.maxPotency, quality) / parseInt(d)))),
    maxPotency: skill.maxPotency,
    quality,
  }));

  // If Monster class, also assign a specific variant
  if (className === 'Monster' && !player.monsterVariant) {
    const variant = rollMonsterVariant();
    player.monsterVariant = variant;
    player.class          = variant.name;
    player.classBase      = 'Monster';
    return true;
  }

  return true;
}

// ── Check if player should awaken a class ────────────────────────────────────
const MIN_AWAKEN_XP = 50000;
const MAX_AWAKEN_XP = 150000;

function checkClassAwakening(player) {
  if (!player || player.class) return { shouldAwaken: false };
  // Use LIFETIME XP (player.totalXp) — level-progress `player.xp` resets every
  // level-up, so a 50k–150k threshold would never trigger on the old counter.
  const totalXp = player.totalXp || 0;
  if (!player.classAwakeningThreshold) {
    player.classAwakeningThreshold = MIN_AWAKEN_XP + Math.floor(Math.random() * (MAX_AWAKEN_XP - MIN_AWAKEN_XP));
  }
  if (totalXp >= player.classAwakeningThreshold) return { shouldAwaken: true };
  return { shouldAwaken: false };
}

// ── Awaken a class (if the player's lifetime XP crossed their threshold) ─────
// Called from SilentXP.awardXP on every XP grant. Assigns a random class the
// first time cumulative XP crosses the per-player 50k–150k threshold.
function tryClassAwaken(player, sock, chatId) {
  if (!player || player.class) return null;
  const { shouldAwaken } = checkClassAwakening(player);
  if (!shouldAwaken) return null;

  const className = rollClassAwakening();
  applyClassToPlayer(player, className);
  player.class           = className;
  player.classBase       = player.classBase || className;
  player.classAssignedAt = Date.now();
  player.classAwakenedAt = Date.now();

  // Fire-and-forget aura bonus + announcement (never block XP award).
  try {
    const { AuraSystem } = require('./AuraSystem');
    AuraSystem.addAura(player, 'classUnlock');
  } catch (e) { /* non-fatal */ }

  if (sock && chatId) {
    const shown = player.monsterVariant?.name || className;
    const baseClass = player.classBase || className;
    const data = _CLASS_DATA[baseClass] || _CLASS_DATA[className];
    const quality = player.classQuality || 100;
    const stars = formatQualityStars(quality);
    const qLabel = getQualityLabel(quality);

    const msg1 = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🌋 *THE MANA VEINS BURST OPEN!*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `*${player.name}*, a fierce cosmic surge shatters your physical limitations!`,
      `The long grind is complete. The gates of dormant power inside your soul crack open with blinding light!`,
    ].join('\n');

    const msg2 = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🎭 *CLASS REVELATION*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `✨ Awakened Class: **${data?.emoji || '🎭'} ${shown}**`,
      `⭐ Quality: *${quality}%* (${qLabel}) ${stars}`,
      ``,
      `💭 _"${data?.lore || 'A legendary authority wraps around your core.'}"_`,
    ].join('\n');

    const msg3 = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚔️ *CLASS SKILLS & POWER UNLOCKED!*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `Your class skills and stat multipliers are now active!`,
      ...(player.classSkills || []).map((s, i) => `  ${i+1}. *${s.name}* — ${s.desc}`),
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💡 Use */class* to inspect your full class mastery!`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');

    (async () => {
      try {
        await sock.sendMessage(chatId, { text: msg1 });
        await new Promise(r => setTimeout(r, 1200));
        await sock.sendMessage(chatId, { text: msg2 });
        await new Promise(r => setTimeout(r, 1200));
        await sock.sendMessage(chatId, { text: msg3 });
      } catch (_) {}
    })();
  }
  return className;
}

// ── Format class info for display ────────────────────────────────────────────
function formatClassInfo(player) {
  if (!player.class) return '_No class yet. Awaiting awakening..._';

  const baseClass = player.classBase || player.class;
  const data      = _CLASS_DATA[baseClass] || _CLASS_DATA[player.class];
  const quality   = player.classQuality || 0;

  const variantLore = player.monsterVariant?.lore || data?.lore || '';
  const lines = [
    `${data?.emoji || player.monsterVariant?.emoji || '🎭'} *${player.class}*`,
    `✨ Quality: *${quality}%* ${getQualityLabel(quality)} ${formatQualityStars(quality)}`,
    variantLore ? `_${variantLore}_` : '',
    ``,
    `📊 *Class Skills:*`,
    ...(player.classSkills || []).map((s, i) => `  ${i+1}. *${s.name}* — ${s.desc}`),
  ];

  return lines.filter(l => l !== '').join('\n');
}

// ── Quality label ────────────────────────────────────────────────────────────
// NOTE: getQualityLabel is now defined near the top of the file alongside
// the other canonical quality helpers (rollQuality, applyQuality, etc.).
// See the section "Quality bounds & helpers" above.

// ── Tier helpers ─────────────────────────────────────────────────────────────
function getTier(className) {
  for (const tier of TIERS) {
    const dir = path.join(CLASSES_DIR, tier);
    if (!fs.existsSync(dir)) continue;
    if (fs.existsSync(path.join(dir, `${className}.js`))) return tier;
  }
  return null;
}

function listByTier(tier) {
  if (!TIERS.includes(tier)) return [];
  const dir = path.join(CLASSES_DIR, tier);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.js'))
    .map(f => f.replace(/\.js$/, ''));
}

module.exports = {
  // Public API
  ALL_CLASSES,
  CLASS_DATA:        _CLASS_DATA,        // live reference (rebuilt on reload)
  MONSTER_VARIANTS:  _MONSTER_VARIANTS,
  TIERS,

  // Core functions
  rollClassAwakening,
  rollMonsterVariant,
  applyClassToPlayer,
  checkClassAwakening,
  tryClassAwaken,
  formatClassInfo,
  getTier,
  listByTier,

  // Quality helpers (see rpg/classes/QUALITY.md)
  rollQuality,          // 1-100 uniform roll
  applyQuality,         // floor(max * quality / 100)
  getQualityLabel,      // tier label (Common .. Mythic)
  formatQualityStars,   // 5-star display

  // Constants
  MIN_AWAKEN_XP,
  MAX_AWAKEN_XP,
  MIN_AWAKEN_QUALITY,
  MAX_AWAKEN_QUALITY,

  // Utilities
  reload,
  CLASSES_DIR,
};
