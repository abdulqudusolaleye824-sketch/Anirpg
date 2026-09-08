const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { injectStickerMetadata } = require('../../utils/stickerMetadata');
let sharp; try { sharp = require('sharp'); } catch(e) { sharp = null; }

const COOLDOWNS   = new Map();
const COOLDOWN_MS = 5000;

// Branding for stolen sticker packs — pack name always carries the brand,
// and the author/publisher is the new owner's player name.
const PACK_NAME = '✦ 𝐀𝐬𝐭𝐫𝐚™';

module.exports = {
  name: 'steal',
  aliases: ['ssteal'],
  description: 'Reply to a sticker to steal it (rebranded to your name).',
  usage: '/steal (reply to a sticker)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const db = getDatabase();
    const chatId = msg.key.remoteJid;

    const now = Date.now();
    if (COOLDOWNS.has(sender) && now - COOLDOWNS.get(sender) < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - COOLDOWNS.get(sender))) / 1000);
      return sock.sendMessage(chatId, { text: `⏳ Wait *${remaining}s* before stealing another sticker.` }, { quoted: msg });
    }
    COOLDOWNS.set(sender, now);

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (!contextInfo || !contextInfo.quotedMessage) {
      return sock.sendMessage(chatId, { text: '📌 *Reply to a sticker* to steal it.' }, { quoted: msg });
    }

    const quotedMsg = contextInfo.quotedMessage;
    if (!quotedMsg.stickerMessage) {
      return sock.sendMessage(chatId, { text: '❌ That\'s not a sticker. Reply to a *sticker message*.' }, { quoted: msg });
    }

    // ── Resolve the NEW owner's player name ────────────────────────────────
    // The stolen pack is rebranded with the stealing player's name.
    let ownerName = null;
    const bareSender = String(sender).split(':')[0].split('@')[0];
    if (db?.users?.[sender]?.name) ownerName = db.users[sender].name;
    else if (db?.users?.[bareSender]?.name) ownerName = db.users[bareSender].name;
    if (!ownerName) ownerName = msg.pushName || '+' + bareSender;

    try {
      await sock.sendMessage(chatId, { react: { text: '🎭', key: msg.key } });

      const participant = contextInfo.participant || contextInfo.remoteJid || chatId;
      const fakeMsg = {
        key: { remoteJid: chatId, id: contextInfo.stanzaId, participant },
        message: { stickerMessage: quotedMsg.stickerMessage }
      };

      let buffer;
      try {
        buffer = await downloadMediaMessage(fakeMsg, 'buffer', {}, {
          logger: console,
          reuploadRequest: sock.updateMediaMessage
        });
      } catch (dlErr) {
        console.error('Sticker download error:', dlErr.message);
        return sock.sendMessage(chatId, { text: '❌ Couldn\'t download that sticker. It may have expired.' }, { quoted: msg });
      }

      if (!buffer || buffer.length === 0) {
        return sock.sendMessage(chatId, { text: '❌ Sticker download returned empty data.' }, { quoted: msg });
      }

      const isAnimated = buffer.toString('ascii', 0, Math.min(200, buffer.length)).includes('ANIM');

      const stickerBuffer = await sharp(buffer, { animated: isAnimated })
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 95 })
        .toBuffer();

      // ── Inject branded pack metadata: pack name = brand, author = new owner ──
      let sendSticker = stickerBuffer;
      try {
        sendSticker = injectStickerMetadata(stickerBuffer, PACK_NAME, ownerName);
      } catch (mdErr) {
        console.error('Sticker metadata inject failed (sending as-is):', mdErr.message);
      }

      await sock.sendMessage(chatId, { sticker: sendSticker }, { quoted: msg });
      console.log('✅ Sticker stolen & rebranded to:', ownerName);

    } catch (err) {
      console.error('steal error:', err.message);
      return sock.sendMessage(chatId, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
  }
};
