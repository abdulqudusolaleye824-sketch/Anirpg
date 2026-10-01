// /estats — Push #96h
const EventSystem = require('../../rpg/utils/EventSystem');
module.exports = {
  name: 'estats', aliases: ['eventstats'], description: '📊 Jeju Raid: your event stats',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase(); const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });
    EventSystem.tick(db); return sock.sendMessage(chatId, { text: EventSystem.statsText(db, player) }, { quoted: msg });
  },
};
