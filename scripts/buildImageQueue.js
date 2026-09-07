// Build a queue of all images to generate, with per-entity prompts.
// Used by the human (me) to fire batches of 10 in parallel.

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = '/home/user/project/anirpg';
const ASSET_ROOT = path.join(ROOT, 'assets/images');
const inv = JSON.parse(fs.readFileSync('/home/user/anirpg_inventory.json', 'utf8'));

// ── Element/style hints for prompt generation ─────────────────
const RARITY_STYLE = {
  common:    'common quality, worn, simple, hand-crafted, basic materials, no glow',
  uncommon:  'uncommon quality, polished, reinforced, minor enchantment, slight glow',
  rare:      'rare quality, ornate engravings, magical runes, glowing accents, blue aura',
  epic:      'epic quality, intricate craftsmanship, flowing magical energy, purple aura, dramatic lighting',
  legendary: 'legendary quality, masterwork, divine metal, golden radiance, fire and lightning motifs, awe-inspiring',
  mythic:    'mythic quality, reality-bending, world-shaking, cosmic void, impossible geometry, overwhelming presence',
};

const RARITY_TINT = {
  common:    'muted grey and steel colors',
  uncommon:  'green-tinged metal',
  rare:      'deep blue and silver',
  epic:      'purple and violet magic',
  legendary: 'gold and white divine fire',
  mythic:    'cosmic black and red, void energy',
};

const ITEM_TYPE_VISUAL = {
  sword:    'a long bladed sword with a crossguard hilt and pommel',
  axe:      'a single-bit or double-bit battle axe with a long haft',
  bow:      'an archer bow with a drawn string, may have arrow nocked',
  magic:    'a magical staff or wand, glowing runes etched into the surface',
  blunt:    'a heavy mace, club, or war hammer with reinforced head',
  polearm:  'a long-hafted polearm — lance, spear, pike, or halberd',
  scythe:   'a curved-bladed scythe with a long wooden handle',
  helm:     'a helmet, hood, or headpiece for the head',
  chest:    'a chestpiece — plate, robe, coat, or vest',
  hands:    'a pair of gloves or gauntlets',
  feet:     'a pair of boots or shoes',
  legs:     'a pair of pants, leggings, or greaves',
  accessory:'a ring, amulet, pendant, or small charm',
  item:     'a small object or trinket',
};

// Detect item type from name (same logic as AssetManager)
function detectItemType(name) {
  const n = String(name).toLowerCase();
  if (/(sword|blade|saber|katana|rapier|scimitar|dagger|knife)/.test(n)) return 'sword';
  if (/(axe|cleaver|hatchet)/.test(n)) return 'axe';
  if (/(bow|arrow|quiver)/.test(n)) return 'bow';
  if (/(staff|wand|rod|orb|tome|book|grimoire)/.test(n)) return 'magic';
  if (/(mace|club|hammer|maul)/.test(n)) return 'blunt';
  if (/(lance|spear|pike|halberd|trident)/.test(n)) return 'polearm';
  if (/(scythe|sickle)/.test(n)) return 'scythe';
  if (/(helm|hood|cap|crown|circlet|visor|bandana|headband|hat|veil|mask|beret)/.test(n)) return 'helm';
  if (/(chest|robe|coat|armor|plate|mail|vest|shirt|jacket|cape|cloak|breastplate|hauberk)/.test(n)) return 'chest';
  if (/(glove|gauntlet|bracer|knuckle|wrap|mittens?|claw)/.test(n)) return 'hands';
  if (/(boot|shoe|sandal|slipper|boot|tread|stomper)/.test(n)) return 'feet';
  if (/(pant|legging|trousers|greaves|kilt)/.test(n)) return 'legs';
  if (/(ring|amulet|pendant|charm|band|talisman|necklace|bracelet|relic|idol|core|orb|totem|sigil|gem|stone|shard)/.test(n)) return 'accessory';
  return 'item';
}

function detectElement(text) {
  const lower = String(text).toLowerCase();
  if (/(fire|flame|burning|ember|magma|lava|scorch)/.test(lower)) return 'fire';
  if (/(frost|ice|glacial|snow|frozen|cold|winter)/.test(lower))   return 'frost';
  if (/(shadow|void|dark|night|shroud|abyss|black)/.test(lower))   return 'shadow';
  if (/(light|holy|divine|radiant|golden|sun|sacred)/.test(lower))  return 'light';
  if (/(leaf|root|thorn|forest|tree|wood|nature|verdant)/.test(lower)) return 'nature';
  if (/(thunder|lightning|storm|volt|spark|tempest)/.test(lower))   return 'storm';
  if (/(blood|crimson|cursed|bleeding|life|vampire)/.test(lower))   return 'blood';
  if (/(bone|wraith|ghost|spirit|skull|specter|undead|death|soul)/.test(lower)) return 'death';
  if (/(crystal|gem|shard|prism|faceted)/.test(lower))  return 'crystal';
  if (/(dragon|wyrm|drake|scale|claw|horn)/.test(lower)) return 'dragon';
  return null;
}

function buildItemPrompt(name, rarity) {
  const type = detectItemType(name);
  const element = detectElement(name);
  const visual = ITEM_TYPE_VISUAL[type] || ITEM_TYPE_VISUAL.item;
  const elementText = element ? ` with ${element} energy threading through it, ${element} motifs` : '';
  return `Anime cel-shaded fantasy game item icon of *${name}*. The item is ${visual}${elementText}. It is ${RARITY_TINT[rarity]}. The art should look like a ${RARITY_STYLE[rarity]}. Centered on a clean white background, square aspect ratio, no text, detailed, dramatic lighting.`;
}

function buildPetPrompt(key) {
  const name = key.replace(/_/g, ' ');
  return `Anime chibi-style fantasy pet illustration of a ${name}. Cute, friendly, small companion creature. Vibrant colors, cel-shaded, big expressive eyes, soft round shapes. Standing in a nature environment with subtle particles/aura matching its element. Square aspect ratio, clean white background, no text.`;
}

function buildMonsterPrompt(name) {
  const element = detectElement(name);
  const elementText = element ? ` Inherently ${element}-aligned, with ${element} motifs in its design.` : '';
  return `Anime chibi-style fantasy monster illustration of a ${name}, a hostile creature from an RPG dungeon.${elementText} Menacing, detailed, in a dynamic action pose. Vibrant colors, cel-shaded, dramatic lighting, dark fantasy atmosphere. Square aspect ratio, clean white background, no text.`;
}

function buildBossPrompt(name) {
  const element = detectElement(name);
  const elementText = element ? ` Strong ${element} affinity — visible in its design.` : '';
  return `Anime chibi-style epic boss monster illustration of a ${name}, a major world boss.${elementText} Huge, imposing, radiating power. Multiple glowing eyes, ornate armor, large weapons, dark aura. Dynamic action pose, dramatic lighting, dark fantasy atmosphere, intimidating presence. Vibrant colors, cel-shaded. Square aspect ratio, clean white background, no text.`;
}

function buildArtifactPrompt(name) {
  return `Anime cel-shaded legendary artifact illustration of ${name}. A powerful, iconic item from a fantasy RPG. Glowing with supernatural energy, intricate runes, ornate design, divine craftsmanship. Dramatic lighting, deep shadows, vibrant magical colors. Square aspect ratio, clean white background, no text.`;
}

function buildClassPrompt(name, tier) {
  const tierStyle = {
    common:    'wearing simple leather or cloth gear, holding a basic weapon, looking determined but unrefined',
    rare:      'wearing studded leather or chain, holding an enchanted weapon, aura of minor magic',
    epic:      'wearing ornate plate or mage robes, holding a legendary weapon, glowing runes on armor, magic aura',
    legendary: 'wearing masterwork full-plate or arcane regalia, holding a god-killer weapon, surrounded by elemental energy, heroic stance',
    divine:    'transcendent form, the art shifts and changes, reality itself bends around the figure, glowing with the white light of creation',
  };
  return `Anime-style full character illustration of a ${tier}-tier RPG class called ${name.replace(/([A-Z])/g, ' $1').trim()}. A hero ${tierStyle[tier] || tierStyle.common}. Standing in a dynamic heroic pose, looking at the viewer. Vibrant colors, cel-shaded, dramatic rim lighting, fantasy atmosphere. Square aspect ratio, clean white background, no text.`;
}

function buildSkinPrompt(rarity, slot, gender) {
  const r = rarity.toLowerCase();
  const tint = RARITY_TINT[r];
  const style = RARITY_STYLE[r];
  return `Anime-style fantasy character skin/avatar for a ${r}-tier ${gender} player. The skin shows ${gender === 'female' ? 'a confident female warrior/mage' : 'a confident male warrior/mage'} wearing ${tint} armor, ${style}. Dynamic pose, fantasy atmosphere, looking powerful. Square aspect ratio, clean white background, no text.`;
}

function slugify(name) {
  return String(name).toLowerCase().replace(/['"`]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// ── Build the full queue ────────────────────────────────────
const queue = [];

// Items
for (const [rarity, list] of Object.entries(inv.items)) {
  for (const name of list) {
    const slug = slugify(name);
    const outPath = path.join(ASSET_ROOT, 'items', rarity, `${slug}.png`);
    if (fs.existsSync(outPath)) continue;
    queue.push({
      path: outPath,
      prompt: buildItemPrompt(name, rarity),
      kind: 'item',
      name,
      rarity,
    });
  }
}

// Pets
for (const key of inv.pets) {
  const outPath = path.join(ASSET_ROOT, 'pets', `${key}.png`);
  if (fs.existsSync(outPath)) continue;
  queue.push({
    path: outPath, prompt: buildPetPrompt(key),
    kind: 'pet', name: key,
  });
}

// Monsters
for (const name of inv.monsters) {
  const outPath = path.join(ASSET_ROOT, 'monsters', `${slugify(name)}.png`);
  if (fs.existsSync(outPath)) continue;
  queue.push({
    path: outPath, prompt: buildMonsterPrompt(name),
    kind: 'monster', name,
  });
}

// Bosses
for (const name of inv.bosses) {
  // Filter out item-shaped boss names (these are stray items in the bosses list)
  if (/(potion|elixir|charm|shard|HP |lord|god|king|queen|drake|dragon|kraken|knight|general|elemental|monolith)/i.test(name) === false &&
      /^[A-Z][a-z]+( [A-Z][a-z]+){0,3}$/.test(name) === false) continue;
  const outPath = path.join(ASSET_ROOT, 'bosses', `${slugify(name)}.png`);
  if (fs.existsSync(outPath)) continue;
  queue.push({
    path: outPath, prompt: buildBossPrompt(name),
    kind: 'boss', name,
  });
}

// Artifacts
for (const name of inv.artifacts) {
  // skip rarity names that snuck into the list
  if (['Common','Uncommon','Rare','Epic','Legendary','Mythic'].includes(name)) continue;
  if (name.length < 3) continue;
  const outPath = path.join(ASSET_ROOT, 'artifacts', `${slugify(name)}.png`);
  if (fs.existsSync(outPath)) continue;
  queue.push({
    path: outPath, prompt: buildArtifactPrompt(name),
    kind: 'artifact', name,
  });
}

// Player classes
for (const [tier, list] of Object.entries(inv.playerClasses)) {
  for (const name of list) {
    const outPath = path.join(ASSET_ROOT, 'classes', tier, `${slugify(name)}.png`);
    if (fs.existsSync(outPath)) continue;
    queue.push({
      path: outPath, prompt: buildClassPrompt(name, tier),
      kind: 'class', name, tier,
    });
  }
}

// Monster classes
for (const name of inv.monsterClasses) {
  const outPath = path.join(ASSET_ROOT, 'classes', 'monster', `${slugify(name)}.png`);
  if (fs.existsSync(outPath)) continue;
  queue.push({
    path: outPath, prompt: buildMonsterPrompt(name.replace(/_/g, ' ')),
    kind: 'monsterClass', name,
  });
}

// Skins — 20 per rarity, 5 male + 5 female per 2 visual variants × 2 sets = 20
const SKIN_NAMES_PER_RARITY = 20;
const SKIN_RARITIES = ['common','uncommon','rare','epic','legendary','mythic'];
for (const rarity of SKIN_RARITIES) {
  for (let i = 1; i <= SKIN_NAMES_PER_RARITY; i++) {
    const key = `skin_${String(i).padStart(2,'0')}`;
    const outPath = path.join(ASSET_ROOT, 'skins', rarity, `${key}.png`);
    if (fs.existsSync(outPath)) continue;
    const gender = i % 2 === 0 ? 'female' : 'male';
    queue.push({
      path: outPath, prompt: buildSkinPrompt(rarity, i, gender),
      kind: 'skin', name: key, rarity, gender,
    });
  }
}

console.log(`Total images to generate: ${queue.length}`);
const byKind = {};
for (const q of queue) byKind[q.kind] = (byKind[q.kind] || 0) + 1;
for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(15)} ${n}`);
}

fs.writeFileSync('/home/user/anirpg_image_queue.json', JSON.stringify(queue, null, 2));
console.log();
console.log('✓ Queue written to /home/user/anirpg_image_queue.json');

// Print first 10 prompts so the human can sanity-check
console.log();
console.log('─── First 10 prompts (sanity check) ───');
for (let i = 0; i < Math.min(10, queue.length); i++) {
  const q = queue[i];
  console.log();
  console.log(`[${i}] ${q.path.replace('/home/user/project/anirpg/', '')}`);
  console.log(`    ${q.prompt.slice(0, 200)}...`);
}
