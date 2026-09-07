/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║           Astra — TimeUtil (timezone-aware)              ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Provides correct "current date / week" keys in ANY world timezone
 * WITHOUT any external API or key. Node's built-in Intl engine knows
 * every timezone (and DST rules) offline, so daily/weekly resets are
 * always right for players in Nigeria, the US, India, Europe, etc.
 *
 *   • Default timezone = Africa/Lagos (WAT). Override with .env:
 *        BOT_TIMEZONE=America/New_York
 *   • Players can set their own timezone with /timezone <IANA zone>
 *     (stored as player.timezone); when present it is used per-player.
 */

'use strict';

const DEFAULT_TZ = process.env.BOT_TIMEZONE || 'Africa/Lagos';

const VALID_TZ_FALLBACKS = ['Africa/Lagos'];

// Build (and cache) an Intl.DateTimeFormat for a zone. If the zone is
// invalid, silently fall back to the default so we never crash.
const _cache = new Map();
function dtfFor(tz) {
  if (!_cache.has(tz)) {
    try {
      _cache.set(tz, new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }));
    } catch (e) {
      // Invalid IANA name → use default (never throw to the caller).
      _cache.set(tz, dtfFor(DEFAULT_TZ));
    }
  }
  return _cache.get(tz);
}

// Validate an IANA timezone (e.g. "America/New_York"). Returns the zone if
// valid, else null.
function isValidTz(tz) {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch (e) {
    return null;
  }
}

/**
 * Calendar day key "YYYY-MM-DD" for the given timezone at `now`.
 * en-CA locale formats dates as YYYY-MM-DD, which is exactly what we want.
 */
function dayKey(tz = DEFAULT_TZ, now = Date.now()) {
  return dtfFor(tz).format(new Date(now)).slice(0, 10);
}

/**
 * Week key "YYYY-Www" based on ISO weeks (Monday = start of week), in the
 * given timezone. Weekly challenges reset at the start of Monday local time.
 */
function weekKey(tz = DEFAULT_TZ, now = Date.now()) {
  // Get the date string in the zone, then compute its Monday.
  const ymd = dtfFor(tz).format(new Date(now)).slice(0, 10);
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d)); // treat as UTC for date math only
  const day = dt.getUTCDay();                 // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1 - day);    // days back to Monday
  const monday = new Date(Date.UTC(y, m - 1, d + diff));
  const isoWeek = isoWeekOf(monday);
  return `${monday.getUTCFullYear()}-W${String(isoWeek).padStart(2, '0')}`;
}

// ISO 8601 week number of a given date (used internally).
function isoWeekOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// UTC offset (ms) of a timezone at `now`. E.g. Africa/Lagos → +3600000.
function utcOffsetMs(tz = DEFAULT_TZ, now = Date.now()) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  for (const part of f.formatToParts(new Date(now))) {
    if (part.type !== 'literal') p[part.type] = part.value;
  }
  const hour = p.hour === '24' ? 0 : +p.hour;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, hour, +p.minute, +p.second);
  return asUTC - now;
}

// Timestamp (ms) of the next local midnight in `tz`. Used by the reset timer.
function nextMidnight(tz = DEFAULT_TZ, now = Date.now()) {
  const off = utcOffsetMs(tz, now);
  const localNow = new Date(now + off);
  const next = new Date(Date.UTC(
    localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() + 1, 0, 0, 0, 0
  ));
  return next.getTime() - off;
}

module.exports = { DEFAULT_TZ, dayKey, weekKey, isValidTz, dtfFor, utcOffsetMs, nextMidnight };
