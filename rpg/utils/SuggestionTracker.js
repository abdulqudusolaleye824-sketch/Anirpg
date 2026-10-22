// Push #103k (owner call): suggestions work exactly like bug reports.
//   Player: /suggest <text> → owners get a DM card with buttons (✅ Approve / ❌ Reject / 🚫 Ban + 💬 Reply).
//   First owner to act wins. The suggester always gets feedback (serf DM → GC @mention → direct).
//   /suggestions (owner, DM)   → re-send every PENDING suggestion card with its buttons.
//   /suggestion list (owner)   → every APPROVED suggestion in one message.
const Perms = require('../../utils/permissions');
const BT = require('./BugTracker'); // stamp / ownerName are shared

const STATUS = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected', BANNED: 'banned' };
const REPLY_WINDOW_MS = 10 * 60e3;

function _bare(j) { return String(j || '').split('@')[0].split(':')[0]; }
const stamp = BT.stamp;
const ownerName = BT.ownerName;

function table(db) { if (!db.suggestions || typeof db.suggestions !== 'object' || Array.isArray(db.suggestions)) db.suggestions = {}; return db.suggestions; }
function nextId(db) { const n = (Number(db.suggestionSeq) || 0) + 1; db.suggestionSeq = n; return `SUG-${String(n).padStart(3, '0')}`; }

function create(db, { reporter, reporterName, chatId, groupName, text }) {
  const id = nextId(db);
  const rec = { id, reporter, reporterName: reporterName || _bare(reporter), chatId, groupName: groupName || chatId, text: String(text || '').trim(), at: Date.now(), status: STATUS.PENDING, handledBy: null, handledByName: null, handledAt: null };
  table(db)[id] = rec;
  return rec;
}
function get(db, id) {
  let k = String(id || '').toUpperCase().trim();
  if (/^\d+$/.test(k)) k = 'SUG-' + k.padStart(3, '0'); else if (/^SUG-?\d+$/.test(k)) k = 'SUG-' + k.replace(/\D/g, '').padStart(3, '0');
  return table(db)[k] || null;
}

function ownerCard(rec) {
  return [
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `💡 *SUGGESTION ${rec.id}*`,
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 From: ${rec.reporterName} (+${_bare(rec.reporter)})`,
    `📍 Where: ${rec.groupName}`,
    `🕒 ${stamp(rec.at)}`,
    ``,
    `📝 ${rec.text}`,
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `Tap a button — the first owner to act handles it.`,
  ].join('\n');
}
function ownerButtons(rec) {
  return [
    ['✅ Approve', `/suggestion approve ${rec.id}`],
    ['❌ Reject', `/suggestion reject ${rec.id}`],
    ['🚫 Ban suggester', `/suggestion ban ${rec.id}`],
    ['💬 Reply', `/suggestion reply ${rec.id}`], // 4th button rolls into a follow-up message (max 3/msg)
  ];
}
function fallbackCommands(rec) { return `/suggestion approve ${rec.id}\n/suggestion reject ${rec.id}\n/suggestion ban ${rec.id}\n/suggestion reply ${rec.id}`; }

// ── owner → suggester replies ──────────────────────────────────────────────
function armReply(db, ownerJid, id) {
  const rec = get(db, id); if (!rec) return { ok: false, text: `❌ No suggestion *${String(id || '').toUpperCase()}*.` };
  if (!db.sugReplyPending) db.sugReplyPending = {};
  db.sugReplyPending[_bare(ownerJid)] = { id: rec.id, at: Date.now() };
  return { ok: true, rec, text: `💬 Type your reply to *${rec.id}* (${rec.reporterName}) as your next message here — it goes straight to them. 10 min window. Send *cancel* to stop.` };
}
function pendingReply(db, ownerJid) {
  const p = db && db.sugReplyPending && db.sugReplyPending[_bare(ownerJid)];
  if (!p) return null;
  if (Date.now() - p.at > REPLY_WINDOW_MS) { delete db.sugReplyPending[_bare(ownerJid)]; return null; }
  return p;
}
function clearPending(db, ownerJid) { if (db && db.sugReplyPending) delete db.sugReplyPending[_bare(ownerJid)]; }
function replyText(rec, text, ownerJid, db) {
  return [`💬 *Reply from the developers — ${rec.id}*`, `💡 _${rec.text.length > 120 ? rec.text.slice(0, 117) + '…' : rec.text}_`, ``, text.trim(), ``, `— ${(db && ownerName(db, ownerJid)) || 'Astra Team'} · ${stamp(Date.now())}`].join('\n');
}
async function _deliver(sock, db, rec, out) {
  let via = null;
  try { const SerfDM = require('./SerfDM'); const r = await SerfDM.sendSerfDM(sock, db, rec.reporter, { text: out }); if (r && r.ok) via = r.via || 'serf'; } catch (e) {}
  if (!via && rec.chatId && String(rec.chatId).endsWith('@g.us')) { try { await sock.sendMessage(rec.chatId, { text: `@${_bare(rec.reporter)}\n${out}`, mentions: [rec.reporter] }); via = 'group'; } catch (e) {} }
  if (!via) { try { await sock.sendMessage(rec.reporter, { text: out }); via = 'direct'; } catch (e) {} }
  return via;
}
async function sendReply(sock, db, ownerJid, id, text) {
  const rec = get(db, id); if (!rec) return { ok: false, text: `❌ No suggestion *${String(id || '').toUpperCase()}*.` };
  const body = String(text || '').trim(); if (!body) return { ok: false, text: `❌ Empty reply.` };
  rec.replies = rec.replies || []; rec.replies.push({ by: _bare(ownerJid), at: Date.now(), text: body });
  const via = await _deliver(sock, db, rec, replyText(rec, body, ownerJid, db));
  return { ok: !!via, via, rec, text: via ? `✅ Reply to *${rec.id}* delivered to ${rec.reporterName} (${via}).` : `❌ Could not reach ${rec.reporterName}.` };
}

function reporterFeedback(rec) {
  const when = stamp(rec.at), now = stamp(rec.handledAt || Date.now());
  if (rec.status === STATUS.APPROVED) return `💡 *Suggestion ${rec.id}*\n\n✅ Your suggestion from *${when}* has been APPROVED — it is on the build list.\n\n📝 "${rec.text}"\n🕒 Approved: ${now}\n\nThank you for helping shape Astra!`;
  if (rec.status === STATUS.REJECTED) return `💡 *Suggestion ${rec.id}*\n\nPertaining your suggestion on *${when}*: after consideration it will not be added for now.\n\n📝 "${rec.text}"\n🕒 Reviewed: ${now}\n\nKeep the ideas coming — /suggest any time.`;
  if (rec.status === STATUS.BANNED) return `🚫 *Suggestion ${rec.id}*\n\nYou are now banned from using bot commands for using the suggest command to play.\n\n📝 "${rec.text}"\n🕒 ${now}`;
  return `💡 *Suggestion ${rec.id}* received on ${when}. The developers will look at it.`;
}

/** Owner decision. action ∈ approve | reject | ban. */
function decide(db, id, action, ownerJid) {
  const rec = get(db, id);
  if (!rec) return { ok: false, text: `❌ No suggestion *${String(id || '').toUpperCase()}*.` };
  if (!Perms.isBotOwner(db, ownerJid)) return { ok: false, text: '❌ Only bot owners can handle suggestions.' };
  if (rec.status !== STATUS.PENDING) {
    const who = rec.handledByName || ownerName(db, rec.handledBy);
    const self = _bare(rec.handledBy) === _bare(ownerJid);
    return { ok: false, rec, alreadyHandled: true, text: self ? `ℹ️ You already handled *${rec.id}* (${rec.status}, ${stamp(rec.handledAt)}).` : `⚠️ *${rec.id}* is already being handled by *${who}* (${rec.status}, ${stamp(rec.handledAt)}).` };
  }
  const map = { approve: STATUS.APPROVED, reject: STATUS.REJECTED, ban: STATUS.BANNED };
  const st = map[String(action || '').toLowerCase()];
  if (!st) return { ok: false, rec, text: '❌ Unknown action. Use approve / reject / ban.' };
  rec.status = st; rec.handledBy = ownerJid; rec.handledByName = ownerName(db, ownerJid); rec.handledAt = Date.now();
  if (st === STATUS.BANNED) {
    try {
      const Mod = require('./ModerationUtils');
      if (!Mod.isBanned(db, rec.reporter) && !Perms.isBotOwner(db, rec.reporter)) {
        Mod.banUser(db, rec.reporter, ownerJid, `Abusing /suggest (${rec.id})`, { gc: rec.chatId, gcName: rec.groupName, bannedAtGMT: new Date().toUTCString() });
      }
    } catch (e) {}
  }
  const label = { approved: '✅ Approved', rejected: '❌ Rejected', banned: '🚫 Suggester banned from bot commands' }[st];
  return { ok: true, rec, text: `${label} — *${rec.id}* by ${rec.handledByName} · ${stamp(rec.handledAt)}.\nThe suggester has been notified.` };
}

/** /suggestion delete <id|all> — owner removes a suggestion (any status); `all` clears every approved one. */
function remove(db, id, ownerJid) {
  if (!Perms.isBotOwner(db, ownerJid)) return { ok: false, text: '❌ Only bot owners can delete suggestions.' };
  const tb = table(db);
  if (String(id || '').toLowerCase() === 'all') {
    const ids = Object.keys(tb).filter(k => tb[k].status === STATUS.APPROVED); for (const k of ids) delete tb[k];
    return { ok: true, text: `🗑️ Deleted ${ids.length} approved suggestion${ids.length === 1 ? '' : 's'}.` };
  }
  const rec = get(db, id);
  if (!rec) return { ok: false, text: `❌ No suggestion *${String(id || '').toUpperCase()}*. Check */suggestion list*.` };
  delete tb[rec.id];
  return { ok: true, rec, text: `🗑️ *${rec.id}* deleted — "${rec.text.slice(0, 80)}" (by ${rec.reporterName}). ${stamp()}` };
}

/** /suggestion list — approved suggestions only. */
function listText(db) {
  const all = Object.values(table(db)).filter(r => r.status === STATUS.APPROVED).sort((a, b) => a.at - b.at);
  if (!all.length) return '💡 *APPROVED SUGGESTIONS*\n\nNothing approved yet.';
  const lines = [`💡 *APPROVED SUGGESTIONS* (${all.length})`, `━━━━━━━━━━━━━━━━━━━━━━━`];
  all.forEach((r, i) => {
    lines.push(`${i + 1}. *${r.id}* — ${r.text}`);
    lines.push(`   👤 ${r.reporterName} (+${_bare(r.reporter)}) · 📍 ${r.groupName}`);
    lines.push(`   🕒 sent ${stamp(r.at)} · approved by ${r.handledByName || '?'} ${stamp(r.handledAt)}`);
  });
  lines.push(``, `🗑️ */suggestion delete <id>* once it is built`);
  return lines.join('\n');
}
function pendingList(db) { return Object.values(table(db)).filter(r => r.status === STATUS.PENDING).sort((a, b) => a.at - b.at); }

async function notifyReporter(sock, db, rec) { const via = await _deliver(sock, db, rec, reporterFeedback(rec)); return { via }; }

/** Owners' DM targets (phone JIDs, deduped). */
function ownerTargets(db) {
  const targets = []; const seen = new Set();
  for (const j of Perms.getBotOwners(db) || []) {
    if (/@lid$/i.test(String(j))) continue;
    const b = _bare(j); if (!b || seen.has(b)) continue; seen.add(b);
    targets.push(String(j).includes('@') ? j : `${j}@s.whatsapp.net`);
  }
  return targets;
}
async function sendCard(sock, to, rec) {
  const card = ownerCard(rec); let sent = false;
  try { const B = require('../../utils/buttons'); if (B && B.sendButtons) { await B.sendButtons(sock, to, { text: card, buttons: B.quickReplies(ownerButtons(rec)) }); sent = true; } } catch (e) { sent = false; }
  if (!sent) { try { await sock.sendMessage(to, { text: `${card}\n\n${fallbackCommands(rec)}` }); sent = true; } catch (e) {} }
  return sent;
}

module.exports = { STATUS, REPLY_WINDOW_MS, stamp, ownerName, table, create, get, ownerCard, ownerButtons, fallbackCommands, armReply, pendingReply, clearPending, sendReply, reporterFeedback, decide, remove, listText, pendingList, notifyReporter, ownerTargets, sendCard };
