// Push #36: /getpp — PRO players: reply to a member to fetch their profile pic.
'use strict';
const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'getpp',
  aliases: ['pp', 'getpic', 'fetchpp'],
  description: 'Pro: fetch the profile picture of the member you reply to.',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];
    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ Register first! /register' }, { quoted: msg });
    }
    if (!UI.isPro(player)) {
      return sock.sendMessage(chatId, { text: `🔒 *PRO ONLY*\n\n/getpp is a Pro feature.\n${UI.upsell()}` }, { quoted: msg });
    }
    const target = msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (!target) {
      return sock.sendMessage(chatId, { text: '❌ Reply to a member\'s message with */getpp* to fetch their profile picture.' }, { quoted: msg });
    }
    if (typeof sock.profilePictureUrl !== 'function') {
      return sock.sendMessage(chatId, { text: '❌ Profile lookup not available on this bot.' }, { quoted: msg });
    }
    let url;
    try {
      url = await sock.profilePictureUrl(target, 'image');
    } catch (e) {
      const code = e?.output?.statusCode || e?.statusCode;
      if (code === 404) return sock.sendMessage(chatId, { text: '👤 That member has no profile picture.' }, { quoted: msg });
      if (code === 401 || code === 403) return sock.sendMessage(chatId, { text: '🔒 That profile picture is private.' }, { quoted: msg });
      return sock.sendMessage(chatId, { text: '❌ Could not fetch that profile picture.' }, { quoted: msg });
    }
    if (!url) {
      return sock.sendMessage(chatId, { text: '👤 That member has no profile picture.' }, { quoted: msg });
    }
    const bare = String(target).split('@')[0].split(':')[0];
    return sock.sendMessage(chatId, { image: { url }, caption: `🖼️ @${bare}`, mentions: [target] }, { quoted: msg });
  },
};
