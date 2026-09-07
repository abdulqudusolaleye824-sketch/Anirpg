// ═══════════════════════════════════════════════════════════════
// LOCK COMMAND - /lock profile / /unlock profile
// ═══════════════════════════════════════════════════════════════

const SUPER_USERS = ['221951679328499@lid', '194592469209292@lid'];

module.exports = {
  name: 'lock',
  aliases: ['unlock'],
  description: 'Lock or unlock a player profile',
  usage: '/lock profile [@player] | /unlock profile [@player]',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // Determine if this is lock or unlock from command used
    const rawText = msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text || '';
    const isUnlock = rawText.trimStart().toLowerCase().startsWith('/unlock');

    const action = isUnlock ? 'unlock' : 'lock';
    const subCommand = args[0]?.toLowerCase();

    if (subCommand !== 'profile') {
      return sock.sendMessage(chatId, {
        text: `❌ Usage: /${action} profile [@player]\n\nExample: /${action} profile\nExample: /${action} profile @player`
      }, { quoted: msg });
    }

    const isSuperUser = SUPER_USERS.includes(sender);
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    // If tagging someone, must be super user
    if (mentionedJid && !isSuperUser) {
      return sock.sendMessage(chatId, {
        text: `❌ Only the bot owner can ${action} another player's profile!`
      }, { quoted: msg });
    }

    const targetId = mentionedJid || sender;
    const targetPlayer = db.users[targetId];

    if (!targetPlayer) {
      return sock.sendMessage(chatId, {
        text: '❌ Player not found!'
      }, { quoted: msg });
    }

    // Non-super users can only lock/unlock their own profile
    if (targetId !== sender && !isSuperUser) {
      return sock.sendMessage(chatId, {
        text: `❌ You can only ${action} your own profile!`
      }, { quoted: msg });
    }

    if (action === 'lock') {
      if (targetPlayer.profileLocked) {
        return sock.sendMessage(chatId, {
          text: `🔒 *${targetPlayer.name}*'s profile is already locked!`
        }, { quoted: msg });
      }
      targetPlayer.profileLocked = true;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔒 PROFILE LOCKED\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n*${targetPlayer.name}*'s profile is now private.\n\n👁 Only you${isSuperUser && mentionedJid ? '' : ''} and bot staff can view it.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions: mentionedJid ? [mentionedJid] : []
      }, { quoted: msg });
    } else {
      if (!targetPlayer.profileLocked) {
        return sock.sendMessage(chatId, {
          text: `🔓 *${targetPlayer.name}*'s profile is already public!`
        }, { quoted: msg });
      }
      targetPlayer.profileLocked = false;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔓 PROFILE UNLOCKED\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n*${targetPlayer.name}*'s profile is now public.\n\nAnyone can view it again.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions: mentionedJid ? [mentionedJid] : []
      }, { quoted: msg });
    }
  }
};