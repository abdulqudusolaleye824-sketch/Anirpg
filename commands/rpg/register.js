// ═══════════════════════════════════════════════════════════════
// REGISTER — Astra Awakening (multi-message flow)
// /register [name]            → BEGINNING REGISTRATION, asks for DOB reply
// <plain DD/MM/YYYY reply>    → 13+ age gate, asks for referral-code reply
// <plain CODE / NIL reply>    → SUCCESSFULLY REGISTERED → COMPLETE
// One-shot /register Name DD/MM/YYYY [CODE] still works.
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
const RegState = require('../../rpg/utils/RegistrationState');
const Referrals = require('../../rpg/utils/ReferralSystem');
const UI = require('../../rpg/utils/UI');

function getNigerianTimestamp() {
  return new Date(Date.now() + 3600000)
    .toISOString().replace('T', ' ').slice(0, 19) + ' WAT';
}

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

const DOB_RE = /^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/;
const SKIP_RE = /^(nil|none|no|skip|continue|n\/a|-)$/i;

const RANK_BONUSES = {
  E: { manaStones: 500,   upgradePoints: 3  },
  D: { manaStones: 800,   upgradePoints: 4  },
  C: { manaStones: 1200,  upgradePoints: 6  },
  B: { manaStones: 2000,  upgradePoints: 8  },
  A: { manaStones: 3500,  upgradePoints: 12 },
  S: { manaStones: 6000,  upgradePoints: 20 },
};

function buildPlayer(sender, name, rank, stats, bonus, dob, db) {
  const p = {
    name,
    id:              sender,
    registeredAt:    Date.now(),
    registeredAtWAT: getNigerianTimestamp(),
    awakenRank:      rank,
    level:           1,
    xp:              0,
    totalXp:         0,
    classAwakeningThreshold: 50000 + Math.floor(Math.random() * 100000),
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
    proStatus:       null,
    proExpiresAt:    null,
    banned:          false,
    afk:             false,
    pvpStreak:       0,
    // Starter kit: 1 name-change card + 1 seticon token (500 PC value each)
    cards:           { namechange: 1, seticon: 1 },
    referredBy:      null,
    referralLvl3Paid: false,
  };
  try { Referrals.ensureProfile(db, p); } catch (e) {}
  return p;
}

function buildSuccessMsg(name, dob, rank, power, bonus, extra = {}) {
  const rankData = AWAKENING_RANKS[rank];
  const isRare   = ['B', 'A', 'S'].includes(rank);
  const systemMsg = getAwakeningMessage(rank);

  return [
    UI.FREE_BAR,
    isRare ? `‼️ *RARE AWAKENING DETECTED* ‼️` : `「System」 *SUCCESSFULLY REGISTERED*`,
    UI.FREE_BAR,
    ``,
    systemMsg,
    ``,
    UI.FREE_BAR,
    `👤 Hunter: *${name}*`,
    `📅 D.O.B: *${dob.formatted}*`,
    `${rankData.emoji} Rank: *${rankData.label}*`,
    `⚡ Power Rating: *${power.toLocaleString()}*`,
    ``,
    `💠 *START BONUS:*`,
    `💎 ${bonus.manaStones.toLocaleString()} Mana Stones`,
    `📈 ${bonus.upgradePoints} Upgrade Points`,
    `✏️ 1 Name-Change Card (for /setname)`,
    `🖼️ 1 Seticon Token (for /seticon)`,
    extra.referrerName ? `🔗 Referred by: *${extra.referrerName}*` : null,
    ``,
    `🎭 Class: *Not yet assigned*`,
    `   ↳ Your class reveals itself as you grow stronger.`,
    ``,
    UI.FREE_BAR,
    `📌 *NEXT STEPS:*`,
    `/daily — Claim daily reward`,
    `/gates — View active gates`,
    `/profile — View your profile`,
    `/guild — Find or create a guild`,
    UI.FREE_BAR,
    rankData.description ? `\n${rankData.description}` : '',
  ].filter(l => l !== null).join('\n') + `\n${UI.upsell()}`;
}

function buildCompleteMsg(name, rank) {
  const rankData = AWAKENING_RANKS[rank] || {};
  return [
    UI.FREE_BAR,
    `✅ *REGISTRATION COMPLETE*`,
    UI.FREE_BAR,
    ``,
    `Welcome to the System, *${name}*! ${rankData.emoji || ''}`,
    `Your hunter journey has begun.`,
    ``,
    `🎟️ Your referral code: use */code* to view & share it.`,
    `💠 Earn *10,000 Nexus* every time a recruit hits Lv.3!`,
    UI.FREE_BAR,
  ].join('\n');
}

function buildWelcomeDM(name, rank) {
  const rankData = AWAKENING_RANKS[rank];
  return [
    UI.FREE_BAR,
    `👋 *WELCOME TO ANI R.P.G, ${name.toUpperCase()}!*`,
    UI.FREE_BAR,
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
    UI.FREE_BAR,
    `⚓ *PICK YOUR SERF*`,
    UI.FREE_BAR,
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
    UI.FREE_BAR,
    `📌 See ALL commands: \`/help\``,
    `⚔️ Good luck, hunter!`,
    UI.FREE_BAR,
  ].join('\n') + `\n${UI.upsell()}`;
}

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

function rollPending(name, sender) {
  // HARDCODED (batch-40): co-owner always awakens S-rank.
  const rank  = isCoowner(sender) ? 'S' : rollAwakeningRank(name + Date.now());
  const stats = buildStartingStats(rank);
  const bonus = RANK_BONUSES[rank];
  const power = calculatePowerRating(stats);
  return { name, rank, stats, bonus, power };
}

// HARDCODED (batch-40): co-owner identity check (bare-number, LID-safe).
function isCoowner(sender) {
  try {
    const { COOWNER_JID } = require('../../utils/constants');
    const bare = (j) => String(j || '').split('@')[0].split(':')[0];
    return !!COOWNER_JID && !!sender && bare(sender) === bare(COOWNER_JID);
  } catch (e) { return false; }
}

function beginningMsg(name, sender) {
  return [
    `「System」 *BEGINNING REGISTRATION*`,
    UI.FREE_BAR,
    ``,
    `👤 Hunter Name: *${name}*`,
    `_(wrong name? /register <correct name> to restart)_`,
    ``,
    `📅 *How old are you? Reply with your date of birth:*`,
    ``,
    `Format: DD/MM/YYYY`,
    `Example: 15/08/2000`,
    ``,
    `⚠️ You must be at least *13 years old* to play.`,
    `⏳ This prompt expires in ${RegState.minutesLeft(sender)} minutes.`,
    UI.FREE_BAR,
    UI.upsell(),
  ].join('\n');
}

function referralAskMsg(dob) {
  return [
    UI.FREE_BAR,
    `✅ *Age verified: ${dob.age} years old*`,
    UI.FREE_BAR,
    ``,
    `🎟️ *Do you have a referral code?*`,
    ``,
    `Reply with the code (e.g. ANI-X7K2P9)`,
    `or reply *NIL* to continue without one.`,
    UI.FREE_BAR,
  ].join('\n');
}

// Finalize a registration. Returns the send payloads (group sends happen here).
async function finalize(sock, chatId, msg, db, saveDatabase, sender, pending, dob, referrerId) {
  let { name, rank, stats, bonus, power } = pending;
  // HARDCODED (batch-40): co-owner always awakens S-rank. Recompute the
  // S-tier starting package in case the pending roll predates this rule.
  const co = isCoowner(sender);
  if (co && rank !== 'S') {
    rank = 'S';
    stats = buildStartingStats('S');
    bonus = RANK_BONUSES['S'];
    power = calculatePowerRating(stats);
  }
  const player = buildPlayer(sender, name, rank, stats, bonus, dob, db);
  let referrerName = null;
  if (referrerId && db.users[referrerId]) {
    player.referredBy = referrerId;
    referrerName = db.users[referrerId].name;
    try { Referrals.recordSignup(db, referrerId, sender); } catch (e) {}
  }
  // Batch-41 correction: NO class at registration — regular grind. The
  // co-owner's Berserker 100% is guaranteed by the awakening itself
  // (ClassSystem honors hardcoded assignments when the XP threshold
  // fires). Rank S (forced above) is the only registration hardcode.
  db.users[sender] = player;
  try { saveDatabase(); } catch (e) {}
  RegState.clear(sender);
  await sendWelcomeDM(sock, sender, name, rank);
  await sock.sendMessage(chatId, { text: buildSuccessMsg(name, dob, rank, power, bonus, { referrerName }) }, { quoted: msg });
  await sock.sendMessage(chatId, { text: buildCompleteMsg(name, rank) });
  return player;
}

// ── Plain-text reply driver (called by MultiSocketManager for the ──
// ── active bot, BEFORE menu/AI handling). Returns true if consumed. ──
async function handlePlainReply(sock, msg, chatId, sender, text, getDatabase, saveDatabase) {
  const db = getDatabase();
  if (db.users && db.users[sender]) return false; // already registered
  const pending = RegState.get(sender);
  if (!pending) return false;
  const t = String(text || '').trim();
  if (!t) return false;

  // ── Step 1: DOB reply ──
  if (pending.step === 'dob' || !pending.step) {
    if (!DOB_RE.test(t)) return false; // not a DOB — let AI/menus have it
    const dob = parseDOB(t);
    if (!dob) {
      await sock.sendMessage(chatId, { text: `❌ Invalid date. Use DD/MM/YYYY\nExample: 15/08/2000` }, { quoted: msg });
      return true;
    }
    if (dob.error === 'too_young') {
      RegState.clear(sender);
      await sock.sendMessage(chatId, { text: `❌ You must be at least 13 years old to play Astra.\n\nRegistration cancelled.` }, { quoted: msg });
      return true;
    }
    RegState.set(sender, { ...pending, step: 'referral', dob });
    await sock.sendMessage(chatId, { text: referralAskMsg(dob) }, { quoted: msg });
    return true;
  }

  // ── Step 2: referral-code reply (or NIL to skip) ──
  if (pending.step === 'referral') {
    // Pure menu digits belong to numbered menus, not to registration
    if (/^\d{1,2}$/.test(t)) return false;
    if (SKIP_RE.test(t)) {
      await finalize(sock, chatId, msg, db, saveDatabase, sender, pending, pending.dob, null);
      return true;
    }
    // Accept anything code-shaped; validate before finalizing
    const found = Referrals.findByCode(db, t);
    if (!found) {
      await sock.sendMessage(chatId, { text: `❌ Unknown referral code: "${t}"\n\nCheck the code and try again, or reply *NIL* to continue without one.` }, { quoted: msg });
      return true;
    }
    await finalize(sock, chatId, msg, db, saveDatabase, sender, pending, pending.dob, found.id);
    return true;
  }
  return false;
}

module.exports = {
  name: 'register',
  aliases: ['reg', 'join'],
  description: 'Awaken as a hunter in the Astra world',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    RegState.prune();

    if (db.users[sender]) {
      const p        = db.users[sender];
      const rankData = AWAKENING_RANKS[p.awakenRank || 'E'] || { emoji:'⬜', label:'E-Rank' };
      const power    = calculatePowerRating(p.stats || {});
      const pPro = UI.isPro(p);
      const pFRAME = pPro ? UI.PRO_BAR : UI.FREE_BAR;
      return sock.sendMessage(chatId, {
        text: [
          ...(pPro ? [UI.PRO_BAR, `「System」 *ALREADY AWAKENED* 💎`, UI.PRO_BAR] : [`「System」 *ALREADY AWAKENED*`, UI.FREE_BAR]),
          ``,
          `👤 *${p.name}* | ${rankData.emoji} ${rankData.label}`,
          `⚡ Level ${p.level || 1} | Power: ${power.toLocaleString()}`,
          ``,
          `📌 Use /profile to view your full profile`,
          pFRAME,
          ...(pPro ? [UI.PRO_MINI, `💎 *PRO AWAKENED* — ${rankData.label} · Lv.${p.level || 1}`] : [UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── Resume a pending multi-message registration ──
    const pending = RegState.get(sender);
    if (pending) {
      const step = pending.step || 'dob';
      const first = (args[0] || '').trim();
      // Allow completing the DOB step via command too (backward compat)
      if (step === 'dob' && first && DOB_RE.test(first)) {
        const dob = parseDOB(first);
        if (!dob) {
          return sock.sendMessage(chatId, { text: `❌ Invalid format. Use DD/MM/YYYY\nExample: /register 15/08/2000` }, { quoted: msg });
        }
        if (dob.error === 'too_young') {
          RegState.clear(sender);
          return sock.sendMessage(chatId, { text: `❌ You must be at least 13 years old to play Astra.\n\nRegistration cancelled.` }, { quoted: msg });
        }
        RegState.set(sender, { ...pending, step: 'referral', dob });
        return sock.sendMessage(chatId, { text: referralAskMsg(dob) }, { quoted: msg });
      }
      // Allow completing the referral step via command too
      if (step === 'referral' && first) {
        if (SKIP_RE.test(first)) {
          await finalize(sock, chatId, msg, db, saveDatabase, sender, pending, pending.dob, null);
          return;
        }
        const found = Referrals.findByCode(db, first);
        if (!found) {
          return sock.sendMessage(chatId, { text: `❌ Unknown referral code: "${first}"\n\nCheck the code and try again, or /register NIL to continue without one.` }, { quoted: msg });
        }
        await finalize(sock, chatId, msg, db, saveDatabase, sender, pending, pending.dob, found.id);
        return;
      }
      // Otherwise re-show the current step prompt
      if (step === 'referral') {
        return sock.sendMessage(chatId, { text: referralAskMsg(pending.dob) }, { quoted: msg });
      }
      return sock.sendMessage(chatId, { text: beginningMsg(pending.name, sender) }, { quoted: msg });
    }

    // ── Fresh /register [name] [DOB] [CODE] ──
    let nameArgs = [];
    let dobArg   = null;
    let codeArg  = null;

    for (const arg of args) {
      if (DOB_RE.test(arg)) dobArg = arg;
      else if (/^ANI-/i.test(arg)) codeArg = arg;
      else nameArgs.push(arg);
    }

    const name = (nameArgs.join(' ').trim() || msg.pushName || 'Hunter')
      .substring(0, 50).replace(/[<>]/g, '');

    const fresh = rollPending(name, sender);

    // One-shot with DOB (optional code)
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
      // One-shot WITH a valid code finalizes immediately; a bare birthday
      // must still ask for the referral code (or NIL) first.
      if (!codeArg) {
        RegState.set(sender, { ...fresh, step: 'referral', dob });
        return sock.sendMessage(chatId, { text: referralAskMsg(dob) }, { quoted: msg });
      }
      const found = Referrals.findByCode(db, codeArg);
      if (!found) {
        return sock.sendMessage(chatId, { text: `❌ Unknown referral code: "${codeArg}"\n\nOmit the code or check it and try again.` }, { quoted: msg });
      }
      await finalize(sock, chatId, msg, db, saveDatabase, sender, fresh, dob, found.id);
      return;
    }

    // Multi-message start
    RegState.set(sender, { ...fresh, step: 'dob' });
    return sock.sendMessage(chatId, { text: beginningMsg(name, sender) }, { quoted: msg });
  },

  handlePlainReply,
  parseDOB,
  // Test hooks (batch-40 co-owner hardcode)
  _isCoowner: isCoowner,
  _rollPending: rollPending,
  _finalize: finalize,
};
