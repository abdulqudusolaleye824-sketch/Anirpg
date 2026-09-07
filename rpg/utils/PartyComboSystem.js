const SkillDescriptions = require('./SkillDescriptions');

class PartyComboSystem {
  
  // ═══════════════════════════════════════════════════════════════
  // DUAL TECH COMBOS (2 Players)
  // ═══════════════════════════════════════════════════════════════
  static dualTechCombos = {
    // Warrior + Mage = Flame Blade
    'Warrior_Mage': {
      name: 'Flame Blade',
      requiredSkills: ['Power Strike', 'Fireball'],
      energyCost: 30,
      damage: 200,
      animation: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥⚔️ *DUAL TECH: FLAME BLADE!* ⚔️🔥
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{warrior} raises their blade high!
{mage} channels scorching flames!

⚔️ The blade ignites with magical fire!
🔥 Fire and steel become one!
💥 DEVASTATING COMBO ATTACK!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      effect: { type: 'burn', chance: 0.8, duration: 4 }
    },

    // Warrior + Archer = Piercing Assault
    'Warrior_Archer': {
      name: 'Piercing Assault',
      requiredSkills: ['Power Strike', 'Multi-Shot'],
      energyCost: 28,
      damage: 180,
      animation: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏹⚔️ *DUAL TECH: PIERCING ASSAULT!* ⚔️🏹
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{warrior} charges forward with weapon ready!
{archer} fires multiple arrows in perfect sync!

⚔️ Blade and arrows strike simultaneously!
🎯 Overwhelming coordinated attack!
💥 NO DEFENSE CAN HOLD!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      effect: { type: 'armor_break', percent: 0.4, duration: 3 }
    },

    // Mage + Mage = Elemental Fusion
    'Mage_Mage': {
      name: 'Elemental Fusion',
      requiredSkills: ['Fireball', 'Ice Shard'],
      energyCost: 35,
      damage: 220,
      animation: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
❄️🔥 *DUAL TECH: ELEMENTAL FUSION!* 🔥❄️
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{mage1} summons raging flames!
{mage2} calls forth freezing ice!

💥 Fire and Ice collide!
⚡ Elements clash in explosive fusion!
🌟 DEVASTATING ELEMENTAL STORM!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      effect: { type: 'stun', chance: 0.6, duration: 2 }
    },

    // Archer + Archer = Arrow Storm
    'Archer_Archer': {
      name: 'Arrow Storm',
      requiredSkills: ['Multi-Shot', 'Volley'],
      energyCost: 32,
      damage: 190,
      animation: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏹🏹 *DUAL TECH: ARROW STORM!* 🏹🏹
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{archer1} and {archer2} fire in unison!

☔ The sky darkens with arrows!
🎯 Hundreds of projectiles rain down!
💥 INESCAPABLE BARRAGE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      effect: { type: 'bleed', chance: 0.7, duration: 5 }
    },

    // Rogue + Assassin = Shadow Dance
    'Rogue_Assassin': {
      name: 'Twin Shadows',
      requiredSkills: ['Shadow Strike', 'Lethal Strike'],
      energyCost: 30,
      damage: 240,
      animation: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌑🗡️ *DUAL TECH: TWIN SHADOWS!* 🗡️🌑
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{rogue} vanishes into darkness!
{assassin} becomes invisible!

👤 Two shadows strike as one!
⚔️ From opposite directions!
💀 LETHAL COORDINATED ASSASSINATION!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      effect: { type: 'deep_bleed', damage: 50, duration: 4 }
    },

    // DragonKnight + Mage = Inferno Dragon
    'DragonKnight_Mage': {
      name: 'Inferno Dragon',
      requiredSkills: ['Dragon Breath', 'Fireball'],
      energyCost: 40,
      damage: 280,
      animation: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐉🔥 *DUAL TECH: INFERNO DRAGON!* 🔥🐉
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{dragonknight} unleashes dragon fire!
{mage} amplifies the flames with magic!

🔥 COMBINED INFERNO ERUPTS!
🐲 Flames hot enough to melt steel!
🌋 APOCALYPTIC FIRESTORM!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      effect: { type: 'mega_burn', damage: 60, duration: 5 }
    },

    // Paladin + Warrior = Divine Crusade
    'Paladin_Warrior': {
      name: 'Divine Crusade',
      requiredSkills: ['Holy Smite', 'Power Strike'],
      energyCost: 35,
      damage: 230,
      animation: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨⚔️ *DUAL TECH: DIVINE CRUSADE!* ⚔️✨
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{paladin} blesses {warrior}'s weapon!
{warrior} charges with holy fury!

⚔️ Blessed blade radiates divine light!
✨ RIGHTEOUS FURY UNLEASHED!
💥 EVIL IS PURGED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      effect: { type: 'holy_damage', bonus: 1.5, vs_undead: 2.0 }
    },

    // Necromancer + Devourer = Death's Embrace
    'Necromancer_Devourer': {
      name: "Death's Embrace",
      requiredSkills: ['Death Bolt', 'Soul Devour'],
      energyCost: 38,
      damage: 260,
      animation: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💀👹 *DUAL TECH: DEATH'S EMBRACE!* 👹💀
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{necromancer} channels death energy!
{devourer} prepares to consume!

💀 Death magic swirls with hunger!
🌑 Life force is drained completely!
👻 SOULS ARE DEVOURED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      effect: { type: 'lifesteal', percent: 0.8, bonus_heal: 100 }
    },

    // Berserker + Berserker = Primal Fury
    'Berserker_Berserker': {
      name: 'Primal Fury',
      requiredSkills: ['Rage Strike', 'Blood Frenzy'],
      energyCost: 40,
      damage: 300,
      animation: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💢💢 *DUAL TECH: PRIMAL FURY!* 💢💢
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{berserker1} enters pure rage!
{berserker2} loses all control!

😡 UNBRIDLED RAGE EXPLODES!
💥 WILD CHAOTIC DESTRUCTION!
⚔️ UNSTOPPABLE FORCE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      effect: { type: 'frenzy', atk_boost: 0.6, hits: 8 }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // TRIPLE TECH COMBOS (3 Players)
  // ═══════════════════════════════════════════════════════════════
  static tripleTechCombos = {
    // Warrior + Mage + Archer = Elemental Barrage
    'Warrior_Mage_Archer': {
      name: 'Elemental Barrage',
      energyCost: 50,
      damage: 400,
      animation: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️🔥🏹 *TRIPLE TECH: ELEMENTAL BARRAGE!* 🏹🔥⚔️
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{warrior} holds the line!
{mage} enchants arrows with fire!
{archer} fires the magical volley!

🔥 Flaming arrows fill the sky!
⚔️ Supported by warrior's charge!
💥 COORDINATED DESTRUCTION!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      effect: { type: 'burn', chance: 0.9, duration: 5, aoe: true }
    },

    // 3 Mages = Meteor Shower
    'Mage_Mage_Mage': {
      name: 'Meteor Shower',
      energyCost: 60,
      damage: 450,
      animation: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌠🌠🌠 *TRIPLE TECH: METEOR SHOWER!* 🌠🌠🌠
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{mage1}, {mage2}, and {mage3} combine power!

🌌 The sky tears open!
☄️ DOZENS OF METEORS FALL!
💥 APOCALYPTIC DEVASTATION!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      effect: { type: 'mega_burn', damage: 80, duration: 6, aoe: true }
    },

    // Assassin + Rogue + Archer = Silent Death
    'Assassin_Rogue_Archer': {
      name: 'Silent Death',
      energyCost: 48,
      damage: 420,
      animation: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌑🗡️🏹 *TRIPLE TECH: SILENT DEATH!* 🏹🗡️🌑
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{assassin} marks the target!
{rogue} creates a distraction!
{archer} delivers the killing blow!

💀 Perfect coordination!
🎯 No escape possible!
⚰️ EXECUTION COMPLETE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      effect: { type: 'instant_kill', chance: 0.4, otherwise_damage: 3.0 }
    },

    // DragonKnight + Paladin + Warrior = Trinity Force
    'DragonKnight_Paladin_Warrior': {
      name: 'Trinity Force',
      energyCost: 55,
      damage: 430,
      animation: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐉✨⚔️ *TRIPLE TECH: TRINITY FORCE!* ⚔️✨🐉
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{dragonknight} summons draconic power!
{paladin} blesses the attack!
{warrior} delivers the final blow!

⚔️ Dragon, Divine, and Steel unite!
✨ ULTIMATE PHYSICAL ATTACK!
💥 OVERWHELMING FORCE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      effect: { type: 'armor_shatter', percent: 0.8, duration: 5 }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // PARTY ULTIMATE (4+ Players)
  // ═══════════════════════════════════════════════════════════════
  static partyUltimates = {
    'party_4plus': {
      name: 'Final Judgment',
      minPlayers: 4,
      energyCost: 80,
      damage: 600,
      animation: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💫 *PARTY ULTIMATE: FINAL JUDGMENT!* 💫
━━━━━━━━━━━━━━━━━━━━━━━━━━━
All party members channel their power!

⚡ Energy surges between allies!
🌟 Power amplifies exponentially!
💥 COMBINED ULTIMATE ATTACK!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ The power of friendship!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      effect: { type: 'obliterate', damage_per_member: 100, guaranteed_crit: true }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // CHECK IF DUAL TECH IS AVAILABLE
  // ═══════════════════════════════════════════════════════════════
  static canPerformDualTech(player1, player2) {
    const key1 = `${player1.class.name}_${player2.class.name}`;
    const key2 = `${player2.class.name}_${player1.class.name}`;
    
    const combo = this.dualTechCombos[key1] || this.dualTechCombos[key2];
    
    if (!combo) return null;

    // Check if players have required skills
    const p1Skills = player1.skills.active.map(s => s.name);
    const p2Skills = player2.skills.active.map(s => s.name);
    
    const hasP1Skill = combo.requiredSkills.some(skill => p1Skills.includes(skill));
    const hasP2Skill = combo.requiredSkills.some(skill => p2Skills.includes(skill));
    
    if (!hasP1Skill || !hasP2Skill) return null;

    // Check energy
    const p1Energy = player1.stats.energy >= Math.floor(combo.energyCost * 0.5);
    const p2Energy = player2.stats.energy >= Math.floor(combo.energyCost * 0.5);
    
    if (!p1Energy || !p2Energy) return null;

    return combo;
  }

  // ═══════════════════════════════════════════════════════════════
  // CHECK IF TRIPLE TECH IS AVAILABLE
  // ═══════════════════════════════════════════════════════════════
  static canPerformTripleTech(player1, player2, player3) {
    const classes = [player1.class.name, player2.class.name, player3.class.name].sort().join('_');
    
    const combo = this.tripleTechCombos[classes];
    if (!combo) return null;

    // Check energy for all 3
    const energyPerPlayer = Math.floor(combo.energyCost / 3);
    if (player1.stats.energy < energyPerPlayer) return null;
    if (player2.stats.energy < energyPerPlayer) return null;
    if (player3.stats.energy < energyPerPlayer) return null;

    return combo;
  }

  // ═══════════════════════════════════════════════════════════════
  // EXECUTE DUAL TECH
  // ═══════════════════════════════════════════════════════════════
  static executeDualTech(player1, player2, monster, combo) {
    // Cost energy
    const costPerPlayer = Math.floor(combo.energyCost / 2);
    player1.stats.energy -= costPerPlayer;
    player2.stats.energy -= costPerPlayer;

    // Calculate damage
    const weaponBonus1 = player1.weapon?.bonus || 0;
    const weaponBonus2 = player2.weapon?.bonus || 0;
    const avgAtk = (player1.stats.atk + weaponBonus1 + player2.stats.atk + weaponBonus2) / 2;
    
    let totalDamage = Math.floor(combo.damage + avgAtk);
    
    // Combo bonus
    totalDamage = Math.floor(totalDamage * 1.5); // 50% combo bonus
    
    // Apply damage
    monster.hp -= totalDamage;

    // Apply effect
    let effectText = '';
    if (combo.effect) {
      if (combo.effect.type === 'burn' && Math.random() < combo.effect.chance) {
        if (!monster.statusEffects) monster.statusEffects = [];
        monster.statusEffects.push({
          type: 'burn',
          damage: 15 * combo.effect.duration,
          duration: combo.effect.duration
        });
        effectText = `\n🔥 Enemy is BURNING! (${15 * combo.effect.duration} damage over ${combo.effect.duration} turns)`;
      } else if (combo.effect.type === 'stun' && Math.random() < combo.effect.chance) {
        if (!monster.statusEffects) monster.statusEffects = [];
        monster.statusEffects.push({
          type: 'stun',
          duration: combo.effect.duration
        });
        effectText = `\n😵 Enemy is STUNNED! (${combo.effect.duration} turns)`;
      } else if (combo.effect.type === 'lifesteal') {
        const healAmount = Math.floor(totalDamage * combo.effect.percent);
        player1.stats.hp = Math.min(player1.stats.maxHp, player1.stats.hp + Math.floor(healAmount / 2));
        player2.stats.hp = Math.min(player2.stats.maxHp, player2.stats.hp + Math.floor(healAmount / 2));
        effectText = `\n💚 Party healed for ${healAmount} HP!`;
      }
    }

    // Format animation
    const animation = combo.animation
      .replace('{warrior}', player1.name)
      .replace('{mage}', player2.name)
      .replace('{mage1}', player1.name)
      .replace('{mage2}', player2.name)
      .replace('{archer}', player2.name)
      .replace('{archer1}', player1.name)
      .replace('{archer2}', player2.name)
      .replace('{rogue}', player1.name)
      .replace('{assassin}', player2.name)
      .replace('{dragonknight}', player1.name)
      .replace('{paladin}', player1.name)
      .replace('{necromancer}', player1.name)
      .replace('{devourer}', player2.name)
      .replace('{berserker1}', player1.name)
      .replace('{berserker2}', player2.name);

    return {
      success: true,
      damage: totalDamage,
      animation: animation + `\n\n💥 Dealt ${totalDamage.toLocaleString()} COMBO DAMAGE!${effectText}`,
      victory: monster.hp <= 0
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // EXECUTE TRIPLE TECH
  // ═══════════════════════════════════════════════════════════════
  static executeTripleTech(player1, player2, player3, monster, combo) {
    // Cost energy
    const costPerPlayer = Math.floor(combo.energyCost / 3);
    player1.stats.energy -= costPerPlayer;
    player2.stats.energy -= costPerPlayer;
    player3.stats.energy -= costPerPlayer;

    // Calculate damage
    const avgAtk = (player1.stats.atk + player2.stats.atk + player3.stats.atk) / 3;
    let totalDamage = Math.floor(combo.damage + avgAtk * 2);
    
    // Triple tech bonus
    totalDamage = Math.floor(totalDamage * 2.0); // 100% combo bonus
    
    // Apply damage
    monster.hp -= totalDamage;

    // Format animation
    const animation = combo.animation
      .replace('{mage1}', player1.name)
      .replace('{mage2}', player2.name)
      .replace('{mage3}', player3.name)
      .replace('{warrior}', player1.name)
      .replace('{mage}', player2.name)
      .replace('{archer}', player3.name)
      .replace('{assassin}', player1.name)
      .replace('{rogue}', player2.name)
      .replace('{dragonknight}', player1.name)
      .replace('{paladin}', player2.name);

    return {
      success: true,
      damage: totalDamage,
      animation: animation + `\n\n💥💥 Dealt ${totalDamage.toLocaleString()} TRIPLE COMBO DAMAGE!`,
      victory: monster.hp <= 0
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // GET AVAILABLE COMBOS FOR PARTY
  // ═══════════════════════════════════════════════════════════════
  static getAvailableCombos(partyMembers, db) {
    const combos = [];

    // Check dual techs
    for (let i = 0; i < partyMembers.length; i++) {
      for (let j = i + 1; j < partyMembers.length; j++) {
        const p1 = db.users[partyMembers[i]];
        const p2 = db.users[partyMembers[j]];
        
        if (!p1 || !p2) continue;

        const combo = this.canPerformDualTech(p1, p2);
        if (combo) {
          combos.push({
            type: 'dual',
            name: combo.name,
            players: [p1.name, p2.name],
            damage: combo.damage,
            energyCost: combo.energyCost
          });
        }
      }
    }

    // Check triple techs
    if (partyMembers.length >= 3) {
      for (let i = 0; i < partyMembers.length; i++) {
        for (let j = i + 1; j < partyMembers.length; j++) {
          for (let k = j + 1; k < partyMembers.length; k++) {
            const p1 = db.users[partyMembers[i]];
            const p2 = db.users[partyMembers[j]];
            const p3 = db.users[partyMembers[k]];
            
            if (!p1 || !p2 || !p3) continue;

            const combo = this.canPerformTripleTech(p1, p2, p3);
            if (combo) {
              combos.push({
                type: 'triple',
                name: combo.name,
                players: [p1.name, p2.name, p3.name],
                damage: combo.damage,
                energyCost: combo.energyCost
              });
            }
          }
        }
      }
    }

    return combos;
  }

  // ═══════════════════════════════════════════════════════════════
  // FORMAT COMBO LIST
  // ═══════════════════════════════════════════════════════════════
  static formatComboList(combos) {
    if (combos.length === 0) {
      return '❌ No combo skills available!\n\nTip: Different class combinations unlock special combo attacks!';
    }

    let list = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ *AVAILABLE COMBO SKILLS* ✨
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    combos.forEach((combo, index) => {
      const typeEmoji = combo.type === 'dual' ? '⚔️' : '🔥';
      list += `${index + 1}. ${typeEmoji} ${combo.name}\n`;
      list += `   👥 ${combo.players.join(' + ')}\n`;
      list += `   💥 Power: ${combo.damage}\n`;
      list += `   💙 Cost: ${combo.energyCost}\n\n`;
    });

    list += `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Usage: /dungeon combo [number]
Example: /dungeon combo 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return list;
  }
}

module.exports = PartyComboSystem;