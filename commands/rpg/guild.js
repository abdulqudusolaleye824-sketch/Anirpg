const Perms = require('../../utils/permissions');
const BarSystem = require('../../rpg/utils/BarSystem');
const LevelUpManager = require('../../rpg/utils/LevelUpManager');
const { GEAR_CATALOG, getRandomGear } = require('../../rpg/utils/GearCatalog');
const { PET_FOOD } = require('../../rpg/utils/PetDatabase');
const StatusEffectManager = require('../../rpg/utils/StatusEffectManager');
const StatAllocationSystem = require('../../rpg/utils/StatAllocationSystem');
const AchievementManager = require('../../rpg/utils/AchievementManager');
const CM = require('../../rpg/utils/GuildContractManager');

// Helper: Calculate max member capacity based on size level
function getMaxMembers(guild) {
  const sizeLvl = guild?.sizeLevel || 1;
  return sizeLvl * 10; // Level 1: 10, Level 2: 20, Level 3: 30, Level 4: 40, Level 5: 50
}

// Helper: Calculate shop discount % based on shop level
function getShopDiscount(guild) {
  const shopLvl = guild?.shopLevel || 0;
  return shopLvl * 5; // Level 0: 0%, Level 1: 5%, Level 2: 10%, Level 3: 15%, Level 4: 20%, Level 5: 25%
}

// Upgrade Cost Tables (spent from Guild Treasury)
const SIZE_UPGRADE_COSTS = {
  1: { nexus: 100000, mana: 5000, targetMembers: 20 },
  2: { nexus: 250000, mana: 15000, targetMembers: 30 },
  3: { nexus: 500000, mana: 30000, targetMembers: 40 },
  4: { nexus: 1000000, mana: 60000, targetMembers: 50 },
};

const SHOP_UPGRADE_COSTS = {
  0: { nexus: 50000, mana: 2500, targetDiscount: 5 },
  1: { nexus: 150000, mana: 7500, targetDiscount: 10 },
  2: { nexus: 350000, mana: 17500, targetDiscount: 15 },
  3: { nexus: 700000, mana: 35000, targetDiscount: 20 },
  4: { nexus: 1500000, mana: 75000, targetDiscount: 25 },
};

// Guild Shop Exclusive Catalog
const GUILD_SHOP_CATALOG = [
  // Pet Food
  { id: 'pet_food_royal', name: 'Royal Monster Feed', type: 'pet_food', category: 'Pet Food', basePrice: 5000, description: 'Restores 100 pet hunger and +20 happiness' },
  { id: 'pet_food_beast', name: 'Beast Feast', type: 'pet_food', category: 'Pet Food', basePrice: 12000, description: 'Restores 100 pet hunger and +50 happiness' },
  { id: 'pet_food_elixir', name: 'Elixir of Growth', type: 'pet_food', category: 'Pet Food', basePrice: 25000, description: 'Gives pet massive XP bonus' },

  // Attack Patterns
  { id: 'pattern_dragon', name: 'Dragon\'s Breath', type: 'pattern', category: 'Attack Pattern', basePrice: 50000, description: 'High-damage fire AOE attack pattern' },
  { id: 'pattern_shadow', name: 'Shadow Strike', type: 'pattern', category: 'Attack Pattern', basePrice: 100000, description: 'Critical lethal shadow assassination pattern' },
  { id: 'pattern_celestial', name: 'Celestial Slash', type: 'pattern', category: 'Attack Pattern', basePrice: 250000, description: 'Ultimate divine slash attack pattern' },

  // Potions
  { id: 'potion_supreme_hp', name: 'Supreme Health Elixir', type: 'potion', category: 'Potion', basePrice: 10000, description: 'Restores 100% max HP in battle' },
  { id: 'potion_mega_mana', name: 'Mega Mana Potion', type: 'potion', category: 'Potion', basePrice: 10000, description: 'Restores 100% energy in battle' },
  { id: 'potion_full_rec', name: 'Full Recovery Tonic', type: 'potion', category: 'Potion', basePrice: 25000, description: 'Full HP + Energy recovery + cleanse debuffs' }
];

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
    // /guild list — Table of all registered guilds
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'list') {
      const allGuilds = Object.values(db.guilds || {});
      if (allGuilds.length === 0) {
        return sock.sendMessage(chatId, { text: '🏰 *REGISTERED GUILDS*\n\nNo guilds have been created yet. Create one with /guild create [name]!' }, { quoted: msg });
      }

      const lines = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🏰 *REGISTERED GUILDS (${allGuilds.length})*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ];

      allGuilds.forEach((g, i) => {
        const leaderUser = db.users?.[g.leader];
        const leaderName = leaderUser?.name || g.leader.split('@')[0];
        const maxM = getMaxMembers(g);
        const count = g.members?.length || 0;
        const sizeLvl = g.sizeLevel || 1;
        const shopLvl = g.shopLevel || 0;
        const disc = getShopDiscount(g);

        lines.push(`*${i+1}. ${g.name}*`);
        lines.push(`   👑 Guildmaster: *${leaderName}*`);
        lines.push(`   👥 Hunters: *${count}/${maxM}* (Size Lv.${sizeLvl})`);
        lines.push(`   🛍️ Guild Shop: *${shopLvl > 0 ? `Lv.${shopLvl} (${disc}% OFF)` : 'Locked'}*`);
        lines.push(`   💠 Treasury: ${(g.treasury || 0).toLocaleString()} Nexus | ${(g.manaTreasury || 0).toLocaleString()} 💎`);
        lines.push(``);
      });

      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

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

      const maxCap = getMaxMembers(guild);
      if (guild.members.length >= maxCap) {
        delete db.pendingGuildHires[sender];
        return sock.sendMessage(chatId, { text: `❌ That guild is full (${guild.members.length}/${maxCap} members).` }, { quoted: msg });
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
• /guild list          - View all registered guilds
• /guild create [name] - Create a guild (500,000💠 + 10,000💎 | Lv.20)
• /guild join [name]   - Join an existing guild

🏆 GUILD BENEFITS:
- Guild size upgrades (up to 50 members)
- Exclusive Guild Shop (up to 25% discount)
- Shared treasury & Guild Wars!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      const leader = db.users[playerGuild.leader];
      const maxM   = getMaxMembers(playerGuild);
      const sizeL  = playerGuild.sizeLevel || 1;
      const shopL  = playerGuild.shopLevel || 0;
      const disc   = getShopDiscount(playerGuild);

      const info = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 GUILD INFO 🏰
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 Name: ${playerGuild.name}
👑 Leader: ${leader?.name || 'Unknown'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 Members: ${playerGuild.members.length}/${maxM} (Size Lv.${sizeL})
🛍️ Guild Shop: ${shopL > 0 ? `Lv.${shopL} (${disc}% OFF)` : 'Locked'}
💠 Treasury: ${(playerGuild.treasury || 0).toLocaleString()} Nexus
💎 Treasury: ${(playerGuild.manaTreasury || 0).toLocaleString()} Mana Stones
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 STATS & UPGRADES
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 Raids Completed: ${playerGuild.totalRaids || 0}
⚔️ Wars Fought: ${playerGuild.totalWars || 0}
🏆 Wars Won: ${playerGuild.wins || 0}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 /guild upgrade      - Upgrade size or shop
📌 /guild shop         - Guild exclusive shop
📌 /guild members      - List all members
📌 /guild list         - List all guilds
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
        sizeLevel: 1,  // Base 10 members
        shopLevel: 0,  // Base Locked
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
👥 Members: 1/10 (Size Lv.1)
🛍️ Guild Shop: Locked (Unlock with /guild upgrade shop)
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
      const maxCap = getMaxMembers(guild);
      
      if (guild.members.length >= maxCap) {
        return sock.sendMessage(chatId, {
          text: `❌ Guild is at max capacity (${guild.members.length}/${maxCap} members)!\nAsk Guild Officers to upgrade size with /guild upgrade size.`
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
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ JOINED GUILD! ✅\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏰 ${guild.name}\n👥 Members: ${guild.members.length}/${maxCap}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      });

      if (guild.leader) {
        try {
          await sock.sendMessage(guild.leader, {
            text: `🏰 ${player.name} joined your guild!\n\nMembers: ${guild.members.length}/${maxCap}`,
            mentions: [sender]
          });
        } catch (e) {}
      }

      return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // GUILD UPGRADE CENTER
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'upgrade' || action === 'up') {
      if (!playerGuild) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });
      }

      const sub = (args[1] || '').toLowerCase();
      const currentSizeLvl = playerGuild.sizeLevel || 1;
      const currentShopLvl = playerGuild.shopLevel || 0;

      // View upgrade menu
      if (!sub) {
        const nextSize = SIZE_UPGRADE_COSTS[currentSizeLvl];
        const nextShop = SHOP_UPGRADE_COSTS[currentShopLvl];

        const sizeTxt = nextSize
          ? `Lv.${currentSizeLvl} (${currentSizeLvl * 10} members) → Lv.${currentSizeLvl + 1} (${nextSize.targetMembers} members)\n   Cost: 💠 ${nextSize.nexus.toLocaleString()} Nexus + 💎 ${nextSize.mana.toLocaleString()} Mana Stones\n   Cmd: /guild upgrade size`
          : `Lv.5 (MAX: 50 members) ✅`;

        const shopTxt = nextShop
          ? `${currentShopLvl === 0 ? 'Locked (0%)' : `Lv.${currentShopLvl} (${currentShopLvl * 5}%)`} → Lv.${currentShopLvl + 1} (${nextShop.targetDiscount}% discount)\n   Cost: 💠 ${nextShop.nexus.toLocaleString()} Nexus + 💎 ${nextShop.mana.toLocaleString()} Mana Stones\n   Cmd: /guild upgrade shop`
          : `Lv.5 (MAX: 25% discount) ✅`;

        return sock.sendMessage(chatId, {
          text: [
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🏰 *GUILD UPGRADE CENTER*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🏰 Guild: *${playerGuild.name}*`,
            `💠 Treasury: *${(playerGuild.treasury || 0).toLocaleString()} Nexus*`,
            `💎 Treasury: *${(playerGuild.manaTreasury || 0).toLocaleString()} Mana Stones*`,
            ``,
            `📈 *1. GUILD SIZE / CAPACITY:*`,
            `   ${sizeTxt}`,
            ``,
            `🛍️ *2. GUILD SHOP & EXCLUSIVE DISCOUNT:*`,
            `   ${shopTxt}`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `📌 *Guildmaster / Vice GM:* Run /guild upgrade size or /guild upgrade shop to upgrade from Treasury!`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ].join('\n'),
        }, { quoted: msg });
      }

      if (!CM.isGuildMasterOrVice(db, playerGuild.name, sender)) {
        return sock.sendMessage(chatId, { text: '❌ Only the Guildmaster or Vice Guildmaster can upgrade the guild.' }, { quoted: msg });
      }

      // Upgrade Size
      if (sub === 'size' || sub === 'capacity') {
        if (currentSizeLvl >= 5) {
          return sock.sendMessage(chatId, { text: '❌ Guild Size is already at MAX level (Level 5: 50 members)!' }, { quoted: msg });
        }

        const cost = SIZE_UPGRADE_COSTS[currentSizeLvl];
        const treasuryNexus = playerGuild.treasury || 0;
        const treasuryMana  = playerGuild.manaTreasury || 0;

        if (treasuryNexus < cost.nexus || treasuryMana < cost.mana) {
          return sock.sendMessage(chatId, {
            text: `❌ Insufficient Guild Treasury funds!\nNeed: 💠 ${cost.nexus.toLocaleString()} Nexus & 💎 ${cost.mana.toLocaleString()} Mana Stones\nTreasury has: 💠 ${treasuryNexus.toLocaleString()} Nexus & 💎 ${treasuryMana.toLocaleString()} Mana Stones`
          }, { quoted: msg });
        }

        playerGuild.treasury -= cost.nexus;
        playerGuild.manaTreasury -= cost.mana;
        playerGuild.sizeLevel = currentSizeLvl + 1;

        saveDatabase();

        return sock.sendMessage(chatId, {
          text: [
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🎉 *GUILD SIZE UPGRADED!*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🏰 Guild: *${playerGuild.name}*`,
            `📈 Level: *Level ${playerGuild.sizeLevel}*`,
            `👥 Max Members: *${playerGuild.sizeLevel * 10} members*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ].join('\n'),
        }, { quoted: msg });
      }

      // Upgrade Shop
      if (sub === 'shop') {
        if (currentShopLvl >= 5) {
          return sock.sendMessage(chatId, { text: '❌ Guild Shop is already at MAX level (Level 5: 25% discount)!' }, { quoted: msg });
        }

        const cost = SHOP_UPGRADE_COSTS[currentShopLvl];
        const treasuryNexus = playerGuild.treasury || 0;
        const treasuryMana  = playerGuild.manaTreasury || 0;

        if (treasuryNexus < cost.nexus || treasuryMana < cost.mana) {
          return sock.sendMessage(chatId, {
            text: `❌ Insufficient Guild Treasury funds!\nNeed: 💠 ${cost.nexus.toLocaleString()} Nexus & 💎 ${cost.mana.toLocaleString()} Mana Stones\nTreasury has: 💠 ${treasuryNexus.toLocaleString()} Nexus & 💎 ${treasuryMana.toLocaleString()} Mana Stones`
          }, { quoted: msg });
        }

        playerGuild.treasury -= cost.nexus;
        playerGuild.manaTreasury -= cost.mana;
        playerGuild.shopLevel = currentShopLvl + 1;

        saveDatabase();

        const disc = playerGuild.shopLevel * 5;
        return sock.sendMessage(chatId, {
          text: [
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🎉 *GUILD SHOP UPGRADED!*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🏰 Guild: *${playerGuild.name}*`,
            `🛍️ Level: *Level ${playerGuild.shopLevel}*`,
            `🏷️ Member Discount: *${disc}% OFF* on all Guild Shop exclusive items!`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `📌 Access shop with /guild shop!`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ].join('\n'),
        }, { quoted: msg });
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // GUILD EXCLUSIVE SHOP
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'shop') {
      if (!playerGuild) {
        return sock.sendMessage(chatId, { text: '❌ You must belong to a guild to access the Guild Shop!' }, { quoted: msg });
      }

      const shopLvl = playerGuild.shopLevel || 0;
      if (shopLvl === 0) {
        return sock.sendMessage(chatId, {
          text: [
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🔒 *GUILD SHOP LOCKED*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🏰 Guild: *${playerGuild.name}*`,
            `⚠️ The Guild Shop has not been unlocked yet!`,
            ``,
            `💡 Guild Officers can unlock it with:`,
            `   */guild upgrade shop*`,
            `   (Cost: 💠 50,000 Nexus & 💎 2,500 Mana Stones)`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ].join('\n'),
        }, { quoted: msg });
      }

      const discountPct = shopLvl * 5; // 5%, 10%, 15%, 20%, 25%
      const sub = (args[1] || 'list').toLowerCase();

      // /guild shop buy <item_id>
      if (sub === 'buy') {
        const itemId = (args[2] || '').toLowerCase();
        const item = GUILD_SHOP_CATALOG.find(i => i.id.toLowerCase() === itemId || i.name.toLowerCase().includes(itemId));

        if (!item) {
          return sock.sendMessage(chatId, {
            text: `❌ Item not found! Usage: /guild shop buy <item_id>\nExample: /guild shop buy pet_food_royal`
          }, { quoted: msg });
        }

        const finalPrice = Math.floor(item.basePrice * (1 - discountPct / 100));
        const playerGold = player.gold || 0;

        if (playerGold < finalPrice) {
          return sock.sendMessage(chatId, {
            text: `❌ Insufficient Nexus balance!\nItem Cost: 💠 ${finalPrice.toLocaleString()} Nexus (${discountPct}% OFF)\nYou have: 💠 ${playerGold.toLocaleString()} Nexus`
          }, { quoted: msg });
        }

        player.gold = playerGold - finalPrice;
        if (player.inventory) player.inventory.gold = player.gold;

        // Add item to player inventory
        if (!player.inventory) player.inventory = {};
        if (item.type === 'pet_food') {
          if (!player.inventory.petFood) player.inventory.petFood = {};
          player.inventory.petFood[item.id] = (player.inventory.petFood[item.id] || 0) + 1;
        } else if (item.type === 'pattern') {
          if (!player.inventory.patterns) player.inventory.patterns = [];
          player.inventory.patterns.push({ ...item, boughtAt: Date.now() });
        } else {
          if (!player.inventory.potions) player.inventory.potions = [];
          player.inventory.potions.push({ ...item, boughtAt: Date.now() });
        }

        saveDatabase();

        return sock.sendMessage(chatId, {
          text: [
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🛍️ *GUILD SHOP PURCHASE*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🎁 Item: *${item.name}*`,
            `🏷️ Guild Discount: *${discountPct}% OFF*`,
            `💠 Price Paid: *${finalPrice.toLocaleString()} Nexus*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `✅ Added to your inventory!`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ].join('\n'),
        }, { quoted: msg });
      }

      // Display Guild Shop Catalog
      const lines = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🛍️ *GUILD SHOP EXCLUSIVES*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🏰 Guild: *${playerGuild.name}* (Shop Lv.${shopLvl})`,
        `🏷️ Active Member Discount: *${discountPct}% OFF*`,
        `💠 Your Balance: *${(player.gold || 0).toLocaleString()} Nexus*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ];

      GUILD_SHOP_CATALOG.forEach((item, i) => {
        const finalPrice = Math.floor(item.basePrice * (1 - discountPct / 100));
        lines.push(`*${i+1}. ${item.name}* [\`${item.id}\`]`);
        lines.push(`   📂 Category: ${item.category}`);
        lines.push(`   💰 Price: ~💠 ${item.basePrice.toLocaleString()}~ → *💠 ${finalPrice.toLocaleString()} Nexus* (${discountPct}% OFF)`);
        lines.push(`   📝 ${item.description}`);
        lines.push(``);
      });

      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`📌 Buy item: */guild shop buy <item_id>*`);
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
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

      const maxM = getMaxMembers(playerGuild);
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
      memberList += `Total: ${playerGuild.members.length}/${maxM}`;

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
    // Syntax: /guild hire @user <nexus> | <mana> || <weeks>
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

      const fullText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '');
      
      // Strip command, mentions, and target phone digits before parsing numbers
      let cleanText = fullText.replace(/^\/guild\s+hire/i, '').replace(/@\d+/g, '').trim();
      const targetDigits = String(targetId).replace(/[^0-9]/g, '');
      if (targetDigits) {
        cleanText = cleanText.replace(new RegExp(targetDigits, 'g'), '').trim();
      }

      let weeklyNexus = 500;
      let weeklyMana  = 10;
      let weeks       = 4;

      if (cleanText.includes('||')) {
        const [wagePart, weeksPart] = cleanText.split('||').map(s => s.trim());
        if (weeksPart) {
          const w = parseInt(weeksPart.match(/\d+/)?.[0]);
          if (!isNaN(w) && w > 0) weeks = w;
        }
        if (wagePart) {
          if (wagePart.includes('|')) {
            const [nStr, mStr] = wagePart.split('|').map(s => s.trim());
            const n = parseInt(nStr.match(/\d+/)?.[0]);
            const m = parseInt(mStr.match(/\d+/)?.[0]);
            if (!isNaN(n) && n >= 0) weeklyNexus = n;
            if (!isNaN(m) && m >= 0) weeklyMana = m;
          } else {
            const n = parseInt(wagePart.match(/\d+/)?.[0]);
            if (!isNaN(n) && n >= 0) weeklyNexus = n;
          }
        }
      } else if (cleanText.includes('|')) {
        const parts = cleanText.split('|').map(s => s.trim());
        if (parts[0]) {
          const n = parseInt(parts[0].match(/\d+/)?.[0]);
          if (!isNaN(n) && n >= 0) weeklyNexus = n;
        }
        if (parts[1]) {
          const m = parseInt(parts[1].match(/\d+/)?.[0]);
          if (!isNaN(m) && m >= 0) weeklyMana = m;
        }
        if (parts[2]) {
          const w = parseInt(parts[2].match(/\d+/)?.[0]);
          if (!isNaN(w) && w > 0) weeks = w;
        }
      } else {
        const nums = (cleanText.match(/\d+/g) || []).map(Number);
        if (nums.length >= 1 && !isNaN(nums[0])) weeklyNexus = nums[0];
        if (nums.length >= 2 && !isNaN(nums[1])) weeklyMana = nums[1];
        if (nums.length >= 3 && !isNaN(nums[2])) weeks = nums[2];
      }

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
