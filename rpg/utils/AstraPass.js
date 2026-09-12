// ╔══════════════════════════════════════════════════════════════╗
// ║       Astra — Astra Pass XP ledger                         ║
// ║  The missing util that pvp.js / BattleRewards.js / daily.js ║
// ║  were already requiring (their calls silently fell through  ║
// ║  to dead flat fields). Writes into player.astraPass        ║
// ║  { level, xp, claimedFree, claimedPremium } — the SAME      ║
// ║  object that /pass claim and SilentXP use.                  ║
// ║                                                              ║
// ║  1,000 XP per level, 50 levels (matches SilentXP + pass.js)  ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

const XP_PER_LEVEL = 1000;
const PASS_LEVELS = 50;

function getPassState(player) {
  if (!player.astraPass || typeof player.astraPass !== 'object') player.astraPass = {};
  const ap = player.astraPass;
  if (typeof ap.level !== 'number') ap.level = 1;
  if (typeof ap.xp !== 'number') ap.xp = 0;
  if (!Array.isArray(ap.claimedFree)) ap.claimedFree = [];
  if (!Array.isArray(ap.claimedPremium)) ap.claimedPremium = [];
  if (!ap.seasonStart) ap.seasonStart = Date.now();
  // One-time merge: legacy flat XP written by old fallback paths
  if (player.astraPassXp > 0) { ap.xp += Math.floor(player.astraPassXp); player.astraPassXp = 0; }
  // Batch-41: also absorb the old games counter (uppercase P) — quiz and the
  // mini-games wrote here for a while and nothing ever read it. Not lost now.
  if (player.astraPassXP > 0) { ap.xp += Math.floor(player.astraPassXP); player.astraPassXP = 0; }
  return ap;
}

// XP needed to advance FROM `level` TO `level+1`. Linear ramp: 750 first,
// +30 per tier (tier 50 costs 2,220). Season total 0→50 = 74,250 XP:
// consistent free grinding (~46k) lands ~72%, Pro (2x) clears it.
function xpForLevel(level) {
  return 750 + 30 * Math.max(0, level || 0);
}

function _levelUp(ap) {
  while (ap.level < PASS_LEVELS && ap.xp >= xpForLevel(ap.level)) {
    ap.xp -= xpForLevel(ap.level);
    ap.level++;
  }
  if (ap.level >= PASS_LEVELS) ap.xp = 0;
}

// Direct-amount XP (callers pass already-computed XP, e.g. PvP reward)
function addPassXP(player, amount) {
  if (!player || !amount || amount <= 0) return 0;
  const ap = getPassState(player);
  ap.xp += Math.floor(amount);
  _levelUp(ap);
  return Math.floor(amount);
}

// Alias matching the BattlePass.js API
function addPassXPAmount(player, amount) {
  return addPassXP(player, amount);
}

module.exports = {
  XP_PER_LEVEL,
  PASS_LEVELS, xpForLevel,
  getPassState,
  addPassXP,
  addPassXPAmount,
};
