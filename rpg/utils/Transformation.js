// ═══════════════════════════════════════════════════════════════
// Push #88w — MONSTER-CLASS TRANSFORMATIONS
// Six castable transformations replace the Lv.10/20/30/40/50/60 slots of the
// Monster class ladder (every variant), plus an INNATE passive: a random
// Quarter Transformation (×5, 3 turns) that can trigger on any combat turn
// and cannot be controlled. Transformations multiply ALL stats (ATK / DEF /
// SPD / max HP, current HP scaled with it) for N turns, everywhere (raids,
// dungeons, PvP). Stats are physically multiplied on the player and restored
// when the form ends; a safety sweep reverts anything older than 20 min.
// ═══════════════════════════════════════════════════════════════
'use strict';

const TIERS = [
  { key: 'quarter',       level: 10, name: 'Quarter Transformation',          mult: 5,  turns: 3 },
  { key: 'quarter_full',  level: 20, name: 'Complete Quarter Transformation', mult: 5,  turns: 10 },
  { key: 'half',          level: 30, name: 'Half Transformation',             mult: 10, turns: 3 },
  { key: 'half_full',     level: 40, name: 'Complete Half Transformation',    mult: 10, turns: 10 },
  { key: 'full',          level: 50, name: 'Full Transformation',             mult: 15, turns: 3 },
  { key: 'full_full',     level: 60, name: 'Complete Full Transformation',    mult: 15, turns: 10 },
];
const PASSIVE_CHANCE = 0.08;          // per combat turn, when not transformed (Lv.10+)
const BERSERK_CHANCE = 0.47;          // per combat turn for Monsters below Lv.10 — they go BERSERK
const BERSERK_LEVEL = 10;
// Aftermath when ANY transformation ends: the body pays for it.
const AFTERMATH = [{ type: 'weaken', duration: 10 }, { type: 'stun', duration: 2 }, { type: 'bleed', duration: 7 }];
const MAX_AGE_MS = 20 * 60 * 1000;    // safety: no form outlives 20 minutes
const STATS = ['atk', 'def', 'speed', 'maxHp'];

function baseClass(player) {
  try { return String(require('./ClassPower').baseClassName(player) || ''); } catch (e) { return String(player?.classBase || player?.class || ''); }
}
function isMonster(player) { return !!player && /^monster$/i.test(baseClass(player)); }
function variantName(player) {
  if (!player) return 'Monster';
  const v = player.monsterVariant;
  if (v && typeof v === 'object' && v.name) return String(v.name);
  if (typeof v === 'string' && v) return v;
  const c = player.class && typeof player.class === 'object' ? player.class.name : player.class;
  return c && !/^monster$/i.test(String(c)) ? String(c) : 'Monster';
}
function skillName(tier, player) { return `${tier.name}: ${variantName(player)}`; }
function tierByName(name) {
  const n = String(name || '').toLowerCase();
  // longest names first so "Complete Quarter…" doesn't match "Quarter…"
  return TIERS.slice().sort((a, b) => b.name.length - a.name.length).find(t => n.startsWith(t.name.toLowerCase())) || null;
}
function isTransformSkill(entry) { return !!(entry && (entry.transform || tierByName(entry.name))); }

function active(player) {
  const t = player && player.transform;
  if (!t) return null;
  if ((t.turnsLeft || 0) <= 0 || Date.now() - (t.startedAt || 0) > MAX_AGE_MS) { end(player); return null; }
  return t;
}

function apply(player, tier, source = 'cast') {
  if (!player || !player.stats || !tier) return { ok: false, lines: [], error: 'No stats.' };
  const cur = active(player);
  if (cur) {
    if (cur.mult >= tier.mult) return { ok: false, lines: [], error: `Already transformed (*${cur.name}*, ${cur.turnsLeft} turn${cur.turnsLeft === 1 ? '' : 's'} left).` };
    end(player); // upgrade: drop the weaker form first
  }
  const mult = Number(tier.mult) || 1;
  const applied = {};
  for (const k of STATS) {
    const v = Number(player.stats[k]) || 0;
    const add = Math.floor(v * (mult - 1));
    applied[k] = add;
    player.stats[k] = v + add;
  }
  const hpBefore = Math.max(0, Number(player.stats.hp) || 0);
  player.stats.hp = Math.min(player.stats.maxHp, Math.floor(hpBefore * mult));
  const berserk = source === 'passive' && (player.level || 1) < BERSERK_LEVEL;
  player.transform = {
    key: tier.key, name: skillName(tier, player), tierName: tier.name, mult, turnsLeft: tier.turns + 1, // +1: the casting turn's tick
    variant: variantName(player), startedAt: Date.now(), applied, source, berserk,
  };
  const lines = [
    `🧬 *${player.name || 'Hunter'}* transforms — *${player.transform.name}*! ${source === 'passive' ? '(innate surge) ' : ''}×${mult} ALL STATS for ${tier.turns} turns`,
    ...(berserk ? [`😈 *BERSERK!* The beast is in control — *${player.name || 'Hunter'}* attacks on their own and cannot be commanded. Teammates: stand clear during their turns!`] : []),
    `⚔️ ATK ${player.stats.atk} · 🛡️ DEF ${player.stats.def} · 💨 SPD ${player.stats.speed} · ❤️ ${player.stats.hp}/${player.stats.maxHp}`,
  ];
  return { ok: true, lines, transform: player.transform };
}

function applyAftermath(player, extraTurn = 0) {
  if (!player.statusEffects) player.statusEffects = [];
  for (const a of AFTERMATH) {
    const ex = player.statusEffects.find(e => String(e.type || '').toLowerCase() === a.type);
    const dur = a.duration + extraTurn;
    if (ex) ex.duration = Math.max(ex.duration || 0, dur); else player.statusEffects.push({ type: a.type, duration: dur, source: 'transformation' });
  }
  return `💔 The strain hits — *${player.name || 'Hunter'}* is WEAKENED (10t), STUNNED (2t) and BLEEDING (7t)!`;
}

// aftermath=true → weaken 10 / stun 2 / bleed 7 (natural end). Upgrades pass false.
function end(player, aftermath = false, fromTick = false) {
  const t = player && player.transform;
  if (!t) return null;
  const mult = Number(t.mult) || 1;
  try {
    const a = t.applied || {};
    for (const k of STATS) {
      const v = Number(player.stats[k]) || 0;
      player.stats[k] = Math.max(k === 'maxHp' ? 1 : 0, v - (Number(a[k]) || 0));
    }
    const hp = Number(player.stats.hp) || 0;
    player.stats.hp = Math.max(hp > 0 ? 1 : 0, Math.min(player.stats.maxHp, Math.ceil(hp / mult)));
  } catch (e) {}
  delete player.transform;
  let line = `🧬 *${player.name || 'Hunter'}*'s ${t.tierName || 'transformation'} fades — back to normal form.`;
  if (aftermath) { try { line += '\n' + applyAftermath(player, fromTick ? 1 : 0); } catch (e) {} } // +1: this same tick counts the statuses down once
  return line;
}

// Called once per combat turn for the entity (UnifiedCombat.tickStatuses).
function tick(player) {
  const lines = [];
  if (!player || !player.stats) return lines;
  const t = player.transform;
  if (t) {
    if (Date.now() - (t.startedAt || 0) > MAX_AGE_MS) { const l = end(player, true, true); if (l) lines.push(l); return lines; }
    t.turnsLeft = (t.turnsLeft || 0) - 1;
    if (t.turnsLeft <= 0) { const l = end(player, true, true); if (l) lines.push(l); }
    else lines.push(`🧬 ${t.tierName}${t.berserk ? ' (BERSERK)' : ''} — ${t.turnsLeft} turn${t.turnsLeft === 1 ? '' : 's'} left`);
    return lines;
  }
  // Innate passive: random Quarter Transformation for any Monster-class hunter.
  // Below Lv.10 it is a 47%/turn BERSERK surge; from Lv.10 an 8%/turn controlled one.
  const chance = (player.level || 1) < BERSERK_LEVEL ? BERSERK_CHANCE : PASSIVE_CHANCE;
  if (isMonster(player) && Math.random() < chance) {
    const r = apply(player, TIERS[0], 'passive');
    if (r.ok) lines.push(...r.lines);
  }
  return lines;
}

// Cast from a skill entry (support cast / PvP). Returns { ok, lines, error }.
function cast(player, entry) {
  const tier = (entry && entry.transform && TIERS.find(t => t.key === entry.transform)) || tierByName(entry && entry.name);
  if (!tier) return { ok: false, lines: [], error: 'Not a transformation.' };
  if (!isMonster(player)) return { ok: false, lines: [], error: 'Only Monster-class hunters can transform.' };
  if ((player.level || 1) < tier.level) return { ok: false, lines: [], error: `*${tier.name}* unlocks at Lv.${tier.level}.` };
  return apply(player, tier, 'cast');
}

function isBerserk(player) { const t = active(player); return !!(t && t.berserk); }
const BERSERK_TEXT = '😈 You are BERSERK — the beast controls your body. You cannot command it until the transformation fades.';

// Random move for a berserk hunter: an equipped attack pattern or an unlocked damage skill.
// Returns { kind:'attack', patternId } | { kind:'skill', name } | { kind:'attack', patternId:null } (basic strike).
function berserkPick(player) {
  const opts = [];
  try { for (const id of (player.attackPatterns?.equipped || [])) if (id) opts.push({ kind: 'attack', patternId: id }); } catch (e) {}
  try {
    const SC = require('./SkillCatalog');
    for (const e of SC.getRoster(player)) {
      if (!e || e.isPassive || e.transform) continue;
      if ((e.unlocksAtLevel || 1) > (player.level || 1)) continue;
      const ty = String(e.type || '').toLowerCase();
      if (ty !== 'damage' && ty !== 'debuff') continue;
      if (!SC.onCooldown(player, e).ready) continue;
      if ((player.stats?.energy || 0) < SC.effectiveCost(e, player)) continue;
      opts.push({ kind: 'skill', name: e.name });
    }
  } catch (e) {}
  if (!opts.length) return { kind: 'attack', patternId: null };
  return opts[Math.floor(Math.random() * opts.length)];
}

// Safety sweep for the whole DB (index.js, every minute).
function sweep(db) {
  let n = 0;
  try {
    for (const u of Object.values((db && db.users) || {})) {
      if (u && u.transform && Date.now() - (u.transform.startedAt || 0) > MAX_AGE_MS) { end(u, true); n++; }
    }
  } catch (e) {}
  return n;
}

// Roster entries for the Monster ladder (SkillCatalog injects them at Lv.10…60).
function rosterEntries(variant) {
  return TIERS.map(t => ({
    name: variant ? `${t.name}: ${variant}` : t.name,
    type: 'buff', maxPotency: t.mult, transform: t.key, unlocksAtLevel: t.level,
    energyCost: 30 + t.level, cooldown: 4,
    effect: `• Transform into your ${variant || 'monster'} form: ×${t.mult} ATK, DEF, SPD and HP for ${t.turns} turns\n• Cannot stack with an equal or stronger form`,
    description: `${t.name}${variant ? ` (${variant})` : ''} — the beast beneath the hunter surfaces. Every stat is multiplied ×${t.mult} for ${t.turns} turns; Monster-class hunters may also surge into a Quarter form at random.`,
    animation: `🧬 Bones crack. Skin splits. The ${variant || 'monster'} takes over...\n👹 ${t.name.toUpperCase()}!`,
  }));
}

module.exports = { TIERS, PASSIVE_CHANCE, BERSERK_CHANCE, BERSERK_LEVEL, AFTERMATH, MAX_AGE_MS, isBerserk, BERSERK_TEXT, berserkPick, applyAftermath, isMonster, variantName, skillName, tierByName, isTransformSkill, active, apply, end, tick, cast, sweep, rosterEntries };
