/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — /facebook                         ║
 * ║  Download a Facebook video/reel as .mp4 (batch-37)   ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Uses the same yt-dlp + ffmpeg pipeline as /insta (no extra API/setup).
 *   /facebook <facebook-url>   → sends the video as .mp4
 *
 * Works for PUBLIC videos / reels. Login-gated content won't download
 * without a FB session cookie (optional: FB_COOKIES in .env).
 */

'use strict';

const fs           = require('fs');
const path         = require('path');
const os           = require('os');
const ToolRunner   = require('../../rpg/utils/ToolRunner');

const COOLDOWNS  = new Map();
const COOLDOWN_MS = 60_000;
const MAX_SIZE_B = 50 * 1024 * 1024;

async function runYtDlp(args, opts = {}) {
  const res = await ToolRunner.ytDlpRun(args, { timeout: 180_000, ...opts });
  if (!res.ok) throw new Error(res.error || 'yt-dlp failed');
  return res.stdout.trim();
}

async function getInfo(query) {
  const cookieArgs = [];
  if (process.env.FB_COOKIES) cookieArgs.push('--cookies', process.env.FB_COOKIES);
  const raw = await runYtDlp([
    '--print', '%(title)s|||%(uploader)s|||%(id)s',
    '--no-playlist', '--no-warnings', '--no-download',
    ...cookieArgs,
    query,
  ]);
  const [title, uploader, id] = raw.split('|||');
  return { title, uploader, id };
}

module.exports = {
  name:        'facebook',
  aliases:     ['fb', 'fbdl', 'fbvideo'],
  description: 'Download a Facebook video/reel (mp4).',
  usage:       '/facebook <url>',
  category:    'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: [
          '📘 *Facebook Downloader*',
          '',
          '📌 Usage: /facebook <url>',
          '',
          '💡 Downloads a Facebook video/reel as .mp4:',
          '  /facebook https://www.facebook.com/reel/xxxx/',
          '  /facebook https://fb.watch/xxxx/',
          '',
          '⚠️ Works on public videos. Login-gated posts need FB_COOKIES in .env.',
        ].join('\n'),
      }, { quoted: msg });
    }

    const url = args[0].trim();
    if (!/facebook\.com|fb\.watch|fb\.me|fb\.com/i.test(url)) {
      return sock.sendMessage(chatId, {
        text: '❌ Please paste a valid Facebook link.',
      }, { quoted: msg });
    }

    const last = COOLDOWNS.get(sender) || 0;
    if (Date.now() - last < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
      return sock.sendMessage(chatId, { text: `⏳ Cooldown: ${wait}s remaining.` }, { quoted: msg });
    }
    COOLDOWNS.set(sender, Date.now());

    await sock.sendMessage(chatId, {
      text: `🔍 *Downloading Facebook video...*\n🔗 ${url}`,
    }, { quoted: msg });

    let info;
    try {
      info = await getInfo(url);
    } catch (err) {
      console.error('❌ /facebook info error:', err.message);
      return sock.sendMessage(chatId, {
        text: `❌ Couldn't fetch that Facebook video.\n\n🔧 ${err.message}\n\n💡 Make sure the video is public and you pasted a full facebook.com link.`,
      }, { quoted: msg });
    }

    const tmpDir  = os.tmpdir();
    const outPath = path.join(tmpDir, `anirpg_fb_${Date.now()}.mp4`);

    try {
      const cookieArgs = [];
      if (process.env.FB_COOKIES) cookieArgs.push('--cookies', process.env.FB_COOKIES);
      await runYtDlp([
        url,
        '--no-playlist', '--no-warnings',
        ...cookieArgs,
        '-f', 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4', '--remux-video', 'mp4',
        '--output', outPath,
        '--max-filesize', String(MAX_SIZE_B),
      ]);

      if (!fs.existsSync(outPath)) throw new Error('Output file not created');

      const stat   = fs.statSync(outPath);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
      if (stat.size > MAX_SIZE_B) throw new Error('File too large to send');

      await sock.sendMessage(chatId, {
        video:    fs.readFileSync(outPath),
        mimetype: 'video/mp4',
        caption:  `📘 *${info.title || 'Facebook video'}*\n👤 ${info.uploader || 'Unknown'}\n📦 ${sizeMB} MB`,
      }, { quoted: msg });

      await sock.sendMessage(chatId, { text: `✅ Done!` });

    } catch (err) {
      console.error('❌ /facebook error:', err.message);
      const isToolMissing = /tool-not-found|not found|not set|no such|is not recognized|command not found/i.test(err.message);
      return sock.sendMessage(chatId, {
        text: [
          '❌ Download failed.',
          `🔧 ${err.message}`,
          '',
          isToolMissing
            ? '⚠ Could not find yt-dlp. Run:  pip install -U yt-dlp\n(Or add YTDLP_PATH to .env.)'
            : '💡 This may be a login-gated video, or Facebook is gating the media.',
          '',
          'If it needs login, export FB cookies and set FB_COOKIES in .env.',
        ].join('\n'),
      }, { quoted: msg });
    } finally {
      try { fs.unlinkSync(outPath); } catch (_) {}
    }
  },
};

// /bypass hook: drop this module's in-memory cooldown for one user.
// Returns true when something was actually cleared.
function resetCooldownsFor(jid) {
  try { return COOLDOWNS.delete(jid) === true; } catch (e) { return false; }
}
module.exports.resetCooldownsFor = resetCooldownsFor;
