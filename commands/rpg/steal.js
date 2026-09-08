// ═══════════════════════════════════════════════════════════════
// STEAL COMMAND — Sticker Theft & Rebranding
// Reply to a sticker or image with /steal or /s to steal it into your own pack.
// Default: Pack Name: ✦ 𝐀𝐬𝐭𝐫𝐚™ | Author: owner/user name
// Custom: /steal My Pack | My Author  or /s My Pack | My Author
// ═══════════════════════════════════════════════════════════════

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { injectStickerMetadata } = require('../../utils/stickerMetadata');
let sharp; try { sharp = require('sharp'); } catch(e) { sharp = null; }

const cooldowns = new Map();

module.exports = {
  name: 'steal',
  aliases: ['s', 'ssteal', 'stickersteal', 'stealsticker'],
  description: 'Reply to a sticker or image with /steal [pack | author] or /s [pack | author] to steal it.',
  usage: '/steal [packName | authorName] or /s [packName | authorName]',

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
    const imageMsg = quoted?.imageMessage || msg.message?.imageMessage;

    if (!quoted && !imageMsg) {
      return sock.sendMessage(chatId, {
        text: '📌 *Reply to a sticker or image* with `/steal` or `/s` to steal it into your pack.\n\nUsage: `/s My Pack | My Author`\n*(To steal Nexus from a player, use `/rob @user`)*'
      }, { quoted: msg });
    }

    const db = getDatabase();
    const ownerName = db?.users?.[sender]?.name || msg.pushName || 'Senku';

    const rawText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '')
      .replace(/^\/(steal|ssteal|stickersteal|stealsticker|s)\s*/i, '')
      .trim();

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
      cooldowns.set(sender, now);

      let buffer = null;

      if (stickerMsg) {
        const mediaMsg = {
          message: quoted,
          key: {
            remoteJid: chatId,
            id: contextInfo.stanzaId,
            participant: contextInfo.participant
          }
        };
        const downloadedBuf = await downloadMediaMessage(mediaMsg, 'buffer', {});
        // Re-process WebP with sharp to strip previous EXIF/author metadata before injecting new EXIF
        if (downloadedBuf && sharp) {
          try {
            buffer = await sharp(downloadedBuf)
              .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
              .webp({ quality: 95 })
              .toBuffer();
          } catch(e) {
            buffer = downloadedBuf;
          }
        } else {
          buffer = downloadedBuf;
        }
      } else if (imageMsg) {
        const mediaMsg = quoted ? {
          message: quoted,
          key: {
            remoteJid: chatId,
            id: contextInfo.stanzaId,
            participant: contextInfo.participant
          }
        } : msg;
        const imgBuf = await downloadMediaMessage(mediaMsg, 'buffer', {});
        if (imgBuf && sharp) {
          buffer = await sharp(imgBuf)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 95 })
            .toBuffer();
        } else {
          buffer = imgBuf;
        }
      }

      if (!buffer || buffer.length === 0) {
        return sock.sendMessage(chatId, {
          text: '❌ Couldn\'t download that media. It may have expired.'
        }, { quoted: msg });
      }

      const rebrandedWebp = await injectStickerMetadata(buffer, packName, author);

      await sock.sendMessage(chatId, { sticker: rebrandedWebp }, { quoted: msg });

    } catch (err) {
      console.error('steal sticker error:', err.message);
      await sock.sendMessage(chatId, {
        text: `❌ Error stealing sticker: ${err.message}`
      }, { quoted: msg });
    }
  }
};
