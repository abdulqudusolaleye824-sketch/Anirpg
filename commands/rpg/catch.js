const PetManager = require('../../rpg/utils/PetManager');
const DungeonPartyManager = require('../../rpg/dungeons/DungeonPartyManager');
const AchievementManager = require('../../rpg/utils/AchievementManager');


module.exports = {
  name: 'catch',
  aliases: ['capture'],
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { 
        text: '❌ You need to /start first!' 
      }, { quoted: msg });
    }

    // Check if in active dungeon
    const party = DungeonPartyManager.getPartyByPlayer(sender);
    if (!party || party.status !== 'active') {
      return sock.sendMessage(chatId, {
        text: '❌ No active dungeon! Pet encounters only happen in dungeons.'
      }, { quoted: msg });
    }

    const dungeon = party.dungeon;
    
    if (!dungeon.pendingPet) {
      return sock.sendMessage(chatId, {
        text: '❌ No wild pet to catch! Keep exploring to find pets.'
      }, { quoted: msg });
    }

    // Track catch attempts
    if (dungeon.petCatchAttempts === undefined) dungeon.petCatchAttempts = 1;
    if (dungeon.petCatchAttempts <= 0) {
      dungeon.pendingPet = null;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: '❌ No catch attempts remaining! The pet fled.'
      }, { quoted: msg });
    }

    dungeon.petCatchAttempts--;

    const petId = dungeon.pendingPet;
    const { PET_DATABASE } = require('../../rpg/utils/PetDatabase');
    const petTemplate = PET_DATABASE[petId];

    if (!petTemplate) {
      dungeon.pendingPet = null;
      saveDatabase();
      return sock.sendMessage(chatId, { text: '❌ Unknown pet encountered!' }, { quoted: msg });
    }

    // Cost by rarity
    const catchCosts = {
      common:    { gold: 20000,   crystals: 500 },
      uncommon:  { gold: 40000,   crystals: 1000 },
      rare:      { gold: 80000,   crystals: 2000 },
      epic:      { gold: 200000,  crystals: 5000 },
      legendary: { gold: 500000,  crystals: 10000 },
      mythic:    { gold: 1000000, crystals: 20000 }
    };
    const cost = catchCosts[petTemplate.rarity] || catchCosts.common;

    if ((player.gold || 0) < cost.gold) {
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `❌ NOT ENOUGH GOLD!\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `${petTemplate.emoji} *${petTemplate.name}* (${petTemplate.rarity.toUpperCase()})\n\n` +
              `💠 Cost: ${cost.gold.toLocaleString()} 💠 + ${cost.crystals} 💎\n` +
              `💠 You have: ${(player.gold||0).toLocaleString()}g\n\n` +
              `⚠️ The pet will flee if you don't catch it now!`
      }, { quoted: msg });
    }

    if ((player.manaCrystals || 0) < cost.crystals) {
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `❌ NOT ENOUGH MANA STONES!\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `${petTemplate.emoji} *${petTemplate.name}* (${petTemplate.rarity.toUpperCase()})\n\n` +
              `💎 Cost: ${cost.gold.toLocaleString()} 💠 + ${cost.crystals} 💎\n` +
              `💎 You have: ${player.manaCrystals||0} 💎\n\n` +
              `⚠️ The pet will flee if you don't catch it now!`
      }, { quoted: msg });
    }

    // Deduct cost regardless of catch success
    player.gold = (player.gold || 0) - cost.gold;
    player.manaCrystals = (player.manaCrystals || 0) - cost.crystals;
    if (!player.inventory) player.inventory = {};
    player.inventory.gold = player.gold;

    // Apply luck potion bonus
    const luckItems = (player.inventory?.items || []).filter(i => i.name === 'Luck Potion' || i.isLuckPotion);
    const luckBonus = luckItems.length > 0 ? 25 : 0;
    if (luckBonus > 0) {
      const luckIdx = player.inventory.items.findIndex(i => i.name === 'Luck Potion' || i.isLuckPotion);
      if (luckIdx !== -1) player.inventory.items.splice(luckIdx, 1);
    }

    // Owner, co-owner, and Paladin get guaranteed catch
    const OWNER_ID = '221951679328499@lid';
    const COOWNER_ID = '194592469209292@lid';
    const playerClass = typeof player.class === 'string' ? player.class : player.class?.name;
    const isGuaranteedCatch = sender === OWNER_ID || sender === COOWNER_ID || playerClass === 'Paladin';

    const result = PetManager.attemptCatch(sender, petId, luckBonus, isGuaranteedCatch);

    const attemptsLeft = dungeon.petCatchAttempts || 0;
    if (!result.success && attemptsLeft > 0) {
      // Don't clear pet yet, they still have attempts
      saveDatabase();
      let message = result.message + '\n\n';
      message += `💸 Lost: ${cost.gold.toLocaleString()} 💠 + ${cost.crystals} 💎 (attempt cost)\n`;
      message += `🎯 Attempts remaining: *${attemptsLeft}*`;
      if (luckBonus > 0) message += `\n🍀 Luck Potion consumed`;
      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    dungeon.pendingPet = null;
    saveDatabase();

    if (result.success) {
      // Track pet catch achievements
      try {
        const petCount = Object.keys(PetManager.getPlayerPets ? PetManager.getPlayerPets(sender) : {}).length;
        const achis = [
          ...AchievementManager.track(player, 'pets_caught', 1),
          ...AchievementManager.track(player, 'pets_owned', petCount, {}),
          ...AchievementManager.track(player, 'pet_rarity', 1, { rarity: result.pet?.rarity || 'common' })
        ];
        if (achis.length > 0) {
          await sock.sendMessage(chatId, { text: AchievementManager.buildNotification(achis) }, { quoted: msg });
        }
      } catch(e) {}

      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `🎉 PET CAUGHT!\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `${result.pet.emoji} You caught a *${result.pet.name}*!\n\n`;
      message += `⭐ Rarity: ${result.pet.rarity.toUpperCase()}\n`;
      message += `🔮 Type: ${result.pet.type}\n\n`;
      message += `💸 Paid: ${cost.gold.toLocaleString()} 💠 + ${cost.crystals} 💎\n`;
      if (luckBonus > 0) message += `🍀 Luck Potion used! (+${luckBonus}% catch rate)\n`;
      if (result.isFirstPet) {
        message += `\n✨ This is your first pet! Set as active companion.\n`;
      }
      message += `\nUse /pet list to view your pets!`;
      
      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    } else {
      let message = result.message + '\n\n';
      message += `💸 Lost: ${cost.gold.toLocaleString()} 💠 + ${cost.crystals} 💎 (attempt cost)`;
      if (luckBonus > 0) message += `\n🍀 Luck Potion consumed`;
      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }
  }
};