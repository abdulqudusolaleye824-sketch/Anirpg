// Push #96h-z29: /closeall — owner-only, usable from DM. Closes + LOCKS every group the bots are in.
'use strict';
const Perms = require('../../utils/permissions');
const { setAll, bare, stamp } = require('../../rpg/utils/GroupLock');
const closeall = {
  name: 'closeall', description: '👑 [owner] Close every group the bots are in (admin-only chat) and lock them', category: 'admin', usage: '/closeall', where: 'DM or group',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Owner-only command.' }, { quoted: msg });
    const who = (db.users[sender] && db.users[sender].name) || bare(sender);
    await sock.sendMessage(chatId, { text: '🔒 Closing every group… this takes a moment.' }, { quoted: msg });
    const notice = `🔒 *GROUP CLOSED*\nOnly admins can send messages now.\n👑 Closed by @${bare(sender)} (${who}) · ${stamp()}`;
    const r = await setAll('close', sender, db, saveDatabase, notice);
    return sock.sendMessage(chatId, { text: `🔒 *CLOSE ALL* — ${r.done.length}/${r.total} groups closed & locked.${r.failed.length ? `\n⚠️ Could not close (bot not admin?): ${r.failed.join(', ')}` : ''}\n\n/open is refused in locked groups; /openall lifts the lock.` }, { quoted: msg });
  },
};
module.exports = closeall;
