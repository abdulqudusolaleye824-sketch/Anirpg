// ═══════════════════════════════════════════════════════════════
// /lyrics — full lyrics for any song (standalone, batch-23).
// Decoupled from /song: this fetches TEXT lyrics only, while /song
// downloads audio. Sources: LRCLIB (no key) → lyrics.ovh → Genius
// scrape when GENIUS_TOKEN is set. 12s per-user cooldown, long
// lyrics chunked under WhatsApp limits.
// ═══════════════════════════════════════════════════════════════
'use strict';

const https = require('https');
const http  = require('http');

const COOLDOWNS   = new Map();
const COOLDOWN_MS = 12_000;
const CHUNK       = 3500;
const UA          = 'AniRPG-AstraLink/1.0 (lyrics)';

function fetchText(url, headers = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', ...headers },
      timeout: 15_000,
    }, (res) => {
      const loc = res.headers.location;
      if (res.statusCode >= 300 && res.statusCode < 400 && loc) {
        const next = String(loc).startsWith('http') ? loc : new URL(loc, url).toString();
        res.resume();
        return fetchText(next, headers, redirects + 1).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
        resolve(body);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function fetchJson(url, headers) {
  const body = await fetchText(url, headers);
  try { return JSON.parse(body); } catch (e) { return null; }
}

function decodeHtml(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseQuery(raw) {
  const q = String(raw || '').replace(/\s+/g, ' ').trim();
  const dash = q.split(/\s+[-–—]\s+/);
  if (dash.length >= 2) {
    return { track: dash[0].trim(), artist: dash.slice(1).join(' - ').trim(), q };
  }
  const by = q.split(/\s+by\s+/i);
  if (by.length === 2) return { track: by[0].trim(), artist: by[1].trim(), q };
  return { track: q, artist: '', q };
}

function scoreHit(hit, track, artist) {
  const t = (hit.trackName || hit.title || '').toLowerCase();
  const a = (hit.artistName || hit.artist || '').toLowerCase();
  const wantT = String(track || '').toLowerCase();
  const wantA = String(artist || '').toLowerCase();
  let s = 0;
  if (t === wantT) s += 8;
  else if ((t && wantT && (t.includes(wantT) || wantT.includes(t)))) s += 4;
  if (wantA && a === wantA) s += 8;
  else if (wantA && (a.includes(wantA) || wantA.includes(a))) s += 4;
  if (hit.plainLyrics && hit.plainLyrics.length > 80) s += 5;
  if (hit.instrumental) s -= 6;
  return s;
}

async function fromLrclib({ track, artist, q }) {
  const url = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`;
  const hits = await fetchJson(url);
  if (!Array.isArray(hits) || !hits.length) return null;

  const ranked = hits
    .map((h) => ({ h, s: scoreHit(h, track, artist) }))
    .sort((a, b) => b.s - a.s);

  for (const { h } of ranked) {
    let lyrics = (h.plainLyrics || '').trim();
    if (!lyrics && h.id) {
      const full = await fetchJson(`https://lrclib.net/api/get/${h.id}`).catch(() => null);
      lyrics = ((full && full.plainLyrics) || '').trim();
    }
    if (!lyrics || lyrics.length < 20) continue;
    if (/^instrumental$/i.test(lyrics)) continue;
    return {
      title: h.trackName || track,
      artist: h.artistName || artist || 'Unknown',
      album: h.albumName || '',
      lyrics,
      source: 'LRCLIB',
    };
  }
  return null;
}

async function fromLyricsOvh({ track, artist }) {
  if (!artist) return null;
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(track)}`;
  const data = await fetchJson(url).catch(() => null);
  const lyrics = decodeHtml((data && data.lyrics) || '');
  if (!lyrics || lyrics.length < 20) return null;
  return { title: track, artist, album: '', lyrics, source: 'lyrics.ovh' };
}

async function fromGenius({ q }, token) {
  if (!token) return null;
  const search = await fetchJson(
    `https://api.genius.com/search?q=${encodeURIComponent(q)}`,
    { Authorization: `Bearer ${token}` }
  ).catch(() => null);
  const hit = search && search.response && search.response.hits && search.response.hits[0] && search.response.hits[0].result;
  if (!hit || !hit.url) return null;

  const html = await fetchText(hit.url, {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/122.0.0.0 Mobile Safari/537.36',
  }).catch(() => '');

  const blocks = [...html.matchAll(/data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi)];
  let text = blocks.map((m) => decodeHtml(m[1])).filter(Boolean).join('\n\n');
  if (!text) {
    const ld = html.match(/<div class="lyrics">([\s\S]*?)<\/div>/i);
    if (ld) text = decodeHtml(ld[1]);
  }
  if (!text || text.length < 40) return null;
  return {
    title: hit.title || q,
    artist: (hit.primary_artist && hit.primary_artist.name) || '',
    album: '',
    lyrics: text,
    source: 'Genius',
    url: hit.url,
  };
}

function chunkLyrics(text) {
  const lines = String(text || '').split('\n');
  const parts = [];
  let buf = '';
  for (const line of lines) {
    if ((buf + '\n' + line).length > CHUNK && buf) {
      parts.push(buf.trim());
      buf = line;
    } else {
      buf = buf ? buf + '\n' + line : line;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.length ? parts : [text];
}

async function sendChunks(sock, chatId, msg, result) {
  const header = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `🎵 *${result.title}*`,
    result.artist ? `🎤 ${result.artist}` : null,
    result.album ? `💿 ${result.album}` : null,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ].filter((l) => l !== null).join('\n');

  const parts = chunkLyrics(result.lyrics);
  for (let i = 0; i < parts.length; i++) {
    const more = parts.length > 1 ? `\n\n_(${i + 1}/${parts.length})_` : '';
    const foot = i === parts.length - 1
      ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📡 ${result.source}${result.url ? `\n🔗 ${result.url}` : ''}`
      : '';
    const body = (i === 0 ? header : `🎵 *${result.title}* _(cont.)_\n\n`) + parts[i] + more + foot;
    await sock.sendMessage(chatId, { text: body }, { quoted: i === 0 ? msg : undefined });
    if (i < parts.length - 1) await new Promise((r) => setTimeout(r, 350));
  }
}

module.exports = {
  name:        'lyrics',
  aliases:     ['lyric', 'lrc', 'songlyrics'],
  description: 'Fetch full song lyrics',
  usage:       '/lyrics <song> [- artist]',
  category:    'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: [
          '🎵 *Lyrics*',
          '',
          '📌 `/lyrics <song>`',
          '📌 `/lyrics <song> - <artist>`',
          '',
          'Examples:',
          '• `/lyrics Blinding Lights`',
          '• `/lyrics Shinzou wo Sasageyo - Linked Horizon`',
          '• `/lyrics Alone Marshmello`',
        ].join('\n'),
      }, { quoted: msg });
    }

    const last = COOLDOWNS.get(sender) || 0;
    if (Date.now() - last < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
      return sock.sendMessage(chatId, { text: `⏳ Wait ${wait}s before another lyrics search.` }, { quoted: msg });
    }
    COOLDOWNS.set(sender, Date.now());

    const parsed = parseQuery(args.join(' '));
    await sock.sendMessage(chatId, {
      text: `🔍 Looking up *${parsed.track}*${parsed.artist ? ` — ${parsed.artist}` : ''}…`,
    }, { quoted: msg });

    try {
      let result = await fromLrclib(parsed).catch((e) => { console.error('lyrics lrclib:', e.message); return null; });
      if (!result) result = await fromLyricsOvh(parsed).catch(() => null);
      if (!result) result = await fromGenius(parsed, process.env.GENIUS_TOKEN).catch((e) => {
        console.error('lyrics genius:', e.message); return null;
      });

      if (!result) {
        return sock.sendMessage(chatId, {
          text: `❌ No full lyrics for _${parsed.q}_\n\nTry:\n• Add the artist: \`/lyrics song - artist\`\n• Check spelling`,
        }, { quoted: msg });
      }

      return sendChunks(sock, chatId, msg, result);
    } catch (err) {
      console.error('❌ Lyrics error:', err.message);
      return sock.sendMessage(chatId, {
        text: `❌ Could not fetch lyrics.\n🔧 ${err.message}`,
      }, { quoted: msg });
    }
  },
};

module.exports._parseQuery = parseQuery;
module.exports._chunkLyrics = chunkLyrics;
module.exports._decodeHtml = decodeHtml;

// /bypass hook: drop this module's in-memory cooldown for one user.
// Returns true when something was actually cleared.
function resetCooldownsFor(jid) {
  try { return COOLDOWNS.delete(jid) === true; } catch (e) { return false; }
}
module.exports.resetCooldownsFor = resetCooldownsFor;
