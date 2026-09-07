/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                  ✦ 𝐀𝐬𝐭𝐫𝐚™ — RigSpec.js                         ║
 * ║  Single source of truth for the base rig system.             ║
 * ║  All rendering, compositing, and animation decisions         ║
 * ║  reference this file.                                        ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * OVERVIEW
 * ─────────
 * The rig is a blank humanoid figure drawn in anime style.
 * It has no colour, shading or design of its own — skins are
 * full-body PNG textures that map exactly onto the rig's body
 * regions per animation frame.
 *
 * Every animation state is a pre-rendered spritesheet:
 *   - Fixed canvas size per frame
 *   - Fixed number of frames per state
 *   - Frames laid out in a single horizontal strip
 *   - Rig silhouette is always centred in the frame
 *
 * Gear layers (weapon, chest, cloak, vam) are separate PNGs
 * that composite over the skin layer for each frame.
 *
 * Asset path convention:
 *   assets/rig/<state>.png          ← spritesheet for that state
 *   assets/skins/<rarity>/<id>.png  ← full-body skin texture
 *   assets/weapons/<type>/<name>.png
 *   assets/armor/<slot>/<name>.png
 */

'use strict';

// ── Canvas dimensions ──────────────────────────────────────────────────────────
const FRAME_WIDTH  = 256;   // px — single frame width
const FRAME_HEIGHT = 512;   // px — single frame height (2:1 ratio, full body)
const CARD_WIDTH   = 800;   // px — profile card total width
const CARD_HEIGHT  = 460;   // px — profile card total height

// ── Rig body region map (relative to frame, 0–1 normalised) ──────────────────
// Used by the compositing engine to align skin layers.
const BODY_REGIONS = {
  head:       { x: 0.30, y: 0.02, w: 0.40, h: 0.18 },  // head top → chin
  neck:       { x: 0.38, y: 0.20, w: 0.24, h: 0.06 },
  torso:      { x: 0.22, y: 0.26, w: 0.56, h: 0.28 },  // shoulders → waist
  leftArm:    { x: 0.04, y: 0.26, w: 0.18, h: 0.30 },
  rightArm:   { x: 0.78, y: 0.26, w: 0.18, h: 0.30 },
  leftHand:   { x: 0.04, y: 0.52, w: 0.14, h: 0.08 },
  rightHand:  { x: 0.82, y: 0.52, w: 0.14, h: 0.08 },
  hips:       { x: 0.26, y: 0.54, w: 0.48, h: 0.10 },
  leftLeg:    { x: 0.24, y: 0.64, w: 0.22, h: 0.28 },
  rightLeg:   { x: 0.54, y: 0.64, w: 0.22, h: 0.28 },
  leftFoot:   { x: 0.20, y: 0.90, w: 0.22, h: 0.10 },
  rightFoot:  { x: 0.58, y: 0.90, w: 0.22, h: 0.10 },
};

// ── Gear layer anchor points per animation state ───────────────────────────────
// Each key = animation state name.
// Each value = { weapon, chest, cloak, vam } anchor positions.
// Position is { x, y, w, h } normalised 0–1 within the frame.
// The gear PNG is scaled to fill that region and composited over the skin.
const GEAR_ANCHORS = {
  idle: {
    weapon_sword:  { x: 0.80, y: 0.30, w: 0.22, h: 0.55, rotate: 15  },
    weapon_spear:  { x: 0.82, y: 0.10, w: 0.14, h: 0.80, rotate: 5   },
    weapon_staff:  { x: 0.82, y: 0.08, w: 0.16, h: 0.82, rotate: 0   },
    weapon_bow:    { x: 0.76, y: 0.22, w: 0.20, h: 0.56, rotate: 0   },
    weapon_axe:    { x: 0.78, y: 0.28, w: 0.24, h: 0.52, rotate: 10  },
    weapon_scythe: { x: 0.68, y: 0.10, w: 0.30, h: 0.78, rotate: -10 },
    weapon_dagger: { x: 0.80, y: 0.40, w: 0.16, h: 0.36, rotate: 20  },
    weapon_fist:   { x: 0.76, y: 0.42, w: 0.20, h: 0.20, rotate: 0   },
    weapon_tome:   { x: 0.76, y: 0.36, w: 0.20, h: 0.26, rotate: -5  },
    weapon_shield: { x: 0.02, y: 0.28, w: 0.26, h: 0.42, rotate: 0   },
    weapon_special:{ x: 0.78, y: 0.26, w: 0.22, h: 0.50, rotate: 5   },
    chest:         { x: 0.22, y: 0.26, w: 0.56, h: 0.28 },
    cloak:         { x: 0.12, y: 0.22, w: 0.76, h: 0.52 },
    vam:           { x: 0.04, y: 0.30, w: 0.92, h: 0.24 },
  },
  walk: {
    weapon_sword:  { x: 0.78, y: 0.28, w: 0.22, h: 0.54, rotate: 20  },
    weapon_spear:  { x: 0.80, y: 0.08, w: 0.14, h: 0.80, rotate: 8   },
    weapon_staff:  { x: 0.80, y: 0.06, w: 0.16, h: 0.82, rotate: 4   },
    weapon_bow:    { x: 0.74, y: 0.20, w: 0.22, h: 0.58, rotate: 0   },
    weapon_axe:    { x: 0.76, y: 0.26, w: 0.24, h: 0.52, rotate: 14  },
    weapon_scythe: { x: 0.66, y: 0.08, w: 0.32, h: 0.78, rotate: -8  },
    weapon_dagger: { x: 0.78, y: 0.38, w: 0.16, h: 0.36, rotate: 25  },
    weapon_fist:   { x: 0.74, y: 0.40, w: 0.20, h: 0.22, rotate: 10  },
    weapon_tome:   { x: 0.74, y: 0.34, w: 0.22, h: 0.28, rotate: -8  },
    weapon_shield: { x: 0.02, y: 0.26, w: 0.26, h: 0.44, rotate: 5   },
    weapon_special:{ x: 0.76, y: 0.24, w: 0.24, h: 0.52, rotate: 8   },
    chest:         { x: 0.22, y: 0.26, w: 0.56, h: 0.28 },
    cloak:         { x: 0.10, y: 0.20, w: 0.80, h: 0.56 },
    vam:           { x: 0.04, y: 0.28, w: 0.92, h: 0.26 },
  },
  combat_sword: {
    weapon_sword:  { x: 0.55, y: 0.10, w: 0.30, h: 0.65, rotate: -45 },
    chest:         { x: 0.22, y: 0.26, w: 0.56, h: 0.28 },
    cloak:         { x: 0.12, y: 0.22, w: 0.76, h: 0.52 },
    vam:           { x: 0.04, y: 0.30, w: 0.92, h: 0.24 },
  },
  combat_staff: {
    weapon_staff:  { x: 0.60, y: 0.05, w: 0.16, h: 0.88, rotate: -20 },
    chest:         { x: 0.22, y: 0.26, w: 0.56, h: 0.28 },
    cloak:         { x: 0.12, y: 0.22, w: 0.76, h: 0.52 },
    vam:           { x: 0.04, y: 0.30, w: 0.92, h: 0.24 },
  },
  combat_bow: {
    weapon_bow:    { x: 0.10, y: 0.18, w: 0.22, h: 0.60, rotate: 0   },
    chest:         { x: 0.22, y: 0.26, w: 0.56, h: 0.28 },
    cloak:         { x: 0.12, y: 0.22, w: 0.76, h: 0.52 },
    vam:           { x: 0.04, y: 0.30, w: 0.92, h: 0.24 },
  },
  combat_spear: {
    weapon_spear:  { x: 0.55, y: 0.05, w: 0.14, h: 0.88, rotate: -30 },
    chest:         { x: 0.22, y: 0.26, w: 0.56, h: 0.28 },
    cloak:         { x: 0.12, y: 0.22, w: 0.76, h: 0.52 },
    vam:           { x: 0.04, y: 0.30, w: 0.92, h: 0.24 },
  },
  combat_axe: {
    weapon_axe:    { x: 0.50, y: 0.08, w: 0.30, h: 0.58, rotate: -60 },
    chest:         { x: 0.22, y: 0.26, w: 0.56, h: 0.28 },
    cloak:         { x: 0.12, y: 0.22, w: 0.76, h: 0.52 },
    vam:           { x: 0.04, y: 0.30, w: 0.92, h: 0.24 },
  },
  combat_scythe: {
    weapon_scythe: { x: 0.40, y: 0.04, w: 0.50, h: 0.80, rotate: -40 },
    chest:         { x: 0.22, y: 0.26, w: 0.56, h: 0.28 },
    cloak:         { x: 0.12, y: 0.22, w: 0.76, h: 0.52 },
    vam:           { x: 0.04, y: 0.30, w: 0.92, h: 0.24 },
  },
  combat_dagger: {
    weapon_dagger: { x: 0.58, y: 0.28, w: 0.18, h: 0.40, rotate: -30 },
    chest:         { x: 0.22, y: 0.26, w: 0.56, h: 0.28 },
    cloak:         { x: 0.12, y: 0.22, w: 0.76, h: 0.52 },
    vam:           { x: 0.04, y: 0.30, w: 0.92, h: 0.24 },
  },
  equip: {
    weapon_sword:  { x: 0.74, y: 0.16, w: 0.26, h: 0.68, rotate: -10 },
    weapon_spear:  { x: 0.78, y: 0.04, w: 0.16, h: 0.88, rotate: 0   },
    weapon_staff:  { x: 0.78, y: 0.02, w: 0.18, h: 0.90, rotate: 0   },
    weapon_bow:    { x: 0.70, y: 0.16, w: 0.24, h: 0.64, rotate: 0   },
    weapon_axe:    { x: 0.72, y: 0.22, w: 0.26, h: 0.58, rotate: 5   },
    weapon_scythe: { x: 0.62, y: 0.06, w: 0.34, h: 0.84, rotate: -5  },
    weapon_dagger: { x: 0.76, y: 0.34, w: 0.18, h: 0.42, rotate: 15  },
    weapon_fist:   { x: 0.72, y: 0.38, w: 0.22, h: 0.24, rotate: 0   },
    weapon_tome:   { x: 0.72, y: 0.30, w: 0.24, h: 0.32, rotate: -3  },
    weapon_shield: { x: 0.04, y: 0.24, w: 0.28, h: 0.46, rotate: 0   },
    weapon_special:{ x: 0.74, y: 0.22, w: 0.24, h: 0.56, rotate: 3   },
    chest:         { x: 0.22, y: 0.26, w: 0.56, h: 0.28 },
    cloak:         { x: 0.12, y: 0.22, w: 0.76, h: 0.52 },
    vam:           { x: 0.04, y: 0.30, w: 0.92, h: 0.24 },
  },
  victory: {
    weapon_sword:  { x: 0.66, y: 0.08, w: 0.28, h: 0.72, rotate: -25 },
    weapon_spear:  { x: 0.78, y: 0.04, w: 0.14, h: 0.88, rotate: -8  },
    weapon_staff:  { x: 0.78, y: 0.04, w: 0.16, h: 0.88, rotate: -5  },
    weapon_bow:    { x: 0.70, y: 0.14, w: 0.22, h: 0.64, rotate: 5   },
    weapon_axe:    { x: 0.66, y: 0.18, w: 0.28, h: 0.60, rotate: -15 },
    weapon_scythe: { x: 0.58, y: 0.06, w: 0.36, h: 0.82, rotate: -15 },
    weapon_dagger: { x: 0.78, y: 0.30, w: 0.18, h: 0.42, rotate: 30  },
    weapon_fist:   { x: 0.72, y: 0.36, w: 0.22, h: 0.26, rotate: -10 },
    weapon_tome:   { x: 0.72, y: 0.28, w: 0.24, h: 0.34, rotate: 5   },
    weapon_shield: { x: 0.04, y: 0.22, w: 0.28, h: 0.48, rotate: -5  },
    weapon_special:{ x: 0.72, y: 0.20, w: 0.26, h: 0.58, rotate: -8  },
    chest:         { x: 0.22, y: 0.26, w: 0.56, h: 0.28 },
    cloak:         { x: 0.10, y: 0.18, w: 0.80, h: 0.58 },
    vam:           { x: 0.04, y: 0.28, w: 0.92, h: 0.26 },
  },
  damaged: {
    weapon_sword:  { x: 0.64, y: 0.30, w: 0.28, h: 0.58, rotate: 35  },
    weapon_spear:  { x: 0.76, y: 0.18, w: 0.14, h: 0.76, rotate: 15  },
    weapon_staff:  { x: 0.76, y: 0.16, w: 0.16, h: 0.78, rotate: 12  },
    weapon_bow:    { x: 0.68, y: 0.28, w: 0.22, h: 0.58, rotate: 10  },
    weapon_axe:    { x: 0.64, y: 0.32, w: 0.26, h: 0.54, rotate: 25  },
    weapon_scythe: { x: 0.56, y: 0.14, w: 0.36, h: 0.76, rotate: 15  },
    weapon_dagger: { x: 0.76, y: 0.42, w: 0.18, h: 0.38, rotate: 40  },
    weapon_fist:   { x: 0.70, y: 0.46, w: 0.22, h: 0.22, rotate: 15  },
    weapon_tome:   { x: 0.70, y: 0.38, w: 0.24, h: 0.30, rotate: 15  },
    weapon_shield: { x: 0.06, y: 0.30, w: 0.26, h: 0.44, rotate: 10  },
    weapon_special:{ x: 0.70, y: 0.28, w: 0.24, h: 0.52, rotate: 12  },
    chest:         { x: 0.22, y: 0.26, w: 0.56, h: 0.28 },
    cloak:         { x: 0.08, y: 0.20, w: 0.82, h: 0.56 },
    vam:           { x: 0.04, y: 0.28, w: 0.92, h: 0.26 },
  },
};

// ── Animation states ───────────────────────────────────────────────────────────
// name        — used as filename: assets/rig/<name>.png
// frames      — number of frames in the horizontal spritesheet strip
// fps         — playback speed when assembled into video
// loop        — whether the animation loops
// description — human-readable description for AI prompt generation
const ANIMATION_STATES = {
  idle: {
    frames: 8,
    fps: 6,
    loop: true,
    description: 'Standing still in a relaxed combat-ready stance, weight slightly on back foot, breathing animation, hair/cloak moving slightly',
  },
  walk: {
    frames: 12,
    fps: 12,
    loop: true,
    description: 'Walking forward confidently, full stride cycle, arms swinging naturally, hair flowing back',
  },
  combat_sword: {
    frames: 10,
    fps: 14,
    loop: false,
    description: 'Two-handed sword fighting stance — overhead slash, follow-through, return to guard',
  },
  combat_staff: {
    frames: 10,
    fps: 14,
    loop: false,
    description: 'Staff/magic casting stance — raise staff, energy charge at tip, release spell forward',
  },
  combat_bow: {
    frames: 10,
    fps: 14,
    loop: false,
    description: 'Archery stance — draw bowstring, aim forward, release, follow-through',
  },
  combat_spear: {
    frames: 10,
    fps: 14,
    loop: false,
    description: 'Spear/lance thrust — step forward, two-hand thrust, pull back to guard stance',
  },
  combat_axe: {
    frames: 10,
    fps: 14,
    loop: false,
    description: 'Heavy axe swing — wide horizontal sweep from right shoulder, full body rotation, recovery',
  },
  combat_scythe: {
    frames: 10,
    fps: 14,
    loop: false,
    description: 'Scythe arc — wide sweeping arc from high left to low right, fluid and graceful',
  },
  combat_dagger: {
    frames: 10,
    fps: 16,
    loop: false,
    description: 'Fast dagger slash — rapid close-quarters stab and slash combo, two-hit then back',
  },
  equip: {
    frames: 8,
    fps: 10,
    loop: false,
    description: 'Holding weapon out to the side proudly, slight pose, showing off equipped gear clearly',
  },
  victory: {
    frames: 10,
    fps: 10,
    loop: false,
    description: 'Victory pose — weapon raised high, confident stance, slight particle effects around character',
  },
  damaged: {
    frames: 6,
    fps: 12,
    loop: false,
    description: 'Recoiling from a hit — stumble back, one arm raised defensively, recover to guard',
  },
};

// ── Weapon type classification ─────────────────────────────────────────────────
// Maps weapon names / keywords → animation state and gear anchor key.
// Order matters — first match wins.
const WEAPON_TYPE_RULES = [
  { type: 'sword',   state: 'combat_sword',  key: 'weapon_sword',
    keywords: ['sword','blade','saber','sabre','katana','greatsword','claymore','slasher','edge','excalibur','frostmourne','dragonslayer','bane','sliver','sovereign blade','crest blade','drake blade','giant sword','reality blade','whelp sword','eternal flame greatsword','ashen drake sword','andesite axe'] },
  { type: 'spear',   state: 'combat_spear',  key: 'weapon_spear',
    keywords: ['spear','lance','pike','trident','javelin','partisan','halberd','glaive','gungnir','naginata','polearm','guard lance','sovereign lance','void dragon spear','nullification crystal spear','demon lord sovereign lance'] },
  { type: 'staff',   state: 'combat_staff',  key: 'weapon_staff',
    keywords: ['staff','rod','wand','scepter','sceptre','tome staff','oracle','cane','focus','abomination staff','void abomination staff','incarnate chaos staff','void wraith','science staff','cosmic oracle','apocalypse reaper','lich king'] },
  { type: 'bow',     state: 'combat_bow',    key: 'weapon_bow',
    keywords: ['bow','arrow','crossbow','moonlight bow','longbow','recurve','windrunner','bat wing bow','celestial windrunner','dragon bone bow','elven recurve','short bow'] },
  { type: 'axe',     state: 'combat_axe',    key: 'weapon_axe',
    keywords: ['axe','maul','cleaver','hatchet','crusher','warlord demon war axe','void titan maul','behemoth crusher','ragnarok destroyer','heavy axe','war cleaver','blood reaver'] },
  { type: 'scythe',  state: 'combat_scythe', key: 'weapon_scythe',
    keywords: ['scythe','void wraith scythe','oblivion shade scythe','disaster wisp scythe',"devourer's scythe",'soul reaper scythe'] },
  { type: 'dagger',  state: 'combat_dagger', key: 'weapon_dagger',
    keywords: ['dagger','knife','needle','kris','shadow fang','fang blade','ancient fang','bat fang sword','twin daggers','night whisper','phantom reaver','iron dagger','shadow blade','venomous kris','assassin','shadow fang'] },
  { type: 'fist',    state: 'combat_sword',  key: 'weapon_fist',
    keywords: ['fist','knuckle','iron fists','andesite knuckles','punch','gauntlet fist'] },
  { type: 'tome',    state: 'combat_staff',  key: 'weapon_tome',
    keywords: ['tome','orb','book','grimoire','summoner','elemental orb','nitro formula flask','revive stone cannon','science blaster','perseus reactor','abyss void oracle'] },
  { type: 'shield',  state: 'combat_sword',  key: 'weapon_shield',
    keywords: ['shield','bulwark','aegis','tower shield','iron shield','fortress bulwark','titan aegis','impenetrable wall'] },
  { type: 'special', state: 'combat_sword',  key: 'weapon_special',
    keywords: ['shadow fans','war banner','time staff','kingdom of science','bat idol'] },
];

/**
 * Resolve a weapon name to its weapon type info.
 * Returns the matching rule or defaults to 'sword'.
 */
function resolveWeaponType(weaponName) {
  if (!weaponName) return WEAPON_TYPE_RULES[0];
  const lower = weaponName.toLowerCase();
  for (const rule of WEAPON_TYPE_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) return rule;
  }
  return WEAPON_TYPE_RULES[0]; // default to sword
}

/**
 * Get the gear anchor for a given layer type in a given animation state.
 * Falls back to idle anchors if the state doesn't have a specific override.
 */
function getGearAnchor(state, layerKey) {
  const stateAnchors = GEAR_ANCHORS[state];
  if (stateAnchors && stateAnchors[layerKey]) return stateAnchors[layerKey];
  const idleAnchors = GEAR_ANCHORS['idle'];
  return idleAnchors[layerKey] || idleAnchors['weapon_sword'];
}

/**
 * Get the spritesheet path for a given animation state.
 */
function getRigSpritesheetPath(state) {
  return `assets/rig/${state}.png`;
}

/**
 * Get a specific frame region from a spritesheet.
 * Returns { left, top, width, height } for sharp.extract().
 */
function getFrameRegion(state, frameIndex) {
  const { frames } = ANIMATION_STATES[state];
  if (frameIndex >= frames) throw new Error(`Frame ${frameIndex} out of range for state ${state} (max ${frames - 1})`);
  return {
    left:   frameIndex * FRAME_WIDTH,
    top:    0,
    width:  FRAME_WIDTH,
    height: FRAME_HEIGHT,
  };
}

module.exports = {
  FRAME_WIDTH,
  FRAME_HEIGHT,
  CARD_WIDTH,
  CARD_HEIGHT,
  BODY_REGIONS,
  GEAR_ANCHORS,
  ANIMATION_STATES,
  WEAPON_TYPE_RULES,
  resolveWeaponType,
  getGearAnchor,
  getRigSpritesheetPath,
  getFrameRegion,
};
