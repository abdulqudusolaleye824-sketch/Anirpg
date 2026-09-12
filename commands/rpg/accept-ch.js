// accept-ch.js — Accept a pending chess challenge (games GC).

const GC = require('../../rpg/games/GameCenter');
const Boards = require('../../rpg/games/GameBoards');

const KIND = 'chess';

module.exports = {
  name: 'accept-ch',
  description: '♞ Accept a chess challenge (games GC)',
  usage: '/accept-ch',
  category: 'games',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const g = GC.gate(db, chatId);
    if (!g.ok) return sock.sendMessage(chatId, { text: await GC.gateBlock(db, chatId, sock, g) }, { quoted: msg });

    const game = GC.slot(db, KIND, chatId);
    if (!game || game.phase !== 'challenge') {
      return sock.sendMessage(chatId, { text: `❌ No pending chess challenge here. Start one with */ch @user*.` }, { quoted: msg });
    }
    if (sender !== game.blackJid) {
      return sock.sendMessage(chatId, { text: `❌ Only ${GC.mentionOf(game.blackJid)} can accept this challenge.`, mentions: [game.blackJid] }, { quoted: msg });
    }
    game.phase = 'active';
    GC.setSlot(db, KIND, chatId, game);
    saveDatabase(db);

    const caption = `Chess Game Started!\n⬜ White: ${GC.mentionOf(game.whiteJid)}\n⬛ Black: ${GC.mentionOf(game.blackJid)}\nWhite move`;
    const mentions = [game.whiteJid, game.blackJid];
    const img = await Boards.renderChess(game.pos.b);
    if (Buffer.isBuffer(img) && img.length > 0) {
      return sock.sendMessage(chatId, { image: img, caption, mentions }, { quoted: msg });
    }
    return sock.sendMessage(chatId, { text: `${caption}\n${Boards.textChess(game.pos.b)}`, mentions }, { quoted: msg });
  },
};
