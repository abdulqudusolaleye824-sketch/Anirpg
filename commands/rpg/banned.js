/**
 * /banned — List every banned user (mods + owners only).
 * Lists each banned user and TAGS (@mention) them in the message.
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');
const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'banned',
  description: '🚫 List all banned users',
  aliases: ['banlist', 'bannedlist'],

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const proB = UI.isPro(db.users[sender]);

    if (!Mod.canModerate(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ *Mods / Owners only.*\n\nYou need mod permissions to view banned users.',
      }, { quoted: msg });
    }

    if (!db.bannedUsers) db.bannedUsers = {};

    // Push #96h-z21: one line per hunter — old builds stored both the bare number and the full jid.
    const _seenBare = new Set();
    const entries = Object.entries(db.bannedUsers).filter(([k]) => { const b = String(k).split('@')[0].split(':')[0]; if (_seenBare.has(b)) return false; _seenBare.add(b); return true; }); // [key, rec]
    if (entries.length === 0) {
      return sock.sendMessage(chatId, {
        text: [
          (proB ? UI.PRO_BAR : UI.FREE_BAR),
          '✅ *No banned users.*',
          (proB ? UI.PRO_BAR : UI.FREE_BAR),
        ].join('\n'),
      }, { quoted: msg });
    }

    const lines = [(proB ? UI.PRO_BAR : UI.FREE_BAR), '🚫 *BANNED USERS* 🚫', `Total: ${entries.length}`,
      ...(proB ? [(UI.PRO_MINI + '\n🚫 PRO GAVEL'), `📊 *${entries.length}* banned users on record`, ''] : [])];
    const mentions = [];

    // Push #96h-z21: clean formatting — real @mentions (phone or lid), names instead of raw ids, GC NAME only
    // (no group id), banner shown by name.
    const _jidOf = (k) => { const b = String(k || '').split('@')[0].split(':')[0]; if (!b) return null; if (String(k).includes('@lid') || b.length >= 15) return `${b}@lid`; return `${b}@s.whatsapp.net`; };
    const _nameOf = (k) => { const u = Mod.getUser(db, k); return (u && u.name) ? u.name : null; };
    entries.forEach(([key, rec], i) => {
      const bare = String(key).split('@')[0].split(':')[0];
      const jid = _jidOf(rec.jid || key);
      const n = _nameOf(key) || rec.name || 'Unknown hunter';
      const byName = rec.bannedByName || _nameOf(rec.bannedBy) || null;
      const byJid = rec.bannedBy ? _jidOf(rec.bannedBy) : null;
      const gcInfo = rec.gcName || 'Unknown GC';
      const gmt = rec.bannedAtGMT || (rec.bannedAt ? new Date(rec.bannedAt).toUTCString() : '?');
      lines.push(`${i + 1}. *${n}* — @${bare}`);
      lines.push(`   👮 Banned by: ${byName ? `*${byName}*` : (byJid ? '@' + byJid.split('@')[0] : 'Unknown')}`);
      lines.push(`   📝 Reason: ${rec.reason || 'No reason'}`);
      lines.push(`   📍 GC: ${gcInfo}`);
      lines.push(`   🕒 Time (GMT): ${gmt}`);
      lines.push('');
      if (jid) mentions.push(jid);
      if (!byName && byJid) mentions.push(byJid);
    });

    lines.push('Use /unban [user] to unban someone.');
    lines.push((proB ? UI.PRO_BAR : UI.FREE_BAR));

    await sock.sendMessage(chatId, {
      text: lines.join('\n'),
      mentions,
    }, { quoted: msg });
  },
};
