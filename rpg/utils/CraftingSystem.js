// ═══════════════════════════════════════════════════════════════
// CRAFTING SYSTEM — Astra
// 1,500 craftable items across 6 rarities
// Sessions 1-5 hand-crafted. Session 6 (Mythic) pending.
// ═══════════════════════════════════════════════════════════════

const Common    = require('../data/recipes_common.js');
const Uncommon  = require('../data/recipes_uncommon.js');
const Rare      = require('../data/recipes_rare.js');
const Epic      = require('../data/recipes_epic.js');
const Legendary = require('../data/recipes_legendary.js');
const Mythic    = require('../data/recipes_mythic.js');

const RECIPES = { Common, Uncommon, Rare, Epic, Legendary, Mythic };

const SCROLL_RARITIES = {
  Common:    { emoji: '⬜', cost: 500,    description: 'A worn scroll. Simple recipes inside.' },
  Uncommon:  { emoji: '🟩', cost: 1500,   description: 'A sealed scroll. Moderate recipes await.' },
  Rare:      { emoji: '🟦', cost: 5000,   description: 'A glowing scroll. Rare power sealed within.' },
  Epic:      { emoji: '🟪', cost: 15000,  description: 'A pulsing scroll. Epic power radiates from it.' },
  Legendary: { emoji: '🟨', cost: 50000,  description: 'A blazing scroll. Legendary weapons sleep within.' },
  Mythic:    { emoji: '🔴', cost: 200000, description: 'A world-breaking scroll. Only legends dare read it.' },
};

const SCROLL_SHOP_ITEMS = Object.entries(SCROLL_RARITIES).map(([rarity, data], i) => ({
  id: `sc${i + 1}`,
  name: `${rarity} Recipe Scroll`,
  rarity,
  emoji: data.emoji,
  desc: data.description,
  cost: data.cost,
  type: 'scroll',
}));

function generateCraftKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = '';
  for (let i = 0; i < 6; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

function buyScroll(rarity) {
  const pool = RECIPES[rarity];
  if (!pool) return null;
  const types = ['weapons','helmet','chest','gloves','boots','leggings','accessories','artifacts'];
  const typeKey = types[Math.floor(Math.random() * types.length)];
  const list = pool[typeKey];
  const rawRecipe = list[Math.floor(Math.random() * list.length)];
  const key = generateCraftKey();

  const isArmor = ['helmet','chest','gloves','boots','leggings'].includes(typeKey);
  const mainType = isArmor ? 'armor' : typeKey === 'weapons' ? 'weapon' : typeKey === 'accessories' ? 'accessory' : typeKey === 'artifacts' ? 'artifact' : 'item';
  const subType = typeKey.charAt(0).toUpperCase() + typeKey.slice(1);

  const recipe = {
    type: rawRecipe.type || mainType,
    subtype: rawRecipe.subtype || subType,
    ...rawRecipe,
  };

  return {
    id: `scroll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    rarity,
    emoji: SCROLL_RARITIES[rarity]?.emoji || '📜',
    recipe, key,
    revealed: false, crafted: false,
    purchasedAt: Date.now(),
  };
}

function readScroll(scroll) {
  if (!scroll) return null;
  scroll.revealed = true;
  return scroll;
}

function attemptCraft(player, itemName, key, db) {
  let targetScroll = null, scrollOwnerJid = null;
  for (const [jid, user] of Object.entries(db.users || {})) {
    const scrolls = user.inventory?.scrolls || [];
    const found = scrolls.find(s => s.key === key && !s.crafted);
    if (found) { targetScroll = found; scrollOwnerJid = jid; break; }
  }
  if (!targetScroll) return { success: false, reason: '❌ Invalid or already used craft key.' };
  const recipe = targetScroll.recipe;
  if (recipe.output.toLowerCase() !== itemName.toLowerCase())
    return { success: false, reason: `❌ Key *${key}* is for *${recipe.output}*, not *${itemName}*.` };
  const playerMaterials = {};
  for (const mat of (player.inventory?.materials || []))
    playerMaterials[mat.name] = (playerMaterials[mat.name] || 0) + 1;
  const missing = [];
  for (const [mat, qty] of Object.entries(recipe.materials)) {
    const have = playerMaterials[mat] || 0;
    if (have < qty) missing.push(`${mat} (need ${qty}, have ${have})`);
  }
  if (missing.length > 0) return { success: false, reason: `❌ Missing materials:\n${missing.map(m => `• ${m}`).join('\n')}` };
  for (const [mat, qty] of Object.entries(recipe.materials)) {
    let remaining = qty;
    player.inventory.materials = player.inventory.materials.filter(m => {
      if (m.name === mat && remaining > 0) { remaining--; return false; }
      return true;
    });
  }
  targetScroll.crafted = true; targetScroll.craftedBy = player.jid || 'unknown'; targetScroll.craftedAt = Date.now();
  if (scrollOwnerJid && db.users[scrollOwnerJid]) {
    const ownerScroll = (db.users[scrollOwnerJid].inventory?.scrolls || []).find(s => s.key === key);
    if (ownerScroll) { ownerScroll.crafted = true; ownerScroll.craftedBy = player.jid || 'unknown'; ownerScroll.craftedAt = Date.now(); }
  }
  const craftedItem = {
    name: recipe.output, type: recipe.type, subtype: recipe.subtype, rarity: targetScroll.rarity,
    ...recipe.stats, durability: recipe.durability, maxDurability: recipe.durability,
    infusions: [], craftedAt: Date.now(), craftedBy: player.name || 'Unknown Hunter', fromKey: key,
    ...(recipe.lore ? { lore: recipe.lore } : {}),
  };
  if (!player.inventory) player.inventory = { weapons:[], armor:[], potions:[], artifacts:[], accessories:[], materials:[], scrolls:[], keyStones:[] };
  const bucket = recipe.type === 'weapon' ? 'weapons' : recipe.type === 'armor' ? 'armor' : recipe.type === 'artifact' ? 'artifacts' : recipe.type === 'accessory' ? 'accessories' : 'materials';
  player.inventory[bucket].push(craftedItem);
  return { success: true, item: craftedItem, scrollOwnerJid };
}

function checkMaterials(player, recipe) {
  const playerMaterials = {};
  for (const mat of (player.inventory?.materials || []))
    playerMaterials[mat.name] = (playerMaterials[mat.name] || 0) + 1;
  return Object.entries(recipe.materials).map(([mat, qty]) => ({
    mat, need: qty, have: playerMaterials[mat] || 0, ok: (playerMaterials[mat] || 0) >= qty,
  }));
}

function formatScrollRead(scroll) {
  const recipe = scroll.recipe || {};
  const mainType = recipe.type ? (recipe.type.charAt(0).toUpperCase() + recipe.type.slice(1)) : 'Equipment';
  const subTypeStr = recipe.subtype ? ` (${recipe.subtype.charAt(0).toUpperCase() + recipe.subtype.slice(1)})` : '';
  const typeDisplay = `${mainType}${subTypeStr}`;

  const matLines = Object.entries(recipe.materials || {}).map(([mat, qty]) => `  • ${mat} ×${qty}`).join('\n');
  const statLines = Object.entries(recipe.stats || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`).join(' | ');
  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `${scroll.emoji || '📜'} *${(scroll.rarity || 'Common').toUpperCase()} RECIPE SCROLL*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📜 *Recipe: ${recipe.output || 'Unknown Item'}*`,
    `🗂️ Type: ${typeDisplay}`,
    `⚔️ Stats: ${statLines || 'None'}`,
    `🛡️ Durability: ${recipe.durability || 'N/A'}`,
    recipe.lore ? `📖 *Lore:* _${recipe.lore}_` : ``,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🧪 *MATERIALS REQUIRED*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    matLines,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🔑 *CRAFT KEY: ${scroll.key || 'N/A'}*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `⚠️ Guard this key carefully.`,
    `Anyone with the key + materials can craft this item.`,
    `Once crafted, this scroll is consumed forever.`,
    ``,
    `📌 To craft: */craft ${recipe.output} --${scroll.key}*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');
}

module.exports = {
  RECIPES, SCROLL_RARITIES, SCROLL_SHOP_ITEMS,
  generateCraftKey, buyScroll, readScroll,
  attemptCraft, checkMaterials, formatScrollRead,
};
