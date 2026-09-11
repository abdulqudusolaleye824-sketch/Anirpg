// market.js — Player-to-Player Market
// Players post items for sale. Others browse and buy.
// Listings expire after 24 hours.
// Tax: 5% of sale price goes to the system.

const MARKET_TAX = 0.05;  // 5%
const LISTING_FEE = 500;   // Nexus to post a listing
const MAX_LISTINGS_PER_PLAYER = 5;
const LISTING_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

function getMarket(db) {
  if (!db.market) db.market = { listings: {}, counter: 1, totalSales: 0 };
  if (!db.market.listings) db.market.listings = {};
  if (!db.market.counter)  db.market.counter = 1;
  return db.market;
}

function getActiveListing(market, id) {
  const l = market.listings[id];
  if (!l || l.status !== 'active') return null;
  if (Date.now() > l.expiresAt) { l.status = 'expired'; return null; }
  return l;
}

function cleanExpired(market, db) {
  const now = Date.now();
  Object.values(market.listings).forEach(l => {
    if (l.status === 'active' && now > l.expiresAt) {
      l.status = 'expired';
      // Return the item to the seller's inventory
      if (db && l.sellerId && db.users[l.sellerId]) {
        const seller = db.users[l.sellerId];
        if (!seller.inventory) seller.inventory = { items: [] };
        if (!Array.isArray(seller.inventory.items)) seller.inventory.items = [];
        seller.inventory.items.push({ ...l.item, _returnedFromMarket: true });
        console.log(`📦 Returned expired listing #${l.id} (${l.item.name}) to ${seller.name}`);
      }
    }
  });
}

module.exports = {
  name: 'market',
  aliases: ['shop2', 'bazaar', 'store'],
  description: 'Player-to-player item market — buy and sell gear, artifacts, and items',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! /register' }, { quoted: msg });
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const market = getMarket(db);
    cleanExpired(market, db);

    const sub = args[0]?.toLowerCase();

    // ── BROWSE / LIST ──────────────────────────────────────
    if (!sub || sub === 'browse' || sub === 'list') {
      const active = Object.values(market.listings)
        .filter(l => l.status === 'active')
        .sort((a,b) => a.price - b.price);

      if (active.length === 0) {
        return sock.sendMessage(chatId, {
          text: `${FRAME}\n🏪 *PLAYER MARKET*\n${FRAME}\n😴 No listings right now.\n\nBe the first to sell something!\n/market sell [item name] [price]\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO PULSE* — empty shelves, list first and set the price!` : `\n${UI.upsell()}`)
        }, { quoted: msg });
      }

      const category = args[1]?.toLowerCase();
      const filtered = category
        ? active.filter(l => l.item.type?.toLowerCase().includes(category) || l.item.rarity?.toLowerCase() === category)
        : active;

      let txt = pro
        ? `${UI.PRO_BAR}\n🏪 *PLAYER MARKET* (${filtered.length} listings) 💎\n${UI.PRO_BAR}\n\n`
        : `🏪 *PLAYER MARKET* (${filtered.length} listings)\n${UI.FREE_BAR}\n\n`;

      const rarityEmoji = { common:'⚪', uncommon:'🟢', rare:'🔵', epic:'🟣', legendary:'🟠', mythic:'🔴' };
      filtered.slice(0,15).forEach(l => {
        const timeLeft = Math.ceil((l.expiresAt - Date.now()) / 3600000);
        const rEmoji = rarityEmoji[l.item.rarity?.toLowerCase()] || '⚪';
        txt += `*#${l.id}* ${rEmoji} *${l.item.name}*\n`;
        txt += `   💠 ${l.price.toLocaleString()} 💠 | Seller: ${l.sellerName} | ⏰ ${timeLeft}h left\n\n`;
      });

      if (filtered.length > 15) txt += `_...and ${filtered.length - 15} more_\n\n`;

      if (pro && filtered.length) {
        const prices = filtered.map(l => l.price || 0);
        const cheapest = filtered.reduce((a, b) => (a.price || 0) <= (b.price || 0) ? a : b);
        const avg = Math.floor(prices.reduce((s, p) => s + p, 0) / prices.length);
        txt += `${UI.PRO_MINI}\n💎 *PRO MARKET PULSE*\n  🐣 Cheapest: *${cheapest.item.name}* @ ${UI.num(cheapest.price)} 💠\n  📊 Average ask: ${UI.num(avg)} 💠\n\n`;
      }
      txt += `${FRAME}\n`;
      txt += `/market buy [#]     — Buy a listing\n`;
      txt += `/market info [#]    — Item details\n`;
      txt += `/market sell [item] [price] — List an item\n`;
      txt += `/market mine        — Your listings\n`;
      txt += `/market search [name] — Search items\n`;
      txt += pro ? FRAME : `${FRAME}\n${UI.upsell()}`;

      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── INFO ───────────────────────────────────────────────
    if (sub === 'info' || sub === 'view') {
      const id  = parseInt(args[1]);
      if (isNaN(id)) return sock.sendMessage(chatId, { text: '❌ Usage: /market info [#]' }, { quoted: msg });
      const listing = getActiveListing(market, id);
      if (!listing) return sock.sendMessage(chatId, { text: `❌ Listing #${id} not found or expired!` }, { quoted: msg });

      const timeLeft = Math.ceil((listing.expiresAt - Date.now()) / 3600000);
      const tax = Math.floor(listing.price * MARKET_TAX);
      const sellerGets = listing.price - tax;

      let txt = pro ? `${UI.PRO_BAR}\n🏪 *LISTING #${id}* 💎\n${UI.PRO_BAR}\n` : `🏪 *LISTING #${id}*\n${UI.FREE_BAR}\n`;
      txt += `📦 *${listing.item.name}*\n`;
      txt += `🏷️ Type: ${listing.item.type || 'Item'} | Rarity: ${listing.item.rarity || 'common'}\n`;
      if (listing.item.bonus) {
        const bonuses = Object.entries(listing.item.bonus).map(([k,v]) => `${v>0?'+':''}${v} ${k.toUpperCase()}`).join(' | ');
        txt += `📊 Stats: ${bonuses}\n`;
      }
      if (listing.item.desc || listing.item.description) txt += `💭 ${listing.item.desc || listing.item.description}\n`;
      txt += `\n💠 Price: *${listing.price.toLocaleString()}g*\n`;
      txt += `📊 Tax (5%): ${tax.toLocaleString()} 💠 | Seller gets: ${sellerGets.toLocaleString()}g\n`;
      txt += `👤 Seller: ${listing.sellerName}\n`;
      txt += `⏰ Expires: ${timeLeft}h\n`;
      if (pro) {
        const same = Object.values(market.listings).filter(l => l.status === 'active' && l.item.name === listing.item.name && l.id !== listing.id);
        if (same.length) {
          const avg = Math.floor(same.reduce((s, l) => s + (l.price || 0), 0) / same.length);
          const verdict = listing.price <= avg ? '🟢 Good deal' : listing.price <= avg * 1.2 ? '🟡 Fair' : '🔴 Overpriced';
          txt += `\n${UI.PRO_MINI}\n💎 *PRO DEAL CHECK* — ${verdict}\n  📊 ${same.length} similar @ avg ${UI.num(avg)} 💠\n`;
        } else {
          txt += `\n${UI.PRO_MINI}\n💎 *PRO DEAL CHECK* — only listing for this item\n`;
        }
      }
      txt += `\n/market buy ${id} — Purchase this item\n${FRAME}`;
      if (!pro) txt += `\n${UI.upsell()}`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── BUY ────────────────────────────────────────────────
    if (sub === 'buy') {
      const id = parseInt(args[1]);
      if (isNaN(id)) return sock.sendMessage(chatId, { text: '❌ Usage: /market buy [#]' }, { quoted: msg });
      const listing = getActiveListing(market, id);
      if (!listing) return sock.sendMessage(chatId, { text: `❌ Listing #${id} not found or expired!` }, { quoted: msg });
      if (listing.sellerId === sender) return sock.sendMessage(chatId, { text: '❌ You cannot buy your own listing!' }, { quoted: msg });
      if ((player.gold || 0) < listing.price) {
        return sock.sendMessage(chatId, { text: `❌ Not enough Nexus!\nNeed: ${listing.price.toLocaleString()} 💠 | Have: ${(player.gold||0).toLocaleString()} 💠` }, { quoted: msg });
      }

      // Transaction
      const tax       = Math.floor(listing.price * MARKET_TAX);
      const sellerGet = listing.price - tax;
      player.gold    -= listing.price;
      const seller    = db.users[listing.sellerId];
      if (seller) {
        seller.gold = (seller.gold || 0) + sellerGet;
        // Seller's quest credit (silent — seller usually isn't in this chat)
        try {
          const _DQ = require('../../rpg/utils/DailyQuestSystem');
          _DQ.trackQuestProgress(seller, 'sell', 1);
          if (sellerGet > 0) _DQ.trackQuestProgress(seller, 'goldEarn', sellerGet);
        } catch(e){}
      }

      // Give item to buyer
      if (!player.inventory) player.inventory = { items: [] };
      if (!player.inventory.items) player.inventory.items = [];
      player.inventory.items.push({ ...listing.item });

      // Handle artifact separately
      if (listing.item.type === 'artifact' || listing.item.bonus) {
        if (!player.artifacts) player.artifacts = { inventory: [], equipped: {} };
        if (!player.artifacts.inventory) player.artifacts.inventory = [];
        player.artifacts.inventory.push({ ...listing.item });
      }

      listing.status     = 'sold';
      listing.soldTo     = sender;
      listing.soldAt     = Date.now();
      market.totalSales  = (market.totalSales || 0) + 1;

      // Buyer quest: market purchase counts as a shop purchase
      try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'shop', 1, sock, sender, chatId); } catch(e){}

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `${FRAME}\n✅ *PURCHASE COMPLETE!*\n${FRAME}\n📦 *${listing.item.name}*\n💠 Paid: ${listing.price.toLocaleString()}g\n\n👤 Seller: ${listing.sellerName} received ${sellerGet.toLocaleString()}g\n📊 Market tax: ${tax.toLocaleString()}g\n\n✅ Item added to your inventory!\n${FRAME}`
      }, { quoted: msg });
    }

    // ── SELL ───────────────────────────────────────────────
    if (sub === 'sell') {
      // Count active listings
      const myListings = Object.values(market.listings).filter(l => l.sellerId === sender && l.status === 'active');
      if (myListings.length >= MAX_LISTINGS_PER_PLAYER) {
        return sock.sendMessage(chatId, { text: `❌ Max ${MAX_LISTINGS_PER_PLAYER} listings at a time!\n/market mine to see yours.` }, { quoted: msg });
      }
      if ((player.gold || 0) < LISTING_FEE) {
        return sock.sendMessage(chatId, { text: `❌ Listing fee: ${LISTING_FEE}g\nYou have: ${(player.gold||0).toLocaleString()} 💠` }, { quoted: msg });
      }

      // Parse: /market sell [item name] [price]
      const priceStr = args[args.length - 1];
      const price    = parseInt(priceStr);
      if (isNaN(price) || price < 100) return sock.sendMessage(chatId, { text: '❌ Usage: /market sell [item name] [price]\nMinimum price: 100 Ne' }, { quoted: msg });

      const itemName = args.slice(1, -1).join(' ').toLowerCase();
      if (!itemName) return sock.sendMessage(chatId, { text: '❌ Usage: /market sell [item name] [price]' }, { quoted: msg });

      // Find item in inventory
      const inv = player.inventory?.items || [];
      const itemIdx = inv.findIndex(i => i.name?.toLowerCase().includes(itemName));

      // Also check artifacts
      let artIdx = -1;
      const artInv = player.artifacts?.inventory || [];
      if (itemIdx === -1) {
        artIdx = artInv.findIndex(i =>
          (typeof i === 'string' ? i : i.name)?.toLowerCase().includes(itemName)
        );
      }

      if (itemIdx === -1 && artIdx === -1) {
        return sock.sendMessage(chatId, { text: `❌ Item "*${itemName}*" not found in your inventory!\n/inventory to see what you have.` }, { quoted: msg });
      }

      let item;
      if (itemIdx !== -1) {
        item = inv.splice(itemIdx, 1)[0];
      } else {
        const raw = artInv.splice(artIdx, 1)[0];
        item = typeof raw === 'string' ? { name: raw, type: 'artifact', rarity: 'epic' } : raw;
      }

      // Create listing
      player.gold -= LISTING_FEE;
      const id = market.counter++;
      market.listings[id] = {
        id,
        sellerId:   sender,
        sellerName: player.name,
        item:       { ...item },
        price,
        status:     'active',
        listedAt:   Date.now(),
        expiresAt:  Date.now() + LISTING_EXPIRY,
      };

      // Award Weekly GP for listing on market
      try { require('../../rpg/utils/WeeklyGuildWar').addGP(db, sender, 50, saveDatabase); } catch(e) {}

      saveDatabase();
      return sock.sendMessage(chatId, {
        text: pro
          ? `${UI.PRO_BAR}\n✅ *LISTING CREATED!* 💎\n${UI.PRO_BAR}\n📦 *${item.name}*\n💠 Price: ${price.toLocaleString()}g\n📋 Listing #${id}\n⏰ Expires in 24 hours\n💸 Fee paid: ${LISTING_FEE}g\n${UI.PRO_BAR}`
          : `✅ *LISTING CREATED!*\n${UI.FREE_BAR}\n📦 *${item.name}*\n💠 Price: ${price.toLocaleString()}g\n📋 Listing #${id}\n⏰ Expires in 24 hours\n💸 Fee paid: ${LISTING_FEE}g\n${UI.FREE_BAR}\n💡 Buyers: /market buy ${id}`
      }, { quoted: msg });
    }

    // ── MY LISTINGS ────────────────────────────────────────
    if (sub === 'mine' || sub === 'my') {
      const mine = Object.values(market.listings)
        .filter(l => l.sellerId === sender)
        .sort((a,b) => b.listedAt - a.listedAt)
        .slice(0, 10);

      if (mine.length === 0) return sock.sendMessage(chatId, { text: '😴 You have no listings.\n/market sell [item] [price] to post one!' }, { quoted: msg });

      let txt = pro ? `${UI.PRO_BAR}\n🏪 *YOUR LISTINGS* 💎\n${UI.PRO_BAR}\n\n` : `🏪 *YOUR LISTINGS*\n${UI.FREE_BAR}\n\n`;
      mine.forEach(l => {
        const statusEmoji = l.status === 'active' ? '🟢' : l.status === 'sold' ? '✅' : '⌛';
        const timeLeft = l.status === 'active' ? `⏰ ${Math.ceil((l.expiresAt-Date.now())/3600000)}h` : '';
        txt += `${statusEmoji} *#${l.id}* ${l.item.name}\n   💠 ${l.price.toLocaleString()} 💠 | ${l.status.toUpperCase()} ${timeLeft}\n\n`;
      });
      if (pro) {
        const activeMine = mine.filter(l => l.status === 'active');
        const locked = activeMine.reduce((s, l) => s + (l.price || 0), 0);
        txt += `${UI.PRO_MINI}\n💎 *PRO STALL* — ${activeMine.length} live · ${UI.num(locked)} 💠 on the table\n\n`;
      }
      txt += `/market cancel [#] — Remove a listing\n${FRAME}`;
      if (!pro) txt += `\n${UI.upsell()}`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── CANCEL ─────────────────────────────────────────────
    if (sub === 'cancel' || sub === 'remove') {
      const id = parseInt(args[1]);
      if (isNaN(id)) return sock.sendMessage(chatId, { text: '❌ Usage: /market cancel [#]' }, { quoted: msg });
      const listing = market.listings[id];
      if (!listing || listing.sellerId !== sender) return sock.sendMessage(chatId, { text: `❌ Listing #${id} not found or not yours!` }, { quoted: msg });
      if (listing.status !== 'active') return sock.sendMessage(chatId, { text: `❌ Listing #${id} is already ${listing.status}.` }, { quoted: msg });

      // Return item to seller
      listing.status = 'cancelled';
      if (!player.inventory) player.inventory = { items: [] };
      if (!player.inventory.items) player.inventory.items = [];
      player.inventory.items.push({ ...listing.item });

      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ Listing #${id} cancelled!\n📦 *${listing.item.name}* returned to your inventory.` }, { quoted: msg });
    }

    // ── SEARCH ─────────────────────────────────────────────
    if (sub === 'search' || sub === 'find') {
      const query = args.slice(1).join(' ').toLowerCase();
      if (!query) return sock.sendMessage(chatId, { text: '❌ Usage: /market search [item name]' }, { quoted: msg });

      const results = Object.values(market.listings)
        .filter(l => l.status === 'active' && l.item.name?.toLowerCase().includes(query))
        .slice(0, 10);

      if (results.length === 0) return sock.sendMessage(chatId, { text: `❌ No listings found for "*${query}*"` }, { quoted: msg });

      let txt = pro ? `${UI.PRO_BAR}\n🔍 *SEARCH: "${query}"* 💎\n${UI.PRO_BAR}\n\n` : `🔍 *SEARCH: "${query}"*\n${UI.FREE_BAR}\n\n`;
      results.forEach(l => {
        txt += `*#${l.id}* *${l.item.name}*\n   💠 ${l.price.toLocaleString()} 💠 | ${l.sellerName}\n\n`;
      });
      txt += `/market info [#] for details\n/market buy [#] to purchase\n${FRAME}`;
      if (!pro) txt += `\n${UI.upsell()}`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── STATS ──────────────────────────────────────────────
    if (sub === 'stats') {
      const active = Object.values(market.listings).filter(l => l.status === 'active').length;
      const sold   = Object.values(market.listings).filter(l => l.status === 'sold').length;
      return sock.sendMessage(chatId, {
        text: `${FRAME}\n🏪 *MARKET STATS*\n${FRAME}\n🟢 Active listings: ${active}\n✅ Total sales: ${market.totalSales || sold}\n💸 Listing fee: ${LISTING_FEE}g\n📊 Market tax: ${MARKET_TAX*100}%\n⏰ Listings expire: 24 hours\n${FRAME}`
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, { text: '❌ Unknown command!\n/market help or just /market to browse' }, { quoted: msg });
  }
};
