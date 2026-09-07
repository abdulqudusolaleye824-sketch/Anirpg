// ═══════════════════════════════════════════════════════════════
// TITLE SYSTEM v2 — Activity + Shop
// • 30+ titles with rarity tiers (color-coded)
// • Common/Uncommon/Rare/Epic = auto-earned by activity
// • Legendary/Mythic = bought from /titleshop
// • Owner/coowner can grant any title via /set --title
// ═══════════════════════════════════════════════════════════════

const RARITIES = {
  common:    { label: 'Common',    color: '⚪', code: '⬜', tier: 1, sell: 0     },
  uncommon:  { label: 'Uncommon',  color: '🟢', code: '🟩', tier: 2, sell: 0     },
  rare:      { label: 'Rare',      color: '🔵', code: '🟦', tier: 3, sell: 0     },
  epic:      { label: 'Epic',      color: '🟣', code: '🟪', tier: 4, sell: 0     },
  legendary: { label: 'Legendary', color: '🟡', code: '🟨', tier: 5, sell: 25000 },
  mythic:    { label: 'Mythic',    color: '🌈', code: '✨', tier: 6, sell: 0     },
};

// ── 30+ titles — every entry has: id, display, desc, rarity, condition (auto)
//                OR shop: { price: { gold, crystals } } for buy-only titles
//                OR grant: 'owner-only' for titles only owners can hand out
//                Each title has a stat boost in `boost` and `boostDesc` ──────
const TITLES = {
  // ── AUTO-EARNED — Common (white) ────────────────────────────
  'Newcomer': {
    display: '👋 Newcomer', rarity: 'common',
    desc: 'Just starting out',
    condition: p => (p.level||1) >= 1,
    boost: { maxHp: 5 },
    boostDesc: '+5 HP',
  },
  'Initiate': {
    display: '🌱 Initiate', rarity: 'common',
    desc: 'Reach Level 5',
    condition: p => (p.level||1) >= 5,
    boost: { atk: 2 },
    boostDesc: '+2 ATK',
  },
  'Apprentice': {
    display: '📚 Apprentice', rarity: 'common',
    desc: 'Reach Level 10',
    condition: p => (p.level||1) >= 10,
    boost: { def: 2 },
    boostDesc: '+2 DEF',
  },
  'Adventurer': {
    display: '🗺️ Adventurer', rarity: 'common',
    desc: 'Reach Level 15',
    condition: p => (p.level||1) >= 15,
    boost: { speed: 3 },
    boostDesc: '+3 SPD',
  },

  // ── AUTO-EARNED — Uncommon (green) ─────────────────────────
  'Rising Hunter': {
    display: '🌱 Rising Hunter', rarity: 'uncommon',
    desc: 'Reach Level 25',
    condition: p => (p.level||1) >= 25,
    boost: { atk: 5, def: 5 },
    boostDesc: '+5 ATK, +5 DEF',
  },
  'Devoted': {
    display: '📅 Devoted', rarity: 'uncommon',
    desc: '30-day daily quest streak',
    condition: p => (p.dailyQuest?.streak||0) >= 30,
    boost: { speed: 10, maxHp: 50 },
    boostDesc: '+10 SPD, +50 HP',
  },
  'Dungeon Crawler': {
    display: '🏰 Dungeon Crawler', rarity: 'uncommon',
    desc: 'Clear 5 dungeons',
    condition: p => (p.dungeon?.cleared||0) >= 5,
    boost: { def: 8, maxHp: 30 },
    boostDesc: '+8 DEF, +30 HP',
  },
  'Arena Regular': {
    display: '⚔️ Arena Regular', rarity: 'uncommon',
    desc: 'Win 5 PvP battles',
    condition: p => (p.pvpWins||0) >= 5,
    boost: { atk: 5 },
    boostDesc: '+5 ATK',
  },
  'Pet Lover': {
    display: '🐾 Pet Lover', rarity: 'uncommon',
    desc: 'Hatch your first pet',
    condition: p => p.pet && p.pet.id,
    boost: { maxHp: 25 },
    boostDesc: '+25 HP',
  },
  'Lucky Star': {
    display: '⭐ Lucky Star', rarity: 'uncommon',
    desc: 'Pull your first legendary item',
    condition: p => (p.summonHistory||[]).some(h => h.rarity === 'legendary'),
    boost: { maxHp: 30 },
    boostDesc: '+30 HP',
  },

  // ── AUTO-EARNED — Rare (blue) ──────────────────────────────
  'Duelist': {
    display: '⚔️ Duelist', rarity: 'rare',
    desc: 'Win 25 PvP battles',
    condition: p => (p.pvpWins||0) >= 25,
    boost: { atk: 10 },
    boostDesc: '+10 ATK',
  },
  'Blade Master': {
    display: '🗡️ Blade Master', rarity: 'rare',
    desc: 'Win 75 PvP battles',
    condition: p => (p.pvpWins||0) >= 75,
    boost: { atk: 15, speed: 5 },
    boostDesc: '+15 ATK, +5 SPD',
  },
  'Gate Breaker': {
    display: '🏰 Gate Breaker', rarity: 'rare',
    desc: 'Clear 25 dungeons',
    condition: p => (p.dungeon?.cleared||0) >= 25,
    boost: { def: 10, maxHp: 50 },
    boostDesc: '+10 DEF, +50 HP',
  },
  'Boss Hunter': {
    display: '👹 Boss Hunter', rarity: 'rare',
    desc: 'Defeat 15 world bosses',
    condition: p => (p.bossesDefeated||0) >= 15,
    boost: { atk: 12 },
    boostDesc: '+12 ATK',
  },
  'Elite Hunter': {
    display: '🔥 Elite Hunter', rarity: 'rare',
    desc: 'Reach Level 50',
    condition: p => (p.level||1) >= 50,
    boost: { atk: 15, def: 10, speed: 8 },
    boostDesc: '+15 ATK, +10 DEF, +8 SPD',
  },
  'Collector': {
    display: '🗃️ Collector', rarity: 'rare',
    desc: 'Collect 10 unique summon items',
    condition: p => {
      const weapons = Object.keys(p.summonWeapons||{}).length;
      const arts = (p.summonArtifacts||[]).length;
      return weapons + arts >= 10;
    },
    boost: { atk: 8, def: 8 },
    boostDesc: '+8 ATK, +8 DEF',
  },
  'Artisan': {
    display: '🔨 Artisan', rarity: 'rare',
    desc: 'Craft 25 items',
    condition: p => (p.craftCount||0) >= 25,
    boost: { atk: 5, def: 5, maxHp: 30 },
    boostDesc: '+5 ATK, +5 DEF, +30 HP',
  },
  'Treasure Hunter': {
    display: '💎 Treasure Hunter', rarity: 'rare',
    desc: 'Earn 100,000 Nexus total',
    condition: p => (p.totalNexusEarned||0) >= 100000,
    boost: { maxHp: 50 },
    boostDesc: '+50 HP',
  },

  // ── AUTO-EARNED — Epic (purple) ────────────────────────────
  'War God': {
    display: '⚡ War God', rarity: 'epic',
    desc: 'Win 250 PvP battles',
    condition: p => (p.pvpWins||0) >= 250,
    boost: { atk: 30, speed: 10 },
    boostDesc: '+30 ATK, +10 SPD',
  },
  'Unbreakable': {
    display: '🛡️ Unbreakable', rarity: 'epic',
    desc: 'Achieve a 10-win PvP streak',
    condition: p => (p.pvpStreak||0) >= 10,
    boost: { def: 20, maxHp: 50 },
    boostDesc: '+20 DEF, +50 HP',
  },
  'Conqueror': {
    display: '🏆 Conqueror', rarity: 'epic',
    desc: 'Clear 75 dungeons',
    condition: p => (p.dungeon?.cleared||0) >= 75,
    boost: { def: 15, maxHp: 80 },
    boostDesc: '+15 DEF, +80 HP',
  },
  'Raid Legend': {
    display: '🌍 Raid Legend', rarity: 'epic',
    desc: 'Defeat 75 world bosses',
    condition: p => (p.bossesDefeated||0) >= 75,
    boost: { atk: 25, maxHp: 100 },
    boostDesc: '+25 ATK, +100 HP',
  },
  'Grandmaster': {
    display: '👑 Grandmaster', rarity: 'epic',
    desc: 'Reach Grandmaster ELO (2000+)',
    condition: p => (p.pvpElo||1000) >= 2000,
    boost: { atk: 20, def: 10, speed: 10 },
    boostDesc: '+20 ATK, +10 DEF, +10 SPD',
  },
  'Shadow Monarch': {
    display: '🌑 Shadow Monarch', rarity: 'epic',
    desc: 'Reach Level 100',
    condition: p => (p.level||1) >= 100,
    boost: { atk: 40, def: 30, speed: 20, maxHp: 200 },
    boostDesc: '+40 ATK, +30 DEF, +20 SPD, +200 HP',
  },
  'Nightmare Slayer': {
    display: '💀 Nightmare Slayer', rarity: 'epic',
    desc: 'Fully clear 100 dungeons (all 20 floors)',
    condition: p => (p.dungeon?.cleared||0) >= 100,
    boost: { atk: 25, def: 20 },
    boostDesc: '+25 ATK, +20 DEF',
  },
  'War Veteran': {
    display: '⚔️ War Veteran', rarity: 'epic',
    desc: 'Win 5 Guild Wars',
    condition: p => (p.guildWarsWon||0) >= 5,
    boost: { atk: 18, def: 8 },
    boostDesc: '+18 ATK, +8 DEF',
  },
  'Veteran': {
    display: '🏅 Veteran', rarity: 'epic',
    desc: '365-day daily streak',
    condition: p => (p.dailyQuest?.streak||0) >= 365,
    boost: { atk: 30, def: 20, speed: 20, maxHp: 150 },
    boostDesc: '+30 ATK, +20 DEF, +20 SPD, +150 HP',
  },

  // ── SHOP — Legendary (gold) ────────────────────────────────
  'Phoenix Knight': {
    display: '🔥 Phoenix Knight', rarity: 'legendary',
    desc: 'Reborn from ashes, unstoppable',
    shop: { price: { gold: 50000,  crystals: 100 } },
    boost: { atk: 35, maxHp: 200, def: 25 },
    boostDesc: '+35 ATK, +200 HP, +25 DEF',
  },
  'Celestial Sage': {
    display: '✨ Celestial Sage', rarity: 'legendary',
    desc: 'Channeled the stars themselves',
    shop: { price: { gold: 75000,  crystals: 150 } },
    boost: { atk: 30, def: 30, speed: 30, maxHp: 100 },
    boostDesc: '+30 to all stats, +100 HP',
  },
  'Demon Slayer': {
    display: '🩸 Demon Slayer', rarity: 'legendary',
    desc: 'Sworn to eradicate the demon threat',
    shop: { price: { gold: 100000, crystals: 200 } },
    boost: { atk: 50, critChance: 10 },
    boostDesc: '+50 ATK, +10% crit',
  },
  'Shadow King': {
    display: '👁️ Shadow King', rarity: 'legendary',
    desc: 'Commander of the shadow army',
    shop: { price: { gold: 150000, crystals: 300 } },
    boost: { atk: 40, def: 40, speed: 25, maxHp: 250 },
    boostDesc: '+40 ATK, +40 DEF, +25 SPD, +250 HP',
  },
  'Eternal Wanderer': {
    display: '🌌 Eternal Wanderer', rarity: 'legendary',
    desc: 'Walks between worlds, untouched by time',
    shop: { price: { gold: 200000, crystals: 400 } },
    boost: { atk: 35, def: 35, speed: 35, maxHp: 200 },
    boostDesc: '+35 to all stats, +200 HP',
  },
  'Dragon Lord': {
    display: '🐉 Dragon Lord', rarity: 'legendary',
    desc: 'Master of dragons',
    shop: { price: { gold: 250000, crystals: 500 } },
    boost: { atk: 60, def: 35, maxHp: 300 },
    boostDesc: '+60 ATK, +35 DEF, +300 HP',
  },

  // ── MYTHIC (rainbow) — owner-granted only ──────────────────
  'Chosen One': {
    display: '🌟 Chosen One', rarity: 'mythic',
    desc: 'Blessed by the gods themselves',
    grant: 'owner-only',
    boost: { atk: 75, def: 50, speed: 50, maxHp: 500, critChance: 15 },
    boostDesc: '+75 ATK, +50 DEF, +50 SPD, +500 HP, +15% crit',
  },
  'World Savior': {
    display: '🌍 World Savior', rarity: 'mythic',
    desc: 'Saved the realm from annihilation',
    grant: 'owner-only',
    boost: { atk: 100, def: 75, speed: 50, maxHp: 750, critChance: 20, lifesteal: 10 },
    boostDesc: '+100 ATK, +75 DEF, +50 SPD, +750 HP, +20% crit, +10% lifesteal',
  },
  'God Slayer': {
    display: '⚡ God Slayer', rarity: 'mythic',
    desc: 'Defeated a god in single combat',
    grant: 'owner-only',
    boost: { atk: 150, def: 100, speed: 75, maxHp: 1000, critChance: 25 },
    boostDesc: '+150 ATK, +100 DEF, +75 SPD, +1000 HP, +25% crit',
  },

  // ── LEGACY AUTO-EARNED — still awarded the old way ─────────
  'Shadow Hunter': {
    display: '🌑 Shadow Hunter', rarity: 'epic',
    desc: 'Season 1 Premium Pass holder',
    condition: p => (p.titles||[]).includes('Shadow Hunter'),
    boost: { atk: 12, speed: 8 },
    boostDesc: '+12 ATK, +8 SPD',
  },
  'Shadow Survivor': {
    display: '👁️ Shadow Survivor', rarity: 'rare',
    desc: 'Complete Season 1 (Level 50 Free Pass)',
    condition: p => (p.titles||[]).includes('Shadow Survivor'),
    boost: { def: 15, maxHp: 80 },
    boostDesc: '+15 DEF, +80 HP',
  },
};

// ── Check and award all earned titles to a player. Returns newly earned titles.
function checkAndAwardTitles(player) {
  if (!Array.isArray(player.titles)) player.titles = [];
  const newTitles = [];
  for (const [id, def] of Object.entries(TITLES)) {
    if (player.titles.includes(id)) continue;
    if (!def.condition) continue; // shop / mythic — don't auto-grant
    try {
      if (def.condition(player)) {
        player.titles.push(id);
        newTitles.push(id);
      }
    } catch(e) { console.warn(`[SILENT] TitleSystem: condition failed for "${id}":`, e.message); }
  }
  return newTitles;
}

// ── Get the stat boost for the equipped title ────────────────
function getEquippedBoost(player) {
  const equipped = player.equippedTitle;
  if (!equipped || !TITLES[equipped]) return {};
  return TITLES[equipped].boost || {};
}

// ── Get display string for name + title ─────────────────────
function getTitleDisplay(player) {
  const equipped = player.equippedTitle;
  if (!equipped || !TITLES[equipped]) return '';
  return TITLES[equipped].display;
}

// ── Get rarity badge for a title (color emoji) ──────────────
function getRarityBadge(titleId) {
  const def = TITLES[titleId];
  if (!def) return { code: '⬜', label: 'Common', color: '⚪' };
  return RARITIES[def.rarity] || RARITIES.common;
}

// ── List all titles in a given rarity ──────────────────────
function listByRarity(rarity) {
  return Object.entries(TITLES)
    .filter(([_, def]) => def.rarity === rarity)
    .map(([id, def]) => ({ id, ...def }));
}

// ── Compute the price a player must pay to buy a shop title ─
function getShopPrice(titleId) {
  const def = TITLES[titleId];
  if (!def?.shop) return null;
  return def.shop.price;
}

module.exports = {
  TITLES,
  RARITIES,
  checkAndAwardTitles,
  getEquippedBoost,
  getTitleDisplay,
  getRarityBadge,
  listByRarity,
  getShopPrice,
};
