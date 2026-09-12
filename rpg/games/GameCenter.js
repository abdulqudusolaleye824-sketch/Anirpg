// ═══════════════════════════════════════════════════════════════
// GAME CENTER — shared helpers for the games-GC mini-games
// (/quiz / /ttt / /chess family): gating, target parsing,
// image-or-text board delivery, and the XP + Moonstone economy
// (50,000 MS/day/player cap, Pro 2×).
// ═══════════════════════════════════════════════════════════════

const AstralGroups = require('../utils/AstralGroups');
const UI = require('../utils/UI');

const CHALLENGE_TTL = 5 * 60 * 1000; // pending challenges live 5 minutes
const WIN_XP = 15000;                // Astra XP per win (matches reference bot)
const DRAW_XP = 2500;                // Astra XP each on a draw
const TTT_WIN_MS = 2000;             // Moonstones for a Tic-Tac-Toe win
const CHESS_WIN_MS = 5000;           // Moonstones for a chess win
const DAILY_MS_CAP = 50000;          // max game Moonstones per player per day

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Gate: group + registered games GC (+ active subscription) ──
// Returns { ok:true } or { ok:false, reason } — reason is send-ready.
function gate(db, chatId) {
  if (!chatId || !String(chatId).endsWith('@g.us')) {
    return { ok: false, reason: '❌ Mini-games can only be played inside a group.' };
  }
  if (!AstralGroups.hosts(db, chatId, 'games')) {
    return {
      ok: false,
      reason: '❌ Mini-games only work in a designated *Games GC*.\nAsk an admin to set one up with */setgroup games --main*',
    };
  }
  if (!AstralGroups.gate(db, chatId).allow) {
    return { ok: false, reason: '⛔ This Games GC subscription has expired. An owner can run */renew*.' };
  }
  return { ok: true };
}

// ── Target: @mention first, quoted message author second ────────
function getTargetJid(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const mentioned = ctx?.mentionedJid?.[0];
  if (mentioned) return mentioned;
  if (ctx?.participant) return ctx.participant;
  return null;
}

function mentionOf(jid) {
  return '@' + String(jid || '').split('@')[0];
}

// ── Daily Moonstone economy ─────────────────────────────────────
function msEarnedToday(db, jid) {
  const bucket = db.gameDailyMS;
  if (!bucket || bucket.date !== todayKey()) return 0;
  return bucket.earned?.[jid] || 0;
}

function addMsEarned(db, jid, amount) {
  const key = todayKey();
  if (!db.gameDailyMS || db.gameDailyMS.date !== key) {
    db.gameDailyMS = { date: key, earned: {} };
  }
  if (!db.gameDailyMS.earned) db.gameDailyMS.earned = {};
  db.gameDailyMS.earned[jid] = (db.gameDailyMS.earned[jid] || 0) + amount;
}

// Award a finished game. kind: 'ttt' | 'chess'. outcome for `jid`:
// 'win' | 'draw' | 'loss'. Returns { xp, ms, capped }.
function awardGame(db, player, jid, kind, outcome) {
  let xp = 0, ms = 0, capped = false;
  const pro = UI.isPro(player);
  const mult = pro ? 2 : 1;

  if (outcome === 'win') {
    xp = WIN_XP * mult;
    const base = (kind === 'chess' ? CHESS_WIN_MS : TTT_WIN_MS) * mult;
    const room = Math.max(0, DAILY_MS_CAP - msEarnedToday(db, jid));
    ms = Math.min(base, room);
    capped = ms < base;
    if (ms > 0) addMsEarned(db, jid, ms);
  } else if (outcome === 'draw') {
    xp = DRAW_XP * mult;
  }

  if (xp > 0) {
    if (!player.astraPassXP) player.astraPassXP = 0;
    player.astraPassXP += xp;
  }
  if (ms > 0) {
    if (!player.manaCrystals) player.manaCrystals = 0;
    player.manaCrystals += ms;
    try {
      require('../utils/TransactionLog').logTransaction(player, {
        type: 'game_win', amount: ms, currency: '💎', note: `${kind} win`,
      });
    } catch (e) { /* best effort */ }
  }
  return { xp, ms, capped };
}

function rewardLine(res, pro) {
  const parts = [];
  if (res.xp > 0) parts.push(`got *${res.xp.toLocaleString()} xp*${pro ? ' (2× Pro)' : ''}`);
  if (res.ms > 0) parts.push(`*+${res.ms.toLocaleString()}* 💎 Moonstones`);
  if (res.capped) parts.push(`\n⚠️ Daily limit reached! (Limit: ${DAILY_MS_CAP.toLocaleString()} MS/day)`);
  return parts.length ? ' and ' + parts.join(' ') : '';
}

// Per-game persistent stats: player.tttStats / player.chessStats
function bumpStats(player, kind, outcome, ms) {
  const key = kind === 'chess' ? 'chessStats' : 'tttStats';
  if (!player[key]) player[key] = { wins: 0, losses: 0, draws: 0, msEarned: 0 };
  if (outcome === 'win') player[key].wins += 1;
  else if (outcome === 'loss') player[key].losses += 1;
  else player[key].draws += 1;
  player[key].msEarned += ms;
}

// ── Challenge slots (one pending/active game per chat per game) ─
function slot(db, kind, chatId) {
  const key = kind === 'chess' ? 'chessGames' : 'tttGames';
  if (!db[key]) db[key] = {};
  const g = db[key][chatId];
  if (g && g.phase === 'challenge' && Date.now() > g.expiresAt) {
    delete db[key][chatId]; // lazy-expiry
    return null;
  }
  return g || null;
}

function setSlot(db, kind, chatId, game) {
  const key = kind === 'chess' ? 'chessGames' : 'tttGames';
  if (!db[key]) db[key] = {};
  db[key][chatId] = game;
}

function clearSlot(db, kind, chatId) {
  const key = kind === 'chess' ? 'chessGames' : 'tttGames';
  if (db[key]) delete db[key][chatId];
}

// ── Board delivery: image when possible, text fallback ──────────
async function sendBoard(sock, chatId, msg, imageBuffer, caption, fallbackText) {
  if (Buffer.isBuffer(imageBuffer) && imageBuffer.length > 0) {
    return sock.sendMessage(chatId, { image: imageBuffer, caption }, { quoted: msg });
  }
  return sock.sendMessage(chatId, { text: `${caption}\n${fallbackText}` }, { quoted: msg });
}

module.exports = {
  CHALLENGE_TTL,
  WIN_XP,
  DRAW_XP,
  TTT_WIN_MS,
  CHESS_WIN_MS,
  DAILY_MS_CAP,
  gate,
  getTargetJid,
  mentionOf,
  msEarnedToday,
  awardGame,
  rewardLine,
  bumpStats,
  slot,
  setSlot,
  clearSlot,
  sendBoard,
};
