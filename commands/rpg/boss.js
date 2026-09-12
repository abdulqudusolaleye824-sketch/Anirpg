'use strict';

const GKM = require('../../rpg/dungeons/GateKeyManager');
const { GateManager } = require('../../rpg/dungeons/GateManager');

module.exports = {
  name: 'boss',
  aliases: ['b'],
  description: '👹 Boss Battle Command — engage or attack active boss',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];

    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first!' }, { quoted: msg });

    // 1. Check Gate Raid active in chat or for player
    const gc = GKM.getDungeonGC(chatId);
    let activeKey = gc?.activeKeyId || null;
    if (!activeKey) {
      for (const g of Object.values(GateManager.gates || {})) {
        if (g.raid && g.raid.status === 'active' && g.raid.members?.some(m => m.id === sender)) {
          activeKey = g.raid.key;
          break;
        }
      }
    }

    if (activeKey) {
      const GateRaidCmd = require('./gateraid');
      return GateRaidCmd.execute(sock, msg, [activeKey, 'boss', ...args], getDatabase, saveDatabase, sender);
    }

    // 2. Solo Dungeon
    if (player.dungeon && (player.dungeon.currentBattle || player.dungeon.inDungeon)) {
      const DungeonCmd = require('./dungeon');
      return DungeonCmd.execute(sock, msg, ['attack', ...args], getDatabase, saveDatabase, sender);
    }

    // No active boss battle — point at the gate bosses (world boss scrapped, batch-23).
    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👹 *BOSS BATTLES*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `⚔️ *GATE BOSSES*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📋 *COMMANDS:*`,
        `/gateraid <code> boss  — Engage gate boss`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `💡 Short alias: */b* works in combat!`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    }, { quoted: msg });
  }
};
