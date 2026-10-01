'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Push #95 — MONSTER SKILL SEMANTICS
//   Every monster / boss ability now DOES what its name says, in every engine
//   (dungeon, gate raid, instance). One resolver reads the ability name (plus
//   any bestiary `effect`) and returns a contract:
//     { mult, status:{type,chance,duration,damage}, drainPct, healPct,
//       selfBuff:{stat,amount,turns}, pierce, cleanse }
//   `apply()` then executes the non-damage parts on the real entities:
//     • Mana Drain / Siphon / Leech mana  → really drains the hunter's energy
//     • Life Drain / Vampiric / Soul Drain → heals the monster for part of the hit
//     • Roar / Rage / Frenzy / Howl        → monster ATK up (and FEAR on the hunter)
//     • Shell / Harden / Armor / Carapace  → monster DEF up
//     • Regenerate / Mend / Heal            → monster heals
//     • Pierce / Sunder / Shatter / Breaker → ignores part of DEF
//     • Burn/Poison/Bleed/Stun/Freeze/…     → real status effects (class + gear
//       resistances and job perks respected)
// ═══════════════════════════════════════════════════════════════════════════

const KEYWORDS = [
  // [regex, patch]
  [/mana drain|drain mana|siphon|mana burn|energy drain|leech mana|mana leech/i, { drainPct: 20, status: { type: 'weaken', chance: 40, duration: 2 } }],
  [/soul drain|life drain|drain life|vampir|life steal|lifesteal|blood drain|devour|feast/i, { healPct: 40, status: { type: 'weaken', chance: 45, duration: 3 } }],
  [/hellfire|inferno|fire|flame|burn|meteor|magma|lava|dragon breath|scorch|blaze|ember|pyro/i, { status: { type: 'burn', chance: 60, duration: 4 } }],
  [/venom|poison|toxic|acid|plague|rot|miasma|spore/i, { status: { type: 'poison', chance: 60, duration: 4 } }],
  [/rend|bleed|cut|slash|claw|artery|lacerat|bite|cleave|shred|fang|talon|swarm/i, { status: { type: 'bleed', chance: 50, duration: 3 } }],
  [/crush|slam|smash|stun|bash|quake|dive bomb|bull rush|charge|hammer|pound|club/i, { status: { type: 'stun', chance: 30, duration: 1 } }],
  [/frost|ice|freez|glacial|blizzard|chill|snow/i, { status: { type: 'freeze', chance: 35, duration: 1 } }],
  [/lightning|thunder|shock|volt|storm|paralyz|static/i, { status: { type: 'paralyze', chance: 40, duration: 2 } }],
  [/curse|hex|doom|void|spectral|shadow|dark|abyss|nether/i, { status: { type: 'curse', chance: 50, duration: 3 } }],
  [/roar|howl|shriek|screech|scream|terror|fear|dread|wail|majestic/i, { status: { type: 'fear', chance: 55, duration: 2 }, selfBuff: { stat: 'atk', amount: 20, turns: 3 } }],
  [/rage|frenzy|berserk|fury|enrage|wrath|demon form|bloodlust/i, { selfBuff: { stat: 'atk', amount: 30, turns: 3 } }],
  [/shell|harden|armor|carapace|fortify|iron skin|stone skin|bulwark|guard/i, { selfBuff: { stat: 'def', amount: 35, turns: 3 } }],
  [/^(💚\s*)?regenerate$/i, { selfHealPct: 15, mult: 0.6 }], // Push #96d: the universal Regenerate skill — soft hit, heals 15% max HP
  [/regen|mend|heal|restore|recover|photosynth/i, { healPct: 100, selfHealPct: 12 }],
  [/pierce|sunder|shatter|breaker|penetrat|impale|lance|spear|puncture/i, { pierce: 50 }],
  [/web|net|snare|slow|tangle|bind|grasp|entangle/i, { status: { type: 'trueslow', chance: 55, duration: 2 } }],
  [/blind|smoke|sand|dust|flash|mist/i, { status: { type: 'blind', chance: 55, duration: 2 } }],
  [/silence|mute|hush|seal/i, { status: { type: 'silence', chance: 45, duration: 2 } }],
  [/confus|whirl|spin|daze|vertigo|hypno/i, { status: { type: 'confuse', chance: 50, duration: 2 } }],
  [/petrif|gaze|stone|medusa/i, { status: { type: 'petrify', chance: 35, duration: 1 } }],
  [/weaken|enfeeble|sap|wither|decay|grave|touch/i, { status: { type: 'weaken', chance: 55, duration: 3 } }],
];
const DEFAULT_MULT = 1.5;

// Bestiary `effect` → status type normalisation.
const EFFECT_ALIAS = { weaken: 'weaken', burn: 'burn', bleed: 'bleed', stun: 'stun', poison: 'poison', fear: 'fear', freeze: 'freeze', paralyze: 'paralyze', curse: 'curse', slow: 'trueslow', blind: 'blind', silence: 'silence', confuse: 'confuse', petrify: 'petrify', knockback: 'stun', doom: 'curse' };

function resolve(ability) {
  const name = typeof ability === 'string' ? ability : (ability && ability.name) || '';
  const out = { name, mult: DEFAULT_MULT, status: null, drainPct: 0, healPct: 0, selfHealPct: 0, selfBuff: null, pierce: 0 };
  if (!name) return out;
  // 1) MonsterAbilities table (dungeon monsters) — take its multiplier / status.
  try {
    const MA = require('./MonsterAbilities');
    const clean = name.replace(/^[^\w]+/, '').trim();
    const def = (MA.abilities && (MA.abilities[clean] || MA.abilities[name])) || null;
    if (def) {
      if (def.damageMultiplier) out.mult = def.damageMultiplier;
      if (def.statusEffect && def.statusEffect.type) out.status = { type: EFFECT_ALIAS[def.statusEffect.type] || def.statusEffect.type, chance: def.statusEffect.chance || 50, duration: def.statusEffect.duration || 2, damage: def.statusEffect.damage || 0 };
    }
  } catch (e) {}
  // 2) bestiary contract { name, effect, chance }
  if (ability && typeof ability === 'object' && ability.effect) {
    out.status = { type: EFFECT_ALIAS[String(ability.effect).toLowerCase()] || String(ability.effect).toLowerCase(), chance: Number(ability.chance) || 50, duration: 3 };
  }
  // 3) name semantics — the words on the tin.
  for (const [rx, patch] of KEYWORDS) {
    if (!rx.test(name)) continue;
    if (patch.mult) out.mult = patch.mult;
    if (patch.drainPct) out.drainPct = Math.max(out.drainPct, patch.drainPct);
    if (patch.healPct) out.healPct = Math.max(out.healPct, patch.healPct);
    if (patch.selfHealPct) out.selfHealPct = Math.max(out.selfHealPct, patch.selfHealPct);
    if (patch.pierce) out.pierce = Math.max(out.pierce, patch.pierce);
    if (patch.selfBuff && !out.selfBuff) out.selfBuff = { ...patch.selfBuff };
    if (patch.status && !out.status) out.status = { ...patch.status };
  }
  return out;
}

function _max(p) { try { return require('./GearSystem').effectiveMaxHp(p) || p.stats.maxHp || 100; } catch (e) { return (p && p.stats && p.stats.maxHp) || 100; } }

// Apply a status to a hunter with every defence layer (class resistance,
// armory gear, job perks) and return a log line or null.
function applyStatus(player, type, duration, damage) {
  if (!player || !type) return null;
  const t = String(type).toLowerCase();
  try {
    const JS = require('./JobSystem');
    if (t === 'fear' && JS.mod(player, 'fearImmune')) return `🐉 *${player.name}* is a Beast King — fear is beneath them.`;
    if (['stun', 'freeze', 'paralyze', 'petrify'].includes(t)) { const cr = JS.mod(player, 'ccResist'); if (cr && Math.random() * 100 < cr) return `👊 *${player.name}* is Unbreakable — shrugged off the ${t.toUpperCase()}!`; }
  } catch (e) {}
  try {
    const SEM = require('./StatusEffectManager');
    const ok = SEM.applyEffect(player, t, Math.max(1, Number(duration) || 2));
    if (!ok) return player._lastStatusBlock ? `🛡️ *${player.name}* resisted ${t.toUpperCase()} (${player._lastStatusBlock})` : `🛡️ *${player.name}* resisted ${t.toUpperCase()}!`;
    const fx = (player.statusEffects || []).find(e => e.type === t);
    if (fx && damage) fx.damage = Math.max(fx.damage || 0, damage);
    return `${(fx && fx.emoji) || '☠️'} *${player.name}* is ${(fx && fx.name) || t.toUpperCase()} (${(fx && fx.duration) || duration}t)`;
  } catch (e) { return null; }
}

// Execute the non-damage effects of a monster ability. `dmg` = damage dealt.
function apply(monster, player, ability, dmg, opts = {}) {
  const c = resolve(ability); const lines = [];
  if (!monster || !player) return { contract: c, lines };
  const mStats = monster.stats || monster; // raid monsters keep hp/atk at top level
  // Mana drain → drains the hunter's energy (name + mult still deal the hit).
  if (c.drainPct > 0 && player.stats) {
    const maxE = player.stats.maxEnergy || 100;
    const loss = Math.max(5, Math.floor(maxE * c.drainPct / 100));
    const before = player.stats.energy || 0;
    player.stats.energy = Math.max(0, before - loss);
    if (before - player.stats.energy > 0) lines.push(`🌀 *${player.name}* loses *${before - player.stats.energy}* ${player.energyType || 'energy'} — drained by ${c.name}!`);
  }
  // Life drain → the monster heals for part of the hit; heal skills → % of its max.
  if ((c.healPct > 0 && dmg > 0) || c.selfHealPct > 0) {
    const max = mStats.maxHp || mStats.hp || 0;
    const amt = Math.max(0, Math.floor((dmg || 0) * c.healPct / 100) + Math.floor(max * c.selfHealPct / 100));
    if (amt > 0 && max > 0 && (mStats.hp || 0) > 0) {
      const b = mStats.hp; mStats.hp = Math.min(max, mStats.hp + amt);
      if (mStats.hp > b) lines.push(`🩸 ${monster.emoji || '👹'} ${monster.name} recovers *${mStats.hp - b}* HP (${c.name})`);
    }
  }
  // Roar / rage / shell → monster buffs itself (real tempBuffs, ticked per turn).
  if (c.selfBuff) {
    if (!monster.tempBuffs) monster.tempBuffs = {};
    monster.tempBuffs[`mskill:${c.selfBuff.stat}`] = { stat: c.selfBuff.stat, amount: c.selfBuff.amount, duration: c.selfBuff.turns + 1, source: c.name };
    lines.push(`📈 ${monster.emoji || '👹'} ${monster.name}'s ${c.selfBuff.stat.toUpperCase()} rises +${c.selfBuff.amount}% (${c.selfBuff.turns}t)`);
  }
  // Status on the hunter.
  if (c.status && !opts.skipStatus && !(monster.noStatus) && (dmg > 0 || opts.forceStatus)) {
    if (Math.random() * 100 < (c.status.chance || 50)) {
      const l = applyStatus(player, c.status.type, c.status.duration, c.status.damage);
      if (l) lines.push(l);
    }
  }
  return { contract: c, lines };
}

// Damage multiplier for the hit itself, incl. armour pierce (def soak reduced).
function hitMult(ability) { return resolve(ability).mult || DEFAULT_MULT; }
function pierce(ability) { return resolve(ability).pierce || 0; }

module.exports = { resolve, apply, applyStatus, hitMult, pierce, KEYWORDS };
