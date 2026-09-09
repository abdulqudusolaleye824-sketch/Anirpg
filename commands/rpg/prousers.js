// ═══════════════════════════════════════════════════════════════
// /prousers — List all active Pro players & subscription details
// ═══════════════════════════════════════════════════════════════

'use strict';

function cleanBare(jid) {
  return String(jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function formatDate(timestamp) {
  if (!timestamp || timestamp >= 9999999999999) return '∞ Lifetime / Permanent';
  const d = new Date(timestamp);
  return d.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

module.exports = {
  name: 'prousers',
  aliases: ['proplayers', 'prolist', 'vips', 'pro'],
  description: '⭐ List all active Pro players and subscription details',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const now = Date.now();
    const proUsers = Object.entries(db.users || {})
      .filter(([, u]) => u && (u.isPro || u.proStatus) && u.proExpiresAt && u.proExpiresAt > now)
      .map(([key, u]) => ({
        key,
        bare: cleanBare(key),
        user: u,
        expiresAt: u.proExpiresAt || 0,
      }))
      .sort((a, b) => b.expiresAt - a.expiresAt);

    let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👑 *ASTRA PRO HUNTERS* 👑\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `🌟 Total Pro Members: *${proUsers.length}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    const mentions = [];

    if (proUsers.length === 0) {
      txt += `_No active Pro members currently._\n\n💡 Use */prostore* to upgrade to Pro and unlock VIP perks!`;
    } else {
      proUsers.forEach((item, index) => {
        const u = item.user;
        const bareNum = item.bare;
        const name = u.name || 'Hunter';
        const cleanJid = `${bareNum}@s.whatsapp.net`;
        mentions.push(cleanJid);

        const expStr = formatDate(item.expiresAt);
        const emoji = u.customEmoji ? ` ${u.customEmoji}` : '';
        const title = u.equippedTitle ? ` "${u.equippedTitle}"` : '';

        txt += `${index + 1}. 🌟 *${name}*${emoji} (@${bareNum})\n`;
        if (title) txt += `   🎖️ Title:${title}\n`;
        txt += `   📊 Level ${u.level || 1} | ${u.awakenRank || 'E'}-Rank\n`;
        txt += `   ⏳ Expires: ${expStr}\n`;
        txt += `   🔥 Perks: 2x EXP Boost | Serf Switching\n\n`;
      });
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 Upgrade or renew with */prostore*`;
    }

    await sock.sendMessage(chatId, {
      text: txt,
      mentions: [...new Set(mentions)],
    }, { quoted: msg });
  }
};
