// ═══════════════════════════════════════════════════════════════
// GATE MANAGER — Solo Leveling Edition
// Gates spawn in group chats. Guilds buy them. Players raid them.
// ═══════════════════════════════════════════════════════════════

const { canEnterGate } = require('../utils/SoloLevelingCore');
const { MONSTER_DROPS, BASE_MATERIALS, rollMonsterDrop, rollBossDrop, rollBaseMaterial, getRandomMonster, getRandomBoss } = require('../data/MonsterDrops');

const GATE_RANKS = {
  F: { emoji:'⬛', label:'F-Rank Gate', floors:2, monsterRange:[1,5], bossHp:300, crystalReward:[100,300], lootTier:'common', purchasePrice:500, isFree:false, description:'Weakest gate. Good for starters.' },
  E: { emoji:'⚫', label:'E-Rank Gate', floors:3, monsterRange:[5,15], bossHp:800, crystalReward:[300,800], lootTier:'common', purchasePrice:1200, isFree:false, description:'Standard low-tier gate.' },
  D: { emoji:'🟤', label:'D-Rank Gate', floors:4, monsterRange:[15,35], bossHp:2000, crystalReward:[800,2000], lootTier:'uncommon', purchasePrice:3000, isFree:false, description:'Mid-low tier. D-rank access.' },
  C: { emoji:'🔵', label:'C-Rank Gate', floors:5, monsterRange:[35,70], bossHp:5000, crystalReward:[2000,5000], lootTier:'rare', purchasePrice:8000, isFree:false, description:'Mid tier. Real money starts here.' },
  B: { emoji:'🟢', label:'B-Rank Gate', floors:6, monsterRange:[70,120], bossHp:12000, crystalReward:[5000,12000], lootTier:'rare', purchasePrice:20000, isFree:false, description:'High tier. Guild raids required.' },
  A: { emoji:'🟡', label:'A-Rank Gate', floors:7, monsterRange:[120,200], bossHp:30000, crystalReward:[12000,30000], lootTier:'epic', purchasePrice:60000, isFree:false, description:'Elite tier.' },
  S: { emoji:'🔴', label:'S-Rank Gate', floors:8, monsterRange:[200,400], bossHp:80000, crystalReward:[30000,100000], lootTier:'legendary', purchasePrice:200000, isFree:false, description:'National-level threat.' },
  DISASTER: { emoji:'🟣', label:'⚠️ DISASTER GATE', floors:10, monsterRange:[400,999], bossHp:250000, crystalReward:[100000,500000], lootTier:'mythic', purchasePrice:0, isFree:true, description:'DISASTER LEVEL. Must be cleared or world suffers.' },
};

// GATE_MONSTERS and GATE_BOSSES are now driven by MonsterDrops.js
// Legacy exports kept for backwards compat
const LOOT_TABLES = {};
const GATE_MONSTERS = Object.fromEntries(Object.entries(MONSTER_DROPS).map(([r, v]) => [r, v.monsters.map(m => m.name)]));
const GATE_BOSSES  = Object.fromEntries(Object.entries(MONSTER_DROPS).map(([r, v]) => [r, v.bosses.map(b => b.name)]));

class GateManager {
  static activeGates = {};
  static gatesByChat = {};
  static gateCounter = 1;
  static GATE_BREAK_TIME = 2 * 60 * 60 * 1000;
  static FREE_GATE_CHANCE = 0.20;
  static DISASTER_CHANCE = 0.02;

  static spawnGate(chatId, groupAverageRank = 'E') {
    const gateId = `G-${Date.now()}-${this.gateCounter++}`;
    let rank = this.rollGateRank(groupAverageRank);
    const isFree = GATE_RANKS[rank]?.isFree || Math.random() < this.FREE_GATE_CHANCE;
    const isDisaster = !isFree && Math.random() < this.DISASTER_CHANCE;
    if (isDisaster) rank = 'DISASTER';
    const rankData = GATE_RANKS[rank];
    const pool = MONSTER_DROPS[rank]?.monsters || MONSTER_DROPS['F'].monsters;
    const bossPool = MONSTER_DROPS[rank]?.bosses || MONSTER_DROPS['F'].bosses;
    const bossData = bossPool[Math.floor(Math.random() * bossPool.length)];
    const bossName = bossData.name;

    const monsters = [];
    const count = rankData.floors * 3;
    const [minHp, maxHp] = rankData.monsterRange;
    for (let i = 0; i < count; i++) {
      const monsterData = pool[Math.floor(Math.random() * pool.length)];
      const hp = Math.floor(minHp + Math.random() * (maxHp - minHp));
      monsters.push({ name: monsterData.name, hp, maxHp: hp, atk: Math.floor(hp * 0.15), def: Math.floor(hp * 0.05), floor: Math.floor(i / 3) + 1, defeated: false });
    }

    const loot = this.generateBossLoot(rank, 6);

    const gate = {
      id: gateId, chatId, rank, rankData, spawnTime: Date.now(),
      breakTime: Date.now() + this.GATE_BREAK_TIME,
      isFree, isDisaster, owned: false, ownedBy: null, ownedByLeader: null,
      purchasedAt: null, purchasePrice: rankData.purchasePrice,
      cleared: false, broken: false, active: true,
      raiders: [], guildRaiders: [], externalRaiders: [], pendingApplicants: [],
      raidStarted: false, raidStartTime: null,
      currentFloor: 0, totalFloors: rankData.floors, monsters,
      boss: { name: bossName, hp: rankData.bossHp, maxHp: rankData.bossHp, defeated: false },
      bossLoot: loot, lootDistributed: false,
      monstersKilled: 0, damageDealt: {},
    };

    this.activeGates[gateId] = gate;
    if (!this.gatesByChat[chatId]) this.gatesByChat[chatId] = [];
    this.gatesByChat[chatId].push(gateId);

    // Trigger disaster event system if applicable
    if (gate.isDisaster) {
      try {
        const DisasterGateEvent = require('../utils/DisasterGateEvent');
        // sock is passed in by the auto-spawner — stored on gate for later
        gate._disasterEventPending = true;
      } catch(e) { console.warn('[SILENT] GateManager: DisasterGateEvent load failed:', e.message); }
    }

    return gate;
  }

  static rollGateRank(groupAvgRank = 'E') {
    const order = ['F','E','D','C','B','A','S'];
    const idx = order.indexOf(groupAvgRank);
    const roll = Math.random();
    if (roll < 0.30) return order[Math.max(0, idx - 1)];
    if (roll < 0.60) return order[Math.max(0, idx)];
    if (roll < 0.80) return order[Math.min(order.length - 1, idx + 1)];
    if (roll < 0.92) return order[Math.max(0, idx - 2)];
    return 'F';
  }

  static generateBossLoot(rank, count = 5) {
    // Boss drops: primary guaranteed, secondary 35% chance
    const { primary, secondary, boss } = rollBossDrop(rank);
    const loot = [];
    if (primary) loot.push({ name: primary, type: 'material', source: 'boss_primary' });
    if (secondary) loot.push({ name: secondary, type: 'material', source: 'boss_secondary' });
    // Also drop base materials as bonus
    for (let i = 0; i < 2; i++) {
      const mat = rollBaseMaterial(rank);
      if (mat) loot.push({ name: mat, type: 'material', source: 'base' });
    }
    const [minC, maxC] = GATE_RANKS[rank]?.crystalReward || [100, 300];
    loot.push({ name: 'Mana Stones', type: 'currency', amount: Math.floor(minC + Math.random() * (maxC - minC)) });
    return loot;
  }

  // Called when a monster is killed during a raid — returns the drop or null
  static rollMonsterKillDrop(rank, monsterName) {
    const { drop, monster } = rollMonsterDrop(rank, monsterName);
    return drop ? { name: drop, type: 'material', source: 'monster', from: monster?.name || monsterName } : null;
  }

  static purchaseGate(gateId, guildName, leaderJid, db) {
    const gate = this.activeGates[gateId];
    if (!gate) return { success:false, reason:'Gate not found.' };
    if (gate.isFree) return { success:false, reason:'Free gate — no purchase needed.' };
    if (gate.owned) return { success:false, reason:`Already purchased by *${gate.ownedBy}*.` };
    if (gate.broken || gate.cleared) return { success:false, reason:'Gate is no longer active.' };
    const guild = db.guilds?.[guildName];
    if (!guild) return { success:false, reason:'Guild not found.' };
    if ((guild.treasury || 0) < gate.purchasePrice) return { success:false, reason:`Not enough treasury!\nNeed: ${gate.purchasePrice.toLocaleString()} 💎\nHave: ${(guild.treasury||0).toLocaleString()} 💎` };
    guild.treasury -= gate.purchasePrice;
    gate.owned = true; gate.ownedBy = guildName; gate.ownedByLeader = leaderJid; gate.purchasedAt = Date.now();
    return { success:true, gate };
  }

  static applyToRaid(gateId, playerJid, playerRank, db) {
    const gate = this.activeGates[gateId];
    if (!gate) return { success:false, reason:'Gate not found.' };
    if (gate.cleared || gate.broken) return { success:false, reason:'Gate no longer active.' };
    if (gate.raidStarted) return { success:false, reason:'Raid already started.' };
    if (!canEnterGate(playerRank, gate.rank)) return { success:false, reason:`Your rank (${playerRank}) cannot enter a ${gate.rank}-Rank gate.` };
    if (gate.raiders.includes(playerJid)) return { success:false, reason:'Already applied.' };
    if (gate.isFree || !gate.owned) {
      gate.raiders.push(playerJid); gate.externalRaiders.push(playerJid);
      return { success:true, autoAccepted:true, gate };
    }
    gate.pendingApplicants.push({ jid:playerJid, appliedAt:Date.now() });
    return { success:true, autoAccepted:false, gate };
  }

  static acceptRaider(gateId, applicantJid, leaderJid) {
    const gate = this.activeGates[gateId];
    if (!gate) return { success:false, reason:'Gate not found.' };
    if (gate.ownedByLeader !== leaderJid) return { success:false, reason:'Only the gate owner can accept raiders.' };
    const idx = (gate.pendingApplicants||[]).findIndex(a => a.jid === applicantJid);
    if (idx === -1) return { success:false, reason:'Player has not applied.' };
    gate.pendingApplicants.splice(idx, 1);
    gate.raiders.push(applicantJid); gate.externalRaiders.push(applicantJid);
    return { success:true };
  }

  static startRaid(gateId, leaderJid) {
    const gate = this.activeGates[gateId];
    if (!gate) return { success:false, reason:'Gate not found.' };
    if (gate.raidStarted) return { success:false, reason:'Already started.' };
    if (gate.owned && gate.ownedByLeader !== leaderJid) return { success:false, reason:'Only gate owner can start.' };
    if (gate.raiders.length === 0) return { success:false, reason:'No raiders joined.' };
    gate.raidStarted = true; gate.raidStartTime = Date.now(); gate.currentFloor = 1;
    return { success:true, gate };
  }

  static distributeLoot(gateId, db) {
    const gate = this.activeGates[gateId];
    if (!gate || !gate.boss?.defeated) return null;
    const raiders = gate.raiders;
    if (raiders.length === 0) return null;
    const loot = [...gate.bossLoot];
    const distribution = {};
    const currencyItems = loot.filter(i => i.type === 'currency');
    const otherItems = loot.filter(i => i.type !== 'currency');
    const shuffled = otherItems.sort(() => Math.random() - 0.5);
    let idx = 0;
    for (const item of shuffled) {
      const recipient = raiders[idx % raiders.length];
      if (!distribution[recipient]) distribution[recipient] = [];
      distribution[recipient].push(item);
      idx++;
    }
    const totalCrystals = currencyItems.reduce((s, i) => s + (i.amount || 0), 0);
    const guild = gate.ownedBy ? db.guilds?.[gate.ownedBy] : null;
    const guildShare = guild ? Math.floor(totalCrystals * 0.30) : 0;
    if (guild && guild.treasury !== undefined) guild.treasury += guildShare;
    const playerPool = totalCrystals - guildShare;
    const gMembers = gate.guildRaiders.filter(j => raiders.includes(j));
    const extRaiders = gate.externalRaiders.filter(j => raiders.includes(j));
    const gMemberPool = guild ? Math.floor(playerPool * 0.50) : playerPool;
    const extPool = guild ? Math.floor(playerPool * 0.20) : 0;
    const perGuildMember = gMembers.length > 0 ? Math.floor(gMemberPool / gMembers.length) : 0;
    const perExternal = extRaiders.length > 0 ? Math.floor(extPool / extRaiders.length) : 0;
    for (const jid of gMembers) { if (!distribution[jid]) distribution[jid] = []; distribution[jid].push({ type:'currency', name:'Mana Stones', amount:perGuildMember }); if (db.users[jid]) db.users[jid].manaCrystals = (db.users[jid].manaCrystals||0) + perGuildMember; }
    for (const jid of extRaiders) { if (!distribution[jid]) distribution[jid] = []; distribution[jid].push({ type:'currency', name:'Mana Stones', amount:perExternal }); if (db.users[jid]) db.users[jid].manaCrystals = (db.users[jid].manaCrystals||0) + perExternal; }
    for (const [jid, items] of Object.entries(distribution)) {
      const player = db.users[jid]; if (!player) continue;
      if (!player.inventory) player.inventory = { weapons:[], armor:[], potions:[], artifacts:[], accessories:[], materials:[], keyStones:[] };
      for (const item of items) {
        if (item.type === 'currency') continue;
        // All gate drops are now raw materials
        if (!player.inventory.materials) player.inventory.materials = [];
        player.inventory.materials.push({ name: item.name, source: item.source || 'gate', obtainedAt: Date.now() });
      }
    }
    gate.lootDistributed = true; gate.distribution = distribution;
    return distribution;
  }

  static clearGate(gateId, db) {
    const gate = this.activeGates[gateId]; if (!gate) return null;
    gate.cleared = true; gate.active = false; gate.clearedAt = Date.now();
    for (const jid of gate.raiders) { const p = db.users[jid]; if (p) { if (!p.stats_history) p.stats_history = {}; p.stats_history.gatesCleared = (p.stats_history.gatesCleared || 0) + 1; } }
    return gate;
  }

  static checkGateBreaks(chatId, sock) {
    for (const gateId of (this.gatesByChat[chatId] || [])) {
      const gate = this.activeGates[gateId];
      if (!gate || gate.cleared || gate.broken) continue;
      if (Date.now() >= gate.breakTime) {
        gate.broken = true; gate.active = false;
        if (sock) {
          const txt = gate.isDisaster
            ? `🌑 *DISASTER GATE BREAK!*\nThe ${gate.rank}-Rank gate was left uncleared.\nMonsters are pouring out. Catastrophic event active!`
            : `💥 *GATE BREAK!*\nThe ${gate.rank}-Rank gate [${gate.id}] was not cleared in time and has shattered.`;
          sock.sendMessage(chatId, { text: txt });
        }
      }
    }
  }

  static getActiveGatesForChat(chatId) {
    return (this.gatesByChat[chatId] || []).map(id => this.activeGates[id]).filter(g => g && g.active && !g.cleared && !g.broken);
  }

  static getGate(gateId) { return this.activeGates[gateId] || null; }

  static formatGate(gate) {
    const rd = gate.rankData || GATE_RANKS[gate.rank];
    const timeLeft = Math.max(0, gate.breakTime - Date.now());
    const h = Math.floor(timeLeft / 3600000);
    const m = Math.floor((timeLeft % 3600000) / 60000);
    return [
      `${rd.emoji} *${rd.label}* [${gate.id}]`,
      `🕐 Breaks in: ${h}h ${m}m`,
      gate.isFree ? `🆓 FREE GATE — Anyone can enter!` : ``,
      gate.isDisaster ? `⚠️ DISASTER LEVEL — S-Rank only!` : ``,
      gate.owned ? `🏰 Owned by: *${gate.ownedBy}*` : `💰 Buy: ${gate.purchasePrice.toLocaleString()} 💎`,
      `👥 Raiders: ${gate.raiders.length}`,
      gate.raidStarted ? `⚔️ Raid in progress` : `📋 Accepting applications`,
    ].filter(Boolean).join('\n');
  }
}

module.exports = { GateManager, GATE_RANKS, LOOT_TABLES, GATE_MONSTERS, GATE_BOSSES };

// ─── GATE ANNOUNCEMENT (called by auto-spawner in index.js) ──────
GateManager.formatGateAnnouncement = function(gate) {
  const rd = GATE_RANKS[gate.rank] || GATE_RANKS['E'];
  const timeLeft = Math.floor((gate.breakTime - Date.now()) / 60000);
  const isRare = ['A','S','DISASTER'].includes(gate.rank);

  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    gate.isDisaster
      ? `⚠️ ‼️ *DISASTER GATE APPEARED* ‼️ ⚠️`
      : isRare
        ? `‼️ *RARE GATE DETECTED* ‼️`
        : `${rd.emoji} *GATE HAS APPEARED*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `「System」 A ${gate.isDisaster ? 'Disaster-class' : `${gate.rank}-Rank`} gate has opened in this area.`,
    ``,
    `🔑 Gate ID: *${gate.id}*`,
    `${rd.emoji} Rank: *${rd.label}*`,
    gate.isFree ? `🆓 *FREE GATE — No guild needed*` : `💰 Purchase: *${gate.purchasePrice.toLocaleString()} 💎*`,
    `⏰ Breaks in: *${timeLeft} minutes*`,
    ``,
    rd.description,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    !gate.isFree ? `/gates buy ${gate.id} — Guild leaders claim` : ``,
    `/gates apply ${gate.id} — Apply to join the raid`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].filter(l => l !== null && l !== '').join('\n');
};
