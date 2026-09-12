/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         Astra — RPGIntentHandler                    ║
 * ║  Natural language RPG queries via personality chat   ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

const { calculatePowerRating, getPowerLabel, AWAKENING_RANKS, getXpRequired } = require('../rpg/utils/SoloLevelingCore');
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
  vitals: [
    /\bwhat(?:'s|s| is| are) my (hp|health|hitpoints|hit points|energy|mana|stamina|level|lvl)\b/i,
    /\b(check my|show my|show me my) (hp|health|hitpoints|hit points|energy|mana|stamina|level|lvl)\b/i,
    /\bhow much (hp|health|energy|mana)\b.{0,12}\b(do i have|have i|left)\b/i,
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
  // ── Batch-42: intent manager covers all systems ──
  pets: [
    /\b(?:my|show|view|list)\s+(?:active\s+)?pets?\b/i,
    /\bshow\s+(?:me\s+)?my\s+pet\s+team\b/i,
  ],
  quests: [
    /\bmy\s+(?:daily\s+)?quests?\b/i,
    /\bdaily\s+quest\s+status\b/i,
    /\bquest\s+progress\b/i,
  ],
  achievements: [
    /\bmy\s+achievements?\b/i,
    /\bachievement\s+progress\b/i,
  ],
  class: [
    /\bmy\s+class\b/i,
    /\bwhat\s+class\s+am\s+i\b/i,
    /\bmy\s+awakening\b/i,
  ],
  bank: [
    /\bmy\s+bank\b/i,
    /\bbank\s+balance\b/i,
  ],
  aura: [
    /\bmy\s+aura\b/i,
    /\bhow\s+much\s+aura\s+do\s+i\s+have\b/i,
  ],
  titles: [
    /\bmy\s+titles?\b/i,
  ],
  pass: [
    /\bmy\s+(?:battle\s*pass|astra\s*pass|pass)\b/i,
    /\b(?:battle\s*pass|astra\s*pass)\s+status\b/i,
  ],
  pvpstats: [
    /\bmy\s+pvp\b/i,
    /\bpvp\s+(?:record|stats?|wins|losses)\b/i,
  ],
  prostatus: [
    /\bam\s+i\s+pro\b/i,
    /\bmy\s+pro(?:\s+status)?\b/i,
    /\bpro\s+status\b/i,
  ],
  xp: [
    /\bmy\s+xp\b/i,
    /\bxp\s+progress\b/i,
    /\bhow\s+much\s+xp\b.{0,12}\bdo\s+i\s+have\b/i,
  ],
  crystals: [
    /\bmy\s+(?:mana\s+)?crystals?\b/i,
    /\bmy\s+mana\s+stones?\b/i,
  ],
  referral: [
    /\bmy\s+referral(?:\s+code)?\b/i,
    /\breferral\s+code\b/i,
  ],
  serf: [
    /\bmy\s+serf\b/i,
    /\bwho\s+is\s+my\s+serf\b/i,
  ],
  // NOTE: `help` lives in RPG_BARE only (whole-message, after bot-name
  // strip) so "Seraph, help" and "help" both land here.
};

// Bare possessive queries ("my gold", "my guild") only count when they ARE the
// whole message — casual mentions ("my money is gone lol") fall through to chat.
const RPG_BARE = {
  balance:   [/^my (gold|coins?|money|balance|currency|nexus|wallet)$/],
  inventory: [/^my (inventory|items?|gear|bag)$/],
  guild:     [/^my guild$/],
  profile:   [/^my (stats|profile|hunter info|info)$/, /^who am i$/],
  rank:      [/^what rank am i$/,/^my rank$/],
  vitals:    [/^my (hp|health|energy|mana|level|lvl)$/,/^my hp and level$/,/^my level and hp$/],
  cooldowns: [/^my (cooldowns?|cds?|timers?)$/],
  skills:    [/^my (skills?|abilities)$/],
  leaderboard: [/^leaderboard$/, /^top( players?)?$/],
  // ── Batch-42: bare forms for the new systems ──
  help:      [/^help$/, /^help me$/, /^what can you do$/, /^commands$/, /^bot commands$/, /^what commands$/],
  pets:      [/^pets$/, /^my pets?$/],
  quests:    [/^quests$/, /^my quests?$/, /^daily quests?$/],
  achievements: [/^achievements?$/, /^my achievements?$/],
  class:     [/^class$/, /^my class$/],
  bank:      [/^bank$/, /^my bank$/],
  aura:      [/^aura$/, /^my aura$/],
  titles:    [/^titles?$/, /^my titles?$/],
  pass:      [/^my pass$/, /^battle ?pass$/, /^astra pass$/],
  pvpstats:  [/^pvp$/, /^my pvp$/],
  prostatus: [/^pro$/, /^my pro$/, /^am i pro$/],
  xp:        [/^xp$/, /^my xp$/],
  crystals:  [/^crystals?$/, /^my crystals?$/, /^mana stones?$/, /^my mana stones?$/],
  referral:  [/^referral$/, /^my referral$/],
  serf:      [/^serf$/, /^my serf$/],
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
  'inventory', 'leaderboard', 'guild', 'skills', 'cooldowns', 'vitals',
  // Batch-42: all-systems coverage.
  'help', 'pets', 'quests', 'achievements', 'class', 'bank', 'aura',
  'titles', 'pass', 'pvpstats', 'prostatus', 'xp', 'crystals',
  'referral', 'serf',
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
  // Typing Race answers are plain chat — an active race wins before intents.
  try {
    const chatId = msg?.key?.remoteJid;
    if (chatId && typeof message === 'string' && message.trim()) {
      const TR = require('../rpg/games/TypingRace');
      const win = TR.checkAnswer ? TR.checkAnswer(db, chatId, sender, message, saveDatabase) : null;
      if (win && win.text) return { handled: true, text: win.text };
    }
  } catch (e) {}
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

  // Batch-42: help is FREE for everyone (never pro-gated) — it only
  // lists what the bots can answer, so free players can discover /help.
  if (intent === 'help') {
    return {
      handled: true,
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🤖 *What I can do*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Just ask me in plain words:`,
        `  👤 *"my stats"* · *"my profile"*`,
        `  💠 *"my nexus"* · 💎 *"my crystals"*`,
        `  🎒 *"my inventory"* · ⚔️ *"my skills"*`,
        `  🐾 *"my pets"* · 📋 *"my quests"*`,
        `  🏆 *"my achievements"* · 🎭 *"my class"*`,
        `  🏦 *"my bank"* · ✨ *"my aura"*`,
        `  🎖️ *"my titles"* · 🎫 *"my pass"*`,
        `  ⚔️ *"my pvp"* · 💎 *"am i pro"*`,
        `  ⏱️ *"my cooldowns"* · 🏆 *"leaderboard"*`,
        ``,
        `📌 Full command list: */help*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
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

  if (intent === 'vitals') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet!` };
    const st = player.stats || {};
    const maxHp = st.maxHp || 100;
    const hp = Math.min(maxHp, Math.max(0, st.hp ?? maxHp));
    const maxEn = st.maxEnergy || 100;
    const en = Math.min(maxEn, Math.max(0, st.energy ?? maxEn));
    return { handled: true, text: `❤️ HP: *${hp}/${maxHp}*  |  ⚡ Energy: *${en}/${maxEn}*  |  ⭐ Level *${player.level || 1}*` };
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

  // ── Batch-42: all-systems handlers ──
  if (intent === 'pets') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    let pets = [], eggs = [], active = null;
    try {
      const PM = require('../rpg/utils/PetManager');
      if (PM.getPlayerPets) pets = PM.getPlayerPets(sender) || [];
      const pd = PM.getPlayerData ? PM.getPlayerData(sender) : null;
      eggs = (pd && pd.eggs) || [];
      active = (pd && pd.activePet) || null;
    } catch (e) {}
    if (!pets.length && !eggs.length) {
      return { handled: true, text: `You have no pets yet! 🐾\n\n🥚 Eggs drop from dungeon floors\n🐣 Hatch with */pet hatch [#]*\n\n💡 Full list: */pet*` };
    }
    const lines = [`🐾 *${player.name}'s Pets (${pets.length})*`, ``];
    pets.slice(0, 5).forEach(p => lines.push(`  ${(p && p.emoji) || '🐾'} *${(p && (p.nickname || p.name)) || 'Pet'}* — Lv.${(p && p.level) || 1}${p && p.rarity ? ` [${p.rarity}]` : ''}`));
    if (pets.length > 5) lines.push(`  …and ${pets.length - 5} more`);
    if (active) lines.push(``, `⭐ Active: *${active.nickname || active.name || 'Pet'}*`);
    if (eggs.length) lines.push(`🥚 Eggs: *${eggs.length}* (*/pet hatch [#]*)`);
    lines.push(``, `💡 Full list: */pet*`);
    return { handled: true, text: lines.join('\n') };
  }

  if (intent === 'quests') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    const dq = player.dailyQuests || {};
    const qs = Array.isArray(dq.quests) ? dq.quests : [];
    const lines = [`📋 *${player.name}'s Daily Quests*`, ``];
    if (!qs.length) {
      lines.push(`No quests assigned yet — they auto-assign daily!`, ``, `💡 Check: */quest*`);
    } else {
      qs.slice(0, 4).forEach((q, i) => {
        const done = q.done || q.claimed || (q.progress || 0) >= (q.target || 1);
        lines.push(`  ${done ? '✅' : '⏳'} *${q.name || 'Quest ' + (i + 1)}* — ${(q.progress || 0)}/${q.target || '?'}`);
      });
      lines.push(``, `🔥 Streak: *${dq.streak || 0} day(s)*`, `💡 Claim: */quest claim <id>*`);
    }
    return { handled: true, text: lines.join('\n') };
  }

  if (intent === 'achievements') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    const un = (player.achievements && player.achievements.unlocked) || [];
    let defs = {};
    try { defs = require('../rpg/utils/AchievementDatabase').ACHIEVEMENTS || {}; } catch (e) {}
    const total = Object.keys(defs).length;
    if (!un.length) {
      return { handled: true, text: `No achievements unlocked yet! 🏆\n\nPlay, fight, and explore to earn them.\n\n💡 Full list: */achievements*` };
    }
    const nm = a => {
      const id = typeof a === 'string' ? a : (a && (a.id || a.name));
      return (id && defs[id] && defs[id].name) || (typeof a === 'string' ? a : (a && a.name)) || 'Achievement';
    };
    const lines = [`🏆 *${player.name}'s Achievements (${un.length}${total ? '/' + total : ''})*`, ``];
    un.slice(-3).reverse().forEach(a => lines.push(`  ✅ *${nm(a)}*`));
    if (un.length > 3) lines.push(`  …and ${un.length - 3} more`);
    lines.push(``, `💡 Full list: */achievements*`);
    return { handled: true, text: lines.join('\n') };
  }

  if (intent === 'class') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    const cls = player.evolvedClass || player.class;
    if (!cls) {
      return { handled: true, text: `You haven't awakened a class yet! 🎭\n\nKeep earning XP — awakening fires automatically at the threshold.\n\n💡 Details: */class*` };
    }
    return { handled: true, text: `🎭 *${player.name}'s Class*\n\nClass: *${cls}*${player.evolvedClass && player.class && player.evolvedClass !== player.class ? `\nBase: *${player.class}*` : ''}\n\n💡 Details: */class*` };
  }

  if (intent === 'bank') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    let bankName = null;
    try {
      const BS = require('../rpg/banking/BankingSystem');
      const b = BS.getPlayerBank ? BS.getPlayerBank(db, sender) : null;
      if (b && b.name) bankName = b.name;
    } catch (e) {}
    return { handled: true, text: `🏦 *${player.name}'s Bank*\n\n${bankName ? `Bank: *${bankName}*\n` : ''}💠 Vault: *${(player.bankGold || 0).toLocaleString()} Nexus*\n\n💡 Manage it: */bank*` };
  }

  if (intent === 'aura') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    return { handled: true, text: `✨ *${player.name}'s Aura*\n\nAura: *${(player.aura || 0).toLocaleString()}*${player.auraTitle ? `\nTitle: *${player.auraTitle}*` : ''}\n\n💡 Farm more: */aura*` };
  }

  if (intent === 'titles') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    const owned = player.titles || [];
    if (!owned.length) {
      return { handled: true, text: `You own no titles yet! 🎖️\n\nEarn them from events and dungeons.\n\n💡 Browse: */title*` };
    }
    const lines = [`🎖️ *${player.name}'s Titles (${owned.length})*`, ``];
    owned.slice(0, 6).forEach(t => lines.push(`  • *${typeof t === 'string' ? t : (t.name || 'Title')}*`));
    if (owned.length > 6) lines.push(`  …and ${owned.length - 6} more`);
    if (player.equippedTitle) lines.push(``, `✅ Equipped: *${player.equippedTitle}*`);
    lines.push(``, `💡 Equip one: */title equip <name>*`);
    return { handled: true, text: lines.join('\n') };
  }

  if (intent === 'pass') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    const bp = player.battlePass || {};
    const ap = player.astraPass || {};
    return { handled: true, text: `🎫 *${player.name}'s Passes*\n\n🛡️ Battle Pass: *Lv.${bp.level || 1}*\n🌟 Astra Pass: *Lv.${ap.level || 1}* (${(ap.xp || 0).toLocaleString()} XP)\n\n💡 Details: */pass*` };
  }

  if (intent === 'pvpstats') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    const w = player.pvpWins || player.stats_history?.pvpWins || 0;
    const l = player.pvpLosses || player.stats_history?.pvpLosses || 0;
    return { handled: true, text: `⚔️ *${player.name}'s PvP Record*\n\nWins: *${w}* | Losses: *${l}*\n\n💡 Fight: */pvp challenge @user*` };
  }

  if (intent === 'prostatus') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    if (isProPlayer(player)) {
      const days = Math.max(0, Math.floor((player.proExpiresAt - Date.now()) / 86400000));
      return { handled: true, text: `💎 *Pro ACTIVE* ✅\n\n${days > 0 ? `Expires in: *${days} day(s)*` : `Expires: *today*`}\n\nEnjoy the 2× rewards! 👑` };
    }
    return { handled: true, text: `You don't have Pro yet! 💎\n\nPro = 2× XP, Nexus & pass rewards, plus exclusive perks.\n\n💡 Upgrade: */prostore*` };
  }

  if (intent === 'xp') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    let req = null;
    try { req = getXpRequired ? getXpRequired(player.level || 1) : null; } catch (e) {}
    return { handled: true, text: `⭐ *${player.name}'s XP*\n\nLevel: *${player.level || 1}*\nXP: *${(player.xp || 0).toLocaleString()}${req ? ` / ${req.toLocaleString()}` : ''}*\nLifetime: *${(player.totalXp || 0).toLocaleString()}*\n\n💡 Full stats: */stats*` };
  }

  if (intent === 'crystals') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    return { handled: true, text: `💎 You have *${(player.manaCrystals || 0).toLocaleString()} Mana Stones*.` };
  }

  if (intent === 'referral') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    if (!player.referralCode) {
      return { handled: true, text: `You don't have a referral code yet!\n\n💡 Get one: */code*` };
    }
    return { handled: true, text: `🎟️ *Your Referral Code*\n\nCode: *${player.referralCode}*\n\nShare it — new hunters enter it during */register*!\n\n💡 Details: */code*` };
  }

  if (intent === 'serf') {
    const player = db.users?.[sender];
    if (!player) return { handled: true, text: `You're not registered yet! Use */register* to start.` };
    const a = db.serfs && db.serfs.assignments ? db.serfs.assignments[sender] : null;
    if (!a) {
      return { handled: true, text: `You have no serf serving you! ⚓\n\nSerfs are assigned by mods through serf codes.\n\n💡 Details: ask a mod about */setserf*` };
    }
    let botName = a.botKey || 'Unknown';
    try {
      const PM = require('./PersonalityManager');
      const info = PM.getPersonalityInfo ? PM.getPersonalityInfo(a.botKey) : null;
      if (info && info.displayName) botName = info.displayName;
    } catch (e) {}
    return { handled: true, text: `⚓ *Your Serf*\n\nServing bot: *${botName}*\n\nLoyal and at your service! 🙇` };
  }

  return { handled: false };
}

module.exports = { handleRPGIntent, detectRPGIntent };
