// Emoji Riddle engine (batch-37): guess the anime/manhwa from emoji.
// Sessions live here (shared by /emoji + /guess). English + Japanese
// answers both accepted via normalized alias matching.
'use strict';

const DATA = require('../data/emoji_riddle_100');
const GC = require('./GameCenter');
const UI = require('../utils/UI');

const ROUND_MS = 90_000;
const WIN_NX = 40;
const WIN_LEVEL_XP = 300; // batch-41: real level XP (Pro 2×)

const sessions = {}; // chatId -> session
const lastIdx = {};  // chatId -> last riddle index (avoid immediate repeats)

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function pick(chatId) {
  let i = Math.floor(Math.random() * DATA.length);
  if (DATA.length > 1) {
    let guard = 0;
    while (i === lastIdx[chatId] && guard++ < 10) i = Math.floor(Math.random() * DATA.length);
  }
  lastIdx[chatId] = i;
  return i;
}

function start(chatId, starterJid, send, opts = {}) {
  if (sessions[chatId]) return { error: 'active' };
  const i = pick(chatId);
  const e = DATA[i];
  const norms = new Set([norm(e.answer), ...(e.aliases || []).map(norm)].filter(Boolean));
  const s = { idx: i, emoji: e.emoji, answer: e.answer, norms, starter: starterJid, startedAt: Date.now(), timer: null, send };
  s.timer = setTimeout(() => {
    if (sessions[chatId] === s) {
      delete sessions[chatId];
      try { send(`⏱️ Time's up! Nobody got it — the answer was *${e.answer}*.`); } catch (_) {}
    }
  }, opts.ms || ROUND_MS);
  if (s.timer && typeof s.timer.unref === 'function') s.timer.unref();
  sessions[chatId] = s;
  return { emoji: e.emoji };
}

function guess(db, save, chatId, sender, senderName, text) {
  const s = sessions[chatId];
  if (!s) return null;
  const player = db?.users?.[sender];
  if (!player) return { text: `You're not registered yet! Use */register* to play.` };
  if (!norm(text)) return { text: `❌ Guess what? Usage: /guess <anime name>` };
  if (!s.norms.has(norm(text))) {
    return { text: `❌ Nope, *${player.name || senderName || 'hunter'}*! Try again — ${s.emoji}` };
  }
  clearTimeout(s.timer);
  delete sessions[chatId];
  // Batch-41: the three REAL currencies, Pro 2× on all.
  const mult = UI.isPro(player) ? 2 : 1;
  const nx = WIN_NX * mult;
  const xp = WIN_LEVEL_XP * mult;
  const pass = GC.rollPassXP() * mult;
  const chan = s.send ? { sendMessage: async (jid, content) => { try { await s.send(content.text); } catch (_) {} } } : null;
  GC.grantLevelXP(player, xp, save ? () => save(db) : null, chan, chatId);
  GC.grantPassXP(player, pass);
  GC.grantNexus(player, nx, 'emoji win');
  player.emojiStats = player.emojiStats || { wins: 0, nexusEarned: 0 };
  player.emojiStats.wins += 1;
  player.emojiStats.nexusEarned += nx;
  try { if (save) save(db); } catch (_) {}
  return {
    won: true,
    mention: sender,
    text: `🎉 *CORRECT!* @${String(sender).split('@')[0]} guessed *${s.answer}*!\n\n💠 +${nx} Nexus  |  ⚡ +${xp} XP  |  ✨ +${pass} Pass XP${mult === 2 ? ' (2× Pro 💎)' : ''}`,
  };
}

function stop(chatId) {
  const s = sessions[chatId];
  if (!s) return null;
  clearTimeout(s.timer);
  delete sessions[chatId];
  return s;
}

function getSession(chatId) { return sessions[chatId] || null; }
function clearAll() {
  for (const k of Object.keys(sessions)) { try { clearTimeout(sessions[k].timer); } catch (_) {} delete sessions[k]; }
  for (const k of Object.keys(lastIdx)) delete lastIdx[k];
}

module.exports = { start, guess, stop, getSession, clearAll, ROUND_MS, WIN_NX, WIN_LEVEL_XP, _norm: norm, _count: DATA.length };
