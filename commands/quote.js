/**
 * /q | /quote — Reply to any message to turn it into a quote sticker
 * Generates a dark-themed 512x512 WebP sticker with the sender's name and profile picture
 */

const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { generateQuoteSticker } = require('../utils/generateQuoteSticker');

const COOLDOWNS   = new Map();
const COOLDOWN_MS = 8000;

module.exports = {
  name: 'quote',
  aliases: ['q'],
  description: 'Reply to a message to turn it into a quote sticker',
  usage: '/q (reply to a message)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const db = getDatabase();
    const chatId = msg.key.remoteJid;

    // ── Cooldown ────────────────────────────────────────────────
    const now = Date.now();
    if (COOLDOWNS.has(sender) && now - COOLDOWNS.get(sender) < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - COOLDOWNS.get(sender))) / 1000);
      return sock.sendMessage(chatId, {
        text: `⏳ Slow down. Wait *${remaining}s* before another quote sticker.`
      }, { quoted: msg });
    }
    COOLDOWNS.set(sender, now);

    // ── Must be a reply ─────────────────────────────────────────
    const quoted = msg.message?.extendedTextMessage?.contextInfo;
    if (!quoted || !quoted.quotedMessage) {
      return sock.sendMessage(chatId, {
        text: '📌 *Reply to a message* to turn it into a quote sticker.\nUsage: /q (reply to someone\'s text)'
      }, { quoted: msg });
    }

    // ── Extract text from quoted message ────────────────────────
    const quotedMsg = quoted.quotedMessage;
    const quoteText =
      quotedMsg.conversation ||
      quotedMsg.extendedTextMessage?.text ||
      quotedMsg.imageMessage?.caption ||
      quotedMsg.videoMessage?.caption ||
      quotedMsg.buttonsResponseMessage?.selectedDisplayText ||
      null;

    if (!quoteText || quoteText.trim().length === 0) {
      return sock.sendMessage(chatId, {
        text: '❌ Can\'t make a sticker out of that — no readable text in the quoted message.'
      }, { quoted: msg });
    }

    // ── Get sender's display name ────────────────────────────────
    const quotedParticipant = quoted.participant || quoted.remoteJid || 'Unknown';
    const quotedNumStr = quotedParticipant.replace(/[^0-9]/g, '');

    let senderName = 'Unknown';

    if (quoted.pushName) senderName = quoted.pushName;

    if (senderName === 'Unknown' && db?.users?.[quotedParticipant]?.name) {
      senderName = db.users[quotedParticipant].name;
    }

    if (senderName === 'Unknown') {
      try {
        const meta = await sock.groupMetadata(chatId).catch(() => null);
        if (meta) {
          const participant = meta.participants.find(p =>
            p.id && p.id.includes(quotedNumStr)
          );
          if (participant?.pushName) senderName = participant.pushName;
          else if (participant?.name)  senderName = participant.name;
          else if (participant?.notify) senderName = participant.notify;
        }
      } catch (e) {}
    }

    if (senderName === 'Unknown' && quotedNumStr) {
      senderName = '+' + quotedNumStr;
    }

    // ── Profile Picture ─────────────────────────────────────────
    let avatarPath = null;
    try {
      const pfpUrl = await sock.profilePictureUrl(quotedParticipant, 'image').catch(() => null);
      if (pfpUrl) {
        const res = await fetch(pfpUrl);
        if (res && res.ok) {
          avatarPath = path.join(os.tmpdir(), `quote_av_${Date.now()}.jpg`);
          const arrBuf = await res.arrayBuffer();
          fs.writeFileSync(avatarPath, Buffer.from(arrBuf));
        }
      }
    } catch (e) { avatarPath = null; }

    // ── Generate sticker ─────────────────────────────────────────
    const tmpPath = path.join(os.tmpdir(), `quote_${Date.now()}.webp`);

    await sock.sendMessage(chatId, { react: { text: '🎨', key: msg.key } });

    try {
      await generateQuoteSticker(senderName, quoteText, tmpPath, avatarPath);
    } catch (err) {
      console.error('Quote sticker error:', err.message);
      await sock.sendMessage(chatId, {
        text: '❌ Failed to generate sticker.'
      }, { quoted: msg });
      if (avatarPath) { try { fs.unlinkSync(avatarPath); } catch (e) {} }
      return;
    }

    if (!fs.existsSync(tmpPath)) {
      if (avatarPath) { try { fs.unlinkSync(avatarPath); } catch (e) {} }
      return;
    }

    const stickerBuffer = fs.readFileSync(tmpPath);

    await sock.sendMessage(chatId, {
      sticker: stickerBuffer,
      mimetype: 'image/webp',
    }, { quoted: msg });

    try { fs.unlinkSync(tmpPath); } catch (e) {}
    if (avatarPath) { try { fs.unlinkSync(avatarPath); } catch (e) {} }
  }
};
