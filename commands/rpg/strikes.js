// Push #103a (BUG-090): /strikes — see your own spam strikes + any mute on you (who, why, how long).
// Mods/owners: /strikes @user  (or reply) to inspect another hunter.
'use strict';
module.exports = {
  name: 'strikes', aliases: ['mystrikes', 'mutestatus'],
  description: '📊 Your spam strikes and mute status',
  usage: '/strikes  ·  mods: /strikes @user',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    const Mod = require('../../rpg/utils/ModerationUtils'); const SG = require('../../rpg/utils/SpamGuard');
    let target = sender;
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const other = (ctx?.mentionedJid && ctx.mentionedJid[0]) || ctx?.participant || null;
    if (other) {
      let mod = false; try { const P = require('../../utils/permissions'); mod = P.isBotOwner(db, sender) || (P.isBotMod && P.isBotMod(db, sender)); } catch (e) {}
      if (mod) target = other;
    }
    const u = db.users?.[target]; const name = u?.name || `@${String(target).split('@')[0]}`;
    const st = SG.status(db, target); const now = Date.now();
    const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };
    const who = (by) => by === 'AstraSpamGuard' ? '✦ 𝐀𝐬𝐭𝐫𝐚™ SpamGuard (command spam)' : by === 'AntiLink' ? '✦ 𝐀𝐬𝐭𝐫𝐚™ Anti-Link' : by ? `@${String(by).split('@')[0].split(':')[0]}` : 'unknown';
    const lines = [`📊 *STRIKES — ${name}*`, `⚠️ Spam strikes this week: *${st.n}/${SG.WARNINGS}*${st.n > SG.WARNINGS ? ` (over the limit — every cooldown hit now mutes ${SG.MIN_MIN}–${SG.MAX_MIN} min)` : ''}`, `🔇 Spam mutes this week: *${st.mutes}*`];
    const dm = (db.mutedUsers || {})[Mod.bare(target)];
    if (dm && (!dm.endsAt || dm.endsAt > now)) lines.push(`🔕 DM mute: by ${who(dm.mutedBy)} — ${dm.endsAt ? fmt(dm.endsAt - now) + ' left' : 'indefinite'}`);
    const gm = [];
    for (const [g, m] of Object.entries(db.groupMutes || {})) { const r = m && m[Mod.bare(target)]; if (r && (!r.endsAt || r.endsAt > now)) gm.push({ g, r }); }
    if (gm.length) for (const { g, r } of gm) lines.push(`🔇 Group mute${g === chatId ? ' (this group)' : ''}: by ${who(r.mutedBy)} — ${r.endsAt ? fmt(r.endsAt - now) + ' left' : 'indefinite'}`);
    if (!gm.length && !(dm && (!dm.endsAt || dm.endsAt > now))) lines.push('✅ Not muted anywhere.');
    lines.push('', `Strikes reset Sunday 00:00 WAT. A cooldown hit with ≤${SG.GRACE_LEFT_S}s left never counts.`);
    const mentions = [];
    return sock.sendMessage(chatId, { text: lines.join('\n'), mentions }, { quoted: msg });
  },
};
