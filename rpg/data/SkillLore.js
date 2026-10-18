// Push #103c: SKILL LORE — every skill gets a VOICE.
//   lore(className, skill, variant) → { lore, cast, tag }
//     lore : 1–2 sentences of flavour in the class's own register (what it feels like to cast / suffer it)
//     cast : the in-combat animation line (what the party sees when it fires)
//     tag  : kind label (DAMAGE / BUFF / DEBUFF / HEAL / PASSIVE / SUMMON)
//   Deterministic: the same skill always reads the same way (hash of class+name picks the template).
//   The spec sentence (numbers) is NEVER replaced — it is shown under the lore as 📜.
'use strict';

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function pick(arr, seed, salt = 0) { return arr[(seed + salt * 7919) % arr.length]; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Class voices ────────────────────────────────────────────────────────────
// weapon: what they fight with · source: where the power comes from · element: imagery nouns
// verbs: strike verbs · aura: how the air changes · cry: battle-cries / murmured lines
const VOICE = {
  Archer:       { weapon: 'bow', source: 'a hunter\'s stillness', element: ['fletched wind', 'a drawn breath', 'the hush before release'], verbs: ['looses', 'threads', 'nocks and releases'], aura: 'the air goes thin and quiet', cry: ['"Breathe out. Release."', '"One arrow is enough."', '"Nowhere to run from the sky."'] },
  Ranger:       { weapon: 'longbow', source: 'the wild itself', element: ['pine-scented wind', 'a predator\'s patience', 'moonlit undergrowth'], verbs: ['looses', 'hurls', 'drives'], aura: 'the forest seems to lean in', cry: ['"The hunt remembers you."', '"Track. Mark. End."', '"Nature keeps no prisoners."'] },
  Knight:       { weapon: 'sword and tower shield', source: 'an oath carved in steel', element: ['ringing steel', 'an unbroken wall', 'a vow kept'], verbs: ['drives', 'slams', 'cleaves'], aura: 'the ground seems to brace with them', cry: ['"Not one step back."', '"Stand behind me."', '"The wall holds."'] },
  Paladin:      { weapon: 'warhammer', source: 'a light that refuses the dark', element: ['white radiance', 'consecrated ground', 'a hymn with weight'], verbs: ['brings down', 'smites', 'hammers'], aura: 'gold light pools at their feet', cry: ['"Be judged."', '"The light does not negotiate."', '"Kneel, or be made to."'] },
  Mage:         { weapon: 'staff', source: 'raw arcana bent by will', element: ['violet arcana', 'crackling glyphs', 'folded space'], verbs: ['hurls', 'unleashes', 'detonates'], aura: 'the air tastes of ozone and ink', cry: ['"Theory is practice at this range."', '"Every rule bends for me."', '"Burn in equations."'] },
  Elementalist: { weapon: 'bare hands wreathed in element', source: 'the four primal courts', element: ['fire, frost and storm', 'a sky held in the palm', 'the roar of elements in argument'], verbs: ['calls down', 'hurls', 'releases'], aura: 'the weather forgets what season it is', cry: ['"The elements answer. Do you?"', '"Fire for the cold-hearted."', '"The sky is mine to drop."'] },
  Chronomancer: { weapon: 'hourglass', source: 'borrowed seconds', element: ['slowing dust', 'a clock with no hands', 'yesterday\'s echo'], verbs: ['rewinds', 'folds', 'unspools'], aura: 'every clock in the world skips a beat', cry: ['"You already lost. You just haven\'t caught up."', '"Time is a weapon I sharpen."', '"Again. And again."'] },
  Spellblade:   { weapon: 'runed blade', source: 'spell and steel in one stroke', element: ['humming runes', 'edge-light', 'a blade that thinks'], verbs: ['carves', 'slashes', 'drives'], aura: 'the blade sings a single note', cry: ['"Spell. Steel. Same thing."', '"Cut the magic out of you."', '"Read the runes — too late."'] },
  Warrior:      { weapon: 'greatsword', source: 'discipline forged under weight', element: ['honest iron', 'a shout that lands', 'ground shaking under a stance'], verbs: ['swings', 'brings down', 'drives'], aura: 'the field seems smaller around them', cry: ['"Hold the line!"', '"Steel doesn\'t lie."', '"Again!"'] },
  Warlord:      { weapon: 'banner-spear', source: 'command — bodies move when they speak', element: ['a war-banner snapping', 'drums under the ribs', 'a thousand boots in step'], verbs: ['drives', 'orders', 'brings down'], aura: 'the whole party stands a little taller', cry: ['"ADVANCE!"', '"They break. We don\'t."', '"Every blade — on my mark."'] },
  Berserker:    { weapon: 'twin axes', source: 'a rage that thinks for itself', element: ['red fog', 'a heartbeat like a drum', 'blood in the teeth'], verbs: ['hacks', 'smashes', 'tears'], aura: 'everything turns the colour of blood', cry: ['"MORE!"', '"Pain is just volume."', '"I\'m not done. I\'m never done."'] },
  Monk:         { weapon: 'fists and breath', source: 'inner chi, perfectly still', element: ['a single exhaled breath', 'chi like warm light', 'palms that know the body'], verbs: ['drives', 'strikes', 'presses'], aura: 'the noise of battle falls away', cry: ['"Breathe."', '"Your centre is mine."', '"Still water. Sudden stone."'] },
  Rogue:        { weapon: 'paired daggers', source: 'angles no one is watching', element: ['a flicker in the corner of the eye', 'cold steel from behind', 'a smile you didn\'t see'], verbs: ['slips in', 'opens', 'plants'], aura: 'the light finds somewhere else to be', cry: ['"You looked away."', '"Pockets first. Throat second."', '"Nothing personal."'] },
  Assassin:     { weapon: 'needle-thin blade', source: 'a contract already signed', element: ['silk-silent steps', 'a point of cold', 'the last breath of a mark'], verbs: ['slides', 'buries', 'opens'], aura: 'the room forgets there was ever a second person in it', cry: ['"Already done."', '"Death is just punctuality."', '"Don\'t turn around."'] },
  ShadowDancer: { weapon: 'curved blades that drink the light', source: 'the dark between heartbeats', element: ['folded shadow', 'a dance only the dark follows', 'steps that leave no sound'], verbs: ['cuts', 'spins through', 'weaves'], aura: 'the shadows start to move on their own', cry: ['"Dance with me."', '"The dark keeps its own time."', '"You can\'t block what you can\'t see."'] },
  Phantom:      { weapon: 'spectral chains', source: 'a life already half-left', element: ['grave-cold mist', 'hands through flesh', 'a face in the fog'], verbs: ['passes through', 'drags', 'tears'], aura: 'breath comes out as frost', cry: ['"I was never here."', '"Fear is a doorway."', '"You\'ll remember this cold."'] },
  BloodKnight:  { weapon: 'crimson greatsword', source: 'blood — theirs, yours, anyone\'s', element: ['a red tide', 'armour that drinks', 'veins like rivers'], verbs: ['carves', 'drains', 'drives'], aura: 'the air goes copper-thick', cry: ['"Bleed for me."', '"Every wound feeds the next."', '"My blood. My rules."'] },
  Necromancer:  { weapon: 'bone staff', source: 'the dead, who owe them', element: ['grave-light', 'whispering corpses', 'ash that remembers names'], verbs: ['raises', 'curses', 'unleashes'], aura: 'the fallen stir', cry: ['"Rise. You\'re not finished."', '"Death is a door I hold open."', '"Your corpse will serve better."'] },
  Summoner:     { weapon: 'binding rings', source: 'a pact with things from elsewhere', element: ['rings of binding light', 'a shape stepping through', 'roars from another plane'], verbs: ['calls forth', 'commands', 'binds'], aura: 'something answers from far away', cry: ['"Come. You\'re owed a fight."', '"I don\'t fight alone. Ever."', '"Heed the pact."'] },
  Shaman:       { weapon: 'spirit totem', source: 'ancestors who never left', element: ['smoke and drumbeat', 'spirits circling', 'bone charms clicking'], verbs: ['calls', 'invokes', 'unleashes'], aura: 'drums sound from nowhere', cry: ['"The ancestors are watching."', '"Spirits — take them."', '"You are marked by old gods."'] },
  Druid:        { weapon: 'living oak staff', source: 'the green that outlives empires', element: ['roots through stone', 'a growl in the thicket', 'sap and thunder'], verbs: ['wakes', 'unleashes', 'binds'], aura: 'grass pushes up through the floor', cry: ['"The wild remembers."', '"Root and ruin."', '"Nature takes back what\'s hers."'] },
  Healer:       { weapon: 'open hands', source: 'a mercy that costs the giver', element: ['warm light', 'a steady pulse', 'knit flesh and quiet breath'], verbs: ['pours', 'lays', 'spreads'], aura: 'the pain in the room eases a notch', cry: ['"Stay with me."', '"Not today. Not on my watch."', '"Breathe — I\'ve got you."'] },
  Bard:         { weapon: 'lute with steel strings', source: 'a song the battlefield can\'t ignore', element: ['a chord like a spine straightening', 'a dissonant note', 'rhythm in the blood'], verbs: ['strikes a chord of', 'plays', 'unleashes'], aura: 'the fight finds a rhythm', cry: ['"Everyone — on the beat."', '"Let me play you out."', '"This one\'s for them."'] },
  DragonKnight: { weapon: 'dragon-scale lance', source: 'a dragon\'s blood, bargained for', element: ['scaled fire', 'wingbeat heat', 'an ancient roar'], verbs: ['drives', 'breathes', 'brings down'], aura: 'heat shimmer rolls off them', cry: ['"Dragons don\'t kneel."', '"Burn with pedigree."', '"Wings up."'] },
  Devourer:     { weapon: 'a mouth that shouldn\'t be that wide', source: 'hunger with no bottom', element: ['teeth in the dark', 'a gut that eats magic', 'bones snapping like twigs'], verbs: ['devours', 'tears', 'swallows'], aura: 'the hunger in the room becomes a presence', cry: ['"More."', '"You\'re lighter already."', '"I\'ll have the rest."'] },
  Senku:        { weapon: 'ten billion percent science', source: 'a lab bench and zero mercy', element: ['sparking wires', 'a flask that fizzes wrong', 'formulas scrawled in the air'], verbs: ['deploys', 'fires', 'triggers'], aura: 'something somewhere starts ticking', cry: ['"Ten billion percent."', '"Science doesn\'t care about your HP."', '"Get excited!"'] },
  Monster:      { weapon: 'fang, claw and horn', source: 'the abnormality under the skin', element: ['a wet growl', 'bone grinding bone', 'a hunger older than language'], verbs: ['tears', 'rams', 'rends'], aura: 'every instinct in the room screams RUN', cry: ['"RRRAAAGH!"', '"Meat."', '"Run. It\'s funnier."'] },
};
const FALLBACK = VOICE.Warrior;

// ── Imagery drawn from the skill's own name ─────────────────────────────────
const NAME_IMG = [
  [/summon|reanimate|raise|army|shade|spirit|totem|familiar|conjure|call of|pact|legion|horde/i, 'call', 'the air tears like cloth and something answers from the other side'],
  [/arrow|shot|volley|bolt|rain|snipe|pierce/i, 'shaft', 'the arrow finds the gap it was always going to find'],
  [/fire|flame|burn|inferno|blaze|ember|pyre|meteor|magma|solar|sun/i, 'fire', 'heat rolls out in a wave that curls paint'],
  [/frost|ice|freez|glacial|blizzard|cold|winter/i, 'frost', 'ice races across the ground in cracking veins'],
  [/storm|thunder|lightning|volt|shock|tempest/i, 'storm', 'the air splits white and the thunder arrives late'],
  [/shadow|dark|night|void|umbra|eclipse|abyss/i, 'shadow', 'the dark bends toward the target like it was owed'],
  [/blood|crimson|bleed|vein|gore|hemo/i, 'blood', 'red arcs through the air and does not fall'],
  [/bone|skull|grave|death|corpse|soul|spectral|wraith|ghost|phantom/i, 'grave', 'the temperature drops and the fallen lean closer'],
  [/holy|light|divine|sacred|radiant|blessing|sanctuary|judgment|judgement/i, 'light', 'light with weight behind it floods the field'],
  [/wind|gale|gust|swift|haste|dash|step|blink/i, 'wind', 'the world blurs for one impossible heartbeat'],
  [/earth|stone|quake|boulder|mountain|root|thorn|vine|oak|bark/i, 'earth', 'the ground answers with a shudder'],
  [/venom|poison|toxic|plague|rot|serpent|viper/i, 'venom', 'something green and patient enters the wound'],
  [/dragon|wyrm|drake/i, 'dragon', 'a roar with centuries behind it shakes the dust loose'],
  [/song|chord|melody|hymn|ballad|lullaby|anthem|note|dirge|crescendo/i, 'song', 'the note hangs in the air and the battle moves to it'],
  [/time|clock|hour|chrono|rewind|stasis|temporal/i, 'time', 'the moment stutters, repeats, decides'],
  [/shield|wall|guard|bulwark|aegis|fortress|bastion/i, 'wall', 'steel and will lock into one shape'],
  [/heal|mend|cure|restore|revive|resurrect|renew|balm|grace/i, 'mercy', 'warmth spreads through torn flesh and knits it'],
  [/fang|claw|bite|maul|horn|talon|rend|tusk|sting|tail|carapace|pincer/i, 'beast', 'something that was never a weapon is used exactly like one'],
  [/mana|arcane|spell|rune|glyph|sigil|hex|curse/i, 'arcane', 'glyphs burn themselves into the air and refuse to fade'],
  [/chi|focus|breath|palm|fist|strike|kick|stance/i, 'chi', 'a single breath, a single point of impact'],
  [/beetle|wolf|bear|spider|slime|goblin|ogre|lich|golem|hydra|kraken|wyvern|demon|imp/i, 'beast', 'instinct does what training never could'],
];
function imagery(name) { for (const [rx, key, line] of NAME_IMG) if (rx.test(name)) return { key, line }; return { key: 'steel', line: 'the strike lands exactly where it was meant to' }; }

// ── Templates per kind (slots: {h}=hunter/cast word, {n}=name, {w}=weapon, {src}=source, {el}=element, {img}=imagery line, {aura}, {cry}) ──
const T = {
  damage: [
    '{n} is not a technique so much as a decision. {Verb} {el} through the {w}, and {img}. {aura}.',
    'The old masters called {n} "the one you don\'t walk away from". {Img}; {aura}. {cry}',
    'Drawn from {src}, {n} arrives before the sound does. {Img} — then the pain, all at once.',
    'There is a moment, just before {n} lands, when the target understands. {Img}. {cry}',
    '{n}: {el} given a shape and a grudge. {Img}, and {aura}.',
    'Every {cls} learns {n} early and never stops refining it. {Img}. The second strike is already coming.',
  ],
  buff: [
    '{n} is what a {cls} does when the fight gets honest. {Aura}; {el} gathers around them like an answer.',
    'Drawn from {src}, {n} does not make the hunter stronger — it reminds them they always were. {Aura}.',
    'With {n}, {el} settles into the bones. Allies feel it before they see it: {aura}. {cry}',
    '{n}. A breath, a stance, {el} — and suddenly the odds have changed hands. {Aura}.',
    'Some skills are shouted. {n} is quieter than that: {el}, a steadied heartbeat, {aura}.',
  ],
  debuff: [
    '{n} does not kill. It makes the killing easy. {Img}, and the target\'s strength leaks out of them like heat.',
    'A {cls} knows the body\'s weak points and the mind\'s. {n} finds both — {img}. {cry}',
    'Drawn from {src}, {n} wraps the enemy in {el} and tightens. {Aura}; the fight tilts.',
    '{n} is a curse in the oldest sense: a word that changes the thing it names. {Img}.',
    'The target feels {n} as a weight behind the eyes, then in the arms, then everywhere. {Aura}.',
  ],
  heal: [
    '{n} costs the caster something every time — that is why it works. {Img}; breath comes easier. {cry}',
    'Drawn from {src}, {n} is {el} poured into a wound until the wound forgets it was one. {Aura}.',
    'There is no glory in {n}. There is a hunter still standing who should not be. {Img}.',
    '{n}: {el}, laid on torn flesh by hands that have done this too many times. {Aura}.',
  ],
  passive: [
    '{n} is not cast. It is what a {cls} has become: {el} in every reflex, {src} in every breath. {Aura} — always.',
    'Years of {src} leave a mark. {n} is that mark — it does its work whether the hunter is paying attention or not.',
    'Other hunters train skills. A {cls} trains {n} into the body until there is no difference. {Aura}, quietly, every turn.',
    '{n} never announces itself. It is there in the stance, the timing, the way {el} answers without being called.',
  ],
  summon: [
    '{n} is a door, and a {cls} is the only one holding the key. {Img}; something steps through that owes them a fight. {cry}',
    'Drawn from {src}, {n} does not create — it CALLS. {Aura}, and the answer arrives with teeth.',
    'Every summoner learns the same lesson from {n}: what you bind, you must also feed. {Img}.',
    '{n}: {el}, a name spoken with authority, and a shape that was waiting to be asked. {Aura}.',
  ],
};

const CAST = {
  damage: ['{E} {n}! {hVerb} {el} — {img}.', '{E} {n}! {cry} {Img}.', '{E} {n} — {img}. {Aura}.'],
  buff:   ['{E} {n}! {Aura}. {cry}', '{E} {n} — {el} gathers; {aura}.', '{E} {n}! {cry}'],
  debuff: ['{E} {n}! {Img}. {Aura}.', '{E} {n} — {cry} {Img}.', '{E} {n}! The target\'s strength bleeds out of them.'],
  heal:   ['{E} {n}! {Img}. {cry}', '{E} {n} — {el}, {aura}.', '{E} {n}! Wounds close under {el}.'],
  passive:['{E} {n} stirs — {aura}.', '{E} {n}: {el} answers on its own.'],
  summon: ['{E} {n}! {Aura} — and something answers. {cry}', '{E} {n}! {Img}; a shape steps through.'],
};

function kindOf(sk) {
  const ty = String(sk.type || '').toLowerCase();
  if (sk.isPassive || ty === 'passive') return 'passive';
  if (ty === 'heal') return 'heal';
  if (ty === 'summon') return 'summon';
  if (ty === 'buff' || ty === 'support') return 'buff';
  if (ty === 'debuff' || ty === 'utility') return 'debuff';
  return 'damage';
}
const TAG = { damage: '💥 DAMAGE', buff: '✨ BUFF', debuff: '🌀 DEBUFF', heal: '💚 HEAL', passive: '🛡️ PASSIVE', summon: '🜏 SUMMON' };

function fill(tpl, ctx) {
  return tpl
    .replace(/\{E\}/g, ctx.E).replace(/\{n\}/g, ctx.n).replace(/\{w\}/g, ctx.w).replace(/\{src\}/g, ctx.src)
    .replace(/\{el\}/g, ctx.el).replace(/\{cls\}/g, ctx.cls).replace(/\{cry\}/g, ctx.cry)
    .replace(/\{img\}/g, ctx.img).replace(/\{Img\}/g, cap(ctx.img))
    .replace(/\{aura\}/g, ctx.aura).replace(/\{Aura\}/g, cap(ctx.aura))
    .replace(/\{Verb\}/g, cap(ctx.verb)).replace(/\{hVerb\}/g, 'The hunter ' + ctx.verb)
    .replace(/\s+\./g, '.').replace(/\.\./g, '.');
}

function voiceFor(className, variant) {
  const v = VOICE[className] || FALLBACK;
  if (className === 'Monster' && variant) {
    let creature = null, el = null;
    try { const MK = require('./MonsterKits103'); creature = MK.creatureOf(variant); el = MK.elementOf(variant); } catch (e) {}
    return { ...v, element: [`${el || 'primal'} fury`, `the ${creature || 'beast'}'s hunger`, 'bone grinding bone'], weapon: `the ${creature || 'beast'}'s own body`, cry: [`"The ${variant} does not negotiate."`, ...v.cry] };
  }
  return v;
}

function lore(className, sk, variant = null) {
  const name = String(sk.name || 'Unknown');
  const kind = kindOf(sk);
  const v = voiceFor(className, variant);
  const seed = hash(`${className}|${name}`);
  const im = imagery(name);
  const ctx = {
    E: sk.emoji || '✦', n: name, w: v.weapon, src: v.source, cls: className === 'Monster' ? 'monster' : className,
    el: pick(v.element, seed, 1), verb: pick(v.verbs, seed, 2), aura: v.aura, cry: pick(v.cry, seed, 3), img: im.line,
  };
  const loreLine = fill(pick(T[kind], seed, 4), ctx);
  const castLine = fill(pick(CAST[kind], seed, 5), ctx);
  return { lore: loreLine, cast: castLine, tag: TAG[kind], kind };
}

// What combat shows under "X uses Y!": the cast line + the plain spec sentence (no Mechanics dump).
function combatLine(sk) {
  if (!sk) return '';
  const d = String(sk.description || '');
  const spec = ((d.match(/📝 ([^\n]*)/) || [])[1] || d.replace(/^\S+\s+_[^_]*_\n?/, '')).replace(/\s*Mechanics:[\s\S]*$/, '').trim();
  const cast = sk.animation && !/^⚡ .*!\n💥 The technique lands!$/.test(sk.animation) ? String(sk.animation).split('\n')[0] : '';
  return [cast, spec].filter(Boolean).join('\n');
}
module.exports = { lore, kindOf, TAG, VOICE, imagery, combatLine };
