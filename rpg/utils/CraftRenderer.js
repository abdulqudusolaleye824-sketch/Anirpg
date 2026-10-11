// ═══════════════════════════════════════════════════════════════
// Astra — Crafting Preview Image (Push #97)
//
// Draws the recipe card the hunter sees before confirming a craft:
// item + rarity, every material (have / need, green or red), essence stones,
// forge fee, success odds and the step-by-step. Same canvas stack as /pass.
// Returns a PNG buffer or null (caller falls back to text).
// ═══════════════════════════════════════════════════════════════
'use strict';

let createCanvas = null;
try { ({ createCanvas } = require('@napi-rs/canvas')); } catch (e) { try { ({ createCanvas } = require('canvas')); } catch (err) {} }

const RARITY_COLORS = { common: '#A0A0A0', uncommon: '#2ECC71', rare: '#3498DB', epic: '#9B59B6', legendary: '#F1C40F', mythic: '#E74C3C' };
function clean(str) { return String(str || '').replace(/[^\x20-\x7E]/g, '').trim(); }
function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

// Pure layout model (testable without canvas): the rows the image will show.
function rows(pv) {
  const out = [];
  for (const m of pv.mats) out.push({ kind: 'mat', label: m.mat, have: m.have, need: m.need, ok: m.ok });
  out.push({ kind: 'essence', label: pv.essence.name, have: pv.essence.have, need: pv.essence.need, ok: pv.essence.have >= pv.essence.need });
  out.push({ kind: 'nexus', label: 'Nexus forge fee', have: pv.nexus.have, need: pv.nexus.need, ok: pv.nexus.ok });
  return out;
}
function steps(pv) {
  const s = [];
  const missMats = pv.mats.filter(m => !m.ok);
  if (missMats.length) s.push(`Gather ${missMats.map(m => `${m.mat} x${m.need - m.have}`).join(', ')} (gate drops / recycle)`);
  if (pv.essence.have < pv.essence.need) s.push(`Earn ${pv.essence.need - pv.essence.have}x ${pv.essence.name} (${pv.essence.rank}-rank beasts, boss, or mining)`);
  if (!pv.nexus.ok) s.push(`Bank ${fmt(pv.nexus.need - pv.nexus.have)} more Nexus`);
  s.push(`Confirm: /craft ${pv.recipe.output} --${pv.scroll.key} confirm`);
  s.push(`${pv.successPct}% success. A FAIL burns every material, the essence and the fee (scroll survives).`);
  return s;
}

async function renderCraftImage(pv, player) {
  if (!createCanvas || !pv || !pv.ok) return null;
  try {
    const W = 900, pad = 28;
    const R = rows(pv), S = steps(pv);
    const headerH = 150, rowH = 44, stepH = 30, footerH = 70;
    const H = headerH + R.length * rowH + 60 + S.length * stepH + footerH;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const rc = RARITY_COLORS[String(pv.rarity || 'common').toLowerCase()] || '#A0A0A0';

    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1020'); g.addColorStop(1, '#141a33');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    roundRect(ctx, 10, 10, W - 20, H - 20, 18, null, rc);

    // Header
    ctx.fillStyle = rc; ctx.fillRect(pad, pad, 8, 90);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 34px "DejaVu Sans", sans-serif';
    ctx.fillText(clean(pv.recipe.output).slice(0, 34) || 'Recipe', pad + 24, pad + 36);
    ctx.fillStyle = rc; ctx.font = 'bold 18px "DejaVu Sans", sans-serif';
    const type = `${clean(pv.recipe.type || 'equipment').toUpperCase()}${pv.recipe.subtype ? ' / ' + clean(pv.recipe.subtype).toUpperCase() : ''}`;
    ctx.fillText(`${String(pv.rarity || 'Common').toUpperCase()}  ·  ${type}`, pad + 24, pad + 64);
    ctx.fillStyle = '#c8cde0'; ctx.font = '16px "DejaVu Sans", sans-serif';
    const st = Object.entries(pv.recipe.stats || {}).filter(([, v]) => v).map(([k, v]) => `${k.toUpperCase()} ${v > 0 ? '+' : ''}${v}`).join('   ');
    ctx.fillText((st || 'No stats').slice(0, 80), pad + 24, pad + 90);
    ctx.textAlign = 'right'; ctx.fillStyle = pv.canCraft ? '#2ECC71' : '#E74C3C'; ctx.font = 'bold 20px "DejaVu Sans", sans-serif';
    ctx.fillText(pv.canCraft ? 'READY TO FORGE' : 'MISSING ITEMS', W - pad, pad + 36);
    ctx.fillStyle = '#F1C40F'; ctx.font = 'bold 18px "DejaVu Sans", sans-serif';
    ctx.fillText(`${pv.successPct}% SUCCESS`, W - pad, pad + 64);
    ctx.fillStyle = '#9aa3bf'; ctx.font = '14px "DejaVu Sans", sans-serif';
    ctx.fillText(`Hunter: ${clean(player && player.name).slice(0, 24) || 'Hunter'}   Key: ${clean(pv.scroll.key)}`, W - pad, pad + 90);
    ctx.textAlign = 'left';

    // Materials table
    let y = headerH;
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px "DejaVu Sans", sans-serif'; ctx.fillText('REQUIRED MATERIALS', pad, y); y += 14;
    for (const r of R) {
      roundRect(ctx, pad, y, W - pad * 2, rowH - 8, 8, r.ok ? 'rgba(46,204,113,0.12)' : 'rgba(231,76,60,0.14)', r.ok ? '#2ECC71' : '#E74C3C');
      ctx.fillStyle = r.ok ? '#2ECC71' : '#E74C3C'; ctx.font = 'bold 20px "DejaVu Sans", sans-serif';
      ctx.fillText(r.ok ? '[OK]' : '[ X ]', pad + 12, y + 26);
      ctx.fillStyle = '#ffffff'; ctx.font = '18px "DejaVu Sans", sans-serif';
      const tag = r.kind === 'essence' ? 'ESSENCE  ' : r.kind === 'nexus' ? 'FEE  ' : '';
      ctx.fillText(`${tag}${clean(r.label).slice(0, 44)}`, pad + 80, y + 26);
      ctx.textAlign = 'right'; ctx.fillStyle = r.ok ? '#c8f7d8' : '#ffd0cc'; ctx.font = 'bold 18px "DejaVu Sans", sans-serif';
      ctx.fillText(`${fmt(r.have)} / ${fmt(r.need)}${r.ok ? '' : `   (-${fmt(r.need - r.have)})`}`, W - pad - 14, y + 26);
      ctx.textAlign = 'left';
      y += rowH;
    }

    // Steps
    y += 24;
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px "DejaVu Sans", sans-serif'; ctx.fillText('STEP BY STEP', pad, y); y += 10;
    S.forEach((line, i) => { y += stepH; ctx.fillStyle = i === S.length - 1 ? '#F1C40F' : '#d6dbee'; ctx.font = `${i === S.length - 1 ? 'bold ' : ''}15px "DejaVu Sans", sans-serif`; ctx.fillText(`${i + 1}. ${clean(line).slice(0, 100)}`, pad + 6, y); });

    // Footer
    ctx.fillStyle = '#E74C3C'; ctx.font = 'bold 16px "DejaVu Sans", sans-serif';
    ctx.fillText('WARNING: a failed craft (10%) consumes ALL listed materials, essence stones and the Nexus fee.', pad, H - 40);
    ctx.fillStyle = '#6f7797'; ctx.font = '13px "DejaVu Sans", sans-serif'; ctx.fillText('Astra Forge', pad, H - 20);
    return canvas.toBuffer('image/png');
  } catch (e) { return null; }
}

module.exports = { renderCraftImage, rows, steps, RARITY_COLORS };
