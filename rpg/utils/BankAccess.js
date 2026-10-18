// Push #102f: BANK CREATION IS A PAID (off-bot, ₦40,000) PRIVILEGE. An Owner grants it with /ba @user (or by reply);
// only granted hunters (and Owners) can /bank create — no in-game Nexus fee, no level gate.
'use strict';
const bare = j => String(j || '').split(':')[0].split('@')[0];
function forms(db, jid) {
  const b = bare(jid); const out = new Set([b]);
  try { const m = db && db.lidMap; if (m) { if (m[b]) out.add(bare(m[b])); for (const [k, v] of Object.entries(m)) if (bare(v) === b) out.add(bare(k)); } } catch (e) {}
  return [...out].filter(Boolean);
}
function store(db) { if (!db.bankAccess || typeof db.bankAccess !== 'object') db.bankAccess = {}; return db.bankAccess; }
function has(db, jid) { const s = (db && db.bankAccess) || {}; return forms(db, jid).some(f => !!s[f]); }
function grant(db, jid, byJid) { const s = store(db); const b = bare(jid); if (s[b]) return { ok: false, text: `ℹ️ +${b} already has bank-creation access.` }; s[b] = { by: bare(byJid), at: Date.now() }; return { ok: true, bare: b }; }
function revoke(db, jid) { const s = store(db); let n = 0; for (const f of forms(db, jid)) if (s[f]) { delete s[f]; n++; } return { ok: n > 0, bare: bare(jid) }; }
function list(db) { return Object.entries((db && db.bankAccess) || {}).map(([b, r]) => ({ bare: b, by: r.by, at: r.at })); }
module.exports = { has, grant, revoke, list, forms, bare };
