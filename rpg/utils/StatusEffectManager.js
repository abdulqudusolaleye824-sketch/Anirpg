// ═══════════════════════════════════════════════════════════════
// STATUS EFFECT MANAGER - 13 Effects
// ═══════════════════════════════════════════════════════════════
const { checkEffectResistance, getClassName } = require('./ClassMatchups');

class StatusEffectManager {
  static EFFECTS = {
    poison:    { name: 'Poison',    emoji: '🟢', damagePerTurn: 10, duration: 3 },
    burn:      { name: 'Burn',      emoji: '🔥', damagePerTurn: 15, duration: 3 },
    bleed:     { name: 'Bleed',     emoji: '🩸', damagePerTurn: 12, duration: 4 },
    stun:      { name: 'Stun',      emoji: '⭐', skipTurnChance: 1.0, duration: 1 },
    freeze:    { name: 'Freeze',    emoji: '❄️', skipTurnChance: 0.5, duration: 2 },
    weaken:    { name: 'Weaken',    emoji: '💔', atkReduction: 0.3, duration: 3 },
    enfeeble:  { name: 'Enfeeble',  emoji: '🐢', defReduction: 0.3, duration: 3 },
    fear:      { name: 'Fear',      emoji: '😱', skipTurnChance: 0.4, atkReduction: 0.2, duration: 2 },
    trueSlow:  { name: 'TrueSlow',  emoji: '🐌', speedReduction: 0.35, duration: 3 },
    silence:   { name: 'Silence',   emoji: '🤐', noSkills: true, duration: 2 },
    blind:     { name: 'Blind',     emoji: '🌫️', accuracyReduction: 0.5, duration: 2 },
    paralyze:  { name: 'Paralyze',  emoji: '⚡', skipTurnChance: 0.7, duration: 2 },
    lifesteal: { name: 'Lifesteal', emoji: '💚', isPassive: true, duration: 3 }
  };

  static applyEffect(entity, effectType, duration) {
    const key = effectType.toLowerCase();
    const def = this.EFFECTS[key] || this.EFFECTS[key.replace('trueslow','trueSlow')];
    if (!def) return false;
    const className = getClassName(entity);
    const { resisted } = checkEffectResistance(className, key);
    if (resisted) return false;
    entity.statusEffects = entity.statusEffects || [];
    const existing = entity.statusEffects.find(e => e.type === key);
    if (existing) { existing.duration = Math.max(existing.duration, duration || def.duration); return true; }
    entity.statusEffects.push({
      type: key, name: def.name, emoji: def.emoji,
      duration: duration || def.duration,
      damagePerTurn: def.damagePerTurn || 0,
      skipTurnChance: def.skipTurnChance || 0,
      atkReduction: def.atkReduction || 0,
      defReduction: def.defReduction || 0,
      speedReduction: def.speedReduction || 0,
      accuracyReduction: def.accuracyReduction || 0,
      noSkills: def.noSkills || false,
      isPassive: def.isPassive || false
    });
    return true;
  }

  static processTurnEffects(entity) {
    if (!entity.statusEffects || !entity.statusEffects.length)
      return { damage: 0, messages: [], canAct: true, canUseSkills: true };
    let totalDamage = 0, canAct = true, canUseSkills = true;
    const messages = [];
    for (const effect of entity.statusEffects) {
      if (effect.damagePerTurn > 0) {
        const dmg = effect.damagePerTurn;
        entity.stats.hp = Math.max(0, entity.stats.hp - dmg);
        totalDamage += dmg;
        messages.push(effect.emoji + ' ' + entity.name + ' suffers ' + dmg + ' ' + effect.name + ' damage!');
      }
      if (effect.skipTurnChance > 0 && Math.random() < effect.skipTurnChance) {
        canAct = false;
        messages.push(effect.emoji + ' ' + entity.name + ' is ' + effect.name.toLowerCase() + 'd and cannot act!');
      }
      if (effect.noSkills) {
        canUseSkills = false;
        messages.push(effect.emoji + ' ' + entity.name + ' is Silenced — skills locked!');
      }
      effect.duration--;
    }
    const expired = entity.statusEffects.filter(e => e.duration <= 0);
    entity.statusEffects = entity.statusEffects.filter(e => e.duration > 0);
    for (const e of expired) messages.push(e.emoji + ' ' + entity.name + "'s " + e.name + ' wore off!');
    return { damage: totalDamage, messages, canAct, canUseSkills };
  }

  static getStatModifiers(entity) {
    if (!entity.statusEffects || !entity.statusEffects.length)
      return { atkMod: 1.0, defMod: 1.0, speedMod: 1.0, accuracyMod: 1.0 };
    let atkMod = 1.0, defMod = 1.0, speedMod = 1.0, accuracyMod = 1.0;
    for (const e of entity.statusEffects) {
      if (e.atkReduction > 0)       atkMod      -= e.atkReduction;
      if (e.defReduction > 0)       defMod      -= e.defReduction;
      if (e.speedReduction > 0)     speedMod    -= e.speedReduction;
      if (e.accuracyReduction > 0)  accuracyMod -= e.accuracyReduction;
    }
    return {
      atkMod: Math.max(0.1, atkMod), defMod: Math.max(0.1, defMod),
      speedMod: Math.max(0.1, speedMod), accuracyMod: Math.max(0.1, accuracyMod)
    };
  }

  static isSilenced(entity) { return entity.statusEffects?.some(e => e.type === 'silence') || false; }
  static isStunned(entity)  { return entity.statusEffects?.some(e => ['stun','freeze','paralyze'].includes(e.type)) || false; }
  static formatStatus(entity) {
    if (!entity.statusEffects?.length) return '';
    return entity.statusEffects.map(e => e.emoji + e.name + '(' + e.duration + ')').join(' ');
  }
  static clearAll(entity) { entity.statusEffects = []; }
}

module.exports = StatusEffectManager;
