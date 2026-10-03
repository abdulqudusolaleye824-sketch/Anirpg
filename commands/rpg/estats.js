// /estats — Push #96h
const EventSystem = require('../../rpg/utils/EventSystem');
module.exports = {
  name: 'estats', aliases: ['eventstats', 'eprofile', 'eventprofile'], description: '📊 Jeju Raid: your event stats',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase(); let player = db.users[sender];
    try { const T = require('../../utils/target'); const tj = T.resolve(msg, args); if (tj) { const b = String(tj).split('@')[0].split(':')[0]; const k = Object.keys(db.users).find(x => x.split('@')[0].split(':')[0] === b); if (k) player = db.users[k]; } } catch (e) {}
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });
    EventSystem.tick(db); return sock.sendMessage(chatId, { text: EventSystem.statsText(db, player), mentions: [sender] }, { quoted: msg });
  },
};
