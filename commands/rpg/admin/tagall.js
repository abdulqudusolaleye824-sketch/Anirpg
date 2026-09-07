const Perms = require('../../../utils/permissions');

module.exports = {
  name: 'tagall',
  description: '📢 Tag all members in group',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!db.botMods) db.botMods = [];
    
    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot admins can use this command!'
      }, { quoted: msg });
    }
    
    // Check if in group
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: '❌ This command only works in groups!'
      }, { quoted: msg });
    }
    
    const message = args.join(' ') || 'Announcement';
    
    try {
      // Get group metadata
      const groupMetadata = await sock.groupMetadata(chatId);
      const participants = groupMetadata.participants.map(p => p.id);
      
      let text = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📢 GROUP ANNOUNCEMENT 📢
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 Tagging ${participants.length} members:
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      
      // Add mentions
      participants.forEach((id, i) => {
        text += `${i + 1}. @${id.split('@')[0]} `;
        if ((i + 1) % 5 === 0) text += '\n';
      });
      
      text += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━';
      
      await sock.sendMessage(chatId, {
        text: text,
        mentions: participants
      }, { quoted: msg });
      
    } catch (error) {
      await sock.sendMessage(chatId, {
        text: '❌ Failed to tag members!\n\nMake sure bot has proper group permissions.'
      }, { quoted: msg });
    }
  }
};