// /typerace — Start a Typing Race (batch-37). Players win by retyping
// the posted sentence EXACTLY as a plain chat message (no command).
'use strict';

const GC = require('../../rpg/games/GameCenter');
const TypingRace = require('../../rpg/games/TypingRace');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'typerace',
  aliases: ['tr', 'type'],
  description: '⌨️ Start a typing race',
  usage: '/typerace [stop]',
  category: 'games',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    if (!chatId || !chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ Use /typerace inside a group.' }, { quoted: msg });
    }
    const db = getDatabase();
    const g = GC.gate(db, chatId);
    if (!g.ok) return sock.sendMessage(chatId, { text: await GC.gateBlock(db, chatId, sock, g) }, { quoted: msg });

    const sub = (args[0] || '').toLowerCase();
    if (sub === 'stop' || sub === 'end' || sub === 'cancel') {
      const s = TypingRace.getSession(chatId);
      if (!s) return sock.sendMessage(chatId, { text: '❌ No typing race running here.' }, { quoted: msg });
      let mod = false;
      try { mod = Perms.isBotMod(db, sender); } catch (e) {}
      if (s.starter !== sender && !mod) {
        return sock.sendMessage(chatId, { text: '❌ Only the race starter or a bot mod can stop it.' }, { quoted: msg });
      }
      TypingRace.stop(chatId);
      return sock.sendMessage(chatId, { text: `🛑 Race stopped.` }, { quoted: msg });
    }

    // Batch-47: one game at a time here + none while in battle.
    try {
      const _ag = GC.activeGameIn(db, chatId);
      if (_ag) return sock.sendMessage(chatId, { text: GC.gameBusyBlock(_ag) }, { quoted: msg });
      const _bt = GC.inBattle(db, sender);
      if (_bt) return sock.sendMessage(chatId, { text: GC.battleBlock(_bt) }, { quoted: msg });
    } catch (e) {}

    if (!db.users?.[sender]) {
      return sock.sendMessage(chatId, { text: `You're not registered yet! Use */register* to play.` }, { quoted: msg });
    }
    const send = (text) => sock.sendMessage(chatId, { text });
    const r = TypingRace.start(chatId, sender, send);
    if (r.error === 'active') {
      return sock.sendMessage(chatId, { text: '❌ A race is already running — just type the sentence!' }, { quoted: msg });
    }
    return sock.sendMessage(chatId, { text: r.text }, { quoted: msg });
  },
};
