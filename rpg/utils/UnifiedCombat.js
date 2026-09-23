// ╔══════════════════════════════════════════════════════╗
// ║         Astra — UnifiedCombat                      ║
// ║  Single damage calculator for ALL battle systems  ║
// ║  PVP / Dungeon / Gate share same math ║
// ╚══════════════════════════════════════════════════════╝

'use strict';

const AttackDB = require('./AttackPatternDB');
const BarSystem = require('./BarSystem');
const SEM = require('./StatusEffectManager');

// Check if player is Pro
function isPro(player) {
  return !!(player && player.isPro && player.proExpiresAt && Date.now() < player.proExpiresAt);
}

// Get attack cooldown for player (pro 50% off)
function getCooldownMs(attack, player) {
  const base = attack.cooldownMs || 30000;
  return isPro(player) ? Math.floor(base * 0.5) : base;
}

// Check if attack is on cooldown for player
function isOnCooldown(player, attackId) {
  if (!player.attackCooldowns) return { onCd: false, remaining: 0 };
  const expiry = player.attackCooldowns[attackId];
  if (!expiry) return { onCd: false, remaining: 0 };
  const now = Date.now();
  if (now >= expiry) return { onCd: false, remaining: 0 };
  return { onCd: true, remaining: expiry - now };
}

// Set cooldown after using attack
function setCooldown(player, attackId, attack) {
  if (!player.attackCooldowns) player.attackCooldowns = {};
  player.attackCooldowns[attackId] = Date.now() + getCooldownMs(attack, player);
}

// Format cooldown remaining nicely
function formatCd(ms) {
  const sec = Math.ceil(ms / 1000);
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  }
  return `${sec}s`;
}

// Push #76: sum of live temp buffs (%) for a stat. Negative = debuff.
function tempBuffPct(entity, stat) {
  let t = 0;
  try {
    for (const v of Object.values(entity.tempBuffs || {})) {
      if (!v || (v.duration || 0) <= 0) continue;
      if (v.stat === stat) t += Number(v.amount) || 0;
      else if (stat === 'atk' && v.bonus != null && !v.stat && false) t += 0;
    }
    const tb = entity.tempBuffs || {};
    if (stat === 'atk' && tb.atk && tb.atk.duration > 0 && tb.atk.bonus != null && !tb.atk.stat) t += (Number(tb.atk.bonus) || 0) * 100;
    if (stat === 'def' && tb.def && tb.def.duration > 0 && tb.def.bonus != null && !tb.def.stat) t += (Number(tb.def.bonus) || 0) * 100;
  } catch (e) {}
  return Math.max(-90, Math.min(300, t));
}
// Apply a skill's parsed buffs (to caster) and debuffs (to target). Returns notes.
function applyMoveBuffs(move, attacker, defender) {
  const notes = [];
  const tag = move.name || 'skill';
  for (const bf of (move.buffs || [])) {
    if (!bf || !bf.stat) continue;
    if (!attacker.tempBuffs) attacker.tempBuffs = {};
    attacker.tempBuffs[`${tag}:${bf.stat}`] = { stat: bf.stat, amount: Math.abs(Number(bf.amount) || 0), duration: Math.max(1, Number(bf.duration) || 2) + 1 };
    notes.push(`⬆️ ${attacker.name || 'Caster'} ${String(bf.stat).toUpperCase()} +${Math.abs(Number(bf.amount) || 0)}% (${bf.duration || 2}t)`);
  }
  for (const db of (move.debuffs || [])) {
    if (!db || !db.stat) continue;
    if (!defender.tempBuffs) defender.tempBuffs = {};
    const amt = Number(db.amount) || 0;
    // damageTaken debuff means the target takes MORE damage → positive amount
    const signed = db.stat === 'damageTaken' ? Math.abs(amt) : -Math.abs(amt);
    defender.tempBuffs[`${tag}:${db.stat}`] = { stat: db.stat, amount: signed, duration: Math.max(1, Number(db.duration) || 3) + 1 };
    notes.push(`⬇️ ${defender.name || 'Target'} ${db.stat === 'damageTaken' ? 'takes' : String(db.stat).toUpperCase()} ${db.stat === 'damageTaken' ? `+${Math.abs(amt)}% damage` : `-${Math.abs(amt)}%`} (${db.duration || 3}t)`);
  }
  for (const sd of (move.selfDebuffs || [])) {
    if (!sd || !sd.stat) continue;
    if (!attacker.tempBuffs) attacker.tempBuffs = {};
    attacker.tempBuffs[`${tag}:self:${sd.stat}`] = { stat: sd.stat, amount: sd.stat === 'damageTaken' ? Math.abs(Number(sd.amount) || 0) : -Math.abs(Number(sd.amount) || 0), duration: Math.max(1, Number(sd.duration) || 2) + 1 };
  }
  return notes;
}

// Unified damage calculation — uses Atk/Def/Speed/Crit/Accuracy + status
function calcMoveDamage(attacker, defender, move) {
  // move can be attack pattern or skill-like object
  // attacker/defender are player objects with stats

  // Accuracy check first — stunned defenders can't dodge (auto-hit).
  // Attacker accuracy mods (blind/fear) come from the status table.
  const _defFx = defender.statusEffects || [];
  const _noDodge = _defFx.some(e => ['stun', 'freeze', 'paralyze'].includes((e.type || '').toLowerCase()));
  let acc = move.accuracy != null ? move.accuracy : 85;
  try { acc *= SEM.getStatModifiers(attacker).accuracyMod; } catch (e) {}
  const roll = Math.random() * 100;
  if (!_noDodge && roll > acc) {
    return { damage: 0, missed: true, crit: false, effective: 'missed', capability: 1 };
  }
  // Push #74: DODGE — the defender's own roll, driven by SPEED difference +
  // gear evasion + passive dodge. (Accuracy above is the attacker missing;
  // this is the defender getting out of the way.)
  let _pmA = null, _pmD = null;
  try { const CP = require('./ClassPower'); _pmA = CP.passiveMultipliers(attacker); _pmD = CP.passiveMultipliers(defender); } catch (e) {}
  if (!_noDodge && !move.undodgeable) {
    const dodge = dodgeChance(attacker, defender, _pmD);
    if (Math.random() * 100 < dodge) {
      return { damage: 0, missed: true, dodged: true, crit: false, effective: 'missed', capability: 1, dodgeChance: dodge };
    }
  }

  // Base ATK vs DEF — equipped gear always counts (players AND monsters
  // flow through here; monsters simply have no equippedGear → +0).
  let _gearAtk = 0, _gearDef = 0, _gearSpdA = 0, _gearSpdD = 0;
  try {
    const { getEquippedBonuses } = require('./GearSystem');
    const ga = getEquippedBonuses(attacker) || {};
    const gd = getEquippedBonuses(defender) || {};
    _gearAtk = ga.atk || 0; _gearDef = gd.def || 0;
    _gearSpdA = ga.speed || 0; _gearSpdD = gd.speed || 0;
  } catch (e) {}
  // Equipped weapons count too (shop/banner/class weapons; monsters have none → +0).
  let _wpnAtk = 0, _wpnDef = 0;
  try {
    _wpnAtk = attacker.weapon?.attack || attacker.weapon?.bonus || 0;
    _wpnDef = defender.weapon?.defense || 0;
  } catch (e) {}
  // Push #85: title boosts + Last Gift (pet death buff) are real stats too.
  let _tA = 0, _tD = 0, _gA = 1, _gD = 1;
  try { const TS = require('./TitleSystem'); _tA = TS.getEquippedBoost(attacker).atk || 0; _tD = TS.getEquippedBoost(defender).def || 0; } catch (e) {}
  try { const PM = require('./PetManager'); _gA = PM.lastGiftMultiplier(attacker) || 1; _gD = PM.lastGiftMultiplier(defender) || 1; } catch (e) {}
  // Push #88: kill-stack flat ATK (Devourer) + armour penetration passives (Ranger/Phantom).
  const atkBase = ((attacker.stats?.atk || attacker.stats?.attack || 50) + _gearAtk + _wpnAtk + _tA + ((_pmA && _pmA.atkFlat) || 0)) * _gA;
  const defBase = ((defender.stats?.def || defender.stats?.defense || 20) + _gearDef + _wpnDef + _tD) * _gD * (1 - Math.min(0.6, ((_pmA && _pmA.armorPen) || 0) / 100));

  // Multipliers from attack pattern
  const atkMult = move.atkMult || 1;
  const defMult = move.defMult || 1; // attack's def factor (defense penetration style)
  const dmgMult = move.dmgMult || 1;
  const critMult = move.critMult || 1.5;
  const speedMult = move.speedMult || 1; // not used in dmg, used for turn order

  // Effective ATK/DEF after multipliers
  // Attacker's ATK multiplied by attack's Atk mult
  // Defender's DEF reduced by defMult inverse? If defMult >1, it's attacker defense? Actually treat as defender DEF * (1/defMult) for high defMult attacks that pierce?
  // Simpler: atkMult boosts attacker, defMult boosts attacker defense? We'll interpret as:
  // effectiveAtk = atkBase * atkMult, effectiveDef = defBase / defMult (so higher defMult on move means more armor pen)
  // Push #74: class passives (quality-scaled) are real stat multipliers.
  const _passAtk = 1 + ((_pmA && _pmA.atk) || 0) / 100;
  const _passDef = 1 + ((_pmD && _pmD.def) || 0) / 100;
  // Push #76: skill stat buffs/debuffs (Fortress Stance DEF+50%, Hunter's Mark,
  // War Cry ATK+…) live in tempBuffs and now really change the numbers.
  const _tbAtk = 1 + tempBuffPct(attacker, 'atk') / 100;
  const _tbDef = 1 + tempBuffPct(defender, 'def') / 100;
  const _tbTaken = 1 + tempBuffPct(defender, 'damageTaken') / 100;
  const effectiveAtk = atkBase * atkMult * _passAtk * Math.max(0.1, _tbAtk);
  const effectiveDef = (defBase * _passDef * Math.max(0, _tbDef)) / Math.max(0.1, defMult);

  // Status multipliers — single-sourced from StatusEffectManager (weakness
  // -75% ATK, fear -50% all stats, stun -50% speed, curse/enfeeble DEF cuts).
  // Paralyzed/frozen/stunned fighters never reach this calc (canAct skips).
  let atkMods = { atkMod: 1, defMod: 1, speedMod: 1, accuracyMod: 1 };
  let defMods = { atkMod: 1, defMod: 1, speedMod: 1, accuracyMod: 1 };
  try {
    atkMods = SEM.getStatModifiers(attacker);
    defMods = SEM.getStatModifiers(defender);
  } catch (e) {}
  const statusAtkMult = atkMods.atkMod;
  const statusDefMult = defMods.defMod;

  const finalAtk = effectiveAtk * statusAtkMult * (move.isSkill && _pmA && _pmA.skillDmg ? 1 + _pmA.skillDmg / 100 : 1);
  const finalDef = effectiveDef * statusDefMult;

  // Base formula: (ATK - DEF/2) * dmgMult with minimum
  let raw = (finalAtk - finalDef * 0.5) * dmgMult * Math.max(0.1, _tbTaken);
  raw = Math.max(5, raw);
  // Move capability: max pre-variance, pre-crit potential. The effectiveness
  // tier compares dealt damage against this (very effective ≥ 80%).
  const capability = Math.max(1, Math.floor(raw));

  // Variation 0.9–1.1
  const variance = 0.9 + Math.random() * 0.2;
  raw = Math.floor(raw * variance);

  // Crit check — base 5% + speed edge + critMult influence
  let critChance = 0.05;
  if (critMult > 1.6) critChance += 0.05;
  if (critMult > 2.0) critChance += 0.07;
  // Speed difference adds crit chance slightly
  const atkSpd = ((attacker.stats?.speed || 50) + _gearSpdA) * (atkMods.speedMod || 1);
  const defSpd = ((defender.stats?.speed || 50) + _gearSpdD) * (defMods.speedMod || 1);
  if (atkSpd > defSpd) critChance += 0.02;

  // Push #87: gear crit (vambrace etc.) + title crit were collected but never applied.
  let _gCrit = 0, _gCritDmg = 0, _tCrit = 0;
  try { const gb = require('./GearSystem').getEquippedBonuses(attacker) || {}; _gCrit = gb.crit || 0; _gCritDmg = gb.critDmg || 0; } catch (e) {}
  try { _tCrit = require('./TitleSystem').getEquippedBoost(attacker).crit || 0; } catch (e) {}
  critChance += ((attacker.stats?.critChance || 0) + ((_pmA && _pmA.crit) || 0) + _gCrit + _tCrit) / 100;
  const isCrit = Math.random() < Math.min(0.75, critChance);
  if (isCrit) {
    // Push #87: ring critDmg adds on top of the move's crit multiplier (+X% → +X/100).
    raw = Math.floor(raw * (critMult + _gCritDmg / 100));
  }
  // Push #74: WEAKEN on the defender → takes more damage; passive damage reduction.
  try {
    const _wk = weakenTakenMult(defender);
    if (_wk !== 1) raw = Math.max(1, Math.floor(raw * _wk));
  } catch (e) {}
  if (_pmD && _pmD.dmgTaken) raw = Math.max(1, Math.floor(raw * (1 + _pmD.dmgTaken / 100)));

  // Push #72: status synergy — moves hit harder vs a target already afflicted.
  let synergyNotes = [];
  try {
    const syn = require('./StatusSynergy').bonusFor(move, defender);
    if (syn.mult !== 1) { raw = Math.max(1, Math.floor(raw * syn.mult)); synergyNotes = syn.notes; }
  } catch (e) {}

  // Determine effectiveness for longer description
  const effectiveness = raw > 200 ? 'devastating' : raw > 120 ? 'powerful' : raw > 60 ? 'solid' : 'light';

  return { damage: raw, missed: false, crit: isCrit, effective: effectiveness, capability, variance, atkMult, defMult, speedMult, critMult, accuracy: acc, synergyNotes };
}

// Process status effect application
// Push #74: dodge chance (percent) for defender vs attacker.
//   base 3% + speed edge (each point of speed the defender has over the
//   attacker = +0.25%, capped +20%) + gear evasion + passive dodge − attacker
//   speed edge. Clamped 0–45%. Frozen/stunned/paralyzed never dodge.
function dodgeChance(attacker, defender, pmD) {
  let gearEvaD = 0, gearSpdA = 0, gearSpdD = 0;
  try {
    const { getEquippedBonuses } = require('./GearSystem');
    const ga = getEquippedBonuses(attacker) || {}; const gd = getEquippedBonuses(defender) || {};
    gearEvaD = gd.evasion || 0; gearSpdA = ga.speed || 0; gearSpdD = gd.speed || 0;
  } catch (e) {}
  let am = { speedMod: 1 }, dm = { speedMod: 1 };
  try { am = SEM.getStatModifiers(attacker); dm = SEM.getStatModifiers(defender); } catch (e) {}
  const aSpd = ((attacker.stats?.speed || 50) + gearSpdA) * (am.speedMod || 1);
  const dSpd = ((defender.stats?.speed || 50) + gearSpdD) * (dm.speedMod || 1);
  const edge = Math.max(-20, Math.min(20, (dSpd - aSpd) * 0.25));
  let dodge = 3 + edge + gearEvaD + ((pmD && pmD.dodge) || 0) + (defender.stats?.evasion || 0) + (defender.stats?.dodge || 0);
  // Temporary dodge buffs (Evasive Step, Gale Ward …)
  try {
    const tb = defender.tempBuffs || {};
    for (const v of Object.values(tb)) { if (v && (v.stat === 'dodge' || v.stat === 'evasion') && v.duration > 0) dodge += Number(v.amount) || 0; }
    if (tb.dodge && tb.dodge.duration > 0) dodge += (Number(tb.dodge.bonus) || 0) * 100;
  } catch (e) {}
  return Math.max(0, Math.min(45, dodge));
}

// Push #74: WEAKEN / WEAKENED / ENFEEBLE = the target TAKES more damage.
//   weaken/weakness +25%, weakened +15%, enfeeble +10% (stacking, cap +50%).
function weakenTakenMult(entity) {
  const fx = (entity && entity.statusEffects) || [];
  let add = 0;
  for (const e of fx) {
    const t = String(e.type || '').toLowerCase();
    if (t === 'weaken' || t === 'weakness') add += 25;
    else if (t === 'weakened') add += 15;
    else if (t === 'enfeeble') add += 10;
  }
  return 1 + Math.min(50, add) / 100;
}

function tryApplyEffect(attack, attacker, defender) {
  if (!attack.effect) return null;
  const chance = attack.effect.chance || 50;
  if (Math.random() * 100 > chance) return null;
  // Push #76: store gear defence — S immunity, B/A resist roll, −1 turn.
  let _turnCut = 0;
  try {
    const sd = require('./ArmoryStore').statusDefense(defender, attack.effect.type);
    if (sd.blocked) { defender._lastStatusBlock = sd.reason; return null; }
    _turnCut = sd.turnReduce || 0;
  } catch (e) {}
  // Apply to defender
  if (!defender.statusEffects) defender.statusEffects = [];
  // Check existing — refresh
  const existing = defender.statusEffects.find(e => e.type === attack.effect.type);
  if (existing) {
    const _min = String(attack.effect.type || '').toLowerCase() === 'poison' ? 4 : 2;
    existing.duration = Math.max(existing.duration, Number(attack.effect.duration) || 2, _min);
    return existing;
  }
  // Push #72: player-applied statuses last at least 2 turns (they used to
  // expire on the very next tick, so DoTs/debuffs never mattered).
  let _dur = Math.max(2, Number(attack.effect.duration) || 2);
  // Push #74: POISON is a real DoT — never shorter than 4 turns.
  if (String(attack.effect.type || '').toLowerCase() === 'poison') _dur = Math.max(4, _dur);
  if (_turnCut) _dur = Math.max(1, _dur - _turnCut);
  const eff = { type: attack.effect.type, duration: _dur, sourceAttack: attack.id };
  defender.statusEffects.push(eff);
  return eff;
}

// Tick status effects: reduce duration by 1, apply DoT, return log lines
function tickStatuses(entity) {
  const logs = [];
  // Push #76: temp stat buffs/debuffs count down with the turn too.
  try {
    for (const [k, v] of Object.entries(entity.tempBuffs || {})) {
      if (!v) { delete entity.tempBuffs[k]; continue; }
      v.duration = (v.duration || 0) - 1;
      if (v.duration <= 0) { delete entity.tempBuffs[k]; if (v.stat) logs.push(`✨ ${String(v.stat).toUpperCase()} ${(v.amount || 0) >= 0 ? 'buff' : 'debuff'} wore off`); }
    }
  } catch (e) {}
  if (!entity.statusEffects || entity.statusEffects.length === 0) return logs;
  const toRemove = [];
  for (let i = 0; i < entity.statusEffects.length; i++) {
    const e = entity.statusEffects[i];
    // DoT — routed through the StatusEffectManager table (burn 5%, bleed
    // 4%, freeze 4%, poison 3% of max HP). Same log lines as before.
    const _dt = (e.type || '').toLowerCase();
    const _dd = (SEM.EFFECTS && SEM.EFFECTS[_dt]) || {};
    const _dpct = e.pctPerTurn || _dd.pctPerTurn || 0;
    if (_dpct > 0) {
      if (entity.stats) {
        const dmg = Math.floor((entity.stats.maxHp || 100) * _dpct);
        entity.stats.hp = Math.max(0, (entity.stats.hp || 0) - dmg);
        const _dlabel = { bleed: '🩸 Bleeding', burn: '🔥 Burning', poison: '☠️ Poison', freeze: '❄️ Frozen' }[_dt] || `✨ ${_dd.name || e.type}`;
        logs.push(`${_dlabel} — ${dmg} dmg`);
      } else if (_dt === 'freeze') {
        logs.push(`❄️ Frozen solid`);
      }
    }
    e.duration -= 1;
    if (e.duration <= 0) {
      toRemove.push(i);
      logs.push(`✨ ${e.type} wore off`);
    }
  }
  // Remove expired
  for (let i = toRemove.length -1; i >=0; i--) {
    entity.statusEffects.splice(toRemove[i], 1);
  }
  return logs;
}

// Can this entity act this turn? Frozen / stunned / paralyzed targets ALWAYS
// lose their turn (skip works exactly like a cooldown skip: 0 dmg, status -1).
// Fear only cuts stats for its turn — it never skips.
// Returns { canAct: boolean, reason: 'frozen' | 'stunned' | 'paralyzed' | null }
function canAct(entity) {
  const fx = entity?.statusEffects || [];
  if (fx.some(e => (e.type || '').toLowerCase() === 'freeze'))   return { canAct: false, reason: 'frozen' };
  if (fx.some(e => (e.type || '').toLowerCase() === 'stun'))     return { canAct: false, reason: 'stunned' };
  if (fx.some(e => (e.type || '').toLowerCase() === 'paralyze')) return { canAct: false, reason: 'paralyzed' };
  return { canAct: true, reason: null };
}

// Basic strike — pure ATK, no pattern multipliers. Used when a fighter
// attacks without choosing a pattern (no free pattern stats).
function basicStrike() {
  return {
    id: 0,
    rank: 'E',
    name: 'Basic Strike',
    flavour: 'A plain weapon swing using pure attack power.',
    description: 'No pattern, no technique — just a straightforward strike with pure attack power.',
    dmgMult: 1,
    atkMult: 1,
    defMult: 1,
    speedMult: 1,
    critMult: 1.5,
    accuracy: 100,
    effect: null,
    cooldownMs: 0,
    cooldownSec: 0,
  };
}

// Build detailed turn narrative — long description, no "faster moves first"
function buildTurnMessage(attacker, defender, move, result, isPlayerTurn = true) {
  const atkName = move.name || 'Attack';
  const rankEmoji = AttackDB.RANK_EMOJI[move.rank] || '⚔️';
  let msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `${rankEmoji} *${attacker.name || 'Hunter'}* unleashed *${atkName}* [${move.rank || '?'}]\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  // Long description if available
  if (move.description) {
    // Batch-47: NO truncation — attack descriptions show in full.
    msg += `_${move.description}_\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  }
  // Stats line
  msg += `📊 Atk×${move.atkMult || 1} Def×${move.defMult || 1} Spd×${move.speedMult || 1} Crit×${move.critMult || 1} Acc ${move.accuracy || 85}%\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  if (result.missed) {
    msg += `💨 *Missed!* The strike sliced air — no damage.\n`;
  } else {
    if (result.crit) msg += `💥 *CRITICAL!* ×${move.critMult} — the hit found the perfect opening!\n`;
    for (const n of (result.synergyNotes || [])) msg += `⚡ *SYNERGY* ${n}\n`;
    msg += `💢 Dealt *${result.damage}* damage`;
    if (result.effective === 'devastating') msg += ` — _devastating impact, the ground trembled_`;
    else if (result.effective === 'powerful') msg += ` — _powerful, the defender staggered_`;
    else if (result.effective === 'solid') msg += ` — _solid connection_`;
    else msg += ` — _light but precise_`;
    msg += `\n`;
  }
  if (move.effect) {
    msg += `${move.effect.emoji} Effect chance: ${move.effect.chance}% — _${move.effect.label} (${move.effect.duration}t)_ — ${move.effect.desc}\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  // HP bars with pro vs regular
  const pIsPro = isPro(attacker);
  const dIsPro = isPro(defender);
  // We'll show defender HP after damage — attacker HP unchanged this action
  // Caller should provide updated HP; we render both
  // This function expects stats.hp already updated; if not, it will show current
  const aBar = BarSystem.getHPBar(attacker.stats?.hp || 0, attacker.stats?.maxHp || 100, pIsPro);
  const dBar = BarSystem.getHPBar(defender.stats?.hp || 0, defender.stats?.maxHp || 100, dIsPro);
  msg += `❤️ ${attacker.name || 'You'}: ${aBar}\n`;
  msg += `❤️ ${defender.name || 'Foe'}: ${dBar}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  return msg;
}

// Delay helpers 3-5s
function randomDelay() {
  return 3000 + Math.floor(Math.random() * 2000); // 3-5s
}
async function slowSend(sock, chatId, content, opts = {}) {
  await new Promise(r => setTimeout(r, randomDelay()));
  return sock.sendMessage(chatId, content, opts);
}

// Effectiveness tier for the battle flow.
//   missed    → the attack didn't land
//   very      → dealt ≥80% of the move's capability AND a status landed
//   weak      → dealt <35% of capability (walled by DEF / defensive skill)
//   effective → everything else (solid hit)
function effectivenessTier(result, statusApplied) {
  if (!result || result.missed) return 'missed';
  const cap = Math.max(1, result.capability || result.damage || 1);
  const ratio = (result.damage || 0) / cap;
  if (statusApplied && ratio >= 0.8) return 'very';
  if (ratio < 0.35) return 'weak';
  return 'effective';
}

function _fxWord(type) {
  const m = { burn: 'burning', bleed: 'bleeding', poison: 'poisoned', freeze: 'frozen', stun: 'stunned', paralyze: 'paralyzed', fear: 'feared', weaken: 'weakened', weakness: 'weakened', weakened: 'weakened', curse: 'cursed', enfeeble: 'enfeebled', blind: 'blinded', silence: 'silenced', trueslow: 'slowed', slow: 'slowed' };
  return m[(type || '').toLowerCase()] || (type || 'afflicted');
}

// ── Standard 5-message battle turn (PvP + gates share this) ──
// o: { attacker, defender, move, result?, mentions?, tag?, prepend?,
//      defenderBar?: 'monster'|'boss', gapMs? }
//   attacker/defender: { name, stats:{hp,maxHp}, statusEffects }
//   move: { name, description?, flavour?, cooldownMs?, effect? }
//   result: precomputed calcMoveDamage-style { damage, crit?, missed?,
//     capability? } — when omitted the damage is rolled here.
// Sends: 1) "<Atk> Uses <Move>!"  2) description + cooldown  3) effectiveness
// 4) "<Atk> dealt <N> damage!"  5) HP bars. Applies damage + move effect.
// Returns { result, statusApplied, tier, texts }.
async function playTurn(sock, chatId, o) {
  const attacker = o.attacker, defender = o.defender, move = o.move || {};
  const atkName = attacker.name || 'Hunter';
  const defName = defender.name || 'Foe';
  const moveName = move.name || 'Attack';
  const mentions = o.mentions || [];
  const gap = o.gapMs != null ? o.gapMs : 500;

  // Push #76: self-buffs land BEFORE the strike (Fortress Stance protects this
  // turn; War Cry powers this hit). Debuffs land only if the hit connects.
  let _buffNotes = [];
  try { if ((move.buffs || []).length || (move.selfDebuffs || []).length) _buffNotes = applyMoveBuffs({ ...move, debuffs: [] }, attacker, defender); } catch (e) {}
  const result = o.result || calcMoveDamage(attacker, defender, move);
  let statusApplied = null;
  if (!result.missed && (result.damage || 0) > 0) {
    if (defender.stats) defender.stats.hp = Math.max(0, (defender.stats.hp || 0) - result.damage);
    try { statusApplied = tryApplyEffect(move, attacker, defender); } catch (e) { statusApplied = null; }
    // Push #76: skills can carry SEVERAL statuses (move.statuses) — roll each.
    try {
      for (const st of (move.statuses || []).slice(move.effect ? 1 : 0)) {
        if (!st || !st.type) continue;
        const got = tryApplyEffect({ id: 'skill', effect: { type: st.type, chance: st.chance ?? 60, duration: st.duration || 2 } }, attacker, defender);
        if (got && !statusApplied) statusApplied = got;
      }
      if ((move.debuffs || []).length) _buffNotes = _buffNotes.concat(applyMoveBuffs({ ...move, buffs: [], selfDebuffs: [] }, attacker, defender));
    } catch (e) {}
    // Push #74: absorbed weapon on-hit statuses (crafted venom blades …)
    try {
      for (const [type, w] of Object.entries(attacker.weaponEffects || {})) {
        if (!w || Math.random() * 100 > (w.chance || 0)) continue;
        const got = tryApplyEffect({ id: 'weapon', effect: { type, chance: 100, duration: w.duration || 4 } }, attacker, defender);
        if (got && !statusApplied) statusApplied = got;
      }
    } catch (e) {}
    // Push #76: STORE weapon on-hit effects (B one/low, A one/high, S 2–3).
    try {
      const Armory = require('./ArmoryStore');
      for (const fx of Armory.weaponEffects(attacker)) {
        if (!fx || Math.random() * 100 > (fx.chance || 0)) continue;
        const got = tryApplyEffect({ id: 'storeweapon', effect: { type: fx.type, chance: 100, duration: fx.duration || 4 } }, attacker, defender);
        if (got && !statusApplied) statusApplied = got;
      }
      // Durability: weapon wears on a landed hit, defender's gear wears on being hit.
      const bw = Armory.wearWeapon(attacker);
      if (bw) o._broke = (o._broke || []).concat([`💥 ${attacker.name || 'Attacker'}'s *${bw.name}* shattered!`]);
      for (const bg of Armory.wearGear(defender)) o._broke = (o._broke || []).concat([`💥 ${defender.name || 'Defender'}'s *${bg.name}* broke apart!`]);
    } catch (e) {}
  }
  const tier = effectivenessTier(result, !!statusApplied);

  const cdMs = move.cooldownMs != null ? move.cooldownMs : getCooldownMs(move, attacker);
  const desc = (move.description || move.flavour || '').trim();
  const effLabel = move.effect
    ? `${move.effect.emoji || '✨'} May inflict: ${move.effect.label || move.effect.type} (${move.effect.chance != null ? move.effect.chance : 50}%${move.effect.duration ? `, ${move.effect.duration}t` : ''})`
    : null;

  const tag = o.tag ? `${o.tag}\n` : '';
  const t1 = `${tag}${o.prepend ? o.prepend + '\n' : ''}⚔️ *${atkName} Uses ${moveName}!*`;
  const t2 = [desc ? `_${desc}_` : null, effLabel, `⏳ Cooldown: ${formatCd(cdMs)}`].filter(Boolean).join('\n'); // batch-47: full description
  let t3;
  if (tier === 'missed') t3 = result.dodged ? `💨 *DODGED!* ${defName} slipped clear of ${atkName}'s attack!` : `💨 *It missed!* ${atkName}'s attack sliced air.`;
  else if (tier === 'very') t3 = `🔥 *It is very effective!* ${defName} is ${_fxWord(statusApplied.type)}!`;
  else if (tier === 'weak') t3 = `🛡️ *It is not effective...* ${defName}'s defense held firm.`;
  else t3 = statusApplied
    ? `⚔️ *It is effective!* ✨ ${defName} is ${_fxWord(statusApplied.type)}!`
    : `⚔️ *It is effective!* A solid hit.`;
  const t4 = result.missed
    ? `💢 *${atkName} dealt 0 damage.*`
    : `💢 *${atkName} dealt ${result.damage} damage!*${result.crit ? ' 💥 CRITICAL!' : ''}${(result.synergyNotes || []).length ? ' ⚡ ' + result.synergyNotes.join(' · ') : ''}`;
  const aBar = BarSystem.getHPBar(attacker.stats?.hp || 0, attacker.stats?.maxHp || 100, isPro(attacker));
  let dBar;
  if (o.defenderBar === 'boss' && BarSystem.getBossHPBar) dBar = BarSystem.getBossHPBar(defender.stats?.hp || 0, defender.stats?.maxHp || 100);
  else if (o.defenderBar === 'monster' && BarSystem.getMonsterHPBar) dBar = BarSystem.getMonsterHPBar(defender.stats?.hp || 0, defender.stats?.maxHp || 100);
  else dBar = BarSystem.getHPBar(defender.stats?.hp || 0, defender.stats?.maxHp || 100, isPro(defender));
  const t5 = `❤️ ${atkName}: ${aBar}\n❤️ ${defName}: ${dBar}`;

  const _blk = defender._lastStatusBlock ? `🛡️ ${defender._lastStatusBlock}.` : null; defender._lastStatusBlock = null;
  const _extra4 = [].concat(_buffNotes || [], (o._broke && o._broke.length) ? o._broke : []);
  const texts = [t1, t2, _blk ? `${t3}\n${_blk}` : t3, _extra4.length ? `${t4}\n${_extra4.join('\n')}` : t4, t5];
  for (let i = 0; i < texts.length; i++) {
    await sock.sendMessage(chatId, { text: texts[i], ...(mentions.length ? { mentions } : {}) });
    if (i < texts.length - 1 && gap > 0) await new Promise((r) => setTimeout(r, gap));
  }
  return { result, statusApplied, tier, texts };
}

module.exports = {
  tempBuffPct, applyMoveBuffs,
  dodgeChance, weakenTakenMult,
  isPro,
  getCooldownMs,
  isOnCooldown,
  setCooldown,
  formatCd,
  calcMoveDamage,
  tryApplyEffect,
  tickStatuses,
  canAct,
  basicStrike,
  buildTurnMessage,
  randomDelay,
  slowSend,
  effectivenessTier,
  playTurn,
};
