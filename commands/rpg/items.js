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

      // Synthetic (counter-based) potions can't be transferred
      if (selected._synthetic) {
        return sock.sendMessage(chatId, {
          text: `❌ *${selected.name}* can't be transferred (bound supply).\n\nUse it yourself with /equip use ${itemNum}.`
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
