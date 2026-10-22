// ═══════════════════════════════════════════════════════════════
// Push #103a (BUG-100): DOMAIN NAME / DESCRIPTION APPROVALS
//
// Every domain name or description a hunter writes (DM setup after the Lv.20 awakening, /domain name,
// /domain desc, or the fresh prompt after /recon) is a REQUEST. The live domain keeps its old text until an
// owner approves. Owners get a DM card with ✅ Approve / ❌ Reject buttons (or /domain approve <id>,
// /domain reject <id> [reason]). The hunter is told the verdict through their serf.
// Records: db.domainApprovals[id] = { id, jid, name, desc, oldName, oldDesc, source, at, status, by, reason }
// ═══════════════════════════════════════════════════════════════
'use strict';
const _clean = (t) => String(t || '').replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();
const bare = (j) => String(j || '').split(':')[0].split('@')[0];

function _all(db) { if (!db.domainApprovals || typeof db.domainApprovals !== 'object') db.domainApprovals = {}; return db.domainApprovals; }
function _id(db) { const all = _all(db); let n = (db.domainApprovalSeq || 0) + 1; db.domainApprovalSeq = n; let id = `DA-${String(n).padStart(3, '0')}`; while (all[id]) { n++; db.domainApprovalSeq = n; id = `DA-${String(n).padStart(3, '0')}`; } return id; }
function findUser(db, jid) {
  if (!db || !db.users) return null;
  if (db.users[jid]) return db.users[jid];
  const b = bare(jid);
  for (const [k, u] of Object.entries(db.users)) if (bare(k) === b || (u && bare(u.jid) === b)) return u;
  try { const alt = db.lidMap && db.lidMap[b]; if (alt) for (const [k, u] of Object.entries(db.users)) if (bare(k) === alt || (u && bare(u.jid) === alt)) return u; } catch (e) {}
  return null;
}
function pendingFor(db, jid) { const all = _all(db); const b = bare(jid); return Object.values(all).find(r => r && r.status === 'pending' && bare(r.jid) === b) || null; }
function get(db, id) { return _all(db)[String(id || '').toUpperCase()] || null; }

/** Validate + queue a request. fields: { name?, desc? }. Returns { ok, rec } or { ok:false, error }. */
function submit(db, jid, player, fields = {}, source = 'setup') {
  const d = player && player.domain; if (!d || !d.unlocked) return { ok: false, error: 'No domain yet.' };
  const name = fields.name != null ? _clean(fields.name) : null; const desc = fields.desc != null ? _clean(fields.desc) : null;
  if (name != null && (name.length < 3 || name.length > 40)) return { ok: false, error: 'Domain names are 3–40 characters.' };
  if (desc != null && desc.length > 2000) return { ok: false, error: `Descriptions are up to 2000 characters (yours is ${desc.length}).` };
  if (name == null && desc == null) return { ok: false, error: 'Nothing to change.' };
  // One open request per hunter: a new submission replaces (merges into) the pending one.
  let rec = pendingFor(db, jid);
  if (!rec) { rec = { id: _id(db), jid, player: player.name, class: d.class || player.classBase || player.class || '—', oldName: d.name, oldDesc: d.desc || '', name: null, desc: null, source, at: Date.now(), status: 'pending' }; _all(db)[rec.id] = rec; }
  if (name != null) rec.name = name; if (desc != null) rec.desc = desc; rec.at = Date.now(); rec.source = source;
  d.pendingApproval = rec.id;
  return { ok: true, rec };
}
function card(rec) {
  return [
    `🌌 *DOMAIN APPROVAL ${rec.id}*`,
    `👤 ${rec.player} · ${rec.class}${rec.source === 'recon' ? ' · after /recon' : rec.source === 'setup' ? ' · awakening' : ''}`,
    rec.name != null ? `✏️ Name: *${rec.name}*${rec.oldName && rec.oldName !== rec.name ? `  _(was ${rec.oldName})_` : ''}` : null,
    rec.desc != null ? `📜 Desc: _${rec.desc.length > 600 ? rec.desc.slice(0, 600) + '…' : rec.desc}_` : null,
    ``,
    `✅ /domain approve ${rec.id}   ·   ❌ /domain reject ${rec.id} [reason]   ·   ⛔ /domain ban ${rec.id}`,
  ].filter(x => x != null).join('\n');
}
function buttons(rec) { return [['✅ Approve', `/domain approve ${rec.id}`], ['❌ Reject', `/domain reject ${rec.id}`], ['⛔ Ban', `/domain ban ${rec.id}`]]; } // Push #103k: Ban = hunter requested without asking

/** DM every owner (phone JIDs, deduped) a card with buttons. Best effort. */
async function notifyOwners(sock, db, rec) {
  let owners = []; try { owners = require('../../utils/permissions').getBotOwners(db) || []; } catch (e) {}
  const targets = []; const seen = new Set();
  for (const j of owners) { if (/@lid$/i.test(String(j))) continue; const b = bare(j); if (!b || seen.has(b)) continue; seen.add(b); targets.push(String(j).includes('@') ? j : `${j}@s.whatsapp.net`); }
  const text = card(rec); let n = 0;
  for (const t of targets) {
    let sent = false;
    try { const B = require('../../utils/buttons'); if (B && B.sendButtons) { await B.sendButtons(sock, t, { text, buttons: B.quickReplies(buttons(rec)) }); sent = true; } } catch (e) { sent = false; }
    if (!sent) { try { await sock.sendMessage(t, { text }); sent = true; } catch (e) {} }
    if (sent) n++;
  }
  return n;
}
function _apply(player, rec) {
  const d = player && player.domain; if (!d) return false;
  if (rec.name != null) d.name = rec.name;
  if (rec.desc != null) { d.desc = rec.desc; d.descEdited = Date.now(); }
  if (d.pendingApproval === rec.id) delete d.pendingApproval;
  d.approvedAt = Date.now();
  return true;
}
function decide(db, id, approve, by, reason = '') {
  const rec = get(db, id); if (!rec) return { ok: false, error: `No approval *${String(id || '').toUpperCase()}*.` };
  if (rec.status !== 'pending') return { ok: false, error: `${rec.id} was already ${rec.status}.` };
  const player = findUser(db, rec.jid);
  rec.status = approve ? 'approved' : 'rejected'; rec.by = by; rec.decidedAt = Date.now(); if (reason) rec.reason = _clean(reason).slice(0, 300);
  if (approve) { if (player) _apply(player, rec); }
  else if (player && player.domain && player.domain.pendingApproval === rec.id) delete player.domain.pendingApproval;
  return { ok: true, rec, player };
}
function verdictText(rec) {
  if (rec.status === 'approved') return [`🌌 *DOMAIN APPROVED*`, rec.name != null ? `✏️ Name: *${rec.name}*` : null, rec.desc != null ? `📜 Description set.` : null, `See it with /domain.`].filter(Boolean).join('\n');
  return [`🌌 *DOMAIN CHANGE REJECTED* (${rec.id})`, rec.name != null ? `✏️ Name: ${rec.name}` : null, rec.desc != null ? `📜 Description` : null, rec.reason ? `Reason: _${rec.reason}_` : null, `Your domain keeps *${rec.oldName}*. You may submit again: /domain name <name> · /domain desc <text>.`].filter(Boolean).join('\n');
}
async function notifyPlayer(sock, db, rec) {
  const text = verdictText(rec);
  try { const r = await require('./SerfDM').sendSerfDM(sock, db, rec.jid, { text }); if (r && (r.ok || r.sent)) return true; } catch (e) {}
  try { await sock.sendMessage(rec.jid, { text }); return true; } catch (e) { return false; }
}
function listPending(db) { return Object.values(_all(db)).filter(r => r && r.status === 'pending').sort((a, b) => a.at - b.at); }
/** Drop decided records older than 30 days. */
function prune(db, now = Date.now()) { const all = _all(db); let n = 0; for (const [k, r] of Object.entries(all)) if (r && r.status !== 'pending' && now - (r.decidedAt || r.at || 0) > 30 * 86400e3) { delete all[k]; n++; } return n; }

module.exports = { submit, decide, get, pendingFor, card, buttons, notifyOwners, notifyPlayer, verdictText, listPending, prune, findUser };
