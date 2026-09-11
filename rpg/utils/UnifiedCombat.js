// ╔══════════════════════════════════════════════════════╗
// ║         Astra — UnifiedCombat                      ║
// ║  Single damage calculator for ALL battle systems  ║
// ║  PVP / Dungeon / Gate / WorldBoss share same math ║
// ╚══════════════════════════════════════════════════════╝

'use strict';

const AttackDB = require('./AttackPatternDB');
const BarSystem = require('./BarSystem');

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

  // Accuracy check first
  let acc = move.accuracy != null ? move.accuracy : 85;
  if ((attacker.statusEffects || []).some(e => (e.type || '').toLowerCase() === 'blind')) acc *= 0.5;
  const roll = Math.random() * 100;
  if (roll > acc) {
    return { damage: 0, missed: true, crit: false, effective: 'missed' };
  }

  // Base ATK vs DEF
  const atkBase = attacker.stats?.atk || attacker.stats?.attack || 50;
  const defBase = defender.stats?.def || defender.stats?.defense || 20;

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

  // Status multipliers from CombatSystem
  let statusAtkMult = 1;
  let statusDefMult = 1;
  if (attacker.statusEffects) {
    for (const e of attacker.statusEffects) {
      if (e.type === 'weakened') statusAtkMult *= (1 - (e.reduction || 30)/100);
      if (e.type === 'weaken') statusAtkMult *= 0.7;
      if (e.type === 'fear') statusAtkMult *= 0.8;
      if (e.type === 'slow') statusAtkMult *= 0.8;
      if (e.type === 'paralyze') statusAtkMult *= 0.5;
    }
  }
  if (defender.statusEffects) {
    for (const e of defender.statusEffects) {
      if (e.type === 'curse') statusDefMult *= 0.85;
      if (e.type === 'freeze') statusDefMult *= 0.8;
      if (e.type === 'enfeeble') statusDefMult *= 0.7;
    }
  }

  const finalAtk = effectiveAtk * statusAtkMult;
  const finalDef = effectiveDef * statusDefMult;

  // Base formula: (ATK - DEF/2) * dmgMult with minimum
  let raw = (finalAtk - finalDef * 0.5) * dmgMult;
  raw = Math.max(5, raw);

  // Variation 0.9–1.1
  const variance = 0.9 + Math.random() * 0.2;
  raw = Math.floor(raw * variance);

  // Crit check — base 5% + speed edge + critMult influence
  let critChance = 0.05;
  if (critMult > 1.6) critChance += 0.05;
  if (critMult > 2.0) critChance += 0.07;
  // Speed difference adds crit chance slightly
  const atkSpd = attacker.stats?.speed || 50;
  const defSpd = defender.stats?.speed || 50;
  if (atkSpd > defSpd) critChance += 0.02;

  const isCrit = Math.random() < critChance;
  if (isCrit) {
    raw = Math.floor(raw * critMult);
  }

  // Determine effectiveness for longer description
  const effectiveness = raw > 200 ? 'devastating' : raw > 120 ? 'powerful' : raw > 60 ? 'solid' : 'light';

  return { damage: raw, missed: false, crit: isCrit, effective: effectiveness, variance, atkMult, defMult, speedMult, critMult, accuracy: acc };
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
    // DoT
    if (e.type === 'bleed') {
      const dmg = Math.floor((entity.stats?.maxHp || 100) * 0.04);
      entity.stats.hp = Math.max(0, (entity.stats?.hp || 0) - dmg);
      logs.push(`🩸 Bleeding — ${dmg} dmg`);
    } else if (e.type === 'burn') {
      const dmg = Math.floor((entity.stats?.maxHp || 100) * 0.05);
      entity.stats.hp = Math.max(0, (entity.stats?.hp || 0) - dmg);
      logs.push(`🔥 Burning — ${dmg} dmg`);
    } else if (e.type === 'poison') {
      const dmg = Math.floor((entity.stats?.maxHp || 100) * 0.03);
      entity.stats.hp = Math.max(0, (entity.stats?.hp || 0) - dmg);
      logs.push(`☠️ Poison — ${dmg} dmg`);
    } else if (e.type === 'freeze') {
      // ❄️ Frozen targets also take cold damage each turn (3% max HP)
      if (entity.stats) {
        const dmg = Math.floor((entity.stats.maxHp || 100) * 0.03);
        entity.stats.hp = Math.max(0, (entity.stats.hp || 0) - dmg);
        logs.push(`❄️ Frozen — ${dmg} dmg`);
      } else {
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

// Can this entity act this turn? Frozen / stunned targets ALWAYS lose their turn.
// Returns { canAct: boolean, reason: 'frozen' | 'stunned' | null }
function canAct(entity) {
  const fx = entity?.statusEffects || [];
  if (fx.some(e => (e.type || '').toLowerCase() === 'freeze')) return { canAct: false, reason: 'frozen' };
  if (fx.some(e => (e.type || '').toLowerCase() === 'stun'))   return { canAct: false, reason: 'stunned' };
  if (fx.some(e => (e.type || '').toLowerCase() === 'paralyze') && Math.random() < 0.7) return { canAct: false, reason: 'paralyzed' };
  if (fx.some(e => (e.type || '').toLowerCase() === 'fear') && Math.random() < 0.4) return { canAct: false, reason: 'feared' };
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
    // Truncate a bit for chat
    const desc = move.description.length > 220 ? move.description.slice(0, 220) + '…' : move.description;
    msg += `_${desc}_\n`;
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
};
