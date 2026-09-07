/**
 * /q | /quote — Reply to any message to turn it into a quote sticker
 * Generates a dark-themed 512x512 WebP sticker with the sender's name
 */

const { execFile } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const SCRIPT_PATH = path.join(__dirname, '..', 'utils', 'generateQuoteSticker.py');
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

    // Resolve quoted sender's display name — best available source wins
    let senderName = 'Unknown';

    // 1. Check RPG database first (most reliable stored name)
    if (db?.users?.[quotedParticipant]?.name) {
      senderName = db.users[quotedParticipant].name;
    }

    // 2. Try group metadata for pushName
    if (senderName === 'Unknown') {
      try {
        const meta = await sock.groupMetadata(chatId).catch(() => null);
        if (meta) {
          const participant = meta.participants.find(p =>
            p.id && p.id.includes(quotedNumStr)
          );
          // Baileys exposes pushName on participant object
          if (participant?.pushName) senderName = participant.pushName;
          else if (participant?.name)  senderName = participant.name;
          else if (participant?.notify) senderName = participant.notify;
        }
      } catch (e) { /* ignore — group metadata may fail in DMs */ }
    }

    // 3. Fall back to phone number
    if (senderName === 'Unknown' && quotedNumStr) {
      senderName = '+' + quotedNumStr;
    }

    // ── Generate sticker ─────────────────────────────────────────
    const tmpPath = path.join(os.tmpdir(), `quote_${Date.now()}.webp`);

    await sock.sendMessage(chatId, { react: { text: '🎨', key: msg.key } });

    await new Promise((resolve, reject) => {
      execFile('python3', [SCRIPT_PATH, senderName, quoteText, tmpPath], (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout.trim());
      });
    }).catch(async (err) => {
      console.error('Quote sticker error:', err.message);
      await sock.sendMessage(chatId, {
        text: '❌ Failed to generate sticker. Make sure python3 and Pillow are installed.'
      }, { quoted: msg });
      return null;
    });

    if (!fs.existsSync(tmpPath)) return;

    const stickerBuffer = fs.readFileSync(tmpPath);

    // ── Send as sticker ───────────────────────────────────────────
    await sock.sendMessage(chatId, {
      sticker: stickerBuffer,
      mimetype: 'image/webp',
    }, { quoted: msg });

    // Cleanup
    try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
  }
};
