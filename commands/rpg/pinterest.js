/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — /pinterest                        ║
 * ║  Search & SEND Pinterest images (no API key)        ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Usage: /pinterest <search query> [|1-10] (default 4 images).
 * Sends up to N images to the chat (quoted reply).
 *
 * NOTE on sources: Pinterest's own pages are fully client-rendered (scrapes
 * return 0) and Bing serves wrong-topic garbage to datacenter IPs, so both are
 * out. Keyless route is Brave image search → Flickr tag feed → Wikimedia
 * Commons API, merged until the candidate pool is healthy.
 */

'use strict';

const https       = require('https');
const http        = require('http');
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

function fetchBuffer(url, referer, _hops = 0) {
  return new Promise((resolve, reject) => {
    const lib = String(url).startsWith('http://') ? http : https;
    const req = lib.get(url, {
      timeout: 25_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'image/*,*/*;q=0.8',
        ...(referer ? { Referer: referer } : {}),
      },
    }, (res) => {
      // Push #28: follow redirects (many image hosts 301/302 hotlinks).
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && _hops < 4) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        return resolve(fetchBuffer(next, referer, _hops + 1));
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
    req.on('timeout', () => { req.destroy(); reject(new Error('Image fetch timeout')); });
  });
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------
// Push #28: Bing dropped — from datacenter IPs it returns WRONG-TOPIC results
// (bot-mitigation garbage page), which is worse than no results. Source order:
// Brave (full-web index, bot-tolerant HTML) → Flickr tag feed (direct URLs) →
// Wikimedia Commons API (guaranteed relevant when it hits). All keyless.

// Attempt #1: Brave image search (keyless HTML, no token dance).
async function searchBrave(query) {
  const url = `https://search.brave.com/images?q=${encodeURIComponent(query)}&source=web`;
  const html = await get(url);
  const clean = String(html).replace(/&amp;/g, '&');
  return [...new Set(
    [...clean.matchAll(/https:\/\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]*)?/gi)]
      .map((m) => m[0].split('?')[0])
      .filter((u) => !/brave\.com|favicon|logo|icon|sprite|schema\.org|static\./i.test(u))
  )];
}

// Attempt #2: Flickr public feed (keyless JSON, hotlink-friendly direct URLs).
async function searchFlickr(query) {
  const tags = String(query || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter(Boolean).slice(0, 5).join(',');
  if (!tags) return [];
  const url = `https://www.flickr.com/services/feeds/photos_public.gne?tags=${encodeURIComponent(tags)}&format=json&nojsoncallback=1`;
  const html = await get(url);
  let d;
  try { d = JSON.parse(html); } catch (_) { return []; }
  return (d.items || [])
    .map((it) => (it.media?.m || '').replace('_m.', '_b.'))
    .filter((u) => /^https:\/\//.test(u));
}

// Attempt #3: Wikimedia Commons API (keyless, always relevant when it hits).
async function searchCommons(query) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url&iiurlwidth=800`;
  const html = await get(url);
  let d;
  try { d = JSON.parse(html); } catch (_) { return []; }
  return Object.values(d.query?.pages || {})
    .map((p) => p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url || '')
    .filter((u) => /^https:\/\//.test(u));
}

async function collectImages(query) {
  // Merge sources until the candidate pool is healthy — a thin pool gets
  // supplemented, so one walled source can't starve the result.
  const seen = new Set();
  const out = [];
  const add = (urls) => {
    for (const u of urls || []) {
      const clean = String(u).split('?')[0];
      if (!/\.(jpe?g|png|webp|gif)$/i.test(clean)) continue;
      if (seen.has(clean)) continue;
      seen.add(clean);
      out.push(clean);
      if (out.length >= 20) break;
    }
  };
  try { add(await searchBrave(query)); } catch (e) { console.error('⚠️ Pinterest/Brave:', e.message); }
  if (out.length < 6) { try { add(await searchFlickr(query)); } catch (e) { console.error('⚠️ Pinterest/Flickr:', e.message); } }
  if (out.length < 6) { try { add(await searchCommons(query)); } catch (e) { console.error('⚠️ Pinterest/Commons:', e.message); } }
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

    // Push #28: over-fetch — walk the whole pool until `count` actually send.
    const toSend = imageUrls.slice(0, Math.max(count * 2, 10));
    let sent = 0;

    for (const url of toSend) {
      if (sent >= count) break;
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
          caption:  sent === 0 ? `📌 _${query}_` : '',
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
    if (sent < count) {
      await sock.sendMessage(chatId, {
        text: `⚠️ Only ${sent} of ${count} images loaded — the rest failed to download. Try again!`,
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
