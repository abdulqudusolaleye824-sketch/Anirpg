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
  Common:    { emoji: '⬜', cost: 1662, description: 'A worn scroll. Simple recipes inside.' },
  Uncommon:  { emoji: '🟩', cost: 4988, description: 'A sealed scroll. Moderate recipes await.' },
  Rare:      { emoji: '🟦', cost: 16625, description: 'A glowing scroll. Rare power sealed within.' },
  Epic:      { emoji: '🟪', cost: 49875, description: 'A pulsing scroll. Epic power radiates from it.' },
  Legendary: { emoji: '🟨', cost: 166250, description: 'A blazing scroll. Legendary weapons sleep within.' },
  Mythic:    { emoji: '🔴', cost: 665000, description: 'A world-breaking scroll. Only legends dare read it.' },
};

const SCROLL_SHOP_ITEMS = Object.entries(SCROLL_RARITIES).map(([rarity, data], i) => ({
  id: `sc${i + 1}`,
  name: `${rarity} Recipe Scroll`,
  rarity,
  emoji: data.emoji,
  desc: data.description,
  cost: Math.round(data.cost * 1.15), // Push #103k-e: +15%
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
// Fix (10-26, BUG-202/203 — owner): LEGENDARY gear is A-rank gear, so its recipe asks for A-rank parts (the sheet listed
// S-rank beast/boss parts). Deterministic remap S→A by drop-list position (same monster/boss family slot), applied to
// every recipe the moment it is read/previewed/crafted — scrolls already in bags included. Mythic (S) stays S.
let _S2A = null;
function _s2aMap() {
  if (_S2A) return _S2A;
  _S2A = new Map();
  try {
    const { MONSTER_DROPS, BASE_MATERIALS } = require('../data/MonsterDrops');
    const flat = (r, k) => ((MONSTER_DROPS[r] && MONSTER_DROPS[r][k]) || []).flatMap(m => [...(m.drops || []), m.primary, m.secondary].filter(Boolean).map(String));
    for (const k of ['monsters', 'bosses']) { const S = flat('S', k), A = flat('A', k); if (!A.length) continue; S.forEach((n, i) => { if (!_S2A.has(n)) _S2A.set(n, A[i % A.length]); }); }
    { const S = (BASE_MATERIALS && BASE_MATERIALS.S) || [], A = (BASE_MATERIALS && BASE_MATERIALS.A) || []; if (A.length) S.forEach((n, i) => { if (!_S2A.has(n)) _S2A.set(n, A[i % A.length]); }); }
  } catch (e) {}
  try { // Solo Leveling gate beasts (the bulk of the Legendary sheet)
    const SL = require('../data/SoloLevelingMonsters').SL_MONSTERS || {};
    const fl = (r) => (SL[r] || []).flatMap(m => (m.drops || []).map(String));
    const S = fl('S'), A = fl('A'); if (A.length) S.forEach((n, i) => { if (!_S2A.has(n)) _S2A.set(n, A[i % A.length]); });
  } catch (e) {}
  return _S2A;
}
// Fix (10-26, owner): MYTHIC sheets named 25 materials that no beast, boss or gate drops (God Corpse Fragment, World-Tree
// Branch…). Any material that is not obtainable anywhere is swapped for a real S-rank / Disaster drop (deterministic by name).
let _OBTAINABLE = null, _S_POOL = null;
function _obtainable() {
  if (_OBTAINABLE) return _OBTAINABLE;
  _OBTAINABLE = new Set(); _S_POOL = [];
  const add = (n) => { if (n) _OBTAINABLE.add(String(n).toLowerCase()); };
  try {
    const { MONSTER_DROPS, BASE_MATERIALS } = require('../data/MonsterDrops');
    for (const [r, blk] of Object.entries(MONSTER_DROPS || {})) for (const k of ['monsters', 'bosses']) for (const m of (blk && blk[k]) || []) for (const d of [...(m.drops || []), m.primary, m.secondary].filter(Boolean)) { add(d); if (r === 'S' || r === 'DISASTER') _S_POOL.push(String(d)); }
    for (const [r, list] of Object.entries(BASE_MATERIALS || {})) for (const d of list || []) { add(d); if (r === 'S' || r === 'DISASTER') _S_POOL.push(String(d)); }
  } catch (e) {}
  try { const SL = require('../data/SoloLevelingMonsters').SL_MONSTERS || {}; for (const [r, arr] of Object.entries(SL)) for (const m of arr || []) for (const d of m.drops || []) { add(d); if (String(r).toUpperCase() === 'S') _S_POOL.push(String(d)); } } catch (e) {}
  for (const r of ['E', 'D', 'C', 'B', 'A', 'S']) add(`${r}-Rank Mana Essence`);
  return _OBTAINABLE;
}
function _hash(str) { let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function normalizeRecipeMaterials(recipe, rarity) {
  try {
    if (!recipe || !recipe.materials || recipe._matsNormalized) return recipe;
    const rar = String(rarity || '').toLowerCase();
    if (rar !== 'legendary' && rar !== 'mythic') return recipe;
    const out = {};
    if (rar === 'legendary') {
      const map = _s2aMap();
      for (const [m, q] of Object.entries(recipe.materials)) { const to = map.get(m) || m; out[to] = (out[to] || 0) + (Number(q) || 0); }
    } else {
      const ok = _obtainable(); const pool = _S_POOL || [];
      for (const [m, q] of Object.entries(recipe.materials)) { const to = (ok.has(String(m).toLowerCase()) || !pool.length) ? m : pool[_hash(m) % pool.length]; out[to] = (out[to] || 0) + (Number(q) || 0); }
    }
    recipe.materials = out; recipe._matsNormalized = true;
  } catch (e) {}
  return recipe;
}
function craftPreview(player, itemName, key, db) {
  const hit = findScroll(key, db);
  if (!hit) return { ok: false, reason: '❌ Invalid or already used craft key.' };
  const { scroll, ownerJid } = hit;
  const recipe = normalizeRecipeMaterials(scroll.recipe, scroll.rarity);
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
  return { ok: true, scroll, ownerJid, recipe, rarity: scroll.rarity, mats, essence, nexus, nexusCost, successPct: (() => { try { return require("./ClassSnippets").craftAlwaysSucceeds(player) ? 100 : Math.round(CRAFT_SUCCESS * 100); } catch (e) { return Math.round(CRAFT_SUCCESS * 100); } })(), discount: _disc, missing, canCraft: missing.length === 0 };
}

// ── Push #103b: TIMED FORGING ───────────────────────────────────────────────
// Confirming a craft pays everything, rolls the forge and starts a JOB. The
// piece is delivered when the timer ends (group notice; Pro also DM via serf).
//   E/Common 12h · D/Uncommon 1d · C/Rare 1.5d · B/Epic 2d · A/Legendary 3d · S/Mythic 5d
//   Pro: 50% time. Shaman: 100% success and a choice — QUANTITY (−20% time, plain)
//   or QUALITY (+20% all stats & durability, normal time). Pro does not change either.
const H = 3600e3;
const CRAFT_TIME_MS = { Common: 12 * H, Uncommon: 24 * H, Rare: 36 * H, Epic: 48 * H, Legendary: 72 * H, Mythic: 120 * H };
const QUALITY_MULT = 1.20, QUANTITY_TIME = 0.80;
function _isShaman(player) { try { return require('./ClassSnippets').craftAlwaysSucceeds(player); } catch (e) { return false; } }
function _isPro(player) { try { return require('./UI').isPro(player); } catch (e) { return !!(player && player.isPro); } }
function craftModes(player) { return _isShaman(player) ? ['quality', 'quantity'] : ['standard']; }
function craftDurationMs(player, rarity, mode = 'standard') {
  const k = String(rarity || 'Common'); const base = CRAFT_TIME_MS[k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()] || CRAFT_TIME_MS.Common;
  let ms = base;
  if (_isPro(player)) ms *= 0.5;
  if (mode === 'quantity' && _isShaman(player)) ms *= QUANTITY_TIME;
  return Math.round(ms);
}
function fmtDur(ms) { ms = Math.max(0, ms); const d = Math.floor(ms / 86400e3), h = Math.floor(ms % 86400e3 / H), m = Math.floor(ms % H / 60e3); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; }
function jobsOf(db, jid) { return (db && Array.isArray(db.craftJobs) ? db.craftJobs : []).filter(j => j && j.owner === jid && !j.done); }

function attemptCraft(player, itemName, key, db, opts = {}) {
  const pv = craftPreview(player, itemName, key, db);
  if (!pv.ok) return { success: false, reason: pv.reason };
  const { scroll: targetScroll, ownerJid: scrollOwnerJid, recipe } = pv;
  if (!pv.canCraft) return { success: false, reason: `❌ Missing for *${recipe.output}*:\n${pv.missing.map(m => `• ${m}`).join('\n')}`, preview: pv };
  const mode = craftModes(player).includes(opts.mode) ? opts.mode : craftModes(player)[0];
  // Pay everything up front — a failed forge burns it all (the player was warned on the preview screen).
  for (const m of pv.mats) RI.consumeMaterial(player, m.mat, m.need);
  require('./EssenceStones').consume(player, pv.essence.rank, pv.essence.need);
  player.gold = (Number(player.gold) || 0) - pv.nexusCost;
  try { require('./TransactionLog').logSpend(player, 'craft', pv.nexusCost, 0, recipe.output); } catch (e) {}
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const _sure = _isShaman(player);
  const willFail = !_sure && rng() >= CRAFT_SUCCESS;
  if (willFail) {
    player.craftFails = (player.craftFails || 0) + 1;
    return { success: false, failed: true, preview: pv, scrollOwnerJid, spent: { mats: pv.mats, essence: pv.essence, nexus: pv.nexusCost },
      reason: `💥 *CRAFT FAILED!* The forge rejected *${recipe.output}* the moment it was lit.\nLost: ${pv.mats.map(m => `${m.mat} ×${m.need}`).join(', ')}, ${pv.essence.name} ×${pv.essence.need}, 💠 ${pv.nexusCost.toLocaleString()} Nexus.\n📜 The scroll (key *${key}*) survives — gather again and retry.` };
  }
  {
    targetScroll.crafted = true; targetScroll.craftedBy = player.jid || 'unknown'; targetScroll.craftedAt = Date.now();
    if (scrollOwnerJid && db.users[scrollOwnerJid]) { const os = (db.users[scrollOwnerJid].inventory?.scrolls || []).find(s => s.key === key); if (os) { os.crafted = true; os.craftedBy = player.jid || 'unknown'; os.craftedAt = Date.now(); } }
  }
  const ms = craftDurationMs(player, targetScroll.rarity, mode);
  const job = {
    id: `cj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, owner: player.jid || opts.owner || null, ownerName: player.name || 'Hunter',
    chatId: opts.chatId || null, key, scrollOwnerJid: scrollOwnerJid || null,
    recipe: { output: recipe.output, type: recipe.type, subtype: recipe.subtype, lore: recipe.lore || null }, rarity: targetScroll.rarity,
    mode, willFail, startedAt: Date.now(), readyAt: Date.now() + ms, done: false, notified: false,
    spent: { mats: pv.mats.map(m => ({ mat: m.mat, need: m.need })), essence: { name: pv.essence.name, need: pv.essence.need }, nexus: pv.nexusCost },
  };
  if (!Array.isArray(db.craftJobs)) db.craftJobs = [];
  db.craftJobs.push(job);
  return { success: true, started: true, job, mode, ms, readyAt: job.readyAt, preview: pv, scrollOwnerJid, spent: { mats: pv.mats, essence: pv.essence, nexus: pv.nexusCost } };
}

// Deliver one finished job into its owner's bag. Returns { success, failed, item, granted, job }.
function finishCraft(db, job) {
  const player = db.users && job.owner ? db.users[job.owner] : null;
  job.done = true; job.finishedAt = Date.now();
  if (!player) return { success: false, job, reason: 'owner missing' };
  const Armory = require('./ArmoryStore');
  const inst = Armory.craftInstance(job.recipe, job.rarity, player, job.mode === 'quality' ? { quality: QUALITY_MULT, qualityLabel: 'Shaman Masterwork' } : {});
  inst.craftedBy = job.ownerName; inst.craftedAt = Date.now(); inst.fromKey = job.key;
  if (!player.inventory) player.inventory = {}; if (!Array.isArray(player.inventory.items)) player.inventory.items = [];
  player.inventory.items.push(inst);
  const item = { name: inst.name, emoji: inst.emoji, type: inst.type, subtype: job.recipe.subtype, rarity: inst.rarity, rank: inst.rank, durability: inst.durability, maxDurability: inst.maxDurability,
    ...(inst.isWeapon ? { atk: inst.attack } : {}), ...(inst.stats || {}), quality: inst.quality || null, craftedBy: job.ownerName, lore: inst.lore };
  return { success: true, item, granted: inst, slot: inst.slot || (inst.isWeapon ? 'weapon' : null), invIndex: player.inventory.items.length - 1, job };
}
function dueJobs(db) { const now = Date.now(); return (db && Array.isArray(db.craftJobs) ? db.craftJobs : []).filter(j => j && !j.done && j.readyAt <= now); }
function finishedLines(res, pro) {
  const UIx = require('./UI'); const F = pro ? UIx.PRO_BAR : UIx.FREE_BAR; const j = res.job;
  if (!res.success) return [F, `⚒️ *FORGE COMPLETE — ${j.recipe.output}*`, F, res.reason || 'The forge went cold.', F].join('\n');
  const it = res.item; const st = [];
  if (it.atk) st.push(`ATK +${it.atk}`); for (const k of ['def', 'hp', 'speed', 'evasion', 'critDmg', 'atk']) if (k !== 'atk' && it[k]) st.push(`${k.toUpperCase()} +${it[k]}`);
  const g = res.granted; const fx = g.isWeapon && g.effects && g.effects.length ? g.effects.map(e => `${e.type} ${e.chance}%`).join(', ') : (g.special || '');
  return [F, `🔨 *FORGED!* ${it.emoji || '✨'} *${it.name}*${it.quality ? ` · ✨ ${it.quality} (+20%)` : ''}`, F,
    `⭐ ${String(it.rank)}-rank ${String(it.rarity).toUpperCase()} ${it.type}${res.slot ? ` · slot: ${res.slot}` : ''}`,
    st.length ? `📊 ${st.join(' · ')}` : null, fx ? `✨ ${fx}` : null, `🔧 Durability: *${it.durability}/${it.maxDurability}* (store-grade, scaled to your level)`,
    `🎒 In your /inv as item *#${res.invIndex + 1}* — */equip ${res.invIndex + 1}*`, F].filter(Boolean).join('\n');
}
// Sweep: deliver every due job; group notice (+ Pro DM via serf). Call every minute from index.js.
async function tick(db, saveDatabase) {
  const due = dueJobs(db); if (!due.length) return 0;
  let MSM = null; try { MSM = require('../../bots/MultiSocketManager'); } catch (e) {}
  let n = 0;
  for (const job of due) {
    let res; try { res = finishCraft(db, job); } catch (e) { job.done = true; job.error = e.message; continue; }
    n++;
    const player = db.users[job.owner]; const pro = _isPro(player);
    const text = finishedLines(res, pro);
    try {
      const sk = MSM && job.chatId && MSM.getActiveSocket ? MSM.getActiveSocket(job.chatId) : null;
      if (sk) { await sk.sendMessage(job.chatId, { text: `${text}\n@${String(job.owner || '').split('@')[0]}`, mentions: job.owner ? [job.owner] : [] }).catch(() => {}); job.notified = true; }
      if (pro && sk) { try { await require('./SerfDM').sendSerfDM(sk, db, job.owner, { text }); } catch (e) {} }
    } catch (e) {}
    try { if (res.success) { const _BP = require('./BattlePass'); if (_BP.addPassXPAmount) _BP.addPassXPAmount(player, 50); } } catch (e) {}
    try { if (res.success) require('./WeeklyGuildWar').addGP(db, job.owner, 75, saveDatabase); } catch (e) {}
    try { if (res.success && job.scrollOwnerJid && job.scrollOwnerJid !== job.owner && db.users[job.scrollOwnerJid]) { const sk2 = MSM && job.chatId && MSM.getActiveSocket ? MSM.getActiveSocket(job.chatId) : null; if (sk2) await require('./SerfDM').sendSerfDM(sk2, db, job.scrollOwnerJid, { text: `🔑 *YOUR SCROLL KEY WAS USED*\nSomeone used your craft key *${job.key}* and forged *${job.recipe.output}*. Your scroll has been consumed.` }); } } catch (e) {}
  }
  // prune finished jobs older than 7 days
  db.craftJobs = db.craftJobs.filter(j => !(j.done && (Date.now() - (j.finishedAt || 0)) > 7 * 86400e3));
  if (n && typeof saveDatabase === 'function') saveDatabase();
  return n;
}

function checkMaterials(player, recipe, rarity) {
  if (rarity) normalizeRecipeMaterials(recipe, rarity);
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
  const recipe = normalizeRecipeMaterials(scroll.recipe || {}, scroll.rarity);
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
  // Fix (10-26, BUG-217/203): the scroll shows the stats the forge will ACTUALLY produce — the /store ladder for the
  // rarity's rank (Legendary = A-rank store numbers), not the old sheet numbers.
  let statLines = '';
  try {
    const Armory = require('./ArmoryStore'); const inst = Armory.craftInstance(recipe, scroll.rarity, player || { level: 1, stats: {}, inventory: { items: [] } });
    const st = inst.isWeapon ? { atk: inst.attack } : (inst.stats || {});
    statLines = Object.entries(st).filter(([, v]) => v).map(([k, v]) => `${k === 'hp' ? 'HP' : k.toUpperCase()}: +${Math.round(Number(v))}`).join(' | ');
    if (inst.rank) statLines += `  _(${inst.rank}-rank store grade)_`;
  } catch (e) { statLines = Object.entries(recipe.stats || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`).join(' | '); }
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
  normalizeRecipeMaterials,
  CRAFT_TIME_MS, QUALITY_MULT, QUANTITY_TIME, craftModes, craftDurationMs, fmtDur, jobsOf, finishCraft, dueJobs, finishedLines, tick,
  recipeCategoryOf,
  RECIPES, SCROLL_RARITIES, SCROLL_SHOP_ITEMS,
  generateCraftKey, buyScroll, readScroll,
  attemptCraft, checkMaterials, formatScrollRead,
  craftPreview, craftNexusCost, findScroll, CRAFT_NEXUS_COST, CRAFT_SUCCESS,
};
