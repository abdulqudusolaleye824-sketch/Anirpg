// ═══════════════════════════════════════════════════════════════
// /friend — Full friend system
// ═══════════════════════════════════════════════════════════════

const {
  MAX_FRIENDS, GIFT_COST, getFriendData, getBondPerks,
  getStreakTitle, updateStreak, areFriends,
  sendRequest, acceptRequest, removeFriend,
  canGift, generateGift, formatFriendList
} = require('../../rpg/utils/FriendSystem');

module.exports = {
  name: 'friend',
  description: 'Manage your friends and perks',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register [name]' }, { quoted: msg });

    const sub = (args[0] || 'list').toLowerCase();

    // ── /friend list ───────────────────────────────────────────
    if (sub === 'list') {
      const fd = getFriendData(player);
      let msg2 = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      msg2 += '💞 *FRIEND LIST* — ' + player.name + '\n';
      msg2 += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      msg2 += `Friends: ${fd.list.length}/${MAX_FRIENDS}\n\n`;
      msg2 += formatFriendList(player);

      if (fd.requests.length > 0) {
        msg2 += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        msg2 += `📬 *PENDING REQUESTS* (${fd.requests.length})\n`;
        for (const r of fd.requests) msg2 += `• ${r.fromName}\n`;
        msg2 += 'Use /friend accept @user to accept\n';
      }

      msg2 += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      msg2 += '/friend add @user\n/friend remove @user\n/friend gift @user\n/friend check @user\n/friend duel @user';
      return sock.sendMessage(chatId, { text: msg2 }, { quoted: msg });
    }

    // Helpers for tagged user
    const getMentioned = () => {
      return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
          || msg.message?.extendedTextMessage?.contextInfo?.participant
          || null;
    };

    // ── /friend add @user ──────────────────────────────────────
    if (sub === 'add') {
      const targetId = getMentioned();
      if (!targetId) return sock.sendMessage(chatId, { text: '❌ Tag a player: /friend add @user' }, { quoted: msg });
      if (targetId === sender) return sock.sendMessage(chatId, { text: '❌ You cannot add yourself.' }, { quoted: msg });

      const target = db.users[targetId];
      if (!target) return sock.sendMessage(chatId, { text: '❌ That player is not registered.' }, { quoted: msg });

      const fd = getFriendData(player);
      if (fd.list.length >= MAX_FRIENDS) return sock.sendMessage(chatId, { text: '❌ Your friend list is full (10/10).' }, { quoted: msg });
      if (areFriends(player, targetId)) return sock.sendMessage(chatId, { text: `✅ You're already friends with ${target.name}!` }, { quoted: msg });

      const result = sendRequest(sender, player.name, target);
      saveDatabase();

      if (!result.ok) return sock.sendMessage(chatId, { text: '❌ ' + result.reason }, { quoted: msg });

      await sock.sendMessage(chatId, { text: `📨 Friend request sent to *${target.name}*!\nThey can accept with /friend accept @${player.name}` }, { quoted: msg });

      try {
        await sock.sendMessage(targetId, {
          text: `📬 *Friend Request!*\n\n*${player.name}* wants to be your friend!\n\nAccept: /friend accept @${player.name}\nDecline: /friend remove @${player.name}`
        });
      } catch(e) {}
      return;
    }

    // ── /friend accept @user ───────────────────────────────────
    if (sub === 'accept') {
      const targetId = getMentioned();
      if (!targetId) return sock.sendMessage(chatId, { text: '❌ Tag a player: /friend accept @user' }, { quoted: msg });

      const requester = db.users[targetId];
      if (!requester) return sock.sendMessage(chatId, { text: '❌ Player not found.' }, { quoted: msg });

      const result = acceptRequest(player, sender, player.name, targetId, requester.name, requester);
      saveDatabase();

      if (!result.ok) return sock.sendMessage(chatId, { text: '❌ ' + result.reason }, { quoted: msg });

      await sock.sendMessage(chatId, {
        text: `💞 You and *${requester.name}* are now friends!\n\n🤝 Bond Level 1 — play together to grow stronger!\n✨ Party perks now active when you dungeon together.`
      }, { quoted: msg });

      try {
        await sock.sendMessage(targetId, {
          text: `💞 *${player.name}* accepted your friend request!\n\nYou're now friends. Party up to unlock bond perks!`
        });
      } catch(e) {}
      return;
    }

    // ── /friend remove @user ───────────────────────────────────
    if (sub === 'remove') {
      const targetId = getMentioned();
      if (!targetId) return sock.sendMessage(chatId, { text: '❌ Tag a player: /friend remove @user' }, { quoted: msg });

      const target = db.users[targetId];
      const fd = getFriendData(player);

      // Also handles declining a request
      const reqIdx = fd.requests?.findIndex(r => r.from === targetId);
      if (reqIdx !== undefined && reqIdx >= 0) {
        fd.requests.splice(reqIdx, 1);
        saveDatabase();
        return sock.sendMessage(chatId, { text: `❌ Declined request from ${target?.name || 'that player'}.` }, { quoted: msg });
      }

      const removed = removeFriend(player, targetId, target);
      saveDatabase();

      if (!removed) return sock.sendMessage(chatId, { text: '❌ That player is not in your friend list.' }, { quoted: msg });
      return sock.sendMessage(chatId, { text: `💔 Removed *${target?.name || 'player'}* from your friends.` }, { quoted: msg });
    }

    // ── /friend check @user ────────────────────────────────────
    if (sub === 'check') {
      const targetId = getMentioned();
      if (!targetId) return sock.sendMessage(chatId, { text: '❌ Tag a player: /friend check @user' }, { quoted: msg });

      if (!areFriends(player, targetId)) return sock.sendMessage(chatId, { text: '❌ You can only check friends.' }, { quoted: msg });

      const target = db.users[targetId];
      if (!target) return sock.sendMessage(chatId, { text: '❌ Player not found.' }, { quoted: msg });

      const hpPct = Math.floor((target.stats.hp / target.stats.maxHp) * 100);
      const enPct = Math.floor((target.stats.energy / (target.stats.maxEnergy || 100)) * 100);
      const inBattle = target.inBossBattle || target.dungeon?.currentBattle ? '⚔️ In Battle' : '🏡 Idle';
      const effects = target.statusEffects?.length ? target.statusEffects.map(e => e.emoji + e.name).join(' ') : 'None';

      return sock.sendMessage(chatId, {
        text: [
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          `👁️ *${target.name}* — Status Check`,
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          `📊 Level: ${target.level || 1}`,
          `❤️ HP: ${target.stats.hp}/${target.stats.maxHp} (${hpPct}%)`,
          `⚡ Energy: ${target.stats.energy}/${target.stats.maxEnergy || 100} (${enPct}%)`,
          `🎮 Status: ${inBattle}`,
          `💫 Effects: ${effects}`,
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        ].join('\n')
      }, { quoted: msg });
    }

    // ── /friend gift @user ─────────────────────────────────────
    if (sub === 'gift') {
      const targetId = getMentioned();
      if (!targetId) return sock.sendMessage(chatId, { text: '❌ Tag a player: /friend gift @user' }, { quoted: msg });

      if (!areFriends(player, targetId)) return sock.sendMessage(chatId, { text: '❌ You can only gift friends.' }, { quoted: msg });

      // Cost check
      if ((player.gold || 0) < GIFT_COST.gold) return sock.sendMessage(chatId, { text: `❌ Not enough Nexus! Need ${GIFT_COST.gold.toLocaleString()} Nexus to send a gift.` }, { quoted: msg });
      if ((player.manaCrystals || 0) < GIFT_COST.crystals) return sock.sendMessage(chatId, { text: `❌ Not enough crystals! Need ${GIFT_COST.crystals} crystals.` }, { quoted: msg });

      // Cooldown check (24hr per friend)
      const fd = getFriendData(player);
      if (!canGift(player, targetId)) {
        return sock.sendMessage(chatId, { text: '❌ Already gifted this friend today. Come back in 24 hours!' }, { quoted: msg });
      }

      const target = db.users[targetId];
      if (!target) return sock.sendMessage(chatId, { text: '❌ Player not found.' }, { quoted: msg });

      // Find friendship entry for bond level
      const friendEntry = fd.list.find(f => f.id === targetId);
      const bondLevel = friendEntry?.bondLevel || 1;
      const gift = generateGift(bondLevel);

      // Deduct cost from sender
      player.gold -= GIFT_COST.gold;
      player.manaCrystals -= GIFT_COST.crystals;

      // Apply gift to receiver
      if (!target.inventory) target.inventory = {};
      if (!target.inventory.items) target.inventory.items = [];
      let giftDesc = '';

      if (gift.type === 'gold') {
        target.gold = (target.gold || 0) + gift.gold;
        giftDesc = `💠 ${gift.gold.toLocaleString()} Nexus`;
      } else if (gift.type === 'crystals') {
        target.manaCrystals = (target.manaCrystals || 0) + gift.crystals;
        giftDesc = `💎 ${gift.crystals} Mana Stones`;
      } else if (gift.type === 'both') {
        target.gold = (target.gold || 0) + (gift.gold || 0);
        target.manaCrystals = (target.manaCrystals || 0) + (gift.crystals || 0);
        giftDesc = `💠 ${gift.gold.toLocaleString()} Nexus + 💎 ${gift.crystals} Mana Stones`;
      } else {
        if (gift.name === 'Health Potion') target.inventory.healthPotions = (target.inventory.healthPotions || 0) + 1;
        else if (gift.name === 'Energy Potion') target.inventory.energyPotions = (target.inventory.energyPotions || 0) + 1;
        else if (gift.name === 'Revive Token') target.inventory.reviveTokens = (target.inventory.reviveTokens || 0) + 1;
        else target.inventory.items.push({ name: gift.name, type: 'Consumable', rarity: 'uncommon' });
        giftDesc = `🎁 ${gift.name}`;
      }

      // Update gift cooldown and bond
      if (!fd.lastGift) fd.lastGift = {};
      fd.lastGift[targetId] = Date.now();
      if (friendEntry) updateStreak(friendEntry);

      saveDatabase();

      await sock.sendMessage(chatId, {
        text: `🎁 Gift sent to *${target.name}*!\n\n${giftDesc}\n\n💠 Cost: ${GIFT_COST.gold.toLocaleString()} Nexus + ${GIFT_COST.crystals} crystals`
      }, { quoted: msg });

      try {
        await sock.sendMessage(targetId, {
          text: `🎁 *Gift received!*\n\n*${player.name}* sent you:\n${giftDesc}\n\n💞 Friendship goes both ways.`
        });
      } catch(e) {}
      return;
    }

    // ── /friend duel @user ─────────────────────────────────────
    if (sub === 'duel') {
      const targetId = getMentioned();
      if (!targetId) return sock.sendMessage(chatId, { text: '❌ Tag a player: /friend duel @user' }, { quoted: msg });

      if (!areFriends(player, targetId)) return sock.sendMessage(chatId, { text: '❌ You can only duel friends.' }, { quoted: msg });

      const target = db.users[targetId];
      if (!target) return sock.sendMessage(chatId, { text: '❌ Player not found.' }, { quoted: msg });

      // Update streak on both sides
      const fd = getFriendData(player);
      const tfd = getFriendData(target);
      const myEntry = fd.list.find(f => f.id === targetId);
      const theirEntry = tfd.list.find(f => f.id === sender);
      if (myEntry) updateStreak(myEntry);
      if (theirEntry) updateStreak(theirEntry);
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: [
          '⚔️ *FRIEND DUEL REQUEST*',
          '',
          `*${player.name}* challenges *${target.name}* to a friendly duel!`,
          '',
          '📋 Rules:',
          '• No rank loss',
          '• No Nexus penalty',
          '• Pure honor — just for fun',
          '• Bond XP gained win or lose',
          '',
          `@${targetId.split('@')[0]} — Accept with /pvp challenge @${player.name}`,
          '(Rank changes are disabled for friend duels)'
        ].join('\n')
      }, { quoted: msg });
    }

    // ── /friend help @user ─────────────────────────────────────
    if (sub === 'help') {
      const targetId = getMentioned();
      if (!targetId) return sock.sendMessage(chatId, { text: '❌ Tag a player: /friend help @user' }, { quoted: msg });

      if (!areFriends(player, targetId)) return sock.sendMessage(chatId, { text: '❌ You can only help friends.' }, { quoted: msg });

      const fd = getFriendData(player);
      const now = Date.now();
      if (fd.lastHelp && now - fd.lastHelp < 24 * 60 * 60 * 1000) {
        const remaining = 24 * 60 * 60 * 1000 - (now - fd.lastHelp);
        const hrs = Math.floor(remaining / 3600000);
        return sock.sendMessage(chatId, { text: `❌ Emergency help on cooldown. Available in ${hrs}h.` }, { quoted: msg });
      }

      const target = db.users[targetId];
      if (!target) return sock.sendMessage(chatId, { text: '❌ Player not found.' }, { quoted: msg });

      fd.lastHelp = now;

      // Grant target a bonus heal
      const healAmt = Math.floor((target.stats.maxHp || 100) * 0.30);
      target.stats.hp = Math.min(target.stats.maxHp, (target.stats.hp || 0) + healAmt);

      saveDatabase();

      await sock.sendMessage(chatId, {
        text: `🆘 Emergency help sent to *${target.name}*!\n\n❤️ They received a 30% max HP heal remotely.\n\n⏳ Help cooldown: 24 hours`
      }, { quoted: msg });

      try {
        await sock.sendMessage(targetId, {
          text: `🆘 *Emergency Aid!*\n\n*${player.name}* sent you emergency support!\n\n❤️ +${healAmt} HP restored!`
        });
      } catch(e) {}
      return;
    }

    return sock.sendMessage(chatId, {
      text: '💞 *FRIEND COMMANDS*\n\n/friend list\n/friend add @user\n/friend accept @user\n/friend remove @user\n/friend check @user\n/friend gift @user\n/friend duel @user\n/friend help @user'
    }, { quoted: msg });
  }
};
