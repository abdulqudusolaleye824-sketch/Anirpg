// ═══════════════════════════════════════════════════════════════
// SOLO LEVELING RECIPES — Push #71
// Crafted ONLY from the new bestiary drops (rpg/data/SoloLevelingMonsters.js)
// + the gate rank's Mana Essence. Merged into the six scroll pools by
// CraftingSystem: E→Common, D→Uncommon, C→Rare, B→Epic, A→Legendary, S→Mythic.
// ═══════════════════════════════════════════════════════════════
'use strict';

const SL_RECIPES = {
  "Common": {
    "weapons": [
      {"output":"Kobold Iron Blade","stats":{"atk":16,"bonus":16,"critChance":1},"durability":80,"materials":{"Kobold Iron Nail":3,"Bat Sonar Gland":1,"E-Rank Mana Essence":1},"set":"sololeveling"},
      {"output":"Slime Acid Venom Edge","stats":{"atk":14,"bonus":14,"critChance":1},"durability":74,"materials":{"Slime Acid Sac":3,"Kobold Iron Nail":1,"E-Rank Mana Essence":1},"set":"sololeveling","onHit":{"type":"poison","chance":40,"duration":4}},
      {
        "output": "Centipede Blade",
        "onHit": {"type": "poison", "chance": 35, "duration": 4},
        "stats": {
          "atk": 13,
          "bonus": 13,
          "critChance": 1
        },
        "durability": 81,
        "materials": {
          "Centipede Shell": 3,
          "Cave Bat Wing": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Slime Fang Sword",
        "stats": {
          "atk": 15,
          "bonus": 15,
          "critChance": 1
        },
        "durability": 76,
        "materials": {
          "Slime Core": 3,
          "Centipede Shell": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Centipede Greataxe",
        "onHit": {"type": "poison", "chance": 35, "duration": 4},
        "stats": {
          "atk": 15,
          "bonus": 15,
          "critChance": 1
        },
        "durability": 87,
        "materials": {
          "Centipede Shell": 2,
          "Cracked Golem Shard": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cracked Golem Warstaff",
        "stats": {
          "atk": 14,
          "bonus": 14,
          "critChance": 1
        },
        "durability": 82,
        "materials": {
          "Cracked Golem Shard": 2,
          "Rat Bone": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Lycan Pup Spear",
        "stats": {
          "atk": 13,
          "bonus": 13,
          "critChance": 1
        },
        "durability": 81,
        "materials": {
          "Lycan Pup Claw": 3,
          "Centipede Shell": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Boar Blade",
        "stats": {
          "atk": 16,
          "bonus": 16,
          "critChance": 1
        },
        "durability": 76,
        "materials": {
          "Boar Tusk": 2,
          "Lycan Pup Claw": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "helmet": [
      {"output":"Bat Sonar Helm","stats":{"def":8,"bonus":8,"hp":28},"durability":80,"materials":{"Bat Sonar Gland":3,"Boar Bristle Hide":1,"E-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Lycan Pup Helm",
        "stats": {
          "def": 5,
          "hp": 20
        },
        "durability": 82,
        "materials": {
          "Lycan Pup Claw": 2,
          "Dull Mana Shard": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Lycan Pup Crown",
        "stats": {
          "def": 6,
          "hp": 23
        },
        "durability": 87,
        "materials": {
          "Lycan Pup Claw": 2,
          "Cave Bat Wing": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Rat Visor",
        "stats": {
          "def": 6,
          "hp": 22
        },
        "durability": 83,
        "materials": {
          "Rat Bone": 3,
          "Boar Tusk": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Rat Hood",
        "stats": {
          "def": 5,
          "hp": 22
        },
        "durability": 76,
        "materials": {
          "Rat Bone": 2,
          "Dull Mana Shard": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Spider Skullcap",
        "stats": {
          "def": 6,
          "hp": 23
        },
        "durability": 84,
        "materials": {
          "Spider Silk": 2,
          "Dull Mana Shard": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Boar Helm",
        "stats": {
          "def": 5,
          "hp": 21
        },
        "durability": 78,
        "materials": {
          "Boar Tusk": 2,
          "Spider Silk": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "chest": [
      {"output":"Boar Bristle Plate","stats":{"def":12,"bonus":12,"hp":42},"durability":90,"materials":{"Boar Bristle Hide":4,"Bat Sonar Gland":2,"E-Rank Mana Essence":2},"set":"sololeveling"},
      {
        "output": "Rat Plate",
        "stats": {
          "def": 5,
          "hp": 36
        },
        "durability": 80,
        "materials": {
          "Rat Bone": 3,
          "Cracked Golem Shard": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Kobold Cuirass",
        "stats": {
          "def": 6,
          "hp": 42
        },
        "durability": 83,
        "materials": {
          "Kobold Pick": 2,
          "Goblin Ear": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Kobold Mantle",
        "stats": {
          "def": 6,
          "hp": 43
        },
        "durability": 80,
        "materials": {
          "Kobold Pick": 3,
          "Lycan Pup Claw": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cave Bat Carapace Armor",
        "stats": {
          "def": 6,
          "hp": 41
        },
        "durability": 84,
        "materials": {
          "Cave Bat Wing": 2,
          "Centipede Shell": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Slime Robe",
        "stats": {
          "def": 7,
          "hp": 45
        },
        "durability": 83,
        "materials": {
          "Slime Core": 3,
          "Kobold Pick": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Spider Plate",
        "stats": {
          "def": 5,
          "hp": 36
        },
        "durability": 81,
        "materials": {
          "Spider Silk": 3,
          "Slime Core": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "gloves": [
      {
        "output": "Cave Bat Gauntlets",
        "stats": {
          "def": 3,
          "atk": 3
        },
        "durability": 79,
        "materials": {
          "Cave Bat Wing": 2,
          "Centipede Shell": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Boar Grips",
        "stats": {
          "def": 3,
          "atk": 3
        },
        "durability": 79,
        "materials": {
          "Boar Tusk": 2,
          "Rat Bone": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Goblin Claws",
        "stats": {
          "def": 3,
          "atk": 3
        },
        "durability": 77,
        "materials": {
          "Goblin Fang": 3,
          "Centipede Shell": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Boar Bracers",
        "stats": {
          "def": 3,
          "atk": 3
        },
        "durability": 84,
        "materials": {
          "Boar Tusk": 3,
          "Spider Silk": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Boar Handguards",
        "stats": {
          "def": 3,
          "atk": 3
        },
        "durability": 83,
        "materials": {
          "Boar Tusk": 3,
          "Cave Bat Wing": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Rat Gauntlets",
        "stats": {
          "def": 3,
          "atk": 3
        },
        "durability": 87,
        "materials": {
          "Rat Bone": 3,
          "Kobold Pick": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "boots": [
      {"output":"Kobold Iron Treads","stats":{"def":5,"bonus":5,"speed":2},"durability":80,"materials":{"Kobold Iron Nail":2,"Slime Acid Sac":2,"E-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Centipede Greaves",
        "stats": {
          "def": 3,
          "speed": 4
        },
        "durability": 88,
        "materials": {
          "Centipede Shell": 2,
          "Cave Bat Wing": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cave Bat Treads",
        "stats": {
          "def": 3,
          "speed": 4
        },
        "durability": 83,
        "materials": {
          "Cave Bat Wing": 2,
          "Lycan Pup Claw": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Goblin Striders",
        "stats": {
          "def": 3,
          "speed": 5
        },
        "durability": 86,
        "materials": {
          "Goblin Ear": 3,
          "Boar Tusk": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Goblin Sabatons",
        "stats": {
          "def": 3,
          "speed": 4
        },
        "durability": 86,
        "materials": {
          "Goblin Fang": 3,
          "Spider Silk": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cracked Golem Boots",
        "stats": {
          "def": 3,
          "speed": 5
        },
        "durability": 82,
        "materials": {
          "Cracked Golem Shard": 3,
          "Dull Mana Shard": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cave Bat Greaves",
        "stats": {
          "def": 3,
          "speed": 4
        },
        "durability": 79,
        "materials": {
          "Cave Bat Wing": 3,
          "Dull Mana Shard": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "leggings": [
      {
        "output": "Rat Legplates",
        "stats": {
          "def": 5,
          "hp": 22
        },
        "durability": 77,
        "materials": {
          "Rat Bone": 3,
          "Goblin Ear": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Goblin Chausses",
        "stats": {
          "def": 5,
          "hp": 25
        },
        "durability": 81,
        "materials": {
          "Goblin Ear": 3,
          "Cracked Golem Shard": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cracked Golem Tassets",
        "stats": {
          "def": 5,
          "hp": 26
        },
        "durability": 87,
        "materials": {
          "Cracked Golem Shard": 2,
          "Lycan Pup Claw": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cracked Golem Leggings",
        "stats": {
          "def": 5,
          "hp": 24
        },
        "durability": 81,
        "materials": {
          "Cracked Golem Shard": 2,
          "Spider Silk": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Goblin Cuisses",
        "stats": {
          "def": 5,
          "hp": 25
        },
        "durability": 86,
        "materials": {
          "Goblin Fang": 2,
          "Rat Bone": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Goblin Legplates",
        "stats": {
          "def": 5,
          "hp": 25
        },
        "durability": 82,
        "materials": {
          "Goblin Fang": 2,
          "Cave Bat Wing": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "accessories": [
      {"output":"Slime Acid Charm","stats":{"atk":4,"def":4,"bonus":8,"critChance":2},"durability":80,"materials":{"Slime Acid Sac":2,"Boar Bristle Hide":2,"E-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Kobold Ring",
        "stats": {
          "atk": 2,
          "critChance": 2
        },
        "durability": 84,
        "materials": {
          "Kobold Pick": 2,
          "Goblin Ear": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Boar Pendant",
        "stats": {
          "atk": 2,
          "critChance": 2
        },
        "durability": 78,
        "materials": {
          "Boar Tusk": 3,
          "Kobold Pick": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Goblin Charm",
        "stats": {
          "atk": 2,
          "critChance": 2
        },
        "durability": 81,
        "materials": {
          "Goblin Ear": 3,
          "Spider Silk": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Rat Band",
        "stats": {
          "atk": 2,
          "critChance": 2
        },
        "durability": 86,
        "materials": {
          "Rat Bone": 3,
          "Kobold Pick": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Centipede Talisman",
        "onHit": {"type": "poison", "chance": 35, "duration": 4},
        "stats": {
          "atk": 2,
          "critChance": 2
        },
        "durability": 78,
        "materials": {
          "Centipede Shell": 2,
          "Spider Silk": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Centipede Ring",
        "onHit": {"type": "poison", "chance": 35, "duration": 4},
        "stats": {
          "atk": 2,
          "critChance": 2
        },
        "durability": 83,
        "materials": {
          "Centipede Shell": 3,
          "Kobold Pick": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "artifacts": [
      {
        "output": "Spider Core",
        "onHit": {"type": "poison", "chance": 35, "duration": 4},
        "stats": {
          "atk": 4,
          "def": 3,
          "hp": 21
        },
        "durability": 85,
        "materials": {
          "Spider Silk": 3,
          "Goblin Fang": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Goblin Idol",
        "stats": {
          "atk": 4,
          "def": 3,
          "hp": 19
        },
        "durability": 76,
        "materials": {
          "Goblin Fang": 2,
          "Centipede Shell": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Rat Relic",
        "stats": {
          "atk": 4,
          "def": 3,
          "hp": 20
        },
        "durability": 86,
        "materials": {
          "Rat Bone": 3,
          "Slime Core": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Goblin Totem",
        "stats": {
          "atk": 5,
          "def": 3,
          "hp": 23
        },
        "durability": 88,
        "materials": {
          "Goblin Ear": 2,
          "Lycan Pup Claw": 1,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cracked Golem Sigil",
        "stats": {
          "atk": 4,
          "def": 3,
          "hp": 19
        },
        "durability": 82,
        "materials": {
          "Cracked Golem Shard": 2,
          "Rat Bone": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Centipede Core",
        "onHit": {"type": "poison", "chance": 35, "duration": 4},
        "stats": {
          "atk": 4,
          "def": 3,
          "hp": 20
        },
        "durability": 77,
        "materials": {
          "Centipede Shell": 2,
          "Kobold Pick": 2,
          "E-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ]
  },
  "Uncommon": {
    "weapons": [
      {"output":"Hobgoblin War Blade","stats":{"atk":38,"bonus":38,"critChance":1},"durability":125,"materials":{"Hobgoblin War Paint":3,"Lycan Moon Claw":1,"D-Rank Mana Essence":1},"set":"sololeveling"},
      {"output":"Kasaka Venom Venom Edge","stats":{"atk":36,"bonus":36,"critChance":1},"durability":119,"materials":{"Kasaka Venom Fang":3,"Hobgoblin War Paint":1,"D-Rank Mana Essence":1},"set":"sololeveling","onHit":{"type":"poison","chance":40,"duration":4}},
      {
        "output": "Harpy Blade",
        "stats": {
          "atk": 35,
          "bonus": 35,
          "critChance": 2
        },
        "durability": 121,
        "materials": {
          "Harpy Feather": 3,
          "Turtle Shell Plate": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Golem Stone Fang Sword",
        "stats": {
          "atk": 37,
          "bonus": 37,
          "critChance": 2
        },
        "durability": 129,
        "materials": {
          "Golem Stone Heart": 2,
          "Wraith Ash": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Knight Bone Greataxe",
        "stats": {
          "atk": 33,
          "bonus": 33,
          "critChance": 2
        },
        "durability": 119,
        "materials": {
          "Knight Bone Plate": 2,
          "Golem Stone Heart": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Kasaka Warstaff",
        "onHit": {"type": "poison", "chance": 35, "duration": 4},
        "stats": {
          "atk": 35,
          "bonus": 35,
          "critChance": 2
        },
        "durability": 129,
        "materials": {
          "Kasaka Scale": 2,
          "Harpy Feather": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Lycan Steel Spear",
        "stats": {
          "atk": 38,
          "bonus": 38,
          "critChance": 2
        },
        "durability": 124,
        "materials": {
          "Lycan Steel Fang": 3,
          "Kasaka Scale": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Harpy Blade Mk.2",
        "stats": {
          "atk": 39,
          "bonus": 39,
          "critChance": 2
        },
        "durability": 117,
        "materials": {
          "Harpy Feather": 3,
          "Kasaka Scale": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "helmet": [
      {"output":"Lycan Moon Helm","stats":{"def":21,"bonus":21,"hp":72},"durability":125,"materials":{"Lycan Moon Claw":3,"Harpy Wind Talon":1,"D-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Kasaka Helm",
        "stats": {
          "def": 11,
          "hp": 45
        },
        "durability": 115,
        "materials": {
          "Kasaka Scale": 3,
          "Troll Hide": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Harpy Crown",
        "stats": {
          "def": 11,
          "hp": 43
        },
        "durability": 116,
        "materials": {
          "Harpy Feather": 2,
          "Kasaka Scale": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Lycan Steel Visor",
        "stats": {
          "def": 10,
          "hp": 40
        },
        "durability": 121,
        "materials": {
          "Lycan Steel Fang": 3,
          "Wolf Pelt": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ghoul Hood",
        "stats": {
          "def": 10,
          "hp": 41
        },
        "durability": 118,
        "materials": {
          "Ghoul Nail": 3,
          "Orc Tusk": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Harpy Skullcap",
        "stats": {
          "def": 11,
          "hp": 43
        },
        "durability": 122,
        "materials": {
          "Harpy Feather": 2,
          "Knight Bone Plate": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Harpy Helm",
        "stats": {
          "def": 10,
          "hp": 41
        },
        "durability": 122,
        "materials": {
          "Harpy Feather": 3,
          "Knight Bone Plate": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "chest": [
      {"output":"Harpy Wind Plate","stats":{"def":32,"bonus":32,"hp":108},"durability":135,"materials":{"Harpy Wind Talon":4,"Lycan Moon Claw":2,"D-Rank Mana Essence":2},"set":"sololeveling"},
      {
        "output": "Orc Plate",
        "stats": {
          "def": 12,
          "hp": 80
        },
        "durability": 125,
        "materials": {
          "Orc Tusk": 3,
          "Knight Bone Plate": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Harpy Cuirass",
        "stats": {
          "def": 12,
          "hp": 83
        },
        "durability": 131,
        "materials": {
          "Harpy Feather": 3,
          "Lycan Steel Fang": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Troll Mantle",
        "stats": {
          "def": 12,
          "hp": 81
        },
        "durability": 128,
        "materials": {
          "Troll Hide": 2,
          "Ice Wolf Fang": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Wraith Carapace Armor",
        "stats": {
          "def": 12,
          "hp": 80
        },
        "durability": 121,
        "materials": {
          "Wraith Ash": 2,
          "Knight Bone Plate": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Kasaka Robe",
        "stats": {
          "def": 12,
          "hp": 78
        },
        "durability": 119,
        "materials": {
          "Kasaka Scale": 3,
          "Orc Tusk": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Wolf Plate",
        "stats": {
          "def": 11,
          "hp": 77
        },
        "durability": 120,
        "materials": {
          "Wolf Pelt": 2,
          "Harpy Feather": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "gloves": [
      {
        "output": "Orc Gauntlets",
        "stats": {
          "def": 5,
          "atk": 6
        },
        "durability": 120,
        "materials": {
          "Orc Tusk": 3,
          "Ghoul Nail": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ghoul Grips",
        "stats": {
          "def": 6,
          "atk": 7
        },
        "durability": 123,
        "materials": {
          "Ghoul Nail": 3,
          "Lycan Steel Fang": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Golem Stone Claws",
        "stats": {
          "def": 7,
          "atk": 8
        },
        "durability": 116,
        "materials": {
          "Golem Stone Heart": 2,
          "Knight Bone Plate": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Orc Bracers",
        "stats": {
          "def": 5,
          "atk": 6
        },
        "durability": 126,
        "materials": {
          "Orc Tusk": 3,
          "Wolf Pelt": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ghoul Handguards",
        "stats": {
          "def": 6,
          "atk": 7
        },
        "durability": 127,
        "materials": {
          "Ghoul Nail": 3,
          "Wraith Ash": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Orc Gauntlets Mk.2",
        "stats": {
          "def": 6,
          "atk": 7
        },
        "durability": 130,
        "materials": {
          "Orc Tusk": 3,
          "Harpy Feather": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "boots": [
      {"output":"Hobgoblin War Treads","stats":{"def":14,"bonus":14,"speed":3},"durability":125,"materials":{"Hobgoblin War Paint":2,"Kasaka Venom Fang":2,"D-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Ice Wolf Greaves",
        "stats": {
          "def": 6,
          "speed": 7
        },
        "durability": 120,
        "materials": {
          "Ice Wolf Fang": 2,
          "Orc Tusk": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Wolf Treads",
        "stats": {
          "def": 7,
          "speed": 8
        },
        "durability": 123,
        "materials": {
          "Wolf Pelt": 3,
          "Wraith Ash": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Lycan Steel Striders",
        "stats": {
          "def": 7,
          "speed": 8
        },
        "durability": 131,
        "materials": {
          "Lycan Steel Fang": 2,
          "Harpy Feather": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Lycan Steel Sabatons",
        "stats": {
          "def": 7,
          "speed": 8
        },
        "durability": 127,
        "materials": {
          "Lycan Steel Fang": 3,
          "Orc Tusk": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ice Wolf Boots",
        "stats": {
          "def": 6,
          "speed": 7
        },
        "durability": 129,
        "materials": {
          "Ice Wolf Fang": 2,
          "Wraith Ash": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Orc Greaves",
        "stats": {
          "def": 6,
          "speed": 6
        },
        "durability": 116,
        "materials": {
          "Orc Tusk": 3,
          "Ice Wolf Fang": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "leggings": [
      {
        "output": "Kasaka Legplates",
        "stats": {
          "def": 13,
          "hp": 55
        },
        "durability": 117,
        "materials": {
          "Kasaka Scale": 3,
          "Knight Bone Plate": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Knight Bone Chausses",
        "stats": {
          "def": 12,
          "hp": 50
        },
        "durability": 117,
        "materials": {
          "Knight Bone Plate": 2,
          "Ice Wolf Fang": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Wraith Tassets",
        "stats": {
          "def": 12,
          "hp": 53
        },
        "durability": 130,
        "materials": {
          "Wraith Ash": 3,
          "Orc Tusk": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ice Wolf Leggings",
        "stats": {
          "def": 12,
          "hp": 51
        },
        "durability": 121,
        "materials": {
          "Ice Wolf Fang": 2,
          "Troll Hide": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ice Wolf Cuisses",
        "stats": {
          "def": 10,
          "hp": 44
        },
        "durability": 129,
        "materials": {
          "Ice Wolf Fang": 2,
          "Kasaka Scale": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ghoul Legplates",
        "stats": {
          "def": 12,
          "hp": 54
        },
        "durability": 119,
        "materials": {
          "Ghoul Nail": 2,
          "Troll Hide": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "accessories": [
      {"output":"Kasaka Venom Charm","stats":{"atk":10,"def":10,"bonus":21,"critChance":2},"durability":125,"materials":{"Kasaka Venom Fang":2,"Harpy Wind Talon":2,"D-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Lycan Steel Ring",
        "stats": {
          "atk": 5,
          "critChance": 3
        },
        "durability": 115,
        "materials": {
          "Lycan Steel Fang": 2,
          "Orc Tusk": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Turtle Shell Pendant",
        "stats": {
          "atk": 5,
          "critChance": 3
        },
        "durability": 122,
        "materials": {
          "Turtle Shell Plate": 2,
          "Golem Stone Heart": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Knight Bone Charm",
        "stats": {
          "atk": 5,
          "critChance": 3
        },
        "durability": 132,
        "materials": {
          "Knight Bone Plate": 2,
          "Kasaka Scale": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Kasaka Band",
        "onHit": {"type": "poison", "chance": 35, "duration": 4},
        "stats": {
          "atk": 5,
          "critChance": 3
        },
        "durability": 119,
        "materials": {
          "Kasaka Scale": 3,
          "Orc Tusk": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Knight Bone Talisman",
        "stats": {
          "atk": 6,
          "critChance": 3
        },
        "durability": 115,
        "materials": {
          "Knight Bone Plate": 2,
          "Ghoul Nail": 1,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ice Wolf Ring",
        "stats": {
          "atk": 5,
          "critChance": 3
        },
        "durability": 125,
        "materials": {
          "Ice Wolf Fang": 2,
          "Harpy Feather": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "artifacts": [
      {
        "output": "Troll Core",
        "stats": {
          "atk": 11,
          "def": 6,
          "hp": 41
        },
        "durability": 120,
        "materials": {
          "Troll Hide": 2,
          "Golem Stone Heart": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Harpy Idol",
        "stats": {
          "atk": 11,
          "def": 6,
          "hp": 41
        },
        "durability": 120,
        "materials": {
          "Harpy Feather": 2,
          "Golem Stone Heart": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Wolf Relic",
        "stats": {
          "atk": 11,
          "def": 6,
          "hp": 41
        },
        "durability": 124,
        "materials": {
          "Wolf Pelt": 2,
          "Golem Stone Heart": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Wraith Totem",
        "stats": {
          "atk": 11,
          "def": 6,
          "hp": 39
        },
        "durability": 130,
        "materials": {
          "Wraith Ash": 3,
          "Lycan Steel Fang": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Lycan Steel Sigil",
        "stats": {
          "atk": 12,
          "def": 7,
          "hp": 45
        },
        "durability": 114,
        "materials": {
          "Lycan Steel Fang": 2,
          "Troll Hide": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Knight Bone Core",
        "stats": {
          "atk": 10,
          "def": 6,
          "hp": 38
        },
        "durability": 131,
        "materials": {
          "Knight Bone Plate": 2,
          "Harpy Feather": 2,
          "D-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ]
  },
  "Rare": {
    "weapons": [
      {"output":"Naga Coral Blade","stats":{"atk":72,"bonus":72,"critChance":2},"durability":180,"materials":{"Naga Coral Scale":3,"Cerberus Ember Fang":1,"C-Rank Mana Essence":1},"set":"sololeveling"},
      {"output":"Gargoyle Sky Venom Edge","stats":{"atk":70,"bonus":70,"critChance":2},"durability":174,"materials":{"Gargoyle Sky Stone":3,"Naga Coral Scale":1,"C-Rank Mana Essence":1},"set":"sololeveling","onHit":{"type":"poison","chance":40,"duration":4}},
      {
        "output": "Frost Wolf Blade",
        "stats": {
          "atk": 68,
          "bonus": 68,
          "critChance": 5
        },
        "durability": 164,
        "materials": {
          "Frost Wolf Heart": 2,
          "Elite Lycan Pelt": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cerberus Fang Sword",
        "stats": {
          "atk": 73,
          "bonus": 73,
          "critChance": 5
        },
        "durability": 157,
        "materials": {
          "Cerberus Fang": 3,
          "Ice Elf Bow String": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Naga Greataxe",
        "stats": {
          "atk": 78,
          "bonus": 78,
          "critChance": 6
        },
        "durability": 166,
        "materials": {
          "Naga Scale": 2,
          "Gargoyle Stone": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cerberus Warstaff",
        "stats": {
          "atk": 70,
          "bonus": 70,
          "critChance": 5
        },
        "durability": 161,
        "materials": {
          "Cerberus Fang": 2,
          "Ogre Horn": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Gargoyle Spear",
        "stats": {
          "atk": 72,
          "bonus": 72,
          "critChance": 5
        },
        "durability": 166,
        "materials": {
          "Gargoyle Stone": 3,
          "Ogre Horn": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cerberus Blade",
        "stats": {
          "atk": 77,
          "bonus": 77,
          "critChance": 6
        },
        "durability": 153,
        "materials": {
          "Cerberus Fang": 3,
          "Ogre Horn": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "helmet": [
      {"output":"Cerberus Ember Helm","stats":{"def":42,"bonus":42,"hp":140},"durability":180,"materials":{"Cerberus Ember Fang":3,"Ant Warrior Plate":1,"C-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "High Orc Helm",
        "stats": {
          "def": 17,
          "hp": 65
        },
        "durability": 160,
        "materials": {
          "High Orc Tusk": 3,
          "Frost Wolf Heart": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Kasaka Venom Crown",
        "stats": {
          "def": 17,
          "hp": 64
        },
        "durability": 148,
        "materials": {
          "Kasaka Venom Gland": 3,
          "Gargoyle Stone": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Frost Wolf Visor",
        "stats": {
          "def": 19,
          "hp": 74
        },
        "durability": 169,
        "materials": {
          "Frost Wolf Heart": 2,
          "Elite Lycan Pelt": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ant Hood",
        "stats": {
          "def": 19,
          "hp": 75
        },
        "durability": 148,
        "materials": {
          "Ant Chitin": 3,
          "Steel Golem Core": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ice Elf Bow Skullcap",
        "stats": {
          "def": 18,
          "hp": 69
        },
        "durability": 150,
        "materials": {
          "Ice Elf Bow String": 3,
          "Gargoyle Stone": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Gargoyle Helm",
        "stats": {
          "def": 18,
          "hp": 70
        },
        "durability": 163,
        "materials": {
          "Gargoyle Stone": 2,
          "Ice Elf Bow String": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "chest": [
      {"output":"Ant Warrior Plate","stats":{"def":63,"bonus":63,"hp":210},"durability":190,"materials":{"Ant Warrior Plate":4,"Cerberus Ember Fang":2,"C-Rank Mana Essence":2},"set":"sololeveling"},
      {
        "output": "Frost Wolf Plate",
        "stats": {
          "def": 25,
          "hp": 159
        },
        "durability": 154,
        "materials": {
          "Frost Wolf Heart": 2,
          "Naga Scale": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Frost Wolf Cuirass",
        "stats": {
          "def": 24,
          "hp": 156
        },
        "durability": 162,
        "materials": {
          "Frost Wolf Heart": 2,
          "Cerberus Fang": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ice Elf Bow Mantle",
        "stats": {
          "def": 25,
          "hp": 160
        },
        "durability": 157,
        "materials": {
          "Ice Elf Bow String": 3,
          "Gargoyle Stone": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ant Carapace Armor",
        "stats": {
          "def": 22,
          "hp": 138
        },
        "durability": 168,
        "materials": {
          "Ant Chitin": 2,
          "Cerberus Fang": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cerberus Robe",
        "stats": {
          "def": 23,
          "hp": 145
        },
        "durability": 162,
        "materials": {
          "Cerberus Fang": 3,
          "Kasaka Venom Gland": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Kasaka Venom Plate",
        "stats": {
          "def": 24,
          "hp": 156
        },
        "durability": 150,
        "materials": {
          "Kasaka Venom Gland": 3,
          "Steel Golem Core": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "gloves": [
      {
        "output": "Elite Lycan Gauntlets",
        "stats": {
          "def": 10,
          "atk": 13
        },
        "durability": 170,
        "materials": {
          "Elite Lycan Pelt": 2,
          "Frost Wolf Heart": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ice Elf Bow Grips",
        "stats": {
          "def": 11,
          "atk": 14
        },
        "durability": 163,
        "materials": {
          "Ice Elf Bow String": 2,
          "Cerberus Fang": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ice Elf Bow Claws",
        "stats": {
          "def": 12,
          "atk": 16
        },
        "durability": 149,
        "materials": {
          "Ice Elf Bow String": 2,
          "Ant Chitin": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Steel Golem Bracers",
        "stats": {
          "def": 12,
          "atk": 15
        },
        "durability": 155,
        "materials": {
          "Steel Golem Core": 3,
          "Cerberus Fang": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Elite Lycan Handguards",
        "stats": {
          "def": 10,
          "atk": 13
        },
        "durability": 151,
        "materials": {
          "Elite Lycan Pelt": 3,
          "Vampire Fang": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Elite Lycan Gauntlets Mk.2",
        "stats": {
          "def": 12,
          "atk": 16
        },
        "durability": 169,
        "materials": {
          "Elite Lycan Pelt": 3,
          "Ogre Horn": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "boots": [
      {"output":"Naga Coral Treads","stats":{"def":28,"bonus":28,"speed":4},"durability":180,"materials":{"Naga Coral Scale":2,"Gargoyle Sky Stone":2,"C-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Frost Wolf Greaves",
        "stats": {
          "def": 12,
          "speed": 14
        },
        "durability": 159,
        "materials": {
          "Frost Wolf Heart": 3,
          "Cerberus Fang": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cerberus Treads",
        "stats": {
          "def": 11,
          "speed": 13
        },
        "durability": 166,
        "materials": {
          "Cerberus Fang": 3,
          "Frost Wolf Heart": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cerberus Striders",
        "stats": {
          "def": 12,
          "speed": 14
        },
        "durability": 148,
        "materials": {
          "Cerberus Fang": 2,
          "Ogre Horn": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Vampire Sabatons",
        "stats": {
          "def": 11,
          "speed": 13
        },
        "durability": 169,
        "materials": {
          "Vampire Fang": 3,
          "Gargoyle Stone": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ant Boots",
        "stats": {
          "def": 11,
          "speed": 13
        },
        "durability": 163,
        "materials": {
          "Ant Chitin": 3,
          "High Orc Tusk": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Elite Lycan Greaves",
        "stats": {
          "def": 12,
          "speed": 14
        },
        "durability": 168,
        "materials": {
          "Elite Lycan Pelt": 2,
          "Ant Chitin": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "leggings": [
      {
        "output": "Ogre Legplates",
        "stats": {
          "def": 20,
          "hp": 84
        },
        "durability": 162,
        "materials": {
          "Ogre Horn": 2,
          "Ant Chitin": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cerberus Chausses",
        "stats": {
          "def": 20,
          "hp": 86
        },
        "durability": 166,
        "materials": {
          "Cerberus Fang": 3,
          "Elite Lycan Pelt": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Vampire Tassets",
        "stats": {
          "def": 19,
          "hp": 78
        },
        "durability": 148,
        "materials": {
          "Vampire Fang": 3,
          "Gargoyle Stone": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "High Orc Leggings",
        "stats": {
          "def": 20,
          "hp": 82
        },
        "durability": 159,
        "materials": {
          "High Orc Tusk": 2,
          "Frost Wolf Heart": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ogre Cuisses",
        "stats": {
          "def": 20,
          "hp": 85
        },
        "durability": 159,
        "materials": {
          "Ogre Horn": 2,
          "Ant Chitin": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ice Elf Bow Legplates",
        "stats": {
          "def": 22,
          "hp": 94
        },
        "durability": 153,
        "materials": {
          "Ice Elf Bow String": 2,
          "Frost Wolf Heart": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "accessories": [
      {"output":"Gargoyle Sky Charm","stats":{"atk":21,"def":21,"bonus":42,"critChance":2},"durability":180,"materials":{"Gargoyle Sky Stone":2,"Ant Warrior Plate":2,"C-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Ant Ring",
        "stats": {
          "atk": 11,
          "critChance": 4
        },
        "durability": 152,
        "materials": {
          "Ant Chitin": 3,
          "Vampire Fang": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Steel Golem Pendant",
        "stats": {
          "atk": 9,
          "critChance": 4
        },
        "durability": 164,
        "materials": {
          "Steel Golem Core": 2,
          "Ant Chitin": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Vampire Charm",
        "stats": {
          "atk": 9,
          "critChance": 4
        },
        "durability": 151,
        "materials": {
          "Vampire Fang": 3,
          "Naga Scale": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "High Orc Band",
        "stats": {
          "atk": 10,
          "critChance": 4
        },
        "durability": 149,
        "materials": {
          "High Orc Tusk": 3,
          "Cerberus Fang": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Vampire Talisman",
        "stats": {
          "atk": 10,
          "critChance": 4
        },
        "durability": 160,
        "materials": {
          "Vampire Fang": 3,
          "Kasaka Venom Gland": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Kasaka Venom Ring",
        "onHit": {"type": "poison", "chance": 35, "duration": 4},
        "stats": {
          "atk": 11,
          "critChance": 4
        },
        "durability": 152,
        "materials": {
          "Kasaka Venom Gland": 3,
          "High Orc Tusk": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "artifacts": [
      {
        "output": "Ice Elf Bow Core",
        "stats": {
          "atk": 23,
          "def": 12,
          "hp": 79
        },
        "durability": 166,
        "materials": {
          "Ice Elf Bow String": 2,
          "Naga Scale": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ice Elf Bow Idol",
        "stats": {
          "atk": 22,
          "def": 12,
          "hp": 76
        },
        "durability": 166,
        "materials": {
          "Ice Elf Bow String": 2,
          "Frost Wolf Heart": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Elite Lycan Relic",
        "stats": {
          "atk": 20,
          "def": 11,
          "hp": 70
        },
        "durability": 165,
        "materials": {
          "Elite Lycan Pelt": 3,
          "High Orc Tusk": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Frost Wolf Totem",
        "stats": {
          "atk": 20,
          "def": 11,
          "hp": 70
        },
        "durability": 159,
        "materials": {
          "Frost Wolf Heart": 2,
          "Vampire Fang": 1,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Naga Sigil",
        "stats": {
          "atk": 19,
          "def": 10,
          "hp": 66
        },
        "durability": 148,
        "materials": {
          "Naga Scale": 2,
          "Gargoyle Stone": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Steel Golem Core",
        "stats": {
          "atk": 23,
          "def": 13,
          "hp": 80
        },
        "durability": 158,
        "materials": {
          "Steel Golem Core": 3,
          "Kasaka Venom Gland": 2,
          "C-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ]
  },
  "Epic": {
    "weapons": [
      {"output":"Yeti Frost Blade","stats":{"atk":122,"bonus":122,"critChance":4},"durability":240,"materials":{"Yeti Frost Heart":3,"Wyvern Storm Scale":1,"B-Rank Mana Essence":1},"set":"sololeveling"},
      {"output":"Demon Blood Venom Edge","stats":{"atk":120,"bonus":120,"critChance":4},"durability":234,"materials":{"Demon Blood Ruby":3,"Yeti Frost Heart":1,"B-Rank Mana Essence":1},"set":"sololeveling","onHit":{"type":"poison","chance":40,"duration":4}},
      {
        "output": "Wyvern Wing Blade",
        "stats": {
          "atk": 117,
          "bonus": 117,
          "critChance": 8
        },
        "durability": 203,
        "materials": {
          "Wyvern Wing Membrane": 2,
          "Frost Giant Toe Bone": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cerberus Fang Sword Mk.2",
        "stats": {
          "atk": 129,
          "bonus": 129,
          "critChance": 8
        },
        "durability": 211,
        "materials": {
          "Cerberus Heart": 2,
          "Titan Lizard Scale": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ice Elf Greataxe",
        "stats": {
          "atk": 125,
          "bonus": 125,
          "critChance": 8
        },
        "durability": 216,
        "materials": {
          "Ice Elf Crystal": 3,
          "Yeti Fur": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Demon Bow Warstaff",
        "stats": {
          "atk": 128,
          "bonus": 128,
          "critChance": 8
        },
        "durability": 202,
        "materials": {
          "Demon Bow Sinew": 2,
          "Ice Elf Crystal": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Demon Bow Spear",
        "stats": {
          "atk": 131,
          "bonus": 131,
          "critChance": 9
        },
        "durability": 207,
        "materials": {
          "Demon Bow Sinew": 2,
          "Chieftain Tusk": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Iron Golem Blade",
        "stats": {
          "atk": 128,
          "bonus": 128,
          "critChance": 8
        },
        "durability": 219,
        "materials": {
          "Iron Golem Core": 3,
          "Frost Giant Toe Bone": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "helmet": [
      {"output":"Wyvern Storm Helm","stats":{"def":72,"bonus":72,"hp":240},"durability":240,"materials":{"Wyvern Storm Scale":3,"Titan Lizard Bone":1,"B-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Iron Golem Helm",
        "stats": {
          "def": 34,
          "hp": 138
        },
        "durability": 203,
        "materials": {
          "Iron Golem Core": 3,
          "Yeti Fur": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Demon Bow Crown",
        "stats": {
          "def": 35,
          "hp": 143
        },
        "durability": 204,
        "materials": {
          "Demon Bow Sinew": 2,
          "Iron Golem Core": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Chieftain Visor",
        "stats": {
          "def": 36,
          "hp": 146
        },
        "durability": 198,
        "materials": {
          "Chieftain Tusk": 2,
          "Demon Bow Sinew": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Yeti Hood",
        "stats": {
          "def": 30,
          "hp": 124
        },
        "durability": 220,
        "materials": {
          "Yeti Fur": 2,
          "Frost Giant Toe Bone": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Iron Golem Skullcap",
        "stats": {
          "def": 30,
          "hp": 121
        },
        "durability": 223,
        "materials": {
          "Iron Golem Core": 2,
          "Ant Soldier Mandible": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ant Soldier Helm",
        "stats": {
          "def": 36,
          "hp": 148
        },
        "durability": 222,
        "materials": {
          "Ant Soldier Mandible": 2,
          "Titan Lizard Scale": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "chest": [
      {"output":"Titan Lizard Plate","stats":{"def":108,"bonus":108,"hp":360},"durability":250,"materials":{"Titan Lizard Bone":4,"Wyvern Storm Scale":2,"B-Rank Mana Essence":2},"set":"sololeveling"},
      {
        "output": "Ant Soldier Plate",
        "stats": {
          "def": 43,
          "hp": 279
        },
        "durability": 202,
        "materials": {
          "Ant Soldier Mandible": 2,
          "Wyvern Wing Membrane": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Iron Golem Cuirass",
        "stats": {
          "def": 41,
          "hp": 263
        },
        "durability": 211,
        "materials": {
          "Iron Golem Core": 3,
          "Titan Lizard Scale": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ice Elf Mantle",
        "stats": {
          "def": 38,
          "hp": 247
        },
        "durability": 207,
        "materials": {
          "Ice Elf Crystal": 2,
          "Wyvern Wing Membrane": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Yeti Carapace Armor",
        "stats": {
          "def": 41,
          "hp": 267
        },
        "durability": 221,
        "materials": {
          "Yeti Fur": 2,
          "Ice Elf Crystal": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Frost Giant Toe Robe",
        "stats": {
          "def": 38,
          "hp": 246
        },
        "durability": 216,
        "materials": {
          "Frost Giant Toe Bone": 2,
          "Demon Bow Sinew": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Cerberus Plate",
        "stats": {
          "def": 44,
          "hp": 288
        },
        "durability": 224,
        "materials": {
          "Cerberus Heart": 2,
          "Ant Mage Antenna": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "gloves": [
      {
        "output": "Ice Elf Gauntlets",
        "stats": {
          "def": 18,
          "atk": 22
        },
        "durability": 202,
        "materials": {
          "Ice Elf Crystal": 2,
          "Demon Horn": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Frost Giant Toe Grips",
        "stats": {
          "def": 19,
          "atk": 23
        },
        "durability": 201,
        "materials": {
          "Frost Giant Toe Bone": 2,
          "Yeti Fur": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Wyvern Wing Claws",
        "stats": {
          "def": 20,
          "atk": 24
        },
        "durability": 208,
        "materials": {
          "Wyvern Wing Membrane": 2,
          "Demon Bow Sinew": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Titan Lizard Bracers",
        "stats": {
          "def": 23,
          "atk": 27
        },
        "durability": 210,
        "materials": {
          "Titan Lizard Scale": 3,
          "Demon Horn": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ant Mage Handguards",
        "stats": {
          "def": 22,
          "atk": 27
        },
        "durability": 208,
        "materials": {
          "Ant Mage Antenna": 2,
          "Frost Giant Toe Bone": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Yeti Gauntlets",
        "stats": {
          "def": 20,
          "atk": 24
        },
        "durability": 199,
        "materials": {
          "Yeti Fur": 2,
          "Chieftain Tusk": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "boots": [
      {"output":"Yeti Frost Treads","stats":{"def":48,"bonus":48,"speed":6},"durability":240,"materials":{"Yeti Frost Heart":2,"Demon Blood Ruby":2,"B-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Yeti Greaves",
        "stats": {
          "def": 20,
          "speed": 24
        },
        "durability": 222,
        "materials": {
          "Yeti Fur": 2,
          "Ice Elf Crystal": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Iron Golem Treads",
        "stats": {
          "def": 20,
          "speed": 24
        },
        "durability": 219,
        "materials": {
          "Iron Golem Core": 2,
          "Ant Mage Antenna": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ice Elf Striders",
        "stats": {
          "def": 21,
          "speed": 25
        },
        "durability": 215,
        "materials": {
          "Ice Elf Crystal": 2,
          "Ant Mage Antenna": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Wyvern Wing Sabatons",
        "stats": {
          "def": 22,
          "speed": 26
        },
        "durability": 224,
        "materials": {
          "Wyvern Wing Membrane": 3,
          "Demon Bow Sinew": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Demon Bow Boots",
        "stats": {
          "def": 22,
          "speed": 26
        },
        "durability": 220,
        "materials": {
          "Demon Bow Sinew": 3,
          "Yeti Fur": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Iron Golem Greaves",
        "stats": {
          "def": 21,
          "speed": 25
        },
        "durability": 217,
        "materials": {
          "Iron Golem Core": 3,
          "Yeti Fur": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "leggings": [
      {
        "output": "Titan Lizard Legplates",
        "stats": {
          "def": 36,
          "hp": 156
        },
        "durability": 207,
        "materials": {
          "Titan Lizard Scale": 3,
          "Cerberus Heart": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ant Mage Chausses",
        "stats": {
          "def": 39,
          "hp": 168
        },
        "durability": 219,
        "materials": {
          "Ant Mage Antenna": 2,
          "Demon Bow Sinew": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Iron Golem Tassets",
        "stats": {
          "def": 33,
          "hp": 141
        },
        "durability": 225,
        "materials": {
          "Iron Golem Core": 3,
          "Yeti Fur": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ant Mage Leggings",
        "stats": {
          "def": 34,
          "hp": 147
        },
        "durability": 205,
        "materials": {
          "Ant Mage Antenna": 2,
          "Ant Soldier Mandible": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Demon Bow Cuisses",
        "stats": {
          "def": 35,
          "hp": 150
        },
        "durability": 221,
        "materials": {
          "Demon Bow Sinew": 3,
          "Iron Golem Core": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ant Mage Legplates",
        "stats": {
          "def": 36,
          "hp": 157
        },
        "durability": 195,
        "materials": {
          "Ant Mage Antenna": 3,
          "Yeti Fur": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "accessories": [
      {"output":"Demon Blood Charm","stats":{"atk":36,"def":36,"bonus":72,"critChance":2},"durability":240,"materials":{"Demon Blood Ruby":2,"Titan Lizard Bone":2,"B-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Ant Mage Ring",
        "stats": {
          "atk": 19,
          "critChance": 7
        },
        "durability": 198,
        "materials": {
          "Ant Mage Antenna": 2,
          "Frost Giant Toe Bone": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Chieftain Pendant",
        "stats": {
          "atk": 18,
          "critChance": 7
        },
        "durability": 195,
        "materials": {
          "Chieftain Tusk": 3,
          "Ice Elf Crystal": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Frost Giant Toe Charm",
        "stats": {
          "atk": 20,
          "critChance": 8
        },
        "durability": 208,
        "materials": {
          "Frost Giant Toe Bone": 3,
          "Cerberus Heart": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ant Soldier Band",
        "stats": {
          "atk": 17,
          "critChance": 7
        },
        "durability": 213,
        "materials": {
          "Ant Soldier Mandible": 3,
          "Demon Horn": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Demon Bow Talisman",
        "stats": {
          "atk": 19,
          "critChance": 7
        },
        "durability": 203,
        "materials": {
          "Demon Bow Sinew": 2,
          "Cerberus Heart": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Yeti Ring",
        "stats": {
          "atk": 19,
          "critChance": 7
        },
        "durability": 198,
        "materials": {
          "Yeti Fur": 2,
          "Ant Soldier Mandible": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ],
    "artifacts": [
      {
        "output": "Chieftain Core",
        "stats": {
          "atk": 42,
          "def": 23,
          "hp": 148
        },
        "durability": 217,
        "materials": {
          "Chieftain Tusk": 2,
          "Demon Bow Sinew": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ice Elf Idol",
        "stats": {
          "atk": 34,
          "def": 19,
          "hp": 121
        },
        "durability": 209,
        "materials": {
          "Ice Elf Crystal": 3,
          "Wyvern Wing Membrane": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Chieftain Relic",
        "stats": {
          "atk": 38,
          "def": 21,
          "hp": 134
        },
        "durability": 195,
        "materials": {
          "Chieftain Tusk": 2,
          "Ant Mage Antenna": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ant Soldier Totem",
        "stats": {
          "atk": 36,
          "def": 19,
          "hp": 126
        },
        "durability": 222,
        "materials": {
          "Ant Soldier Mandible": 2,
          "Iron Golem Core": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Demon Sigil",
        "stats": {
          "atk": 42,
          "def": 23,
          "hp": 146
        },
        "durability": 222,
        "materials": {
          "Demon Horn": 2,
          "Titan Lizard Scale": 2,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      },
      {
        "output": "Ice Elf Core",
        "stats": {
          "atk": 34,
          "def": 18,
          "hp": 119
        },
        "durability": 208,
        "materials": {
          "Ice Elf Crystal": 3,
          "Demon Horn": 1,
          "B-Rank Mana Essence": 1
        },
        "set": "sololeveling"
      }
    ]
  },
  "Legendary": {
    "weapons": [
      {"output":"Igris Crimson Blade","stats":{"atk":202,"bonus":202,"critChance":6},"durability":320,"materials":{"Igris Crimson Plume":3,"Kargalgan Shaman Bone":1,"A-Rank Mana Essence":1},"set":"sololeveling"},
      {"output":"Vulcan Molten Venom Edge","stats":{"atk":200,"bonus":200,"critChance":6},"durability":314,"materials":{"Vulcan Molten Core":3,"Igris Crimson Plume":1,"A-Rank Mana Essence":1},"set":"sololeveling","onHit":{"type":"poison","chance":40,"duration":4}},
      {
        "output": "Elder Wyvern Blade",
        "stats": {
          "atk": 248,
          "bonus": 248,
          "critChance": 17
        },
        "durability": 298,
        "materials": {
          "Elder Wyvern Fang": 2,
          "Metus Cloak Thread": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Igris Blood Fang Sword",
        "stats": {
          "atk": 228,
          "bonus": 228,
          "critChance": 16
        },
        "durability": 304,
        "materials": {
          "Igris Blood Steel": 2,
          "Tusk Lord Ivory": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Vulcan Greataxe",
        "stats": {
          "atk": 208,
          "bonus": 208,
          "critChance": 14
        },
        "durability": 328,
        "materials": {
          "Vulcan Horn": 3,
          "Frost Giant Heart": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Igris Blood Warstaff",
        "stats": {
          "atk": 206,
          "bonus": 206,
          "critChance": 14
        },
        "durability": 320,
        "materials": {
          "Igris Blood Steel": 3,
          "Vulcan Horn": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Metus Cloak Spear",
        "stats": {
          "atk": 229,
          "bonus": 229,
          "critChance": 16
        },
        "durability": 318,
        "materials": {
          "Metus Cloak Thread": 2,
          "Vanguard Chitin": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Frost Giant Blade",
        "stats": {
          "atk": 214,
          "bonus": 214,
          "critChance": 15
        },
        "durability": 329,
        "materials": {
          "Frost Giant Heart": 3,
          "Vulcan Horn": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      }
    ],
    "helmet": [
      {"output":"Kargalgan Shaman Helm","stats":{"def":120,"bonus":120,"hp":400},"durability":320,"materials":{"Kargalgan Shaman Bone":3,"Elder Wyvern Eye":1,"A-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Knight Remnant Helm",
        "stats": {
          "def": 63,
          "hp": 269
        },
        "durability": 303,
        "materials": {
          "Knight Remnant Plate": 3,
          "Tank Bear Hide": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Vanguard Crown",
        "stats": {
          "def": 53,
          "hp": 228
        },
        "durability": 306,
        "materials": {
          "Vanguard Chitin": 2,
          "Frost Giant Heart": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Knight Remnant Visor",
        "stats": {
          "def": 54,
          "hp": 233
        },
        "durability": 309,
        "materials": {
          "Knight Remnant Plate": 3,
          "Frost Giant Heart": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Tusk Lord Hood",
        "stats": {
          "def": 54,
          "hp": 232
        },
        "durability": 323,
        "materials": {
          "Tusk Lord Ivory": 2,
          "Royal Guard Carapace": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Elder Wyvern Skullcap",
        "stats": {
          "def": 60,
          "hp": 257
        },
        "durability": 322,
        "materials": {
          "Elder Wyvern Fang": 3,
          "Vanguard Chitin": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Tank Bear Helm",
        "stats": {
          "def": 57,
          "hp": 246
        },
        "durability": 327,
        "materials": {
          "Tank Bear Hide": 3,
          "Elder Wyvern Fang": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      }
    ],
    "chest": [
      {"output":"Elder Wyvern Plate","stats":{"def":180,"bonus":180,"hp":600},"durability":330,"materials":{"Elder Wyvern Eye":4,"Kargalgan Shaman Bone":2,"A-Rank Mana Essence":2},"set":"sololeveling"},
      {
        "output": "Frost Giant Plate",
        "stats": {
          "def": 71,
          "hp": 488
        },
        "durability": 334,
        "materials": {
          "Frost Giant Heart": 2,
          "Knight Remnant Plate": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Baruka Frost Cuirass",
        "stats": {
          "def": 80,
          "hp": 547
        },
        "durability": 326,
        "materials": {
          "Baruka Frost Crystal": 2,
          "Tank Bear Hide": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Vulcan Mantle",
        "stats": {
          "def": 69,
          "hp": 475
        },
        "durability": 319,
        "materials": {
          "Vulcan Horn": 2,
          "Igris Blood Steel": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Knight Remnant Carapace Armor",
        "stats": {
          "def": 67,
          "hp": 456
        },
        "durability": 333,
        "materials": {
          "Knight Remnant Plate": 2,
          "Metus Cloak Thread": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Igris Blood Robe",
        "stats": {
          "def": 70,
          "hp": 483
        },
        "durability": 323,
        "materials": {
          "Igris Blood Steel": 3,
          "Royal Guard Carapace": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Kargalgan Totem Plate",
        "stats": {
          "def": 80,
          "hp": 550
        },
        "durability": 312,
        "materials": {
          "Kargalgan Totem Wood": 3,
          "Vanguard Chitin": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      }
    ],
    "gloves": [
      {
        "output": "Vanguard Gauntlets",
        "stats": {
          "def": 39,
          "atk": 50
        },
        "durability": 325,
        "materials": {
          "Vanguard Chitin": 3,
          "Knight Remnant Plate": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Knight Remnant Grips",
        "stats": {
          "def": 34,
          "atk": 43
        },
        "durability": 309,
        "materials": {
          "Knight Remnant Plate": 3,
          "Tank Bear Hide": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Vanguard Claws",
        "stats": {
          "def": 35,
          "atk": 44
        },
        "durability": 314,
        "materials": {
          "Vanguard Chitin": 2,
          "Kargalgan Totem Wood": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Baruka Frost Bracers",
        "stats": {
          "def": 38,
          "atk": 47
        },
        "durability": 319,
        "materials": {
          "Baruka Frost Crystal": 3,
          "Tank Bear Hide": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Baruka Frost Handguards",
        "stats": {
          "def": 38,
          "atk": 48
        },
        "durability": 308,
        "materials": {
          "Baruka Frost Crystal": 2,
          "Metus Cloak Thread": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Royal Guard Gauntlets",
        "stats": {
          "def": 39,
          "atk": 49
        },
        "durability": 301,
        "materials": {
          "Royal Guard Carapace": 2,
          "Tusk Lord Ivory": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      }
    ],
    "boots": [
      {"output":"Igris Crimson Treads","stats":{"def":80,"bonus":80,"speed":8},"durability":320,"materials":{"Igris Crimson Plume":2,"Vulcan Molten Core":2,"A-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Vulcan Greaves",
        "stats": {
          "def": 36,
          "speed": 44
        },
        "durability": 334,
        "materials": {
          "Vulcan Horn": 3,
          "Knight Remnant Plate": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Vulcan Treads",
        "stats": {
          "def": 34,
          "speed": 40
        },
        "durability": 296,
        "materials": {
          "Vulcan Horn": 2,
          "Royal Guard Carapace": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Metus Cloak Striders",
        "stats": {
          "def": 38,
          "speed": 45
        },
        "durability": 302,
        "materials": {
          "Metus Cloak Thread": 2,
          "Elder Wyvern Fang": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Knight Remnant Sabatons",
        "stats": {
          "def": 40,
          "speed": 48
        },
        "durability": 312,
        "materials": {
          "Knight Remnant Plate": 2,
          "Igris Blood Steel": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Frost Giant Boots",
        "stats": {
          "def": 40,
          "speed": 48
        },
        "durability": 309,
        "materials": {
          "Frost Giant Heart": 3,
          "Tank Bear Hide": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Vulcan Greaves Mk.2",
        "stats": {
          "def": 39,
          "speed": 47
        },
        "durability": 330,
        "materials": {
          "Vulcan Horn": 3,
          "Baruka Frost Crystal": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      }
    ],
    "leggings": [
      {
        "output": "Knight Remnant Legplates",
        "stats": {
          "def": 71,
          "hp": 323
        },
        "durability": 311,
        "materials": {
          "Knight Remnant Plate": 2,
          "Metus Cloak Thread": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Tusk Lord Chausses",
        "stats": {
          "def": 65,
          "hp": 299
        },
        "durability": 326,
        "materials": {
          "Tusk Lord Ivory": 2,
          "Tank Bear Hide": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Elder Wyvern Tassets",
        "stats": {
          "def": 58,
          "hp": 267
        },
        "durability": 297,
        "materials": {
          "Elder Wyvern Fang": 3,
          "Vulcan Horn": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Royal Guard Leggings",
        "stats": {
          "def": 57,
          "hp": 261
        },
        "durability": 302,
        "materials": {
          "Royal Guard Carapace": 2,
          "Knight Remnant Plate": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Kargalgan Totem Cuisses",
        "stats": {
          "def": 65,
          "hp": 298
        },
        "durability": 317,
        "materials": {
          "Kargalgan Totem Wood": 2,
          "Knight Remnant Plate": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Igris Blood Legplates",
        "stats": {
          "def": 62,
          "hp": 282
        },
        "durability": 317,
        "materials": {
          "Igris Blood Steel": 2,
          "Tusk Lord Ivory": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      }
    ],
    "accessories": [
      {"output":"Vulcan Molten Charm","stats":{"atk":60,"def":60,"bonus":120,"critChance":2},"durability":320,"materials":{"Vulcan Molten Core":2,"Elder Wyvern Eye":2,"A-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Vulcan Ring",
        "stats": {
          "atk": 35,
          "critChance": 13
        },
        "durability": 316,
        "materials": {
          "Vulcan Horn": 3,
          "Vanguard Chitin": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Vanguard Pendant",
        "stats": {
          "atk": 30,
          "critChance": 11
        },
        "durability": 302,
        "materials": {
          "Vanguard Chitin": 3,
          "Kargalgan Totem Wood": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Tank Bear Charm",
        "stats": {
          "atk": 30,
          "critChance": 11
        },
        "durability": 293,
        "materials": {
          "Tank Bear Hide": 2,
          "Vulcan Horn": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Igris Blood Band",
        "stats": {
          "atk": 31,
          "critChance": 11
        },
        "durability": 295,
        "materials": {
          "Igris Blood Steel": 3,
          "Metus Cloak Thread": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Tusk Lord Talisman",
        "stats": {
          "atk": 30,
          "critChance": 11
        },
        "durability": 328,
        "materials": {
          "Tusk Lord Ivory": 3,
          "Igris Blood Steel": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Knight Remnant Ring",
        "stats": {
          "atk": 30,
          "critChance": 11
        },
        "durability": 298,
        "materials": {
          "Knight Remnant Plate": 2,
          "Vanguard Chitin": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      }
    ],
    "artifacts": [
      {
        "output": "Kargalgan Totem Core",
        "stats": {
          "atk": 70,
          "def": 37,
          "hp": 256
        },
        "durability": 330,
        "materials": {
          "Kargalgan Totem Wood": 3,
          "Knight Remnant Plate": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Kargalgan Totem Idol",
        "stats": {
          "atk": 68,
          "def": 36,
          "hp": 248
        },
        "durability": 295,
        "materials": {
          "Kargalgan Totem Wood": 2,
          "Tank Bear Hide": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Tusk Lord Relic",
        "stats": {
          "atk": 71,
          "def": 38,
          "hp": 260
        },
        "durability": 293,
        "materials": {
          "Tusk Lord Ivory": 2,
          "Frost Giant Heart": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Vanguard Totem",
        "stats": {
          "atk": 67,
          "def": 35,
          "hp": 242
        },
        "durability": 313,
        "materials": {
          "Vanguard Chitin": 3,
          "Kargalgan Totem Wood": 2,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Knight Remnant Sigil",
        "stats": {
          "atk": 61,
          "def": 32,
          "hp": 220
        },
        "durability": 304,
        "materials": {
          "Knight Remnant Plate": 3,
          "Frost Giant Heart": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      },
      {
        "output": "Vanguard Core",
        "stats": {
          "atk": 74,
          "def": 39,
          "hp": 271
        },
        "durability": 291,
        "materials": {
          "Vanguard Chitin": 2,
          "Metus Cloak Thread": 1,
          "A-Rank Mana Essence": 2
        },
        "set": "sololeveling"
      }
    ]
  },
  "Mythic": {
    "weapons": [
      {"output":"Beru Royal Blade","stats":{"atk":342,"bonus":342,"critChance":9},"durability":420,"materials":{"Beru Royal Chitin":3,"Kamish Void Fang":1,"S-Rank Mana Essence":1},"set":"sololeveling"},
      {"output":"Antares Star Venom Edge","stats":{"atk":340,"bonus":340,"critChance":9},"durability":414,"materials":{"Antares Star Scale":3,"Beru Royal Chitin":1,"S-Rank Mana Essence":1},"set":"sololeveling","onHit":{"type":"poison","chance":40,"duration":4}},
      {
        "output": "Monarch Shadow Blade",
        "stats": {
          "atk": 346,
          "bonus": 346,
          "critChance": 23
        },
        "durability": 418,
        "materials": {
          "Monarch Shadow Fragment": 2,
          "Rulers’ Light Shard": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Rulers’ Light Fang Sword",
        "stats": {
          "atk": 387,
          "bonus": 387,
          "critChance": 26
        },
        "durability": 396,
        "materials": {
          "Rulers’ Light Shard": 2,
          "Plague Queen Venom": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Ant King Greataxe",
        "stats": {
          "atk": 346,
          "bonus": 346,
          "critChance": 23
        },
        "durability": 434,
        "materials": {
          "Ant King Mandible": 2,
          "Antares Dragon Heart": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Monarch Shadow Warstaff",
        "stats": {
          "atk": 389,
          "bonus": 389,
          "critChance": 26
        },
        "durability": 425,
        "materials": {
          "Monarch Shadow Fragment": 2,
          "Rakan Beast Fur": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Transfiguration Spear",
        "stats": {
          "atk": 338,
          "bonus": 338,
          "critChance": 23
        },
        "durability": 420,
        "materials": {
          "Transfiguration Core": 3,
          "Bellion Sovereign Steel": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Rulers’ Light Blade",
        "stats": {
          "atk": 321,
          "bonus": 321,
          "critChance": 22
        },
        "durability": 398,
        "materials": {
          "Rulers’ Light Shard": 2,
          "Transfiguration Core": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      }
    ],
    "helmet": [
      {"output":"Kamish Void Helm","stats":{"def":204,"bonus":204,"hp":680},"durability":420,"materials":{"Kamish Void Fang":3,"Monarch Abyss Crystal":1,"S-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Destruction Beast Helm",
        "stats": {
          "def": 99,
          "hp": 452
        },
        "durability": 389,
        "materials": {
          "Destruction Beast Claw": 2,
          "Legia Eternal Ice": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Legia Eternal Crown",
        "stats": {
          "def": 98,
          "hp": 444
        },
        "durability": 419,
        "materials": {
          "Legia Eternal Ice": 3,
          "Destruction Beast Claw": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Antares Dragon Visor",
        "stats": {
          "def": 94,
          "hp": 429
        },
        "durability": 428,
        "materials": {
          "Antares Dragon Heart": 2,
          "Demon King Horn": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Rakan Beast Hood",
        "stats": {
          "def": 100,
          "hp": 453
        },
        "durability": 390,
        "materials": {
          "Rakan Beast Fur": 2,
          "Antares Dragon Heart": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Kamish Dragon Skullcap",
        "stats": {
          "def": 82,
          "hp": 372
        },
        "durability": 435,
        "materials": {
          "Kamish Dragon Scale": 3,
          "Legia Eternal Ice": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Bellion Sovereign Helm",
        "stats": {
          "def": 80,
          "hp": 362
        },
        "durability": 391,
        "materials": {
          "Bellion Sovereign Steel": 2,
          "Plague Queen Venom": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      }
    ],
    "chest": [
      {"output":"Monarch Abyss Plate","stats":{"def":306,"bonus":306,"hp":1020},"durability":430,"materials":{"Monarch Abyss Crystal":4,"Kamish Void Fang":2,"S-Rank Mana Essence":2},"set":"sololeveling"},
      {
        "output": "Ant King Plate",
        "stats": {
          "def": 110,
          "hp": 802
        },
        "durability": 397,
        "materials": {
          "Ant King Mandible": 2,
          "Rakan Beast Fur": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Bellion Sovereign Cuirass",
        "stats": {
          "def": 104,
          "hp": 757
        },
        "durability": 411,
        "materials": {
          "Bellion Sovereign Steel": 2,
          "Demon King Horn": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Kamish Dragon Mantle",
        "stats": {
          "def": 105,
          "hp": 766
        },
        "durability": 383,
        "materials": {
          "Kamish Dragon Scale": 3,
          "Rulers’ Light Shard": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Rulers’ Light Carapace Armor",
        "stats": {
          "def": 111,
          "hp": 804
        },
        "durability": 427,
        "materials": {
          "Rulers’ Light Shard": 2,
          "Bellion Sovereign Steel": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Destruction Beast Robe",
        "stats": {
          "def": 115,
          "hp": 838
        },
        "durability": 427,
        "materials": {
          "Destruction Beast Claw": 3,
          "Kamish Dragon Scale": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Legia Eternal Plate",
        "stats": {
          "def": 113,
          "hp": 821
        },
        "durability": 385,
        "materials": {
          "Legia Eternal Ice": 2,
          "Kamish Dragon Scale": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      }
    ],
    "gloves": [
      {
        "output": "Rakan Beast Gauntlets",
        "stats": {
          "def": 62,
          "atk": 77
        },
        "durability": 417,
        "materials": {
          "Rakan Beast Fur": 2,
          "Monarch Shadow Fragment": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Demon King Grips",
        "stats": {
          "def": 62,
          "atk": 76
        },
        "durability": 403,
        "materials": {
          "Demon King Horn": 2,
          "Destruction Beast Claw": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Bellion Sovereign Claws",
        "stats": {
          "def": 63,
          "atk": 78
        },
        "durability": 391,
        "materials": {
          "Bellion Sovereign Steel": 3,
          "Demon King Horn": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Plague Queen Bracers",
        "stats": {
          "def": 50,
          "atk": 62
        },
        "durability": 438,
        "materials": {
          "Plague Queen Venom": 3,
          "Bellion Sovereign Steel": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Destruction Beast Handguards",
        "stats": {
          "def": 50,
          "atk": 62
        },
        "durability": 386,
        "materials": {
          "Destruction Beast Claw": 3,
          "Bellion Sovereign Steel": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Rakan Beast Gauntlets Mk.2",
        "stats": {
          "def": 58,
          "atk": 71
        },
        "durability": 410,
        "materials": {
          "Rakan Beast Fur": 2,
          "Bellion Sovereign Steel": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      }
    ],
    "boots": [
      {"output":"Beru Royal Treads","stats":{"def":136,"bonus":136,"speed":13},"durability":420,"materials":{"Beru Royal Chitin":2,"Antares Star Scale":2,"S-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Ant King Greaves",
        "stats": {
          "def": 52,
          "speed": 63
        },
        "durability": 418,
        "materials": {
          "Ant King Mandible": 3,
          "Kamish Dragon Scale": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Rakan Beast Treads",
        "stats": {
          "def": 58,
          "speed": 70
        },
        "durability": 420,
        "materials": {
          "Rakan Beast Fur": 2,
          "Demon King Horn": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Kamish Dragon Striders",
        "stats": {
          "def": 59,
          "speed": 71
        },
        "durability": 435,
        "materials": {
          "Kamish Dragon Scale": 2,
          "Bellion Sovereign Steel": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Bellion Sovereign Sabatons",
        "stats": {
          "def": 59,
          "speed": 70
        },
        "durability": 402,
        "materials": {
          "Bellion Sovereign Steel": 2,
          "Antares Dragon Heart": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Legia Eternal Boots",
        "stats": {
          "def": 50,
          "speed": 60
        },
        "durability": 413,
        "materials": {
          "Legia Eternal Ice": 3,
          "Antares Dragon Heart": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Rulers’ Light Greaves",
        "stats": {
          "def": 56,
          "speed": 67
        },
        "durability": 431,
        "materials": {
          "Rulers’ Light Shard": 2,
          "Destruction Beast Claw": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      }
    ],
    "leggings": [
      {
        "output": "Demon King Legplates",
        "stats": {
          "def": 102,
          "hp": 494
        },
        "durability": 425,
        "materials": {
          "Demon King Horn": 2,
          "Rakan Beast Fur": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Bellion Sovereign Chausses",
        "stats": {
          "def": 101,
          "hp": 488
        },
        "durability": 401,
        "materials": {
          "Bellion Sovereign Steel": 2,
          "Rakan Beast Fur": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Transfiguration Tassets",
        "stats": {
          "def": 103,
          "hp": 501
        },
        "durability": 427,
        "materials": {
          "Transfiguration Core": 2,
          "Destruction Beast Claw": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Rakan Beast Leggings",
        "stats": {
          "def": 97,
          "hp": 471
        },
        "durability": 417,
        "materials": {
          "Rakan Beast Fur": 3,
          "Bellion Sovereign Steel": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Legia Eternal Cuisses",
        "stats": {
          "def": 104,
          "hp": 503
        },
        "durability": 397,
        "materials": {
          "Legia Eternal Ice": 3,
          "Antares Dragon Heart": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Ant King Legplates",
        "stats": {
          "def": 111,
          "hp": 540
        },
        "durability": 380,
        "materials": {
          "Ant King Mandible": 3,
          "Plague Queen Venom": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      }
    ],
    "accessories": [
      {"output":"Antares Star Charm","stats":{"atk":102,"def":102,"bonus":204,"critChance":2},"durability":420,"materials":{"Antares Star Scale":2,"Monarch Abyss Crystal":2,"S-Rank Mana Essence":1},"set":"sololeveling"},
      {
        "output": "Destruction Beast Ring",
        "stats": {
          "atk": 46,
          "critChance": 16
        },
        "durability": 429,
        "materials": {
          "Destruction Beast Claw": 3,
          "Monarch Shadow Fragment": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Rulers’ Light Pendant",
        "stats": {
          "atk": 47,
          "critChance": 17
        },
        "durability": 415,
        "materials": {
          "Rulers’ Light Shard": 3,
          "Antares Dragon Heart": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Demon King Charm",
        "stats": {
          "atk": 48,
          "critChance": 17
        },
        "durability": 418,
        "materials": {
          "Demon King Horn": 3,
          "Plague Queen Venom": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Demon King Band",
        "stats": {
          "atk": 47,
          "critChance": 17
        },
        "durability": 430,
        "materials": {
          "Demon King Horn": 2,
          "Transfiguration Core": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Plague Queen Talisman",
        "onHit": {"type": "poison", "chance": 35, "duration": 4},
        "stats": {
          "atk": 46,
          "critChance": 16
        },
        "durability": 404,
        "materials": {
          "Plague Queen Venom": 3,
          "Rulers’ Light Shard": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Kamish Dragon Ring",
        "stats": {
          "atk": 47,
          "critChance": 17
        },
        "durability": 388,
        "materials": {
          "Kamish Dragon Scale": 2,
          "Rakan Beast Fur": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      }
    ],
    "artifacts": [
      {
        "output": "Bellion Sovereign Core",
        "stats": {
          "atk": 110,
          "def": 60,
          "hp": 433
        },
        "durability": 385,
        "materials": {
          "Bellion Sovereign Steel": 2,
          "Destruction Beast Claw": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Rakan Beast Idol",
        "stats": {
          "atk": 99,
          "def": 53,
          "hp": 389
        },
        "durability": 384,
        "materials": {
          "Rakan Beast Fur": 3,
          "Rulers’ Light Shard": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Antares Dragon Relic",
        "stats": {
          "atk": 98,
          "def": 53,
          "hp": 383
        },
        "durability": 417,
        "materials": {
          "Antares Dragon Heart": 2,
          "Transfiguration Core": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Destruction Beast Totem",
        "stats": {
          "atk": 117,
          "def": 63,
          "hp": 457
        },
        "durability": 406,
        "materials": {
          "Destruction Beast Claw": 3,
          "Monarch Shadow Fragment": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Monarch Shadow Sigil",
        "stats": {
          "atk": 103,
          "def": 56,
          "hp": 404
        },
        "durability": 411,
        "materials": {
          "Monarch Shadow Fragment": 3,
          "Demon King Horn": 2,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      },
      {
        "output": "Legia Eternal Core",
        "stats": {
          "atk": 96,
          "def": 52,
          "hp": 377
        },
        "durability": 423,
        "materials": {
          "Legia Eternal Ice": 2,
          "Plague Queen Venom": 1,
          "S-Rank Mana Essence": 3
        },
        "set": "sololeveling"
      }
    ]
  }
};

module.exports = SL_RECIPES;
