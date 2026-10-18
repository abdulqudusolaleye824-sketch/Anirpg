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

function base(entity) { return Math.max(0, Number(entity && entity.stats && entity.stats.magicResist) || 0); }
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
  return Math.max(0, mp);
}
/** @returns {{resisted:boolean, overrides:boolean, chance:number, mr:number, mp:number}} */
function check(target, caster, rng = Math.random) {
  const mr = effective(target); const mp = casterPower(caster);
  if (!mr) return { resisted: false, overrides: mp > 0, chance: 0, mr, mp };
  if (mp > mr) return { resisted: false, overrides: true, chance: 0, mr, mp };
  const chance = Math.min(RESIST_CAP, (mr - mp) / (mr + mp + 40));
  return { resisted: rng() < chance, overrides: false, chance: Math.round(chance * 100), mr, mp };
}
function line(res, who) { return res && res.resisted ? `🔰 ${who || 'Target'} RESISTED (MR ${res.mr} vs MP ${res.mp} — ${res.chance}%)` : ''; }

module.exports = { RESIST_CAP, base, effective, casterPower, check, line };
