// Push #96h-z25: interactive bug reports — see rpg/utils/BugTracker.js
module.exports = {
  name: 'bug',
  description: '🐞 Report a bug',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const BT = require('../../rpg/utils/BugTracker');
    const Perms = require('../../utils/permissions');
    const sub = String(args[0] || '').toLowerCase();

    // ── Owner: /bug list ─────────────────────────────────────────
    if (sub === 'list') {
      if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Only bot owners can view the bug list.' }, { quoted: msg });
      return sock.sendMessage(chatId, { text: BT.listText(db) }, { quoted: msg });
    }

    // ── Owner: /bug log|dismiss|ban <id>  (the DM buttons send these) ──
    if (['log', 'dismiss', 'ban'].includes(sub)) {
      if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Only bot owners can handle bug reports.' }, { quoted: msg });
      const r = BT.decide(db, args[1], sub, sender);
      saveDatabase();
      if (r.ok) { try { await BT.notifyReporter(sock, db, r.rec); } catch (e) {} }
      return sock.sendMessage(chatId, { text: r.text }, { quoted: msg });
    }

    if (!args.length) {
      return sock.sendMessage(chatId, { text: '❌ Please describe the bug.\nExample:\n/bug Dungeon crashes on skill use' }, { quoted: msg });
    }

    // ── Player report ───────────────────────────────────────────
    const report = args.join(' ');
    let who = sender.split('@')[0];
    try { const u = db.users?.[sender]; if (u?.name) who = u.name; } catch (e) {}
    let groupName = chatId;
    try { if (String(chatId).endsWith('@g.us')) groupName = (await sock.groupMetadata(chatId))?.subject || chatId; } catch (e) {}

    const rec = BT.create(db, { reporter: sender, reporterName: who, chatId, groupName, text: report });
    saveDatabase();

    await sock.sendMessage(chatId, { text: `✅ Bug report *${rec.id}* sent to the developers (${BT.stamp(rec.at)}). You'll get feedback once it's reviewed. Thank you!` }, { quoted: msg });

    // Owners' DMs (phone JIDs; deduped by bare number) — card + buttons.
    const targets = []; const seen = new Set();
    for (const j of Perms.getBotOwners(db)) {
      const b = String(j).split('@')[0].split(':')[0];
      if (!b || seen.has(b)) continue; seen.add(b);
      targets.push(String(j).includes('@') ? j : `${j}@s.whatsapp.net`);
    }
    const card = BT.ownerCard(rec);
    for (const t of targets) {
      let sent = false;
      try {
        const B = require('../../utils/buttons');
        if (B && B.sendButtons) { await B.sendButtons(sock, t, { text: card, buttons: B.quickReplies(BT.ownerButtons(rec)) }); sent = true; }
      } catch (e) { sent = false; }
      if (!sent) {
        try { await sock.sendMessage(t, { text: `${card}\n\n/bug log ${rec.id}\n/bug dismiss ${rec.id}\n/bug ban ${rec.id}` }); } catch (e) { console.warn(`[BUG] could not DM ${t}: ${e.message}`); }
      }
    }
    console.log(`[BUG] ${rec.id} from ${sender}: ${report}`);
  }
};
