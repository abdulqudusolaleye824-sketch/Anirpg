'use strict';
// ═══════════════════════════════════════════════════════════════════
// TEAM PVP (Push #96) — up to 5 hunters per side, fought ONE-ON-ONE.
//
//   • /teampvp create           → open a lobby in this group (you lead Team A)
//   • /teampvp join a|b         → join a side (max 5 each)
//   • /teampvp start            → lobby leader starts; first hunter of each side steps in
//   • /pvp attack|skill …       → the ACTIVE hunters fight with the normal duel engine
//   • /teampvp switch <n>       → OPTIONAL: swap your side's active hunter (uses the turn)
//   • knock-out                 → the next hunter on that side steps in automatically
//   • last team standing wins   → every member's team record (wins/losses) is updated
//
// The duel engine (commands/rpg/pvp.js resolveTurn / handlePvpVictory /
// surrender) calls `onKnockout` whenever a fighter whose pvpBattle carries a
// `teamBattleId` goes down, so all duel rules (statuses, skills, jobs,
// domains, timeouts) apply unchanged.
// ═══════════════════════════════════════════════════════════════════
const MAX_PER_TEAM = 5;
const LOBBY_TTL_MS = 10 * 60 * 1000;
const TURN_MS = 20000;
const HANDICAP_PCT_PER_MISSING = 15; // outnumbered side: +15% ATK & DEF per missing hunter (handicap matches only)

const lobbies = new Map();  // chatId → lobby
const battles = new Map();  // battleId → battle
let _seq = 0;

function bare(j) { return String(j || '').split('@')[0].split(':')[0]; }
function nameOf(db, jid) { const p = db && db.users && db.users[jid]; return (p && p.name) || bare(jid); }
function ensureRecord(p) { if (!p.teamPvp || typeof p.teamPvp !== 'object') p.teamPvp = { wins: 0, losses: 0, kos: 0 }; return p.teamPvp; }

function lobbyOf(chatId) {
  const l = lobbies.get(chatId);
  if (l && Date.now() - l.createdAt > LOBBY_TTL_MS && !l.battleId) { lobbies.delete(chatId); return null; }
  return l || null;
}
function battleOfPlayer(jid) {
  for (const b of battles.values()) if (b.A.members.includes(jid) || b.B.members.includes(jid)) return b;
  return null;
}
function inAnyTeam(jid) {
  for (const l of lobbies.values()) if (l.A.includes(jid) || l.B.includes(jid)) return l;
  return null;
}

function create(chatId, jid) {
  if (lobbyOf(chatId)) return { ok: false, error: 'A team battle lobby is already open here — /teampvp join a|b.' };
  if (inAnyTeam(jid) || battleOfPlayer(jid)) return { ok: false, error: 'You are already in a team battle.' };
  const l = { chatId, leader: jid, A: [jid], B: [], createdAt: Date.now(), battleId: null, handicap: false };
  lobbies.set(chatId, l);
  return { ok: true, lobby: l };
}
function join(chatId, jid, side) {
  const l = lobbyOf(chatId); if (!l) return { ok: false, error: 'No open lobby — /teampvp create first.' };
  if (l.battleId) return { ok: false, error: 'That battle already started.' };
  const s = String(side || '').toUpperCase(); if (s !== 'A' && s !== 'B') return { ok: false, error: 'Pick a side: /teampvp join a  or  /teampvp join b' };
  if (l.A.includes(jid) || l.B.includes(jid)) return { ok: false, error: 'You already joined this lobby.' };
  if (inAnyTeam(jid) || battleOfPlayer(jid)) return { ok: false, error: 'You are already in another team battle.' };
  if (l[s].length >= MAX_PER_TEAM) return { ok: false, error: `Team ${s} is full (${MAX_PER_TEAM}).` };
  l[s].push(jid);
  return { ok: true, lobby: l, side: s };
}
function leave(chatId, jid) {
  const l = lobbyOf(chatId); if (!l || l.battleId) return { ok: false, error: 'No open lobby to leave.' };
  l.A = l.A.filter(j => j !== jid); l.B = l.B.filter(j => j !== jid);
  if (l.leader === jid) { if (l.A.length) l.leader = l.A[0]; else if (l.B.length) l.leader = l.B[0]; else lobbies.delete(chatId); }
  return { ok: true, lobby: lobbies.get(chatId) || null };
}
// Handicap matches: uneven teams allowed; the outnumbered side is boosted per missing hunter.
function setHandicap(chatId, jid, on) {
  const l = lobbyOf(chatId); if (!l) return { ok: false, error: 'No open lobby — /teampvp create first.' };
  if (l.battleId) return { ok: false, error: 'That battle already started.' };
  if (l.leader !== jid) return { ok: false, error: 'Only the lobby leader can toggle handicap.' };
  l.handicap = !!on; return { ok: true, lobby: l };
}
function handicapPct(b, side) { const other = side === 'A' ? 'B' : 'A'; const miss = b[other].members.length - b[side].members.length; return b.handicap && miss > 0 ? miss * HANDICAP_PCT_PER_MISSING : 0; }
function cancel(chatId) { const l = lobbies.get(chatId); if (l && !l.battleId) lobbies.delete(chatId); return !!l; }

function lobbyText(l, db) {
  const side = (arr) => arr.length ? arr.map((j, i) => `  ${i + 1}. ${nameOf(db, j)}`).join('\n') : '  _(empty)_';
  return [`🅰️ *TEAM A* (${l.A.length}/${MAX_PER_TEAM})`, side(l.A), ``, `🅱️ *TEAM B* (${l.B.length}/${MAX_PER_TEAM})`, side(l.B), ``, l.handicap ? `⚖️ Handicap: *ON* — uneven teams allowed, outnumbered side +${HANDICAP_PCT_PER_MISSING}% ATK/DEF per missing hunter` : `⚖️ Handicap: off — teams must be equal (/teampvp handicap on)`].join('\n');
}

// Start the battle: first hunter of each side steps in.
function start(chatId, jid, db) {
  const l = lobbyOf(chatId); if (!l) return { ok: false, error: 'No open lobby — /teampvp create first.' };
  if (l.leader !== jid) return { ok: false, error: `Only the lobby leader (${nameOf(db, l.leader)}) can start.` };
  if (!l.A.length || !l.B.length) return { ok: false, error: 'Both teams need at least one hunter.' };
  if (!l.handicap && l.A.length !== l.B.length) return { ok: false, error: `Teams are uneven (${l.A.length} v ${l.B.length}). Even them out, or let the leader allow it: */teampvp handicap on*.` };
  for (const j of [...l.A, ...l.B]) {
    const p = db.users[j];
    if (!p) return { ok: false, error: `${bare(j)} is not registered.` };
    if (p.pvpBattle) return { ok: false, error: `${p.name || bare(j)} is already in a duel.` };
    if ((p.stats && p.stats.hp || 0) <= 0) return { ok: false, error: `${p.name || bare(j)} has no HP — heal first.` };
  }
  const id = `tb${Date.now().toString(36)}${(++_seq).toString(36)}`;
  const b = {
    id, chatId, startedAt: Date.now(), turn: 1, handicap: !!l.handicap,
    A: { members: [...l.A], fallen: [], active: l.A[0] },
    B: { members: [...l.B], fallen: [], active: l.B[0] },
  };
  battles.set(id, b); l.battleId = id;
  _arm(b, 'A', b.A.active, b.B.active, db, 1, null);
  _arm(b, 'B', b.B.active, b.A.active, db, 1, null);
  return { ok: true, battle: b };
}

function _arm(b, side, jid, oppJid, db, turn, pending) {
  const p = db.users[jid]; if (!p) return;
  p.pvpBattle = { opponentId: oppJid, turn, pendingAction: pending || null, teamBattleId: b.id, teamSide: side, turnExpiresAt: Date.now() + TURN_MS };
  const hp = handicapPct(b, side);
  if (hp > 0) { if (!p.tempBuffs) p.tempBuffs = {}; p.tempBuffs['Handicap:atk'] = { stat: 'atk', amount: hp, duration: 999 }; p.tempBuffs['Handicap:def'] = { stat: 'def', amount: hp, duration: 999 }; }
  try { require('./RegenManager').markCombatAction(p); } catch (e) {}
}
function sideOf(b, jid) { if (b.A.members.includes(jid)) return 'A'; if (b.B.members.includes(jid)) return 'B'; return null; }
function benchOf(b, side) { return b[side].members.filter(j => j !== b[side].active && !b[side].fallen.includes(j)); }

// OPTIONAL switch: the active hunter (or any teammate, if the active one is
// AFK) swaps in bench hunter #n. Switching is the side's action this turn.
function switchActive(chatId, jid, n, db) {
  const b = battleOfPlayer(jid); if (!b || b.chatId !== chatId) return { ok: false, error: 'You are not in a team battle here.' };
  const side = sideOf(b, jid); const cur = db.users[b[side].active];
  if (cur && cur.pvpBattle && cur.pvpBattle.pendingAction) return { ok: false, error: `${cur.name || 'Your fighter'} already locked in this turn — switch next turn.` };
  const bench = benchOf(b, side);
  if (!bench.length) return { ok: false, error: 'Nobody is left on your bench.' };
  const idx = parseInt(n, 10) - 1;
  const next = bench[idx]; if (!next) return { ok: false, error: `Pick a bench hunter 1-${bench.length}:\n${bench.map((j, i) => `${i + 1}. ${nameOf(db, j)}`).join('\n')}` };
  const other = side === 'A' ? 'B' : 'A';
  const oppJid = b[other].active; const opp = db.users[oppJid];
  const turn = (cur && cur.pvpBattle && cur.pvpBattle.turn) || (opp && opp.pvpBattle && opp.pvpBattle.turn) || b.turn || 1;
  if (cur) { cur.pvpBattle = null; }
  b[side].active = next;
  _arm(b, side, next, oppJid, db, turn, { type: 'attack', arg: null, _skip: true, _cc: 'switching in' });
  if (opp && opp.pvpBattle) opp.pvpBattle.opponentId = next;
  return { ok: true, battle: b, side, from: b[side].members.includes(jid) ? (cur ? (cur.name || bare(jid)) : bare(jid)) : bare(jid), prev: cur, next: db.users[next], nextJid: next, opp, oppJid, oppLocked: !!(opp && opp.pvpBattle && opp.pvpBattle.pendingAction) };
}

function status(chatId, db) {
  const l = lobbyOf(chatId);
  const b = l && l.battleId ? battles.get(l.battleId) : null;
  if (b) return { battle: b, text: battleText(b, db) };
  if (l) return { lobby: l, text: lobbyText(l, db) };
  return null;
}
function battleText(b, db) {
  const line = (side) => {
    const s = b[side];
    return s.members.map(j => {
      const p = db.users[j]; const hp = p && p.stats ? `${Math.max(0, p.stats.hp)}/${p.stats.maxHp}` : '?';
      const tag = s.fallen.includes(j) ? '💀' : (s.active === j ? '⚔️' : '🪑');
      return `  ${tag} ${nameOf(db, j)} — ${hp} HP`;
    }).join('\n');
  };
  return [...(b.handicap ? [`⚖️ *HANDICAP MATCH* ${b.A.members.length} v ${b.B.members.length}` + (handicapPct(b, 'A') ? ` — Team A +${handicapPct(b, 'A')}% ATK/DEF` : handicapPct(b, 'B') ? ` — Team B +${handicapPct(b, 'B')}% ATK/DEF` : ''), ``] : []), `🅰️ *TEAM A* — ${b.A.members.length - b.A.fallen.length} standing`, line('A'), ``, `🅱️ *TEAM B* — ${b.B.members.length - b.B.fallen.length} standing`, line('B'), ``, `⚔️ active · 🪑 bench · 💀 fallen`, `/pvp attack · /pvp skill <name> · /teampvp switch <n>`].join('\n');
}

// Called by the duel engine when a team fighter is knocked out / surrenders.
// Returns true when handled (the caller must NOT run normal duel victory).
async function onKnockout(sock, chatId, winner, loser, wId, lId, db, saveDatabase, lastText) {
  const b = battles.get((loser.pvpBattle && loser.pvpBattle.teamBattleId) || (winner.pvpBattle && winner.pvpBattle.teamBattleId));
  if (!b) return false;
  const lSide = sideOf(b, lId) || (loser.pvpBattle && loser.pvpBattle.teamSide); const wSide = lSide === 'A' ? 'B' : 'A';
  if (!lSide) return false;
  const turn = (winner.pvpBattle && winner.pvpBattle.turn) || b.turn || 1;
  if (!b[lSide].fallen.includes(lId)) b[lSide].fallen.push(lId);
  ensureRecord(winner).kos += 1;
  loser.pvpBattle = null;
  _cleanup(loser);
  try { require('./RegenManager').endCombat(loser); } catch (e) {}
  const bench = benchOf(b, lSide);
  if (bench.length) {
    const next = bench[0];
    b[lSide].active = next;
    if (winner.pvpBattle) { winner.pvpBattle.opponentId = next; winner.pvpBattle.pendingAction = null; winner.pvpBattle.turn = turn + 1; winner.pvpBattle.turnExpiresAt = Date.now() + TURN_MS; }
    _arm(b, lSide, next, wId, db, turn + 1, null);
    b.turn = turn + 1;
    saveDatabase();
    const nextP = db.users[next];
    await sock.sendMessage(chatId, { text: [`💀 *${loser.name || bare(lId)}* is down! (Team ${lSide}: ${b[lSide].members.length - b[lSide].fallen.length} left)`, ``, `🔁 *${(nextP && nextP.name) || bare(next)}* steps in for Team ${lSide}!`, `❤️ ${nextP && nextP.stats ? `${nextP.stats.hp}/${nextP.stats.maxHp}` : '?'} HP vs *${winner.name || bare(wId)}* ${winner.stats ? `${winner.stats.hp}/${winner.stats.maxHp}` : ''} HP`, ``, `@${bare(next)} @${bare(wId)} — /pvp attack or /pvp skill <name> (20s)`].join('\n'), mentions: [next, wId] });
    return true;
  }
  // Team wiped → battle over.
  await finish(sock, chatId, b, wSide, db, saveDatabase);
  return true;
}

function _cleanup(p) {
  if (!p) return;
  try { const TF = require('./Transformation'); if (p.transform) TF.end(p, false, false); } catch (e) {}
  p.statusEffects = []; p.tempBuffs = {}; p.buffs = []; p.attackCooldowns = {};
  if (p.skills && p.skills.cooldowns) p.skills.cooldowns = {};
  if (p.skillCooldowns) p.skillCooldowns = {};
  if (p.stats && p.stats.hp > (p.stats.maxHp || 0)) p.stats.hp = p.stats.maxHp;
}

async function finish(sock, chatId, b, wSide, db, saveDatabase) {
  const lSide = wSide === 'A' ? 'B' : 'A';
  battles.delete(b.id);
  const l = lobbies.get(b.chatId); if (l && l.battleId === b.id) lobbies.delete(b.chatId);
  const rewardLines = [];
  for (const j of b[wSide].members) {
    const p = db.users[j]; if (!p) continue;
    const r = ensureRecord(p); r.wins += 1; r.streak = (r.streak || 0) + 1;
    p.pvpBattle = null; _cleanup(p);
    try { require('./RegenManager').endCombat(p); } catch (e) {}
    try { const BR = require('./BattleRewards'); const rr = BR.giveBattleWinRewards(p, db, 'pvp', p.level || 1, sock, chatId, {}); if (rr) rewardLines.push(`• ${p.name || bare(j)}: +${rr.xp} XP · +${rr.aura} aura${rr.jobXp ? ` · +${rr.jobXp} Job XP` : ''}`); } catch (e) {}
    try { require('./QuestDispatcher').trackAndNotify(p, 'pvp', 1, sock, j, chatId); } catch (e) {}
  }
  for (const j of b[lSide].members) {
    const p = db.users[j]; if (!p) continue;
    const r = ensureRecord(p); r.losses += 1; r.streak = 0;
    p.pvpBattle = null; _cleanup(p);
    try { require('./RegenManager').endCombat(p); } catch (e) {}
  }
  saveDatabase();
  const roster = (side) => b[side].members.map(j => `${b[side].fallen.includes(j) ? '💀' : '🛡️'} ${nameOf(db, j)} (${ensureRecord(db.users[j] || {}).wins}W-${ensureRecord(db.users[j] || {}).losses}L)`).join('\n');
  await sock.sendMessage(chatId, { text: [`━━━━━━━━━━━━━━━━━━━━━━━━━━━`, `🏆 *TEAM BATTLE OVER — TEAM ${wSide} WINS!*`, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`, `👑 *Team ${wSide}*`, roster(wSide), ``, `💀 *Team ${lSide}*`, roster(lSide), ``, `⏱️ ${Math.max(1, Math.round((Date.now() - b.startedAt) / 60000))} min · ${b.turn} turns`, ...(rewardLines.length ? [``, `🎁 *Rewards*`, ...rewardLines] : []), ``, `📊 Team records updated — /teampvp record`].join('\n'), mentions: [...b.A.members, ...b.B.members] });
}

// A whole team battle can be abandoned by its members (all agree = leader of either side).
async function abandon(sock, chatId, jid, db, saveDatabase) {
  const b = battleOfPlayer(jid); if (!b || b.chatId !== chatId) return { ok: false, error: 'You are not in a team battle here.' };
  const side = sideOf(b, jid); const other = side === 'A' ? 'B' : 'A';
  await sock.sendMessage(chatId, { text: `🏳️ *${nameOf(db, jid)}* forfeits for Team ${side}!` });
  await finish(sock, chatId, b, other, db, saveDatabase);
  return { ok: true };
}

function recordText(p) { const r = ensureRecord(p); const t = r.wins + r.losses; return `🤝 *TEAM PVP RECORD*\n🏆 Wins: ${r.wins}\n💀 Losses: ${r.losses}\n👊 Knock-outs: ${r.kos || 0}\n🔥 Streak: ${r.streak || 0}\n📈 Win rate: ${t ? Math.round(r.wins / t * 100) : 0}%`; }

module.exports = { MAX_PER_TEAM, HANDICAP_PCT_PER_MISSING, setHandicap, handicapPct, create, join, leave, cancel, start, switchActive, status, onKnockout, abandon, recordText, lobbyText, battleText, battleOfPlayer, lobbyOf, ensureRecord, _battles: battles, _lobbies: lobbies };
