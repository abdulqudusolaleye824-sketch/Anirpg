// ═══════════════════════════════════════════════════════════════
// STATUS EFFECT MANAGER - 13 Effects
// ═══════════════════════════════════════════════════════════════
const { checkEffectResistance, getClassName } = require('./ClassMatchups');

class StatusEffectManager {
  // Single source of truth for status numbers. DoTs are max-HP fractions
  // (pctPerTurn) so burns/bleeds scale — flat damagePerTurn survives only
  // on legacy entity effects already stored in player objects.
  static EFFECTS = {
    poison:    { name: 'Poison',    emoji: '☠️', pctPerTurn: 0.03, duration: 3 },
    burn:      { name: 'Burn',      emoji: '🔥', pctPerTurn: 0.05, duration: 3 },
    bleed:     { name: 'Bleed',     emoji: '🩸', pctPerTurn: 0.04, duration: 4 },
    stun:      { name: 'Stun',      emoji: '💫', skipTurnChance: 1.0, speedReduction: 0.5, duration: 1 },
    freeze:    { name: 'Freeze',    emoji: '❄️', pctPerTurn: 0.04, skipTurnChance: 1.0, duration: 2 },
    weaken:    { name: 'Weaken',    emoji: '💔', atkReduction: 0.75, duration: 3 },
    weakness:  { name: 'Weakness',  emoji: '💔', atkReduction: 0.75, duration: 3 },
    weakened:  { name: 'Weakened',  emoji: '💔', atkReduction: 0.3, duration: 3 },
    enfeeble:  { name: 'Enfeeble',  emoji: '🐢', defReduction: 0.3, duration: 3 },
    fear:      { name: 'Fear',      emoji: '😱', atkReduction: 0.5, defReduction: 0.5, speedReduction: 0.5, accuracyReduction: 0.5, duration: 1 },
    trueSlow:  { name: 'TrueSlow',  emoji: '🐌', speedReduction: 0.35, duration: 3 },
    trueslow:  { name: 'TrueSlow',  emoji: '🐌', speedReduction: 0.35, duration: 3 },
    silence:   { name: 'Silence',   emoji: '🤐', noSkills: true, duration: 2 },
    blind:     { name: 'Blind',     emoji: '🌫️', accuracyReduction: 0.5, duration: 2 },
    paralyze:  { name: 'Paralyze',  emoji: '🔱', skipTurnChance: 1.0, duration: 3 },
    curse:     { name: 'Curse',     emoji: '💀', defReduction: 0.15, duration: 3 },
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
      pctPerTurn: def.pctPerTurn || 0,
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
      // Unified DoT routing: %-of-max-HP from the entity effect, else the
      // EFFECTS table (covers UnifiedCombat-applied type-only effects),
      // else legacy flat damagePerTurn stored on old player objects.
      const _def = this.EFFECTS[(effect.type || '').toLowerCase()] || {};
      // Explicit entity values win; the table only fills gaps (type-only
      // effects) — legacy flat damagePerTurn keeps working untouched.
      const _pct = effect.pctPerTurn || (!effect.damagePerTurn && _def.pctPerTurn) || 0;
      const _ename = effect.name || _def.name || effect.type;
      const _eemoji = effect.emoji || _def.emoji || '✨';
      if (_pct > 0 && entity.stats) {
        const dmg = Math.floor((entity.stats.maxHp || 100) * _pct);
        entity.stats.hp = Math.max(0, (entity.stats.hp || 0) - dmg);
        totalDamage += dmg;
        messages.push(_eemoji + ' ' + entity.name + ' suffers ' + dmg + ' ' + _ename + ' damage!');
      } else if (effect.damagePerTurn > 0 && entity.stats) {
        const dmg = effect.damagePerTurn;
        entity.stats.hp = Math.max(0, (entity.stats.hp || 0) - dmg);
        totalDamage += dmg;
        messages.push(_eemoji + ' ' + entity.name + ' suffers ' + dmg + ' ' + _ename + ' damage!');
      }
      const _fxType = (effect.type || '').toLowerCase();
      // Bridge: UnifiedCombat-applied freeze/stun (no skipTurnChance field) still hard-skip
      const _hardSkip = _fxType === 'freeze' || _fxType === 'stun';
      if (_hardSkip || (effect.skipTurnChance > 0 && Math.random() < effect.skipTurnChance)) {
        canAct = false;
        const past = { stun: 'stunned', freeze: 'frozen', paralyze: 'paralyzed', fear: 'feared' }[_fxType]
          || ((effect.name || effect.type || 'afflicted').toLowerCase() + 'd');
        messages.push((effect.emoji || '✨') + ' ' + entity.name + ' is ' + past + ' and cannot act!');
      }
      if (effect.noSkills) {
        canUseSkills = false;
        messages.push(effect.emoji + ' ' + entity.name + ' is Silenced — skills locked!');
      }
      effect.duration--;
    }
    const expired = entity.statusEffects.filter(e => e.duration <= 0);
    entity.statusEffects = entity.statusEffects.filter(e => e.duration > 0);
    for (const e of expired) messages.push((e.emoji || '✨') + ' ' + entity.name + "'s " + (e.name || e.type) + ' wore off!');
    return { damage: totalDamage, messages, canAct, canUseSkills };
  }

  static getStatModifiers(entity) {
    if (!entity.statusEffects || !entity.statusEffects.length)
      return { atkMod: 1.0, defMod: 1.0, speedMod: 1.0, accuracyMod: 1.0 };
    let atkMod = 1.0, defMod = 1.0, speedMod = 1.0, accuracyMod = 1.0;
    for (const e of entity.statusEffects) {
      // Explicit per-effect values win; otherwise fall back to the EFFECTS
      // table (UnifiedCombat-applied effects carry type+duration only).
      const d = this.EFFECTS[(e.type || '').toLowerCase()] || {};
      let atkR = (e.atkReduction > 0 ? e.atkReduction : 0) || d.atkReduction || 0;
      if ((e.type || '').toLowerCase() === 'weakened' && e.reduction > 0) atkR = e.reduction / 100;
      const defR = (e.defReduction > 0 ? e.defReduction : 0) || d.defReduction || 0;
      const spdR = (e.speedReduction > 0 ? e.speedReduction : 0) || d.speedReduction || 0;
      const accR = (e.accuracyReduction > 0 ? e.accuracyReduction : 0) || d.accuracyReduction || 0;
      if (atkR > 0) atkMod      -= atkR;
      if (defR > 0) defMod      -= defR;
      if (spdR > 0) speedMod    -= spdR;
      if (accR > 0) accuracyMod -= accR;
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
