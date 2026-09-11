// ═══════════════════════════════════════════════════════════════
// ReferralSystem — referral codes, points, monthly contest
// - Every player owns a unique code (ANI-XXXXXX)
// - Referred player hitting level 3 → referrer gets 10,000 Nexus immediately
// - Points: +1 per completed referral signup, +4 bonus when they hit Lv.3
// - Monthly contest: most referrals in the calendar month wins a
//   Weekly Pro CARD (added to cards inventory — NEVER auto-activated)
// ═══════════════════════════════════════════════════════════════
'use strict';

const LVL3_REWARD_NEXUS = 10000;
const PTS_SIGNUP = 1;
const PTS_LVL3_BONUS = 4;

function monthKey(d = new Date()) {
  // WAT (UTC+1) calendar month: YYYY-MM
  const wat = new Date(d.getTime() + 3600000);
  return `${wat.getUTCFullYear()}-${String(wat.getUTCMonth() + 1).padStart(2, '0')}`;
}

function genCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `ANI-${s}`;
}

// Ensure the player has a referral profile (backfills legacy players).
function ensureProfile(db, player) {
  if (!player) return null;
  if (!player.referralCode) {
    let code = genCode();
    let guard = 0;
    try {
      const taken = new Set(Object.values(db.users || {}).filter(u => u && u !== player).map(u => u.referralCode).filter(Boolean));
      while (taken.has(code) && guard++ < 20) code = genCode();
    } catch (e) {}
    player.referralCode = code;
  }
  if (!Array.isArray(player.referrals)) player.referrals = [];
  if (typeof player.referralPoints !== 'number') player.referralPoints = 0;
  if (typeof player.referralLvl3 !== 'number') player.referralLvl3 = 0;
  if (!player.referralMonthly || typeof player.referralMonthly !== 'object') {
    player.referralMonthly = { month: monthKey(), count: 0 };
  }
  return player;
}

function findByCode(db, code) {
  if (!code) return null;
  const want = String(code).trim().toUpperCase();
  for (const [id, u] of Object.entries(db.users || {})) {
    if (u && u.referralCode && String(u.referralCode).toUpperCase() === want) return { id, player: u };
  }
  return null;
}

// Roll the player's monthly bucket into the current month (no data loss:
// counts for a past month are kept until finalizeMonth runs).
function currentMonthCount(player) {
  const mk = monthKey();
  if (!player.referralMonthly || player.referralMonthly.month !== mk) return 0;
  return player.referralMonthly.count || 0;
}

function recordSignup(db, referrerId, newUserId) {
  const referrer = db.users?.[referrerId];
  if (!referrer) return false;
  ensureProfile(db, referrer);
  if (!referrer.referrals.includes(newUserId)) referrer.referrals.push(newUserId);
  referrer.referralPoints = (referrer.referralPoints || 0) + PTS_SIGNUP;
  const mk = monthKey();
  if (!referrer.referralMonthly || referrer.referralMonthly.month !== mk) {
    referrer.referralMonthly = { month: mk, count: 0 };
  }
  referrer.referralMonthly.count++;
  return true;
}

// Called from the level-up choke point. Returns the reward notice or null.
function onLevelUp(db, player, playerId) {
  try {
    if (!player || !player.referredBy || player.referralLvl3Paid) return null;
    if ((player.level || 1) < 3) return null;
    const referrer = db.users?.[player.referredBy];
    if (!referrer) { player.referralLvl3Paid = true; return null; }
    ensureProfile(db, referrer);
    player.referralLvl3Paid = true;
    referrer.referralLvl3 = (referrer.referralLvl3 || 0) + 1;
    referrer.referralPoints = (referrer.referralPoints || 0) + PTS_LVL3_BONUS;
    referrer.gold = (referrer.gold || 0) + LVL3_REWARD_NEXUS;
    if (referrer.inventory) referrer.inventory.gold = referrer.gold;
    try {
      require('./TransactionLog').logTransaction(referrer, {
        type: 'referral_lvl3', amount: LVL3_REWARD_NEXUS, currency: '💠',
        note: `${player.name || 'recruit'} hit Lv.3`,
      });
    } catch (e) {}
    return { referrerId: player.referredBy, referrer, amount: LVL3_REWARD_NEXUS, recruitName: player.name || 'recruit' };
  } catch (e) { return null; }
}

// ── Monthly contest ─────────────────────────────────────────────
// db.referralSeason = { month: 'YYYY-MM' } — the month currently counting.
// When a new month is detected, finalize the old one: winner = highest
// past-month count (ties → most total points, then earliest achievements).
// Winner gets a Weekly Pro CARD (inventory, never auto-activated).
function getSeason(db) {
  if (!db.referralSeason || !db.referralSeason.month) {
    db.referralSeason = { month: monthKey(), lastWinner: null, lastWinnerCount: 0 };
  }
  return db.referralSeason;
}

function finalizeIfNewMonth(db) {
  const season = getSeason(db);
  const nowMk = monthKey();
  if (season.month === nowMk) return null; // still current — nothing to do
  const closedMonth = season.month;
  let winnerId = null, winner = null, best = 0, bestPts = -1;
  for (const [id, u] of Object.entries(db.users || {})) {
    if (!u || !u.referralMonthly || u.referralMonthly.month !== closedMonth) continue;
    const c = u.referralMonthly.count || 0;
    const pts = u.referralPoints || 0;
    if (c > best || (c === best && c > 0 && pts > bestPts)) {
      best = c; bestPts = pts; winnerId = id; winner = u;
    }
  }
  season.month = nowMk;
  season.lastWinner = winnerId ? { id: winnerId, name: winner.name, count: best, month: closedMonth } : null;
  season.lastWinnerCount = best;
  if (winner) {
    if (!winner.cards) winner.cards = {};
    winner.cards.pro_weekly = (winner.cards.pro_weekly || 0) + 1; // CARD — not activated
    try {
      require('./TransactionLog').logTransaction(winner, {
        type: 'referral_monthly_win', amount: 1, currency: '🎫',
        note: `Top recruiter ${closedMonth} (${best})`,
      });
    } catch (e) {}
  }
  // Reset every monthly bucket into the new month
  for (const u of Object.values(db.users || {})) {
    if (!u) continue;
    if (u.referralMonthly && u.referralMonthly.month !== nowMk) {
      u.referralMonthly = { month: nowMk, count: 0 };
    }
  }
  return { closedMonth, winnerId, winner, count: best };
}

module.exports = {
  LVL3_REWARD_NEXUS, PTS_SIGNUP, PTS_LVL3_BONUS,
  monthKey, genCode, ensureProfile, findByCode,
  currentMonthCount, recordSignup, onLevelUp,
  getSeason, finalizeIfNewMonth,
};
