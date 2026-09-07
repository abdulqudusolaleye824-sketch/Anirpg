// ═══════════════════════════════════════════════════════════════
// MONSTER DROP TABLE — Astra
// Monster kill → 35% chance, 1 random drop from pool of 4
// Boss kill    → Primary guaranteed + Secondary 35% chance
// ═══════════════════════════════════════════════════════════════

const MONSTER_DROPS = {

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // F-RANK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  F: {
    monsters: [
      { name: 'Goblin',            drops: ['Goblin Fang', 'Goblin Ear', 'Torn Cloth', 'Goblin Nail'] },
      { name: 'Goblin Scout',      drops: ['Goblin Ear', 'Crude Leather Strip', 'Goblin Fang', 'Frayed String'] },
      { name: 'Goblin Shaman',     drops: ['Torn Hex Cloth', 'Shaman Bone Chip', 'Goblin Ear', 'Hex Dust'] },
      { name: 'Skeleton',          drops: ['Bone Fragment', 'Skull Shard', 'Marrow Dust', 'Brittle Rib'] },
      { name: 'Skeleton Archer',   drops: ['Brittle Arrow', 'Bone Fragment', 'Skull Shard', 'Dry Sinew'] },
      { name: 'Hollow Skull',      drops: ['Skull Shard', 'Marrow Dust', 'Bone Fragment', 'Hollow Eye Socket'] },
      { name: 'Giant Rat',         drops: ['Rat Pelt', 'Rat Tail', 'Rodent Fang', 'Rat Whisker'] },
      { name: 'Sewer Rat',         drops: ['Rat Tail', 'Infected Fang', 'Rat Pelt', 'Sewer Slime'] },
      { name: 'Plague Rat',        drops: ['Infected Fang', 'Plague Fur', 'Rat Tail', 'Diseased Gland'] },
      { name: 'Green Slime',       drops: ['Slime Gel', 'Slime Core', 'Toxic Residue', 'Slime Film'] },
      { name: 'Acid Slime',        drops: ['Toxic Residue', 'Acid Glob', 'Slime Gel', 'Corrosive Film'] },
      { name: 'Slime Blob',        drops: ['Slime Core', 'Slime Gel', 'Dense Slime Chunk', 'Slime Film'] },
      { name: 'Cave Bat',          drops: ['Bat Wing', 'Bat Claw', 'Bat Fang', 'Guano Clump'] },
      { name: 'Mud Crawler',       drops: ['Hardened Mud', 'Crawler Claw', 'Mud Shell', 'Earthen Residue'] },
      { name: 'Dungeon Spider',    drops: ['Spider Silk', 'Spider Fang', 'Venom Droplet', 'Spider Eye'] },
      { name: 'Rotting Zombie',    drops: ['Decayed Flesh', 'Zombie Nail', 'Rotted Bone', 'Putrid Rag'] },
      { name: 'Imp',               drops: ['Imp Claw', 'Imp Horn Nub', 'Imp Tail', 'Scorch Mark'] },
      { name: 'Giant Worm',        drops: ['Worm Segment', 'Worm Slime', 'Tough Worm Hide', 'Worm Fang'] },
      { name: 'Feral Boar',        drops: ['Boar Tusk', 'Boar Hide', 'Coarse Bristle', 'Boar Hoof'] },
      { name: 'Cursed Scarecrow',  drops: ['Straw Core', 'Torn Burlap', 'Cursed Nail', 'Faded Hex Mark'] },
      // ── Elemental ────────────────────────────────────────────
      { name: 'Ember Sprite',      drops: ['Ember Core', 'Scorch Dust', 'Flame Shard', 'Ash Residue'] },
      { name: 'Puddle Slime',      drops: ['Water Core', 'Damp Residue', 'Slick Gel', 'Murky Droplet'] },
      { name: 'Spark Bug',         drops: ['Spark Core', 'Static Dust', 'Tiny Volt Sac', 'Buzzing Scale'] },
      { name: 'Dust Sprite',       drops: ['Wind Core', 'Gust Dust', 'Breeze Shard', 'Hollow Feather'] },
      { name: 'Mud Imp',           drops: ['Earth Core', 'Dirt Clump', 'Pebble Shard', 'Clay Chunk'] },
    ],
    bosses: [
      { name: 'Cave Troll King',     primary: 'Troll King Club Splinter',  secondary: 'Mossy Troll Hide' },
      { name: 'Giant Goblin Shaman', primary: 'Shaman Skull',              secondary: 'Hex Powder Pouch' },
    ]
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // E-RANK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  E: {
    monsters: [
      { name: 'Orc',               drops: ['Orc Tusk', 'Orc Hide', 'Brutish Bone', 'Orc Blood Vial'] },
      { name: 'Orc Warrior',       drops: ['Orc Hide', 'Orc Tusk', 'War Paint Residue', 'Crude Iron Chip'] },
      { name: 'Orc Berserker',     drops: ['Brutish Bone', 'Berserker Scar Tissue', 'Orc Tusk', 'Rage Gland'] },
      { name: 'Dire Wolf',         drops: ['Wolf Pelt', 'Wolf Fang', 'Beast Claw', 'Wolf Eye'] },
      { name: 'Frost Wolf',        drops: ['Frost Wolf Fang', 'Frozen Pelt', 'Ice Claw', 'Frost Gland'] },
      { name: 'Shadow Wolf',       drops: ['Dark Beast Claw', 'Shadow Pelt Scrap', 'Wolf Fang', 'Dark Eye'] },
      { name: 'Dark Elf',          drops: ['Elven Ear', 'Shadow Silk', 'Cursed Arrowhead', 'Dark Elf Blood'] },
      { name: 'Dark Elf Ranger',   drops: ['Cursed Arrowhead', 'Elven Ear', 'Poison Tip', 'Hunter Mark'] },
      { name: 'Dark Elf Witch',    drops: ['Shadow Silk', 'Witch Lock', 'Hex Vial', 'Cursed Bead'] },
      { name: 'Stone Golem',       drops: ['Stone Core', 'Granite Shard', 'Golem Dust', 'Rock Fist Chip'] },
      { name: 'Gravel Golem',      drops: ['Granite Shard', 'Golem Dust', 'Gravel Core', 'Pebble Cluster'] },
      { name: 'Iron Golem',        drops: ['Golem Plate', 'Iron Core Shard', 'Golem Dust', 'Rusted Bolt'] },
      { name: 'Hobgoblin',         drops: ['Hobgoblin Horn', 'Hobgoblin Hide', 'Crude Iron Spike', 'Hobgoblin Tooth'] },
      { name: 'Hobgoblin Chief',   drops: ['Crude Iron Spike', 'Chief Brand', 'Hobgoblin Horn', 'Warchief Rag'] },
      { name: 'Lizardman',         drops: ['Lizard Scale', 'Lizard Claw', 'Shed Skin', 'Lizard Tongue'] },
      { name: 'Swamp Troll',       drops: ['Troll Wart', 'Swamp Hide', 'Moss Clump', 'Troll Claw'] },
      { name: 'Forest Ghoul',      drops: ['Ghoul Nail', 'Ghoul Flesh', 'Rotted Cloth', 'Ghoul Eye'] },
      { name: 'Harpy',             drops: ['Harpy Feather', 'Harpy Talon', 'Harpy Wing Bone', 'Harpy Beak'] },
      { name: 'Dark Hound',        drops: ['Hound Fang', 'Dark Hound Pelt', 'Hound Claw', 'Shadow Saliva'] },
      { name: 'Venomous Cobra',    drops: ['Cobra Venom Sac', 'Cobra Scale', 'Cobra Fang', 'Shed Cobra Skin'] },
      // ── Elemental ────────────────────────────────────────────
      { name: 'Flame Goblin',      drops: ['Flame Goblin Core', 'Scorch Hide', 'Ember Fang', 'Fire Goblin Ash'] },
      { name: 'Frost Lizardman',   drops: ['Frost Scale', 'Ice Lizard Core', 'Frozen Claw', 'Frost Venom Sac'] },
      { name: 'Storm Harpy',       drops: ['Storm Harpy Core', 'Volt Feather', 'Thunder Beak', 'Spark Talon'] },
      { name: 'Gale Sprite',       drops: ['Gale Core', 'Wind Sprite Cloth', 'Breeze Fang', 'Storm Shard'] },
    ],
    bosses: [
      { name: 'Ancient Orc Chief',  primary: 'Chief War Axe Shard',   secondary: 'Ancient Orc Blood' },
      { name: 'Forest Basilisk',    primary: 'Basilisk Eye',          secondary: 'Basilisk Scale' },
      { name: 'Iron Golem Lord',    primary: 'Golem Lord Core',       secondary: 'Reinforced Iron Plate' },
    ]
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // D-RANK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  D: {
    monsters: [
      { name: 'Ice Bear',           drops: ['Ice Bear Pelt', 'Frozen Claw', 'Tundra Heart', 'Bear Fang'] },
      { name: 'Frost Grizzly',      drops: ['Frozen Claw', 'Frost Grizzly Pelt', 'Glacier Marrow', 'Ice Bear Pelt'] },
      { name: 'Tundra Yeti',        drops: ['Yeti Fur', 'Yeti Knuckle', 'Frost Breath Mana Stone', 'Yeti Tooth'] },
      { name: 'Shadow Panther',     drops: ['Shadow Pelt', 'Panther Claw', 'Dark Essence', 'Stealth Gland'] },
      { name: 'Night Stalker',      drops: ['Dark Essence', 'Stalker Claw', 'Night Pelt', 'Void Saliva'] },
      { name: 'Void Lynx',          drops: ['Void Claw', 'Void Pelt Scrap', 'Null Fang', 'Void Eye'] },
      { name: 'Earth Drake',        drops: ['Drake Scale', 'Drake Claw', 'Earth Core', 'Drake Fang'] },
      { name: 'Mud Drake',          drops: ['Drake Mucus', 'Mud Scale', 'Drake Claw', 'Mud Core'] },
      { name: 'Rock Drake',         drops: ['Drake Fang', 'Rock Scale', 'Stone Drake Core', 'Drake Claw'] },
      { name: 'Corrupted Knight',   drops: ['Corrupted Steel', 'Dark Soul Fragment', 'Knight Emblem', 'Tainted Plate'] },
      { name: 'Fallen Paladin',     drops: ['Dark Soul Fragment', 'Corrupted Steel', 'Fallen Crest', 'Tainted Holy Symbol'] },
      { name: 'Plague Knight',      drops: ['Knight Emblem', 'Plague Plate Shard', 'Infected Steel', 'Cursed Visor'] },
      { name: 'Blood Elf',          drops: ['Blood Mana Stone', 'Elven Blood', 'Cursed Sigil', 'Blood Silk'] },
      { name: 'Blood Elf Assassin', drops: ['Cursed Sigil', 'Blood Mana Stone', 'Assassin Brand', 'Poison Needle'] },
      { name: 'Dark Witch',         drops: ['Witch Lock', 'Hex Vial', 'Cursed Bead', 'Dark Ritual Ash'] },
      { name: 'Stone Titan',        drops: ['Titan Knuckle Shard', 'Titan Stone Core', 'Compressed Rock', 'Titan Tooth'] },
      { name: 'Magma Hound',        drops: ['Magma Fang', 'Scorched Pelt', 'Lava Saliva', 'Ember Claw'] },
      { name: 'Bone Colossus',      drops: ['Colossus Rib', 'Giant Skull Shard', 'Dense Bone Core', 'Colossus Knuckle'] },
      { name: 'Cursed Armor',       drops: ['Cursed Plate Fragment', 'Haunted Steel', 'Spectral Residue', 'Cursed Bolt'] },
      { name: 'Cave Serpent',       drops: ['Serpent Fang', 'Cave Serpent Scale', 'Serpent Venom Gland', 'Serpent Eye'] },
      // ── Elemental ────────────────────────────────────────────
      { name: 'Cinder Drake',      drops: ['Cinder Drake Core', 'Magma Scale', 'Ember Fang', 'Lava Hide'] },
      { name: 'Glacial Serpent',   drops: ['Glacial Core', 'Ice Serpent Scale', 'Frost Fang', 'Frozen Eye'] },
      { name: 'Volt Crawler',      drops: ['Volt Core', 'Shock Chitin', 'Static Claw', 'Spark Gland'] },
      { name: 'Tempest Bat',       drops: ['Tempest Core', 'Gale Wing', 'Storm Fang', 'Wind Bat Hide'] },
      { name: 'Mud Titan',         drops: ['Mud Titan Core', 'Dense Clay Shard', 'Earth Titan Hide', 'Rock Fist'] },
    ],
    bosses: [
      { name: 'Drake Lord',        primary: 'Drake Lord Crest',         secondary: 'Drake Lord Heart' },
      { name: 'Blood Moon Knight', primary: 'Blood Moon Blade Shard',   secondary: 'Moonlit Blood Vial' },
      { name: 'Chaos Wyvern',      primary: 'Wyvern Spine',             secondary: 'Chaos Wyvern Heart' },
    ]
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // C-RANK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  C: {
    monsters: [
      { name: 'Wyvern',              drops: ['Wyvern Wing Membrane', 'Wyvern Scale', 'Wyvern Fang', 'Wyvern Talon'] },
      { name: 'Venomwing',           drops: ['Wyvern Scale', 'Venom Sac', 'Wyvern Wing Membrane', 'Venom Fang'] },
      { name: 'Scorchwing',          drops: ['Wyvern Fang', 'Scorch Gland', 'Ember Scale', 'Wyvern Wing Membrane'] },
      { name: 'Bone Giant',          drops: ['Giant Bone', 'Ancient Skull', 'Marrow Core', 'Hollow Giant Rib'] },
      { name: 'Grave Titan',         drops: ['Ancient Skull', 'Giant Bone', 'Grave Dust', 'Titan Jaw Shard'] },
      { name: 'Rotting Colossus',    drops: ['Marrow Core', 'Decayed Titan Flesh', 'Giant Bone', 'Putrid Core'] },
      { name: 'Chaos Troll',         drops: ['Troll Hide', 'Chaos Stone', 'Regenerative Flesh', 'Chaos Troll Claw'] },
      { name: 'Void Troll',          drops: ['Chaos Stone', 'Void Troll Hide', 'Null Flesh', 'Void Troll Tusk'] },
      { name: 'Mutant Troll',        drops: ['Regenerative Flesh', 'Mutant Core', 'Troll Hide', 'Mutant Claw'] },
      { name: 'Dark Mage',           drops: ['Mage Soul Orb', 'Dark Spell Fragment', 'Arcane Residue', 'Soul Thread'] },
      { name: 'Chaos Sorcerer',      drops: ['Dark Spell Fragment', 'Chaos Rune Shard', 'Mage Soul Orb', 'Hex Catalyst'] },
      { name: 'Fallen Archmage',     drops: ['Arcane Residue', 'Archmage Soul Shard', 'Dark Spell Fragment', 'Corrupted Focus'] },
      { name: 'Mana Stone Beast',       drops: ['Mana Stone Horn', 'Prismatic Shard', 'Beast Core', 'Mana Stone Claw'] },
      { name: 'Prism Stalker',       drops: ['Prismatic Shard', 'Prism Eye', 'Mana Stone Horn', 'Refracted Core'] },
      { name: 'Gem Golem',           drops: ['Beast Core', 'Gem Fragment', 'Mana Stone Plate Shard', 'Gem Golem Eye'] },
      { name: 'Gargoyle',            drops: ['Gargoyle Stone Wing', 'Gargoyle Talon', 'Stone Hide Chip', 'Gargoyle Eye'] },
      { name: 'Hellhound',           drops: ['Hellhound Fang', 'Hellhound Pelt', 'Ember Saliva', 'Hellhound Claw'] },
      { name: 'Abyssal Crawler',     drops: ['Abyssal Chitin', 'Crawler Mandible', 'Abyss Slime', 'Crawler Claw'] },
      { name: 'Dusk Elemental',      drops: ['Dusk Essence', 'Twilight Core', 'Fading Light Shard', 'Dusk Mana Stone'] },
      { name: 'Cursed Executioner',  drops: ['Executioner Brand', 'Cursed Chain Link', 'Hex Plate Shard', 'Condemned Mark'] },
      // ── Elemental ────────────────────────────────────────────
      { name: 'Inferno Wyvern',    drops: ['Inferno Core', 'Blaze Scale', 'Scorched Fang', 'Fire Wyvern Eye'] },
      { name: 'Tidal Colossus',    drops: ['Tidal Core', 'Wave Hide', 'Frost Colossus Eye', 'Ice Bone'] },
      { name: 'Thunder Gargoyle',  drops: ['Thunder Core', 'Volt Stone Wing', 'Storm Gargoyle Eye', 'Spark Hide'] },
      { name: 'Cyclone Specter',   drops: ['Cyclone Core', 'Gale Specter Cloth', 'Wind Wisp', 'Storm Eye'] },
      { name: 'Quake Troll',       drops: ['Quake Core', 'Tremor Hide', 'Earth Troll Tusk', 'Ground Shard'] },
    ],
    bosses: [
      { name: 'Mana Stone Dragon',   primary: 'Mana Stone Dragon Horn',   secondary: 'Mana Stone Dragon Eye' },
      { name: 'Dark Elf Queen',   primary: "Queen's Shadow Crown",  secondary: 'Dark Elven Blood' },
      { name: 'Shadow Titan',     primary: 'Titan Shadow Core',     secondary: "Titan's Obsidian Fist" },
    ]
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // B-RANK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  B: {
    monsters: [
      { name: 'Ogre Lord',          drops: ['Ogre Lord Tusk', 'Lord Hide', 'Dominion Stone', 'Ogre Lord Eye'] },
      { name: 'War Ogre',           drops: ['Ogre War Hide', 'War Brand', 'Ogre Lord Tusk', 'Ogre Knuckle'] },
      { name: 'Titan Ogre',         drops: ['Dominion Stone', 'Titan Ogre Plate', 'Ogre War Hide', 'Titan Marrow'] },
      { name: 'Shadow Specter',     drops: ['Specter Essence', 'Void Wisp', 'Phantom Cloth', 'Specter Tear'] },
      { name: 'Phantom Wraith',     drops: ['Void Wisp', 'Phantom Cloth', 'Wraith Echo', 'Null Tear'] },
      { name: 'Soul Reaper',        drops: ['Phantom Cloth', 'Reaper Chain Link', 'Soul Wisp', 'Reaper Brand'] },
      { name: 'Thunder Hawk',       drops: ['Thunder Feather', 'Storm Talon', 'Lightning Core', 'Thunder Eye'] },
      { name: 'Storm Eagle',        drops: ['Storm Talon', 'Gale Feather', 'Thunder Feather', 'Storm Beak'] },
      { name: 'Tempest Griffin',    drops: ['Lightning Core', 'Tempest Mane', 'Storm Talon', 'Griffin Claw'] },
      { name: 'Chaos Knight',       drops: ['Chaos Armor Shard', 'Knight Soul', 'Corrupted Crest', 'Chaos Brand'] },
      { name: 'Void Crusader',      drops: ['Knight Soul', 'Void Plate Shard', 'Chaos Armor Shard', 'Crusader Emblem'] },
      { name: 'Dark Templar',       drops: ['Corrupted Crest', 'Templar Mark', 'Knight Soul', 'Shadow Plate Chip'] },
      { name: 'Ancient Serpent',    drops: ['Serpent Scale', 'Venom Sac', 'Ancient Fang', 'Serpent Eye'] },
      { name: 'Venom Hydra',        drops: ['Venom Sac', 'Hydra Head Scale', 'Ancient Fang', 'Hydra Blood'] },
      { name: 'Abyss Naga',         drops: ['Ancient Fang', 'Naga Scale', 'Abyss Venom', 'Naga Eye'] },
      { name: 'Demon Warden',       drops: ['Warden Brand', 'Demon Warden Horn', 'Infernal Chain', 'Warden Eye'] },
      { name: 'Infernal Golem',     drops: ['Infernal Core', 'Lava Plate Shard', 'Ember Stone', 'Infernal Eye'] },
      { name: 'Cursed Behemoth',    drops: ['Behemoth Plate', 'Cursed Tusk', 'Behemoth Hide', 'Cursed Marrow'] },
      { name: 'Ashen Drake',        drops: ['Ashen Drake Scale', 'Ash Fang', 'Ember Drake Claw', 'Ashen Core'] },
      { name: 'Void Elemental',     drops: ['Void Fragment', 'Null Essence', 'Void Mana Stone Shard', 'Null Wisp'] },
      // ── Elemental ────────────────────────────────────────────
      { name: 'Blazing Ogre',      drops: ['Blazing Core', 'Flame Ogre Hide', 'Magma Tusk', 'Ember Knuckle'] },
      { name: 'Glacial Specter',   drops: ['Glacial Specter Core', 'Frost Wisp', 'Ice Phantom Cloth', 'Frozen Soul'] },
      { name: 'Gale Crusader',     drops: ['Gale Core', 'Storm Plate Shard', 'Wind Crusader Brand', 'Cyclone Eye'] },
      { name: 'Tremor Serpent',    drops: ['Tremor Core', 'Quake Scale', 'Earth Fang', 'Ground Serpent Eye'] },
      { name: 'Volt Hydra',        drops: ['Volt Hydra Core', 'Thunder Scale', 'Storm Fang', 'Lightning Eye'] },
    ],
    bosses: [
      { name: 'Thunder Wyvern Lord', primary: 'Wyvern Lord Thundercore',  secondary: 'Thunder Wyvern Crown' },
      { name: 'Demon General',       primary: "General's Demon Horn",     secondary: 'Demon General Blood' },
      { name: 'Ancient Chaos Beast', primary: 'Chaos Beast Heart',        secondary: 'Primordial Chaos Shard' },
    ]
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // A-RANK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  A: {
    monsters: [
      { name: 'Dragon Whelp',       drops: ['Dragon Whelp Scale', 'Dragon Blood', 'Juvenile Dragon Heart', 'Whelp Fang'] },
      { name: 'Young Flame Drake',  drops: ['Dragon Blood', 'Flame Drake Scale', 'Ember Drake Fang', 'Dragon Whelp Scale'] },
      { name: 'Dark Whelpling',     drops: ['Juvenile Dragon Heart', 'Dark Whelp Scale', 'Shadow Dragon Blood', 'Null Fang'] },
      { name: 'Death Knight',       drops: ['Death Knight Soul', 'Cursed Blade Shard', 'Undying Ember', 'Death Plate Chip'] },
      { name: 'Undying Champion',   drops: ['Cursed Blade Shard', 'Undying Ember', 'Champion Soul', 'Revenant Steel'] },
      { name: 'Grave Sentinel',     drops: ['Undying Ember', 'Sentinel Brand', 'Death Knight Soul', 'Grave Plate Shard'] },
      { name: 'Demon Archer',       drops: ['Demon Eye', 'Infernal Bowstring', 'Cursed Quiver', 'Demon Archer Horn'] },
      { name: 'Hellfire Sniper',    drops: ['Infernal Bowstring', 'Hellfire Arrow Tip', 'Demon Eye', 'Sniper Brand'] },
      { name: 'Shadow Assassin',    drops: ['Cursed Quiver', 'Assassin Mark', 'Shadow Blade Shard', 'Demon Eye'] },
      { name: 'Abyssal Mage',       drops: ['Abyss Core', 'Eldritch Fragment', 'Soul Siphon Mana Stone', 'Abyss Rune'] },
      { name: 'Void Warlock',       drops: ['Eldritch Fragment', 'Void Rune Shard', 'Abyss Core', 'Warlock Brand'] },
      { name: 'Soul Siphoner',      drops: ['Soul Siphon Mana Stone', 'Stolen Soul Wisp', 'Eldritch Fragment', 'Siphon Mark'] },
      { name: 'World Serpent',      drops: ['World Serpent Scale', 'Cosmic Fang', 'Mythic Venom Sac', 'Serpent God Eye'] },
      { name: 'Cosmic Viper',       drops: ['Cosmic Fang', 'Star Venom Sac', 'World Serpent Scale', 'Cosmic Scale'] },
      { name: 'Abyss Python',       drops: ['Mythic Venom Sac', 'Abyss Serpent Scale', 'Cosmic Fang', 'Python Eye'] },
      { name: 'Fallen Seraph',      drops: ['Broken Seraph Wing', 'Fallen Halo Shard', 'Divine Feather', 'Seraph Tear'] },
      { name: 'Chaos Behemoth',     drops: ['Chaos Behemoth Core', 'Behemoth Chaos Hide', 'Chaos Tusk', 'Behemoth Eye'] },
      { name: 'Doom Elemental',     drops: ['Doom Essence', 'Doom Mana Stone', 'Catastrophe Wisp', 'Doom Core'] },
      { name: 'Infernal Titan',     drops: ['Titan Ember', 'Infernal Titan Plate', 'Molten Core', 'Titan Infernal Eye'] },
      { name: 'Abyss Predator',     drops: ['Predator Claw', 'Abyss Predator Eye', 'Hunter Mark', 'Predator Fang'] },
      // ── Elemental ────────────────────────────────────────────
      { name: 'Sovereign Flame Drake',  drops: ['Sovereign Flame Core', 'Royal Ember Scale', 'Inferno Eye', 'Sovereign Ash'] },
      { name: 'Abyssal Glacier',        drops: ['Abyssal Ice Core', 'Deep Frost Hide', 'Null Ice Fang', 'Abyss Glacier Eye'] },
      { name: 'Heaven Hawk',            drops: ['Heaven Thunder Core', 'Divine Volt Feather', 'Sky Storm Talon', 'Thunder God Eye'] },
      { name: 'Cosmic Gale Beast',      drops: ['Cosmic Wind Core', 'Star Gale Hide', 'Void Breeze Claw', 'Cosmic Eye'] },
      { name: 'Ancient Earth Titan',    drops: ['Ancient Earth Core', 'Primordial Stone', 'World Pillar Shard', 'Titan Ground Eye'] },
    ],
    bosses: [
      { name: 'Dragon King',      primary: 'Dragon King Crown Shard',  secondary: 'Dragon King Heart' },
      { name: 'Demon Warlord',    primary: 'Warlord Demon Sigil',      secondary: "Warlord's Severed Horn" },
      { name: 'Void Abomination', primary: 'Void Abomination Eye',     secondary: 'Abomination Core' },
    ]
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // S-RANK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  S: {
    monsters: [
      { name: 'Red Dragon',            drops: ['Red Dragon Scale', 'Dragon Heart', 'Inferno Core', 'Red Dragon Eye'] },
      { name: 'Crimson Wyrm',          drops: ['Dragon Heart', 'Crimson Wyrm Scale', 'Wyrm Blood', 'Crimson Core'] },
      { name: 'Inferno Dragon',        drops: ['Inferno Core', 'Inferno Dragon Scale', 'Dragon Heart', 'Scorched Dragon Eye'] },
      { name: 'Demon King Soldier',    drops: ['Demon Soldier Horn', 'Sovereign Mark', 'Hellfire Shard', 'Soldier Soul'] },
      { name: 'Sovereign Guard',       drops: ['Sovereign Mark', 'Guard Soul Shard', 'Demon Soldier Horn', 'Sovereign Eye'] },
      { name: 'Hellfire Vanguard',     drops: ['Hellfire Shard', 'Vanguard Brand', 'Sovereign Mark', 'Hellfire Core'] },
      { name: 'Arch Demon',            drops: ['Arch Demon Horn', 'Demon Soul', 'Infernal Crest', 'Arch Demon Eye'] },
      { name: 'High Demon',            drops: ['Demon Soul', 'High Demon Wing', 'Arch Demon Horn', 'Demon Blood'] },
      { name: 'Infernal Overlord',     drops: ['Infernal Crest', 'Overlord Brand', 'Demon Soul', 'Infernal Overlord Eye'] },
      { name: 'Void Wraith',           drops: ['Void Essence', 'Wraith Soul', 'Nullification Mana Stone', 'Void Wraith Eye'] },
      { name: 'Null Specter',          drops: ['Wraith Soul', 'Null Shard', 'Void Essence', 'Specter Core'] },
      { name: 'Oblivion Shade',        drops: ['Nullification Mana Stone', 'Oblivion Dust', 'Wraith Soul', 'Shade Eye'] },
      { name: 'Ancient Dragon',        drops: ['Ancient Dragon Scale', 'Primordial Heart', 'Eternal Flame', 'Ancient Dragon Eye'] },
      { name: 'Primordial Wyrm',       drops: ['Primordial Heart', 'Wyrm Ancient Scale', 'Eternal Flame', 'Primordial Eye'] },
      { name: 'Eternal Drake',         drops: ['Eternal Flame', 'Eternal Drake Scale', 'Primordial Heart', 'Eternal Eye'] },
      { name: 'Shadow Sovereign',      drops: ['Sovereign Shadow Shard', 'Shadow Crown Fragment', 'Monarch Wisp', 'Sovereign Eye'] },
      { name: 'Chaos Incarnate',       drops: ['Chaos Flesh', 'Incarnate Core', 'Reality Tear', 'Chaos Eye'] },
      { name: 'Void Titan',            drops: ['Void Titan Core', 'Titan Null Plate', 'Void Giant Bone', 'Void Titan Eye'] },
      { name: 'Abyss God Fragment',    drops: ['God Fragment Sliver', 'Divine Abyss Shard', 'God Essence Trace', 'Abyss God Eye'] },
      { name: 'Catastrophe Elemental', drops: ['Catastrophe Ember', 'Disaster Wisp', 'World Crack Shard', 'Catastrophe Eye'] },
      // ── Elemental ────────────────────────────────────────────
      { name: 'God Flame Dragon',         drops: ['God Flame Core', 'Divine Fire Scale', 'Eternal Ember', 'Sovereign Fire Eye'] },
      { name: 'Eternal Glacier Wyrm',     drops: ['Eternal Ice Core', 'Glacier God Scale', 'Null Frost Fang', 'Eternal Ice Eye'] },
      { name: 'Heaven Thunder Sovereign', drops: ['Heaven Volt Core', 'Divine Thunder Scale', 'God Lightning Eye', 'Sky Sovereign Brand'] },
      { name: 'World Gale Sovereign',     drops: ['World Wind Core', 'Sovereign Gale Hide', 'Reality Breeze Shard', 'God Wind Eye'] },
      { name: 'Earth God Colossus',       drops: ['Earth God Core', 'World Pillar Hide', 'Divine Ground Shard', 'Earth God Eye'] },
    ],
    bosses: [
      { name: 'Arch Demon Lord',     primary: 'Arch Demon Lord Horn',      secondary: 'Demon Lord Sovereign Heart' },
      { name: 'Ancient Void Dragon', primary: 'Void Dragon Primordial Eye', secondary: 'Ancient Void Dragon Heart' },
      { name: 'Chaos God Fragment',  primary: 'Chaos God Shard',            secondary: 'Fractured Divine Core' },
    ]
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DISASTER-RANK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DISASTER: {
    monsters: [
      { name: 'Demon King',           drops: ['Demon King Horn', 'Monarch Soul Shard', 'Catastrophe Core', 'Demon King Eye'] },
      { name: 'Demon King Avatar',    drops: ['Monarch Soul Shard', 'Avatar Flame', 'Demon King Horn', 'Avatar Brand'] },
      { name: 'Demon King Phantom',   drops: ['Catastrophe Core', 'Phantom Monarch Wisp', 'Monarch Soul Shard', 'Phantom Brand'] },
      { name: 'Void Dragon',          drops: ['Void Dragon Heart', 'Reality Shard', 'Oblivion Scale', 'Void Dragon Eye'] },
      { name: 'Void Dragon Shade',    drops: ['Reality Shard', 'Shade Dragon Scale', 'Void Dragon Heart', 'Shade Core'] },
      { name: 'Oblivion Wyrm',        drops: ['Oblivion Scale', 'Null Wyrm Bone', 'Reality Shard', 'Oblivion Eye'] },
      { name: 'Ancient God Beast',    drops: ['God Beast Eye', 'Divine Marrow', 'Primordial Core', 'God Beast Claw'] },
      { name: 'Divine Predator',      drops: ['Divine Marrow', 'Predator God Fang', 'God Beast Eye', 'Divine Claw'] },
      { name: 'Primordial God Beast', drops: ['Primordial Core', 'Ancient God Scale', 'Divine Marrow', 'Primordial Eye'] },
      { name: 'Chaos Deity',          drops: ['Deity Fragment', 'Chaos Essence', 'World-Breaking Shard', 'Deity Eye'] },
      { name: 'Chaos Avatar',         drops: ['Chaos Essence', 'Avatar Chaos Core', 'Deity Fragment', 'Chaos Brand'] },
      { name: 'Entropy God',          drops: ['World-Breaking Shard', 'Entropy Core', 'Chaos Essence', 'Entropy Eye'] },
      { name: 'World Destroyer',      drops: ['Destroyer Heart', 'Apocalypse Core', 'Null Stone', 'Destroyer Eye'] },
      { name: 'Apocalypse Herald',    drops: ['Apocalypse Core', 'Herald Brand', 'Destroyer Heart', 'Apocalypse Eye'] },
      { name: 'Null God',             drops: ['Null Stone', 'God Null Core', 'Apocalypse Core', 'Null God Eye'] },
      { name: 'Shadow Monarch Clone', drops: ['Monarch Shadow Claw', 'Clone Soul Shard', 'Monarch Wisp', 'Monarch Clone Eye'] },
      { name: 'Abyss Sovereign',      drops: ['Abyss Sovereign Eye', 'Sovereign Void Core', 'Null Throne Shard', 'Abyss Crown Fragment'] },
      { name: 'Catastrophe Beast',    drops: ['Catastrophe Marrow', 'Disaster Beast Hide', 'World Crack Bone', 'Catastrophe Eye'] },
      { name: 'Void Monarch',         drops: ['Void Monarch Fragment', 'Monarch Null Soul', 'Reality Splinter', 'Void Monarch Eye'] },
      { name: 'God of Ruin',          drops: ['Ruin Deity Core', 'Divine Ruin Shard', 'Apocalypse Ember', 'God of Ruin Eye'] },
      // ── Elemental ────────────────────────────────────────────
      { name: 'Apocalypse Flame God',  drops: ['Apocalypse Fire Core', 'World Flame Scale', 'End-of-Days Ember', 'Ruin Fire Eye'] },
      { name: 'Null Tide Sovereign',   drops: ['Null Tide Core', 'Void Glacier Hide', 'World Frost Fang', 'Null Tide Eye'] },
      { name: 'God of Thunder Ruin',   drops: ['Thunder Ruin Core', 'Apocalypse Volt Scale', 'World Thunder Eye', 'Ruin Storm Brand'] },
      { name: 'World Storm Deity',     drops: ['World Storm Core', 'Apocalypse Gale Hide', 'Reality Wind Shard', 'Storm Deity Eye'] },
      { name: 'Primordial Earth God',  drops: ['Primordial Earth Core', 'World Pillar God Shard', 'Reality Ground Hide', 'Earth Deity Eye'] },
    ],
    bosses: [
      { name: 'The Demon King',          primary: "Demon King's True Horn",     secondary: 'Demon King Monarch Heart' },
      { name: 'The World Ender',         primary: "World Ender's Eye",           secondary: 'Apocalypse God Core' },
      { name: 'Ancient Catastrophe God', primary: 'Catastrophe God Fragment',    secondary: 'Divine Catastrophe Soul' },
    ]
  }

};

// ─── BASE MATERIALS PER GATE RANK ───────────────────────────────
const BASE_MATERIALS = {
  F:        ['Wood', 'Leather', 'Bone', 'Flint', 'Coal', 'String', 'Wool', 'Cobblestone'],
  E:        ['Iron Ingot', 'Copper Ingot', 'Granite', 'Sandstone', 'Feather', 'Hide', 'Andesite', 'Diorite'],
  D:        ['Steel Ingot', 'Obsidian', 'Blackstone', 'Bronze Ingot', 'Shadow Cloth', 'Deep Stone', 'Deepslate', 'Frozen Mana Stone'],
  C:        ['Blaze Rod', 'Ender Pearl', 'Glowstone Dust', 'Chaos Fragment', 'Lava Core', 'Phantom Membrane', 'Void Shard', 'Dark Iron'],
  B:        ['Soul Mana Stone', 'Thunder Essence', 'Storm Shard', 'Abyssal Stone', 'Netherite Scrap', 'Void Metal', 'Tempest Core', 'Demonic Alloy'],
  A:        ['Dragon Bone', 'Infernal Alloy', 'Abyss Metal', 'Sovereign Steel', 'Cosmic Dust', 'Ethereal Cloth', 'Ancient Alloy', 'Doom Metal'],
  S:        ['Eternal Metal', 'Void Alloy', 'Chaos Steel', 'Dragon God Bone', 'Primordial Alloy', 'Shadow Sovereign Steel', 'Null Metal', 'God-Forged Iron'],
  DISASTER: ['Monarch Shard', 'Chaos Mana Stone', 'Eternal Flame', 'Null Core', 'Apocalypse Alloy', 'Divine Metal', 'Catastrophe Steel', 'Reality Fragment'],
};

// ─── DROP LOGIC ─────────────────────────────────────────────────

const MONSTER_DROP_CHANCE = 0.35;   // 35% chance monster drops anything
const BOSS_SECONDARY_CHANCE = 0.35; // 35% chance boss drops secondary item

/**
 * Roll a monster drop
 * 35% chance to drop 1 item randomly selected from the monster's pool
 */
function rollMonsterDrop(rank, monsterName = null) {
  const rankData = MONSTER_DROPS[rank];
  if (!rankData) return { drop: null, monster: null };

  const monster = monsterName
    ? rankData.monsters.find(m => m.name === monsterName)
    : rankData.monsters[Math.floor(Math.random() * rankData.monsters.length)];

  if (!monster) return { drop: null, monster: null };

  if (Math.random() > MONSTER_DROP_CHANCE) return { drop: null, monster };

  const drop = monster.drops[Math.floor(Math.random() * monster.drops.length)];
  return { drop, monster };
}

/**
 * Roll a boss drop
 * Primary always drops. Secondary has 35% chance.
 */
function rollBossDrop(rank, bossName = null) {
  const rankData = MONSTER_DROPS[rank];
  if (!rankData) return { primary: null, secondary: null, boss: null };

  const boss = bossName
    ? rankData.bosses.find(b => b.name === bossName)
    : rankData.bosses[Math.floor(Math.random() * rankData.bosses.length)];

  if (!boss) return { primary: null, secondary: null, boss: null };

  const secondary = Math.random() <= BOSS_SECONDARY_CHANCE ? boss.secondary : null;

  return { primary: boss.primary, secondary, boss };
}

/**
 * Get a random base material for a gate rank
 */
function rollBaseMaterial(rank) {
  const mats = BASE_MATERIALS[rank] || BASE_MATERIALS['F'];
  return mats[Math.floor(Math.random() * mats.length)];
}

function getRandomMonster(rank) {
  const rankData = MONSTER_DROPS[rank];
  if (!rankData) return null;
  return rankData.monsters[Math.floor(Math.random() * rankData.monsters.length)];
}

function getRandomBoss(rank) {
  const rankData = MONSTER_DROPS[rank];
  if (!rankData) return null;
  return rankData.bosses[Math.floor(Math.random() * rankData.bosses.length)];
}

module.exports = {
  MONSTER_DROPS,
  BASE_MATERIALS,
  MONSTER_DROP_CHANCE,
  BOSS_SECONDARY_CHANCE,
  rollMonsterDrop,
  rollBossDrop,
  rollBaseMaterial,
  getRandomMonster,
  getRandomBoss,
};
