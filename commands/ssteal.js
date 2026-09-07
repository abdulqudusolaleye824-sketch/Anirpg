/**
 * /ssteal — Reply to a sticker to steal it and resend as yours
 * /ssteal | packname | author  — also rename the sticker
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const COOLDOWNS   = new Map();
const COOLDOWN_MS = 5000;

// Default pack info
const DEFAULT_PACK   = 'Stolen 😈';
const DEFAULT_AUTHOR = 'QuoteBot';

module.exports = {
  name: 'ssteal',
  aliases: ['steal'],
  description: 'Reply to a sticker to steal it. Optionally rename: /ssteal | packname | author',
  usage: '/ssteal | [packName] | [author]',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const db = getDatabase();
    const chatId = msg.key.remoteJid;

    // ── Cooldown ────────────────────────────────────────────────
    const now = Date.now();
    if (COOLDOWNS.has(sender) && now - COOLDOWNS.get(sender) < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - COOLDOWNS.get(sender))) / 1000);
      return sock.sendMessage(chatId, {
        text: `⏳ Wait *${remaining}s* before stealing another sticker.`
      }, { quoted: msg });
    }
    COOLDOWNS.set(sender, now);

    // ── Parse custom name/author from args ──────────────────────
    // Format: /ssteal | packname | author
    const rawArgs = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').split('|').map(s => s.trim());
    let packName   = rawArgs[1] || DEFAULT_PACK;
    let packAuthor = rawArgs[2] || DEFAULT_AUTHOR;

    // ── Must be a reply to a sticker ───────────────────────────
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (!contextInfo || !contextInfo.quotedMessage) {
      return sock.sendMessage(chatId, {
        text: '📌 *Reply to a sticker* to steal it.\n\nUsage:\n`/ssteal` — steal as-is\n`/ssteal | packname | author` — steal with custom name'
      }, { quoted: msg });
    }

    const quotedMsg = contextInfo.quotedMessage;
    const isStickerMsg = !!quotedMsg.stickerMessage;

    if (!isStickerMsg) {
      return sock.sendMessage(chatId, {
        text: '❌ That\'s not a sticker. Reply to a *sticker message* to steal it.'
      }, { quoted: msg });
    }

    // ── Download the sticker ─────────────────────────────────────
    try {
      await sock.sendMessage(chatId, { react: { text: '🎭', key: msg.key } });

      // Re-construct quoted message context to download
      const stickerInfo = quotedMsg.stickerMessage;
      const participant  = contextInfo.participant || contextInfo.remoteJid || chatId;

      // Build a fake message object for downloading
      const fakeMsg = {
        key: {
          remoteJid: chatId,
          id: contextInfo.stanzaId,
          participant: participant,
        },
        message: { stickerMessage: stickerInfo }
      };

      let buffer;
      try {
        const stream = await sock.downloadMediaMessage(fakeMsg);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        buffer = Buffer.concat(chunks);
      } catch (dlErr) {
        console.error('Sticker download error:', dlErr.message);
        return sock.sendMessage(chatId, {
          text: '❌ Couldn\'t download that sticker. It may have expired.'
        }, { quoted: msg });
      }

      if (!buffer || buffer.length === 0) {
        return sock.sendMessage(chatId, {
          text: '❌ Sticker download returned empty data.'
        }, { quoted: msg });
      }

      // ── Resend as sticker with new name ────────────────────────
      await sock.sendMessage(chatId, {
        sticker: buffer,
        mimetype: 'image/webp',
        stickerName: packName,
        stickerAuthor: packAuthor,
      }, { quoted: msg });

    } catch (err) {
      console.error('ssteal error:', err.message);
      return sock.sendMessage(chatId, {
        text: `❌ Error stealing sticker: ${err.message}`
      }, { quoted: msg });
    }
  }
};
