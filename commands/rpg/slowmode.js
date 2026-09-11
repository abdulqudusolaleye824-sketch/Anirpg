const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'slowmode',
  description: '⏳ Enable or disable command slowmode in a group',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const proS = UI.isPro(db.users[sender]);

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
        text: [
          (proS ? UI.PRO_BAR : UI.FREE_BAR),
          '⏳ *SLOWMODE*',
          '📌 Usage: /slowmode [seconds]',
          'Example: /slowmode 10',
          'Use 0 to disable.',
          (proS ? UI.PRO_BAR : UI.FREE_BAR),
        ].join('\n')
      }, { quoted: msg });
    }

    if (!db.groupSettings) db.groupSettings = {};
    if (!db.groupSettings[chatId]) db.groupSettings[chatId] = {};

    db.groupSettings[chatId].slowmode = seconds;
    saveDatabase();

    await sock.sendMessage(chatId, {
      text: [
        (proS ? UI.PRO_BAR : UI.FREE_BAR),
        seconds === 0 ? '✅ *SLOWMODE OFF*' : '⏳ *SLOWMODE ON*',
        seconds === 0 ? 'Commands flow freely.' : `⏱️ *${seconds}s* between commands.`,
        proS ? (UI.PRO_MINI + '\n⏳ PRO THROTTLE') : null,
        proS ? `⏱️ Current gate: *${seconds}s* between commands` : null,
        (proS ? UI.PRO_BAR : UI.FREE_BAR),
      ].filter(x => x !== null).join('\n')
    }, { quoted: msg });
  }
};
