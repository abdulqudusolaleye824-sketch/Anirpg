module.exports = {
  name: 'close',
  aliases: [],
  category: 'rpg',
  description: 'Closes the group (admin-only chat)',
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
      await sock.groupSettingUpdate(chatId, 'announcement'); // closes group
      await sock.sendMessage(chatId, {
        text: '🔒 Group has been closed. Only admins can send messages now.'
      });
    } catch (err) {
      console.error('❌ Failed to close group:', err);
      await sock.sendMessage(chatId, { text: '❌ Failed to close the group.' }, { quoted: msg });
    }
  }
};