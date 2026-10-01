'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Push #95 — DOMAIN SYSTEM
//   • Every hunter unlocks a Domain at Lv.20: ONE of the 10 effects of their
//     class, rolled at random, PERMANENT. Announced in DM (Pro) or the GC.
//   • Domain Lv.1 → 100 with Upgrade Points: 10 to Lv.2, 15 to Lv.3, +5 each
//     level after. Magnitude and duration scale with level.
//   • /domain expand — 350 energy, lasts 2 turns at Lv.1 (+1 turn every 20
//     levels, max 6). Buffs the caster's whole party, debuffs every enemy.
//   • ONE domain per arena. Clash rules:
//       monster ↔ hunter : stronger entity (domain power) wins
//       hunter  ↔ hunter : class quality first, then domain power
//   • Every BOSS, and dungeon / raid monsters of rank B and above, may expand
//     their own domain: hunters are crushed (ATK/DEF down, damage taken up)
//     and take a devastating burst.
//   Effects are delivered as `tempBuffs` prefixed `domain:` — the same rails
//   the skills use, so raids, dungeons, instances and PvP all honour them.
// ═══════════════════════════════════════════════════════════════════════════

const CAST_ENERGY = 350;
const MAX_LEVEL = 100;
const UP_SHARE_CAP = 20;

// 10 archetypes. Numbers are the Lv.1 base; scale ×(1 + (lv−1)·0.02) → ~3× at Lv.100.
// ally = tempBuffs on the caster's party; enemy = tempBuffs on every foe.
const ARCHETYPES = [
  { key: 'onslaught',  ally: { atk: 18, crit: 6 },                  enemy: { def: -12 } },
  { key: 'bastion',    ally: { def: 22, damageTaken: -12 },         enemy: { atk: -10 } },
  { key: 'tempo',      ally: { speed: 20, dodge: 8 },               enemy: { speed: -15 } },
  { key: 'vampiric',   ally: { lifesteal: 12, atk: 8 },             enemy: { damageTaken: 10 } },
  { key: 'execution',  ally: { crit: 12, armorPen: 15 },            enemy: { def: -10, dodge: -8 } },
  { key: 'suppression',ally: { damageTaken: -8 },                   enemy: { atk: -20, speed: -10 } },
  { key: 'sanctuary',  ally: { regen: 4, def: 10, damageTaken: -6 }, enemy: {} },
  { key: 'mirror',     ally: { reflect: 18, def: 8 },               enemy: { damageTaken: 6 } },
  { key: 'overload',   ally: { atk: 25, damageTaken: 8 },           enemy: { damageTaken: 8 } },
  { key: 'sovereign',  ally: { atk: 10, def: 10, speed: 8, crit: 4 }, enemy: { atk: -6, def: -6 } },
];

// 10 names per class, mapped to archetypes in order.
const CLASS_DOMAINS = {
  Archer:       ['Rain of Arrows', 'Thornwood Palisade', 'Windrunner Range', 'Bloodhawk Hunt', 'Deadeye Killzone', 'Pinning Volley', 'Ranger\'s Clearing', 'Ricochet Grove', 'Meteor Barrage', 'Sovereign Sky'],
  Knight:       ['Crusader\'s March', 'Unbreakable Bulwark', 'Vanguard Stride', 'Crimson Oath', 'Judgement Line', 'Shieldwall Lock', 'Hallowed Keep', 'Mirror Plate', 'Overwhelming Charge', 'Sovereign Banner'],
  Mage:         ['Arcane Torrent', 'Runic Sanctum', 'Chrono Weave', 'Soulfire Circle', 'Nullpoint Focus', 'Gravity Well', 'Meditation Field', 'Reflective Ward', 'Mana Overload', 'Archmage\'s Court'],
  Monk:         ['Thousand Fists', 'Iron Body Temple', 'Flowing River Stance', 'Chi Siphon', 'Pressure Point Field', 'Stillness Mandala', 'Lotus Sanctuary', 'Rebounding Palm', 'Burning Spirit', 'Enlightened Realm'],
  Rogue:        ['Blade Storm', 'Shadow Cover', 'Phantom Streets', 'Bleeding Alley', 'Assassin\'s Killroom', 'Trap Maze', 'Thieves\' Den', 'Smoke Mirror', 'Reckless Gambit', 'Underworld Throne'],
  Shaman:       ['Spirit Storm', 'Totem Circle', 'Wind Spirit Dance', 'Soul Leech Grounds', 'Hexed Earth', 'Ancestral Silence', 'Healing Springs', 'Spirit Mirror', 'Primal Frenzy', 'Great Spirit\'s Court'],
  Warlord:      ['War Drums', 'Iron Phalanx', 'Forced March', 'Bloodied Banner', 'Siege Breaker', 'Commander\'s Suppression', 'Rally Camp', 'Shield Reflection', 'Total War', 'Warlord\'s Dominion'],
  Warrior:      ['Battle Fury', 'Stone Wall Stance', 'Charging Ground', 'Bloodrage Field', 'Cleaving Arena', 'Intimidation Zone', 'Veteran\'s Rest', 'Counter Plate', 'Berserker\'s Edge', 'Champion\'s Ring'],
  Assassin:     ['Death Waltz', 'Veiled Shroud', 'Ghost Steps', 'Bloodletting Field', 'Execution Ground', 'Poisoned Fog', 'Hidden Refuge', 'Blade Mirror', 'All-In Strike', 'Night Lord\'s Domain'],
  BloodKnight:  ['Crimson Onslaught', 'Blood Bastion', 'Hemorrhage Rush', 'Sanguine Feast', 'Heartseeker Field', 'Blood Curse', 'Crimson Chapel', 'Blood Mirror', 'Blood Frenzy', 'Blood Sovereign'],
  Elementalist: ['Elemental Fury', 'Earthen Bulwark', 'Gale Domain', 'Tidal Drain', 'Lightning Focus', 'Frost Suppression', 'Verdant Sanctuary', 'Prism Mirror', 'Elemental Overload', 'Primordial Court'],
  Necromancer:  ['Legion of Bone', 'Ossuary Wall', 'Wraith March', 'Soul Harvest', 'Grave Judgement', 'Dread Miasma', 'Crypt of Rest', 'Bone Mirror', 'Death Surge', 'Lich King\'s Realm'],
  Paladin:      ['Holy Charge', 'Divine Aegis', 'Righteous Stride', 'Consecrated Vigor', 'Smiting Ground', 'Holy Suppression', 'Sanctuary of Light', 'Radiant Mirror', 'Zealot\'s Fury', 'Kingdom of Light'],
  Ranger:       ['Hunter\'s Volley', 'Thicket Wall', 'Trailblazer\'s Pace', 'Predator\'s Feast', 'Marked Prey Field', 'Snare Woods', 'Forest Sanctuary', 'Deflecting Canopy', 'Wild Barrage', 'Warden of the Wilds'],
  SpellBlade:   ['Runeblade Tempest', 'Warded Steel', 'Blink Step Arena', 'Mana Leech Edge', 'Arcane Execution', 'Sigil Lockdown', 'Enchanted Refuge', 'Spell Mirror', 'Overcharged Blade', 'Spellsword Sovereign'],
  DragonKnight: ['Dragon\'s Roar', 'Scale Fortress', 'Wyvern Rush', 'Drake\'s Hunger', 'Talon Execution', 'Dragonfear', 'Dragon\'s Hoard', 'Scale Mirror', 'Dragonfire Overload', 'Dragon Sovereign'],
  Healer:       ['Radiant Pulse', 'Guardian Blessing', 'Swift Grace', 'Life Exchange', 'Purging Light', 'Pacifying Field', 'Grand Sanctuary', 'Blessing Mirror', 'Overflowing Grace', 'Saint\'s Realm'],
  ShadowDancer: ['Dance of Blades', 'Shadow Veil', 'Twilight Waltz', 'Shadow Feast', 'Silent Execution', 'Dusk Suppression', 'Umbral Refuge', 'Shadow Mirror', 'Reckless Dance', 'Shadow Court'],
  Summoner:     ['Beast Rush', 'Familiar Wall', 'Spirit Pace', 'Summoner\'s Tithe', 'Pack Execution', 'Binding Circle', 'Familiar\'s Rest', 'Warding Familiars', 'Horde Overload', 'Grand Summoner\'s Court'],
  Berserker:    ['Blood Frenzy', 'Rage Armor', 'Unstoppable Rush', 'Savage Feast', 'Skullsplitter Ground', 'Terror Roar', 'Warrior\'s Second Wind', 'Pain Mirror', 'Deathwish', 'Berserker King'],
  Chronomancer: ['Accelerated Assault', 'Stasis Field', 'Time Dilation', 'Borrowed Time', 'Fated Strike', 'Slowed Hourglass', 'Rewind Sanctuary', 'Echo Mirror', 'Temporal Overload', 'Master of Hours'],
  Devourer:     ['Endless Hunger', 'Devoured Shell', 'Ravenous Sprint', 'Consuming Maw', 'Gnashing Execution', 'Starving Field', 'Gorged Rest', 'Regurgitation', 'Gluttony Overload', 'Apex Devourer'],
  Phantom:      ['Spectral Barrage', 'Ethereal Wall', 'Phase Shift', 'Soul Siphon', 'Haunting Execution', 'Chilling Presence', 'Ghostly Refuge', 'Phantasm Mirror', 'Wraith Overload', 'Phantom Sovereign'],
  Senku:        ['Scientific Assault', 'Reinforced Lab', 'Kinetic Momentum', 'Chemical Siphon', 'Precision Analysis', 'Nerve Gas Field', 'Medical Tent', 'Optical Mirror', 'Overclocked Reactor', 'Kingdom of Science'],
  Monster:      ['Feral Rampage', 'Chitin Fortress', 'Predator Sprint', 'Devouring Ground', 'Apex Kill Zone', 'Primal Terror', 'Den of the Beast', 'Hide Reflection', 'Rampage Overload', 'Monarch of Beasts'],
};
const GENERIC = ['Awakened Will', 'Iron Resolve', 'Quick Instinct', 'Hungry Spirit', 'Sharpened Focus', 'Cold Presence', 'Quiet Ground', 'Stubborn Mirror', 'Reckless Heart', 'Hunter\'s Authority'];

const STAT_LABEL = { atk: 'ATK', def: 'DEF', speed: 'SPD', crit: 'Crit', dodge: 'Dodge', damageTaken: 'Damage taken', lifesteal: 'Lifesteal', armorPen: 'Armor pierce', reflect: 'Reflect', regen: 'HP regen/turn' };

function _cls(player) { try { return require('./ClassPower').baseClassName(player) || null; } catch (e) { return (player && player.class) || null; } }
function _quality(player) { try { return require('./ClassPower').quality(player); } catch (e) { return 100; } }
function _isPro(p) { try { return require('./UI').isPro(p); } catch (e) { return false; } }
function _max(p) { try { return require('./GearSystem').effectiveMaxHp(p) || p.stats.maxHp || 100; } catch (e) { return (p && p.stats && p.stats.maxHp) || 100; } }

function effectFor(cls, idx) {
  const names = CLASS_DOMAINS[cls] || GENERIC;
  const i = Math.max(0, Math.min(9, idx | 0));
  return { idx: i, name: names[i], arch: ARCHETYPES[i] };
}
function scale(lv) { return 1 + (Math.max(1, Math.min(MAX_LEVEL, lv)) - 1) * 0.02; }
function turnsFor(lv) { return Math.min(6, 2 + Math.floor((Math.max(1, lv) - 1) / 20)); }
function costToNext(lv) { return lv >= MAX_LEVEL ? null : 10 + 5 * (lv - 1); }
function ensure(player) {
  if (!player) return null;
  if (!player.domain || typeof player.domain !== 'object') player.domain = null;
  return player.domain;
}
function has(player) { return !!(player && player.domain && player.domain.unlocked); }

// Roll + assign the permanent domain (Lv.20+). Returns the domain if newly unlocked.
function unlock(player) {
  if (!player || (player.level || 1) < 20 || has(player)) return null;
  const cls = _cls(player) || 'Hunter';
  const idx = Math.floor(Math.random() * 10);
  const eff = effectFor(cls, idx);
  player.domain = { unlocked: true, class: cls, idx, level: 1, name: eff.name, desc: '', spentUP: 0, unlockedAt: Date.now(), casts: 0, setup: 'name' };
  return player.domain;
}
// ── Push #96d: DM setup prompts (name → description) — no command needed ──
const _clean = (t) => String(t || '').replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();
function setupStep(player) { return (player && player.domain && player.domain.unlocked && player.domain.setup) || null; }
function setupPrompt(player) {
  const d = player && player.domain; if (!d || !d.setup) return null;
  if (d.setup === 'name') return [`🌌 *NAME YOUR DOMAIN*`, `Reply here with the name of your domain (3–40 characters). Fate gave it the working name *${d.name}* — you may keep it by replying *keep*.`, `✏️ A name can be changed later with a 🃏 Rename Card (/domain rename).`].join('\n');
  if (d.setup === 'desc') return [`📜 *DESCRIBE YOUR DOMAIN*`, `Reply here with a short description of *${d.name}* (up to 200 characters) — what does a hunter see when it expands?`, `⚠️ The description is *permanent*. Reply *skip* for none.`].join('\n');
  return null;
}
// Returns null if this text was not a setup reply; otherwise { reply, done }.
function handleSetupReply(player, text) {
  const d = player && player.domain; if (!d || !d.unlocked || !d.setup) return null;
  const t = _clean(text); if (!t || t.startsWith('/') || t.startsWith('!') || t.startsWith('.')) return null;
  if (d.setup === 'name') {
    if (t.toLowerCase() !== 'keep') {
      if (t.length < 3 || t.length > 40) return { reply: '❌ 3–40 characters please. Reply with your domain name, or *keep*.', done: false };
      d.name = t;
    }
    d.setup = 'desc';
    return { reply: `✨ Your domain shall be known as *${d.name}*.\n\n${setupPrompt(player)}`, done: false };
  }
  if (d.setup === 'desc') {
    if (t.toLowerCase() !== 'skip') {
      if (t.length > 200) return { reply: '❌ Up to 200 characters please. Reply again, or *skip*.', done: false };
      d.desc = t;
    }
    delete d.setup;
    return { reply: [`🌌 *${d.name}*${d.desc ? ` — _${d.desc}_` : ''}`, `Your domain is sealed in the records. See it any time with /domain.`].join('\n'), done: true };
  }
  return null;
}
function rename(player, name) {
  const d = player && player.domain; if (!d || !d.unlocked) return { ok: false, error: 'No domain yet.' };
  const n = _clean(name); if (n.length < 3 || n.length > 40) return { ok: false, error: 'Give a name of 3–40 characters.' };
  if (!player.cards || (Number(player.cards.namechange) || 0) < 1) return { ok: false, error: 'Renaming a domain costs 1 🃏 Rename Card — /prostore buy namechange' };
  player.cards.namechange -= 1; const old = d.name; d.name = n;
  return { ok: true, old, name: n, left: player.cards.namechange };
}
function scaledEffect(player) {
  const d = player.domain; if (!d) return null;
  const eff = effectFor(d.class || _cls(player), d.idx); const k = scale(d.level || 1);
  const sc = (o) => Object.fromEntries(Object.entries(o).map(([s, v]) => [s, Math.round(v * k * 10) / 10]));
  return { ...eff, ally: sc(eff.arch.ally), enemy: sc(eff.arch.enemy), turns: turnsFor(d.level || 1), level: d.level || 1 };
}
function describe(player) {
  const e = scaledEffect(player); if (!e) return [];
  const fmt = (o, who) => Object.entries(o).filter(([, v]) => v).map(([s, v]) => `• ${who} ${STAT_LABEL[s] || s} ${v > 0 ? '+' : ''}${v}%`);
  return [...fmt(e.ally, 'Allies'), ...fmt(e.enemy, 'Enemies')];
}
function power(player) {
  const d = player.domain || {};
  let t = 0; try { const T = require('./Transformation'); if (T.isActive && T.isActive(player)) t = 25; } catch (e) {}
  return (d.level || 1) * 4 + (player.level || 1) + Math.floor(_quality(player) / 2) + t;
}

// Upgrade with UP: spends as many levels as `want` allows. Returns {levels, spent, level}.
function upgrade(player, want = 1) {
  if (!has(player)) return { ok: false, error: 'Your domain has not awakened yet (Lv.20).' };
  const d = player.domain; let spent = 0, levels = 0;
  want = Math.max(1, Math.min(MAX_LEVEL, Number(want) || 1));
  while (levels < want && d.level < MAX_LEVEL) {
    const c = costToNext(d.level);
    if ((player.upgradePoints || 0) < c) break;
    player.upgradePoints -= c; spent += c; d.level++; levels++; d.spentUP = (d.spentUP || 0) + c;
  }
  if (!levels) return { ok: false, error: `Need *${costToNext(d.level)} UP* for Domain Lv.${d.level + 1} — you have ${player.upgradePoints || 0}.` };
  return { ok: true, levels, spent, level: d.level, next: costToNext(d.level) };
}

// ── Arena state ─────────────────────────────────────────────────────────────
// arenaOf(x): any battle container (gate, dungeon, pvp battle, instance) — we
// store `domain` on it. Returns the container itself.
function arenaOf(x) { return x && typeof x === 'object' ? x : null; }
function active(arena) { const d = arena && arena.domain; return d && d.turnsLeft > 0 ? d : null; }

// ── Push #96g: the owner of an ACTIVE domain is immune to NEW status effects
// cast inside it (effects already on them keep ticking). Registry: owner key → arena.
const _shield = new Map();
function _ownerKeys(entity) {
  if (!entity) return [];
  return [entity.jid, entity.id, entity.name].filter(Boolean).map(String);
}
function _register(arena, ownerKey) { if (arena && ownerKey) _shield.set(String(ownerKey), arena); }
function isShielded(entity) {
  for (const k of _ownerKeys(entity)) {
    const arena = _shield.get(k); if (!arena) continue;
    const d = active(arena);
    if (!d) { _shield.delete(k); continue; }
    if (String(d.ownerId) === k) return d;
  }
  return null;
}
function shieldLine(entity) { const d = isShielded(entity); return d ? `🌌 *${entity.name}* stands inside *${d.name}* — the status cannot take hold.` : null; }

function _applyBuffs(entity, buffs, turns, tag, source) {
  if (!entity) return;
  if (!entity.tempBuffs) entity.tempBuffs = {};
  for (const [stat, amt] of Object.entries(buffs)) {
    if (!amt) continue;
    if (stat === 'regen') { entity.tempBuffs.regen = { pct: Math.abs(amt), duration: turns + 1, source }; continue; }
    if (stat === 'reflect') { entity.tempBuffs.reflect = { pct: Math.abs(amt), duration: turns + 1, source }; continue; }
    entity.tempBuffs[`${tag}:${stat}`] = { stat, amount: amt, duration: turns + 1, source };
  }
}
function _clearTag(entity, tag) {
  if (!entity || !entity.tempBuffs) return;
  for (const k of Object.keys(entity.tempBuffs)) if (k.startsWith(tag + ':')) delete entity.tempBuffs[k];
  if (entity.tempBuffs.regen && String(entity.tempBuffs.regen.source || '').startsWith('Domain')) delete entity.tempBuffs.regen;
  if (entity.tempBuffs.reflect && String(entity.tempBuffs.reflect.source || '').startsWith('Domain')) delete entity.tempBuffs.reflect;
}
function shatter(arena, allies = [], enemies = []) {
  const d = active(arena); if (!d) return null;
  for (const e of [...allies, ...enemies]) _clearTag(e, 'domain');
  arena.domain = null;
  return d;
}
// Per-round bookkeeping: call once per combat round from every engine.
function tick(arena) {
  const d = active(arena); if (!d) return null;
  d.turnsLeft -= 1;
  if (d.turnsLeft <= 0) { arena.domain = null; return `🌫️ *${d.name}* fades — the field returns to normal.`; }
  return null;
}

// Hunter expands. allies = party (players), enemies = monsters or the PvP foe.
function expand(arena, player, allies = [player], enemies = [], ctx = {}) {
  if (!has(player)) return { ok: false, error: 'Your domain has not awakened yet — it awakens at Lv.20.' };
  if (!arena) return { ok: false, error: 'You can only expand a domain inside a raid, dungeon, instance or PvP battle.' };
  const e = scaledEffect(player);
  const energy = player.stats.energy || 0;
  let _cost = CAST_ENERGY; try { if (require('./AuraSystem').AuraSystem.perks(player).sovereign) _cost = Math.floor(CAST_ENERGY / 2); } catch (e) {} // Push #96f: Sovereign aura tier
  if (energy < _cost) return { ok: false, error: `Domain Expansion costs *${_cost} ${player.energyType || 'energy'}* — you have ${energy}.` };
  const cur = active(arena); const lines = [];
  const myId = player.jid || player.id;
  if (cur && cur.ownerId === myId) return { ok: false, error: `*${cur.name}* is already active (${cur.turnsLeft} turn${cur.turnsLeft === 1 ? '' : 's'} left).` };
  player.stats.energy = energy - _cost;
  const myPow = power(player);
  if (cur) {
    // CLASH
    let win;
    if (cur.side === 'monster') win = myPow > cur.power;
    else if (cur.quality !== _quality(player)) win = _quality(player) > cur.quality;
    else win = myPow > cur.power;
    if (!win) {
      return { ok: false, clashed: true, error: `💥 *DOMAIN CLASH!* Your *${e.name}* (power ${myPow}) shattered against *${cur.name}* (${cur.side === 'monster' ? 'power ' + cur.power : 'quality ' + cur.quality + ' · power ' + cur.power}). ${CAST_ENERGY} energy lost.` };
    }
    lines.push(`💥 *DOMAIN CLASH!* *${e.name}* overpowers *${cur.name}* (${myPow} vs ${cur.power}) — the rival domain shatters!`);
    shatter(arena, [...allies, ...enemies], []);
  }
  const src = `Domain: ${e.name}`;
  for (const a of allies) _applyBuffs(a, e.ally, e.turns, 'domain', src);
  for (const f of enemies) _applyBuffs(f, e.enemy, e.turns, 'domain', src);
  arena.domain = { ownerId: myId, ownerName: player.name, side: 'hunter', name: e.name, level: e.level, turnsLeft: e.turns, power: myPow, quality: _quality(player), className: player.domain.class };
  _register(arena, myId); for (const k of _ownerKeys(player)) _register(arena, k);
  player.domain.casts = (player.domain.casts || 0) + 1;
  const d = player.domain;
  lines.unshift(`🌌 *DOMAIN EXPANSION — ${e.name.toUpperCase()}*`);
  if (d.desc) lines.push(`_${d.desc}_`);
  lines.push(`👤 ${player.name} · Domain Lv.${e.level} · ${e.turns} turns · power ${myPow}`, `🛡️ Inside your domain you are immune to new status effects.`);
  lines.push(...describe(player));
  if (allies.length > 1) lines.push(`🤝 Party covered: ${allies.map(a => a.name).join(', ')}`);
  return { ok: true, text: lines.join('\n'), effect: e };
}

// ── Monster / boss domains ─────────────────────────────────────────────────
// Push #96g: monster domains — one per rank tier, each with a real identity.
// Numbers scale hard with rank: an S-rank domain is a different world from a B.
const MONSTER_DOMAINS = {
  E:  { name: 'Crushing Presence',  emoji: '🌫️', desc: 'The air thickens; even a weak beast feels heavier here.' },
  D:  { name: 'Field of Despair',   emoji: '🥀', desc: 'Hope drains out of the ground beneath your feet.' },
  C:  { name: "Predator's Ground",  emoji: '🐾', desc: 'Every shadow is a hunting lane — you are the prey.' },
  B:  { name: 'Abyssal Pressure',   emoji: '🌊', desc: 'Pressure like the deep sea. Armour groans, lungs burn.' },
  A:  { name: "Tyrant's Territory", emoji: '👁️', desc: 'The beast rules here. Your strikes slide off its law.' },
  S:  { name: 'Realm of Ruin',      emoji: '☄️', desc: 'Reality bends to the monarch. Steel rusts, mana curdles, courage dies.' },
  SS: { name: 'Nightmare Expanse',  emoji: '🕳️', desc: 'There is no ground, no sky — only the thing that wants you dead.' },
};
const MONSTER_DOMAIN_NAMES = Object.values(MONSTER_DOMAINS).map(d => d.name); // kept for callers/tests
// Push #96h: DEPTH — each beast FAMILY shapes the domain (name, lore, and a LAW that
// only that family imposes), on top of the rank numbers. Laws:
//   drain  → hunters lose energy on expansion       slow   → hunters lose SPEED for the duration
//   regen  → the beast heals every turn inside      pierce → hunters' DEF counts for less (extra −DEF)
const FAMILY_DOMAINS = {
  beast:     { name: 'Hunting Grounds',   emoji: '🐺', desc: 'The scent of blood fills the air — the pack already knows where you will run.',        law: 'slow',   lawText: 'Hunters are SLOWED' },
  goblinoid: { name: 'Warren of Knives',  emoji: '🗡️', desc: 'Tunnels close in; a blade waits behind every stone.',                                 law: 'pierce', lawText: 'Armour counts for less' },
  undead:    { name: 'Grave Dominion',    emoji: '⚰️', desc: 'The dead do not tire. Every wound you deal is quietly undone.',                        law: 'regen',  lawText: 'The beast regenerates' },
  reptile:   { name: 'Scalebound Marsh',  emoji: '🐊', desc: 'Mud swallows your boots; cold eyes watch from the still water.',                        law: 'slow',   lawText: 'Hunters are SLOWED' },
  construct: { name: 'Iron Sanctum',      emoji: '🪨', desc: 'The walls themselves are the beast. Stone answers to it, not to you.',                   law: 'pierce', lawText: 'Armour counts for less' },
  demon:     { name: 'Infernal Covenant', emoji: '😈', desc: 'Your mana is siphoned into the flame the moment it leaves your hands.',                  law: 'drain',  lawText: 'Hunters lose energy' },
  elf:       { name: 'Whispering Glade',  emoji: '🧝', desc: 'Every rune on the trees is aimed at you. Spells unravel before they land.',             law: 'drain',  lawText: 'Hunters lose energy' },
  slime:     { name: 'Dissolving Pool',   emoji: '🟢', desc: 'Acid mist eats at steel and skin alike — and feeds the thing beneath.',                  law: 'regen',  lawText: 'The beast regenerates' },
  insect:    { name: 'Hive Mind Field',   emoji: '🐜', desc: 'A thousand eyes share one hunger. Nowhere you stand is unseen.',                         law: 'slow',   lawText: 'Hunters are SLOWED' },
};
function _familyDomain(monster) {
  try { const f = require('./MonsterTypes').familyOf(monster); return FAMILY_DOMAINS[f] || null; } catch (e) { return null; }
}
const RANK_IDX = { E: 0, D: 1, C: 2, B: 3, A: 4, S: 5, SS: 6, F: 0 };
// Per-rank domain numbers (monster side buffs itself; hunter side is debuffed).
//  ri        0    1    2    3    4    5    6
const MD_DEBUFF = [12, 16, 20, 26, 32, 40, 48];   // hunters: −ATK% −DEF% +damage taken%
const MD_SELF   = [10, 14, 18, 24, 30, 38, 46];   // monster: +ATK% +DEF%
const MD_BURST  = [6, 8, 10, 13, 16, 20, 24];     // % max HP burst on expansion
const MD_TURNS  = [2, 2, 2, 3, 3, 4, 4];
const MD_STATUS = ['weaken', 'weaken', 'bleed', 'burn', 'poison', 'curse', 'curse'];
const MD_STATUS_CHANCE = [0.40, 0.45, 0.50, 0.60, 0.70, 0.85, 1.0];
function monsterPower(monster, ctx = {}) {
  const rank = String(ctx.rank || monster.rank || 'E').toUpperCase();
  return (RANK_IDX[rank] || 0) * 40 + (Number(monster.level) || 1) + (ctx.boss || monster.isBoss ? 90 : 0) + (monster.elite || monster.isElite ? 30 : 0);
}
function monsterEligible(monster, ctx = {}) {
  if (ctx.boss || monster.isBoss) return true;
  const rank = String(ctx.rank || monster.rank || 'E').toUpperCase();
  return (RANK_IDX[rank] || 0) >= 3;
}
function monsterDomainInfo(rank, boss = false) {
  const r = String(rank || 'E').toUpperCase(); const ri = RANK_IDX[r] || 0; const md = MONSTER_DOMAINS[r] || MONSTER_DOMAINS.E;
  const b = boss ? 1.25 : 1;
  return { rank: r, ri, name: md.name, emoji: md.emoji, desc: md.desc,
    debuff: Math.round(MD_DEBUFF[ri] * b), self: Math.round(MD_SELF[ri] * b), burst: Math.min(30, Math.round(MD_BURST[ri] * b)),
    turns: MD_TURNS[ri] + (boss ? 1 : 0), status: MD_STATUS[ri], statusChance: Math.min(1, MD_STATUS_CHANCE[ri] * (boss ? 1.15 : 1)) };
}
// Called on the monster's turn. Returns a text block or null.
function monsterTry(arena, monster, hunters = [], ctx = {}) {
  if (!arena || !monster || !hunters.length || !monsterEligible(monster, ctx)) return null;
  const cur = active(arena);
  if (cur && cur.side === 'monster') return null;
  const isBoss = !!(ctx.boss || monster.isBoss);
  const chance = isBoss ? 0.70 : 0.40; // Push #96d: bosses 70%, B/A/S monsters 40%
  if (Math.random() > (ctx.forceChance != null ? ctx.forceChance : chance)) return null;
  const pow = monsterPower(monster, ctx);
  const lines = [];
  if (cur) {
    if (pow <= cur.power) return `🌌 *${monster.name}* tries to expand a domain — but *${cur.name}* holds (${cur.power} vs ${pow})!`;
    lines.push(`💥 *DOMAIN CLASH!* *${monster.name}* (power ${pow}) crushes *${cur.name}* (${cur.power}) — ${cur.ownerName}'s domain shatters!`);
    shatter(arena, hunters, [monster]);
  }
  const info = monsterDomainInfo(ctx.rank || monster.rank || 'E', isBoss);
  const fam = _familyDomain(monster); if (fam) { info.name = fam.name; info.emoji = fam.emoji; info.desc = fam.desc; info.law = fam.law; info.lawText = fam.lawText; } // Push #96h: family depth
  const mag = info.debuff, turns = info.turns;
  const name = `${monster.name}'s ${info.name}`;
  const lawLines = [];
  const src = `Domain: ${name}`;
  const hurt = []; const afflicted = [];
  for (const h of hunters) {
    if (!h || !h.stats || (h.stats.hp || 0) <= 0) continue;
    _applyBuffs(h, { atk: -mag, def: -mag, damageTaken: mag }, turns, 'domain', src);
    // Push #96h: the family's LAW
    if (info.law === 'slow') _applyBuffs(h, { speed: -Math.round(mag * 0.75) }, turns, 'domain', src);
    if (info.law === 'pierce') { const k = h.tempBuffs && h.tempBuffs['domain:def']; if (k) k.amount -= Math.round(mag * 0.5); }
    if (info.law === 'drain' && h.stats && typeof h.stats.energy === 'number') { const lost = Math.floor(h.stats.energy * Math.min(0.35, 0.10 + info.ri * 0.04)); h.stats.energy = Math.max(0, h.stats.energy - lost); if (lost) lawLines.push(`${h.name} −${lost} energy`); }
    const burst = Math.max(1, Math.floor(_max(h) * info.burst / 100));
    h.stats.hp = Math.max(1, h.stats.hp - burst); // devastating, never a kill on its own
    hurt.push(`${h.name} −${burst}`);
    try { const MSFX = require('./MonsterSkillFX'); if (Math.random() < info.statusChance) { const l = MSFX.applyStatus(h, info.status, 2); if (l) afflicted.push(l); } } catch (e) {}
  }
  _applyBuffs(monster, { atk: info.self, def: info.self }, turns, 'domain', src);
  if (info.law === 'regen') _applyBuffs(monster, { regen: 3 + info.ri }, turns, 'domain', src); // Push #96h
  arena.domain = { ownerId: monster.id || monster.name, ownerName: monster.name, side: 'monster', name, level: 0, turnsLeft: turns, power: pow, rank: info.rank };
  _register(arena, monster.id || monster.name); for (const k of _ownerKeys(monster)) _register(arena, k);
  lines.unshift(
    `${info.emoji} *DOMAIN EXPANSION — ${name.toUpperCase()}* [${info.rank}${isBoss ? ' BOSS' : ''}]`,
    `_${info.desc}_`,
    `${monster.emoji || '👹'} ${turns} turns · power ${pow} · 🛡️ immune to new status effects inside`,
    `⬇️ Hunters: ATK −${mag}% · DEF −${mag}% · damage taken +${mag}% · 💥 ${info.burst}% max HP burst (${hurt.join(', ')})`,
    `⬆️ ${monster.name}: ATK +${info.self}% · DEF +${info.self}%`,
  );
  if (info.law) lines.push(`⚖️ *Law of the domain:* ${info.lawText}${info.law === 'slow' ? ` (SPD −${Math.round(mag * 0.75)}%)` : info.law === 'pierce' ? ` (extra DEF −${Math.round(mag * 0.5)}%)` : info.law === 'regen' ? ` (+${3 + info.ri}% HP per turn)` : lawLines.length ? ` (${lawLines.join(', ')})` : ''}`);
  if (afflicted.length) lines.push(...afflicted);
  return lines.join('\n');
}

// Lv.20 announcement helper (LevelUpManager hook).
function onLevelUp(player, sock, chatId) {
  try {
    const d = unlock(player); if (!d) return null;
    const text = [`🌌 *DOMAIN AWAKENED!*`, `👤 *${player.name}* (Lv.${player.level}) — the ${d.class} within you takes form.`, `✨ Your permanent domain: *${d.name}*`, ...describe(player), ``, `⚡ /domain expand (${CAST_ENERGY} energy, ${turnsFor(1)} turns at Lv.1) · 📈 /domain upgrade (10 UP → Lv.2)`, `✏️ /domain name <name> · /domain desc <text>`].join('\n');
    if (sock) {
      // Push #96d: the awakening + name/description prompts always go to the hunter's DM.
      const dm = player.jid || player.id || null;
      const to = dm || chatId;
      if (to) sock.sendMessage(to, { text }).then(() => { const p = setupPrompt(player); if (p) return sock.sendMessage(to, { text: p }); }).catch(() => {});
      if (chatId && chatId !== to) sock.sendMessage(chatId, { text: `🌌 *${player.name}*'s domain has awakened — check your DM to name it.` }).catch(() => {});
    }
    return d;
  } catch (e) { return null; }
}

// ── UP sharing (/giveup) ───────────────────────────────────────────────────
function shareUP(from, to, amount) {
  const n = Math.floor(Number(amount) || 0);
  if (!from || !to) return { ok: false, error: 'Hunter not found.' };
  if (n < 1) return { ok: false, error: 'Send at least 1 UP.' };
  if ((from.jid || from.id) === (to.jid || to.id)) return { ok: false, error: 'You cannot send UP to yourself.' };
  const day = new Date().toISOString().slice(0, 10);
  if (!from.upShare || from.upShare.day !== day) from.upShare = { day, sent: 0 };
  const left = UP_SHARE_CAP - from.upShare.sent;
  if (left <= 0) return { ok: false, error: `Daily limit reached — you can share *${UP_SHARE_CAP} UP* per day.` };
  if (n > left) return { ok: false, error: `You can still share *${left} UP* today (cap ${UP_SHARE_CAP}/day).` };
  if ((from.upgradePoints || 0) < n) return { ok: false, error: `You only have *${from.upgradePoints || 0} UP*.` };
  from.upgradePoints -= n; to.upgradePoints = (to.upgradePoints || 0) + n; from.upShare.sent += n;
  return { ok: true, sent: n, left: left - n };
}

// PvP arenas: one shared record per pair of hunters (battles live on two player objects).
const _pvpArenas = new Map();
function pvpArena(a, b) {
  const k = [String(a || ''), String(b || '')].sort().join('|');
  if (!_pvpArenas.has(k)) _pvpArenas.set(k, { kind: 'pvp', key: k, domain: null });
  return _pvpArenas.get(k);
}
function endPvpArena(a, b) { _pvpArenas.delete([String(a || ''), String(b || '')].sort().join('|')); }

// Find the caller's live battle: { kind, arena, allies, enemies } or null.
function findBattle(player, sender, db) {
  try {
    if (player.pvpBattle && player.pvpBattle.opponentId) {
      const opp = db.users[player.pvpBattle.opponentId];
      if (opp) return { kind: 'pvp', arena: pvpArena(sender, player.pvpBattle.opponentId), allies: [player], enemies: [opp] };
    }
  } catch (e) {}
  try {
    const GM = require('../dungeons/GateManager');
    const bare = (j) => String(j || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    for (const g of Object.values(GM.GateManager.activeGates || {})) {
      if (!g.raid || g.raid.status !== 'active') continue;
      if (!(g.raid.members || []).some(m => bare(m.id) === bare(sender))) continue;
      const GR = require('../dungeons/GateRaid');
      const allies = GR.livingMembers(g, db); if (!allies.some(a => a === player)) allies.push(player);
      const floor = g.currentFloor;
      let enemies = (g.monsters || []).filter(mm => mm.floor === floor && !mm.defeated && (mm.hp || 0) > 0);
      if (!enemies.length && g.boss && !g.boss.defeated && (g.boss.hp || 0) > 0) enemies = [g.boss];
      return { kind: 'gate', arena: g, allies, enemies, gate: g };
    }
  } catch (e) {}
  try {
    if (player.instance && player.instance.active && player.instance.monster) return { kind: 'instance', arena: player.instance, allies: [player], enemies: [player.instance.monster] };
  } catch (e) {}
  try {
    const sd = db.soloDungeons && db.soloDungeons[sender];
    if (sd && sd.currentMonster) return { kind: 'dungeon', arena: sd, allies: [player], enemies: [sd.currentMonster] };
    const DPM = require('../dungeons/DungeonPartyManager');
    const party = DPM.getPartyByPlayer(sender);
    if (party && party.status === 'active' && party.dungeon && party.dungeon.currentMonster) {
      const allies = (party.members || []).map(m => db.users[m.id || m.jid || m]).filter(u => u && (u.stats?.hp || 0) > 0);
      if (!allies.includes(player)) allies.push(player);
      return { kind: 'dungeon', arena: party.dungeon, allies, enemies: [party.dungeon.currentMonster] };
    }
  } catch (e) {}
  return null;
}

module.exports = { FAMILY_DOMAINS, isShielded, shieldLine, monsterDomainInfo, MONSTER_DOMAINS, setupStep, setupPrompt, handleSetupReply, rename, pvpArena, endPvpArena, findBattle, CAST_ENERGY, MAX_LEVEL, UP_SHARE_CAP, ARCHETYPES, CLASS_DOMAINS, STAT_LABEL, effectFor, scale, turnsFor, costToNext, ensure, has, unlock, scaledEffect, describe, power, upgrade, arenaOf, active, shatter, tick, expand, monsterPower, monsterEligible, monsterTry, onLevelUp, shareUP };
