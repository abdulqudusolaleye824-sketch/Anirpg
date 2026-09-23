// ═══════════════════════════════════════════════════════════════
// ARMORY STORE — Push #76
//
// The ONLY source of weapons and gear. Rotates DAILY (WAT midnight, seeded
// per day so every bot/process shows the same stock). Every item is a
// pre-crafted, fully-rolled instance with lore, real stats, a durability
// pool scaled to the buyer's level, and (from B rank up) real status
// mechanics that combat honours:
//
//   WEAPONS  E/D/C  → flat ATK (50–150), no status
//            B      → up to 250 ATK + ONE on-hit status (low chance 12–20%)
//            A      → up to 550 ATK + ONE on-hit status (high chance 35–55%)
//            S      → up to 2,000 ATK + 2–3 on-hit statuses (30–60% each)
//   GEAR     E/D/C  → DEF + HP (helmets/chest/cloak/vambrace/ring), boots +SPD
//            B      → + resist ONE status (low 15–25%) AND −1 turn on every effect
//            A      → + resist ONE status (high 45–65%) + HP + DEF
//            S      → IMMUNE to the listed statuses + HP + DEF
//   Boots of every rank add SPEED on top.
//
// PRICE moves with the actual roll inside the rank band (better stats →
// closer to the band ceiling). A/S also cost Mana Stones.
//
// Ownership model: a store item is a normal inventory entry (`isGear` gear
// goes to the 6 gear slots; weapons are `isWeapon` and equip into
// player.weapon). Both are transferable with /equip gift — nothing here is
// soul-bound. Durability: −1 per fight (weapon on hit, gear on being hit);
// at 0 the item BREAKS and is removed. A Mending Stone restores 100%.
// ═══════════════════════════════════════════════════════════════
'use strict';

const crypto = require('crypto');

const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];
const RANK_EMOJI = { E: '⚪', D: '🟢', C: '🔵', B: '🟣', A: '🟠', S: '🌌' };
const RANK_RARITY = { E: 'common', D: 'uncommon', C: 'rare', B: 'epic', A: 'legendary', S: 'mythic' };

// Price bands (Nexus) + Mana Stone bands for A/S.
const BANDS = {
  E: { nexus: [50_000, 100_000],       stones: [0, 0] },
  D: { nexus: [100_000, 150_000],      stones: [0, 0] },
  C: { nexus: [200_000, 350_000],      stones: [0, 0] },
  B: { nexus: [350_000, 500_000],      stones: [0, 0] },
  A: { nexus: [500_000, 1_000_000],    stones: [150_000, 350_000] },
  S: { nexus: [1_000_000, 10_000_000], stones: [400_000, 2_000_000] },
};

// Stat ceilings per rank. `roll` ∈ [0,1] picks the point in the band.
const WEAPON_ATK = { E: [50, 80], D: [75, 110], C: [100, 150], B: [150, 250], A: [300, 550], S: [800, 2000] };
const GEAR_DEF   = { E: [20, 45], D: [40, 70], C: [60, 110], B: [100, 170], A: [160, 300], S: [350, 900] };
const GEAR_HP    = { E: [50, 100], D: [90, 160], C: [150, 260], B: [240, 420], A: [400, 800], S: [900, 2400] };
const BOOT_SPD   = { E: [5, 10], D: [8, 14], C: [12, 20], B: [18, 30], A: [28, 45], S: [45, 90] };

// Durability pool (max) at level 1 per rank; scales ×(1 + level/40) at purchase.
const BASE_DUR = { E: 30, D: 40, C: 55, B: 75, A: 100, S: 150 };

const STATUSES = ['poison', 'burn', 'bleed', 'stun', 'freeze', 'weaken', 'fear', 'blind', 'paralyze', 'curse', 'silence'];
const STATUS_EMOJI = { poison: '☠️', burn: '🔥', bleed: '🩸', stun: '💫', freeze: '❄️', weaken: '💔', fear: '😱', blind: '🌫️', paralyze: '🔱', curse: '💀', silence: '🤐' };

const WEAPON_TYPES = ['Sword', 'Greatsword', 'Katana', 'Spear', 'Bow', 'Dagger', 'Axe', 'Staff', 'Scythe', 'Gauntlets', 'Halberd', 'Rapier'];
const WEAPON_EMOJI = { Sword: '🗡️', Greatsword: '⚔️', Katana: '🗡️', Spear: '🔱', Bow: '🏹', Dagger: '🔪', Axe: '🪓', Staff: '🪄', Scythe: '⚰️', Gauntlets: '🥊', Halberd: '⚔️', Rapier: '🤺' };

const GEAR_SLOTS = ['helmet', 'chestplate', 'boots', 'cloak', 'vambrace', 'ring'];
const SLOT_EMOJI = { helmet: '⛑️', chestplate: '🦺', boots: '👢', cloak: '🧥', vambrace: '🥋', ring: '💍' };
const SLOT_NOUN  = { helmet: ['Helm', 'Crown', 'Visor', 'Circlet'], chestplate: ['Plate', 'Cuirass', 'Hauberk', 'Aegis'], boots: ['Greaves', 'Treads', 'Striders', 'Sabatons'], cloak: ['Cloak', 'Mantle', 'Shroud', 'Veil'], vambrace: ['Vambrace', 'Bracers', 'Gauntlet', 'Grips'], ring: ['Ring', 'Band', 'Signet', 'Loop'] };

const PREFIX = {
  E: ['Worn', 'Rusted', 'Trainee', 'Iron', 'Plain', 'Militia'],
  D: ['Steel', 'Tempered', 'Hunter', 'Guild', 'Honed', 'Bronze'],
  C: ['Runed', 'Silvered', 'Warden', 'Gale', 'Ember', 'Frost'],
  B: ['Cursed', 'Venom', 'Stormforged', 'Shadowbound', 'Bloodsworn', 'Hexed'],
  A: ['Dragonbone', 'Voidsteel', 'Sunforged', 'Abyssal', 'Celestial', 'Wyrmscale'],
  S: ['Monarch\'s', 'Ruler\'s', 'Kamish\'s', 'Architect\'s', 'Eclipse', 'Godslayer'],
};
const SUFFIX = ['of the Gate', 'of Ashborn', 'of the Shadow Army', 'of Jeju', 'of the Red Gate', 'of the Demon Castle', 'of Baran', 'of the Ant King', 'of the Frost Monarch', 'of the Beast Monarch', 'of Cartenon', 'of the Architect'];

const LORE_W = [
  'Forged from ore that fell with the first gate, it hums when a boss is near.',
  'Pulled from the corpse of an S-rank magic beast, still warm three days later.',
  'A hunter\'s last weapon. The Association never learned his name.',
  'Etched with runes no guild scholar can read; the edge never dulls.',
  'Said to remember every kill — swing it and feel the weight of them.',
  'Tempered in the breath of a dungeon dragon and quenched in shadow.',
  'Once belonged to a rank-up candidate who reawakened mid-raid.',
  'The blacksmiths of Hunter HQ refuse to say where the metal came from.',
];
const LORE_G = [
  'Woven with mana threads that tighten when your heart rate spikes.',
  'Scavenged from a collapsed A-rank gate; the previous owner walked out.',
  'Layered plating that drinks in the first blow and gives it back as heat.',
  'The lining is spun from magic-beast sinew; it breathes like skin.',
  'Guild-issue, but reforged so many times only the emblem is original.',
  'Every dent is a story. The armorer stopped hammering them out.',
  'Carries the faint smell of the Frost Monarch\'s halls, no matter how you clean it.',
  'A gift from a shadow soldier to a hunter who never came back for it.',
];

// ── Deterministic daily RNG ──────────────────────────────────────────────────
const WAT_MS = 60 * 60 * 1000;
function dayKey(ms = Date.now()) {
  const d = new Date(ms + WAT_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function msUntilRotation(ms = Date.now()) {
  const d = new Date(ms + WAT_MS);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - WAT_MS;
  return Math.max(0, next - ms);
}
function makeRng(seed) {
  let h = crypto.createHash('sha256').update(String(seed)).digest();
  let i = 0;
  return () => {
    if (i + 4 > h.length) { h = crypto.createHash('sha256').update(h).digest(); i = 0; }
    const v = h.readUInt32BE(i); i += 4;
    return v / 0x100000000;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const lerp = (a, b, t) => Math.round(a + (b - a) * t);

// ── Pricing ─────────────────────────────────────────────────────────────────
function priceFor(rank, roll) {
  const b = BANDS[rank];
  const t = Math.max(0, Math.min(1, roll));
  const round = (v, step) => Math.round(v / step) * step;
  const nexus = round(lerp(b.nexus[0], b.nexus[1], t), rank === 'S' ? 50_000 : 1_000);
  const stones = b.stones[1] ? round(lerp(b.stones[0], b.stones[1], t), 5_000) : 0;
  return { nexus, stones };
}

// ── Generators ──────────────────────────────────────────────────────────────
function genWeapon(rank, rng, idx) {
  const roll = rng();
  const [lo, hi] = WEAPON_ATK[rank];
  const atk = lerp(lo, hi, roll);
  const type = pick(rng, WEAPON_TYPES);
  const name = `${pick(rng, PREFIX[rank])} ${type} ${pick(rng, SUFFIX)}`;
  const effects = [];
  if (rank === 'B') effects.push({ type: pick(rng, STATUSES), chance: lerp(12, 20, roll), duration: 3 });
  if (rank === 'A') effects.push({ type: pick(rng, STATUSES), chance: lerp(35, 55, roll), duration: 4 });
  if (rank === 'S') {
    const n = 2 + (rng() < 0.5 ? 1 : 0);
    const pool = STATUSES.slice();
    for (let i = 0; i < n; i++) { const s = pool.splice(Math.floor(rng() * pool.length), 1)[0]; effects.push({ type: s, chance: lerp(30, 60, roll), duration: 4 }); }
  }
  const price = priceFor(rank, roll);
  return {
    sku: `W${rank}${idx}`, kind: 'weapon', rank, rarity: RANK_RARITY[rank], emoji: WEAPON_EMOJI[type] || '🗡️',
    name, weaponType: type, atk, effects, lore: pick(rng, LORE_W), price, roll: Math.round(roll * 100),
  };
}

function genGear(rank, rng, idx) {
  const roll = rng();
  const slot = pick(rng, GEAR_SLOTS);
  const noun = pick(rng, SLOT_NOUN[slot]);
  const name = `${pick(rng, PREFIX[rank])} ${noun} ${pick(rng, SUFFIX)}`;
  const stats = { def: lerp(...GEAR_DEF[rank], roll), hp: lerp(...GEAR_HP[rank], roll) };
  if (slot === 'boots') stats.speed = lerp(...BOOT_SPD[rank], roll);
  if (slot === 'vambrace') stats.atk = Math.round(stats.def * 0.35);
  if (slot === 'cloak') stats.evasion = lerp(2, rank === 'S' ? 15 : rank === 'A' ? 10 : 6, roll);
  if (slot === 'ring') stats.critDmg = lerp(5, rank === 'S' ? 60 : rank === 'A' ? 35 : 15, roll);
  const resist = [];      // { type, chance }  B/A
  const immune = [];      // [type]           S
  let turnReduce = 0;
  if (rank === 'B') { resist.push({ type: pick(rng, STATUSES), chance: lerp(15, 25, roll) }); turnReduce = 1; }
  if (rank === 'A') { resist.push({ type: pick(rng, STATUSES), chance: lerp(45, 65, roll) }); turnReduce = 1; }
  if (rank === 'S') {
    const n = 2 + (rng() < 0.5 ? 1 : 0);
    const pool = STATUSES.slice();
    for (let i = 0; i < n; i++) immune.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    turnReduce = 1;
  }
  const price = priceFor(rank, roll);
  return {
    sku: `G${rank}${idx}`, kind: 'gear', rank, rarity: RANK_RARITY[rank], emoji: SLOT_EMOJI[slot],
    name, slot, stats, resist, immune, turnReduce, lore: pick(rng, LORE_G), price, roll: Math.round(roll * 100),
  };
}

// ── Today's stock ───────────────────────────────────────────────────────────
// 2 weapons + 2 gear per rank = 24 items. Same on every process for the day.
let _cache = { key: null, stock: null };
function getStock(ms = Date.now()) {
  const key = dayKey(ms);
  if (_cache.key === key) return _cache.stock;
  const rng = makeRng(`armory:${key}`);
  const stock = [];
  for (const rank of RANKS) {
    for (let i = 1; i <= 2; i++) stock.push(genWeapon(rank, rng, i));
    for (let i = 1; i <= 2; i++) stock.push(genGear(rank, rng, i));
  }
  stock.forEach((it, i) => { it.no = i + 1; });
  _cache = { key, stock };
  return stock;
}
function findStock(noOrSku) {
  const s = getStock();
  const n = parseInt(noOrSku, 10);
  if (!isNaN(n)) return s.find(x => x.no === n) || null;
  return s.find(x => x.sku.toLowerCase() === String(noOrSku || '').toLowerCase()) || null;
}

// ── Purchase → inventory instance ───────────────────────────────────────────
function maxDurabilityFor(rank, level) {
  return Math.round(BASE_DUR[rank] * (1 + Math.max(1, Number(level) || 1) / 40));
}
function instantiate(stockItem, player) {
  const lvl = player?.level || 1;
  const maxDurability = maxDurabilityFor(stockItem.rank, lvl);
  const id = `${stockItem.sku}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const base = {
    id, name: stockItem.name, emoji: stockItem.emoji, rank: stockItem.rank, rarity: stockItem.rarity,
    lore: stockItem.lore, fromStore: true, storeDay: dayKey(), acquiredAt: Date.now(),
    durability: maxDurability, maxDurability, transferable: true,
  };
  if (stockItem.kind === 'weapon') {
    return { ...base, isWeapon: true, type: 'Weapon', weaponType: stockItem.weaponType,
      attack: stockItem.atk, bonus: stockItem.atk, effects: stockItem.effects.map(e => ({ ...e })) };
  }
  return { ...base, isGear: true, type: 'Armor', slot: stockItem.slot, stats: { ...stockItem.stats },
    resist: stockItem.resist.map(r => ({ ...r })), immune: stockItem.immune.slice(), turnReduce: stockItem.turnReduce,
    special: describeGearSpecial(stockItem) };
}
function describeGearSpecial(g) {
  const parts = [];
  if (g.immune && g.immune.length) parts.push(`IMMUNE to ${g.immune.map(t => `${STATUS_EMOJI[t]} ${t}`).join(', ')}`);
  for (const r of g.resist || []) parts.push(`${r.chance}% to shrug off ${STATUS_EMOJI[r.type]} ${r.type}`);
  if (g.turnReduce) parts.push(`every status on you lasts −${g.turnReduce} turn`);
  return parts.length ? { id: 'store', desc: parts.join(' · ') } : null;
}

function buy(player, noOrSku) {
  const item = findStock(noOrSku);
  if (!item) return { ok: false, error: 'No such item in today\'s stock. See /store.' };
  const gold = player.gold || 0, stones = player.manaCrystals || 0;
  if (gold < item.price.nexus) return { ok: false, error: `Not enough Nexus — need ${item.price.nexus.toLocaleString()} 💠, have ${gold.toLocaleString()}.` };
  if (stones < item.price.stones) return { ok: false, error: `Not enough Mana Stones — need ${item.price.stones.toLocaleString()} 💎, have ${stones.toLocaleString()}.` };
  player.gold = gold - item.price.nexus;
  if (item.price.stones) player.manaCrystals = stones - item.price.stones;
  try { require('./TransactionLog').logSpend(player, 'store', item.price.nexus, item.price.stones); } catch (e) {}
  if (!player.inventory) player.inventory = {};
  if (!Array.isArray(player.inventory.items)) player.inventory.items = [];
  const inst = instantiate(item, player);
  player.inventory.items.push(inst);
  return { ok: true, item, inst };
}

// ── Equip / durability / mending ─────────────────────────────────────────────
function equipWeapon(player, inst) {
  if (!inst || !inst.isWeapon) return { ok: false, error: 'Not a weapon.' };
  const items = player.inventory?.items || [];
  const i = items.findIndex(x => x.id === inst.id);
  if (i === -1) return { ok: false, error: 'That weapon is not in your inventory.' };
  items.splice(i, 1);
  const old = player.weapon && player.weapon.id ? player.weapon : null;
  // Old store weapon goes BACK to the bag (it is an item, not a stat sponge).
  if (old && old.fromStore) items.push(old);
  player.weapon = { ...inst, name: inst.name, bonus: inst.attack, attack: inst.attack };
  // Weapon on-hit statuses are read from player.weapon.effects in combat.
  return { ok: true, old };
}
function unequipWeapon(player) {
  const w = player.weapon;
  if (!w || !w.fromStore) return { ok: false, error: 'No store weapon equipped.' };
  if (!player.inventory) player.inventory = {};
  if (!Array.isArray(player.inventory.items)) player.inventory.items = [];
  player.inventory.items.push({ ...w });
  player.weapon = null;
  return { ok: true, weapon: w };
}

/** Called by combat: −1 weapon durability on a landed hit. Returns broken item or null. */
function wearWeapon(player) {
  const w = player && player.weapon;
  if (!w || !w.fromStore || w.maxDurability == null) return null;
  w.durability = Math.max(0, (w.durability || 0) - 1);
  if (w.durability === 0) { player.weapon = null; return w; }
  return null;
}
/** Called by combat: −1 durability on every equipped gear piece when hit. Returns broken pieces. */
function wearGear(player) {
  const eq = player && player.equippedGear;
  if (!eq) return [];
  const broken = [];
  for (const slot of Object.keys(eq)) {
    const p = eq[slot];
    if (!p || p.maxDurability == null) continue;
    p.durability = Math.max(0, (p.durability || 0) - 1);
    if (p.durability === 0) { broken.push(p); delete eq[slot]; }
  }
  return broken;
}
/** Push #88c: /mend all SHARES one stone — 100% of restoration split evenly
 *  across every damaged item (10 items → each gets +10% of its max durability).
 *  Returns { count, items:[{name,before,after,max}] }. */
function mendAllShared(player) {
  const targets = [];
  const add = (p) => { if (p && p.maxDurability != null && (p.durability || 0) < p.maxDurability) targets.push(p); };
  if (player.weapon) add(player.weapon);
  for (const p of Object.values(player.equippedGear || {})) add(p);
  for (const p of (player.inventory?.items || [])) if (p && (p.isGear || p.isWeapon)) add(p);
  if (!targets.length) return { count: 0, items: [] };
  const share = 100 / targets.length; // % of each item's max durability
  const items = [];
  for (const p of targets) {
    const before = p.durability || 0;
    const gain = Math.max(1, Math.floor(p.maxDurability * share / 100));
    p.durability = Math.min(p.maxDurability, before + gain);
    items.push({ name: p.name, before, after: p.durability, max: p.maxDurability });
  }
  return { count: targets.length, sharePct: Math.round(share * 10) / 10, items };
}
/** Mending Stone: everything equipped + store items in the bag back to 100%. (legacy; no longer used by /mend all) */
function mendAll(player) {
  let n = 0;
  const fix = (p) => { if (p && p.maxDurability != null && p.durability < p.maxDurability) { p.durability = p.maxDurability; n++; } };
  if (player.weapon) fix(player.weapon);
  for (const p of Object.values(player.equippedGear || {})) fix(p);
  for (const p of (player.inventory?.items || [])) if (p && (p.isGear || p.isWeapon)) fix(p);
  return n;
}

// ── Combat hooks ────────────────────────────────────────────────────────────
/** Store-gear defence against an incoming status. Returns {blocked, reason} */
function statusDefense(defender, type) {
  const t = String(type || '').toLowerCase();
  let turnReduce = 0;
  for (const p of Object.values((defender && defender.equippedGear) || {})) {
    if (!p) continue;
    if (Array.isArray(p.immune) && p.immune.includes(t)) return { blocked: true, reason: `${p.emoji || '🛡️'} ${p.name} is immune`, turnReduce: 0 };
    for (const r of p.resist || []) if (r.type === t && Math.random() * 100 < (r.chance || 0)) return { blocked: true, reason: `${p.emoji || '🛡️'} ${p.name} shrugged it off`, turnReduce: 0 };
    turnReduce = Math.max(turnReduce, p.turnReduce || 0);
  }
  return { blocked: false, turnReduce };
}
/** Weapon on-hit effects as a list the combat loop can roll. */
function weaponEffects(attacker) {
  const w = attacker && attacker.weapon;
  if (!w || !Array.isArray(w.effects)) return [];
  return w.effects;
}

// ── Display ─────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString();
function priceLine(p) { return `${fmt(p.nexus)} 💠${p.stones ? ` + ${fmt(p.stones)} 💎` : ''}`; }
function statLine(it) {
  if (it.kind === 'weapon' || it.isWeapon) {
    const atk = it.atk != null ? it.atk : it.attack;
    const fx = (it.effects || []).map(e => `${STATUS_EMOJI[e.type] || '✨'} ${e.type} ${e.chance}%`).join(' · ');
    return `⚔️ +${atk} ATK${fx ? ` · ${fx}` : ''}`;
  }
  const s = it.stats || {};
  const parts = [];
  if (s.def) parts.push(`🛡️ +${s.def} DEF`); if (s.hp) parts.push(`❤️ +${s.hp} HP`); if (s.speed) parts.push(`💨 +${s.speed} SPD`);
  if (s.atk) parts.push(`⚔️ +${s.atk} ATK`); if (s.evasion) parts.push(`💨 +${s.evasion}% EVA`); if (s.critDmg) parts.push(`🔥 +${s.critDmg}% CRIT DMG`);
  const sp = describeGearSpecial(it);
  return parts.join(' · ') + (sp ? `\n   ✨ ${sp.desc}` : '');
}
function renderStock(rankFilter) {
  const stock = getStock().filter(it => !rankFilter || it.rank === rankFilter);
  const lines = [];
  let cur = null;
  for (const it of stock) {
    if (it.rank !== cur) { cur = it.rank; lines.push(``, `${RANK_EMOJI[cur]} *${cur}-RANK*`); }
    lines.push(`*#${it.no}* ${it.emoji} *${it.name}*${it.kind === 'gear' ? ` _(${it.slot})_` : ''}`, `   ${statLine(it).replace(/\n/g, '\n   ')}`, `   💰 ${priceLine(it.price)}`);
  }
  const h = Math.floor(msUntilRotation() / 3600000), m = Math.floor((msUntilRotation() % 3600000) / 60000);
  return { lines, rotatesIn: `${h}h ${m}m` };
}
function renderDetail(it) {
  const L = [`${it.emoji} *${it.name}*`, `${RANK_EMOJI[it.rank]} ${it.rank}-Rank ${it.kind === 'weapon' ? it.weaponType : it.slot}`, ``, statLine(it), ``, `📖 _${it.lore}_`, ``, `💰 ${priceLine(it.price)}`, `🔧 Durability at your level: scales with level at purchase`, ``, `Buy: */store buy ${it.no}*`];
  return L.join('\n');
}

module.exports = {
  RANKS, RANK_EMOJI, RANK_RARITY, BANDS, STATUS_EMOJI, STATUSES,
  dayKey, msUntilRotation, getStock, findStock, buy, instantiate, maxDurabilityFor,
  equipWeapon, unequipWeapon, wearWeapon, wearGear, mendAll, mendAllShared,
  statusDefense, weaponEffects, describeGearSpecial,
  renderStock, renderDetail, statLine, priceLine,
};
