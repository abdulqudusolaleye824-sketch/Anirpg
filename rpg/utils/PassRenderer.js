// ═══════════════════════════════════════════════════════════════
// Astra — Pass Canvas Image Renderer
//
// Renders visual cards/images for /pass (Astra Pass) and /bp (Battle Pass).
// /pass: Deep Blue & Red theme, 2 stacks per level (Top = Premium, Bottom = Free).
// /bp: Gold & Black luxury theme.
//
// Dynamic: Reads reward map at runtime so seasonal reward shuffles reflect automatically.
// ═══════════════════════════════════════════════════════════════

'use strict';

let createCanvas = null;
try {
  ({ createCanvas } = require('@napi-rs/canvas'));
} catch (e) {
  try {
    ({ createCanvas } = require('canvas'));
  } catch (err) {}
}

const RARITY_COLORS = {
  common:    '#A0A0A0',
  uncommon:  '#2ECC71',
  rare:      '#3498DB',
  epic:      '#9B59B6',
  legendary: '#F1C40F',
  mythic:    '#E74C3C',
};

/**
 * Render Astra Pass Image (Deep Blue & Red theme)
 */
async function renderAstraPassImage(player, passData, page = 1) {
  if (!createCanvas) return null;

  const width = 900;
  const pageTiers = 10;
  const startTier = (page - 1) * pageTiers + 1;
  const endTier = Math.min(50, startTier + pageTiers - 1);

  const headerHeight = 220;
  const cardHeight = 110;
  const spacing = 15;
  const padding = 25;
  const footerHeight = 60;

  const totalHeight = headerHeight + (endTier - startTier + 1) * (cardHeight + spacing) + footerHeight + padding;

  const canvas = createCanvas(width, totalHeight);
  const ctx = canvas.getContext('2d');

  // 1. Background Gradient (Deep Blue & Red)
  const bgGrad = ctx.createLinearGradient(0, 0, width, totalHeight);
  bgGrad.addColorStop(0, '#0B0E1B');
  bgGrad.addColorStop(0.5, '#160814');
  bgGrad.addColorStop(1, '#090B14');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, totalHeight);

  // Background aura glow
  const aura = ctx.createRadialGradient(width / 2, 100, 10, width / 2, 100, 450);
  aura.addColorStop(0, 'rgba(180, 20, 60, 0.25)');
  aura.addColorStop(0.5, 'rgba(20, 80, 180, 0.15)');
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, width, totalHeight);

  // Decorative border
  ctx.strokeStyle = '#B4143C';
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, width - 16, totalHeight - 16);

  // 2. Header
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🏛️ ASTRA PASS', 35, 55);

  ctx.fillStyle = '#3897FF';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`SEASON 1 — PAGE ${page} / 5 (TIERS ${startTier}–${endTier})`, 35, 85);

  // Player info box
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.roundRect ? ctx.roundRect(35, 105, width - 70, 95, 12) : ctx.fillRect(35, 105, width - 70, 95);
  ctx.fill();
  ctx.strokeStyle = 'rgba(180, 20, 60, 0.5)';
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`👤 Hunter: ${player.name || 'Player'}`, 55, 138);

  const level = passData.level || 1;
  ctx.fillStyle = '#FF4500';
  ctx.fillText(`⭐ Pass Level: Tier ${level} / 50`, 55, 170);

  // Premium badge
  const hasPremium = passData.hasPremium;
  ctx.fillStyle = hasPremium ? '#FFD700' : '#888888';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(hasPremium ? '✨ PREMIUM UNLOCKED' : '🆓 FREE TRACK', width - 55, 138);

  // XP Bar
  const xp = passData.xp || 0;
  const xpMax = 1000;
  const barW = 280;
  const barH = 14;
  const barX = width - 335;
  const barY = 158;

  ctx.fillStyle = '#1A1A2A';
  ctx.fillRect(barX, barY, barW, barH);

  const fillW = Math.min(barW, Math.floor((xp / xpMax) * barW));
  const xpGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  xpGrad.addColorStop(0, '#3897FF');
  xpGrad.addColorStop(1, '#FF2D55');
  ctx.fillStyle = xpGrad;
  ctx.fillRect(barX, barY, fillW, barH);

  ctx.fillStyle = '#CCCCCC';
  ctx.font = '12px sans-serif';
  ctx.fillText(`${xp} / ${xpMax} XP`, width - 55, 186);

  // 3. Render Tiers (Each level has 2 STACKS: Top = Premium, Bottom = Free)
  let y = headerHeight + 10;
  const passItems = passData.passItems || { free: {}, premium: {} };

  for (let t = startTier; t <= endTier; t++) {
    const isUnlocked = t <= level;
    const isCurrent = t === level;
    const freeClaimed = (passData.claimedFree || []).includes(t);
    const premClaimed = (passData.claimedPremium || []).includes(t);

    const freeItem = passItems.free?.[t];
    const premItem = passItems.premium?.[t];

    // Card background
    ctx.fillStyle = isCurrent
      ? 'rgba(180, 20, 60, 0.25)'
      : isUnlocked
      ? 'rgba(20, 30, 50, 0.6)'
      : 'rgba(12, 14, 22, 0.7)';

    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(35, y, width - 70, cardHeight, 10);
      ctx.fill();
    } else {
      ctx.fillRect(35, y, width - 70, cardHeight);
    }

    // Card border
    ctx.strokeStyle = isCurrent
      ? '#FF2D55'
      : isUnlocked
      ? '#3897FF'
      : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = isCurrent ? 3 : 1;
    ctx.stroke();

    // Tier badge box (Left side)
    ctx.fillStyle = isCurrent ? '#FF2D55' : isUnlocked ? '#1E3A8A' : '#1F2937';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(45, y + 12, 85, cardHeight - 24, 8);
      ctx.fill();
    } else {
      ctx.fillRect(45, y + 12, 85, cardHeight - 24);
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIER`, 87, y + 42);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`${t}`, 87, y + 72);

    ctx.textAlign = 'left';

    // ── TOP STACK: PREMIUM TRACK REWARD ─────────────────────
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`👑 PREMIUM:`, 150, y + 36);

    const premNexus = 3000;
    const premStones = 360;
    let premText = `+${premNexus.toLocaleString()} 💠 | +${premStones} 💎`;
    if (premItem) {
      premText += ` | 🎁 ${premItem.name}`;
    }
    ctx.fillStyle = premItem ? (RARITY_COLORS[premItem.rarity] || '#FFD700') : '#E2E8F0';
    ctx.font = '14px sans-serif';
    ctx.fillText(premText, 250, y + 36);

    // Premium Status Badge
    let premStatus = '🔒 Locked';
    let premStatusColor = '#6B7280';
    if (isUnlocked) {
      if (!hasPremium) {
        premStatus = '🔒 Buy PRO';
        premStatusColor = '#F59E0B';
      } else if (premClaimed) {
        premStatus = '✅ Claimed';
        premStatusColor = '#10B981';
      } else {
        premStatus = '🔓 Unlocked';
        premStatusColor = '#3B82F6';
      }
    }
    ctx.fillStyle = premStatusColor;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(premStatus, width - 55, y + 36);

    // Divider line inside card
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(150, y + 55);
    ctx.lineTo(width - 55, y + 55);
    ctx.stroke();

    // ── BOTTOM STACK: FREE TRACK REWARD ────────────────────
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3897FF';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`🆓 FREE:`, 150, y + 84);

    const freeNexus = 1000;
    const freeStones = 120;
    let freeText = `+${freeNexus.toLocaleString()} 💠 | +${freeStones} 💎`;
    if (freeItem) {
      freeText += ` | 📦 ${freeItem.name}`;
    }
    ctx.fillStyle = freeItem ? (RARITY_COLORS[freeItem.rarity] || '#3897FF') : '#CBD5E1';
    ctx.font = '14px sans-serif';
    ctx.fillText(freeText, 250, y + 84);

    // Free Status Badge
    let freeStatus = '🔒 Locked';
    let freeStatusColor = '#6B7280';
    if (isUnlocked) {
      if (freeClaimed) {
        freeStatus = '✅ Claimed';
        freeStatusColor = '#10B981';
      } else {
        freeStatus = '🔓 Unlocked';
        freeStatusColor = '#3B82F6';
      }
    }
    ctx.fillStyle = freeStatusColor;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(freeStatus, width - 55, y + 84);

    y += cardHeight + spacing;
  }

  // Footer info
  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('📖 Use /pass claim to claim rewards | Use /pass [page] to switch pages (1–5)', width / 2, totalHeight - 22);

  return canvas.toBuffer('image/png');
}

/**
 * Render Battle Pass Image (Gold & Black luxury theme)
 */
async function renderBattlePassImage(player, bpData, page = 1) {
  if (!createCanvas) return null;

  const width = 900;
  const pageTiers = 10;
  const startTier = (page - 1) * pageTiers + 1;
  const endTier = Math.min(40, startTier + pageTiers - 1);

  const headerHeight = 220;
  const cardHeight = 90;
  const spacing = 14;
  const padding = 25;
  const footerHeight = 60;

  const totalHeight = headerHeight + (endTier - startTier + 1) * (cardHeight + spacing) + footerHeight + padding;

  const canvas = createCanvas(width, totalHeight);
  const ctx = canvas.getContext('2d');

  // 1. Background Gradient (Gold & Black)
  const bgGrad = ctx.createLinearGradient(0, 0, width, totalHeight);
  bgGrad.addColorStop(0, '#0D0D14');
  bgGrad.addColorStop(0.5, '#18150C');
  bgGrad.addColorStop(1, '#0A0A0F');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, totalHeight);

  // Gold radial aura
  const aura = ctx.createRadialGradient(width / 2, 100, 10, width / 2, 100, 450);
  aura.addColorStop(0, 'rgba(212, 175, 55, 0.20)');
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, width, totalHeight);

  // Metallic Gold Border
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, width - 16, totalHeight - 16);

  // 2. Header
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🎖️ BATTLE PASS', 35, 55);

  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`SEASONAL PASS — PAGE ${page} / 4 (TIERS ${startTier}–${endTier})`, 35, 85);

  // Player info box
  ctx.fillStyle = 'rgba(212, 175, 55, 0.05)';
  if (ctx.roundRect) ctx.roundRect(35, 105, width - 70, 95, 12);
  else ctx.fillRect(35, 105, width - 70, 95);
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`👤 Hunter: ${player.name || 'Player'}`, 55, 138);

  const level = bpData.level || 1;
  ctx.fillStyle = '#FFD700';
  ctx.fillText(`⭐ BP Level: Tier ${level} / 40`, 55, 170);

  // Premium status badge
  const isPremium = bpData.premium;
  ctx.fillStyle = isPremium ? '#FFD700' : '#888888';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(isPremium ? '👑 PREMIUM PASS (2x EXP)' : '🆓 FREE PASS', width - 55, 138);

  // XP Bar
  const xp = bpData.xp || 0;
  const xpMax = 500;
  const barW = 280;
  const barH = 14;
  const barX = width - 335;
  const barY = 158;

  ctx.fillStyle = '#1A1A24';
  ctx.fillRect(barX, barY, barW, barH);

  const fillW = Math.min(barW, Math.floor((xp / xpMax) * barW));
  const xpGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  xpGrad.addColorStop(0, '#D4AF37');
  xpGrad.addColorStop(1, '#FFD700');
  ctx.fillStyle = xpGrad;
  ctx.fillRect(barX, barY, fillW, barH);

  ctx.fillStyle = '#CCCCCC';
  ctx.font = '12px sans-serif';
  ctx.fillText(`${xp} / ${xpMax} XP`, width - 55, 186);

  // 3. Render Tiers
  let y = headerHeight + 10;
  const bpItems = bpData.bpItems || {};
  const lockedTiers = bpData.lockedTiers || [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40];
  const pcTiers = bpData.pcTiers || [8, 16, 24, 32, 40];

  for (let t = startTier; t <= endTier; t++) {
    const isUnlocked = t <= level;
    const isCurrent = t === level;
    const isPremLocked = lockedTiers.includes(t);
    const isClaimed = (bpData.claimed || []).includes(t);
    const item = bpItems[t];
    const hasPC = pcTiers.includes(t);

    const goldAmt = t * 1500;
    const stoneAmt = t * 20;

    // Card background
    ctx.fillStyle = isCurrent
      ? 'rgba(212, 175, 55, 0.22)'
      : isUnlocked
      ? 'rgba(25, 22, 15, 0.7)'
      : 'rgba(12, 12, 18, 0.7)';

    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(35, y, width - 70, cardHeight, 10);
      ctx.fill();
    } else {
      ctx.fillRect(35, y, width - 70, cardHeight);
    }

    ctx.strokeStyle = isCurrent
      ? '#FFD700'
      : isPremLocked
      ? 'rgba(212, 175, 55, 0.3)'
      : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = isCurrent ? 3 : 1;
    ctx.stroke();

    // Tier badge box
    ctx.fillStyle = isCurrent ? '#D4AF37' : isPremLocked ? '#785E10' : '#2A2A38';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(45, y + 10, 80, cardHeight - 20, 8);
      ctx.fill();
    } else {
      ctx.fillRect(45, y + 10, 80, cardHeight - 20);
    }

    ctx.fillStyle = isCurrent ? '#000000' : '#FFFFFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIER`, 85, y + 36);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`${t}`, 85, y + 62);

    ctx.textAlign = 'left';

    // Tier Details
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 15px sans-serif';
    const trackLabel = isPremLocked ? '👑 PREMIUM TRACK' : '🆓 FREE TRACK';
    ctx.fillText(trackLabel, 145, y + 34);

    let rewardText = `+${goldAmt.toLocaleString()} 💠 Nexus | +${stoneAmt} 💎 Stones`;
    if (hasPC) rewardText += ` | 💼 +200 PC Return!`;
    if (item) rewardText += ` | 🎁 ${item.name}`;

    ctx.fillStyle = item ? (RARITY_COLORS[item.rarity] || '#F59E0B') : '#E2E8F0';
    ctx.font = '14px sans-serif';
    ctx.fillText(rewardText, 145, y + 62);

    // Status Badge
    let statusText = '🔒 Locked';
    let statusColor = '#6B7280';
    if (isUnlocked) {
      if (isPremLocked && !isPremium) {
        statusText = '🔒 Buy Premium';
        statusColor = '#F59E0B';
      } else if (isClaimed) {
        statusText = '✅ Claimed';
        statusColor = '#10B981';
      } else {
        statusText = '🔓 Unlocked';
        statusColor = '#3B82F6';
      }
    }

    ctx.fillStyle = statusColor;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(statusText, width - 55, y + 48);

    y += cardHeight + spacing;
  }

  // Footer
  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('📖 Use /bp claim to claim rewards | Use /bp [page] to switch pages (1–4)', width / 2, totalHeight - 22);

  return canvas.toBuffer('image/png');
}

module.exports = {
  renderAstraPassImage,
  renderBattlePassImage,
};
