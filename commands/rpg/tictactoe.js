// tictactoe.js — Tic-Tac-Toe for the games GC (✦ 𝐀𝐬𝐭𝐫𝐚™)
// Aliases: /ttt
//
//   /ttt @user          → challenge a player
//   /ttt accept         → accept a pending challenge (challenged player)
//   /ttt decline        → decline a pending challenge
//   /ttt mark <cell>    → play (cells a1..c3, letter=row)
//   /ttt forfeit        → resign the active game
//   /ttt stats          → your all-time record
//   /ttt                → this help
//
// One game per group at a time; challenges expire after 5 minutes.
// Winner: 1,500 xp + 200 💠 Nexus (Pro 2×, 5,000 Nexus/day cap).

const GC = require('../../rpg/games/GameCenter');
const Boards = require('../../rpg/games/GameBoards');
const UI = require('../../rpg/utils/UI');
const Buttons = (() => { try { return require('../../utils/buttons'); } catch (e) { return null; } })();

const KIND = 'ttt';
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],           // diagonals
];

function parseCell(s) {
  const m = /^([abc])([123])$/i.exec((s || '').trim());
  if (!m) return -1;
  return (m[1].toLowerCase().charCodeAt(0) - 97) * 3 + (parseInt(m[2], 10) - 1);
}

function winnerOf(b) {
  for (const [a, c, d] of LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}

function helpText(pro) {
  return [
    (pro ? UI.PRO_BAR : UI.FREE_BAR),
    '❌ *TIC-TAC-TOE* ⭕',
    pro ? (UI.PRO_MINI + '\n' + '🎮 PRO ARCADE') : null,
    ``,
    `*Commands:*`,
    `/ttt @user       — Challenge a player`,
    `/ttt accept      — Accept the challenge`,
    `/ttt decline     — Decline the challenge`,
    `/ttt mark <cell> — Play (a1..c3, letter = row)`,
    `/ttt forfeit     — Resign the game`,
    `/ttt stats       — Your all-time record`,
    `/forfeit         — Resign any active game (or tap 🏳️)`,
    ``,
    `*Rewards (winner):*`,
    `⚡ ${GC.WIN_LEVEL_XP.toLocaleString()} XP  ✨ ${GC.PASS_XP_MIN}–${GC.PASS_XP_MAX} Pass XP  💠 ${GC.TTT_WIN_NX.toLocaleString()} Nexus`,
    `⚠️ Daily limit: ${GC.DAILY_NX_CAP.toLocaleString()} Nexus/day`,
    pro ? `💎 Pro earns *2×* rewards` : null,
    (pro ? UI.PRO_BAR : UI.FREE_BAR),
  ].filter((x) => x !== null).join('\n');
}

function markOf(game, jid) {
  if (jid === game.xJid) return 'X';
  if (jid === game.oJid) return 'O';
  return null;
}

async function finishGame(sock, chatId, msg, db, saveDatabase, game, result) {
  // result: 'X' | 'O' | 'draw'
  const xPlayer = db.users?.[game.xJid];
  const oPlayer = db.users?.[game.oJid];
  const xName = xPlayer?.name || GC.mentionOf(game.xJid);
  const oName = oPlayer?.name || GC.mentionOf(game.oJid);

  let caption;
  if (result === 'draw') {
    const ex = { save: saveDatabase, sock, chatId };
    const dx = xPlayer ? GC.awardGame(db, xPlayer, game.xJid, KIND, 'draw', ex) : null;
    const dO = oPlayer ? GC.awardGame(db, oPlayer, game.oJid, KIND, 'draw', ex) : null;
    if (xPlayer) GC.bumpStats(xPlayer, KIND, 'draw', 0);
    if (oPlayer) GC.bumpStats(oPlayer, KIND, 'draw', 0);
    const dl = [`🤝 *DRAW!* No winner this time.`];
    if (dx) dl.push(`${xName}: *${dx.xp} XP* + ✨ *${dx.pass} Pass XP*${UI.isPro(xPlayer) ? ' (2× Pro 💎)' : ''}`);
    if (dO) dl.push(`${oName}: *${dO.xp} XP* + ✨ *${dO.pass} Pass XP*${UI.isPro(oPlayer) ? ' (2× Pro 💎)' : ''}`);
    caption = dl.join('\n');
  } else {
    const winJid = result === 'X' ? game.xJid : game.oJid;
    const loseJid = result === 'X' ? game.oJid : game.xJid;
    const winPlayer = db.users?.[winJid];
    const losePlayer = db.users?.[loseJid];
    const winName = result === 'X' ? xName : oName;
    let res = { xp: 0, nx: 0, capped: false, pass: 0 };
    if (winPlayer) {
      res = GC.awardGame(db, winPlayer, winJid, KIND, 'win', { save: saveDatabase, sock, chatId });
      GC.bumpStats(winPlayer, KIND, 'win', res.nx);
    }
    if (losePlayer) GC.bumpStats(losePlayer, KIND, 'loss', 0);
    caption = `${GC.mentionOf(winJid)} has won the match${GC.rewardLine(res, winPlayer && UI.isPro(winPlayer))}`;
  }
  GC.clearSlot(db, KIND, chatId);
  saveDatabase(db);

  const img = await Boards.renderTTT(game.board);
  const mentions = [game.xJid, game.oJid];
  if (Buffer.isBuffer(img) && img.length > 0) {
    return sock.sendMessage(chatId, { image: img, caption, mentions }, { quoted: msg });
  }
  return sock.sendMessage(chatId, { text: `${caption}\n${Boards.textTTT(game.board)}`, mentions }, { quoted: msg });
}

module.exports = {
  name: 'tictactoe',
  aliases: ['ttt'],
  description: '❌ Tic-Tac-Toe mini-game (games GC)',
  usage: '/ttt @user | /ttt accept | /ttt mark <cell>',
  category: 'games',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];

    const g = GC.gate(db, chatId);
    if (!g.ok) return sock.sendMessage(chatId, { text: await GC.gateBlock(db, chatId, sock, g) }, { quoted: msg });

    const sub = (args[0] || '').toLowerCase();
    const game = GC.slot(db, KIND, chatId);

    // ── /ttt (help) ────────────────────────────────────────────
    if (!sub || sub === 'help' || sub === 'info') {
      const target = GC.getTargetJid(msg);
      if (!sub && target) {
        // fall through to challenge
      } else if (!sub || sub === 'help' || sub === 'info') {
        return sock.sendMessage(chatId, { text: helpText(UI.isPro(player)) }, { quoted: msg });
      }
    }

    // ── /ttt stats ─────────────────────────────────────────────
    if (sub === 'stats' || sub === 'score') {
      if (!player) return sock.sendMessage(chatId, { text: `❌ You're not registered.` }, { quoted: msg });
      const s = player.tttStats || { wins: 0, losses: 0, draws: 0, msEarned: 0, nxEarned: 0 };
      return sock.sendMessage(chatId, {
        text: [
          (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
          '❌ *YOUR TIC-TAC-TOE STATS* ⭕',
          ``,
          `🏆 Wins: *${s.wins}*   ❌ Losses: *${s.losses}*   🤝 Draws: *${s.draws}*`,
          `💠 Nexus earned: *${(s.nxEarned || 0).toLocaleString()}*`,
          (s.msEarned > 0) ? `💎 Legacy Moonstones: *${s.msEarned.toLocaleString()}*` : null,
          (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
        ].filter((x) => x !== null).join('\n'),
      }, { quoted: msg });
    }

    // ── /ttt accept ────────────────────────────────────────────
    if (sub === 'accept') {
      if (!game || game.phase !== 'challenge') {
        return sock.sendMessage(chatId, { text: `❌ No pending Tic-Tac-Toe challenge here. Start one with */ttt @user*.` }, { quoted: msg });
      }
      if (sender !== game.oJid) {
        return sock.sendMessage(chatId, { text: `❌ Only ${GC.mentionOf(game.oJid)} can accept this challenge.`, mentions: [game.oJid] }, { quoted: msg });
      }
      game.phase = 'active';
      game.turn = 'X'; // challenger (X) moves first
      GC.setSlot(db, KIND, chatId, game);
      saveDatabase(db);
      const caption = `Game Started!\n❌ - ${GC.mentionOf(game.xJid)}\n⭕ - ${GC.mentionOf(game.oJid)}\n\n❌ ${GC.mentionOf(game.xJid)} to move — */ttt mark <cell>*`;
      const img = await Boards.renderTTT(game.board);
      const mentions = [game.xJid, game.oJid];
      const ffBtns = Buttons ? Buttons.quickReplies([['🏳️ Forfeit', '/forfeit']]) : null;
      return GC.sendBoard(sock, chatId, msg, img, caption, Boards.textTTT(game.board), { mentions, buttons: ffBtns });
    }

    // ── /ttt decline ───────────────────────────────────────────
    if (sub === 'decline' || sub === 'reject') {
      if (!game || game.phase !== 'challenge') {
        return sock.sendMessage(chatId, { text: `❌ No pending Tic-Tac-Toe challenge here.` }, { quoted: msg });
      }
      if (sender !== game.oJid && sender !== game.xJid) {
        return sock.sendMessage(chatId, { text: `❌ Only the challenged player can decline this match.` }, { quoted: msg });
      }
      GC.clearSlot(db, KIND, chatId);
      saveDatabase(db);
      return sock.sendMessage(chatId, {
        text: `${GC.mentionOf(sender)} declined the Tic-Tac-Toe challenge.`,
        mentions: [sender],
      }, { quoted: msg });
    }

    // ── /ttt forfeit ───────────────────────────────────────────
    if (sub === 'forfeit' || sub === 'resign' || sub === 'ff') {
      if (!game || game.phase !== 'active') {
        return sock.sendMessage(chatId, { text: `❌ No active Tic-Tac-Toe game to forfeit.` }, { quoted: msg });
      }
      const myMark = markOf(game, sender);
      if (!myMark) {
        return sock.sendMessage(chatId, { text: `❌ Only the players can forfeit this match.` }, { quoted: msg });
      }
      const winnerMark = myMark === 'X' ? 'O' : 'X';
      return finishGame(sock, chatId, msg, db, saveDatabase, game, winnerMark);
    }

    // ── /ttt mark <cell> ───────────────────────────────────────
    if (sub === 'mark' || sub === 'play' || sub === 'move') {
      const cellArg = args[1] || '';
      const idx = parseCell(cellArg);
      if (idx < 0) {
        return sock.sendMessage(chatId, { text: `Invalid Usage Format. Use */tictactoe* for more info.` }, { quoted: msg });
      }
      if (!game || game.phase !== 'active') {
        return sock.sendMessage(chatId, { text: `❌ No active Tic-Tac-Toe game here. Start one with */ttt @user*.` }, { quoted: msg });
      }
      const myMark = markOf(game, sender);
      if (!myMark) {
        return sock.sendMessage(chatId, { text: `❌ You're not a player in this match.` }, { quoted: msg });
      }
      if (game.turn !== myMark) {
        const waitFor = game.turn === 'X' ? game.xJid : game.oJid;
        return sock.sendMessage(chatId, { text: `⏳ Not your turn! ${GC.mentionOf(waitFor)} to play.`, mentions: [waitFor] }, { quoted: msg });
      }
      if (game.board[idx]) {
        return sock.sendMessage(chatId, { text: `❌ Cell *${cellArg.toLowerCase()}* is already taken.` }, { quoted: msg });
      }
      game.board[idx] = myMark;
      const w = winnerOf(game.board);
      if (w) return finishGame(sock, chatId, msg, db, saveDatabase, game, w);
      if (game.board.every(Boolean)) return finishGame(sock, chatId, msg, db, saveDatabase, game, 'draw');
      game.turn = myMark === 'X' ? 'O' : 'X';
      game.lastMove = idx;
      GC.setSlot(db, KIND, chatId, game);
      saveDatabase(db);
      const nextJid = game.turn === 'X' ? game.xJid : game.oJid;
      const caption = `${myMark === 'X' ? '❌' : '⭕'} ${GC.mentionOf(sender)} marked *${cellArg.toLowerCase()}*\n${game.turn === 'X' ? '❌' : '⭕'} ${GC.mentionOf(nextJid)} to move.`;
      const img = await Boards.renderTTT(game.board);
      const mentions = [game.xJid, game.oJid];
      const ffBtns = Buttons ? Buttons.quickReplies([['🏳️ Forfeit', '/forfeit']]) : null;
      return GC.sendBoard(sock, chatId, msg, img, caption, Boards.textTTT(game.board), { mentions, buttons: ffBtns });
    }

    // ── /ttt @user (challenge) ─────────────────────────────────
    const target = GC.getTargetJid(msg);
    if (target) {
      if (!player) return sock.sendMessage(chatId, { text: `❌ You're not registered.` }, { quoted: msg });
      if (target === sender) {
        return sock.sendMessage(chatId, { text: `❌ You can't challenge yourself!` }, { quoted: msg });
      }
      if (!db.users?.[target]) {
        return sock.sendMessage(chatId, { text: `❌ ${GC.mentionOf(target)} is not registered.`, mentions: [target] }, { quoted: msg });
      }
      if (game) {
        return sock.sendMessage(chatId, { text: `❌ A Tic-Tac-Toe game is already in progress here. Finish it first!` }, { quoted: msg });
      }
      // Batch-47: one game at a time here + none while in battle.
      try {
        const _ag = GC.activeGameIn(db, chatId);
        if (_ag) return sock.sendMessage(chatId, { text: GC.gameBusyBlock(_ag) }, { quoted: msg });
        const _bt = GC.inBattle(db, sender);
        if (_bt) return sock.sendMessage(chatId, { text: GC.battleBlock(_bt) }, { quoted: msg });
      } catch (e) {}

      GC.setSlot(db, KIND, chatId, {
        phase: 'challenge',
        xJid: sender,          // challenger plays X and moves first
        oJid: target,
        board: new Array(9).fill(null),
        turn: 'X',
        createdAt: Date.now(),
        expiresAt: Date.now() + GC.CHALLENGE_TTL,
      });
      saveDatabase(db);
      const cText = `${GC.mentionOf(sender)} has challenged ${GC.mentionOf(target)} for a Tic-Tac-Toe match. Use */tictactoe accept* to start the game`;
      if (Buttons) {
        try {
          return await Buttons.sendButtons(sock, chatId, {
            text: cText,
            mentions: [sender, target],
            buttons: Buttons.quickReplies([['✅ Accept', '/ttt accept'], ['❌ Decline', '/ttt decline']]),
          }, msg);
        } catch (e) { /* fall through to plain text */ }
      }
      return sock.sendMessage(chatId, { text: cText, mentions: [sender, target] }, { quoted: msg });
    }

    // ── Unknown ────────────────────────────────────────────────
    return sock.sendMessage(chatId, { text: `Invalid Usage Format. Use */tictactoe* for more info.` }, { quoted: msg });
  },
};
