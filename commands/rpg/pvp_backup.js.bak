const StatusEffectManager = require('../../rpg/utils/StatusEffectManager');
const BarSystem           = require('../../rpg/utils/BarSystem');
const PetManager          = require('../../rpg/utils/PetManager');
const ImprovedCombat      = require('../../rpg/utils/ImprovedCombat');
const LevelUpManager      = require('../../rpg/utils/LevelUpManager');
const AchievementManager  = require('../../rpg/utils/AchievementManager');

// ═══════════════════════════════════════════════════════════════
// PENDING CHALLENGES
// ═══════════════════════════════════════════════════════════════
const pendingChallenges = new Map();

// ═══════════════════════════════════════════════════════════════
// ELO & RANKS
// ═══════════════════════════════════════════════════════════════
const PVP_RANKS = [
  { name:'Unranked',    emoji:'⚪', minElo:0    },
  { name:'Bronze',      emoji:'🥉', minElo:800  },
  { name:'Silver',      emoji:'🥈', minElo:1000 },
  { name:'Nexus',        emoji:'🥇', minElo:1200 },
  { name:'Platinum',    emoji:'💠', minElo:1400 },
  { name:'Diamond',     emoji:'💎', minElo:1600 },
  { name:'Master',      emoji:'🏆', minElo:1800 },
  { name:'Grandmaster', emoji:'👑', minElo:2000 },
  { name:'Legend',      emoji:'🌟', minElo:2200 },
];
function getPvpRank(elo) {
  const e = elo || 1000;
  let r = PVP_RANKS[0];
  for (const rank of PVP_RANKS) if (e >= rank.minElo) r = rank;
  return r;
}
function calcEloChange(wElo, lElo) {
  return Math.round(32 * (1 - 1 / (1 + Math.pow(10, (lElo - wElo) / 400))));
}

// ═══════════════════════════════════════════════════════════════
// CLASS MATCHUPS — covers all 23 classes
// ═══════════════════════════════════════════════════════════════
const CLASS_MATCHUPS = {
  Warrior:      { strongVs:['Archer','Berserker','Warlord'],       weakVs:['Mage','Paladin','Elementalist'] },
  Mage:         { strongVs:['Warrior','DragonKnight','BloodKnight'],weakVs:['Rogue','Assassin','Phantom'] },
  Archer:       { strongVs:['Mage','Rogue','Shaman'],              weakVs:['Warrior','Berserker','Warlord'] },
  Rogue:        { strongVs:['Mage','Necromancer','SpellBlade'],     weakVs:['Archer','Paladin','Monk'] },
  Paladin:      { strongVs:['Rogue','Berserker','BloodKnight'],     weakVs:['Archer','DragonKnight','Chronomancer'] },
  Berserker:    { strongVs:['Archer','Rogue','ShadowDancer'],       weakVs:['Warrior','Paladin','Summoner'] },
  Necromancer:  { strongVs:['Paladin','DragonKnight','Warlord'],    weakVs:['Rogue','Devourer','Phantom'] },
  Assassin:     { strongVs:['Mage','Necromancer','SpellBlade'],     weakVs:['Warrior','Paladin','Monk'] },
  DragonKnight: { strongVs:['Paladin','Devourer','Warlord'],        weakVs:['Mage','Necromancer','Elementalist'] },
  Devourer:     { strongVs:['Necromancer','Rogue','BloodKnight'],   weakVs:['DragonKnight','Warrior','Warlord'] },
  Monk:         { strongVs:['Rogue','Assassin','ShadowDancer'],     weakVs:['Mage','Necromancer','Chronomancer'] },
  Shaman:       { strongVs:['Warrior','Archer','Warlord'],          weakVs:['Mage','Rogue','Phantom'] },
  BloodKnight:  { strongVs:['Paladin','Warrior','Shaman'],          weakVs:['Mage','Devourer','Elementalist'] },
  SpellBlade:   { strongVs:['Warrior','Berserker','Warlord'],       weakVs:['Rogue','Assassin','Phantom'] },
  Summoner:     { strongVs:['Berserker','Warrior','DragonKnight'],  weakVs:['Assassin','Rogue','ShadowDancer'] },
  Warlord:      { strongVs:['Archer','Rogue','Shaman'],             weakVs:['Mage','DragonKnight','Chronomancer'] },
  Elementalist: { strongVs:['Warrior','DragonKnight','BloodKnight'],weakVs:['Rogue','Assassin','Phantom'] },
  ShadowDancer: { strongVs:['Mage','Necromancer','Summoner'],       weakVs:['Warrior','Berserker','Warlord'] },
  Chronomancer: { strongVs:['Paladin','Warrior','Warlord'],         weakVs:['Rogue','Berserker','ShadowDancer'] },
  Phantom:      { strongVs:['Mage','Necromancer','Shaman'],         weakVs:['Warrior','Berserker','BloodKnight'] },
  Knight:       { strongVs:['Berserker','Rogue','Shaman'],          weakVs:['Mage','Archer','Chronomancer'] },
  Ranger:       { strongVs:['Mage','DragonKnight','Shaman'],        weakVs:['Warrior','Berserker','BloodKnight'] },
};
function getMatchup(aClass, dClass) {
  const m = CLASS_MATCHUPS[aClass];
  if (!m) return { mult:1.0, msg:'' };
  if (m.strongVs?.includes(dClass)) return { mult:1.15, msg:`⚡ *Class Advantage!* (+15%)` };
  if (m.weakVs?.includes(dClass))   return { mult:0.88, msg:`🛡️ *Class Disadvantage* (-12%)` };
  return { mult:1.0, msg:'' };
}

// ═══════════════════════════════════════════════════════════════
// CLASS SPECIALS — each unique, no duplicates
// ═══════════════════════════════════════════════════════════════
const CLASS_SPECIALS = {
  Warrior:      { name:'Bladestorm',         desc:'Hit 3×70% ATK ignoring 40% DEF. Stuns if all 3 land.',   dmgMult:[0.7,0.7,0.7], armorPen:0.4, stunOnAllHit:true },
  Mage:         { name:'Arcane Overload',    desc:'200% magic dmg. Drain 25 enemy energy. Silence 1 turn.', dmgMult:[2.0], burnEnergy:25, silenceEnemy:true },
  Archer:       { name:'Snipe',              desc:'Guaranteed crit 180% unblockable. Extra +30% if enemy < 50% HP.', dmgMult:[1.8], guaranteeCrit:true, unblockable:true, execBonus:0.30 },
  Rogue:        { name:'Shadowstrike',       desc:'150% + BLIND 2 turns. Gain vanish (dodge next attack).', dmgMult:[1.5], applyBlind:true, gainVanish:true },
  Paladin:      { name:'Divine Judgment',    desc:'120% holy + heal 25% dmg dealt. Shield ally for 2 turns.',dmgMult:[1.2], selfHealPct:0.25, gainShield:true },
  Berserker:    { name:'Primal Rage',        desc:'220% unblockable. Self-damage 10% HP. +40% ATK next 2 turns.', dmgMult:[2.2], selfDmgPct:0.10, unblockable:true, rageBuffTurns:2 },
  Necromancer:  { name:'Soul Rend',          desc:'120% + drain 20% max HP. Revive with 15% HP on death this battle.', dmgMult:[1.2], drainMaxHpPct:0.20, deathRevive:true },
  Assassin:     { name:'Death Mark',         desc:'30% of target current HP instant. If target < 20%, execute.',hpExecute:0.30, executeThreshold:0.20 },
  DragonKnight: { name:'Dragon Breath',      desc:'160% fire. 70% BURN 3t. If already burning: 240% instead.', dmgMult:[1.6], applyBurn:true, burnChance:0.70, burnBonus:2.4 },
  Devourer:     { name:'Feast',              desc:'100% + steal all enemy buffs + 60% lifesteal.',           dmgMult:[1.0], stealBuffs:true, lifestealPct:0.60 },
  Monk:         { name:'Final Form',         desc:'+50% ATK/SPD 3 turns. All hits guaranteed crit. 20% lifesteal.', dmgMult:[1.8], selfBuff:true, selfBuffAtk:50, selfBuffSpd:50, lifestealPct:0.20, guaranteeCrit:true },
  Shaman:       { name:"Nature's Fury",      desc:'200% nature AOE. 40% STUN each. Poison all 3t.',         dmgMult:[2.0], aoe:true, stunChance:0.40, poisonAll:true },
  BloodKnight:  { name:'Crimson Apocalypse', desc:'280% true dmg. 40% max HP lifesteal. BLEED+WEAKEN 5t.',  dmgMult:[2.8], armorPen:1.0, lifestealPct:0.40, applyBleed:true, applyWeaken:true },
  SpellBlade:   { name:'Spellblade Finale',  desc:'250% magic+physical. +2% per current arcane/energy.',    dmgMult:[2.5], armorPen:0.3, scaleWithEnergy:true },
  Summoner:     { name:'Apocalypse Summon',  desc:'300% dmg. All negative statuses 50% each.',              dmgMult:[3.0], applyAll:true },
  Warlord:      { name:'Conquest',           desc:'3×90% unblockable. Each hit stacks -10% enemy DEF.',     dmgMult:[0.9,0.9,0.9], unblockable:true, defShred:0.10 },
  Elementalist: { name:'Elemental Chaos',    desc:'220% chaotic damage. Random element bonus each hit. 50% all status effects.', dmgMult:[2.2], randomElement:true, applyAll:true },
  ShadowDancer: { name:'Final Curtain',      desc:'350% true. Absolute dodge next 2 turns. Auto-counter everything.', dmgMult:[3.5], armorPen:1.0, gainAbsoluteDodge:2, autoCounter:true },
  Chronomancer: { name:'Temporal Collapse',  desc:'240% + STUN+SLOW 2t. Reset 1 enemy skill cooldown to max.',dmgMult:[2.4], armorPen:0.5, applyStun:true, applySlow:true },
  Phantom:      { name:'Phantom Apocalypse', desc:'380% true. All statuses. Reduce enemy to 1 HP if >80% dealt.', dmgMult:[3.8], armorPen:1.0, guaranteeCrit:true, applyAll:true, toOneHp:0.80 },
  Knight:       { name:'Excalibur',          desc:'300% holy true. STUN+WEAKEN+SILENCE. Heal 20% max HP.', dmgMult:[3.0], armorPen:1.0, silenceEnemy:true, applyWeaken:true, applyStun:true, selfHealPct:0.20 },
  Ranger:       { name:'Hunter\'s End',      desc:'260% + BLEED+SLOW+BLIND all 3t. +50% if target below 60% HP.', dmgMult:[2.6], applyBleed:true, applySlow:true, applyBlind:true, execBonus:0.50 },
};

// ═══════════════════════════════════════════════════════════════
// DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════
function getMomentumBar(n) {
  const f = Math.min(5, Math.floor(n||0));
  return '🔴'.repeat(f) + '⚫'.repeat(5-f);
}
function getUltiBar(n) {
  const f = Math.min(5, Math.floor(n||0));
  return '🟣'.repeat(f) + '⬛'.repeat(5-f);
}
function getStaggerBar(n) {
  const s = Math.min(3, n||0);
  return ['⬜','⬜','⬜'].map((_,i)=> i < s ? (s===3?'🔴':'🟡') : '⬜').join('');
}
function getThreatIcon(hpPct) {
  if (hpPct <= 0.15) return '💀';
  if (hpPct <= 0.30) return '❗';
  if (hpPct <= 0.50) return '⚠️';
  return '✅';
}

// ═══════════════════════════════════════════════════════════════
// BATTLE STATE HELPERS
// ═══════════════════════════════════════════════════════════════
function initBattleState(opponentId, chatId) {
  return {
    opponentId, chatId,
    turnNumber: 1,
    pendingAction: null,
    startTime: Date.now(),
    // Momentum (0-5): filled by landing hits, crits give +2
    momentum: 0,
    // Ultimate gauge (0-5): filled by damage dealt & taking damage
    ultiGauge: 0,
    ultiReady: false,
    // Stagger on OPPONENT (0-3): crits build this, at 3 = stun opponent
    stagger: 0,
    // Per-turn flags
    guarding: false,
    parryReady: false,     // Perfect parry: if guard while opponent uses special → full counter
    counterBonus: false,
    forcedSkip: false,
    forcedAttack: false,
    forcedAtkPenalty: 0,
    // Sustained effects
    comboCount: 0,
    lastAction: null,
    lastDmgDealt: 0,
    consecutiveGuards: 0,
    // Rage mode (< 20% HP: +30% ATK, -15% DEF)
    rageMode: false,
    // Vanish (dodge next hit completely)
    vanish: false,
    absoluteDodgeTurns: 0,
    autoCounter: false,
    deathReviveUsed: false,
    petSacrificed: false,
    shieldActive: false,
    // Reaction info for narrative
    lastSpecialUsed: null,
  };
}

function processBuffDurations(entity) {
  if (!entity.buffs) { entity.buffs = []; return; }
  entity.buffs = entity.buffs.filter(b => { b.duration--; return b.duration > 0; });
}

function getClassName(player) {
  return typeof player.class === 'object' ? player.class.name : (player.class || 'Warrior');
}

function getTotalAtk(player) {
  const mods   = StatusEffectManager.getStatModifiers(player);
  const weapon = player.weapon?.bonus || player.weapon?.attack || 0;
  let petAtk   = 0;
  try { const pb = PetManager.getPetBattleBonus(player.userId||''); petAtk = pb?.bonuses?.atk || 0; } catch(e) {}
  let atk = Math.floor((player.stats.atk + weapon + petAtk) * mods.atkMod);
  if (player.buffs?.length) {
    let bMult = 0;
    player.buffs.forEach(b => { if (b.stat === 'atk') bMult += b.amount; });
    atk = Math.floor(atk * (1 + bMult / 100));
  }
  return atk;
}

// ═══════════════════════════════════════════════════════════════
// CALCULATE ONE PLAYER'S ACTION
// Returns: { damage, narrative, energyCost, momentumGain,
//            staggerAdd, isCrit, unblockable, healing }
// ═══════════════════════════════════════════════════════════════
function calculateAction(attacker, defender, action, atkState, defState) {
  const aClass   = getClassName(attacker);
  const dClass   = getClassName(defender);
  const matchup  = getMatchup(aClass, dClass);
  const totalAtk = getTotalAtk(attacker);

  // ── Hard status: skip turn ──────────────────────────────────
  const blocked = attacker.statusEffects?.find(e => ['stun','freeze','paralyze'].includes(e.type));
  if (blocked || atkState.forcedSkip) {
    atkState.forcedSkip = false;
    return {
      damage:0, narrative:`🔒 *${attacker.name}* is ${blocked?.type.toUpperCase() || 'STUNNED'} — turn skipped!\n`,
      energyCost:0, momentumGain:0, staggerAdd:0, isCrit:false, healing:0
    };
  }
  // Fear: 40% chance to miss turn
  const feared = attacker.statusEffects?.find(e => e.type === 'fear');
  if (feared && Math.random() < 0.40) {
    return {
      damage:0, narrative:`😱 *${attacker.name}* is paralysed with FEAR — wasted turn!\n`,
      energyCost:0, momentumGain:0, staggerAdd:0, isCrit:false, healing:0
    };
  }

  // Counter bonus from guard interrupt
  const counterMult = atkState.counterBonus ? 1.5 : 1.0;
  if (atkState.counterBonus) atkState.counterBonus = false;

  // ── GUARD ───────────────────────────────────────────────────
  if (action.type === 'guard') {
    atkState.guarding       = true;
    atkState.consecutiveGuards++;
    atkState.comboCount     = 0;
    atkState.lastAction     = 'guard';
    // After 2 consecutive guards: parry ready (perfect parry on next special against them)
    if (atkState.consecutiveGuards >= 2) atkState.parryReady = true;
    const parryMsg = atkState.parryReady ? `\n✨ *PARRY READY!* Perfect counter primed!` : '';
    return {
      damage:0,
      narrative:`🛡️ *${attacker.name}* braces for impact!\n> 65% damage reduction active.${parryMsg}\n`,
      energyCost:0, momentumGain:0, staggerAdd:0, isCrit:false, healing:0, isGuard:true
    };
  }

  // Reset consecutive guards on any other action
  atkState.consecutiveGuards = 0;

  // ── TAUNT ───────────────────────────────────────────────────
  if (action.type === 'taunt') {
    defState.forcedAttack     = true;
    defState.forcedAtkPenalty = 0.30;
    atkState.momentum         = Math.min(5, (atkState.momentum||0) + 2);
    atkState.lastAction       = 'taunt';
    return {
      damage:0,
      narrative:`😤 *${attacker.name}* taunts boldly!\n> ${defender.name} MUST attack next turn (−30% ATK)\n> +2 ⚡ Momentum charged!\n`,
      energyCost:0, momentumGain:0, staggerAdd:0, isCrit:false, healing:0
    };
  }

  // ── PARRY (perfect active parry against incoming special) ───
  // Handled in executeBothActions if timing is right

  // ── BASIC ATTACK ────────────────────────────────────────────
  if (action.type === 'attack') {
    // Combo system
    if (atkState.lastAction === 'attack') atkState.comboCount = Math.min(4, (atkState.comboCount||0) + 1);
    else atkState.comboCount = 1;
    atkState.lastAction = 'attack';

    const comboBonus = atkState.comboCount >= 4 ? 0.40
                     : atkState.comboCount >= 3 ? 0.25
                     : atkState.comboCount >= 2 ? 0.12 : 0;
    const comboMsg   = atkState.comboCount >= 4 ? `🔥 *ULTRA COMBO ×${atkState.comboCount}!* +40% DMG!\n`
                     : atkState.comboCount >= 3 ? `🌀 *COMBO ×${atkState.comboCount}!* +25% DMG!\n`
                     : atkState.comboCount >= 2 ? `💫 *COMBO ×2!* +12% DMG!\n` : '';

    const critChance = 0.12 + ((attacker.stats.critChance || attacker.statAllocations?.critChance || 0) * 0.005);
    const isCrit     = Math.random() < critChance;
    const critMult   = 1.5 + ((attacker.stats.critDamage || attacker.statAllocations?.critDamage || 0) * 0.01);

    // Forced attack penalty
    let atkMult = 1.0;
    if (atkState.forcedAttack) { atkMult *= (1 - atkState.forcedAtkPenalty); atkState.forcedAttack = false; atkState.forcedAtkPenalty = 0; }

    let rawDmg = Math.floor(totalAtk * (isCrit ? critMult : 1.0) * matchup.mult * (1 + comboBonus) * counterMult * atkMult);

    // Rage mode bonus
    const hpPct = attacker.stats.hp / attacker.stats.maxHp;
    if (hpPct <= 0.20 && !atkState.rageMode) {
      atkState.rageMode = true;
    }
    if (atkState.rageMode) rawDmg = Math.floor(rawDmg * 1.30);

    const defRed  = Math.floor((defender.stats.def || 0) * 0.4);
    const finalDmg = Math.max(1, rawDmg - defRed);
    const lsPct    = (attacker.statAllocations?.lifesteal || 0) * 0.005;
    const lsHeal   = lsPct > 0 ? Math.floor(finalDmg * lsPct) : 0;
    if (lsHeal > 0) attacker.stats.hp = Math.min(attacker.stats.maxHp, attacker.stats.hp + lsHeal);

    let narrative = '';
    if (isCrit) narrative += `💥 *CRITICAL HIT!*\n`;
    if (atkState.rageMode && hpPct <= 0.20) narrative += `🩸 *RAGE MODE!* Low HP powers you up! (+30% ATK)\n`;
    if (comboMsg) narrative += comboMsg;
    if (matchup.msg) narrative += matchup.msg + '\n';
    narrative += `⚔️ *${attacker.name}* strikes for *${finalDmg}* damage!\n`;
    if (lsHeal > 0) narrative += `💚 Lifesteal: +${lsHeal} HP\n`;

    atkState.lastDmgDealt = finalDmg;

    return {
      damage: finalDmg, narrative,
      energyCost: 0, momentumGain: isCrit ? 2 : 1, staggerAdd: isCrit ? 2 : 1,
      isCrit, healing: lsHeal
    };
  }

  // ── USE SKILL ───────────────────────────────────────────────
  if (action.type === 'skill') {
    const silenced = attacker.statusEffects?.find(e => e.type === 'silence');
    if (silenced) return { damage:0, narrative:`🤐 *${attacker.name}* is SILENCED — skills locked!\n`, energyCost:0, momentumGain:0, staggerAdd:0, isCrit:false, healing:0 };

    const skill = attacker.skills?.active?.[action.skillIndex];
    if (!skill) return { damage:0, narrative:`❌ Skill not found!\n`, energyCost:0, momentumGain:0, staggerAdd:0, isCrit:false, healing:0 };
    const cost = skill.energyCost || 20;
    if (attacker.stats.energy < cost) return { damage:0, narrative:`❌ Need ${cost} ${attacker.energyType||'Energy'} (have ${attacker.stats.energy})!\n`, energyCost:0, momentumGain:0, staggerAdd:0, isCrit:false, healing:0 };

    const opStunned = defender.statusEffects?.find(e => ['stun','freeze','paralyze'].includes(e.type));
    const stunBonus  = opStunned ? 1.30 : 1.0;

    const result = ImprovedCombat.processSkill(attacker, defender, skill.name, { pvp: true });
    if (!result.success) return { damage:0, narrative: result.message || `❌ Skill failed!\n`, energyCost:0, momentumGain:0, staggerAdd:0, isCrit:false, healing:0 };

    const baseDmg  = result.damage || 0;
    const bonusMult = matchup.mult * stunBonus;
    const adjDmg   = Math.floor(baseDmg * bonusMult);
    if (adjDmg > baseDmg) defender.stats.hp = Math.max(0, defender.stats.hp - (adjDmg - baseDmg));

    atkState.lastDmgDealt = adjDmg;
    atkState.lastAction   = 'skill';
    atkState.comboCount   = 0; // skills break combo

    let narrative = result.narrative || `⚡ *${skill.name}* dealt *${adjDmg}* damage!\n`;
    if (opStunned) narrative += `⚡ *EXECUTE BONUS!* +30% vs stunned!\n`;
    if (matchup.msg) narrative += matchup.msg + '\n';

    return {
      damage: adjDmg, narrative, energyCost: cost,
      momentumGain: result.isCrit ? 2 : 1, staggerAdd: result.isCrit ? 2 : 1,
      isCrit: result.isCrit || false, healing: 0
    };
  }

  // ── CLASS SPECIAL ───────────────────────────────────────────
  if (action.type === 'special') {
    const sp = CLASS_SPECIALS[aClass];
    if (!sp) return { damage:0, narrative:`❌ No special for ${aClass}!\n`, energyCost:0, momentumGain:0, staggerAdd:0, isCrit:false, healing:0 };

    atkState.ultiGauge    = 0;
    atkState.ultiReady    = false;
    atkState.lastSpecialUsed = sp.name;
    atkState.lastAction   = 'special';
    atkState.comboCount   = 0;

    // Perfect parry check: if defender has parryReady and attacker just used special
    if (defState.parryReady) {
      defState.parryReady    = false;
      defState.counterBonus  = true;
      defState.momentum      = Math.min(5, (defState.momentum||0) + 3);
      const parryDmg         = Math.floor(totalAtk * 1.8);
      attacker.stats.hp      = Math.max(0, attacker.stats.hp - parryDmg);
      return {
        damage: 0, narrative: `🌀 *PERFECT PARRY!* ${defender.name} reads the special and counters!\n💥 *${parryDmg}* reflected damage!\n⚡ +3 Momentum!\n`,
        energyCost:0, momentumGain:0, staggerAdd:0, isCrit:false, healing:0, wasParried:true
      };
    }

    let totalDmg = 0;
    let narrative = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌟 *ULTIMATE: ${sp.name}!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (sp.hpExecute) {
      const execDmg = Math.floor(defender.stats.hp * sp.hpExecute);
      const hpPctDef = defender.stats.hp / defender.stats.maxHp;
      if (sp.executeThreshold && hpPctDef <= sp.executeThreshold) {
        defender.stats.hp = 0;
        narrative += `💀 *INSTANT EXECUTION!* Target was below ${Math.floor(sp.executeThreshold*100)}% HP!\n`;
        totalDmg = defender.stats.maxHp;
      } else {
        defender.stats.hp = Math.max(0, defender.stats.hp - execDmg);
        totalDmg = execDmg;
        narrative += `💀 *${sp.hpExecute*100}% CURRENT HP* ripped away! (${execDmg} dmg)\n`;
      }
    } else {
      const mults = sp.dmgMult || [1.5];
      let allHit = true;
      for (let i = 0; i < mults.length; i++) {
        const m       = mults[i];
        const pen     = sp.armorPen || 0;
        const defRed  = Math.floor((defender.stats.def || 0) * 0.4 * (1 - pen));
        let   hitDmg  = Math.floor(totalAtk * m * matchup.mult);
        if (!sp.unblockable) hitDmg -= defRed;
        // Energy scaling
        if (sp.scaleWithEnergy) {
          const energyBonus = Math.floor(attacker.stats.energy * 0.02);
          hitDmg += energyBonus;
        }
        // Dragon Breath burn bonus
        if (sp.burnBonus) {
          const alreadyBurning = defender.statusEffects?.find(e => e.type === 'burn');
          if (alreadyBurning) hitDmg = Math.floor(totalAtk * sp.burnBonus * matchup.mult);
        }
        hitDmg = Math.max(1, hitDmg);
        if (sp.defShred) {
          const shredAmt = Math.floor((defender.stats.def || 0) * sp.defShred);
          defender.stats.def = Math.max(0, (defender.stats.def || 0) - shredAmt);
          narrative += `🗡️ Hit ${i+1}: *${hitDmg}* dmg! DEF shredded by ${shredAmt}!\n`;
        } else if (mults.length > 1) {
          narrative += `⚔️ Hit ${i+1}: *${hitDmg}*\n`;
        }
        defender.stats.hp = Math.max(0, defender.stats.hp - hitDmg);
        totalDmg += hitDmg;
        if (hitDmg <= 0) allHit = false;
      }
      // Bladestorm stun on all hits
      if (sp.stunOnAllHit && allHit && mults.length > 1) {
        StatusEffectManager.applyEffect(defender, 'stun', 1);
        narrative += `⭐ *ALL 3 HITS LANDED — STUNNED!*\n`;
      }
      if (mults.length === 1) narrative += `💥 *${totalDmg}* total damage!\n`;
      else narrative += `💥 Total: *${totalDmg}* damage!\n`;
    }

    // to 1 HP mechanic
    if (sp.toOneHp && totalDmg >= defender.stats.maxHp * sp.toOneHp && defender.stats.hp > 1) {
      defender.stats.hp = 1;
      narrative += `☠️ *DEVASTATING BLOW* — reduced to 1 HP!\n`;
    }

    // Exec bonus for ranged finishers
    if (sp.execBonus) {
      const hpPctDef = defender.stats.hp / defender.stats.maxHp;
      const threshold = sp === CLASS_SPECIALS.Archer ? 0.50 : 0.60;
      if (hpPctDef <= threshold) {
        const bonus = Math.floor(totalDmg * sp.execBonus);
        defender.stats.hp = Math.max(0, defender.stats.hp - bonus);
        totalDmg += bonus;
        narrative += `🎯 *LOW HP BONUS!* +${bonus} extra dmg!\n`;
      }
    }

    // Self effects
    if (sp.selfDmgPct) { const sd = Math.floor(attacker.stats.maxHp * sp.selfDmgPct); attacker.stats.hp = Math.max(1, attacker.stats.hp - sd); narrative += `🩸 Self-inflicted ${sd} for power!\n`; }
    if (sp.selfHealPct) { const h = Math.floor((sp.hpExecute ? totalDmg : totalDmg) * sp.selfHealPct); attacker.stats.hp = Math.min(attacker.stats.maxHp, attacker.stats.hp + h); narrative += `💚 Lifesteal healed *${h}* HP!\n`; }
    if (sp.lifestealPct && totalDmg > 0) { const ls = Math.floor(totalDmg * sp.lifestealPct); attacker.stats.hp = Math.min(attacker.stats.maxHp, attacker.stats.hp + ls); narrative += `💚 Lifesteal: +${ls} HP!\n`; }
    if (sp.burnEnergy) { defender.stats.energy = Math.max(0, (defender.stats.energy||0) - sp.burnEnergy); narrative += `⚡ Drained *${sp.burnEnergy}* enemy energy!\n`; }
    if (sp.rageBuffTurns) { if (!attacker.buffs) attacker.buffs = []; attacker.buffs.push({stat:'atk',amount:40,duration:sp.rageBuffTurns,name:'Primal Rage'}); narrative += `🔥 +40% ATK for ${sp.rageBuffTurns} turns!\n`; }
    if (sp.selfBuff) { if (!attacker.buffs) attacker.buffs = []; attacker.buffs.push({stat:'atk',amount:sp.selfBuffAtk||50,duration:3,name:'Final Form'},{stat:'spd',amount:sp.selfBuffSpd||50,duration:3,name:'Final Form'}); narrative += `💪 +${sp.selfBuffAtk}% ATK & +${sp.selfBuffSpd}% SPD for 3 turns!\n`; }

    // Enemy status effects
    if (sp.silenceEnemy)  { StatusEffectManager.applyEffect(defender, 'silence', 2); narrative += `🤐 *SILENCED!* 2 turns!\n`; }
    if (sp.applyBlind)    { StatusEffectManager.applyEffect(defender, 'blind',   2); narrative += `🌫️ *BLINDED!* 2 turns!\n`; }
    if (sp.applyBurn && Math.random() < (sp.burnChance || 0.5)) { StatusEffectManager.applyEffect(defender, 'burn', 3); narrative += `🔥 *BURNING!* 3 turns!\n`; }
    if (sp.poisonAll)     { StatusEffectManager.applyEffect(defender, 'poison',  3); narrative += `☠️ *POISONED!* 3 turns!\n`; }
    if (sp.applyBleed)    { StatusEffectManager.applyEffect(defender, 'bleed',   5); narrative += `🩸 *BLEEDING!* 5 turns!\n`; }
    if (sp.applyWeaken)   { StatusEffectManager.applyEffect(defender, 'weaken',  3); narrative += `💔 *WEAKENED!* 3 turns!\n`; }
    if (sp.applyStun)     { StatusEffectManager.applyEffect(defender, 'stun',    2); narrative += `⭐ *STUNNED!* 2 turns!\n`; }
    if (sp.applySlow)     { StatusEffectManager.applyEffect(defender, 'slow',    2); narrative += `🐢 *SLOWED!* 2 turns!\n`; }
    if (sp.applyAll) {
      const allEffects = ['burn','poison','bleed','weaken','slow','fear'];
      for (const eff of allEffects) {
        if (Math.random() < 0.50) { StatusEffectManager.applyEffect(defender, eff, 3); narrative += `${eff === 'burn'?'🔥':eff==='poison'?'☠️':eff==='bleed'?'🩸':eff==='weaken'?'💔':eff==='slow'?'🐢':'😱'} *${eff.toUpperCase()}!*\n`; }
      }
    }

    // Buff steal
    if (sp.stealBuffs && defender.buffs?.length) {
      if (!attacker.buffs) attacker.buffs = [];
      attacker.buffs.push(...defender.buffs.map(b=>({...b})));
      const n = defender.buffs.length;
      defender.buffs = [];
      narrative += `🌀 *STOLE ${n} buff(s)!*\n`;
    }

    // Self-status grants
    if (sp.gainVanish)           { atkState.vanish = true; narrative += `👻 *VANISH!* Next attack completely dodged!\n`; }
    if (sp.gainShield)           { atkState.shieldActive = true; narrative += `🛡️ *DIVINE SHIELD!* 2 turns of protection!\n`; }
    if (sp.gainAbsoluteDodge)    { atkState.absoluteDodgeTurns = sp.gainAbsoluteDodge; narrative += `💨 *ABSOLUTE DODGE!* ${sp.gainAbsoluteDodge} turns — unhittable!\n`; }
    if (sp.autoCounter)          { atkState.autoCounter = true; narrative += `⚡ *AUTO-COUNTER!* Every attack will be reflected!\n`; }
    if (sp.deathRevive)          { atkState.deathReviveUsed = false; narrative += `💀 *SOUL PACT!* Will revive at 15% HP once!\n`; }

    narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (matchup.msg) narrative += matchup.msg + '\n';

    atkState.lastDmgDealt = totalDmg;

    return {
      damage: totalDmg, narrative,
      energyCost: 0, momentumGain: 0, staggerAdd: 2,
      isCrit: sp.guaranteeCrit || false, healing: 0
    };
  }

  return { damage:0, narrative:`❓ Unknown action\n`, energyCost:0, momentumGain:0, staggerAdd:0, isCrit:false, healing:0 };
}

// ═══════════════════════════════════════════════════════════════
// EXECUTE BOTH ACTIONS — the main resolution engine
// ═══════════════════════════════════════════════════════════════
async function executeBothActions(sock, chatId, p1, p2, db, save, sender) {
  const p1Id  = Object.keys(db.users).find(id => db.users[id] === p1) || sender;
  const p2Id  = Object.keys(db.users).find(id => db.users[id] === p2);
  const p1s   = p1.pvpBattle;
  const p2s   = p2.pvpBattle;
  const p1Act = p1s.pendingAction;
  const p2Act = p2s.pendingAction;
  const p1Cls = getClassName(p1);
  const p2Cls = getClassName(p2);

  // ── Resolve actions ────────────────────────────────────────
  const r1 = calculateAction(p1, p2, p1Act, p1s, p2s);
  const r2 = calculateAction(p2, p1, p2Act, p2s, p1s);

  // ── Speed ordering ─────────────────────────────────────────
  const p1Spd = (p1.stats.speed || 100) * (p1s.rageMode ? 1.0 : 1.0);
  const p2Spd = (p2.stats.speed || 100) * (p2s.rageMode ? 1.0 : 1.0);
  const p1First = p1Spd >= p2Spd;

  // ── Damage calculation with guards, dodge, shield ──────────
  let p1Takes = r2.damage;
  let p2Takes = r1.damage;

  // Guard reduction
  if (p1s.guarding && !r2.unblockable) p1Takes = Math.floor(p1Takes * 0.35);
  if (p2s.guarding && !r1.unblockable) p2Takes = Math.floor(p2Takes * 0.35);

  // Vanish (complete dodge)
  if (p1s.vanish && p1Takes > 0) { p1s.vanish = false; p1Takes = 0; }
  if (p2s.vanish && p2Takes > 0) { p2s.vanish = false; p2Takes = 0; }

  // Absolute dodge
  if (p1s.absoluteDodgeTurns > 0) { p1s.absoluteDodgeTurns--; p1Takes = 0; }
  if (p2s.absoluteDodgeTurns > 0) { p2s.absoluteDodgeTurns--; p2Takes = 0; }

  // Divine shield (50% reduction + healing)
  if (p1s.shieldActive) { p1Takes = Math.floor(p1Takes * 0.5); p1s.shieldActive = false; }
  if (p2s.shieldActive) { p2Takes = Math.floor(p2Takes * 0.5); p2s.shieldActive = false; }

  // Auto-counter: reflect damage back
  if (p1s.autoCounter && p1Takes > 0) { const reflect = Math.floor(p1Takes * 0.6); p2.stats.hp = Math.max(0, p2.stats.hp - reflect); p1s.autoCounter = false; }
  if (p2s.autoCounter && p2Takes > 0) { const reflect = Math.floor(p2Takes * 0.6); p1.stats.hp = Math.max(0, p1.stats.hp - reflect); p2s.autoCounter = false; }

  // Speed kill: if faster player kills, slower player can't hit back
  if (p1First && p2Takes >= p2.stats.hp) p1Takes = 0;
  if (!p1First && p1Takes >= p1.stats.hp) p2Takes = 0;

  // Apply HP damage
  p1.stats.hp = Math.max(0, p1.stats.hp - p1Takes);
  p2.stats.hp = Math.max(0, p2.stats.hp - p2Takes);

  // ── Death revive (Necromancer / class specials) ─────────────
  for (const [pl, plState] of [[p1,p1s],[p2,p2s]]) {
    if (pl.stats.hp <= 0 && !plState.deathReviveUsed && CLASS_SPECIALS[getClassName(pl)]?.deathRevive) {
      plState.deathReviveUsed = true;
      pl.stats.hp = Math.floor(pl.stats.maxHp * 0.15);
    }
  }

  // ── Pet sacrifice ───────────────────────────────────────────
  const petSacMsgs = [];
  for (const [pid, pl, plState] of [[p1Id,p1,p1s],[p2Id,p2,p2s]]) {
    if (pl.stats.hp <= 0 && !plState.petSacrificed) {
      try {
        const pet = PetManager.getActivePet(pid);
        if (pet && (pet.bonding||0) > 50) {
          plState.petSacrificed = true;
          pl.stats.hp = Math.floor(pl.stats.maxHp * 0.10);
          const pd = PetManager.getPlayerData(pid);
          if (pd) { pd.pets = pd.pets.filter(p=>p.instanceId!==pet.instanceId); if(pd.activePet===pet.instanceId)pd.activePet=pd.pets[0]?.instanceId||null; PetManager.save(); }
          if (!pl.buffs) pl.buffs = [];
          pl.buffs.push({stat:'atk',amount:30,duration:2,name:'Vengeful Rage'},{stat:'def',amount:20,duration:2,name:'Vengeful Rage'});
          petSacMsgs.push(`💀 *${pet.emoji} ${pet.nickname||pet.name}* sacrifices itself for ${pl.name}!\n🐾 Survives on ${pl.stats.hp} HP — *VENGEFUL RAGE!* (+30% ATK)\n`);
        }
      } catch(e){}
    }
  }

  // ── Stagger (crits build stagger on the HIT PLAYER) ────────
  let p1Staggered = false, p2Staggered = false;
  if (p2Takes > 0 && r1.staggerAdd) {
    p2s.stagger = (p2s.stagger||0) + r1.staggerAdd;
    if (p2s.stagger >= 3) { p2s.stagger = 0; StatusEffectManager.applyEffect(p2, 'stun', 1); p2Staggered = true; }
  }
  if (p1Takes > 0 && r2.staggerAdd) {
    p1s.stagger = (p1s.stagger||0) + r2.staggerAdd;
    if (p1s.stagger >= 3) { p1s.stagger = 0; StatusEffectManager.applyEffect(p1, 'stun', 1); p1Staggered = true; }
  }

  // ── Momentum ────────────────────────────────────────────────
  if (p2Takes > 0) p1s.momentum = Math.min(5, (p1s.momentum||0) + (r1.momentumGain||0));
  if (p1Takes > 0) p2s.momentum = Math.min(5, (p2s.momentum||0) + (r2.momentumGain||0));
  if (p1Act.type === 'guard') p1s.momentum = Math.max(0, (p1s.momentum||0) - 1);
  if (p2Act.type === 'guard') p2s.momentum = Math.max(0, (p2s.momentum||0) - 1);

  // ── Ultimate gauge ─────────────────────────────────────────
  // Deals damage → fills gauge. Takes damage → fills gauge.
  if (p2Takes > 0) p1s.ultiGauge = Math.min(5, (p1s.ultiGauge||0) + (r1.isCrit ? 2 : 1));
  if (p1Takes > 0) p1s.ultiGauge = Math.min(5, (p1s.ultiGauge||0) + 1);
  if (p1Takes > 0) p2s.ultiGauge = Math.min(5, (p2s.ultiGauge||0) + (r2.isCrit ? 2 : 1));
  if (p2Takes > 0) p2s.ultiGauge = Math.min(5, (p2s.ultiGauge||0) + 1);
  p1s.ultiReady = (p1s.ultiGauge >= 5);
  p2s.ultiReady = (p2s.ultiGauge >= 5);

  // Guard interrupt: if guarding player was hit with weak attack → counter bonus
  const p1TotalAtk = getTotalAtk(p1); const p2TotalAtk = getTotalAtk(p2);
  if (p1s.guarding && r2.damage > 0 && r2.damage < p2TotalAtk * 0.70) p1s.counterBonus = true;
  if (p2s.guarding && r1.damage > 0 && r1.damage < p1TotalAtk * 0.70) p2s.counterBonus = true;

  // ── Energy ────────────────────────────────────────────────
  // Regen on non-skill turns. Rage mode regens faster.
  const p1Regen = p1s.rageMode ? 18 : 12;
  const p2Regen = p2s.rageMode ? 18 : 12;
  if (p1Act.type !== 'skill') p1.stats.energy = Math.min(p1.stats.maxEnergy, (p1.stats.energy||0) + p1Regen);
  if (p2Act.type !== 'skill') p2.stats.energy = Math.min(p2.stats.maxEnergy, (p2.stats.energy||0) + p2Regen);
  if (r1.energyCost) p1.stats.energy = Math.max(0, p1.stats.energy - r1.energyCost);
  if (r2.energyCost) p2.stats.energy = Math.max(0, p2.stats.energy - r2.energyCost);

  // Guard reset
  p1s.guarding = false;
  p2s.guarding = false;

  // ── Status effect tick ─────────────────────────────────────
  const p1SE = StatusEffectManager.processTurnEffects(p1);
  const p2SE = StatusEffectManager.processTurnEffects(p2);
  processBuffDurations(p1);
  processBuffDurations(p2);

  // ── Rage mode check ────────────────────────────────────────
  for (const [pl, plState] of [[p1,p1s],[p2,p2s]]) {
    const hpPct = pl.stats.hp / pl.stats.maxHp;
    if (hpPct <= 0.20 && !plState.rageMode) {
      plState.rageMode = true;
    }
  }

  // Pet co-attacks
  const petMsgs = [];
  for (const [pid, pl, other] of [[p1Id,p1,p2],[p2Id,p2,p1]]) {
    try {
      PetManager.updateHunger(pid);
      const pb = PetManager.getPetBattleBonus(pid);
      if (pb?.canUseAbility) {
        const pr = PetManager.usePetAbility(pid);
        if (pr?.success) {
          const pd = Math.max(1, Math.floor(pr.ability.damage + pr.pet.stats.atk*0.4) - Math.floor((other.stats.def||0)*0.2));
          other.stats.hp = Math.max(0, other.stats.hp - pd);
          petMsgs.push(`🐾 ${pr.pet.emoji} *${pr.pet.nickname||pr.pet.name}*: *${pr.ability.name}* — ${pd} dmg on ${other.name}!\n`);
        }
      }
    } catch(e){}
  }

  p1s.pendingAction = null;
  p2s.pendingAction = null;
  p1s.turnNumber++;
  p2s.turnNumber++;
  save();

  // ═══════════════════════════════════
  // BUILD TURN RESULT MESSAGE
  // ═══════════════════════════════════
  const p1Rank = getPvpRank(p1.pvpElo);
  const p2Rank = getPvpRank(p2.pvpElo);
  const turn   = p1s.turnNumber - 1;

  const ordered = p1First
    ? [[p1,r1,p1Takes,p1Cls,p1Rank,p1Id,p1s,p1Staggered],[p2,r2,p2Takes,p2Cls,p2Rank,p2Id,p2s,p2Staggered]]
    : [[p2,r2,p2Takes,p2Cls,p2Rank,p2Id,p2s,p2Staggered],[p1,r1,p1Takes,p1Cls,p1Rank,p1Id,p1s,p1Staggered]];

  let msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ *TURN ${turn} — BOTH STRIKE!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (const [pl, res, dmgTaken, cls, rank, pid, state, wasStaggered] of ordered) {
    const hpAfter   = pl.stats.hp;
    const hpPct     = hpAfter / pl.stats.maxHp;
    const threat    = getThreatIcon(hpPct);
    msg += `${rank.emoji} *${pl.name}* [${cls}]:\n`;
    msg += res.narrative;
    if (dmgTaken > 0 && !res.wasParried) msg += `🩹 Took *${dmgTaken}* damage!\n`;
    if (wasStaggered) msg += `⭐ *STAGGERED!* ${pl.name} is stunned next turn!\n`;
    if (state.rageMode && hpPct <= 0.20) msg += `🔥 *RAGE MODE ACTIVE!* (+30% ATK)\n`;
    if (state.ultiReady) msg += `🟣 *ULTIMATE GAUGE FULL!* Use /pvp ultimate!\n`;
    msg += `\n`;
  }

  if (petSacMsgs.length) msg += petSacMsgs.join('') + '\n';
  if (petMsgs.length)    msg += petMsgs.join('') + '\n';

  const seAll = [...p1SE.messages, ...p2SE.messages];
  if (seAll.length) msg += `🌀 *STATUS EFFECTS:*\n${seAll.join('\n')}\n\n`;

  // HP bars
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `${getThreatIcon(p1.stats.hp/p1.stats.maxHp)} *${p1.name}*\n`;
  msg += `${BarSystem.getHPBar(p1.stats.hp, p1.stats.maxHp)} ${p1.stats.hp}/${p1.stats.maxHp}\n`;
  msg += `⚡${getMomentumBar(p1s.momentum)} 🔶${getStaggerBar(p1s.stagger)} 🟣${getUltiBar(p1s.ultiGauge)}\n\n`;
  msg += `${getThreatIcon(p2.stats.hp/p2.stats.maxHp)} *${p2.name}*\n`;
  msg += `${BarSystem.getHPBar(p2.stats.hp, p2.stats.maxHp)} ${p2.stats.hp}/${p2.stats.maxHp}\n`;
  msg += `⚡${getMomentumBar(p2s.momentum)} 🔶${getStaggerBar(p2s.stagger)} 🟣${getUltiBar(p2s.ultiGauge)}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  await sock.sendMessage(chatId, { text: msg, mentions: [p1Id, p2Id] });

  // Victory check
  if (p1.stats.hp <= 0 || p2.stats.hp <= 0) {
    const winner = p1.stats.hp > 0 ? p1 : p2;
    const loser  = p1.stats.hp > 0 ? p2 : p1;
    const wId    = p1.stats.hp > 0 ? p1Id : p2Id;
    const lId    = p1.stats.hp > 0 ? p2Id : p1Id;
    return handleVictory(sock, chatId, winner, loser, wId, lId, db, save);
  }

  // Next turn prompt
  return sendTurnPrompt(sock, chatId, p1, p2, p1Id, p2Id, p1Rank, p2Rank);
}

// ═══════════════════════════════════════════════════════════════
// TURN PROMPT — action menu each turn
// ═══════════════════════════════════════════════════════════════
async function sendTurnPrompt(sock, chatId, p1, p2, p1Id, p2Id, p1Rank, p2Rank) {
  const p1s = p1.pvpBattle;
  const p2s = p2.pvpBattle;
  const turn = p1s.turnNumber;
  const p1Cls = getClassName(p1);
  const p2Cls = getClassName(p2);

  const p1Spec = CLASS_SPECIALS[p1Cls];
  const p2Spec = CLASS_SPECIALS[p2Cls];

  // Available hints
  const p1Tips = [];
  if ((p1s.momentum||0) >= 3) p1Tips.push(`⚡ *Momentum ready!* → /pvp special`);
  if (p1s.ultiReady) p1Tips.push(`🟣 *ULTIMATE CHARGED!* → /pvp ultimate`);
  if (p1s.parryReady) p1Tips.push(`✨ *PARRY PRIMED!* Use /pvp guard if opp is about to special!`);
  if (p1s.rageMode) p1Tips.push(`🔥 RAGE MODE active!`);

  const p2Tips = [];
  if ((p2s.momentum||0) >= 3) p2Tips.push(`⚡ *Momentum ready!* → /pvp special`);
  if (p2s.ultiReady) p2Tips.push(`🟣 *ULTIMATE CHARGED!* → /pvp ultimate`);
  if (p2s.parryReady) p2Tips.push(`✨ *PARRY PRIMED!*`);
  if (p2s.rageMode) p2Tips.push(`🔥 RAGE MODE active!`);

  let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `🎮 *TURN ${turn}* — Both choose!\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  txt += `@${p1Id.split('@')[0]} ${p1Rank.emoji}\n`;
  txt += `❤️ ${p1.stats.hp}/${p1.stats.maxHp} | ${p1.energyColor||'💙'} ${p1.stats.energy}/${p1.stats.maxEnergy}\n`;
  txt += `⚡${getMomentumBar(p1s.momentum)} 🔶${getStaggerBar(p1s.stagger)} 🟣${getUltiBar(p1s.ultiGauge)}\n`;
  if (p1Tips.length) txt += p1Tips.join('\n') + '\n';

  txt += `\n@${p2Id.split('@')[0]} ${p2Rank.emoji}\n`;
  txt += `❤️ ${p2.stats.hp}/${p2.stats.maxHp} | ${p2.energyColor||'💙'} ${p2.stats.energy}/${p2.stats.maxEnergy}\n`;
  txt += `⚡${getMomentumBar(p2s.momentum)} 🔶${getStaggerBar(p2s.stagger)} 🟣${getUltiBar(p2s.ultiGauge)}\n`;
  if (p2Tips.length) txt += p2Tips.join('\n') + '\n';

  txt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `🎯 *ACTIONS*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `/pvp attack   — Basic attack (build ⚡ momentum)\n`;
  txt += `/pvp guard    — Block 65% dmg (2× → PARRY READY)\n`;
  txt += `/pvp taunt    — Force enemy attack (-30% their ATK)\n`;
  txt += `/pvp skill    — View & use skills\n`;
  txt += `/<classcmd> [skill]  — Use skill by number\n`;
  txt += `/pvp special  — 🌟 Class special (3⚡ momentum)\n`;
  txt += `/pvp ultimate — 🟣 Limit Break (full 🟣 gauge)\n`;
  txt += `/pvp surrender\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `💡 *MECHANICS:*\n`;
  txt += `⚡ Momentum (3 bars) → /pvp special\n`;
  txt += `🟣 Ultimate (5 bars) → /pvp ultimate (LIMIT BREAK!)\n`;
  txt += `🔶 Stagger (3 hits) → opponent STUNNED\n`;
  txt += `🛡️ Guard 2× → PARRY READY (reflect a special!)\n`;
  txt += `🔥 Below 20% HP → RAGE MODE auto-activates\n`;

  return sock.sendMessage(chatId, { text: txt, mentions: [p1Id, p2Id] });
}

// ═══════════════════════════════════════════════════════════════
// VICTORY HANDLER
// ═══════════════════════════════════════════════════════════════
async function handleVictory(sock, chatId, winner, loser, wId, lId, db, save) {
  const wElo = winner.pvpElo || 1000;
  const lElo = loser.pvpElo  || 1000;
  const change = calcEloChange(wElo, lElo);
  const loss   = Math.round(change * 0.8);

  const rankBefore = getPvpRank(wElo);
  winner.pvpElo    = (winner.pvpElo || 1000) + change;
  loser.pvpElo     = Math.max(100, (loser.pvpElo || 1000) - loss);
  const rankAfter  = getPvpRank(winner.pvpElo);
  const rankUp     = rankAfter.name !== rankBefore.name && winner.pvpElo > wElo;

  winner.pvpWins    = (winner.pvpWins   || 0) + 1;
  loser.pvpLosses   = (loser.pvpLosses  || 0) + 1;
  winner.pvpStreak  = (winner.pvpStreak || 0) + 1;
  loser.pvpStreak   = 0;

  const baseNexus = 150 + Math.floor(loser.level * 5) + (winner.pvpStreak >= 3 ? 50 : 0);
  const baseXP   = baseNexus * 2;
  const streakBonus = winner.pvpStreak >= 5 ? `\n🔥 *STREAK BONUS!* ${winner.pvpStreak} wins in a row! +50 Ne` : winner.pvpStreak >= 3 ? `\n🔥 Win Streak ×${winner.pvpStreak}! +50 Ne` : '';

  winner.gold = (winner.gold || 0) + baseNexus;
  winner.xp   = (winner.xp   || 0) + baseXP;
  LevelUpManager.checkAndApplyLevelUps(winner, save, sock, chatId);

  winner.pvpBattle    = null; winner.statusEffects = []; winner.buffs = [];
  winner.stats.hp     = Math.floor(winner.stats.maxHp * 0.40);
  winner.stats.energy = winner.stats.maxEnergy;
  loser.pvpBattle     = null; loser.statusEffects  = []; loser.buffs = [];
  loser.stats.hp      = Math.floor(loser.stats.maxHp * 0.15);

  try {
    const pa = AchievementManager.track(winner, 'pvp_wins', 1);
    if (pa.length > 0) { const note = AchievementManager.buildNotification(pa); if(note) try { await sock.sendMessage(wId, { text: note }); } catch(e){} }
  } catch(e){}

  save();

  const rankUpMsg = rankUp ? `\n\n🎊 *RANK UP!*\n${rankBefore.emoji} ${rankBefore.name} → ${rankAfter.emoji} ${rankAfter.name}!` : '';

  return sock.sendMessage(chatId, {
    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏆 *BATTLE OVER!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👑 *${winner.name}* WINS!\n💀 *${loser.name}* has fallen!${streakBonus}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 *ELO CHANGES*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${rankAfter.emoji} ${winner.name}: ${wElo} → *${winner.pvpElo}* (+${change})\n${getPvpRank(loser.pvpElo).emoji} ${loser.name}: ${lElo} → *${loser.pvpElo}* (−${loss})\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *REWARDS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💠 Nexus: +${baseNexus}\n✨ XP: +${baseXP}${rankUpMsg}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    mentions: [wId, lId]
  });
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMMAND EXPORT
// ═══════════════════════════════════════════════════════════════
module.exports = {
  name: 'pvp',
  description: '⚔️ Full PvP system — momentum, ultimate gauge, rage mode, parry, stagger & ELO',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db     = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });

    const action = args[0]?.toLowerCase();
    const pClass = getClassName(player);
    const pRank  = getPvpRank(player.pvpElo);

    // ── HELP ────────────────────────────────────────────────
    if (!action || action === 'help') {
      const sp = CLASS_SPECIALS[pClass];
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ *PVP BATTLE SYSTEM*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n⚡ *MOMENTUM (3 bars):*\nLand hits → fill ⚡ bars → /pvp special\nCrits give +2, guard costs −1\n\n🟣 *ULTIMATE GAUGE (5 bars):*\nDeal damage, take damage → fill 🟣\nFull gauge → /pvp ultimate (LIMIT BREAK!)\n\n🔶 *STAGGER (3 bars):*\nCrits build stagger on opponent.\n3 stagger → opponent STUNNED 1 turn!\n+30% bonus on stunned targets.\n\n🛡️ *PARRY (guard 2× in a row):*\nGuard twice → PARRY PRIMED.\nIf opponent then uses a special → PERFECT COUNTER!\nFull momentum refund + reflected damage!\n\n😤 *TAUNT:*\nForce opponent to attack you (−30% their ATK)\nYou gain +2 momentum — great for mind games!\n\n🔥 *RAGE MODE (auto below 20% HP):*\n+30% ATK, +18 energy regen per turn.\nComebacks are very possible!\n\n🌟 *YOUR SPECIAL: ${sp?.name||'Unknown'}*\n${sp?.desc||'No desc.'}\n(Costs 3⚡ momentum)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *COMMANDS*\n/pvp challenge @user\n/pvp accept | /pvp decline\n/pvp attack | guard | taunt\n/<classcmd> [skill] | /pvp skill\n/pvp special (3⚡) | /pvp ultimate (5🟣)\n/pvp status | /pvp surrender\n/pvp rank | /pvp leaderboard\n/pvp matchups\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── RANK ────────────────────────────────────────────────
    if (action === 'rank') {
      const elo = player.pvpElo || 1000;
      const rank = getPvpRank(elo);
      const w = player.pvpWins||0, l = player.pvpLosses||0;
      const wr = w+l > 0 ? Math.floor(w/(w+l)*100) : 0;
      const idx = PVP_RANKS.findIndex(r => r.name === rank.name);
      const nxt = PVP_RANKS[idx+1];
      const sp  = CLASS_SPECIALS[pClass];
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${rank.emoji} *PVP RANK: ${rank.name}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 ${player.name} [${pClass}]\n⭐ ELO: *${elo}*\n${nxt ? `📈 Next: ${nxt.emoji} ${nxt.name} (${nxt.minElo} ELO)\n`:''}\n📊 ${w}W / ${l}L / ${wr}% WR\n🔥 Win streak: ${player.pvpStreak||0}\n\n🌟 *Special: ${sp?.name||'N/A'}*\n${sp?.desc||''}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── LEADERBOARD ─────────────────────────────────────────
    if (action === 'leaderboard' || action === 'lb') {
      const players = Object.values(db.users).filter(p=>p.pvpWins>0).sort((a,b)=>(b.pvpElo||1000)-(a.pvpElo||1000)).slice(0,10);
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏆 *PVP LEADERBOARD*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      players.forEach((p,i) => { const r = getPvpRank(p.pvpElo); const cl = getClassName(p); txt += `${i+1}. ${r.emoji} *${p.name}* [${cl}]\n   ⭐${p.pvpElo||1000} | ✅${p.pvpWins||0} ❌${p.pvpLosses||0} 🔥${p.pvpStreak||0}\n`; });
      if (!players.length) txt += 'No ranked players yet!\n';
      return sock.sendMessage(chatId, { text: txt + '━━━━━━━━━━━━━━━━━━━━━━━━━━━' }, { quoted: msg });
    }

    // ── MATCHUPS ────────────────────────────────────────────
    if (action === 'matchups' || action === 'matchup') {
      const m  = CLASS_MATCHUPS[pClass];
      const sp = CLASS_SPECIALS[pClass];
      if (!m) return sock.sendMessage(chatId, { text: `No matchup data for ${pClass}.` }, { quoted: msg });
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ *${pClass}* — CLASS MATCHUPS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n✅ *Strong vs (+15%):*\n${m.strongVs.join(', ')}\n\n❌ *Weak vs (−12%):*\n${m.weakVs.join(', ')}\n\n🌟 *SPECIAL: ${sp?.name||'N/A'}*\n${sp?.desc||''}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── CHALLENGE ───────────────────────────────────────────
    if (action === 'challenge') {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (!mentioned) return sock.sendMessage(chatId, { text: '❌ Tag someone!\n/pvp challenge @user' }, { quoted: msg });
      if (mentioned === sender) return sock.sendMessage(chatId, { text: '❌ Cannot challenge yourself!' }, { quoted: msg });
      const opp = db.users[mentioned];
      if (!opp) return sock.sendMessage(chatId, { text: '❌ That player is not registered!' }, { quoted: msg });
      if (player.pvpBattle) return sock.sendMessage(chatId, { text: '❌ Already in a PVP battle!' }, { quoted: msg });
      if (opp.pvpBattle) return sock.sendMessage(chatId, { text: '❌ That player is already in battle!' }, { quoted: msg });
      if (player.stats.hp < player.stats.maxHp * 0.5) return sock.sendMessage(chatId, { text: '❌ Need 50%+ HP! Use /use heal first.' }, { quoted: msg });
      if (opp.stats.hp < opp.stats.maxHp * 0.5) return sock.sendMessage(chatId, { text: '❌ Opponent needs to heal first!' }, { quoted: msg });

      const oClass = getClassName(opp);
      const oRank  = getPvpRank(opp.pvpElo);
      const mySp   = CLASS_SPECIALS[pClass];
      const opSp   = CLASS_SPECIALS[oClass];
      const adv    = getMatchup(pClass, oClass);

      pendingChallenges.set(mentioned, { challengerId:sender, chatId, timestamp:Date.now() });
      setTimeout(() => { if (pendingChallenges.has(mentioned)) pendingChallenges.delete(mentioned); }, 60000);

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ *PVP CHALLENGE ISSUED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${pRank.emoji} *${player.name}* [${pClass} Lv.${player.level}]\n🌟 Special: *${mySp?.name||'?'}*\n\n         ⚔️ VS ⚔️\n\n${oRank.emoji} *${opp.name}* [${oClass} Lv.${opp.level}]\n🌟 Special: *${opSp?.name||'?'}*\n\n${adv.mult > 1 ? `⚡ ${player.name} has *CLASS ADVANTAGE*!\n` : adv.mult < 1 ? `⚠️ ${player.name} has class disadvantage\n` : ''}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n@${mentioned.split('@')[0]} — You have *60 seconds!*\n✅ /pvp accept  ❌ /pvp decline\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions: [mentioned]
      }, { quoted: msg });
    }

    // ── ACCEPT ───────────────────────────────────────────────
    if (action === 'accept') {
      const challenge = pendingChallenges.get(sender);
      if (!challenge) return sock.sendMessage(chatId, { text: '❌ No pending challenges!' }, { quoted: msg });
      const challenger = db.users[challenge.challengerId];
      if (!challenger) { pendingChallenges.delete(sender); return sock.sendMessage(chatId, { text: '❌ Challenger not found!' }, { quoted: msg }); }
      pendingChallenges.delete(sender);

      if (!player.statusEffects) player.statusEffects = [];
      if (!challenger.statusEffects) challenger.statusEffects = [];
      if (!player.buffs) player.buffs = [];
      if (!challenger.buffs) challenger.buffs = [];

      player.pvpBattle     = initBattleState(challenge.challengerId, chatId);
      challenger.pvpBattle = initBattleState(sender, chatId);
      saveDatabase();

      const cClass = getClassName(challenger);
      const cRank  = getPvpRank(challenger.pvpElo);
      const cSp    = CLASS_SPECIALS[cClass];
      const mySp   = CLASS_SPECIALS[pClass];
      const adv1   = getMatchup(pClass, cClass);
      const adv2   = getMatchup(cClass, pClass);

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ *BATTLE START!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${cRank.emoji} *${challenger.name}* [${cClass} Lv.${challenger.level}]\n⭐ ELO: ${challenger.pvpElo||1000}\n❤️ ${challenger.stats.hp}/${challenger.stats.maxHp}\n🌟 *${cSp?.name||'?'}* — ${cSp?.desc||''}\n${adv2.mult > 1 ? '⚡ '+adv2.msg : adv2.mult < 1 ? '⚠️ '+adv2.msg : ''}\n\n         ⚔️ VS ⚔️\n\n${pRank.emoji} *${player.name}* [${pClass} Lv.${player.level}]\n⭐ ELO: ${player.pvpElo||1000}\n❤️ ${player.stats.hp}/${player.stats.maxHp}\n🌟 *${mySp?.name||'?'}* — ${mySp?.desc||''}\n${adv1.mult > 1 ? '⚡ '+adv1.msg : adv1.mult < 1 ? '⚠️ '+adv1.msg : ''}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 *NEW MECHANICS THIS BATTLE:*\n⚡ Build 3 Momentum → /pvp special\n🟣 Build 5 Ultimate → /pvp ultimate\n🔶 Crit 3 times → STAGGER the enemy!\n🛡️ Guard twice → PARRY (counter a special!)\n🔥 Below 20% HP → RAGE MODE kicks in!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎮 *TURN 1* — Both choose an action!\n@${challenge.challengerId.split('@')[0]} ← pick!\n@${sender.split('@')[0]} ← pick!\n\n/pvp attack | /pvp guard | /pvp taunt\n/<classcmd> [skill] | /pvp skill`,
        mentions: [challenge.challengerId, sender]
      }, { quoted: msg });
    }

    // ── DECLINE ──────────────────────────────────────────────
    if (action === 'decline') {
      const challenge = pendingChallenges.get(sender);
      if (!challenge) return sock.sendMessage(chatId, { text: '❌ No pending challenges!' }, { quoted: msg });
      pendingChallenges.delete(sender);
      return sock.sendMessage(chatId, { text: `❌ *${player.name}* declined the challenge.` }, { quoted: msg });
    }

    // ── STATUS ───────────────────────────────────────────────
    if (action === 'status') {
      if (!player.pvpBattle) return sock.sendMessage(chatId, { text: '❌ Not in a PVP battle!' }, { quoted: msg });
      const opp = db.users[player.pvpBattle.opponentId];
      if (!opp) return sock.sendMessage(chatId, { text: '❌ Opponent not found!' }, { quoted: msg });
      const oClass = getClassName(opp);
      const oRank  = getPvpRank(opp.pvpElo);
      const ps     = player.pvpBattle;
      const os     = opp.pvpBattle;
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTURN ${ps.turnNumber} | ${ps.pendingAction ? '✅ Action locked' : '⏳ Awaiting action'}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${getThreatIcon(player.stats.hp/player.stats.maxHp)} *${player.name}* [${pClass}]\n${BarSystem.getHPBar(player.stats.hp, player.stats.maxHp)}\n❤️ ${player.stats.hp}/${player.stats.maxHp}\n⚡${getMomentumBar(ps.momentum)} 🔶${getStaggerBar(ps.stagger)} 🟣${getUltiBar(ps.ultiGauge)}\n${ps.rageMode ? '🔥 RAGE MODE' : ''}\n\n${getThreatIcon(opp.stats.hp/opp.stats.maxHp)} *${opp.name}* [${oClass}]\n${BarSystem.getHPBar(opp.stats.hp, opp.stats.maxHp)}\n❤️ ${opp.stats.hp}/${opp.stats.maxHp}\n⚡${getMomentumBar(os?.momentum)} 🔶${getStaggerBar(os?.stagger)} 🟣${getUltiBar(os?.ultiGauge)}\n${os?.rageMode ? '🔥 RAGE MODE' : ''}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── SKILLS MENU ──────────────────────────────────────────
    if (action === 'skill' || action === 'skills') {
      if (!player.pvpBattle) return sock.sendMessage(chatId, { text: '❌ Not in a PVP battle!' }, { quoted: msg });
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ *YOUR SKILLS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${player.energyColor||'💙'} ${player.stats.energy}/${player.stats.maxEnergy}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      if (!player.skills?.active?.length) txt += 'No active skills!\n';
      else player.skills.active.forEach((s,i) => {
        const ok = player.stats.energy >= (s.energyCost||20) ? '✅' : '❌';
        txt += `${i+1}. ${ok} *${s.name}* [Lv.${s.level||1}]\n   💥 ${s.damage} dmg | ${s.energyCost||20} ${player.energyType||'Energy'}\n   ${s.effect||''}\n\n`;
      });
      const sp  = CLASS_SPECIALS[pClass];
      const ps  = player.pvpBattle;
      const canS = (ps.momentum||0) >= 3;
      const canU = ps.ultiReady;
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌟 *SPECIAL: ${sp?.name||'N/A'}*\n${sp?.desc||''}\n${canS ? '✅ Ready! /pvp special' : `⚡ Need 3 momentum (${getMomentumBar(ps.momentum)})`}\n\n🟣 *ULTIMATE LIMIT BREAK*\n${canU ? '✅ CHARGED! /pvp ultimate' : `🟣 Need 5 bars (${getUltiBar(ps.ultiGauge)})`}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── IN-BATTLE ACTIONS ────────────────────────────────────
    const battleActions = ['attack','guard','taunt','classcmd','special','ultimate','surrender'];
    if (battleActions.includes(action)) {
      if (!player.pvpBattle) return sock.sendMessage(chatId, { text: '❌ Not in a PVP battle!' }, { quoted: msg });
      const battle = player.pvpBattle;
      if (battle.pendingAction) return sock.sendMessage(chatId, { text: `✅ Action already locked in!\n⏳ Waiting for ${db.users[battle.opponentId]?.name||'opponent'}...` }, { quoted: msg });
      const opp = db.users[battle.opponentId];
      if (!opp) { player.pvpBattle = null; saveDatabase(); return sock.sendMessage(chatId, { text: '❌ Opponent disconnected. Battle ended.' }, { quoted: msg }); }

      // Surrender
      if (action === 'surrender') {
        const eloChange = Math.floor(calcEloChange(opp.pvpElo||1000, player.pvpElo||1000) * 0.6);
        opp.pvpElo = (opp.pvpElo||1000) + eloChange; opp.pvpWins = (opp.pvpWins||0) + 1;
        opp.gold = (opp.gold||0) + 80; opp.pvpBattle = null; opp.statusEffects = []; opp.buffs = [];
        player.pvpBattle = null; player.pvpLosses = (player.pvpLosses||0) + 1; player.pvpStreak = 0;
        player.pvpElo = Math.max(100, (player.pvpElo||1000) - Math.floor(eloChange * 0.8));
        player.stats.hp = Math.floor(player.stats.maxHp * 0.3); player.statusEffects = []; player.buffs = [];
        saveDatabase();
        return sock.sendMessage(chatId, { text: `🏳️ *${player.name}* surrenders!\n🏆 *${opp.name}* wins by forfeit!` }, { quoted: msg });
      }

      // Use skill by number
      if (action === 'classcmd') {
        const idx = parseInt(args[1]) - 1;
        if (isNaN(idx) || idx < 0) return sock.sendMessage(chatId, { text: '❌ Specify skill number!\n/<classcmd> [skill]' }, { quoted: msg });
        const skill = player.skills?.active?.[idx];
        if (!skill) return sock.sendMessage(chatId, { text: `❌ No skill #${idx+1}. /pvp skill to view.` }, { quoted: msg });
        if (player.stats.energy < (skill.energyCost||20)) return sock.sendMessage(chatId, { text: `❌ Not enough ${player.energyType||'Energy'}! Need ${skill.energyCost||20}.` }, { quoted: msg });
        battle.pendingAction = { type:'skill', skillIndex:idx };

      // Special (3 momentum)
      } else if (action === 'special') {
        if ((battle.momentum||0) < 3) return sock.sendMessage(chatId, { text: `⚡ Need 3 Momentum!\nCurrent: ${getMomentumBar(battle.momentum)}\nLand more hits!` }, { quoted: msg });
        battle.momentum -= 3;
        battle.pendingAction = { type:'special' };

      // Ultimate (5 gauge bars) — mega move
      } else if (action === 'ultimate') {
        if (!battle.ultiReady) return sock.sendMessage(chatId, { text: `🟣 Ultimate not ready!\nCurrent: ${getUltiBar(battle.ultiGauge)}\nDeal and take damage to charge it!` }, { quoted: msg });
        battle.pendingAction = { type:'special' }; // uses the special engine but flagged as ultimate
        battle.pendingAction._isUltimate = true;

      } else {
        battle.pendingAction = { type: action };
      }

      saveDatabase();

      // Both submitted — resolve turn
      if (opp.pvpBattle?.pendingAction) {
        return executeBothActions(sock, chatId, player, opp, db, saveDatabase, sender);
      }

      const icons = { attack:'⚔️', guard:'🛡️', taunt:'😤', special:'🌟', ultimate:'🟣' };
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${icons[action]||'✅'} *ACTION LOCKED IN!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⏳ Waiting for *${opp.name}*...\n\n💡 Use /pvp status to check the board.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, { text: '❌ Unknown PVP command.\nUse /pvp help.' }, { quoted: msg });
  }
};
