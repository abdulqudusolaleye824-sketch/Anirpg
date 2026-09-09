// ═══════════════════════════════════════════════════════════════
// /pass (/astrapass) — Astra Pass (50 Tiers, 40 Days)
// Free Track:
//   • Levels 1-4, 17, 33 grant Currency alone
//   • 5 Epic items (Tiers 35, 38, 42, 45, 48) + Level 50 Epic item ("Shadow Dragon Cloak")
// Premium Track:
//   • Only 5 levels grant Currency alone (Tiers 1, 2, 17, 28, 44)
//   • All other 45 levels grant Currency + Uncommon-Epic items, ending at Level 50 ("Astra's Sovereign Blade")
// ═══════════════════════════════════════════════════════════════

'use strict';

const { renderAstraPassImage } = require('../../rpg/utils/PassRenderer');
const ButtonHelper = (()=>{ try { return require('../../utils/buttonHelper'); } catch(e){ return null; } })();

const SEASON_DAYS = 40;
const TOTAL_TIERS = 50;

function isProPlayer(player) {
  if (!player) return false;
  return !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
}

// Complete reward map for ALL 50 tiers on both Free and Premium tracks
const PASS_ITEMS = {
  free: {
    // 1-4 currency alone
    5:  { name: 'Leather', type: 'material', rarity: 'common', desc: '📜 Tanned beast hide' },
    6:  { name: 'Monster Fang', type: 'material', rarity: 'common', desc: '🦴 Common monster crafting material' },
    7:  { name: 'Flint', type: 'material', rarity: 'common', desc: '🪨 Sparking crafting stone' },
    8:  { name: 'Wolf Pelt', type: 'material', rarity: 'common', desc: '🐺 Soft wolf fur pelt' },
    9:  { name: 'Coal', type: 'material', rarity: 'common', desc: '⬛ Fuel ore for forging' },
    10: { name: 'Rat Tail', type: 'material', rarity: 'common', desc: '🐀 Pest trophy material' },
    11: { name: 'Silver Ore', type: 'material', rarity: 'uncommon', desc: '⚒️ Refined crafting ore' },
    12: { name: 'Shadow Essence', type: 'material', rarity: 'uncommon', desc: '🔮 Concentrated shadow energy' },
    13: { name: 'Copper Ingot', type: 'material', rarity: 'common', desc: '🧱 Basic metal ingot' },
    14: { name: 'Spider Silk', type: 'material', rarity: 'common', desc: '🕸️ Flexible web thread' },
    15: { name: 'Shadow Pelt', type: 'material', rarity: 'uncommon', desc: '🖤 Dark beast fur' },
    16: { name: 'Dark Silk', type: 'material', rarity: 'uncommon', desc: '🧵 Woven shadow thread' },
    // 17 currency alone
    18: { name: 'Cobra Venom Sac', type: 'material', rarity: 'uncommon', desc: '🐍 Potent venom pouch' },
    19: { name: 'Steel Ingot', type: 'material', rarity: 'uncommon', desc: '🧱 Refined steel bar' },
    20: { name: 'Frost Gland', type: 'material', rarity: 'uncommon', desc: '❄️ Cold beast organ' },
    21: { name: 'Dragon Scale', type: 'material', rarity: 'rare', desc: '🐉 Toughened dragon scale for gear crafting' },
    22: { name: 'Phoenix Feather', type: 'material', rarity: 'rare', desc: '🔥 Glowing feather infused with flame' },
    23: { name: 'Wyvern Fang', type: 'material', rarity: 'rare', desc: '🦷 Sharp wyvern tooth' },
    24: { name: 'Mana Stone Horn', type: 'material', rarity: 'rare', desc: '🔮 Crystallized horn shard' },
    25: { name: 'Prismatic Shard', type: 'material', rarity: 'rare', desc: '💎 Refracting mana crystal' },
    26: { name: 'Frozen Claw', type: 'material', rarity: 'rare', desc: '🧊 Ice-encrusted monster talon' },
    27: { name: 'Obsidian', type: 'material', rarity: 'rare', desc: '⬛ Volcanic glass rock' },
    28: { name: 'Volcanic Dust', type: 'material', rarity: 'rare', desc: '🌋 Scorched ash powder' },
    29: { name: 'Thunder Essence', type: 'material', rarity: 'rare', desc: '⚡ Storm elemental energy' },
    30: { name: 'Dragon Scale', type: 'material', rarity: 'rare', desc: '🐉 Toughened dragon scale for gear crafting' },
    31: { name: 'Silver Ore', type: 'material', rarity: 'uncommon', desc: '⚒️ Refined crafting ore' },
    32: { name: 'Shadow Essence', type: 'material', rarity: 'uncommon', desc: '🔮 Concentrated shadow energy' },
    // 33 currency alone
    34: { name: 'Prismatic Shard', type: 'material', rarity: 'rare', desc: '💎 Refracting mana crystal' },
    35: { name: 'Titan Alloy', type: 'material', rarity: 'epic', desc: '🧱 Indestructible alloy used by ancient blacksmiths' }, // Epic 1
    36: { name: 'Phoenix Feather', type: 'material', rarity: 'rare', desc: '🔥 Glowing feather infused with flame' },
    37: { name: 'Wyvern Fang', type: 'material', rarity: 'rare', desc: '🦷 Sharp wyvern tooth' },
    38: { name: 'Void Shard', type: 'material', rarity: 'epic', desc: '🕳️ Crystallized void energy' }, // Epic 2
    39: { name: 'Dragon Scale', type: 'material', rarity: 'rare', desc: '🐉 Toughened dragon scale for gear crafting' },
    40: { name: 'Thunder Essence', type: 'material', rarity: 'rare', desc: '⚡ Storm elemental energy' },
    41: { name: 'Silver Ore', type: 'material', rarity: 'uncommon', desc: '⚒️ Refined crafting ore' },
    42: { name: 'Celestial Dust', type: 'material', rarity: 'epic', desc: '✨ Stardust from high-level gate realms' }, // Epic 3
    43: { name: 'Steel Ingot', type: 'material', rarity: 'uncommon', desc: '🧱 Refined steel bar' },
    44: { name: 'Wyvern Fang', type: 'material', rarity: 'rare', desc: '🦷 Sharp wyvern tooth' },
    45: { name: 'Mythic Core', type: 'material', rarity: 'epic', desc: '💎 High-grade energy core' }, // Epic 4
    46: { name: 'Shadow Essence', type: 'material', rarity: 'uncommon', desc: '🔮 Concentrated shadow energy' },
    47: { name: 'Prismatic Shard', type: 'material', rarity: 'rare', desc: '💎 Refracting mana crystal' },
    48: { name: 'Astral Core', type: 'material', rarity: 'epic', desc: '🌟 Core of astral power' }, // Epic 5
    49: { name: 'Dragon Scale', type: 'material', rarity: 'rare', desc: '🐉 Toughened dragon scale for gear crafting' },
    50: { name: 'Shadow Dragon Cloak', type: 'armor', rarity: 'epic', def: 120, hp: 400, desc: '👘 Epic cloak woven from dragon scales' }, // Epic 6 (Lvl 50)
  },
  premium: {
    // Tiers 1, 2 currency alone
    3:  { name: 'Steel Ingot', type: 'material', rarity: 'uncommon', desc: '🧱 Refined steel bar' },
    4:  { name: 'Frost Gland', type: 'material', rarity: 'uncommon', desc: '❄️ Cold beast organ' },
    5:  { name: 'Shadow Pelt', type: 'material', rarity: 'uncommon', desc: '🖤 Dark beast fur' },
    6:  { name: 'Dark Silk', type: 'material', rarity: 'uncommon', desc: '🧵 Woven shadow thread' },
    7:  { name: 'Cobra Venom Sac', type: 'material', rarity: 'uncommon', desc: '🐍 Potent venom pouch' },
    8:  { name: 'Granite Shard', type: 'material', rarity: 'uncommon', desc: '🪨 Dense golem stone' },
    9:  { name: 'Obsidian', type: 'material', rarity: 'rare', desc: '⬛ Volcanic glass rock' },
    10: { name: 'Dragon Scale', type: 'material', rarity: 'rare', desc: '🐉 Toughened dragon scale for gear crafting' },
    11: { name: 'Phoenix Feather', type: 'material', rarity: 'rare', desc: '🔥 Glowing feather infused with flame' },
    12: { name: 'Wyvern Fang', type: 'material', rarity: 'rare', desc: '🦷 Sharp wyvern tooth' },
    13: { name: 'Mana Stone Horn', type: 'material', rarity: 'rare', desc: '🔮 Crystallized horn shard' },
    14: { name: 'Prismatic Shard', type: 'material', rarity: 'rare', desc: '💎 Refracting mana crystal' },
    15: { name: 'Frozen Claw', type: 'material', rarity: 'rare', desc: '🧊 Ice-encrusted monster talon' },
    16: { name: 'Volcanic Dust', type: 'material', rarity: 'rare', desc: '🌋 Scorched ash powder' },
    // Tier 17 currency alone
    18: { name: 'Storm Shard', type: 'material', rarity: 'rare', desc: '🌩️ High-energy tempest shard' },
    19: { name: 'Abyssal Stone', type: 'material', rarity: 'epic', desc: '🕳️ Deep ocean abyss crystal' },
    20: { name: 'Titan Alloy', type: 'material', rarity: 'epic', desc: '🧱 Indestructible alloy used by ancient blacksmiths' },
    21: { name: 'Void Shard', type: 'material', rarity: 'epic', desc: '🕳️ Crystallized void energy' },
    22: { name: 'Celestial Dust', type: 'material', rarity: 'epic', desc: '✨ Stardust from high-level gate realms' },
    23: { name: 'Mythic Core', type: 'material', rarity: 'epic', desc: '💎 High-grade energy core' },
    24: { name: 'Astral Core', type: 'material', rarity: 'epic', desc: '🌟 Core of astral power' },
    25: { name: 'Tempest Core', type: 'material', rarity: 'epic', desc: '🌪️ Swirling storm core' },
    26: { name: 'Demonic Alloy', type: 'material', rarity: 'epic', desc: '😈 Forged in demon flame' },
    27: { name: 'Sovereign Steel', type: 'material', rarity: 'epic', desc: '⚔️ Heavy monarch grade steel' },
    // Tier 28 currency alone
    29: { name: 'Doom Metal', type: 'material', rarity: 'epic', desc: '☠️ Heavy dark metal' },
    30: { name: 'Dragon Bone', type: 'material', rarity: 'epic', desc: '🦴 Ancient dragon frame' },
    31: { name: 'Infernal Alloy', type: 'material', rarity: 'epic', desc: '🔥 Hellfire forged metal' },
    32: { name: 'Abyss Metal', type: 'material', rarity: 'epic', desc: '🕳️ Metal from the void realm' },
    33: { name: 'Cosmic Dust', type: 'material', rarity: 'epic', desc: '🌌 Stardust from cosmic gates' },
    34: { name: 'Ancient Alloy', type: 'material', rarity: 'epic', desc: '🗿 Ancient civilization metal' },
    35: { name: 'Eternal Metal', type: 'material', rarity: 'epic', desc: '♾️ Undying elemental metal' },
    36: { name: 'Void Alloy', type: 'material', rarity: 'epic', desc: '🕳️ Alloy infused with void energy' },
    37: { name: 'Chaos Steel', type: 'material', rarity: 'epic', desc: '💥 Chaotic forged steel' },
    38: { name: 'Primordial Alloy', type: 'material', rarity: 'epic', desc: '🌌 First forged metal' },
    39: { name: 'Shadow Sovereign Steel', type: 'material', rarity: 'epic', desc: '👑 Monarch grade shadow steel' },
    40: { name: 'Null Metal', type: 'material', rarity: 'epic', desc: '⬛ Anti-magic null metal' },
    41: { name: 'God-Forged Iron', type: 'material', rarity: 'epic', desc: '⚡ Divine anvil iron' },
    42: { name: 'Monarch Shard', type: 'material', rarity: 'epic', desc: '👑 Fragment of monarch authority' },
    43: { name: 'Eternal Flame', type: 'material', rarity: 'epic', desc: '🔥 Never ending divine flame' },
    // Tier 44 currency alone
    45: { name: 'Apocalypse Alloy', type: 'material', rarity: 'epic', desc: '☄️ Forged in world destruction' },
    46: { name: 'Divine Metal', type: 'material', rarity: 'epic', desc: '✨ Heavenly metallic ingot' },
    47: { name: 'Catastrophe Steel', type: 'material', rarity: 'epic', desc: '💥 Steel tempered in disaster' },
    48: { name: 'Reality Fragment', type: 'material', rarity: 'epic', desc: '🌌 Fragment of dimension wall' },
    49: { name: 'Mythic Core', type: 'material', rarity: 'epic', desc: '💎 High-grade energy core' },
    50: { name: "Astra's Sovereign Blade", type: 'weapon', rarity: 'legendary', atk: 180, hp: 600, crit: 15, desc: '🗡️✨ Legendary weapon granted to masters of the 40-Day Astra Pass.' },
  }
};

function getTierDisplay(t) {
  const freeNexus = 1000;
  const freeStones = 120;
  const premNexus = 3000;
  const premStones = 360;

  const freeItem = PASS_ITEMS.free[t] || null;
  const premItem = PASS_ITEMS.premium[t] || null;

  let freeStr = `+${freeNexus.toLocaleString()} 💠 | +${freeStones} 💎`;
  if (freeItem) freeStr += ` | 📦 *${freeItem.name}*`;

  let premStr = `+${premNexus.toLocaleString()} 💠 | +${premStones} 💎`;
  if (premItem) premStr += ` | 🎁 *${premItem.name}*`;

  return { freeStr, premStr, freeItem, premItem, freeNexus, freeStones, premNexus, premStones };
}

function addItemToInventory(player, item) {
  if (!item) return;
  if (!player.inventory) {
    player.inventory = { weapons: [], armor: [], potions: [], artifacts: [], accessories: [], materials: [], scrolls: [], keyStones: [], items: [] };
  }
  const type = (item.type || 'material').toLowerCase();
  if (type === 'weapon' || type === 'weapons') {
    if (!Array.isArray(player.inventory.weapons)) player.inventory.weapons = [];
    player.inventory.weapons.push({ ...item, acquiredAt: Date.now() });
  } else if (type === 'armor') {
    if (!Array.isArray(player.inventory.armor)) player.inventory.armor = [];
    player.inventory.armor.push({ ...item, acquiredAt: Date.now() });
  } else if (type === 'accessory' || type === 'ring') {
    if (!Array.isArray(player.inventory.accessories)) player.inventory.accessories = [];
    player.inventory.accessories.push({ ...item, acquiredAt: Date.now() });
  } else if (type === 'material' || type === 'materials') {
    if (!Array.isArray(player.inventory.materials)) player.inventory.materials = [];
    player.inventory.materials.push({ ...item, acquiredAt: Date.now() });
  } else {
    if (!Array.isArray(player.inventory.items)) player.inventory.items = [];
    player.inventory.items.push({ ...item, acquiredAt: Date.now() });
  }
}

module.exports = {
  name: 'pass',
  aliases: ['astrapass'],
  description: '📜 Astra Pass (50 Tiers) — Free & Premium reward tracks',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

    if (!player.astraPass) {
      player.astraPass = { level: 1, xp: 0, claimedFree: [], claimedPremium: [], seasonStart: Date.now() };
    }
    if(!player.astraPass.seasonStart) player.astraPass.seasonStart = Date.now();
    const ap = player.astraPass;
    const hasPremium = isProPlayer(player) || ap.premiumBought;

    const sub = (args[0] || '').toLowerCase();

    // ── INFO SUBCOMMAND ──────────────────────────────────────────
    if (sub === 'info' || sub === 'help' || sub === 'xp') {
      const infoText = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🏛️ *ASTRA PASS — XP & SYSTEM INFO*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `📜 *HOW TO EARN ASTRA PASS XP:*`,
        `Earn Astra Pass XP automatically from *ALL GAME ACTIVITIES*:`,
        `• 💬 Commands & Interactions: 10–100 XP`,
        `• 🌅 Daily / Weekly Claims: 100–500 XP`,
        `• ⚒️ Crafting & Forging: 50–300 XP`,
        `• ⚔️ PvP Battles & Duels: 100–500 XP`,
        `• 🏰 Gate Raids & Dungeons: 500–2,000 XP`,
        `• 🐉 World Boss Battles: 1,000–5,000 XP`,
        ``,
        `⚡ *EXP BOOSTS & MULTIPLIERS:*`,
        `• 👑 *PRO Subscription:* Gives **2x Player EXP** across all actions!`,
        `• 🏛️ *Astra Pass Premium:* Unlocks the Premium Track rewards for all 50 tiers!`,
        ``,
        `💡 *HOW TO UPGRADE TO PREMIUM:*`,
        `Upgrade to PRO via */prostore* to automatically unlock Premium Astra Pass!`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n');
      return sock.sendMessage(chatId, { text: infoText }, { quoted: msg });
    }

    // ── CLAIM REWARDS ───────────────────────────────────────────
    if (sub === 'claim') {
      const tier = parseInt(args[1]);

      if (isNaN(tier)) {
        // Claim all unlocked
        let count = 0;
        const rewardsGained = [];
        for (let t = 1; t <= Math.min(TOTAL_TIERS, ap.level); t++) {
          const tInfo = getTierDisplay(t);
          if (!ap.claimedFree.includes(t)) {
            ap.claimedFree.push(t);
            player.gold = (player.gold || 0) + tInfo.freeNexus;
            player.nexus = player.gold;
            player.manaCrystals = (player.manaCrystals || 0) + tInfo.freeStones;
            player.manaStones = player.manaCrystals;
            let str = `Tier ${t} Free: +${tInfo.freeNexus.toLocaleString()} 💠 | +${tInfo.freeStones} 💎`;
            if (tInfo.freeItem) {
              addItemToInventory(player, tInfo.freeItem);
              str += ` | 📦 *${tInfo.freeItem.name}*`;
            }
            rewardsGained.push(str);
            count++;
          }
          if (hasPremium && !ap.claimedPremium.includes(t)) {
            ap.claimedPremium.push(t);
            player.gold = (player.gold || 0) + tInfo.premNexus;
            player.nexus = player.gold;
            player.manaCrystals = (player.manaCrystals || 0) + tInfo.premStones;
            player.manaStones = player.manaCrystals;
            let str = `Tier ${t} Premium: +${tInfo.premNexus.toLocaleString()} 💠 | +${tInfo.premStones} 💎`;
            if (tInfo.premItem) {
              addItemToInventory(player, tInfo.premItem);
              str += ` | 🎁 *${tInfo.premItem.name}*`;
            }
            rewardsGained.push(str);
            count++;
          }
        }
        if (count === 0) return sock.sendMessage(chatId, { text: '❌ No unclaimed Astra Pass rewards available right now.' }, { quoted: msg });
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *ASTRA PASS REWARDS CLAIMED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nClaimed *${count}* reward(s):\n\n${rewardsGained.join('\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      if (tier < 1 || tier > TOTAL_TIERS || tier > ap.level) {
        return sock.sendMessage(chatId, { text: `❌ Invalid tier or Tier ${tier} not reached yet! Current Level: ${ap.level}` }, { quoted: msg });
      }

      const gained = [];
      const tInfo = getTierDisplay(tier);

      if (!ap.claimedFree.includes(tier)) {
        ap.claimedFree.push(tier);
        player.gold = (player.gold || 0) + tInfo.freeNexus;
        player.nexus = player.gold;
        player.manaCrystals = (player.manaCrystals || 0) + tInfo.freeStones;
        player.manaStones = player.manaCrystals;
        let str = `Free: +${tInfo.freeNexus.toLocaleString()} 💠 Nexus | +${tInfo.freeStones} 💎 Mana Stones`;
        if (tInfo.freeItem) {
          addItemToInventory(player, tInfo.freeItem);
          str += ` | 📦 *${tInfo.freeItem.name}*`;
        }
        gained.push(str);
      }
      if (hasPremium && !ap.claimedPremium.includes(tier)) {
        ap.claimedPremium.push(tier);
        player.gold = (player.gold || 0) + tInfo.premNexus;
        player.nexus = player.gold;
        player.manaCrystals = (player.manaCrystals || 0) + tInfo.premStones;
        player.manaStones = player.manaCrystals;
        let str = `Premium: +${tInfo.premNexus.toLocaleString()} 💠 Nexus | +${tInfo.premStones} 💎 Mana Stones`;
        if (tInfo.premItem) {
          addItemToInventory(player, tInfo.premItem);
          str += ` | 🎁 *${tInfo.premItem.name}*`;
        }
        gained.push(str);
      }

      if (gained.length === 0) return sock.sendMessage(chatId, { text: `❌ Tier ${tier} rewards already claimed!` }, { quoted: msg });
      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ *Tier ${tier} Claimed!*\n\n${gained.join('\n')}` }, { quoted: msg });
    }

    // Determine Page (1–5)
    let page = 1;
    const pageArg = parseInt(sub === 'page' ? args[1] : sub);
    if (!isNaN(pageArg) && pageArg >= 1 && pageArg <= 5) {
      page = pageArg;
    } else {
      page = Math.min(5, Math.max(1, Math.ceil(ap.level / 10)));
    }

    // Default Pass view — RENDERS IMAGE AND SENDS AS ONE MESSAGE
    const passData = {
      level: ap.level || 1,
      xp: ap.xp || 0,
      hasPremium,
      claimedFree: ap.claimedFree || [],
      claimedPremium: ap.claimedPremium || [],
      passItems: PASS_ITEMS,
    };

    const imageBuffer = await renderAstraPassImage(player, passData, page);

    const xpReq = 1000;
    const xpPct = Math.min(100, Math.floor(((ap.xp || 0) / xpReq) * 100));
    const xpBar = '█'.repeat(Math.floor(xpPct / 5)) + '░'.repeat(20 - Math.floor(xpPct / 5));

    // Build text tier list for this page - POKEMON-STYLE SPACING (10 per page, blank line between levels)
    const startTier = (page - 1) * 10 + 1;
    const endTier = Math.min(TOTAL_TIERS, startTier + 9);
    const tierLines = [];
    for (let tTier = startTier; tTier <= endTier; tTier++) {
      const tInfo = getTierDisplay(tTier);
      const isUnlocked = tTier <= ap.level;
      const freeClaimed = (ap.claimedFree || []).includes(tTier);
      const premClaimed = (ap.claimedPremium || []).includes(tTier);
      let statusIcon = '🔒';
      let statusText = '🔒 Locked';
      if(tTier === ap.level){
        statusIcon = '🟣';
        statusText = '🟣 Current';
      } else if(tTier < ap.level){
        const fullyClaimed = freeClaimed && (hasPremium ? premClaimed : true);
        if(fullyClaimed){ statusIcon='✅'; statusText='✅ Claimed'; }
        else { statusIcon='🟢'; statusText='🟢 Unlocked'; }
      }
      const freeItemTxt = tInfo.freeItem ? ` + ${tInfo.freeItem.name}` : '';
      const premItemTxt = tInfo.premItem ? ` + ${tInfo.premItem.name}` : '';
      tierLines.push(`Level ${tTier}: ${statusText}`);
      tierLines.push(`  Free: ${tInfo.freeNexus.toLocaleString()} 💠 | ${tInfo.freeStones} 💎${freeItemTxt}`);
      tierLines.push(`  Premium: ${tInfo.premNexus.toLocaleString()} 💠 | ${tInfo.premStones} 💎${premItemTxt}`);
      tierLines.push(``);
    }
    const navHint = page > 1 && page < 5 ? `◀️ /pass ${page-1}  •  ▶️ /pass ${page+1}` : page === 1 ? `▶️ Next: /pass 2` : `◀️ Prev: /pass 4`;

    const seasonRemaining = (()=>{ const s=ap.seasonStart||Date.now(); const e=s+SEASON_DAYS*24*60*60*1000; const d=e-Date.now(); if(d<=0) return 'Ended'; const days=Math.floor(d/(24*60*60*1000)); const hrs=Math.floor((d%(24*60*60*1000))/(60*60*1000)); return `${days}d ${hrs}h`; })();
    const captionLines = [
      `🎫 *ASTRA PASS VISUALIZATION*`,
      ``,
      `📊 Level: ${ap.level}/${TOTAL_TIERS}`,
      `⭐ XP: ${ap.xp||0}/${xpReq}`,
      `💎 Premium: ${hasPremium ? 'YES ✅' : 'NO ❌'}`,
      `⏰ Season Ends: ${seasonRemaining}`,
      ``,
      `Legend:`,
      `🟣 Current | ✅ Claimed | 🔒 Locked`,
      `💛 Gold = Premium rewards`,
      ``,
      `💡 Use /pass claim to collect rewards!`,
      ``,
      `📋 *ALL REWARDS (Page ${page}/5):*`,
      ``,
      ...tierLines,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📌 *COMMANDS:*`,
      `• /pass claim — Claim all unlocked rewards`,
      `• /pass claim [num] — Claim specific tier`,
      `• /pass [page] — View Page 1–5 (10 tiers per page)`,
      `• /pass info — Detailed XP sources & boosts`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    // ── Build Next/Prev buttons (and Claim) ────────────────────────
    let passButtons = null;
    try {
      if (ButtonHelper?.buildPassButtons) {
        passButtons = ButtonHelper.buildPassButtons(page, 5, 'pass');
      }
    } catch {}

    if (imageBuffer) {
      if (passButtons && ButtonHelper?.sendWithButtons) {
        return ButtonHelper.sendWithButtons(sock, chatId, {
          image: imageBuffer,
          caption: captionLines.join('\n'),
          mimetype: 'image/png',
          footer: `Page ${page}/5 • Tier ${ap.level}/${TOTAL_TIERS}`,
          page
        }, passButtons, msg);
      }
      return sock.sendMessage(chatId, {
        image: imageBuffer,
        caption: captionLines.join('\n'),
        mimetype: 'image/png',
      }, { quoted: msg });
    }

    if (passButtons && ButtonHelper?.sendWithButtons) {
      return ButtonHelper.sendWithButtons(sock, chatId, {
        text: captionLines.join('\n'),
        footer: `Page ${page}/5 • Tier ${ap.level}/${TOTAL_TIERS}`
      }, passButtons, msg);
    }
    return sock.sendMessage(chatId, { text: captionLines.join('\n') }, { quoted: msg });
  }
};
