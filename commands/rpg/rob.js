const TaxSystem = require('../../rpg/utils/TaxSystem');
const { updatePlayerNexus } = require('../../rpg/utils/NexusManager');
const DC = require('../../rpg/utils/DailyChallenges');

module.exports = {
  name: 'rob',
  description: 'Attempt to steal gold from another player (RISKY!)',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const thief = db.users[sender];

    if (!thief) {
      return sock.sendMessage(chatId, { 
        text: '❌ You are not registered!' 
      }, { quoted: msg });
    }

    // Get target from mention or quoted message
    let targetId = null;
    
    // Check for quoted message
    if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
      targetId = msg.message.extendedTextMessage.contextInfo.participant;
    }
    // Check for mentions
    else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
      targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }

    if (!targetId) {
      return sock.sendMessage(chatId, { 
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🦹 STEAL COMMAND 🦹
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Your Nexus: ${thief.gold || 0}
⏰ Cooldown: ${thief.stealCooldown ? Math.max(0, Math.ceil((thief.stealCooldown - Date.now()) / 60000)) : 0} mins
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 HOW IT WORKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Success Rate: 40%
💠 Steal: 5-15% of their gold
❌ Fail: Lose 5-10% of YOUR gold (max 5,000)
🏦 Bank gold is SAFE
⏰ 5 minute cooldown
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 USAGE
Reply to someone's message and type:
/rob

Or mention them:
/rob @user
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    const target = db.users[targetId];

    if (!target) {
      return sock.sendMessage(chatId, { 
        text: '❌ Target player is not registered!' 
      }, { quoted: msg });
    }

    // Owner immunity — reverse rob on attacker
    const OWNER_ID = '221951679328499@lid';
    if (targetId === OWNER_ID) {
      const reverseSteal = Math.floor((thief.gold || 0) * 0.3);
      const actualReverse = Math.min(reverseSteal, thief.gold || 0);
      updatePlayerNexus(thief, -actualReverse, saveDatabase);
      const ownerPlayer = db.users[OWNER_ID];
      if (ownerPlayer) updatePlayerNexus(ownerPlayer, actualReverse, saveDatabase);
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `⚠️ *BIG MISTAKE!* ⚠️\n\nYou tried to rob the Owner...\n\n👑 The Owner's guards caught you instantly!\n\n💸 They took *${actualReverse} gold* from YOU as punishment!\n💠 Your Nexus: ${thief.gold || 0}\n\n😂 Maybe rob someone... safer next time.`
      }, { quoted: msg });
    }

    // Can't steal from yourself
    if (targetId === sender) {
      return sock.sendMessage(chatId, { 
        text: '❌ You cannot steal from yourself! 🤦' 
      }, { quoted: msg });
    }

    // Cooldown check (5 minutes)
    const cooldownTime = 5 * 60 * 1000; // 5 minutes
    if (thief.stealCooldown && Date.now() < thief.stealCooldown) {
      const remaining = Math.ceil((thief.stealCooldown - Date.now()) / 60000);
      return sock.sendMessage(chatId, { 
        text: `⏰ Cooldown active!\n\nWait ${remaining} more minute${remaining > 1 ? 's' : ''} before stealing again.`
      }, { quoted: msg });
    }

    // Check if thief has gold
    if ((thief.gold || 0) < 100) {
      return sock.sendMessage(chatId, { 
        text: '❌ You need at least 100 gold to attempt a steal!\n\n(Risk: You might lose 20% if you fail)'
      }, { quoted: msg });
    }

    // Check if target has gold (wallet only — banked gold is safe)
    const targetNexus = target.gold || 0;

    // Get banked amount for flavour message
    let targetBanked = 0;
    try {
      const BankingSystem = require('../../rpg/banking/BankingSystem');
      const bank = BankingSystem.getAccountBank(db, targetId);
      if (bank) {
        const acc = bank.accounts.find(a => a.userId === targetId);
        targetBanked = acc?.balance || 0;
      }
    } catch(e) {}

    if (targetNexus < 50) {
      const bankHint = targetBanked > 0 ? `\n💡 They have *${targetBanked.toLocaleString()}g* in the bank — that's untouchable.` : '';
      return sock.sendMessage(chatId, { 
        text: `❌ ${target.name} only has ${targetNexus} 💠 in their wallet!\n\nNot worth the risk... 🤷${bankHint}`
      }, { quoted: msg });
    }

    // Set cooldown immediately
    thief.stealCooldown = Date.now() + cooldownTime;
    DC.trackProgress(thief, 'rob_attempt', 1);

    // Calculate success chance (base 40%, but modified by level difference)
    const levelDiff = thief.level - target.level;
    let successChance = 40;
    
    if (levelDiff > 0) {
      successChance += Math.min(levelDiff * 2, 20); // Max +20% bonus
    } else {
      successChance += Math.max(levelDiff * 3, -25); // Max -25% penalty
    }

    const roll = Math.random() * 100;
    const success = roll < successChance;

    // ============================================
    // SUCCESS - Steal gold
    // ============================================
    if (success) {
      const stealPercent = 5 + Math.random() * 10; // 5-15%
      const stolenNexus = Math.floor(targetNexus * (stealPercent / 100));
      const actualStolen = Math.min(stolenNexus, targetNexus); // Can't steal more than they have

      // Transfer gold
      updatePlayerNexus(target, -actualStolen, saveDatabase);
      updatePlayerNexus(thief, actualStolen, saveDatabase);

      // Add to thief's crime record
      if (!thief.crimes) thief.crimes = { successful: 0, failed: 0, totalStolen: 0 };
      thief.crimes.successful++;
      thief.crimes.totalStolen += actualStolen;

      saveDatabase();

      // Success messages
      const successMessages = [
        `🦹 *HEIST SUCCESSFUL!* 🦹

You snuck into ${target.name}'s vault and made off with the loot!

💠 Stolen: ${actualStolen} gold
🎲 Success Rate: ${successChance.toFixed(1)}%
🎯 Your Roll: ${roll.toFixed(1)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💼 Your Nexus: ${thief.gold || 0} (+${actualStolen})
😢 ${target.name}'s Nexus: ${target.gold || 0} (-${actualStolen})
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ Next steal: 30 minutes
💡 Tip: They should deposit in /bank!`,

        `🎭 *MASTER THIEF!* 🎭

You picked ${target.name}'s pocket with incredible finesse!

💠 Stolen: ${actualStolen} gold
🎲 Success Rate: ${successChance.toFixed(1)}%
🎯 Your Roll: ${roll.toFixed(1)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💼 Your Nexus: ${thief.gold || 0} (+${actualStolen})
😭 ${target.name}'s Nexus: ${target.gold || 0} (-${actualStolen})
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 Crime Record: ${thief.crimes.successful} successful heists!`,

        `🔓 *VAULT CRACKED!* 🔓

${target.name} didn't see it coming!

💠 Stolen: ${actualStolen} gold
🎲 Success Rate: ${successChance.toFixed(1)}%
🎯 Your Roll: ${roll.toFixed(1)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💼 Your Nexus: ${thief.gold || 0} (+${actualStolen})
💔 ${target.name}'s Nexus: ${target.gold || 0} (-${actualStolen})
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 You've stolen ${thief.crimes.totalStolen} total gold!`
      ];

      const randomMessage = successMessages[Math.floor(Math.random() * successMessages.length)];
      return sock.sendMessage(chatId, { text: randomMessage }, { quoted: msg });
    }

    // ============================================
    // FAILURE - Lose gold as penalty (CAPPED!)
    // ============================================
    else {
      const lossPercent = 5 + Math.random() * 5; // 5-10% loss
      const calculatedLoss = Math.floor((thief.gold || 0) * (lossPercent / 100));
      const lostNexus = Math.min(calculatedLoss, 5000); // CAP at 5,000 gold max loss!

      updatePlayerNexus(thief, -lostNexus, saveDatabase);

      // Add to thief's crime record
      if (!thief.crimes) thief.crimes = { successful: 0, failed: 0, totalStolen: 0 };
      thief.crimes.failed++;

      saveDatabase();

      // Failure messages
      const failMessages = [
        `🚨 *BUSTED!* 🚨

${target.name} caught you red-handed!

❌ Lost: ${lostNexus} gold (${lossPercent.toFixed(1)}% penalty, max 5k)
🎲 Success Rate: ${successChance.toFixed(1)}%
🎯 Your Roll: ${roll.toFixed(1)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💸 Your Nexus: ${thief.gold || 0} (-${lostNexus})
😂 ${target.name} is laughing at you!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Better luck next time!
⏰ Try again in 5 minutes`,

        `👮 *CAUGHT!* 👮

The guards spotted you sneaking around!

❌ Lost: ${lostNexus} gold (${lossPercent.toFixed(1)}% penalty, max 5k)
🎲 Success Rate: ${successChance.toFixed(1)}%
🎯 Your Roll: ${roll.toFixed(1)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💸 Your Nexus: ${thief.gold || 0} (-${lostNexus})
🛡️ ${target.name}'s gold is safe!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Failures: ${thief.crimes.failed}
⏰ Cooldown: 5 minutes`,

        `⚠️ *FAILED HEIST!* ⚠️

You tripped over your own feet!

❌ Lost: ${lostNexus} gold (${lossPercent.toFixed(1)}% penalty, max 5k)
🎲 Success Rate: ${successChance.toFixed(1)}%
🎯 Your Roll: ${roll.toFixed(1)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💸 Your Nexus: ${thief.gold || 0} (-${lostNexus})
😆 ${target.name} is pointing and laughing!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎭 Maybe crime isn't for you...
⏰ Try again in 5 minutes`
      ];

      const randomMessage = failMessages[Math.floor(Math.random() * failMessages.length)];
      return sock.sendMessage(chatId, { text: randomMessage }, { quoted: msg });
    }
  }
};