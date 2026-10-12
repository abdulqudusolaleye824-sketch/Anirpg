// Push #96h-z25: interactive bug reports.
//   Player: /bug <text>  → owners get a DM card with buttons (Log as verified bug / Dismiss / Ban reporter).
//   First owner to act wins; the other owner is told who is already handling it.
//   Reporter always gets feedback (serf DM, else the GC where the bug was reported) with a WAT timestamp.
//   /bug list (owner-only) → every VERIFIED bug + who reported it, one message.
const Perms = require('../../utils/permissions');

const STATUS = { PENDING: 'pending', LOGGED: 'logged', DISMISSED: 'dismissed', BANNED: 'banned' };

function _bare(j) { return String(j || '').split('@')[0].split(':')[0]; }
function stamp(ts = Date.now()) {
  try {
    const d = new Date(ts);
    const date = d.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time} WAT`;
  } catch (e) { return new Date(ts).toUTCString(); }
}
function table(db) { if (!db.bugReports || typeof db.bugReports !== 'object') db.bugReports = {}; return db.bugReports; }
function nextId(db) {
  const n = (Number(db.bugSeq) || 0) + 1; db.bugSeq = n; return `BUG-${String(n).padStart(3, '0')}`;
}
function ownerName(db, jid) {
  const u = db.users && (db.users[jid] || db.users[`${_bare(jid)}@s.whatsapp.net`]);
  if (u && u.name) return u.name;
  const b = _bare(jid);
  try { const C = require('../../utils/constants'); if (_bare(C.COOWNER_PHONE) === b) return 'Naruto'; if (_bare(C.OWNER_JID) === b) return 'Senku'; } catch (e) {}
  return b;
}

function create(db, { reporter, reporterName, chatId, groupName, text }) {
  const id = nextId(db);
  const rec = { id, reporter, reporterName: reporterName || _bare(reporter), chatId, groupName: groupName || chatId, text: String(text || '').trim(), at: Date.now(), status: STATUS.PENDING, handledBy: null, handledByName: null, handledAt: null };
  table(db)[id] = rec;
  return rec;
}
function get(db, id) { let k = String(id || '').toUpperCase().trim(); if (/^\d+$/.test(k)) k = 'BUG-' + k.padStart(3, '0'); else if (/^BUG-?\d+$/.test(k)) k = 'BUG-' + k.replace(/\D/g, '').padStart(3, '0'); return table(db)[k] || null; }

/** Owner card text (what the DM says above the buttons). */
function ownerCard(rec) {
  return [
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `🐞 *BUG REPORT ${rec.id}*`,
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 Reporter: ${rec.reporterName} (+${_bare(rec.reporter)})`,
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
    ['✅ Log as verified bug', `/bug log ${rec.id}`],
    ['🗑️ Dismiss', `/bug dismiss ${rec.id}`],
    ['🚫 Ban reporter', `/bug ban ${rec.id}`],
  ];
}

/** Feedback the reporter receives. */
function reporterFeedback(rec) {
  const when = stamp(rec.at), now = stamp(rec.handledAt || Date.now());
  if (rec.status === STATUS.LOGGED) return `🐞 *Bug report ${rec.id}*\n\n✅ Your bug report from *${when}* has been seen and is being worked on.\n\n📝 "${rec.text}"\n🕒 Logged: ${now}\n\nThank you for helping make the game better!`;
  if (rec.status === STATUS.DISMISSED) return `🐞 *Bug report ${rec.id}*\n\nPertaining your report on *${when}*: after careful consideration it was discovered that your report isn't actually a bug, or that it wasn't well explained.\n\n📝 "${rec.text}"\n🕒 Reviewed: ${now}\n\nIf you believe it is a bug, report it again with clear steps (what you typed, what happened, what you expected).`;
  if (rec.status === STATUS.BANNED) return `🚫 *Bug report ${rec.id}*\n\nYou are now banned from using bot commands for using the bug command to play.\n\n📝 "${rec.text}"\n🕒 ${now}`;
  return `🐞 *Bug report ${rec.id}* received on ${when}. The developers will look at it.`;
}

/**
 * Owner decision. action ∈ log | dismiss | ban.
 * Returns { ok, rec, text } — text is what to show the acting owner.
 */
function decide(db, id, action, ownerJid) {
  const rec = get(db, id);
  if (!rec) return { ok: false, text: `❌ No bug report *${String(id || '').toUpperCase()}*.` };
  if (!Perms.isBotOwner(db, ownerJid)) return { ok: false, text: '❌ Only bot owners can handle bug reports.' };
  if (rec.status !== STATUS.PENDING) {
    const who = rec.handledByName || ownerName(db, rec.handledBy);
    const self = _bare(rec.handledBy) === _bare(ownerJid);
    return { ok: false, rec, alreadyHandled: true, text: self ? `ℹ️ You already handled *${rec.id}* (${rec.status}, ${stamp(rec.handledAt)}).` : `⚠️ *${rec.id}* is already being handled by *${who}* (${rec.status}, ${stamp(rec.handledAt)}).` };
  }
  const map = { log: STATUS.LOGGED, dismiss: STATUS.DISMISSED, ban: STATUS.BANNED };
  const st = map[String(action || '').toLowerCase()];
  if (!st) return { ok: false, rec, text: '❌ Unknown action. Use log / dismiss / ban.' };
  rec.status = st; rec.handledBy = ownerJid; rec.handledByName = ownerName(db, ownerJid); rec.handledAt = Date.now();
  if (st === STATUS.BANNED) {
    try {
      const Mod = require('./ModerationUtils');
      if (!Mod.isBanned(db, rec.reporter) && !Perms.isBotOwner(db, rec.reporter)) {
        Mod.banUser(db, rec.reporter, ownerJid, `Abusing /bug (${rec.id})`, { gc: rec.chatId, gcName: rec.groupName, bannedAtGMT: new Date().toUTCString() });
      }
    } catch (e) {}
  }
  const label = { logged: '✅ Logged as a verified bug', dismissed: '🗑️ Dismissed', banned: '🚫 Reporter banned from bot commands' }[st];
  return { ok: true, rec, text: `${label} — *${rec.id}* by ${rec.handledByName} · ${stamp(rec.handledAt)}.\nThe reporter has been notified.` };
}

/** /bug delete <id> — owner removes an attended-to bug (any status). Also accepts `all` to clear every verified bug. */
function remove(db, id, ownerJid) {
  if (!Perms.isBotOwner(db, ownerJid)) return { ok: false, text: '❌ Only bot owners can delete bug reports.' };
  const tb = table(db);
  if (String(id || '').toLowerCase() === 'all') {
    const ids = Object.keys(tb).filter(k => tb[k].status === STATUS.LOGGED); for (const k of ids) delete tb[k];
    return { ok: true, text: `🗑️ Deleted ${ids.length} verified bug${ids.length === 1 ? '' : 's'}.` };
  }
  const rec = get(db, id);
  if (!rec) return { ok: false, text: `❌ No bug report *${String(id || '').toUpperCase()}*. Check */bug list*.` };
  delete tb[rec.id];
  return { ok: true, rec, text: `🗑️ *${rec.id}* deleted — "${rec.text.slice(0, 80)}" (reported by ${rec.reporterName}). ${stamp()}` };
}

/** /bug list — verified bugs only, one message. */
function listText(db) {
  const all = Object.values(table(db)).filter(r => r.status === STATUS.LOGGED).sort((a, b) => a.at - b.at);
  if (!all.length) return '🐞 *VERIFIED BUGS*\n\nNo verified bugs logged yet.';
  const lines = [`🐞 *VERIFIED BUGS* (${all.length})`, `━━━━━━━━━━━━━━━━━━━━━━━`];
  all.forEach((r, i) => {
    lines.push(`${i + 1}. *${r.id}* — ${r.text}`);
    lines.push(`   👤 ${r.reporterName} (+${_bare(r.reporter)}) · 📍 ${r.groupName}`);
    lines.push(`   🕒 reported ${stamp(r.at)} · logged by ${r.handledByName || '?'} ${stamp(r.handledAt)}`);
  });
  lines.push(``, `🗑️ */bug delete <id>* once a bug is fixed`);
  return lines.join('\n');
}

/** Deliver feedback: serf DM first, else the GC where it was reported, else direct DM. */
async function notifyReporter(sock, db, rec) {
  const text = reporterFeedback(rec);
  try {
    const SerfDM = require('./SerfDM');
    const r = await SerfDM.sendSerfDM(sock, db, rec.reporter, { text });
    if (r && r.ok) return { via: r.via || 'serf' };
  } catch (e) {}
  if (rec.chatId && String(rec.chatId).endsWith('@g.us')) {
    try { await sock.sendMessage(rec.chatId, { text: `@${_bare(rec.reporter)}\n${text}`, mentions: [rec.reporter] }); return { via: 'group' }; } catch (e) {}
  }
  try { await sock.sendMessage(rec.reporter, { text }); return { via: 'direct' }; } catch (e) {}
  return { via: null };
}

module.exports = { STATUS, stamp, create, get, decide, remove, listText, ownerCard, ownerButtons, reporterFeedback, notifyReporter, ownerName, table };
