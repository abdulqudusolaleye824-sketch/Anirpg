// ═══════════════════════════════════════════════════════════════
// /achievements command
// Aliases: /achievement
// ═══════════════════════════════════════════════════════════════

const AchievementManager = require('../../rpg/utils/AchievementManager');

module.exports = {
  name: 'achievements',
  aliases: ['achievement'],
  description: '🏆 View your achievement progress',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: '❌ You need to /start first!'
      }, { quoted: msg });
    }

    const category = args[0] ? args[0].trim() : null;
    const display = AchievementManager.getDisplay(sender, category);

    return sock.sendMessage(chatId, { text: display }, { quoted: msg });
  }
};