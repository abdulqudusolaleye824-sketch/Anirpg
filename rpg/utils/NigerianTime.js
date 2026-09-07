/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — NigerianTime                        ║
 * ║  WAT (West Africa Time) = UTC+1                      ║
 * ║  All game events, resets, and timestamps use WAT     ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

const WAT_OFFSET_MS = 1 * 60 * 60 * 1000; // UTC+1

/**
 * Get the current time as a Date object in WAT.
 */
function nowWAT() {
  return new Date(Date.now() + WAT_OFFSET_MS);
}

/**
 * Get current timestamp string in WAT.
 * e.g. "2025-04-26 14:32:00 WAT"
 */
function timestampWAT() {
  return nowWAT().toISOString().replace('T', ' ').slice(0, 19) + ' WAT';
}

/**
 * Get today's date string in WAT.
 * e.g. "2025-04-26"
 */
function todayWAT() {
  return nowWAT().toISOString().slice(0, 10);
}

/**
 * Get the Unix timestamp of the most recent WAT midnight.
 * Used for daily reset checks.
 */
function lastMidnightWAT() {
  const now = Date.now() + WAT_OFFSET_MS; // shift to WAT
  const d   = new Date(now);
  // Build midnight in WAT by zeroing time in WAT space then shifting back
  const midnightWAT = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    0, 0, 0, 0
  );
  // midnightWAT is "midnight WAT expressed as UTC ms" — subtract offset to get real UTC
  return midnightWAT - WAT_OFFSET_MS;
}

/**
 * Get the Unix timestamp of the most recent WAT Monday midnight.
 * Used for weekly reset checks.
 */
function lastMondayMidnightWAT() {
  const now = Date.now() + WAT_OFFSET_MS;
  const d   = new Date(now);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon... in WAT space
  const daysSinceMon = day === 0 ? 6 : day - 1;
  const mondayMidnightWAT = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - daysSinceMon,
    0, 0, 0, 0
  );
  return mondayMidnightWAT - WAT_OFFSET_MS;
}

/**
 * Get the Unix timestamp of the most recent WAT 1st of the month midnight.
 * Used for monthly reset checks.
 */
function lastMonthStartWAT() {
  const now = Date.now() + WAT_OFFSET_MS;
  const d   = new Date(now);
  const firstWAT = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0);
  return firstWAT - WAT_OFFSET_MS;
}

/**
 * Check if a player can claim their daily — ROLLING 24h window from last claim.
 * (Was: reset at WAT midnight. Now: claimable exactly 24h after the last claim,
 * so a player's own timing defines their day, not the calendar midnight.)
 * @param {number} lastClaimed — Unix timestamp of last claim
 * @returns {{ canClaim: boolean, msRemaining: number }}
 */
function canClaimDaily(lastClaimed) {
  if (!lastClaimed) return { canClaim: true, msRemaining: 0 };
  const windowEnd = lastClaimed + 86400000; // 24h after the last claim
  if (Date.now() >= windowEnd) return { canClaim: true, msRemaining: 0 };
  return { canClaim: false, msRemaining: windowEnd - Date.now() };
}

/**
 * Check if a player can claim their weekly (hasn't claimed since last WAT Monday).
 */
function canClaimWeekly(lastClaimed) {
  const monday = lastMondayMidnightWAT();
  if (!lastClaimed || lastClaimed < monday) {
    return { canClaim: true, msRemaining: 0 };
  }
  const nextMonday = monday + 7 * 86400000;
  return { canClaim: false, msRemaining: nextMonday - Date.now() };
}

/**
 * Check if a player can claim their monthly (hasn't claimed since WAT month start).
 */
function canClaimMonthly(lastClaimed) {
  const monthStart = lastMonthStartWAT();
  if (!lastClaimed || lastClaimed < monthStart) {
    return { canClaim: true, msRemaining: 0 };
  }
  // Next month start
  const n = nowWAT();
  const nextMonth = new Date(Date.UTC(
    n.getUTCFullYear(),
    n.getUTCMonth() + 1,
    1, 0, 0, 0, 0
  )).getTime() - WAT_OFFSET_MS;
  return { canClaim: false, msRemaining: nextMonth - Date.now() };
}

/**
 * Format a duration in ms to human readable string.
 * e.g. "5h 23m" or "2d 14h"
 */
function formatDuration(ms) {
  if (ms <= 0) return 'Ready';
  const totalSec  = Math.ceil(ms / 1000);
  const days      = Math.floor(totalSec / 86400);
  const hours     = Math.floor((totalSec % 86400) / 3600);
  const mins      = Math.floor((totalSec % 3600) / 60);

  if (days > 0)  return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

module.exports = {
  nowWAT,
  timestampWAT,
  todayWAT,
  lastMidnightWAT,
  lastMondayMidnightWAT,
  lastMonthStartWAT,
  canClaimDaily,
  canClaimWeekly,
  canClaimMonthly,
  formatDuration,
  WAT_OFFSET_MS,
};
