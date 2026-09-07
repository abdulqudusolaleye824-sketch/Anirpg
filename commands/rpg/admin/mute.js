const Perms = require('../../../utils/permissions');

module.exports = {
  name: 'mute',
  description: '🔇 Mute user in group',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!db.botMods) db.botMods = [];
    
    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot admins can use this command!'
      }, { quoted: msg });
    }
    
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: '❌ This command only works in groups!'
      }, { quoted: msg });
    }
    
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;
    
    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: `❌ Tag a user or reply to mute!

📌 Usage:
/mute @user [minutes]

Example:
/mute @user 60 (mute for 60 minutes)
/mute @user (mute until unmuted)`
      }, { quoted: msg });
    }
    
    if (Perms.isBotOwner(db, targetId)) {
      return sock.sendMessage(chatId, {
        text: '❌ Cannot mute the bot owner!'
      }, { quoted: msg });
    }
    
    const duration = parseInt(args[1]) || 0;
    const durationText = duration > 0 ? `${duration} minutes` : 'until unmuted';
    
    // Store mute info
    if (!db.mutedUsers) db.mutedUsers = {};
    if (!db.mutedUsers[chatId]) db.mutedUsers[chatId] = {};
    
    db.mutedUsers[chatId][targetId] = {
      mutedBy: sender,
      mutedAt: Date.now(),
      duration: duration * 60 * 1000,
      endsAt: duration > 0 ? Date.now() + (duration * 60 * 1000) : null
    };
    
    saveDatabase();
    
    await sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔇 USER MUTED 🔇
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User: @${targetId.split('@')[0]}
⏰ Duration: ${durationText}
👮 Muted by: @${sender.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
This user cannot use bot commands in this group.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [targetId, sender]
    }, { quoted: msg });
  }
};