// ═══════════════════════════════════════════════════════════════
// GATERAID — Floor-by-floor combat inside a gate
// Usage:
//   /gateraid [GATE-ID] attack        — attack current monster
//   /gateraid [GATE-ID] skill [name]  — use a skill
//   /gateraid [GATE-ID] status        — see floor status
//   /gateraid [GATE-ID] advance       — move to next floor
//   /gateraid [GATE-ID] boss          — engage the boss
// ═══════════════════════════════════════════════════════════════

const { GateManager, GATE_RANKS } = require('../../rpg/dungeons/GateManager');
const { AuraSystem } = require('../../rpg/utils/AuraSystem');
const { AWAKENING_RANKS, calculatePowerRating } = require('../../rpg/utils/SoloLevelingCore');
const LevelUpManager = require('../../rpg/utils/LevelUpManager');
const { awardXP } = require('../../rpg/utils/SilentXP');
const GKM = require('../../rpg/dungeons/GateKeyManager');

const XP_PER_MONSTER = { F:200, E:600, D:1800, C:6000, B:20000, A:70000, S:250000, DISASTER:1000000 };
const XP_BOSS_MULT = 5;

function getPlayerDamage(player, skillName = null) {
  const atk = (player.stats?.atk || 10) + (player.equipped?.weapon?.atk || player.equipped?.weapon?.bonus || 0);
  const magicPower = player.stats?.magicPower || 0;

  if (skillName) {
    const skill = (player.skills?.active || []).find(s => s.name === skillName);
    if (skill) {
      const cd = player.skills?.cooldowns?.[skillName] || 0;
      if (Date.now() < cd) return { damage: 0, blocked: true, reason: `*${skillName}* is on cooldown!` };
      if ((player.stats?.energy || 0) < (skill.energyCost || 0)) return { damage: 0, blocked: true, reason: `Not enough energy for *${skillName}*!` };

      let dmg = (skill.damage || 20) + Math.floor((atk + magicPower) * 0.5);
      const isCrit = Math.random() < (player.stats?.critChance || 2) / 100;
      if (isCrit) dmg = Math.floor(dmg * (player.stats?.critDamage || 150) / 100);
      // Deduct energy & set cooldown
      player.stats.energy = Math.max(0, (player.stats.energy || 0) - (skill.energyCost || 0));
      if (!player.skills.cooldowns) player.skills.cooldowns = {};
      player.skills.cooldowns[skillName] = Date.now() + (skill.cooldown || 3) * 1000;
      return { damage: dmg, isCrit, skillUsed: skill };
    }
    return { damage: 0, blocked: true, reason: `Skill *${skillName}* not found.` };
  }

  // Normal attack
  let dmg = Math.max(5, atk - 0) * (0.85 + Math.random() * 0.30);
  const isCrit = Math.random() < (player.stats?.critChance || 2) / 100;
  if (isCrit) dmg = Math.floor(dmg * (player.stats?.critDamage || 150) / 100);
  return { damage: Math.floor(dmg), isCrit };
}

function getMonsterDamage(monster, player) {
  const def = (player.stats?.def || 5) + (player.equipped?.armor?.def || 0);
  const raw = Math.max(3, (monster.atk || 10) - Math.floor(def * 0.5));
  return Math.floor(raw * (0.8 + Math.random() * 0.4));
}

function getLifestealHeal(player, damage) {
  const ls = (player.stats?.lifesteal || 0) / 100;
  return ls > 0 ? Math.floor(damage * ls) : 0;
}

module.exports = {
  name: 'gateraid',
  aliases: ['raid', 'gr'],
  description: '⚔️ Fight inside an active gate raid',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first.' }, { quoted: msg });

    // Redirect if not in a dungeon GC
    if (chatId.endsWith('@g.us') && !GKM.isDungeonGC(chatId)) {
      const allGCs = GKM.getAllDungeonGCs();
      const gcList = Object.values(allGCs);
      if (gcList.length > 0) {
        return sock.sendMessage(chatId, {
          text: [
            `❌ *Gate raids must be started in a dungeon GC.*`,
            ``,
            `Use this command in your dungeon group instead.`,
            `Group ID: \`${gcList[0].chatId}\``,
          ].join('\n'),
        }, { quoted: msg });
      }
      return sock.sendMessage(chatId, {
        text: `❌ No dungeon GC registered.\nAsk the owner: */set dungeon --true*`,
      }, { quoted: msg });
    }

    const gateId = args[0]?.toUpperCase();
    const action = args[1]?.toLowerCase() || 'status';
    const skillArg = args.slice(2).join(' ');

    if (!gateId) return sock.sendMessage(chatId, { text: '❌ Usage: /gateraid [GATE-ID] [action]\n\nActions: attack, skill [name], status, advance, boss' }, { quoted: msg });

    const gate = GateManager.getGate(gateId);
    if (!gate || gate.chatId !== chatId) return sock.sendMessage(chatId, { text: '❌ Gate not found in this chat.' }, { quoted: msg });
    if (gate.cleared || gate.broken) return sock.sendMessage(chatId, { text: '❌ This gate is no longer active.' }, { quoted: msg });
    if (!gate.raidStarted) return sock.sendMessage(chatId, { text: `❌ The raid hasn't started yet.\nUse /gates start ${gateId}` }, { quoted: msg });
    if (!gate.raiders.includes(sender)) return sock.sendMessage(chatId, { text: `❌ You are not part of this raid. Use /gates apply ${gateId}` }, { quoted: msg });

    const rd = GATE_RANKS[gate.rank];

    // ── STATUS ────────────────────────────────────────────────
    if (action === 'status' || action === 'info') {
      const floor = gate.currentFloor;
      const floorMonsters = (gate.monsters || []).filter(m => m.floor === floor && !m.defeated);
      const totalMonsters = (gate.monsters || []).filter(m => m.floor === floor).length;
      const bossReady = floor >= gate.totalFloors && floorMonsters.length === 0 && !gate.boss.defeated;

      const lines = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `${rd.emoji} *${rd.label}* [${gateId}]`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🗺️ Floor: *${floor}/${gate.totalFloors}*`,
        `👾 Monsters: ${totalMonsters - floorMonsters.length}/${totalMonsters} cleared`,
        bossReady ? `🏆 *BOSS READY — /gateraid ${gateId} boss*` : ``,
        ``,
        floorMonsters.length > 0 ? `*Current floor monsters:*` : `✅ Floor cleared!`,
        ...floorMonsters.slice(0, 5).map(m => `  💀 ${m.name} — HP: ${m.hp}/${m.maxHp}`),
        floorMonsters.length > 5 ? `  ...and ${floorMonsters.length - 5} more` : ``,
        ``,
        `❤️ Your HP: ${player.stats?.hp || 0}/${player.stats?.maxHp || 100}`,
        `💙 Energy:  ${player.stats?.energy || 0}/${player.stats?.maxEnergy || 100}`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `⚔️ /gateraid ${gateId} attack`,
        `🔮 /gateraid ${gateId} skill [name]`,
        floorMonsters.length === 0 && !bossReady ? `➡️ /gateraid ${gateId} advance` : ``,
        bossReady ? `🏆 /gateraid ${gateId} boss` : ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].filter(l => l !== null && l !== '').join('\n');

      return sock.sendMessage(chatId, { text: lines }, { quoted: msg });
    }

    // ── ADVANCE FLOOR ─────────────────────────────────────────
    if (action === 'advance') {
      const floor = gate.currentFloor;
      const floorMonsters = (gate.monsters || []).filter(m => m.floor === floor && !m.defeated);
      if (floorMonsters.length > 0) return sock.sendMessage(chatId, { text: `❌ Clear all monsters on Floor ${floor} first!` }, { quoted: msg });
      if (floor >= gate.totalFloors) return sock.sendMessage(chatId, { text: `⚠️ You are on the final floor.\nEngage the boss with /gateraid ${gateId} boss` }, { quoted: msg });

      gate.currentFloor++;
      const nextFloorMonsters = (gate.monsters || []).filter(m => m.floor === gate.currentFloor && !m.defeated);
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `➡️ *FLOOR ${gate.currentFloor}*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `「System」 Entering Floor ${gate.currentFloor} of ${gate.totalFloors}...`,
          ``,
          `👾 *${nextFloorMonsters.length} monsters* on this floor:`,
          ...nextFloorMonsters.slice(0, 5).map(m => `  💀 ${m.name} — HP: ${m.hp}`),
          nextFloorMonsters.length > 5 ? `  ...and ${nextFloorMonsters.length - 5} more` : ``,
          ``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `⚔️ /gateraid ${gateId} attack`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].filter(l => l !== '').join('\n')
      }, { quoted: msg });
    }

    // ── ATTACK / SKILL ────────────────────────────────────────
    if (action === 'attack' || action === 'skill') {
      const floor = gate.currentFloor;
      const floorMonsters = (gate.monsters || []).filter(m => m.floor === floor && !m.defeated);

      if (floorMonsters.length === 0) {
        if (floor >= gate.totalFloors) {
          return sock.sendMessage(chatId, { text: `⚠️ All monsters cleared! Engage the boss:\n/gateraid ${gateId} boss` }, { quoted: msg });
        }
        return sock.sendMessage(chatId, { text: `✅ Floor ${floor} cleared!\nAdvance with: /gateraid ${gateId} advance` }, { quoted: msg });
      }

      // Target first living monster
      const target = floorMonsters[0];

      // Calc damage
      const useSkill = action === 'skill' ? skillArg : null;
      const result = getPlayerDamage(player, useSkill);

      if (result.blocked) return sock.sendMessage(chatId, { text: `❌ ${result.reason}` }, { quoted: msg });

      // Track damage dealt by this player
      if (!gate.damageDealt) gate.damageDealt = {};
      gate.damageDealt[sender] = (gate.damageDealt[sender] || 0) + result.damage;

      // Apply player damage to monster
      target.hp = Math.max(0, target.hp - result.damage);

      const lines = [
        `⚔️ *${player.name}* → *${target.name}*`,
        result.skillUsed ? `🔮 *${result.skillUsed.name}*` : ``,
        `${result.isCrit ? '💥 *CRITICAL HIT!* ' : ''}Dealt *${result.damage}* damage`,
        `👾 ${target.name} HP: ${target.hp}/${target.maxHp}`,
      ];

      // Monster dies
      if (target.hp <= 0) {
        target.defeated = true;
        gate.monstersKilled = (gate.monstersKilled || 0) + 1;
        if (!player.stats_history) player.stats_history = {};
        player.stats_history.monstersKilled = (player.stats_history.monstersKilled || 0) + 1;

        // XP reward
        // XP silent
        awardXP(player, 'gate_complete', saveDatabase, sock, chatId);
        lines.push(``, `💀 *${target.name}* defeated!`);

        // Lifesteal
        const heal = getLifestealHeal(player, result.damage);
        if (heal > 0) {
          player.stats.hp = Math.min(player.stats.maxHp, (player.stats.hp || 0) + heal);
          lines.push(`💚 Lifesteal: +${heal} HP`);
        }

        if (levelResult.leveledUp) {
          lines.push(`⭐ *LEVEL UP!* → Level ${player.level}`);
          if (levelResult.classAssigned) lines.push(`🎭 *CLASS ASSIGNED: ${levelResult.classAssigned}*`);
        }

        const remaining = floorMonsters.filter(m => !m.defeated).length - 1;
        lines.push(``, `👾 *${Math.max(0, remaining)}* monsters remaining on Floor ${floor}`);

        if (remaining <= 0) {
          if (floor >= gate.totalFloors) {
            lines.push(``, `🏆 *BOSS FLOOR REACHED!*`);
            lines.push(`/gateraid ${gateId} boss — Engage the boss!`);
          } else {
            lines.push(``, `✅ *Floor ${floor} CLEARED!*`);
            lines.push(`/gateraid ${gateId} advance — Move to Floor ${floor + 1}`);
          }
        }
      } else {
        // Monster counter-attacks
        const monsterDmg = getMonsterDamage(target, player);
        player.stats.hp = Math.max(0, (player.stats.hp || 0) - monsterDmg);
        lines.push(``, `💢 *${target.name}* counter-attacks!`);
        lines.push(`Took *${monsterDmg}* damage`);
        lines.push(`❤️ Your HP: *${player.stats.hp}/${player.stats.maxHp}*`);

        // Player dies in gate
        if (player.stats.hp <= 0) {
          player.stats.hp = 1;
          player.stats_history = player.stats_history || {};
          player.stats_history.gateDeaths = (player.stats_history.gateDeaths || 0) + 1;
          // Lose some crystals
          const crystalLoss = Math.floor((player.manaCrystals || 0) * 0.15);
          player.manaCrystals = Math.max(0, (player.manaCrystals || 0) - crystalLoss);
          AuraSystem.removeAura(player, 'deathInGate');
          lines.push(``, `💀 *YOU FELL IN THE GATE!*`);
          lines.push(`Lost ${crystalLoss.toLocaleString()} 💎 Mana Stones`);
          lines.push(`-30 ✨ Aura`);
          lines.push(`You fled from the gate with 1 HP.`);
          // Remove from raid
          gate.raiders = gate.raiders.filter(r => r !== sender);
          gate.externalRaiders = gate.externalRaiders.filter(r => r !== sender);
          saveDatabase();
          return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
        }
      }

      saveDatabase();
      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    // ── BOSS ──────────────────────────────────────────────────
    if (action === 'boss') {
      const floor = gate.currentFloor;
      const floorMonsters = (gate.monsters || []).filter(m => m.floor === floor && !m.defeated);
      if (floorMonsters.length > 0) return sock.sendMessage(chatId, { text: `❌ Clear all floor ${floor} monsters first!` }, { quoted: msg });
      if (floor < gate.totalFloors) return sock.sendMessage(chatId, { text: `❌ Reach Floor ${gate.totalFloors} before engaging the boss.` }, { quoted: msg });
      if (gate.boss.defeated) return sock.sendMessage(chatId, { text: '✅ Boss already defeated!' }, { quoted: msg });

      const boss = gate.boss;
      const useSkill = skillArg || null;
      const result = getPlayerDamage(player, useSkill || null);

      if (result.blocked) return sock.sendMessage(chatId, { text: `❌ ${result.reason}` }, { quoted: msg });

      // Track damage
      if (!gate.damageDealt) gate.damageDealt = {};
      gate.damageDealt[sender] = (gate.damageDealt[sender] || 0) + result.damage;

      boss.hp = Math.max(0, boss.hp - result.damage);

      const lines = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🏆 *BOSS BATTLE*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `💀 *${boss.name}*`,
        ``,
        `⚔️ *${player.name}* ${result.skillUsed ? `→ *${result.skillUsed.name}*` : '→ attacks!'}`,
        `${result.isCrit ? '💥 CRITICAL! ' : ''}Dealt *${result.damage}* damage`,
        ``,
        `👁️ Boss HP: ${boss.hp.toLocaleString()} / ${boss.maxHp.toLocaleString()}`,
        `[${'█'.repeat(Math.round(boss.hp/boss.maxHp*10))}${'░'.repeat(10 - Math.round(boss.hp/boss.maxHp*10))}]`,
      ];

      if (boss.hp <= 0) {
        // BOSS KILLED
        boss.defeated = true;
        AuraSystem.addAura(player, 'bossKill');

        // Find top raider
        const damageDealt = gate.damageDealt || {};
        const topRaider = Object.entries(damageDealt).sort((a, b) => b[1] - a[1])[0];
        if (topRaider && topRaider[0] === sender) {
          AuraSystem.addAura(player, 'topRaider');
        }

        // XP for boss
        // XP silent
        awardXP(player, 'gate_boss', saveDatabase, sock, chatId);
        AuraSystem.addAura(player, AuraSystem.getGateClearEvent(gate.rank));

        // Clear gate
        GateManager.clearGate(gate.id, db);

        // Distribute loot
        // Route loot through GateKeyManager if a key was used
        let lootResult = null;
        if (gate.keyId) {
          const bossLoot = gate.bossLoot || [];
          const totalCrystals = bossLoot.filter(i => i.type === 'currency').reduce((s, i) => s + (i.amount || 0), 0);
          lootResult = GKM.distributeLoot(gate.keyId, { gold: gate.goldReward || 0, crystals: totalCrystals, items: bossLoot.filter(i => i.type !== 'currency') }, db, saveDatabase);
        } else {
          GateManager.distributeLoot(gate.id, db);
        }


        lines.push(``, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        lines.push(`💀 *${boss.name}* HAS BEEN DEFEATED!`);
        lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        lines.push(``);

        lines.push(`🔥 Aura gained!`);


        if (lootResult) {
          const dest = lootResult.isAffiliate ? 'Key holder' : `${lootResult.guild || 'Guild'} Treasury`;
          lines.push(``, `🎁 *LOOT → ${dest}*`);
          lines.push(`💠 ${(lootResult.gold||0).toLocaleString()} Nexus | 💎 ${lootResult.crystals||0} Mana Stones`);
          if (Object.keys(lootResult.contractPayouts||{}).length > 0)
            lines.push(`📋 Contracts paid out automatically.`);
        }

        lines.push(``);
        lines.push(`🚪 *GATE ${gate.id} CLEARED!*`);
        lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      } else {
        // Boss counter-attack
        const bossAtk = Math.floor(rd.monsterRange[1] * 0.20);
        const playerDef = (player.stats?.def || 5) + (player.equipped?.armor?.def || 0);
        const bossDmg = Math.max(10, bossAtk - Math.floor(playerDef * 0.4));
        player.stats.hp = Math.max(1, (player.stats.hp || 0) - bossDmg);

        const heal = getLifestealHeal(player, result.damage);
        if (heal > 0) player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);

        lines.push(``);
        lines.push(`💢 *${boss.name}* retaliates!`);
        lines.push(`Took *${bossDmg}* damage`);
        if (heal > 0) lines.push(`💚 Lifesteal: +${heal} HP`);
        lines.push(`❤️ Your HP: *${player.stats.hp}/${player.stats.maxHp}*`);
        lines.push(``);
        lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        lines.push(`⚔️ /gateraid ${gateId} boss — Attack again`);
        lines.push(`🔮 /gateraid ${gateId} boss skill [name] — Use a skill`);
        lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      }

      saveDatabase();
      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: `Usage: /gateraid ${gateId} [attack|skill [name]|status|advance|boss]`
    }, { quoted: msg });
  }
};