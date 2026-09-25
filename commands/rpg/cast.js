// ═══════════════════════════════════════════════════════════════
// /cast — Mage class command shortcut (Push #88p)
// Forwards to /skill so live-combat routing + the class dispatcher apply.
// ═══════════════════════════════════════════════════════════════
'use strict';

module.exports = {
  name: 'cast',
  description: 'Mage class command — /cast <spell>',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    return require('./skill').execute(sock, msg, args, getDatabase, saveDatabase, sender);
  }
};
