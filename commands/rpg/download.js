/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — /ytmp4                              ║
 * ║  Download a YouTube video as .mp4                      ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Requires: yt-dlp + ffmpeg installed on the host (free, no API key).
 *   Windows:  winget install yt-dlp.youtubedl  &  winget install Gyan.FFmpeg
 *   Linux:    apt install yt-dlp ffmpeg   (or)  pip install -U yt-dlp
 *
 * Usage:
 *   /ytmp4 <youtube-url>   → sends the video as .mp4
 *   /tt <tiktok-url>       → TikTok (already exists, in utility.js)
 *   /ytmp3 <url or query>  → YouTube audio (already exists, ytmp3.js)
 */

'use strict';

const { execFile } = require('child_process');
const fs           = require('fs');
const path         = require('path');
const os           = require('os');
const ToolRunner   = require('../../rpg/utils/ToolRunner');

const COOLDOWNS  = new Map();
const COOLDOWN_MS = 60_000;              // 1 min per user
const MAX_DURATION_S = 900;              // 15 min max
const MAX_SIZE_B    = 50 * 1024 * 1024;  // ~50 MB (WhatsApp video limit is tight; keep it reasonable)

// Run yt-dlp via ToolRunner (finds it even off-PATH). Resolves to stdout, rejects on error.
async function runYtDlp(args, opts = {}) {
  const res = await ToolRunner.ytDlpRun(args, { timeout: 180_000, ...opts });
  if (!res.ok) throw new Error(res.error || 'yt-dlp failed');
  return res.stdout.trim();
}

async function getInfo(query) {
  const raw = await runYtDlp([
    '--print', '%(title)s|||%(duration)s|||%(uploader)s|||%(id)s',
    '--no-playlist', '--no-warnings', '--no-download',
    ...ToolRunner.YOUTUBE_EXTRACTOR_ARGS_FULL,
    ...(process.env.YT_COOKIES ? ['--cookies', process.env.YT_COOKIES] : []),
    ...(process.env.YT_COOKIES_FROM_BROWSER ? ['--cookies-from-browser', process.env.YT_COOKIES_FROM_BROWSER] : []),
    query,
  ]);
  const [title, duration, uploader, id] = raw.split('|||');
  return {
    title,
    duration: parseInt(duration, 10) || 0,
    uploader,
    id,
    url: query.startsWith('http') ? query : `https://youtu.be/${id}`,
  };
}

module.exports = {
  name:        'ytmp4',
  aliases:     ['download', 'vd', 'video', 'ytvideo'],
  description: 'Download a YouTube video (mp4). TikTok is /tt.',
  usage:       '/ytmp4 <url>',
  category:    'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: [
          '🎬 *Video Downloader*',
          '',
          '📌 Usage: /ytmp4 <youtube url>',
          '',
          '💡 Downloads a YouTube video as .mp4:',
          '  /ytmp4 https://youtu.be/xxxx',
          '  /ytmp4 https://www.youtube.com/watch?v=xxxx',
          '',
          '📱 TikTok? Use: /tt <url>',
          '',
          '⚠️ Max duration: 15 minutes',
        ].join('\n'),
      }, { quoted: msg });
    }

    const url = args[0].trim();
    if (!/^https?:\/\//i.test(url)) {
      return sock.sendMessage(chatId, {
        text: '❌ Please paste a valid link (YouTube or TikTok URL).',
      }, { quoted: msg });
    }

    const last = COOLDOWNS.get(sender) || 0;
    const elapsed = Date.now() - last;
    if (elapsed < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return sock.sendMessage(chatId, { text: `⏳ Cooldown: ${wait}s remaining.` }, { quoted: msg });
    }
    COOLDOWNS.set(sender, Date.now());

    await sock.sendMessage(chatId, {
      text: `🔍 *Fetching video...*\n🔗 ${url}`,
    }, { quoted: msg });

    let info;
    try {
      info = await getInfo(url);
    } catch (err) {
      console.error('❌ /download info error:', err.message);
      return sock.sendMessage(chatId, {
        text: `❌ Couldn't fetch that link. Make sure it's a public YouTube/TikTok URL.\n\n🔧 ${err.message}`,
      }, { quoted: msg });
    }

    if (info.duration > MAX_DURATION_S) {
      return sock.sendMessage(chatId, {
        text: `❌ Too long (${Math.floor(info.duration / 60)} min).\nMax allowed: 15 minutes.`,
      }, { quoted: msg });
    }

    const mins = Math.floor(info.duration / 60);
    const secs = info.duration % 60;

    await sock.sendMessage(chatId, {
      text: [
        `🎬 *${info.title}*`,
        `👤 ${info.uploader || 'Unknown'}  |  ⏱️ ${mins}:${String(secs).padStart(2, '0')}`,
        '',
        '⬇️ Downloading... (merging video+audio, may take a moment)',
      ].join('\n'),
    }, { quoted: msg });

    const tmpDir  = os.tmpdir();
    const outPath = path.join(tmpDir, `anirpg_vid_${Date.now()}.mp4`);

    try {
      // Merge best video + audio when ffmpeg is available; otherwise grab a
      // single-file progressive MP4 so /ytmp4 works WITHOUT ffmpeg installed.
      const dl = await ToolRunner.optimalDownloadArgs();
      await runYtDlp([
        url,
        '--no-playlist', '--no-warnings',
        ...dl.args,
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
        caption:  `🎬 *${info.title}*\n📦 ${sizeMB} MB`,
      }, { quoted: msg });

      await sock.sendMessage(chatId, {
        text: `✅ Done! *(If the video didn't send, it was too large for WhatsApp — try a shorter clip.)*`,
      });

    } catch (err) {
      console.error('❌ /download error:', err.message);
      const isToolMissing = /tool-not-found|not found|not set|no such|is not recognized|command not found/i.test(err.message);
      const is403 = /403|forbidden/i.test(err.message);
      let reason;
      if (isToolMissing) {
        reason = '⚠ Could not find yt-dlp. Run:  pip install -U yt-dlp\n(If it still fails, add YTDLP_PATH to .env)';
      } else if (is403) {
        reason = '⚠ YouTube blocked the download (403) because the bot can\'t solve YouTube\'s signature challenge.\nFix it — install the Deno runtime:\n  winget install DenoLand.Deno\nThen close this terminal, reopen it, and restart the bot. (Also ensure yt-dlp is current: pip install -U yt-dlp)';
      } else {
        reason = 'This video only has separate video+audio streams, and ffmpeg is not installed to merge them.\nInstall ffmpeg once:\n  winget install Gyan.FFmpeg --source winget\nThen restart the bot (restart the terminal).';
      }
      return sock.sendMessage(chatId, {
        text: [
          '❌ Download failed.',
          `🔧 ${err.message}`,
          '',
          reason,
          '',
          'Try a different video if it still fails.',
        ].join('\n'),
      }, { quoted: msg });
    } finally {
      try { fs.unlinkSync(outPath); } catch (_) {}
    }
  },
};
