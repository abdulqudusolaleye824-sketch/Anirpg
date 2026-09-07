const { buildHistoryText } = require('../../rpg/utils/TransactionLog');

module.exports = {
  name: 'history',
  description: '📜 View your last 10 gold/crystal transactions',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register to start.' }, { quoted: msg });
    }

    const historyText = buildHistoryText(player);

    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 *TRANSACTION HISTORY*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *${player.name}*

${historyText}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Shows last 10 send/trade/casino transactions`
    }, { quoted: msg });
  }
};
