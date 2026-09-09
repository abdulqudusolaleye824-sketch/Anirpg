/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — Utility Commands                    ║
 * ║  /imagine /yt /lyrics /pinterest /math /search      ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * All utility — completely separate from RPG gameplay.
 */

'use strict';

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const { execFile } = require('child_process');
const ToolRunner = require('../../rpg/utils/ToolRunner');

const ROOT_DIR = path.join(__dirname, '..', '..');
const TMP_DIR  = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'tmp')
  : path.join(ROOT_DIR, 'tmp');

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

          const lines = [];
          if (json.answer) lines.push(json.answer);

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

const { ytDlpRun, ffmpegRun, hasFfmpeg } = ToolRunner;

const imagine = {
  name: 'imagine',
  aliases: ['img', 'gen', 'draw'],
  description: 'Generate a sharp, high-definition AI image from a prompt',
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
    const qualitySuffix = 'masterpiece, ultra-detailed, sharp focus, 8k resolution, cinematic lighting, photorealistic digital art';
    const sharpened = /(masterpiece|8k|detailed|photorealistic|hd|cinematic)/i.test(prompt) ? prompt : `${prompt}, ${qualitySuffix}`;
    const encodedPrompt = encodeURIComponent(sharpened);
    const seed = Math.floor(Math.random() * 999999);

    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true&model=flux`;

    await sock.sendMessage(chatId, {
      text: `🎨 *Generating Ultra-Sharp Image...*\n"${prompt}"`,
    }, { quoted: msg });

    try {
      const { buffer, contentType } = await fetchBuffer(imageUrl);

      await sock.sendMessage(chatId, {
        image: buffer,
        caption: `✨ *${prompt}*\n\n🎨 _Generated via Flux AI Engine (1024x1024)_`,
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

// ── /yt — YouTube & SoundCloud audio download via yt-dlp ──────────────────────
const yt = {
  name: 'yt',
  aliases: ['ytmp3', 'audio'],
  description: 'Download audio from YouTube/SoundCloud',
  usage: '/yt <youtube url or song name>',
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

    let ytInput = isUrl ? input : `ytsearch1:${input}`;

    const aud = await ToolRunner.optimalAudioArgs();
    const ytdlpArgs = [
      '--no-playlist',
      ...aud.args,
      '--max-filesize', '25m',
      '--output', outTemplate,
      '--print', 'after_move:filepath',
      ytInput,
    ];

    let mp3Res = await ytDlpRun(ytdlpArgs, { timeout: 90000 });
    let audioPath = mp3Res.ok ? mp3Res.stdout.trim().split('\n').pop() : null;

    // Fallback: If YouTube is blocked by bot detection / signature challenge, try SoundCloud
    if (!audioPath || !fs.existsSync(audioPath)) {
      console.log('⚠️ YouTube download failed/blocked. Attempting SoundCloud fallback...');
      const scInput = `scsearch1:${input}`;
      const scArgs = [
        '--no-playlist',
        ...aud.args,
        '--max-filesize', '25m',
        '--output', outTemplate,
        '--print', 'after_move:filepath',
        scInput,
      ];
      mp3Res = await ytDlpRun(scArgs, { timeout: 90000 });
      audioPath = mp3Res.ok ? mp3Res.stdout.trim().split('\n').pop() : null;
    }

    if (!audioPath || !fs.existsSync(audioPath)) {
      const denoMissing = !(await ToolRunner.hasDeno());
      const hint = mp3Res.notFound
        ? `❌ Could not find *yt-dlp*.\n\n💡 Run: pip install -U yt-dlp`
        : `❌ Could not download audio.\n\n💡 Make sure the song name or URL is valid and public.`;
      return sock.sendMessage(chatId, { text: hint }, { quoted: msg });
    }

    try {
      let audioBuffer = fs.readFileSync(audioPath);
      let fileName = path.basename(audioPath);
      const ext = path.extname(audioPath).toLowerCase();
      let mimetype = ext === '.mp3'  ? 'audio/mpeg'
                     : ext === '.m4a'  ? 'audio/mp4'
                     : ext === '.opus' ? 'audio/ogg'
                     : ext === '.ogg'  ? 'audio/ogg'
                     : ext === '.webm' ? 'audio/webm'
                     : 'audio/mp4';

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
      try { fs.unlinkSync(audioPath); } catch(e) {}
    }
  },
};

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
      const apiUrl = `https://www.pinterest.com/resource/BaseSearchResource/get/?data=%7B%22options%22%3A%7B%22query%22%3A%22${encodeURIComponent(query)}%22%2C%22scope%22%3A%22pins%22%7D%7D&_=${Date.now()}`;

      const data = await fetchJson(apiUrl).catch(() => null);

      let imageUrls = [];
      if (data?.resource_response?.data?.results) {
        imageUrls = data.resource_response.data.results
          .filter(p => p.images?.orig?.url)
          .map(p => p.images.orig.url)
          .slice(0, 3);
      }

      if (imageUrls.length === 0) {
        return sock.sendMessage(chatId, {
          text: [
            `📌 *Pinterest: "${query}"*`,
            ``,
            `🔗 View results directly:`,
            `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
          ].join('\n'),
        }, { quoted: msg });
      }

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

    const simpleMatch = problem.match(/^[\d\s+\-*/().^%]+$/);
    if (simpleMatch) {
      try {
        const sanitized = problem.replace(/\^/g, '**');
        const result = new Function(`return (${sanitized})`)();
        if (!isNaN(result) && isFinite(result)) {
          return sock.sendMessage(chatId, {
            text: `🧮 *Math Result*\n\n${problem} = *${result}*`,
          }, { quoted: msg });
        }
      } catch(e) {}
    }

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

const search = {
  name: 'search',
  aliases: ['google', 'query', 'web'],
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
      const google = await googleSearch(question);
      if (google) { body = google; source = 'Google'; }
      if (!body) {
        const ddg = await duckSearch(question);
        if (ddg.length) { body = ddg.map(r => `🔗 *${r.title}*\n${r.url}`).join('\n\n'); source = 'DuckDuckGo'; }
      }
      if (!body && apiKey) {
        try { body = await tavilySearch(question, apiKey); source = 'Tavily'; }
        catch (e) { console.error('⚠ Tavily failed:', e.message); }
      }
      if (!body) { body = await freeWebSearch(question) || 'No results found — try rephrasing.'; source = 'Wikipedia'; }
      return sock.sendMessage(chatId, {
        text: `🔍 *${question}*${source ? `\n\n*via ${source}*` : ''}\n\n${body}`,
      }, { quoted: msg });
    } catch (err) {
      console.error('❌ Search error:', err.message);
      return sock.sendMessage(chatId, {
        text: '❌ Search failed. Try again.',
      }, { quoted: msg });
    }
  },
};

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

    const api = await tiktokDownload(url);
    if (api.ok) {
      await sock.sendMessage(chatId, {
        video: api.buffer,
        mimetype: api.mimetype || 'video/mp4',
        caption: `📱 Downloaded via Astra${api.title ? `\n🎬 ${api.title}` : ''}`,
      }, { quoted: msg });
      return;
    }

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

async function handleMp3Reply(sock, msg, chatId) {
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted) {
    return sock.sendMessage(chatId, {
      text: '❌ Reply to a video or audio message with *!mp3* to extract the audio.',
    }, { quoted: msg });
  }

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

    const ffmpegResult = await ffmpegRun([
      '-i', inPath,
      '-vn',
      '-acodec', 'libmp3lame',
      '-ab', '128k',
      '-y',
      outPath,
    ], { timeout: 60000 });

    try { fs.unlinkSync(inPath); } catch(e) {}

    if (!ffmpegResult.ok || !fs.existsSync(outPath)) {
      const hint = ffmpegResult.notFound
        ? `❌ Could not find *ffmpeg*.\n\n💡 On Windows run:\nwinget install Gyan.FFmpeg --source winget\n\nThen restart the bot.`
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
