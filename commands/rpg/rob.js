// ═══════════════════════════════════════════════════════════════
// ROB / STEAL COMMAND — Attempt to steal Nexus from another player
// ═══════════════════════════════════════════════════════════════

const { updatePlayerNexus } = require('../../rpg/utils/TaxSystem');

module.exports = {
  name: 'rob',
  aliases: ['steal'],
  description: 'Attempt to steal Nexus from another player (RISKY!)',
  usage: '/rob @user',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    try {
      const chatId = msg.key.remoteJid;
      const db = getDatabase();
      const thief = db.users[sender];

      if (!thief) {
        return await sock.sendMessage(chatId, {
          text: '❌ You don\'t have a character! Use `/register` to start.'
        }, { quoted: msg });
      }

      // Check mentioned user
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const mentionedJids = contextInfo?.mentionedJid || [];
      const quotedParticipant = contextInfo?.participant;
      const targetJid = mentionedJids[0] || quotedParticipant;

      if (!targetJid) {
        return await sock.sendMessage(chatId, {
          text: '📌 *Usage:* `/rob @user` or `/steal @user` (reply or tag a player)\n\n⚠️ *Risk:* You might lose Nexus if caught!'
        }, { quoted: msg });
      }

      // Can't steal from yourself
      if (targetJid === sender) {
        return await sock.sendMessage(chatId, {
          text: '❌ You cannot steal from yourself! 🤦'
        }, { quoted: msg });
      }

      const victim = db.users[targetJid];
      if (!victim) {
        return await sock.sendMessage(chatId, {
          text: '❌ That player is not registered in the system.'
        }, { quoted: msg });
      }

      // Check cooldown (30 mins)
      const cooldownTime = 30 * 60 * 1000;
      if (thief.stealCooldown && Date.now() < thief.stealCooldown) {
        const remaining = Math.ceil((thief.stealCooldown - Date.now()) / 60000);
        return await sock.sendMessage(chatId, {
          text: `⏰ Cooldown active! Wait *${remaining}* more minute${remaining > 1 ? 's' : ''} before stealing again.`
        }, { quoted: msg });
      }

      const thiefNexus = thief.gold || 0;
      if (thiefNexus < 100) {
        return await sock.sendMessage(chatId, {
          text: '❌ You need at least 100 Nexus in your wallet to attempt a steal!'
        }, { quoted: msg });
      }

      const targetNexus = victim.gold || 0;
      if (targetNexus < 50) {
        return await sock.sendMessage(chatId, {
          text: `❌ *${victim.name}* doesn't have enough Nexus in their wallet to steal (min 50 💠).`
        }, { quoted: msg });
      }

      // Calculate success chance (base 50% + speed advantage)
      thief.stealCooldown = Date.now() + cooldownTime;

      const thiefSpeed = thief.stats?.speed || 10;
      const victimSpeed = victim.stats?.speed || 10;
      const speedDiff = thiefSpeed - victimSpeed;
      let successChance = 50 + (speedDiff * 1.5);
      successChance = Math.max(20, Math.min(80, successChance)); // Clamp 20-80%

      const roll = Math.random() * 100;
      const success = roll < successChance;

      if (success) {
        const stealPercent = 5 + Math.random() * 15; // 5-20%
        const stolenAmount = Math.max(10, Math.floor(targetNexus * (stealPercent / 100)));
        const actualStolen = Math.min(stolenAmount, targetNexus);

        updatePlayerNexus(victim, -actualStolen, null);
        updatePlayerNexus(thief, actualStolen, null);

        saveDatabase();

        return await sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🥷 *SUCCESSFUL THEFT!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
You stealthily robbed *@${targetJid.split('@')[0]}*!

💰 Stolen: *${actualStolen.toLocaleString()}* Nexus 💠
🎯 Success Chance: ${Math.round(successChance)}%
⏰ Next steal: 30 minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [targetJid]
        }, { quoted: msg });
      } else {
        // Failed - caught penalty (lose 15% of own wallet to victim)
        const penalty = Math.max(20, Math.floor(thiefNexus * 0.15));
        const actualPenalty = Math.min(penalty, thiefNexus);

        updatePlayerNexus(thief, -actualPenalty, null);
        updatePlayerNexus(victim, actualPenalty, null);

        saveDatabase();

        return await sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 *CAUGHT RED-HANDED!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
You were caught trying to rob *@${targetJid.split('@')[0]}*!

💸 Fine Paid to Victim: *${actualPenalty.toLocaleString()}* Nexus 💠
🎯 Success Chance: ${Math.round(successChance)}%
⏰ Next steal: 30 minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [targetJid]
        }, { quoted: msg });
      }

    } catch (error) {
      console.error('Error in rob command:', error);
      await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ An error occurred while executing the steal command.'
      }, { quoted: msg });
    }
  }
};
