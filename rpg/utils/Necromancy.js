// ═══════════════════════════════════════════════════════════════
// Necromancy — Push #93 (Necromancer class overhaul)
// "Death is not an obstacle — it is a currency, a shield, and a weapon."
//
//  • BONE WALL (reforged)  — floor-scaling party barrier. Absorbs 60% of every
//    monster hit for 3 turns (pool = 60% of the target's max HP).
//    Targets allowed = current raid floor (1..4); floor 7+ = whole raid with no
//    tags (100 energy, 4-turn CD). Tagged casts: 10 energy × targets,
//    CD 1 + 1 per target (Option A).
//  • SOUL DRAIN (reforged) — "Tithe of the Fallen". On a MONSTER: unchanged.
//    On an @ally: drains 25% (+3%/skill level) of their CURRENT HP, heals the
//    Necromancer for what was taken and STEALS every positive temp buff.
//    Ally under Bone Wall → the wall eats 60% of the drain. Ally at ≤15% HP →
//    DARK SACRIFICE: drained completely (they fall).
//  • CURSE OF RUIN (ex-Life Drain) — 100 energy, 200% ATK dark strike, no
//    heal; target ATK −70% & takes +70% damage for 3 ROUNDS (3 × living party).
// Shields are generic: any `tempBuffs.shield {amount, pct}` now really absorbs.
// ═══════════════════════════════════════════════════════════════
'use strict';

const BONE_WALL = { pct: 60, turns: 3, costPerTarget: 10, aoeCost: 100, aoeFloor: 7, cdBase: 1, cdPerTarget: 1, aoeCd: 4, maxTagged: 4 };
const SOUL_DRAIN = { basePct: 25, perLevel: 3, sacrificeBelowPct: 15 };
const RUIN = { atkCut: 70, takenUp: 70, rounds: 3, energy: 100, damagePct: 200, type: 'ruin' };
const TURN_MS = 2500; // SkillCatalog: one turn ≈ 2.5 s

const _n = (j) => { try { return require('./GateKeyManager').normaliseJid(j); } catch (e) { return String(j || '').split('@')[0].split(':')[0]; } };
const _max = (u) => { try { return require('./GearSystem').effectiveMaxHp(u); } catch (e) { return (u.stats && u.stats.maxHp) || 100; } };
const isNecro = (p) => { try { return /^necromancer$/i.test(String(require('./ClassPower').baseClassName(p) || '')); } catch (e) { return /^necromancer$/i.test(String(p && (p.classBase || p.class) || '')); } };
const isBoneWall = (e) => /^bone wall$/i.test(String(e && e.name || ''));
const isSoulDrain = (e) => /^soul drain$/i.test(String(e && e.name || ''));
const isRuin = (e) => /^curse of ruin$/i.test(String(e && e.name || ''));

function setCooldownTurns(player, entry, turns) {
  const ms = Math.max(0, Math.round(turns * TURN_MS)); const key = String(entry.name || '').toLowerCase();
  player.skillCooldowns = player.skillCooldowns || {}; player.skillCooldowns[key] = Date.now() + ms;
  if (player.skills) { player.skills.cooldowns = player.skills.cooldowns || {}; player.skills.cooldowns[entry.name] = Date.now() + ms; }
  player.lastSkillUse = player.lastSkillUse || {}; player.lastSkillUse[entry.name] = Date.now();
}
function livingMembers(gate, db) {
  const out = [];
  for (const m of (gate && gate.raid && gate.raid.members) || []) {
    const u = db && db.users ? (db.users[m.id] || Object.values(db.users).find(x => x && x.jid && _n(x.jid) === _n(m.id))) : null;
    if (u && (u.stats?.hp ?? 0) > 0) out.push({ u, jid: m.id, name: m.name || u.name });
  }
  return out;
}
function boneWallCap(floor) { const f = Math.max(1, Number(floor) || 1); return f >= BONE_WALL.aoeFloor ? Infinity : Math.min(BONE_WALL.maxTagged, f); }

// ── Bone Wall ────────────────────────────────────────────────────────────────
// Returns { ok, targets:[{u,jid,name}], cost, cd, aoe, floor, cap } or { ok:false, error }.
function planBoneWall(caster, casterJid, gate, db, mentionedJids = []) {
  const floor = Number(gate && gate.currentFloor) || 1;
  const cap = boneWallCap(floor);
  const party = livingMembers(gate, db);
  const tags = [...new Set((mentionedJids || []).map(_n))];
  let targets = [];
  let aoe = false;
  if (!tags.length) {
    if (cap === Infinity && party.length > 1) { aoe = true; targets = party; }
    else targets = [{ u: caster, jid: casterJid, name: caster.name }];
  } else {
    for (const t of tags) {
      const m = party.find(p => _n(p.jid) === t);
      if (!m) return { ok: false, error: `@${t} is not a living member of this raid party.` };
      targets.push(m);
    }
    if (cap !== Infinity && targets.length > cap) return { ok: false, error: `Bone Wall can shield at most *${cap}* hunter${cap === 1 ? '' : 's'} on floor ${floor} (it grows one target per floor; floor ${BONE_WALL.aoeFloor} unlocks the full-raid wall).` };
  }
  const cost = aoe ? BONE_WALL.aoeCost : BONE_WALL.costPerTarget * targets.length;
  const cd = aoe ? BONE_WALL.aoeCd : BONE_WALL.cdBase + BONE_WALL.cdPerTarget * targets.length;
  return { ok: true, targets, cost, cd, aoe, floor, cap };
}
function applyBoneWall(u, caster, level = 1) {
  const max = _max(u);
  const pct = BONE_WALL.pct;
  const pool = Math.floor(max * pct / 100 * (1 + 0.1 * (Math.max(1, level) - 1)));
  u.tempBuffs = u.tempBuffs || {};
  u.tempBuffs.shield = { amount: pool, duration: BONE_WALL.turns + 1, pct: pct / 100, source: 'Bone Wall', by: caster && caster.name };
  return `🦴 *${u.name}* — Bone Wall: absorbs ${pct}% of every hit for ${BONE_WALL.turns} turns (up to ${pool} dmg)`;
}
// Full cast: validates, spends energy, sets a dynamic cooldown, shields everyone. Returns { ok, lines, ... }.
function castBoneWall(caster, casterJid, entry, gate, db, mentionedJids = []) {
  const plan = planBoneWall(caster, casterJid, gate, db, mentionedJids);
  if (!plan.ok) return plan;
  const SC = require('./SkillCatalog');
  const cd = SC.onCooldown(caster, entry); if (!cd.ready) return { ok: false, error: `*Bone Wall* is on cooldown! (${Math.ceil(cd.msLeft / 1000)}s)` };
  if ((caster.stats?.energy || 0) < plan.cost) return { ok: false, error: `Not enough energy for *Bone Wall* on ${plan.targets.length} target${plan.targets.length === 1 ? '' : 's'}! Need ${plan.cost}.` };
  caster.stats.energy = Math.max(0, (caster.stats.energy || 0) - plan.cost);
  setCooldownTurns(caster, entry, plan.cd);
  const level = Number((SC.resolveSkill(caster, 'Bone Wall', { allowLibrary: true }).skill || {}).level || 1);
  const lines = plan.targets.map(t => applyBoneWall(t.u, caster, level));
  lines.push(`⚡ −${plan.cost} energy · ⏳ cooldown ${plan.cd} turn${plan.cd === 1 ? '' : 's'}${plan.aoe ? ' · 👑 FULL-RAID WALL (floor ' + plan.floor + ')' : ` · floor ${plan.floor}: up to ${plan.cap === Infinity ? 'the whole raid' : plan.cap + ' target' + (plan.cap === 1 ? '' : 's')}`}`);
  return { ok: true, ...plan, lines, mentions: plan.targets.map(t => t.jid) };
}

// ── Generic shield absorption (Bone Wall + any "shield X%" support skill) ────
// Returns { dmg, absorbed, broke }. Mutates entity.tempBuffs.shield.
function absorb(entity, dmg) {
  const sh = entity && entity.tempBuffs && entity.tempBuffs.shield;
  if (!sh || !(sh.amount > 0) || !(dmg > 0)) return { dmg, absorbed: 0, broke: false };
  const pct = sh.pct != null ? Math.max(0, Math.min(1, Number(sh.pct))) : 1;
  const cut = Math.min(sh.amount, Math.floor(dmg * pct));
  sh.amount -= cut;
  let broke = false;
  if (sh.amount <= 0) { delete entity.tempBuffs.shield; broke = true; }
  return { dmg: Math.max(0, dmg - cut), absorbed: cut, broke, source: sh.source || 'Shield' };
}
function shieldLine(res, name) { return res && res.absorbed > 0 ? `${/bone/i.test(res.source || '') ? '🦴' : '🛡️'} ${res.source || 'Shield'} absorbs ${res.absorbed} of the hit on *${name}*${res.broke ? ' — and shatters!' : ''}` : null; }

// ── Soul Drain on an ally ────────────────────────────────────────────────────
function soulDrainAlly(caster, ally, level = 1) {
  const lines = [];
  const max = _max(ally);
  const hp = Math.max(0, ally.stats.hp || 0);
  const sacrifice = hp / max <= SOUL_DRAIN.sacrificeBelowPct / 100;
  const pct = SOUL_DRAIN.basePct + SOUL_DRAIN.perLevel * (Math.max(1, level) - 1);
  let drain = sacrifice ? hp : Math.max(1, Math.floor(hp * pct / 100));
  const sh = absorb(ally, drain); drain = sh.dmg;
  if (sh.absorbed) lines.push(shieldLine(sh, ally.name));
  ally.stats.hp = Math.max(0, hp - drain);
  const cmax = _max(caster); const before = caster.stats.hp || 0;
  caster.stats.hp = Math.min(cmax, before + drain);
  const healed = caster.stats.hp - before;
  if (sacrifice && ally.stats.hp <= 0) lines.push(`🩸 *DARK SACRIFICE!* *${ally.name}* is drained completely (−${drain} HP) — their soul feeds the Monarch.`);
  else if (sacrifice) lines.push(`🩸 *DARK SACRIFICE… held back!* Bone Wall ate most of the drain — *${ally.name}* −${drain} HP → ${ally.stats.hp}/${max}`);
  else lines.push(`🩸 *${ally.name}* −${drain} HP (${pct}% of their life) → ${ally.stats.hp}/${max}`);
  lines.push(`💚 *${caster.name}* +${healed} HP → ${caster.stats.hp}/${cmax}`);
  // The Harvest: STEAL every positive temp buff (not shields).
  const stolen = [];
  for (const [k, v] of Object.entries(ally.tempBuffs || {})) {
    if (!v || k === 'shield' || !v.stat || !((Number(v.amount) || 0) > 0)) continue;
    caster.tempBuffs = caster.tempBuffs || {};
    const mine = caster.tempBuffs[k];
    caster.tempBuffs[k] = mine && mine.amount >= v.amount ? { ...mine, duration: Math.max(mine.duration || 0, v.duration || 0) } : { ...v };
    delete ally.tempBuffs[k];
    stolen.push(`${String(v.stat).toUpperCase()} +${v.amount}%`);
  }
  lines.push(stolen.length ? `👑 *THE HARVEST* — stolen from *${ally.name}*: ${stolen.join(', ')}` : `👑 *THE HARVEST* — *${ally.name}* carried no buffs to steal.`);
  return { ok: true, lines, drain, healed, sacrifice, stolen, fell: ally.stats.hp <= 0 };
}

// ── Curse of Ruin ────────────────────────────────────────────────────────────
function hasRuin(entity) { return !!((entity && entity.statusEffects) || []).find(e => String(e.type || '').toLowerCase() === RUIN.type); }
function ruinAtkMult(entity) { return hasRuin(entity) ? 1 - RUIN.atkCut / 100 : 1; }
function ruinTakenMult(entity) { return hasRuin(entity) ? 1 + RUIN.takenUp / 100 : 1; }
// Stretch a freshly-landed ruin to 3 ROUNDS (one round = every living hunter acts once).
function scaleRuinToRounds(target, livingCount) {
  const e = ((target && target.statusEffects) || []).find(x => String(x.type || '').toLowerCase() === RUIN.type);
  if (!e) return 0;
  e.duration = Math.max(e.duration || 0, RUIN.rounds * Math.max(1, livingCount || 1) + 1);
  e.label = 'Curse of Ruin'; e.atkCut = RUIN.atkCut; e.takenUp = RUIN.takenUp;
  return e.duration;
}

// Roster overrides applied by SkillCatalog.buildRoster (by slot name).
const REFORGED = {
  Necromancer: {
    'Bone Wall': {
      type: 'buff', damagePct: 0, healingPct: 0, buffs: [], debuffs: [], statuses: [], energyCost: BONE_WALL.costPerTarget, cooldown: BONE_WALL.cdBase + BONE_WALL.cdPerTarget,
      effect: `• Shield: absorbs ${BONE_WALL.pct}% of every monster hit for ${BONE_WALL.turns} turns\n• Targets scale with the raid floor: floor 1 = 1 hunter … floor 4 = 4 hunters\n• Floor ${BONE_WALL.aoeFloor}+: /party skill Bone Wall with no tags shields the WHOLE raid (${BONE_WALL.aoeCost} energy)\n• Tagged casts: ${BONE_WALL.costPerTarget} energy × targets · cooldown ${BONE_WALL.cdBase} + ${BONE_WALL.cdPerTarget} turn per target`,
      description: '🦴 Death is not a limit. It is an expanding fortress. Tag allies to wall them: /party skill Bone Wall @tank @dps.',
      animation: '🦴 Bones tear free of the earth...\n🧱 BONE WALL! A fortress of the dead rises!\n🛡️ The living stand behind the fallen.',
    },
    'Soul Drain': {
      type: 'damage', damagePct: 150, healingPct: 0, drainPct: 0, drainHealPct: 0, selfCostPct: 0, buffs: [], debuffs: [], statuses: [], energyCost: 30, cooldown: 3,
      effect: `• On a monster: 150% ATK dark damage, heals you for half the damage dealt\n• On an @ally ("Tithe of the Fallen"): takes ${SOUL_DRAIN.basePct}% (+${SOUL_DRAIN.perLevel}%/level) of their CURRENT HP, heals you for it\n• THE HARVEST: steals every positive buff on that ally\n• Ally under Bone Wall loses ${100 - BONE_WALL.pct}% as much · ally at ≤${SOUL_DRAIN.sacrificeBelowPct}% HP is SACRIFICED (drained completely)`,
      description: '👑 Your power serves the Monarch now. /party skill Soul Drain @ally to harvest a teammate\'s buffs.',
      animation: '🌑 A hand closes around a beating heart...\n👑 SOUL DRAIN! The tithe is paid!\n💀 Their strength is yours.',
    },
    'Life Drain': {
      rename: 'Curse of Ruin', type: 'damage', damagePct: RUIN.damagePct, healingPct: 0, drainPct: 0, drainHealPct: 0, energyCost: RUIN.energy, cooldown: 4, buffs: [], debuffs: [],
      statuses: [{ type: RUIN.type, chance: 100, duration: RUIN.rounds }],
      effect: `• ${RUIN.damagePct}% ATK dark damage — single strike, no heal\n• CURSE OF RUIN: target ATK −${RUIN.atkCut}% and takes +${RUIN.takenUp}% damage for ${RUIN.rounds} rounds\n• ${RUIN.energy} energy — the boss-neutralising button`,
      description: '💀 A devastating curse that leaves titans hollow. Shred the boss, then let the whole party burst it down.',
      animation: '🕯️ The air goes cold and the light goes out...\n💀 CURSE OF RUIN! Their strength drains into the grave!\n🩸 Hollowed. Now — finish it.',
    },
  },
};
const RENAMES = { 'life drain': 'Curse of Ruin' }; // old owned-skill names → new (Necromancer)

module.exports = { BONE_WALL, SOUL_DRAIN, RUIN, REFORGED, RENAMES, isNecro, isBoneWall, isSoulDrain, isRuin, planBoneWall, castBoneWall, applyBoneWall, boneWallCap, absorb, shieldLine, soulDrainAlly, hasRuin, ruinAtkMult, ruinTakenMult, scaleRuinToRounds, setCooldownTurns, livingMembers };
