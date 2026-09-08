// ═══════════════════════════════════════════════════════════════
// GUILD CONTRACT MANAGER — weekly-wage hire contracts
//
// A guild master / vice guild master can formally HIRE a hunter with a
// weekly wage (Nexus + Mana Stones) for a set number of weeks. The wage
// is auto-deducted from the guild treasury each week for the contract
// duration. Kicking a contracted member pays the hunter ×2 of the
// REMAINING balance of their contract.
//
// Storage: db.guildContracts[guildId][playerJid] = {
//   weeklyNexus, weeklyMana, weeks, totalWeeks, startAt,
//   nextPayAt, weeksPaid, active
// }
// ═══════════════════════════════════════════════════════════════

'use strict';

const Week = 7 * 24 * 60 * 60 * 1000;

function normaliseJid(jid) {
  const base = String(jid).split('@')[0].split(':')[0];
  const digits = base.replace(/[^0-9]/g, '');
  // Real WhatsApp JIDs are numeric; fall back to the full base if not (safety).
  return digits.length ? digits : base;
}

// Guilds are stored keyed by guild id (e.g. 'guild_123') with a separate
// `.name`. Many callers pass the guild NAME (player.guild). Resolve either.
function findGuild(db, ref) {
  if (!db?.guilds) return null;
  if (!ref) return null;
  if (db.guilds[ref]) return db.guilds[ref];
  return Object.values(db.guilds).find(g => g && g.name && g.name.toLowerCase() === String(ref).toLowerCase()) || null;
}

// Roles allowed to run /guild hire + sign formal contracts.
const MANAGE_ROLES = new Set(['guild master', 'vice guild master', 'vice gm', 'vice']);

function rankOf(guild, jid) {
  if (!guild) return '';
  if (guild.leader && normaliseJid(guild.leader) === normaliseJid(jid)) return 'Guild Master';
  for (const arr of [guild.memberData, guild.members]) {
    for (const m of (arr || [])) {
      const id = typeof m === 'object' ? m.id : m;
      if (normaliseJid(id) === normaliseJid(jid)) {
        return String((typeof m === 'object' ? m.rank : null) || 'Member');
      }
    }
  }
  return '';
}

function isGuildMasterOrVice(db, guildName, jid) {
  const guild = findGuild(db, guildName);
  if (!guild) return false;
  const rank = rankOf(guild, jid).toLowerCase().replace(/[_-]/g, ' ');
  return MANAGE_ROLES.has(rank);
}

function isGuildMember(db, guildName, jid) {
  const guild = findGuild(db, guildName);
  if (!guild) return false;
  if (guild.leader && normaliseJid(guild.leader) === normaliseJid(jid)) return true;
  for (const arr of [guild.memberData, guild.members]) {
    for (const m of (arr || [])) {
      const id = typeof m === 'object' ? m.id : m;
      if (normaliseJid(id) === normaliseJid(jid)) return true;
    }
  }
  return false;
}

function _contracts(db, guildId) {
  if (!db.guildContracts) db.guildContracts = {};
  if (!db.guildContracts[guildId]) db.guildContracts[guildId] = {};
  return db.guildContracts[guildId];
}

function getContract(db, guildId, playerJid) {
  return _contracts(db, guildId)[normaliseJid(playerJid)] || null;
}

// Sign a new contract. Returns { success, error?, contract? }
function hire(db, guildId, operatorJid, targetJid, weeklyNexus, weeklyMana, weeks) {
  if (!(weeklyNexus >= 0) || !(weeklyMana >= 0) || weeklyNexus <= 0 && weeklyMana <= 0) {
    return { success: false, error: 'Weekly wage must include Nexus or Mana Stones.' };
  }
  if (!(weeks >= 1)) return { success: false, error: 'Contract must last at least 1 week.' };
  const recs = _contracts(db, guildId);
  if (recs[normaliseJid(targetJid)]) {
    return { success: false, error: 'This hunter already has an active contract.' };
  }
  const now = Date.now();
  const contract = {
    weeklyNexus,
    weeklyMana,
    weeks,
    totalWeeks: weeks,
    startAt: now,
    nextPayAt: now + Week,       // first weekly deduction happens after week 1
    weeksPaid: 0,
    active: true,
    hiredBy: operatorJid,
  };
  recs[normaliseJid(targetJid)] = contract;
  return { success: true, contract };
}

// Remaining balance owed across the whole contract (nexus + mana), used for
// the ×2 payout when a contracted member is kicked.
function remainingBalance(db, guildId, playerJid) {
  const c = getContract(db, guildId, playerJid);
  if (!c) return null;
  const weeksLeft = Math.max(0, c.weeks - c.weeksPaid);
  return { nexus: c.weeklyNexus * weeksLeft, mana: c.weeklyMana * weeksLeft, weeksLeft };
}

// Terminate a contract, paying the member ×2 their remaining balance.
// Returns { success, payout:{nexus,mana}, contract? }
function kickPayout(db, guildId, playerJid, saveDatabase) {
  const c = getContract(db, guildId, playerJid);
  if (!c) return { success: false, error: 'No contract on file.' };
  const rem = remainingBalance(db, guildId, playerJid);
  const payout = { nexus: rem.nexus * 2, mana: rem.mana * 2 };
  delete _contracts(db, guildId)[normaliseJid(playerJid)];
  if (saveDatabase) saveDatabase();
  return { success: true, payout, contract: c };
}

// Process weekly payouts. Deducts weekly wage from guild treasury (if they
// don't have enough, pay what's available). Called on a timer + on gate use.
// Returns array of pay summaries.
function processWeeklyPay(db, guildId, saveDatabase) {
  const guild = db.guilds?.[guildId];
  const recs = db.guildContracts?.[guildId];
  if (!guild || !recs) return [];
  const now = Date.now();
  const summaries = [];
  for (const [bare, c] of Object.entries(recs)) {
    if (!c.active) continue;
    let paid = 0;
    // Pay any elapsed weeks (catch up if overdue)
    while (c.active && now >= c.nextPayAt) {
      let avail = { nexus: guild.treasury || 0, mana: guild.manaTreasury || 0 };
      let payNexus = Math.min(c.weeklyNexus, avail.nexus);
      let payMana = Math.min(c.weeklyMana, avail.mana);
      if (payNexus <= 0 && payMana <= 0) {
        // Cannot pay this week → contract defaults (deactivate)
        c.active = false;
        c.defaultedAt = now;
        break;
      }
      guild.treasury -= payNexus;
      if (guild.manaTreasury != null) guild.manaTreasury -= payMana;
      if (db.users?.[bare]) {
        db.users[bare].gold = (db.users[bare].gold || 0) + payNexus;
        db.users[bare].manaCrystals = (db.users[bare].manaCrystals || 0) + payMana;
      }
      c.weeksPaid++;
      c.lastPayAt = now;
      paid += payNexus + payMana;
      if (c.weeksPaid >= c.weeks) { c.active = false; c.completedAt = now; }
      else c.nextPayAt = c.nextPayAt + Week;
    }
    if (paid || !c.active) summaries.push({ bare, nexusPaid: paid, active: c.active, contract: c });
  }
  if (saveDatabase) saveDatabase();
  return summaries;
}

module.exports = {
  Week, normaliseJid, rankOf,
  isGuildMasterOrVice, isGuildMember,
  getContract, hire, remainingBalance, kickPayout, processWeeklyPay,
};
