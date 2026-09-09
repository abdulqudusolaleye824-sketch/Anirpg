// ═══════════════════════════════════════════════════════════════
// /battlepass (/bp alias) — Seasonal Battle Pass (40 Tiers, 30 Days)
// Cost: 1,000 PC for Premium BP. — 30 Day Season
// 4 levels grant Currency alone (Free: L1, L2, L3 | Prem: L7)
// All other 36 levels grant Currency + Items / PC Refunds!
// 20 levels are locked to Premium.
// 5 locked levels award 200 PC each (1,000 PC total refunded at Tier 40!).
// ═══════════════════════════════════════════════════════════════

'use strict';

const { renderBattlePassImage } = require('../../rpg/utils/PassRenderer');
const ButtonHelper = (()=>{ try { return require('../../utils/buttonHelper'); } catch(e){ return null; } })();

const TOTAL_TIERS = 40;
const BP_COST_PC = 1000;

function isProPlayer(player) {
  if (!player) return false;
  return !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
}

// PC reward tiers (5 locked tiers that return 200 PC each)
const PC_REWARD_TIERS = [8, 16, 24, 32, 40];
// The 20 tiers that are locked to Premium BP:
const LOCKED_TIERS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40];

// Complete item map for Battle Pass (Levels 1, 2, 3 give currency alone, Level 7 gives currency alone)
const BP_ITEMS = {
  // 1, 2, 3 currency alone
  4:  { name: 'Shadow Essence', type: 'material', rarity: 'uncommon', desc: '🔮 Concentrated shadow energy' },
  5:  { name: 'Steel Ingot', type: 'material', rarity: 'uncommon', desc: '🧱 Refined steel bar' },
  6:  { name: 'Dark Silk', type: 'material', rarity: 'uncommon', desc: '🧵 Woven shadow thread' },
  // 7 currency alone
  8:  { name: 'Obsidian', type: 'material', rarity: 'rare', desc: '⬛ Volcanic glass rock' },
  9:  { name: 'Dragon Scale', type: 'material', rarity: 'rare', desc: '🐉 Toughened dragon scale for gear crafting' },
  10: { name: 'Phoenix Feather', type: 'material', rarity: 'rare', desc: '🔥 Glowing feather infused with flame' },
  11: { name: 'Wyvern Fang', type: 'material', rarity: 'rare', desc: '🦷 Sharp wyvern tooth' },
  12: { name: 'Mana Stone Horn', type: 'material', rarity: 'rare', desc: '🔮 Crystallized horn shard' },
  13: { name: 'Prismatic Shard', type: 'material', rarity: 'rare', desc: '💎 Refracting mana crystal' },
  14: { name: 'Volcanic Dust', type: 'material', rarity: 'rare', desc: '🌋 Scorched ash powder' },
  15: { name: 'Celestial Ring', type: 'ring', rarity: 'epic', hp: 300, def: 25, desc: '💍 Glowing ring blessed by starlight' }, // Free Epic 1
  16: { name: 'Titan Alloy', type: 'material', rarity: 'epic', desc: '🧱 Indestructible alloy used by ancient blacksmiths' },
  17: { name: 'Void Shard', type: 'material', rarity: 'epic', desc: '🕳️ Crystallized void energy' },
  18: { name: 'Celestial Dust', type: 'material', rarity: 'epic', desc: '✨ Stardust from high-level gate realms' },
  19: { name: 'Mythic Core', type: 'material', rarity: 'epic', desc: '💎 High-grade energy core' },
  20: { name: 'Shadow Fang Blade', type: 'weapon', rarity: 'epic', atk: 115, crit: 10, desc: '🗡️ Dark blade coated in shadow venom' }, // Premium Epic
  21: { name: 'Astral Core', type: 'material', rarity: 'epic', desc: '🌟 Core of astral power' },
  22: { name: 'Tempest Core', type: 'material', rarity: 'epic', desc: '🌪️ Swirling storm core' },
  23: { name: 'Demonic Alloy', type: 'material', rarity: 'epic', desc: '😈 Forged in demon flame' },
  24: { name: 'Sovereign Steel', type: 'material', rarity: 'epic', desc: '⚔️ Heavy monarch grade steel' },
  25: { name: 'Ethereal Cloth', type: 'material', rarity: 'epic', desc: '👻 Phantom woven fabric' },
  26: { name: 'Doom Metal', type: 'material', rarity: 'epic', desc: '☠️ Heavy dark metal' },
  27: { name: 'Dragon Bone', type: 'material', rarity: 'epic', desc: '🦴 Ancient dragon frame' },
  28: { name: 'Infernal Alloy', type: 'material', rarity: 'epic', desc: '🔥 Hellfire forged metal' },
  29: { name: 'Abyss Metal', type: 'material', rarity: 'epic', desc: '🕳️ Metal from the void realm' },
  30: { name: 'Titan Guard', type: 'armor', rarity: 'epic', def: 110, hp: 350, desc: '🛡️ Heavy shield crafted from titan ore' }, // Free Epic 2
  31: { name: 'Cosmic Dust', type: 'material', rarity: 'epic', desc: '🌌 Stardust from cosmic gates' },
  32: { name: 'Ancient Alloy', type: 'material', rarity: 'epic', desc: '🗿 Ancient civilization metal' },
  33: { name: 'Eternal Metal', type: 'material', rarity: 'epic', desc: '♾️ Undying elemental metal' },
  34: { name: 'Void Alloy', type: 'material', rarity: 'epic', desc: '🕳️ Alloy infused with void energy' },
  35: { name: 'Void Core Pendant', type: 'ring', rarity: 'epic', atk: 60, energy: 50, desc: '🔮 A pendant throbbing with void energy' }, // Premium Epic
  36: { name: 'Chaos Steel', type: 'material', rarity: 'epic', desc: '💥 Chaotic forged steel' },
  37: { name: 'Primordial Alloy', type: 'material', rarity: 'epic', desc: '🌌 First forged metal' },
  38: { name: 'Shadow Sovereign Steel', type: 'material', rarity: 'epic', desc: '👑 Monarch grade shadow steel' },
  39: { name: 'God-Forged Iron', type: 'material', rarity: 'epic', desc: '⚡ Divine anvil iron' },
  40: { name: "Dragon Emperor's Crown", type: 'ring', rarity: 'legendary', atk: 140, hp: 500, desc: '👑 Crown of the Dragon Emperor' }, // Premium Legendary
};

function getBPTierRewards(t) {
  const goldAmt = t * 1500;
  const stoneAmt = t * 20;
  const item = BP_ITEMS[t] || null;
  const hasPC = PC_REWARD_TIERS.includes(t);
  const pc = hasPC ? 200 : 0;

  let str = `+${goldAmt.toLocaleString()} 💠 Nexus | +${stoneAmt} 💎 Stones`;
  if (hasPC) str += ` | 💼 *+200 PC Return!*`;
  if (item) str += ` | 🎁 *${item.name}*`;

  return { str, item, pc, gold: goldAmt, stones: stoneAmt };
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
  name: 'battlepass',
  aliases: ['bp'],
  description: '🎖️ Seasonal Battle Pass (40 Tiers, 30 Days) — 1,000 PC to unlock Premium',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

    if (!player.battlePass) {
      player.battlePass = { level: 1, xp: 0, claimed: [], premium: false, seasonStart: Date.now() };
    }
    if(!player.battlePass.seasonStart) player.battlePass.seasonStart = Date.now();
    const bp = player.battlePass;
    const sub = (args[0] || '').toLowerCase();

    // ── INFO SUBCOMMAND ──────────────────────────────────────────
    if (sub === 'info' || sub === 'help' || sub === 'xp') {
      const isPro = isProPlayer(player);
      const isPrem = bp.premium;
      let expRate = '1x';
      if (isPro && isPrem) expRate = '4x (PRO 2x × BP Premium 2x)';
      else if (isPro || isPrem) expRate = '2x Boost Active';

      const infoText = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🎖️ *BATTLE PASS — XP & SYSTEM INFO*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `⚔️ *HOW TO EARN BATTLE PASS XP:*`,
        `Earn Battle Pass XP strictly from *BATTLE ACTIVITIES*:`,
        `• ⚔️ PvP Wins & Duels: 100–500 BP XP`,
        `• 🏰 Gate Raids & Dungeons: 200–800 BP XP`,
        `• 🐉 World Boss Battles & Kills: 500–2,000 BP XP`,
        ``,
        `🔥 *EXP BOOSTS & MULTIPLIERS:*`,
        `• 🆓 *Standard User:* 1x BP EXP`,
        `• 👑 *BP Premium:* **2x BP EXP** boost on all battle activities!`,
        `• 🌟 *PRO Player + BP Premium:* **4x BP EXP** (Pro 2x × BP Premium 2x = 4x)!`,
        `• ⚡ *Your Current Rate:* **${expRate}**`,
        ``,
        `💰 *PREMIUM REFUND TRACK:*`,
        `• Unlock Premium for **1,000 PC** (/bp buy)`,
        `• Tiers 8, 16, 24, 32, and 40 return **200 PC each** (Full 1,000 PC Refunded at Tier 40!).`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n');
      return sock.sendMessage(chatId, { text: infoText }, { quoted: msg });
    }

    // ── BUY PREMIUM BP ──────────────────────────────────────────
    if (sub === 'buy' || sub === 'premium' || sub === 'unlock') {
      if (bp.premium) {
        return sock.sendMessage(chatId, { text: '✅ You already have *Premium Battle Pass* unlocked!' }, { quoted: msg });
      }
      if ((player.procoin || 0) < BP_COST_PC) {
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎖️ *PREMIUM BATTLE PASS UNLOCK*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n💰 Cost: *${BP_COST_PC.toLocaleString()} PC*\n💼 Your Balance: *${(player.procoin || 0).toLocaleString()} PC*\n\n✨ *PREMIUM PERKS:*` +
            `\n• Unlocks all 20 Premium-Locked Tiers\n• **2x BP EXP Boost** on all Battle XP!\n• Combine with PRO for **4x BP EXP**!\n• Receive 200 PC back at Tiers 8, 16, 24, 32, 40 (1,000 PC Total Refund!)\n\n💡 Use /prostore to get PC, or buy with /bp buy when ready!`
        }, { quoted: msg });
      }

      player.procoin -= BP_COST_PC;
      bp.premium = true;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌟 *PREMIUM BATTLE PASS ACTIVATED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n✅ Premium Track Unlocked for ${BP_COST_PC} PC!\nAll 20 locked levels can now be claimed!\n\n🔥 **2x BP EXP Boost Activated!**\n💡 Claim 200 PC back at Tiers 8, 16, 24, 32, and 40!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── CLAIM REWARDS ───────────────────────────────────────────
    if (sub === 'claim') {
      const targetLvl = parseInt(args[1]);

      if (isNaN(targetLvl)) {
        let totalClaimed = 0;
        const gained = [];

        for (let t = 1; t <= Math.min(TOTAL_TIERS, bp.level); t++) {
          if (bp.claimed.includes(t)) continue;
          const isLocked = LOCKED_TIERS.includes(t);
          if (isLocked && !bp.premium) continue; // Skip locked tiers for free users

          bp.claimed.push(t);
          totalClaimed++;

          const r = getBPTierRewards(t);
          player.gold = (player.gold || 0) + r.gold;
          player.nexus = player.gold;
          player.manaCrystals = (player.manaCrystals || 0) + r.stones;
          player.manaStones = player.manaCrystals;
          if (r.pc > 0) player.procoin = (player.procoin || 0) + r.pc;
          if (r.item) addItemToInventory(player, r.item);

          let str = `Tier ${t}: +${r.gold.toLocaleString()} 💠 | +${r.stones} 💎`;
          if (r.pc > 0) str += ` | 💼 +200 PC Return!`;
          if (r.item) str += ` | 🎁 *${r.item.name}*`;
          gained.push(str);
        }

        if (totalClaimed === 0) {
          const hasLockedUnclaimed = LOCKED_TIERS.some(t => t <= bp.level && !bp.claimed.includes(t));
          if (hasLockedUnclaimed && !bp.premium) {
            return sock.sendMessage(chatId, { text: '🔒 Unclaimed levels are Premium-Locked! Use /bp buy to unlock Premium for 1,000 PC.' }, { quoted: msg });
          }
          return sock.sendMessage(chatId, { text: '❌ No unclaimed Battle Pass rewards available.' }, { quoted: msg });
        }

        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *BATTLE PASS REWARDS CLAIMED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nClaimed *${totalClaimed}* Tier(s)!\n\n${gained.join('\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      if (targetLvl < 1 || targetLvl > TOTAL_TIERS || targetLvl > bp.level) {
        return sock.sendMessage(chatId, { text: `❌ Tier ${targetLvl} invalid or not reached yet! Current Level: ${bp.level}` }, { quoted: msg });
      }

      if (bp.claimed.includes(targetLvl)) {
        return sock.sendMessage(chatId, { text: `❌ Tier ${targetLvl} reward already claimed!` }, { quoted: msg });
      }

      const isLocked = LOCKED_TIERS.includes(targetLvl);
      if (isLocked && !bp.premium) {
        return sock.sendMessage(chatId, { text: `🔒 Tier ${targetLvl} is locked to Premium Battle Pass! Use /bp buy to unlock for 1,000 PC.` }, { quoted: msg });
      }

      bp.claimed.push(targetLvl);
      const gained = [];
      const r = getBPTierRewards(targetLvl);

      player.gold = (player.gold || 0) + r.gold;
      player.nexus = player.gold;
      player.manaCrystals = (player.manaCrystals || 0) + r.stones;
      player.manaStones = player.manaCrystals;
      if (r.pc > 0) player.procoin = (player.procoin || 0) + r.pc;
      if (r.item) addItemToInventory(player, r.item);

      let str = `Tier ${targetLvl}: +${r.gold.toLocaleString()} 💠 Nexus | +${r.stones} 💎 Mana Stones`;
      if (r.pc > 0) str += ` | 💼 +200 PC Return!`;
      if (r.item) str += ` | 🎁 *${r.item.name}*`;
      gained.push(str);

      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ *Tier ${targetLvl} Claimed!*\n\n${gained.join('\n')}` }, { quoted: msg });
    }

    // Determine Page (1–4)
    let page = 1;
    const pageArg = parseInt(sub === 'page' ? args[1] : sub);
    if (!isNaN(pageArg) && pageArg >= 1 && pageArg <= 4) {
      page = pageArg;
    } else {
      page = Math.min(4, Math.max(1, Math.ceil(bp.level / 10)));
    }

    // Default BP view — RENDERS IMAGE AND SENDS AS ONE MESSAGE
    const bpData = {
      level: bp.level || 1,
      xp: bp.xp || 0,
      premium: bp.premium,
      claimed: bp.claimed || [],
      bpItems: BP_ITEMS,
      lockedTiers: LOCKED_TIERS,
      pcTiers: PC_REWARD_TIERS,
    };

    const imageBuffer = await renderBattlePassImage(player, bpData, page);

    const xpReq = 500;
    const xpPct = Math.min(100, Math.floor(((bp.xp || 0) / xpReq) * 100));
    const xpBar = '█'.repeat(Math.floor(xpPct / 5)) + '░'.repeat(20 - Math.floor(xpPct / 5));

    const isPro = isProPlayer(player);
    let boostTag = '';
    if (isPro && bp.premium) boostTag = ' 🔥 4x EXP Boost';
    else if (isPro || bp.premium) boostTag = ' 🔥 2x EXP Boost';

    // Build text tier list for this page — POKEMON-STYLE SPACING (10 per page)
    const startTier = (page - 1) * 10 + 1;
    const endTier = Math.min(TOTAL_TIERS, startTier + 9);
    const tierLines = [];
    for (let tTier = startTier; tTier <= endTier; tTier++) {
      const r = getBPTierRewards(tTier);
      const isUnlocked = tTier <= bp.level;
      const isLocked = LOCKED_TIERS.includes(tTier);
      const isClaimed = (bp.claimed || []).includes(tTier);
      let statusText = '🔒 Locked';
      if(tTier === bp.level){ statusText='🟣 Current'; }
      else if(tTier < bp.level){
        if(isLocked && !bp.premium){ statusText='🔒 Premium Locked'; }
        else if(isClaimed){ statusText='✅ Claimed'; }
        else { statusText='🟢 Unlocked'; }
      } else if(isUnlocked){
        if(isLocked && !bp.premium){ statusText='🔒 Premium Locked'; }
        else if(isClaimed){ statusText='✅ Claimed'; }
        else { statusText='🟢 Unlocked'; }
      }
      const pcTxt = r.pc ? ` + 200 PC` : '';
      const itemTxt = r.item ? ` + ${r.item.name}` : '';
      const premiumTag = isLocked ? ' (Premium)' : '';
      tierLines.push(`Level ${tTier}: ${statusText}`);
      tierLines.push(`  Rewards: ${r.gold.toLocaleString()} 💠 | ${r.stones} 💎${pcTxt}${itemTxt}${premiumTag}`);
      tierLines.push(``);
    }
    const navHintBP = page > 1 && page < 4 ? `◀️ /bp ${page-1}  •  ▶️ /bp ${page+1}` : page === 1 ? `▶️ Next: /bp 2` : `◀️ Prev: /bp 3`;

    const seasonRemainingBP = (()=>{ const s=bp.seasonStart||Date.now(); const e=s+30*24*60*60*1000; const d=e-Date.now(); if(d<=0) return 'Ended'; const days=Math.floor(d/(24*60*60*1000)); const hrs=Math.floor((d%(24*60*60*1000))/(60*60*1000)); return `${days}d ${hrs}h`; })();
    const captionLines = [
      `🎫 *BATTLE PASS VISUALIZATION*`,
      ``,
      `📊 Level: ${bp.level}/${TOTAL_TIERS}`,
      `⭐ XP: ${bp.xp||0}/${xpReq}`,
      `💎 Premium: ${bp.premium ? 'YES ✅' : 'NO ❌'}`,
      `⏰ Season Ends: ${seasonRemainingBP}`,
      ``,
      `Legend:`,
      `🟣 Current | ✅ Claimed | 🔒 Locked`,
      `💛 Gold = Premium rewards`,
      ``,
      `💡 Use /bp claim to collect rewards!`,
      ``,
      `📋 *ALL REWARDS (Page ${page}/4):*`,
      ``,
      ...tierLines,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📌 *COMMANDS:*`,
      `• /bp claim — Claim all available rewards`,
      `• /bp claim [num] — Claim specific tier`,
      `• /bp buy — Unlock Premium (1,000 PC)`,
      `• /bp [page] — View Page 1–4 (10 tiers per page)`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    // ── Build Next/Prev buttons (and Claim) ────────────────────────
    let bpButtons = null;
    try {
      if (ButtonHelper?.buildPassButtons) {
        bpButtons = ButtonHelper.buildPassButtons(page, 4, 'bp');
      }
    } catch {}

    if (imageBuffer) {
      if (bpButtons && ButtonHelper?.sendWithButtons) {
        return ButtonHelper.sendWithButtons(sock, chatId, {
          image: imageBuffer,
          caption: captionLines.join('\n'),
          mimetype: 'image/png',
          footer: `Page ${page}/4 • Tier ${bp.level}/${TOTAL_TIERS}`,
          page
        }, bpButtons, msg);
      }
      return sock.sendMessage(chatId, {
        image: imageBuffer,
        caption: captionLines.join('\n'),
        mimetype: 'image/png',
      }, { quoted: msg });
    }

    if (bpButtons && ButtonHelper?.sendWithButtons) {
      return ButtonHelper.sendWithButtons(sock, chatId, {
        text: captionLines.join('\n'),
        footer: `Page ${page}/4 • Tier ${bp.level}/${TOTAL_TIERS}`
      }, bpButtons, msg);
    }
    return sock.sendMessage(chatId, { text: captionLines.join('\n') }, { quoted: msg });
  }
};
