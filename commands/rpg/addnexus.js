/**
 * /addnexus <amount> [@hunter | reply]   — OWNER ONLY (Push #101 · #103f)
 * /addnexus --all <amount>              — every registered hunter, SILENT, owner DM only (Push #103f)
 * Grants Nexus — shared engine: rpg/utils/OwnerGrant.js
 */
'use strict';
module.exports = {
  name: 'addnexus', aliases: ['givenexus', 'addgold'],
  description: '👑 Owner: add Nexus to yourself, a tagged/replied hunter, or --all hunters (silent)',
  usage: '/addnexus <amount> [@hunter] | /addnexus --all <amount>', category: 'admin', ownerOnly: true,
  execute(sock, msg, args, getDatabase, saveDatabase, sender) { return require('../../rpg/utils/OwnerGrant').run('nexus', sock, msg, args, getDatabase, saveDatabase, sender); },
};
