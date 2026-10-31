// 10-30 (owner): /ucmd <command> — OWNER ONLY. The last 50 uses of a command: who, which GC, how long ago, exact text.
'use strict';
const Perms = require('../../utils/permissions');
module.exports = {
  name: 'ucmd',
  aliases: ['cmdlog', 'usedcmd'],
  ownerOnly: true,
  description: '📜 [OWNER] /ucmd <command> — last 50 uses (who · where · how)',
  usage: '/ucmd <command>',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return; // silent for everyone else
    const out = require('../../rpg/utils/CommandLog').render(db, args[0] || '', Math.min(50, Math.max(1, parseInt(args[1]) || 50)));
    return sock.sendMessage(chatId, { text: out.text }, { quoted: msg });
  },
};
