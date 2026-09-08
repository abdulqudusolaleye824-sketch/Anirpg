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

function extractContextAndQuoted(msg) {
  if (!msg || !msg.message) return { contextInfo: null, quoted: null };

  const message = msg.message;
  const contextInfo =
    message.extendedTextMessage?.contextInfo ||
    message.imageMessage?.contextInfo ||
    message.videoMessage?.contextInfo ||
    message.stickerMessage?.contextInfo ||
    message.templateButtonReplyMessage?.contextInfo ||
    message.buttonsResponseMessage?.contextInfo ||
    message.interactiveResponseMessage?.contextInfo ||
    message.ephemeralMessage?.message?.extendedTextMessage?.contextInfo ||
    message.viewOnceMessage?.message?.imageMessage?.contextInfo ||
    message.viewOnceMessageV2?.message?.imageMessage?.contextInfo;

  if (!contextInfo || !contextInfo.quotedMessage) {
    return { contextInfo: null, quoted: null };
  }

  let quoted = contextInfo.quotedMessage;
  while (quoted) {
    if (quoted.ephemeralMessage?.message) quoted = quoted.ephemeralMessage.message;
    else if (quoted.viewOnceMessage?.message) quoted = quoted.viewOnceMessage.message;
    else if (quoted.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;
    else if (quoted.documentWithCaptionMessage?.message) quoted = quoted.documentWithCaptionMessage.message;
    else break;
  }

  return { contextInfo, quoted };
}

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

    const { contextInfo, quoted } = extractContextAndQuoted(msg);
    const stickerMsg = quoted?.stickerMessage;
    const imageMsg   = quoted?.imageMessage || msg.message?.imageMessage;
    const videoMsg   = quoted?.videoMessage || msg.message?.videoMessage;

    if (!quoted && !imageMsg && !videoMsg) {
      return sock.sendMessage(chatId, {
        text: '📌 *Reply to a sticker, image, or GIF/video* with `/steal` or `/s` to steal it into your pack.\n\nUsage: `/s My Pack | My Author`\n*(To steal Nexus from a player, use `/rob @user`)*'
      }, { quoted: msg });
    }

    const db = getDatabase();
    const ownerName = db?.users?.[sender]?.name || msg.pushName || 'Senku';

    const rawText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || '')
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
            id: contextInfo?.stanzaId,
            participant: contextInfo?.participant
          }
        };
        buffer = await downloadMediaMessage(mediaMsg, 'buffer', {});
      } else if (imageMsg || videoMsg) {
        const targetNode = imageMsg ? imageMsg : videoMsg;
        const mediaMsg = quoted ? {
          message: quoted,
          key: {
            remoteJid: chatId,
            id: contextInfo?.stanzaId,
            participant: contextInfo?.participant
          }
        } : msg;

        const mediaBuf = await downloadMediaMessage(mediaMsg, 'buffer', {});
        if (mediaBuf && sharp) {
          try {
            buffer = await sharp(mediaBuf, { animated: !!videoMsg })
              .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
              .webp({ quality: 90 })
              .toBuffer();
          } catch(e) {
            buffer = mediaBuf;
          }
        } else {
          buffer = mediaBuf;
        }
      }

      if (!buffer || buffer.length === 0) {
        return sock.sendMessage(chatId, {
          text: '❌ Couldn\'t download that media. It may have expired.'
        }, { quoted: msg });
      }

      const rebrandedWebp = await injectStickerMetadata(buffer, packName, author);

      let isAnim = false;
      try {
        const webpmux = require('node-webpmux');
        const img = new webpmux.Image();
        await img.load(rebrandedWebp);
        isAnim = img.hasAnim || false;
      } catch (e) {}

      await sock.sendMessage(chatId, {
        sticker: rebrandedWebp,
        isAnimated: isAnim
      }, { quoted: msg });

    } catch (err) {
      console.error('steal sticker error:', err.message);
      await sock.sendMessage(chatId, {
        text: `❌ Error stealing sticker: ${err.message}`
      }, { quoted: msg });
    }
  }
};
