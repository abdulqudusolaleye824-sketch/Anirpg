const { GateManager } = require('../rpg/dungeons/GateManager');
const path = require('path');
const fs = require('fs');

// Map an average player LEVEL to a gate rank letter.
function levelToRank(avgLevel) {
  // F-rank gates are removed (Task 9) — the weakest gate is now E-rank.
  if (avgLevel >= 160) return 'S';
  if (avgLevel >= 120) return 'A';
  if (avgLevel >= 90)  return 'B';
  if (avgLevel >= 60)  return 'C';
  if (avgLevel >= 30)  return 'D';
  if (avgLevel >= 10)  return 'E';
  return 'E';
}

// ── Per-rank announcement images (Task 9) ──────────────────────────────
//   S (incl. DISASTER)  → assets/gates/s_rank.jpg
//   A / B               → assets/gates/ab_rank.jpg
//   C / D / E           → assets/gates/cde_rank.jpg
function gateImage(rank) {
  const file = rank === 'S' || rank === 'DISASTER' ? 's_rank.jpg'
             : (rank === 'A' || rank === 'B')      ? 'ab_rank.jpg'
             :                                       'cde_rank.jpg';
  return path.join(__dirname, '..', 'assets', 'gates', file);
}

// ── Per-rank announcement text (Task 9) — user-provided verbatim ────────
function gateCaption(gate) {
  const id = gate.id;
  const priceLine = gate.isFree
    ? `「GATE PRICE: FREE」`
    : `「GATE PRICE: ${gate.purchasePrice.toLocaleString()} 💎」`;
  const gateIdLine = `「GATE ID: ${id}」`;

  // ── C / D / E (green) ────────────────────────────────────────────────
  if (gate.rank === 'E' || gate.rank === 'D' || gate.rank === 'C') {
    const article = (gate.rank === 'E') ? 'An' : 'A'; // "An E-Rank"
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
      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
    ].join('\n');
  }

  // ── B (blue) ─────────────────────────────────────────────────────────
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
      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
    ].join('\n');
  }

  // ── A (purple) ───────────────────────────────────────────────────────
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
      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
    ].join('\n');
  }

  // ── S (and DISASTER) (red warning) ──────────────────────────────────
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
    `**Whatever lies beyond this Gate...**`,
    `**is not something to be taken lightly.**`,
    ``,
    `╚══════════════════════════════════════╝`,
  ].join('\n');
}

// 23 hours / 48 hours / 24 hours constants (Task 9).
const PENALTY_TRIGGER_MS   = 23 * 60 * 60 * 1000; // spawn +23h unbought → penalty
const PENALTY_DURATION_MS  = 48 * 60 * 60 * 1000; // penalty lasts 48h
const GATE_LOCK_MS         = 24 * 60 * 60 * 1000; // unbought gate blocks 24h

class GateSpawner {
  static activeTimers = {};
  static SPAWN_MIN_INTERVAL = 20;
  static SPAWN_MAX_INTERVAL = 45;

  // Idempotent per-chat boot.
  static initialize(sock, chatId, getDatabase) {
    if (!sock) return;
    if (this.activeTimers[chatId]) return;
    this.scheduleNextGate(sock, chatId, getDatabase);
  }

  // True if a buyable (non-free) gate in this chat is currently unpurchased.
  static hasUnboughtGate(chatId) {
    const gates = GateManager.gatesByChat?.[chatId] || [];
    for (const gid of gates) {
      const g = GateManager.activeGates?.[gid];
      if (g && g.chatId === chatId && !g.owned && !g.isFree && !g.cleared && !g.broken) return g;
    }
    return null;
  }

  static scheduleNextGate(sock, chatId, getDatabase) {
    const minInterval = this.SPAWN_MIN_INTERVAL * 60 * 1000;
    const maxInterval = this.SPAWN_MAX_INTERVAL * 60 * 1000;
    const randomInterval = Math.floor(Math.random() * (maxInterval - minInterval) + minInterval);

    console.log(`[GATE] Next gate in ${Math.floor(randomInterval / 1000 / 60)} minutes for ${chatId}`);
    this.activeTimers[chatId] = setTimeout(() => {
      this.spawnGate(sock, chatId, getDatabase);
    }, randomInterval);
  }

  // ── Task 9: 23-hr unbought penalty + 24-hr respawn lock. ──────────────
  // Returns true when a gate is blocked from spawning (a buyable gate sits
  // unpurchased within its 24h window). Runs the −70% penalty at the 23h mark.
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
      // Still inside the 24h window — hold off and re-check in a few minutes.
      const remaining = GATE_LOCK_MS - elapsed;
      console.log(`[GATE] ${chatId}: unbought gate ${unbought.id} → locked ${Math.ceil(remaining/60000)}min before next spawn`);
      return true;
    }
    // Past 24h: the stale gate is retired and a fresh spawn may happen.
    unbought.broken = true;
    return false;
  }

  // Capture the members present in the group at spawn time (for the penalty).
  static async captureParticipants(sock, chatId, db) {
    const jids = new Set();
    try {
      const meta = await sock.groupMetadata(chatId);
      for (const m of meta.members || []) if (m.id) jids.add(m.id.split('@')[0] + '@s.whatsapp.net');
      // some fixtures return plain jids
    } catch (e) { /* ignore — fall back to db */ }
    if (!jids.size) {
      for (const [jid, p] of Object.entries(db.users || {})) {
        if (p.lastActive && Date.now() - p.lastActive < 86400000) jids.add(jid);
      }
    }
    return [...jids];
  }

  // −70% XP for 48h, recorded per user (only those present at spawn).
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

  static async spawnGate(sock, chatId, getDatabase) {
    const db = getDatabase();

    // ── Task 9 lock: a buyable gate that's still unpurchased blocks ────────────
    // other gates in this GC for 24h (and triggers the 23h −70% EXP penalty).
    // We re-check shortly rather than spawning while locked.
    if (this.checkUnboughtLock(chatId, db)) {
      this.activeTimers[chatId] = setTimeout(() => {
        this.scheduleNextGate(sock, chatId, getDatabase);
      }, Math.max(Math.min(5 * 60 * 1000, GATE_LOCK_MS), 10 * 1000));
      return;
    }

    const players = Object.values(db.users || {}).filter(p => p.lastActive && Date.now() - p.lastActive < 86400000);
    const avgLevel = players.length > 0 ? Math.floor(players.reduce((s,p) => s + (p.level||0), 0) / players.length) : 1;

    const gate = GateManager.spawnGate(chatId, levelToRank(avgLevel));

    // Record spawn metadata for the unbought 23h/24h logic (persisted → survives restart).
    if (!db.gateSpawnMeta) db.gateSpawnMeta = {};
    const meta = db.gateSpawnMeta[chatId] = db.gateSpawnMeta[chatId] || {};
    if (!gate.isFree) {
      meta.lastBuyableGateId = gate.id;
      meta.lastUnboughtSpawnAt = gate.spawnTime;
      meta.penaltyApplied = false;
    }
    if (!meta.penaltyParticipants) meta.penaltyParticipants = await this.captureParticipants(sock, chatId, db);
    // Note: `db` is the live database object — the above mutations (gateSpawnMeta,
    // xpPenaltyUntil, etc.) are persisted on the bot's next scheduled DB save.

    // Send the per-rank image + caption.
    try {
      const imagePath = gateImage(gate.rank);
      const caption = gateCaption(gate);
      if (fs.existsSync(imagePath)) {
        await sock.sendMessage(chatId, { image: fs.readFileSync(imagePath), caption });
      } else {
        await sock.sendMessage(chatId, { text: caption });
      }
      console.log(`[GATE] Spawned ${gate.rank}-rank gate ${gate.id} in ${chatId}`);
    } catch (error) {
      console.error('[GATE] Failed to announce gate:', error);
    }

    if (this.activeTimers[chatId]) {
      this.scheduleNextGate(sock, chatId, getDatabase);
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
