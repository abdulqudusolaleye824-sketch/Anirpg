/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — RPGIntentHandler                    ║
 * ║  Natural language RPG queries via personality chat   ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Handles queries like:
 *  "show me my profile"        → profile data
 *  "what rank am I"            → rank info
 *  "how much gold do I have"   → balance
 *  "show me my inventory"      → inventory
 *  "what guild am I in"        → guild info
 *  "show the leaderboard"      → top players
 *  "ban @user"                 → admin only
 *  "unban @user"               → admin only
 *  "show @user profile"        → respects profile lock
 *
 * Permission levels (from DB):
 *  owner    > coowner > admin > player
 */

'use strict';

const { calculatePowerRating, getPowerLabel, AWAKENING_RANKS, getXpRequired } = require('../rpg/utils/SoloLevelingCore');
const { OWNER_JID, COOWNER_JID } = require('../utils/constants');

// ── Permission helpers ────────────────────────────────────────────────────────
// Normalise a JID to its number portion for cross-format comparison
// Handles @lid, @s.whatsapp.net, and plain numbers
function normaliseJid(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function getRole(sender, db) {
  // Read from constants module (env-driven, with safe defaults).
  // db._config override takes precedence if present.
  const ownerJid   = (db._config?.ownerJid   || OWNER_JID);
  const coOwnerJid = (db._config?.coOwnerJid || COOWNER_JID || '');

  const senderNum   = normaliseJid(sender);
  const ownerNum    = normaliseJid(ownerJid);
  const coOwnerNum  = normaliseJid(coOwnerJid);

  if (senderNum && senderNum === ownerNum)   return 'owner';
  if (senderNum && senderNum === coOwnerNum) return 'coowner';
  if ((db.botMods || []).some(a => normaliseJid(a) === senderNum)) return 'admin';
  return 'player';
}

function isAdmin(sender, db) {
  const role = getRole(sender, db);
  return ['owner', 'coowner', 'admin'].includes(role);
}

function isOwnerOrCoOwner(sender, db) {
  return ['owner', 'coowner'].includes(getRole(sender, db));
}

// ── Intent patterns ───────────────────────────────────────────────────────────
const RPG_INTENTS = {
  profile: [
    /\b(show|view|check|see|what(?:'s| is))(?: me)?(?: my)? profile\b\b/i,
    /\bmy (stats|profile|hunter info|info)\b\b/i,
    /\bwho am i\b\b/i,
  ],
  viewOtherProfile: [
    /\b(show|view|check|see)(?: me)? @?\w+(?:'s)? profile\b\b/i,
    /\bprofile of @?\w+\b\b/i,
  ],
  rank: [
    /\b(what(?:'s| is)(?: my)?|check my|show my) rank\b\b/i,
    /\bwhat rank am i\b\b/i,
    /\bmy (awakening )?rank\b\b/i,
  ],
  balance: [
    /\b(how much|check my|what(?:'s| is)(?: my)?) (gold|coins?|money|balance|currency|funds)\b\b/i,
    /\bmy (gold|coins?|balance|money)\b\b/i,
  ],
  inventory: [
    /\b(show|view|check|see)(?: me)?(?: my)? (inventory|items?|gear|equipment|bag)\b\b/i,
    /\bmy (inventory|items?|gear|equipment)\b\b/i,
    /\bwhat (items?|gear) (do i have|am i wearing)\b\b/i,
  ],
  guild: [
    /\b(show|view|check|see|what(?:'s| is))(?: my)? guild\b\b/i,
    /\bwhat guild am i in\b\b/i,
    /\bmy guild( info)?\b\b/i,
  ],
  leaderboard: [
    /\b(show|view|check|see)(?: the)? (leaderboard|top players?|rankings?|best players?)\b\b/i,
    /\bwho(?:'s| is) (the best|winning|ranked|#?1|top)\b\b/i,
    /\bleaderboard\b\b/i,
  ],
  ban: [
    /\bban @?\w+\b\b/i,
    /\b(block|remove|kick out) @?\w+\b\b/i,
  ],
  unban: [
    /\bunban @?\w+\b\b/i,
    /\b(unblock|restore) @?\w+\b\b/i,
  ],
  playerInfo: [
    /\b(show|tell me about|check)(?: me)? @?\w+\b\b/i,
    /\bwho is @?\w+\b\b/i,
  ],
  cooldowns: [
    /\b(what(?:'s| are)(?: my)?|check my|show my) (cooldowns?|timers?|cd)\b/i,
    /\bwhen can i (claim|use|do)(?: my)? (daily|dungeon|rob|steal|pvp)\b/i,
    /\bam i (ready|able to|on cooldown)\b/i,
    /\bmy (cooldowns?|timers?)\b/i,
  ],
  skills: [
    /\b(what(?:'s| are)(?: my)?|show|check|list)(?: my)? (skills?|abilities|moves?|spells?)\b/i,
    /\bmy (skills?|abilities|spellbook)\b/i,
  ],
  class: [
    /\b(what(?:'s| is)(?: my)?|check my|show my) class\b/i,
    /\bwhat class am i\b/i,
    /\bmy class( info)?\b/i,
  ],
  titles: [
    /\b(what(?:'s| are)(?: my)?|show|check|list)(?: my)? titles?\b/i,
    /\bmy (titles?|badges?|achievements?)\b/i,
  ],
  dungeonHistory: [
    /\b(show|view|check)(?: my)? (dungeon|gate|raid) (history|log|record|stats)\b/i,
    /\bhow many (dungeons?|gates?|raids?) (have i|did i)\b/i,
    /\bmy (dungeon|gate|raid) (record|history|stats)\b/i,
  ],
  pvpRecord: [
    /\b(what(?:'s| is)(?: my)?|show|check)(?: my)? pvp (record|stats?|history|wins?|losses?)\b/i,
    /\bmy pvp (record|stats?|wins?|losses?)\b/i,
    /\bhow many pvp (wins?|losses?|battles?)\b/i,
  ],
  shop: [
    /\b(show|view|check|what(?:'s| is) in)(?: the)? shop\b/i,
    /\bwhat can i buy\b/i,
    /\bshop items?\b/i,
  ],
  activegates: [
    /\b(show|view|check|are there|list)(?: any)?(?: active)? gates?\b/i,
    /\bactive gates?\b/i,
    /\bwhat gates? (are|is) (open|active|available)\b/i,
  ],
  admins: [
    /\b(who are|show|list)(?: the)? (bot )?admins?\b/i,
    /\bwho(?:'s| is) (an )?admin\b/i,
  ],
  banned: [
    /\b(who(?:'s| is)|show|list)(?: the)? banned (users?|players?|people)\b/i,
    /\bban(ned)? list\b/i,
    /\bam i banned\b/i,
  ],
  transactionHistory: [
    /\b(show|view|check)(?: my)? (transaction|gold|payment|transfer) (history|log|record)\b/i,
    /\bmy (transaction|gold) history\b/i,
  ],
  pet: [
    /\b(what(?:'s| is)(?: my)?|show|check)(?: my)? pet\b/i,
    /\bmy (pet|companion|familiar)\b/i,
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

// ── Profile builder (matches /profile output format) ─────────────────────────
function buildProfileText(player) {
  if (!player) return null;

  const rank = player.awakenRank || 'E';

  // Safely resolve rank data — never throw on unknown rank strings
  let rankData = { emoji: '⬜', label: `${rank}-Rank` };
  try {
    const AR = AWAKENING_RANKS;
    if (AR && AR[rank]) rankData = AR[rank];
  } catch(e) {}

  // Safely calculate power
  // NOTE: `stats` must be declared in this scope (not inside the try) because
  // it is referenced again below for HP/Energy. A block-scoped `const stats`
  // caused "stats is not defined" when the AI answered a profile question.
  let power = 0;
  let powerLabel = { emoji: '⚪', label: 'Unknown' };
  let stats = player.stats || {};
  try {
    const equipped = Object.values(player.equipped || {}).filter(Boolean);
    power      = calculatePowerRating(stats, equipped, player.pet) || 0;
    powerLabel = getPowerLabel(power) || powerLabel;
  } catch(e) {}

  const gatesCleared = player.stats_history?.gatesCleared || 0;
  const pvpWins      = player.stats_history?.pvpWins || 0;

  const cls         = player.evolvedClass || player.class || 'Not assigned';
  const guildName   = player.guild || 'None';

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
    `❤️ HP: ${stats.hp || 0}/${stats.maxHp || 100}`,
    `⚡ Energy: ${stats.energy || 0}/${stats.maxEnergy || 100}`,
    ``,
    `🚪 Gates Cleared: ${gatesCleared}`,
    `⚔️ PvP Wins: ${pvpWins}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].filter(l => l !== null).join('\n');
}

// ── Inventory builder ─────────────────────────────────────────────────────────
function buildInventoryText(player) {
  const equipped  = player.equipped || {};

  // inventory can be an Object (legacy: { healthPotions: 2, ... })
  // or an Array (new format: [{ name, ... }, ...])
  // Normalise to a display-friendly array
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

  const gearMap = {
    weapon: '⚔️', armor: '🛡️', helmet: '⛑️',
    gloves: '🧤', boots: '👟', accessory: '💍',
    artifact: '🔮', artifact2: '🔮',
  };

  const equippedLines = Object.entries(gearMap)
    .map(([slot, emoji]) => {
      const item = equipped[slot];
      return item ? `  ${emoji} ${item.name || item} *(${slot})*` : null;
    })
    .filter(Boolean);

  const bagLines = bagItems
    .slice(0, 10)
    .map(item => `  📦 ${item.name || item}`)
    .filter(Boolean);

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
    bagItems.length > 10 ? `  ...and ${bagItems.length - 10} more` : null,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].filter(l => l !== null).join('\n');
}

// ── Leaderboard builder ───────────────────────────────────────────────────────
function buildLeaderboardText(db) {
  const players = Object.values(db.users || {})
    .filter(p => p && p.name && !p.deleted)
    .sort((a, b) => {
      const levelDiff = (b.level || 1) - (a.level || 1);
      if (levelDiff !== 0) return levelDiff;
      return (b.xp || 0) - (a.xp || 0);
    })
    .slice(0, 10);

  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏆 *TOP HUNTERS*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    ...players.map((p, i) => {
      const rank = p.awakenRank || 'E';
      return `${medals[i]} *${p.name}* — Lv.${p.level || 1} ${rank}-Rank`;
    }),
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ];

  return lines.join('\n');
}

// ── Permission denial lines per personality ───────────────────────────────────
const DENIED = {
  hinata:  (cmd) => `I-I'm sorry... that command is for admins only. I don't have permission to do that for you. 🥺 Try asking an admin!`,
  lunar:   (cmd) => `Scientifically speaking, you'd need admin clearance for that. The data is locked! 🔬`,
  aria:    (cmd) => `I'm afraid that action requires administrative authority. You are not authorised.`,
  kira:    (cmd) => `Clever attempt. But you don't have the clearance for that. Nice try though.`,
  zephyr:  (cmd) => `Nah fam, that's admin-only territory. Can't do that for you.`,
  nova:    (cmd) => `OH! Sorry!! That one's for admins only!! Ask an admin to do it!! 💥`,
  void:    (cmd) => `Access denied.`,
  seraph:  (cmd) => `The ancient gates are sealed to you, traveller. Only administrators may pass.`,
  echo:    (cmd) => `Oh interesting — you tried to do something restricted! Sadly, only admins can do that. Curious, isn't it?`,
  raven:   (cmd) => `How deliciously bold. But that command belongs to the privileged few. You are not among them.`,
  jinx:    (cmd) => `Oops! Off limits! That's admin stuff and you're definitely not one hehe 😈`,
};

const LOCKED_PROFILE = {
  hinata:  () => `T-that player has locked their profile... I can't show it to you. Only admins can see it. 🥺`,
  lunar:   () => `Profile access denied! Their data is encrypted behind a privacy lock. Only admins can bypass it.`,
  aria:    () => `This profile is set to private. Unauthorised access is not permitted.`,
  kira:    () => `Their profile is locked. Sensible move on their part. You can't see it.`,
  zephyr:  () => `Yo, that player locked their profile. Can't show you that, no cap.`,
  nova:    () => `LOCKED PROFILE DETECTED!! I can't show that, it's private!!`,
  void:    () => `Profile locked.`,
  seraph:  () => `This soul has drawn a veil around themselves. Only those with authority may peer within.`,
  echo:    () => `Oh! Their profile is locked. Isn't that fascinating? Some prefer their secrets. I can't show you.`,
  raven:   () => `Behind a locked door. How theatrical. Only admins hold the key.`,
  jinx:    () => `Locked locked locked! Can't peek in there, sorry not sorry 😜`,
};

// ── Main handler ──────────────────────────────────────────────────────────────
/**
 * Try to handle an RPG query from natural language.
 * Returns { handled: true, text, attachment? } or { handled: false }
 */
async function handleRPGIntent(message, sender, msg, personalityKey, db, saveDatabase) {
  const intent = detectRPGIntent(message);
  if (!intent) return { handled: false };

  const displayName = require('./PersonalityManager').getDisplayName(personalityKey);
  const denied      = DENIED[personalityKey]     || DENIED.aria;
  const locked      = LOCKED_PROFILE[personalityKey] || LOCKED_PROFILE.aria;

  // Extract mentioned JID if any
  const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                    || msg.message?.extendedTextMessage?.contextInfo?.participant;

  // ── /profile (self) ────────────────────────────────────────────────────────
  if (intent === 'profile') {
    const player = db.users?.[sender];
    if (!player) {
      return { handled: true, text: `You're not registered yet! Use */register* to start your hunter journey.` };
    }
    return { handled: true, text: buildProfileText(player) };
  }

  // ── /profile @other ────────────────────────────────────────────────────────
  if (intent === 'viewOtherProfile' || intent === 'playerInfo') {
    if (!mentionedJid) {
      return { handled: true, text: `Tag the player you want to look up!` };
    }
    const target = db.users?.[mentionedJid];
    if (!target) {
      return { handled: true, text: `That player isn't registered.` };
    }
    // Check profile lock
    if (target.profileLocked && !isAdmin(sender, db)) {
      return { handled: true, text: locked() };
    }
    return { handled: true, text: buildProfileText(target) };
  }

  // ── Rank ───────────────────────────────────────────────────────────────────
  if (intent === 'rank') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* first.` };
    const rank = player.awakenRank || 'E';
    let rankData;
    try { rankData = AWAKENING_RANKS[rank]; } catch(e) {}
    rankData = rankData || { emoji: '⬜', label: `${rank}-Rank` };
    return { handled: true, text: `${rankData.emoji} You are *${rankData.label}* — Level ${player.level || 1}.` };
  }

  // ── Balance ────────────────────────────────────────────────────────────────
  if (intent === 'balance') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* first.` };
    const gold = player.gold || player.coins || player.balance || 0;
    return { handled: true, text: `💠 You have *${gold.toLocaleString()} gold*.` };
  }

  // ── Inventory ──────────────────────────────────────────────────────────────
  if (intent === 'inventory') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* first.` };
    return { handled: true, text: buildInventoryText(player) };
  }

  // ── Guild ──────────────────────────────────────────────────────────────────
  if (intent === 'guild') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* first.` };
    if (!player.guild) {
      return { handled: true, text: `You're not in a guild yet. Use */guild create* or */guild join* to get started.` };
    }
    const guild = db.guilds?.[player.guild];
    if (!guild) return { handled: true, text: `You're listed in guild *${player.guild}* but I couldn't find its data.` };
    return {
      handled: true,
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🏰 *${guild.name}*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👑 Master: ${guild.master || 'Unknown'}`,
        `👥 Members: ${(guild.members || []).length}`,
        `⭐ Level: ${guild.level || 1}`,
        `🏆 Points: ${guild.points || 0}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    };
  }

  // ── Leaderboard ────────────────────────────────────────────────────────────
  if (intent === 'leaderboard') {
    return { handled: true, text: buildLeaderboardText(db) };
  }

  // ── Ban (admin only) ───────────────────────────────────────────────────────
  if (intent === 'ban') {
    if (!isAdmin(sender, db)) {
      return { handled: true, text: denied('ban') };
    }
    if (!mentionedJid) {
      return { handled: true, text: `Tag the player you want to ban.` };
    }

    const ownerJid = OWNER_JID;
    if (mentionedJid === ownerJid) {
      return { handled: true, text: `I can't ban the owner. Nice try though.` };
    }
    if ((db.botMods || []).includes(mentionedJid) && !isOwnerOrCoOwner(sender, db)) {
      return { handled: true, text: `You can't ban another admin.` };
    }

    if (!db.bannedUsers) db.bannedUsers = {};
    const targetName = db.users?.[mentionedJid]?.name || mentionedJid.split('@')[0];

    // Extract reason from message
    const reasonMatch = message.match(/\bban\b.{0,30}(?:for|because|reason[:\s]+)(.+)/i);
    const reason = reasonMatch?.[1]?.trim() || 'No reason provided';

    db.bannedUsers[mentionedJid] = {
      bannedBy: sender,
      bannedAt: Date.now(),
      reason,
    };
    saveDatabase();

    return {
      handled: true,
      text: [
        `🚫 *${targetName}* has been banned.`,
        `📝 Reason: ${reason}`,
      ].join('\n'),
    };
  }

  // ── Unban (admin only) ────────────────────────────────────────────────────
  if (intent === 'unban') {
    if (!isAdmin(sender, db)) {
      return { handled: true, text: denied('unban') };
    }
    if (!mentionedJid) {
      return { handled: true, text: `Tag the player you want to unban.` };
    }

    if (!db.bannedUsers?.[mentionedJid]) {
      const name = db.users?.[mentionedJid]?.name || mentionedJid.split('@')[0];
      return { handled: true, text: `*${name}* isn't currently banned.` };
    }

    const targetName = db.users?.[mentionedJid]?.name || mentionedJid.split('@')[0];
    delete db.bannedUsers[mentionedJid];
    saveDatabase();

    return { handled: true, text: `✅ *${targetName}* has been unbanned.` };
  }

  // ── Cooldowns ──────────────────────────────────────────────────────────────
  if (intent === 'cooldowns') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* first.` };

    const now = Date.now();
    const fmt = (ms) => {
      if (ms <= 0) return '✅ Ready';
      const s = Math.ceil(ms / 1000);
      if (s < 60) return `⏳ ${s}s`;
      const m = Math.floor(s / 60), r = s % 60;
      if (m < 60) return `⏳ ${m}m ${r}s`;
      return `⏳ ${Math.floor(m/60)}h ${m%60}m`;
    };

    const dailyCd  = player.dailyQuest?.lastClaimed ? Math.max(0,(player.dailyQuest.lastClaimed + 86400000) - now) : 0;
    const weeklyCd = player.weeklyLastClaimed ? Math.max(0,(player.weeklyLastClaimed + 604800000) - now) : 0;
    const robCd    = player.stealCooldown ? Math.max(0, player.stealCooldown - now) : 0;
    const pvpReady = !player.pvpBattle;

    return {
      handled: true,
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `⏱️ *${player.name}'s Cooldowns*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `📅 Daily: ${fmt(dailyCd)}`,
        `📆 Weekly: ${fmt(weeklyCd)}`,
        `🦹 Rob: ${fmt(robCd)}`,
        `⚔️ PvP: ${pvpReady ? '✅ Ready' : '🔴 In Battle'}`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    };
  }

  // ── Skills ─────────────────────────────────────────────────────────────────
  if (intent === 'skills') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* first.` };

    const equipped = player.equippedSkills || player.skills || [];
    const library  = player.availableSkills || [];

    if (!equipped.length && !library.length) {
      return { handled: true, text: `You haven't unlocked any skills yet. Use */skillchoice* after leveling up!` };
    }

    const FILLS = ['⬜','🟦','🟩','🟨','🟧','🟥'];
    const bar = (lv) => (FILLS[Math.min(lv,5)] || '🟥').repeat(lv) + '⬜'.repeat(Math.max(0,5-lv));

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚡ *${player.name}'s Skills*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `*Equipped (${equipped.length}):*`,
      ...equipped.map((s,i) => `  ${i+1}. *${s.name}* Lv${s.level||1} ${bar(s.level||1)}`),
      library.length ? `\n*Library (${library.length}):*` : null,
      ...library.slice(0,5).map((s,i) => `  ${i+1}. ${s.name} Lv${s.level||1}`),
      library.length > 5 ? `  ...and ${library.length-5} more` : null,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].filter(l => l !== null);

    return { handled: true, text: lines.join('\n') };
  }

  // ── Class ──────────────────────────────────────────────────────────────────
  if (intent === 'class') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* first.` };

    const cls     = player.class || null;
    const evolved = player.evolvedClass || null;

    if (!cls) return { handled: true, text: `You haven't chosen a class yet! Use */class* to pick one.` };

    return {
      handled: true,
      text: evolved
        ? `🎭 You are a *${evolved}* *(Evolved ${cls})*`
        : `🎭 You are a *${cls}*. Keep leveling to evolve!`,
    };
  }

  // ── Titles ─────────────────────────────────────────────────────────────────
  if (intent === 'titles') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* first.` };

    const owned    = player.titles || [];
    const equipped = player.equippedTitle;

    if (!owned.length) {
      return { handled: true, text: `You haven't earned any titles yet. Keep playing to unlock them!` };
    }

    let TitleDefs = {};
    try { TitleDefs = require('../rpg/utils/TitleSystem').TITLES || {}; } catch(e) {}

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🎖️ *${player.name}'s Titles* (${owned.length})`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      ...owned.map(id => {
        const def  = TitleDefs[id];
        const name = def?.display || id;
        const eq   = id === equipped ? ' *(equipped)*' : '';
        return `  🎖️ ${name}${eq}`;
      }),
      ``,
      `Use */title equip <name>* to equip one.`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    return { handled: true, text: lines.join('\n') };
  }

  // ── Dungeon history ────────────────────────────────────────────────────────
  if (intent === 'dungeonHistory') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* first.` };

    const h = player.stats_history || {};
    return {
      handled: true,
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🚪 *${player.name}'s Dungeon Record*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `🚪 Gates Cleared: ${h.gatesCleared || 0}`,
        `💀 Deaths: ${player.deathCount || 0}`,
        `🏆 Bosses Defeated: ${h.bossesDefeated || 0}`,
        `🌟 Highest Rank Cleared: ${h.highestGateRank || 'None'}`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    };
  }

  // ── PvP record ─────────────────────────────────────────────────────────────
  if (intent === 'pvpRecord') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* first.` };

    const h = player.stats_history || {};
    const wins   = h.pvpWins   || 0;
    const losses = h.pvpLosses || 0;
    const total  = wins + losses;
    const wr     = total > 0 ? `${Math.round((wins/total)*100)}%` : 'N/A';

    return {
      handled: true,
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `⚔️ *${player.name}'s PvP Record*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `✅ Wins: ${wins}`,
        `❌ Losses: ${losses}`,
        `🎯 Win Rate: ${wr}`,
        `🔥 Streak: ${h.pvpStreak || 0}`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    };
  }

  // ── Shop ───────────────────────────────────────────────────────────────────
  if (intent === 'shop') {
    const CONSUMABLES = [
      { id:1, name:'Health Potion',    emoji:'🩹', desc:'Restores 50% HP',               cost:800   },
      { id:2, name:'Energy Potion',    emoji:'⚡', desc:'Restores 50% Energy',            cost:600   },
      { id:3, name:'Revive Token',     emoji:'🎫', desc:'Auto-revive once in dungeon',    cost:3000  },
      { id:4, name:'Luck Potion',      emoji:'🍀', desc:'+25% catch rate & casino odds',  cost:2000  },
      { id:5, name:'XP Booster',       emoji:'✨', desc:'+50% XP for 3 battles',          cost:5000  },
      { id:6, name:'Nexus Multiplier',  emoji:'💰', desc:'Next 3 wins give 2x gold',       cost:8000  },
      { id:7, name:'Shield Scroll',    emoji:'🛡️', desc:'Absorbs one hit in next fight',  cost:4000  },
      { id:8, name:'Elixir of Might',  emoji:'💪', desc:'+20 ATK for next 5 battles',     cost:12000 },
    ];

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🛒 *SHOP — Consumables*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      ...CONSUMABLES.map(c => `${c.emoji} *${c.name}* — ${c.cost.toLocaleString()}💠\n   ${c.desc}`),
      ``,
      `Use */shop* to browse weapons & gear.`,
      `Use */buy <item name>* to purchase.`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    return { handled: true, text: lines.join('\n') };
  }

  // ── Active gates ───────────────────────────────────────────────────────────
  if (intent === 'activegates') {
    try {
      const { GateManager } = require('../rpg/dungeons/GateManager');
      const chatId = msg?.key?.remoteJid;
      const active = chatId ? GateManager.getActiveGatesForChat(chatId) : [];

      if (!active.length) {
        return { handled: true, text: `「System」 No active gates detected in this area.\nGates spawn periodically — stay alert.` };
      }

      const lines = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🚪 *ACTIVE GATES*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        ...active.map(g => `${g.rankEmoji || '🚪'} *[${g.rank}-Rank]* ${g.name}\n   ID: ${g.id} | Status: ${g.status}`),
        ``,
        `Use */gates status <id>* for details.`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ];

      return { handled: true, text: lines.join('\n') };
    } catch(e) {
      return { handled: true, text: `No gate data available right now.` };
    }
  }

  // ── Admins list ────────────────────────────────────────────────────────────
  if (intent === 'admins') {
    const ownerJid   = OWNER_JID;
    const coOwnerJid = COOWNER_JID || '';
    const admins     = db.botMods || [];

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👑 *BOT ADMINS*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `👑 Owner: ${db.users?.[ownerJid]?.name || ownerJid.split('@')[0]}`,
      coOwnerJid ? `🌟 Co-Owner: ${db.users?.[coOwnerJid]?.name || coOwnerJid.split('@')[0]}` : null,
      admins.length ? `\n🛡️ *Admins (${admins.length}):*` : `\n🛡️ No additional admins.`,
      ...admins.map(jid => `  • ${db.users?.[jid]?.name || jid.split('@')[0]}`),
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].filter(l => l !== null);

    return { handled: true, text: lines.join('\n') };
  }

  // ── Banned list ────────────────────────────────────────────────────────────
  if (intent === 'banned') {
    // "am I banned" — anyone can ask about themselves
    const selfCheck = /\bam i banned\b\b/i.test(message);
    if (selfCheck) {
      const isBanned = !!db.bannedUsers?.[sender];
      return {
        handled: true,
        text: isBanned
          ? `🚫 Yes, you are banned. Reason: ${db.bannedUsers[sender].reason || 'No reason given'}`
          : `✅ You are not banned.`,
      };
    }

    // Full list — admin only
    if (!isAdmin(sender, db)) {
      return { handled: true, text: denied('banned') };
    }

    const banned = Object.entries(db.bannedUsers || {});
    if (!banned.length) {
      return { handled: true, text: `✅ No banned users.` };
    }

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🚫 *BANNED USERS (${banned.length})*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      ...banned.slice(0,15).map(([jid, data]) => {
        const name = db.users?.[jid]?.name || jid.split('@')[0];
        return `🚫 *${name}*\n   Reason: ${data.reason || 'None'}`;
      }),
      banned.length > 15 ? `\n...and ${banned.length - 15} more` : null,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].filter(l => l !== null);

    return { handled: true, text: lines.join('\n') };
  }

  // ── Transaction history ────────────────────────────────────────────────────
  if (intent === 'transactionHistory') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* first.` };

    try {
      const { buildHistoryText } = require('../rpg/utils/TransactionLog');
      const historyText = buildHistoryText(player);
      return {
        handled: true,
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📜 *Transaction History*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          historyText || 'No transactions yet.',
          ``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      };
    } catch(e) {
      return { handled: true, text: `Transaction history unavailable right now.` };
    }
  }

  // ── Pet ────────────────────────────────────────────────────────────────────
  if (intent === 'pet') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* first.` };

    const pet = player.pet;
    if (!pet) {
      return { handled: true, text: `You don't have a pet yet! Use */catch* to find one in the wild.` };
    }

    return {
      handled: true,
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🐾 *${player.name}'s Pet*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `${pet.emoji || '🐾'} *${pet.name}*`,
        `⭐ Level: ${pet.level || 1}`,
        `❤️ HP: ${pet.hp || 0}/${pet.maxHp || 100}`,
        pet.ability ? `✨ Ability: ${pet.ability}` : null,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].filter(l => l !== null).join('\n'),
    };
  }

  return { handled: false };
}

module.exports = { handleRPGIntent, detectRPGIntent };
