// ═══════════════════════════════════════════════════════════════
// ROB COMMAND — Attempt to steal Nexus from another player
// Usage: /rob @user
// ═══════════════════════════════════════════════════════════════

const { updatePlayerNexus } = require('../../rpg/utils/NexusManager');

function findVictim(db, targetJid, argsText) {
  if (!db || !db.users) return null;

  if (targetJid) {
    if (db.users[targetJid]) return { jid: targetJid, user: db.users[targetJid] };
    const targetBare = targetJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    for (const [jid, user] of Object.entries(db.users)) {
      const userBare = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
      if (userBare === targetBare) return { jid, user };
    }
  }

  if (argsText) {
    const cleaned = argsText.trim();
    const digits = cleaned.replace(/[^0-9]/g, '');
    if (digits.length >= 7) {
      for (const [jid, user] of Object.entries(db.users)) {
        const userBare = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        if (userBare === digits) return { jid, user };
      }
      const directJid = digits + '@s.whatsapp.net';
      if (db.users[directJid]) return { jid: directJid, user: db.users[directJid] };
    }

    for (const [jid, user] of Object.entries(db.users)) {
      if (user?.name && user.name.toLowerCase() === cleaned.toLowerCase()) {
        return { jid, user };
      }
    }
  }

  return null;
}

module.exports = {
  name: 'rob',
  aliases: [],
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

      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const mentionedJids = contextInfo?.mentionedJid || [];
      const quotedParticipant = contextInfo?.participant;
      const initialTarget = mentionedJids[0] || quotedParticipant;
      const argsText = args.join(' ');

      const found = findVictim(db, initialTarget, argsText);

      if (!found) {
        return await sock.sendMessage(chatId, {
          text: '📌 *Usage:* `/rob @user` (reply, tag, or type a player\'s name/number)\n\n⚠️ *Risk:* You might lose Nexus if caught!\n\n*(To steal a sticker, reply to the sticker with `/steal`)*'
        }, { quoted: msg });
      }

      const targetJid = found.jid;
      const victim = found.user;

      if (targetJid === sender) {
        return await sock.sendMessage(chatId, {
          text: '❌ You cannot rob yourself! 🤦'
        }, { quoted: msg });
      }

      const cooldownTime = 30 * 60 * 1000;
      if (thief.stealCooldown && Date.now() < thief.stealCooldown) {
        const remaining = Math.ceil((thief.stealCooldown - Date.now()) / 60000);
        return await sock.sendMessage(chatId, {
          text: `⏰ Cooldown active! Wait *${remaining}* more minute${remaining > 1 ? 's' : ''} before robbing again.`
        }, { quoted: msg });
      }

      const thiefNexus = thief.gold || 0;
      if (thiefNexus < 100) {
        return await sock.sendMessage(chatId, {
          text: '❌ You need at least 100 Nexus in your wallet to attempt a rob!'
        }, { quoted: msg });
      }

      const targetNexus = victim.gold || 0;
      if (targetNexus < 50) {
        return await sock.sendMessage(chatId, {
          text: `❌ *${victim.name}* doesn't have enough Nexus in their wallet to steal (min 50 💠).`
        }, { quoted: msg });
      }

      thief.stealCooldown = Date.now() + cooldownTime;

      const thiefSpeed = thief.stats?.speed || 10;
      const victimSpeed = victim.stats?.speed || 10;
      const speedDiff = thiefSpeed - victimSpeed;
      let successChance = 50 + (speedDiff * 1.5);
      successChance = Math.max(20, Math.min(80, successChance));

      const roll = Math.random() * 100;
      const success = roll < successChance;

      if (success) {
        const stealPercent = 5 + Math.random() * 15;
        const stolenAmount = Math.max(10, Math.floor(targetNexus * (stealPercent / 100)));
        const actualStolen = Math.min(stolenAmount, targetNexus);

        updatePlayerNexus(victim, -actualStolen, null);
        updatePlayerNexus(thief, actualStolen, null);

        saveDatabase();

        return await sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🥷 *SUCCESSFUL ROBBERY!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
You stealthily robbed *@${targetJid.split('@')[0]}*!

💰 Stolen: *${actualStolen.toLocaleString()}* Nexus 💠
🎯 Success Chance: ${Math.round(successChance)}%
⏰ Next rob: 30 minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [targetJid]
        }, { quoted: msg });
      } else {
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
⏰ Next rob: 30 minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [targetJid]
        }, { quoted: msg });
      }

    } catch (error) {
      console.error('Error in rob command:', error);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ An error occurred while executing the rob command: ${error.message}`
      }, { quoted: msg });
    }
  }
};
