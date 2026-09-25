// ═══════════════════════════════════════════════════════════════
// /silence — OWNER/CO-OWNER ONLY. Silences a MOD from regular commands:
// while silenced they can only use moderation commands.
//
//   /silence @mod                 → indefinite, no reason
//   /silence @mod 30              → 30 minutes
//   /silence @mod 30|not active   → 30 minutes, reason "not active"
//   /silence @mod |lazy           → indefinite, reason "lazy"
//   /unsilence @mod               → lift it
// ═══════════════════════════════════════════════════════════════
'use strict';

const Perms = require('../../utils/permissions');
const UI = require('../../rpg/utils/UI');

function bare(j) { return String(j || '').split('@')[0].split(':')[0]; }
function fmtDur(ms) { const t = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return (h ? `${h}h ` : '') + `${m}m ${s}s`; }

function resolveTarget(db, msg, args) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  let jid = ctx?.mentionedJid?.[0] || ctx?.participant || null;
  let rest = args.slice();
  if (!jid && rest[0]) {
    const d = rest[0].replace(/\D/g, '');
    if (d.length >= 8) { jid = `${d}@s.whatsapp.net`; rest = rest.slice(1); }
    else { const q = rest[0].toLowerCase(); for (const [k, u] of Object.entries(db.users || {})) if (u?.name && String(u.name).toLowerCase() === q) { jid = k; rest = rest.slice(1); break; } }
  } else if (jid && rest[0] && /^@/.test(rest[0])) rest = rest.slice(1);
  return { jid, rest };
}

// Is this jid currently silenced? Auto-expires. Returns record or null.
function getSilence(db, jid) {
  const rec = db.silencedMods?.[bare(jid)];
  if (!rec) return null;
  if (rec.endsAt && Date.now() > rec.endsAt) { delete db.silencedMods[bare(jid)]; return null; }
  return rec;
}

module.exports = {
  name: 'silence',
  description: '🤫 Owner: silence a mod from regular commands (mod commands still work)',
  category: 'admin',
  usage: '/silence @mod [minutes]|[reason]',
  getSilence, fmtDur,

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const FRAME = UI.FREE_BAR;
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: `❌ *OWNER ONLY.*\n${FRAME}\n/silence is an owner / co-owner command.` }, { quoted: msg });

    const { jid, rest } = resolveTarget(db, msg, args);
    if (!jid) return sock.sendMessage(chatId, { text: `❌ Tag/reply to a mod.\nUsage: /silence @mod 30|not active` }, { quoted: msg });
    if (Perms.isBotOwner(db, jid)) return sock.sendMessage(chatId, { text: `❌ You can't silence an owner.` }, { quoted: msg });
    if (!Perms.isBotMod(db, jid)) return sock.sendMessage(chatId, { text: `❌ @${bare(jid)} is not a mod — /silence only applies to mods (use /mute for players).`, mentions: [jid] }, { quoted: msg });

    // "30|not active" → minutes + reason. Either side optional.
    const raw = rest.join(' ').trim();
    let minutes = 0, reason = '';
    if (raw.includes('|')) { const [a, ...b] = raw.split('|'); minutes = parseInt(a.trim(), 10) || 0; reason = b.join('|').trim(); }
    else if (/^\d+$/.test(raw)) minutes = parseInt(raw, 10);
    else reason = raw;
    if (minutes < 0 || minutes > 60 * 24 * 30) return sock.sendMessage(chatId, { text: `❌ Duration must be 1–43200 minutes (30 days), or omit it for indefinite.` }, { quoted: msg });

    if (!db.silencedMods) db.silencedMods = {};
    const rec = { jid, by: sender, at: Date.now(), endsAt: minutes ? Date.now() + minutes * 60000 : null, reason: reason || null };
    db.silencedMods[bare(jid)] = rec;
    saveDatabase();
    const name = db.users?.[jid]?.name || `@${bare(jid)}`;
    return sock.sendMessage(chatId, {
      text: [FRAME, `🤫 *MOD SILENCED*`, FRAME, `👤 Mod: *${name}* (@${bare(jid)})`, `⏳ Duration: ${minutes ? fmtDur(minutes * 60000) : 'until /unsilence'}`, `📝 Reason: ${reason || '—'}`, `👑 By: @${bare(sender)}`, FRAME, `_They can only use moderation commands until lifted._`].join('\n'),
      mentions: [jid, sender],
    }, { quoted: msg });
  },
};
