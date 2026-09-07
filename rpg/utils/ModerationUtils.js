/**
 * ModerationUtils — shared helpers for ban / mute / unban / listed moderation.
 * Single source of truth for:
 *   • JID normalisation (all ban/mute keys are stored as the BARE number,
 *     e.g. "2348012345678", so enforcement matches regardless of device
 *     suffix or @lid / @s.whatsapp.net domain).
 *   • Permission checks (owner / co-owner / mods via the shared Perms tier).
 *   • protect() — prevents banning/muting moderators & owners.
 *
 * WHY: previously ban.js stored the target under the mention JID (e.g.
 * "234...@s.whatsapp.net") while the handler checked db.bannedUsers[sender]
 * (e.g. "234...:2@s.whatsapp.net") — the keys never matched, so bans never
 * actually blocked anyone. Normalising to the bare number fixes it.
 */

'use strict';

const Perms = require('../../utils/permissions');

/** Bare number JID: strips device suffix AND domain. e.g. "234:2@s.whatsapp.net" -> "234" */
function bare(jid) {
  if (!jid) return jid;
  return String(jid).split(':')[0].split('@')[0];
}

/** Try to resolve a stored user object by any JID form. */
function getUser(db, jid) {
  if (!jid) return null;
  if (db.users?.[jid]) return db.users[jid];
  if (db.users?.[bare(jid)]) return db.users[bare(jid)];
  return null;
}

/** Can this sender moderate (owner, co-owner, or mod)? */
function canModerate(db, sender) {
  return Perms.isBotMod(db, sender);
}

/**
 * Robust bare-number check: is `jid` in the db.botMods list (regardless of
 * device suffix or @lid/@s.whatsapp.net domain)? Used by commands that keep a
 * local `db.botMods.includes(...)` check. Does NOT include owners — combine
 * with Perms.isBotOwner when you need the full tier.
 */
function isMod(db, jid) {
  if (!jid) return false;
  const b = bare(jid);
  return (db.botMods || []).some((m) => bare(m) === b);
}

/** Is `jid` an owner or co-owner (via Perms)? */
function isOwnerLike(db, jid) {
  return Perms.isBotOwner(db, jid);
}

/** Is the target protected (owner / co-owner / another mod)? */
function isProtected(db, targetJid) {
  const t = bare(targetJid);
  // owners & co-owners
  if (Perms.getBotOwners(db).some((o) => bare(o) === t)) return true;
  // other mods
  if (Perms.getBotMods(db).some((m) => bare(m) === t)) return true;
  return false;
}

/** Ban a user (bare-number key). Returns the stored record. */
function banUser(db, targetJid, bannedBy, reason) {
  if (!db.bannedUsers) db.bannedUsers = {};
  const key = bare(targetJid);
  const rec = { bannedBy, bannedAt: Date.now(), reason: reason || 'No reason provided' };
  db.bannedUsers[key] = rec;
  return { key, rec };
}

function unbanUser(db, targetJid) {
  if (!db.bannedUsers) return false;
  const key = bare(targetJid);
  if (!db.bannedUsers[key]) return false;
  delete db.bannedUsers[key];
  return true;
}

function isBanned(db, jid) {
  return !!(db.bannedUsers && db.bannedUsers[bare(jid)]);
}

/** Mute a user (bare-number key). durationMinutes=0 -> indefinite. */
function muteUser(db, targetJid, mutedBy, durationMinutes) {
  if (!db.mutedUsers) db.mutedUsers = {};
  const key = bare(targetJid);
  const durMs = (durationMinutes || 0) * 60 * 1000;
  const rec = {
    mutedBy,
    mutedAt: Date.now(),
    duration: durMs,
    endsAt: durMs > 0 ? Date.now() + durMs : null,
  };
  db.mutedUsers[key] = rec;
  return { key, rec };
}

function unmuteUser(db, targetJid) {
  if (!db.mutedUsers) return false;
  const key = bare(targetJid);
  if (!db.mutedUsers[key]) return false;
  delete db.mutedUsers[key];
  return true;
}

function isMuted(db, jid) {
  return !!(db.mutedUsers && db.mutedUsers[bare(jid)]);
}

/** Expire any temporary mutes whose time is up. Returns array of expired keys. */
function purgeExpiredMutes(db) {
  const expired = [];
  if (!db.mutedUsers) return expired;
  const now = Date.now();
  for (const key of Object.keys(db.mutedUsers)) {
    const m = db.mutedUsers[key];
    if (m?.endsAt && now > m.endsAt) {
      delete db.mutedUsers[key];
      expired.push(key);
    }
  }
  return expired;
}

module.exports = {
  bare,
  getUser,
  canModerate,
  isMod,
  isOwnerLike,
  isProtected,
  banUser,
  unbanUser,
  isBanned,
  muteUser,
  unmuteUser,
  isMuted,
  purgeExpiredMutes,
};
