// ═══════════════════════════════════════════════════════════════
// STEAL COMMAND — Sticker Theft
// Reply to a sticker to steal it and re-brand EXIF metadata.
// Usage: /steal  OR  /steal | [packName] | [author]
// ═══════════════════════════════════════════════════════════════

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { writeStickerMetadata, injectStickerMetadata } = require('../../utils/stickerMetadata');

const cooldowns = new Map();

module.exports = {
  name: 'steal',
  aliases: ['ssteal', 'stickersteal'],
  description: 'Reply to a sticker to steal it into your pack. Rename with /steal | [packName] | [author]',
  usage: '/steal | [packName] | [author]',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    const now = Date.now();
    const last = cooldowns.get(sender) || 0;
    if (now - last < 3000) {
      const remaining = Math.ceil((3000 - (now - last)) / 1000);
      return sock.sendMessage(chatId, {
        text: `⏳ Wait *${remaining}s* before stealing another sticker.`
      }, { quoted: msg });
    }

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;
    const stickerMsg = quoted?.stickerMessage;

    if (!quoted || !stickerMsg) {
      return sock.sendMessage(chatId, {
        text: '📌 *Reply to a sticker* to steal it using `/steal`.\n\nUsage:\n`/steal` — steal sticker as-is\n`/steal | packname | author` — steal with custom name\n\n*(To steal Nexus from a player, use `/rob @user`)*'
      }, { quoted: msg });
    }

    const rawText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').replace(/^\/(steal|ssteal)\s*/i, '').trim();
    const parts = rawText.split('|').map(p => p.trim()).filter(Boolean);

    let packName = parts[0] || (msg.pushName ? `${msg.pushName}'s Pack` : '✦ 𝐀𝐬𝐭𝐫𝐚™');
    let author   = parts[1] || '✦ 𝐀stra™ Bot';

    try {
      cooldowns.set(sender, now);

      const mediaMsg = {
        message: quoted,
        key: {
          remoteJid: chatId,
          id: contextInfo.stanzaId,
          participant: contextInfo.participant
        }
      };

      const buffer = await downloadMediaMessage(mediaMsg, 'buffer', {});

      if (!buffer || buffer.length === 0) {
        return sock.sendMessage(chatId, {
          text: '❌ Couldn\'t download that sticker. It may have expired.'
        }, { quoted: msg });
      }

      const stickerFunction = writeStickerMetadata || injectStickerMetadata;
      const rebrandedWebp = stickerFunction(buffer, packName, author);

      await sock.sendMessage(chatId, { sticker: rebrandedWebp }, { quoted: msg });

    } catch (err) {
      console.error('steal sticker error:', err.message);
      await sock.sendMessage(chatId, {
        text: `❌ Error stealing sticker: ${err.message}`
      }, { quoted: msg });
    }
  }
};
