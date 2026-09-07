module.exports = {
  name: 'revive',
  description: 'Use a revive token to restore HP',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { 
        text: '❌ You are not registered!\nUse /register to start your adventure.' 
      }, { quoted: msg });
    }

    if (!player.inventory) {
      player.inventory = { healthPotions: 0, manaPotions: 0, reviveTokens: 0 };
    }

    if (player.inventory.reviveTokens <= 0) {
      return sock.sendMessage(chatId, { 
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ NO REVIVE TOKENS! ❌
━━━━━━━━━━━━━━━━━━━━━━━━━━━

You don't have any revive tokens!

🛒 Buy them at /shop
💠 Price: 200 gold each

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    if (player.stats.hp >= player.stats.maxHp) {
      return sock.sendMessage(chatId, { 
        text: '❌ Your HP is already full!\n\nRevive tokens are only for emergency recovery.' 
      }, { quoted: msg });
    }

    // Use revive token
    player.inventory.reviveTokens--;
    player.stats.hp = player.stats.maxHp;
    player.stats.energy = player.stats.maxEnergy;
    
    // Clear all negative status effects
    if (player.statusEffects) {
      player.statusEffects = [];
    }

    saveDatabase();

    return sock.sendMessage(chatId, { 
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ REVIVE TOKEN USED! ✨
━━━━━━━━━━━━━━━━━━━━━━━━━━━

💚 Full HP restored!
${player.energyColor} Full ${player.energyType} restored!
✨ All status effects cleared!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

❤️ HP: ${player.stats.hp}/${player.stats.maxHp}
${player.energyColor} ${player.energyType}: ${player.stats.energy}/${player.stats.maxEnergy}

🎫 Revive Tokens Left: ${player.inventory.reviveTokens}

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg });
  }
};