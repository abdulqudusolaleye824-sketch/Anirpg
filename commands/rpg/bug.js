module.exports = {
  name: 'bug',
  description: '🐞 Report a bug',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const config = require('../../config.json');
    const C = require('../../utils/constants');
    // Push #88t: reports go to BOTH the owner and the co-owner (phone JID —
    // DMs to a @lid identity are not deliverable). Deduped by bare number.
    const targets = [];
    const seen = new Set();
    for (const j of [config.ownerNumber, C.OWNER_JID, C.COOWNER_PHONE]) {
      if (!j) continue;
      const b = String(j).split('@')[0].split(':')[0];
      if (seen.has(b)) continue;
      seen.add(b);
      targets.push(String(j).includes('@') ? j : `${j}@s.whatsapp.net`);
    }

    if (!args.length) {
      await sock.sendMessage(chatId, {
        text: '❌ Please describe the bug.\nExample:\n/bug Dungeon crashes on skill use'
      }, { quoted: msg });
      return;
    }

    const report = args.join(' ');
    let who = sender.split('@')[0];
    try { const u = getDatabase().users?.[sender]; if (u?.name) who = `${u.name} (${who})`; } catch (e) {}
    let groupName = chatId;
    try { if (String(chatId).endsWith('@g.us')) groupName = (await sock.groupMetadata(chatId))?.subject || chatId; } catch (e) {}

    await sock.sendMessage(chatId, {
      text: '✅ Bug report sent to the developers. Thank you!'
    }, { quoted: msg });

    const text = `━━━━━━━━━━━━━━━━━━━━━━━\n🐞 BUG REPORT\n━━━━━━━━━━━━━━━━━━━━━━━\n👤 User: ${who}\n📍 Group: ${groupName}\n📝 Bug:\n${report}\n━━━━━━━━━━━━━━━━━━━━━━━`;
    for (const t of targets) {
      try { await sock.sendMessage(t, { text }); } catch (e) { console.warn(`[BUG] could not DM ${t}: ${e.message}`); }
    }

    console.log(`[BUG] Report from ${sender}: ${report}`);
  }
};
