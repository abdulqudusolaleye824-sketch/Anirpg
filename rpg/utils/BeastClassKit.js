// Push #103k (owner call): B-rank+ beasts and EVERY boss fight with a hunter CLASS KIT — every class except Senku,
// including the "mechanic" classes (Summoner summons, Berserker rage, Necromancer necromancy, Shadow Dancer's
// shadow dance, Blood Knight's blood pact). Kits ride on the existing MonsterSkillFX contract (name/desc/effect/
// chance/mult/trick) so the raid, dungeon and instance engines need no new paths.
// BALANCE: hit multipliers 1.10–1.35 (boss signature 1.45), status chance 30–45%, 2 turns — a flavourful threat, not a wall.
const KITS = {
  Warrior:      { att: ['Shield Bash', 1.15, 'stun', 30, 'A ringing shield blow — stuns.'],                 trick: ['War Cry', 'rage'],        sig: ['Executioner Cleave', 1.35, 'bleed', 40, 'A cleave meant to end things. Bleeds.'] },
  Mage:         { att: ['Frost Lance', 1.15, 'freeze', 30, 'A spear of ice — freezes.'],                       trick: ['Arcane Ward', 'ward'],    sig: ['Meteor Call', 1.35, 'burn', 45, 'Fire falls from nowhere. Burns.'] },
  Archer:       { att: ['Piercing Shot', 1.20, null, 0, 'An arrow that ignores armour. Pierces.', 40],         trick: ['Hawk Eye', 'focus'],      sig: ['Arrow Storm', 1.30, 'bleed', 40, 'A sky of arrows. Bleeds.'] },
  Rogue:        { att: ['Backstab', 1.25, 'bleed', 35, 'From behind, where it hurts. Bleeds.'],               trick: ['Smoke Step', 'stealth'],  sig: ['Death Mark', 1.35, 'weaken', 40, 'Marked for death. Weakens.'] },
  Paladin:      { att: ['Holy Smite', 1.15, 'blind', 30, 'Light that sears the eyes. Blinds.'],                trick: ['Divine Shield', 'ward'],  sig: ['Judgement', 1.35, 'stun', 35, 'Heaven passes sentence. Stuns.'] },
  Berserker:    { att: ['Reckless Swing', 1.25, null, 0, 'Everything into one swing.'],                        trick: ['Blood Rage', 'rage'],     sig: ['Rampage', 1.40, 'fear', 35, 'It will not stop. Terrifies.'] },
  Necromancer:  { att: ['Soul Rend', 1.15, 'curse', 35, 'Tears at the soul itself. Curses.'],                  trick: ['Raise Dead', 'necro'],    sig: ['Death Coil', 1.30, 'weaken', 40, 'Cold death leeches strength. Weakens; drains life.', 0, 35] },
  Assassin:     { att: ['Shadow Strike', 1.25, 'bleed', 35, 'Unseen until it lands. Bleeds.'],                 trick: ['Vanish', 'stealth'],      sig: ['Assassinate', 1.40, null, 0, 'One breath, one blade. Pierces.', 50] },
  DragonKnight: { att: ['Dragon Claw', 1.20, 'bleed', 30, 'Talons of a wyrm. Bleeds.'],                       trick: ['Draconic Roar', 'rage'],  sig: ['Dragon Breath', 1.35, 'burn', 45, 'A gout of dragonfire. Burns.'] },
  Devourer:     { att: ['Hungering Bite', 1.15, null, 0, 'It feeds as it bites. Drains life.', 0, 40],         trick: ['Consume', 'blood'],       sig: ['Void Maw', 1.35, 'weaken', 40, 'A mouth that eats strength. Weakens; drains life.', 0, 40] },
  Monk:         { att: ['Palm Strike', 1.15, 'stun', 30, 'A chi-charged palm. Stuns.'],                       trick: ['Inner Peace', 'ward'],    sig: ['Hundred Fists', 1.35, 'confuse', 35, 'Too many blows to count. Confuses.'] },
  Shaman:       { att: ['Spirit Bolt', 1.15, 'poison', 35, 'Spirit venom. Poisons.'],                          trick: ['Ancestral Call', 'summon'], sig: ['Hex', 1.30, 'curse', 45, 'An old, cruel hex. Curses; drains mana.', 0, 0, 20] },
  BloodKnight:  { att: ['Crimson Slash', 1.20, 'bleed', 35, 'A cut that keeps bleeding. Bleeds; drains life.', 0, 30], trick: ['Blood Pact', 'blood'], sig: ['Exsanguinate', 1.35, 'bleed', 45, 'It drinks the wound. Bleeds; drains life.', 0, 45] },
  SpellBlade:   { att: ['Arcane Edge', 1.20, 'burn', 30, 'A blade wreathed in spellfire. Burns.'],              trick: ['Mana Shield', 'ward'],    sig: ['Spellstorm', 1.35, 'silence', 35, 'Steel and sorcery as one. Silences.'] },
  Summoner:     { att: ['Spirit Lash', 1.15, 'weaken', 30, 'A bound spirit strikes. Weakens.'],                 trick: ['Summon Familiars', 'summon'], sig: ['Astral Barrage', 1.30, 'confuse', 35, 'Every familiar strikes at once. Confuses.'] },
  Warlord:      { att: ['Commander Strike', 1.20, 'weaken', 30, 'A blow that breaks lines. Weakens.'],          trick: ['Rally', 'rage'],          sig: ['Conqueror Charge', 1.35, 'stun', 35, 'Nothing stands before it. Stuns.'] },
  Elementalist: { att: ['Chain Lightning', 1.15, 'paralyze', 30, 'Lightning leaps hunter to hunter. Paralyzes.'], trick: ['Elemental Veil', 'ward'], sig: ['Cataclysm', 1.35, 'burn', 45, 'Fire, ice and storm together. Burns.'] },
  ShadowDancer: { att: ['Shadow Fan', 1.20, 'blind', 35, 'Blades from the dark. Blinds.'],                      trick: ['Shadow Dance', 'shadowdance'], sig: ['Midnight Waltz', 1.35, 'confuse', 40, 'Its shadow fights beside it. Confuses.'] },
  Chronomancer: { att: ['Time Lash', 1.15, 'trueslow', 35, 'Time thickens around you. Slows.'],                 trick: ['Rewind', 'ward'],         sig: ['Temporal Collapse', 1.35, 'stun', 35, 'A moment stolen. Stuns.'] },
  Phantom:      { att: ['Spectral Touch', 1.15, 'fear', 35, 'A touch from beyond. Terrifies.'],                 trick: ['Phase', 'stealth'],       sig: ['Haunting', 1.30, 'curse', 45, 'It will not leave you. Curses; drains mana.', 0, 0, 20] },
  Knight:       { att: ['Lance Thrust', 1.20, null, 0, 'A knight\'s lance. Pierces.', 35],                      trick: ['Bulwark', 'ward'],        sig: ['Sacred Charge', 1.35, 'stun', 35, 'Steel and oath. Stuns.'] },
  Ranger:       { att: ['Twin Shot', 1.20, 'bleed', 30, 'Two arrows, one breath. Bleeds.'],                     trick: ['Beast Companion', 'summon'], sig: ['Hunter\'s Mark', 1.30, 'weaken', 40, 'Marked prey never escapes. Weakens.'] },
  Healer:       { att: ['Holy Lash', 1.10, 'blind', 30, 'Light that punishes. Blinds.'],                        trick: ['Mending Light', 'ward'],  sig: ['Purging Flame', 1.30, 'burn', 35, 'Cleansing fire. Burns.'] },
  Bard:         { att: ['Discordant Note', 1.10, 'confuse', 35, 'A note that unmakes thought. Confuses.'],       trick: ['Battle Hymn', 'rage'],    sig: ['Requiem', 1.30, 'silence', 40, 'A song for the dead. Silences.'] },
};
const CLASSES = Object.keys(KITS); // Senku and Monster are NOT in the pool — by design.
const KIT_RANKS = new Set(['B', 'A', 'S', 'SS']);
const TRICK_DESC = {
  rage:        'It flies into a RAGE — ATK +35% for 3 turns, DEF −10%.',
  ward:        'A ward settles over it — DEF +30% for 2 turns and it mends 10% HP.',
  focus:       'It takes aim — SPEED +40% for 2 turns, next hit pierces.',
  stealth:     'It vanishes — SPEED +50% and DEF +30% for 2 turns; blinds.',
  summon:      'It SUMMONS kin to its side — ATK +25% for 3 turns; they harry the hunters.',
  necro:       'NECROMANCY — the fallen rise to feed it: heals 20% max HP, ATK +15% for 3 turns, curses.',
  blood:       'A BLOOD PACT — it opens its own veins: ATK +30% for 3 turns, every hit drinks life.',
  shadowdance: 'SHADOW DANCE — its shadow steps out and fights too: SPEED +60% and DEF +25% for 2 turns; confuses.',
};

function _move(spec, kind, cls, boss) {
  const [name, mult, status, chance, desc, pierce, healPct, drainPct] = spec;
  const m = { name: `${kind === 'sig' ? '💥' : '⚔️'} ${name}`, kit: true, kitClass: cls, kind, desc, effect: status || null, chance: status ? Math.min(45, chance || 35) : 0, mult: Math.min(boss ? 1.45 : 1.35, mult || 1.15) };
  if (pierce) m.pierce = pierce; if (healPct) m.healPct = healPct; if (drainPct) m.drainPct = drainPct;
  return m;
}
function _trick(spec, cls) { const [name, trick] = spec; return { name: `🌀 ${name}`, kit: true, kitClass: cls, kind: 'trick', trick, desc: TRICK_DESC[trick] || '', effect: null, chance: 0 }; }

/** Build the 3-move kit for a class. */
function kitFor(cls, boss = false) {
  const k = KITS[cls]; if (!k) return [];
  return [_move(k.att, 'att', cls, boss), _trick(k.trick, cls), _move(k.sig, 'sig', cls, boss)];
}
function pickClass(rnd = Math.random) { return CLASSES[Math.floor(rnd() * CLASSES.length)]; }

/** Does this beast fight with a kit? B+ regular beasts and every boss. */
function qualifies(mon, rank, opts = {}) {
  if (!mon) return false;
  if (opts.boss || mon.isBoss) return true;
  const r = String(mon.rank || rank || 'E').toUpperCase();
  return KIT_RANKS.has(r);
}

/** Give a beast its class kit (idempotent). Returns the class or null. */
function assign(mon, rank, opts = {}) {
  if (!mon || mon.kitClass) return mon && mon.kitClass || null;
  if (!qualifies(mon, rank, opts)) return null;
  const cls = opts.cls || pickClass(opts.rnd);
  const moves = kitFor(cls, !!(opts.boss || mon.isBoss));
  mon.kitClass = cls;
  mon.skills = [...(Array.isArray(mon.skills) ? mon.skills : []), ...moves];
  return cls;
}
function kitMoves(mon) { return (Array.isArray(mon && mon.skills) ? mon.skills : []).filter(s => s && s.kit); }
function label(mon) { return mon && mon.kitClass ? `🎓 Fights like a *${mon.kitClass}*` : ''; }

// Extra trick kinds (rage / ward / focus / blood / shadowdance) resolved here; MonsterSkillFX.trickStep handles
// stealth / summon / necro itself and calls back for the rest.
function trickStep(monster, victim, trick, helpers) {
  const { buff, applyStatus } = helpers; const em = monster.emoji || '👹'; const lines = helpers.lines || []; const mStats = monster.stats || monster;
  const kind = trick.trick;
  if (kind === 'rage') { lines.push(`😡 ${em} *${monster.name}* flies into a RAGE!`); buff('atk', 35, 3); if (!monster.tempBuffs) monster.tempBuffs = {}; monster.tempBuffs['mskill:def'] = { stat: 'def', amount: -10, duration: 4, source: 'Rage' }; lines.push(`📉 ${em} ${monster.name}'s DEF drops −10% (3t) — reckless!`); }
  else if (kind === 'ward') { const max = mStats.maxHp || mStats.hp || 0; const b = mStats.hp || 0; mStats.hp = Math.min(max, b + Math.floor(max * 0.10)); lines.push(`🛡️ ${em} *${monster.name}* raises a ward${mStats.hp > b ? ` and mends *${mStats.hp - b}* HP` : ''}!`); buff('def', 30, 2); }
  else if (kind === 'focus') { lines.push(`🎯 ${em} *${monster.name}* takes aim!`); buff('speed', 40, 2); monster._kitPierceNext = 40; }
  else if (kind === 'blood') { lines.push(`🩸 ${em} *${monster.name}* opens its own veins — a BLOOD PACT!`); buff('atk', 30, 3); monster._kitLifesteal = { pct: 30, turns: 3 }; }
  else if (kind === 'shadowdance') { lines.push(`🌑 ${em} *${monster.name}*'s shadow steps out and DANCES!`); buff('speed', 60, 2); buff('def', 25, 2); if (victim && !monster.noStatus && Math.random() < 0.5) { const l = applyStatus(victim, 'confuse', 2, undefined, monster); if (l) lines.push(l); } }
  return lines;
}

module.exports = { KITS, CLASSES, KIT_RANKS, TRICK_DESC, kitFor, pickClass, qualifies, assign, kitMoves, label, trickStep };
