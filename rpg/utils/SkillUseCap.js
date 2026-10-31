// 10-30 (owner): PER-RAID SKILL USE CAPS. Every active skill may be used only so many times in ONE gate raid
// (the whole raid, every floor and the boss). The cap depends on potency, never on skill level/upgrades:
//   ultimate  1–3 · big AoE  3–5 · normal  8–12 · basic  15.  Shown in /skills info; refused when spent.
'use strict';
function _pct(s) { return Number(s && (s.damagePct || s.healPct || s.damage)) || 0; }
// Rank-locked skills (B/A/S rune kits) carry no unlock level — treat them as Lv.90+ (B) / 95+ (A) / 100 (S) kit skills.
const RANK_LV = { C: 60, B: 90, A: 95, S: 100, SS: 100 };
function _lvl(s) { const r = s && s.rankReq ? RANK_LV[String(s.rankReq).toUpperCase()] : 0; return Number(s && (s.unlocksAtLevel || s.unlockedAt)) || r || 1; }
const ULT_RE = /cataclysm|sovereign|ultimate|genesis|resurrection|verdict|singularity|realm[- ]breaker|supernova|apocalypse|annihilat|domain of|domain expansion|absolute|collapse/i;
function tierOf(skill) {
  if (!skill || skill.isPassive || skill.type === 'passive') return null;
  let aoe = false; try { aoe = require('./SkillCatalog').isAoe(skill); } catch (e) {}
  const pct = _pct(skill), lv = _lvl(skill), dmg = /damage|debuff/i.test(String(skill.type || 'damage'));
  const rk = String(skill.rankReq || '').toUpperCase();
  if (skill.isUltimate || skill.ultimate || ULT_RE.test(String(skill.name || '')) || rk === 'A' || rk === 'S' || rk === 'SS' || (dmg && (pct >= 400 || lv >= 90))) return 'ultimate';
  if (aoe && (pct >= 150 || lv >= 40)) return 'aoe';
  if (lv <= 15 && pct <= 150) return 'basic';
  return 'normal';
}
function capFor(skill) {
  const t = tierOf(skill); if (!t) return null;
  const pct = _pct(skill), lv = _lvl(skill);
  if (t === 'ultimate') { const rk = String(skill.rankReq || '').toUpperCase(); if (rk === 'S' || rk === 'SS' || pct >= 600) return 1; if (rk === 'A' || pct >= 450) return 2; return 3; }
  if (t === 'aoe') return pct >= 250 ? 3 : pct >= 200 ? 4 : 5;
  if (t === 'basic') return 15;
  return lv >= 70 ? 8 : lv >= 50 ? 10 : 12; // normal
}
const LABEL = { ultimate: 'Ultimate', aoe: 'Big AoE', normal: 'Normal', basic: 'Basic' };
function label(skill) { const t = tierOf(skill); if (!t) return null; return `🔁 ${capFor(skill)}× per raid (${LABEL[t]})`; }
function _key(skill) { return String((skill && skill.name) || '').toLowerCase(); }
/** How many uses are left for this hunter in the current raid. */
function left(player, skill) { const cap = capFor(skill); if (cap == null) return Infinity; const used = (player && player.raidSkillUses && player.raidSkillUses[_key(skill)]) || 0; return Math.max(0, cap - used); }
/** Check (and when `consume` is true, count) a use. Returns null when allowed, else the refusal text. */
function use(player, skill, consume = true) {
  const cap = capFor(skill); if (cap == null || !player) return null;
  if (!player.raidSkillUses || typeof player.raidSkillUses !== 'object') player.raidSkillUses = {};
  const k = _key(skill), used = Number(player.raidSkillUses[k]) || 0;
  if (used >= cap) return `*${skill.name}* is spent for this raid — ${cap}× per raid (${LABEL[tierOf(skill)]} skill). Use another skill or a basic attack.`;
  if (consume) player.raidSkillUses[k] = used + 1;
  return null;
}
function reset(player) { if (player && typeof player === 'object') player.raidSkillUses = {}; }
module.exports = { tierOf, capFor, label, left, use, reset, LABEL };
