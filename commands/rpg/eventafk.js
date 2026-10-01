// /eventafk — Push #96h: step off the island (untouchable, cannot attack)
const EventSystem = require('../../rpg/utils/EventSystem');
module.exports = {
  name: 'eventafk', aliases: ['eafk'], description: '🛌 Jeju Raid: toggle AFK (cannot be targeted, cannot attack)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase(); const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });
    const r = EventSystem.toggleAfk(db, player); if (r.ok) saveDatabase(db);
    return sock.sendMessage(chatId, { text: r.ok ? r.text : `❌ ${r.error}` }, { quoted: msg });
  },
};
