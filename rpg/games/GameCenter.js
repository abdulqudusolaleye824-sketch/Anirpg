// ═══════════════════════════════════════════════════════════════
// GAME CENTER — shared helpers for the games-GC mini-games
// (/quiz / /ttt / /chess family): gating, target parsing,
// image-or-text board delivery, and the XP + Nexus economy
// (5,000 NX/day/player cap, Pro 2×).
// ═══════════════════════════════════════════════════════════════

const AstralGroups = require('../utils/AstralGroups');
const UI = require('../utils/UI');

const CHALLENGE_TTL = 5 * 60 * 1000; // pending challenges live 5 minutes
// Batch-41 games economy: every game pays the three REAL currencies —
// player level XP, Nexus (gold), and real Astra Pass XP. Pro 2× on all.
const WIN_LEVEL_XP = 300;            // player level XP per win
const DRAW_LEVEL_XP = 50;            // player level XP each on a draw (1/6 of win)
const PASS_XP_MIN = 100;             // Astra Pass XP roll range per win
const PASS_XP_MAX = 150;
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

// Roll the per-win Astra Pass payout (100–150; caller applies Pro 2×).
function rollPassXP() {
  return PASS_XP_MIN + Math.floor(Math.random() * (PASS_XP_MAX - PASS_XP_MIN + 1));
}

// Real Astra Pass XP (player.astraPass object, with level-ups). Falls back
// to the absorbable lowercase flat field — NEVER the dead uppercase one.
function grantPassXP(player, amount) {
  const n = Math.floor(amount || 0);
  if (!player || n <= 0) return 0;
  try {
    const AP = require('../utils/AstraPass');
    if (AP && AP.addPassXPAmount) return AP.addPassXPAmount(player, n);
  } catch (e) { /* fall through to flat field */ }
  player.astraPassXp = (player.astraPassXp || 0) + n; // absorbed by getPassState
  return n;
}

// Real player level XP (xp + lifetime totalXp) with instant level-ups.
// Flat by design — game XP takes no rank/SilentXP multipliers (callers
// apply the Pro 2× before calling). sock/chatId optional (level-up + class
// awakening announcements need them; rewards never do).
function grantLevelXP(player, amount, saveDatabase, sock, chatId) {
  const n = Math.floor(amount || 0);
  if (!player || n <= 0) return 0;
  player.xp = (player.xp || 0) + n;
  player.totalXp = (player.totalXp || 0) + n;
  try {
    const LUM = require('../utils/LevelUpManager');
    LUM.checkAndApplyLevelUps(player, saveDatabase || (() => {}), sock || null, chatId || null);
  } catch (e) { /* rewards stand even if the level check hiccups */ }
  return n;
}

// Real Nexus (player.gold + ledger). Also absorbs the legacy void field
// player.nexus (old quiz/engine payouts) so past earnings aren't lost.
function grantNexus(player, amount, note) {
  const n = Math.floor(amount || 0);
  if (!player) return 0;
  try {
    if (player.nexus > 0) {
      player.gold = (player.gold || 0) + Math.floor(player.nexus);
      player.nexus = 0;
    }
  } catch (e) {}
  if (n <= 0) return 0;
  if (!player.gold) player.gold = 0;
  player.gold += n;
  if (player.inventory) player.inventory.gold = player.gold;
  try {
    require('../utils/TransactionLog').logTransaction(player, {
      type: 'game_win', amount: n, currency: '💠', note: note || 'game win',
    });
  } catch (e) { /* best effort */ }
  return n;
}

// Award a finished game. kind: 'ttt' | 'chess'. outcome for `jid`:
// 'win' | 'draw' | 'loss'. extra: { save, sock, chatId } for level-ups.
// Returns { xp, nx, capped, pass } — xp is now LEVEL xp, pass is real pass XP.
function awardGame(db, player, jid, kind, outcome, extra = {}) {
  let xp = 0, nx = 0, capped = false, pass = 0;
  const pro = UI.isPro(player);
  const mult = pro ? 2 : 1;

  if (outcome === 'win') {
    xp = WIN_LEVEL_XP * mult;
    pass = rollPassXP() * mult;
    const base = (kind === 'chess' ? CHESS_WIN_NX : TTT_WIN_NX) * mult;
    const room = Math.max(0, DAILY_NX_CAP - nxEarnedToday(db, jid));
    nx = Math.min(base, room);
    capped = nx < base;
    if (nx > 0) addNxEarned(db, jid, nx);
  } else if (outcome === 'draw') {
    xp = DRAW_LEVEL_XP * mult;
    pass = rollPassXP() * mult;
  }

  if (xp > 0) grantLevelXP(player, xp, extra.save, extra.sock, extra.chatId);
  if (pass > 0) grantPassXP(player, pass);
  if (nx > 0) grantNexus(player, nx, `${kind} win`);
  return { xp, nx, capped, pass };
}

function rewardLine(res, pro) {
  res = res || {};
  const parts = [];
  if (res.xp > 0) parts.push(`*${res.xp.toLocaleString()} XP*`);
  if (res.pass > 0) parts.push(`*${res.pass.toLocaleString()}* ✨ Pass XP`);
  const nx = res.nx != null ? res.nx : res.ms; // (legacy shape tolerance)
  if (nx > 0) parts.push(`*+${nx.toLocaleString()}* 💠 Nexus`);
  if (!parts.length) return res.capped ? `\n⚠️ Daily limit reached! (Limit: ${DAILY_NX_CAP.toLocaleString()} Nexus/day)` : '';
  let line = ' and got ' + parts.join(' + ');
  if (pro) line += ' (2× Pro 💎)';
  if (res.capped) line += `\n⚠️ Daily limit reached! (Limit: ${DAILY_NX_CAP.toLocaleString()} Nexus/day)`;
  return line;
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

// ── Batch-47: ONE game at a time per games GC ────────────────────
// Returns the running game's label or null. Lazy requires (the engines
// require GameCenter back — top-level would cycle).
function activeGameIn(db, chatId) {
  if (!chatId) return null;
  try {
    const t = slot(db, 'ttt', chatId);
    if (t) return 'Tic-Tac-Toe';
  } catch (e) {}
  try {
    const c = slot(db, 'chess', chatId);
    if (c) return 'Chess';
  } catch (e) {}
  try {
    const TR = require('./TypingRace');
    if (TR.getSession(chatId)) return 'Typing Race';
  } catch (e) {}
  try {
    const HM = require('./Hangman');
    if (HM.getSession(chatId)) return 'Hangman';
  } catch (e) {}
  try {
    const ER = require('./EmojiRiddle');
    if (ER.getSession(chatId)) return 'Emoji Riddle';
  } catch (e) {}
  try {
    const Quiz = require('../../commands/rpg/quiz');
    const sessions = typeof Quiz.getSessions === 'function' ? Quiz.getSessions() : null;
    if (sessions && sessions[chatId]) return 'Anime Quiz';
  } catch (e) {}
  return null;
}

// Send-ready block when another game is already running here.
function gameBusyBlock(gameName) {
  return `❌ A game of *${gameName}* is already running here!\n\nOnly one game at a time — finish it first (or stop it) before starting another.`;
}

// ── Batch-47: no games while in battle ────────────────────────────
// Returns 'PvP' | 'dungeon' | 'gate raid' or null.
function inBattle(db, senderJid) {
  if (!db || !senderJid) return null;
  try {
    const p = db.users?.[senderJid];
    if (p?.pvpBattle) return 'PvP';
    if (p?.dungeon && (p.dungeon.currentBattle || p.dungeon.inDungeon)) return 'dungeon';
  } catch (e) {}
  // Active gate raid membership (live gates + persisted snapshots).
  try {
    const GM = require('../dungeons/GateManager').GateManager || require('../dungeons/GateManager');
    const gates = Object.values((GM && GM.activeGates) || {});
    for (const g of gates) {
      if (g?.raid?.status === 'active' && (g.raid.members || []).some((m) => m.id === senderJid)) return 'gate raid';
    }
  } catch (e) {}
  try {
    for (const g of Object.values(db.activeGates || {})) {
      if (g?.raid?.status === 'active' && (g.raid.members || []).some((m) => m.id === senderJid)) return 'gate raid';
    }
  } catch (e) {}
  return null;
}

function battleBlock(where) {
  return `❌ You're in ${where === 'PvP' ? 'a *PvP battle*' : where === 'dungeon' ? 'a *dungeon*' : 'an active *gate raid*'} — no mini-games until the battle ends!`;
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
  WIN_LEVEL_XP,
  DRAW_LEVEL_XP,
  PASS_XP_MIN,
  PASS_XP_MAX,
  TTT_WIN_NX,
  CHESS_WIN_NX,
  DAILY_NX_CAP,
  gate,
  gateBlock,
  liveGamesLink,
  getTargetJid,
  mentionOf,
  nxEarnedToday,
  rollPassXP,
  grantPassXP,
  grantLevelXP,
  grantNexus,
  awardGame,
  rewardLine,
  bumpStats,
  slot,
  setSlot,
  clearSlot,
  activeGameIn,
  gameBusyBlock,
  inBattle,
  battleBlock,
  sendBoard,
};
