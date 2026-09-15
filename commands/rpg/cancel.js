// ═══════════════════════════════════════════════════════════════
// /cancel — abort the pending confirmation (PRO epic+ gift, etc.)
//
// Push #47 companion to /confirm. It hands the answer back to whichever command
// created the prompt, which clears the pending entry and leaves the item exactly
// where it was. See commands/rpg/confirm.js for why these exist alongside the
// buttons (WhatsApp hides native-flow buttons in groups for Web-linked accounts).
// ═══════════════════════════════════════════════════════════════

'use strict';

const confirmCmd = require('./confirm');

module.exports = {
  name: 'cancel',
  aliases: ['no'],
  description: '❌ Cancel the pending confirmation (item stays with you)',
  usage: '/cancel',

  execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    return confirmCmd.resolve(sock, msg, args, getDatabase, saveDatabase, sender, 'cancel');
  },
};
