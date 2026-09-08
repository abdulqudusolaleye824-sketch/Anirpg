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

function applyPassiveRegen(player, db) {
  if (!player || !player.stats) return;

  const now = Date.now();
  if (!player.lastRegenTime) {
    player.lastRegenTime = now;
    return;
  }

  // Active in battle -> pause regen (resets lastRegenTime)
  if (checkInBattle(player, db)) {
    player.lastRegenTime = now;
    return;
  }

  const elapsedMs = now - player.lastRegenTime;
  const elapsedSec = Math.floor(elapsedMs / 1000);

  if (elapsedSec >= 1) {
    const rank = player.awakenRank || 'E';
    const rate = getRegenRate(rank);
    const healAmount = elapsedSec * rate;
    const maxHp = player.stats.maxHp || 100;

    if (player.stats.hp < maxHp) {
      player.stats.hp = Math.min(maxHp, (player.stats.hp || 0) + healAmount);
    }
    player.lastRegenTime += elapsedSec * 1000;
  }
}

module.exports = {
  checkInBattle,
  getRegenRate,
  applyPassiveRegen,
};
