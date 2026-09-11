/**
 * ═══════════════════════════════════════════════════════════════
 *   GateRaid — party / solo gate raid engine (code-driven)
 * ═══════════════════════════════════════════════════════════════
 *  Flow:
 *   1. Owner/guild buys a gate  → /gate buy  → bot DMs the GATE CODE.
 *   2. In a registered dungeon GC, members use /party create --<CODE>.
 *   3. Guild members (or affiliates) of the owning guild get a party.
 *   4. A non-member / non-affiliate instantly gets a SOLO raid.
 *   5. Combat proceeds floor-by-floor with /gateraid attack|skill|
 *      status|boss.
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

const RI = require('../utils/RewardInventory');
const GKM = require('./GateKeyManager');
const { GateManager, GATE_RANKS } = require('./GateManager');

const MAX_PARTY = 10;

// ── Combat math (shared with the command for consistent damage) ──
function playerDamage(player, skillName = null) {
  const atk = (player.stats?.atk || 10) + (player.equipped?.weapon?.atk || player.equipped?.weapon?.bonus || 0);
  const magicPower = player.stats?.magicPower || 0;
  if (skillName) {
    const skill = (player.skills?.active || []).find(s => s.name === skillName);
    if (!skill) return { damage: 0, blocked: true, reason: `Skill *${skillName}* not found.` };
    const cd = player.skills?.cooldowns?.[skillName] || 0;
    if (Date.now() < cd) return { damage: 0, blocked: true, reason: `*${skillName}* is on cooldown!` };
    if ((player.stats?.energy || 0) < (skill.energyCost || 0)) return { damage: 0, blocked: true, reason: `Not enough energy for *${skillName}*!` };
    let dmg = (skill.damage || 20) + Math.floor((atk + magicPower) * 0.5);
    const isCrit = Math.random() < (player.stats?.critChance || 2) / 100;
    if (isCrit) dmg = Math.floor(dmg * (player.stats?.critDamage || 150) / 100);
    player.stats.energy = Math.max(0, (player.stats.energy || 0) - (skill.energyCost || 0));
    if (!player.skills.cooldowns) player.skills.cooldowns = {};
    player.skills.cooldowns[skillName] = Date.now() + (skill.cooldown || 3) * 1000;
    return { damage: dmg, isCrit, skillUsed: skill };
  }
  let dmg = Math.max(5, atk * (0.85 + Math.random() * 0.30));
  const isCrit = Math.random() < (player.stats?.critChance || 2) / 100;
  if (isCrit) dmg = Math.floor(dmg * (player.stats?.critDamage || 150) / 100);
  return { damage: Math.floor(dmg), isCrit };
}

function monsterDamage(monster, def) {
  const raw = Math.max(3, (monster.atk || 10) - Math.floor((def || 5) * 0.5));
  return Math.floor(raw * (0.8 + Math.random() * 0.4));
}

function lifeSteal(player, dmg) {
  const ls = (player.stats?.lifesteal || 0) / 100;
  return ls > 0 ? Math.floor(dmg * ls) : 0;
}

// ── Resolve a gate code → gate + keyData ─────────────────────────
function resolveCode(code, db = null) {
  const key = String(code || '').toUpperCase().replace(/^--/, '').trim();
  if (!key || key.length !== 8) return { ok: false, error: 'Invalid gate code. Format: 8 characters (e.g. 2K7SN2N8).' };
  const keyData = GKM.getKey(key, db) || null;
  if (!keyData) return { ok: false, error: '❌ Gate code not found. Check the code and try again.' };
  if (keyData.claimed || keyData.raidComplete) return { ok: false, error: '❌ This gate key has already been cleared or claimed!' };
  if (keyData.expired || Date.now() > keyData.expiresAt) return { ok: false, error: '⚠️ This gate code has expired. The gate has collapsed.' };
  let gate = GateManager.getGate(keyData.gateId);
  // FIX: reconstruct gate if missing (e.g., after restart) or broken prematurely but key still valid — fixes "no longer active" for valid keys
  if (!gate) {
    const rank = keyData.gateRank || 'C';
    const rd = GATE_RANKS[rank] || GATE_RANKS['E'];
    const totalFloors = rd.floors || 5;
    try {
      const { MONSTER_DROPS } = require('../data/MonsterDrops');
      const pool = (MONSTER_DROPS[rank] && MONSTER_DROPS[rank].monsters) || MONSTER_DROPS['E'].monsters;
      const bossPool = (MONSTER_DROPS[rank] && MONSTER_DROPS[rank].bosses) || MONSTER_DROPS['E'].bosses;
      const bossData = bossPool[Math.floor(Math.random()*bossPool.length)];
      const monsters = [];
      const count = totalFloors * 3;
      const [minHp, maxHp] = rd.monsterRange || [15,45];
      for (let i=0;i<count;i++) {
        const monsterData = pool[Math.floor(Math.random()*pool.length)];
        const hp = Math.floor(minHp + Math.random()*(maxHp-minHp));
        monsters.push({ name: monsterData.name, hp, maxHp: hp, atk: Math.floor(hp*0.15), def: Math.floor(hp*0.05), floor: Math.floor(i/3)+1, defeated:false });
      }
      gate = {
        id: keyData.gateId,
        chatId: keyData.spawnChatId || keyData.dungeonChatId || 'unknown@g.us',
        rank, rankData: rd,
        spawnTime: keyData.purchasedAt || Date.now(),
        breakTime: keyData.expiresAt || (Date.now()+ 7*24*60*60*1000),
        currency: rd.currency || 'nexus',
        isFree: false, isDisaster:false,
        owned: true, ownedBy: keyData.guildName || null,
        purchasedAt: keyData.purchasedAt,
        purchasePrice: 0, manaPrice:0,
        nexusLoot:0, crystalLoot:0,
        cleared:false, broken:false, active:true,
        raiders: [], guildRaiders:[], externalRaiders:[], pendingApplicants:[],
        raidStarted:false, raidStartTime:null,
        currentFloor:0, totalFloors,
        monsters,
        boss: { name: bossData.name, hp: rd.bossHp, maxHp: rd.bossHp, defeated:false },
        bossLoot: [],
        lootDistributed:false,
        monstersKilled:0, damageDealt:{},
        raid: null
      };
      GateManager.activeGates[gate.id] = gate;
      if (gate.chatId && gate.chatId.endsWith('@g.us')) {
        if (!GateManager.gatesByChat[gate.chatId]) GateManager.gatesByChat[gate.chatId]=[];
        if (!GateManager.gatesByChat[gate.chatId].includes(gate.id)) GateManager.gatesByChat[gate.chatId].push(gate.id);
      }
      if (keyData.dungeonChatId && keyData.dungeonChatId !== gate.chatId) {
        if (!GateManager.gatesByChat[keyData.dungeonChatId]) GateManager.gatesByChat[keyData.dungeonChatId]=[];
        if (!GateManager.gatesByChat[keyData.dungeonChatId].includes(gate.id)) GateManager.gatesByChat[keyData.dungeonChatId].push(gate.id);
      }
    } catch (e) {
      return { ok:false, error:'❌ This gate is no longer active. (Gate data lost — please contact admin)' };
    }
  }
  // FIX: if gate was marked broken but key still valid, revive it (fixes premature break)
  if (gate.broken && !gate.cleared && keyData && !keyData.expired && Date.now() < keyData.expiresAt && !keyData.raidComplete) {
    gate.broken = false;
    gate.active = true;
    gate.breakTime = keyData.expiresAt;
  }
  if (!gate || gate.cleared || gate.broken) return { ok: false, error: '❌ This gate is no longer active.' };
  return { ok: true, key, keyData, gate };
}

// ── Relationship of a sender to an owning guild ─────────────────
// Returns 'member' | 'affiliate' | 'outsider'. Outsiders raid solo.
function relationOf(sender, keyData, db) {
  const guildName = keyData ? keyData.guildName : null;
  if (keyData && keyData.isAffiliate) {
    if (GKM.normaliseJid(sender) === GKM.normaliseJid(keyData.ownedBy)) return 'affiliate';
    return 'outsider';
  }
  if (guildName) {
    if (GKM.isGuildMember(sender, guildName, db)) return 'member';
    const aff = GKM.getAffiliateData(sender, db);
    if (aff && aff.guildName === guildName) return 'affiliate';
    if (keyData && keyData.contracts && keyData.contracts[sender]) return 'affiliate';
    return 'outsider';
  }
  return 'outsider';
}

// ── Get / create the raid object on a gate ──────────────────────
function raidOf(gate, key, keyData) {
  if (!gate.raid) {
    gate.raid = {
      key,
      mode: null,
      leader: null,
      status: 'recruiting', // recruiting | active | done
      members: [],          // [{ id, name, hp, maxHp, energy, maxEnergy, ready }]
      guildName: keyData ? keyData.guildName : null,
      isAffiliate: keyData ? !!keyData.isAffiliate : false,
      ownedBy: keyData ? keyData.ownedBy : null,
      startedAt: null,
      clearedAt: null,
      loot: null,
    };
  }
  return gate.raid;
}

function ensureMember(gate, sender, db) {
  const player = db.users?.[sender];
  const raid = gate.raid;
  let m = raid.members.find(x => x.id === sender);
  if (!m) {
    m = {
      id: sender,
      name: (player && player.name) || sender.split('@')[0],
      maxHp: (player?.stats?.maxHp || 100),
      hp: (player?.stats?.hp ?? (player?.stats?.maxHp || 100)),
      energy: (player?.stats?.energy ?? (player?.stats?.maxEnergy || 100)),
      maxEnergy: (player?.stats?.maxEnergy || 100),
      ready: false,
    };
    raid.members.push(m);
  }
  return m;
}

// ── ENTRY ───────────────────────────────────────────────────────
function enter(sender, name, key, keyData, gate, db) {
  const raid = raidOf(gate, key, keyData);
  const rel = relationOf(sender, keyData, db);

  // No-guild hunter (not a member of the owning guild, not an affiliate) → instant SOLO raid.
  if (rel === 'outsider') {
    raid.mode = 'solo';
    raid.leader = sender;
    raid.status = 'active';
    raid.startedAt = Date.now();
    // Single-use: solo raids launch instantly, so the key is consumed here
    try {
      keyData.used = true; keyData.raidStarted = true;
      if (db?.gateKeys?.[key]) { db.gateKeys[key].used = true; db.gateKeys[key].raidStarted = true; }
    } catch(e){}
    raid.members = [];
    ensureMember(gate, sender, db);
    gate.raiders = gate.raiders || [];
    if (!gate.raiders.includes(sender)) gate.raiders.push(sender);
    return { ok: true, mode: 'solo', raid, rel };
  }

  // member / affiliate → open a party (creator = leader)
  if (!raid.leader || raid.status === 'done') {
    raid.mode = 'party';
    raid.status = 'recruiting';
    raid.leader = sender;
    raid.members = [];
  }
  ensureMember(gate, sender, db);
  gate.raiders = gate.raiders || [];
  if (!gate.raiders.includes(sender)) gate.raiders.push(sender);
  return { ok: true, mode: 'party', raid, rel };
}

function join(sender, name, gate, db) {
  const raid = gate.raid;
  if (!raid) return { ok: false, error: 'No gate raid in progress.' };
  if (raid.status !== 'recruiting') return { ok: false, error: 'The raid has already started.' };
  if (raid.members.length >= MAX_PARTY) return { ok: false, error: `Party is full! (${MAX_PARTY} max)` };

  ensureMember(gate, sender, db);
  return { ok: true, raid };
}

function ready(sender, gate) {
  const raid = gate.raid;
  if (!raid) return { ok: false, error: 'No gate raid in progress.' };
  const m = raid.members.find(x => x.id === sender);
  if (!m) return { ok: false, error: 'You are not in this raid.' };
  m.ready = true;
  const allReadied = raid.members.length > 0 && raid.members.every(x => x.ready);
  return { ok: true, allReadied };
}

function start(sender, keyData, gate, db) {
  const raid = gate.raid;
  if (!raid) return { ok: false, error: 'No gate raid in progress.' };
  if (raid.status !== 'recruiting') return { ok: false, error: 'The raid has already started.' };
  if (raid.leader !== sender) return { ok: false, error: 'Only the party leader can start the raid.' };
  if (raid.members.length === 0) return { ok: false, error: 'The party is empty.' };
  if (!raid.members.every(x => x.ready)) return { ok: false, error: 'All members must run /party ready before you can start.' };

  raid.status = 'active';
  raid.startedAt = Date.now();
  gate.raidStarted = true;
  // Single-use: launching the raid consumes the key (no second runs)
  try {
    keyData.used = true; keyData.raidStarted = true;
    if (db?.gateKeys?.[keyData.key]) { db.gateKeys[keyData.key].used = true; db.gateKeys[keyData.key].raidStarted = true; }
  } catch(e){}
  gate.raidStartTime = Date.now();
  gate.currentFloor = 1;
  gate.raiders = gate.raiders || [];
  raid.members.forEach(m => { if (!gate.raiders.includes(m.id)) gate.raiders.push(m.id); });
  return { ok: true, raid };
}

// ── Status ──────────────────────────────────────────────────────
function statusOf(gate, db) {
  const raid = gate.raid;
  const rd = GATE_RANKS[gate.rank] || GATE_RANKS['E'];
  const floor = gate.currentFloor;
  const floorMonsters = (gate.monsters || []).filter(m => m.floor === floor && !m.defeated);
  const totalMonsters = (gate.monsters || []).filter(m => m.floor === floor).length;
  const bossReady = floor >= gate.totalFloors && floorMonsters.length === 0 && !gate.boss.defeated;

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `${rd.emoji} *${rd.label}* [${gate.id}]`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ];
  if (raid) {
    const solo = raid.members.length <= 1;
    lines.push(solo ? `🎮 *SOLO RAID* (you opened it)` : `👥 *PARTY RAID*`);
    if (!solo && raid.status === 'recruiting') {
      lines.push(`📌 Status: *Recruiting* — leader: *${raid.leader}*`);
      lines.push(raid.isAffiliate
        ? `🔓 *Affiliate key — open to non-guild hunters*`
        : `🏰 *Guild key — open to owning-guild members only*`);
      lines.push(`👥 *READY (${raid.members.filter(m=>m.ready).length}/${raid.members.length})*:`);
      raid.members.forEach(m => lines.push(`  ${m.id === raid.leader ? '👑' : '⚔️'} ${m.name} ${m.ready ? '✅' : '⏳'}`));
      lines.push(``, `📌 Next: leader uses */party raid* when all are ready.`);
      return lines.join('\n');
    }
  }
  lines.push(`🗺️ Floor: *${floor}/${gate.totalFloors}*`);
  lines.push(`👾 Monsters: ${totalMonsters - floorMonsters.length}/${totalMonsters} cleared`);
  if (bossReady) lines.push(`🏆 *BOSS READY — /gateraid boss*`);
  lines.push(``);
  lines.push(raid && raid.members.length > 1 ? `*Party members (${raid.members.length}):*` : `*Your status:*`);
  (raid ? raid.members : [])
    .slice(0, 12)
    .forEach(m => lines.push(`  ${m.id === raid.leader ? '👑' : '⚔️'} *${m.name}* ${m.hp}/${m.maxHp}❤️ ${m.energy}/${m.maxEnergy}💙`));
  lines.push(``);
  lines.push(`💀 Floor ${floor} monsters:`);
  floorMonsters.slice(0, 6).forEach(m => lines.push(`  ${m.name} — HP ${m.hp}/${m.maxHp}`));
  if (floorMonsters.length > 6) lines.push(`  ...and ${floorMonsters.length - 6} more`);
  lines.push(``, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`⚔️ /gateraid attack | 🔮 /gateraid skill <name>`);
  if (floorMonsters.length === 0 && !bossReady) lines.push(`➡️ /gateraid advance`);
  if (bossReady) lines.push(`🏆 /gateraid boss`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  return lines.join('\n');
}

// ── Final-blow monster drops ─────────────────────────────────────
function monsterKilledBy(gate, monster, sender, db) {
  const lines = [];
  const player = db.users?.[sender];
  if (!player) return lines;

  if (!player.inventory) player.inventory = { materials: [], items: [], petFood: {} };
  if (!player.inventory.materials) player.inventory.materials = [];
  if (!player.inventory.items) player.inventory.items = [];

  // Material drop from monster — single commit to items (no more double-push
  // into the legacy bucket, which also duplicated the /inv display).
  const drop = GateManager.rollMonsterKillDrop(gate.rank, monster.name);
  if (drop) {
    RI.grantItem(player, { name: drop.name, type: 'material', rarity: drop.rarity || (gate.rank === 'S' || gate.rank === 'A' ? 'rare' : 'common'), fromGate: gate.id }, 'gate');
    lines.push(`🎁 *DROP → ${player.name}* (final blow): *${drop.name}*`);
  } else {
    const { rollBaseMaterial } = require('../data/MonsterDrops');
    const baseMat = rollBaseMaterial(gate.rank || 'E');
    if (baseMat) {
      RI.grantItem(player, { name: baseMat, type: 'material', rarity: 'common', fromGate: gate.id }, 'gate');
      lines.push(`🎁 *DROP → ${player.name}*: *${baseMat}*`);
    }
  }

  // 50% chance to drop Pet Food
  if (Math.random() <= 0.50) {
    const foodList = [
      { name: 'Monster Kibble', restore: 30, rarity: 'common' },
      { name: 'Royal Monster Feed', restore: 100, rarity: 'uncommon' }
    ];
    const food = foodList[Math.floor(Math.random() * foodList.length)];
    player.inventory.items.push({ name: food.name, type: 'PetFood', isPetFood: true, restore: food.restore, rarity: food.rarity });
    if (!player.inventory.petFood) player.inventory.petFood = {};
    player.inventory.petFood[food.name] = (player.inventory.petFood[food.name] || 0) + 1;
    lines.push(`🍖 *PET FOOD DROP → ${player.name}*: *${food.name}*`);
  }

  // 30% chance to drop a Health Potion
  if (Math.random() <= 0.30) {
    player.inventory.lowerHealthPotions = (player.inventory.lowerHealthPotions || 0) + 1;
    player.inventory.healthPotions = (player.inventory.healthPotions || 0) + 1;
    lines.push(`🩹 *POTION DROP → ${player.name}*: *Lower Health Potion*`);
  }

  return lines;
}

// ── On full clear (boss defeated) — distribute loot ─────────────
function clearGate(gate, key, keyData, db, saveDatabase) {
  const raid = gate.raid || {};
  const raiders = raid.members?.length ? raid.members : [];

  const nexus   = Math.floor(gate.nexusLoot || 0);
  const crystals = Math.floor(gate.crystalLoot || 0);

  const guild = keyData?.guildName ? GKM.findGuild(db, keyData.guildName) : null;
  const participantIds = new Set(raiders.map(m => m.id));
  const guildName = keyData?.guildName;

  const affPool = Object.values(db.affiliates || {}).filter(a =>
    a.guildName === guildName && participantIds.has(a.jid) && (a.pct || a.affiliatePct || 0) > 0
  );

  let affPoolPct = 0;
  if (affPool.length) affPoolPct = Math.max(...affPool.map(a => Number(a.pct || a.affiliatePct) || 0));

  const payouts = {};
  let allocatedPct = 0;

  if (affPoolPct > 0 && affPool.length) {
    const perAff = affPoolPct / affPool.length;
    for (const aff of affPool) {
      payouts[aff.jid] = payouts[aff.jid] || { gold: 0, crystals: 0, kind: 'affiliate', percent: 0 };
      payouts[aff.jid].gold   += Math.floor(nexus * (perAff / 100));
      payouts[aff.jid].crystals += Math.floor(crystals * (perAff / 100));
      payouts[aff.jid].percent += perAff;
    }
    allocatedPct += affPoolPct;
  }

  const contractPayouts = {};
  if (keyData?.contracts) {
    for (const [jid, pct] of Object.entries(keyData.contracts)) {
      if (!participantIds.has(jid)) continue;
      payouts[jid] = payouts[jid] || { gold: 0, crystals: 0, kind: 'contract', percent: 0 };
      payouts[jid].gold   += Math.floor(nexus * (pct / 100));
      payouts[jid].crystals += Math.floor(crystals * (pct / 100));
      payouts[jid].percent += Number(pct);
      allocatedPct += Number(pct);
    }
  }

  const totalPct = Math.max(allocatedPct, 0);
  const scale = totalPct > 100 ? 100 / totalPct : 1;

  let guildNexus = nexus, guildCrystals = crystals;
  const affiliatePayouts = {};
  for (const [jid, p] of Object.entries(payouts)) {
    const goldCut = Math.floor(p.gold * scale);
    const crystalCut = Math.floor(p.crystals * scale);
    const hunter = db.users?.[jid];
    if (hunter) {
      hunter.gold = (hunter.gold || 0) + goldCut;
      hunter.manaCrystals = (hunter.manaCrystals || 0) + crystalCut;
      if (goldCut > 0) {
        try { require('../utils/DailyQuestSystem').trackQuestProgress(hunter, 'goldEarn', goldCut); } catch(e){}
      }
    }
    affiliatePayouts[jid] = { gold: goldCut, crystals: crystalCut, kind: p.kind, percent: Number((p.percent * scale).toFixed(1)) };
    guildNexus -= goldCut;
    guildCrystals -= crystalCut;
    if (p.kind === 'contract') contractPayouts[jid] = { gold: goldCut, crystals: crystalCut, percent: p.percent };
  }
  guildNexus = Math.max(0, guildNexus);
  guildCrystals = Math.max(0, guildCrystals);

  let dest, destinationText;
  if (guild) {
    guild.treasury = (guild.treasury || 0) + guildNexus;
    guild.manaTreasury = (guild.manaTreasury || 0) + guildCrystals;
    dest = guild.name || 'Guild';
    destinationText = `🏰 *${dest}* Treasury`;
  } else {
    // If solo hunter or no guild, remainder goes to party leader
    const leader = db.users?.[raid.leader || keyData?.ownedBy];
    if (leader) {
      leader.gold = (leader.gold || 0) + guildNexus;
      leader.manaCrystals = (leader.manaCrystals || 0) + guildCrystals;
      if (guildNexus > 0) {
        try { require('../utils/DailyQuestSystem').trackQuestProgress(leader, 'goldEarn', guildNexus); } catch(e){}
      }
      dest = leader.name;
      destinationText = `👤 *${leader.name}* Personal Balance`;
    } else {
      dest = 'Solo Hunter';
      destinationText = `👤 Personal Balance`;
    }
  }

  const wildPet = spawnWildPet(gate);
  let wildToken = null;
  if (wildPet && db) {
    wildToken = `WP-${Date.now()}-${Math.floor(Math.random() * 999)}`;
    if (!db.wildPets) db.wildPets = [];
    db.wildPets.push({
      token: wildToken,
      petId: wildPet.petId,
      name: wildPet.name,
      emoji: wildPet.emoji,
      rarity: wildPet.rarity,
      gate: gate.id,
      spawnedAt: Date.now(),
      expiresAt: Date.now() + 60 * 1000,
      caughtBy: null,
      forJids: raiders.map(m => m.id),
    });
    wildPet.token = wildToken;
  }

  let recovered = 0;
  const WeeklyGuildWar = require('../utils/WeeklyGuildWar');
  for (const m of raiders) {
    const p = db.users?.[m.id];
    if (p) {
      if (!p.stats_history) p.stats_history = {};
      p.stats_history.gatesCleared = (p.stats_history.gatesCleared || 0) + 1;
      p.stats.hp = Math.min(p.stats.maxHp, Math.floor((p.stats.maxHp || 100) * 0.5));
      if (p.stats.maxEnergy) p.stats.energy = Math.min(p.stats.maxEnergy, Math.floor(p.stats.maxEnergy * 0.5));
      if (p.dungeonCooldown) p.dungeonCooldown = 0;
      recovered++;
    }
    const pm = raid.members?.find(x => x.id === m.id);
    if (pm && p) { pm.hp = p.stats.hp; pm.energy = p.stats.energy; }

  // Award Weekly GP: goes to party leader if alive; if not, shared equally among survivors
  const leaderId = raid.leader || raiders[0]?.id;
  const leaderUser = db.users?.[leaderId];
  const leaderMember = raid.members?.find(m => m.id === leaderId);
  const leaderAlive = (leaderUser?.stats?.hp || 0) > 0 || (leaderMember?.hp || 0) > 0;

  const survivors = raiders.filter(m => {
    const u = db.users?.[m.id];
    return (u?.stats?.hp || 0) > 0 || (m.hp || 0) > 0;
  });

  const totalGP = 300;

  if (leaderAlive && leaderId) {
    try { WeeklyGuildWar.addGP(db, leaderId, totalGP, saveDatabase); } catch(e) {}
  } else if (survivors.length > 0) {
    const shareGP = Math.max(1, Math.floor(totalGP / survivors.length));
    for (const surv of survivors) {
      try { WeeklyGuildWar.addGP(db, surv.id, shareGP, saveDatabase); } catch(e) {}
    }
  }
  }

  GateManager.clearGate(gate.id, db);
  if (keyData) {
    keyData.raidComplete = true;
    keyData.used = true;
    if (db.gateKeys?.[key]) { db.gateKeys[key].raidComplete = true; db.gateKeys[key].used = true; }
    const gc = GKM.getDungeonGC(keyData.dungeonChatId);
    if (gc) gc.activeKeyId = null;
  }
  if (!gate.raid) gate.raid = { members: [], mode: 'solo', leader: null, status: 'done' };
  gate.raid.status = 'done';
  gate.raid.clearedAt = Date.now();
  gate.raid.loot = { nexus, crystals, destinationText, dest, contractPayouts, affiliatePayouts, wildPet, recovered };
  if (saveDatabase) saveDatabase();

  return {
    nexus, crystals, destinationText, dest, guild,
    contractPayouts, affiliatePayouts, wildPet, recovered, raiders, wildToken,
  };
}

function spawnWildPet(gate) {
  const chance = 0.45;
  if (Math.random() > chance) return null;
  const { PET_DATABASE } = require('../utils/PetDatabase');
  const pool = Object.values(PET_DATABASE);
  const weights = pool.map((p, i) => ({ p, w: 2 + Math.random() * (gate.rank === 'S' || gate.rank === 'DISASTER' ? 5 : 1) }));
  const total = weights.reduce((s, w) => s + w.w, 0);
  let r = Math.random() * total;
  let chosen = pool[0];
  for (const { p, w } of weights) { r -= w; if (r <= 0) { chosen = p; break; } }
  return { petId: chosen.id, name: chosen.name, emoji: chosen.emoji, rarity: chosen.rarity };
}

module.exports = {
  MAX_PARTY,
  playerDamage,
  monsterDamage,
  lifeSteal,
  resolveCode,
  relationOf,
  raidOf,
  ensureMember,
  enter,
  join,
  ready,
  start,
  statusOf,
  monsterKilledBy,
  clearGate,
  spawnWildPet,
  GKM,
  GateManager,
  GATE_RANKS,
};
