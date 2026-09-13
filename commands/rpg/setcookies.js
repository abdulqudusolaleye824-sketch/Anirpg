// setcookies.js — owner: set YouTube cookies WITHOUT Termux.
// Reply to a message containing a fresh yt-dlp cookie export with /setcookies,
// or put the export in the same message after the command. Takes effect
// immediately (no restart). Push #25.
'use strict';

const fs = require('fs');
const path = require('path');
const Perms = require('../../utils/permissions');

function _unwrap(q) {
  let m = q;
  let guard = 0;
  while (m && guard++ < 5) {
    if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
    else if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
    else if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
    else if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message;
    else break;
  }
  return m;
}

function _textOf(node) {
  if (!node) return '';
  return node.conversation || node.extendedTextMessage?.text || '';
}

function _cookieFile() {
  const dir = process.env.DATA_DIR || '/data';
  return { dir, file: path.join(dir, 'yt-cookies.txt') };
}

module.exports = {
  name: 'setcookies',
  aliases: ['setcookie', 'ytcookies'],
  description: '🍪 [Owner] Set YouTube cookies by replying to a fresh export',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotOwner(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Bot owner only.' }, { quoted: msg });
    }

    // Source 1: quoted/replied message (preferred — preserves tabs/newlines exactly).
    let raw = '';
    try {
      const root = msg.message?.extendedTextMessage?.contextInfo
        || msg.message?.imageMessage?.contextInfo
        || msg.message?.videoMessage?.contextInfo;
      const q = root?.quotedMessage ? _unwrap(root.quotedMessage) : null;
      raw = _textOf(q).trim();
    } catch {}

    // Source 2: same-message body after the command.
    if (!raw) {
      try {
        const full = _textOf(msg.message);
        if (!/^\/setcookies(@\S+)?\s*$/i.test(full.trim())) {
          raw = full.replace(/^\/setcookies(@\S+)?\s*/i, '').trim();
        }
      } catch {}
    }

    if (!raw || raw.length < 500) {
      return sock.sendMessage(chatId, {
        text: '🍪 *SET YOUTUBE COOKIES*\n\n'
          + '1️⃣ In Firefox: cookie add-on → export → copy\n'
          + '2️⃣ Paste it as a message here\n'
          + '3️⃣ Reply to that message with /setcookies\n\n'
          + 'Takes effect instantly — no restart.\n'
          + 'Tip: do it in a bot DM, then delete the cookie message.'
      }, { quoted: msg });
    }

    // Validate: Netscape header + real youtube lines.
    const text = raw.replace(/\r/g, '');
    const lines = text.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
    const head = lines.slice(0, 5).join('\n');
    const hasHeader = /# Netscape HTTP Cookie File|#HttpOnly_/.test(head);
    const ytLines = lines.filter((l) => /^\.?youtube\.com[\t ]/.test(l));
    const gLines = lines.filter((l) => /google/.test(l));
    if (!hasHeader || ytLines.length < 1 || lines.length < 3) {
      return sock.sendMessage(chatId, {
        text: '❌ That doesn\'t look like a yt-dlp cookie export.\n\nNeed: the `# Netscape HTTP Cookie File` header + youtube.com lines, pasted raw (no edits).'
      }, { quoted: msg });
    }

    // Write 0600 to the persistent volume.
    try {
      const { dir, file } = _cookieFile();
      fs.mkdirSync(dir, { recursive: true });
      const data = text.trim() + '\n';
      fs.writeFileSync(file, data, { mode: 0o600 });
      try { fs.chmodSync(file, 0o600); } catch {}
    } catch (e) {
      return sock.sendMessage(chatId, { text: `❌ Could not save cookies: ${e.message}` }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: `✅ *COOKIES SAVED* — live now, no restart.\n\n📄 ${lines.length} lines (${ytLines.length} youtube, ${gLines.length} google)\n🔍 Verify: /ytstatus → then test /play\n\n⚠️ Delete your cookie message from this chat.`
    }, { quoted: msg });
  },
};
