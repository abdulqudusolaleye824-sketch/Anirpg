// /unsilence — OWNER/CO-OWNER ONLY. Lifts a /silence.
'use strict';
const Perms = require('../../utils/permissions');
const UI = require('../../rpg/utils/UI');
function bare(j) { return String(j || '').split('@')[0].split(':')[0]; }

module.exports = {
  name: 'unsilence',
  description: '🔊 Owner: lift a mod silence',
  category: 'admin',
  usage: '/unsilence @mod',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const FRAME = UI.FREE_BAR;
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: `❌ *OWNER ONLY.*\n${FRAME}\n/unsilence is an owner / co-owner command.` }, { quoted: msg });
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    let jid = ctx?.mentionedJid?.[0] || ctx?.participant || null;
    if (!jid && args[0]) { const d = args[0].replace(/\D/g, ''); if (d.length >= 8) jid = `${d}@s.whatsapp.net`; else { const q = args.join(' ').toLowerCase(); for (const [k, u] of Object.entries(db.users || {})) if (u?.name && String(u.name).toLowerCase() === q) { jid = k; break; } } }
    if (!jid) return sock.sendMessage(chatId, { text: `❌ Tag/reply to the mod.\nUsage: /unsilence @mod` }, { quoted: msg });
    const rec = db.silencedMods?.[bare(jid)];
    if (!rec) return sock.sendMessage(chatId, { text: `ℹ️ @${bare(jid)} is not silenced.`, mentions: [jid] }, { quoted: msg });
    delete db.silencedMods[bare(jid)];
    saveDatabase();
    const name = db.users?.[jid]?.name || `@${bare(jid)}`;
    return sock.sendMessage(chatId, { text: [FRAME, `🔊 *SILENCE LIFTED*`, FRAME, `👤 Mod: *${name}* (@${bare(jid)})`, `👑 By: @${bare(sender)}`, FRAME, `_Full command access restored._`].join('\n'), mentions: [jid, sender] }, { quoted: msg });
  },
};
