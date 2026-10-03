// starts.js — Push #96h-z10: /starts wakes the bot in a group.
//   Before /starts a group is DEAD SILENT (no replies to anyone but an Owner).
//   After it: Owner commands work here; `/setgc <type> [--main]` sets the type
//   (--main = open to everyone, never expires); without --main the group stays
//   silent to non-owners until `/ssub` opens its 30-day run.
'use strict';
const AstralGroups = require('../../rpg/utils/AstralGroups');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'starts',
  aliases: ['startgc', 'wake'],
  description: '🔌 [Owner] Wake the bot in this group (then /setgc, then /ssub)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return; // dead silent for everyone else
    if (!String(chatId).endsWith('@g.us')) return sock.sendMessage(chatId, { text: '❌ Run */starts* inside the group you want to wake.' }, { quoted: msg });
    const r = AstralGroups.start(db, chatId, sender);
    saveDatabase();
    const e = AstralGroups.getEntry(db, chatId);
    const next = !e
      ? `2️⃣ */setgc <type>* — set the group type (*/setgc <type> --main* = open to everyone, never expires)\n3️⃣ */ssub | <subscriber>* — open the 30-day run (non-main groups stay silent to players until then)`
      : e.isMain ? `👑 This is a *--main* group — open to everyone, never expires.`
      : e.expiresAt ? `💳 Subscription active — ${AstralGroups.daysLeft(db, chatId)} day(s) left (*/renew* to extend).`
      : `3️⃣ */ssub | <subscriber>* — open the 30-day run (players stay silent-gated until then).`;
    return sock.sendMessage(chatId, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔌 *BOT ${r.already ? 'ALREADY AWAKE' : 'AWAKENED'} IN THIS GROUP*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n1️⃣ /starts ✅\n${next}\n\n_Until the group is --main or subscribed, only Owners get replies here._` }, { quoted: msg });
  },
};
