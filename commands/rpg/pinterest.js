/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — /pinterest                        ║
 * ║  Search & SEND Pinterest images (no API key)        ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Usage: /pinterest <search query>
 * Sends up to 4 images to the chat (quoted reply).
 *
 * NOTE on Pinterest's own search page: it is fully client-rendered (no server
 * side results), so a plain HTML scrape returns 0 images. The reliable keyless
 * route is Bing image search, which also surfaces genuine i.pinimg.com
 * Pinterest-hosted pins. We try the Pinterest scrape first (rarely works), then
 * fall back to Bing and PREFER Pinterest-hosted images.
 */

'use strict';

const https       = require('https');
const COOLDOWNS   = new Map();
const COOLDOWN_MS = 20_000;

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function get(url, hdrs = {}, asJson = false) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: 20_000,
      headers: Object.assign({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      }, hdrs),
    }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => resolve(asJson ? { status: res.statusCode, text: html } : html));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

function fetchBuffer(url, referer) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: 25_000,
      headers: { 'User-Agent': 'Mozilla/5.0', ...(referer ? { Referer: referer } : {}) },
    }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Image fetch timeout')); });
  });
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------
// Attempt #1: Pinterest search page inline scrape (works only if Pinterest ever
// server-renders; usually yields 0 today).
async function searchPinterest(query) {
  const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;
  try {
    const html = await get(url);
    const imgs = [...new Set([...html.matchAll(/https:\/\/i\.pinimg\.com\/(originals|[0-9]+x)\/([0-9a-f]+\/[0-9a-f]+\/[0-9a-f]+\/[0-9a-f]+\.(?:jpg|png|webp))/gi)].map((m) => m[0]))];
    return imgs;
  } catch (_) {
    return [];
  }
}

// Attempt #2: Bing image search (keyless). Prefer Pinterest-hosted URLs first.
async function searchBing(query) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`;
  const html = await get(url);
  const urls = [...new Set(
    [...html.matchAll(/murl&quot;:&quot;([^&]+)&quot;/g)].map((m) => decodeURIComponent(m[1]))
  )];
  const pin = urls.filter((u) => /pinimg\.com|pinterest/i.test(u));
  return [...new Set([...pin, ...urls])];
}

async function collectImages(query) {
  let urls = await searchPinterest(query);        // Pinterest first (rare)
  if (!urls.length) {
    try {
      urls = await searchBing(`${query} pinterest`); // Bing fallback (keyless)
    } catch (_) {
      urls = [];
    }
  }
  // normalize, dedupe, drop non-image
  const seen = new Set();
  const out = [];
  for (const u of urls) {
    const clean = u.split('?')[0];
    if (!/\.(jpe?g|png|webp|gif)$/i.test(clean)) continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= 10) break;
  }
  return out;
}

// "/pinterest satoru gojo |5" → { query: 'satoru gojo', count: 5 }.
// Count clamps to 1..10, default 4.
function parseQueryCount(raw) {
  const m = String(raw || '').match(/^(.*?)\s*\|\s*(\d+)\s*$/);
  if (!m) return { query: String(raw || '').trim(), count: 4 };
  const n = parseInt(m[2], 10);
  return { query: m[1].trim(), count: Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : 4 };
}

// ---------------------------------------------------------------------------
module.exports = {
  name:        'pinterest',
  aliases:     ['pin', 'pins', 'pimg'],
  description: 'Search & send Pinterest images',
  usage:       '/pinterest <query>',
  category:    'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: [
          '📌 *Pinterest Image Search*',
          '',
          '📌 Usage: /pinterest <query> [|1-10]',
          '💡 Examples:',
          '  /pinterest anime aesthetic wallpaper',
          '  /pinterest Solo Leveling fanart',
          '  /pinterest satoru gojo |5',
        ].join('\n'),
      }, { quoted: msg });
    }

    const last = COOLDOWNS.get(sender) || 0;
    if (Date.now() - last < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
      return sock.sendMessage(chatId, { text: `⏳ Pinterest cooldown: ${wait}s remaining.` }, { quoted: msg });
    }
    COOLDOWNS.set(sender, Date.now());

    const { query, count } = parseQueryCount(args.join(' '));
    if (!query) {
      return sock.sendMessage(chatId, { text: '❌ Usage: /pinterest <query> [|1-10]\nExample: /pinterest satoru gojo |5' }, { quoted: msg });
    }

    await sock.sendMessage(chatId, {
      text: `📌 Searching images for: _${query}_...`,
    }, { quoted: msg });

    let imageUrls;
    try {
      imageUrls = await collectImages(query);
    } catch (err) {
      return sock.sendMessage(chatId, {
        text: `❌ Pinterest search failed.\n🔧 ${err.message}`,
      }, { quoted: msg });
    }

    if (!imageUrls || imageUrls.length === 0) {
      return sock.sendMessage(chatId, {
        text: `❌ No images found for: _${query}_\n\nTry a different search term.`,
      }, { quoted: msg });
    }

    // Send up to `count` images as a quoted reply to the user
    const toSend = imageUrls.slice(0, count);
    let sent = 0;

    for (const url of toSend) {
      try {
        const buffer = await fetchBuffer(url, 'https://www.bing.com/');
        // only send if it looks like an image (jpeg/png/webp magic bytes)
        const head = buffer.slice(0, 4).toString('hex');
        const looksImage = /ffd8ff|89504e47|47494638|52494646/.test(head);
        if (!looksImage) throw new Error('Not an image');

        await sock.sendMessage(chatId, {
          image:    buffer,
          mimetype: /89504e47/.test(head) ? 'image/png'
                  : /47494638/.test(head) ? 'image/gif'
                  : /52494646/.test(head) ? 'image/webp'
                  : 'image/jpeg',
          caption:  sent === 0 ? `📌 Pinterest: _${query}_ (${toSend.length} images)` : '',
        }, { quoted: msg });
        sent++;
        if (sent < toSend.length) await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.error('⚠️ Pinterest image send error:', err.message);
      }
    }

    if (sent === 0) {
      return sock.sendMessage(chatId, {
        text: `❌ Found results but could not download images for: _${query}_`,
      }, { quoted: msg });
    }
  },
};

// /bypass hook: drop this module's in-memory cooldown for one user.
// Returns true when something was actually cleared.
function resetCooldownsFor(jid) {
  try { return COOLDOWNS.delete(jid) === true; } catch (e) { return false; }
}
module.exports.resetCooldownsFor = resetCooldownsFor;
module.exports._parseQueryCount = parseQueryCount;
