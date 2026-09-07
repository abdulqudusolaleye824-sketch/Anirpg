module.exports = {
  name: 'maintenance',
  description: '🛠️ Toggle maintenance mode',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // ===== BOT OWNER =====
    const BOT_OWNER = '221951679328499@lid';

    // ===== Ensure database structure =====
    if (!db.system) db.system = {};
    if (!db.botMods) db.botMods = []; // bot admins list

    if (db.system.maintenance === undefined)
      db.system.maintenance = false;

    // ===== Permission Check =====
    const Perms = require('../../utils/permissions');
    const isBotAdmin = Perms.isBotMod(db, sender);

    if (!isBotAdmin) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the bot owner or bot admins can use this command.'
      }, { quoted: msg });
    }

    // ===== Command Argument =====
    const action = args[0]?.toLowerCase();

    if (!['on', 'off'].includes(action)) {
      return sock.sendMessage(chatId, {
        text: '📌 Usage:\n/maintenance on\n/maintenance off'
      }, { quoted: msg });
    }

    // ===== Toggle Maintenance =====
    db.system.maintenance = action === 'on';
    saveDatabase();

    await sock.sendMessage(chatId, {
      text: `🛠️ Maintenance mode is now *${db.system.maintenance ? 'ON' : 'OFF'}*`
    }, { quoted: msg });
  }
};