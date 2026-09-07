const { downloadMediaMessage } = require('@whiskeysockets/baileys');
let sharp; try { sharp = require('sharp'); } catch(e) { sharp = null; }

const COOLDOWNS   = new Map();
const COOLDOWN_MS = 5000;

module.exports = {
  name: 'ssteal',
  aliases: ['steal'],
  description: 'Reply to a sticker to steal it.',
  usage: '/ssteal',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
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

      await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: msg });
      console.log('✅ Sticker sent!');

    } catch (err) {
      console.error('ssteal error:', err.message);
      return sock.sendMessage(chatId, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
  }
};
