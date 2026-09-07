// MYTHIC RECIPES — Astra (EXPANDED 250)

const weapons = [
  {
    "output": "Void God Annihilator",
    "stats": {
      "atk": 420,
      "bonus": 420,
      "critChance": 18,
      "lifesteal": 10,
      "magicPower": 120
    },
    "durability": 500,
    "rarity": "mythic",
    "lore": "\"Forged from the corpse of a dead god. It does not cut — it erases.\"",
    "materials": {
      "God Corpse Fragment": 3,
      "Void Titan Core": 2,
      "Primordial Alloy": 3,
      "Eternal Metal": 2,
      "Null Metal": 3
    }
  },
  {
    "output": "World Ender Blade",
    "stats": {
      "atk": 450,
      "bonus": 450,
      "critChance": 20,
      "speed": 30
    },
    "durability": 520,
    "rarity": "mythic",
    "lore": "\"Seven civilizations ended under this sword. The eighth shattered trying to seal it.\"",
    "materials": {
      "World Crack Shard": 4,
      "Chaos God Shard": 2,
      "Chaos Steel": 4,
      "God-Forged Iron": 3
    }
  },
  {
    "output": "Primordial Chaos Lance",
    "stats": {
      "atk": 400,
      "bonus": 400,
      "magicPower": 180,
      "critChance": 15
    },
    "durability": 490,
    "rarity": "mythic",
    "lore": "\"Made before the concept of order existed. Reality bends around its tip.\"",
    "materials": {
      "Primordial Heart": 3,
      "Reality Tear": 4,
      "Chaos Steel": 3,
      "Dragon God Bone": 2
    }
  },
  {
    "output": "Eternal Sovereign Scythe",
    "stats": {
      "atk": 410,
      "bonus": 410,
      "lifesteal": 14,
      "magicPower": 100
    },
    "durability": 500,
    "rarity": "mythic",
    "lore": "\"It was once wielded by the God of Death. Then the God of Death died.\"",
    "materials": {
      "Eternal Flame": 3,
      "Sovereign Eye": 2,
      "Eternal Metal": 4,
      "Null Metal": 3
    }
  },
  {
    "output": "Abyss God Shard Blade",
    "stats": {
      "atk": 430,
      "bonus": 430,
      "critChance": 19,
      "speed": 25
    },
    "durability": 510,
    "rarity": "mythic",
    "lore": "\"Shards of the Abyss God's own bones. Every swing tears open a rift.\"",
    "materials": {
      "Abyss God Eye": 3,
      "Divine Abyss Shard": 3,
      "Void Alloy": 4,
      "God-Forged Iron": 2
    }
  },
  {
    "output": "Dragon God Sovereign Maul",
    "stats": {
      "atk": 460,
      "bonus": 460,
      "hp": 500
    },
    "durability": 540,
    "rarity": "mythic",
    "lore": "\"The last Dragon God crushed mountains with this. Now it rests in mortal hands.\"",
    "materials": {
      "Dragon God Bone": 5,
      "Dragon King Heart": 2,
      "Eternal Metal": 3,
      "Primordial Alloy": 3
    }
  },
  {
    "output": "Fractured Divine Core Staff",
    "stats": {
      "atk": 380,
      "bonus": 380,
      "magicPower": 220,
      "critChance": 14
    },
    "durability": 480,
    "rarity": "mythic",
    "lore": "\"The core of a shattered divine being. Magic leaks from its cracks constantly.\"",
    "materials": {
      "Fractured Divine Core": 4,
      "God Essence Trace": 3,
      "Primordial Alloy": 3,
      "Chaos Steel": 2
    }
  },
  {
    "output": "Null Void Executioner",
    "stats": {
      "atk": 440,
      "bonus": 440,
      "critChance": 17,
      "lifesteal": 8
    },
    "durability": 510,
    "rarity": "mythic",
    "lore": "\"Nullifies all defense. Nullifies all hope. Nullifies the very will to resist.\"",
    "materials": {
      "Null Metal": 5,
      "Nullification Mana Stone": 3,
      "Void Titan Core": 2,
      "God-Forged Iron": 3
    }
  },
  {
    "output": "Ancient Dragon Sovereign Claw",
    "stats": {
      "atk": 415,
      "bonus": 415,
      "speed": 40,
      "critChance": 18
    },
    "durability": 500,
    "rarity": "mythic",
    "lore": "\"Ripped from the Ancient Dragon King's right foreleg. Still warm. Always will be.\"",
    "materials": {
      "Ancient Void Dragon Heart": 2,
      "Dragon God Bone": 3,
      "Eternal Metal": 3,
      "Primordial Alloy": 2
    }
  },
  {
    "output": "Oblivion Annihilator Blade",
    "stats": {
      "atk": 435,
      "bonus": 435,
      "magicPower": 130,
      "lifesteal": 9
    },
    "durability": 510,
    "rarity": "mythic",
    "lore": "\"Those it slays are not killed. They are unmade. Not even memories remain.\"",
    "materials": {
      "Oblivion Dust": 4,
      "Void Giant Bone": 2,
      "Null Metal": 3,
      "Chaos Steel": 3
    }
  },
  {
    "output": "God Bone Sovereign Blade",
    "stats": {
      "atk": 445,
      "bonus": 445,
      "critChance": 20,
      "hp": 300
    },
    "durability": 520,
    "rarity": "mythic",
    "lore": "\"Carved from the shinbone of a slain God. It hums with leftover divinity.\"",
    "materials": {
      "God Corpse Fragment": 2,
      "Dragon God Bone": 4,
      "God-Forged Iron": 3,
      "Eternal Metal": 2
    }
  },
  {
    "output": "Reality Fracture Spear",
    "stats": {
      "atk": 400,
      "bonus": 400,
      "magicPower": 160,
      "critChance": 16
    },
    "durability": 490,
    "rarity": "mythic",
    "lore": "\"When thrust, reality splits at the tip. The wound takes centuries to close.\"",
    "materials": {
      "Reality Tear": 5,
      "Chaos God Shard": 2,
      "Chaos Steel": 3,
      "Null Metal": 2
    }
  },
  {
    "output": "Catastrophe Incarnate Blade",
    "stats": {
      "atk": 450,
      "bonus": 450,
      "critChance": 19,
      "lifesteal": 8
    },
    "durability": 520,
    "rarity": "mythic",
    "lore": "\"The blade is not evil. It is the concept of calamity given form.\"",
    "materials": {
      "Catastrophe Ember": 4,
      "Incarnate Core": 2,
      "Chaos Steel": 4,
      "God-Forged Iron": 2
    }
  },
  {
    "output": "Sovereign Void Dragon Fang",
    "stats": {
      "atk": 420,
      "bonus": 420,
      "speed": 35,
      "critChance": 17
    },
    "durability": 505,
    "rarity": "mythic",
    "lore": "\"Broken from the mouth of the Void Dragon Sovereign in its final roar.\"",
    "materials": {
      "Void Dragon Primordial Eye": 3,
      "Ancient Void Dragon Heart": 2,
      "Null Metal": 3,
      "Dragon God Bone": 3
    }
  },
  {
    "output": "Eternal Chaos Sovereign Blade",
    "stats": {
      "atk": 455,
      "bonus": 455,
      "magicPower": 110,
      "critChance": 18,
      "lifesteal": 7
    },
    "durability": 530,
    "rarity": "mythic",
    "lore": "\"The pinnacle of weapon crafting. One was made. It will never be made again.\"",
    "materials": {
      "Chaos God Shard": 3,
      "Eternal Flame": 2,
      "Eternal Metal": 4,
      "Chaos Steel": 3,
      "God-Forged Iron": 2
    }
  },
  {
    "output": "Starfall Blade",
    "type": "weapon",
    "subtype": "greatsword",
    "stats": {
      "atk": 430,
      "burn": 0.6,
      "critChance": 20
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 5,
      "Eternal Flame Essence": 8,
      "Primordial Core": 4,
      "God-Vessel Iron Ingot": 10,
      "Fragment of the First Dawn": 5
    },
    "lore": "A dying star poured its final moment into this blade. The metal had no temperature — not hot, not cold. Whatever a dying sun pours into steel in its last instant is not heat. It is finality."
  },
  {
    "output": "Silence Dagger",
    "type": "weapon",
    "subtype": "dagger",
    "stats": {
      "atk": 350,
      "spd": 90,
      "silence": 0.7,
      "critDamage": 3.5
    },
    "durability": 9200,
    "materials": {
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 7,
      "Void Singularity Shard": 6,
      "Death Metal Ore": 10,
      "Realm-Tear Mana Stone": 4
    },
    "lore": "The Forgotten Assassin left no records — only absences where powerful figures used to be. The blade absorbs sound in a three-foot radius. Witnesses report the same thing: they saw someone fall, and could not account for what happened in between."
  },
  {
    "output": "Origin Spear",
    "type": "weapon",
    "subtype": "spear",
    "stats": {
      "atk": 415,
      "spd": 35,
      "godSlaying": 0.5,
      "penetration": 0.45
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 4,
      "Primordial Core": 3,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 10,
      "World-Eater Fang": 3
    },
    "lore": "Before gods, before myth, before the universe had accumulated enough history to produce religion, there was something that hunted. The origin spear is what it hunted with. Archaeological study places it older than geological dating can measure."
  },
  {
    "output": "Firmament Hammer",
    "type": "weapon",
    "subtype": "hammer",
    "stats": {
      "atk": 460,
      "stunDuration": 5,
      "aoePercent": 0.75,
      "armorBreak": 0.55
    },
    "durability": 9200,
    "materials": {
      "Ancient Heaven Metal": 15,
      "Sky God Core": 6,
      "Eternal Stormstone": 10,
      "God-Vessel Iron Ingot": 12,
      "Fragment of the First Dawn": 5
    },
    "lore": "The sky was made deliberately, by something that needed a ceiling. The hammer used in its construction was placed at the point where sky meets horizon — a point that cannot be reached. A hunter found it through events too improbable to be anything other than intended. The sky flinches when it is swung."
  },
  {
    "output": "Dimension Cleaver",
    "type": "weapon",
    "subtype": "axe",
    "stats": {
      "atk": 440,
      "defIgnore": 0.5,
      "dimensionSlash": 0.4,
      "critChance": 20
    },
    "durability": 9200,
    "materials": {
      "Realm-Tear Mana Stone": 8,
      "World-Eater Fang": 4,
      "Void Singularity Shard": 6,
      "Ancient Heaven Metal": 10,
      "Epoch Mana Stone — Frozen Time": 4
    },
    "lore": "Forged at a point where two realities almost touch. The axe exists in two places at once. When swung, both versions strike simultaneously, separated by a gap the width of the dimensional boundary. Armor cannot protect against both at once."
  },
  {
    "output": "World-Ash Staff",
    "type": "weapon",
    "subtype": "staff",
    "stats": {
      "atk": 370,
      "spellPower": 200,
      "aoeRadius": 999,
      "ashCurse": 0.45
    },
    "durability": 9200,
    "materials": {
      "World-Tree Branch": 8,
      "Eternal Flame Essence": 8,
      "Archmage Heart": 4,
      "Eternal Mana Stone": 12,
      "Primordial Core": 4
    },
    "lore": "When the World-Tree burned, one branch did not. The staff carved from it grows imperceptibly over years. Mages who have used it for decades report the grip is different than they remember. The tree is not finished."
  },
  {
    "output": "Mourning Katana",
    "type": "weapon",
    "subtype": "katana",
    "stats": {
      "atk": 400,
      "spd": 55,
      "critChance": 30,
      "lifeOnHit": 45
    },
    "durability": 9200,
    "materials": {
      "Soul of a Thousand Fallen": 8,
      "Fragment of the First Dawn": 4,
      "Death Metal Ore": 10,
      "Ancient Heaven Metal": 7,
      "Nameless God Essence": 3
    },
    "lore": "A master swordsmith reforged her sword not to make it stronger but to make it honest. She folded into the metal her regret, her grief. The resulting blade weeps. Enemies struck by it sometimes pause, feeling briefly and unexpectedly understood. In that pause, her technique was always decisive."
  },
  {
    "output": "Eternal Recursion Blade",
    "type": "weapon",
    "subtype": "longsword",
    "stats": {
      "atk": 410,
      "recursiveHits": 3,
      "critChance": 22,
      "defIgnore": 0.35
    },
    "durability": 9200,
    "materials": {
      "Epoch Mana Stone — Frozen Time": 6,
      "Realm-Tear Mana Stone": 6,
      "Fragment of the First Dawn": 5,
      "Primordial Core": 4,
      "God-Vessel Iron Ingot": 10
    },
    "lore": "The sword's swing is recorded in geological strata at every point in history simultaneously. It has always been mid-swing. Each strike lands three times: in the present, the immediate past, and slightly ahead of now. Enemies cannot defend against hits arriving from multiple temporal directions."
  },
  {
    "output": "Ruin Lance",
    "type": "weapon",
    "subtype": "lance",
    "stats": {
      "atk": 420,
      "chargeMultiplier": 4.0,
      "armorBreak": 0.6,
      "ruinField": 0.3
    },
    "durability": 9200,
    "materials": {
      "Shattered World Mana Stone": 6,
      "World-Eater Fang": 4,
      "Ancient Heaven Metal": 10,
      "Fallen Kingdom Crown Fragment": 8,
      "Primordial Core": 4
    },
    "lore": "A researcher catalogued every collapsed civilization and found one consistent factor — a spear found in the ruins of each one. The spear witnesses civilizations ending and leaves something of the ruin embedded in its metal. It grows heavier, she noted in her final paper, with history."
  },
  {
    "output": "Gravity Sovereign",
    "type": "weapon",
    "subtype": "knuckles",
    "stats": {
      "atk": 370,
      "gravityCrush": 0.65,
      "stunChance": 0.5,
      "comboHits": 5
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "Forged by compressing an ingot of stellar remnant into wearable form — a process requiring seventeen years and a forge that weighed twelve thousand tons. The resulting weapon weighs nothing in the hand and approximately everything on impact."
  },
  {
    "output": "Tempest Scythe",
    "type": "weapon",
    "subtype": "scythe",
    "stats": {
      "atk": 390,
      "spd": 45,
      "windSlash": 0.55,
      "lifesteal": 0.22
    },
    "durability": 9200,
    "materials": {
      "Eternal Stormstone": 10,
      "Sky God Core": 4,
      "Wind Sovereign Feather": 8,
      "Ancient Heaven Metal": 7,
      "Void Singularity Shard": 4
    },
    "lore": "The great storm of the third age lasted forty years. When it finally ended, the winds it had generated continued for another decade, as if they had forgotten how to stop. The scythe was forged from metal suspended in those post-storm winds for the entire ten years. It cuts like wind: from angles that do not make sense."
  },
  {
    "output": "Elegy Bow",
    "type": "weapon",
    "subtype": "bow",
    "stats": {
      "atk": 385,
      "critDamage": 3.8,
      "finalStrike": 0.35,
      "arrowPiercing": 0.65
    },
    "durability": 9200,
    "materials": {
      "Astral Tendon": 10,
      "Godslayer Arrow Tip": 6,
      "Sky God Core": 3,
      "Fragment of the First Dawn": 4,
      "Soul of a Thousand Fallen": 5
    },
    "lore": "Every legendary hunter has a last hunt. The Elegy Bow was built for that specific moment. The bow carries every last shot ever taken by a great hunter. When you pull it, you pull with every last effort ever made. The arrow knows where to go."
  },
  {
    "output": "Paradox Blade",
    "type": "weapon",
    "subtype": "shortsword",
    "stats": {
      "atk": 385,
      "selfHeal": 0.3,
      "critChance": 26,
      "defIgnore": 0.4
    },
    "durability": 9200,
    "materials": {
      "Realm-Tear Mana Stone": 8,
      "Fragment of the First Dawn": 5,
      "Epoch Mana Stone — Frozen Time": 4,
      "Primordial Core": 3,
      "Void Singularity Shard": 5
    },
    "lore": "This blade was forged using a technique that should not work: the final strike of its creation was delivered by the blade itself, before it existed. The blacksmith's notes end with it struck before I made it so I made it. The blade heals the wounds it creates — but only on the wielder."
  },
  {
    "output": "Chain of the Abyss King",
    "type": "weapon",
    "subtype": "whip",
    "stats": {
      "atk": 375,
      "bindChance": 0.55,
      "abyssalCorruption": 0.3,
      "spd": 45
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The concept of an Abyss King appears independently in the mythologies of seventeen civilizations that never had contact with each other. This chain was dragged up from unmeasurable depth by a trawling vessel. The chain extends, when uncoiled, to a length that does not match its mass. Whatever it catches at the end, it brings back. What it brings back is not always what was sent down."
  },
  {
    "output": "Starfall Trident",
    "type": "weapon",
    "subtype": "trident",
    "stats": {
      "atk": 400,
      "spd": 28,
      "waterDmg": 0.55,
      "tidalWave": 0.4
    },
    "durability": 9200,
    "materials": {
      "Primordial Core": 4,
      "World-Eater Fang": 3,
      "Ancient Heaven Metal": 8,
      "Fragment of the First Dawn": 4,
      "Eternal Stormstone": 6
    },
    "lore": "The first ocean predates the land. The trident was found at its floor, resting on a shelf of rock so old it predates geology's ability to date it. Divers who reached it reported the deepest water around it was completely still, as if the ocean holds its breath in the trident's presence."
  }
];

const helmet = [
  {
    "output": "Void God Crown",
    "stats": {
      "def": 150,
      "hp": 400,
      "magicPower": 80
    },
    "durability": 500,
    "rarity": "mythic",
    "lore": "\"Wearing it grants memories of a god. Most wearers cannot tell them apart from their own.\"",
    "materials": {
      "God Corpse Fragment": 2,
      "Void Titan Core": 1,
      "Null Metal": 3,
      "Primordial Alloy": 2
    }
  },
  {
    "output": "World Ender Helm",
    "stats": {
      "def": 160,
      "hp": 350,
      "critChance": 12
    },
    "durability": 520,
    "rarity": "mythic",
    "lore": "\"Whoever wears this helm has no fear. Death has already accepted them.\"",
    "materials": {
      "World Crack Shard": 3,
      "Chaos God Shard": 1,
      "Chaos Steel": 3,
      "God-Forged Iron": 2
    }
  },
  {
    "output": "Dragon God Crown of Dominion",
    "stats": {
      "def": 145,
      "hp": 420,
      "atk": 50
    },
    "durability": 510,
    "rarity": "mythic",
    "lore": "\"The Dragon God's crown. It chose its next wearer before the old one died.\"",
    "materials": {
      "Dragon God Bone": 4,
      "Dragon King Crown Shard": 2,
      "Eternal Metal": 2
    }
  },
  {
    "output": "Eternal Chaos Helm",
    "stats": {
      "def": 155,
      "magicPower": 100,
      "critChance": 10
    },
    "durability": 505,
    "rarity": "mythic",
    "lore": "\"Contains a sealed fragment of the Chaos God's consciousness. It whispers.\"",
    "materials": {
      "Chaos God Shard": 2,
      "Incarnate Core": 1,
      "Chaos Steel": 3,
      "Null Metal": 2
    }
  },
  {
    "output": "Primordial Sovereign Crown",
    "stats": {
      "def": 140,
      "hp": 380,
      "speed": 30
    },
    "durability": 495,
    "rarity": "mythic",
    "lore": "\"Older than the world it now protects. The runes cannot be translated — they predate language.\"",
    "materials": {
      "Primordial Heart": 2,
      "Primordial Alloy": 3,
      "Dragon God Bone": 2,
      "Eternal Metal": 2
    }
  },
  {
    "output": "Abyss God Vision Crown",
    "stats": {
      "def": 135,
      "magicPower": 120,
      "critChance": 14
    },
    "durability": 490,
    "rarity": "mythic",
    "lore": "\"The wearer sees through all illusions. They also cannot stop seeing the truth.\"",
    "materials": {
      "Abyss God Eye": 2,
      "Divine Abyss Shard": 2,
      "Void Alloy": 3,
      "Null Metal": 2
    }
  },
  {
    "output": "Null Void Executioner Helm",
    "stats": {
      "def": 158,
      "hp": 360,
      "atk": 45
    },
    "durability": 510,
    "rarity": "mythic",
    "lore": "\"Nullifies incoming fear, pain, doubt. Just the helmet. Still incredibly effective.\"",
    "materials": {
      "Null Metal": 4,
      "Nullification Mana Stone": 2,
      "God-Forged Iron": 2,
      "Void Alloy": 2
    }
  },
  {
    "output": "God Corpse Skull Helm",
    "stats": {
      "def": 150,
      "hp": 400,
      "lifesteal": 8
    },
    "durability": 510,
    "rarity": "mythic",
    "lore": "\"Fashioned from the skull of an unnamed god. It still breathes, slightly.\"",
    "materials": {
      "God Corpse Fragment": 3,
      "Eternal Metal": 2,
      "Dragon God Bone": 2,
      "Primordial Alloy": 2
    }
  },
  {
    "output": "Starfall Crown",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 170,
      "atk": 40,
      "critChance": 18,
      "burnAura": 0.3
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "The Meteor King ruled a civilization that built their architecture to watch the sky at all times. The crown was forged from the first meteor that fell within the king's memory. He retrieved it personally, burning his hands in the process. He never healed those burns."
  },
  {
    "output": "Abyss Sovereign Helm",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 178,
      "maxHp": 900,
      "darkResist": 0.55,
      "intimidate": 0.4
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The Abyss Sovereign ruled a depth so extreme that light had never reached it. The helmet fashioned from its shed carapace carries that authority upward. Enemies find their attack patterns falter slightly, as if their instincts are correctly identifying a pressure differential and struggling to proceed."
  },
  {
    "output": "Dream Warden Mask",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 160,
      "spellPower": 80,
      "dreamPierce": 0.5,
      "confuseChance": 0.35
    },
    "durability": 9200,
    "materials": {
      "Soul of a Thousand Fallen": 7,
      "Nameless God Essence": 3,
      "Realm-Tear Mana Stone": 6,
      "Archmage Heart": 2,
      "Eternal Mana Stone": 8
    },
    "lore": "The space of sleep is a real place — a layer of existence that conscious minds visit nightly without realizing they cross a border. The Sleep Guardian stands at that border deciding what crosses in both directions. The wearer sees, faintly, the dream-landscape overlaid on the waking world. The overlap is often more honest."
  },
  {
    "output": "First King Diadem",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 172,
      "commandAura": 0.35,
      "allStats": 0.15,
      "regalAuthority": 0.5
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 4,
      "Primordial Core": 3,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 10,
      "World-Eater Fang": 3
    },
    "lore": "Before kingdoms, before borders, there was a first leader — not a king by title but by the simple fact of being the one who made decisions when decisions needed making. The wearer does not feel powerful. They feel responsible. These are different things. Both are necessary."
  },
  {
    "output": "Titan Skull Helm",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 190,
      "maxHp": 1100,
      "defBreakImmune": true,
      "bossModifier": 1.3
    },
    "durability": 9200,
    "materials": {
      "God-Vessel Iron Ingot": 15,
      "World-Eater Fang": 4,
      "Ancient Heaven Metal": 12,
      "Primordial Core": 5,
      "Shattered World Mana Stone": 5
    },
    "lore": "One titan's skull, partially exposed by erosion, was still large enough to build a village inside. A smith set up a forge there instead. The helm carries the titan's fundamental property: scale. Whatever threatens the wearer is briefly perceived as smaller than it is. Not an illusion — a recalibration of importance."
  },
  {
    "output": "Heaven Warden Circlet",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 165,
      "allResist": 0.3,
      "holyResist": 0.6,
      "commandAura": 0.25
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "The gate between the mortal world and the celestial plane has a warden. The circlet was not made for authority — it became authoritative through generations of being worn by something with the legitimate right to say no. It has said no more times than can be counted, and the no has always held."
  },
  {
    "output": "Dragon God Helm",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 185,
      "atk": 55,
      "dragonBless": 0.5,
      "fireResist": 0.7
    },
    "durability": 9200,
    "materials": {
      "First Dragon Scale": 6,
      "Calamity Dragon Scale": 5,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Primordial Core": 4
    },
    "lore": "At the summit of dragon-kind — above dragon kings, above calamity dragons, above the old ones — there is a god of dragons. The helm incorporates a fragment of that authority: a scale shed by something so far above common draconic power that the scale itself looks like a piece of solid certainty. Every dragon the wearer encounters lowers its head."
  },
  {
    "output": "Stormborn Crest",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 167,
      "lightningImmune": true,
      "spd": 25,
      "critChance": 16
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "The hunter who wore this helm was struck by lightning seven times. Each strike added something. The seventh struck while wearing the helm the strikes had guided them to forge. The lightning recognized the material. The seventh bolt did not damage the helm — it completed it."
  },
  {
    "output": "Ghost Sovereign Mask",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 162,
      "evasion": 0.4,
      "phaseChance": 0.25,
      "spd": 30
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The King of the Unremembered rules all those who have been forgotten — not the dead, but the truly erased. The mask allows the wearer to move through the world the way the unremembered did: present, real, consequential, but unregistered by the attention of others."
  },
  {
    "output": "Cosmos Helm",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 175,
      "maxHp": 850,
      "allResist": 0.28,
      "energyMax": 250
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 4,
      "Primordial Core": 3,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 10,
      "World-Eater Fang": 3
    },
    "lore": "A vessel reached the point where the universe structure becomes something mortals do not have mathematics to describe. The crew member who went outside brought back material that had drifted across the boundary. Wearing it, everything that strikes the wearer is contextualized against the scale of everything that exists. Most threats are quite small."
  },
  {
    "output": "Oracle Helm",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 158,
      "foresight": 0.35,
      "cdReduction": 0.3,
      "critChance": 22
    },
    "durability": 9200,
    "materials": {
      "Epoch Mana Stone — Frozen Time": 6,
      "Realm-Tear Mana Stone": 5,
      "Archmage Heart": 3,
      "Eternal Mana Stone": 8,
      "Fragment of the First Dawn": 4
    },
    "lore": "The Oracle did not want the gift. She was a farmer's daughter who woke one morning able to see every probable future simultaneously. The helm was built, at her direction, by a smith she had seen in seventeen separate futures — the one who, in every version, got the design right."
  },
  {
    "output": "Hollow Crown",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 163,
      "allStats": 0.22,
      "sacrifice": 0.4,
      "teamAura": 0.2
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 4,
      "Primordial Core": 3,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 10,
      "World-Eater Fang": 3
    },
    "lore": "The hollow crown was made for kings who understood that power held is power diminished. It was passed at death to whoever in the kingdom had given the most of themselves to others that year. It was hollow because a truly generous person carries nothing for themselves."
  },
  {
    "output": "Ancestor Mask",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 160,
      "atk": 48,
      "hunting": 0.45,
      "critChance": 18
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 4,
      "Primordial Core": 3,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 10,
      "World-Eater Fang": 3
    },
    "lore": "The first hunter had no weapon — only hands, patience, and a complete comprehension of what they were pursuing. Before traps, before coordination, before technique had a name, a single person tracked a single animal for fourteen days. The mask was made by descendants eight hundred years later."
  },
  {
    "output": "Ruinous Eye Mask",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 158,
      "trueVision": true,
      "weaknessReveal": true,
      "critChance": 20
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "There is a kind of vision that sees not what is but what is ending. The mask was worn by someone who saw everything this way: every interaction as a system approaching collapse. They were not pessimistic — they were precise. They intervened at exactly the right moments and prevented more collapses than anyone will ever know."
  },
  {
    "output": "Pale Tyrant Crown",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 173,
      "deathResist": 0.7,
      "darkResist": 0.55,
      "undeadCommand": true
    },
    "durability": 9200,
    "materials": {
      "Death Metal Ore": 14,
      "Soul of a Thousand Fallen": 8,
      "Nameless God Essence": 3,
      "Ancient Heaven Metal": 8,
      "Void Singularity Shard": 4
    },
    "lore": "The kingdom of bones is a literal nation whose population did not stay dead. The Pale Tyrant insisted the title was inaccurate — they were not tyrannical, just the only leader their subjects would accept given those subjects' strong feelings about continuity. Wearing the crown now, the undead approach the wearer not as prey — but as claimants."
  },
  {
    "output": "Catastrophe Visor",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 166,
      "trueVision": true,
      "critChance": 16,
      "allStats": 0.12
    },
    "durability": 9200,
    "materials": {
      "Calamity Dragon Scale": 7,
      "Eternal Flame Essence": 7,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Primordial Core": 3
    },
    "lore": "Someone watched the world end. Not a metaphorical ending — the actual end. Looking through this visor does not show the user the apocalypse — but it does show everything in the current world that is, comparatively, temporary. The hunter who wears it tends to fight with a serenity that opposing forces find profoundly unsettling."
  },
  {
    "output": "Void Seraph Crown",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 170,
      "spellPower": 90,
      "holyVoid": 0.45,
      "voidResist": 0.5
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "Seraphim that fall from the celestial order do not lose their power — they lose their alignment. What was holy becomes something stranger: still structured, still ordered, but operating according to rules that no longer match the celestial framework. The crown blesses and curses simultaneously, in proportions the wearer determines by which aspect of themselves they lead with."
  },
  {
    "output": "Calamity Horned Crown",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 176,
      "atk": 50,
      "calamityChannel": 0.3,
      "fireResist": 0.65
    },
    "durability": 9200,
    "materials": {
      "Calamity Dragon Scale": 7,
      "Eternal Flame Essence": 7,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Primordial Core": 3
    },
    "lore": "The Calamity Dragon had no name for its own horns. When one horn fell — not broken, simply shed — it struck the earth with enough force to redirect a river. She spent thirty years approaching it, moving it, and finally crafting it into something wearable. The crown retains the direction of the impact: wearing it, the world always feels as though you are the fixed point things move around."
  },
  {
    "output": "Primordial Warlord Mask",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 177,
      "atk": 52,
      "warMastery": 0.4,
      "intimidate": 0.45
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 4,
      "Primordial Core": 3,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 10,
      "World-Eater Fang": 3
    },
    "lore": "The first conqueror did not conquer for territory or tribute — they conquered because they had discovered that organized force applied correctly could change the structure of a situation. The mask was their face in battle, specifically chosen to communicate that whoever was behind it had already decided how this was going to go."
  },
  {
    "output": "Time-Fractured Visor",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 168,
      "cdReduction": 0.4,
      "timeshift": 0.2,
      "evasion": 0.25
    },
    "durability": 9200,
    "materials": {
      "Epoch Mana Stone — Frozen Time": 7,
      "Realm-Tear Mana Stone": 5,
      "Ancient Heaven Metal": 8,
      "Fragment of the First Dawn": 4,
      "Void Singularity Shard": 4
    },
    "lore": "The visor exists simultaneously in three time periods. Historians have found depictions of it in art from the First, Second, and Third Ages — always on a different face, always in a different battle, but always the same visor. The wearer sees through all three pairs of eyes at once."
  },
  {
    "output": "Sovereign Ruin Mask",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 174,
      "intimidate": 0.55,
      "allResist": 0.25,
      "ruinField": 0.3
    },
    "durability": 9200,
    "materials": {
      "Fallen Kingdom Crown Fragment": 8,
      "Shattered World Mana Stone": 6,
      "Ancient Heaven Metal": 10,
      "Soul of a Thousand Fallen": 6,
      "Primordial Core": 3
    },
    "lore": "The mask was worn by the last ruler of an empire so large that when it ended, historians struggled to find anything that was not affected by its collapse. In the last throne room, in the last hour before the doors were broken in, they sat in the certainty that everything they had built was ending. That certainty, preserved in the metal, makes the mask's wearer impossible to rattle."
  },
  {
    "output": "World-Ash Helm",
    "type": "armor",
    "subtype": "helmet",
    "stats": {
      "def": 164,
      "spellPower": 85,
      "ashCurse": 0.35,
      "allResist": 0.22
    },
    "durability": 9200,
    "materials": {
      "World-Tree Branch": 7,
      "Eternal Flame Essence": 7,
      "Archmage Heart": 3,
      "Ancient Heaven Metal": 9,
      "Primordial Core": 3
    },
    "lore": "The World-Tree burned for three years before the last ember cooled. A smith collected ash throughout the burning — not from the edges but from the heart of it, where the fire was most complete. The helm fashioned from that ash carries the memory of the entire tree: every root system, every branch, every leaf that ever grew. It is heavier than ash has any right to be. The weight is memory."
  }
];

const chest = [
  {
    "output": "Void God Plate",
    "stats": {
      "def": 200,
      "hp": 500,
      "atk": 60
    },
    "durability": 550,
    "rarity": "mythic",
    "lore": "\"Grown from the ribcage of a void deity. It repairs itself by consuming ambient mana.\"",
    "materials": {
      "God Corpse Fragment": 3,
      "Void Titan Core": 2,
      "Null Metal": 4,
      "Primordial Alloy": 3
    }
  },
  {
    "output": "Dragon God Sovereign Breastplate",
    "stats": {
      "def": 210,
      "hp": 450,
      "speed": 20
    },
    "durability": 560,
    "rarity": "mythic",
    "lore": "\"The Dragon God's own scale-plate. No fire has ever reached the skin beneath it.\"",
    "materials": {
      "Dragon God Bone": 5,
      "Eternal Metal": 3,
      "Dragon King Heart": 2,
      "Primordial Alloy": 2
    }
  },
  {
    "output": "Eternal Chaos Armor",
    "stats": {
      "def": 195,
      "hp": 420,
      "magicPower": 90
    },
    "durability": 540,
    "rarity": "mythic",
    "lore": "\"Woven from solidified chaos. It has no consistent shape — only consistent protection.\"",
    "materials": {
      "Chaos God Shard": 3,
      "Incarnate Core": 2,
      "Chaos Steel": 5,
      "Null Metal": 3
    }
  },
  {
    "output": "World Ender Chestguard",
    "stats": {
      "def": 220,
      "hp": 480,
      "critChance": 10
    },
    "durability": 570,
    "rarity": "mythic",
    "lore": "\"Worn by the hunter who ended the last World Age. They did not survive it either.\"",
    "materials": {
      "World Crack Shard": 4,
      "God-Forged Iron": 4,
      "Chaos Steel": 3,
      "Null Metal": 2
    }
  },
  {
    "output": "Primordial God Shell",
    "stats": {
      "def": 200,
      "hp": 460,
      "def2": 30
    },
    "durability": 545,
    "rarity": "mythic",
    "lore": "\"A primordial being shed this shell voluntarily. It was considered a gift. Or a warning.\"",
    "materials": {
      "Primordial Heart": 3,
      "Primordial Alloy": 4,
      "Eternal Metal": 3,
      "Dragon God Bone": 2
    }
  },
  {
    "output": "Null God Fortress Plate",
    "stats": {
      "def": 230,
      "hp": 400
    },
    "durability": 580,
    "rarity": "mythic",
    "lore": "\"Nullifies 1 in every 10 attacks completely — they simply don't land.\"",
    "materials": {
      "Null Metal": 6,
      "Nullification Mana Stone": 3,
      "God-Forged Iron": 3,
      "Void Alloy": 2
    }
  },
  {
    "output": "Abyss Sovereign Carapace",
    "stats": {
      "def": 205,
      "hp": 440,
      "lifesteal": 6
    },
    "durability": 550,
    "rarity": "mythic",
    "lore": "\"Fused from the shell of the Abyss Sovereign. The screams inside are actually comforting.\"",
    "materials": {
      "Abyss God Eye": 2,
      "Abomination Core": 3,
      "Void Alloy": 4,
      "Null Metal": 3
    }
  },
  {
    "output": "Reality Fracture Mantle",
    "stats": {
      "def": 190,
      "magicPower": 140,
      "hp": 380
    },
    "durability": 535,
    "rarity": "mythic",
    "lore": "\"Spun from the boundary between realities. Neither plane can fully claim the wearer.\"",
    "materials": {
      "Reality Tear": 5,
      "Fractured Divine Core": 2,
      "Chaos Steel": 3,
      "Primordial Alloy": 3
    }
  },
  {
    "output": "Titan's Embrace",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 250,
      "maxHp": 1300,
      "knockbackImmune": true,
      "braceAgainst": 0.5
    },
    "durability": 9200,
    "materials": {
      "God-Vessel Iron Ingot": 18,
      "World-Eater Scale": 8,
      "Ancient Heaven Metal": 14,
      "Primordial Core": 6,
      "Fragment of the First Dawn": 6
    },
    "lore": "The last giant stood. Everything else fell, crumbled, surrendered — the last giant stood. Not from pride, but because standing was the only option left that was not yielding, and yielding was something they had decided, quietly and permanently, they would not do. The breastplate remained upright for three days after the giant finally lay down. It still resists the impulse to fall."
  },
  {
    "output": "Starlight Silk Robe",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 185,
      "spellPower": 150,
      "energyMax": 450,
      "evasion": 0.3
    },
    "durability": 9200,
    "materials": {
      "Archmage Heart": 4,
      "Eternal Mana Stone": 12,
      "Soul of a Thousand Fallen": 8,
      "Realm-Tear Mana Stone": 6,
      "Void Singularity Shard": 6
    },
    "lore": "A mage spent forty years collecting specific frequencies of ancient starlight — light from stars confirmed to no longer exist — and developed a method of weaving it into physical form. The resulting fabric is technically impossible: made of photons traveling at the speed of light. The robe protects by being made of something that cannot be struck. Attacks pass through the light and find nothing solid."
  },
  {
    "output": "World-Root Bark Armor",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 228,
      "maxHp": 1100,
      "regeneration": 45,
      "earthResist": 0.6
    },
    "durability": 9200,
    "materials": {
      "World-Tree Branch": 10,
      "Primordial Core": 5,
      "Ancient Heaven Metal": 10,
      "Fragment of the First Dawn": 6,
      "God-Vessel Iron Ingot": 10
    },
    "lore": "Bark shed from the World-Tree's roots cannot be cut by conventional means, because the bark is still alive and connected to a tree larger than the continent it anchors. Armor grown from that bark defends by connection: when struck, the force is distributed instantly through the root network. The world's foundation takes the blow. The wearer feels a very slight shiver, and nothing else."
  },
  {
    "output": "Nether King Chestguard",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 242,
      "darkResist": 0.65,
      "deathResist": 0.6,
      "maxHp": 1000
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "Below the Abyss, below the void, below every conceptual bottom that any philosophy has proposed, there is one more layer. The Nether King rules it alone, without subjects. The chestguard was made in case they ever had visitors. No visitor ever came. When found millennia later, it was still waiting, in perfect condition, radiating the patience of something that has never been in a hurry because time, at absolute depth, is not a pressure."
  },
  {
    "output": "Myth Plate",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 225,
      "mythicAura": 0.4,
      "allStats": 0.2,
      "legendaryResist": 0.5
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 7,
      "Primordial Core": 5,
      "God-Vessel Iron Ingot": 14,
      "Ancient Heaven Metal": 12,
      "War of Gods Relic": 5
    },
    "lore": "The Myth Plate is technically impossible to have been made. Scholars concluded its creation was enabled not by technology but by belief — the simultaneous belief of approximately four million people that a protector strong enough to face what was coming had to exist. Four million people believed, at the same moment, hard enough. The armor responded. It is made of faith, fired at sufficient temperature to become steel."
  },
  {
    "output": "Colossus Shell",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 255,
      "maxHp": 1400,
      "damageReduction": 0.3
    },
    "durability": 9200,
    "materials": {
      "World-Eater Scale": 10,
      "World-Eater Fang": 5,
      "God-Vessel Iron Ingot": 16,
      "Ancient Heaven Metal": 14,
      "Primordial Core": 6
    },
    "lore": "Something shed this. The shell was found on a beach, alone, without accompanying tracks or marks of any kind in any direction. The creature it came from has not been identified. The material has never been damaged in testing. The material has never been successfully analyzed in testing. The material is, by every available measure, exactly as protective as it looks. Which is to say: completely."
  },
  {
    "output": "Oblivion Shell",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 240,
      "allResist": 0.35,
      "deathResist": 0.65,
      "damageReduction": 0.28
    },
    "durability": 9200,
    "materials": {
      "Shattered World Mana Stone": 8,
      "Void Singularity Shard": 8,
      "Ancient Heaven Metal": 14,
      "Primordial Core": 6,
      "Death Metal Ore": 10
    },
    "lore": "A world ended. Completely, totally, without remainder. One thing survived: this armor. Not the civilization that made it, not the world that hosted that civilization — just the armor, because the armor had become fundamentally unwilling to end. It brought that unwillingness across the end of its world and into this one."
  },
  {
    "output": "Convergence Plate",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 232,
      "destinyShield": 0.45,
      "allResist": 0.22,
      "foresight": 0.3
    },
    "durability": 9200,
    "materials": {
      "Epoch Mana Stone — Frozen Time": 7,
      "Realm-Tear Mana Stone": 6,
      "Fragment of the First Dawn": 6,
      "Primordial Core": 5,
      "Ancient Heaven Metal": 12
    },
    "lore": "Once in a recorded era, all paths converge: every destiny in the world passes through a single point at a single moment. The plate was at that point — a piece of scrap metal in a warehouse. Every destiny touched it in passing. Every destiny left something. The plate carries the combined residual of every life that ever was or would be: not their memories, but their direction."
  },
  {
    "output": "Calamity Plate",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 242,
      "fireResist": 0.8,
      "calamityChannel": 0.35,
      "damageReduction": 0.2
    },
    "durability": 9200,
    "materials": {
      "Calamity Dragon Scale": 7,
      "Eternal Flame Essence": 7,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Primordial Core": 3
    },
    "lore": "The fire that ended the second age burned for eleven years. It was purposeful, patient. The plate was forged in that fire by a smith who had decided that if this was how the age ended, they would make something in the ending worth keeping. They worked in the fire for seven of those eleven years — in its core, in the part that was hottest and most certain."
  },
  {
    "output": "Serpentine Scale Mantle",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 226,
      "poisonImmunity": true,
      "voidResist": 0.5,
      "serpentBless": 0.4
    },
    "durability": 9200,
    "materials": {
      "Ancient Scale — World Serpent": 14,
      "World Serpent Venom Gland": 6,
      "Primordial Core": 5,
      "Ancient Heaven Metal": 10,
      "Realm-Tear Mana Stone": 6
    },
    "lore": "The World Serpent has given gifts twice in recorded history. The second gift was this mantle, presented to a hunter who had somehow managed to do the World Serpent a favor — the exact nature of the favor produces three entirely different translations. What is consistent across all translations is that the Serpent was genuinely grateful, which is a quality it had not displayed in the previous four thousand years of documented interaction."
  },
  {
    "output": "Thunder Sovereign Plate",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 238,
      "lightningImmune": true,
      "thunderStrike": 0.45,
      "stunAura": 0.3
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "The Storm God forged this himself — not as a gift, but as an exercise in frustration. He built the plate the way mortals punch things when frustrated — with tremendous force and zero purpose — then left it on a cloud. A hunter who climbed high enough found it. The Storm God, informed, was quiet for a moment and then said keep it."
  },
  {
    "output": "Iron Heaven Plate",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 238,
      "lightningImmune": true,
      "allResist": 0.25,
      "commandAura": 0.18
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "The sky defends itself — this is not a metaphor but a documented meteorological phenomenon. Whatever rises high enough to threaten the sky finds the atmosphere itself presenting resistance: unusual pressure formations, unexplained electrical activity, cloud patterns that function more like walls than weather. The Iron Heaven Plate is made from the same material the sky uses for its own defense."
  },
  {
    "output": "Soul Sovereign Plate",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 233,
      "soulCapture": 0.45,
      "lifesteal": 0.22,
      "maxHp": 1050
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "A philosopher who spent their life studying death reached a conclusion that alarmed every institution they presented it to: death is not an event but a transfer. The Soul Sovereign spent three centuries ensuring every death in their territory was properly managed. The plate was their working armor. It has developed a relationship with mortality that is neither fearful nor callous — simply familiar."
  },
  {
    "output": "Paradox Plate",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 215,
      "phaseChance": 0.3,
      "paradoxShield": 0.45,
      "evasion": 0.2
    },
    "durability": 9200,
    "materials": {
      "Realm-Tear Mana Stone": 8,
      "Void Singularity Shard": 7,
      "Epoch Mana Stone — Frozen Time": 5,
      "Ancient Heaven Metal": 10,
      "Primordial Core": 4
    },
    "lore": "The plate exists in two states simultaneously. When not being struck, it is solid — measurable, tangible, completely present. The moment it is struck, it briefly becomes ambiguous: the attack finds both a plate and the absence of a plate. Every blow asks whether the armor is there. The armor answer is: both."
  },
  {
    "output": "Remnant God Robe",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 200,
      "spellPower": 130,
      "godEssence": 0.4,
      "energyMax": 380
    },
    "durability": 9200,
    "materials": {
      "Nameless God Essence": 6,
      "Fragment of the First Dawn": 6,
      "Archmage Heart": 3,
      "Eternal Mana Stone": 10,
      "Soul of a Thousand Fallen": 8
    },
    "lore": "When gods die, they linger as residual structure. The robe is woven from that residual: clothing that held the shape of divinity now holds that shape without content, like a glove that has forgotten the hand it was made for. The robe does not grant divinity. It grants the texture of having once touched divinity, which turns out to be more useful in a fight."
  },
  {
    "output": "Boundless Sea Cuirass",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 222,
      "waterResist": 0.8,
      "maxHp": 1000,
      "regeneration": 35
    },
    "durability": 9200,
    "materials": {
      "Primordial Core": 5,
      "Ancient Heaven Metal": 12,
      "World-Eater Scale": 6,
      "God-Vessel Iron Ingot": 10,
      "Eternal Stormstone": 8
    },
    "lore": "The world's first ocean had no shore — it simply was, in every direction, without limit. A creature that lived in it from the beginning was found wearing something around its thorax that was not biological. Investigation revealed a cuirass of unknown manufacture, predating the existence of anything capable of manufacturing it. The ocean, researchers concluded, had made it."
  },
  {
    "output": "Heaven-Touched Vestments",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 205,
      "holyResist": 0.65,
      "allResist": 0.25,
      "spellPower": 120
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 5,
      "Fragment of the First Dawn": 7,
      "Archmage Heart": 3,
      "Eternal Mana Stone": 10,
      "Ancient Heaven Metal": 10
    },
    "lore": "Divine light, when it reaches the mortal world, does not spread, reflect, or diffuse. It lands. It lands on a specific surface, at a specific point, with a specific intent. The vestments were on a surface where divine light landed once. The material changed. The light had altered the fabric relationship with force: blows that should transfer energy into the cloth find that the energy has somewhere else to go."
  },
  {
    "output": "Annihilator's Plate",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 235,
      "atk": 50,
      "ruinField": 0.35,
      "defIgnore": 0.3
    },
    "durability": 9200,
    "materials": {
      "Shattered World Mana Stone": 8,
      "World-Eater Fang": 5,
      "Ancient Heaven Metal": 12,
      "God-Vessel Iron Ingot": 12,
      "Primordial Core": 5
    },
    "lore": "The Annihilator had spent a lifetime learning the single principle that no military, fortification, or supply chain can survive a sufficiently concentrated application of force, properly directed. The plate was their only armor because they had decided, philosophically, that defense was the wrong orientation. It protected them anyway — something that carries this much forward momentum is very hard to stop."
  },
  {
    "output": "Chronicle Plate",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 230,
      "battleMastery": 0.35,
      "allStats": 0.15,
      "maxHp": 900
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 7,
      "War of Gods Relic": 6,
      "Ancient Heaven Metal": 12,
      "Soul of a Thousand Fallen": 8,
      "God-Vessel Iron Ingot": 10
    },
    "lore": "A scholar discovered that certain armor that had survived enough battles seemed to record things themselves — in the metal behavior. It adapted, compensated, responded to unfamiliar attacks with solutions derived from previous encounters. The Chronicle Plate has been at more battles than the scholar could count. It has stopped recording and started anticipating."
  },
  {
    "output": "Sovereign Void Plate",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 244,
      "voidResist": 0.7,
      "darkResist": 0.6,
      "allResist": 0.18
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "There is a point in the void where even void-light gives up. The plate was forged at that point. The armor exists at the intersection of presence and absence: simultaneously real enough to deflect attacks and absent enough to make those attacks uncertain whether they found a target. Enemies who strike the wearer sometimes look confused, as if they need to check whether they actually connected."
  },
  {
    "output": "Stormwall Plate",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 237,
      "lightningImmune": true,
      "windResist": 0.7,
      "allResist": 0.22
    },
    "durability": 9200,
    "materials": {
      "Eternal Stormstone": 12,
      "Sky God Core": 5,
      "Ancient Heaven Metal": 12,
      "God-Vessel Iron Ingot": 11,
      "Fragment of the First Dawn": 5
    },
    "lore": "A wall that has stopped every storm is not primarily a wall — it is an argument. The Stormwall was built at a meteorological convergence point so extreme that its storms had been named individually for two thousand years. The Stormwall stopped all of them. Every storm. The plate is forged from metal that was part of that wall. It has decided, as a matter of material philosophy, not to be moved."
  },
  {
    "output": "Ember Sovereign Plate",
    "type": "armor",
    "subtype": "chest",
    "stats": {
      "def": 236,
      "fireResist": 0.85,
      "burnImmunity": true,
      "atk": 45
    },
    "durability": 9200,
    "materials": {
      "Eternal Flame Essence": 10,
      "First Dragon Scale": 6,
      "Calamity Dragon Scale": 6,
      "God-Vessel Iron Ingot": 12,
      "Ancient Heaven Metal": 12
    },
    "lore": "The actual heart of the volcano is a point of thermal singularity so dense that rock around it vaporizes. A smith who built a forge directly above that point spent one day at that depth before the heat killed them. The plate they made in that one day is everything they knew how to do, executed in twenty-four hours with full awareness that it was the only twenty-four hours available. It is their best work. It is also their last."
  }
];

const boots = [
  {
    "output": "Void God Speed Greaves",
    "stats": {
      "speed": 80,
      "def": 50,
      "critChance": 10
    },
    "durability": 480,
    "rarity": "mythic",
    "lore": "\"Moving at top speed in these leaves no footprints. Because you are not touching the ground.\"",
    "materials": {
      "Void Titan Core": 2,
      "Null Metal": 3,
      "God-Forged Iron": 2,
      "Primordial Alloy": 2
    }
  },
  {
    "output": "Dragon God Sovereign Treads",
    "stats": {
      "speed": 60,
      "def": 70,
      "hp": 250
    },
    "durability": 490,
    "rarity": "mythic",
    "lore": "\"The Dragon God did not walk — it moved through space. These carry that memory.\"",
    "materials": {
      "Dragon God Bone": 3,
      "Eternal Metal": 3,
      "Primordial Alloy": 2
    }
  },
  {
    "output": "Chaos Rift Striders",
    "stats": {
      "speed": 75,
      "atk": 50,
      "magicPower": 70
    },
    "durability": 475,
    "rarity": "mythic",
    "lore": "\"Each step tears a micro-rift. The wearer is always half a step out of reality.\"",
    "materials": {
      "Reality Tear": 3,
      "Chaos God Shard": 2,
      "Chaos Steel": 3,
      "Null Metal": 2
    }
  },
  {
    "output": "Eternal Phantom Boots",
    "stats": {
      "speed": 90,
      "critChance": 8,
      "hp": 200
    },
    "durability": 485,
    "rarity": "mythic",
    "lore": "\"Worn by the Eternal Phantom. The footsteps are never heard. Neither is the arrival.\"",
    "materials": {
      "Eternal Flame": 2,
      "Sovereign Shadow Shard": 3,
      "Shadow Sovereign Steel": 3,
      "Null Metal": 2
    }
  },
  {
    "output": "Null God Drift Treads",
    "stats": {
      "speed": 70,
      "def": 65,
      "atk": 40
    },
    "durability": 480,
    "rarity": "mythic",
    "lore": "\"Nullifies ground resistance. The wearer moves through all terrain as if it were air.\"",
    "materials": {
      "Null Metal": 4,
      "Nullification Mana Stone": 2,
      "God-Forged Iron": 2,
      "Primordial Alloy": 1
    }
  },
  {
    "output": "Epoch Stride Boots",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 115,
      "spd": 85,
      "timeshift": 0.25,
      "evasion": 0.3
    },
    "durability": 9200,
    "materials": {
      "Epoch Mana Stone — Frozen Time": 7,
      "Realm-Tear Mana Stone": 6,
      "Ancient Heaven Metal": 8,
      "Fragment of the First Dawn": 4,
      "Void Singularity Shard": 4
    },
    "lore": "The boots step through time the way normal boots step through water — leaving ripples, experiencing brief resistance, arriving somewhere different. Each stride exists briefly in a different era: the left foot lands in the present, the right in the past, and the transition between them is where the boots generate their speed."
  },
  {
    "output": "Iron Heaven Boots",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 118,
      "spd": 70,
      "commandAura": 0.2,
      "groundShatter": 0.45
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "The celestial plain has a floor. The boots carry the texture of that floor in their soles. Each step carries the quality of a divine footfall: the ground has no choice but to support the weight, the stance has no choice but to hold, and whatever the wearer stands in front of experiences the full force of something stepping forward with the authority of the celestial plane behind it."
  },
  {
    "output": "Calamity Dragon Treads",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 112,
      "spd": 75,
      "fireResist": 0.8,
      "burnTrail": 0.55
    },
    "durability": 9200,
    "materials": {
      "Calamity Dragon Scale": 7,
      "Eternal Flame Essence": 7,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Primordial Core": 3
    },
    "lore": "The Calamity Dragon walked through its own fire the way mortals walk through air — entirely without concern. Its footfalls during the burning of the second age left impressions in molten rock that cooled with the exact shape of its steps preserved. The boots carry that indifference to destruction: fire that should scorch the path simply finds the boots already past it, already unburned, already moving forward."
  },
  {
    "output": "Void Step Greaves",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 108,
      "spd": 95,
      "phaseChance": 0.35,
      "evasion": 0.4
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The void is not empty — it is negative. Not the absence of things but the space defined by things absence, which has its own structure, its own pathways. The greaves were developed by a dimensional traveler who noticed certain routes between destinations were faster when taken through the void, because void-distance does not correspond to physical distance."
  },
  {
    "output": "Pilgrim's Final Step",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 105,
      "spd": 88,
      "endurance": 0.6,
      "trailFind": true
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 5,
      "Soul of a Thousand Fallen": 6,
      "Ancient Heaven Metal": 8,
      "Primordial Core": 3,
      "Realm-Tear Mana Stone": 4
    },
    "lore": "A pilgrim who walked every road in the world wore these boots for all of it. The walk took approximately two hundred years, which meant several bodies, several lives, the boots transferring ownership through an unbroken lineage of walkers. When the last road was walked, the last pilgrim sat down and did not get up. The boots were left at the end of the last road. They know every road. They know every road's end."
  },
  {
    "output": "World Serpent Coil Greaves",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 108,
      "spd": 85,
      "poisonImmunity": true,
      "waterWalk": true
    },
    "durability": 9200,
    "materials": {
      "Ancient Scale — World Serpent": 10,
      "World Serpent Venom Gland": 4,
      "Realm-Tear Mana Stone": 5,
      "Void Singularity Shard": 4,
      "Primordial Core": 2
    },
    "lore": "The World Serpent does not use legs — it moves the entire world around itself rather than moving through the world. The coiled greaves capture a derivative of this technique: the wearer does not move through terrain so much as the terrain briefly acknowledges the wearer and makes itself agreeable. Slopes level out. Slippery surfaces find traction."
  },
  {
    "output": "Dead God Sabatons",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 122,
      "spd": 72,
      "godSlaying": 0.3,
      "defIgnore": 0.35
    },
    "durability": 9200,
    "materials": {
      "Nameless God Essence": 5,
      "God-Vessel Iron Ingot": 12,
      "Ancient Heaven Metal": 10,
      "Fragment of the First Dawn": 4,
      "War of Gods Relic": 4
    },
    "lore": "Gods, when they die, leave dense residue — their spent power compresses into material unlike anything produced by mortal processes. These sabatons are soled with precisely such material, recovered from the site of the War of Gods final battle. The effect on combat is subtle but consistent: the wearer moves with a quality of deliberateness that makes enemies recalculate their threat assessments."
  },
  {
    "output": "Gravity Defier Boots",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 110,
      "spd": 92,
      "gravityIgnore": 0.5,
      "evasion": 0.35
    },
    "durability": 9200,
    "materials": {
      "Realm-Tear Mana Stone": 7,
      "Sky God Core": 3,
      "Void Singularity Shard": 5,
      "Ancient Heaven Metal": 8,
      "Primordial Core": 3
    },
    "lore": "Gravity is a law, but laws are descriptive rather than prescriptive — they describe what happens, not what must happen. A physicist who reached this conclusion spent twenty years finding the exceptions. The boots are made from materials sourced at those exception points: locations where gravity makes a suggestion rather than a demand."
  },
  {
    "output": "Starfall Striders",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 114,
      "spd": 96,
      "critChance": 18,
      "burnTrail": 0.4
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Flame Essence": 8,
      "Eternal Stormstone": 6,
      "Ancient Heaven Metal": 8,
      "Fragment of the First Dawn": 4
    },
    "lore": "A smith who studied meteorite composition discovered something unexpected: certain meteors land with their speed preserved in the metal rather than dissipated as heat. The material still carries the velocity of its fall. Boots made from it make each step a micro-impact: the stride carries the compressed kinetic memory of falling from the sky."
  },
  {
    "output": "Shadow Sovereign Greaves",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 106,
      "spd": 98,
      "silence": 0.8,
      "backstabMultiplier": 2.0
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The Shadow Sovereign moved without sound — not because they were trained to, but because they had developed, over three centuries of operation, a total mastery of how sound is generated by movement. At the end they had refined it to a single conclusion: silence is not the absence of sound but the refusal of sound to be produced. The greaves carry that refusal. Footsteps on them generate no sound."
  },
  {
    "output": "First Walker Sandals",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 102,
      "spd": 88,
      "pathCreate": true,
      "endurance": 0.55
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 7,
      "Primordial Core": 4,
      "Ancient Heaven Metal": 6,
      "Soul of a Thousand Fallen": 5,
      "World-Tree Branch": 4
    },
    "lore": "Before the first road, before the first path, before the first creature had passed through a place enough times to compress the grass into a track, someone walked somewhere new. The sandals were worn on that first walk. They carry the experience of making a path where none existed — not just physically but conceptually."
  },
  {
    "output": "Titan Step Boots",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 125,
      "groundShatter": 0.55,
      "knockback": 0.6,
      "maxHp": 400
    },
    "durability": 9200,
    "materials": {
      "God-Vessel Iron Ingot": 14,
      "World-Eater Scale": 6,
      "Ancient Heaven Metal": 10,
      "Primordial Core": 4,
      "Shattered World Mana Stone": 4
    },
    "lore": "Titans moved through the landscape leaving evidence that persisted for geological epochs: valleys formed by their resting weight, ridges created by their passage, entire rivers rerouted by footfalls that the water decided to route around. The boots are fragments of a titan actual tread material, reshaped. They remember what it was like to carry a titan weight."
  },
  {
    "output": "Judgment Walk Boots",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 116,
      "spd": 68,
      "judgmentAura": 0.5,
      "bossModifier": 1.25
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 5,
      "Nameless God Essence": 4,
      "God-Vessel Iron Ingot": 10,
      "Ancient Heaven Metal": 9,
      "Soul of a Thousand Fallen": 5
    },
    "lore": "The Hall of Judgment had a specific approach: a long corridor, perfectly straight, that judges walked to indicate their arrival. The sound of boots on that corridor was the signal that a verdict was imminent. For three hundred years, the same pair of boots walked that corridor. Each verdict added something to the boots — not memory, but something more structural, more certain."
  },
  {
    "output": "Heaven Crusher Stompers",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 120,
      "spd": 65,
      "groundShatter": 0.7,
      "stunChance": 0.5
    },
    "durability": 9200,
    "materials": {
      "Fallen Heaven Pillar Fragment": 8,
      "Ancient Heaven Metal": 12,
      "God-Vessel Iron Ingot": 12,
      "Sky God Core": 3,
      "Primordial Core": 4
    },
    "lore": "The sky fell because someone kicked it. This is the controversial but increasingly supported conclusion of celestial historians who worked backward from the physical evidence. The force required to destabilize the celestial plane structural pillars is consistent with a single, precisely aimed impact from below. Whoever delivered that impact wore these boots."
  },
  {
    "output": "Phantom Stride Greaves",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 105,
      "spd": 97,
      "evasion": 0.5,
      "phaseChance": 0.3
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "A phantom does not walk — it suggests walking. The motion is there; the mechanics of stride are present; but the interaction with the world is optional rather than mandatory. The greaves capture this quality by being made of material more committed to momentum than to impact. The wearer moves without leaving footprints in soft ground, without triggering pressure-activated traps, without making the ice crack under them."
  },
  {
    "output": "Sovereign March Greaves",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 117,
      "spd": 72,
      "commandAura": 0.3,
      "unflinching": true
    },
    "durability": 9200,
    "materials": {
      "Ancient Heaven Metal": 10,
      "God-Vessel Iron Ingot": 10,
      "Fragment of the First Dawn": 4,
      "Sky God Core": 3,
      "Primordial Core": 3
    },
    "lore": "The march of the inevitable is the walk of someone who has accepted what is happening and decided their role in it. Not fatalism: decision. The greaves were worn by a figure who walked into battles that should not have been survivable — all with the same measured stride, the same pace. The greaves do not make the wearer faster. They make the wearer continuous."
  },
  {
    "output": "Ruin Treader Boots",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 111,
      "spd": 74,
      "ruinAffinity": 0.4,
      "scavenge": 0.35
    },
    "durability": 9200,
    "materials": {
      "Shattered World Mana Stone": 6,
      "Fallen Kingdom Crown Fragment": 5,
      "Ancient Heaven Metal": 8,
      "Soul of a Thousand Fallen": 6,
      "Death Metal Ore": 8
    },
    "lore": "Ruins are alive. Not biologically — structurally. The collapsed walls, the buried streets, the sealed chambers remember what they were. These boots have walked through more ruins than any other pair in recorded history, made partly of materials scavenged from fourteen different collapsed civilizations."
  },
  {
    "output": "Abyssal Trench Boots",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 123,
      "pressureImmune": true,
      "darkResist": 0.6,
      "maxHp": 500
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The deep trenches of the oceans are places where pressure becomes geological force. The boots were forged to function there, by a smith who decided the deepest place was the safest forge because it was the place the fewest competitors could reach. She was right. She worked at a depth that crushed conventional forging equipment. The resulting boots simply do not yield to what they are told to yield to."
  },
  {
    "output": "Genesis Step Boots",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 113,
      "spd": 78,
      "allStats": 0.15,
      "firstStrikeBonus": 1.5
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 8,
      "Primordial Core": 5,
      "Ancient Heaven Metal": 8,
      "World-Tree Branch": 4,
      "Realm-Tear Mana Stone": 4
    },
    "lore": "At the beginning — the actual beginning, the first moment of the world existence — something walked on the potential of the world before anything had decided what it would be. These boots were on those feet. How they ended up centuries later sold at a roadside market to a hunter who could not afford the good ones is a mystery multiple scholars have spent careers not solving."
  },
  {
    "output": "Rift Hopper Greaves",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 112,
      "spd": 90,
      "riftStep": 0.45,
      "teleportCooldown": -0.5
    },
    "durability": 9200,
    "materials": {
      "Realm-Tear Mana Stone": 10,
      "Void Singularity Shard": 6,
      "Ancient Heaven Metal": 8,
      "Primordial Core": 3,
      "Epoch Mana Stone — Frozen Time": 4
    },
    "lore": "Reality has cracks. Not catastrophic ones — hairline fractures in the fabric of what exists, too small to be dangerous but large enough, for the properly equipped, to step through. The greaves were developed by a dimensional explorer who mapped those fractures the way geologists map fault lines: patiently, systematically."
  },
  {
    "output": "World-Eater Track Boots",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 116,
      "spd": 78,
      "consume": 0.3,
      "defIgnore": 0.35
    },
    "durability": 9200,
    "materials": {
      "World-Eater Fang": 5,
      "World-Eater Scale": 7,
      "Death Metal Ore": 9,
      "Ancient Heaven Metal": 8,
      "Primordial Core": 3
    },
    "lore": "The Great Devourer's track leaves nothing — not footprints, not crushed vegetation, not displaced soil. Whatever it walks across is simply absent afterward. The boots carry a fragment of this property: enough to leave the ground slightly diminished wherever they pass. Enemies who follow in the wearer's path find the ground marginally less reliable. Marginally, in a fight, is frequently everything."
  },
  {
    "output": "Annihilation March Boots",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 118,
      "groundShatter": 0.65,
      "defIgnore": 0.4,
      "ruinField": 0.3
    },
    "durability": 9200,
    "materials": {
      "Shattered World Mana Stone": 7,
      "World-Eater Fang": 4,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Primordial Core": 4
    },
    "lore": "There are marches that end wars — not armies advancing, but a single person walking forward, step by step, and everything in their path either surrendering or ceasing to be a problem. The boots carry the accumulated authority of those marches. Each step is a statement that the wearer is continuing forward. Ground that objects to this is made aware that objecting is futile."
  },
  {
    "output": "Cosmic Wanderer Boots",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 109,
      "spd": 82,
      "allResist": 0.25,
      "endurance": 0.45
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 4,
      "Primordial Core": 3,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 10,
      "World-Eater Fang": 3
    },
    "lore": "A traveler who understood that the distances between stars are incomprehensible unless approached as roads rather than spaces walked those roads for longer than mortal record-keeping tracked. The boots always know the most efficient route. Not the fastest — the most efficient. They have been on longer journeys than this. They know how to pace."
  },
  {
    "output": "Duskfall Sabatons",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 114,
      "spd": 80,
      "darkResist": 0.5,
      "critChance": 18
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The Duskfall Sabatons were made at a latitude where the last hour of day lasts six months — a place at the edge where the sun never quite rises and never quite sets. In that prolonged last hour, a smith worked leather and metal into boots that carry that quality of honest, limited visibility: the wearer sees as much as can be seen, and no more, and is not afraid of the honest boundary."
  },
  {
    "output": "Convergence Step Boots",
    "type": "armor",
    "subtype": "boots",
    "stats": {
      "def": 113,
      "spd": 78,
      "destinyBoost": 0.45,
      "allStats": 0.15
    },
    "durability": 9200,
    "materials": {
      "Epoch Mana Stone — Frozen Time": 6,
      "Fragment of the First Dawn": 5,
      "Realm-Tear Mana Stone": 5,
      "Ancient Heaven Metal": 8,
      "Soul of a Thousand Fallen": 5
    },
    "lore": "Every destiny has a point toward which it moves — not a destination chosen but a convergence mandated by the accumulated weight of every prior decision. The boots were worn by someone who reached their convergence and walked through it rather than stopping at it. They carry that momentum: the specific quality of movement that does not treat a culmination as an ending but as a direction change, and continues."
  }
];

const leggings = [
  {
    "output": "Void God Sovereign Greaves",
    "stats": {
      "def": 160,
      "hp": 350,
      "speed": 20
    },
    "durability": 510,
    "rarity": "mythic",
    "lore": "\"Void-forged plate. Nothing punctures them. They have been tested by gods.\"",
    "materials": {
      "Void Titan Core": 2,
      "Null Metal": 4,
      "God-Forged Iron": 2,
      "Primordial Alloy": 2
    }
  },
  {
    "output": "Dragon God War Greaves",
    "stats": {
      "def": 175,
      "hp": 320,
      "atk": 45
    },
    "durability": 525,
    "rarity": "mythic",
    "lore": "\"The Dragon God's own battle-greaves. Scorched from a thousand wars. Unbroken.\"",
    "materials": {
      "Dragon God Bone": 4,
      "Eternal Metal": 3,
      "Dragon King Heart": 1
    }
  },
  {
    "output": "Chaos Sovereign War Greaves",
    "stats": {
      "def": 155,
      "hp": 380,
      "magicPower": 80
    },
    "durability": 500,
    "rarity": "mythic",
    "lore": "\"Chaos-forged. The leg pieces refuse to stay still — they shift with the wearer's intent.\"",
    "materials": {
      "Chaos God Shard": 2,
      "Chaos Steel": 4,
      "Incarnate Core": 1,
      "Null Metal": 3
    }
  },
  {
    "output": "Null Fortress War Greaves",
    "stats": {
      "def": 190,
      "hp": 300
    },
    "durability": 540,
    "rarity": "mythic",
    "lore": "\"The ultimate defensive leg armor. Tests showed no dent after 1,000 consecutive S-rank blows.\"",
    "materials": {
      "Null Metal": 5,
      "Nullification Mana Stone": 2,
      "God-Forged Iron": 3
    }
  },
  {
    "output": "Primordial Sovereign Greaves",
    "stats": {
      "def": 165,
      "hp": 360,
      "speed": 15
    },
    "durability": 515,
    "rarity": "mythic",
    "lore": "\"Older than nations. Older than civilizations. Older than the concept of war itself.\"",
    "materials": {
      "Primordial Heart": 2,
      "Primordial Alloy": 4,
      "Dragon God Bone": 2,
      "Eternal Metal": 2
    }
  },
  {
    "output": "World-Root Legwraps",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 148,
      "knockbackImmune": true,
      "maxHp": 700,
      "braceAgainst": 0.5
    },
    "durability": 9200,
    "materials": {
      "World-Tree Branch": 8,
      "Primordial Core": 4,
      "Ancient Heaven Metal": 10,
      "Fragment of the First Dawn": 5,
      "God-Vessel Iron Ingot": 10
    },
    "lore": "The World-Tree's roots do not grip the earth — they are the earth, at the level where the difference stops mattering. Legwraps fashioned from root material carry this property: the wearer's lower body becomes connected to the world's foundation. It is impossible to sweep someone whose legs are connected to the root network."
  },
  {
    "output": "Abyss Sovereign Leggings",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 150,
      "darkResist": 0.6,
      "intimidate": 0.4,
      "maxHp": 650
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "Ruling from the deepest point in existence requires a particular quality of stance — something that communicates to the entire depth of the abyss below you that you are aware of its depth and unimpressed. The Abyss Sovereign's leggings carry that stance. Combat approaches against the wearer's legs are automatically categorized by the opponent's instincts as futile before the first attempt."
  },
  {
    "output": "Storm Sovereign Tassets",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 140,
      "spd": 30,
      "lightningImmune": true,
      "windResist": 0.65
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "The eternal gale has been blowing in the upper atmosphere since before any civilization existed to name it. The tassets were forged at the point where the gale is strongest, by someone who built a platform there and lived on it for three years. The resulting leggings have been blown at constantly and developed an immunity to being blown at. Force applied to the lower body arrives at something that has already decided not to move."
  },
  {
    "output": "First Dragon Thighguards",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 160,
      "atk": 35,
      "fireResist": 0.75,
      "dragonBless": 0.35
    },
    "durability": 9200,
    "materials": {
      "First Dragon Scale": 6,
      "Calamity Dragon Scale": 5,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Primordial Core": 4
    },
    "lore": "The First Dragon's scales retain the dragon's fundamental property: fire recognizes them as family. Not fire generated by the First Dragon — all fire, everywhere, because the First Dragon is the ancestor of all flame. The thighguards fashioned from those scales communicate this to every fire the wearer encounters: this is not prey, this is kin. Fire that touches the leggings finds itself unable to commit to burning someone it recognizes."
  },
  {
    "output": "Epoch Legwraps",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 138,
      "cdReduction": 0.45,
      "timeshift": 0.2,
      "spd": 25
    },
    "durability": 9200,
    "materials": {
      "Epoch Mana Stone — Frozen Time": 7,
      "Realm-Tear Mana Stone": 5,
      "Ancient Heaven Metal": 8,
      "Fragment of the First Dawn": 4,
      "Void Singularity Shard": 4
    },
    "lore": "A temporal scholar's experiment produced an unexpected result: leggings that place the wearer's legs in slightly different temporal coordinates than the rest of their body. The left leg exists approximately half a second in the past; the right leg exists approximately half a second in the future. The wearer does not experience the dissonance — the body normalizes it. But the effect on combat timing is significant."
  },
  {
    "output": "Ghost King Leggings",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 142,
      "deathResist": 0.65,
      "darkResist": 0.5,
      "phaseChance": 0.2
    },
    "durability": 9200,
    "materials": {
      "Death Metal Ore": 12,
      "Soul of a Thousand Fallen": 8,
      "Nameless God Essence": 3,
      "Void Singularity Shard": 5,
      "Ancient Heaven Metal": 8
    },
    "lore": "The Ghost King ruled through continuity: the simple fact of still being there, still governing, still performing the functions of rule, long after every other authority had fallen or fled. When you are the last institution standing, you acquire a credibility that does not require demonstration. The leggings carry that persistence. They have developed, in their material, a genuine objection to discontinuity."
  },
  {
    "output": "Void March Cuisses",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 136,
      "voidResist": 0.6,
      "shadowStep": 0.35,
      "evasion": 0.22
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "There is a march that happens in the void — not toward any destination — a march of the things that exist in nonexistence, moving in the only direction nonexistence has: away from everything. The cuisses were made by someone who marched with it for some portion of their life, finding in that movement a quality they could not find anywhere else: the absence of urgency. Nothing in the void is urgent. The cuisses carry that pace."
  },
  {
    "output": "Ascendant Legplates",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 152,
      "allStats": 0.14,
      "ascendBonus": 0.4,
      "maxHp": 600
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 6,
      "Sky God Core": 4,
      "Ancient Heaven Metal": 10,
      "Primordial Core": 4,
      "God-Vessel Iron Ingot": 8
    },
    "lore": "Ascension is the process of becoming more than you were, so substantially and so completely that what you were before can no longer contain what you have become. The legplates were worn through one such process. They carry a residual upward momentum that the wearer feels as subtle acceleration when moving toward challenges rather than away from them."
  },
  {
    "output": "Titan Guard Leggings",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 162,
      "maxHp": 800,
      "knockbackImmune": true,
      "defBreakImmune": true
    },
    "durability": 9200,
    "materials": {
      "God-Vessel Iron Ingot": 14,
      "World-Eater Scale": 7,
      "Ancient Heaven Metal": 12,
      "Primordial Core": 5,
      "Shattered World Mana Stone": 5
    },
    "lore": "The leggings were resized. The original dimensions accommodated a titan whose name, like most titan names, was a geographical feature rather than a word. The resizing process took fourteen years and involved compressing material that genuinely did not want to be compressed. The threshold for what constitutes a threat remains calibrated to that original scale. Most attacks register as below the threshold."
  },
  {
    "output": "Sovereign Root Greaves",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 147,
      "earthResist": 0.55,
      "braceAgainst": 0.45,
      "regeneration": 25
    },
    "durability": 9200,
    "materials": {
      "World-Tree Branch": 7,
      "Ancient Heaven Metal": 10,
      "Primordial Core": 4,
      "God-Vessel Iron Ingot": 8,
      "Fragment of the First Dawn": 5
    },
    "lore": "The Sovereign Root Greaves were worn across every kind of earth: volcanic, glacial, desert, deep forest, ocean floor, mountain summit. Each earth contributed something to the material of the greaves. The world supports the wearer. Not magically — it simply finds them familiar."
  },
  {
    "output": "Reality Anchor Leggings",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 143,
      "phaseImmune": true,
      "allResist": 0.25,
      "maxHp": 550
    },
    "durability": 9200,
    "materials": {
      "Epoch Mana Stone — Frozen Time": 6,
      "Realm-Tear Mana Stone": 6,
      "Ancient Heaven Metal": 9,
      "Primordial Core": 4,
      "Fragment of the First Dawn": 4
    },
    "lore": "Reality, at the edges, becomes negotiable. Hunters who work at those edges need anchoring. The leggings are made of materials so thoroughly committed to physical existence that they anchor whatever they are attached to. The wearer, no matter how far into the dimensional fringe they venture, will find their lower half insisting on material reality. The upper half follows."
  },
  {
    "output": "Nether Sovereign Legplates",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 154,
      "darkResist": 0.65,
      "deathResist": 0.55,
      "voidResist": 0.4
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "Depth-forged metal has a quality surface-forged metal lacks: it was made under pressure, shaped under pressure, cooled under pressure, and it carries the memory of that pressure as a fundamental property. The legplates were forged at the deepest accessible point in the world. The smith who made them spent four years there and came back changed in ways that made polite conversation with them somewhat challenging."
  },
  {
    "output": "Primordial Warrior Greaves",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 153,
      "atk": 32,
      "critChance": 16,
      "stamina": 0.5
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 6,
      "Primordial Core": 5,
      "Ancient Heaven Metal": 10,
      "God-Vessel Iron Ingot": 8,
      "World-Eater Fang": 3
    },
    "lore": "The first fighter was simply the first creature that chose to meet force with force rather than flight, and discovered in that choice something about themselves they had not known. The greaves record that discovery. They carry the accumulated development of combat from that first, instinctive resistance through every formal technique, every school of thought, every tradition of training."
  },
  {
    "output": "Chaos Emperor Tassets",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 146,
      "chaosResist": 0.6,
      "allResist": 0.2,
      "spd": 28
    },
    "durability": 9200,
    "materials": {
      "Shattered World Mana Stone": 6,
      "Realm-Tear Mana Stone": 5,
      "Void Singularity Shard": 6,
      "Ancient Heaven Metal": 9,
      "Soul of a Thousand Fallen": 5
    },
    "lore": "Chaos has moments of sovereignty — periods when the normal ordering principles of the world simply yield and allow pure entropy its turn. The tassets were worn during one such period, by the figure that chaos had, by some process of absolute disorder, arranged to be its temporary ruler. The Chaos Emperor had not sought the position. They had simply been the thing that chaos organized around when it organized at all."
  },
  {
    "output": "Wraith Silk Leggings",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 132,
      "evasion": 0.45,
      "phaseChance": 0.3,
      "soulSight": true
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "Wraith-silk is the material residue of recent memory in a place that remembers the recently departed. Skilled harvesters collect that resonance and process it into fabric. The leggings have the property of the memory itself: present without being quite tangible, identifiable without being quite locatable. Attacks aimed at the leggings find themselves hitting the memory of where the leggings were rather than the leggings themselves."
  },
  {
    "output": "Skybreaker Cuisses",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 144,
      "allResist": 0.25,
      "lightningImmune": true,
      "atk": 28
    },
    "durability": 9200,
    "materials": {
      "Fallen Heaven Pillar Fragment": 7,
      "Ancient Heaven Metal": 10,
      "Sky God Core": 4,
      "Eternal Stormstone": 8,
      "God-Vessel Iron Ingot": 8
    },
    "lore": "When the heavens fell, the people standing directly below experienced it differently than anyone else. The cuisses were worn by one such person, who had time to observe the collapse and no time to move away. They survived by understanding, in the moment, what was structurally happening — where the impact would land, which vectors were safe. The cuisses carry that understanding."
  },
  {
    "output": "Obliteration Cuisses",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 158,
      "allResist": 0.3,
      "damageReduction": 0.22,
      "deathResist": 0.6
    },
    "durability": 9200,
    "materials": {
      "God-Vessel Iron Ingot": 14,
      "Ancient Heaven Metal": 12,
      "Primordial Core": 5,
      "World-Eater Scale": 7,
      "Fragment of the First Dawn": 5
    },
    "lore": "The smith who built these cuisses had one design principle: outlast. Not outperform, not overpower — outlast. She studied every armor failure in documented history, identified every failure mode, and engineered against all of them simultaneously. They are not the most impressive armor available. They are the armor that will be there at the end."
  },
  {
    "output": "Serpent Scale Legwraps",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 149,
      "poisonImmunity": true,
      "serpentBless": 0.35,
      "evasion": 0.28
    },
    "durability": 9200,
    "materials": {
      "Ancient Scale — World Serpent": 12,
      "World Serpent Venom Gland": 5,
      "Ancient Heaven Metal": 8,
      "Realm-Tear Mana Stone": 5,
      "Primordial Core": 3
    },
    "lore": "The World Serpent's scales are its outer surface — the boundary between what the Serpent is and what everything else is. Scales shed from those boundaries carry the property of that boundary function: they define an edge, a line past which things are different. Wrapped around the wearer's legs, the scales create a moving boundary that the world's hostile forces find themselves instinctively reluctant to cross."
  },
  {
    "output": "Heaven Fall Greaves",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 151,
      "allResist": 0.24,
      "lightningImmune": true,
      "maxHp": 620
    },
    "durability": 9200,
    "materials": {
      "Fallen Heaven Pillar Fragment": 8,
      "Ancient Heaven Metal": 10,
      "Sky God Core": 3,
      "Eternal Stormstone": 7,
      "God-Vessel Iron Ingot": 8
    },
    "lore": "When the old heaven collapsed, the debris field covered the mortal world for three days before clearing. In that debris field were materials that had never existed below the celestial plane — structural components of divine architecture. The greaves are forged from what landed softest — the materials the heaven had designated as flexible, as shock-absorbing. They carry that function: force arrives at the greaves and is directed sideways, downward, anywhere but through the wearer."
  },
  {
    "output": "Sovereign Iron Cuisses",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 156,
      "knockbackImmune": true,
      "braceAgainst": 0.48,
      "maxHp": 680
    },
    "durability": 9200,
    "materials": {
      "Ancient Heaven Metal": 11,
      "God-Vessel Iron Ingot": 12,
      "Fragment of the First Dawn": 5,
      "Fallen Kingdom Crown Fragment": 6,
      "Primordial Core": 4
    },
    "lore": "These cuisses were worn by the last general of the last cohort of a kingdom that everyone except the general had accepted was finished. The general did not accept it. They held positions that should not have been holdable for three weeks longer than any military analysis suggested was achievable. The cuisses absorbed that refusal."
  },
  {
    "output": "Dragon God Leg Scales",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 158,
      "atk": 33,
      "dragonBless": 0.45,
      "fireResist": 0.72
    },
    "durability": 9200,
    "materials": {
      "First Dragon Scale": 6,
      "Calamity Dragon Scale": 5,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Primordial Core": 4
    },
    "lore": "The dragon god's legs covered distances that mortal geography has difficulty conceptualizing. A single step could move from one end of a continent to another. The scales on those legs experienced every terrain, every climate, every atmospheric condition the mortal world offers, and they developed a kind of comprehensive compatibility with all of it."
  },
  {
    "output": "Void-Coil Leggings",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 137,
      "voidResist": 0.58,
      "shadowStep": 0.28,
      "evasion": 0.24
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The void between things is not uniform — it has gradients, densities, regions of greater and lesser absence. The coil-pattern of the leggings' construction reflects those gradients. Together they give the wearer's legs a slight affinity with the in-between. Movement between positions is marginally faster; the transition from here to there is marginally smoother."
  },
  {
    "output": "Primordial Rootstep Greaves",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 150,
      "maxHp": 720,
      "braceAgainst": 0.52,
      "regeneration": 28
    },
    "durability": 9200,
    "materials": {
      "Primordial Core": 5,
      "World-Tree Branch": 7,
      "Fragment of the First Dawn": 5,
      "Ancient Heaven Metal": 10,
      "God-Vessel Iron Ingot": 8
    },
    "lore": "The greaves were made at the site of the world first geological stabilization: the moment the primordial chaos settled into something that could be stood upon. The greaves carry that stabilization as a material property. Wherever the wearer stands, the ground beneath them is briefly and significantly more stable than it was before they stood there."
  },
  {
    "output": "Calamity March Greaves",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 155,
      "fireResist": 0.7,
      "burnImmunity": true,
      "calamityChannel": 0.25
    },
    "durability": 9200,
    "materials": {
      "Calamity Dragon Scale": 7,
      "Eternal Flame Essence": 7,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Primordial Core": 3
    },
    "lore": "The march through world end is a documented event, a single walker moving through territory that was actively ending, through fire that was consuming the fabric of the second age. The walker kept going. The greaves absorbed the act of continuing to walk through something that should have made walking impossible. They make the wearer continue. In the end, that is what decided the second age ending."
  },
  {
    "output": "World-Ash Leggings",
    "type": "armor",
    "subtype": "leggings",
    "stats": {
      "def": 144,
      "ashCurse": 0.4,
      "allResist": 0.24,
      "maxHp": 580
    },
    "durability": 9200,
    "materials": {
      "World-Tree Branch": 7,
      "Eternal Flame Essence": 8,
      "Ancient Heaven Metal": 9,
      "Primordial Core": 4,
      "God-Vessel Iron Ingot": 8
    },
    "lore": "The World-Tree ash did not scatter on the wind like ordinary ash. It settled with intention, falling in patterns that botanists spent decades attempting to decode before concluding the patterns were not a message but a map: the ash had come to rest in the precise arrangement the tree would have preferred. The leggings are made from ash collected at the map center. They carry the axis of the fallen tree — the point around which all the tree weight was distributed. Standing in them, the wearer has that axis."
  }
];

const gloves = [
  {
    "output": "Void God Gauntlets",
    "stats": {
      "atk": 80,
      "def": 60,
      "critChance": 12
    },
    "durability": 480,
    "rarity": "mythic",
    "lore": "\"Shaped from void matter. Objects that touch them cease to exist for a fraction of a second.\"",
    "materials": {
      "Void Titan Core": 2,
      "Null Metal": 3,
      "God-Forged Iron": 2,
      "Primordial Alloy": 2
    }
  },
  {
    "output": "Dragon God Sovereign Claws",
    "stats": {
      "atk": 100,
      "speed": 20,
      "lifesteal": 8
    },
    "durability": 490,
    "rarity": "mythic",
    "lore": "\"Plated with Dragon God talons. Every punch lands with the weight of a god's wrath.\"",
    "materials": {
      "Dragon God Bone": 3,
      "Dragon King Heart": 1,
      "Eternal Metal": 3,
      "Primordial Alloy": 2
    }
  },
  {
    "output": "Chaos Sovereign Fists",
    "stats": {
      "atk": 90,
      "critChance": 15,
      "magicPower": 60
    },
    "durability": 475,
    "rarity": "mythic",
    "lore": "\"Each punch destabilizes the molecular structure of whatever it hits.\"",
    "materials": {
      "Chaos God Shard": 2,
      "Incarnate Core": 1,
      "Chaos Steel": 3,
      "Null Metal": 2
    }
  },
  {
    "output": "Null Void Executioner Gloves",
    "stats": {
      "atk": 85,
      "def": 55,
      "critChance": 13
    },
    "durability": 480,
    "rarity": "mythic",
    "lore": "\"Nullifies the target's pain tolerance. Makes every hit feel like the first.\"",
    "materials": {
      "Null Metal": 4,
      "Nullification Mana Stone": 2,
      "God-Forged Iron": 2
    }
  },
  {
    "output": "Primordial Sovereign Grips",
    "stats": {
      "atk": 95,
      "hp": 200,
      "speed": 15
    },
    "durability": 485,
    "rarity": "mythic",
    "lore": "\"Worn by the first hunter in recorded history. The blood on them is not theirs.\"",
    "materials": {
      "Primordial Heart": 2,
      "Primordial Alloy": 3,
      "Eternal Metal": 2,
      "Dragon God Bone": 1
    }
  },
  {
    "output": "Archmage's Final Gauntlets",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 88,
      "spellPower": 110,
      "energyMax": 300,
      "critSpell": 0.3
    },
    "durability": 9200,
    "materials": {
      "Archmage Heart": 4,
      "Eternal Mana Stone": 12,
      "Ancient Heaven Metal": 8,
      "Primordial Core": 3,
      "Fragment of the First Dawn": 4
    },
    "lore": "The Archmage's hands could not be studied after their death — they ascended with the rest of the body, leaving only these gauntlets. The gauntlets have a residual warmth that has not cooled in three centuries. Wearing them, a mage's hands know where they are going before the mind directs them. The gauntlets have been making extraordinary spells for a long time. They know the shape."
  },
  {
    "output": "Dragon Sovereign Claws",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 98,
      "atk": 65,
      "clawTear": 0.5,
      "dragonBless": 0.3
    },
    "durability": 9200,
    "materials": {
      "First Dragon Scale": 6,
      "Calamity Dragon Scale": 5,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Primordial Core": 4
    },
    "lore": "Dragon claws carry the dragon's fundamental authority over what can and cannot remain intact. The First Dragon could close a fist around anything and have it comply with opening. Not by force — by the simple fact that the dragon's grip made the object's continued integrity feel presumptuous. The gauntlets fashioned from those scale-claws carry a derivative of that authority. Armor dents under fingers that should not be able to dent it."
  },
  {
    "output": "Fate Weaver Gloves",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 82,
      "critChance": 25,
      "destinyBoost": 0.45,
      "foresight": 0.3
    },
    "durability": 9200,
    "materials": {
      "Epoch Mana Stone — Frozen Time": 6,
      "Fragment of the First Dawn": 6,
      "Soul of a Thousand Fallen": 6,
      "Realm-Tear Mana Stone": 5,
      "Primordial Core": 3
    },
    "lore": "Fate is not a force — it is a textile. A three-dimensional weave of cause and effect, of probability and decision. The Fate Weaver understood this literally and physically, and spent her life developing techniques for manipulating the weave with her hands. The gloves carry the muscle memory of a thousand successful alterations."
  },
  {
    "output": "Storm Sovereign Gauntlets",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 92,
      "atk": 55,
      "stunChance": 0.45,
      "lightningImmune": true
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "The Storm God's hands generated lightning not through machinery or magic but through the simple act of moving quickly through ionized air with sufficient authority. The gauntlets were built to allow a mortal hand to approximate that process: the inner lining accumulates charge from the wearer's own bioelectrical field. This produces a lightning strike concurrent with the physical strike."
  },
  {
    "output": "Null Gauntlets",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 87,
      "antiMagic": 0.65,
      "dispel": 0.55,
      "defBreak": 0.35
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The concept of cancellation — not destruction, not dispersal, but the precise reversal of something until it equals zero — was formalized by a mathematician who spent forty years proving it could be applied to magical effects. The gauntlets carry a material that is the exact inverse of magical energy. When the gauntlets contact a magical effect, the mathematics resolve: the effect and the anti-effect arrive at zero simultaneously, cleanly."
  },
  {
    "output": "Void Emperor's Iron Grip",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 96,
      "voidGrip": 0.7,
      "bindChance": 0.5,
      "darkResist": 0.55
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The Void Emperor's authority extended to things that do not exist — a jurisdiction that sounds absurd until you consider how much of any conflict involves things that are not yet present, not yet decided, not yet real. Possibilities, intentions, potential attacks — the Emperor ruled all of it. The gauntlets were the instrument of that rule: hands that could close around a possibility and prevent it from becoming actuality."
  },
  {
    "output": "Calamity Claws",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 90,
      "atk": 60,
      "fireResist": 0.75,
      "calamityChannel": 0.3
    },
    "durability": 9200,
    "materials": {
      "Calamity Dragon Scale": 7,
      "Eternal Flame Essence": 7,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Primordial Core": 3
    },
    "lore": "The Calamity Dragon's claws could strip a continent's surface layer in a single raking pass. They were not used for violence — the dragon did not think in those terms — but for the kind of clearing-away its assigned task required: removing the previous age's furniture to make room for the next one. Gloves fashioned from fragments of those claws carry the same quality. Whatever they are applied to is cleared."
  },
  {
    "output": "First Forger's Hands",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 86,
      "craftingBonus": 0.5,
      "atk": 55,
      "critChance": 18
    },
    "durability": 9200,
    "materials": {
      "Primordial Core": 5,
      "Fragment of the First Dawn": 6,
      "God-Vessel Iron Ingot": 10,
      "Ancient Heaven Metal": 8,
      "World-Tree Branch": 3
    },
    "lore": "The first blade was not made for violence — it was made because someone noticed that a sharp edge was more efficient than a blunt one and decided to make the sharpness intentional. The gloves worn during that first intentional shaping carry the birth of metallurgy in their material. They remember when shaping metal was a new idea, still warm with possibility, still informed by surprise that it worked."
  },
  {
    "output": "Epoch Crusher Gauntlets",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 94,
      "atk": 60,
      "timeshift": 0.25,
      "comboHits": 5
    },
    "durability": 9200,
    "materials": {
      "Epoch Mana Stone — Frozen Time": 7,
      "Realm-Tear Mana Stone": 5,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Void Singularity Shard": 4
    },
    "lore": "Temporal displacement requires physical anchoring — something real enough in the present to drag the action through the transition without it dispersing into probability. The gauntlets were developed for this purpose: hands that can reach through a moment of time displacement and still connect with a target on the other side. Each strike from these gauntlets lands in two temporal states simultaneously: now, and a fraction of a second ago."
  },
  {
    "output": "Sovereign Executioner Gauntlets",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 99,
      "atk": 58,
      "executionBonus": 0.6,
      "bossModifier": 1.4
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 4,
      "Primordial Core": 3,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 10,
      "World-Eater Fang": 3
    },
    "lore": "There is a touch that means finality — not the last strike in a fight but the moment before the last strike, when both parties understand what the outcome is going to be. The gauntlets carry that touch. They were worn by the Sovereign Executioner: the role of making final things final with the precision and certainty they deserved. Nothing lingered after those hands were applied to it. The gauntlets communicated something their target recognized as conclusive."
  },
  {
    "output": "World-Eater's Iron Hands",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 100,
      "atk": 65,
      "consume": 0.35,
      "defBreak": 0.45
    },
    "durability": 9200,
    "materials": {
      "World-Eater Fang": 5,
      "World-Eater Scale": 7,
      "Death Metal Ore": 10,
      "Ancient Heaven Metal": 8,
      "Primordial Core": 4
    },
    "lore": "The Great Devourer does not have hands — it has maws, which perform the function of hands with the additional quality of consuming whatever they handle. Gauntlets fashioned from its shed material carry an echo of this: whatever the gauntlets take hold of finds itself slightly diminished — not destroyed, not drained, but operating at slightly reduced capacity."
  },
  {
    "output": "Heavenly Sentinel Gauntlets",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 97,
      "sealingPower": 0.45,
      "allResist": 0.28,
      "bindChance": 0.35
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "The celestial gate has a guardian, and the gauntlets were part of the guardian official equipment — the means by which the gate itself was operated, opened, closed, sealed against unauthorized transit. The gate responds to the gauntlets touch: opens for them, closes on their command, holds against force that would otherwise breach it."
  },
  {
    "output": "Reality Sculptor Gauntlets",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 84,
      "realityTear": 0.4,
      "phaseThrough": 0.3,
      "spellPower": 80
    },
    "durability": 9200,
    "materials": {
      "Realm-Tear Mana Stone": 8,
      "Void Singularity Shard": 6,
      "Primordial Core": 4,
      "Archmage Heart": 3,
      "Eternal Mana Stone": 8
    },
    "lore": "A sculptor who worked not in stone but in the fabric of reality wore these gauntlets to protect their hands during work that would otherwise have left them existing in several states simultaneously. The gauntlets allowed clean manipulation: hands that could touch reality without being altered by it."
  },
  {
    "output": "Primordial Fist Wraps",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 88,
      "atk": 70,
      "comboHits": 6,
      "critChance": 20
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 6,
      "Primordial Core": 5,
      "World-Eater Fang": 3,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8
    },
    "lore": "Before the first weapon, before trained technique, before fighting had a methodology — someone threw the first punch. Not in self-defense, not in aggression, but as a pure expression of the discovery that force was an option. The moment was significant enough that the universe registered it: the first voluntary application of force from one entity to another. The wraps carry the energy of that moment — not the impact, not the decision, but the discovery."
  },
  {
    "output": "Gravity Master Gauntlets",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 91,
      "gravityCrush": 0.6,
      "atk": 55,
      "stunChance": 0.35
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "Gravity is not fixed. It is a consensus between objects, a mutual agreement on how much they should attract one another, and like all agreements it can be renegotiated. The gauntlets embody this renegotiation. Whatever they grip weighs, in that moment, exactly as much as the wearer decides it should. The physics cooperates because the gauntlets have already filed the paperwork."
  },
  {
    "output": "Star-Forge Gauntlets",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 96,
      "atk": 60,
      "burnAura": 0.45,
      "fireResist": 0.7
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 5,
      "Eternal Flame Essence": 10,
      "God-Vessel Iron Ingot": 10,
      "Ancient Heaven Metal": 8,
      "Primordial Core": 4
    },
    "lore": "A smith spent three hours at the sun core forging a single pair of gauntlets — three hours being the maximum the survivable-excursion technology permitted. The resulting gauntlets contain metal forged at stellar core conditions. They remember the synthesis. Whatever they touch, they subtly suggest new configurations."
  },
  {
    "output": "God-Bound Fist Wraps",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 97,
      "sealingPower": 0.55,
      "antiMagic": 0.4,
      "bindChance": 0.45
    },
    "durability": 9200,
    "materials": {
      "Nameless God Essence": 6,
      "Fragment of the First Dawn": 5,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 10,
      "Sky God Core": 4
    },
    "lore": "The thirteenth sealing was the hardest. The twelve gods preceding had been sealed by predecessors of these gloves. By the thirteenth, the gloves had accumulated enough divine residue that they functioned less like tools and more like arguments — presenting to the god being sealed a comprehensive case for why resistance was both futile and inappropriate. The thirteenth god paused for a long time. Then it was sealed."
  },
  {
    "output": "Serpent Coil Gauntlets",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 84,
      "poisonImmunity": true,
      "serpentBless": 0.38,
      "bindChance": 0.45
    },
    "durability": 9200,
    "materials": {
      "Ancient Scale — World Serpent": 9,
      "World Serpent Venom Gland": 5,
      "Realm-Tear Mana Stone": 5,
      "Void Singularity Shard": 4,
      "Primordial Core": 3
    },
    "lore": "The World Serpent coils around everything. Its coils are, in a technical sense, the oldest grip that exists — a hold that has been maintained since before the world had anything else to hold onto. The gauntlets replicate the coil pattern in their construction. The result is a grip that opponents find unexpectedly difficult to break. Not because of strength — because of geometry."
  },
  {
    "output": "Heaven-Seal Gauntlets",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 95,
      "sealingPower": 0.48,
      "holyResist": 0.6,
      "commandAura": 0.28
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "When divine power leaks into the mortal world without invitation, someone has to press it back. The Heaven-Seal Gauntlets were built for exactly that: hands that carry enough accumulated knowledge of divine structure to grip divine energy as if it were a solid object and reposition it. The divine energy, once properly handled, tends to return home without argument. It knows these hands. It has met them before."
  },
  {
    "output": "Primordial Stone Fists",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 100,
      "atk": 68,
      "groundShatter": 0.5,
      "stunChance": 0.38
    },
    "durability": 9200,
    "materials": {
      "Primordial Core": 6,
      "Fragment of the First Dawn": 5,
      "God-Vessel Iron Ingot": 12,
      "Ancient Heaven Metal": 10,
      "World-Eater Fang": 3
    },
    "lore": "Mountains were made by hands. Not metaphorically — the first mountain was pressed upward from the world surface by a force consistent with deliberate compression from below. The stone fists carry a fragment of whatever made that decision and executed it. Strikes from them do not spread force outward the way normal impacts do — they compress inward, the way a mountain is compressed upward."
  },
  {
    "output": "Void-Forged Iron Hands",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 85,
      "voidGrip": 0.55,
      "phaseThrough": 0.25,
      "defBreak": 0.38
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "Forging in the void means forging in the space between rules — where the conventions of metallurgy are suggestions, where the smith intention carries more weight than the material properties. The iron hands were made in three sessions, each in a different region of the void. They hold together through a structural logic that defies physical analysis. What they grip, they grip with the surety of something forged where the very concept of resistance was unavailable."
  },
  {
    "output": "Calamity Dragon Fist Wraps",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 93,
      "atk": 62,
      "calamityChannel": 0.32,
      "fireResist": 0.72
    },
    "durability": 9200,
    "materials": {
      "Calamity Dragon Scale": 7,
      "Eternal Flame Essence": 7,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Primordial Core": 3
    },
    "lore": "The Calamity Dragon's scales are not scales in the biological sense — they are the accumulated record of everything the dragon has passed through, compressed into a surface layer that reflects every age it has helped end. Each scale carries the specific thermal signature of a different catastrophe. The fist wraps carry all of those records simultaneously. When the wearer strikes something, they strike it with the combined weight of every ending the dragon has overseen."
  },
  {
    "output": "World-Ash Gauntlets",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 90,
      "spellPower": 95,
      "atk": 52,
      "ashCurse": 0.4
    },
    "durability": 9200,
    "materials": {
      "World-Tree Branch": 7,
      "Eternal Flame Essence": 8,
      "Archmage Heart": 3,
      "Eternal Mana Stone": 8,
      "Primordial Core": 3
    },
    "lore": "When the World-Tree burned, one smith stood close enough to catch the ash but far enough not to be consumed. They spent the next twenty years forging the ash into armor. The World-Tree's ash had not forgotten what it used to be. The gauntlets carry that memory: hands wearing them know what things used to be before they became what they are."
  },
  {
    "output": "Ruin Painter Gloves",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 83,
      "ruinField": 0.45,
      "defIgnore": 0.4,
      "touchBreak": 0.55
    },
    "durability": 9200,
    "materials": {
      "Shattered World Mana Stone": 7,
      "Nameless God Essence": 3,
      "Death Metal Ore": 10,
      "Void Singularity Shard": 5,
      "Soul of a Thousand Fallen": 5
    },
    "lore": "The Ruin Painter documented the fall of civilizations by pressing their hands into the ruins and absorbing the residue of what had ended. The energy released by large-scale civilizational collapse is not designed for individual human contact. The gloves were developed to mediate. After thirty years of this work, the gloves have absorbed so much ruin-energy that touching things with them introduces a trace of that energy to whatever is touched. Armor that should hold begins to consider not holding. Structures that should support begin to remember that they are temporary."
  },
  {
    "output": "Serpent Kiss Gloves",
    "type": "armor",
    "subtype": "gloves",
    "stats": {
      "def": 81,
      "poisonImmunity": true,
      "atk": 45,
      "critChance": 16
    },
    "durability": 9200,
    "materials": {
      "World Serpent Venom Gland": 7,
      "Ancient Scale — World Serpent": 8,
      "Death Metal Ore": 8,
      "Void Singularity Shard": 4,
      "Realm-Tear Mana Stone": 4
    },
    "lore": "The World Serpent venom is not aggressive — it is absolute. It does not attack cells; it completes them, in the way that a full stop completes a sentence. The venom glands used in these gloves were donated by the Serpent itself, apparently finding the request interesting enough to engage with. The result: the touch carries venom without the wearer being venomous. The gloves are the translation layer — they hold the venom in suspension and release it on contact with an appropriate target. The Serpent venom recognizes appropriate target more accurately than the wearer might."
  }
];

const accessories = [
  {
    "output": "Void God Sigil Ring",
    "stats": {
      "atk": 60,
      "magicPower": 100,
      "critChance": 12
    },
    "durability": 999,
    "rarity": "mythic",
    "lore": "\"The official sigil of a dead god. Wearing it marks you as something beyond human.\"",
    "materials": {
      "God Corpse Fragment": 2,
      "Abyss God Eye": 1,
      "Null Metal": 3,
      "Primordial Alloy": 2
    }
  },
  {
    "output": "Dragon God Sovereign Talisman",
    "stats": {
      "hp": 600,
      "def": 80,
      "atk": 50
    },
    "durability": 999,
    "rarity": "mythic",
    "lore": "\"The last talisman of the Dragon God lineage. It hums when danger approaches. It never stops humming.\"",
    "materials": {
      "Dragon God Bone": 3,
      "Dragon King Heart": 2,
      "Eternal Metal": 3,
      "Primordial Alloy": 2
    }
  },
  {
    "output": "Eternal Chaos Core Pendant",
    "stats": {
      "magicPower": 180,
      "critChance": 14,
      "atk": 50
    },
    "durability": 999,
    "rarity": "mythic",
    "lore": "\"Contains a compressed chaos fragment. It destabilizes nearby magic. Constantly.\"",
    "materials": {
      "Chaos God Shard": 2,
      "Incarnate Core": 2,
      "Fractured Divine Core": 1,
      "Chaos Steel": 3
    }
  },
  {
    "output": "Null Void Annihilator Seal",
    "stats": {
      "atk": 80,
      "def": 100,
      "hp": 400
    },
    "durability": 999,
    "rarity": "mythic",
    "lore": "\"A seal used to bind a null entity. The entity is gone. The seal remembers everything it did.\"",
    "materials": {
      "Null Metal": 4,
      "Nullification Mana Stone": 3,
      "Void Titan Core": 1,
      "God-Forged Iron": 2
    }
  },
  {
    "output": "Primordial God Eye Brooch",
    "stats": {
      "critChance": 20,
      "magicPower": 150,
      "speed": 30
    },
    "durability": 999,
    "rarity": "mythic",
    "lore": "\"An actual eye from a primordial deity. It has seen the birth and death of stars. It judges.\"",
    "materials": {
      "Void Dragon Primordial Eye": 2,
      "Primordial Heart": 2,
      "Primordial Alloy": 3,
      "God Essence Trace": 2
    }
  },
  {
    "output": "Ring of the First Hunter",
    "type": "accessory",
    "subtype": "ring",
    "stats": {
      "atk": 70,
      "critChance": 20,
      "hunting": 0.5,
      "tracking": true
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 5,
      "Primordial Core": 3,
      "World-Eater Fang": 3,
      "Ancient Heaven Metal": 5,
      "Soul of a Thousand Fallen": 4
    },
    "lore": "The first hunt lasted fourteen days. The ring was made after that hunt from a fragment of what was caught. It has been passed from hunter to hunter across more generations than language survived to count. The ring still knows what it was made from. It still remembers the fourteen days, the patience, the certainty that something being hard to find did not mean it was impossible to find."
  },
  {
    "output": "Dragon Lord Signet",
    "type": "accessory",
    "subtype": "ring",
    "stats": {
      "dragonBless": 0.6,
      "atk": 60,
      "fireResist": 0.65,
      "commandAura": 0.35
    },
    "durability": 9200,
    "materials": {
      "First Dragon Scale": 6,
      "Calamity Dragon Scale": 5,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Primordial Core": 4
    },
    "lore": "The Dragon Lord is a title, a position, a resonance frequency in the collective draconic consciousness that every dragon recognizes as authority. Whoever holds this signet ring resonates at that frequency. The dragons do not follow the wearer because they are commanded to; they follow because the ring communicates something biological and ancient that their nature is organized around."
  },
  {
    "output": "World-Serpent Scale Choker",
    "type": "accessory",
    "subtype": "necklace",
    "stats": {
      "maxHp": 1200,
      "poisonImmunity": true,
      "serpentBless": 0.45,
      "evasion": 0.25
    },
    "durability": 9200,
    "materials": {
      "Ancient Scale — World Serpent": 10,
      "World Serpent Venom Gland": 5,
      "Ancient Heaven Metal": 8,
      "Primordial Core": 4,
      "Realm-Tear Mana Stone": 5
    },
    "lore": "The World Serpent encircles everything. Its body forms the outer boundary of the world — not a wall but a perimeter. The choker is made from scales taken from the inside of that perimeter. The wearer is, in a precise and specific sense, at the center of a boundary maintained by something that has been keeping the world intact for longer than the world has had a name."
  },
  {
    "output": "God-Forged Amulet",
    "type": "accessory",
    "subtype": "necklace",
    "stats": {
      "allResist": 0.35,
      "maxHp": 1000,
      "allStats": 0.15,
      "holyResist": 0.5
    },
    "durability": 9200,
    "materials": {
      "Nameless God Essence": 5,
      "Fragment of the First Dawn": 6,
      "God-Vessel Iron Ingot": 12,
      "Ancient Heaven Metal": 10,
      "Primordial Core": 4
    },
    "lore": "A god made something for a mortal. This is unusual because gods generally do not engage in manufacturing. This particular god made an exception because they found a mortal whose existence they considered worth maintaining. The amulet protects against most of everything the god could foresee. Whether the mortal the god intended it for ever actually used it is unrecorded. What remains is the protection, still active, waiting for whoever needs it."
  },
  {
    "output": "Calamity Pendant",
    "type": "accessory",
    "subtype": "necklace",
    "stats": {
      "atk": 75,
      "fireResist": 0.8,
      "calamityChannel": 0.35,
      "burnImmunity": true
    },
    "durability": 9200,
    "materials": {
      "Calamity Dragon Scale": 7,
      "Eternal Flame Essence": 7,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Primordial Core": 3
    },
    "lore": "Standing at the center of a calamity while it is happening is something that survival literature generally recommends against. The pendant was worn there anyway. What they reported afterward was that the center of the calamity was paradoxically calm — not peaceful, but organized, purposeful, directed. The pendant carries that quality. Wearing it in the middle of catastrophe, the wearer finds the center."
  },
  {
    "output": "Star Tear Earring",
    "type": "accessory",
    "subtype": "earring",
    "stats": {
      "spellPower": 120,
      "energyMax": 400,
      "critSpell": 0.35,
      "voidResist": 0.4
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Mana Stone": 10,
      "Void Singularity Shard": 6,
      "Primordial Core": 3,
      "Soul of a Thousand Fallen": 5
    },
    "lore": "Stars express emotion through changes in luminosity. A star that grieves becomes briefly, measurably brighter. The earring is made from a crystallized fragment of one such moment of stellar grief. Wearing it, the magical output has that same quality: more saturated, more insistent, carrying something in it that recipients cannot quite identify but cannot ignore."
  },
  {
    "output": "Time Lock Bracelet",
    "type": "accessory",
    "subtype": "bracelet",
    "stats": {
      "cdReduction": 0.55,
      "timeshift": 0.25,
      "allStats": 0.12,
      "spd": 20
    },
    "durability": 9200,
    "materials": {
      "Epoch Mana Stone — Frozen Time": 8,
      "Realm-Tear Mana Stone": 6,
      "Fragment of the First Dawn": 4,
      "Ancient Heaven Metal": 6,
      "Primordial Core": 3
    },
    "lore": "There was a moment when everything in the world was exactly right. The moment lasted approximately six seconds. The bracelet was forged during those six seconds by someone who recognized what was happening and chose to spend the time forging rather than simply experiencing it. The resulting bracelet is permanently that moment. Time moves around it differently — slightly slowed, as if the universe is attempting to maintain the conditions that made the moment possible."
  },
  {
    "output": "Void Sovereignty Ring",
    "type": "accessory",
    "subtype": "ring",
    "stats": {
      "voidMastery": 0.55,
      "energyMax": 450,
      "darkResist": 0.6,
      "shadowStep": 0.3
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The Nothing Kingdom is the largest kingdom in existence and the least populated — it covers all the space between things, all the silence between words, all the darkness between lights. Its ruler is whoever has demonstrated most complete comprehension of absence. The ring authorizes the wearer to operate within the Nothing Kingdom. The void, when you have standing with it, is a very powerful ally."
  },
  {
    "output": "Origin Belt",
    "type": "accessory",
    "subtype": "belt",
    "stats": {
      "def": 90,
      "allStats": 0.18,
      "chainBind": 0.35,
      "primordialAura": 0.4
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 8,
      "Primordial Core": 6,
      "Ancient Heaven Metal": 10,
      "God-Vessel Iron Ingot": 10,
      "World-Tree Branch": 4
    },
    "lore": "Before the world had rules, everything was possible because nothing had been established as impossible yet. The belt was fastened during that period, which means it predates every restriction that currently structures existence. It does not break those restrictions — it precedes them. Whatever the belt touches carries a residue of preexistent possibility."
  },
  {
    "output": "Fallen God Chain",
    "type": "accessory",
    "subtype": "necklace",
    "stats": {
      "godSlaying": 0.45,
      "allResist": 0.25,
      "divineResist": 0.55,
      "maxHp": 800
    },
    "durability": 9200,
    "materials": {
      "Nameless God Essence": 6,
      "War of Gods Relic": 5,
      "Fragment of the First Dawn": 5,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8
    },
    "lore": "When a god is defeated — truly defeated, not sealed but undone — what remains is the organized authority they carried, fragmented but still charged. The chain is made from links of such a structure. The links still carry the charge: wearing the chain, the wearer is surrounded by the residual authority of a defeated god, which has the useful property of being recognized by other gods as something that has already survived the meeting of divine power with its end."
  },
  {
    "output": "Sovereign Sight Monocle",
    "type": "accessory",
    "subtype": "earring",
    "stats": {
      "trueVision": true,
      "enemyWeaknessReveal": true,
      "critChance": 22,
      "foresight": 0.3
    },
    "durability": 9200,
    "materials": {
      "Nameless God Essence": 4,
      "Realm-Tear Mana Stone": 7,
      "Epoch Mana Stone — Frozen Time": 5,
      "Archmage Heart": 3,
      "Eternal Mana Stone": 8
    },
    "lore": "The Eye of Absolute Perception was a title, not an organ — until it became both. A seer who spent sixty years developing their vision eventually reached a state where one of their eyes was no longer quite organic. After their death, the monocle was all that remained. The glass carries sixty years of increasingly refined perception. Looking through it, the wearer sees the structural logic beneath the present."
  },
  {
    "output": "World-Heart Earring",
    "type": "accessory",
    "subtype": "earring",
    "stats": {
      "maxHp": 1300,
      "regeneration": 50,
      "lifesteal": 0.18,
      "soulLink": true
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 4,
      "Primordial Core": 3,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 10,
      "World-Eater Fang": 3
    },
    "lore": "The world's heartbeat can be felt at certain geological nodes. Geologists who found those nodes reported the same thing: a rhythm that matched no biological heartbeat, too slow for any living creature, too regular for any geological process. The earring carries a resonating crystal grown at one of those nodes. Wearing it, the wearer's own heartbeat gradually synchronizes with the world's. After that, the body is harder to stop than it was before."
  },
  {
    "output": "Void Compass Ring",
    "type": "accessory",
    "subtype": "ring",
    "stats": {
      "foresight": 0.45,
      "cdReduction": 0.35,
      "allStats": 0.14,
      "destinyBoost": 0.4
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "A compass points north because it is sensitive to a real force in a real direction. The Void Compass points to what matters, which suggests that importance has a direction too. The ring carries an instrument that was in the void long enough to learn what the void considers relevant. The void has no ego; it has no politics. It finds things significant based on their actual consequence."
  },
  {
    "output": "Epoch Anchor Bracelet",
    "type": "accessory",
    "subtype": "bracelet",
    "stats": {
      "phaseImmune": true,
      "timeshift": 0.2,
      "allResist": 0.28,
      "cdReduction": 0.3
    },
    "durability": 9200,
    "materials": {
      "Epoch Mana Stone — Frozen Time": 7,
      "Realm-Tear Mana Stone": 5,
      "Ancient Heaven Metal": 7,
      "Fragment of the First Dawn": 4,
      "Primordial Core": 3
    },
    "lore": "Temporal displacement — being moved against your will into another time period — is a hazard of operating near dimensional boundaries. The bracelet was developed for precisely this: it anchors the wearer to the present tense. The anchor does not prevent the wearer from accessing other times deliberately. It prevents anyone or anything else from moving them there involuntarily. The present, when defended, turns out to be a very good place to fight from."
  },
  {
    "output": "Soul Binding Choker",
    "type": "accessory",
    "subtype": "necklace",
    "stats": {
      "maxHp": 1100,
      "soulLink": true,
      "revivals": 2,
      "energyMax": 300
    },
    "durability": 9200,
    "materials": {
      "Soul of a Thousand Fallen": 12,
      "Fragment of the First Dawn": 5,
      "Primordial Core": 5,
      "Nameless God Essence": 4,
      "Realm-Tear Mana Stone": 5
    },
    "lore": "The soul is not fully contained by a single life — this is the thesis that the Soul Binder spent three lifetimes proving. Each life they wore this choker. Each death, they left instructions for where it would be, and each new life, they found it. By the third life, the choker had absorbed enough of their soul to function as a partial continuity mechanism itself."
  },
  {
    "output": "Calamity Ring",
    "type": "accessory",
    "subtype": "ring",
    "stats": {
      "fireResist": 0.85,
      "burnImmunity": true,
      "calamityChannel": 0.4,
      "atk": 65
    },
    "durability": 9200,
    "materials": {
      "Calamity Dragon Scale": 7,
      "Eternal Flame Essence": 7,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 8,
      "Primordial Core": 3
    },
    "lore": "Three ages ended in fire. Not symbolic fire — actual, world-spanning conflagrations. The ring was present for all three: forged in the first fire, worn through the second, recovered after the third. Between ages, it waited in the ash, which is the most patient thing a material can do. After three age-ending fires, the material is no longer in any meaningful danger of burning. Fire recognizes this. It does not try the same thing a fourth time."
  },
  {
    "output": "Heaven's Tear Drop Pendant",
    "type": "accessory",
    "subtype": "necklace",
    "stats": {
      "allResist": 0.3,
      "maxHp": 900,
      "holyResist": 0.55,
      "commandAura": 0.25
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "The sky wept once. Not rain — rain is mechanical, meteorological. The sky wept: produced, from its own substance, a single drop of something that fell slowly, without wind, straight down for approximately one hour before reaching the ground. Researchers found it composed of materials that matched nothing in the known world periodic tables. The pendant contains that drop, preserved. The sky has not wept since."
  },
  {
    "output": "Abyss King Crown Ring",
    "type": "accessory",
    "subtype": "ring",
    "stats": {
      "darkResist": 0.65,
      "voidMastery": 0.45,
      "intimidate": 0.5,
      "maxHp": 700
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "Depth has a king. The deepest dark has a ruler, and their authority is recognized not through allegiance but through the fundamental organization of darkness itself. The ring carries that authority as a credential. Wearing it, the wearer has standing in the darkest places — not safe passage, because the abyss is not safe, but recognized authority."
  },
  {
    "output": "First Light Earring",
    "type": "accessory",
    "subtype": "earring",
    "stats": {
      "allStats": 0.18,
      "critChance": 20,
      "lightningImmune": true,
      "trueVision": true
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 10,
      "Primordial Core": 5,
      "Sky God Core": 4,
      "Ancient Heaven Metal": 7,
      "Eternal Stormstone": 5
    },
    "lore": "The first dawn was different from all subsequent dawns. It was not the sun rising over an existing world — it was light establishing itself in a place that had never had light before. The earring is a crystal grown in that specific light. The vision it grants sees potential rather than limitation."
  },
  {
    "output": "Tide Sovereign Belt",
    "type": "accessory",
    "subtype": "belt",
    "stats": {
      "def": 95,
      "waterResist": 0.8,
      "maxHp": 700,
      "regeneration": 30
    },
    "durability": 9200,
    "materials": {
      "Primordial Core": 5,
      "Ancient Heaven Metal": 8,
      "World-Eater Scale": 6,
      "God-Vessel Iron Ingot": 8,
      "Eternal Stormstone": 6
    },
    "lore": "The tides obey no king — everyone knows this. They respond to gravity, to celestial mechanics, to forces too vast and impersonal to be commanded. Everyone knows this, and yet the belt exists, and the tides, in its presence, behave differently. Not dramatically. They adjust. Slightly. In the direction that best serves whoever is wearing the belt. The ocean has not confirmed this arrangement. It has also not denied it."
  },
  {
    "output": "Cursed King's Signet",
    "type": "accessory",
    "subtype": "ring",
    "stats": {
      "allStats": 0.2,
      "curseResist": 0.6,
      "darkResist": 0.45,
      "atk": 55
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The Cursed King received a divine blessing that went wrong — not because the god intention was malicious, but because a blessing of absolute power misapplied to a mortal context produces something that functions more like a curse from the inside. The king wore this signet through the entire process. By the end, the curse had been thoroughly studied and partially resolved by sheer familiarity. The ring now protects against curses not by resisting them but by having already been through the worst version of one and knowing where the exits are."
  },
  {
    "output": "Infinity Choker",
    "type": "accessory",
    "subtype": "necklace",
    "stats": {
      "maxHp": 1400,
      "stamina": 0.6,
      "fatigueless": true,
      "endurance": 0.55
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 7,
      "Primordial Core": 5,
      "Ancient Heaven Metal": 9,
      "Soul of a Thousand Fallen": 9,
      "God-Vessel Iron Ingot": 8
    },
    "lore": "A hunter who could not stop. Not because they did not want to — they very much wanted to rest. The choker was built for them by a smith who understood that some people are constitutionally unable to stop and that this inability deserves accommodation rather than criticism. The hunter used it for sixty years. At the end, they sat down voluntarily for the first time. They said it was a good chair."
  },
  {
    "output": "Pale Moon Earring",
    "type": "accessory",
    "subtype": "earring",
    "stats": {
      "evasion": 0.35,
      "spd": 30,
      "phaseChance": 0.25,
      "darkResist": 0.5
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The pale moon that appears sometimes in a sky that contains no moon has been documented in six separate cultures astronomical records, always at moments of significant historical transition. It provides light without a source. The earring is made from material that absorbs this sourceless light. The wearer moves in pale-moon light at all times — partially visible, partially not, defined by a light that does not come from anywhere anyone can target."
  },
  {
    "output": "Convergence Bracelet",
    "type": "accessory",
    "subtype": "bracelet",
    "stats": {
      "atk": 70,
      "def": 70,
      "allStats": 0.16,
      "destinyBoost": 0.5
    },
    "durability": 9200,
    "materials": {
      "Epoch Mana Stone — Frozen Time": 6,
      "Fragment of the First Dawn": 6,
      "Realm-Tear Mana Stone": 5,
      "Soul of a Thousand Fallen": 7,
      "Primordial Core": 4
    },
    "lore": "Every path that led to the great convergence left a resonance at that location. The bracelet was made at the convergence point, after the moment had passed, from the residual material that accumulated narrative had left crystallized in the rock. It carries the endpoint quality of a thousand destinies. Wearing it, someone approaching their own convergence finds themselves arriving at it correctly."
  },
  {
    "output": "God's Own Belt",
    "type": "accessory",
    "subtype": "belt",
    "stats": {
      "def": 110,
      "maxHp": 1000,
      "godEssence": 0.35,
      "allResist": 0.3
    },
    "durability": 9200,
    "materials": {
      "Nameless God Essence": 6,
      "Fragment of the First Dawn": 7,
      "God-Vessel Iron Ingot": 12,
      "Ancient Heaven Metal": 10,
      "Primordial Core": 5
    },
    "lore": "A hunter asked a god politely for their belt. The god, in the middle of a transition — moving from one form of existence to a less material one — found the request sufficiently odd to be charming and complied. The belt was designed for divine use: it holds not just clothing but authority, not just weight but significance. On a mortal form, most of these functions are suppressed, but enough remain: the wearer occupies space with slightly more weight than their mass justifies."
  },
  {
    "output": "Wraithbond Necklace",
    "type": "accessory",
    "subtype": "necklace",
    "stats": {
      "maxHp": 1000,
      "soulLink": true,
      "atk": 60,
      "ghostPower": 0.4
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "Every hunter who dies leaves a residue — not a ghost, not a memory, but a structural mark in the space they last operated in. A collector who understood this spent forty years finding those marks and linking them: building a network of the fallen, not to reanimate them but to honor the link between hunters who had faced the same things. Wearing it, the wearer is connected to every hunter who died doing what the wearer is currently doing. They do not receive advice or power — they receive company."
  },
  {
    "output": "Ruin Sigil Ring",
    "type": "accessory",
    "subtype": "ring",
    "stats": {
      "ruinAffinity": 0.55,
      "allResist": 0.22,
      "scavenge": 0.45,
      "atk": 58
    },
    "durability": 9200,
    "materials": {
      "Shattered World Mana Stone": 8,
      "Fallen Kingdom Crown Fragment": 6,
      "Death Metal Ore": 8,
      "Void Singularity Shard": 5,
      "Soul of a Thousand Fallen": 6
    },
    "lore": "The authority over ruins is the authority over the space between what was and what will be. The ring carries credentials sealed at the moment of a civilization end by its last authority, for whoever came after. The sigil authorizes access to the residue of endings. The wearer finds that rubble yielding."
  },
  {
    "output": "Death Sovereign Pendant",
    "type": "accessory",
    "subtype": "necklace",
    "stats": {
      "deathResist": 0.7,
      "maxHp": 1100,
      "lifesteal": 0.2,
      "soulCapture": 0.3
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The final moment — the very last moment of any life — has a sovereign who decides how orderly the passage is. The pendant was the sovereign instrument of office. Carrying it, the wearer is on good terms with the final moment. It will delay itself for them. Not indefinitely — the sovereign has a schedule to maintain — but once, reliably, at the moment it would have been most inconvenient."
  },
  {
    "output": "Stormbreaker Circlet",
    "type": "accessory",
    "subtype": "bracelet",
    "stats": {
      "lightningImmune": true,
      "windResist": 0.7,
      "allResist": 0.28,
      "atk": 65
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "The last storm was the final storm that a civilization collectively decided would be the one they ended rather than endured. The decision was made during the storm itself. The circlet was on the wrist of the person who made that decision out loud, and whose making it out loud caused everyone else to start making it too. The circlet carries the quality of that moment: the specific courage of deciding, in the middle of the worst thing happening, that the worst thing is going to stop because you have decided it will."
  },
  {
    "output": "Cosmic Chain Belt",
    "type": "accessory",
    "subtype": "belt",
    "stats": {
      "def": 98,
      "allStats": 0.16,
      "cosmicResonance": 0.38,
      "maxHp": 750
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "The chains between stars are gravitational: real forces, real connections, real tensions. The belt links were forged at the gravitational midpoints between specific pairs of stars: locations where two gravitational pulls are exactly equal, creating a point of perfect cosmic tension. The wearer, wearing it, benefits from that stability: they are difficult to move, difficult to unbalance, difficult to destabilize."
  },
  {
    "output": "Primordial Hearth Ring",
    "type": "accessory",
    "subtype": "ring",
    "stats": {
      "fireResist": 0.7,
      "maxHp": 900,
      "regeneration": 35,
      "burnImmunity": true
    },
    "durability": 9200,
    "materials": {
      "Eternal Flame Essence": 7,
      "Primordial Core": 4,
      "Fragment of the First Dawn": 4,
      "Ancient Heaven Metal": 6,
      "God-Vessel Iron Ingot": 7
    },
    "lore": "Before fire had a name, before anyone had decided that the warm thing in the center of the camp was something distinct from the cold darkness around it, someone sat near it and felt safe. The ring was made at a hearth so old it predates the invention of hearths as a concept. The warmth has never gone out. The ring carries a fragment of it: the specific quality of warmth that predates danger, that exists in a world that has not yet invented threats."
  },
  {
    "output": "Heaven-Sealed Choker",
    "type": "accessory",
    "subtype": "necklace",
    "stats": {
      "allResist": 0.32,
      "holyResist": 0.58,
      "commandAura": 0.28,
      "maxHp": 850
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 4,
      "Eternal Stormstone": 7,
      "Ancient Heaven Metal": 9,
      "God-Vessel Iron Ingot": 9,
      "Fragment of the First Dawn": 4
    },
    "lore": "The sky blesses and binds simultaneously. A blessing from the sky is a binding to its framework. The choker was made at the moment a sky-blessing was granted to a mortal who survived the process, which is not a guaranteed outcome of sky-blessings. The survivor wore it for the rest of their life. The framework, once accepted, turns out to be protective."
  },
  {
    "output": "Primordial Hearth Bracelet",
    "type": "accessory",
    "subtype": "bracelet",
    "stats": {
      "regeneration": 45,
      "maxHp": 850,
      "allResist": 0.22,
      "fireResist": 0.65
    },
    "durability": 9200,
    "materials": {
      "Eternal Flame Essence": 7,
      "Primordial Core": 4,
      "Fragment of the First Dawn": 4,
      "Ancient Heaven Metal": 6,
      "Soul of a Thousand Fallen": 5
    },
    "lore": "Before fire had a name, before anyone had decided that the warm thing in the center of the camp was something distinct from the cold darkness around it, someone sat near it and felt safe. The bracelet was made at a hearth so old it predates the invention of hearths as a concept. The warmth in its material has never gone out — not metaphorically, but literally: instruments placed near it register a persistent, sourceless thermal output that has not diminished in the centuries since its discovery."
  },
  {
    "output": "Death Sovereign Ring",
    "type": "accessory",
    "subtype": "ring",
    "stats": {
      "deathResist": 0.68,
      "revivals": 1,
      "darkResist": 0.55,
      "soulCapture": 0.35
    },
    "durability": 9200,
    "materials": {
      "Death Metal Ore": 11,
      "Soul of a Thousand Fallen": 9,
      "Nameless God Essence": 5,
      "Void Singularity Shard": 6,
      "Fragment of the First Dawn": 4
    },
    "lore": "The final moment — the very last moment of any life — has a sovereign who decides how orderly the passage is. The ring was the sovereign signet: the credential that the final moment recognized and deferred to. Carrying it, the wearer is on good terms with the final moment. It will delay itself for them. Not indefinitely — the sovereign has a schedule to maintain — but once, reliably, at the moment it would have been most inconvenient."
  },
  {
    "output": "Cosmic Sigil Belt",
    "type": "accessory",
    "subtype": "belt",
    "stats": {
      "def": 92,
      "allStats": 0.17,
      "cosmicResonance": 0.42,
      "allResist": 0.22
    },
    "durability": 9200,
    "materials": {
      "Sky God Core": 5,
      "Fragment of the First Dawn": 6,
      "Primordial Core": 4,
      "Ancient Heaven Metal": 8,
      "Eternal Stormstone": 7
    },
    "lore": "Stars communicate. Not in any language that mortal ears were designed to receive, but through the patterns of their light: the frequencies they choose to emit, the intensities they sustain, the rhythms of their fluctuation. A scholar who spent forty years learning to decode stellar communication received, near the end of their career, what they described as a direct message. The belt was their response — the only medium through which they could reply in kind, inscribed with sigils derived from stellar light-language. Whether the stars received the response is unknown. Stars, on clear nights, seem to arrange their light slightly differently over whoever wears it."
  }
];

const artifacts = [
  {
    "output": "God Corpse Relic",
    "stats": {
      "atk": 100,
      "hp": 600,
      "magicPower": 120,
      "critChance": 10,
      "lifesteal": 6
    },
    "durability": 999,
    "rarity": "mythic",
    "lore": "\"The preserved remains of a nameless god. It radiates power beyond comprehension.\"",
    "materials": {
      "God Corpse Fragment": 5,
      "God Essence Trace": 3,
      "Primordial Alloy": 3,
      "Eternal Metal": 2
    }
  },
  {
    "output": "World Crack Relic Stone",
    "stats": {
      "atk": 120,
      "def": 80,
      "hp": 500,
      "critChance": 12
    },
    "durability": 999,
    "rarity": "mythic",
    "lore": "\"A fragment of the crack that split the world in the First Age. Still growing.\"",
    "materials": {
      "World Crack Shard": 6,
      "Reality Tear": 3,
      "Chaos Steel": 3,
      "Null Metal": 2
    }
  },
  {
    "output": "Dragon God Heart Relic",
    "stats": {
      "atk": 110,
      "hp": 800,
      "lifesteal": 10
    },
    "durability": 999,
    "rarity": "mythic",
    "lore": "\"The actual preserved heart of the last Dragon God. It still beats, once every hour.\"",
    "materials": {
      "Dragon King Heart": 3,
      "Primordial Heart": 2,
      "Dragon God Bone": 4,
      "Eternal Metal": 2
    }
  },
  {
    "output": "Fractured Divine Relic Core",
    "stats": {
      "magicPower": 250,
      "critChance": 15,
      "atk": 80
    },
    "durability": 999,
    "rarity": "mythic",
    "lore": "\"Broken off from the divine realm when it collapsed. It is trying to rebuild itself.\"",
    "materials": {
      "Fractured Divine Core": 5,
      "God Essence Trace": 4,
      "Primordial Alloy": 3,
      "Chaos Steel": 2
    }
  },
  {
    "output": "Void Titan Null Core Relic",
    "stats": {
      "def": 200,
      "hp": 600,
      "atk": 90,
      "speed": 30
    },
    "durability": 999,
    "rarity": "mythic",
    "lore": "\"The core of the last Void Titan. Contains a nullification field that extends 3 meters at all times.\"",
    "materials": {
      "Void Titan Core": 4,
      "Titan Null Plate": 2,
      "Null Metal": 5,
      "God-Forged Iron": 3
    }
  },
  {
    "output": "Artifact — Sovereignty Orb of the Last God-King",
    "type": "artifact",
    "subtype": "orb",
    "stats": {
      "commandAura": 0.55,
      "allStats": 0.22,
      "regalAuthority": 0.6,
      "bossModifier": 1.5
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 8,
      "Nameless God Essence": 6,
      "Sky God Core": 5,
      "Ancient Heaven Metal": 10,
      "God-Vessel Iron Ingot": 10
    },
    "lore": "The last God-King was the last entity to hold simultaneous authority over the divine and mortal realms. They left behind this orb. The orb has two faces: one side warm, catching and holding light; the other cold, deflecting all light that approaches it. In the hand of whoever carries it, the orb does not spin or glow. It simply is — and the being that simply is, in the presence of this artifact, is treated by everything nearby as something with the right to be there."
  },
  {
    "output": "Artifact — Fragment of the Primordial Forge",
    "type": "artifact",
    "subtype": "core",
    "stats": {
      "craftingBonus": 0.7,
      "atk": 90,
      "allResist": 0.2
    },
    "durability": 9200,
    "materials": {
      "Primordial Core": 8,
      "Fragment of the First Dawn": 8,
      "God-Vessel Iron Ingot": 15,
      "Ancient Heaven Metal": 12,
      "World-Tree Branch": 5
    },
    "lore": "The Primordial Forge is where the materials of the world were first given their properties. A fragment of its working surface carries the memory of every material that has ever been shaped on it. Using it for crafting is to work on the same surface where everything was made."
  },
  {
    "output": "Artifact — Tome of All Endings",
    "type": "artifact",
    "subtype": "tome",
    "stats": {
      "spellPower": 190,
      "executionBonus": 0.55,
      "allSkillPower": 0.3,
      "lifeBane": 0.2
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "Every ending has been documented in this tome. Not the circumstances — the endings themselves: the exact quality of finality, the specific character of each conclusion. The scholar who wrote it spent three hundred years pursuing endings to understand them, not to cause them. They concluded that endings are the most honest moments in any process — stripped of pretense, stripped of future, purely and completely themselves."
  },
  {
    "output": "Artifact — Compass of the Void Between Worlds",
    "type": "artifact",
    "subtype": "core",
    "stats": {
      "voidMastery": 0.6,
      "foresight": 0.45,
      "domainExpand": 0.5,
      "trueVision": true
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The Compass was built to navigate the dimensional interstitial — the medium through which reality transitions between one set of rules and another. It has been between more worlds than most travelers experience in a lifetime. The needle does not point north. It points to where the rules are thinnest. In combat, this translates to pointing at the weakness in any opponent fundamental assumptions about what the fight is."
  },
  {
    "output": "Artifact — Chronicle Orb of the War of Gods",
    "type": "artifact",
    "subtype": "orb",
    "stats": {
      "allStats": 0.18,
      "godSlaying": 0.45,
      "warMastery": 0.4,
      "bossModifier": 1.45
    },
    "durability": 9200,
    "materials": {
      "War of Gods Relic": 8,
      "Nameless God Essence": 5,
      "Fragment of the First Dawn": 7,
      "Ancient Heaven Metal": 8,
      "Sky God Core": 5
    },
    "lore": "The War of Gods was fought in too many locations simultaneously for any single observer to witness it fully. The Chronicle Orb was created to solve this problem: enchanted to be everywhere the war was, simultaneously, recording everything. When retrieved, it contained more information than existed, suggesting it had recorded not just events but the probability-space of events."
  },
  {
    "output": "Artifact — World-Eater Stomach Stone",
    "type": "artifact",
    "subtype": "core",
    "stats": {
      "consume": 0.5,
      "lifesteal": 0.25,
      "allStats": 0.15,
      "drainField": 0.45
    },
    "durability": 9200,
    "materials": {
      "World-Eater Fang": 6,
      "World-Eater Scale": 8,
      "Death Metal Ore": 10,
      "Primordial Core": 5,
      "Soul of a Thousand Fallen": 8
    },
    "lore": "The Great Devourer has a stomach of impossible volume. The stomach stone is a calculus the creature developed — a dense, smooth stone grown from minerals it could not digest, carrying the properties of everything it has tried to consume. Holding it is holding the distillation of everything that the most voracious thing in existence found ultimately indigestible."
  },
  {
    "output": "Artifact — Resonance Bell of the First City",
    "type": "artifact",
    "subtype": "relic",
    "stats": {
      "commandAura": 0.4,
      "teamAura": 0.35,
      "allResist": 0.25,
      "soundWave": 0.5
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 8,
      "Primordial Core": 5,
      "God-Vessel Iron Ingot": 12,
      "Ancient Heaven Metal": 10,
      "Soul of a Thousand Fallen": 7
    },
    "lore": "The first city had a bell tuned to the frequency at which the city collective life operated. When it was struck, every person in the city felt it not as sound but as recognition: the feeling of belonging to something larger than themselves. The bell was lost when the city fell. A scholar who spent sixty years looking for it found it beneath the ruins, still humming at the original frequency."
  },
  {
    "output": "Artifact — Temporal Lens of the Observer Beyond Time",
    "type": "artifact",
    "subtype": "relic",
    "stats": {
      "foresight": 0.55,
      "cdReduction": 0.5,
      "trueVision": true,
      "timeshift": 0.3
    },
    "durability": 9200,
    "materials": {
      "Epoch Mana Stone — Frozen Time": 10,
      "Realm-Tear Mana Stone": 8,
      "Fragment of the First Dawn": 7,
      "Archmage Heart": 4,
      "Primordial Core": 5
    },
    "lore": "There is an observer who exists outside of time — not above or beyond, but outside, not subject to its directionality. They watch time the way a person watches a river: from a bank that the river cannot reach. The lens was their instrument. When they left their post — perhaps because watching time pass without joining it had grown lonely — they left the lens behind."
  },
  {
    "output": "Artifact — Void Shard Tome",
    "type": "artifact",
    "subtype": "tome",
    "stats": {
      "spellPower": 210,
      "voidMastery": 0.55,
      "energyMax": 500,
      "allSkillPower": 0.28
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The tome has no pages — or rather, its pages are void. What appears blank is written in the absence of writing, documented in the negative space of documentation. A scholar who spent three years learning to read it described the experience as learning an alphabet where every letter is defined by the space around it rather than the space it occupies. The information contained documents magic that operates through absence rather than presence."
  },
  {
    "output": "Artifact — Scale of the World-Serpent's Balance",
    "type": "artifact",
    "subtype": "relic",
    "stats": {
      "allResist": 0.4,
      "balanceAura": 0.5,
      "allStats": 0.2,
      "serpentBless": 0.45
    },
    "durability": 9200,
    "materials": {
      "Ancient Scale — World Serpent": 14,
      "World Serpent Venom Gland": 6,
      "Primordial Core": 6,
      "Fragment of the First Dawn": 7,
      "Realm-Tear Mana Stone": 6
    },
    "lore": "The World Serpent maintains balance. Not justice, not fairness — balance, in the precise sense of things being in equilibrium. The scale is a literal measuring device the Serpent uses to assess imbalances that require its attention. The artifact is a single pan from that scale, given to a hunter the Serpent judged capable of making local adjustments on its behalf."
  },
  {
    "output": "Artifact — Crown Fragment of the Uncrowned King",
    "type": "artifact",
    "subtype": "relic",
    "stats": {
      "commandAura": 0.6,
      "regalAuthority": 0.65,
      "allStats": 0.2,
      "bossModifier": 1.4
    },
    "durability": 9200,
    "materials": {
      "Fallen Kingdom Crown Fragment": 10,
      "Fragment of the First Dawn": 8,
      "Ancient Heaven Metal": 10,
      "God-Vessel Iron Ingot": 10,
      "Soul of a Thousand Fallen": 8
    },
    "lore": "The Uncrowned King ruled without a crown — not because they were denied one, but because they declined it. Their authority did not require a symbol; it was self-evident to everyone who encountered them. The crown was broken at the king own instruction: distribute it so that authority is not concentrated. The fragment cannot be fully held. It can only be shared."
  },
  {
    "output": "Artifact — Eye of the Primordial Forge",
    "type": "artifact",
    "subtype": "orb",
    "stats": {
      "craftingBonus": 0.55,
      "trueVision": true,
      "allStats": 0.18,
      "touchBreak": 0.45
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 4,
      "Primordial Core": 3,
      "Ancient Heaven Metal": 8,
      "God-Vessel Iron Ingot": 10,
      "World-Eater Fang": 3
    },
    "lore": "The Primordial Forge sees everything it has ever shaped — the shape-potential of everything that approaches it: the form that a material could become if worked correctly. The eye is a fragment of that vision. Looking through it, the bearer sees what things could be: enemies patterns before they commit to them, weaknesses before they manifest, techniques before they are finished being invented."
  },
  {
    "output": "Artifact — Heartstone of the Void Emperor",
    "type": "artifact",
    "subtype": "core",
    "stats": {
      "voidMastery": 0.65,
      "energyMax": 550,
      "darkResist": 0.65,
      "domainExpand": 0.55
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "The Void Emperor's heart did not beat — it resonated. Not with life, which requires urgency, but with a frequency consistent with understanding. The heartstone is what remained when the Emperor's physical form dissolved into the void it had spent its existence comprehending. It still resonates. Holding it, the bearer feels the resonance as a slow, deep vibration in their chest — a second rhythm alongside their own heartbeat, older and calmer."
  },
  {
    "output": "Artifact — Calamity Core — Still Burning",
    "type": "artifact",
    "subtype": "core",
    "stats": {
      "atk": 130,
      "fireChannel": 0.9,
      "burnUpgrade": 4,
      "calamityField": 0.3
    },
    "durability": 9200,
    "materials": {
      "Calamity Dragon Scale": 12,
      "First Dragon Scale": 8,
      "Eternal Flame Essence": 12,
      "Primordial Core": 6,
      "God-Vessel Iron Ingot": 10
    },
    "lore": "The Calamity Core is the densest concentration of world-ending fire that any material form has ever contained. It should not be holdable. The area around it should be uninhabitable. It is holdable. The area is inhabitable. The current consensus is that the core is not radiating heat outward — it is radiating something inward, drawing the energy toward itself. Carrying it, the bearer contains something that has not yet finished burning."
  },
  {
    "output": "Artifact — Primordial Compass",
    "type": "artifact",
    "subtype": "relic",
    "stats": {
      "allStats": 0.22,
      "foresight": 0.5,
      "firstStrikeBonus": 2.0,
      "primordialAura": 0.45
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 12,
      "Primordial Core": 7,
      "Realm-Tear Mana Stone": 7,
      "Epoch Mana Stone — Frozen Time": 6,
      "Ancient Heaven Metal": 8
    },
    "lore": "The compass does not point north. It points at the beginning — wherever and whenever the beginning currently is from the bearer perspective. In practice, this means the compass points at the part of any situation that contains the most potential. In a fight, it points at the opening. The bearer finds openings before they finish opening."
  },
  {
    "output": "Artifact — Soul Archive — Every Life Ever Lived",
    "type": "artifact",
    "subtype": "tome",
    "stats": {
      "spellPower": 195,
      "soulCapture": 0.5,
      "allSkillPower": 0.32,
      "lifesteal": 0.18
    },
    "durability": 9200,
    "materials": {
      "Soul of a Thousand Fallen": 16,
      "Archmage Heart": 5,
      "Eternal Mana Stone": 12,
      "Nameless God Essence": 5,
      "Fragment of the First Dawn": 7
    },
    "lore": "The Soul Archive contains every life ever lived, in brief summary, accessible to whoever holds the archive. Not as data — as experience. Opening the archive to a specific subject exposes the bearer to what it felt like to be that person at key moments. The bearer does not adopt those feelings. They learn from them, the way a very well-read person has learned from thousands of lives without having lived them."
  },
  {
    "output": "Artifact — War Drum of the First Army",
    "type": "artifact",
    "subtype": "relic",
    "stats": {
      "commandAura": 0.5,
      "teamAura": 0.4,
      "allResist": 0.25,
      "warMastery": 0.45
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 8,
      "Primordial Core": 5,
      "God-Vessel Iron Ingot": 12,
      "Ancient Heaven Metal": 10,
      "War of Gods Relic": 6
    },
    "lore": "The first army was not organized around weapons or tactics — it was organized around a sound. Someone discovered that a specific rhythm, struck at a specific volume, caused groups of people to synchronize in ways that made them collectively more capable than any individual. The drum that produced that rhythm became the center around which the first army arranged itself. The drum still produces that rhythm when struck."
  },
  {
    "output": "Artifact — Relic of the War of Gods",
    "type": "artifact",
    "subtype": "relic",
    "stats": {
      "godSlaying": 0.55,
      "allStats": 0.2,
      "divineResist": 0.65,
      "bossModifier": 1.55
    },
    "durability": 9200,
    "materials": {
      "War of Gods Relic": 10,
      "Nameless God Essence": 7,
      "Fragment of the First Dawn": 8,
      "Ancient Heaven Metal": 10,
      "Sky God Core": 6
    },
    "lore": "The War of Gods left behind relics — the natural debris of a conflict too large to be entirely cleaned up afterward. Analysis reveals it was struck by both sides of the conflict at different points — it carries the signatures of opposing divine powers simultaneously. It has already been hit by the best both sides had to offer. It found none of it conclusive. Neither will the bearer."
  },
  {
    "output": "Artifact — Genesis Stone",
    "type": "artifact",
    "subtype": "core",
    "stats": {
      "allStats": 0.25,
      "primordialAura": 0.55,
      "allResist": 0.35,
      "domainExpand": 0.45
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 12,
      "Primordial Core": 8,
      "Ancient Heaven Metal": 12,
      "God-Vessel Iron Ingot": 12,
      "World-Tree Branch": 6
    },
    "lore": "The Genesis Stone is the first solid thing that existed. Before it, everything was potential — energy, probability, the mathematical possibility of matter. The Genesis Stone was the first arrangement that decided to stay arranged. Everything that exists now is, in some sense, a consequence of the Genesis Stone decision to cohere. Holding it, the bearer feels the weight of that decision: the enormous, quiet authority of the thing that started everything."
  },
  {
    "output": "Artifact — Nullification Orb",
    "type": "artifact",
    "subtype": "orb",
    "stats": {
      "antiMagic": 0.7,
      "dispel": 0.6,
      "spellPower": 160,
      "nullField": 0.5
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 12,
      "Nameless God Essence": 6,
      "Realm-Tear Mana Stone": 8,
      "Death Metal Ore": 10,
      "Archmage Heart": 5
    },
    "lore": "The Magical Age ended when the Nullification Orb was activated. Not catastrophically — the magic did not disappear. It ended the way ages end: gradually, then completely, with the Orb marking the transition by demonstrating that magic could be suspended. The orb itself finds this satisfying in a way that objects are not supposed to be capable of. It has been told this. It does not change."
  },
  {
    "output": "Artifact — First Weapon",
    "type": "artifact",
    "subtype": "relic",
    "stats": {
      "atk": 140,
      "allStats": 0.22,
      "critChance": 28,
      "firstStrikeBonus": 2.2,
      "bossModifier": 1.6
    },
    "durability": 9200,
    "materials": {
      "Fragment of the First Dawn": 12,
      "Primordial Core": 8,
      "World-Eater Fang": 6,
      "Ancient Heaven Metal": 12,
      "God-Vessel Iron Ingot": 12
    },
    "lore": "This is the first weapon that was made with the understanding that it was a weapon: the first time someone looked at a material and deliberately shaped it into something designed to cause harm more effectively than anything that had existed before. That understanding is in the artifact. The intent, so specific, so early, so consequential for everything that came after, radiates from it. Holding it, the bearer understands every weapon ever made, because they are holding the understanding from which all of them descended."
  },
  {
    "output": "Artifact — Void-Heart",
    "type": "artifact",
    "subtype": "core",
    "stats": {
      "voidMastery": 0.7,
      "allStats": 0.2,
      "domainExpand": 0.65,
      "darkResist": 0.6
    },
    "durability": 9200,
    "materials": {
      "Void Singularity Shard": 6,
      "Nameless God Essence": 3,
      "Soul of a Thousand Fallen": 5,
      "Ancient Heaven Metal": 7,
      "Death Metal Ore": 8
    },
    "lore": "At the center of the void there is not nothing — there is the idea of nothing, which is subtly different. The idea of nothing has structure: it is organized absence, deliberate emptiness, the specific shape of everything that is not there. The Void-Heart is a crystallization of that structure. Carrying it, the bearer has access to the full authority of organized absence."
  },
  {
    "output": "Artifact — Tome of the World Serpent's Memory",
    "type": "artifact",
    "subtype": "tome",
    "stats": {
      "spellPower": 180,
      "allSkillPower": 0.28,
      "serpentBless": 0.4,
      "foresight": 0.38
    },
    "durability": 9200,
    "materials": {
      "Ancient Scale — World Serpent": 10,
      "World Serpent Venom Gland": 6,
      "Archmage Heart": 4,
      "Eternal Mana Stone": 10,
      "Primordial Core": 5
    },
    "lore": "The World Serpent's memory is older than the world's recorded history. The Serpent agreed to have a portion of its memory transcribed — not the events, but the structure of how it remembered: the frameworks for understanding vast spans of time, the techniques for holding multiple incompatible truths simultaneously. A mage who reads it thinks differently afterward."
  },
  {
    "output": "Artifact — Calamity Codex",
    "type": "artifact",
    "subtype": "tome",
    "stats": {
      "spellPower": 185,
      "calamityChannel": 0.45,
      "fireChannel": 0.7,
      "dragonPower": 0.55
    },
    "durability": 9200,
    "materials": {
      "Calamity Dragon Scale": 12,
      "First Dragon Scale": 6,
      "Eternal Flame Essence": 10,
      "Archmage Heart": 4,
      "Primordial Core": 6
    },
    "lore": "The Codex was written by a scholar who spent thirty years observing the Calamity Dragon directly, sitting near the Dragon while it did its work and extrapolating meaning from its behavior. The scholarly community initially rejected the methodology and then, after reading the Codex, accepted it as the only methodology that could have produced it. The Codex describes what calamity looks like from the inside."
  },
  {
    "output": "Artifact — Ruin Compass",
    "type": "artifact",
    "subtype": "relic",
    "stats": {
      "ruinAffinity": 0.55,
      "trueVision": true,
      "foresight": 0.4,
      "allStats": 0.16
    },
    "durability": 9200,
    "materials": {
      "Shattered World Mana Stone": 10,
      "Fallen Kingdom Crown Fragment": 8,
      "Death Metal Ore": 10,
      "Void Singularity Shard": 7,
      "Soul of a Thousand Fallen": 8
    },
    "lore": "The Ruin Compass was developed by a scholar who had studied the ends of civilizations long enough to recognize the pattern: every civilization ends in the same sequence of structural failures, in the same order. The compass does not point north. It points at the nearest thing that is currently in the process of ending. In combat, it points at whatever is about to fail."
  }
];

module.exports = {

  weapons,

  helmet,

  chest,

  boots,

  leggings,

  gloves,

  accessories,

  artifacts,

};
