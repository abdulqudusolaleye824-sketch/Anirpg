/**
 * /broadcast — DM an announcement to every registered user (owner / co-owner only).
 *   /broadcast [message]
 */

'use strict';

const Perms = require('../../utils/permissions');

module.exports = {
  name: 'broadcast',
  description: '📣 DM an announcement to all bot users',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotOwner(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ *Owner / Co-Owner only.*\n\nYou need owner permissions to broadcast.',
      }, { quoted: msg });
    }

    const message = args.join(' ');
    if (!message) {
      return sock.sendMessage(chatId, {
        text: [
          '📣 *BROADCAST*',
          '',
          '📌 Usage: /broadcast [message]',
          '',
          'Example:',
          '  /broadcast New features added! Check /help',
        ].join('\n'),
      }, { quoted: msg });
    }

    if (!Array.isArray(db.subscribers)) {
      db.subscribers = Object.values(db.subscribers || {}).filter((v) => typeof v === 'string');
    }
    const allUsers = db.subscribers || [];

    if (allUsers.length === 0) {
      return sock.sendMessage(chatId, {
        text: '❌ No registered users to broadcast to!',
      }, { quoted: msg });
    }

    await sock.sendMessage(chatId, {
      text: `📣 Broadcasting to ${allUsers.length} users... this may take a moment.`,
    }, { quoted: msg });

    let successCount = 0;
    let failCount = 0;

    const broadcastMessage = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '📣 *BOT ANNOUNCEMENT* 📣',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      message,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '_An official broadcast from the bot._',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ].join('\n');

    for (const userId of allUsers) {
      try {
        await sock.sendMessage(userId, { text: broadcastMessage });
        successCount++;
        await new Promise((resolve) => setTimeout(resolve, 2500));
      } catch (_) {
        failCount++;
      }
    }

    await sock.sendMessage(chatId, {
      text: [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '✅ *BROADCAST COMPLETE* ✅',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        `✅ Sent: ${successCount}`,
        `❌ Failed: ${failCount}`,
        `📊 Total: ${allUsers.length}`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
    }, { quoted: msg });
  },
};
