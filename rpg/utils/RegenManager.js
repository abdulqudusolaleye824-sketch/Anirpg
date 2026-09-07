class RegenManager {
  constructor() {
    this.activeRegens = new Map();
    this.getDatabase = null;
    this.saveDatabase = null;
  }

  startRegen(playerId) {
    // Regeneration disabled
  }

  stopRegen(playerId) {
    // Regeneration disabled
  }

  initAllPlayers(getDatabase, saveDatabase, sock) {
    this.getDatabase = getDatabase;
    this.saveDatabase = saveDatabase;
    console.log('🔄 Regeneration is disabled');
  }

  registerPlayer(playerId) {
    // Regeneration disabled
  }

  stopAll() {
    this.activeRegens.clear();
  }
}

module.exports = new RegenManager();