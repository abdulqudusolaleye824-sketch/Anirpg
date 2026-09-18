// ═══════════════════════════════════════════════════════════════
// Astra — Shared Constants
// Single source of truth for owner / co-owner JIDs and other
// immutable identifiers used across the bot.
//
// MIGRATION:
//   Old: const BOT_OWNER = '221951679328499@lid';
//   New: const { OWNER_JID } = require('../utils/constants');
//
// Env vars OWNER_JID and COOWNER_JID take precedence over the
// built-in defaults. This is the safe, drop-in replacement for
// files that previously hardcoded the owner JID.
// ═══════════════════════════════════════════════════════════════

'use strict';

// Load .env if not already loaded (idempotent — safe to require multiple times)
try { require('dotenv').config(); } catch (_) { /* dotenv not installed; rely on env */ }

// Strip any trailing :device suffix (Baileys sometimes adds it)
function stripDevice(jid) {
  if (!jid) return jid;
  return jid.split(':')[0];
}

// OWNER_JID — primary bot owner. Reads from env, falls back to
// the historical hardcoded default so existing deployments work
// without .env changes. Override in your .env to change owners
// without touching source.
const OWNER_JID = stripDevice(
  (process.env.OWNER_JID && process.env.OWNER_JID.trim()) ||
  '221951679328499@lid'
);

// COOWNER_JID — secondary owner (legacy LID identity). Same convention.
// NOTE (Push #69): the co-owner is ALSO recognized by COOWNER_PHONE (their
// personal number) — see isCoownerJid(). Both identities count.
const COOWNER_JID = stripDevice(
  (process.env.COOWNER_JID && process.env.COOWNER_JID.trim()) ||
  '194592469209292@lid'
);

// Push #69: the co-owner's personal PHONE number. Modern WhatsApp delivers
// sender JIDs in different forms (legacy @lid vs @s.whatsapp.net number,
// with/without :device), and a single stale identity is exactly what
// silently stripped the co-owner's owner rights (all owner commands + /link).
// We therefore treat BOTH identities as the co-owner. Override with the env
// var COOWNER_PHONE if the number ever changes.
const COOWNER_PHONE = stripDevice(
  (process.env.COOWNER_PHONE && process.env.COOWNER_PHONE.trim()) ||
  '2347062052095@s.whatsapp.net'
);

// Every built-in co-owner identity (lid + phone), deduped.
const COOWNER_ALL = [...new Set([COOWNER_JID, COOWNER_PHONE].filter(Boolean))];

// True when the given JID (any form: lid / phone / :device-suffixed) is the
// co-owner. Compare on bare numbers only.
function isCoownerJid(jid) {
  const bare = (j) => String(j || '').split('@')[0].split(':')[0];
  const s = bare(jid);
  if (!s) return false;
  return COOWNER_ALL.some(c => bare(c) === s);
}

// PRIVELEGED_JIDS — set of JIDs that bypass rate limits & cooldowns
// (currently OWNER + COOWNER). Add more by pushing additional JIDs.
const PRIVILEGED_JIDS = new Set([OWNER_JID, COOWNER_JID, COOWNER_PHONE].filter(Boolean));

// Helper: is a sender privileged?
function isPrivileged(jid) {
  if (!jid) return false;
  return PRIVILEGED_JIDS.has(stripDevice(jid));
}

// For legacy "BOT_OWNER" callers that used the digit-only form
const OWNER_NUMBER = OWNER_JID.split('@')[0];

// ── Currency (single source of truth) ─────────────────────────────────────
// The bot's currency is "Nexus". Internally players store it in `player.gold`
// (legacy field name). These constants drive every UI/label so currency name
// and emoji stay consistent across the whole bot.
const CURRENCY = {
  name:    'Nexus',
  emoji:   '💠',          // Nexus mark
  unit:    'Nexus',       // short unit suffix
  stones:  'Mana Stones',
  stonesEmoji: '💎',
};

module.exports = {
  OWNER_JID,
  COOWNER_JID,
  COOWNER_PHONE,
  COOWNER_ALL,
  isCoownerJid,
  PRIVILEGED_JIDS,
  OWNER_NUMBER,
  isPrivileged,
  stripDevice,
  CURRENCY,
};
