/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           ✦ 𝐀𝐬𝐭𝐫𝐚™ — SkinPromptGenerator.js                    ║
 * ║  Generates Midjourney / DALL-E prompts for all 230 skins.    ║
 * ║                                                              ║
 * ║  Usage:                                                      ║
 * ║    node rpg/skins/SkinPromptGenerator.js                     ║
 * ║  Outputs: skin_prompts.json in project root                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { SKINS, RARITY_LABEL } = require('./SkinCatalog');

// ── Frame spec (must match RigSpec) ───────────────────────────────────────────
const FRAME_W = 256;
const FRAME_H = 512;

// ── Base skin texture requirements ────────────────────────────────────────────
// Injected into every prompt — defines what a skin IS technically.
const SKIN_BASE = `
Full-body anime character skin texture designed to overlay a humanoid rig template.
The character occupies 85-90% of the frame height, centred.
Transparent PNG background. Clean anime art style.
The design must cover: head/hair, torso/outfit, arms, legs, feet.
No weapons drawn in hand (weapon overlays are added separately by the engine).
Facing forward (slight 3/4 angle acceptable).
Resolution: ${FRAME_W}x${FRAME_H}px.
`.trim().replace(/\n/g,' ');

// ── Rarity design guidelines ───────────────────────────────────────────────────
const RARITY_DESIGN = {
  common: `
Simple, minimal design. Muted or earthy colour palette (greys, browns, faded blues).
No special effects, no glows, no ornate details. Basic clothing — tunic, trousers, 
simple cloak or vest. Clean lines. Looks like a starting character.
Flat shading acceptable. Low visual complexity.`,

  uncommon: `
Noticeably better design than common. Clear colour identity (one dominant colour).
Some distinctive feature: a hood, scarf, unique hair colour, simple pattern on clothing.
Minimal glow or shimmer on one element (eyes or weapon slot).
Clean cel-shading. Recognisable at a glance.`,

  rare: `
Strong distinct design with a clear visual theme matching the character's anime source.
Bold colour palette. Detailed outfit — armour, unique silhouette, signature elements.
Visible power: faint energy lines, subtle aura glow around the body.
High-quality cel shading with highlights. Anime TV production quality.`,

  epic: `
Complex, layered design with strong visual identity. 
Advanced outfit — layered armour, flowing cape/coat, intricate details.
Clear power aura: glowing eyes, energy particles floating around the body,
dramatic colour contrast (dark + bright accent).
Character design feels like a boss or main antagonist.
Cinematic anime quality — movie production level.`,

  legendary: `
Iconic, recognisable character design at peak visual fidelity.
Intricate outfit details — multiple layers, elemental effects integrated into clothing.
Dominant aura effects: pulsing glow, energy erupting from shoulders/hands/feet,
dramatic particle effects.
Colour palette is bold and unforgettable. Instantly conveys absolute power.
Looks like it belongs in a feature film. Every detail deliberate.`,

  mythic: `
TRANSCENDENT. Beyond normal human design.
The character radiates an aura that fills the frame — crackling energy, void cracks,
divine light, or absolute darkness depending on theme.
Outfit is a fusion of the character's origins and something beyond — cosmic, divine, or primordial.
Multiple visual layers: background glow, mid aura, foreground detail.
The design reads instantly as the most powerful thing in the game.
Ultra-cinematic — comparable to promotional key art.
The character feels like it exists between dimensions.`,
};

// ── Theme style notes ──────────────────────────────────────────────────────────
const THEME_NOTES = {
  'Solo Leveling':   'inspired by Solo Leveling manhwa art style — clean dark backgrounds, blue/purple shadow energy, dramatic lighting',
  'Demon Slayer':    'inspired by Demon Slayer anime — vibrant flame/water/wind patterns, detailed haori/kimono, dynamic hair',
  'JJK':             'inspired by Jujutsu Kaisen — cursed energy purple/black/blue, modern casual-meets-battle outfit',
  'HxH':             'inspired by Hunter x Hunter — clean Togashi style, Nen aura, varied but grounded designs',
  'Naruto':          'inspired by Naruto/Boruto — chakra energy, headband, detailed shinobi outfit, nature element markings',
  'One Piece':       'inspired by One Piece — bold Oda-style silhouettes, dramatic haki aura, pirate/marine themed',
  'Bleach':          'inspired by Bleach — black shihakusho or captain haori, spiritual pressure visible, reishi particles',
  'FMA':             'inspired by Fullmetal Alchemist — detailed military coat, alchemy transmutation circles, steel elements',
  'AOT':             'inspired by Attack on Titan — Survey Corps cloak, ODM gear, earthy military colour palette',
  'MHA':             'inspired by My Hero Academia — hero costume design, quirk energy visible, vibrant colour scheme',
  'Chainsaw Man':    'inspired by Chainsaw Man — raw brutal energy, blood red accents, devilish features',
  'Re:Zero':         'inspired by Re:Zero — maid/royal attire, oni markings for demon characters, detailed fantasy',
  'Dr. Stone':       'inspired by Dr. Stone — stone markings, science elements, practical but unique attire',
  'Mob Psycho':      'inspired by Mob Psycho 100 — simple everyday clothing that belies immense power, psychic aura',
  'Dragon Ball':     'inspired by Dragon Ball Super — energy aura dominating the frame, iconic outfit with ki lines',
  'Code Geass':      'inspired by Code Geass — Zero costume, royal Britannian design, elegant and theatrical',
  'Fate':            'inspired by Fate series — Noble Phantasm aura, historical/mythological armour, magical circuits',
  'One Punch Man':   'inspired by One Punch Man — iconic hero outfit, bored expression belying immense power',
  'Overlord':        'inspired by Overlord — undead skeletal overlord design, dark lord aesthetic, detailed robes',
  'Akame ga Kill':   'inspired by Akame ga Kill — teigu/imperial arms visible, dark fantasy battle outfit',
  'Steins;Gate':     'inspired by Steins;Gate — lab coat, time machine motifs, divergence meter effects',
  'Generic':         'original anime art style, not tied to a specific series, clean professional game art',
  'Medieval':        'western medieval anime art style, armour and crest details',
  'Fantasy':         'high fantasy anime art style, magical elements and ornate details',
  'Japanese':        'traditional Japanese anime art style, kimono or hakama, cultural details',
  'Military':        'military anime art style, uniform and tactical gear',
  'Gintama':         'inspired by Gintama — iconic white coat, wooden sword, casual-cool energy',
  'Blue Exorcist':   'inspired by Blue Exorcist — school uniform over demon power, blue flame accents',
  'That Time I Got Reincarnated': 'inspired by Tensei Shitara Slime — slime form elements combined with demon lord regalia',
};

// ── Archetype pose notes ───────────────────────────────────────────────────────
const ARCHETYPE_NOTES = {
  warrior:  'confident combat stance, weight balanced, ready to engage',
  mage:     'one hand slightly raised, magical energy visible at fingertips',
  rogue:    'slightly crouched, weight on balls of feet, subtle readiness',
  archer:   'relaxed but alert, hand near a non-existent quiver, focused eyes',
  tank:     'solid wide stance, arms slightly out, immovable presence',
  support:  'open posture, slight lean forward, warm but capable energy',
  special:  'unique signature pose matching their specific power or ability',
};

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildSkinPrompt(skin) {
  const rarityGuide  = RARITY_DESIGN[skin.rarity].trim().replace(/\n/g,' ');
  const themeNote    = THEME_NOTES[skin.theme] || THEME_NOTES['Generic'];
  const archetypePos = ARCHETYPE_NOTES[skin.archetype] || ARCHETYPE_NOTES.warrior;

  const prompt = [
    SKIN_BASE,
    `CHARACTER: ${skin.name} — ${skin.lore}`,
    `ARCHETYPE: ${skin.archetype} — ${archetypePos}`,
    `RARITY: ${RARITY_LABEL[skin.rarity]} — ${rarityGuide}`,
    `THEME/STYLE: ${themeNote}`,
    `TAGS for visual reference: ${skin.tags.join(', ')}`,
    `ADDITIONAL: anime full-body character concept art, game skin design,`,
    `transparent background, facing forward, no weapons in hand, clean outlines`,
  ].join('. ').replace(/\s+/g,' ').trim();

  const negativePrompt = [
    'weapons in hand', 'holding weapon', 'sword drawn',
    'background scene', 'environment', 'landscape',
    'realistic', 'photograph', '3D render', 'chibi',
    'cut off at waist', 'partial body', 'face only',
    'text', 'watermark', 'signature', 'blurry',
    'low quality', 'multiple characters',
    'western cartoon', 'pixar style',
  ].join(', ');

  return {
    id:             skin.id,
    name:           skin.name,
    rarity:         skin.rarity,
    theme:          skin.theme,
    archetype:      skin.archetype,
    filename:       `assets/skins/${skin.rarity}/${skin.id}.png`,
    prompt,
    negativePrompt,
    midjourney:     `${prompt} --ar 1:2 --style anime --q 2 --no ${negativePrompt}`,
    dallePrompt:    `${prompt}. White transparent background. Anime art style. Full body visible.`,
    notes:          `Save as: assets/skins/${skin.rarity}/${skin.id}.png | Size: ${FRAME_W}x${FRAME_H}px`,
  };
}

// ── Generate all prompts ───────────────────────────────────────────────────────

function generateAllSkinPrompts() {
  const result = {
    _meta: {
      total:      SKINS.length,
      byRarity: {},
      generatedAt: new Date().toISOString(),
      instructions: [
        '1. For each skin entry, copy the "prompt" field into your AI image tool.',
        '2. Use "negativePrompt" for the negative prompt field.',
        '3. Save the output as PNG to the "filename" path shown.',
        '4. Image size should be 256x512px (1:2 aspect ratio).',
        '5. Transparent or white background preferred — the engine handles compositing.',
        'Midjourney users: use the "midjourney" field directly.',
        'DALL-E users: use the "dallePrompt" field.',
      ],
    },
    skins: {},
  };

  const counts = {};
  for (const skin of SKINS) {
    if (!result.skins[skin.rarity]) result.skins[skin.rarity] = [];
    result.skins[skin.rarity].push(buildSkinPrompt(skin));
    counts[skin.rarity] = (counts[skin.rarity] || 0) + 1;
  }
  result._meta.byRarity = counts;
  return result;
}

// ── CLI ────────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const all     = generateAllSkinPrompts();
  const outPath = path.join(__dirname, '..', '..', 'skin_prompts.json');
  fs.writeFileSync(outPath, JSON.stringify(all, null, 2), 'utf8');

  console.log('\n╔══════════════════════════════════╗');
  console.log('║  ✦ 𝐀𝐬𝐭𝐫𝐚™ — Skin Prompt Generator  ║');
  console.log('╚══════════════════════════════════╝\n');
  console.log(`Total skins: ${SKINS.length}`);
  for (const [rarity, count] of Object.entries(all._meta.byRarity)) {
    const emoji = { common:'⚪',uncommon:'🟢',rare:'🔵',epic:'🟣',legendary:'🟡',mythic:'🔴' }[rarity];
    console.log(`  ${emoji} ${rarity.padEnd(10)} — ${count} skins`);
  }
  console.log(`\nOutput: ${outPath}`);
  console.log('\n── INSTRUCTIONS ──');
  all._meta.instructions.forEach(i => console.log(`  ${i}`));
  console.log();
}

module.exports = { generateAllSkinPrompts, buildSkinPrompt };
