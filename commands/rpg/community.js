// community.js — ✦ 𝐀𝐬𝐭𝐫𝐚™ community group directory
const AstralGroups = require('../../rpg/utils/AstralGroups');

module.exports = {
  name: 'community',
  aliases: ['groups', 'links'],
  description: '🌐 View all ✦ 𝐀𝐬𝐭𝐫𝐚™ community group links',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(db.users?.[sender] || {});
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const groups = AstralGroups.getAll(db);
    const ordered = ['pvp', 'casino', 'dungeon', 'guild', 'support'];

    let txt = pro ? `${UI.PRO_BAR}\n🌐 *✦ 𝐀𝐬𝐭𝐫𝐚™ COMMUNITY* 💎\n${UI.PRO_BAR}\n🎮 *Server:* ✦ 𝐀𝐬𝐭𝐫𝐚™\nWelcome to the ✦ 𝐀𝐬𝐭𝐫𝐚™ universe!\n\n` : `🌐 *✦ 𝐀𝐬𝐭𝐫𝐚™ COMMUNITY*\n${UI.FREE_BAR}\n🎮 *Server:* ✦ 𝐀𝐬𝐭𝐫𝐚™\nWelcome to the ✦ 𝐀𝐬𝐭𝐫𝐚™ universe!\n\n`;

    let any = false;
    for (const type of ordered) {
      const info = AstralGroups.typeInfo(type);
      const list = groups.filter((g) => g.type === type);
      if (list.length === 0) continue;
      any = true;
      txt += `${info.emoji} *${info.name}*\n`;
      txt += `   ${info.desc}\n`;
      for (const g of list) {
        const link = g.inviteLink;
        const st = AstralGroups.statusOf(db, g.groupId);
        const stTxt = st === 'main' ? '👑 Main' : st === 'active' ? '✅' : st === 'expired' ? '⛔ Expired' : '⏳ Awaiting /ssub';
        txt += `   └ ${stTxt} ${link ? `🔗 ${link}` : '(link not set)'}\n`;
      }
      txt += `\n`;
    }
    if (!any) txt += `⚠️ No community groups registered yet.\n\n`;

    txt += `${FRAME}\n💡 */support* — get the support group link in your DM\n💡 */help* — all commands` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO NETWORK* — ${groups.length} groups` : `\n${UI.upsell()}`);

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
