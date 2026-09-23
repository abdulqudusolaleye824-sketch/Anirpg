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
  let _pm74 = { atk: 0, crit: 0, skillDmg: 0 };
  try { _pm74 = require('../utils/ClassPower').passiveMultipliers(player); } catch (e) {}
  // Push #74: class passives (+X% ATK, quality-scaled) apply to every raid hit.
  let _gift = 1; try { _gift = require('../utils/PetManager').lastGiftMultiplier(player) || 1; } catch (e) {}
  // Push #88: live temp buffs (War Cry / Spirit Link "+X% ATK") multiply the
  // raid strike too — they only reached PvP/pattern maths before. Kill stacks
  // (Devourer) add flat ATK.
  let _tbAtk = 0; try { _tbAtk = require('../utils/UnifiedCombat').tempBuffPct(player, 'atk'); } catch (e) {}
  const atk = Math.floor(((player.stats?.atk || 10) + _gearAtkGR + (player.weapon?.attack || player.weapon?.bonus || 0) + (_pm74.atkFlat || 0)) * (1 + (_pm74.atk || 0) / 100) * (1 + Math.max(-90, _tbAtk) / 100) * _gift);
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
    const cost = entry ? SC.effectiveCost(entry) : (skill.energyCost || 0);
    if ((player.stats?.energy || 0) < cost) return { damage: 0, blocked: true, reason: `Not enough energy for *${skill.name}*! Need ${cost}.` };

    // Skills are a multiplier of ATK (plus magic power for casters), not the
    // old flat `skill.damage || 20` — that flat number is why a Lv.90 skill
    // landed like a base attack on the boss.
    const synergyNotes = [];
    // Push #88: skills scale from the FULL effective ATK (gear + weapon + buffs
    // + passives), not bare stats.atk — a "+100% ATK" buff now doubles the hit.
    let dmg = SC.computeDamage({ ...player, stats: { ...(player.stats || {}), atk } }, entry || skill, { includeMagic: magicPower > 0, crit: false, target, notes: synergyNotes });
    if (_pm74.skillDmg) dmg = Math.max(1, Math.floor(dmg * (1 + (_pm74.skillDmg || 0) / 100)));
    if (target && typeof target.def === 'number' && target.def > 0) dmg = Math.max(1, dmg - Math.floor(target.def * 0.35 * (1 - Math.min(0.6, (_pm74.armorPen || 0) / 100))));
    if (target) { try { dmg = Math.max(1, Math.floor(dmg * require('../utils/UnifiedCombat').weakenTakenMult(target))); } catch (e) {} }
    const isCrit = Math.random() < ((player.stats?.critChance || 2) + (_pm74.crit || 0) + _gearCritGR + _titleCritGR) / 100;
    if (isCrit) dmg = Math.floor(dmg * ((player.stats?.critDamage || 150) + _gearCritDmgGR) / 100);

    player.stats.energy = Math.max(0, (player.stats.energy || 0) - cost);
    SC.setCooldown(player, entry || skill);
    try { require('../utils/RegenManager').markCombatAction(player); } catch (e) {}
    // Push #71: RECOVERY SKILLS — healingPct was computed here and returned,
    // but no caller ever applied it, so heals in gate raids restored 0 HP.
    // Apply it to the hunter now (heal-type skills deal no damage).
    const _healPct = Number((entry && entry.healingPct) || 0);
    const _isHealSkill = String((entry && entry.type) || skill.type || '').toLowerCase() === 'heal';
    let healed = 0;
    // Hybrids (Holy Strike, Dark Feast, Water Wave…) hit AND heal; pure heal
    // moves heal only.
    if (_healPct > 0) {
      const maxHp = player.stats.maxHp || 100;
      const before = player.stats.hp || 0;
      player.stats.hp = Math.min(maxHp, before + Math.floor(maxHp * _healPct / 100));
      healed = player.stats.hp - before;
      if (_isHealSkill) dmg = 0;
    }
    return {
      damage: dmg, isCrit, skillUsed: skill,
      statuses: [ ...((entry && entry.statuses) || skill.statuses || []), ...((_pm74.onHit || [])) ],
      healingPct: _healPct,
      healed,
      synergyNotes,
      buffs: (entry && entry.buffs) || [],
    };
  }
  let dmg = Math.max(5, atk * (0.85 + Math.random() * 0.30));
  if (target && typeof target.def === 'number' && target.def > 0) dmg = Math.max(5, dmg - Math.floor(target.def * 0.35 * (1 - Math.min(0.6, (_pm74.armorPen || 0) / 100))));
  if (target) { try { dmg = Math.max(1, dmg * require('../utils/UnifiedCombat').weakenTakenMult(target)); } catch (e) {} }
  const isCrit = Math.random() < ((player.stats?.critChance || 2) + (_pm74.crit || 0) + _gearCritGR + _titleCritGR) / 100;
  if (isCrit) dmg = Math.floor(dmg * (player.stats?.critDamage || 150) / 100);
  let synergyNotes = [];
  if (target) { try { const syn = require('../utils/StatusSynergy').bonusFor({ name: 'strike', description: 'basic strike' }, target); if (syn.mult !== 1) { dmg *= syn.mult; synergyNotes = syn.notes; } } catch (e) {} }
  // Push #88: SpellBlade "free spell" proc + BloodKnight on-hit bleed on basic strikes.
  let procNote = null;
  if (_pm74.procDmg > 0 && Math.random() * 100 < _pm74.procDmg) { const extra = Math.floor(dmg * 0.5); dmg += extra; procNote = `✨ Arcane proc +${extra}`; }
  if (procNote) synergyNotes = [...synergyNotes, procNote];
  return { damage: Math.floor(dmg), isCrit, synergyNotes, statuses: (_pm74.onHit || []) };
}

function monsterDamage(monster, def, player = null) {
  // Push #74: the hunter can DODGE (speed vs monster speed + evasion +
  // passives); passives also cut damage taken; WEAKEN on the hunter hurts.
  if (player) {
    try {
      const UC = require('../utils/UnifiedCombat');
      const CP = require('../utils/ClassPower');
      const pm = CP.passiveMultipliers(player);
      const mon = { stats: { speed: monster.speed || 10, atk: monster.atk || 10 }, statusEffects: monster.statusEffects || [] };
      const held = (player.statusEffects || []).some(e => ['stun', 'freeze', 'paralyze'].includes(String(e.type || '').toLowerCase()));
      if (!held && Math.random() * 100 < UC.dodgeChance(mon, player, pm)) return 0;
      // Push #85: defence soaks at most 60% of the hit and a landed hit is
      // never below 4% of the hunter's max HP — high-DEF hunters used to
      // take a flat 3 from everything.
      const mAtk = (monster.atk || 10);
      const soak = Math.min(mAtk * 0.6, Math.floor(((def || 5) * (1 + (pm.def || 0) / 100)) * 0.5));
      const floorDmg = Math.max(3, Math.floor((player.stats?.maxHp || 100) * 0.04));
      let raw = Math.max(floorDmg, mAtk - soak);
      raw = raw * (0.8 + Math.random() * 0.4) * UC.weakenTakenMult(player) * (1 + (pm.dmgTaken || 0) / 100);
      try { raw = raw / (require('../utils/PetManager').lastGiftMultiplier(player) || 1); } catch (e) {}
      return Math.max(0, Math.floor(raw));
    } catch (e) {}
  }
  const raw = Math.max(3, (monster.atk || 10) - Math.floor((def || 5) * 0.5));
  return Math.floor(raw * (0.8 + Math.random() * 0.4));
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
      const bossData = bossPool[Math.floor(Math.random()*bossPool.length)];
      // Push #71: same bestiary/strength builder as spawnGate.
      const strengthPct = keyData.strengthPct || GateManager.rollGateStrength();
      const monsters = GateManager.buildGateMonsters(rank, totalFloors, strengthPct);
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
        boss: { name: bossData.name, hp: bossHp, maxHp: bossHp, defeated:false },
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
  // Push #88: a WIPE salvages HALF of the accumulated floor treasure — and it
  // goes to the owning GUILD's treasury, never to any single hunter. (A single
  // death used to pay 50% to the fallen hunter; that is gone.)
  let salvage = null;
  try {
    const tr = gate.accumulatedTreasure || { nexus: 0, crystals: 0 };
    const half = { nexus: Math.floor((tr.nexus || 0) * 0.5), crystals: Math.floor((tr.crystals || 0) * 0.5) };
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
    ...(salvage ? [`🏰 *50% TREASURE SALVAGED → ${salvage.dest} Treasury:* +${salvage.nexus.toLocaleString()} 💠 | +${salvage.crystals.toLocaleString()} 💎`] : []),
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

function ensureMember(gate, sender, db) {
  const player = db.users?.[sender];
  const raid = gate.raid;
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
  const raid = raidOf(gate, key, keyData);
  { const other = findOtherRaid(sender, gate); if (other) return { ok: false, error: otherRaidError(other) }; }
  // Push #30: single-use keys — fresh entry on a consumed key is refused.
  // (Members re-running enter on their own live raid pass straight through.)
  const _alreadyIn = (raid.members || []).some(m =>
    m.id === sender || GKM.normaliseJid(m.id) === GKM.normaliseJid(sender));
  if (!_alreadyIn && keyData?.consumed) {
    return { ok: false, error: '🔥 *This key is already consumed!*\n\nSingle-use: each key opens exactly one party. Buy a fresh gate for another run.' };
  }
  // Burn it now — committed from this point on (covers solo + /gateraid enter).
  try { keyData.consumed = true; if (db?.gateKeys?.[key]) db.gateKeys[key].consumed = true; } catch (e) {}
  const rel = relationOf(sender, keyData, db);

  // No-guild hunter (not a member of the owning guild, not an affiliate) → instant SOLO raid.
  if (rel === 'outsider') {
    raid.mode = 'solo';
    raid.leader = sender;
    raid.status = 'active';
    raid.startedAt = Date.now();
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

  // member / affiliate → open a party (creator = leader)
  if (!raid.leader || raid.status === 'done') {
    raid.mode = 'party';
    raid.status = 'recruiting';
    raid.leader = sender;
    raid.members = [];
  }
  ensureMember(gate, sender, db);
  gate.raiders = gate.raiders || [];
  if (!gate.raiders.includes(sender)) gate.raiders.push(sender);
  return { ok: true, mode: 'party', raid, rel };
}

function join(sender, name, gate, db) {
  const raid = gate.raid;
  if (!raid) return { ok: false, error: 'No gate raid in progress.' };
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

  raid.status = 'active';
  raid.startedAt = Date.now();
  gate.raidStarted = true;
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
  return { ok: true, raid };
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
  const atk = Math.floor(((st.atk || 10) + (g.atk || 0) + (u.weapon?.attack || u.weapon?.bonus || 0) + (tb.atk || 0) + petA) * (1 + (pm.atk || 0) / 100) * gift);
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
  gate.calibrated = { severity, label: null, partyPower: Math.floor(total), expected, luck, members: n, avgLevel: Math.round(avgLvl), at: Date.now() };
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
function applyMonsterScaling(gate) {
  const severity = (gate.calibrated && gate.calibrated.severity) || 1;
  for (const mon of gate.monsters || []) {
    if (!mon || mon.defeated) continue;
    if (!mon._base) mon._base = { hp: mon.maxHp || mon.hp || 10, atk: mon.atk || 5, def: mon.def || 0, speed: mon.speed || 10 };
    const mult = severity * floorMultiplier(gate, mon.floor);
    const wasFull = !(typeof mon.hp === 'number' && typeof mon.maxHp === 'number' && mon.hp < mon.maxHp);
    const hpPct = wasFull ? 1 : Math.max(0, mon.hp / Math.max(1, mon.maxHp));
    mon.maxHp = Math.max(5, Math.floor(mon._base.hp * mult));
    mon.hp = Math.max(1, Math.floor(mon.maxHp * hpPct));
    mon.atk = Math.max(1, Math.floor(mon._base.atk * mult));
    mon.def = Math.floor(mon._base.def * mult * 0.8);
    mon.speed = Math.max(1, Math.round(mon._base.speed * (0.8 + Math.min(severity, 6) * 0.2)));
  }
  if (gate.boss && !gate.boss.defeated) {
    if (!gate.boss._base) {
      const _rd = GATE_RANKS[gate.rank] || GATE_RANKS.E;
      const _baseAtk = gate.boss.atk || Math.floor(((_rd.monsterRange || [15, 45])[1]) * 0.20);
      gate.boss._base = { hp: gate.boss.maxHp || gate.boss.hp || 400, atk: _baseAtk, def: gate.boss.def || Math.floor(_baseAtk * 0.25) };
    }
    const mult = severity * floorMultiplier(gate, gate.totalFloors) * 1.25;
    const wasFull = !(typeof gate.boss.hp === 'number' && typeof gate.boss.maxHp === 'number' && gate.boss.hp < gate.boss.maxHp);
    const hpPct = wasFull ? 1 : Math.max(0, gate.boss.hp / Math.max(1, gate.boss.maxHp));
    gate.boss.maxHp = Math.max(50, Math.floor(gate.boss._base.hp * mult));
    gate.boss.hp = Math.max(1, Math.floor(gate.boss.maxHp * hpPct));
    if (gate.boss._base.atk) gate.boss.atk = Math.max(1, Math.floor(gate.boss._base.atk * mult));
    gate.boss.def = Math.floor((gate.boss._base.def || 0) * mult * 0.8);
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
  const cost = SC.effectiveCost(entry);
  if ((caster.stats?.energy || 0) < cost) return { ok: false, error: `Not enough energy for *${skill.name}*! Need ${cost}.` };
  caster.stats.energy = Math.max(0, (caster.stats.energy || 0) - cost);
  SC.setCooldown(caster, entry);
  let healPower = 1;
  try { const CP = require('../utils/ClassPower'); healPower = 1 + ((CP.passiveMultipliers(caster).healPower || 0) / 100); } catch (e) {}
  const lines = [];
  const text = `${entry.effect || ''} ${entry.description || ''} ${skill.desc || ''}`.toLowerCase();
  const party = /\b(all|entire|every|party|allies|team)\b/.test(text);
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
      const amt = Math.max(1, Math.floor(max * pct / 100 * healPower * recvBoost));
      u.stats.hp = Math.min(max, before + amt);
      const got = u.stats.hp - before;
      healedTotal += got;
      lines.push(`💚 *${t.name}* +${got} HP → ${u.stats.hp}/${max}`);
      // energy component ("and X% max energy")
      const em = text.match(/(\d+)%\s*(?:max\s*)?energy/);
      if (em && u.stats.maxEnergy) { const e = Math.floor(u.stats.maxEnergy * parseInt(em[1], 10) / 100); u.stats.energy = Math.min(u.stats.maxEnergy, (u.stats.energy || 0) + e); lines.push(`⚡ *${t.name}* +${e} energy`); }
      if (/remov|clear|cleanse|purif/.test(text) && Array.isArray(u.statusEffects) && u.statusEffects.length) { const n = u.statusEffects.length; u.statusEffects = []; lines.push(`✨ *${t.name}* cleansed (${n} effect${n === 1 ? '' : 's'})`); }
    }
    if (isBuff) {
      const UC = require('../utils/UnifiedCombat');
      const buffs = (entry.buffs || []).length ? entry.buffs : [];
      if (buffs.length) {
        const notes = UC.applyMoveBuffs({ name: skill.name, buffs, debuffs: [], selfDebuffs: [] }, u, u);
        for (const b of buffs) lines.push(`⬆️ *${t.name}* ${String(b.stat).toUpperCase()} +${Math.abs(Number(b.amount) || 0)}% (${b.duration || 2}t)`);
        void notes;
      }
      const sh = text.match(/shield[^.]*?(\d+)%/);
      if (sh) { const max = effMax(u); const amt = Math.floor(max * parseInt(sh[1], 10) / 100 * healPower); u.tempBuffs = u.tempBuffs || {}; u.tempBuffs.shield = { amount: amt, duration: 4 }; lines.push(`🛡️ *${t.name}* shielded for ${amt} HP`); }
      const es = text.match(/restores?\s+(\d+)%\s*(?:of\s+their\s+)?(?:max\s*)?energy/);
      if (es && u.stats.maxEnergy) { const e = Math.floor(u.stats.maxEnergy * parseInt(es[1], 10) / 100); u.stats.energy = Math.min(u.stats.maxEnergy, (u.stats.energy || 0) + e); lines.push(`⚡ *${t.name}* +${e} energy`); }
    }
  }
  if (gate) markHealerAggro(gate, casterJid, caster.name);
  return { ok: true, skill, lines, healed: healedTotal, party: targets.length > 1, isHeal, isBuff };
}

// ── Status ──────────────────────────────────────────────────────
function statusOf(gate, db) {
  const raid = gate.raid;
  const rd = GATE_RANKS[gate.rank] || GATE_RANKS['E'];
  const floor = gate.currentFloor;
  const floorMonsters = (gate.monsters || []).filter(m => m.floor === floor && !m.defeated);
  const totalMonsters = (gate.monsters || []).filter(m => m.floor === floor).length;
  const bossReady = floor >= gate.totalFloors && floorMonsters.length === 0 && !gate.boss.defeated;

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
  if (bossReady) lines.push(`🏆 *BOSS READY — /gateraid boss*`);
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
  const drop = GateManager.rollMonsterKillDrop(gate.rank, monster.name);
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

  // 50% chance to drop Pet Food
  if (Math.random() <= 0.50) {
    const foodList = [
      { name: 'Monster Kibble', restore: 30, rarity: 'common' },
      { name: 'Royal Monster Feed', restore: 100, rarity: 'uncommon' }
    ];
    const food = foodList[Math.floor(Math.random() * foodList.length)];
    // Push #71: one pet-food bucket (id-keyed) — /pet feed consumes from here.
    try { const PDB = require('../utils/PetDatabase'); const f = PDB.resolvePetFood(food.name); PDB.addPetFood(player, f ? f.id : 'kibble', 1); } catch (e) {}
    lines.push(`🍖 *PET FOOD DROP → ${player.name}*: *${food.name}*`);
  }

  // 30% chance to drop a Health Potion
  if (Math.random() <= 0.30) {
    player.inventory.lowerHealthPotions = (player.inventory.lowerHealthPotions || 0) + 1;
    player.inventory.healthPotions = (player.inventory.healthPotions || 0) + 1;
    lines.push(`🩹 *POTION DROP → ${player.name}*: *Lower Health Potion*`);
  }

  return lines;
}

// ── On full clear (boss defeated) — distribute loot ─────────────
function clearGate(gate, key, keyData, db, saveDatabase) {
  const raid = gate.raid || {};
  const raiders = raid.members?.length ? raid.members : [];

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
    const goldCut = Math.floor(p.gold * scale);
    const crystalCut = Math.floor(p.crystals * scale);
    const hunter = db.users?.[jid];
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
  if (saveDatabase) saveDatabase();

  return {
    nexus, crystals, destinationText, dest, guild,
    contractPayouts, affiliatePayouts, wildPet, recovered, raiders, wildToken,
  };
}

// Raid members can be keyed under a different JID domain than db.users
// (@lid vs @s.whatsapp.net). Matching only on the exact string silently
// skipped recovery + XP for those hunters.
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
  releaseCombatLock,
  wipeGate,
  applyMonsterScaling, floorMultiplier, severityLabel, markHealerAggro, pickAggroTarget, supportCast,
  GKM,
  GateManager,
  GATE_RANKS,
};
