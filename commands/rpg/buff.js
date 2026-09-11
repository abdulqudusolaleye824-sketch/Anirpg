// /buff — Activate shop consumable buffs
const BuffManager = require('../../rpg/utils/BuffManager');
const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'buff',
  aliases: ['usebuff', 'activate'],
  description: '⚡ Activate a consumable buff from your inventory',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const sub = args[0]?.toLowerCase();

    // Show active buffs and available buffs
    if (!sub || sub === 'list') {
      const inv = player.inventory || {};
      let txt = pro ? `${UI.PRO_BAR}\n⚡ *BUFF SYSTEM* 💎\n${UI.PRO_BAR}\n\n` : `⚡ *BUFF SYSTEM*\n${UI.FREE_BAR}\n\n`;
      
      txt += `🟢 *ACTIVE BUFFS:*\n${BuffManager.getActiveBuff_Display(player)}\n\n`;
      
      txt += `📦 *AVAILABLE IN INVENTORY:*\n`;
      const buffKeys = ['xpBooster', 'goldMult', 'shieldScroll', 'mightElixir', 'luckPotion', 'gvcGold', 'gvcSilver', 'gvcBronze'];
      let hasAny = false, buffCount = 0;
      for (const key of buffKeys) {
        if (inv[key] && inv[key] > 0) {
          const def = BuffManager.BUFF_DEFINITIONS[key];
          txt += `${def.emoji} *${def.name}* ×${inv[key]}\n   → /buff ${key}\n`;
          hasAny = true;
          buffCount += inv[key];
        }
      }
      if (!hasAny) txt += `None — buy buffs from /shop\n`;
      
      if (pro) txt += `\n${UI.PRO_MINI}\n💎 *PRO LOADOUT* — ${buffCount} buff${buffCount === 1 ? '' : 's'} ready\n`;
      txt += `\n${FRAME}`;
      if (!pro) txt += `\n${UI.upsell()}`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // Activate a specific buff
    const buffKey = sub;
    const result = BuffManager.activateBuff(player, buffKey);
    if (result && result.success) {
      try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'buff', 1, sock, sender, chatId); } catch(e){}
    }
    saveDatabase();
    return sock.sendMessage(chatId, { text: result.msg }, { quoted: msg });
  }
};