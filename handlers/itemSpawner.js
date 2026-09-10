'use strict';

const SPAWN_ITEMS = [
  { name: 'Mending Stone', rarity: 'epic', description: 'Restores all equipped gear durability to 100%' },
  { name: 'Titan Alloy', rarity: 'epic', description: 'Indestructible alloy forged by ancient dwarven smiths' },
  { name: 'Void Shard', rarity: 'epic', description: 'Crystallized void energy with immense mana potential' },
  { name: 'Dragon Scale', rarity: 'rare', description: 'Toughened dragon scale used for high-tier crafting' },
  { name: 'Phoenix Feather', rarity: 'rare', description: 'Glowing feather infused with eternal flame' },
  { name: 'Prismatic Shard', rarity: 'rare', description: 'Refracting mana stone that shines in seven colors' },
  { name: 'Silver Ore', rarity: 'uncommon', description: 'Refined crafting ore for sturdy equipment' },
  { name: 'Shadow Essence', rarity: 'uncommon', description: 'Concentrated shadow energy harvested from rifts' },
  { name: 'Hardened Steel', rarity: 'uncommon', description: 'Forged high-density steel ingot' },
  { name: 'Iron Ore', rarity: 'common', description: 'Standard metal ore used for forging weapons' },
  { name: 'Cobblestone Core', rarity: 'common', description: 'Dense mineral chunk found in ancient stone' },
];

const RARITY_EMOJI = {
  common: '⚪',
  uncommon: '🟢',
  rare: '🔵',
  epic: '🟣'
};

class DailyItemSpawner {
  static startScheduler(multiSocketManager, getDatabase, saveDatabase) {
    // Check every 15 minutes for 24-hour interval
    setInterval(() => {
      DailyItemSpawner.checkAndSpawn(multiSocketManager, getDatabase, saveDatabase);
    }, 15 * 60 * 1000);

    // Initial check after 30 seconds
    setTimeout(() => {
      DailyItemSpawner.checkAndSpawn(multiSocketManager, getDatabase, saveDatabase);
    }, 30 * 1000);
  }

  static async checkAndSpawn(multiSocketManager, getDatabase, saveDatabase) {
    const db = getDatabase();
    if (!db.dailyGlobalSpawn) {
      db.dailyGlobalSpawn = { lastSpawnTime: 0, activeSpawn: null };
    }

    const now = Date.now();
    const intervalMs = 24 * 60 * 60 * 1000; // 24 hours

    if (now - (db.dailyGlobalSpawn.lastSpawnTime || 0) < intervalMs) {
      return;
    }

    // Get candidate group chats where /set spawn --true
    const candidateChats = Object.keys(db.gateSpawns || {}).filter(cid => db.gateSpawns[cid] === true);
    if (candidateChats.length === 0) {
      return;
    }

    // Select random group chat
    const targetChatId = candidateChats[Math.floor(Math.random() * candidateChats.length)];

    // Pick random item (weighted rarity)
    const rand = Math.random() * 100;
    let pool;
    if (rand < 40) pool = SPAWN_ITEMS.filter(i => i.rarity === 'common');
    else if (rand < 70) pool = SPAWN_ITEMS.filter(i => i.rarity === 'uncommon');
    else if (rand < 90) pool = SPAWN_ITEMS.filter(i => i.rarity === 'rare');
    else pool = SPAWN_ITEMS.filter(i => i.rarity === 'epic');

    const item = pool[Math.floor(Math.random() * pool.length)];

    db.dailyGlobalSpawn.lastSpawnTime = now;
    db.dailyGlobalSpawn.activeSpawn = {
      chatId: targetChatId,
      item,
      spawnTime: now,
      claimed: false,
      claimedBy: null
    };
    saveDatabase();

    // Get active socket
    let sock = null;
    if (multiSocketManager) {
      const targetBotKey = db.botActive?.[targetChatId];
      if (targetBotKey) {
        sock = multiSocketManager.getSocket(targetBotKey);
      }
      if (!sock) {
        const firstKey = multiSocketManager.getFirstOnlineSocketKey();
        if (firstKey) sock = multiSocketManager.getSocket(firstKey);
      }
    }

    if (sock && sock.ws && sock.ws.readyState === 1) {
      try {
        const emoji = RARITY_EMOJI[item.rarity] || '📦';
        const msg = [
          `╭━━━━━━━「 📦 DAILY SYSTEM ITEM DROP 」━━━━━━━╮`,
          `A rare supply drop has materialized in this realm!`,
          ``,
          `📦 Item: **${item.name}** (${emoji} ${item.rarity.toUpperCase()})`,
          `📖 Description: _${item.description}_`,
          ``,
          `🛒 CLAIM COMMAND: Type /claim or reply to this message with /claim!`,
          `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`
        ].join('\n');

        await sock.sendMessage(targetChatId, { text: msg });
        console.log(`[ITEM SPAWN] Daily global item spawned in ${targetChatId}: ${item.name}`);
      } catch (err) {
        console.error('[ITEM SPAWN] Failed to send daily item drop:', err?.message || err);
      }
    }
  }

  static claimItem(chatId, sender, db, saveDatabase) {
    const activeSpawn = db.dailyGlobalSpawn?.activeSpawn;
    if (!activeSpawn || activeSpawn.chatId !== chatId || activeSpawn.claimed) {
      return null;
    }

    activeSpawn.claimed = true;
    activeSpawn.claimedBy = sender;

    const item = activeSpawn.item;
    const player = db.users[sender];
    if (!player) return null;

    if (!player.inventory) {
      player.inventory = { gold: 0, items: [], materials: [] };
    }
    if (!Array.isArray(player.inventory.items)) player.inventory.items = [];
    if (!Array.isArray(player.inventory.materials)) player.inventory.materials = [];

    player.inventory.items.push({
      name: item.name,
      rarity: item.rarity,
      description: item.description,
      obtainedAt: Date.now(),
      type: item.name === 'Mending Stone' ? 'consumable' : 'material'
    });

    if (item.name === 'Mending Stone') {
      player.inventory.mendingStones = (player.inventory.mendingStones || 0) + 1;
    } else {
      player.inventory.materials.push({
        name: item.name,
        rarity: item.rarity,
        description: item.description,
        obtainedAt: Date.now()
      });
    }

    saveDatabase();
    return item;
  }
}

module.exports = DailyItemSpawner;
