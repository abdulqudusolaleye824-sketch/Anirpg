/**
 * /close — Close the group (admin-only chat).
 * Group-admin tier: the user AND the bot must both be group admins.
 */

'use strict';

const GroupAdmin = require('../../rpg/utils/GroupAdmin');
const UI = require('../../rpg/utils/UI');

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

    const proC = UI.isPro(db.users[sender]);
    const gate = await GroupAdmin.requireGroupAdmin(sock, chatId, sender, db);
    if (!gate.ok) return sock.sendMessage(chatId, { text: gate.err }, { quoted: msg });

    try {
      await sock.groupSettingUpdate(chatId, 'announcement');
      return sock.sendMessage(chatId, {
        text: [
          (proC ? UI.PRO_BAR : UI.FREE_BAR),
          '🔒 *GROUP CLOSED*',
          'Only admins can send messages now.',
          proC ? (UI.PRO_MINI + '\n🔒 PRO GATE') : null,
          proC ? `👮 Closed by @${GroupAdmin.bare(sender)}` : null,
          (proC ? UI.PRO_BAR : UI.FREE_BAR),
        ].filter(x => x !== null).join('\n'),
      });
    } catch (err) {
      return sock.sendMessage(chatId, { text: '❌ Failed to close the group.' }, { quoted: msg });
    }
  },
};
