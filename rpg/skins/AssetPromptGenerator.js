/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║            ✦ 𝐀𝐬𝐭𝐫𝐚™ — AssetPromptGenerator.js                  ║
 * ║  Scans all game data and generates AI image prompts for      ║
 * ║  every asset in the game.                                    ║
 * ║                                                              ║
 * ║  Asset categories:                                           ║
 * ║    • Weapons      — all craftable + class + artifact weapons ║
 * ║    • Armor        — all 180 GearCatalog pieces               ║
 * ║    • Monsters     — all MonsterDrops monsters + bosses       ║
 * ║    • Potions      — all consumable items                     ║
 * ║    • Materials    — all craftable materials/drops            ║
 * ║    • Currency     — Nexus, Mana Stones, Mana Stones              ║
 * ║    • Artifacts    — all named artifacts                      ║
 * ║                                                              ║
 * ║  Usage:                                                      ║
 * ║    node rpg/skins/AssetPromptGenerator.js                    ║
 * ║  Outputs:                                                     ║
 * ║    asset_prompts.json        — full prompt data              ║
 * ║    asset_prompts_summary.txt — quick reference list          ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { resolveWeaponType } = require('./RigSpec');

// ── Asset root ────────────────────────────────────────────────────────────────
const ASSET_ROOT  = path.join(__dirname, '..', '..', 'assets');
const DATA_ROOT   = path.join(__dirname, '..', '..');

// ── Rarity visual guide ───────────────────────────────────────────────────────
const RARITY_VISUAL = {
  common:    'plain, muted tones, minimal detail, functional',
  uncommon:  'clean finish, single accent colour, some detail',
  rare:      'detailed, glowing trim or runes, clear power',
  epic:      'ornate, energy lines, dramatic colour, particle effects',
  legendary: 'iconic, aura visible, particle effects, cinematic quality',
  mythic:    'transcendent, void cracks or divine glow, reality-distorting presence',
};

// ── Weapon type visual guide ──────────────────────────────────────────────────
const WEAPON_TYPE_VISUAL = {
  sword:   'longsword or greatsword displayed vertically, blade clearly visible, hilt detailed',
  spear:   'spear or lance at a diagonal angle, tip prominent and sharp',
  staff:   'magical staff upright, energy crackling at the tip or crystal orb',
  bow:     'elegant undrawn bow displayed with bowstring taut, graceful curve',
  axe:     'battle axe displayed at angle showing full blade and handle',
  scythe:  'curved scythe in dramatic display position, sweeping arc visible',
  dagger:  'short blade or dagger displayed flat, both sides of blade visible',
  fist:    'combat gauntlet or knuckle weapon displayed as a pair',
  tome:    'open magical tome or spell orb floating slightly, pages glowing',
  shield:  'round or tower shield facing forward, crest and design fully visible',
  special: 'unique weapon displayed prominently, signature feature focal point',
};

// ── Monster visual guide ──────────────────────────────────────────────────────
const MONSTER_RANK_VISUAL = {
  F:       'small, weak, cartoonish threat level, muted colours',
  E:       'low-tier creature, simple design, mild menace',
  D:       'mid-low tier, more defined, noticeable threat',
  C:       'mid-tier, strong design, glowing eyes or energy',
  B:       'high-tier, imposing size, clear power, aura visible',
  A:       'elite creature, intense design, aura emanating, dramatic colours',
  S:       'legendary level, reality-distorting presence, massive scale, terrifying',
  DISASTER:'world-ending creature, incomprehensible scale, aura fills the frame',
};

// ── Slot visual specs ──────────────────────────────────────────────────────────
const SLOT_VISUAL = {
  helm:  'helmet or headpiece displayed at a slight 3/4 angle showing full design, no character wearing it',
  chest: 'chest armour piece displayed flat facing forward, no character wearing it',
  cloak: 'flowing cloak or cape spread open showing front design and inner lining',
  vam:   'pair of vambraces or arm bracers displayed side by side flat',
  boot:  'pair of armoured boots or greaves displayed side by side',
  ring:  'ornate ring close-up showing gemstone and band detail, slight angle',
};

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

const BASE_STYLE = `anime game asset concept art, clean transparent or white background, 
professional quality, no character, no hand, no person, no background scene`;

const NEG_BASE = `character, person, hand, holding, background scene, landscape, 
realistic photograph, 3D render, watermark, text, signature, blurry, low quality, 
chibi, western cartoon`;

function buildWeaponPrompt(name, rarity = 'common', tier = 'common') {
  const rule    = resolveWeaponType(name);
  const typeVis = WEAPON_TYPE_VISUAL[rule.type] || WEAPON_TYPE_VISUAL.sword;
  const rarVis  = RARITY_VISUAL[rarity] || RARITY_VISUAL.common;
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  return {
    name,
    category:  'weapon',
    type:      rule.type,
    rarity,
    tier,
    filename:  `assets/weapons/${rule.type}/${safeName}.png`,
    prompt: `Game weapon: ${name}. ${typeVis}. Rarity: ${rarity} — ${rarVis}. ${BASE_STYLE}.`,
    negativePrompt: NEG_BASE,
    midjourney: `Game weapon concept art: ${name}, ${typeVis}, ${rarity} rarity — ${rarVis}, anime style, white background, no character --ar 1:1 --q 2`,
  };
}

function buildArmorPrompt(gear) {
  const slotVis = SLOT_VISUAL[gear.slot] || `${gear.slot} piece displayed clearly`;
  const rarVis  = RARITY_VISUAL[gear.rarity] || RARITY_VISUAL.common;
  const safeName = gear.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const special  = gear.special ? `Special: ${gear.special.desc}.` : '';

  return {
    name:      gear.name,
    id:        gear.id,
    category:  'armor',
    slot:      gear.slot,
    rarity:    gear.rarity,
    filename:  `assets/armor/${gear.slot}/${safeName}.png`,
    prompt: `Game armor piece: ${gear.name}. ${slotVis}. ${gear.desc}. ${special} Rarity: ${gear.rarity} — ${rarVis}. Lore: ${gear.lore}. ${BASE_STYLE}.`,
    negativePrompt: NEG_BASE,
    midjourney: `Game armor concept art: ${gear.name}, ${slotVis}, ${gear.rarity} rarity — ${rarVis}, anime style, white background --ar 1:1 --q 2`,
  };
}

function buildMonsterPrompt(monster) {
  const rankVis  = MONSTER_RANK_VISUAL[monster.rank] || MONSTER_RANK_VISUAL.F;
  const safeName = monster.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const isBoss   = monster.primary !== undefined; // boss if has primary drop
  const bossNote = isBoss ? 'This is a BOSS monster — larger scale, more imposing, dramatic presentation.' : '';

  return {
    name:      monster.name,
    category:  'monster',
    rank:      monster.rank,
    isBoss,
    filename:  `assets/monsters/${safeName}.png`,
    prompt: `Game monster: ${monster.name}. Rank ${monster.rank} — ${rankVis}. ${bossNote} Anime dungeon creature, clear full body visible, menacing pose, dynamic angle showing monster clearly. ${BASE_STYLE}.`,
    negativePrompt: `${NEG_BASE}, human, humanoid hero, player character`,
    midjourney: `Game monster concept art: ${monster.name}, rank ${monster.rank} dungeon creature, ${rankVis}, ${isBoss ? 'boss monster, imposing scale, ' : ''}anime style, white background --ar 1:1 --q 2`,
  };
}

function buildPotionPrompt(item) {
  const safeName = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return {
    name:      item.name,
    category:  'item',
    filename:  `assets/items/${safeName}.png`,
    prompt: `Game item: ${item.name}. ${item.desc}. Small potion bottle or item icon, glowing liquid or magical effect visible, anime game icon style, transparent background. ${BASE_STYLE}.`,
    negativePrompt: NEG_BASE,
    midjourney: `Game item icon: ${item.name}, ${item.desc}, anime potion icon, glowing, transparent background --ar 1:1 --q 2`,
  };
}

function buildMaterialPrompt(name, rank = 'F') {
  const safeName  = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const rankLabel = { F:'basic',E:'low',D:'mid',C:'standard',B:'high',A:'elite',S:'legendary',DISASTER:'mythic' }[rank] || 'standard';

  return {
    name,
    category: 'material',
    rank,
    filename: `assets/items/materials/${safeName}.png`,
    prompt: `Game crafting material: ${name}. ${rankLabel}-tier drop item, small icon view, anime game art style, clearly recognisable shape, transparent or white background. ${BASE_STYLE}.`,
    negativePrompt: NEG_BASE,
    midjourney: `Game crafting material icon: ${name}, ${rankLabel} tier, anime style, white background --ar 1:1 --q 2`,
  };
}

function buildCurrencyPrompt(name, description) {
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return {
    name,
    category: 'currency',
    filename: `assets/currency/${safeName}.png`,
    prompt: `Game currency icon: ${name}. ${description}. Shiny, desirable, clearly a currency icon, coin or gem style, glow effect, anime game art, transparent background. ${BASE_STYLE}.`,
    negativePrompt: NEG_BASE,
    midjourney: `Game currency icon: ${name}, ${description}, shiny, anime style, transparent background --ar 1:1 --q 2`,
  };
}

function buildArtifactPrompt(artifact) {
  const rule     = resolveWeaponType(artifact.name);
  const typeVis  = WEAPON_TYPE_VISUAL[rule.type] || WEAPON_TYPE_VISUAL.sword;
  const safeName = artifact.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  return {
    name:      artifact.name,
    category:  'artifact',
    type:      rule.type,
    filename:  `assets/weapons/${rule.type}/${safeName}.png`,
    prompt: `Legendary game artifact weapon: ${artifact.name}. ${typeVis}. This is a mythic-tier artifact — transcendent design, divine or void aura, reality-distorting visual effects, unmistakably powerful. ${BASE_STYLE}.`,
    negativePrompt: NEG_BASE,
    midjourney: `Legendary artifact weapon: ${artifact.name}, ${typeVis}, mythic tier, transcendent aura, anime style, white background --ar 1:1 --q 2`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA SCANNERS
// ─────────────────────────────────────────────────────────────────────────────

function scanGearCatalog() {
  try {
    const { GEAR_CATALOG } = require('../utils/GearCatalog');
    return GEAR_CATALOG.map(buildArmorPrompt);
  } catch (e) {
    console.warn('GearCatalog scan failed:', e.message);
    return [];
  }
}

function scanMonsters() {
  const results = [];
  try {
    const MonsterDrops = require('../data/MonsterDrops');
    const { MONSTER_DROPS } = MonsterDrops;
    const seen = new Set();

    for (const [rank, data] of Object.entries(MONSTER_DROPS)) {
      for (const m of (data.monsters || [])) {
        if (!seen.has(m.name)) {
          seen.add(m.name);
          results.push(buildMonsterPrompt({ name: m.name, rank }));
        }
      }
      for (const b of (data.bosses || [])) {
        if (!seen.has(b.name)) {
          seen.add(b.name);
          results.push(buildMonsterPrompt({ name: b.name, rank, primary: b.primary }));
        }
      }
    }
  } catch (e) {
    // Fallback: use MonsterTemplates
    try {
      const { monsterTypes } = require('../monsters/MonsterTemplates');
      for (const m of monsterTypes) {
        results.push(buildMonsterPrompt(m));
      }
    } catch (e2) {
      console.warn('Monster scan failed:', e2.message);
    }
  }
  return results;
}

function scanCraftableWeapons() {
  const results  = [];
  const seen     = new Set();
  const tiers    = ['common','uncommon','rare','epic','legendary','mythic'];

  for (const tier of tiers) {
    try {
      const recipePath = path.join(DATA_ROOT, 'rpg', 'data', `recipes_${tier}.js`);
      if (!fs.existsSync(recipePath)) continue;
      const raw = fs.readFileSync(recipePath, 'utf8');
      // Extract all output: 'name' values
      const matches = raw.matchAll(/output:\s*['"]([^'"]+)['"]/g);
      for (const match of matches) {
        const name = match[1].trim();
        if (!name || seen.has(name)) continue;
        // Only include if it looks like a weapon (not a material/ingredient)
        const rule = resolveWeaponType(name);
        const isLikelyWeapon = isWeaponName(name);
        if (isLikelyWeapon) {
          seen.add(name);
          results.push(buildWeaponPrompt(name, tier, tier));
        }
      }
    } catch (e) {
      console.warn(`Recipe scan failed (${tier}):`, e.message);
    }
  }
  return results;
}

function scanCraftableMaterials() {
  const results = [];
  const seen    = new Set();
  const tiers   = ['common','uncommon','rare','epic','legendary','mythic'];
  const rankMap = { common:'F', uncommon:'E', rare:'D', epic:'C', legendary:'B', mythic:'S' };

  for (const tier of tiers) {
    try {
      const recipePath = path.join(DATA_ROOT, 'rpg', 'data', `recipes_${tier}.js`);
      if (!fs.existsSync(recipePath)) continue;
      const raw = fs.readFileSync(recipePath, 'utf8');
      // ingredients: ['name','name',...]
      const ingMatches = raw.matchAll(/['"]([A-Z][^'"]{2,40})['"]/g);
      for (const match of ingMatches) {
        const name = match[1].trim();
        if (!name || seen.has(name) || isWeaponName(name)) continue;
        if (name.length < 3 || /^\d/.test(name)) continue;
        seen.add(name);
        results.push(buildMaterialPrompt(name, rankMap[tier] || 'F'));
      }
    } catch (e) { console.warn('[SILENT] AssetPromptGenerator: prompt build failed for tier:', e.message); }
  }
  return results;
}

function scanArtifacts() {
  try {
    const raw = fs.readFileSync(
      path.join(DATA_ROOT, 'rpg', 'utils', 'ArtifactSystem.js'), 'utf8'
    );
    const results = [];
    const matches = raw.matchAll(/name:\s*['"]([^'"]+)['"]/g);
    const seen    = new Set();
    for (const m of matches) {
      const name = m[1].trim();
      if (seen.has(name) || name.length < 3) continue;
      // Only top-level artifact names (not skill names — those are shorter and repeated)
      if (isWeaponName(name) || name.includes("'s") || name.split(' ').length >= 2) {
        seen.add(name);
        results.push(buildArtifactPrompt({ name }));
      }
    }
    return results;
  } catch (e) {
    console.warn('Artifact scan failed:', e.message);
    return [];
  }
}

function scanPotions() {
  return [
    { name: 'Health Potion',     desc: 'Restores 50% HP. Red glowing liquid in a small vial.' },
    { name: 'Energy Potion',     desc: 'Restores 50% Energy. Blue crackling liquid in a flask.' },
    { name: 'Revive Token',      desc: 'Auto-revive once in dungeon. Glowing golden token or medallion.' },
    { name: 'Luck Potion',       desc: '+25% luck effect. Four-leaf clover suspended in green shimmering potion.' },
    { name: 'Shield Scroll',     desc: 'Absorbs one hit. Ancient rolled scroll with a glowing blue shield rune.' },
    { name: 'Elixir of Might',   desc: '+20 ATK for 5 battles. Dark red power-infused elixir in a rugged flask.' },
    { name: 'XP Booster',        desc: 'Bonus experience gain. Golden star-shaped crystal glowing with potential.' },
    { name: 'Summon Ticket',     desc: 'Used to pull from the skin gacha. Elegant golden ticket with star motif.' },
    { name: 'Mana Stone',        desc: 'Standard mana currency. Blue crystalline stone pulsing with inner light.' },
    { name: 'Dungeon Key',       desc: 'Opens a gate for raiding. Iron key crackling with dimensional energy.' },
  ].map(buildPotionPrompt);
}

function scanCurrency() {
  return [
    { name: 'Nexus',         description: 'Shining gold coins stacked, warm yellow glow, premium currency feel' },
    { name: 'Mana Stones',  description: 'Blue crystalline stones, magical inner light, floating slightly' },
    { name: 'Mana Stones',     description: 'Purple Mana Stones, premium currency, elegant faceted gems, glowing purple' },
  ].map(c => buildCurrencyPrompt(c.name, c.description));
}

// ── Weapon name heuristic ─────────────────────────────────────────────────────
const WEAPON_KEYWORDS = [
  'sword','blade','saber','sabre','katana','greatsword','claymore','slasher',
  'spear','lance','pike','trident','javelin','halberd','glaive','naginata',
  'staff','rod','wand','scepter','sceptre','orb','tome',
  'bow','crossbow',
  'axe','maul','cleaver','hatchet','crusher',
  'scythe','reaper',
  'dagger','knife','fang blade','needle','kris',
  'fist','knuckle','gauntlet',
  'shield','aegis','bulwark',
  'hammer','mace','flail',
  'annihilator','executioner','sovereign','obliterator','devastator',
];
const MATERIAL_KEYWORDS = [
  'core','shard','fragment','pelt','scale','fang','claw','bone','dust',
  'residue','hide','venom','silk','crystal','ingot','alloy','metal',
  'wood','leather','cloth','string','feather','fur','gem','ore',
  'extract','essence','gland','eye','tooth','tusk','horn','wing',
  'ash','powder','droplet','film','chunk','slime','gel','strip',
  'vial','pouch','brand','mark','needle','residue','clump','root',
];

function isWeaponName(name) {
  const lower = name.toLowerCase();
  // Must match a weapon keyword
  const hasWeaponKw = WEAPON_KEYWORDS.some(k => lower.includes(k));
  if (!hasWeaponKw) return false;
  // Must NOT be primarily a material name
  const hasMaterialKw = MATERIAL_KEYWORDS.some(k => lower.includes(k));
  // "Dragon Scale" has scale (material) but might also be a sword name
  // Reject if the material keyword is at the end and no weapon keyword present except edge cases
  if (hasMaterialKw && !WEAPON_KEYWORDS.slice(0,20).some(k => lower.includes(k))) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

function generateAllAssetPrompts() {
  console.log('Scanning game data...');

  const weapons   = scanCraftableWeapons();   console.log(`  ⚔️  Weapons:   ${weapons.length}`);
  const armor     = scanGearCatalog();         console.log(`  🛡️  Armor:     ${armor.length}`);
  const monsters  = scanMonsters();            console.log(`  👹  Monsters:  ${monsters.length}`);
  const artifacts = scanArtifacts();           console.log(`  ✨  Artifacts: ${artifacts.length}`);
  const potions   = scanPotions();             console.log(`  🧪  Potions:   ${potions.length}`);
  const materials = scanCraftableMaterials();  console.log(`  🪨  Materials: ${materials.length}`);
  const currency  = scanCurrency();            console.log(`  💰  Currency:  ${currency.length}`);

  const total = weapons.length + armor.length + monsters.length +
                artifacts.length + potions.length + materials.length + currency.length;

  return {
    _meta: {
      total,
      counts: {
        weapons:   weapons.length,
        armor:     armor.length,
        monsters:  monsters.length,
        artifacts: artifacts.length,
        potions:   potions.length,
        materials: materials.length,
        currency:  currency.length,
      },
      generatedAt: new Date().toISOString(),
      instructions: [
        '1. For each asset, copy the "prompt" field into your AI image tool.',
        '2. Use "negativePrompt" for the negative prompt field.',
        '3. Save output PNG to the "filename" path shown.',
        '4. Recommended size: 256x256px for items/potions/currency/materials.',
        '   Weapons: 256x512px. Armor: 256x256px. Monsters: 512x512px.',
        '5. Use white or transparent background.',
        'Midjourney: use the "midjourney" field directly.',
      ],
    },
    weapons,
    armor,
    monsters,
    artifacts,
    potions,
    materials,
    currency,
  };
}

// ── Write asset directory placeholders (README files so folders exist in git) ─
function writeAssetReadmes() {
  const dirs = [
    ['assets/weapons/sword',   'Sword-type weapon images'],
    ['assets/weapons/spear',   'Spear/lance weapon images'],
    ['assets/weapons/staff',   'Staff/wand/tome weapon images'],
    ['assets/weapons/bow',     'Bow weapon images'],
    ['assets/weapons/axe',     'Axe/maul weapon images'],
    ['assets/weapons/scythe',  'Scythe weapon images'],
    ['assets/weapons/dagger',  'Dagger/knife weapon images'],
    ['assets/weapons/fist',    'Fist/knuckle weapon images'],
    ['assets/weapons/tome',    'Tome/orb weapon images'],
    ['assets/weapons/shield',  'Shield weapon images'],
    ['assets/weapons/special', 'Special weapon images'],
    ['assets/armor/helm',      'Helmet images'],
    ['assets/armor/chest',     'Chest armor images'],
    ['assets/armor/cloak',     'Cloak images'],
    ['assets/armor/vam',       'Vambrace images'],
    ['assets/armor/boot',      'Boot images'],
    ['assets/armor/ring',      'Ring images'],
    ['assets/monsters',        'Monster images'],
    ['assets/items',           'Potion and consumable images'],
    ['assets/items/materials', 'Crafting material images'],
    ['assets/currency',        'Currency images'],
    ['assets/rig',             'Rig animation spritesheets'],
    ['assets/gates',           'Gate background frames'],
    ['assets/videos',          'Gate MP4 videos (blue_gate.mp4, red_gate.mp4)'],
  ];

  for (const [dir, desc] of dirs) {
    const full = path.join(DATA_ROOT, dir);
    fs.mkdirSync(full, { recursive: true });
    const readme = path.join(full, 'README.md');
    if (!fs.existsSync(readme)) {
      fs.writeFileSync(readme, `# ${dir}\n${desc}\n\nDrop AI-generated PNG files here.\n`);
    }
  }
}

// ── CLI ────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  writeAssetReadmes();
  const all      = generateAllAssetPrompts();
  const outJson  = path.join(DATA_ROOT, 'asset_prompts.json');
  const outSummary = path.join(DATA_ROOT, 'asset_prompts_summary.txt');

  fs.writeFileSync(outJson, JSON.stringify(all, null, 2), 'utf8');
  console.log(`\n✅ asset_prompts.json written (${all._meta.total} assets)`);

  // Write human-readable summary
  const lines = [
    '╔══════════════════════════════════════════════════════╗',
    '║          ✦ 𝐀𝐬𝐭𝐫𝐚™ — Asset Prompt Summary               ║',
    '╚══════════════════════════════════════════════════════╝',
    '',
    `Total assets: ${all._meta.total}`,
    '',
    '── WEAPONS ──',
    ...all.weapons.map(w => `  [${w.rarity.padEnd(9)}] [${w.type.padEnd(7)}] ${w.name}  →  ${w.filename}`),
    '',
    '── ARMOR ──',
    ...all.armor.map(a => `  [${a.rarity.padEnd(9)}] [${a.slot.padEnd(5)}] ${a.name}  →  ${a.filename}`),
    '',
    '── MONSTERS ──',
    ...all.monsters.map(m => `  [Rank ${m.rank}] ${m.isBoss ? '[BOSS]' : '      '} ${m.name}  →  ${m.filename}`),
    '',
    '── ARTIFACTS ──',
    ...all.artifacts.map(a => `  ${a.name}  →  ${a.filename}`),
    '',
    '── POTIONS & ITEMS ──',
    ...all.potions.map(p => `  ${p.name}  →  ${p.filename}`),
    '',
    '── MATERIALS ──',
    ...all.materials.map(m => `  [${m.rank}] ${m.name}  →  ${m.filename}`),
    '',
    '── CURRENCY ──',
    ...all.currency.map(c => `  ${c.name}  →  ${c.filename}`),
    '',
    '── INSTRUCTIONS ──',
    ...all._meta.instructions.map(i => `  ${i}`),
  ];

  fs.writeFileSync(outSummary, lines.join('\n'), 'utf8');
  console.log(`✅ asset_prompts_summary.txt written`);

  console.log('\n── COUNTS ──');
  for (const [cat, count] of Object.entries(all._meta.counts)) {
    console.log(`  ${cat.padEnd(12)}: ${count}`);
  }
  console.log(`  ${'TOTAL'.padEnd(12)}: ${all._meta.total}`);
  console.log('\nRun: node rpg/skins/AssetPromptGenerator.js');
  console.log('Then feed asset_prompts.json into your AI image tool.\n');
}

module.exports = {
  generateAllAssetPrompts,
  buildWeaponPrompt,
  buildArmorPrompt,
  buildMonsterPrompt,
  buildMaterialPrompt,
  buildArtifactPrompt,
  buildPotionPrompt,
  buildCurrencyPrompt,
  writeAssetReadmes,
};
