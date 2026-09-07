const DungeonPartyManager = require('../../rpg/dungeons/DungeonPartyManager');

module.exports = {
  name: 'forceclear',
  description: '🔧 Force clear a user\'s battles, cooldowns, and locks',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const { COOWNER_JID } = require('../../utils/constants');
    const Mod = require('../../rpg/utils/ModerationUtils');

    if (!Mod.canModerate(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Admin only.' }, { quoted: msg });
    }

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const targetId = ctx?.mentionedJid?.[0] || ctx?.participant;

    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: '❌ Tag or reply to a user.\n\nUsage:\n/forceclear @user'
      }, { quoted: msg });
    }

    const player = db.users?.[targetId];
    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ User not registered.' }, { quoted: msg });
    }

    const report = [];

    // ── PvP: end match if the target is in one ──────────────────────────────
    if (player.pvpBattle) {
      const opponentId = player.pvpBattle.opponentId;
      const opponent = db.users?.[opponentId];
      if (opponent && opponent.pvpBattle) {
        opponent.pvpBattle = null;
        report.push('✔ PvP match ended (opponent freed)');
      }
      player.pvpBattle = null;
      report.push('✔ PvP match cleared');
    }

    // ── Dungeon party: only dissolve if target is the party LEADER ──────────
    const dungeonParty = DungeonPartyManager.getPartyByPlayer(targetId);
    if (dungeonParty) {
      if (dungeonParty.leader === targetId) {
        // Notify and clear all party members
        for (const member of dungeonParty.members) {
          const memberPlayer = db.users?.[member.id];
          if (memberPlayer) {
            delete memberPlayer.inDungeon;
            delete memberPlayer.activeDungeon;
            if (!memberPlayer.cooldowns) memberPlayer.cooldowns = {};
            memberPlayer.cooldowns.dungeon = 0;
          }
          try {
            const dmId = member.id.includes('@') ? member.id : `${member.id}@s.whatsapp.net`;
            await sock.sendMessage(dmId, {
              text: `⚠️ Your dungeon party was force-disbanded by an admin.\nYou are free to play again.`
            });
          } catch {}
        }
        delete DungeonPartyManager.parties[dungeonParty.id];
        report.push('✔ Dungeon party disbanded (was leader)');
      } else {
        report.push('ℹ️ Dungeon party NOT cleared (target is not the leader)');
      }
    }

    // ── Boss party: only dissolve if target is the party LEADER ─────────────
    // Boss parties also use DungeonPartyManager, check separately by status
    // (Boss parties have party.boss set). Walk all parties to find boss party.
    let bossPartyFound = false;
    for (const [partyId, party] of Object.entries(DungeonPartyManager.parties || {})) {
      if (!party.boss) continue; // not a boss party
      const isMember = party.members.some(m => m.id === targetId);
      if (!isMember) continue;

      bossPartyFound = true;
      if (party.leader === targetId) {
        for (const member of party.members) {
          const memberPlayer = db.users?.[member.id];
          if (memberPlayer) {
            delete memberPlayer.inBoss;
            delete memberPlayer.activeBoss;
            if (!memberPlayer.cooldowns) memberPlayer.cooldowns = {};
            memberPlayer.cooldowns.boss = 0;
          }
          try {
            const dmId = member.id.includes('@') ? member.id : `${member.id}@s.whatsapp.net`;
            await sock.sendMessage(dmId, {
              text: `⚠️ Your boss party was force-disbanded by an admin.\nYou are free to play again.`
            });
          } catch {}
        }
        delete DungeonPartyManager.parties[partyId];
        report.push('✔ Boss party disbanded (was leader)');
      } else {
        report.push('ℹ️ Boss party NOT cleared (target is not the leader)');
      }
      break;
    }

    // ── Always clear solo combat states & cooldowns ──────────────────────────
    delete player.inBattle;
    delete player.inDungeon;
    delete player.inBoss;
    delete player.activeDungeon;
    delete player.activeBoss;
    delete player.battle;

    if (player.dungeon) {
      player.dungeon.currentBattle = null;
      player.dungeon.cooldownUntil = 0;
    }
    if (player.boss) {
      player.boss.currentBattle = null;
      player.boss.cooldownUntil = 0;
    }

    if (!player.cooldowns) player.cooldowns = {};
    player.cooldowns.dungeon = 0;
    player.cooldowns.boss    = 0;
    player.cooldowns.gate    = 0;
    player.cooldowns.pvp     = 0;

    // ── Full heal ────────────────────────────────────────────────────────────
    if (player.stats) {
      player.stats.hp     = player.stats.maxHp;
      player.stats.energy = player.stats.maxEnergy;
    }
    player.statusEffects = [];

    report.push('✔ All cooldowns reset');
    report.push('✔ Full heal applied');

    saveDatabase();

    await sock.sendMessage(chatId, {
      text:
`━━━━━━━━━━━━━━━━━━━━━━
✅ FORCE CLEAR SUCCESS
━━━━━━━━━━━━━━━━━━━━━━
👤 User: @${targetId.split('@')[0]}
👮 Admin: @${sender.split('@')[0]}

${report.join('\n')}
━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [targetId, sender]
    }, { quoted: msg });

    try {
      await sock.sendMessage(targetId, {
        text: `🔧 ADMIN ACTION\n\nYour battles and cooldowns were force cleared.\nYou are now free to play again.`
      });
    } catch {}
  }
};
