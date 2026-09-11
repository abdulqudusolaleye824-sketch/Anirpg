module.exports = {
  name: 'rules',
  description: 'Display the bot rules',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(getDatabase()?.users?.[sender] || {});
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const head = pro ? `${UI.PRO_BAR}\n📜 *SERVER RULES* 💎\n${UI.PRO_BAR}` : `📜 *SERVER RULES*\n${UI.FREE_BAR}`;
    const text = `${head}


*1.* Respect Creator at all times. The Creator's decision is final.

*2.* Respect Moderators and follow their instructions.

*3.* Use commands only in the GCs where they belong.

*4.* Arise GC is the main hub for upgrades, stats, items, and general interaction only. No special GC commands in Arise.

*5.* Dungeon GC is strictly for dungeons and bosses only. Do not open bosses or dungeons anywhere else.

*6.* PvP GC is for PvP only. Do not open bosses or dungeons in PvP GC.

*7.* Casino GC is only for casino activities and casino commands.

*8.* If you join a dungeon and remain inactive, you may be kicked from the dungeon.

*9.* Speak English in all GCs. Other languages are only allowed in the Chatroom GC.

*10.* Use the Chatroom GC for free conversation.

*11.* Do not use languages aside from English in any GC outside the Chatroom.

*12.* Send suggestions using /suggest.

*13.* Subscribe to news and events using /subscribe.

*14.* If you notice a bug, use /admins to call the attention of the admins to it.

*15.* 🚫 SPAMMING IS FORBIDDEN.

${FRAME}
🙏 Thank you for your anticipated cooperation!
${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO MEMBER* — play by the code` : `\n${UI.upsell()}`);

    return sock.sendMessage(chatId, { text }, { quoted: msg });
  }
};