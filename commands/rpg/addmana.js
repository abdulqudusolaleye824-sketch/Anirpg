/**
 * /addmana <amount> [@hunter | reply]   — OWNER ONLY (Push #101 · #103f)
 * /addmana --all <amount>              — every registered hunter, SILENT, owner DM only (Push #103f)
 * Grants Mana Stones — shared engine: rpg/utils/OwnerGrant.js
 */
'use strict';
module.exports = {
  name: 'addmana', aliases: ['addmanastones', 'addms'],
  description: '👑 Owner: add Mana Stones to yourself, a tagged/replied hunter, or --all hunters (silent)',
  usage: '/addmana <amount> [@hunter] | /addmana --all <amount>', category: 'admin', ownerOnly: true,
  execute(sock, msg, args, getDatabase, saveDatabase, sender) { return require('../../rpg/utils/OwnerGrant').run('mana', sock, msg, args, getDatabase, saveDatabase, sender); },
};
