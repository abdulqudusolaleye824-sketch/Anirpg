'use strict';
// Push #96h-z20: ONE record per hunter.
// WhatsApp now addresses the same person as `<phone>@s.whatsapp.net` in some chats and `<lid>@lid` in
// others. `resolve(db, anyForm)` returns the key of the EXISTING db.users row for that person (direct hit,
// bare-number hit, or the lid↔phone pair Baileys taught us in db.lidMap) — or null when nobody matches.
function bare(j) { return String(j || '').split(':')[0].split('@')[0]; }

function resolve(db, jid) {
  if (!db || !db.users || !jid) return null;
  const users = db.users;
  const s = String(jid).split(':')[0];
  if (users[s]) return s;
  const b = bare(s);
  if (!b) return null;
  if (users[`${b}@s.whatsapp.net`]) return `${b}@s.whatsapp.net`;
  if (users[`${b}@lid`]) return `${b}@lid`;
  if (users[b]) return b;
  const alt = db.lidMap && db.lidMap[b];
  if (alt) {
    if (users[`${alt}@s.whatsapp.net`]) return `${alt}@s.whatsapp.net`;
    if (users[`${alt}@lid`]) return `${alt}@lid`;
    if (users[alt]) return alt;
  }
  const hit = Object.keys(users).find(k => bare(k) === b || (alt && bare(k) === alt) || (users[k] && bare(users[k].id) === b));
  return hit || null;
}

function player(db, jid) { const k = resolve(db, jid); return k ? db.users[k] : null; }

// True when the two forms address the same hunter (bare equality or the learned lid↔phone pair).
function same(db, a, b) {
  const x = bare(a), y = bare(b); if (!x || !y) return false; if (x === y) return true;
  const m = db && db.lidMap; return !!(m && (m[x] === y || m[y] === x));
}

module.exports = { bare, resolve, player, same };
