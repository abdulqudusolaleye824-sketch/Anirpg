// ═══════════════════════════════════════════════════════════════
// /song — YouTube → MP3 with cover art (standalone, batch-23;
// multi-candidate search, batch-30; search bypass + debug, batch-35).
// Name queries now pull a candidate LIST (ytsearch5, duration-filtered)
// and try each video in turn until one downloads — the old blind
// ytsearch1 grab failed whenever the top hit was blocked, long, or
// region-locked, which is why famous songs flopped. Direct URLs keep
// the single-shot path; SoundCloud stays the last resort. Cover art
// comes from the winning video id (maxres → hq fallback). Any
// cover/download hiccup falls back gracefully (plain audio, then
// error text) — never a crash.
// Batch-35: the SEARCH now uses the same anti-bot client combo +
// cookies as downloads (it previously searched with bare defaults,
// so a blocked search silently yielded zero candidates); each
// candidate retries as raw bestaudio when mp3 conversion fails; the
// error message carries yt-dlp's real stderr tail + a smart hint so
// a fine song name is never blamed for a blocked downloader.
// ═══════════════════════════════════════════════════════════════
'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const ToolRunner = require('../../rpg/utils/ToolRunner');
const { ytDlpRun, youtubeCookiesArgs, YOUTUBE_EXTRACTOR_ARGS_FULL } = ToolRunner;
// Batch-36: order-independent print parser (real one from ToolRunner,
// inline copy as fallback so partial test doubles keep working).
const parsePrints = ToolRunner.parseDownloadPrints || ((stdout, fbId, fbTitle) => {
  const clean = String(stdout || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const fp = clean.find((l) => { try { return fs.existsSync(l); } catch (e) { return false; } }) || null;
  const thumb = clean.find((l) => l !== fp && /^https?:\/\/\S+$/i.test(l)) || null;
  const rest = clean.filter((l) => l !== fp && l !== thumb);
  const id = rest.find((l) => /^[\w-]{6,20}$/.test(l)) || null;
  const title = rest.filter((l) => l !== id).join(' ').trim() || null;
  return { p: fp, id: id || fbId || null, title: title || fbTitle || null, thumb };
});

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

// Parse `--print "%(id)s | %(webpage_url)s | %(title)s | %(duration)s"`
// SoundCloud flat output into [{ id, target, title, duration|null }].
function parseSCCandidates(stdout) {
  const out = [];
  for (const raw of String(stdout || '').split('\n')) {
    const parts = raw.split(' | ');
    if (parts.length < 3) continue;
    const id = (parts[0] || '').trim();
    const url = (parts[1] || '').trim();
    if (!id || !/^https?:\/\//.test(url)) continue;
    const durRaw = parts[parts.length - 1].trim();
    const dur = durRaw !== '' && !/^NA$/i.test(durRaw) ? parseFloat(durRaw) : NaN;
    const duration = Number.isFinite(dur) ? dur : null;
    if (duration !== null && duration > MAX_DURATION) continue;
    const title = parts.slice(2, -1).join(' | ').trim() || id;
    out.push({ id, target: url, title, duration });
    if (out.length >= MAX_TRIES) break;
  }
  return out;
}

async function searchYouTube(query) {
  const bypass = (YOUTUBE_EXTRACTOR_ARGS_FULL || []).concat(
    typeof youtubeCookiesArgs === 'function' ? youtubeCookiesArgs() : []
  );
  const res = await ytDlpRun([
    '--no-playlist',
    ...bypass,
    '--flat-playlist',
    '--print', '%(id)s | %(title)s | %(duration)s',
    '--no-download',
    `ytsearch${SEARCH_COUNT}:${query}`,
  ], { timeout: 30000 });
  if (!res || !res.ok) return { ok: false, notFound: !!(res && res.notFound), error: (res && res.error) || '', candidates: [] };
  return { ok: true, notFound: false, error: '', candidates: parseCandidates(res.stdout) };
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
    let firstErr = ''; // first failure (usually YouTube) — lastErr is often just the fallback
    let lastErr = ''; // yt-dlp's real stderr tail → shown on failure (debug)
    const noteErr = (res) => { if (res && !res.ok && res.error) { if (!firstErr) firstErr = String(res.error); lastErr = String(res.error); } };

    // ── Candidate list: URL = single shot; query = searched videos ──
    let candidates;
    if (isUrl) {
      candidates = [{ target: input, id: extractVideoId(input), title: input }];
    } else {
      let s = await searchYouTube(input);
      sawNotFound = sawNotFound || s.notFound;
      noteErr({ ok: s.ok, error: s.error });
      // Empty-but-healthy search → one retry biased at official uploads.
      if (s.ok && s.candidates.length === 0) {
        s = await searchYouTube(`${input} official audio`);
        sawNotFound = sawNotFound || s.notFound;
        noteErr({ ok: s.ok, error: s.error });
      }
      candidates = s.ok
        ? s.candidates.map((c) => ({ target: `https://www.youtube.com/watch?v=${c.id}`, id: c.id, title: c.title }))
        : [];
    }

    // ── Try each candidate until one downloads ──
    // When the mp3-conversion args fail, retry the same video as raw
    // bestaudio (no ffmpeg needed) — unless the failure is one a retry
    // can't fix (blocked/gone videos fail identically), in which case
    // we move to the next candidate immediately.
    const rawAudioArgs = (YOUTUBE_EXTRACTOR_ARGS_FULL || []).concat(
      typeof youtubeCookiesArgs === 'function' ? youtubeCookiesArgs() : [],
      ['-f', 'bestaudio[ext=m4a]/bestaudio']
    );
    const needsConvert = aud.args.includes('--extract-audio');
    const FUTILE_DL = /sign in|not a bot|bot check|forbidden|403|unavailable|private|not found|404|unsupported url|no video|blocked/i;
    const tryDl = async (c, a) => {
      const outTemplate = path.join(TMP_DIR, `song_${Date.now()}.%(ext)s`);
      const r = await ytDlpRun([
        '--no-playlist',
        ...a,
        '--max-filesize', '25m',
        '--output', outTemplate,
        '--print', 'after_move:filepath',
        '--print', 'id',
        '--print', 'title',
        '--print', 'thumbnail',
        c.target,
      ], { timeout: 60000 });
      noteErr(r);
      sawNotFound = sawNotFound || !!(r && r.notFound);
      return r;
    };
    const partsOf = (res, c) => {
      if (!res || !res.ok) return { p: null, id: (c && c.id) || null, title: (c && c.title) || input };
      return parsePrints(res.stdout, c && c.id, c && c.title);
    };
    let audioPath = null, videoId = null, videoTitle = input, thumbUrl = null;
    for (const c of candidates.slice(0, MAX_TRIES)) {
      let res = await tryDl(c, aud.args);
      let parts = partsOf(res, c);
      if (!parts.p && needsConvert && !FUTILE_DL.test((res && !res.ok && res.error) || '')) {
        res = await tryDl(c, rawAudioArgs);
        parts = partsOf(res, c);
      }
      if (parts.p) {
        audioPath = parts.p;
        videoId = parts.id;
        videoTitle = parts.title || input;
        thumbUrl = parts.thumb || null;
        break;
      }
    }

    // Fallback: SoundCloud when YouTube fails — searched as a candidate
    // LIST (a lone scsearch1 hit is often DRM-gated), tried in turn.
    // Skipped for URL input — searching a URL string is nonsense.
    if (!audioPath && !isUrl) {
      const sc = await ytDlpRun([
        '--no-playlist',
        '--flat-playlist',
        '--print', '%(id)s | %(webpage_url)s | %(title)s | %(duration)s',
        '--no-download',
        `scsearch${SEARCH_COUNT}:${input}`,
      ], { timeout: 30000 });
      noteErr(sc);
      sawNotFound = sawNotFound || !!(sc && sc.notFound);
      const scCands = sc && sc.ok ? parseSCCandidates(sc.stdout) : [];
      for (const c of scCands) {
        let res = await tryDl(c, aud.args);
        let parts = parsePrints(res && res.ok ? res.stdout : '', c.id, c.title);
        if (!parts.p && needsConvert && !FUTILE_DL.test((res && !res.ok && res.error) || '')) {
          res = await tryDl(c, rawAudioArgs);
          parts = parsePrints(res && res.ok ? res.stdout : '', c.id, c.title);
        }
        if (parts.p) {
          audioPath = parts.p;
          videoTitle = parts.title || input;
          videoId = null;
          thumbUrl = parts.thumb || null;
          break;
        }
      }
    }

    if (!audioPath || !fs.existsSync(audioPath)) {
      const dbgFirst = firstErr.replace(/\s+/g, ' ').trim().slice(0, 140);
      const dbgLast = lastErr.replace(/\s+/g, ' ').trim().slice(0, 140);
      const both = firstErr + ' ' + lastErr;
      let hint;
      if (sawNotFound) {
        hint = `❌ Could not find *yt-dlp*.\n\n💡 Run: pip install -U yt-dlp`;
      } else if (/sign in|confirm you|not a bot|bot check|403|forbidden/i.test(both)) {
        hint = `❌ YouTube is blocking downloads right now.\n\n💡 The song name is fine — update yt-dlp (pip install -U yt-dlp) or set YT_COOKIES in .env, then try again.`;
      } else {
        hint = `❌ Could not download that song.\n\n💡 Make sure the name or URL is valid and public.`;
      }
      if (!sawNotFound && (dbgFirst || dbgLast)) {
        hint += (dbgFirst && dbgLast && dbgFirst !== dbgLast)
          ? `\n\n_(debug: ${dbgFirst} ⟷ ${dbgLast})_`
          : `\n\n_(debug: ${dbgFirst || dbgLast})_`;
      }
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

      // Cover art: YouTube id first, else the winner's thumbnail URL
      // (covers SoundCloud wins too) — any failure just drops the cover.
      let jpegThumbnail = videoId ? await bestCover(videoId) : null;
      if (!jpegThumbnail && thumbUrl) jpegThumbnail = await bestThumb(thumbUrl);

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

// Fetch + validate a thumbnail URL (SoundCloud winners). Null on any issue.
async function bestThumb(url) {
  if (!/^https?:\/\/\S+$/i.test(String(url || ''))) return null;
  try {
    const { buffer, contentType } = await fetchBuffer(url);
    if (buffer && buffer.length >= 1000 && buffer.length < 300 * 1024 && String(contentType).includes('image')) {
      return buffer;
    }
  } catch (e) {}
  return null;
}

module.exports._safeName = safeName;
module.exports._thumbUrl = thumbUrl;
module.exports._parseCandidates = parseCandidates;
module.exports._parseSCCandidates = parseSCCandidates;
module.exports._extractVideoId = extractVideoId;
