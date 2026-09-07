// community.js — Ani R.P.G community group directory
const AutoRedirect = require('../../rpg/utils/AutoRedirect');

module.exports = {
  name: 'community',
  aliases: ['groups', 'links'],
  description: '🌐 View all Ani R.P.G community group links',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // Pull from communityGroups (set via /setgroup)
    const groups = AutoRedirect.getAllGroups(db);

    let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌐 *ANI R.P.G COMMUNITY*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nWelcome to the Ani R.P.G universe!\nEach group has its own role:\n\n`;

    for (const g of groups) {
      const link = g.inviteLink;
      txt += `${g.emoji} *${g.groupName}*\n`;
      txt += `   ${g.desc}\n`;
      txt += `   ${link ? `🔗 ${link}` : '⏳ Coming soon'}\n\n`;
    }

    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 */support* — get the support group link in your DM\n💡 */help* — all commands`;

    // DM if in a group to keep chat clean
    if (chatId.endsWith('@g.us')) {
      await sock.sendMessage(chatId, {
        text: `📩 Community links sent to your DM, @${sender.split('@')[0]}!`,
        mentions: [sender]
      }, { quoted: msg });
      try {
        await sock.sendMessage(sender, { text: txt });
      } catch(e) {
        await sock.sendMessage(chatId, { text: txt }, { quoted: msg });
      }
    } else {
      await sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }
  }
};
