// ═══════════════════════════════════════════════════════════════
// /prostore — Store to purchase Weekly, Monthly, or Yearly Pro Cards using PC
// ═══════════════════════════════════════════════════════════════

'use strict';

const UI = require('../../rpg/utils/UI');

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

// Pass products (also bought with PC, right here in the Pro Store).
const PASS_PRODUCTS = {
  battlepass: {
    aliases: ['bp', 'battle'],
    name: 'Battle Pass Premium',
    cost: 1000,
    emoji: '🎖️',
    blurb: 'Premium track for the current season + 50% bonus EXP while active',
  },
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
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const sub = (args[0] || '').toLowerCase();

    if (!sub || sub === 'list' || sub === 'menu') {
      const pc = player.procoin || 0;
      const proUntil = pro && player.proExpiresAt ? new Date(player.proExpiresAt + 3600000).toISOString().slice(0, 10) : null;
      let txt = pro
        ? `${UI.PRO_BAR}\n💎 *ASTRA PRO STORE* 💎\n${UI.PRO_BAR}\n💼 Balance: *${pc.toLocaleString()} PC* · ⏰ Pro until *${proUntil}*\n${UI.PRO_BAR}\n\n`
        : `💎 *ASTRA PRO STORE*\n${UI.FREE_BAR}\n💼 Your Balance: *${pc.toLocaleString()} PC*\n${UI.FREE_BAR}\n\n`;

      Object.entries(PRO_TIERS).forEach(([key, tier]) => {
        txt += `${tier.emoji} *${tier.name.toUpperCase()}*\n`;
        txt += `   💰 Cost: *${tier.cost.toLocaleString()} PC*\n`;
        txt += `   ⏰ Duration: *${tier.days} Days*\n`;
        txt += `   🎁 Bonus: +${tier.nexus.toLocaleString()} 💠 Nexus & +${tier.crystals.toLocaleString()} 💎 Mana Stones\n`;
        txt += `   📌 Command: /prostore buy ${key}\n\n`;
      });

      txt += `🎖️ *PASS UPGRADES (PC)*\n`;
      for (const [pkey, prod] of Object.entries(PASS_PRODUCTS)) {
        txt += `${prod.emoji} *${prod.name.toUpperCase()}*\n`;
        txt += `   💰 Cost: *${prod.cost.toLocaleString()} PC*\n`;
        txt += `   ✨ ${prod.blurb}\n`;
        txt += `   📌 Command: /prostore buy ${pkey}\n\n`;
      }
      txt += `${FRAME}\n💡 Use /profaq for Pro perks \u2022 /prosub for your subscriptions`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    if (sub === 'buy') {
      const option = (args[1] || '').toLowerCase();
      const tier = PRO_TIERS[option];

      // ── Pass products ────────────────────────────
      const passKey = Object.keys(PASS_PRODUCTS).find(k => k === option || PASS_PRODUCTS[k].aliases.includes(option));
      if (!tier && passKey) {
        const prod = PASS_PRODUCTS[passKey];
        if ((player.procoin || 0) < prod.cost) {
          return sock.sendMessage(chatId, {
            text: `❌ Insufficient PC!\nNeed: *${prod.cost.toLocaleString()} PC*\nHave: *${(player.procoin || 0).toLocaleString()} PC*`
          }, { quoted: msg });
        }
        if (passKey === 'battlepass') {
          const BP = require('../../rpg/utils/BattlePass');
          const bp = BP.getPassState(player);
          if (bp.premium) {
            return sock.sendMessage(chatId, { text: `✅ You already own *Battle Pass Premium* for ${BP.CURRENT_SEASON?.name || 'this season'}!` }, { quoted: msg });
          }
          player.procoin -= prod.cost;
          try { require('../../rpg/utils/TransactionLog').logTransaction(player, { type: 'prostore_buy', amount: prod.cost, currency: 'PC', note: `Battle Pass Premium` }); } catch (e) {};
          bp.premium = true;
          bp.premiumSince = Date.now();
          saveDatabase();
          const text = UI.card(player, {
            icon: '🎖️', title: 'BATTLE PASS PREMIUM ACTIVATED!',
            lines: [
              `🎫 Season: *${BP.CURRENT_SEASON?.name || 'current'}*`,
              `✨ Premium track unlocked + *50% bonus EXP* on all gains!`,
              ``,
              `📌 Use /bp to view & claim premium rewards.`,
            ],
            tip: '/prosub to see time left',
          });
          return sock.sendMessage(chatId, { text }, { quoted: msg });
        }
        // NOTE: Astra Pass Premium is NOT sold here — it comes with Pro.
      }

      if (!tier) {
        return sock.sendMessage(chatId, { text: '❌ Invalid option! Pro: weekly, monthly, yearly \u2022 Pass: battlepass.\nExample: /prostore buy weekly' }, { quoted: msg });
      }

      if ((player.procoin || 0) < tier.cost) {
        return sock.sendMessage(chatId, {
          text: `❌ Insufficient PC!\nNeed: *${tier.cost.toLocaleString()} PC*\nHave: *${(player.procoin || 0).toLocaleString()} PC*`
        }, { quoted: msg });
      }

      player.procoin -= tier.cost;
      player.gold = (player.gold || 0) + tier.nexus;
      player.manaCrystals = (player.manaCrystals || 0) + tier.crystals;
      try { require('../../rpg/utils/TransactionLog').logTransaction(player, { type: 'prostore_buy', amount: tier.cost, currency: 'PC', note: `${tier.name}` }); } catch (e) {};
      try { require('../../rpg/utils/TransactionLog').logTransaction(player, { type: 'prostore_bonus', amount: tier.nexus, currency: '💠', note: `${tier.name}` }); } catch (e) {};
      try { require('../../rpg/utils/TransactionLog').logTransaction(player, { type: 'prostore_bonus', amount: tier.crystals, currency: '💎', note: `${tier.name}` }); } catch (e) {};

      player.isPro = true;
      player.proStatus = option;
      const durationMs = tier.days * 86400 * 1000;
      player.proExpiresAt = (player.proExpiresAt && player.proExpiresAt > Date.now() ? player.proExpiresAt : Date.now()) + durationMs;
      player.proTier = option;
      if (!player.proActivatedAt || !(player.proExpiresAt && player.proExpiresAt - durationMs > Date.now())) {
        player.proActivatedAt = Date.now(); // fresh sub (extensions keep the original date)
      }

      saveDatabase();

      const text = UI.card(player, {
        icon: '🌟', title: 'PRO STATUS ACTIVATED!',
        lines: [
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
        ],
        tip: '/profaq to master your perks',
      });
      return sock.sendMessage(chatId, { text }, { quoted: msg });
    }

    return sock.sendMessage(chatId, { text: '❌ Usage: /prostore or /prostore buy [weekly|monthly|yearly|battlepass]' }, { quoted: msg });
  }
};
