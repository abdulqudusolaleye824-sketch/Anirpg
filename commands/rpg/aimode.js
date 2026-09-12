// /aimode — RETIRED (batch-35). AI chat was removed completely: all
// bots now run 100% on personality scripts — no keys, no API calls,
// no "try again in a moment" errors. This stub keeps the command (and
// /help references) working with an explanatory notice.

'use strict';

module.exports = {
  name: 'aimode',
  aliases: ['botai'],
  description: '🤖 AI chat status (retired — fully scripted)',
  usage: '/aimode',
  category: 'system',

  async execute(sock, msg) {
    const chatId = msg.key?.remoteJid;
    return sock.sendMessage(chatId, {
      text: [
        `🤖 *AI CHAT RETIRED*`,
        ``,
        `All bots now run 100% on personality scripts — no AI, no keys, no errors.`,
        ``,
        `(/aimode on/off no longer applies.)`,
      ].join('\n'),
    }, { quoted: msg });
  },
};
