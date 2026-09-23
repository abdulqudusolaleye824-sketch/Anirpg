// ═══════════════════════════════════════════════════════════════
// BirthdayManager — Push #87
//
// Every player registered a D.O.B. (dd/mm/yyyy in player.dateOfBirth).
// On their birthday (WAT calendar day):
//   • +24h of PRO access (extends an existing sub, never shortens it)
//   • a warm ~10-line birthday DM via the player's serf bot
//   • no serf / DM dropped → the greeting is posted in the --main
//     support GC with a mention instead
//   • players who were ALREADY Pro before the gift get a public shout-out
//     in the announcements GC (db.announceGC, set with /setspace)
// Runs hourly (idempotent — one greeting per player per year, stored
// in player.lastBirthdayGreetYear). Also runs once shortly after boot.
// ═══════════════════════════════════════════════════════════════
'use strict';

const WAT_OFFSET = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function watNow(now = Date.now()) { return new Date(now + WAT_OFFSET); }

function parseDob(str) {
  const m = String(str || '').trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10), month = parseInt(m[2], 10), year = parseInt(m[3], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return { day, month, year };
}

function isBirthdayToday(player, now = Date.now()) {
  const dob = parseDob(player && player.dateOfBirth);
  if (!dob) return false;
  const d = watNow(now);
  return d.getUTCDate() === dob.day && (d.getUTCMonth() + 1) === dob.month;
}

function ageTurning(player, now = Date.now()) {
  const dob = parseDob(player && player.dateOfBirth);
  if (!dob) return null;
  return watNow(now).getUTCFullYear() - dob.year;
}

function isPro(p, now = Date.now()) {
  return !!(p && (p.isPro || p.proStatus) && p.proExpiresAt && p.proExpiresAt > now);
}

/** +24h Pro. Extends a running sub; returns { wasPro, until }. */
function grantBirthdayPro(player, now = Date.now()) {
  const wasPro = isPro(player, now);
  const base = wasPro ? player.proExpiresAt : now;
  player.proExpiresAt = base + DAY_MS;
  player.isPro = true;
  if (!player.proStatus) player.proStatus = 'birthday';
  if (!player.proTier) player.proTier = 'birthday';
  if (!wasPro) player.proActivatedAt = now;
  player.birthdayProGrantedAt = now;
  try { require('./TransactionLog').logTransaction(player, { type: 'birthday_pro', amount: 1, currency: 'day', note: '24h Pro birthday gift' }); } catch (e) {}
  return { wasPro, until: player.proExpiresAt };
}

function greetingText(player, age, wasPro) {
  const name = player.name || 'Hunter';
  const ageLine = age && age > 0 && age < 120 ? `🎂 *${age}* today — and stronger than ever.` : `🎂 Another year of legend begins today.`;
  return [
    `🎉🎂 *HAPPY BIRTHDAY, ${name.toUpperCase()}!* 🎂🎉`,
    ``,
    `The whole of Astra stops for you today.`,
    ageLine,
    `🌟 May every gate you open drop legendary loot.`,
    `⚔️ May your crits land, your streaks hold, and your rivals kneel.`,
    `💠 May your Nexus overflow and your Mana Stones never run dry.`,
    `🐉 May your pets stay fed, loyal, and terrifying.`,
    `🏰 May your guild treasury be full and your Guild Master pay on time.`,
    `❤️ May your HP stay full and your heart even fuller.`,
    `🍀 May luck follow you into every raid and every /rob.`,
    `✨ Thank you for being part of this world — we're lucky to have you.`,
    ``,
    wasPro
      ? `🎁 *Birthday gift:* +24 hours added to your PRO pass!`
      : `🎁 *Birthday gift:* *24 hours of full PRO access* — unlocked right now! Type */profaq* to see everything you can do today.`,
    ``,
    `— With love, ✦ 𝐀𝐬𝐭𝐫𝐚™ 💎`,
  ].join('\n');
}

function announcementText(player, age) {
  const name = player.name || 'Hunter';
  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🎂✨ *PRO BIRTHDAY SPOTLIGHT* ✨🎂`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `Today our PRO hunter *${name}* celebrates ${age && age > 0 && age < 120 ? `turning *${age}*` : `their birthday`}! 🎉`,
    ``,
    `Drop a 🎂 in the chat and wish them a legendary year.`,
    `🎁 Astra's gift: +24h added to their PRO pass.`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');
}

async function _deliver(db, jid, text, mentions) {
  // 1) serf DM (iron wall lives inside safeSendDM)
  try {
    const MSM = require('../../bots/MultiSocketManager');
    const anySock = typeof MSM.getAnySocket === 'function' ? MSM.getAnySocket() : null;
    if (MSM.safeSendDM && anySock) {
      const r = await MSM.safeSendDM(anySock, jid, { text }, { db });
      if (!(r && r.dropped)) return { via: 'dm' };
    }
  } catch (e) {}
  // 2) fallback: --main support GC with a mention
  try {
    const AG = require('./AstralGroups');
    const sup = AG.getAll(db).find((g) => g && g.type === 'support' && g.isMain) || AG.primaryOf(db, 'support');
    const MSM = require('../../bots/MultiSocketManager');
    const sock = typeof MSM.getAnySocket === 'function' ? MSM.getAnySocket() : null;
    if (sup && sup.groupId && sock) {
      const bare = String(jid).split('@')[0].split(':')[0];
      await sock.sendMessage(sup.groupId, { text: `@${bare}\n\n${text}`, mentions: [jid, ...(mentions || [])] });
      return { via: 'support_gc' };
    }
  } catch (e) {}
  return { via: 'none' };
}

async function _announce(db, jid, text) {
  const gc = db.announceGC || db.announcementGC || null;
  if (!gc) return false;
  try {
    const MSM = require('../../bots/MultiSocketManager');
    const sock = typeof MSM.getAnySocket === 'function' ? MSM.getAnySocket() : null;
    if (!sock) return false;
    await sock.sendMessage(gc, { text, mentions: [jid] });
    return true;
  } catch (e) { return false; }
}

/** One pass over all players. Returns summaries of who was greeted. */
async function runOnce(db, saveDatabase, now = Date.now()) {
  const out = [];
  if (!db || !db.users) return out;
  const year = watNow(now).getUTCFullYear();
  for (const [jid, p] of Object.entries(db.users)) {
    try {
      if (!p || !jid.includes('@')) continue;
      if (!isBirthdayToday(p, now)) continue;
      if (p.lastBirthdayGreetYear === year) continue;
      const age = ageTurning(p, now);
      const { wasPro } = grantBirthdayPro(p, now);
      p.lastBirthdayGreetYear = year; // mark first — never double-gift on a send error
      try { saveDatabase && saveDatabase(); } catch (e) {}
      const d = await _deliver(db, jid, greetingText(p, age, wasPro));
      let announced = false;
      if (wasPro) announced = await _announce(db, jid, announcementText(p, age));
      out.push({ jid, name: p.name, age, wasPro, via: d.via, announced });
      console.log(`[Birthday] 🎂 ${p.name || jid} — via ${d.via}${announced ? ' + announced' : ''}`);
    } catch (e) { console.error('[Birthday] error for', jid, e.message); }
  }
  return out;
}

let _timer = null;
function start(getDatabase, saveDatabase) {
  if (_timer) return;
  const tick = () => runOnce(getDatabase(), saveDatabase).catch((e) => console.error('[Birthday] tick error:', e.message));
  _timer = setInterval(tick, 60 * 60 * 1000);
  setTimeout(tick, 2 * 60 * 1000);
  console.log('[Birthday] hourly birthday scheduler armed');
}

module.exports = { start, runOnce, isBirthdayToday, ageTurning, grantBirthdayPro, greetingText, announcementText, parseDob, _deliver, _announce };
