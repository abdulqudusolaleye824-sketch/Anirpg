/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — AIHandler                         ║
 * ║  Personality responses + intent detection            ║
 * ║  Batch-35: 100% scripted — ZERO AI calls. The chat   ║
 * ║  brain is ScriptedPersona (banks + rotation). No     ║
 * ║  keys, no network for chat, works fully offline      ║
 * ║  (image-gen still fetches its picture over HTTPS).   ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

const https = require('https');
const PersonalityManager  = require('./PersonalityManager');
const RPGIntentHandler    = require('./RPGIntentHandler');
const Perms               = require('../utils/permissions');

const conversationHistory = {};
const MAX_HISTORY = 50; // per-player messages kept (was 20, shared across the whole chat)

// Per-player memory: chat → player → personality → last 50 messages
function getHistory(chatId, key, sender) {
  const who = sender || '_group';
  if (!conversationHistory[chatId]) conversationHistory[chatId] = {};
  if (!conversationHistory[chatId][who]) conversationHistory[chatId][who] = {};
  if (!conversationHistory[chatId][who][key]) conversationHistory[chatId][who][key] = [];
  return conversationHistory[chatId][who][key];
}

function addToHistory(chatId, key, sender, role, content) {
  const h = getHistory(chatId, key, sender);
  h.push({ role, content });
  if (h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY);
  _touchHistory(chatId);
}

function clearHistory(chatId, key, sender = null) {
  if (!conversationHistory[chatId]) return;
  if (sender) {
    if (conversationHistory[chatId][sender]) delete conversationHistory[chatId][sender][key];
  } else {
    for (const who of Object.keys(conversationHistory[chatId])) {
      if (who.startsWith('__')) continue;
      if (conversationHistory[chatId][who]?.[key]) delete conversationHistory[chatId][who][key];
    }
  }
}

function _touchHistory(chatId) {
  if (conversationHistory[chatId]) conversationHistory[chatId].__lastTouch = Date.now();
}

// Lewd / sexually-explicit content → gentle in-character deflection (never comply, never preach)
const LEWD_PATTERNS = [
  /\b(sex|porn|hentai|xxx|nsfw|nude|naked|boobs|tits|pussy|dick|cock|blowjob|handjob|masturbat|orgasm|horny|seductive|sexy pics?|nudes|rule ?34)\b/i,
  /\b(sexy|nude|naked|hot|lewd).{0,20}\b(pics?|pictures?|photos?|images?)\b/i,
  /\b(send|show|give me).{0,20}\b(pic|picture|photo|image).{0,20}\b(sexy|nude|naked|hot|lewd)\b/i,
  /\b(dirty talk|phone sex|sext|erotic|fetish|bdsm|kinky)\b/i,
];

const INTENT_PATTERNS = {
  math: [
    /\b(solve|calculate|compute|what(?:'s| is)(?: the)? (?:answer|result|value)|help me with(?: the)? math|equation|integral|derivative|simplify)\b/i,
    /[\d]+\s*[\+\-\*\/\^%]\s*[\d]+/,
  ],
  image: [
    /\b(draw|generate|create|make|design|paint|illustrate)\b.{0,30}\b(image|picture|art|wallpaper|fanart|photo)\b/i,
  ],
  // NOTE: song/lyrics intents were REMOVED — they had no backend (the game has no
  // music feature), so every match returned an EMPTY reply. Those messages now
  // fall through to normal chat, which answers honestly in character.
  // NOTE 2 (batch-35): the search intent was REMOVED with the AI — its backend
  // WAS the AI. Questions now fall through to the scripted chat below.
};

const CONVERSATIONAL = [
  /\b(hi|hello|hey|yo|sup|howdy|hola)\b/i,
  /\bhow are you\b/i,
  /\bwho are you\b/i,
  /\bwhat(?:'s| is) your name\b/i,
  /\bthank|thanks|thx|ty\b/i,
];

function detectIntent(message) {
  if (CONVERSATIONAL.some(re => re.test(message))) return 'chat';
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) return intent;
    }
  }
  return 'chat';
}

function extractPayload(message, intent) {
  let cleaned = message.replace(/^[A-Z][a-z]+[,\s]+/, '').trim();
  if (intent === 'math') {
    // Strip the verb so runMath gets a pure expression ("calculate 2+2" → "2+2").
    cleaned = cleaned.replace(/^(?:please\s+)?(?:solve|calculate|compute|evaluate|simplify|what(?:'s| is)(?: the)?(?: answer| result| value)?(?: to| of| for)?)\s*/i, '').trim();
  }
  return cleaned || message;
}

async function runMath(query) {
  if (/^[\d\s+\-*/().^%]+$/.test(query) && query.length < 200) {
    try {
      const expr = query.replace(/\^/g, '**');
      const result = new Function(`return (${expr})`)();
      if (!isNaN(result) && isFinite(result)) {
        return { success: true, result: `${query} = ${result}` };
      }
    } catch(e) {}
  }
  return { success: false, result: null }; // not computable → fall through to chat
}

async function runImageGen(prompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true`;
  const buffer = await new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
  return { success: true, buffer };
}

async function generateResponse(
  chatId, personalityKey, userMessage, senderName = 'Hunter',
  sender = null, msg = null, getDatabase = null, saveDatabase = null
) {
  const displayName = PersonalityManager.getDisplayName(personalityKey);
  const SP = require('./ScriptedPersona');

  // ── Scripted persona context (owner-gating for the royal lines) ──
  let _db = null;
  try { _db = getDatabase ? getDatabase() : null; } catch (e) {}
  let _isOwner = false, _isMod = false;
  try {
    _isOwner = Perms.isBotOwner(_db, sender);
    _isMod = Perms.isBotMod(_db, sender);
  } catch (e) {}
  const scriptCtx = { senderName, botName: displayName, isOwner: _isOwner, isMod: _isMod };

  // ── Lewd shutdown (first, before any intent/game handling) ──
  if (LEWD_PATTERNS.some(re => re.test(userMessage))) {
    const text = SP.deflect(personalityKey, scriptCtx);
    addToHistory(chatId, personalityKey, sender, 'user', `[${senderName}]: ${userMessage}`);
    addToHistory(chatId, personalityKey, sender, 'assistant', text);
    return { text };
  }

  if (sender && getDatabase) {
    const db = getDatabase();
    try {
      const rpgResult = await RPGIntentHandler.handleRPGIntent(
        userMessage, sender, msg, personalityKey, db, saveDatabase
      );
      if (rpgResult.handled) {
        let text = rpgResult.text;
        addToHistory(chatId, personalityKey, sender, 'user', `[${senderName}]: ${userMessage}`);
        addToHistory(chatId, personalityKey, sender, 'assistant', text);
        return { text, attachment: rpgResult.attachment || null };
      }
    } catch(err) {
      console.error('RPG intent error:', err.message);
    }
  }

  const intent  = detectIntent(userMessage);
  const payload = extractPayload(userMessage, intent);

  // ── Wired intents (math/image only — each with a real backend).
  // Any failure falls THROUGH to scripted chat below, so the player
  // always gets an answer instead of silence.
  if (intent !== 'chat') {
    try {
      let text = '';
      let attachment = null;

      if (intent === 'math') {
        const r = await runMath(payload);
        if (!r.success) throw new Error('math-fallback');
        text = SP.delivery(personalityKey, 'math', scriptCtx);
        text += `\n\n🧮 *${r.result}*`;
      } else if (intent === 'image') {
        const res = await runImageGen(payload);
        text = SP.delivery(personalityKey, 'image', scriptCtx);
        attachment = { type: 'image', buffer: res.buffer };
      } else {
        throw new Error('unwired-intent');
      }

      if (!text && !attachment) throw new Error('empty-intent');
      addToHistory(chatId, personalityKey, sender, 'user', `[${senderName}]: ${userMessage}`);
      addToHistory(chatId, personalityKey, sender, 'assistant', text);
      return { text, attachment };
    } catch (err) {
      console.error(`Intent error, falling through to chat:`, err.message);
    }
  }

  // ── Scripted persona replies ──
  try {
    const s = SP.respond(personalityKey, userMessage, scriptCtx);
    if (s) {
      addToHistory(chatId, personalityKey, sender, 'user', `[${senderName}]: ${userMessage}`);
      addToHistory(chatId, personalityKey, sender, 'assistant', s);
      return { text: s };
    }
  } catch (err) { console.error('Scripted persona error:', err.message); }

  // ── Scripted fallback: always an answer, never an error ──
  let fb = '';
  try { fb = SP.fallback(personalityKey, scriptCtx); } catch (e) { fb = ''; }
  if (!fb) fb = 'Hmm, interesting... tell me more! 🤔';
  addToHistory(chatId, personalityKey, sender, 'user', `[${senderName}]: ${userMessage}`);
  addToHistory(chatId, personalityKey, sender, 'assistant', fb);
  return { text: fb };
}

async function generateAllResponses(chatId, userMessage, senderName = 'Hunter', sender = null, msg = null, getDatabase = null, saveDatabase = null) {
  let keys = [];
  try {
    const MSM = require('./MultiSocketManager');
    keys = Object.keys(MSM.getAllSockets() || {});
  } catch (_) {}
  if (keys.length === 0) {
    keys = PersonalityManager.getPresentBots(chatId);
  }
  if (keys.length === 0) return [];

  const results = await Promise.allSettled(
    keys.map(async (key) => {
      const res = await generateResponse(chatId, key, userMessage, senderName, sender, msg, getDatabase, saveDatabase);
      return { personalityKey: key, displayName: PersonalityManager.getDisplayName(key), ...res };
    })
  );

  return results.filter(r => r.status === 'fulfilled').map(r => r.value);
}

module.exports = { generateResponse, generateAllResponses, clearHistory };
