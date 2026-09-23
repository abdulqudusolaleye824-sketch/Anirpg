// /birthday — Push #87: birthday system controls.
//   /birthday            → your registered D.O.B. + whether the gift has been sent this year
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
