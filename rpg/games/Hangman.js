// Hangman engine (batch-37): classic letter guessing, anime word bank.
// Sessions live here (shared by /hangman + /hang).
'use strict';

const WORDS = require('../data/hangman_100');
const GC = require('./GameCenter');
const UI = require('../utils/UI');

const ROUND_MS = 5 * 60_000;
const MAX_WRONG = 6;
const BASE_NX = 100;
const LIFE_BONUS_NX = 15;
const WIN_LEVEL_XP = 300; // batch-41: real level XP (Pro 2×)

const STAGES = [
  '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```',
];

const sessions = {}; // chatId -> session
const lastWord = {}; // chatId -> last word (avoid immediate repeats)

function pick(chatId) {
  let w = WORDS[Math.floor(Math.random() * WORDS.length)];
  if (WORDS.length > 1) {
    let guard = 0;
    while (w === lastWord[chatId] && guard++ < 10) w = WORDS[Math.floor(Math.random() * WORDS.length)];
  }
  lastWord[chatId] = w;
  return w;
}

function masked(word, good) {
  return word.split('').map((c) => (good.has(c) ? c : '_')).join(' ');
}

function board(s) {
  const lives = MAX_WRONG - s.bad.length;
  return [
    STAGES[s.bad.length],
    ``,
    `🔤 ${masked(s.word, s.good)}`,
    s.bad.length ? `❌ Wrong: ${s.bad.join(', ')}` : `❌ Wrong: none yet`,
    `❤️ Lives: ${lives}/${MAX_WRONG}`,
  ].join('\n');
}

function start(chatId, starterJid, send, opts = {}) {
  if (sessions[chatId]) return { error: 'active' };
  const word = pick(chatId);
  const s = { word, good: new Set(), bad: [], starter: starterJid, startedAt: Date.now(), timer: null, send };
  s.timer = setTimeout(() => {
    if (sessions[chatId] === s) {
      delete sessions[chatId];
      try { send(`⏱️ Hangman timed out! The word was *${word}*.`); } catch (_) {}
    }
  }, opts.ms || ROUND_MS);
  if (s.timer && typeof s.timer.unref === 'function') s.timer.unref();
  sessions[chatId] = s;
  return { text: `🎪 *HANGMAN* — guess with /hang <letter>\n\n${board(s)}` };
}

function guessLetter(db, save, chatId, sender, senderName, raw) {
  const s = sessions[chatId];
  if (!s) return null;
  const player = db?.users?.[sender];
  if (!player) return { text: `You're not registered yet! Use */register* to play.` };
  const letter = String(raw || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (letter.length !== 1) return { text: `❌ Usage: /hang <letter>\n\n${board(s)}` };
  if (s.good.has(letter) || s.bad.includes(letter)) {
    return { text: `⚠️ *${letter}* was already tried!\n\n${board(s)}` };
  }
  if (s.word.includes(letter)) {
    s.good.add(letter);
    const solved = s.word.split('').every((c) => s.good.has(c));
    if (!solved) return { text: `✅ *${letter}* is in the word!\n\n${board(s)}` };
    clearTimeout(s.timer);
    delete sessions[chatId];
    const livesLeft = MAX_WRONG - s.bad.length;
    // Batch-41: the three REAL currencies, Pro 2× on all.
    const mult = UI.isPro(player) ? 2 : 1;
    const nx = (BASE_NX + LIFE_BONUS_NX * livesLeft) * mult;
    const xp = WIN_LEVEL_XP * mult;
    const pass = GC.rollPassXP() * mult;
    const chan = s.send ? { sendMessage: async (jid, content) => { try { await s.send(content.text); } catch (_) {} } } : null;
    GC.grantLevelXP(player, xp, save ? () => save(db) : null, chan, chatId);
    GC.grantPassXP(player, pass);
    GC.grantNexus(player, nx, 'hangman win');
    player.hangmanStats = player.hangmanStats || { wins: 0, nexusEarned: 0 };
    player.hangmanStats.wins += 1;
    player.hangmanStats.nexusEarned += nx;
    try { if (save) save(db); } catch (_) {}
    return {
      won: true,
      mention: sender,
      text: `🎉 *SOLVED!* @${String(sender).split('@')[0]} completed *${s.word}* with ${livesLeft} ${livesLeft === 1 ? 'life' : 'lives'} left!\n\n💠 +${nx} Nexus  |  ⚡ +${xp} XP  |  ✨ +${pass} Pass XP${mult === 2 ? ' (2× Pro 💎)' : ''}`,
    };
  }
  s.bad.push(letter);
  if (s.bad.length >= MAX_WRONG) {
    clearTimeout(s.timer);
    delete sessions[chatId];
    return { text: `💀 *GAME OVER!* No lives left.\n\nThe word was *${s.word}*.\n\n${STAGES[MAX_WRONG]}` };
  }
  return { text: `❌ *${letter}* is NOT in the word.\n\n${board(s)}` };
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
  for (const k of Object.keys(lastWord)) delete lastWord[k];
}

module.exports = { start, guessLetter, stop, getSession, clearAll, board, ROUND_MS, MAX_WRONG, BASE_NX, WIN_LEVEL_XP, _count: WORDS.length };
