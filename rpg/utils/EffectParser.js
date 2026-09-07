// ═══════════════════════════════════════════════════════════════
// EFFECT PARSER - Reads skill effect text and applies it properly
// ═══════════════════════════════════════════════════════════════

class EffectParser {

  // ─────────────────────────────────────────────────────────────
  // Extract damage multiplier from skill effect text
  // Returns a number (1.0 = 100% ATK, 2.0 = 200% ATK, etc.)
  // ─────────────────────────────────────────────────────────────
  static parseDamageMultiplier(effectText) {
    if (!effectText) return 1.0;
    const t = effectText;

    // Explicit "X% damage" or "X% magic/physical damage"
    const pct = t.match(/^[•\s]*(\d+)%\s+(?:magic\s+)?(?:physical\s+)?(?:fire\s+)?(?:holy\s+)?(?:dark\s+)?damage/im);
    if (pct) return parseInt(pct[1]) / 100;

    // "Deals X% damage" pattern
    const deals = t.match(/Deals?\s+(\d+)%/i);
    if (deals) return parseInt(deals[1]) / 100;

    // "X% damage" standalone
    const bare = t.match(/^[•\s]*(\d+)%\s+damage/im);
    if (bare) return parseInt(bare[1]) / 100;

    // Multi-hit: "Fires 3 missiles at 80% damage each" → 3×80% = 240%
    const multi = t.match(/(\d+)\s+(?:missiles?|arrows?|shots?|hits?)\s+at\s+(\d+)%/i);
    if (multi) return (parseInt(multi[1]) * parseInt(multi[2])) / 100;

    // "Hit twice for 80% damage each" → 160%
    const twice = t.match(/(?:hit|attack)\s+twice\s+for\s+(\d+)%/i);
    if (twice) return (parseInt(twice[1]) * 2) / 100;

    // "5-8 arrows" / "5-8 random attacks" → average × 80%
    const rain = t.match(/(\d+)-(\d+)\s+(?:arrows?|attacks?|hits?)/i);
    if (rain) return ((parseInt(rain[1]) + parseInt(rain[2])) / 2) * 0.7;

    // "Next attack happens twice" → double hit
    if (/next attack happens twice/i.test(t)) return 2.0;

    // Descriptive keywords — ordered most→least powerful
    const lc = t.toLowerCase();
    if (/400% damage/.test(t)) return 4.0;
    if (/300% damage/.test(t)) return 3.0;
    if (/250% damage/.test(t)) return 2.5;
    if (/200% damage/.test(t)) return 2.0;
    if (/180% damage/.test(t)) return 1.8;
    if (/160% damage/.test(t)) return 1.6;
    if (/150% damage/.test(t)) return 1.5;
    if (/140% damage/.test(t)) return 1.4;
    if (/130% damage/.test(t)) return 1.3;
    if (/110% damage/.test(t)) return 1.1;
    if (/90% damage/.test(t))  return 0.9;
    if (/godlike fury|world burns|ultimate damage|apocalyptic flame|apocalypse/i.test(lc)) return 4.0;
    if (/massive aoe damage|massive dark damage|massive holy damage|massive fire damage|massive aoe fire|triple elemental/i.test(lc)) return 3.0;
    if (/massive damage|sky render|extreme damage|ultimate power|ultimate holy/i.test(lc)) return 2.5;
    if (/high damage if enemy|huge damage|massive aoe magic|massive aoe/i.test(lc)) return 2.0;
    if (/high physical damage|high holy damage|high damage|cone of fire|multiple aoe hits/i.test(lc)) return 1.8;
    if (/aoe physical|aoe blood|aoe fire|aoe ice|aoe dark|aoe magic|multiple hits|hits 3-5/i.test(lc)) return 1.6;
    if (/holy damage|dark damage|shock damage|holy fire|unstoppable charge|massive fire\b/i.test(lc)) return 1.5;
    if (/stuns all|fears all|pulls enemies|knocks back/i.test(lc)) return 1.3;

    // Pure support/buff — no damage
    if (!lc.includes('damage') && !lc.includes('dmg') && !lc.includes('strike') &&
        !lc.includes('hit') && !lc.includes('slash') && !lc.includes('shot') &&
        !lc.includes('arrow') && !lc.includes('bolt') && !lc.includes('blast') &&
        !lc.includes('coil') && !lc.includes('spear') && !lc.includes('beam') &&
        !lc.includes('death') && !lc.includes('devour') && !lc.includes('claw') &&
        !lc.includes('burn') && !lc.includes('poison') && !lc.includes('bleed') &&
        !lc.includes('stun') && !lc.includes('freeze')) {
      return 0; // support skill, no damage
    }

    return 1.0; // default
  }

  // ─────────────────────────────────────────────────────────────
  // PARSE SKILL EFFECTS FROM TEXT
  // ─────────────────────────────────────────────────────────────
  static parseSkillEffects(effectText) {
    if (!effectText || typeof effectText !== 'string') {
      return { damage: true, damageMultiplier: 1.0, statusEffects: [], buffs: [], debuffs: [], special: [] };
    }

    const mult = this.parseDamageMultiplier(effectText);
    const effects = {
      damage: mult > 0,
      damageMultiplier: mult,
      statusEffects: [],
      buffs: [],
      debuffs: [],
      special: []
    };

    const text = effectText.toLowerCase();

    // ── NO DAMAGE check ───────────────────────────────────────
    if (text.includes('no damage')) {
      effects.damage = false;
      effects.damageMultiplier = 0;
    }

    // ── STATUS EFFECTS ────────────────────────────────────────
    // Only trigger when explicitly inflicting — NOT just from flavor text

    // BURN — must say "inflict burn", "apply burn", "X% chance to burn", or the word "burn" appears
    // in a mechanical context (not just "burns everything" as flavor)
    const burnMatch = text.match(/(\d+)%\s+chance\s+(?:to\s+)?(?:inflict\s+)?burn/i)
                   || text.match(/inflict\s+burn|apply\s+burn|causes?\s+burn\s/i);
    if (burnMatch) {
      const chance = burnMatch[1] ? parseInt(burnMatch[1]) : 100;
      const dur = (text.match(/burn[^.]*?(\d+)\s+turn/i)||[])[1] || 3;
      effects.statusEffects.push({ type: 'burn', chance, duration: parseInt(dur) });
    } else if (/\bburn\b/.test(text) && /\d+%\s+(?:chance|hp\/turn|dmg\/turn)/i.test(text)) {
      // "15% chance to inflict BURN (5% max HP/turn for 3 turns)"
      const c = (text.match(/(\d+)%\s+chance/i)||[])[1] || 100;
      const dur = (text.match(/burn[^.]*?(\d+)\s+turn/i)||[])[1] || 3;
      effects.statusEffects.push({ type: 'burn', chance: parseInt(c), duration: parseInt(dur) });
    }

    // FREEZE
    const freezeMatch = text.match(/(\d+)%\s+chance\s+(?:to\s+)?(?:inflict\s+|apply\s+)?freeze/i)
                     || text.match(/inflict\s+freeze|apply\s+freeze|to\s+freeze\b/i);
    if (freezeMatch) {
      const chance = freezeMatch[1] ? parseInt(freezeMatch[1]) : 100;
      const dur = (text.match(/freeze[^.]*?(\d+)\s+turn/i)||[])[1] || 2;
      effects.statusEffects.push({ type: 'freeze', chance, duration: parseInt(dur) });
    } else if (/\bfreeze\b/.test(text) && /\d+%/.test(text) && !/aoe freeze/.test(text)) {
      // e.g. "50% chance to FREEZE (1 turn)"
      const c = (text.match(/(\d+)%\s+(?:chance|to)/i)||[])[1] || 60;
      effects.statusEffects.push({ type: 'freeze', chance: parseInt(c), duration: 1 });
    } else if (/aoe freeze|frost volley|absolute zero/i.test(text)) {
      effects.statusEffects.push({ type: 'freeze', chance: 60, duration: 1 });
    }

    // POISON
    const poisonMatch = text.match(/(\d+)%\s+chance\s+(?:to\s+)?(?:inflict\s+)?poison/i)
                     || text.match(/inflict\s+(?:poison|toxic)|apply\s+poison|applies\s+poison/i)
                     || text.match(/poison\s+all|aoe\s+poison/i);
    if (poisonMatch) {
      const chance = poisonMatch[1] ? parseInt(poisonMatch[1]) : 100;
      const dur = (text.match(/poison[^.]*?(\d+)\s+turn/i)||[])[1] || 4;
      const dmg = (text.match(/(\d+)\s+dmg\/turn/i)||[])[1] || 0;
      effects.statusEffects.push({ type: 'poison', chance, duration: parseInt(dur), tickDamage: parseInt(dmg) });
    }

    // STUN / PARALYZE
    const stunMatch = text.match(/(\d+)%\s+chance\s+(?:to\s+)?(?:inflict\s+)?(?:stun|paralyze)/i)
                   || text.match(/stuns?\s+(?:all|target|the\s+enemy)|paralyze/i);
    if (stunMatch) {
      const chance = stunMatch[1] ? parseInt(stunMatch[1]) : (text.includes('stuns all') ? 80 : 100);
      const dur = (text.match(/(?:stun|paralyze)[^.]*?(\d+)\s+turn/i)||[])[1] || 1;
      effects.statusEffects.push({ type: 'stun', chance, duration: parseInt(dur) });
    }

    // BLEED
    const bleedMatch = text.match(/(\d+)%\s+chance\s+(?:to\s+)?(?:inflict\s+)?bleed/i)
                    || text.match(/inflict\s+bleed|apply\s+bleed|causes?\s+bleed|massive\s+bleed/i);
    if (bleedMatch) {
      const chance = bleedMatch[1] ? parseInt(bleedMatch[1]) : 100;
      const dur = (text.match(/bleed[^.]*?(\d+)\s+turn/i)||[])[1] || 3;
      effects.statusEffects.push({ type: 'bleed', chance, duration: parseInt(dur) });
    }

    // SLOW
    const slowMatch = text.match(/(\d+)%\s+(?:chance\s+to\s+)?slow/i)
                   || text.match(/slows?\s+(?:all|movement|enemies|target)/i);
    if (slowMatch) {
      const chance = slowMatch[1] ? parseInt(slowMatch[1]) : 100;
      effects.statusEffects.push({ type: 'slow', chance, duration: 2 });
    }

    // WEAKEN
    if (/\bweaken\b/.test(text)) {
      effects.statusEffects.push({ type: 'weaken', chance: 100, duration: 3 });
    }

    // ── BUFFS (self) ──────────────────────────────────────────
    // Collect ALL +X% ATK/DEF/SPD/CRIT buffs from multi-line effect text
    // Uses matchAll so we get every line, not just the first
    const buffLines = effectText.split('\n');
    for (const line of buffLines) {
      const lLine = line.toLowerCase();
      // ATK buff
      const atkM = line.match(/\+(\d+)%\s+(?:all\s+stats?|atk|attack)/i);
      if (atkM) {
        const dur = (line.match(/(?:(\d+)\s+turn)/i)||[])[1] || 3;
        // avoid adding duplicate
        if (!effects.buffs.find(b => b.stat === 'atk' && b.amount === parseInt(atkM[1]))) {
          effects.buffs.push({ stat: 'atk', amount: parseInt(atkM[1]), duration: parseInt(dur) });
        }
      }
      // DEF buff — only "+" not "-"
      const defM = line.match(/\+(\d+)%\s+(?:all\s+stats?|def(?:ense)?)/i);
      if (defM) {
        const dur = (line.match(/(\d+)\s+turn/i)||[])[1] || 3;
        if (!effects.buffs.find(b => b.stat === 'def' && b.amount === parseInt(defM[1]))) {
          effects.buffs.push({ stat: 'def', amount: parseInt(defM[1]), duration: parseInt(dur) });
        }
      }
      // SPD buff
      const spdM = line.match(/\+(\d+)%\s+(?:spd|speed)/i);
      if (spdM) {
        if (!effects.buffs.find(b => b.stat === 'speed')) {
          const dur = (line.match(/(\d+)\s+turn/i)||[])[1] || 3;
          effects.buffs.push({ stat: 'speed', amount: parseInt(spdM[1]), duration: parseInt(dur) });
        }
      }
      // CRIT CHANCE buff
      const critM = line.match(/\+(\d+)%\s+crit(?:\s+(?:chance|rate))?/i);
      if (critM && !lLine.includes('crit damage') && !lLine.includes('crit dmg')) {
        if (!effects.buffs.find(b => b.stat === 'critChance')) {
          const dur = (line.match(/(\d+)\s+turn/i)||[])[1] || 3;
          effects.buffs.push({ stat: 'critChance', amount: parseInt(critM[1]), duration: parseInt(dur) });
        }
      }
    }

    // Dodge buff
    if (/dodge next attack|shadow step|vanish|invisible/i.test(text)) {
      effects.special.push({ type: 'dodgeNext', duration: 1 });
    }

    // ── DEBUFFS (enemy) ───────────────────────────────────────
    // Only match explicit "-X% enemy atk/def/accuracy"
    // Only treat as ENEMY debuff if the text explicitly says "enemy" or "target"
    // Self-penalties like "-20% DEF" in Rampage/Berserk should NOT reduce enemy stats
    const atkDebuff = text.match(/[-−](\d+)%\s+enemy\s+(?:atk|attack)/i)
                   || text.match(/[-−](\d+)%\s+target\s+(?:atk|attack)/i)
                   || text.match(/target takes \+(\d+)%\s+damage/i);
    if (atkDebuff) {
      effects.debuffs.push({ stat: 'atk', amount: parseInt(atkDebuff[1]), duration: 3 });
    }

    const defDebuff = text.match(/[-−](\d+)%\s+enemy\s+(?:def|defense|armor)/i)
                   || text.match(/[-−](\d+)%\s+target\s+(?:def|defense|armor)/i);
    if (defDebuff) {
      effects.debuffs.push({ stat: 'def', amount: parseInt(defDebuff[1]), duration: 3 });
    }

    // Self-DEF penalty (e.g. Rampage "-20% DEF", Berserk "-50% DEF") — stored as selfDebuff
    // This means the caster temporarily lowers their OWN defense
    const selfDefPenalty = text.match(/[-−](\d+)%\s+def(?:ense)?(?!.*enemy)/i);
    if (selfDefPenalty && !text.match(/enemy def|target def/i)) {
      // Confirm it's truly self-targeted: no "enemy" qualifier anywhere near this match
      const penAmt = parseInt(selfDefPenalty[1]);
      const durStr = (text.match(/def(?:ense)?[^.]*?(\d+)\s+turn/i)||[])[1];
      effects.selfDebuffs = effects.selfDebuffs || [];
      effects.selfDebuffs.push({ stat: 'def', amount: penAmt, duration: parseInt(durStr || 3) });
    }

    // Self-damage-taken increase ("take X% more damage")
    const selfDamageTaken = text.match(/take\s+(\d+)%\s+more\s+damage/i);
    if (selfDamageTaken) {
      effects.selfDebuffs = effects.selfDebuffs || [];
      effects.selfDebuffs.push({ stat: 'damageTaken', amount: parseInt(selfDamageTaken[1]), duration: 3 });
    }

    // Accuracy debuff — only explicit "-X% accuracy" or "All enemies -50% accuracy"
    const accDebuff = text.match(/[-−](\d+)%\s+(?:enemy\s+)?accuracy/i)
                   || text.match(/all\s+enemies\s+-(\d+)%\s+accuracy/i);
    if (accDebuff) {
      const dur = (text.match(/accuracy[^.]*?(\d+)\s+turn/i)||[])[1] || 2;
      effects.debuffs.push({ stat: 'accuracy', amount: parseInt(accDebuff[1]), duration: parseInt(dur) });
    }

    // ── SPECIAL MECHANICS ─────────────────────────────────────

    // Lifesteal
    const lsMatch = text.match(/heal\s+(\d+)%\s+of\s+damage/i) || text.match(/lifesteal.*?(\d+)%/i);
    if (lsMatch) {
      effects.special.push({ type: 'lifesteal', amount: parseInt(lsMatch[1]) });
    } else if (/massive lifesteal|blood feast|consume all|vampiric/i.test(text)) {
      effects.special.push({ type: 'lifesteal', amount: 50 });
    } else if (/lifesteal/i.test(text)) {
      effects.special.push({ type: 'lifesteal', amount: 30 });
    }

    // Armor penetration
    const armorPen = text.match(/ignores?\s+(\d+)%\s+(?:defense|armor|magic resistance)/i);
    if (armorPen) {
      effects.special.push({ type: 'armorPenetration', amount: parseInt(armorPen[1]) });
    } else if (/pierce all|bypasses? all|pierces all defenses|ignores all/i.test(text)) {
      effects.special.push({ type: 'armorPenetration', amount: 100 });
    }

    // Execute / instant kill
    const execMatch = text.match(/(?:execute|instant\s*kill|instantly\s*kills?)\s*[^%]*?<\s*(\d+)%/i);
    if (execMatch) {
      effects.special.push({ type: 'instantKill', hpThreshold: parseInt(execMatch[1]) });
    }
    // "High damage if enemy <50% HP" — double damage below threshold
    const condDmg = text.match(/(?:bonus|extra|high)\s+damage\s+if\s+(?:enemy|target)\s+[<]\s*(\d+)%\s+hp/i);
    if (condDmg) {
      effects.special.push({ type: 'conditionalDamage', hpThreshold: parseInt(condDmg[1]), multiplier: 2.0 });
    }

    // Invulnerable
    if (/invulnerable for (\d+)/i.test(text)) {
      const dur = (text.match(/invulnerable for (\d+)/i)||[])[1] || 2;
      effects.special.push({ type: 'invulnerable', duration: parseInt(dur) });
    }

    // Always crit
    if (/always crit|guaranteed crit/i.test(text)) {
      effects.special.push({ type: 'guaranteedCrit' });
    }

    // Cannot miss
    if (/cannot miss|never misses?|guaranteed hit|perfect shot/i.test(text)) {
      effects.special.push({ type: 'cannotMiss' });
    }

    // HP sacrifice → damage boost
    if (/hp\s+(?:to\s+damage|sacrifice)|blood pact/i.test(text)) {
      effects.special.push({ type: 'hpSacrifice', percent: 20 });
    }

    // Mana → damage
    if (/damage based on.*mana|uses all.*mana/i.test(text)) {
      effects.special.push({ type: 'manaDamage' });
    }

    // Max HP % damage
    const maxHpDmg = text.match(/(\d+)%\s+of\s+(?:target|enemy)(?:'s)?\s+max\s+hp/i)
                  || text.match(/deals?\s+%\s+max\s+hp\s+damage/i);
    if (maxHpDmg) {
      effects.special.push({ type: 'maxHpDamage', percent: parseInt(maxHpDmg[1] || 30) });
    }

    // Survive lethal
    if (/survive lethal|cannot die|last stand|lich form/i.test(text)) {
      effects.special.push({ type: 'surviveLethal' });
    }

    // Self-heal (non-lifesteal)
    if (/\bheal\s+(?:all\s+allies|greatly|massively|you|over\s+time)\b|major\s+heal|lay\s+on\s+hands/i.test(text) && !lsMatch) {
      const healPct = (text.match(/heal[^.]*?(\d+)%/i)||[])[1];
      effects.special.push({ type: 'selfHeal', percent: parseInt(healPct || 25) });
    }

    return effects;
  }

  // ─────────────────────────────────────────────────────────────
  // APPLY PARSED EFFECTS TO COMBAT
  // ─────────────────────────────────────────────────────────────
  static applyEffects(parsedEffects, attacker, defender, baseDamage, StatusEffectManager) {
    let finalDamage = parsedEffects.damage ? baseDamage : 0;
    let narrative = '';

    // Special mechanics that modify damage first
    for (const special of parsedEffects.special) {
      if (special.type === 'hpSacrifice') {
        const sacrifice = Math.floor(attacker.stats.hp * (special.percent / 100));
        attacker.stats.hp = Math.max(1, attacker.stats.hp - sacrifice);
        narrative += `🩸 Sacrificed ${sacrifice} HP to empower the skill!\n`;
      }

      if (special.type === 'manaDamage') {
        const manaBonus = attacker.stats.energy || 0;
        attacker.stats.energy = 0;
        finalDamage += manaBonus;
        narrative += `🔮 Channeled all ${manaBonus} energy into the attack!\n`;
      }

      if (special.type === 'maxHpDamage') {
        finalDamage = Math.floor((defender.stats?.maxHp || defender.stats?.hp || 100) * (special.percent / 100));
        narrative += `💀 Deals ${special.percent}% of max HP as damage!\n`;
      }

      if (special.type === 'conditionalDamage') {
        const hpPct = (defender.stats.hp / (defender.stats.maxHp || 1)) * 100;
        if (hpPct < special.hpThreshold) {
          finalDamage = Math.floor(finalDamage * special.multiplier);
          narrative += `💥 Enemy is below ${special.hpThreshold}% HP — bonus damage!\n`;
        }
      }

      if (special.type === 'instantKill') {
        const hpPct = (defender.stats.hp / (defender.stats.maxHp || 1)) * 100;
        if (hpPct < special.hpThreshold) {
          defender.stats.hp = 0;
          narrative += `💀 EXECUTE! Enemy below ${special.hpThreshold}% HP — instant kill!\n`;
          return { damage: 9999, narrative, instakill: true };
        }
      }

      if (special.type === 'lifesteal') {
        const heal = Math.floor(finalDamage * (special.amount / 100));
        if (heal > 0) {
          attacker.stats.hp = Math.min(attacker.stats.maxHp, attacker.stats.hp + heal);
          narrative += `💚 Lifesteal: healed ${heal} HP!\n`;
        }
      }

      if (special.type === 'invulnerable') {
        if (!attacker.buffs) attacker.buffs = [];
        attacker.buffs.push({ stat: 'invulnerable', amount: 0, duration: special.duration, name: 'Invulnerable' });
        narrative += `🛡️ Invulnerable for ${special.duration} turns!\n`;
      }

      if (special.type === 'dodgeNext') {
        if (!attacker.buffs) attacker.buffs = [];
        attacker.buffs.push({ stat: 'dodge', amount: 100, duration: 1, name: 'Shadow Step' });
        narrative += `👻 Will dodge the next attack!\n`;
      }

      if (special.type === 'selfHeal') {
        const heal = Math.floor(attacker.stats.maxHp * (special.percent / 100));
        attacker.stats.hp = Math.min(attacker.stats.maxHp, attacker.stats.hp + heal);
        narrative += `💚 Healed ${heal} HP! (${attacker.stats.hp}/${attacker.stats.maxHp})\n`;
      }

      if (special.type === 'surviveLethal') {
        if (!attacker.buffs) attacker.buffs = [];
        attacker.buffs.push({ stat: 'surviveLethal', amount: 1, duration: 3, name: 'Last Stand' });
        narrative += `💀 You will survive one lethal blow!\n`;
      }

      if (special.type === 'armorPenetration') {
        narrative += `🗡️ Ignores ${special.amount}% armor!\n`;
      }
    }

    // Status effects on defender
    for (const effect of parsedEffects.statusEffects) {
      if (Math.random() * 100 < effect.chance) {
        if (StatusEffectManager?.applyEffect) {
          StatusEffectManager.applyEffect(defender, effect.type.toUpperCase(), effect.duration);
        } else {
          if (!defender.statusEffects) defender.statusEffects = [];
          defender.statusEffects.push({ type: effect.type.toUpperCase(), duration: effect.duration });
        }
        const icons = { burn:'🔥', freeze:'❄️', poison:'☠️', stun:'💫', bleed:'🩸', slow:'🐢', weaken:'💀' };
        const eName = effect.type.charAt(0).toUpperCase() + effect.type.slice(1);
        narrative += `${icons[effect.type]||'⚡'} ${defender.name||'Enemy'} is ${eName.toUpperCase()}! (${effect.duration} turns)\n`;
      }
    }

    // Buffs on attacker
    for (const buff of parsedEffects.buffs) {
      if (!attacker.buffs) attacker.buffs = [];
      attacker.buffs.push({ stat: buff.stat, amount: buff.amount, duration: buff.duration, name: buff.stat });
      narrative += `⬆️ +${buff.amount}% ${buff.stat.toUpperCase()} for ${buff.duration} turns!\n`;
    }

    // Debuffs on defender
    for (const debuff of parsedEffects.debuffs) {
      if (!defender.debuffs) defender.debuffs = [];
      defender.debuffs.push({ stat: debuff.stat, amount: debuff.amount, duration: debuff.duration });
      narrative += `📉 ${defender.name||'Enemy'} -${debuff.amount}% ${debuff.stat.toUpperCase()} for ${debuff.duration} turns!\n`;
    }

    // Self-debuffs on attacker (e.g. Rampage -20% DEF, Berserk -50% DEF)
    for (const sd of (parsedEffects.selfDebuffs || [])) {
      if (!attacker.debuffs) attacker.debuffs = [];
      // Avoid stacking the same penalty multiple times
      const existing = attacker.debuffs.find(d => d.stat === sd.stat);
      if (existing) {
        existing.amount = Math.max(existing.amount, sd.amount);
        existing.duration = Math.max(existing.duration, sd.duration);
      } else {
        attacker.debuffs.push({ stat: sd.stat, amount: sd.amount, duration: sd.duration });
      }
      if (sd.stat === 'damageTaken') {
        narrative += `⚠️ You take ${sd.amount}% more damage for ${sd.duration} turns (reckless state)!\n`;
      } else {
        narrative += `⬇️ Your ${sd.stat.toUpperCase()} reduced by ${sd.amount}% for ${sd.duration} turns!\n`;
      }
    }

    return { damage: finalDamage, narrative, instakill: false };
  }
}

module.exports = EffectParser;