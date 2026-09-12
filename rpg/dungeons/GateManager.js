// ═══════════════════════════════════════════════════════════════
// GATE MANAGER — Solo Leveling Edition
// Gates spawn in group chats. Guilds buy them. Players raid them.
// Low-tier (E, D, C) cost Nexus. High-tier (B, A, S) cost Nexus AND Mana Stones.
// ═══════════════════════════════════════════════════════════════

const path = require('path');
const fs   = require('fs');

const { MONSTER_DROPS, BASE_MATERIALS, rollMonsterDrop, rollBossDrop, rollBaseMaterial, getRandomMonster, getRandomBoss } = require('../data/MonsterDrops');

const GATE_RANKS = {
  E: { emoji:'⚫', label:'E-Rank Gate', floors:3, monsterRange:[15,45], bossHp:400,   priceRange:[3000,6000],      manaPriceRange:[0,0],        currency:'nexus', currencySafe:[800,1400], lootTier:'common',    isFree:false, description:'Standard low-tier gate. Costs Nexus.' },
  D: { emoji:'🟤', label:'D-Rank Gate', floors:4, monsterRange:[45,105], bossHp:1000,  priceRange:[8000,16000],     manaPriceRange:[0,0],        currency:'nexus', currencySafe:[2000,3600], lootTier:'uncommon',  isFree:false, description:'Mid-low tier. Costs Nexus.' },
  C: { emoji:'🔵', label:'C-Rank Gate', floors:5, monsterRange:[105,210], bossHp:2500, priceRange:[20000,40000],    manaPriceRange:[0,0],        currency:'nexus', currencySafe:[5000,9000], lootTier:'rare',     isFree:false, description:'Mid tier. Costs Nexus.' },
  B: { emoji:'🟢', label:'B-Rank Gate', floors:6, monsterRange:[210,360], bossHp:6000, priceRange:[50000,100000], manaPriceRange:[100,300],   currency:'both',  currencySafe:[12000,22000], lootTier:'rare',    isFree:false, description:'High tier. Requires Nexus AND Mana Stones.' },
  A: { emoji:'🟡', label:'A-Rank Gate', floors:7, monsterRange:[360,600], bossHp:15000, priceRange:[150000,300000], manaPriceRange:[500,1200], currency:'both',  currencySafe:[36000,68000], lootTier:'epic',   isFree:false, description:'Elite tier. Requires Nexus AND Mana Stones.' },
  S: { emoji:'🔴', label:'S-Rank Gate', floors:8, monsterRange:[600,1200], bossHp:40000, priceRange:[500000,1000000], manaPriceRange:[2000,5000], currency:'both', currencySafe:[120000,220000], lootTier:'legendary', isFree:false, description:'National-level threat. Requires Nexus AND Mana Stones.' },
};

const LOOT_TABLES = {};
const GATE_MONSTERS = Object.fromEntries(Object.entries(MONSTER_DROPS).map(([r, v]) => [r, v.monsters.map(m => m.name)]));
const GATE_BOSSES  = Object.fromEntries(Object.entries(MONSTER_DROPS).map(([r, v]) => [r, v.bosses.map(b => b.name)]));

class GateManager {
  static activeGates = {};
  static gatesByChat = {};
  static gateCounter = 1;
  static GATE_BREAK_TIME = 26 * 60 * 60 * 1000;
  static FREE_GATE_CHANCE = 0.00;
  static DISASTER_CHANCE = 0.00; // Disaster rank gates disabled

  static getGateImage(rank) {
    const r = (rank || 'E').toUpperCase();
    const rankFile = `${r.toLowerCase()}_rank.jpg`;
    const specificPath = path.join(__dirname, '..', '..', 'assets', 'gates', rankFile);
    if (fs.existsSync(specificPath)) return specificPath;

    const file = r === 'S'                ? 's_rank.jpg'
               : (r === 'A' || r === 'B') ? 'ab_rank.jpg'
               :                            'cde_rank.jpg';
    return path.join(__dirname, '..', '..', 'assets', 'gates', file);
  }

  static spawnGate(chatId, groupAverageRank = 'E') {
    const gateId = `G-${Date.now()}-${this.gateCounter++}`;
    const rank = this.rollGateRank(groupAverageRank);
    const rankData = GATE_RANKS[rank] || GATE_RANKS['E'];
    const isFree = false;
    const isBoth = ['B','A','S'].includes(rank);
    const currency = isBoth ? 'both' : 'nexus';

    const pool = MONSTER_DROPS[rank]?.monsters || MONSTER_DROPS['E'].monsters;
    const bossPool = MONSTER_DROPS[rank]?.bosses || MONSTER_DROPS['E'].bosses;
    const bossData = bossPool[Math.floor(Math.random() * bossPool.length)];
    const bossName = bossData.name;

    const [pMin, pMax] = rankData.priceRange || [0, 0];
    const purchasePrice = Math.floor(pMin + Math.random() * (pMax - pMin));

    const [mMin, mMax] = rankData.manaPriceRange || [0, 0];
    const manaPrice = Math.floor(mMin + Math.random() * (mMax - mMin));

    const lootMultiplier = 2 + Math.random() * 2;
    const totalLootPct = Math.floor(purchasePrice * lootMultiplier);
    const nexusLoot   = Math.floor(totalLootPct * 0.75);
    const crystalLoot = Math.floor(totalLootPct * 0.25);

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
      currency,
      isFree, isDisaster: false, owned: false, ownedBy: null, ownedByLeader: null,
      purchasedAt: null, purchasePrice, manaPrice,
      nexusLoot, crystalLoot, lootMultiplier,
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

    return gate;
  }

  static rollGateRank(groupAvgRank = 'E') {
    const roll = Math.random();
    if (roll < 0.05) return 'S';       // 5%
    if (roll < 0.20) return 'A';       // 15%
    if (roll < 0.45) return 'B';       // 25%
    if (roll < 0.80) return 'C';       // 35%
    if (roll < 0.90) return 'D';       // 10%
    return 'E';                        // 10%
  }

  static generateBossLoot(rank, count = 5) {
    const { primary, secondary, boss } = rollBossDrop(rank);
    const loot = [];
    if (primary) loot.push({ name: primary, type: 'material', source: 'boss_primary' });
    if (secondary) loot.push({ name: secondary, type: 'material', source: 'boss_secondary' });
    for (let i = 0; i < 2; i++) {
      const mat = rollBaseMaterial(rank);
      if (mat) loot.push({ name: mat, type: 'material', source: 'base' });
    }
    return loot;
  }

  static rollMonsterKillDrop(rank, monsterName) {
    const { drop, monster } = rollMonsterDrop(rank, monsterName);
    return drop ? { name: drop, type: 'material', source: 'monster', from: monster?.name || monsterName } : null;
  }

  static purchaseGate(gateId, guildName, leaderJid, db) {
    const gate = this.activeGates[gateId];
    if (!gate) return { success:false, reason:'Gate not found.' };
    if (gate.owned) return { success:false, reason:`Already purchased by *${gate.ownedBy}*.` };
    if (gate.broken || gate.cleared) return { success:false, reason:'Gate is no longer active.' };
    const guild = db.guilds?.[guildName];
    if (!guild) return { success:false, reason:'Guild not found.' };

    const isBoth = gate.currency === 'both' || ['B','A','S'].includes(gate.rank);
    if (isBoth) {
      if ((guild.treasury || 0) < gate.purchasePrice || (guild.manaTreasury || 0) < (gate.manaPrice || 0)) {
        return {
          success: false,
          reason: `Not enough guild treasury!\nNeed: ${gate.purchasePrice.toLocaleString()} 💠 Nexus AND ${gate.manaPrice.toLocaleString()} 💎 Mana Stones\nHave: ${(guild.treasury||0).toLocaleString()} 💠 Nexus & ${(guild.manaTreasury||0).toLocaleString()} 💎 Mana Stones`
        };
      }
      guild.treasury -= gate.purchasePrice;
      guild.manaTreasury -= gate.manaPrice;
    } else {
      if ((guild.treasury || 0) < gate.purchasePrice) {
        return {
          success: false,
          reason: `Not enough Nexus in treasury!\nNeed: ${gate.purchasePrice.toLocaleString()} 💠 Nexus\nHave: ${(guild.treasury||0).toLocaleString()} 💠 Nexus`
        };
      }
      guild.treasury -= gate.purchasePrice;
    }

    gate.owned = true;
    gate.purchased = true;
    gate.active = false;
    gate.ownedBy = guildName;
    gate.ownedByLeader = leaderJid;
    gate.purchasedAt = Date.now();
    return { success:true, gate };
  }

  static getActiveGatesForChat(chatId) {
    return (this.gatesByChat[chatId] || [])
      .map(id => this.activeGates[id])
      .filter(g => g && g.active && !g.cleared && !g.broken && !g.owned && !g.purchased);
  }

  static killActiveGates(chatId) {
    let count = 0;
    if (chatId && chatId.endsWith('@g.us')) {
      const gateIds = this.gatesByChat[chatId] || [];
      for (const id of gateIds) {
        const g = this.activeGates[id];
        if (g && g.active && !g.cleared && !g.owned) {
          g.active = false;
          g.broken = true;
          count++;
        }
      }
      this.gatesByChat[chatId] = [];
    } else {
      for (const g of Object.values(this.activeGates)) {
        if (g && g.active && !g.cleared) {
          g.active = false;
          g.broken = true;
          count++;
        }
      }
      this.activeGates = {};
      this.gatesByChat = {};
    }
    return count;
  }

  static getGate(gateId) { return this.activeGates[gateId] || null; }

  static checkGateBreaks(chatId, sock) {
    for (const gateId of (this.gatesByChat[chatId] || [])) {
      const gate = this.activeGates[gateId];
      if (!gate || gate.cleared || gate.broken) continue;
      if (gate.purchased || gate.owned) continue; // FIX: purchased gates governed by key expiry, not break time (fixes codes expiring early)
      if (Date.now() >= gate.breakTime) {
        gate.broken = true; gate.active = false;
        if (sock) {
          const txt = `💥 *GATE BREAK!*\nThe ${gate.rank}-Rank gate [${gate.id}] was not cleared in time and has shattered.`;
          sock.sendMessage(chatId, { text: txt });
        }
      }
    }
  }

  static clearGate(gateId, db) {
    try { if (db && db.activeGates) delete db.activeGates[gateId]; } catch (e) {} // batch-47: drop persisted raid
    const gate = this.activeGates[gateId]; if (!gate) return null;
    gate.cleared = true; gate.active = false; gate.clearedAt = Date.now();
    for (const jid of gate.raiders) { const p = db.users[jid]; if (p) { if (!p.stats_history) p.stats_history = {}; p.stats_history.gatesCleared = (p.stats_history.gatesCleared || 0) + 1; } }
    return gate;
  }

  static formatGate(gate) {
    const rd = gate.rankData || GATE_RANKS[gate.rank];
    const timeLeft = Math.max(0, gate.breakTime - Date.now());
    const h = Math.floor(timeLeft / 3600000);
    const m = Math.floor((timeLeft % 3600000) / 60000);
    const isBoth = gate.currency === 'both' || ['B','A','S'].includes(gate.rank);
    const priceTxt = `${gate.purchasePrice.toLocaleString()} 💠 Nexus` + (isBoth ? ` + ${gate.manaPrice.toLocaleString()} 💎 Mana` : '');
    return [
      `${rd.emoji} *${rd.label}* [${gate.id}]`,
      `🕐 Breaks in: ${h}h ${m}m`,
      gate.owned ? `🏰 Owned by: *${gate.ownedBy}*` : `💰 Price: ${priceTxt}`,
      `🛒 Command: Reply with */gate buy*`,
      `👥 Raiders: ${gate.raiders.length}`,
      gate.raidStarted ? `⚔️ Raid in progress` : `📋 Guild / Affiliate Gate`,
    ].filter(Boolean).join('\n');
  }
}

GateManager.formatGateAnnouncement = function(gate) {
  const rd = GATE_RANKS[gate.rank] || GATE_RANKS['E'];
  const timeLeft = Math.floor((gate.breakTime - Date.now()) / 60000);
  const isRare = ['A','S'].includes(gate.rank);
  const isBoth = gate.currency === 'both' || ['B','A','S'].includes(gate.rank);
  const priceTxt = `${gate.purchasePrice.toLocaleString()} 💠 Nexus` + (isBoth ? ` + ${gate.manaPrice.toLocaleString()} 💎 Mana Stones` : '');

  const caption = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    isRare ? `‼️ *RARE GATE DETECTED* ‼️` : `${rd.emoji} *GATE HAS APPEARED*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `「System」 A ${gate.rank}-Rank gate has opened in this area.`,
    ``,
    `🔑 Gate ID: *${gate.id}*`,
    `${rd.emoji} Rank: *${rd.label}*`,
    `💰 Guild Purchase: *${priceTxt}*`,
    `⏰ Breaks in: *${timeLeft} minutes*`,
    ``,
    rd.description,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🛒 *BUY COMMAND:* Reply to this message with */gate buy*`,
    `🛡️ *(Guild Officers or Granted Affiliates only)*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].filter(Boolean).join('\n');

  const imagePath = GateManager.getGateImage(gate.rank);
  if (fs.existsSync(imagePath)) {
    return {
      image: fs.readFileSync(imagePath),
      mimetype: 'image/jpeg',
      caption
    };
  }

  return { text: caption };
};

module.exports = { GateManager, GATE_RANKS, LOOT_TABLES, GATE_MONSTERS, GATE_BOSSES };
