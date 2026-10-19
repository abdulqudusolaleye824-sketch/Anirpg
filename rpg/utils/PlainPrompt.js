// Push #102: PLAIN-TEXT PROMPTS — a command asks a hunter a question and the hunter answers with a bare
// message (no prefix): "e" for a key rank, an attack-pattern id, a skill name, or "nil" to cancel.
// One pending prompt per hunter per chat; it expires on its own. The MultiSocketManager plain-message
// path calls resolve() BEFORE AI chat so exactly one bot consumes the answer.
const _p = new Map(); // `${chatId}|${bare}` -> { handler, until, forms:Set<bare> }

const CANCEL = /^(nil|cancel|stop|nvm)$/i;
function bare(j) { return String(j || '').split(':')[0].split('@')[0].replace(/\D/g, ''); }

/**
 * expect(chatId, senderForms, handler, ttlMs)
 * senderForms: every jid form the hunter may answer from (resolved jid, msg.key.participant, lid…).
 * handler(text, { cancelled }) -> { command } | { reply } | null   (null = consumed silently)
 */
function expect(chatId, senderForms, handler, ttlMs = 60e3, opts = null) {
  const forms = new Set([].concat(senderForms || []).map(bare).filter(Boolean));
  if (!forms.size) return false;
  // Push #103j (owner): opts.accept (RegExp) — only a message matching it is an ANSWER; anything else is ordinary chat and
  // leaves the prompt pending. opts.replyOnly — the answer must be a quote-reply (to the prompt) as well.
  const rec = { handler, until: Date.now() + Math.max(5e3, ttlMs), forms, chatId, accept: opts && opts.accept instanceof RegExp ? opts.accept : null, replyOnly: !!(opts && opts.replyOnly) };
  for (const f of forms) _p.set(`${chatId}|${f}`, rec);
  return true;
}
function _find(chatId, senderForms, db) {
  const cands = new Set([].concat(senderForms || []).map(bare).filter(Boolean));
  try { for (const c of [...cands]) { const m = db && db.lidMap && db.lidMap[c]; if (m) cands.add(bare(m)); } } catch (e) {}
  for (const c of cands) { const r = _p.get(`${chatId}|${c}`); if (r) return r; }
  return null;
}
function cancel(chatId, senderForms) {
  const r = _find(chatId, senderForms); if (!r) return false;
  for (const f of r.forms) _p.delete(`${chatId}|${f}`);
  return true;
}
function pending(chatId, senderForms, db) { const r = _find(chatId, senderForms, db); return !!(r && r.until > Date.now()); }
/** Returns null when nothing was pending; otherwise whatever the handler returned ({command}|{reply}|{}). */
async function resolve(chatId, senderForms, text, db, meta = null) {
  const r = _find(chatId, senderForms, db);
  if (!r) return null;
  if (r.until < Date.now()) { for (const f of r.forms) _p.delete(`${chatId}|${f}`); return null; }
  const t = String(text || '').trim();
  if (!t) return null;
  if (r.accept && !r.accept.test(t) && !CANCEL.test(t)) return null;            // Push #103j: not an answer — plain chat flows on, prompt stays open
  if (r.replyOnly && !(meta && meta.isReply) && !CANCEL.test(t)) return null;  // Push #103j: must be a quote-reply
  for (const f of r.forms) _p.delete(`${chatId}|${f}`);
  try { return (await r.handler(t, { cancelled: CANCEL.test(t) })) || {}; } catch (e) { return { reply: `❌ ${e.message}` }; }
}
function _sweep() { const now = Date.now(); for (const [k, r] of _p) if (r.until < now) _p.delete(k); }
setInterval(_sweep, 30e3).unref?.();
module.exports = { expect, resolve, cancel, pending, CANCEL, bare, _p };
