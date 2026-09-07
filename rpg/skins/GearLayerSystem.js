/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║             ✦ 𝐀𝐬𝐭𝐫𝐚™ — GearLayerSystem.js                      ║
 * ║  Maps equipped gear → visual layer asset paths               ║
 * ║  for the RigRenderer compositing pipeline.                   ║
 * ║                                                              ║
 * ║  Slots rendered on skin:                                     ║
 * ║    weapon  — held in hand (pose depends on weapon type)      ║
 * ║    chest   — torso armour layer                              ║
 * ║    cloak   — cape/mantle layer over chest                    ║
 * ║    vam     — vambrace/bracer arm layer                       ║
 * ║                                                              ║
 * ║  Slots NOT rendered (no visible body overlay):               ║
 * ║    helm    — head slot; shown in profile text, not rendered  ║
 * ║              (helm overlays conflict with skin hair designs)  ║
 * ║    boot    — foot slot; shown in text only                   ║
 * ║    ring    — shown in text only                              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const { resolveWeaponType } = require('./RigSpec');

// ── Asset root ────────────────────────────────────────────────────────────────
const ASSET_ROOT = path.join(__dirname, '..', '..', 'assets');

// ── Slots that get visual layers on the skin ──────────────────────────────────
const RENDERED_SLOTS = ['weapon', 'chest', 'cloak', 'vam'];

// ── Rarity colour tints for gear image overlays ───────────────────────────────
const RARITY_TINTS = {
  common:    null,                         // no tint — plain
  uncommon:  { r:45,  g:201, b:98,  a:0.08 },
  rare:      { r:74,  g:144, b:226, a:0.10 },
  epic:      { r:168, g:85,  b:247, a:0.12 },
  legendary: { r:245, g:158, b:11,  a:0.15 },
  mythic:    { r:225, g:29,  b:72,  a:0.18 },
};

// ── Weapon slot mapping ───────────────────────────────────────────────────────
// GearCatalog doesn't have a 'weapon' slot — weapons come from:
//   1. Class weapons (per level, in PlayerManager)
//   2. Crafted weapons (from recipe files)
//   3. Artifacts (from ArtifactSystem)
// All three resolve to a weapon name string on player.equippedGear.weapon
// We resolve it via resolveWeaponType() from RigSpec.

/**
 * Get the asset path for a weapon by name.
 * Path: assets/weapons/<type>/<safe_name>.png
 */
function getWeaponAssetPath(weaponName) {
  if (!weaponName) return null;
  const rule     = resolveWeaponType(weaponName);
  const safeName = weaponName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `weapons/${rule.type}/${safeName}.png`;
}

/**
 * Get the asset path for an armour piece by slot and name.
 * Path: assets/armor/<slot>/<safe_name>.png
 */
function getArmorAssetPath(slot, itemName) {
  if (!slot || !itemName) return null;
  const safeName = itemName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `armor/${slot}/${safeName}.png`;
}

/**
 * Check if a rendered asset exists on disk.
 */
function assetExists(relPath) {
  if (!relPath) return false;
  return fs.existsSync(path.join(ASSET_ROOT, relPath));
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: Build full gear layer data from a player object
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve all equipped gear on a player into renderable layer data.
 *
 * Returns an object with keys matching RENDERED_SLOTS.
 * Each key is either null (slot empty / no asset) or:
 *   {
 *     name:      string  — display name
 *     rarity:    string  — rarity key
 *     slot:      string  — gear slot
 *     assetPath: string  — relative path from assets/
 *     weaponType?: string — for weapon slot: type key
 *     combatState?: string — for weapon slot: animation state
 *     hasAsset:  boolean — whether the PNG file actually exists
 *   }
 *
 * @param {Object} player — full player DB object
 * @returns {Object} gearData
 */
function buildGearLayerData(player) {
  const equipped = player.equippedGear || {};
  const gearData = {};

  // ── Weapon ────────────────────────────────────────────────────────────────
  // Weapon can live at equippedGear.weapon OR be inferred from class
  const weaponItem = equipped.weapon || getClassWeapon(player);
  if (weaponItem) {
    const weaponName = typeof weaponItem === 'string' ? weaponItem : weaponItem.name;
    const rule       = resolveWeaponType(weaponName);
    const assetPath  = getWeaponAssetPath(weaponName);
    gearData.weapon = {
      name:        weaponName,
      rarity:      weaponItem.rarity || 'common',
      slot:        'weapon',
      assetPath,
      weaponType:  rule.type,
      combatState: rule.state,
      anchorKey:   rule.key,
      hasAsset:    assetExists(assetPath),
    };
  } else {
    gearData.weapon = null;
  }

  // ── Chest ────────────────────────────────────────────────────────────────
  if (equipped.chest) {
    const assetPath = getArmorAssetPath('chest', equipped.chest.name);
    gearData.chest = {
      name:      equipped.chest.name,
      rarity:    equipped.chest.rarity || 'common',
      slot:      'chest',
      assetPath,
      hasAsset:  assetExists(assetPath),
    };
  } else {
    gearData.chest = null;
  }

  // ── Cloak ────────────────────────────────────────────────────────────────
  if (equipped.cloak) {
    const assetPath = getArmorAssetPath('cloak', equipped.cloak.name);
    gearData.cloak = {
      name:      equipped.cloak.name,
      rarity:    equipped.cloak.rarity || 'common',
      slot:      'cloak',
      assetPath,
      hasAsset:  assetExists(assetPath),
    };
  } else {
    gearData.cloak = null;
  }

  // ── Vambrace ─────────────────────────────────────────────────────────────
  if (equipped.vam) {
    const assetPath = getArmorAssetPath('vam', equipped.vam.name);
    gearData.vam = {
      name:      equipped.vam.name,
      rarity:    equipped.vam.rarity || 'common',
      slot:      'vam',
      assetPath,
      hasAsset:  assetExists(assetPath),
    };
  } else {
    gearData.vam = null;
  }

  return gearData;
}

/**
 * Infer class weapon from player level + class.
 * Returns a { name, rarity } object or null.
 * Reads from PlayerManager's class weapon table.
 */
function getClassWeapon(player) {
  try {
    const PlayerManager = require('../player/PlayerManager');
    const cls           = player.evolvedClass || player.class;
    const level         = player.level || 1;
    if (!cls || !PlayerManager.CLASS_WEAPONS) return null;
    const classWeapons  = PlayerManager.CLASS_WEAPONS[cls];
    if (!classWeapons) return null;
    // Find the highest-tier weapon for current level
    const tiers = Object.keys(classWeapons)
      .map(Number).filter(t => t <= level).sort((a,b) => b - a);
    if (!tiers.length) return null;
    const weaponName = classWeapons[tiers[0]];
    return { name: weaponName, rarity: inferWeaponRarity(level) };
  } catch (e) {
    return null;
  }
}

/**
 * Infer weapon rarity from player level (class weapons scale with level).
 */
function inferWeaponRarity(level) {
  if (level >= 90) return 'mythic';
  if (level >= 70) return 'legendary';
  if (level >= 50) return 'epic';
  if (level >= 30) return 'rare';
  if (level >= 15) return 'uncommon';
  return 'common';
}

// ─────────────────────────────────────────────────────────────────────────────
// GEAR PROMPT GENERATION — for AI image tool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate an AI image prompt for a single gear piece.
 * Used by AssetPromptGenerator (Phase 5).
 *
 * @param {Object} gear — gear object from GearCatalog
 * @returns {Object} prompt data
 */
function buildGearPrompt(gear) {
  const slotDesc = {
    chest:  'chest armour piece, torso protection, front-facing, no character wearing it',
    cloak:  'flowing cloak or cape, displayed spread open showing front and back design',
    vam:    'pair of vambraces or arm bracers, displayed flat showing detail',
    helm:   'helmet or headpiece, displayed at a slight angle showing full design',
    boot:   'pair of boots or greaves, displayed side by side',
    ring:   'ornate ring, close-up showing gemstone and band design',
  };

  const rarityDesc = {
    common:    'simple design, muted colours, minimal detail, functional appearance',
    uncommon:  'clean design, single accent colour, some decorative elements',
    rare:      'detailed design, clear colour identity, glowing trim or markings',
    epic:      'ornate design, multiple layers, energy lines, dramatic colour palette',
    legendary: 'iconic design, particle effects visible, aura emanating from material, cinematic quality',
    mythic:    'transcendent design, reality-distorting aura, void cracks or divine light, peak visual fidelity',
  };

  const prompt = [
    `Game item concept art: ${gear.name}.`,
    `${slotDesc[gear.slot] || 'equipment piece, displayed clearly'}.`,
    `Rarity: ${gear.rarity} — ${rarityDesc[gear.rarity]}.`,
    `Description: ${gear.desc}`,
    `Lore: ${gear.lore}`,
    `Anime art style, clean background (white or transparent),`,
    `detailed game asset, professional quality, no characters or hands holding it.`,
  ].join(' ');

  return {
    id:            gear.id,
    name:          gear.name,
    slot:          gear.slot,
    rarity:        gear.rarity,
    filename:      getArmorAssetPath(gear.slot, gear.name),
    prompt,
    negativePrompt: 'character, person, hand, background scene, realistic, photograph, 3D render, watermark, text',
    midjourney:    `${prompt} --ar 1:1 --style anime --q 2`,
  };
}

/**
 * Generate a prompt for a weapon by name and type.
 *
 * @param {string} weaponName
 * @param {string} rarity
 * @param {string} description
 */
function buildWeaponPrompt(weaponName, rarity, description = '') {
  const rule = resolveWeaponType(weaponName);

  const typeDesc = {
    sword:   'longsword or greatsword, held vertically, blade clearly visible',
    spear:   'spear or lance, held at an angle, tip prominent',
    staff:   'magical staff or rod, upright, energy at the tip',
    bow:     'undrawn bow, displayed with bowstring, elegant curve',
    axe:     'battle axe or war maul, displayed at angle showing blade',
    scythe:  'curved scythe, dramatic arc, flowing in display position',
    dagger:  'dagger or short blade, displayed flat on surface',
    fist:    'combat gauntlet or knuckle weapon, displayed as pair',
    tome:    'open magical tome or spell orb, floating slightly',
    shield:  'round or tower shield, facing forward, crest visible',
    special: 'unique weapon form, displayed prominently',
  };

  const rarityDesc = {
    common:    'plain design, basic material, functional',
    uncommon:  'clean finish, some decorative detail, single accent colour',
    rare:      'detailed design, glowing runes or trim, clear power',
    epic:      'ornate, energy coursing through it, dramatic colour',
    legendary: 'iconic, particle aura, unmistakably legendary quality',
    mythic:    'transcendent, void cracks or divine glow, reality-warping presence',
  };

  const prompt = [
    `Game weapon concept art: ${weaponName}.`,
    `Weapon type: ${typeDesc[rule.type] || typeDesc.sword}.`,
    `Rarity: ${rarity} — ${rarityDesc[rarity] || rarityDesc.common}.`,
    description ? `Description: ${description}.` : '',
    `Anime game art style, clean white or transparent background,`,
    `weapon displayed alone with no character, professional game asset quality.`,
  ].filter(Boolean).join(' ');

  return {
    name:          weaponName,
    type:          rule.type,
    rarity,
    filename:      getWeaponAssetPath(weaponName),
    prompt,
    negativePrompt: 'character, hand, person, background, realistic, watermark, text, 3D render',
    midjourney:    `${prompt} --ar 1:1 --style anime --q 2`,
  };
}

// ── Format gear layer summary for profile card text ───────────────────────────

/**
 * Build a short gear summary string for profile text display.
 * Shows which slots have rendered assets vs text-only.
 */
function formatGearLayerSummary(gearData) {
  const lines = [];
  const slots = [
    { key: 'weapon', label: '⚔️ Weapon' },
    { key: 'chest',  label: '🛡️ Chest'  },
    { key: 'cloak',  label: '🌊 Cloak'  },
    { key: 'vam',    label: '🤜 Vam'    },
  ];
  for (const { key, label } of slots) {
    const g = gearData[key];
    if (g) {
      const indicator = g.hasAsset ? '🖼️' : '📝';
      lines.push(`${label}: *${g.name}* ${indicator}`);
    } else {
      lines.push(`${label}: —`);
    }
  }
  return lines.join('\n');
}

module.exports = {
  RENDERED_SLOTS,
  RARITY_TINTS,
  buildGearLayerData,
  getWeaponAssetPath,
  getArmorAssetPath,
  assetExists,
  buildGearPrompt,
  buildWeaponPrompt,
  formatGearLayerSummary,
  getClassWeapon,
  inferWeaponRarity,
};
