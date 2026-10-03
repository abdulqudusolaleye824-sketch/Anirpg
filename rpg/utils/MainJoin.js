// ═══════════════════════════════════════════════════════════════
// MainJoin — every online bot joins --main community groups.
// Push #25: called automatically after /setgroup <type> --main, and
// on demand via /joinmains (retroactive + drift repair).
// ═══════════════════════════════════════════════════════════════
'use strict';

const MSM = require('../../bots/MultiSocketManager');
const PM = require('../../bots/PersonalityManager');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function _codeFromLink(link) {
  if (!link || typeof link !== 'string') return null;
  const m = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

function _alreadyInMsg(err) {
  const t = String((err && err.message) || err || '').toLowerCase();
  return /already|409|410|participant|not authorized|forbidden/.test(t);
}

// Join every online bot to groupId. Returns per-bot results for reporting.
// opts.sock = a socket already in the group (used for fresh invite-code fallback).
async function joinAllToMain(db, groupId, inviteLink, opts = {}) {
  const results = [];
  let code = _codeFromLink(inviteLink);
  // Fresh-code fallback when the stored link is missing/stale.
  if (!code && opts.sock && typeof opts.sock.groupInviteCode === 'function') {
    try {
      const fresh = await opts.sock.groupInviteCode(groupId);
      if (fresh) code = String(fresh).split('/').pop();
    } catch {}
  }
  let keys = [];
  try {
    keys = PM.getAllPersonalities ? PM.getAllPersonalities() : Object.keys(MSM.getAllSockets());
  } catch { try { keys = Object.keys(MSM.getAllSockets()); } catch {} }
  let sockets = {};
  try { sockets = MSM.getAllSockets() || {}; } catch {}
  for (const key of keys) {
    const name = (PM.getDisplayName ? PM.getDisplayName(key) : key) || key;
    const sock = sockets[key];
    if (!sock || !sock.user?.id) {
      results.push({ key, name, status: 'offline', detail: 'bot offline' });
      continue;
    }
    // Already a member? groupMetadata throws for non-members.
    try {
      await sock.groupMetadata(groupId);
      results.push({ key, name, status: 'already', detail: 'already a member' });
      continue;
    } catch {}
    if (!code) {
      results.push({ key, name, status: 'failed', detail: 'no invite link available' });
      continue;
    }
    try {
      await sock.groupAcceptInvite(code);
      results.push({ key, name, status: 'joined', detail: 'joined now' });
    } catch (e) {
      if (_alreadyInMsg(e)) results.push({ key, name, status: 'already', detail: 'already a member' });
      else results.push({ key, name, status: 'failed', detail: String((e && e.message) || e).slice(0, 120) });
    }
    await sleep(800); // stagger joins — don't burst the group
  }
  return results;
}

function formatResults(results) {
  const emoji = { joined: '✅', already: 'ℹ️', failed: '❌', offline: '💤' };
  return (results || []).map((r) => `${emoji[r.status] || '•'} *${r.name}*: ${r.detail}`).join('\n');
}

// Push #96h-z9: ONE bot (just connected) joins EVERY --main group it is not yet in.
// Invite code: the stored link, else a fresh code fetched through any other connected bot
// that is already a member (and the fresh link is persisted for next time).
async function joinOneToMains(db, sock, key) {
  const out = [];
  let mains = [];
  try { mains = (require('./AstralGroups').getAll(db) || []).filter((g) => g && g.isMain && g.groupId); } catch {}
  if (!mains.length || !sock || !sock.user?.id) return out;
  let sockets = {}; try { sockets = MSM.getAllSockets() || {}; } catch {}
  for (const g of mains) {
    const label = g.groupName || g.type || String(g.groupId).slice(-12);
    try { await sock.groupMetadata(g.groupId); out.push({ group: label, status: 'already' }); continue; } catch {}
    let code = _codeFromLink(g.inviteLink);
    if (!code) {
      for (const [k2, s2] of Object.entries(sockets)) {
        if (k2 === key || !s2 || !s2.user?.id || typeof s2.groupInviteCode !== 'function') continue;
        try { const fresh = await s2.groupInviteCode(g.groupId); if (fresh) { code = String(fresh).split('/').pop(); if (db.astralGroups && db.astralGroups[g.groupId]) db.astralGroups[g.groupId].inviteLink = `https://chat.whatsapp.com/${code}`; break; } } catch {}
      }
    }
    if (!code) { out.push({ group: label, status: 'failed', detail: 'no invite link' }); continue; }
    try { await sock.groupAcceptInvite(code); out.push({ group: label, status: 'joined' }); }
    catch (e) { out.push({ group: label, status: _alreadyInMsg(e) ? 'already' : 'failed', detail: String((e && e.message) || e).slice(0, 100) }); }
    await sleep(1200);
  }
  return out;
}

// Push #96h-z9: every connected bot → every --main group (used by /joinmain from any bot's DM).
async function joinAllToAllMains(db, opts = {}) {
  const results = [];
  let mains = [];
  try { mains = (require('./AstralGroups').getAll(db) || []).filter((g) => g && g.isMain && g.groupId); } catch {}
  for (const g of mains) {
    const r = await joinAllToMain(db, g.groupId, g.inviteLink || null, opts);
    results.push({ group: g.groupName || g.type || String(g.groupId).slice(-12), results: r });
  }
  return results;
}

module.exports = { joinAllToMain, joinOneToMains, joinAllToAllMains, formatResults };
