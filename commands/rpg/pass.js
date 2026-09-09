// ═══════════════════════════════════════════════════════════════
// /pass (/astrapass) — Astra Pass (50 Tiers, 40 Days)
// Free & Premium tracks (Premium comes automatically with PRO!)
// Every tier grants Currency (Nexus + Mana Stones) + Enumerated Named Items!
// Level 50 Free Reward: Epic Armor "Shadow Dragon Cloak"
// Level 50 Premium Reward: Legendary Weapon "Astra's Sovereign Blade"
// ═══════════════════════════════════════════════════════════════

'use strict';

const SEASON_DAYS = 40;
const TOTAL_TIERS = 50;

function isProPlayer(player) {
  if (!player) return false;
  return !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
}

// Complete reward map for ALL 50 tiers on both Free and Premium tracks
const PASS_ITEMS = {
  free: {
    1:  { name: 'Wood', type: 'material', rarity: 'common', desc: '🪵 Basic crafting wood' },
    2:  { name: 'Iron Ore', type: 'material', rarity: 'common', desc: '⚒️ Basic crafting ore' },
    3:  { name: 'Bone Fragment', type: 'material', rarity: 'common', desc: '🦴 Common skeleton bone' },
    4:  { name: 'Goblin Ear', type: 'material', rarity: 'common', desc: '👂 Goblin crafting trophy' },
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
    17: { name: 'Granite Shard', type: 'material', rarity: 'uncommon', desc: '🪨 Dense golem stone' },
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
    31: { name: 'Titan Alloy', type: 'material', rarity: 'epic', desc: '🧱 Indestructible alloy used by ancient blacksmiths' },
    32: { name: 'Void Shard', type: 'material', rarity: 'epic', desc: '🕳️ Crystallized void energy' },
    33: { name: 'Celestial Dust', type: 'material', rarity: 'epic', desc: '✨ Stardust from high-level gate realms' },
    34: { name: 'Mythic Core', type: 'material', rarity: 'epic', desc: '💎 High-grade energy core' },
    35: { name: 'Astral Core', type: 'material', rarity: 'epic', desc: '🌟 Core of astral power' },
    36: { name: 'Phoenix Feather', type: 'material', rarity: 'rare', desc: '🔥 Glowing feather infused with flame' },
    37: { name: 'Wyvern Fang', type: 'material', rarity: 'rare', desc: '🦷 Sharp wyvern tooth' },
    38: { name: 'Titan Alloy', type: 'material', rarity: 'epic', desc: '🧱 Indestructible alloy used by ancient blacksmiths' },
    39: { name: 'Void Shard', type: 'material', rarity: 'epic', desc: '🕳️ Crystallized void energy' },
    40: { name: 'Celestial Dust', type: 'material', rarity: 'epic', desc: '✨ Stardust from high-level gate realms' },
    41: { name: 'Abyssal Stone', type: 'material', rarity: 'epic', desc: '🕳️ Deep ocean abyss crystal' },
    42: { name: 'Tempest Core', type: 'material', rarity: 'epic', desc: '🌪️ Swirling storm core' },
    43: { name: 'Demonic Alloy', type: 'material', rarity: 'epic', desc: '😈 Forged in demon flame' },
    44: { name: 'Sovereign Steel', type: 'material', rarity: 'epic', desc: '⚔️ Heavy monarch grade steel' },
    45: { name: 'Ethereal Cloth', type: 'material', rarity: 'epic', desc: '👻 Phantom woven fabric' },
    46: { name: 'Doom Metal', type: 'material', rarity: 'epic', desc: '☠️ Heavy dark metal' },
    47: { name: 'Mythic Core', type: 'material', rarity: 'epic', desc: '💎 High-grade energy core' },
    48: { name: 'Astral Core', type: 'material', rarity: 'epic', desc: '🌟 Core of astral power' },
    49: { name: 'Celestial Dust', type: 'material', rarity: 'epic', desc: '✨ Stardust from high-level gate realms' },
    50: { name: 'Shadow Dragon Cloak', type: 'armor', rarity: 'epic', def: 120, hp: 400, desc: '👘 Epic cloak woven from dragon scales' },
  },
  premium: {
    1:  { name: 'Silver Ore', type: 'material', rarity: 'uncommon', desc: '⚒️ Refined crafting ore' },
    2:  { name: 'Shadow Essence', type: 'material', rarity: 'uncommon', desc: '🔮 Concentrated shadow energy' },
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
    17: { name: 'Thunder Essence', type: 'material', rarity: 'rare', desc: '⚡ Storm elemental energy' },
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
    28: { name: 'Ethereal Cloth', type: 'material', rarity: 'epic', desc: '👻 Phantom woven fabric' },
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
    44: { name: 'Null Core', type: 'material', rarity: 'epic', desc: '⬛ Core of absolute void' },
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

  const freeItem = PASS_ITEMS.free[t] || { name: 'Iron Ore', type: 'material', rarity: 'common', desc: '⚒️ Basic crafting ore' };
  const premItem = PASS_ITEMS.premium[t] || { name: 'Silver Ore', type: 'material', rarity: 'uncommon', desc: '⚒️ Refined crafting ore' };

  let freeStr = `+${freeNexus.toLocaleString()} 💠 Nexus | +${freeStones} 💎 Stones | 📦 *${freeItem.name}* (${freeItem.rarity.toUpperCase()})`;
  let premStr = `+${premNexus.toLocaleString()} 💠 Nexus | +${premStones} 💎 Stones | 🎁 *${premItem.name}* (${premItem.rarity.toUpperCase()})`;

  return { freeStr, premStr, freeItem, premItem, freeNexus, freeStones, premNexus, premStones };
}

function addItemToInventory(player, item) {
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
      player.astraPass = { level: 1, xp: 0, claimedFree: [], claimedPremium: [] };
    }
    const ap = player.astraPass;
    const hasPremium = isProPlayer(player) || ap.premiumBought;

    const sub = (args[0] || '').toLowerCase();

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
            addItemToInventory(player, tInfo.freeItem);
            rewardsGained.push(`Tier ${t} Free: +${tInfo.freeNexus.toLocaleString()} 💠 Nexus | +${tInfo.freeStones} 💎 Stones | 📦 *${tInfo.freeItem.name}*`);
            count++;
          }
          if (hasPremium && !ap.claimedPremium.includes(t)) {
            ap.claimedPremium.push(t);
            player.gold = (player.gold || 0) + tInfo.premNexus;
            player.nexus = player.gold;
            player.manaCrystals = (player.manaCrystals || 0) + tInfo.premStones;
            player.manaStones = player.manaCrystals;
            addItemToInventory(player, tInfo.premItem);
            rewardsGained.push(`Tier ${t} Premium: +${tInfo.premNexus.toLocaleString()} 💠 Nexus | +${tInfo.premStones} 💎 Stones | 🎁 *${tInfo.premItem.name}*`);
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
        addItemToInventory(player, tInfo.freeItem);
        gained.push(`Free: +${tInfo.freeNexus.toLocaleString()} 💠 Nexus | +${tInfo.freeStones} 💎 Mana Stones | 📦 *${tInfo.freeItem.name}*`);
      }
      if (hasPremium && !ap.claimedPremium.includes(tier)) {
        ap.claimedPremium.push(tier);
        player.gold = (player.gold || 0) + tInfo.premNexus;
        player.nexus = player.gold;
        player.manaCrystals = (player.manaCrystals || 0) + tInfo.premStones;
        player.manaStones = player.manaCrystals;
        addItemToInventory(player, tInfo.premItem);
        gained.push(`Premium: +${tInfo.premNexus.toLocaleString()} 💠 Nexus | +${tInfo.premStones} 💎 Mana Stones | 🎁 *${tInfo.premItem.name}*`);
      }

      if (gained.length === 0) return sock.sendMessage(chatId, { text: `❌ Tier ${tier} rewards already claimed!` }, { quoted: msg });
      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ *Tier ${tier} Claimed!*\n\n${gained.join('\n')}` }, { quoted: msg });
    }

    // Default Pass view — SENT AS ONE LONG SINGLE MESSAGE
    const xpReq = 1000;
    const xpPct = Math.min(100, Math.floor(((ap.xp || 0) / xpReq) * 100));
    const xpBar = '█'.repeat(Math.floor(xpPct / 5)) + '░'.repeat(20 - Math.floor(xpPct / 5));

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🏛️ *ASTRA PASS (SEASON 1 — 40 DAYS)*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 Hunter: *${player.name}*`,
      `⭐ Pass Level: *Tier ${ap.level}/${TOTAL_TIERS}*`,
      `[${xpBar}] ${ap.xp || 0}/${xpReq} XP`,
      ``,
      hasPremium
        ? `👑 *PREMIUM UNLOCKED* (Included with PRO / Activated)`
        : `🆓 *FREE TIER* — Upgrade to PRO (/prostore) to automatically unlock Premium!`,
      ``,
      `📌 *HOW TO EARN ASTRA PASS XP:*`,
      `Earn XP from *ALL ACTIVITIES* — Daily claims, Quests, Battles, Crafting, & Commands!`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📜 *FULL 50-TIER REWARD TRACK*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
    ];

    for (let t = 1; t <= TOTAL_TIERS; t++) {
      const isUnlocked = t <= ap.level;
      const statusIcon = isUnlocked ? '🔓' : '🔒';
      const freeClaimed = ap.claimedFree.includes(t) ? ' [✅ Free]' : '';
      const premClaimed = ap.claimedPremium.includes(t) ? ' [✅ Prem]' : '';
      const tInfo = getTierDisplay(t);

      lines.push(`${statusIcon} *Tier ${t}*${freeClaimed}${premClaimed}`);
      lines.push(`  🆓 Free: ${tInfo.freeStr}`);
      lines.push(`  👑 Prem: ${tInfo.premStr}`);
      lines.push(``);
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📌 /pass claim       — Claim all unlocked rewards`);
    lines.push(`📌 /pass claim [num] — Claim specific tier reward`);
    lines.push(`📌 /prostore         — Buy PRO card to get Auto-Premium!`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  }
};
