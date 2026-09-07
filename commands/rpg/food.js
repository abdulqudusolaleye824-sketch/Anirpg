// /food — pet food only, numbered, stackable
// /food give [#] [qty] @player — transfer food to another player
module.exports = {
  name: 'food',
  description: 'View and transfer your pet food',

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

    const foodItems = allItems.filter(item =>
      item.isPetFood ||
      (item.type || '').toLowerCase() === 'petfood' ||
      PET_FOOD_NAMES.has(item.name)
    );

    // Stack by name
    const rarityOrder = { mythic:0, legendary:1, epic:2, rare:3, uncommon:4, common:5 };
    const stacked = {};
    for (const item of foodItems) {
      if (!stacked[item.name]) stacked[item.name] = { ...item, count: 0 };
      stacked[item.name].count++;
    }
    const sorted = Object.values(stacked).sort((a, b) => {
      const ra = rarityOrder[(a.rarity||'').toLowerCase()] ?? 6;
      const rb = rarityOrder[(b.rarity||'').toLowerCase()] ?? 6;
      return ra - rb || a.name.localeCompare(b.name);
    });

    // ── /food give [#] [qty] @player ──────────────────────────
    if (subCmd === 'give') {
      const itemNum = parseInt(args[1]);
      const qty = parseInt(args[2]) || 1;

      if (!itemNum || itemNum < 1 || itemNum > sorted.length) {
        return sock.sendMessage(chatId, {
          text: `❌ Invalid food number!\n\nUse /food to see your numbered list.\nExample: /food give 1 5 @player`
        }, { quoted: msg });
      }

      const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentions.length) {
        return sock.sendMessage(chatId, {
          text: `❌ Tag a player!\nExample: /food give ${itemNum} ${qty} @player`
        }, { quoted: msg });
      }

      const recipientId = mentions[0];
      if (recipientId === sender)
        return sock.sendMessage(chatId, { text: `❌ Can't give to yourself!` }, { quoted: msg });

      const recipient = db.users[recipientId];
      if (!recipient)
        return sock.sendMessage(chatId, { text: `❌ That player is not registered!` }, { quoted: msg });

      const selected = sorted[itemNum - 1];
      if (qty > selected.count) {
        return sock.sendMessage(chatId, {
          text: `❌ You only have ${selected.count}× *${selected.name}*!`
        }, { quoted: msg });
      }

      // Move qty items from sender to recipient
      let moved = 0;
      if (!recipient.inventory) recipient.inventory = { items: [] };
      if (!recipient.inventory.items) recipient.inventory.items = [];

      for (let i = allItems.length - 1; i >= 0 && moved < qty; i--) {
        const it = allItems[i];
        if (it.name === selected.name && (it.isPetFood || PET_FOOD_NAMES.has(it.name) || (it.type||'').toLowerCase() === 'petfood')) {
          recipient.inventory.items.push({ ...it });
          allItems.splice(i, 1);
          moved++;
        }
      }

      saveDatabase();

      const rarityEmoji = { mythic:'🌌', legendary:'🟠', epic:'🟣', rare:'🔵', uncommon:'🟢', common:'⚪' };
      const re = rarityEmoji[(selected.rarity||'').toLowerCase()] || '🍖';

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🍖 *FOOD TRANSFERRED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${re} *${selected.name}* ×${moved}\n\n📤 From: *${player.name}*\n📥 To: *${recipient.name}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions: [recipientId]
      }, { quoted: msg });
    }

    // ── Default: numbered food list ────────────────────────────
    if (sorted.length === 0) {
      return sock.sendMessage(chatId, {
        text: `🍖 *PET FOOD*\n\n❌ No pet food!\n\n💡 Clear dungeons to find food drops.\n📌 /pet foods — see all food types`
      }, { quoted: msg });
    }

    const rarityEmoji = { mythic:'🌌', legendary:'🟠', epic:'🟣', rare:'🔵', uncommon:'🟢', common:'⚪' };

    let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🍖 *PET FOOD INVENTORY*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    sorted.forEach((item, i) => {
      const re = rarityEmoji[(item.rarity||'').toLowerCase()] || '🍖';
      message += `*${i+1}.* ${re} ${item.name} ×${item.count}\n`;
    });
    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `/pet feed [pet#] [food name] — feed pet\n`;
    message += `/food give [#] [qty] @player — transfer\n`;
    message += `/pet foods — all food types\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return sock.sendMessage(chatId, { text: message }, { quoted: msg });
  }
};