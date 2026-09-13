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

module.exports = { joinAllToMain, formatResults };
