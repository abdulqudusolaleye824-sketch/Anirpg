// ═══════════════════════════════════════════════════════════════
// /unlockprofile — Unlock profile for Pro players (return to GC send)
// Sets profileLocked = false so anyone can view via /profile in GC
// ═══════════════════════════════════════════════════════════════

'use strict';

const UI = require('../../rpg/utils/UI');

function isProPlayer(player) {
  if (!player) return false;
  return !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
}

module.exports = {
  name: 'unlockprofile',
  aliases: ['unlockp', 'profileunlock'],
  description: '🔓 Unlock profile (Pro: return to normal GC profile) ',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

    if (!isProPlayer(player)) {
      return sock.sendMessage(chatId, { text: '🔓 */unlockprofile* is a Pro feature! Upgrade to Pro via /prostore' }, { quoted: msg });
    }

    if (!player.profileLocked) {
      const proA = UI.isPro(player);
      return sock.sendMessage(chatId, { text: `${(proA ? UI.PRO_BAR : UI.FREE_BAR)}\n🔓 *PROFILE ALREADY UNLOCKED*\n\nYour profile is already public and visible in group chats via /profile.\n${(proA ? UI.PRO_BAR : UI.FREE_BAR)}` }, { quoted: msg });
    }

    player.profileLocked = false;
    saveDatabase();
    const proU = UI.isPro(player);

    return sock.sendMessage(chatId, {
      text: `${(proU ? UI.PRO_BAR : UI.FREE_BAR)}\n🔓 *PROFILE UNLOCKED*\n\nYour profile is now public and visible in group chats.\nAnyone can use /profile and see your card in the GC.\n\n💡 Use /lockprofile to lock it again (DM only).\n${proU ? `${UI.PRO_MINI}\n🔓 PRO VAULT\n⏳ Pro active until *${new Date(player.proExpiresAt).toLocaleDateString()}*\n` : ''}${(proU ? UI.PRO_BAR : UI.FREE_BAR)}`
    }, { quoted: msg });
  }
};
