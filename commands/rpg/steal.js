// ═══════════════════════════════════════════════════════════════
// STEAL COMMAND — Sticker Theft
// Reply to a sticker with /steal to steal it into your own pack.
// Default: Pack Name: ✦ 𝐀𝐬𝐭𝐫𝐚™ | Author: owner/user name
// Custom: /steal mee | and youu → Pack: mee, Author: and youu
// ═══════════════════════════════════════════════════════════════

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { injectStickerMetadata } = require('../../utils/stickerMetadata');

const cooldowns = new Map();

module.exports = {
  name: 'steal',
  aliases: ['ssteal', 'stickersteal'],
  description: 'Reply to a sticker with /steal [pack | author] to steal it.',
  usage: '/steal [packName | authorName]',

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

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;
    const stickerMsg = quoted?.stickerMessage;

    if (!quoted || !stickerMsg) {
      return sock.sendMessage(chatId, {
        text: '📌 *Reply to a sticker* with `/steal` to steal it into your pack.\n\n*(To steal Nexus from a player, use `/rob @user`)*'
      }, { quoted: msg });
    }

    const db = getDatabase();
    const ownerName = db?.users?.[sender]?.name || msg.pushName || 'Senku';

    const rawText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').replace(/^\/(steal|ssteal)\s*/i, '').trim();

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

      const mediaMsg = {
        message: quoted,
        key: {
          remoteJid: chatId,
          id: contextInfo.stanzaId,
          participant: contextInfo.participant
        }
      };

      const buffer = await downloadMediaMessage(mediaMsg, 'buffer', {});

      if (!buffer || buffer.length === 0) {
        return sock.sendMessage(chatId, {
          text: '❌ Couldn\'t download that sticker. It may have expired.'
        }, { quoted: msg });
      }

      const rebrandedWebp = await injectStickerMetadata(buffer, packName, author);

      await sock.sendMessage(chatId, { sticker: rebrandedWebp }, { quoted: msg });

    } catch (err) {
      console.error('steal sticker error:', err.message);
      await sock.sendMessage(chatId, {
        text: `❌ Error stealing sticker: ${err.message}`
      }, { quoted: msg });
    }
  }
};
