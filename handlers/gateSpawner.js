const { GateManager } = require('../rpg/dungeons/GateManager');

// Map an average player LEVEL to a gate rank letter (the DB's rollGateRank expects
// a rank like 'E', not a number — passing a number made every gate roll as rank F).
function levelToRank(avgLevel) {
  if (avgLevel >= 160) return 'S';
  if (avgLevel >= 120) return 'A';
  if (avgLevel >= 90)  return 'B';
  if (avgLevel >= 60)  return 'C';
  if (avgLevel >= 30)  return 'D';
  if (avgLevel >= 10)  return 'E';
  return 'F';
}

class GateSpawner {
  static activeTimers = {};
  // Spawn-recurrence window (minutes). GateManager didn't expose the constants the
  // original code referenced, so we define them here.
  static SPAWN_MIN_INTERVAL = 20;   // min minutes between gates
  static SPAWN_MAX_INTERVAL = 45;   // max minutes between gates

  // Initialize gate spawning for a chat (idempotent — won't double-schedule).
  static initialize(sock, chatId, getDatabase) {
    if (!sock) return;
    if (this.activeTimers[chatId]) return;
    this.scheduleNextGate(sock, chatId, getDatabase);
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

  static async spawnGate(sock, chatId, getDatabase) {
    const db = getDatabase();
    const players = Object.values(db.users || {}).filter(p => p.lastActive && Date.now() - p.lastActive < 86400000);
    const avgLevel = players.length > 0 ? Math.floor(players.reduce((s,p) => s + (p.level||0), 0) / players.length) : 1;

    // Pass a rank LETTER, not a number — otherwise rollGateRank always clamps to F.
    const gate = GateManager.spawnGate(chatId, levelToRank(avgLevel));
    const announcement = GateManager.formatGate(gate);

    try {
      await sock.sendMessage(chatId, { text: announcement });
      console.log(`[GATE] Spawned ${gate.rank}-rank gate ${gate.id} in ${chatId}`);
    } catch (error) {
      console.error('[GATE] Failed to announce gate:', error);
    }

    // Only schedule the NEXT gate if no timers were re-initialised meanwhile,
    // otherwise /set spawn could stack multiple chains. Guard on the timer being
    // the same one that just fired.
    if (this.activeTimers[chatId]) {
      const fired = this.activeTimers[chatId];
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
