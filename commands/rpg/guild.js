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

    // ── Normalize legacy guild members ─────────────────────────────
    // guild.members is a MIX of formats: the creator is stored as a bare ID
    // string (members: [sender]) while joined users are objects {id,rank}.
    // Every membership check reads m.id / m.rank, so a bare string always
    // fails — that's why freshly-created guilds replied "You are not in a
    // guild!" to /guild info/members. Convert strings -> objects
    // (idempotent, safe to run on every call) so all subcommands agree.
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
      // Drop any members who somehow ended up stored twice
      g.members = g.members.filter((m, i, a) => a.findIndex(x => x.id === m.id) === i);
    }

    const action = args[0]?.toLowerCase();

    // ═══════════════════════════════════════════════════════════════════
    // GUILD MENU
    // ═══════════════════════════════════════════════════════════════════
    if (!action) {
      const hpBar = BarSystem.getHPBar(player.stats.hp, player.stats.maxHp);
      const hpStatus = BarSystem.getHPStatus(player.stats.hp, player.stats.maxHp);
      const energyBar = BarSystem.getEnergyBar(player.stats.energy, player.stats.maxEnergy, player.class);
      const energyType = player.class === 'Mage' ? 'Mana' : 
                         player.class === 'Warrior' ? 'Stamina' : 
                         player.class === 'Berserker' ? 'Rage' : 'Energy';

      const menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 GUILD SYSTEM 🏰
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 YOUR STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 ${player.name}
❤️ HP: ${player.stats.hp}/${player.stats.maxHp} - ${hpStatus}
${hpBar}

${player.energyColor || '💙'} ${energyType}: ${player.stats.energy}/${player.stats.maxEnergy}
${energyBar}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Build the strongest guild!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/guild create [name] - Create (500,000💠 + 10,000💎 | Lv.20)
/guild join [name] - Join guild
/guild leave - Leave guild
/guild info - Guild details
/guild members - Member list
/guild kick @user - Kick member
/guild deposit N|M [amount] - Deposit to treasury
/guild withdraw N|M [amount] - Withdraw (GM/Vice)
/guild promote <vice|officer> @user - Promote (GM)
/guild demote @user - Demote (GM)
/guild hire <n|x>|<m|y>||<weeks> - Hire a hunter (GM/Vice)
/guild kickapprove @user - Approve a kick (GM/Vice)
/guild disband - Delete guild
/guild raid - Guild raid boss!
/guild shop - Guild shop
/guild buy [#] - Buy from shop
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 GUILD BENEFITS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Guild raids (huge rewards!)
- Guild shop (exclusive items!)
- Member bonuses (+5% XP/Nexus)
- Shared treasury
- Teamwork & competition
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: menu });
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

      // ── GUILD CREATION ─────────────────────────────────────────
      //   • Owners (Naruto / Senku) always create normally.
      //   • ONE additional player the owner authorizes via /guildmaster authorize.
      //   • Everyone else: Level 25 + 3,000,000 Nexus + 500,000 Mana Stones.
      // Each new guild starts with 1,000,000 Nexus + 100,000 Mana Stones.
      if (!db.authorizedGuildMasters) db.authorizedGuildMasters = [];
      const isOwner = Perms.isBotOwner(db, sender);
      const isAuthorized = isOwner || db.authorizedGuildMasters.includes(sender);

      const LEVEL_REQ = 25;
      const NEXUS_REQ = 3_000_000;
      const MANA_REQ  = 500_000;
      const NEXUS_TO_TREASURY  = 1_000_000;
      const MANA_TO_TREASURY   = 100_000;
      const START_NEXUS = 1_000_000;
      const START_MANA  = 100_000;

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
              ``,
              `Guilds are created by:`,
              `• An *owner* (Naruto / Senku), or`,
              `• An *authorized guild master* (/guildmaster authorize), or`,
              `• Any player who meets the requirements:`,
              ``,
              `🎯 *Level ${LEVEL_REQ}*`,
              `💠 *${NEXUS_REQ.toLocaleString()} Nexus*`,
              `💎 *${MANA_REQ.toLocaleString()} Mana Stones*`,
              ``,
              `📊 You currently have:`,
              `   📈 Level ${playerLevel}${playerLevel >= LEVEL_REQ ? ' ✅' : ''}`,
              `   💠 ${playerNexus.toLocaleString()} Nexus${playerNexus >= NEXUS_REQ ? ' ✅' : ''}`,
              `   💎 ${playerMana.toLocaleString()} Mana Stones${playerMana >= MANA_REQ ? ' ✅' : ''}`,
              ``,
              `_Upon creation: 1,000,000 Nexus + 100,000 Mana Stones go to guild treasury._`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ].join('\n')
          });
        }
      }

      // Check if player is already in a guild
      const playerGuild = Object.values(db.guilds).find(g => 
        g.members && g.members.some(m => m.id === sender || m === sender)
      );

      if (playerGuild) {
        return sock.sendMessage(chatId, {
          text: '❌ You are already in a guild!\n\nUse /guild leave first.'
        });
      }

      // Check if guild name exists
      const existingGuild = Object.values(db.guilds).find(g => 
        g.name && g.name.toLowerCase() === guildName.toLowerCase()
      );

      if (existingGuild) {
        return sock.sendMessage(chatId, { text: '❌ Guild name already taken!' });
      }

      // ── Pay creation cost (owners / authorized masters pay nothing) ──
      if (!isAuthorized) {
        player.gold = playerNexus - NEXUS_REQ;
        player.manaCrystals = playerMana - MANA_REQ;
        if (player.inventory) player.inventory.gold = player.gold;
      }

      // Create guild
      const guildId = `guild_${Date.now()}`;
      db.guilds[guildId] = {
        id: guildId,
        name: guildName,
        leader: sender,
        members: [sender],
        memberData: [{ id: sender, name: player.name || 'Unknown', rank: 'Guild Master', joinedAt: Date.now() }],
        treasury: START_NEXUS,          // Nexus in guild treasury
        manaTreasury: START_MANA,       // Mana Stones in guild treasury
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

      // Update player
      player.guild = guildName;
      player.guildJoinedAt = Date.now();

      // Aura reward for founding
      const { AuraSystem } = require('../../rpg/utils/AuraSystem');
      const auraResult = AuraSystem.addAura(player, 'guildFounder');

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
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Next Steps:
/guild raid - Start raiding!
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

      // Check if player is already in a guild
      const playerGuild = Object.values(db.guilds).find(g => 
        g.members && g.members.some(m => m.id === sender)
      );

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

      // Add player to guild
      guild.members.push({
        id: sender,
        name: player.name || 'Unknown',
        rank: 'Member',
        joinedAt: Date.now()
      });

      // Remove invite if exists
      if (db.guildInvites[sender]) {
        delete db.guildInvites[sender];
      }

      saveDatabase();

      await sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ JOINED GUILD! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 ${guild.name}
👥 Members: ${guild.members.length}/20
💠 Treasury: ${guild.treasury || 0} Nexus
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Welcome to the guild! 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      });

      // Notify leader
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
    // GUILD INFO
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'info') {
      const playerGuild = Object.values(db.guilds).find(g => 
        g.members && g.members.some(m => m.id === sender)
      );

      if (!playerGuild) {
        return sock.sendMessage(chatId, {
          text: '❌ You are not in a guild!'
        });
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
💠 Treasury: ${playerGuild.treasury || 0} Nexus
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 STATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 Raids Completed: ${playerGuild.totalRaids || 0}
⚔️ Wars Fought: ${playerGuild.totalWars || 0}
🏆 Wars Won: ${playerGuild.wins || 0}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use /guild members to see all members!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: info });
    }

    // ═══════════════════════════════════════════════════════════════════
    // GUILD MEMBERS
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'members') {
      const playerGuild = Object.values(db.guilds).find(g => 
        g.members && g.members.some(m => m.id === sender)
      );

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
          const rankEmoji = member.rank === 'Leader' ? '👑' : member.rank === 'Officer' ? '⭐' : '👤';
          memberList += `${i + 1}. ${rankEmoji} ${member.name || 'Unknown'}\n`;
          memberList += `   ${member.rank}\n\n`;
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
      const playerGuild = Object.entries(db.guilds).find(([id, g]) => 
        g.members && g.members.some(m => m.id === sender)
      );

      if (!playerGuild) {
        return sock.sendMessage(chatId, {
          text: '❌ You are not in a guild!'
        });
      }

      const [guildId, guild] = playerGuild;

      if (guild.leader === sender) {
        return sock.sendMessage(chatId, {
          text: '❌ Leader cannot leave!\n\nDisband guild with: /guild disband\nOr transfer leadership first.'
        });
      }

      guild.members = guild.members.filter(m => m.id !== sender);
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: '✅ You left the guild.'
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // KICK MEMBER
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'kick') {
      const playerGuild = Object.values(db.guilds).find(g => 
        g.members && g.members.some(m => m.id === sender)
      );

      if (!playerGuild) {
        return sock.sendMessage(chatId, {
          text: '❌ You are not in a guild!'
        });
      }

      const member = playerGuild.members.find(m => m.id === sender);
      if (!member || (member.rank !== 'Leader' && member.rank !== 'Officer')) {
        return sock.sendMessage(chatId, {
          text: '❌ Only Leader/Officers can kick members!'
        });
      }

      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const targetId = mentionedJid || quotedParticipant;

      if (!targetId) {
        return sock.sendMessage(chatId, {
          text: '❌ Tag a user or reply to kick!\n\nExample: /guild kick @user'
        });
      }

      if (targetId === playerGuild.leader) {
        return sock.sendMessage(chatId, {
          text: '❌ Cannot kick the guild leader!'
        });
      }

      if (targetId === sender) {
        return sock.sendMessage(chatId, {
          text: '❌ Use /guild leave to leave the guild!'
        });
      }

      const targetMember = playerGuild.members.find(m => m.id === targetId);

      if (!targetMember) {
        return sock.sendMessage(chatId, {
          text: '❌ That user is not in your guild!'
        });
      }

      // ── KICK APPROVAL ──
      // Officers may kick a normal member, but targeting another officer (or a
      // member with a contract) requires Guild Master / Vice approval.
      // Guild Master & Vice always act immediately.
      const kickerIsMasterOrVice = CM.isGuildMasterOrVice(db, playerGuild.name, sender);
      const targetIsOfficer = (targetMember.rank || '').toLowerCase() === 'officer';
      const targetHasContract = !!CM.getContract(db, Object.keys(db.guilds).find(id => db.guilds[id] === playerGuild), targetId);
      const needsApproval = !kickerIsMasterOrVice && (targetIsOfficer || targetHasContract);
      if (needsApproval) {
        const guildId = Object.keys(db.guilds).find(id => db.guilds[id] === playerGuild);
        if (!db.kickApprovals) db.kickApprovals = {};
        db.kickApprovals[guildId] = db.kickApprovals[guildId] || [];
        if (!db.kickApprovals[guildId].some(a => a.targetId === targetId)) {
          db.kickApprovals[guildId].push({ targetId, requestedBy: sender, requestedAt: Date.now() });
          saveDatabase();
          return sock.sendMessage(chatId, {
            text: `⏳ *Kick request pending.*\n\nOfficers need a *Guild Master / Vice* to approve.\n\n👤 ${targetMember.name}${targetHasContract ? ' (has an active contract)' : ''}\n📌 A Guild Master/Vice must run:\n/guild kickapprove @${targetId.split('@')[0]}`,
            mentions: [targetId],
          }, { quoted: msg });
        }
        return sock.sendMessage(chatId, { text: '⏳ A kick request for that member is already pending.' });
      }

      const guildId = Object.keys(db.guilds).find(id => db.guilds[id] === playerGuild);

      // ── CONTRACT PAYOUT (×2 remaining balance) ──
      const payout = CM.kickPayout(db, guildId, targetId, saveDatabase);
      let payoutLine = '';
      if (payout.success) {
        const rem = CM.remainingBalance(db, guildId, targetId);
        payoutLine = `\n💠 *Contract payout (×2 remaining):*\n   💠 ${payout.payout.nexus.toLocaleString()} Nexus\n   💎 ${payout.payout.mana.toLocaleString()} Mana Stones`;
        // Only pay if the guild treasury can cover it (best effort)
        if ((playerGuild.treasury || 0) >= payout.payout.nexus) playerGuild.treasury -= payout.payout.nexus;
      }

      playerGuild.members = playerGuild.members.filter(m => m.id !== targetId);
      if (playerGuild.memberData) playerGuild.memberData = playerGuild.memberData.filter(m => m.id !== targetId);
      saveDatabase();

      await sock.sendMessage(chatId, {
        text: `✅ ${targetMember.name} has been kicked from the guild!${payoutLine}`,
        mentions: [targetId]
      });

      try {
        await sock.sendMessage(targetId, {
          text: `❌ You have been kicked from ${playerGuild.name}!`
        });
      } catch (e) {}

      return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // HIRE MEMBER (formal contract — Guild Master / Vice only)
    //   /guild hire <weeklyNexus> | <weeklyMana> || <weeks>
    // Weekly wage auto-deducted from guild treasury each week.
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'hire') {
      const playerGuild = Object.values(db.guilds).find(g =>
        g.members && g.members.some(m => m.id === sender)
      );
      if (!playerGuild) return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' });

      if (!CM.isGuildMasterOrVice(db, playerGuild.name, sender)) {
        return sock.sendMessage(chatId, { text: '❌ Only the Guild Master or Vice Guild Master can hire hunters.' });
      }

      const guildId = Object.keys(db.guilds).find(id => db.guilds[id] === playerGuild);
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const targetId = mentionedJid || quotedParticipant;
      if (!targetId) return sock.sendMessage(chatId, { text: '❌ Tag the hunter you want to hire (or reply to them).' });

      // Parse "/guild hire 500 | 20 || 4"
      //  weeklyNexus = first number  | weeklyMana = second number  | weeks = third
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '');
      const nums = (text.match(/\d+/g) || []).map(Number);
      const weeklyNexus = nums[0] || 0;
      const weeklyMana  = nums[1] || 0;
      const weeks       = nums[2] || 0;

      const res = CM.hire(db, guildId, sender, targetId, weeklyNexus, weeklyMana, weeks);
      if (!res.success) return sock.sendMessage(chatId, { text: `❌ ${res.error}\n\nUsage: /guild hire <weeklyNexus> | <weeklyMana> || <weeks>` });

      // First week's wage is paid immediately up-front (first pay).
      const pay = CM.processWeeklyPay(db, guildId, saveDatabase);
      const t = db.users?.[targetId] || {};
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🤝 *HUNTER HIRED*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `👤 ${t.name || '@' + targetId.split('@')[0]}`,
          `🏰 Guild: ${playerGuild.name}`,
          `💠 Weekly: ${weeklyNexus.toLocaleString()} Nexus`,
          `💎 Weekly: ${weeklyMana.toLocaleString()} Mana Stones`,
          `⏳ Duration: ${weeks} week${weeks > 1 ? 's' : ''}`,
          ``,
          `_Weekly wage is auto-deducted from the guild treasury._`,
          `_Kicking a contracted hunter pays them ×2 the remaining balance._`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
        mentions: [targetId],
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // KICK APPROVE — Guild Master / Vice approves a pending officer kick
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'kickapprove') {
      const playerGuild = Object.values(db.guilds).find(g =>
        g.members && g.members.some(m => m.id === sender)
      );
      if (!playerGuild) return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' });
      if (!CM.isGuildMasterOrVice(db, playerGuild.name, sender)) {
        return sock.sendMessage(chatId, { text: '❌ Only the Guild Master or Vice Guild Master can approve kicks.' });
      }
      const guildId = Object.keys(db.guilds).find(id => db.guilds[id] === playerGuild);
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const targetId = mentionedJid || quotedParticipant;
      if (!targetId) return sock.sendMessage(chatId, { text: '❌ Tag the member to approve the kick for.' });

      if (!db.kickApprovals) db.kickApprovals = {};
      const list = db.kickApprovals[guildId] || [];
      const idx = list.findIndex(a => a.targetId === targetId);
      if (idx === -1) return sock.sendMessage(chatId, { text: 'ℹ️ No pending kick request for that member.' });

      db.kickApprovals[guildId].splice(idx, 1);
      const targetMember = playerGuild.members.find(m => m.id === targetId);
      const payout = CM.kickPayout(db, guildId, targetId, saveDatabase);
      let payoutLine = '';
      if (payout.success) {
        payoutLine = `\n💠 *Contract payout (×2):* ${payout.payout.nexus.toLocaleString()} Nexus / ${payout.payout.mana.toLocaleString()} 💎`;
        if ((playerGuild.treasury || 0) >= payout.payout.nexus) playerGuild.treasury -= payout.payout.nexus;
      }
      playerGuild.members = playerGuild.members.filter(m => m.id !== targetId);
      if (playerGuild.memberData) playerGuild.memberData = playerGuild.memberData.filter(m => m.id !== targetId);
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `✅ Kick approved. ${targetMember?.name || '@' + targetId.split('@')[0]} has been kicked.${payoutLine}`,
        mentions: [targetId],
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // DEPOSIT / WITHDRAW — guild treasury (GM/Vice, officers deposit only)
    //   /guild deposit N <nexus>   |   /guild deposit M <mana>
    //   /guild withdraw N <nexus>  |   /guild withdraw M <mana>
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'deposit' || action === 'withdraw') {
      const playerGuild = Object.values(db.guilds).find(g =>
        g.members && g.members.some(m => m.id === sender)
      );
      if (!playerGuild) return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' });

      const isWithdraw = action === 'withdraw';
      // Officers cannot withdraw (deposit only).
      const memberRank = CM.rankOf(playerGuild, sender);
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

      // Mana Stones
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
    // DONATE (deposit Nexus — legacy, all members)
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'donate') {
      const playerGuild = Object.values(db.guilds).find(g => 
        g.members && g.members.some(m => m.id === sender)
      );

      if (!playerGuild) {
        return sock.sendMessage(chatId, {
          text: '❌ You are not in a guild!'
        });
      }

      const amount = parseInt(args[1]);

      if (!amount || amount < 100) {
        return sock.sendMessage(chatId, {
          text: '❌ Minimum donation: 100 Nexus\n\nExample: /guild donate 500'
        });
      }

      const playerNexus = player.gold || 0;

      if (playerNexus < amount) {
        return sock.sendMessage(chatId, {
          text: `❌ Not enough Nexus!\n\nNeed: ${amount} 💠\nHave: ${playerNexus} 💠`
        });
      }

      player.gold = playerNexus - amount;
      if (player.inventory) player.inventory.gold = player.gold;
      
      if (!playerGuild.treasury) playerGuild.treasury = 0;
      playerGuild.treasury += amount;
      
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DONATION SUCCESSFUL! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Donated: ${amount} Nexus
🏰 Guild: ${playerGuild.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 Guild Treasury: ${playerGuild.treasury} Nexus
💠 Your Nexus: ${player.gold}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Thank you for supporting the guild! 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // PROMOTE MEMBER — /guild promote <rank> @user
    //   rank = vicemaster | vice | officer
    //   Vice GM capped at 2, Officers capped at 10. GM (leader) promotes.
    //   /guild demote @user removes rank (GM only).
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'promote' || action === 'demote') {
      const playerGuild = Object.values(db.guilds).find(g =>
        g.members && g.members.some(m => m.id === sender)
      );
      if (!playerGuild) return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' });
      if (playerGuild.leader !== sender) return sock.sendMessage(chatId, { text: '❌ Only the guild leader can promote/demote!' });

      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const targetId = mentionedJid || quotedParticipant;
      if (!targetId) return sock.sendMessage(chatId, { text: '❌ Tag a user or reply.\n\nExample: /guild promote vice @user\n       /guild demote @user' });

      const targetMember = playerGuild.members.find(m => m.id === targetId);
      if (!targetMember) return sock.sendMessage(chatId, { text: '❌ That user is not in your guild!' });

      // ── DEMOTE ──
      if (action === 'demote') {
        if (targetMember.rank === 'Guild Master' || targetMember.rank === 'Leader') {
          return sock.sendMessage(chatId, { text: '❌ Cannot demote the guild leader.' });
        }
        const oldRank = targetMember.rank;
        targetMember.rank = 'Member';
        // Also sync memberData
        const md = playerGuild.memberData?.find(m => m.id === targetId);
        if (md) md.rank = 'Member';
        saveDatabase();
        return sock.sendMessage(chatId, { text: `✅ ${targetMember.name} demoted from ${oldRank || 'rank'} to Member.`, mentions: [targetId] });
      }

      // ── PROMOTE ──
      const rankArg = (args[1] || '').toLowerCase();
      const isVice = ['vicemaster', 'vice master', 'vice', 'vicegm', 'gm2'].includes(rankArg);
      const newRank = isVice ? 'Vice Guild Master' : 'Officer';

      // Caps
      if (isVice) {
        const viceCount = (playerGuild.members || []).filter(m => (m.rank || '').toLowerCase() === 'vice guild master').length;
        if (viceCount >= 2) return sock.sendMessage(chatId, { text: '❌ Vice Guild Master is capped at *2*.' });
      } else {
        const officerCount = (playerGuild.members || []).filter(m => (m.rank || '').toLowerCase() === 'officer').length;
        if (officerCount >= 10) return sock.sendMessage(chatId, { text: '❌ Officer is capped at *10*.' });
      }

      if ((targetMember.rank || '').toLowerCase() === newRank.toLowerCase()) {
        return sock.sendMessage(chatId, { text: `❌ ${targetMember.name} is already a ${newRank}!` });
      }

      targetMember.rank = newRank;
      const md = playerGuild.memberData?.find(m => m.id === targetId);
      if (md) md.rank = newRank;
      saveDatabase();

      await sock.sendMessage(chatId, { text: `✅ ${targetMember.name} promoted to ${newRank}!`, mentions: [targetId] });

      try {
        await sock.sendMessage(targetId, { text: `🎉 You've been promoted to ${newRank} in ${playerGuild.name}!` });
      } catch (e) {}

      return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // DISBAND GUILD
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'disband') {
      const playerGuild = Object.entries(db.guilds).find(([id, g]) => 
        g.members && g.members.some(m => m.id === sender)
      );

      if (!playerGuild) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' });
      }

      const [guildId, guild] = playerGuild;

      if (guild.leader !== sender) {
        return sock.sendMessage(chatId, { text: '❌ Only the guild leader can disband the guild!' });
      }

      const guildName = guild.name;
      
      // Notify all members
      if (guild.members) {
        for (const member of guild.members) {
          if (member.id !== sender) {
            try {
              await sock.sendMessage(member.id, { text: `⚠️ ${guildName} has been disbanded by the leader!` });
            } catch (e) {}
          }
        }
      }

      delete db.guilds[guildId];
      saveDatabase();

      return sock.sendMessage(chatId, { text: `✅ ${guildName} has been disbanded!` });
    }

    // ═══════════════════════════════════════════════════════════════════
    // GUILD RAID
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'raid') {
      const playerGuild = Object.values(db.guilds).find(g => 
        g.members && g.members.some(m => m.id === sender)
      );

      if (!playerGuild) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' });
      }

      if (!playerGuild.members || playerGuild.members.length < 3) {
        return sock.sendMessage(chatId, { text: `❌ Need 3+ members for guild raid!\n\nCurrent members: ${playerGuild.members?.length || 0}` });
      }

      const cost = 50;
      if (player.manaCrystals < cost) {
        return sock.sendMessage(chatId, { text: `❌ Guild raids require ${cost} crystals!\nYou have: ${player.manaCrystals}` });
      }

      if (!player.dungeon) player.dungeon = {};

      player.manaCrystals -= cost;

      const bossLevel = player.level + 10;
      const memberCount = playerGuild.members.length;
      // Scale boss based on player level, not raw stats (prevents absurd numbers)
      // Boss should be hard but killable with coordinated guild (3+ members)
      const raidBaseHP  = 300 + (player.level * 60);
      const raidBaseATK = 20  + (player.level * 5);
      const raidBaseDEF = 10  + (player.level * 2.5);
      const boss = {
        name: "Guild Raid Boss - Ancient Dragon",
        emoji: '🐉👑',
        hp:    Math.floor(raidBaseHP  * memberCount),
        maxHp: Math.floor(raidBaseHP  * memberCount),
        atk:   Math.floor(raidBaseATK * 1.5),
        def:   Math.floor(raidBaseDEF * 1.2),
        level: bossLevel
      };

      player.dungeon.currentBattle = {
        type: 'guild_raid',
        boss: boss,
        guildId: Object.keys(db.guilds).find(id => db.guilds[id] === playerGuild),
        turn: 0,
        startTime: Date.now(),
        timeLimit: 10 * 60 * 1000
      };

      saveDatabase();

      const bossHPBar = BarSystem.getMonsterHPBar(boss);

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 GUILD RAID STARTED! 🏰
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${boss.emoji} ${boss.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${bossHPBar}

⚔️ ATK: ${boss.atk}
🛡️ DEF: ${boss.def}
⭐ Level: ${boss.level}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ Time: 10 minutes
👥 Guild: ${playerGuild.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 VICTORY REWARDS:
- 5000 Nexus (split)
- 500 Mana Stones (split)
- Legendary Items
- Guild XP
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use /guild raid attack or /guild raid skill!
Check boss: /guild raid status
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // GUILD RAID - ATTACK / SKILL
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'raid' && (args[1] === 'attack' || args[1] === 'skill' || args[1] === 'use' || args[1] === 'status')) {
      if (!player.dungeon?.currentBattle || player.dungeon.currentBattle.type !== 'guild_raid') {
        return sock.sendMessage(chatId, { text: '❌ No active guild raid! Use /guild raid to start one.' }, { quoted: msg });
      }

      const battle = player.dungeon.currentBattle;
      const boss = battle.boss;

      if (args[1] === 'status') {
        const bossHPBar = BarSystem.getMonsterHPBar(boss.hp, boss.maxHp);
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐉👑 RAID BOSS STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${boss.emoji} ${boss.name}
${bossHPBar}
❤️ HP: ${boss.hp}/${boss.maxHp}
⚔️ ATK: ${boss.atk} | 🛡️ DEF: ${boss.def}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Use /guild raid attack or /guild raid skill`
        }, { quoted: msg });
      }

      // Init status effects if missing
      if (!boss.statusEffects) boss.statusEffects = [];
      if (!player.statusEffects) player.statusEffects = [];

      let log = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
      log += `⚔️ GUILD RAID — TURN ${(battle.turn || 0) + 1}
`;
      log += `━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

      // Process player status effects first
      const playerEffects = StatusEffectManager.processTurnEffects(player);
      if (playerEffects.messages.length > 0) {
        log += playerEffects.messages.join('\n') + '\n';
      }

      // Check if player can act (stun/freeze/paralyze)
      if (!playerEffects.canAct) {
        log += `⚠️ ${player.name} cannot act this turn!
`;
      } else {
        // Get stat modifiers from status effects
        const { atkMod, accuracyMod } = StatusEffectManager.getStatModifiers(player);

        // Calculate player damage
        const playerATK = (player.stats.atk + (player.weapon?.bonus || 0)) * atkMod;
        let dmg = Math.max(1, Math.floor(playerATK - boss.def * 0.4));
        let actionLabel = '⚔️ attacks';

        // Skill gives 1.5x damage
        if ((args[1] === 'skill' || args[1] === 'use') && player.skills?.active?.length > 0) {
          if (!playerEffects.canUseSkills) {
            log += `🤐 ${player.name} is Silenced — skill cancelled! Using basic attack.
`;
          } else {
            const energyCost = 20;
            if ((player.stats.energy || 0) < energyCost) {
              return sock.sendMessage(chatId, { text: `❌ Not enough energy! Need ${energyCost}, have ${player.stats.energy || 0}.` }, { quoted: msg });
            }
            player.stats.energy = Math.max(0, (player.stats.energy || 0) - energyCost);
            const skillArg = args.slice(2).join(' ').toLowerCase();
            const skill = skillArg
              ? (player.skills.active.find(s => s.name.toLowerCase().includes(skillArg)) || player.skills.active[0])
              : player.skills.active[0];
            if (skillArg && !player.skills.active.find(s => s.name.toLowerCase().includes(skillArg))) {
              log += `⚠️ Skill "${args.slice(2).join(' ')}" not found — using ${skill.name}.\n`;
            }
            actionLabel = `✨ uses ${skill.name}`;
            dmg = Math.floor(dmg * 1.5);

            // Skill may apply status effect to boss
            if (skill.effect) {
              const effectMatch = skill.effect.toLowerCase().match(/(poison|burn|bleed|stun|freeze|weaken|blind|silence|paralyze|fear)/);
              if (effectMatch) {
                const chanceMatch = skill.effect.match(/(\d+)%/);
                const chance = chanceMatch ? parseInt(chanceMatch[1]) / 100 : 0.5;
                if (Math.random() < chance) {
                  StatusEffectManager.applyEffect(boss, effectMatch[1], 3);
                  log += `🌀 ${boss.name} is afflicted with ${effectMatch[1]}!
`;
                }
              }
            }
          }
        }

        // Accuracy check
        if (Math.random() > accuracyMod * 0.9) {
          log += `🌫️ ${player.name}'s attack missed!
`;
          dmg = 0;
        } else {
          // Crit
          const critChance = (player.stats.crit || 0) / 100;
          const isCrit = Math.random() < critChance;
          if (isCrit) dmg = Math.floor(dmg * 1.5);
          boss.hp = Math.max(0, boss.hp - dmg);
          log += `👤 ${player.name} ${actionLabel}!
`;
          log += `💥 Dealt ${dmg} damage${isCrit ? ' 🎯 CRITICAL!' : ''}!
`;
        }
      }

      // Process boss status effects
      const bossEffects = StatusEffectManager.processTurnEffects(boss);
      if (bossEffects.messages.length > 0) {
        log += '\n' + bossEffects.messages.join('\n') + '\n';
      }

      // Boss counter-attack (if not stunned)
      if (bossEffects.canAct) {
        const { atkMod: bossAtkMod } = StatusEffectManager.getStatModifiers(boss);
        const bossDmg = Math.max(1, Math.floor(boss.atk * bossAtkMod - (player.stats.def || 0) * 0.3));
        player.stats.hp = Math.max(0, player.stats.hp - bossDmg);
        log += `
🐉 ${boss.name} retaliates!
`;
        log += `💔 You take ${bossDmg} damage!
`;

        // Boss randomly inflicts a status effect (20% chance)
        const bossStatusEffects = ['poison','burn','bleed','weaken','blind','slow'];
        if (Math.random() < 0.2) {
          const effect = bossStatusEffects[Math.floor(Math.random() * bossStatusEffects.length)];
          if (StatusEffectManager.applyEffect(player, effect, 2)) {
            log += `🌀 ${boss.name} inflicts ${effect} on you!
`;
          }
        }
      } else {
        log += `
⭐ ${boss.name} is stunned and cannot attack!
`;
      }

      log += `━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

      // Show player status effects
      const playerStatusStr = StatusEffectManager.formatStatus(player);
      const bossStatusStr = StatusEffectManager.formatStatus(boss);

      const bossHPBar = BarSystem.getMonsterHPBar(boss.hp, boss.maxHp);
      log += `${boss.emoji} ${bossHPBar}
`;
      log += `❤️ Boss HP: ${boss.hp}/${boss.maxHp}
`;
      if (bossStatusStr) log += `💫 Boss: ${bossStatusStr}
`;
      log += `👤 Your HP: ${player.stats.hp}/${player.stats.maxHp}
`;
      if (playerStatusStr) log += `💫 You: ${playerStatusStr}
`;
      log += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      battle.turn = (battle.turn || 0) + 1;

      // Player died
      if (player.stats.hp <= 0) {
        player.stats.hp = 1;
        player.dungeon.currentBattle = null;
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: log + `

💀 You were knocked out of the raid! Others can continue.
Use /revive to rejoin.`
        }, { quoted: msg });
      }

      // Boss defeated — VICTORY
      if (boss.hp <= 0) {
        player.dungeon.currentBattle = null;

        // Base rewards
        const goldReward    = 50000 + (player.level * 2000);
        const crystalReward = 200  + (player.level * 10);
        const xpReward      = 800  + (player.level * 50);

        player.gold           = (player.gold || 0) + goldReward;
        player.manaCrystals   = (player.manaCrystals || 0) + crystalReward;
        player.xp             = (player.xp || 0) + xpReward;
        LevelUpManager.checkAndApplyLevelUps(player, saveDatabase, sock, chatId);
        if (!player.inventory)       player.inventory = {};
        if (!player.inventory.items) player.inventory.items = [];

        // Track boss kill for achievements + auto daily/weekly quests
        try {
          const raidAchi = AchievementManager.track(player, 'boss_kill', 1);
          if (raidAchi.length > 0) {
            await sock.sendMessage(chatId, { text: AchievementManager.buildNotification(raidAchi) }, { quoted: msg });
          }
        } catch(e) {}

        // Generate loot drops
        const drops = [];

        // Pet food drop (60% chance, 1-3 pieces) — prefer rare/epic foods
        if (Math.random() < 0.6) {
          const foodNames = Object.keys(PET_FOOD);
          const goodFoods = foodNames.filter(n => ['rare','epic','legendary'].includes(PET_FOOD[n].rarity));
          const pool = goodFoods.length > 0 ? goodFoods : foodNames;
          const foodCount = 1 + Math.floor(Math.random() * 2);
          for (let i = 0; i < foodCount; i++) {
            const foodName = pool[Math.floor(Math.random() * pool.length)];
            const foodData = PET_FOOD[foodName];
            player.inventory.items.push({ name: foodName, type: 'petfood', ...foodData });
            drops.push(`🐾 ${foodName} (${foodData.rarity})`);
          }
        }

        // Gear drop (50% chance) — prefer rare+ gear
        if (Math.random() < 0.5) {
          const slots = ['weapon','chest','helmet','ring','gloves','boots'];
          const rarities = ['rare','epic','legendary'];
          const rarity = rarities[Math.floor(Math.random() * rarities.length)];
          const slot = slots[Math.floor(Math.random() * slots.length)];
          const gear = getRandomGear(slot, rarity);
          if (gear) {
            player.inventory.items.push({ ...gear, type: 'gear', equipped: false, durability: gear.maxDurability || 100 });
            drops.push(`⚔️ ${gear.name} (${gear.rarity})`);
          }
        }

        // Consumable item drop (70% chance)
        if (Math.random() < 0.7) {
          const items = [
            { name: 'Giant HP Potion', type: 'item', effect: 'hp', healAmount: 200, rarity: 'rare' },
            { name: 'Mega Energy Potion', type: 'item', effect: 'energy', healAmount: 100, rarity: 'rare' },
            { name: 'Elixir of Power', type: 'item', effect: 'buff', buffStat: 'atk', buffAmount: 20, duration: 3, rarity: 'epic' },
            { name: 'Shield Charm', type: 'item', effect: 'buff', buffStat: 'def', buffAmount: 20, duration: 3, rarity: 'epic' },
          ];
          const item = items[Math.floor(Math.random() * items.length)];
          player.inventory.items.push({ ...item });
          drops.push(`🧪 ${item.name} (${item.rarity})`);
        }

        let dropText = drops.length > 0 ? drops.map(d => `   ${d}`).join('\n') : '   (No bonus drops this time)';

        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 RAID BOSS DEFEATED! 🏆
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${boss.emoji} ${boss.name} has fallen!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 +${goldReward} Nexus
💎 +${crystalReward} Mana Stones
✨ +${xpReward} XP
⭐ +${upReward.awarded} Upgrade Points! (Total: ${upReward.total} UP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 BONUS DROPS:
${dropText}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Congratulations ${player.name}!`
        }, { quoted: msg });
      }

      saveDatabase();
      return sock.sendMessage(chatId, { text: log }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // GUILD POINTS — view GP and WP
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'points' || action === 'gp' || action === 'wp') {
      const GPS = require('../../rpg/utils/GuildPointsSystem');
      const pg = GPS.findPlayerGuild(sender, db);
      if (!pg) return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });
      return sock.sendMessage(chatId, { text: GPS.formatGuildPoints(pg) }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // GUILD CONTRIBUTE — donate Nexus to guild treasury, earn GP
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'contribute' || action === 'donate') {
      const GPS = require('../../rpg/utils/GuildPointsSystem');
      const pg = GPS.findPlayerGuild(sender, db);
      if (!pg) return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });

      const amount = parseInt(args[1]);
      if (!amount || amount < 1000) return sock.sendMessage(chatId, {
        text: '💠 Donate to guild treasury!\n/guild contribute <amount>\nMinimum: 1,000 Nexus'
      }, { quoted: msg });

      if ((player.gold||0) < amount) return sock.sendMessage(chatId, {
        text: '❌ Not enough Nexus! Need: ' + amount.toLocaleString()
      }, { quoted: msg });

      player.gold = (player.gold||0) - amount;
      if (!pg.treasury) pg.treasury = 0;
      pg.treasury += amount;
      const gpEarned = GPS.onDonation(pg, amount);
      try { const DQ=require('../../rpg/utils/DailyQuestSystem'); DQ.trackQuestProgress(player,'donate',1); } catch(e) {}
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: '🏰 *GUILD CONTRIBUTION*\n💠 Donated: ' + amount.toLocaleString() + ' Nexus\n' + (gpEarned>0?'🏅 Guild earned: +'+gpEarned+' GP':'') + '\n/guild points — view GP & WP'
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // GUILD SHOP
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'shop') {
      const playerGuild = Object.values(db.guilds).find(g => 
        g.members && g.members.some(m => m.id === sender)
      );

      if (!playerGuild) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' });
      }

      const shop = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 GUILD SHOP 🏰
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 ${playerGuild.name}
💠 Treasury: ${playerGuild.treasury || 0} Nexus
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ GUILD BUFFS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. XP Boost - 1000 Nexus
   +10% XP for all members (24h)
   
2. Nexus Boost - 1000 Nexus
   +10% Nexus for all members (24h)
   
3. Raid Power - 2000 Nexus
   +15% Damage in raids (24h)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 USAGE (Leader/Officer only)
/guild buy [number]
Example: /guild buy 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: shop });
    }

    // ═══════════════════════════════════════════════════════════════════
    // BUY FROM GUILD SHOP
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'buy') {
      const playerGuild = Object.values(db.guilds).find(g => 
        g.members && g.members.some(m => m.id === sender)
      );

      if (!playerGuild) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' });
      }

      const member = playerGuild.members.find(m => m.id === sender);
      if (!member || (member.rank !== 'Leader' && member.rank !== 'Officer')) {
        return sock.sendMessage(chatId, { text: '❌ Only Leader/Officers can buy guild buffs!' });
      }

      const itemNum = parseInt(args[1]);

      if (!itemNum || itemNum < 1 || itemNum > 3) {
        return sock.sendMessage(chatId, { text: '❌ Invalid item!\n\nChoose 1, 2, or 3\nExample: /guild buy 1' });
      }

      const items = {
        1: { name: 'XP Boost', cost: 1000, buff: 'xp', value: 0.1, duration: 24 * 60 * 60 * 1000 },
        2: { name: 'Nexus Boost', cost: 1000, buff: 'gold', value: 0.1, duration: 24 * 60 * 60 * 1000 },
        3: { name: 'Raid Power', cost: 2000, buff: 'raid', value: 0.15, duration: 24 * 60 * 60 * 1000 }
      };

      const item = items[itemNum];
      const treasury = playerGuild.treasury || 0;

      if (treasury < item.cost) {
        return sock.sendMessage(chatId, { text: `❌ Not enough Nexus in treasury!\n\nNeed: ${item.cost} 💠\nHave: ${treasury} 💠\n\nUse /guild donate to add Nexus!` });
      }

      // Deduct from treasury
      playerGuild.treasury = treasury - item.cost;

      // Add buff to guild
      if (!playerGuild.buffs) playerGuild.buffs = [];
      
      playerGuild.buffs.push({
        type: item.buff,
        value: item.value,
        endsAt: Date.now() + item.duration
      });

      saveDatabase();

      // Notify all members
      const notification = `🏰 GUILD BUFF ACTIVATED! 🏰\n\n✨ ${item.name}\n⏰ Duration: 24 hours\n\n${member.name} purchased this buff!`;
      
      if (playerGuild.members) {
        for (const guildMember of playerGuild.members) {
          try {
            await sock.sendMessage(guildMember.id, { text: notification });
          } catch (e) {}
        }
      }

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ BUFF PURCHASED! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ ${item.name}
💠 Cost: ${item.cost} Nexus
⏰ Duration: 24 hours
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 Treasury Left: ${playerGuild.treasury} Nexus
━━━━━━━━━━━━━━━━━━━━━━━━━━━
All guild members have been notified! 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      });
    }

    return sock.sendMessage(chatId, {
      text: '❌ Invalid command!\n\nUse /guild for menu.'
    });
  }
};