const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { injectStickerMetadata } = require('../../utils/stickerMetadata');
let sharp; try { sharp = require('sharp'); } catch(e) { sharp = null; }

module.exports = {
  name: 'sticker',
  aliases: ['st'],
  description: '🎨 Convert image/video/sticker to sticker with metadata',
  usage: '/sticker [packName | authorName]',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const ownerName = db?.users?.[sender]?.name || msg.pushName || 'Senku';

    const rawText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').replace(/^\/(sticker|st|s)\s*/i, '').trim();

    let packName = '✦ 𝐀𝐬𝐭𝐫𝐚™';
    let author   = ownerName;

    if (rawText) {
      if (rawText.includes('|')) {
        const parts = rawText.split('|').map(p => p.trim());
        packName = parts[0] || '✦ 𝐀𝐬𝐭𝐫𝐚™';
        author   = parts[1] || ownerName;
      } else {
        packName = rawText;
        author   = ownerName;
      }
    }

    try {
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const imageMessage = msg.message?.imageMessage;
      const videoMessage = msg.message?.videoMessage;
      const quotedImage = quotedMsg?.imageMessage;
      const quotedVideo = quotedMsg?.videoMessage;
      const quotedSticker = quotedMsg?.stickerMessage;

      let mediaMessage = null;

      if (imageMessage || videoMessage) {
        mediaMessage = msg;
      } else if (quotedImage || quotedVideo || quotedSticker) {
        mediaMessage = {
          key: msg.message.extendedTextMessage.contextInfo.stanzaId ? {
            remoteJid: chatId,
            id: msg.message.extendedTextMessage.contextInfo.stanzaId,
            participant: msg.message.extendedTextMessage.contextInfo.participant
          } : msg.key,
          message: quotedMsg
        };
      }

      if (!mediaMessage) {
        return sock.sendMessage(chatId, {
          text: `❌ No media found!

📌 *HOW TO USE:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ Send an image with caption: /sticker
2️⃣ Reply to an image/sticker with: /sticker or /s

💡 Custom pack name: /s My Pack | My Name
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      const isVideo = videoMessage || quotedVideo;
      if (isVideo) {
        return sock.sendMessage(chatId, {
          text: `⚠️ Video/GIF stickers require ffmpeg. Try with a regular image!`
        }, { quoted: msg });
      }

      const buffer = await downloadMediaMessage(mediaMessage, 'buffer', {}, { logger: console, reuploadRequest: sock.updateMediaMessage });

      if (!buffer || buffer.length === 0) {
        throw new Error('Failed to download media - empty buffer');
      }

      if (buffer.length > 1024 * 1024) {
        return sock.sendMessage(chatId, {
          text: `❌ File too large! Max size: 1 MB.`
        }, { quoted: msg });
      }

      let processedBuffer = buffer;
      if (!quotedSticker && sharp) {
        processedBuffer = await sharp(buffer)
          .resize(512, 512, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .webp({ quality: 95, lossless: false })
          .toBuffer();
      }

      processedBuffer = await injectStickerMetadata(processedBuffer, packName, author);

      await sock.sendMessage(chatId, { sticker: processedBuffer }, { quoted: msg });

    } catch (error) {
      console.error('❌ Sticker creation error:', error);
      return sock.sendMessage(chatId, {
        text: `❌ Sticker creation failed: ${error.message}`
      }, { quoted: msg });
    }
  }
};
