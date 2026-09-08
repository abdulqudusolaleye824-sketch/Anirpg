// ═══════════════════════════════════════════════════════════════
// /skill — Execute class skill in active combat or view skills
// ═══════════════════════════════════════════════════════════════

'use strict';

const ClassCmdDispatcher = require('./classcmd_dispatcher');

module.exports = {
  name: 'skill',
  aliases: ['skills', 'useskill', 'castskill'],
  description: 'Execute a class skill in active combat or view skills',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    return ClassCmdDispatcher.execute(sock, msg, args, getDatabase, saveDatabase, sender);
  }
};
