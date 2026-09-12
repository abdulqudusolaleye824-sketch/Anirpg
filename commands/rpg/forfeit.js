// /forfeit — Resign whichever game you're playing in this group.
// Routes: active TTT → /ttt forfeit · active chess → /forfeit-chess ·
// PvP battle → /pvp forfeit. Also behind every 🏳️ button on game boards.

'use strict';

const GC = require('../../rpg/games/GameCenter');

module.exports = {
  name: 'forfeit',
  aliases: ['ff', 'resign', 'surrender'],
  description: '🏳️ Resign your active game (TTT / chess / PvP)',
  usage: '/forfeit',
  category: 'games',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();

    // ── Tic-Tac-Toe? ──
    try {
      const t = GC.slot(db, 'ttt', chatId);
      if (t && (sender === t.xJid || sender === t.oJid)) {
        if (t.phase === 'active') {
          return require('./tictactoe').execute(sock, msg, ['forfeit'], getDatabase, saveDatabase, sender);
        }
        return sock.sendMessage(chatId, {
          text: `❌ No active game to forfeit — this TTT match is still a challenge. The challenged player can /ttt decline.`,
        }, { quoted: msg });
      }
    } catch (e) {}

    // ── Chess? ──
    try {
      const c = GC.slot(db, 'chess', chatId);
      if (c && (sender === c.whiteJid || sender === c.blackJid)) {
        if (c.phase === 'active') {
          return require('./forfeit-chess').execute(sock, msg, [], getDatabase, saveDatabase, sender);
        }
        return sock.sendMessage(chatId, {
          text: `❌ No active game to forfeit — this chess match is still a challenge. The challenged player can /reject-ch.`,
        }, { quoted: msg });
      }
    } catch (e) {}

    // ── PvP battle? ──
    try {
      if (db.users?.[sender]?.pvpBattle) {
        return require('./pvp').execute(sock, msg, ['forfeit'], getDatabase, saveDatabase, sender);
      }
    } catch (e) {}

    return sock.sendMessage(chatId, {
      text: `❌ You're not playing any game here.\nStart one with /ttt @user, /ch @user, or /pvp challenge @user.`,
    }, { quoted: msg });
  },
};
