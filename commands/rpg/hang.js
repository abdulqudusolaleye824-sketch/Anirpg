// /hang — Guess a letter in the running Hangman game (batch-37).
'use strict';

const Hangman = require('../../rpg/games/Hangman');

module.exports = {
  name: 'hang',
  aliases: [], // (no 'h' — /h is the established /help alias)
  description: '🔤 Guess a hangman letter',
  usage: '/hang <letter>',
  category: 'games',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    if (!chatId || !chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ Use /hang inside a group.' }, { quoted: msg });
    }
    if (!args.length) {
      return sock.sendMessage(chatId, { text: '❌ Usage: /hang <letter>\nExample: /hang E' }, { quoted: msg });
    }
    const s = Hangman.getSession(chatId);
    if (!s) {
      return sock.sendMessage(chatId, { text: '❌ No hangman game running here. Start one with /hangman!' }, { quoted: msg });
    }
    const db = getDatabase();
    const r = Hangman.guessLetter(db, saveDatabase, chatId, sender, msg.pushName, args[0]);
    if (!r) {
      return sock.sendMessage(chatId, { text: '❌ No hangman game running here. Start one with /hangman!' }, { quoted: msg });
    }
    return sock.sendMessage(chatId, { text: r.text, mentions: r.mention ? [r.mention] : [] }, { quoted: msg });
  },
};
