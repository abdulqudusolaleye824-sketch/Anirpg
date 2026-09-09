/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — RPGIntentHandler                    ║
 * ║  Natural language RPG queries via personality chat   ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

const { calculatePowerRating, getPowerLabel, AWAKENING_RANKS } = require('../rpg/utils/SoloLevelingCore');
const { OWNER_JID, COOWNER_JID } = require('../utils/constants');

function normaliseJid(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function getRole(sender, db) {
  const ownerJid   = (db?._config?.ownerJid   || OWNER_JID || '221951679328499@lid');
  const coOwnerJid = (db?._config?.coOwnerJid || COOWNER_JID || '194592469209292@lid');

  const senderNum   = normaliseJid(sender);
  const ownerNum    = normaliseJid(ownerJid);
  const coOwnerNum  = normaliseJid(coOwnerJid);

  if (senderNum && (senderNum === ownerNum || senderNum === '221951679328499'))   return 'owner';
  if (senderNum && (senderNum === coOwnerNum || senderNum === '194592469209292')) return 'coowner';
  if ((db?.botMods || []).some(a => normaliseJid(a) === senderNum)) return 'admin';
  return 'player';
}

function isAdmin(sender, db) {
  const role = getRole(sender, db);
  return ['owner', 'coowner', 'admin'].includes(role);
}

function isOwnerOrCoOwner(sender, db) {
  return ['owner', 'coowner'].includes(getRole(sender, db));
}

const RPG_INTENTS = {
  database: [
    /\b(show|view|check|see|get|dump|list|fetch|query|pull up)\b.{0,30}\b(database|db|user files|system data|configs|raw data|critical data)\b/i,
    /\b(database|db) (status|summary|dump|view|records)\b/i,
    /\bwho is registered in database\b/i,
  ],
  profile: [
    /\b(show|view|check|see|what(?:'s| is))(?: me)?(?: my)? profile\b/i,
    /\bmy (stats|profile|hunter info|info)\b/i,
    /\bwho am i\b/i,
  ],
  viewOtherProfile: [
    /\b(show|view|check|see|get|give me)(?: me)? @?\w+(?:'s)? (profile|stats)\b/i,
    /\b(profile|stats) of @?\w+\b/i,
    /\b(what are|check) @?\w+(?:'s)? (stats|profile)\b/i,
  ],
  rank: [
    /\b(what(?:'s| is)(?: my)?|check my|show my) rank\b/i,
    /\bwhat rank am i\b/i,
  ],
  balance: [
    /\b(how much|check my|what(?:'s| is)(?: my)?) (gold|coins?|money|balance|currency|nexus)\b/i,
    /\bmy (gold|coins?|balance|money|nexus)\b/i,
  ],
  inventory: [
    /\b(show|view|check|see)(?: me)?(?: my)? (inventory|items?|gear|bag)\b/i,
    /\bmy (inventory|items?|gear)\b/i,
  ],
  guild: [
    /\b(show|view|check|see|what(?:'s| is))(?: my)? guild\b/i,
    /\bmy guild\b/i,
  ],
  leaderboard: [
    /\b(show|view|check|see)(?: the)? (leaderboard|top players?|rankings?)\b/i,
    /\bleaderboard\b/i,
  ],
  ban: [
    /\bban @?\w+\b/i,
  ],
  unban: [
    /\bunban @?\w+\b/i,
  ],
  cooldowns: [
    /\b(what(?:'s| are)(?: my)?|check my|show my) (cooldowns?|timers?|cd)\b/i,
  ],
  skills: [
    /\b(what(?:'s| are)(?: my)?|show|check|list)(?: my)? (skills?|abilities)\b/i,
  ],
};

function detectRPGIntent(message) {
  for (const [intent, patterns] of Object.entries(RPG_INTENTS)) {
    for (const p of patterns) {
      if (p.test(message)) return intent;
    }
  }
  return null;
}

function buildProfileText(player) {
  if (!player) return null;

  const rank = player.awakenRank || 'E';
  let rankData = { emoji: '⬜', label: `${rank}-Rank` };
  try {
    if (AWAKENING_RANKS?.[rank]) rankData = AWAKENING_RANKS[rank];
  } catch(e) {}

  let power = 0;
  let powerLabel = { emoji: '⚪', label: 'Unknown' };
  let stats = player.stats || {};
  try {
    const equipped = Object.values(player.equipped || {}).filter(Boolean);
    power      = calculatePowerRating(stats, equipped, player.pet) || 0;
    powerLabel = getPowerLabel(power) || powerLabel;
  } catch(e) {}

  const maxHp = stats.maxHp || 100;
  const currentHp = Math.min(maxHp, Math.max(0, stats.hp ?? maxHp));
  const maxEnergy = stats.maxEnergy || 100;
  const currentEnergy = Math.min(maxEnergy, Math.max(0, stats.energy ?? maxEnergy));

  const gatesCleared = player.stats_history?.gatesCleared || 0;
  const pvpWins      = player.stats_history?.pvpWins || 0;
  const cls          = player.evolvedClass || player.class || 'Not assigned';
  const guildName    = player.guild || 'None';

  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 *${player.name}*`,
    player.equippedTitle ? `🎖️ "${player.equippedTitle}"` : null,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `${rankData.emoji} *Rank:* ${rankData.label}`,
    `⭐ *Level:* ${player.level || 1}`,
    `⚡ *Power:* ${power.toLocaleString()} ${powerLabel.emoji} ${powerLabel.label}`,
    `🎭 *Class:* ${cls}`,
    `🏰 *Guild:* ${guildName}`,
    ``,
    `❤️ HP: ${currentHp}/${maxHp}`,
    `⚡ Energy: ${currentEnergy}/${maxEnergy}`,
    ``,
    `🚪 Gates Cleared: ${gatesCleared}`,
    `⚔️ PvP Wins: ${pvpWins}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].filter(l => l !== null).join('\n');
}

function buildInventoryText(player) {
  const equipped  = player.equipped || {};
  let bagItems = [];
  const raw = player.inventory;
  if (Array.isArray(raw)) {
    bagItems = raw.filter(Boolean);
  } else if (raw && typeof raw === 'object') {
    bagItems = Object.entries(raw)
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => {
        const name = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        return { name: `${name} ×${qty}` };
      });
  }

  const gearMap = { weapon: '⚔️', armor: '🛡️', helmet: '⛑️', gloves: '🧤', boots: '👟', accessory: '💍' };
  const equippedLines = Object.entries(gearMap)
    .map(([slot, emoji]) => {
      const item = equipped[slot];
      return item ? `  ${emoji} ${item.name || item} *(${slot})*` : null;
    })
    .filter(Boolean);

  const bagLines = bagItems.slice(0, 10).map(item => `  📦 ${item.name || item}`).filter(Boolean);

  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🎒 *${player.name}'s Inventory*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `⚔️ *Equipped:*`,
    ...(equippedLines.length ? equippedLines : ['  Nothing equipped']),
    ``,
    `📦 *Bag (${bagItems.length} items):*`,
    ...(bagLines.length ? bagLines : ['  Bag is empty']),
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].filter(l => l !== null).join('\n');
}

function buildLeaderboardText(db) {
  const players = Object.values(db.users || {})
    .filter(p => p && p.name && !p.deleted)
    .sort((a, b) => (b.level || 1) - (a.level || 1))
    .slice(0, 10);

  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏆 *TOP HUNTERS*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ...players.map((p, i) => `${medals[i]} *${p.name}* — Lv.${p.level || 1} ${p.awakenRank || 'E'}-Rank`),
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');
}

function isProPlayer(player) {
  if (!player) return false;
  return !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
}

async function handleRPGIntent(message, sender, msg, personalityKey, db, saveDatabase) {
  const intent = detectRPGIntent(message);
  if (!intent) return { handled: false };

  // Strict restriction on database queries or critical system data
  if (intent === 'database') {
    if (!isOwnerOrCoOwner(sender, db)) {
      return {
        handled: true,
        text: `🚫 *ACCESS DENIED*\n\nOnly *Senku* and *Naruto* are authorized to access critical system and database records.\n\n_Not everyone is Senku, not everyone is Naruto!_`
      };
    }

    const totalUsers  = Object.keys(db.users || {}).length;
    const totalGuilds = Object.keys(db.guilds || {}).length;
    const totalBans   = Object.keys(db.bannedUsers || {}).length;
    const totalSerfs  = Object.keys(db.serfs?.assignments || {}).length;
    const memoryUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

    return {
      handled: true,
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📂 *CRITICAL DATABASE SUMMARY*`,
        `👑 _Authorized Access: Senku / Naruto_`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `👥 Registered Hunters: *${totalUsers}*`,
        `🏰 Active Guilds: *${totalGuilds}*`,
        `⚓ Serf Assignments: *${totalSerfs}*`,
        `🚫 Banned Players: *${totalBans}*`,
        `💾 Process Memory: *${memoryUsage} MB*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      ].join('\n')
    };
  }

  const player = db?.users?.[sender];
  if (player && !isProPlayer(player) && !isAdmin(sender, db)) {
    return {
      handled: true,
      text: '🔒 *Natural Language Intent Manager* is locked to Pro players!\nUse */prostore* to upgrade to Pro and unlock AI queries.'
    };
  }

  const contextInfo = msg?.message?.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid?.[0] || contextInfo?.participant;

  if (intent === 'profile') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    return { handled: true, text: buildProfileText(player) };
  }

  if (intent === 'viewOtherProfile') {
    let targetJid = mentionedJid;
    if (!targetJid) {
      const text = message.toLowerCase();
      for (const [jid, u] of Object.entries(db.users || {})) {
        if (u?.name && text.includes(u.name.toLowerCase())) {
          targetJid = jid;
          break;
        }
      }
    }
    if (!targetJid) return { handled: true, text: `Tag or mention the player you want to look up!` };

    const target = db.users?.[targetJid];
    if (!target) return { handled: true, text: `That player is not registered.` };

    if (target.profileLocked && !isOwnerOrCoOwner(sender, db) && !isAdmin(sender, db)) {
      return { handled: true, text: `❌ That player's profile is locked.` };
    }
    return { handled: true, text: buildProfileText(target) };
  }

  if (intent === 'rank') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet!` };
    return { handled: true, text: `⭐ You are Level ${player.level || 1} (${player.awakenRank || 'E'}-Rank).` };
  }

  if (intent === 'balance') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet!` };
    return { handled: true, text: `💠 You have *${(player.gold || 0).toLocaleString()} Nexus*.` };
  }

  if (intent === 'inventory') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet!` };
    return { handled: true, text: buildInventoryText(player) };
  }

  if (intent === 'leaderboard') {
    return { handled: true, text: buildLeaderboardText(db) };
  }

  return { handled: false };
}

module.exports = { handleRPGIntent, detectRPGIntent };
