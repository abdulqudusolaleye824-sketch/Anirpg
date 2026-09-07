const DungeonManager = require('../../rpg/dungeons/DungeonManager');
const CombatSystem = require('../../rpg/utils/CombatSystem');

module.exports = {
  name: 'christmas',
  description: '🎄 Christmas Event - Special rewards!',
  
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

    // Initialize Christmas event data
    if (!db.christmasEvent) {
      db.christmasEvent = {
        active: true,
        startDate: '2025-12-25',
        endDate: '2025-12-31'
      };
    }

    if (!player.christmasEvent) {
      player.christmasEvent = {
        dailyClaimed: false,
        lastClaimDate: null,
        totalClaims: 0,
        specialRewardClaimed: false
      };
    }

    const action = args[0]?.toLowerCase();

    if (!action) {
      const bossStatus = player.christmasEvent.specialRewardClaimed ? '✅ DEFEATED' : '⚔️ AVAILABLE';
      
      const menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎄 CHRISTMAS EVENT 2025 🎄
━━━━━━━━━━━━━━━━━━━━━━━━━━━
❄️ Ho Ho Ho! Merry Christmas! ❄️
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 DAILY REWARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/christmas daily - Claim daily gift!

Daily Rewards:
🎁 500 Nexus
💎 50 Mana Stones
🩹 3 Health Potions
⭐ 2x XP for 1 hour
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎅 SPECIAL CHRISTMAS BOSS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/christmas boss - Fight Krampus!
Status: ${bossStatus}

Special Rewards:
🎁 Santa's Blade (+50 ATK)
🎄 Christmas Artifact (+15% stats)
💠 5000 Nexus
💎 500 Mana Stones
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 GIFT EXCHANGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/christmas gift @user - Send a gift!

Gifts contain random rewards:
- Nexus (100-1000)
- Mana Stones (10-100)
- Potions
- XP Boost
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ Event ends: December 31, 2025
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Claims: ${player.christmasEvent.totalClaims}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await sock.sendMessage(chatId, { text: menu }, { quoted: msg });
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // DAILY CLAIM
    // ═══════════════════════════════════════════════════════════════
    if (action === 'daily') {
      const today = new Date().toDateString();
      
      if (player.christmasEvent.lastClaimDate === today) {
        await sock.sendMessage(chatId, {
          text: `🎄 Already claimed today!\n\n⏰ Come back tomorrow for more rewards!\n\n🎁 Total Claims: ${player.christmasEvent.totalClaims}`
        }, { quoted: msg });
        return;
      }

      // Give rewards
      player.gold = (player.gold || 0) + 500;
      player.manaCrystals += 50;
      
      if (!player.inventory) {
        player.inventory = { healthPotions: 0, energyPotions: 0, manaPotions: 0, reviveTokens: 0 };
      }
      player.inventory.healthPotions = (player.inventory.healthPotions || 0) + 3;
      
      // XP Boost (store end time)
      if (!player.buffs) player.buffs = {};
      player.buffs.xpBoost = {
        multiplier: 2,
        endsAt: Date.now() + (60 * 60 * 1000) // 1 hour
      };

      // Update claim data
      player.christmasEvent.lastClaimDate = today;
      player.christmasEvent.totalClaims++;

      saveDatabase();

      await sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎄 CHRISTMAS GIFT CLAIMED! 🎄
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 Daily Reward #${player.christmasEvent.totalClaims}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 +500 Nexus
💎 +50 Mana Stones
🩹 +3 Health Potions
⭐ 2x XP for 1 hour!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Total Nexus: ${player.gold}
💎 Total 💎 Mana Stones: ${player.manaCrystals}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎅 Merry Christmas! 🎅
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // CHRISTMAS BOSS BATTLE
    // ═══════════════════════════════════════════════════════════════
    if (action === 'boss') {
      // Check if already defeated
      if (player.christmasEvent.specialRewardClaimed) {
        await sock.sendMessage(chatId, {
          text: `🎄 You already defeated Krampus!\n\n✨ You have the exclusive Christmas rewards!\n\n🎁 Santa's Blade (+50 ATK)\n🎄 Christmas Artifact (+15% All Stats)\n\n💠 Total Earned: 5500 Nexus, 550 Mana Stones`
        }, { quoted: msg });
        return;
      }

      // Check level requirement
      if (player.level < 10) {
        await sock.sendMessage(chatId, {
          text: `🎄 Level 10 required!\n\n⭐ Your Level: ${player.level}\n⭐ Required: 10\n\n💪 Train more and come back!`
        }, { quoted: msg });
        return;
      }

      // Check if already in a battle
      if (player.dungeon?.currentBattle) {
        await sock.sendMessage(chatId, {
          text: `⚠️ You are already in a battle!\n\nFinish or flee your current battle first.`
        }, { quoted: msg });
        return;
      }

      // Check HP
      if (player.stats.hp <= 0) {
        await sock.sendMessage(chatId, {
          text: `❌ You are too injured to fight!\n\n❤️ HP: 0/${player.stats.maxHp}\n\n💡 Use /use or wait for regeneration`
        }, { quoted: msg });
        return;
      }

      // ✅ Create Christmas boss using proper battle structure
      const boss = {
        name: "Krampus",
        rank: 'Christmas',
        level: player.level + 3,
        hp: Math.floor(player.stats.maxHp * 2.5),
        maxHp: Math.floor(player.stats.maxHp * 2.5),
        atk: Math.floor(player.stats.atk * 1.3),
        def: Math.floor(player.stats.def * 1.1),
        weakness: player.class.name, // Boss weak to player's class!
        statusEffects: []
      };

      // Set battle in correct location
      player.dungeon.currentBattle = {
        monster: boss,
        turn: 0,
        startTime: Date.now(),
        timeLimit: 5 * 60 * 1000, // 5 minutes
        isChristmasBoss: true // Mark as Christmas boss
      };

      if (!player.statusEffects) player.statusEffects = [];
      if (!player.comboCount) player.comboCount = 0;

      saveDatabase();

      await sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎄 CHRISTMAS BOSS BATTLE! 🎄
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👹🎅 *KRAMPUS APPEARS!*
"Santa's Naughty List Enforcer"
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💀 BOSS STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
❤️ HP: ${boss.hp}/${boss.maxHp}
⚔️ ATK: ${boss.atk}
🛡️ DEF: ${boss.def}
⭐ Level: ${boss.level}
⚠️ Weakness: ${boss.weakness}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 YOUR STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
❤️ HP: ${player.stats.hp}/${player.stats.maxHp}
${player.energyColor} ${player.energyType}: ${player.stats.energy}/${player.stats.maxEnergy}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ TIME LIMIT: 5 MINUTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ *COMMANDS:*
/dungeon attack
/dungeon skill [name]
/use heal or /use energy
/dungeon flee (emergency escape)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 *VICTORY REWARDS:*
🎁 Santa's Blade (+50 ATK)
🎄 Christmas Artifact (+15% stats)
💠 5000 Nexus
💎 500 Mana Stones
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${boss.weakness === player.class.name ? '✨ *CLASS ADVANTAGE!* +50% DMG!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' : ''}🎅 Good luck, Hunter! 🎄
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // GIFT EXCHANGE
    // ═══════════════════════════════════════════════════════════════
    if (action === 'gift') {
      // Find recipient
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const recipientId = mentionedJid || quotedParticipant;
      
      if (!recipientId) {
        await sock.sendMessage(chatId, {
          text: '❌ Tag a user or reply to send a gift!\n\nExample: /christmas gift @user'
        }, { quoted: msg });
        return;
      }

      const recipient = db.users[recipientId];

      if (!recipient) {
        await sock.sendMessage(chatId, {
          text: '❌ That user is not registered!'
        }, { quoted: msg });
        return;
      }

      if (recipientId === sender) {
        await sock.sendMessage(chatId, {
          text: '❌ You cannot gift yourself!'
        }, { quoted: msg });
        return;
      }

      // Cost to send gift
      const giftCost = 100;
      if (player.gold < giftCost) {
        await sock.sendMessage(chatId, {
          text: `❌ Not enough gold!\n\n💠 Need: ${giftCost} gold\n💠 Have: ${player.gold} gold`
        }, { quoted: msg });
        return;
      }

      // Random rewards
      const rewards = {
        gold: Math.floor(100 + Math.random() * 900),
        crystals: Math.floor(10 + Math.random() * 90),
        potions: Math.floor(1 + Math.random() * 3),
        xpBonus: Math.random() < 0.3 // 30% chance
      };

      // Deduct cost from sender
      player.gold -= giftCost;

      // Give rewards to recipient
      recipient.gold = (recipient.gold || 0) + rewards.gold;
      recipient.manaCrystals += rewards.crystals;
      
      if (!recipient.inventory) {
        recipient.inventory = { healthPotions: 0, energyPotions: 0, manaPotions: 0, reviveTokens: 0 };
      }
      recipient.inventory.healthPotions = (recipient.inventory.healthPotions || 0) + rewards.potions;

      if (rewards.xpBonus) {
        if (!recipient.buffs) recipient.buffs = {};
        recipient.buffs.xpBoost = {
          multiplier: 1.5,
          endsAt: Date.now() + (30 * 60 * 1000) // 30 minutes
        };
      }

      saveDatabase();

      await sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 GIFT SENT! 🎁
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 To: @${recipientId.split('@')[0]}
💠 Cost: ${giftCost} gold
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎄 They will love it! 🎄
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions: [recipientId]
      }, { quoted: msg });

      let xpMsg = rewards.xpBonus ? '\n⭐ 1.5x XP for 30 minutes!' : '';

      await sock.sendMessage(recipientId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 CHRISTMAS GIFT RECEIVED! 🎁
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 From: @${sender.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 +${rewards.gold} Nexus
💎 +${rewards.crystals} Mana Stones
🩹 +${rewards.potions} Health Potions${xpMsg}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎄 Merry Christmas! 🎄
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions: [sender]
      });
      return;
    }

    await sock.sendMessage(chatId, {
      text: '❌ Invalid command!\n\nUse /christmas for menu.'
    }, { quoted: msg });
  }
};