// ═══════════════════════════════════════════════════════════════
// /welcome — Toggle welcome messages for new group participants
// Default: ON
// ═══════════════════════════════════════════════════════════════

'use strict';

const Perms = require('../../utils/permissions');
const { isWelcomeEnabled } = require('../../rpg/utils/GroupNoticeManager');

module.exports = {
  name: 'welcome',
  aliases: ['welcomenotice', 'setwelcome'],
  description: 'Toggle system welcome messages for new hunters joining the group (on/off)',
  usage: '/welcome [on|off]',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ This command can only be used in group chats!' }, { quoted: msg });
    }

    const db = getDatabase();

    if (!db.groupSettings) db.groupSettings = {};
    if (!db.groupSettings[chatId]) {
      db.groupSettings[chatId] = { antiLink: false, slowmode: 0, welcome: true, goodbye: true };
    }

    const sub = args[0]?.toLowerCase();

    if (!sub || sub === 'status') {
      const current = isWelcomeEnabled(db, chatId);
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `👋 *WELCOME SYSTEM STATUS*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Status: *${current ? 'ON (Enabled)' : 'OFF (Disabled)'}*`,
          ``,
          `💡 *Usage:*`,
          `  /welcome on  — Enable welcome messages`,
          `  /welcome off — Disable welcome messages`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // Permission check for modifying setting
    if (!Perms.isBotOwner(db, sender) && !Perms.isBotMod(db, sender)) {
      try {
        const meta = await sock.groupMetadata(chatId);
        const p = meta.participants.find(m => m.id === sender || m.id.split(':')[0] === sender.split(':')[0]);
        const isAdmin = p && (p.admin === 'admin' || p.admin === 'superadmin');
        if (!isAdmin) {
          return sock.sendMessage(chatId, { text: '❌ Only group admins, bot mods, or bot owners can toggle welcome messages.' }, { quoted: msg });
        }
      } catch (e) {
        return sock.sendMessage(chatId, { text: '❌ Only group admins, bot mods, or bot owners can toggle welcome messages.' }, { quoted: msg });
      }
    }

    if (sub === 'on' || sub === 'enable' || sub === 'true') {
      db.groupSettings[chatId].welcome = true;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: '✅ *Welcome messages turned ON for this group!*',
      }, { quoted: msg });
    } else if (sub === 'off' || sub === 'disable' || sub === 'false') {
      db.groupSettings[chatId].welcome = false;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: '🚫 *Welcome messages turned OFF for this group!*',
      }, { quoted: msg });
    } else {
      return sock.sendMessage(chatId, {
        text: '❌ Invalid option! Use `/welcome on` or `/welcome off`.',
      }, { quoted: msg });
    }
  }
};
