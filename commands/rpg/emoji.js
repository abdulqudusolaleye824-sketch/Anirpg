// /emoji — Start an Emoji Riddle round (batch-37). Players answer with /guess.
'use strict';

const GC = require('../../rpg/games/GameCenter');
const EmojiRiddle = require('../../rpg/games/EmojiRiddle');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'emoji',
  aliases: ['emojiriddle', 'riddle'],
  description: '🧩 Start an emoji-anime guessing round',
  usage: '/emoji [stop]',
  category: 'games',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    if (!chatId || !chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ Use /emoji inside a group.' }, { quoted: msg });
    }
    const db = getDatabase();
    const g = GC.gate(db, chatId);
    if (!g.ok) return sock.sendMessage(chatId, { text: await GC.gateBlock(db, chatId, sock, g) }, { quoted: msg });

    const sub = (args[0] || '').toLowerCase();
    if (sub === 'stop' || sub === 'end' || sub === 'cancel') {
      const s = EmojiRiddle.getSession(chatId);
      if (!s) return sock.sendMessage(chatId, { text: '❌ No emoji round running here.' }, { quoted: msg });
      let mod = false;
      try { mod = Perms.isBotMod(db, sender); } catch (e) {}
      if (s.starter !== sender && !mod) {
        return sock.sendMessage(chatId, { text: '❌ Only the round starter or a bot mod can stop it.' }, { quoted: msg });
      }
      EmojiRiddle.stop(chatId);
      return sock.sendMessage(chatId, { text: `🛑 Round stopped. The answer was *${s.answer}*.` }, { quoted: msg });
    }

    if (!db.users?.[sender]) {
      return sock.sendMessage(chatId, { text: `You're not registered yet! Use */register* to play.` }, { quoted: msg });
    }
    const send = (text) => sock.sendMessage(chatId, { text });
    const r = EmojiRiddle.start(chatId, sender, send);
    if (r.error === 'active') {
      return sock.sendMessage(chatId, { text: '❌ A round is already running — answer with /guess!' }, { quoted: msg });
    }
    return sock.sendMessage(chatId, {
      text: `🧩 *EMOJI RIDDLE!* Guess the anime/manhwa:\n\n${r.emoji}\n\n💬 Answer with /guess <name> (English or Japanese!)\n⏱️ 90 seconds — GO!`,
    }, { quoted: msg });
  },
};
