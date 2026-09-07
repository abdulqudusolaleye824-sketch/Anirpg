const SkillDescriptions = require('./SkillDescriptions');
const StatusEffectManager = require('./StatusEffectManager');
const EffectParser = require('./EffectParser');
let ArtifactSystem; try { ArtifactSystem = require('./ArtifactSystem'); } catch(e) { console.warn('[SILENT] ImprovedCombat: ArtifactSystem not available'); }
let BuffManager; try { BuffManager = require('./BuffManager'); } catch(e) { console.warn('[SILENT] ImprovedCombat: BuffManager not available'); }

class ImprovedCombat {

  // ═══════════════════════════════════════════════════════════════
  // EXECUTE SKILL
  // attacker: player object with .stats, .skills.active, .weapon, .class
  // defender: entity with .stats.hp/.def/.maxHp, .name
  // skillName: string
  // ═══════════════════════════════════════════════════════════════
  static executeSkill(attacker, defender, skillName) {
    // Find skill in player's active slots
    const skill = attacker.skills?.active?.find(s =>
      s.name.toLowerCase() === skillName.toLowerCase()
    );
    if (!skill) {
      return { success: false, message: `❌ You don't have the skill "${skillName}"!` };
    }

    // Get SkillDescriptions entry (animation, effect text, costs)
    const className = typeof attacker.class === 'string'
      ? attacker.class : (attacker.class?.name || 'Warrior');
    const skillInfo = SkillDescriptions.getSkillDescription(className, skill.name);

    if (!skillInfo) {
      return { success: false, message: `❌ Skill "${skill.name}" not found in skill database!` };
    }

    // ── Energy cost ───────────────────────────────────────────
    // SkillDescriptions has the authoritative cost per class
    const energyCost =
      skillInfo.dragonCost || skillInfo.manaCost || skillInfo.holyCost ||
      skillInfo.hungerCost  || skillInfo.rageCost || skillInfo.focusCost ||
      skillInfo.energyCost  || skill.energyCost || 20;

    const costType = attacker.energyType || 'Energy';

    if ((attacker.stats.energy || 0) < energyCost) {
      return {
        success: false,
        message: `❌ Not enough ${costType}!\nNeed: ${energyCost} | Have: ${attacker.stats.energy}`
      };
    }

    // ── Cooldown ──────────────────────────────────────────────
    const cooldownResult = this.checkCooldown(attacker, skill.name);
    if (!cooldownResult.ready) {
      return { success: false, message: cooldownResult.message };
    }

    // ── Deduct energy & set cooldown ──────────────────────────
    attacker.stats.energy -= energyCost;
    if (!attacker.lastSkillUse) attacker.lastSkillUse = {};
    attacker.lastSkillUse[skill.name] = Date.now();

    // ── Parse effects from SkillDescriptions effect text ──────
    const parsedEffects = EffectParser.parseSkillEffects(skillInfo.effect);

    // ── Also apply structured effect from skill object directly ──
    // (PlayerManager skills have effect: { type, chance, duration })
    if (skill.effect && typeof skill.effect === 'object') {
      const se = skill.effect;
      if (se.type && se.type !== 'shield' && se.type !== 'lifesteal') {
        const alreadyHas = parsedEffects.statusEffects.some(e => e.type === se.type);
        if (!alreadyHas) {
          parsedEffects.statusEffects.push({
            type: se.type,
            chance: Math.round((se.chance || 1.0) * 100),
            duration: se.duration || 2
          });
        }
      }
      if (se.type === 'lifesteal' && se.percent) {
        parsedEffects.damage = true;
        parsedEffects.special.push({ type: 'lifesteal', amount: Math.round(se.percent * 100) });
      }
      // Secondary effects nested in effect (e.g. Devourer's poison: { chance, duration })
      if (se.poison) {
        parsedEffects.statusEffects.push({ type: 'poison', chance: Math.round((se.poison.chance || 0.25) * 100), duration: se.poison.duration || 3 });
      }
      if (se.fear) {
        parsedEffects.statusEffects.push({ type: 'fear', chance: Math.round((se.fear.chance || 0.3) * 100), duration: se.fear.duration || 2 });
      }
      // Ensure damage is true if skill has damage value
      if ((skill.damage || 0) > 0) parsedEffects.damage = true;
      if (parsedEffects.damageMultiplier === 0 && (skill.damage || 0) > 0) parsedEffects.damageMultiplier = 1.0;
    }

    // ── Calculate base damage ─────────────────────────────────
    const weaponBonus = attacker.weapon?.bonus || attacker.weapon?.attack || 0;

    // Apply active ATK buffs + passives + status effect modifiers
    // Apply equipped artifact stat bonuses
    let _artBonus = { atk: 0, def: 0, critChance: 0, critDamage: 0 };
    if (ArtifactSystem?.getEquippedArtifactStats) {
      _artBonus = ArtifactSystem.getEquippedArtifactStats(attacker);
    }
    const _atkBuffBoost = BuffManager ? BuffManager.getAtkBoost(attacker) : 0;
    let effectiveAtk = (attacker.stats.atk || 0) + (_artBonus.atk || 0) + _atkBuffBoost;

    // Apply passive skills (Rampage, Blood Rage, etc.)
    const passives = attacker.skills?.passive || [];
    const hpPercent = (attacker.stats.hp / attacker.stats.maxHp) * 100;
    for (const passive of passives) {
      const eff = (passive.effect || '').toLowerCase();
      if (eff.includes('+20% atk when hp < 50') && hpPercent < 50) effectiveAtk = Math.floor(effectiveAtk * 1.2);
      if (eff.includes('+30% atk when hp < 40') && hpPercent < 40) effectiveAtk = Math.floor(effectiveAtk * 1.3);
      if (eff.includes('+50% atk when hp < 30') && hpPercent < 30) effectiveAtk = Math.floor(effectiveAtk * 1.5);
      if (eff.includes('10 billion% resolve') || (eff.includes('+50%') && eff.includes('hp < 30'))) {
        if (hpPercent < 30) effectiveAtk = Math.floor(effectiveAtk * 1.5);
      }
      if (eff.includes('+40% skill damage') || eff.includes('+40% skill')) {
        effectiveAtk = Math.floor(effectiveAtk * 1.4);
      } else if (eff.includes('+15% spell damage') || eff.includes('+15% skill damage')) {
        const bonus = eff.includes('40%') ? 1.4 : 1.15;
        effectiveAtk = Math.floor(effectiveAtk * bonus);
      }
    }

    // Apply status effect ATK modifiers (weaken, etc.)
    const atkMod = StatusEffectManager.getStatModifiers(attacker).atkMod;
    effectiveAtk = Math.floor(effectiveAtk * atkMod);

    if (Array.isArray(attacker.buffs)) {
      for (const buff of attacker.buffs) {
        if (buff.stat === 'atk' && buff.amount > 0) {
          effectiveAtk = Math.floor(effectiveAtk * (1 + buff.amount / 100));
        }
      }
    }

    const baseAtk = effectiveAtk + weaponBonus;
    const mult = parsedEffects.damageMultiplier || 1.0;

    // New formula: skill.damage + (player.atk * 0.5) scaled by multiplier
    const skillFlatDmg = skill.damage || 0;
    const skillLevel = skill.level || 1;
    const skillLevelMult = 1 + (skillLevel - 1) * 0.08; // +8% per level
    // Balanced formula: flat skill damage + ATK scaling, both scaled by skill level
    let baseDamage = parsedEffects.damage
      ? Math.floor((skillFlatDmg * skillLevelMult + effectiveAtk * 0.35) * mult)
      : 0;

    // ── Crit ──────────────────────────────────────────────────
    const guaranteedCrit = parsedEffects.special.some(s => s.type === 'guaranteedCrit');
    const critChance = 0.15 + ((attacker.stats.critChance || 0) / 100) + ((_artBonus.critChance || 0) / 100);
    const isCrit = guaranteedCrit || Math.random() < critChance;
    if (isCrit && baseDamage > 0) {
      const critMult = 1.5 + ((attacker.stats.critDamage || 0) / 100);
      baseDamage = Math.floor(baseDamage * critMult);
    }

    // ── Defense reduction (with armor penetration) ────────────
    const armorPen = parsedEffects.special.find(s => s.type === 'armorPenetration');
    const penFactor = armorPen ? (1 - Math.min(armorPen.amount, 100) / 100) : 1;

    // Apply active DEF debuffs on defender
    let _defArtBonus = ArtifactSystem?.getEquippedArtifactStats ? ArtifactSystem.getEquippedArtifactStats(defender) : { def: 0 };
    let effectiveDef = (defender.stats?.def || 0) + (_defArtBonus.def || 0);
    if (Array.isArray(defender.debuffs)) {
      for (const db of defender.debuffs) {
        if (db.stat === 'def') effectiveDef = Math.max(0, Math.floor(effectiveDef * (1 - db.amount / 100)));
      }
    }

    // DEF reduces damage but has diminishing returns (max 70% reduction)
    const defRatio = effectiveDef / (effectiveDef + baseDamage * 0.5 + 1);
    const defReductionPct = Math.min(0.70, defRatio) * penFactor;
    const defReduction = Math.floor(baseDamage * defReductionPct);
    baseDamage = Math.max(parsedEffects.damage ? 5 : 0, baseDamage - defReduction);

    // ── Apply all effects ─────────────────────────────────────
    const effectResult = EffectParser.applyEffects(
      parsedEffects, attacker, defender, baseDamage, StatusEffectManager
    );

    const finalDamage = effectResult.damage;

    // Apply damage to defender
    if (finalDamage > 0) {
      defender.stats.hp = Math.max(0, defender.stats.hp - finalDamage);
      
      // Lifesteal — heal attacker based on damage dealt
      const lifestealEffect = parsedEffects.special.find(s => s.type === 'lifesteal');
      if (lifestealEffect && finalDamage > 0) {
        const healAmt = Math.floor(finalDamage * (lifestealEffect.amount / 100));
        attacker.stats.hp = Math.min(attacker.stats.maxHp || attacker.stats.hp + healAmt, attacker.stats.hp + healAmt);
        effectResult.narrative += `💚 *Lifesteal!* Healed ${healAmt} HP!\n`;
      }
    }

    // ── Apply passive lifesteal (Immortal Formula etc.) ─────────
    if (finalDamage > 0 && Array.isArray(attacker.skills?.passive)) {
      for (const passive of attacker.skills.passive) {
        const eff = (passive.effect || '').toLowerCase();
        if (eff.includes('heal') && eff.includes('damage dealt')) {
          const healPct = parseFloat(eff.match(/(\d+)%/)?.[1] || '0') / 100;
          const healAmt = Math.floor(finalDamage * healPct);
          if (healAmt > 0) {
            attacker.stats.hp = Math.min(attacker.stats.maxHp, (attacker.stats.hp || 0) + healAmt);
          }
        }
      }
    }

    // ── Build message ─────────────────────────────────────────
    let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `✨ *${attacker.name}* used *${skill.name}*!\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (skillInfo.animation) {
      message += `${skillInfo.animation}\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    }

    if (isCrit && finalDamage > 0) message += `💥 *CRITICAL HIT!*\n`;

    if (finalDamage > 0) {
      message += `⚔️ Dealt *${finalDamage}* damage to ${defender.name || 'enemy'}!\n`;
    } else if (!parsedEffects.damage) {
      message += `✨ Support skill activated!\n`;
    }

    message += effectResult.narrative;
    message += `${attacker.energyColor || '💙'} ${costType}: ${attacker.stats.energy}/${attacker.stats.maxEnergy}\n`;

    return {
      success: true,
      message,
      damage: finalDamage,
      isCrit,
      instakill: effectResult.instakill
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // CHECK COOLDOWN
  // ═══════════════════════════════════════════════════════════════
  static checkCooldown(player, skillName) {
    if (!player.lastSkillUse) player.lastSkillUse = {};

    const now = Date.now();
    const lastUse = player.lastSkillUse[skillName];
    if (!lastUse) return { ready: true };

    const skill = player.skills?.active?.find(s => s.name === skillName);
    if (!skill) return { ready: false, message: `❌ Skill not found!` };

    const className = typeof player.class === 'string'
      ? player.class : (player.class?.name || 'Warrior');
    const skillInfo = SkillDescriptions.getSkillDescription(className, skillName);
    const cooldownMs = ((skillInfo?.cooldown) || skill.cooldown || 3) * 1000;

    const timeLeft = lastUse + cooldownMs - now;
    if (timeLeft > 0) {
      return {
        ready: false,
        timeLeft,
        message: `⏳ ${skillName} is on cooldown! (${Math.ceil(timeLeft / 1000)}s remaining)`
      };
    }

    return { ready: true };
  }

  // ═══════════════════════════════════════════════════════════════
  // SKILLS MENU
  // ═══════════════════════════════════════════════════════════════
  static getSkillsMenu(player) {
    const energyDisplay = `${player.energyColor || '💙'} ${player.energyType || 'Energy'}: ${player.stats.energy}/${player.stats.maxEnergy}`;

    let menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✨ YOUR SKILLS ✨\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${energyDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (!player.skills?.active?.length) {
      return menu + '❌ No skills learned!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    }

    const className = typeof player.class === 'string'
      ? player.class : (player.class?.name || 'Warrior');

    player.skills.active.forEach((skill, i) => {
      const skillInfo = SkillDescriptions.getSkillDescription(className, skill.name);
      const cooldownCheck = this.checkCooldown(player, skill.name);
      const isReady = cooldownCheck.ready ? '✅' : '🔒';

      const energyCost = skillInfo
        ? (skillInfo.dragonCost || skillInfo.manaCost || skillInfo.holyCost ||
           skillInfo.hungerCost || skillInfo.rageCost || skillInfo.focusCost ||
           skillInfo.energyCost || skill.energyCost || 20)
        : (skill.energyCost || 20);

      // Show actual damage multiplier from parsed effects
      let dmgDisplay = '—';
      if (skillInfo?.effect) {
        const mult = EffectParser.parseDamageMultiplier(skillInfo.effect);
        if (mult > 0) dmgDisplay = `${Math.round(mult * 100)}%`;
        else dmgDisplay = 'Support';
      }

      menu += `${i + 1}. ${isReady} *${skill.name}*\n`;
      menu += `   ⚔️ Damage: ${dmgDisplay} ATK\n`;
      menu += `   ${player.energyColor || '💙'} Cost: ${energyCost} ${player.energyType || 'Energy'}\n`;
      if (skillInfo?.cooldown) menu += `   ⏰ Cooldown: ${skillInfo.cooldown}s\n`;
      if (skillInfo?.description) menu += `   📖 ${skillInfo.description.substring(0, 60)}\n`;
      if (!cooldownCheck.ready) menu += `   🔒 Ready in: ${Math.ceil(cooldownCheck.timeLeft / 1000)}s\n`;
      menu += '\n';
    });

    menu += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📌 /dungeon use [skill name]\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    return menu;
  }

  static getDetailedSkillsMenu(player) { return this.getSkillsMenu(player); }

  // ═══════════════════════════════════════════════════════════════
  // PROCESS ATTACK (used by /battle attack)
  // ═══════════════════════════════════════════════════════════════
  static processAttack(player, monster, battle) {
    const weaponBonus = player.weapon?.bonus || player.weapon?.attack || 0;
    const baseAtk = (player.stats.atk || 10) + weaponBonus;
    const isCrit = Math.random() < (0.1 + (player.stats.critChance || 0) / 100);
    let damage = Math.max(1, baseAtk - Math.floor((monster.stats?.def || monster.def || 0) * 0.4));
    if (isCrit) damage = Math.floor(damage * 1.5);

    const monsterHp = monster.stats ? monster.stats : monster;
    const hpKey = monster.stats ? 'hp' : 'hp';
    if (monster.stats) monster.stats.hp = Math.max(0, monster.stats.hp - damage);
    else monster.hp = Math.max(0, (monster.hp || 0) - damage);

    const currentHp = monster.stats ? monster.stats.hp : monster.hp;
    const maxHp = monster.stats ? monster.stats.maxHp : monster.maxHp;

    let narrative = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ ATTACK\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    narrative += `${isCrit ? '💥 *CRITICAL HIT!* ' : ''}⚔️ ${player.name} attacks ${monster.name}!\n`;
    narrative += `💥 Dealt *${damage}* damage!\n`;
    narrative += `👹 ${monster.name}: ❤️ ${currentHp}/${maxHp}\n`;

    const victory = currentHp <= 0;

    if (!victory) {
      // Monster counter-attack
      const monsterAtk = monster.stats?.atk || monster.atk || 10;
      const playerDef = Math.floor((player.stats.def || 0) * 0.4);
      const monsterDmg = Math.max(1, monsterAtk - playerDef);
      player.stats.hp = Math.max(0, player.stats.hp - monsterDmg);
      narrative += `\n👹 ${monster.name} counter-attacks!\n`;
      narrative += `💢 You took *${monsterDmg}* damage!\n`;
      narrative += `❤️ Your HP: ${player.stats.hp}/${player.stats.maxHp}\n`;
    }

    const defeat = player.stats.hp <= 0;

    return { narrative, victory, defeat };
  }

  // ═══════════════════════════════════════════════════════════════
  // PROCESS SKILL (used by /battle use [num])
  // ═══════════════════════════════════════════════════════════════
  static processSkill(player, monster, skillName, battle) {
    const monsterEntity = {
      name: monster.name,
      stats: monster.stats || { hp: monster.hp || 100, def: monster.def || 0, maxHp: monster.maxHp || 100 },
      statusEffects: monster.statusEffects || []
    };

    const result = this.executeSkill(player, monsterEntity, skillName);

    if (!result.success) return { success: false, message: result.message };

    // Sync HP back to original monster object
    if (monster.stats) monster.stats.hp = monsterEntity.stats.hp;
    else monster.hp = monsterEntity.stats.hp;

    // Sync status effects back (e.g. stun/burn applied by skill)
    if (monster.statusEffects !== undefined) {
      monster.statusEffects = monsterEntity.statusEffects;
    }

    const currentHp = monster.stats ? monster.stats.hp : monster.hp;
    const maxHp = monster.stats ? monster.stats.maxHp : monster.maxHp;

    let narrative = result.message;

    const isPvP = battle && battle.pvp === true;
    const victory = currentHp <= 0;

    if (!isPvP) {
      // PvE only: show HP bar and monster counter-attack
      narrative += `👹 ${monster.name}: ❤️ ${currentHp}/${maxHp}\n`;
      if (!victory) {
        const monsterAtk = monster.stats?.atk || monster.atk || 10;
        const playerDef = Math.floor((player.stats.def || 0) * 0.4);
        const monsterDmg = Math.max(1, monsterAtk - playerDef);
        player.stats.hp = Math.max(0, player.stats.hp - monsterDmg);
        narrative += `\n👹 ${monster.name} counter-attacks!\n`;
        narrative += `💢 You took *${monsterDmg}* damage!\n`;
        narrative += `❤️ Your HP: ${player.stats.hp}/${player.stats.maxHp}\n`;
      }
    }

    const defeat = player.stats.hp <= 0;

    return { success: true, narrative, victory, defeat, damage: result.damage, isCrit: result.isCrit };
  }

  // ═══════════════════════════════════════════════════════════════
  // USE ITEM (used by /battle item [num])
  // ═══════════════════════════════════════════════════════════════
  static useItem(player, itemNum) {
    if (!player.inventory) player.inventory = {};

    if (itemNum === 1) {
      // Health Potion
      const count = player.inventory.healthPotions || 0;
      if (count <= 0) return { success: false, message: '❌ You have no Health Potions!' };
      const healAmount = Math.floor(player.stats.maxHp * 0.4);
      player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healAmount);
      player.inventory.healthPotions--;
      return {
        success: true,
        narrative: `🧪 Used *Health Potion*!\n❤️ Restored *${healAmount}* HP!\n❤️ HP: ${player.stats.hp}/${player.stats.maxHp}\n`
      };
    }

    if (itemNum === 2) {
      // Energy Potion
      const count = player.inventory.energyPotions || player.inventory.manaPotions || 0;
      if (count <= 0) return { success: false, message: '❌ You have no Energy Potions!' };
      const restoreAmount = Math.floor(player.stats.maxEnergy * 0.5);
      player.stats.energy = Math.min(player.stats.maxEnergy, player.stats.energy + restoreAmount);
      if (player.inventory.energyPotions > 0) player.inventory.energyPotions--;
      else player.inventory.manaPotions--;
      return {
        success: true,
        narrative: `${player.energyColor || '💙'} Used *Energy Potion*!\nRestored *${restoreAmount}* ${player.energyType || 'Energy'}!\n${player.energyColor || '💙'} Energy: ${player.stats.energy}/${player.stats.maxEnergy}\n`
      };
    }

    return { success: false, message: '❌ Invalid item number! Use 1 (Health Potion) or 2 (Energy Potion).' };
  }

  // ═══════════════════════════════════════════════════════════════
  // GET ITEMS MENU (used by /battle items)
  // ═══════════════════════════════════════════════════════════════
  static getItemsMenu(player) {
    const inv = player.inventory || {};
    const healthPots = inv.healthPotions || 0;
    const energyPots = inv.energyPotions || inv.manaPotions || 0;

    let menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎒 ITEMS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    menu += `1. 🧪 Health Potion x${healthPots}\n   Restores 40% HP\n\n`;
    menu += `2. ${player.energyColor || '💙'} Energy Potion x${energyPots}\n   Restores 50% ${player.energyType || 'Energy'}\n`;
    menu += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📌 /battle item [1 or 2]\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    return menu;
  }

  static getBattleMenu(player, monster) {
    const energyDisplay = `${player.energyColor || '💙'} ${player.energyType || 'Energy'}: ${player.stats.energy}/${player.stats.maxEnergy}`;
    let menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ BATTLE ⚔️\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 ${player.name}\n❤️ HP: ${player.stats.hp}/${player.stats.maxHp}\n${energyDisplay}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👹 ${monster.name}\n❤️ HP: ${monster.stats?.hp || monster.hp}/${monster.stats?.maxHp || monster.maxHp}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/dungeon attack | /dungeon use [skill] | /dungeon run\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    if (player.statusEffects?.length) menu += `\n💫 Your effects: ${player.statusEffects.map(e => e.type).join(', ')}`;
    if (monster.statusEffects?.length) menu += `\n💀 Enemy effects: ${monster.statusEffects.map(e => e.type).join(', ')}`;
    return menu;
  }
}

module.exports = ImprovedCombat;