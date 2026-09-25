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
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const action = args[0]?.toLowerCase();
    // Push #88p: currency aliases + display labels (storage keys stay 'gold' / 'crystals')
    const RES_LABEL = { gold: '💠 Nexus', crystals: '💎 Mana Stones' };
    const resLabel = (r) => RES_LABEL[r] || r;
    const parseResource = (t) => {
      const k = String(t || '').toLowerCase().replace(/[^a-z]/g, '');
      if (['gold', 'nexus', 'nx', 'coins', 'coin', 'money'].includes(k)) return 'gold';
      if (['crystals', 'crystal', 'stones', 'stone', 'mana', 'manastones', 'manastone', 'ms', 'gems', 'gem'].includes(k)) return 'crystals';
      return null;
    };

    // Initialize pending trades
    if (!db.pendingTrades) {
      db.pendingTrades = {};
    }
    const _deskIn = db.pendingTrades[sender];
    const _deskOut = Object.values(db.pendingTrades).find(t => t && t.from === sender);

    // ═══════════════════════════════════════════════════════════════════
    // TRADING MENU (No action)
    // ═══════════════════════════════════════════════════════════════════
    if (!action) {
      return sock.sendMessage(chatId, { 
        text: (pro ? `${UI.PRO_BAR}\n🤝 TRADING SYSTEM 🤝 💎\n${UI.PRO_BAR}\n` : `🤝 TRADING SYSTEM 🤝\n${UI.FREE_BAR}\n`) + `Trade resources with other hunters!
${FRAME}

📌 COMMANDS
${FRAME}
/trade offer @user [amount] [type]
  Example: /trade offer @user 100 Nexus
  Example: /trade offer @user 500 Stones
  (Replying to someone also works)

/trade accept - Accept pending trade
/trade reject - Reject pending trade
/trade cancel - Cancel your offer

${FRAME}
💠 TRADEABLE RESOURCES
${FRAME}
• Nexus (or: nx, gold)
• Stones (or: crystals, mana)

${FRAME}
📜 TRADING RULES
${FRAME}
✅ Both hunters must be registered
✅ Minimum trade: 50 units
💠 5% system fee (deducted from sender)
⏰ Trades expire after 5 minutes
${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n` + (_deskIn ? `💎 *PRO DESK* — incoming: ${_deskIn.amount} ${resLabel(_deskIn.resource)}` : _deskOut ? `💎 *PRO DESK* — outgoing: ${_deskOut.amount} ${resLabel(_deskOut.resource)}` : `💎 *PRO DESK* — no pending trades`) : `\n${UI.upsell()}`) 
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════════
    // OFFER - Make a trade offer to another player
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'offer') {
      // Push #88p: accept a real @mention or a reply, and let the amount/type come in either order
      const _mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const _quotedP = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const _rest = args.slice(1).filter(a => !/^@/.test(a));
      const _numTok = _rest.find(a => /^\d+$/.test(a));
      const _typeTok = _rest.find(a => !/^\d+$/.test(a));
      const recipientArg = args.slice(1).find(a => /^@/.test(a)) || (_mentioned || _quotedP ? '@' : null);
      
      if (!recipientArg) {
        return sock.sendMessage(chatId, { 
          text: '❌ Please specify recipient!\n\nExample: /trade offer @1234567890 100 Nexus' 
        }, { quoted: msg });
      }

      const amount = parseInt(_numTok);
      const resourceType = parseResource(_typeTok);

      if (!amount || amount < 50) {
        return sock.sendMessage(chatId, { 
          text: '❌ Minimum trade amount is 50!' 
        }, { quoted: msg });
      }

      if (!resourceType) {
        return sock.sendMessage(chatId, { 
          text: '❌ Invalid resource!\n\nChoose: *Nexus* or *Stones*\nExample: /trade offer @user 500 stones' 
        }, { quoted: msg });
      }

      // Find recipient: mention / reply first, then @number, then @name
      let recipientId = null;
      const _findUser = (jid) => {
        if (!jid) return null;
        if (db.users[jid]) return jid;
        const bare = String(jid).split(':')[0].split('@')[0];
        return Object.keys(db.users).find(k => String(k).split(':')[0].split('@')[0] === bare) || null;
      };
      recipientId = _findUser(_mentioned) || _findUser(_quotedP);
      if (!recipientId && recipientArg && recipientArg.length > 1) {
        const raw = recipientArg.slice(1);
        if (/^\d+$/.test(raw)) {
          recipientId = _findUser(raw + '@s.whatsapp.net') || _findUser(raw + '@lid');
        } else {
          const norm = (t) => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, '');
          const wanted = norm(raw);
          const m = Object.entries(db.users).find(([, u]) => u && norm(u.name) === wanted)
            || Object.entries(db.users).find(([, u]) => u && wanted && norm(u.name).startsWith(wanted));
          if (m) recipientId = m[0];
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
        playerResource = Number(player.gold) || 0;
      } else {
        // Push #88p: player.manaCrystals is the single source of truth (matches /balance)
        playerResource = Number(player.manaCrystals) || 0;
      }

      if (playerResource < totalNeeded) {
        return sock.sendMessage(chatId, { 
          text: `❌ Insufficient ${resLabel(resourceType)}!\n\nYou need: ${totalNeeded.toLocaleString()} (${amount.toLocaleString()} + ${fee.toLocaleString()} fee)\nYou have: ${playerResource.toLocaleString()}` 
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
        text: `${FRAME}
✅ TRADE OFFER SENT!
${FRAME}
📦 Offering: ${amount.toLocaleString()} ${resLabel(resourceType)}
👤 To: ${db.users[recipientId].name}
🧾 Fee: ${fee.toLocaleString()} ${resLabel(resourceType)} (5%)
${FRAME}
📊 Total Cost: ${totalNeeded.toLocaleString()} ${resLabel(resourceType)}
⏰ Offer expires in 5 minutes
${FRAME}` 
      }, { quoted: msg });

      // Notify recipient (styled by the RECIPIENT's pro status)
      try {
        const FRAME = UI.isPro(db.users[recipientId]) ? UI.PRO_BAR : UI.FREE_BAR;
        await sock.sendMessage(recipientId, { 
          text: `${FRAME}
🔔 TRADE OFFER RECEIVED!
${FRAME}
👤 From: ${player.name}
📦 You will receive: ${amount.toLocaleString()} ${resLabel(resourceType)}
💠 No cost to you!
${FRAME}
📌 ACTIONS:
• /trade accept - Accept trade
• /trade reject - Reject trade
${FRAME}
⏰ Offer expires in 5 minutes
${FRAME}` 
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
        senderResource = Number(senderTrader.gold) || 0;
      } else {
        senderResource = Number(senderTrader.manaCrystals) || 0;
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
        // Push #88p FIX: previously wrote inventory.manaCrystals (a dead mirror) whenever an
        // inventory object existed, so /balance never changed even though the ledger logged it.
        senderTrader.manaCrystals = (Number(senderTrader.manaCrystals) || 0) - totalNeeded;
        if (senderTrader.inventory) senderTrader.inventory.manaCrystals = senderTrader.manaCrystals;
        recipient.manaCrystals = (Number(recipient.manaCrystals) || 0) + trade.amount;
        if (recipient.inventory) recipient.inventory.manaCrystals = recipient.manaCrystals;
        
        // Push #88p: stone fee stays in Mana Stones and goes to the owner's REAL balance
        // (previously converted to a dead inventory.gold mirror that no command reads)
        if (!db.users[BOT_OWNER_ID]) {
          db.users[BOT_OWNER_ID] = { id: BOT_OWNER_ID, name: 'System', gold: 0, manaCrystals: 0, inventory: { gold: 0, manaCrystals: 0 } };
        }
        const _own = db.users[BOT_OWNER_ID];
        _own.manaCrystals = (Number(_own.manaCrystals) || 0) + trade.fee;
        if (_own.inventory) _own.inventory.manaCrystals = _own.manaCrystals;
      }

      delete db.pendingTrades[sender];

      // Log transaction for both parties
      const tradeCurrency = trade.resource === 'gold' ? '💠' : '💎';
      logTransaction(senderTrader, { type:'trade', amount:trade.amount, currency:tradeCurrency, note:`→ ${recipient.name}` });
      logTransaction(recipient, { type:'trade_receive', amount:trade.amount, currency:tradeCurrency, note:`← ${senderTrader.name}` });

      saveDatabase();

      await sock.sendMessage(chatId, { 
        text: `${FRAME}
✅ TRADE COMPLETED!
${FRAME}
📦 Received: ${trade.amount.toLocaleString()} ${resLabel(trade.resource)}
💠 No cost to you!
${FRAME}
👤 From: ${senderTrader.name}
${FRAME}` 
      }, { quoted: msg });

      try {
        await sock.sendMessage(trade.from, { 
          text: `${FRAME}
✅ TRADE COMPLETED!
${FRAME}
📦 Sent: ${trade.amount.toLocaleString()} ${resLabel(trade.resource)}
🧾 System Fee: ${trade.fee.toLocaleString()} ${resLabel(trade.resource)} (5%)
${FRAME}
👤 To: ${recipient.name}
${FRAME}` 
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