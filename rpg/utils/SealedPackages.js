// ═══════════════════════════════════════════════════════════════
// Push #56 — Sealed packages.
//
// Guild-shop purchases used to be applied inline, and for attack patterns
// that meant pushing a fake object into `player.inventory.patterns` — a list
// nothing reads. `/attacks` only knows `player.attackPatterns.owned`, so a
// hunter could buy "Dragon's Breath", see the receipt, and get… nothing.
//
// Purchases now arrive as a sealed package in the inventory, and `/equip use
// <#>` opens them. Opening routes each payload to the system that actually
// owns it (potions → inventory counters, patterns → /attacks, scrolls →
// crafting, stats → stats, pet food → pet food), so the same code path serves
// every shop and every future drop.
// ═══════════════════════════════════════════════════════════════
'use strict';

const MAX_EQUIPPED = 10;
const PATTERN_RANK_FOR_ITEM = {
  pattern_dragon: 'B',
  pattern_shadow: 'A',
};

function safeRequire(m) { try { return require(m); } catch (e) { return null; } }

/** A shop item becomes one inventory entry the player can open. */
function seal(shopItem, meta = {}) {
  const src = shopItem || {};
  return {
    name: `Sealed ${String(src.name || 'Item')} Package`,
    type: 'Consumable',
    rarity: src.rarity || 'common',
    isSealedPackage: true,
    desc: `Guild-shop purchase from ${meta.from || 'the guild store'}. Open it with /equip use <#>.`,
    pkg: {
      shopItem: {
        id: src.id ?? null,
        key: src.key ?? null,
        name: src.name ?? 'Unknown Item',
        type: src.type ?? 'potion',
        rarity: src.rarity ?? 'common',
        amount: src.amount ?? 1,
        stat: src.stat ?? null,
        bundleId: src.bundleId ?? null,
        category: src.category ?? null,
        description: src.description ?? '',
      },
      from: meta.from || 'guild',
      price: Number(meta.price) || 0,
      currency: meta.currency || 'gold',
      guild: meta.guild || null,
      sealedAt: Date.now(),
    },
  };
}

function isPackage(entry) {
  return !!(entry && (entry.isSealedPackage || entry.isGuildPackage) && entry.pkg);
}

/** Find the next owned pattern number in a rank band that the player lacks. */
function rollPatternId(rank, owned = []) {
  const DB = safeRequire('./AttackPatternDB');
  const cfg = DB?.RANK_CONFIG?.[rank];
  if (!cfg?.range) return null;
  const [lo, hi] = cfg.range;
  const have = new Set((owned || []).map(n => Number(n)));
  for (let i = 0; i < 60; i++) {
    const id = lo + Math.floor(Math.random() * (hi - lo + 1));
    if (!have.has(id)) return id;
  }
  return null;
}

function applyPotion(inv, src) {
  const key = src.key;
  if (key === 'lowerHealthPotions' || key === 'healthPotions') {
    inv.lowerHealthPotions = (inv.lowerHealthPotions || 0) + 1;
    inv.healthPotions = (inv.healthPotions || 0) + 1;
    return '🩹 Lower Health Potion ×1';
  }
  if (key === 'mediumHealthPotions') { inv.mediumHealthPotions = (inv.mediumHealthPotions || 0) + 1; return '🧪 Medium Health Potion ×1'; }
  if (key === 'higherHealthPotions') { inv.higherHealthPotions = (inv.higherHealthPotions || 0) + 1; return '🍷 Higher Health Potion ×1'; }
  if (key === 'reviveTokens') { inv.reviveTokens = (inv.reviveTokens || 0) + 1; return '💫 Revive Token ×1'; }
  if (key === 'energyPotions') return '⚠️ Energy potions were scrapped — the guild refunded this slot to your Nexus';
  return null;
}

/**
 * Open one sealed package. Mutates the player and returns what landed where.
 * `entry` must be the object sitting in player.inventory.items.
 */
function open(player, entry) {
  const lines = [];
  if (!isPackage(entry)) return { ok: false, error: 'That is not a sealed package.' };
  const src = entry.pkg.shopItem || {};
  const inv = player.inventory || (player.inventory = { items: [] });
  if (!Array.isArray(inv.items)) inv.items = [];

  const pushSpecial = (obj) => inv.items.push(obj);

  switch (String(src.type || '').toLowerCase()) {
    case 'potion': {
      const done = applyPotion(inv, src);
      if (done) {
        lines.push(done);
        if (src.key === 'energyPotions' && player.gold !== undefined) player.gold += Number(entry.pkg.price || 0);
      } else {
        pushSpecial({ name: src.name || 'Potion', type: 'Consumable', rarity: src.rarity || 'common' });
        lines.push(`🧪 ${src.name || 'Potion'} added to your inventory`);
      }
      break;
    }
    case 'consumable': {
      // The named consumables the guild shop sells map to flags the engines read.
      const k = src.key;
      if (k === 'luckPotion') { pushSpecial({ name: 'Luck Potion', type: 'Consumable', isLuckPotion: true }); lines.push('🍀 Luck Potion'); }
      else if (k === 'xpBooster') { pushSpecial({ name: 'XP Booster', type: 'Consumable', isXpBooster: true, charges: 3 }); lines.push('⭐ XP Booster (3 charges)'); }
      else if (k === 'goldMult') { pushSpecial({ name: 'Nexus Multiplier', type: 'Consumable', isNexusMult: true, charges: 3 }); lines.push('💠 Nexus Multiplier (3 charges)'); }
      else if (k === 'shieldScroll') { pushSpecial({ name: 'Shield Scroll', type: 'Consumable', isShieldScroll: true }); lines.push('🛡️ Shield Scroll'); }
      else if (k === 'mightElixir') { pushSpecial({ name: 'Elixir of Might', type: 'Consumable', isMightElixir: true, charges: 5, atkBonus: 20 }); lines.push('⚗️ Elixir of Might (5 charges, +20 ATK)'); }
      else { pushSpecial({ name: src.name || 'Consumable', type: 'Consumable', rarity: src.rarity || 'common' }); lines.push(`💊 ${src.name || 'Consumable'}`); }
      break;
    }
    case 'pattern': {
      const rank = PATTERN_RANK_FOR_ITEM[src.id] || (/(shadow|assassin|lethal)/i.test(src.name || '') ? 'A' : 'B');
      if (!player.attackPatterns) player.attackPatterns = { owned: [], equipped: [] };
      if (!Array.isArray(player.attackPatterns.owned)) player.attackPatterns.owned = [];
      if (!Array.isArray(player.attackPatterns.equipped)) player.attackPatterns.equipped = [];
      const DB = safeRequire('./AttackPatternDB');
      const id = entry.pkg.patternId || rollPatternId(rank, player.attackPatterns.owned);
      if (!id) { lines.push(`⚠️ No free *${rank}-Rank* pattern number could be allocated — the guild will hold it for you`); break; }
      entry.pkg.patternId = id;
      const already = player.attackPatterns.owned.includes(id);
      if (!already) player.attackPatterns.owned.push(id);
      let equipped = false;
      if (!already && player.attackPatterns.equipped.length < MAX_EQUIPPED) {
        player.attackPatterns.equipped.push(id);
        equipped = true;
      }
      const atk = DB?.generateAttack ? DB.generateAttack(id) : null;
      lines.push(`⚔️ Attack pattern *#${id}*${atk ? ` — *${atk.name}* (${atk.rank}-Rank)` : ` (${rank}-Rank)`} ${already ? 'was already in your arsenal' : 'added to /attacks'}${equipped ? ' and equipped' : ''}`);
      if (!equipped && !already) lines.push(`   ↳ all ${MAX_EQUIPPED} slots busy — /attacks equip ${id}`);
      break;
    }
    case 'scroll': {
      const CS = safeRequire('./CraftingSystem');
      if (!Array.isArray(player.inventory.scrolls)) player.inventory.scrolls = [];
      // CraftingSystem keys its recipe pools by capitalised rarity, and returns
      // null for anything it does not carry — a box must never hand the player a
      // null scroll, so try the rarity as written, then title-cased, then Common.
      const want = String(src.rarity || 'common');
      const titled = want.charAt(0).toUpperCase() + want.slice(1);
      const mint = (r) => { try { return CS?.buyScroll ? CS.buyScroll(r) : null; } catch (e) { return null; } };
      const scroll = mint(want) || mint(titled) || mint('Common') || {
        id: `scroll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        rarity: titled.toLowerCase(), name: `${titled} Recipe Scroll`, type: 'Scroll', emoji: '📜',
        key: (CS && CS.generateCraftKey) ? CS.generateCraftKey() : `SCROLL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        recipe: null, revealed: false, crafted: false,
      };
      player.inventory.scrolls.push(scroll);
      lines.push(`📜 ${scroll.name || 'Crafting scroll'} added — /scroll to use it`);
      break;
    }
    case 'stat': {
      if (!player.stats) player.stats = {};
      const amt = Number(src.amount) || 1;
      const map = { atk: 'atk', def: 'def', hp: 'maxHp', spd: 'speed', crit: 'critChance' };
      const field = map[src.stat] || src.stat;
      if (field) {
        player.stats[field] = (player.stats[field] || 0) + amt;
        if (src.stat === 'hp') player.stats.hp = Math.min(player.stats.hp || 0, player.stats.maxHp || 0);
        lines.push(`📈 Permanent +${amt} ${String(src.stat).toUpperCase()}`);
      } else lines.push('⚠️ The package contained no usable stat');
      break;
    }
    case 'ticket': {
      player.summonTickets = (player.summonTickets || 0) + (Number(src.amount) || 1);
      lines.push(`🎟️ +${Number(src.amount) || 1} summon ticket(s)`);
      break;
    }
    case 'pet_food': {
      // Push #71: land in the id-keyed bucket /pet feed reads.
      const PDB = require('./PetDatabase');
      const f = PDB.resolvePetFood(src.id) || PDB.resolvePetFood(src.name);
      PDB.addPetFood(player, f ? f.id : 'kibble', 1);
      lines.push(`🐾 ${f ? f.name : src.name} ×1 → /pet feed [#] ${f ? f.id : 'kibble'}`);
      break;
    }
    case 'bundle': {
      const id = Number(src.bundleId) || 0;
      if (id === 1) { inv.healthPotions = (inv.healthPotions || 0) + 5; inv.lowerHealthPotions = (inv.lowerHealthPotions || 0) + 5; inv.reviveTokens = (inv.reviveTokens || 0) + 1; lines.push('🧪 5 Health Potions + 💫 1 Revive Token'); }
      else if (id === 2) { inv.healthPotions = (inv.healthPotions || 0) + 10; inv.lowerHealthPotions = (inv.lowerHealthPotions || 0) + 10; inv.reviveTokens = (inv.reviveTokens || 0) + 5; pushSpecial({ name: 'XP Booster', type: 'Consumable', isXpBooster: true, charges: 3 }); lines.push('🧪 10 Health Potions + 💫 5 Revives + ⭐ XP Booster'); }
      else if (id === 3) { pushSpecial({ name: 'Elixir of Might', type: 'Consumable', isMightElixir: true, charges: 5, atkBonus: 20 }, { name: 'Shield Scroll', type: 'Consumable', isShieldScroll: true }, { name: 'Luck Potion', type: 'Consumable', isLuckPotion: true }); lines.push('⚗️ Elixir of Might + 🛡️ Shield Scroll + 🍀 Luck Potion'); }
      else { pushSpecial({ name: src.name || 'Bundle Item', type: 'Consumable' }); lines.push(`🎁 ${src.name || 'Bundle'} contents released`); }
      break;
    }
    default: {
      pushSpecial({ name: src.name || 'Item', type: src.type ? String(src.type) : 'Consumable', rarity: src.rarity || 'common' });
      lines.push(`📦 ${src.name || 'Item'} added to your inventory`);
    }
  }

  if (Array.isArray(entry.pkg.pendingNotify)) { /* reserved for future shop hooks */ }
  return { ok: true, lines, routed: String(src.type || 'item').toLowerCase() };
}

/** Locate the concrete package object behind a stacked /items entry. */
function findPackage(player, entry) {
  const list = player?.inventory?.items;
  if (!Array.isArray(list)) return null;
  const name = entry?.name;
  for (let i = list.length - 1; i >= 0; i--) {
    if (isPackage(list[i]) && (!name || list[i].name === name)) return list[i];
  }
  return null;
}

/**
 * /items stacks identical items into one entry ({ ...item, count }), so the row
 * a command hands us is usually a COPY, not the object stored in
 * inventory.items. The copy keeps `pkg` by reference, so that is the identity we
 * match on — otherwise indexOf() misses, nothing is spliced out, and the player
 * can reopen the same box forever.
 */
function resolveConcrete(player, entry) {
  const list = player?.inventory?.items;
  if (!Array.isArray(list) || !entry) return null;
  if (list.includes(entry)) return entry;                       // already the real row
  const byIdentity = list.find((x) => isPackage(x) && entry.pkg && x.pkg === entry.pkg);
  if (byIdentity) return byIdentity;
  const byStamp = list.find((x) => isPackage(x) && x.name === entry.name && x.pkg?.sealedAt === entry?.pkg?.sealedAt);
  return byStamp || findPackage(player, entry);
}

/** Open + consume one unit of the package. */
function openAndConsume(player, entry) {
  const concrete = resolveConcrete(player, entry);
  if (!concrete || !isPackage(concrete)) return { ok: false, error: 'No sealed package found.' };
  const res = open(player, concrete);
  if (!res.ok) return res;
  const list = player.inventory.items;
  const idx = list.indexOf(concrete);
  if (idx >= 0) list.splice(idx, 1);
  return res;
}

module.exports = { seal, open, isPackage, findPackage, resolveConcrete, openAndConsume, rollPatternId, MAX_EQUIPPED, applyPotion, PATTERN_RANK_FOR_ITEM };
