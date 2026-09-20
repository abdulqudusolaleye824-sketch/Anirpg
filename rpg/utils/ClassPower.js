// ═══════════════════════════════════════════════════════════════
// CLASS POWER — Push #74
//
// The class system rolled a quality % and *described* bonuses, but for a
// lot of hunters nothing ever reached their stats:
//   • applyClassToPlayer() ran once at awakening; players migrated from the
//     old class object form, /recon'd players, or players whose class was
//     set directly (`player.class = className` in some paths) never got it.
//   • Skill passives ("+15% ATK", "+20% DEF while below half HP") were text.
//
// This module makes class power REAL and idempotent:
//   ensureClassBonuses(player)  — apply the quality-scaled maxBonuses once,
//                                 recorded in player.classBonusApplied so it
//                                 is never double-applied. Re-applies when
//                                 class/quality changes (recon, awaken).
//   passiveMultipliers(player)  — {atk, def, speed, crit, dodge, dmgTaken}
//                                 parsed from unlocked passive skills,
//                                 scaled by class quality %.
//   recalibrate(player)         — strip + re-apply everything (used by
//                                 /globalskill and /recon).
// ═══════════════════════════════════════════════════════════════
'use strict';

const BONUS_STATS = ['hp', 'maxHp', 'atk', 'def', 'speed', 'maxEnergy', 'critChance', 'lifesteal', 'magicPower'];

function _cs() { try { return require('./ClassSystem'); } catch (e) { return null; } }
function _sc() { try { return require('./SkillCatalog'); } catch (e) { return null; } }

function className(player) {
  if (!player) return null;
  const raw = player.class;
  const n = raw && typeof raw === 'object' ? (raw.name || raw.className) : raw;
  return n ? String(n) : null;
}
function baseClassName(player) {
  const CS = _cs();
  const n = className(player);
  if (!n) return null;
  if (player.classBase) return player.classBase;
  if (CS && CS.CLASS_DATA && CS.CLASS_DATA[n]) return n;
  if (CS && Array.isArray(CS.MONSTER_VARIANTS) && CS.MONSTER_VARIANTS.some(v => v && v.name === n)) return 'Monster';
  return n;
}
function quality(player) {
  const q = Number(player && player.classQuality);
  return q >= 1 && q <= 100 ? q : 100;
}
function scaled(max, q) {
  if (typeof max !== 'number' || isNaN(max)) return 0;
  return Math.max(0, Math.floor(max * q / 100));
}

/** The quality-scaled bonus block this player's class grants. */
function classBonuses(player) {
  const CS = _cs();
  const base = baseClassName(player);
  const data = CS && CS.CLASS_DATA && base ? CS.CLASS_DATA[base] : null;
  if (!data || !data.maxBonuses) return null;
  const q = quality(player);
  const out = {};
  for (const [stat, max] of Object.entries(data.maxBonuses)) {
    const key = stat === 'hp' ? 'maxHp' : stat;
    if (!BONUS_STATS.includes(key)) continue;
    out[key] = (out[key] || 0) + scaled(max, q);
  }
  return out;
}

// baseStats mirror: StatAllocationSystem.applyAllocationsToStats() (run by
// /stats, /upgrade, /equip) recomputes stats.X = baseStats.X + allocations —
// a bonus that lives only in `stats` is wiped the next time it runs. So every
// class bonus is applied to BOTH.
const _BASE_KEY = { maxHp: 'hp' };
function _baseAdj(player, stat, v) {
  if (!player.baseStats || typeof player.baseStats !== 'object') return;
  const k = _BASE_KEY[stat] || stat;
  player.baseStats[k] = Math.max(0, (player.baseStats[k] || 0) + v);
}
function _reapplyAlloc(player) {
  try { if (player.statAllocations) require('./StatAllocationSystem').applyAllocationsToStats(player); } catch (e) {}
}
function _remove(player, applied) {
  if (!player.stats || !applied) return;
  for (const [stat, v] of Object.entries(applied)) {
    if (!v) continue;
    _baseAdj(player, stat, -v);
    if (stat === 'maxHp') {
      player.stats.maxHp = Math.max(50, (player.stats.maxHp || 100) - v);
      player.stats.hp = Math.min(player.stats.hp || 0, player.stats.maxHp);
    } else if (stat === 'maxEnergy') {
      player.stats.maxEnergy = Math.max(50, (player.stats.maxEnergy || 100) - v);
      player.stats.energy = Math.min(player.stats.energy || 0, player.stats.maxEnergy);
    } else {
      player.stats[stat] = Math.max(0, (player.stats[stat] || 0) - v);
    }
  }
}
function _add(player, bonuses) {
  if (!player.stats || !bonuses) return;
  for (const [stat, v] of Object.entries(bonuses)) {
    if (!v) continue;
    _baseAdj(player, stat, v);
    if (stat === 'maxHp') {
      player.stats.maxHp = (player.stats.maxHp || 100) + v;
      player.stats.hp = Math.min((player.stats.hp || 0) + v, player.stats.maxHp);
    } else if (stat === 'maxEnergy') {
      player.stats.maxEnergy = (player.stats.maxEnergy || 100) + v;
      player.stats.energy = Math.min((player.stats.energy || 0) + v, player.stats.maxEnergy);
    } else {
      player.stats[stat] = (player.stats[stat] || 0) + v;
    }
  }
}

/**
 * Make sure this player's stats carry EXACTLY their class's quality-scaled
 * bonuses. Idempotent: the applied block is stored in player.classBonusApplied
 * = { cls, quality, bonuses }. Returns { changed, bonuses }.
 */
function ensureClassBonuses(player) {
  if (!player || !player.stats) return { changed: false, bonuses: null };
  const cls = baseClassName(player);
  const rec = player.classBonusApplied || null;
  if (!cls) {
    if (rec && rec.bonuses) { _remove(player, rec.bonuses); delete player.classBonusApplied; return { changed: true, bonuses: null }; }
    return { changed: false, bonuses: null };
  }
  const want = classBonuses(player);
  const q = quality(player);
  // Push #74b: a `legacy` record was written by the first #74 build WITHOUT
  // adding anything to stats (it assumed awakening had). Convert it: nothing
  // to strip, apply now, record as real.
  if (rec && rec.legacy) {
    _add(player, want);
    player.classBonusApplied = { cls, quality: q, bonuses: want, at: Date.now(), base: true };
    player.classPowerV74 = true;
    return { changed: true, bonuses: want };
  }
  if (rec && rec.cls === cls && rec.quality === q && JSON.stringify(rec.bonuses || {}) === JSON.stringify(want || {})) {
    if (!rec.base) {
      // Push #74c: record from a build that only touched `stats`; mirror into
      // baseStats now and let the allocation recompute restore any stat that
      // applyAllocationsToStats had already overwritten.
      for (const [stat, v] of Object.entries(want)) if (v) _baseAdj(player, stat, v);
      rec.base = true;
      _reapplyAlloc(player);
      return { changed: true, bonuses: want };
    }
    return { changed: false, bonuses: want };
  }
  // Push #74b: legacy hunters (awakened before this module) are NOT skipped
  // any more — the old "already applied at awakening" assumption was wrong for
  // most of them (recon / migration / direct class set paths never applied a
  // thing), and the ones it was right for get a one-time modest top-up rather
  // than staying permanently short. Applied exactly once; idempotent after.
  if (rec && rec.bonuses) _remove(player, rec.bonuses);
  _add(player, want);
  player.classBonusApplied = { cls, quality: q, bonuses: want, at: Date.now(), base: true };
  player.classPowerV74 = true;
  return { changed: true, bonuses: want };
}

// ── Passive skill multipliers ────────────────────────────────────────────────
const _PCT = '([+-]?\\d+(?:\\.\\d+)?)\\s*%';
function _parsePassive(text, out, hpPct, q) {
  const t = String(text || '').toLowerCase();
  if (!t) return;
  const qs = (v) => v * q / 100;
  const cond = (re) => {
    const m = t.match(re);
    if (!m) return null;
    return parseFloat(m[1]);
  };
  const below = (n) => hpPct < n;
  // Conditional "+X% ATK when/while hp < N" or "below half HP"
  // Reversed form: "Below 30% HP: ATK +60%"
  const condAtkR = t.match(new RegExp(`(?:below|under)\\s+(\\d+)%\\s*hp[^.\\n]*?atk\\s*\\+${_PCT}`));
  const condAtk = t.match(new RegExp(`\\+${_PCT}\\s*atk[^.\\n]*?(?:hp\\s*<\\s*(\\d+)|below\\s+(\\d+)%|below\\s+half)`));
  if (condAtkR) {
    if (below(+condAtkR[1])) out.atk += qs(parseFloat(condAtkR[2]));
  } else if (condAtk) {
    const thr = condAtk[2] ? +condAtk[2] : condAtk[3] ? +condAtk[3] : 50;
    if (below(thr)) out.atk += qs(parseFloat(condAtk[1]));
  } else {
    const a = cond(new RegExp(`\\+${_PCT}\\s*atk`)); if (a) out.atk += qs(a);
  }
  const condDef = t.match(new RegExp(`\\+${_PCT}\\s*def[^.\\n]*?(?:hp\\s*<\\s*(\\d+)|below\\s+(\\d+)%|below\\s+half)`));
  if (condDef) {
    const thr = condDef[2] ? +condDef[2] : condDef[3] ? +condDef[3] : 50;
    if (below(thr)) out.def += qs(parseFloat(condDef[1]));
  } else {
    const d = cond(new RegExp(`\\+${_PCT}\\s*def`)); if (d) out.def += qs(d);
  }
  const s = cond(new RegExp(`\\+${_PCT}\\s*(?:spd|speed)`)); if (s) out.speed += qs(s);
  const c = cond(new RegExp(`(?:crit(?:ical)?\\s*chance\\s*\\+|\\+)${_PCT}\\s*crit`)); if (c) out.crit += qs(c);
  const c2 = cond(new RegExp(`crit(?:ical)?\\s*chance\\s*\\+${_PCT}`)); if (c2 && !c) out.crit += qs(c2);
  const dg = cond(new RegExp(`\\+${_PCT}\\s*(?:dodge|evasion)`)); if (dg) out.dodge += qs(dg);
  const dg2 = cond(new RegExp(`(?:dodge|evasion)\\s*(?:chance)?\\s*\\+${_PCT}`)); if (dg2 && !dg) out.dodge += qs(dg2);
  const rd = cond(new RegExp(`reduces? (?:all )?damage taken by ${_PCT}`)); if (rd) out.dmgTaken -= qs(rd);
  const rd2 = cond(new RegExp(`-${_PCT}\\s*damage taken`)); if (rd2) out.dmgTaken -= qs(rd2);
  const sd = cond(new RegExp(`\\+${_PCT}\\s*skill damage`)); if (sd) out.skillDmg += qs(sd);
  const ls = cond(new RegExp(`(?:lifesteal|heals? for)\\s*\\+?${_PCT}`)); if (ls) out.lifesteal += qs(ls);
}

/**
 * Percent multipliers from every unlocked passive skill of this player,
 * scaled by class quality. All values are PERCENT (e.g. atk: 15 → ×1.15).
 */
function passiveMultipliers(player) {
  const out = { atk: 0, def: 0, speed: 0, crit: 0, dodge: 0, dmgTaken: 0, skillDmg: 0, lifesteal: 0 };
  if (!player) return out;
  const q = quality(player);
  const hpPct = player.stats && player.stats.maxHp ? ((player.stats.hp || 0) / player.stats.maxHp) * 100 : 100;
  const seen = new Set();
  const consider = (sk) => {
    if (!sk || !sk.name) return;
    const k = String(sk.name).toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    _parsePassive(`${sk.effect || ''}\n${sk.desc || ''}\n${sk.description || ''}`, out, hpPct, q);
  };
  const SC = _sc();
  if (SC) {
    try { for (const p of SC.passiveSkills(player)) if (SC.isUnlockedFor(player, p)) consider(p); } catch (e) {}
  }
  for (const p of (player.skills && player.skills.passive) || []) consider(p);
  // Class-file passives (e.g. Archer "Eagle Eye: Crit chance +25%") — always on.
  // Read from the class file itself (quality-scaled here), so they count even
  // for hunters whose classSkills were never written.
  try {
    const CS = _cs();
    const base = baseClassName(player);
    const data = CS && CS.CLASS_DATA && base ? CS.CLASS_DATA[base] : null;
    for (const sk of (data && data.skills) || []) {
      if (String(sk.type || '').toLowerCase() !== 'passive') continue;
      const pot = scaled(Number(sk.maxPotency) || 0, 100); // desc gets the MAX; q scales below
      consider({ name: sk.name, desc: String(sk.desc || '').replace(/{p\/(\d+)}/g, (_, d) => String(Math.floor(pot / parseInt(d, 10)))).replace(/{p}/g, String(pot)) });
    }
  } catch (e) {}
  for (const p of player.classSkills || []) if (String(p.type || '').toLowerCase() === 'passive') consider(p);
  // Clamp to sane bounds.
  out.atk = Math.min(150, out.atk); out.def = Math.min(150, out.def); out.speed = Math.min(100, out.speed);
  out.crit = Math.min(60, out.crit); out.dodge = Math.min(40, out.dodge); out.dmgTaken = Math.max(-60, out.dmgTaken);
  out.skillDmg = Math.min(100, out.skillDmg); out.lifesteal = Math.min(50, out.lifesteal);
  return out;
}

/** Strip and re-apply class bonuses + rebuild the skill ladder. */
function recalibrate(player) {
  if (!player) return { ok: false };
  const before = JSON.stringify(player.stats || {});
  if (player.classBonusApplied && player.classBonusApplied.bonuses && !player.classBonusApplied.legacy) _remove(player, player.classBonusApplied.bonuses);
  delete player.classBonusApplied;
  player.classPowerV74 = true;
  const res = ensureClassBonuses(player);
  let skills = { changed: false };
  const SC = _sc();
  if (SC && className(player)) { try { skills = SC.syncPlayerSkills(player); } catch (e) {} }
  // Refresh quality-scaled classSkills text from the class file.
  try {
    const CS = _cs();
    const base = baseClassName(player);
    const data = CS && CS.CLASS_DATA && base ? CS.CLASS_DATA[base] : null;
    if (data && Array.isArray(data.skills)) {
      const q = quality(player);
      player.classSkills = data.skills.map(skill => ({
        name: skill.name, type: skill.type,
        potency: scaled(skill.maxPotency, q),
        desc: String(skill.desc || '').replace(/{p}/g, String(scaled(skill.maxPotency, q)))
          .replace(/{p\/(\d+)}/g, (_, d) => String(Math.floor(scaled(skill.maxPotency, q) / parseInt(d, 10)))),
        maxPotency: skill.maxPotency, quality: q,
      }));
    }
  } catch (e) {}
  return { ok: true, statsChanged: before !== JSON.stringify(player.stats || {}), bonuses: res.bonuses, skills };
}

/** Human line for /class: "+45 ATK · +60 HP · …" */
function formatBonuses(b) {
  if (!b) return 'none';
  const label = { maxHp: 'HP', atk: 'ATK', def: 'DEF', speed: 'SPD', maxEnergy: 'Energy', critChance: 'Crit%', lifesteal: 'Lifesteal%', magicPower: 'Magic' };
  const parts = Object.entries(b).filter(([, v]) => v).map(([k, v]) => `+${v} ${label[k] || k}`);
  return parts.length ? parts.join(' · ') : 'none';
}

module.exports = { ensureClassBonuses, classBonuses, passiveMultipliers, recalibrate, formatBonuses, className, baseClassName, quality, scaled };
