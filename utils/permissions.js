// ═══════════════════════════════════════════════════════════════
// Astra — Permission Tiers
// Single source of truth for "is this JID allowed to do X?"
//
// Hierarchy:
//   botOwners    (top tier — Senku + Naruto are always in here)
//   botMods      (mid tier — operator-managed)
//   registered   (regular player, can do most things)
//   guest        (anyone not registered)
//
// db shape:
//   db.botOwners = [jid, jid, ...]      // super-tier (rare, sensitive commands)
//   db.botMods   = [jid, jid, ...]      // standard admin (most /admin/* commands)
// ═══════════════════════════════════════════════════════════════

'use strict';

const { OWNER_JID, COOWNER_JID, isPrivileged, stripDevice } = require('./constants');

/**
 * The two top-tier JIDs are always botOwners, regardless of what's in the DB.
 * This is enforced at every check, so a DB tampering can't demote them.
 */
// Return just the bare phone number (drops the @domain AND any :device).
// Used only for COMPARISON — never mutate the stored OWNER_JID, which must
// keep its @lid suffix so it can still be used to send messages / mention.
function bare(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0];
}

function getBotOwners(db) {
  if (!db) db = {};
  if (!Array.isArray(db.botOwners)) db.botOwners = [];
  const builtIn = [OWNER_JID, COOWNER_JID].filter(Boolean);
  // Merge, dedupe, ensure built-in are always present
  const set = new Set(builtIn);
  for (const j of db.botOwners) set.add(stripDevice(j));
  return [...set];
}

function getBotMods(db) {
  if (!db) db = {};
  if (!Array.isArray(db.botMods)) db.botMods = [];
  const owners = new Set(getBotOwners(db));
  // Mods are botMods, minus anyone who's already an owner
  return db.botMods.map(stripDevice).filter(j => !owners.has(j));
}

/**
 * Tier check — returns one of: 'owner' | 'mod' | 'player' | 'guest'
 */
function getTier(db, jid) {
  if (!jid) return 'guest';
  const clean = bare(jid);
  // Compare on bare numbers so "@lid" owners match "@s.whatsapp.net" senders.
  if (getBotOwners(db).some(o => bare(o) === clean))  return 'owner';
  if (getBotMods(db).some(o => bare(o) === clean))    return 'mod';
  // Registered player (db.users keys are bare numbers)
  if (db?.users?.[clean])                             return 'player';
  return 'guest';
}

function isBotOwner(db, jid) {
  return getTier(db, jid) === 'owner';
}
function isBotMod(db, jid) {
  const t = getTier(db, jid);
  return t === 'owner' || t === 'mod';   // owners are implicitly mods
}

// Owners are automatically Pro: stamp lifetime Pro onto the owner's player
// object (called on every command by the handler; idempotent). Returns true
// when it stamped something new (caller should saveDatabase).
const OWNER_PRO_EXPIRES = 4102444800000; // 2100-01-01
function ensureOwnerPro(db, jid) {
  try {
    if (!isBotOwner(db, jid)) return false;
    const p = db?.users?.[jid];
    if (!p) return false;
    if (p.isPro && p.proExpiresAt && p.proExpiresAt >= OWNER_PRO_EXPIRES) return false;
    p.isPro = true;
    if (!p.proStatus) p.proStatus = 'owner';
    p.proExpiresAt = OWNER_PRO_EXPIRES;
    return true;
  } catch (e) { return false; }
}
function isRegistered(db, jid) {
  if (!db?.users) return false;
  // db.users keys may be stored EITHER as full JIDs (e.g. "2219...@lid", as /register
  // writes via db.users[sender]) OR as bare numbers (some old data). Try every form so
  // a registered player is never mistaken for a guest — the /setserf "Register first"
  // bug came from checking only the bare form against full-JID keys.
  if (db.users[jid]) return true;
  const b = bare(jid);
  if (db.users[b]) return true;
  if (db.users[`${b}@s.whatsapp.net`]) return true;
  if (db.users[`${b}@lid`]) return true;
  // Last resort: any key whose bare number matches (handles device-suffixed keys).
  for (const k of Object.keys(db.users)) {
    if (k.split('@')[0].split(':')[0] === b) return true;
  }
  return false;
}

/**
 * Higher-level helpers
 */
function canManageMods(db, jid)    { return isBotOwner(db, jid); }            // only owners can /set --mod
function canBan(db, jid)           { return isBotMod(db, jid); }              // any mod can /ban
function canMute(db, jid)          { return isBotMod(db, jid); }              // any mod can /mute
function canAccessDM(db, jid)      { return isBotMod(db, jid); }              // keep DM commands restricted (no public DM use)
function canUseAdminCommand(db, jid) { return isBotMod(db, jid); }

module.exports = {
  getBotOwners,
  getBotMods,
  getTier,
  isBotOwner,
  isBotMod,
  ensureOwnerPro,
  OWNER_PRO_EXPIRES,
  isRegistered,
  canManageMods,
  canBan,
  canMute,
  canAccessDM,
  canUseAdminCommand,
};
