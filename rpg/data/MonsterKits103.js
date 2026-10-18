// ═══════════════════════════════════════════════════════════════
// MonsterKits103 — Push #103b
// Every one of the 50 Monster variants gets a roster + natural-weapon ladder
// built from its ANATOMY: a bear swipes with claws and bites with jaws, a mantis
// cuts with scythe arms and has no fangs, a toad lashes with its tongue, a golem
// has no mouth to bite with, a moth blinds with wing dust, a worm has no eyes…
// Mechanics follow the Monster spec in "Class revamp.txt" slot for slot (same
// %s / effects), so every variant is equally strong — only the body differs.
// ═══════════════════════════════════════════════════════════════
'use strict';

// ── Element by variant word (status that replaces "bleed"/"poison" procs) ──
const ELEMENT_BY_WORD = {
  ember: 'fire', lava: 'fire', magma: 'fire', infernal: 'fire', ash: 'fire',
  acid: 'venom', toxic: 'venom', venom: 'venom', plague: 'venom', decay: 'venom',
  frost: 'ice', ice: 'ice', thunder: 'storm', storm: 'storm',
  void: 'void', abyssal: 'void', shadow: 'void', spectral: 'void', dusk: 'void', hollow: 'void', death: 'void', chaos: 'void', dark: 'void',
  stone: 'earth', iron: 'earth', mud: 'earth', sand: 'earth', crystal: 'earth', bone: 'earth',
  blood: 'blood', flesh: 'blood', feral: 'beast', goblin: 'beast', wolf: 'beast',
};
const ELEMENT = {
  fire:  { status: 'burn',   word: 'searing',   emoji: '🔥', coat: 'Scorching' },
  venom: { status: 'poison', word: 'virulent',  emoji: '☠️', coat: 'Venomous' },
  ice:   { status: 'freeze', word: 'glacial',   emoji: '❄️', coat: 'Frostbitten' },
  storm: { status: 'stun',   word: 'crackling', emoji: '⚡', coat: 'Charged' },
  void:  { status: 'curse',  word: 'umbral',    emoji: '🌑', coat: 'Void-touched' },
  earth: { status: 'weaken', word: 'crushing',  emoji: '🪨', coat: 'Grinding' },
  blood: { status: 'bleed',  word: 'gory',      emoji: '🩸', coat: 'Bloodied' },
  beast: { status: 'bleed',  word: 'feral',     emoji: '🐾', coat: 'Savage' },
};

// ── Anatomy profiles (keyed by the creature word at the end of the variant name) ──
// weapon: natural weapon ladder base · strike/heavy/pierce: attack parts
// mouth: biting part (null = cannot bite) · vocal: intimidation · gaze: fear tool
// hide: physiology · move: charge verb · ground: AoE body move
const ANATOMY = {
  shark:    { weapon: 'Jaws',        strike: 'Jaw Snap',        heavy: 'Tail Slam',        pierce: 'Serrated Teeth',  mouth: 'jaws',      vocal: 'Thrash',       gaze: 'Dead-Eye Stare',  hide: 'Sandpaper Skin',  move: 'Breach',       ground: 'Tail Whip',      stare: true },
  mantis:   { weapon: 'Scythe Arms', strike: 'Scythe Slash',    heavy: 'Twin Scythe Cross', pierce: 'Raptorial Spike', mouth: 'mandibles', vocal: 'Wing Rattle',  gaze: 'Compound-Eye Lock', hide: 'Chitin Plating', move: 'Lunge',        ground: 'Wing Buffet',    stare: true },
  toad:     { weapon: 'Tongue',      strike: 'Tongue Lash',     heavy: 'Belly Flop',       pierce: 'Tongue Spear',    mouth: 'gullet',    vocal: 'Croak',        gaze: 'Bulging Glare',   hide: 'Slick Skin',      move: 'Leap',         ground: 'Ground Slap',    stare: true },
  serpent:  { weapon: 'Fangs',       strike: 'Fang Strike',     heavy: 'Coil Crush',       pierce: 'Fang Pierce',     mouth: 'fangs',     vocal: 'Hiss',         gaze: 'Serpent Gaze',    hide: 'Scales',          move: 'Slither Rush', ground: 'Tail Sweep',     stare: true },
  bat:      { weapon: 'Fangs',       strike: 'Fang Nip',        heavy: 'Wing Slam',        pierce: 'Needle Fangs',    mouth: 'fangs',     vocal: 'Screech',      gaze: 'Echo Pulse',      hide: 'Membrane Wings',  move: 'Swoop',        ground: 'Wing Gust',      stare: false },
  colossus: { weapon: 'Fists',       strike: 'Fist Smash',      heavy: 'Double Hammerfist', pierce: 'Knuckle Spike',  mouth: null,        vocal: 'Bellow',       gaze: 'Towering Shadow', hide: 'Bone Plating',    move: 'Rampage',      ground: 'Earthshaker Stomp', stare: false },
  dragon:   { weapon: 'Talons',      strike: 'Talon Rake',      heavy: 'Tail Hammer',      pierce: 'Talon Pierce',    mouth: 'jaws',      vocal: 'Dragon Roar',  gaze: 'Draconic Gaze',   hide: 'Dragon Scales',   move: 'Dive',         ground: 'Wing Storm',     stare: true },
  stalker:  { weapon: 'Claws',       strike: 'Claw Rake',       heavy: 'Pounce Slam',      pierce: 'Hooked Claws',    mouth: 'fangs',     vocal: 'Low Growl',    gaze: 'Predator Stare',  hide: 'Shadow Pelt',     move: 'Pounce',       ground: 'Sweeping Claws', stare: true },
  beetle:   { weapon: 'Horn',        strike: 'Horn Thrust',     heavy: 'Horn Toss',        pierce: 'Horn Drill',      mouth: 'mandibles', vocal: 'Carapace Drum', gaze: 'Shell Flash',    hide: 'Carapace',        move: 'Charge',       ground: 'Shell Quake',    stare: false },
  spider:   { weapon: 'Fangs',       strike: 'Fang Stab',       heavy: 'Eight-Leg Pin',    pierce: 'Hollow Fangs',    mouth: 'fangs',     vocal: 'Leg Chitter',  gaze: 'Eight-Eye Stare', hide: 'Bristled Exoskeleton', move: 'Scuttle Rush', ground: 'Web Snare',  stare: true },
  crab:     { weapon: 'Pincers',     strike: 'Pincer Snap',     heavy: 'Claw Crush',       pierce: 'Pincer Pierce',   mouth: 'mandibles', vocal: 'Shell Clack',  gaze: 'Stalk-Eye Glare', hide: 'Shell',           move: 'Sidelong Rush', ground: 'Shell Slam',    stare: true },
  hound:    { weapon: 'Fangs',       strike: 'Fang Lunge',      heavy: 'Jaw Clamp',        pierce: 'Rending Fangs',   mouth: 'jaws',      vocal: 'Howl',         gaze: 'Hunting Stare',   hide: 'Thick Pelt',      move: 'Charge',       ground: 'Pack Sweep',     stare: true },
  wraith:   { weapon: 'Grasp',       strike: 'Spectral Grasp',  heavy: 'Soul Wrench',      pierce: 'Phantom Claw',    mouth: null,        vocal: 'Wail',         gaze: 'Death Gaze',      hide: 'Ectoplasm',       move: 'Phase Rush',   ground: 'Spectral Surge', stare: true },
  crow:     { weapon: 'Beak',        strike: 'Beak Stab',       heavy: 'Talon Dive',       pierce: 'Beak Pierce',     mouth: 'beak',      vocal: 'Caw',          gaze: 'Carrion Stare',   hide: 'Feathers',        move: 'Dive',         ground: 'Wing Gust',      stare: true },
  wolf:     { weapon: 'Fangs',       strike: 'Fang Lunge',      heavy: 'Jaw Clamp',        pierce: 'Rending Fangs',   mouth: 'jaws',      vocal: 'Howl',         gaze: 'Alpha Stare',     hide: 'Thick Fur',       move: 'Pounce',       ground: 'Pack Sweep',     stare: true },
  bear:     { weapon: 'Claws',       strike: 'Claw Swipe',      heavy: 'Crushing Hug',     pierce: 'Hooked Claws',    mouth: 'jaws',      vocal: 'Roar',         gaze: 'Rearing Glare',   hide: 'Thick Hide',      move: 'Charge',       ground: 'Ground Slam',    stare: true },
  eater:    { weapon: 'Maw',         strike: 'Maw Chomp',       heavy: 'Gullet Slam',      pierce: 'Tooth Row',       mouth: 'maw',       vocal: 'Gurgle',       gaze: 'Hungry Stare',    hide: 'Bloated Flesh',   move: 'Lurch',        ground: 'Flesh Quake',    stare: true },
  crawler:  { weapon: 'Mandibles',   strike: 'Mandible Snap',   heavy: 'Leg Pin',          pierce: 'Mandible Pierce', mouth: 'mandibles', vocal: 'Chitter',      gaze: 'Antenna Twitch',  hide: 'Carapace',        move: 'Scuttle Rush', ground: 'Leg Storm',      stare: false },
  yeti:     { weapon: 'Fists',       strike: 'Fist Smash',      heavy: 'Boulder Hurl',     pierce: 'Ice-Clawed Fist', mouth: 'jaws',      vocal: 'Bellow',       gaze: 'Frosted Glare',   hide: 'Shaggy Fur',      move: 'Rampage',      ground: 'Ground Pound',   stare: true },
  mutant:   { weapon: 'Claws',       strike: 'Claw Slash',      heavy: 'Club Smash',       pierce: 'Jagged Claws',    mouth: 'teeth',     vocal: 'Shriek',       gaze: 'Mad Glare',       hide: 'Warty Hide',      move: 'Lunge',        ground: 'Ground Slam',    stare: true },
  knight:   { weapon: 'Blade',       strike: 'Blade Cut',       heavy: 'Shield Bash',      pierce: 'Blade Thrust',    mouth: null,        vocal: 'Hollow Toll',  gaze: 'Visor Stare',     hide: 'Hollow Plate',    move: 'Charge',       ground: 'Blade Sweep',    stare: true },
  ghoul:    { weapon: 'Claws',       strike: 'Claw Rake',       heavy: 'Grave Grip',       pierce: 'Rotten Claws',    mouth: 'teeth',     vocal: 'Moan',         gaze: 'Dead Stare',      hide: 'Cold Flesh',      move: 'Lurch',        ground: 'Grave Sweep',    stare: true },
  drake:    { weapon: 'Talons',      strike: 'Talon Rake',      heavy: 'Tail Lash',        pierce: 'Talon Pierce',    mouth: 'jaws',      vocal: 'Drake Roar',   gaze: 'Smouldering Gaze', hide: 'Drake Scales',   move: 'Dive',         ground: 'Wing Storm',     stare: true },
  golem:    { weapon: 'Fists',       strike: 'Fist Smash',      heavy: 'Boulder Fist',     pierce: 'Stone Spike',     mouth: null,        vocal: 'Grinding Rumble', gaze: 'Rune-Eye Glow', hide: 'Stone Body',     move: 'Rampage',      ground: 'Earthshaker Stomp', stare: true },
  scorpion: { weapon: 'Stinger',     strike: 'Stinger Jab',     heavy: 'Pincer Crush',     pierce: 'Stinger Pierce',  mouth: 'mandibles', vocal: 'Carapace Rattle', gaze: 'Lidless Stare', hide: 'Carapace',       move: 'Scuttle Rush', ground: 'Tail Sweep',     stare: true },
  titan:    { weapon: 'Fists',       strike: 'Fist Smash',      heavy: 'Avalanche Slam',   pierce: 'Knuckle Spike',   mouth: null,        vocal: 'Bellow',       gaze: 'Towering Shadow', hide: 'Mud Bulk',        move: 'Rampage',      ground: 'Earthshaker Stomp', stare: false },
  rat:      { weapon: 'Teeth',       strike: 'Gnawing Bite',    heavy: 'Swarm Pile',       pierce: 'Chisel Teeth',    mouth: 'teeth',     vocal: 'Squeal',       gaze: 'Beady Stare',     hide: 'Mangy Fur',       move: 'Swarm Rush',   ground: 'Swarm Sweep',    stare: true },
  worm:     { weapon: 'Maw',         strike: 'Maw Chomp',       heavy: 'Body Slam',        pierce: 'Tooth Ring',      mouth: 'maw',       vocal: 'Subsonic Rumble', gaze: 'Blind Tremor-Sense', hide: 'Segmented Hide', move: 'Burrow Strike', ground: 'Tremor',    stare: false },
  hydra:    { weapon: 'Heads',       strike: 'Multi-Head Bite', heavy: 'Neck Slam',        pierce: 'Triple Fang',     mouth: 'heads',     vocal: 'Chorus Hiss',  gaze: 'Many-Eyed Stare', hide: 'Regrowing Scales', move: 'Slither Rush', ground: 'Tail Sweep',   stare: true },
  troll:    { weapon: 'Club Arm',    strike: 'Club Smash',      heavy: 'Overhead Crush',   pierce: 'Jagged Club',     mouth: 'jaws',      vocal: 'Bellow',       gaze: 'Dim Glare',       hide: 'Regenerating Hide', move: 'Rampage',    ground: 'Ground Pound',   stare: true },
  hawk:     { weapon: 'Talons',      strike: 'Talon Strike',    heavy: 'Diving Talons',    pierce: 'Beak Pierce',     mouth: 'beak',      vocal: 'Shriek',       gaze: 'Hawk Eye',        hide: 'Feathers',        move: 'Dive',         ground: 'Wing Gust',      stare: true },
  ape:      { weapon: 'Fists',       strike: 'Fist Smash',      heavy: 'Arm Swing',        pierce: 'Knuckle Spike',   mouth: 'jaws',      vocal: 'Chest-Beat Roar', gaze: 'Alpha Glare',  hide: 'Thick Fur',       move: 'Rampage',      ground: 'Ground Pound',   stare: true },
  lizard:   { weapon: 'Tail',        strike: 'Tail Whip',       heavy: 'Jaw Clamp',        pierce: 'Hooked Claws',    mouth: 'jaws',      vocal: 'Hiss',         gaze: 'Lidless Stare',   hide: 'Scales',          move: 'Lunge',        ground: 'Tail Sweep',     stare: true },
  moth:     { weapon: 'Wing Dust',   strike: 'Dust Burst',      heavy: 'Wing Slam',        pierce: 'Proboscis Spike', mouth: 'proboscis', vocal: 'Wing Thrum',   gaze: 'Hypnotic Dust',   hide: 'Dust-Coated Wings', move: 'Flutter Rush', ground: 'Wing Gust',    stare: false },
  hybrid:   { weapon: 'Claws',       strike: 'Claw Rake',       heavy: 'Jaw Clamp',        pierce: 'Hooked Claws',    mouth: 'jaws',      vocal: 'Howl',         gaze: 'Alpha Stare',     hide: 'Thick Fur',       move: 'Pounce',       ground: 'Pack Sweep',     stare: true },
};
const DEFAULT_ANATOMY = ANATOMY.hybrid;

const WEAPON_TIERS = [
  { level: 1,  prefix: '',        bonus: 12 },
  { level: 10, prefix: 'Honed',   bonus: 18 },
  { level: 20, prefix: 'Savage',  bonus: 26 },
  { level: 30, prefix: 'Brutal',  bonus: 34 },
  { level: 40, prefix: 'Abyssal', bonus: 42 },
  { level: 50, prefix: 'Apex',    bonus: 52 },
];

function words(name) { return String(name || '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean); }
function elementOf(variantName) { for (const w of words(variantName)) if (ELEMENT_BY_WORD[w]) return ELEMENT_BY_WORD[w]; return 'beast'; }
function creatureOf(variantName) { const ws = words(variantName); for (let i = ws.length - 1; i >= 0; i--) if (ANATOMY[ws[i]]) return ws[i]; return 'hybrid'; }
function anatomyOf(variantName) { return ANATOMY[creatureOf(variantName)] || DEFAULT_ANATOMY; }

function kit(variantName) {
  const v = String(variantName || 'Monster').trim() || 'Monster';
  const el = elementOf(v); const E = ELEMENT[el]; const a = anatomyOf(v);
  const weapons = WEAPON_TIERS.map(t => ({ level: t.level, name: `${t.prefix ? t.prefix + ' ' : ''}${v} ${a.weapon}`, bonus: t.bonus }));
  return { variant: v, element: el, status: E.status, emoji: E.emoji, creature: creatureOf(v), anatomy: a, natural: a.weapon, weapons };
}
function weaponDef(variantName) { const k = kit(variantName); return { weapon: k.weapons[0], levelWeapons: k.weapons.slice(1) }; }
// Push #103b: abnormalities have NO dedicated weapon — their gift (fangs, claws, fists…) grows with every level.
function naturalBonus(level) { const L = Math.max(1, Number(level) || 1); return Math.round(10 + L * 1.4); }   // Lv1 11 · Lv25 45 · Lv50 80 · Lv100 150
function naturalWeapon(variantName, level) { const k = kit(variantName); return { level: 1, name: `${k.variant} ${k.natural}`, bonus: naturalBonus(level), natural: true, part: k.natural }; }
function naturalDef(variantName, level) { return { weapon: naturalWeapon(variantName, level), levelWeapons: [] }; }

// ── Roster: the 26 Monster spec slots, re-bodied for this variant ──────────
// Mechanics text keeps the spec's numbers; body words come from the anatomy.
function rosterSpec(variantName) {
  const k = kit(variantName); const a = k.anatomy; const V = k.variant; const st = k.status; const E = ELEMENT[k.element];
  const bite = a.mouth; // null → cannot bite
  const biteName = bite ? (bite === 'heads' ? 'Hydra Maw' : bite === 'beak' ? 'Beak Tear' : bite === 'proboscis' ? 'Proboscis Drain' : bite === 'mandibles' ? 'Mandible Crush' : bite === 'gullet' ? 'Swallow Whole' : bite === 'teeth' ? 'Gnashing Bite' : 'Apex Bite') : (a.weapon === 'Grasp' ? 'Soul Sip' : 'Grinding Press');
  const biteVerb = { mandibles: 'Crushing mandible grip', proboscis: 'Piercing proboscis draw', beak: 'Tearing beak strike', gullet: 'Swallowing gulp', heads: 'Devouring many-headed bite', teeth: 'Gnashing bite' }[bite] || 'Devouring bite';
  const biteText = bite ? `${biteVerb} with its ${bite} dealing 230% ATK with lifesteal.` : (a.weapon === 'Grasp' ? `Spectral grasp drains the target for 230% ATK with lifesteal — it has no mouth; it feeds on life itself.` : `Crushing press with its ${a.weapon.toLowerCase()} dealing 230% ATK with lifesteal — it has no mouth; it absorbs what it breaks.`);
  const gazeText = a.stare ? `${a.gaze} paralyzes target with fear for 1 turn.` : `${a.gaze} — the creature has no eyes to meet, yet the target is paralyzed with fear for 1 turn.`;
  const coatName = `${E.coat} Assault`;
  const S = (name, emoji, type, text, rank = null) => ({ name: `${V} ${name}`, emoji, type, rank, text });
  return [
    S(a.strike,               '👹', 'damage',  `Savage ${a.strike.toLowerCase()}: 280% ATK, 40% chance to inflict ${st}.`),
    S(a.vocal,                '👺', 'debuff',  `${a.vocal} — target ATK -35%, fills them with primal fear.`),
    S(a.hide,                 '🧬', 'passive', `${a.hide}: reduces all incoming damage by 20%, regenerate {p/4} HP/turn.`),
    S(a.heavy,                '👹', 'damage',  `Heavy ${a.heavy.toLowerCase()} dealing 210% ATK.`),
    S('Feral Rage',           '👺', 'buff',    `ATK +40% and speed +25% for 2 turns.`),
    S('Regenerative Tissue',  '🧬', 'passive', `Restores 5% max HP at the start of every turn.`),
    S(biteName,               '👹', 'damage',  biteText),
    S(a.gaze,                 '👺', 'debuff',  gazeText),
    S('Bristling Guard',      '🧬', 'buff',    `${a.hide} hardens — DEF +40% for 3 turns.`),
    S(`Rampaging ${a.move}`,  '👹', 'damage',  `Forward ${a.move.toLowerCase()} dealing 200% AoE ATK to all enemies.`),
    S('Bloodlust',            '👺', 'passive', `Critical strike damage multiplier +30%.`),
    S('Primal Instinct',      '🧬', 'passive', `Evasion and dodge rate +15%.`),
    S(coatName,               '👹', 'damage',  `${E.word.charAt(0).toUpperCase() + E.word.slice(1)} ${a.pierce.toLowerCase()} dealing 180% ATK plus ${st === 'bleed' || st === 'poison' ? st + ' DoT' : st}.`),
    S(a.ground,               '👺', 'damage',  `${a.ground} dealing 190% AoE ATK to all enemies.`),
    S('Undying Vigor',        '🧬', 'passive', `Prevents fatal damage once, leaving the monster at 1 HP.`),
    S('Rallying Call',        '👹', 'buff',    `${a.vocal} that rallies the pack — party ATK +20% for 2 turns.`),
    S('Armor Render',         '👺', 'damage',  `Armor-piercing ${a.pierce.toLowerCase()} attack dealing 240% ATK.`),
    S('Beastly Resilience',   '🧬', 'passive', `Crowd-control resistance +50%.`),
    S('Apex Predator',        '👹', 'passive', `Damage output +20% against human hunters.`),
    S('Monster Awakening',    '👺', 'passive', `Maximum HP pool permanently increased by 25%.`),
    S('Primal Cataclysm', '👹', 'damage', `Savage multi-strike with its ${a.weapon.toLowerCase()} hitting all opponents for 360% ATK.`, 'B'),
    S('Domain of the Lair',   '👺', 'buff',    `Monster enters frenzied state; ATK doubled and lifesteal +30% for 2 turns.`, 'B'),
    S('Supreme Mutation',     '🧬', 'buff',    `Temporarily evolves, granting massive stat boosts across all attributes for 2 turns.`, 'A'),
    S('Absolute Sanctuary',   '👹', 'buff',    `Thick mutant ${a.hide.toLowerCase()} absorbs 70% of all incoming damage for 2 turns.`, 'A'),
    S('Domain of the Behemoth', '🌌', 'buff',  `Grows to colossal size; attacks hit all targets for 100% bonus damage.`, 'S'),
    S('Giga Genesis',    '👹', 'damage',  `Ultimate primal finisher with its ${a.weapon.toLowerCase()} dealing 580% ATK, executing non-bosses instantly.`, 'S'),
  ];
}

// Generic "<Variant> <OldMove>" → this kit's slot name (live Monsters keep their levels)
const OLD_MOVES = ['Lunge', 'Spit', 'Roar', 'Swipe', 'Thrash', 'Gaze', 'Bite', 'Devour', 'Snare', 'Charge', 'Barrage', 'Howl', 'Sweep', 'Apex Hunt', 'Fury', 'Rend', 'Pounce', 'Maul', 'Ambush', 'Onslaught'];
const OLD_PASSIVES = ['Physiology', 'Pack Instinct', 'Hide', 'Regeneration', 'Evolution', 'Bloodlust', 'Apex Sense', 'Adaptation'];
function translateOldName(variantName, oldName) {
  const V = String(variantName || ''); const n = String(oldName || '');
  if (!n.startsWith(V + ' ')) return null;
  const mv = n.slice(V.length + 1); const spec = rosterSpec(V);
  const actives = spec.filter(s => s.type !== 'passive'), passives = spec.filter(s => s.type === 'passive');
  let i = OLD_MOVES.indexOf(mv); if (i >= 0 && actives[i]) return actives[i].name;
  i = OLD_PASSIVES.indexOf(mv); if (i >= 0 && passives[i]) return passives[i].name;
  return null;
}

module.exports = { naturalBonus, naturalWeapon, naturalDef, ANATOMY, ELEMENT, ELEMENT_BY_WORD, WEAPON_TIERS, kit, weaponDef, rosterSpec, elementOf, creatureOf, anatomyOf, translateOldName };
