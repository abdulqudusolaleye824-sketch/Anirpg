class CombatSystem {
  static processStatusEffects(entity) {
    // ✅ SAFETY CHECK
    if (!entity || !entity.stats) {
      console.error('❌ CombatSystem: Invalid entity');
      return { message: '' };
    }

    if (!entity.statusEffects) {
      entity.statusEffects = [];
    }

    let message = '';
    const effectsToRemove = [];

    entity.statusEffects.forEach((effect, index) => {
      effect.duration--;

      switch (effect.type) {
        case 'burn':
          const burnDamage = effect.damage || Math.floor(entity.stats.maxHp * 0.05);
          entity.stats.hp -= burnDamage;
          message += `🔥 Burning! -${burnDamage} HP\n`;
          break;

        case 'poison':
          const poisonDamage = effect.damage || Math.floor(entity.stats.maxHp * 0.03);
          entity.stats.hp -= poisonDamage;
          message += `☠️ Poisoned! -${poisonDamage} HP\n`;
          break;

        case 'bleed':
          const bleedDamage = effect.damage || Math.floor(entity.stats.maxHp * 0.04);
          entity.stats.hp -= bleedDamage;
          message += `🩸 Bleeding! -${bleedDamage} HP\n`;
          break;

        case 'freeze':
          message += `❄️ Frozen! Cannot act!\n`;
          break;

        case 'stun':
          message += `⚡ Stunned! Cannot act!\n`;
          break;

        case 'curse':
          // Curse reduces DEF by 15%
          message += `💀 Cursed! (-15% DEF)\n`;
          break;

        case 'weakened':
          // Weakened reduces ATK
          message += `😰 Weakened! (-${effect.reduction || 15}% ATK)\n`;
          break;

        case 'slow':
          message += `🐌 Slowed! (-20% ATK)\n`;
          break;
      }

      if (effect.duration <= 0) {
        effectsToRemove.push(index);
        message += `✨ ${effect.type} wore off!\n`;
      }
    });

    // Remove expired effects
    effectsToRemove.reverse().forEach(index => {
      entity.statusEffects.splice(index, 1);
    });

    return { message };
  }

  static canAct(entity) {
    if (!entity || !entity.statusEffects) return true;
    
    return !entity.statusEffects.some(e => 
      e.type === 'freeze' || e.type === 'stun'
    );
  }

  static applyStatusEffect(entity, effectType, duration, extraData = {}) {
    if (!entity) return;
    
    if (!entity.statusEffects) {
      entity.statusEffects = [];
    }

    // Check if effect already exists - refresh duration instead
    const existing = entity.statusEffects.find(e => e.type === effectType);
    if (existing) {
      existing.duration = Math.max(existing.duration, duration);
      return;
    }

    entity.statusEffects.push({
      type: effectType,
      duration: duration,
      ...extraData
    });
  }

  static getEffectMultiplier(entity, statType) {
    if (!entity || !entity.statusEffects) return 1;

    let multiplier = 1;

    entity.statusEffects.forEach(effect => {
      if (statType === 'atk') {
        if (effect.type === 'weakened') {
          multiplier *= (1 - (effect.reduction || 15) / 100);
        }
        if (effect.type === 'slow') {
          multiplier *= 0.8; // 20% reduction
        }
      }
      
      if (statType === 'def') {
        if (effect.type === 'curse') {
          multiplier *= 0.85; // 15% reduction
        }
      }
    });

    return multiplier;
  }

  static checkCritical(player) {
    if (!player || !player.class) return false;

    let critChance = 0.1; // 10% base

    // Defensive: player.class can be a string (new format) or an object with .name (legacy)
    const className = typeof player.class === 'string' ? player.class : (player.class?.name || '');
    if (className === 'Rogue' || className === 'Assassin') {
      critChance = 0.25;
    }

    return Math.random() < critChance;
  }

  static checkDodge(player) {
    if (!player || !player.class) return false;

    let dodgeChance = 0.05; // 5% base

    const className = typeof player.class === 'string' ? player.class : (player.class?.name || '');
    if (className === 'Rogue' || className === 'Assassin') {
      dodgeChance = 0.2;
    }

    return Math.random() < dodgeChance;
  }

  static calculateCombo(player) {
    if (!player) return 0;
    
    if (!player.comboCount) {
      player.comboCount = 0;
    }

    player.comboCount++;

    if (player.comboCount >= 3) {
      return 0.2; // 20% bonus
    }

    return 0;
  }

  static resetCombo(player) {
    if (player) {
      player.comboCount = 0;
    }
  }

  // ✅ NEW: Comprehensive skill effect system!
  static applySkillEffect(skillName, player, monster, damage) {
    const effects = {
      // ═══════════════════════════════════════════════════════════════
      // NECROMANCER SKILLS
      // ═══════════════════════════════════════════════════════════════
      'Soul Drain': {
        execute: (player, monster, damage) => {
          // Drain 20% of enemy max HP as bonus damage
          const bonusDamage = Math.floor(monster.maxHp * 0.20);
          monster.hp -= bonusDamage;
          
          // Heal for total damage dealt
          const totalDamage = damage + bonusDamage;
          const healing = totalDamage;
          player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healing);
          
          // Reduce enemy ATK by 15% for 2 turns
          this.applyStatusEffect(monster, 'weakened', 2, { reduction: 15 });
          
          return {
            message: `💀 Soul drained! +${bonusDamage} bonus dmg, +${healing} HP healed\n👻 Enemy weakened!`,
            bonusDamage,
            healing
          };
        }
      },

      'Death Bolt': {
        execute: (player, monster, damage) => {
          // Heal 25% of damage dealt
          const healing = Math.floor(damage * 0.25);
          player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healing);
          
          // 30% chance to curse
          if (Math.random() < 0.3) {
            this.applyStatusEffect(monster, 'curse', 3);
            return {
              message: `💀 Death bolt strikes! +${healing} HP healed\n☠️ Enemy cursed!`,
              healing
            };
          }
          
          return {
            message: `💀 Death bolt strikes! +${healing} HP healed`,
            healing
          };
        }
      },

      'Life Tap': {
        execute: (player, monster, damage) => {
          // Sacrifice 20% HP, restore 50% max Mana
          const sacrifice = Math.floor(player.stats.maxHp * 0.20);
          player.stats.hp = Math.max(1, player.stats.hp - sacrifice);
          
          const manaRestore = Math.floor(player.stats.maxEnergy * 0.50);
          player.stats.energy = Math.min(player.stats.maxEnergy, player.stats.energy + manaRestore);
          
          return {
            message: `🩸 Life sacrificed! -${sacrifice} HP, +${manaRestore} ${player.energyType}`,
            sacrifice,
            manaRestore
          };
        }
      },

      // ═══════════════════════════════════════════════════════════════
      // DEVOURER SKILLS
      // ═══════════════════════════════════════════════════════════════
      'Soul Devour': {
        execute: (player, monster, damage) => {
          // Bonus damage = 20% enemy max HP
          const bonusDamage = Math.floor(monster.maxHp * 0.20);
          monster.hp -= bonusDamage;
          
          // Heal for ALL damage
          const totalDamage = damage + bonusDamage;
          player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + totalDamage);
          
          // Steal 10% of enemy stats for 3 turns (visual only)
          const statSteal = Math.floor(monster.atk * 0.10);
          
          return {
            message: `👹 Soul devoured! +${bonusDamage} bonus dmg\n💚 +${totalDamage} HP healed\n⚡ Stole ${statSteal} ATK!`,
            bonusDamage,
            healing: totalDamage
          };
        }
      },

      'Blood Feast': {
        execute: (player, monster, damage) => {
          // Heal 50% of damage
          const healing = Math.floor(damage * 0.50);
          player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healing);
          
          // Restore 15 Blood
          player.stats.energy = Math.min(player.stats.maxEnergy, player.stats.energy + 15);
          
          // +20% lifesteal for 2 turns (mark player)
          if (!player.tempBuffs) player.tempBuffs = {};
          player.tempBuffs.lifesteal = { bonus: 0.20, duration: 2 };
          
          return {
            message: `🩸 Blood feast! +${healing} HP, +15 Blood\n💪 Lifesteal increased!`,
            healing
          };
        }
      },

      'Dark Pulse': {
        execute: (player, monster, damage) => {
          // 20% chance to curse
          if (Math.random() < 0.20) {
            this.applyStatusEffect(monster, 'curse', 3);
            return {
              message: `💀 Dark pulse! Enemy cursed!`
            };
          }
          return { message: `💀 Dark pulse strikes!` };
        }
      },

      // ═══════════════════════════════════════════════════════════════
      // MAGE SKILLS
      // ═══════════════════════════════════════════════════════════════
      'Fireball': {
        execute: (player, monster, damage) => {
          // 50% chance to burn for 3 turns
          if (Math.random() < 0.50) {
            this.applyStatusEffect(monster, 'burn', 3, { damage: 10 });
            return {
              message: `🔥 Fireball ignites! Enemy burning!`
            };
          }
          return { message: `🔥 Fireball strikes!` };
        }
      },

      'Lightning Strike': {
        execute: (player, monster, damage) => {
          // 30% chance to stun for 1 turn
          if (Math.random() < 0.30) {
            this.applyStatusEffect(monster, 'stun', 1);
            return {
              message: `⚡ Lightning stuns the enemy!`
            };
          }
          return { message: `⚡ Lightning strikes!` };
        }
      },

      'Ice Shard': {
        execute: (player, monster, damage) => {
          const roll = Math.random();
          
          // 20% chance to freeze
          if (roll < 0.20) {
            this.applyStatusEffect(monster, 'freeze', 1);
            return {
              message: `❄️ Enemy frozen solid!`
            };
          }
          // 40% chance to slow
          else if (roll < 0.60) {
            this.applyStatusEffect(monster, 'slow', 2);
            return {
              message: `❄️ Enemy slowed!`
            };
          }
          
          return { message: `❄️ Ice shard pierces!` };
        }
      },

      'Meteor': {
        execute: (player, monster, damage) => {
          // Burn for 15 damage/turn
          this.applyStatusEffect(monster, 'burn', 3, { damage: 15 });
          return {
            message: `☄️ Meteor impact! Enemy burning fiercely!`
          };
        }
      },

      'Arcane Blast': {
        execute: (player, monster, damage) => {
          // Drains 10% enemy max HP
          const drain = Math.floor(monster.maxHp * 0.10);
          monster.hp -= drain;
          
          return {
            message: `💫 Arcane blast! +${drain} bonus damage!`,
            bonusDamage: drain
          };
        }
      },

      // ═══════════════════════════════════════════════════════════════
      // ASSASSIN/ROGUE SKILLS
      // ═══════════════════════════════════════════════════════════════
      'Assassinate': {
        execute: (player, monster, damage) => {
          // 40% instant kill if enemy below 30% HP
          if (monster.hp < monster.maxHp * 0.30 && Math.random() < 0.40) {
            const remainingHp = monster.hp;
            monster.hp = 0;
            return {
              message: `💀 EXECUTION! Instant kill! (${remainingHp} HP erased)`,
              instantKill: true,
              bonusDamage: remainingHp
            };
          }
          
          // Otherwise deals 500% damage (already in base damage)
          return {
            message: `🗡️ Assassination attempt!`
          };
        }
      },

      'Backstab': {
        execute: (player, monster, damage) => {
          // Apply bleed
          this.applyStatusEffect(monster, 'bleed', 4, { damage: 8 });
          
          return {
            message: `🗡️ Backstab! Enemy bleeding!`
          };
        }
      },

      'Poison Blade': {
        execute: (player, monster, damage) => {
          // Poison for 5 turns
          this.applyStatusEffect(monster, 'poison', 5, { damage: 15 });
          
          return {
            message: `☠️ Poison applied! Healing reduced 50%!`
          };
        }
      },

      'Shadow Step': {
        execute: (player, monster, damage) => {
          // Dodge all attacks for 1 turn
          if (!player.tempBuffs) player.tempBuffs = {};
          player.tempBuffs.dodge = { bonus: 1.0, duration: 1 };
          
          return {
            message: `🌑 Vanished into shadows! Untargetable for 1 turn!`
          };
        }
      },

      // ═══════════════════════════════════════════════════════════════
      // BERSERKER SKILLS
      // ═══════════════════════════════════════════════════════════════
      'Bloodlust': {
        execute: (player, monster, damage) => {
          // Heal 15% of damage dealt
          const healing = Math.floor(damage * 0.15);
          player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healing);
          
          if (!player.tempBuffs) player.tempBuffs = {};
          player.tempBuffs.atk = { bonus: 0.50, duration: 3 };
          
          return {
            message: `🩸 Bloodlust! +${healing} HP, +50% ATK for 3 turns!`,
            healing
          };
        }
      },

      'Execution': {
        execute: (player, monster, damage) => {
          // 70% instant kill if enemy below 20% HP
          if (monster.hp < monster.maxHp * 0.20 && Math.random() < 0.70) {
            const remainingHp = monster.hp;
            monster.hp = 0;
            
            // Heal 30% max HP on kill
            const healing = Math.floor(player.stats.maxHp * 0.30);
            player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healing);
            
            return {
              message: `🪓 EXECUTED! +${healing} HP healed!`,
              instantKill: true,
              healing,
              bonusDamage: remainingHp
            };
          }
          
          return {
            message: `🪓 Execution swing!`
          };
        }
      },

      // ═══════════════════════════════════════════════════════════════
      // PALADIN SKILLS
      // ═══════════════════════════════════════════════════════════════
      'Holy Strike': {
        execute: (player, monster, damage) => {
          // Heal nearby allies 10% of damage
          const healing = Math.floor(damage * 0.10);
          player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healing);
          
          return {
            message: `✨ Holy strike! +${healing} HP healed!`,
            healing
          };
        }
      },

      'Judgment': {
        execute: (player, monster, damage) => {
          // 50% chance to stun
          if (Math.random() < 0.50) {
            this.applyStatusEffect(monster, 'stun', 1);
            return {
              message: `⚖️ Divine judgment! Enemy stunned!`
            };
          }
          
          return {
            message: `⚖️ Divine judgment strikes!`
          };
        }
      },

      'Lay on Hands': {
        execute: (player, monster, damage) => {
          // Heal 50% max HP
          const healing = Math.floor(player.stats.maxHp * 0.50);
          player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healing);
          
          // Remove all debuffs
          if (player.statusEffects) {
            player.statusEffects = player.statusEffects.filter(e => 
              !['burn', 'poison', 'bleed', 'curse', 'weakened', 'slow'].includes(e.type)
            );
          }
          
          return {
            message: `🙏 Divine healing! +${healing} HP! Debuffs removed!`,
            healing
          };
        }
      },

      // ═══════════════════════════════════════════════════════════════
      // DRAGON KNIGHT SKILLS
      // ═══════════════════════════════════════════════════════════════
      'Dragon Breath': {
        execute: (player, monster, damage) => {
          // 70% chance to burn
          if (Math.random() < 0.70) {
            this.applyStatusEffect(monster, 'burn', 3, { damage: 15 });
            return {
              message: `🐉 Dragon breath! Enemy burning!`
            };
          }
          
          return {
            message: `🐉 Dragon breath scorches!`
          };
        }
      },

      'Dragon Roar': {
        execute: (player, monster, damage) => {
          // Reduce enemy ATK by 30% for 2 turns
          this.applyStatusEffect(monster, 'weakened', 2, { reduction: 30 });
          
          // Increase player ATK by 20%
          if (!player.tempBuffs) player.tempBuffs = {};
          player.tempBuffs.atk = { bonus: 0.20, duration: 2 };
          
          return {
            message: `📣 Dragon roar! Enemy weakened, you empowered!`
          };
        }
      }
    };

    const skillEffect = effects[skillName];
    if (skillEffect && skillEffect.execute) {
      return skillEffect.execute(player, monster, damage);
    }

    return { message: '' };
  }
}

module.exports = CombatSystem;