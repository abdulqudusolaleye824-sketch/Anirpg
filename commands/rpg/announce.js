// announce.js — /announce command (admin settings for announcements)
const Announcer = require('../../rpg/utils/Announcer');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'announce',
  description: 'Manage bot announcement settings for this group',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId  = msg.key?.remoteJid;
    const db      = getDatabase();
    const isAdmin = Perms.isBotMod(db, sender);

    if (!isAdmin) return sock.sendMessage(chatId, { text: '❌ Only admins can change announcement settings!' }, { quoted: msg });

    const type = args[0]?.toLowerCase();
    const VALID = ['artifact', 'worldboss', 'events', 'gates'];

    if (!type || !VALID.includes(type)) {
      return sock.sendMessage(chatId, { text: Announcer.getSettingsText(chatId) }, { quoted: msg });
    }

    const current = Announcer.toggleSetting(chatId, type, undefined);
    const newVal  = !current[type];
    Announcer.toggleSetting(chatId, type, newVal);

    return sock.sendMessage(chatId, {
      text: `${newVal ? '✅' : '❌'} *${type}* announcements ${newVal ? 'enabled' : 'disabled'}.`
    }, { quoted: msg });
  }
};
