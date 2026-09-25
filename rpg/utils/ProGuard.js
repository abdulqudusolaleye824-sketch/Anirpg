'use strict';
// Push #88f — when a Pro subscription lapses, EVERY Pro perk is stripped:
// locked profile, custom reaction emoji, pro flags. Runs per command (cheap)
// and as a boot sweep so nobody keeps a perk on a dead sub.
function isLapsed(p) {
  if (!p) return false;
  const flagged = !!(p.isPro || p.proStatus || p.profileLocked || p.customEmoji);
  const active = !!(p.proExpiresAt && p.proExpiresAt > Date.now());
  return flagged && !active;
}
function enforce(p) {
  if (!isLapsed(p)) return { stripped: false };
  const had = { pro: !!(p.isPro || p.proStatus), lock: !!p.profileLocked, emoji: !!p.customEmoji };
  p.isPro = false;
  p.proStatus = false;
  p.profileLocked = false;
  if (p.customEmoji) { p.lastCustomEmoji = p.customEmoji; delete p.customEmoji; }
  p.proStrippedAt = Date.now();
  return { stripped: true, had };
}
function sweep(db) {
  let n = 0;
  for (const p of Object.values((db && db.users) || {})) { try { if (enforce(p).stripped) n++; } catch (e) {} }
  return n;
}
module.exports = { isLapsed, enforce, sweep };
