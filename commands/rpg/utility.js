/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — Utility Commands                    ║
 * ║  /imagine /yt /lyrics /pinterest /math /search      ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * All utility — completely separate from RPG gameplay.
 *
 * Env vars needed:
 *   GENIUS_TOKEN     — Genius API token (for lyrics)
 *   (YouTube uses yt-dlp CLI — must be installed on server)
 *   (Image gen uses Pollinations.ai — no key needed)
 *   (Pinterest uses public RSS — no key needed)
 *   (Math/Search uses AI — uses GROQ_API_KEY)
 */

'use strict';

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const { execFile } = require('child_process');
const ToolRunner = require('../../rpg/utils/ToolRunner');

// __dirname here is anirpg/commands/rpg/ — go up two levels to project root
const ROOT_DIR = path.join(__dirname, '..', '..');
const TMP_DIR  = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'tmp')
  : path.join(ROOT_DIR, 'tmp');

// ── Tavily real-time search helper ────────────────────────────────────────────
async function tavilySearch(query, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: 5,
      include_answer: true,
    });

    const req = https.request({
      hostname: 'api.tavily.com',
      path: '/search',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error));

          // Build response from Tavily's answer + top results
          const lines = [];

          if (json.answer) {
            lines.push(json.answer);
          }

          if (json.results?.length) {
            lines.push('');
            json.results.slice(0, 3).forEach(r => {
              lines.push(`📌 *${r.title}*`);
              if (r.content) lines.push(r.content.slice(0, 150) + (r.content.length > 150 ? '...' : ''));
              lines.push(`🔗 ${r.url}`);
              lines.push('');
            });
          }

          resolve(lines.join('\n').trim() || 'No results found.');
        } catch(e) {
          reject(new Error('Failed to parse Tavily response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Free (no key) web search fallback ──────────────────────────────────────
// Used when TAVILY_API_KEY is not set, so /search always works out of the box.
// Uses Wikipedia's public full-text search API (stable, no key, no scraping) —
// returns real article results with titles, snippets and links.
function freeWebSearch(query) {
  return new Promise((resolve) => {
    const url = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch='
      + encodeURIComponent(query) + '&format=json&srlimit=4&srprop=snippet';
    const req = https.get(url, {
      headers: { 'User-Agent': 'Astra/1.0' }, timeout: 12_000,
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(d);
          const out = [];
          (data.query && data.query.search || []).forEach(r => {
            const snip = (r.snippet || '')
              .replace(/<[^>]+>/g, '')
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&#039;/g, "'");
            out.push('📖 *' + r.title + '*');
            if (snip) out.push(snip.slice(0, 180));
            out.push('https://en.wikipedia.org/wiki/' + encodeURIComponent(r.title.replace(/ /g, '_')));
            out.push('');
          });
          resolve(out.join('\n').trim());
        } catch (e) { resolve(''); }
      });
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

// ── Bing web search (keyless, Google-like results) ───────────────────────────
// Returns real web results (title + link) with NO API key and NO AI answer —
// just like typing into a search engine. Used by /search when Tavily is absent.
function bingSearch(query) {
  return new Promise((resolve) => {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&form=QBLH&count=10`;
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15_000,
    }, (res) => {
      let html = '';
      res.on('data', c => html += c);
      res.on('end', () => {
        const out = [];
        const seen = new Set();
        const norm = (t) => t.replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#[0-9]+;/g, '').trim();
        // Variant A: <a u="a1<base64url>" href="...">Title</a> (Bing redirect w/ real URL)
        let re = /<a[^>]*u="([^"]+)"[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
        let m;
        while ((m = re.exec(html)) && out.length < 5) {
          const title = norm(m[2]);
          if (!title || title.length < 6) continue;
          let u2 = m[1];
          if (/^a1/i.test(u2)) { try { u2 = Buffer.from(u2.slice(2).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } catch (e) { u2 = ''; } }
          if (!u2 || !/^https?:/.test(u2)) continue;
          const key = u2.split('?')[0];
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ title, url: u2.split('?')[0] });
        }
        // Variant B: direct external <a href="https://…">Title</a> (some layouts don't use u=)
        if (out.length < 5) {
          re = /<h2[^>]*>[\s\S]*?<a[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
          while ((m = re.exec(html)) && out.length < 5) {
            const url2 = m[1];
            if (!/^https:/.test(url2) || url2.includes('bing.com')) continue;
            const title = norm(m[2]);
            if (!title || title.length < 6) continue;
            const key = url2.split('?')[0];
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ title, url: url2.split('?')[0] });
          }
        }
        resolve(out);
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
  });
}

// ── DuckDuckGo search (keyless, real web results) ────────────────────────────
// Works out of the box with NO API key and returns real web results (title + link),
// just like a search engine. More reliable than Bing (whose HTML layout changed).
function duckSearch(query) {
  return new Promise((resolve) => {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15_000,
    }, (res) => {
      let html = '';
      res.on('data', c => html += c);
      res.on('end', () => {
        const out = [];
        const seen = new Set();
        // DuckDuckGo result anchors: href="//duckduckgo.com/l/?uddg=<encoded-url>" tag.
        let re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let m;
        while ((m = re.exec(html)) && out.length < 6) {
          const title = m[2].replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
            .replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&#[0-9]+;/g, '').trim();
          if (!title || title.length < 6) continue;
          let url2 = m[1];
          const ud = /uddg=([^&]+)/.exec(url2);
          if (ud && ud[1]) { try { url2 = decodeURIComponent(ud[1]); } catch (_) {} }
          if (!/^https?:\/\//.test(url2)) continue;
          if (url2.includes('duckduckgo.com/y.js') || url2.includes('ad_domain') || url2.includes('ad_provider')) continue;
          if (url2.includes('duckduckgo.com')) continue;
          const key = url2.split('?')[0];
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ title, url: key });
        }
        resolve(out);
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
  });
}

// ── Google Custom Search (programmable search) ───────────────────────────────
// The "real" Google search: returns actual Google results (title + link).
// Requires two free keys in .env (set both):
//   GOOGLE_API_KEY  — API key from https://console.cloud.google.com/
//   GOOGLE_CX       — Search Engine ID from https://programmablesearchengine.google.com/
// Free tier allows ~100 queries/day.
async function googleSearch(query) {
  const key = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;
  if (!key || !cx) return null;
  try {
    const url = 'https://www.googleapis.com/customsearch/v1?key=' + encodeURIComponent(key)
      + '&cx=' + encodeURIComponent(cx) + '&q=' + encodeURIComponent(query) + '&num=5';
    const data = await fetchJson(url);
    if (data.error) {
      console.error('⚠ Google search error:', data.error.message);
      console.error('   → To fix: enable the "Custom Search JSON API" in your Google Cloud project at');
      console.error('     console.cloud.google.com → APIs & Services → Library → Search "Custom Search JSON API" → Enable.');
      return null;
    }
    const items = (data.items || []).slice(0, 5);
    if (!items.length) return null;
    return items.map(r => `🔗 *${r.title}*\n${r.link}`).join('\n\n');
  } catch (e) {
    console.error('❌ googleSearch error:', e.message);
    return null;
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'Astra/1.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse failed')); }
      });
    }).on('error', reject);
  });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Astra/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || '' }));
    });
    req.on('error', reject);
  });
}

// ── Keyless TikTok extractor (TikWM) ─────────────────────────────────────────
// TikTok actively blocks yt-dlp, so /tt uses this free, no-key API first.
// Returns { ok, buffer?, mimetype?, title?, error? }.
async function tiktokDownload(url) {
  try {
    const jurl = 'https://www.tikwm.com/api/?url=' + encodeURIComponent(url);
    const data = await fetchJson(jurl);
    const d = data?.data;
    if (!data || data.code !== 0 || !d) return { ok: false, error: 'TikWM returned no data' };
    const cdn = d.play || d.video || d.origin_cover || '';
    if (!cdn) return { ok: false, error: 'No playable CDN URL found' };
    const res = await fetchBuffer(cdn);
    if (!res.buffer || !res.buffer.length) return { ok: false, error: 'Empty video from CDN' };
    return { ok: true, buffer: res.buffer, mimetype: 'video/mp4', title: d.title || '' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Tool runner ──────────────────────────────────────────────────────────────
// Finds yt-dlp/ffmpeg even when NOT on PATH (pip installs to Python Scripts).
// Shared implementation lives in rpg/utils/ToolRunner.js; aliased here so the
// rest of this file can call ytDlpRun/ffmpegRun as before.
const { ytDlpRun, ffmpegRun, hasFfmpeg } = ToolRunner;

// ── /imagine — Pollinations.ai image generation ───────────────────────────────
const imagine = {
  name: 'imagine',
  aliases: ['img', 'gen', 'draw'],
  description: 'Generate an AI image from a prompt',
  usage: '/imagine <prompt>',
  category: 'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    if (args.length === 0) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: /imagine <prompt>\nExample: /imagine Shadow Monarch Sung Jin-Woo standing in darkness',
      }, { quoted: msg });
    }

    const prompt = args.join(' ');
    const encodedPrompt = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 999999);

    // Pollinations.ai — free, no key needed
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=768&seed=${seed}&nologo=true`;

    await sock.sendMessage(chatId, {
      text: `🎨 *Generating...*\n"${prompt}"`,
    }, { quoted: msg });

    try {
      const { buffer, contentType } = await fetchBuffer(imageUrl);

      await sock.sendMessage(chatId, {
        image: buffer,
        caption: `🎨 *${prompt}*\n\n_Generated by Pollinations.ai_`,
        mimetype: contentType.includes('png') ? 'image/png' : 'image/jpeg',
      }, { quoted: msg });

    } catch (err) {
      console.error('❌ Image gen error:', err.message);
      await sock.sendMessage(chatId, {
        text: `❌ Failed to generate image. Try again!\n\n💡 Tip: Make your prompt more specific.`,
      }, { quoted: msg });
    }
  },
};

// ── /yt — YouTube audio download via yt-dlp ──────────────────────────────────
const yt = {
  name: 'yt',
  aliases: ['ytmp3', 'audio'],   // 'song' is provided by lyrics.js (=/song audio)
  description: 'Download YouTube audio',
  usage: '/yt <youtube url or search query>',
  category: 'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    if (args.length === 0) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: /yt <YouTube URL or song name>\nExample: /yt Jujutsu Kaisen OP',
      }, { quoted: msg });
    }

    const input = args.join(' ');
    const isUrl = input.startsWith('http');

    await sock.sendMessage(chatId, {
      text: `🎵 *Fetching audio...*\n${isUrl ? input : `"${input}"`}`,
    }, { quoted: msg });

    const tmpDir = TMP_DIR;
    fs.mkdirSync(tmpDir, { recursive: true });
    const outTemplate = path.join(tmpDir, `yt_${Date.now()}.%(ext)s`);

    // Search query or direct URL
    const ytInput = isUrl ? input : `ytsearch1:${input}`;

    // Convert to MP3 only if ffmpeg is present; otherwise grab the native audio
    // stream (m4a/opus) so /yt works even WITHOUT ffmpeg installed.
    const aud = await ToolRunner.optimalAudioArgs();
    const ytdlpArgs = [
      '--no-playlist',
      ...aud.args,               // either mp3-convert args, or '-f bestaudio'
      '--max-filesize', '25m',    // WhatsApp 25MB limit
      '--output', outTemplate,
      '--print', 'after_move:filepath', // print final path
      ytInput,
    ];

    const mp3Res = await ytDlpRun(ytdlpArgs, { timeout: 90000 });
    const audioPath = mp3Res.ok ? mp3Res.stdout.trim().split('\n').pop() : null;

    if (!audioPath || !fs.existsSync(audioPath)) {
      const denoMissing = !(await ToolRunner.hasDeno());
      const hint = mp3Res.notFound
        ? `❌ Could not find *yt-dlp*.\n\n💡 Run: pip install -U yt-dlp\n(If it still fails, add YTDLP_PATH to .env)`
        : denoMissing
          ? `❌ Could not download audio (YouTube signature challenge).\n\n💡 Install Deno (needed to solve YouTube's challenge):\nwinget install DenoLand.Deno\nThen close this terminal and reopen it, and restart the bot.`
          : `❌ Could not download audio (yt-dlp error).\n\n💡 Update yt-dlp:\npip install -U yt-dlp`;
      return sock.sendMessage(chatId, { text: hint }, { quoted: msg });
    }

    try {
      let audioBuffer = fs.readFileSync(audioPath);
      let fileName = path.basename(audioPath);
      const ext = path.extname(audioPath).toLowerCase();
      // Map native audio container → mimetype (must match the real container,
      // otherwise WhatsApp reports a "corrupted file").
      let mimetype = ext === '.mp3'  ? 'audio/mpeg'
                     : ext === '.m4a'  ? 'audio/mp4'
                     : ext === '.opus' ? 'audio/ogg'
                     : ext === '.ogg'  ? 'audio/ogg'
                     : ext === '.webm' ? 'audio/webm'
                     : 'audio/mp4';
      // If ffmpeg is present, always hand WhatsApp an MP3/M4A (best playability).
      if (!['.mp3', '.m4a'].includes(ext)) {
        const fixedPath = path.join(tmpDir, `sng_${Date.now()}.mp3`);
        const conv = await ToolRunner.ffmpegRun([
          '-y', '-i', audioPath, '-vn', '-codec:a', 'libmp3lame', '-qscale:a', '3', fixedPath,
        ]);
        if (conv.ok || fs.existsSync(fixedPath)) {
          try { fs.unlinkSync(audioPath); } catch (e) {}
          audioPath = fixedPath;
          fileName = path.basename(fixedPath);
          mimetype = 'audio/mpeg';
          audioBuffer = fs.readFileSync(audioPath);
        }
      }

      await sock.sendMessage(chatId, {
        audio: audioBuffer,
        mimetype,
        fileName: path.basename(audioPath),
        ptt: false,
      }, { quoted: msg });

    } finally {
      // Cleanup temp file
      try { fs.unlinkSync(audioPath); } catch(e) {}
    }
  },
};

// ── /pinterest — fetch images from Pinterest ─────────────────────────────────
const pinterest = {
  name: 'pinterest',
  aliases: ['pin', 'pins'],
  description: 'Search and send images from Pinterest',
  usage: '/pinterest <query>',
  category: 'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    if (args.length === 0) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: /pinterest <query>\nExample: /pinterest Solo Leveling fanart',
      }, { quoted: msg });
    }

    const query = args.join(' ');

    await sock.sendMessage(chatId, {
      text: `📌 *Searching Pinterest...*\n"${query}"`,
    }, { quoted: msg });

    try {
      // Pinterest public RSS feed
      const feedUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;

      // Use Pinterest's open graph / CDN approach via their JSON endpoint
      const apiUrl = `https://www.pinterest.com/resource/BaseSearchResource/get/?data=%7B%22options%22%3A%7B%22query%22%3A%22${encodeURIComponent(query)}%22%2C%22scope%22%3A%22pins%22%7D%7D&_=${Date.now()}`;

      const data = await fetchJson(apiUrl).catch(() => null);

      // Try to extract image URLs from Pinterest results
      let imageUrls = [];
      if (data?.resource_response?.data?.results) {
        imageUrls = data.resource_response.data.results
          .filter(p => p.images?.orig?.url)
          .map(p => p.images.orig.url)
          .slice(0, 3);
      }

      if (imageUrls.length === 0) {
        // Fallback: direct Pollinations search (uses same image quality)
        return sock.sendMessage(chatId, {
          text: [
            `📌 *Pinterest: "${query}"*`,
            ``,
            `🔗 View results directly:`,
            `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
          ].join('\n'),
        }, { quoted: msg });
      }

      // Send first found image
      const { buffer } = await fetchBuffer(imageUrls[0]);
      await sock.sendMessage(chatId, {
        image: buffer,
        caption: `📌 *Pinterest: ${query}*\n\n🔗 More: https://pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
      }, { quoted: msg });

    } catch (err) {
      console.error('❌ Pinterest error:', err.message);
      return sock.sendMessage(chatId, {
        text: `📌 *Pinterest: "${query}"*\n\n🔗 https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
      }, { quoted: msg });
    }
  },
};

// ── /math — AI-powered math solver ───────────────────────────────────────────
const math = {
  name: 'math',
  aliases: ['calc', 'solve'],
  description: 'Solve math problems with AI',
  usage: '/math <expression or problem>',
  category: 'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    if (args.length === 0) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: /math <problem>\nExample: /math integrate x^2 from 0 to 3',
      }, { quoted: msg });
    }

    const problem = args.join(' ');

    // Try simple eval first for basic arithmetic
    const simpleMatch = problem.match(/^[\d\s+\-*/().^%]+$/);
    if (simpleMatch) {
      try {
        // Safe eval for simple expressions
        const sanitized = problem.replace(/\^/g, '**');
        // eslint-disable-next-line no-new-func
        const result = new Function(`return (${sanitized})`)();
        if (!isNaN(result) && isFinite(result)) {
          return sock.sendMessage(chatId, {
            text: `🧮 *Math Result*\n\n${problem} = *${result}*`,
          }, { quoted: msg });
        }
      } catch(e) {}
    }

    // Complex problems — use Groq AI
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return sock.sendMessage(chatId, {
        text: '❌ AI math solver not configured (GROQ_API_KEY missing).',
      }, { quoted: msg });
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
          messages: [
            {
              role: 'system',
              content: 'You are a math solver. Solve the given problem step by step. Be concise. Show the final answer clearly at the end. Use plain text only, no markdown code blocks.',
            },
            { role: 'user', content: problem },
          ],
          max_tokens: 400,
          temperature: 0.1,
        }),
      });

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content?.trim();

      if (!answer) throw new Error('No answer');

      return sock.sendMessage(chatId, {
        text: `🧮 *${problem}*\n\n${answer}`,
      }, { quoted: msg });

    } catch (err) {
      console.error('❌ Math AI error:', err.message);
      return sock.sendMessage(chatId, {
        text: '❌ Could not solve that. Try rephrasing.',
      }, { quoted: msg });
    }
  },
};

// ── /search — Tavily real-time web search ─────────────────────────────────────
const search = {
  name: 'search',
  aliases: ['google', 'query', 'web'],  // 'ask' intentionally reserved for /ai
  description: 'Search the web for real-time information',
  usage: '/search <question>',
  category: 'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    if (args.length === 0) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: /search <question>\nExample: /search latest Solo Leveling anime news',
      }, { quoted: msg });
    }

    const question = args.join(' ');
    const apiKey = process.env.TAVILY_API_KEY;

    await sock.sendMessage(chatId, {
      text: `🔍 *Searching...*\n"${question}"`,
    }, { quoted: msg });

    try {
      let body = '';
      let source = '';
      // 1) Real Google results (if GOOGLE_API_KEY + GOOGLE_CX set in .env AND working).
      const google = await googleSearch(question);
      if (google) { body = google; source = 'Google'; }
      // 2) DuckDuckGo — keyless, reliable real-web results (no API key needed).
      if (!body) {
        const ddg = await duckSearch(question);
        if (ddg.length) { body = ddg.map(r => `🔗 *${r.title}*\n${r.url}`).join('\n\n'); source = 'DuckDuckGo'; }
      }
      // 3) Tavily (if its key is set).
      if (!body && apiKey) {
        try { body = await tavilySearch(question, apiKey); source = 'Tavily'; }
        catch (e) { console.error('⚠ Tavily failed:', e.message); }
      }
      // 4) Wikipedia — reliable keyless fallback so /search ALWAYS returns something.
      if (!body) { body = await freeWebSearch(question) || 'No results found — try rephrasing.'; source = 'Wikipedia'; }
      const hint = source !== 'Google' ? '' : '';
      return sock.sendMessage(chatId, {
        text: `🔍 *${question}*${source ? `\n󠁧󠁢󠁥󠁮󠁧󠁿 *via ${source}*` : ''}\n\n${body}${hint}`,
      }, { quoted: msg });
    } catch (err) {
      console.error('❌ Search error:', err.message);
      return sock.sendMessage(chatId, {
        text: '❌ Search failed. Try again.',
      }, { quoted: msg });
    }
  },
};

// ── /tt — TikTok video download via yt-dlp ───────────────────────────────────
const tt = {
  name: 'tt',
  aliases: ['tiktok', 'tok'],
  description: 'Download a TikTok video',
  usage: '/tt <tiktok url>',
  category: 'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    if (args.length === 0 || !args[0].includes('tiktok.com')) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: /tt <TikTok URL>\nExample: /tt https://www.tiktok.com/@user/video/123',
      }, { quoted: msg });
    }

    const url = args[0].trim();

    await sock.sendMessage(chatId, {
      text: '⬇️ *Downloading TikTok...*',
    }, { quoted: msg });

    // Primary: TikWM — free, no-key, reliable for TikTok.
    const api = await tiktokDownload(url);
    if (api.ok) {
      await sock.sendMessage(chatId, {
        video: api.buffer,
        mimetype: api.mimetype || 'video/mp4',
        caption: `📱 Downloaded via Astra${api.title ? `\n🎬 ${api.title}` : ''}`,
      }, { quoted: msg });
      return;
    }

    // Fallback: yt-dlp (works on some TikTok videos; TikTok blocks a lot).
    const tmpDir = TMP_DIR;
    fs.mkdirSync(tmpDir, { recursive: true });
    const outPath = path.join(tmpDir, `tt_${Date.now()}.mp4`);
    const ttArgs = ['--no-playlist', '--no-warnings', '--format', 'best', '--max-filesize', '60m', '--output', outPath];
    let dl = await ytDlpRun([...ttArgs, url], { timeout: 90000 });
    if (!dl.ok) {
      await new Promise(r => setTimeout(r, 2500));
      fs.rmSync(outPath, { force: true });
      dl = await ytDlpRun([...ttArgs, url], { timeout: 90000 });
    }
    if (!dl.ok || !fs.existsSync(outPath)) {
      return sock.sendMessage(chatId, {
        text: `❌ Could not download that TikTok.\n\n💡 Tips:\n• Make sure the video is public (not private / friends-only).\n• Use a full \`www.tiktok.com\` link, not a \`vt.tiktok.com\` shortcut.\n• If you installed yt-dlp, update it: pip install -U yt-dlp\n• Or use /ytmp4 for a YouTube video instead.`,
      }, { quoted: msg });
    }
    try {
      const videoBuffer = fs.readFileSync(outPath);
      await sock.sendMessage(chatId, {
        video: videoBuffer,
        mimetype: 'video/mp4',
        caption: '📱 Downloaded via Astra',
      }, { quoted: msg });
    } finally {
      try { fs.unlinkSync(outPath); } catch(e) {}
    }
  },
};

// ── !mp3 reply handler ────────────────────────────────────────────────────────
// Not a slash command — triggered when user replies to any media message with "!mp3"
// Called directly from the message handler in index.js / MultiSocketManager
async function handleMp3Reply(sock, msg, chatId) {
  // Get the quoted message
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted) {
    return sock.sendMessage(chatId, {
      text: '❌ Reply to a video or audio message with *!mp3* to extract the audio.',
    }, { quoted: msg });
  }

  // Check quoted message type
  const videoMsg  = quoted.videoMessage;
  const audioMsg  = quoted.audioMessage;
  const docMsg    = quoted.documentMessage;

  if (!videoMsg && !audioMsg && !docMsg) {
    return sock.sendMessage(chatId, {
      text: '❌ That message doesn\'t contain extractable media.\n\nReply to a *video* or *audio* message.',
    }, { quoted: msg });
  }

  await sock.sendMessage(chatId, {
    text: '🎵 *Extracting audio...*',
  }, { quoted: msg });

  try {
    // Download the quoted media — Baileys v7 uses @whiskeysockets/baileys
    let downloadMediaMessage;
    try {
      ({ downloadMediaMessage } = require('@whiskeysockets/baileys'));
    } catch(e) {
      console.error('Failed to load @whiskeysockets/baileys:', e.message);
      return sock.sendMessage(chatId, {
        text: '❌ Media download module not available.',
      }, { quoted: msg });
    }
    const quotedMsg = {
      key: {
        remoteJid: chatId,
        id: msg.message.extendedTextMessage.contextInfo.stanzaId,
        participant: msg.message.extendedTextMessage.contextInfo.participant,
      },
      message: quoted,
    };

    const mediaBuffer = await downloadMediaMessage(quotedMsg, 'buffer', {});

    if (!mediaBuffer || mediaBuffer.length === 0) {
      return sock.sendMessage(chatId, {
        text: '❌ Could not download the media. It may have expired.',
      }, { quoted: msg });
    }

    const tmpDir = TMP_DIR;
    fs.mkdirSync(tmpDir, { recursive: true });
    const stamp    = Date.now();
    const inPath   = path.join(tmpDir, `mp3_in_${stamp}.mp4`);
    const outPath  = path.join(tmpDir, `mp3_out_${stamp}.mp3`);

    fs.writeFileSync(inPath, mediaBuffer);

    // Use ffmpeg to extract audio
    const ffmpegResult = await ffmpegRun([
      '-i', inPath,
      '-vn',                  // no video
      '-acodec', 'libmp3lame',
      '-ab', '128k',
      '-y',                   // overwrite
      outPath,
    ], { timeout: 60000 });

    // Cleanup input
    try { fs.unlinkSync(inPath); } catch(e) {}

    if (!ffmpegResult.ok || !fs.existsSync(outPath)) {
      const hint = ffmpegResult.notFound
        ? `❌ Could not find *ffmpeg*.\n\n💡 On Windows run:\nwinget install Gyan.FFmpeg --source winget\n\nThen restart the bot (restart the terminal so PATH refreshes).`
        : '❌ Audio extraction failed (ffmpeg error). Try again.';
      return sock.sendMessage(chatId, { text: hint }, { quoted: msg });
    }

    const audioBuffer = fs.readFileSync(outPath);
    try { fs.unlinkSync(outPath); } catch(e) {}

    await sock.sendMessage(chatId, {
      audio: audioBuffer,
      mimetype: 'audio/mpeg',
      fileName: `audio_${stamp}.mp3`,
      ptt: false,
    }, { quoted: msg });

  } catch (err) {
    console.error('❌ !mp3 error:', err.message);
    await sock.sendMessage(chatId, {
      text: '❌ Something went wrong extracting audio. Try again.',
    }, { quoted: msg });
  }
}
module.exports = { imagine, yt, tt, pinterest, math, search, handleMp3Reply };
