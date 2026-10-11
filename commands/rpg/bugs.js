// Push #96h-z30: /bugs — owner, DM only. Re-sends every PENDING bug report card (with its buttons) so an
// owner who missed / lost the DM can still Log / Dismiss / Ban it.
'use strict';
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'bugs', aliases: ['pendingbugs'],
  description: '👑 [owner] Re-send every pending bug report with its buttons (DM only)',
  category: 'admin', usage: '/bugs', where: 'DM (owner)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Owner-only command.' }, { quoted: msg });
    if (String(chatId).endsWith('@g.us')) return sock.sendMessage(chatId, { text: '🔐 Use */bugs* in my DM.' }, { quoted: msg });
    const BT = require('../../rpg/utils/BugTracker');
    const pending = Object.values(BT.table(db)).filter(r => r.status === BT.STATUS.PENDING).sort((a, b) => a.at - b.at);
    if (!pending.length) return sock.sendMessage(chatId, { text: '🐞 No pending bug reports — everything has been handled.' }, { quoted: msg });
    await sock.sendMessage(chatId, { text: `🐞 *${pending.length} pending bug report${pending.length === 1 ? '' : 's'}* — re-sending each with its buttons:` }, { quoted: msg });
    let B = null; try { B = require('../../utils/buttons'); } catch (e) {}
    for (const rec of pending) {
      const card = BT.ownerCard(rec); let sent = false;
      try { if (B && B.sendButtons) { await B.sendButtons(sock, chatId, { text: card, buttons: B.quickReplies(BT.ownerButtons(rec)) }); sent = true; } } catch (e) { sent = false; }
      if (!sent) { try { await sock.sendMessage(chatId, { text: `${card}\n\n/bug log ${rec.id}\n/bug dismiss ${rec.id}\n/bug ban ${rec.id}` }); } catch (e) {} }
      await new Promise(r => setTimeout(r, 400));
    }
  },
};
