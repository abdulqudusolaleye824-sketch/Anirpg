module.exports = {
  name: 'equip',
  description: 'Equip, use, or gift items from your inventory',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: '❌ You are not registered!'
      }, { quoted: msg });
    }

    const subCmd = args[0]?.toLowerCase();

    // ── Default: show help ─────────────────────────────────────
    if (!subCmd) {
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎒 *EQUIP COMMANDS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n/items — view equippable items\n/items -tier — sorted by rarity\n/equip use [#] — equip/use item\n/equip gift [#] @player — gift item\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── /equip use [#] ─────────────────────────────────────────
    if (subCmd === 'use') {
      const itemNum = parseInt(args[1]);
      if (!itemNum || isNaN(itemNum)) {
        return sock.sendMessage(chatId, {
          text: `❌ Usage: /equip use [#]\n\nView your items with /items`
        }, { quoted: msg });
      }

      // Build the same list /items shows (no pet food, stacked, sorted by rarity)
      const PET_FOOD_NAMES = new Set([
        'Gel','Water','Meat','Bone','Coal','Fish','Fire Gem','Electric Mana Stone',
        'Metal','Shadow Essence','Dragon Meat','Rare Gems','Spirit Essence',
        'Celestial Fruit','Ice Mana Stone','Phoenix Tears','Chaos Shard',
        'Ancient Stone','Void Mana Stone','Star Dust','Primordial Essence','Existence Shard'
      ]);

      const allItems = player.inventory?.items || [];
      const inv = player.inventory || {};

      // Add old-style potions as virtual items
      const synthetic = [];
      for (let i = 0; i < (inv.healthPotions || 0); i++)  synthetic.push({ name: 'Health Potion', type: 'Potion', rarity: 'common', _synthetic: 'healthPotions' });
      for (let i = 0; i < (inv.energyPotions || inv.manaPotions || 0); i++) synthetic.push({ name: 'Energy Potion', type: 'Potion', rarity: 'common', _synthetic: 'energyPotions' });
      for (let i = 0; i < (inv.reviveTokens || 0); i++) synthetic.push({ name: 'Revive Token', type: 'Consumable', rarity: 'uncommon', _synthetic: 'reviveTokens' });

      // Filter out pet food from real items
      const equippable = allItems.filter(item =>
        !item.isPetFood &&
        (item.type || '').toLowerCase() !== 'petfood' &&
        !PET_FOOD_NAMES.has(item.name)
      );

      const combined = [...equippable, ...synthetic];

      // Stack by name (same as /items display)
      const rarityOrder = { mythic:0, legendary:1, epic:2, rare:3, uncommon:4, common:5 };
      const stacked = {};
      for (const item of combined) {
        if (!stacked[item.name]) stacked[item.name] = { ...item, count: 0, _synthetic: item._synthetic };
        stacked[item.name].count++;
      }
      const sorted = Object.values(stacked).sort((a, b) => {
        const ra = rarityOrder[(a.rarity||'').toLowerCase()] ?? 6;
        const rb = rarityOrder[(b.rarity||'').toLowerCase()] ?? 6;
        return ra - rb || a.name.localeCompare(b.name);
      });

      if (itemNum < 1 || itemNum > sorted.length) {
        return sock.sendMessage(chatId, {
          text: `❌ Invalid item number! You have ${sorted.length} item types.\n\nUse /items to see the list.`
        }, { quoted: msg });
      }

      const selectedStack = sorted[itemNum - 1];
      const type = (selectedStack.type || '').toLowerCase();
      const itemName = selectedStack.name;

      // ── Health Potion ──
      if (itemName === 'Health Potion') {
        if ((inv.healthPotions || 0) < 1) return sock.sendMessage(chatId, { text: `❌ No Health Potions!` }, { quoted: msg });
        const heal = Math.floor(player.stats.maxHp * 0.5);
        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
        player.inventory.healthPotions = (inv.healthPotions || 0) - 1;
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `🧪 *Health Potion* used!\n\n💚 Restored ${heal} HP!\n❤️ HP: ${player.stats.hp}/${player.stats.maxHp}`
        }, { quoted: msg });
      }

      // ── Energy Potion ──
      if (itemName === 'Energy Potion') {
        const epKey = inv.energyPotions !== undefined ? 'energyPotions' : 'manaPotions';
        if ((inv[epKey] || 0) < 1) return sock.sendMessage(chatId, { text: `❌ No Energy Potions!` }, { quoted: msg });
        const restore = Math.floor(player.stats.maxEnergy * 0.5);
        player.stats.energy = Math.min(player.stats.maxEnergy, player.stats.energy + restore);
        player.inventory[epKey] = (inv[epKey] || 0) - 1;
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `💙 *Energy Potion* used!\n\n⚡ Restored ${restore} ${player.energyType || 'Energy'}!\n💙 ${player.energyType || 'Energy'}: ${player.stats.energy}/${player.stats.maxEnergy}`
        }, { quoted: msg });
      }

      // ── Revive Token ──
      if (itemName === 'Revive Token') {
        return sock.sendMessage(chatId, {
          text: `🎫 *Revive Token* saved for battle!\n\n💡 Revive tokens are used automatically when you die in dungeons.`
        }, { quoted: msg });
      }

      // ── Luck Potion ──
      if (itemName === 'Luck Potion' || selectedStack.isLuckPotion) {
        const idx = allItems.findIndex(i => i.name === 'Luck Potion' || i.isLuckPotion);
        if (idx === -1) return sock.sendMessage(chatId, { text: `❌ No Luck Potions found!` }, { quoted: msg });
        allItems.splice(idx, 1);
        if (!player.activeEffects) player.activeEffects = {};
        player.activeEffects.luckPotion = { active: true, expiresAt: Date.now() + (30 * 60 * 1000) };
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `🍀 *Luck Potion* used!\n\n✨ +25% catch rate & casino odds for 30 minutes!`
        }, { quoted: msg });
      }

      // ── Mana Stone (mana) ──
      if (type === 'crystal') {
        const idx = allItems.findIndex(i => i.name === itemName && (i.type||'').toLowerCase() === 'crystal');
        if (idx === -1) return sock.sendMessage(chatId, { text: `❌ Mana Stone not found!` }, { quoted: msg });
        const crystalItem = allItems[idx];
        const bonus = crystalItem.bonus || 10;
        player.manaCrystals = (player.manaCrystals || 0) + bonus;
        allItems.splice(idx, 1);
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `💎 *${itemName}* absorbed!\n\n✨ Gained ${bonus} Mana Stones!\n💎 Total: ${player.manaCrystals}`
        }, { quoted: msg });
      }

      // ── Equipable gear (Weapon, Armor, Accessory) ──
      const idx = allItems.findIndex(i =>
        i.name === itemName &&
        !i.isPetFood &&
        (i.type || '').toLowerCase() !== 'petfood'
      );

      if (idx === -1) {
        return sock.sendMessage(chatId, {
          text: `❌ Item not found in inventory!\n\nUse /items to see your current items.`
        }, { quoted: msg });
      }

      const item = allItems[idx];

      // ── Apply stat bonus ──
      const statResult = applyItemBonus(player, item);

      // ── Log this equip so /idletransfiguration can audit it ──
      if (!player.equippedLog) player.equippedLog = [];
      player.equippedLog.push({
        itemName:  item.name,
        type:      item.type,
        rarity:    item.rarity,
        bonus:     item.bonus || 0,
        atkGiven:  statResult.atkGiven || 0,
        defGiven:  statResult.defGiven || 0,
        appliedAt: Date.now(),
        verified:  true
      });
      // Cap log at 100 entries
      if (player.equippedLog.length > 100) player.equippedLog.shift();

      allItems.splice(idx, 1);
      saveDatabase();

      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `✅ *ITEM EQUIPPED!*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `${getTypeEmoji(item.type)} *${item.name}*\n`;
      message += `⭐ Rarity: ${item.rarity}\n\n`;

      if (statResult.changes.length > 0) {
        message += `📈 *Stat Gains:*\n`;
        for (const change of statResult.changes) {
          message += `  ${change}\n`;
        }
        message += `\n`;
      } else {
        message += `💡 Item absorbed — no direct stat bonus.\n\n`;
      }

      message += `⚔️ ATK: ${player.stats.atk}  🛡️ DEF: ${player.stats.def}\n`;
      message += `❤️ Max HP: ${player.stats.maxHp}  💙 Max ${player.energyType||'Energy'}: ${player.stats.maxEnergy}\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ── /equip gift [#] @mention ───────────────────────────────
    if (subCmd === 'gift') {
      const itemNum = parseInt(args[1]);

      const PET_FOOD_NAMES = new Set([
        'Gel','Water','Meat','Bone','Coal','Fish','Fire Gem','Electric Mana Stone',
        'Metal','Shadow Essence','Dragon Meat','Rare Gems','Spirit Essence',
        'Celestial Fruit','Ice Mana Stone','Phoenix Tears','Chaos Shard',
        'Ancient Stone','Void Mana Stone','Star Dust','Primordial Essence','Existence Shard'
      ]);

      const allItems = player.inventory?.items || [];
      const equippable = allItems.filter(item =>
        !item.isPetFood &&
        (item.type || '').toLowerCase() !== 'petfood' &&
        !PET_FOOD_NAMES.has(item.name)
      );

      const rarityOrder = { mythic:0, legendary:1, epic:2, rare:3, uncommon:4, common:5 };
      const stacked = {};
      for (const item of equippable) {
        if (!stacked[item.name]) stacked[item.name] = { ...item, count: 0 };
        stacked[item.name].count++;
      }
      const sorted = Object.values(stacked).sort((a, b) => {
        const ra = rarityOrder[(a.rarity||'').toLowerCase()] ?? 6;
        const rb = rarityOrder[(b.rarity||'').toLowerCase()] ?? 6;
        return ra - rb || a.name.localeCompare(b.name);
      });

      if (!itemNum || itemNum < 1 || itemNum > sorted.length) {
        return sock.sendMessage(chatId, {
          text: `❌ Invalid item number!\n\nExample: /equip gift 1 @player\nUse /items to see your items.`
        }, { quoted: msg });
      }

      const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentions.length) {
        return sock.sendMessage(chatId, { text: `❌ Tag a player!\nExample: /equip gift 1 @player` }, { quoted: msg });
      }

      const recipientId = mentions[0];
      if (recipientId === sender) return sock.sendMessage(chatId, { text: `❌ Can't gift to yourself!` }, { quoted: msg });

      const recipient = db.users[recipientId];
      if (!recipient) return sock.sendMessage(chatId, { text: `❌ That player is not registered!` }, { quoted: msg });

      const selectedName = sorted[itemNum - 1].name;
      const idx = allItems.findIndex(i => i.name === selectedName);
      if (idx === -1) return sock.sendMessage(chatId, { text: `❌ Item not found!` }, { quoted: msg });

      const item = allItems.splice(idx, 1)[0];
      if (!recipient.inventory) recipient.inventory = { items: [] };
      if (!recipient.inventory.items) recipient.inventory.items = [];
      recipient.inventory.items.push(item);
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *ITEM GIFTED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${getTypeEmoji(item.type)} *${item.name}* → *${recipient.name}*!\n⭐ Rarity: ${item.rarity}\n\n💌 They can use /items to see it.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions: [recipientId]
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎒 *EQUIP COMMANDS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n/items — view your items\n/equip use [#] — use/equip item\n/equip gift [#] @player — gift item\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg });
  }
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function getTypeEmoji(type) {
  switch ((type||'').toLowerCase()) {
    case 'weapon':    return '⚔️';
    case 'armor':     return '🛡️';
    case 'accessory': return '💍';
    case 'potion':    return '🧪';
    case 'consumable':return '🧪';
    case 'crystal':   return '💎';
    default:          return '📦';
  }
}

function applyItemBonus(player, item) {
  const changes = [];
  const bonus = item.bonus || 0;
  const type = (item.type || '').toLowerCase();
  const rarity = (item.rarity || 'common').toLowerCase();

  // Rarity multiplier
  const rarityMult = { common:1, uncommon:1.2, rare:1.5, epic:2, legendary:3, mythic:5 };
  const mult = rarityMult[rarity] || 1;

  // ── Permanent item bonuses are stored on baseStats so that
  //    applyAllocationsToStats() includes them rather than overwriting them.
  //    This prevents items from appearing to reduce stats after relogging
  //    or after stat allocations are recalculated.
  if (!player.baseStats) {
    player.baseStats = {
      hp: player.stats.maxHp || 100,
      atk: player.stats.atk || 10,
      def: player.stats.def || 5,
      magicPower: player.stats.magicPower || 0,
      speed: player.stats.speed || 100,
      critChance: player.stats.critChance || 0,
      critDamage: player.stats.critDamage || 0,
      lifesteal: player.stats.lifesteal || 0,
      maxEnergy: player.stats.maxEnergy || 100
    };
  }

  const applyGain = (stat, gain, displayStat) => {
    // Always positive — items must never reduce stats
    const safeGain = Math.max(1, Math.abs(gain));
    player.baseStats[stat] = (player.baseStats[stat] || 0) + safeGain;
    player.stats[displayStat || stat] = (player.stats[displayStat || stat] || 0) + safeGain;
    return safeGain;
  };

  let atkGiven = 0, defGiven = 0;

  if (type === 'weapon') {
    const raw = bonus > 0 ? Math.round(bonus * mult) : Math.round((player.stats.atk || 10) * 0.05 * mult) + 1;
    atkGiven = applyGain('atk', raw);
    changes.push(`⚔️ ATK +${atkGiven}`);
  } else if (type === 'armor') {
    const raw = bonus > 0 ? Math.round(bonus * mult) : Math.round((player.stats.def || 5) * 0.05 * mult) + 1;
    defGiven = applyGain('def', raw);
    changes.push(`🛡️ DEF +${defGiven}`);
  } else if (type === 'accessory') {
    const rawAtk = bonus > 0 ? Math.round((bonus / 2) * mult) : Math.round((player.stats.atk || 10) * 0.03 * mult) + 1;
    const rawDef = bonus > 0 ? Math.round((bonus / 2) * mult) : Math.round((player.stats.def || 5) * 0.03 * mult) + 1;
    atkGiven = applyGain('atk', rawAtk);
    defGiven = applyGain('def', rawDef);
    changes.push(`⚔️ ATK +${atkGiven}`, `🛡️ DEF +${defGiven}`);
  } else if (type === 'potion') {
    const heal = Math.max(1, Math.floor((player.stats.maxHp || 100) * 0.5));
    player.stats.hp = Math.min(player.stats.maxHp, (player.stats.hp || 0) + heal);
    changes.push(`❤️ HP +${heal}`);
  } else {
    // Unknown gear type — treat as generic ATK boost so the item is never wasted
    if (bonus > 0) {
      const raw = Math.round(bonus * mult);
      atkGiven = applyGain('atk', raw);
      changes.push(`⚔️ ATK +${atkGiven}`);
    }
  }

  // Hard floor — stats can never go below their pre-equip values
  player.stats.atk = Math.max(1, player.stats.atk || 1);
  player.stats.def = Math.max(0, player.stats.def || 0);
  if (player.baseStats) {
    player.baseStats.atk = Math.max(1, player.baseStats.atk || 1);
    player.baseStats.def = Math.max(0, player.baseStats.def || 0);
  }

  return { changes, atkGiven, defGiven };
}