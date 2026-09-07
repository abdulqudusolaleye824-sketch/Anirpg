const TaxSystem = require('../../rpg/utils/TaxSystem');

const BOT_OWNER_ID = '221951679328499@lid'; // Match TaxSystem.js

module.exports = {
  name: 'taxcheck',
  description: 'Check tax collection (owner only)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // ✅ Check if sender is bot owner
    if (sender !== BOT_OWNER_ID) {
      return sock.sendMessage(chatId, {
        text: '❌ Owner-only command!'
      }, { quoted: msg });
    }

    const balance = TaxSystem.getBotOwnerBalance(db);

    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 TAX COLLECTION REPORT 💰
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 Total Collected: ${balance} 💠
📊 Tax Rate: 5%
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ System is working!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg });
  }
};