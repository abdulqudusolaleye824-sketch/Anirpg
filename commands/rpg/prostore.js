// ═══════════════════════════════════════════════════════════════
// /prostore — Store to purchase Weekly, Monthly, or Yearly Pro Cards using PC
// ═══════════════════════════════════════════════════════════════

'use strict';

const PRO_TIERS = {
  weekly: {
    name: 'Weekly Pro Card',
    cost: 2000,
    days: 7,
    nexus: 500000,
    crystals: 50000,
    emoji: '🎫'
  },
  monthly: {
    name: 'Monthly Pro Card',
    cost: 5000,
    days: 30,
    nexus: 2000000,
    crystals: 200000,
    emoji: '📜'
  },
  yearly: {
    name: 'Yearly Pro Card',
    cost: 60000,
    days: 365,
    nexus: 20000000,
    crystals: 2000000,
    emoji: '👑'
  }
};

module.exports = {
  name: 'prostore',
  aliases: ['proshop', 'buypro'],
  description: '🛍️ Pro Store — Purchase Weekly, Monthly, or Yearly Pro status cards with PC',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

    const sub = (args[0] || '').toLowerCase();

    if (!sub || sub === 'list' || sub === 'menu') {
      const pc = player.procoin || 0;
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💎 *ASTRA PRO STORE*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💼 Your Balance: *${pc.toLocaleString()} PC*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      Object.entries(PRO_TIERS).forEach(([key, tier]) => {
        txt += `${tier.emoji} *${tier.name.toUpperCase()}*\n`;
        txt += `   💰 Cost: *${tier.cost.toLocaleString()} PC*\n`;
        txt += `   ⏰ Duration: *${tier.days} Days*\n`;
        txt += `   🎁 Bonus: +${tier.nexus.toLocaleString()} 💠 Nexus & +${tier.crystals.toLocaleString()} 💎 Mana Stones\n`;
        txt += `   📌 Command: /prostore buy ${key}\n\n`;
      });

      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 Use /profaq to read all Pro benefits & perks!`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    if (sub === 'buy') {
      const option = (args[1] || '').toLowerCase();
      const tier = PRO_TIERS[option];

      if (!tier) {
        return sock.sendMessage(chatId, { text: '❌ Invalid Pro option! Choose: weekly, monthly, or yearly.\nExample: /prostore buy weekly' }, { quoted: msg });
      }

      if ((player.procoin || 0) < tier.cost) {
        return sock.sendMessage(chatId, {
          text: `❌ Insufficient PC!\nNeed: *${tier.cost.toLocaleString()} PC*\nHave: *${(player.procoin || 0).toLocaleString()} PC*`
        }, { quoted: msg });
      }

      player.procoin -= tier.cost;
      player.gold = (player.gold || 0) + tier.nexus;
      player.manaCrystals = (player.manaCrystals || 0) + tier.crystals;

      player.isPro = true;
      player.proStatus = option;
      const durationMs = tier.days * 86400 * 1000;
      player.proExpiresAt = (player.proExpiresAt && player.proExpiresAt > Date.now() ? player.proExpiresAt : Date.now()) + durationMs;

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🌟 *PRO STATUS ACTIVATED!*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🎉 Purchased: *${tier.name}*`,
          `⏰ Active for: *${tier.days} Days*`,
          ``,
          `🎁 *BONUS LOOT RECEIVED:*`,
          `• +${tier.nexus.toLocaleString()} 💠 Nexus`,
          `• +${tier.crystals.toLocaleString()} 💎 Mana Stones`,
          ``,
          `✨ *UNLOCKED PRO PERKS:*`,
          `• ⚡ 2× EXP on ALL platforms (Pass, Dungeons, Aura, Raids)`,
          `• 👑 Automatic Astra Pass Premium Tier Access`,
          `• 💬 /setcustom [emoji] — Bot reacts with custom emoji`,
          `• ⭐ 100% /aurafarm success rate for 5s (star hint)`,
          `• 🔒 /lockprofile — Private DM profile mode`,
          `• 🏢 Self-Employed status if unguilded`,
          `• 🤖 Automatic Intent Manager Access`,
          `• 🛠️ Emergency Serf switching allowed`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, { text: '❌ Usage: /prostore or /prostore buy [weekly|monthly|yearly]' }, { quoted: msg });
  }
};
