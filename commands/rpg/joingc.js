// /joingc — Mod DM command: bot joins a WhatsApp group via invite link and tracks it.
// Usage: /joingc <WhatsApp group link>
// DM-only, bot mods/owner only. The joined group is recorded under a stable serial
// number for /leavegc and listed by /gclist.

'use strict';

const Perms = require('../../utils/permissions');
const MSM = (() => { try { return require('../../bots/MultiSocketManager'); } catch (e) { return null; } })();

function bare(jid) {
  return String(jid || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
}

function store(db) {
  if (!db.botJoinedGCs || typeof db.botJoinedGCs !== 'object') db.botJoinedGCs = {};
  return db.botJoinedGCs;
}

// Resolve which personality key owns this socket (for leavegc routing later).
function resolveBotKey(sock) {
  try {
    const myId = sock?.user?.id;
    if (!myId || !MSM || typeof MSM.getAllSockets !== 'function') return null;
    const all = MSM.getAllSockets() || {};
    for (const [key, s] of Object.entries(all)) {
      if (s && s.user && s.user.id === myId) return key;
    }
  } catch (e) {}
  return null;
}

module.exports = {
  name: 'joingc',
  aliases: [],
  description: 'Join a WhatsApp group via invite link and track it (mod DM command)',
  usage: '/joingc <WhatsApp group link>',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Only bot moderators can use this command.' }, { quoted: msg });
    }
    if (chatId && chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ Use this command in my DM, not in a group.' }, { quoted: msg });
    }

    const raw = (args[0] || '').trim();
    const m = raw.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
    const code = m ? m[1] : null;
    if (!code) {
      return sock.sendMessage(chatId, {
        text: '❌ Send a valid WhatsApp group invite link.\n\nUsage: /joingc <WhatsApp group link>\nExample: /joingc https://chat.whatsapp.com/AbCdEfGhIjK',
      }, { quoted: msg });
    }

    // Best-effort: resolve group info WITHOUT joining first (name + duplicate check).
    let info = null;
    try {
      if (typeof sock.groupGetInviteInfo === 'function') info = await sock.groupGetInviteInfo(code);
    } catch (e) { info = null; }

    const joined = store(db);
    if (info && info.id) {
      const dup = Object.values(joined).find((e) => e && e.groupId === info.id);
      if (dup) {
        return sock.sendMessage(chatId, {
          text: `ℹ️ That group is already tracked as *#${dup.serial}* (${dup.name || 'Unknown'}).\n\nUse /gclist to view all joined GCs.`,
        }, { quoted: msg });
      }
    }

    // Join.
    let groupId = info && info.id ? info.id : null;
    try {
      const res = await sock.groupAcceptInvite(code);
      if (typeof res === 'string' && res.includes('@g.us')) groupId = res;
    } catch (e) {
      const why = (e && e.message) ? String(e.message) : 'unknown error';
      return sock.sendMessage(chatId, {
        text: `❌ Could not join that group: ${why}\n\nThe link may be expired/revoked, or I may already be a member.`,
      }, { quoted: msg });
    }
    if (!groupId) {
      return sock.sendMessage(chatId, {
        text: '❌ Joined, but WhatsApp did not return a group id — the group was NOT tracked. Ask the owner to check the link.',
      }, { quoted: msg });
    }

    const dupAfter = Object.values(joined).find((e) => e && e.groupId === groupId);
    if (dupAfter) {
      return sock.sendMessage(chatId, {
        text: `ℹ️ Already a member — that group is tracked as *#${dupAfter.serial}* (${dupAfter.name || 'Unknown'}).`,
      }, { quoted: msg });
    }

    let subject = (info && (info.subject || info.name)) || null;
    if (!subject) {
      try {
        const meta = await sock.groupMetadata(groupId);
        subject = meta && meta.subject ? meta.subject : null;
      } catch (e) {}
    }

    db.gcSerialCounter = (db.gcSerialCounter || 0) + 1;
    const serial = db.gcSerialCounter;
    joined[serial] = {
      serial,
      groupId,
      name: subject || 'Unknown group',
      link: `https://chat.whatsapp.com/${code}`,
      code,
      botKey: resolveBotKey(sock),
      joinedAt: Date.now(),
      joinedBy: bare(sender),
    };
    saveDatabase();

    return sock.sendMessage(chatId, {
      text: [
        `✅ *Joined & tracked as GC #${serial}*`,
        ``,
        `🏷️ ${subject || 'Unknown group'}`,
        `🆔 ${groupId}`,
        `🔗 https://chat.whatsapp.com/${code}`,
        ``,
        `📌 /gclist — view joined GCs`,
        `📌 /leavegc ${serial} — leave this GC`,
      ].join('\n'),
    }, { quoted: msg });
  },
};
