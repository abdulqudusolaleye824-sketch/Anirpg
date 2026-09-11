// ═══════════════════════════════════════════════════════════════
// /lockprofile — Toggle profile lock for Pro players
// ═══════════════════════════════════════════════════════════════

'use strict';

const UI = require('../../rpg/utils/UI');

function isProPlayer(player) {
  if (!player) return false;
  return !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
}

module.exports = {
  name: 'lockprofile',
  aliases: ['lockp'],
  description: '🔒 Toggle profile lock (Pro feature: sends profile to DM in group chats)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

    if (!isProPlayer(player)) {
      return sock.sendMessage(chatId, { text: '🔒 */lockprofile* is a Pro feature! Upgrade to Pro via /prostore' }, { quoted: msg });
    }

    player.profileLocked = !player.profileLocked;
    saveDatabase();
    const proL = UI.isPro(player);

    if (player.profileLocked) {
      return sock.sendMessage(chatId, {
        text: `${(proL ? UI.PRO_BAR : UI.FREE_BAR)}\n🔒 *PROFILE LOCKED*\n\nYour profile is now locked in Private DM Mode.\nWhen you or others use /profile in a Group Chat, Serf will send your card directly to your DM!\n${proL ? `${UI.PRO_MINI}\n🔒 PRO VAULT\n⏳ Pro active until *${new Date(player.proExpiresAt).toLocaleDateString()}*\n` : ''}${(proL ? UI.PRO_BAR : UI.FREE_BAR)}`
      }, { quoted: msg });
    } else {
      return sock.sendMessage(chatId, {
        text: `${(proL ? UI.PRO_BAR : UI.FREE_BAR)}\n🔓 *PROFILE UNLOCKED*\n\nYour profile is now public and visible in group chats.\n${proL ? `${UI.PRO_MINI}\n🔓 PRO VAULT\n⏳ Pro active until *${new Date(player.proExpiresAt).toLocaleDateString()}*\n` : ''}${(proL ? UI.PRO_BAR : UI.FREE_BAR)}`
      }, { quoted: msg });
    }
  }
};
