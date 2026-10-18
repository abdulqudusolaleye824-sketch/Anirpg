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

// Push #96h-j: BLINDING skills — one per beast family. Handed to beasts at spawn
// (gate + dungeon) so blind is a real threat; the hunter's accuracy is halved while it lasts.
const FAMILY_BLIND_SKILL = {
  insect:    { name: 'Spore Cloud',  effect: 'blind', chance: 55, desc: 'A choking cloud of spores — the hunter cannot see. Blinds for 2 turns.' },
  slime:     { name: 'Acid Mist',    effect: 'blind', chance: 55, desc: 'Caustic mist stings the eyes. Blinds for 2 turns.' },
  beast:     { name: 'Dust Kick',    effect: 'blind', chance: 50, desc: 'Hind legs hurl dirt into the hunter\'s face. Blinds for 2 turns.' },
  goblinoid: { name: 'Sand Throw',   effect: 'blind', chance: 55, desc: 'A fistful of sand, straight to the eyes. Blinds for 2 turns.' },
  undead:    { name: 'Grave Mist',   effect: 'blind', chance: 50, desc: 'Cold grave-fog swallows all light. Blinds for 2 turns.' },
  reptile:   { name: 'Mud Spray',    effect: 'blind', chance: 50, desc: 'A tail-whip of marsh mud across the eyes. Blinds for 2 turns.' },
  construct: { name: 'Stone Dust',   effect: 'blind', chance: 45, desc: 'Grinding plates shed a blinding cloud of grit. Blinds for 2 turns.' },
  demon:     { name: 'Hellsmoke',    effect: 'blind', chance: 55, desc: 'Black sulphur smoke pours out. Blinds for 2 turns.' },
  elf:       { name: 'Flash Rune',   effect: 'blind', chance: 55, desc: 'A rune detonates in white light. Blinds for 2 turns.' },
  wild:      { name: 'Dirt Flick',   effect: 'blind', chance: 45, desc: 'Dirt and leaves flung at the eyes. Blinds for 2 turns.' },
};
// Push #103b: TRICK skills — every beast carries ONE of stealth / summoning / necromancy, picked by
// family. Free support moves (no damage, no turn) that the beast reaches for often (see pickMoves).
const FAMILY_TRICK_SKILL = {
  insect:    { name: 'Brood Call',      trick: 'summon',  desc: 'A chittering call — a brood of lesser insects pours in to harry the hunters. ATK +25% for 3 turns, bleeding bites.' },
  slime:     { name: 'Spawn Division',  trick: 'summon',  desc: 'The slime splits off hungry spawn that cling to the hunters. ATK +25% for 3 turns, acid clings.' },
  beast:     { name: 'Shadow Stalk',    trick: 'stealth', desc: 'The beast melts into cover — the hunters lose sight of it. SPEED +50% and DEF +30% for 2 turns; blinds.' },
  goblinoid: { name: 'Smoke Vanish',    trick: 'stealth', desc: 'A smoke bomb, then nothing — it strikes from the dark. SPEED +50% and DEF +30% for 2 turns; blinds.' },
  undead:    { name: 'Raise the Fallen',trick: 'necro',   desc: 'Grave-light stirs the fallen — corpses rise to feed it. Heals 20% max HP, ATK +15% for 3 turns, curses.' },
  reptile:   { name: 'Mire Ambush',     trick: 'stealth', desc: 'It sinks beneath the mire and waits. SPEED +50% and DEF +30% for 2 turns; blinds.' },
  construct: { name: 'Shard Sentinels', trick: 'summon',  desc: 'Loose plates reform into stone sentinels at its side. ATK +25% for 3 turns, crushing blows.' },
  demon:     { name: 'Soul Harvest',    trick: 'necro',   desc: 'It drinks the lingering souls of the slain. Heals 20% max HP, ATK +15% for 3 turns, curses.' },
  elf:       { name: 'Glamour Veil',    trick: 'stealth', desc: 'An illusion folds over it — the eye slides off. SPEED +50% and DEF +30% for 2 turns; blinds.' },
  wild:      { name: 'Pack Howl',       trick: 'summon',  desc: 'A howl answered — the pack closes in. ATK +25% for 3 turns, bleeding bites.' },
};
function trickSkillFor(monster) { let f = 'wild'; try { f = require('./MonsterTypes').familyOf(monster); } catch (e) {} return { ...(FAMILY_TRICK_SKILL[f] || FAMILY_TRICK_SKILL.wild), effect: null, chance: 0 }; }
function trickOf(ability) { const name = String(typeof ability === 'string' ? ability : (ability && ability.name) || '').replace(/^[^\w]+/, '').trim(); return Object.values(FAMILY_TRICK_SKILL).find(t => t.name === name) || null; }
function trickStep(monster, victim, trick) {
  const lines = []; const mStats = monster.stats || monster; const em = monster.emoji || '👹';
  if (!monster.tempBuffs) monster.tempBuffs = {};
  const buff = (stat, amount, turns) => { monster.tempBuffs[`mskill:${stat}`] = { stat, amount, duration: turns + 1, source: trick.name }; lines.push(`📈 ${em} ${monster.name}'s ${stat.toUpperCase()} rises +${amount}% (${turns}t)`); };
  if (trick.trick === 'stealth') { lines.push(`🌫️ ${em} *${monster.name}* vanishes from sight!`); buff('speed', 50, 2); buff('def', 30, 2); if (victim && !monster.noStatus && Math.random() < 0.6) { const l = applyStatus(victim, 'blind', 2, undefined, monster); if (l) lines.push(l); } }
  else if (trick.trick === 'summon') { const n = 2 + Math.floor(Math.random() * 3); lines.push(`🜏 ${em} *${monster.name}* calls *${n}* lesser kin to its side!`); buff('atk', 25, 3); if (victim && !monster.noStatus && Math.random() < 0.45) { const l = applyStatus(victim, /construct/i.test(trick.name) || trick.name === 'Shard Sentinels' ? 'stun' : 'bleed', trick.name === 'Shard Sentinels' ? 1 : 3, undefined, monster); if (l) lines.push(l); } }
  else { const max = mStats.maxHp || mStats.hp || 0; const b = mStats.hp || 0; mStats.hp = Math.min(max, b + Math.floor(max * 0.20)); lines.push(`💀 ${em} *${monster.name}* raises the fallen and FEEDS!${mStats.hp > b ? ` Recovers *${mStats.hp - b}* HP` : ''}`); buff('atk', 15, 3); if (victim && !monster.noStatus && Math.random() < 0.45) { const l = applyStatus(victim, 'curse', 3, undefined, monster); if (l) lines.push(l); } }
  return lines;
}
function blindSkillFor(monster) { let f = 'wild'; try { f = require('./MonsterTypes').familyOf(monster); } catch (e) {} return { ...(FAMILY_BLIND_SKILL[f] || FAMILY_BLIND_SKILL.wild) }; }

// Push #96h-j: the DESCRIPTION is a contract too — "+30% ATK", "DEF rises", "recovers 20% HP",
// "amplifies", "weakens", "numbs", "blinds" … every promise in the text becomes a real effect.
const STAT_WORD = { atk: 'atk', attack: 'atk', power: 'atk', def: 'def', defense: 'def', defence: 'def', armor: 'def', spd: 'speed', speed: 'speed', agility: 'speed' };
function parseDescription(text) {
  const out = { selfBuffs: [], selfHealPct: 0, healPct: 0, status: null, drainPct: 0, pierce: 0 };
  const t = String(text || ''); if (!t) return out;
  let m; const rx = /([+-]?)(\d+)%\s*(atk|attack|power|def|defen[cs]e|armou?r|spd|speed|agility)\b/gi;
  while ((m = rx.exec(t))) { const stat = STAT_WORD[m[3].toLowerCase().replace(/defence|defense/, 'def').replace(/armour/, 'armor')] || 'atk'; const amt = Number(m[2]); if (m[1] === '-' && /enemy|hunter|target|your/i.test(t.slice(Math.max(0, m.index - 20), m.index))) continue; out.selfBuffs.push({ stat, amount: amt, turns: 3 }); }
  const heal = t.match(/(?:recover|heal|restore|regenerate|mend)s?\s*(?:up to\s*)?(\d+)%/i); if (heal) out.selfHealPct = Number(heal[1]);
  else if (/recover|regenerat|heals? itself|mends|restores? (?:its|his|her) hp/i.test(t)) out.selfHealPct = 12;
  if (/(?:drains?|siphons?)\s+(?:\w+\s+){0,2}(?:mana|energy)|(?:mana|energy)\s+(?:is\s+)?(?:drained|siphoned)/i.test(t)) out.drainPct = 20;
  if (/drains? life|life essence|absorbs? (?:\w+ )?hp|leech/i.test(t)) out.healPct = 40;
  if (!out.selfBuffs.length) {
    if (/amplif|surges?|empower|strengthen|fury|rage|frenzy|bloodlust|power rises|grows stronger/i.test(t)) out.selfBuffs.push({ stat: 'atk', amount: 25, turns: 3 });
    if (/harden|thicken|armou?r up|shell|fortif|braces?/i.test(t)) out.selfBuffs.push({ stat: 'def', amount: 30, turns: 3 });
    if (/quicken|hastens?|accelerat|speeds? up/i.test(t)) out.selfBuffs.push({ stat: 'speed', amount: 25, turns: 3 });
  }
  const st = [[/blind|cannot see|can't see|flash/i, 'blind'], [/weaken/i, 'weaken'], [/numb|entangle|slow|snare|web/i, 'trueslow'], [/paraly/i, 'paralyze'], [/terrif|fear|dread/i, 'fear'], [/burn|flame|fire|scorch/i, 'burn'], [/poison|venom|toxi/i, 'poison'], [/bleed|lacerat|tear/i, 'bleed'], [/stun|daze/i, 'stun'], [/freez|frost|chill/i, 'freeze'], [/curse|hex/i, 'curse'], [/silence/i, 'silence'], [/confus/i, 'confuse'], [/petrif/i, 'petrify']];
  for (const [r, type] of st) { if (r.test(t)) { const d = t.match(/(\d+)\s*turns?/i); out.status = { type, chance: 55, duration: d ? Number(d[1]) : 2 }; break; } }
  if (/pierc|ignores? (?:\w+ )?(?:armou?r|def)/i.test(t)) out.pierce = 40;
  return out;
}
function descriptionOf(ability) {
  const name = typeof ability === 'string' ? ability : (ability && ability.name) || '';
  const clean = name.replace(/^[^\w]+/, '').trim(); const parts = [];
  if (ability && typeof ability === 'object') { for (const k of ['desc', 'description', 'effectText', 'text']) if (ability[k]) parts.push(String(ability[k])); }
  { const fb = Object.values(FAMILY_BLIND_SKILL).find(b => b.name === clean); if (fb && !parts.length) parts.push(fb.desc); }
  try { const SD = require('./SkillDescriptions'); const ms = SD.getMonsterSkill && SD.getMonsterSkill(clean); if (ms && ms.description && !/A powerful attack!/.test(ms.description)) parts.push(ms.description); } catch (e) {}
  try { const MA = require('./MonsterAbilities'); const d = MA.abilities && (MA.abilities[clean] || MA.abilities[name]); if (d && d.animation) parts.push(d.animation); } catch (e) {}
  return parts.join(' ');
}

// Bestiary `effect` → status type normalisation.
const EFFECT_ALIAS = { weaken: 'weaken', burn: 'burn', bleed: 'bleed', stun: 'stun', poison: 'poison', fear: 'fear', freeze: 'freeze', paralyze: 'paralyze', curse: 'curse', slow: 'trueslow', blind: 'blind', silence: 'silence', confuse: 'confuse', petrify: 'petrify', knockback: 'stun', doom: 'curse' };

function resolve(ability) {
  const name = typeof ability === 'string' ? ability : (ability && ability.name) || '';
  const out = { name, mult: DEFAULT_MULT, status: null, drainPct: 0, healPct: 0, selfHealPct: 0, selfBuff: null, selfBuffs: [], pierce: 0, desc: '' };
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
  // 1b) SkillDescriptions monster table (dungeon skill cards) — multiplier + effect.
  try {
    const SD = require('./SkillDescriptions'); const clean = name.replace(/^[^\w]+/, '').trim();
    const ms = SD.getMonsterSkill && SD.getMonsterSkill(clean);
    if (ms && !/A powerful attack!/.test(ms.description || '')) {
      if (ms.damageMultiplier && out.mult === DEFAULT_MULT) out.mult = ms.damageMultiplier;
      if (ms.effect && !out.status) { out.status = { type: EFFECT_ALIAS[String(ms.effect).toLowerCase()] || String(ms.effect).toLowerCase(), chance: 55, duration: ms.effectDuration || 3 }; out._statusSrc = 'table'; }
    }
  } catch (e) {}
  // 2) bestiary contract { name, effect, chance }
  if (ability && typeof ability === 'object' && ability.effect) {
    out.status = { type: EFFECT_ALIAS[String(ability.effect).toLowerCase()] || String(ability.effect).toLowerCase(), chance: Number(ability.chance) || 50, duration: 3 };
  }
  // 2b) family blinding skills (Push #96h-j) — blind wins over the element words in the name.
  { const clean = name.replace(/^[^\w]+/, '').trim(); const fb = Object.values(FAMILY_BLIND_SKILL).find(b => b.name === clean); if (fb) { out.status = { type: 'blind', chance: fb.chance, duration: 2 }; out.mult = 1.1; out.blindSkill = true; } }
  // 3) name semantics — the words on the tin.
  for (const [rx, patch] of KEYWORDS) {
    if (!rx.test(name)) continue;
    if (patch.mult) out.mult = patch.mult;
    if (patch.drainPct) out.drainPct = Math.max(out.drainPct, patch.drainPct);
    if (patch.healPct) out.healPct = Math.max(out.healPct, patch.healPct);
    if (patch.selfHealPct) out.selfHealPct = Math.max(out.selfHealPct, patch.selfHealPct);
    if (patch.pierce) out.pierce = Math.max(out.pierce, patch.pierce);
    if (patch.selfBuff && !out.selfBuff) out.selfBuff = { ...patch.selfBuff };
    if (patch.status && !out.status) { out.status = { ...patch.status }; out._statusSrc = 'name'; }
  }
  if (out.selfBuff) out.selfBuffs.push({ ...out.selfBuff });
  // 4) the description's promises (Push #96h-j)
  try {
    out.desc = descriptionOf(ability);
    const d = parseDescription(out.desc);
    for (const b of d.selfBuffs) if (!out.selfBuffs.find(x => x.stat === b.stat)) out.selfBuffs.push(b);
    out.selfHealPct = Math.max(out.selfHealPct, d.selfHealPct); out.healPct = Math.max(out.healPct, d.healPct);
    out.drainPct = Math.max(out.drainPct, d.drainPct); out.pierce = Math.max(out.pierce, d.pierce);
    if (d.status && (!out.status || out._statusSrc === 'name')) { out.status = { ...d.status, chance: Math.max(d.status.chance, (out.status && out.status.chance) || 0) }; out._statusSrc = 'desc'; } // the description outranks a guess from the name
  } catch (e) {}
  if (!out.selfBuff && out.selfBuffs.length) out.selfBuff = out.selfBuffs[0];
  return out;
}

// Push #96h-l: SUPPORT moves (Regenerate, Harden, Roar-without-a-hit, Mend …) heal or buff the
// beast and deal NO damage — and they cost it no turn: the beast still attacks afterwards.
function isSupport(ability) {
  if (trickOf(ability)) return true; // Push #103b
  const c = resolve(ability); if (!c.name) return false;
  if (/^(💚\s*)?regenerate$/i.test(c.name)) return true;
  const healOnly = c.selfHealPct > 0 && !c.status && !c.drainPct && c.healPct === 0;
  const buffOnly = (c.selfBuffs || []).length > 0 && !c.status && !c.drainPct && c.healPct === 0 && c.mult <= DEFAULT_MULT;
  return healOnly || buffOnly;
}
// Pick the beast's moves for this turn: an optional support move (free) + the attack it still makes.
function pickMoves(pool, fallbackAttack = { name: 'Strike', effect: null, chance: 0 }) {
  const list = Array.isArray(pool) && pool.length ? pool : [fallbackAttack];
  // Push #103b: 40% of turns the beast reaches for its TRICK (stealth / summon / necromancy) first.
  const tricks = list.filter(a => trickOf(a));
  const first = (tricks.length && Math.random() < 0.40) ? tricks[Math.floor(Math.random() * tricks.length)] : list[Math.floor(Math.random() * list.length)];
  if (!isSupport(first)) return { support: null, attack: first };
  const attacks = list.filter(a => !isSupport(a));
  return { support: first, attack: attacks.length ? attacks[Math.floor(Math.random() * attacks.length)] : fallbackAttack };
}
// Execute a support move: heal/buff lines, zero damage. Returns the message blocks (step by step).
function supportStep(monster, victim, ability) {
  const c = resolve(ability); const nm = String(c.name || 'Support');
  const _trick = trickOf(ability);
  const fx = _trick ? { lines: trickStep(monster, victim, _trick) } : apply(monster, victim, ability, 0, { skipStatus: true });
  if (_trick) c.desc = _trick.desc;
  const mStats = monster.stats || monster;
  const blocks = [
    `🌀 *MONSTER SUPPORT MOVE*\n${monster.emoji || '👹'} *${monster.name}* uses *${nm}*!`,
    `_${(c.desc && c.desc.split('\n')[0]) || `${monster.name} steadies itself with ${nm.replace(/^[^\w]+/, '')}.`}_\n⏳ Costs no turn · deals no damage`,
    fx.lines.length ? fx.lines.join('\n') : `✨ ${monster.name} braces — nothing changed.`,
    `❤️ ${monster.emoji || '👹'} ${monster.name}: ${mStats.hp}/${mStats.maxHp || mStats.hp}\n⚔️ …and it still attacks!`,
  ];
  return { blocks, contract: c, lines: fx.lines };
}
function _max(p) { try { return require('./GearSystem').effectiveMaxHp(p) || p.stats.maxHp || 100; } catch (e) { return (p && p.stats && p.stats.maxHp) || 100; } }

// Apply a status to a hunter with every defence layer (class resistance,
// armory gear, job perks) and return a log line or null.
function applyStatus(player, type, duration, damage, source) {
  if (!player || !type) return null;
  const t = String(type).toLowerCase();
  try {
    const JS = require('./JobSystem');
    if (t === 'fear' && JS.mod(player, 'fearImmune')) return `🐉 *${player.name}* is a Beast King — fear is beneath them.`;
    if (['stun', 'freeze', 'paralyze', 'petrify'].includes(t)) { const cr = JS.mod(player, 'ccResist'); if (cr && Math.random() * 100 < cr) return `👊 *${player.name}* is Unbreakable — shrugged off the ${t.toUpperCase()}!`; }
  } catch (e) {}
  try {
    const SEM = require('./StatusEffectManager');
    const ok = SEM.applyEffect(player, t, Math.max(1, Number(duration) || 2), source && typeof source === 'object' ? source : null); // Push #103b: monster MP vs hunter MR
    if (!ok) return player._lastStatusBlock ? `🛡️ *${player.name}* resisted ${t.toUpperCase()} (${player._lastStatusBlock})` : `🛡️ *${player.name}* resisted ${t.toUpperCase()}!`;
    const fx = (player.statusEffects || []).find(e => e.type === t);
    if (fx && damage) fx.damage = Math.max(fx.damage || 0, damage);
    if (fx && source) fx.source = source; // Push #96h-t: who inflicted it (domain) — named on a status death
    return `${(fx && fx.emoji) || '☠️'} *${player.name}* is ${(fx && fx.name) || t.toUpperCase()} (${(fx && fx.duration) || duration}t)`;
  } catch (e) { return null; }
}

// Execute the non-damage effects of a monster ability. `dmg` = damage dealt.
function apply(monster, player, ability, dmg, opts = {}) {
  const c = resolve(ability); const lines = [];
  if (!monster || !player) return { contract: c, lines };
  const mStats = monster.stats || monster; // raid monsters keep hp/atk at top level
  // Mana drain → drains the hunter's energy (name + mult still deal the hit).
  // Push #102g (BUG-058): a dodged / absorbed move (dmg 0) drains nothing — you slipped clear of it.
  if (c.drainPct > 0 && player.stats && (dmg > 0 || opts.forceDrain)) {
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
  for (const b of (c.selfBuffs && c.selfBuffs.length ? c.selfBuffs : (c.selfBuff ? [c.selfBuff] : []))) {
    if (!monster.tempBuffs) monster.tempBuffs = {};
    monster.tempBuffs[`mskill:${b.stat}`] = { stat: b.stat, amount: b.amount, duration: b.turns + 1, source: c.name };
    lines.push(`📈 ${monster.emoji || '👹'} ${monster.name}'s ${String(b.stat).toUpperCase()} rises +${b.amount}% (${b.turns}t)`);
  }
  // Status on the hunter.
  if (c.status && !opts.skipStatus && !(monster.noStatus) && (dmg > 0 || opts.forceStatus)) {
    let _sc = (c.status.chance || 50); try { const _ter = require('./BotLane').scratch().terrain; if (_ter) _sc = _sc * require('../data/Terrains').statusMult(_ter, c.status.type); } catch (e) {} // Push #97: terrain
    if (Math.random() * 100 < _sc) {
      const l = applyStatus(player, c.status.type, c.status.duration, c.status.damage, monster);
      if (l) lines.push(l);
    }
  }
  return { contract: c, lines };
}

// Damage multiplier for the hit itself, incl. armour pierce (def soak reduced).
function hitMult(ability) { return resolve(ability).mult || DEFAULT_MULT; }
function pierce(ability) { return resolve(ability).pierce || 0; }

module.exports = { FAMILY_TRICK_SKILL, trickSkillFor, trickOf, trickStep, isSupport, pickMoves, supportStep, FAMILY_BLIND_SKILL, blindSkillFor, parseDescription, descriptionOf, resolve, apply, applyStatus, hitMult, pierce, KEYWORDS };
