const path  = require('path');
const fs    = require('fs');
const os    = require('os');
let sharp; try { sharp = require('sharp'); } catch(e) { sharp = null; }
const { generateQuoteSticker } = require('../../utils/generateQuoteSticker');

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

    const now = Date.now();
    if (COOLDOWNS.has(sender) && now - COOLDOWNS.get(sender) < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - COOLDOWNS.get(sender))) / 1000);
      return sock.sendMessage(chatId, { text: `⏳ Slow down. Wait *${remaining}s* before another quote sticker.` }, { quoted: msg });
    }
    COOLDOWNS.set(sender, now);

    const quoted = msg.message?.extendedTextMessage?.contextInfo;
    if (!quoted || !quoted.quotedMessage) {
      return sock.sendMessage(chatId, { text: '📌 *Reply to a message* to turn it into a quote sticker.\nUsage: /q (reply to someone\'s text)' }, { quoted: msg });
    }

    const quotedMsg = quoted.quotedMessage;
    const quoteText =
      quotedMsg.conversation ||
      quotedMsg.extendedTextMessage?.text ||
      quotedMsg.imageMessage?.caption ||
      quotedMsg.videoMessage?.caption ||
      null;

    if (!quoteText || quoteText.trim().length === 0) {
      return sock.sendMessage(chatId, { text: '❌ No readable text in the quoted message.' }, { quoted: msg });
    }

    const quotedParticipant = quoted.participant || quoted.remoteJid || 'Unknown';
    const quotedNumStr = quotedParticipant.replace(/[^0-9]/g, '');
    let senderName = 'Unknown';

    // 1. pushName directly from quoted context (most reliable)
    if (quoted.pushName) senderName = quoted.pushName;

    // 2. RPG database name
    if (senderName === 'Unknown' && db?.users?.[quotedParticipant]?.name) {
      senderName = db.users[quotedParticipant].name;
    }

    // 3. Baileys contact store (works in DMs)
    if (senderName === 'Unknown') {
      const contact = sock.store?.contacts?.[quotedParticipant] || sock.contacts?.[quotedParticipant];
      if (contact?.pushName) senderName = contact.pushName;
      else if (contact?.name) senderName = contact.name;
      else if (contact?.notify) senderName = contact.notify;
    }

    // 4. Group metadata
    if (senderName === 'Unknown' && chatId.endsWith('@g.us')) {
      try {
        const meta = await sock.groupMetadata(chatId).catch(() => null);
        if (meta) {
          const p = meta.participants.find(p => p.id && p.id.includes(quotedNumStr));
          if (p?.pushName) senderName = p.pushName;
          else if (p?.name) senderName = p.name;
        }
      } catch (e) {}
    }

    // 4. Fall back to phone number
    if (senderName === 'Unknown' && quotedNumStr) senderName = '+' + quotedNumStr;

    const tmpPath = path.join(os.tmpdir(), `quote_${Date.now()}.png`);
    await sock.sendMessage(chatId, { react: { text: '🎨', key: msg.key } });

    try {
      await generateQuoteSticker(senderName, quoteText, tmpPath);
    } catch (err) {
      console.error('Quote sticker error:', err.message);
      await sock.sendMessage(chatId, { text: '❌ Failed to generate sticker. Make sure `canvas` is installed.' }, { quoted: msg });
      return;
    }

    if (!fs.existsSync(tmpPath)) return;

    const stickerBuffer = await sharp(fs.readFileSync(tmpPath))
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 95 })
      .toBuffer();

    await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: msg });

    try { fs.unlinkSync(tmpPath); } catch (e) {}
  }
};
