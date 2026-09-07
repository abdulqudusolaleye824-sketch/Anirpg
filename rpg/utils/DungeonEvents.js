// ═══════════════════════════════════════════════════════════════
// DUNGEON EVENT SYSTEM
// Special rooms, traps, treasure, and elite encounters
// These fire between monster defeats for variety
// ═══════════════════════════════════════════════════════════════

const StatusEffectManager = require('./StatusEffectManager');

// ═══════════════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════════════
const EVENT_TYPES = {
  // ── Positive Events ────────────────────────────────────────
  TREASURE_CHEST: {
    weight: 12,
    name: 'Treasure Chest',
    trigger: (dungeon, players) => {
      const rank = dungeon.rank || 'F';
      const goldMult = { F:1, E:1.5, D:2.5, C:4, B:6, A:9, S:14 };
      const base = 60 + Math.floor(Math.random() * 80);
      const gold = Math.floor(base * (goldMult[rank] || 1));
      const xp   = Math.floor(gold * 1.5);
      players.forEach(p => { p.gold = (p.gold||0)+gold; p.xp = (p.xp||0)+xp; });
      return {
        type:'positive',
        title:'💠 TREASURE CHEST!',
        message:`🗝️ You find a dusty chest in an alcove!\nThe lock breaks open easily...\n\n💠 Found *${gold}* gold!\n✨ Gained *${xp}* XP!\n\nEach party member receives the reward.`
      };
    }
  },

  MYSTERIOUS_FOUNTAIN: {
    weight: 10,
    name: 'Healing Fountain',
    trigger: (dungeon, players) => {
      const healPct = 0.30 + Math.random() * 0.20; // 30-50%
      let healed = [];
      players.forEach(p => {
        const h = Math.floor(p.stats.maxHp * healPct);
        const actual = Math.min(h, p.stats.maxHp - p.stats.hp);
        p.stats.hp = Math.min(p.stats.maxHp, p.stats.hp + h);
        p.stats.energy = Math.min(p.stats.maxEnergy, (p.stats.energy||0) + Math.floor(p.stats.maxEnergy*0.3));
        healed.push(`❤️ ${p.name}: +${actual} HP`);
      });
      return {
        type:'positive',
        title:'⛲ HEALING FOUNTAIN!',
        message:`💧 You discover a glowing spring...\nThe water feels magical!\n\n${healed.join('\n')}\n💙 +30% Energy restored!\n\nYou feel refreshed and ready to fight.`
      };
    }
  },

  WANDERING_MERCHANT: {
    weight: 8,
    name: 'Wandering Merchant',
    trigger: (dungeon, players) => {
      // Gives each player a free health potion
      players.forEach(p => {
        if (!p.inventory) p.inventory = {};
        p.inventory.healthPotions = (p.inventory.healthPotions||0) + 1;
      });
      return {
        type:'positive',
        title:'🧙 WANDERING MERCHANT!',
        message:`🛒 A hooded merchant steps from the shadows:\n"*Psst... adventurers! Free sample today!*"\n\n🧪 Everyone received *1 Health Potion*!\n\n"*Come find me when you're richer...*"\n*The merchant vanishes into the dark.*`
      };
    }
  },

  ANCIENT_SHRINE: {
    weight: 9,
    name: 'Ancient Shrine',
    trigger: (dungeon, players) => {
      // Buff random stat for 3 turns
      const stats = ['atk','def','speed'];
      const chosen = stats[Math.floor(Math.random()*stats.length)];
      const amount = 20 + Math.floor(Math.random()*15);
      players.forEach(p => {
        if (!p.buffs) p.buffs=[];
        p.buffs.push({stat:chosen, amount, duration:5, name:'Shrine Blessing'});
      });
      return {
        type:'positive',
        title:'🏛️ ANCIENT SHRINE!',
        message:`✨ You find a glowing ancient shrine...\nPraying, you receive a blessing!\n\n💪 All party members: *+${amount}% ${chosen.toUpperCase()}* for 5 turns!\n\n"*May the ancients guide your blades.*"`
      };
    }
  },

  RUNE_INSCRIPTION: {
    weight: 7,
    name: 'Mysterious Inscription',
    trigger: (dungeon, players) => {
      // Partial energy restore
      players.forEach(p => {
        p.stats.energy = Math.min(p.stats.maxEnergy, (p.stats.energy||0) + Math.floor(p.stats.maxEnergy*0.5));
      });
      return {
        type:'positive',
        title:'📜 RUNE INSCRIPTION!',
        message:`🔮 Strange runes glow on the wall...\nYou decipher an ancient power formula!\n\n⚡ All party members: *+50% Energy* restored!\n\nYour skills feel charged and ready.`
      };
    }
  },

  BONE_PILE: {
    weight: 6,
    name: 'Bone Pile',
    trigger: (dungeon, players) => {
      // Small bonus gold from looting fallen adventurers
      const gold = 30 + Math.floor(Math.random()*50);
      players.forEach(p => { p.gold=(p.gold||0)+gold; });
      return {
        type:'positive',
        title:'💀 BONE PILE!',
        message:`🦴 You rummage through fallen adventurers' remains...\nSomewhat macabre, but effective!\n\n💠 Found *${gold}* gold in scattered pouches!\n\n*A note reads: "If you found this, I'm sorry."*`
      };
    }
  },

  // ── Negative Events ─────────────────────────────────────────
  SPIKE_TRAP: {
    weight: 10,
    name: 'Spike Trap',
    trigger: (dungeon, players) => {
      const dmgPct = 0.10 + Math.random()*0.10;
      let msgs = [];
      players.forEach(p => {
        const dmg = Math.floor(p.stats.maxHp * dmgPct);
        p.stats.hp = Math.max(1, p.stats.hp - dmg);
        msgs.push(`💥 ${p.name}: -${dmg} HP`);
      });
      return {
        type:'negative',
        title:'⚠️ SPIKE TRAP!',
        message:`😱 *CLICK!*\nThe floor gives way — spikes shoot up!\n\n${msgs.join('\n')}\n\n💡 Tip: Higher DEF reduces trap damage.`
      };
    }
  },

  POISON_GAS: {
    weight: 8,
    name: 'Poison Gas',
    trigger: (dungeon, players) => {
      let poisoned = [];
      players.forEach(p => {
        StatusEffectManager.applyEffect(p, 'poison', 3);
        poisoned.push(`🟢 ${p.name}`);
      });
      return {
        type:'negative',
        title:'☠️ POISON GAS VENT!',
        message:`😵 A hissing vent releases toxic fumes!\nEveryone breathes it in!\n\n${poisoned.join('\n')}\n\n🟢 *POISONED* for 3 turns!\nUse a potion or tough it out!`
      };
    }
  },

  CURSED_ALTAR: {
    weight: 6,
    name: 'Cursed Altar',
    trigger: (dungeon, players) => {
      // Weakens ATK temporarily
      players.forEach(p => {
        if (!p.buffs) p.buffs=[];
        p.buffs.push({stat:'atk', amount:-15, duration:3, name:'Curse'});
      });
      return {
        type:'negative',
        title:'🌑 CURSED ALTAR!',
        message:`👁️ A dark altar pulses with malevolent energy...\nTouching it — a mistake!\n\n💔 All party members: *-15% ATK* for 3 turns!\n\nThe altar cackles as you stagger back.`
      };
    }
  },

  AMBUSH: {
    weight: 9,
    name: 'Ambush',
    trigger: (dungeon, players) => {
      // Next monster gets +30% ATK for 1 turn
      if (dungeon.currentMonster) {
        if (!dungeon.currentMonster.buffs) dungeon.currentMonster.buffs=[];
        dungeon.currentMonster.buffs.push({stat:'atk', amount:30, duration:2, name:'Ambush Rage'});
      }
      return {
        type:'negative',
        title:'🗡️ AMBUSH!',
        message:`👤 Shadows move — it's an ambush!\n\n⚠️ The next enemy has been *alerted*!\n💢 *+30% ATK* for 2 turns!\n\nStay sharp!`
      };
    }
  },

  COLLAPSING_CEILING: {
    weight: 5,
    name: 'Collapsing Ceiling',
    trigger: (dungeon, players) => {
      const dmgPct = 0.08 + Math.random()*0.07;
      let msgs=[];
      players.forEach(p => {
        const dmg=Math.floor(p.stats.maxHp*dmgPct);
        p.stats.hp=Math.max(1,p.stats.hp-dmg);
        msgs.push(`🪨 ${p.name}: -${dmg} HP`);
      });
      return {
        type:'negative',
        title:'🪨 COLLAPSING CEILING!',
        message:`💥 *CRACK!* The ceiling buckles!\n\n${msgs.join('\n')}\n\nYou barely dodge the worst of it!`
      };
    }
  },

  // ── Neutral/Mixed Events ─────────────────────────────────────
  DARK_PACT: {
    weight: 5,
    name: 'Dark Pact Altar',
    trigger: (dungeon, players) => {
      // Sacrifice HP for ATK buff — risk/reward
      const hpCost = 0.20;
      const atkGain = 35;
      players.forEach(p => {
        const cost = Math.floor(p.stats.maxHp * hpCost);
        p.stats.hp = Math.max(1, p.stats.hp - cost);
        if (!p.buffs) p.buffs=[];
        p.buffs.push({stat:'atk', amount:atkGain, duration:4, name:'Dark Pact'});
      });
      return {
        type:'mixed',
        title:'🩸 DARK PACT ALTAR!',
        message:`😈 A sinister altar whispers promises of power...\nYou accept the bargain!\n\n💔 All members: -20% HP\n💪 All members: *+${atkGain}% ATK* for 4 turns!\n\n*"Power has a price,"* it hisses.`
      };
    }
  },

  MYSTERIOUS_POTION: {
    weight: 7,
    name: 'Mysterious Potion',
    trigger: (dungeon, players) => {
      const outcomes = ['heal','buff','debuff','energy'];
      const outcome = outcomes[Math.floor(Math.random()*outcomes.length)];
      let msg='';
      if (outcome==='heal') {
        players.forEach(p=>{ const h=Math.floor(p.stats.maxHp*0.25); p.stats.hp=Math.min(p.stats.maxHp,p.stats.hp+h); });
        msg=`✅ It was a *Healing Potion*! +25% HP!`;
      } else if (outcome==='buff') {
        players.forEach(p=>{ if(!p.buffs)p.buffs=[]; p.buffs.push({stat:'atk',amount:20,duration:3,name:'Mystery Buff'}); });
        msg=`✅ It was a *Power Serum*! +20% ATK for 3 turns!`;
      } else if (outcome==='debuff') {
        players.forEach(p=>{ StatusEffectManager.applyEffect(p,'weaken',2); });
        msg=`❌ It was a *Weakness Draft*! WEAKENED for 2 turns!`;
      } else {
        players.forEach(p=>{ p.stats.energy=p.stats.maxEnergy; });
        msg=`✅ It was an *Elixir*! Full energy restored!`;
      }
      return {
        type:'mixed',
        title:'🧪 MYSTERIOUS POTION!',
        message:`🫙 You find a strangely-colored vial...\nSomeone drinks it.\n\n${msg}\n\n*The label read "Surprise Inside"*`
      };
    }
  },

  HAUNTED_MIRROR: {
    weight: 4,
    name: 'Haunted Mirror',
    trigger: (dungeon, players) => {
      // Random stat swap — ATK +20%, DEF -20% or vice versa
      const atkFirst = Math.random() < 0.5;
      players.forEach(p=>{
        if(!p.buffs)p.buffs=[];
        if(atkFirst) {
          p.buffs.push({stat:'atk',amount:25,duration:3,name:'Mirror Vision'});
          p.buffs.push({stat:'def',amount:-25,duration:3,name:'Mirror Vision'});
        } else {
          p.buffs.push({stat:'def',amount:25,duration:3,name:'Mirror Vision'});
          p.buffs.push({stat:'atk',amount:-25,duration:3,name:'Mirror Vision'});
        }
      });
      return {
        type:'mixed',
        title:'🪞 HAUNTED MIRROR!',
        message:`👻 A cracked mirror flickers with faces...\nStaring too long warps your perception!\n\n${atkFirst?`⚔️ +25% ATK and 🛡️ -25% DEF for 3 turns!`:`🛡️ +25% DEF and ⚔️ -25% ATK for 3 turns!`}\n\n*The reflections laugh.*`
      };
    }
  },
};

// ═══════════════════════════════════════════════════════════════
// FLOOR THEMES — Visual and mechanical theme per dungeon zone
// ═══════════════════════════════════════════════════════════════
const FLOOR_THEMES = {
  '🌲 Goblin Forest':       { color:'🌿', flavorPre:'Twisted roots catch your feet as you enter the goblin-infested forest.',       between:'The trees grow darker, closing in around you.' },
  '🕸️ Spider Den':          { color:'🕸️', flavorPre:'Sticky silk catches your hair. The air smells of venom.',                       between:'The webs grow thicker. Somewhere, something skitters.' },
  '💀 Abandoned Graveyard': { color:'💀', flavorPre:'Cold air rises from the graves. The dead don\'t stay dead here.',               between:'A wail echoes. The ground shifts underfoot.' },
  '🌙 Dark Forest':         { color:'🌑', flavorPre:'Moonless. Silent. The forest watches with hungry eyes.',                        between:'A howl in the distance. The pack is gathering.' },
  '🏔️ Mountain Pass':       { color:'⛰️', flavorPre:'Wind whips through the rocky pass. Rocks clatter from above.',                 between:'The path narrows. One wrong step is fatal.' },
  '⚰️ Haunted Catacombs':   { color:'☠️', flavorPre:'The torches gutter as you descend. Something breathes in the darkness.',       between:'The shadows move on their own. Eyes blink from the walls.' },
  '🔥 Demon Cavern':        { color:'🔥', flavorPre:'Heat blasts your face. The walls run with magma.',                              between:'The temperature rises. The demons grow restless.' },
  '🏰 Cursed Castle':       { color:'🧛', flavorPre:'The gates creak open. Blood stains the ancient stone.',                        between:'A chandelier crashes. The curse grows stronger.' },
  '🌋 Volcano Depths':      { color:'🌋', flavorPre:'The earth groans. Rivers of molten rock carve new paths constantly.',          between:'The volcano trembles. Something ancient stirs below.' },
};

function getFloorTheme(dungeonName) {
  return FLOOR_THEMES[dungeonName] || { color:'⚔️', flavorPre:'You enter a dangerous dungeon.', between:'You press deeper into the darkness.' };
}

// ═══════════════════════════════════════════════════════════════
// MINI-BOSS ENCOUNTERS — Appear at 50% through dungeon
// ═══════════════════════════════════════════════════════════════
const MINI_BOSSES = {
  F: [
    { name:'Alpha Goblin',      emoji:'👺', title:'Pack Commander',    atkMult:2.2, hpMult:2.0, abilities:['Warchief Slash','Command Howl','Furious Charge'] },
    { name:'Ancient Slime',     emoji:'🟢', title:'The Primordial',    atkMult:2.0, hpMult:2.5, abilities:['Acid Barrage','Split Form','Engulf'] },
  ],
  E: [
    { name:'Undead Captain',    emoji:'💀', title:'Remnant of Battle',  atkMult:2.3, hpMult:2.2, abilities:['Death Slash','Bone Shield','Soul Rend'] },
    { name:'Werewolf Brute',    emoji:'🐺', title:'Feral Omega',        atkMult:2.5, hpMult:2.0, abilities:['Savage Bite','Howl','Feral Leap'] },
  ],
  D: [
    { name:'Demon Sergeant',    emoji:'😈', title:'Hell\'s Lieutenant',  atkMult:2.4, hpMult:2.3, abilities:['Hellfire Burst','Dark Chain','Infernal Slash'] },
    { name:'Vampire Centurion', emoji:'🧛', title:'Ancient Blood Drinker',atkMult:2.3, hpMult:2.2, abilities:['Blood Feast','Hypnotic Gaze','Shadow Step'] },
  ],
  C: [
    { name:'Fire Drake',        emoji:'🐉', title:'Volcano Born',       atkMult:2.5, hpMult:2.4, abilities:['Dragonfire','Wing Slam','Roar of Terror'] },
    { name:'Undead General',    emoji:'☠️', title:'Death\'s Servant',    atkMult:2.4, hpMult:2.6, abilities:['Death Wave','Undying Will','Soul Drain'] },
  ],
  B: [
    { name:'Shadow Dragon',     emoji:'🐲', title:'Nightmare Incarnate', atkMult:2.6, hpMult:2.5, abilities:['Void Breath','Shadow Cloak','Reality Rend'] },
    { name:'Titan Wraith',      emoji:'👤', title:'The Unending',        atkMult:2.5, hpMult:2.8, abilities:['Wail of Doom','Phase Strike','Soul Consume'] },
  ],
};

function spawnMiniBoss(dungeonRank, avgLevel) {
  const pool = MINI_BOSSES[dungeonRank] || MINI_BOSSES['F'];
  const tmpl = pool[Math.floor(Math.random()*pool.length)];
  const hpBase  = 200 + avgLevel * 25;
  const atkBase = 30  + avgLevel * 8;
  const defBase = 15  + avgLevel * 4;
  return {
    ...tmpl,
    rank: dungeonRank,
    isMiniBoss: true,
    stats: {
      hp:    Math.floor(hpBase  * tmpl.hpMult),
      maxHp: Math.floor(hpBase  * tmpl.hpMult),
      atk:   Math.floor(atkBase * tmpl.atkMult),
      def:   Math.floor(defBase * 1.3),
      speed: 90 + Math.floor(Math.random()*20)
    },
    level: avgLevel
  };
}

// ═══════════════════════════════════════════════════════════════
// EVENT SELECTION
// ═══════════════════════════════════════════════════════════════
function selectRandomEvent(dungeonRank, monstersDefeated, totalMonsters) {
  // Mini-boss at midpoint
  if (totalMonsters >= 5 && monstersDefeated === Math.floor(totalMonsters * 0.5)) return 'MINI_BOSS';

  const total = Object.values(EVENT_TYPES).reduce((s,e)=>s+e.weight,0);
  let rand = Math.random()*total;
  for (const [key, ev] of Object.entries(EVENT_TYPES)) {
    rand -= ev.weight;
    if (rand <= 0) return key;
  }
  return 'TREASURE_CHEST';
}

// ═══════════════════════════════════════════════════════════════
// TRIGGER EVENT — returns event result object
// ═══════════════════════════════════════════════════════════════
function triggerEvent(eventKey, dungeon, players, avgLevel) {
  if (eventKey === 'MINI_BOSS') {
    const mb = spawnMiniBoss(dungeon.rank||'F', avgLevel);
    return { type:'mini_boss', miniBoss:mb, title:`⚠️ MINI-BOSS: ${mb.name}!`, message:`🚨 *${mb.emoji} ${mb.name}* emerges from the shadows!\n"${mb.title}"\n\n❤️ HP: ${mb.stats.hp}\n⚔️ ATK: ${mb.stats.atk} | 🛡️ DEF: ${mb.stats.def}\n🎯 Abilities: ${mb.abilities.join(', ')}\n\n⚔️ Defeat it to continue!` };
  }
  const ev = EVENT_TYPES[eventKey];
  if (!ev) return null;
  try { return ev.trigger(dungeon, players); } catch(e) { console.error('Event error:', e); return null; }
}

// ═══════════════════════════════════════════════════════════════
// ELITE MONSTER MODIFIER — Makes the final monster more dangerous
// ═══════════════════════════════════════════════════════════════
function createEliteMonster(monster) {
  const elite = JSON.parse(JSON.stringify(monster));
  elite.isElite = true;
  elite.name = `Elite ${monster.name}`;
  elite.stats.hp = Math.floor(monster.stats.hp * 1.8);
  elite.stats.maxHp = elite.stats.hp;
  elite.stats.atk = Math.floor(monster.stats.atk * 1.5);
  elite.stats.def = Math.floor(monster.stats.def * 1.3);
  // Add elite ability
  const eliteAbilities = ['Elite Slam', 'Empowered Strike', 'Last Stand', 'Desperate Assault'];
  elite.abilities = [...(monster.abilities||[]), eliteAbilities[Math.floor(Math.random()*eliteAbilities.length)]];
  return elite;
}

// ═══════════════════════════════════════════════════════════════
// EVENT CHANCE — Should an event fire between monsters?
// ═══════════════════════════════════════════════════════════════
function shouldTriggerEvent(monstersDefeated, totalMonsters) {
  if (monstersDefeated === 0) return false; // First monster has no event before it
  if (totalMonsters >= 5 && monstersDefeated === Math.floor(totalMonsters*0.5)) return true; // Always trigger at midpoint
  return Math.random() < 0.35; // 35% chance between monsters
}

module.exports = {
  selectRandomEvent,
  triggerEvent,
  shouldTriggerEvent,
  spawnMiniBoss,
  createEliteMonster,
  getFloorTheme,
  EVENT_TYPES,
};
