// Push #102f: SPAM AUTO-MUTE. Every cooldown hit ("This command is still on cooldown for you") is a strike.
// 5 strikes = 5 warnings; from the 6th on, EVERY hit mutes the player for a random 5–30 min (Pro: max 15) —
// in a group the bot deletes everything they send (group mute), in DM the bot ignores them. Strikes reset every
// Sunday 00:00 WAT. Owners are exempt; mods are not.
'use strict';
const WARNINGS = 5, MIN_MIN = 5, MAX_MIN = 30, PRO_MAX_MIN = 15;
const bare = j => String(j || '').split(':')[0].split('@')[0];
function weekStart(now = Date.now()) { // most recent Sunday 00:00 WAT (UTC+1)
  const w = new Date(now + 3600e3); const d = new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate() - w.getUTCDay()));
  return d.getTime() - 3600e3;
}
function rec(db, jid, now) {
  if (!db.spamStrikes) db.spamStrikes = {};
  const k = bare(jid); let r = db.spamStrikes[k];
  const ws = weekStart(now);
  if (!r || (r.week || 0) < ws) r = db.spamStrikes[k] = { week: ws, n: 0, mutes: 0 };
  return r;
}
function rollMinutes(pro, rnd = Math.random) { const max = pro ? PRO_MAX_MIN : MAX_MIN; return MIN_MIN + Math.floor(rnd() * (max - MIN_MIN + 1)); }
/** Register a cooldown hit. Returns { warning, left } or { mute, minutes, strikes }. */
function strike(db, jid, { chatId, pro, isOwner, now = Date.now(), rnd } = {}) {
  if (isOwner) return null;
  const r = rec(db, jid, now); r.n++;
  if (r.n <= WARNINGS) return { warning: r.n, left: WARNINGS - r.n, strikes: r.n };
  const minutes = rollMinutes(!!pro, rnd); r.mutes++;
  const Mod = require('./ModerationUtils');
  if (chatId && String(chatId).endsWith('@g.us')) Mod.groupMute(db, chatId, jid, 'AstraSpamGuard', minutes);
  else Mod.muteUser(db, jid, 'AstraSpamGuard', minutes);
  return { mute: true, minutes, strikes: r.n };
}
function status(db, jid, now = Date.now()) { const r = (db.spamStrikes || {})[bare(jid)]; if (!r || (r.week || 0) < weekStart(now)) return { n: 0, mutes: 0 }; return { n: r.n, mutes: r.mutes || 0 }; }
module.exports = { strike, status, weekStart, rollMinutes, WARNINGS, MIN_MIN, MAX_MIN, PRO_MAX_MIN };
