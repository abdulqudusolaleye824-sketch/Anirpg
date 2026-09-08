// ═══════════════════════════════════════════════════════════════
// /killspawn — Kill active gate spawns
//
// In a group chat: Kills all active, unpurchased gate spawns in that group.
// In DM: Kills all active gate spawns locally across all chats so new gates can spawn.
// ═══════════════════════════════════════════════════════════════

'use strict';

const { GateManager } = require('../../rpg/dungeons/GateManager');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'killspawn',
  aliases: ['killspawns', 'cleargatespawn', 'killgate'],
  description: 'Kill all active gate spawns in this group (or globally if used in DM)',
  usage: '/killspawn',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // Must be at least a mod or owner
    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot mods/owners can use /killspawn.'
      }, { quoted: msg });
    }

    const isGroup = chatId.endsWith('@g.us');
    const killedCount = GateManager.killActiveGates(isGroup ? chatId : null);

    // Clear spawn metadata lock so fresh gates can spawn immediately
    if (!db.gateSpawnMeta) db.gateSpawnMeta = {};
    if (isGroup && db.gateSpawnMeta[chatId]) {
      db.gateSpawnMeta[chatId].lastBuyableGateId = null;
      db.gateSpawnMeta[chatId].penaltyApplied = false;
    } else if (!isGroup) {
      db.gateSpawnMeta = {};
    }

    saveDatabase();

    if (isGroup) {
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `☠️ *ACTIVE SPAWNS KILLED*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `Cleared *${killedCount}* active gate spawn(s) in this group.`,
          `New gates can now spawn freely.`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    } else {
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `☠️ *GLOBAL SPAWNS KILLED (DM)*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `Cleared *${killedCount}* active gate spawn(s) across all chats.`,
          `Local gate spawn locks have been reset.`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }
  },
};
