// ═══════════════════════════════════════════════════════════════
// /battlepass (/bp alias) — Monthly Seasonal Battle Pass
// ═══════════════════════════════════════════════════════════════

'use strict';

const BP = require('../../rpg/utils/BattlePass');
const SEASON_DAYS = BP.SEASON_DURATION_DAYS || 30;

module.exports = {
  name: 'battlepass',
  aliases: ['bp'],
  description: '🎖️ Monthly Seasonal Battle Pass (Free & Premium tracks)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });

    const sub = (args[0] || '').toLowerCase();
    const bp = BP.getPassState(player);
    const s = BP.CURRENT_SEASON;

    if (sub === 'buy' || sub === 'premium' || sub === 'upgrade') {
      if (bp.premium) return sock.sendMessage(chatId, { text: '✅ You already have the *Premium Battle Pass*! 🌟' }, { quoted: msg });
      if ((player.manaCrystals || 0) < s.premiumCost) {
        return sock.sendMessage(chatId, {
          text: `💎 *PREMIUM BATTLE PASS*\n\n${s.emoji} *${s.name}*\n\nUnlock all 50 level rewards including:\n🎟️ Summon Tickets\n🥚 Exclusive Season Pet Egg (Lv 25)\n⚔️ Season Exclusive Weapon (Lv 50)\n💎 Extra Mana Stones\n\n*Cost: ${s.premiumCost} 💎*\nHave: ${player.manaCrystals || 0} 💎`
        }, { quoted: msg });
      }
      player.manaCrystals -= s.premiumCost;
      bp.premium = true;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌟 *PREMIUM BATTLE PASS ACTIVATED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${s.emoji} *${s.name}*\n\n✅ Premium track unlocked!\nUse /bp claim to collect your rewards!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    if (sub === 'claim') {
      const targetLvl = parseInt(args[1]);
      const track = BP.getRewardTrack();

      if (isNaN(targetLvl)) {
        let totalClaimed = 0;
        const allGained = [];
        for (const row of track) {
          if (row.lvl > bp.level) break;
          if (bp.claimed.includes(row.lvl)) continue;
          const result = BP.claimReward(player, row.lvl);
          if (result.success) { totalClaimed++; allGained.push(...result.gained); }
        }
        if (!totalClaimed) return sock.sendMessage(chatId, { text: '❌ No unclaimed Battle Pass rewards right now.' }, { quoted: msg });
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *BATTLE PASS REWARDS CLAIMED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nClaimed *${totalClaimed}* level(s)!\n\n${allGained.join('\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      const result = BP.claimReward(player, targetLvl);
      if (!result.success) return sock.sendMessage(chatId, { text: `❌ ${result.reason}` }, { quoted: msg });
      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ *Level ${targetLvl} claimed!*\n\n${result.gained.join('\n')}` }, { quoted: msg });
    }

    // Default overview
    const xpToNext = BP.XP_PER_LEVEL;
    const xpPct = Math.min(100, Math.floor((bp.xp / xpToNext) * 100));
    const xpBar = '█'.repeat(Math.floor(xpPct / 5)) + '░'.repeat(20 - Math.floor(xpPct / 5));

    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `${s.emoji} *${s.name.toUpperCase()} (BATTLE PASS)*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `⭐ *Level ${bp.level}/${BP.PASS_LEVELS}*`,
        `[${xpBar}] ${bp.xp}/${xpToNext} XP`,
        ``,
        bp.premium ? `💎 *PREMIUM PASS UNLOCKED ✅*` : `🆓 Free Pass — /bp buy for Premium (${s.premiumCost}💎)`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📌 /bp claim    — Collect all unlocked rewards`,
        `📌 /bp buy      — Upgrade to Premium Track`,
        `📌 /bp rewards  — View full 50-level reward track`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    }, { quoted: msg });
  }
};
