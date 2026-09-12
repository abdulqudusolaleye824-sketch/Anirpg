/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — /imagine                          ║
 * ║  AI image generation via Pollinations.ai (Flux)      ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Usage: /imagine <prompt>
 * Sharpened & precise 1024x1024 prompt engineering!
 */

'use strict';

const https = require('https');
const UI = require('../../rpg/utils/UI');

// Per-user cooldown: 20 seconds
const cooldowns = new Map();
const COOLDOWN_MS = 20_000;

function sharpenPrompt(rawPrompt) {
  let prompt = rawPrompt.trim();
  const qualitySuffix = 'masterpiece, ultra-detailed, sharp focus, 8k resolution, cinematic lighting, photorealistic digital art';
  if (!/(masterpiece|8k|detailed|photorealistic|hd|cinematic)/i.test(prompt)) {
    prompt += `, ${qualitySuffix}`;
  }
  return prompt;
}

function buildUrl(prompt) {
  const sharpened = sharpenPrompt(prompt);
  const encoded = encodeURIComponent(sharpened.slice(0, 500));
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true&model=flux`;
}

async function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 45_000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
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
  description: 'Generate a sharp, high-definition AI image from a prompt',
  usage:       '/imagine <your prompt>',
  category:    'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const proI = UI.isPro(getDatabase().users[sender]);

    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: [
          (proI ? UI.PRO_BAR : UI.FREE_BAR),
          '🎨 *AI IMAGE GENERATOR*',
          proI ? (UI.PRO_MINI + '\n' + '🎨 PRO STUDIO') : null,
          proI ? '⚡ Flux 1024×1024 · ⏳ 20s cooldown between renders' : null,
          proI ? '' : null,
          '📌 Usage: /imagine <prompt>',
          '',
          '💡 Examples:',
          '  /imagine Shadow Monarch Sung Jinwoo with purple aura',
          '  /imagine anime girl with silver hair in a crystal dungeon',
          '  /imagine Solo Leveling gate opening over Tokyo skyline',
          (proI ? UI.PRO_BAR : UI.FREE_BAR),
        ].filter(x => x !== null).join('\n'),
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

    await sock.sendMessage(chatId, {
      text: `🎨 *Generating Ultra-Sharp Image...*\n📝 Prompt: _${prompt}_\n\n⏳ Processing 1024x1024 Flux rendering...`,
    }, { quoted: msg });

    try {
      const url    = buildUrl(prompt);
      const buffer = await fetchImageBuffer(url);

      await sock.sendMessage(chatId, {
        image:   buffer,
        caption: `✨ *Ultra-Sharp Image*\n📝 ${prompt}\n\n🎨 _Rendered via Flux AI Engine (1024x1024)_`,
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

// /bypass hook: drop this module's in-memory cooldown for one user.
// Returns true when something was actually cleared.
function resetCooldownsFor(jid) {
  try { return cooldowns.delete(jid) === true; } catch (e) { return false; }
}
module.exports.resetCooldownsFor = resetCooldownsFor;
