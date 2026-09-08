// ═══════════════════════════════════════════════════════════════
// /ssteal — Reply to a sticker to steal it and resend as yours
// /ssteal | packname | author  — also rename the sticker
// ═══════════════════════════════════════════════════════════════

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { writeStickerMetadata, getMetadata } = require('../utils/stickerMetadata');

const cooldowns = new Map();

module.exports = {
  name: 'ssteal',
  aliases: ['stickersteal'],
  description: 'Reply to a sticker to steal it. Optionally rename: /ssteal | [packName] | [author]',
  usage: '/ssteal | [packName] | [author]',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    // ── Cooldown check (5s) ──────────────────────────────────────────────────
    const now = Date.now();
    const last = cooldowns.get(sender) || 0;
    if (now - last < 5000) {
      const remaining = Math.ceil((5000 - (now - last)) / 1000);
      return sock.sendMessage(chatId, {
        text: `⏳ Wait *${remaining}s* before stealing another sticker.`
      }, { quoted: msg });
    }

    // ── Parse optional custom pack / author ──────────────────────────────────
    // Format: /ssteal | packname | author
    const rawText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').replace(/^\/ssteal\s*/i, '').trim();
    const parts = rawText.split('|').map(p => p.trim()).filter(Boolean);

    let packName = parts[0] || (msg.pushName ? `${msg.pushName}'s Pack` : '✦ 𝐀𝐬𝐭𝐫𝐚™');
    let author   = parts[1] || '✦ 𝐀stra™ Bot';

    // ── Must reply to a message ──────────────────────────────────────────────
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
      return sock.sendMessage(chatId, {
        text: '📌 *Reply to a sticker* to steal it.\n\nUsage:\n`/ssteal` — steal as-is\n`/ssteal | packname | author` — steal with custom name'
      }, { quoted: msg });
    }

    // ── Check if quoted is a sticker ─────────────────────────────────────────
    const stickerMsg = quoted.stickerMessage;
    if (!stickerMsg) {
      return sock.sendMessage(chatId, {
        text: '❌ That\'s not a sticker. Reply to a *sticker message* to steal it.'
      }, { quoted: msg });
    }

    try {
      cooldowns.set(sender, now);

      // Download raw WebP buffer from Baileys
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

      // Re-inject EXIF metadata into the WebP buffer
      const rebrandedWebp = await writeStickerMetadata(buffer, packName, author);

      // Send rebranded sticker
      await sock.sendMessage(chatId, { sticker: rebrandedWebp }, { quoted: msg });

    } catch (err) {
      console.error('ssteal error:', err.message);
      await sock.sendMessage(chatId, {
        text: `❌ Error stealing sticker: ${err.message}`
      }, { quoted: msg });
    }
  }
};
