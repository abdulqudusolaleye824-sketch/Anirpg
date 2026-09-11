// ═══════════════════════════════════════════════════════════════
// /setcustom — Set custom emoji reaction for Pro players
// Only a SINGLE emoji is accepted: arbitrary stored text gets reacted on
// every command, and non-emoji reaction text can render as a blank bubble
// on some clients (one source of the "random empty message" reports).
// ═══════════════════════════════════════════════════════════════

'use strict';

function isProPlayer(player) {
  if (!player) return false;
  return !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
}

// Exactly one grapheme (flags / ZWJ sequences / skin tones count as one)
// that contains a pictographic character.
function isSingleEmoji(s) {
  if (typeof s !== 'string' || !s) return false;
  try {
    const graphemes = [...new Intl.Segmenter().segment(s)];
    return graphemes.length === 1 && /\p{Extended_Pictographic}/u.test(s);
  } catch (e) {
    return false;
  }
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
    if (!isSingleEmoji(emoji)) {
      return sock.sendMessage(chatId, { text: `❌ That isn't a single emoji!\n\nSend exactly ONE emoji — e.g. */setcustom 🔥*\n(Words or multi-emoji strings can't be used as reactions.)` }, { quoted: msg });
    }

    player.customEmoji = emoji;
    saveDatabase();

    try {
      await sock.sendMessage(chatId, { react: { text: emoji, key: msg.key } });
    } catch (_) {}

    return sock.sendMessage(chatId, { text: `✅ Custom command reaction emoji set to: *${emoji}*` }, { quoted: msg });
  },
};
