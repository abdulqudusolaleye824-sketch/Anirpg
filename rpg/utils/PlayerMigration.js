// ── Fix skills for existing players — add locked skills they're missing ──
function migrateSkills(player) {
  try {
    const className = typeof player.class === 'string' ? player.class : player.class?.name;
    if (!className) return;
    
    const { classDefinitions } = require('../player/PlayerManager');
    const classDef = classDefinitions[className];
    if (!classDef?.skills) return;
    
    if (!player.skills) player.skills = { active: [], locked: [], library: [], passive: [] };
    if (!player.skills.active) player.skills.active = [];
    if (!player.skills.locked) player.skills.locked = [];
    if (!player.skills.library) player.skills.library = [];
    
    const playerLevel = player.level || 1;
    
    for (const skill of classDef.skills) {
      const unlockLevel = skill.unlocksAtLevel || 1;
      const hasSkill = 
        player.skills.active.some(s => s.name === skill.name) ||
        player.skills.library.some(s => s.name === skill.name) ||
        player.skills.locked.some(s => s.name === skill.name);
      
      if (!hasSkill) {
        if (unlockLevel <= playerLevel) {
          // Player should have this skill already — add to library
          player.skills.library.push({...skill});
        } else {
          // Not unlocked yet — add to locked
          player.skills.locked.push({...skill});
        }
      }
    }
  } catch(e) {
    // Silent fail
  }
}
const PlayerManager = require('../player/PlayerManager');

function migratePlayer(player) {
  if (!player) {
    console.error('⚠️ Attempted to migrate null/undefined player');
    return null;
  }

  // Defensive: player.class may be either a string (active code path:
  // `LevelUpManager` sets `player.class = className`) or an object with
  // a .name property (legacy format). Handle both.
  const className = typeof player.class === 'string'
    ? player.class
    : (player.class && player.class.name);
  if (!className) {
    console.error(`⚠️ Player ${player.name || 'Unknown'} has no class defined`);
    return player;
  }
  // Normalize player.class into the legacy object form so the rest of
  // this migration function (which reads .name) keeps working.
  if (typeof player.class === 'string') {
    player.class = { name: player.class };
  }

  if (!player.stats) {
    console.error(`⚠️ Player ${player.name || 'Unknown'} has no stats object`);
    player.stats = {
      hp: 100,
      maxHp: 100,
      atk: 10,
      def: 5,
      energy: 100,
      maxEnergy: 100
    };
  }

  // Always ensure these fields exist regardless of migration state
  if (player.pvpElo    === undefined) player.pvpElo    = 1000;
  if (player.pvpWins   === undefined) player.pvpWins   = 0;
  if (player.pvpLosses === undefined) player.pvpLosses = 0;
  if (player.pvpStreak === undefined) player.pvpStreak = 0;
  if (!Array.isArray(player.titles))  player.titles    = [];
  if (!player.battlePass)             player.battlePass = null;
  if (!player.bannerState)            player.bannerState = {};
  if (!player.summonArtifacts)        player.summonArtifacts = [];
  if (!player.summonWeapons)          player.summonWeapons = {};
  if (!player.dailyChallenges)        player.dailyChallenges = null;
  if (!player.constellations)         player.constellations = {};

  // If player already has energy system, apply artifacts and return
  if (player.energyType && player.stats.energy !== undefined && player.stats.maxEnergy !== undefined) {
    applyArtifacts(player);
    return player;
  }

  console.log(`Migrating player: ${player.name} (${player.class.name})`);

  const classDef = PlayerManager.classDefinitions[player.class.name];
  
  if (!classDef) {
    // Preserve divine/special classes even if not yet loaded — do not overwrite
    if (player.class.name === 'Senku') {
      console.log('Senku class detected — skipping migration fallback');
      return player;
    }
    console.error(`⚠️ Unknown class: ${player.class.name} - Using Warrior as fallback`);
    
    const fallbackClass = PlayerManager.classDefinitions['Warrior'];
    player.energyType = fallbackClass.energyType;
    player.energyColor = fallbackClass.energyColor;
    
    if (!player.stats.energy) {
      player.stats.energy = fallbackClass.baseStats.energy;
      player.stats.maxEnergy = fallbackClass.baseStats.maxEnergy;
    }
    
    applyArtifacts(player);
    return player;
  }

  player.energyType = classDef.energyType;
  player.energyColor = classDef.energyColor;

  // Fix energy stats
  if (player.stats.mana !== undefined) {
    player.stats.energy = player.stats.mana;
    player.stats.maxEnergy = player.stats.maxMana;
    delete player.stats.mana;
    delete player.stats.maxMana;
  } else if (player.stats.energy === undefined) {
    player.stats.energy = classDef.baseStats.energy;
    player.stats.maxEnergy = classDef.baseStats.maxEnergy;
  }

  // Fix skills
  if (player.skills && player.skills.active) {
    player.skills.active = player.skills.active.map(skill => {
      const classSkill = classDef.skills.find(s => s.name === skill.name);
      
      if (classSkill) {
        return {
          ...skill,
          energyCost: classSkill.energyCost || skill.manaCost || 10,
          cooldown: classSkill.cooldown || 10
        };
      }
      
      return {
        ...skill,
        energyCost: skill.energyCost || skill.manaCost || 10,
        cooldown: skill.cooldown || 10
      };
    });
  }

  // Initialize missing properties
  if (!player.skillCooldowns) player.skillCooldowns = {};
  if (!player.lastSkillUse) player.lastSkillUse = {};
  if (!player.statusEffects) player.statusEffects = [];
  if (!player.comboCount) player.comboCount = 0;

  // PvP stats already set above
  if (!player.inventory) {
    player.inventory = {
      healthPotions: 3,
      manaPotions: 2,
      energyPotions: 0,
      reviveTokens: 0
    };
  }
  if (!player.bonuses) player.bonuses = {};

  // ✅ NEW: Apply all artifact bonuses
  applyArtifacts(player);

  console.log(`✅ Migrated ${player.name}: ${player.energyType} (${player.stats.energy}/${player.stats.maxEnergy})`);

  migrateSkills(player);
  return player;
}

// ✅ NEW: Apply all artifact stat bonuses
function applyArtifacts(player) {
  // ✅ NEW ARTIFACT SYSTEM - Initialize properly
  if (!player.artifacts) {
    player.artifacts = {
      inventory: [],
      equipped: {
        weapon: null,
        armor: null,
        helmet: null,
        gloves: null,
        ring: null,
        amulet: null,
        tome: null,
        boots: null
      }
    };
    return;
  }

  // ✅ Fix old format (array) to new format (object with inventory/equipped)
  if (Array.isArray(player.artifacts)) {
    const oldArtifacts = [...player.artifacts];
    player.artifacts = {
      inventory: [],
      equipped: {
        weapon: null,
        armor: null,
        helmet: null,
        gloves: null,
        ring: null,
        amulet: null,
        tome: null,
        boots: null
      }
    };
    
    // Move old artifacts to inventory (as names only)
    oldArtifacts.forEach(artifact => {
      if (artifact.name) {
        player.artifacts.inventory.push(artifact.name);
      }
    });
    
    console.log(`✅ Migrated ${oldArtifacts.length} artifacts to new system`);
    return;
  }

  // ✅ Make sure inventory exists and is an array
  if (!Array.isArray(player.artifacts.inventory)) {
    player.artifacts.inventory = [];
  }
  
  // ✅ Make sure equipped exists and is an object
  if (!player.artifacts.equipped || typeof player.artifacts.equipped !== 'object') {
    player.artifacts.equipped = {
      weapon: null,
      armor: null,
      helmet: null,
      gloves: null,
      ring: null,
      amulet: null,
      tome: null,
      boots: null
    };
  }
}

function migrateAllPlayers(db) {
  if (!db || !db.users) {
    console.error('⚠️ Database or users object is missing');
    return db;
  }

  let count = 0;
  let failed = 0;
  
  for (const userId in db.users) {
    try {
      const player = db.users[userId];
      const migratedPlayer = migratePlayer(player);
      
      if (migratedPlayer) {
        db.users[userId] = migratedPlayer;
        count++;
      } else {
        failed++;
        console.error(`⚠️ Failed to migrate player: ${userId}`);
      }
    } catch (error) {
      failed++;
      console.error(`⚠️ Error migrating player ${userId}:`, error.message);
    }
  }

  console.log(`✅ Migration complete: ${count} successful, ${failed} failed`);
  return db;
}

module.exports = {
  migratePlayer,
  migrateAllPlayers
};