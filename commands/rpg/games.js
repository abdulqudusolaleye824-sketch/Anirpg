// /games — Games GC lobby: what you can play, rewards, quick-launch buttons.

'use strict';

const GC = require('../../rpg/games/GameCenter');
const UI = require('../../rpg/utils/UI');
const Buttons = (() => { try { return require('../../utils/buttons'); } catch (e) { return null; } })();

module.exports = {
  name: 'games',
  aliases: ['arcade', 'minigames'],
  description: '🎮 Games lobby (games GC)',
  usage: '/games',
  category: 'games',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];

    const g = GC.gate(db, chatId);
    if (!g.ok) return sock.sendMessage(chatId, { text: await GC.gateBlock(db, chatId, sock, g) }, { quoted: msg });

    const pro = UI.isPro(player);
    const bar = pro ? UI.PRO_BAR : UI.FREE_BAR;
    const text = [
      bar,
      '🎮 *GAMES LOBBY* 🎮',
      pro ? (UI.PRO_MINI + '\n' + '🎮 PRO ARCADE') : null,
      ``,
      `📝 *Anime Quiz* — /quiz <1-20>, answer with /a A/B/C/D`,
      `   🏆 15 💠/correct + 50 💠 top-scorer bonus`,
      ``,
      `❌ *Tic-Tac-Toe* — /ttt @user`,
      `   🏆 ${GC.WIN_XP.toLocaleString()} xp + ${GC.TTT_WIN_NX.toLocaleString()} 💠 Nexus`,
      ``,
      `♞ *Chess* — /ch @user`,
      `   🏆 ${GC.WIN_XP.toLocaleString()} xp + ${GC.CHESS_WIN_NX.toLocaleString()} 💠 Nexus`,
      ``,
      `⚠️ Daily limit: ${GC.DAILY_NX_CAP.toLocaleString()} Nexus/day${pro ? ' · 💎 Pro earns 2×' : ''}`,
      `🏳️ /forfeit — resign any active game`,
      bar,
    ].filter((x) => x !== null).join('\n');

    if (Buttons) {
      try {
        return await Buttons.sendButtons(sock, chatId, {
          text,
          buttons: Buttons.quickReplies([
            ['📝 Quiz', '/quiz'],
            ['❌ Tic-Tac-Toe', '/ttt'],
            ['♞ Chess', '/chess'],
          ]),
        }, msg);
      } catch (e) { /* fall through to plain text */ }
    }
    return sock.sendMessage(chatId, { text }, { quoted: msg });
  },
};
