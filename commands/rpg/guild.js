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

// Master Regular Shop Pool for Guild Shop daily rotation
const REGULAR_SHOP_POOL = [
  // Potions & Consumables (Nexus)
  { id: 'lower_health_potion', name: 'Lower Health Potion', category: 'Potions', type: 'potion', currency: 'gold', basePrice: 800, description: 'Restores 10% HP', key: 'lowerHealthPotions' },
  { id: 'medium_health_potion', name: 'Medium Health Potion', category: 'Potions', type: 'potion', currency: 'gold', basePrice: 5000, description: 'Restores 25% HP', key: 'mediumHealthPotions' },
  { id: 'higher_health_potion', name: 'Higher Health Potion', category: 'Potions', type: 'potion', currency: 'gold', basePrice: 7000, description: 'Restores 50% HP', key: 'higherHealthPotions' },
  { id: 'health_potion', name: 'Health Potion', category: 'Potions', type: 'potion', currency: 'gold', basePrice: 800, description: 'Restores 10% HP', key: 'lowerHealthPotions' },
  { id: 'revive_token', name: 'Revive Token', category: 'Potions', type: 'potion', currency: 'gold', basePrice: 3000, description: 'Auto-revives once in dungeon', key: 'reviveTokens' },
  { id: 'luck_potion', name: 'Luck Potion', category: 'Potions', type: 'potion', currency: 'gold', basePrice: 2000, description: '+25% catch rate & casino odds', key: 'luckPotion' },
  { id: 'xp_booster', name: 'XP Booster', category: 'Potions', type: 'potion', currency: 'gold', basePrice: 5000, description: '+50% XP for 3 battles', key: 'xpBooster' },
  { id: 'nexus_mult', name: 'Nexus Multiplier', category: 'Potions', type: 'potion', currency: 'gold', basePrice: 8000, description: 'Next 3 wins give 2x gold', key: 'goldMult' },
  { id: 'shield_scroll', name: 'Shield Scroll', category: 'Potions', type: 'potion', currency: 'gold', basePrice: 4000, description: 'Absorbs one hit in next fight', key: 'shieldScroll' },
  { id: 'might_elixir', name: 'Elixir of Might', category: 'Potions', type: 'potion', currency: 'gold', basePrice: 12000, description: '+20 ATK for next 5 battles', key: 'mightElixir' },

  // Pet Food (Nexus)
  { id: 'pet_food_kibble', name: 'Monster Kibble', category: 'Pet Food', type: 'pet_food', currency: 'gold', basePrice: 500, description: 'Restores 30 pet hunger' },
  { id: 'pet_food_royal', name: 'Royal Monster Feed', category: 'Pet Food', type: 'pet_food', currency: 'gold', basePrice: 5000, description: 'Restores 100 pet hunger and +20 happiness' },
  { id: 'pet_food_beast', name: 'Beast Feast', category: 'Pet Food', type: 'pet_food', currency: 'gold', basePrice: 12000, description: 'Restores 100 pet hunger and +50 happiness' },
  { id: 'pet_food_elixir', name: 'Elixir of Growth', category: 'Pet Food', type: 'pet_food', currency: 'gold', basePrice: 25000, description: 'Gives pet massive XP bonus' },

  // Stat Orbs & Special (Mana Stones)
  { id: 'power_ring', name: 'Power Ring', category: 'Stat Orbs', type: 'stat', currency: 'crystals', basePrice: 500, description: '+5 ATK permanently', stat: 'atk', amount: 5 },
  { id: 'guardian_amulet', name: 'Guardian Amulet', category: 'Stat Orbs', type: 'stat', currency: 'crystals', basePrice: 500, description: '+5 DEF permanently', stat: 'def', amount: 5 },
  { id: 'vitality_orb', name: 'Vitality Orb', category: 'Stat Orbs', type: 'stat', currency: 'crystals', basePrice: 600, description: '+20 Max HP permanently', stat: 'hp', amount: 20 },
  { id: 'swift_boots', name: 'Swift Boots', category: 'Stat Orbs', type: 'stat', currency: 'crystals', basePrice: 700, description: '+8 SPD permanently', stat: 'spd', amount: 8 },
  { id: 'crit_gem', name: 'Crit Gem', category: 'Stat Orbs', type: 'stat', currency: 'crystals', basePrice: 800, description: '+3% Crit permanently', stat: 'crit', amount: 3 },
  { id: 'summon_ticket', name: 'Summon Ticket', category: 'Special', type: 'ticket', currency: 'crystals', basePrice: 120, description: '1 gacha summon pull', amount: 1 },

  // Bundles (Nexus)
  { id: 'starter_pack', name: 'Starter Pack', category: 'Bundles', type: 'bundle', currency: 'gold', basePrice: 5000, description: '5 HP Pots + 5 Energy Pots + 1 Revive Token', bundleId: 1 },
  { id: 'dungeon_kit', name: 'Dungeon Kit', category: 'Bundles', type: 'bundle', currency: 'gold', basePrice: 18000, description: '10 HP Pots + 5 Revives + 1 XP Booster', bundleId: 2 },
  { id: 'pvp_bundle', name: 'PvP Bundle', category: 'Bundles', type: 'bundle', currency: 'gold', basePrice: 20000, description: 'Elixir of Might + Shield Scroll + 2 Luck Potions', bundleId: 3 },

  // Attack Patterns (Nexus)
  { id: 'pattern_dragon', name: 'Dragon\'s Breath', category: 'Attack Patterns', type: 'pattern', currency: 'gold', basePrice: 50000, description: 'High-damage fire AOE attack pattern' },
  { id: 'pattern_shadow', name: 'Shadow Strike', category: 'Attack Patterns', type: 'pattern', currency: 'gold', basePrice: 100000, description: 'Critical lethal shadow assassination pattern' },

  // Recipe Scrolls (Mana Stones)
  { id: 'scroll_common', name: 'Common Recipe Scroll', category: 'Scrolls', type: 'scroll', currency: 'crystals', basePrice: 500, description: 'Unlocks Common craft recipe', rarity: 'common' },
  { id: 'scroll_rare', name: 'Rare Recipe Scroll', category: 'Scrolls', type: 'scroll', currency: 'crystals', basePrice: 2000, description: 'Unlocks Rare craft recipe', rarity: 'rare' }
];

function ensureGuildShopFresh(guild) {
  const todayKey = new Date(Date.now() + 3600000).toISOString().slice(0, 10);
  if (guild.dailyShop && guild.dailyShop.dateKey === todayKey && Array.isArray(guild.dailyShop.items) && guild.dailyShop.items.length === 10) {
    return guild.dailyShop.items;
  }

  let seed = 0;
  const str = todayKey + (guild.name || 'guild');
  for (let i = 0; i < str.length; i++) {
    seed = (seed * 31 + str.charCodeAt(i)) % 2147483647;
  }

  function seededRandom() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  const poolCopy = [...REGULAR_SHOP_POOL];
  for (let i = poolCopy.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [poolCopy[i], poolCopy[j]] = [poolCopy[j], poolCopy[i]];
  }

  const selected = poolCopy.slice(0, 10).map(item => ({
    ...item,
    unitsLeft: 5,
    maxUnits: 5
  }));

  guild.dailyShop = {
    dateKey: todayKey,
    items: selected
  };

  return selected;
}

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
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

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

    // Push #71: merge duplicate guild records, purge the '[object Object]'
    // contract bucket the #70 kick bug created, then resolve the player's guild
    // through the SAME resolver every money path uses → /guild info is live.
    const _CM71 = require('../../rpg/utils/GuildContractManager');
    try {
      const _m = _CM71.mergeDuplicateGuilds(db);
      if (_m.length) console.log('[guild] merged duplicate guild records:', JSON.stringify(_m));
      if (db.guildContracts && db.guildContracts['[object Object]']) delete db.guildContracts['[object Object]'];
    } catch (e) {}
    const playerGuild = _CM71.resolvePlayerGuild(db, sender, player);

    // ═══════════════════════════════════════════════════════════════════
    // /guild list — Table of all registered guilds
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'list') {
      const allGuilds = Object.values(db.guilds || {});
      if (allGuilds.length === 0) {
        return sock.sendMessage(chatId, { text: '🏰 *REGISTERED GUILDS*\n\nNo guilds have been created yet. Create one with /guild create [name]!' }, { quoted: msg });
      }

      const lines = [
        `${FRAME}`,
        `🏰 *REGISTERED GUILDS (${allGuilds.length})*`,
        `${FRAME}`,
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

      lines.push(`${FRAME}`);
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

      // Award Weekly GP to the recruiter (not the recruit)
      const recruiterId = offer.gmId || offer.by || guild.leader;
      try { require('../../rpg/utils/WeeklyGuildWar').addGP(db, recruiterId, 200, saveDatabase); } catch(e) {}

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `${FRAME}\n🎉 *CONTRACT ACCEPTED!*\n${FRAME}\n👤 *@${sender.split('@')[0]}* accepted the contract and joined *${guild.name}*!\n\n💠 Weekly Wage: ${offer.weeklyNexus.toLocaleString()} Nexus\n💎 Weekly Mana: ${offer.weeklyMana.toLocaleString()} Mana Stones\n⏳ Duration: ${offer.weeks} week(s)\n${FRAME}`,
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
        const _lvlReq = pro ? 10 : 15;
        const canFound = (player.level || 1) >= _lvlReq && (player.gold || 0) >= 1000000;
        const text = UI.card(player, {
          icon: '🏰', title: 'GUILD SYSTEM',
          lines: [
            `⚠️ You are not in a guild yet!`,
            ``,
            `📌 *GET STARTED:*`,
            `• /guild list — View all registered guilds`,
            `• /guild create [name] — Found one (1,000,000💠 + 100,000💎 | Lv.${_lvlReq}${pro ? ' Pro' : ''})`,
            `• /guild request [name] — Apply to a guild`,
            ``,
            `🏆 *GUILD BENEFITS:*`,
            `• Size upgrades up to 50 members`,
            `• Exclusive Guild Shop (up to 25% OFF)`,
            `• Shared treasury & Guild Wars!`,
          ],
          proLines: canFound ? [`💎 *PRO CHARTER* — you meet the founding cost`] : [`💎 *PRO CHARTER* — need Lv.${_lvlReq} + 1M 💠 to found`],
          tip: 'Guild Wars pay GP and glory',
        });
        return sock.sendMessage(chatId, { text }, { quoted: msg });
      }

      const leader = db.users[playerGuild.leader];
      const maxM   = getMaxMembers(playerGuild);
      const sizeL  = playerGuild.sizeLevel || 1;
      const shopL  = playerGuild.shopLevel || 0;
      const disc   = getShopDiscount(playerGuild);

      const warsF = playerGuild.totalWars || 0, warsW = playerGuild.wins || 0;
      const winRate = warsF ? Math.round(100 * warsW / warsF) : 0;
      const _gIcon47 = playerGuild.icon ? `${playerGuild.icon} ` : '';
      const info = UI.card(player, {
        icon: '🏰', title: `GUILD INFO — ${_gIcon47}${playerGuild.name}`,
        lines: [
          ...(playerGuild.bio ? [`📝 _${playerGuild.bio}_`] : []),
          `👑 Leader: *${leader?.name || 'Unknown'}*`,
          `👥 Members: *${playerGuild.members.length}/${maxM}* (Size Lv.${sizeL})`,
          `🛍️ Guild Shop: *${shopL > 0 ? `Lv.${shopL} (${disc}% OFF)` : 'Locked'}*`,
          `💠 Treasury: *${UI.num(playerGuild.treasury)}* Nexus · 💎 *${UI.num(playerGuild.manaTreasury)}* Mana Stones`,
          ``,
          `📊 *STATS* — 🏰 Raids *${UI.num(playerGuild.totalRaids)}* · ⚔️ Wars *${warsF}* · 🏆 Won *${warsW}*`,
          ``,
          `📌 /guild upgrade · /guild shop · /guild members · /guild list`,
          `✏️ /guild bio · /guild rename · /guild icon (reply to image, leader)`,
        ],
        proLines: [`💎 *PRO WAR ROOM*`, `  🏆 Win rate *${winRate}%* · 💠 ${UI.num(Math.floor((playerGuild.treasury || 0) / Math.max(1, playerGuild.members.length)))}/member in vault`],
        tip: '/guild war to fight for glory',
      });

      // Push #77: guild logo rendered with the info card.
      try {
        if (playerGuild.iconRef) {
          const BlobStore = require('../../rpg/utils/BlobStore');
          const _logo = await BlobStore.get(playerGuild.iconRef);
          if (_logo && _logo.length) return sock.sendMessage(chatId, { image: _logo, caption: info }, { quoted: msg });
        }
      } catch (e) {}
      return sock.sendMessage(chatId, { text: info }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Batch-47: GUILD BIO — /guild bio <bio> (leader, 1,000 Nexus, any time)
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'bio') {
      if (!playerGuild) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });
      }
      const _isLead = playerGuild.leader === sender;
      if (!_isLead) {
        return sock.sendMessage(chatId, { text: '❌ Only the guild leader can set the guild bio!' }, { quoted: msg });
      }
      const bio = args.slice(1).join(' ').trim();
      if (!bio) {
        const cur = playerGuild.bio ? `\n\n📝 Current bio:\n_${playerGuild.bio}_` : `\n\n_No guild bio set yet._`;
        return sock.sendMessage(chatId, {
          text: `📝 *Usage:* /guild bio <bio>\n\nSet your guild's bio for *1,000* 💠 Nexus (any time).${cur}`,
        }, { quoted: msg });
      }
      if (bio.length > 150) {
        return sock.sendMessage(chatId, { text: '❌ Bio too long (max 150 characters).' }, { quoted: msg });
      }
      if ((player.gold || 0) < 1000) {
        return sock.sendMessage(chatId, {
          text: `❌ You need *1,000* 💠 Nexus to set the guild bio (you have ${(player.gold || 0).toLocaleString()}).`,
        }, { quoted: msg });
      }
      player.gold -= 1000;
      try { require('../../rpg/utils/TransactionLog').logSpend(player, 'guild_shop', 1000, 0, 'Guild bio'); } catch (e) {}
      if (player.inventory) player.inventory.gold = player.gold;
      playerGuild.bio = bio;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `✅ *Guild bio updated!* (-1,000 💠)\n\n📝 _${bio}_`,
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Batch-47: GUILD RENAME — /guild rename <new name> (leader, Rename Card)
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'rename') {
      if (!playerGuild) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });
      }
      if (playerGuild.leader !== sender) {
        return sock.sendMessage(chatId, { text: '❌ Only the guild leader can rename the guild!' }, { quoted: msg });
      }
      const newName = args.slice(1).join(' ').trim();
      if (!newName) {
        return sock.sendMessage(chatId, {
          text: `✏️ *Usage:* /guild rename <new name>\n\nCosts 1 🃏 Rename Card (you have ${player.cards?.namechange || 0}).\n🛍️ Get one: /prostore buy namechange (500 PC)`,
        }, { quoted: msg });
      }
      if (newName.length > 30) {
        return sock.sendMessage(chatId, { text: '❌ Guild name too long (max 30 characters).' }, { quoted: msg });
      }
      if (Object.values(db.guilds || {}).some((g) => g !== playerGuild && String(g.name || '').toLowerCase() === newName.toLowerCase())) {
        return sock.sendMessage(chatId, { text: `❌ A guild named *${newName}* already exists!` }, { quoted: msg });
      }
      if (!player.cards) player.cards = {};
      if ((player.cards.namechange || 0) < 1) {
        return sock.sendMessage(chatId, {
          text: `❌ *No Rename Card!*\n\nRenaming your guild costs 1 🃏 Rename Card.\n\n🛍️ Get one: /prostore buy namechange (500 PC)`,
        }, { quoted: msg });
      }
      const oldName = playerGuild.name;
      player.cards.namechange -= 1;
      playerGuild.name = newName;
      // Rewire every name reference: members, gate keys, live + saved raids.
      try {
        for (const m of (playerGuild.members || [])) {
          const u = db.users?.[typeof m === 'object' ? m.id : m];
          if (u && u.guild === oldName) u.guild = newName;
        }
      } catch (e) {}
      try {
        for (const k of Object.values(db.gateKeys || {})) {
          if (k && k.guildName === oldName) k.guildName = newName;
        }
      } catch (e) {}
      try {
        const GM = require('../../rpg/dungeons/GateManager').GateManager || require('../../rpg/dungeons/GateManager');
        for (const gate of Object.values((GM && GM.activeGates) || {})) {
          if (gate?.raid?.guildName === oldName) gate.raid.guildName = newName;
          if (gate?.ownedBy === oldName) gate.ownedBy = newName;
        }
        for (const gate of Object.values(db.activeGates || {})) {
          if (gate?.raid?.guildName === oldName) gate.raid.guildName = newName;
          if (gate?.ownedBy === oldName) gate.ownedBy = newName;
        }
      } catch (e) {}
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `✅ *Guild renamed!*\n\n${oldName} → *${newName}*\n\n🃏 1 Rename Card used (${player.cards.namechange} left)`,
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Batch-47: GUILD ICON — /guild icon <emoji> (leader, Seticon Card)
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'icon') {
      if (!playerGuild) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });
      }
      if (playerGuild.leader !== sender) {
        return sock.sendMessage(chatId, { text: '❌ Only the guild leader can set the guild icon!' }, { quoted: msg });
      }
      // Push #77: works exactly like /seticon — reply to an image (or send an
      // image with the command as caption) and it becomes the guild LOGO,
      // rendered on /guild and on the #1 spot of /guildwar. A plain emoji
      // still works as a text badge.
      const _curImg = msg.message?.imageMessage;
      const _quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const _qImg = _quoted?.imageMessage;
      let _imgTarget = null;
      if (_curImg) _imgTarget = { key: msg.key, message: msg.message };
      else if (_qImg) _imgTarget = { key: { remoteJid: chatId, id: msg.message.extendedTextMessage.contextInfo.stanzaId, participant: msg.message.extendedTextMessage.contextInfo.participant }, message: _quoted };
      const icon = args.slice(1).join(' ').trim();
      if (!icon && !_imgTarget) {
        return sock.sendMessage(chatId, {
          text: `🖼️ *Usage:* reply to an image with */guild icon* (or send an image with /guild icon as caption)\nAlso: /guild icon <emoji> for a text badge.\n\nCosts 1 🖼️ Seticon Card (you have ${player.cards?.seticon || 0}).\n🛍️ Get one: /prostore buy seticon (500 PC)`,
        }, { quoted: msg });
      }
      if (!_imgTarget && [...icon].length > 4) {
        return sock.sendMessage(chatId, { text: '❌ Keep the icon short — one emoji (max 4 characters), or reply to an image.' }, { quoted: msg });
      }
      if (!player.cards) player.cards = {};
      if ((player.cards.seticon || 0) < 1) {
        return sock.sendMessage(chatId, {
          text: `❌ *No Seticon Card!*\n\nSetting your guild icon costs 1 🖼️ Seticon Card.\n\n🛍️ Get one: /prostore buy seticon (500 PC)`,
        }, { quoted: msg });
      }
      if (_imgTarget) {
        let dl = null;
        try { ({ downloadMediaMessage: dl } = require('@whiskeysockets/baileys')); } catch (e) { dl = null; }
        if (!dl) return sock.sendMessage(chatId, { text: '❌ Media download module not available.' }, { quoted: msg });
        try {
          const buf = await dl(_imgTarget, 'buffer', {});
          if (!buf || !buf.length) return sock.sendMessage(chatId, { text: '❌ Could not download the image.' }, { quoted: msg });
          if (buf.length > 2 * 1024 * 1024) return sock.sendMessage(chatId, { text: '❌ Image too large (max 2 MB).' }, { quoted: msg });
          const BlobStore = require('../../rpg/utils/BlobStore');
          const oldRef = playerGuild.iconRef;
          const ref = BlobStore.putSync('guild', String(playerGuild.id || playerGuild.name).replace(/[^A-Za-z0-9_-]/g, '_'), buf);
          if (!ref) return sock.sendMessage(chatId, { text: '❌ Could not store the image. Try again.' }, { quoted: msg });
          playerGuild.iconRef = ref;
          if (oldRef && oldRef !== ref) BlobStore.drop(oldRef).catch(() => {});
          player.cards.seticon -= 1;
          saveDatabase();
          return sock.sendMessage(chatId, { image: buf, caption: `✅ *Guild logo set!*\n\n🏰 *${playerGuild.name}*\nShown on /guild and on the /guildwar board when you hold #1.\n\n🖼️ 1 Seticon Card used (${player.cards.seticon} left)` }, { quoted: msg });
        } catch (err) {
          console.error('[guild icon] download error:', err.message);
          return sock.sendMessage(chatId, { text: '❌ Failed to set logo. The media may have expired.' }, { quoted: msg });
        }
      }
      player.cards.seticon -= 1;
      playerGuild.icon = icon;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `✅ *Guild icon set!*\n\n${icon} *${playerGuild.name}*\n\n🖼️ 1 Seticon Card used (${player.cards.seticon} left)`,
      }, { quoted: msg });
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

      const LEVEL_REQ = pro ? 10 : 15; // Pro founders: Lv.10 · Regular: Lv.15
      const NEXUS_REQ = 1_000_000; // 1 Million Nexus
      const MANA_REQ  = 100_000;   // 100,000 Mana Stones (100kms)
      const START_NEXUS = 1_000_000; // batch-22: new guilds start rich
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
              `${FRAME}`,
              `🏰 *GUILD CREATION*`,
              `${FRAME}`,
              `Requirements:`,
              `🎯 *Level ${LEVEL_REQ}*`,
              `💠 *${NEXUS_REQ.toLocaleString()} Nexus*`,
              `💎 *${MANA_REQ.toLocaleString()} Mana Stones*`,
              ``,
              `📊 You currently have:`,
              `   📈 Level ${playerLevel}${playerLevel >= LEVEL_REQ ? ' ✅' : ''}`,
              `   💠 ${playerNexus.toLocaleString()} Nexus${playerNexus >= NEXUS_REQ ? ' ✅' : ''}`,
              `   💎 ${playerMana.toLocaleString()} Mana Stones${playerMana >= MANA_REQ ? ' ✅' : ''}`,
              `${FRAME}`,
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
        try { require('../../rpg/utils/TransactionLog').logSpend(player, 'guild_found', NEXUS_REQ, MANA_REQ, guildName); } catch (e) {}
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
        text: `${FRAME}
✅ GUILD CREATED! ✅
${FRAME}
🏰 Name: ${guildName}
👑 Leader: ${player.name}
👥 Members: 1/10 (Size Lv.1)
🛍️ Guild Shop: Locked (Unlock with /guild upgrade shop)
💠 Treasury: ${START_NEXUS.toLocaleString()} Nexus
💎 Treasury: ${START_MANA.toLocaleString()} Mana Stones
${FRAME}`
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // JOIN GUILD (DISABLED DIRECT JOIN — USE /guild request)
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'join') {
      const guildName = args.slice(1).join(' ');
      return sock.sendMessage(chatId, {
        text: [
          `${FRAME}`,
          `🚫 *DIRECT JOIN DISABLED*`,
          `${FRAME}`,
          ``,
          `Direct joining is disabled. Submit your application and profile to the Guildmaster in DM using:`,
          ``,
          `👉 */guild request ${guildName || '[guild name]'}*`,
          ``,
          `Your stats and profile will be dispatched to the Guildmaster and Officers in DM.`,
          `If accepted, they will issue you a contract offer using */guild hire*.`,
          `${FRAME}`,
        ].join('\n')
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // GUILD REQUEST (APPLICATION DISPATCH TO GUILDMASTER / OFFICERS IN DM)
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'request' || action === 'apply') {
      const guildName = args.slice(1).join(' ').trim();

      if (!guildName) {
        return sock.sendMessage(chatId, {
          text: '❌ Specify guild name!\n\nUsage: */guild request [guild name]*\nExample: */guild request Dragon Slayers*'
        }, { quoted: msg });
      }

      if (playerGuild) {
        return sock.sendMessage(chatId, {
          text: '❌ You are already in a guild! Leave your current guild first with */guild leave*.'
        }, { quoted: msg });
      }

      const guild = Object.values(db.guilds).find(g => 
        g.name && g.name.toLowerCase() === guildName.toLowerCase()
      );

      if (!guild) {
        return sock.sendMessage(chatId, {
          text: `❌ Guild *${guildName}* not found!\nUse */guild list* to see all registered guilds.`
        }, { quoted: msg });
      }

      const maxCap = getMaxMembers(guild);
      if ((guild.members?.length || 0) >= maxCap) {
        return sock.sendMessage(chatId, {
          text: `❌ Guild *${guild.name}* is at max capacity (${guild.members.length}/${maxCap} members)!`
        }, { quoted: msg });
      }

      // Find leaders (Guildmaster, Grandmaster, Vice GM)
      const leaders = (guild.members || []).filter(m => {
        const rank = m.rank || '';
        return rank === 'Leader' || rank === 'Guild Master' || rank === 'Grandmaster' || rank === 'Vice' || rank === 'Vice GM' || m.id === guild.leader;
      });

      if (leaders.length === 0 && guild.leader) {
        leaders.push({ id: guild.leader, rank: 'Guild Master' });
      }

      let power = 0, powerLabel = { emoji: '⚪', label: 'Unknown' };
      try {
        const { calculatePowerRating, getPowerLabel } = require('../../rpg/utils/SoloLevelingCore');
        power = require('../../rpg/utils/SoloLevelingCore').calculatePlayerPower(player) || 0;
        powerLabel = getPowerLabel(power) || powerLabel;
      } catch (e) {}

      const appText = [
        `${FRAME}`,
        `📩 *NEW GUILD APPLICATION REQUEST*`,
        `${FRAME}`,
        `👤 Candidate: *@${sender.split('@')[0]}* (${player.name || 'Unknown'})`,
        `🏰 Applying for Guild: *${guild.name}*`,
        ``,
        `📊 *CANDIDATE PROFILE & STATS:*`,
        `⭐ Level: *${player.level || 1}* | Rank: *${player.awakenRank || 'E'}-Rank*`,
        `⚡ Power Rating: *${power.toLocaleString()} ${powerLabel.emoji} ${powerLabel.label}*`,
        `🎭 Class: *${player.class || 'Not assigned'}*`,
        `💠 Nexus: *${(player.gold || 0).toLocaleString()}*`,
        `💎 Mana Stones: *${(player.manaCrystals || 0).toLocaleString()}*`,
        `⚔️ ATK: *${player.stats?.atk || 0}* | 🛡️ DEF: *${player.stats?.def || 0}* | ❤️ HP: *${player.stats?.hp || 0}/${player.stats?.maxHp || 100}*`,
        ``,
        `${FRAME}`,
        `💡 *To recruit this applicant, send a contract offer:*`,
        `*/guild hire @${sender.split('@')[0]} <weekly_nexus> <weekly_mana> <weeks>*`,
        `${FRAME}`,
      ].join('\n');

      let MultiSocketManager = null;
      try { MultiSocketManager = require('../../bots/MultiSocketManager'); } catch (e) {}
      const SerfManager = require('../../rpg/utils/SerfManager');

      let sentCount = 0;
      for (const l of leaders) {
        const leaderJid = typeof l === 'object' ? l.id : l;
        if (!leaderJid) continue;
        const serf = SerfManager.getSerf(db, leaderJid);
        const serfSock = serf?.botKey && MultiSocketManager ? MultiSocketManager.getSocket(serf.botKey) : null;
        // FIX: serf-only DM — do NOT fallback to getAnySocket/sock (prevents non-serfbot DMs)
        if (!serfSock) {
          // No serf assigned or serf offline → skip DM (strict serf-wall). Optionally queue or notify in group that leader has no serf.
          try { console.log(`[GUILD] Skipped application DM to ${leaderJid} — no serf (${serf?.botKey || 'none'})`); } catch {}
          continue;
        }
        try {
          await serfSock.sendMessage(leaderJid, { text: appText, mentions: [sender] });
          sentCount++;
        } catch (e) {}
      }

      // If no DM was sent (no serf), warn applicant
      if (sentCount === 0) {
        try { console.log(`[GUILD] Application for ${guild.name} from ${sender} — no serf DMs sent (leaders have no serf assigned)`); } catch {}
      }
      return sock.sendMessage(chatId, {
        text: [
          `${FRAME}`,
          sentCount > 0 ? `📩 *APPLICATION DISPATCHED TO GUILD LEADERS*` : `⚠️ *APPLICATION PENDING — LEADER HAS NO SERF*`,
          `${FRAME}`,
          `🏰 Target Guild: *${guild.name}*`,
          ``,
          sentCount > 0
            ? `@${sender.split('@')[0]}, your profile card, stats, and power rating have been sent directly to the Guildmaster and Officers in DM!`
            : `@${sender.split('@')[0]}, the Guildmaster/Officers have no Serf assigned — they did NOT receive a DM.\nPlease contact them directly or ask them to set a Serf via /setserf.`,
          ``,
          `💡 If they accept your application, they will issue you a contract offer via DM/chat:`,
          `   */guild hire @${sender.split('@')[0]} <weekly_nexus> <weekly_mana> <weeks>*`,
          sentCount === 0 ? `\n⚠️ DM delivery failed — leader serf is offline or not set.\nGuild still exists, but leaders must check /guild info manually.` : ``,
          `${FRAME}`,
        ].filter(Boolean).join('\n'),
        mentions: [sender]
      }, { quoted: msg });
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
            `${FRAME}`,
            `🏰 *GUILD UPGRADE CENTER*`,
            `${FRAME}`,
            `🏰 Guild: *${playerGuild.name}*`,
            `💠 Treasury: *${(playerGuild.treasury || 0).toLocaleString()} Nexus*`,
            `💎 Treasury: *${(playerGuild.manaTreasury || 0).toLocaleString()} Mana Stones*`,
            ``,
            `📈 *1. GUILD SIZE / CAPACITY:*`,
            `   ${sizeTxt}`,
            ``,
            `🛍️ *2. GUILD SHOP & EXCLUSIVE DISCOUNT:*`,
            `   ${shopTxt}`,
            `${FRAME}`,
            `📌 *Guildmaster / Vice GM:* Run /guild upgrade size or /guild upgrade shop to upgrade from Treasury!`,
            `${FRAME}`,
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

        // Award Weekly GP for guild upgrade
        try { require('../../rpg/utils/WeeklyGuildWar').addGP(db, sender, 150, saveDatabase); } catch(e) {}

        saveDatabase();

        return sock.sendMessage(chatId, {
          text: [
            `${FRAME}`,
            `🎉 *GUILD SIZE UPGRADED!*`,
            `${FRAME}`,
            `🏰 Guild: *${playerGuild.name}*`,
            `📈 Level: *Level ${playerGuild.sizeLevel}*`,
            `👥 Max Members: *${playerGuild.sizeLevel * 10} members*`,
            `${FRAME}`,
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

        // Award Weekly GP for guild upgrade
        try { require('../../rpg/utils/WeeklyGuildWar').addGP(db, sender, 150, saveDatabase); } catch(e) {}

        saveDatabase();

        const disc = playerGuild.shopLevel * 5;
        return sock.sendMessage(chatId, {
          text: [
            `${FRAME}`,
            `🎉 *GUILD SHOP UPGRADED!*`,
            `${FRAME}`,
            `🏰 Guild: *${playerGuild.name}*`,
            `🛍️ Level: *Level ${playerGuild.shopLevel}*`,
            `🏷️ Member Discount: *${disc}% OFF* on all Guild Shop exclusive items!`,
            `${FRAME}`,
            `📌 Access shop with /guild shop!`,
            `${FRAME}`,
          ].join('\n'),
        }, { quoted: msg });
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // GUILD SHOP (10 items everyday from Regular Shop Pool, 5 units each)
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'shop') {
      if (!playerGuild) {
        return sock.sendMessage(chatId, { text: '❌ You must belong to a guild to access the Guild Shop!' }, { quoted: msg });
      }

      const shopLvl = playerGuild.shopLevel || 0;
      if (shopLvl === 0) {
        return sock.sendMessage(chatId, {
          text: [
            `${FRAME}`,
            `🔒 *GUILD SHOP LOCKED*`,
            `${FRAME}`,
            `🏰 Guild: *${playerGuild.name}*`,
            `⚠️ The Guild Shop has not been unlocked yet!`,
            ``,
            `💡 Guild Officers can unlock it with:`,
            `   */guild upgrade shop*`,
            `   (Cost: 💠 50,000 Nexus & 💎 2,500 Mana Stones)`,
            `${FRAME}`,
          ].join('\n'),
        }, { quoted: msg });
      }

      const discountPct = shopLvl * 5; // 5%, 10%, 15%, 20%, 25%
      const todayItems  = ensureGuildShopFresh(playerGuild);
      const sub         = (args[1] || 'list').toLowerCase();

      // /guild shop buy <# or item_id>
      if (sub === 'buy') {
        const query = (args[2] || '').toLowerCase();
        let itemIdx = parseInt(query) - 1;
        let item = null;

        if (!isNaN(itemIdx) && itemIdx >= 0 && itemIdx < todayItems.length) {
          item = todayItems[itemIdx];
        } else if (query) {
          item = todayItems.find(i => i.id.toLowerCase() === query || i.name.toLowerCase().includes(query));
        }

        if (!item) {
          return sock.sendMessage(chatId, {
            text: `❌ Item not found! Usage: /guild shop buy <1-10 or item_id>\nExample: /guild shop buy 1`
          }, { quoted: msg });
        }

        if (item.unitsLeft <= 0) {
          return sock.sendMessage(chatId, {
            text: `❌ *${item.name}* is sold out for today! (0/5 units remaining)`
          }, { quoted: msg });
        }

        const discountedPrice = Math.floor(item.basePrice * (1 - discountPct / 100));

        if (item.currency === 'gold') {
          const playerGold = player.gold || 0;
          if (playerGold < discountedPrice) {
            return sock.sendMessage(chatId, {
              text: `❌ Insufficient Nexus balance!\nPrice: 💠 ${discountedPrice.toLocaleString()} Nexus (${discountPct}% OFF)\nYou have: 💠 ${playerGold.toLocaleString()} Nexus`
            }, { quoted: msg });
          }
          player.gold = playerGold - discountedPrice;
          try { require('../../rpg/utils/TransactionLog').logSpend(player, 'guild_shop', discountedPrice, 0, item.name); } catch (e) {}
          if (player.inventory) player.inventory.gold = player.gold;
        } else {
          const playerMana = player.manaCrystals || 0;
          if (playerMana < discountedPrice) {
            return sock.sendMessage(chatId, {
              text: `❌ Insufficient Mana Stones!\nPrice: 💎 ${discountedPrice.toLocaleString()} Mana Stones (${discountPct}% OFF)\nYou have: 💎 ${playerMana.toLocaleString()} Mana Stones`
            }, { quoted: msg });
          }
          player.manaCrystals = playerMana - discountedPrice;
          try { require('../../rpg/utils/TransactionLog').logSpend(player, 'guild_shop', 0, discountedPrice, item.name); } catch (e) {}
        }

        // Decrement stock unit
        item.unitsLeft -= 1;

        // Push #56: the purchase is SEALED into an inventory package instead of
        // being half-applied inline. Opening it (/equip use <#>) routes every
        // payload to the system that owns it — attack patterns now land in
        // /attacks, which the old `inventory.patterns` push never did.
        const Sealed = require('../../rpg/utils/SealedPackages');
        if (!player.inventory) player.inventory = { healthPotions:0, energyPotions:0, reviveTokens:0, items:[] };
        if (!player.inventory.items) player.inventory.items = [];
        const _pkg = Sealed.seal(item, { from: 'Guild Shop', price: discountedPrice, currency: item.currency, guild: playerGuild?.name || null });
        if (item.type === 'pattern') {
          // Roll the pattern number at purchase so the receipt names the same
          // technique the player will open.
          const rank = Sealed.PATTERN_RANK_FOR_ITEM?.[item.id] || 'B';
          _pkg.pkg.patternId = Sealed.rollPatternId(rank, player.attackPatterns?.owned || []);
          _pkg.pkg.shopItem.rank = rank;
        }
        player.inventory.items.push(_pkg);

        saveDatabase();

        const costDisplay = item.currency === 'crystals'
          ? `💎 ${discountedPrice.toLocaleString()} Mana Stones`
          : `💠 ${discountedPrice.toLocaleString()} Nexus`;

        return sock.sendMessage(chatId, {
          text: [
            `${FRAME}`,
            `🛍️ *GUILD SHOP PURCHASE*`,
            `${FRAME}`,
            `🎁 Purchased: *${item.name}*`,
            `📦 Sealed in your inventory as *${_pkg.name}*`,
            `👉 /equip use <#> to open it — /items lists the numbers`,
            ...(item.type === 'pattern' && _pkg.pkg.patternId ? [`⚔️ Attack pattern *#${_pkg.pkg.patternId}* is inside — it lands in */attacks* when you open the box`] : []),
            `🏷️ Guild Discount: *${discountPct}% OFF*`,
            `💰 Paid: *${costDisplay}*`,
            `📦 Units Left Today: *${item.unitsLeft}/5 units*`,
            `${FRAME}`,
            `✅ Package added to your inventory — open it to receive the item!`,
            `${FRAME}`,
          ].join('\n'),
        }, { quoted: msg });
      }

      // Display Daily 10 Items from Regular Shop Pool
      const lines = [
        `${FRAME}`,
        `🛍️ *GUILD SHOP — TODAY'S STOCK (10 ITEMS)*`,
        `${FRAME}`,
        `🏰 Guild: *${playerGuild.name}* (Shop Lv.${shopLvl})`,
        `🏷️ Member Discount: *${discountPct}% OFF*`,
        `💠 Balance: *${(player.gold || 0).toLocaleString()} Nexus* | 💎 *${(player.manaCrystals || 0).toLocaleString()} MS*`,
        `${FRAME}`,
      ];

      todayItems.forEach((item, i) => {
        const discountedPrice = Math.floor(item.basePrice * (1 - discountPct / 100));
        const priceStr = item.currency === 'crystals'
          ? `~💎 ${item.basePrice.toLocaleString()}~ → *💎 ${discountedPrice.toLocaleString()} MS*`
          : `~💠 ${item.basePrice.toLocaleString()}~ → *💠 ${discountedPrice.toLocaleString()} Nexus*`;

        const stockBadge = item.unitsLeft > 0 ? `📦 *${item.unitsLeft}/5 left*` : `❌ *SOLD OUT*`;

        lines.push(`*${i+1}. ${item.name}* [\`${item.id}\`]`);
        lines.push(`   📂 Category: ${item.category} | ${stockBadge}`);
        lines.push(`   💰 Price: ${priceStr} (${discountPct}% OFF)`);
        lines.push(`   📝 ${item.description}`);
        lines.push(``);
      });

      lines.push(`${FRAME}`);
      lines.push(`📌 Buy item: */guild shop buy <1-10 or item_id>*`);
      lines.push(`${FRAME}`);

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
      let memberList = `${FRAME}
👥 GUILD MEMBERS 👥
${FRAME}
🏰 ${playerGuild.name}
${FRAME}\n`;

      // Push #56: the roster used to read `member.rank` off `guild.members`,
      // which is an array of bare JID strings for every guild created before the
      // hire-flow existed — so members showed as "Unknown / Member" and the
      // rank was never visible. Normalise BOTH stored shapes (strings and
      // {id,rank} objects), merge in memberData, and show each hunter's
      // guild rank AND their own awaken rank / level / GP.
      const byId = new Map();
      const touch = (entry) => {
        const id = (entry && typeof entry === 'object') ? (entry.id || entry.jid) : entry;
        if (!id) return;
        const key = String(id).split(':')[0];
        const cur = byId.get(key) || { id, guildRank: null, name: null, joinedAt: null };
        if (entry && typeof entry === 'object') {
          if (entry.rank) cur.guildRank = entry.rank;
          if (entry.name) cur.name = entry.name;
          if (entry.joinedAt) cur.joinedAt = entry.joinedAt;
        }
        byId.set(key, cur);
      };
      (playerGuild.members || []).forEach(touch);
      (playerGuild.memberData || []).forEach(touch);
      if (playerGuild.leader) {
        const lk = String(playerGuild.leader).split(':')[0];
        const rec = byId.get(lk) || { id: playerGuild.leader, guildRank: null, name: null };
        rec.guildRank = rec.guildRank || 'Guild Master';
        byId.set(lk, rec);
      }

      const RANK_EMOJI = { 'Guild Master': '👑', 'Leader': '👑', 'Vice': '⭐', 'Vice GM': '⭐', 'Vice Guild Master': '⭐', 'Officer': '⭐' };
      const rows = [...byId.values()].map((m) => {
        const u = db.users?.[m.id];
        const _isRealLeader = String(playerGuild.leader || '').split(':')[0].split('@')[0] === String(m.id).split(':')[0].split('@')[0];
        let guildRank = m.guildRank || (_isRealLeader ? 'Guild Master' : 'Member');
        if (!_isRealLeader && (guildRank === 'Guild Master' || guildRank === 'Leader')) guildRank = 'Member'; // Push #87: stale GM rank after /guild assign
        if (_isRealLeader) guildRank = 'Guild Master';
        const emoji = RANK_EMOJI[guildRank] || (String(guildRank).toLowerCase().includes('member') ? '👤' : '🎖️');
        return {
          ...m, u, guildRank, emoji,
          name: m.name || u?.name || String(m.id).split('@')[0],
          level: u?.level || 0,
          hunterRank: u?.awakenRank || u?.rank || '—',
          wgp: u?.weeklyGP || 0, tgp: u?.totalGP || 0,
          inGame: !!u,
        };
      }).sort((a, b) => (b.guildRank === 'Guild Master') - (a.guildRank === 'Guild Master') || (b.tgp - a.tgp) || (b.level - a.level));

      for (const [i, r] of rows.entries()) {
        memberList += `${i + 1}. ${r.emoji} *${r.name}*${r.inGame ? '' : ' _(unregistered)_'}\n`;
        memberList += `    🏅 Guild Rank: *${r.guildRank}* · ⚡ Hunter: *${r.hunterRank}-Rank Lv.${r.level || '?'}*\n`;
        memberList += `    💠 GP: *${r.wgp.toLocaleString()}* wk / *${r.tgp.toLocaleString()}* total\n\n`;
      }
      if (!rows.length) memberList += `_(no roster entries)_\n\n`;

      const officers = rows.filter(r => RANK_EMOJI[r.guildRank]).length;
      memberList += `${FRAME}\n`;
      memberList += `Total: ${rows.length}/${maxM} · 👑 1 GM · ⭐ ${Math.max(0, officers - 1)} officer(s)\n`;
      memberList += `Guild Points: *${(playerGuild.guildPoints || playerGuild.totalGP || 0).toLocaleString()} GP*\n`;
      memberList += `${FRAME}\n💡 /guild promote @user · /guild demote @user · /guild assign @user · /guild kick @user`;

      return sock.sendMessage(chatId, { text: memberList });
    }

    // ═══════════════════════════════════════════════════════════════════
    // PROMOTE MEMBER
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'promote') {
      if (!playerGuild) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });
      }

      const senderRank = playerGuild.members?.find(m => (typeof m === 'object' ? m.id : m) === sender)?.rank || (playerGuild.leader === sender ? 'Leader' : 'Member');
      const isLeader = playerGuild.leader === sender || senderRank === 'Leader' || senderRank === 'Guild Master';
      const isVice   = senderRank === 'Vice' || senderRank === 'Vice GM';

      if (!isLeader && !isVice) {
        return sock.sendMessage(chatId, { text: '❌ Only the Guild Master or Vice GM can promote guild members!' }, { quoted: msg });
      }

      const targetId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
                       msg.message?.extendedTextMessage?.contextInfo?.participant;

      if (!targetId) {
        return sock.sendMessage(chatId, {
          text: '❌ Tag or reply to the member you want to promote!\nUsage: /guild promote @user <officer|vice>'
        }, { quoted: msg });
      }

      // FIX: handle both "/guild promote vice @user" and "/guild promote @user vice" — check combined args for vice/co
      const roleCand = ((args[1] || '') + ' ' + (args[2] || '')).toLowerCase();
      let targetRank = 'Officer';
      const wantsVice = roleCand.includes('vice') || roleCand.includes('co-') || roleCand.includes('co ') || roleCand.includes('co_leader') || roleCand.includes('coleader') || /\bco\b/.test(roleCand);
      if (wantsVice) {
        if (!isLeader) {
          return sock.sendMessage(chatId, { text: '❌ Only the Guild Master can promote someone to Vice Guildmaster!' }, { quoted: msg });
        }
        targetRank = 'Vice';
      } else if (roleCand.includes('officer')) {
        targetRank = 'Officer';
      }

      const memberObj = playerGuild.members?.find(m => (typeof m === 'object' ? m.id : m) === targetId);
      if (!memberObj) {
        return sock.sendMessage(chatId, { text: '❌ That hunter is not a member of your guild!' }, { quoted: msg });
      }

      if (typeof memberObj === 'object') {
        memberObj.rank = targetRank;
      } else {
        const idx = playerGuild.members.indexOf(memberObj);
        playerGuild.members[idx] = { id: targetId, rank: targetRank, joinedAt: Date.now() };
      }

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `${FRAME}\n🎉 *GUILD PROMOTION!*\n${FRAME}\n🏰 Guild: *${playerGuild.name}*\n👤 Hunter: *@${targetId.split('@')[0]}*\n⭐ New Rank: *${targetRank}*\n${FRAME}`,
        mentions: [targetId]
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // ASSIGN (Push #87) — /guild assign @user  → hand over Guild Master.
    // Old GM becomes an ordinary Member (can be promoted again later).
    // Only the current GM (or a bot owner/mod) can do this.
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'assign' || action === 'transfer' || action === 'assignmaster') {
      if (!playerGuild) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });
      }
      const _mIdOf = (m) => (typeof m === 'object' ? m.id : m);
      const _rankOf = (id) => playerGuild.members?.find(m => _mIdOf(m) === id)?.rank || (playerGuild.leader === id ? 'Leader' : 'Member');
      const senderRank = _rankOf(sender);
      let isStaff = false;
      try { const P = require('../../utils/permissions'); isStaff = P.isBotOwner(db, sender) || P.isBotMod(db, sender); } catch (e) {}
      const isLeader = playerGuild.leader === sender || senderRank === 'Leader' || senderRank === 'Guild Master';
      if (!isLeader && !isStaff) {
        return sock.sendMessage(chatId, { text: '❌ Only the Guild Master can assign a new Guild Master!' }, { quoted: msg });
      }
      const targetId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
                       msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!targetId) {
        return sock.sendMessage(chatId, { text: '❌ Tag or reply to the member who becomes the new Guild Master!\nUsage: /guild assign @user' }, { quoted: msg });
      }
      const oldLeader = playerGuild.leader;
      if (targetId === oldLeader) {
        return sock.sendMessage(chatId, { text: '❌ That hunter is already the Guild Master.' }, { quoted: msg });
      }
      if (!db.users?.[targetId]) {
        return sock.sendMessage(chatId, { text: '❌ That hunter is not registered.' }, { quoted: msg });
      }
      const tIdx = (playerGuild.members || []).findIndex(m => _mIdOf(m) === targetId);
      if (tIdx === -1) {
        return sock.sendMessage(chatId, { text: '❌ That hunter is not a member of your guild!' }, { quoted: msg });
      }
      // New GM
      playerGuild.leader = targetId;
      if (typeof playerGuild.members[tIdx] === 'object') playerGuild.members[tIdx].rank = 'Leader';
      else playerGuild.members[tIdx] = { id: targetId, rank: 'Leader', joinedAt: Date.now() };
      // Old GM → ordinary Member (ensure he is in the roster)
      if (oldLeader) {
        const oIdx = (playerGuild.members || []).findIndex(m => _mIdOf(m) === oldLeader);
        if (oIdx === -1) playerGuild.members.push({ id: oldLeader, rank: 'Member', joinedAt: Date.now() });
        else if (typeof playerGuild.members[oIdx] === 'object') playerGuild.members[oIdx].rank = 'Member';
        else playerGuild.members[oIdx] = { id: oldLeader, rank: 'Member', joinedAt: Date.now() };
      }
      // memberData mirror (roster reads ranks from here too)
      if (Array.isArray(playerGuild.memberData)) {
        const _b = (x) => String(x || '').split(':')[0].split('@')[0];
        let hasNew = false;
        for (const md of playerGuild.memberData) {
          if (!md || typeof md !== 'object') continue;
          if (_b(md.id) === _b(targetId)) { md.rank = 'Guild Master'; hasNew = true; }
          else if (oldLeader && _b(md.id) === _b(oldLeader)) md.rank = 'Member';
        }
        if (!hasNew) playerGuild.memberData.push({ id: targetId, name: db.users[targetId]?.name || 'Unknown', rank: 'Guild Master', joinedAt: Date.now() });
      }
      // Mirror on player records if such fields exist
      try {
        if (db.users[targetId]) db.users[targetId].guildRank = 'Leader';
        if (oldLeader && db.users[oldLeader]) db.users[oldLeader].guildRank = 'Member';
      } catch (e) {}
      saveDatabase();
      const mentions = [targetId]; if (oldLeader) mentions.push(oldLeader);
      return sock.sendMessage(chatId, {
        text: `${FRAME}\n👑 *GUILD MASTER ASSIGNED!*\n${FRAME}\n🏰 Guild: *${playerGuild.name}*\n👑 New Guild Master: *@${targetId.split('@')[0]}*${oldLeader ? `\n👤 @${oldLeader.split('@')[0]} is now a regular Member` : ''}\n${FRAME}`,
        mentions,
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // DEMOTE (Push #82) — /guild demote @user  → back to Member
    // GM can demote anyone (Vice/Officer); Vice can demote Officers only.
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'demote') {
      if (!playerGuild) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });
      }
      const _rankOf = (id) => playerGuild.members?.find(m => (typeof m === 'object' ? m.id : m) === id)?.rank || (playerGuild.leader === id ? 'Leader' : 'Member');
      const senderRank = _rankOf(sender);
      const isLeader = playerGuild.leader === sender || senderRank === 'Leader' || senderRank === 'Guild Master';
      const isVice   = senderRank === 'Vice' || senderRank === 'Vice GM';
      if (!isLeader && !isVice) {
        return sock.sendMessage(chatId, { text: '❌ Only the Guild Master or Vice GM can demote guild members!' }, { quoted: msg });
      }
      const targetId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
                       msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!targetId) {
        return sock.sendMessage(chatId, { text: '❌ Tag or reply to the member you want to demote!\nUsage: /guild demote @user' }, { quoted: msg });
      }
      if (targetId === sender) {
        return sock.sendMessage(chatId, { text: '❌ You cannot demote yourself.' }, { quoted: msg });
      }
      if (targetId === playerGuild.leader) {
        return sock.sendMessage(chatId, { text: '❌ The Guild Master cannot be demoted.' }, { quoted: msg });
      }
      const memberObj = playerGuild.members?.find(m => (typeof m === 'object' ? m.id : m) === targetId);
      if (!memberObj) {
        return sock.sendMessage(chatId, { text: '❌ That hunter is not a member of your guild!' }, { quoted: msg });
      }
      const oldRank = (typeof memberObj === 'object' && memberObj.rank) || 'Member';
      if (oldRank === 'Member') {
        return sock.sendMessage(chatId, { text: '❌ That hunter is already a regular Member.' }, { quoted: msg });
      }
      if (!isLeader && (oldRank === 'Vice' || oldRank === 'Vice GM')) {
        return sock.sendMessage(chatId, { text: '❌ Only the Guild Master can demote a Vice Guildmaster!' }, { quoted: msg });
      }
      if (typeof memberObj === 'object') {
        memberObj.rank = 'Member';
      } else {
        const idx = playerGuild.members.indexOf(memberObj);
        playerGuild.members[idx] = { id: targetId, rank: 'Member', joinedAt: Date.now() };
      }
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `${FRAME}\n📉 *GUILD DEMOTION*\n${FRAME}\n🏰 Guild: *${playerGuild.name}*\n👤 Hunter: *@${targetId.split('@')[0]}*\n⭐ ${oldRank} → *Member*\n${FRAME}`,
        mentions: [targetId]
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // LEAVE GUILD
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'kick' || action === 'remove') {
      if (!playerGuild) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });
      }

      const senderRank = playerGuild.members?.find(m => (typeof m === 'object' ? m.id : m) === sender)?.rank || (playerGuild.leader === sender ? 'Leader' : 'Member');
      const isLeader = playerGuild.leader === sender || senderRank === 'Leader' || senderRank === 'Guild Master';
      const isVice   = senderRank === 'Vice' || senderRank === 'Vice GM';

      if (!isLeader && !isVice) {
        return sock.sendMessage(chatId, { text: '❌ Only the Guild Master or Vice GM can kick guild members!' }, { quoted: msg });
      }

      const targetId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
                       msg.message?.extendedTextMessage?.contextInfo?.participant;

      if (!targetId) {
        return sock.sendMessage(chatId, {
          text: '❌ Tag or reply to the member you want to kick!\nUsage: /guild kick @user'
        }, { quoted: msg });
      }

      if (targetId === sender) {
        return sock.sendMessage(chatId, { text: '❌ You cannot kick yourself! Use /guild leave instead.' }, { quoted: msg });
      }

      if (targetId === playerGuild.leader) {
        return sock.sendMessage(chatId, { text: '❌ You cannot kick the Guild Master!' }, { quoted: msg });
      }

      const idx = (playerGuild.members || []).findIndex(m => (typeof m === 'object' ? m.id : m) === targetId);
      if (idx === -1) {
        return sock.sendMessage(chatId, { text: '❌ That hunter is not a member of your guild!' }, { quoted: msg });
      }

      // Push #70: KICK SEVERANCE — a kicked contracted member is paid ×2 the
      // REMAINING balance of their contract (per the GuildContractManager
      // spec). This used to be dead code — the kick never called it, so
      // kicked members got nothing. Voluntary /guild leave gets no severance
      // (normal leave, untouched).
      let kickSev = null;
      try {
        const CM = require('../../rpg/utils/GuildContractManager');
        kickSev = CM.creditKickPayout(db, playerGuild.id || playerGuild.name, targetId, null) || null; // saved by the saveDatabase() below
      } catch (e) { console.error('[GUILD] kick severance failed:', e.message); }

      playerGuild.members.splice(idx, 1);
      const kicked = (kickSev && kickSev.user) || db.users?.[targetId];
      if (kicked) kicked.guild = null;
      saveDatabase();

      const kName = kicked?.name || ('@' + targetId.split('@')[0]);
      const sevLine = (kickSev && kickSev.success && ((kickSev.payout.nexus || 0) > 0 || (kickSev.payout.mana || 0) > 0))
        ? `\n💸 *Kick Severance:* +${(kickSev.payout.nexus || 0).toLocaleString()} 💠 Nexus, +${(kickSev.payout.mana || 0).toLocaleString()} 💎 Mana Stones _(×2 remaining contract)_`
        : '';
      return sock.sendMessage(chatId, {
        text: `${FRAME}\n🪓 *GUILD KICK!*\n${FRAME}\n🏰 Guild: *${playerGuild.name}*\n👤 Removed: *${kName}*\n${sevLine}${FRAME}`,
        mentions: [targetId]
      }, { quoted: msg });
    }

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

      // Push #56: `members` is a bare-JID array for every pre-hire guild, so
      // the old `m.id !== sender` filter matched nothing and leavers stayed on
      // the roster forever (inflating the guild and its GP totals).
      const _mid = (m) => String((m && typeof m === 'object') ? (m.id || m.jid) : m).split(':')[0];
      playerGuild.members = (playerGuild.members || []).filter(m => _mid(m) !== String(sender).split(':')[0]);
      if (Array.isArray(playerGuild.memberData)) {
        playerGuild.memberData = playerGuild.memberData.filter(m => _mid(m) !== String(sender).split(':')[0]);
      }
      if (Array.isArray(playerGuild.officers)) {
        playerGuild.officers = playerGuild.officers.filter(m => _mid(m) !== String(sender).split(':')[0]);
      }
      try {
        let w = 0, t = 0;
        for (const id of playerGuild.members.map(_mid)) {
          const u = db.users?.[id];
          if (u) { w += u.weeklyGP || 0; t += u.totalGP || 0; }
        }
        playerGuild.weeklyGP = Math.max(0, w);
        playerGuild.totalGP = Math.max(0, t);
        playerGuild.guildPoints = Math.max(0, t);
      } catch (e) {}
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

      const _offerText = [
        `${FRAME}`,
        `📜 *GUILD CONTRACT OFFER*`,
        `${FRAME}`,
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
        `${FRAME}`,
      ].join('\n');
      // Accept/Reject buttons tap back to /guild accept + decline, which
      // only honor the candidate's own pending offer (batch-22).
      try {
        const Buttons = require('../../utils/buttons');
        if (Buttons && Buttons.sendButtons) {
          await Buttons.sendButtons(sock, chatId, {
            title: '📜 GUILD CONTRACT OFFER',
            text: _offerText,
            mentions: [targetId],
            buttons: Buttons.quickReplies([
              ['✅ Accept contract', '/guild accept'],
              ['❌ Decline', '/guild decline'],
            ]),
          }, msg);
          return;
        }
      } catch (e) { /* plain fallback below */ }
      return sock.sendMessage(chatId, { text: _offerText, mentions: [targetId] }, { quoted: msg });
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
          try { require('../../rpg/utils/TransactionLog').logCredit(player, 'guild_withdraw', amount, 0, playerGuild.name); } catch (e) {}
          saveDatabase();
          return sock.sendMessage(chatId, { text: `✅ *Withdrew* 💠 ${amount.toLocaleString()} Nexus to your balance.\n🏰 Treasury now: ${(playerGuild.treasury || 0).toLocaleString()} Nexus` });
        }
        const bal = player.gold || 0;
        if (bal < amount) return sock.sendMessage(chatId, { text: `❌ You have ${bal.toLocaleString()} Nexus.` });
        player.gold = bal - amount;
        if (player.inventory) player.inventory.gold = player.gold;
        playerGuild.treasury = (playerGuild.treasury || 0) + amount;
        try { require('../../rpg/utils/TransactionLog').logSpend(player, 'guild_deposit', amount, 0, playerGuild.name); } catch (e) {}
        try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'donate', 1, sock, sender, chatId); } catch(e){}
        saveDatabase();
        return sock.sendMessage(chatId, { text: `✅ *Deposited* 💠 ${amount.toLocaleString()} Nexus to the guild.\n🏰 Treasury now: ${(playerGuild.treasury || 0).toLocaleString()} Nexus` });
      }

      if (isWithdraw) {
        const avail = playerGuild.manaTreasury || 0;
        if (avail < amount) return sock.sendMessage(chatId, { text: `❌ Treasury only has ${avail.toLocaleString()} Mana Stones.` });
        playerGuild.manaTreasury -= amount;
        player.manaCrystals = (player.manaCrystals || 0) + amount;
        try { require('../../rpg/utils/TransactionLog').logCredit(player, 'guild_withdraw', 0, amount, playerGuild.name); } catch (e) {}
        saveDatabase();
        return sock.sendMessage(chatId, { text: `✅ *Withdrew* 💎 ${amount.toLocaleString()} Mana Stones.\n🏰 Treasury now: ${(playerGuild.manaTreasury || 0).toLocaleString()} 💎` });
      }
      const bal = player.manaCrystals || 0;
      if (bal < amount) return sock.sendMessage(chatId, { text: `❌ You have ${bal.toLocaleString()} Mana Stones.` });
      player.manaCrystals = bal - amount;
      playerGuild.manaTreasury = (playerGuild.manaTreasury || 0) + amount;
      try { require('../../rpg/utils/TransactionLog').logSpend(player, 'guild_deposit', 0, amount, playerGuild.name); } catch (e) {}
      try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'donate', 1, sock, sender, chatId); } catch(e){}
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
      // Push #56: disbanding used to delete the guild object and leave every
      // member believing they were still in it (dangling `player.guild`, which
      // made /guild error and /profile lie). Free the roster first.
      const _mid2 = (m) => String((m && typeof m === 'object') ? (m.id || m.jid) : m).split(':')[0];
      const roster = [...new Set([...(playerGuild.members || []).map(_mid2), ...(playerGuild.memberData || []).map(_mid2)])];
      let freed = 0;
      for (const bare of roster) {
        for (const jid of Object.keys(db.users || {})) {
          if (String(jid).split(':')[0] !== bare) continue;
          if (db.users[jid]?.guild === playerGuild.name || db.users[jid]?.guild === playerGuild.id) {
            db.users[jid].guild = null;
            db.users[jid].guildJoinedAt = null;
            freed++;
          }
        }
      }
      try {
        for (const col of ['guildInvites', 'guildContracts']) {
          if (!db[col]) continue;
          for (const k of Object.keys(db[col])) {
            const v = db[col][k];
            if (v && (v.guildId === guildId || v.guild === playerGuild.name || v.guildName === playerGuild.name)) delete db[col][k];
          }
        }
      } catch (e) {}
      delete db.guilds[guildId];
      saveDatabase();

      return sock.sendMessage(chatId, { text: `✅ *${playerGuild.name}* has been disbanded.\n\n👥 ${freed} member(s) are now guildless — their guild records were wiped with it.\n/Guild join <name> or /guild create <name>.` });
    }

    return sock.sendMessage(chatId, {
      text: '❌ Invalid command!\n\nUse /guild for menu.'
    });
  }
};
