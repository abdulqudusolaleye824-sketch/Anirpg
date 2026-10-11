const UI = require('./UI');
const RI = require('./RewardInventory');

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

// Push #71: Solo Leveling recipes (built from the new bestiary drops) join the
// scroll pools — a scroll of each rarity can now roll either a classic or an
// SL recipe, so the new gate materials are actually craftable.
try {
  const SLR = require('../data/recipes_sololeveling.js');
  for (const [rarity, groups] of Object.entries(SLR)) {
    if (!RECIPES[rarity]) continue;
    for (const [type, list] of Object.entries(groups)) {
      if (!Array.isArray(RECIPES[rarity][type])) RECIPES[rarity][type] = [];
      const have = new Set(RECIPES[rarity][type].map(r => r.output));
      for (const r of list) if (!have.has(r.output)) RECIPES[rarity][type].push(r);
    }
  }
} catch (e) { console.error('[Crafting] SL recipes not loaded:', e.message); }

// Push #97 (BUG-010): recipe output → category (weapons / helmet / chest / gloves / boots / leggings / accessories / artifacts)
let _catByName = null;
function recipeCategoryOf(name) {
  if (!_catByName) {
    _catByName = {};
    for (const pool of Object.values(RECIPES)) for (const [cat, list] of Object.entries(pool || {})) for (const r of (list || [])) if (r && r.output) _catByName[String(r.output).toLowerCase()] = cat;
  }
  return _catByName[String(name || '').toLowerCase()] || null;
}

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

// Push #97: crafting costs Nexus (by scroll rarity) and has a 90% success / 10% failure roll.
const CRAFT_NEXUS_COST = { Common: 5000, Uncommon: 15000, Rare: 50000, Epic: 150000, Legendary: 500000, Mythic: 1500000 };
const CRAFT_SUCCESS = 0.90;
function craftNexusCost(rarity) { const k = String(rarity || 'Common'); return CRAFT_NEXUS_COST[k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()] || 5000; }

function findScroll(key, db) {
  for (const [jid, user] of Object.entries(db.users || {})) {
    const scrolls = user.inventory?.scrolls || [];
    const found = scrolls.find(s => s.key === key && !s.crafted);
    if (found) return { scroll: found, ownerJid: jid };
  }
  return null;
}

// Everything the craft screen / image needs: materials (have/need), essence stones, Nexus, success odds.
function craftPreview(player, itemName, key, db) {
  const hit = findScroll(key, db);
  if (!hit) return { ok: false, reason: '❌ Invalid or already used craft key.' };
  const { scroll, ownerJid } = hit;
  const recipe = scroll.recipe;
  if (itemName && recipe.output.toLowerCase() !== String(itemName).toLowerCase())
    return { ok: false, reason: `❌ Key *${key}* is for *${recipe.output}*, not *${itemName}*.` };
  try { RI.migrateLegacy(player); } catch (e) {}
  let _disc = 0; try { _disc = require('./JobSystem').mod(player, 'craftDiscount'); } catch (e) {}
  const _need = (qty) => Math.max(1, Math.ceil(qty * (1 - _disc / 100)));
  const mats = Object.entries(recipe.materials || {}).map(([mat, qty]) => { const need = _need(qty); const have = RI.countMaterial(player, mat); return { mat, need, have, ok: have >= need }; });
  const ES = require('./EssenceStones');
  const req = ES.requiredFor(recipe, scroll.rarity);
  const essence = { name: req.name, rank: req.rank, emoji: ES.emojiFor(req.rank), need: req.count, have: ES.count(player, req.rank), get ok() { return this.have >= this.need; } };
  const nexusCost = craftNexusCost(scroll.rarity);
  const nexus = { need: nexusCost, have: Number(player.gold) || 0, ok: (Number(player.gold) || 0) >= nexusCost };
  const missing = [...mats.filter(m => !m.ok).map(m => `${m.mat} (need ${m.need}, have ${m.have})`), ...(!essence.ok ? [`${essence.name} (need ${essence.need}, have ${essence.have})`] : []), ...(!nexus.ok ? [`💠 ${nexusCost.toLocaleString()} Nexus (have ${nexus.have.toLocaleString()})`] : [])];
  return { ok: true, scroll, ownerJid, recipe, rarity: scroll.rarity, mats, essence, nexus, nexusCost, successPct: Math.round(CRAFT_SUCCESS * 100), discount: _disc, missing, canCraft: missing.length === 0 };
}

function attemptCraft(player, itemName, key, db, opts = {}) {
  const pv = craftPreview(player, itemName, key, db);
  if (!pv.ok) return { success: false, reason: pv.reason };
  const { scroll: targetScroll, ownerJid: scrollOwnerJid, recipe } = pv;
  if (!pv.canCraft) return { success: false, reason: `❌ Missing for *${recipe.output}*:\n${pv.missing.map(m => `• ${m}`).join('\n')}`, preview: pv };
  // Pay everything up front — a failed craft burns it all (the player was warned on the preview screen).
  for (const m of pv.mats) RI.consumeMaterial(player, m.mat, m.need);
  require('./EssenceStones').consume(player, pv.essence.rank, pv.essence.need);
  player.gold = (Number(player.gold) || 0) - pv.nexusCost;
  try { require('./TransactionLog').logSpend(player, 'craft', pv.nexusCost, 0, recipe.output); } catch (e) {}
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  if (rng() >= CRAFT_SUCCESS) {
    player.craftFails = (player.craftFails || 0) + 1;
    return { success: false, failed: true, preview: pv, scrollOwnerJid, spent: { mats: pv.mats, essence: pv.essence, nexus: pv.nexusCost },
      reason: `💥 *CRAFT FAILED!* The forge rejected *${recipe.output}*.\nLost: ${pv.mats.map(m => `${m.mat} ×${m.need}`).join(', ')}, ${pv.essence.name} ×${pv.essence.need}, 💠 ${pv.nexusCost.toLocaleString()} Nexus.\n📜 The scroll (key *${key}*) survives — gather materials and try again (90% success).` };
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
    ...(recipe.onHit ? { onHit: recipe.onHit } : {}),
  };
  // Commit to the live inventory: wearables → items (normalized gear shape,
  // visible to /gear + /equip). Artifacts keep their own bucket (the artifact
  // system reads it); anything else → items as material.
  // Push #97 (BUG-010): EVERY crafted piece (artifacts included) goes into the normal inventory as gear —
  // artifacts wear in the cloak slot; helmets/boots/gloves land in their own slots (subtype decides).
  const _granted = RI.grantItem(player, { ...craftedItem, source: 'craft' }, 'craft',
    { subtype: craftedItem.subtype, infusions: craftedItem.infusions || [], craftedBy: craftedItem.craftedBy, fromKey: craftedItem.fromKey, craftedAt: craftedItem.craftedAt });
  let _invIndex = -1; try { _invIndex = (player.inventory.items || []).indexOf(_granted); } catch (e) {}
  return { success: true, item: craftedItem, granted: _granted, slot: _granted && _granted.slot, invIndex: _invIndex, scrollOwnerJid, preview: pv, spent: { mats: pv.mats, essence: pv.essence, nexus: pv.nexusCost } };
}

function checkMaterials(player, recipe) {
  // Push #84: same detector crafting uses (items + legacy + counters).
  try { RI.migrateLegacy(player); } catch (e) {}
  const mats = recipe?.materials || {};
  return Object.entries(mats).map(([mat, qty]) => {
    const have = RI.countMaterial(player, mat);
    return { mat, need: qty, have, ok: have >= qty };
  });
}

function formatScrollRead(scroll, player = null) {
  const scrollPro = UI.isPro(player || {});
  const FRAME = scrollPro ? UI.PRO_BAR : UI.FREE_BAR;
  const recipe = scroll.recipe || {};
  const mainType = recipe.type ? (recipe.type.charAt(0).toUpperCase() + recipe.type.slice(1)) : 'Equipment';
  const subTypeStr = recipe.subtype ? ` (${recipe.subtype.charAt(0).toUpperCase() + recipe.subtype.slice(1)})` : '';
  const typeDisplay = `${mainType}${subTypeStr}`;

  // Push #71: show WHERE each Solo Leveling material drops.
  let _src = {};
  try {
    const SL = require('../data/SoloLevelingMonsters');
    for (const [rank, list] of Object.entries(SL.SL_MONSTERS)) for (const m of list) for (const d of m.drops) {
      if (!_src[d]) _src[d] = { rank, from: [] };
      if (_src[d].from.length < 2 && !_src[d].from.includes(m.name)) _src[d].from.push(m.name);
    }
  } catch (e) {}
  const matLines = Object.entries(recipe.materials || {}).map(([mat, qty]) => {
    const s = _src[mat];
    if (player) { try { RI.migrateLegacy(player); } catch (e) {} }
    const have = player ? RI.countMaterial(player, mat) : null;
    const tail = s ? (mat.endsWith('Mana Essence') ? `  _(any ${s.rank}-rank gate monster)_` : `  _(${s.rank}-gate: ${s.from.join(', ')})_`) : '';
    return `  • ${mat} ×${qty}${have !== null ? ` (have ${have})` : ''}${tail}`;
  }).join('\n');
  const statLines = Object.entries(recipe.stats || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`).join(' | ');
  return [
    ...(scrollPro ? [UI.PRO_BAR, `${scroll.emoji || '📜'} *${(scroll.rarity || 'Common').toUpperCase()} RECIPE SCROLL* 💎`, UI.PRO_BAR] : [`${scroll.emoji || '📜'} *${(scroll.rarity || 'Common').toUpperCase()} RECIPE SCROLL*`, UI.FREE_BAR]),
    ``,
    `📜 *Recipe: ${recipe.output || 'Unknown Item'}*`,
    `🗂️ Type: ${typeDisplay}`,
    `⚔️ Stats: ${statLines || 'None'}`,
    `🛡️ Durability: ${recipe.durability || 'N/A'}`,
    recipe.lore ? `📖 *Lore:* _${recipe.lore}_` : ``,
    ``,
    FRAME,
    `🧪 *MATERIALS REQUIRED*`,
    FRAME,
    matLines,
    (() => { try { const ES = require('./EssenceStones'); const r = ES.requiredFor(recipe, scroll.rarity); const have = player ? ES.count(player, r.rank) : null; return `  • ${ES.emojiFor(r.rank)} ${r.name} ×${r.count}${have !== null ? ` (have ${have})` : ''}  _(${r.rank}-gate beasts/boss, mining)_`; } catch (e) { return ''; } })(),
    `  • 💠 ${craftNexusCost(scroll.rarity).toLocaleString()} Nexus forge fee · 🎲 90% success (a fail burns the materials)`,
    ``,
    FRAME,
    `🔑 *CRAFT KEY: ${scroll.key || 'N/A'}*`,
    FRAME,
    ``,
    `⚠️ Guard this key carefully.`,
    `Anyone with the key + materials can craft this item.`,
    `Once crafted, this scroll is consumed forever.`,
    ``,
    `📌 To craft: */craft ${recipe.output} --${scroll.key}*`,
    `♻️ Missing mats? */recycle* turns 3 unwanted same-rank materials into 1 you need (PRO gets tap buttons).`,
    FRAME,
  ].join('\n');
}

module.exports = {
  recipeCategoryOf,
  RECIPES, SCROLL_RARITIES, SCROLL_SHOP_ITEMS,
  generateCraftKey, buyScroll, readScroll,
  attemptCraft, checkMaterials, formatScrollRead,
  craftPreview, craftNexusCost, findScroll, CRAFT_NEXUS_COST, CRAFT_SUCCESS,
};
