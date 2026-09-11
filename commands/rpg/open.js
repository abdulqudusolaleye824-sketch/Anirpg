/**
 * /open — Allow members to send messages (un-lock group).
 * Group-admin tier: the user AND the bot must both be group admins.
 */

'use strict';

const GroupAdmin = require('../../rpg/utils/GroupAdmin');
const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'open',
  description: '🔓 Open the group (everyone can chat)',
  category: 'admin',
  usage: '/open',
  availability: 'Group admins (bot must be admin)',
  where: 'Groups only',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const proO = UI.isPro(db.users[sender]);
    const gate = await GroupAdmin.requireGroupAdmin(sock, chatId, sender, db);
    if (!gate.ok) return sock.sendMessage(chatId, { text: gate.err }, { quoted: msg });

    try {
      await sock.groupSettingUpdate(chatId, 'not_announcement');
      return sock.sendMessage(chatId, {
        text: [
          (proO ? UI.PRO_BAR : UI.FREE_BAR),
          '🔓 *GROUP OPENED*',
          'Everyone can send messages now.',
          proO ? (UI.PRO_MINI + '\n🔓 PRO GATE') : null,
          proO ? `👮 Opened by @${GroupAdmin.bare(sender)}` : null,
          (proO ? UI.PRO_BAR : UI.FREE_BAR),
        ].filter(x => x !== null).join('\n'),
      });
    } catch (err) {
      return sock.sendMessage(chatId, { text: '❌ Failed to open the group.' }, { quoted: msg });
    }
  },
};
