/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║             ✦ 𝐀𝐬𝐭𝐫𝐚™ — SummonResultCard.js                     ║
 * ║  Builds a cinematic gacha reveal card for each summon pull.  ║
 * ║                                                              ║
 * ║  Single pull card layout:                                    ║
 * ║    • Full rarity-themed background with glow effects         ║
 * ║    • Skin on idle frame (frame 0) centred and large          ║
 * ║    • Rarity badge + skin name at bottom                      ║
 * ║    • NEW / DUPE indicator top-right                          ║
 * ║    • Pity counter bottom-right                               ║
 * ║    • Particle/sparkle overlay per rarity                     ║
 * ║                                                              ║
 * ║  Multi pull (10x) card layout:                               ║
 * ║    • 2-row grid of 5x5 mini skin cards                       ║
 * ║    • Rarity colour-coded borders per card                    ║
 * ║    • Best pull highlighted with glow                         ║
 * ║    • Summary row at bottom                                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

const { createCanvas, loadImage } = require('canvas');
const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');

const { renderFrame }   = require('./RigRenderer');
const { getSkinAssetPath } = require('./RigRenderer');
const { RARITY_EMOJI, RARITY_LABEL } = require('./SkinCatalog');
const { FRAME_WIDTH, FRAME_HEIGHT }  = require('./RigSpec');

// ── Card dimensions ───────────────────────────────────────────────────────────
const SINGLE_W = 600;
const SINGLE_H = 800;

const MULTI_CARD_W = 160;
const MULTI_CARD_H = 240;
const MULTI_COLS   = 5;
const MULTI_ROWS   = 2;
const MULTI_PAD    = 10;
const MULTI_W      = MULTI_COLS * (MULTI_CARD_W + MULTI_PAD) + MULTI_PAD;
const MULTI_H      = MULTI_ROWS * (MULTI_CARD_H + MULTI_PAD) + MULTI_PAD + 90; // +90 for summary row

// ── Rarity theme colours ──────────────────────────────────────────────────────
const RARITY_THEME = {
  common: {
    bg1: '#0d1117', bg2: '#161b22',
    glow: 'rgba(154,160,168,0.3)',
    accent: '#9aa0a8', accent2: '#c8cdd4',
    badge: '#4a5568',
    particles: 8,
    particleColour: '#9aa0a8',
  },
  uncommon: {
    bg1: '#0a1a0f', bg2: '#0d2010',
    glow: 'rgba(45,201,98,0.35)',
    accent: '#2dc962', accent2: '#5de88a',
    badge: '#166534',
    particles: 15,
    particleColour: '#2dc962',
  },
  rare: {
    bg1: '#080e1f', bg2: '#0d1535',
    glow: 'rgba(74,144,226,0.40)',
    accent: '#4a90e2', accent2: '#7fb3f0',
    badge: '#1e40af',
    particles: 20,
    particleColour: '#4a90e2',
  },
  epic: {
    bg1: '#110a1f', bg2: '#1a0d35',
    glow: 'rgba(168,85,247,0.45)',
    accent: '#a855f7', accent2: '#c984ff',
    badge: '#6b21a8',
    particles: 30,
    particleColour: '#a855f7',
  },
  legendary: {
    bg1: '#1a1000', bg2: '#2a1a00',
    glow: 'rgba(245,158,11,0.50)',
    accent: '#f59e0b', accent2: '#fcd34d',
    badge: '#92400e',
    particles: 40,
    particleColour: '#f59e0b',
  },
  mythic: {
    bg1: '#1a000a', bg2: '#2a0010',
    glow: 'rgba(225,29,72,0.55)',
    accent: '#e11d48', accent2: '#ff6b8a',
    badge: '#9f1239',
    particles: 60,
    particleColour: '#ff4070',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE PULL CARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a single pull reveal card.
 *
 * @param {Object}  pullResult  — result from SkinManager.singlePull()
 * @param {Object}  player      — player DB object
 * @returns {Buffer}            — PNG buffer
 */
async function buildSinglePullCard(pullResult, player) {
  const { skin, isDupe, pityActivated, pullsUntilPity } = pullResult;
  const theme    = RARITY_THEME[skin.rarity] || RARITY_THEME.common;
  const canvas   = createCanvas(SINGLE_W, SINGLE_H);
  const ctx      = canvas.getContext('2d');

  // ── Background ──────────────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, 0, SINGLE_H);
  bgGrad.addColorStop(0, theme.bg1);
  bgGrad.addColorStop(1, theme.bg2);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, SINGLE_W, SINGLE_H);

  // Central radial glow
  const centreGlow = ctx.createRadialGradient(
    SINGLE_W / 2, SINGLE_H * 0.45, 40,
    SINGLE_W / 2, SINGLE_H * 0.45, 320
  );
  centreGlow.addColorStop(0, theme.glow);
  centreGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = centreGlow;
  ctx.fillRect(0, 0, SINGLE_W, SINGLE_H);

  // ── Rarity border frame ────────────────────────────────────────────────────
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth   = 2;
  ctx.globalAlpha = 0.5;
  roundRect(ctx, 8, 8, SINGLE_W - 16, SINGLE_H - 16, 14);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Top accent line
  const topLine = ctx.createLinearGradient(0, 0, SINGLE_W, 0);
  topLine.addColorStop(0, 'transparent');
  topLine.addColorStop(0.3, theme.accent);
  topLine.addColorStop(0.7, theme.accent2);
  topLine.addColorStop(1, 'transparent');
  ctx.fillStyle = topLine;
  ctx.fillRect(8, 8, SINGLE_W - 16, 2);

  // ── Particles ─────────────────────────────────────────────────────────────
  drawParticles(ctx, theme, SINGLE_W, SINGLE_H, skin.rarity);

  // ── Skin image (idle frame 0) ──────────────────────────────────────────────
  const SKIN_DISPLAY_W = 280;
  const SKIN_DISPLAY_H = 560;
  const SKIN_X = (SINGLE_W - SKIN_DISPLAY_W) / 2;
  const SKIN_Y = 60;

  try {
    const skinData = { ...skin, assetPath: getSkinAssetPath(skin.id, skin.rarity) };
    const frameBuf = await renderFrame('idle', 0, skinData, {});
    const skinImg  = await loadImage(frameBuf);
    ctx.drawImage(skinImg, SKIN_X, SKIN_Y, SKIN_DISPLAY_W, SKIN_DISPLAY_H);
  } catch (e) {
    // Placeholder
    const skinGrad = ctx.createLinearGradient(SKIN_X, SKIN_Y, SKIN_X, SKIN_Y + SKIN_DISPLAY_H);
    skinGrad.addColorStop(0, theme.glow);
    skinGrad.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = skinGrad;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(SKIN_X, SKIN_Y, SKIN_DISPLAY_W, SKIN_DISPLAY_H);
    ctx.globalAlpha = 1;
    // Placeholder text
    ctx.fillStyle   = theme.accent2;
    ctx.font        = 'bold 16px sans-serif';
    ctx.textAlign   = 'center';
    ctx.fillText('[ skin image ]', SINGLE_W / 2, SKIN_Y + SKIN_DISPLAY_H / 2);
  }

  // ── Rarity badge ───────────────────────────────────────────────────────────
  const BADGE_Y  = SKIN_Y + SKIN_DISPLAY_H + 18;
  const BADGE_W  = 280;
  const BADGE_H  = 44;
  const BADGE_X  = (SINGLE_W - BADGE_W) / 2;

  ctx.fillStyle   = theme.badge;
  ctx.globalAlpha = 0.95;
  roundRect(ctx, BADGE_X, BADGE_Y, BADGE_W, BADGE_H, 8);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = theme.accent;
  ctx.lineWidth   = 1.5;
  roundRect(ctx, BADGE_X, BADGE_Y, BADGE_W, BADGE_H, 8);
  ctx.stroke();

  ctx.fillStyle   = theme.accent2;
  ctx.font        = `bold 20px sans-serif`;
  ctx.textAlign   = 'center';
  ctx.fillText(
    `${RARITY_EMOJI[skin.rarity]} ${RARITY_LABEL[skin.rarity].toUpperCase()}`,
    SINGLE_W / 2,
    BADGE_Y + 28
  );

  // ── Skin name ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#ddeeff';
  ctx.font      = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(skin.name, SINGLE_W / 2, BADGE_Y + BADGE_H + 34);

  // ── Theme tag ─────────────────────────────────────────────────────────────
  ctx.fillStyle = theme.accent;
  ctx.font      = '14px sans-serif';
  ctx.globalAlpha = 0.7;
  ctx.fillText(`🎌 ${skin.theme}  ·  ${skin.archetype}`, SINGLE_W / 2, BADGE_Y + BADGE_H + 58);
  ctx.globalAlpha = 1;

  // ── NEW / DUPE indicator (top right) ──────────────────────────────────────
  const dupeLabel  = isDupe ? '♻️ DUPE' : '✨ NEW';
  const dupeColour = isDupe ? '#f59e0b' : theme.accent;
  ctx.fillStyle    = 'rgba(0,0,0,0.75)';
  roundRect(ctx, SINGLE_W - 110, 20, 90, 32, 6);
  ctx.fill();
  ctx.fillStyle = dupeColour;
  ctx.font      = 'bold 15px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(dupeLabel, SINGLE_W - 20, 41);

  // ── Pity counter (bottom right) ───────────────────────────────────────────
  ctx.fillStyle   = 'rgba(0,0,0,0.6)';
  ctx.font        = '12px sans-serif';
  ctx.textAlign   = 'right';
  ctx.globalAlpha = 0.7;
  ctx.fillText(`🎯 Pity: ${pullsUntilPity} pulls`, SINGLE_W - 16, SINGLE_H - 14);
  ctx.globalAlpha = 1;

  // ── Pity activated banner ─────────────────────────────────────────────────
  if (pityActivated) {
    ctx.fillStyle = 'rgba(245,158,11,0.85)';
    roundRect(ctx, 20, 20, 180, 34, 6);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font      = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🎯 PITY ACTIVATED!', 28, 41);
  }

  // ── Lore text at bottom ───────────────────────────────────────────────────
  ctx.fillStyle   = '#7a9bbf';
  ctx.font        = 'italic 12px sans-serif';
  ctx.textAlign   = 'center';
  ctx.globalAlpha = 0.65;
  wrapText(ctx, `"${skin.lore}"`, SINGLE_W / 2, SINGLE_H - 32, SINGLE_W - 40, 16);
  ctx.globalAlpha = 1;

  return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI PULL CARD (10x)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a 10-pull reveal card showing all 10 results in a grid.
 *
 * @param {Object}  multiResult — result from SkinManager.multiPull()
 * @param {Object}  player      — player DB object
 * @returns {Buffer}            — PNG buffer
 */
async function buildMultiPullCard(multiResult, player) {
  const { results, pullsUntilPity } = multiResult;
  const canvas = createCanvas(MULTI_W, MULTI_H);
  const ctx    = canvas.getContext('2d');

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#07090f';
  ctx.fillRect(0, 0, MULTI_W, MULTI_H);

  // Subtle grid glow
  const bgGlow = ctx.createRadialGradient(MULTI_W/2, MULTI_H*0.45, 40, MULTI_W/2, MULTI_H*0.45, MULTI_W*0.7);
  bgGlow.addColorStop(0, 'rgba(100,80,200,0.12)');
  bgGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bgGlow;
  ctx.fillRect(0, 0, MULTI_W, MULTI_H);

  // Top line
  ctx.fillStyle = 'rgba(168,85,247,0.7)';
  ctx.fillRect(0, 0, MULTI_W, 2);

  // ── Title ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#ddeeff';
  ctx.font      = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🎰  10x SUMMON', MULTI_PAD + 4, 22);

  ctx.fillStyle   = '#4a6a8a';
  ctx.font        = '12px sans-serif';
  ctx.textAlign   = 'right';
  ctx.globalAlpha = 0.7;
  ctx.fillText(`🎯 Pity: ${pullsUntilPity}`, MULTI_W - MULTI_PAD, 22);
  ctx.globalAlpha = 1;

  // ── 10 skin mini-cards in 2 rows of 5 ────────────────────────────────────
  const ORDER = ['mythic','legendary','epic','rare','uncommon','common'];

  const best = results.reduce((a, b) =>
    ORDER.indexOf(a.skin.rarity) < ORDER.indexOf(b.skin.rarity) ? a : b
  );

  for (let i = 0; i < Math.min(results.length, 10); i++) {
    const r     = results[i];
    const theme = RARITY_THEME[r.skin.rarity] || RARITY_THEME.common;
    const col   = i % MULTI_COLS;
    const row   = Math.floor(i / MULTI_COLS);
    const cx    = MULTI_PAD + col * (MULTI_CARD_W + MULTI_PAD);
    const cy    = 30 + row * (MULTI_CARD_H + MULTI_PAD);
    const isBest = r.skin.id === best.skin.id && r.skin.rarity !== 'common';

    // Card background
    const cardBg = ctx.createLinearGradient(cx, cy, cx, cy + MULTI_CARD_H);
    cardBg.addColorStop(0, theme.bg1);
    cardBg.addColorStop(1, theme.bg2);
    ctx.fillStyle = cardBg;
    roundRect(ctx, cx, cy, MULTI_CARD_W, MULTI_CARD_H, 8);
    ctx.fill();

    // Border glow if best pull
    if (isBest) {
      ctx.shadowBlur   = 18;
      ctx.shadowColor  = theme.accent;
    }
    ctx.strokeStyle = isBest ? theme.accent2 : theme.accent;
    ctx.lineWidth   = isBest ? 2.5 : 1.5;
    roundRect(ctx, cx, cy, MULTI_CARD_W, MULTI_CARD_H, 8);
    ctx.stroke();
    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';

    // Skin image
    try {
      const skinData  = { ...r.skin, assetPath: getSkinAssetPath(r.skin.id, r.skin.rarity) };
      const frameBuf  = await renderFrame('idle', 0, skinData, {});
      const skinImg   = await loadImage(frameBuf);
      const imgH      = MULTI_CARD_H - 46;
      const imgW      = Math.floor(imgH * (FRAME_WIDTH / FRAME_HEIGHT));
      const imgX      = cx + (MULTI_CARD_W - imgW) / 2;
      ctx.drawImage(skinImg, imgX, cy + 4, imgW, imgH);
    } catch (e) {
      // Colour placeholder
      ctx.fillStyle   = theme.glow;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(cx + 4, cy + 4, MULTI_CARD_W - 8, MULTI_CARD_H - 50);
      ctx.globalAlpha = 1;
    }

    // Rarity badge at bottom of card
    ctx.fillStyle   = theme.badge;
    ctx.globalAlpha = 0.9;
    roundRect(ctx, cx + 2, cy + MULTI_CARD_H - 38, MULTI_CARD_W - 4, 36, { bl:8, br:8 });
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = theme.accent2;
    ctx.font      = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${RARITY_EMOJI[r.skin.rarity]} ${r.skin.rarity.toUpperCase()}`,
      cx + MULTI_CARD_W / 2,
      cy + MULTI_CARD_H - 22
    );

    // Skin name
    ctx.fillStyle = '#c8d8ee';
    ctx.font      = 'bold 9px sans-serif';
    ctx.fillText(truncate(r.skin.name, 16), cx + MULTI_CARD_W / 2, cy + MULTI_CARD_H - 8);

    // Dupe marker
    if (r.isDupe) {
      ctx.fillStyle   = 'rgba(245,158,11,0.85)';
      ctx.font        = 'bold 9px sans-serif';
      ctx.textAlign   = 'right';
      ctx.fillText('♻️', cx + MULTI_CARD_W - 6, cy + 14);
    }
  }

  // ── Summary row ───────────────────────────────────────────────────────────
  const summaryY = 30 + 2 * (MULTI_CARD_H + MULTI_PAD) + 10;

  ctx.fillStyle   = 'rgba(255,255,255,0.04)';
  roundRect(ctx, MULTI_PAD, summaryY, MULTI_W - 2 * MULTI_PAD, 60, 8);
  ctx.fill();

  const newSkins  = results.filter(r => !r.isDupe).length;
  const dupes     = results.filter(r => r.isDupe).length;
  const dupeTotal = results.filter(r => r.isDupe).reduce((s, r) => s + (r.dupeReward || 0), 0);

  ctx.fillStyle = '#ddeeff';
  ctx.font      = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`✨ ${newSkins} new skin${newSkins !== 1 ? 's' : ''}`, MULTI_PAD + 12, summaryY + 22);

  if (dupes > 0) {
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`♻️ ${dupes} dupe${dupes !== 1 ? 's' : ''} → +${dupeTotal} 🔮`, MULTI_PAD + 12, summaryY + 42);
  }

  ctx.fillStyle = RARITY_THEME[best.skin.rarity]?.accent2 || '#ddeeff';
  ctx.textAlign = 'right';
  ctx.fillText(
    `🏆 Best: ${best.skin.name} ${RARITY_EMOJI[best.skin.rarity]}`,
    MULTI_W - MULTI_PAD - 8,
    summaryY + 32
  );

  return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// BANNER CARD — shown on /summon with no args
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a visual banner card showing the gacha rates.
 *
 * @param {Object} player  — player DB object
 * @returns {Buffer}       — PNG buffer
 */
async function buildBannerCard(player) {
  const W = 500, H = 380;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#04080d');
  bg.addColorStop(1, '#080f18');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Top glow
  const tg = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, W*0.7);
  tg.addColorStop(0, 'rgba(168,85,247,0.18)');
  tg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = tg;
  ctx.fillRect(0, 0, W, H);

  // Border
  ctx.strokeStyle = 'rgba(168,85,247,0.4)';
  ctx.lineWidth   = 1.5;
  roundRect(ctx, 8, 8, W-16, H-16, 12);
  ctx.stroke();

  // Top line
  const tl = ctx.createLinearGradient(0,0,W,0);
  tl.addColorStop(0,'transparent');
  tl.addColorStop(0.5,'#a855f7');
  tl.addColorStop(1,'transparent');
  ctx.fillStyle = tl;
  ctx.fillRect(8, 8, W-16, 2);

  // Title
  ctx.fillStyle = '#ddeeff';
  ctx.font      = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎰  SKIN SUMMON BANNER', W/2, 52);

  ctx.fillStyle   = '#4a6a8a';
  ctx.font        = '13px sans-serif';
  ctx.globalAlpha = 0.7;
  ctx.fillText('Pull to collect anime character skins', W/2, 74);
  ctx.globalAlpha = 1;

  // Divider
  dividerLine(ctx, 24, 88, W-48, '#a855f7');

  // Rates grid
  const rates = [
    { rarity:'mythic',    pct:'2%',  label:'Mythic' },
    { rarity:'legendary', pct:'8%',  label:'Legendary' },
    { rarity:'epic',      pct:'20%', label:'Epic' },
    { rarity:'rare',      pct:'30%', label:'Rare' },
    { rarity:'uncommon',  pct:'40%', label:'Uncommon' },
  ];

  const RW = (W - 60) / rates.length;
  for (let i = 0; i < rates.length; i++) {
    const r   = rates[i];
    const th  = RARITY_THEME[r.rarity];
    const rx  = 30 + i * RW;
    const ry  = 105;

    ctx.fillStyle   = th.badge;
    ctx.globalAlpha = 0.8;
    roundRect(ctx, rx + 4, ry, RW - 8, 80, 8);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = th.accent;
    ctx.lineWidth   = 1;
    roundRect(ctx, rx + 4, ry, RW - 8, 80, 8);
    ctx.stroke();

    ctx.fillStyle = th.accent2;
    ctx.font      = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(RARITY_EMOJI[r.rarity], rx + RW/2, ry + 30);

    ctx.fillStyle = '#ddeeff';
    ctx.font      = 'bold 16px sans-serif';
    ctx.fillText(r.pct, rx + RW/2, ry + 54);

    ctx.fillStyle   = '#7a9bbf';
    ctx.font        = '10px sans-serif';
    ctx.globalAlpha = 0.7;
    ctx.fillText(r.label, rx + RW/2, ry + 72);
    ctx.globalAlpha = 1;
  }

  // Costs
  dividerLine(ctx, 24, 202, W-48, '#1e2f45');

  const manaStones = player.manaStones || 0;
  const pulls    = player.skins?.pulls || 0;
  const pity     = Math.max(0, 90 - pulls);

  ctx.fillStyle = '#ddeeff';
  ctx.font      = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🔮 Single pull   120 Mana Stones', 36, 230);
  ctx.fillText('🔮 10x pull     1080 Mana Stones  _(10% off)_', 36, 255);

  dividerLine(ctx, 24, 270, W-48, '#1e2f45');

  ctx.fillStyle = '#7a9bbf';
  ctx.font      = '13px sans-serif';
  ctx.fillText(`Your Mana Stones: `, 36, 296);
  ctx.fillStyle = '#00e5a0';
  ctx.font      = 'bold 13px sans-serif';
  ctx.fillText(`${manaStones.toLocaleString()} 🔮`, 160, 296);

  ctx.fillStyle = '#7a9bbf';
  ctx.font      = '13px sans-serif';
  ctx.fillText(`Pity counter: `, 36, 318);
  ctx.fillStyle = pity <= 10 ? '#f59e0b' : '#ddeeff';
  ctx.font      = 'bold 13px sans-serif';
  ctx.fillText(`${pity} pulls until guaranteed Legendary+`, 148, 318);

  // Commands
  dividerLine(ctx, 24, 330, W-48, '#1e2f45');

  ctx.fillStyle   = '#4a6a8a';
  ctx.font        = '12px sans-serif';
  ctx.textAlign   = 'center';
  ctx.globalAlpha = 0.75;
  ctx.fillText('/summon pull  ·  /summon 10  ·  /summon pity', W/2, 355);
  ctx.globalAlpha = 1;

  return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS UTILS
// ─────────────────────────────────────────────────────────────────────────────

function drawParticles(ctx, theme, W, H, rarity) {
  const count   = theme.particles;
  const colour  = theme.particleColour;
  // Use a deterministic seed based on rarity so particles are consistent
  const seed    = rarity.charCodeAt(0) * 137;
  function seededRand(n) {
    return ((Math.sin(n * seed) * 43758.5453) % 1 + 1) % 1;
  }
  for (let i = 0; i < count; i++) {
    const x    = seededRand(i * 3) * W;
    const y    = seededRand(i * 3 + 1) * H;
    const size = seededRand(i * 3 + 2) * 3 + 1;
    const alpha = seededRand(i * 5) * 0.6 + 0.1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = colour;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r) {
  const rad = typeof r === 'number'
    ? { tl:r, tr:r, br:r, bl:r }
    : { tl:r.tl||0, tr:r.tr||0, br:r.br||0, bl:r.bl||0 };
  ctx.beginPath();
  ctx.moveTo(x + rad.tl, y);
  ctx.lineTo(x + w - rad.tr, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+rad.tr);
  ctx.lineTo(x+w, y+h-rad.br);
  ctx.quadraticCurveTo(x+w, y+h, x+w-rad.br, y+h);
  ctx.lineTo(x+rad.bl, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-rad.bl);
  ctx.lineTo(x, y+rad.tl);
  ctx.quadraticCurveTo(x, y, x+rad.tl, y);
  ctx.closePath();
}

function dividerLine(ctx, x, y, w, colour) {
  const grad = ctx.createLinearGradient(x, y, x+w, y);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.1, colour+'60');
  grad.addColorStop(0.9, colour+'60');
  grad.addColorStop(1, 'transparent');
  ctx.strokeStyle = grad;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x+w, y);
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

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

module.exports = {
  buildSinglePullCard,
  buildMultiPullCard,
  buildBannerCard,
};
