// ═══════════════════════════════════════════════════════════════
// GroupGuard — Push #77
// Bots may only sit in groups that were (a) joined with /joingc (tracked in
// db.botJoinedGCs) or (b) registered with /setgroup … --main / any /setgroup
// category (db.astralGroups). Anything else — someone adding a bot number to
// a random GC — is left automatically by EVERY bot that is in it.
//
// Sweep runs on every socket 'open' (after a grace period so metadata is
// ready) and whenever a bot is added to a group.
// ═══════════════════════════════════════════════════════════════
'use strict';

const _lastSweep = {};
const SWEEP_MIN_GAP = 10 * 60 * 1000;

function allowedSet(db) {
  const ok = new Set();
  try { for (const e of Object.values(db.botJoinedGCs || {})) if (e && e.groupId) ok.add(e.groupId); } catch (e) {}
  try { for (const gid of Object.keys(db.astralGroups || {})) ok.add(gid); } catch (e) {}
  // Explicit allowlist escape hatch (owner can add via db.groupGuardAllow[gid]=true).
  try { for (const [gid, v] of Object.entries(db.groupGuardAllow || {})) if (v) ok.add(gid); } catch (e) {}
  return ok;
}

function isAllowed(db, groupId) {
  if (!groupId || !String(groupId).endsWith('@g.us')) return true;
  if (db && db.groupGuardDisabled) return true;
  return allowedSet(db).has(groupId);
}

async function leaveIfUntracked(sock, db, groupId, why = 'untracked') {
  if (isAllowed(db, groupId)) return false;
  try {
    try { await sock.sendMessage(groupId, { text: '👋 This group is not registered with the Astra network. Bots only stay in groups added by a moderator via /joingc or /setgroup.' }); } catch (e) {}
    await sock.groupLeave(groupId);
    console.log(`[GroupGuard] left ${groupId} (${why})`);
    return true;
  } catch (e) {
    console.error(`[GroupGuard] leave ${groupId} failed:`, e.message);
    return false;
  }
}

/** Sweep every group this socket participates in; leave the untracked ones. */
async function sweep(sock, db, personalityKey = '?', opts = {}) {
  if (!sock || typeof sock.groupFetchAllParticipating !== 'function') return { checked: 0, left: [] };
  if (db && db.groupGuardDisabled) return { checked: 0, left: [], disabled: true };
  const now = Date.now();
  if (!opts.force && _lastSweep[personalityKey] && now - _lastSweep[personalityKey] < SWEEP_MIN_GAP) return { checked: 0, left: [], skipped: true };
  _lastSweep[personalityKey] = now;
  let groups = {};
  try { groups = await sock.groupFetchAllParticipating(); } catch (e) { return { checked: 0, left: [], error: e.message }; }
  const left = [];
  const ids = Object.keys(groups || {});
  for (const gid of ids) {
    if (isAllowed(db, gid)) continue;
    const ok = await leaveIfUntracked(sock, db, gid, `sweep:${personalityKey}`);
    if (ok) left.push({ id: gid, name: groups[gid]?.subject || '' });
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { checked: ids.length, left };
}

module.exports = { allowedSet, isAllowed, leaveIfUntracked, sweep };
