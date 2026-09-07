// ═══════════════════════════════════════════════════════════════
// PVP ADDITIONS MODULE — v3.0 THRILLING UPGRADE
// ═══════════════════════════════════════════════════════════════

const activeBets       = new Map();
const spectators       = new Map();
const battleTimers     = new Map();
const pendingRematches = new Map();

function battleKey(id1, id2) { return [id1, id2].sort().join('::'); }

// ═══════════════════════════════════════════════════════════════
// ARENAS — 8 unique battlegrounds with passive effects
// ═══════════════════════════════════════════════════════════════
const ARENAS = [
  {
    id: 'colosseum',
    name: '🏛️ The Grand Colosseum',
    desc: 'Roaring crowds fuel both fighters. Every 3 turns: +10% ATK buff.',
    emoji: '🏛️',
    flavor: 'The crowd ROARS as the fighters clash in the ancient arena!',
    applyPassive(p1, p2, p1s, p2s, turn) {
      if (turn % 3 === 0) {
        if (!p1.buffs) p1.buffs = [];
        if (!p2.buffs) p2.buffs = [];
        p1.buffs.push({ stat:'atk', amount:10, duration:3, name:'Crowd Favor' });
        p2.buffs.push({ stat:'atk', amount:10, duration:3, name:'Crowd Favor' });
        return `🏛️ *Crowd Roars!* Both fighters +10% ATK for 3 turns!`;
      }
    }
  },
  {
    id: 'volcanic',
    name: '🌋 Volcanic Crater',
    desc: 'Scorching heat burns both fighters for 3% max HP each turn.',
    emoji: '🌋',
    flavor: 'Lava erupts nearby — the heat is SUFFOCATING!',
    applyPassive(p1, p2, p1s, p2s, turn) {
      const b1 = Math.floor(p1.stats.maxHp * 0.03);
      const b2 = Math.floor(p2.stats.maxHp * 0.03);
      p1.stats.hp = Math.max(1, p1.stats.hp - b1);
      p2.stats.hp = Math.max(1, p2.stats.hp - b2);
      return `🌋 *Volcanic Heat:* -${b1} HP to ${p1.name}, -${b2} HP to ${p2.name}`;
    }
  },
  {
    id: 'shadowrealm',
    name: '🌑 The Shadow Realm',
    desc: 'Darkness shrouds all. Basic attacks have 20% miss chance. Crits deal ×2.',
    emoji: '🌑',
    flavor: 'Vision is LIMITED here. Every strike could be the one that ends it...',
    missChanceBase: 0.20,
    critMultiplierBonus: 0.5,
    applyPassive(p1, p2, p1s, p2s, turn) {
      p1s.shadowRealmActive = true;
      p2s.shadowRealmActive = true;
    }
  },
  {
    id: 'crystal_temple',
    name: '💎 Mana Stone Temple',
    desc: 'Ancient crystals restore 5% HP per turn to both fighters.',
    emoji: '💎',
    flavor: 'Ancient crystals pulse with restorative energy!',
    applyPassive(p1, p2, p1s, p2s, turn) {
      const h1 = Math.floor(p1.stats.maxHp * 0.05);
      const h2 = Math.floor(p2.stats.maxHp * 0.05);
      p1.stats.hp = Math.min(p1.stats.maxHp, p1.stats.hp + h1);
      p2.stats.hp = Math.min(p2.stats.maxHp, p2.stats.hp + h2);
      return `💎 *Mana Stone Regen:* +${h1} to ${p1.name}, +${h2} to ${p2.name}`;
    }
  },
  {
    id: 'storm_peak',
    name: '⛈️ Storm Peak',
    desc: '15% chance each turn: lightning bolt hits a random fighter for 8% max HP.',
    emoji: '⛈️',
    flavor: 'Thunder CRACKS as the sky tears open above!',
    applyPassive(p1, p2, p1s, p2s, turn) {
      if (Math.random() < 0.15) {
        const target = Math.random() < 0.5 ? p1 : p2;
        const dmg = Math.floor(target.stats.maxHp * 0.08);
        target.stats.hp = Math.max(1, target.stats.hp - dmg);
        return `⚡ *LIGHTNING STRIKE!* ${target.name} hit for *${dmg}* damage!`;
      }
    }
  },
  {
    id: 'mirror_maze',
    name: '🪞 Mirror Maze',
    desc: '25% chance any hit reflects 30% damage back to attacker.',
    emoji: '🪞',
    reflectChance: 0.25,
    reflectPct: 0.30,
    flavor: 'Endless reflections — you can never be sure where the next blow is coming from!',
    applyPassive(p1, p2, p1s, p2s, turn) {
      p1s.mirrorMazeActive = true;
      p2s.mirrorMazeActive = true;
    }
  },
  {
    id: 'ancient_ruins',
    name: '🏚️ Ancient Ruins',
    desc: 'Cursed ground: −15% DEF for both. Skills deal +20% damage.',
    emoji: '🏚️',
    flavor: 'Dark energy seeps from the ruins... something ANCIENT watches.',
    applyPassive(p1, p2, p1s, p2s, turn) {
      p1s.ancientRuinsActive = true;
      p2s.ancientRuinsActive = true;
    }
  },
  {
    id: 'frozen_tundra',
    name: '❄️ Frozen Tundra',
    desc: 'Bitter cold slows energy regen −40%. But crits have +5% extra chance.',
    emoji: '❄️',
    flavor: 'Every breath freezes. The cold numbs the pain... and the mind.',
    applyPassive(p1, p2, p1s, p2s, turn) {
      p1s.frozenTundraActive = true;
      p2s.frozenTundraActive = true;
    }
  },
];

function rollArena() {
  return ARENAS[Math.floor(Math.random() * ARENAS.length)];
}

// ═══════════════════════════════════════════════════════════════
// SKILL COOLDOWN SYSTEM — each skill has 3-turn cooldown in PvP
// ═══════════════════════════════════════════════════════════════
const SKILL_COOLDOWN_TURNS = 3;

function initSkillCooldowns(player) {
  const count = player.skills?.active?.length || 0;
  return new Array(count).fill(0);
}

function tickSkillCooldowns(cooldowns) {
  return cooldowns.map(cd => Math.max(0, cd - 1));
}

function isSkillReady(cooldowns, idx) {
  return (cooldowns[idx] || 0) === 0;
}

function useSkillCooldown(cooldowns, idx) {
  const newCds = [...cooldowns];
  newCds[idx] = SKILL_COOLDOWN_TURNS;
  return newCds;
}

// ═══════════════════════════════════════════════════════════════
// CHAIN COMBO SYSTEM — action sequences unlock special bonuses
// ═══════════════════════════════════════════════════════════════
const CHAIN_COMBOS = [
  {
    id: 'breakthrough',
    name: '💥 BREAKTHROUGH COMBO',
    sequence: ['attack', 'attack', 'special'],
    desc: 'ATK×2 then SPECIAL: +40% special damage, ignore 50% DEF',
    bonusMult: 1.40,
    armorPenBonus: 0.50,
  },
  {
    id: 'patience',
    name: '🛡️ IRON PATIENCE',
    sequence: ['guard', 'guard', 'attack'],
    desc: 'GUARD×2 then ATTACK: +70% damage',
    bonusMult: 1.70,
    armorPenBonus: 0,
  },
  {
    id: 'mind_game',
    name: '🧠 MIND GAMES',
    sequence: ['taunt', 'guard', 'attack'],
    desc: 'TAUNT→GUARD→ATTACK: +60% damage + forced stagger',
    bonusMult: 1.60,
    forceStagger: true,
  },
  {
    id: 'relentless',
    name: '⚔️ RELENTLESS ASSAULT',
    sequence: ['attack', 'skill', 'attack'],
    desc: 'ATK→SKILL→ATK: Final attack auto-crits',
    bonusMult: 1.0,
    guaranteeCrit: true,
  },
  {
    id: 'deathblow',
    name: '💀 DEATHBLOW CHAIN',
    sequence: ['skill', 'special'],
    desc: 'SKILL→SPECIAL: Special deals +50% extra damage',
    bonusMult: 1.50,
    armorPenBonus: 0.25,
  },
];

function checkChainCombo(actionHistory) {
  for (const combo of CHAIN_COMBOS) {
    const seq = combo.sequence;
    const recent = actionHistory.slice(-seq.length);
    if (recent.length === seq.length && recent.every((a,i) => a === seq[i])) {
      return combo;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// DESPERATION MOVES — unlocked at ≤15% HP, one-time per battle
// ═══════════════════════════════════════════════════════════════
const DESPERATION_MOVES = {
  Warrior:      { name:'⚔️ Last Stand',          desc:'+80% ATK/DEF 2 turns. Survive 1 fatal hit at 1 HP.', lastStandTurns:2, immuneToDeath:true },
  Mage:         { name:'💥 Mana Burst',           desc:'Sacrifice ALL energy → 300% magic damage.', energyNuke:true, dmgMult:3.0 },
  Archer:       { name:'🎯 Final Arrow',          desc:'250% unblockable crit. Execute if target <30% HP.', dmgMult:[2.5], guaranteeCrit:true, unblockable:true, executeThreshold:0.30 },
  Rogue:        { name:'🗡️ Desperation Cut',      desc:'5×60% hits, all ignore DEF completely.', dmgMult:[0.6,0.6,0.6,0.6,0.6], armorPen:1.0 },
  Paladin:      { name:'✨ Divine Rebirth',        desc:'Heal 40% max HP + immunity shield for 1 turn.', healPct:0.40, immunityTurn:true },
  Berserker:    { name:'🩸 Berserk Overdrive',    desc:'+100% ATK, ignore all DEF, 20% HP recoil.', dmgMult:[2.0], armorPen:1.0, selfDmgPct:0.20 },
  Necromancer:  { name:'☠️ Life Drain Nova',      desc:'Drain 50% enemy current HP. Heal double that.', hpDrainPct:0.50, fullLifesteal:true },
  Assassin:     { name:'🌑 Shadow Execution',     desc:'400% true damage. Vanish first (immune this turn).', dmgMult:[4.0], armorPen:1.0, gainVanish:true },
  DragonKnight: { name:'🐉 Dragon Ascension',     desc:'+60% all stats, immune to status 2 turns.', statBoostAll:0.60, statusImmune:2 },
  Devourer:     { name:'👁️ Consume Everything',  desc:'Steal 30% enemy max HP. Cannot die this turn.', maxHpStealPct:0.30, immuneToDeath:true },
  Monk:         { name:'🌀 Enlightenment',        desc:'Dodge next 3 hits. Counter each at 150% ATK.', absoluteDodgeTurns:3, desperationCounter:true },
  Shaman:       { name:'🌿 Spirit Walk',          desc:'Phaseout 1 turn (untargetable). Cleanse all debuffs.', phaseOut:true, cleanse:true },
  BloodKnight:  { name:'🩸 Hemorrhage',           desc:'5×80% hits with 15% lifesteal each.', dmgMult:[0.8,0.8,0.8,0.8,0.8], lifestealPct:0.15 },
  SpellBlade:   { name:'💜 Arcane Collapse',      desc:'energy × 3 = raw damage. Ignore all DEF.', energyScaleNuke:true, armorPen:1.0 },
  Summoner:     { name:'🔮 Apocalypse Summon',    desc:'300% + ALL 6 status effects guaranteed.', dmgMult:[3.0], applyAll:true, allGuaranteed:true },
  Warlord:      { name:'👑 Conqueror Mode',       desc:'All attacks ×3 for 2 turns. Immune to stun/silence.', conquerorMode:2 },
  Elementalist: { name:'🌊 Elemental Singularity',desc:'500% combined elements. FREEZE+BURN+POISON guaranteed.', dmgMult:[5.0], armorPen:0.8 },
  ShadowDancer: { name:'💃 Shadow World',         desc:'Both fighters take 50% HP damage. ShadowDancer heals double.', shadowWorld:true },
  Chronomancer: { name:'⏳ Time Erasure',         desc:'All damage you take this turn is reflected back at 150%.', timeReversal:true },
  Phantom:      { name:'🌑 Phantom Possession',   desc:'250% true dmg + enemy attacks themselves for 1 turn.', dmgMult:[2.5], possessEnemy:true },
  Knight:       { name:'⚔️ Sacred Oath',          desc:'Survive at 1 HP. Next 2 attacks deal 200% holy true damage.', immuneToDeath:true, holyStrikes:2 },
  Ranger:       { name:'🏹 Rain of Arrows',       desc:'8×50% hits. Each has 30% BLIND chance.', dmgMult:[0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5], blindChance:0.30 },
};

// ═══════════════════════════════════════════════════════════════
// RANDOM BATTLE EVENTS — 20 events for maximum chaos
// ═══════════════════════════════════════════════════════════════
const BATTLE_EVENTS = [
  {
    id:'power_surge', name:'⚡ POWER SURGE!',
    desc:'Wild energy erupts — both fighters +30% ATK this turn!',
    apply(p1,p2) {
      if(!p1.buffs)p1.buffs=[]; if(!p2.buffs)p2.buffs=[];
      p1.buffs.push({stat:'atk',amount:30,duration:1,name:'Power Surge'});
      p2.buffs.push({stat:'atk',amount:30,duration:1,name:'Power Surge'});
    }
  },
  {
    id:'cursed_ground', name:'💀 CURSED GROUND!',
    desc:'Dark energy POISONS both fighters for 2 turns!',
    apply(p1,p2,SEM) { SEM.applyEffect(p1,'poison',2); SEM.applyEffect(p2,'poison',2); }
  },
  {
    id:'healing_spring', name:'💚 HEALING SPRING!',
    desc:'Life surges — lowest HP fighter healed 20% max HP!',
    apply(p1,p2) {
      const t=p1.stats.hp<=p2.stats.hp?p1:p2;
      const h=Math.floor(t.stats.maxHp*0.20);
      t.stats.hp=Math.min(t.stats.maxHp,t.stats.hp+h);
      return `💚 ${t.name} restored *${h}* HP!`;
    }
  },
  {
    id:'bloodlust', name:'🩸 BLOODLUST!',
    desc:'Crits deal ×2.5 damage this turn for both fighters!',
    apply(p1,p2,SEM,p1s,p2s) { p1s.bloodlustTurn=true; p2s.bloodlustTurn=true; return `💀 *CRITS ARE LETHAL THIS TURN!*`; }
  },
  {
    id:'energy_void', name:'⚫ ENERGY VOID!',
    desc:'A void drains 30 energy from both fighters!',
    apply(p1,p2) { p1.stats.energy=Math.max(0,(p1.stats.energy||0)-30); p2.stats.energy=Math.max(0,(p2.stats.energy||0)-30); }
  },
  {
    id:'divine_blessing', name:'✨ DIVINE BLESSING!',
    desc:'Weakest fighter: stagger cleared + 2 momentum + 10% HP heal!',
    apply(p1,p2,SEM,p1s,p2s) {
      const isP1=p1.stats.hp<=p2.stats.hp;
      const [wp,ws]=isP1?[p1,p1s]:[p2,p2s];
      ws.stagger=0; ws.momentum=Math.min(5,(ws.momentum||0)+2);
      const h=Math.floor(wp.stats.maxHp*0.10); wp.stats.hp=Math.min(wp.stats.maxHp,wp.stats.hp+h);
      return `✨ ${wp.name}: stagger cleared, +2 momentum, +${h} HP!`;
    }
  },
  {
    id:'momentum_shatter', name:'💥 MOMENTUM SHATTER!',
    desc:'Explosion DESTROYS all momentum for both fighters!',
    apply(p1,p2,SEM,p1s,p2s) {
      const l1=p1s.momentum||0; const l2=p2s.momentum||0;
      p1s.momentum=0; p2s.momentum=0;
      return `💥 ${p1.name} lost ${l1}⚡, ${p2.name} lost ${l2}⚡!`;
    }
  },
  {
    id:'ultimate_surge', name:'🟣 ULTIMATE SURGE!',
    desc:'Both fighters gain +2 Ultimate Gauge instantly!',
    apply(p1,p2,SEM,p1s,p2s) {
      p1s.ultiGauge=Math.min(5,(p1s.ultiGauge||0)+2); p2s.ultiGauge=Math.min(5,(p2s.ultiGauge||0)+2);
      p1s.ultiReady=p1s.ultiGauge>=5; p2s.ultiReady=p2s.ultiGauge>=5;
      return `🟣 Both fighters +2 Ultimate bars!`;
    }
  },
  {
    id:'mirror_strike', name:'🪞 MIRROR STRIKE!',
    desc:'Each fighter takes 15% of their own ATK as reflected damage!',
    apply(p1,p2) {
      const d1=Math.floor((p1.stats.atk||0)*0.15); const d2=Math.floor((p2.stats.atk||0)*0.15);
      p1.stats.hp=Math.max(1,p1.stats.hp-d1); p2.stats.hp=Math.max(1,p2.stats.hp-d2);
      return `🪞 Mirror: ${p1.name} -${d1}, ${p2.name} -${d2}!`;
    }
  },
  {
    id:'time_warp', name:'⏳ TIME WARP!',
    desc:'Time warps — ALL skill cooldowns reset to 0!',
    apply(p1,p2,SEM,p1s,p2s) {
      if(p1s.skillCooldowns) p1s.skillCooldowns=p1s.skillCooldowns.map(()=>0);
      if(p2s.skillCooldowns) p2s.skillCooldowns=p2s.skillCooldowns.map(()=>0);
      return `⏳ ALL skill cooldowns RESET for both fighters!`;
    }
  },
  {
    id:'adrenaline', name:'💉 ADRENALINE RUSH!',
    desc:'Pure adrenaline — both fighters +50 energy instantly!',
    apply(p1,p2) {
      p1.stats.energy=Math.min(p1.stats.maxEnergy,(p1.stats.energy||0)+50);
      p2.stats.energy=Math.min(p2.stats.maxEnergy,(p2.stats.energy||0)+50);
      return `💉 +50 energy to BOTH fighters!`;
    }
  },
  {
    id:'chaos_roulette', name:'🎲 CHAOS ROULETTE!',
    desc:'Pure chaos — completely random outcome!',
    apply(p1,p2,SEM,p1s,p2s) {
      const roll=Math.floor(Math.random()*6);
      switch(roll){
        case 0:{const h=Math.floor(p1.stats.maxHp*0.25);p1.stats.hp=Math.min(p1.stats.maxHp,p1.stats.hp+h);return `🍀 Lucky! ${p1.name} healed ${h} HP!`;}
        case 1:{const h=Math.floor(p2.stats.maxHp*0.25);p2.stats.hp=Math.min(p2.stats.maxHp,p2.stats.hp+h);return `🍀 Lucky! ${p2.name} healed ${h} HP!`;}
        case 2:SEM.applyEffect(p1,'stun',1);return `💫 ${p1.name} randomly STUNNED!`;
        case 3:SEM.applyEffect(p2,'stun',1);return `💫 ${p2.name} randomly STUNNED!`;
        case 4:p1s.momentum=Math.min(5,(p1s.momentum||0)+3);return `⚡ ${p1.name} gets +3 free momentum!`;
        case 5:p2s.momentum=Math.min(5,(p2s.momentum||0)+3);return `⚡ ${p2.name} gets +3 free momentum!`;
      }
    }
  },
  {
    id:'gravity_well', name:'⚫ GRAVITY WELL!',
    desc:'Crushing gravity — BOTH fighters SLOWED for 2 turns!',
    apply(p1,p2,SEM) { SEM.applyEffect(p1,'slow',2); SEM.applyEffect(p2,'slow',2); return `⚫ Both fighters crushed by gravity!`; }
  },
  {
    id:'berserker_field', name:'⚔️ BERSERKER FIELD!',
    desc:'Violence breeds violence — permanent +20% ATK for both!',
    apply(p1,p2) {
      if(!p1.buffs)p1.buffs=[]; if(!p2.buffs)p2.buffs=[];
      p1.buffs.push({stat:'atk',amount:20,duration:999,name:'Berserker Field'});
      p2.buffs.push({stat:'atk',amount:20,duration:999,name:'Berserker Field'});
      return `⚔️ PERMANENT +20% ATK for both fighters!`;
    }
  },
  {
    id:'silence_nova', name:'🔇 SILENCE NOVA!',
    desc:'Anti-magic field SILENCES both fighters for 1 turn!',
    apply(p1,p2,SEM) { SEM.applyEffect(p1,'silence',1); SEM.applyEffect(p2,'silence',1); return `🔇 BOTH fighters silenced!`; }
  },
  {
    id:'steal_momentum', name:'⚡ MOMENTUM THEFT!',
    desc:'Leader\'s momentum STOLEN and given to the underdog!',
    apply(p1,p2,SEM,p1s,p2s) {
      const p1Lead=p1.stats.hp>p2.stats.hp;
      const [ls,us,ln,un]=p1Lead?[p1s,p2s,p1.name,p2.name]:[p2s,p1s,p2.name,p1.name];
      const stolen=Math.min(ls.momentum||0,3);
      ls.momentum=Math.max(0,(ls.momentum||0)-stolen);
      us.momentum=Math.min(5,(us.momentum||0)+stolen);
      return `⚡ ${stolen} momentum stolen from ${ln} → ${un}!`;
    }
  },
  {
    id:'poison_rain', name:'☠️ POISON RAIN!',
    desc:'Toxic downpour! Both POISONED + WEAKENED for 2 turns!',
    apply(p1,p2,SEM) {
      SEM.applyEffect(p1,'poison',2); SEM.applyEffect(p1,'weaken',2);
      SEM.applyEffect(p2,'poison',2); SEM.applyEffect(p2,'weaken',2);
      return `☠️ Both fighters POISONED + WEAKENED!`;
    }
  },
  {
    id:'ancient_curse', name:'🌀 ANCIENT CURSE!',
    desc:'Terrible curse — all status effects SWAPPED between fighters!',
    apply(p1,p2) {
      const e1=[...(p1.statusEffects||[])]; const e2=[...(p2.statusEffects||[])];
      p1.statusEffects=e2; p2.statusEffects=e1;
      const cnt=e1.length+e2.length;
      return cnt>0?`🌀 ${cnt} status effects SWAPPED!`:`🌀 Ancient curse fizzles... no effects to swap.`;
    }
  },
  {
    id:'phoenix_fire', name:'🔥 PHOENIX FIRE!',
    desc:'Both lose 20% HP but gain +40% ATK for 2 turns!',
    apply(p1,p2) {
      const d1=Math.floor(p1.stats.maxHp*0.20); const d2=Math.floor(p2.stats.maxHp*0.20);
      p1.stats.hp=Math.max(1,p1.stats.hp-d1); p2.stats.hp=Math.max(1,p2.stats.hp-d2);
      if(!p1.buffs)p1.buffs=[]; if(!p2.buffs)p2.buffs=[];
      p1.buffs.push({stat:'atk',amount:40,duration:2,name:'Phoenix Fire'});
      p2.buffs.push({stat:'atk',amount:40,duration:2,name:'Phoenix Fire'});
      return `🔥 Both take -${d1}/${d2} HP but gain +40% ATK for 2 turns!`;
    }
  },
  {
    id:'dark_bargain', name:'😈 DARK BARGAIN!',
    desc:'A demon appears — both fighters\' HP is SWAPPED!',
    apply(p1,p2) {
      const hp1=p1.stats.hp; const hp2=p2.stats.hp;
      p1.stats.hp=Math.min(hp2,p1.stats.maxHp); p2.stats.hp=Math.min(hp1,p2.stats.maxHp);
      return `😈 HP SWAPPED! ${p1.name}: ${hp1}→${p1.stats.hp}, ${p2.name}: ${hp2}→${p2.stats.hp}!`;
    }
  },
];

function rollBattleEvent(turn) {
  if (turn < 3) return null;
  if (Math.random() > 0.20) return null;
  return BATTLE_EVENTS[Math.floor(Math.random() * BATTLE_EVENTS.length)];
}

// ═══════════════════════════════════════════════════════════════
// KILL FINISHER MESSAGES
// ═══════════════════════════════════════════════════════════════
const KILL_FINISHERS = {
  Warrior:      ['⚔️ *A single decisive slash ends it all!*', '🩸 *The warrior\'s blade finds its mark... FINAL!*'],
  Mage:         ['💥 *A cataclysmic spell vaporizes everything!*', '🌟 *Magic erupts — the light blinds all who watch!*'],
  Archer:       ['🏹 *One perfect arrow. One perfect shot.*', '🎯 *They never saw it coming...*'],
  Rogue:        ['🗡️ *A shadow. A whisper. Then silence.*', '💀 *Gone before the echo of the last blow fades.*'],
  Paladin:      ['✨ *Holy light overwhelms the fallen.*', '⚖️ *Judgment rendered. Justice delivered.*'],
  Berserker:    ['🩸 *ABSOLUTE DESTRUCTION! The arena is PAINTED.*', '💀 *UNHINGED VIOLENCE — the crowd is SPEECHLESS.*'],
  Necromancer:  ['☠️ *The soul is claimed. The body follows.*', '💀 *Dark magic closes like a cold fist.*'],
  Assassin:     ['🗡️ *Death came... and no one saw it happen.*', '🌑 *The kill was... clinical.*'],
  DragonKnight: ['🐉 *DRAGON\'S ROAR shakes the very ground!*', '🔥 *Burned to ash by ancient dragon fire!*'],
  Devourer:     ['👁️ *CONSUMED. Entirely.*', '🌑 *Devoured by the darkness within...*'],
  Monk:         ['🌀 *A final strike as swift as thought itself.*', '☯️ *Balance restored. One way or another.*'],
  Shaman:       ['🌿 *Nature reclaims what was always hers.*', '🌪️ *The spirits of the earth pass judgment.*'],
  BloodKnight:  ['🩸 *Every last drop... drained.*', '💀 *A crimson tide swallows the fallen.*'],
  SpellBlade:   ['💜 *Arcane and steel — the perfect synthesis.*', '⚡ *Magic and blade strike as ONE.*'],
  Summoner:     ['🔮 *Summoned hordes overwhelm the last defense.*', '👁️ *The final summon seals their fate.*'],
  Warlord:      ['👑 *CONQUEST COMPLETE. One more falls.*', '⚔️ *The warlord stands. All others kneel.*'],
  Elementalist: ['🌊 *ALL elements converge for the killing blow!*', '🌋 *Earth, fire, wind and water — UNIFIED to destroy.*'],
  ShadowDancer: ['💃 *A final dance. A final step. Done.*', '🌑 *They danced beautifully... right to the end.*'],
  Chronomancer: ['⏳ *TIME. IS. UP.*', '🕐 *The clock stopped. For them.*'],
  Phantom:      ['🌑 *The phantom delivers the final verdict.*', '👻 *Even death... is just another performance.*'],
  Knight:       ['⚔️ *For honor. For glory. For victory.*', '✨ *Sacred steel finds its final purpose.*'],
  Ranger:       ['🏹 *The hunt is over. The prey is taken.*', '🌲 *No prey escapes the ranger\'s final arrow.*'],
};

function getKillFinisher(winnerClass) {
  const lines = KILL_FINISHERS[winnerClass] || ['⚔️ *A decisive victory!*'];
  return lines[Math.floor(Math.random() * lines.length)];
}

// ═══════════════════════════════════════════════════════════════
// CINEMATIC COMMENTARY ENGINE v2
// ═══════════════════════════════════════════════════════════════
const COMMENTARY = {
  clutch:['🎭 *THE CROWD GOES SILENT...*','😤 *REFUSING TO GO DOWN!*','🔥 *IS THIS A COMEBACK?!*','💀 *ONE HIT FROM DEATH — AND STILL FIGHTING!*','🌪️ *UNBELIEVABLE RESILIENCE!*','🩸 *BLOOD AND WILLPOWER — NOTHING ELSE LEFT!*','😱 *HOW ARE THEY STILL STANDING?!*'],
  crit_streak:['🎯 *CRACKING THEM APART!*','💥 *PRECISION DEVASTATION!*','⚔️ *UNSTOPPABLE MOMENTUM!*','🔥 *READING THEM PERFECTLY!*','😤 *THEY CANNOT DEFEND AGAINST THIS!*'],
  comeback:['🔥 *RISING FROM THE ASHES!*','💪 *DON\'T COUNT THEM OUT YET!*','🌟 *THE COMEBACK IS REAL!*','😤 *HEART OF A CHAMPION!*','🏆 *THE CROWD DARES TO HOPE AGAIN!*'],
  special_used:['🌟 *A LEGENDARY TECHNIQUE!*','💫 *THIS IS THEIR SIGNATURE MOVE!*','⚡ *THE CROWD ERUPTS!*','😱 *THAT SKILL... IS DEVASTATING!*','🔥 *EVERYTHING RIDING ON THIS!*'],
  stalemate:['⚖️ *PERFECTLY MATCHED...*','🥵 *BOTH FIGHTERS GASPING...*','😤 *NEITHER WILLING TO YIELD!*','⚔️ *EVERY STRIKE TRADED EQUALLY...*','💀 *THIS COULD END EITHER WAY...*'],
  rage_activated:['🔥 *THE BEAST AWAKENS!*','💀 *DANGER UNLOCKS POWER!*','🩸 *BLOOD FUELS THE RAGE!*','😤 *DON\'T CORNER A WOUNDED FIGHTER!*','⚡ *THIS ISN\'T OVER — NOT BY A LONG SHOT!*'],
  parry:['🌀 *READ LIKE A BOOK!*','😱 *THE PERFECT COUNTER!*','⚔️ *TECHNIQUE MEETS TECHNIQUE!*','💫 *UNBELIEVABLE TIMING!*'],
  chain_combo:['🔗 *FLAWLESS EXECUTION — COMBO MASTERY!*','💥 *THE PERFECT SEQUENCE!*','⚔️ *TACTICAL BRILLIANCE!*','🎭 *THEY\'VE BEEN SETTING THIS UP ALL ALONG!*'],
  desperation:['😱 *LAST RESORT — ALL OR NOTHING!*','💀 *BURNING EVERYTHING FOR ONE FINAL CHANCE!*','🔥 *THE ULTIMATE GAMBLE!*','⚡ *IS THIS ENOUGH?!*'],
  domination:['💀 *TOTAL DOMINATION.*','😤 *IS THERE ANY CHANCE OF COMING BACK FROM THIS?*','🔥 *OVERWHELMING FORCE!*'],
};

function getCommentary(state) {
  const lines = COMMENTARY[state] || [];
  if (!lines.length) return '';
  return lines[Math.floor(Math.random() * lines.length)] + '\n';
}

function buildCinematicComment(p1, p2, p1s, p2s, r1, r2, p1Takes, p2Takes, turn) {
  const p1Pct = p1.stats.hp / p1.stats.maxHp;
  const p2Pct = p2.stats.hp / p2.stats.maxHp;
  const lines = [];

  if (p1Pct <= 0.20 && !p1s._rageCommented) {
    lines.push(`\n🔥 *${p1.name}* IS IN RAGE MODE!\n` + getCommentary('rage_activated'));
    p1s._rageCommented = true;
  }
  if (p2Pct <= 0.20 && !p2s._rageCommented) {
    lines.push(`\n🔥 *${p2.name}* IS IN RAGE MODE!\n` + getCommentary('rage_activated'));
    p2s._rageCommented = true;
  }

  if (p1Takes > 0 && p1Pct < 0.15 && p1.stats.hp > 0) lines.push(getCommentary('clutch'));
  if (p2Takes > 0 && p2Pct < 0.15 && p2.stats.hp > 0) lines.push(getCommentary('clutch'));
  if (p1Takes > p1.stats.maxHp * 0.45) lines.push(`💥 *DEVASTATING!* ${p1.name} took *${p1Takes}* — nearly killed!\n`);
  if (p2Takes > p2.stats.maxHp * 0.45) lines.push(`💥 *DEVASTATING!* ${p2.name} took *${p2Takes}* — nearly killed!\n`);
  if (p1Pct < 0.20 && p2Pct > 0.80) lines.push(getCommentary('domination'));
  if (p2Pct < 0.20 && p1Pct > 0.80) lines.push(getCommentary('domination'));
  if (r1?.wasSpecial) lines.push(getCommentary('special_used'));
  if (r2?.wasSpecial) lines.push(getCommentary('special_used'));
  if (p1Pct < 0.30 && p2Pct < 0.30 && turn > 5) lines.push(getCommentary('stalemate'));
  if ((p1s.critStreak||0) >= 3) lines.push(getCommentary('crit_streak'));
  if ((p2s.critStreak||0) >= 3) lines.push(getCommentary('crit_streak'));

  if (p1s._wasLosing && p2Pct < p1Pct) { lines.push(getCommentary('comeback')); p1s._wasLosing = false; }
  if (p2s._wasLosing && p1Pct < p2Pct) { lines.push(getCommentary('comeback')); p2s._wasLosing = false; }
  if (p1Pct < 0.40 && p2Pct > 0.60) p1s._wasLosing = true;
  if (p2Pct < 0.40 && p1Pct > 0.60) p2s._wasLosing = true;

  return lines.filter(Boolean).join('');
}

// ═══════════════════════════════════════════════════════════════
// TURN TIMER
// ═══════════════════════════════════════════════════════════════
const TURN_TIMEOUT_MS = 120_000;

function clearBattleTimer(key) {
  const t = battleTimers.get(key);
  if (t) { clearTimeout(t); battleTimers.delete(key); }
}

async function setTurnTimer(sock, chatId, p1, p2, p1Id, p2Id, db, save, key) {
  clearBattleTimer(key);
  const t = setTimeout(async () => {
    try {
      const fresh1 = db.users[p1Id];
      const fresh2 = db.users[p2Id];
      if (!fresh1?.pvpBattle || !fresh2?.pvpBattle) return;
      if (!fresh1.pvpBattle.opponentId || !fresh2.pvpBattle.opponentId) return;
      let timedOut = [];
      if (!fresh1.pvpBattle.pendingAction) { fresh1.pvpBattle.pendingAction = { type:'attack' }; timedOut.push(fresh1.name); }
      if (!fresh2.pvpBattle.pendingAction) { fresh2.pvpBattle.pendingAction = { type:'attack' }; timedOut.push(fresh2.name); }
      if (timedOut.length > 0) {
        const warn = timedOut.map(n => `⏰ *${n}* timed out — AUTO-ATTACK fired!`).join('\n');
        await sock.sendMessage(chatId, { text: warn, mentions: [p1Id, p2Id] }, { quoted: msg });
        save();
        // Auto-resolve the full turn so the battle never gets stuck
        try {
          const pvpMod = require('./pvp');
          if (pvpMod && pvpMod.executeBothActions) {
            await pvpMod.executeBothActions(sock, chatId, fresh1, fresh2, db, save, p1Id);
          }
        } catch(e2) {}
      }
    } catch(e) { console.error('[PvP Timer]', e.message); }
  }, TURN_TIMEOUT_MS);
  battleTimers.set(key, t);
}

// ═══════════════════════════════════════════════════════════════
// BATTLE STATS
// ═══════════════════════════════════════════════════════════════
function initBattleStats() {
  return { totalDamageDealt:0, totalDamageTaken:0, critsLanded:0, skillsUsed:0, specialsUsed:0, highestHit:0, turnsPlayed:0, statusEffectsLanded:0, combosActivated:0, desperationUsed:false };
}

function updateBattleStats(stats, dmgDealt, dmgTaken, isCrit, actionType, statusCount) {
  stats.totalDamageDealt += (dmgDealt||0);
  stats.totalDamageTaken += (dmgTaken||0);
  if (isCrit) stats.critsLanded++;
  if (actionType==='skill') stats.skillsUsed++;
  if (actionType==='special') stats.specialsUsed++;
  if (dmgDealt > stats.highestHit) stats.highestHit = dmgDealt;
  stats.statusEffectsLanded += (statusCount||0);
}

function buildStatsBlock(winner, loser, wStats, lStats, totalTurns) {
  return (
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 *BATTLE STATS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👑 *${winner.name}*\n   💥 Dealt: ${wStats.totalDamageDealt} | 🎯 Crits: ${wStats.critsLanded}\n` +
    `   ⚡ Skills: ${wStats.skillsUsed} | 🌟 Specials: ${wStats.specialsUsed}\n` +
    `   🔥 Highest hit: ${wStats.highestHit}` +
    (wStats.combosActivated>0?` | 🔗 Combos: ${wStats.combosActivated}`:'') + `\n\n` +
    `💀 *${loser.name}*\n   💥 Dealt: ${lStats.totalDamageDealt} | 🎯 Crits: ${lStats.critsLanded}\n` +
    `   ⚡ Skills: ${lStats.skillsUsed} | 🌟 Specials: ${lStats.specialsUsed}\n` +
    `   🔥 Highest hit: ${lStats.highestHit}\n\n` +
    `⏱️ *${totalTurns} turns* total\n`
  );
}

module.exports = {
  activeBets, spectators, battleTimers, pendingRematches, battleKey,
  ARENAS, rollArena,
  SKILL_COOLDOWN_TURNS, initSkillCooldowns, tickSkillCooldowns, isSkillReady, useSkillCooldown,
  CHAIN_COMBOS, checkChainCombo,
  DESPERATION_MOVES,
  rollBattleEvent, BATTLE_EVENTS,
  getCommentary, buildCinematicComment,
  KILL_FINISHERS, getKillFinisher,
  clearBattleTimer, setTurnTimer, TURN_TIMEOUT_MS,
  initBattleStats, updateBattleStats, buildStatsBlock,
};
