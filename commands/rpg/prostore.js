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
    upgradePoints: 20,
    emoji: '🎫'
  },
  monthly: {
    name: 'Monthly Pro Card',
    cost: 5000,
    days: 30,
    nexus: 2000000,
    crystals: 200000,
    upgradePoints: 100,
    emoji: '📜'
  },
  yearly: {
    name: 'Yearly Pro Card',
    cost: 60000,
    days: 365,
    nexus: 20000000,
    crystals: 2000000,
    upgradePoints: 1200,
    emoji: '👑'
  }
};

// Card products: stored in player.cards (NOT auto-applied).
const CARD_PRODUCTS = {
  namechange: {
    aliases: ['name', 'rename'],
    name: 'Rename Card', // batch-47: relabeled per owner order
    cost: 500,
    emoji: '✏️',
    blurb: 'Rename yourself (/setname) or your guild (/guild rename)',
    cardKey: 'namechange',
  },
  seticon: {
    aliases: ['icon'],
    name: 'Seticon Token',
    cost: 500,
    emoji: '🖼️',
    blurb: 'Change your profile icon once via /seticon',
    cardKey: 'seticon',
  },
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

// Push #88k: PC → Mana Stones exchange (fixed tiers; Nexus may follow later).
const STONE_PACKS = [
  { pc: 1000, stones: 500000 },
  { pc: 2000, stones: 1000000 },
  { pc: 3000, stones: 1700000 },
  { pc: 4000, stones: 3000000 },
  { pc: 5000, stones: 4000000 },
];

module.exports = {
  name: 'prostore',
  STONE_PACKS,
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
        txt += `   🎁 Bonus: +${tier.nexus.toLocaleString()} 💠 Nexus & +${tier.crystals.toLocaleString()} 💎 Mana Stones & +${tier.upgradePoints} ⬆️ Upgrade Points\n`;
        txt += `   📌 Command: /prostore buy ${key}\n\n`;
      });

      txt += `🃏 *CARDS (PC — kept in /inv info, never auto-used)*\n`;
      for (const [ckey, card] of Object.entries(CARD_PRODUCTS)) {
        txt += `${card.emoji} *${card.name.toUpperCase()}*\n`;
        txt += `   💰 Cost: *${card.cost.toLocaleString()} PC*\n`;
        txt += `   ✨ ${card.blurb}\n`;
        txt += `   📌 Command: /prostore buy ${ckey}\n\n`;
      }
      const _owned = player.cards || {};
      const _ownedStr = [];
      if (_owned.namechange) _ownedStr.push(`✏️×${_owned.namechange}`);
      if (_owned.seticon) _ownedStr.push(`🖼️×${_owned.seticon}`);
      if (_owned.pro_weekly) _ownedStr.push(`🎫×${_owned.pro_weekly}`);
      if (_ownedStr.length) txt += `🃏 Your cards: ${_ownedStr.join('  ')}\n📌 Activate a Pro card: /prostore use weekly\n\n`;

      txt += `🎖️ *PASS UPGRADES (PC)*\n`;
      for (const [pkey, prod] of Object.entries(PASS_PRODUCTS)) {
        txt += `${prod.emoji} *${prod.name.toUpperCase()}*\n`;
        txt += `   💰 Cost: *${prod.cost.toLocaleString()} PC*\n`;
        txt += `   ✨ ${prod.blurb}\n`;
        txt += `   📌 Command: /prostore buy ${pkey}\n\n`;
      }
      txt += `💎 *MANA STONE PACKS (PC → Stones)*\n`;
      for (const pk of STONE_PACKS) txt += `   ${pk.pc.toLocaleString()} PC → *${pk.stones.toLocaleString()}* 💎\n`;
      txt += `   📌 Command: /prostore stones <pc>  (e.g. /prostore stones 3000)\n\n`;
      txt += `${FRAME}\n💡 Use /profaq for Pro perks \u2022 /prosub for your subscriptions`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /prostore stones <pc> — exchange a PC pack for Mana Stones ──
    if (sub === 'stones' || sub === 'stone' || sub === 'mana' || sub === 'ms') {
      const want = parseInt(String(args[1] || '').replace(/[,_]/g, ''), 10);
      const pack = STONE_PACKS.find(pk => pk.pc === want);
      if (!pack) return sock.sendMessage(chatId, { text: `❌ Pick a pack: ${STONE_PACKS.map(pk => pk.pc.toLocaleString()).join(' / ')} PC\nExample: /prostore stones 2000` }, { quoted: msg });
      if ((player.procoin || 0) < pack.pc) return sock.sendMessage(chatId, { text: `❌ Insufficient PC!\nNeed: *${pack.pc.toLocaleString()} PC*\nHave: *${(player.procoin || 0).toLocaleString()} PC*` }, { quoted: msg });
      player.procoin -= pack.pc;
      player.manaCrystals = (player.manaCrystals || 0) + pack.stones;
      try { const TL = require('../../rpg/utils/TransactionLog'); TL.logTransaction(player, { type: 'prostore_buy', amount: pack.pc, currency: 'PC', note: `${pack.stones.toLocaleString()} Mana Stones` }); TL.logTransaction(player, { type: 'prostore_bonus', amount: pack.stones, currency: '💎', note: `PC exchange` }); } catch (e) {}
      saveDatabase();
      const text = UI.card(player, { icon: '💎', title: 'MANA STONES PURCHASED!', lines: [`💼 Spent: *${pack.pc.toLocaleString()} PC*`, `💎 Received: *+${pack.stones.toLocaleString()} Mana Stones*`, ``, `💎 Wallet: *${(player.manaCrystals || 0).toLocaleString()}* 💎 · *${(player.procoin || 0).toLocaleString()} PC* left`], tip: '/prostore for more packs' });
      return sock.sendMessage(chatId, { text }, { quoted: msg });
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

      // ── Card products (go to inventory, never auto-applied) ──
      const cardKey = Object.keys(CARD_PRODUCTS).find(k => k === option || CARD_PRODUCTS[k].aliases.includes(option));
      if (!tier && !passKey && cardKey) {
        const card = CARD_PRODUCTS[cardKey];
        if ((player.procoin || 0) < card.cost) {
          return sock.sendMessage(chatId, {
            text: `❌ Insufficient PC!\nNeed: *${card.cost.toLocaleString()} PC*\nHave: *${(player.procoin || 0).toLocaleString()} PC*`
          }, { quoted: msg });
        }
        player.procoin -= card.cost;
        if (!player.cards) player.cards = {};
        player.cards[card.cardKey] = (player.cards[card.cardKey] || 0) + 1;
        try { require('../../rpg/utils/TransactionLog').logTransaction(player, { type: 'prostore_buy', amount: card.cost, currency: 'PC', note: card.name }); } catch (e) {}
        saveDatabase();
        const text = UI.card(player, {
          icon: '🃏', title: `${card.name.toUpperCase()} PURCHASED!`,
          lines: [
            `${card.emoji} *${card.name}* added to your cards.`,
            `🃏 You now own *${player.cards[card.cardKey]}*.`,
            ``,
            card.cardKey === 'namechange' ? `📌 Use it: /setname <new name> or /guild rename <name>` : `📌 Use it: /seticon (reply to an image) or /guild icon <emoji>`,
            `📌 View cards: /inv info`,
          ],
          tip: '/prostore for more',
        });
        return sock.sendMessage(chatId, { text }, { quoted: msg });
      }

      if (!tier) {
        return sock.sendMessage(chatId, { text: '❌ Invalid option! Pro: weekly, monthly, yearly \u2022 Pass: battlepass \u2022 Cards: namechange, seticon.\nExample: /prostore buy weekly' }, { quoted: msg });
      }

      if ((player.procoin || 0) < tier.cost) {
        return sock.sendMessage(chatId, {
          text: `❌ Insufficient PC!\nNeed: *${tier.cost.toLocaleString()} PC*\nHave: *${(player.procoin || 0).toLocaleString()} PC*`
        }, { quoted: msg });
      }

      player.procoin -= tier.cost;
      player.gold = (player.gold || 0) + tier.nexus;
      player.manaCrystals = (player.manaCrystals || 0) + tier.crystals;
      player.upgradePoints = (player.upgradePoints || 0) + (tier.upgradePoints || 0); // Push #72
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
          `• +${tier.upgradePoints} ⬆️ Upgrade Points (/upgrade)`,
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

    // ── /prostore use weekly — activate an owned Weekly Pro Card ──
    if (sub === 'use') {
      const option = (args[1] || '').toLowerCase();
      if (option !== 'weekly' && option !== 'pro_weekly' && option !== 'pro') {
        return sock.sendMessage(chatId, { text: '❌ Usage: /prostore use weekly\n\n(Only Weekly Pro Cards live in your inventory — monthly/yearly activate instantly on purchase.)' }, { quoted: msg });
      }
      if (!player.cards) player.cards = {};
      if ((player.cards.pro_weekly || 0) < 1) {
        return sock.sendMessage(chatId, { text: `❌ You own no *Weekly Pro Card*!\n\n👑 Win one as the monthly top recruiter (/code)\nor buy Pro instantly: /prostore buy weekly` }, { quoted: msg });
      }
      const tier = PRO_TIERS.weekly;
      player.cards.pro_weekly -= 1;
      player.gold = (player.gold || 0) + tier.nexus;
      player.manaCrystals = (player.manaCrystals || 0) + tier.crystals;
      player.upgradePoints = (player.upgradePoints || 0) + (tier.upgradePoints || 0); // Push #72
      try { require('../../rpg/utils/TransactionLog').logTransaction(player, { type: 'procard_use', amount: 1, currency: '🎫', note: tier.name }); } catch (e) {}
      try { require('../../rpg/utils/TransactionLog').logTransaction(player, { type: 'prostore_bonus', amount: tier.nexus, currency: '💠', note: tier.name }); } catch (e) {}
      try { require('../../rpg/utils/TransactionLog').logTransaction(player, { type: 'prostore_bonus', amount: tier.crystals, currency: '💎', note: tier.name }); } catch (e) {}
      player.isPro = true;
      player.proStatus = 'weekly';
      const durationMs = tier.days * 86400 * 1000;
      player.proExpiresAt = (player.proExpiresAt && player.proExpiresAt > Date.now() ? player.proExpiresAt : Date.now()) + durationMs;
      player.proTier = 'weekly';
      if (!player.proActivatedAt || !(player.proExpiresAt && player.proExpiresAt - durationMs > Date.now())) {
        player.proActivatedAt = Date.now();
      }
      saveDatabase();
      const text = UI.card(player, {
        icon: '🌟', title: 'PRO STATUS ACTIVATED!',
        lines: [
          `🎉 Card redeemed: *${tier.name}*`,
          `⏰ Active for: *${tier.days} Days*`,
          ``,
          `🎁 *BONUS LOOT RECEIVED:*`,
          `• +${tier.nexus.toLocaleString()} 💠 Nexus`,
          `• +${tier.crystals.toLocaleString()} 💎 Mana Stones`,
          `• +${tier.upgradePoints} ⬆️ Upgrade Points (/upgrade)`,
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

    return sock.sendMessage(chatId, { text: '❌ Usage: /prostore · /prostore buy [weekly|monthly|yearly|battlepass|namechange|seticon] · /prostore stones <pc> · /prostore use weekly' }, { quoted: msg });
  }
};
