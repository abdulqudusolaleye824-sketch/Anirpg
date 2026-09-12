// /gclink — Send this group's LIVE invite link + group photo.
// Needs the bot to be a group admin (WhatsApp only lets admins read links).

'use strict';

const GroupAdmin = require('../../rpg/utils/GroupAdmin');

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

    // Same bot-admin system as /open (JID + LID aware) — no more false
    // "not admin" when the participant list uses LID entries.
    const gate = await GroupAdmin.requireBotAdmin(sock, chatId);
    if (!gate.ok) {
      const text = gate.reason === 'meta'
        ? '❌ Could not read group info. Try again.'
        : gate.reason === 'bot-not-admin'
          ? '❌ I need to be a group admin to fetch the invite link.'
          : '❌ Use /gclink inside a group.';
      return sock.sendMessage(chatId, { text }, { quoted: msg });
    }
    const meta = gate.meta;

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
