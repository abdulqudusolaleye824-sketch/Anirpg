// ═══════════════════════════════════════════════════════════════
// ACHIEVEMENT DATABASE - All Achievements
// ═══════════════════════════════════════════════════════════════

const ACHIEVEMENTS = {
  first_blood: {
    id: 'first_blood', name: '🩸 First Blood', category: 'Combat',
    desc: 'Win your first battle', condition: { type: 'kill', count: 1 },
    reward: { gold: 500, xp: 100, crystals: 0 }
  },
  monster_slayer: {
    id: 'monster_slayer', name: '⚔️ Monster Slayer', category: 'Combat',
    desc: 'Kill 150 monsters', condition: { type: 'kill', count: 150 },
    reward: { gold: 2000, xp: 500, crystals: 5 }
  },
  century_killer: {
    id: 'century_killer', name: '💀 Century Killer', category: 'Combat',
    desc: 'Kill 500 monsters', condition: { type: 'kill', count: 500 },
    reward: { gold: 5000, xp: 1000, crystals: 10 }
  },
  thousand_kills: {
    id: 'thousand_kills', name: '🔱 Thousand Kills', category: 'Combat',
    desc: 'Kill 3000 monsters', condition: { type: 'kill', count: 3000 },
    reward: { gold: 20000, xp: 5000, crystals: 50 }
  },
  critical_master: {
    id: 'critical_master', name: '💥 Critical Master', category: 'Combat',
    desc: 'Land 300 critical hits', condition: { type: 'crit_hit', count: 300 },
    reward: { gold: 3000, xp: 800, crystals: 10 }
  },
  dungeon_novice: {
    id: 'dungeon_novice', name: '🏰 Dungeon Novice', category: 'Dungeon',
    desc: 'Clear your first dungeon', condition: { type: 'dungeon_clear', count: 1 },
    reward: { gold: 1000, xp: 300, crystals: 5 }
  },
  dungeon_veteran: {
    id: 'dungeon_veteran', name: '🗝️ Dungeon Veteran', category: 'Dungeon',
    desc: 'Clear 25 dungeons', condition: { type: 'dungeon_clear', count: 25 },
    reward: { gold: 5000, xp: 1500, crystals: 15 }
  },
  dungeon_master: {
    id: 'dungeon_master', name: '👑 Dungeon Master', category: 'Dungeon',
    desc: 'Clear 250 dungeons', condition: { type: 'dungeon_clear', count: 250 },
    reward: { gold: 25000, xp: 8000, crystals: 75 }
  },
  dungeon_legend: {
    id: 'dungeon_legend', name: '🌟 Dungeon Legend', category: 'Dungeon',
    desc: 'Clear 250 dungeons', condition: { type: 'dungeon_clear', count: 250 },
    reward: { gold: 50000, xp: 20000, crystals: 200 }
  },
  floor_diver: {
    id: 'floor_diver', name: '🕳️ Floor Diver', category: 'Dungeon',
    desc: 'Enter a dungeon 5 times in one day', condition: { type: 'dungeon_enter_daily', count: 5 },
    reward: { gold: 3000, xp: 500, crystals: 10 }
  },
  boss_slayer: {
    id: 'boss_slayer', name: '🗡️ Boss Slayer', category: 'Boss',
    desc: 'Defeat your first boss', condition: { type: 'boss_kill', count: 1 },
    reward: { gold: 2000, xp: 500, crystals: 10 }
  },
  boss_hunter: {
    id: 'boss_hunter', name: '🏹 Boss Hunter', category: 'Boss',
    desc: 'Defeat 25 bosses', condition: { type: 'boss_kill', count: 25 },
    reward: { gold: 10000, xp: 3000, crystals: 30 }
  },
  boss_destroyer: {
    id: 'boss_destroyer', name: '💣 Boss Destroyer', category: 'Boss',
    desc: 'Defeat 100 bosses', condition: { type: 'boss_kill', count: 100 },
    reward: { gold: 50000, xp: 15000, crystals: 150 }
  },
  raid_champion: {
    id: 'raid_champion', name: '🛡️ Raid Champion', category: 'Boss',
    desc: 'Defeat an S-rank boss', condition: { type: 'boss_rank_kill', rank: 'S', count: 1 },
    reward: { gold: 30000, xp: 8000, crystals: 80 }
  },
  beyond_conqueror: {
    id: 'beyond_conqueror', name: '🌌 Beyond Conqueror', category: 'Boss',
    desc: 'Defeat a Beyond-rank boss', condition: { type: 'boss_rank_kill', rank: 'Beyond', count: 1 },
    reward: { gold: 100000, xp: 30000, crystals: 300 }
  },
  first_victory: {
    id: 'first_victory', name: '🥊 First Victory', category: 'PvP',
    desc: 'Win your first PvP battle', condition: { type: 'pvp_win', count: 1 },
    reward: { gold: 1000, xp: 300, crystals: 5 }
  },
  arena_regular: {
    id: 'arena_regular', name: '🎖️ Arena Regular', category: 'PvP',
    desc: 'Win 25 PvP battles', condition: { type: 'pvp_win', count: 25 },
    reward: { gold: 5000, xp: 1500, crystals: 20 }
  },
  pvp_veteran: {
    id: 'pvp_veteran', name: '⚔️ PvP Veteran', category: 'PvP',
    desc: 'Win 150 PvP battles', condition: { type: 'pvp_win', count: 150 },
    reward: { gold: 20000, xp: 8000, crystals: 80 }
  },
  pvp_legend: {
    id: 'pvp_legend', name: '🏆 PvP Legend', category: 'PvP',
    desc: 'Win 300 PvP battles', condition: { type: 'pvp_win', count: 300 },
    reward: { gold: 50000, xp: 20000, crystals: 200 }
  },
  win_streak_5: {
    id: 'win_streak_5', name: '🔥 On Fire', category: 'PvP',
    desc: 'Achieve a 7 PvP win streak', condition: { type: 'pvp_streak', count: 7 },
    reward: { gold: 5000, xp: 2000, crystals: 25 }
  },
  win_streak_10: {
    id: 'win_streak_10', name: '🌪️ Unstoppable', category: 'PvP',
    desc: 'Achieve a 15 PvP win streak', condition: { type: 'pvp_streak', count: 15 },
    reward: { gold: 15000, xp: 6000, crystals: 75 }
  },
  level_10: {
    id: 'level_10', name: '📈 Rising Hunter', category: 'Growth',
    desc: 'Reach Level 10', condition: { type: 'level', count: 10 },
    reward: { gold: 2000, xp: 0, crystals: 10 }
  },
  level_25: {
    id: 'level_25', name: '📊 Seasoned Hunter', category: 'Growth',
    desc: 'Reach Level 30', condition: { type: 'level', count: 30 },
    reward: { gold: 5000, xp: 0, crystals: 25 }
  },
  level_50: {
    id: 'level_50', name: '🌟 Elite Hunter', category: 'Growth',
    desc: 'Reach Level 60', condition: { type: 'level', count: 60 },
    reward: { gold: 15000, xp: 0, crystals: 75 }
  },
  level_75: {
    id: 'level_75', name: '💫 Master Hunter', category: 'Growth',
    desc: 'Reach Level 90', condition: { type: 'level', count: 90 },
    reward: { gold: 30000, xp: 0, crystals: 150 }
  },
  level_100: {
    id: 'level_100', name: '👑 S-Rank Hunter', category: 'Growth',
    desc: 'Reach Level 120', condition: { type: 'level', count: 120 },
    reward: { gold: 100000, xp: 0, crystals: 500 }
  },
  first_thousand: {
    id: 'first_thousand', name: '💠 First Thousand', category: 'Wealth',
    desc: 'Accumulate 10,000 Nexus', condition: { type: 'gold_total', count: 10000 },
    reward: { gold: 500, xp: 100, crystals: 0 }
  },
  gold_hoarder: {
    id: 'gold_hoarder', name: '💛 Nexus Hoarder', category: 'Wealth',
    desc: 'Accumulate 500,000 Nexus', condition: { type: 'gold_total', count: 500000 },
    reward: { gold: 10000, xp: 2000, crystals: 20 }
  },
  millionaire: {
    id: 'millionaire', name: '🤑 Millionaire', category: 'Wealth',
    desc: 'Accumulate 5,000,000 Nexus', condition: { type: 'gold_total', count: 5000000 },
    reward: { gold: 50000, xp: 10000, crystals: 100 }
  },
  crystal_collector: {
    id: 'crystal_collector', name: '💎 Mana Stone Collector', category: 'Wealth',
    desc: 'Collect 500 Mana Stones', condition: { type: 'crystals_total', count: 500 },
    reward: { gold: 5000, xp: 1000, crystals: 50 }
  },
  crystal_hoarder: {
    id: 'crystal_hoarder', name: '🔮 Mana Stone Hoarder', category: 'Wealth',
    desc: 'Collect 5,000 Mana Stones', condition: { type: 'crystals_total', count: 5000 },
    reward: { gold: 25000, xp: 5000, crystals: 200 }
  },
  first_companion: {
    id: 'first_companion', name: '🐾 First Companion', category: 'Pets',
    desc: 'Catch your first pet', condition: { type: 'pets_caught', count: 1 },
    reward: { gold: 2000, xp: 500, crystals: 10 }
  },
  pet_collector: {
    id: 'pet_collector', name: '🦁 Pet Collector', category: 'Pets',
    desc: 'Catch 25 different pets', condition: { type: 'pets_caught', count: 25 },
    reward: { gold: 10000, xp: 2000, crystals: 30 }
  },
  pet_master: {
    id: 'pet_master', name: '🌟 Pet Master', category: 'Pets',
    desc: 'Catch 25 different pets', condition: { type: 'pets_caught', count: 25 },
    reward: { gold: 25000, xp: 5000, crystals: 75 }
  },
  best_friends: {
    id: 'best_friends', name: '💕 Best Friends', category: 'Pets',
    desc: 'Reach 150 bonding with a pet', condition: { type: 'pet_bonding', count: 150 },
    reward: { gold: 5000, xp: 2000, crystals: 25 }
  },
  pet_evolver: {
    id: 'pet_evolver', name: '🦋 Pet Evolver', category: 'Pets',
    desc: 'Evolve a pet', condition: { type: 'pet_evolve', count: 1 },
    reward: { gold: 10000, xp: 3000, crystals: 50 }
  },
  legendary_companion: {
    id: 'legendary_companion', name: '✨ Legendary Companion', category: 'Pets',
    desc: 'Catch a Legendary rarity pet', condition: { type: 'pet_rarity', rarity: 'legendary', count: 1 },
    reward: { gold: 30000, xp: 8000, crystals: 100 }
  },
  sacrifice_honor: {
    id: 'sacrifice_honor', name: '💀 A Bond Beyond Death', category: 'Pets',
    desc: 'Have a pet sacrifice itself for you', condition: { type: 'pet_sacrifice', count: 1 },
    reward: { gold: 10000, xp: 5000, crystals: 50 }
  },
  pet_feeder: {
    id: 'pet_feeder', name: '🍖 Devoted Caretaker', category: 'Pets',
    desc: 'Feed your pet 150 times', condition: { type: 'pet_feed', count: 150 },
    reward: { gold: 3000, xp: 1000, crystals: 15 }
  },
  pet_level_10: {
    id: 'pet_level_10', name: '⬆️ Growing Companion', category: 'Pets',
    desc: 'Level a pet to Level 10', condition: { type: 'pet_level', count: 10 },
    reward: { gold: 5000, xp: 2000, crystals: 20 }
  },
  pet_level_max: {
    id: 'pet_level_max', name: '🏆 Maxed Companion', category: 'Pets',
    desc: 'Level a pet to max level', condition: { type: 'pet_level', count: 50 },
    reward: { gold: 30000, xp: 10000, crystals: 150 }
  },
  skill_user: {
    id: 'skill_user', name: '✨ Skill User', category: 'Skills',
    desc: 'Use a skill 50 times', condition: { type: 'skill_use', count: 50 },
    reward: { gold: 1000, xp: 300, crystals: 5 }
  },
  skill_adept: {
    id: 'skill_adept', name: '🔮 Skill Adept', category: 'Skills',
    desc: 'Use skills 300 times', condition: { type: 'skill_use', count: 300 },
    reward: { gold: 5000, xp: 1500, crystals: 20 }
  },
  skill_master: {
    id: 'skill_master', name: '🌀 Skill Master', category: 'Skills',
    desc: 'Use skills 1000 times', condition: { type: 'skill_use', count: 1000 },
    reward: { gold: 20000, xp: 8000, crystals: 75 }
  },
  max_skill: {
    id: 'max_skill', name: '💫 Maximized', category: 'Skills',
    desc: 'Upgrade a skill to max level', condition: { type: 'skill_maxed', count: 1 },
    reward: { gold: 10000, xp: 3000, crystals: 40 }
  },
  full_skillset: {
    id: 'full_skillset', name: '📚 Full Arsenal', category: 'Skills',
    desc: 'Learn 10 active skills', condition: { type: 'skills_learned', count: 10 },
    reward: { gold: 8000, xp: 2000, crystals: 30 }
  },
  quest_starter: {
    id: 'quest_starter', name: '📜 Quest Starter', category: 'Quests',
    desc: 'Complete your first quest', condition: { type: 'quests_complete', count: 1 },
    reward: { gold: 1000, xp: 300, crystals: 5 }
  },
  scroll_reader_1: {
    id: 'scroll_reader_1', name: '📜 Scroll Scholar', category: 'Quests',
    desc: 'Read your first recipe scroll', condition: { type: 'scroll_read', count: 1 },
    reward: { gold: 1000, xp: 300, crystals: 5 }
  },
  scroll_reader_10: {
    id: 'scroll_reader_10', name: '📖 Master Archivist', category: 'Quests',
    desc: 'Read 10 recipe scrolls', condition: { type: 'scroll_read', count: 10 },
    reward: { gold: 5000, xp: 1500, crystals: 20 }
  },
  scroll_reader_50: {
    id: 'scroll_reader_50', name: '🔮 Scroll Master', category: 'Quests',
    desc: 'Read 50 recipe scrolls', condition: { type: 'scroll_read', count: 50 },
    reward: { gold: 20000, xp: 8000, crystals: 75 }
  },
  quest_runner: {
    id: 'quest_runner', name: '🏃 Quest Runner', category: 'Quests',
    desc: 'Complete 25 quests', condition: { type: 'quests_complete', count: 25 },
    reward: { gold: 5000, xp: 1500, crystals: 20 }
  },
  quest_champion: {
    id: 'quest_champion', name: '🎗️ Quest Champion', category: 'Quests',
    desc: 'Complete 100 quests', condition: { type: 'quests_complete', count: 100 },
    reward: { gold: 20000, xp: 8000, crystals: 75 }
  },
  daily_devotion: {
    id: 'daily_devotion', name: '📅 Daily Devotion', category: 'Quests',
    desc: 'Complete 14 daily quests', condition: { type: 'daily_quests', count: 14 },
    reward: { gold: 5000, xp: 2000, crystals: 20 }
  },
  explorer: {
    id: 'explorer', name: '🗺️ Explorer', category: 'Exploration',
    desc: 'Complete a D-rank dungeon', condition: { type: 'dungeon_rank', rank: 'D', count: 1 },
    reward: { gold: 3000, xp: 800, crystals: 10 }
  },
  deep_diver: {
    id: 'deep_diver', name: '🌊 Deep Diver', category: 'Exploration',
    desc: 'Complete an A-rank dungeon', condition: { type: 'dungeon_rank', rank: 'A', count: 1 },
    reward: { gold: 10000, xp: 3000, crystals: 40 }
  },
  void_walker: {
    id: 'void_walker', name: '🌌 Void Walker', category: 'Exploration',
    desc: 'Complete an S-rank dungeon', condition: { type: 'dungeon_rank', rank: 'S', count: 1 },
    reward: { gold: 30000, xp: 10000, crystals: 100 }
  },
  speed_runner: {
    id: 'speed_runner', name: '⚡ Speed Runner', category: 'Exploration',
    desc: 'Clear a dungeon in under 5 turns per monster', condition: { type: 'dungeon_speed', count: 1 },
    reward: { gold: 5000, xp: 1500, crystals: 20 }
  },
  first_weapon: {
    id: 'first_weapon', name: '🗡️ Armed', category: 'Equipment',
    desc: 'Equip your first weapon', condition: { type: 'equip_weapon', count: 1 },
    reward: { gold: 500, xp: 100, crystals: 0 }
  },
  artifact_finder: {
    id: 'artifact_finder', name: '🔮 Artifact Finder', category: 'Equipment',
    desc: 'Obtain your first artifact', condition: { type: 'artifact_obtained', count: 1 },
    reward: { gold: 5000, xp: 1000, crystals: 20 }
  },
  artifact_collector: {
    id: 'artifact_collector', name: '🏺 Artifact Collector', category: 'Equipment',
    desc: 'Obtain 5 artifacts', condition: { type: 'artifact_obtained', count: 5 },
    reward: { gold: 15000, xp: 3000, crystals: 60 }
  },
  fully_equipped: {
    id: 'fully_equipped', name: '⚔️ Fully Equipped', category: 'Equipment',
    desc: 'Equip artifacts in all 7 slots', condition: { type: 'artifact_slots', count: 7 },
    reward: { gold: 25000, xp: 5000, crystals: 100 }
  },
  party_leader: {
    id: 'party_leader', name: '👥 Party Leader', category: 'Social',
    desc: 'Create and complete a dungeon with a party', condition: { type: 'party_dungeon', count: 1 },
    reward: { gold: 3000, xp: 800, crystals: 10 }
  },
  generous: {
    id: 'generous', name: '🎁 Generous Soul', category: 'Social',
    desc: 'Gift a pet to another player', condition: { type: 'pet_gifted', count: 1 },
    reward: { gold: 2000, xp: 500, crystals: 10 }
  },
  lucky_gambler: {
    id: 'lucky_gambler', name: '🎰 Lucky Gambler', category: 'Casino',
    desc: 'Win at the casino 25 times', condition: { type: 'casino_win', count: 25 },
    reward: { gold: 5000, xp: 1000, crystals: 15 }
  },
  jackpot: {
    id: 'jackpot', name: '💎 Jackpot!', category: 'Casino',
    desc: 'Hit a jackpot on slots', condition: { type: 'casino_jackpot', count: 1 },
    reward: { gold: 20000, xp: 5000, crystals: 50 }
  },
  big_spender: {
    id: 'big_spender', name: '💸 Big Spender', category: 'Casino',
    desc: 'Bet 500,000 Nexus total in the casino', condition: { type: 'casino_bet_total', count: 500000 },
    reward: { gold: 10000, xp: 2000, crystals: 30 }
  },
  near_death: {
    id: 'near_death', name: '💀 Near Death', category: 'Survival',
    desc: 'Survive with less than 5% HP in a dungeon', condition: { type: 'low_hp_survive', count: 1 },
    reward: { gold: 3000, xp: 1000, crystals: 15 }
  },
  deathless: {
    id: 'deathless', name: '🛡️ Deathless', category: 'Survival',
    desc: 'Complete 5 dungeons without dying', condition: { type: 'dungeon_no_death', count: 5 },
    reward: { gold: 10000, xp: 3000, crystals: 40 }
  },
  ironman: {
    id: 'ironman', name: '🤖 Ironman', category: 'Survival',
    desc: 'Complete a nightmare dungeon solo', condition: { type: 'nightmare_solo', count: 1 },
    reward: { gold: 20000, xp: 8000, crystals: 80 }
  },
  comeback_king: {
    id: 'comeback_king', name: '👑 Comeback King', category: 'Survival',
    desc: 'Win a PvP battle from below 20% HP', condition: { type: 'pvp_comeback', count: 1 },
    reward: { gold: 5000, xp: 2000, crystals: 25 }
  },
  power_up: {
    id: 'power_up', name: '💪 Power Up', category: 'Upgrades',
    desc: 'Allocate 25 upgrade points', condition: { type: 'up_spent', count: 25 },
    reward: { gold: 1000, xp: 300, crystals: 5 }
  },
  optimizer: {
    id: 'optimizer', name: '🔧 Optimizer', category: 'Upgrades',
    desc: 'Allocate 250 upgrade points', condition: { type: 'up_spent', count: 250 },
    reward: { gold: 8000, xp: 2000, crystals: 30 }
  },
  min_maxer: {
    id: 'min_maxer', name: '📊 Min-Maxer', category: 'Upgrades',
    desc: 'Allocate 1000 upgrade points', condition: { type: 'up_spent', count: 1000 },
    reward: { gold: 30000, xp: 10000, crystals: 100 }
  },
  hundred_days: {
    id: 'hundred_days', name: '📆 Centurion', category: 'Milestones',
    desc: 'Play for 150 days', condition: { type: 'days_played', count: 150 },
    reward: { gold: 50000, xp: 10000, crystals: 200 }
  },
  achievement_hunter_10: {
    id: 'achievement_hunter_10', name: '🎯 Achievement Hunter', category: 'Milestones',
    desc: 'Unlock 10 achievements', condition: { type: 'achievements_unlocked', count: 10 },
    reward: { gold: 5000, xp: 1500, crystals: 20 }
  },
  achievement_hunter_50: {
    id: 'achievement_hunter_50', name: '🏅 Achievement Addict', category: 'Milestones',
    desc: 'Unlock 75 achievements', condition: { type: 'achievements_unlocked', count: 75 },
    reward: { gold: 30000, xp: 10000, crystals: 100 }
  },
  completionist: {
    id: 'completionist', name: '🌈 Completionist', category: 'Milestones',
    desc: 'Unlock all 100 achievements', condition: { type: 'achievements_unlocked', count: 100 },
    reward: { gold: 500000, xp: 100000, crystals: 1000 }
  },
  berserker_rage: {
    id: 'berserker_rage', name: '🔥 Berserker Rage', category: 'Class',
    desc: 'Deal over 10,000 damage in one hit as a Berserker', condition: { type: 'single_hit_damage', count: 10000 },
    reward: { gold: 10000, xp: 3000, crystals: 30 }
  },
  mage_scholar: {
    id: 'mage_scholar', name: '📖 Mage Scholar', category: 'Class',
    desc: 'Cast 200 magic skills', condition: { type: 'magic_skill_use', count: 200 },
    reward: { gold: 8000, xp: 2500, crystals: 25 }
  },
  shadow_step: {
    id: 'shadow_step', name: '🌑 Shadow Step', category: 'Class',
    desc: 'Land 50 critical hits as an Assassin', condition: { type: 'assassin_crits', count: 50 },
    reward: { gold: 8000, xp: 2500, crystals: 25 }
  },
  paladin_oath: {
    id: 'paladin_oath', name: '✝️ Paladin Oath', category: 'Class',
    desc: 'Heal 100,000 total HP', condition: { type: 'total_healed', count: 100000 },
    reward: { gold: 10000, xp: 3000, crystals: 30 }
  },
  death_lord: {
    id: 'death_lord', name: '💀 Death Lord', category: 'Class',
    desc: 'Drain 50,000 HP with lifesteal', condition: { type: 'total_lifesteal', count: 50000 },
    reward: { gold: 10000, xp: 3000, crystals: 30 }
  },
  no_skills_run: {
    id: 'no_skills_run', name: '👊 Raw Power', category: 'Combat',
    desc: 'Clear a dungeon using only basic attacks', condition: { type: 'dungeon_no_skill', count: 1 },
    reward: { gold: 5000, xp: 1500, crystals: 20 }
  },
  solo_dungeon: {
    id: 'solo_dungeon', name: '🦅 Lone Wolf', category: 'Dungeon',
    desc: 'Clear a dungeon solo (no party)', condition: { type: 'dungeon_solo', count: 1 },
    reward: { gold: 5000, xp: 1500, crystals: 20 }
  },
  full_party: {
    id: 'full_party', name: '🤝 Full Squad', category: 'Social',
    desc: 'Clear a dungeon with a full 4-person party', condition: { type: 'full_party_dungeon', count: 1 },
    reward: { gold: 5000, xp: 1500, crystals: 20 }
  },
  pvp_participate_50: {
    id: 'pvp_participate_50', name: '🥋 Battle Hardened', category: 'PvP',
    desc: 'Participate in 150 PvP battles', condition: { type: 'pvp_participate', count: 150 },
    reward: { gold: 8000, xp: 2000, crystals: 25 }
  },
  richer_than_rich: {
    id: 'richer_than_rich', name: '🏦 Bank Tycoon', category: 'Wealth',
    desc: 'Have 2,000,000 Nexus in the bank', condition: { type: 'bank_gold', count: 2000000 },
    reward: { gold: 25000, xp: 5000, crystals: 75 }
  },
  pet_happy: {
    id: 'pet_happy', name: '😄 Happy Pet', category: 'Pets',
    desc: 'Keep a pet at max happiness for 24 hours', condition: { type: 'pet_max_happiness', count: 1 },
    reward: { gold: 3000, xp: 800, crystals: 15 }
  },
  boss_rampage: {
    id: 'boss_rampage', name: '🌪️ Boss Rampage', category: 'Boss',
    desc: 'Kill 3 bosses in one day', condition: { type: 'boss_daily', count: 3 },
    reward: { gold: 10000, xp: 3000, crystals: 30 }
  },
  enchanted: {
    id: 'enchanted', name: '✨ Enchanted', category: 'Equipment',
    desc: 'Equip a Legendary artifact', condition: { type: 'equip_legendary_artifact', count: 1 },
    reward: { gold: 15000, xp: 4000, crystals: 60 }
  },
  skill_variety: {
    id: 'skill_variety', name: '🎭 Versatile', category: 'Skills',
    desc: 'Use 5 different skills in one dungeon', condition: { type: 'skill_variety', count: 5 },
    reward: { gold: 5000, xp: 1500, crystals: 20 }
  },
  dungeon_100_rank_f: {
    id: 'dungeon_100_rank_f', name: '🌀 F-Rank Grinder', category: 'Dungeon',
    desc: 'Clear an F-rank dungeon 250 times', condition: { type: 'dungeon_rank_count', rank: 'F', count: 250 },
    reward: { gold: 10000, xp: 3000, crystals: 30 }
  },
  unstoppable_force: {
    id: 'unstoppable_force', name: '💥 Unstoppable Force', category: 'Combat',
    desc: 'Deal 1,000,000 total damage', condition: { type: 'total_damage', count: 1000000 },
    reward: { gold: 30000, xp: 10000, crystals: 100 }
  },
  lucky_charm: {
    id: 'lucky_charm', name: '🍀 Lucky Charm', category: 'Casino',
    desc: 'Use 25 Luck Potions', condition: { type: 'luck_potions_used', count: 25 },
    reward: { gold: 5000, xp: 1000, crystals: 20 }
  },
  ancient_knowledge: {
    id: 'ancient_knowledge', name: '📚 Ancient Knowledge', category: 'Upgrades',
    desc: 'Max out any stat allocation', condition: { type: 'stat_maxed', count: 1 },
    reward: { gold: 10000, xp: 3000, crystals: 40 }
  },
  rising_star: {
    id: 'rising_star', name: '⭐ Rising Star', category: 'Growth',
    desc: 'Level up 10 times in one day', condition: { type: 'daily_levelups', count: 10 },
    reward: { gold: 5000, xp: 0, crystals: 25 }
  },
  elite_catch: {
    id: 'elite_catch', name: '🎯 Elite Catcher', category: 'Pets',
    desc: 'Catch an Epic or higher pet', condition: { type: 'pet_rarity', rarity: 'epic', count: 1 },
    reward: { gold: 15000, xp: 4000, crystals: 60 }
  },
  dungeon_streak: {
    id: 'dungeon_streak', name: '🔗 Dungeon Streak', category: 'Dungeon',
    desc: 'Clear 5 dungeons in a row without dying', condition: { type: 'dungeon_no_death', count: 5 },
    reward: { gold: 15000, xp: 5000, crystals: 60 }
  },
  boss_no_heal: {
    id: 'boss_no_heal', name: '🩸 Bloodied But Unbroken', category: 'Boss',
    desc: 'Defeat a boss without using any potions', condition: { type: 'boss_no_potion', count: 1 },
    reward: { gold: 8000, xp: 2500, crystals: 30 }
  },
  legendary_pet_bond: {
    id: 'legendary_pet_bond', name: '💞 Unbreakable Bond', category: 'Pets',
    desc: 'Reach 100 bonding with a Legendary pet', condition: { type: 'legendary_pet_bond', count: 100 },
    reward: { gold: 20000, xp: 8000, crystals: 100 }
  },
  true_hunter: {
    id: 'true_hunter', name: '🏹 True Hunter', category: 'Milestones',
    desc: 'Complete all main story quests', condition: { type: 'story_complete', count: 1 },
    reward: { gold: 100000, xp: 50000, crystals: 500 }
  },
  speedster: {
    id: 'speedster', name: '💨 Speedster', category: 'Combat',
    desc: 'Max out speed stat to 100', condition: { type: 'stat_value', stat: 'speed', count: 100 },
    reward: { gold: 8000, xp: 2000, crystals: 30 }
  },
  brutal_efficiency: {
    id: 'brutal_efficiency', name: '⚡ Brutal Efficiency', category: 'Combat',
    desc: 'Kill a monster in a single hit', condition: { type: 'one_shot', count: 1 },
    reward: { gold: 3000, xp: 800, crystals: 10 }
  },
  tank_build: {
    id: 'tank_build', name: '🏋️ Tank Build', category: 'Upgrades',
    desc: 'Allocate 100 points to HP', condition: { type: 'hp_allocated', count: 100 },
    reward: { gold: 5000, xp: 1500, crystals: 20 }
  },
  glass_cannon: {
    id: 'glass_cannon', name: '💣 Glass Cannon', category: 'Upgrades',
    desc: 'Allocate 100 points to ATK', condition: { type: 'atk_allocated', count: 100 },
    reward: { gold: 5000, xp: 1500, crystals: 20 }
  },
  energy_reservoir: {
    id: 'energy_reservoir', name: '⚡ Energy Reservoir', category: 'Upgrades',
    desc: 'Allocate 50 points to Energy', condition: { type: 'energy_allocated', count: 50 },
    reward: { gold: 5000, xp: 1500, crystals: 20 }
  },
  pet_army: {
    id: 'pet_army', name: '🐾 Pet Army', category: 'Pets',
    desc: 'Have 30 pets in your collection', condition: { type: 'pets_owned', count: 30 },
    reward: { gold: 20000, xp: 5000, crystals: 75 }
  },
  dungeon_clear_b: {
    id: 'dungeon_clear_b', name: '🔥 B-Rank Breaker', category: 'Dungeon',
    desc: 'Clear a B-rank dungeon', condition: { type: 'dungeon_rank', rank: 'B', count: 1 },
    reward: { gold: 8000, xp: 2500, crystals: 30 }
  },
  boss_c_rank: {
    id: 'boss_c_rank', name: '🗡️ Raid Breaker', category: 'Boss',
    desc: 'Defeat a C-rank boss', condition: { type: 'boss_rank_kill', rank: 'C', count: 1 },
    reward: { gold: 5000, xp: 1500, crystals: 15 }
  },
  revived: {
    id: 'revived', name: '🔄 Second Chance', category: 'Survival',
    desc: 'Be revived in a dungeon', condition: { type: 'times_revived', count: 1 },
    reward: { gold: 1000, xp: 300, crystals: 5 }
  },
  casino_100_bets: {
    id: 'casino_100_bets', name: '🎲 High Roller', category: 'Casino',
    desc: 'Place 250 casino bets', condition: { type: 'casino_bets', count: 250 },
    reward: { gold: 5000, xp: 1000, crystals: 15 }
  },
  quest_daily_30: {
    id: 'quest_daily_30', name: '📆 Monthly Grind', category: 'Quests',
    desc: 'Complete 60 daily quests', condition: { type: 'daily_quests', count: 60 },
    reward: { gold: 15000, xp: 5000, crystals: 60 }
  },
  level_200: {
    id: 'level_200', name: '🌌 National Level', category: 'Growth',
    desc: 'Reach Level 250', condition: { type: 'level', count: 250 },
    reward: { gold: 500000, xp: 0, crystals: 1000 }
  },
  first_bank: {
    id: 'first_bank', name: '🏦 Account Holder', category: 'Wealth',
    desc: 'Make your first bank deposit', condition: { type: 'bank_deposit', count: 1 },
    reward: { gold: 500, xp: 100, crystals: 0 }
  },
  crystal_spender: {
    id: 'crystal_spender', name: '💎 Mana Stone Spender', category: 'Wealth',
    desc: 'Spend 500 Mana Stones', condition: { type: 'crystals_spent', count: 500 },
    reward: { gold: 10000, xp: 2000, crystals: 50 }
  },
  void_touched: {
    id: 'void_touched', name: '🌑 Void Touched', category: 'Boss',
    desc: 'Defeat an SS-rank boss', condition: { type: 'boss_rank_kill', rank: 'SS', count: 1 },
    reward: { gold: 60000, xp: 20000, crystals: 200 }
  },
  national_threat: {
    id: 'national_threat', name: '🌍 National Threat', category: 'Boss',
    desc: 'Defeat a National-rank boss', condition: { type: 'boss_rank_kill', rank: 'National', count: 1 },
    reward: { gold: 80000, xp: 25000, crystals: 250 }
  },
  phantom_catcher: {
    id: 'phantom_catcher', name: '👻 Phantom Catcher', category: 'Pets',
    desc: 'Catch a Mythic rarity pet', condition: { type: 'pet_rarity', rarity: 'mythic', count: 1 },
    reward: { gold: 100000, xp: 30000, crystals: 300 }
  }
};

const ACHIEVEMENT_CATEGORIES = ['Combat', 'Dungeon', 'Boss', 'PvP', 'Growth', 'Wealth', 'Pets', 'Skills', 'Quests', 'Exploration', 'Equipment', 'Social', 'Casino', 'Survival', 'Upgrades', 'Milestones', 'Class'];

module.exports = { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES };