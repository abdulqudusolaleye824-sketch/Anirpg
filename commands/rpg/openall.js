// Push #96h-z29: /openall — owner-only, usable from DM. Lifts the /closeall lock and opens every group.
'use strict';
const Perms = require('../../utils/permissions');
const { setAll, bare, stamp } = require('../../rpg/utils/GroupLock');
const openall = {
  name: 'openall', description: '👑 [owner] Lift the /closeall lock and open every group', category: 'admin', usage: '/openall', where: 'DM or group',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Owner-only command.' }, { quoted: msg });
    const who = (db.users[sender] && db.users[sender].name) || bare(sender);
    await sock.sendMessage(chatId, { text: '🔓 Opening every group… this takes a moment.' }, { quoted: msg });
    const notice = `🔓 *GROUP OPENED*\nEveryone can send messages now.\n👑 Opened by @${bare(sender)} (${who}) · ${stamp()}`;
    const r = await setAll('open', sender, db, saveDatabase, notice);
    db.lockedGroups = {}; try { saveDatabase(); } catch (e) {}
    return sock.sendMessage(chatId, { text: `🔓 *OPEN ALL* — ${r.done.length}/${r.total} groups opened, locks lifted.${r.failed.length ? `\n⚠️ Could not open (bot not admin?): ${r.failed.join(', ')}` : ''}` }, { quoted: msg });
  },
};
module.exports = openall;
