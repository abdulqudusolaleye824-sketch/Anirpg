// ═══════════════════════════════════════════════════════════════
// /profaq — Explains all prices, perks, and features of Astra Pro
// ═══════════════════════════════════════════════════════════════

'use strict';

const Buttons = (()=>{ try { return require('../../utils/buttons'); } catch(e){ return null; } })();

module.exports = {
  name: 'profaq',
  aliases: ['pro', 'proinfo', 'prohelp'],
  description: '📜 Info on Astra Pro prices, cards, perks, and features',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const UI = require('../../rpg/utils/UI');
    const db = getDatabase() || {};
    const pro = UI.isPro(db.users?.[sender] || {});
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const faqText = [
        ...(pro ? [UI.PRO_BAR, `🌟 *ASTRA PRO — PRICES & PERKS* 💎`, UI.PRO_BAR] : [`🌟 *ASTRA PRO — PRICES & PERKS*`, UI.FREE_BAR]),
        ``,
        `💳 *PRO CARDS*`,
        `🎫 Weekly — *2,000 PC* ($2) · 7 days`,
        `📜 Monthly — *5,000 PC* ($5) · 30 days`,
        `👑 Yearly — *60,000 PC* ($60) · 365 days`,
        `🎖️ Battle Pass Premium — *2,000 PC* ($2) · season`,
        ``,
        FRAME,
        `✨ *PRO PERKS*`,
        `1. ⏱️ 50% faster attack cooldowns`,
        `2. 💠 2× /daily rewards`,
        `3. ⚡ 2× EXP everywhere`,
        `4. 🎖️ Astra Pass Premium tier`,
        `5. 🎁 Daily Blessed / Cursed boxes (/box)`,
        `6. 🗝️ Instance Keys & B/C-Rank weapons from boxes`,
        `7. 💎 Pro Lounge GC (epic spawns every 3h, B/A/S gates)`,
        `8. ♻️ /recycle`,
        `9. 🛠️ Tougher gear durability + 2× faster rest-mending`,
        `10. 🧠 Quiz 2× rewards`,
        `11. 💬 /setcustom reaction emoji`,
        `12. ⭐ /aurafarm 100% success hint`,
        `13. 🔒 /lockprofile`,
        `14. 🏢 Self-Employed status`,
        `15. 🤖 RPG Intent Manager (AI commands)`,
        `16. 🛠️ Emergency serf switch`,
        `17. ❤️ Pro battle UI & buttons`,
        `18. 🎂 Birthday bonus`,
        ``,
        FRAME,
        `🛍️ */prostore* — buy Pro cards · */bp buy* — Battle Pass Premium`,
        FRAME,
        ...(pro ? [UI.PRO_MINI, `💎 *PRO INSIDER* — you're living the perks`] : [UI.upsell()]),
      ].join('\n');
    // Buy-Pro buttons (menu/plain fallbacks underneath).
    try {
      if (Buttons?.sendButtons) {
        await Buttons.sendButtons(sock, chatId, {
          text: faqText,
          footer: 'Astra Pro',
          buttons: Buttons.quickReplies([[`🎫 Weekly Pro`, `/prostore buy weekly`], [`📜 Monthly Pro`, `/prostore buy monthly`], [`👑 Yearly Pro`, `/prostore buy yearly`]]),
        }, msg);
        return;
      }
    } catch (e) { console.error('profaq buttons send failed:', e.message); }
    return sock.sendMessage(chatId, { text: faqText }, { quoted: msg });
  }
};
