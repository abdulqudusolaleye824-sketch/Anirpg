// /items — equippable gear, potions, stat boosters (no pet food)
// /items give [#] @player — transfer item to another player
// /items -tier — sort by rarity, no numbers
module.exports = {
  name: 'items',
  description: 'View and transfer your equippable items',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You are not registered!' }, { quoted: msg });
    }

    const subCmd = args[0]?.toLowerCase();

    const PET_FOOD_NAMES = new Set([
      'Gel','Water','Meat','Bone','Coal','Fish','Fire Gem','Electric Mana Stone',
      'Metal','Shadow Essence','Dragon Meat','Rare Gems','Spirit Essence',
      'Celestial Fruit','Ice Mana Stone','Phoenix Tears','Chaos Shard',
      'Ancient Stone','Void Mana Stone','Star Dust','Primordial Essence','Existence Shard'
    ]);

    const allItems = player.inventory?.items || [];
    const inv = player.inventory || {};

    // Old-style potions as virtual entries
    const synthetic = [];
    for (let i = 0; i < (inv.healthPotions || 0); i++)
      synthetic.push({ name: 'Health Potion', type: 'Potion', rarity: 'common', _synthetic: 'healthPotions' });
    for (let i = 0; i < (inv.energyPotions || inv.manaPotions || 0); i++)
      synthetic.push({ name: 'Energy Potion', type: 'Potion', rarity: 'common', _synthetic: inv.energyPotions !== undefined ? 'energyPotions' : 'manaPotions' });
    for (let i = 0; i < (inv.reviveTokens || 0); i++)
      synthetic.push({ name: 'Revive Token', type: 'Consumable', rarity: 'uncommon', _synthetic: 'reviveTokens' });

    const equippable = allItems.filter(item =>
      !item.isPetFood &&
      (item.type || '').toLowerCase() !== 'petfood' &&
      !PET_FOOD_NAMES.has(item.name)
    );

    const combined = [...equippable, ...synthetic];

    // Stack by name
    const rarityOrder = { mythic:0, legendary:1, epic:2, rare:3, uncommon:4, common:5 };
    const stacked = {};
    for (const item of combined) {
      if (!stacked[item.name]) stacked[item.name] = { ...item, count: 0 };
      stacked[item.name].count++;
    }
    const sorted = Object.values(stacked).sort((a, b) => {
      const ra = rarityOrder[(a.rarity||'').toLowerCase()] ?? 6;
      const rb = rarityOrder[(b.rarity||'').toLowerCase()] ?? 6;
      return ra - rb || a.name.localeCompare(b.name);
    });

    // ── /items give [#] @player ────────────────────────────────
    if (subCmd === 'give') {
      const itemNum = parseInt(args[1]);
      if (!itemNum || itemNum < 1 || itemNum > sorted.length) {
        return sock.sendMessage(chatId, {
          text: `❌ Invalid item number!\n\nUse /items to see your numbered list.\nExample: /items give 1 @player`
        }, { quoted: msg });
      }

      const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentions.length) {
        return sock.sendMessage(chatId, {
          text: `❌ Tag a player!\nExample: /items give ${itemNum} @player`
        }, { quoted: msg });
      }

      const recipientId = mentions[0];
      if (recipientId === sender)
        return sock.sendMessage(chatId, { text: `❌ Can't give to yourself!` }, { quoted: msg });

      const recipient = db.users[recipientId];
      if (!recipient)
        return sock.sendMessage(chatId, { text: `❌ That player is not registered!` }, { quoted: msg });

      const selected = sorted[itemNum - 1];

      // Handle synthetic (old-style) items
      if (selected._synthetic) {
        const key = selected._synthetic;
        if ((player.inventory[key] || 0) < 1)
          return sock.sendMessage(chatId, { text: `❌ You don't have that item anymore!` }, { quoted: msg });

        player.inventory[key]--;
        if (!recipient.inventory) recipient.inventory = {};
        recipient.inventory[key] = (recipient.inventory[key] || 0) + 1;
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `🎁 *${selected.name}* → *${recipient.name}*!\n✅ Transfer complete.`,
          mentions: [recipientId]
        }, { quoted: msg });
      }

      // Find and move real item
      const idx = allItems.findIndex(i =>
        i.name === selected.name &&
        !i.isPetFood &&
        (i.type||'').toLowerCase() !== 'petfood' &&
        !PET_FOOD_NAMES.has(i.name)
      );
      if (idx === -1)
        return sock.sendMessage(chatId, { text: `❌ Item not found in inventory!` }, { quoted: msg });

      const item = allItems.splice(idx, 1)[0];
      if (!recipient.inventory) recipient.inventory = { items: [] };
      if (!recipient.inventory.items) recipient.inventory.items = [];
      recipient.inventory.items.push(item);
      saveDatabase();

      const rarityEmoji = { mythic:'🌌', legendary:'🟠', epic:'🟣', rare:'🔵', uncommon:'🟢', common:'⚪' };
      const re = rarityEmoji[(item.rarity||'').toLowerCase()] || '📦';

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *ITEM TRANSFERRED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${re} *${item.name}*\n⭐ ${item.rarity}\n\n📤 From: *${player.name}*\n📥 To: *${recipient.name}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions: [recipientId]
      }, { quoted: msg });
    }

    // ── /items -tier — unnumbered rarity groups ────────────────
    if (subCmd === '-tier' || subCmd === 'tier') {
      if (sorted.length === 0)
        return sock.sendMessage(chatId, { text: `🎒 *ITEMS*\n\n❌ No equippable items!` }, { quoted: msg });

      const rarityEmoji = { mythic:'🌌', legendary:'🟠', epic:'🟣', rare:'🔵', uncommon:'🟢', common:'⚪' };
      const typeEmoji = { weapon:'⚔️', armor:'🛡️', accessory:'💍', potion:'🧪', consumable:'🧪', crystal:'💎' };
      const rarityLabel = { mythic:'🌌 MYTHIC', legendary:'🟠 LEGENDARY', epic:'🟣 EPIC', rare:'🔵 RARE', uncommon:'🟢 UNCOMMON', common:'⚪ COMMON' };

      const groups = {};
      for (const item of sorted) {
        const r = (item.rarity || 'common').toLowerCase();
        if (!groups[r]) groups[r] = [];
        groups[r].push(item);
      }

      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎒 *ITEMS BY TIER*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      for (const r of ['mythic','legendary','epic','rare','uncommon','common']) {
        if (!groups[r] || !groups[r].length) continue;
        message += `*${rarityLabel[r]}*\n`;
        for (const item of groups[r]) {
          const te = typeEmoji[(item.type||'').toLowerCase()] || '📦';
          const bonusStr = item.bonus ? ` (+${item.bonus})` : '';
          const countStr = item.count > 1 ? ` ×${item.count}` : '';
          message += `  ${te} ${item.name}${bonusStr}${countStr}\n`;
        }
        message += '\n';
      }
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/items — numbered list`;
      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ── Default: numbered list ─────────────────────────────────
    if (sorted.length === 0) {
      return sock.sendMessage(chatId, {
        text: `🎒 *ITEMS*\n\n❌ No equippable items!\n\n💡 Clear dungeons and defeat bosses to earn gear.`
      }, { quoted: msg });
    }

    const rarityEmoji = { mythic:'🌌', legendary:'🟠', epic:'🟣', rare:'🔵', uncommon:'🟢', common:'⚪' };
    const typeEmoji = { weapon:'⚔️', armor:'🛡️', accessory:'💍', potion:'🧪', consumable:'🧪', crystal:'💎' };

    let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎒 *YOUR ITEMS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    sorted.forEach((item, i) => {
      const re = rarityEmoji[(item.rarity||'').toLowerCase()] || '📦';
      const te = typeEmoji[(item.type||'').toLowerCase()] || '📦';
      const bonusStr = item.bonus ? ` (+${item.bonus})` : '';
      const countStr = item.count > 1 ? ` ×${item.count}` : '';
      message += `*${i+1}.* ${re}${te} ${item.name}${bonusStr}${countStr}\n`;
    });
    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `/equip use [#] — use/equip item\n`;
    message += `/items give [#] @player — transfer\n`;
    message += `/items -tier — sort by rarity\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return sock.sendMessage(chatId, { text: message }, { quoted: msg });
  }
};