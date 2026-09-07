// SeasonManager.js — Monthly rotating event system
// Events apply passive bonuses automatically to all gameplay
// Admin can force-start events with /event start [id]

const SEASONS = {
  blood_moon: {
    id: 'blood_moon',
    name: '🩸 Blood Moon',
    emoji: '🌑',
    description: 'The moon runs red. Monsters grow stronger — but fall with richer rewards.',
    theme: 'danger',
    duration: 7, // days
    bonuses: {
      monsterHpMult:  1.4,   // monsters 40% more HP
      monsterAtkMult: 1.25,  // monsters 25% more ATK
      goldMult:       2.0,   // 2× gold from all sources
      xpMult:         1.5,   // 50% more XP
      dropRateBoost:  0.15,  // +15% artifact/loot drop chance
    },
    pvpBonus: { eloMult: 1.5, msg: '🩸 Blood Moon ELO: ×1.5 gains!' },
    spawnMsg: '🌑 *THE BLOOD MOON RISES!*\n\nMonsters grow stronger and more ferocious...\nbut their rewards are legendary.\n\n💠 Nexus: ×2 | ✨ XP: ×1.5\n☠️ Monsters: +40% HP, +25% ATK\n🎁 Drop rates boosted!\n\n⏰ Lasts 7 days. Hunt while you can.',
    color: '#8B0000',
    exclusiveDrops: ['Blood Moon Shard', 'Crimson Artifact Fragment', 'Moon Essence'],
  },

  golden_age: {
    id: 'golden_age',
    name: '✨ Nexusen Age',
    emoji: '🌟',
    description: 'Fortune smiles on all hunters. Nexus flows freely.',
    theme: 'wealth',
    duration: 5,
    bonuses: {
      goldMult:      3.0,   // 3× gold from everything
      shopDiscount:  0.30,  // 30% off all shop prices
      bankInterest:  0.05,  // +5% bank interest per day
      casinoLuckBoost: 0.10, // +10% casino win rate
    },
    spawnMsg: '✨ *GOLDEN AGE BEGINS!*\n\nFortune blesses all hunters this week!\n\n💠 Nexus: ×3 from ALL sources\n🛒 Shop: 30% discount\n🏦 Bank interest boosted\n🎰 Casino luck +10%\n\n⏰ Lasts 5 days. Get rich.',
    color: '#FFD700',
    exclusiveDrops: ['Nexus Ingot', 'Fortune Mana Stone', 'Midas Touch Rune'],
  },

  void_rift: {
    id: 'void_rift',
    name: '🌀 Void Rift',
    emoji: '🕳️',
    description: 'Reality fractures. Strange enemies pour through the cracks. PvP is chaos.',
    theme: 'chaos',
    duration: 6,
    bonuses: {
      xpMult:         2.0,   // 2× XP
      pvpEloMult:     2.0,   // 2× PvP ELO gains
      dungeonLootMult:1.5,   // 50% more dungeon loot
      monsterAtkMult: 1.15,  // slightly stronger monsters
    },
    pvpBonus: { eloMult: 2.0, msg: '🌀 Void Rift: ELO gains DOUBLED!' },
    spawnMsg: '🌀 *VOID RIFT DETECTED!*\n\nReality is tearing apart. Strange power floods in.\n\n✨ XP: ×2 from all sources\n⚔️ PvP ELO: ×2 gains\n🏰 Dungeon loot: ×1.5\n☠️ Monsters slightly empowered\n\n⏰ Lasts 6 days. The rift is unstable.',
    color: '#6C3483',
    exclusiveDrops: ['Void Mana Stone', 'Rift Fragment', 'Chaos Shard'],
  },

  hunters_festival: {
    id: 'hunters_festival',
    name: '🎉 Hunter\'s Festival',
    emoji: '🎊',
    description: 'The annual festival of hunters. Every action earns double rewards.',
    theme: 'celebration',
    duration: 3,
    bonuses: {
      xpMult:         2.0,
      goldMult:       2.0,
      pvpEloMult:     1.5,
      dungeonLootMult:2.0,
      dailyBonusMult: 3.0,  // 3× daily rewards
    },
    pvpBonus: { eloMult: 1.5, msg: '🎉 Festival Bonus: +50% ELO!' },
    spawnMsg: "🎉 *HUNTER'S FESTIVAL!*\n\nThe annual celebration of all hunters begins!\n\n✨ XP: ×2 | 💠 Nexus: ×2\n🏰 Dungeon loot: ×2\n📅 Daily rewards: ×3\n⚔️ PvP ELO: ×1.5\n\n⏰ Lasts 3 days. CELEBRATE!",
    color: '#E74C3C',
    exclusiveDrops: ['Festival Token', 'Party Bomb', 'Celebration Artifact'],
  },

  frozen_depths: {
    id: 'frozen_depths',
    name: '❄️ Frozen Depths',
    emoji: '🧊',
    description: 'An eternal winter descends. Ice-type enemies invade. Stay frosty.',
    theme: 'winter',
    duration: 7,
    bonuses: {
      freezeChanceBoost: 0.20, // +20% freeze chance on all attacks
      xpMult:            1.3,
      goldMult:          1.5,
      iceEnemyDropBoost: 0.25,
    },
    spawnMsg: '❄️ *FROZEN DEPTHS EVENT!*\n\nEternal winter grips the realm. Ice-type enemies invade from the north.\n\n✨ XP: ×1.3 | 💠 Nexus: ×1.5\n❄️ Freeze chance: +20% on all attacks\n🎁 Ice enemies drop rare loot\n\n⏰ Lasts 7 days.',
    color: '#AED6F1',
    exclusiveDrops: ['Frost Mana Stone', 'Ice Dragon Scale', 'Blizzard Core'],
  },

  shadow_invasion: {
    id: 'shadow_invasion',
    name: '🌑 Shadow Invasion',
    emoji: '👤',
    description: 'Shadow creatures pour into the world. Dungeon bosses are empowered. Danger is everywhere.',
    theme: 'invasion',
    duration: 5,
    bonuses: {
      bossDifficultyMult: 1.5, // bosses 50% harder
      bossRewardMult:     3.0, // bosses drop 3× rewards
      shadowDropBoost:    0.30,
      xpMult:             1.8,
    },
    spawnMsg: '🌑 *SHADOW INVASION!*\n\nDarkness floods the dungeons. Bosses grow monstrous...\nbut their hoards are legendary.\n\n✨ XP: ×1.8\n👹 Boss difficulty: ×1.5\n🏆 Boss rewards: ×3\n🎁 Shadow drop rate: +30%\n\n⏰ Lasts 5 days. Face the darkness.',
    color: '#2C3E50',
    exclusiveDrops: ['Shadow Essence', 'Dark Lord Fragment', 'Void Heart'],
  },

  dragon_ascension: {
    id: 'dragon_ascension',
    name: '🐉 Dragon Ascension',
    emoji: '🐲',
    description: 'Ancient dragons return. Dragon-type skills are massively amplified.',
    theme: 'dragon',
    duration: 5,
    bonuses: {
      dragonClassBoost:  0.30, // DragonKnight gets +30% all stats
      xpMult:            1.6,
      goldMult:          1.8,
      dragonDropBoost:   0.25,
    },
    spawnMsg: '🐉 *DRAGON ASCENSION!*\n\nAncient dragons soar again. DragonKnights feel the call of their ancestors.\n\n✨ XP: ×1.6 | 💠 Nexus: ×1.8\n🐉 DragonKnight: +30% all stats\n🎁 Dragon enemy drops boosted\n\n⏰ Lasts 5 days.',
    color: '#E74C3C',
    exclusiveDrops: ['Dragon Heart', 'Ancient Scale', 'Draco Fragment'],
  },

  celestial_alignment: {
    id: 'celestial_alignment',
    name: '⭐ Celestial Alignment',
    emoji: '✨',
    description: 'The stars align once in a century. All stats surge. Legendary drops everywhere.',
    theme: 'legendary',
    duration: 2, // rare and short
    bonuses: {
      xpMult:           3.0,
      goldMult:         3.0,
      allStatBoost:     0.20, // +20% all stats for all players
      legendaryDropBoost: 0.50, // +50% legendary drop rate
      pvpEloMult:       2.0,
    },
    pvpBonus: { eloMult: 2.0, msg: '⭐ Celestial Alignment: ELO ×2!' },
    spawnMsg: '⭐ *CELESTIAL ALIGNMENT!*\n\nThe stars converge once a century. Power surges through every hunter.\n\n✨ XP: ×3 | 💠 Nexus: ×3\n⚔️ All stats: +20%\n🌟 Legendary drops: +50%\n⚔️ PvP ELO: ×2\n\n⏰ Lasts only 2 days. THIS IS RARE.',
    color: '#F1C40F',
    exclusiveDrops: ['Star Fragment', 'Celestial Core', 'Cosmic Artifact'],
  },

  return_of_heroes: {
    id: 'return_of_heroes',
    name: '🏆 Return of Heroes',
    emoji: '🔰',
    description: 'The legends return. Massive catch-up bonuses for all players. A second chance at greatness.',
    theme: 'comeback',
    duration: 7,
    bonuses: {
      xpMult:           3.0,   // 3× XP — catch up fast
      goldMult:         3.0,   // 3× gold
      dailyBonusMult:   5.0,   // 5× daily rewards
      dropRateBoost:    0.40,  // +40% drop rate
      shopDiscount:     0.50,  // 50% off shop
      pvpEloMult:       1.5,
    },
    pvpBonus: { eloMult: 1.5, msg: '🏆 Return of Heroes: +50% ELO gains!' },
    spawnMsg: '🏆 *RETURN OF HEROES!*\n\nThe realm calls its warriors back.\nEvery hunter gets a second chance at greatness.\n\n✨ XP: ×3 | 💠 Nexus: ×3\n📅 Daily rewards: ×5\n🛒 Shop: 50% OFF everything\n🎁 Drop rates: +40%\n⚔️ PvP ELO: ×1.5\n\n💬 _"The strong return stronger. The fallen rise again."_\n\n⏰ Lasts 7 days. Welcome back, heroes.',
    color: '#2ECC71',
    exclusiveDrops: ['Hero\'s Crest', 'Return Medal', 'Champion\'s Seal'],
  },
};

// Monthly schedule — which event runs each month
// Month is 1-indexed (1 = January)
const MONTHLY_SCHEDULE = {
  1:  'frozen_depths',       // January
  2:  'hunters_festival',    // February
  3:  'golden_age',          // March
  4:  'void_rift',           // April
  5:  'dragon_ascension',    // May
  6:  'celestial_alignment', // June
  7:  'blood_moon',          // July
  8:  'shadow_invasion',     // August
  9:  'golden_age',          // September
  10: 'void_rift',           // October
  11: 'hunters_festival',    // November
  12: 'blood_moon',          // December (Christmas blood moon lol)
};

// In-memory active event state
let activeEvent = null;
let eventEndTimer = null;

class SeasonManager {

  static getActiveEvent() { return activeEvent; }
  static getAllSeasons()  { return Object.values(SEASONS); }
  static getSeason(id)    { return SEASONS[id] || null; }

  // Called on bot start — checks if a monthly event should be running
  static initFromSchedule(sock, groupChatIds, announceCallback) {
    const month = new Date().getMonth() + 1;
    const scheduledId = MONTHLY_SCHEDULE[month];
    if (scheduledId && !activeEvent) {
      this.startEvent(scheduledId, sock, groupChatIds, false, announceCallback);
    }
  }

  static startEvent(eventId, sock, groupChatIds, announce = true, announceCallback) {
    const event = SEASONS[eventId];
    if (!event) return { success: false, msg: `Unknown event: ${eventId}` };

    // Clear existing
    if (eventEndTimer) clearTimeout(eventEndTimer);

    activeEvent = {
      ...event,
      startTime: Date.now(),
      endTime:   Date.now() + event.duration * 24 * 60 * 60 * 1000,
    };

    console.log(`🎉 [SeasonManager] Event started: ${event.name} (${event.duration} days)`);

    // Auto-end after duration
    eventEndTimer = setTimeout(() => {
      const ended = activeEvent;
      activeEvent = null;
      if (sock && groupChatIds?.length > 0) {
        groupChatIds.forEach(chatId => {
          sock.sendMessage(chatId, {
            text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${ended.emoji} *${ended.name} HAS ENDED*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💭 The event fades. The world returns to normal...\n\nNext event coming soon! Stay active.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          }).catch(() => {});
        });
      }
    }, event.duration * 24 * 60 * 60 * 1000);

    // Announce to all groups
    if (announce && sock && groupChatIds?.length > 0) {
      groupChatIds.forEach(chatId => {
        sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${event.spawnMsg}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }).catch(() => {});
      });
    }

    if (announceCallback) announceCallback(event);
    return { success: true, event };
  }

  static stopEvent() {
    if (eventEndTimer) clearTimeout(eventEndTimer);
    const was = activeEvent;
    activeEvent = null;
    return was;
  }

  // Apply event bonuses to a gold/xp reward object
  static applyBonuses(rewards, type = 'general') {
    if (!activeEvent) return rewards;
    const b = activeEvent.bonuses;
    const result = { ...rewards };
    if (b.goldMult && result.gold)         result.gold     = Math.floor(result.gold     * b.goldMult);
    if (b.xpMult   && result.xp)          result.xp       = Math.floor(result.xp       * b.xpMult);
    if (b.crystalMult && result.crystals) result.crystals = Math.floor(result.crystals * b.crystalMult);
    return result;
  }

  static getXpMult()        { return activeEvent?.bonuses?.xpMult        || 1; }
  static getNexusMult()      { return activeEvent?.bonuses?.goldMult       || 1; }
  static getPvpEloMult()    { return activeEvent?.bonuses?.pvpEloMult     || 1; }
  static getBossRewardMult(){ return activeEvent?.bonuses?.bossRewardMult || 1; }
  static getLootMult()      { return activeEvent?.bonuses?.dungeonLootMult|| 1; }
  static getAllStatBoost()   { return activeEvent?.bonuses?.allStatBoost   || 0; }
  static getShopDiscount()  { return activeEvent?.bonuses?.shopDiscount   || 0; }

  static getEventBonusSummary() {
    if (!activeEvent) return null;
    const b = activeEvent.bonuses;
    const lines = [];
    if (b.xpMult   && b.xpMult   > 1) lines.push(`✨ XP ×${b.xpMult}`);
    if (b.goldMult && b.goldMult > 1)  lines.push(`💠 Nexus ×${b.goldMult}`);
    if (b.pvpEloMult && b.pvpEloMult > 1) lines.push(`⚔️ PvP ELO ×${b.pvpEloMult}`);
    if (b.bossRewardMult && b.bossRewardMult > 1) lines.push(`👹 Boss Rewards ×${b.bossRewardMult}`);
    if (b.dungeonLootMult && b.dungeonLootMult > 1) lines.push(`🏰 Dungeon Loot ×${b.dungeonLootMult}`);
    if (b.shopDiscount) lines.push(`🛒 Shop -${Math.floor(b.shopDiscount*100)}%`);
    if (b.allStatBoost) lines.push(`⚡ All Stats +${Math.floor(b.allStatBoost*100)}%`);
    return lines.join(' | ');
  }

  static getTimeRemaining() {
    if (!activeEvent) return null;
    const ms   = activeEvent.endTime - Date.now();
    if (ms <= 0) return 'Ending soon';
    const days = Math.floor(ms / 86400000);
    const hrs  = Math.floor((ms % 86400000) / 3600000);
    return days > 0 ? `${days}d ${hrs}h` : `${hrs}h`;
  }

  static formatEventStatus() {
    if (!activeEvent) return '😴 No active event. Check back soon!';
    const timeLeft = this.getTimeRemaining();
    const bonusSummary = this.getEventBonusSummary();
    return [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `${activeEvent.emoji} *${activeEvent.name.toUpperCase()}*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💭 ${activeEvent.description}`,
      ``,
      `⏰ Time remaining: *${timeLeft}*`,
      ``,
      `📊 *ACTIVE BONUSES:*`,
      bonusSummary || 'Various bonuses active!',
      ``,
      `🎁 *EXCLUSIVE DROPS THIS EVENT:*`,
      activeEvent.exclusiveDrops.map(d => `  • ${d}`).join('\n'),
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');
  }
}

module.exports = SeasonManager;
module.exports.SEASONS = SEASONS;
module.exports.MONTHLY_SCHEDULE = MONTHLY_SCHEDULE;