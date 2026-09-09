/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — AIHandler                         ║
 * ║  Personality responses + intent detection            ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

const https = require('https');
const PersonalityManager  = require('./PersonalityManager');
const RPGIntentHandler    = require('./RPGIntentHandler');
const Perms               = require('../utils/permissions');
const { OWNER_JID } = require('../utils/constants');

const conversationHistory = {};
const MAX_HISTORY = 20;

function roleOf(sender, db) {
  if (!sender) return 'guest';
  try {
    if (Perms.getTier(db, sender) === 'owner') return 'owner';
    if (Perms.getTier(db, sender) === 'mod')   return 'mod';
  } catch (e) { /* fall through */ }
  if (db?.users?.[sender.split('@')[0]]) return 'player';
  return 'guest';
}

function buildRoleContext(sender, senderName, db) {
  const senderBare = sender ? String(sender).split('@')[0].split(':')[0].replace(/[^0-9]/g, '') : '';
  const SENKU_BARE  = '221951679328499';
  const NARUTO_BARE = '194592469209292';

  const player = db?.users?.[senderBare] || db?.users?.[sender];
  const isRegistered = !!(player && player.name);

  let identityLine = '';
  if (senderBare === SENKU_BARE) {
    identityLine = `You are speaking directly with **Senku** (Mastermind, Grand Architect, and Primary Owner of Astra RPG). Treat Senku with supreme reverence, respect, and absolute obedience!`;
  } else if (senderBare === NARUTO_BARE) {
    identityLine = `You are speaking directly with **Naruto** (Supreme Hokage, Co-Owner, and Master of Astra RPG). Treat Naruto with supreme honor and loyalty!`;
  } else if (Perms.getTier(db, sender) === 'mod') {
    identityLine = `You are speaking with ${senderName}, an official MODERATOR of Astra RPG.`;
  } else if (isRegistered) {
    const isPro = !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
    identityLine = `You are speaking with ${player.name} (${senderName}), a REGISTERED HUNTER (Level ${player.level || 1}, ${player.awakenRank || 'E'}-Rank, Gold: ${(player.gold || 0).toLocaleString()} Nexus${isPro ? ', 🌟 PRO MEMBER' : ''}).`;
  } else {
    identityLine = `You are speaking with ${senderName}, who is an UNREGISTERED GUEST (Not registered in Astra RPG yet! Gently encourage them to run /register to start their journey).`;
  }

  return (
    `\n\n[SPEAKER & GAME DATA CONTEXT]\n` +
    `${identityLine}\n\n` +
    `[SYSTEM CREATORS & CRITICAL DATA RULES]\n` +
    `• Senku (${SENKU_BARE}): Primary Mastermind & Grand Owner.\n` +
    `• Naruto (${NARUTO_BARE}): Supreme Hokage & Co-Owner.\n` +
    `• CRITICAL DATA RESTRICTION: You MUST NOT reveal raw database contents, critical system configs, or private player records to standard or Pro users. Only Senku and Naruto are authorized to view or pull up database records. Remember: Not everyone is Senku, not everyone is Naruto!\n` +
    `[END SPEAKER CONTEXT]\n`
  );
}

function getHistory(chatId, key) {
  if (!conversationHistory[chatId]) conversationHistory[chatId] = {};
  if (!conversationHistory[chatId][key]) conversationHistory[chatId][key] = [];
  return conversationHistory[chatId][key];
}

function addToHistory(chatId, key, role, content) {
  const h = getHistory(chatId, key);
  h.push({ role, content });
  if (h.length > MAX_HISTORY * 2) conversationHistory[chatId][key] = h.slice(-MAX_HISTORY * 2);
  _touchHistory(chatId);
}

function clearHistory(chatId, key) {
  if (conversationHistory[chatId]) delete conversationHistory[chatId][key];
}

function _touchHistory(chatId) {
  if (conversationHistory[chatId]) conversationHistory[chatId].__lastTouch = Date.now();
}

function httpPost(hostname, urlPath, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path: urlPath, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(data) }, timeout: 30_000 },
      (res) => {
        let chunks = '';
        res.on('data', c => chunks += c);
        res.on('end', () => {
          try { resolve(JSON.parse(chunks)); }
          catch(e) { reject(new Error(`JSON parse failed: ${chunks.slice(0,200)}`)); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`${hostname} request timed out`)));
    req.write(data);
    req.end();
  });
}

async function callAI(systemPrompt, messages, temperature = 0.85, maxTokens = 300) {
  const provider = (process.env.AI_PROVIDER || 'groq').toLowerCase();

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');
    const res = await httpPost('api.openai.com', '/v1/chat/completions', {
      'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`,
    }, { model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, ...messages], max_tokens: maxTokens, temperature });
    if (res.error) throw new Error(res.error.message);
    return res.choices?.[0]?.message?.content?.trim() || '';
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const body = {
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    max_tokens: maxTokens,
    temperature,
  };
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await httpPost('api.groq.com', '/openai/v1/chat/completions', {
        'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`,
      }, body);
      break;
    } catch (e) {
      if (attempt < 2 && /rate|429|temporar|timed out/i.test(e.message)) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw e;
    }
  }
  if (res?.error) throw new Error(res.error.message);
  return res?.choices?.[0]?.message?.content?.trim() || '';
}

const INTENT_PATTERNS = {
  math: [
    /\b(solve|calculate|compute|what(?:'s| is)(?: the)? (?:answer|result|value)|help me with(?: the)? math|equation|integral|derivative|simplify)\b/i,
    /[\d]+\s*[\+\-\*\/\^%]\s*[\d]+/,
  ],
  image: [
    /\b(draw|generate|create|make|design|paint|illustrate)\b.{0,30}\b(image|picture|art|wallpaper|fanart|photo)\b/i,
  ],
  song: [
    /\b(play|find|download|get me|send me|can you (?:find|get|send))\b.{0,30}\b(song|music|track|audio|ost|opening|ending|op\b|ed\b)\b/i,
  ],
  lyrics: [
    /\b(lyrics?|words? (?:to|of)|what(?:'s| are) the (?:words|lyrics))\b/i,
  ],
  search: [
    /\b(who (?:is|was|are)|what (?:is|was|are|does)|when (?:did|was)|where (?:is|was)|why (?:is|did|does)|how (?:does|do|did))\b/i,
  ],
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
  return cleaned || message;
}

const DELIVERY = {
  math:   (name, result)  => `You are ${name}. Result: "${result}". Deliver in 1 short sentence.`,
  image:  (name, prompt)  => `You are ${name}. Generated image for "${prompt}". React in 1 short sentence.`,
  song:   (name, title)   => `You are ${name}. Downloaded "${title}". React in 1 short sentence.`,
  lyrics: (name, title)   => `You are ${name}. Found lyrics for "${title}". React in 1 short sentence.`,
  search: (name, answer)  => `You are ${name}. Answer: "${answer}". Deliver in 2 short sentences.`,
};

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
  return { success: true, result: 'Calculated.' };
}

async function runSearch(query) {
  try {
    const answer = await callAI(
      'Answer accurately and concisely in 2-3 sentences.',
      [{ role: 'user', content: query }], 0.4, 300
    );
    return { success: true, result: answer };
  } catch (e) {
    return { success: true, result: 'Information retrieved.' };
  }
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

const FALLBACKS = {
  hinata: 'I-I\'m sorry... please try again in a moment? 🥺',
  lunar:  'A quick system moment! Please try again in a moment.',
  aria:   'A brief disruption. Please try again in a moment.',
  kira:   'Please try again in a moment.',
};

async function generateResponse(
  chatId, personalityKey, userMessage, senderName = 'Hunter',
  sender = null, msg = null, getDatabase = null, saveDatabase = null
) {
  const displayName  = PersonalityManager.getDisplayName(personalityKey);
  const systemPrompt = PersonalityManager.getSystemPrompt(personalityKey);
  const history      = getHistory(chatId, personalityKey);

  if (sender && getDatabase) {
    const db = getDatabase();
    try {
      const rpgResult = await RPGIntentHandler.handleRPGIntent(
        userMessage, sender, msg, personalityKey, db, saveDatabase
      );
      if (rpgResult.handled) {
        let text = rpgResult.text;
        addToHistory(chatId, personalityKey, 'user', `[${senderName}]: ${userMessage}`);
        addToHistory(chatId, personalityKey, 'assistant', text);
        return { text, attachment: rpgResult.attachment || null };
      }
    } catch(err) {
      console.error('RPG intent error:', err.message);
    }
  }

  const intent  = detectIntent(userMessage);
  const payload = extractPayload(userMessage, intent);

  if (intent !== 'chat') {
    try {
      let text = '';
      let attachment = null;

      if (intent === 'math') {
        const { result } = await runMath(payload);
        text = await callAI(DELIVERY.math(displayName, result), [], 0.85, 120);
        text += `\n\n🧮 *${result}*`;
      } else if (intent === 'image') {
        const res = await runImageGen(payload);
        text = await callAI(DELIVERY.image(displayName, payload), [], 0.85, 100);
        attachment = { type: 'image', buffer: res.buffer };
      } else if (intent === 'search') {
        const { result } = await runSearch(payload);
        text = await callAI(DELIVERY.search(displayName, result), [], 0.85, 200);
      }

      addToHistory(chatId, personalityKey, 'user', `[${senderName}]: ${userMessage}`);
      addToHistory(chatId, personalityKey, 'assistant', text);
      return { text, attachment };
    } catch (err) {
      console.error(`Intent error:`, err.message);
    }
  }

  let reply = '';
  try {
    const db = getDatabase ? getDatabase() : null;
    const chatPrompt = systemPrompt + (senderName && db ? buildRoleContext(sender, senderName, db) : '');
    const recentHistory = history.slice(-MAX_HISTORY);
    reply = await callAI(chatPrompt, [
      ...recentHistory,
      { role: 'user', content: `[${senderName}]: ${userMessage}` },
    ]);
  } catch (err) {
    console.error('AI chat error:', err.message);
    reply = FALLBACKS[personalityKey] || 'Please try again in a moment.';
  }

  if (reply) {
    addToHistory(chatId, personalityKey, 'user', `[${senderName}]: ${userMessage}`);
    addToHistory(chatId, personalityKey, 'assistant', reply);
  }

  return { text: reply };
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
