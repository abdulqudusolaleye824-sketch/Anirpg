// Push #103k: /reawakening — how many world-wide reawakenings are left this year and who got one.
'use strict';
module.exports = {
  name: 'reawakening', aliases: ['reawaken', 'rawaken'],
  description: '🌠 Reawakening — the rare second awakening',
  category: 'rpg', usage: '/reawakening',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    const RW = require('../../rpg/utils/Reawakening');
    // Owner-only: the real numbers (cap, who got one, odds). Players get lore only — no counts, no caps, no odds.
    let isOwner = false; try { isOwner = require('../../utils/permissions').isBotOwner(db, sender); } catch (e) {}
    if (isOwner) {
      return sock.sendMessage(chatId, { text: RW.statusText(db) }, { quoted: msg });
    }
    const lines = [
      `🌠 *REAWAKENING*`,
      ``,
      `Some hunters who fall do not simply get back up.`,
      `In the moment between the last breath and the next, the System has been known to stir — and a hunter rises with a rank they were never born to.`,
      ``,
      `It cannot be bought, farmed or forced. It chooses.`,
      `_Most will never see it. Fight anyway._`,
    ];
    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  },
};
