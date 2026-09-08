'use strict';

const GKM = require('../../rpg/dungeons/GateKeyManager');
const { GateManager } = require('../../rpg/dungeons/GateManager');

module.exports = {
  name: 'flee',
  aliases: ['escape', 'run'],
  description: '🏃 Attempt to flee from active combat',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];

    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first!' }, { quoted: msg });

    // 1. PvP Battle
    if (player.pvpBattle) {
      const PvpCmd = require('./pvp');
      return PvpCmd.execute(sock, msg, ['surrender'], getDatabase, saveDatabase, sender);
    }

    // 2. Solo Dungeon
    if (player.dungeon && (player.dungeon.currentBattle || player.dungeon.inDungeon)) {
      const DungeonCmd = require('./dungeon');
      return DungeonCmd.execute(sock, msg, ['flee'], getDatabase, saveDatabase, sender);
    }

    // 3. Gate Raid
    const gc = GKM.getDungeonGC(chatId);
    let activeGateKey = gc?.activeKeyId || null;
    if (!activeGateKey) {
      for (const g of Object.values(GateManager.gates || {})) {
        if (g.raid && g.raid.status === 'active' && g.raid.members?.some(m => m.id === sender)) {
          activeGateKey = g.raid.key;
          break;
        }
      }
    }

    if (activeGateKey) {
      const keyData = GKM.getKey(activeGateKey) || db.gateKeys?.[activeGateKey];
      const gate = keyData ? GateManager.getGate(keyData.gateId) : null;
      if (gate && gate.raid) {
        gate.raid.members = (gate.raid.members || []).filter(m => m.id !== sender);
        gate.raiders = (gate.raiders || []).filter(r => r !== sender);
        saveDatabase();

        return sock.sendMessage(chatId, {
          text: `🏃 *${player.name}* fled from Gate Raid \`${activeGateKey}\`!\nRemaining members: ${gate.raid.members.length}`
        }, { quoted: msg });
      }
    }

    // 4. World Boss
    if (player.boss || player.inBossBattle) {
      player.boss = null;
      player.inBossBattle = false;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `🏃 *${player.name}* fled from the World Boss battle!`
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: '❌ You are not in any active battle to flee from!'
    }, { quoted: msg });
  }
};
