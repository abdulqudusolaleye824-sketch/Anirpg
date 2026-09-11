// ═══════════════════════════════════════════════════════════════
// SETPROFILE — /seticon + /setname  (Task 9)
//   /seticon   — change your profile image (reply to or send an image)
//   /setname <new name> — change your display name
// ═══════════════════════════════════════════════════════════════
'use strict';

let _downloadMediaMessage = null;
function getDownloader() {
  if (!_downloadMediaMessage) {
    try {
      ({ downloadMediaMessage: _downloadMediaMessage } = require('@whiskeysockets/baileys'));
    } catch (e) {
      _downloadMediaMessage = null;
    }
  }
  return _downloadMediaMessage;
}

function bare(sender) { return sender.split('@')[0].split(':')[0]; }

module.exports = {
  seticon: {
    name: 'seticon',
    aliases: ['setprofileicon', 'spic'],
    description: '🖼️ Set your profile image (reply to / send an image)',
    async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
      const chatId = msg.key?.remoteJid;
      const db = getDatabase();
      const player = db.users[sender];
      if (!player) return sock.sendMessage(chatId, { text: '❌ Register first.' }, { quoted: msg });

      if (!player.cards) player.cards = {};
      if ((player.cards.seticon || 0) < 1) {
        return sock.sendMessage(chatId, { text: `❌ *No Seticon Token!*\n\nChanging your profile icon costs 1 🖼️ Seticon Token.\n\n🛍️ Get one: /prostore buy seticon (500 PC)` }, { quoted: msg });
      }

      const downloadMediaMessage = getDownloader();
      if (!downloadMediaMessage) {
        return sock.sendMessage(chatId, { text: '❌ Media download module not available.' }, { quoted: msg });
      }

      const currentImg = msg.message?.imageMessage;
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedImg = quoted?.imageMessage || quoted?.videoMessage;

      let target = null;
      if (currentImg) {
        target = { key: msg.key, message: msg.message };
      } else if (quotedImg) {
        target = {
          key: {
            remoteJid: chatId,
            id: msg.message.extendedTextMessage.contextInfo.stanzaId,
            participant: msg.message.extendedTextMessage.contextInfo.participant,
          },
          message: quoted,
        };
      }

      if (!target) {
        return sock.sendMessage(chatId, {
          text: `❌ No image found.\n\n📌 Reply to an image with */seticon* (or send an image with */seticon* as its caption).`,
        }, { quoted: msg });
      }

      try {
        const buf = await downloadMediaMessage(target, 'buffer', {});
        if (!buf || buf.length === 0) {
          return sock.sendMessage(chatId, { text: '❌ Could not download the image.' }, { quoted: msg });
        }
        if (buf.length > 2 * 1024 * 1024) {
          return sock.sendMessage(chatId, { text: '❌ Image too large (max 2 MB). Send a smaller image.' }, { quoted: msg });
        }
        player.profileImage = buf.toString('base64');
        player.cards.seticon -= 1;
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `✅ *Profile icon updated!*\n\n🖼️ 1 Seticon Token used (${player.cards.seticon} left)\nView it: /profile`,
        }, { quoted: msg });
      } catch (err) {
        console.error('[seticon] download error:', err.message);
        return sock.sendMessage(chatId, { text: '❌ Failed to set icon. The media may have expired.' }, { quoted: msg });
      }
    },
  },

  setname: {
    name: 'setname',
    aliases: ['setdisplayname', 'sname'],
    description: '✏️ Change your display name',
    async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
      const chatId = msg.key?.remoteJid;
      const db = getDatabase();
      const player = db.users[sender];
      if (!player) return sock.sendMessage(chatId, { text: '❌ Register first.' }, { quoted: msg });

      if (!player.cards) player.cards = {};
      if ((player.cards.namechange || 0) < 1) {
        return sock.sendMessage(chatId, { text: `❌ *No Name-Change Card!*\n\nChanging your name costs 1 ✏️ Name-Change Card.\n\n🛍️ Get one: /prostore buy namechange (500 PC)` }, { quoted: msg });
      }

      const name = args.join(' ').trim();
      if (!name) {
        return sock.sendMessage(chatId, {
          text: `❌ Usage: */setname <new name>*\n\nCurrent name: *${player.name}*`,
        }, { quoted: msg });
      }
      if (name.length > 50) {
        return sock.sendMessage(chatId, { text: '❌ Name too long (max 50 characters).' }, { quoted: msg });
      }

      const oldName = player.name;
      player.name = name;
      player.cards.namechange -= 1;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `✅ *Name changed!*\n\n${oldName} → *${name}*\n\n✏️ 1 Name-Change Card used (${player.cards.namechange} left)`,
      }, { quoted: msg });
    },
  },
};
