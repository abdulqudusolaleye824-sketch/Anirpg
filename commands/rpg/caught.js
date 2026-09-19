// Push #71: /caught <token> is retired — /catch finds your wild pet by itself.
// This shim keeps old messages working by forwarding to /catch.
'use strict';
const CatchCmd = require('./catch');
module.exports = {
  name: 'caught',
  aliases: [],
  description: '🪤 (legacy) → use /catch',
  usage: '/catch',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    return CatchCmd.execute(sock, msg, [], getDatabase, saveDatabase, sender);
  },
};
