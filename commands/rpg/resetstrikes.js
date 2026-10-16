// Push #102h: /resetstrikes — Owner wipes every spam strike and lifts every SpamGuard mute (DM + group) for all players.
'use strict';
const Perms = require('../../utils/permissions');
module.exports = {
  name: 'resetstrikes', aliases: ['resetstrike', 'clearstrikes'],
  description: '👑 Owner: reset all spam strikes and lift all spam auto-mutes',
  usage: '/resetstrikes', ownerOnly: true,
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Owner only.' }, { quoted: msg });
    const r = require('../../rpg/utils/SpamGuard').resetAll(db); saveDatabase();
    return sock.sendMessage(chatId, { text: `🧹 *SPAM STRIKES RESET*\n• ${r.strikes} player strike record${r.strikes === 1 ? '' : 's'} wiped\n• ${r.mutes} spam mute${r.mutes === 1 ? '' : 's'} lifted\nEveryone starts the week clean.` }, { quoted: msg });
  },
};
