// joinmains.js — owner: join ALL online bots to ALL --main groups (retroactive + drift repair).
// Push #25.
'use strict';

const AstralGroups = require('../../rpg/utils/AstralGroups');
const MainJoin = require('../../rpg/utils/MainJoin');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'joinmains',
  aliases: ['mainjoin'],
  description: '🤖 [Owner] Join all online bots to every --main group',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Owner / Co-Owner only!' }, { quoted: msg });
    }

    const mains = (AstralGroups.getAll(db) || []).filter((g) => g && g.isMain && g.groupId);
    if (!mains.length) {
      return sock.sendMessage(chatId, {
        text: '⚠️ No --main groups registered yet.\n\nRegister one inside its group:\n/setgroup <type> --main'
      }, { quoted: msg });
    }

    const blocks = [`🤖 *JOINING ${mains.length} MAIN GROUP${mains.length > 1 ? 'S' : ''}*`, ''];
    for (const g of mains) {
      const label = g.groupName || g.type || String(g.groupId).slice(-12);
      let link = g.inviteLink || null;
      // Refresh + persist the link when run inside that very group.
      if (!link && chatId === g.groupId && typeof sock.groupInviteCode === 'function') {
        try {
          link = `https://chat.whatsapp.com/${await sock.groupInviteCode(g.groupId)}`;
          if (link && db.astralGroups && db.astralGroups[g.groupId]) {
            db.astralGroups[g.groupId].inviteLink = link;
          }
        } catch {}
      }
      let results;
      try {
        results = await MainJoin.joinAllToMain(db, g.groupId, link, { sock });
      } catch (e) {
        results = [{ name: '?', status: 'failed', detail: String((e && e.message) || e).slice(0, 100) }];
      }
      blocks.push(`*${label}*`, MainJoin.formatResults(results), '');
    }
    try { saveDatabase(); } catch {}
    return sock.sendMessage(chatId, { text: blocks.join('\n').slice(0, 6000) }, { quoted: msg });
  },
};
