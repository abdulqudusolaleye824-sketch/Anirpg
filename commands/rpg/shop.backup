const TaxSystem = require('../../rpg/utils/TaxSystem');
const { updatePlayerGold } = require('../../rpg/utils/GoldManager');

function validatePurchase(player, cost, currency) {
  if (currency === 'gold') {
    if ((player.gold || 0) < cost) {
      return { 
        valid: false, 
        message: `❌ Not enough gold!\n\nNeed: ${cost} 🪙\nHave: ${player.gold || 0} 🪙` 
      };
    }
  } else if (currency === 'crystals') {
    if ((player.manaCrystals || 0) < cost) {
      return { 
        valid: false, 
        message: `❌ Not enough crystals!\n\nNeed: ${cost} 💎\nHave: ${player.manaCrystals || 0} 💎` 
      };
    }
  }
  return { valid: true };
}

// ✅ COMPLETE WEAPON DATABASE FOR ALL 10 CLASSES
const weaponUpgrades = {
  Warrior: [
    { name: 'Iron Sword', bonus: 15, cost: 40000, level: 1 },
    { name: 'Steel Greatsword', bonus: 30, cost: 90000, level: 10 },
    { name: 'Mithril Claymore', bonus: 50, cost: 150000, level: 20 },
    { name: 'Dragon Slayer', bonus: 80, cost: 250000, level: 35 },
    { name: 'Legendary Excalibur', bonus: 120, cost: 1000000, level: 50 }
  ],
  
  Mage: [
    { name: 'Wooden Staff', bonus: 12, cost: 40000, level: 1 },
    { name: 'Crystal Wand', bonus: 28, cost: 90000, level: 10 },
    { name: 'Arcane Scepter', bonus: 45, cost: 150000, level: 20 },
    { name: 'Staff of the Magi', bonus: 75, cost: 220000, level: 35 },
    { name: 'Cosmic Oracle Staff', bonus: 115, cost: 950000, level: 50 }
  ],
  
  Rogue: [
    { name: 'Iron Dagger', bonus: 14, cost: 40000, level: 1 },
    { name: 'Shadow Blade', bonus: 32, cost: 90000, level: 10 },
    { name: 'Venomous Kris', bonus: 52, cost: 150000, level: 20 },
    { name: "Assassin's Edge", bonus: 85, cost: 260000, level: 35 },
    { name: 'Phantom Reaver', bonus: 125, cost: 1050000, level: 50 }
  ],
  
  Archer: [
    { name: 'Short Bow', bonus: 13, cost: 40000, level: 1 },
    { name: 'Longbow', bonus: 29, cost: 90000, level: 10 },
    { name: 'Elven Recurve', bonus: 48, cost: 150000, level: 20 },
    { name: 'Dragon Bone Bow', bonus: 78, cost: 240000, level: 35 },
    { name: 'Celestial Windrunner', bonus: 118, cost: 980000, level: 50 }
  ],
  
  Knight: [
    { name: 'Iron Lance', bonus: 16, cost: 40000, level: 1 },
    { name: 'Steel Halberd', bonus: 31, cost: 90000, level: 10 },
    { name: 'Holy Partisan', bonus: 51, cost: 150000, level: 20 },
    { name: "Paladin's Spear", bonus: 82, cost: 265000, level: 35 },
    { name: 'Divine Judgement', bonus: 122, cost: 1020000, level: 50 }
  ],
  
  Tank: [
    { name: 'Iron Shield', bonus: 10, defBonus: 15, cost: 40000, level: 1 },
    { name: 'Steel Tower Shield', bonus: 20, defBonus: 30, cost: 90000, level: 10 },
    { name: 'Fortress Bulwark', bonus: 35, defBonus: 50, cost: 150000, level: 20 },
    { name: "Titan's Aegis", bonus: 55, defBonus: 80, cost: 280000, level: 35 },
    { name: 'Impenetrable Wall', bonus: 80, defBonus: 120, cost: 1100000, level: 50 }
  ],
  
  Assassin: [
    { name: 'Poison Needle', bonus: 15, cost: 40000, level: 1 },
    { name: 'Twin Daggers', bonus: 33, cost: 90000, level: 10 },
    { name: 'Night Whisper', bonus: 54, cost: 150000, level: 20 },
    { name: "Death's Kiss", bonus: 88, cost: 270000, level: 35 },
    { name: 'Soul Reaper', bonus: 128, cost: 1080000, level: 50 }
  ],
  
  Paladin: [
    { name: 'Holy Mace', bonus: 17, cost: 40000, level: 1 },
    { name: 'Blessed Hammer', bonus: 32, cost: 90000, level: 10 },
    { name: 'Radiant Morningstar', bonus: 52, cost: 150000, level: 20 },
    { name: 'Light Bringer', bonus: 83, cost: 275000, level: 35 },
    { name: "Heaven's Wrath", bonus: 123, cost: 1040000, level: 50 }
  ],
  
  Berserker: [
    { name: 'Heavy Axe', bonus: 18, cost: 40000, level: 1 },
    { name: 'War Cleaver', bonus: 35, cost: 90000, level: 10 },
    { name: 'Blood Reaver', bonus: 56, cost: 150000, level: 20 },
    { name: 'Fury of the North', bonus: 90, cost: 285000, level: 35 },
    { name: 'Ragnarok Destroyer', bonus: 130, cost: 1120000, level: 50 }
  ],
  
  Necromancer: [
    { name: 'Bone Wand', bonus: 13, cost: 40000, level: 1 },
    { name: 'Skull Staff', bonus: 27, cost: 90000, level: 10 },
    { name: "Death's Embrace", bonus: 46, cost: 150000, level: 20 },
    { name: "Lich King's Scepter", bonus: 76, cost: 230000, level: 35 },
    { name: 'Apocalypse Reaper', bonus: 116, cost: 960000, level: 50 }
  ],

 Devourer: [
    { name: 'Fang Blade', bonus: 16, cost: 40000, level: 1 },
    { name: 'Void Ripper', bonus: 34, cost: 90000, level: 10 },
    { name: 'Soul Eater', bonus: 55, cost: 150000, level: 20 },
    { name: 'Abyssal Maw', bonus: 89, cost: 288000, level: 35 },
    { name: 'Eternal Hunger', bonus: 129, cost: 1110000, level: 50 }
  ],
  
  Senku: [
    { name: 'Kingdom of Science Staff', bonus: 20, cost: 50000, level: 1 },
    { name: 'Nitro Formula Flask', bonus: 38, cost: 100000, level: 10 },
    { name: 'Revive Stone Cannon', bonus: 58, cost: 180000, level: 20 },
    { name: 'Science Blaster Mk2', bonus: 90, cost: 300000, level: 35 },
    { name: 'Perseus Reactor', bonus: 135, cost: 1200000, level: 50 },
    { name: '10 Billion% Catalyst', bonus: 200, cost: 5000000, level: 75 }
  ],
   // Both spellings map to same weapons — Dragon Knight players use 'DragonKnight' as class.name
  Dragonknight: [
    { name: 'Scaled Blade', bonus: 17, cost: 40000, level: 1 },
    { name: 'Dragonfire Lance', bonus: 33, cost: 90000, level: 10 },
    { name: 'Wyrmclaw Halberd', bonus: 53, cost: 150000, level: 20 },
    { name: "Dragon Lord's Glaive", bonus: 86, cost: 278000, level: 35 },
    { name: 'Legendary Dragonbane', bonus: 126, cost: 1060000, level: 50 }
  ],
  DragonKnight: [
    { name: 'Scaled Blade', bonus: 17, cost: 40000, level: 1 },
    { name: 'Dragonfire Lance', bonus: 33, cost: 90000, level: 10 },
    { name: 'Wyrmclaw Halberd', bonus: 53, cost: 150000, level: 20 },
    { name: "Dragon Lord's Glaive", bonus: 86, cost: 278000, level: 35 },
    { name: 'Legendary Dragonbane', bonus: 126, cost: 1060000, level: 50 }
  ],
  'Dragon Knight': [
    { name: 'Scaled Blade', bonus: 17, cost: 40000, level: 1 },
    { name: 'Dragonfire Lance', bonus: 33, cost: 90000, level: 10 },
    { name: 'Wyrmclaw Halberd', bonus: 53, cost: 150000, level: 20 },
    { name: "Dragon Lord's Glaive", bonus: 86, cost: 278000, level: 35 },
    { name: 'Legendary Dragonbane', bonus: 126, cost: 1060000, level: 50 }
  ]
};

module.exports = {
  name: 'shop',
  description: 'Buy items, weapons, and artifacts',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You are not registered!' }, { quoted: msg });
    }

    const action = args[0]?.toLowerCase();

    // ============================================
    // MAIN SHOP MENU
    // ============================================
    if (!action) {
      const menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏪 HUNTER SHOP 🏪
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Your Gold: ${player.gold || 0}
💎 Your Crystals: ${player.manaCrystals || 0}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎒 POTIONS & SUPPLIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 🩹 Health Potion - 800 gold
   Restores 50% HP
   
2. ${player.energyColor || '💙'} ${player.energyType || 'Energy'} Potion - 600 gold
   Restores 50% ${player.energyType || 'Energy'}
   
3. 🎫 Revive Token - 3,000 gold
4. 🎟️ Summon Ticket - 50,000 gold
5. 💎 Mana Crystals x100 - 80,000 gold
   Revive once if defeated

4. 🍀 Luck Potion - 2,000 gold
   +25% catch rate & better casino odds
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ WEAPONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/shop weapons - View upgrades
/shop weapon [#] - Buy weapon
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏺 ARTIFACTS (Permanent Buffs)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. 💪 Power Ring - 500 crystals
   +5 ATK permanently
   
6. 🛡️ Guardian Amulet - 500 crystals
   +5 DEF permanently
   
7. ❤️ Vitality Orb - 600 crystals
   +20 Max HP permanently
   
8. ✨ Energy Core - 600 crystals
   +10 Max ${player.energyType || 'Energy'} permanently
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 USAGE
/shop buy [number] [amount]
Example: /shop buy 1 5 | /shop buy 4 1
/shop weapons - View weapon upgrades
/shop weapon [#] - Buy weapon
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: menu }, { quoted: msg });
    }

    // ============================================
    // BUY ITEMS
    // ============================================
    if (action === 'buy') {
      const itemNum = parseInt(args[1]);
      const amount = parseInt(args[2]) || 1;

      if (!itemNum || amount < 1) {
        return sock.sendMessage(chatId, {
          text: '❌ Invalid format!\n\nExample: /shop buy 1 5'
        }, { quoted: msg });
      }

      if (!player.inventory) {
        player.inventory = { 
          healthPotions: 0, 
          energyPotions: 0,
          manaPotions: 0,
          reviveTokens: 0
        };
      }

      let cost, currency, itemName, success = false, taxAmount = 0;

      switch(itemNum) {
        case 1: // Health Potion
          cost = 800 * amount;
          currency = 'gold';
          itemName = `Health Potion${amount > 1 ? 's' : ''}`;
          
          const val1 = validatePurchase(player, cost, currency);
          if (!val1.valid) return sock.sendMessage(chatId, { text: val1.message }, { quoted: msg });
          
          taxAmount = TaxSystem.applyTax(db, cost, currency, saveDatabase);
          updatePlayerGold(player, -cost, null);
          player.inventory.healthPotions = (player.inventory.healthPotions || 0) + amount;
          success = true;
          break;

        case 2: // Energy Potion
          cost = 600 * amount;
          currency = 'gold';
          itemName = `${player.energyType || 'Energy'} Potion${amount > 1 ? 's' : ''}`;
          
          const val2 = validatePurchase(player, cost, currency);
          if (!val2.valid) return sock.sendMessage(chatId, { text: val2.message }, { quoted: msg });
          
          taxAmount = TaxSystem.applyTax(db, cost, currency, saveDatabase);
          updatePlayerGold(player, -cost, null);
          
          if (player.inventory.energyPotions !== undefined) {
            player.inventory.energyPotions = (player.inventory.energyPotions || 0) + amount;
          } else {
            player.inventory.manaPotions = (player.inventory.manaPotions || 0) + amount;
          }
          success = true;
          break;

        case 4: // Summon Ticket
          if (player.gold < 50000 * amount) {
            return sock.sendMessage(chatId, { text: `❌ Not enough gold!\nNeed: ${(50000*amount).toLocaleString()}g | Have: ${(player.gold||0).toLocaleString()}g` }, { quoted: msg });
          }
          player.gold -= 50000 * amount;
          player.summonTickets = (player.summonTickets||0) + amount;
          itemName = `Summon Ticket${amount>1?'s':''}`;
          cost = 50000 * amount;
          break;
        case 5: // Mana Crystals x100
          if (player.gold < 80000 * amount) {
            return sock.sendMessage(chatId, { text: `❌ Not enough gold!\nNeed: ${(80000*amount).toLocaleString()}g | Have: ${(player.gold||0).toLocaleString()}g` }, { quoted: msg });
          }
          player.gold -= 80000 * amount;
          player.manaCrystals = (player.manaCrystals||0) + (100 * amount);
          itemName = `Mana Crystals x${100*amount}`;
          cost = 80000 * amount;
          break;
        case 3: // Revive Token
          cost = 3000 * amount;
          currency = 'gold';
          itemName = `Revive Token${amount > 1 ? 's' : ''}`;
          
          const val3 = validatePurchase(player, cost, currency);
          if (!val3.valid) return sock.sendMessage(chatId, { text: val3.message }, { quoted: msg });
          
          taxAmount = TaxSystem.applyTax(db, cost, currency, saveDatabase);
          updatePlayerGold(player, -cost, null);
          player.inventory.reviveTokens = (player.inventory.reviveTokens || 0) + amount;
          success = true;
          break;

        case 4: // Luck Potion
          cost = 2000 * amount;
          currency = 'gold';
          itemName = `Luck Potion${amount > 1 ? 's' : ''}`;
          
          const val4lp = validatePurchase(player, cost, currency);
          if (!val4lp.valid) return sock.sendMessage(chatId, { text: val4lp.message }, { quoted: msg });
          
          taxAmount = TaxSystem.applyTax(db, cost, currency, saveDatabase);
          updatePlayerGold(player, -cost, null);
          if (!player.inventory.items) player.inventory.items = [];
          for (let i = 0; i < amount; i++) {
            player.inventory.items.push({ name: 'Luck Potion', type: 'Consumable', rarity: 'uncommon', isLuckPotion: true });
          }
          success = true;
          break;

        case 5: // Power Ring
          cost = 500;
          currency = 'crystals';
          itemName = 'Power Ring';
          if (amount !== 1) return sock.sendMessage(chatId, { text: '❌ Can only buy 1 artifact at a time!' }, { quoted: msg });
          
          const val4 = validatePurchase(player, cost, currency);
          if (!val4.valid) return sock.sendMessage(chatId, { text: val4.message }, { quoted: msg });
          
          player.manaCrystals -= cost;
          if (player.manaCrystals < 0) player.manaCrystals = 0;
          // Apply to baseStats so it persists through recalculations
          if (!player.baseStats) player.baseStats = {};
          player.baseStats.atk = (player.baseStats.atk || player.stats.atk || 10) + 5;
          player.stats.atk = (player.stats.atk || 10) + 5;
          // Store in new artifact inventory format
          if (!player.artifacts || !player.artifacts.inventory) {
            player.artifacts = { inventory: [], equipped: { weapon:null,armor:null,helmet:null,gloves:null,ring:null,amulet:null,tome:null,boots:null } };
          }
          player.artifacts.inventory.push('Power Ring');
          success = true;
          break;

        case 6: // Guardian Amulet
          cost = 500;
          currency = 'crystals';
          itemName = 'Guardian Amulet';
          if (amount !== 1) return sock.sendMessage(chatId, { text: '❌ Can only buy 1 artifact at a time!' }, { quoted: msg });
          
          const val5b = validatePurchase(player, cost, currency);
          if (!val5b.valid) return sock.sendMessage(chatId, { text: val5b.message }, { quoted: msg });
          
          player.manaCrystals -= cost;
          if (player.manaCrystals < 0) player.manaCrystals = 0;
          // Apply stat directly to baseStats so it persists through recalculations
          if (!player.baseStats) player.baseStats = {};
          player.baseStats.def = (player.baseStats.def || player.stats.def || 5) + 5;
          player.stats.def = (player.stats.def || 5) + 5;
          // Store in new artifact inventory format
          if (!player.artifacts || !player.artifacts.inventory) {
            player.artifacts = { inventory: [], equipped: { weapon:null,armor:null,helmet:null,gloves:null,ring:null,amulet:null,tome:null,boots:null } };
          }
          player.artifacts.inventory.push('Guardian Amulet');
          success = true;
          break;

        case 7: // Vitality Orb
          cost = 600;
          currency = 'crystals';
          itemName = 'Vitality Orb';
          if (amount !== 1) return sock.sendMessage(chatId, { text: '❌ Can only buy 1 artifact at a time!' }, { quoted: msg });
          
          const val6b = validatePurchase(player, cost, currency);
          if (!val6b.valid) return sock.sendMessage(chatId, { text: val6b.message }, { quoted: msg });
          
          player.manaCrystals -= cost;
          if (player.manaCrystals < 0) player.manaCrystals = 0;
          // Apply to baseStats so it persists through recalculations
          if (!player.baseStats) player.baseStats = {};
          player.baseStats.hp = (player.baseStats.hp || player.stats.maxHp || 100) + 20;
          player.stats.maxHp = (player.stats.maxHp || 100) + 20;
          player.stats.hp = Math.min(player.stats.hp + 20, player.stats.maxHp);
          // Store in new artifact inventory format
          if (!player.artifacts || !player.artifacts.inventory) {
            player.artifacts = { inventory: [], equipped: { weapon:null,armor:null,helmet:null,gloves:null,ring:null,amulet:null,tome:null,boots:null } };
          }
          player.artifacts.inventory.push('Vitality Orb');
          success = true;
          break;

        case 8: // Energy Core
          cost = 600;
          currency = 'crystals';
          itemName = 'Energy Core';
          if (amount !== 1) return sock.sendMessage(chatId, { text: '❌ Can only buy 1 artifact at a time!' }, { quoted: msg });
          
          const val7b = validatePurchase(player, cost, currency);
          if (!val7b.valid) return sock.sendMessage(chatId, { text: val7b.message }, { quoted: msg });
          
          player.manaCrystals -= cost;
          if (player.manaCrystals < 0) player.manaCrystals = 0;
          // Apply to baseStats so it persists through recalculations
          if (!player.baseStats) player.baseStats = {};
          player.baseStats.maxEnergy = (player.baseStats.maxEnergy || player.stats.maxEnergy || 100) + 10;
          player.stats.maxEnergy = (player.stats.maxEnergy || 100) + 10;
          player.stats.energy = Math.min(player.stats.energy + 10, player.stats.maxEnergy);
          // Store in new artifact inventory format
          if (!player.artifacts || !player.artifacts.inventory) {
            player.artifacts = { inventory: [], equipped: { weapon:null,armor:null,helmet:null,gloves:null,ring:null,amulet:null,tome:null,boots:null } };
          }
          player.artifacts.inventory.push('Energy Core');
          success = true;
          break;

        default:
          return sock.sendMessage(chatId, { text: '❌ Invalid item number!' }, { quoted: msg });
      }

      if (success) {
        saveDatabase();
        
        let response = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ PURCHASE SUCCESSFUL! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Item: ${itemName}
${amount > 1 ? `📊 Quantity: ${amount}\n` : ''}💰 Cost: ${cost} ${currency === 'gold' ? '🪙' : '💎'}`;
        
        if (taxAmount > 0) {
          response += `\n💸 System Fee: ${taxAmount}g (5%)`;
        }
        
        response += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Gold Left: ${player.gold || 0}
💎 Crystals Left: ${player.manaCrystals || 0}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        return sock.sendMessage(chatId, { text: response }, { quoted: msg });
      }
    }

    // ============================================
    // WEAPONS MENU
    // ============================================
    if (action === 'weapons') {
      const className = typeof player.class === 'string' ? player.class : (player.class?.name || 'Warrior');
      const classWeapons = weaponUpgrades[className] || [];
      
      if (classWeapons.length === 0) {
        return sock.sendMessage(chatId, { 
          text: `❌ No weapons available for ${className}! Contact admin.` 
        }, { quoted: msg });
      }
      
      let weaponMenu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ WEAPON UPGRADES ⚔️
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Class: ${className}
Current: ${player.weapon?.name || 'None'} (+${player.weapon?.bonus || player.weapon?.attack || 0} ATK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      classWeapons.forEach((weapon, i) => {
        const locked = player.level < weapon.level;
        const status = locked ? '🔒' : '✅';
        const current = player.weapon?.name === weapon.name ? '📍' : '';
        const tax = TaxSystem.getTaxAmount(weapon.cost);
        
        weaponMenu += `${status} ${current} ${i + 1}. ${weapon.name}\n`;
        weaponMenu += `   +${weapon.bonus} ATK`;
        if (weapon.defBonus) weaponMenu += ` | +${weapon.defBonus} DEF`;
        weaponMenu += ` | ${weapon.cost}g (+${tax}g fee) | Lv.${weapon.level}\n\n`;
      });

      weaponMenu += `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Your Gold: ${player.gold || 0}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 USAGE
/shop weapon [number]
Example: /shop weapon 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: weaponMenu }, { quoted: msg });
    }

    // ============================================
    // BUY WEAPON
    // ============================================
    if (action === 'weapon') {
      const weaponNum = parseInt(args[1]);
      if (!weaponNum) {
        return sock.sendMessage(chatId, { text: '❌ Specify weapon number!' }, { quoted: msg });
      }

      const className = typeof player.class === 'string' ? player.class : (player.class?.name || 'Warrior');
      const classWeapons = weaponUpgrades[className] || [];

      if (classWeapons.length === 0) {
        return sock.sendMessage(chatId, { 
          text: `❌ No weapons available for ${className}!` 
        }, { quoted: msg });
      }

      const weapon = classWeapons[weaponNum - 1];
      if (!weapon) {
        return sock.sendMessage(chatId, { 
          text: `❌ Invalid weapon number! Choose 1-${classWeapons.length}` 
        }, { quoted: msg });
      }

      if (player.level < weapon.level) {
        return sock.sendMessage(chatId, { 
          text: `❌ You need level ${weapon.level}! (You are ${player.level})` 
        }, { quoted: msg });
      }

      if (player.weapon?.name === weapon.name) {
        return sock.sendMessage(chatId, { text: '❌ You already own this weapon!' }, { quoted: msg });
      }

      const validation = validatePurchase(player, weapon.cost, 'gold');
      if (!validation.valid) {
        return sock.sendMessage(chatId, { text: validation.message }, { quoted: msg });
      }

      const taxAmount = TaxSystem.applyTax(db, weapon.cost, 'gold', saveDatabase);
      updatePlayerGold(player, -weapon.cost, saveDatabase);
      
      player.weapon = { 
        name: weapon.name, 
        bonus: weapon.bonus,
        attack: weapon.bonus,
        defense: weapon.defBonus || 0
      };

      if (player.stats && weapon.defBonus) {
        if (!player.baseStats) player.baseStats = {};
        player.baseStats.def = (player.baseStats.def || player.stats.def || 5) + weapon.defBonus;
        player.stats.def = (player.stats.def || 5) + weapon.defBonus;
      }

      saveDatabase();

      let response = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ WEAPON PURCHASED! ⚔️
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ ${weapon.name}
⚔️ +${weapon.bonus} ATK`;
      
      if (weapon.defBonus) {
        response += `\n🛡️ +${weapon.defBonus} DEF`;
      }
      
      response += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Cost: ${weapon.cost} 🪙
💸 System Fee: ${taxAmount}g (5%)
💰 Gold Left: ${player.gold || 0}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use /stats to see your new power!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: response }, { quoted: msg });
    }

    // Invalid action
    return sock.sendMessage(chatId, { 
      text: '❌ Invalid command! Use /shop to see options.' 
    }, { quoted: msg });
  }
};