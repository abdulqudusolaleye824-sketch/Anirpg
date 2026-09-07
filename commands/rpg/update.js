module.exports = {
  name: 'update',
  description: '📢 Announce new bot updates',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const BOT_OWNER = '221951679328499@lid';
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (sender !== BOT_OWNER) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the bot owner can use this.'
      }, { quoted: msg });
    }

    const text = args.join(' ');
    if (!text) {
      return sock.sendMessage(chatId, {
        text: '📌 Usage:\n/update [what changed]'
      }, { quoted: msg });
    }

    const users = Object.keys(db.users || {});
    let sent = 0;

    for (const id of users) {
      try {
        await sock.sendMessage(id, {
          text: `━━━━━━━━━━━━━━━━━━━━
📢 UPDATE NOTICE 📢
━━━━━━━━━━━━━━━━━━━━

${text}

━━━━━━━━━━━━━━━━━━━━
Thanks for using the bot!
━━━━━━━━━━━━━━━━━━━━`
        });
        sent++;
        await new Promise(r => setTimeout(r, 1000));
      } catch {}
    }

    await sock.sendMessage(chatId, {
      text: `✅ Update sent to ${sent} users.`
    }, { quoted: msg });
  }
};
