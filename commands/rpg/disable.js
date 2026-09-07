module.exports = {
  name: 'disable',
  description: '🚫 Disable a command temporarily (Admins only)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // ✅ Permission check
    const Mod = require('../../rpg/utils/ModerationUtils');
    if (!Mod.canModerate(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ You do not have permission to disable commands!' }, { quoted: msg });
    }

    if (!args[0]) {
      return sock.sendMessage(chatId, { text: '❌ Specify a command to disable!\nExample: /disable guild' }, { quoted: msg });
    }

    const commandName = args[0].toLowerCase();
    if (!db.disabledCommands) db.disabledCommands = [];

    if (db.disabledCommands.find(c => c.name === commandName)) {
      return sock.sendMessage(chatId, { text: `⚠️ Command *${commandName}* is already disabled.` }, { quoted: msg });
    }

    db.disabledCommands.push({ name: commandName, by: sender });
    saveDatabase();

    await sock.sendMessage(chatId, { 
      text: `✅ Command *${commandName}* disabled.\n(by @${sender.split('@')[0]})`,
      mentions: [sender]
    }, { quoted: msg });
  }
};
