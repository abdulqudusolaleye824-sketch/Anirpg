// 10-30 (owner): COMMAND USAGE LOG — the last 50 uses of every command (who, where, exact arguments, when).
// Read with the owner-only /ucmd <command>. Stored in db.cmdLog[cmd] as a ring of 50; group names are cached
// in db.groupNames so the log never needs a metadata call to render.
'use strict';
const MAX = 50;
const bare = j => String(j || '').split(':')[0].split('@')[0];
const _nameCache = new Map();
function groupName(db, chatId, sock) {
  if (!chatId) return '?';
  if (!String(chatId).endsWith('@g.us')) return 'DM';
  const cached = (db && db.groupNames && db.groupNames[chatId]) || _nameCache.get(chatId);
  if (cached) return cached;
  if (sock && typeof sock.groupMetadata === 'function') {
    sock.groupMetadata(chatId).then(m => { if (m && m.subject) { _nameCache.set(chatId, m.subject); try { if (db) { if (!db.groupNames) db.groupNames = {}; db.groupNames[chatId] = m.subject; } } catch (e) {} } }).catch(() => {});
  }
  return String(chatId).split('@')[0];
}
function record(db, { cmd, alias, args, sender, chatId, sock }) {
  if (!db || !cmd) return;
  if (!db.cmdLog || typeof db.cmdLog !== 'object') db.cmdLog = {};
  const key = String(cmd).toLowerCase();
  if (!Array.isArray(db.cmdLog[key])) db.cmdLog[key] = [];
  const u = db.users && (db.users[sender] || Object.values(db.users).find(x => x && x.jid && bare(x.jid) === bare(sender)));
  db.cmdLog[key].push({
    at: Date.now(), jid: sender, name: (u && u.name) || null, chat: chatId, gc: groupName(db, chatId, sock),
    text: '/' + (alias && alias !== key ? alias : key) + ((args && args.length) ? ' ' + args.join(' ') : ''),
  });
  while (db.cmdLog[key].length > MAX) db.cmdLog[key].shift();
}
function ago(ms) { const s = Math.max(0, Math.floor(ms / 1000)); if (s < 60) return s + 's'; const m = Math.floor(s / 60); if (m < 60) return m + 'm'; const h = Math.floor(m / 60); if (h < 24) return h + 'h ' + (m % 60) + 'm'; return Math.floor(h / 24) + 'd ' + (h % 24) + 'h'; }
function render(db, cmd, limit = MAX) {
  const key = String(cmd || '').replace(/^\//, '').toLowerCase();
  const rows = (db && db.cmdLog && db.cmdLog[key]) || [];
  if (!key) return { text: '❌ Usage: /ucmd <command>  — e.g. /ucmd gift', mentions: [] };
  if (!rows.length) return { text: `📭 No recorded uses of */${key}* yet (logging started 1.0.226).`, mentions: [] };
  const now = Date.now(); const list = rows.slice(-limit).reverse();
  const lines = [`📜 *LAST ${list.length} USES OF /${key.toUpperCase()}*`, '━━━━━━━━━━━━━━━━━━━━━━'];
  list.forEach((r, i) => lines.push(`${i + 1}. ${r.name || '@' + bare(r.jid)} (@${bare(r.jid)}) · ${r.gc} · ${ago(now - r.at)} ago\n   ${r.text.length > 120 ? r.text.slice(0, 117) + '…' : r.text}`));
  return { text: lines.join('\n'), mentions: [] };
}
module.exports = { record, render, groupName, MAX };
