// move.js — Play a chess move in the games GC (✦ 𝐀𝐬𝐭𝐫𝐚™)
//
//   /move <from> <to>          e.g. /move e2 e4
//   /move <from><to>           e.g. /move e2e4
//   /move castle <side>        side = kingside|queenside|short|long|k|q
//   (Castling also works king-style: /move e1 g1)

const GC = require('../../rpg/games/GameCenter');
const Boards = require('../../rpg/games/GameBoards');
const Engine = require('../../rpg/games/ChessEngine');
const UI = require('../../rpg/utils/UI');
const Buttons = (() => { try { return require('../../utils/buttons'); } catch (e) { return null; } })();

const KIND = 'chess';

function sideName(color) {
  return color === 'w' ? 'White' : 'Black';
}

async function finishChess(sock, chatId, msg, db, saveDatabase, game, result, forfeitBy) {
  // result: 'w' | 'b' | 'draw'
  const wPlayer = db.users?.[game.whiteJid];
  const bPlayer = db.users?.[game.blackJid];
  let caption;
  const mentions = [game.whiteJid, game.blackJid];

  if (result === 'draw') {
    if (wPlayer) { GC.awardGame(db, wPlayer, game.whiteJid, KIND, 'draw'); GC.bumpStats(wPlayer, KIND, 'draw', 0); }
    if (bPlayer) { GC.awardGame(db, bPlayer, game.blackJid, KIND, 'draw'); GC.bumpStats(bPlayer, KIND, 'draw', 0); }
    caption = `🤝 *DRAW!* (${game.drawReason || 'stalemate'})\nBoth players got *${GC.DRAW_XP.toLocaleString()} xp*.`;
  } else {
    const winJid = result === 'w' ? game.whiteJid : game.blackJid;
    const loseJid = result === 'w' ? game.blackJid : game.whiteJid;
    const winPlayer = db.users?.[winJid];
    const losePlayer = db.users?.[loseJid];
    let res = { xp: 0, nx: 0, capped: false };
    if (winPlayer) {
      res = GC.awardGame(db, winPlayer, winJid, KIND, 'win');
      GC.bumpStats(winPlayer, KIND, 'win', res.nx);
    }
    if (losePlayer) GC.bumpStats(losePlayer, KIND, 'loss', 0);
    const how = forfeitBy ? `${GC.mentionOf(forfeitBy)} forfeited` : 'checkmate';
    caption = `${GC.mentionOf(winJid)} Won 🏆 (${how})${GC.rewardLine(res, winPlayer && UI.isPro(winPlayer))}`;
  }
  GC.clearSlot(db, KIND, chatId);
  saveDatabase(db);

  const img = await Boards.renderChess(game.pos.b, { lastMove: game.lastMove });
  if (Buffer.isBuffer(img) && img.length > 0) {
    return sock.sendMessage(chatId, { image: img, caption, mentions }, { quoted: msg });
  }
  return sock.sendMessage(chatId, { text: `${caption}\n${Boards.textChess(game.pos.b)}`, mentions }, { quoted: msg });
}

module.exports = {
  name: 'move',
  description: '♞ Play a chess move (games GC)',
  usage: '/move <from> <to> | /move castle <side>',
  category: 'games',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const game = GC.slot(db, KIND, chatId);

    // Parse first so usage errors read well even with no game running.
    let fromSq = -1, toSq = -1;
    const a0 = (args[0] || '').toLowerCase();
    const a1 = (args[1] || '').toLowerCase();
    if (a0 === 'castle') {
      const side = (args[1] || '').toLowerCase();
      const game2 = game && game.phase === 'active' ? game : null;
      const turn = game2 ? game2.pos.t : 'w';
      const kingly = ['kingside', 'short', 'k', 'o-o'].includes(side);
      const queenly = ['queenside', 'long', 'q', 'o-o-o'].includes(side);
      if (!kingly && !queenly) {
        return sock.sendMessage(chatId, { text: `Invalid Usage Format. Try */move castle kingside* or */move castle queenside*.` }, { quoted: msg });
      }
      if (turn === 'w') { fromSq = Engine.parseSquare('e1'); toSq = Engine.parseSquare(kingly ? 'g1' : 'c1'); }
      else { fromSq = Engine.parseSquare('e8'); toSq = Engine.parseSquare(kingly ? 'g8' : 'c8'); }
    } else if (a0.length >= 4 && a1 === '' && /^[a-h][1-8][a-h][1-8]/i.test(a0)) {
      fromSq = Engine.parseSquare(a0.slice(0, 2));
      toSq = Engine.parseSquare(a0.slice(2, 4));
    } else {
      fromSq = Engine.parseSquare(a0);
      toSq = Engine.parseSquare(a1);
    }
    if (fromSq < 0 || toSq < 0) {
      return sock.sendMessage(chatId, { text: `Invalid Usage Format. Use */move <from> <to>* — e.g. */move e2 e4*.` }, { quoted: msg });
    }

    const g = GC.gate(db, chatId);
    if (!g.ok) return sock.sendMessage(chatId, { text: await GC.gateBlock(db, chatId, sock, g) }, { quoted: msg });

    if (!game || game.phase !== 'active') {
      return sock.sendMessage(chatId, { text: `❌ No active chess game here. Start one with */ch @user*.` }, { quoted: msg });
    }
    const myColor = sender === game.whiteJid ? 'w' : sender === game.blackJid ? 'b' : null;
    if (!myColor) {
      return sock.sendMessage(chatId, { text: `❌ You're not a player in this match.` }, { quoted: msg });
    }
    if (game.pos.t !== myColor) {
      const waitFor = game.pos.t === 'w' ? game.whiteJid : game.blackJid;
      return sock.sendMessage(chatId, { text: `⏳ Not your turn! ${sideName(game.pos.t)} (${GC.mentionOf(waitFor)}) to move.`, mentions: [waitFor] }, { quoted: msg });
    }

    const mv = Engine.findMove(game.pos, fromSq, toSq);
    if (!mv) {
      return sock.sendMessage(chatId, { text: `❌ Illegal move. It's ${sideName(game.pos.t)} to move — check the board and try again.` }, { quoted: msg });
    }
    const outcome = Engine.applyMove(game.pos, mv);
    game.lastMove = { from: mv.from, to: mv.to };

    // ── Game over? ─────────────────────────────────────────────
    if (outcome.mate) {
      const winnerColor = myColor; // side that just moved delivered mate
      return finishChess(sock, chatId, msg, db, saveDatabase, game, winnerColor, null);
    }
    if (outcome.draw) {
      game.drawReason = outcome.stalemate ? 'stalemate' : 'insufficient material';
      return finishChess(sock, chatId, msg, db, saveDatabase, game, 'draw', null);
    }

    // ── Continue ───────────────────────────────────────────────
    GC.setSlot(db, KIND, chatId, game);
    saveDatabase(db);
    const next = sideName(game.pos.t);
    const nextJid = game.pos.t === 'w' ? game.whiteJid : game.blackJid;
    let caption = `${outcome.check ? '⚠️ Check! ' : ''}${next} move`;
    if (outcome.promo) caption += `\n♟ Pawn promoted to Queen!`;
    const mentions = [game.whiteJid, game.blackJid, nextJid];
    const img = await Boards.renderChess(game.pos.b, { lastMove: game.lastMove });
    const ffBtns = Buttons ? Buttons.quickReplies([['🏳️ Forfeit', '/forfeit']]) : null;
    return GC.sendBoard(sock, chatId, msg, img, caption, Boards.textChess(game.pos.b), { mentions, buttons: ffBtns });
  },

  // Shared by forfeit-chess.js so mate/forfeit/draw endings stay identical.
  _finishChess: finishChess,
};
