// Push #97: casino tuning — win rates +20% (relative), winnings +40%, Pro ×2 on winnings (never on odds).
'use strict';
const WIN_RATE_BOOST = 0.20, LOOT_BOOST = 1.40, PRO_MULT = 2;
// Called on a LOSS: with probability q = 0.2·p/(1−p) the loss becomes a win, so P(win) = 1.2·p exactly.
function luckyBreak(baseWinChance, rng = Math.random) {
  const p = Math.max(0.0001, Math.min(0.8, Number(baseWinChance) || 0));
  const q = Math.min(0.5, WIN_RATE_BOOST * p / (1 - p));
  return rng() < q;
}
function isPro(player) { try { return !!require('./UI').isPro(player || {}); } catch (e) { return false; } }
// Net profit → boosted profit (+40%, Pro ×2). Losses/pushes untouched.
function boostWin(profit, player) {
  const n = Number(profit) || 0; if (n <= 0) return n;
  return Math.floor(n * LOOT_BOOST) * (isPro(player) ? PRO_MULT : 1);
}
function boostLine(player) { return `🍀 Casino boost: +40% winnings${isPro(player) ? ' · 💎 PRO ×2' : ''}`; }
module.exports = { WIN_RATE_BOOST, LOOT_BOOST, PRO_MULT, luckyBreak, boostWin, boostLine, isPro };
