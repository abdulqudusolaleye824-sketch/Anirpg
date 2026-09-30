'use strict';
// ── Push #94: SKILL FLAVOUR GENERATOR ────────────────────────────────────────
// Every one of the ~500 hunter skills gets its own voice. Instead of one
// "X — doctrine of Y" template stamped on 424 skills, a description is built
// from: imagery pulled out of the skill's NAME (fire, bone, arrow, tide…),
// the class's own voice, a structure picked per skill from a pool for its
// TYPE, a tier note (opener / mid / ultimate), and a deterministic hash so the
// same skill always reads the same way — and no two skills read alike.
// SkillCatalog.normalise appends the exact mechanics sentence afterwards.

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function pick(list, seed, salt) { return list[(hash(`${seed}|${salt}`) % list.length)]; }

// ── imagery by keyword in the skill name ────────────────────────────────────
const IMAGERY = [
  [/fire|flame|inferno|blaze|burn|pyro|ember|scorch|magma|lava|meteor|sun|solar/i, ['a roar of living flame', 'heat that blisters the air itself', 'embers that refuse to die', 'a column of fire tall as a gate', 'flame folded a hundred times until it sings']],
  [/ice|frost|freez|glacier|blizzard|snow|cold|winter|chill/i, ['frost that creeps along steel', 'a cold that stops the blood mid-beat', 'ice blooming across the floor', 'a blizzard packed into a single breath', 'winter delivered by hand']],
  [/lightning|thunder|storm|bolt|shock|volt|spark|tempest|electr/i, ['a crack of thunder without a sky', 'lightning that chooses its target', 'static crawling over every blade', 'a storm compressed into one instant', 'white light and then the sound']],
  [/shadow|dark|night|dusk|gloom|umbra|eclipse|black/i, ['shadow poured like ink', 'a darkness that moves before you do', 'the space between torchlight', 'night gathered into a weapon', 'a silhouette that arrives before the strike']],
  [/holy|divine|light|sacred|bless|radiant|angel|heaven|celestial|dawn|halo|grace|god/i, ['light that does not cast shadows', 'a hymn made solid', 'a warmth that judges as it heals', 'radiance the floor cannot hold', 'the kind of light that outlives the fight']],
  [/void|abyss|oblivion|null|rift|cosmos|astral|dimension|phase|nether/i, ['a hole cut in the shape of a wound', 'the quiet of somewhere with no floor', 'space folding the wrong way', 'an absence that hits harder than any weight', 'starlight from a sky that was never there']],
  [/blood|sanguin|hemo|vampir|crimson|gore|bleed|vein/i, ['crimson that answers to its owner', 'a debt paid in blood — theirs first', 'the taste of iron on the wind', 'heartbeat turned into rhythm for the blade', 'blood that remembers every wound']],
  [/bone|death|soul|reap|grave|necro|skull|spirit|ghost|phantom|wraith|undead|corpse|tomb|curse|hex|ruin/i, ['a whisper from below the floor', 'bones that remember how to stand', 'a chill that belongs to the dead', 'the weight of every soul this gate has taken', 'a curse spoken in a language the monster understands']],
  [/arrow|shot|bow|volley|snipe|aim|pierce|quiver|barrage|rain/i, ['a shaft loosed before the breath ends', 'fletching humming in the dark', 'an arc drawn once and never missed', 'the pause between draw and release', 'a line from eye to heart']],
  [/blade|slash|sword|cut|edge|cleave|rend|sever|katana|steel|scythe|dagger|knife|strike/i, ['steel that hums before it bites', 'one cut where a hundred would be noise', 'an edge honed on the last floor', 'the flash you see after it lands', 'a line of light and a falling shape']],
  [/shield|wall|guard|bastion|aegis|bulwark|fortress|iron|armor|armour|barrier|ward|stand|defen/i, ['a wall that does not ask permission', 'iron set between the party and the dark', 'a stance nothing has yet moved', 'plates ringing like bells under the blow', 'the promise that the line holds']],
  [/heal|mend|renew|cure|restor|revive|resurrect|rebirth|serum|grace|sanctuary|touch|life|regen|bloom|remedy/i, ['breath pulled back into a chest', 'wounds closing like eyes at rest', 'the ache draining out of a body', 'warmth that starts at the wound and spreads', 'a second chance handed over without ceremony']],
  [/dragon|wyrm|drake|scale|wing|fang|claw|beast|wolf|howl|roar|feral|primal|savage|maul|bite|rampage|hunt/i, ['a shape too big for the corridor', 'teeth that were never meant for words', 'a growl felt in the floor before it is heard', 'the old law: the hunter eats', 'muscle and instinct fired at once']],
  [/time|clock|chrono|rewind|epoch|hour|moment|temporal|paradox|stasis|aeon|era/i, ['a second that refuses to end', 'the hands of the clock pulled backwards', 'the future arriving a beat early', 'a moment borrowed and never returned', 'the fight rewritten between two heartbeats']],
  [/poison|venom|toxic|plague|rot|decay|blight|corros|acid|spore/i, ['a green that spreads on its own', 'a wound that keeps the fight going after you leave', 'rot working faster than fear', 'venom patient enough to wait', 'a slow answer to a fast enemy']],
  [/wind|gale|gust|zephyr|cyclone|tornado|air|breeze|sky|hurricane/i, ['air sharpened into a blade', 'a gust that takes the footing first', 'the sky leaning in', 'wind that carries the strike further than the arm', 'pressure dropping right before impact']],
  [/earth|stone|rock|quake|mountain|boulder|terra|crag|tremor|gravel|sand/i, ['the floor remembering it is a mountain', 'stone answering stone', 'a tremor that starts in the heels', 'weight that arrives all at once', 'gravel and dust and a monster off its feet']],
  [/water|tide|wave|ocean|sea|flood|torrent|rain|mist|current|drown/i, ['a tide with nowhere else to go', 'water that hits like a wall', 'the pull of a current under the feet', 'a wave that has been waiting all floor', 'the cold weight of the deep']],
  [/rune|arcane|mana|spell|magic|sigil|glyph|enchant|mystic|aether|ether|cosmic|star/i, ['runes lit one after another', 'mana drawn tight as wire', 'a sigil burning in the air a moment too long', 'arithmetic the monster cannot follow', 'a spell rehearsed a thousand times in silence']],
  [/fist|palm|chi|kick|strike|monk|body|iron body|combo|flurry|punch|knuckle/i, ['knuckles that have forgotten how to miss', 'breath, weight, and then contact', 'a stance older than the gate', 'a palm that lands like a closed door', 'discipline released all at once']],
  [/summon|call|totem|familiar|spirit|elemental|golem|beast|pact|conjur/i, ['a name spoken and something answering', 'a shape stepping out of nowhere', 'the pact honoured one more time', 'company that does not need to be fed', 'help that arrives from the wrong direction for the monster']],
  [/dance|step|rhythm|shadowstep|flicker|blur|vanish|stealth|veil|mirage|illusion|phantom|ghostwalk/i, ['footwork that erases the footprint', 'a blur where a hunter was standing', 'rhythm the monster cannot read', 'a step taken slightly outside the fight', 'here, then not, then behind']],
  [/war|siege|march|banner|command|rally|shout|cry|charge|legion|conquer|dominion|throne|king|emperor|lord/i, ['a voice the whole line moves to', 'boots hitting the floor in one beat', 'the banner going forward first', 'orders that turn a party into an army', 'the sound a charge makes before it connects']],
  [/devour|feast|hunger|consume|gorge|maw|swallow|eat|glutton/i, ['a hunger that does the fighting', 'jaws that make the argument', 'a meal that has not stopped struggling', 'appetite as a battle plan', 'nothing wasted, nothing left']],
  [/serum|prototype|exosuit|alchem|science|formula|reaction|catalyst|engine|billion|invention|lab/i, ['ten billion percent of a good idea', 'chemistry doing what courage cannot', 'a formula tested on the way down the stairs', 'gears, glass, and a very confident grin', 'science arriving right on schedule']],
];
const FALLBACK_IMAGERY = ['a technique drilled until it needs no thought', 'the kind of move that ends arguments', 'timing, weight, and intent in one motion', 'a shape the monster has not seen before', 'the practised violence of a working hunter'];

function imageryFor(name, className, seed) {
  const pools = [];
  for (const [re, pool] of IMAGERY) if (re.test(name)) pools.push(pool);
  if (!pools.length) for (const [re, pool] of IMAGERY) if (re.test(className)) pools.push(pool);
  if (!pools.length) pools.push(FALLBACK_IMAGERY);
  const pool = pools[hash(seed + '|pool') % pools.length];
  return pick(pool, seed, 'img');
}

// ── class voice ─────────────────────────────────────────────────────────────
const CLASS_VOICE = {
  Warrior: 'the Warrior way: forward, and then further forward',
  Mage: 'a Mage\'s answer — mana spent like it can be earned back',
  Archer: 'an Archer\'s patience turned into a point',
  Assassin: 'an Assassin\'s rule: they should not see it',
  Healer: 'a Healer\'s wager that the party is worth the toll',
  Paladin: 'a Paladin\'s oath, made physical',
  Knight: 'a Knight\'s duty to stand where it is worst',
  Monk: 'a Monk\'s breath, kept and then released',
  Rogue: 'a Rogue\'s trade — the fight the enemy did not agree to',
  Shaman: 'a Shaman\'s bargain with things older than the gate',
  Warlord: 'a Warlord\'s conviction that the line is a weapon',
  BloodKnight: 'a Blood Knight\'s ledger, paid in red',
  Elementalist: 'an Elementalist\'s command over what the world is made of',
  Necromancer: 'a Necromancer\'s reminder that nothing in a gate stays buried',
  Ranger: 'a Ranger\'s knowledge of where the monster will be, not where it is',
  SpellBlade: 'a Spellblade\'s refusal to choose between steel and spell',
  DragonKnight: 'a Dragon Knight\'s borrowed fire, freely spent',
  ShadowDancer: 'a Shadow Dancer\'s footwork — the fight as choreography',
  Summoner: 'a Summoner\'s habit of never fighting alone',
  Berserker: 'a Berserker\'s arithmetic: pain in, damage out',
  Chronomancer: 'a Chronomancer\'s quiet edits to the order of things',
  Devourer: 'a Devourer\'s appetite doing the thinking',
  Phantom: 'a Phantom\'s half-presence — hard to hit, harder to hold',
  Senku: 'Senku\'s certainty that the fight is just a problem with a solution',
  Monster: 'the raw physics of a monster wearing a hunter\'s licence',
};

// ── sentence structures by type ({N}=name {I}=imagery {V}=class voice {C}=class) ─
const OPENERS = {
  damage: [
    '{N} lands as {I}. {V|cap}.',
    'When a {C} calls {N}, the monster meets {I}.',
    '{I|cap} — that is {N}, and it is {V}.',
    '{N}: {I}, delivered without ceremony. {V|cap}.',
    'There is a moment before {N} connects that feels like {I}. Then it connects.',
    'A {C} saves {N} for the opening that matters — {I}, once.',
    '{N} is what a {C} means by hitting hard: {I}.',
    'Ask any hunter who has stood next to a {C} using {N}: {I}, and a quieter corridor.',
  ],
  buff: [
    '{N} is set up before the exchange — {I}, worn like armour. {V|cap}.',
    'Before the trade, a {C} casts {N}: {I}, and the numbers change in their favour.',
    '{N} does not strike; it prepares. {I|cap}, then the real work. {V|cap}.',
    'A {C} who opens with {N} carries {I} into every hit that follows.',
    '{I|cap} — {N} is that promise, held for a few turns. {V|cap}.',
    '{N} turns the party\'s footing into a weapon: {I}, shared with whoever stands close.',
    'Cast {N} early. {I|cap} lasts only a few turns, and every one of them counts.',
    'Priming move. {N} is {I}, and {V}.',
  ],
  heal: [
    '{N} is {I}. Pain leaves; the fight stays. {V|cap}.',
    'A {C} spends {N} on whoever is closest to falling — {I}, and a heartbeat regained.',
    '{N}: {I}, at a price the caster pays so someone else does not.',
    'When the line starts to buckle, {N} answers with {I}. {V|cap}.',
    'Recovery, not retreat. {N} is {I} and a reason to keep swinging.',
    '{N} closes wounds the way {I} would — quietly, completely, and just in time.',
    'Every raid has the turn where {N} matters: {I}, and nobody falls.',
    '{I|cap}. That is what {N} feels like from the inside. {V|cap}.',
  ],
  debuff: [
    '{N} does not need to kill — it needs to weaken. {I|cap}, and the monster is less than it was.',
    'A {C} lays {N} on a target like {I}: a burden it will carry every turn after.',
    '{N} is {I}, working on the enemy long after the cast. {V|cap}.',
    'Land {N} first and the rest of the party fights something slower, softer, smaller: {I}.',
    '{I|cap} — {N} leaves that on the monster and lets time do the rest.',
    'Not every strike is a strike. {N} is {I}, and a fight tipped before it starts.',
  ],
  passive: [
    '{N} is always on — {I}, humming beneath every action a {C} takes.',
    'No cast, no cost. {N} is simply how a {C} is built: {I}.',
    'A {C} does not activate {N}; they are {N}. {I|cap}, all the time.',
    '{N} sits under the skin — {I}, working whether the hunter notices or not.',
    'Passive by nature, constant by design: {N} is {I}. {V|cap}.',
    'Some strength is not a move. {N} is {I}, and it never switches off.',
  ],
};

const TIER_NOTES = {
  opener: ['A first-floor tool that stays useful all the way up.', 'Cheap, quick, and worth keeping on the bar.', 'The move new hunters lean on and veterans never quite drop.', 'Low commitment, honest return.', 'Simple enough to trust; strong enough to matter.'],
  mid: ['Mid-climb, this is where a run is won or lost.', 'Costs real energy — spend it on a real target.', 'A committed move; make sure the party is ready for what follows.', 'The turn you pick this is the turn the floor turns.', 'Bread and butter for a hunter who has stopped guessing.'],
  late: ['Late-roster strength: expensive, decisive, rarely wasted.', 'By the time a hunter unlocks this, they know exactly when to spend it.', 'A boss-floor answer. Do not open with it; end with it.', 'Heavy on energy, heavier on the monster.', 'Save it for the elite, the boss, or the moment the healer goes quiet.'],
  ultimate: ['Capstone of the roster — the move the whole class builds toward.', 'A pinnacle technique; there is nothing above it on this path.', 'The last thing a boss sees from this class.', 'Endgame power with an endgame price tag.', 'Unlocked at the top of the climb, and it shows.'],
};

function tierOf(index, total) {
  const q = total > 1 ? index / (total - 1) : 1;
  if (index === total - 1) return 'ultimate';
  if (q < 0.3) return 'opener';
  if (q < 0.7) return 'mid';
  return 'late';
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function fill(tpl, ctx) {
  const out = tpl.replace(/\{(N|I|V|C)(\|cap)?\}/g, (_, k, c) => {
    const v = { N: ctx.name, I: ctx.imagery, V: ctx.voice, C: ctx.classLabel }[k] || '';
    return c ? cap(v) : v;
  });
  // "a Assassin" → "an Assassin" (article agreement after substitution)
  return out.replace(/\b(a|A) ([AEIOUaeiou])/g, (_, a, ch) => `${a}n ${ch}`);
}

// Public: build the flavour text (no mechanics) for a skill.
function flavourFor({ className, name, type, index = 0, total = 20 }) {
  const seed = `${className}|${name}|${index}`;
  const t = ['damage', 'buff', 'heal', 'debuff', 'passive'].includes(String(type)) ? String(type) : 'damage';
  const imagery = imageryFor(name, className, seed);
  const voice = CLASS_VOICE[className] || `the ${className} way`;
  const classLabel = className === 'BloodKnight' ? 'Blood Knight' : className === 'SpellBlade' ? 'Spellblade' : className === 'DragonKnight' ? 'Dragon Knight' : className === 'ShadowDancer' ? 'Shadow Dancer' : className;
  const opener = fill(pick(OPENERS[t], seed, 'open'), { name, imagery, voice, classLabel });
  const note = pick(TIER_NOTES[tierOf(index, total)], seed, 'tier');
  return `${opener} ${note}`;
}

module.exports = { flavourFor, imageryFor, IMAGERY, CLASS_VOICE, OPENERS, TIER_NOTES, hash };
