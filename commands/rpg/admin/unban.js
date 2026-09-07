const Perms = require('../../../utils/permissions');

module.exports = {
  name: 'unban',
  description: '✅ Unban a user',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!db.botMods) db.botMods = [];
    if (!db.bannedUsers) db.bannedUsers = {};
    
    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot admins can use this command!'
      }, { quoted: msg });
    }
    
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;
    
    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: '❌ Tag a user or reply to unban!\n\nUsage: /unban @user'
      }, { quoted: msg });
    }
    
    if (!db.bannedUsers[targetId]) {
      return sock.sendMessage(chatId, {
        text: '❌ This user is not banned!'
      }, { quoted: msg });
    }
    
    delete db.bannedUsers[targetId];
    saveDatabase();
    
    await sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ USER UNBANNED ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User: @${targetId.split('@')[0]}
👮 Unbanned by: @${sender.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
This user can now use the bot again.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [targetId, sender]
    }, { quoted: msg });
    
    try {
      await sock.sendMessage(targetId, {
        text: `✅ You have been unbanned!\n\nYou can now use bot commands again.`
      });
    } catch (e) {}
  }
};