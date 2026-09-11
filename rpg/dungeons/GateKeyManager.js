/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — GateKeyManager                      ║
 * ║  Manages gate keys, dungeon GCs, affiliates,         ║
 * ║  and raid access control                             ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

const SerfManager = require('../utils/SerfManager');

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

const MIN_STABILITY = 7  * 24 * 60 * 60 * 1000;
const MAX_STABILITY = 14 * 24 * 60 * 60 * 1000;

function rollStabilityTimer() {
  return Math.floor(MIN_STABILITY + Math.random() * (MAX_STABILITY - MIN_STABILITY));
}

function normaliseJid(jid) {
  if (!jid) return '';
  const raw = String(jid).split('@')[0].split(':')[0].toLowerCase();
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.length > 0 ? digits : raw;
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
  if (!sNum) return false;
  if (guild.leader && normaliseJid(guild.leader) === sNum) return true;
  if ((guild.officers || []).some(o => normaliseJid(o) === sNum)) return true;
  const rankArrays = [guild.memberData, guild.members];
  for (const arr of rankArrays) {
    for (const m of (arr || [])) {
      const id = typeof m === 'object' ? m.id : m;
      if (normaliseJid(id) !== sNum) continue;
      const rank = String((typeof m === 'object' ? m.rank : null) || '').toLowerCase().replace(/[_-]/g, ' ');
      if (['leader', 'guild master', 'master', 'vice', 'vice gm', 'officer', 'co-leader', 'coleader'].some(r => rank.includes(r))) {
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
  if (!sNum) return false;
  if (guild.leader && normaliseJid(guild.leader) === sNum) return true;
  return (guild.members || []).some(m => {
    const id = typeof m === 'object' ? m.id : m;
    return normaliseJid(id) === sNum;
  });
}

function isAffiliate(sender, db) {
  const sNum = normaliseJid(sender);
  if (!sNum) return false;
  return Object.values(db.affiliates || {}).some(a => normaliseJid(a.jid) === sNum);
}

function getAffiliateData(sender, db) {
  const sNum = normaliseJid(sender);
  if (!sNum) return null;
  return Object.values(db.affiliates || {}).find(a => normaliseJid(a.jid) === sNum) || null;
}

/**
 * Gate Key Purchase Rules:
 * 1. Purchaser MUST have an approved Serf bot to receive DM notifications.
 * 2. Purchaser MUST be a Guild Officer (Guildmaster, Vice GM, Officer) OR a Granted Affiliate.
 */
function purchaseGateKey(sender, gate, db, saveDatabase) {
  const player = db.users?.[sender];
  if (!player) return { success: false, error: 'You are not registered.' };

  // 1. Serf Check
  const serf = SerfManager.getSerf(db, sender);
  if (!serf) {
    return {
      success: false,
      error: `❌ No serf detected! Set a serf first using /setserf @bot so you can receive DM notifications.`
    };
  }

  // 2. Purchaser Authorization Check (Only Guildmasters, Vice GMs, Officers, or Granted Affiliates)
  const guildName = player.guild;
  const affData   = getAffiliateData(sender, db);
  const isAff     = !!affData;
  const isOfficer = guildName && isGuildLeaderOrOfficer(sender, guildName, db);

  if (!isOfficer && !isAff) {
    return {
      success: false,
      error: `❌ *Gates can only be purchased by Guild Officers (Guildmaster / Vice GM / Officer) or Granted Affiliates!*\n\nIf you belong to a guild, ask an officer to buy it or grant you affiliate status.`
    };
  }

  const nexusPrice = gate.purchasePrice || 0;
  const manaPrice  = gate.manaPrice || 0;
  const isBoth     = gate.currency === 'both' || ['B','A','S'].includes(gate.rank);

  let paymentSource = null; // 'guild' | 'personal'
  let guild = guildName ? findGuild(db, guildName) : null;

  // Try Guild Treasury first if buyer is a Guild Officer
  if (isOfficer && guild) {
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

  // Fallback to Personal Balance
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
    affiliateData: isAff ? affData : null,
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
  return { success: true, key, keyData, stabilityMs, serf };
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

function checkExpiredKeys(sock, db, saveDatabase) {
  // Same sweep also recycles 100-day-old keys (persists via autosave when idle)
  try { recycleOldKeys(db, null); } catch(e){}
  const expired = Object.entries(activeKeys).filter(([, k]) =>
    !k.expired && !k.raidComplete && Date.now() > k.expiresAt
  );

  if (expired.length === 0) return;

  for (const [key, keyData] of expired) {
    keyData.expired = true;
    if (db.gateKeys?.[key]) db.gateKeys[key].expired = true;

    if (sock && keyData.ownedBy) {
      try {
        const MultiSocketManager = require('../../bots/MultiSocketManager');
        const serfKey = SerfManager.getSerfBotKey(db, keyData.ownedBy);
        const serfSock = serfKey ? MultiSocketManager.getSocket(serfKey) : sock;
        if (serfSock) {
          serfSock.sendMessage(keyData.ownedBy, {
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
      } catch (e) {}
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

function getKey(key, db = null) {
  if (!key) return null;
  const upper = String(key).toUpperCase().trim();
  // Single-use: dead keys (expired/cleared/past stability) are NEVER served —
  // not even from the in-memory map (that fallback allowed same-session re-entry).
  const _live = k => k && !k.expired && !k.raidComplete && Date.now() < k.expiresAt;
  if (_live(activeKeys[upper])) return activeKeys[upper];
  if (db?.gateKeys?.[upper]) {
    const k = db.gateKeys[upper];
    if (_live(k)) {
      activeKeys[upper] = k;
      return k;
    }
  }
  return null;
}

// ── 100-day recycle: prune ancient keys so db.gateKeys can't grow forever ──
// Only keys OLDER than 100 days AND not tied to a live raid are deleted.
const RECYCLE_MS = 100 * 24 * 3600 * 1000;
function recycleOldKeys(db, saveDatabase) {
  if (!db?.gateKeys) return 0;
  const now = Date.now();
  let n = 0;
  for (const [key, k] of Object.entries(db.gateKeys)) {
    if (!k || !k.purchasedAt) continue;
    if (now - k.purchasedAt < RECYCLE_MS) continue;
    let live = false;
    try {
      const { GateManager } = require('./GateManager');
      const g = k.gateId ? GateManager.getGate(k.gateId) : null;
      if (g?.raid && ['recruiting', 'active'].includes(g.raid.status)) live = true;
    } catch(e){}
    if (live) continue;
    delete db.gateKeys[key];
    delete activeKeys[key];
    n++;
  }
  if (n > 0) {
    try { console.log(`🧹 Recycled ${n} gate key(s) older than 100 days`); } catch(e){}
    if (saveDatabase) { try { saveDatabase(); } catch(e){} }
  }
  return n;
}

function formatStability(ms) {
  const totalMs = Math.max(0, ms);
  const days  = Math.floor(totalMs / 86400000);
  const hours = Math.floor((totalMs % 86400000) / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

module.exports = {
  purchaseGateKey,
  setDungeonGC,
  removeDungeonGC,
  isDungeonGC,
  getDungeonGC,
  getAllDungeonGCs,
  loadFromDB,
  checkExpiredKeys,
  recycleOldKeys,
  getKey,
  formatStability,
  normaliseJid,
  findGuild,
  isGuildLeaderOrOfficer,
  isGuildMember,
  isAffiliate,
  getAffiliateData,
  dungeonGCs,
  activeKeys,
};
