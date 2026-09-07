module.exports = {
  name: 'slowmode',
  description: '⏳ Enable or disable command slowmode in a group',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const BOT_OWNER = '221951679328499@lid';
    const isGroup = chatId.endsWith('@g.us');

    if (!isGroup) {
      return sock.sendMessage(chatId, { text: '❌ Slowmode only works in groups.' }, { quoted: msg });
    }

    const isAdmin = sender === BOT_OWNER || (db.botMods || []).includes(sender);
    if (!isAdmin) {
      return sock.sendMessage(chatId, { text: '❌ Only bot admins can use this command.' }, { quoted: msg });
    }

    const seconds = parseInt(args[0]);

    if (isNaN(seconds) || seconds < 0) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: /slowmode [seconds]\nExample: /slowmode 10\nUse 0 to disable.'
      }, { quoted: msg });
    }

    if (!db.groupSettings) db.groupSettings = {};
    if (!db.groupSettings[chatId]) db.groupSettings[chatId] = {};

    db.groupSettings[chatId].slowmode = seconds;
    saveDatabase();

    await sock.sendMessage(chatId, {
      text: seconds === 0
        ? '✅ Slowmode disabled.'
        : `⏳ Slowmode enabled: ${seconds}s between commands.`
    }, { quoted: msg });
  }
};
