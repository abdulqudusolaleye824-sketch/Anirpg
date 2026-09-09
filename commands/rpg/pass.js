// ═══════════════════════════════════════════════════════════════
// /pass (/astrapass) — Astra Pass (50 Tiers, 40 Days)
// Free & Premium tracks (Premium comes automatically with PRO!)
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

// Fixed seasonal reward map for all 50 tiers
const PASS_ITEMS = {
  free: {
    5:  { name: 'Iron Ore', type: 'material', rarity: 'common', desc: '⚒️ Basic crafting ore' },
    10: { name: 'Monster Fang', type: 'material', rarity: 'common', desc: '🦴 Common monster crafting material' },
    15: { name: 'Silver Ore', type: 'material', rarity: 'uncommon', desc: '⚒️ Refined crafting ore' },
    20: { name: 'Shadow Essence', type: 'material', rarity: 'uncommon', desc: '🔮 Concentrated shadow energy' },
    25: { name: 'Dragon Scale', type: 'material', rarity: 'rare', desc: '🐉 Toughened dragon scale for gear crafting' },
    30: { name: 'Phoenix Feather', type: 'material', rarity: 'rare', desc: '🔥 Glowing feather infused with flame' },
    35: { name: 'Titan Alloy', type: 'material', rarity: 'epic', desc: '🧱 Indestructible alloy used by ancient blacksmiths' },
    40: { name: 'Void Shard', type: 'material', rarity: 'epic', desc: '🕳️ Crystallized void energy' },
    45: { name: 'Celestial Dust', type: 'material', rarity: 'epic', desc: '✨ Stardust from high-level gate realms' },
    50: { name: 'Shadow Dragon Cloak', type: 'armor', rarity: 'epic', def: 120, hp: 400, desc: '👘 Epic cloak woven from dragon scales' },
  },
  premium: {
    5:  { name: 'Silver Ore', type: 'material', rarity: 'uncommon', desc: '⚒️ Refined crafting ore' },
    10: { name: 'Shadow Essence', type: 'material', rarity: 'uncommon', desc: '🔮 Concentrated shadow energy' },
    15: { name: 'Dragon Scale', type: 'material', rarity: 'rare', desc: '🐉 Toughened dragon scale for gear crafting' },
    20: { name: 'Phoenix Feather', type: 'material', rarity: 'rare', desc: '🔥 Glowing feather infused with flame' },
    25: { name: 'Titan Alloy', type: 'material', rarity: 'epic', desc: '🧱 Indestructible alloy used by ancient blacksmiths' },
    30: { name: 'Void Shard', type: 'material', rarity: 'epic', desc: '🕳️ Crystallized void energy' },
    35: { name: 'Celestial Dust', type: 'material', rarity: 'epic', desc: '✨ Stardust from high-level gate realms' },
    40: { name: 'Mythic Core', type: 'material', rarity: 'epic', desc: '💎 High-grade energy core' },
    45: { name: 'Astral Core', type: 'material', rarity: 'epic', desc: '🌟 Core of astral power' },
    50: { name: "Astra's Sovereign Blade", type: 'weapon', rarity: 'legendary', atk: 180, hp: 600, crit: 15, desc: '🗡️✨ Legendary weapon granted to masters of the 40-Day Astra Pass.' },
  }
};

function getTierDisplay(t) {
  const freeNexus = 1000;
  const freeStones = 120;
  const premNexus = 3000;
  const premStones = 360;

  const freeItem = PASS_ITEMS.free[t];
  const premItem = PASS_ITEMS.premium[t];

  let freeStr = `+${freeNexus.toLocaleString()} 💠 | +${freeStones} 💎`;
  if (freeItem) freeStr += ` | 📦 *${freeItem.name}* (${freeItem.rarity.toUpperCase()})`;

  let premStr = `+${premNexus.toLocaleString()} 💠 | +${premStones} 💎`;
  if (premItem) premStr += ` | 🎁 *${premItem.name}* (${premItem.rarity.toUpperCase()})`;

  return { freeStr, premStr, freeItem, premItem, freeNexus, freeStones, premNexus, premStones };
}

function addItemToInventory(player, item) {
  if (!player.inventory) player.inventory = {};
  if (!Array.isArray(player.inventory.items)) player.inventory.items = [];
  player.inventory.items.push({ ...item, acquiredAt: Date.now() });
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
            player.manaCrystals = (player.manaCrystals || 0) + tInfo.freeStones;
            let str = `Tier ${t} Free: +${tInfo.freeNexus.toLocaleString()} 💠 Nexus | +${tInfo.freeStones} 💎 Stones`;
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
            player.manaCrystals = (player.manaCrystals || 0) + tInfo.premStones;
            let str = `Tier ${t} Premium: +${tInfo.premNexus.toLocaleString()} 💠 Nexus | +${tInfo.premStones} 💎 Stones`;
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
        player.manaCrystals = (player.manaCrystals || 0) + tInfo.freeStones;
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
        player.manaCrystals = (player.manaCrystals || 0) + tInfo.premStones;
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
