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
    // ── Live-combat routing ──
    // (The dispatcher's queueBattleAction path had ZERO readers anywhere in the
    // repo — every in-combat /skill said "queued!" and fizzled. Route to the
    // engines directly, mirroring attacks.js. Bare /skill still shows the menu.)
    if (args.length > 0) {
      try {
        const db = getDatabase();
        const player = db.users?.[sender];
        const chatId = msg.key?.remoteJid;
        const num = jid => jid?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '') || '';
        const sNum = num(sender);
        if (player) {
          if (player.pvpBattle) {
            return require('./pvp').execute(sock, msg, ['skill', ...args], getDatabase, saveDatabase, sender);
          }
          if (player.dungeon && (player.dungeon.currentBattle || player.dungeon.inDungeon)) {
            return require('./dungeon').execute(sock, msg, ['classcmd', ...args], getDatabase, saveDatabase, sender);
          }
          // Gate raid membership (same check as attacks.js)
          const GKM = require('../../rpg/dungeons/GateKeyManager');
          const { GateManager } = require('../../rpg/dungeons/GateManager');
          const gc = GKM.getDungeonGC(chatId);
          let gk = null;
          if (gc?.activeKeyId) {
            const kd = GKM.getKey(gc.activeKeyId) || db.gateKeys?.[gc.activeKeyId];
            const g = kd ? GateManager.getGate(kd.gateId) : null;
            if (g?.raid?.status === 'active' && g.raid.members?.some(m => num(m.id) === sNum)) gk = gc.activeKeyId;
          }
          if (!gk) {
            for (const g of Object.values(GateManager.gates || {})) {
              if (g.raid?.status === 'active' && g.raid.members?.some(m => num(m.id) === sNum)) { gk = g.raid.key; break; }
            }
          }
          if (gk) {
            return require('./gateraid').execute(sock, msg, [gk, 'skill', ...args], getDatabase, saveDatabase, sender);
          }
          const wbPart = db.activeWorldBoss?.participants?.some(p => num(p) === sNum);
          if (player.boss || player.inBossBattle || wbPart) {
            return require('./worldboss').execute(sock, msg, ['skill', ...args], getDatabase, saveDatabase, sender);
          }
        }
      } catch(e){}
    }
    return ClassCmdDispatcher.execute(sock, msg, args, getDatabase, saveDatabase, sender);
  }
};
