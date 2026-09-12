// /gclist — List tracked non-main groups the bot joined.
// Usable in mod DM + the mods GC. Bot mods/owner only.
// Excludes --main (subscription-home) groups.

'use strict';

const Perms = require('../../utils/permissions');
const AstralGroups = (() => { try { return require('../../rpg/utils/AstralGroups'); } catch (e) { return null; } })();

module.exports = {
  name: 'gclist',
  aliases: ['gcs', 'joinedgcs'],
  description: 'List tracked non-main groups (mod DM + mods GC)',
  usage: '/gclist',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Only bot moderators can use this command.' }, { quoted: msg });
    }

    const inGroup = !!(chatId && chatId.endsWith('@g.us'));
    if (inGroup && !(AstralGroups && AstralGroups.hosts(db, chatId, 'mods'))) {
      return sock.sendMessage(chatId, { text: '❌ Use this in my DM or the mods GC.' }, { quoted: msg });
    }

    // Exclude --main groups.
    let mainIds = new Set();
    try {
      if (AstralGroups) {
        for (const g of AstralGroups.getAll(db)) {
          if (g && g.isMain && g.groupId) mainIds.add(g.groupId);
        }
      }
    } catch (e) {}

    const joined = db.botJoinedGCs || {};
    const list = Object.values(joined)
      .filter((e) => e && e.groupId && !mainIds.has(e.groupId))
      .sort((a, b) => (a.serial || 0) - (b.serial || 0));

    if (list.length === 0) {
      return sock.sendMessage(chatId, {
        text: '📋 *No tracked GCs.*\n\nMods can add one with /joingc <WhatsApp group link> in my DM.',
      }, { quoted: msg });
    }

    // Best-effort fresh names (skip refresh for very long lists).
    const names = {};
    if (list.length <= 25 && typeof sock.groupMetadata === 'function') {
      for (const e of list) {
        try {
          const meta = await sock.groupMetadata(e.groupId);
          if (meta && meta.subject) names[e.groupId] = meta.subject;
        } catch (err) {}
      }
    }

    const lines = [`📋 *Tracked GCs* (${list.length})`, ``];
    for (const e of list) {
      const when = e.joinedAt ? new Date(e.joinedAt).toLocaleDateString() : '—';
      lines.push(`*#${e.serial}* — ${names[e.groupId] || e.name || 'Unknown group'}`);
      lines.push(`└ ${e.link || 'no link'} · joined ${when}`);
    }
    lines.push(``, `📌 /leavegc <serial> — leave a GC (mod DM)`);

    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  },
};
