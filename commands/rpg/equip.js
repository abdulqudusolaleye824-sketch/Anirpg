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
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const subCmd = args[0]?.toLowerCase();

    // ── Default: show help ─────────────────────────────────────
    if (!subCmd) {
      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n🎒 *EQUIP COMMANDS* 💎\n${UI.PRO_BAR}\n\n/items — view equippable items\n/items -tier — sorted by rarity\n/equip [#] — equip gear by /inv serial\n/equip use [#] — equip/use item\n/equip gift [#] @player — gift item\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO KIT* — manage your loadout` : `🎒 *EQUIP COMMANDS*\n${UI.FREE_BAR}\n\n/items — view equippable items\n/items -tier — sorted by rarity\n/equip [#] — equip gear by /inv serial\n/equip use [#] — equip/use item\n/equip gift [#] @player — gift item\n${UI.FREE_BAR}\n${UI.upsell()}`)
      }, { quoted: msg });
    }

    // ── /equip <#> — equip gear by /inv serial ─────────────
    // Serials match /inv numbering EXACTLY (shared unified list).
    if (/^\d+$/.test(subCmd)) {
      const serial = parseInt(subCmd);
      try { require('../../rpg/utils/RewardInventory').repairGearSlots(player); } catch (e) {}
      try { require('../../rpg/utils/RewardInventory').migrateLegacy(player); } catch (e) {}
      let serials = [];
      try {
        serials = require('./inventory')._serialList(player);
      } catch (e) {
        serials = [];
      }
      if (serial < 1 || serial > serials.length) {
        return sock.sendMessage(chatId, {
          text: `❌ Invalid serial! You have ${serials.length} inventoried entr${serials.length === 1 ? 'y' : 'ies'}.\n\nUse /inv to see the list.`
        }, { quoted: msg });
      }
      const pickedEntry = serials[serial - 1];
      if (pickedEntry && pickedEntry.kind === 'card') {
        return sock.sendMessage(chatId, {
          text: `❌ *${pickedEntry.name}* is a card, not gear — it can't be equipped.\n\n${(pickedEntry.ref && pickedEntry.ref.useHint) || 'See /inv info for details.'}`
        }, { quoted: msg });
      }
      if (!pickedEntry || pickedEntry.kind !== 'gear' || !pickedEntry.ref) {
        const nm = pickedEntry ? pickedEntry.name : 'that';
        let useHint = '';
        try {
          const il = require('./items')._buildList(player);
          const ix = il.findIndex(e => e.name === pickedEntry.name);
          if (ix >= 0) useHint = `\n💡 Use it with /equip use ${ix + 1} (see /items).`;
        } catch (e) {}
        return sock.sendMessage(chatId, {
          text: `❌ *${nm}* is not gear — only gear can be equipped.\n\nSee /items for Usables.${useHint}`
        }, { quoted: msg });
      }
      const picked = pickedEntry.ref;
      // Resolve the REAL instance in items[] (legacy views are copies).
      const pool = player.inventory?.items || [];
      const real = pool.find(x => x.isGear && (picked.id ? x.id === picked.id : (x.name === picked.name && x.slot === picked.slot)));
      if (!real) {
        return sock.sendMessage(chatId, {
          text: `❌ *${picked.name}* is no longer in your inventory (already equipped?).\n\nUse /inv to see the list.`
        }, { quoted: msg });
      }
      const { SLOT_INFO, equipGear } = require('../../rpg/utils/GearSystem');
      const si = SLOT_INFO[real.slot];
      if (!si) {
        return sock.sendMessage(chatId, { text: `❌ *${real.name}* has an unknown slot (${real.slot || '?'}). Try /inv info, or report this.` }, { quoted: msg });
      }
      const hadOld = player.equippedGear?.[real.slot];
      equipGear(player, real);
      saveDatabase();
      let reply = pro ? `${UI.PRO_BAR}\n✅ *GEAR EQUIPPED!* 💎\n${UI.PRO_BAR}\n\n✅ Equipped *${real.name}*!\n` : `✅ Equipped *${real.name}*!\n`;
      if (hadOld) reply += `⚠️ Previous ${si.name} (${hadOld.name}) was destroyed.\n`;
      reply += `\n${si.emoji} ${si.name} slot now active.\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO GEAR* — ${si.name} active` : `\n${UI.upsell()}`);
      return sock.sendMessage(chatId, { text: reply }, { quoted: msg });
    }


    // ── /equip use [#] ─────────────────────────────────────────
    if (subCmd === 'use') {
      const itemNum = parseInt(args[1]);
      if (!itemNum || isNaN(itemNum)) {
        return sock.sendMessage(chatId, {
          text: `❌ Usage: /equip use [#]\n\nView your items with /items`
        }, { quoted: msg });
      }

      // Same Usables list /items shows (shared builder — numbers match exactly)
      const allItems = player.inventory?.items || [];
      const inv = player.inventory || {};
      const sorted = require('./items')._buildList(player);

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

      // ── Tiered Health Potions (batch-48: shop tiers finally usable) ──
      if (itemName === 'Medium Health Potion' || itemName === 'Higher Health Potion') {
        const tKey = itemName === 'Medium Health Potion' ? 'mediumHealthPotions' : 'higherHealthPotions';
        if ((inv[tKey] || 0) < 1) return sock.sendMessage(chatId, { text: `❌ No ${itemName}s!` }, { quoted: msg });
        const pct = itemName === 'Medium Health Potion' ? 0.25 : 0.5;
        const heal = Math.floor(player.stats.maxHp * pct);
        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
        player.inventory[tKey] = (inv[tKey] || 0) - 1;
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `🧪 *${itemName}* used!\n\n💚 Restored ${heal} HP!\n❤️ HP: ${player.stats.hp}/${player.stats.maxHp}`
        }, { quoted: msg });
      }

      // ── Crafting-material counters can't be "used" — they're for /craft ──
      if (selectedStack._synthetic && String(selectedStack._synthetic).startsWith('mat:')) {
        return sock.sendMessage(chatId, { text: `🧱 *${itemName}* is a crafting material — it can't be used or absorbed.\n\n💡 Spend it in /craft. You CAN gift it: /equip gift ${itemNum} @player` }, { quoted: msg });
      }

      // ── Cards point at their own commands ──
      if (selectedStack._synthetic && String(selectedStack._synthetic).startsWith('card:')) {
        const _hints48 = { 'card:namechange': '/setname (or /guild rename)', 'card:seticon': '/seticon (reply to an image)', 'card:pro_weekly': '/prostore use weekly' };
        const _hint48 = _hints48[selectedStack._synthetic] || '/inv';
        return sock.sendMessage(chatId, { text: `🃏 *${itemName}* ×${selectedStack.count || 1}\n\n💡 Spend it with ${_hint48}. You CAN gift it: /equip gift ${itemNum} @player` }, { quoted: msg });
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

      // Batch-48: crafting materials are NEVER equipped/absorbed — /craft only.
      if (['material', 'crafting', 'craft', 'ingredient', 'reagent'].includes((item.type || '').toLowerCase())) {
        return sock.sendMessage(chatId, { text: `🧱 *${item.name}* is a crafting material — it can't be equipped or absorbed.\n\n💡 Spend it in /craft. You CAN gift it: /equip gift ${itemNum} @player` }, { quoted: msg });
      }

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

      let message = pro ? `${UI.PRO_BAR}\n✅ *ITEM EQUIPPED!* 💎\n${UI.PRO_BAR}\n\n` : `✅ *ITEM EQUIPPED!*\n${UI.FREE_BAR}\n\n`;
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
      message += `${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO KIT* — ${statResult.changes.length} stats up` : `\n${UI.upsell()}`);

      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ── /equip giftconfirm / giftcancel (batch-22 PRO epic+ flow) ──
    if (subCmd === 'giftconfirm' || subCmd === 'giftcancel') {
      const GC = require('../../rpg/utils/GiftConfirm');
      const got = GC.take(sender);
      if (got.error || !got.pending) {
        return sock.sendMessage(chatId, { text: subCmd === 'giftcancel' ? 'ℹ️ You have no pending gift to cancel.' : '❌ No pending gift (it expired or was already handled).' }, { quoted: msg });
      }
      const p = got.pending;
      if (subCmd === 'giftcancel') {
        return sock.sendMessage(chatId, { text: `❌ Gift cancelled — *${p.itemName}* stays in your inventory.` }, { quoted: msg });
      }
      const recipient = db.users[p.recipientId];
      if (!recipient) {
        return sock.sendMessage(chatId, { text: `❌ *${p.itemName}* could not be sent (recipient no longer registered). The item stays with you.` }, { quoted: msg });
      }
      const _pool = player.inventory?.items || [];
      const _ix = _pool.findIndex(i => i.name === p.itemName);
      if (_ix === -1) {
        return sock.sendMessage(chatId, { text: `❌ *${p.itemName}* is no longer in your inventory — gift cancelled.` }, { quoted: msg });
      }
      const _item = _pool.splice(_ix, 1)[0];
      if (!recipient.inventory) recipient.inventory = { items: [] };
      if (!recipient.inventory.items) recipient.inventory.items = [];
      recipient.inventory.items.push({ ..._item, acquiredAt: Date.now() });
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n🎁 *ITEM GIFTED!* 💎\n${UI.PRO_BAR}\n\n${getTypeEmoji(_item.type)} *${_item.name}*` : `🎁 *ITEM GIFTED!*\n${UI.FREE_BAR}\n\n${getTypeEmoji(_item.type)} *${_item.name}*`)+` → *${recipient.name}*!\n⭐ Rarity: ${_item.rarity}\n\n💌 They can use /items to see it.\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO KIT* — gifted ${_item.name}` : `\n${UI.upsell()}`),
        mentions: [p.recipientId]
      }, { quoted: msg });
    }

    // ── /equip gift [#] @mention ───────────────────────────────
    if (subCmd === 'gift') {
      const itemNum = parseInt(args[1]);

      const allItems = player.inventory?.items || [];
      // Full /items list (numbers match /items exactly — synthetics guarded below)
      const sorted = require('./items')._buildList(player);

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

      // Batch-48: counter/card items gift 1 unit — everything is transferable.
      if (sorted[itemNum - 1]._synthetic) {
        const _t = require('./items')._transferSynthetic(player, recipient, sorted[itemNum - 1]);
        if (!_t.ok) return sock.sendMessage(chatId, { text: `❌ ${(_t.error || 'Gift failed.')}` }, { quoted: msg });
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: (pro ? `${UI.PRO_BAR}\n🎁 *ITEM GIFTED!* 💎\n${UI.PRO_BAR}\n\n${getTypeEmoji(sorted[itemNum - 1].type)} *${sorted[itemNum - 1].name}*` : `🎁 *ITEM GIFTED!*\n${UI.FREE_BAR}\n\n${getTypeEmoji(sorted[itemNum - 1].type)} *${sorted[itemNum - 1].name}*`)+` ×1 → *${recipient.name}*!\n\n💌 They can use /items to see it.\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO KIT* — gifted ${sorted[itemNum - 1].name}` : `\n${UI.upsell()}`),
          mentions: [recipientId]
        }, { quoted: msg });
      }
      const selectedName = sorted[itemNum - 1].name;
      const idx = allItems.findIndex(i => i.name === selectedName);
      if (idx === -1) return sock.sendMessage(chatId, { text: `❌ Item not found!` }, { quoted: msg });

      // PRO epic-and-up gifts need an explicit confirmation (batch-22).
      const _giftItem = allItems[idx];
      if (require('../../rpg/utils/GiftConfirm').needsConfirm(pro, _giftItem.rarity)) {
        return require('../../rpg/utils/GiftConfirm').offer(sock, chatId, msg, sender, {
          item: _giftItem, recipientId, recipientName: recipient.name || 'them', cmd: '/equip', itemNum,
        });
      }
      const item = allItems.splice(idx, 1)[0];
      if (!recipient.inventory) recipient.inventory = { items: [] };
      if (!recipient.inventory.items) recipient.inventory.items = [];
      recipient.inventory.items.push(item);
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n🎁 *ITEM GIFTED!* 💎\n${UI.PRO_BAR}\n\n${getTypeEmoji(item.type)} *${item.name}*` : `🎁 *ITEM GIFTED!*\n${UI.FREE_BAR}\n\n${getTypeEmoji(item.type)} *${item.name}*`)+` → *${recipient.name}*!\n⭐ Rarity: ${item.rarity}\n\n💌 They can use /items to see it.\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO KIT* — gifted ${item.name}` : `\n${UI.upsell()}`),
        mentions: [recipientId]
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: (pro ? `${UI.PRO_BAR}\n🎒 *EQUIP COMMANDS* 💎\n${UI.PRO_BAR}\n\n/items — view your items\n/equip [#] — equip gear by /inv serial\n/equip use [#] — use/equip item\n/equip gift [#] @player — gift item\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO KIT* — manage your loadout` : `🎒 *EQUIP COMMANDS*\n${UI.FREE_BAR}\n\n/items — view your items\n/equip [#] — equip gear by /inv serial\n/equip use [#] — use/equip item\n/equip gift [#] @player — gift item\n${UI.FREE_BAR}\n${UI.upsell()}`)
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