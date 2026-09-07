/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                ✦ 𝐀𝐬𝐭𝐫𝐚™ — RigRenderer.js                       ║
 * ║  Canvas/Sharp compositing engine for the rig system.         ║
 * ║                                                              ║
 * ║  Responsibilities:                                           ║
 * ║    • Extract individual frames from rig spritesheets         ║
 * ║    • Composite skin texture over rig frame                   ║
 * ║    • Composite gear layers (weapon, chest, cloak, vam)       ║
 * ║    • Output: single PNG buffer (profile) or                  ║
 * ║              frame buffer array (video pipeline)             ║
 * ║    • Build profile card (skin frame + stats text)            ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

const sharp   = require('sharp');
const path    = require('path');
const fs      = require('fs');
const { createCanvas, loadImage } = require('canvas');

const {
  FRAME_WIDTH, FRAME_HEIGHT,
  CARD_WIDTH, CARD_HEIGHT,
  ANIMATION_STATES,
  GEAR_ANCHORS,
  resolveWeaponType,
  getGearAnchor,
  getRigSpritesheetPath,
  getFrameRegion,
} = require('./RigSpec');

// ── Asset root ─────────────────────────────────────────────────────────────────
const ASSET_ROOT = path.join(__dirname, '..', '..', 'assets');

// ── Rarity colour palette ──────────────────────────────────────────────────────
const RARITY_COLOURS = {
  common:    { primary: '#9aa0a8', glow: 'rgba(154,160,168,0.35)', text: '#c8cdd4' },
  uncommon:  { primary: '#2dc962', glow: 'rgba(45,201,98,0.40)',   text: '#5de88a' },
  rare:      { primary: '#4a90e2', glow: 'rgba(74,144,226,0.40)',  text: '#7fb3f0' },
  epic:      { primary: '#a855f7', glow: 'rgba(168,85,247,0.40)',  text: '#c984ff' },
  legendary: { primary: '#f59e0b', glow: 'rgba(245,158,11,0.45)', text: '#fcd34d' },
  mythic:    { primary: '#e11d48', glow: 'rgba(225,29,72,0.50)',   text: '#ff6b8a' },
};

// ── Fallback colours for missing assets ───────────────────────────────────────
const FALLBACK_SKIN_COLOUR   = '#1a2535';
const FALLBACK_WEAPON_COLOUR = '#2a3545';

// ── Helpers ───────────────────────────────────────────────────────────────────

function assetExists(relPath) {
  return fs.existsSync(path.join(ASSET_ROOT, relPath));
}

function assetPath(relPath) {
  return path.join(ASSET_ROOT, relPath);
}

/**
 * Load an image as a sharp pipeline buffer.
 * If the file doesn't exist, returns a solid-colour placeholder of the same size.
 */
async function loadAsset(relPath, width, height, fallbackColour = '#111827') {
  const full = path.join(ASSET_ROOT, relPath);
  if (fs.existsSync(full)) {
    return await sharp(full).resize(width, height, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } }).toBuffer();
  }
  // Placeholder — semi-transparent dark rectangle
  return await sharp({
    create: { width, height, channels: 4, background: { r:26, g:37, b:53, alpha:180 } }
  }).png().toBuffer();
}

/**
 * Extract a single frame from a horizontal spritesheet.
 */
async function extractFrame(spritesheetPath, frameIndex, state) {
  const { left, top, width, height } = getFrameRegion(state, frameIndex);
  const full = path.join(ASSET_ROOT, spritesheetPath);
  if (!fs.existsSync(full)) {
    // Return blank frame
    return sharp({
      create: { width: FRAME_WIDTH, height: FRAME_HEIGHT, channels: 4,
                background: { r:0, g:0, b:0, alpha:0 } }
    }).png().toBuffer();
  }
  return sharp(full).extract({ left, top, width, height }).toBuffer();
}

/**
 * Scale and position a layer PNG within a frame using gear anchor data.
 * anchor: { x, y, w, h, rotate? } — all normalised 0–1 relative to frame.
 * Returns a compositable { input, left, top }.
 */
async function buildGearLayer(assetRelPath, anchor, frameW, frameH) {
  const pixX = Math.round(anchor.x * frameW);
  const pixY = Math.round(anchor.y * frameH);
  const pixW = Math.round(anchor.w * frameW);
  const pixH = Math.round(anchor.h * frameH);

  const full = path.join(ASSET_ROOT, assetRelPath);
  if (!fs.existsSync(full)) return null;

  let pipeline = sharp(full)
    .resize(pixW, pixH, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } });

  if (anchor.rotate) {
    pipeline = pipeline.rotate(anchor.rotate, { background: { r:0,g:0,b:0,alpha:0 } });
  }

  const buf = await pipeline.toBuffer();
  return { input: buf, left: pixX, top: pixY };
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: Composite a single frame with skin + gear layers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render a single composited frame.
 *
 * @param {string} state         — animation state name
 * @param {number} frameIndex    — 0-based frame index
 * @param {Object} skinData      — { id, rarity, assetPath }
 * @param {Object} gearData      — { weapon, chest, cloak, vam } each { name, assetPath }
 * @returns {Buffer}             — PNG buffer of the composited frame
 */
async function renderFrame(state, frameIndex, skinData, gearData = {}) {
  // 1. Get rig frame
  const rigSheet  = getRigSpritesheetPath(state);
  const rigFrame  = await extractFrame(rigSheet, frameIndex, state);

  // 2. Build skin layer — full frame size, same dimensions as rig frame
  const skinRel   = skinData?.assetPath || null;
  const skinBuf   = skinRel && assetExists(skinRel)
    ? await sharp(path.join(ASSET_ROOT, skinRel))
        .resize(FRAME_WIDTH, FRAME_HEIGHT, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } })
        .toBuffer()
    : null;

  // 3. Build gear layers
  const composites = [];
  if (skinBuf) composites.push({ input: skinBuf, left: 0, top: 0 });

  // Determine weapon type for anchor key
  const weaponName = gearData?.weapon?.name || '';
  const weaponRule = resolveWeaponType(weaponName);
  const weaponKey  = weaponRule.key;

  const gearMap = [
    { key: 'chest',   path: gearData?.chest?.assetPath   },
    { key: 'cloak',   path: gearData?.cloak?.assetPath   },
    { key: 'vam',     path: gearData?.vam?.assetPath     },
    { key: weaponKey, path: gearData?.weapon?.assetPath  },
  ];

  for (const { key, path: relPath } of gearMap) {
    if (!relPath) continue;
    const anchor = getGearAnchor(state, key);
    if (!anchor) continue;
    const layer = await buildGearLayer(relPath, anchor, FRAME_WIDTH, FRAME_HEIGHT);
    if (layer) composites.push(layer);
  }

  // 4. Composite everything over rig frame
  const result = await sharp(rigFrame)
    .composite(composites)
    .png()
    .toBuffer();

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE CARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a full profile card image.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  [RARITY GLOW BG]                                            │
 *   │  ┌──────────────┐  PlayerName        Rank / Level           │
 *   │  │  Skin Frame  │  Class · Quality                          │
 *   │  │  (equip      │  ──────────────────                       │
 *   │  │   pose)      │  ATK  DEF  SPD  HP  CRIT                  │
 *   │  │              │  ──────────────────                       │
 *   │  │              │  Weapon  │  Chest  │  Cloak  │  Vam       │
 *   │  └──────────────┘                                            │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * @param {Object} player   — full player object from DB
 * @param {Object} skinData — { id, rarity, name, assetPath }
 * @param {Object} gearData — { weapon, chest, cloak, vam } each { name, assetPath, rarity }
 * @returns {Buffer}        — PNG buffer of the complete card
 */
async function buildProfileCard(player, skinData, gearData = {}) {
  const rarity   = skinData?.rarity || 'common';
  const colours  = RARITY_COLOURS[rarity] || RARITY_COLOURS.common;

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx    = canvas.getContext('2d');

  // ── Background ──────────────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bgGrad.addColorStop(0, '#070e18');
  bgGrad.addColorStop(1, '#0c1827');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Rarity glow — radial on the left where the skin sits
  const glowRad = ctx.createRadialGradient(200, CARD_HEIGHT / 2, 30, 200, CARD_HEIGHT / 2, 260);
  glowRad.addColorStop(0, colours.glow);
  glowRad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowRad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Top accent line
  const lineGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, 0);
  lineGrad.addColorStop(0, 'transparent');
  lineGrad.addColorStop(0.3, colours.primary);
  lineGrad.addColorStop(0.7, colours.primary);
  lineGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, 2);

  // ── Skin frame (equip pose, frame 0) ────────────────────────────────────────
  const SKIN_X = 24;
  const SKIN_Y = 20;
  const SKIN_W = 200;
  const SKIN_H = 420;

  try {
    const frameBuf = await renderFrame('equip', 0, skinData, gearData);
    const skinImg  = await loadImage(frameBuf);
    ctx.drawImage(skinImg, SKIN_X, SKIN_Y, SKIN_W, SKIN_H);
  } catch (e) {
    // Fallback — coloured rect with rarity colour
    ctx.fillStyle = colours.glow;
    ctx.fillRect(SKIN_X, SKIN_Y, SKIN_W, SKIN_H);
  }

  // ── Skin rarity badge ────────────────────────────────────────────────────────
  ctx.fillStyle = colours.primary;
  ctx.globalAlpha = 0.9;
  roundRect(ctx, SKIN_X, SKIN_Y + SKIN_H - 28, SKIN_W, 28, { bl: 8, br: 8 });
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((skinData?.name || 'Unknown Skin').toUpperCase(), SKIN_X + SKIN_W / 2, SKIN_Y + SKIN_H - 10);

  // ── Stats section ───────────────────────────────────────────────────────────
  const TX = 248;   // text start X
  let TY   = 32;    // text cursor Y

  // Player name
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ddeeff';
  ctx.font      = 'bold 28px sans-serif';
  ctx.fillText(player.name || 'Unknown Hunter', TX, TY + 28);
  TY += 40;

  // Rank + Level
  ctx.font      = 'bold 16px sans-serif';
  ctx.fillStyle = colours.text;
  const rankStr = `Rank ${player.rank || 'E'}  ·  Level ${player.level || 1}`;
  ctx.fillText(rankStr, TX, TY);
  TY += 24;

  // Class + quality
  ctx.font      = '14px sans-serif';
  ctx.fillStyle = '#7a9bbf';
  const classStr = `${player.class || 'No Class'}  ·  Quality ${player.classQuality || 0}%`;
  ctx.fillText(classStr, TX, TY);
  TY += 28;

  // Divider
  dividerLine(ctx, TX, TY, CARD_WIDTH - TX - 20, colours.primary);
  TY += 18;

  // Core stats
  const stats = player.stats || {};
  const statRows = [
    ['⚔️ ATK', stats.atk || 0],
    ['🛡️ DEF', stats.def || 0],
    ['💨 SPD', stats.spd || stats.speed || 0],
    ['❤️ HP',  stats.hp || 0],
    ['💥 CRIT', `${stats.crit || 0}%`],
  ];

  const colW = (CARD_WIDTH - TX - 20) / 5;
  statRows.forEach(([label, val], i) => {
    const sx = TX + i * colW;
    ctx.font      = '11px sans-serif';
    ctx.fillStyle = '#4a6a8a';
    ctx.fillText(label, sx, TY);
    ctx.font      = 'bold 20px sans-serif';
    ctx.fillStyle = '#ddeeff';
    ctx.fillText(String(val), sx, TY + 22);
  });
  TY += 50;

  // Divider
  dividerLine(ctx, TX, TY, CARD_WIDTH - TX - 20, colours.primary);
  TY += 18;

  // Gear row
  const gearSlots = [
    { label: 'WEAPON', data: gearData?.weapon },
    { label: 'CHEST',  data: gearData?.chest  },
    { label: 'CLOAK',  data: gearData?.cloak  },
    { label: 'VAM',    data: gearData?.vam    },
  ];

  const gearColW = (CARD_WIDTH - TX - 20) / 4;
  for (let i = 0; i < gearSlots.length; i++) {
    const { label, data } = gearSlots[i];
    const gx = TX + i * gearColW;
    const gc = data ? (RARITY_COLOURS[data.rarity] || RARITY_COLOURS.common) : RARITY_COLOURS.common;

    // Gear card bg
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    roundRect(ctx, gx, TY, gearColW - 6, 76, 6);
    ctx.fill();

    ctx.strokeStyle = gc.primary;
    ctx.lineWidth   = 1;
    roundRect(ctx, gx, TY, gearColW - 6, 76, 6);
    ctx.stroke();

    ctx.font      = '10px sans-serif';
    ctx.fillStyle = '#4a6a8a';
    ctx.textAlign = 'left';
    ctx.fillText(label, gx + 8, TY + 14);

    ctx.font      = 'bold 12px sans-serif';
    ctx.fillStyle = gc.text;
    const gName   = (data?.name || '—').toUpperCase();
    wrapText(ctx, gName, gx + 8, TY + 30, gearColW - 16, 14);
  }

  ctx.textAlign = 'left';
  return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAME SEQUENCE — for video pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render all frames of an animation state as an array of PNG buffers.
 * Used by GateVideoEngine to assemble MP4 via ffmpeg.
 *
 * @param {string} state      — animation state
 * @param {Object} skinData   — skin info
 * @param {Object} gearData   — gear info
 * @returns {Buffer[]}        — array of PNG frame buffers in order
 */
async function renderFrameSequence(state, skinData, gearData = {}) {
  const { frames } = ANIMATION_STATES[state];
  const result = [];
  for (let i = 0; i < frames; i++) {
    const buf = await renderFrame(state, i, skinData, gearData);
    result.push(buf);
  }
  return result;
}

/**
 * Render walk frames for multiple party members side by side.
 * Used for gate entry videos.
 *
 * @param {Array}  members    — [{ skinData, gearData }, ...]
 * @param {number} frameIndex — which walk frame to render
 * @returns {Buffer}          — PNG buffer with all members composited side by side
 */
async function renderPartyFrame(members, frameIndex) {
  if (!members || members.length === 0) return null;

  const totalW = members.length * FRAME_WIDTH;
  const totalH = FRAME_HEIGHT;

  // Build base canvas
  const canvas = createCanvas(totalW, totalH);
  const ctx    = canvas.getContext('2d');
  ctx.clearRect(0, 0, totalW, totalH);

  for (let i = 0; i < members.length; i++) {
    const { skinData, gearData } = members[i];
    const safeFrame = frameIndex % ANIMATION_STATES.walk.frames;
    try {
      const buf  = await renderFrame('walk', safeFrame, skinData, gearData);
      const img  = await loadImage(buf);
      ctx.drawImage(img, i * FRAME_WIDTH, 0, FRAME_WIDTH, FRAME_HEIGHT);
    } catch (e) {
      // Draw placeholder
      ctx.fillStyle = `rgba(${20 + i * 15}, 30, 60, 0.8)`;
      ctx.fillRect(i * FRAME_WIDTH, 0, FRAME_WIDTH, FRAME_HEIGHT);
    }
  }

  return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// SKIN ASSET PATH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getSkinAssetPath(skinId, rarity) {
  return `skins/${rarity}/${skinId}.png`;
}

function getWeaponAssetPath(weaponName, weaponType) {
  const safeName = weaponName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `weapons/${weaponType}/${safeName}.png`;
}

function getArmorAssetPath(slot, itemName) {
  const safeName = itemName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `armor/${slot}/${safeName}.png`;
}

/**
 * Build a complete gearData object from a player's equipped items,
 * resolving asset paths for each slot.
 */
function buildGearData(player) {
  const equipped = player.equipped || {};
  const gearData = {};

  if (equipped.weapon) {
    const wType = resolveWeaponType(equipped.weapon.name);
    gearData.weapon = {
      name:      equipped.weapon.name,
      rarity:    equipped.weapon.rarity || 'common',
      assetPath: getWeaponAssetPath(equipped.weapon.name, wType.type),
    };
  }
  for (const slot of ['chest', 'cloak', 'vam']) {
    if (equipped[slot]) {
      gearData[slot] = {
        name:      equipped[slot].name,
        rarity:    equipped[slot].rarity || 'common',
        assetPath: getArmorAssetPath(slot, equipped[slot].name),
      };
    }
  }
  return gearData;
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  const radius = typeof r === 'number'
    ? { tl: r, tr: r, br: r, bl: r }
    : { tl: r.tl||0, tr: r.tr||0, br: r.br||0, bl: r.bl||0 };
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + w - radius.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius.tr);
  ctx.lineTo(x + w, y + h - radius.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius.br, y + h);
  ctx.lineTo(x + radius.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
}

function dividerLine(ctx, x, y, w, colour) {
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.1, colour + '80');
  grad.addColorStop(0.9, colour + '80');
  grad.addColorStop(1, 'transparent');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let cy   = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy  += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

module.exports = {
  renderFrame,
  renderFrameSequence,
  renderPartyFrame,
  buildProfileCard,
  buildGearData,
  getSkinAssetPath,
  getWeaponAssetPath,
  getArmorAssetPath,
};

// ── Re-export GearLayerSystem helpers so callers only need to import RigRenderer ──
const GearLayerSystem = require('./GearLayerSystem');
module.exports.buildGearData         = GearLayerSystem.buildGearLayerData;
module.exports.buildGearLayerData    = GearLayerSystem.buildGearLayerData;
module.exports.getWeaponAssetPath    = GearLayerSystem.getWeaponAssetPath;
module.exports.getArmorAssetPath     = GearLayerSystem.getArmorAssetPath;
module.exports.formatGearLayerSummary = GearLayerSystem.formatGearLayerSummary;
