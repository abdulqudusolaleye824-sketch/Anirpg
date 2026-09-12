// reject-ch.js — Reject a pending chess challenge (games GC).

const GC = require('../../rpg/games/GameCenter');

const KIND = 'chess';

module.exports = {
  name: 'reject-ch',
  description: '♞ Reject a chess challenge (games GC)',
  usage: '/reject-ch',
  category: 'games',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const g = GC.gate(db, chatId);
    if (!g.ok) return sock.sendMessage(chatId, { text: g.reason }, { quoted: msg });

    const game = GC.slot(db, KIND, chatId);
    if (!game || game.phase !== 'challenge') {
      return sock.sendMessage(chatId, { text: `❌ No pending chess challenge here.` }, { quoted: msg });
    }
    if (sender !== game.blackJid && sender !== game.whiteJid) {
      return sock.sendMessage(chatId, { text: `❌ Only the challenged player can reject this match.` }, { quoted: msg });
    }
    GC.clearSlot(db, KIND, chatId);
    saveDatabase(db);
    return sock.sendMessage(chatId, {
      text: `${GC.mentionOf(sender)} rejected the chess challenge.`,
      mentions: [sender],
    }, { quoted: msg });
  },
};
