/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — /imagine                          ║
 * ║  AI image generation via Pollinations.ai (free)      ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Usage: /imagine <prompt>
 * Example: /imagine Shadow Monarch Sung Jinwoo rising from darkness
 */

'use strict';

const https = require('https');

// Per-user cooldown: 30 seconds
const cooldowns = new Map();
const COOLDOWN_MS = 30_000;

function buildUrl(prompt) {
  const encoded = encodeURIComponent(prompt.slice(0, 500));
  // Pollinations free endpoint — no API key needed
  return `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&nologo=true&enhance=true`;
}

async function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 30_000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Follow redirect
        return fetchImageBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

module.exports = {
  name:        'imagine',
  aliases:     ['imagine', 'gen', 'draw', 'ai'],
  description: 'Generate an AI image from a text prompt',
  usage:       '/imagine <your prompt>',
  category:    'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: [
          '🎨 *AI Image Generator*',
          '',
          '📌 Usage: /imagine <prompt>',
          '',
          '💡 Examples:',
          '  /imagine Shadow Monarch with purple aura',
          '  /imagine anime girl with silver hair in a dungeon',
          '  /imagine Solo Leveling gate opening in Seoul',
        ].join('\n'),
      }, { quoted: msg });
    }

    // Cooldown check
    const last = cooldowns.get(sender) || 0;
    const elapsed = Date.now() - last;
    if (elapsed < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return sock.sendMessage(chatId, {
        text: `⏳ Image generation cooldown: ${wait}s remaining.`,
      }, { quoted: msg });
    }
    cooldowns.set(sender, Date.now());

    const prompt = args.join(' ');

    // Send "generating" notice
    await sock.sendMessage(chatId, {
      text: `🎨 *Generating...*\n📝 Prompt: _${prompt}_\n\n⏳ This takes ~10-15 seconds...`,
    }, { quoted: msg });

    try {
      const url    = buildUrl(prompt);
      const buffer = await fetchImageBuffer(url);

      await sock.sendMessage(chatId, {
        image:   buffer,
        caption: `🎨 *Generated Image*\n📝 ${prompt}`,
        mimetype: 'image/jpeg',
      }, { quoted: msg });

    } catch (err) {
      console.error('❌ Image gen error:', err.message);
      return sock.sendMessage(chatId, {
        text: `❌ Image generation failed.\n🔧 Error: ${err.message}\n\nTry a different prompt or try again in a moment.`,
      }, { quoted: msg });
    }
  },
};
