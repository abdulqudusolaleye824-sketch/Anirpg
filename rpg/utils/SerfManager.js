// ═══════════════════════════════════════════════════════════════
// SERF MANAGER — /setserf approval system
//
// Players choose one bot as their "serf" — the only bot allowed
// to DM them (besides the welcome DM). A mod must confirm every
// serf assignment via a 7-character code shown in the Mod GC.
//
// Storage shape (db.serfs):
//   {
//     codes: {
//       'A3K9P2M': {
//         playerJid:  '...@lid',
//         botKey:     'hinata',
//         botJid:     '...@s.whatsapp.net',
//         createdAt:  1234567890,
//         expiresAt:  1234567890 + 30*60*1000,
//         requestedIn: '...@g.us' (where the request was made)
//       }
//     },
//     assignments: {
//       'playerJid@lid': {
//         botKey: 'hinata',
//         botJid: '...@s.whatsapp.net',
//         approvedBy: 'modJid@lid',
//         approvedAt: 1234567890
//       }
//     }
//   }
//
// Expiry: 30 minutes (mod must approve within that window).
// One pending code per player at a time (re-running /setserf
// replaces the old one and generates a new code).
// ═══════════════════════════════════════════════════════════════

'use strict';

const CODE_TTL_MS    = 30 * 60 * 1000; // 30 minutes
const CODE_ALPHABET  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

// Generate a 7-char uppercase alphanumeric code
function generateCode() {
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Create a pending serf request.
 * Returns { success, code, expiresAt } on success,
 *         { success: false, error } on failure.
 */
function createRequest(db, playerJid, botKey, botJid, requestedIn) {
  if (!db.serfs) db.serfs = { codes: {}, assignments: {} };
  if (!db.serfs.codes) db.serfs.codes = {};
  if (!db.serfs.assignments) db.serfs.assignments = {};

  // Evict any prior pending code for this player
  for (const code of Object.keys(db.serfs.codes)) {
    if (db.serfs.codes[code].playerJid === playerJid) {
      delete db.serfs.codes[code];
    }
  }

  // Generate a unique code (retry on rare collision)
  let code;
  for (let i = 0; i < 10; i++) {
    code = generateCode();
    if (!db.serfs.codes[code]) break;
    code = null;
  }
  if (!code) return { success: false, error: 'Could not generate a unique code. Try again.' };

  const expiresAt = Date.now() + CODE_TTL_MS;
  db.serfs.codes[code] = {
    playerJid,
    botKey,
    botJid,
    createdAt: Date.now(),
    expiresAt,
    requestedIn: requestedIn || null,
  };
  return { success: true, code, expiresAt };
}

/**
 * Approve a pending serf request (mod-only caller).
 * Returns { success, playerJid, botKey, botJid } on success,
 *         { success: false, error } on failure.
 */
function approveRequest(db, code, modJid) {
  // Lazy cleanup of expired codes while we're here
  purgeExpired(db);
  if (!db.serfs?.codes?.[code]) {
    return { success: false, error: 'No pending request with that code.' };
  }
  const req = db.serfs.codes[code];
  if (Date.now() > req.expiresAt) {
    delete db.serfs.codes[code];
    return { success: false, error: 'That code has expired. Ask the player to /setserf again.' };
  }

  // Set the assignment
  db.serfs.assignments[req.playerJid] = {
    botKey:     req.botKey,
    botJid:     req.botJid,
    approvedBy: modJid,
    approvedAt: Date.now(),
  };
  // Consume the code
  delete db.serfs.codes[code];
  return {
    success: true,
    playerJid: req.playerJid,
    botKey:    req.botKey,
    botJid:    req.botJid,
  };
}

/**
 * Cancel a pending request (player can re-run /setserf to replace it).
 */
function cancelRequest(db, playerJid) {
  if (!db.serfs?.codes) return false;
  let cancelled = false;
  for (const code of Object.keys(db.serfs.codes)) {
    if (db.serfs.codes[code].playerJid === playerJid) {
      delete db.serfs.codes[code];
      cancelled = true;
    }
  }
  return cancelled;
}

/**
 * Get the player's current serf assignment, or null.
 */
function getSerf(db, playerJid) {
  return db?.serfs?.assignments?.[playerJid] || null;
}

/**
 * Get a pending request for a player, or null.
 */
function getPendingRequest(db, playerJid) {
  if (!db.serfs?.codes) return null;
  for (const code of Object.keys(db.serfs.codes)) {
    if (db.serfs.codes[code].playerJid === playerJid) {
      return { code, ...db.serfs.codes[code] };
    }
  }
  return null;
}

/**
 * Check whether `botKey` is the player's current serf.
 */
function isPlayerSerf(db, playerJid, botKey) {
  const serf = getSerf(db, playerJid);
  return !!(serf && serf.botKey === botKey);
}

/**
 * Check whether `botJid` is the player's current serf.
 */
function isJidPlayerSerf(db, playerJid, botJid) {
  const serf = getSerf(db, playerJid);
  if (!serf) return false;
  if (serf.botJid && serf.botJid === botJid) return true;
  return false;
}

/**
 * List all pending codes (for mod /approveserf status).
 */
function listPending(db) {
  if (!db.serfs?.codes) return [];
  const now = Date.now();
  const out = [];
  for (const [code, req] of Object.entries(db.serfs.codes)) {
    if (now > req.expiresAt) continue; // skip expired
    out.push({ code, ...req, minutesLeft: Math.max(0, Math.ceil((req.expiresAt - now) / 60000)) });
  }
  return out;
}

/**
 * Periodic cleanup of expired codes (memory hygiene).
 */
function purgeExpired(db) {
  if (!db.serfs?.codes) return 0;
  const now = Date.now();
  let pruned = 0;
  for (const code of Object.keys(db.serfs.codes)) {
    if (now > db.serfs.codes[code].expiresAt) {
      delete db.serfs.codes[code];
      pruned++;
    }
  }
  return pruned;
}

module.exports = {
  CODE_TTL_MS,
  generateCode,
  createRequest,
  approveRequest,
  cancelRequest,
  getSerf,
  getPendingRequest,
  isPlayerSerf,
  isJidPlayerSerf,
  listPending,
  purgeExpired,
};
