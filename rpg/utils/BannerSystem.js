// ═══════════════════════════════════════════════════════════════
// BANNER SYSTEM — Multi-banner gacha with rate-ups and rotation
// Weapons have elements, passives, and lore. Feel like a real RPG.
// ═══════════════════════════════════════════════════════════════

const RARITY_EMOJI  = { common:'⚪', rare:'🔵', epic:'🟣', legendary:'🟡' };
const ELEMENT_EMOJI = { fire:'🔥', ice:'❄️', thunder:'⚡', shadow:'🌑', void:'🖤', light:'✨', earth:'🌿', none:'' };

// ─────────────────────────────────────────────────────────────
// ITEM REGISTRY — Every pullable item with lore, element, passive
// ─────────────────────────────────────────────────────────────
const ITEM_REGISTRY = {

  // ── Rare Weapons ─────────────────────────────────────────────
  'blade_of_dawn': {
    name:'⚔️ Blade of Dawn', type:'weapon', rarity:'rare', element:'light',
    bonus:{ atk:25 },
    lore:'"Forged at sunrise by the Sunforge monks. Hums faintly in darkness."',
    passive:{ name:'Dawn\'s Edge', desc:'First attack each battle deals +30% bonus damage.', trigger:'first_hit', value:0.30 },
  },
  'arcane_staff': {
    name:'🔮 Arcane Mana Stone Staff', type:'weapon', rarity:'rare', element:'none',
    bonus:{ atk:22 },
    lore:'"Crystallized mana from the Collapsed Tower. Vibrates near magic."',
    passive:{ name:'Mana Surge', desc:'+15% skill damage.', trigger:'skill_boost', value:0.15 },
  },
  'phantom_arrow': {
    name:'🏹 Phantom Arrow', type:'weapon', rarity:'rare', element:'shadow',
    bonus:{ atk:20, speed:8 },
    lore:'"The arrow leaves no sound. Targets never hear it coming."',
    passive:{ name:'Ghost Shot', desc:'+10% chance to ignore enemy DEF entirely.', trigger:'def_pierce', value:0.10 },
  },
  'frostbite_dagger': {
    name:'🗡️ Frostbite Dagger', type:'weapon', rarity:'rare', element:'ice',
    bonus:{ atk:18, speed:12 },
    lore:'"Carved from glacier ice that never melts. Touch it too long and your fingers go numb."',
    passive:{ name:'Chill Touch', desc:'15% chance to slow enemy (they lose their next speed bonus).', trigger:'chill', value:0.15 },
  },
  'ember_blade': {
    name:'🔥 Ember Blade', type:'weapon', rarity:'rare', element:'fire',
    bonus:{ atk:23 },
    lore:'"Still warm from the forge. The heat never quite left."',
    passive:{ name:'Burning Edge', desc:'Attacks apply a burn: enemy loses 5% HP next turn.', trigger:'burn', value:0.05 },
  },

  // ── Epic Weapons ──────────────────────────────────────────────
  'shadow_fang': {
    name:'🗡️ Shadow Fang', type:'weapon', rarity:'epic', element:'shadow',
    bonus:{ atk:40 },
    lore:'"Found in the lair of the Phantom General. Still carries the scent of death."',
    passive:{ name:'Backstab', desc:'25% chance on attack to strike twice (second hit = 50% damage).', trigger:'double_strike', value:0.25 },
  },
  'tidal_scepter': {
    name:'🌊 Tidal Scepter', type:'weapon', rarity:'epic', element:'none',
    bonus:{ atk:38, def:10 },
    lore:'"Raised from the ocean floor. Responds to the pull of the moon."',
    passive:{ name:'Tidal Guard', desc:'Reduces all incoming damage by 8% while HP > 50%.', trigger:'damage_reduce', value:0.08 },
  },
  'hellfire_gs': {
    name:'🔥 Hellfire Greatsword', type:'weapon', rarity:'epic', element:'fire',
    bonus:{ atk:45 },
    lore:'"Forged in the second layer of the Abyss. Too heavy for ordinary hunters."',
    passive:{ name:'Inferno Cleave', desc:'On critical hits, deal an extra 40% fire damage.', trigger:'crit_fire', value:0.40 },
  },
  'stormcaller': {
    name:'⚡ Stormcaller Spear', type:'weapon', rarity:'epic', element:'thunder',
    bonus:{ atk:42, speed:10 },
    lore:'"Strikes before thunder reaches the ears. Speed is its true power."',
    passive:{ name:'Chain Lightning', desc:'20% chance on hit to arc lightning to deal bonus +25% damage.', trigger:'chain_lightning', value:0.25 },
  },
  'void_saber': {
    name:'🖤 Void Saber', type:'weapon', rarity:'epic', element:'void',
    bonus:{ atk:44 },
    lore:'"Does it cut through space or simply erase what it touches?"',
    passive:{ name:'Void Rend', desc:'Each hit reduces enemy DEF by 3 (stacks up to 15) for the battle.', trigger:'def_shred', value:3 },
  },

  // ── Legendary Weapons ─────────────────────────────────────────
  'thunder_edge': {
    name:'⚡ Thunder Edge', type:'weapon', rarity:'legendary', element:'thunder',
    bonus:{ atk:70, speed:15 },
    lore:'"Said to contain a sealed thundergod. On quiet nights, you can hear it scream."',
    passive:{ name:'Divine Thunder', desc:'30% chance to strike with divine lightning: +80% damage and stuns the enemy (they skip a defense roll).', trigger:'divine_strike', value:0.80 },
  },
  'void_destroyer': {
    name:'🌌 Void Destroyer', type:'weapon', rarity:'legendary', element:'void',
    bonus:{ atk:80 },
    lore:'"The weapon that ended the Age of Gates. Its last wielder was never found."',
    passive:{ name:'Annihilation', desc:'At the start of turn 3+, gain 20% bonus ATK permanently for the rest of the battle.', trigger:'battle_ramp', value:0.20 },
  },

  // ── Limited Legendary Weapons ─────────────────────────────────
  'divine_judgment': {
    name:'⚖️ Divine Judgment', type:'weapon', rarity:'legendary', element:'light', limited:true,
    bonus:{ atk:90, def:20 },
    lore:'"The sword of the First Guild Master. It judges worthy and unworthy alike."',
    passive:{ name:'Holy Verdict', desc:'Against enemies above 60% HP, deal +50% damage. The strong are punished.', trigger:'execute_high', value:0.50 },
  },
  'eclipse_blade': {
    name:'🌑 Eclipse Blade', type:'weapon', rarity:'legendary', element:'shadow', limited:true,
    bonus:{ atk:85, speed:20 },
    lore:'"Born from a solar eclipse. Carries the power of both sun and void."',
    passive:{ name:'Eclipse Strike', desc:'Every 3rd attack deals double damage.', trigger:'every_third', value:2.0 },
  },
  'abyssal_scythe': {
    name:'💀 Abyssal Scythe', type:'weapon', rarity:'legendary', element:'void', limited:true,
    bonus:{ atk:95 },
    lore:'"The Reaper\'s own weapon, stolen by a hunter who refused to die."',
    passive:{ name:'Reaper\'s Toll', desc:'Each kill attempt that fails still deals 15% of enemy\'s max HP as flat damage.', trigger:'reaper_toll', value:0.15 },
  },

  // ── Artifacts ─────────────────────────────────────────────────
  'ring_of_valor': {
    name:'💍 Ring of Valor', type:'artifact', rarity:'rare',
    bonus:{ atk:8 }, desc:'+8 ATK permanently',
    lore:'"Worn by the 100 Martyrs. Each death made the ring stronger."',
  },
  'necklace_of_thorns': {
    name:'📿 Necklace of Thorns', type:'artifact', rarity:'rare',
    bonus:{ def:8 }, desc:'+8 DEF permanently',
    lore:'"The thorns are real. It draws blood from its own wearer to protect them."',
  },
  'swift_boots': {
    name:'👟 Swift Boots', type:'artifact', rarity:'rare',
    bonus:{ speed:10 }, desc:'+10 SPD permanently',
    lore:'"Leave no footprints. Leave no trace. Move like wind between raindrops."',
  },
  'crimson_band': {
    name:'🩸 Crimson Band', type:'artifact', rarity:'rare',
    bonus:{ atk:6, maxHp:25 }, desc:'+6 ATK +25 HP permanently',
    lore:'"A blood pact sealed in red iron. The wearer fights harder the more they bleed."',
  },
  'gauntlet_of_giants': {
    name:'🦾 Gauntlet of Giants', type:'artifact', rarity:'epic',
    bonus:{ atk:15, def:10 }, desc:'+15 ATK +10 DEF permanently',
    lore:'"Taken from the wrist of a Stone Giant after a three-day battle."',
  },
  'eye_of_abyss': {
    name:'👁️ Eye of the Abyss', type:'artifact', rarity:'epic',
    bonus:{ atk:12, speed:12 }, desc:'+12 ATK +12 SPD permanently',
    lore:'"See everything. Anticipate every move. The eye never closes."',
  },
  'life_crystal': {
    name:'❤️ Life Mana Stone', type:'artifact', rarity:'epic',
    bonus:{ maxHp:50 }, desc:'+50 Max HP permanently',
    lore:'"Pulled from the heart of a S-Rank Gate. Still pulses like a heartbeat."',
  },
  'shadow_cloak': {
    name:'🌑 Shadow Cloak', type:'artifact', rarity:'epic',
    bonus:{ speed:15, def:8 }, desc:'+15 SPD +8 DEF permanently',
    lore:'"Woven from the shadows of the Sunless City. Wraps around you like instinct."',
  },
  'crown_of_dominion': {
    name:'👑 Crown of Dominion', type:'artifact', rarity:'legendary',
    bonus:{ atk:20, def:15, speed:15 }, desc:'+20 ATK +15 DEF +15 SPD permanently',
    lore:'"The crown of the last Shadow King. It does not sit on your head — it chooses you."',
  },
  'soul_prism': {
    name:'🔮 Soul Prism', type:'artifact', rarity:'legendary', limited:true,
    bonus:{ atk:25, maxHp:80 }, desc:'+25 ATK +80 HP permanently',
    lore:'"Contains seventeen trapped souls who willingly gave themselves to strengthen the bearer."',
  },
  'void_heart': {
    name:'🖤 Void Heart', type:'artifact', rarity:'legendary', limited:true,
    bonus:{ def:25, speed:20 }, desc:'+25 DEF +20 SPD permanently',
    lore:'"It does not beat. It throbs with the rhythm of the void itself."',
  },

  // ── Constellations (ORV) ─────────────────────────────────────
  // Legendary Constellations
  'secretive_plotter':       { name:'🌌 Secretive Plotter',              type:'constellation', rarity:'legendary', conId:'secretive_plotter' },
  'demon_king_of_salvation': { name:'😈 Demon King of Salvation',        type:'constellation', rarity:'legendary', conId:'demon_king_of_salvation' },
  'abyssal_black_flame_dragon':{ name:'🐉 Abyssal Black Flame Dragon',   type:'constellation', rarity:'legendary', conId:'abyssal_black_flame_dragon' },
  'king_of_the_outside':     { name:'👑 King of the Outside',            type:'constellation', rarity:'legendary', conId:'king_of_the_outside' },
  'oldest_dream':            { name:'✨ Oldest Dream',                   type:'constellation', rarity:'legendary', conId:'oldest_dream' },
  // Limited Constellations
  'father_of_myths':         { name:'⚡ Father of Myths, Odin',          type:'constellation', rarity:'legendary', conId:'father_of_myths', limited:true },
  'demon_sacrificer':        { name:'🩸 Demon Sacrificer',               type:'constellation', rarity:'legendary', conId:'demon_sacrificer', limited:true },
  // Epic Constellations
  'prisoner_of_golden_headband': { name:'🐒 Prisoner of the Golden Headband', type:'constellation', rarity:'epic', conId:'prisoner_of_golden_headband' },
  'demon_chief_poisonous_flame':  { name:'🔥 Demon Chief of the Poisonous Flame', type:'constellation', rarity:'epic', conId:'demon_chief_poisonous_flame' },
  'outer_god_kim_namwoon':   { name:'💪 Outer God, Kim Namwoon',         type:'constellation', rarity:'epic', conId:'outer_god_kim_namwoon' },
  'blade_master_dokja':      { name:'🗡️ Blade Master, Han Sooyoung',    type:'constellation', rarity:'epic', conId:'blade_master_dokja' },
  'sea_of_abyss':            { name:'🌊 Sea of the Abyss',               type:'constellation', rarity:'epic', conId:'sea_of_abyss' },
  // Rare Constellations
  'young_pale_rider':        { name:'🏇 Young Pale Rider',               type:'constellation', rarity:'rare', conId:'young_pale_rider' },
  'storm_thunderer':         { name:'⚡ Storm Thunderer',                 type:'constellation', rarity:'rare', conId:'storm_thunderer' },
  'ancient_castle_builder':  { name:'🏰 Ancient Castle Builder',          type:'constellation', rarity:'rare', conId:'ancient_castle_builder' },
  'sky_shepherd':            { name:'☁️ Sky Shepherd',                   type:'constellation', rarity:'rare', conId:'sky_shepherd' },

  // ── Pet Eggs ──────────────────────────────────────────────────
  'fire_egg': {
    name:'🥚 Ember Egg', type:'egg', rarity:'rare', petType:'fire',
    lore:'"Warm to the touch. Don\'t hold it too long."',
  },
  'storm_egg': {
    name:'🥚 Storm Egg', type:'egg', rarity:'rare', petType:'storm',
    lore:'"Crackles with static electricity. Thunder rumbles inside."',
  },
  'shadow_egg': {
    name:'🥚 Shadow Egg', type:'egg', rarity:'epic', petType:'shadow',
    lore:'"Casts no shadow itself. What\'s inside does not want to be found."',
  },
  'dragon_egg': {
    name:'🥚 Dragon Egg', type:'egg', rarity:'legendary', petType:'dragon',
    lore:'"Last seen in the deepest Gate. The heartbeat inside shakes the ground."',
  },
  'void_egg': {
    name:'🖤 Void Dragon Egg', type:'egg', rarity:'legendary', petType:'void_dragon', limited:true,
    lore:'"It doesn\'t reflect light. It absorbs it. Handle with extreme caution."',
  },
};

// ─────────────────────────────────────────────────────────────
// BANNER DEFINITIONS
// ─────────────────────────────────────────────────────────────
const BANNERS = {
  standard: {
    id:'standard', name:'⭐ Standard Summon', emoji:'⭐',
    desc:'Always open. Contains all standard weapons, artifacts, and pet eggs.',
    costCrystals:200, cost10Crystals:1800,
    pool:[
      {id:'blade_of_dawn',weight:16},{id:'arcane_staff',weight:16},{id:'phantom_arrow',weight:14},
      {id:'frostbite_dagger',weight:12},{id:'ember_blade',weight:14},
      {id:'shadow_fang',weight:9},{id:'tidal_scepter',weight:7},{id:'hellfire_gs',weight:6},{id:'stormcaller',weight:5},{id:'void_saber',weight:5},
      {id:'thunder_edge',weight:1.5},{id:'void_destroyer',weight:1},
      {id:'ring_of_valor',weight:12},{id:'necklace_of_thorns',weight:12},{id:'swift_boots',weight:10},{id:'crimson_band',weight:10},
      {id:'gauntlet_of_giants',weight:7},{id:'eye_of_abyss',weight:5},{id:'life_crystal',weight:5},{id:'shadow_cloak',weight:5},
      {id:'crown_of_dominion',weight:0.8},
      {id:'fire_egg',weight:8},{id:'storm_egg',weight:8},{id:'shadow_egg',weight:4},{id:'dragon_egg',weight:0.5},
      // Constellations
      {id:'young_pale_rider',weight:22},{id:'storm_thunderer',weight:20},{id:'ancient_castle_builder',weight:20},{id:'sky_shepherd',weight:18},
      {id:'prisoner_of_golden_headband',weight:5},{id:'demon_chief_poisonous_flame',weight:4},{id:'outer_god_kim_namwoon',weight:4},{id:'blade_master_dokja',weight:3},{id:'sea_of_abyss',weight:3},
      {id:'secretive_plotter',weight:0.5},{id:'demon_king_of_salvation',weight:0.5},{id:'abyssal_black_flame_dragon',weight:0.5},{id:'king_of_the_outside',weight:0.5},{id:'oldest_dream',weight:0.3},
    ],
    softPityAt:50, hardPityAt:100,
  },
  weapon: {
    id:'weapon', name:'⚔️ Weapon Summon', emoji:'⚔️',
    desc:'Weapons only. Higher legendary rate and faster pity. Best for upgrading your loadout.',
    costCrystals:180, cost10Crystals:1600,
    pool:[
      {id:'blade_of_dawn',weight:20},{id:'arcane_staff',weight:20},{id:'phantom_arrow',weight:18},
      {id:'frostbite_dagger',weight:16},{id:'ember_blade',weight:18},
      {id:'shadow_fang',weight:13},{id:'tidal_scepter',weight:11},{id:'hellfire_gs',weight:10},{id:'stormcaller',weight:9},{id:'void_saber',weight:9},
      {id:'thunder_edge',weight:3},{id:'void_destroyer',weight:2},
    ],
    softPityAt:40, hardPityAt:80,
  },
  limited: {
    id:'limited', name:'🌟 LIMITED SUMMON', emoji:'🌟',
    desc:'Rate-up event banner. Features an exclusive limited legendary. 50/50 mechanic applies.',
    costCrystals:200, cost10Crystals:1800,
    pool:[
      {id:'blade_of_dawn',weight:14},{id:'arcane_staff',weight:14},{id:'phantom_arrow',weight:12},
      {id:'frostbite_dagger',weight:10},{id:'ember_blade',weight:12},
      {id:'shadow_fang',weight:8},{id:'tidal_scepter',weight:6},{id:'hellfire_gs',weight:6},{id:'stormcaller',weight:5},{id:'void_saber',weight:5},
      {id:'thunder_edge',weight:1},{id:'void_destroyer',weight:0.8},
      {id:'ring_of_valor',weight:10},{id:'necklace_of_thorns',weight:10},{id:'swift_boots',weight:8},{id:'crimson_band',weight:8},
      {id:'gauntlet_of_giants',weight:6},{id:'eye_of_abyss',weight:5},{id:'life_crystal',weight:4},{id:'shadow_cloak',weight:4},
      {id:'crown_of_dominion',weight:0.6},
      {id:'fire_egg',weight:5},{id:'storm_egg',weight:5},{id:'shadow_egg',weight:3},
      // Rate-up limited items
      {id:'divine_judgment',weight:10},{id:'eclipse_blade',weight:8},{id:'abyssal_scythe',weight:8},
      {id:'soul_prism',weight:6},{id:'void_heart',weight:5},{id:'void_egg',weight:2},
      // Limited constellations (rate-up)
      {id:'father_of_myths',weight:10},{id:'demon_sacrificer',weight:8},
      // Standard constellations in limited pool
      {id:'young_pale_rider',weight:8},{id:'storm_thunderer',weight:7},{id:'ancient_castle_builder',weight:7},{id:'sky_shepherd',weight:6},
      {id:'prisoner_of_golden_headband',weight:4},{id:'outer_god_kim_namwoon',weight:3},
      {id:'secretive_plotter',weight:0.5},{id:'demon_king_of_salvation',weight:0.5},
    ],
    softPityAt:50, hardPityAt:90,
    rateUpIds:['divine_judgment','eclipse_blade','abyssal_scythe','soul_prism','void_heart','void_egg','father_of_myths','demon_sacrificer'],
  },
};

// ─────────────────────────────────────────────────────────────
// POOL BUILDER
// ─────────────────────────────────────────────────────────────
function buildPool(bannerId) {
  const banner = BANNERS[bannerId];
  if (!banner) return [];
  const pool = [];
  for (const entry of banner.pool) {
    const item = ITEM_REGISTRY[entry.id];
    if (!item) continue;
    for (let i = 0; i < Math.round(entry.weight * 10); i++) pool.push({ ...item, id:entry.id });
  }
  return pool;
}
const BUILT_POOLS = {};
for (const bid of Object.keys(BANNERS)) BUILT_POOLS[bid] = buildPool(bid);

// ─────────────────────────────────────────────────────────────
// PULL LOGIC — Pity resets ONLY on legendary
// ─────────────────────────────────────────────────────────────
function doPull(bannerId, playerBannerState, forceRateUp=false) {
  const banner = BANNERS[bannerId];
  const pool   = BUILT_POOLS[bannerId];
  if (!pool?.length) return null;

  const pity = playerBannerState.pity || 0;
  let item;

  if (pity >= banner.hardPityAt - 1) {
    const legs = pool.filter(x => x.rarity==='legendary');
    item = legs[Math.floor(Math.random()*legs.length)];
  } else if (pity >= banner.softPityAt) {
    const highPool = pool.filter(x => x.rarity==='epic'||x.rarity==='legendary');
    if (Math.random()<0.5) item = highPool[Math.floor(Math.random()*highPool.length)];
  }
  if (!item) item = pool[Math.floor(Math.random()*pool.length)];

  // 50/50 mechanic for limited banner
  if (bannerId==='limited' && item.rarity==='legendary') {
    const isRateUp = banner.rateUpIds?.includes(item.id);
    if (!isRateUp) {
      if (playerBannerState.guaranteedRateUp || forceRateUp) {
        const ruPool = pool.filter(x => banner.rateUpIds?.includes(x.id) && x.rarity==='legendary');
        if (ruPool.length) item = ruPool[Math.floor(Math.random()*ruPool.length)];
        playerBannerState.guaranteedRateUp = false;
      } else {
        playerBannerState.guaranteedRateUp = true;
      }
    } else {
      playerBannerState.guaranteedRateUp = false;
    }
  }

  playerBannerState.pity = (pity+1);
  if (item.rarity==='legendary') playerBannerState.pity = 0;
  return item;
}

// ─────────────────────────────────────────────────────────────
// DUPLICATE HANDLING — Refinement & Constellation
// ─────────────────────────────────────────────────────────────
function applyDuplicate(player, item) {
  if (item.type==='weapon') {
    if (!player.summonWeapons) player.summonWeapons={};
    const existing = player.summonWeapons[item.id];
    if (!existing) {
      player.summonWeapons[item.id] = { ...item, refinement:1 };
      const curBonus = player.weapon?.bonus||0;
      const newBonus = item.bonus?.atk||0;
      if (newBonus > curBonus) {
        player.weapon = { name:item.name, bonus:newBonus, id:item.id, refinement:1, element:item.element, passive:item.passive };
        return { action:'equipped', msg:`⬆️ *EQUIPPED!* (R1)${item.passive ? `\n   ⚡ Passive: *${item.passive.name}* — ${item.passive.desc}` : ''}` };
      }
      return { action:'stored', msg:`📦 Stored in collection (R1)${item.passive ? `\n   ⚡ Passive: *${item.passive.name}*` : ''}` };
    } else {
      if (existing.refinement>=5) {
        const sellVal={rare:5000,epic:20000,legendary:100000}[item.rarity]||1000;
        player.gold=(player.gold||0)+sellVal;
        return { action:'sold', msg:`💰 Max refinement (R5)! Sold for *${sellVal.toLocaleString()}g*` };
      }
      existing.refinement++;
      const atkBonus=5*(item.rarity==='legendary'?3:item.rarity==='epic'?2:1);
      if (player.weapon?.id===item.id) { player.weapon.bonus=(player.weapon.bonus||0)+atkBonus; player.weapon.refinement=existing.refinement; }
      return { action:'refined', msg:`🔨 *REFINED* to R${existing.refinement}! (+${atkBonus} ATK)` };
    }
  }

  if (item.type==='artifact') {
    if (!Array.isArray(player.summonArtifacts)) player.summonArtifacts=[];
    const existing = player.summonArtifacts.find(a=>a.id===item.id);
    if (!existing) {
      if (item.bonus) {
        for (const [stat,val] of Object.entries(item.bonus)) {
          if (stat==='maxHp'){player.stats.maxHp+=val;player.stats.hp=Math.min(player.stats.maxHp,player.stats.hp+val);}
          else if (player.stats[stat]!==undefined) player.stats[stat]=(player.stats[stat]||0)+val;
        }
      }
      player.summonArtifacts.push({...item, constellation:1});
      return { action:'acquired', msg:`✨ *ACQUIRED!* ${item.desc} (C1)\n   📖 _${item.lore}_` };
    } else {
      if (existing.constellation>=6) {
        const sellVal={rare:3000,epic:12000,legendary:60000}[item.rarity]||500;
        player.gold=(player.gold||0)+sellVal;
        return { action:'sold', msg:`💰 Max constellation (C6)! Sold for *${sellVal.toLocaleString()}g*` };
      }
      existing.constellation++;
      const boost={atk:2,def:2,speed:2,maxHp:10};
      for (const [stat] of Object.entries(item.bonus||{})) {
        const extra=boost[stat]||1;
        if (stat==='maxHp') player.stats.maxHp+=extra;
        else if (player.stats[stat]!==undefined) player.stats[stat]=(player.stats[stat]||0)+extra;
      }
      return { action:'constellation', msg:`🌟 *CONSTELLATION C${existing.constellation}!* Power increased.` };
    }
  }

  if (item.type==='egg') {
    if (!player.inventory) player.inventory={};
    if (!Array.isArray(player.inventory.items)) player.inventory.items=[];
    player.inventory.items.push({name:item.name,type:'pet_egg',rarity:item.rarity,petType:item.petType,lore:item.lore});
    return { action:'egg', msg:`🥚 *Added to inventory!*\n   📖 _${item.lore||''}_\n   Use /catch to hatch!` };
  }

  return { action:'unknown', msg:'' };
}

// ─────────────────────────────────────────────────────────────
// WEAPON PASSIVE TRIGGER — called from PvP combat
// ─────────────────────────────────────────────────────────────
function triggerWeaponPassive(weapon, attackerHp, defenderHp, defenderMaxHp, turnCount, hitCount) {
  if (!weapon?.passive) return { triggered:false, extraDmg:0, msg:'' };
  const p = weapon.passive;
  const el = ELEMENT_EMOJI[weapon.element||'none'];

  switch(p.trigger) {
    case 'first_hit':
      if (hitCount===1) return { triggered:true, extraDmg:p.value, msg:`${el}⚡ *${p.name}!* First strike bonus: +${Math.round(p.value*100)}% damage!` };
      break;
    case 'double_strike':
      if (Math.random()<p.value) return { triggered:true, extraDmg:0.5, secondHit:true, msg:`${el}🗡️ *${p.name}!* Struck twice!` };
      break;
    case 'crit_fire':
      // Handled externally — returns flag
      return { triggered:true, extraDmg:p.value, conditional:'on_crit', msg:`${el}🔥 *${p.name}!* Critical ignition!` };
    case 'divine_strike':
      if (Math.random()<0.30) return { triggered:true, extraDmg:p.value, stun:true, msg:`${el}⚡ *${p.name}!* ⚡ Divine thunder descends! Enemy stunned!` };
      break;
    case 'battle_ramp':
      if (turnCount>=3) return { triggered:true, atkBuff:p.value, msg:`${el}🌌 *${p.name}!* Void power awakens — ATK +${Math.round(p.value*100)}% permanently!` };
      break;
    case 'def_shred':
      return { triggered:true, defShred:p.value, msg:`${el}🖤 *${p.name}!* DEF shredded by ${p.value}!` };
    case 'damage_reduce':
      if (attackerHp > attackerHp*0.5) return { triggered:true, damageReduce:p.value, msg:'' }; // silent
      break;
    case 'execute_high':
      if (defenderHp/defenderMaxHp > 0.60) return { triggered:true, extraDmg:p.value, msg:`${el}⚖️ *${p.name}!* The strong are judged! +${Math.round(p.value*100)}% damage!` };
      break;
    case 'every_third':
      if (hitCount%3===0) return { triggered:true, extraDmg:p.value-1, msg:`${el}🌑 *${p.name}!* Third strike — Eclipse erupts! Double damage!` };
      break;
    case 'reaper_toll':
      return { triggered:true, flatDmg:Math.floor(defenderMaxHp*p.value), msg:`${el}💀 *${p.name}!* The Reaper collects — ${Math.floor(defenderMaxHp*p.value)} unavoidable damage!` };
    case 'burn':
      if (Math.random()<0.6) return { triggered:true, burnDmg:p.value, msg:`${el}🔥 *${p.name}!* Burns applied!` };
      break;
    case 'chain_lightning':
      if (Math.random()<0.20) return { triggered:true, extraDmg:p.value, msg:`${el}⚡ *${p.name}!* Lightning arcs for +${Math.round(p.value*100)}% bonus!` };
      break;
  }
  return { triggered:false, extraDmg:0, msg:'' };
}

// ─────────────────────────────────────────────────────────────
// RATES CALCULATOR
// ─────────────────────────────────────────────────────────────
function getBannerRates(bannerId) {
  const pool = BUILT_POOLS[bannerId];
  if (!pool) return {};
  const total = pool.length;
  const r = {};
  for (const x of pool) r[x.rarity]=(r[x.rarity]||0)+1;
  return Object.fromEntries(Object.entries(r).map(([k,v])=>[k,(v/total*100).toFixed(0)+'%']));
}

function recordPull(player, bannerId, item) {
  if (!player.summonHistory) player.summonHistory=[];
  player.summonHistory.unshift({ bannerId, itemId:item.id, itemName:item.name, rarity:item.rarity, element:item.element||'none', timestamp:Date.now() });
  if (player.summonHistory.length>50) player.summonHistory=player.summonHistory.slice(0,50);
}

module.exports = {
  BANNERS, ITEM_REGISTRY, BUILT_POOLS,
  doPull, applyDuplicate, recordPull, getBannerRates, triggerWeaponPassive,
  RARITY_EMOJI, ELEMENT_EMOJI,
};
