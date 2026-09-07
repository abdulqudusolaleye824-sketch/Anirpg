const RamadanEvent = require('../../rpg/utils/RamadanEvent');

module.exports = {
  name: 'ramadan',
  aliases: ['iftar', 'charity'],
  description: '🌙 Ramadan event commands - claim Iftar rewards, donate charity, and more!',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { 
        text: '❌ You are not registered! Use /register to start.' 
      }, { quoted: msg });
    }

    // Check if Ramadan event is active
    if (!RamadanEvent.isRamadanActive()) {
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌙 RAMADAN EVENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Ramadan event is not currently active.

Event dates:
Start: ${RamadanEvent.RAMADAN_CONFIG.startDate.toDateString()}
End: ${RamadanEvent.RAMADAN_CONFIG.endDate.toDateString()}

Come back during Ramadan for special rewards! 🌙
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    const action = args[0]?.toLowerCase();

    // ═══════════════════════════════════════════════════════════════
    // RAMADAN INFO / HELP
    // ═══════════════════════════════════════════════════════════════
    if (!action || action === 'info' || action === 'help') {
      const ramadanData = RamadanEvent.getPlayerRamadanData(player);
      const iftarHour = RamadanEvent.RAMADAN_CONFIG.iftarHour;
      const iftarMinute = RamadanEvent.RAMADAN_CONFIG.iftarMinute;
      
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌙 RAMADAN KAREEM! 🌙
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ramadan Mubarak to all!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 YOUR RAMADAN PROGRESS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🍽️ Iftars Claimed: ${ramadanData.iftarsClaimed}
💠 Charity Donated: ${ramadanData.charityDonated} 💠
⚔️ Monsters Defeated: ${ramadanData.monstersDefeated}
🏰 Dungeons Cleared: ${ramadanData.dungeonsCleared}
🏆 Titles Earned: ${ramadanData.titlesEarned.length}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ EVENT BONUSES (ACTIVE):
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⭐ +50% XP from all sources
💠 +50% Nexus from all sources

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 COMMANDS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/ramadan iftar - Claim Iftar reward (${iftarHour}:${iftarMinute.toString().padStart(2, '0')})
/ramadan charity <amount> - Donate gold
/ramadan quests - View Ramadan quests
/ramadan artifacts - View special artifacts
/ramadan leaderboard - Top contributors

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌙 May this Ramadan bring peace and blessings!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // CLAIM IFTAR REWARD
    // ═══════════════════════════════════════════════════════════════
    if (action === 'iftar' || action === 'claim') {
      const result = RamadanEvent.claimIftar(player);
      
      if (!result.success) {
        return sock.sendMessage(chatId, { 
          text: result.message 
        }, { quoted: msg });
      }
      
      saveDatabase();
      
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🍽️ IFTAR CLAIMED! 🍽️
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Alhamdulillah! Break your fast!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎁 REWARDS RECEIVED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⭐ +${result.rewards.exp} XP (Ramadan Bonus!)
💠 +${result.rewards.gold} Nexus (Ramadan Bonus!)
💎 +${result.rewards.crystals} Mana Stones

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌙 Iftars Claimed: ${result.totalClaimed}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
May your fast be accepted! 🤲
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // DONATE TO CHARITY
    // ═══════════════════════════════════════════════════════════════
    if (action === 'charity' || action === 'donate') {
      const amount = parseInt(args[1]);
      
      if (!amount || amount <= 0) {
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 CHARITY DONATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━

"Charity does not decrease wealth."

Usage: /ramadan charity <amount>
Example: /ramadan charity 1000

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 BLESSINGS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
For every gold donated, you receive:
• 20% returned as blessing
• Progress toward "The Generous" title
• Barakah (divine blessings)

Your Nexus: ${player.gold || 0} 💠
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }
      
      const result = RamadanEvent.donateCharity(player, amount);
      
      if (!result.success) {
        return sock.sendMessage(chatId, { 
          text: result.message 
        }, { quoted: msg });
      }
      
      saveDatabase();
      
      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💝 CHARITY ACCEPTED! 💝
━━━━━━━━━━━━━━━━━━━━━━━━━━━
May Allah accept your donation!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

💠 Donated: ${result.donated} 💠
✨ Blessing Received: +${result.blessing} 💠
📊 Total Donated: ${result.totalDonated} 💠

━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      if (result.titleAwarded) {
        message += `\n🏆 TITLE UNLOCKED!\n`;
        message += `"${result.titleAwarded}"\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      }
      
      message += `\n"The believer's shade on the Day of\nResurrection will be their charity."`;
      
      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW RAMADAN QUESTS
    // ═══════════════════════════════════════════════════════════════
    if (action === 'quests' || action === 'quest') {
      const available = RamadanEvent.getAvailableRamadanQuests(player);
      
      if (available.length === 0) {
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 RAMADAN QUESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

No quests available right now!

You may have completed all available quests.
Check back later or level up to unlock more!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }
      
      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 RAMADAN QUESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Special quests for the blessed month
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      available.forEach((quest, index) => {
        message += `${index + 1}. ${quest.name}\n`;
        message += `   🌙 ${quest.description}\n`;
        message += `   📊 Type: ${quest.type.toUpperCase()}\n`;
        
        // Show objectives
        quest.objectives.forEach(obj => {
          message += `   • ${obj.desc}\n`;
        });
        
        // Show rewards
        message += `   🎁 Rewards: `;
        const rewardList = [];
        if (quest.rewards.exp) rewardList.push(`${quest.rewards.exp} XP`);
        if (quest.rewards.gold) rewardList.push(`${quest.rewards.gold} 💠`);
        if (quest.rewards.title) rewardList.push(`Title: "${quest.rewards.title}"`);
        if (quest.rewards.artifact) rewardList.push(`Artifact`);
        message += rewardList.join(', ') + '\n\n';
      });
      
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `💡 Use /quest start <questId> to begin!\n`;
      message += `Example: /quest start ramadan_charity_1`;
      
      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW RAMADAN ARTIFACTS
    // ═══════════════════════════════════════════════════════════════
    if (action === 'artifacts' || action === 'items') {
      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏮 RAMADAN ARTIFACTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Exclusive items for Ramadan
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      for (const artifact of Object.values(RamadanEvent.RAMADAN_ARTIFACTS)) {
        message += `${artifact.emoji} ${artifact.name}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `🟣 EPIC ${artifact.type.toUpperCase()}\n`;
        message += `📜 ${artifact.description}\n\n`;
        
        message += `📊 STATS:\n`;
        for (const [stat, value] of Object.entries(artifact.stats)) {
          message += `   +${value} ${stat.toUpperCase()}\n`;
        }
        
        message += `\n✨ ABILITIES:\n`;
        artifact.abilities.forEach(ability => {
          message += `   • ${ability.name}\n`;
          message += `     ${ability.description}\n`;
        });
        
        message += `\n💡 Obtain from: Ramadan Quests\n\n`;
      }
      
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // LEADERBOARD
    // ═══════════════════════════════════════════════════════════════
    if (action === 'leaderboard' || action === 'top') {
      // Get all players with Ramadan data
      const players = Object.entries(db.users)
        .map(([id, p]) => ({
          id,
          name: p.name,
          data: RamadanEvent.getPlayerRamadanData(p)
        }))
        .filter(p => p.data.charityDonated > 0)
        .sort((a, b) => b.data.charityDonated - a.data.charityDonated)
        .slice(0, 10);
      
      if (players.length === 0) {
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 CHARITY LEADERBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━

No donations yet!

Be the first to donate and lead
the community in generosity! 💰
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }
      
      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 CHARITY LEADERBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Top Contributors This Ramadan
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      players.forEach((p, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${medal} ${p.name}\n`;
        message += `   💠 ${p.data.charityDonated} 💠 donated\n`;
        message += `   🍽️ ${p.data.iftarsClaimed} iftars claimed\n\n`;
      });
      
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `May Allah reward the generous! 🤲`;
      
      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // DEFAULT - SHOW HELP
    // ═══════════════════════════════════════════════════════════════
    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌙 RAMADAN COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

/ramadan - Event info & progress
/ramadan iftar - Claim Iftar reward
/ramadan charity <amount> - Donate
/ramadan quests - View quests
/ramadan artifacts - View items
/ramadan leaderboard - Top donors

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ramadan Kareem! 🌙
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg });
  }
};