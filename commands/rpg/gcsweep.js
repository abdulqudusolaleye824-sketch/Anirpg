// /gcsweep — owner DM: preview / leave groups not added via /joingc or /setgroup.
// /gcsweep            → dry-run list per bot
// /gcsweep confirm    → actually leave
// /gcsweep auto on|off → toggle automatic sweep on connect
'use strict';
const Perms = require('../../utils/permissions');
module.exports = {
  name: 'gcsweep',
  aliases: ['groupguard'],
  description: 'Owner: list/leave untracked groups (all bots)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '🔒 Owner only.' }, { quoted: msg });
    const GG = require('../../rpg/utils/GroupGuard');
    const sub = String(args[0] || '').toLowerCase();
    if (sub === 'auto') {
      db.groupGuardAuto = String(args[1] || '').toLowerCase() === 'on';
      saveDatabase();
      return sock.sendMessage(chatId, { text: `🛡️ Auto-sweep on connect: *${db.groupGuardAuto ? 'ON' : 'OFF'}*` }, { quoted: msg });
    }
    let MSM = null; try { MSM = require('../../bots/MultiSocketManager'); } catch (e) {}
    const all = (MSM && MSM.getAllSockets && MSM.getAllSockets()) || { self: sock };
    const confirm = sub === 'confirm';
    const lines = [`🛡️ *GROUP GUARD ${confirm ? '— LEAVING' : '— PREVIEW'}*`, `Allowed: /joingc GCs, /setgroup GCs, and any community they belong to.`, ``];
    for (const [key, s] of Object.entries(all)) {
      if (!s || !s.user) continue;
      const r = await GG.sweep(s, db, key, { force: true, dryRun: !confirm });
      const list = confirm ? r.left : (r.wouldLeave || []);
      lines.push(`*${key}* — ${r.checked} groups, ${confirm ? 'left' : 'would leave'} ${list.length}${r.error ? ` (⚠️ ${r.error})` : ''}`);
      for (const g of list.slice(0, 15)) lines.push(`  • ${g.name || g.id}`);
    }
    if (!confirm) lines.push(``, `Run */gcsweep confirm* to leave these. Auto on connect: ${db.groupGuardAuto ? 'ON' : 'OFF'} (/gcsweep auto on|off)`);
    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  },
};
