// Push #102f: /ba — Owner grants (or revokes) bank-creation access. Bank creation is paid outside the bot ($20).
'use strict';
const Perms = require('../../utils/permissions');
const BA = require('../../rpg/utils/BankAccess');
const T = require('../../utils/target');
module.exports = {
  name: 'ba', aliases: ['bankaccess'],
  description: '👑 Owner: allow a hunter to create a bank ($20, paid outside the bot) — /ba @user · /ba remove @user · /ba list',
  usage: '/ba @user | reply · /ba remove @user · /ba list', ownerOnly: true,
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Owner only.' }, { quoted: msg });
    const sub = String(args[0] || '').toLowerCase();
    if (sub === 'list') {
      const L = BA.list(db);
      return sock.sendMessage(chatId, { text: L.length ? `🏦 *BANK ACCESS* (${L.length})\n\n` + L.map(r => `• +${r.bare} — granted ${new Date(r.at).toISOString().slice(0, 10)}`).join('\n') : '📭 Nobody has bank-creation access yet.' }, { quoted: msg });
    }
    const removing = ['remove', 'revoke', 'del', 'delete', 'off'].includes(sub);
    const target = T.resolve(msg, removing ? args.slice(1) : args);
    if (!target) return sock.sendMessage(chatId, { text: '❓ Tag the hunter or reply to their message.\n\n/ba @user — allow bank creation ($20)\n/ba remove @user — take it back\n/ba list' }, { quoted: msg });
    const name = (() => { try { const u = db.users[target] || Object.values(db.users || {}).find(u => BA.bare(u.jid || u.id) === BA.bare(target)); return u && u.name; } catch (e) { return null; } })() || `+${BA.bare(target)}`;
    if (removing) {
      const r = BA.revoke(db, target); saveDatabase();
      return sock.sendMessage(chatId, { text: r.ok ? `🏦 Bank-creation access removed from *${name}*.` : `ℹ️ *${name}* had no bank-creation access.`, mentions: [target] }, { quoted: msg });
    }
    const r = BA.grant(db, target, sender); if (!r.ok) return sock.sendMessage(chatId, { text: r.text }, { quoted: msg });
    saveDatabase();
    return sock.sendMessage(chatId, { text: `🏦 *BANK ACCESS GRANTED* — *${name}* can now open a bank.\n\n📌 Next step for them: */bank create <name>*`, mentions: [target] }, { quoted: msg });
  },
};
