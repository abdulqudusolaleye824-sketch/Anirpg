const { GateManager } = require('../rpg/dungeons/GateManager');
const path = require('path');
const fs = require('fs');

function levelToRank(avgLevel) {
  if (avgLevel >= 160) return 'S';
  if (avgLevel >= 120) return 'A';
  if (avgLevel >= 90)  return 'B';
  if (avgLevel >= 60)  return 'C';
  if (avgLevel >= 30)  return 'D';
  if (avgLevel >= 10)  return 'E';
  return 'E';
}

function gateImage(rank) {
  return GateManager.getGateImage(rank);
}

function gateCaption(gate) {
  const id = gate.id;
  const isBoth = gate.currency === 'both' || ['B','A','S'].includes(gate.rank);
  const priceLine = gate.isFree
    ? `「GATE PRICE: FREE」`
    : isBoth
      ? `「GATE PRICE: ${gate.purchasePrice.toLocaleString()} 💠 Nexus + ${gate.manaPrice.toLocaleString()} 💎 Mana Stones」`
      : `「GATE PRICE: ${gate.purchasePrice.toLocaleString()} 💠 Nexus」`;
  const gateIdLine = `「GATE ID: ${id}」`;
  const buyInstruction = `🛒 BUY COMMAND: Reply to this message with /gate buy`;

  if (gate.rank === 'E' || gate.rank === 'D' || gate.rank === 'C') {
    const article = (gate.rank === 'E') ? 'An' : 'A';
    return [
      `╭━━━━━━━「 GATE ALERT 」━━━━━━━╮`,
      `A dimensional rift has appeared.`,
      ``,
      `${article} **${gate.rank}-Rank Gate** has manifested in the area.`,
      ``,
      `Hunters are advised to proceed with caution.`,
      ``,
      `「GATE STATUS: ACTIVE」`,
      `「THREAT LEVEL: ${gate.rank}」`,
      gateIdLine,
      priceLine,
      ``,
      buyInstruction,
      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
    ].join('\n');
  }

  if (gate.rank === 'B') {
    return [
      `╭━━━━━━━「 GATE ALERT 」━━━━━━━╮`,
      `A dimensional rift has appeared.`,
      ``,
      `A **B-Rank Gate** has manifested.`,
      ``,
      `The energy radiating from the Gate is considerably stronger than normal.`,
      ``,
      `Hunters are advised to prepare accordingly.`,
      ``,
      `「GATE STATUS: ACTIVE」`,
      `「THREAT LEVEL: B」`,
      gateIdLine,
      priceLine,
      ``,
      buyInstruction,
      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
    ].join('\n');
  }

  if (gate.rank === 'A') {
    return [
      `╭━━━━━━━「 GATE ALERT 」━━━━━━━╮`,
      `A dimensional rift has appeared.`,
      ``,
      `An **A-Rank Gate** has manifested.`,
      ``,
      `A powerful presence can be detected beyond the rift.`,
      ``,
      `Hunters are advised to exercise extreme caution.`,
      ``,
      `「GATE STATUS: ACTIVE」`,
      `「THREAT LEVEL: A」`,
      gateIdLine,
      priceLine,
      ``,
      buyInstruction,
      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
    ].join('\n');
  }

  const isDisaster = gate.rank === 'DISASTER';
  return [
    `╔════════「 ⚠️ SYSTEM WARNING ⚠️ 」════════╗`,
    ``,
    `**ANOMALY DETECTED.**`,
    ``,
    `A dimensional rift of **extraordinary magnitude** has appeared.`,
    ``,
    `The Gate's energy output is rapidly exceeding measurable limits.`,
    ``,
    `A **${isDisaster ? 'DISASTER-CLASS' : 'S'}-Rank Gate** has manifested.`,
    ``,
    `All nearby hunters are advised to **evacuate immediately.**`,
    ``,
    `「GATE STATUS: ⚠️ CRITICAL」`,
    `「THREAT LEVEL: ${isDisaster ? 'DISASTER' : 'S'}」`,
    `「ANOMALY INDEX: ████████」`,
    gateIdLine,
    priceLine,
    ``,
    buyInstruction,
    ``,
    `**Whatever lies beyond this Gate...**`,
    `**is not something to be taken lightly.**`,
    ``,
    `╚══════════════════════════════════════╝`,
  ].join('\n');
}

const PENALTY_TRIGGER_MS   = 23 * 60 * 60 * 1000;
const PENALTY_DURATION_MS  = 48 * 60 * 60 * 1000;
const GATE_LOCK_MS         = 24 * 60 * 60 * 1000;

// ── Push #68: gate spawn cadence ────────────────────────────────────────────
// Exactly ONE gate per 2-hour WAT window (midnight–2am → 1 gate, 2am–4am →
// 1 gate, ... 22–24 → 1 gate), dropping at a RANDOM moment inside the window.
// WAT = UTC+1 (the game's house timezone).
const WAT_OFFSET_MS = 3600000;
const WINDOW_MS     = 2 * 60 * 60 * 1000;
const MIN_LEAD_MS   = 10 * 60 * 1000; // never schedule a spawn <10min out

class GateSpawner {
  static activeTimers = {};
  // batch-23 (legacy): gates every 30–45 min — superseded by Push #68 windows.
  static SPAWN_MIN_INTERVAL = 30;
  static SPAWN_MAX_INTERVAL = 45;

  static watWindowIndex(now = Date.now()) {
    return Math.floor((now + WAT_OFFSET_MS) / WINDOW_MS);
  }
  static windowRange(idx) {
    const start = idx * WINDOW_MS - WAT_OFFSET_MS;
    return { start, end: start + WINDOW_MS };
  }

  static initialize(sock, chatId, getDatabase, saveDatabase) {
    if (!sock) return;
    if (this.activeTimers[chatId]) return;
    // Batch-50: restart wiped the static maps — heal them first.
    try { GateManager.rehydrateFromDb(getDatabase()); } catch (e) {}
    // Batch-50: resume a persisted countdown instead of rolling fresh.
    try {
      const db = getDatabase();
      const meta = (db.gateSpawnMeta && db.gateSpawnMeta[chatId]) || {};
      if (meta.nextSpawnAt && meta.nextSpawnAt > Date.now()) {
        const wait = meta.nextSpawnAt - Date.now();
        console.log(`[GATE] Resumed spawn countdown for ${chatId}: ${Math.ceil(wait / 60000)} min left`);
        this.activeTimers[chatId] = setTimeout(() => {
          this.spawnGate(sock, chatId, getDatabase, saveDatabase);
        }, wait);
        return;
      }
      if (meta.nextSpawnAt && meta.nextSpawnAt <= Date.now()) {
        console.log(`[GATE] Spawn overdue for ${chatId} — firing in 45s`);
        this.activeTimers[chatId] = setTimeout(() => {
          this.spawnGate(sock, chatId, getDatabase, saveDatabase);
        }, 45000);
        return;
      }
    } catch (e) {}
    this.scheduleNextGate(sock, chatId, getDatabase, saveDatabase);
  }

  static hasUnboughtGate(chatId) {
    const gates = GateManager.gatesByChat?.[chatId] || [];
    for (const gid of gates) {
      const g = GateManager.activeGates?.[gid];
      if (g && g.chatId === chatId && !g.owned && !g.purchased && !g.isFree && !g.cleared && !g.broken && g.active) return g;
    }
    return null;
  }

  static scheduleNextGate(sock, chatId, getDatabase, saveDatabase, _now = Date.now()) {
    const now = _now;
    const db = getDatabase();
    if (!db.gateSpawnMeta) db.gateSpawnMeta = {};
    const meta = db.gateSpawnMeta[chatId] = db.gateSpawnMeta[chatId] || {};

    // Resume a valid persisted countdown (Batch-50): still in the future and
    // inside the CURRENT 2h window.
    const curIdx = this.watWindowIndex(now);
    const cur = this.windowRange(curIdx);
    if (meta.nextSpawnAt && meta.nextSpawnAt > now && meta.nextSpawnAt <= cur.end) {
      const wait = meta.nextSpawnAt - now;
      console.log(`[GATE] Resuming in-window spawn for ${chatId}: ${Math.ceil(wait / 60000)} min left`);
      this.activeTimers[chatId] = setTimeout(() => {
        this.spawnGate(sock, chatId, getDatabase, saveDatabase);
      }, wait);
      return;
    }

    // Push #68: pick ONE random moment — in the current window if ≥10 min of
    // it remain, otherwise in the next window. One spawn per window.
    let targetAt, targetIdx;
    if (cur.end - now > MIN_LEAD_MS) {
      const earliest = now + MIN_LEAD_MS;
      targetAt = earliest + Math.random() * Math.max(0, cur.end - earliest);
      targetIdx = curIdx;
    } else {
      const nxt = this.windowRange(curIdx + 1);
      targetAt = nxt.start + Math.random() * (WINDOW_MS - MIN_LEAD_MS);
      targetIdx = curIdx + 1;
    }
    const wait = Math.max(1000, targetAt - now);

    console.log(`[GATE] Next gate in ${Math.ceil(wait / 60000)} minutes (2h window ${targetIdx}) for ${chatId}`);
    this.activeTimers[chatId] = setTimeout(() => {
      this.spawnGate(sock, chatId, getDatabase, saveDatabase);
    }, wait);
    // Persist the countdown so restarts resume it (Batch-50).
    meta.nextSpawnAt = targetAt;
    meta.spawnWindow = targetIdx;
    try { if (saveDatabase) saveDatabase(); } catch (e) {}
  }

  static checkUnboughtLock(chatId, db) {
    const meta = (db.gateSpawnMeta && db.gateSpawnMeta[chatId]) || {};
    const now = Date.now();
    const unbought = this.hasUnboughtGate(chatId);
    if (!unbought || unbought.isFree) return false;

    const elapsed = now - unbought.spawnTime;
    if (elapsed >= PENALTY_TRIGGER_MS && !meta.penaltyApplied) {
      this.applyXpPenalty(db, meta, unbought);
    }
    if (elapsed < GATE_LOCK_MS) {
      const remaining = GATE_LOCK_MS - elapsed;
      console.log(`[GATE] ${chatId}: unbought gate ${unbought.id} → locked ${Math.ceil(remaining/60000)}min before next spawn`);
      return true;
    }
    unbought.broken = true;
    unbought.active = false;
    return false;
  }

  static async captureParticipants(sock, chatId, db) {
    const jids = new Set();
    try {
      const meta = await sock.groupMetadata(chatId);
      for (const m of meta.members || []) if (m.id) jids.add(m.id.split('@')[0] + '@s.whatsapp.net');
    } catch (e) {}
    if (!jids.size) {
      for (const [jid, p] of Object.entries(db.users || {})) {
        if (p.lastActive && Date.now() - p.lastActive < 86400000) jids.add(jid);
      }
    }
    return [...jids];
  }

  static applyXpPenalty(db, meta, gate) {
    const anchor = gate.spawnTime || Date.now();
    const until = anchor + PENALTY_DURATION_MS;
    const jids = meta.penaltyParticipants || meta.lastParticipants || [];
    let marked = 0;
    for (const jid of jids) {
      const p = db.users?.[jid];
      if (p && !p.gmImmune) {
        p.xpPenaltyAt    = anchor;
        p.xpPenaltyUntil = until;
        marked++;
      }
    }
    meta.penaltyApplied = true;
    console.log(`[GATE] ${gate.chatId}: gate ${gate.id} unbought 23h → −70% XP penalty on ${marked} member(s)`);
  }

  static async spawnGate(sock, chatId, getDatabase, saveDatabase) {
    const db = getDatabase();

    if (this.checkUnboughtLock(chatId, db)) {
      this.activeTimers[chatId] = setTimeout(() => {
        this.scheduleNextGate(sock, chatId, getDatabase, saveDatabase);
      }, Math.max(Math.min(5 * 60 * 1000, GATE_LOCK_MS), 10 * 1000));
      return;
    }

    const players = Object.values(db.users || {}).filter(p => p.lastActive && Date.now() - p.lastActive < 86400000);
    const avgLevel = players.length > 0 ? Math.floor(players.reduce((s,p) => s + (p.level||0), 0) / players.length) : 1;

    const gate = GateManager.spawnGate(chatId, levelToRank(avgLevel));
    // Batch-50: spawned gates lived only in memory — a restart wiped
    // unbought gates. Persist immediately (same bucket raids use).
    try {
      if (!db.activeGates) db.activeGates = {};
      db.activeGates[gate.id] = gate;
      if (saveDatabase) saveDatabase();
    } catch (e) {}

    if (!db.gateSpawnMeta) db.gateSpawnMeta = {};
    const meta = db.gateSpawnMeta[chatId] = db.gateSpawnMeta[chatId] || {};
    if (!gate.isFree) {
      meta.lastBuyableGateId = gate.id;
      meta.lastUnboughtSpawnAt = gate.spawnTime;
      meta.penaltyApplied = false;
    }
    // Push #68: stamp the window this gate occupied (one per window).
    try { meta.lastSpawnWindow = this.watWindowIndex(gate.spawnTime); meta.nextSpawnAt = null; } catch (e) {}
    if (!meta.penaltyParticipants) meta.penaltyParticipants = await this.captureParticipants(sock, chatId, db);

    try {
      const imagePath = gateImage(gate.rank);
      const caption = gateCaption(gate);
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        await sock.sendMessage(chatId, {
          image: imageBuffer,
          mimetype: 'image/jpeg',
          caption: caption
        });
      } else {
        await sock.sendMessage(chatId, { text: caption });
      }
      console.log(`[GATE] Spawned ${gate.rank}-rank gate ${gate.id} in ${chatId} with image`);
    } catch (error) {
      console.error('[GATE] Failed to announce gate with image:', error);
    }

    if (this.activeTimers[chatId]) {
      this.scheduleNextGate(sock, chatId, getDatabase, saveDatabase);
    }
  }

  static stop(chatId) {
    if (this.activeTimers[chatId]) {
      clearTimeout(this.activeTimers[chatId]);
      delete this.activeTimers[chatId];
    }
  }
}

module.exports = GateSpawner;
