module.exports = {
  name: 'creator',
  description: 'Challenge the Creator (Level 100 only)',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    
    
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { 
        text: '❌ You are not registered!' 
      });
    }

    if (player.level < 100) {
      return sock.sendMessage(chatId, { 
        text: `❌ *ACCESS DENIED*\n\nOnly level 100 hunters may challenge the Creator.\n\nYour level: ${player.level}/100` 
      });
    }

    const config = JSON.parse(require('fs').readFileSync('./config.json', 'utf-8'));
    const creatorId = '221951679328499@lid';

    const action = args[0]?.toLowerCase();

    // Accept the challenge
    if (!action || action === 'challenge') {
      if (player.creatorBattle) {
        return sock.sendMessage(chatId, { 
          text: '⚠️ You are already in battle with the Creator!' 
        });
      }

      const message = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ *SYSTEM NOTIFICATION* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Congratulations, ${player.name}.*

You have reached *Level 100*.
You have conquered every gate.
You have slain every boss.

But your journey... is not over.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 *THE FINAL REVELATION* 🌟
━━━━━━━━━━━━━━━━━━━━━━━━━━━

The System. The Gates. The Monsters.
All of it... was created by someone.

Someone who watches.
Someone who tests.
Someone who judges.

*The Creator.*

━━━━━━━━━━━━━━━━━━━━━━━━━━━
👁️ *THE TRUTH* 👁️
━━━━━━━━━━━━━━━━━━━━━━━━━━━

The one who designed this world.
The one who gave you power.
The one who has been watching
your every move...

...is @${creatorId.split('@')[0]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ *THE FINAL CHALLENGE* ⚔️
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Will you challenge the Creator?
Will you face the one who made you?

This is the end of your journey...
or the beginning of something greater.

*Choose wisely, Hunter.*

Reply: /creator accept

━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();

      return sock.sendMessage(chatId, { 
        text: message,
        mentions: [creatorId]
      });
    }

    if (action === 'accept') {
      player.creatorBattle = {
        hp: 100000,
        maxHp: 100000,
        atk: 5000000,
        def: 2000000,
        phase: 1,
        startTime: Date.now()
      };

      saveDatabase();

      const introMessage = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⭐ *THE CREATOR APPEARS* ⭐
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reality tears apart.
Spacetime bends.
The fabric of existence trembles.

From the void, a figure emerges.

@${creatorId.split('@')[0]}

*"So... you've made it this far."*

*"Impressive. You've surpassed
every trial I set before you."*

*"But can you surpass... me?"*

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💀 *THE CREATOR'S STATUS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

❤️ HP: 100,000/100,000
⚔️ ATK: 500
🛡️ DEF: 200
✨ Phase: 1/3

⚠️ *CAUTION: UNKNOWN ABILITIES*

━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *YOUR STATUS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

❤️ HP: ${player.stats.hp}/${player.stats.maxHp}
💙 Mana: ${player.stats.mana}/${player.stats.maxMana}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ *BATTLE COMMANDS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

- /creator attack
- /creator skill [name]
- /creator heal (use potion)

━━━━━━━━━━━━━━━━━━━━━━━━━━━

*"Come, Hunter. Show me your power."*

━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();

      return sock.sendMessage(chatId, { 
        text: introMessage,
        mentions: [creatorId]
      });
    }

    // Attack Creator
    if (action === 'attack') {
      if (!player.creatorBattle) {
        return sock.sendMessage(chatId, { 
          text: "❌ You haven't challenged the Creator yet!" 
        });
      }

      const battle = player.creatorBattle;
      
      // Player attacks
      const playerDamage = Math.max(1, player.stats.atk + player.weapon.bonus - Math.floor(battle.def / 3));
      battle.hp -= playerDamage;

      let message = `⚔️ *YOU ATTACK!*\n\n-${playerDamage} damage!\n\n`;

      // Check phase transitions
      const hpPercent = (battle.hp / battle.maxHp) * 100;
      if (hpPercent <= 66 && battle.phase === 1) {
        battle.phase = 2;
        battle.atk = Math.floor(battle.atk * 1.5);
        message += `⚡ *THE CREATOR ENTERS PHASE 2!*\n"You're stronger than I thought..."\n\n`;
      } else if (hpPercent <= 33 && battle.phase === 2) {
        battle.phase = 3;
        battle.atk = Math.floor(battle.atk * 2);
        message += `💥 *THE CREATOR ENTERS FINAL PHASE!*\n"Time to get serious."\n\n`;
      }

      // Check victory
      if (battle.hp <= 0) {
        player.creatorDefeated = true;
        player.creatorBattle = null;
        saveDatabase();

        return sock.sendMessage(chatId, { 
          text: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 *IMPOSSIBLE VICTORY!* 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Creator falls to one knee.

*"Incredible... you've actually...
defeated me."*

*"I created this system to find
someone worthy. Someone strong
enough to surpass even me."*

*"And you... you did it."*

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 *ULTIMATE REWARDS* 🏆
━━━━━━━━━━━━━━━━━━━━━━━━━━━

💫 Title: *GOD SLAYER*
⭐ All Stats +100
🎁 Special Item: Creator's Crown
💠 1,000,000 Nexus
💎 10,000 Mana Stones

━━━━━━━━━━━━━━━━━━━━━━━━━━━

*"The System is yours now."*

*"Use it wisely, Champion."*

━━━━━━━━━━━━━━━━━━━━━━━━━━━

*You have completed your journey.*
*You are the strongest hunter.*

*CONGRATULATIONS!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim(),
          mentions: [creatorId]
        });
      }

      // Creator attacks back
      const creatorDamage = Math.max(1, battle.atk - Math.floor(player.stats.def / 2));
      player.stats.hp -= creatorDamage;

      message += `💥 *THE CREATOR STRIKES!*\n-${creatorDamage} damage!\n\n`;

      if (player.stats.hp <= 0) {
        player.stats.hp = 1;
        player.creatorBattle = null;
        saveDatabase();

        return sock.sendMessage(chatId, { 
          text: `
💀 *DEFEAT*

The Creator's power overwhelms you.

*"Not yet, Hunter. You're close...
but not quite there."*

*"Train more. Grow stronger.
Then... challenge me again."*

❤️ HP restored to 1
Try again when you're ready.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim(),
          mentions: [creatorId]
        });
      }

      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `👤 *YOUR HP:* ${player.stats.hp}/${player.stats.maxHp}\n`;
      message += `💀 *CREATOR HP:* ${battle.hp}/${battle.maxHp}\n`;
      message += `✨ *Phase:* ${battle.phase}/3`;

      saveDatabase();
      return sock.sendMessage(chatId, { text: message, mentions: [creatorId] }, { quoted: msg });
    }

    await sock.sendMessage(chatId, { 
      text: '❌ Invalid command!\nUse: challenge, accept, attack' 
    });
  }
};