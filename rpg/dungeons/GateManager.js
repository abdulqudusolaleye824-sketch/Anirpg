// ═══════════════════════════════════════════════════════════════
// GATE MANAGER — Solo Leveling Edition
// Gates spawn in group chats. Guilds buy them. Players raid them.
// Low-tier (E, D, C) cost Nexus. High-tier (B, A, S) cost Nexus AND Mana Stones.
// ═══════════════════════════════════════════════════════════════

const path = require('path');
const fs   = require('fs');

const { MONSTER_DROPS, BASE_MATERIALS, rollMonsterDrop, rollBossDrop, rollBaseMaterial, getRandomMonster, getRandomBoss } = require('../data/MonsterDrops');

const SL = require('../data/SoloLevelingMonsters');

// Push #71 — GATE STRENGTH. Every gate rolls a strength 60–100 % of the
// strongest possible gate of its rank. 100 % = max HP roll for every monster,
// tier-5 Solo Leveling monsters allowed, boss at full HP. Lower % = weaker
// pool + scaled HP, so a fresh E-rank party can clear a 65 % E gate while a
// 100 % E gate needs a full squad. The % is shown on every gate/party screen.
function rollGateStrength() {
  // Bell-ish: mostly 70–90, occasional 60 / 100.
  const r = (Math.random() + Math.random()) / 2;
  return Math.max(60, Math.min(100, Math.round(60 + r * 40)));
}
function strengthLabel(pct) {
  if (pct >= 140) return '☠️ NIGHTMARE';
  if (pct >= 120) return '🔴 Severe';
  if (pct >= 100) return '🟠 Hard';
  if (pct >= 85) return '🟡 Standard';
  if (pct >= 65) return '🟢 Mild';
  return '🟢 Mild';
}
// Push #80: before a raid starts the % is the spawn roll (60–100). Once the
// party enters, it becomes the SEVERITY actually applied to monster stats
// (70–160%), so what the card says is what the monsters hit like.
function strengthText(rank, pct, gate = null) {
  const cal = gate && gate.calibrated;
  if (cal) return `${rank} rank gate ${pct}% — ${cal.label} · monsters ×${cal.severity} HP/ATK/DEF (${gate.severityNote || 'calibrated to party'})`;
  return `${rank} rank gate ${pct}% — ${strengthLabel(pct)}${pct >= 100 ? ` (strongest possible ${rank}-rank gate)` : ''} · final severity set by party strength at launch`;
}
// Shared by spawnGate() and GateRaid.reconstruct(): same monsters everywhere.
function buildGateMonsters(rank, floors, strengthPct = 100) {
  const rd = GATE_RANKS[rank] || GATE_RANKS.E;
  const [minHp, maxHp] = rd.monsterRange || [15, 45];
  const scale = Math.max(0.6, Math.min(1, strengthPct / 100));
  const monsters = [];
  const count = floors * 3;
  for (let i = 0; i < count; i++) {
    const floor = Math.floor(i / 3) + 1;
    const m = SL.pickForStrength(rank, strengthPct);
    const prof = SL.ROLE_PROFILE[m.role] || SL.ROLE_PROFILE.brute;
    // Deeper floors + higher tier + gate strength push the HP roll upward.
    const floorBias = (floor - 1) / Math.max(1, floors - 1);            // 0..1
    const tierBias  = (m.tier - 1) / 4;                                   // 0..1
    const roll = Math.random() * 0.5 + floorBias * 0.25 + tierBias * 0.25; // 0..1
    const baseHp = Math.floor((minHp + roll * (maxHp - minHp)) * scale);
    const hp = Math.max(5, Math.floor(baseHp * prof.hp));
    monsters.push({
      name: m.name, role: m.role, tier: m.tier,
      hp, maxHp: hp,
      atk: Math.max(1, Math.floor(baseHp * prof.atk)),
      def: Math.floor(baseHp * prof.def),
      speed: Math.round(10 * prof.speed),
      skills: m.skills,
      floor, defeated: false,
    });
  }
  return monsters;
}

const GATE_RANKS = {
  E: { emoji:'⚫', label:'E-Rank Gate', floors:3, monsterRange:[15,45], bossHp:400,   priceRange:[3000,6000],      manaPriceRange:[0,0],        currency:'nexus', currencySafe:[800,1400], lootTier:'common',    isFree:false, description:'Standard low-tier gate. Costs Nexus.' },
  D: { emoji:'🟤', label:'D-Rank Gate', floors:4, monsterRange:[45,105], bossHp:1000,  priceRange:[8000,16000],     manaPriceRange:[0,0],        currency:'nexus', currencySafe:[2000,3600], lootTier:'uncommon',  isFree:false, description:'Mid-low tier. Costs Nexus.' },
  C: { emoji:'🔵', label:'C-Rank Gate', floors:5, monsterRange:[105,210], bossHp:2500, priceRange:[20000,40000],    manaPriceRange:[0,0],        currency:'nexus', currencySafe:[5000,9000], lootTier:'rare',     isFree:false, description:'Mid tier. Costs Nexus.' },
  B: { emoji:'🟢', label:'B-Rank Gate', floors:6, monsterRange:[210,360], bossHp:6000, priceRange:[50000,100000], manaPriceRange:[100,300],   currency:'both',  currencySafe:[12000,22000], lootTier:'rare',    isFree:false, description:'High tier. Requires Nexus AND Mana Stones.' },
  A: { emoji:'🟡', label:'A-Rank Gate', floors:7, monsterRange:[360,600], bossHp:15000, priceRange:[150000,300000], manaPriceRange:[30000,50000], currency:'both',  currencySafe:[36000,68000], lootTier:'epic',   isFree:false, description:'Elite tier. Requires Nexus AND Mana Stones.' },
  S: { emoji:'🔴', label:'S-Rank Gate', floors:8, monsterRange:[600,1200], bossHp:40000, priceRange:[500000,1000000], manaPriceRange:[55000,105000], currency:'both', currencySafe:[120000,220000], lootTier:'legendary', isFree:false, description:'National-level threat. Requires Nexus AND Mana Stones.' },
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

    // Clearing a gate pays 3–4× what it cost to open (was 2–4×), and the
    // multiplier is applied to EACH currency actually spent — a B/A/S gate
    // burns Mana Stones as well as Nexus, so both must come back multiplied.
    const lootMultiplier = 3 + Math.random(); // 3.00×–3.99×
    // Each currency comes back at 3–4× of what was PAID in it. Ranks that
    // also burn Mana Stones therefore pay both lines multiplied; ranks that
    // cost Nexus only keep the old 25%-of-pool stone kicker as pure bonus on
    // top of the 3–4× Nexus.
    let nexusLoot, crystalLoot;
    if (isBoth && manaPrice > 0) {
      nexusLoot   = Math.floor(purchasePrice * lootMultiplier);
      crystalLoot = Math.floor(manaPrice * lootMultiplier);
    } else {
      nexusLoot   = Math.floor(purchasePrice * lootMultiplier);
      crystalLoot = Math.floor(purchasePrice * lootMultiplier * 0.25);
    }

    // Push #71: Solo Leveling bestiary + gate strength %.
    const strengthPct = rollGateStrength();
    const monsters = buildGateMonsters(rank, rankData.floors, strengthPct);
    const bossHp = Math.floor(rankData.bossHp * Math.max(0.6, strengthPct / 100));

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
      strengthPct, strengthLabel: strengthLabel(strengthPct),
      currentFloor: 0, totalFloors: rankData.floors, monsters,
      boss: { name: bossName, hp: bossHp, maxHp: bossHp, defeated: false },
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
    // Push #68: +4.9% to the S-rank gate roll (5% → 9.9%), funded by C-rank
    // gates (35% → 30.1%). Distribution still sums to 100%.
    if (roll < 0.099) return 'S';      // 9.9%
    if (roll < 0.249) return 'A';      // 15%
    if (roll < 0.499) return 'B';      // 25%
    if (roll < 0.80)  return 'C';      // 30.1%
    if (roll < 0.90)  return 'D';      // 10%
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
    // Push #71: bestiary monsters drop their own craft materials (45%).
    const sl = SL.SL_BY_NAME[monsterName];
    if (sl) {
      if (Math.random() > 0.45) return null;
      const name = sl.drops[Math.floor(Math.random() * sl.drops.length)];
      const rarity = { E: 'common', D: 'uncommon', C: 'rare', B: 'rare', A: 'epic', S: 'legendary' }[sl.rank] || 'common';
      return { name, type: 'material', source: 'monster', from: monsterName, rarity };
    }
    const { drop, monster } = rollMonsterDrop(rank, monsterName);
    return drop ? { name: drop, type: 'material', source: 'monster', from: monster?.name || monsterName } : null;
  }

  static purchaseGate(gateId, guildName, leaderJid, db) {
    const gate = this.activeGates[gateId];
    if (!gate) return { success:false, reason:'Gate not found.' };
    if (gate.owned) return { success:false, reason:`Already purchased by *${gate.ownedBy}*.` };
    if (gate.broken || gate.cleared) return { success:false, reason:'Gate is no longer active.' };
    const guild = require('../utils/GuildContractManager').findGuild(db, guildName); // Push #71: guilds are keyed by id, not name
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

  // Batch-50: statics die on restart — revive every non-cleared persisted
  // gate/raid from db.activeGates so a redeploy resumes exactly where it
  // stopped. Restored as-is (no time judgment here): break/penalty logic
  // runs at the next touch exactly as if no restart happened.
  static rehydrateFromDb(db) {
    let n = 0;
    try {
      for (const gate of Object.values((db && db.activeGates) || {})) {
        if (!gate || !gate.id || gate.cleared) continue;
        if (this.activeGates[gate.id]) continue;
        this.activeGates[gate.id] = gate;
        for (const c of [gate.chatId].filter(Boolean)) {
          if (!this.gatesByChat[c]) this.gatesByChat[c] = [];
          if (!this.gatesByChat[c].includes(gate.id)) this.gatesByChat[c].push(gate.id);
        }
        n++;
      }
    } catch (e) {}
    if (n) console.log(`[GATE] Rehydrated ${n} gate(s)/raid(s) from DB`);
    return n;
  }

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
    gate.strengthPct ? `💪 Strength: *${strengthText(gate.rank, gate.strengthPct, gate)}*` : null,
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

// Push #71 exports
GateManager.rollGateStrength = rollGateStrength;
GateManager.strengthLabel = strengthLabel;
GateManager.strengthText = strengthText;
GateManager.buildGateMonsters = buildGateMonsters;

module.exports = { GateManager, GATE_RANKS, LOOT_TABLES, GATE_MONSTERS, GATE_BOSSES, rollGateStrength, strengthLabel, strengthText, buildGateMonsters };
