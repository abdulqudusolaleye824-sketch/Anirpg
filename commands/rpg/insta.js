/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — /insta                            ║
 * ║  Download an Instagram post/reel video as .mp4       ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Uses the same yt-dlp + ffmpeg pipeline as /ytmp4 (no extra API/setup).
 *   /insta <instagram-url>   → sends the video as .mp4
 *
 * Works for PUBLIC reels / posts / IGTV. Private / account-gated content
 * won't download without an IG session cookie (optional: IG_COOKIES in .env).
 */

'use strict';

const fs           = require('fs');
const path         = require('path');
const os           = require('os');
const ToolRunner   = require('../../rpg/utils/ToolRunner');
const { extractQuotedUrl } = require('./utility');

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
  if (process.env.IG_COOKIES) cookieArgs.push('--cookies', process.env.IG_COOKIES);
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
  name:        'insta',
  aliases:     ['ig', 'instagram', 'reel', 'reels'],
  description: 'Download an Instagram post/reel video (mp4).',
  usage:       '/insta <url> (or reply to one)',
  category:    'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    // Push #28: no args → try the replied-to message's link.
    let url = (args[0] || '').trim();
    if (!url) url = extractQuotedUrl(msg) || '';
    if (!url) {
      return sock.sendMessage(chatId, {
        text: [
          '📸 *Instagram Downloader*',
          '',
          '📌 Usage: /insta <url>',
          '',
          '💡 Downloads an Instagram reel/post as .mp4:',
          '  /insta https://www.instagram.com/reel/xxxx/',
          '  /insta https://www.instagram.com/p/xxxx/',
          '  💡 Or reply to a message containing the link',
          '',
          '⚠️ Works on public posts. Private accounts need IG_COOKIES in .env.',
        ].join('\n'),
      }, { quoted: msg });
    }
    if (!/instagram\.com|instagr\.am|ig\.me/i.test(url)) {
      return sock.sendMessage(chatId, {
        text: '❌ Please paste a valid Instagram link.',
      }, { quoted: msg });
    }

    const last = COOLDOWNS.get(sender) || 0;
    if (Date.now() - last < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
      return sock.sendMessage(chatId, { text: `⏳ Cooldown: ${wait}s remaining.` }, { quoted: msg });
    }
    COOLDOWNS.set(sender, Date.now());

    await sock.sendMessage(chatId, {
      text: `🔍 *Downloading Instagram media...*\n🔗 ${url}`,
    }, { quoted: msg });

    let info;
    try {
      info = await getInfo(url);
    } catch (err) {
      console.error('❌ /insta info error:', err.message);
      return sock.sendMessage(chatId, {
        text: `❌ Couldn't fetch that Instagram post.\n\n🔧 ${err.message}\n\n💡 Make sure the post is public and you pasted a full instagram.com link.`,
      }, { quoted: msg });
    }

    const tmpDir  = os.tmpdir();
    // Push #28: ext-agnostic output — photo posts come back as jpg, not mp4.
    const outTemplate = path.join(tmpDir, `anirpg_ig_${Date.now()}.%(ext)s`);
    let mediaPath = null;

    try {
      const cookieArgs = [];
      if (process.env.IG_COOKIES) cookieArgs.push('--cookies', process.env.IG_COOKIES);
      // Download the best media (reels → mp4, photo posts → jpg).
      const printed = await runYtDlp([
        url,
        '--no-playlist', '--no-warnings',
        ...cookieArgs,
        '-f', 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4',
        '--output', outTemplate,
        '--print', 'after_move:filepath',
        '--max-filesize', String(MAX_SIZE_B),
      ]);
      mediaPath = printed.trim().split('\n').pop();

      if (!mediaPath || !fs.existsSync(mediaPath)) throw new Error('Output file not created');

      const stat   = fs.statSync(mediaPath);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
      if (stat.size > MAX_SIZE_B) throw new Error('File too large to send');

      const isImg = /\.(jpg|jpeg|png|webp)$/i.test(mediaPath);
      const caption = `📸 *${info.title || 'Instagram post'}*\n👤 ${info.uploader || 'Unknown'}\n📦 ${sizeMB} MB`;
      await sock.sendMessage(chatId, isImg
        ? { image: fs.readFileSync(mediaPath), caption }
        : { video: fs.readFileSync(mediaPath), mimetype: 'video/mp4', caption },
        { quoted: msg });

      await sock.sendMessage(chatId, { text: `✅ Done!` });

    } catch (err) {
      console.error('❌ /insta error:', err.message);
      const isToolMissing = /tool-not-found|not found|not set|no such|is not recognized|command not found/i.test(err.message);
      return sock.sendMessage(chatId, {
        text: [
          '❌ Download failed.',
          `🔧 ${err.message}`,
          '',
          isToolMissing
            ? '⚠ Could not find yt-dlp. Run:  pip install -U yt-dlp\n(Or add YTDLP_PATH to .env.)'
            : '💡 This may be a private post, or Instagram is gating the media.\nTry /tt for TikTok or /ytmp4 for YouTube.',
          '',
          'If it is a private account, export IG cookies and set IG_COOKIES in .env.',
        ].join('\n'),
      }, { quoted: msg });
    } finally {
      try { if (mediaPath) fs.unlinkSync(mediaPath); } catch (_) {}
    }
  },
};

// /bypass hook: drop this module's in-memory cooldown for one user.
// Returns true when something was actually cleared.
function resetCooldownsFor(jid) {
  try { return COOLDOWNS.delete(jid) === true; } catch (e) { return false; }
}
module.exports.resetCooldownsFor = resetCooldownsFor;
