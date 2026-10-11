// ════════════════════════════════════════════════════════════════════
// TERRAINS — Push #97
// Every gate opens onto one of 20 terrains. The terrain is picked from the
// gate's monster theme (90% of the time the native beasts BELONG there), it
// nudges status-effect odds BOTH ways (burn is hard to light in a snowfield —
// for hunters and beasts alike) and gives beasts standing on home ground a
// little extra bite. No images here — the designers add art later.
// ════════════════════════════════════════════════════════════════════
'use strict';

// statusMods: multiplier on the chance of that status landing (both sides).
// homeBoost: ATK/DEF % for beasts whose family belongs to this terrain.
const TERRAINS = [
  { id: 'cave',         name: 'Cave',               emoji: '🕳️', families: ['insect', 'goblinoid', 'beast'],  desc: 'Low ceilings, dripping stone, no sky.',               statusMods: { blind: 1.5, burn: 0.8 },                 homeBoost: { def: 10 } },
  { id: 'mountain',     name: 'Mountain Pass',      emoji: '⛰️', families: ['beast', 'construct', 'elf'],    desc: 'Thin air and loose rock on a knife-edge trail.',       statusMods: { stun: 1.3, trueslow: 1.3 },              homeBoost: { def: 10 } },
  { id: 'snowfield',    name: 'Snowfield',          emoji: '🌨️', families: ['beast', 'elf', 'undead'],       desc: 'White to the horizon; the cold bites first.',          statusMods: { burn: 0.5, freeze: 1.6, trueslow: 1.3 }, homeBoost: { atk: 8, def: 8 } },
  { id: 'burning_city', name: 'Burning City',       emoji: '🏙️', families: ['demon', 'undead', 'construct'], desc: 'Collapsed towers, ash rain, streets still alight.',    statusMods: { burn: 1.6, freeze: 0.5, blind: 1.2 },    homeBoost: { atk: 12 } },
  { id: 'ruins',        name: 'Ancient Ruins',      emoji: '🏛️', families: ['undead', 'construct', 'elf'],   desc: 'Broken pillars and dead magic humming in the walls.', statusMods: { curse: 1.5, silence: 1.3 },              homeBoost: { def: 12 } },
  { id: 'sewer',        name: 'Sewer Labyrinth',    emoji: '🪠', families: ['slime', 'insect', 'goblinoid'], desc: 'Filth, rust and things that breed in the dark.',       statusMods: { poison: 1.6, burn: 0.6 },                homeBoost: { atk: 10 } },
  { id: 'swamp',        name: 'Rotting Swamp',      emoji: '🐸', families: ['reptile', 'slime', 'insect'],   desc: 'Knee-deep muck; every step is slower than the last.',  statusMods: { poison: 1.5, trueslow: 1.4, burn: 0.6 }, homeBoost: { def: 10 } },
  { id: 'wasteland',    name: 'Toxic Wasteland',    emoji: '☢️', families: ['slime', 'demon', 'insect'],     desc: 'Green haze, dead soil, air that stings.',              statusMods: { poison: 1.7, weaken: 1.2 },              homeBoost: { atk: 10 } },
  { id: 'volcano',      name: 'Volcanic Crater',    emoji: '🌋', families: ['demon', 'reptile', 'construct'], desc: 'Magma veins and heat that cooks the lungs.',          statusMods: { burn: 1.8, freeze: 0.3 },                homeBoost: { atk: 12 } },
  { id: 'forest',       name: 'Deep Forest',        emoji: '🌲', families: ['beast', 'elf', 'insect'],       desc: 'Old trees, no paths, eyes in every shadow.',           statusMods: { poison: 1.2, bleed: 1.2, blind: 1.2 },   homeBoost: { atk: 8, def: 8 } },
  { id: 'desert',       name: 'Scorched Desert',    emoji: '🏜️', families: ['reptile', 'insect', 'construct'], desc: 'Dunes, mirages, nothing to drink.',                 statusMods: { burn: 1.3, blind: 1.4, freeze: 0.5 },    homeBoost: { atk: 10 } },
  { id: 'graveyard',    name: 'Cursed Graveyard',   emoji: '🪦', families: ['undead', 'demon'],              desc: 'Open graves, cold mist, names you recognise.',         statusMods: { curse: 1.7, fear: 1.5, burn: 0.8 },      homeBoost: { atk: 10, def: 10 } },
  { id: 'battlefield',  name: 'Dead Battlefield',   emoji: '⚔️', families: ['undead', 'goblinoid', 'beast'], desc: 'Rusted blades, old bones, carrion birds.',             statusMods: { bleed: 1.5, fear: 1.2 },                 homeBoost: { atk: 10 } },
  { id: 'crystal_cave', name: 'Crystal Cavern',     emoji: '💎', families: ['construct', 'elf', 'slime'],    desc: 'Light splits a thousand ways across the walls.',       statusMods: { blind: 1.6, silence: 1.2 },              homeBoost: { def: 12 } },
  { id: 'abyss',        name: 'Abyssal Rift',       emoji: '🌀', families: ['demon', 'undead'],              desc: 'A wound in the world; gravity is a suggestion.',       statusMods: { fear: 1.6, curse: 1.4, silence: 1.3 },   homeBoost: { atk: 15 } },
  { id: 'coast',        name: 'Storm Coast',        emoji: '🌊', families: ['reptile', 'slime', 'beast'],    desc: 'Black rocks, breaking waves, salt in every cut.',      statusMods: { paralyze: 1.4, burn: 0.6, bleed: 1.2 },  homeBoost: { def: 10 } },
  { id: 'temple',       name: 'Sunken Temple',      emoji: '⛩️', families: ['elf', 'undead', 'construct'],   desc: 'Flooded halls and idols with no faces left.',          statusMods: { silence: 1.6, curse: 1.3, burn: 0.7 },   homeBoost: { def: 12 } },
  { id: 'hive',         name: 'Living Hive',        emoji: '🐝', families: ['insect', 'slime'],              desc: 'The walls pulse. The walls are not walls.',            statusMods: { poison: 1.5, paralyze: 1.4 },            homeBoost: { atk: 10, def: 10 } },
  { id: 'fortress',     name: 'Fallen Fortress',    emoji: '🏰', families: ['goblinoid', 'construct', 'demon'], desc: 'Siege towers, shattered gates, a throne still warm.', statusMods: { stun: 1.3, bleed: 1.2 },               homeBoost: { def: 12 } },
  { id: 'plains',       name: 'Open Plains',        emoji: '🌾', families: ['beast', 'goblinoid', 'elf'],    desc: 'Tall grass and a long sightline — nowhere to hide.',   statusMods: { blind: 0.6, trueslow: 0.7, stun: 1.1 },  homeBoost: { atk: 8 } },
];
const BY_ID = Object.fromEntries(TERRAINS.map(t => [t.id, t]));

function get(id) { return BY_ID[String(id || '').toLowerCase()] || null; }
function all() { return TERRAINS.slice(); }

// Pick a terrain for a gate: 90% one that houses the gate's theme (monsters match), 10% any terrain.
function pickFor(theme, rnd = Math.random) {
  const home = theme ? TERRAINS.filter(t => t.families.includes(theme)) : [];
  if (home.length && rnd() < 0.9) return home[Math.floor(rnd() * home.length)];
  return TERRAINS[Math.floor(rnd() * TERRAINS.length)];
}

// How many of the gate's living beasts belong to the terrain (0–100).
function compatibility(terrain, monsters, familyOf) {
  const t = typeof terrain === 'string' ? get(terrain) : terrain;
  const list = (monsters || []).filter(m => m && !m.elite);
  if (!t || !list.length) return 0;
  let n = 0; for (const m of list) { const f = m.family || (familyOf ? familyOf(m.name) : null); if (f && t.families.includes(f)) n++; }
  return Math.round(n / list.length * 100);
}
function isHome(terrain, monster, familyOf) {
  const t = typeof terrain === 'string' ? get(terrain) : terrain;
  if (!t || !monster) return false;
  const f = monster.family || (familyOf ? familyOf(monster.name) : null);
  return !!(f && t.families.includes(f));
}
// Multiplier on the chance that `statusType` lands on this terrain (1 = unchanged).
function statusMult(terrain, statusType) {
  const t = typeof terrain === 'string' ? get(terrain) : terrain;
  if (!t) return 1;
  const k = String(statusType || '').toLowerCase().replace('trueslow', 'trueslow');
  const m = t.statusMods[k] ?? t.statusMods[k === 'weakness' || k === 'weakened' ? 'weaken' : k];
  return typeof m === 'number' ? m : 1;
}
const _pct = (m) => `${m > 1 ? '+' : ''}${Math.round((m - 1) * 100)}%`;
// The block shown when a raid starts.
function entryText(terrain, monsters, familyOf) {
  const t = typeof terrain === 'string' ? get(terrain) : terrain;
  if (!t) return '';
  const compat = compatibility(t, monsters, familyOf);
  const mods = Object.entries(t.statusMods).map(([k, m]) => `${k} ${_pct(m)}`).join(' · ');
  const boost = Object.entries(t.homeBoost || {}).map(([k, v]) => `+${v}% ${k.toUpperCase()}`).join(' / ');
  return [
    `${t.emoji} *TERRAIN — ${t.name.toUpperCase()}*`,
    `_${t.desc}_`,
    `🐾 Native beasts: ${compat}% of this gate's monsters belong here${compat >= 90 ? ' — their home ground.' : compat >= 50 ? '.' : ' — most of them are out of place.'}`,
    boost ? `📈 Beasts on home ground: ${boost}` : '',
    mods ? `🎲 Status odds here (hunters AND beasts): ${mods}` : '',
  ].filter(Boolean).join('\n');
}

module.exports = { TERRAINS, get, all, pickFor, compatibility, isHome, statusMult, entryText };
