// ═══════════════════════════════════════════════════════════════
// ITEM EMOJI — Push #71
// One place that decides the icon shown next to an item. Rarity keeps its
// colour dot; the ITEM itself now gets a glyph based on slot / type / name
// instead of every entry being 📦.
//   icon(item)      → '🗡️'
//   rarityDot(r)    → '🔵'
//   tag(item)       → '🔵🗡️'  (dot + icon; used by /inv, /find, /food)
// ═══════════════════════════════════════════════════════════════
'use strict';

const RARITY = { mythic: '🌌', legendary: '🟠', epic: '🟣', rare: '🔵', uncommon: '🟢', common: '⚪', divine: '✨' };

const SLOT = {
  weapon: '🗡️', weapons: '🗡️', helmet: '🪖', head: '🪖', chest: '🛡️', body: '🛡️', gloves: '🧤', hands: '🧤',
  boots: '🥾', feet: '🥾', leggings: '👖', legs: '👖', accessory: '💍', accessories: '💍', ring: '💍',
  necklace: '📿', pendant: '📿', artifact: '🔮', artifacts: '🔮', relic: '🔮', shield: '🛡️', cape: '🧣',
};

const NAME_RULES = [
  [/mana essence/i, '💠'], [/essence|dust|ash|powder/i, '✨'],
  [/potion|elixir|vial|tonic/i, '🧪'], [/scroll/i, '📜'], [/key\b/i, '🔑'], [/egg\b/i, '🥚'],
  [/kibble|feast|feed|berry|meat|fish|herb|bone treat/i, '🍖'],
  [/sword|blade|katana|saber|rapier|edge/i, '⚔️'], [/dagger|knife|claws?$/i, '🗡️'], [/axe|cleaver|maul|hammer|crusher|mace/i, '🪓'],
  [/bow|crossbow/i, '🏹'], [/staff|wand|rod|scepter|warstaff/i, '🪄'], [/spear|lance|pike|halberd|glaive/i, '🔱'],
  [/helm|crown|visor|hood|skullcap|mask|circlet/i, '🪖'], [/plate|cuirass|mantle|armor|carapace|robe|vest|mail/i, '🛡️'],
  [/gauntlet|grip|bracer|handguard|gloves?/i, '🧤'], [/greaves|treads|striders|sabatons|boots/i, '🥾'],
  [/legplates|chausses|tassets|leggings|cuisses/i, '👖'], [/ring|band$/i, '💍'], [/pendant|amulet|charm|talisman|necklace/i, '📿'],
  [/core|idol|relic|totem|sigil|orb|crystal ball/i, '🔮'],
  [/fang|tooth|tusk|mandible|ivory/i, '🦷'], [/claw|nail|talon/i, '🪝'], [/scale|shell|carapace|chitin/i, '🐚'],
  [/heart|blood|venom|gland/i, '🩸'], [/horn/i, '🦌'], [/hide|pelt|fur|leather|skin/i, '🟫'], [/wing|feather|membrane/i, '🪶'],
  [/bone|skull|rib|marrow|toe/i, '🦴'], [/ingot|steel|iron|alloy|metal|plate fragment/i, '⛓️'], [/stone|rock|shard|fragment|gem|crystal|ice|obsidian|granite|slate/i, '💎'],
  [/cloth|silk|thread|string|sinew|wool/i, '🧵'], [/wood|totem wood|log|branch|bark/i, '🪵'], [/coal|ember|flame|lava|magma|cinder|fire/i, '🔥'],
  [/frost|ice|glacial|snow/i, '❄️'], [/shadow|void|dark|abyss|null/i, '🌑'], [/light|holy|divine|ruler/i, '☀️'],
  [/slime/i, '🟢'], [/eye/i, '👁️'], [/\bear\b|antenna|tail|tongue/i, '🧬'], [/pick|tool/i, '⛏️'], [/coin|nexus|gold/i, '💠'],
];

function rarityDot(r) { return RARITY[String(r || 'common').toLowerCase()] || '⚪'; }

function icon(item) {
  if (!item) return '📦';
  if (typeof item === 'string') item = { name: item };
  if (item.emoji && /^\p{Extended_Pictographic}/u.test(item.emoji)) return item.emoji;
  const type = String(item.type || '').toLowerCase();
  const slot = String(item.slot || item.subtype || '').toLowerCase();
  if (type === 'petfood' || item.isPetFood) return '🍖';
  if (type === 'scroll') return '📜';
  if (type === 'egg') return '🥚';
  if (type === 'consumable' || type === 'potion') return '🧪';
  if (item.kind === 'card') return '🃏';
  if (SLOT[slot]) return SLOT[slot];
  const name = String(item.name || '');
  for (const [re, e] of NAME_RULES) {
    if (type === 'material' && e === '🔮' && /core/i.test(name)) return '💠'; // monster cores are materials, not artifacts
    if (re.test(name)) return e;
  }
  if (type === 'material') return '🧱';
  if (type === 'weapon' || item.isWeapon) return '🗡️';
  if (type === 'armor' || item.isGear) return '🛡️';
  if (type === 'accessory') return '💍';
  if (type === 'artifact') return '🔮';
  return '📦';
}

function tag(item) { return `${rarityDot(item && item.rarity)}${icon(item)}`; }

module.exports = { RARITY, rarityDot, icon, tag };
