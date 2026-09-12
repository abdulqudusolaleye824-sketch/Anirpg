// Typing Race engine (batch-37): bot posts a sentence, first player to
// retype it EXACTLY (case/spacing lenient, punctuation matters) wins.
// Answers are plain chat — hooked via RPGIntentHandler.checkAnswer.
'use strict';

const SENTENCES = require('../data/typerace_100');
const GC = require('./GameCenter');
const UI = require('../utils/UI');

const ROUND_MS = 60_000;
const BASE_NX = 60;
const FAST_NX = 40;   // win within 10s
const QUICK_NX = 20;  // win within 20s
const WIN_LEVEL_XP = 300; // batch-41: real level XP (Pro 2×)

const sessions = {}; // chatId -> session
const lastIdx = {};  // chatId -> last sentence index (avoid immediate repeats)

// Batch-47: punctuation-lenient match — mobile players never retype
// periods/quotes exactly (proven by live playtest), so only letters,
// numbers and word breaks count. Still a typing-speed game.
function normRace(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function pick(chatId) {
  let i = Math.floor(Math.random() * SENTENCES.length);
  if (SENTENCES.length > 1) {
    let guard = 0;
    while (i === lastIdx[chatId] && guard++ < 10) i = Math.floor(Math.random() * SENTENCES.length);
  }
  lastIdx[chatId] = i;
  return i;
}

function start(chatId, starterJid, send, opts = {}) {
  if (sessions[chatId]) return { error: 'active' };
  const i = pick(chatId);
  const target = SENTENCES[i];
  const s = { idx: i, target, norm: normRace(target), starter: starterJid, startedAt: Date.now(), timer: null, send };
  s.timer = setTimeout(() => {
    if (sessions[chatId] === s) {
      delete sessions[chatId];
      try { send(`⏱️ Time's up! Nobody typed it in time.\n\nThe sentence was:\n_"${target}"_`); } catch (_) {}
    }
  }, opts.ms || ROUND_MS);
  if (s.timer && typeof s.timer.unref === 'function') s.timer.unref();
  sessions[chatId] = s;
  return { text: `⌨️ *TYPING RACE!* First to type this EXACTLY wins:\n\n_"${target}"_\n\n⏱️ 60 seconds — GO!` };
}

// Called for EVERY plain chat message (via RPGIntentHandler). Returns
// { won, text } on a win, null otherwise (chat flows on untouched).
function checkAnswer(db, chatId, sender, text, save) {
  const s = sessions[chatId];
  if (!s) return null;
  if (normRace(text) !== s.norm) return null;
  clearTimeout(s.timer);
  delete sessions[chatId];
  const player = db?.users?.[sender];
  if (!player) {
    return { won: true, text: `🏁 Perfect typing, @${String(sender).split('@')[0]} — but you're not registered! Use */register* to claim race rewards.` };
  }
  const secs = Math.max(1, Math.round((Date.now() - s.startedAt) / 1000));
  const wpm = Math.max(1, Math.round((s.target.length / 5) / (secs / 60)));
  // Batch-41: the three REAL currencies, Pro 2× on all.
  const mult = UI.isPro(player) ? 2 : 1;
  const nx = (BASE_NX + (secs <= 10 ? FAST_NX : secs <= 20 ? QUICK_NX : 0)) * mult;
  const xp = WIN_LEVEL_XP * mult;
  const pass = GC.rollPassXP() * mult;
  const chan = s.send ? { sendMessage: async (jid, content) => { try { await s.send(content.text); } catch (_) {} } } : null;
  GC.grantLevelXP(player, xp, save ? () => save(db) : null, chan, chatId);
  GC.grantPassXP(player, pass);
  GC.grantNexus(player, nx, 'typerace win');
  player.typeraceStats = player.typeraceStats || { wins: 0, bestWpm: 0, nexusEarned: 0 };
  player.typeraceStats.wins += 1;
  player.typeraceStats.nexusEarned += nx;
  if (wpm > (player.typeraceStats.bestWpm || 0)) player.typeraceStats.bestWpm = wpm;
  try { if (save) save(db); } catch (_) {}
  return {
    won: true,
    mention: sender,
    text: `🏁 *RACE WON!* @${String(sender).split('@')[0]} typed it in *${secs}s*!\n\n💨 ${wpm} WPM  |  💠 +${nx} Nexus  |  ⚡ +${xp} XP  |  ✨ +${pass} Pass XP${mult === 2 ? ' (2× Pro 💎)' : ''}`,
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

module.exports = { start, checkAnswer, stop, getSession, clearAll, ROUND_MS, BASE_NX, WIN_LEVEL_XP, _normRace: normRace, _count: SENTENCES.length };
