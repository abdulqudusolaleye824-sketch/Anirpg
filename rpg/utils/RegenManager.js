'use strict';

/**
 * ═══════════════════════════════════════════════════════════════
 * REGEN MANAGER & COMBAT STATE
 * ═══════════════════════════════════════════════════════════════
 * - Central check for active battles (PvP, Boss, Gate Raid, Dungeon)
 * - Out-of-battle passive HP regeneration based on rank:
 *     E Rank: 1 HP/sec
 *     D Rank: 3 HP/sec
 *     C Rank: 5 HP/sec
 *     B Rank: 7 HP/sec
 *     A Rank: 10 HP/sec
 *     S Rank (and above): 20 HP/sec
 * ═══════════════════════════════════════════════════════════════
 */

// Push #96h-z20: a battle record is only "live" for so long. Abandoned / orphaned state (a solo fight nobody
// finished, a PvP challenge from last night, a wiped raid still listing a member) used to lock hunters out of
// the shop and tell them they were "in a raid" forever. Stale records are cleared, not honoured.
const STALE_SOLO_MS = 45 * 60e3, STALE_PVP_MS = 30 * 60e3, STALE_RAID_MS = 3 * 3600e3;
function _age(rec) { if (!rec || typeof rec !== 'object') return 0; const t = Number(rec.lastActionAt || rec.lastTurnAt || rec.updatedAt || rec.startedAt || rec.createdAt || rec.timestamp || rec.at || rec._firstSeenAt) || 0; if (!t) { try { rec._firstSeenAt = Date.now(); } catch (e) {} return 0; } return Date.now() - t; } // Push #96h-z21: undated records age from first sight

function checkInBattle(player, db) {
  if (!player) return null;
  const pId = player.id || player.jid;
  const _bare = String(pId || '').split(':')[0].split('@')[0];
  const _me = (j) => j === pId || String(j || '').split(':')[0].split('@')[0] === _bare || !!(db && db.lidMap && db.lidMap[String(j || '').split(':')[0].split('@')[0]] === _bare);

  // Push #97: instance dungeons / labyrinth — "not on this realm"
  if (player.instance && player.instance.active) return { type: 'instance', battle: player.instance };
  if (player.labyrinth && player.labyrinth.active) return { type: 'labyrinth', battle: player.labyrinth };

  // Solo dungeon battle
  if (player.dungeon?.currentBattle) {
    const b = player.dungeon.currentBattle;
    if (_age(b) > STALE_SOLO_MS || (b.monster && b.monster.hp <= 0 && !b.monster.alive)) player.dungeon.currentBattle = null;
    else return { type: 'dungeon_solo', battle: b };
  }

  // Boss battle
  if (player.boss?.currentBattle || player.currentBossBattle) {
    const b = player.boss?.currentBattle || player.currentBossBattle;
    if (_age(b) > STALE_SOLO_MS) { if (player.boss) player.boss.currentBattle = null; player.currentBossBattle = null; }
    else return { type: 'boss', battle: b };
  }

  // PvP battle
  if (player.pvpBattle) {
    if (_age(player.pvpBattle) > STALE_PVP_MS) player.pvpBattle = null;
    else return { type: 'pvp', battle: player.pvpBattle };
  }

  if (db?.pendingChallenges) {
    for (const [k, c] of Object.entries(db.pendingChallenges)) {
      if (!c || !c.active || !(_me(c.challenger) || _me(c.target))) continue;
      if (_age(c) > STALE_PVP_MS) { delete db.pendingChallenges[k]; continue; }
      return { type: 'pvp', battle: c };
    }
  }

  // Gate Raid — only a raid that is actually running counts.
  try {
    const { GateManager } = require('../dungeons/GateManager');
    for (const gate of Object.values(GateManager.activeGates || {})) {
      if (!gate || gate.cleared || gate.broken || gate.wiped || gate.active === false) continue;
      const raid = gate.raid;
      if (!raid || !/^(recruiting|active)$/.test(String(raid.status || ''))) continue;
      if (raid.status === 'active' && _age(raid) > STALE_RAID_MS) continue;
      // Push #96h-z21: a lobby that never started does not lock the shop (recruiting > 30 min = abandoned);
      // a raid whose every member is dead is over, whatever its status says.
      if (raid.status === 'recruiting' && _age(raid) > STALE_PVP_MS) continue;
      if (raid.status === 'active' && (raid.members || []).length && (raid.members || []).every(m => m && Number(m.hp) <= 0)) continue;
      if ((raid.members || []).some(m => m && _me(m.id)) || (gate.raiders || []).some(r => _me(r))) {
        return { type: 'gateraid', battle: gate };
      }
    }
  } catch (_) {}

  // Party Dungeon
  if (db?.parties) {
    const party = Object.values(db.parties).find(p => p && (p.members || []).some(m => _me(typeof m === 'object' ? (m.id || m.jid) : m)));
    if (party && db.partyBattles?.[party.id]) {
      const pb = db.partyBattles[party.id];
      // Push #96h-z21: a party battle nobody has touched for 45 min is dead state — drop it instead of locking everyone out.
      if (_age(pb) > STALE_SOLO_MS || pb.ended || pb.finished || pb.status === 'ended') { delete db.partyBattles[party.id]; }
      else return { type: 'dungeon_party', battle: pb };
    }
  }

  return null;
}

// Out-of-battle HP regeneration, per second.
function getRegenRate(rank) {
  const r = String(rank || 'E').toUpperCase().trim();
  switch (r) {
    case 'E': return 1;
    case 'D': return 3;
    case 'C': return 5;
    case 'B': return 7;
    case 'A': return 10;
    case 'S':
    case 'SS':
    case 'NATIONAL':
    case 'BEYOND': return 20;
    default: return 1;
  }
}

// Out-of-battle ENERGY refill, per second — the requested ladder. Energy has
// no potion any more (energy potions scrapped), so this is the only way back:
//   E 2/s · D 3/s · C 4/s · B 5/s · A 8/s · S 10/s
// Push #103b ("harsher energy"): halved — E 1/s · D 1.5/s · C 2/s · B 2.5/s · A 4/s · S 5/s.
function getEnergyRegenRate(rank) {
  const r = String(rank || 'E').toUpperCase().trim();
  switch (r) {
    case 'E': return 1;
    case 'D': return 1.5;
    case 'C': return 2;
    case 'B': return 2.5;
    case 'A': return 4;
    case 'S':
    case 'SS':
    case 'NATIONAL':
    case 'BEYOND': return 5;
    default: return 1;
  }
}
// Push #103f: IN-BATTLE energy regen is TIME based, by Hunter Rank — per 10 s:  E 5 · D 7 · C 10 · B 12 · A 15 · S 30.
// Credited whenever the hunter acts (attack / skill / item) from the seconds elapsed since their last battle action
// (max 60 s per credit, fractional carry kept). Starts counting from the first action of the fight.
const BATTLE_ENERGY_PER_10S = { E: 5, D: 7, C: 10, B: 12, A: 15, S: 30, SS: 30, NATIONAL: 30, BEYOND: 30, F: 5 };
function battleEnergyRate(rank) { return BATTLE_ENERGY_PER_10S[String(rank || 'E').toUpperCase()] || 5; }
function raidTurnEnergy(player, now = Date.now()) {
  if (!player || !player.stats) return 0;
  const rate = battleEnergyRate(player.awakenRank);
  let last = Number(player._battleEnergyAt) || 0;
  // Push #103j (owner): a Domain Expansion pauses battle regen for 10 s — nothing accrues inside the pause.
  const pause = Number(player._battleEnergyPauseUntil) || 0;
  if (pause && now < pause) { player._battleEnergyAt = now; return 0; }
  if (pause) { if (last && last < pause) last = pause; player._battleEnergyPauseUntil = 0; }
  player._battleEnergyAt = now;
  if (!last || now <= last) return 0;
  const secs = Math.min(60, (now - last) / 1000);
  const raw = secs * rate / 10 + (Number(player._battleEnergyFrac) || 0);
  const gain = Math.floor(raw); player._battleEnergyFrac = raw - gain;
  if (gain <= 0) return 0;
  const maxEn = Number(player.stats.maxEnergy) || 100;
  const before = Number(player.stats.energy) || 0;
  player.stats.energy = Math.min(maxEn, before + gain);
  return player.stats.energy - before;
}

// How long after a fight ends nothing regenerates. Without this, the moment a
// PvP duel or gate raid flips to "not in battle" the elapsed-time maths hands
// the player a giant instant recovery — that is the "instant regeneration
// after gates and pvp" symptom. Regen resumes only after this window.
const POST_COMBAT_LOCK_MS = Number(process.env.REGEN_LOCK_MS || 60 * 1000);
// A single tick may never credit more than this many seconds of recovery, so a
// restart / long idle cannot dump an hour of regen at once and top someone up
// from 1 HP to full in one step.
// Push #96h-t: the old 30 s cap meant an E-rank gained 30 HP per command and
// gear-boosted pools (thousands of HP) NEVER refilled outside raids. The post-
// combat lock above already stops the "instant heal after a fight" symptom, so
// idle time now counts for up to 6 hours — step away and you come back full.
const MAX_CATCHUP_SEC = Number(process.env.REGEN_CATCHUP_SEC || 6 * 3600);

function markCombatAction(player) {
  if (!player || !player.stats) return;
  player.lastRegenTime = Date.now();
  player.lastEnergyRegenTime = Date.now();
}

/**
 * Called when a battle ENDS: starts the no-regen grace window and pins the
 * clocks to now, so recovery resumes from the rank rate afterwards instead of
 * paying out everything that accrued while the fight was running.
 */
function endCombat(player, ms) {
  if (!player) return;
  delete player._battleEnergyAt; delete player._battleEnergyFrac; // Push #103f: battle regen clock resets per fight
  delete player._reviveUsedFight; // Push #103k (BUG-158): revive-on-death passive is per fight
  try { require('./ClassPower').clearBloodDebt(player); } catch (e) {} // Push #96h-t: Blood Debt is paid when the fight ends
  try { require('./Summons').clear(player); } catch (e) {} // Push #103b: summons/possession never outlive the fight
  try { require('./Transformation').clearFightUse(player); } catch (e) {} // Push #103b: one transformation per fight
  try { require('./ClassSnippets').clearFight(player); } catch (e) {} // Push #103b
  player.regenLockUntil = Date.now() + (ms == null ? POST_COMBAT_LOCK_MS : ms);
  markCombatAction(player);
}

function applyPassiveRegen(player, db) {
  if (!player || !player.stats) return;

  const now = Date.now();
  if (!player.lastRegenTime)         player.lastRegenTime = now;
  if (!player.lastEnergyRegenTime)   player.lastEnergyRegenTime = now;

  // Active in battle -> no regen at all, and the clocks keep following `now`
  // so nothing accrues to be paid out when the fight ends.
  const battle = checkInBattle(player, db);
  if (battle) {
    player.lastRegenTime = now;
    player.lastEnergyRegenTime = now;
    // Push #103j (BUG-128/129): in-battle rank regen is CONTINUOUS — credited on every command, not only on strikes
    // (PvP keeps its own maths). The clock starts the moment the fight is detected.
    if (battle.type !== 'pvp' && battle.type !== 'teampvp') { try { if (!player._battleEnergyAt) player._battleEnergyAt = now; else raidTurnEnergy(player, now); } catch (e) {} }
    // PvP recovers NOTHING instantly: the duel's own maths owns HP/energy and
    // rank regen only resumes after the post-combat lock below.
    return;
  }

  // Post-combat grace window (gates / PvP / boss). Hold the clocks at `now`
  // while it runs, then resume normally.
  if (player.regenLockUntil && player.regenLockUntil > now) {
    player.lastRegenTime = now;
    player.lastEnergyRegenTime = now;
    return;
  }
  if (player.regenLockUntil) player.regenLockUntil = 0;

  const rank = player.awakenRank || 'E';

  // ── HP ──────────────────────────────────────────────────────
  const hpSec = Math.min(MAX_CATCHUP_SEC, Math.floor((now - player.lastRegenTime) / 1000));
  if (hpSec >= 1) {
    let maxHp = player.stats.maxHp || 100;
    try { maxHp = require('./GearSystem').effectiveMaxHp(player); } catch (e) {} // Push #85: gear/title HP fills too
    if ((player.stats.hp || 0) < maxHp) {
      player.stats.hp = Math.min(maxHp, (player.stats.hp || 0) + hpSec * getRegenRate(rank));
    }
    if (player.bloodDebtStacks) { try { require('./ClassPower').clearBloodDebt(player); } catch (e) {} } // Push #96h-t: out of combat → debt settled
    player.lastRegenTime += hpSec * 1000;
  }

  // ── Energy (skills' only source; outside battle only) ───────
  const enSec = Math.min(MAX_CATCHUP_SEC, Math.floor((now - player.lastEnergyRegenTime) / 1000));
  if (enSec >= 1) {
    const maxEn = player.stats.maxEnergy || 100;
    if ((player.stats.energy || 0) < maxEn) {
      player.stats.energy = Math.min(maxEn, (player.stats.energy || 0) + enSec * getEnergyRegenRate(rank));
    }
    player.lastEnergyRegenTime += enSec * 1000;
  }
}

function initAllPlayers(getDatabase, saveDatabase, sock) {
  try {
    const db = typeof getDatabase === 'function' ? getDatabase() : null;
    if (!db || !db.users) return;
    const now = Date.now();
    for (const player of Object.values(db.users)) {
      if (player && !player.lastRegenTime) {
        player.lastRegenTime = now;
      }
    }
    if (typeof saveDatabase === 'function') saveDatabase();
  } catch (_) {}
}

module.exports = { raidTurnEnergy, battleEnergyRate, BATTLE_ENERGY_PER_10S,
  checkInBattle,
  getRegenRate,
  getEnergyRegenRate,
  applyPassiveRegen,
  initAllPlayers,
  markCombatAction,
  endCombat,
  POST_COMBAT_LOCK_MS,
};
