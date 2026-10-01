// /einfo — Push #96h: full Jeju Island Raid briefing (progression, participants, rules)
const EventSystem = require('../../rpg/utils/EventSystem');
module.exports = {
  name: 'einfo', aliases: ['eventinfo'], description: '🏝️ Jeju Raid: full event details, progression & participants',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const db = getDatabase(); return sock.sendMessage(msg.key.remoteJid, { text: EventSystem.infoText(db) }, { quoted: msg });
  },
};
