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

    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🌟 *ASTRA PRO SYSTEM & PERKS FAQ*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
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
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `✨ *ALL PRO EXCLUSIVE PERKS:*`,
        `1. ⏱️ *50% Reduced Cooldowns* across ALL features & activities (Aura, Bank, Casino, Skills, Dungeons, PvP, Bypass, and Commands).`,
        `2. ⚡ *2× EXP Multiplier* across ALL platforms (Dungeons, Raids, Aura, Astra Pass, Battle Pass, Quests).`,
        `3. 👑 *Automatic Astra Pass Premium Tier* access.`,
        `4. 💬 */setcustom [emoji]* — Bot reacts to all your commands with your custom emoji.`,
        `5. ⭐ *100% /aurafarm Success Hint*: Bot reacts with ⭐ for 2s, granting 100% success rate on /aurafarm for the next 5s.`,
        `6. 🔒 */lockprofile* — When locked, using /p in a Group Chat sends your profile directly to DM (and to Bot Staff chat).`,
        `7. 🏢 *Self-Employed Status* — Shows as Self-Employed instead of Unemployed when not in a guild.`,
        `8. 🤖 *RPG Intent Manager Access* — Allows AI-driven RPG command execution.`,
        `9. 🛠️ *Emergency Serf Switch* — Allowed to change Serf assistants in emergencies.`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🛍️ Use */prostore* to purchase Pro subscription cards!`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    }, { quoted: msg });
  }
};
