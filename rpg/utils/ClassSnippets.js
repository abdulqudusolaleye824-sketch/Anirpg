// ═══════════════════════════════════════════════════════════════
// ClassSnippets — Push #103b
// The CLASS-LEVEL rules from "Class revamp.txt" (the "Combat Snippet" of each
// class), in one place, as hooks the engines call:
//   passiveMods(player, out)      — ClassPower: dodge / survive-lethal / MR rules
//   damageMods(player, entry, target) — any outgoing skill: multipliers, statuses, lines
//   multiHitLines(player, entry, dmg, crit) — Archer: per-arrow log
//   incomingHit(player, monster, raw) — Warrior parry / Assassin stealth break
//   onSupportCast(caster, entry) — stealth, rewind, elemental barrier, war cries
//   costMult(player)              — Mage / Shaman / Bard aggressive energy scaling
//   aggroImmune(player)           — Monk Pacifying Presence
//   statusResist(player, type)    — Warrior rank immunity ladder
// Rank = live Hunter Rank (/rank), via SkillRunes.rankOf.
// ═══════════════════════════════════════════════════════════════
'use strict';

function base(p) { try { return String(require('./ClassPower').baseClassName(p) || p.classBase || p.class || ''); } catch (e) { return String((p && (p.classBase || p.class)) || ''); } }
function is(p, name) { return base(p).replace(/\s+/g, '').toLowerCase() === String(name).replace(/\s+/g, '').toLowerCase(); }
function rank(p) { try { return require('./SkillRunes').rankOf(p); } catch (e) { return 'E'; } }
function rankIdx(p) { return ['F', 'E', 'D', 'C', 'B', 'A', 'S'].indexOf(rank(p)); }
function txt(entry) { return `${(entry && entry.name) || ''} ${(entry && entry.effect) || ''} ${(entry && entry.description) || ''}`.toLowerCase(); }

// ── Rank ladders from the spec ──────────────────────────────────────────────
const ROGUE_SLIP = { S: 90, A: 70, B: 60, C: 50, D: 40, E: 30, F: 30 };      // "+X% extra chance to slip away" (relative to dodge)
const WARRIOR_IMMUNE = { S: 100, A: 90, B: 80, C: 70, D: 50, E: 40, F: 40 }; // status immunity chance
const DARK_RE = /bone|death|decay|void|shadow|spectral|hollow|dusk|plague|ghoul|wraith|dark|abyss|chaos|undead|lich|skelet|phantom|blood|vampir/i;

// ── ClassPower hook (before clamps) ────────────────────────────────────────
function passiveMods(player, out) {
  if (!player || !out) return out;
  if (is(player, 'Knight')) out.surviveLethal = 1;                       // Unyielding Spirit — once per fight (engine-tracked)
  if (is(player, 'Rogue')) { const s = ROGUE_SLIP[rank(player)] || 30; out.dodge = (out.dodge || 0) * (1 + s / 100) + 5; }
  if (is(player, 'Phantom')) out.dodge = (out.dodge || 0) + 20;          // ethereal phasing
  if (is(player, 'Warlord') || is(player, 'WorldClass')) { out.dodge = (out.dodge || 0) * 1.3 + 5; out.def = (out.def || 0) + 10; } // evasive defence tank
  if (is(player, 'ShadowDancer')) { out.dodge = (out.dodge || 0) + 8; out.crit = (out.crit || 0) + 8; }
  if (is(player, 'Berserker')) { out.dmgTaken = (out.dmgTaken || 0) + 10; out.lifesteal = (out.lifesteal || 0) + 8; } // all offence, no posture
  if (is(player, 'BloodKnight')) out.lifesteal = (out.lifesteal || 0) + 10;
  if (is(player, 'Senku')) { out.atk = (out.atk || 0) + 10; out.def = (out.def || 0) + 10; out.crit = (out.crit || 0) + 5; } // the 10 billion % genius
  if (player._stealth > 0) out.dodge = (out.dodge || 0) + 25;
  return out;
}

// ── Energy cost scaling ("aggressively scaling energy costs") ─────────────
function costMult(player) { if (!player) return 1; if (is(player, 'Mage')) return 1.25; if (is(player, 'Shaman')) return 1.3; if (is(player, 'Bard')) return 1.2; return 1; }

// ── Monk: Pacifying Presence ───────────────────────────────────────────────
function aggroImmune(player) { return !!player && is(player, 'Monk'); }
function preventsBerserk(player) { return !!player && is(player, 'Monk'); }

// ── Warrior: status immunity ladder (rolled per attempt; MR override still wins) ──
function statusResist(player, type) {
  if (!player) return false;
  if (is(player, 'Warrior')) { const c = WARRIOR_IMMUNE[rank(player)] || 40; return Math.random() * 100 < c; }
  if (is(player, 'Druid') && /poison|disease|slow|weaken/.test(String(type))) return Math.random() < 0.5;
  if (is(player, 'Paladin') && /fear|curse|charm|silence/.test(String(type))) return true;
  return false;
}

// ── Outgoing damage rules ──────────────────────────────────────────────────
// Returns { mult, lines, statuses, noMiss }
function damageMods(player, entry, target) {
  const r = { mult: 1, lines: [], statuses: [], noMiss: false };
  if (!player || !entry) return r;
  const t = txt(entry); const tname = String((target && target.name) || '');
  const thp = target ? Number((target.stats && target.stats.hp) ?? target.hp) || 0 : 0;
  const tmax = target ? Number((target.stats && target.stats.maxHp) ?? target.maxHp) || thp || 1 : 1;
  // Universal: execution skills vs <30% HP
  if (/execut|finisher|banish|guillotine|decapitat|death sentence/.test(t) && target && thp > 0 && thp / tmax < 0.3) { r.mult *= 1.75; r.lines.push(`⚔️ *EXECUTION* — the target is below 30% HP: ×1.75`); }
  // Paladin: holy damage heavily amplified vs dark/undead
  if (is(player, 'Paladin') && DARK_RE.test(tname)) { r.mult *= 1.5; r.lines.push(`✨ Holy light sears the unholy *${tname}* — ×1.5`); }
  // Assassin: strike from stealth cannot miss; stealth breaks
  if (is(player, 'Assassin') && player._stealth > 0) { r.noMiss = true; r.mult *= 1.3; r.lines.push(`🗡️ *STEALTH STRIKE* — from the shadows: guaranteed hit, ×1.3`); player._stealth = 0; }
  // Warrior: parry counter
  if (is(player, 'Warrior') && player._parryCounter) { r.mult *= 1.5; r.lines.push(`🛡️➡️⚔️ *RIPOSTE* — the parried blow is answered: ×1.5`); player._parryCounter = false; }
  // Elementalist: rotates fire → ice → lightning every cast, with reactions on the target
  if (is(player, 'Elementalist') && entry.type !== 'heal' && !entry.isPassive) {
    const cyc = ['fire', 'ice', 'lightning']; const i = Number(player._elemIdx || 0) % 3; player._elemIdx = i + 1;
    const el = cyc[i]; const st = { fire: 'burn', ice: 'freeze', lightning: 'stun' }[el]; const em = { fire: '🔥', ice: '❄️', lightning: '⚡' }[el];
    r.statuses.push({ type: st, chance: 45, duration: 2 });
    const has = (x) => ((target && target.statusEffects) || []).some(e => String(e.type || '').toLowerCase() === x);
    if (el === 'ice' && has('burn')) { r.mult *= 1.3; r.lines.push(`${em} *STEAM BURST* — ice on a burning foe: ×1.3`); }
    else if (el === 'lightning' && has('freeze')) { r.mult *= 1.45; r.lines.push(`${em} *SHATTER* — lightning through ice: ×1.45`); }
    else if (el === 'fire' && has('stun')) { r.mult *= 1.3; r.lines.push(`${em} *OVERLOAD* — fire on a stunned foe: ×1.3`); }
    else r.lines.push(`${em} Element: *${el.toUpperCase()}*`);
  }
  // DragonKnight: fear inducement on every strike
  if (is(player, 'DragonKnight') && entry.type === 'damage') r.statuses.push({ type: 'fear', chance: 25, duration: 2 });
  // Devourer: consume enemy max HP permanently (this fight), feed the caster
  if (is(player, 'Devourer') && /consume|devour|eat|feast|gorge|swallow/.test(t) && target) {
    const tst = target.stats && Number.isFinite(target.stats.maxHp) ? target.stats : target;
    const bite = Math.floor((tst.maxHp || 0) * 0.05);
    if (bite > 0) { tst.maxHp = Math.max(1, tst.maxHp - bite); tst.hp = Math.min(tst.hp, tst.maxHp); let mx = player.stats.maxHp || 100; try { mx = require('./GearSystem').effectiveMaxHp(player); } catch (e) {} player.stats.hp = Math.min(mx, (player.stats.hp || 0) + bite); r.lines.push(`🕳️ *CONSUMED* — ${bite.toLocaleString()} of *${tname}*'s max HP is gone for good; ${player.name} feeds on it.`); }
  }
  // Bard: illusions make enemies miss
  if (is(player, 'Bard') && /illusion|trance|lull|dirge|discord|cacophony|charm/.test(t)) r.statuses.push({ type: 'blind', chance: 60, duration: 2 });
  // Chronomancer: temporal loops / time stop
  if (is(player, 'Chronomancer') && /loop|time stop|stasis|freeze time|halt/.test(t)) r.statuses.push({ type: 'stun', chance: 70, duration: 1 });
  return r;
}

// ── Archer: individual arrow logs ──────────────────────────────────────────
function multiHitLines(player, entry, dmg, crit) {
  if (!player || !entry || !(dmg > 0)) return [];
  const m = txt(entry).match(/(\d+)\s*(?:quick\s+|rapid\s+|homing\s+)?(arrows|shots|bolts|volleys|strikes|hits|cuts|slashes|blades|arcs|swords|needles|shards)/);
  if (!m) return [];
  const n = Math.max(2, Math.min(10, parseInt(m[1], 10))); const unit = m[2].replace(/s$/, '');
  const parts = []; let left = dmg; const w = Array.from({ length: n }, () => 0.7 + Math.random() * 0.6); const W = w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) { const d = i === n - 1 ? left : Math.max(1, Math.floor(dmg * w[i] / W)); left -= d; parts.push(d); }
  const em = /arrow|shot|bolt|volley/.test(unit) ? '➶' : '⚔️';
  const lines = parts.map((d, i) => `${em} ${unit.charAt(0).toUpperCase() + unit.slice(1)} ${i + 1}: *${d.toLocaleString()}*${crit && i === parts.indexOf(Math.max(...parts)) ? ' 💥 CRIT' : ''}`);
  lines.push(`Σ ${n} ${unit}s — *${dmg.toLocaleString()}* total`);
  return lines;
}

// ── Incoming hit on a hunter (monster → player). Returns { raw, lines, parried } ──
function incomingHit(player, monster, raw) {
  const out = { raw, lines: [], parried: false };
  if (!player || !(raw > 0)) return out;
  if (is(player, 'Warrior')) {
    const cost = 20; const chance = 12 + 4 * Math.max(0, rankIdx(player));
    if ((player.stats.energy || 0) >= cost && Math.random() * 100 < chance) {
      player.stats.energy -= cost; player._parryCounter = true; out.raw = 0; out.parried = true;
      out.lines.push(`🛡️ *PARRY!* ${player.name} turns the blow aside (−${cost} energy) — the next strike is a *riposte* (×1.5).`);
    }
  }
  // Shadow decoy (Rogue Shadow Clone / Assassin Shadow Decoy / ShadowDancer Twilight Decoy): eats ONE single-target hit.
  if (out.raw > 0 && player._decoy > 0) { player._decoy -= 1; out.lines.push(`🌑 *DECOY!* The blow shreds ${player.name}'s shadow clone — ${player.name} is untouched.`); out.raw = 0; out.decoy = true; }
  // Elementalist barrier: absorbs the next hit of its attuned element (otherwise 25% of any hit), then shatters.
  if (out.raw > 0 && player._elemBarrier) {
    const el = String(player._elemBarrier); const mEl = String((monster && (monster.element || monster.type)) || '').toLowerCase();
    const full = mEl && (mEl.includes(el) || (el === 'lightning' && /storm|thunder|volt/.test(mEl)) || (el === 'ice' && /frost|ice|glacial/.test(mEl)) || (el === 'fire' && /fire|ember|lava|magma|infernal/.test(mEl)));
    const cut = full ? out.raw : Math.floor(out.raw * 0.25);
    out.raw -= cut; delete player._elemBarrier;
    out.lines.push(`🔮 ${el.toUpperCase()} barrier ${full ? 'drinks the whole hit' : `soaks *${cut}*`} and shatters.`);
  }
  // Warlord formation: −10% while the banner stands (2 of the hunter's own turns).
  if (out.raw > 0 && player._formation > 0) { const cut = Math.floor(out.raw * 0.10); if (cut > 0) { out.raw -= cut; out.lines.push(`🏴 Formation absorbs *${cut}*.`); } }
  if (player._stealth > 0 && out.raw > 0) { player._stealth = 0; out.lines.push(`👁️ ${player.name} is knocked out of stealth.`); }
  return out;
}

// ── Support-cast side effects (buff/heal skills) ───────────────────────────
function onSupportCast(caster, entry) {
  const L = []; if (!caster || !entry) return L; const t = txt(entry);
  let lvl = 1; try { lvl = Number((require('./SkillCatalog').resolveSkill(caster, entry.name, { allowLibrary: true }).skill || {}).level) || 1; } catch (e) {}
  if (is(caster, 'Assassin') && /stealth|vanish|cloak|shadow step|smoke|conceal/.test(t)) { caster._stealth = 1 + lvl; L.push(`🌑 *STEALTH* — ${caster.name} melts into the dark for ${caster._stealth} turns: +25% dodge, next strike cannot miss (×1.3).`); }
  if (is(caster, 'Chronomancer') && /rewind|revert|turn back|undo|restore the timeline|reverse/.test(t)) {
    const h = Array.isArray(caster._hpHistory) ? caster._hpHistory : []; const back = h.length >= 2 ? h[h.length - 2] : h[0];
    if (back && back > (caster.stats.hp || 0)) { let mx = caster.stats.maxHp || 100; try { mx = require('./GearSystem').effectiveMaxHp(caster); } catch (e) {} const to = Math.min(mx, back); L.push(`⏳ *REWIND* — the timeline snaps back two turns: ${caster.name} ${caster.stats.hp.toLocaleString()} → ${to.toLocaleString()} HP.`); caster.stats.hp = to; }
    else L.push(`⏳ The timeline holds — nothing to rewind yet.`);
    if (Array.isArray(caster.statusEffects) && caster.statusEffects.length) { const n = caster.statusEffects.length; caster.statusEffects = []; L.push(`⏳ ${n} status effect${n === 1 ? '' : 's'} never happened.`); }
  }
  if ((is(caster, 'Rogue') || is(caster, 'Assassin') || is(caster, 'ShadowDancer')) && /decoy|shadow clone|clone absorbing/.test(t)) { caster._decoy = 1; L.push(`🌑 *DECOY* — a shadow clone of ${caster.name} steps forward: the next single-target hit shreds the clone instead.`); }
  if (is(caster, 'Elementalist') && /barrier|ward|shield|aegis/.test(t)) { const cyc = ['fire', 'ice', 'lightning']; const el = cyc[Number(caster._elemIdx || 0) % 3]; caster._elemBarrier = el; L.push(`🔮 Elemental barrier attuned to *${el.toUpperCase()}* — absorbs the next ${el} hit.`); }
  if ((is(caster, 'Warlord') || is(caster, 'WorldClass')) && /war cry|rally|command|formation|banner|roar/.test(t)) { caster._formation = 2; L.push(`🏴 *FORMATION* — the frontline tightens around ${caster.name}: allies take −10% damage for 2 turns.`); }
  return L;
}

// Track HP per turn for Chronomancer rewinds (call after any hit on the hunter)
function noteHp(player) { if (!player || !player.stats) return; if (player._formation > 0) player._formation -= 1; if (!is(player, 'Chronomancer')) return; const h = Array.isArray(player._hpHistory) ? player._hpHistory : []; h.push(Number(player.stats.hp) || 0); while (h.length > 6) h.shift(); player._hpHistory = h; }

// Shaman perks
function petCaptureBonus(player) { return player && is(player, 'Shaman') ? 0.95 : 0; }   // near-guaranteed
function craftAlwaysSucceeds(player) { return !!player && (is(player, 'Shaman') || is(player, 'Senku')); }
function ignoresAlwaysHit(player) { return !!player && is(player, 'Shaman'); }

// ── Push #103b: HEAL BUDGET per fight (non-Healer classes) ────────────────
// Heals are a Healer's craft: anyone else pays double energy (SkillCatalog) AND may heal only
// a few times per fight by Hunter Rank — F/E 1 · D/C 2 · B/A 3 · S 5. Reset by clearFight.
const HEAL_USES = { F: 1, E: 1, D: 2, C: 2, B: 3, A: 3, S: 5 };
function isHealEntry(entry) { return !!entry && (String(entry.type || '').toLowerCase() === 'heal' || (Number(entry.healingPct) || 0) > 0); }
function healLimit(player) { if (!player || is(player, 'Healer')) return Infinity; return HEAL_USES[rank(player)] || 1; }
function healGate(player, entry) {
  if (!player || !isHealEntry(entry) || is(player, 'Healer')) return { ok: true };
  const used = Number(player._healCasts) || 0, lim = healLimit(player);
  if (used >= lim) return { ok: false, error: `💔 *${entry.name}* — your healing is spent for this fight (${lim}/${lim} used · ${rank(player)}-rank). Only Healers mend without limit.` };
  return { ok: true, used, limit: lim };
}
function noteHeal(player, entry) { if (!player || !isHealEntry(entry) || is(player, 'Healer')) return null; player._healCasts = (Number(player._healCasts) || 0) + 1; const lim = healLimit(player); return `💔 Heal ${player._healCasts}/${lim} this fight`; }
function clearFight(player) { if (!player) return; delete player._healCasts; delete player._stealth; delete player._parryCounter; delete player._elemIdx; delete player._elemBarrier; delete player._formation; delete player._hpHistory; delete player._decoy; }

module.exports = { HEAL_USES, isHealEntry, healLimit, healGate, noteHeal, base, is, rank, rankIdx, ROGUE_SLIP, WARRIOR_IMMUNE, DARK_RE, passiveMods, costMult, aggroImmune, preventsBerserk, statusResist, damageMods, multiHitLines, incomingHit, onSupportCast, noteHp, petCaptureBonus, craftAlwaysSucceeds, ignoresAlwaysHit, clearFight };
