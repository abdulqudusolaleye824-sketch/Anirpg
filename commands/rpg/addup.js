/**
 * /addup <amount> [@hunter | reply]   — OWNER ONLY (Push #101 · #103f)
 * /addup --all <amount>              — every registered hunter, SILENT, owner DM only (Push #103f)
 * Grants Upgrade Points — shared engine: rpg/utils/OwnerGrant.js
 */
'use strict';
module.exports = {
  name: 'addup', aliases: ['giveup2', 'addpoints'],
  description: '👑 Owner: add Upgrade Points to yourself, a tagged/replied hunter, or --all hunters (silent)',
  usage: '/addup <amount> [@hunter] | /addup --all <amount>', category: 'admin', ownerOnly: true,
  execute(sock, msg, args, getDatabase, saveDatabase, sender) { return require('../../rpg/utils/OwnerGrant').run('up', sock, msg, args, getDatabase, saveDatabase, sender); },
};
