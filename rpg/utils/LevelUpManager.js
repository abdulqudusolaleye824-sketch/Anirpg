// ═══════════════════════════════════════════════════════════════
// LEVEL UP MANAGER - Solo Leveling Edition
// ═══════════════════════════════════════════════════════════════

const SkillDescriptions = require('./SkillDescriptions');
const StatAllocationSystem = require('./StatAllocationSystem');
const { getXpRequired, checkClassAssignment, getStatPointsOnLevelUp, AWAKENING_RANKS } = require('./SoloLevelingCore');
const { AuraSystem } = require('./AuraSystem');

class LevelUpManager {
  static checkAndApplyLevelUps(player, saveDatabase, sock, chatId) {
    if (!player || !player.stats) {
      console.error('❌ Invalid player passed to checkAndApplyLevelUps');
      return { leveledUp: false, levelsGained: 0, newSkills: [] };
    }

    let levelsGained = 0;
    const newSkills = [];
    const skillUnlockLevels = [];
    let totalUPAwarded = 0;
    let classAssigned = null; // Track if a class was assigned this level-up

    while (true) {
      // ── SL XP FORMULA: ~1M XP to reach level 5, billions for level 50 ──
      const xpNeeded = getXpRequired(player.level);

      if (player.xp >= xpNeeded) {
        player.level++;
    
    // ── Unlock skills at certain levels ──────────────────────
    const locked = player.skills?.locked || [];
    const newlyUnlocked = [];
    for (const skill of locked) {
      if ((skill.unlocksAtLevel || 999) <= player.level) {
        newlyUnlocked.push(skill);
      }
    }
    if (newlyUnlocked.length > 0) {
      if (!player.skills.active) player.skills.active = [];
      for (const skill of newlyUnlocked) {
        player.skills.active.push({...skill});
        const idx = player.skills.locked.findIndex(s => s.name === skill.name);
        if (idx >= 0) player.skills.locked.splice(idx, 1);
      }
      if (!player._newSkillsUnlocked) player._newSkillsUnlocked = [];
      player._newSkillsUnlocked.push(...newlyUnlocked.map(s => s.name));
    }
        player.xp -= xpNeeded;

        // Increase stats — write to BOTH stats and baseStats so that
        // applyAllocationsToStats() (called by /upgrade) doesn't overwrite these gains.
        // baseStats is the "floor" that allocations are added on top of.
        if (!player.baseStats) {
          player.baseStats = {
            hp:         player.stats.maxHp    || 100,
            atk:        player.stats.atk      || 10,
            def:        player.stats.def      || 5,
            magicPower: player.stats.magicPower || 0,
            speed:      player.stats.speed    || 100,
            critChance: player.stats.critChance || 0,
            critDamage: player.stats.critDamage || 0,
            lifesteal:  player.stats.lifesteal  || 0,
            maxEnergy:  player.stats.maxEnergy  || 100
          };
        }

        // ── Rank-based stat gains per level ──────────────────────
        const rank = player.awakenRank || 'E';
        const rankMult = { E:1.0, D:1.1, C:1.2, B:1.35, A:1.55, S:1.8 }[rank] || 1.0;
        const hpGain     = Math.floor(10 * rankMult);
        const atkGain    = Math.floor(3  * rankMult);
        const defGain    = Math.floor(2  * rankMult);
        const energyGain = Math.floor(5  * rankMult);

        player.stats.maxHp     += hpGain;
        player.stats.maxEnergy += energyGain;
        player.stats.atk       += atkGain;
        player.stats.def       += defGain;
        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + hpGain);
        player.stats.energy = Math.min(player.stats.maxEnergy, player.stats.energy + energyGain);

        player.baseStats.hp        = (player.baseStats.hp        || 0) + hpGain;
        player.baseStats.maxEnergy = (player.baseStats.maxEnergy  || 0) + energyGain;
        player.baseStats.atk       = (player.baseStats.atk        || 0) + atkGain;
        player.baseStats.def       = (player.baseStats.def        || 0) + defGain;

        levelsGained++;

        // ── Award upgrade points (rank-scaled) ───────────────────
        const upReward = StatAllocationSystem.awardUpgradePoints(player, 'levelUp');
        totalUPAwarded += upReward.awarded;

        // ── Check for class assignment (if no class yet) ──────────
        if (!player.class) {
          const assignedClass = checkClassAssignment(player);
          if (assignedClass) {
            player.class = assignedClass;
            player.classAssignedAt = Date.now();
            classAssigned = assignedClass;
            // Aura bonus for getting a class
            AuraSystem.addAura(player, 'classUnlock');

            // ✅ Apply the class's stat bonuses + skills to the player
            // (was previously defined but never called — players got a class
            //  NAME but never the actual benefits)
            try {
              const { applyClassToPlayer } = require('./ClassSystem');
              applyClassToPlayer(player, assignedClass);
            } catch (e) {
              console.warn('[SILENT] LevelUpManager: applyClassToPlayer failed:', e.message);
            }
          }
        }

        // Check for skill unlock at level 5, 10, 15, 20, 25, etc.
        if (player.level % 5 === 0) {
          try {
            const unlockedSkill = this.unlockSkillForLevel(player, player.level);
            if (unlockedSkill) {
              newSkills.push(unlockedSkill);
              skillUnlockLevels.push(player.level);
            }
          } catch (error) {
            console.error('❌ Error unlocking skill:', error.message);
          }
        }
        // Skill specialization choice at levels 20, 40, 60, 80
        if ([20,40,60,80].includes(player.level)) {
          try {
            const SkillChoice = require('../../commands/rpg/skillchoice');
            SkillChoice.triggerSkillChoice(player, player.level);
          } catch(e) { console.error('SkillChoice error:', e.message); }
        }
      } else {
        break;
      }
    }

    if (levelsGained > 0) {
      if (saveDatabase) saveDatabase();
      console.log(`✨ ${player.name} leveled up ${levelsGained} time(s) to Level ${player.level}`);
      
      if (sock && chatId) {
        this.sendLevelUpNotification(player, levelsGained, newSkills, skillUnlockLevels, totalUPAwarded, classAssigned, sock, chatId);

        // ── Milestone group announcements ────────────────────────
        const MILESTONES = [10, 25, 50, 75, 100];
        const hitMilestone = MILESTONES.find(m => player.level >= m && player.level - levelsGained < m);
        if (hitMilestone && chatId.endsWith('@g.us')) {
          const milestoneEmojis = { 10:'🌱', 25:'⚡', 50:'🔥', 75:'💎', 100:'👑' };
          const cls = player.class || 'Unawakened';
          const rank = player.awakenRank || 'E';
          const rankData = AWAKENING_RANKS[rank];
          try {
            const { calculatePowerRating } = require('./SoloLevelingCore');
            sock.sendMessage(chatId, {
              text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${milestoneEmojis[hitMilestone]} *LEVEL MILESTONE!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🎉 *${player.name}* [${rankData?.emoji || ''} ${rank}-Rank | ${cls}]\nhas reached *Level ${hitMilestone}!*\n\n⚡ Power: ${calculatePowerRating(player.stats || {}).toLocaleString()}\n✨ Aura: ${(player.aura || 0).toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
            });
          } catch(e) { console.warn('[SILENT] LevelUpManager: milestone send failed:', e.message); }
        }
      }
    }

    return {
      leveledUp: levelsGained > 0,
      levelsGained,
      newSkills,
      upgradePointsAwarded: totalUPAwarded,
      classAssigned,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // UNLOCK SKILL - Uses SkillDescriptions.js for complete data
  // ═══════════════════════════════════════════════════════════════
  static unlockSkillForLevel(player, level) {
    const className = typeof player.class === 'object' ? player.class.name : player.class;
    
    // Skill unlock schedule: Which skill unlocks at which level
    const skillUnlockSchedule = {
      Mage: {
        5: 'Fireball',
        10: 'Ice Shard',
        15: 'Lightning Bolt',
        20: 'Meteor Strike',
        25: 'Blizzard',
        30: 'Chain Lightning',
        35: 'Time Stop',
        40: 'Arcane Blast',
        45: 'Meteor Storm',
        50: 'Time Warp',
        55: 'Arcane Explosion',
        60: 'Gravity Well',
        65: 'Elemental Fury',
        70: 'Void Collapse',
        75: 'Mana Overload',
        80: 'Cosmic Ray',
        85: 'Temporal Rift',
        90: 'Omega Spell'
      },
      Warrior: {
        5: 'Power Strike',
        10: 'Shield Bash',
        15: 'Battle Shout',
        20: 'Whirlwind',
        25: 'Earthquake',
        30: 'Execute',
        35: 'Last Stand',
        40: 'Titan Slam',
        45: 'War Cry',
        50: 'Iron Wall',
        55: 'Bladestorm',
        60: 'Juggernaut',
        65: 'Ancestral Rage',
        70: 'Mountain Breaker',
        75: 'Battle Trance',
        80: 'Warlord Command',
        85: 'Colossus Strike',
        90: 'Apocalypse Strike'
      },
      Assassin: {
        5: 'Backstab',
        10: 'Poison Blade',
        15: 'Shadow Step',
        20: 'Lethal Strike',
        25: 'Death Mark',
        30: 'Shadow Strike',
        35: 'Assassination',
        40: 'Void Strike',
        45: 'Throat Slit',
        50: 'Vanishing Act',
        55: 'Poison Gas',
        60: 'Shadow Step Mastery',
        65: 'Deadly Dance',
        70: 'Nightmare',
        75: 'Perfect Assassination',
        80: 'Shadow Realm',
        85: "Reaper's Mark",
        90: 'Final Cut'
      },
      Rogue: {
        5: 'Backstab', 10: 'Poison Blade', 15: 'Shadow Step', 20: 'Lethal Strike',
        25: 'Death Mark', 30: 'Shadow Strike', 35: 'Assassination', 40: 'Void Strike',
        45: 'Throat Slit', 50: 'Vanishing Act', 55: 'Poison Gas', 60: 'Shadow Step Mastery',
        65: 'Deadly Dance', 70: 'Nightmare Blade', 75: 'Perfect Strike', 80: 'Shadow Realm',
        85: "Rogue's End", 90: 'Final Cut'
      },
      Necromancer: {
        5: 'Life Drain',
        10: 'Bone Spear',
        15: 'Summon Undead',
        20: 'Corpse Explosion',
        25: 'Death Coil',
        30: 'Soul Harvest',
        35: 'Army of the Dead',
        40: 'Lich Form',
        45: 'Plague Lord',
        50: 'Soul Reap',
        55: 'Bone Prison',
        60: 'Zombify',
        65: 'Death Bolt',
        70: 'Lich Lord',
        75: 'Mass Resurrection',
        80: 'Soul Link',
        85: 'Reaper Call',
        90: 'Necrotic Apocalypse'
      },
      Paladin: {
        5: 'Holy Strike',
        10: 'Divine Shield',
        15: 'Smite',
        20: 'Consecration',
        25: 'Judgment',
        30: 'Holy Wrath',
        35: 'Divine Storm',
        40: 'Avenging Wrath',
        45: 'Angelic Descent',
        50: 'Righteous Fury',
        55: 'Sacred Ground',
        60: 'Divine Protection',
        65: 'Hammer Strike',
        70: 'Lay on Hands',
        75: 'Crusader Strike',
        80: 'Blessing of Kings',
        85: 'Exorcism',
        90: 'Divine Judgment'
      },
      Knight: {
        5: 'Holy Strike',
        10: 'Divine Shield',
        15: 'Smite',
        20: 'Consecration',
        25: 'Judgment',
        30: 'Holy Wrath',
        35: 'Divine Storm',
        40: 'Avenging Wrath'
      },
      Devourer: {
        5: 'Devour',
        10: 'Hungering Strike',
        15: 'Void Maw',
        20: 'Blood Feast',
        25: 'Adaptive Evolution',
        30: 'Feast',
        35: 'Soul Devour',
        40: 'Cataclysmic Devour',
        45: 'Blood Rage',
        50: 'Consume All',
        55: 'Crimson Tide',
        60: 'Hemorrhage',
        65: 'Cannibalize',
        70: 'Vampiric Aura',
        75: 'Bloodlust Max',
        80: 'Devour Soul',
        85: 'Blood Pact',
        90: 'Abyssal Hunger'
      },
      Archer: {
        5: 'Multi-Shot',
        10: 'Explosive Arrow',
        15: 'Poison Arrow',
        20: 'Rapid Fire',
        25: 'Sniper Shot',
        30: 'Piercing Shot',
        35: 'Eagle Eye',
        40: 'Volley',
        45: 'Arrow Storm',
        50: 'Lightning Arrow',
        55: 'Frost Volley',
        60: 'Perfect Shot',
        65: 'Phantom Arrow',
        70: 'Flame Volley',
        75: 'True Shot',
        80: 'Death Arrow',
        85: 'Barrage',
        90: 'Deadeye'
      },
      Berserker: {
        5: 'Rampage',
        10: 'Bloodlust',
        15: 'Wild Fury',
        20: 'Savage Roar',
        25: 'Reckless Assault',
        30: 'Blood Rage',
        35: 'Berserk',
        40: 'Crushing Blow',
        45: 'Rage Incarnate',
        50: 'Blood Frenzy',
        55: 'Rampage Max',
        60: 'Primal Rage',
        65: 'Death or Glory',
        70: 'Unstoppable',
        75: 'Last Stand Max',
        80: 'Savage Might',
        85: 'Feral Rage',
        90: 'Titan Wrath'
      },
      // Healer — pure support, all skills are heal/buff (zero damage)
      Healer: {
        5:  'Healing Light',
        10: 'Purify',
        15: 'Renew',
        20: 'Sanctuary',
        25: 'Blessed Shield',
        30: 'Mana Spring',
        35: 'Aura of Light',
        40: 'Divine Grace',
        45: 'Mass Renewal',
        50: 'Rebirth',
        55: 'Sanctuary Mastery',
        60: 'Light of Dawn',
        65: 'Grace Unending',
        70: 'Miracle',
        75: 'Resurrection',
        80: 'Solar Brilliance',
        85: 'World Heal',
        90: 'Transcendent Light'
      },
      DragonKnight: {
        5: 'Dragon Breath',
        10: 'Dragon Claw',
        15: 'Flame Breath',
        20: 'Wing Buffet',
        25: 'Dragon Slash',
        30: 'Dragon Roar',
        35: 'Tail Sweep',
        40: 'Dragon Ascension',
        45: 'Dragon Heart',
        50: 'Meteor Dive',
        55: 'Elder Dragon',
        60: 'Dragon Scale',
        65: 'Flame Nova',
        70: 'Dragon Fury',
        75: 'Sky Render',
        80: 'Dragon Lord',
        85: 'Inferno Cannon',
        90: 'Apocalyptic Flame'
      },
      Tank: {
        5: 'Shield Bash',
        10: 'Power Strike',
        15: 'Whirlwind',
        20: 'Battle Shout',
        25: 'Earthquake',
        30: 'Execute',
        35: 'Last Stand',
        40: 'Titan Slam'
      },
      Monk: {
        5: 'Rapid Strikes', 10: 'Chi Burst', 15: 'Iron Body', 20: 'Dragon Kick',
        25: 'Pressure Point', 30: 'Wind Walk', 35: 'Thousand Palms', 40: 'Enlightenment',
        45: 'Soul Fist', 50: 'Final Form', 55: 'Chi Wave', 60: 'Iron Fist Mastery',
        65: 'Wind Dragon', 70: 'Soul Shatter', 75: 'One Punch', 80: 'Transcendent Form',
        85: 'Limitless', 90: 'Martial Godhood'
      },
      Shaman: {
        5: 'Hex Bolt', 10: 'Serpent Totem', 15: 'Spirit Shield', 20: 'Rain of Frogs',
        25: 'Earthquake', 30: 'Soul Link', 35: 'Corruption', 40: "Ancestor's Wrath",
        45: "Nature's Fury", 50: 'Spirit Ascension', 55: 'Blood Moon', 60: 'Storm Call',
        65: 'Death Hex', 70: 'Void Curse', 75: 'Spirit Cannon', 80: 'World Tree',
        85: 'Elder Shaman', 90: 'God of Nature'
      },
      BloodKnight: {
        5: 'Blood Drain', 10: 'Crimson Strike', 15: 'Vampiric Aura', 20: 'Hemorrhage',
        25: 'Blood Frenzy', 30: 'Death Coil', 35: 'Sanguine Burst', 40: 'Bloodbath',
        45: 'Lifestealer', 50: 'Crimson Apocalypse', 55: 'Blood Nova', 60: 'Dark Feast',
        65: 'Eternal Hunger', 70: 'Sanguine God', 75: 'Blood World', 80: 'Hemomancer',
        85: 'Scarlet Reaper', 90: 'Vampire Lord'
      },
      SpellBlade: {
        5: 'Spellstrike', 10: 'Arcane Slash', 15: 'Runic Ward', 20: 'Blade Storm',
        25: 'Arcane Surge', 30: 'Runic Explosion', 35: 'Void Edge', 40: 'Arcane Overcharge',
        45: 'Spellblade Finale', 50: 'Mythril Onslaught', 55: 'Arcane Infusion', 60: 'Runic Mastery',
        65: 'Void Blade', 70: 'Arcane Singularity', 75: 'Runic God', 80: 'Magic Swordmaster',
        85: 'Arcane Transcendence', 90: 'Spellblade Omega'
      },
      Summoner: {
        5: 'Summon Wraith', 10: 'Void Pact', 15: 'Summon Drake', 20: 'Soul Army',
        25: 'Void Rift', 30: "Leviathan's Grasp", 35: 'Arcane Familiar', 40: 'Legion Rise',
        45: 'Elder God Pact', 50: 'Apocalypse Summon', 55: 'Gate of Summons', 60: 'Void Army',
        65: 'Elder Dragon', 70: 'Cosmos Rift', 75: 'Reality Tear', 80: 'God Summon',
        85: 'Infinite Legion', 90: 'Summoner Omega'
      },
      Elementalist: {
        5: 'Fire Bolt', 10: 'Ice Shard', 15: 'Lightning Strike', 20: 'Earth Slam',
        25: 'Water Wave', 30: 'Flame Burst', 35: 'Blizzard', 40: 'Thunder God',
        45: 'Magma Prison', 50: 'Tsunami', 55: 'Storm of Ages', 60: 'Primordial Fire',
        65: 'Eternal Ice', 70: 'World Thunder', 75: 'Element Master', 80: 'Elemental Fusion',
        85: 'Omega Element', 90: 'Elemental God'
      },
      Knight: {
        5: 'Shield Bash', 10: 'Charge', 15: 'Taunt', 20: 'Guardian Strike',
        25: 'Holy Slash', 30: 'Iron Defense', 35: 'Champion Charge', 40: 'Divine Shield',
        45: 'Sword of Justice', 50: 'Indomitable', 55: 'Holy Blade', 60: 'Aegis Strike',
        65: 'Knight Oath', 70: 'Champion Burst', 75: 'Holy Judgement', 80: 'Undying Knight',
        85: 'Knight of God', 90: 'Excalibur Omega'
      },
      Ranger: {
        5: 'Aimed Shot', 10: 'Rapid Fire', 15: 'Trap', 20: 'Eagle Eye Strike',
        25: 'Explosive Arrow', 30: 'Volley', 35: 'Hunter Mark', 40: 'Shadow Arrow',
        45: 'Storm Arrow', 50: 'Death Arrow', 55: 'Predator Shot', 60: 'Void Arrow',
        65: 'Ranger Omega', 70: 'Godslayer Shot', 75: 'True Aim', 80: 'Starfall Arrow',
        85: 'Absolute Shot', 90: 'Ranger God'
      },
      Chronomancer: {
        5: 'Time Slow', 10: 'Rewind', 15: 'Temporal Strike', 20: 'Time Lock',
        25: 'Clock Stop', 30: 'Age Accelerate', 35: 'Time Rift', 40: 'Paradox',
        45: 'Time Shatter', 50: 'Omega Clock', 55: 'Eternal Loop', 60: 'Time God',
        65: 'Reality Reset', 70: 'Chrono Burst', 75: 'Epoch End', 80: 'Timeline Erase',
        85: 'Time Omega', 90: 'Chronomancer God'
      },
      Warlord: {
        5: 'War Cry', 10: 'Cleave', 15: 'Shield Wall', 20: 'Rallying Cry',
        25: 'Conqueror Strike', 30: 'Iron March', 35: 'Siege Breaker', 40: 'Warlord Smash',
        45: 'Army of One', 50: 'Conquest', 55: 'Dominion', 60: 'Tyrant Blow',
        65: 'World Breaker', 70: 'Total War', 75: 'Eternal Conquest', 80: 'Supreme Warlord',
        85: 'God of War', 90: 'Warlord Omega'
      },
      Elementalist: {
        5: 'Tidal Wave', 10: 'Inferno', 15: 'Thunderstrike', 20: 'Earthquake',
        25: 'Blizzard Storm', 30: 'Magma Burst', 35: 'Cyclone', 40: 'Void Element',
        45: 'Elemental Fusion', 50: 'Primal Chaos', 55: 'Storm of Ages', 60: 'Core Meltdown',
        65: 'World Shatter', 70: 'Elemental God', 75: 'Chaos Theory', 80: 'Eternal Storm',
        85: 'Element Omega', 90: 'Absolute Zero'
      },
      ShadowDancer: {
        5: 'Dance of Death', 10: 'Moonwalk', 15: 'Twilight Slash', 20: 'Eclipse Strike',
        25: 'Shadow Waltz', 30: 'Void Step', 35: 'Phantom Dance', 40: 'Death Rhythm',
        45: 'Eternal Dance', 50: 'Shadow Carnival', 55: 'Soul Dance', 60: 'Oblivion Step',
        65: 'Perfect Rhythm', 70: 'Shadow God', 75: 'Infinite Dance', 80: 'Reaper Dance',
        85: 'Chaos Step', 90: 'ShadowDancer Omega'
      },
      Chronomancer: {
        5: 'Time Slow', 10: 'Rewind', 15: 'Time Stop', 20: 'Temporal Shift',
        25: 'Future Sight', 30: 'Age Drain', 35: 'Paradox Strike', 40: 'Chrono Blast',
        45: 'Time Loop', 50: 'Temporal Collapse', 55: 'Age of Oblivion', 60: 'Time Shatter',
        65: 'Chrono God', 70: 'Epoch End', 75: 'Reality Reset', 80: 'Infinite Time',
        85: 'Omega Clock', 90: 'Time God'
      },
      Phantom: {
        5: 'Phase Strike', 10: 'Shadow Collapse', 15: 'Ghost Step', 20: 'Nightmare',
        25: 'Soul Pierce', 30: 'Void Walk', 35: 'Phantom Barrage', 40: "Oblivion's Touch",
        45: 'Death Realm', 50: 'Phantom Apocalypse', 55: 'Reality Breach', 60: 'Soul Consume',
        65: 'Void Ascension', 70: 'Phantom God', 75: 'Oblivion', 80: 'Death Incarnate',
        85: 'Void Emperor', 90: 'Phantom Omega'
      }
    };

    const schedule = skillUnlockSchedule[className];
    if (!schedule || !schedule[level]) {
      return null; // No skill at this level
    }

    const skillName = schedule[level];
    
    // ✅ GET FULL SKILL DATA FROM SKILLDESCRIPTIONS.JS
    const skillData = SkillDescriptions.getSkillDescription(className, skillName);
    
    if (!skillData) {
      console.error(`❌ Skill ${skillName} not found in SkillDescriptions for ${className}`);
      return null;
    }

    // Initialize arrays if needed
    if (!player.availableSkills) player.availableSkills = [];
    if (!player.skills) player.skills = { active: [], passive: [] };
    if (!player.skills.active) player.skills.active = [];
    
    // Check if already has this skill
    const alreadyHas = player.availableSkills.find(s => s.name === skillName) ||
                       player.skills.active.find(s => s.name === skillName);
    
    if (alreadyHas) {
      return null;
    }

    // ✅ CREATE SKILL WITH FULL DATA FROM SKILLDESCRIPTIONS
    const newSkill = {
      name: skillName,
      damage: this.calculateSkillDamage(skillName, level, className),
      energyCost: skillData.manaCost || skillData.energyCost || skillData.holyCost || skillData.hungerCost || skillData.rageCost || skillData.focusCost || 30,
      cooldown: skillData.cooldown || 3,
      level: 1,
      maxLevel: 5,
      unlockedAt: level,
      description: skillData.description,
      effect: skillData.effect,
      animation: skillData.animation
    };

    // ✅ AUTO-EQUIP if there's space (max 5 active skills)
    if (player.skills.active.length < 5) {
      player.skills.active.push(newSkill);
      console.log(`✅ Auto-equipped skill: ${skillName}`);
    } else {
      // Add to available if no space
      player.availableSkills.push(newSkill);
      console.log(`📚 Added to available skills: ${skillName}`);
    }

    return {
      name: skillName,
      damage: newSkill.damage,
      energyCost: newSkill.energyCost,
      cooldown: newSkill.cooldown
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // CALCULATE SKILL DAMAGE based on level
  // ═══════════════════════════════════════════════════════════════
  static calculateSkillDamage(skillName, playerLevel, className) {
    // Base damage scaling by skill tier
    // Strictly increasing damage by unlock tier
    // Each 5 levels = meaningfully stronger skill
    const baseDamage = {
      5:  28,   // First skills — basic
      10: 34,
      15: 40,
      20: 48,
      25: 56,
      30: 65,
      35: 74,
      40: 84,
      45: 94,
      50: 105,  // Mid-game power spike
      55: 116,
      60: 128,
      65: 141,
      70: 155,
      75: 170,  // Late-game
      80: 186,
      85: 203,
      90: 222   // Max tier — seriously powerful
    };

    const tier = Math.floor(playerLevel / 5) * 5;
    return baseDamage[tier] || 30;
  }

  // ═══════════════════════════════════════════════════════════════
  // GRANT MISSING SKILLS (For existing players)
  // ═══════════════════════════════════════════════════════════════
  static grantMissingSkills(player) {
    const currentLevel = player.level;
    
    if (!player.skills) player.skills = { active: [], passive: [] };
    if (!player.skills.active) player.skills.active = [];
    if (!player.availableSkills) player.availableSkills = [];

    let skillsGranted = 0;

    // Check every 5 levels up to current level
    for (let checkLevel = 5; checkLevel <= currentLevel; checkLevel += 5) {
      const skill = this.unlockSkillForLevel(player, checkLevel);
      if (skill) {
        skillsGranted++;
      }
    }

    return skillsGranted;
  }

  // ═══════════════════════════════════════════════════════════════
  // SEND LEVEL UP NOTIFICATION — Solo Leveling System style
  // ═══════════════════════════════════════════════════════════════
  static async sendLevelUpNotification(player, levelsGained, newSkills, skillUnlockLevels, totalUPAwarded, classAssigned, sock, chatId) {
    const rank = player.awakenRank || 'E';
    const rankData = AWAKENING_RANKS[rank];
    const rankMult = { E:1.0, D:1.1, C:1.2, B:1.35, A:1.55, S:1.8 }[rank] || 1.0;
    const hpGain  = Math.floor(10 * rankMult * levelsGained);
    const atkGain = Math.floor(3  * rankMult * levelsGained);
    const defGain = Math.floor(2  * rankMult * levelsGained);
    const engGain = Math.floor(5  * rankMult * levelsGained);

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `「System」 *LEVEL UP*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `${rankData?.emoji || '⚫'} *${player.name}* [${rank}-Rank]`,
      `⭐ Level *${player.level - levelsGained}* → *${player.level}*`,
      ``,
      `📊 *STAT INCREASES:*`,
      `❤️  HP:     +${hpGain}  → ${player.stats?.maxHp}`,
      `⚔️  ATK:    +${atkGain}  → ${player.stats?.atk}`,
      `🛡️  DEF:    +${defGain}  → ${player.stats?.def}`,
      `💙  Energy: +${engGain}  → ${player.stats?.maxEnergy}`,
      `📈  Upgrade Points: +${totalUPAwarded}`,
      ``,
    ];

    // Class assignment notification — the big moment
    if (classAssigned) {
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`‼️ *CLASS AWAKENING*`);
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`「System」 The system has recognized your path.`);
      lines.push(``);
      lines.push(`🎭 *${classAssigned}*`);
      lines.push(`Your class has been assigned.`);
      lines.push(`Skills will unlock as you level up.`);
      lines.push(`+200 ✨ Aura awarded.`);
      lines.push(``);
    }

    if (newSkills.length > 0) {
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`✨ *NEW SKILL UNLOCKED*`);
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      newSkills.forEach((skill, i) => {
        lines.push(`🔮 *${skill.name}*`);
        lines.push(`   💥 DMG: ${skill.damage}  |  💙 Cost: ${skill.energyCost}  |  ⏱ CD: ${skill.cooldown}s`);
      });
      lines.push(``);
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`💡 /upgrade — allocate your points`);
    if (!player.class) lines.push(`🎭 Keep leveling — your class awaits`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
      await sock.sendMessage(chatId, { text: lines.join('\n') });
    } catch (error) {
      console.error('❌ Failed to send level up notification:', error.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GET XP PROGRESS
  // ═══════════════════════════════════════════════════════════════
  static getXPProgress(player) {
    if (!player) return { current: 0, needed: 100, percent: 0 };
    const xpNeeded = getXpRequired(player.level || 1);
    const percent = Math.floor((player.xp / xpNeeded) * 100);
    return { current: player.xp, needed: xpNeeded, percent: Math.min(100, percent) };
  }
}

module.exports = LevelUpManager;