// ═══════════════════════════════════════════════════════════════
// SSTEAL — Sticker theft command
// ═══════════════════════════════════════════════════════════════

const sstealBase = require('../ssteal');

module.exports = {
  name: 'ssteal',
  aliases: ['stickersteal'],
  description: 'Reply to a sticker to steal it.',
  usage: '/ssteal',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    return sstealBase.execute(sock, msg, args, getDatabase, saveDatabase, sender);
  }
};
