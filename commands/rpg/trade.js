module.exports = {
  name: 'trade',
  description: 'Trade resources with other hunters',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    const { logTransaction } = require('../../rpg/utils/TransactionLog');
    const { COOWNER_JID } = require('../../utils/constants');

    // Trade fees go to the co-owner (was previously hardcoded to an old JID)
    const BOT_OWNER_ID = COOWNER_JID;

    if (!player) {
      return sock.sendMessage(chatId, { 
        text: '❌ You are not registered!\nUse /register to start your adventure.' 
      }, { quoted: msg });
    }

    const action = args[0]?.toLowerCase();

    // Initialize pending trades
    if (!db.pendingTrades) {
      db.pendingTrades = {};
    }

    // ═══════════════════════════════════════════════════════════════════
    // TRADING MENU (No action)
    // ═══════════════════════════════════════════════════════════════════
    if (!action) {
      return sock.sendMessage(chatId, { 
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤝 TRADING SYSTEM 🤝
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trade resources with other hunters!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/trade offer @user [amount] [type]
  Example: /trade offer @1234567890 100 gold

/trade accept - Accept pending trade
/trade reject - Reject pending trade
/trade cancel - Cancel your offer

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 TRADEABLE RESOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━
• gold - Currency
• crystals - Mana Stones

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 TRADING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Both hunters must be registered
✅ Minimum trade: 50 units
💠 5% system fee (deducted from sender)
⏰ Trades expire after 5 minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // OFFER - Make a trade offer to another player
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'offer') {
      const recipientArg = args[1];
      
      if (!recipientArg) {
        return sock.sendMessage(chatId, { 
          text: '❌ Please specify recipient!\n\nExample: /trade offer @1234567890 100 gold' 
        }, { quoted: msg });
      }

      const amount = parseInt(args[2]);
      const resourceType = args[3]?.toLowerCase();

      if (!amount || amount < 50) {
        return sock.sendMessage(chatId, { 
          text: '❌ Minimum trade amount is 50!' 
        }, { quoted: msg });
      }

      if (!['gold', 'crystals'].includes(resourceType)) {
        return sock.sendMessage(chatId, { 
          text: '❌ Invalid resource!\n\nChoose: gold or crystals' 
        }, { quoted: msg });
      }

      // Find recipient
      let recipientId = null;
      const searchTerm = recipientArg.replace('@', '').replace(/\D/g, '');
      
      for (const userId in db.users) {
        if (userId.includes(searchTerm)) {
          recipientId = userId;
          break;
        }
      }

      if (!recipientId || !db.users[recipientId]) {
        return sock.sendMessage(chatId, { 
          text: '❌ Recipient not found or not registered!' 
        }, { quoted: msg });
      }

      if (recipientId === sender) {
        return sock.sendMessage(chatId, { 
          text: '❌ You cannot trade with yourself!' 
        }, { quoted: msg });
      }

      // Check if player has enough resources (including fee)
      const fee = Math.floor(amount * 0.05);
      const totalNeeded = amount + fee;

      let playerResource;
      if (resourceType === 'gold') {
        playerResource = player.inventory?.gold || player.gold || 0;
      } else {
        playerResource = player.inventory?.manaCrystals || player.manaCrystals || 0;
      }

      if (playerResource < totalNeeded) {
        return sock.sendMessage(chatId, { 
          text: `❌ Insufficient ${resourceType}!\n\nYou need: ${totalNeeded} (${amount} + ${fee} fee)\nYou have: ${playerResource}` 
        }, { quoted: msg });
      }

      // Check if recipient already has pending trade
      if (db.pendingTrades[recipientId]) {
        return sock.sendMessage(chatId, { 
          text: '❌ Recipient already has a pending trade!\n\nWait for them to accept/reject first.' 
        }, { quoted: msg });
      }

      // Create trade offer
      db.pendingTrades[recipientId] = {
        from: sender,
        to: recipientId,
        amount,
        fee,
        resource: resourceType,
        timestamp: Date.now()
      };

      saveDatabase();

      await sock.sendMessage(chatId, { 
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ TRADE OFFER SENT!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Offering: ${amount} ${resourceType}
👤 To: ${db.users[recipientId].name}
💠 Fee: ${fee} ${resourceType} (5%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Total Cost: ${totalNeeded} ${resourceType}
⏰ Offer expires in 5 minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
      }, { quoted: msg });

      // Notify recipient
      try {
        await sock.sendMessage(recipientId, { 
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔔 TRADE OFFER RECEIVED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 From: ${player.name}
📦 You will receive: ${amount} ${resourceType}
💠 No cost to you!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 ACTIONS:
• /trade accept - Accept trade
• /trade reject - Reject trade
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ Offer expires in 5 minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
        });
      } catch (error) {
        console.log('Could not notify recipient:', error);
      }

      return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ACCEPT - Accept a pending trade offer
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'accept') {
      const trade = db.pendingTrades[sender];
      
      if (!trade) {
        return sock.sendMessage(chatId, { 
          text: '❌ No pending trade offer!' 
        }, { quoted: msg });
      }

      // Check if trade expired (5 minutes)
      if (Date.now() - trade.timestamp > 5 * 60 * 1000) {
        delete db.pendingTrades[sender];
        saveDatabase();
        return sock.sendMessage(chatId, { 
          text: '❌ Trade offer has expired!' 
        }, { quoted: msg });
      }

      const senderTrader = db.users[trade.from];
      const recipient = db.users[trade.to];

      if (!senderTrader) {
        delete db.pendingTrades[sender];
        saveDatabase();
        return sock.sendMessage(chatId, { 
          text: '❌ Trader no longer exists!' 
        }, { quoted: msg });
      }

      // Verify sender still has resources (including fee)
      const totalNeeded = trade.amount + trade.fee;
      let senderResource;
      if (trade.resource === 'gold') {
        senderResource = senderTrader.inventory?.gold || senderTrader.gold || 0;
      } else {
        senderResource = senderTrader.inventory?.manaCrystals || senderTrader.manaCrystals || 0;
      }

      if (senderResource < totalNeeded) {
        delete db.pendingTrades[sender];
        saveDatabase();
        return sock.sendMessage(chatId, { 
          text: '❌ Sender no longer has enough resources!' 
        }, { quoted: msg });
      }

      // ✅ EXECUTE TRADE
      if (trade.resource === 'gold') {
        // Deduct from sender (amount + fee) — keep player.gold and inventory.gold in sync
        senderTrader.gold = (senderTrader.gold || 0) - totalNeeded;
        if (senderTrader.inventory) senderTrader.inventory.gold = senderTrader.gold;
        
        // Add to recipient — keep both fields in sync
        recipient.gold = (recipient.gold || 0) + trade.amount;
        if (recipient.inventory) recipient.inventory.gold = recipient.gold;
        
        // ✅ Fee goes to BOT OWNER — keep both fields in sync
        if (!db.users[BOT_OWNER_ID]) {
          db.users[BOT_OWNER_ID] = {
            id: BOT_OWNER_ID, name: 'System',
            gold: trade.fee,
            inventory: { gold: trade.fee, manaCrystals: 0 }
          };
        } else {
          db.users[BOT_OWNER_ID].gold = (db.users[BOT_OWNER_ID].gold || 0) + trade.fee;
          if (!db.users[BOT_OWNER_ID].inventory) db.users[BOT_OWNER_ID].inventory = {};
          db.users[BOT_OWNER_ID].inventory.gold = db.users[BOT_OWNER_ID].gold;
        }
        
      } else {
        // Mana Stones trade
        if (senderTrader.inventory) {
          senderTrader.inventory.manaCrystals = (senderTrader.inventory.manaCrystals || 0) - totalNeeded;
        } else {
          senderTrader.manaCrystals = (senderTrader.manaCrystals || 0) - totalNeeded;
        }
        
        if (recipient.inventory) {
          recipient.inventory.manaCrystals = (recipient.inventory.manaCrystals || 0) + trade.amount;
        } else {
          recipient.manaCrystals = (recipient.manaCrystals || 0) + trade.amount;
        }
        
        // ✅ Convert crystal fee to gold for owner (1 crystal = 2 gold)
        const goldFee = trade.fee * 2;
        
        if (!db.users[BOT_OWNER_ID]) {
          db.users[BOT_OWNER_ID] = {
            id: BOT_OWNER_ID,
            name: 'System',
            inventory: { gold: goldFee, manaCrystals: 0 }
          };
        } else {
          if (!db.users[BOT_OWNER_ID].inventory) {
            db.users[BOT_OWNER_ID].inventory = { gold: 0, manaCrystals: 0 };
          }
          db.users[BOT_OWNER_ID].inventory.gold = (db.users[BOT_OWNER_ID].inventory.gold || 0) + goldFee;
        }
      }

      delete db.pendingTrades[sender];

      // Log transaction for both parties
      const tradeCurrency = trade.resource === 'gold' ? '💠' : '💎';
      logTransaction(senderTrader, { type:'trade', amount:trade.amount, currency:tradeCurrency, note:`→ ${recipient.name}` });
      logTransaction(recipient, { type:'trade_receive', amount:trade.amount, currency:tradeCurrency, note:`← ${senderTrader.name}` });

      saveDatabase();

      await sock.sendMessage(chatId, { 
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ TRADE COMPLETED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Received: ${trade.amount} ${trade.resource}
💠 No cost to you!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 From: ${senderTrader.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
      }, { quoted: msg });

      try {
        await sock.sendMessage(trade.from, { 
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ TRADE COMPLETED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Sent: ${trade.amount} ${trade.resource}
💠 System Fee: ${trade.fee} ${trade.resource} (5%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 To: ${recipient.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
        });
      } catch (error) {
        console.log('Could not notify sender:', error);
      }

      return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // REJECT - Reject a pending trade offer
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'reject') {
      const trade = db.pendingTrades[sender];
      
      if (!trade) {
        return sock.sendMessage(chatId, { 
          text: '❌ No pending trade offer!' 
        }, { quoted: msg });
      }

      const senderTrader = db.users[trade.from];
      delete db.pendingTrades[sender];
      saveDatabase();

      await sock.sendMessage(chatId, { 
        text: '❌ Trade offer rejected!' 
      }, { quoted: msg });

      if (senderTrader) {
        try {
          await sock.sendMessage(trade.from, { 
            text: `❌ ${player.name} rejected your trade offer.` 
          });
        } catch (error) {
          console.log('Could not notify sender:', error);
        }
      }

      return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // CANCEL - Cancel your own trade offer
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'cancel') {
      let cancelled = false;
      let recipientName = '';
      
      for (const recipientId in db.pendingTrades) {
        if (db.pendingTrades[recipientId].from === sender) {
          recipientName = db.users[recipientId]?.name || 'Unknown';
          delete db.pendingTrades[recipientId];
          cancelled = true;
          break;
        }
      }

      if (!cancelled) {
        return sock.sendMessage(chatId, { 
          text: '❌ No active trade offer to cancel!' 
        }, { quoted: msg });
      }

      saveDatabase();
      return sock.sendMessage(chatId, { 
        text: `✅ Trade offer cancelled!\n\nOffer to ${recipientName} has been withdrawn.` 
      }, { quoted: msg });
    }

    // Invalid action
    await sock.sendMessage(chatId, { 
      text: '❌ Invalid action!\n\nUse: offer, accept, reject, or cancel' 
    }, { quoted: msg });
  }
};