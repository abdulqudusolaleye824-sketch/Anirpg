const AutoRedirect = require('../../rpg/utils/AutoRedirect');

module.exports = {
  name: 'groupinfo',
  description: 'Show all special game groups and their links',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    
    const groups = AutoRedirect.getAllGroups();
    
    if (groups.length === 0) {
      return sock.sendMessage(chatId, {
        text: '❌ No special groups configured yet!'
      }, { quoted: msg });
    }

    let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 GAME GROUPS 🎮
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Join the right group for each activity!
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    groups.forEach((group, index) => {
      message += `${group.emoji} *${group.groupName}*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `📋 Commands:\n`;
      group.commands.forEach(cmd => {
        message += `   • /${cmd}\n`;
      });
      message += `\n🔗 Join: ${group.inviteLink}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 TIP
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Commands like /stats, /profile, /shop work everywhere!

Special commands only work in their designated groups.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return sock.sendMessage(chatId, {
      text: message
    }, { quoted: msg });
  }
};