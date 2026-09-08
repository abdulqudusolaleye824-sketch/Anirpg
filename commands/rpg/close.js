/**
 * /close — Close the group (admin-only chat).
 * Group-admin tier: the user AND the bot must both be group admins.
 */

'use strict';

const GroupAdmin = require('../../rpg/utils/GroupAdmin');

module.exports = {
  name: 'close',
  description: '🔒 Close the group (admin-only chat)',
  category: 'admin',
  usage: '/close',
  availability: 'Group admins (bot must be admin)',
  where: 'Groups only',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const gate = await GroupAdmin.requireGroupAdmin(sock, chatId, sender, db);
    if (!gate.ok) return sock.sendMessage(chatId, { text: gate.err }, { quoted: msg });

    try {
      await sock.groupSettingUpdate(chatId, 'announcement');
      return sock.sendMessage(chatId, { text: '🔒 Group has been closed. Only admins can send messages now.' });
    } catch (err) {
      return sock.sendMessage(chatId, { text: '❌ Failed to close the group.' }, { quoted: msg });
    }
  },
};
