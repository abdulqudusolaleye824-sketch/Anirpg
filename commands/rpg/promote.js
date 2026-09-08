/**
 * /promote — Promote a user to group admin.
 * Group-admin tier: the user AND the bot must both be group admins.
 * (Replaces the old /gcpromote.)
 */

'use strict';

const GroupAdmin = require('../../rpg/utils/GroupAdmin');

module.exports = {
  name: 'promote',
  description: '⭐ Promote a user to group admin',
  category: 'admin',
  usage: '/promote @user',
  availability: 'Group admins (bot must be admin)',
  where: 'Groups only',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const gate = await GroupAdmin.requireGroupAdmin(sock, chatId, sender, db);
    if (!gate.ok) return sock.sendMessage(chatId, { text: gate.err }, { quoted: msg });

    const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (!target) return sock.sendMessage(chatId, { text: '❌ Tag a user: /promote @user' }, { quoted: msg });

    // Cannot promote the bot itself, or protect admins
    if (GroupAdmin.bare(target) === GroupAdmin.bare(gate.botJid)) {
      return sock.sendMessage(chatId, { text: '❌ Cannot promote the bot.' }, { quoted: msg });
    }

    try {
      await sock.groupParticipantsUpdate(chatId, [target], 'promote');
      return sock.sendMessage(chatId, { text: '✅ Promoted to group admin!' }, { quoted: msg });
    } catch (e) {
      return sock.sendMessage(chatId, { text: '❌ Failed to promote: ' + e.message }, { quoted: msg });
    }
  },
};
