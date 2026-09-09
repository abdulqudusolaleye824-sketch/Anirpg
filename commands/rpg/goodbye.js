// ═══════════════════════════════════════════════════════════════
// /goodbye — Toggle goodbye messages when group participants leave
// Default: ON
// ═══════════════════════════════════════════════════════════════

'use strict';

const Perms = require('../../utils/permissions');
const { isGoodbyeEnabled } = require('../../rpg/utils/GroupNoticeManager');

module.exports = {
  name: 'goodbye',
  aliases: ['bye', 'goodbyenotice', 'setgoodbye'],
  description: 'Toggle system goodbye messages when hunters leave the group (on/off)',
  usage: '/goodbye [on|off]',

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
      const current = isGoodbyeEnabled(db, chatId);
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `☠️ *GOODBYE SYSTEM STATUS*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Status: *${current ? 'ON (Enabled)' : 'OFF (Disabled)'}*`,
          ``,
          `💡 *Usage:*`,
          `  /goodbye on  — Enable goodbye messages`,
          `  /goodbye off — Disable goodbye messages`,
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
          return sock.sendMessage(chatId, { text: '❌ Only group admins, bot mods, or bot owners can toggle goodbye messages.' }, { quoted: msg });
        }
      } catch (e) {
        return sock.sendMessage(chatId, { text: '❌ Only group admins, bot mods, or bot owners can toggle goodbye messages.' }, { quoted: msg });
      }
    }

    if (sub === 'on' || sub === 'enable' || sub === 'true') {
      db.groupSettings[chatId].goodbye = true;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: '✅ *Goodbye messages turned ON for this group!*',
      }, { quoted: msg });
    } else if (sub === 'off' || sub === 'disable' || sub === 'false') {
      db.groupSettings[chatId].goodbye = false;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: '🚫 *Goodbye messages turned OFF for this group!*',
      }, { quoted: msg });
    } else {
      return sock.sendMessage(chatId, {
        text: '❌ Invalid option! Use `/goodbye on` or `/goodbye off`.',
      }, { quoted: msg });
    }
  }
};
