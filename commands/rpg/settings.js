module.exports = {
  name: 'settings',
  description: '⚙️ Player settings',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: '❌ Register first using /register'
      }, { quoted: msg });
    }

    if (!player.settings) {
      player.settings = {
        dms: true,
        broadcasts: true,
        pvp: true
      };
    }

    const key = args[0];
    if (!key) {
      return sock.sendMessage(chatId, {
        text: `⚙️ YOUR SETTINGS
━━━━━━━━━━━━━━━━━━━━
📩 DMs: ${player.settings.dms ? 'ON' : 'OFF'}
📢 Broadcasts: ${player.settings.broadcasts ? 'ON' : 'OFF'}
⚔️ PvP: ${player.settings.pvp ? 'ON' : 'OFF'}

📌 Toggle:
 /settings dms
 /settings broadcasts
 /settings pvp`
      });
    }

    if (player.settings[key] === undefined) {
      return sock.sendMessage(chatId, { text: '❌ Invalid setting.' });
    }

    player.settings[key] = !player.settings[key];
    saveDatabase();

    await sock.sendMessage(chatId, {
      text: `✅ ${key.toUpperCase()} is now ${player.settings[key] ? 'ON' : 'OFF'}`
    });
  }
};
