// ═══════════════════════════════════════════════════════════════
// /song — YouTube → MP3 with cover art (standalone, batch-23;
// multi-candidate search, batch-30).
// Name queries now pull a candidate LIST (ytsearch5, duration-filtered)
// and try each video in turn until one downloads — the old blind
// ytsearch1 grab failed whenever the top hit was blocked, long, or
// region-locked, which is why famous songs flopped. Direct URLs keep
// the single-shot path; SoundCloud stays the last resort. Cover art
// comes from the winning video id (maxres → hq fallback). Any
// cover/download hiccup falls back gracefully (plain audio, then
// error text) — never a crash.
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

const SEARCH_COUNT = 5;    // candidates pulled per YouTube search
const MAX_TRIES    = 4;    // videos attempted before giving up on YouTube
const MAX_DURATION = 1200; // seconds — skip mixes/compilations over 20 min

function safeName(title) {
  const s = String(title || 'song').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return s || 'song';
}

function thumbUrl(id) {
  if (!/^[\w-]{6,20}$/.test(String(id || ''))) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function extractVideoId(url) {
  const m = String(url || '').match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,20})/);
  return m ? m[1] : null;
}

// Parse `--print "%(id)s | %(title)s | %(duration)s"` flat-playlist output
// into [{ id, title, duration|null }], dropping over-long videos.
function parseCandidates(stdout) {
  const out = [];
  for (const raw of String(stdout || '').split('\n')) {
    const parts = raw.split(' | ');
    if (parts.length < 2) continue;
    const id = (parts[0] || '').trim();
    if (!/^[\w-]{6,20}$/.test(id)) continue;
    const title = parts.slice(1, -1).join(' | ').trim() || parts[1].trim();
    const durRaw = parts.length > 2 ? parts[parts.length - 1].trim() : '';
    const dur = durRaw !== '' && !/^NA$/i.test(durRaw) ? parseFloat(durRaw) : NaN;
    const duration = Number.isFinite(dur) ? dur : null;
    if (duration !== null && duration > MAX_DURATION) continue; // mixes / comps
    out.push({ id, title: title || id, duration });
    if (out.length >= MAX_TRIES) break;
  }
  return out;
}

async function searchYouTube(query) {
  const res = await ytDlpRun([
    '--no-playlist',
    '--flat-playlist',
    '--print', '%(id)s | %(title)s | %(duration)s',
    '--no-download',
    `ytsearch${SEARCH_COUNT}:${query}`,
  ], { timeout: 30000 });
  if (!res || !res.ok) return { ok: false, notFound: !!(res && res.notFound), candidates: [] };
  return { ok: true, notFound: false, candidates: parseCandidates(res.stdout) };
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

// Best cover for a video id: maxres when it's a real (large) thumbnail,
// otherwise the always-present hqdefault. Null when nothing usable.
async function bestCover(id) {
  if (!/^[\w-]{6,20}$/.test(String(id || ''))) return null;
  const tiers = [
    { url: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, min: 20 * 1024 },
    { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, min: 1000 },
  ];
  for (const t of tiers) {
    try {
      const { buffer, contentType } = await fetchBuffer(t.url);
      if (buffer && buffer.length >= t.min && buffer.length < 300 * 1024 && String(contentType).includes('image')) {
        return buffer;
      }
    } catch (e) { /* try next tier */ }
  }
  return null;
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
    const aud = await ToolRunner.optimalAudioArgs();
    let sawNotFound = false;

    // ── Candidate list: URL = single shot; query = searched videos ──
    let candidates;
    if (isUrl) {
      candidates = [{ target: input, id: extractVideoId(input), title: input }];
    } else {
      let s = await searchYouTube(input);
      sawNotFound = sawNotFound || s.notFound;
      // Empty-but-healthy search → one retry biased at official uploads.
      if (s.ok && s.candidates.length === 0) {
        s = await searchYouTube(`${input} official audio`);
        sawNotFound = sawNotFound || s.notFound;
      }
      candidates = s.ok
        ? s.candidates.map((c) => ({ target: `https://www.youtube.com/watch?v=${c.id}`, id: c.id, title: c.title }))
        : [];
    }

    // ── Try each candidate until one downloads ──
    let audioPath = null, videoId = null, videoTitle = input;
    for (const c of candidates.slice(0, MAX_TRIES)) {
      const outTemplate = path.join(TMP_DIR, `song_${Date.now()}.%(ext)s`);
      const res = await ytDlpRun([
        '--no-playlist',
        ...aud.args,
        '--max-filesize', '25m',
        '--output', outTemplate,
        '--print', 'after_move:filepath',
        '--print', 'id',
        '--print', 'title',
        c.target,
      ], { timeout: 60000 });
      sawNotFound = sawNotFound || !!(res && res.notFound);
      const lines = res && res.ok ? String(res.stdout || '').trim().split('\n') : [];
      const p = lines.length ? lines[0].trim() : null;
      if (p && fs.existsSync(p)) {
        audioPath = p;
        videoId = (lines.length > 1 && lines[1].trim()) || c.id || null;
        videoTitle = lines.length > 2 ? lines.slice(2).join(' ').trim() : (c.title || input);
        break;
      }
    }

    // Fallback: SoundCloud when YouTube is blocked (no cover art there)
    if (!audioPath) {
      const outTemplate = path.join(TMP_DIR, `song_${Date.now()}.%(ext)s`);
      const res = await ytDlpRun([
        '--no-playlist',
        ...aud.args,
        '--max-filesize', '25m',
        '--output', outTemplate,
        '--print', 'after_move:filepath',
        '--print', 'id',
        '--print', 'title',
        `scsearch1:${input}`,
      ], { timeout: 90000 });
      sawNotFound = sawNotFound || !!(res && res.notFound);
      const lines = res && res.ok ? String(res.stdout || '').trim().split('\n') : [];
      const p = lines.length ? lines[0].trim() : null;
      if (p && fs.existsSync(p)) {
        audioPath = p;
        videoTitle = lines.length > 2 ? lines.slice(2).join(' ').trim() : input;
        videoId = null;
      }
    }

    if (!audioPath || !fs.existsSync(audioPath)) {
      const hint = sawNotFound
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
      const jpegThumbnail = videoId ? await bestCover(videoId) : null;

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
module.exports._parseCandidates = parseCandidates;
module.exports._extractVideoId = extractVideoId;
