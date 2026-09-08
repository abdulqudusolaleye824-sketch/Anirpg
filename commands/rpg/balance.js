/**
 * /balance (aliases /wallet, /bal) — Show a player's Nexus + Mana Stone balance.
 */

'use strict';

function bare(jid) {
  return String(jid).split(':')[0].split('@')[0];
}

module.exports = {
  name: 'balance',
  aliases: ['wallet', 'bal'],
  description: '💠 Show your Nexus + Mana Stones balance',
  usage: '/balance   |   /wallet   |   /bal',
  category: 'economy',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // Allow viewing another player's balance only in groups by mention/reply.
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant || sender;

    const player =
      db.users?.[targetId] ||
      db.users?.[bare(targetId)] ||
      db.users?.[bare(sender)] ||
      db.users?.[sender];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: '❌ That player is not registered. Use /register first.',
      }, { quoted: msg });
    }

    const isSelf = bare(targetId) === bare(sender);
    const name = player.name || targetId.split('@')[0];

    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `💠 *${isSelf ? 'YOUR BALANCE' : 'PLAYER BALANCE'}*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `👤 *${name}*`,
        `💠 *Nexus:* ${(player.gold || 0).toLocaleString()}`,
        `💎 *Mana Stones:* ${(player.manaCrystals || 0).toLocaleString()}`,
        `⬆️ *Upgrade Points:* ${(player.upgradePoints || 0).toLocaleString()}`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
      mentions: isSelf ? undefined : [targetId],
    }, { quoted: msg });
  },
};
