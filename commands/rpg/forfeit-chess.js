// forfeit-chess.js — Resign the active chess game (games GC).

const GC = require('../../rpg/games/GameCenter');

const KIND = 'chess';

module.exports = {
  name: 'forfeit-chess',
  description: '♞ Resign the chess match (games GC)',
  usage: '/forfeit-chess',
  category: 'games',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const g = GC.gate(db, chatId);
    if (!g.ok) return sock.sendMessage(chatId, { text: await GC.gateBlock(db, chatId, sock, g) }, { quoted: msg });

    const game = GC.slot(db, KIND, chatId);
    if (!game || game.phase !== 'active') {
      return sock.sendMessage(chatId, { text: `❌ No active chess game to forfeit.` }, { quoted: msg });
    }
    const myColor = sender === game.whiteJid ? 'w' : sender === game.blackJid ? 'b' : null;
    if (!myColor) {
      return sock.sendMessage(chatId, { text: `❌ Only the players can forfeit this match.` }, { quoted: msg });
    }
    const winnerColor = myColor === 'w' ? 'b' : 'w';
    const finish = require('./move')._finishChess;
    return finish(sock, chatId, msg, db, saveDatabase, game, winnerColor, sender);
  },
};
