const { updatePlayerNexus } = require('../../rpg/utils/NexusManager');
const { logTransaction } = require('../../rpg/utils/TransactionLog');
const DC = require('../../rpg/utils/DailyChallenges');
const { COOWNER_JID } = require('../../utils/constants');

module.exports = {
  name: 'send',
  description: 'Send Nexus or crystals to another hunter',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      await sock.sendMessage(chatId, { 
        text: '❌ You are not registered!' 
      }, { quoted: msg });
      return;
    }

    // Currency synonyms: 'nexus'/'gold'/'💠' = Nexus (player.gold);
    // 'crystals'/'mana'/'stones'/'💎' = Mana Stones.
    let currency = null;

    // Detect currency token wherever it appears (supports both
    // "/send nexus @user 1000" and "/send 4000 Nexus" orders).
    const cur = (t) => (t || '').toLowerCase();
    const isNexusWord = (t) => ['nexus', 'gold'].includes(cur(t));
    const isCrystalWord = (t) => ['crystals', 'mana', 'mana-stones', 'manastone', 'stones'].includes(cur(t));
    for (const tok of args) {
      if (isNexusWord(tok) || cur(tok) === '💠') { currency = 'nexus'; break; }
      else if (isCrystalWord(tok) || cur(tok) === '💎') { currency = 'crystals'; break; }
    }

    // action = first non-currency, non-numeric token (kept for menus/errors)
    const action = args.find(t => !/^\d+$/.test(t))?.toLowerCase() || args[0]?.toLowerCase();

    if (!args.length) {
      const menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💸 *SEND SYSTEM* 💸
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Send resources to other hunters!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Your Nexus: ${player.gold || 0}
💎 Your 💎 Mana Stones: ${player.manaCrystals}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 USAGE
/send nexus @user [amount]
/send crystals @user [amount]

Example:
Reply to someone's message and type:
/send nexus 1000

Or mention them:
/send nexus @user 1000
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 RULES
- Min amount: 1000
- Max amount: 5,000000 per send
- 5% transaction fee
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await sock.sendMessage(chatId, { text: menu }, { quoted: msg });
      return;
    }

    if (currency) {
      let recipientId = null;

      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;

      recipientId = mentionedJid || quotedParticipant;

      // A REAL WhatsApp mention stores the contact's JID in mentionedJid, but
      // the raw message text contains "@<number>" (not the name). If mentionedJid
      // was somehow missing, rebuild the target from that @number token.
      if (!recipientId) {
        const numberToken = args.find((a) => /^@\d+$/.test(a));
        if (numberToken) {
          const bareNum = numberToken.slice(1);
          recipientId = Object.keys(db.users || {}).find((k) =>
            String(k).split(':')[0].split('@')[0] === bareNum
          ) || `${bareNum}@s.whatsapp.net`;
        }
      }

      // Fallback: user typed an @Name (not a real WhatsApp mention) — resolve
      // it against registered players (name + bare number), then the group's
      // participant list (by pushName).
      if (!recipientId) {
        const atToken = args.find((a) => /^@/.test(a));
        const norm = (s) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, '');
        if (atToken) {
          const wanted = norm(atToken.slice(1));
          const match = Object.entries(db.users || {}).find(([, u]) =>
            norm(u.name) === wanted ||
            norm(u.name).startsWith(wanted) ||
            wanted.startsWith(norm(u.name)) ||
            norm(String(u.id || '').split('@')[0]) === wanted
          );
          if (match) {
            recipientId = match[0];
          } else if (chatId.endsWith('@g.us')) {
            try {
              const meta = await sock.groupMetadata(chatId);
              const at = meta.participants.find((m) => {
                const n = norm(m.pushName || '');
                return n === wanted || n.startsWith(wanted) || wanted.startsWith(n);
              });
              if (at) recipientId = at.id;
            } catch (_) {}
          }
        }
      }

      if (!recipientId) {
        const atToken = args.find((a) => /^@/.test(a));
        await sock.sendMessage(chatId, {
          text: "❌ Couldn't find *" + (atToken ? atToken.slice(1) : 'that user') + "*!\n\n💡 They must be registered with that exact name (/register).\nOr reply to their message + /send nexus [amount]."
        }, { quoted: msg });
        return;
      }

      // Normalise recipient lookup: match by exact key OR bare number so a JID
      // resolved from group metadata (possibly device-suffixed) still finds the
      // registered player.
      const bareRecipient = String(recipientId).split(':')[0].split('@')[0];
      let recipient = db.users[recipientId]
        || db.users[bareRecipient]
        || db.users[String(recipientId).split(':')[0]]
        || Object.values(db.users || {}).find((u) => String(u.id || '').split('@')[0] === bareRecipient);

      if (!recipient) {
        // 🔧 AUTO-REGISTER: the recipient is in the group/mentioned but has no
        // player record. Create a minimal hunter for them so /send just works.
        // (Players can later run /register to customise class/DOB.)
        let pushName = bareRecipient;
        try {
          if (chatId.endsWith('@g.us')) {
            const meta = await sock.groupMetadata(chatId);
            const p = meta.participants.find((m) =>
              String(m.id).split(':')[0].split('@')[0] === bareRecipient
            );
            if (p) pushName = p.pushName || bareRecipient;
          }
        } catch (_) {}

        if (!db.users) db.users = {};
        db.users[bareRecipient] = {
          id: bareRecipient,
          name: pushName,
          registeredAt: Date.now(),
          registrantNote: 'auto-registered via /send',
          level: 1,
          xp: 0,
          awakeRank: 'E',
          class: null,
          gold: 0,
          manaCrystals: 0,
          inventory: { gold: 0, weapons: [], armor: [], accessories: [], potions: [], artifacts: [], materials: [], keyStones: [], healthPotions: 0, manaPotions: 0, energyPotions: 0, reviveTokens: 0 },
        };
        recipient = db.users[bareRecipient];
        saveDatabase();
        try {
          await sock.sendMessage(chatId, {
            text: `🆕 *${pushName}* wasn't registered, so I created a hunter account for them. Continue!`,
            mentions: recipientId ? [recipientId] : undefined,
          }, { quoted: msg });
        } catch (_) {}
      }

      if (String(recipientId).split(':')[0].split('@')[0] === String(sender).split(':')[0].split('@')[0]) {
        await sock.sendMessage(chatId, { 
          text: '❌ You cannot send to yourself!' 
        }, { quoted: msg });
        return;
      }

      // Grab the amount from any numeric token (handles both
      // "/send nexus @user 1000" and "/send 4000 nexus").
      let amount = null;
      for (const tok of args) {
        const n = parseInt(tok);
        if (!isNaN(n)) { amount = n; break; }
      }

      if (amount === null || amount < 1000) {
        await sock.sendMessage(chatId, {
          text: '❌ Invalid amount!\n\nMinimum: 1000\nExample: /send nexus @user 1000'
        }, { quoted: msg });
        return;
      }

      if (amount > 5000000) {
        await sock.sendMessage(chatId, {
          text: '❌ Maximum 5000000 per send!'
        }, { quoted: msg });
        return;
      }

      // ✅ NEW: 5% Transaction Fee
      const fee = Math.floor(amount * 0.05);
      const amountAfterFee = amount - fee;
      const BOT_OWNER_ID = COOWNER_JID;

      if (currency === 'nexus') {
        const senderNexus = player.gold || 0;
        
        if (senderNexus < amount) {
          await sock.sendMessage(chatId, {
            text: `❌ Not enough Nexus!\n\nNeed: ${amount} 💠 (+ ${fee} fee)\nHave: ${senderNexus} 💠`
          }, { quoted: msg });
          return;
        }

        // Transfer Nexus
        player.gold = senderNexus - amount;
        recipient.gold = (recipient.gold || 0) + amountAfterFee;
        
        // Sync inventory
        if (player.inventory) player.inventory.gold = player.gold;
        if (recipient.inventory) recipient.inventory.gold = recipient.gold;

        // Log transaction for both parties
        logTransaction(player, { type:'send', amount, currency:'💠', note:`→ ${recipient.name}` });
        DC.trackProgress(player, 'send_gold', 1);
        try{require('./weekly').trackWeeklyProgress(player,'earn_gold',amount);}catch(e){}
        logTransaction(recipient, { type:'receive', amount:amountAfterFee, currency:'💠', note:`← ${player.name}` });

        // ✅ FEE GOES TO YOU!
        if (!db.users[BOT_OWNER_ID]) {
          db.users[BOT_OWNER_ID] = {
            id: BOT_OWNER_ID,
            name: 'System',
            gold: fee,
            manaCrystals: 0,
            inventory: { gold: fee }
          };
        } else {
          db.users[BOT_OWNER_ID].gold = (db.users[BOT_OWNER_ID].gold || 0) + fee;
          if (db.users[BOT_OWNER_ID].inventory) {
            db.users[BOT_OWNER_ID].inventory.gold = db.users[BOT_OWNER_ID].gold;
          }
        }

        saveDatabase();

        await sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ NEXUS SENT! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Amount: ${amount} Nexus
💸 Transaction Fee: ${fee} Nexus (5%)
💠 Recipient Gets: ${amountAfterFee} Nexus
👤 To: @${recipientId.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Your Nexus Left: ${player.gold}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [recipientId]
        }, { quoted: msg });

        await sock.sendMessage(recipientId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 NEXUS RECEIVED! 💠
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Received: ${amountAfterFee} Nexus
💸 (${amount} - ${fee} fee)
👤 From: @${sender.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Your Nexus Now: ${recipient.gold}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [sender]
        });
      } 
      else if (currency === 'crystals') {
        if (player.manaCrystals < amount) {
          await sock.sendMessage(chatId, {
            text: `❌ Not enough Mana Stones!\n\nNeed: ${amount} 💎 (+ ${fee} fee)\nHave: ${player.manaCrystals} 💎`
          }, { quoted: msg });
          return;
        }

        // Transfer crystals
        player.manaCrystals -= amount;
        recipient.manaCrystals += amountAfterFee;

        // ✅ FEE GOES TO YOU (converted to Nexus)!
        const goldFee = fee * 2; // 1 crystal = 2 Nexus
        
        if (!db.users[BOT_OWNER_ID]) {
          db.users[BOT_OWNER_ID] = {
            id: BOT_OWNER_ID,
            name: 'System',
            gold: goldFee,
            manaCrystals: 0,
            inventory: { gold: goldFee }
          };
        } else {
          db.users[BOT_OWNER_ID].gold = (db.users[BOT_OWNER_ID].gold || 0) + goldFee;
          if (db.users[BOT_OWNER_ID].inventory) {
            db.users[BOT_OWNER_ID].inventory.gold = db.users[BOT_OWNER_ID].gold;
          }
        }

        saveDatabase();

        await sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ MANA STONES SENT! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 Amount: ${amount} Mana Stones
💸 Transaction Fee: ${fee} Mana Stones (5%)
💎 Recipient Gets: ${amountAfterFee} Mana Stones
👤 To: @${recipientId.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 Your Mana Stones Left: ${player.manaCrystals}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [recipientId]
        }, { quoted: msg });

        await sock.sendMessage(recipientId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 MANA STONES RECEIVED! 💎
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 Received: ${amountAfterFee} Mana Stones
💸 (${amount} - ${fee} fee)
👤 From: @${sender.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 Your Mana Stones Now: ${recipient.manaCrystals}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [sender]
        });
      }
      return;
    }

    await sock.sendMessage(chatId, {
      text: '❌ Invalid!\n\nUse: /send nexus or /send crystals'
    }, { quoted: msg });
  }
};