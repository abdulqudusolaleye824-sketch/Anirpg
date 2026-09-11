'use strict';
// ═══════════════════════════════════════════════════════════════
// UI KIT — one styling system for the whole game.
// Free players get the clean restyle; Pro players get the deluxe
// treatment (frame + extra insight sections + measured bars).
// Pure functions, zero dependencies.
// Usage: const UI = require('../../rpg/utils/UI');
// ═══════════════════════════════════════════════════════════════

function isPro(player) {
  return !!((player?.isPro || player?.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
}

const num = (n) => (Number(n) || 0).toLocaleString('en-US');

const FREE_BAR = '━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const PRO_BAR  = '✦ ━━━━━━━━━━━━━━━━━━━━━ ✦';
const FREE_MINI = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';
const PRO_MINI  = '✦ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ ✦';

// Progress bar. Pro variant appends the % — free stays clean.
function bar(cur, max, len = 10, pro = false) {
  const m = Math.max(1, Number(max) || 1);
  const c = Math.max(0, Math.min(Number(cur) || 0, m));
  const filled = Math.round((c / m) * len);
  const b = '▰'.repeat(filled) + '▱'.repeat(Math.max(0, len - filled));
  if (pro) return `${b} ${Math.round((c / m) * 100)}%`;
  return b;
}

// In-card section header.
function section(label, emoji = '▸', pro = false) {
  return pro ? `✦ *${label}* ✦` : `${emoji} *${label}*`;
}

// 5d 16h 23m style countdown.
function timer(ms) {
  if (ms == null || ms <= 0) return 'Ready';
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// Shared XP curve (matches stats.js).
function xpForLevel(level) {
  return Math.floor(200 * Math.pow(Math.max(1, Number(level) || 1), 1.8));
}

function upsell() {
  return '⚡ _Go PRO for the deluxe view: /prostore_';
}

// Full card. lines = everyone, proLines = Pro-only insight section.
function card(player, o = {}) {
  const pro = isPro(player);
  const { icon = '✦', title = '', lines = [], proLines = [], tip = null, footer = null } = o;
  const frame = pro ? PRO_BAR : FREE_BAR;
  const out = [];
  if (pro) out.push(PRO_BAR, `${icon} *${title}* 💎`, PRO_BAR, '');
  else out.push(`${icon} *${title}*`, FREE_BAR, '');
  out.push(...lines);
  if (pro && proLines.length) out.push('', PRO_MINI, ...proLines);
  if (footer) out.push('', footer);
  out.push('', frame);
  if (pro) { if (tip) out.push(`💎 _${tip}_`); }
  else {
    if (tip) out.push(`💡 _${tip}_`);
    out.push(upsell());
  }
  return out.join('\n');
}

module.exports = { isPro, num, bar, section, timer, xpForLevel, upsell, card, FREE_BAR, PRO_BAR, FREE_MINI, PRO_MINI };
