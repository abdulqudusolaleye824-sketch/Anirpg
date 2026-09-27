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
// Push #88t — MONSTER FAMILIES. A gate has ONE theme (derived from its boss)
// and every floor is populated from that family only: no Razor Ants in a
// Lycan den, no slimes under a Dragon. Names that match no family are
// "wild" and may appear anywhere. Order matters: first match wins.
const MONSTER_FAMILIES = [
  { id: 'insect',    re: /\b(ants?|spider|centipede|beetle|moth|crab|crawler|scorpion|wasp|mantis|beru|querehsha|hive)\b/i },
  { id: 'goblinoid', re: /\b(goblin|hobgoblin|orc|kobold|ogre|troll|gnoll|imp|kargalgan|baruka|giant)\b/i },
  { id: 'beast',     re: /\b(wolf|wolves|lycan|hound|bear|boar|rabbit|cerberus|beast|bloodhound|yeti|rakan|lion|tiger|fox|rat|bat)\b/i },
  { id: 'undead',    re: /\b(skeleton|ghoul|wraith|bone|grave|vampire|hollow|shade|remnant|igris|bellion|blood moon|lich|zombie|revenant)\b/i },
  { id: 'reptile',   re: /\b(lizard|lizardman|kasaka|naga|basilisk|drake|wyvern|dragon|kamish|antares|leviathan|turtle|wyrm|wyrmling|serpent|snake|kaisel|toad)\b/i },
  { id: 'construct', re: /\b(golem|titan|gargoyle|steel|cataclysm|kandiaru|iron body|statue|sentinel|colossus|juggernaut)\b/i },
  { id: 'demon',     re: /\b(demon|vulcan|metus|baran|greed|abyss|void|chaos|catastrophe|infernal|hell|devil|world ender|god|plague)\b/i },
  { id: 'elf',       re: /\b(elf|elves|legia|harpy)\b/i },
  { id: 'slime',     re: /\b(slime)\b/i },
];
// Modifier prefixes that never change what a monster IS ("Fallen Vulcan Demon Noble" is a demon).
const MOD_PREFIX_RE = /^(?:(?:Elite|Fallen|Awakened|Ancient|Greater|Alpha|Cursed|Feral|Venomous|Abyssal|Toxic|Monarch-Touched|Elder|Crystal|Frost|Blood|Shadow|Void|Dark|Corrupted|Prime|Royal|Iron|Storm|Ice|Stone|Steel|Steel-Fanged|Venom-Fanged|Blue|Giant|Ember|Cave|Bone|Rabid|Wild|Dire)\s+)+/i;
function stripMods(name) { const n = String(name || '').trim(); const s = n.replace(MOD_PREFIX_RE, '').trim(); return s || n; }
function monsterFamily(name) {
  const n = stripMods(name);
  for (const f of MONSTER_FAMILIES) if (f.re.test(n)) return f.id;
  // second pass on the full name (e.g. "Stone Golem Fragment" → stripped "Golem Fragment" already matched; "Ice Wolf" → beast)
  const full = String(name || '');
  for (const f of MONSTER_FAMILIES) if (f.re.test(full)) return f.id;
  return null; // wild
}
// Families that may share a gate when a rank has too few monsters of the boss's family.
const FAMILY_ALLIES = {
  goblinoid: ['beast'], beast: ['goblinoid'], undead: ['demon'], demon: ['undead'],
  reptile: ['construct'], construct: ['reptile'], elf: ['beast'], slime: ['goblinoid'], insect: [],
};
function themedPool(rank, theme) {
  const list = SL.SL_MONSTERS[rank] || SL.SL_MONSTERS.E;
  if (!theme) return list;
  const wild = list.filter(m => monsterFamily(m.name) === null);
  let pool = list.filter(m => monsterFamily(m.name) === theme);
  if (pool.length < 4) for (const ally of (FAMILY_ALLIES[theme] || [])) pool = pool.concat(list.filter(m => monsterFamily(m.name) === ally));
  if (pool.length < 4) pool = pool.concat(wild);
  // Never let the boss's family be missing entirely: fall back to the full list minus insects
  // (insects are the one family that must never leak into other themes).
  if (pool.length < 4) pool = list.filter(m => theme === 'insect' || monsterFamily(m.name) !== 'insect');
  return pool.length ? pool : list;
}
function pickThemed(pool, strengthPct) {
  const maxTier = strengthPct >= 95 ? 5 : strengthPct >= 85 ? 4 : strengthPct >= 70 ? 3 : 2;
  let p = pool.filter(m => m.tier <= maxTier);
  if (!p.length) p = pool;
  const weighted = p.flatMap(m => Array(m.tier).fill(m));
  return weighted[Math.floor(Math.random() * weighted.length)] || pool[0];
}
// Push #88t: pick the gate's theme FIRST (weighted by how many monsters of
// that family the rank has), then a boss of the same family — from the boss
// table when one exists, otherwise the theme's apex monster is crowned.
const FAMILY_TITLES = { beast: 'Alpha', goblinoid: 'Chieftain', undead: 'Lich Lord', reptile: 'Elder', construct: 'Colossus', demon: 'Overlord', elf: 'Monarch', slime: 'King', insect: 'Queen' };
function pickGateTheme(rank, bossPool) {
  const list = SL.SL_MONSTERS[rank] || SL.SL_MONSTERS.E;
  const counts = {};
  for (const m of list) { const f = monsterFamily(m.name); if (f) counts[f] = (counts[f] || 0) + 1; }
  const options = Object.entries(counts).filter(([, n]) => n >= 4);
  const bosses = Array.isArray(bossPool) ? bossPool : [];
  if (!options.length) { const b = bosses[Math.floor(Math.random() * bosses.length)] || { name: 'Gate Warden' }; return { theme: monsterFamily(b.name), boss: { ...b, baseName: b.name } }; }
  const total = options.reduce((a, [, n]) => a + n, 0);
  let r = Math.random() * total, theme = options[0][0];
  for (const [f, n] of options) { r -= n; if (r <= 0) { theme = f; break; } }
  const matching = bosses.filter(b => monsterFamily(b.name) === theme);
  if (matching.length) { const b = matching[Math.floor(Math.random() * matching.length)]; return { theme, boss: { ...b, baseName: b.name } }; }
  const fam = list.filter(m => monsterFamily(m.name) === theme);
  const top = Math.max(...fam.map(m => m.tier || 1));
  const apex = fam.filter(m => (m.tier || 1) === top);
  const base = apex[Math.floor(Math.random() * apex.length)] || fam[0];
  const stripped = (String(base.name).replace(/^(?:(?:Elite|Fallen|Awakened|Ancient|Greater|Alpha|Cursed|Feral|Venomous|Abyssal|Toxic|Monarch-Touched|Elder)\s+)+/i, '').trim() || base.name).replace(/\s+(Alpha|Apex)$/i, '');
  const hasTitle = /\b(Lord|King|Queen|Monarch|Avatar|Sovereign|Emperor|Overlord|Chief|Chieftain|Commander|Colossus|Titan|Matriarch|Broodmother|Alpha|Elder|Warden|Lich)\b/i.test(stripped);
  return { theme, boss: { name: hasTitle ? `Apex ${stripped}` : `${stripped} ${FAMILY_TITLES[theme] || 'Lord'}`, baseName: base.name, synthetic: true } };
}
const ELITE_MULT = 1.5;
function _power(m) { return (m.maxHp || m.hp || 0) + (m.atk || 0) * 3 + (m.def || 0) * 2; }
// Push #88t: monsters within a floor are fought weakest → strongest.
function orderFloors(monsters) {
  return monsters.slice().sort((a, b) => (a.floor - b.floor) || (a.elite ? 1 : 0) - (b.elite ? 1 : 0) || _power(a) - _power(b));
}
function buildGateMonsters(rank, floors, strengthPct = 100, bossName = null) {
  const rd = GATE_RANKS[rank] || GATE_RANKS.E;
  const [minHp, maxHp] = rd.monsterRange || [15, 45];
  const scale = Math.max(0.6, Math.min(1, strengthPct / 100));
  const theme = bossName ? monsterFamily(bossName) : null;
  const pool = themedPool(rank, theme);
  const monsters = [];
  const make = (m, floor, elite) => {
    const prof = SL.ROLE_PROFILE[m.role] || SL.ROLE_PROFILE.brute;
    // Deeper floors + higher tier + gate strength push the HP roll upward.
    const floorBias = (floor - 1) / Math.max(1, floors - 1);            // 0..1
    const tierBias  = (m.tier - 1) / 4;                                   // 0..1
    const roll = Math.random() * 0.5 + floorBias * 0.25 + tierBias * 0.25; // 0..1
    const baseHp = Math.floor((minHp + roll * (maxHp - minHp)) * scale) * (elite ? ELITE_MULT : 1);
    const hp = Math.max(5, Math.floor(baseHp * prof.hp));
    return {
      name: elite ? `${/^Elite\b/i.test(m.name) ? '' : 'Elite '}${m.name}${/\bSoldier$/i.test(m.name) ? '' : ' Soldier'}` : m.name, role: m.role, tier: m.tier,
      hp, maxHp: hp,
      atk: Math.max(1, Math.floor(baseHp * prof.atk)),
      def: Math.floor(baseHp * prof.def),
      speed: Math.round(10 * prof.speed * (elite ? 1.2 : 1)),
      skills: m.skills,
      floor, defeated: false,
      family: theme || monsterFamily(m.name) || 'wild',
      ...(elite ? { elite: true } : {}),
    };
  };
  for (let floor = 1; floor <= floors; floor++) {
    for (let j = 0; j < 3; j++) monsters.push(make(pickThemed(pool, strengthPct), floor, false));
  }
  // Push #88t: the boss floor is guarded by 2 ELITE SOLDIERS (strongest tier of the theme, ×1.5).
  const topTier = Math.max(...pool.map(m => m.tier || 1));
  const eliteBase = pool.filter(m => (m.tier || 1) >= Math.max(1, topTier - 1));
  for (let j = 0; j < 2; j++) monsters.push(make(eliteBase[Math.floor(Math.random() * eliteBase.length)] || pool[0], floors, true));
  return orderFloors(monsters);
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
    const themed = pickGateTheme(rank, bossPool); // Push #88t: theme first, boss of the same family
    const bossData = themed.boss;
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
    const monsters = buildGateMonsters(rank, rankData.floors, strengthPct, bossName); // Push #88t: themed to the boss
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
      boss: { name: bossName, baseName: bossData.baseName || bossName, family: themed.theme || null, hp: bossHp, maxHp: bossHp, defeated: false },
      theme: themed.theme || null,
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
    const sl = SL.SL_BY_NAME[monsterName] || SL.SL_BY_NAME[String(monsterName || '').replace(/^Elite\s+/i, '').replace(/\s+Soldier$/i, '')];
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
GateManager.monsterFamily = monsterFamily;
GateManager.pickGateTheme = pickGateTheme;
GateManager.orderFloors = orderFloors;

module.exports = { GateManager, GATE_RANKS, LOOT_TABLES, GATE_MONSTERS, GATE_BOSSES, rollGateStrength, strengthLabel, strengthText, buildGateMonsters, monsterFamily, orderFloors, MONSTER_FAMILIES, pickGateTheme };
