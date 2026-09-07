/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — AIHandler                         ║
 * ║  Personality responses + intent detection            ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Flow for every incoming message:
 *  1. Detect intent (math / image / song / lyrics / search / chat)
 *  2. If utility intent → run the utility, get result
 *  3. Ask the personality to deliver the result in character
 *  4. If pure chat → normal personality response
 *
 * generateResponse now returns { text, attachment? } instead of a plain string.
 * Callers (MultiSocketManager) must handle the attachment field.
 */

'use strict';

const https = require('https');
const PersonalityManager  = require('./PersonalityManager');
const RPGIntentHandler    = require('./RPGIntentHandler');
const Perms               = require('../utils/permissions');
const { OWNER_JID } = require('../utils/constants');

// ── Conversation history ──────────────────────────────────────────────────────
const conversationHistory = {};
// Keep more recent turns for better long-conversation recall. The slice(-MAX*2)
// trims storage; the prompt builder passes the last few turns to the model.
// 20 gives solid recent context without blowing the free-tier token budget.
const MAX_HISTORY = 20;

// ── Authoritative role context ───────────────────────────────────────────────
// Tells the model WHO is talking so it consistently recognizes the owner as
// its MASTER, treats mods as its handlers, and everyone else as a player/guest.
// This fixes the "it sometimes recognizes me as master, sometimes not" bug.
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
  const role = roleOf(sender, db);
  const lines = {
    owner:  `You are speaking with ${senderName}, your MASTER. Treat ${senderName} as your creator and owner: defer to them, address them as master, and never talk down to them.`,
    mod:    `You are speaking with ${senderName}, a MODERATOR who manages you. Treat ${senderName} as a trusted assistant/handler: be respectful and helpful. A mod is not your master.`,
    player: `You are speaking with ${senderName}, a regular player/hunter. Be friendly and in-character, but a player is NOT your master.`,
    guest:  `You are speaking with ${senderName}, a guest who isn't registered yet. Be welcoming, but they are not your master.`,
  };
  return (
    `\n\n[WHO IS SPEAKING]\n${lines[role]}\n` +
    `Your only master/owner is the registered owner (${OWNER_JID || 'the host'}). ` +
    `Never treat a mod, player, or guest as your master. Only the owner/co-owner is your master.\n` +
    `[END WHO IS SPEAKING]`
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

// Periodic cleanup of history for inactive chats (memory leak guard).
// Drop entries that haven't been touched in 6 hours.
setInterval(() => {
  const now = Date.now();
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  let pruned = 0;
  for (const chatId of Object.keys(conversationHistory)) {
    const last = conversationHistory[chatId].__lastTouch || 0;
    if (now - last > SIX_HOURS) {
      delete conversationHistory[chatId];
      pruned++;
    }
  }
  if (pruned > 0) console.log(`🧹 Pruned ${pruned} stale AI conversation histories`);
}, 30 * 60 * 1000);

function _touchHistory(chatId) {
  if (conversationHistory[chatId]) conversationHistory[chatId].__lastTouch = Date.now();
}

// ── HTTP POST helper ──────────────────────────────────────────────────────────
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

// ── AI call (Groq or OpenAI) ──────────────────────────────────────────────────
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

  // Default: Groq. Model is configurable via .env (GROQ_MODEL). gpt-oss-20b is
  // the lighter, higher-TPM model that's more reliable on the free tier; the
  // heavier gpt-oss-120b hits the 8k TPM cap quickly. Retry on 429 (rate limit)
  // with a short backoff so a temporary spike doesn't surface a fallback error.
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
      // 429 / rate-limit or transient — retry with backoff, then give up.
      if (attempt < 2 && /rate|429|temporar|timed out/i.test(e.message)) {
        const wait = (attempt + 1) * 2500;
        console.error(`⚠️ AI retry ${attempt + 1} in ${wait}ms (${e.message})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
  if (res.error) throw new Error(res.error.message);
  return res.choices?.[0]?.message?.content?.trim() || '';
}

// ── Intent Detection ──────────────────────────────────────────────────────────
const INTENT_PATTERNS = {
  math: [
    /\b(solve|calculate|compute|what(?:'s| is)(?: the)? (?:answer|result|value)|help me with(?: the)? math|equation|integral|derivative|simplify)\b/i,
    /[\d]+\s*[\+\-\*\/\^%]\s*[\d]+/,   // contains arithmetic ops
    /\b\d+x\b|\bx\s*=|\bx\^/i,          // algebra
  ],
  image: [
    /\b(draw|generate|create|make|design|paint|illustrate)\b.{0,30}\b(image|picture|art|wallpaper|fanart|photo)\b/i,
    /\b(show me a picture of|generate an? image of|draw me)\b/i,
  ],
  song: [
    /\b(play|find|download|get me|send me|can you (?:find|get|send))\b.{0,30}\b(song|music|track|audio|ost|opening|ending|op\b|ed\b)\b/i,
    /\bi want to (?:hear|listen to)\b/i,
  ],
  lyrics: [
    /\b(lyrics?|words? (?:to|of)|what(?:'s| are) the (?:words|lyrics))\b/i,
    /\blyrics? (?:for|of|to)\b/i,
  ],
  search: [
    /\b(who (?:is|was|are)|what (?:is|was|are|does)|when (?:did|was)|where (?:is|was)|why (?:is|did|does)|how (?:does|do|did))\b/i,
    /\b(tell me about|explain|look up|search for|find info (?:about|on))\b/i,
  ],
};

// Phrases that are conversational, NOT searches. These force normal
// personality chat so users talking to Luna / Hinata get an in-character
// reply instead of a web-search result. Add more as needed.
const CONVERSATIONAL = [
  /\b(hi|hello|hey|yo|sup|howdy|hola)\b/i,
  /\bhow are you\b/i,
  /\bwho are you\b/i,
  /\bwhat(?:'s| is) your name\b/i,
  /\bwhat are you\b/i,
  /\bare you (?:real|human|an? ai|alive|a bot)\b/i,
  /\b(what's|what is) up\b/i,
  /\b(thank|thanks|thx|ty|appreciate)\b/i,
  /\bgood (?:morning|afternoon|evening|night)\b/i,
  /\b(ok|okay|k|sure|alright|fine)\b/i,
  /\b(can|could|will|would) you (?:help|assist)\b/i,
  /\bwhat can you do\b/i,
  /\b(bye|goodbye|cya|gtg|later)\b/i,
  /\b(are you|you are)\b/i,
];

function detectIntent(message) {
  // If it's clearly conversational, never treat it as a search/math intent.
  if (CONVERSATIONAL.some(re => re.test(message))) return 'chat';
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) return intent;
    }
  }
  return 'chat';
}

// Strip filler to get the core query
function extractPayload(message, intent) {
  const STRIP = {
    math:   /^(?:[\w]+[,\s]+)?(?:can you\s+)?(?:solve|calculate|compute|help me with(?: the)? math(?:\s+problem)?(?:\s+of)?|what(?:'s| is)(?: the)? (?:answer|result|value)(?:\s+(?:to|of|for))?)\s*/i,
    image:  /^(?:[\w]+[,\s]+)?(?:can you\s+)?(?:draw|generate|create|make|design|paint|illustrate|show me a picture of|generate an? image of|draw me(?: an?)?)\s*/i,
    song:   /^(?:[\w]+[,\s]+)?(?:can you\s+)?(?:play|find|download|get me|send me|i want to (?:hear|listen to)|can you (?:find|get|send)(?: me)?)\s*/i,
    lyrics: /^(?:[\w]+[,\s]+)?(?:can you\s+)?(?:get|find|show)(?: me)?(?: the)? lyrics? (?:for|of|to)\s*/i,
    search: /^(?:[\w]+[,\s]+)?(?:can you\s+)?(?:tell me about|explain|look up|search for|find info (?:about|on)|who (?:is|was)|what (?:is|was|does)|when (?:did|was)|where (?:is|was)|why (?:is|does)|how (?:does|do))\s*/i,
  };

  let cleaned = message;
  if (STRIP[intent]) cleaned = cleaned.replace(STRIP[intent], '').trim();
  // Remove leading bot name if present (e.g. "Hinata, " or "Lunar ")
  cleaned = cleaned.replace(/^[A-Z][a-z]+[,\s]+/, '').trim();
  return cleaned || message;
}

// ── Personality delivery prompts ──────────────────────────────────────────────
const DELIVERY = {
  math:   (name, result)  => `You are ${name}. You just solved a math problem for a user. The answer is: "${result}". Deliver this in 1-2 sentences, completely in character as ${name}. Keep it short.`,
  image:  (name, prompt)  => `You are ${name}. You just generated an AI image based on the user's request: "${prompt}". React to this in 1 sentence, completely in character as ${name}.`,
  song:   (name, title)   => `You are ${name}. You just found and downloaded the song "${title}" for the user. React in 1 sentence, completely in character as ${name}.`,
  lyrics: (name, title)   => `You are ${name}. You just found the lyrics page for "${title}". React in 1 sentence, completely in character as ${name}.`,
  search: (name, answer)  => `You are ${name}. You just looked something up for a user. The information is: "${answer}". Deliver this in 2-3 sentences, naturally in character as ${name}.`,
};

// ── Utility runners ───────────────────────────────────────────────────────────

async function runMath(query) {
  // Simple arithmetic — restrict to a safe character set, then cap result magnitude
  if (/^[\d\s+\-*/().^%]+$/.test(query) && query.length < 200) {
    try {
      const expr = query.replace(/\^/g, '**');
      // Use Function constructor inside a capped sandbox. Limit ** exponents
      // so a malicious "9**9**9" can't lock the event loop.
      if (/\*\*\s*(\d{4,})/.test(expr)) {
        // Reject expressions with exponents of 4+ digits
      } else {
        const result = new Function(`return (${expr})`)();
        if (!isNaN(result) && isFinite(result) && Math.abs(result) < 1e15) {
          return { success: true, result: `${query} = ${result}` };
        }
      }
    } catch(e) {}
  }
  // Complex — AI solver
  const answer = await callAI(
    'You are a math solver. Solve the problem step by step. Show the final answer clearly. Plain text only.',
    [{ role: 'user', content: query }], 0.1, 400
  );
  return { success: true, result: answer };
}

async function runSearch(query) {
  const tavilyKey = process.env.TAVILY_API_KEY;

  // Use Tavily for real-time results if key is set
  if (tavilyKey) {
    try {
      const body = JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: 'basic',
        max_results: 3,
        include_answer: true,
      });

      const result = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'api.tavily.com',
          path: '/search',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        }, (res) => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => {
            try {
              const json = JSON.parse(d);
              // Return the direct answer or first result snippet
              const answer = json.answer
                || json.results?.[0]?.content?.slice(0, 400)
                || 'No results found.';
              resolve(answer);
            } catch(e) { reject(e); }
          });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });

      return { success: true, result };
    } catch(err) {
      console.error('Tavily fallback to Groq:', err.message);
    }
  }

  // Fallback: Groq knowledge
  const answer = await callAI(
    'You are a knowledgeable assistant. Answer accurately and concisely in 3-4 sentences. Plain text only.',
    [{ role: 'user', content: query }], 0.4, 400
  );
  return { success: true, result: answer };
}

async function runImageGen(prompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&seed=${Math.floor(Math.random()*999999)}&nologo=true`;
  const buffer = await new Promise((resolve, reject) => {
    const follow = (u) => {
      https.get(u, { headers: { 'User-Agent': 'Astra/1.0' } }, (res) => {
        if ([301,302,303,307,308].includes(res.statusCode)) return follow(res.headers.location);
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Image gen HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    };
    follow(url);
  });
  // Verify it's actually a JPEG/PNG (pollinations sometimes returns HTML error pages)
  if (!buffer || buffer.length < 100) {
    return { success: false, error: 'Empty image response' };
  }
  const magic = buffer.slice(0, 4);
  const isJpeg = magic[0] === 0xFF && magic[1] === 0xD8;
  const isPng  = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47;
  const isWebp = buffer.slice(0, 4).toString() === 'RIFF';
  if (!isJpeg && !isPng && !isWebp) {
    return { success: false, error: 'Response was not a valid image' };
  }
  return { success: true, buffer, prompt };
}

async function runYoutube(query) {
  const fs   = require('fs');
  const path = require('path');
  const { execFile } = require('child_process');

  const tmpDir = path.join(process.env.DATA_DIR || __dirname, '..', 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const outTemplate = path.join(tmpDir, `yt_${Date.now()}.%(ext)s`);
  const ytInput = query.startsWith('http') ? query : `ytsearch1:${query}`;

  return new Promise((resolve) => {
    execFile('yt-dlp', [
      '--no-playlist', '--extract-audio', '--audio-format', 'mp3',
      '--audio-quality', '128K', '--max-filesize', '25m',
      '--output', outTemplate, '--print', 'after_move:filepath', ytInput,
    ], { timeout: 90000 }, (err, stdout) => {
      if (err) return resolve({ success: false });
      const filePath = stdout.trim().split('\n').pop();
      if (!filePath || !fs.existsSync(filePath)) return resolve({ success: false });
      const title  = path.basename(filePath, '.mp3');
      const buffer = fs.readFileSync(filePath);
      try { fs.unlinkSync(filePath); } catch(e) {}
      resolve({ success: true, buffer, title });
    });
  });
}

async function runLyrics(query) {
  const token = process.env.GENIUS_TOKEN;
  if (!token) return { success: false };

  const data = await new Promise((resolve) => {
    const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}&access_token=${token}`;
    https.get(url, { headers: { 'User-Agent': 'Astra/1.0' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
    }).on('error', () => resolve(null));
  });

  const hit = data?.response?.hits?.[0]?.result;
  if (!hit) return { success: false };
  return { success: true, title: hit.full_title, artist: hit.primary_artist?.name, url: hit.url };
}

// ── Fallback lines per personality ────────────────────────────────────────────
const FALLBACKS = {
  hinata: 'I-I\'m sorry, I couldn\'t do that right now... please try again? 🥺',
  lunar:  'Fascinating — a temporary error! Science will prevail, try again!',
  aria:   'My apologies. A momentary disruption. Please repeat your request.',
  kira:   'A hiccup. Even perfect systems have imperfections.',
  zephyr: 'Yo my bad, something glitched. Hit me again.',
  nova:   'OH NO something broke?! PLUS ULTRA, try again!!',
  void:   '...',
  seraph: 'The signal fades... speak again, and I shall answer.',
  echo:   'Oh! Something went wrong. Isn\'t that interesting? Try again?',
  raven:  'How poetic. Even my words failed me. Again.',
  jinx:   'Oops hehe did I break something? Try again maybe? 👀',
};

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * Generate a response, routing through RPG or utility if intent detected.
 *
 * @param {string}   chatId
 * @param {string}   personalityKey
 * @param {string}   userMessage
 * @param {string}   senderName      — display name
 * @param {string}   sender          — full JID (for permission checks)
 * @param {object}   msg             — raw Baileys message (for mentions)
 * @param {Function} getDatabase
 * @param {Function} saveDatabase
 *
 * @returns {Promise<{
 *   text: string,
 *   attachment?: { type, buffer?, fileName?, title?, artist?, url? }
 * }>}
 */
async function generateResponse(
  chatId, personalityKey, userMessage, senderName = 'Hunter',
  sender = null, msg = null, getDatabase = null, saveDatabase = null
) {
  const displayName  = PersonalityManager.getDisplayName(personalityKey);
  const systemPrompt = PersonalityManager.getSystemPrompt(personalityKey);
  const history      = getHistory(chatId, personalityKey);

  // ── 1. RPG intent (highest priority — uses real DB data) ──────────────────
  if (sender && getDatabase) {
    const db = getDatabase();
    try {
      const rpgResult = await RPGIntentHandler.handleRPGIntent(
        userMessage, sender, msg, personalityKey, db, saveDatabase
      );
      if (rpgResult.handled) {
        // Wrap the RPG data in personality voice if it's a short fact
        // For long formatted blocks (profile, inventory etc.) send as-is
        let text = rpgResult.text;
        const isLongBlock = text.includes('━━━') || text.split('\n').length > 4;

        if (!isLongBlock && text.length < 200) {
          // Short fact — wrap in personality voice
          try {
            const wrappedPrompt = `You are ${displayName}. Deliver this information to the user in character in 1-2 sentences: "${text}". Stay completely in character.`;
            text = await callAI(wrappedPrompt, [], 0.85, 150);
          } catch(e) {
            // Keep original text if AI wrap fails
          }
        }

        addToHistory(chatId, personalityKey, 'user', `[${senderName}]: ${userMessage}`);
        addToHistory(chatId, personalityKey, 'assistant', text);
        return { text, attachment: rpgResult.attachment || null };
      }
    } catch(err) {
      console.error('❌ RPG intent error:', err.message);
    }
  }

  // ── 2. Utility intent (math, image, song, lyrics, search) ─────────────────
  const intent  = detectIntent(userMessage);
  const payload = extractPayload(userMessage, intent);

  // ── Utility intent ────────────────────────────────────────────────────────
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
        if (res.success && res.buffer) {
          text = await callAI(DELIVERY.image(displayName, payload), [], 0.85, 100);
          attachment = { type: 'image', buffer: res.buffer };
        } else {
          text = `🎨 I couldn't generate that image right now. (${res.error || 'service unavailable'})`;
        }

      } else if (intent === 'song') {
        const res = await runYoutube(payload);
        if (res.success) {
          text = await callAI(DELIVERY.song(displayName, res.title), [], 0.85, 100);
          attachment = { type: 'audio', buffer: res.buffer, fileName: `${res.title}.mp3` };
        } else {
          text = FALLBACKS[personalityKey];
        }

      } else if (intent === 'lyrics') {
        const res = await runLyrics(payload);
        if (res.success) {
          text = await callAI(DELIVERY.lyrics(displayName, res.title), [], 0.85, 100);
          attachment = { type: 'lyrics', title: res.title, artist: res.artist, url: res.url };
        } else {
          text = FALLBACKS[personalityKey];
        }

      } else if (intent === 'search') {
        const { result } = await runSearch(payload);
        text = await callAI(DELIVERY.search(displayName, result), [], 0.85, 200);
      }

      addToHistory(chatId, personalityKey, 'user', `[${senderName}]: ${userMessage}`);
      addToHistory(chatId, personalityKey, 'assistant', text);
      return { text, attachment };

    } catch (err) {
      console.error(`❌ Intent [${intent}] error:`, err.message);
      // Fall through to normal chat
    }
  }

  // ── Normal chat ───────────────────────────────────────────────────────────
  let reply = '';
  try {
    // Inject who is speaking so the bot consistently knows the master vs a
    // mod vs a player/guest (fixes unreliable "master recognition").
    const db = getDatabase ? getDatabase() : null;
    const chatPrompt = systemPrompt + (senderName && db ? buildRoleContext(sender, senderName, db) : '');
    // Pass the most recent MAX_HISTORY turns (plus the new one) for context.
    // Capping keeps the prompt within the model's token budget while still
    // giving the bot meaningful conversation recall.
    const recentHistory = history.slice(-MAX_HISTORY);
    reply = await callAI(chatPrompt, [
      ...recentHistory,
      { role: 'user', content: `[${senderName}]: ${userMessage}` },
    ]);
  } catch (err) {
    console.error('❌ AI chat error:', err.message);
    // Surface the real error briefly so the owner can diagnose (e.g. missing
    // GROQ_API_KEY, invalid model, rate limit). The in-character fallback is
    // appended so it still feels like a personality, not a crash.
    reply = (FALLBACKS[personalityKey] || 'Something went wrong.') +
      `\n\n_(debug: ${err.message})_`;
  }

  if (reply) {
    addToHistory(chatId, personalityKey, 'user', `[${senderName}]: ${userMessage}`);
    addToHistory(chatId, personalityKey, 'assistant', reply);
  }

  return { text: reply };
}

/**
 * All bots respond (/hi).
 */
async function generateAllResponses(chatId, userMessage, senderName = 'Hunter', sender = null, msg = null, getDatabase = null, saveDatabase = null) {
  // Summon EVERY connected bot in the group — active OR dormant — not just
  // those marked "present" (presentBots is in-memory and resets on restart,
  // which made /hi only summon the active bot). Fall back to present bots if
  // we cannot enumerate connected sockets.
  let keys = [];
  try {
    const MSM = require('./MultiSocketManager');
    keys = Object.keys(MSM.getAllSockets() || {});
  } catch (_) {}
  if (keys.length === 0) {
    const present = PersonalityManager.getPresentBots(chatId);
    if (present.length === 0) return [];
    keys = present;
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
