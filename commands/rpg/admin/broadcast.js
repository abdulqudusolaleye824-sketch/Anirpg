const Perms = require('../../../utils/permissions');

module.exports = {
  name: 'broadcast',
  description: '📣 Send message to all bot users',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the bot owner can broadcast messages!'
      }, { quoted: msg });
    }
    
    const message = args.join(' ');
    
    if (!message) {
      return sock.sendMessage(chatId, {
        text: `❌ Please provide a message!

📌 Usage:
/broadcast [message]

Example:
/broadcast New features added! Check /help`
      }, { quoted: msg });
    }
    
    const allUsers = Object.keys(db.users || {});
    
    if (allUsers.length === 0) {
      return sock.sendMessage(chatId, {
        text: '❌ No registered users to broadcast to!'
      }, { quoted: msg });
    }
    
    await sock.sendMessage(chatId, {
      text: `📣 Broadcasting to ${allUsers.length} users...\n\nThis may take a moment.`
    }, { quoted: msg });
    
    let successCount = 0;
    let failCount = 0;
    
    const broadcastMessage = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📣 BOT ANNOUNCEMENT 📣
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an official broadcast from the bot admin.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    
    for (const userId of allUsers) {
      try {
        await sock.sendMessage(userId, {
          text: broadcastMessage
        });
        successCount++;
        
        // Small delay to avoid spam
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        failCount++;
      }
    }
    
    await sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ BROADCAST COMPLETE ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Sent: ${successCount}
❌ Failed: ${failCount}
📊 Total: ${allUsers.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg });
  }
};