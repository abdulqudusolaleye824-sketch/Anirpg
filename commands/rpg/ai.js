'use strict';

// ── /ai <question> — Ask the AI (Groq) anything ────────────────────────────
// Uses the same Groq provider as the personalities. If TAVILY_API_KEY is set,
// it first does a live web search for up-to-date answers, then has the AI
// summarise. Requires GROQ_API_KEY in .env.

const https = require('https');
const UI = require('../../rpg/utils/UI');

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
          catch (e) { reject(new Error(`JSON parse failed: ${chunks.slice(0, 200)}`)); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`${hostname} request timed out`)));
    req.write(data);
    req.end();
  });
}

async function tavilySearch(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  try {
    const body = JSON.stringify({ api_key: key, query, search_depth: 'basic', max_results: 4, include_answer: true });
    const res = await httpPost('api.tavily.com', '/search', { 'Content-Type': 'application/json' }, body);
    return res.answer || (res.results || []).map(r => r.content).slice(0, 4).join('\n') || null;
  } catch (e) {
    console.error('❌ /ai Tavily search failed:', e.message);
    return null;
  }
}

module.exports = {
  name: 'ai',
  aliases: ['ask', 'gpt', 'chat'],
  description: 'Ask the AI anything. Uses your Groq key (and live web search if enabled).',
  usage: '/ai <question>',
  category: 'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const proA = UI.isPro(getDatabase().users[sender]);
    const question = (args || []).join(' ').trim();

    if (!question) {
      return sock.sendMessage(chatId, {
        text: [
          (proA ? UI.PRO_BAR : UI.FREE_BAR),
          '🤖 *ASK THE AI*',
          proA ? (UI.PRO_MINI + '\n' + '🤖 PRO ORACLE') : null,
          proA ? `🌐 Live web search: *${process.env.TAVILY_API_KEY ? 'ON (Tavily)' : 'OFF'}* · 🧠 Provider: *${(process.env.AI_PROVIDER || 'groq').toLowerCase()}*` : null,
          proA ? '' : null,
          '📌 Usage: /ai <question>',
          '',
          'Example:',
          '/ai what is the capital of France?',
          '/ai summarise the plot of Naruto Shippuden',
          (proA ? UI.PRO_BAR : UI.FREE_BAR),
        ].filter(x => x !== null).join('\n'),
      }, { quoted: msg });
    }

    const provider = (process.env.AI_PROVIDER || 'groq').toLowerCase();
    let apiKey = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GROQ_API_KEY;
    if (!apiKey) {
      return sock.sendMessage(chatId, {
        text: '❌ No AI key configured.\n\nSet one in your .env:\n  AI_PROVIDER=groq\n  GROQ_API_KEY=gsk_...\n\n(Or use OPENAI_API_KEY with AI_PROVIDER=openai)',
      }, { quoted: msg });
    }

    await sock.sendMessage(chatId, { text: '🤔 *Thinking...*' }, { quoted: msg });

    try {
      // Live web search when Tavily is configured — gives up-to-date answers.
      let searchContext = '';
      try {
        const web = await tavilySearch(question);
        if (web) searchContext = `\n\nSearch results (use these as the ONLY factual source):\n${web}`;
      } catch (e) { /* non-fatal */ }

      let answer;
      if (provider === 'openai') {
        const res = await httpPost('api.openai.com', '/v1/chat/completions',
          { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          { model: 'gpt-4o-mini', messages: [
            { role: 'system', content: 'You are a helpful assistant. Answer concisely in 3-5 sentences. Plain text, no markdown headers.' + searchContext },
            { role: 'user', content: question },
          ], max_tokens: 500, temperature: 0.5 });
        if (res.error) throw new Error(res.error.message);
        answer = res.choices?.[0]?.message?.content?.trim() || '';
      } else {
        const res = await httpPost('api.groq.com', '/openai/v1/chat/completions',
          { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          { model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b', messages: [
            { role: 'system', content: 'You are a helpful assistant. Answer concisely in 3-5 sentences. Plain text, no markdown headers.' + searchContext },
            { role: 'user', content: question },
          ], max_tokens: 500, temperature: 0.5 });
        if (res.error) throw new Error(res.error.message);
        answer = res.choices?.[0]?.message?.content?.trim() || '';
      }

      if (!answer) answer = 'I could not answer that.';
      return sock.sendMessage(chatId, { text: `🤖 *AI:*\n${answer}` }, { quoted: msg });
    } catch (err) {
      console.error('❌ /ai error:', err.message);
      return sock.sendMessage(chatId, {
        text: `❌ AI failed to respond.\n\n_(debug: ${err.message})_\n\n💡 Common cause: invalid/expired GROQ_API_KEY, or the model is unavailable on your plan.`,
      }, { quoted: msg });
    }
  },
};
