// ═══════════════════════════════════════════════════════════════
// /duel — RETIRED. The instant auto-duel system has been scrapped;
// all duels now run through the turn-by-turn /pvp system.
// This stub keeps the old command + alias resolving to a redirect.
// ═══════════════════════════════════════════════════════════════

'use strict';

const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'duel',
  aliases: ['fight'],
  description: '⚔️ Retired — duels moved to /pvp',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const text = UI.card(player, {
      icon: '⚔️', title: 'DUELS HAVE MOVED',
      lines: [
        `The instant /duel system has been retired.`,
        ``,
        `📌 *Duel now via turn-by-turn PvP:*`,
        `/pvp challenge @user — issue a challenge`,
        `/pvp accept — accept & fight`,
      ],
      tip: '/pvp rank to see your ELO',
    });
    return sock.sendMessage(chatId, { text }, { quoted: msg });
  }
};
