module.exports = {
  name: 'afk',
  description: '💤 Set AFK status (auto-welcome-back when you return)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!db.afkUsers) db.afkUsers = {};

    const reason = args.join(' ').trim() || 'AFK';
    const mentionText = `@${sender.split('@')[0]}`;

    db.afkUsers[sender] = {
      reason,
      since: Date.now()
    };

    saveDatabase();

    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━\n💤 *YOU ARE NOW AFK*\n━━━━━━━━━━━━━━━━━━━━━━\n\n👤 ${mentionText}\n📝 Reason: ${reason}\n\n_Type anything in a group to come back — I'll greet you._\n━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [sender]
    }, { quoted: msg });
  }
};
