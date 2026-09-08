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

function getBPTierRewards(t) {
  if (PC_REWARD_TIERS.includes(t)) {
    return `💼 +200 PC (Procoin Refund Track!)`;
  }
  const goldAmt = t * 1500;
  const stoneAmt = t * 20;
  return `+${goldAmt.toLocaleString()} 💠 Nexus | +${stoneAmt} 💎 Mana Stones`;
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

          if (PC_REWARD_TIERS.includes(t)) {
            player.procoin = (player.procoin || 0) + 200;
            gained.push(`Tier ${t}: +200 PC (Procoin Return!) 💼`);
          } else {
            const goldAmt = t * 1500;
            const stoneAmt = t * 20;
            player.gold = (player.gold || 0) + goldAmt;
            player.manaCrystals = (player.manaCrystals || 0) + stoneAmt;
            gained.push(`Tier ${t}: +${goldAmt.toLocaleString()} 💠 Nexus | +${stoneAmt} 💎 Mana Stones`);
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

      if (PC_REWARD_TIERS.includes(targetLvl)) {
        player.procoin = (player.procoin || 0) + 200;
        gained.push(`Tier ${targetLvl}: +200 PC (Procoin Return!) 💼`);
      } else {
        const goldAmt = targetLvl * 1500;
        const stoneAmt = targetLvl * 20;
        player.gold = (player.gold || 0) + goldAmt;
        player.manaCrystals = (player.manaCrystals || 0) + stoneAmt;
        gained.push(`Tier ${targetLvl}: +${goldAmt.toLocaleString()} 💠 Nexus | +${stoneAmt} 💎 Mana Stones`);
      }

      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ *Tier ${targetLvl} Claimed!*\n\n${gained.join('\n')}` }, { quoted: msg });
    }

    // Default BP view
    const xpReq = 500;
    const xpPct = Math.min(100, Math.floor(((bp.xp || 0) / xpReq) * 100));
    const xpBar = '█'.repeat(Math.floor(xpPct / 5)) + '░'.repeat(20 - Math.floor(xpPct / 5));

    const overviewHeader = [
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
      `📌 /bp claim       — Claim all available rewards`,
      `📌 /bp claim [num] — Claim specific tier reward`,
      `📌 /bp buy         — Unlock Premium BP (1,000 PC)`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');

    // Build levels breakdown in 2 chunks (Tiers 1-20 and Tiers 21-40)
    let chunk1 = `🎖️ *BATTLE PASS — TIERS 1 TO 20*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    for (let t = 1; t <= 20; t++) {
      const isUnlocked = t <= bp.level;
      const isPremiumLocked = LOCKED_TIERS.includes(t);
      const isClaimed = bp.claimed.includes(t);

      const statusIcon = isUnlocked ? (isClaimed ? '✅' : '🔓') : (isPremiumLocked ? '🔒' : '⏳');
      const lockLabel = isPremiumLocked ? ' [👑 Premium Locked]' : ' [🆓 Free Track]';
      const rewards = getBPTierRewards(t);

      chunk1 += `${statusIcon} *Tier ${t}*${lockLabel}\n  🎁 Reward: ${rewards}\n\n`;
    }

    let chunk2 = `🎖️ *BATTLE PASS — TIERS 21 TO 40*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    for (let t = 21; t <= 40; t++) {
      const isUnlocked = t <= bp.level;
      const isPremiumLocked = LOCKED_TIERS.includes(t);
      const isClaimed = bp.claimed.includes(t);

      const statusIcon = isUnlocked ? (isClaimed ? '✅' : '🔓') : (isPremiumLocked ? '🔒' : '⏳');
      const lockLabel = isPremiumLocked ? ' [👑 Premium Locked]' : ' [🆓 Free Track]';
      const rewards = getBPTierRewards(t);

      chunk2 += `${statusIcon} *Tier ${t}*${lockLabel}\n  🎁 Reward: ${rewards}\n\n`;
    }

    return sock.sendMessage(chatId, {
      sections: [
        { text: overviewHeader },
        { text: chunk1 },
        { text: chunk2 },
      ]
    });
  }
};
