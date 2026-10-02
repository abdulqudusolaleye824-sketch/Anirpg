// /leavegc — Mod DM command: bot leaves a tracked group by serial.
// Usage: /leavegc <gc serial>
// DM-only, bot mods/owner only. See /gclist for serials.

'use strict';

const Perms = require('../../utils/permissions');
const MSM = (() => { try { return require('../../bots/MultiSocketManager'); } catch (e) { return null; } })();

module.exports = {
  name: 'leavegc',
  aliases: [],
  description: 'Leave a tracked group by serial (mod DM command)',
  usage: '/leavegc <gc serial>',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Only bot moderators can use this command.' }, { quoted: msg });
    }
    if (chatId && chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ Use this command in my DM, not in a group.' }, { quoted: msg });
    }

    const serial = parseInt((args[0] || '').trim(), 10);
    const joined = db.botJoinedGCs || {};
    const entry = Number.isFinite(serial) ? joined[serial] : null;
    if (!entry) {
      return sock.sendMessage(chatId, {
        text: '❌ Unknown GC serial.\n\nUsage: /leavegc <gc serial>\nUse /gclist to see serials.',
      }, { quoted: msg });
    }

    // Prefer the socket that originally joined; fall back to the current socket.
    let target = sock;
    try {
      if (entry.botKey && MSM && typeof MSM.getSocket === 'function') {
        const s = MSM.getSocket(entry.botKey);
        if (s && s.user && s.user.id) target = s;
      }
    } catch (e) {}

    // Push #96h-u: EVERY bot sitting in that GC leaves (a bot added by hand, not just the one that /joingc'd).
    const _others = [];
    try {
      const all = (MSM && MSM.getAllSockets && MSM.getAllSockets()) || {};
      for (const [k, s] of Object.entries(all)) { if (!s || s === target || !s.user?.id) continue; try { await s.groupMetadata(entry.groupId); await s.groupLeave(entry.groupId); _others.push(k); } catch (e) {} }
    } catch (e) {}
    try {
      await target.groupLeave(entry.groupId);
    } catch (e) {
      const why = (e && e.message) ? String(e.message) : 'unknown error';
      return sock.sendMessage(chatId, {
        text: `❌ Could not leave *#${entry.serial}* (${entry.name || entry.groupId}): ${why}\n\nThe entry was kept — try again later.`,
      }, { quoted: msg });
    }

    delete joined[entry.serial];
    db.botJoinedGCs = joined;
    // Push #96h-u: a left GC frees its serial — the next /joingc reuses the lowest free number.
    try { const used = Object.keys(joined).map(Number).filter(Number.isFinite); db.gcSerialCounter = used.length ? Math.max(...used) : 0; } catch (e) {}
    saveDatabase();

    return sock.sendMessage(chatId, {
      text: `👋 *Left GC #${entry.serial}* (${entry.name || entry.groupId}) and removed it from tracking.${_others.length ? `\n🤖 Also pulled out: ${_others.join(', ')}` : ''}\n\nUse /gclist to view remaining GCs.`,
    }, { quoted: msg });
  },
};
