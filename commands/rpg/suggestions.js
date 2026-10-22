// Push #103k: /suggestions — owner, DM only. Re-sends every PENDING suggestion card (with its buttons).
'use strict';
const Perms = require('../../utils/permissions');
module.exports = {
  name: 'suggestions', aliases: ['pendingsuggestions'],
  description: '👑 [owner] Re-send every pending suggestion with its buttons (DM only)',
  category: 'admin', usage: '/suggestions', where: 'DM (owner)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Owner-only command.' }, { quoted: msg });
    if (String(chatId).endsWith('@g.us')) return sock.sendMessage(chatId, { text: '🔐 Use */suggestions* in my DM.' }, { quoted: msg });
    const ST = require('../../rpg/utils/SuggestionTracker');
    const pending = ST.pendingList(db);
    if (!pending.length) return sock.sendMessage(chatId, { text: '💡 No pending suggestions — everything has been handled.' }, { quoted: msg });
    await sock.sendMessage(chatId, { text: `💡 *${pending.length} pending suggestion${pending.length === 1 ? '' : 's'}* — re-sending each with its buttons:` }, { quoted: msg });
    for (const rec of pending) { await ST.sendCard(sock, chatId, rec); await new Promise(r => setTimeout(r, 400)); }
  },
};
