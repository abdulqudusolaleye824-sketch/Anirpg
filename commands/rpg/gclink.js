// /gclink — Send this group's LIVE invite link + group photo.
// Needs the bot to be a group admin (WhatsApp only lets admins read links).

'use strict';

module.exports = {
  name: 'gclink',
  aliases: ['grouplink', 'invitelink'],
  description: '🔗 This group\'s live invite link + photo (needs bot admin)',
  usage: '/gclink',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    if (!chatId || !chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ Use /gclink inside a group.' }, { quoted: msg });
    }

    let meta = null;
    try { meta = await sock.groupMetadata(chatId); } catch (e) { meta = null; }
    if (!meta) {
      return sock.sendMessage(chatId, { text: '❌ Could not read group info. Try again.' }, { quoted: msg });
    }

    const botPhone = (sock.user?.id || '').split(':')[0].split('@')[0];
    const botPart = (meta.participants || []).find(
      (p) => String(p.id || '').split(':')[0].split('@')[0] === botPhone
    );
    if (!botPart || !['admin', 'superadmin'].includes(botPart.admin)) {
      return sock.sendMessage(chatId, { text: '❌ I need to be a group admin to fetch the invite link.' }, { quoted: msg });
    }

    let code = null;
    try {
      if (typeof sock.groupInviteCode === 'function') code = await sock.groupInviteCode(chatId);
    } catch (e) { code = null; }
    if (!code) {
      return sock.sendMessage(chatId, { text: '❌ Could not fetch the invite link. Try again later.' }, { quoted: msg });
    }

    const caption = `🔗 *${meta.subject || 'Group invite'}*\nhttps://chat.whatsapp.com/${code}`;
    try {
      if (typeof sock.profilePictureUrl === 'function') {
        const url = await sock.profilePictureUrl(chatId, 'image');
        if (url) return sock.sendMessage(chatId, { image: { url }, caption }, { quoted: msg });
      }
    } catch (e) { /* fall through to link-only */ }
    return sock.sendMessage(chatId, { text: caption }, { quoted: msg });
  },
};
