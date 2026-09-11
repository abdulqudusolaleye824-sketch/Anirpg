// ═══════════════════════════════════════════════════════════════
// Astra — Aviator crash-game engine (shared by /casino aviator + /cashout)
// One live flight per player. The multiplier ticks up via message edits
// that accelerate as it climbs; the crash point is hidden (max 100x,
// 5% of flights soar past 25x). Cash out before the crash to win.
// ═══════════════════════════════════════════════════════════════

'use strict';

const { updatePlayerNexus } = require('./NexusManager');
const { logTransaction } = require('./TransactionLog');
const DC = require('./DailyChallenges');
const { editMessage } = require('../../utils/messageEdit');
const UI = require('./UI');

const flights = new Map();   // sender -> live flight state
const lastCrash = new Map(); // sender -> { mult, at } (for "too late" cashouts)

function genCrashPoint() {
  const r = Math.random();
  let c;
  if (r < 0.05) c = 25 + Math.random() * 75;     // 5%: moonshot 25–100x
  else c = 1 + 24 * Math.pow(Math.random(), 3);  // 95%: 1–25x, skewed low
  return Math.min(100, Math.max(1, Math.floor(c * 100) / 100));
}

function planeFor(mult) {
  if (mult < 2) return '🛫';
  if (mult < 5) return '✈️';
  if (mult < 10) return '🛩️';
  if (mult < 25) return '🚀';
  return '🌙';
}

function barFor(mult) {
  const filled = Math.min(12, Math.max(1, Math.floor(mult)));
  return '🟩'.repeat(filled) + '⬛'.repeat(12 - filled);
}

function liveText(f) {
  const value = Math.floor(f.bet * f.mult);
  return [
    ...(f.pro ? [UI.PRO_BAR, `${planeFor(f.mult)} *AVIATOR* 💎`, UI.PRO_BAR] : [`${planeFor(f.mult)} *AVIATOR*`, UI.FREE_BAR]),
    `${f.playerName}'s flight`,
    `💸 Bet: *${f.bet}* Nexus`,
    `✖️ Multiplier: *${f.mult.toFixed(2)}x*`,
    `💰 Cash-out value: *${value}* Nexus`,
    `${barFor(f.mult)}`,
    ``,
    `Tap 💰 CASH OUT below or type */cashout*!`,
    f.pro ? UI.PRO_BAR : UI.FREE_BAR,
  ].join('\n');
}

function crashedText(f) {
  return [
    ...(f.pro ? [UI.PRO_BAR, `💥 *CRASHED @ ${f.crash.toFixed(2)}x!* 💎`, UI.PRO_BAR] : [`💥 *CRASHED @ ${f.crash.toFixed(2)}x!*`, UI.FREE_BAR]),
    `${f.playerName} lost *${f.bet}* Nexus.`,
    ``,
    `Better luck next flight! ✈️`,
    f.pro ? UI.PRO_BAR : UI.FREE_BAR,
  ].join('\n');
}

function cashedText(f, payout, profit) {
  return [
    ...(f.pro ? [UI.PRO_BAR, `💰 *CASHED OUT @ ${f.cashMult.toFixed(2)}x!* 💎`, UI.PRO_BAR] : [`💰 *CASHED OUT @ ${f.cashMult.toFixed(2)}x!*`, UI.FREE_BAR]),
    `${f.playerName} wins *+${profit}* Nexus! 💸`,
    `💼 Payout: *${payout}* Nexus (bet ${f.bet})`,
    f.pro ? UI.PRO_BAR : UI.FREE_BAR,
  ].join('\n');
}

function ensureCasinoStats(player) {
  if (!player.casino) player.casino = { totalWon: 0, totalLost: 0, gamesPlayed: 0, biggestWin: 0, jackpotsHit: 0 };
}

function getFlight(sender) {
  return flights.get(sender) || null;
}

function lastCrashFor(sender) {
  const c = lastCrash.get(sender);
  if (!c || Date.now() - c.at > 60_000) return null;
  return c;
}

async function pushEdit(sock, flight, text) {
  // Edit the flight message; if the key is gone (or the edit fails),
  // fall back to a fresh message so the flight still resolves visibly.
  if (flight.key) {
    try { await editMessage(sock, flight.chatId, flight.key, text); return; }
    catch (e) { /* fall through to fresh send */ }
  }
  try {
    const sent = await sock.sendMessage(flight.chatId, { text });
    if (sent?.key) flight.key = sent.key;
  } catch (e) { /* last resort: resolve silently */ }
}

function settleCrash(sock, flight, saveDatabase) {
  if (flight.ended) return;
  flight.ended = true;
  flight.crashed = true;
  flight.mult = flight.crash;
  if (flight.timer) clearTimeout(flight.timer);
  flights.delete(flight.sender);
  lastCrash.set(flight.sender, { mult: flight.crash, at: Date.now() });

  const player = flight.player;
  ensureCasinoStats(player);
  player.casino.gamesPlayed++;
  player.casino.totalLost += flight.bet;
  logTransaction(player, { type: 'casino_loss', amount: flight.bet, currency: '💠', note: `aviator -${flight.bet} 💠` });
  DC.trackProgress(player, 'casino_play', 1);
  try { saveDatabase(); } catch (e) {}

  pushEdit(sock, flight, crashedText(flight)).catch(() => {});
}

function settleCashout(sock, flight, saveDatabase) {
  if (flight.ended) return;
  flight.ended = true;
  if (flight.timer) clearTimeout(flight.timer);
  flights.delete(flight.sender);

  const player = flight.player;
  const payout = Math.floor(flight.bet * flight.cashMult);
  const profit = payout - flight.bet;
  ensureCasinoStats(player);
  updatePlayerNexus(player, payout, saveDatabase);
  player.casino.gamesPlayed++;
  if (profit > 0) {
    player.casino.totalWon += profit;
    if (profit > player.casino.biggestWin) player.casino.biggestWin = profit;
    logTransaction(player, { type: 'casino_win', amount: profit, currency: '💠', note: `aviator +${profit} 💠` });
    DC.trackProgress(player, 'casino_win', 1);
    try { require('./BattlePass').addPassXP(player, 'casino_win'); } catch (e) {}
    try { require('../../commands/rpg/weekly').trackWeeklyProgress(player, 'earn_gold', profit); } catch (e) {}
  } else if (profit < 0) {
    player.casino.totalLost += Math.abs(profit);
    logTransaction(player, { type: 'casino_loss', amount: Math.abs(profit), currency: '💠', note: `aviator -${Math.abs(profit)} 💠` });
  }
  DC.trackProgress(player, 'casino_play', 1);
  try { saveDatabase(); } catch (e) {}

  pushEdit(sock, flight, cashedText(flight, payout, profit)).catch(() => {});
}

function tick(sock, flight, saveDatabase) {
  if (flight.ended) return;
  // Cash-out landed between ticks → settle at the last DISPLAYED multiplier
  if (flight.cashed) { settleCashout(sock, flight, saveDatabase); return; }
  // Advance (growth accelerates with altitude)
  flight.mult = Math.floor((flight.mult + 0.05 + flight.mult * 0.045 + Math.random() * 0.04) * 100) / 100;
  if (flight.mult >= flight.crash) { settleCrash(sock, flight, saveDatabase); return; }
  flight.ticks = (flight.ticks || 0) + 1;
  if (flight.ticks > 120) { settleCrash(sock, flight, saveDatabase); return; } // safety cap
  pushEdit(sock, flight, liveText(flight)).catch(() => {});
  // Edit-rate speeds up as the multiplier climbs
  const delay = Math.max(220, Math.floor(1150 - flight.mult * 70));
  flight.timer = setTimeout(() => tick(sock, flight, saveDatabase), delay);
}

async function startFlight({ sock, chatId, sender, bet, player, saveDatabase, quoted }) {
  if (flights.has(sender)) return { ok: false, error: 'already' };
  ensureCasinoStats(player);
  // Deduct the stake upfront (mirrors slots loss handling)
  updatePlayerNexus(player, -bet, saveDatabase);

  const flight = {
    sender, chatId, bet, player,
    playerName: player.name || 'Hunter',
    pro: UI.isPro(player),
    crash: genCrashPoint(),
    mult: 1.0, ticks: 0,
    cashed: false, crashed: false, ended: false,
    cashMult: 0, key: null, timer: null,
  };
  try {
    const sent = await sock.sendMessage(chatId, { text: liveText(flight) }, quoted ? { quoted } : {});
    if (sent?.key) flight.key = sent.key;
  } catch (e) {
    // Couldn't even launch the display — refund and abort
    updatePlayerNexus(player, bet, saveDatabase);
    return { ok: false, error: 'sendfail' };
  }
  flights.set(sender, flight);
  try { saveDatabase(); } catch (e) {}
  flight.timer = setTimeout(() => tick(sock, flight, saveDatabase), 1150);
  return { ok: true };
}

function cashOut(sender) {
  const f = flights.get(sender);
  if (!f || f.ended) return { ok: false, error: 'nofly' };
  if (f.crashed) return { ok: false, error: 'crashed' };
  if (f.cashed) return { ok: false, error: 'cashed' };
  f.cashed = true;
  f.cashMult = f.mult; // last displayed multiplier — what you see is what you get
  return { ok: true, mult: f.mult, payout: Math.floor(f.bet * f.mult) };
}

module.exports = { startFlight, cashOut, getFlight, lastCrashFor, genCrashPoint };
