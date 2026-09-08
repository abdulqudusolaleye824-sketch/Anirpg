// ═══════════════════════════════════════════════════════════════
// /setcustom — Set custom emoji reaction for Pro players
// ═══════════════════════════════════════════════════════════════

'use strict';

function isProPlayer(player) {
  if (!player) return false;
  return !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
}

module.exports = {
  name: 'setcustom',
  aliases: ['setemoji', 'customemoji'],
  description: '💬 Pro Feature: Set a custom emoji for bot command reactions',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

    if (!isProPlayer(player)) {
      return sock.sendMessage(chatId, { text: '🔒 */setcustom* is a Pro feature! Upgrade to Pro via /prostore' }, { quoted: msg });
    }

    const emoji = (args[0] || '').trim();
    if (!emoji) {
      return sock.sendMessage(chatId, { text: `💬 Current custom emoji: *${player.customEmoji || 'None'}*\nUsage: /setcustom [emoji]\nExample: /setcustom 🔥` }, { quoted: msg });
    }

    player.customEmoji = emoji;
    saveDatabase();

    try {
      await sock.sendMessage(chatId, { react: { text: emoji, key: msg.key } });
    } catch (_) {}

    return sock.sendMessage(chatId, { text: `✅ Custom command reaction emoji set to: *${emoji}*` }, { quoted: msg });
  }
};
