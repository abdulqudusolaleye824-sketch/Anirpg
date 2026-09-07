/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — /pindl                            ║
 * ║  Download a specific Pinterest pin (image or video)  ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Different from /pinterest (which SEARCHES). Downloads media from a single
 * Pinterest pin URL.
 *   /pindl <pin-url>   → sends the pin image or video
 *
 * Strategy: yt-dlp's Pinterest extractor throws "No video formats found!" on
 * image-only pins (it always demands a video stream), so instead we scrape the
 * pin page directly and pull the CDN media URL:
 *   - image pin  → full-res i.pinimg.com/originals/<...>.jpg|png|webp
 *   - video pin  → v1.pinimg.com/videos/<res>/<...>.mp4   (highest res we find)
 * yt-dlp is only used as a last-resort fallback if we can't find a direct URL.
 */

'use strict';

const fs         = require('fs');
const path       = require('path');
const os         = require('os');
const https      = require('https');
const http       = require('http');
const ToolRunner = require('../../rpg/utils/ToolRunner');

const COOLDOWNS   = new Map();
const COOLDOWN_MS = 30_000;
const MAX_SIZE_B  = 50 * 1024 * 1024;

// ---------------------------------------------------------------------------
// HTTP helpers (follow redirects to support pin.it short links)
// ---------------------------------------------------------------------------
function httpGet(url, hdrs = {}, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, {
      timeout: 25_000,
      headers: Object.assign({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      }, hdrs),
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        return resolve(httpGet(next, hdrs, depth + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Pinterest request timed out')); });
  });
}

async function getHtml(url) {
  const buf = await httpGet(url, { Accept: 'text/html' });
  return buf.toString('utf8');
}

async function getBuffer(url, referer) {
  const buf = await httpGet(url, referer ? { Referer: referer } : {});
  return buf;
}

async function runYtDlp(args, opts = {}) {
  const res = await ToolRunner.ytDlpRun(args, { timeout: 120_000, ...opts });
  if (!res.ok) throw new Error(res.error || 'yt-dlp failed');
  return res.stdout.trim();
}

// ---------------------------------------------------------------------------
// Pin-page media extraction
// ---------------------------------------------------------------------------
function hasVideoMedia(html) {
  return /"is_video"\s*:\s*true/i.test(html)
      || /pinimg\.com\/videos\/.*\.mp4/i.test(html)
      || /\.m3u8/i.test(html);
}

// Animated GIF detection: a pin hosted as a .gif on i.pinimg.com (GIFs aren't
// "video" to Pinterest, so hasVideoMedia stays false — we must catch them here).
function hasGifMedia(html) {
  return /i\.pinimg\.com\/(originals|[0-9]+x)\/.*\.gif/i.test(html);
}

// Full-size animated GIF URL for a GIF pin (originals preferred).
function extractPinGif(html) {
  const urls = [...new Set([...html.matchAll(/https:\/\/i\.pinimg\.com\/(originals|[0-9]+x)\/[0-9a-f]+\/[0-9a-f]+\/[0-9a-f]+\/[0-9a-f]+\.gif/gi)].map((m) => m[0]))];
  if (!urls.length) return null;
  return urls.find((u) => /\/originals\//.test(u)) || urls[0];
}

// Full-size image URL for an image pin. Groups i.pinimg.com cards by path-hash
// and picks the group repeated across the most size buckets (the pin's image),
// then upsizes to "originals".
const IMG_SIZES = ['originals', '1200x', '736x', '564x', '474x', '236x'];
function extractPinImage(html) {
  const re = /https:\/\/i\.pinimg\.com\/(originals|[0-9]+x)\/([0-9a-f]+\/[0-9a-f]+\/[0-9a-f]+\/[0-9a-f]+\.(?:jpg|png|webp))/gi;
  const byHash = new Map();
  let m;
  while ((m = re.exec(html))) {
    const size = m[1], hash = m[2];
    if (!byHash.has(hash)) byHash.set(hash, { sizes: new Set(), urls: {} });
    const e = byHash.get(hash);
    e.sizes.add(size);
    e.urls[size] = `https://i.pinimg.com/${size}/${hash}`;
  }
  if (!byHash.size) return null;
  const ranked = [...byHash.entries()].sort((a, b) => b[1].sizes.size - a[1].sizes.size);
  const pool = ranked.filter(([, e]) => e.sizes.size >= 2);
  const list = pool.length ? pool : ranked;
  const best = list[0][1];
  const chosen = IMG_SIZES.find((s) => best.urls[s]) || [...best.sizes][0];
  const foundUrl = best.urls[chosen];
  const hash = foundUrl.replace(/^https:\/\/i\.pinimg\.com\/[a-z0-9x]+\//, '');
  // Prefer originals, else the best available size
  if (IMG_SIZES.includes('originals')) {
    return { url: `https://i.pinimg.com/originals/${hash}`, hash };
  }
  return { url: foundUrl, hash };
}

// Direct MP4 URL for a video pin. Grabs the highest-resolution v1.pinimg.com
// video we can find. v1.pinimg.com/videos/<res>/<a>/<b>/<c>/<file>.mp4
function extractPinVideo(html) {
  const re = /https:\/\/[a-z0-9]*\.?pinimg\.com\/videos\/([0-9]+p)\/([^"'\s]+\.(?:mp4|m4v|webm))/gi;
  const found = {}; // res -> url
  let m;
  while ((m = re.exec(html))) {
    const res = m[1];
    const url = m[0];
    // dedupe per res
    found[res] = url;
  }
  // Also catch plain .mp4 video URLs (some pins only surface one)
  for (const u of html.matchAll(/https:\/\/[a-z0-9]*\.?pinimg\.com\/videos\/[^"'\s]+\.(?:mp4|m4v|webm)/gi)) {
    const res = (u[0].match(/\/([0-9]+p)\//) || [])[1] || '0p';
    if (!found[res]) found[res] = u[0];
  }
  const resList = Object.keys(found);
  if (!resList.length) return null;
  // pick highest resolution
  const order = resList.filter((r) => r !== '0p').sort((a, b) => parseInt(b) - parseInt(a));
  const top = order.length ? order[0] : resList[0];
  return found[top];
}

function extractTitle(html) {
  const t = (html.match(/<title>([^<]*)<\/title>/i) || [])[1];
  if (t) return t.replace(/ - Pinterest| \| Pinterest/i, '').trim();
  const og = (html.match(/<meta[^>]+property=["']og:title[^>]+content=["']([^"']+)["']/i) || [])[1];
  return (og || 'Pinterest pin').trim();
}

// Send a static image extracted from the pin page (shared by image + gif fallback).
async function sendImageMedia(sock, chatId, html, title, msg, referer) {
  const im = extractPinImage(html);
  if (!im || !im.url) throw new Error('Could not locate the pin image');
  let buffer;
  try {
    buffer = await getBuffer(im.url, referer);
  } catch (_) {
    buffer = await getBuffer(im.url.replace('/originals/', '/736x/'), referer);
  }
  if (!buffer || buffer.length === 0) throw new Error('Image download failed');
  if (buffer.length > MAX_SIZE_B) throw new Error('File too large to send');

  const sig = buffer.slice(0, 3).toString('hex');
  const mime = sig === 'ffd8ff' ? 'image/jpeg'
             : buffer.slice(0, 4).toString('hex') === '89504e47' ? 'image/png'
             : buffer.slice(0, 4).toString('hex') === '47494638' ? 'image/gif'
             : /\.webp$/i.test(im.url) ? 'image/webp'
             : 'image/jpeg';
  await sock.sendMessage(chatId, {
    image: buffer, mimetype: mime,
    caption: `📌 *${title}*\n📦 ${(buffer.length / 1024 / 1024).toFixed(1)} MB`,
  }, { quoted: msg });
}

// ---------------------------------------------------------------------------
module.exports = {
  name:        'pindl',
  aliases:     ['pinurl', 'pinterestdl', 'pindownload'],
  description: 'Download a specific Pinterest pin (image or video).',
  usage:       '/pindl <pin-url>',
  category:    'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: [
          '📌 *Pinterest Pin Downloader*',
          '',
          '📌 Usage: /pindl <pin-url>',
          '',
          '💡 Downloads one Pinterest pin (image or video):',
          '  /pindl https://www.pinterest.com/pin/123456/',
          '  /pindl https://pin.it/abc123',
          '',
          '🔍 To SEARCH Pinterest for images instead, use: /pinterest <query>',
        ].join('\n'),
      }, { quoted: msg });
    }

    const url = args[0].trim();
    if (!/pinterest\.com|pin\.it|pinterest\.co\.uk/i.test(url)) {
      return sock.sendMessage(chatId, {
        text: '❌ Please paste a valid Pinterest pin link.',
      }, { quoted: msg });
    }

    const last = COOLDOWNS.get(sender) || 0;
    if (Date.now() - last < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
      return sock.sendMessage(chatId, { text: `⏳ Cooldown: ${wait}s remaining.` }, { quoted: msg });
    }
    COOLDOWNS.set(sender, Date.now());

    await sock.sendMessage(chatId, {
      text: `📌 *Downloading Pinterest pin...*\n🔗 ${url}`,
    }, { quoted: msg });

    const tmpDir  = os.tmpdir();
    const outPath = path.join(tmpDir, `anirpg_pin_${Date.now()}.tmp`);
    const referer = 'https://www.pinterest.com/';

    try {
      // 1) scrape the pin page (resolves pin.it short links via redirects)
      const html = await getHtml(url);
      const title = extractTitle(html);

      // 2) classify + extract
      if (hasVideoMedia(html)) {
        const videoUrl = extractPinVideo(html);
        if (videoUrl) {
          // ---- VIDEO pin: direct MP4 download, no yt-dlp ----
          const buffer = await getBuffer(videoUrl, referer);
          if (!buffer || buffer.length === 0) throw new Error('Video download failed');
          if (buffer.length > MAX_SIZE_B) throw new Error('File too large to send');
          await sock.sendMessage(chatId, {
            video: buffer, mimetype: 'video/mp4',
            caption: `🎬 *${title}*\n📦 ${(buffer.length / 1024 / 1024).toFixed(1)} MB`,
          }, { quoted: msg });
        } else {
          // ---- Fallback to yt-dlp for video ----
          // Use an extension template so yt-dlp actually writes a file, then
          // glob for whatever it produced (it may append .mp4/.webm etc.).
          const base = `${outPath.replace(/\.tmp$/, '')}.%(ext)s`;
          await runYtDlp([
            url,
            '--no-playlist', '--no-warnings',
            '-f', 'best[ext=mp4]/bestvideo+bestaudio/best',
            '--merge-output-format', 'mp4',
            '--output', base,
            '--max-filesize', String(MAX_SIZE_B),
          ]);
          const produced = fs.readdirSync(tmpDir)
            .filter((f) => f.startsWith('anirpg_pin_'))
            .map((f) => path.join(tmpDir, f))
            .filter((f) => !f.endsWith('.tmp') && fs.statSync(f).size > 0)
            .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
          if (!produced) throw new Error('Output file not created');
          // move produced file over outPath so the finally cleanup removes it
          try { fs.renameSync(produced, outPath); } catch (_) {}
          const stat = fs.statSync(outPath);
          if (stat.size > MAX_SIZE_B) throw new Error('File too large to send');
          const buffer = fs.readFileSync(outPath);
          await sock.sendMessage(chatId, {
            video: buffer, mimetype: 'video/mp4',
            caption: `🎬 *${title}*\n📦 ${(stat.size / 1024 / 1024).toFixed(1)} MB`,
          }, { quoted: msg });
        }
      } else if (hasGifMedia(html)) {
        // ---- GIF pin: send as an ANIMATED gif (gifPlayback), not a static frame ----
        const gifUrl = extractPinGif(html);
        if (!gifUrl) throw new Error('Could not locate the pin GIF');
        let buffer;
        try {
          buffer = await getBuffer(gifUrl, referer);
        } catch (_) {
          // fall back to a smaller size
          const small = gifUrl.replace(/\/originals\//, '/736x/').replace(/\/([0-9]+x)\//, '/736x/');
          buffer = await getBuffer(small, referer);
        }
        if (!buffer || buffer.length === 0) throw new Error('GIF download failed');
        // only treat as gif if it's actually a GIF; else fall through below
        if (buffer.slice(0, 4).toString('hex') === '47494638') {
          if (buffer.length > MAX_SIZE_B) throw new Error('File too large to send');
          await sock.sendMessage(chatId, {
            video:        buffer,
            gifPlayback:  true,
            mimetype:     'image/gif',
            caption:      `🎞️ *${title}*\n📦 ${(buffer.length / 1024 / 1024).toFixed(1)} MB`,
          }, { quoted: msg });
        } else {
          // not really a gif — send as a static image instead
          await sendImageMedia(sock, chatId, html, title, msg, referer);
        }
      } else {
        // ---- IMAGE pin: direct full-res download ----
        await sendImageMedia(sock, chatId, html, title, msg, referer);
      }

      await sock.sendMessage(chatId, { text: `✅ Done!` }, { quoted: msg });

    } catch (err) {
      console.error('❌ /pindl error:', err.message);
      const isToolMissing = /tool-not-found|not found|not set|no such|is not recognized|command not found/i.test(err.message);
      return sock.sendMessage(chatId, {
        text: [
          '❌ Download failed.',
          `🔧 ${err.message}`,
          '',
          isToolMissing
            ? '⚠ Could not find yt-dlp. Run:  pip install -U yt-dlp\n(Or add YTDLP_PATH to .env.)'
            : '💡 Make sure the pin is public, or try /pinterest <query> to search for images.',
        ].join('\n'),
      }, { quoted: msg });
    } finally {
      try { fs.unlinkSync(outPath); } catch (_) {}
    }
  },
};
