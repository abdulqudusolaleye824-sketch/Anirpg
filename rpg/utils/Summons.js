// ═══════════════════════════════════════════════════════════════
// Summons — Push #103b (Necromancer · Summoner · Shaman totems · Phantom)
//   • Summons are REAL combatants on the owner: player.summons[] with ATK/HP/
//     turns. They strike the owner's target after every owner action, fade
//     when their turns run out, die when hit by AoE, and VANISH when the owner
//     falls (linked fate).
//   • Necromancer summons consume REAL corpses (Corpses.js ledger) and pass a
//     Magic Power check against the corpse's difficulty — failure ruins the
//     corpse and the energy is still spent.
//   • Costs are the spec's: raising the dead drinks deep from the energy pool.
// ═══════════════════════════════════════════════════════════════
'use strict';
const Corpses = require('./Corpses');

const BASE_CAP = 3;
const CAP_BY_CLASS = { Summoner: 5, Necromancer: 4 };

// Per-skill summon contracts (lower-case name). count/turns/statMult; corpses = how many corpses it eats.
const SPEC = {
  // Necromancer — corpse-fed
  'reanimate':            { kind: 'Skeletal Warrior', emoji: '💀', corpses: 1, turns: 4, statMult: 0.75, cost: 60 },
  'spectral army':        { kind: 'Phantom',          emoji: '👻', corpses: 2, turns: 3, statMult: 0.6,  cost: 90 },
  'army of the dead':     { kind: 'Skeletal Knight',  emoji: '⚔️', corpses: 3, turns: 3, statMult: 1.1,  cost: 130, elite: true },
  'life tap':             { sacrifice: true, cost: 25 },
  // Summoner — energy-fed
  'summon shade':         { kind: 'Shade',            emoji: '🌑', count: 1, turns: 4, pct: 1.6,  cost: 35 },
  'summon golem':         { kind: 'Stone Golem',      emoji: '🪨', count: 1, turns: 5, pct: 0.8,  cost: 45, tank: true },
  'summon archer spirit': { kind: 'Archer Spirit',    emoji: '🏹', count: 1, turns: 4, pct: 1.4,  cost: 45 },
  'summon elemental':     { kind: 'Elemental Spirit', emoji: '🔥', count: 1, turns: 4, pct: 1.3,  cost: 50, status: ['burn', 'freeze'] },
  'mass summon':          { kind: 'Minor Spirit',     emoji: '✨', count: 2, turns: 3, pct: 0.9,  cost: 55 },
  'summon arch-spirit':   { kind: 'Celestial Guardian', emoji: '🌟', count: 1, turns: 3, pct: 2.4, cost: 110, elite: true },
  'spirit explosion':     { detonate: 1, cost: 40 },
  'sovereign summoner cataclysm': { detonate: 'all', cost: 90 },
  // Shaman — totems (stationary summons that pulse)
  'healing totem':        { kind: 'Healing Totem',    emoji: '🪵', count: 1, turns: 3, pct: 0,    cost: 40, totem: 'heal', value: 8 },
  'lightning totem':      { kind: 'Lightning Totem',  emoji: '⚡', count: 1, turns: 3, pct: 1.0,  cost: 45, totem: 'strike', status: ['stun'] },
  'tremor totem':         { kind: 'Tremor Totem',     emoji: '🪨', count: 1, turns: 3, pct: 0,    cost: 40, totem: 'slow', value: 20 },
  'great totem tempest':  { kind: 'Elemental Totem',  emoji: '🌪️', count: 3, turns: 2, pct: 0.9,  cost: 95, totem: 'tempest' },
  // Phantom — possession
  'corpse possession':    { possess: true, cost: 70 },
  'elite boss possession':{ possess: 'boss', cost: 140 },
};

function _norm(n) { return String(n || '').toLowerCase().trim(); }
function specFor(entry) { if (!entry) return null; const s = SPEC[_norm(entry.name)]; if (s) return { ...s }; if (entry.summon) { const m = String(entry.effect || entry.description || '').match(/summons?\s+(\d+)/i); return { kind: entry.name, emoji: '✨', count: m ? Math.min(4, parseInt(m[1], 10)) : 1, turns: 3, pct: 1.0, cost: entry.energyCost || 40 }; } return null; }
function isSummonSkill(entry) { const s = specFor(entry); return !!(s && (s.kind || s.possess || s.sacrifice || s.detonate)); }
function costFor(entry) { const s = specFor(entry); return s && s.cost ? Math.max(Number(entry.energyCost) || 0, s.cost) : (Number(entry && entry.energyCost) || 0); }

function list(owner) { if (!owner) return []; if (!Array.isArray(owner.summons)) owner.summons = []; owner.summons = owner.summons.filter(s => s && s.hp > 0 && s.turns > 0); return owner.summons; }
function cap(owner) { const base = CAP_BY_CLASS[String(owner && (owner.classBase || owner.class) || '')] || BASE_CAP; let extra = 0; if (_hasPassive(owner, /master of the horde/i)) extra += 2; return base + extra; }
function _hasPassive(owner, re) { return ((owner && owner.skills && owner.skills.passive) || []).some(s => s && re.test(String(s.name || ''))); }
function _mp(owner) { try { return Number(require('./GearSystem').effectiveMagicPower(owner)) || 0; } catch (e) { return Number(owner && owner.stats && owner.stats.magicPower) || 0; } }
function _lvl(owner, entry) { try { const r = require('./SkillCatalog').resolveSkill(owner, entry.name, { allowLibrary: true }); return Number((r.skill || {}).level) || 1; } catch (e) { return 1; } }

// Summoning check (Necromancer): MP vs corpse difficulty. Returns { ok, chance, need }.
function summonCheck(owner, corpse) {
  const mp = _mp(owner); const need = Corpses.difficulty(corpse) * 4;
  const chance = Math.max(15, Math.min(95, Math.round(15 + 75 * (mp / Math.max(1, need)))));
  return { ok: Math.random() * 100 < chance, chance, need, mp };
}

function _make(owner, spec, opts = {}) {
  const lvl = opts.level || 1; const lordBonus = _hasPassive(owner, /lord of the undead/i) ? 1.25 : 1;
  const bond = _hasPassive(owner, /astral bond/i) ? 0.1 : 0;
  const scale = 1 + 0.12 * (lvl - 1);
  let atk, maxHp, def = 0, level;
  if (opts.corpse) {
    const c = opts.corpse; level = c.level;
    atk = Math.floor(c.atk * (spec.statMult || 0.7) * lordBonus * scale);
    maxHp = Math.floor(c.maxHp * 0.5 * (spec.statMult || 0.7) * lordBonus * scale); def = Math.floor((c.def || 0) * 0.5);
  } else {
    const power = Math.max(_mp(owner), Math.floor((owner.stats.atk || 10) * 0.6)); level = owner.level || 1;
    atk = Math.floor(power * (spec.pct || 1) * 0.6 * scale + (owner.stats.atk || 0) * bond);
    maxHp = Math.floor((owner.stats.maxHp || 100) * (spec.tank ? 0.8 : 0.35) * scale + (owner.stats.maxHp || 0) * bond);
  }
  if (spec.elite) { atk = Math.floor(atk * 1.3); maxHp = Math.floor(maxHp * 1.5); }
  return { id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, name: opts.name || spec.kind, kind: spec.kind, emoji: spec.emoji || '✨', atk: Math.max(1, atk), def, hp: Math.max(1, maxHp), maxHp: Math.max(1, maxHp), level, turns: spec.turns || 3, totem: spec.totem || null, value: spec.value || 0, status: spec.status || null, tank: !!spec.tank, elite: !!spec.elite, corpseOf: opts.corpse ? opts.corpse.name : null, at: Date.now() };
}

// ── Cast ───────────────────────────────────────────────────────────────────
// ctx = gate (raid) or player (solo dungeon). Returns { ok, error, messages[], lines[], energyCost, summoned[] }.
function cast(owner, entry, ctx, opts = {}) {
  const spec = specFor(entry); if (!spec) return { ok: false, error: `*${entry.name}* is not a summoning skill.` };
  const SC = require('./SkillCatalog');
  const cd = SC.onCooldown(owner, entry); if (!cd.ready) return { ok: false, error: `*${entry.name}* is on cooldown! (${Math.ceil(cd.msLeft / 1000)}s)` };
  let cost = costFor(entry);
  if (_hasPassive(owner, /horde synergy/i)) cost = Math.floor(cost * Math.max(0.5, 1 - 0.05 * list(owner).length));
  if (owner._freeSummons > 0) cost = 0;
  if ((owner.stats.energy || 0) < cost) return { ok: false, error: `Not enough energy for *${entry.name}*! Need *${cost}* — raising the dead drinks deep from your pool (you have ${Math.floor(owner.stats.energy || 0)}).` };
  const lvl = _lvl(owner, entry);
  const messages = []; const lines = []; const summoned = [];
  const spend = () => { owner.stats.energy = Math.max(0, (owner.stats.energy || 0) - cost); if (owner._freeSummons > 0) owner._freeSummons--; try { SC.setCooldown(owner, entry); } catch (e) {} };

  if (spec.sacrifice) {
    const mine = list(owner); if (!mine.length) return { ok: false, error: `*${entry.name}* needs one of your own minions to drain — you command none.` };
    const s = mine.sort((a, b) => b.hp - a.hp)[0]; spend();
    const party = (opts.party && opts.party.length ? opts.party : [owner]);
    const pct = Math.min(40, 10 + Math.floor(s.hp / Math.max(1, owner.stats.maxHp || 100) * 60));
    for (const u of party) { if (!u || !u.stats) continue; const mx = u.stats.maxEnergy || 100; const got = Math.floor(mx * pct / 100); u.stats.energy = Math.min(mx, (u.stats.energy || 0) + got); lines.push(`⚡ *${u.name}* +${got} energy`); }
    owner.summons = mine.filter(x => x !== s);
    messages.push(`🩸 *LIFE TAP* — ${owner.name} seizes *${s.emoji} ${s.name}* by the skull. Its stolen life boils away into raw energy…`, [`💥 The minion collapses to dust.`, ...lines].join('\n'));
    return { ok: true, skill: entry, messages, lines, energyCost: cost, summoned: [] };
  }
  if (spec.detonate) {
    const mine = list(owner); if (!mine.length) return { ok: false, error: `*${entry.name}* needs an active summon to detonate — you command none.` };
    const picks = spec.detonate === 'all' ? mine.slice() : mine.sort((a, b) => a.hp - b.hp).slice(0, 1);
    spend(); let dmg = 0; for (const s of picks) dmg += Math.floor(s.atk * 2.2 + s.hp * 0.5);
    owner.summons = mine.filter(x => !picks.includes(x));
    const tgt = opts.target; if (tgt) { const tst = tgt.stats && Number.isFinite(tgt.stats.hp) ? tgt.stats : tgt; tst.hp = Math.max(0, (tst.hp || 0) - dmg); }
    messages.push(`✨ *${entry.name.toUpperCase()}* — ${owner.name} raises a hand. ${picks.length === 1 ? `*${picks[0].emoji} ${picks[0].name}*` : `*${picks.length} summons*`} glow white-hot…`, `💥 *DETONATION!* ${dmg.toLocaleString()} damage tears through ${tgt && tgt.name ? `*${tgt.name}*` : 'the enemy line'}.`);
    return { ok: true, skill: entry, messages, lines: [`💥 ${dmg.toLocaleString()} dmg`], energyCost: cost, damage: dmg, summoned: [] };
  }
  if (spec.possess) return _possess(owner, entry, spec, ctx, cost, spend, opts);

  // Regular / corpse summons
  const room = cap(owner) - list(owner).length;
  if (room <= 0) return { ok: false, error: `You already command *${list(owner).length}/${cap(owner)}* summons — dismiss one (they fade when their turns end).` };
  if (spec.corpses) {
    const avail = Corpses.available(ctx);
    if (avail.length < spec.corpses) return { ok: false, error: `*${entry.name}* needs *${spec.corpses} corpse${spec.corpses === 1 ? '' : 's'}* on this battlefield — there ${avail.length === 1 ? 'is only 1' : `are ${avail.length}`}. Only things that actually died in THIS fight can be raised.` };
    spend();
    const taken = Corpses.take(ctx, spec.corpses, { by: owner.name, purpose: entry.name });
    messages.push(`💀 *${entry.name.toUpperCase()}* — ${owner.name} kneels among the dead. Grave-light pours from their palms into ${taken.length === 1 ? `the corpse of *${taken[0].name}*` : `*${taken.length} corpses*`}…`);
    const partLines = [];
    for (const c of taken) {
      const chk = summonCheck(owner, c);
      if (!chk.ok) { partLines.push(`🕯️ *${c.name}* (Lv.${c.level}) resists the call — the body crumbles to ash. (${chk.chance}% · needs ~${chk.need} MP, you have ${chk.mp})`); continue; }
      const s = _make(owner, spec, { corpse: c, level: lvl, name: `${spec.kind} (${c.name})` });
      if (list(owner).length >= cap(owner)) { partLines.push(`⚠️ No room for another minion — *${c.name}* stays dead.`); continue; }
      owner.summons.push(s); summoned.push(s);
      partLines.push(`${s.emoji} *${c.name}* rises as a *${spec.kind}* — ATK ${s.atk.toLocaleString()} · HP ${s.maxHp.toLocaleString()} · ${s.turns} turns (${chk.chance}% check passed)`);
    }
    messages.push(partLines.join('\n'));
    if (summoned.length) messages.push(`⚰️ *${summoned.length} of the dead now march for ${owner.name}.* They strike with every move their master makes — and fall with them.`);
    else messages.push(`🌫️ *Nothing rises.* The energy is spent; the dead keep their silence.`);
    return { ok: true, skill: entry, messages, lines: partLines, energyCost: cost, summoned, corpsesUsed: taken.length };
  }
  spend();
  const n = Math.min(room, spec.count || 1);
  for (let i = 0; i < n; i++) { const s = _make(owner, spec, { level: lvl, name: n > 1 ? `${spec.kind} ${i + 1}` : spec.kind }); owner.summons.push(s); summoned.push(s); }
  const isTotem = !!spec.totem;
  messages.push(isTotem ? `🪵 *${entry.name.toUpperCase()}* — ${owner.name} drives the totem into the earth. Spirit-smoke curls from its carvings…` : `✨ *${entry.name.toUpperCase()}* — ${owner.name} tears a seam in the air. Something answers from the other side…`);
  messages.push(summoned.map(s => `${s.emoji} *${s.name}* — ${s.totem ? (s.totem === 'heal' ? `heals the party ${s.value}% each turn` : s.totem === 'slow' ? `enemy SPD −${s.value}%` : `pulses for ${s.atk.toLocaleString()} each turn`) : `ATK ${s.atk.toLocaleString()} · HP ${s.maxHp.toLocaleString()}`} · ${s.turns} turns`).join('\n'));
  messages.push(`🔗 *Linked fate:* ${summoned.length === 1 ? 'it fights' : 'they fight'} beside ${owner.name} every move — and vanish the moment ${owner.name} falls. (${list(owner).length}/${cap(owner)} summons)`);
  return { ok: true, skill: entry, messages, lines: [`${summoned.length} summoned`], energyCost: cost, summoned };
}

// Phantom possession: adopt a corpse's class + stats. The puppet's HP becomes the Phantom's HP.
function _possess(owner, entry, spec, ctx, cost, spend, opts) {
  const avail = Corpses.available(ctx).filter(c => spec.possess === 'boss' ? c.kind === 'boss' : true);
  if (!avail.length) return { ok: false, error: spec.possess === 'boss' ? `*${entry.name}* needs a *boss corpse* on this battlefield.` : `*${entry.name}* needs a corpse on this battlefield — nothing has died here yet.` };
  if (owner.possession) return { ok: false, error: `You already wear *${owner.possession.name}* — the puppet must die (or the fight end) before you take another body.` };
  const c = opts.corpse || avail.sort((a, b) => Corpses.difficulty(b) - Corpses.difficulty(a))[0];
  spend(); c.used = true; c.usedBy = owner.name; c.usedFor = entry.name;
  let keep = c.kind === 'boss' ? 0.8 : c.kind === 'hunter' ? 0.75 : 0.65;
  if (_hasPassive(owner, /master of spirits/i)) keep += 0.1; if (owner._phantomKingDomain) keep = 1;
  const snap = { atk: owner.stats.atk, def: owner.stats.def, maxHp: owner.stats.maxHp, hp: owner.stats.hp, speed: owner.stats.speed };
  owner.possession = { name: c.name, kind: c.kind, class: c.class || null, level: c.level, keep, snap, at: Date.now() };
  owner.stats.atk = Math.max(snap.atk, Math.floor(c.atk * keep)); owner.stats.def = Math.max(snap.def, Math.floor((c.def || 0) * keep));
  owner.stats.maxHp = Math.max(snap.maxHp, Math.floor(c.maxHp * keep)); owner.stats.hp = Math.max(owner.stats.hp, Math.floor(c.maxHp * keep * 0.6));
  const messages = [
    `👁️ *${entry.name.toUpperCase()}* — ${owner.name} slips out of their own skin like smoke and pours into the corpse of *${c.name}*…`,
    `🫀 The body jerks upright. Dead eyes light up. *${owner.name}* now wears *${c.name}* (Lv.${c.level}${c.class ? ` ${c.class}` : ''}) — ATK ${owner.stats.atk.toLocaleString()} · DEF ${owner.stats.def.toLocaleString()} · HP ${owner.stats.hp.toLocaleString()}/${owner.stats.maxHp.toLocaleString()} (${Math.round(keep * 100)}% retained)${c.class ? `\n📜 The puppet's class skills answer to you: /skill <name> (${c.class} kit).` : ''}`,
    `⚠️ *If the puppet body dies, the Phantom dies with it.*`,
  ];
  return { ok: true, skill: entry, messages, lines: [messages[1]], energyCost: cost, summoned: [], possessed: c };
}
function endPossession(owner, reason = 'ends') { const p = owner && owner.possession; if (!p) return null; const s = p.snap; owner.stats.atk = s.atk; owner.stats.def = s.def; owner.stats.maxHp = s.maxHp; owner.stats.hp = Math.min(owner.stats.hp, s.maxHp); owner.stats.speed = s.speed; delete owner.possession; return `👁️ The possession of *${p.name}* ${reason} — ${owner.name} returns to their own form.`; }

// ── Combat ─────────────────────────────────────────────────────────────────
// After the owner's action: every summon strikes the target; totems pulse. Returns { damage, lines }.
function strike(owner, target, opts = {}) {
  const out = { damage: 0, lines: [] };
  const mine = list(owner); if (!mine.length || !target) return out;
  const tst = target.stats && Number.isFinite(target.stats.hp) ? target.stats : target;
  const tmax = Math.max(1, Number(tst.maxHp || target.maxHp || tst.hp) || 1); const tdef = Number(tst.def || target.def) || 0;
  let mult = 1; if (_hasPassive(owner, /pack tactics/i)) mult += 0.3 * Math.min(3, mine.length) * 0.5; if (owner._spiritSurge > 0) mult += 0.5; if (owner._summonDouble > 0) mult *= 2;
  const hits = owner._summonTwice > 0 ? 2 : 1;
  for (const s of mine) {
    if (s.totem === 'heal') { for (const u of (opts.party && opts.party.length ? opts.party : [owner])) { if (!u || !u.stats || u.stats.hp <= 0) continue; let mx = u.stats.maxHp || 100; try { mx = require('./GearSystem').effectiveMaxHp(u); } catch (e) {} const got = Math.floor(mx * s.value / 100); u.stats.hp = Math.min(mx, (u.stats.hp || 0) + got); } out.lines.push(`${s.emoji} *${s.name}* pulses — the party mends ${s.value}%`); continue; }
    if (s.totem === 'slow') { target.tempBuffs = target.tempBuffs || {}; target.tempBuffs[`totem:speed`] = { stat: 'speed', amount: -s.value, duration: 3 }; out.lines.push(`${s.emoji} *${s.name}* shakes the ground — *${target.name}* SPD −${s.value}%`); continue; }
    if (tst.hp <= 0) break;
    for (let h = 0; h < hits; h++) {
      const d = Math.max(1, Math.min(Math.floor(tmax * 0.2), Math.floor(Math.max(1, s.atk * mult * (0.9 + Math.random() * 0.2) - tdef * 0.3))));
      if (Number.isFinite(tst.hp)) tst.hp = Math.max(0, tst.hp - d); out.damage += d;
      let st = '';
      if (s.status && s.status.length && Math.random() < 0.3) { const type = s.status[Math.floor(Math.random() * s.status.length)]; try { const SEM = require('./StatusEffectManager'); const r = SEM.applyEffect(target, type, 2, owner); if (r) st = ` · ${type.toUpperCase()}!`; } catch (e) {} }
      out.lines.push(`${s.emoji} *${s.name}* ${s.totem ? 'pulses' : _verb(s)} *${target.name}* — *${d.toLocaleString()}*${st}`);
    }
  }
  return out;
}
function _verb(s) { return /skeletal|knight/i.test(s.kind) ? 'cleaves' : /phantom|shade|spirit/i.test(s.kind) ? 'rakes' : /golem/i.test(s.kind) ? 'slams' : /archer/i.test(s.kind) ? 'shoots' : 'strikes'; }

// Called once per owner action (after strike): summons age; expired ones fade. Returns lines.
function tick(owner) {
  const lines = []; const mine = list(owner); if (!mine.length) return lines;
  for (const s of mine) s.turns--;
  if (owner._spiritSurge > 0) owner._spiritSurge--; if (owner._summonDouble > 0) owner._summonDouble--; if (owner._summonTwice > 0) owner._summonTwice--;
  const gone = mine.filter(s => s.turns <= 0); owner.summons = mine.filter(s => s.turns > 0);
  for (const s of gone) lines.push(`🌫️ *${s.name}* fades back into the dark.`);
  // Spirit Regeneration: 8% max energy per active summon each turn (capped)
  if (owner.summons.length && _hasPassive(owner, /spirit regeneration/i)) { const mx = owner.stats.maxEnergy || 100; const got = Math.floor(mx * Math.min(24, 8 * owner.summons.length) / 100); owner.stats.energy = Math.min(mx, (owner.stats.energy || 0) + got); if (got) lines.push(`⚡ Spirit Regeneration: +${got} energy`); }
  return lines;
}
// Linked Fate (Summoner passive) / Summon Golem (tank): summons soak part of a hit on the owner. Returns { dmg, lines }.
function soak(owner, dmg) {
  const mine = list(owner); if (!mine.length || !(dmg > 0)) return { dmg, lines: [] };
  let pct = 0; if (_hasPassive(owner, /linked fate/i)) pct += 0.3; if (mine.some(s => s.tank)) pct += 0.3; if (owner._summonWall > 0) pct = 0.8;
  if (!pct) return { dmg, lines: [] };
  const cut = Math.floor(dmg * Math.min(0.8, pct)); const s = mine.find(x => x.tank) || mine[0]; s.hp -= cut;
  const lines = [`${s.emoji} *${s.name}* takes ${cut.toLocaleString()} of the hit for ${owner.name}${s.hp <= 0 ? ' — and is destroyed!' : ''}`];
  if (s.hp <= 0) owner.summons = mine.filter(x => x !== s);
  return { dmg: dmg - cut, lines };
}
// AoE from the enemy ("hits all enemies and summons"): every summon takes dmg. Returns lines.
function aoe(owner, dmg, ctx = null) {
  const mine = list(owner); const lines = [];
  for (const s of mine) { s.hp -= dmg; if (s.hp <= 0) { lines.push(`💥 *${s.name}* is destroyed!`); if (ctx) Corpses.recordSummon(ctx, s, owner.name); } }
  owner.summons = mine.filter(s => s.hp > 0); return lines;
}
// Owner falls → everything vanishes (linked fate). Returns a line or null.
function onOwnerDown(owner) {
  const mine = list(owner); let line = null;
  if (mine.length) { line = `🔗 *Linked fate* — ${owner.name}'s ${mine.length} summon${mine.length === 1 ? '' : 's'} vanish${mine.length === 1 ? 'es' : ''} with ${mine.length === 1 ? 'its' : 'their'} master.`; owner.summons = []; }
  const p = endPossession(owner, 'breaks'); if (p) line = (line ? line + '\n' : '') + p;
  return line;
}
// Transcendent Lich Ascendancy: fatal blow → possess a minion, survive at 50% HP. Returns line or null.
function lichSave(owner) {
  if (!_hasPassive(owner, /lich ascendancy/i)) return null; const mine = list(owner); if (!mine.length) return null; if (owner._lichUsed) return null;
  const s = mine[0]; owner.summons = mine.filter(x => x !== s); owner._lichUsed = true;
  let mx = owner.stats.maxHp || 100; try { mx = require('./GearSystem').effectiveMaxHp(owner); } catch (e) {} owner.stats.hp = Math.floor(mx * 0.5);
  return `👑 *TRANSCENDENT LICH ASCENDANCY* — as the killing blow lands, ${owner.name}'s soul leaps into *${s.name}*. The minion crumbles; the Lich stands again at ${owner.stats.hp.toLocaleString()} HP.`;
}
function clear(owner) { if (!owner) return; owner.summons = []; delete owner._lichUsed; delete owner._spiritSurge; delete owner._summonDouble; delete owner._summonTwice; delete owner._summonWall; delete owner._freeSummons; endPossession(owner, 'ends'); }
function card(owner) { const mine = list(owner); if (!mine.length) return [`✨ No active summons (cap ${cap(owner)}).`]; return [`✨ *SUMMONS ${mine.length}/${cap(owner)}*`, ...mine.map(s => `  ${s.emoji} *${s.name}* — ATK ${s.atk.toLocaleString()} · HP ${s.hp.toLocaleString()}/${s.maxHp.toLocaleString()} · ${s.turns}t`)]; }

// Utility-buff skills that modify summons (applied from the normal buff path)
function applySummonBuff(owner, entry) {
  const n = _norm(entry && entry.name); const L = [];
  if (n === 'spirit surge') { owner._spiritSurge = 2; L.push(`✨ All summons deal +50% damage for 2 turns.`); }
  else if (n === 'horde command') { for (const s of list(owner)) s.atk = Math.floor(s.atk * 1.25); L.push(`✨ Summons ATK +25%.`); }
  else if (n === 'guardian ward') { for (const s of list(owner)) { s.hp += Math.floor(s.maxHp * 0.4); } L.push(`🛡️ Every summon gains a 40% HP ward.`); }
  else if (n === 'domain of the astral army') { owner._freeSummons = 3; owner._summonDouble = 2; L.push(`🌌 Next 3 summons cost 0 energy · summon damage ×2 for 2 turns.`); }
  else if (n === 'domain of the beast king') { for (const s of list(owner)) { s.atk = Math.max(s.atk, owner.stats.atk || 0); s.maxHp = Math.max(s.maxHp, owner.stats.maxHp || 0); s.hp = s.maxHp; } owner._summonTwice = 2; L.push(`👑 Summons copy ${owner.name}'s stats and strike twice per turn (2 turns).`); }
  else if (n === 'absolute summon sanctuary') { owner._summonWall = 2; L.push(`🛡️ Summons wall off 80% of incoming damage for 2 turns.`); }
  else if (n === 'domain of the phantom king') { owner._phantomKingDomain = true; L.push(`👁️ Possession stat penalty removed.`); }
  return L;
}

// Corpse-burst damage skills (Corpse Explosion = 1 corpse · Necrotic Cataclysm = ALL corpses).
const BURST = { 'corpse explosion': 1, 'sovereign necrotic cataclysm': 'all', 'giga necrotic cataclysm': 'all' };
function isBurstSkill(entry) { return !!(entry && BURST[_norm(entry.name)]); }
// Call BEFORE damage: validates + consumes corpses. Returns { ok, error, used, bonusMult, lines }.
function corpseBurst(owner, entry, ctx) {
  const need = BURST[_norm(entry && entry.name)]; if (!need) return { ok: true, used: 0, bonusMult: 1, lines: [] };
  const avail = Corpses.available(ctx);
  if (!avail.length) return { ok: false, error: `*${entry.name}* needs a corpse on this battlefield — nothing has died here yet. Kill something first.` };
  const taken = need === 'all' ? Corpses.takeAll(ctx, { by: owner.name, purpose: entry.name }) : Corpses.take(ctx, 1, { by: owner.name, purpose: entry.name });
  const bonusMult = 1 + 0.4 * (taken.length - 1) + taken.reduce((a, c) => a + (c.kind === 'boss' ? 0.5 : 0), 0);
  const lines = [`🪦 ${taken.length === 1 ? `The corpse of *${taken[0].name}* swells with grave-fire…` : `*${taken.length} corpses* swell with grave-fire…`}`, `💥 ${taken.length === 1 ? 'It detonates' : 'They detonate in a chain'} — ${Math.round(bonusMult * 100)}% power${taken.length > 1 ? ` (+40% per extra corpse)` : ''}.`];
  return { ok: true, used: taken.length, bonusMult, lines, taken };
}

module.exports = { BURST, isBurstSkill, corpseBurst, SPEC, specFor, isSummonSkill, costFor, list, cap, cast, strike, tick, soak, aoe, onOwnerDown, lichSave, clear, card, applySummonBuff, summonCheck, endPossession };
