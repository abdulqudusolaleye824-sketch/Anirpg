// ═══════════════════════════════════════════════════════════════
// /song — YouTube → MP3 with cover art (standalone, batch-23).
// Decoupled: /yt stays the plain audio fetcher, /lyrics is text-only,
// and /song is the deluxe cut — MP3 + YouTube cover in ONE message
// (document with jpegThumbnail). Engine mirrors live /yt (ToolRunner
// yt-dlp + SoundCloud fallback + ffmpeg conversion); the cover comes
// from i.ytimg.com via the video id. Any cover/download hiccup falls
// back gracefully (plain audio, then error text) — never a crash.
// ═══════════════════════════════════════════════════════════════
'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const ToolRunner = require('../../rpg/utils/ToolRunner');
const { ytDlpRun } = ToolRunner;

const ROOT_DIR = path.join(__dirname, '..', '..');
const TMP_DIR  = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'tmp')
  : path.join(ROOT_DIR, 'tmp');

function safeName(title) {
  const s = String(title || 'song').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return s || 'song';
}

function thumbUrl(id) {
  if (!/^[\w-]{6,20}$/.test(String(id || ''))) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function fetchBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 3) return reject(new Error('Too many redirects'));
    const req = https.get(url, { headers: { 'User-Agent': 'AniRPG/1.0' }, timeout: 15000 }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        res.resume();
        const next = String(res.headers.location).startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        return fetchBuffer(next, redirects + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || '' }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

module.exports = {
  name: 'song',
  aliases: ['music'],
  description: 'Download a song as MP3 with cover art',
  usage: '/song <youtube url or song name>',
  category: 'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: /song <YouTube URL or song name>\nExample: /song Blinding Lights',
      }, { quoted: msg });
    }

    const input = args.join(' ');
    const isUrl = input.startsWith('http');

    await sock.sendMessage(chatId, {
      text: `🎵 *Fetching song...*\n${isUrl ? input : `"${input}"`}`,
    }, { quoted: msg });

    fs.mkdirSync(TMP_DIR, { recursive: true });
    const outTemplate = path.join(TMP_DIR, `song_${Date.now()}.%(ext)s`);
    const ytInput = isUrl ? input : `ytsearch1:${input}`;

    const aud = await ToolRunner.optimalAudioArgs();
    const baseArgs = [
      '--no-playlist',
      ...aud.args,
      '--max-filesize', '25m',
      '--output', outTemplate,
      '--print', 'after_move:filepath',
      '--print', 'id',
      '--print', 'title',
      ytInput,
    ];

    let res = await ytDlpRun(baseArgs, { timeout: 90000 });
    let lines = res.ok ? res.stdout.trim().split('\n') : [];
    let audioPath = lines.length ? lines[0].trim() : null;
    let videoId = lines.length > 1 ? lines[1].trim() : null;
    let videoTitle = lines.length > 2 ? lines.slice(2).join(' ').trim() : input;

    // Fallback: SoundCloud when YouTube is blocked (no cover art there)
    if (!audioPath || !fs.existsSync(audioPath)) {
      console.log('⚠️ /song YouTube failed/blocked. Attempting SoundCloud fallback...');
      const scArgs = baseArgs.slice(0, -1).concat(`scsearch1:${input}`);
      res = await ytDlpRun(scArgs, { timeout: 90000 });
      lines = res.ok ? res.stdout.trim().split('\n') : [];
      audioPath = lines.length ? lines[0].trim() : null;
      videoTitle = lines.length > 2 ? lines.slice(2).join(' ').trim() : input;
      videoId = null;
    }

    if (!audioPath || !fs.existsSync(audioPath)) {
      const hint = res.notFound
        ? `❌ Could not find *yt-dlp*.\n\n💡 Run: pip install -U yt-dlp`
        : `❌ Could not download that song.\n\n💡 Make sure the name or URL is valid and public.`;
      return sock.sendMessage(chatId, { text: hint }, { quoted: msg });
    }

    try {
      // Convert to mp3 when the container isn't WA-friendly (mirror /yt)
      let ext = path.extname(audioPath).toLowerCase();
      if (!['.mp3', '.m4a'].includes(ext)) {
        const fixedPath = path.join(TMP_DIR, `song_${Date.now()}.mp3`);
        const conv = await ToolRunner.ffmpegRun([
          '-y', '-i', audioPath, '-vn', '-codec:a', 'libmp3lame', '-qscale:a', '3', fixedPath,
        ]);
        if (conv.ok || fs.existsSync(fixedPath)) {
          try { fs.unlinkSync(audioPath); } catch (e) {}
          audioPath = fixedPath;
          ext = '.mp3';
        }
      }
      const fileName = `${safeName(videoTitle)}${ext === '.m4a' ? '.m4a' : '.mp3'}`;
      const audioBuffer = fs.readFileSync(audioPath);
      const mimetype = ext === '.m4a' ? 'audio/mp4' : 'audio/mpeg';

      // Cover art (YouTube only) — any failure just drops the cover
      let jpegThumbnail = null;
      const tUrl = videoId ? thumbUrl(videoId) : null;
      if (tUrl) {
        try {
          const { buffer, contentType } = await fetchBuffer(tUrl);
          if (buffer && buffer.length > 1000 && buffer.length < 300 * 1024 && String(contentType).includes('image')) {
            jpegThumbnail = buffer;
          }
        } catch (e) { jpegThumbnail = null; }
      }

      if (jpegThumbnail) {
        await sock.sendMessage(chatId, { document: audioBuffer, mimetype, fileName, jpegThumbnail }, { quoted: msg });
      } else {
        await sock.sendMessage(chatId, { audio: audioBuffer, mimetype, fileName, ptt: false }, { quoted: msg });
      }
    } finally {
      try { fs.unlinkSync(audioPath); } catch (e) {}
    }
  },
};

module.exports._safeName = safeName;
module.exports._thumbUrl = thumbUrl;
