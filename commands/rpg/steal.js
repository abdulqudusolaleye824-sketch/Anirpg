// ═══════════════════════════════════════════════════════════════
// STEAL — Alias for Rob (Nexus theft)
// ═══════════════════════════════════════════════════════════════

const robCommand = require('./rob');

module.exports = {
  name: 'steal',
  aliases: ['rob'],
  description: 'Attempt to steal Nexus from another player (RISKY!)',
  usage: '/steal @user',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    return robCommand.execute(sock, msg, args, getDatabase, saveDatabase, sender);
  }
};
