// chess.js — Chess for the games GC (✦ 𝐀𝐬𝐭𝐫𝐚™)
// Aliases: /ch
//
//   /ch @user / /chess @user → challenge a player (challenger is White)
//   /chess stats             → your all-time record
//   /chess / /ch             → this help card
//
// (Moves: /move e2 e4 · accept: /accept-ch · reject: /reject-ch ·
// resign: /forfeit-chess. One game per group; challenges expire in 5 min.
// Winner: 15,000 xp + 5,000 💎. Pro 2×, 50,000 MS/day cap.)

const GC = require('../../rpg/games/GameCenter');
const Boards = require('../../rpg/games/GameBoards');
const Engine = require('../../rpg/games/ChessEngine');
const UI = require('../../rpg/utils/UI');

const KIND = 'chess';

function helpText(pro) {
  return [
    (pro ? UI.PRO_BAR : UI.FREE_BAR),
    '♞ *CHESS COMMANDS* ♞',
    pro ? (UI.PRO_MINI + '\n' + '🎮 PRO ARCADE') : null,
    ``,
    `*/ch @user* — Challenge the mentioned (or quoted) person`,
    `*/accept-ch* — Accept the challenge`,
    `*/reject-ch* — Reject the incoming challenge`,
    `*/move <from> <to>* — Move (e.g. /move e2 e4)`,
    `*/move castle <side>* — Castle (kingside / queenside)`,
    `*/forfeit-chess* — Resign the match`,
    `*/chess stats* — Your all-time record`,
    ``,
    `♟ Pawns promote to Queen automatically · en passant works`,
    `*Winner:* ✨ ${GC.WIN_XP.toLocaleString()} xp  💎 ${GC.CHESS_WIN_MS.toLocaleString()} Moonstones`,
    `⚠️ Daily limit: ${GC.DAILY_MS_CAP.toLocaleString()} MS/day`,
    pro ? `💎 Pro earns *2×* rewards` : null,
    (pro ? UI.PRO_BAR : UI.FREE_BAR),
  ].filter((x) => x !== null).join('\n');
}

module.exports = {
  name: 'chess',
  aliases: ['ch'],
  description: '♞ Chess mini-game (games GC)',
  usage: '/ch @user | /move e2 e4',
  category: 'games',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];

    const g = GC.gate(db, chatId);
    if (!g.ok) return sock.sendMessage(chatId, { text: g.reason }, { quoted: msg });

    const sub = (args[0] || '').toLowerCase();

    // ── /chess stats ───────────────────────────────────────────
    if (sub === 'stats' || sub === 'score') {
      if (!player) return sock.sendMessage(chatId, { text: `❌ You're not registered.` }, { quoted: msg });
      const s = player.chessStats || { wins: 0, losses: 0, draws: 0, msEarned: 0 };
      return sock.sendMessage(chatId, {
        text: [
          (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
          '♞ *YOUR CHESS RECORD* ♞',
          ``,
          `🏆 Wins: *${s.wins}*   ❌ Losses: *${s.losses}*   🤝 Draws: *${s.draws}*`,
          `💎 Moonstones earned: *${(s.msEarned || 0).toLocaleString()}*`,
          (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── /ch @user (challenge) ──────────────────────────────────
    const target = GC.getTargetJid(msg);
    if (target) {
      if (!player) return sock.sendMessage(chatId, { text: `❌ You're not registered.` }, { quoted: msg });
      if (target === sender) {
        return sock.sendMessage(chatId, { text: `❌ You can't challenge yourself!` }, { quoted: msg });
      }
      if (!db.users?.[target]) {
        return sock.sendMessage(chatId, { text: `❌ ${GC.mentionOf(target)} is not registered.`, mentions: [target] }, { quoted: msg });
      }
      if (GC.slot(db, KIND, chatId)) {
        return sock.sendMessage(chatId, { text: `❌ A chess game is already in progress here. Finish it first!` }, { quoted: msg });
      }
      GC.setSlot(db, KIND, chatId, {
        phase: 'challenge',
        whiteJid: sender, // challenger plays White and moves first
        blackJid: target,
        pos: Engine.initialState(),
        lastMove: null,
        createdAt: Date.now(),
        expiresAt: Date.now() + GC.CHALLENGE_TTL,
      });
      saveDatabase(db);
      return sock.sendMessage(chatId, {
        text: `${GC.mentionOf(sender)} has challenged ${GC.mentionOf(target)} to a chess match. Use */accept-ch* to start the challenge`,
        mentions: [sender, target],
      }, { quoted: msg });
    }

    // ── /chess (help card with starting board) ─────────────────
    const caption = helpText(UI.isPro(player));
    const img = await Boards.renderChess(Engine.initialState().b);
    if (Buffer.isBuffer(img) && img.length > 0) {
      return sock.sendMessage(chatId, { image: img, caption }, { quoted: msg });
    }
    return sock.sendMessage(chatId, { text: `${caption}\n${Boards.textChess(Engine.initialState().b)}` }, { quoted: msg });
  },
};
