// ═══════════════════════════════════════════════════════════════
// RETRIEVE COMMAND — View-Once Saver
// Reply to a view-once photo/video/voice note with /retrieve to keep it.
// Free: 1 retrieve per day (WAT) · Pro: unlimited.
// ═══════════════════════════════════════════════════════════════

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { extractContextAndQuoted } = require('./steal');
const UI = require('../../rpg/utils/UI');

const MAX_BYTES = 25 * 1024 * 1024; // 25MB — anything bigger is refused, not half-downloaded
const busy = new Set(); // in-flight retrievals per sender (stops double-tap spam)

const watDay = () => new Date(Date.now() + 3600000).toISOString().slice(0, 10);
const isProPlayer = (p) => !!((p.isPro || p.proStatus) && p.proExpiresAt && p.proExpiresAt > Date.now());

// The unwrapped node usually keeps viewOnce:true, but some clients strip it —
// so also accept a quoted stanza that arrived inside a view-once wrapper.
function quotedWasViewOnce(msg) {
  try {
    const m = msg.message || {};
    const ci = m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo
      || m.videoMessage?.contextInfo || m.audioMessage?.contextInfo
      || m.stickerMessage?.contextInfo || m.documentMessage?.contextInfo;
    let node = ci?.quotedMessage;
    for (let depth = 0; depth < 4 && node; depth++) {
      if (Object.keys(node).some((k) => /viewonce/i.test(k))) return true;
      node = node.ephemeralMessage?.message || node.viewOnceMessage?.message
        || node.viewOnceMessageV2?.message || node.documentWithCaption?.message || null;
    }
  } catch (e) { /* fall through to flag check */ }
  return false;
}

module.exports = {
  name: 'retrieve',
  aliases: ['vv', 'viewonce', 'saveonce'],
  description: 'Reply to a view-once photo/video/voice note with /retrieve to save it as a normal message. Free: 1/day · Pro: unlimited.',
  usage: '/retrieve (reply to a view-once message)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db?.users?.[sender];
    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You are not registered! Use /register' }, { quoted: msg });
    }

    const { contextInfo, quoted } = extractContextAndQuoted(msg);
    const img = quoted?.imageMessage;
    const vid = quoted?.videoMessage;
    const aud = quoted?.audioMessage;
    const doc = quoted?.documentMessage;
    const contact = quoted?.contactMessage;
    const sticker = quoted?.stickerMessage;

    if (!img && !vid && !aud && !doc && !contact && !sticker) {
      const left = player.retrieveDate === watDay() ? 0 : 1;
      const text = UI.card(player, {
        icon: '👀', title: 'VIEW-ONCE SAVER',
        lines: [
          `Reply to a *view-once* photo, video, or voice note with */retrieve*`,
          `I'll resend it here as a normal message you can keep.`,
          ``,
          `🎫 Free: *1 retrieve/day* · ⚡ Pro: *unlimited*`,
          `🎫 Today's free save: *${left ? 'available' : 'used — back tomorrow'}*`,
        ],
        proLines: [`💎 *PRO VAULT* — unlimited view-once saves`],
        tip: 'view-once media expires — save it fast',
      });
      return sock.sendMessage(chatId, { text }, { quoted: msg });
    }

    const looksViewOnce = !!(img?.viewOnce || vid?.viewOnce || aud?.viewOnce) || quotedWasViewOnce(msg);
    if (!looksViewOnce) {
      return sock.sendMessage(chatId, {
        text: '👀 That message is *not view-once* — nothing to retrieve.\n\nReply to a photo/video/voice note that was sent as *view once* 👆'
      }, { quoted: msg });
    }

    const pro = isProPlayer(player);
    const today = watDay();
    if (!pro && player.retrieveDate === today) {
      return sock.sendMessage(chatId, {
        text: '🎫 You\'ve used your *1 free retrieve* for today.\n\nCome back tomorrow, or go ⚡ *Pro* for unlimited view-once saves.'
      }, { quoted: msg });
    }
    if (busy.has(sender)) {
      return sock.sendMessage(chatId, { text: '⏳ Already retrieving — one moment…' }, { quoted: msg });
    }
    busy.add(sender);
    try {
      const mediaMsg = {
        message: quoted,
        key: { remoteJid: chatId, id: contextInfo?.stanzaId, participant: contextInfo?.participant }
      };
      let buf = null;
      try {
        buf = await downloadMediaMessage(mediaMsg, 'buffer', {});
      } catch (e) {
        buf = null;
      }
      if (!buf || !buf.length) {
        return sock.sendMessage(chatId, {
          text: '⌛ Couldn\'t download that message — it probably *expired* on WhatsApp\'s servers.\n\nView-once media must be retrieved before it disappears.'
        }, { quoted: msg });
      }
      if (buf.length > MAX_BYTES) {
        return sock.sendMessage(chatId, {
          text: `📦 That file is *${(buf.length / 1048576).toFixed(1)}MB* — over the 25MB retrieve limit, so I can't resend it.`
        }, { quoted: msg });
      }

      if (img) {
        await sock.sendMessage(chatId, {
          image: buf,
          caption: `💾 *Retrieved view-once photo*${img.caption ? `\n\n${img.caption}` : ''}`
        }, { quoted: msg });
      } else if (vid) {
        await sock.sendMessage(chatId, {
          video: buf,
          caption: `💾 *Retrieved view-once video*${vid.caption ? `\n\n${vid.caption}` : ''}`,
          ...(vid.gifPlayback ? { gifPlayback: true } : {})
        }, { quoted: msg });
      } else if (aud) {
        await sock.sendMessage(chatId, {
          audio: buf,
          mimetype: aud.mimetype || 'audio/ogg; codecs=opus',
          ptt: !!aud.ptt
        }, { quoted: msg });
      } else if (doc) {
        await sock.sendMessage(chatId, {
          document: buf,
          fileName: doc.fileName || 'retrieved-file',
          mimetype: doc.mimetype || 'application/octet-stream',
          caption: '💾 *Retrieved view-once document*'
        }, { quoted: msg });
      } else if (contact && contact.vcard) { // empty vcard renders as a blank bubble — skip instead
        await sock.sendMessage(chatId, {
          contacts: { displayName: contact.displayName || 'Retrieved contact', contacts: [{ vcard: contact.vcard }] }
        }, { quoted: msg });
      } else if (sticker) {
        await sock.sendMessage(chatId, { sticker: buf }, { quoted: msg });
      }

      if (!pro) {
        player.retrieveDate = today;
        saveDatabase();
      }
    } finally {
      busy.delete(sender);
    }
  }
};
