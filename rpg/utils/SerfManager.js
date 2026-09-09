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
// ═══════════════════════════════════════════════════════════════

'use strict';

const CODE_TTL_MS    = 30 * 60 * 1000; // 30 minutes
const CODE_ALPHABET  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

function generateCode() {
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function createRequest(db, playerJid, botKey, botJid, requestedIn) {
  if (!db.serfs) db.serfs = { codes: {}, assignments: {} };
  if (!db.serfs.codes) db.serfs.codes = {};
  if (!db.serfs.assignments) db.serfs.assignments = {};

  for (const code of Object.keys(db.serfs.codes)) {
    if (db.serfs.codes[code].playerJid === playerJid) {
      delete db.serfs.codes[code];
    }
  }

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

function approveRequest(db, code, modJid) {
  purgeExpired(db);
  if (!db.serfs?.codes?.[code]) {
    return { success: false, error: 'No pending request with that code.' };
  }
  const req = db.serfs.codes[code];
  if (Date.now() > req.expiresAt) {
    delete db.serfs.codes[code];
    return { success: false, error: 'That code has expired. Ask the player to /setserf again.' };
  }

  db.serfs.assignments[req.playerJid] = {
    botKey:     req.botKey,
    botJid:     req.botJid,
    approvedBy: modJid,
    approvedAt: Date.now(),
  };
  delete db.serfs.codes[code];
  return {
    success: true,
    playerJid: req.playerJid,
    botKey:    req.botKey,
    botJid:    req.botJid,
  };
}

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

function getSerf(db, playerJid) {
  if (!db?.serfs?.assignments || !playerJid) return null;
  const assignments = db.serfs.assignments;
  if (assignments[playerJid]) return assignments[playerJid];
  const clean = String(playerJid).split(':')[0];
  if (assignments[clean]) return assignments[clean];
  const bareNumber = clean.split('@')[0].replace(/[^0-9]/g, '');
  if (!bareNumber) return null;
  for (const [k, v] of Object.entries(assignments)) {
    const kBare = String(k).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    if (kBare === bareNumber) return v;
  }
  return null;
}

function getSerfBotKey(db, playerJid) {
  const serf = getSerf(db, playerJid);
  return serf?.botKey || null;
}

function hasApprovedSerf(db, playerJid) {
  return !!getSerf(db, playerJid);
}

function getPendingRequest(db, playerJid) {
  if (!db.serfs?.codes) return null;
  for (const code of Object.keys(db.serfs.codes)) {
    if (db.serfs.codes[code].playerJid === playerJid) {
      return { code, ...db.serfs.codes[code] };
    }
  }
  return null;
}

function isPlayerSerf(db, playerJid, botKey) {
  const serf = getSerf(db, playerJid);
  return !!(serf && serf.botKey === botKey);
}

function isJidPlayerSerf(db, playerJid, botJid) {
  const serf = getSerf(db, playerJid);
  if (!serf) return false;
  if (serf.botJid && serf.botJid === botJid) return true;
  return false;
}

function listPending(db) {
  if (!db.serfs?.codes) return [];
  const now = Date.now();
  const out = [];
  for (const [code, req] of Object.entries(db.serfs.codes)) {
    if (now > req.expiresAt) continue;
    out.push({ code, ...req, minutesLeft: Math.max(0, Math.ceil((req.expiresAt - now) / 60000)) });
  }
  return out;
}

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
  getSerfBotKey,
  hasApprovedSerf,
  getPendingRequest,
  isPlayerSerf,
  isJidPlayerSerf,
  listPending,
  purgeExpired,
};
