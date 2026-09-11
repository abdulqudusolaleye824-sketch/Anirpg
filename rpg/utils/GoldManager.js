
function updatePlayerNexus(player, amount, saveDatabase) {
  if (!player) {
    console.error('❌ updatePlayerNexus: Invalid player');
    return false;
  }

  // Initialize Nexus
  if (player.gold === undefined) player.gold = 0;
  if (typeof amount !== 'number' || isNaN(amount)) {
    console.error('❌ updatePlayerNexus: amount is not a number:', amount);
    return false;
  }

  // Update Nexus
  player.gold += amount;

  // Prevent negative
  if (player.gold < 0) {
    console.warn(`⚠️ Nexus negative for ${player.name}, setting to 0`);
    player.gold = 0;
  }

  // Prevent overflow (Number.MAX_SAFE_INTEGER is ~9e15)
  if (player.gold > Number.MAX_SAFE_INTEGER) {
    console.warn(`⚠️ Nexus overflow for ${player.name}, capping at MAX_SAFE_INTEGER`);
    player.gold = Number.MAX_SAFE_INTEGER;
  }

  // Sync inventory
  if (!player.inventory) {
    player.inventory = {
      healthPotions: 0,
      manaPotions: 0,
      energyPotions: 0,
      reviveTokens: 0,
      gold: player.gold
    };
  } else {
    player.inventory.gold = player.gold;
  }

  // Daily quest: Nexus earned (any source) — silent track, no sock here
  if (amount > 0) {
    try { require('./DailyQuestSystem').trackQuestProgress(player, 'goldEarn', Math.floor(amount)); } catch(e){}
  }

  // Save
  if (saveDatabase) {
    try {
      saveDatabase();
    } catch (error) {
      console.error('❌ Failed to save database:', error);
      return false;
    }
  }

  return true;
}

module.exports = { updatePlayerNexus };
