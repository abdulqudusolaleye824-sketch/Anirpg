module.exports = {
  name: 'enable',
  description: '✅ Enable a previously disabled command (Admins only)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // ✅ Permission check
    const Mod = require('../../rpg/utils/ModerationUtils');
    if (!Mod.canModerate(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ You do not have permission to enable commands!' }, { quoted: msg });
    }

    if (!args[0]) {
      return sock.sendMessage(chatId, { text: '❌ Specify a command to enable!\nExample: /enable guild' }, { quoted: msg });
    }

    const commandName = args[0].toLowerCase();
    if (!db.disabledCommands) db.disabledCommands = [];

    const index = db.disabledCommands.findIndex(c => c.name === commandName);
    if (index === -1) {
      return sock.sendMessage(chatId, { text: `⚠️ Command *${commandName}* is not disabled.` }, { quoted: msg });
    }

    db.disabledCommands.splice(index, 1);
    saveDatabase();

    await sock.sendMessage(chatId, { 
      text: `✅ Command *${commandName}* enabled.`,
      mentions: [sender]
    }, { quoted: msg });
  }
};
