// Push #96h-z29: shared logic for /closeall, /openall and the /open lock.
'use strict';
function bare(j) { return String(j || '').split('@')[0].split(':')[0]; }
function stamp() { try { return new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WAT'; } catch (e) { return new Date().toUTCString(); } }

/** All groups across every live bot socket → Map(chatId → { subject, socks: [sock…] }) */
async function allGroups(socketsOverride) {
  const out = new Map();
  let sockets = socketsOverride; if (!sockets) { try { sockets = require('../../bots/MultiSocketManager').getAllSockets() || {}; } catch (e) { sockets = {}; } }
  for (const s of Object.values(sockets)) {
    if (!s || !s.user || typeof s.groupFetchAllParticipating !== 'function') continue;
    let all = {}; try { all = await s.groupFetchAllParticipating(); } catch (e) { continue; }
    for (const [id, meta] of Object.entries(all || {})) { const rec = out.get(id) || { subject: (meta && meta.subject) || id, socks: [] }; rec.socks.push(s); out.set(id, rec); }
  }
  return out;
}

async function setAll(mode, by, db, saveDatabase, notice, socketsOverride) {
  const groups = await allGroups(socketsOverride);
  if (!db.lockedGroups) db.lockedGroups = {};
  const done = [], failed = [];
  for (const [id, g] of groups) {
    let ok = false;
    for (const s of g.socks) {
      try { await s.groupSettingUpdate(id, mode === 'close' ? 'announcement' : 'not_announcement'); ok = true; try { await s.sendMessage(id, { text: notice, mentions: [by] }); } catch (e) {} break; } catch (e) {}
    }
    if (ok) { done.push(g.subject); if (mode === 'close') db.lockedGroups[id] = { by, at: Date.now() }; else delete db.lockedGroups[id]; }
    else failed.push(g.subject);
  }
  try { saveDatabase(); } catch (e) {}
  return { done, failed, total: groups.size };
}

function isLocked(db, chatId) { return !!(db && db.lockedGroups && db.lockedGroups[chatId]); }

module.exports = { allGroups, setAll, isLocked, bare, stamp };
