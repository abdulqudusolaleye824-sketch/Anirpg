// Push #36: /setpp — mods+ set the ACTIVE bot's profile picture.
// Reply to an image with /setpp, or send an image with /setpp as its caption
// (caption-commands are parsed by rpgCommandHandler).
'use strict';
const Perms = require('../../utils/permissions');

let _dl = null;
function getDownloader() {
  if (!_dl) {
    try { ({ downloadMediaMessage: _dl } = require('@whiskeysockets/baileys')); }
    catch { _dl = null; }
  }
  return _dl;
}

module.exports = {
  name: 'setpp',
  aliases: ['setbotpp', 'botpp'],
  description: "Mods: set this bot's profile picture (reply to an image, or caption one).",
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, { text: '🔒 Mods only.' }, { quoted: msg });
    }
    const downloadMediaMessage = getDownloader();
    if (!downloadMediaMessage) {
      return sock.sendMessage(chatId, { text: '❌ Media download module not available.' }, { quoted: msg });
    }
    const currentImg = msg.message?.imageMessage;
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;
    const quotedImg = quoted?.imageMessage;
    let target = null;
    if (currentImg) {
      target = { key: msg.key, message: msg.message };
    } else if (quotedImg) {
      target = {
        key: { remoteJid: chatId, id: ctx.stanzaId, participant: ctx.participant },
        message: quoted,
      };
    }
    if (!target) {
      return sock.sendMessage(chatId, {
        text: '❌ No image found.\n\n📌 Reply to an image with */setpp*\n(or send an image with */setpp* as its caption).',
      }, { quoted: msg });
    }
    let buf;
    try {
      buf = await downloadMediaMessage(target, 'buffer', {});
    } catch (e) {
      return sock.sendMessage(chatId, { text: `❌ Could not download the image: ${e.message}` }, { quoted: msg });
    }
    if (!buf || buf.length === 0) {
      return sock.sendMessage(chatId, { text: '❌ Could not download the image (empty).' }, { quoted: msg });
    }
    const botJid = String(sock.user?.id || '').replace(/:\d+@/, '@'); // strip :device, keep domain
    if (!botJid || typeof sock.updateProfilePicture !== 'function') {
      return sock.sendMessage(chatId, { text: '❌ This bot cannot update its picture right now.' }, { quoted: msg });
    }
    try {
      try {
        await sock.updateProfilePicture(botJid, { img: buf });
      } catch (e1) {
        await sock.updateProfilePicture(botJid, buf); // fallback form
      }
    } catch (e) {
      return sock.sendMessage(chatId, { text: `❌ Profile update failed: ${e.message}` }, { quoted: msg });
    }
    return sock.sendMessage(chatId, { text: '✅ *Bot profile picture updated!* 🖼️' }, { quoted: msg });
  },
};
