const Perms = require('../../utils/permissions');
const BarSystem = require('../../rpg/utils/BarSystem');
const LevelUpManager = require('../../rpg/utils/LevelUpManager');
const { GEAR_CATALOG, getRandomGear } = require('../../rpg/utils/GearCatalog');
const { PET_FOOD } = require('../../rpg/utils/PetDatabase');
const StatusEffectManager = require('../../rpg/utils/StatusEffectManager');
const StatAllocationSystem = require('../../rpg/utils/StatAllocationSystem');
const AchievementManager = require('../../rpg/utils/AchievementManager');
const CM = require('../../rpg/utils/GuildContractManager');

module.exports = {
  name: 'guild',
  description: '🏰 Create and manage guilds',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You are not registered!' });
    }

    // Initialize
    if (!db.guilds) db.guilds = {};
    if (!db.guildInvites) db.guildInvites = {};
    if (!db.pendingGuildHires) db.pendingGuildHires = {};

    // Normalize legacy guild members
    for (const g of Object.values(db.guilds)) {
      if (!Array.isArray(g.members)) continue;
      g.members = g.members.map(m => {
        if (m && typeof m === 'object') return m;
        const isLeader = (m === g.leader);
        return {
          id: m,
          name: db.users?.[m]?.name || undefined,
          rank: isLeader ? 'Leader' : 'Member',
          joinedAt: g.createdAt || Date.now(),
        };
      });
      g.members = g.members.filter((m, i, a) => a.findIndex(x => x.id === m.id) === i);
    }

    const action = args[0]?.toLowerCase();

    // Find player's guild
    const playerGuild = Object.values(db.guilds).find(g => 
      g.members && g.members.some(m => m.id === sender || m === sender)
    );

    // ═══════════════════════════════════════════════════════════════════
    // ACCEPT / DECLINE HIRE CONTRACT OFFER
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'accept' || (action === 'hire' && args[1]?.toLowerCase() === 'accept')) {
      const offer = db.pendingGuildHires[sender];
      if (!offer || Date.now() > offer.expiresAt) {
        delete db.pendingGuildHires[sender];
        return sock.sendMessage(chatId, { text: '❌ You have no active guild hire offers (or the offer expired).' }, { quoted: msg });
      }

      const guild = db.guilds[offer.guildId];
      if (!guild) {
        delete db.pendingGuildHires[sender];
        return sock.sendMessage(chatId, { text: '❌ That guild no longer exists.' }, { quoted: msg });
      }

      if (playerGuild) {
        delete db.pendingGuildHires[sender];
        return sock.sendMessage(chatId, { text: '❌ You are already in a guild! Leave your current guild first.' }, { quoted: msg });
      }

      if (guild.members.length >= 20) {
        delete db.pendingGuildHires[sender];
        return sock.sendMessage(chatId, { text: '❌ That guild is full (20/20 members).' }, { quoted: msg });
      }

      // Add to guild members
      guild.members.push({
        id: sender,
        name: player.name || 'Unknown',
        rank: 'Member',
        joinedAt: Date.now()
      });
      player.guild = guild.name;
      player.guildJoinedAt = Date.now();

      // Finalize formal contract
      CM.hire(db, offer.guildId, offer.gmId, sender, offer.weeklyNexus, offer.weeklyMana, offer.weeks);
      delete db.pendingGuildHires[sender];

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎉 *CONTRACT ACCEPTED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 *@${sender.split('@')[0]}* accepted the contract and joined *${guild.name}*!\n\n💠 Weekly Wage: ${offer.weeklyNexus.toLocaleString()} Nexus\n💎 Weekly Mana: ${offer.weeklyMana.toLocaleString()} Mana Stones\n⏳ Duration: ${offer.weeks} week(s)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions: [sender]
      }, { quoted: msg });
    }

    if (action === 'decline' || (action === 'hire' && args[1]?.toLowerCase() === 'decline')) {
      if (db.pendingGuildHires[sender]) {
        delete db.pendingGuildHires[sender];
        saveDatabase();
        return sock.sendMessage(chatId, { text: '❌ Guild hire contract offer declined.' }, { quoted: msg });
      }
      return sock.sendMessage(chatId, { text: 'ℹ️ You have no pending hire contract offer.' }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // DEFAULT GUILD VIEW
    // ═══════════════════════════════════════════════════════════════════
    if (!action || action === 'info') {
      if (!playerGuild) {
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 GUILD SYSTEM 🏰
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ You are not in a guild yet!

📌 GET STARTED:
• /guild create [name] - Create a guild (500,000💠 + 10,000💎 | Lv.20)
• /guild join [name] - Join an existing guild

🏆 GUILD BENEFITS:
- Guild raids & exclusive shop
- Member XP & Nexus bonuses
- Shared treasury & Guild Wars!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      const leader = db.users[playerGuild.leader];

      const info = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 GUILD INFO 🏰
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 Name: ${playerGuild.name}
👑 Leader: ${leader?.name || 'Unknown'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 Members: ${playerGuild.members.length}/20
🏆 Level: ${playerGuild.level || 1}
✨ XP: ${playerGuild.xp || 0}
💠 Treasury: ${(playerGuild.treasury || 0).toLocaleString()} Nexus
💎 Treasury: ${(playerGuild.manaTreasury || 0).toLocaleString()} Mana Stones
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 STATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 Raids Completed: ${playerGuild.totalRaids || 0}
⚔️ Wars Fought: ${playerGuild.totalWars || 0}
🏆 Wars Won: ${playerGuild.wins || 0}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use /guild members to see all members!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: info }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // CREATE GUILD
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'create') {
      const guildName = args.slice(1).join(' ');
      
      if (!guildName || guildName.length < 3) {
        return sock.sendMessage(chatId, {
          text: '❌ Guild name must be 3+ characters!\n\nExample: /guild create Dragon Slayers'
        });
      }

      if (guildName.length > 30) {
        return sock.sendMessage(chatId, {
          text: '❌ Guild name too long! (Max 30 characters)'
        });
      }

      if (!db.authorizedGuildMasters) db.authorizedGuildMasters = [];
      const isOwner = Perms.isBotOwner(db, sender);
      const isAuthorized = isOwner || db.authorizedGuildMasters.includes(sender);

      const LEVEL_REQ = 20;
      const NEXUS_REQ = 500_000;
      const MANA_REQ  = 10_000;
      const START_NEXUS = 50_000;
      const START_MANA  = 1_000;

      const playerLevel = player.level || 1;
      const playerNexus = player.gold || 0;
      const playerMana  = player.manaCrystals || 0;

      if (!isAuthorized) {
        const missing = [];
        if (playerLevel < LEVEL_REQ) missing.push(`📈 Level ${LEVEL_REQ}`);
        if (playerNexus < NEXUS_REQ) missing.push(`💠 ${NEXUS_REQ.toLocaleString()} Nexus`);
        if (playerMana < MANA_REQ) missing.push(`💎 ${MANA_REQ.toLocaleString()} Mana Stones`);
        if (missing.length) {
          return sock.sendMessage(chatId, {
            text: [
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              `🏰 *GUILD CREATION*`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              `Requirements:`,
              `🎯 *Level ${LEVEL_REQ}*`,
              `💠 *${NEXUS_REQ.toLocaleString()} Nexus*`,
              `💎 *${MANA_REQ.toLocaleString()} Mana Stones*`,
              ``,
              `📊 You currently have:`,
              `   📈 Level ${playerLevel}${playerLevel >= LEVEL_REQ ? ' ✅' : ''}`,
              `   💠 ${playerNexus.toLocaleString()} Nexus${playerNexus >= NEXUS_REQ ? ' ✅' : ''}`,
              `   💎 ${playerMana.toLocaleString()} Mana Stones${playerMana >= MANA_REQ ? ' ✅' : ''}`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ].join('\n')
          });
        }
      }

      if (playerGuild) {
        return sock.sendMessage(chatId, {
          text: '❌ You are already in a guild!\n\nUse /guild leave first.'
        });
      }

      const existingGuild = Object.values(db.guilds).find(g => 
        g.name && g.name.toLowerCase() === guildName.toLowerCase()
      );

      if (existingGuild) {
        return sock.sendMessage(chatId, { text: '❌ Guild name already taken!' });
      }

      if (!isAuthorized) {
        player.gold = playerNexus - NEXUS_REQ;
        player.manaCrystals = playerMana - MANA_REQ;
        if (player.inventory) player.inventory.gold = player.gold;
      }

      const guildId = `guild_${Date.now()}`;
      db.guilds[guildId] = {
        id: guildId,
        name: guildName,
        leader: sender,
        members: [sender],
        memberData: [{ id: sender, name: player.name || 'Unknown', rank: 'Guild Master', joinedAt: Date.now() }],
        treasury: START_NEXUS,
        manaTreasury: START_MANA,
        level: 1,
        xp: 0,
        createdAt: Date.now(),
        totalRaids: 0,
        totalWars: 0,
        wins: 0,
        buffs: [],
        gatesOwned: [],
        createdByIsOwner: isOwner,
      };

      player.guild = guildName;
      player.guildJoinedAt = Date.now();

      const { AuraSystem } = require('../../rpg/utils/AuraSystem');
      AuraSystem.addAura(player, 'guildFounder');

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ GUILD CREATED! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 Name: ${guildName}
👑 Leader: ${player.name}
👥 Members: 1/20
💠 Treasury: ${START_NEXUS.toLocaleString()} Nexus
💎 Treasury: ${START_MANA.toLocaleString()} Mana Stones
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // JOIN GUILD
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'join') {
      const guildName = args.slice(1).join(' ');

      if (!guildName) {
        return sock.sendMessage(chatId, {
          text: '❌ Specify guild name!\n\nExample: /guild join Dragon Slayers'
        });
      }

      const guild = Object.values(db.guilds).find(g => 
        g.name && g.name.toLowerCase() === guildName.toLowerCase()
      );

      if (!guild) {
        return sock.sendMessage(chatId, {
          text: '❌ Guild not found!'
        });
      }

      if (playerGuild) {
        return sock.sendMessage(chatId, {
          text: '❌ You are already in a guild!'
        });
      }

      if (!guild.members) guild.members = [];
      
      if (guild.members.length >= 20) {
        return sock.sendMessage(chatId, {
          text: '❌ Guild is full!'
        });
      }

      guild.members.push({
        id: sender,
        name: player.name || 'Unknown',
        rank: 'Member',
        joinedAt: Date.now()
      });
      player.guild = guild.name;
      player.guildJoinedAt = Date.now();

      if (db.guildInvites[sender]) {
        delete db.guildInvites[sender];
      }

      saveDatabase();

      await sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ JOINED GUILD! ✅\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏰 ${guild.name}\n👥 Members: ${guild.members.length}/20\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      });

      if (guild.leader) {
        try {
          await sock.sendMessage(guild.leader, {
            text: `🏰 ${player.name} joined your guild!\n\nMembers: ${guild.members.length}/20`,
            mentions: [sender]
          });
        } catch (e) {}
      }

      return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // GUILD MEMBERS
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'members') {
      if (!playerGuild) {
        return sock.sendMessage(chatId, {
          text: '❌ You are not in a guild!'
        });
      }

      let memberList = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 GUILD MEMBERS 👥
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 ${playerGuild.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      if (playerGuild.members && playerGuild.members.length > 0) {
        playerGuild.members.forEach((member, i) => {
          const rankEmoji = member.rank === 'Leader' || member.rank === 'Guild Master' ? '👑' : member.rank === 'Officer' ? '⭐' : '👤';
          memberList += `${i + 1}. ${rankEmoji} ${member.name || 'Unknown'}\n`;
          memberList += `   ${member.rank || 'Member'}\n\n`;
        });
      }

      memberList += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      memberList += `Total: ${playerGuild.members.length}/20`;

      return sock.sendMessage(chatId, { text: memberList });
    }

    // ═══════════════════════════════════════════════════════════════════
    // LEAVE GUILD
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'leave') {
      if (!playerGuild) {
        return sock.sendMessage(chatId, {
          text: '❌ You are not in a guild!'
        });
      }

      if (playerGuild.leader === sender) {
        return sock.sendMessage(chatId, {
          text: '❌ Leader cannot leave!\n\nDisband guild with: /guild disband\nOr transfer leadership first.'
        });
      }

      playerGuild.members = playerGuild.members.filter(m => m.id !== sender);
      player.guild = null;
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: '✅ You left the guild.'
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // HIRE MEMBER (PROPOSAL & ACCEPTANCE FLOW)
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'hire') {
      if (!playerGuild) return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' });

      if (!CM.isGuildMasterOrVice(db, playerGuild.name, sender)) {
        return sock.sendMessage(chatId, { text: '❌ Only the Guild Master or Vice Guild Master can hire hunters.' });
      }

      const guildId = Object.keys(db.guilds).find(id => db.guilds[id] === playerGuild);
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const targetId = mentionedJid || quotedParticipant;
      if (!targetId) return sock.sendMessage(chatId, { text: '❌ Tag the hunter you want to hire (or reply to them).\n\nUsage: /guild hire @user 500 | 20 || 4' });

      if (targetId === sender) {
        return sock.sendMessage(chatId, { text: '❌ You cannot hire yourself!' });
      }

      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '');
      const nums = (text.match(/\d+/g) || []).map(Number);
      const weeklyNexus = nums[0] || 500;
      const weeklyMana  = nums[1] || 10;
      const weeks       = nums[2] || 4;

      const targetUser = db.users?.[targetId];
      const targetName = targetUser?.name || targetId.split('@')[0];

      // Store pending hire offer
      db.pendingGuildHires[targetId] = {
        guildId,
        guildName: playerGuild.name,
        gmId: sender,
        weeklyNexus,
        weeklyMana,
        weeks,
        expiresAt: Date.now() + 300000 // 5 minutes
      };
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📜 *GUILD CONTRACT OFFER*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🏰 Guild: *${playerGuild.name}*`,
          `👤 Candidate: *@${targetId.split('@')[0]}*`,
          `💠 Weekly Nexus: *${weeklyNexus.toLocaleString()}*`,
          `💎 Weekly Mana: *${weeklyMana.toLocaleString()}*`,
          `⏳ Contract Length: *${weeks} week${weeks > 1 ? 's' : ''}*`,
          ``,
          `👉 *@${targetId.split('@')[0]}*, respond with:`,
          `  • \`/guild accept\` to join and sign contract`,
          `  • \`/guild decline\` to reject offer`,
          ``,
          `⏳ Offer expires in 5 minutes.`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
        mentions: [targetId],
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // DEPOSIT / WITHDRAW
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'deposit' || action === 'withdraw') {
      if (!playerGuild) return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' });

      const isWithdraw = action === 'withdraw';
      const canWithdraw = CM.isGuildMasterOrVice(db, playerGuild.name, sender);
      if (isWithdraw && !canWithdraw) {
        return sock.sendMessage(chatId, { text: '❌ Only the Guild Master or Vice Guild Master can withdraw from the treasury.' });
      }

      const cur = (args[1] || '').toUpperCase();
      const amount = parseInt(args[2]);
      if (!['N', 'M'].includes(cur) || !amount || amount <= 0) {
        return sock.sendMessage(chatId, { text: '❌ Usage:\n/guild deposit N <nexus>\n/guild deposit M <mana>\n/guild withdraw N <nexus>\n/guild withdraw M <mana>' });
      }

      if (cur === 'N') {
        if (isWithdraw) {
          const avail = playerGuild.treasury || 0;
          if (avail < amount) return sock.sendMessage(chatId, { text: `❌ Treasury only has ${avail.toLocaleString()} Nexus.` });
          playerGuild.treasury -= amount;
          player.gold = (player.gold || 0) + amount;
          if (player.inventory) player.inventory.gold = player.gold;
          saveDatabase();
          return sock.sendMessage(chatId, { text: `✅ *Withdrew* 💠 ${amount.toLocaleString()} Nexus to your balance.\n🏰 Treasury now: ${(playerGuild.treasury || 0).toLocaleString()} Nexus` });
        }
        const bal = player.gold || 0;
        if (bal < amount) return sock.sendMessage(chatId, { text: `❌ You have ${bal.toLocaleString()} Nexus.` });
        player.gold = bal - amount;
        if (player.inventory) player.inventory.gold = player.gold;
        playerGuild.treasury = (playerGuild.treasury || 0) + amount;
        saveDatabase();
        return sock.sendMessage(chatId, { text: `✅ *Deposited* 💠 ${amount.toLocaleString()} Nexus to the guild.\n🏰 Treasury now: ${(playerGuild.treasury || 0).toLocaleString()} Nexus` });
      }

      if (isWithdraw) {
        const avail = playerGuild.manaTreasury || 0;
        if (avail < amount) return sock.sendMessage(chatId, { text: `❌ Treasury only has ${avail.toLocaleString()} Mana Stones.` });
        playerGuild.manaTreasury -= amount;
        player.manaCrystals = (player.manaCrystals || 0) + amount;
        saveDatabase();
        return sock.sendMessage(chatId, { text: `✅ *Withdrew* 💎 ${amount.toLocaleString()} Mana Stones.\n🏰 Treasury now: ${(playerGuild.manaTreasury || 0).toLocaleString()} 💎` });
      }
      const bal = player.manaCrystals || 0;
      if (bal < amount) return sock.sendMessage(chatId, { text: `❌ You have ${bal.toLocaleString()} Mana Stones.` });
      player.manaCrystals = bal - amount;
      playerGuild.manaTreasury = (playerGuild.manaTreasury || 0) + amount;
      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ *Deposited* 💎 ${amount.toLocaleString()} Mana Stones.\n🏰 Treasury now: ${(playerGuild.manaTreasury || 0).toLocaleString()} 💎` });
    }

    // ═══════════════════════════════════════════════════════════════════
    // DISBAND GUILD
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'disband') {
      if (!playerGuild) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' });
      }

      if (playerGuild.leader !== sender) {
        return sock.sendMessage(chatId, { text: '❌ Only the guild leader can disband the guild!' });
      }

      const guildId = Object.keys(db.guilds).find(id => db.guilds[id] === playerGuild);
      delete db.guilds[guildId];
      saveDatabase();

      return sock.sendMessage(chatId, { text: `✅ *${playerGuild.name}* has been disbanded.` });
    }

    return sock.sendMessage(chatId, {
      text: '❌ Invalid command!\n\nUse /guild for menu.'
    });
  }
};
