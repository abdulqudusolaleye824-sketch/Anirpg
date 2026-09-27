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
💠 Price: 100,000 Nexus each

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // Push #88w: Revive Tokens are for the DEAD only — a hunter who fell in an
    // active gate raid (brings them back into the party) or one at 0 HP.
    let fallenGate = null;
    try {
      const GM = require('../../rpg/dungeons/GateManager');
      const GR = require('../../rpg/dungeons/GateRaid');
      for (const g of Object.values(GM.GateManager.gates || {})) {
        if (g && g.raid && g.raid.status === 'active' && GR.isFallen(g, sender)) { fallenGate = g; break; }
      }
      if (fallenGate) {
        if ((fallenGate.revivesUsed || 0) >= 1) {
          return sock.sendMessage(chatId, { text: `❌ *Gate Raid Revive Cap Reached!*\n\nOnly *1 Revive Token* can be used collectively across the entire party in a Gate Raid.` }, { quoted: msg });
        }
        const rv = GR.reviveFallen(fallenGate, sender, db, 50);
        if (rv) {
          fallenGate.revivesUsed = 1;
          player.inventory.reviveTokens--;
          try { GR.saveGateState(db, fallenGate); } catch (e) {}
          saveDatabase();
          return sock.sendMessage(chatId, { text: `💫 *REVIVE USED!* *${player.name}* rises again with ${rv.hp}/${rv.max} HP and rejoins the raid party!\n⚠️ Party Revive Cap Reached (1/1 used).\n🎫 Revive Tokens Left: ${player.inventory.reviveTokens}` }, { quoted: msg });
        }
      }
    } catch (e) {}

    if ((player.stats.hp || 0) > 0) {
      return sock.sendMessage(chatId, { 
        text: '❌ You are not dead!\n\nRevive Tokens only work on fallen hunters (0 HP, or cut down in a gate raid). Use potions to heal.' 
      }, { quoted: msg });
    }

    // Use revive token
    player.inventory.reviveTokens--;
    try { player.stats.hp = require('../../rpg/utils/GearSystem').effectiveMaxHp(player); } catch (e) { player.stats.hp = player.stats.maxHp; }
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