// /setbio — Set your hunter bio (batch-47). Editable any time,
// 1,000 Nexus per change. Shows on /profile.
'use strict';

const BIO_COST = 1000;
const BIO_MAX = 150;

module.exports = {
  name: 'setbio',
  aliases: ['bio'],
  description: '📝 Set your hunter bio (1,000 Nexus)',
  usage: '/setbio <bio>',
  category: 'profile',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];
    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    }
    const bio = (args || []).join(' ').trim();
    if (!bio) {
      const cur = player.bio ? `\n\n📝 Current bio:\n_${player.bio}_` : `\n\n_No bio set yet._`;
      return sock.sendMessage(chatId, {
        text: `📝 *Usage:* /setbio <bio>\n\nSet your hunter bio for *${BIO_COST.toLocaleString()}* 💠 Nexus (any time).${cur}`,
      }, { quoted: msg });
    }
    if (bio.length > BIO_MAX) {
      return sock.sendMessage(chatId, { text: `❌ Bio too long (max ${BIO_MAX} characters).` }, { quoted: msg });
    }
    if ((player.gold || 0) < BIO_COST) {
      return sock.sendMessage(chatId, {
        text: `❌ You need *${BIO_COST.toLocaleString()}* 💠 Nexus to set your bio (you have ${(player.gold || 0).toLocaleString()}).`,
      }, { quoted: msg });
    }
    player.gold -= BIO_COST;
    if (player.inventory) player.inventory.gold = player.gold;
    try {
      require('../../rpg/utils/TransactionLog').logTransaction(player, {
        type: 'setbio', amount: -BIO_COST, currency: '💠', note: 'hunter bio',
      });
    } catch (e) {}
    player.bio = bio;
    saveDatabase();
    return sock.sendMessage(chatId, {
      text: `✅ *Bio updated!* (-${BIO_COST.toLocaleString()} 💠)\n\n📝 _${bio}_`,
    }, { quoted: msg });
  },
};
