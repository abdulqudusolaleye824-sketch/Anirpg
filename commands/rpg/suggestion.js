// Push #103k: owner side of suggestions (the DM buttons send these).
//   /suggestion approve|reject|ban <id>   · /suggestion reply <id> [text]   · /suggestion list   · /suggestion delete <id|all>
'use strict';
const Perms = require('../../utils/permissions');
module.exports = {
  name: 'suggestion', aliases: ['sug'],
  description: '👑 [owner] Handle suggestions: approve / reject / ban / reply / list / delete',
  category: 'admin', usage: '/suggestion list', where: 'DM (owner)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    const ST = require('../../rpg/utils/SuggestionTracker');
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Owner-only command. Players: */suggest <idea>*.' }, { quoted: msg });
    const sub = String(args[0] || '').toLowerCase();
    if (!sub || sub === 'list' || sub === 'approved') return sock.sendMessage(chatId, { text: ST.listText(db) }, { quoted: msg });
    if (sub === 'pending') { const p = ST.pendingList(db); return sock.sendMessage(chatId, { text: p.length ? [`💡 *PENDING SUGGESTIONS* (${p.length})`, ...p.map(r => `• *${r.id}* — ${r.text.slice(0, 100)} _(${r.reporterName})_`), ``, `*/suggestions* in my DM re-sends each with buttons.`].join('\n') : '💡 No pending suggestions.' }, { quoted: msg }); }
    if (sub === 'delete' || sub === 'del' || sub === 'remove') { const r = ST.remove(db, args[1], sender); if (r.ok) saveDatabase(); return sock.sendMessage(chatId, { text: r.text }, { quoted: msg }); }
    if (['approve', 'reject', 'ban'].includes(sub)) {
      const r = ST.decide(db, args[1], sub, sender); saveDatabase();
      if (r.ok) { try { await ST.notifyReporter(sock, db, r.rec); } catch (e) {} }
      return sock.sendMessage(chatId, { text: r.text }, { quoted: msg });
    }
    if (sub === 'reply' || sub === 'answer') {
      const id = args[1]; const text = args.slice(2).join(' ').trim();
      if (text) { const r = await ST.sendReply(sock, db, sender, id, text); saveDatabase(); return sock.sendMessage(chatId, { text: r.text }, { quoted: msg }); }
      const r = ST.armReply(db, sender, id); saveDatabase();
      return sock.sendMessage(chatId, { text: r.text }, { quoted: msg });
    }
    return sock.sendMessage(chatId, { text: `💡 */suggestion list* (approved) · */suggestion pending* · */suggestion approve|reject|ban <id>* · */suggestion reply <id> [text]* · */suggestion delete <id|all>*` }, { quoted: msg });
  },
};
