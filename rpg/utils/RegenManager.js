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

function checkInBattle(player, db) {
  if (!player) return null;
  const pId = player.id || player.jid;

  // Solo dungeon battle
  if (player.dungeon?.currentBattle) {
    return { type: 'dungeon_solo', battle: player.dungeon.currentBattle };
  }

  // Boss battle
  if (player.boss?.currentBattle || player.currentBossBattle) {
    return { type: 'boss', battle: player.boss?.currentBattle || player.currentBossBattle };
  }

  // PvP battle
  if (player.pvpBattle) {
    return { type: 'pvp', battle: player.pvpBattle };
  }

  if (db?.pendingChallenges) {
    const activeChallenge = Object.values(db.pendingChallenges).find(
      c => c.active && (c.challenger === pId || c.target === pId)
    );
    if (activeChallenge) return { type: 'pvp', battle: activeChallenge };
  }

  // Gate Raid
  try {
    const GateRaid = require('../dungeons/GateRaid');
    const { GateManager } = require('../dungeons/GateManager');
    for (const gate of Object.values(GateManager.activeGates || {})) {
      if (gate && !gate.cleared && !gate.broken) {
        if (gate.raid?.members?.some(m => m.id === pId) || (gate.raiders || []).includes(pId)) {
          return { type: 'gateraid', battle: gate };
        }
      }
    }
  } catch (_) {}

  // Party Dungeon
  if (db?.parties) {
    const party = Object.values(db.parties).find(p => p.members?.includes(pId));
    if (party && db.partyBattles?.[party.id]) {
      return { type: 'dungeon_party', battle: db.partyBattles[party.id] };
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
function getEnergyRegenRate(rank) {
  const r = String(rank || 'E').toUpperCase().trim();
  switch (r) {
    case 'E': return 2;
    case 'D': return 3;
    case 'C': return 4;
    case 'B': return 5;
    case 'A': return 8;
    case 'S':
    case 'SS':
    case 'NATIONAL':
    case 'BEYOND': return 10;
    default: return 2;
  }
}

// How long after a fight ends nothing regenerates. Without this, the moment a
// PvP duel or gate raid flips to "not in battle" the elapsed-time maths hands
// the player a giant instant recovery — that is the "instant regeneration
// after gates and pvp" symptom. Regen resumes only after this window.
const POST_COMBAT_LOCK_MS = Number(process.env.REGEN_LOCK_MS || 60 * 1000);
// A single tick may never credit more than this many seconds of recovery, so a
// restart / long idle cannot dump an hour of regen at once and top someone up
// from 1 HP to full in one step.
const MAX_CATCHUP_SEC = Number(process.env.REGEN_CATCHUP_SEC || 30);

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
    const maxHp = player.stats.maxHp || 100;
    if ((player.stats.hp || 0) < maxHp) {
      player.stats.hp = Math.min(maxHp, (player.stats.hp || 0) + hpSec * getRegenRate(rank));
    }
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

module.exports = {
  checkInBattle,
  getRegenRate,
  getEnergyRegenRate,
  applyPassiveRegen,
  initAllPlayers,
  markCombatAction,
  endCombat,
  POST_COMBAT_LOCK_MS,
};
