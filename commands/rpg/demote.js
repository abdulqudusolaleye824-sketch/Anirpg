/**
 * /demote — Demote a user from group admin.
 * Group-admin tier: the user AND the bot must both be group admins.
 * (Replaces the old /gcdemote.)
 */

'use strict';

const GroupAdmin = require('../../rpg/utils/GroupAdmin');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'demote',
  description: '⬇️ Demote a user from group admin',
  category: 'admin',
  usage: '/demote @user',
  availability: 'Group admins (bot must be admin)',
  where: 'Groups only',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const gate = await GroupAdmin.requireGroupAdmin(sock, chatId, sender, db);
    if (!gate.ok) return sock.sendMessage(chatId, { text: gate.err }, { quoted: msg });

    const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (!target) return sock.sendMessage(chatId, { text: '❌ Tag a user: /demote @user' }, { quoted: msg });

    if (GroupAdmin.bare(target) === GroupAdmin.bare(gate.botJid)) {
      return sock.sendMessage(chatId, { text: '❌ Cannot demote the bot.' }, { quoted: msg });
    }
    // Owners/Co-Owners are protected from demotion.
    if (Perms.getBotOwners(db).some((o) => GroupAdmin.bare(o) === GroupAdmin.bare(target))) {
      return sock.sendMessage(chatId, { text: '❌ Cannot demote an Owner/Co-Owner.' }, { quoted: msg });
    }

    try {
      await sock.groupParticipantsUpdate(chatId, [target], 'demote');
      return sock.sendMessage(chatId, { text: '✅ Demoted from group admin.' }, { quoted: msg });
    } catch (e) {
      return sock.sendMessage(chatId, { text: '❌ Failed to demote: ' + e.message }, { quoted: msg });
    }
  },
};
