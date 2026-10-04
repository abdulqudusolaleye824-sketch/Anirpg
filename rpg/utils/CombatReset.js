// ═══════════════════════════════════════════════════════════════
// CombatReset — Push #92
// Nothing from one battle carries into the next: status effects
// (stun/burn/bleed…), temp stat buffs/debuffs, shields, transformation
// recoil, pattern/skill cooldowns. Called for EVERY hunter when a gate raid
// or dungeon starts, and again when it ends (clear / wipe / disband).
// Shop buffs (activeBuffs), HP/energy, gear and titles are untouched.
// ═══════════════════════════════════════════════════════════════
function clearForBattle(player, opts = {}) {
  if (!player || typeof player !== 'object') return false;
  try {
    // End a running transformation cleanly (stats revert, no aftermath statuses).
    try { const TF = require('./Transformation'); if (player.transform) TF.end(player, false, false); } catch (e) {}
    try { require('./DomainSystem').releaseShield(player); } catch (e) {} // Push #96h-z19: domain immunity never outlives the fight
    player.statusEffects = [];
    player.tempBuffs = {};
    player.buffs = [];
    player.attackCooldowns = {};
    if (player.skills && typeof player.skills === 'object' && !Array.isArray(player.skills) && player.skills.cooldowns) player.skills.cooldowns = {};
    if (player.skillCooldowns) player.skillCooldowns = {};
    if (player.stats) {
      if (opts.clearHpCap !== false) {
        let max = player.stats.maxHp || 100; try { max = require('./GearSystem').effectiveMaxHp(player); } catch (e) {}
        if (player.stats.hp > max) player.stats.hp = max;
      }
    }
    return true;
  } catch (e) { return false; }
}

// Reset every member of a gate raid / dungeon party. `members` may be jids or
// objects with .id — resolved through db.users (JID-tolerant).
function clearParty(db, members, opts = {}) {
  let n = 0;
  const GKM = (() => { try { return require('./GateKeyManager'); } catch (e) { return null; } })();
  for (const m of (members || [])) {
    const id = (m && typeof m === 'object') ? m.id : m;
    if (!id || !db || !db.users) continue;
    let u = db.users[id];
    if (!u && GKM && GKM.normaliseJid) { const n0 = GKM.normaliseJid(id); u = Object.values(db.users).find(x => x && (GKM.normaliseJid(x.jid || x.id || '') === n0)); }
    if (u && clearForBattle(u, opts)) n++;
  }
  return n;
}

module.exports = { clearForBattle, clearParty };
