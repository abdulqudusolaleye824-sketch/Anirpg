module.exports = {
  name: 'logs',
  description: '📜 View recent system logs',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const BOT_OWNER = '221951679328499@lid';

    if (sender !== BOT_OWNER) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the bot owner can view logs.'
      }, { quoted: msg });
    }

    const db = getDatabase();
    if (!db.systemLogs || db.systemLogs.length === 0) {
      return sock.sendMessage(chatId, {
        text: '📜 No logs recorded yet.'
      }, { quoted: msg });
    }

    const logs = db.systemLogs.slice(-10).reverse().map((log, i) =>
      `${i + 1}. [${new Date(log.time).toLocaleString()}]\n${log.message}`
    ).join('\n\n');

    await sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 SYSTEM LOGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${logs}

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg });
  }
};
