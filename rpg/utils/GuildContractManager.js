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
  return digits.length ? digits : base;
}

function findUserInDb(db, bare) {
  if (!db?.users || !bare) return null;
  const digits = String(bare).replace(/[^0-9]/g, '');
  if (db.users[bare]) return db.users[bare];
  if (db.users[`${digits}@s.whatsapp.net`]) return db.users[`${digits}@s.whatsapp.net`];
  for (const [k, u] of Object.entries(db.users)) {
    if (k.replace(/[^0-9]/g, '') === digits) return u;
  }
  return null;
}

// Guilds are stored keyed by guild id (e.g. 'guild_123') with a separate
// `.name`. Many callers pass the guild NAME (player.guild). Resolve either.
function findGuild(db, ref) {
  if (!db?.guilds) return null;
  if (!ref) return null;
  // Push #71: accept a guild OBJECT too (guild.js passes `playerGuild`).
  if (typeof ref === 'object') {
    if (ref.id && db.guilds[ref.id]) return db.guilds[ref.id];
    return findGuild(db, ref.name) || ref;
  }
  if (db.guilds[ref]) return db.guilds[ref];
  return Object.values(db.guilds).find(g => g && g.name && g.name.toLowerCase() === String(ref).toLowerCase()) || null;
}

// Push #71 — ONE resolver for "which guild is this player in".
// guild.js matched `m.id === sender` (exact JID) while every money path
// (deposit / gate loot / wages / GateKeyManager) resolved by NAME through
// player.guild or by normalised number. A dual identity (lid vs phone) or a
// stale/duplicate guild record therefore made /guild info read a DIFFERENT
// object than the one the Nexus landed in.
function resolvePlayerGuild(db, sender, playerRow = null) {
  if (!db?.guilds) return null;
  const me = normaliseJid(sender);
  const player = playerRow || findUserInDb(db, me);
  const inRoster = (g) => {
    if (!g) return false;
    if (normaliseJid(g.leader) === me) return true;
    for (const arr of [g.members, g.memberData, g.officers]) {
      for (const m of (arr || [])) {
        const id = (m && typeof m === 'object') ? (m.id || m.jid) : m;
        if (normaliseJid(id) === me) return true;
      }
    }
    return false;
  };
  const all = Object.entries(db.guilds).filter(([, g]) => g && typeof g === 'object');
  const wantName = player?.guild ? String(player.guild).toLowerCase() : null;
  let hit = wantName ? all.find(([, g]) => g.name && g.name.toLowerCase() === wantName && inRoster(g)) : null;
  if (!hit) hit = all.find(([, g]) => inRoster(g));
  if (!hit && wantName) {
    hit = all.find(([, g]) => g.name && g.name.toLowerCase() === wantName);
    if (hit && player) {
      const g = hit[1];
      if (!Array.isArray(g.members)) g.members = [];
      g.members.push({ id: sender, name: player.name, rank: 'Member', joinedAt: Date.now(), restoredAt: Date.now() });
    }
  }
  if (!hit) return null;
  const [gid, g] = hit;
  if (!g.id) g.id = gid;
  if (player && g.name && player.guild !== g.name) player.guild = g.name;
  return g;
}

// Push #71 — duplicate-name guild records split the treasury between two
// objects. Merge into the canonical one (most members, then oldest) —
// Nexus, Mana, GP and roster summed — and drop the rest.
function mergeDuplicateGuilds(db) {
  if (!db?.guilds) return [];
  const byName = {};
  for (const [gid, g] of Object.entries(db.guilds)) {
    if (!g || typeof g !== 'object' || !g.name) continue;
    const k = String(g.name).trim().toLowerCase();
    (byName[k] = byName[k] || []).push([gid, g]);
  }
  const merged = [];
  for (const list of Object.values(byName)) {
    if (list.length < 2) continue;
    list.sort((a, b) => ((b[1].members || []).length - (a[1].members || []).length) || ((a[1].createdAt || 0) - (b[1].createdAt || 0)));
    const [keepId, keep] = list[0];
    if (!keep.id) keep.id = keepId;
    for (const [gid, g] of list.slice(1)) {
      keep.treasury = (keep.treasury || 0) + (g.treasury || 0);
      keep.manaTreasury = (keep.manaTreasury || 0) + (g.manaTreasury || 0);
      keep.totalRaids = (keep.totalRaids || 0) + (g.totalRaids || 0);
      keep.weeklyGP = (keep.weeklyGP || 0) + (g.weeklyGP || 0);
      keep.totalGP = (keep.totalGP || 0) + (g.totalGP || 0);
      keep.guildPoints = (keep.guildPoints || 0) + (g.guildPoints || 0);
      const have = new Set((keep.members || []).map(m => normaliseJid(typeof m === 'object' ? m.id : m)));
      for (const m of (g.members || [])) {
        const id = normaliseJid(typeof m === 'object' ? m.id : m);
        if (id && !have.has(id)) { (keep.members = keep.members || []).push(m); have.add(id); }
      }
      if (db.guildContracts) for (const c of Object.values(db.guildContracts)) if (c && c.guildId === gid) c.guildId = keepId;
      delete db.guilds[gid];
      merged.push({ name: keep.name, keptId: keepId, droppedId: gid });
    }
  }
  return merged;
}

// Roles allowed to run /guild hire + sign formal contracts.
const MANAGE_ROLES = new Set(['guild master', 'vice guild master', 'vice gm', 'vice', 'leader']);

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
  if (guild.leader && normaliseJid(guild.leader) === normaliseJid(jid)) return true;
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
  const g = findGuild(db, guildId);
  const realId = g?.id || guildId;
  return _contracts(db, realId)[normaliseJid(playerJid)] || null;
}

// Sign a new contract. Returns { success, error?, contract? }
function hire(db, guildId, operatorJid, targetJid, weeklyNexus, weeklyMana, weeks) {
  if (!(weeklyNexus >= 0) || !(weeklyMana >= 0) || (weeklyNexus <= 0 && weeklyMana <= 0)) {
    return { success: false, error: 'Weekly wage must include Nexus or Mana Stones.' };
  }
  if (!(weeks >= 1)) return { success: false, error: 'Contract must last at least 1 week.' };
  const g = findGuild(db, guildId);
  const realId = g?.id || guildId;
  const recs = _contracts(db, realId);
  if (recs[normaliseJid(targetJid)]?.active) {
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
  const weeksLeft = Math.max(0, c.weeks - (c.weeksPaid || 0));
  return { nexus: (c.weeklyNexus || 0) * weeksLeft, mana: (c.weeklyMana || 0) * weeksLeft, weeksLeft };
}

// Terminate a contract, paying the member ×2 their remaining balance.
// Returns { success, payout:{nexus,mana}, contract? }
function kickPayout(db, guildId, playerJid, saveDatabase) {
  const c = getContract(db, guildId, playerJid);
  if (!c) return { success: false, error: 'No contract on file.' };
  const rem = remainingBalance(db, guildId, playerJid);
  const payout = { nexus: rem.nexus * 2, mana: rem.mana * 2 };
  const g = findGuild(db, guildId);
  const realId = g?.id || guildId;
  delete _contracts(db, realId)[normaliseJid(playerJid)];
  if (saveDatabase) saveDatabase();
  return { success: true, payout, contract: c };
}

// Push #70: kickPayout + actually CREDIT the hunter in one call.
// (guild.js's /guild kick was never calling kickPayout — the ×2 severance
// documented in the header above was dead code. Voluntary /guild leave
// deliberately does NOT use this: normal leave gets no severance.)
// Returns kickPayout's result plus { user, credited }.
function creditKickPayout(db, guildRef, playerJid, saveDatabase) {
  const res = kickPayout(db, guildRef, playerJid, null);
  if (!res.success) return res;
  const user = findUserInDb(db, normaliseJid(playerJid));
  let credited = false;
  if (user && ((res.payout.nexus || 0) > 0 || (res.payout.mana || 0) > 0)) {
    user.gold = (user.gold || 0) + res.payout.nexus;
    user.manaCrystals = (user.manaCrystals || 0) + res.payout.mana;
    if (user.inventory) user.inventory.gold = user.gold;
    credited = true;
    try { require('./TransactionLog').logCredit(user, 'kick_severance', res.payout.nexus, res.payout.mana, 'x2 remaining contract'); } catch (e) {}
  }
  // Drop any pending wage approval for the kicked member — the contract is
  // gone, and a stale Pay/Skip DM must not linger in the approvals store.
  try {
    const g = findGuild(db, guildRef);
    const realId = g?.id || guildRef;
    const bare = normaliseJid(playerJid);
    if (db.salaryApprovals?.[realId]?.[bare]) delete db.salaryApprovals[realId][bare];
  } catch (e) {}
  if (saveDatabase) saveDatabase();
  return { ...res, user, credited };
}

// ═══════════════════════════════════════════════════════════════════════════
// Push #68 — Weekly wage pipeline
//
// 1. ACTIVITY GATE: a member only earns a week's wage after at least
//    MIN_WEEKLY_DAILIES /daily claims during that week (WAT Monday-anchored).
//    Inactive members are auto-skipped — no master action needed.
// 2. PRO GUILDMASTER APPROVAL: when the guild master is a PRO player, every
//    member's due wage goes through a DM with ✅ Pay / ❌ Skip buttons.
//    Unanswered approvals auto-PAY after 24h (silence is not a veto).
// 3. Everyone else: the classic auto-pay.
//
// /wages shows the pipeline state (due / processing / paid / skipped) and
// the profile card carries a one-line wage status.
// ═══════════════════════════════════════════════════════════════════════════
const MIN_WEEKLY_DAILIES = 3;
const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000;

// Monday-anchored WAT week key, e.g. "2026-09-14" (the Monday of that week).
function weekKey(now = Date.now()) {
  const d = new Date(now + 3600000); // WAT = UTC+1
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() - dow);
  return mon.toISOString().slice(0, 10);
}

// How many /daily claims the player logged in the CURRENT WAT week.
// (daily.js maintains player.dailyWeek = { key, count } on every claim.)
function weeklyDailyClaims(player, now = Date.now()) {
  const wk = weekKey(now);
  return (player && player.dailyWeek && player.dailyWeek.key === wk) ? (player.dailyWeek.count || 0) : 0;
}

function _isProPlayer(p) {
  return !!(p && (p.isPro || p.proStatus) && p.proExpiresAt && p.proExpiresAt > Date.now());
}

// Accept either a guild object or a guild id/name ref (callers pass both).
function _guildFrom(db, guildRef) {
  if (guildRef && typeof guildRef === 'object') return guildRef;
  return findGuild(db, guildRef);
}

function getGuildMaster(db, guildRef) {
  const guild = _guildFrom(db, guildRef);
  if (!guild || !guild.leader) return null;
  return { jid: guild.leader, player: findUserInDb(db, guild.leader) };
}

// Pro guild masters confirm each member's wage by DM before money moves.
function needsMasterApproval(db, guildRef) {
  const master = getGuildMaster(db, guildRef);
  return !!(master && master.player && _isProPlayer(master.player));
}

function _approvals(db) {
  if (!db.salaryApprovals) db.salaryApprovals = {};
  return db.salaryApprovals;
}

function getApproval(db, guildRef, playerJid) {
  const guild = findGuild(db, guildRef);
  const realId = guild?.id || guildRef;
  return _approvals(db)[realId]?.[normaliseJid(playerJid)] || null;
}

function _recordWeek(c, rec) {
  if (!Array.isArray(c.payHistory)) c.payHistory = [];
  c.payHistory.push({ week: rec.week || weekKey(rec.at || Date.now()), at: rec.at || Date.now(), ...rec });
  if (c.payHistory.length > 12) c.payHistory.splice(0, c.payHistory.length - 12);
}

// Pay exactly one elapsed week. Returns { paid, defaulted, nexus, mana, user }.
function payOneWeek(db, guild, bare, c, now = Date.now()) {
  const reqNexus = c.weeklyNexus || 0;
  const reqMana  = c.weeklyMana || 0;

  if ((guild.treasury || 0) < reqNexus || (guild.manaTreasury || 0) < reqMana) {
    c.active = false;
    c.defaultedAt = now;
    c.defaultReason = `Insufficient guild treasury (Need: ${reqNexus} Nexus, ${reqMana} Mana Stones; Have: ${guild.treasury || 0} Nexus, ${guild.manaTreasury || 0} Mana Stones)`;
    _recordWeek(c, { status: 'defaulted', reason: c.defaultReason });
    return { paid: false, defaulted: true };
  }

  guild.treasury = (guild.treasury || 0) - reqNexus;
  guild.manaTreasury = (guild.manaTreasury || 0) - reqMana;

  const user = findUserInDb(db, bare);
  if (user) {
    user.gold = (user.gold || 0) + reqNexus;
    user.manaCrystals = (user.manaCrystals || 0) + reqMana;
    if (user.inventory) user.inventory.gold = user.gold;
    try { require('./TransactionLog').logCredit(user, 'wage', reqNexus, reqMana, guild.name); } catch (e) {}
  }

  c.weeksPaid = (c.weeksPaid || 0) + 1;
  c.lastPayAt = now;
  c.lastPaidWeek = weekKey(now);
  _recordWeek(c, { status: 'paid', nexus: reqNexus, mana: reqMana });

  if (c.weeksPaid >= (c.weeks || 0)) { c.active = false; c.completedAt = now; }
  else c.nextPayAt = (c.nextPayAt || now) + Week;

  return { paid: true, nexus: reqNexus, mana: reqMana, user };
}

// Consume a week WITHOUT paying (inactive member / master skipped it).
function skipWeek(db, guild, bare, c, status, reason, now = Date.now()) {
  c.weeksPaid = (c.weeksPaid || 0) + 1;
  c.nextPayAt = (c.nextPayAt || now) + Week;
  _recordWeek(c, { status, reason });
  if (c.weeksPaid >= (c.weeks || 0)) { c.active = false; c.completedAt = now; }
  return { skipped: true, status };
}

// ── DMs (best-effort; the serf iron wall drops DMs to players without a serf) ─
function _dmPlayer(db, jid, text) {
  try {
    const MSM = require('../../bots/MultiSocketManager');
    const anySock = typeof MSM.getAnySocket === 'function' ? MSM.getAnySocket() : null;
    if (!MSM.safeSendDM) return Promise.resolve({ dropped: true, reason: 'no-safeSendDM' });
    return Promise.resolve(MSM.safeSendDM(anySock, jid, { text }, { db })).catch(e => ({ dropped: true, reason: e.message }));
  } catch (e) { return Promise.resolve({ dropped: true, reason: e.message }); }
}

function _notifyMemberPay(db, user, nexus, mana, note) {
  if (!user?.id) return;
  const lines = [`💰 *WEEKLY WAGE PAID!*`];
  if (nexus != null) lines.push(``, `+${Number(nexus).toLocaleString()} 💠 Nexus`, `+${Number(mana || 0).toLocaleString()} 💎 Mana Stones`);
  if (note) lines.push(``, `_${note}_`);
  lines.push(``, `Check */wages* for your full pay status.`);
  _dmPlayer(db, user.id, lines.join('\n'));
}

function _notifyMemberSkip(db, user, note) {
  if (!user?.id) return;
  _dmPlayer(db, user.id, [`⚠️ *WEEKLY WAGE SKIPPED*`, ``, note || 'This week was skipped.', ``, `Check */wages* for your full pay status.`].join('\n'));
}

// Ask the pro guild master for approval (DM with Pay/Skip buttons).
// If the DM cannot be delivered (no serf / serf offline), the week auto-PAYS —
// earned wages are not held hostage by a message the master can't receive.
function _requestMasterApproval(db, guild, guildId, bare, c, saveDatabase, now = Date.now()) {
  const master = getGuildMaster(db, guild);
  const user = findUserInDb(db, bare);
  const _aps = _approvals(db);
  if (!_aps[guildId]) _aps[guildId] = {};
  const ap = _aps[guildId][bare] = {
    guildId,
    memberBare: bare,
    memberName: user?.name || bare,
    nexus: c.weeklyNexus || 0,
    mana: c.weeklyMana || 0,
    dueAt: c.nextPayAt,
    askedAt: now,
    masterJid: master?.jid || null,
    status: 'pending',
    week: weekKey(now),
  };
  if (!master?.jid) {
    // No master on file — nothing to ask; auto-pay keeps the wage flowing.
    payOneWeek(db, guild, bare, c, now);
    ap.status = 'resolved'; ap.resolution = 'auto_paid'; ap.autoReason = 'no master on file';
    return;
  }
  const text = [
    `🧾 *WEEKLY WAGE APPROVAL — ${guild.name || guildId}*`,
    ``,
    `👤 Member: *${ap.memberName}*`,
    `💠 Nexus: *${ap.nexus.toLocaleString()}*`,
    `💎 Mana Stones: *${ap.mana.toLocaleString()}*`,
    `📅 Week of: *${ap.week}*`,
    ``,
    `Tap below to pay or skip this week's wage.`,
    `_(No reply in 24h = auto-paid.)_`,
  ].join('\n');
  let sent = false;
  try {
    const MSM = require('../../bots/MultiSocketManager');
    // Push #87: legacy `list:` messages no longer render on Baileys 7 — use the
    // native quick-reply buttons (utils/buttons) on the master's serf socket,
    // with the typed commands in the body as a guaranteed fallback.
    let Buttons = null; try { Buttons = require('../../utils/buttons'); } catch (e) {}
    let SerfDM = null; try { SerfDM = require('./SerfDM'); } catch (e) {}
    let dmSock = null;
    try { const sr = SerfDM && SerfDM.getSerfSocket ? SerfDM.getSerfSocket(db, master.jid) : null; if (sr && sr.ok && sr.serfSock) dmSock = sr.serfSock; } catch (e) {}
    if (!dmSock && typeof MSM.getAnySocket === 'function') dmSock = MSM.getAnySocket();
    const yesCmd = `/wageyes ${guildId} ${bare}`;
    const noCmd = `/wageno ${guildId} ${bare}`;
    const body = text + `\n\n✅ Pay: *${yesCmd}*\n❌ Skip: *${noCmd}*`;
    if (dmSock && Buttons && Buttons.sendButtons) {
      sent = true;
      Promise.resolve(Buttons.sendButtons(dmSock, master.jid, {
        text: body,
        footer: `Wages • ${guild.name || guildId}`,
        buttons: Buttons.quickReplies([
          [`✅ Pay ${(c.weeklyNexus || 0).toLocaleString()} N`, yesCmd],
          ['❌ Skip this week', noCmd],
        ]),
      })).catch((e) => { console.error('[SALARY] approval buttons failed, plain DM:', e.message); try { dmSock.sendMessage(master.jid, { text: body }); } catch (_) {} });
    } else if (dmSock) {
      sent = true;
      Promise.resolve(dmSock.sendMessage(master.jid, { text: body })).catch(() => {});
    }
  } catch (e) { console.error('[SALARY] master approval DM error:', e.message); }
  if (!sent) {
    payOneWeek(db, guild, bare, c, now);
    ap.status = 'resolved'; ap.resolution = 'auto_paid'; ap.autoReason = 'dm unavailable';
  }
}

// Process weekly payouts. Deducts weekly wage (Nexus AND Mana Stones) from guild treasury.
// Pays the hired hunter in full. Called on a timer + on gate use.
// Push #68: returns the summaries array (unchanged shape) but now enforces the
// daily-claim gate and the pro-guildmaster approval flow.
function processWeeklyPay(db, guildRef, saveDatabase) {
  const guild = findGuild(db, guildRef);
  if (!guild) return [];
  const guildId = guild.id || guildRef;
  const recs = db.guildContracts?.[guildId] || db.guildContracts?.[guild.name] || db.guildContracts?.[guildRef];
  if (!recs) return [];

  const now = Date.now();
  const approvePath = needsMasterApproval(db, guild);
  const summaries = [];

  for (const [bare, c] of Object.entries(recs)) {
    if (!c.active) continue;
    let totalNexusPaid = 0;
    let totalManaPaid = 0;

    // Pay any elapsed weeks (catch up if overdue)
    while (c.active && now >= c.nextPayAt) {
      const user = findUserInDb(db, bare);
      const claims = weeklyDailyClaims(user, now);

      // 1) ACTIVITY GATE — fewer than MIN_WEEKLY_DAILIES /daily claims this
      //    week: the wage is auto-skipped, the week still advances.
      if (claims < MIN_WEEKLY_DAILIES) {
        skipWeek(db, guild, bare, c, 'skipped_inactive',
          `Only ${claims}/${MIN_WEEKLY_DAILIES} daily claims this week`, now);
        _notifyMemberSkip(db, user, `You claimed /daily *${claims}/${MIN_WEEKLY_DAILIES}* times this week — claim it at least *${MIN_WEEKLY_DAILIES} times* to earn your wage.`);
        continue;
      }

      // 2) PRO GUILDMASTER — money only moves on the master's ✅ (or 24h timeout).
      if (approvePath) {
        let ap = getApproval(db, guildId, bare);
        // Push #87: a request already answered for an EARLIER pay week is stale
        // — clear it so this week gets its own ask (prevents the old
        // resolved-ap `continue` infinite loop).
        if (ap && ap.status === 'resolved' && (ap.dueAt || 0) < c.nextPayAt) {
          delete _approvals(db)[guildId][bare]; ap = null;
        }
        if (ap && ap.status === 'pending') {
          // Already asked — do NOT re-ask (that reset askedAt every 6h and
          // the 24h auto-pay never fired). Fall to the timeout check below.
          break;
        }
        if (!ap) {
          _requestMasterApproval(db, guild, guildId, bare, c, saveDatabase, now);
          // If the request resolved synchronously (no master / DM dropped)
          // the week already advanced — fall through to the next iteration.
          const ap2 = getApproval(db, guildId, bare);
          if (ap2 && ap2.status === 'resolved') {
            if (ap2.resolution === 'paid' || ap2.resolution === 'auto_paid') {
              totalNexusPaid += c.weeklyNexus || 0;
              totalManaPaid += c.weeklyMana || 0;
            }
            continue;
          }
          break; // waiting on the master's button
        }
        if (ap.status === 'approved') {
          const r = payOneWeek(db, guild, bare, c, now);
          ap.status = 'resolved'; ap.resolvedAt = now; ap.resolution = r.paid ? 'paid' : 'defaulted';
          if (r.paid) { totalNexusPaid += r.nexus; totalManaPaid += r.mana; _notifyMemberPay(db, r.user, r.nexus, r.mana); }
        } else if (ap.status === 'denied') {
          skipWeek(db, guild, bare, c, 'skipped_denied', 'Guild master skipped this week', now);
          ap.status = 'resolved'; ap.resolvedAt = now; ap.resolution = 'skipped';
          _notifyMemberSkip(db, user, 'Your guild master skipped this week.');
        } else {
          // Unknown / resolved-but-not-advanced state — never spin forever.
          delete _approvals(db)[guildId][bare];
          break;
        }
        continue;
      }

      // 3) NORMAL GUILD — auto-pay as before.
      const r = payOneWeek(db, guild, bare, c, now);
      if (r.paid) { totalNexusPaid += r.nexus; totalManaPaid += r.mana; }
    }

    // 24h auto-approve safety net: an unanswered pending approval pays out
    // (the worker did their dailies — silence is not a veto).
    if (approvePath) {
      const ap = getApproval(db, guildId, bare);
      if (ap && ap.status === 'pending' && (now - (ap.askedAt || now)) >= APPROVAL_TIMEOUT_MS
          && c.active && now >= c.nextPayAt) {
        const r = payOneWeek(db, guild, bare, c, now);
        ap.status = 'resolved'; ap.resolvedAt = now; ap.resolution = 'auto_paid';
        ap.autoReason = 'no reply in 24h';
        if (r.paid) { totalNexusPaid += r.nexus; totalManaPaid += r.mana; _notifyMemberPay(db, r.user, r.nexus, r.mana, 'Auto-approved (no reply in 24h).'); }
      }
    }

    if (totalNexusPaid > 0 || totalManaPaid > 0 || !c.active) {
      summaries.push({
        bare,
        nexusPaid: totalNexusPaid,
        manaPaid: totalManaPaid,
        active: c.active,
        contract: c
      });
    }
  }

  if (saveDatabase) saveDatabase();
  return summaries;
}

// Master taps ✅ / ❌ in the DM (row-ids /wageyes / /wageno are delivered as
// plain text). Scoped by the row's guildId + memberBare when present; falls
// back to scanning every guild the sender leads (stale buttons).
function tryResolveApprovalBySender(db, senderJid, approve, saveDatabase, guildRef, memberBare) {
  try {
    const sNum = normaliseJid(senderJid);
    if (!sNum) return { handled: false };
    const now = Date.now();

    const resolveOne = (guild, realId, bare) => {
      const ap = (db.salaryApprovals?.[realId] || {})[normaliseJid(bare)] || null;
      const c = (db.guildContracts?.[realId] || {})[normaliseJid(bare)] || null;
      if (!ap || ap.status !== 'pending' || !c || !c.active || now < c.nextPayAt) return null;
      const user = findUserInDb(db, bare);
      if (weeklyDailyClaims(user, now) < MIN_WEEKLY_DAILIES) {
        skipWeek(db, guild, bare, c, 'skipped_inactive', 'Member did not hit the daily gate', now);
        ap.status = 'resolved'; ap.resolvedAt = now; ap.resolution = 'skipped_inactive';
        if (saveDatabase) saveDatabase();
        return { handled: true, result: `⚠️ *${ap.memberName}* hasn't claimed *${MIN_WEEKLY_DAILIES}+* dailies this week — the week was skipped regardless.` };
      }
      if (approve) {
        const r = payOneWeek(db, guild, bare, c, now);
        ap.status = 'resolved'; ap.resolvedAt = now; ap.resolution = r.paid ? 'paid' : 'defaulted';
        if (r.paid) _notifyMemberPay(db, r.user, r.nexus, r.mana);
        if (saveDatabase) saveDatabase();
        return {
          handled: true,
          result: r.paid
            ? `✅ *WAGE PAID — ${ap.memberName}* (+${(r.nexus || 0).toLocaleString()} 💠 N, +${(r.mana || 0).toLocaleString()} 💎 M)`
            : `⚠️ *Could not pay ${ap.memberName}* — ${c.defaultReason || 'guild treasury short'}`,
        };
      }
      skipWeek(db, guild, bare, c, 'skipped_denied', 'Guild master skipped this week', now);
      ap.status = 'resolved'; ap.resolvedAt = now; ap.resolution = 'skipped';
      _notifyMemberSkip(db, user, 'Your guild master skipped this week.');
      if (saveDatabase) saveDatabase();
      return { handled: true, result: `❌ *WAGE SKIPPED — ${ap.memberName}* (no wage this week)` };
    };

    // Scoped path (fresh buttons carry guildId + memberBare in the row-id).
    if (guildRef && memberBare) {
      const guild = findGuild(db, guildRef);
      if (!guild) return { handled: false };
      if (!(guild.leader && normaliseJid(guild.leader) === sNum)) return { handled: false };
      return resolveOne(guild, guild.id || guildRef, memberBare) || { handled: false };
    }

    // Fallback: sender is the leader of the guild holding the pending approval.
    for (const guild of Object.values(db.guilds || {})) {
      if (!guild?.leader || normaliseJid(guild.leader) !== sNum) continue;
      const realId = guild.id || guild.name;
      for (const bare of Object.keys(db.salaryApprovals?.[realId] || {})) {
        const out = resolveOne(guild, realId, bare);
        if (out) return out;
      }
    }
    return { handled: false };
  } catch (e) {
    return { handled: false, error: e.message };
  }
}

// /wages + profile status: the full pipeline state for one member.
function getSalaryStatus(db, playerJid) {
  const user = findUserInDb(db, playerJid);
  if (!user) return { state: 'unregistered' };
  // Push #71: resolve by LIVE membership (not just the cached user.guild name)
  // so a rename / re-created record / dual identity can't show stale wages.
  const guild = resolvePlayerGuild(db, playerJid, user) || (user.guild ? findGuild(db, user.guild) : null);
  if (!guild) return { state: 'no_guild', guildRef: user.guild || null };
  const realId = guild.id || Object.keys(db.guilds || {}).find(k => db.guilds[k] === guild) || user.guild;
  const me = normaliseJid(playerJid);
  let c = (db.guildContracts?.[realId] || {})[me] || null;
  if (!c && db.guildContracts) {
    // Contract filed under an old id / the guild's name / '[object Object]' → move it home.
    for (const [bucketId, bucket] of Object.entries(db.guildContracts)) {
      if (bucketId === realId || !bucket || !bucket[me]) continue;
      const stray = bucket[me];
      const belongs = bucketId === guild.name || bucketId === '[object Object]' || !db.guilds?.[bucketId];
      if (!belongs) continue;
      _contracts(db, realId)[me] = stray;
      delete bucket[me];
      if (!Object.keys(bucket).length) delete db.guildContracts[bucketId];
      c = stray;
      break;
    }
  }
  if (!c) return { state: 'no_contract', guild: guild.name, guildId: realId, treasury: guild.treasury || 0, manaTreasury: guild.manaTreasury || 0 };

  const now = Date.now();
  const weeksLeft = Math.max(0, (c.weeks || 0) - (c.weeksPaid || 0));
  const state = c.completedAt ? 'completed' : c.defaultedAt ? 'defaulted'
    : (c.active && weeksLeft > 0) ? 'active' : 'inactive';
  const ap = (db.salaryApprovals?.[realId] || {})[normaliseJid(playerJid)] || null;
  const claims = weeklyDailyClaims(user, now);

  let dueState = 'not_due';
  if (state === 'active') {
    if (c.nextPayAt <= now) {
      dueState = (ap && ap.status === 'pending') ? 'processing'
        : (claims < MIN_WEEKLY_DAILIES) ? 'will_skip' : 'due_now';
    } else {
      dueState = 'scheduled';
    }
  }

  const lastPaid = (Array.isArray(c.payHistory) ? c.payHistory : [])
    .filter(h => h.status === 'paid').pop() || null;

  return {
    state, contract: c, guild: guild.name, guildId: realId,
    treasury: guild.treasury || 0, manaTreasury: guild.manaTreasury || 0,
    canGuildPay: (guild.treasury || 0) >= (c.weeklyNexus || 0) && (guild.manaTreasury || 0) >= (c.weeklyMana || 0),
    claims, minClaims: MIN_WEEKLY_DAILIES,
    dueState, nextPayAt: c.nextPayAt, lastPayAt: c.lastPayAt,
    lastPaid, weeksLeft, approval: ap,
  };
}

module.exports = {
  Week, normaliseJid, rankOf, findUserInDb, findGuild, resolvePlayerGuild, mergeDuplicateGuilds,
  isGuildMasterOrVice, isGuildMember,
  getContract, hire, remainingBalance, kickPayout, creditKickPayout, processWeeklyPay,
  // Push #68
  MIN_WEEKLY_DAILIES, APPROVAL_TIMEOUT_MS,
  weekKey, weeklyDailyClaims,
  getGuildMaster, needsMasterApproval, getApproval,
  tryResolveApprovalBySender, getSalaryStatus,
};
