const PlayerManager = require('../../rpg/player/PlayerManager');
const RegenManager = require('../../rpg/utils/RegenManager');
const TaxSystem = require('../../rpg/utils/TaxSystem');
const { updatePlayerNexus } = require('../../rpg/utils/NexusManager');

const classNameMap = {
  'warrior': 'Warrior',
  'mage': 'Mage',
  'archer': 'Archer',
  'rogue': 'Rogue',
  'berserker': 'Berserker',
  'paladin': 'Paladin',
  'necromancer': 'Necromancer',
  'assassin': 'Assassin',
  'dragonknight': 'DragonKnight',
  'devourer': 'Devourer'
};

module.exports = {
  name: 'reset',
  description: 'Reset your class or character',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: '❌ You are not registered!'
      }, { quoted: msg });
    }

    const action = args[0]?.toLowerCase();
    const RESET_COST = 1000000;
    const CRYSTAL_COST = 30000;

    if (!action) {
      if (player.pendingReset) {
        const tax = TaxSystem.getTaxAmount(player.pendingReset.cost);
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 PENDING CLASS CHANGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━
New Class: ${player.pendingReset.newClass}
Cost: ${player.pendingReset.cost} 💠
System Fee: ${tax} (5%)

Type class name to CONFIRM:
/reset ${player.pendingReset.newClass.toLowerCase()}

Or: /reset cancel
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 CLASS RESET SYSTEM 🔄
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Current: ${player.class.name}
⭐ Level: ${player.level}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 OPTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ /reset class
   Cost: ${RESET_COST} Nexus + 5% fee
   
2️⃣ /reset full
   Cost: FREE
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Your Nexus: ${player.gold || 0}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    if (action === 'cancel') {
      if (!player.pendingReset) {
        return sock.sendMessage(chatId, { 
          text: '❌ No pending reset!' 
        }, { quoted: msg });
      }

      delete player.pendingReset;
      saveDatabase();

      return sock.sendMessage(chatId, { 
        text: '✅ Class change cancelled.' 
      }, { quoted: msg });
    }

    if (action === 'full') {
      // Must be level 10 or above
      if ((player.level || 1) < 10) {
        return sock.sendMessage(chatId, {
          text: `❌ Full reset is only available to hunters Level 10 and above!\n\n📊 Your level: ${player.level || 1}\n🎯 Required: Level 10`
        }, { quoted: msg });
      }

      if (!player.confirmFullReset) {
        player.confirmFullReset = Date.now();
        saveDatabase();

        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ FULL RESET WARNING ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━
This will DELETE EVERYTHING!

Type again to confirm: /reset full
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      if (Date.now() - player.confirmFullReset > 30000) {
        delete player.confirmFullReset;
        saveDatabase();
        return sock.sendMessage(chatId, { 
          text: '❌ Confirmation expired.' 
        }, { quoted: msg });
      }

      // Wipe player from main database
      delete db.users[sender];
      saveDatabase();

      // Also wipe from side databases (pets, quests, achievements)
      try {
        const fs = require('fs');
        const path = require('path');
        const BASE = require('path').join(__dirname, '../../rpg/data');
        for (const fname of ['playerPets.json', 'playerQuests.json', 'achievements.json']) {
          const fp = require('path').join(BASE, fname);
          if (fs.existsSync(fp)) {
            const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
            delete raw[sender];
            fs.writeFileSync(fp, JSON.stringify(raw, null, 2));
          }
        }
      } catch (e) {
        console.error('Side-db wipe error on full reset:', e.message);
      }

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔄 FULL RESET COMPLETE\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nAll your data has been erased.\nUse /register to start fresh!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    if (action === 'class') {
      if ((player.gold || 0) < RESET_COST) {
        return sock.sendMessage(chatId, {
          text: `❌ Not enough gold!\n\nNeed: ${RESET_COST} 💠\nHave: ${player.gold || 0} 💠`
        }, { quoted: msg });
      }

      const tax = TaxSystem.getTaxAmount(RESET_COST);
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 CLASS CHANGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Choose your NEW class:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ WARRIOR | 🔮 MAGE | 🏹 ARCHER
🗡️ ROGUE | ⚔️ BERSERKER | ✨ PALADIN
💀 NECROMANCER | 🌑 ASSASSIN
🐉 DRAGONKNIGHT | 🩸 DEVOURER
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Cost: ${RESET_COST} Nexus
💸 System Fee: ${tax} (5%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 TYPE: /reset [class name]
Example: /reset mage
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    const BOT_OWNER = '221951679328499@lid';

    // Senku is divine/exclusive — only owner can have it, and can't be reset to by anyone
    if (action === 'senku') {
      return sock.sendMessage(chatId, {
        text: '❌ This class is not available through class reset.'
      }, { quoted: msg });
    }

    // Strip Senku from what owner can reset to as well (they already have it)
    const validClasses = Object.keys(classNameMap).map(k => k.toLowerCase());
    
    if (validClasses.includes(action)) {
      const newClassName = classNameMap[action];

      if (player.pendingReset) {
        if (player.pendingReset.newClass !== newClassName) {
          return sock.sendMessage(chatId, {
            text: `❌ Class mismatch!\n\nPending: ${player.pendingReset.newClass}\nYou typed: ${newClassName}`
          }, { quoted: msg });
        }

        // Execute reset
        const tax = TaxSystem.applyTax(db, player.pendingReset.cost, 'gold');
        updatePlayerNexus(player, -player.pendingReset.cost, null);
        player.manaCrystals = Math.max(0, (player.manaCrystals || 0) - CRYSTAL_COST);
        
        const classDef = PlayerManager.classDefinitions[newClassName];
        
        player.class.name = newClassName;
        player.class.rarity = classDef.rarity;
        player.energyType = classDef.energyType;
        player.energyColor = classDef.energyColor;
        player.stats.energy = classDef.baseStats.energy;
        player.stats.maxEnergy = classDef.baseStats.energy;
        player.skills.active = classDef.skills.map(s => ({...s}));
        player.skills.passive = classDef.passive ? classDef.passive.map(p => ({...p})) : [];
        player.weapon = { ...classDef.weapon };
        player.lastSkillUse = {};
        player.skillCooldowns = {};
        
        delete player.pendingReset;
        saveDatabase(); // ✅ SAVE!

        RegenManager.stopRegen(sender);
        RegenManager.startRegen(sender, player, getDatabase, saveDatabase, sock);

        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CLASS CHANGE COMPLETE! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 You are now a ${player.class.name}!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Cost: ${RESET_COST}
💸 Fee: ${tax}
💠 Nexus Left: ${player.gold || 0}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      if (player.class.name === newClassName) {
        return sock.sendMessage(chatId, {
          text: `❌ You are already a ${player.class.name}!`
        }, { quoted: msg });
      }

      if ((player.gold || 0) < RESET_COST) {
        return sock.sendMessage(chatId, {
          text: `❌ Not enough gold!\n\nNeed: ${RESET_COST} 💠\nHave: ${player.gold || 0} 💠`
        }, { quoted: msg });
      }

      player.pendingReset = {
        newClass: newClassName,
        cost: RESET_COST,
        timestamp: Date.now()
      };
      saveDatabase();

      const classDef = PlayerManager.classDefinitions[newClassName];
      const tax = TaxSystem.getTaxAmount(RESET_COST);

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CONFIRM CLASS CHANGE ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current: ${player.class.name}
New: ${newClassName} (${classDef.rarity})
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Cost: ${RESET_COST} Nexus
💸 System Fee: ${tax} (5%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ TYPE CLASS NAME TO CONFIRM:
/reset ${action}

Or: /reset cancel
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: `❌ Invalid option!`
    }, { quoted: msg });
  }
};