'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Push #96h-m — /guild sack <#>
//   A sack is NOT a kick. The Guild Master / Vice targets a member by their
//   serial number on /guild members. The member then has 72 HOURS to prove they
//   are active with `/guild active`. If they do, the sack is cancelled. If they
//   don't, they are removed CLEANLY: pulled from members + memberData, their
//   player.guild cleared, the pending record deleted — no severance, no kick
//   payout, no penalty hooks, no orphaned rows (contract bucket row removed too).
// ═══════════════════════════════════════════════════════════════════════════
const SACK_MS = 72 * 3600e3;

function _key(id) { return String(id || '').split(':')[0]; }
function _num(id) { return _key(id).split('@')[0].replace(/[^0-9]/g, ''); }
function _same(a, b) { return _key(a) === _key(b) || (_num(a) && _num(a) === _num(b)); }

// Same ordering as /guild members (GM first, then total GP, then level) so the
// serial numbers match what the hunter sees.
function roster(guild, db) {
  const byId = new Map();
  const touch = (entry) => {
    const id = (entry && typeof entry === 'object') ? (entry.id || entry.jid) : entry; if (!id) return;
    const key = _key(id); const cur = byId.get(key) || { id, guildRank: null, name: null };
    if (entry && typeof entry === 'object') { if (entry.rank) cur.guildRank = entry.rank; if (entry.name) cur.name = entry.name; }
    byId.set(key, cur);
  };
  (guild.members || []).forEach(touch); (guild.memberData || []).forEach(touch);
  if (guild.leader) { const lk = _key(guild.leader); const rec = byId.get(lk) || { id: guild.leader, guildRank: null, name: null }; rec.guildRank = rec.guildRank || 'Guild Master'; byId.set(lk, rec); }
  const rows = [...byId.values()].map((m) => {
    const u = db.users?.[m.id]; const isLeader = _same(guild.leader, m.id);
    let guildRank = m.guildRank || (isLeader ? 'Guild Master' : 'Member');
    if (!isLeader && (guildRank === 'Guild Master' || guildRank === 'Leader')) guildRank = 'Member';
    if (isLeader) guildRank = 'Guild Master';
    return { id: m.id, guildRank, name: m.name || u?.name || String(m.id).split('@')[0], level: u?.level || 0, tgp: u?.totalGP || 0, isLeader };
  }).sort((a, b) => (b.guildRank === 'Guild Master') - (a.guildRank === 'Guild Master') || (b.tgp - a.tgp) || (b.level - a.level));
  return rows;
}

function pending(guild) { if (!guild.sacks || typeof guild.sacks !== 'object') guild.sacks = {}; return guild.sacks; }
function pendingFor(guild, jid) { const s = pending(guild); const k = Object.keys(s).find(x => _same(x, jid)); return k ? { key: k, ...s[k] } : null; }

function sack(db, guild, byJid, serial) {
  if (!guild) return { ok: false, error: '❌ You are not in a guild!' };
  const rows = roster(guild, db);
  const n = Number(serial);
  if (!n || n < 1 || n > rows.length) return { ok: false, error: `❌ Pick a serial number from */guild members* (1–${rows.length}).\nUsage: */guild sack <#>*` };
  const t = rows[n - 1];
  if (_same(t.id, byJid)) return { ok: false, error: '❌ You cannot sack yourself.' };
  if (t.isLeader) return { ok: false, error: '❌ The Guild Master cannot be sacked.' };
  if (pendingFor(guild, t.id)) return { ok: false, error: `⏳ *${t.name}* already has a pending sack.` };
  const now = Date.now();
  pending(guild)[_key(t.id)] = { id: t.id, name: t.name, by: byJid, at: now, due: now + SACK_MS };
  return { ok: true, target: t, due: now + SACK_MS, text: `🪓 *SACK NOTICE — ${guild.name}*\n👤 #${n} *${t.name}* has been served notice.\n⏳ They have *72 hours* to run */guild active* or they are removed from the guild.`,
    dm: `🪓 *SACK NOTICE from ${guild.name}*\n\nYour Guild Master has served you a sack notice.\nRun */guild active* within *72 hours* to keep your place — otherwise you are removed from the guild automatically.` };
}

function clear(db, guild, jid) {
  if (!guild) return { ok: false, error: '❌ You are not in a guild!' };
  const p = pendingFor(guild, jid);
  if (!p) return { ok: true, none: true, text: `✅ You are active in *${guild.name}* — no sack notice on you.` };
  delete pending(guild)[p.key]; if (!Object.keys(guild.sacks).length) delete guild.sacks;
  return { ok: true, cleared: true, text: `✅ *Activity confirmed!* The sack notice on *${p.name || 'you'}* is cancelled — you stay in *${guild.name}*.` };
}

function cancel(db, guild, serialOrJid) {
  const s = pending(guild); const rows = roster(guild, db); const n = Number(serialOrJid);
  const id = n && rows[n - 1] ? rows[n - 1].id : serialOrJid;
  const p = pendingFor(guild, id); if (!p) return { ok: false, error: '❌ No pending sack for that hunter.' };
  delete s[p.key]; if (!Object.keys(s).length) delete guild.sacks; return { ok: true, text: `↩️ Sack notice on *${p.name}* withdrawn.` };
}

function list(db, guild) {
  const s = pending(guild); const ks = Object.keys(s); if (!ks.length) return `📋 No pending sacks in *${guild.name}*.`;
  const rows = roster(guild, db);
  return [`📋 *PENDING SACKS — ${guild.name}*`, ...ks.map(k => { const p = s[k]; const idx = rows.findIndex(r => _same(r.id, k)); const left = Math.max(0, p.due - Date.now()); return `• #${idx + 1} *${p.name}* — ${Math.ceil(left / 3600e3)}h left`; }), ``, `*/guild sack cancel <#>* to withdraw`].join('\n');
}

// Remove a member cleanly — no payout, no penalty, no orphan rows.
function removeClean(db, guild, jid) {
  const before = (guild.members || []).length;
  guild.members = (guild.members || []).filter(m => !_same(typeof m === 'object' ? (m.id || m.jid) : m, jid));
  if (Array.isArray(guild.memberData)) guild.memberData = guild.memberData.filter(m => !_same(m && (m.id || m.jid), jid));
  const u = db.users?.[jid] || Object.values(db.users || {}).find(x => x && x.jid && _same(x.jid, jid));
  if (u && u.guild && (_same(u.guild, guild.id) || String(u.guild) === String(guild.name) || (typeof u.guild === 'object' && (_same(u.guild.id, guild.id) || u.guild.name === guild.name)))) u.guild = null;
  try { const b = db.guildContracts && db.guildContracts[guild.id]; if (b) for (const k of Object.keys(b)) if (_same(k, jid)) delete b[k]; } catch (e) {}
  try { if (guild.pendingApprovals) for (const k of Object.keys(guild.pendingApprovals)) if (_same(k, jid)) delete guild.pendingApprovals[k]; } catch (e) {}
  return before !== guild.members.length || !!u;
}

// Run the clock. Returns [{ guild, id, name, text, dm }] for every executed sack.
function processDue(db, now = Date.now()) {
  const out = [];
  for (const g of Object.values(db.guilds || {})) {
    if (!g || !g.sacks) continue;
    for (const k of Object.keys(g.sacks)) {
      const p = g.sacks[k]; if (!p || (p.due || 0) > now) continue;
      removeClean(db, g, p.id || k); delete g.sacks[k];
      out.push({ guild: g, id: p.id || k, name: p.name, text: `🪓 *SACK EXECUTED — ${g.name}*\n👤 *${p.name || 'A member'}* did not confirm activity within 72h and has been removed from the guild.`, dm: `🪓 You have been removed from *${g.name}* — the 72-hour sack notice expired without */guild active*.` });
    }
    if (!Object.keys(g.sacks).length) delete g.sacks;
  }
  return out;
}

module.exports = { SACK_MS, roster, sack, clear, cancel, list, pendingFor, removeClean, processDue };
