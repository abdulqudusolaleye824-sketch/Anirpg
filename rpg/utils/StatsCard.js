/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — StatsCard                           ║
 * ║  Canvas-based Solo Leveling style battle stats card  ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

const { createCanvas, registerFont } = require('canvas');
const path = require('path');

// ── Rank colours ──────────────────────────────────────────────────────────────
const RANK_COLORS = {
  E: { primary: '#9e9e9e', glow: 'rgba(158,158,158,0.3)' },
  D: { primary: '#8d6e63', glow: 'rgba(141,110,99,0.3)'  },
  C: { primary: '#42a5f5', glow: 'rgba(66,165,245,0.3)'  },
  B: { primary: '#66bb6a', glow: 'rgba(102,187,106,0.3)' },
  A: { primary: '#ffd600', glow: 'rgba(255,214,0,0.3)'   },
  S: { primary: '#ef5350', glow: 'rgba(239,83,80,0.4)'   },
};

const RANK_EMOJI_TEXT = { E:'E', D:'D', C:'C', B:'B', A:'A', S:'S' };

// ── Quality colour ────────────────────────────────────────────────────────────
function qualityColor(q) {
  if (q >= 95) return '#ff9800'; // Mythic — orange
  if (q >= 85) return '#ffd600'; // Legendary — gold
  if (q >= 70) return '#ab47bc'; // Epic — purple
  if (q >= 50) return '#42a5f5'; // Rare — blue
  if (q >= 30) return '#66bb6a'; // Uncommon — green
  return '#9e9e9e';               // Common — grey
}

// ── Draw a glowing line ───────────────────────────────────────────────────────
function glowLine(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 8;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

// ── Draw stat bar ─────────────────────────────────────────────────────────────
function statBar(ctx, x, y, value, max, color, width = 160, height = 6) {
  const pct = Math.min(1, (value || 0) / (max || 1));
  // Background
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 3);
  ctx.fill();
  // Fill
  if (pct > 0) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(6, width * pct), height, 3);
    ctx.fill();
    ctx.restore();
  }
}

// ── Main generator ────────────────────────────────────────────────────────────
async function generateStatsCard(player, db) {
  const W = 900, H = 480;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  const rank     = player.awakenRank || 'E';
  const rc       = RANK_COLORS[rank] || RANK_COLORS.E;
  const stats    = player.stats || {};
  const history  = player.stats_history || {};
  const alloc    = player.statAllocations || {};

  // ── Background ──────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,   '#050a14');
  bg.addColorStop(0.5, '#080f1e');
  bg.addColorStop(1,   '#040810');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Grid lines — subtle blueprint effect
  ctx.strokeStyle = 'rgba(30,60,120,0.2)';
  ctx.lineWidth   = 0.5;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Rank glow corners
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 300);
  grad.addColorStop(0, rc.glow);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const grad2 = ctx.createRadialGradient(W, H, 0, W, H, 300);
  grad2.addColorStop(0, rc.glow);
  grad2.addColorStop(1, 'transparent');
  ctx.fillStyle = grad2;
  ctx.fillRect(0, 0, W, H);

  // Border
  ctx.strokeStyle = rc.primary;
  ctx.lineWidth   = 1.5;
  ctx.shadowColor = rc.primary;
  ctx.shadowBlur  = 12;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.shadowBlur  = 0;

  // Inner border
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(14, 14, W - 28, H - 28);

  // ── Header ──────────────────────────────────────────────────────────────────
  // Rank badge
  ctx.save();
  ctx.fillStyle   = rc.primary;
  ctx.shadowColor = rc.primary;
  ctx.shadowBlur  = 20;
  ctx.font        = 'bold 42px monospace';
  ctx.fillText(`[${rank}]`, 28, 68);
  ctx.restore();

  // Name
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 32px monospace';
  ctx.fillText(player.name || 'Unknown', 110, 65);
  ctx.restore();

  // Title if equipped
  if (player.equippedTitle) {
    ctx.save();
    ctx.fillStyle = rc.primary;
    ctx.font      = 'italic 14px monospace';
    ctx.fillText(`"${player.equippedTitle}"`, 112, 84);
    ctx.restore();
  }

  // Level + Power
  let power = 0;
  try {
    const { calculatePowerRating } = require('../utils/SoloLevelingCore');
    power = calculatePowerRating(stats, Object.values(player.equipped || {}).filter(Boolean), player.pet) || 0;
  } catch(e) { console.warn('[SILENT] StatsCard: power rating failed:', e.message); }

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font      = '13px monospace';
  ctx.fillText(`Lv.${player.level || 1}`, W - 160, 50);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = rc.primary;
  ctx.font      = 'bold 13px monospace';
  ctx.fillText(`PWR: ${power.toLocaleString()}`, W - 160, 70);
  ctx.restore();

  // Class + quality
  const cls     = player.class || 'Unawakened';
  const quality = player.classQuality || 0;
  const qColor  = qualityColor(quality);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font      = '13px monospace';
  ctx.fillText(`${cls}`, W - 160, 90);
  ctx.restore();
  if (quality > 0) {
    ctx.save();
    ctx.fillStyle = qColor;
    ctx.font      = 'bold 12px monospace';
    ctx.fillText(`${quality}% Quality`, W - 160, 106);
    ctx.restore();
  }

  // Divider
  glowLine(ctx, 20, 115, W - 20, 115, rc.primary, 1);

  // ── Left column — BATTLE STATS ───────────────────────────────────────────────
  const LX = 30;
  let  LY  = 140;
  const ROW = 36;

  ctx.save();
  ctx.fillStyle = rc.primary;
  ctx.font      = 'bold 11px monospace';
  ctx.fillText('◈ BATTLE STATS', LX, LY);
  ctx.restore();
  LY += 18;

  const maxHp  = stats.maxHp  || 100;
  const maxEn  = stats.maxEnergy || 100;

  const statRows = [
    { label: 'HP',        value: `${(stats.hp||0).toLocaleString()} / ${maxHp.toLocaleString()}`,   bar: stats.hp,  barMax: maxHp,  color: '#ef5350' },
    { label: 'ATK',       value: (stats.atk||0).toLocaleString(),   bar: stats.atk,  barMax: 2000, color: '#ff7043' },
    { label: 'DEF',       value: (stats.def||0).toLocaleString(),   bar: stats.def,  barMax: 1500, color: '#42a5f5' },
    { label: 'SPEED',     value: (stats.speed||0).toLocaleString(), bar: stats.speed,barMax: 500,  color: '#66bb6a' },
    { label: 'MAGIC PWR', value: (stats.magicPower||0).toLocaleString(), bar: stats.magicPower, barMax: 2000, color: '#ab47bc' },
    { label: 'ENERGY',    value: `${(stats.energy||0).toLocaleString()} / ${maxEn.toLocaleString()}`, bar: stats.energy, barMax: maxEn, color: '#ffd600' },
    { label: 'CRIT %',    value: `${(stats.critChance||10).toFixed(1)}%`, bar: stats.critChance||10, barMax: 100, color: '#ff9800' },
    { label: 'LIFESTEAL', value: `${((alloc.lifesteal||0)*0.5).toFixed(1)}%`, bar: (alloc.lifesteal||0)*0.5, barMax: 50, color: '#e91e63' },
  ];

  for (const row of statRows) {
    // Label
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font      = '11px monospace';
    ctx.fillText(row.label, LX, LY);
    ctx.restore();
    // Value
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 11px monospace';
    ctx.fillText(row.value, LX + 90, LY);
    ctx.restore();
    // Bar
    statBar(ctx, LX, LY + 2, row.bar || 0, row.barMax, row.color, 200);
    LY += ROW;
  }

  // ── Vertical divider ────────────────────────────────────────────────────────
  const MID = 460;
  glowLine(ctx, MID, 120, MID, H - 20, rc.primary + '60', 1);

  // ── Right column — COMBAT RECORD + SKILLS ────────────────────────────────────
  const RX = MID + 25;
  let  RY  = 140;

  // Combat record
  ctx.save();
  ctx.fillStyle = rc.primary;
  ctx.font      = 'bold 11px monospace';
  ctx.fillText('◈ COMBAT RECORD', RX, RY);
  ctx.restore();
  RY += 22;

  const pvpW    = history.pvpWins   || 0;
  const pvpL    = history.pvpLosses || 0;
  const gates   = history.gatesCleared || 0;
  const deaths  = player.deathCount || 0;
  const monsters= history.monstersKilled || 0;
  const bosses  = history.bossesDefeated || 0;
  const wr      = (pvpW + pvpL) > 0 ? `${Math.round(pvpW/(pvpW+pvpL)*100)}%` : 'N/A';

  const recordRows = [
    { label: 'PvP',          value: `${pvpW}W / ${pvpL}L  (${wr})` },
    { label: 'Gates Cleared',value: gates.toLocaleString()           },
    { label: 'Bosses Slain', value: bosses.toLocaleString()          },
    { label: 'Monsters',     value: monsters.toLocaleString()        },
    { label: 'Deaths',       value: deaths.toLocaleString()          },
  ];

  for (const r of recordRows) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font      = '11px monospace';
    ctx.fillText(r.label, RX, RY);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 11px monospace';
    ctx.fillText(r.value, RX + 130, RY);
    ctx.restore();
    RY += 26;
  }

  RY += 10;
  glowLine(ctx, RX, RY, W - 20, RY, rc.primary + '40', 0.5);
  RY += 16;

  // Skills
  ctx.save();
  ctx.fillStyle = rc.primary;
  ctx.font      = 'bold 11px monospace';
  ctx.fillText('◈ ACTIVE SKILLS', RX, RY);
  ctx.restore();
  RY += 20;

  // Class skills
  const classSkills = player.classSkills || [];
  for (const skill of classSkills.slice(0, 3)) {
    ctx.save();
    ctx.fillStyle = '#ffd600';
    ctx.font      = 'bold 11px monospace';
    ctx.fillText(`• ${skill.name}`, RX, RY);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font      = '10px monospace';
    // Truncate desc
    const desc = skill.desc || '';
    ctx.fillText(desc.length > 38 ? desc.slice(0, 38) + '…' : desc, RX + 12, RY + 13);
    ctx.restore();
    RY += 30;
  }

  // Equipped attack patterns
  const equipped = player.attackPatterns?.equipped || [];
  if (equipped.length > 0) {
    RY += 4;
    ctx.save();
    ctx.fillStyle = rc.primary;
    ctx.font      = 'bold 11px monospace';
    ctx.fillText('◈ ATTACK PATTERNS', RX, RY);
    ctx.restore();
    RY += 18;

    const { generateAttack, RANK_EMOJI } = require('../utils/AttackPatternDB');
    for (const id of equipped.slice(0, 4)) {
      const atk = generateAttack(id);
      if (!atk) continue;
      const re = atk.rank;
      ctx.save();
      ctx.fillStyle = RANK_COLORS[re]?.primary || '#fff';
      ctx.font      = 'bold 10px monospace';
      ctx.fillText(`[${re}] #${id} ${atk.name}`, RX, RY);
      ctx.restore();
      RY += 18;
    }
    if (equipped.length > 4) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font      = '10px monospace';
      ctx.fillText(`+${equipped.length - 4} more equipped`, RX, RY);
      ctx.restore();
    }
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  glowLine(ctx, 20, H - 36, W - 20, H - 36, rc.primary + '60', 0.5);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font      = '10px monospace';
  ctx.fillText(`Astra  ·  Hunter ID: ${player.id?.split('@')[0] || '???'}  ·  System Status: ACTIVE`, 28, H - 18);
  ctx.restore();

  // ── System tag top-right ─────────────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font      = '10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('「SYSTEM」', W - 28, 30);
  ctx.restore();

  return canvas.toBuffer('image/png');
}

module.exports = { generateStatsCard };
