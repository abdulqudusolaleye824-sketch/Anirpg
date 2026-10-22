// Push #103k: /reawakening — how many world-wide reawakenings are left this year and who got one.
'use strict';
module.exports = {
  name: 'reawakening', aliases: ['reawaken', 'rawaken'],
  description: '🌠 Reawakening — the rare second awakening (3 per year, world-wide)',
  category: 'rpg', usage: '/reawakening',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    const RW = require('../../rpg/utils/Reawakening');
    const me = db.users?.[sender];
    const lines = [RW.statusText(db)];
    if (me) { const e = RW.eligible(db, sender, me); lines.push('', e.ok ? `👤 You (${RW.rankOf(me)}-Rank) can still be chosen this year.` : e.why === 'rank' ? `👤 ${RW.rankOf(me)}-Rank hunters do not reawaken.` : e.why === 'player-cap' ? `👤 You already reawakened this year.` : e.why === 'global-cap' ? `👤 No slots left this year.` : ``); }
    return sock.sendMessage(chatId, { text: lines.filter(l => l !== '').join('\n') }, { quoted: msg });
  },
};
