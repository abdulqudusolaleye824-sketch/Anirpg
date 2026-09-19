// ═══════════════════════════════════════════════════════════════
// /closegate — mods force-close a gate in a dungeon GC
//
// Why it exists: a raid can finish and still leave the gate "open". The boss
// dies in one bot's memory but the persisted snapshot never settles (restart,
// lost reply, race), or the party wipes and the wipe path bails before closing
// it. Either way the GC stays locked, the key stays "in use", and nobody can
// start the next run.
//
// Behaviour (mirrors the raid's own settlement so rewards never fork):
//   • SUCCESS (boss defeated / gate flag cleared) → the full clear settlement
//     runs: loot to the guild treasury or owner, final-blow drops, guild GP,
//     +50% HP recovery for every survivor, and XP / level-up XP / Astra Pass
//     XP / Battle Pass XP for every hunter still standing. Then the gate is
//     closed and the key burned.
//   • NOT SUCCESS (hunters wiped, abandoned, expired mid-floor) → the gate is
//     closed and the key is STILL burned, no loot is paid out, and NO recovery
//     is granted (a failed raid does not heal anybody).
//
// Usage: /closegate  |  /closegate <CODE>  |  /closegate force
// Permission: bot mods and above.
// ═══════════════════════════════════════════════════════════════

'use strict';

const GR = require('../../rpg/dungeons/GateRaid');
const { GateManager, GATE_RANKS } = require('../../rpg/dungeons/GateManager');
const Perms = require('../../utils/permissions');
const UI = require('../../rpg/utils/UI');

function bare(jid) { return String(jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, ''); }

// Find the gate this chat is running, or resolve an explicit code.
function resolveGate(args, chatId, db) {
  const GKM = GR.GKM;
  const explicit = String(args[0] || '').toUpperCase().replace(/^--/, '').trim();
  if (explicit && explicit !== 'FORCE' && explicit.length === 8) {
    const r = GR.resolveCode(explicit, db);
    return r.ok ? { ...r, key: explicit } : { error: r.error };
  }
  const gc = GKM.getDungeonGC(chatId);
  if (gc?.activeKeyId) {
    const r = GR.resolveCode(gc.activeKeyId, db);
    if (r.ok) return { ...r, key: gc.activeKeyId };
    return { error: `❌ Active key \`${gc.activeKeyId}\` is no longer valid: ${r.error}` };
  }
  // Fall back to any gate bound to this chat.
  const ids = GateManager.gatesByChat?.[chatId] || [];
  for (const id of ids) {
    const g = GateManager.activeGates?.[id];
    if (g && !g.cleared && !g.broken) {
      const key = g.raid?.key || Object.keys(db.gateKeys || {}).find(k => db.gateKeys[k]?.gateId === id) || null;
      const keyData = key ? (GKM.getKey(key, db) || db.gateKeys?.[key]) : null;
      return { ok: true, gate: g, key, keyData };
    }
  }
  return { error: '❌ No active gate found in this GC.\nRun /closegate <CODE> with the 8-character gate code.' };
}

function isSuccess(gate) {
  if (gate.cleared) return true;
  if (gate.boss?.defeated) return true;
  if (gate.raid?.status === 'done') return true;
  return false;
}

// Hunters still standing at the end (alive = HP > 0 in the DB or the raid sheet).
function survivorsOf(gate, db) {
  const members = gate.raid?.members?.length ? gate.raid.members : (gate.raiders || []).map(id => ({ id }));
  const out = [];
  for (const m of members) {
    const id = typeof m === 'string' ? m : m?.id;
    if (!id) continue;
    const p = db.users?.[id] || Object.values(db.users || {}).find(u => bare(u?.id) === bare(id));
    const hp = p?.stats?.hp ?? m?.hp ?? 0;
    if (p && hp > 0) out.push(p);
    else if (!p && (m?.hp || 0) > 0) out.push({ id, name: m?.name || bare(id), virtual: true });
  }
  return out;
}

function burnKey(key, keyData, db) {
  if (!keyData) return;
  keyData.raidComplete = true;
  keyData.used = true;
  keyData.expired = true;
  try { if (db.gateKeys?.[key]) { db.gateKeys[key].raidComplete = true; db.gateKeys[key].used = true; } } catch (e) {}
}

module.exports = {
  name: 'closegate',
  aliases: ['forceclosegate', 'cleargate'],
  description: 'Mods: force-close a stuck gate in this dungeon GC (pays loot if the raid actually won)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const FRAME = UI.FREE_BAR;

    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, { text: `❌ *MODS ONLY.*\n${FRAME}\n/closegate is a moderation tool.` }, { quoted: msg });
    }

    const res = resolveGate(args, chatId, db);
    if (res.error) return sock.sendMessage(chatId, { text: res.error }, { quoted: msg });
    const gate = res.gate;
    if (!gate) return sock.sendMessage(chatId, { text: '❌ Gate could not be loaded from that code.' }, { quoted: msg });

    const alreadyDone = gate.raid?.status === 'done' || gate.raid?.status === 'wiped' || gate.raid?.status === 'closed';
    const won = isSuccess(gate);
    const survivors = survivorsOf(gate, db);
    const key = res.key;
    const keyData = res.keyData;

    const lines = [
      FRAME,
      `🚪 *FORCE CLOSE — GATE ${gate.id}`,
      `Rank: ${(GATE_RANKS[gate.rank]?.emoji || '') + ' ' + (gate.rank || '?')}-Rank  ·  Floor ${gate.currentFloor}/${gate.totalFloors}`,
      `Boss: ${gate.boss ? `${gate.boss.name} — ${Math.max(0, gate.boss.hp || 0)}/${gate.boss.maxHp || 0} HP${gate.boss.defeated ? ' ☠️' : ''}` : 'none'}`,
      `Raid status: \`${gate.raid?.status || 'none'}\`${alreadyDone ? ' (already ended)' : ''}`,
      `Standing hunters: ${survivors.length}`,
      FRAME,
    ];

    // ── SUCCESS → run the real settlement (loot + recovery + XP for all) ──
    if (won) {
      let loot = null;
      try {
        // clearGate is idempotent enough for a stuck-but-won raid: it pays the
        // treasury, burns the key, frees the GC and hands every survivor the
        // +50% recovery, guild GP and XP (SilentXP → LevelUpManager → pass XP).
        loot = GR.clearGate(gate, key, keyData, db, saveDatabase);
        lines.push(
          ``,
          `✅ *RAID COUNTED AS CLEARED* — loot distributed.`,
          `💠 ${GR.GKM?.numFmt ? GR.GKM.numFmt(loot.nexus) : (loot.nexus || 0).toLocaleString()} Nexus  ·  💎 ${(loot.crystals || 0).toLocaleString()} Mana Stones`,
          `📦 → ${loot.destinationText || 'party leader'}`,
          `💚 +50% HP recovery for ${loot.recovered ?? survivors.length} hunter(s)`,
          `✨ XP · level-up XP · Astra Pass XP · Battle Pass XP awarded to everyone standing.`,
          loot.wildPet ? `🐾 Wild pet spawned: ${loot.wildPet.name} — */catch*` : '',
        );
      } catch (e) {
        console.error('[closegate] clear settlement failed:', e.message);
        lines.push(``, `⚠️ Settlement hit an error (${e.message}) — the gate is being closed anyway. Run /dbstatus and check the raid logs.`);
      }
    } else {
      // ── FAILURE → close it, burn the key, pay nothing, heal nothing ──
      try { GR.wipeGate(gate, key, keyData, chatId, db); } catch (e) { console.error('[closegate] wipe error:', e.message); }
      burnKey(key, keyData, db);
      try { GateManager.clearGate(gate.id, db); } catch (e) {}
      try { if (db?.activeGates) delete db.activeGates[gate.id]; } catch (e) {}
      lines.push(
        ``,
        `❌ *RAID NOT SUCCESSFUL* — no loot paid out.`,
        `🚫 No recovery granted (a failed raid does not heal anybody).`,
        `🔑 Gate key burned anyway, and this GC is free for the next run.`,
      );
    }

    // Belt and braces: whatever path ran, make sure the gate cannot linger.
    try {
      if (gate.raid && !['done', 'wiped'].includes(gate.raid.status)) gate.raid.status = won ? 'done' : 'closed';
      if (keyData && won) burnKey(key, keyData, db);
      const gc = GR.GKM.getDungeonGC(chatId) || (keyData?.dungeonChatId ? GR.GKM.getDungeonGC(keyData.dungeonChatId) : null);
      if (gc && gc.activeKeyId === key) { gc.activeKeyId = null; try { GR.GKM.saveGCsToDb(db); } catch (e) {} }
      try { delete GR.GKM._combatLocks?.[gate.id]; } catch (e) {}
      try { GR.releaseCombatLock(gate.id); } catch (e) {}
    } catch (e) { console.error('[closegate] cleanup:', e.message); }

    saveDatabase();
    lines.push(FRAME, `🛡️ Closed by ${db.users?.[sender]?.name || bare(sender)}.`);
    return sock.sendMessage(chatId, { text: lines.filter(l => l !== '').join('\n') }, { quoted: msg });
  },
};
