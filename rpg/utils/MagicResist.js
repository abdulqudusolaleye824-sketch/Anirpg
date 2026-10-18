'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Push #103b — MAGIC RESISTANCE (MR)
//   stats.magicResist is a real stat (/upgrade mr). Whenever a skill/domain/monster
//   tries to put a STATUS or DEBUFF on a target:
//     • caster Magic Power  >  target MR  → the effect lands and OVERRIDES class/gear
//       status immunities (overwhelming magic breaks wards)
//     • caster Magic Power  ≤  target MR  → the target resists with chance
//       (MR − MP) / (MR + MP + 40), capped at 70%
//   Temp buffs on 'magicResist' (Harmonic Ward, Shroud of Death…) and passives that
//   say "Magic Resistance +N%" count.
// ═══════════════════════════════════════════════════════════════════════════
const RESIST_CAP = 0.70;

function base(entity) { if (!entity) return 0; const v = entity.stats && entity.stats.magicResist != null ? entity.stats.magicResist : entity.magicResist; return Math.max(0, Number(v) || 0); } // Push #103f: raid beasts carry magicResist at top level
function effective(entity) {
  if (!entity) return 0;
  let mr = base(entity);
  let pct = 0;
  try { for (const v of Object.values(entity.tempBuffs || {})) if (v && v.stat === 'magicResist' && (v.duration || 0) > 0) pct += Number(v.amount) || 0; } catch (e) {}
  try { // passives: "Magic Resistance increased by 20%" / "MR +25%"
    for (const p of ((entity.skills && entity.skills.passive) || [])) {
      const t = String((p && (p.effect || p.description)) || '');
      const m = t.match(/(?:magic resistance|\bmr\b)[^.\n]*?\+?(\d{1,3})%/i) || t.match(/\+(\d{1,3})%\s*(?:magic resistance|mr\b)/i);
      if (m && /magic resistance|\bmr\b/i.test(t) && !/enemy|target/i.test(t)) pct += parseInt(m[1], 10);
    }
  } catch (e) {}
  if (pct) mr = Math.round(mr * (1 + Math.min(200, pct) / 100) + (mr === 0 ? Math.min(60, pct) / 2 : 0));
  return Math.max(0, Math.round(mr));
}
function casterPower(caster) {
  if (!caster) return 0;
  let mp = Number(caster.stats && caster.stats.magicPower) || Number(caster.magicPower) || 0;
  try { const GS = require('./GearSystem'); if (GS.effectiveMagicPower && caster.stats) mp = GS.effectiveMagicPower(caster); } catch (e) {}
  if (!mp && caster.stats && caster.stats.atk) mp = Math.round(Number(caster.stats.atk) * 0.35); // physical casters still carry some force
  if (!mp && !caster.stats && caster.atk) mp = Math.round(Number(caster.atk) * 0.35); // Push #103f: raid beasts (flat shape)
  return Math.max(0, mp);
}
/** @returns {{resisted:boolean, overrides:boolean, chance:number, mr:number, mp:number}} */
function check(target, caster, rng = Math.random) {
  const mr = effective(target); const mp = casterPower(caster);
  if (!mr) return { resisted: false, overrides: mp > 0, chance: 0, mr, mp };
  // Push #103f: MR ALWAYS gets a say. Overwhelming magic (MP > MR) still breaks wards, but the target keeps a
  // resist roll of up to 35% (half-weight); when MR holds the line the roll is (MR − MP)/(MR + MP + 40), cap 70%.
  if (mp > mr) { const c = Math.min(0.35, 0.5 * mr / (mr + mp + 40)); return { resisted: rng() < c, overrides: true, chance: Math.round(c * 100), mr, mp }; }
  const chance = Math.min(RESIST_CAP, Math.max(0.10, (mr - mp) / (mr + mp + 40)));
  return { resisted: rng() < chance, overrides: false, chance: Math.round(chance * 100), mr, mp };
}
function line(res, who) { return res && res.resisted ? `🔰 ${who || 'Target'} RESISTED (MR ${res.mr} vs MP ${res.mp} — ${res.chance}%)` : ''; }

// ── Push #103f: BASELINE MR for every hunter — rank × class × level ──────────────────────────────
//   level × 2  +  Hunter Rank (F/E 0 · D 15 · C 30 · B 50 · A 75 · S 110)  +  class affinity
//   (casters/holy 25 · tanks 15 · hybrids 10 · physical 5 · Monster 20). Granted once (never lowers a stat) and
//   topped up on every level-up (+2, +1 more per rank tier) — upgrade points on MR stack on top.
const RANK_MR = { F: 0, E: 0, D: 15, C: 30, B: 50, A: 75, S: 110, SS: 140 };
const CLASS_MR = { Mage: 25, Elementalist: 25, Chronomancer: 25, Necromancer: 25, Shaman: 25, Healer: 25, Paladin: 25, Druid: 20, Bard: 20, Summoner: 20, Spellblade: 15, Knight: 15, Warlord: 15, DragonKnight: 15, BloodKnight: 10, Phantom: 15, ShadowDancer: 10, Monk: 15, Senku: 15, Devourer: 10, Monster: 20, Warrior: 5, Berserker: 5, Archer: 5, Ranger: 5, Rogue: 5, Assassin: 5 };
function rankOf(p) { const r = String(p.awakenRank || p.hunterRank || p.rank || 'E').toUpperCase().replace(/-?RANK$/, ''); return RANK_MR[r] != null ? r : 'E'; }
function classOf(p) { try { return require('./SkillCatalog').canonicalClassName(p) || ''; } catch (e) { return typeof p.class === 'object' ? (p.class && p.class.name) || '' : String(p.class || ''); } }
function baseline(p) {
  if (!p) return 0;
  const lvl = Math.max(1, Number(p.level) || 1);
  return Math.round(lvl * 2 + (RANK_MR[rankOf(p)] || 0) + (CLASS_MR[classOf(p)] || (p.class ? 10 : 0)));
}
/** Raise stats.magicResist to the baseline if it is below it. Returns the amount added (0 if nothing changed). */
function grantBaseline(p) {
  if (!p || !p.stats) return 0;
  const want = baseline(p); const cur = Number(p.stats.magicResist) || 0;
  if (cur >= want) return 0;
  p.stats.magicResist = want; if (p.baseStats && typeof p.baseStats === 'object') p.baseStats.magicResist = Math.max(Number(p.baseStats.magicResist) || 0, want);
  return want - cur;
}
function perLevelGain(p) { return 2 + Math.max(0, ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS'].indexOf(rankOf(p)) - 1); }
/** Push #103f: how much of a mana/energy drain gets through — drains are halved flat, then MR shaves up to half of the rest. */
function drainMult(target, caster) {
  const mr = effective(target); const mp = casterPower(caster);
  const shave = mr > 0 ? Math.min(0.5, mr / (mr + mp + 40)) : 0;
  return 0.5 * (1 - shave);
}

// Push #103f: beasts get Magic Power / Magic Resistance too — rank × level × ATK — so the mini card and every MP-vs-MR
// roll (hunter statuses on beasts, beast statuses on hunters) use real numbers.
function monsterMagic(mon, rank) {
  const r = String(rank || mon.rank || 'E').toUpperCase(); const lvl = Math.max(1, Number(mon.level) || 1);
  const atk = Number(mon.atk || (mon.stats && mon.stats.atk) || 10);
  const mp = Math.round(atk * 0.45 + (RANK_MR[r] || 0) * 1.2 + lvl * 1.5 + (mon.isBoss || mon.boss ? 60 : 0));
  const mr = Math.round((RANK_MR[r] || 0) * 0.8 + lvl * 1.5 + (mon.isBoss || mon.boss ? 40 : 0));
  return { mp, mr };
}
module.exports = { monsterMagic, RESIST_CAP, RANK_MR, CLASS_MR, base, effective, casterPower, check, line, baseline, grantBaseline, perLevelGain, drainMult };
