// ═══════════════════════════════════════════════════════════════
// Astra — Exile (Push #101): network-wide permanent removal of one person.
//
//   /exile <number> [reason]   owner, DM only, two confirmations
//   • every linked bot removes the number from every group it admins
//   • every bot blocks the number (no DMs, no commands — silent)
//   • auto-removed within seconds if they ever rejoin any group (any bot)
//   • LID identities tied to the number are exiled with it
//   • the RPG account is wiped (same scrub as /reset: guilds, keys, refs)
//   • only an owner can /exile lift <number>
// Records live in db.exiles[bare] = { by, at, reason, lids: [] }.
// ═══════════════════════════════════════════════════════════════
'use strict';

function bare(j) { return String(j || '').split(':')[0].split('@')[0].replace(/\D/g, ''); }
function table(db) { if (!db.exiles || typeof db.exiles !== 'object') db.exiles = {}; return db.exiles; }

/** Every bare id (phone + LIDs) known for this person. */
function identities(db, jid) {
  const out = new Set(); const b = bare(jid); if (b) out.add(b);
  try {
    const lm = db.lidMap || {};
    // lidMap: lid -> phone jid. Collect both directions.
    for (const [lid, ph] of Object.entries(lm)) { const pb = bare(ph), lb = bare(lid); if (pb && (pb === b || lb === b)) { out.add(pb); out.add(lb); } }
  } catch (e) {}
  return [...out].filter(Boolean);
}
function isExiled(db, jid) {
  const t = table(db); if (!Object.keys(t).length) return null;
  for (const id of identities(db, jid)) { if (t[id]) return t[id]; for (const rec of Object.values(t)) if (Array.isArray(rec.lids) && rec.lids.includes(id)) return rec; }
  return null;
}
function add(db, number, by, reason) {
  const b = bare(number); if (!b || b.length < 7) return { ok: false, text: '❌ Give a full phone number, e.g. /exile 2348012345678' };
  const t = table(db);
  if (t[b]) return { ok: false, text: `⚠️ +${b} is already exiled (since ${new Date(t[b].at).toISOString().slice(0, 10)}).` };
  const lids = identities(db, b).filter(x => x !== b);
  t[b] = { by: bare(by), at: Date.now(), reason: String(reason || '').slice(0, 200) || 'no reason given', lids, kicks: 0 };
  return { ok: true, rec: t[b], bare: b };
}
function lift(db, number) {
  const b = bare(number); const t = table(db);
  if (!t[b]) return { ok: false, text: `❌ +${b} is not exiled.` };
  const rec = t[b]; delete t[b];
  return { ok: true, rec, bare: b };
}
function list(db) { return Object.entries(table(db)).map(([b, r]) => ({ bare: b, ...r })); }

/** Wipe the RPG account using the same scrub as /reset (no reversal backup). */
function wipeAccount(db, number, log = []) {
  const b = bare(number);
  try {
    const R = require('../../commands/rpg/reset').__test;
    const cands = Object.keys(db.users || {}).filter(j => identities(db, b).includes(bare(j)));
    for (const jid of cands) {
      const variants = R.jidVariants(jid);
      try { R.wipeGuilds(db, jid, variants, log); } catch (e) {}
      try { require('../dungeons/GateKeyManager').burnKeysOf(jid, db, { by: 'exile' }); } catch (e) {}
      delete db.users[jid];
      try { R.wipeLiveSessions(db, variants, log); } catch (e) {}
      try { R.scrubCollections(db, variants, log); } catch (e) {}
      try { R.wipeSideFiles(variants); } catch (e) {}
    }
    return cands.length;
  } catch (e) { log.push('wipe error: ' + e.message); return 0; }
}

/** Remove any exiled participant from one group on one socket. Returns kicked jids. */
async function enforceInGroup(sock, db, chatId, participants) {
  const t = table(db); if (!Object.keys(t).length) return [];
  const hits = [];
  for (const p of participants || []) {
    const jid = typeof p === 'string' ? p : (p && (p.id || p.jid)); if (!jid) continue;
    const pn = p && p.phoneNumber ? p.phoneNumber : null;
    const rec = isExiled(db, jid) || (pn ? isExiled(db, pn) : null);
    if (rec) hits.push(jid);
  }
  if (!hits.length) return [];
  try { await sock.groupParticipantsUpdate(chatId, hits, 'remove'); for (const h of hits) { const r = isExiled(db, h); if (r) r.kicks = (r.kicks || 0) + 1; } } catch (e) { return []; }
  return hits;
}
/** Sweep every group every bot can see; block on every bot. Returns a summary. */
async function sweepAll(sockets, db, number) {
  const b = bare(number); const ids = identities(db, b);
  const jids = [...new Set(ids.flatMap(x => [`${x}@s.whatsapp.net`, `${x}@lid`]))];
  let groups = 0, kicked = 0, blocked = 0;
  for (const [key, sock] of Object.entries(sockets || {})) {
    if (!sock || !sock.user?.id) continue;
    for (const j of jids) { try { await sock.updateBlockStatus(j, 'block'); blocked++; break; } catch (e) {} }
    let all = {}; try { all = await sock.groupFetchAllParticipating(); } catch (e) { continue; }
    for (const [gid, meta] of Object.entries(all || {})) {
      groups++;
      const hit = (meta.participants || []).filter(p => { const pb = bare(p.id), pn = bare(p.phoneNumber || ''); return ids.includes(pb) || (pn && ids.includes(pn)); });
      if (!hit.length) continue;
      try { await sock.groupParticipantsUpdate(gid, hit.map(p => p.id), 'remove'); kicked += hit.length; } catch (e) {}
    }
  }
  return { groups, kicked, blocked, jids };
}

module.exports = { bare, table, identities, isExiled, add, lift, list, wipeAccount, enforceInGroup, sweepAll };
