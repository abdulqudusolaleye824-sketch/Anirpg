// /guess — Answer the running Emoji Riddle round (batch-37).
'use strict';

const EmojiRiddle = require('../../rpg/games/EmojiRiddle');

module.exports = {
  name: 'guess',
  aliases: ['g'],
  description: '🧩 Guess the emoji riddle answer',
  usage: '/guess <anime name>',
  category: 'games',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    if (!chatId || !chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ Use /guess inside a group.' }, { quoted: msg });
    }
    if (!args.length) {
      return sock.sendMessage(chatId, { text: '❌ Usage: /guess <anime name>\nExample: /guess Naruto' }, { quoted: msg });
    }
    const s = EmojiRiddle.getSession(chatId);
    if (!s) {
      return sock.sendMessage(chatId, { text: '❌ No emoji round running here. Start one with /emoji!' }, { quoted: msg });
    }
    const db = getDatabase();
    const r = EmojiRiddle.guess(db, saveDatabase, chatId, sender, msg.pushName, args.join(' '));
    if (!r) {
      return sock.sendMessage(chatId, { text: '❌ No emoji round running here. Start one with /emoji!' }, { quoted: msg });
    }
    return sock.sendMessage(chatId, { text: r.text, mentions: r.mention ? [r.mention] : [] }, { quoted: msg });
  },
};
