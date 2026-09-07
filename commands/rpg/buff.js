// /buff — Activate shop consumable buffs
const BuffManager = require('../../rpg/utils/BuffManager');

module.exports = {
  name: 'buff',
  aliases: ['usebuff', 'activate'],
  description: '⚡ Activate a consumable buff from your inventory',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });

    const sub = args[0]?.toLowerCase();

    // Show active buffs and available buffs
    if (!sub || sub === 'list') {
      const inv = player.inventory || {};
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ *BUFF SYSTEM*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      txt += `🟢 *ACTIVE BUFFS:*\n${BuffManager.getActiveBuff_Display(player)}\n\n`;
      
      txt += `📦 *AVAILABLE IN INVENTORY:*\n`;
      const buffKeys = ['xpBooster', 'goldMult', 'shieldScroll', 'mightElixir', 'luckPotion'];
      let hasAny = false;
      for (const key of buffKeys) {
        if (inv[key] && inv[key] > 0) {
          const def = BuffManager.BUFF_DEFINITIONS[key];
          txt += `${def.emoji} *${def.name}* ×${inv[key]}\n   → /buff ${key}\n`;
          hasAny = true;
        }
      }
      if (!hasAny) txt += `None — buy buffs from /shop\n`;
      
      txt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // Activate a specific buff
    const buffKey = sub;
    const result = BuffManager.activateBuff(player, buffKey);
    saveDatabase();
    return sock.sendMessage(chatId, { text: result.msg }, { quoted: msg });
  }
};