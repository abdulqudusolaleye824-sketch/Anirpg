/**
 * ╔══════════════════════════════════════════════════════╗
 * ║        Astra — /clearactivebots Command             ║
 * ║  Wipes all group active bot mappings (Owner in DM)   ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

const PersonalityManager = require('../../bots/PersonalityManager');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'clearactivebots',
  description: 'Wipe all group active bot mappings and reset to fresh state (Owner/Co-Owner DM only)',
  ownerOnly: true,

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const isOwner = Perms.isBotOwner(db, sender);
    if (!isOwner) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the bot owner or co-owner can execute /clearactivebots.',
      }, { quoted: msg });
    }

    // Wipe all group active/present mappings in DB and memory
    PersonalityManager.clearAllActive(db, saveDatabase);

    return sock.sendMessage(chatId, {
      text: [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '🧹 *ALL ACTIVE BOTS WIPED*',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        'All group active bot mappings have been reset to a fresh state.',
        'Group chats must now use */start <botname>* to activate a bot.',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
    }, { quoted: msg });
  },
};
