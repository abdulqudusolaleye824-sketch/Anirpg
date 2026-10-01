// /ejoin — Push #96h-c: enter the Jeju Island Raid; awakens your event domain and asks for a name, then a description.
const EventSystem = require('../../rpg/utils/EventSystem');
module.exports = {
  name: 'ejoin', aliases: ['eventjoin', 'joinevent'], description: '🏝️ Jeju Raid: join the event (get your event domain, name + describe it)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase(); const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });
    if (!EventSystem.isEventGC(db, chatId)) return sock.sendMessage(chatId, { text: EventSystem.gcId(db) ? '🏝️ Join from inside the *Events GC*.' : '🏝️ No Events GC is set yet — an owner must run */setgc events --main* there.' }, { quoted: msg });
    const r = EventSystem.join(db, player); if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
    saveDatabase(db);
    for (let i = 0; i < r.messages.length; i++) await sock.sendMessage(chatId, { text: r.messages[i] }, i === 0 ? { quoted: msg } : undefined);
  },
};
