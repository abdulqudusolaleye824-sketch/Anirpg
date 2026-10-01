// /eshop — Push #96h: spend Jeju Raid points
const EventSystem = require('../../rpg/utils/EventSystem');
module.exports = {
  name: 'eshop', aliases: ['eventshop'], description: '🛒 Jeju Raid: event shop (/eshop buy <item>)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase(); const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });
    EventSystem.tick(db);
    if ((args[0] || '').toLowerCase() === 'buy') { const r = EventSystem.buy(db, player, args[1]); if (r.ok) saveDatabase(db); return sock.sendMessage(chatId, { text: r.ok ? r.text : `❌ ${r.error}` }, { quoted: msg }); }
    return sock.sendMessage(chatId, { text: EventSystem.shopText(db, player) }, { quoted: msg });
  },
};
