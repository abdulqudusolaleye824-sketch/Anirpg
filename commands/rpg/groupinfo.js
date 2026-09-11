const AutoRedirect = require('../../rpg/utils/AutoRedirect');

module.exports = {
  name: 'groupinfo',
  description: 'Show all special game groups and their links',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(getDatabase()?.users?.[sender] || {});
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const groups = AutoRedirect.getAllGroups();
    
    if (groups.length === 0) {
      return sock.sendMessage(chatId, {
        text: '❌ No special groups configured yet!'
      }, { quoted: msg });
    }

    let message = pro ? `${UI.PRO_BAR}\n🎮 GAME GROUPS 🎮 💎\n${UI.PRO_BAR}\nJoin the right group for each activity!\n${UI.PRO_BAR}\n\n` : `🎮 GAME GROUPS 🎮\n${UI.FREE_BAR}\nJoin the right group for each activity!\n${UI.FREE_BAR}\n\n`;

    groups.forEach((group, index) => {
      message += `${group.emoji} *${group.groupName}*\n`;
      message += `${FRAME}\n`;
      message += `📋 Commands:\n`;
      (group.commands || []).forEach(cmd => {
        message += `   • /${cmd}\n`;
      });
      message += `\n🔗 Join: ${group.inviteLink || '(link not set)'}\n\n`;
    });

    message += `${FRAME}\n💡 TIP\n${FRAME}\nCommands like /stats, /profile, /shop work everywhere!\n\nSpecial commands only work in their designated groups.\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO NAVIGATOR* — ${groups.length} groups` : `\n${UI.upsell()}`);

    return sock.sendMessage(chatId, {
      text: message
    }, { quoted: msg });
  }
};