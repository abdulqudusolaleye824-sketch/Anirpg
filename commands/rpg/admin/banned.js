const Perms = require('../../../utils/permissions');

module.exports = {
  name: 'banned',
  description: '🚫 List all banned users',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!db.botMods) db.botMods = [];
    if (!db.bannedUsers) db.bannedUsers = {};
    
    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot admins can view banned users!'
      }, { quoted: msg });
    }
    
    const bannedList = Object.keys(db.bannedUsers);
    
    if (bannedList.length === 0) {
      return sock.sendMessage(chatId, {
        text: '✅ No banned users!'
      }, { quoted: msg });
    }
    
    let text = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 BANNED USERS 🚫
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Banned: ${bannedList.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    bannedList.forEach((userId, i) => {
      const banInfo = db.bannedUsers[userId];
      const userName = db.users[userId]?.name || userId.split('@')[0];
      const reason = banInfo.reason || 'No reason';
      const gmt2 = banInfo.bannedAtGMT || (banInfo.bannedAt ? new Date(banInfo.bannedAt).toUTCString() : '?');
      const bannedBy2 = banInfo.bannedBy ? '@' + banInfo.bannedBy.split('@')[0].split(':')[0] : 'Unknown';
      const gcInfo2 = banInfo.gcName ? `${banInfo.gcName} (${banInfo.gc || '?'})` : (banInfo.gc || 'Unknown GC');
      text += `${i + 1}. ${userName} (@${userId.split('@')[0]})\n`;
      text += `   👮 Banned by: ${bannedBy2}\n`;
      text += `   📝 Reason: ${reason}\n`;
      text += `   📍 GC: ${gcInfo2}\n`;
      text += `   🕒 Time (GMT): ${gmt2}\n\n`;
    });
    
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\nUse /unban @user to unban`;
    
    await sock.sendMessage(chatId, {
      text: text,
      mentions: bannedList
    }, { quoted: msg });
  }
};