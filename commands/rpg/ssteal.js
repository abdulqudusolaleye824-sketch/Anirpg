// ═══════════════════════════════════════════════════════════════
// SSTEAL — Sticker theft command
// ═══════════════════════════════════════════════════════════════

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { writeStickerMetadata } = require('../../utils/stickerMetadata');

const cooldowns = new Map();

module.exports = {
  name: 'ssteal',
  aliases: ['stickersteal'],
  description: 'Reply to a sticker to steal it.',
  usage: '/ssteal',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    const now = Date.now();
    const last = cooldowns.get(sender) || 0;
    if (now - last < 5000) {
      const remaining = Math.ceil((5000 - (now - last)) / 1000);
      return sock.sendMessage(chatId, {
        text: `⏳ Wait *${remaining}s* before stealing another sticker.`
      }, { quoted: msg });
    }

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted || !quoted.stickerMessage) {
      return sock.sendMessage(chatId, {
        text: '📌 *Reply to a sticker* to steal it using `/ssteal`.\n\nTo steal Nexus from a player, use `/steal @user` or `/rob @user`.'
      }, { quoted: msg });
    }

    try {
      cooldowns.set(sender, now);
      const packName = msg.pushName ? `${msg.pushName}'s Pack` : '✦ 𝐀𝐬𝐭𝐫𝐚™';
      const author   = '✦ 𝐀stra™ Bot';

      const buffer = await downloadMediaMessage(
        { message: quoted, key: msg.message.extendedTextMessage.contextInfo.stanzaId },
        'buffer',
        {}
      );

      if (!buffer || buffer.length === 0) {
        return sock.sendMessage(chatId, {
          text: '❌ Couldn\'t download that sticker. It may have expired.'
        }, { quoted: msg });
      }

      const rebrandedWebp = await writeStickerMetadata(buffer, packName, author);
      await sock.sendMessage(chatId, { sticker: rebrandedWebp }, { quoted: msg });

    } catch (err) {
      console.error('ssteal error:', err.message);
      await sock.sendMessage(chatId, {
        text: `❌ Error stealing sticker: ${err.message}`
      }, { quoted: msg });
    }
  }
};
