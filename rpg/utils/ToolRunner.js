/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — ToolRunner                          ║
 * ║  Find & run yt-dlp / ffmpeg even when NOT on PATH.   ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Why this exists:
 *   • `pip install yt-dlp` on Windows drops the binary into Python's
 *     Scripts folder, which is often NOT on PATH.
 *   • yt-dlp spawns its OWN ffmpeg for audio conversion & video merge, so
 *     even if we find yt-dlp, downloads still need ffmpeg.
 *
 * We probe several known invocation forms (bare binary + `python -m yt_dlp`)
 * and use the first one that actually runs. Results are cached per boot.
 *
 * Env overrides (set in .env) are honoured first:
 *   YTDLP_PATH  = <path to yt-dlp binary>
 *   FFMPEG_PATH = <path to ffmpeg binary>
 */

'use strict';

const { execFile } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const YTDLP_CANDS = [
  ['python', '-m', 'yt_dlp'],
  ['python3', '-m', 'yt_dlp'],
  ['py', '-3', '-m', 'yt_dlp'],
  ['py', '-m', 'yt_dlp'],
  ['yt-dlp'], ['yt-dlp.exe'], ['yt-dlp.bat'],
];
const FFMPEG_CANDS = [['ffmpeg'], ['ffmpeg.exe']];
const _resolved = new Map();

// Probe timeout used to detect a genuinely-missing binary.
const MISSING_TTL_MS = 60_000; // if not found, re-probe at most every 60s

function resolveTool(cands, versionArg, key) {
  const cached = _resolved.get(key);
  if (cached) {
    // Positive result cached forever (or until TTL, whichever).
    if (!cached.ts || (Date.now() - cached.ts) < MISSING_TTL_MS) return Promise.resolve(cached.tool);
    if (cached.tool) return Promise.resolve(cached.tool);
  }
  return new Promise((resolve) => {
    (function tryNext(i) {
      if (i >= cands.length) {
        // Remember "not found" briefly so we re-probe later (installs picked up).
        _resolved.set(key, { tool: null, ts: Date.now() });
        return resolve(null);
      }
      const argv = cands[i];
      try {
        execFile(
          argv[0], argv.slice(1).concat(versionArg),
          { timeout: 15000, windowsHide: true },
          (err, stdout) => {
            if (!err && stdout && stdout.toString().trim()) {
              _resolved.set(key, { tool: argv, ts: Date.now() });
              if (key === 'ytdlp') {
                console.log(`🛠️  yt-dlp resolved → ${argv.join(' ')}  (${stdout.toString().trim().split('\n')[0]})`);
              } else if (key === 'ffmpeg') {
                console.log(`🎞️  ffmpeg resolved → ${argv.join(' ')}`);
              }
              return resolve(argv);
            }
            tryNext(i + 1);
          }
        );
      } catch (e) {
        tryNext(i + 1); // skip a spawn that fails synchronously (e.g. job-object error)
      }
    })(0);
  });
}

// Run a resolved tool with `args`. Resolves to { ok, stdout?, error?, notFound? }.
function runTool(cands, versionArg, key, args, opts = {}) {
  return resolveTool(cands, versionArg, key).then((tool) => {
    if (!tool) return { ok: false, error: 'tool-not-found', notFound: true };
    return new Promise((resolve) => {
      try {
        execFile(
          tool[0], tool.slice(1).concat(args),
          { timeout: 90000, windowsHide: true, ...opts },
          (err, stdout, stderr) => {
            if (err) return resolve({ ok: false, error: (stderr || err.message).trim(), notFound: false });
            resolve({ ok: true, stdout: (stdout || '').toString() });
          }
        );
      } catch (e) {
        // "AssignProcessToJobObject: (87) The parameter is incorrect" can throw
        // synchronously on Windows when a spawned tool double-forks. Catch it so
        // it never crashes the whole bot.
        resolve({ ok: false, error: e.message || 'spawn error', notFound: false });
      }
    });
  });
}

function ytDlpCands() {
  return process.env.YTDLP_PATH ? [[process.env.YTDLP_PATH]].concat(YTDLP_CANDS) : YTDLP_CANDS;
}
// Common ffmpeg install locations (winget Gyan.FFmpeg, gyan.dev zip, imageio).
// These often aren't on PATH, so we probe them directly. Only include ones that
// exist, so probing stays fast.
function ffmpegCands() {
  const cands = [];
  if (process.env.FFMPEG_PATH) cands.push([process.env.FFMPEG_PATH]);
  // Build candidate paths from env (Windows-friendly).
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const localApp = process.env.LOCALAPPDATA || '';
  const extra = [
    path.join(localApp, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
    path.join(home, '.deno', 'bin', 'ffmpeg.exe'),
    path.join(localApp, 'Programs', 'Python', 'Python312', 'Scripts', 'ffmpeg.exe'),
    path.join(localApp, 'Programs', 'Python', 'Python311', 'Scripts', 'ffmpeg.exe'),
    path.join(home, 'Downloads', 'anirpg', 'anirpg', 'ffmpeg.exe'),
  ].filter(Boolean);
  // Only add candidates that actually exist on disk (keeps probing fast).
  for (const p of extra) { if (fs.existsSync(p)) cands.push([p]); }
  return cands.concat(FFMPEG_CANDS);
}

const DENO_CANDS = ['deno', 'deno.exe'];

// Is Deno available? yt-dlp uses it as the JS runtime to solve YouTube's "n"
// signature challenge. Without it, YouTube may refuse (403 / format not found).
function hasDeno() {
  return resolveTool(DENO_CANDS.map(d => [d]), '--version', 'deno').then(t => !!t);
}

function ytDlpRun(args, opts) {
  return runTool(ytDlpCands(), '--version', 'ytdlp', args, opts);
}
function ffmpegRun(args, opts = {}) {
  return runTool(ffmpegCands(), '-version', 'ffmpeg', args, { timeout: 60000, ...opts });
}

// Is ffmpeg usable? (resolves to a path on PATH or FFMPEG_PATH)
function hasFfmpeg() {
  return resolveTool(ffmpegCands(), '-version', 'ffmpeg').then(t => {
    if (!t) {
      console.warn('⚠ ffmpeg NOT found — /ytmp4 (video) will be limited to single-file MP4s. Install it:\n' +
        '   winget install Gyan.FFmpeg --source winget\n' +
        'To point the bot directly, set in .env:  FFMPEG_PATH=C:\\path\\to\\ffmpeg.exe');
    }
    return !!t;
  });
}

// Convenience: choose a yt-dlp argument list suited to whether ffmpeg exists.
//  - with ffmpeg    → convert/merge (best quality). Adds --ffmpeg-location if set.
//  - without ffmpeg → grab single-file progressive formats (no merge needed).
// @returns { args, ffmpeg } — pass args to ytDlpRun.
// YOUTUBE_EXTRACTOR_ARGS: YouTube increasingly returns "HTTP Error 403: Forbidden"
// and demands the "n" signature JS challenge. The default+tv+web_safari client
// combo + a Deno (JS runtime) on PATH lets yt-dlp solve that challenge.
// For "Sign in to confirm you're not a bot": prefer the mobile (mweb) and web
// clients which are much less likely to trigger the bot check, and disable the
// --extractor-args that sometimes force it.
// DO NOT pass --remote-components at runtime: yt-dlp spawns a Deno subprocess
// to fetch the solver, which can crash Node on Windows ("AssignProcessToJobObject").
// With Deno simply installed, the challenge is solved automatically.
// If you STILL get the bot check, set YT_COOKIES=<path to a cookies.txt> in .env,
// and we pass --cookies automatically.
const YOUTUBE_EXTRACTOR_ARGS = 'youtube:player_client=mweb,web,default,tv,web_safari';

// Batch-50: YouTube JS-challenge (n/sig) solving moved to EJS scripts.
// Plain-pip installs (ours: requirements.txt) ship WITHOUT yt-dlp-ejs,
// so solving fails and strict sessions lose ALL formats. Deno (already in
// our Dockerfile + nixpacks) can fetch the scripts on-the-fly from npm:
// https://github.com/yt-dlp/yt-dlp/wiki/EJS — auto-updating, no host change.
const YOUTUBE_EJS_ARGS = ['--remote-components', 'ejs:npm'];

// Optional cookie file (from .env YT_COOKIES or YT_COOKIES_FROM_BROWSER).
// Batch-49: YT_COOKIES accepts a cookie-FILE path (old behavior) OR raw
// Netscape cookie DATA pasted straight into the env var (new — the only
// sane option on hosts with ephemeral filesystems like Railway). Data
// mode materializes a 0600 temp file; the value itself is never logged.
function youtubeCookiesArgs() {
  const out = [];
  const ck = process.env.YT_COOKIES || '';
  if (ck) {
    let isPath = false;
    try { isPath = fs.existsSync(ck) && fs.statSync(ck).isFile(); } catch (e) { isPath = false; }
    if (isPath) {
      out.push('--cookies', ck);
    } else {
      try {
        let data = ck;
        // Env dashboards often mangle real newlines into literal backslash-n.
        if (data.indexOf('\n') === -1 && data.indexOf('\\n') !== -1) data = data.split('\\n').join('\n');
        if (data.charAt(data.length - 1) !== '\n') data += '\n';
        const fp = path.join(os.tmpdir(), 'anirpg-yt-cookies.txt');
        let cur = null;
        try { cur = fs.readFileSync(fp, 'utf8'); } catch (e) { cur = null; }
        if (cur !== data) {
          fs.writeFileSync(fp, data, { mode: 0o600 });
          try { fs.chmodSync(fp, 0o600); } catch (e) {}
        }
        out.push('--cookies', fp);
      } catch (e) { /* fall through cookieless rather than crash */ }
    }
  }
  if (process.env.YT_COOKIES_FROM_BROWSER) out.push('--cookies-from-browser', process.env.YT_COOKIES_FROM_BROWSER);
  return out;
}

// The extractor-args that let yt-dlp get past YouTube's bot check.
// Exported so the /ytmp4 info-fetch uses the SAME client combo as the download.
const YOUTUBE_EXTRACTOR_ARGS_FULL = ['--extractor-args', YOUTUBE_EXTRACTOR_ARGS];

function optimalDownloadArgs({ minimal = false } = {}) {
  return hasFfmpeg().then((ffmpeg) => {
    const extra = ['--extractor-args', YOUTUBE_EXTRACTOR_ARGS].concat(YOUTUBE_EJS_ARGS, youtubeCookiesArgs());
    if (ffmpeg && process.env.FFMPEG_PATH) extra.push('--ffmpeg-location', process.env.FFMPEG_PATH);
    if (!ffmpeg || minimal) {
      // No ffmpeg: pick a single-file progressive format that plays in WhatsApp
      // (H.264 video + AAC audio inside an mp4). Avoids HEVC/AV1 that can't play.
      // Tolerate videos with no single-file MP4 by trying a webm variant and the
      // tv client, which the extractor-args above already enable.
      return {
        ffmpeg: !!ffmpeg,
        args: extra.concat(['-f', 'best[ext=mp4][vcodec^=avc1]/best[ext=mp4]/best[ext=webm]/best']),
      };
    }
    // With ffmpeg: merge, but REMUX the video to the WhatsApp-friendly
    // H.264(avc1)+AAC(mp4a) codecs, regardless of the original codec. This
    // fixes "video downloads but won't play" (HEVC/AV1 sources).
    return {
      ffmpeg: true,
      args: extra.concat([
        '-f', 'bestvideo[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a][acodec^=mp4a]/bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4',
        '--remux-video', 'mp4',
      ]),
    };
  });
}

// For /yt (audio): convert to MP3 when ffmpeg exists, otherwise just grab the
// native audio stream (no conversion, no ffmpeg needed). Returns { ffmpeg, args }.
function optimalAudioArgs() {
  return hasFfmpeg().then((ffmpeg) => {
    const extra = ['--extractor-args', YOUTUBE_EXTRACTOR_ARGS].concat(YOUTUBE_EJS_ARGS, youtubeCookiesArgs());
    if (ffmpeg && process.env.FFMPEG_PATH) extra.push('--ffmpeg-location', process.env.FFMPEG_PATH);
    if (!ffmpeg) {
      // Prefer AAC/m4a (WhatsApp-friendly); falls back to bestaudio (opus).
      // IMPORTANT: keep the extractor-args even without ffmpeg — the client
      // combo + Deno solve YouTube's n-signature challenge.
      return { ffmpeg: false, args: extra.concat(['-f', 'bestaudio[ext=m4a]/bestaudio']) };
    }
    return {
      ffmpeg: true,
      args: extra.concat(['--extract-audio', '--audio-format', 'mp3', '--audio-quality', '128K']),
    };
  });
}

// Batch-36: parse `--print after_move:filepath --print id --print title`
// output. yt-dlp prints plain id/title BEFORE the download and
// after_move:filepath AFTER it — so the file path is the LAST line,
// not the first (reading lines[0] broke every audio download).
// Order-independent: the path is whichever line exists on disk.
// Batch-37: also lifts a `thumbnail` print line (cover art for sources
// like SoundCloud that have no video id) and keeps it out of the title.
function parseDownloadPrints(stdout, fallbackId, fallbackTitle) {
  const clean = String(stdout || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const p = clean.find((l) => { try { return fs.existsSync(l); } catch (e) { return false; } }) || null;
  const thumb = clean.find((l) => l !== p && /^https?:\/\/\S+$/i.test(l)) || null;
  const rest = clean.filter((l) => l !== p && l !== thumb);
  const id = rest.find((l) => /^[\w-]{6,20}$/.test(l)) || null;
  const title = rest.filter((l) => l !== id).join(' ').trim() || null;
  return { p, id: id || fallbackId || null, title: title || fallbackTitle || null, thumb };
}

module.exports = {
  YTDLP_CANDS, FFMPEG_CANDS,
  resolveTool, runTool,
  ytDlpRun, ffmpegRun, hasFfmpeg, hasDeno, optimalDownloadArgs, optimalAudioArgs,
  YOUTUBE_EXTRACTOR_ARGS_FULL, YOUTUBE_EJS_ARGS, youtubeCookiesArgs, parseDownloadPrints,
};
