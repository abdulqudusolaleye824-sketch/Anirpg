const Perms = require('../../../utils/permissions');

module.exports = {
  name: 'kick',
  description: '👢 Kick user from group',
  
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
        text: '❌ Tag a user or reply to kick!\n\nUsage: /kick @user'
      }, { quoted: msg });
    }
    
    if (Perms.isBotOwner(db, targetId)) {
      return sock.sendMessage(chatId, {
        text: '❌ Cannot kick the bot owner!'
      }, { quoted: msg });
    }
    
    try {
      await sock.groupParticipantsUpdate(chatId, [targetId], 'remove');
      
      await sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👢 USER KICKED 👢
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User: @${targetId.split('@')[0]}
👮 Kicked by: @${sender.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions: [targetId, sender]
      }, { quoted: msg });
      
    } catch (error) {
      await sock.sendMessage(chatId, {
        text: '❌ Failed to kick user!\n\nMake sure bot is admin in this group.'
      }, { quoted: msg });
    }
  }
};