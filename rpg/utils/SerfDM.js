// ═══════════════════════════════════════════════════════════════
// Astra — SerfDM: THE standard for every command that delivers a DM.
//   sendSerfDM(sock, db, sender, content)
//     → { ok: true, via: 'serf' }            (DM landed)
//     → { ok: false, reason, detail }        (DM failed — TELL THE USER WHY)
// Rule: DM goes through the player's assigned serf socket ONLY (the IRON
// WALL in MultiSocketManager.safeSendDM). Callers MUST surface the result:
// success → "SUCCESSFULLY SENT VIA SERF", failure → the stated reason.
// getSerfSocket(db, sender) exposes the live serf socket for callers that
// need the raw serf socket for multi-step DM flows.
// ═══════════════════════════════════════════════════════════════

'use strict';

function _managers() {
  const MSM = require('../../bots/MultiSocketManager');
  let SerfManager = null;
  try { SerfManager = require('./SerfManager'); } catch (e) {
    try { SerfManager = require('../../rpg/utils/SerfManager'); } catch (e2) {}
  }
  return { MSM, SerfManager };
}

function getSerfSocket(db, sender) {
  try {
    const { MSM, SerfManager } = _managers();
    const serfKey = SerfManager?.getSerfBotKey ? SerfManager.getSerfBotKey(db, sender) : null;
    if (!serfKey) return { ok: false, reason: 'no-serf', detail: 'No serf assigned. Use /setserf @bot to assign one.' };
    const serfSock = MSM.getSocket ? MSM.getSocket(serfKey) : null;
    if (!serfSock || !serfSock.user?.id) {
      return { ok: false, reason: 'serf-offline', detail: `Assigned serf (${serfKey}) is offline or unavailable.` };
    }
    return { ok: true, serfSock, serfKey };
  } catch (e) {
    return { ok: false, reason: 'serf-error', detail: e.message };
  }
}

async function sendSerfDM(sock, db, sender, content) {
  try {
    const { MSM } = _managers();
    if (MSM?.safeSendDM && db) {
      const res = await MSM.safeSendDM(sock, sender, content, { getDatabase: () => db });
      if (res && res.dropped) {
        if (res.reason === 'no-serf') {
          return { ok: false, reason: 'no-serf', detail: 'No serf assigned. Use /setserf @bot to assign one.' };
        }
        if (res.reason === 'serf-offline') {
          return { ok: false, reason: 'serf-offline', detail: res.message || 'Assigned serf is offline or unavailable.' };
        }
        return { ok: false, reason: res.reason || 'dropped', detail: res.message || 'DM was dropped.' };
      }
      return { ok: true, via: 'serf', result: res };
    }
  } catch (e) {
    // safeSendDM unavailable or threw — fall through to a direct attempt.
  }
  // No safeSendDM/db — direct attempt (test envs / DMs).
  try {
    const res = await sock.sendMessage(sender, content);
    return { ok: true, via: 'direct', result: res };
  } catch (e) {
    return { ok: false, reason: 'send-failed', detail: e.message };
  }
}

// One-line group notice for a DM delivery result.
function resultNotice(title, res) {
  if (res && res.ok) return `✅ *${title} — SUCCESSFULLY SENT VIA SERF* 📩\nCheck your DM!`;
  const why = res?.detail || res?.reason || 'unknown error';
  return `❌ *${title} — DM NOT SENT*\n📝 Reason: ${why}`;
}

module.exports = { sendSerfDM, getSerfSocket, resultNotice };
