// ═══════════════════════════════════════════════════════════════
// MonsterVariantKits — Push #92
// Every one of the 50 Monster variants gets its OWN skill roster and its OWN
// natural-weapon ladder (no more shared "Primal Strike" / "Primal Claws").
//   • Skill names: "<Variant> <Move>" (unique per variant); the variant's
//     element rewrites the roster's bleed procs (fire → burn, ice → freeze,
//     storm → stun, venom → poison, void → curse, earth → weaken, beast → bleed).
//   • Weapon ladder: Lv1 free "<Variant> <Natural weapon>", then Honed/Savage/
//     Brutal/Abyssal/Apex tiers at Lv10/20/30/40/50 (bought — see ClassPower).
// ═══════════════════════════════════════════════════════════════
'use strict';

const ELEMENT_BY_WORD = {
  ember: 'fire', lava: 'fire', magma: 'fire', infernal: 'fire', ash: 'fire',
  acid: 'venom', toxic: 'venom', venom: 'venom', plague: 'venom', decay: 'venom',
  frost: 'ice', ice: 'ice',
  thunder: 'storm', storm: 'storm',
  void: 'void', abyssal: 'void', shadow: 'void', spectral: 'void', dusk: 'void', hollow: 'void', death: 'void', chaos: 'void',
  stone: 'earth', iron: 'earth', mud: 'earth', sand: 'earth', crystal: 'earth', bone: 'earth',
};
const ELEMENT = {
  fire:  { status: 'burn',   adj: 'Searing',  emoji: '🔥' },
  venom: { status: 'poison', adj: 'Virulent', emoji: '☠️' },
  ice:   { status: 'freeze', adj: 'Glacial',  emoji: '❄️' },
  storm: { status: 'stun',   adj: 'Crackling',emoji: '⚡' },
  void:  { status: 'curse',  adj: 'Umbral',   emoji: '🌑' },
  earth: { status: 'weaken', adj: 'Crushing', emoji: '🪨' },
  beast: { status: 'bleed',  adj: 'Feral',    emoji: '🩸' },
};
const WEAPON_BY_CREATURE = {
  shark: 'Jaws', mantis: 'Scythe Arms', toad: 'Tongue Lash', serpent: 'Fangs', bat: 'Wing Claws', colossus: 'Fists',
  dragon: 'Talons', stalker: 'Claws', beetle: 'Horn', spider: 'Fangs', crab: 'Pincers', hound: 'Fangs', wraith: 'Grasp',
  crow: 'Beak', wolf: 'Fangs', bear: 'Claws', eater: 'Maw', crawler: 'Mandibles', yeti: 'Fists', mutant: 'Claws',
  knight: 'Blade', ghoul: 'Claws', drake: 'Talons', golem: 'Fists', scorpion: 'Stinger', titan: 'Fists', rat: 'Teeth',
  worm: 'Maw', hydra: 'Heads', troll: 'Club Arm', hawk: 'Talons', ape: 'Fists', lizard: 'Tail', moth: 'Wing Dust', hybrid: 'Claws',
};
const WEAPON_TIERS = [
  { level: 1,  prefix: '',        bonus: 12 },
  { level: 10, prefix: 'Honed',   bonus: 18 },
  { level: 20, prefix: 'Savage',  bonus: 26 },
  { level: 30, prefix: 'Brutal',  bonus: 34 },
  { level: 40, prefix: 'Abyssal', bonus: 42 },
  { level: 50, prefix: 'Apex',    bonus: 52 },
];
// One move word per roster slot (matches the 20-slot Monster template order).
const MOVES = ['Lunge', 'Spit', 'Roar', 'Swipe', 'Thrash', 'Gaze', 'Bite', 'Devour', 'Snare', 'Charge',
               'Barrage', 'Howl', 'Sweep', 'Apex Hunt', 'Fury', 'Rend', 'Pounce', 'Maul', 'Ambush', 'Onslaught'];
const PASSIVES = ['Physiology', 'Pack Instinct', 'Hide', 'Regeneration', 'Evolution', 'Bloodlust', 'Apex Sense', 'Adaptation'];

function words(name) { return String(name || '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean); }
function elementOf(variantName) {
  for (const w of words(variantName)) if (ELEMENT_BY_WORD[w]) return ELEMENT_BY_WORD[w];
  return 'beast';
}
function creatureOf(variantName) {
  const ws = words(variantName);
  for (let i = ws.length - 1; i >= 0; i--) if (WEAPON_BY_CREATURE[ws[i]]) return ws[i];
  return ws[ws.length - 1] || 'beast';
}
function kit(variantName) {
  const v = String(variantName || 'Monster').trim() || 'Monster';
  const el = elementOf(v); const E = ELEMENT[el];
  const creature = creatureOf(v);
  const natural = WEAPON_BY_CREATURE[creature] || 'Claws';
  const weapons = WEAPON_TIERS.map(t => ({ level: t.level, name: `${t.prefix ? t.prefix + ' ' : ''}${v} ${natural}`, bonus: t.bonus }));
  return { variant: v, element: el, status: E.status, adj: E.adj, emoji: E.emoji, creature, natural, weapons,
           skillName: (i, passive = false) => `${v} ${passive ? PASSIVES[i % PASSIVES.length] : MOVES[i % MOVES.length]}` };
}
// Rewrite one generic Monster roster entry for this variant (name + element proc).
function reskin(entry, variantName, index, passive = false) {
  const k = kit(variantName);
  const out = { ...entry };
  out.name = k.skillName(index, passive);
  out.variant = k.variant;
  const swap = (t) => String(t || '').replace(/\bbleed\b/gi, k.status);
  if (k.status !== 'bleed') { out.effect = swap(out.effect); if (out.description) out.description = swap(out.description); }
  out.description = `${k.emoji} ${k.variant} technique — ${String(out.description || out.effect || '').replace(/^[^\w]*/, '')}`;
  return out;
}
// Weapon ladder in PlayerManager classDefinitions shape.
function weaponDef(variantName) {
  const k = kit(variantName);
  return { weapon: k.weapons[0], levelWeapons: k.weapons.slice(1) };
}

module.exports = { PASSIVES, ELEMENT, ELEMENT_BY_WORD, WEAPON_BY_CREATURE, WEAPON_TIERS, MOVES, kit, reskin, weaponDef, elementOf, creatureOf };
