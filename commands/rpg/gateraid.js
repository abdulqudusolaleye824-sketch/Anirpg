// ═══════════════════════════════════════════════════════════════
// GATERAID — Gate code raid (party or solo), floor-by-floor
//
//   /gateraid <CODE>                 — enter (auto party/solo)
//   /gateraid <CODE> join            — join party (guild member/affiliate)
//   /gateraid <CODE> ready           — mark yourself ready (party)
//   /gateraid <CODE> start           — leader starts when all ready (party)
//   /gateraid <CODE> status          — view raid / floor status
//   /gateraid <CODE> attack          — attack current monster
//   /gateraid <CODE> skill <name>    — use a skill
//   /gateraid <CODE> advance         — move to next floor
//   /gateraid <CODE> boss            — engage the boss
// ═══════════════════════════════════════════════════════════════
'use strict';

const GR = require('../../rpg/dungeons/GateRaid');
const { GateManager, GATE_RANKS } = require('../../rpg/dungeons/GateManager');
const { AuraSystem } = require('../../rpg/utils/AuraSystem');
const LevelUpManager = require('../../rpg/utils/LevelUpManager');
const { awardXP } = require('../../rpg/utils/SilentXP');

const XP_PER_MONSTER = { F:200, E:600, D:1800, C:6000, B:20000, A:70000, S:250000, DISASTER:1000000 };
const XP_BOSS_MULT = 5;

function bare(sender) {
  return GR.GKM.normaliseJid(sender);
}

module.exports = {
  name: 'gateraid',
  aliases: ['raid', 'gr'],
  description: '⚔️ Run a gate raid with a gate code (party or solo)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first.' }, { quoted: msg });

    // ── Must be in a registered dungeon GC ───────────────────────
    if (chatId.endsWith('@g.us') && !GR.GKM.isDungeonGC(chatId)) {
      const allGCs = GR.GKM.getAllDungeonGCs();
      const gcList = Object.values(allGCs);
      if (gcList.length > 0) {
        return sock.sendMessage(chatId, {
          text: `❌ *Gate raids must be started in a dungeon GC.*\n\nUse this command in your dungeon group instead.\nGroup ID: \`${gcList[0].chatId}\``,
        }, { quoted: msg });
      }
      return sock.sendMessage(chatId, {
        text: `❌ No dungeon GC registered.\nAsk the owner: */setdungeon*`,
      }, { quoted: msg });
    }

    const code = (args[0] || '').toUpperCase().replace(/^--/, '').trim();
    const action = (args[1] || '').toLowerCase() || 'enter';
    const skillArg = args.slice(2).join(' ');

    if (!code) {
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `⚔️ *GATE RAID*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Use your gate code to start a raid.`,
          ``,
          `📌 *COMMANDS:*`,
          `/gateraid <CODE>          — enter (auto party/solo)`,
          `/gateraid <CODE> join     — join party`,
          `/gateraid <CODE> ready    — mark ready`,
          `/gateraid <CODE> start    — start (party leader)`,
          `/gateraid <CODE> attack   — attack`,
          `/gateraid <CODE> skill <n>— use skill`,
          `/gateraid <CODE> advance  — next floor`,
          `/gateraid <CODE> boss     — boss fight`,
          `/gateraid <CODE> status   — status`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `💡 Guild member → party raid.\n   No-guild hunter → solo raid.\n   Affiliate key → open to everyone.`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── Resolve the gate by code ────────────────────────────────
    const resolved = GR.resolveCode(code);
    if (!resolved.ok) return sock.sendMessage(chatId, { text: resolved.error }, { quoted: msg });
    const { key, keyData, gate } = resolved;

    // Bind the raid to this dungeon GC
    keyData.dungeonChatId = chatId;
    const gc = GR.GKM.getDungeonGC(chatId);
    if (gc && gc.activeKeyId && gc.activeKeyId !== key) {
      return sock.sendMessage(chatId, { text: '❌ This dungeon GC already has an active gate raid. Clear it first.' }, { quoted: msg });
    }
    if (gc) gc.activeKeyId = key;

    const rd = GATE_RANKS[gate.rank] || GATE_RANKS['E'];

    // ── ENTER (default) ─────────────────────────────────────────
    if (action === 'enter' || action === 'open' || action === 'start-raid') {
      const res = GR.enter(sender, player.name, key, keyData, gate, db);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });
      saveDatabase();

      const isOpenKey = !!keyData.isAffiliate;
      const solo = res.raid.members.length <= 1;
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `${rd.emoji} *${solo ? 'SOLO' : 'PARTY'} RAID — RECRUITING*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `${rd.label} [${gate.id}]`,
          ``,
          isOpenKey
            ? `🔓 *Affiliate key* — open to everyone, no guild required.`
            : `🏰 *Guild key* — open to the owning guild's members.`,
          `👑 Leader: *${player.name} (you)*`,
          ``,
          `📌 *STEPS:*`,
          isOpenKey
            ? `1️⃣ Anyone: /gateraid ${key} join`
            : `1️⃣ Guild members: /gateraid ${key} join`,
          `2️⃣ Everyone: /gateraid ${key} ready`,
          `3️⃣ Leader: /gateraid ${key} start`,
          ``,
          `📊 /gateraid ${key} status — see who's ready`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `💡 A gate instantly opens when you use a code.`,
          `   Add friends above, or start solo with just you.`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── JOIN ────────────────────────────────────────────────────
    if (action === 'join') {
      if (!gate.raid) return sock.sendMessage(chatId, { text: '❌ Start the raid first: /gateraid ' + key }, { quoted: msg });
      const res = GR.join(sender, player.name, gate, db);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `✅ *${player.name}* joined the party!\n👥 Members: ${res.raid.members.length}\n\nMark ready: /gateraid ${key} ready`,
        mentions: [sender],
      }, { quoted: msg });
    }

    // ── READY ───────────────────────────────────────────────────
    if (action === 'ready') {
      const res = GR.ready(sender, gate);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });
      saveDatabase();
      const raid = gate.raid;
      let txt = `✅ *${player.name}* is ready!\n\n`;
      raid.members.forEach(m => { txt += `  ${m.id === raid.leader ? '👑' : '⚔️'} ${m.name} ${m.ready ? '✅' : '⏳'}\n`; });
      if (res.allReadied) txt += `\n🎉 *ALL READY!* Leader: /gateraid ${key} start`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── START (party) ───────────────────────────────────────────
    if (action === 'start') {
      const res = GR.start(sender, keyData, gate, db);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });
      saveDatabase();
      const raid = res.raid;
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `${rd.emoji} *RAID STARTED!*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `${rd.label} [${gate.id}]`,
          `🗺️ Floor 1/${gate.totalFloors}`,
          ``,
          `👥 *Party (${raid.members.length}):*`,
          ...raid.members.map(m => `  ${m.id === raid.leader ? '👑' : '⚔️'} ${m.name}`),
          ``,
          `⚔️ /gateraid ${key} attack`,
          `🔮 /gateraid ${key} skill <name>`,
          `📊 /gateraid ${key} status`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── STATUS ──────────────────────────────────────────────────
    if (action === 'status' || action === 'info') {
      const m = gate.raid?.members?.find(x => x.id === sender);
      if (!gate.raid && !gate.raiders?.includes(sender)) {
        return sock.sendMessage(chatId, { text: '❌ Start a raid first with your code.' }, { quoted: msg });
      }
      if (gate.raid && !gate.raid.members.some(x => x.id === sender) && !gate.raiders?.includes(sender)) {
        return sock.sendMessage(chatId, { text: '❌ You are not part of this raid.' }, { quoted: msg });
      }
      return sock.sendMessage(chatId, { text: GR.statusOf(gate, db) }, { quoted: msg });
    }

    // ── ADVANCE ─────────────────────────────────────────────────
    if (action === 'advance') {
      if (!inRaid(gate, sender)) return sock.sendMessage(chatId, { text: '❌ You are not in this raid.' }, { quoted: msg });
      const floor = gate.currentFloor;
      const floorMonsters = (gate.monsters || []).filter(mm => mm.floor === floor && !mm.defeated);
      if (floorMonsters.length > 0) return sock.sendMessage(chatId, { text: `❌ Clear all monsters on Floor ${floor} first!` }, { quoted: msg });
      if (floor >= gate.totalFloors) return sock.sendMessage(chatId, { text: `⚠️ Final floor. Engage the boss with /gateraid ${key} boss` }, { quoted: msg });
      gate.currentFloor++;
      const next = (gate.monsters || []).filter(mm => mm.floor === gate.currentFloor && !mm.defeated);
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `➡️ *FLOOR ${gate.currentFloor}*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `「System」 Entering Floor ${gate.currentFloor} of ${gate.totalFloors}...`,
          ``,
          `👾 *${next.length} monsters*:`,
          ...next.slice(0, 6).map(mm => `  💀 ${mm.name} — HP ${mm.hp}`),
          next.length > 6 ? `  ...and ${next.length - 6} more` : ``,
          ``,
          `⚔️ /gateraid ${key} attack`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].filter(l => l !== '').join('\n'),
      }, { quoted: msg });
    }

    // ── ATTACK / SKILL ──────────────────────────────────────────
    if (action === 'attack' || action === 'skill') {
      if (!inRaid(gate, sender)) return sock.sendMessage(chatId, { text: '❌ You are not in this raid.' }, { quoted: msg });
      const floor = gate.currentFloor;
      const floorMonsters = (gate.monsters || []).filter(mm => mm.floor === floor && !mm.defeated);

      if (floorMonsters.length === 0) {
        if (floor >= gate.totalFloors) return sock.sendMessage(chatId, { text: `⚠️ All monsters cleared! Engage the boss:\n/gateraid ${key} boss` }, { quoted: msg });
        return sock.sendMessage(chatId, { text: `✅ Floor ${floor} cleared!\nAdvance: /gateraid ${key} advance` }, { quoted: msg });
      }

      const target = floorMonsters[0];
      const useSkill = action === 'skill' ? skillArg : null;
      const result = GR.playerDamage(player, useSkill);
      if (result.blocked) return sock.sendMessage(chatId, { text: `❌ ${result.reason}` }, { quoted: msg });

      if (!gate.damageDealt) gate.damageDealt = {};
      gate.damageDealt[sender] = (gate.damageDealt[sender] || 0) + result.damage;

      target.hp = Math.max(0, target.hp - result.damage);

      const lines = [
        `⚔️ *${player.name}* → *${target.name}*`,
        result.skillUsed ? `🔮 *${result.skillUsed.name}*` : ``,
        `${result.isCrit ? '💥 *CRITICAL HIT!* ' : ''}Dealt *${result.damage}* damage`,
        `👾 ${target.name} HP: ${target.hp}/${target.maxHp}`,
      ];

      if (target.hp <= 0) {
        target.defeated = true;
        gate.monstersKilled = (gate.monstersKilled || 0) + 1;
        if (!player.stats_history) player.stats_history = {};
        player.stats_history.monstersKilled = (player.stats_history.monstersKilled || 0) + 1;

        awardXP(player, 'gate_complete', saveDatabase, sock, chatId);
        lines.push(``, `💀 *${target.name}* defeated!`);

        const heal = GR.lifeSteal(player, result.damage);
        if (heal > 0) { player.stats.hp = Math.min(player.stats.maxHp, (player.stats.hp || 0) + heal); lines.push(`💚 Lifesteal: +${heal} HP`); }

        // Final-blow monster drop → the killer
        const dropLines = GR.monsterKilledBy(gate, target, sender, db);
        if (dropLines.length) lines.push(...dropLines);

        const remaining = floorMonsters.filter(mm => !mm.defeated).length - 1;
        lines.push(``, `👾 *${Math.max(0, remaining)}* monsters remaining on Floor ${floor}`);

        if (remaining <= 0) {
          if (floor >= gate.totalFloors) { lines.push(``, `🏆 *BOSS FLOOR REACHED!*`); lines.push(`/gateraid ${key} boss — Engage the boss!`); }
          else { lines.push(``, `✅ *Floor ${floor} CLEARED!*`); lines.push(`/gateraid ${key} advance — Floor ${floor + 1}`); }
        }
      } else {
        const def = (player.stats?.def || 5) + (player.equipped?.armor?.def || 0);
        const dmg = GR.monsterDamage(target, def);
        player.stats.hp = Math.max(0, (player.stats.hp || 0) - dmg);
        lines.push(``, `💢 *${target.name}* counter-attacks!`, `Took *${dmg}* damage`);
        lines.push(`❤️ Your HP: *${player.stats.hp}/${player.stats.maxHp}*`);

        if (player.stats.hp <= 0) {
          player.stats.hp = 1;
          player.stats_history = player.stats_history || {};
          player.stats_history.gateDeaths = (player.stats_history.gateDeaths || 0) + 1;
          const loss = Math.floor((player.manaCrystals || 0) * 0.15);
          player.manaCrystals = Math.max(0, (player.manaCrystals || 0) - loss);
          lines.push(``, `💀 *YOU FELL IN THE GATE!*`, `Lost ${loss.toLocaleString()} 💎`, `You fled with 1 HP.`);
          // Remove from raid
          if (gate.raid) gate.raid.members = gate.raid.members.filter(m => m.id !== sender);
          gate.raiders = (gate.raiders || []).filter(r => r !== sender);
          saveDatabase();
          return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
        }
      }

      // Sync HP to party view
      const pm = gate.raid?.members?.find(m => m.id === sender);
      if (pm) { pm.hp = player.stats.hp; pm.energy = player.stats.energy; }

      saveDatabase();
      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    // ── BOSS ────────────────────────────────────────────────────
    if (action === 'boss') {
      if (!inRaid(gate, sender)) return sock.sendMessage(chatId, { text: '❌ You are not in this raid.' }, { quoted: msg });
      const floor = gate.currentFloor;
      const floorMonsters = (gate.monsters || []).filter(mm => mm.floor === floor && !mm.defeated);
      if (floorMonsters.length > 0) return sock.sendMessage(chatId, { text: `❌ Clear all floor ${floor} monsters first!` }, { quoted: msg });
      if (floor < gate.totalFloors) return sock.sendMessage(chatId, { text: `❌ Reach Floor ${gate.totalFloors} before engaging the boss.` }, { quoted: msg });
      if (gate.boss.defeated) return sock.sendMessage(chatId, { text: '✅ Boss already defeated!' }, { quoted: msg });

      const boss = gate.boss;
      const result = GR.playerDamage(player, skillArg || null);
      if (result.blocked) return sock.sendMessage(chatId, { text: `❌ ${result.reason}` }, { quoted: msg });

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
      ];

      if (boss.hp <= 0) {
        boss.defeated = true;
        AuraSystem.addAura(player, 'bossKill');

        const damageDealt = gate.damageDealt || {};
        const topRaider = Object.entries(damageDealt).sort((a, b) => b[1] - a[1])[0];
        if (topRaider && topRaider[0] === sender) AuraSystem.addAura(player, 'topRaider');

        awardXP(player, 'gate_boss', saveDatabase, sock, chatId);

        // Final-blow boss loot → the killer
        const bossDropLines = [];
        const bossDrop = GateManager.rollMonsterKillDrop(gate.rank, boss.name);
        if (bossDrop) {
          if (!player.inventory) player.inventory = { materials: [] };
          if (!player.inventory.materials) player.inventory.materials = [];
          player.inventory.materials.push({ ...bossDrop, obtainedAt: Date.now(), fromGate: gate.id });
          bossDropLines.push(`🎁 *BOSS DROP → ${player.name}* (final blow): *${bossDrop.name}*`);
        }

        // Distribute full loot: gold→guild treasury, drops→final-blow, recovery
        const loot = GR.clearGate(gate, key, keyData, db, saveDatabase);

        lines.push(``, `💀 *${boss.name}* HAS BEEN DEFEATED!`, ``);
        lines.push(`🔥 Aura gained!`);
        if (bossDropLines.length) lines.push(...bossDropLines);
        lines.push(``, `🎁 *LOOT → ${loot.destinationText}*`);
        lines.push(`💠 ${loot.nexus.toLocaleString()} Nexus | 💎 ${loot.crystals.toLocaleString()} Mana Stones`);
        if (loot.affiliatePayouts && Object.keys(loot.affiliatePayouts).length) {
          lines.push(``, `🤝 *Affiliate / recruiter payouts:*`);
          for (const [jid, p] of Object.entries(loot.affiliatePayouts)) {
            const nm = db.users?.[jid]?.name || jid.split('@')[0];
            lines.push(`  • *${nm}* — ${p.percent}% → ${p.gold.toLocaleString()} 💠 + ${p.crystals} 💎`);
          }
        }
        if (loot.contractPayouts && Object.keys(loot.contractPayouts).length) lines.push(`📋 Contracts paid out automatically.`);

        if (loot.wildPet && loot.wildPet.token) {
          lines.push(``, `🐾 *WILD PET APPEARED!*`);
          lines.push(`${loot.wildPet.emoji} *${loot.wildPet.name}* [${loot.wildPet.rarity.toUpperCase()}]`);
          lines.push(`🪤 /caught ${loot.wildPet.token} — hurry, it flees in 60s!`);
        }

        lines.push(``, `💚 *All members: 50% recovery + no cooldown.*`);
        lines.push(`🚪 *GATE ${gate.id} CLEARED!*`);
        lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      } else {
        const def = (player.stats?.def || 5) + (player.equipped?.armor?.def || 0);
        const bossAtk = Math.floor(GATE_RANKS[gate.rank].monsterRange[1] * 0.20);
        const dmg = Math.max(10, bossAtk - Math.floor(def * 0.4));
        player.stats.hp = Math.max(1, (player.stats.hp || 0) - dmg);
        const heal = GR.lifeSteal(player, result.damage);
        if (heal > 0) player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
        lines.push(``, `💢 *${boss.name}* retaliates!`, `Took *${dmg}* damage`);
        if (heal > 0) lines.push(`💚 Lifesteal: +${heal} HP`);
        lines.push(`❤️ Your HP: *${player.stats.hp}/${player.stats.maxHp}*`);
        lines.push(``, `⚔️ /gateraid ${key} boss — Attack again`);
      }

      const pm = gate.raid?.members?.find(m => m.id === sender);
      if (pm) { pm.hp = player.stats.hp; pm.energy = player.stats.energy; }

      saveDatabase();
      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: `Usage: /gateraid ${key} [join|ready|start|attack|skill <name>|status|advance|boss]`,
    }, { quoted: msg });
  },
};

// Helper: is the sender an active raider of this gate?
function inRaid(gate, sender) {
  if (gate.raid && gate.raid.members.some(m => m.id === sender)) return true;
  if ((gate.raiders || []).includes(sender)) return true;
  return false;
}
