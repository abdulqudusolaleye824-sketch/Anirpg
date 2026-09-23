// /birthday — Push #87: birthday system controls.
//   /birthday            → your registered D.O.B. + whether the gift has been sent this year
//   /birthday list       → (owner/mod) every player's birthday + age, soonest first → mods GC only
//   /birthday run        → (owner/mod) force a birthday pass now
//   /birthday test       → (owner/mod) send YOURSELF the greeting flow (no pro gift unless it's your day)
'use strict';
const B = require('../../rpg/utils/BirthdayManager');

module.exports = {
  name: 'birthday',
  aliases: ['bday'],
  description: '🎂 Birthday gift status (owner: run/test)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const p = db.users?.[sender];
    if (!p) return sock.sendMessage(chatId, { text: '❌ Register first.' }, { quoted: msg });
    const sub = (args[0] || '').toLowerCase();
    let staff = false;
    try { const P = require('../../utils/permissions'); staff = P.isBotOwner(db, sender) || P.isBotMod(db, sender); } catch (e) {}

    // /birthday list — MODS ONLY. Never shown in public: delivered to the mods
    // GC (or the invoking DM). Soonest birthday first, with the age they turn.
    if (sub === 'list') {
      if (!staff) return sock.sendMessage(chatId, { text: '❌ Mods only.' }, { quoted: msg });
      const rows = B.upcomingList(db);
      const lines = rows.map((r, i) => `${i + 1}. ${r.daysUntil === 0 ? '🎂' : '•'} *${r.name}* — ${r.dob} · turning *${r.age}* · ${r.daysUntil === 0 ? '*TODAY*' : r.daysUntil === 1 ? 'tomorrow' : `in ${r.daysUntil}d`}`);
      const text = `🎂 *BIRTHDAY LIST* (${rows.length} hunters, soonest first)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` + (lines.length ? lines.join('\n') : '_No registered birthdays._') + `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔒 Staff only — never share publicly.`;
      let modsGc = null;
      try { const AG = require('../../rpg/utils/AstralGroups'); const m = AG.getAll(db).find(g => g && g.type === 'mods' && g.isMain) || AG.primaryOf(db, 'mods'); modsGc = m && m.groupId; } catch (e) {}
      const isDM = !chatId.endsWith('@g.us');
      const dest = isDM ? chatId : (modsGc || null);
      if (!dest) return sock.sendMessage(chatId, { text: '🔒 No mods GC set (`/setgc mods`). Use /birthday list in my DM instead.' }, { quoted: msg });
      try {
        let dsock = sock;
        if (dest !== chatId) { try { const MSM = require('../../bots/MultiSocketManager'); dsock = MSM.getAnySocket() || sock; } catch (e) {} }
        await dsock.sendMessage(dest, { text });
      } catch (e) { return sock.sendMessage(chatId, { text: '❌ Could not deliver the list to the mods GC.' }, { quoted: msg }); }
      if (dest !== chatId) return sock.sendMessage(chatId, { text: '📨 Birthday list sent to the mods GC.' }, { quoted: msg });
      return;
    }
    if (sub === 'run' && staff) {
      const r = await B.runOnce(db, saveDatabase);
      return sock.sendMessage(chatId, { text: r.length ? `🎂 Greeted ${r.length}:\n` + r.map(x => `• ${x.name} — ${x.via}${x.announced ? ' + announced' : ''}`).join('\n') : '🎂 No birthdays pending right now.' }, { quoted: msg });
    }
    if (sub === 'test' && staff) {
      const d = await B._deliver(db, sender, B.greetingText(p, B.ageTurning(p), true));
      const a = await B._announce(db, sender, B.announcementText(p, B.ageTurning(p)));
      return sock.sendMessage(chatId, { text: `🧪 Test sent — greeting via *${d.via}*, announcement ${a ? 'posted' : 'skipped (no /setspace GC or send failed)'}.` }, { quoted: msg });
    }
    const dob = p.dateOfBirth || '—';
    const year = new Date(Date.now() + 3600000).getUTCFullYear();
    const today = B.isBirthdayToday(p);
    return sock.sendMessage(chatId, {
      text: [`🎂 *BIRTHDAY*`, ``, `📅 D.O.B: *${dob}*`, today ? `🎉 It's your birthday today!` : ``, `🎁 Gift this year: ${p.lastBirthdayGreetYear === year ? '✅ delivered' : '⏳ on your birthday — 24h PRO + a message from Astra'}`].filter(Boolean).join('\n'),
    }, { quoted: msg });
  },
};
