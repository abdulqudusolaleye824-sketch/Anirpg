// ═══════════════════════════════════════════════════════════════
// STEAL COMMAND — Dual function (Sticker theft OR Nexus theft)
//
//   • Reply to a sticker with /steal -> Steals & re-brands the sticker
//   • /steal @user or reply to text -> Steals Nexus (robs player)
// ═══════════════════════════════════════════════════════════════

const robCommand = require('./rob');
const sstealCommand = require('../ssteal');

module.exports = {
  name: 'steal',
  aliases: ['rob'],
  description: 'Steal a sticker (if replying to a sticker) or steal Nexus from a player (/steal @user)',
  usage: '/steal (reply to sticker) OR /steal @user',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;

    // If quoted message is a sticker, perform sticker theft
    if (quoted && quoted.stickerMessage) {
      return sstealCommand.execute(sock, msg, args, getDatabase, saveDatabase, sender);
    }

    // Otherwise, perform RPG Nexus theft (rob player)
    return robCommand.execute(sock, msg, args, getDatabase, saveDatabase, sender);
  }
};
