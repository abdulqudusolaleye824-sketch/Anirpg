const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { generateQuoteSticker } = require('../../utils/generateQuoteSticker');
const { injectStickerMetadata } = require('../../utils/stickerMetadata');

const COOLDOWNS   = new Map();
const COOLDOWN_MS = 5000;

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

    // ── Extract quoted message universally ─────────────────────────
    let { contextInfo, quoted } = extractContextAndQuoted(msg);
    // Tag mode: /q @user <text> — a reply (with text) always wins over a tag
    if (!quoted) {
      const cmdCtx = msg.message?.extendedTextMessage?.contextInfo || null;
      const tagged = cmdCtx?.mentionedJid?.[0];
      const tagText = args.join(' ').replace(/@\d[\d\s]*/g, '').trim();
      if (tagged && tagText) {
        quoted = { conversation: tagText };
        contextInfo = { participant: tagged, mentionedJid: cmdCtx.mentionedJid };
      }
    }
    if (!contextInfo || !quoted) {
      const UI = require('../../rpg/utils/UI');
      const text = UI.card(db?.users?.[sender], {
        icon: '📌', title: 'QUOTE STICKER',
        lines: [
          `*Reply to a message* to turn it into a quote sticker.`,
          ``,
          `/q (reply to text) — quote it`,
          `/q @user <text> — quote anyone`,
        ],
        proLines: [`💎 *PRO QUOTES* — priority render queue`],
        tip: 'works on text, captions & button replies',
      });
      return sock.sendMessage(chatId, { text }, { quoted: msg });
    }

    // ── Extract text from quoted message ────────────────────────
    const quoteText =
      quoted.conversation ||
      quoted.extendedTextMessage?.text ||
      quoted.imageMessage?.caption ||
      quoted.videoMessage?.caption ||
      quoted.buttonsResponseMessage?.selectedDisplayText ||
      quoted.templateButtonReplyMessage?.selectedDisplayText ||
      quoted.listResponseMessage?.title ||
      null;

    if (!quoteText || quoteText.trim().length === 0) {
      return sock.sendMessage(chatId, {
        text: '❌ Can\'t make a sticker out of that — no readable text in the quoted message.'
      }, { quoted: msg });
    }

    // ── Get sender's display name ────────────────────────────────
    const quotedParticipant = contextInfo.participant || contextInfo.remoteJid || 'Unknown';
    const quotedNumStr = quotedParticipant.replace(/[^0-9]/g, '');

    let senderName = 'Unknown';

    if (contextInfo.pushName) senderName = contextInfo.pushName;

    if (senderName === 'Unknown' && db?.users?.[quotedParticipant]?.name) {
      senderName = db.users[quotedParticipant].name;
    }

    // WA-name fallback: match the sender by bare number (covers LID/PN JID mismatches)
    if (senderName === 'Unknown' && quotedNumStr && db?.users) {
      const hit = Object.entries(db.users).find(([jid, u]) => u?.name && String(jid).replace(/[^0-9]/g, '') === quotedNumStr);
      if (hit) senderName = hit[1].name;
    }

    if (senderName === 'Unknown' && chatId.endsWith('@g.us')) {
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
        text: `❌ Failed to generate quote sticker: ${err.message}`
      }, { quoted: msg });
      if (avatarPath) { try { fs.unlinkSync(avatarPath); } catch (e) {} }
      return;
    }

    if (!fs.existsSync(tmpPath)) {
      if (avatarPath) { try { fs.unlinkSync(avatarPath); } catch (e) {} }
      return;
    }

    const rawStickerBuffer = fs.readFileSync(tmpPath);
    const stickerBuffer = await injectStickerMetadata(rawStickerBuffer, 'quotly by ✦ 𝐀𝐬𝐭𝐫𝐚™', senderName);

    await sock.sendMessage(chatId, {
      sticker: stickerBuffer,
      mimetype: 'image/webp',
    }, { quoted: msg });

    try { fs.unlinkSync(tmpPath); } catch (e) {}
    if (avatarPath) { try { fs.unlinkSync(avatarPath); } catch (e) {} }
  }
};
