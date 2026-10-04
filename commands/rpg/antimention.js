// Push #96h-z18: /antimention — kick non-admins who mention this group in their status (ON by default).
const Perms = require('../../utils/permissions');
const UI = require('../../rpg/utils/UI');
module.exports = {
  name: 'antimention',
  aliases: ['antistatusmention', 'nostatusmention'],
  description: '📵 Anti status-mention for this group (on by default)',
  usage: '/antimention [on|off]',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    if (!Perms.isBotMod(db, sender)) return sock.sendMessage(chatId, { text: '❌ Admins only.' }, { quoted: msg });
    if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: '❌ Run this inside a group.' }, { quoted: msg });
    const GMod = require('../../rpg/utils/GroupModeration'); const gs = GMod.settings(db, chatId);
    const sub = (args[0] || '').toLowerCase(); const pro = UI.isPro(db.users[sender]); const bar = pro ? UI.PRO_BAR : UI.FREE_BAR;
    if (sub === 'on') { gs.antiMentionOff = false; saveDatabase(); return sock.sendMessage(chatId, { text: '✅ Anti-mention enabled — non-admins who mention this group in their status get kicked.' }, { quoted: msg }); }
    if (sub === 'off') { gs.antiMentionOff = true; saveDatabase(); return sock.sendMessage(chatId, { text: '🔕 Anti-mention disabled for this group.' }, { quoted: msg }); }
    return sock.sendMessage(chatId, { text: [bar, `📵 *ANTI-MENTION*`, `Status: *${GMod.antiMentionOn(db, chatId) ? 'ON ⛔ (default)' : 'OFF'}*`, ``, `Non-admins who mention this group in their WhatsApp status are kicked.`, `📌 /antimention on|off`, bar].join('\n') }, { quoted: msg });
  },
};
