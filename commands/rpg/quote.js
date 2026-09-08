const path  = require('path');
const fs    = require('fs');
const os    = require('os');
let sharp; try { sharp = require('sharp'); } catch(e) { sharp = null; }
const { generateQuoteSticker } = require('../../utils/generateQuoteSticker');
const { injectStickerMetadata } = require('../../utils/stickerMetadata');

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

    if (quoted.pushName) senderName = quoted.pushName;

    if (senderName === 'Unknown' && db?.users?.[quotedParticipant]?.name) {
      senderName = db.users[quotedParticipant].name;
    }

    if (senderName === 'Unknown') {
      const contact = sock.store?.contacts?.[quotedParticipant] || sock.contacts?.[quotedParticipant];
      if (contact?.pushName) senderName = contact.pushName;
      else if (contact?.name) senderName = contact.name;
      else if (contact?.notify) senderName = contact.notify;
    }

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

    if (senderName === 'Unknown' && quotedNumStr) senderName = '+' + quotedNumStr;

    let avatarPath = null;
    try {
      const profileUrl = await sock.profilePictureUrl(quotedParticipant, 'image');
      if (profileUrl) {
        const res = await fetch(profileUrl);
        if (res && res.ok) {
          avatarPath = path.join(os.tmpdir(), `quote_av_${Date.now()}.jpg`);
          fs.writeFileSync(avatarPath, Buffer.from(await res.arrayBuffer()));
        }
      }
    } catch (e) { avatarPath = null; }

    const tmpPath = path.join(os.tmpdir(), `quote_${Date.now()}.webp`);
    await sock.sendMessage(chatId, { react: { text: '🎨', key: msg.key } });

    try {
      await generateQuoteSticker(senderName, quoteText, tmpPath, avatarPath);
    } catch (err) {
      console.error('Quote sticker error:', err.message);
      await sock.sendMessage(chatId, { text: '❌ Failed to generate sticker.' }, { quoted: msg });
      return;
    }

    if (!fs.existsSync(tmpPath)) return;

    const rawBuffer = fs.readFileSync(tmpPath);
    const stickerBuffer = await injectStickerMetadata(rawBuffer, 'quotly by ✦ 𝐀𝐬𝐭𝐫𝐚™', senderName);

    await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: msg });

    try { fs.unlinkSync(tmpPath); } catch (e) {}
    if (avatarPath) { try { fs.unlinkSync(avatarPath); } catch (e) {} }
  }
};
