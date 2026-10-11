// Push #96h-z29: /dbdump — owner-only, DM. Sends the CURRENT full database to the requesting owner's DM as a
// JSON file. Does NOT touch the 3-day offline backup timer or the daily snapshot timer.
'use strict';
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'dbdump', aliases: ['dumpdb', 'dbsnapshot'],
  description: '👑 [owner] DM me the current full database (JSON) — does not reset the 3-day backup',
  category: 'admin', usage: '/dbdump', where: 'DM (owner)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Owner-only command.' }, { quoted: msg });
    if (String(chatId).endsWith('@g.us')) return sock.sendMessage(chatId, { text: '🔐 Use */dbdump* in my DM — the database is never posted in a group.' }, { quoted: msg });
    try { saveDatabase(); } catch (e) {}
    const json = JSON.stringify(db, null, 1);
    const buf = Buffer.from(json, 'utf8');
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
    const players = Object.keys(db.users || {}).length;
    const caption = `💾 *FULL DATABASE DUMP — ${stamp} UTC*\n👥 ${players} players · 📦 ${Math.round(buf.length / 1024)} KB\nRestore: /api/restore (password-gated) or drop it in as database.json. The 3-day backup timer was NOT reset.`;
    try {
      await sock.sendMessage(chatId, { document: buf, fileName: `anirpg-db-${stamp}.json`, mimetype: 'application/json', caption });
    } catch (e) {
      try { await sock.sendMessage(chatId, { document: buf, fileName: `anirpg-db-${stamp}.txt`, mimetype: 'text/plain', caption }); } catch (e2) { return sock.sendMessage(chatId, { text: `❌ Could not send the file: ${e2.message}` }, { quoted: msg }); }
    }
  },
};
