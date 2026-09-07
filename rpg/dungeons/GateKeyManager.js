/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — GateKeyManager                      ║
 * ║  Manages gate keys, dungeon GCs, affiliates,         ║
 * ║  contracts, and raid access control                  ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Flow:
 *  1. Gate spawns in main GC
 *  2. Guild leader/officer replies: /gate buy
 *  3. Key generated (8 chars), DM'd to buyer with timer
 *  4. In registered dungeon GC: /gate enter --<key>
 *  5. Raid proceeds floor by floor
 *  6. Clear → loot distributed by ownership type
 */

'use strict';

const { formatDuration } = require('../utils/NigerianTime');

// ── Key storage (in-memory + persisted to DB) ─────────────────────────────────
// keys[key] = { gateId, chatId (spawn GC), ownedBy (jid), guildName, isAffiliate,
//               purchasedAt, expiresAt, used: false, dungeonChatId: null,
//               contract: { hunterJid: percent% }, raidParty: [] }
const activeKeys = {};

// ── Dungeon GC registry ───────────────────────────────────────────────────────
// dungeonGCs[chatId] = { setBy, setAt, activeKeyId: null }
const dungeonGCs = {};

// ── Affiliate registry ────────────────────────────────────────────────────────
// affiliates[jid] = { grantedBy (guild master jid), guildName, grantedAt }
const affiliates = {};

// ── Key generation ────────────────────────────────────────────────────────────
const KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,1,0 for clarity

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

// ── Gate stability timer (3 days to 2 weeks) ──────────────────────────────────
const MIN_STABILITY = 3  * 24 * 60 * 60 * 1000;  // 3 days
const MAX_STABILITY = 14 * 24 * 60 * 60 * 1000;  // 14 days

function rollStabilityTimer() {
  return Math.floor(MIN_STABILITY + Math.random() * (MAX_STABILITY - MIN_STABILITY));
}

// ── Permission helpers ────────────────────────────────────────────────────────
function normaliseJid(jid) {
  return jid?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '') || '';
}

function isGuildLeaderOrOfficer(sender, guildName, db) {
  const guild = db.guilds?.[guildName];
  if (!guild) return false;
  const sNum = normaliseJid(sender);
  if (normaliseJid(guild.leader) === sNum) return true;
  if ((guild.officers || []).some(o => normaliseJid(o) === sNum)) return true;
  return false;
}

function isGuildMember(sender, guildName, db) {
  const guild = db.guilds?.[guildName];
  if (!guild) return false;
  const sNum = normaliseJid(sender);
  if (normaliseJid(guild.leader) === sNum) return true;
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
  // Guild members of the owning guild
  if (keyData.guildName && isGuildMember(sender, keyData.guildName, db)) return true;
  // The affiliate who bought it
  if (keyData.isAffiliate && normaliseJid(sender) === normaliseJid(keyData.ownedBy)) return true;
  // Affiliates of the same guild
  if (keyData.guildName) {
    const aff = getAffiliateData(sender, db);
    if (aff && aff.guildName === keyData.guildName) return true;
  }
  // Contracted hunters
  if (keyData.contracts && keyData.contracts[sender]) return true;
  return false;
}

// ── Purchase a gate key ───────────────────────────────────────────────────────
/**
 * @returns {{ success, key?, keyData?, error? }}
 */
function purchaseGateKey(sender, gate, db, saveDatabase) {
  const player = db.users?.[sender];
  if (!player) return { success: false, error: 'You are not registered.' };

  const price     = gate.purchasePrice || 0;
  const guildName = player.guild;
  const affData   = getAffiliateData(sender, db);
  const isAff     = !!affData;

  // Determine payment source
  let paymentSource = null; // 'guild' | 'personal'
  let guild = null;

  if (isAff) {
    // Affiliate pays from mana crystals only (gate prices are in crystals)
    const crystals = player.manaCrystals || 0;
    if (crystals < price) {
      return {
        success: false,
        error: `Not enough Mana Stones.\nNeed: ${price.toLocaleString()} 💎\nYou have: ${crystals.toLocaleString()} 💎`,
      };
    }
    player.manaCrystals = crystals - price;
    paymentSource = 'personal';
  } else if (guildName) {
    // Check leader/officer
    if (!isGuildLeaderOrOfficer(sender, guildName, db)) {
      return { success: false, error: 'Only the guild leader or an officer can buy gates.' };
    }
    guild = db.guilds[guildName];
    if ((guild.treasury || 0) < price) {
      return { success: false, error: `Guild treasury insufficient.\nNeed: ${price.toLocaleString()} 💎\nTreasury: ${(guild.treasury||0).toLocaleString()} 💎` };
    }
    guild.treasury -= price;
    paymentSource = 'guild';
  } else {
    return { success: false, error: 'You must be in a guild or be a registered affiliate to buy gates.' };
  }

  // Generate key
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
    contracts:    {},   // { jid: percent }
    raidStarted:  false,
    raidComplete: false,
  };

  activeKeys[key] = keyData;

  // Persist to DB
  if (!db.gateKeys) db.gateKeys = {};
  db.gateKeys[key] = keyData;

  saveDatabase();
  return { success: true, key, keyData, stabilityMs };
}

// ── Register a dungeon GC ─────────────────────────────────────────────────────
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

// ── Load dungeon GCs from DB on startup ───────────────────────────────────────
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

// ── Enter a gate with key ─────────────────────────────────────────────────────
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

  // Activate
  keyData.dungeonChatId = chatId;
  keyData.raidStarted   = true;
  gc.activeKeyId        = key;

  // Add sender to party if not already
  if (!keyData.raidParty.includes(sender)) keyData.raidParty.push(sender);

  return { success: true, keyData };
}

// ── Grant affiliate ───────────────────────────────────────────────────────────
function grantAffiliate(grantorJid, targetJid, guildName, db, saveDatabase) {
  const guild = db.guilds?.[guildName];
  if (!guild) return { success: false, error: 'Guild not found.' };
  if (normaliseJid(guild.leader) !== normaliseJid(grantorJid)) {
    return { success: false, error: 'Only the guild master can grant affiliate status.' };
  }
  if (isGuildMember(targetJid, guildName, db)) {
    return { success: false, error: 'That hunter is already a guild member.' };
  }

  if (!db.affiliates) db.affiliates = {};
  const affId = `aff_${normaliseJid(targetJid)}`;
  db.affiliates[affId] = {
    jid:        targetJid,
    guildName,
    grantedBy:  grantorJid,
    grantedAt:  Date.now(),
  };
  affiliates[affId] = db.affiliates[affId];
  saveDatabase();
  return { success: true };
}

function revokeAffiliate(revokerJid, targetJid, guildName, db, saveDatabase) {
  const guild = db.guilds?.[guildName];
  if (!guild) return { success: false, error: 'Guild not found.' };
  if (normaliseJid(guild.leader) !== normaliseJid(revokerJid)) {
    return { success: false, error: 'Only the guild master can revoke affiliate status.' };
  }
  if (!db.affiliates) return { success: false, error: 'No affiliates found.' };
  const affId = `aff_${normaliseJid(targetJid)}`;
  if (!db.affiliates[affId]) return { success: false, error: 'That hunter is not an affiliate.' };
  delete db.affiliates[affId];
  delete affiliates[affId];
  saveDatabase();
  return { success: true };
}

// ── Set contract ──────────────────────────────────────────────────────────────
function setContract(key, partyLeaderJid, targetJid, percent, db) {
  const keyData = activeKeys[key] || db.gateKeys?.[key];
  if (!keyData) return { success: false, error: 'Key not found.' };
  if (normaliseJid(keyData.ownedBy) !== normaliseJid(partyLeaderJid)) {
    return { success: false, error: 'Only the key holder can set contracts.' };
  }
  if (percent < 1 || percent > 99) return { success: false, error: 'Contract must be between 1% and 99%.' };

  // Check total contracts don't exceed 100%
  const current = Object.values(keyData.contracts || {}).reduce((s, p) => s + p, 0);
  if (current + percent > 100) {
    return { success: false, error: `Total contracts would exceed 100%. Currently at ${current}%.` };
  }

  if (!keyData.contracts) keyData.contracts = {};
  keyData.contracts[targetJid] = percent;

  // Add to raid party
  if (!keyData.raidParty.includes(targetJid)) keyData.raidParty.push(targetJid);

  return { success: true };
}

// ── Distribute loot after gate clear ─────────────────────────────────────────
/**
 * @returns {{ guildGold, guildCrystals, affiliateLoot, contractPayouts, distribution }}
 */
function distributeLoot(key, lootBundle, db, saveDatabase) {
  const keyData = activeKeys[key] || db.gateKeys?.[key];
  if (!keyData) return null;

  const { gold = 0, crystals = 0, items = [] } = lootBundle;

  // Process contracts first — deduct from totals before awarding
  const contractPayouts = processContracts(key, gold, crystals, db);
  const contractGold     = Object.values(contractPayouts).reduce((s, p) => s + p.gold,    0);
  const contractCrystals = Object.values(contractPayouts).reduce((s, p) => s + p.crystals, 0);
  const remainingGold     = Math.max(0, gold    - contractGold);
  const remainingCrystals = Math.max(0, crystals - contractCrystals);

  if (keyData.isAffiliate) {
    // Affiliate gets the remainder after contracts
    const owner = db.users?.[keyData.ownedBy];
    if (owner) {
      owner.gold         = (owner.gold         || 0) + remainingGold;
      owner.manaCrystals = (owner.manaCrystals  || 0) + remainingCrystals;
      for (const item of items) addItemToPlayer(owner, item);
    }

  } else {
    // Guild gets the remainder after contracts
    const guild = db.guilds?.[keyData.guildName];
    if (guild) {
      if (!guild.gold) guild.gold = 0;
      guild.gold     += remainingGold;
      guild.treasury  = (guild.treasury || 0) + remainingCrystals;
      if (!guild.inventory) guild.inventory = [];
      guild.inventory.push(...items.map(i => ({ ...i, obtainedAt: Date.now(), fromGate: key })));
    }

    // Update gate clear stats for all raiders
    for (const jid of keyData.raidParty) {
      const p = db.users?.[jid];
      if (p) {
        if (!p.stats_history) p.stats_history = {};
        p.stats_history.gatesCleared = (p.stats_history.gatesCleared || 0) + 1;
      }
    }
  }

  // Mark complete and free the dungeon GC
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

// ── Expire check ──────────────────────────────────────────────────────────────
function checkExpiredKeys(sock, db, saveDatabase) {
  // Collect expired keys first to avoid mutating while iterating
  const expired = Object.entries(activeKeys).filter(([, k]) =>
    !k.expired && !k.raidComplete && Date.now() > k.expiresAt
  );

  if (expired.length === 0) return;

  for (const [key, keyData] of expired) {
    keyData.expired = true;
    if (db.gateKeys?.[key]) db.gateKeys[key].expired = true;

    // Notify key owner via DM
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

    // Free the dungeon GC if active
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
  setContract,
  distributeLoot,
  checkExpiredKeys,
  getKey,
  formatStability,
  isGuildLeaderOrOfficer,
  isGuildMember,
  isAffiliate,
  getAffiliateData,
  canUseKey,
  dungeonGCs,
  activeKeys,
};
