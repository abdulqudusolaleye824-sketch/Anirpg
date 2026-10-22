// Push #103k: /suggest works like /bug — owners get a DM card with Approve / Reject / Ban + Reply buttons.
module.exports = {
  name: 'suggest',
  description: '💡 Suggest a feature',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    if (!chatId) return;
    const db = getDatabase();
    const ST = require('../../rpg/utils/SuggestionTracker');

    if (!args.length) {
      return sock.sendMessage(chatId, { text: '❌ Please write your suggestion.\nExample:\n/suggest Add guild wars' }, { quoted: msg });
    }
    const text = args.join(' ').trim();
    let who = String(sender || '').split('@')[0];
    try { const u = db.users?.[sender]; if (u?.name) who = u.name; } catch (e) {}
    let groupName = chatId;
    try { if (String(chatId).endsWith('@g.us')) groupName = (await sock.groupMetadata(chatId))?.subject || chatId; } catch (e) {}

    const rec = ST.create(db, { reporter: sender, reporterName: who, chatId, groupName, text });
    saveDatabase();

    await sock.sendMessage(chatId, { text: `💡 Suggestion *${rec.id}* sent to the developers (${ST.stamp(rec.at)}). You'll be told once it's reviewed — thank you!` }, { quoted: msg });

    for (const t of ST.ownerTargets(db)) { try { await ST.sendCard(sock, t, rec); } catch (e) { console.warn(`[SUGGEST] could not DM ${t}: ${e.message}`); } }
    console.log(`[SUGGEST] ${rec.id} from ${sender}: ${text}`);
  }
};
