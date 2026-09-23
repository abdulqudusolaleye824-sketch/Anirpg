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
      // Push #88c: combat stat boosts from skills (Battle Cry, Dominion…) with turns left.
      try {
        const tb = Object.entries(player.tempBuffs || {}).filter(([, v]) => v && (v.duration || 0) > 0 && (v.stat || v.bonus != null || v.amount != null));
        txt += `⚔️ *COMBAT STAT BOOSTS (from skills):*\n`;
        if (!tb.length) txt += `  _None active — cast a buff skill in battle (e.g. Battle Cry)._\n\n`;
        else {
          for (const [k, v] of tb) {
            const src = String(k).split(':')[0];
            const stat = v.stat === 'damageTaken' ? 'DMG TAKEN' : String(v.stat || k).toUpperCase();
            const amt = v.amount != null ? Number(v.amount) : Math.round((Number(v.bonus) || 0) * 100);
            const turns = Math.max(0, (v.duration || 0) - 1);
            if (v.stat === 'shield' || k === 'shield') { txt += `  🛡️ Shield *${v.amount}* HP · ${turns} turn${turns === 1 ? '' : 's'} left\n`; continue; }
            txt += `  ${amt >= 0 ? '⬆️' : '⬇️'} ${stat} ${amt >= 0 ? '+' : ''}${amt}% · ${turns} turn${turns === 1 ? '' : 's'} left${src && src !== k ? ` _(${src})_` : ''}\n`;
          }
          txt += `\n`;
        }
      } catch (e) {}
      
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