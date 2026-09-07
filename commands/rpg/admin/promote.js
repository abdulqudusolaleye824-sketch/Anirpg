const Perms = require('../../../utils/permissions');

module.exports = {
  name: 'promote',
  description: '👑 Promote user to bot admin',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    // Only bot owner can promote
    if (!Perms.isBotOwner(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the bot owner can promote users to admin!'
      }, { quoted: msg });
    }
    
    if (!db.botMods) db.botMods = [];
    
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;
    
    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: '❌ Tag a user or reply to promote!\n\nUsage: /promote @user'
      }, { quoted: msg });
    }
    
    if (Perms.isBotOwner(db, targetId)) {
      return sock.sendMessage(chatId, {
        text: '❌ Bot owner is already the highest rank!'
      }, { quoted: msg });
    }
    
    if (db.botMods.includes(targetId)) {
      return sock.sendMessage(chatId, {
        text: '❌ This user is already a bot admin!'
      }, { quoted: msg });
    }
    
    db.botMods.push(targetId);
    // Give new mod 1.5M gold bonus
    if (db.users?.[targetId]) {
      db.users[targetId].gold = (db.users[targetId].gold || 0) + 1500000;
    }
    saveDatabase();
    
    await sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 ADMIN PROMOTED 👑
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User: @${targetId.split('@')[0]}
⭐ New Role: Bot Admin
━━━━━━━━━━━━━━━━━━━━━━━━━━━
This user can now:
- Ban/unban users
- Use admin commands
- Moderate the bot
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [targetId]
    }, { quoted: msg });
    
    try {
      await sock.sendMessage(targetId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 PROMOTED TO ADMIN! 👑
━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are now a bot admin!

New Commands:
- /ban @user
- /unban @user
- /tagall message
- /broadcast message
- /kick @user
- /mute @user
- And more!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      });
    } catch (e) {}
  }
};