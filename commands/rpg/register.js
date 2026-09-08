// ═══════════════════════════════════════════════════════════════
// REGISTER — Astra Awakening
// - Requires hunter name + date of birth
// - Random awakening rank assigned
// - Nigerian time (WAT UTC+1) for all timestamps
// - After registration completes, the active bot DMs the player
//   a welcome message (the only DM that bypasses the serf gate)
// ═══════════════════════════════════════════════════════════════

const {
  rollAwakeningRank,
  buildStartingStats,
  getAwakeningMessage,
  calculatePowerRating,
  AWAKENING_RANKS,
} = require('../../rpg/utils/SoloLevelingCore');
const MultiSocketManager = require('../../bots/MultiSocketManager');

// ── Nigerian Time (WAT = UTC+1) ───────────────────────────────────────────────
function getNigerianTimestamp() {
  return new Date(Date.now() + 3600000)
    .toISOString().replace('T', ' ').slice(0, 19) + ' WAT';
}

// ── Date of birth parser ──────────────────────────────────────────────────────
// Accepts DD/MM/YYYY or DD-MM-YYYY
function parseDOB(str) {
  if (!str) return null;
  const parts = str.replace(/-/g, '/').split('/');
  if (parts.length !== 3) return null;

  const day   = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year  = parseInt(parts[2], 10);

  if ([day, month, year].some(isNaN)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  if (year < 1900 || year > new Date().getFullYear())  return null;

  const dob = new Date(year, month - 1, day);
  const now = new Date(Date.now() + 3600000);
  let age = now.getFullYear() - dob.getFullYear();
  if (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate())) age--;

  if (age < 13)  return { error: 'too_young' };
  if (age > 120) return null;

  return {
    age,
    formatted: `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`,
  };
}

// ── Pending registrations ─────────────────────────────────────────────────────
const pendingReg = {};

// Periodic cleanup of expired pending registrations (memory hygiene)
setInterval(() => {
  const now = Date.now();
  let pruned = 0;
  for (const sender of Object.keys(pendingReg)) {
    if (now > pendingReg[sender].expiresAt) {
      delete pendingReg[sender];
      pruned++;
    }
  }
  if (pruned > 0) console.log(`🧹 Pruned ${pruned} expired pending registrations`);
}, 5 * 60 * 1000); // check every 5 minutes

const RANK_BONUSES = {
  E: { manaStones: 500,   upgradePoints: 3  },
  D: { manaStones: 800,   upgradePoints: 4  },
  C: { manaStones: 1200,  upgradePoints: 6  },
  B: { manaStones: 2000,  upgradePoints: 8  },
  A: { manaStones: 3500,  upgradePoints: 12 },
  S: { manaStones: 6000,  upgradePoints: 20 },
};

function buildPlayer(sender, name, rank, stats, bonus, dob) {
  return {
    name,
    id:              sender,
    registeredAt:    Date.now(),
    registeredAtWAT: getNigerianTimestamp(),
    awakenRank:      rank,
    level:           1,
    xp:              0,
    totalXp:         0,   // lifetime XP (never reset) — drives the class-awaken threshold
    classAwakeningThreshold: 50000 + Math.floor(Math.random() * 100000), // random 50k–150k
    class:           null,
    classAssignedAt: null,
    classAwakenedAt: null,
    evolvedClass:    null,
    dateOfBirth:     dob.formatted,
    age:             dob.age,
    stats:           { ...stats },
    baseStats:       { ...stats },
    upgradePoints:   bonus.upgradePoints,
    statAllocations: { hp:0, atk:0, def:0, magicPower:0, speed:0, critChance:0, critDamage:0, lifesteal:0, energy:0 },
    manaCrystals:    bonus.manaStones,
    gold:            0,
    skills:          { active: [], locked: [], cooldowns: {} },
    inventory:       { weapons:[], armor:[], accessories:[], potions:[], artifacts:[], materials:[], keyStones:[] },
    equipped:        { weapon:null, armor:null, helmet:null, gloves:null, boots:null, accessory:null, artifact:null, artifact2:null },
    pet:             null,
    pets:            [],
    guild:           null,
    guildJoinedAt:   null,
    aura:            0,
    auraTitle:       null,
    inBattle:        false,
    inGate:          false,
    currentGateId:   null,
    awakening:       { tier:0, passives:[] },
    stats_history:   { gatesCleared:0, pvpWins:0, pvpLosses:0, monstersKilled:0, totalDamageDealt:0, pvpStreak:0 },
    deathCount:      0,
    lastDeathAt:     null,
    titles:          [],
    equippedTitle:   null,
    lastDaily:       null,
    lastWeekly:      null,
    lastMonthly:     null,
    lastRegen:       Date.now(),
    lastActive:      Date.now(),
    proStatus:       null,   // null | 'weekly' | 'monthly' | 'yearly'
    proExpiresAt:    null,
    banned:          false,
    afk:             false,
    pvpStreak:       0,
  };
}

function buildSuccessMsg(name, dob, rank, power, bonus) {
  const rankData = AWAKENING_RANKS[rank];
  const isRare   = ['B', 'A', 'S'].includes(rank);
  const systemMsg = getAwakeningMessage(rank);

  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    isRare ? `‼️ *RARE AWAKENING DETECTED* ‼️` : `「System」 *AWAKENING COMPLETE*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    systemMsg,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 Hunter: *${name}*`,
    `📅 D.O.B: *${dob.formatted}*`,
    `${rankData.emoji} Rank: *${rankData.label}*`,
    `⚡ Power Rating: *${power.toLocaleString()}*`,
    ``,
    `💠 *START BONUS:*`,
    `💎 ${bonus.manaStones.toLocaleString()} Mana Stones`,
    `📈 ${bonus.upgradePoints} Upgrade Points`,
    ``,
    `🎭 Class: *Not yet assigned*`,
    `   ↳ Your class reveals itself as you grow stronger.`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📌 *NEXT STEPS:*`,
    `/daily — Claim daily reward`,
    `/gates — View active gates`,
    `/profile — View your profile`,
    `/guild — Find or create a guild`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    rankData.description ? `\n${rankData.description}` : '',
  ].filter(l => l !== null).join('\n');
}

// Welcome DM — sent to the player right after /register completes.
// Bypasses the serf gate (the only DM that does). Sent by the active
// bot that processed the registration, from its own socket.
function buildWelcomeDM(name, rank) {
  const rankData = AWAKENING_RANKS[rank];
  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👋 *WELCOME TO ANI R.P.G, ${name.toUpperCase()}!*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `You just awakened as a *${rankData.label}* hunter. The System is now active for you.`,
    ``,
    `*🎮 GETTING STARTED*`,
    `→ \`/profile\` — view your stats, level & class`,
    `→ \`/daily\`   — claim daily Nexus & crystals`,
    `→ \`/dungeon\` — fight monsters for XP & loot`,
    `→ \`/pvp\`     — challenge other players`,
    `→ \`/shop\`    — buy potions & gear`,
    `→ \`/summon\`  — gacha pulls for artifacts`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⚓ *PICK YOUR SERF*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Want a bot to DM you (quest alerts, daily reminders, etc.)?`,
    ``,
    `1. Go to any group where the bot is active.`,
    `2. Run: \`/setserf @botname\``,
    `3. A mod confirms in the Mod GC.`,
    ``,
    `After that, only your chosen bot can DM you.`,
    `Mods and owners can DM you freely regardless.`,
    `This welcome DM is the ONLY DM exception.`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📌 See ALL commands: \`/help\``,
    `⚔️ Good luck, hunter!`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');
}

// Send the welcome DM to the player. The caller passes the bot's
// own socket — that's the active bot in the group where the user
// just ran /register. The DM bypasses the serf gate.
async function sendWelcomeDM(sock, sender, name, rank) {
  try {
    const dmJid = sender.endsWith('@lid')
      ? sender.replace(/@lid$/, '@s.whatsapp.net')
      : sender;
    const text = buildWelcomeDM(name, rank);
    await MultiSocketManager.safeSendDM(sock, dmJid, { text }, { welcome: true });
  } catch (e) {
    console.error('Welcome DM error:', e.message);
  }
}

module.exports = {
  name: 'register',
  aliases: ['reg', 'join'],
  description: 'Awaken as a hunter in the Astra world',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();

    // ── Already registered ─────────────────────────────────────────────────
    if (db.users[sender]) {
      const p        = db.users[sender];
      const rankData = AWAKENING_RANKS[p.awakenRank || 'E'] || { emoji:'⬜', label:'E-Rank' };
      const power    = calculatePowerRating(p.stats || {});
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `「System」 *ALREADY AWAKENED*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `👤 *${p.name}* | ${rankData.emoji} ${rankData.label}`,
          `⚡ Level ${p.level || 1} | Power: ${power.toLocaleString()}`,
          ``,
          `📌 Use /profile to view your full profile`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── Check if completing a pending registration (user sent DOB) ─────────
    const pending = pendingReg[sender];
    if (pending) {
      if (Date.now() > pending.expiresAt) {
        delete pendingReg[sender];
        // Fall through to re-initiate
      } else {
        // They're replying with DOB — first arg should be the DOB
        const dobArg = args[0];
        if (!dobArg) {
          return sock.sendMessage(chatId, {
            text: `📅 Please enter your date of birth to complete registration.\n\nFormat: /register DD/MM/YYYY\nExample: /register 15/08/2000\n\n⏳ Expires in ${Math.ceil((pending.expiresAt - Date.now()) / 60000)} min.`,
          }, { quoted: msg });
        }

        const dob = parseDOB(dobArg);
        if (!dob) {
          return sock.sendMessage(chatId, {
            text: `❌ Invalid format. Use DD/MM/YYYY\nExample: /register 15/08/2000`,
          }, { quoted: msg });
        }
        if (dob.error === 'too_young') {
          return sock.sendMessage(chatId, {
            text: `❌ You must be at least 13 years old to play Astra.`,
          }, { quoted: msg });
        }

        // Complete
        const { name, rank, stats, bonus, power } = pending;
        delete pendingReg[sender];

        db.users[sender] = buildPlayer(sender, name, rank, stats, bonus, dob);
        saveDatabase();

        // Welcome DM (only DM that bypasses the serf gate)
        await sendWelcomeDM(sock, sender, name, rank);

        return sock.sendMessage(chatId, {
          text: buildSuccessMsg(name, dob, rank, power, bonus),
        }, { quoted: msg });
      }
    }

    // ── Parse args — name and optional DOB in one command ─────────────────
    let nameArgs = [];
    let dobArg   = null;

    for (const arg of args) {
      if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(arg)) {
        dobArg = arg;
      } else {
        nameArgs.push(arg);
      }
    }

    const name = (nameArgs.join(' ').trim() || msg.pushName || 'Hunter')
      .substring(0, 20).replace(/[<>]/g, '');

    const rank  = rollAwakeningRank();
    const stats = buildStartingStats(rank);
    const bonus = RANK_BONUSES[rank];
    const power = calculatePowerRating(stats);

    // ── If DOB provided in same command — register immediately ─────────────
    if (dobArg) {
      const dob = parseDOB(dobArg);
      if (!dob) {
        return sock.sendMessage(chatId, {
          text: `❌ Invalid date format. Use DD/MM/YYYY\nExample: /register Sung Jin-Woo 25/04/1995`,
        }, { quoted: msg });
      }
      if (dob.error === 'too_young') {
        return sock.sendMessage(chatId, {
          text: `❌ You must be at least 13 years old to play Astra.`,
        }, { quoted: msg });
      }

      db.users[sender] = buildPlayer(sender, name, rank, stats, bonus, dob);
      saveDatabase();

      // Welcome DM (only DM that bypasses the serf gate)
      await sendWelcomeDM(sock, sender, name, rank);

      return sock.sendMessage(chatId, {
        text: buildSuccessMsg(name, dob, rank, power, bonus),
      }, { quoted: msg });
    }

    // ── No DOB — prompt for it ─────────────────────────────────────────────
    pendingReg[sender] = { name, rank, stats, bonus, power, expiresAt: Date.now() + 300000 };

    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `「System」 *AWAKENING INITIATED*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `👤 Hunter Name: *${name}*`,
        ``,
        `📅 *Enter your date of birth to complete:*`,
        ``,
        `Format: /register DD/MM/YYYY`,
        `Example: /register 15/08/2000`,
        ``,
        `⏳ This prompt expires in 5 minutes.`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    }, { quoted: msg });
  },
};
