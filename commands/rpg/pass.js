// ═══════════════════════════════════════════════════════════════
// /pass (/astrapass alias) — Astra Hunter Association Pass
// ═══════════════════════════════════════════════════════════════

'use strict';

module.exports = {
  name: 'pass',
  aliases: ['astrapass'],
  description: '📜 Astra Hunter Association Pass — view rank, badges, and perks',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

    const rank = player.awakenRank || 'E';
    const level = player.level || 1;
    const totalXp = player.totalXp || player.xp || 0;
    const totalGP = player.totalGP || 0;

    const passLevel = Math.min(100, Math.floor(level / 2) + Math.floor(totalGP / 500));
    const passTitle = passLevel >= 80 ? '👑 Association Director' : passLevel >= 50 ? '🌟 High Rank Officer' : passLevel >= 20 ? '🛡️ Certified Hunter' : '🔰 Rookie Hunter';

    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🏛️ *ASTRA HUNTER ASSOCIATION PASS*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👤 Hunter: *${player.name}*`,
        `🏷️ Rank: *${rank}-Rank* | Lv.${level}`,
        `⭐ Association Pass Rank: *Lv.${passLevel} (${passTitle})*`,
        ``,
        `📊 *PERKS & BONUSES:*`,
        `• 💠 Guild GP Earned: *${totalGP.toLocaleString()} GP*`,
        `• ⚡ Class Quality: *${player.classQuality || 100}%*`,
        `• 📜 Active Title: *${player.activeTitle || 'None'}*`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `💡 Use */bp* for the Seasonal Battle Pass (Shadow Invasion)!`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    }, { quoted: msg });
  }
};
