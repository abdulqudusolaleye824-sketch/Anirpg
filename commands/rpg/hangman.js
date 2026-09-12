// /hangman — Start a Hangman game (batch-37). Players guess with /hang <letter>.
'use strict';

const GC = require('../../rpg/games/GameCenter');
const Hangman = require('../../rpg/games/Hangman');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'hangman',
  aliases: ['hm'],
  description: '🎪 Start a hangman game',
  usage: '/hangman [stop]',
  category: 'games',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    if (!chatId || !chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ Use /hangman inside a group.' }, { quoted: msg });
    }
    const db = getDatabase();
    const g = GC.gate(db, chatId);
    if (!g.ok) return sock.sendMessage(chatId, { text: await GC.gateBlock(db, chatId, sock, g) }, { quoted: msg });

    const sub = (args[0] || '').toLowerCase();
    if (sub === 'stop' || sub === 'end' || sub === 'cancel') {
      const s = Hangman.getSession(chatId);
      if (!s) return sock.sendMessage(chatId, { text: '❌ No hangman game running here.' }, { quoted: msg });
      let mod = false;
      try { mod = Perms.isBotMod(db, sender); } catch (e) {}
      if (s.starter !== sender && !mod) {
        return sock.sendMessage(chatId, { text: '❌ Only the game starter or a bot mod can stop it.' }, { quoted: msg });
      }
      Hangman.stop(chatId);
      return sock.sendMessage(chatId, { text: `🛑 Game stopped. The word was *${s.word}*.` }, { quoted: msg });
    }

    if (!db.users?.[sender]) {
      return sock.sendMessage(chatId, { text: `You're not registered yet! Use */register* to play.` }, { quoted: msg });
    }
    const send = (text) => sock.sendMessage(chatId, { text });
    const r = Hangman.start(chatId, sender, send);
    if (r.error === 'active') {
      return sock.sendMessage(chatId, { text: '❌ A game is already running — guess with /hang <letter>!' }, { quoted: msg });
    }
    return sock.sendMessage(chatId, { text: r.text }, { quoted: msg });
  },
};
