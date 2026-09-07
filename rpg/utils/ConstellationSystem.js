// ═══════════════════════════════════════════════════════════════
// CONSTELLATION SYSTEM — ORV themed gacha characters
// Players are Incarnations. Constellations sponsor them.
// Pulling a constellation = gaining their sponsorship.
// Duplicates raise Favorability (1→10) = stronger bonuses.
// ═══════════════════════════════════════════════════════════════

// ── Domain types ──────────────────────────────────────────────
const DOMAINS = {
  story:    { emoji: '📖', name: 'Story' },
  abyss:    { emoji: '🌑', name: 'Abyss' },
  demon:    { emoji: '👹', name: 'Demon' },
  dragon:   { emoji: '🐉', name: 'Dragon' },
  war:      { emoji: '⚔️', name: 'War' },
  death:    { emoji: '💀', name: 'Death' },
  flame:    { emoji: '🔥', name: 'Flame' },
  thunder:  { emoji: '⚡', name: 'Thunder' },
  sea:      { emoji: '🌊', name: 'Sea' },
  sky:      { emoji: '☁️', name: 'Sky' },
  beast:    { emoji: '🐺', name: 'Beast' },
  dream:    { emoji: '✨', name: 'Dream' },
};

// ── Constellation Registry ────────────────────────────────────
const CONSTELLATIONS = {

  // ════════════════ LEGENDARY (SSR) ════════════════

  'secretive_plotter': {
    id: 'secretive_plotter',
    name: '🌌 Secretive Plotter',
    rarity: 'legendary',
    domain: 'story',
    tier: 'Absolute',
    lore: '"He alone knows how the story ends. And he has reread it 1863 times."',
    sponsorSkill: {
      name: 'Omniscient Reading',
      desc: 'Before each PvP turn, 20% chance to read the opponent\'s action — counter it automatically.',
    },
    baseBonus: { atk: 30, speed: 20 },
    favorabilityBonus: { atk: 5, speed: 3 }, // per favorability level
    limited: false,
  },

  'demon_king_of_salvation': {
    id: 'demon_king_of_salvation',
    name: '😈 Demon King of Salvation',
    rarity: 'legendary',
    domain: 'demon',
    tier: 'Absolute',
    lore: '"The demon that saved the world. A contradiction no one dared question."',
    sponsorSkill: {
      name: 'Demon King\'s Proclamation',
      desc: 'When HP falls below 25%, release a burst dealing 200% ATK as dark damage. Resets once per battle.',
    },
    baseBonus: { atk: 40, def: 15 },
    favorabilityBonus: { atk: 6, def: 2 },
    limited: false,
  },

  'abyssal_black_flame_dragon': {
    id: 'abyssal_black_flame_dragon',
    name: '🐉 Abyssal Black Flame Dragon',
    rarity: 'legendary',
    domain: 'dragon',
    tier: 'Absolute',
    lore: '"The dragon that refused to be tamed. Not by gods. Not by kings. Not by the story itself."',
    sponsorSkill: {
      name: 'Black Flame Breath',
      desc: 'Skills deal +35% extra damage. Every 3rd skill use triggers Black Flame — deals 150% ATK as true damage.',
    },
    baseBonus: { atk: 45, maxHp: 60 },
    favorabilityBonus: { atk: 7, maxHp: 10 },
    limited: false,
  },

  'king_of_the_outside': {
    id: 'king_of_the_outside',
    name: '👑 King of the Outside',
    rarity: 'legendary',
    domain: 'abyss',
    tier: 'Absolute',
    lore: '"He exists outside the story. The narrative cannot bind what it cannot see."',
    sponsorSkill: {
      name: 'Outer Realm Authority',
      desc: 'Ignore 30% of enemy DEF. If enemy uses Guard, deal 50% bonus damage instead of reduced.',
    },
    baseBonus: { atk: 35, def: 25 },
    favorabilityBonus: { atk: 5, def: 4 },
    limited: false,
  },

  'oldest_dream': {
    id: 'oldest_dream',
    name: '✨ Oldest Dream',
    rarity: 'legendary',
    domain: 'dream',
    tier: 'Myth',
    lore: '"Older than constellations. Older than the story. The dream that dreamed everything else."',
    sponsorSkill: {
      name: 'Dream Weave',
      desc: 'At the start of battle, all your stats increase by 15% for the first 5 turns.',
    },
    baseBonus: { atk: 25, def: 25, speed: 15 },
    favorabilityBonus: { atk: 3, def: 3, speed: 2 },
    limited: false,
  },

  // ════════════════ LIMITED LEGENDARY ════════════════

  'father_of_myths': {
    id: 'father_of_myths',
    name: '⚡ Father of Myths, Odin',
    rarity: 'legendary',
    domain: 'war',
    tier: 'Absolute',
    lore: '"He sacrificed an eye for wisdom, a son for war, and his silence for prophecy."',
    sponsorSkill: {
      name: 'Allfather\'s Blessing',
      desc: 'PvP wins grant stacking +5 ATK (max +50). Resets each season.',
    },
    baseBonus: { atk: 38, speed: 22 },
    favorabilityBonus: { atk: 6, speed: 3 },
    limited: true,
  },

  'demon_sacrificer': {
    id: 'demon_sacrificer',
    name: '🩸 Demon Sacrificer',
    rarity: 'legendary',
    domain: 'death',
    tier: 'Absolute',
    lore: '"Every kill is an offering. Every battle, a ritual. The demon who makes gods bleed."',
    sponsorSkill: {
      name: 'Blood Sacrifice',
      desc: 'On killing blow (PvP or dungeon boss), restore 40% HP and gain +20% ATK for the next 3 turns.',
    },
    baseBonus: { atk: 42, maxHp: 80 },
    favorabilityBonus: { atk: 6, maxHp: 12 },
    limited: true,
  },

  // ════════════════ EPIC (SR) ════════════════

  'prisoner_of_golden_headband': {
    id: 'prisoner_of_golden_headband',
    name: '🐒 Prisoner of the Nexusen Headband',
    rarity: 'epic',
    domain: 'war',
    tier: 'Highest',
    lore: '"The staff that split mountains. The king that refused to kneel. Even in chains, terrifying."',
    sponsorSkill: {
      name: 'Ruyi Jingu Bang',
      desc: 'First attack each battle deals 180% damage. If the enemy is guarding, shatter it and deal 220% instead.',
    },
    baseBonus: { atk: 28, speed: 15 },
    favorabilityBonus: { atk: 4, speed: 2 },
    limited: false,
  },

  'demon_chief_poisonous_flame': {
    id: 'demon_chief_poisonous_flame',
    name: '🔥 Demon Chief of the Poisonous Flame',
    rarity: 'epic',
    domain: 'flame',
    tier: 'Highest',
    lore: '"The flame that poisons what it burns. No antidote. No cure. No hope."',
    sponsorSkill: {
      name: 'Poison Flame Aura',
      desc: 'Your attacks have 25% chance to apply Poison Flame — enemy loses 8% max HP per turn for 3 turns.',
    },
    baseBonus: { atk: 22, speed: 18 },
    favorabilityBonus: { atk: 3, speed: 3 },
    limited: false,
  },

  'outer_god_kim_namwoon': {
    id: 'outer_god_kim_namwoon',
    name: '💪 Outer God, Kim Namwoon',
    rarity: 'epic',
    domain: 'beast',
    tier: 'Highest',
    lore: '"Once a thug. Now something far more dangerous — a thug with the power of a god."',
    sponsorSkill: {
      name: 'Berserk Authority',
      desc: 'When you take a critical hit, immediately counter for 100% ATK. Trigger max once per turn.',
    },
    baseBonus: { atk: 25, def: 18 },
    favorabilityBonus: { atk: 4, def: 3 },
    limited: false,
  },

  'blade_master_dokja': {
    id: 'blade_master_dokja',
    name: '🗡️ Blade Master, Han Sooyoung',
    rarity: 'epic',
    domain: 'story',
    tier: 'Highest',
    lore: '"She rewrites stories until they fit. Then she rewrites the people too."',
    sponsorSkill: {
      name: 'Rewrite',
      desc: 'Once per battle, negate one attack completely. Activation message: "That\'s not how this story goes."',
    },
    baseBonus: { def: 20, speed: 20 },
    favorabilityBonus: { def: 3, speed: 3 },
    limited: false,
  },

  'sea_of_abyss': {
    id: 'sea_of_abyss',
    name: '🌊 Sea of the Abyss',
    rarity: 'epic',
    domain: 'sea',
    tier: 'Highest',
    lore: '"The ocean that swallowed civilizations. It is not malicious. It simply does not notice you."',
    sponsorSkill: {
      name: 'Abyssal Current',
      desc: '+20 SPD permanently. In PvP, if you are faster, deal +15% bonus damage on every attack.',
    },
    baseBonus: { speed: 30, maxHp: 50 },
    favorabilityBonus: { speed: 4, maxHp: 8 },
    limited: false,
  },

  // ════════════════ RARE (R) ════════════════

  'young_pale_rider': {
    id: 'young_pale_rider',
    name: '🏇 Young Pale Rider',
    rarity: 'rare',
    domain: 'death',
    tier: 'Advanced',
    lore: '"Death rides early for some. He just decided to gallop."',
    sponsorSkill: {
      name: 'Pale Rider\'s Omen',
      desc: '+10% critical hit chance. Critical hits deal +10% extra damage.',
    },
    baseBonus: { atk: 12, speed: 10 },
    favorabilityBonus: { atk: 2, speed: 1 },
    limited: false,
  },

  'storm_thunderer': {
    id: 'storm_thunderer',
    name: '⚡ Storm Thunderer',
    rarity: 'rare',
    domain: 'thunder',
    tier: 'Advanced',
    lore: '"The one who called the lightning before there was a name for it."',
    sponsorSkill: {
      name: 'Thunder Charge',
      desc: '+12 SPD. Your skills have a 15% chance to chain-strike for 50% additional damage.',
    },
    baseBonus: { atk: 10, speed: 14 },
    favorabilityBonus: { atk: 1, speed: 2 },
    limited: false,
  },

  'ancient_castle_builder': {
    id: 'ancient_castle_builder',
    name: '🏰 Ancient Castle Builder',
    rarity: 'rare',
    domain: 'war',
    tier: 'Advanced',
    lore: '"He built walls that held for a thousand years. Then tore them down himself."',
    sponsorSkill: {
      name: 'Iron Fortress',
      desc: '+15 DEF. Reduce all incoming damage by 5%.',
    },
    baseBonus: { def: 18, maxHp: 40 },
    favorabilityBonus: { def: 2, maxHp: 6 },
    limited: false,
  },

  'sky_shepherd': {
    id: 'sky_shepherd',
    name: '☁️ Sky Shepherd',
    rarity: 'rare',
    domain: 'sky',
    tier: 'Advanced',
    lore: '"He herded clouds. Then stars. Then something even larger."',
    sponsorSkill: {
      name: 'Heavenly Blessing',
      desc: 'Heal 5% max HP at the start of each PvP turn (max 3 turns per battle).',
    },
    baseBonus: { maxHp: 60, def: 10 },
    favorabilityBonus: { maxHp: 8, def: 1 },
    limited: false,
  },
};

// ── Get total bonus from all sponsored constellations ─────────
function getSponsorBonus(player) {
  const sponsored = player.constellations || {};
  const total = { atk:0, def:0, speed:0, maxHp:0 };
  for (const [id, data] of Object.entries(sponsored)) {
    const con = CONSTELLATIONS[id];
    if (!con) continue;
    const fav = data.favorability || 1;
    // Base bonus
    for (const [stat, val] of Object.entries(con.baseBonus)) {
      total[stat] = (total[stat]||0) + val;
    }
    // Favorability bonus (fav-1 extra levels, since fav 1 = base only)
    if (fav > 1 && con.favorabilityBonus) {
      for (const [stat, val] of Object.entries(con.favorabilityBonus)) {
        total[stat] = (total[stat]||0) + (val * (fav - 1));
      }
    }
  }
  return total;
}

// ── Get active sponsor skills for combat ──────────────────────
function getSponsorSkills(player) {
  const sponsored = player.constellations || {};
  const skills = [];
  for (const [id, data] of Object.entries(sponsored)) {
    const con = CONSTELLATIONS[id];
    if (!con?.sponsorSkill) continue;
    skills.push({
      conId: id,
      conName: con.name,
      fav: data.favorability || 1,
      ...con.sponsorSkill,
    });
  }
  return skills;
}

// ── Give constellation to player (handle favorability) ────────
function giveConstellation(player, conId) {
  const con = CONSTELLATIONS[conId];
  if (!con) return { action: 'unknown', msg: '❌ Unknown constellation' };
  if (!player.constellations) player.constellations = {};

  if (!player.constellations[conId]) {
    // First pull — sponsored! Apply base bonus
    player.constellations[conId] = { favorability: 1, pulledAt: Date.now() };
    for (const [stat, val] of Object.entries(con.baseBonus)) {
      if (stat === 'maxHp') { player.stats.maxHp=(player.stats.maxHp||100)+val; player.stats.hp=Math.min(player.stats.maxHp,player.stats.hp+val); }
      else if (player.stats[stat]!==undefined) player.stats[stat]=(player.stats[stat]||0)+val;
    }
    return {
      action: 'new',
      msg: `🌟 *NEW SPONSORSHIP!*\n${con.name} has chosen you as their Incarnation!\n\n⚡ *Sponsor Skill:* ${con.sponsorSkill.name}\n   ${con.sponsorSkill.desc}\n\n💡 /constellation to see your sponsors`,
    };
  }

  // Duplicate — raise favorability
  const data = player.constellations[conId];
  if (data.favorability >= 10) {
    const sellVal = { rare:8000, epic:35000, legendary:180000 }[con.rarity] || 5000;
    player.gold = (player.gold||0) + sellVal;
    return {
      action: 'maxed',
      msg: `💠 *${con.name}* is at max favorability (Fav.10)!\nConverted to *${sellVal.toLocaleString()} Coins*`,
    };
  }
  const oldFav = data.favorability;
  data.favorability++;
  // Apply favorability bonus
  if (con.favorabilityBonus) {
    for (const [stat, val] of Object.entries(con.favorabilityBonus)) {
      if (stat === 'maxHp') { player.stats.maxHp=(player.stats.maxHp||100)+val; player.stats.hp=Math.min(player.stats.maxHp,player.stats.hp+val); }
      else if (player.stats[stat]!==undefined) player.stats[stat]=(player.stats[stat]||0)+val;
    }
  }
  return {
    action: 'favorability',
    msg: `💛 *FAVORABILITY INCREASED!*\n${con.name}\nFav.${oldFav} → Fav.${data.favorability}\n\nYour sponsorship grows stronger!`,
  };
}

// ── Fav bar display ───────────────────────────────────────────
function favBar(fav) {
  return '⭐'.repeat(fav) + '☆'.repeat(10-fav) + ` Fav.${fav}/10`;
}

// ── Rarity emoji ──────────────────────────────────────────────
const RARITY_EMOJI = { rare:'🔵', epic:'🟣', legendary:'🟡' };

module.exports = {
  CONSTELLATIONS, DOMAINS, RARITY_EMOJI,
  getSponsorBonus, getSponsorSkills, giveConstellation, favBar,
};
