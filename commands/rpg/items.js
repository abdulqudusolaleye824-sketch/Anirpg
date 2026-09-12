// ═══════════════════════════════════════════════════════════════
// /items — Usables subcategory view (consumables, materials, potions).
// Gear lives in /gear; the unified numbered list lives in /inv.
// /equip use [#] and /items give [#] resolve through _buildList so the
// numbers always match this display exactly.
// ═══════════════════════════════════════════════════════════════

const PET_FOOD_NAMES = new Set([
  'Gel','Water','Meat','Bone','Coal','Fish','Fire Gem','Electric Mana Stone',
  'Metal','Shadow Essence','Dragon Meat','Rare Gems','Spirit Essence',
  'Celestial Fruit','Ice Mana Stone','Phoenix Tears','Chaos Shard',
  'Ancient Stone','Void Mana Stone','Star Dust','Primordial Essence','Existence Shard'
]);

const RARITY_ORDER = { mythic:0, legendary:1, epic:2, rare:3, uncommon:4, common:5 };

function getTypeEmoji(type) {
  const emojiMap = {
    'Weapon':'⚔️','Armor':'🛡️','Accessory':'💍','Potion':'🧪',
    'Material':'🧱','Consumable':'💊','Catalyst':'⚗️','Buff':'✨','PetFood':'🐾'
  };
  return emojiMap[type] || '📦';
}

// Batch-48: move 1 unit of a counter/card-backed entry sender→target.
// Handles the energyPotions/manaPotions legacy split on BOTH sides.
function transferSynthetic(sender, target, entry) {
  const key = entry && entry._synthetic;
  if (!key) return { ok: false, error: 'Not a transferable entry.' };
  if (String(key).startsWith('mat:')) {
    const mk = String(key).slice(4);
    if (!sender.materials) sender.materials = {};
    if ((sender.materials[mk] || 0) < 1) return { ok: false, error: `No ${entry.name} to send!` };
    if (!target.materials) target.materials = {};
    sender.materials[mk] -= 1;
    target.materials[mk] = (target.materials[mk] || 0) + 1;
    return { ok: true };
  }
  if (String(key).startsWith('card:')) {
    const ck = String(key).slice(5);
    if (!sender.cards) sender.cards = {};
    if ((sender.cards[ck] || 0) < 1) return { ok: false, error: `No ${entry.name} to send!` };
    if (!target.cards) target.cards = {};
    sender.cards[ck] -= 1;
    target.cards[ck] = (target.cards[ck] || 0) + 1;
    return { ok: true };
  }
  if (!sender.inventory) sender.inventory = {};
  if (!target.inventory) target.inventory = {};
  const sKey = key === 'energyPotions' && sender.inventory.energyPotions === undefined ? 'manaPotions' : key;
  const tKey = key === 'energyPotions' && target.inventory.energyPotions === undefined && target.inventory.manaPotions !== undefined ? 'manaPotions' : key;
  if ((sender.inventory[sKey] || 0) < 1) return { ok: false, error: `No ${entry.name} to send!` };
  sender.inventory[sKey] -= 1;
  // Lower-tier mirror: generic health potions also back the lower counter.
  if (key === 'healthPotions' && (sender.inventory.lowerHealthPotions || 0) > 0) sender.inventory.lowerHealthPotions -= 1;
  target.inventory[tKey] = (target.inventory[tKey] || 0) + 1;
  if (key === 'healthPotions') target.inventory.lowerHealthPotions = (target.inventory.lowerHealthPotions || 0) + 1;
  return { ok: true };
}

// Shared builder — /items display, /equip use, /equip gift, /items give
// and /inv cross-refs all resolve numbers through this.
function buildList(player) {
  const allItems = player.inventory?.items || [];
  const inv = player.inventory || {};

  // Add old-style potions as virtual items
  const synthetic = [];
  for (let i = 0; i < (inv.healthPotions || 0); i++)  synthetic.push({ name: 'Health Potion', type: 'Potion', rarity: 'common', _synthetic: 'healthPotions' });
  for (let i = 0; i < (inv.energyPotions || inv.manaPotions || 0); i++) synthetic.push({ name: 'Energy Potion', type: 'Potion', rarity: 'common', _synthetic: 'energyPotions' });
  for (let i = 0; i < (inv.reviveTokens || 0); i++) synthetic.push({ name: 'Revive Token', type: 'Consumable', rarity: 'uncommon', _synthetic: 'reviveTokens' });
  // Batch-48: medium/higher tiers were INVISIBLE everywhere (own counters,
  // never listed) — listed now, with counts. Cards join too so every item
  // is visible AND transferable.
  for (let i = 0; i < (inv.mediumHealthPotions || 0); i++) synthetic.push({ name: 'Medium Health Potion', type: 'Potion', rarity: 'uncommon', _synthetic: 'mediumHealthPotions' });
  for (let i = 0; i < (inv.higherHealthPotions || 0); i++) synthetic.push({ name: 'Higher Health Potion', type: 'Potion', rarity: 'rare', _synthetic: 'higherHealthPotions' });
  const _cards48 = player.cards || {};
  for (let i = 0; i < (_cards48.namechange || 0); i++) synthetic.push({ name: 'Rename Card', type: 'Card', rarity: 'legendary', _synthetic: 'card:namechange' });
  for (let i = 0; i < (_cards48.seticon || 0); i++) synthetic.push({ name: 'Seticon Token', type: 'Card', rarity: 'legendary', _synthetic: 'card:seticon' });
  for (let i = 0; i < (_cards48.pro_weekly || 0); i++) synthetic.push({ name: 'Weekly Pro Card', type: 'Card', rarity: 'rare', _synthetic: 'card:pro_weekly' });
  // Crafting materials held as counters (player.materials) — listed so they
  // can be counted AND gifted; use-path refuses them (see /equip use).
  const _mats48 = player.materials || {};
  for (const _mk of Object.keys(_mats48)) {
    for (let i = 0; i < (_mats48[_mk] || 0); i++) synthetic.push({ name: _mk, type: 'Material', rarity: 'common', _synthetic: 'mat:' + _mk });
  }

  // Usables only: no gear, no pet food
  const equippable = allItems.filter(item =>
    !item.isGear &&
    (item.type || '').toLowerCase() !== 'gear' &&
    !item.isPetFood &&
    (item.type || '').toLowerCase() !== 'petfood' &&
    !PET_FOOD_NAMES.has(item.name)
  );

  const combined = [...equippable, ...synthetic];

  // Stack by name
  const stacked = {};
  for (const item of combined) {
    if (!stacked[item.name]) stacked[item.name] = { ...item, count: 0, _synthetic: item._synthetic };
    stacked[item.name].count++;
  }
  return Object.values(stacked).sort((a, b) => {
    const ra = RARITY_ORDER[(a.rarity||'').toLowerCase()] ?? 6;
    const rb = RARITY_ORDER[(b.rarity||'').toLowerCase()] ?? 6;
    return ra - rb || a.name.localeCompare(b.name);
  });
}

module.exports = {
  name: 'items',
  description: 'View your usable items (consumables, materials, potions)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: '❌ You are not registered!'
      }, { quoted: msg });
    }
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    // ── /items giftconfirm / giftcancel (batch-22 PRO epic+ flow) ──
    if (args[0]?.toLowerCase() === 'giftconfirm' || args[0]?.toLowerCase() === 'giftcancel') {
      const _gcSub = args[0].toLowerCase();
      const GC = require('../../rpg/utils/GiftConfirm');
      const got = GC.take(sender);
      if (got.error || !got.pending) {
        return sock.sendMessage(chatId, { text: _gcSub === 'giftcancel' ? 'ℹ️ You have no pending gift to cancel.' : '❌ No pending gift (it expired or was already handled).' }, { quoted: msg });
      }
      const p = got.pending;
      if (_gcSub === 'giftcancel') {
        return sock.sendMessage(chatId, { text: `❌ Gift cancelled — *${p.itemName}* stays in your inventory.` }, { quoted: msg });
      }
      const target = db.users[p.recipientId];
      if (!target) {
        return sock.sendMessage(chatId, { text: `❌ *${p.itemName}* could not be sent (recipient no longer registered). The item stays with you.` }, { quoted: msg });
      }
      const _pool = player.inventory?.items || [];
      const _ix = _pool.findIndex(i => i.name === p.itemName && !i.isGear && (i.type || '').toLowerCase() !== 'gear');
      if (_ix === -1) {
        return sock.sendMessage(chatId, { text: `❌ *${p.itemName}* is no longer in your inventory — gift cancelled.` }, { quoted: msg });
      }
      const [_item] = _pool.splice(_ix, 1);
      if (!target.inventory) target.inventory = {};
      if (!target.inventory.items) target.inventory.items = [];
      target.inventory.items.push({ ..._item, acquiredAt: Date.now() });
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n🎁 *ITEM SENT!* 💎\n${UI.PRO_BAR}\n\nSent *${getTypeEmoji(_item.type)} ${_item.name}* to *${target.name}*!` : `🎁 Sent *${getTypeEmoji(_item.type)} ${_item.name}* to *${target.name}*!`) + `\n\nThey'll find it in their /inv (newest first).\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO GIFT* — sent ${_item.name}` : `\n${UI.upsell()}`)
      }, { quoted: msg });
    }

    // ── /items give <#> @user ────────────────────────────────
    if (args[0]?.toLowerCase() === 'give') {
      const itemNum = parseInt(args[1]);
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                     || msg.message?.extendedTextMessage?.contextInfo?.participant;

      if (!itemNum || isNaN(itemNum)) {
        return sock.sendMessage(chatId, {
          text: '❌ Usage: /items give <#> @user\nUse /items to see your list.'
        }, { quoted: msg });
      }
      if (!mentioned) {
        return sock.sendMessage(chatId, {
          text: '❌ Tag a player! /items give <#> @user'
        }, { quoted: msg });
      }
      if (mentioned === sender) {
        return sock.sendMessage(chatId, {
          text: '❌ You cannot give items to yourself.'
        }, { quoted: msg });
      }

      const target = db.users[mentioned];
      if (!target) {
        return sock.sendMessage(chatId, {
          text: '❌ That player is not registered.'
        }, { quoted: msg });
      }

      const sorted = buildList(player);

      if (itemNum < 1 || itemNum > sorted.length) {
        return sock.sendMessage(chatId, {
          text: `❌ Invalid number! Use /items to see your list.`
        }, { quoted: msg });
      }

      const selected = sorted[itemNum - 1];

      // Batch-48: counter/card items transfer 1 unit (sender→recipient).
      // Everything is transferable now — no more "bound supply".
      if (selected._synthetic) {
        const _t = transferSynthetic(player, target, selected);
        if (!_t.ok) {
          return sock.sendMessage(chatId, { text: `❌ ${(_t.error || 'Transfer failed.')}` }, { quoted: msg });
        }
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: (pro ? `${UI.PRO_BAR}\n🎁 *ITEM SENT!* 💎\n${UI.PRO_BAR}\n\n` : `🎁 *ITEM SENT!*\n${UI.FREE_BAR}\n\n`) + `${getTypeEmoji(selected.type)} *${selected.name}* ×1 → *${target.name}*!\n\nThey'll find it in their /inv.\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO GIFT* — sent ${selected.name}` : `\n${UI.upsell()}`),
          mentions: [mentioned],
        }, { quoted: msg });
      }

      // Find and remove the real item
      const allItems = player.inventory?.items || [];
      const idx = allItems.findIndex(i => i.name === selected.name && !i.isGear && (i.type || '').toLowerCase() !== 'gear');
      if (idx === -1) {
        return sock.sendMessage(chatId, {
          text: '❌ Item not found in inventory!'
        }, { quoted: msg });
      }
      // PRO epic-and-up gifts need an explicit confirmation (batch-22).
      const _giveItem = allItems[idx];
      if (require('../../rpg/utils/GiftConfirm').needsConfirm(pro, _giveItem.rarity)) {
        return require('../../rpg/utils/GiftConfirm').offer(sock, chatId, msg, sender, {
          item: _giveItem, recipientId: mentioned, recipientName: target.name || 'them', cmd: '/items', itemNum,
        });
      }
      const [item] = allItems.splice(idx, 1);

      // Add to target
      if (!target.inventory) target.inventory = {};
      if (!target.inventory.items) target.inventory.items = [];
      target.inventory.items.push({ ...item, acquiredAt: Date.now() });

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n🎁 *ITEM SENT!* 💎\n${UI.PRO_BAR}\n\nSent *${getTypeEmoji(item.type)} ${item.name}* to *${target.name}*!` : `🎁 Sent *${getTypeEmoji(item.type)} ${item.name}* to *${target.name}*!`) + `\n\nThey'll find it in their /inv (newest first).\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO GIFT* — sent ${item.name}` : `\n${UI.upsell()}`)
      }, { quoted: msg });
    }

    // ── /items -tier — same list explicitly sorted by rarity ─
    const sorted = buildList(player);

    if (sorted.length === 0) {
      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n🎒 *YOUR ITEMS* 💎\n${UI.PRO_BAR}\n\n📦 _No Usables yet._\n\nGear lives in /gear · everything lives in /inv.\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO KIT* — empty pockets` : `🎒 *YOUR ITEMS*\n${UI.FREE_BAR}\n\n📦 _No Usables yet._\n\nGear lives in /gear · everything lives in /inv.\n${UI.FREE_BAR}\n${UI.upsell()}`)
      }, { quoted: msg });
    }

    let message = pro ? `${UI.PRO_BAR}\n🎒 *YOUR ITEMS* 💎\n${UI.PRO_BAR}\n\n` : `🎒 *YOUR ITEMS*\n${UI.FREE_BAR}\n\n`;
    message += `_Usables — gear lives in /gear_\n\n`;

    sorted.forEach((item, i) => {
      const countStr = item.count > 1 ? ` ×${item.count}` : '';
      message += `${i+1}. ${getTypeEmoji(item.type)} *${item.name}*${countStr}\n`;
      message += `   ⭐ ${item.rarity || 'common'} | 📦 ${item.type || 'Item'}\n`;
    });

    message += `\n${FRAME}\n`;
    message += `📌 /equip use <#> — use an item\n`;
    message += `📌 /items give <#> @user — gift an item\n`;
    message += `📌 /inv — everything, newest first\n`;
    message += FRAME + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO KIT* — ${sorted.length} item types` : `\n${UI.upsell()}`);

    return sock.sendMessage(chatId, { text: message }, { quoted: msg });
  }
};

module.exports._buildList = buildList;
module.exports._transferSynthetic = transferSynthetic;
