/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — GateKeyManager                      ║
 * ║  Manages gate keys, dungeon GCs, affiliates,         ║
 * ║  contracts, and raid access control                  ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

const { formatDuration } = require('../utils/NigerianTime');

const activeKeys = {};
const dungeonGCs = {};
const affiliates = {};

const KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateKey() {
  let key = '';
  for (let i = 0; i < 8; i++) {
    key += KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)];
  }
  return key;
}

function generateUniqueKey() {
  let key;
  let attempts = 0;
  do {
    key = generateKey();
    attempts++;
  } while (activeKeys[key] && attempts < 100);
  return key;
}

const MIN_STABILITY = 3  * 24 * 60 * 60 * 1000;
const MAX_STABILITY = 7  * 24 * 60 * 60 * 1000;

function rollStabilityTimer() {
  return Math.floor(MIN_STABILITY + Math.random() * (MAX_STABILITY - MIN_STABILITY));
}

function normaliseJid(jid) {
  return jid?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '') || '';
}

function findGuild(db, guildName) {
  if (!db?.guilds) return null;
  const gn = String(guildName || '');
  if (db.guilds[gn]) return db.guilds[gn];
  const lower = gn.toLowerCase();
  return Object.values(db.guilds).find(g =>
    (g.id && String(g.id).toLowerCase() === lower) ||
    (g.name && String(g.name).toLowerCase() === lower)
  ) || null;
}

function isGuildLeaderOrOfficer(sender, guildName, db) {
  const guild = findGuild(db, guildName);
  if (!guild) return false;
  const sNum = normaliseJid(sender);
  if (guild.leader && normaliseJid(guild.leader) === sNum) return true;
  if ((guild.officers || []).some(o => normaliseJid(o) === sNum)) return true;
  const rankArrays = [guild.memberData, guild.members];
  for (const arr of rankArrays) {
    for (const m of (arr || [])) {
      const id = typeof m === 'object' ? m.id : m;
      if (normaliseJid(id) !== sNum) continue;
      const rank = String((typeof m === 'object' ? m.rank : null) || '').toLowerCase().replace(/[_-]/g, ' ');
      if (['leader', 'guild master', 'master', 'vice', 'vice gm', 'officer'].some(r => rank.includes(r))) {
        return true;
      }
    }
  }
  return false;
}

function isGuildMember(sender, guildName, db) {
  const guild = findGuild(db, guildName);
  if (!guild) return false;
  const sNum = normaliseJid(sender);
  if (guild.leader && normaliseJid(guild.leader) === sNum) return true;
  return (guild.members || []).some(m => {
    const id = typeof m === 'object' ? m.id : m;
    return normaliseJid(id) === sNum;
  });
}

function isAffiliate(sender, db) {
  const sNum = normaliseJid(sender);
  return Object.values(db.affiliates || {}).some(a => normaliseJid(a.jid) === sNum);
}

function getAffiliateData(sender, db) {
  const sNum = normaliseJid(sender);
  return Object.values(db.affiliates || {}).find(a => normaliseJid(a.jid) === sNum) || null;
}

function canUseKey(sender, keyData, db) {
  if (keyData.guildName && isGuildMember(sender, keyData.guildName, db)) return true;
  if (keyData.isAffiliate && normaliseJid(sender) === normaliseJid(keyData.ownedBy)) return true;
  if (keyData.guildName) {
    const aff = getAffiliateData(sender, db);
    if (aff && aff.guildName === keyData.guildName) return true;
  }
  if (keyData.contracts && keyData.contracts[sender]) return true;
  return false;
}

/**
 * @returns {{ success, key?, keyData?, error? }}
 */
function purchaseGateKey(sender, gate, db, saveDatabase) {
  const player = db.users?.[sender];
  if (!player) return { success: false, error: 'You are not registered.' };

  const nexusPrice = gate.purchasePrice || 0;
  const manaPrice  = gate.manaPrice || 0;
  const guildName  = player.guild;
  const affData    = getAffiliateData(sender, db);
  const isAff      = !!affData;
  const isBoth     = gate.currency === 'both' || ['B','A','S'].includes(gate.rank);

  let paymentSource = null; // 'guild' | 'personal'
  let guild = guildName ? findGuild(db, guildName) : null;
  const isLeader = guildName && isGuildLeaderOrOfficer(sender, guildName, db);

  // 1. Try Guild Treasury if buyer is Guild Leader/Officer
  if (isLeader && guild) {
    const gNexus = guild.treasury || 0;
    const gMana  = guild.manaTreasury || 0;
    const canGuildPay = isBoth
      ? (gNexus >= nexusPrice && gMana >= manaPrice)
      : (gNexus >= nexusPrice);

    if (canGuildPay) {
      if (isBoth) {
        guild.treasury -= nexusPrice;
        guild.manaTreasury -= manaPrice;
      } else {
        guild.treasury -= nexusPrice;
      }
      paymentSource = 'guild';
    }
  }

  // 2. Fallback to Personal Balance if Guild Treasury isn't used or insufficient
  if (!paymentSource) {
    const pNexus = player.gold || 0;
    const pMana  = player.manaCrystals || 0;
    const canPersonalPay = isBoth
      ? (pNexus >= nexusPrice && pMana >= manaPrice)
      : (pNexus >= nexusPrice);

    if (canPersonalPay) {
      if (isBoth) {
        player.gold -= nexusPrice;
        player.manaCrystals -= manaPrice;
      } else {
        player.gold -= nexusPrice;
      }
      if (player.inventory) player.inventory.gold = player.gold;
      paymentSource = 'personal';
    } else {
      const needTxt = isBoth
        ? `${nexusPrice.toLocaleString()} 💠 Nexus AND ${manaPrice.toLocaleString()} 💎 Mana Stones`
        : `${nexusPrice.toLocaleString()} 💠 Nexus`;
      const haveTxt = isBoth
        ? `${pNexus.toLocaleString()} 💠 Nexus & ${pMana.toLocaleString()} 💎 Mana Stones`
        : `${pNexus.toLocaleString()} 💠 Nexus`;
      return {
        success: false,
        error: `Insufficient funds to purchase gate.\nNeed: ${needTxt}\nYou have: ${haveTxt}`
      };
    }
  }

  const key          = generateUniqueKey();
  const stabilityMs  = rollStabilityTimer();
  const expiresAt    = Date.now() + stabilityMs;

  const keyData = {
    key,
    gateId:       gate.id,
    gateRank:     gate.rank,
    spawnChatId:  gate.chatId,
    ownedBy:      sender,
    guildName:    isAff ? affData.guildName : guildName,
    isAffiliate:  isAff,
    paymentSource,
    purchasedAt:  Date.now(),
    expiresAt,
    stabilityMs,
    used:         false,
    expired:      false,
    dungeonChatId: null,
    raidParty:    [],
    contracts:    {},
    raidStarted:  false,
    raidComplete: false,
  };

  activeKeys[key] = keyData;

  if (!db.gateKeys) db.gateKeys = {};
  db.gateKeys[key] = keyData;

  if (saveDatabase) saveDatabase();
  return { success: true, key, keyData, stabilityMs };
}

function setDungeonGC(chatId, setBy) {
  dungeonGCs[chatId] = { chatId, setBy, setAt: Date.now(), activeKeyId: null };
  return dungeonGCs[chatId];
}

function removeDungeonGC(chatId) {
  delete dungeonGCs[chatId];
}

function isDungeonGC(chatId) {
  return !!dungeonGCs[chatId];
}

function getDungeonGC(chatId) {
  return dungeonGCs[chatId] || null;
}

function getAllDungeonGCs() {
  return { ...dungeonGCs };
}

function loadFromDB(db) {
  if (db.dungeonGCs) {
    Object.assign(dungeonGCs, db.dungeonGCs);
  }
  if (db.gateKeys) {
    for (const [key, data] of Object.entries(db.gateKeys)) {
      if (!data.expired && !data.raidComplete && Date.now() < data.expiresAt) {
        activeKeys[key] = data;
      }
    }
  }
  if (db.affiliates) {
    Object.assign(affiliates, db.affiliates);
  }
}

function enterGate(key, sender, chatId, db) {
  const keyData = activeKeys[key] || db.gateKeys?.[key];
  if (!keyData) return { success: false, error: 'Invalid key. Check the key and try again.' };
  if (keyData.expired || Date.now() > keyData.expiresAt) {
    return { success: false, error: '⚠️ This gate key has expired. The gate has collapsed.' };
  }
  if (keyData.raidComplete) return { success: false, error: 'This gate has already been cleared.' };
  if (keyData.raidStarted && keyData.dungeonChatId !== chatId) {
    return { success: false, error: 'This gate raid is already active in another dungeon.' };
  }
  if (!isDungeonGC(chatId)) return { success: false, error: 'This group is not a registered dungeon GC.\nAsk the bot owner to set it up with /setdungeon.' };

  const gc = getDungeonGC(chatId);
  if (gc.activeKeyId && gc.activeKeyId !== key) {
    return { success: false, error: 'This dungeon GC already has an active gate raid. Clear it first.' };
  }
  if (!canUseKey(sender, keyData, db)) {
    return { success: false, error: 'You are not authorized to use this key.' };
  }

  keyData.dungeonChatId = chatId;
  keyData.raidStarted   = true;
  gc.activeKeyId        = key;

  if (!keyData.raidParty.includes(sender)) keyData.raidParty.push(sender);

  return { success: true, keyData };
}

function grantAffiliate(grantorJid, targetJid, guildName, pct, db, saveDatabase) {
  const guild = findGuild(db, guildName);
  if (!guild) return { success: false, error: 'Guild not found.' };
  const CM = require('../utils/GuildContractManager');
  if (!CM.isGuildMasterOrVice(db, guildName, grantorJid)) {
    return { success: false, error: 'Only the guild master or vice guild master can grant affiliate status.' };
  }
  if (isGuildMember(targetJid, guildName, db)) {
    return { success: false, error: 'That hunter is already a guild member.' };
  }
  pct = Number(pct);
  if (!pct || pct < 1 || pct > 100) return { success: false, error: 'You must specify the affiliate loot % (1-100).\nExample: /affiliate grant @user | 60' };
  if (isAffiliate(targetJid, db)) return { success: false, error: 'That hunter is already an affiliate of a guild.' };

  if (!db.affiliates) db.affiliates = {};
  const affId = `aff_${normaliseJid(targetJid)}`;
  db.affiliates[affId] = {
    jid:        targetJid,
    guildName,
    grantedBy:  grantorJid,
    grantedAt:  Date.now(),
    pct,
  };
  affiliates[affId] = db.affiliates[affId];
  saveDatabase();
  return { success: true };
}

function requestAffiliate(grantorJid, targetJid, guildName, key, pct, db, saveDatabase) {
  const guild = findGuild(db, guildName);
  if (!guild) return { success: false, error: 'Guild not found.' };
  const CM = require('../utils/GuildContractManager');
  if (!CM.isGuildMasterOrVice(db, guildName, grantorJid)) {
    return { success: false, error: 'Only the guild master or vice guild master can request an affiliate.' };
  }
  const keyData = activeKeys?.[key] || db.gateKeys?.[key];
  if (!keyData) return { success: false, error: 'Gate code not found.' };
  if (keyData.guildName !== guildName) return { success: false, error: 'That gate does not belong to your guild.' };
  pct = Number(pct);
  if (!pct || pct < 1 || pct > 100) return { success: false, error: 'You must specify the loot % (1-100).\nExample: /affiliate request @user | 60' };

  if (!db.requests) db.requests = {};
  const reqId = `req_${key}_${normaliseJid(targetJid)}`;
  db.requests[reqId] = {
    jid:       targetJid,
    guildName,
    key,
    requestedBy: grantorJid,
    requestedAt: Date.now(),
    pct,
  };
  saveDatabase();
  return { success: true };
}

function revokeAffiliate(revokerJid, targetJid, guildName, db, saveDatabase) {
  const guild = findGuild(db, guildName);
  if (!guild) return { success: false, error: 'Guild not found.' };
  const CM = require('../utils/GuildContractManager');
  if (!CM.isGuildMasterOrVice(db, guildName, revokerJid)) {
    return { success: false, error: 'Only the guild master or vice guild master can revoke affiliate status.' };
  }
  if (!db.affiliates) return { success: false, error: 'No affiliates found.' };
  const affId = `aff_${normaliseJid(targetJid)}`;
  if (!db.affiliates[affId]) return { success: false, error: 'That hunter is not an affiliate.' };
  delete db.affiliates[affId];
  delete affiliates[affId];
  saveDatabase();
  return { success: true };
}

function setContract(key, partyLeaderJid, targetJid, percent, db) {
  const keyData = activeKeys[key] || db.gateKeys?.[key];
  if (!keyData) return { success: false, error: 'Key not found.' };
  if (normaliseJid(keyData.ownedBy) !== normaliseJid(partyLeaderJid)) {
    return { success: false, error: 'Only the key holder can set contracts.' };
  }
  if (percent < 1 || percent > 99) return { success: false, error: 'Contract must be between 1% and 99%.' };

  const current = Object.values(keyData.contracts || {}).reduce((s, p) => s + p, 0);
  if (current + percent > 100) {
    return { success: false, error: `Total contracts would exceed 100%. Currently at ${current}%.` };
  }

  if (!keyData.contracts) keyData.contracts = {};
  keyData.contracts[targetJid] = percent;

  if (!keyData.raidParty.includes(targetJid)) keyData.raidParty.push(targetJid);

  return { success: true };
}

function distributeLoot(key, lootBundle, db, saveDatabase) {
  const keyData = activeKeys[key] || db.gateKeys?.[key];
  if (!keyData) return null;

  const { Nexus = 0, crystals = 0, items = [] } = lootBundle;

  const contractPayouts = processContracts(key, Nexus, crystals, db);
  const contractGold     = Object.values(contractPayouts).reduce((s, p) => s + p.gold,    0);
  const contractCrystals = Object.values(contractPayouts).reduce((s, p) => s + p.crystals, 0);
  const remainingGold     = Math.max(0, Nexus    - contractGold);
  const remainingCrystals = Math.max(0, crystals - contractCrystals);

  if (keyData.isAffiliate) {
    const owner = db.users?.[keyData.ownedBy];
    if (owner) {
      owner.gold         = (owner.gold         || 0) + remainingGold;
      owner.manaCrystals = (owner.manaCrystals  || 0) + remainingCrystals;
      for (const item of items) addItemToPlayer(owner, item);
    }
  } else {
    const guild = findGuild(db, keyData.guildName);
    if (guild) {
      if (!guild.gold) guild.gold = 0;
      guild.gold     += remainingGold;
      guild.treasury  = (guild.treasury || 0) + remainingCrystals;
      if (!guild.inventory) guild.inventory = [];
      guild.inventory.push(...items.map(i => ({ ...i, obtainedAt: Date.now(), fromGate: key })));
    }

    for (const jid of keyData.raidParty) {
      const p = db.users?.[jid];
      if (p) {
        if (!p.stats_history) p.stats_history = {};
        p.stats_history.gatesCleared = (p.stats_history.gatesCleared || 0) + 1;
      }
    }
  }

  keyData.raidComplete = true;
  if (db.gateKeys?.[key]) db.gateKeys[key].raidComplete = true;
  const gc = dungeonGCs[keyData.dungeonChatId];
  if (gc) gc.activeKeyId = null;

  saveDatabase();

  return {
    isAffiliate:    keyData.isAffiliate,
    guild:          keyData.guildName,
    gold:           remainingGold,
    crystals:       remainingCrystals,
    items,
    contractPayouts,
  };
}

function processContracts(key, totalGold, totalCrystals, db) {
  const keyData = activeKeys[key] || db.gateKeys?.[key];
  if (!keyData?.contracts) return {};

  const payouts = {};
  for (const [jid, percent] of Object.entries(keyData.contracts)) {
    const goldCut    = Math.floor(totalGold    * (percent / 100));
    const crystalCut = Math.floor(totalCrystals * (percent / 100));
    const player = db.users?.[jid];
    if (player) {
      player.gold = (player.gold || 0) + goldCut;
      player.manaCrystals = (player.manaCrystals || 0) + crystalCut;
    }
    payouts[jid] = { gold: goldCut, crystals: crystalCut, percent };
  }
  return payouts;
}

function addItemToPlayer(player, item) {
  if (!player.inventory) player.inventory = { weapons:[], armor:[], accessories:[], potions:[], artifacts:[], materials:[], keyStones:[] };
  const inv = player.inventory;
  const bucket = item.type === 'weapon' ? 'weapons'
    : item.type === 'armor' ? 'armor'
    : item.type === 'potion' ? 'potions'
    : item.type === 'artifact' ? 'artifacts'
    : item.type === 'accessory' ? 'accessories'
    : 'materials';
  if (Array.isArray(inv[bucket])) {
    inv[bucket].push({ ...item, obtainedAt: Date.now() });
  }
}

function checkExpiredKeys(sock, db, saveDatabase) {
  const expired = Object.entries(activeKeys).filter(([, k]) =>
    !k.expired && !k.raidComplete && Date.now() > k.expiresAt
  );

  if (expired.length === 0) return;

  for (const [key, keyData] of expired) {
    keyData.expired = true;
    if (db.gateKeys?.[key]) db.gateKeys[key].expired = true;

    if (sock && keyData.ownedBy) {
      sock.sendMessage(keyData.ownedBy, {
        text: [
          `⚠️ *GATE KEY EXPIRED*`,
          ``,
          `Your ${keyData.gateRank || '?'}-Rank gate key has expired.`,
          `Key: \`${key}\``,
          ``,
          `The gate has collapsed. The purchase is non-refundable.`,
        ].join('\n'),
      }).catch(() => {});
    }

    if (keyData.dungeonChatId) {
      const gc = dungeonGCs[keyData.dungeonChatId];
      if (gc && gc.activeKeyId === key) {
        gc.activeKeyId = null;
        if (sock) {
          sock.sendMessage(keyData.dungeonChatId, {
            text: `⚠️ *GATE COLLAPSED*\nThe gate key expired. The gate has fallen. Raid terminated.`,
          }).catch(() => {});
        }
      }
    }
  }

  saveDatabase();
}

function getKey(key) {
  return activeKeys[key] || null;
}

function formatStability(ms) {
  const days  = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

module.exports = {
  purchaseGateKey,
  enterGate,
  setDungeonGC,
  removeDungeonGC,
  isDungeonGC,
  getDungeonGC,
  getAllDungeonGCs,
  loadFromDB,
  grantAffiliate,
  revokeAffiliate,
  requestAffiliate,
  setContract,
  distributeLoot,
  checkExpiredKeys,
  getKey,
  formatStability,
  normaliseJid,
  findGuild,
  isGuildLeaderOrOfficer,
  isGuildMember,
  isAffiliate,
  getAffiliateData,
  canUseKey,
  dungeonGCs,
  activeKeys,
};
