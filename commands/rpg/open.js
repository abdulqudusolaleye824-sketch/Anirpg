module.exports = {
  name: 'open',
  aliases: [],
  category: 'rpg',
  description: 'Opens the group (everyone can chat)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const owner = '221951679328499@lid'; // your ID here

    if (!isGroup) {
      return sock.sendMessage(chatId, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }

    if (sender !== owner) {
      return sock.sendMessage(chatId, { text: '❌ Only the bot owner can use this command.' }, { quoted: msg });
    }

    try {
      await sock.groupSettingUpdate(chatId, 'not_announcement'); // opens group
      await sock.sendMessage(chatId, {
        text: '🔓 Group has been opened. Everyone can send messages now.'
      });
    } catch (err) {
      console.error('❌ Failed to open group:', err);
      await sock.sendMessage(chatId, { text: '❌ Failed to open the group.' }, { quoted: msg });
    }
  }
};