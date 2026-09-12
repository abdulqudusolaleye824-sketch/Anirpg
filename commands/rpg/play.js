// /play — look up a song and deliver it as a WhatsApp VOICE NOTE + cover image.
// Usage: /play <title> | <artist>   (artist optional but recommended)
//        /play <youtube url>         (exact link skips the search)
//
// Batch-43: replaces the scrapped audio command. Strict matching so wrong-track
// mashups NEVER deliver: the title must match as a phrase, a supplied
// artist must appear in the video title or channel, mixes/mashups/covers
// are penalised, and anything over 10 min is skipped. When nothing
// passes, the bot says so instead of sending the wrong song.
// Batch-44: delivery cascade (YouTube → SoundCloud → Piped).
// Batch-45: EVERY backend probed live from a server. Verdict: Piped is
// DEAD (12/12 API instances down — stage removed, it only added
// timeouts); mp3juice converters dead/empty; Invidious API closed on all
// public instances; archive.org has nothing usable for mainstream
// tracks. What VERIFIABLY works: YouTube locate+download (host
// permitting) and SoundCloud search + non-DRM downloads. So: deeper SC
// (8 results, top 3 tried) + slowed/sped-up hard reject + duration
// sanity vs the YouTube pick (no wrong-speed/wrong-cut audio), and FULL
// SILENCE — no lookup/fetching/fallback chatter, no source names
// anywhere. Just the cover + the voice note.
// Batch-46 (owner order): YouTube ONLY — find the video, extract the
// audio, send it back. SoundCloud stage removed. Non-IP blocks are
// bypassed with an escalating ladder per video: optimal args → same +
// player_skip=webpage (dodges webpage JS blocks) → loose
// -f bestaudio/best → -f best full download + mp3 extract (ffmpeg).
// IP-flagged hosts still need YT_COOKIES (already honoured).
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const ToolRunner = require('../../rpg/utils/ToolRunner');

const COOLDOWN_MS = 15000;
const MAX_DURATION_S = 600;   // 10 min — kills hour-long mixes
const MIN_DURATION_S = 30;
const MIN_SCORE = 0.75;
const cooldowns = new Map(); // sender -> last-run timestamp

// ── Pure helpers (exported for tests) ──────────────────────────────────

function _parseQuery(text) {
  const parts = String(text || '').split('|').map((s) => s.trim());
  return { title: parts[0] || '', artist: parts.slice(1).join('|').trim() };
}

function _extractVideoId(text) {
  const s = String(text || '');
  let m = s.match(/[?&]v=([\w-]{6,20})/) || s.match(/youtu\.be\/([\w-]{6,20})/) || s.match(/\/shorts\/([\w-]{6,20})/);
  return m ? m[1] : null;
}

function _safeName(s) {
  return String(s || 'track').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 60) || 'track';
}

const STOPWORDS = new Set(['official', 'audio', 'video', 'lyrics', 'lyric', 'mv', 'hd', 'hq', '4k', 'feat', 'ft', 'prod', 'explicit', 'remastered']);
function _tokens(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
}
function _phrase(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Parse `--print %(id)s | %(title)s | %(duration)s | %(channel)s` rows.
// Titles may contain '|' — id is always FIRST, channel LAST, duration
// second-to-last, everything between is the title.
function _parseSearchRows(stdout) {
  const out = [];
  for (const line of String(stdout || '').split('\n')) {
    const parts = line.split(' | ').map((s) => s.trim());
    if (parts.length < 3) continue;
    const id = parts[0];
    if (!/^[\w-]{6,20}$/.test(id)) continue;
    const channel = parts.length >= 4 ? parts[parts.length - 1] : '';
    const durRaw = parts[parts.length - 2];
    const title = parts.slice(1, -2).join(' | ') || (parts.length === 3 ? parts[1] : '');
    if (!title) continue;
    const duration = /^\d+$/.test(durRaw || '') ? parseInt(durRaw, 10) : null;
    if (duration !== null && (duration > MAX_DURATION_S || duration < MIN_DURATION_S)) continue;
    out.push({ id, title, duration, channel });
  }
  return out;
}

const DEMOTE = [
  [/\bmashup\b/i, 0.5], [/\bmix\b/i, 0.4], [/\bcompilation\b/i, 0.4],
  [/\bplaylist\b/i, 0.4], [/\bkaraoke\b/i, 0.4], [/\bsped\s*up\b/i, 0.4],
  [/\bslowed\b/i, 0.4], [/\bcover\b/i, 0.35], [/\b10\s*hours?\b/i, 0.5],
  [/\b1\s*hour\b/i, 0.5], [/\s+x\s+/i, 0.2], [/\svs\.?\s/i, 0.2],
  [/\blive\b/i, 0.15], [/\bloop\b/i, 0.3],
];

// Hard mashup reject: "Title (Artist) x OtherSong (Others)" — when a title
// splits on x/vs/&/+ into segments and a NON-title segment carries 2+
// content tokens matching neither the title nor the artist, it is a
// mashup/medley, not the song. (This exact shape caused the old
// "oh no(rema) x kante" scandal.)
const SEGSPLIT = /\s+(?:x|vs\.?|&|\+)\s+/i;
const SPEEDSU = /slowed|sped\s*up|speed\s*up|nightcore|\b8d\b/i;
function _looksMashup(videoTitle, title, artist) {
  const segs = String(videoTitle || '').split(SEGSPLIT);
  if (segs.length < 2) return false;
  const tToks = _tokens(title), aToks = _tokens(artist);
  const phrase = _phrase(title);
  for (const seg of segs) {
    if (phrase && _phrase(seg).includes(phrase)) continue; // title's own segment
    const sToks = _tokens(seg);
    if (sToks.length >= 2 && !sToks.some((w) => tToks.includes(w) || aToks.includes(w))) return true;
  }
  return false;
}

function _scoreCandidate(c, title, artist) {
  const tToks = _tokens(title);
  if (!tToks.length) return { score: 0, artistOk: false };
  if (_looksMashup(c.title, title, artist)) return { score: -1, artistOk: false };
  // Wrong-speed audio is wrong audio — unless the query asks for it.
  if (SPEEDSU.test(c.title || '') && !SPEEDSU.test(title || '')) return { score: -1, artistOk: false };
  const vNorm = _phrase(c.title);
  const vToks = new Set(_tokens(c.title));
  const hits = tToks.filter((w) => vToks.has(w)).length;
  let score = hits / tToks.length;
  // Exact-phrase bonus: the full title appears contiguously.
  if (vNorm.includes(_phrase(title))) score += 0.3;
  // Artist channel bonus (official uploads).
  const aToks = _tokens(artist);
  const chNorm = _phrase(c.channel || '');
  if (aToks.length && aToks.some((w) => chNorm.includes(w))) score += 0.2;
  for (const [re, pen] of DEMOTE) {
    if (re.test(c.title)) score -= pen;
  }
  // Artist gate: a supplied artist must show up in title or channel.
  let artistOk = true;
  if (aToks.length) {
    const hay = vNorm + ' ' + chNorm;
    const matched = aToks.filter((w) => hay.includes(w)).length;
    artistOk = matched >= Math.max(1, Math.ceil(aToks.length / 2));
  }
  return { score, artistOk };
}

function _pickBest(rows, title, artist) {
  const scored = rows.map((c) => ({ c, ..._scoreCandidate(c, title, artist) }))
    .filter((s) => s.artistOk && s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.c);
}

function _fmtDur(sec) {
  if (!sec) return '';
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Batch-46 fix (found by live verification): label the REAL container —
// no-ffmpeg downloads are m4a/webm, not mp3.
function _mimeFor(p) {
  const e = String(p || '').toLowerCase().split('.').pop();
  if (e === 'm4a' || e === 'mp4') return 'audio/mp4';
  if (e === 'webm') return 'audio/webm';
  if (e === 'ogg' || e === 'opus') return 'audio/ogg; codecs=opus';
  return 'audio/mpeg';
}

// ── Network helpers ────────────────────────────────────────────────────

function _thumbUrl(id, q) {
  if (!/^[\w-]{6,20}$/.test(id || '')) return null;
  return `https://i.ytimg.com/vi/${id}/${q}default.jpg`;
}

function _fetchBuf(url, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    try {
      const req = https.get(url, (res) => {
        const ct = String(res.headers['content-type'] || '');
        if (res.statusCode !== 200 || !ct.includes('image')) { res.resume(); return finish(null); }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => finish(Buffer.concat(chunks)));
      });
      req.on('error', () => finish(null));
      req.setTimeout(timeoutMs, () => { try { req.destroy(); } catch (e) {} finish(null); });
    } catch (e) { finish(null); }
  });
}

async function _fetchCover(id) {
  // maxres (HD) first, hq fallback — either must be a real photo, not a
  // 120px grey placeholder (those are tiny).
  const max = await _fetchBuf(_thumbUrl(id, 'maxres'));
  if (max && max.length > 8000) return max;
  const hq = await _fetchBuf(_thumbUrl(id, 'hq'));
  if (hq && hq.length > 2000) return hq;
  return null;
}

// ── Command ─────────────────────────────────────────────────────────────

module.exports = {
  name: 'play',
  aliases: ['music'],
  description: '🎵 Play a song as a voice note + cover image',
  usage: '/play <title> | <artist>',
  category: 'music',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const say = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });
    const raw = (args || []).join(' ').trim();
    if (!raw) {
      return say(`🎵 *Usage:* /play <title> | <artist>\n\nExample: /play oh no | rema\nA YouTube link also works: /play <url>`);
    }

    // Cooldown (15s per user — downloads are expensive).
    const now = Date.now();
    const last = cooldowns.get(sender) || 0;
    if (now - last < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
      return say(`⏳ Wait ${wait}s before playing another track.`);
    }
    cooldowns.set(sender, now);

    // Direct URL → exact download, no search/matching.
    const directId = _extractVideoId(raw);
    let pick = null;
    let ytTitle = '', ytArtist = '', ytRowCount = 0;

    if (directId) {
      pick = { id: directId, title: raw.slice(0, 80), duration: null, channel: '' };
    } else {
      const { title, artist } = _parseQuery(raw);
      if (!title) return say(`🎵 *Usage:* /play <title> | <artist>`);

      const query = `ytsearch6:${title}${artist ? ' ' + artist : ''} official audio`;
      let search;
      try {
        search = await ToolRunner.ytDlpRun([
          ...ToolRunner.YOUTUBE_EXTRACTOR_ARGS_FULL,
          ...ToolRunner.youtubeCookiesArgs(),
          '--flat-playlist',
          '--print', '%(id)s | %(title)s | %(duration)s | %(channel)s',
          query,
        ]);
      } catch (e) { search = { ok: false, error: e.message }; }

      if (!search || !search.ok) {
        if (search && search.notFound) {
          return say(`❌ yt-dlp isn't installed on the host — ask the owner to install it.`);
        }
        console.error('/play search failed:', search && search.error);
        return say(`❌ Search failed — try again in a bit.`);
      }

      const rows = _parseSearchRows(search.stdout);
      const best = _pickBest(rows, title, artist);
      ytTitle = title; ytArtist = artist; ytRowCount = rows.length;
      if (best.length) {
        pick = best[0];
        // Keep a backup in case the best download fails.
        pick._backup = best[1] || null;
      }
    }

    // ── Batch-46: YouTube ONLY — best + backup through the bypass ladder ──
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anirpg-play-'));
    const finishTmp = () => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {} };
    try {
      let audio;
      try {
        audio = await ToolRunner.optimalAudioArgs();
      } catch (e) { audio = { ffmpeg: false, args: ['-f', 'bestaudio[ext=m4a]/bestaudio'] }; }

      // Batch-46 bypass ladder (non-IP blocks): same video, escalating
      // methods. Blocks fail fast (403s), so the ladder is cheap.
      const _withSkip = (args) => {
        const out = [];
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '--extractor-args' && i + 1 < args.length) {
            out.push(args[i], args[i + 1] + ',player_skip=webpage');
            i++;
          } else out.push(args[i]);
        }
        return out;
      };
      const _withFormat = (args, fmt) => {
        const out = [];
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '-f' && i + 1 < args.length) { out.push('-f', fmt); i++; }
          else out.push(args[i]);
        }
        if (!args.includes('-f')) out.push('-f', fmt);
        return out;
      };
      const _attemptsFor = () => {
        const sets = [audio.args, _withSkip(audio.args), _withFormat(audio.args, 'bestaudio/best')];
        // Last resort (ffmpeg only): full video + mp3 extract. Without
        // ffmpeg this would yield an unplayable video file, so skip it.
        if (audio.ffmpeg) sets.push(_withFormat(audio.args, 'best'));
        return sets;
      };
      const dlAttempt = async (videoId, fbTitle, argSet) => {
        let res;
        try {
          res = await ToolRunner.ytDlpRun([
            ...argSet,
            '--no-playlist',
            '--output', path.join(tmpDir, 'track.%(ext)s'),
            '--print', 'after_move:filepath',
            '--print', 'id',
            '--print', 'title',
            `https://www.youtube.com/watch?v=${videoId}`,
          ]);
        } catch (e) { return null; }
        if (!res || !res.ok || res.notFound) return null;
        const parsed = ToolRunner.parseDownloadPrints(res.stdout, videoId, fbTitle);
        if (!parsed || !parsed.p) return null;
        try { if (!fs.existsSync(parsed.p)) return null; } catch (e) { return null; }
        return parsed;
      };
      const dlVideo = async (videoId, fbTitle) => {
        for (const set of _attemptsFor()) {
          const parsed = await dlAttempt(videoId, fbTitle, set);
          if (parsed) return parsed;
        }
        return null;
      };

      // result = { file, title, id, channel, duration }
      let result = null;

      // YouTube best + backup, each through the full bypass ladder.
      if (pick) {
        let parsed = await dlVideo(pick.id, pick.title);
        let used = pick;
        if (!parsed && pick._backup) {
          console.log(`/play: best failed, trying backup ${pick._backup.id}`);
          parsed = await dlVideo(pick._backup.id, pick._backup.title);
          if (parsed) used = pick._backup;
        }
        if (parsed) {
          result = {
            file: parsed.p, title: parsed.title || used.title,
            id: parsed.id || used.id, channel: used.channel || 'YouTube',
            duration: used.duration,
          };
        }
      }

      if (!result) {
        if (!pick) {
          return say([
            `❌ No exact match for *${ytTitle}*${ytArtist ? ` — *${ytArtist}*` : ''}.`,
            `I'd rather send nothing than the wrong song.`,
            ``,
            `💡 Check the spelling, or add the artist: /play ${ytTitle} | <artist>`,
          ].join('\n'));
        }
        console.error('/play: all sources failed for', pick.id);
        return say(`❌ Couldn't get that track right now — try again in a bit.`);
      }

      // Convert to opus voice note when ffmpeg exists.
      let voicePath = result.file, mime = _mimeFor(result.file);
      if (audio.ffmpeg) {
        const ogg = path.join(tmpDir, 'voice.ogg');
        try {
          const cv = await ToolRunner.ffmpegRun(['-y', '-i', result.file, '-c:a', 'libopus', '-b:a', '64k', '-vn', ogg]);
          if (cv && cv.ok && fs.existsSync(ogg) && fs.statSync(ogg).size > 0) {
            voicePath = ogg; mime = 'audio/ogg; codecs=opus';
          } else {
            console.error('/play opus convert failed, sending original:', cv && cv.error);
          }
        } catch (e) { console.error('/play opus convert threw, sending original:', e.message); }
      }
      const buf = fs.readFileSync(voicePath);
      const label = `${_safeName(result.title)}`;
      const durTxt = result.duration ? ` (${_fmtDur(result.duration)})` : '';

      // Cover image first, then the voice note.
      const cover = result.id ? await _fetchCover(result.id) : null;
      if (cover) {
        await sock.sendMessage(chatId, {
          image: cover,
          caption: `🎵 *${label}*${durTxt}`,
        }, { quoted: msg });
      }
      const outExt = (String(voicePath).split('.').pop() || 'mp3').toLowerCase();
      await sock.sendMessage(chatId, {
        audio: buf,
        mimetype: mime,
        ptt: true,
        fileName: `${label}.${outExt}`,
      }, { quoted: msg });
    } finally {
      finishTmp();
    }
  },

  // Test hooks (pure).
  _parseQuery, _extractVideoId, _safeName, _parseSearchRows, _scoreCandidate, _pickBest, _looksMashup, _mimeFor,
};
