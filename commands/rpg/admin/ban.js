const Perms = require('../../../utils/permissions');

module.exports = {
  name: 'ban',
  description: '🚫 Ban a user from using the bot',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    
    // Bot owner and admins
    if (!db.botMods) db.botMods = [];
    if (!db.bannedUsers) db.bannedUsers = {};
    
    // Check if sender is admin
    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot admins can use this command!'
      }, { quoted: msg });
    }
    
    // Get user to ban
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;
    
    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: `❌ Tag a user or reply to ban!

📌 Usage:
/ban @user [reason]
/ban @user spamming

Reply to their message:
/ban [reason]`
      }, { quoted: msg });
    }
    
    // Can't ban owner
    if (Perms.isBotOwner(db, targetId)) {
      return sock.sendMessage(chatId, {
        text: '❌ Cannot ban the bot owner!'
      }, { quoted: msg });
    }
    
    // Can't ban yourself
    if (targetId === sender) {
      return sock.sendMessage(chatId, {
        text: '❌ You cannot ban yourself!'
      }, { quoted: msg });
    }
    
    const reason = args.slice(1).join(' ') || 'No reason provided';
    const targetUser = db.users[targetId];
    const targetName = targetUser?.name || targetId.split('@')[0];
    let gcName2 = chatId;
    try { const gmd2 = await sock.groupMetadata(chatId).catch(()=>null); if(gmd2&&gmd2.subject) gcName2=gmd2.subject; } catch {}
    const bannedAtGMT2 = new Date().toUTCString();
    // Ban user (bare key for consistency)
    const Mod2 = require('../../rpg/utils/ModerationUtils');
    Mod2.banUser(db, targetId, sender, reason, { gc: chatId, gcName: gcName2, bannedAtGMT: bannedAtGMT2 });
    // also store with full JID for legacy compatibility
    db.bannedUsers[targetId] = {
      bannedBy: sender,
      bannedAt: Date.now(),
      bannedAtGMT: bannedAtGMT2,
      gc: chatId,
      gcName: gcName2,
      reason: reason
    };
    
    saveDatabase();
    
    await sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 USER BANNED 🚫
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User: @${targetId.split('@')[0]} (${targetName})
📝 Reason: ${reason}
👮 Banned by: @${sender.split('@')[0]}
📍 GC: ${gcName2} (${chatId})
🕒 Time (GMT): ${bannedAtGMT2}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
This user can no longer use the bot.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [targetId, sender]
    }, { quoted: msg });
    
    // Notify banned user
    try {
      await sock.sendMessage(targetId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 YOU HAVE BEEN BANNED 🚫
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Reason: ${reason}
👮 Banned by: Admin
━━━━━━━━━━━━━━━━━━━━━━━━━━━
You can no longer use bot commands.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      });
    } catch (e) {
      console.log('Could not notify banned user');
    }
  }
};