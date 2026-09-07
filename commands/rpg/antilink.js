module.exports = {
  name: 'antilink',
  description: '🔗 Enable or disable anti-link',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!db.antiLink) {
      db.antiLink = {
        enabled: false,
        allowed: []
      };
    }

    const Perms = require('../../utils/permissions');
    const isAdmin = Perms.isBotMod(db, sender);

    if (!isAdmin) {
      return sock.sendMessage(chatId, {
        text: '❌ Admins only.'
      }, { quoted: msg });
    }

    if (!args[0]) {
      return sock.sendMessage(chatId, {
        text: `📌 Usage:\n/antilink on\n/antilink off`
      }, { quoted: msg });
    }

    if (args[0] === 'on') {
      db.antiLink.enabled = true;
      saveDatabase();
      return sock.sendMessage(chatId, { text: '✅ Anti-link enabled.' }, { quoted: msg });
    }

    if (args[0] === 'off') {
      db.antiLink.enabled = false;
      saveDatabase();
      return sock.sendMessage(chatId, { text: '❌ Anti-link disabled.' }, { quoted: msg });
    }
  }
};
