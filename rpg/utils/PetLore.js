// ═══════════════════════════════════════════════════════════════
// Push #55 — Pet lore & origins.
//
// Every pet in PetDatabase now carries a written origin (where it comes
// from in this world) and lore (what hunters know about it). Unknown or
// future pets fall back to a type/role-derived entry so nothing ever
// renders an empty lore card.
// ═══════════════════════════════════════════════════════════════
'use strict';

const LORE = {
  slime_pup: {
    origin: 'Condensed gate-mana that pooled on dungeon floors until it grew a will of its own. The first "monster" anyone ever tamed.',
    lore: 'A Slime Pup imprints on whoever feeds it first and will defend that bond with its life — which is exactly why dungeon hunters started stealing them from monster nests. It has no bones, so a killing blow simply splits it in two; both halves come back angrier.',
  },
  flame_fox: {
    origin: 'Born in the ash plains behind C-Rank fire gates, where the ground stays hot decades after the gate closes.',
    lore: 'Flame Foxes hunt in pairs and burn a ring around their prey before striking. Hunters who keep one report that it sleeps facing the door, always. Its fur is fireproof, and the coat of a well-kept fox is worth more than a D-Rank weapon.',
  },
  shadow_wolf: {
    origin: 'A pack hunter from the dark strata of Shadow Gates — the floors light magic will not reach.',
    lore: 'A Shadow Wolf moves through a caster\'s shadow rather than its own, which is why it appears to teleport mid-fight. They bind to a single master; kill the wolf and the shadow it occupied collapses, taking a piece of the caster\'s night with it.',
  },
  lightning_drake: {
    origin: 'Hatched from eggs laid on the wreckage of gates struck by their own collapsing mana storms.',
    lore: 'A Lightning Drake stores charge in its scales and discharges it through the first metal it touches — usually its master\'s armour, once, until it learns better. Rank-A hunters prize them because a drake can jump-start a dead mana device.',
  },
  forest_sprite: {
    origin: 'Old-growth mana that remembered a shape when a gate swallowed a whole woodland.',
    lore: 'Forest Sprites cannot fight, and they do not care to. They mend: sap in the wounds, moss over the burns. A party with a sprite in its back line can stay three floors longer than one without, and healers know exactly which of them to befriend.',
  },
  wind_fairy: {
    origin: 'Compressed air currents given opinion by leaking gate mana.',
    lore: 'Wind Fairies carry messages, scout ahead, and steal things that are not tied down. They are fiercely competitive about speed and will abandon a hunter who walks instead of runs. Their chatter before a storm is the most reliable gate-weather forecast there is.',
  },
  crystal_phoenix: {
    origin: 'Said to be a Flame Fox that survived its own gate\'s self-immolation and came out the other side refracted.',
    lore: 'A Crystal Phoenix dies on schedule — every few years, in front of whoever is unlucky enough to be holding it — and returns from its own ash within a minute, hotter and whiter. Sacrificing one for your life is not a myth; it is simply the most expensive rescue in the guild market.',
  },
  mud_crawler: {
    origin: 'Bottom-feeders of the flooded lower floors; they eat what a dungeon discards.',
    lore: 'A Mud Crawler will find the loot a party missed, the key a monster swallowed, and the exit nobody mapped. They smell mana residue at extraordinary range and are worthless in a straight fight, which is why the smartest raiders carry one and the proud ones don\'t.',
  },
  void_bat: {
    origin: 'Something that was in the gate before the gate was in the world.',
    lore: 'A Void Bat eats light in a small sphere around itself, which makes it the only pet that can hide a party from a monster that hunts by sight. It also means the hunter never sees the bat. It is always there.',
  },
  stone_golem_baby: {
    origin: 'A chip broken off a Gate Guardian, still warm, still listening for orders.',
    lore: 'Stone Golem Babies are effectively a second shield: they stand in front of their keeper and do not move until they crumble. Raising one takes years and a great deal of gravel — hunters call it "the patient pet", because you must be.',
  },
  king_slime: {
    origin: 'What a Slime Pup becomes once it has eaten every other slime in its nest.',
    lore: 'A King Slime wears a crown of compressed mana that it forged itself, and every lesser slime within earshot obeys it. Guilds have lost entire E-Rank clears because a King Slime on the enemy side told the local monsters exactly where the party was.',
  },
  nine_tail_fox: {
    origin: 'Nine Flame Foxes that died together in one gate and refused to leave separately.',
    lore: 'Each tail holds one of those deaths, and a nine-tailed fox can spend one of them to undo a wound. It will do this for you, once per tail, per season, and then it expects to be fed properly. Fox-fire burns even things that have no body.',
  },
  ancient_treant: {
    origin: 'A tree ring counted ten thousand times before the gate closed around it.',
    lore: 'An Ancient Treant is a fortress that breathes. Its sap seals wounds, its roots hold a floor you are defending, and it will not obey a hunter who cannot name it. Support pets of this rank remember insult as long as they remember kindness.',
  },
  gold_beetle: {
    origin: 'Dungeon-scavenger of the deepest vault floors, where mana crystallises into coin-shaped ore.',
    lore: 'Gold Beetles dig up paydirt no human can hear, and their shells are used to line guild vaults because mana will not stick to them. A raider with a Gold Beetle leaves a dungeon richer than the loot table says it should be — which is exactly why some guilds tax the pet, not the hunter.',
  },
};

const TYPE_LORE = {
  fire:    { origin: 'A fire-aspected creature of burning gate strata.', lore: 'It burns what it bites and remembers who fed it.' },
  shadow:  { origin: 'A darkness-aspected creature of the unlit floors.', lore: 'It moves where the light is not, and strikes from there.' },
  lightning:{ origin: 'A storm-aspected creature born of collapsing mana.', lore: 'It carries its own charge and discharges through whatever worries it.' },
  nature:  { origin: 'A growth-aspected creature of living dungeon floors.', lore: 'It mends before it fights, if it fights at all.' },
  wind:    { origin: 'An air-aspected creature of gate updrafts.', lore: 'Nothing outruns it, and it resents being walked.' },
  holy:    { origin: 'A sanctified creature that should not exist inside a gate at all.', lore: 'It dies, and it comes back, and it is angrier each time.' },
  earth:   { origin: 'A stone-aspected creature carved by dungeon pressure.', lore: 'It stands in front of what you love and does not move.' },
  basic:   { origin: 'A common gate-born creature — the mana everyone steps over.', lore: 'Simple, loyal, and far tougher than it looks.' },
};

const ROLE_EFFECT = {
  attack:    'Adds ATK/DEF/SPD to you in battle and can strike on its own.',
  support:   'Heals you every combat turn and boosts your defence.',
  scavenger: 'Does not fight — finds extra Nexus and loot after a clear.',
};

function loreOf(petId) {
  const e = LORE[String(petId || '').toLowerCase()];
  if (e) return e;
  const P = require('./PetDatabase');
  const db = P.PET_DATABASE || {};
  const tpl = db[petId] || {};
  const t = TYPE_LORE[tpl.type] || TYPE_LORE.basic;
  return {
    origin: t.origin + (tpl.habitat?.length ? ` Found in: ${tpl.habitat.join(', ')}.` : ''),
    lore: tpl.description || t.lore,
  };
}

/** Full lore card for a pet instance (or a raw database id). */
function render(pet) {
  if (!pet) return '';
  const id = pet.petId || pet.id || pet;
  const P = require('./PetDatabase');
  const tpl = (P.PET_DATABASE || {})[id] || {};
  const name = pet.name || tpl.name || id;
  const role = String(pet.role || tpl.role || 'attack').toLowerCase();
  const l = loreOf(id);
  const lines = [
    `📜 *${name.toUpperCase()} — LORE*`,
    ``,
    `*Origin:* ${l.origin}`,
    ``,
    `*Lore:* ${l.lore}`,
    ``,
    `🎭 *Role:* ${role}${tpl.type ? ` · *Element:* ${tpl.type}` : ''}${tpl.rarity ? ` · *Rarity:* ${tpl.rarity}` : ''}`,
    `⚔️ *In battle:* ${ROLE_EFFECT[role] || ROLE_EFFECT.attack}`,
  ];
  const ab = pet.abilities?.length ? pet.abilities : (tpl.abilities || []);
  if (ab.length) {
    lines.push(``, `✨ *Abilities:*`);
    for (const a of ab.slice(0, 4)) lines.push(`  • ${a.name}${a.desc ? ` — ${a.desc}` : ''}`);
  }
  if (tpl.habitat?.length) lines.push(``, `🗺️ *Habitat:* ${tpl.habitat.join(', ')}`);
  return lines.join('\n');
}

module.exports = { loreOf, render, LORE, ROLE_EFFECT };
