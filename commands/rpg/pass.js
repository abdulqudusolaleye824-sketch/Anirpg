// ═══════════════════════════════════════════════════════════════
// /pass (/astrapass) — Astra Pass (50 Tiers, 40 Days)
// Free & Premium tracks (Premium comes automatically with PRO!)
// Level 50 Premium Reward: Legendary Weapon "Astra's Sovereign Blade"
// ═══════════════════════════════════════════════════════════════

'use strict';

const SEASON_DAYS = 40;
const TOTAL_TIERS = 50;

function isProPlayer(player) {
  if (!player) return false;
  return !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
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

    if (sub === 'claim') {
      const tier = parseInt(args[1]);
      if (isNaN(tier)) {
        // Claim all unlocked
        let count = 0;
        const rewardsGained = [];
        for (let t = 1; t <= Math.min(TOTAL_TIERS, ap.level); t++) {
          if (!ap.claimedFree.includes(t)) {
            ap.claimedFree.push(t);
            const rewardGold = t * 1000;
            player.gold = (player.gold || 0) + rewardGold;
            rewardsGained.push(`Tier ${t} Free: +${rewardGold.toLocaleString()} 💠 Nexus`);
            count++;
          }
          if (hasPremium && !ap.claimedPremium.includes(t)) {
            ap.claimedPremium.push(t);
            const rewardStones = t * 50;
            player.manaCrystals = (player.manaCrystals || 0) + rewardStones;
            rewardsGained.push(`Tier ${t} Premium: +${rewardStones.toLocaleString()} 💎 Mana Stones`);
            if (t === 50) {
              if (!player.inventory) player.inventory = [];
              player.inventory.push({
                name: "Astra's Sovereign Blade",
                type: 'weapon',
                rarity: 'legendary',
                atk: 150,
                hp: 500,
                crit: 15,
                desc: '🗡️✨ Legendary weapon granted to masters of the 40-Day Astra Pass.'
              });
              rewardsGained.push(`🏆 *TIER 50 LEGENDARY REWARD:* "Astra's Sovereign Blade" (+150 ATK, +500 HP, +15% CRIT)!`);
            }
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
      if (!ap.claimedFree.includes(tier)) {
        ap.claimedFree.push(tier);
        const rewardGold = tier * 1000;
        player.gold = (player.gold || 0) + rewardGold;
        gained.push(`Free: +${rewardGold.toLocaleString()} 💠 Nexus`);
      }
      if (hasPremium && !ap.claimedPremium.includes(tier)) {
        ap.claimedPremium.push(tier);
        const rewardStones = tier * 50;
        player.manaCrystals = (player.manaCrystals || 0) + rewardStones;
        gained.push(`Premium: +${rewardStones.toLocaleString()} 💎 Mana Stones`);
        if (tier === 50) {
          if (!player.inventory) player.inventory = [];
          player.inventory.push({
            name: "Astra's Sovereign Blade",
            type: 'weapon',
            rarity: 'legendary',
            atk: 150,
            hp: 500,
            crit: 15,
            desc: '🗡️✨ Legendary weapon granted to masters of the 40-Day Astra Pass.'
          });
          gained.push(`🏆 *TIER 50 LEGENDARY REWARD:* "Astra's Sovereign Blade"!`);
        }
      }

      if (gained.length === 0) return sock.sendMessage(chatId, { text: `❌ Tier ${tier} rewards already claimed!` }, { quoted: msg });
      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ *Tier ${tier} Claimed!*\n\n${gained.join('\n')}` }, { quoted: msg });
    }

    // Default Pass view
    const xpReq = 1000;
    const xpPct = Math.min(100, Math.floor(((ap.xp || 0) / xpReq) * 100));
    const xpBar = '█'.repeat(Math.floor(xpPct / 5)) + '░'.repeat(20 - Math.floor(xpPct / 5));

    return sock.sendMessage(chatId, {
      text: [
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
        `🎁 *TIER 50 HIGHLIGHT:*`,
        `🗡️✨ *Astra's Sovereign Blade* (Legendary Weapon)`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📌 /pass claim       — Claim all unlocked rewards`,
        `📌 /pass claim [num] — Claim specific tier reward`,
        `📌 /prostore         — Buy PRO card to get Auto-Premium!`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    }, { quoted: msg });
  }
};
