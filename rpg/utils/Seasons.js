// ═══════════════════════════════════════════════════════════════
// Seasons — Push #102g: GLOBAL, automatic pass seasons.
//   Before this every player had a private `seasonStart` that was set the
//   first time they opened /bp or /pass and never rolled: the card said
//   "Season Ends: Ended" forever and nothing reset or restarted.
//   Now a season is a fixed window on the calendar, the same for everyone:
//     • Battle Pass  — 30-day cycles
//     • Astra Pass   — 40-day cycles
//   counted from EPOCH (Season 1 starts 15 Oct 2026 00:00 WAT). When a player
//   touches their pass in a new season the pass is reset (level 1, 0 XP, no
//   claims, Premium off). Unclaimed tiers are LOST (owner decision 10-14).
// ═══════════════════════════════════════════════════════════════
'use strict';

const EPOCH = Date.UTC(2026, 9, 14, 23, 0, 0); // 2026-10-15 00:00 WAT (UTC+1)
const DAY = 86400000;
const KINDS = {
  bp:    { days: 30, label: 'Battle Pass' },
  astra: { days: 40, label: 'Astra Pass' },
};

function season(kind, now = Date.now()) {
  const k = KINDS[kind] || KINDS.bp;
  const len = k.days * DAY;
  const n = Math.floor((now - EPOCH) / len); // may be -1 before EPOCH
  const number = Math.max(1, n + 1);
  const start = EPOCH + Math.max(0, n) * len;
  const end = start + len;
  return { kind, id: `${kind}-${number}`, number, start, end, days: k.days, label: k.label };
}

function remainingText(kind, now = Date.now()) {
  const s = season(kind, now);
  const d = s.end - now;
  if (d <= 0) return 'rolling over…';
  const days = Math.floor(d / DAY), hrs = Math.floor((d % DAY) / 3600000);
  return days > 0 ? `${days}d ${hrs}h` : `${hrs}h ${Math.floor((d % 3600000) / 60000)}m`;
}

function progress(kind, now = Date.now()) {
  const s = season(kind, now);
  return Math.min(1, Math.max(0, (now - s.start) / (s.end - s.start)));
}

/**
 * Roll a pass state into the current season. `fresh(state)` resets the fields
 * for its pass type. Returns true if a reset happened.
 */
function roll(state, kind, fresh, now = Date.now()) {
  if (!state || typeof state !== 'object') return false;
  const s = season(kind, now);
  if (state.seasonId === s.id) return false;
  const had = !!state.seasonId || (state.level || 0) > 1 || (state.xp || 0) > 0;
  fresh(state);
  state.seasonId = s.id;
  state.seasonStart = s.start;
  state.lastRolledAt = now;
  if (had) state.rolledFrom = { at: now, prevSeason: state.prevSeasonId || null };
  return true;
}

module.exports = { EPOCH, KINDS, season, remainingText, progress, roll };
