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
    /\b(show|view|check|see|get|display)(?: me)?(?: my)? profile\b/i,
    /\b(show|check|view|see|get|display)(?: me)?(?: my)? (profile|stats|stat)\b/i,
    // Interrogatives need a possessive — "what are stats" is a general question, not your profile.
    /\bwhat(?:'s|s| is| are) (my|mine) (profile|stats|stat)\b/i,
  ],
  viewOtherProfile: [
    /\b(show|view|check|see|get|give me)(?: me)? @?(?!my\b|good\b|best\b|better\b|great\b|the\b|some\b)\w+(?:'s)? (profile|stats)\b/i,
    /\b(profile|stats) of @?\w+\b/i,
    /\b(what are|check) @?(?!my\b|good\b|best\b|better\b|great\b|the\b|some\b)\w+(?:'s)? (stats|profile)\b/i,
  ],
  rank: [
    /\b(what(?:'s|s| is)(?: my)?|check my|show my) rank\b/i,
  ],
  balance: [
    /\b(check my|show my|show me my)(?: wallet)? (gold|coins?|money|balance|currency|nexus|wallet)\b/i,
    /\bhow much (gold|coins?|money|balance|currency|nexus|wallet) do i have\b/i,
    // "how much money" / "what is money" without a possessive = general question → chat.
    /\bwhat(?:'s|s| is| are) my (gold|coins?|money|balance|currency|nexus|wallet)\b/i,
  ],
  inventory: [
    /\b(show|view|check|see)(?: me)?(?: my)? (inventory|items?|gear|bag)\b/i,
  ],
  guild: [
    /\b(show|view|check|see|what(?:'s|s| is))(?: my)? guild\b/i,
  ],
  leaderboard: [
    /\b(show|view|check|see)(?: me)?(?: the)? (leaderboard|top players?|rankings?)\b/i,
    // Bare "leaderboard" moved to RPG_BARE (whole-message only) — passing
    // mentions ("is there a leaderboard event?") must not hijack chat.
  ],
  ban: [
    /\bban @?\w+\b/i,
  ],
  unban: [
    /\bunban @?\w+\b/i,
  ],
  cooldowns: [
    /\b(check my|show my) (cooldowns?|timers?|cd\b(?!\s+[a-z]))/i,
    // "what are cooldowns" is a general question — possessive required for your timers.
    /\bwhat(?:'s|s| is| are) (my|mine) (cooldowns?|timers?|cd\b(?!\s+[a-z]))/i,
  ],
  skills: [
    /\b(show|check|list)(?: me)?(?: my)? (skills?|abilities)\b/i,
    // "what are skills" is a general question — possessive required for your list.
    /\bwhat(?:'s|s| is| are) (my|mine) (skills?|abilities)\b/i,
  ],
};

// Bare possessive queries ("my gold", "my guild") only count when they ARE the
// whole message — casual mentions ("my money is gone lol") fall through to chat.
const RPG_BARE = {
  balance:   [/^my (gold|coins?|money|balance|currency|nexus|wallet)$/],
  inventory: [/^my (inventory|items?|gear|bag)$/],
  guild:     [/^my guild$/],
  profile:   [/^my (stats|profile|hunter info|info)$/, /^who am i$/],
  rank:      [/^what rank am i$/,/^my rank$/],
  cooldowns: [/^my (cooldowns?|cds?|timers?)$/],
  skills:    [/^my (skills?|abilities)$/],
  leaderboard: [/^leaderboard$/, /^top( players?)?$/],
};

function detectRPGIntent(message) {
  for (const [intent, patterns] of Object.entries(RPG_INTENTS)) {
    for (const p of patterns) {
      if (p.test(message)) return intent;
    }
  }
  let bare = String(message || '').trim().replace(/^@\S+\s+/, '');
  const mName = bare.match(/^([A-Za-z][A-Za-z'\-]*)\s*[:,]?\s+(.*)$/);
  if (mName && /^(my|what|how|when|who|show|check|get|see|view|open|display)\b/i.test(mName[2])) bare = mName[2];
  bare = bare.toLowerCase().replace(/[?!.\s]+$/, '');
  for (const [intent, patterns] of Object.entries(RPG_BARE)) {
    for (const p of patterns) {
      if (p.test(bare)) return intent;
    }
  }
  return null;
}

// Intents with a LIVE handler. Anything detected but not listed here (ban/unban)
// must NEVER hijack chat — handleRPGIntent returns {handled:false} for those.
const HANDLED_INTENTS = new Set([
  'database', 'profile', 'viewOtherProfile', 'rank', 'balance',
  'inventory', 'leaderboard', 'guild', 'skills', 'cooldowns',
]);

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
    const equipped = Object.values(player.equippedGear || player.equipped || {}).filter(Boolean);
    power      = calculatePowerRating(stats, equipped, player.pet) || 0;
    powerLabel = getPowerLabel(power) || powerLabel;
  } catch(e) {}

  const maxHp = stats.maxHp || 100;
  const currentHp = Math.min(maxHp, Math.max(0, stats.hp ?? maxHp));
  const maxEnergy = stats.maxEnergy || 100;
  const currentEnergy = Math.min(maxEnergy, Math.max(0, stats.energy ?? maxEnergy));

  const gatesCleared = player.stats_history?.gatesCleared || 0;
  const pvpWins      = player.pvpWins || player.stats_history?.pvpWins || 0;
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
  const inv = player.inventory || {};
  const items = Array.isArray(inv.items) ? inv.items : [];
  const gear = items.filter(i => i && (i.isGear || i.type === 'gear'));
  const cons = items.filter(i => i && !(i.isGear || i.type === 'gear') && !i.isPetFood && i.type !== 'PetFood');
  const equipped = player.equippedGear || {};
  const eqLines = Object.entries(equipped)
    .filter(([, it]) => it && (it.name || typeof it === 'string'))
    .map(([slot, it]) => `  ✅ ${typeof it === 'string' ? it : it.name} *(${slot})*`);

  const gearLines = gear.slice(0, 8).map(g => {
    const eq = equipped[g.slot]?.name === g.name ? ' ✅' : '';
    return `  ⚔️ ${g.name || 'Gear'}${g.rarity ? ` [${g.rarity}]` : ''}${eq}`;
  });
  const stacked = {};
  for (const c of cons) {
    const nm = c.name || 'Item';
    stacked[nm] = (stacked[nm] || 0) + 1;
  }
  const consLines = Object.entries(stacked).slice(0, 8).map(([nm, n]) => `  📦 ${nm}${n > 1 ? ` ×${n}` : ''}`);
  const pots = [];
  if ((inv.healthPotions || 0) > 0) pots.push(`🩹 HP ×${inv.healthPotions}`);
  if ((inv.energyPotions || inv.manaPotions || 0) > 0) pots.push(`⚡ Energy ×${inv.energyPotions || inv.manaPotions}`);
  if ((inv.reviveTokens || 0) > 0) pots.push(`🎫 Revive ×${inv.reviveTokens}`);
  const cards = inv.cards || {};
  const gvc = (cards.gvc_gold || 0) + (cards.gvc_silver || 0) + (cards.gvc_bronze || 0);

  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🎒 *${player.name}'s Inventory*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `⚔️ *Equipped:*`,
    ...(eqLines.length ? eqLines : ['  Nothing equipped']),
    ``,
    `🛡️ *Gear (${gear.length}):*`,
    ...(gearLines.length ? gearLines : ['  None']),
    ...(gear.length > 8 ? [`  …and ${gear.length - 8} more`] : []),
    ``,
    `📦 *Bag:*`,
    ...(consLines.length ? consLines : ['  Empty']),
    ...(pots.length ? [`  ${pots.join(' | ')}`] : []),
    ...(gvc > 0 ? [`  🃏 Victory Cards ×${gvc}`] : []),
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');
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
  // No live handler (e.g. ban/unban chatter) → don't hijack, don't pro-gate. Fall to chat.
  if (!HANDLED_INTENTS.has(intent)) return { handled: false };

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
    if (!targetJid) return { handled: false }; // nobody identifiable → chat, not a nag

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

  if (intent === 'guild') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    if (!player.guild) return { handled: true, text: `You're not in a guild yet! Browse open guilds with */guild list* or found your own with */guild create*.` };
    const g = Object.values(db.guilds || {}).find(x => x && x.name === player.guild);
    if (!g) return { handled: true, text: `You're listed in *${player.guild}*, but that guild no longer exists. Use */guild leave* to clear it.` };
    const members = Array.isArray(g.members) ? g.members.length : 0;
    const gm = g.leader ? (db.users?.[g.leader]?.name || 'Unknown') : 'Unknown';
    return {
      handled: true,
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🏰 *${g.name}*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👑 Guild Master: *${gm}*`,
        `👥 Members: *${members}*`,
        `💠 Treasury: *${(g.treasury || 0).toLocaleString()} Nexus*`,
        `⭐ Guild Points: *${(g.guildPoints || 0).toLocaleString()} GP*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `💡 Full details: */myguild*`,
      ].join('\n'),
    };
  }

  if (intent === 'skills') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    const sk = player.skills;
    const list = [];
    const push = s => { if (!s) return; if (typeof s === 'string') list.push(s); else if (s.name) list.push(`${s.name}${s.energyCost ? ` (${s.energyCost}⚡)` : ''}`); };
    if (Array.isArray(sk)) sk.forEach(push);
    else if (sk && typeof sk === 'object') Object.values(sk).forEach(push);
    if (!list.length) return { handled: true, text: `You haven't learned any skills yet. Skills awaken as you level up — check */skills* for details.` };
    return { handled: true, text: [`⚡ *${player.name}'s Skills*`, ``, ...list.slice(0, 10).map(s => `  • ${s}`), ``, `💡 Use one in battle with */skill <name>*`].join('\n') };
  }

  if (intent === 'cooldowns') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    const now = Date.now();
    const fmt = ms => {
      if (ms <= 0) return '✅ Ready';
      const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
      if (h > 0) return `⏳ ${h}h ${m % 60}m`;
      if (m > 0) return `⏳ ${m}m`;
      return `⏳ ${Math.ceil(ms / 1000)}s`;
    };
    const lines = [`⏱️ *${player.name}'s Cooldowns*`, ``];
    lines.push(`🥷 Rob: ${player.stealCooldown && player.stealCooldown > now ? fmt(player.stealCooldown - now) : '✅ Ready'}`);
    const lastDaily = player.dailyQuest?.lastClaimed || 0;
    lines.push(`☀️ Daily: ${fmt(lastDaily + 24 * 3600 * 1000 - now)}`);
    lines.push(``, `💡 Full list: */cooldowns*`);
    return { handled: true, text: lines.join('\n') };
  }

  return { handled: false };
}

module.exports = { handleRPGIntent, detectRPGIntent };
