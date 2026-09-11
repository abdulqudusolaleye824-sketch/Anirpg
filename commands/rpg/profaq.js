// ═══════════════════════════════════════════════════════════════
// /profaq — Explains all prices, perks, and features of Astra Pro
// ═══════════════════════════════════════════════════════════════

'use strict';

module.exports = {
  name: 'profaq',
  aliases: ['pro', 'proinfo', 'prohelp'],
  description: '📜 Info on Astra Pro prices, cards, perks, and features',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(getDatabase()?.users?.[sender] || {});
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    return sock.sendMessage(chatId, {
      text: [
        ...(pro ? [UI.PRO_BAR, `🌟 *ASTRA PRO SYSTEM & PERKS FAQ* 💎`, UI.PRO_BAR] : [`🌟 *ASTRA PRO SYSTEM & PERKS FAQ*`, UI.FREE_BAR]),
        ``,
        `💳 *PRO SUBSCRIPTION CARDS:*`,
        `🎫 *Weekly Pro Card* ($2 equivalent)`,
        `   • Price: *2,000 PC* | Duration: *7 Days*`,
        `   • Bonus: *500,000 Nexus* & *50,000 Mana Stones*`,
        ``,
        `📜 *Monthly Pro Card* ($30 equivalent)`,
        `   • Price: *5,000 PC* | Duration: *30 Days*`,
        `   • Bonus: *2,000,000 Nexus* & *200,000 Mana Stones*`,
        ``,
        `👑 *Yearly Pro Card* ($60 equivalent)`,
        `   • Price: *60,000 PC* | Duration: *365 Days*`,
        `   • Bonus: *20,000,000 Nexus* & *2,000,000 Mana Stones*`,
        ``,
        FRAME,
        `✨ *ALL PRO EXCLUSIVE PERKS:*`,
        `1. ⏱️ *50% Reduced Attack Cooldowns* — All martial attacks (up to 10 min base) are halved for Pro (max 5 min). Applies to PvP, Dungeons, Gates, World Boss — all battle systems use the same calculation. Status effects still tick -1 per turn. (Daily is excluded).`,
        `2. 💠 *2× Daily Rewards* — /daily gives double Nexus, Mana Stones, and XP for Pro.`,
        `3. ⚡ *2× EXP Multiplier* across ALL platforms (Dungeons, Raids, Aura, Astra Pass, Battle Pass, Quests).`,
        `4. 👑 *Automatic Astra Pass Premium Tier* access.`,
        `5. 💬 */setcustom [emoji]* — Bot reacts to all your commands with your custom emoji.`,
        `6. ⭐ *100% /aurafarm Success Hint*: Bot reacts with ⭐ for 2s, granting 100% success rate on /aurafarm for the next 5s.`,
        `7. 🔒 */lockprofile* — When locked, using /p in a Group Chat sends your profile directly to DM (and to Bot Staff chat).`,
        `8. 🏢 *Self-Employed Status* — Shows as Self-Employed instead of Unemployed when not in a guild.`,
        `9. 🤖 *RPG Intent Manager Access* — Allows AI-driven RPG command execution.`,
        `10. 🛠️ *Emergency Serf Switch* — Allowed to change Serf assistants in emergencies.`,
        `11. ❤️ *Access to Pro Battle UI*`,
        ``,
        FRAME,
        `🛍️ Use */prostore* to purchase Pro subscription cards!`,
        FRAME,
        ...(pro ? [UI.PRO_MINI, `💎 *PRO INSIDER* — you're living the perks`] : [UI.upsell()]),
      ].join('\n'),
    }, { quoted: msg });
  }
};
