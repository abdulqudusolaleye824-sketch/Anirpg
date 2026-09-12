// ═══════════════════════════════════════════════════════════════
// GAME CENTER — shared helpers for the games-GC mini-games
// (/quiz / /ttt / /chess family): gating, target parsing,
// image-or-text board delivery, and the XP + Nexus economy
// (5,000 NX/day/player cap, Pro 2×).
// ═══════════════════════════════════════════════════════════════

const AstralGroups = require('../utils/AstralGroups');
const UI = require('../utils/UI');

const CHALLENGE_TTL = 5 * 60 * 1000; // pending challenges live 5 minutes
const WIN_XP = 1500;                 // Astra XP per win
const DRAW_XP = 250;                 // Astra XP each on a draw
const TTT_WIN_NX = 200;              // Nexus for a Tic-Tac-Toe win
const CHESS_WIN_NX = 500;            // Nexus for a chess win
const DAILY_NX_CAP = 5000;           // max game Nexus per player per day

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Gate: group + registered games GC (+ active subscription) ──
// Returns { ok:true } or { ok:false, reason, code } — reason is send-ready;
// gateBlock() upgrades the 'not-games' reason with the live GC link.
function gate(db, chatId) {
  if (!chatId || !String(chatId).endsWith('@g.us')) {
    return { ok: false, code: 'not-group', reason: '❌ Mini-games can only be played inside a group.' };
  }
  if (!AstralGroups.hosts(db, chatId, 'games')) {
    return {
      ok: false,
      code: 'not-games',
      reason: '❌ Mini-games only work in a designated *Games GC*.\nAsk an admin to set one up with */setgroup games --main*',
    };
  }
  if (!AstralGroups.gate(db, chatId).allow) {
    return { ok: false, code: 'expired', reason: '⛔ This Games GC subscription has expired. An owner can run */renew*.' };
  }
  return { ok: true };
}

// Live invite link of the primary Games GC (fresh code from WhatsApp;
// stored link as fallback; null when no Games GC is configured).
async function liveGamesLink(db, sock) {
  let entry = null;
  try { entry = AstralGroups.primaryOf(db, 'games'); } catch (e) { entry = null; }
  if (!entry || !entry.groupId) return null;
  try {
    if (sock && typeof sock.groupInviteCode === 'function') {
      const code = await sock.groupInviteCode(entry.groupId);
      if (code) return `https://chat.whatsapp.com/${code}`;
    }
  } catch (e) { /* fall through to stored */ }
  return entry.inviteLink || null;
}

// Send-ready block text for a failed gate(): the 'not-games' case carries
// the live Games GC link; every other case returns the plain reason.
async function gateBlock(db, chatId, sock, g) {
  if (!g || g.ok) return null;
  if (g.code !== 'not-games') return g.reason;
  let link = null;
  try { link = await liveGamesLink(db, sock); } catch (e) { link = null; }
  if (link) {
    return `❌ Mini-games only work in the *Games GC*.\n\n🎮 Join here to play:\n${link}`;
  }
  return g.reason;
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

// ── Daily Nexus economy ─────────────────────────────────────────
// (db.gameDailyMS keeps its historical key so today's bucket survives;
// it now tracks Nexus, not Moonstones.)
function nxEarnedToday(db, jid) {
  const bucket = db.gameDailyMS;
  if (!bucket || bucket.date !== todayKey()) return 0;
  return bucket.earned?.[jid] || 0;
}

function addNxEarned(db, jid, amount) {
  const key = todayKey();
  if (!db.gameDailyMS || db.gameDailyMS.date !== key) {
    db.gameDailyMS = { date: key, earned: {} };
  }
  if (!db.gameDailyMS.earned) db.gameDailyMS.earned = {};
  db.gameDailyMS.earned[jid] = (db.gameDailyMS.earned[jid] || 0) + amount;
}

// Award a finished game. kind: 'ttt' | 'chess'. outcome for `jid`:
// 'win' | 'draw' | 'loss'. Returns { xp, nx, capped }.
function awardGame(db, player, jid, kind, outcome) {
  let xp = 0, nx = 0, capped = false;
  const pro = UI.isPro(player);
  const mult = pro ? 2 : 1;

  if (outcome === 'win') {
    xp = WIN_XP * mult;
    const base = (kind === 'chess' ? CHESS_WIN_NX : TTT_WIN_NX) * mult;
    const room = Math.max(0, DAILY_NX_CAP - nxEarnedToday(db, jid));
    nx = Math.min(base, room);
    capped = nx < base;
    if (nx > 0) addNxEarned(db, jid, nx);
  } else if (outcome === 'draw') {
    xp = DRAW_XP * mult;
  }

  if (xp > 0) {
    if (!player.astraPassXP) player.astraPassXP = 0;
    player.astraPassXP += xp;
  }
  if (nx > 0) {
    if (!player.gold) player.gold = 0;
    player.gold += nx;
    if (player.inventory) player.inventory.gold = player.gold;
    try {
      require('../utils/TransactionLog').logTransaction(player, {
        type: 'game_win', amount: nx, currency: '💠', note: `${kind} win`,
      });
    } catch (e) { /* best effort */ }
  }
  return { xp, nx, capped };
}

function rewardLine(res, pro) {
  const parts = [];
  if (res.xp > 0) parts.push(`got *${res.xp.toLocaleString()} xp*${pro ? ' (2× Pro)' : ''}`);
  const nx = res.nx != null ? res.nx : res.ms; // (legacy shape tolerance)
  if (nx > 0) parts.push(`*+${nx.toLocaleString()}* 💠 Nexus`);
  if (res.capped) parts.push(`\n⚠️ Daily limit reached! (Limit: ${DAILY_NX_CAP.toLocaleString()} Nexus/day)`);
  return parts.length ? ' and ' + parts.join(' ') : '';
}

// Per-game persistent stats: player.tttStats / player.chessStats
// (msEarned stays as the historical Moonstone total; new wins accrue nxEarned.)
function bumpStats(player, kind, outcome, nx) {
  const key = kind === 'chess' ? 'chessStats' : 'tttStats';
  if (!player[key]) player[key] = { wins: 0, losses: 0, draws: 0, msEarned: 0, nxEarned: 0 };
  if (outcome === 'win') player[key].wins += 1;
  else if (outcome === 'loss') player[key].losses += 1;
  else player[key].draws += 1;
  player[key].nxEarned = (player[key].nxEarned || 0) + (nx || 0);
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
// opts: { mentions?, buttons? } — buttons ride sendButtons (interactive →
// menu → plain), so boards keep working on every client.
async function sendBoard(sock, chatId, msg, imageBuffer, caption, fallbackText, opts = {}) {
  const mentions = Array.isArray(opts.mentions) ? opts.mentions.filter(Boolean) : [];
  const buttons = Array.isArray(opts.buttons) ? opts.buttons : null;
  if (buttons && buttons.length) {
    try {
      const Buttons = require('../../utils/buttons');
      const hasImg = Buffer.isBuffer(imageBuffer) && imageBuffer.length > 0;
      return await Buttons.sendButtons(sock, chatId, {
        text: hasImg ? caption : `${caption}\n${fallbackText}`,
        image: hasImg ? imageBuffer : null,
        mimetype: 'image/png',
        mentions,
        buttons,
      }, msg);
    } catch (e) { /* fall through to plain delivery */ }
  }
  const m = mentions.length ? { mentions } : {};
  if (Buffer.isBuffer(imageBuffer) && imageBuffer.length > 0) {
    return sock.sendMessage(chatId, { image: imageBuffer, caption, ...m }, { quoted: msg });
  }
  return sock.sendMessage(chatId, { text: `${caption}\n${fallbackText}`, ...m }, { quoted: msg });
}

module.exports = {
  CHALLENGE_TTL,
  WIN_XP,
  DRAW_XP,
  TTT_WIN_NX,
  CHESS_WIN_NX,
  DAILY_NX_CAP,
  gate,
  gateBlock,
  liveGamesLink,
  getTargetJid,
  mentionOf,
  nxEarnedToday,
  awardGame,
  rewardLine,
  bumpStats,
  slot,
  setSlot,
  clearSlot,
  sendBoard,
};
