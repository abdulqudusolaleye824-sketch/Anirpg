const { updatePlayerNexus } = require('../../rpg/utils/NexusManager');
const { logTransaction } = require('../../rpg/utils/TransactionLog');
const DC = require('../../rpg/utils/DailyChallenges');
const { COOWNER_JID } = require('../../utils/constants');

module.exports = {
  name: 'send',
  description: 'Send Nexus or Moonstones to another hunter',

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

    if (!args.length) {
      await sock.sendMessage(chatId, {
        text: '❌ Invalid! Use: /send nexus or /send moonstones'
      }, { quoted: msg });
      return;
    }

    let currency = null;
    const cur = (t) => (t || '').toLowerCase();
    const isNexusWord = (t) => ['nexus', 'gold', '💠'].includes(cur(t));
    const isMoonstoneWord = (t) => ['moonstones', 'moonstone', 'crystals', 'mana', 'mana-stones', 'manastone', 'stones', '💎'].includes(cur(t));

    for (const tok of args) {
      if (isNexusWord(tok)) { currency = 'nexus'; break; }
      else if (isMoonstoneWord(tok)) { currency = 'moonstones'; break; }
    }

    if (!currency) {
      await sock.sendMessage(chatId, {
        text: '❌ Invalid! Use: /send nexus or /send moonstones'
      }, { quoted: msg });
      return;
    }

    // Amount validated BEFORE recipient lookup (batch-23): invalid sends
    // must not auto-register strangers as a side effect.
    let amount = null;
    for (const tok of args) {
      const n = parseInt(tok);
      if (!isNaN(n)) { amount = n; break; }
    }

    if (amount === null || amount < 1000) {
      await sock.sendMessage(chatId, {
        text: '❌ Invalid amount!\n\nMinimum: 1000\nExample: /send nexus @user 1000 or /send moonstones @user 1000'
      }, { quoted: msg });
      return;
    }

    if (amount > 5000000) {
      await sock.sendMessage(chatId, {
        text: '❌ Maximum 5000000 per send!'
      }, { quoted: msg });
      return;
    }


    let recipientId = null;
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;

    recipientId = mentionedJid || quotedParticipant;

    if (!recipientId) {
      const numberToken = args.find((a) => /^@\d+$/.test(a));
      if (numberToken) {
        const bareNum = numberToken.slice(1);
        recipientId = Object.keys(db.users || {}).find((k) =>
          String(k).split(':')[0].split('@')[0] === bareNum
        ) || `${bareNum}@s.whatsapp.net`;
      }
    }

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
        text: "❌ Couldn't find *" + (atToken ? atToken.slice(1) : 'that user') + "*!\n\n💡 They must be registered with that exact name (/register).\nOr reply to their message + /send nexus or /send moonstones."
      }, { quoted: msg });
      return;
    }

    const bareRecipient = String(recipientId).split(':')[0].split('@')[0];
    let recipient = db.users[recipientId]
      || db.users[bareRecipient]
      || db.users[String(recipientId).split(':')[0]]
      || Object.values(db.users || {}).find((u) => String(u.id || '').split('@')[0] === bareRecipient);

    if (!recipient) {
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

    // Normalized JID for mentions/display (auto-registered keys can be bare numbers).
    const mentionJid = String(recipientId).includes('@') ? String(recipientId).split(':')[0] : `${recipientId}@s.whatsapp.net`;
    const mentionTag = mentionJid.split('@')[0];

    const fee = Math.floor(amount * 0.05);
    // Sender pays amount + fee; recipient gets the FULL amount (batch-23,
    // same fee rule as /trade — matches the "Need: X (+ Y fee)" text).
    const totalCost = amount + fee;
    const BOT_OWNER_ID = COOWNER_JID;

    if (currency === 'nexus') {
      const senderNexus = player.gold || 0;
      
      if (senderNexus < totalCost) {
        await sock.sendMessage(chatId, {
          text: `❌ Not enough Nexus!\n\nNeed: ${totalCost} 💠 (${amount} + ${fee} fee)\nHave: ${senderNexus} 💠`
        }, { quoted: msg });
        return;
      }

      // Canonical Nexus sync (gold + inventory + goldEarn quest) via updatePlayerNexus.
      updatePlayerNexus(player, -totalCost, null);
      updatePlayerNexus(recipient, amount, null);
      

      logTransaction(player, { type:'send', amount: totalCost, currency:'💠', note:`→ ${recipient.name} (${amount} + ${fee} fee)` });
      DC.trackProgress(player, 'send_gold', 1);
      try{require('./weekly').trackWeeklyProgress(player,'earn_gold',amount);}catch(e){}
      logTransaction(recipient, { type:'receive', amount, currency:'💠', note:`← ${player.name}` });

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
💠 Recipient Gets: ${amount} Nexus
👤 To: @${mentionTag}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Your Nexus Left: ${player.gold}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions: [mentionJid]
      }, { quoted: msg });
    } 
    else if (currency === 'moonstones') {
      const senderStones = player.manaCrystals || 0;
      if (senderStones < totalCost) {
        await sock.sendMessage(chatId, {
          text: `❌ Not enough Moonstones!\n\nNeed: ${totalCost} 💎 (${amount} + ${fee} fee)\nHave: ${senderStones} 💎`
        }, { quoted: msg });
        return;
      }

      // Sender pays amount + fee; recipient gets the FULL amount; the fee
      // stays in Moonstones (batch-23 — no more gold printed from stone fees).
      player.manaCrystals = senderStones - totalCost;
      recipient.manaCrystals = (recipient.manaCrystals || 0) + amount;
      if (player.inventory) player.inventory.manaCrystals = player.manaCrystals;
      if (recipient.inventory) recipient.inventory.manaCrystals = recipient.manaCrystals;

      logTransaction(player, { type:'send', amount: totalCost, currency:'💎', note:`→ ${recipient.name} (${amount} + ${fee} fee)` });
      logTransaction(recipient, { type:'receive', amount, currency:'💎', note:`← ${player.name}` });

      // (moonstone fee accrues in Moonstones on the System account — see below)
      
      if (!db.users[BOT_OWNER_ID]) {
        db.users[BOT_OWNER_ID] = {
          id: BOT_OWNER_ID,
          name: 'System',
          gold: 0,
          manaCrystals: fee,
          inventory: { gold: 0 }
        };
      } else {
        db.users[BOT_OWNER_ID].manaCrystals = (db.users[BOT_OWNER_ID].manaCrystals || 0) + fee;
      }

      saveDatabase();

      await sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ MOONSTONES SENT! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 Amount: ${amount} Moonstones
💸 Transaction Fee: ${fee} Moonstones (5%)
💎 Recipient Gets: ${amount} Moonstones
👤 To: @${mentionTag}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 Your Moonstones Left: ${player.manaCrystals}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions: [mentionJid]
      }, { quoted: msg });
    }
  }
};
