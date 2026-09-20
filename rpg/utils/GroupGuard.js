// ═══════════════════════════════════════════════════════════════
// GroupGuard — Push #77/#79
// Bots may only sit in groups that were (a) joined with /joingc, (b)
// registered with /setgroup (db.astralGroups), or (c) belong to a WhatsApp
// COMMUNITY that contains any allowed group (community parent + its
// announcement group + linked sub-groups are all one family).
//
// Push #79: the first version compared raw JIDs and did not know about
// communities → the bots left the Astra community (and its announcement
// group) while staying in the sub-groups. Community parents / announcement
// groups are NEVER left automatically now, and the auto-sweep is opt-in
// (db.groupGuardAuto = true) — the owner runs /gcsweep to leave strays.
// ═══════════════════════════════════════════════════════════════
'use strict';

const _lastSweep = {};
const SWEEP_MIN_GAP = 10 * 60 * 1000;

function allowedSet(db) {
  const ok = new Set();
  try { for (const e of Object.values(db.botJoinedGCs || {})) if (e && e.groupId) ok.add(e.groupId); } catch (e) {}
  try { for (const gid of Object.keys(db.astralGroups || {})) ok.add(gid); } catch (e) {}
  try { for (const [gid, v] of Object.entries(db.groupGuardAllow || {})) if (v) ok.add(gid); } catch (e) {}
  return ok;
}

function isCommunityLike(meta) {
  if (!meta) return false;
  return !!(meta.isCommunity || meta.isCommunityAnnounce || meta.announce === true && meta.isCommunityAnnounce !== false && meta.linkedParent);
}

/**
 * Decide, for every group the socket is in, whether it is allowed.
 * groups = result of groupFetchAllParticipating() (id -> metadata).
 */
function classify(db, groups) {
  const ok = allowedSet(db);
  const allowedParents = new Set();
  // Any allowed group that is linked to a community → that community is allowed.
  for (const [gid, m] of Object.entries(groups || {})) {
    if (ok.has(gid) && m && m.linkedParent) allowedParents.add(m.linkedParent);
    if (ok.has(gid) && m && m.isCommunity) allowedParents.add(gid);
  }
  const out = { keep: [], leave: [] };
  for (const [gid, m] of Object.entries(groups || {})) {
    if (db && db.groupGuardDisabled) { out.keep.push(gid); continue; }
    if (ok.has(gid)) { out.keep.push(gid); continue; }
    if (m && (m.isCommunity || m.isCommunityAnnounce)) { out.keep.push(gid); continue; } // never auto-leave a community shell
    if (m && m.linkedParent && allowedParents.has(m.linkedParent)) { out.keep.push(gid); continue; }
    out.leave.push(gid);
  }
  return out;
}

function isAllowed(db, groupId) {
  if (!groupId || !String(groupId).endsWith('@g.us')) return true;
  if (db && db.groupGuardDisabled) return true;
  return allowedSet(db).has(groupId);
}

async function leaveIfUntracked(sock, db, groupId, why = 'untracked') {
  if (isAllowed(db, groupId)) return false;
  // Push #79: when added to a group, check community membership via metadata
  // before leaving — a sub-group of an allowed community is fine.
  try {
    const meta = await sock.groupMetadata(groupId);
    if (meta && (meta.isCommunity || meta.isCommunityAnnounce)) return false;
    if (meta && meta.linkedParent) {
      const all = await sock.groupFetchAllParticipating();
      const c = classify(db, { ...(all || {}), [groupId]: meta });
      if (c.keep.includes(groupId)) return false;
    }
  } catch (e) {}
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
  const c = classify(db, groups);
  const left = [];
  if (opts.dryRun) return { checked: Object.keys(groups).length, left: [], wouldLeave: c.leave.map((id) => ({ id, name: groups[id]?.subject || '' })) };
  for (const gid of c.leave) {
    try {
      try { await sock.sendMessage(gid, { text: '👋 This group is not registered with the Astra network. Bots only stay in groups added by a moderator via /joingc or /setgroup.' }); } catch (e) {}
      await sock.groupLeave(gid);
      left.push({ id: gid, name: groups[gid]?.subject || '' });
      console.log(`[GroupGuard] left ${gid} (sweep:${personalityKey})`);
    } catch (e) { console.error(`[GroupGuard] leave ${gid} failed:`, e.message); }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { checked: Object.keys(groups).length, left };
}

module.exports = { allowedSet, isAllowed, classify, leaveIfUntracked, sweep };
