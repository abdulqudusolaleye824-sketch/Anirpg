// ═══════════════════════════════════════════════════════════════
// /battlepass (/bp alias) — Seasonal Battle Pass (40 Tiers)
// Cost: 1,000 PC for Premium BP.
// 20 levels are locked to Premium.
// 5 locked levels award 200 PC each (1,000 PC total refunded at Tier 40!).
// ═══════════════════════════════════════════════════════════════

'use strict';

const TOTAL_TIERS = 40;
const BP_COST_PC = 1000;

// PC reward tiers (5 locked tiers that return 200 PC each)
const PC_REWARD_TIERS = [8, 16, 24, 32, 40];
// The 20 tiers that are locked to Premium BP:
const LOCKED_TIERS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40];

// Named item rewards for specific milestone levels
const BP_ITEMS = {
  15: { name: 'Celestial Ring', type: 'ring', rarity: 'epic', hp: 300, def: 25, desc: '💍 Glowing ring blessed by starlight' },
  30: { name: 'Titan Guard', type: 'armor', rarity: 'epic', def: 110, hp: 350, desc: '🛡️ Heavy shield crafted from titan ore' },
  20: { name: 'Shadow Fang Blade', type: 'weapon', rarity: 'epic', atk: 115, crit: 10, desc: '🗡️ Dark blade coated in shadow venom' },
  35: { name: 'Void Core Pendant', type: 'ring', rarity: 'epic', atk: 60, energy: 50, desc: '🔮 A pendant throbbing with void energy' },
  40: { name: "Dragon Emperor's Crown", type: 'ring', rarity: 'legendary', atk: 140, hp: 500, desc: '👑 Crown of the Dragon Emperor' },
};

function getBPTierRewards(t) {
  if (PC_REWARD_TIERS.includes(t)) {
    return { str: `💼 +200 PC (Procoin Refund Track!)`, item: null, pc: 200, gold: 0, stones: 0 };
  }
  const goldAmt = t * 1500;
  const stoneAmt = t * 20;
  const item = BP_ITEMS[t] || null;

  let str = `+${goldAmt.toLocaleString()} 💠 Nexus | +${stoneAmt} 💎 Mana Stones`;
  if (item) str += ` | 🎁 *${item.name}* (${item.rarity.toUpperCase()})`;

  return { str, item, pc: 0, gold: goldAmt, stones: stoneAmt };
}

function addItemToInventory(player, item) {
  if (!player.inventory) player.inventory = {};
  if (!Array.isArray(player.inventory.items)) player.inventory.items = [];
  player.inventory.items.push({ ...item, acquiredAt: Date.now() });
}

module.exports = {
  name: 'battlepass',
  aliases: ['bp'],
  description: '🎖️ Seasonal Battle Pass (40 Tiers) — 1,000 PC to unlock Premium',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

    if (!player.battlePass) {
      player.battlePass = { level: 1, xp: 0, claimed: [], premium: false };
    }
    const bp = player.battlePass;
    const sub = (args[0] || '').toLowerCase();

    // ── BUY PREMIUM BP ──────────────────────────────────────────
    if (sub === 'buy' || sub === 'premium' || sub === 'unlock') {
      if (bp.premium) {
        return sock.sendMessage(chatId, { text: '✅ You already have *Premium Battle Pass* unlocked!' }, { quoted: msg });
      }
      if ((player.procoin || 0) < BP_COST_PC) {
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎖️ *PREMIUM BATTLE PASS UNLOCK*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n💰 Cost: *${BP_COST_PC.toLocaleString()} PC*\n💼 Your Balance: *${(player.procoin || 0).toLocaleString()} PC*\n\n✨ *PREMIUM PERKS:*` +
            `\n• Unlocks all 20 Premium-Locked Tiers\n• Receive 200 PC back at Tiers 8, 16, 24, 32, 40 (1,000 PC Total Refund!)\n• Exclusive Mana Stones, Pet Eggs & Gear\n\n💡 Use /prostore to get PC, or buy with /bp buy when ready!`
        }, { quoted: msg });
      }

      player.procoin -= BP_COST_PC;
      bp.premium = true;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌟 *PREMIUM BATTLE PASS ACTIVATED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n✅ Premium Track Unlocked for ${BP_COST_PC} PC!\nAll 20 locked levels can now be claimed!\n\n💡 Claim 200 PC back at Tiers 8, 16, 24, 32, and 40!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
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
          if (r.pc > 0) {
            player.procoin = (player.procoin || 0) + r.pc;
            gained.push(`Tier ${t}: +200 PC (Procoin Return!) 💼`);
          } else {
            player.gold = (player.gold || 0) + r.gold;
            player.nexus = player.gold;
            player.manaCrystals = (player.manaCrystals || 0) + r.stones;
            player.manaStones = player.manaCrystals;
            let str = `Tier ${t}: +${r.gold.toLocaleString()} 💠 Nexus | +${r.stones} 💎 Mana Stones`;
            if (r.item) {
              addItemToInventory(player, r.item);
              str += ` | 🎁 *${r.item.name}*`;
            }
            gained.push(str);
          }
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

      if (r.pc > 0) {
        player.procoin = (player.procoin || 0) + r.pc;
        gained.push(`Tier ${targetLvl}: +200 PC (Procoin Return!) 💼`);
      } else {
        player.gold = (player.gold || 0) + r.gold;
        player.nexus = player.gold;
        player.manaCrystals = (player.manaCrystals || 0) + r.stones;
        player.manaStones = player.manaCrystals;
        let str = `Tier ${targetLvl}: +${r.gold.toLocaleString()} 💠 Nexus | +${r.stones} 💎 Mana Stones`;
        if (r.item) {
          addItemToInventory(player, r.item);
          str += ` | 🎁 *${r.item.name}*`;
        }
        gained.push(str);
      }

      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ *Tier ${targetLvl} Claimed!*\n\n${gained.join('\n')}` }, { quoted: msg });
    }

    // Default BP view — SENT AS ONE LONG SINGLE MESSAGE
    const xpReq = 500;
    const xpPct = Math.min(100, Math.floor(((bp.xp || 0) / xpReq) * 100));
    const xpBar = '█'.repeat(Math.floor(xpPct / 5)) + '░'.repeat(20 - Math.floor(xpPct / 5));

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🎖️ *SEASONAL BATTLE PASS (40 TIERS)*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 Hunter: *${player.name}*`,
      `⭐ BP Level: *Tier ${bp.level}/${TOTAL_TIERS}*`,
      `[${xpBar}] ${bp.xp || 0}/${xpReq} XP`,
      ``,
      bp.premium
        ? `👑 *PREMIUM PASS UNLOCKED ✅*`
        : `🆓 Free Pass — /bp buy to unlock Premium (${BP_COST_PC} PC)`,
      ``,
      `📌 *HOW TO EARN BATTLE PASS XP:*`,
      `Earn XP strictly from *BATTLE COMMANDS* — PvP wins, Gate Raids, Dungeon Clears, & Boss Fights!`,
      ``,
      `💡 *INFO & REFUND TRACK:*`,
      `• 20 Tiers locked to Premium BP`,
      `• Tiers 8, 16, 24, 32 & 40 award *200 PC each* (+1,000 PC total refund at Tier 40!)`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📜 *FULL 40-TIER REWARD TRACK*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
    ];

    for (let t = 1; t <= TOTAL_TIERS; t++) {
      const isUnlocked = t <= bp.level;
      const isPremiumLocked = LOCKED_TIERS.includes(t);
      const isClaimed = bp.claimed.includes(t);

      const statusIcon = isUnlocked ? (isClaimed ? '✅' : '🔓') : (isPremiumLocked ? '🔒' : '⏳');
      const lockLabel = isPremiumLocked ? ' [👑 Premium Locked]' : ' [🆓 Free Track]';
      const r = getBPTierRewards(t);

      lines.push(`${statusIcon} *Tier ${t}*${lockLabel}`);
      lines.push(`  🎁 Reward: ${r.str}`);
      lines.push(``);
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📌 /bp claim       — Claim all available rewards`);
    lines.push(`📌 /bp claim [num] — Claim specific tier reward`);
    lines.push(`📌 /bp buy         — Unlock Premium BP (1,000 PC)`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  }
};
