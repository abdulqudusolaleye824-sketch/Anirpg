/**
 * ═══════════════════════════════════════════════════════════════
 *   GateRaid — party / solo gate raid engine (code-driven)
 * ═══════════════════════════════════════════════════════════════
 *  Flow:
 *   1. Owner/guild buys a gate  → /gate buy  → bot DMs the GATE CODE.
 *   2. In a registered dungeon GC, members use /party create --<CODE>.
 *   3. Guild members (or affiliates) of the owning guild get a party.
 *   4. A non-member / non-affiliate instantly gets a SOLO raid.
 *   5. Combat proceeds floor-by-floor with /gateraid attack|skill|
 *      status|boss.
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

const RI = require('../utils/RewardInventory');
const GKM = require('./GateKeyManager');
const { GateManager, GATE_RANKS } = require('./GateManager');

const MAX_PARTY = 10;

// ── Combat math (shared with the command for consistent damage) ──
function playerDamage(player, skillName = null, target = null) {
  let _gearAtkGR = 0, _gearCritGR = 0, _gearCritDmgGR = 0, _titleCritGR = 0, _titleAtkGR = 0;
  try { const gb = require('../utils/GearSystem').getEquippedBonuses(player) || {}; _gearAtkGR = gb.atk || 0; _gearCritGR = gb.crit || 0; _gearCritDmgGR = gb.critDmg || 0; } catch (e) {}
  try { const tb = require('../utils/TitleSystem').getEquippedBoost(player) || {}; _titleCritGR = tb.crit || 0; _titleAtkGR = tb.atk || 0; } catch (e) {}
  _gearAtkGR += _titleAtkGR; // Push #87: title ATK counts in raids too
  let _auraGR = { atk: 1, crit: 0 }; try { const AS = require('../utils/AuraSystem').AuraSystem; _auraGR = { atk: AS.atkMult(player), crit: AS.critPct(player) }; } catch (e) {} // Push #96f
  let _pm74 = { atk: 0, crit: 0, skillDmg: 0 };
  try { _pm74 = require('../utils/ClassPower').passiveMultipliers(player); } catch (e) {}
  // Push #74: class passives (+X% ATK, quality-scaled) apply to every raid hit.
  let _gift = 1; try { _gift = require('../utils/PetManager').lastGiftMultiplier(player) || 1; } catch (e) {}
  // Push #88: live temp buffs (War Cry / Spirit Link "+X% ATK") multiply the
  // raid strike too — they only reached PvP/pattern maths before. Kill stacks
  // (Devourer) add flat ATK.
  let _tbAtk = 0; try { _tbAtk = require('../utils/UnifiedCombat').tempBuffPct(player, 'atk'); } catch (e) {}
  const atk = Math.floor(((player.stats?.atk || 10) + _gearAtkGR + (player.weapon?.attack || player.weapon?.bonus || 0) + (_pm74.atkFlat || 0)) * (1 + (_pm74.atk || 0) / 100) * (1 + Math.max(-90, _tbAtk) / 100) * _gift * _auraGR.atk);
  const magicPower = player.stats?.magicPower || 0;
  if (skillName) {
    // SkillCatalog: name / prefix / number, equipped OR library, and it tells
    // you the level that unlocks a locked skill. The old lookup demanded an
    // exact hit inside player.skills.active — anything else answered
    // "Skill *X* not found" (which is what the boss chamber did, and what
    // every Monster-class player hit constantly).
    const SC = require('../utils/SkillCatalog');
    const res = SC.resolveSkill(player, skillName, { allowLibrary: true });
    if (!res.ok) return { damage: 0, blocked: true, reason: res.error, locked: !!res.locked };
    const skill = res.skill;
    const entry = res.entry;

    const cd = SC.onCooldown(player, entry || skill);
    if (!cd.ready) return { damage: 0, blocked: true, reason: `*${skill.name}* is on cooldown! (${Math.ceil(cd.msLeft / 1000)}s)` };
    const cost = entry ? SC.effectiveCost(entry, player) : (skill.energyCost || 0);
    if ((player.stats?.energy || 0) < cost) return { damage: 0, blocked: true, reason: `Not enough energy for *${skill.name}*! Need ${cost}.` };

    // Skills are a multiplier of ATK (plus magic power for casters), not the
    // old flat `skill.damage || 20` — that flat number is why a Lv.90 skill
    // landed like a base attack on the boss.
    const synergyNotes = [];
    // Push #88: skills scale from the FULL effective ATK (gear + weapon + buffs
    // + passives), not bare stats.atk — a "+100% ATK" buff now doubles the hit.
    let dmg = SC.computeDamage({ ...player, stats: { ...(player.stats || {}), atk } }, entry || skill, { includeMagic: magicPower > 0, crit: false, target, notes: synergyNotes });
    if (_pm74.skillDmg) dmg = Math.max(1, Math.floor(dmg * (1 + (_pm74.skillDmg || 0) / 100)));
    let _tDefMult95 = 1, _tTaken95 = 1; try { const _UC95 = require('../utils/UnifiedCombat'); _tDefMult95 = Math.max(0.1, 1 + _UC95.tempBuffPct(target || {}, 'def') / 100); _tTaken95 = 1 + _UC95.tempBuffPct(target || {}, 'damageTaken') / 100; } catch (e) {} // Push #95: monster shells / domain debuffs are real
    if (target && typeof target.def === 'number' && target.def > 0) dmg = Math.max(1, dmg - Math.floor(target.def * _tDefMult95 * 0.35 * (1 - Math.min(0.6, (_pm74.armorPen || 0) / 100))));
    if (target && _tTaken95 !== 1) dmg = Math.max(1, Math.floor(dmg * _tTaken95));
    if (target) { try { dmg = Math.max(1, Math.floor(dmg * require('../utils/UnifiedCombat').weakenTakenMult(target))); } catch (e) {} }
    if (target) { try { dmg = Math.max(1, Math.floor(dmg * require('../utils/JobSystem').targetMult(player, target, { boss: !!target.isBoss }))); } catch (e) {} } // Push #95: job prey/elite/pack bonuses
    const isCrit = Math.random() < ((player.stats?.critChance || 2) + (_pm74.crit || 0) + _gearCritGR + _titleCritGR + _auraGR.crit + _critBuffGR(player)) / 100;
    if (isCrit) dmg = Math.floor(dmg * ((player.stats?.critDamage || 150) + _gearCritDmgGR) / 100);
    if (target) { try { require('../utils/JobSystem').noteHit(player, true); target.lastHitBy = player.jid || player.id || target.lastHitBy; } catch (e) {} } // Push #95

    player.stats.energy = Math.max(0, (player.stats.energy || 0) - cost);
    SC.setCooldown(player, entry || skill);
    try { require('../utils/RegenManager').markCombatAction(player); } catch (e) {}
    // Push #88o: the monster may DODGE a damaging skill — cooldown + energy are
    // already spent (a dodged/missed move still enters cooldown).
    if (target && !_isHealSkillEarly(entry, skill) && monsterDodges(target, player, entry || skill)) {
      try { require('../utils/JobSystem').noteHit(player, false); } catch (e) {} // Push #95: Brawler momentum breaks on a miss
      return { damage: 0, isCrit: false, dodged: true, missed: true, missWhy: (monsterDodges.last && monsterDodges.last.why) || null, skillUsed: skill, statuses: [], healingPct: 0, healed: 0, hpPercentLines: [], drained: 0, hpCost: 0, synergyNotes: [], buffs: [] };
    }
    // Push #71: RECOVERY SKILLS — healingPct was computed here and returned,
    // but no caller ever applied it, so heals in gate raids restored 0 HP.
    // Apply it to the hunter now (heal-type skills deal no damage).
    const _healPct = Number((entry && entry.healingPct) || 0);
    const _isHealSkill = String((entry && entry.type) || skill.type || '').toLowerCase() === 'heal';
    let healed = 0;
    // Hybrids (Holy Strike, Dark Feast, Water Wave…) hit AND heal; pure heal
    // moves heal only.
    let _hpx = { lines: [], drained: 0, healed: 0, cost: 0 };
    try { _hpx = SC.applyHpPercents(entry || skill, player, target, (u) => { try { return require('../utils/GearSystem').effectiveMaxHp(u); } catch (e) { return u.stats.maxHp; } }); } catch (e) {}
    if (_healPct > 0) {
      const maxHp = player.stats.maxHp || 100;
      const before = player.stats.hp || 0;
      player.stats.hp = Math.min(maxHp, before + Math.floor(maxHp * _healPct / 100));
      healed = player.stats.hp - before;
      if (_isHealSkill) dmg = 0;
    }
    // Push #94: hybrid strikes keep their promises too — immunity / shield /
    // regen / reflect / cleanse on the caster, and "all allies +X%" buffs on
    // every living party member (playerDamage.partyAllies set by the caller).
    try {
      if (entry) {
        const _sf = SC.applySupportFields(entry, player, player, { name: player.name });
        _hpx.lines = [...(_hpx.lines || []), ..._sf.lines];
        const _allies = playerDamage.partyAllies || [];
        if (entry.party && (entry.buffs || []).length && _allies.length) {
          const UCp = require('../utils/UnifiedCombat');
          let n = 0;
          for (const ally of _allies) { if (!ally || ally === player || (ally.stats?.hp ?? 0) <= 0) continue; UCp.applyMoveBuffs({ name: skill.name, buffs: entry.buffs, debuffs: [], selfDebuffs: [] }, ally, ally); n++; }
          if (n) _hpx.lines.push(`🤝 ${entry.buffs.map(b => `${String(b.stat).toUpperCase()} +${Math.abs(Number(b.amount) || 0)}%`).join(', ')} shared with ${n} all${n === 1 ? 'y' : 'ies'}`);
        }
      }
    } catch (e) {}
    return {
      damage: dmg, isCrit, skillUsed: skill,
      statuses: [ ...((entry && entry.statuses) || skill.statuses || []), ...((_pm74.onHit || [])) ],
      healingPct: _healPct,
      healed: healed + (_hpx.healed || 0),
      hpPercentLines: _hpx.lines, drained: _hpx.drained, hpCost: _hpx.cost,
      synergyNotes,
      buffs: (entry && entry.buffs) || [],
      debuffs: (entry && entry.debuffs) || [], selfDebuffs: (entry && entry.selfDebuffs) || [], // Push #96h-k: "-40% enemy DEF" lands
    };
  }
  if (target && monsterDodges(target, player)) { try { require('../utils/JobSystem').noteHit(player, false); } catch (e) {} return { damage: 0, isCrit: false, dodged: true, missed: true, missWhy: (monsterDodges.last && monsterDodges.last.why) || null, synergyNotes: [], statuses: [] }; } // Push #88o
  let dmg = Math.max(5, atk * (0.85 + Math.random() * 0.30));
  let _tDefMult95 = 1, _tTaken95 = 1; try { const _UC95 = require('../utils/UnifiedCombat'); _tDefMult95 = Math.max(0.1, 1 + _UC95.tempBuffPct(target || {}, 'def') / 100); _tTaken95 = 1 + _UC95.tempBuffPct(target || {}, 'damageTaken') / 100; } catch (e) {} // Push #95: monster shells / domain debuffs are real
  if (target && typeof target.def === 'number' && target.def > 0) dmg = Math.max(5, dmg - Math.floor(target.def * _tDefMult95 * 0.35 * (1 - Math.min(0.6, (_pm74.armorPen || 0) / 100))));
  if (target && _tTaken95 !== 1) dmg = Math.max(5, Math.floor(dmg * _tTaken95));
  if (target) { try { dmg = Math.max(1, dmg * require('../utils/UnifiedCombat').weakenTakenMult(target)); } catch (e) {} }
  if (target) { try { dmg = Math.max(1, dmg * require('../utils/JobSystem').targetMult(player, target, { boss: !!target.isBoss })); } catch (e) {} } // Push #95
  const isCrit = Math.random() < ((player.stats?.critChance || 2) + (_pm74.crit || 0) + _gearCritGR + _titleCritGR + _auraGR.crit + _critBuffGR(player)) / 100;
  if (isCrit) dmg = Math.floor(dmg * (player.stats?.critDamage || 150) / 100);
  if (target) { try { require('../utils/JobSystem').noteHit(player, true); target.lastHitBy = player.jid || player.id || target.lastHitBy; } catch (e) {} } // Push #95
  let synergyNotes = [];
  if (target) { try { const syn = require('../utils/StatusSynergy').bonusFor({ name: 'strike', description: 'basic strike' }, target); if (syn.mult !== 1) { dmg *= syn.mult; synergyNotes = syn.notes; } } catch (e) {} }
  // Push #88: SpellBlade "free spell" proc + BloodKnight on-hit bleed on basic strikes.
  let procNote = null;
  if (_pm74.procDmg > 0 && Math.random() * 100 < _pm74.procDmg) { const extra = Math.floor(dmg * 0.5); dmg += extra; procNote = `✨ Arcane proc +${extra}`; }
  if (procNote) synergyNotes = [...synergyNotes, procNote];
  return { damage: Math.floor(dmg), isCrit, synergyNotes, statuses: (_pm74.onHit || []) };
}

// Push #88o: monsters can CRIT (10% base, +2% per rank step above E, ×1.5)
// and DODGE hunter strikes (speed edge over the hunter, 4–25%).
const MON_CRIT_MULT = 1.5;
// Push #88q: RAID monsters (gate floors + gate bosses, flagged `_raid`) hit
// twice as hard on every axis — ATK ×2, DEF ×2, crit chance ×2 (cap 50%),
// crit damage ×2 (×3.0 instead of ×1.5), status chance ×2 — and roll
// INITIATIVE against the hunter (see raidInitiative). Tower/dungeon monsters
// (ImprovedCombat / DungeonManager) are unchanged.
const RAID_X2 = 2;
function critMultFor(monster) { return monster && monster._raid ? MON_CRIT_MULT * RAID_X2 : MON_CRIT_MULT; }
function monsterCritChance(monster) {
  const rankIdx = { E: 0, D: 1, C: 2, B: 3, A: 4, S: 5, SS: 6, SSS: 7 }[String(monster?.rank || 'E').toUpperCase()] || 0;
  const base = Math.min(25, 10 + rankIdx * 2 + (monster?.isBoss ? 5 : 0)) + (Number(monster?.critBonus) || 0); // Push #96h: sleek families crit more
  return monster && monster._raid ? Math.min(60, base * RAID_X2) : base;
}
// Push #88q: SPEED / INITIATIVE. Chance (%) that the raid monster acts BEFORE
// the hunter this turn: 35% at equal speed, ±1.5% per point of speed edge,
// clamped 10–80. Held (stunned/frozen) monsters never win initiative.
// Push #88t: ONLY a genuinely faster monster can win initiative — 0% when its
// speed is equal or lower; +4% per point of speed edge, capped at 80%.
function raidInitiativeChance(monster, player) {
  const ms = Number(monster?.speed || monster?.stats?.speed || 10);
  const ps = Number(player?.stats?.speed || 10);
  if (ms <= ps) return 0;
  return Math.min(80, Math.round((ms - ps) * 4));
}
function raidMonsterGoesFirst(monster, player) {
  if (!monster || !player) return false;
  const held = (monster.statusEffects || []).some(e => ['stun', 'freeze', 'paralyze'].includes(String(e.type || '').toLowerCase()));
  if (held) return false;
  return Math.random() * 100 < raidInitiativeChance(monster, player);
}
function monsterDodgeChance(monster, player) {
  const ms = Number(monster?.speed || monster?.stats?.speed || 10);
  const ps = Number(player?.stats?.speed || 10);
  return Math.max(4, Math.min(25, 6 + (ms - ps) * 0.25));
}
// Roll a monster dodge against a hunter's strike. Frozen/stunned monsters never dodge.
function monsterDodges(monster, player, move = null) {
  if (!monster) return false;
  // Push #96h-j: the hunter's ACCURACY decides (stat / move accuracy, gear, +/− accuracy
  // buffs, BLIND halves it) minus a capped speed dodge. Held monsters never dodge.
  try {
    const UC = require('../utils/UnifiedCombat');
    const mon = { stats: { speed: Number(monster.speed || monster.stats?.speed || 10), atk: Number(monster.atk || monster.stats?.atk || 10) }, statusEffects: monster.statusEffects || [] };
    let pm = null; try { pm = require('../utils/ClassPower').passiveMultipliers(mon); } catch (e) {}
    const hc = UC.hitCheck(player, mon, move || { accuracy: player?.stats?.accuracy || 90 }, { pmD: pm });
    monsterDodges.last = hc; playerDamage.lastMiss = hc.hit ? null : hc;
    return !hc.hit;
  } catch (e) {
    if (move && move.undodgeable) return false;
    const held = (monster.statusEffects || []).some(e => ['stun', 'freeze', 'paralyze'].includes(String(e.type || '').toLowerCase()));
    if (held) return false;
    return Math.random() * 100 < monsterDodgeChance(monster, player);
  }
}
function _critBuffGR(p) { try { const UC = require('../utils/UnifiedCombat'); return (UC.tempBuffPct(p, 'critChance') || 0) + (UC.tempBuffPct(p, 'crit') || 0); } catch (e) { return 0; } } // Push #96h-k
function _isHealSkillEarly(entry, skill) { return String((entry && entry.type) || (skill && skill.type) || '').toLowerCase() === 'heal'; }
// Push #89: ONE definition of a hunter's defence for every monster hit —
// base + weapon + equipped gear + equipped TITLE + pet bonus + temp DEF buffs.
// (Guards used to be resolved without title/pet, and titles were never counted.)
function effectiveDef(player, jid = null) {
  if (!player) return 5;
  let def = (player.stats?.def || 5) + (player.weapon?.defense || 0);
  try { def += require('../utils/GearSystem').getEquippedBonuses(player).def || 0; } catch (e) {}
  try { def += require('../utils/TitleSystem').getEquippedBoost(player).def || 0; } catch (e) {}
  try { if (jid) def += require('../utils/PetCombat').defBonus(jid) || 0; } catch (e) {}
  try { const UC = require('../utils/UnifiedCombat'); if (typeof UC.tempBuffPct === 'function') def = Math.floor(def * (1 + (UC.tempBuffPct(player, 'def') || 0) / 100)); } catch (e) {}
  return Math.max(0, Math.floor(def));
}

function monsterDamage(monster, def, player = null) {
  monsterDamage.last = { crit: false, dodged: false, absorbed: 0, shieldLine: null };
  // Push #74: the hunter can DODGE (speed vs monster speed + evasion +
  // passives); passives also cut damage taken; WEAKEN on the hunter hurts.
  if (player) {
    try {
      const UC = require('../utils/UnifiedCombat');
      const CP = require('../utils/ClassPower');
      const pm = CP.passiveMultipliers(player);
      const mon = { stats: { speed: monster.speed || 10, atk: monster.atk || 10 }, statusEffects: monster.statusEffects || [] };
      const held = (player.statusEffects || []).some(e => ['stun', 'freeze', 'paralyze'].includes(String(e.type || '').toLowerCase()));
      if (!held && Math.random() * 100 < UC.dodgeChance(mon, player, pm)) { monsterDamage.last.dodged = true; return 0; }
      // Push #96h-j: a BLINDED beast swings wide — its accuracy is halved like a hunter's.
      try { const _am = require('../utils/StatusEffectManager').getStatModifiers(mon).accuracyMod; if (_am < 1 && !held && Math.random() >= _am) { monsterDamage.last.dodged = true; monsterDamage.last.blindMiss = true; return 0; } } catch (e) {}
      // Push #85: defence soaks at most 60% of the hit and a landed hit is
      // never below 4% of the hunter's max HP — high-DEF hunters used to
      // take a flat 3 from everything.
      let mAtk = (monster.atk || 10);
      try { mAtk = Math.floor(mAtk * (1 + UC.tempBuffPct(monster, 'atk') / 100)); } catch (e) {} // Push #95: monster roars / domains change its ATK
      // Push #89: DEF soaks 1:1 (was 0.5) — still capped at 60% of the hit. A
      // 200-DEF hunter vs a 500-ATK boss now takes ~300 instead of ~400.
      // Push #96g: ratio mitigation — DEF/(DEF+ATK), capped 70% (was flat soak ≤60%).
      const _defEff = Math.floor((def || 5) * (1 + (pm.def || 0) / 100));
      const _mit = Math.min(0.70, _defEff / (_defEff + Math.max(1, mAtk)));
      const floorDmg = Math.max(3, Math.floor((player.stats?.maxHp || 100) * 0.03));
      let raw = Math.max(floorDmg, Math.floor(mAtk * (1 - _mit)));
      raw = raw * (0.8 + Math.random() * 0.4) * UC.weakenTakenMult(player) * (1 + (pm.dmgTaken || 0) / 100);
      try { require('../utils/JobSystem').noteStruck(player); } catch (e) {} // Push #96: Brawler counter window
      try { raw = raw * (1 + UC.tempBuffPct(player, 'damageTaken') / 100); } catch (e) {} // Push #95: damage-taken buffs/debuffs (domains, skills)
      if (pm.job && pm.job.monsterDmgTaken) raw = raw * (1 + pm.job.monsterDmgTaken / 100); // Push #95: Beast King
      try { raw = raw / (require('../utils/PetManager').lastGiftMultiplier(player) || 1); } catch (e) {}
      if (Math.random() * 100 < monsterCritChance(monster)) { raw *= critMultFor(monster); monsterDamage.last.crit = true; }
      // Push #93: a monster under Curse of Ruin hits for −70%; Bone Wall / shields absorb.
      try { const NX = require('../utils/Necromancy'); raw = raw * NX.ruinAtkMult(monster); const ab = NX.absorb(player, Math.floor(raw)); if (ab.absorbed) { monsterDamage.last.absorbed = ab.absorbed; monsterDamage.last.shieldLine = NX.shieldLine(ab, player.name || 'Hunter'); raw = ab.dmg; } } catch (e) {}
      // Push #94: reflect — part of the landed hit bounces back onto the monster.
      try { if (raw > 0 && player.tempBuffs && player.tempBuffs.reflect) { const _rf = require('../utils/UnifiedCombat').reflectDamage(player, monster, Math.floor(raw)); if (_rf) { monsterDamage.last.reflected = _rf.back; monsterDamage.last.shieldLine = [monsterDamage.last.shieldLine, _rf.line].filter(Boolean).join('\n'); if (monster.hp <= 0) monster.hp = 1; } } } catch (e) {}
      return Math.max(0, Math.floor(raw));
    } catch (e) {}
  }
  let raw = Math.max(3, (monster.atk || 10) - Math.floor((def || 5) * 0.5)) * (0.8 + Math.random() * 0.4);
  if (Math.random() * 100 < monsterCritChance(monster)) { raw *= critMultFor(monster); monsterDamage.last.crit = true; }
  return Math.floor(raw);
}

// Push #88: after a monster hit lands on `player` — reflect, survive-lethal,
// per-turn regen. Returns lines. Call AFTER the damage was applied.
function afterMonsterHit(player, monster, dmg) {
  const lines = [];
  let pm = null; try { pm = require('../utils/ClassPower').passiveMultipliers(player); } catch (e) { return lines; }
  if (!pm) return lines;
  if (pm.surviveLethal && (player.stats?.hp ?? 1) <= 0 && (!player._lethalUsedAt || Date.now() - player._lethalUsedAt > 2 * 3600e3)) {
    player.stats.hp = 1; player._lethalUsedAt = Date.now();
    lines.push(`🛡️ *Unbreakable!* ${player.name} refuses to fall — survives at 1 HP (once per fight).`);
  }
  if (pm.reflect > 0 && dmg > 0 && monster && typeof monster.hp === 'number') {
    const r = Math.max(1, Math.floor(dmg * pm.reflect / 100));
    monster.hp = Math.max(0, monster.hp - r);
    lines.push(`↩️ *Counterguard* reflects ${r} damage back!`);
  }
  if (pm.regenFlat > 0 && (player.stats?.hp ?? 0) > 0) {
    let max = player.stats.maxHp || 100; try { max = require('../utils/GearSystem').effectiveMaxHp(player); } catch (e) {}
    const before = player.stats.hp; player.stats.hp = Math.min(max, before + pm.regenFlat);
    if (player.stats.hp > before) lines.push(`🌿 Passive regen +${player.stats.hp - before} HP`);
  }
  return lines;
}

function lifeSteal(player, dmg) {
  let pls = 0; try { pls = require('../utils/ClassPower').passiveMultipliers(player).lifesteal || 0; } catch (e) {}
  const ls = ((player.stats?.lifesteal || 0) + pls) / 100;
  return ls > 0 ? Math.floor(dmg * ls) : 0;
}

// ── Resolve a gate code → gate + keyData ─────────────────────────
// Batch-47: gates used to live ONLY in GateManager.activeGates (memory), so
// ANY restart wiped every running raid — parties at the boss floor came
// back to a reset/fresh gate ("gate was cleared"). Persist a live snapshot
// in db.activeGates on every mutation; resolveCode revives from it.
function saveGateState(db, gate) {
  if (!db || !gate || !gate.id) return;
  try {
    if (!db.activeGates) db.activeGates = {};
    db.activeGates[gate.id] = gate; // live ref — serialised at save time
  } catch (e) {}
}

function resolveCode(code, db = null) {
  const key = String(code || '').toUpperCase().replace(/^--/, '').trim();
  if (!key || key.length !== 8) return { ok: false, error: 'Invalid gate code. Format: 8 characters (e.g. 2K7SN2N8).' };
  const keyData = GKM.getKey(key, db) || null;
  if (!keyData) return { ok: false, error: '❌ Gate code not found. Check the code and try again.' };
  if (keyData.claimed || keyData.raidComplete) return { ok: false, error: '❌ This gate key has already been cleared or claimed!' };
  if (keyData.expired || Date.now() > keyData.expiresAt) return { ok: false, error: '⚠️ This gate code has expired. The gate has collapsed.' };
  let gate = GateManager.getGate(keyData.gateId);
  // Batch-47: revive the PERSISTED raid first (keeps floor, monsters, boss
  // HP, members, treasure) — fresh rebuild only when no snapshot exists.
  if (!gate && db && db.activeGates && db.activeGates[keyData.gateId]) {
    const snap = db.activeGates[keyData.gateId];
    if (snap && !snap.cleared && !(snap.raid && snap.raid.status === 'done')) {
      gate = snap;
      GateManager.activeGates[gate.id] = gate;
      const _chats = [gate.chatId, keyData.dungeonChatId].filter(Boolean);
      for (const _c of _chats) {
        if (!GateManager.gatesByChat[_c]) GateManager.gatesByChat[_c] = [];
        if (!GateManager.gatesByChat[_c].includes(gate.id)) GateManager.gatesByChat[_c].push(gate.id);
      }
    } else {
      try { delete db.activeGates[keyData.gateId]; } catch (e) {}
    }
  }
  // FIX: reconstruct gate if missing (e.g., after restart) or broken prematurely but key still valid — fixes "no longer active" for valid keys
  if (!gate) {
    const rank = keyData.gateRank || 'C';
    const rd = GATE_RANKS[rank] || GATE_RANKS['E'];
    const totalFloors = rd.floors || 5;
    try {
      const { MONSTER_DROPS } = require('../data/MonsterDrops');
      const pool = (MONSTER_DROPS[rank] && MONSTER_DROPS[rank].monsters) || MONSTER_DROPS['E'].monsters;
      const bossPool = (MONSTER_DROPS[rank] && MONSTER_DROPS[rank].bosses) || MONSTER_DROPS['E'].bosses;
      const _themed = GateManager.pickGateTheme(rank, bossPool); // Push #88t
      const bossData = _themed.boss;
      // Push #71: same bestiary/strength builder as spawnGate.
      const strengthPct = keyData.strengthPct || GateManager.rollGateStrength();
      const monsters = GateManager.buildGateMonsters(rank, totalFloors, strengthPct, bossData && bossData.name); // Push #88t: themed
      const bossHp = Math.floor(rd.bossHp * Math.max(0.6, strengthPct / 100));
      gate = {
        strengthPct, strengthLabel: GateManager.strengthLabel(strengthPct),
        id: keyData.gateId,
        chatId: keyData.spawnChatId || keyData.dungeonChatId || 'unknown@g.us',
        rank, rankData: rd,
        spawnTime: keyData.purchasedAt || Date.now(),
        breakTime: keyData.expiresAt || (Date.now()+ 7*24*60*60*1000),
        currency: rd.currency || 'nexus',
        isFree: false, isDisaster:false,
        owned: true, ownedBy: keyData.guildName || null,
        purchasedAt: keyData.purchasedAt,
        purchasePrice: 0, manaPrice:0,
        nexusLoot:0, crystalLoot:0,
        cleared:false, broken:false, active:true,
        raiders: [], guildRaiders:[], externalRaiders:[], pendingApplicants:[],
        raidStarted:false, raidStartTime:null,
        currentFloor:0, totalFloors,
        monsters,
        boss: { name: bossData.name, baseName: bossData.baseName || bossData.name, family: _themed.theme || null, hp: bossHp, maxHp: bossHp, defeated:false }, theme: _themed.theme || null,
        bossLoot: [],
        lootDistributed:false,
        monstersKilled:0, damageDealt:{},
        raid: null
      };
      GateManager.activeGates[gate.id] = gate;
      if (gate.chatId && gate.chatId.endsWith('@g.us')) {
        if (!GateManager.gatesByChat[gate.chatId]) GateManager.gatesByChat[gate.chatId]=[];
        if (!GateManager.gatesByChat[gate.chatId].includes(gate.id)) GateManager.gatesByChat[gate.chatId].push(gate.id);
      }
      if (keyData.dungeonChatId && keyData.dungeonChatId !== gate.chatId) {
        if (!GateManager.gatesByChat[keyData.dungeonChatId]) GateManager.gatesByChat[keyData.dungeonChatId]=[];
        if (!GateManager.gatesByChat[keyData.dungeonChatId].includes(gate.id)) GateManager.gatesByChat[keyData.dungeonChatId].push(gate.id);
      }
    } catch (e) {
      return { ok:false, error:'❌ This gate is no longer active. (Gate data lost — please contact admin)' };
    }
  }
  // FIX: if gate was marked broken but key still valid, revive it (fixes premature break)
  if (gate.broken && !gate.cleared && keyData && !keyData.expired && Date.now() < keyData.expiresAt && !keyData.raidComplete) {
    gate.broken = false;
    gate.active = true;
    gate.breakTime = keyData.expiresAt;
  }
  if (!gate || gate.cleared || gate.broken) return { ok: false, error: '❌ This gate is no longer active.' };
  return { ok: true, key, keyData, gate };
}

// ── Relationship of a sender to an owning guild ─────────────────
// Returns 'member' | 'affiliate' | 'outsider'. Outsiders raid solo.
function relationOf(sender, keyData, db) {
  const guildName = keyData ? keyData.guildName : null;
  if (keyData && keyData.isAffiliate) {
    if (GKM.normaliseJid(sender) === GKM.normaliseJid(keyData.ownedBy)) return 'affiliate';
    return 'outsider';
  }
  if (guildName) {
    if (GKM.isGuildMember(sender, guildName, db)) return 'member';
    const aff = GKM.getAffiliateData(sender, db);
    if (aff && aff.guildName === guildName) return 'affiliate';
    if (keyData && keyData.contracts && keyData.contracts[sender]) return 'affiliate';
    return 'outsider';
  }
  return 'outsider';
}

// ── Get / create the raid object on a gate ──────────────────────
function raidOf(gate, key, keyData) {
  if (!gate.raid) {
    gate.raid = {
      key,
      mode: null,
      leader: null,
      status: 'recruiting', // recruiting | active | done
      members: [],          // [{ id, name, hp, maxHp, energy, maxEnergy, ready }]
      guildName: keyData ? keyData.guildName : null,
      isAffiliate: keyData ? !!keyData.isAffiliate : false,
      ownedBy: keyData ? keyData.ownedBy : null,
      startedAt: null,
      clearedAt: null,
      loot: null,
    };
  }
  return gate.raid;
}

// ── Push #29: per-gate combat lock ───────────────────────────────────
// Serialises the multi-message battle flow: while one hunter's attack/skill/
// boss turn is playing out, every other attacking command waits instead of
// interleaving (which double-spent kills and scrambled HP). In-memory is
// correct here — single process, and a restart clears all locks anyway.
const _combatLocks = new Map(); // gateId -> { holder, name, ts }
const COMBAT_LOCK_MS = 90_000;  // stale-lock auto-expiry (belt + braces)
function tryCombatLock(gateId, holder, name) {
  const now = Date.now();
  const cur = _combatLocks.get(gateId);
  // Push #68: the holder is blocked as well. The old self-exempt check let
  // the SAME hunter re-enter /attack (or /party boss) while their own
  // multi-message flow was still resolving — other hunters were locked out
  // but the actor could double-move.
  if (cur && now - cur.ts < COMBAT_LOCK_MS) {
    return { ok: false, holderName: cur.name || 'Another hunter', self: cur.holder === holder };
  }
  _combatLocks.set(gateId, { holder, name, ts: now });
  return { ok: true };
}
function releaseCombatLock(gateId) {
  try { _combatLocks.delete(gateId); } catch (e) {}
}

// ── Push #29: party wipe — collapse the gate, free the dungeon GC ────
// Push #30: the key stays consumed (single-use) — no retry on the same key.
// The party regroups with a fresh key; the GC itself is usable immediately.
function wipeGate(gate, key, keyData, chatId, db) {
  try { require('../utils/CombatReset').clearParty(db, [...(gate.raiders || []), ...((gate.raid && gate.raid.members) || [])]); } catch (e) {} // Push #92
  // Push #88: a WIPE salvages 10% (Push #88q, was half) of the accumulated floor treasure — and it
  // goes to the owning GUILD's treasury, never to any single hunter. (A single
  // death used to pay 50% to the fallen hunter; that is gone.)
  let salvage = null;
  try {
    const tr = gate.accumulatedTreasure || { nexus: 0, crystals: 0 };
    const half = { nexus: Math.floor((tr.nexus || 0) * 0.1), crystals: Math.floor((tr.crystals || 0) * 0.1) };
    if ((half.nexus > 0 || half.crystals > 0) && !gate._wipeSalvaged) {
      const guild = keyData?.guildName ? GKM.findGuild(db, keyData.guildName) : null;
      if (guild) {
        guild.totalRaids = (guild.totalRaids || 0) + 1; // Push #88: a wipe is still a raid attempted
        guild.raidsWiped = (guild.raidsWiped || 0) + 1;
        guild.treasury = (guild.treasury || 0) + half.nexus;
        guild.manaTreasury = (guild.manaTreasury || 0) + half.crystals;
        salvage = { ...half, dest: guild.name || keyData.guildName };
      }
      gate._wipeSalvaged = true;
    }
  } catch (e) {}
  try {
    if (gate.raid) { gate.raid.status = 'wiped'; gate.raid.clearedAt = Date.now(); }
    if (db?.activeGates) delete db.activeGates[gate.id];
    try { delete GateManager.activeGates[gate.id]; } catch (e) {}
    try {
      const chats = [chatId, keyData?.dungeonChatId].filter(Boolean);
      for (const c of chats) {
        const arr = GateManager.gatesByChat?.[c];
        if (Array.isArray(arr)) GateManager.gatesByChat[c] = arr.filter(id => id !== gate.id);
      }
    } catch (e) {}
    const gc = GKM.getDungeonGC(chatId)
      || (keyData?.dungeonChatId ? GKM.getDungeonGC(keyData.dungeonChatId) : null);
    if (gc) { gc.activeKeyId = null; try { GKM.saveGCsToDb(db); } catch (e) {} }
    if (keyData) {
      keyData.raidStarted = false;
      try { if (db?.gateKeys?.[key]) db.gateKeys[key].raidStarted = false; } catch (e) {}
    }
  } catch (e) { console.error('wipeGate error:', e.message); }
  return [
    ``,
    `💀 *ALL HUNTERS WIPED!*`,
    `🚪 The gate collapses and the dungeon closes...`,
    ...(salvage ? [`🏰 *10% TREASURE SALVAGED → ${salvage.dest} Treasury:* +${salvage.nexus.toLocaleString()} 💠 | +${salvage.crystals.toLocaleString()} 💎`] : []),
    `✅ This dungeon GC is usable again — grab a fresh key for the next run!`,
  ];
}

// Push #82: one hunter, one raid. Scans every live gate for a raid that is
// still recruiting/active and already lists this sender (JID-tolerant).
function findOtherRaid(sender, gate) {
  const sNum = GKM.normaliseJid(sender);
  let all = {};
  try { all = GateManager.activeGates || {}; } catch (e) {}
  for (const g of Object.values(all)) {
    if (!g || g === gate || (gate && g.id === gate.id)) continue;
    const r = g.raid;
    if (!r || !Array.isArray(r.members) || r.status === 'done') continue;
    if (r.status !== 'recruiting' && r.status !== 'active') continue;
    const hit = r.members.find(x => x.id === sender || (sNum && GKM.normaliseJid(x.id) === sNum));
    if (hit && (hit.hp === undefined || hit.hp > 0)) return g;
  }
  return null;
}
function otherRaidError(g) {
  const code = g.code || g.keyCode || g.id || '?';
  return `🚫 *You are already in another raid!*\n\n🚪 Gate: *${g.rank || '?'}-Rank* (${code})\nFinish it, die in it, or wait for it to end before joining a new one.`;
}

// ── Push #84: /guard ─────────────────────────────────────────────
// A living party member can declare a guard for a teammate. The NEXT
// monster/boss hit aimed at that teammate is redirected to the guardian and
// resolved normally against the GUARDIAN's stats — no damage reduction, no
// mitigation. If the guardian can't survive it, the guardian dies.
const GUARD_TTL_MS = 3 * 60 * 1000;
function setGuard(gate, guardianJid, targetJid) {
  const raid = gate && gate.raid;
  if (!raid) return { ok: false, error: 'No raid in progress here.' };
  if (raid.status !== 'active') return { ok: false, error: 'The raid has not started yet.' };
  const same = (a, b) => a === b || GKM.normaliseJid(a) === GKM.normaliseJid(b);
  const g = raid.members.find(m => same(m.id, guardianJid));
  if (!g) return { ok: false, error: 'You are not in this raid.' };
  if ((g.hp ?? 1) <= 0) return { ok: false, error: 'You are down — you cannot guard anyone.' };
  let target = null;
  if (targetJid) {
    target = raid.members.find(m => same(m.id, targetJid));
    if (!target) return { ok: false, error: 'That hunter is not in this raid.' };
    if (same(target.id, g.id)) return { ok: false, error: 'You cannot guard yourself.' };
  }
  raid.guards = raid.guards || {};
  // one active guard per guardian; clear any previous one
  for (const k of Object.keys(raid.guards)) if (same(raid.guards[k].by, g.id)) delete raid.guards[k];
  const key = target ? GKM.normaliseJid(target.id) : '*';
  raid.guards[key] = { by: g.id, byName: g.name, target: target ? target.id : null, at: Date.now(), expiresAt: Date.now() + GUARD_TTL_MS };
  return { ok: true, guardian: g, target };
}
// Returns { guardianJid, guardianName } if someone is guarding `victimJid`
// right now (specific guard wins over wildcard). Consumes the guard.
function takeGuard(gate, victimJid, db) {
  const raid = gate && gate.raid;
  if (!raid || !raid.guards) return null;
  const now = Date.now();
  const vk = GKM.normaliseJid(victimJid);
  for (const k of Object.keys(raid.guards)) if ((raid.guards[k].expiresAt || 0) < now) delete raid.guards[k];
  const pick = raid.guards[vk] || raid.guards['*'];
  if (!pick) return null;
  if (GKM.normaliseJid(pick.by) === vk) return null; // never redirect onto yourself
  const guardian = db && db.users && (db.users[pick.by] || Object.values(db.users).find(u => u && u.jid && GKM.normaliseJid(u.jid) === GKM.normaliseJid(pick.by)));
  const gm = raid.members.find(m => GKM.normaliseJid(m.id) === GKM.normaliseJid(pick.by));
  if (!guardian || !gm || (guardian.stats?.hp ?? 0) <= 0) { for (const k of Object.keys(raid.guards)) if (raid.guards[k] === pick) delete raid.guards[k]; return null; }
  // consume
  for (const k of Object.keys(raid.guards)) if (raid.guards[k] === pick) delete raid.guards[k];
  return { guardianJid: pick.by, guardianName: gm.name || guardian.name, guardian, member: gm };
}

// ── Push #88w: FALLEN HUNTERS ─────────────────────────────────────────
// A hunter cut down in a raid is recorded on the raid; they cannot walk back
// in through /gateraid <key> (guild affiliation) or /party join — only a
// Revive Token (/party revive) or a Healer's revive skill brings them back.
function markFallen(gate, jid) {
  try {
    if (!gate || !gate.raid || !jid) return;
    const n = GKM.normaliseJid(jid) || String(jid);
    if (!Array.isArray(gate.raid.fallen)) gate.raid.fallen = [];
    if (!gate.raid.fallen.includes(n)) gate.raid.fallen.push(n);
    succeedLeader(gate, jid); // Push #96d: next on the list leads
  } catch (e) {}
}
function isFallen(gate, jid) {
  try { const n = GKM.normaliseJid(jid) || String(jid); return !!(gate && gate.raid && Array.isArray(gate.raid.fallen) && gate.raid.fallen.includes(n)); } catch (e) { return false; }
}
function clearFallen(gate, jid) {
  try { const n = GKM.normaliseJid(jid) || String(jid); if (gate && gate.raid && Array.isArray(gate.raid.fallen)) gate.raid.fallen = gate.raid.fallen.filter(x => x !== n); } catch (e) {}
}
const FALLEN_TEXT = 'You FELL in this raid. Only a Revive Token (/party revive) or a Healer\'s revive can bring you back.';
// Bring a fallen hunter back into the party (revive token / healer revive).
function reviveFallen(gate, jid, db, hpPct = 50) {
  const u = db && db.users ? (db.users[jid] || Object.values(db.users).find(x => x && x.jid && GKM.normaliseJid(x.jid) === GKM.normaliseJid(jid))) : null;
  if (!u || !u.stats) return null;
  let max = u.stats.maxHp || 100; try { max = require('../utils/GearSystem').effectiveMaxHp(u); } catch (e) {}
  u.stats.hp = Math.max(1, Math.floor(max * hpPct / 100));
  u.statusEffects = [];
  clearFallen(gate, jid);
  const m = ensureMember(gate, jid, db);
  if (m) { m.hp = u.stats.hp; m.ready = true; }
  gate.raiders = gate.raiders || []; if (!gate.raiders.includes(jid)) gate.raiders.push(jid);
  return { player: u, member: m, hp: u.stats.hp, max };
}
function ensureMember(gate, sender, db) {
  const player = db.users?.[sender];
  const raid = gate.raid;
  // Push #92: a FALLEN hunter can never be re-seated by any path (affiliate
  // hire, key re-use, roster self-heal). Only reviveFallen() clears the flag first.
  if (isFallen(gate, sender)) return null;
  // Push #29: JID-tolerant match (LID/PN/device flips) + self-heal stored id.
  const sNum = GKM.normaliseJid(sender);
  let m = raid.members.find(x => x.id === sender)
    || raid.members.find(x => sNum && GKM.normaliseJid(x.id) === sNum);
  if (m && m.id !== sender) { m.id = sender; if (player?.name) m.name = player.name; }
  if (!m) {
    m = {
      id: sender,
      name: (player && player.name) || sender.split('@')[0],
      maxHp: (() => { try { return require('../utils/GearSystem').effectiveMaxHp(player); } catch (e) { return player?.stats?.maxHp || 100; } })(), // Push #87: gear HP shows in the raid roster
      hp: (player?.stats?.hp ?? (player?.stats?.maxHp || 100)),
      energy: (player?.stats?.energy ?? (player?.stats?.maxEnergy || 100)),
      maxEnergy: (player?.stats?.maxEnergy || 100),
      ready: false,
    };
    raid.members.push(m);
  }
  return m;
}

// ── ENTRY ───────────────────────────────────────────────────────
function enter(sender, name, key, keyData, gate, db) {
  { try { const _eb = require('../utils/EventSystem').blocksRaids(db, db?.users?.[sender]); if (_eb) return { ok: false, error: _eb }; } catch (e) {} } // Push #96h-h
  const raid = raidOf(gate, key, keyData);
  { const sr = sealedReason(gate); const _in = (raid.members || []).some(m => m.id === sender || GKM.normaliseJid(m.id) === GKM.normaliseJid(sender)); if (sr && !_in) return { ok: false, error: sr }; } // Push #96d
  { const other = findOtherRaid(sender, gate); if (other) return { ok: false, error: otherRaidError(other) }; }
  // Push #30: single-use keys — fresh entry on a consumed key is refused.
  // (Members re-running enter on their own live raid pass straight through.)
  const _alreadyIn = (raid.members || []).some(m =>
    m.id === sender || GKM.normaliseJid(m.id) === GKM.normaliseJid(sender));
  const rel = relationOf(sender, keyData, db);
  // Push #96h-f: a guild MEMBER or AFFILIATE (incl. one hired AFTER the raid began) walks
  // straight into the guild's live party — the consumed-key rule only stops outsiders
  // from re-opening a spent key.
  const _liveGuildRaid = rel !== 'outsider' && raid.leader && raid.status !== 'done';
  if (!_alreadyIn && keyData?.consumed && !_liveGuildRaid) {
    return { ok: false, error: '🔥 *This key is already consumed!*\n\nSingle-use: each key opens exactly one party. Buy a fresh gate for another run.' };
  }
  // Burn it now — committed from this point on (covers solo + /gateraid enter).
  try { keyData.consumed = true; if (db?.gateKeys?.[key]) db.gateKeys[key].consumed = true; } catch (e) {}

  // No-guild hunter (not a member of the owning guild, not an affiliate) → instant SOLO raid.
  if (rel === 'outsider') {
    raid.mode = 'solo';
    raid.leader = sender;
    raid.status = 'active'; raid.lastTurnAt = Date.now(); // Push #88q
    raid.startedAt = Date.now();
    try { require('../utils/CombatReset').clearParty(db, [sender]); } catch (e) {} // Push #92: fresh battle state
    // Single-use: solo raids launch instantly, so the key is consumed here
    try {
      keyData.used = true; keyData.raidStarted = true;
      if (db?.gateKeys?.[key]) { db.gateKeys[key].used = true; db.gateKeys[key].raidStarted = true; }
    } catch(e){}
    raid.members = [];
    ensureMember(gate, sender, db);
    gate.raiders = gate.raiders || [];
    if (!gate.raiders.includes(sender)) gate.raiders.push(sender);
    // Push #80: solo raids are calibrated too (they never were → monsters
    // ignored the hunter's strength and the severity label was a stale roll).
    try { calibrateToParty(gate, raid, db); } catch (e) { console.error('calibrateToParty(solo):', e.message); }
    return { ok: true, mode: 'solo', raid, rel };
  }

  // Push #88w: a fallen hunter cannot re-enter an ACTIVE raid via affiliation.
  if (raid.status === 'active' && isFallen(gate, sender)) return { ok: false, error: FALLEN_TEXT };
  // member / affiliate → open a party (creator = leader)
  if (!raid.leader || raid.status === 'done') {
    raid.mode = 'party';
    raid.status = 'recruiting';
    raid.leader = sender;
    raid.members = [];
    raid.fallen = [];
  }
  const _wasIn = (raid.members || []).some(m => m.id === sender || GKM.normaliseJid(m.id) === GKM.normaliseJid(sender));
  const m = ensureMember(gate, sender, db);
  gate.raiders = gate.raiders || [];
  if (!gate.raiders.includes(sender)) gate.raiders.push(sender);
  // Push #96h-f: joined a raid that is ALREADY running (late member / freshly hired affiliate):
  // seated as ready, raid is re-calibrated to the new party, and the caller is told.
  let lateJoin = false;
  if (!_wasIn && raid.status === 'active' && m) {
    m.ready = true; lateJoin = true;
    try { require('../utils/CombatReset').clearParty(db, [sender]); } catch (e) {}
    try { gate.calibrated = null; calibrateToParty(gate, raid, db); applyMonsterScaling(gate); } catch (e) {}
  }
  return { ok: true, mode: 'party', raid, rel, lateJoin };
}

function join(sender, name, gate, db) {
  { try { const _eb = require('../utils/EventSystem').blocksRaids(db, db?.users?.[sender]); if (_eb) return { ok: false, error: _eb }; } catch (e) {} } // Push #96h-h
  const raid = gate.raid;
  if (!raid) return { ok: false, error: 'No gate raid in progress.' };
  { const sr = sealedReason(gate); if (sr) return { ok: false, error: sr }; } // Push #96d
  if (isFallen(gate, sender)) return { ok: false, error: FALLEN_TEXT }; // Push #88w
  if (raid.status !== 'recruiting') return { ok: false, error: 'The raid has already started.' };
  if (raid.members.length >= MAX_PARTY) return { ok: false, error: `Party is full! (${MAX_PARTY} max)` };
  { const other = findOtherRaid(sender, gate); if (other) return { ok: false, error: otherRaidError(other) }; }

  ensureMember(gate, sender, db);
  return { ok: true, raid };
}

function ready(sender, gate) {
  const raid = gate.raid;
  if (!raid) return { ok: false, error: 'No gate raid in progress.' };
  const m = raid.members.find(x => x.id === sender);
  if (!m) return { ok: false, error: 'You are not in this raid.' };
  m.ready = true;
  const allReadied = raid.members.length > 0 && raid.members.every(x => x.ready);
  return { ok: true, allReadied };
}

function start(sender, keyData, gate, db) {
  const raid = gate.raid;
  if (!raid) return { ok: false, error: 'No gate raid in progress.' };
  if (raid.status !== 'recruiting') return { ok: false, error: 'The raid has already started.' };
  if (raid.leader !== sender) return { ok: false, error: 'Only the party leader can start the raid.' };
  if (raid.members.length === 0) return { ok: false, error: 'The party is empty.' };
  if (!raid.members.every(x => x.ready)) return { ok: false, error: 'All members must run /party ready before you can start.' };

  raid.status = 'active'; raid.lastTurnAt = Date.now(); // Push #88q
  raid.startedAt = Date.now();
  gate.raidStarted = true;
  try { require('../utils/CombatReset').clearParty(db, raid.members); } catch (e) {} // Push #92: no statuses/buffs/recoil carry in
  // Push #74: monster SEVERITY is calibrated to the party, not random.
  try { calibrateToParty(gate, raid, db); } catch (e) { console.error('calibrateToParty:', e.message); }
  // Single-use: launching the raid consumes the key (no second runs)
  try {
    keyData.used = true; keyData.raidStarted = true;
    if (db?.gateKeys?.[keyData.key]) { db.gateKeys[keyData.key].used = true; db.gateKeys[keyData.key].raidStarted = true; }
  } catch(e){}
  gate.raidStartTime = Date.now();
  gate.currentFloor = 1;
  gate.raiders = gate.raiders || [];
  raid.members.forEach(m => { if (!gate.raiders.includes(m.id)) gate.raiders.push(m.id); });
  // Push #96d: hidden rolls — the gate may EVOLVE into a Red Gate (sealed: nobody enters or
  // leaves), may hide a second dungeon behind its boss, and a stronger beast may leak in.
  const notes = [];
  if (!gate.isDouble) {
    if (Math.random() < RED_GATE_CHANCE) {
      gate.redGate = true; notes.push(RED_GATE_TEXT);
      // Push #96h: a Red Gate runs 10 floors DEEPER — extra floors are built from the same pool/theme.
      try {
        const extra = GateManager.buildGateMonsters(gate.rank, (gate.totalFloors || 5) + RED_GATE_EXTRA_FLOORS, gate.preRollStrengthPct || gate.strengthPct || 100, gate.boss && gate.boss.name) || [];
        const oldTop = gate.totalFloors || 5; const newTop = oldTop + RED_GATE_EXTRA_FLOORS;
        gate.monsters = (gate.monsters || []).filter(m => m && !m.elite);               // old elite guards go
        for (const m of extra) if (m.floor > oldTop) gate.monsters.push(m);           // new floors + new elite guards on the new boss floor
        gate.totalFloors = newTop;
        gate.monsters = GateManager.orderFloors(gate.monsters);
        notes.push(`🟥 The red light stretches the gate — *${RED_GATE_EXTRA_FLOORS} extra floors* (${newTop} in total).`);
      } catch (e) {}
    }
    if (Math.random() < DOUBLE_DUNGEON_CHANCE) gate.doubleRoll = true; // revealed only when the boss falls
  }
  try { const leak = leakMonster(gate); if (leak) notes.push(leak); } catch (e) {}
  return { ok: true, raid, notes };
}

// ── Push #96d: RED GATES · DOUBLE DUNGEONS · LEAKS · LEADER SUCCESSION ──────
const RED_GATE_EXTRA_FLOORS = 10; // Push #96h
const RED_GATE_CHANCE = 0.15;
const DOUBLE_DUNGEON_CHANCE = 0.05;
const LEAK_CHANCE = 0.17;
const RED_GATE_TEXT = '🟥 *THE GATE TURNS RED!* The entrance seals behind you — *nobody can enter or leave* this raid until the gate is cleared or the party falls.';
const RANK_ORDER = ['E', 'D', 'C', 'B', 'A', 'S'];
// Null when the raid is open; otherwise the reason entry/exit is refused.
function sealedReason(gate) {
  if (!gate || !gate.raid || gate.raid.status !== 'active') return null;
  if (gate.isDouble) return '🚫 *DOUBLE DUNGEON* — the second gate is sealed: nobody can join, leave or flee until it is cleared.';
  if (gate.redGate) return '🟥 *RED GATE* — the entrance is sealed: nobody can enter or leave until the gate is cleared.';
  return null;
}
// 17%: ONE beast from a higher rank leaks into this raid (replaces a random non-elite floor monster).
function leakMonster(gate) {
  if (!gate || !Array.isArray(gate.monsters) || !gate.monsters.length) return null;
  const idx = RANK_ORDER.indexOf(String(gate.rank || 'E').toUpperCase());
  if (idx < 0 || idx >= RANK_ORDER.length - 1) return null; // S has nothing above it
  if (Math.random() >= LEAK_CHANCE) return null;
  const fromRank = RANK_ORDER[idx + 1 + Math.floor(Math.random() * (RANK_ORDER.length - 1 - idx))];
  const pool = GateManager.buildGateMonsters(fromRank, 1, gate.strengthPct || 100, null) || [];
  const leaked = pool.find(m => m && !m.elite) || pool[0];
  if (!leaked) return null;
  const slots = gate.monsters.map((m, i) => (m && !m.defeated && !m.elite && m.floor !== gate.totalFloors ? i : -1)).filter(i => i >= 0);
  if (!slots.length) return null;
  const i = slots[Math.floor(Math.random() * slots.length)];
  const old = gate.monsters[i];
  gate.monsters[i] = { ...leaked, floor: old.floor, defeated: false, leaked: true, leakedFrom: fromRank, name: `${leaked.name} (${fromRank}-Rank leak)` };
  gate.leakedMonster = { name: gate.monsters[i].name, floor: old.floor, fromRank };
  return `⚠️ *A ${fromRank}-Rank beast has leaked into this gate!* *${leaked.name}* prowls floor ${old.floor} — *three times* the strength it had in its own habitat.`;
}
// When the leader falls, the next hunter on the party list takes the crown.
function succeedLeader(gate, fallenJid) {
  try {
    const raid = gate && gate.raid; if (!raid || !raid.leader) return null;
    const n = GKM.normaliseJid(fallenJid) || String(fallenJid);
    if (raid.leader !== fallenJid && GKM.normaliseJid(raid.leader) !== n) return null;
    const next = (raid.members || []).find(m => m && m.id !== fallenJid && GKM.normaliseJid(m.id) !== n && (m.hp == null || m.hp > 0));
    if (!next) return null;
    raid.leader = next.id; raid.leaderSucceededAt = Date.now();
    raid._leaderNotice = `👑 *${next.name}* takes command of the party — the leader has fallen.`;
    return next;
  } catch (e) { return null; }
}
function takeLeaderNotice(gate) { const n = gate && gate.raid && gate.raid._leaderNotice; if (n) gate.raid._leaderNotice = null; return n || null; }
// The boss fell on a gate that rolled a double dungeon → the raid is paused for the leader's choice.
function doublePending(gate) { return !!(gate && gate.doubleRoll && !gate.isDouble && gate.doublePending); }
// Evolve the cleared gate IN PLACE into a hidden-rank B/A/S second dungeon.
function evolveDouble(gate, db) {
  if (!gate || !gate.raid) return { ok: false, error: 'No raid.' };
  if (!gate.doublePending) return { ok: false, error: 'No second gate is waiting.' };
  const rank = ['B', 'A', 'S'][Math.floor(Math.random() * 3)];
  const rd = GATE_RANKS[rank];
  const floors = rd.floors || 5;
  let bossName = 'Gate Warden', bossData = null, themed = null;
  try {
    const { MONSTER_DROPS } = require('../data/MonsterDrops');
    const bossPool = (MONSTER_DROPS[rank] && MONSTER_DROPS[rank].bosses) || [];
    themed = GateManager.pickGateTheme(rank, bossPool); bossData = themed.boss; bossName = bossData.name;
  } catch (e) {}
  const strengthPct = GateManager.rollGateStrength();
  const monsters = GateManager.buildGateMonsters(rank, floors, strengthPct, bossName);
  const bossHp = Math.floor(rd.bossHp * Math.max(0.6, strengthPct / 100));
  const prevRank = gate.rank;
  Object.assign(gate, {
    rank, rankData: rd, hiddenRank: true, isDouble: true, doublePending: false, doubleFrom: prevRank,
    strengthPct, strengthLabel: GateManager.strengthLabel(strengthPct),
    currentFloor: 1, totalFloors: floors, monsters,
    boss: { name: bossName, baseName: (bossData && bossData.baseName) || bossName, family: (themed && themed.theme) || null, hp: bossHp, maxHp: bossHp, defeated: false },
    theme: (themed && themed.theme) || null,
    nexusLoot: Math.floor((gate.nexusLoot || 1000) * 2), crystalLoot: Math.floor((gate.crystalLoot || 100) * 2),
    accumulatedTreasure: { nexus: 0, crystals: 0 }, damageDealt: {}, monstersKilled: 0, calibrated: null, floorClearedAt: null, _wipeSalvaged: false,
    cleared: false, active: true, lootDistributed: false,
  });
  // Only the survivors go on — fallen hunters stay fallen; the sealed gate admits nobody.
  gate.raid.members = (gate.raid.members || []).filter(m => { const u = db && db.users && db.users[m.id]; return u ? (u.stats && u.stats.hp > 0) : (m.hp == null || m.hp > 0); });
  gate.raid.status = 'active'; gate.raid.lastTurnAt = Date.now(); gate.raid.doubleStartedAt = Date.now();
  try { require('../utils/CombatReset').clearParty(db, gate.raid.members); } catch (e) {}
  try { calibrateToParty(gate, gate.raid, db); } catch (e) {}
  try { applyMonsterScaling(gate); } catch (e) {}
  return { ok: true, rank, floors, survivors: gate.raid.members.length };
}
// Survivors of a cleared double dungeon each choose a Blessed or Cursed box (/box, any tier).
function grantDoubleBoxes(gate, db) {
  const out = [];
  for (const m of (gate.raid && gate.raid.members) || []) {
    const u = db && db.users && db.users[m.id]; if (!u || !(u.stats && u.stats.hp > 0)) continue;
    u.pendingBoxes = (Number(u.pendingBoxes) || 0) + 1; u.freeBoxes = (Number(u.freeBoxes) || 0) + 1;
    out.push(m.id);
  }
  return out;
}

// ── Push #74: party-calibrated severity ─────────────────────────
// The gate spawned with a random 60–100% strength before anyone joined. At
// raid start we know the party: total power vs the rank's expected power per
// hunter decides how hard the monsters hit and how much HP they carry.
//   ratio = partyPower / (expectedPowerForRank × members)
//   severity = clamp(0.70 … 1.60, 0.55 + ratio × 0.55)  → stronger parties
//   face stronger monsters, weak parties get a fair fight.
// LUCK: each member with an active Luck Potion / luck stat shaves severity
// (max −15% total). The result is shown on the raid-start card.
const RANK_EXPECTED_POWER = { E: 1500, D: 3500, C: 7000, B: 14000, A: 28000, S: 55000 };
function partyLuck(raid, db) {
  let luck = 0;
  for (const m of raid.members || []) {
    const u = db && db.users ? db.users[m.id] : null;
    if (!u) continue;
    const lp = u.activeEffects && u.activeEffects.luckPotion;
    if (lp && lp.active && (!lp.expiresAt || lp.expiresAt > Date.now())) luck += 5;
    luck += Math.min(5, Number(u.stats && u.stats.luck || 0) / 10);
  }
  return Math.min(15, luck);
}
// Push #85: a hunter's REAL total stats (base + gear + weapon + title + pet
// + Last Gift), exactly what /stats displays. Used for calibration instead of
// the abstract "power" score, which under-counted gear and made monsters weak.
function totalStatsOf(u, jid) {
  const st = u.stats || {};
  let g = { hp: 0, atk: 0, def: 0, speed: 0 };
  try { g = require('../utils/GearSystem').getEquippedBonuses(u) || g; } catch (e) {}
  let tb = {};
  try { tb = require('../utils/TitleSystem').getEquippedBoost(u) || {}; } catch (e) {}
  let pm = { atk: 0 };
  try { pm = require('../utils/ClassPower').passiveMultipliers(u) || pm; } catch (e) {}
  let petA = 0, petD = 0;
  try { const PC = require('../utils/PetCombat'); petA = PC.atkBonus(jid || u.jid) || 0; petD = PC.defBonus(jid || u.jid) || 0; } catch (e) {}
  let gift = 1;
  try { gift = require('../utils/PetManager').lastGiftMultiplier(u) || 1; } catch (e) {}
  let auraA = 1; try { auraA = require('../utils/AuraSystem').AuraSystem.atkMult(u); } catch (e) {} // Push #96f
  const atk = Math.floor(((st.atk || 10) + (g.atk || 0) + (u.weapon?.attack || u.weapon?.bonus || 0) + (tb.atk || 0) + petA) * (1 + (pm.atk || 0) / 100) * gift * auraA);
  const def = Math.floor(((st.def || 5) + (g.def || 0) + (u.weapon?.defense || 0) + (tb.def || 0) + petD) * gift);
  const maxHp = Math.floor(((st.maxHp || 100) + (g.hp || 0) + (tb.maxHp || 0) + (u.weapon?.hp || 0)) * gift);
  const speed = Math.floor(((st.speed || 10) + (g.speed || 0) + (tb.speed || 0)) * gift);
  return { atk, def: Math.floor(def * (1 + (pm.def || 0) / 100)), maxHp, speed: Math.floor(speed * (1 + (pm.speed || 0) / 100)), hp: Math.min(st.hp || maxHp, maxHp), level: Number(u.level) || 1 };
}

function calibrateToParty(gate, raid, db) {
  if (!gate || !raid || !Array.isArray(raid.members) || !raid.members.length) return null;
  if (gate.calibrated) return gate.calibrated;
  // Push #88: monsters are calibrated to the party's TOTAL accumulated stats
  // (ATK + DEF + HP + SPD across every hunter, with gear/titles/pets/passives)
  // AND the hunters' levels — not just a "power" figure. Severity runs up to
  // 10× the rank's base monster so a maxed party still meets a real threat,
  // while a fresh party at the right rank sees ~1×. Every floor is stronger
  // than the last (see floorMultiplier).
  let sumAtk = 0, sumDef = 0, sumHp = 0, sumSpd = 0, sumLvl = 0, n = 0;
  for (const m of raid.members) {
    const u = db && db.users ? db.users[m.id] : null;
    if (!u) continue;
    n++;
    const ts = totalStatsOf(u, m.id);
    sumAtk += ts.atk; sumDef += ts.def; sumHp += ts.maxHp; sumSpd += ts.speed; sumLvl += ts.level;
  }
  if (!n) return null;
  const rd = GATE_RANKS[gate.rank] || GATE_RANKS.E;
  const [lo, hi] = rd.monsterRange || [15, 45];
  const rankAtk = (lo + hi) / 2;                      // what the rank table assumes a monster hits for
  // Expected TOTAL for a party that "belongs" at this rank: each hunter ≈
  // 2.5× rank ATK offence, 6× rank ATK worth of DEF+HP/8, 20 speed, and the
  // rank's typical level.
  const rankLevel = { E: 8, D: 18, C: 30, B: 45, A: 65, S: 85 }[gate.rank] || 8;
  const expectedPer = rankAtk * 2.5 + rankAtk * 6 + 20;
  const total = sumAtk + sumDef + sumHp / 8 + sumSpd;
  const statRatio = total / Math.max(1, expectedPer * n);
  const avgLvl = sumLvl / n;
  const lvlRatio = avgLvl / rankLevel;
  // Blend: stats carry most of the weight, level keeps high-rank hunters honest
  // even if they walk in under-geared. sqrt(n): more hunters → tougher gate.
  const ratio = (statRatio * 0.7 + lvlRatio * 0.3) * Math.sqrt(n);
  const luck = partyLuck(raid, db);
  let severity = 0.55 + ratio * 0.75;
  severity = Math.max(1.0, Math.min(10.0, severity));
  severity = severity * (1 - luck / 100);
  severity = Math.round(severity * 100) / 100;
  const expected = Math.round(expectedPer * n);
  gate.calibrated = { severity, label: null, partyPower: Math.floor(total), expected, luck, members: n, avgLevel: Math.round(avgLvl), avgSpeed: Math.round(sumSpd / n), at: Date.now() };
  applyMonsterScaling(gate);
  const label = severityLabel(severity);
  gate.calibrated.label = label;
  // The strength shown everywhere IS the applied severity from now on.
  gate.preRollStrengthPct = gate.preRollStrengthPct || gate.strengthPct || null;
  gate.strengthPct = Math.round(severity * 100);
  gate.strengthLabel = label;
  gate.severityNote = `party total stats ${Math.floor(total).toLocaleString()} · avg Lv.${Math.round(avgLvl)} vs rank baseline ${expected.toLocaleString()} (${n} hunter${n === 1 ? '' : 's'})${luck ? ` · 🍀 luck −${luck}%` : ''}`;
  return gate.calibrated;
}

function severityLabel(severity) {
  return severity >= 7 ? '💀 CATACLYSM' : severity >= 4.5 ? '☠️ NIGHTMARE' : severity >= 2.5 ? '🔴 Severe' : severity >= 1.6 ? '🟠 Hard' : severity >= 1.15 ? '🟡 Standard' : '🟢 Mild';
}

// Push #88: every floor is stronger than the one before — +18% per floor on
// top of the party severity, boss floor gets the full stack plus 25%.
function floorMultiplier(gate, floor) {
  const f = Math.max(1, Number(floor) || 1);
  return 1 + (f - 1) * 0.18;
}

// Scale every live monster + the boss from their BASE stats using severity ×
// floor multiplier. Idempotent — safe to call on every calibrate/advance.
// Push #88n: global monster buff — ATK +70%, DEF +40% — applied on top of the
// level/floor/severity scaling (which stays exactly as it was).
const MON_ATK_BUFF = 1.7 * RAID_X2, MON_DEF_BUFF = 1.4 * RAID_X2 * 1.75 * 2.2, MON_HP_BUFF = 1.5, MON_SPD_BUFF = 1.75 * 2 * 1.4 /* Push #96h-c: +40% */; // Push #96d: DEF ×2.2, SPD ×2 // Push #88o: +50% HP · Push #88q: raid ATK/DEF ×2 again · Push #88z: DEF +75%, SPD +75%
// Push #89: A–E gates are 25% softer (monsters AND boss); S+ untouched.
const RANK_SOFTEN = { A: 0.75, B: 0.75, C: 0.75, D: 0.75, E: 0.75 };
function rankSoften(rank) { return RANK_SOFTEN[String(rank || '').toUpperCase()] || 1; }
const LEAK_MULT = 3; // Push #96h
const SPEED_RANK_FACTOR = { E: 0.55, D: 0.65, C: 0.75, B: 0.85, A: 0.95, S: 1.10, SS: 1.25 };
function _types() { try { return require('../utils/MonsterTypes'); } catch (e) { return null; } }
function _anchorSpeed(gate, roleFactor = 1, boss = false) {
  const avg = (gate && gate.calibrated && gate.calibrated.avgSpeed) || 0;
  if (!avg) return 0;
  const rf = SPEED_RANK_FACTOR[String(gate.rank || 'E').toUpperCase()] || 0.6;
  return avg * rf * Math.max(0.5, Math.min(1.8, roleFactor)) * (boss ? 1.15 : 1) * 1.4; // Push #96h-c: +40% monster speed everywhere
}
function applyMonsterScaling(gate) {
  const severity = ((gate.calibrated && gate.calibrated.severity) || 1) * rankSoften(gate.rank);
  for (const mon of gate.monsters || []) {
    if (!mon || mon.defeated) continue;
    if (!mon._base) mon._base = { hp: mon.maxHp || mon.hp || 10, atk: mon.atk || 5, def: mon.def || 0, speed: mon.speed || 10 };
    const mult = severity * floorMultiplier(gate, mon.floor);
    const wasFull = !(typeof mon.hp === 'number' && typeof mon.maxHp === 'number' && mon.hp < mon.maxHp);
    const hpPct = wasFull ? 1 : Math.max(0, mon.hp / Math.max(1, mon.maxHp));
    mon.maxHp = Math.max(5, Math.floor(mon._base.hp * mult * MON_HP_BUFF));
    mon.hp = Math.max(1, Math.floor(mon.maxHp * hpPct));
    mon.atk = Math.max(1, Math.floor(mon._base.atk * mult * MON_ATK_BUFF));
    mon.def = Math.floor(mon._base.def * mult * 0.8 * MON_DEF_BUFF);
    mon.speed = Math.max(1, Math.round(mon._base.speed * (0.8 + Math.min(severity, 6) * 0.2) * MON_SPD_BUFF));
    // Push #96h: SPEED anchored to the party. Base roll was ~10 → ×3.5 = 35 while
    // hunters run 150–300, so beasts never out-paced anyone. Now a beast's speed
    // is at least (party avg speed × rank factor × role profile).
    mon.speed = Math.max(mon.speed, Math.round(_anchorSpeed(gate, mon._base.speed / 10, false)));
    // Push #96h: family body types (armour → DEF, sleek → SPD/crit, hive → HP…). Buff only.
    { const TM = _types(); if (TM) { const tm = TM.mults(mon); mon.maxHp = Math.floor(mon.maxHp * tm.hp); mon.hp = Math.max(1, Math.floor(mon.maxHp * hpPct)); mon.atk = Math.floor(mon.atk * tm.atk); mon.def = Math.floor(mon.def * tm.def); mon.speed = Math.round(mon.speed * tm.speed); mon.critBonus = tm.crit; mon.typeLabel = tm.label; } }
    // Push #96h: a LEAKED beast is 3× what it would be in its own habitat.
    if (mon.leaked) { mon.maxHp = Math.floor(mon.maxHp * LEAK_MULT); mon.hp = Math.max(1, Math.floor(mon.maxHp * hpPct)); mon.atk = Math.floor(mon.atk * LEAK_MULT); mon.def = Math.floor(mon.def * LEAK_MULT); mon.speed = Math.round(mon.speed * 1.5); }
    mon._raid = true; mon.rank = mon.rank || gate.rank; // Push #88q: raid ×2 package + initiative
  }
  // Push #88z: elites are ALWAYS exactly 2× the (scaled) monsters of the floor before them.
  try {
    const bossFloor = gate.totalFloors || 1;
    const prev = (gate.monsters || []).filter(m => m && m.floor === Math.max(1, bossFloor - 1) && !m.elite);
    if (prev.length) {
      const avg = (k) => prev.reduce((a, m) => a + (Number(m[k]) || 0), 0) / prev.length;
      for (const e of (gate.monsters || []).filter(m => m && m.elite && !m.defeated && !m.revived)) {
        const pct = (typeof e.hp === 'number' && typeof e.maxHp === 'number' && e.hp < e.maxHp) ? Math.max(0, e.hp / Math.max(1, e.maxHp)) : 1;
        e.maxHp = Math.max(5, Math.floor(avg('maxHp') * 2)); e.hp = Math.max(1, Math.floor(e.maxHp * pct));
        e.atk = Math.max(1, Math.floor(avg('atk') * 2)); e.def = Math.floor(avg('def') * 2); e.speed = Math.max(1, Math.round(avg('speed') * 2));
        e.skills = []; e.noStatus = true;
      }
    }
  } catch (e) {}
  if (gate.boss && !gate.boss.defeated) {
    if (!gate.boss._base) {
      const _rd = GATE_RANKS[gate.rank] || GATE_RANKS.E;
      const _baseAtk = gate.boss.atk || Math.floor(((_rd.monsterRange || [15, 45])[1]) * 0.20);
      gate.boss._base = { hp: gate.boss.maxHp || gate.boss.hp || 400, atk: _baseAtk, def: gate.boss.def || Math.floor(_baseAtk * 0.25) };
    }
    const mult = severity * floorMultiplier(gate, gate.totalFloors) * 1.25;
    const wasFull = !(typeof gate.boss.hp === 'number' && typeof gate.boss.maxHp === 'number' && gate.boss.hp < gate.boss.maxHp);
    const hpPct = wasFull ? 1 : Math.max(0, gate.boss.hp / Math.max(1, gate.boss.maxHp));
    gate.boss.maxHp = Math.max(50, Math.floor(gate.boss._base.hp * mult * MON_HP_BUFF));
    gate.boss.hp = Math.max(1, Math.floor(gate.boss.maxHp * hpPct));
    if (gate.boss._base.atk) gate.boss.atk = Math.max(1, Math.floor(gate.boss._base.atk * mult * MON_ATK_BUFF));
    gate.boss.def = Math.floor((gate.boss._base.def || 0) * mult * 0.8 * MON_DEF_BUFF);
    gate.boss._raid = true; gate.boss.isBoss = true; gate.boss.rank = gate.boss.rank || gate.rank;
    if (!gate.boss.speed) gate.boss.speed = 14 + (({ E: 0, D: 2, C: 4, B: 6, A: 9, S: 12 })[gate.rank] || 0) * 2;
    if (gate.boss._base.speed == null) gate.boss._base.speed = gate.boss.speed; else gate.boss.speed = gate.boss._base.speed; // Push #96h: recompute from base (no compounding)
    // Push #96h: boss speed anchored to the party too (it was a flat 14–38, never scaled).
    gate.boss.speed = Math.max(gate.boss.speed, Math.round(_anchorSpeed(gate, 1, true)));
    { const TM = _types(); if (TM && !gate.boss._typedBoss) { const tm = TM.mults(gate.boss); gate.boss._typedBoss = true; gate.boss.typeLabel = tm.label; gate.boss.critBonus = tm.crit; gate.boss._typeMult = tm; }
      const tm = gate.boss._typeMult; if (tm) { gate.boss.maxHp = Math.floor(gate.boss.maxHp * tm.hp); gate.boss.hp = Math.max(1, Math.floor(gate.boss.maxHp * hpPct)); gate.boss.atk = Math.floor(gate.boss.atk * tm.atk); gate.boss.def = Math.floor(gate.boss.def * tm.def); gate.boss.speed = Math.round(gate.boss.speed * tm.speed); } }
  }
}

// ── Push #88: HEALER AGGRO ─────────────────────────────────────────
// After a hunter casts a heal/buff on a teammate, high-rank monsters (B+ and
// every boss) remember them and may retarget their counter-attack onto the
// healer instead of the attacker. Aggro lasts 3 monster turns.
function markHealerAggro(gate, healerJid, healerName) {
  if (!gate || !gate.raid) return;
  gate.raid.healerAggro = { jid: healerJid, name: healerName, turns: 3, at: Date.now() };
}
function pickAggroTarget(gate, attackerJid, db, isBoss) {
  const raid = gate && gate.raid;
  const ag = raid && raid.healerAggro;
  if (!ag || (ag.turns || 0) <= 0) return null;
  const rankHigh = ['B', 'A', 'S', 'SS', 'DISASTER'].includes(String(gate.rank || '').toUpperCase());
  if (!rankHigh && !isBoss) return null;
  if (GKM.normaliseJid(ag.jid) === GKM.normaliseJid(attackerJid)) { ag.turns -= 1; return null; } // healer struck — normal counter
  const chance = isBoss ? 70 : 55;
  ag.turns -= 1;
  if (ag.turns <= 0) delete raid.healerAggro;
  if (Math.random() * 100 > chance) return null;
  const healer = db && db.users && (db.users[ag.jid] || Object.values(db.users).find(u => u && u.jid && GKM.normaliseJid(u.jid) === GKM.normaliseJid(ag.jid)));
  const gm = raid.members.find(m => GKM.normaliseJid(m.id) === GKM.normaliseJid(ag.jid));
  if (!healer || !gm || (healer.stats?.hp ?? 0) <= 0) { delete raid.healerAggro; return null; }
  // Push #88f: never aggro a non-Healer (stale entries from older builds).
  try { const CPa = require('../utils/ClassPower'); if (!/^healer$/i.test(String(CPa.baseClassName(healer) || ''))) { delete raid.healerAggro; return null; } } catch (e) {}
  return { jid: ag.jid, name: gm.name || healer.name || ag.name, player: healer, member: gm };
}

// ── Push #88: SUPPORT CAST (heal / buff a teammate) — no turn spent ──────
// Resolves a heal- or buff-type skill from `caster` onto `target` (a party
// member, may be the caster). Returns { ok, lines, healed, error }.
function supportCast(caster, casterJid, target, targetJid, skillName, gate, db) {
  const SC = require('../utils/SkillCatalog');
  const res = SC.resolveSkill(caster, skillName, { allowLibrary: true });
  if (!res.ok) return { ok: false, error: res.error };
  const skill = res.skill, entry = res.entry || skill;
  const type = String(entry.type || skill.type || '').toLowerCase();
  const isHeal = type === 'heal' || Number(entry.healingPct) > 0;
  const isBuff = type === 'buff' || (entry.buffs || []).length > 0;
  if (!isHeal && !isBuff) return { ok: false, error: `*${skill.name}* is not a heal or buff — cast it on the monster with /skill ${skill.name}.`, notSupport: true };
  const cd = SC.onCooldown(caster, entry);
  if (!cd.ready) return { ok: false, error: `*${skill.name}* is on cooldown! (${Math.ceil(cd.msLeft / 1000)}s)` };
  // ── Push #88d: HEALING RULES ─────────────────────────────────────────────
  //  • Only the HEALER class may heal a TEAMMATE or the PARTY. Every other
  //    class's heal is SELF-ONLY and costs 2× energy (a big mana commitment).
  //  • Party-wide heals exist only for HIGH-QUALITY Healers (quality ≥ 70) and
  //    cost the caster HP: 8% + 0.4% per heal% — the stronger the heal, the
  //    more of the caster's own life it burns (never below 1 HP).
  //  • Buff skills keep working on self / @teammate as before.
  const CPq = (() => { try { return require('../utils/ClassPower'); } catch (e) { return null; } })();
  const casterBase = CPq && CPq.baseClassName ? String(CPq.baseClassName(caster) || '') : String(caster.classBase || caster.class || '');
  const isHealerClass = /^healer$/i.test(casterBase);
  const casterQuality = CPq && CPq.quality ? Number(CPq.quality(caster)) || 0 : Number(caster.classQuality) || 0;
  const text = `${entry.effect || ''} ${entry.description || ''} ${skill.desc || ''}`.toLowerCase();
  // "removes ALL buffs" / "all debuffs" is not a party heal — only ally/party wording counts.
  const textForScope = text.replace(/(?:all|every)\s+(?:your\s+)?(?:de)?buffs?/g, ' ').replace(/all\s+(?:status\s+)?(?:effects|ailments)/g, ' ');
  const partyWorded = /\b(all\s+(?:allies|party|members|alive\s+allies|ko'd\s+allies)|entire\s+party|every\s+ally|party(?:\s+members)?|allies|team(?:mates)?)\b/.test(textForScope);
  let cost = SC.effectiveCost(entry, caster);
  let party = false;
  // Push #94: a BUFF that says "party / all allies / AOE buff" buffs the whole
  // party for ANY class (heals stay Healer-gated below).
  const partyBuffOnly = isBuff && !isHeal && (partyWorded || !!entry.party);
  if (partyBuffOnly) party = true;
  if (isHeal) {
    if (!isHealerClass) {
      // Non-healers: self only, double energy.
      if (target && target !== caster && targetJid && casterJid && GKM.normaliseJid(targetJid) !== GKM.normaliseJid(casterJid)) {
        return { ok: false, error: `Only a *Healer* can heal a teammate. *${skill.name}* can only heal yourself: /skill ${skill.name}` };
      }
      target = caster; targetJid = casterJid;
      cost = cost * 2;
    } else if (partyWorded) {
      if (casterQuality < 70) return { ok: false, error: `*${skill.name}* is a party-wide heal — it needs a high-quality Healer (class quality ≥ 70%, yours is ${casterQuality}%). Heal one teammate instead: /skill ${skill.name} @teammate` };
      party = true;
    }
  }
  if ((caster.stats?.energy || 0) < cost) return { ok: false, error: `Not enough energy for *${skill.name}*! Need ${cost}${!isHealerClass && isHeal ? ' (self-heals cost double for non-Healers)' : ''}.` };
  // Push #91: HEALER BACKLASH — healing ANOTHER hunter costs the Healer HP
  // (single 12% · party 8%+0.4%/heal%), cut by skill level (Lv5 = −80%).
  // Self-heals are free. Checked before the heal so the caster feels it.
  const HB = require('../utils/HealerBacklash');
  let hpToll = 0, tollPct = 0, _hLv = 1;
  const _healsOther = isHeal && isHealerClass && (party || (target && target !== caster && targetJid && casterJid && GKM.normaliseJid(targetJid) !== GKM.normaliseJid(casterJid)));
  if (_healsOther) {
    const hpPct = Number(entry.healingPct) || 20;
    _hLv = Number(skill.level || entry.level || 1) || 1;
    tollPct = HB.tollPct({ party, healPct: hpPct, level: _hLv, others: 1 });
    const cmax = (() => { try { return require('../utils/GearSystem').effectiveMaxHp(caster); } catch (e) { return caster.stats.maxHp || 100; } })();
    hpToll = Math.floor(cmax * tollPct / 100);
    if ((caster.stats.hp || 0) <= hpToll) return { ok: false, error: `*${skill.name}* would cost *${hpToll} HP* (${tollPct.toFixed(1)}% of your max — healer backlash) — you only have ${caster.stats.hp}. Heal yourself first.` };
    // (deducted AFTER the heal loop — on a party heal the caster is a target
    //  too, so paying first would just be healed back by their own cast.)
  }
  let severeHealed = null;
  caster.stats.energy = Math.max(0, (caster.stats.energy || 0) - cost);
  SC.setCooldown(caster, entry);
  let healPower = 1;
  try { const CP = require('../utils/ClassPower'); healPower = 1 + ((CP.passiveMultipliers(caster).healPower || 0) / 100); } catch (e) {}
  const lines = [];
  const targets = [];
  if (party && gate && gate.raid && gate.raid.members) {
    // Every living party member (including the caster).
    for (const m of gate.raid.members) {
      const u = db && db.users ? (db.users[m.id] || Object.values(db.users).find(x => x && x.jid && GKM.normaliseJid(x.jid) === GKM.normaliseJid(m.id))) : null;
      if (u && (u.stats?.hp ?? 0) > 0) targets.push({ u, name: m.name || u.name });
    }
  }
  if (!targets.length) targets.push({ u: target, name: target.name });
  let healedTotal = 0;
  const effMax = (pl) => { try { return require('../utils/GearSystem').effectiveMaxHp(pl); } catch (e) { return (pl.stats && pl.stats.maxHp) || 100; } };
  for (const t of targets) {
    const u = t.u;
    if (isHeal) {
      let pct = Number(entry.healingPct) || 20;
      let recvBoost = 1;
      try { const CP = require('../utils/ClassPower'); recvBoost = 1 + ((CP.passiveMultipliers(u).healReceived || 0) / 100); } catch (e) {}
      const max = effMax(u);
      const before = u.stats.hp || 0;
      if (_healsOther && u !== caster && before > 0 && before / max < HB.SEVERE_HP_PCT / 100) severeHealed = t.name;
      const amt = Math.max(1, Math.floor(max * pct / 100 * healPower * recvBoost));
      u.stats.hp = Math.min(max, before + amt);
      const got = u.stats.hp - before;
      healedTotal += got;
      lines.push(`💚 *${t.name}* +${got} HP → ${u.stats.hp}/${max}`);
      // energy component ("and X% max energy")
      // Push #91: Renew/Mass Renewal really restore their stated energy ("15% of max energy").
      if (!entry.energyPct) { const em = text.match(/(\d+)%\s*(?:of\s+)?(?:their\s+)?(?:max(?:imum)?\s*)?energy/); if (em && u.stats.maxEnergy) { const e = Math.floor(u.stats.maxEnergy * parseInt(em[1], 10) / 100); u.stats.energy = Math.min(u.stats.maxEnergy, (u.stats.energy || 0) + e); lines.push(`⚡ *${t.name}* +${e} energy`); } }
      if (!entry.cleanse && /remov|clear|cleanse|purif/.test(text) && Array.isArray(u.statusEffects) && u.statusEffects.length) { const n = u.statusEffects.length; u.statusEffects = []; lines.push(`✨ *${t.name}* cleansed (${n} effect${n === 1 ? '' : 's'})`); }
    }
    if (isBuff) {
      const UC = require('../utils/UnifiedCombat');
      // Push #88w: Monster-class transformations — self only, ×N all stats for N turns.
      try {
        const TF = require('../utils/Transformation');
        if (TF.isTransformSkill(entry)) {
          if (u !== caster) { lines.push(`❌ Transformations can only be cast on yourself.`); continue; }
          const _tr = TF.cast(u, entry);
          if (!_tr.ok) { caster.stats.energy = Math.min(caster.stats.maxEnergy || 100, (caster.stats.energy || 0) + cost); lines.push(`❌ ${_tr.error}`); continue; }
          lines.push(..._tr.lines);
          try { const rm = (gate.raid?.members || []).find(x => x.id === casterJid || GKM.normaliseJid(x.id) === GKM.normaliseJid(casterJid)); if (rm) { rm.hp = u.stats.hp; rm.maxHp = u.stats.maxHp; } } catch (e) {}
          continue;
        }
      } catch (e) {}
      const buffs = (entry.buffs || []).length ? entry.buffs : [];
      if (buffs.length) {
        const notes = UC.applyMoveBuffs({ name: skill.name, buffs, debuffs: [], selfDebuffs: [] }, u, u);
        for (const b of buffs) lines.push(`⬆️ *${t.name}* ${String(b.stat).toUpperCase()} +${Math.abs(Number(b.amount) || 0)}% (${b.duration || 2}t)`);
        void notes;
      }
    }
    // Push #94: the explicit support contract — shield / immunity / energy /
    // regen / damage-taken / reflect / cleanse — exactly as the description says.
    try { const _sf = SC.applySupportFields(entry, caster, u, { name: t.name, healPower, effMaxOf: effMax }); lines.push(..._sf.lines); } catch (e) {}
  }
  // Push #88f: aggro ONLY for the Healer class and ONLY on an actual heal.
  if (gate && isHeal && isHealerClass) markHealerAggro(gate, casterJid, caster.name);
  let stunned = false;
  if (hpToll > 0) { caster.stats.hp = Math.max(1, (caster.stats.hp || 0) - hpToll); lines.push(`🩸 *${caster.name}* pays ${hpToll} HP of backlash (${tollPct.toFixed(1)}%${_hLv > 1 ? `, Lv${_hLv} −${HB.reductionPct(_hLv)}%` : ''}) → ${caster.stats.hp}`); }
  if (severeHealed) { HB.stunHealer(caster); stunned = true; lines.push(`💫 *${caster.name}* is STUNNED — pulling *${severeHealed}* back from under ${HB.SEVERE_HP_PCT}% HP was a shock (${HB.STUN_TURNS} turn).`); }
  return { ok: true, skill, lines, healed: healedTotal, party: targets.length > 1, isHeal, isBuff, energyCost: cost, hpToll, stunned };
}

// ── Status ──────────────────────────────────────────────────────
function statusOf(gate, db) {
  const raid = gate.raid;
  const rd = GATE_RANKS[gate.rank] || GATE_RANKS['E'];
  const floor = gate.currentFloor;
  const floorMonsters = (gate.monsters || []).filter(m => m.floor === floor && !m.defeated);
  const totalMonsters = (gate.monsters || []).filter(m => m.floor === floor).length;
  // Push #89: elites are the boss's party — they never block the boss fight.
  const bossReady = floor >= gate.totalFloors && floorMonsters.filter(m => !m.elite).length === 0 && !gate.boss.defeated;

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `${rd.emoji} *${rd.label}* [${gate.id}]`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ];
  if (raid) {
    const solo = raid.members.length <= 1;
    lines.push(solo ? `🎮 *SOLO RAID* (you opened it)` : `👥 *PARTY RAID*`);
    if (!solo && raid.status === 'recruiting') {
      lines.push(`📌 Status: *Recruiting* — leader: *${raid.leader}*`);
      lines.push(raid.isAffiliate
        ? `🔓 *Affiliate key — open to non-guild hunters*`
        : `🏰 *Guild key — open to owning-guild members only*`);
      lines.push(`👥 *READY (${raid.members.filter(m=>m.ready).length}/${raid.members.length})*:`);
      raid.members.forEach(m => lines.push(`  ${m.id === raid.leader ? '👑' : '⚔️'} ${m.name} ${m.ready ? '✅' : '⏳'}`));
      lines.push(``, `📌 Next: leader uses */party raid* when all are ready.`);
      return lines.join('\n');
    }
  }
  lines.push(`🗺️ Floor: *${floor}/${gate.totalFloors}*`);
  lines.push(`👾 Monsters: ${totalMonsters - floorMonsters.length}/${totalMonsters} cleared`);
  if (bossReady) { lines.push(`🏆 *BOSS READY — /gateraid boss*`); const _bp = floorMonsters.filter(m => m.elite); if (_bp.length) lines.push(`⚜️ Boss party: ${_bp.map(m => `${m.name} (${m.hp} HP)`).join(' · ')} — they strike beside the boss`); }
  lines.push(``);
  lines.push(raid && raid.members.length > 1 ? `*Party members (${raid.members.length}):*` : `*Your status:*`);
  (raid ? raid.members : [])
    .slice(0, 12)
    .forEach(m => lines.push(`  ${m.id === raid.leader ? '👑' : '⚔️'} *${m.name}* ${m.hp}/${m.maxHp}❤️ ${m.energy}/${m.maxEnergy}💙`));
  lines.push(``);
  lines.push(`💀 Floor ${floor} monsters:`);
  floorMonsters.slice(0, 6).forEach(m => lines.push(`  ${m.name} — HP ${m.hp}/${m.maxHp}`));
  if (floorMonsters.length > 6) lines.push(`  ...and ${floorMonsters.length - 6} more`);
  lines.push(``, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`⚔️ /gateraid attack | 🔮 /gateraid skill <name>`);
  if (floorMonsters.length === 0 && !bossReady) lines.push(`➡️ /gateraid advance`);
  if (bossReady) lines.push(`🏆 /gateraid boss`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  return lines.join('\n');
}

// ── Final-blow monster drops ─────────────────────────────────────
function monsterKilledBy(gate, monster, sender, db) {
  const lines = [];
  const player = db.users?.[sender];
  if (!player) return lines;

  if (!player.inventory) player.inventory = { materials: [], items: [], petFood: {} };
  if (!player.inventory.materials) player.inventory.materials = [];
  if (!player.inventory.items) player.inventory.items = [];

  // Material drop from monster — single commit to items (no more double-push
  // into the legacy bucket, which also duplicated the /inv display).
  const drop = GateManager.rollMonsterKillDrop(gate.rank, monster.name, player);
  if (drop) {
    RI.grantItem(player, { name: drop.name, type: 'material', rarity: drop.rarity || (gate.rank === 'S' || gate.rank === 'A' ? 'rare' : 'common'), fromGate: gate.id }, 'gate');
    lines.push(`🎁 *DROP → ${player.name}* (final blow): *${drop.name}*`);
  } else {
    const { rollBaseMaterial } = require('../data/MonsterDrops');
    // Push #71: 1-in-4 misses become the rank's Mana Essence (SL recipe binder).
    const baseMat = Math.random() < 0.25 ? `${gate.rank || 'E'}-Rank Mana Essence` : rollBaseMaterial(gate.rank || 'E');
    if (baseMat) {
      RI.grantItem(player, { name: baseMat, type: 'material', rarity: 'common', fromGate: gate.id }, 'gate');
      lines.push(`🎁 *DROP → ${player.name}*: *${baseMat}*`);
    }
  }

  // Push #88e: Pet Food and Health Potions are NO LONGER raid drops (shop-only).

  return lines;
}

// ── On full clear (boss defeated) — distribute loot ─────────────
function clearGate(gate, key, keyData, db, saveDatabase, opts = {}) {
  const keepOpen = !!opts.keepOpen; // Push #96d: double dungeon — pay out floor 1 rewards but keep the gate alive
  const raid = gate.raid || {};
  const raiders = raid.members?.length ? raid.members : [];
  try { require('../utils/CombatReset').clearParty(db, raiders); } catch (e) {} // Push #92: battle over → clean slate

  const nexus   = Math.floor(gate.nexusLoot || 0);
  const crystals = Math.floor(gate.crystalLoot || 0);

  const guild = keyData?.guildName ? GKM.findGuild(db, keyData.guildName) : null;
  const participantIds = new Set(raiders.map(m => m.id));
  const guildName = keyData?.guildName;

  const affPool = Object.values(db.affiliates || {}).filter(a =>
    a.guildName === guildName && participantIds.has(a.jid) && (a.pct || a.affiliatePct || 0) > 0
  );

  let affPoolPct = 0;
  if (affPool.length) affPoolPct = Math.max(...affPool.map(a => Number(a.pct || a.affiliatePct) || 0));

  const payouts = {};
  let allocatedPct = 0;

  if (affPoolPct > 0 && affPool.length) {
    const perAff = affPoolPct / affPool.length;
    for (const aff of affPool) {
      payouts[aff.jid] = payouts[aff.jid] || { gold: 0, crystals: 0, kind: 'affiliate', percent: 0 };
      payouts[aff.jid].gold   += Math.floor(nexus * (perAff / 100));
      payouts[aff.jid].crystals += Math.floor(crystals * (perAff / 100));
      payouts[aff.jid].percent += perAff;
    }
    allocatedPct += affPoolPct;
  }

  const contractPayouts = {};
  if (keyData?.contracts) {
    for (const [jid, pct] of Object.entries(keyData.contracts)) {
      if (!participantIds.has(jid)) continue;
      payouts[jid] = payouts[jid] || { gold: 0, crystals: 0, kind: 'contract', percent: 0 };
      payouts[jid].gold   += Math.floor(nexus * (pct / 100));
      payouts[jid].crystals += Math.floor(crystals * (pct / 100));
      payouts[jid].percent += Number(pct);
      allocatedPct += Number(pct);
    }
  }

  const totalPct = Math.max(allocatedPct, 0);
  const scale = totalPct > 100 ? 100 / totalPct : 1;

  let guildNexus = nexus, guildCrystals = crystals;
  const affiliatePayouts = {};
  for (const [jid, p] of Object.entries(payouts)) {
    const hunter = db.users?.[jid];
    let _auraL = 1; try { if (hunter) _auraL = require('../utils/AuraSystem').AuraSystem.lootMult(hunter); } catch (e) {} // Push #96f: aura title Gate Loot%
    const goldCut = Math.floor(p.gold * scale * _auraL);
    const crystalCut = Math.floor(p.crystals * scale * _auraL);
    if (hunter) {
      hunter.gold = (hunter.gold || 0) + goldCut;
      hunter.manaCrystals = (hunter.manaCrystals || 0) + crystalCut;
      if (goldCut > 0) {
        try { require('../utils/DailyQuestSystem').trackQuestProgress(hunter, 'goldEarn', goldCut); } catch(e){}
      }
    }
    affiliatePayouts[jid] = { gold: goldCut, crystals: crystalCut, kind: p.kind, percent: Number((p.percent * scale).toFixed(1)) };
    guildNexus -= goldCut;
    guildCrystals -= crystalCut;
    if (p.kind === 'contract') contractPayouts[jid] = { gold: goldCut, crystals: crystalCut, percent: p.percent };
  }
  guildNexus = Math.max(0, guildNexus);
  guildCrystals = Math.max(0, guildCrystals);

  let dest, destinationText;
  if (guild) {
    guild.treasury = (guild.treasury || 0) + guildNexus;
    guild.manaTreasury = (guild.manaTreasury || 0) + guildCrystals;
    // Push #88: guild raid counters were never incremented → /guild info showed 0 forever.
    guild.totalRaids = (guild.totalRaids || 0) + 1;
    guild.raidsCleared = (guild.raidsCleared || 0) + 1;
    guild.lastRaidClearedAt = Date.now();
    guild.raidsByRank = guild.raidsByRank || {};
    guild.raidsByRank[gate.rank || '?'] = (guild.raidsByRank[gate.rank || '?'] || 0) + 1;
    dest = guild.name || 'Guild';
    destinationText = `🏰 *${dest}* Treasury`;
  } else {
    // If solo hunter or no guild, remainder goes to party leader
    const leader = db.users?.[raid.leader || keyData?.ownedBy];
    if (leader) {
      leader.gold = (leader.gold || 0) + guildNexus;
      leader.manaCrystals = (leader.manaCrystals || 0) + guildCrystals;
      if (guildNexus > 0) {
        try { require('../utils/DailyQuestSystem').trackQuestProgress(leader, 'goldEarn', guildNexus); } catch(e){}
      }
      dest = leader.name;
      destinationText = `👤 *${leader.name}* Personal Balance`;
    } else {
      dest = 'Solo Hunter';
      destinationText = `👤 Personal Balance`;
    }
  }

  const wildPet = spawnWildPet(gate);
  let wildToken = null;
  if (wildPet && db) {
    wildToken = `WP-${Date.now()}-${Math.floor(Math.random() * 999)}`;
    if (!db.wildPets) db.wildPets = [];
    db.wildPets.push({
      token: wildToken,
      petId: wildPet.petId,
      name: wildPet.name,
      emoji: wildPet.emoji,
      rarity: wildPet.rarity,
      gate: gate.id,
      spawnedAt: Date.now(),
      expiresAt: Date.now() + 60 * 1000,
      caughtBy: null,
      attemptsUsed: 0, attemptLog: [], // Push #87: 3 shared /catch attempts
      forJids: raiders.map(m => m.id),
    });
    wildPet.token = wildToken;
  }

  // ── End-of-raid: recovery + XP for EVERY survivor ───────────────────
  //   • HP/energy: 50% of MAX is ADDED to whatever they have left. The old
  //     line SET hp to 50% of max, which healed a dying hunter and damaged a
  //     healthy one at the same time.
  //   • Everyone alive at the end gets XP, and LevelUpManager then runs so the
  //     level-up (UP, stats, skill unlocks) fires on the spot, plus Astra Pass
  //     and Battle Pass XP. Previously only the final-blow hunter was awarded
  //     via the boss handler.
  //   • Regen is locked briefly (RegenManager.endCombat) so the raid does not
  //     cascade into a full instant recovery the second it ends.
  let recovered = 0;
  const survivorIds = [];
  const WeeklyGuildWar = require('../utils/WeeklyGuildWar');
  let RegenMgr = null;
  try { RegenMgr = require('../utils/RegenManager'); } catch (e) {}
  let QD = null;
  try { QD = require('../utils/QuestDispatcher'); } catch (e) {}

  for (const m of raiders) {
    const p = db.users?.[m.id] || findUserByBare(db, m.id);
    // Was this hunter standing when the gate closed? Must be read BEFORE the
    // +50% recovery runs — otherwise a 0-HP corpse is "alive" after being
    // healed and gets rewarded for a raid they did not survive.
    const _wasAlive = p ? ((p.stats?.hp || 0) > 0 || (m.hp || 0) > 0) : false;
    if (p) {
      if (!p.stats_history) p.stats_history = {};
      p.stats_history.gatesCleared = (p.stats_history.gatesCleared || 0) + 1;

      // Down hunters get nothing at all: no recovery, no XP, no pass XP.
      if (_wasAlive) {
        const maxHp = p.stats.maxHp || 100;
        p.stats.hp = Math.min(maxHp, Math.max(0, p.stats.hp || 0) + Math.floor(maxHp * 0.5));
        if (p.stats.maxEnergy) {
          p.stats.energy = Math.min(p.stats.maxEnergy, Math.max(0, p.stats.energy || 0) + Math.floor(p.stats.maxEnergy * 0.5));
        }
        if (p.dungeonCooldown) p.dungeonCooldown = 0;
        // Recovery stops here. Rank regen resumes after the short lock window
        // instead of dumping a full heal the instant the raid ends.
        if (RegenMgr) RegenMgr.endCombat(p);
        recovered++;

        // Everyone standing is paid: XP → (LevelUpManager → level-up stats,
        // upgrade points, skill unlocks) plus Astra Pass and Battle Pass XP,
        // all inside awardXP(). The final-blow hunter additionally keeps their
        // boss drop + kill rewards (handled by the caller).
        survivorIds.push(p.id || m.id);
        try {
          const { awardXP } = require('../utils/SilentXP');
          awardXP(p, 'gate_complete', saveDatabase, null, null);
        } catch (e) {}
        if (QD) { try { QD.trackAndNotify(p, 'clear', 1, null, p.id, gate.chatId); } catch (e) {} }
      }
    }
    const pm = raid.members?.find(x => x.id === m.id);
    if (pm && p) { pm.hp = p.stats.hp; pm.energy = p.stats.energy; }
  }

  // Weekly GP: leader if alive, otherwise split among survivors. This block
  // used to sit INSIDE the member loop, so a 5-man party paid the 300 GP five
  // times over to the same leader.
  const leaderId = raid.leader || raiders[0]?.id;
  const leaderUser = db.users?.[leaderId] || findUserByBare(db, leaderId);
  const leaderMember = raid.members?.find(m => m.id === leaderId);
  const leaderAlive = (leaderUser?.stats?.hp || 0) > 0 || (leaderMember?.hp || 0) > 0;
  const totalGP = 300;

  if (leaderAlive && leaderId) {
    try { WeeklyGuildWar.addGP(db, leaderId, totalGP, saveDatabase); } catch(e) {}
  } else if (survivorIds.length > 0) {
    const shareGP = Math.max(1, Math.floor(totalGP / survivorIds.length));
    for (const sid of survivorIds) {
      try { WeeklyGuildWar.addGP(db, sid, shareGP, saveDatabase); } catch(e) {}
    }
  }

  if (keepOpen) {
    gate.doublePending = true; gate.doublePendingAt = Date.now();
    gate.raid.firstLoot = { nexus, crystals, destinationText };
    if (saveDatabase) saveDatabase();
    return { nexus, crystals, destinationText, dest, guild, contractPayouts, affiliatePayouts, wildPet, recovered, raiders, wildToken, doublePending: true };
  }
  try { if (db && db.activeGates) delete db.activeGates[gate.id]; } catch (e) {}
  GateManager.clearGate(gate.id, db);
  if (keyData) {
    keyData.raidComplete = true;
    keyData.used = true;
    if (db.gateKeys?.[key]) { db.gateKeys[key].raidComplete = true; db.gateKeys[key].used = true; }
    const gc = GKM.getDungeonGC(keyData.dungeonChatId);
    if (gc) gc.activeKeyId = null;
  }
  if (!gate.raid) gate.raid = { members: [], mode: 'solo', leader: null, status: 'done' };
  gate.raid.status = 'done';
  gate.raid.clearedAt = Date.now();
  gate.raid.loot = { nexus, crystals, destinationText, dest, contractPayouts, affiliatePayouts, wildPet, recovered };
  let doubleBoxes = [];
  if (gate.isDouble) { try { doubleBoxes = grantDoubleBoxes(gate, db); } catch (e) {} } // Push #96d: survivors pick a box
  if (saveDatabase) saveDatabase();

  return {
    nexus, crystals, destinationText, dest, guild,
    contractPayouts, affiliatePayouts, wildPet, recovered, raiders, wildToken, doubleBoxes,
  };
}

// Raid members can be keyed under a different JID domain than db.users
// (@lid vs @s.whatsapp.net). Matching only on the exact string silently
// skipped recovery + XP for those hunters.
// ── Push #88q: S-RANK IDLE PRESSURE ──────────────────────────────
// In an S-rank PARTY raid the monsters do not wait: if 30 s pass after the
// last hunter action with nobody attacking, the current monster (or boss)
// strikes the WEAKEST living member (lowest HP). Repeats every 30 s of
// idleness. The caller (index.js ticker) sends the returned messages.
const IDLE_STRIKE_MS = 30 * 1000;
const IDLE_STRIKE_OTHER_MS = 45 * 1000;
// Push #89: idle auto-attack window scales with gate rank.
const IDLE_STRIKE_BY_RANK = { S: 30, SS: 30, SSS: 30, DISASTER: 30, A: 45, B: 60, C: 90, D: 120, E: 150 };
function idleStrikeMsFor(rank) { const sec = IDLE_STRIKE_BY_RANK[String(rank || '').toUpperCase()]; return (sec || 150) * 1000; }
function noteRaidTurn(gate, chatId) {
  if (!gate || !gate.raid) return;
  gate.raid.lastTurnAt = Date.now();
  if (chatId) gate.raid.chatId = chatId;
}
function _currentRaidTarget(gate) {
  const floor = gate.currentFloor || 1;
  const alive = (gate.monsters || []).filter(m => m && !m.defeated && (m.hp || 0) > 0 && m.floor === floor);
  if (alive.length) return alive[0];
  const bossAlive = gate.boss && !gate.boss.defeated && (gate.boss.hp || 0) > 0;
  if (floor >= (gate.totalFloors || 1) && bossAlive) return gate.boss;
  return null;
}
// ── Push #88w: FLOOR REVIVE ───────────────────────────────────────────
// A cleared floor that nobody advances from within 60 s revives: every
// monster on it returns at +30% (HP/ATK/DEF/SPD, stacking on each revive),
// flagged `revived` so kills give NO rewards. The party must re-clear it.
const FLOOR_REVIVE_MS = 60 * 1000;
const FLOOR_REVIVE_MULT = 1.3;
function reviveFloor(gate, floor) {
  const mons = (gate.monsters || []).filter(m => m && m.floor === floor);
  for (const m of mons) {
    m.revived = true;
    m.revivals = (m.revivals || 0) + 1;
    m.maxHp = Math.max(1, Math.floor((m.maxHp || m.hp || 1) * FLOOR_REVIVE_MULT));
    m.hp = m.maxHp;
    m.atk = Math.max(1, Math.floor((m.atk || 1) * FLOOR_REVIVE_MULT));
    m.def = Math.max(0, Math.floor((m.def || 0) * FLOOR_REVIVE_MULT));
    if (m.speed != null) m.speed = Math.max(1, Math.floor((m.speed || 1) * FLOOR_REVIVE_MULT));
    m.defeated = false;
    m.statusEffects = [];
  }
  return mons;
}
function reviveStaleFloors(db, now = Date.now()) {
  const out = [];
  for (const gate of Object.values(GateManager.activeGates || {})) {
    try {
      const raid = gate && gate.raid;
      if (!raid || raid.status !== 'active' || gate.cleared || gate.broken || gate.doublePending) continue;
      if (!gate.floorClearedAt || now - gate.floorClearedAt < FLOOR_REVIVE_MS) continue;
      const floor = gate.currentFloor || 1;
      const alive = (gate.monsters || []).some(m => m && m.floor === floor && !m.defeated && (m.hp || 0) > 0);
      if (alive) { gate.floorClearedAt = null; continue; }
      // Final floor: engaging the boss counts as moving on.
      if (floor >= (gate.totalFloors || 1) && gate.boss && (gate.boss.defeated || (gate.boss.hp || 0) < (gate.boss.maxHp || gate.boss.hp || 0))) { gate.floorClearedAt = null; continue; }
      const mons = reviveFloor(gate, floor);
      if (!mons.length) { gate.floorClearedAt = null; continue; }
      gate.floorClearedAt = null;
      raid.lastTurnAt = now; // give the party a fresh idle window
      try { saveGateState(db, gate); } catch (e) {}
      const pct = Math.round((Math.pow(FLOOR_REVIVE_MULT, mons[0].revivals || 1) - 1) * 100);
      out.push({
        chatId: raid.chatId || gate.chatId || null,
        gateId: gate.id,
        text: [
          `☠️ *FLOOR ${floor} REVIVES!* Nobody advanced for 60s...`,
          `👾 *${mons.length}* monsters return *+${pct}% stronger* — and they give *NO rewards*.`,
          ...mons.slice(0, 6).map(m => `  💀 ${m.name} — HP ${m.hp}`),
          mons.length > 6 ? `  ...and ${mons.length - 6} more` : '',
          ``, `⚔️ /party attack — clear it again, then /party advance *quickly*.`,
        ].filter(Boolean).join('\n'),
        mentions: (raid.members || []).map(m => m.id),
      });
    } catch (e) { console.error('reviveStaleFloors:', e.message); }
  }
  return out;
}

// Push #93: a hunter drops to 0 HP outside the normal strike flow (Dark
// Sacrifice) — same bookkeeping as a monster kill: 15% crystals, removed from
// the party, marked fallen, wipe if nobody is left. Returns lines.
function hunterFalls(gate, memberId, u, db) {
  const lines = []; const raid = gate && gate.raid; if (!raid || !u) return lines;
  const _n = GKM.normaliseJid(memberId);
  const m = (raid.members || []).find(x => x.id === memberId || GKM.normaliseJid(x.id) === _n);
  u.stats.hp = 1;
  u.stats_history = u.stats_history || {}; u.stats_history.gateDeaths = (u.stats_history.gateDeaths || 0) + 1;
  const loss = Math.floor((u.manaCrystals || 0) * 0.15); u.manaCrystals = Math.max(0, (u.manaCrystals || 0) - loss);
  raid.members = (raid.members || []).filter(x => x !== m && (!_n || GKM.normaliseJid(x.id) !== _n));
  markFallen(gate, memberId);
  gate.raiders = (gate.raiders || []).filter(id => id !== memberId && (!_n || GKM.normaliseJid(id) !== _n));
  lines.push(`💀 *${u.name} HAS FALLEN!* Lost ${loss.toLocaleString()} 💎 · fled with 1 HP.`);
  { const _ln = takeLeaderNotice(gate); if (_ln) lines.push(_ln); }
  if (raid.members.length === 0) {
    let key = null, keyData = null;
    for (const [k, kd] of Object.entries((db && db.gateKeys) || {})) if (kd && kd.gateId === gate.id) { key = k; keyData = kd; break; }
    lines.push(...wipeGate(gate, key, keyData, raid.chatId || gate.chatId, db));
  }
  return lines;
}

// ── Push #88x: BERSERK auto-turns ─────────────────────────────────────
// Every raid member currently in a BERSERK surge gets one automatic move per
// tick (index.js). Returns { chatId, gateId, jid, name, pick } entries.
function berserkHunters(db) {
  const out = [];
  let TF; try { TF = require('../utils/Transformation'); } catch (e) { return out; }
  for (const gate of Object.values(GateManager.activeGates || {})) {
    try {
      const raid = gate && gate.raid;
      if (!raid || raid.status !== 'active' || gate.cleared || gate.broken) continue;
      const hasTarget = !!_currentRaidTarget(gate);
      for (const m of raid.members || []) {
        const u = db && db.users ? (db.users[m.id] || Object.values(db.users).find(x => x && x.jid && GKM.normaliseJid(x.jid) === GKM.normaliseJid(m.id))) : null;
        if (!u || !TF.isBerserk(u)) continue;
        if ((u.stats?.hp || 0) <= 0) continue;
        if (!hasTarget) {
          // Nothing left to maul on this floor: the rage burns down one turn per tick.
          const lines = TF.tick(u);
          out.push({ chatId: raid.chatId || gate.chatId || null, gateId: gate.id, jid: m.id, name: u.name || m.name, notice: `😈 *${u.name || m.name}* thrashes at nothing...\n${lines.join('\n')}` });
          continue;
        }
        let key = null; try { for (const [k, kd] of Object.entries((db && db.gateKeys) || {})) if (kd && kd.gateId === gate.id) { key = k; break; } } catch (e) {}
        out.push({ chatId: raid.chatId || gate.chatId || null, gateId: gate.id, key, jid: m.id, name: u.name || m.name, pick: TF.berserkPick(u) });
      }
    } catch (e) {}
  }
  return out;
}

function autoStrikeIdleRaids(db, now = Date.now(), canStrike = null) {
  const out = [];
  const gates = Object.values(GateManager.activeGates || {});
  for (const gate of gates) {
    try {
      const raid = gate && gate.raid;
      if (!raid || raid.status !== 'active' || gate.cleared || gate.doublePending) continue;
      if (!(raid.mode === 'party' || (raid.members || []).length > 1)) continue;
      const last = raid.lastTurnAt || raid.startedAt || 0;
      if (!last || now - last < idleStrikeMsFor(gate.rank)) continue; // Push #88t: 30 s in S gates, 45 s in every other rank
      // Push #88u: a bot that cannot HEAR this chat must not strike — restart the clock instead.
      // Push #92c: …nor a bot that cannot DECRYPT one of the raiders (Bad MAC) — their commands are invisible to it.
      if (typeof canStrike === 'function' && !canStrike(raid.chatId || gate.chatId, (raid.members || []).map(m => m && m.id).filter(Boolean))) { raid.lastTurnAt = now; continue; }
      const target = _currentRaidTarget(gate);
      if (!target) continue;
      const _HELD = ['stun', 'freeze', 'paralyze'];
      const heldFx = (target.statusEffects || []).filter(e => _HELD.includes(String(e.type || '').toLowerCase()));
      raid.lastTurnAt = now; // one strike per idle window, even if held
      if (heldFx.length) {
        // Push #92: a held monster still "tries" — the attack is thwarted and
        // its holding status burns down one turn (removed at 0).
        const word = { stun: 'STUNNED 💫', freeze: 'FROZEN 🧊', paralyze: 'PARALYZED 🔱' }[String(heldFx[0].type).toLowerCase()] || 'HELD';
        const worn = [];
        for (const e of heldFx) { e.duration = (Number(e.duration) || 1) - 1; if (e.duration <= 0) worn.push(String(e.type)); }
        target.statusEffects = (target.statusEffects || []).filter(e => !(_HELD.includes(String(e.type || '').toLowerCase()) && (Number(e.duration) || 0) <= 0));
        const hl = [`⏱️ *NO ONE MOVED FOR ${Math.round(idleStrikeMsFor(gate.rank) / 1000)}s — THE GATE TRIES TO STRIKE!*`, `👹 *${target.name}* is ${word} — *attack thwarted!*`, `⏳ Status effects −1 turn${worn.length ? ` · ${worn.join(', ')} wore off` : ''}`, `⚔️ Attack now — it strikes again in ${Math.round(idleStrikeMsFor(gate.rank) / 1000)} s of silence.`];
        try { saveGateState(db, gate); } catch (e) {}
        out.push({ chatId: raid.chatId || gate.chatId, text: hl.join('\n'), mentions: [] });
        continue;
      }
      const living = (raid.members || []).map(m => ({ m, u: findUserByBare(db, m.id) })).filter(x => x.u && (x.u.stats?.hp || 0) > 0);
      if (!living.length) continue;
      living.sort((a, b) => (a.u.stats.hp || 0) - (b.u.stats.hp || 0));
      let { m, u } = living[0];
      const victimName = u.name;
      // Push #92: a standing /guard (for the weakest hunter or for everyone) takes the idle strike instead.
      let guardHit = null; try { guardHit = takeGuard(gate, m.id, db); } catch (e) { guardHit = null; }
      if (guardHit && guardHit.guardian && guardHit.member) { u = guardHit.guardian; m = guardHit.member; }
      const def = effectiveDef(u, m.id); // Push #89: gear + title + pet
      const dmg = monsterDamage(target, def, u);
      const crit = !!(monsterDamage.last && monsterDamage.last.crit);
      let maxHp = u.stats?.maxHp || 100; try { maxHp = require('../utils/GearSystem').effectiveMaxHp(u); } catch (e) {}
      const lines = [`⏱️ *NO ONE MOVED FOR ${Math.round(idleStrikeMsFor(gate.rank) / 1000)}s — THE GATE STRIKES!*`, `👹 *${target.name}* lunges at the weakest hunter, *${victimName}*!`];
      if (guardHit) lines.push(`🛡️ *${guardHit.guardianName}* steps in front of *${victimName}* and takes the blow!`);
      if (monsterDamage.last && monsterDamage.last.shieldLine) lines.push(monsterDamage.last.shieldLine);
      if (dmg <= 0 && !(monsterDamage.last && monsterDamage.last.absorbed)) lines.push(monsterDamage.last && monsterDamage.last.blindMiss ? `🌫️ *${target.name}* is BLIND — it swings wide of *${u.name}*!` : `💨 *${u.name}* dodged it!`);
      else if (dmg <= 0) lines.push(`🦴 The wall took it all — *${u.name}* is untouched!`);
      else {
        u.stats.hp = Math.max(0, (u.stats.hp || 0) - dmg);
        lines.push(`${crit ? '💥 CRITICAL HIT — ' : ''}💢 *${u.name}* takes *${dmg}* damage → ❤️ ${u.stats.hp}/${maxHp}`);
        try { lines.push(...afterMonsterHit(u, target, dmg)); } catch (e) {}
        m.hp = u.stats.hp;
        if (u.stats.hp <= 0) {
          u.stats.hp = 1;
          u.stats_history = u.stats_history || {};
          u.stats_history.gateDeaths = (u.stats_history.gateDeaths || 0) + 1;
          const loss = Math.floor((u.manaCrystals || 0) * 0.15);
          u.manaCrystals = Math.max(0, (u.manaCrystals || 0) - loss);
          const _n = GKM.normaliseJid(m.id);
          raid.members = raid.members.filter(x => x !== m && (!_n || GKM.normaliseJid(x.id) !== _n));
          markFallen(gate, m.id); // Push #88w
          gate.raiders = (gate.raiders || []).filter(id => id !== m.id && (!_n || GKM.normaliseJid(id) !== _n));
          lines.push(`💀 *${u.name} WAS CUT DOWN!* Lost ${loss.toLocaleString()} 💎 · fled with 1 HP.`);
          { const _ln = takeLeaderNotice(gate); if (_ln) lines.push(_ln); }
          if (raid.members.length === 0) {
            let key = null, keyData = null;
            for (const [k, kd] of Object.entries(db.gateKeys || {})) if (kd && kd.gateId === gate.id) { key = k; keyData = kd; break; }
            lines.push(...wipeGate(gate, key, keyData, raid.chatId || gate.chatId, db));
          }
        }
      }
      lines.push(`⚔️ Attack now — the gate strikes again in ${Math.round(idleStrikeMsFor(gate.rank) / 1000)} s of silence.`);
      try { saveGateState(db, gate); } catch (e) {}
      out.push({ chatId: raid.chatId || gate.chatId, text: lines.join('\n'), mentions: [m.id].filter(Boolean) });
    } catch (e) { console.error('[GateRaid] idle strike error:', e.message); }
  }
  return out;
}

// Push #95: living hunters of a gate's raid (for party-wide domain effects).
function livingMembers(gate, db) {
  try {
    const raid = gate && gate.raid;
    return (raid && raid.members || []).map(m => findUserByBare(db, m.id)).filter(u => u && (u.stats?.hp || 0) > 0);
  } catch (e) { return []; }
}
function findUserByBare(db, jid) {
  if (!db?.users || !jid) return null;
  if (db.users[jid]) return db.users[jid];
  const bare = String(jid).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  if (!bare) return null;
  return Object.values(db.users).find(u => u && String(u.id || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '') === bare) || null;
}

function spawnWildPet(gate) {
  const chance = 0.45;
  if (Math.random() > chance) return null;
  const { PET_DATABASE } = require('../utils/PetDatabase');
  const pool = Object.values(PET_DATABASE);
  const weights = pool.map((p, i) => ({ p, w: 2 + Math.random() * (gate.rank === 'S' || gate.rank === 'DISASTER' ? 5 : 1) }));
  const total = weights.reduce((s, w) => s + w.w, 0);
  let r = Math.random() * total;
  let chosen = pool[0];
  for (const { p, w } of weights) { r -= w; if (r <= 0) { chosen = p; break; } }
  return { petId: chosen.id, name: chosen.name, emoji: chosen.emoji, rarity: chosen.rarity };
}

module.exports = {
  findOtherRaid,
  RED_GATE_CHANCE, DOUBLE_DUNGEON_CHANCE, LEAK_CHANCE, RED_GATE_TEXT, sealedReason, leakMonster, succeedLeader, takeLeaderNotice, doublePending, evolveDouble, grantDoubleBoxes, // Push #96d
  livingMembers,
  calibrateToParty, partyLuck, RANK_EXPECTED_POWER, totalStatsOf,
  MAX_PARTY,
  playerDamage,
  monsterDamage,
  afterMonsterHit,
  lifeSteal,
  resolveCode,
  relationOf,
  raidOf,
  ensureMember,
  findOtherRaid,
  setGuard,
  takeGuard,
  enter,
  join,
  ready,
  start,
  statusOf,
  monsterKilledBy,
  clearGate,
  saveGateState,
  spawnWildPet,
  tryCombatLock,
  hunterFalls, markFallen, isFallen, clearFallen, reviveFallen, FALLEN_TEXT, effectiveDef, IDLE_STRIKE_BY_RANK, rankSoften, reviveFloor, reviveStaleFloors, FLOOR_REVIVE_MS, FLOOR_REVIVE_MULT, berserkHunters, monsterCritChance, monsterDodgeChance, monsterDodges, critMultFor, noteRaidTurn, autoStrikeIdleRaids, IDLE_STRIKE_MS, IDLE_STRIKE_OTHER_MS, idleStrikeMsFor, raidInitiativeChance, raidMonsterGoesFirst, RAID_X2,
  releaseCombatLock,
  wipeGate,
  applyMonsterScaling, floorMultiplier, severityLabel, markHealerAggro, pickAggroTarget, supportCast,
  GKM,
  GateManager,
  GATE_RANKS,
};
