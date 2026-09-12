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

// Unified damage calculation — uses Atk/Def/Speed/Crit/Accuracy + status
function calcMoveDamage(attacker, defender, move) {
  // move can be attack pattern or skill-like object
  // attacker/defender are player objects with stats

  // Accuracy check first — stunned defenders can't dodge (auto-hit).
  // Attacker accuracy mods (blind/fear) come from the status table.
  const _defFx = defender.statusEffects || [];
  const _noDodge = _defFx.some(e => (e.type || '').toLowerCase() === 'stun');
  let acc = move.accuracy != null ? move.accuracy : 85;
  try { acc *= SEM.getStatModifiers(attacker).accuracyMod; } catch (e) {}
  const roll = Math.random() * 100;
  if (!_noDodge && roll > acc) {
    return { damage: 0, missed: true, crit: false, effective: 'missed', capability: 1 };
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
  const atkBase = (attacker.stats?.atk || attacker.stats?.attack || 50) + _gearAtk + _wpnAtk;
  const defBase = (defender.stats?.def || defender.stats?.defense || 20) + _gearDef + _wpnDef;

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
  const effectiveAtk = atkBase * atkMult;
  const effectiveDef = defBase / Math.max(0.1, defMult);

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

  const finalAtk = effectiveAtk * statusAtkMult;
  const finalDef = effectiveDef * statusDefMult;

  // Base formula: (ATK - DEF/2) * dmgMult with minimum
  let raw = (finalAtk - finalDef * 0.5) * dmgMult;
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

  const isCrit = Math.random() < critChance;
  if (isCrit) {
    raw = Math.floor(raw * critMult);
  }

  // Determine effectiveness for longer description
  const effectiveness = raw > 200 ? 'devastating' : raw > 120 ? 'powerful' : raw > 60 ? 'solid' : 'light';

  return { damage: raw, missed: false, crit: isCrit, effective: effectiveness, capability, variance, atkMult, defMult, speedMult, critMult, accuracy: acc };
}

// Process status effect application
function tryApplyEffect(attack, attacker, defender) {
  if (!attack.effect) return null;
  const chance = attack.effect.chance || 50;
  if (Math.random() * 100 > chance) return null;
  // Apply to defender
  if (!defender.statusEffects) defender.statusEffects = [];
  // Check existing — refresh
  const existing = defender.statusEffects.find(e => e.type === attack.effect.type);
  if (existing) {
    existing.duration = Math.max(existing.duration, attack.effect.duration);
    return existing;
  }
  const eff = { type: attack.effect.type, duration: attack.effect.duration, sourceAttack: attack.id };
  defender.statusEffects.push(eff);
  return eff;
}

// Tick status effects: reduce duration by 1, apply DoT, return log lines
function tickStatuses(entity) {
  if (!entity.statusEffects || entity.statusEffects.length === 0) return [];
  const logs = [];
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

  const result = o.result || calcMoveDamage(attacker, defender, move);
  let statusApplied = null;
  if (!result.missed && (result.damage || 0) > 0) {
    if (defender.stats) defender.stats.hp = Math.max(0, (defender.stats.hp || 0) - result.damage);
    try { statusApplied = tryApplyEffect(move, attacker, defender); } catch (e) { statusApplied = null; }
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
  if (tier === 'missed') t3 = `💨 *It missed!* ${atkName}'s attack sliced air.`;
  else if (tier === 'very') t3 = `🔥 *It is very effective!* ${defName} is ${_fxWord(statusApplied.type)}!`;
  else if (tier === 'weak') t3 = `🛡️ *It is not effective...* ${defName}'s defense held firm.`;
  else t3 = statusApplied
    ? `⚔️ *It is effective!* ✨ ${defName} is ${_fxWord(statusApplied.type)}!`
    : `⚔️ *It is effective!* A solid hit.`;
  const t4 = result.missed
    ? `💢 *${atkName} dealt 0 damage.*`
    : `💢 *${atkName} dealt ${result.damage} damage!*${result.crit ? ' 💥 CRITICAL!' : ''}`;
  const aBar = BarSystem.getHPBar(attacker.stats?.hp || 0, attacker.stats?.maxHp || 100, isPro(attacker));
  let dBar;
  if (o.defenderBar === 'boss' && BarSystem.getBossHPBar) dBar = BarSystem.getBossHPBar(defender.stats?.hp || 0, defender.stats?.maxHp || 100);
  else if (o.defenderBar === 'monster' && BarSystem.getMonsterHPBar) dBar = BarSystem.getMonsterHPBar(defender.stats?.hp || 0, defender.stats?.maxHp || 100);
  else dBar = BarSystem.getHPBar(defender.stats?.hp || 0, defender.stats?.maxHp || 100, isPro(defender));
  const t5 = `❤️ ${atkName}: ${aBar}\n❤️ ${defName}: ${dBar}`;

  const texts = [t1, t2, t3, t4, t5];
  for (let i = 0; i < texts.length; i++) {
    await sock.sendMessage(chatId, { text: texts[i], ...(mentions.length ? { mentions } : {}) });
    if (i < texts.length - 1 && gap > 0) await new Promise((r) => setTimeout(r, gap));
  }
  return { result, statusApplied, tier, texts };
}

module.exports = {
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
