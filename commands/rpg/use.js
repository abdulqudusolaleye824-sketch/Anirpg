// ═══════════════════════════════════════════════════════════════
// /use — Use consumable items (potions, revives, Guild Victory Cards)
//
// Usage:
//   /use              — show inventory
//   /use heal         — use a Health Potion
//   /use energy       — use an Energy Potion
//   /use revive       — use a Revive Token
//   /use GVC --gold   — use Gold Guild Victory Card (15k Nexus + 3k Mana Stones)
//   /use GVC --silver — use Silver Guild Victory Card (10k Nexus + 2k Mana Stones)
//   /use GVC --bronze — use Bronze Guild Victory Card (5k Nexus + 2k Mana Stones)
// ═══════════════════════════════════════════════════════════════

module.exports = {
  name: 'use',
  description: 'Use consumable items (potions, revives, Guild Victory Cards)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      await sock.sendMessage(chatId, {
        text: '❌ You are not registered!'
      }, { quoted: msg });
      return;
    }

    if (!player.inventory) {
      player.inventory = { healthPotions: 0, energyPotions: 0, reviveTokens: 0, cards: {} };
    }
    if (!player.inventory.cards) {
      player.inventory.cards = {};
    }

    const fullText = (args.join(' ') || '').toLowerCase();
    const action   = args[0]?.toLowerCase();

    // ═══════════════════════════════════════
    // 🏆 USE GUILD VICTORY CARDS (GVC)
    // ═══════════════════════════════════════
    if (action === 'gvc' || action === 'gvc_gold' || action === 'gvc_silver' || action === 'gvc_bronze' ||
        fullText.includes('gold') || fullText.includes('silver') || fullText.includes('bronze')) {

      let cardType = null;
      if (fullText.includes('gold'))   cardType = 'gvc_gold';
      if (fullText.includes('silver')) cardType = 'gvc_silver';
      if (fullText.includes('bronze')) cardType = 'gvc_bronze';

      if (!cardType) {
        return sock.sendMessage(chatId, {
          text: '❌ Specify card type!\nUsage: /use GVC --gold | /use GVC --silver | /use GVC --bronze'
        }, { quoted: msg });
      }

      const count = player.inventory.cards[cardType] || 0;
      if (count <= 0) {
        const label = cardType === 'gvc_gold' ? 'Gold' : cardType === 'gvc_silver' ? 'Silver' : 'Bronze';
        return sock.sendMessage(chatId, {
          text: `❌ You do not have a ${label} Guild Victory Card!\nEarn GVC cards by participating in the Weekly Guild War contest.`
        }, { quoted: msg });
      }

      player.inventory.cards[cardType]--;

      let nexusReward = 0;
      let manaReward  = 0;
      let label       = '';
      let emoji       = '';

      if (cardType === 'gvc_gold') {
        nexusReward = 15000;
        manaReward  = 3000;
        label       = 'GOLD GUILD VICTORY CARD';
        emoji       = '🥇';
      } else if (cardType === 'gvc_silver') {
        nexusReward = 10000;
        manaReward  = 2000;
        label       = 'SILVER GUILD VICTORY CARD';
        emoji       = '🥈';
      } else {
        nexusReward = 5000;
        manaReward  = 2000;
        label       = 'BRONZE GUILD VICTORY CARD';
        emoji       = '🥉';
      }

      player.gold = (player.gold || 0) + nexusReward;
      player.manaCrystals = (player.manaCrystals || 0) + manaReward;
      if (player.inventory) player.inventory.gold = player.gold;

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `${emoji} *${label} USED!*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `👤 Hunter: *${player.name}*`,
          ``,
          `✨ *REWARDS RECEIVED:*`,
          `💠 Nexus: *+${nexusReward.toLocaleString()}*`,
          `💎 Mana Stones: *+${manaReward.toLocaleString()}*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `💳 Cards Remaining: *${player.inventory.cards[cardType]}*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════
    // 📋 USE MENU
    // ═══════════════════════════════════════
    if (!action) {
      const inSoloBattle = player.dungeon?.currentBattle || player.boss?.currentBattle;
      const party = Object.values(db.parties || {}).find(p => p.members.includes(sender));
      const inPartyBattle = party && db.partyBattles?.[party.id];

      let battleStatus = '';
      if (inSoloBattle)        battleStatus = '\n⚔️ *IN SOLO BATTLE* - Can use potions!\n';
      else if (inPartyBattle)  battleStatus = '\n⚔️ *IN PARTY BATTLE* - Can use potions!\n';
      else                     battleStatus = '\n✅ Available anytime\n';

      const goldCards   = player.inventory.cards?.gvc_gold || 0;
      const silverCards = player.inventory.cards?.gvc_silver || 0;
      const bronzeCards = player.inventory.cards?.gvc_bronze || 0;

      const menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💊 USE ITEMS MENU 💊
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 YOUR POTIONS & CARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🩹 Health Potions: ${player.inventory.healthPotions || 0}
   Restores: 50% HP

${player.energyColor || '💙'} ${player.energyType || 'Mana'} Potions: ${player.inventory.energyPotions || player.inventory.manaPotions || 0}
   Restores: 50% ${player.energyType || 'Mana'}

🎫 Revive Tokens: ${player.inventory.reviveTokens || 0}
   Revives you on death

🥇 Gold Guild Victory Cards: ${goldCards}
🥈 Silver Guild Victory Cards: ${silverCards}
🥉 Bronze Guild Victory Cards: ${bronzeCards}
${battleStatus}━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/use heal          - Use Health Potion
/use energy        - Use Mana Potion
/use revive        - Use Revive Token
/use GVC --gold    - Use Gold Victory Card (15k Nexus + 3k MS)
/use GVC --silver  - Use Silver Victory Card (10k Nexus + 2k MS)
/use GVC --bronze  - Use Bronze Victory Card (5k Nexus + 2k MS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await sock.sendMessage(chatId, { text: menu }, { quoted: msg });
      return;
    }

    // ═══════════════════════════════════════
    // 🩹 USE HEALTH POTION
    // ═══════════════════════════════════════
    if (action === 'heal' || action === 'health' || action === 'hp') {
      if ((player.inventory.healthPotions || 0) <= 0) {
        await sock.sendMessage(chatId, {
          text: '❌ You have no Health Potions!\n\nBuy them at /shop\nPrice: 800 Ne each'
        }, { quoted: msg });
        return;
      }

      if (player.stats.hp >= player.stats.maxHp) {
        await sock.sendMessage(chatId, {
          text: '❌ Your HP is already full!\n\n❤️ HP: ' + player.stats.hp + '/' + player.stats.maxHp
        }, { quoted: msg });
        return;
      }

      const healAmount = Math.floor(player.stats.maxHp * 0.5);
      const oldHp = player.stats.hp;
      player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healAmount);
      const actualHeal = player.stats.hp - oldHp;
      player.inventory.healthPotions--;

      const inSoloBattle = player.dungeon?.currentBattle || player.boss?.currentBattle;
      const party = Object.values(db.parties || {}).find(p => p.members.includes(sender));
      const inPartyBattle = party && db.partyBattles?.[party.id];

      let battleNote = '';
      if (inSoloBattle) {
        battleNote = '\n\n⚔️ Used in battle!';
      } else if (inPartyBattle) {
        battleNote = '\n\n⚔️ Used in party battle!';
        const participant = db.partyBattles[party.id].participants.find(p => p.id === sender);
        if (participant) participant.currentHp = player.stats.hp;
      }

      saveDatabase();

      const response = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💚 HEALTH POTION USED 💚
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🩹 ${player.name} used Health Potion!

✨ Restored: +${actualHeal} HP

❤️ HP: ${player.stats.hp}/${player.stats.maxHp}
🩹 Potions Left: ${player.inventory.healthPotions}${battleNote}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await sock.sendMessage(chatId, { text: response }, { quoted: msg });
      return;
    }

    // ═══════════════════════════════════════
    // 💙 USE ENERGY POTION
    // ═══════════════════════════════════════
    if (action === 'energy' || action === 'mana' || action === 'stamina' ||
        action === 'focus' || action === 'rage' || action === 'faith' ||
        action === 'blood' || action === 'dragon' || action === 'force') {

      const energyPotions = player.inventory.energyPotions || player.inventory.manaPotions || 0;

      if (energyPotions <= 0) {
        await sock.sendMessage(chatId, {
          text: `❌ You have no ${player.energyType || 'Mana'} Potions!\n\nBuy them at /shop\nPrice: 600 Ne each`
        }, { quoted: msg });
        return;
      }

      if (player.stats.energy >= player.stats.maxEnergy) {
        await sock.sendMessage(chatId, {
          text: `❌ Your ${player.energyType || 'Mana'} is already full!\n\n${player.energyColor || '💙'} ${player.energyType || 'Mana'}: ${player.stats.energy}/${player.stats.maxEnergy}`
        }, { quoted: msg });
        return;
      }

      const restoreAmount = Math.floor(player.stats.maxEnergy * 0.5);
      const oldEnergy = player.stats.energy;
      player.stats.energy = Math.min(player.stats.maxEnergy, player.stats.energy + restoreAmount);
      const actualRestore = player.stats.energy - oldEnergy;

      if (player.inventory.energyPotions) player.inventory.energyPotions--;
      else                                 player.inventory.manaPotions--;

      const inSoloBattle = player.dungeon?.currentBattle || player.boss?.currentBattle;
      const party = Object.values(db.parties || {}).find(p => p.members.includes(sender));
      const inPartyBattle = party && db.partyBattles?.[party.id];

      let battleNote = '';
      if (inSoloBattle)        battleNote = '\n\n⚔️ Used in battle!';
      else if (inPartyBattle)  battleNote = '\n\n⚔️ Used in party battle!';

      saveDatabase();

      const response = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
${player.energyColor || '💙'} ${(player.energyType || 'Mana').toUpperCase()} POTION USED ${player.energyColor || '💙'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💙 ${player.name} used ${player.energyType || 'Mana'} Potion!

✨ Restored: +${actualRestore} ${player.energyType || 'Mana'}

${player.energyColor || '💙'} ${player.energyType || 'Mana'}: ${player.stats.energy}/${player.stats.maxEnergy}
💙 Potions Left: ${player.inventory.energyPotions || player.inventory.manaPotions || 0}${battleNote}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await sock.sendMessage(chatId, { text: response }, { quoted: msg });
      return;
    }

    // ═══════════════════════════════════════
    // 🎫 USE REVIVE TOKEN
    // ═══════════════════════════════════════
    if (action === 'revive' || action === 'revive-token') {
      if ((player.inventory.reviveTokens || 0) <= 0) {
        await sock.sendMessage(chatId, {
          text: '❌ You have no Revive Tokens!\n\nBuy them at /shop\nPrice: 3000 Ne each'
        }, { quoted: msg });
        return;
      }

      const restoreHp = Math.floor(player.stats.maxHp * 0.5);
      player.stats.hp = Math.min(player.stats.maxHp, restoreHp);
      player.inventory.reviveTokens--;
      saveDatabase();

      await sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎫 REVIVE TOKEN USED 🎫
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💫 ${player.name} used a Revive Token!

✨ Restored: ${player.stats.hp}/${player.stats.maxHp} HP
🎫 Tokens Left: ${player.inventory.reviveTokens}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
      return;
    }

    await sock.sendMessage(chatId, {
      text: '❌ Invalid option!\n\nUse: /use heal | /use energy | /use revive | /use GVC --gold'
    }, { quoted: msg });
  }
};
