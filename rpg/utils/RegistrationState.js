// ═══════════════════════════════════════════════════════════════
// RegistrationState — shared pending-registration store.
// register.js (the /register command) and MultiSocketManager (plain-text
// DOB / referral-code replies) both read/write this module, so the
// multi-message flow works no matter which file handles the reply.
// ═══════════════════════════════════════════════════════════════
'use strict';

const pending = {};
const TTL_MS = 10 * 60 * 1000;

function get(sender) {
  const p = pending[sender];
  if (!p) return null;
  if (Date.now() > p.expiresAt) { delete pending[sender]; return null; }
  return p;
}

function set(sender, entry) {
  pending[sender] = { ...entry, expiresAt: Date.now() + TTL_MS };
  return pending[sender];
}

function clear(sender) { delete pending[sender]; }

function minutesLeft(sender) {
  const p = pending[sender];
  if (!p) return 0;
  return Math.max(1, Math.ceil((p.expiresAt - Date.now()) / 60000));
}

// Prune expired entries (called lazily; no timers — safe on reload).
function prune() {
  const now = Date.now();
  for (const k of Object.keys(pending)) {
    if (now > pending[k].expiresAt) delete pending[k];
  }
}

module.exports = { get, set, clear, minutesLeft, prune };
