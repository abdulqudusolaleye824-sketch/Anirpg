// ═══════════════════════════════════════════════════════════════
// RAMADAN EVENT SYSTEM
// ═══════════════════════════════════════════════════════════════

const { updatePlayerNexus } = require('./NexusManager');

const RAMADAN_CONFIG = {
  // 🌙 Event dates (adjust these each year)
  startDate: new Date('2026-02-21T00:00:00Z'), // First day of Ramadan 2026
  endDate: new Date('2026-03-22T23:59:59Z'),   // Last day of Ramadan 2026
  
  // ⏰ Iftar time (sunset) - adjust for your timezone
  iftarHour: 18, // 6 PM (adjust to local sunset time)
  iftarMinute: 30,
  
  // 🎁 Event bonuses
  xpMultiplier: 1.5,    // 50% bonus XP
  goldMultiplier: 1.5,  // 50% bonus Nexus
  
  // 🏆 Exclusive titles
  titles: {
    blessed: 'The Blessed',
    nightWorshipper: 'Night Worshipper',
    generous: 'The Generous'
  }
};

// ═══════════════════════════════════════════════════════════════
// RAMADAN ARTIFACTS
// ═══════════════════════════════════════════════════════════════

const RAMADAN_ARTIFACTS = {
  'Ramadan Lantern': {
    name: 'Ramadan Lantern',
    type: 'amulet',
    rarity: 'epic',
    emoji: '🏮',
    description: 'Sacred lantern that illuminates the path of faith.',
    set: 'Ramadan Blessing',
    stats: {
      hp: 200,
      defense: 50,
      holyPower: 100
    },
    abilities: [
      {
        name: 'Divine Light',
        description: '+25% XP gain during Ramadan',
        effect: 'exp_boost',
        value: 25
      },
      {
        name: 'Blessed Aura',
        description: 'Regenerate 3% HP per turn',
        effect: 'regen_hp',
        value: 3
      }
    ],
    requirements: {
      level: 1,
      event: 'ramadan'
    }
  },
  
  'Prayer Beads': {
    name: 'Prayer Beads',
    type: 'amulet',
    rarity: 'epic',
    emoji: '📿',
    description: 'Sacred beads used for remembrance and reflection.',
    set: 'Ramadan Blessing',
    stats: {
      magicPower: 150,
      mana: 200,
      wisdom: 50
    },
    abilities: [
      {
        name: 'Spiritual Connection',
        description: '+30% magic damage',
        effect: 'magic_damage',
        value: 30
      },
      {
        name: 'Peaceful Mind',
        description: 'Skills cost 20% less mana',
        effect: 'mana_cost_reduction',
        value: 20
      },
      {
        name: 'Divine Favor',
        description: '+20% Nexus gain',
        effect: 'gold_boost',
        value: 20
      }
    ],
    requirements: {
      level: 1,
      event: 'ramadan'
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// RAMADAN QUESTS
// ═══════════════════════════════════════════════════════════════

const RAMADAN_QUESTS = {
  'ramadan_charity_1': {
    id: 'ramadan_charity_1',
    name: 'The Generous Soul',
    category: 'ramadan',
    type: 'charity',
    level: 1,
    description: 'Share your wealth with those in need during Ramadan.',
    objectives: [
      {
        type: 'donate_gold',
        desc: 'Donate 1000 Nexus to charity',
        count: 1000,
        current: 0
      }
    ],
    rewards: {
      exp: 500,
      gold: 2000,
      title: 'The Generous',
      artifact: 'Prayer Beads'
    },
    dialogue: {
      accept: '🌙 "Charity does not decrease wealth. Share your blessings..."',
      complete: '✨ "Your generosity has been recorded. May you be blessed!"'
    }
  },
  
  'ramadan_fasting_1': {
    id: 'ramadan_fasting_1',
    name: 'Breaking the Fast',
    category: 'ramadan',
    type: 'daily',
    level: 1,
    description: 'Claim your Iftar reward at sunset.',
    objectives: [
      {
        type: 'iftar_claim',
        desc: 'Claim Iftar reward',
        count: 1,
        current: 0
      }
    ],
    rewards: {
      exp: 300,
      gold: 500,
      manaCrystals: 10
    },
    dialogue: {
      accept: '🌙 "Fast with patience, break your fast with gratitude."',
      complete: '🍽️ "Blessed is the one who breaks their fast!"'
    },
    repeatable: true,
    resetDaily: true
  },
  
  'ramadan_battles_1': {
    id: 'ramadan_battles_1',
    name: 'Night Warrior',
    category: 'ramadan',
    type: 'kill',
    level: 1,
    description: 'Defeat monsters during the blessed nights of Ramadan.',
    objectives: [
      {
        type: 'kill_any',
        desc: 'Defeat 30 monsters',
        count: 30,
        current: 0
      }
    ],
    rewards: {
      exp: 1000,
      gold: 1500,
      title: 'Night Worshipper',
      artifact: 'Ramadan Lantern'
    },
    dialogue: {
      accept: '🌙 "Fight for righteousness during these blessed nights."',
      complete: '⚔️ "Your courage shines like the crescent moon!"'
    }
  },
  
  'ramadan_dungeons_1': {
    id: 'ramadan_dungeons_1',
    name: 'Blessed Expedition',
    category: 'ramadan',
    type: 'dungeon',
    level: 1,
    description: 'Complete dungeons during Ramadan for extra blessings.',
    objectives: [
      {
        type: 'dungeon_clear',
        desc: 'Clear 5 dungeons',
        count: 5,
        current: 0
      }
    ],
    rewards: {
      exp: 2000,
      gold: 3000,
      manaCrystals: 50
    },
    dialogue: {
      accept: '🌙 "Embark on journeys of faith and courage."',
      complete: '🏰 "Your dedication brings great rewards!"'
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// CHECK IF RAMADAN EVENT IS ACTIVE
// ═══════════════════════════════════════════════════════════════

function isRamadanActive() {
  const now = new Date();
  return now >= RAMADAN_CONFIG.startDate && now <= RAMADAN_CONFIG.endDate;
}

// ═══════════════════════════════════════════════════════════════
// CHECK IF IT'S IFTAR TIME
// ═══════════════════════════════════════════════════════════════

function isIftarTime() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // Iftar window: 30 minutes before to 2 hours after sunset
  const iftarStart = RAMADAN_CONFIG.iftarHour * 60 + RAMADAN_CONFIG.iftarMinute - 30;
  const iftarEnd = RAMADAN_CONFIG.iftarHour * 60 + RAMADAN_CONFIG.iftarMinute + 120;
  const currentTime = hour * 60 + minute;
  
  return currentTime >= iftarStart && currentTime <= iftarEnd;
}

// ═══════════════════════════════════════════════════════════════
// GET PLAYER RAMADAN DATA
// ═══════════════════════════════════════════════════════════════

function getPlayerRamadanData(player) {
  if (!player.ramadanEvent) {
    player.ramadanEvent = {
      iftarsClaimed: 0,
      lastIftarClaim: 0,
      charityDonated: 0,
      questsCompleted: [],
      titlesEarned: [],
      monstersDefeated: 0,
      dungeonsCleared: 0
    };
  }
  return player.ramadanEvent;
}

// ═══════════════════════════════════════════════════════════════
// CLAIM IFTAR REWARD
// ═══════════════════════════════════════════════════════════════

function claimIftar(player) {
  if (!isRamadanActive()) {
    return {
      success: false,
      message: '❌ Ramadan event is not active!'
    };
  }
  
  if (!isIftarTime()) {
    const iftarHour = RAMADAN_CONFIG.iftarHour;
    const iftarMinute = RAMADAN_CONFIG.iftarMinute;
    return {
      success: false,
      message: `⏰ Iftar time is at ${iftarHour}:${iftarMinute.toString().padStart(2, '0')}!\n\nCome back during sunset to claim your reward.`
    };
  }
  
  const ramadanData = getPlayerRamadanData(player);
  const today = new Date().toDateString();
  const lastClaim = new Date(ramadanData.lastIftarClaim).toDateString();
  
  if (today === lastClaim) {
    return {
      success: false,
      message: '❌ You already claimed your Iftar reward today!\n\nCome back tomorrow at sunset. 🌙'
    };
  }
  
  // Calculate rewards
  const baseExp = 300;
  const baseNexus = 500;
  const baseCrystals = 10;
  
  const exp = Math.floor(baseExp * RAMADAN_CONFIG.xpMultiplier);
  const Nexus = Math.floor(baseNexus * RAMADAN_CONFIG.goldMultiplier);
  const crystals = baseCrystals;
  
  // Apply rewards
  player.xp = (player.xp || 0) + exp;
  player.manaCrystals = (player.manaCrystals || 0) + crystals;
  
  // ✅ Use NexusManager for Nexus (will be saved by command, not here)
  updatePlayerNexus(player, Nexus, null);
  
  // Update data
  ramadanData.iftarsClaimed++;
  ramadanData.lastIftarClaim = Date.now();
  
  return {
    success: true,
    rewards: { exp, Nexus, crystals },
    totalClaimed: ramadanData.iftarsClaimed
  };
}

// ═══════════════════════════════════════════════════════════════
// DONATE TO CHARITY
// ═══════════════════════════════════════════════════════════════

function donateCharity(player, amount) {
  if (!isRamadanActive()) {
    return {
      success: false,
      message: '❌ Ramadan event is not active!'
    };
  }
  
  if ((player.gold || 0) < amount) {
    return {
      success: false,
      message: `❌ Not enough Nexus!\n\nYou have: ${player.gold || 0}g\nNeed: ${amount} 💠`
    };
  }
  
  // ✅ Deduct Nexus using NexusManager
  updatePlayerNexus(player, -amount, null);
  
  // Track donation
  const ramadanData = getPlayerRamadanData(player);
  ramadanData.charityDonated += amount;
  
  // Calculate blessing (20% return)
  const blessing = Math.floor(amount * 0.2);
  
  // ✅ Add blessing using NexusManager
  updatePlayerNexus(player, blessing, null);
  
  // Award title at milestones
  let titleAwarded = null;
  if (ramadanData.charityDonated >= 5000 && !ramadanData.titlesEarned.includes('The Generous')) {
    ramadanData.titlesEarned.push('The Generous');
    if (!player.titles) player.titles = [];
    player.titles.push(RAMADAN_CONFIG.titles.generous);
    titleAwarded = RAMADAN_CONFIG.titles.generous;
  }
  
  return {
    success: true,
    donated: amount,
    blessing,
    totalDonated: ramadanData.charityDonated,
    titleAwarded
  };
}

// ═══════════════════════════════════════════════════════════════
// GET AVAILABLE RAMADAN QUESTS
// ═══════════════════════════════════════════════════════════════

function getAvailableRamadanQuests(player) {
  if (!isRamadanActive()) return [];
  
  const ramadanData = getPlayerRamadanData(player);
  const available = [];
  
  for (const quest of Object.values(RAMADAN_QUESTS)) {
    // Check if already completed (unless repeatable)
    if (!quest.repeatable && ramadanData.questsCompleted.includes(quest.id)) {
      continue;
    }
    
    // Check level requirement
    if (quest.level > player.level) {
      continue;
    }
    
    available.push(quest);
  }
  
  return available;
}

// ═══════════════════════════════════════════════════════════════
// APPLY RAMADAN BONUSES TO REWARDS
// ═══════════════════════════════════════════════════════════════

function applyRamadanBonuses(rewards) {
  if (!isRamadanActive()) return rewards;
  
  const bonusRewards = { ...rewards };
  
  if (bonusRewards.exp) {
    bonusRewards.exp = Math.floor(bonusRewards.exp * RAMADAN_CONFIG.xpMultiplier);
  }
  
  if (bonusRewards.gold) {
    bonusRewards.gold = Math.floor(bonusRewards.gold * RAMADAN_CONFIG.goldMultiplier);
  }
  
  return bonusRewards;
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  RAMADAN_CONFIG,
  RAMADAN_ARTIFACTS,
  RAMADAN_QUESTS,
  isRamadanActive,
  isIftarTime,
  getPlayerRamadanData,
  claimIftar,
  donateCharity,
  getAvailableRamadanQuests,
  applyRamadanBonuses
};