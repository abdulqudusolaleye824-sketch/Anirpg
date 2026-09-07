// ═══════════════════════════════════════════════════════════════
// COMPLETE SKILL DATABASE - ALL CLASSES, LEVELS 5-100
// ═══════════════════════════════════════════════════════════════

const skillDatabase = {
  // ═══════════════════════════════════════════════════════════════
  // MAGE SKILLS (20 TOTAL - LEVELS 5-100)
  // ═══════════════════════════════════════════════════════════════
  Mage: {
    // LEVELS 5-40 (EXISTING)
    'Fireball': {
      description: '🔥 Conjure a blazing sphere of concentrated flame and hurl it at your enemy',
      effect: '• Deals 120% magic damage\n• 15% chance to inflict BURN (5% max HP/turn for 3 turns)\n• High burst damage',
      animation: '🔥 Flames crackle between your fingers...\n🌋 FIREBALL! A blazing inferno erupts!\n💥 The explosion engulfs the target in searing heat!',
      cooldown: 2,
      manaCost: 25
    },
    'Ice Shard': {
      description: '❄️ Summon razor-sharp shards of ice and launch them at incredible velocity',
      effect: '• Deals 100% magic damage\n• 20% chance to FREEZE (target skips 1 turn)\n• Fast cast time',
      animation: '❄️ Frost crystallizes in the air...\n🧊 ICE SHARD! Frozen daggers pierce through!\n💎 Ice shards impale the target, spreading numbing cold!',
      cooldown: 1,
      manaCost: 20
    },
    'Lightning Bolt': {
      description: '⚡ Call down a devastating bolt of pure lightning from the heavens',
      effect: '• Deals 130% magic damage\n• 25% chance to PARALYZE (reduces speed 50% for 2 turns)\n• Can chain to nearby enemies',
      animation: '⚡ Storm clouds gather above...\n⚡ LIGHTNING BOLT! Thunder roars with devastating force!\n🌩️ A massive bolt strikes with the fury of nature itself!',
      cooldown: 2,
      manaCost: 30
    },
    'Arcane Missile': {
      description: '✨ Launch multiple homing projectiles of pure arcane energy',
      effect: '• Fires 3 missiles at 80% damage each\n• Never misses\n• Each hit can crit independently',
      animation: '✨ Glowing violet orbs manifest around you...\n💫 ARCANE MISSILE! Perfect precision!\n🌟 The missiles home in unerringly, striking with pure magical force!',
      cooldown: 2,
      manaCost: 35
    },
    'Meteor Strike': {
      description: '☄️ Summon a massive meteor from the sky to obliterate your enemies',
      effect: '• Deals 200% magic damage to target\n• 50% splash damage to all enemies\n• 3 turn cooldown',
      animation: '🌌 The sky darkens ominously...\n☄️ METEOR! A burning rock falls from above!\n💥 CATASTROPHIC IMPACT! The ground erupts in flames!',
      cooldown: 3,
      manaCost: 50
    },
    'Blizzard': {
      description: '🌨️ Unleash a devastating ice storm that freezes everything in its path',
      effect: '• Deals 150% magic damage to all enemies\n• 50% chance to FREEZE each target (1 turn)\n• Creates ice field',
      animation: '❄️ A howling wind erupts around you...\n🌨️ BLIZZARD! The fury of eternal winter!\n💎 Everything is consumed by a raging ice storm!',
      cooldown: 4,
      manaCost: 45
    },
    'Chain Lightning': {
      description: '⚡ Release lightning that jumps between multiple enemies',
      effect: '• Hits 3-5 enemies\n• First hit 110% damage, chains 80% each\n• 25% chance to STUN each target',
      animation: '⚡ Lightning arcs from your fingertips...\n⚡ CHAIN LIGHTNING! It leaps to all foes!\n🌩️ The bolt jumps from victim to victim in a deadly dance!',
      cooldown: 3,
      manaCost: 40
    },
    'Time Stop': {
      description: '⏰ Manipulate time itself to freeze enemies in their tracks',
      effect: '• All enemies lose their next turn\n• No damage dealt\n• Once per battle',
      animation: '⏰ Your movements slow as you grasp time...\n⏸️ TIME STOP! Reality freezes!\n🌀 The world stands still - only you can move!',
      cooldown: 99,
      manaCost: 60
    },
    'Frost Nova': {
      description: '❄️ Release a wave of freezing energy in all directions',
      effect: '• AOE ice damage\n• 60% chance to SLOW all enemies\n• 20% chance to FREEZE',
      animation: '❄️ Frost spreads from your body in waves...\n🧊 FROST NOVA! A freezing blast!\n💎 Everything crystallizes in the icy explosion!',
      cooldown: 3,
      manaCost: 35
    },
    'Arcane Blast': {
      description: '💫 Unleash pure magical energy that ignores defenses',
      effect: '• Ignores 50% magic resistance\n• Cannot be blocked\n• Drains 10% enemy max HP',
      animation: '✨ Magic swirls around you intensely...\n💫 ARCANE BLAST! Reality-bending power!\n🌟 Pure magical force tears through everything!',
      cooldown: 4,
      manaCost: 55
    },
    
    // LEVELS 45-100 (NEW)
    'Meteor Storm': {
      description: '☄️ Call down multiple meteors from the sky',
      effect: '• Massive AOE fire damage\n• Multiple impacts\n• Burns everything',
      animation: '☄️ You raise your staff to the heavens!\n🌟 The sky darkens as meteors rain down!\n💥 METEOR STORM! Everything burns!',
      cooldown: 5,
      manaCost: 65
    },
    'Time Warp': {
      description: '⏰ Bend time to attack twice in one turn',
      effect: '• Next attack happens twice\n• Time manipulation\n• Reality bending',
      animation: '⏰ Time itself bends to your will!\n🌀 Reality fragments around you!\n⚡ TIME WARP! You move in stopped time!',
      cooldown: 6,
      manaCost: 70
    },
    'Arcane Explosion': {
      description: '💫 Detonate pure arcane energy',
      effect: '• Massive AOE magic damage\n• Stuns all enemies\n• Ignores resistances',
      animation: '💫 Raw magic surges through you!\n✨ Energy builds to critical mass!\n💥 ARCANE EXPLOSION! The very air shatters!',
      cooldown: 5,
      manaCost: 75
    },
    'Gravity Well': {
      description: '🌑 Create a crushing gravity field',
      effect: '• Pulls enemies together\n• Crushing damage over time\n• Slows movement',
      animation: '🌑 Space-time warps around your target!\n⚫ GRAVITY WELL! They cannot escape!\n💢 Crushing pressure intensifies!',
      cooldown: 6,
      manaCost: 80
    },
    'Elemental Fury': {
      description: '🌪️ Combine fire, ice, and lightning',
      effect: '• Triple elemental damage\n• Applies burn, freeze, and shock\n• Chaos incarnate',
      animation: '🌪️ Elements answer your call!\n🔥❄️⚡ Fire, ice, and lightning merge!\n💥 ELEMENTAL FURY! Chaos incarnate!',
      cooldown: 7,
      manaCost: 85
    },
    'Void Collapse': {
      description: '🕳️ Erase enemies from existence',
      effect: '• Deals % max HP damage\n• Ignores all defenses\n• Reality erasure',
      animation: '🕳️ You open a portal to the void!\n🌌 Darkness consumes everything!\n💀 VOID COLLAPSE! Reality unravels!',
      cooldown: 8,
      manaCost: 90
    },
    'Mana Overload': {
      description: '⚡ Release all mana in devastating blast',
      effect: '• Damage based on current mana\n• Uses all remaining mana\n• Massive power',
      animation: '⚡ Your mana circuits overload!\n💫 Power beyond limit!\n💥 MANA OVERLOAD! Everything explodes!',
      cooldown: 10,
      manaCost: 100
    },
    'Cosmic Ray': {
      description: '✨ Channel the power of stars',
      effect: '• Pierces all defenses\n• Pure stellar energy\n• Unstoppable',
      animation: '✨ Starlight gathers in your palm!\n🌟 COSMIC RAY! Pure stellar energy!\n💥 The heavens strike your foe!',
      cooldown: 6,
      manaCost: 85
    },
    'Temporal Rift': {
      description: '⏳ Tear the fabric of time itself',
      effect: '• Confuses enemies\n• Damage over time\n• Time fracture',
      animation: '⏳ Time itself fractures!\n🌀 Past and future collide!\n💫 TEMPORAL RIFT! Causality breaks!',
      cooldown: 7,
      manaCost: 90
    },
    'Omega Spell': {
      description: '🌟 The ultimate arcane magic',
      effect: '• Ultimate power\n• Uses all mana\n• Apex of magic',
      animation: '🌟 You begin the ultimate incantation!\n✨ ALL mana flows into one spell!\n💥 OMEGA SPELL! The apex of magic!',
      cooldown: 99,
      manaCost: 150
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // WARRIOR SKILLS (20 TOTAL - LEVELS 5-100)
  // ═══════════════════════════════════════════════════════════════
  Warrior: {
    // LEVELS 5-40 (EXISTING)
    'Power Strike': {
      description: '💪 Channel raw strength into your weapon for a devastating blow',
      effect: '• Deals 140% physical damage\n• 20% chance to STUN (1 turn)\n• Ignores 20% defense',
      animation: '💪 You grip your weapon tightly, muscles bulging...\n⚔️ POWER STRIKE! Overwhelming force!\n💥 The impact sends shockwaves through the enemy!',
      cooldown: 2,
      rageCost: 20
    },
    'Whirlwind': {
      description: '🌪️ Spin rapidly with weapon extended, hitting everything around you',
      effect: '• Deals 100% physical damage to all enemies\n• 40% chance to BLEED\n• Each hit can crit',
      animation: '🔄 You begin spinning rapidly...\n🌪️ WHIRLWIND! Your blade becomes a storm!\n💨 Enemies are caught in the devastating cyclone!',
      cooldown: 3,
      rageCost: 30
    },
    'Shield Bash': {
      description: '🛡️ Slam your shield into an enemy with tremendous force',
      effect: '• Deals 80% physical damage\n• 40% chance to STUN\n• +20% DEF for 2 turns',
      animation: '🛡️ You raise your shield for a crushing blow...\n💥 SHIELD BASH! Brutal impact!\n⚡ The enemy is sent reeling!',
      cooldown: 2,
      rageCost: 15
    },
    'Battle Shout': {
      description: '📣 Unleash a war cry that inspires allies and terrifies enemies',
      effect: '• +30% ATK for 3 turns\n• -15% enemy DEF\n• AOE buff',
      animation: '😤 You take a deep breath...\n📣 BATTLE SHOUT! The battlefield trembles!\n💪 Fighting spirit surges through everyone!',
      cooldown: 4,
      rageCost: 25
    },
    'Rage': {
      description: '😤 Enter a berserker state, dramatically increasing attack power',
      effect: '• +50% ATK for 3 turns\n• Take 20% more damage\n• Cannot be dispelled',
      animation: '😤 Your eyes glow red with fury...\n💢 RAGE! Primal anger unleashed!\n⚡ Overwhelming power courses through your veins!',
      cooldown: 5,
      rageCost: 0
    },
    'Earthquake': {
      description: '🌍 Strike the ground with such force that the earth itself trembles',
      effect: '• Deals 160% physical damage to all enemies\n• 30% chance to STUN each target\n• Creates shockwave',
      animation: '🏔️ You raise your weapon high...\n💥 EARTHQUAKE! The ground shatters!\n🌊 Fissures spread as enemies lose their footing!',
      cooldown: 4,
      rageCost: 40
    },
    'Execute': {
      description: '🗡️ A finishing move that deals massive damage to weakened enemies',
      effect: '• 250% damage if target <30% HP\n• Otherwise 100% damage\n• Instant cast',
      animation: '⚔️ You see weakness and move in for the kill...\n💀 EXECUTE! Swift and merciless!\n⚡ The finishing blow lands with lethal precision!',
      cooldown: 3,
      rageCost: 30
    },
    'Last Stand': {
      description: '🛡️ When near death, gain a temporary surge of defensive power',
      effect: '• Triggers at <25% HP\n• +100% DEF for 3 turns\n• +50% HP regen',
      animation: '🛡️ Backed into a corner, your will surges...\n💪 LAST STAND! Unbreakable resolve!\n⚡ You refuse to fall!',
      cooldown: 99,
      rageCost: 50
    },
    'Cleave': {
      description: '⚔️ Swing your weapon in a wide arc',
      effect: '• Hits up to 3 enemies\n• 120% damage each\n• Pierces defense',
      animation: '⚔️ You wind up for a massive swing...\n💥 CLEAVE! A devastating arc!\n🌟 The blade cuts through multiple foes!',
      cooldown: 2,
      rageCost: 25
    },
    'Titan Slam': {
      description: '🏔️ Strike the ground with titanic force',
      effect: '• Massive AOE damage\n• Knocks down all enemies\n• Creates shockwave',
      animation: '🏔️ You leap high into the air...\n💥 TITAN SLAM! Earth-shattering!\n🌊 The very ground erupts beneath your might!',
      cooldown: 5,
      rageCost: 50
    },
    
    // LEVELS 45-100 (NEW)
    'War Cry': {
      description: '📣 Unleash a terrifying battle roar',
      effect: '• Fears all enemies\n• +50% ATK\n• Doubles strength',
      animation: '📣 Your war cry echoes across the battlefield!\n😱 Fear grips your enemies!\n💪 Your strength doubles!',
      cooldown: 6,
      rageCost: 55
    },
    'Iron Wall': {
      description: '🛡️ Become an impenetrable fortress',
      effect: '• +200% DEF\n• Damage reduction\n• Unbreakable',
      animation: '🛡️ Your armor glows with protective magic!\n⚔️ IRON WALL! Nothing can break through!\n💎 Defense maximized!',
      cooldown: 5,
      rageCost: 50
    },
    'Bladestorm': {
      description: '🌪️ Become a whirlwind of steel',
      effect: '• Multiple AOE hits\n• Each hit can crit\n• Devastating combo',
      animation: '🌪️ You spin in a deadly hurricane!\n⚔️ BLADESTORM! Blades everywhere!\n💥 Multiple strikes!',
      cooldown: 6,
      rageCost: 60
    },
    'Juggernaut': {
      description: '🚂 Nothing can stop your charge',
      effect: '• Unstoppable charge\n• Pierces everything\n• Massive momentum',
      animation: '🚂 You become an unstoppable force!\n💪 JUGGERNAUT! Trampling everything!\n⚡ Momentum builds!',
      cooldown: 6,
      rageCost: 65
    },
    'Ancestral Rage': {
      description: '👹 Channel your ancestors\' fury',
      effect: '• +80% ATK\n• Lifesteal\n• Ancient power',
      animation: '👹 Ancient warriors guide your blade!\n⚔️ ANCESTRAL RAGE! Legendary power!\n💥 Their strength is yours!',
      cooldown: 7,
      rageCost: 70
    },
    'Mountain Breaker': {
      description: '⛰️ Split the earth with your strike',
      effect: '• Massive damage\n• Armor break\n• Ground shatter',
      animation: '⛰️ Your blade cleaves the very ground!\n💥 MOUNTAIN BREAKER! Nothing stands!\n🌋 The earth trembles!',
      cooldown: 8,
      rageCost: 75
    },
    'Battle Trance': {
      description: '😤 Enter pure combat focus',
      effect: '• +50% crit rate\n• +30% speed\n• Perfect strikes',
      animation: '😤 You focus solely on battle!\n⚔️ BATTLE TRANCE! Maximum efficiency!\n💪 Every strike perfect!',
      cooldown: 7,
      rageCost: 70
    },
    'Warlord Command': {
      description: '👑 Assert battlefield dominance',
      effect: '• Intimidates all\n• +60% ATK\n• Supreme authority',
      animation: '👑 Your presence dominates the field!\n⚔️ WARLORD\'S COMMAND! All bow!\n💪 Supreme authority!',
      cooldown: 7,
      rageCost: 75
    },
    'Colossus Strike': {
      description: '🗿 Strike with the power of giants',
      effect: '• 300% damage\n• Stuns all\n• Massive impact',
      animation: '🗿 You channel titan strength!\n⚔️ COLOSSUS STRIKE! Giants\' power!\n💥 The world shakes!',
      cooldown: 8,
      rageCost: 80
    },
    'Apocalypse Strike': {
      description: '💀 The ultimate warrior technique',
      effect: '• Ultimate damage\n• Pierces all\n• Total devastation',
      animation: '💀 You gather all your power!\n⚔️ APOCALYPSE STRIKE! The end comes!\n💥 Total devastation!',
      cooldown: 99,
      rageCost: 100
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // ASSASSIN SKILLS (27 TOTAL - LEVELS 5-100)
  // ═══════════════════════════════════════════════════════════════
  Assassin: {
    // LEVELS 5-40 (EXISTING)
    'Poison Dagger': {
      description: '☠️ A venom-coated dagger strikes from the shadows!',
      effect: '• 90% damage\n• Inflicts POISON (8% max HP/turn for 4 turns)\n• Reduces healing 40%',
      animation: '☠️ Green venom drips from your blade...\n🗡️ POISON DAGGER! Toxic strike!\n🧪 Deadly toxins spread through their body!',
      cooldown: 2,
      energyCost: 20
    },
    'Lethal Strike': {
      description: '💀 A precise strike aimed at vital points',
      effect: '• 150% damage\n• 30% chance for instant kill if enemy <25% HP\n• High crit chance',
      animation: '🎯 You identify the perfect weak point...\n💀 LETHAL STRIKE! Deadly precision!\n⚡ A devastating blow lands with surgical accuracy!',
      cooldown: 3,
      energyCost: 30
    },
    'Shadow Strike': {
      description: '🌑 Strike from the shadows with deadly force',
      effect: '• 140% damage\n• 25% chance to BLIND\n• Guaranteed crit from stealth',
      animation: '🌑 You meld with the darkness...\n⚔️ SHADOW STRIKE! From nowhere!\n💫 The attack comes from the void!',
      cooldown: 2,
      energyCost: 25
    },
    'Critical Strike': {
      description: '🎯 A perfectly aimed critical blow',
      effect: '• 160% damage\n• Always crits\n• 20% armor penetration',
      animation: '🎯 You wait for the perfect moment...\n💥 CRITICAL STRIKE! Perfect execution!\n⚡ The blow lands with devastating precision!',
      cooldown: 3,
      energyCost: 35
    },
    'Dual Strike': {
      description: '⚔️ Strike with both weapons simultaneously',
      effect: '• Hit twice for 80% damage each\n• Can crit independently\n• Fast combo',
      animation: '⚔️ Both blades flash in unison...\n💨 DUAL STRIKE! Double slash!\n🗡️ Two devastating cuts tear through!',
      cooldown: 2,
      energyCost: 25
    },
    'Stealth': {
      description: '🌑 Vanish into the shadows',
      effect: '• Become invisible for 2 turns\n• Next attack deals +100% damage\n• Dodge all attacks',
      animation: '🌑 You fade from sight...\n💨 STEALTH! Invisible!\n👤 You are one with the shadows!',
      cooldown: 4,
      energyCost: 30
    },
    'Poison': {
      description: '☠️ Apply deadly poison',
      effect: '• Inflicts POISON\n• 10% max HP per turn for 3 turns\n• Stacks up to 3 times',
      animation: '☠️ Venom spreads...\n🧪 POISON! Toxins take hold!\n💀 The poison courses through veins!',
      cooldown: 2,
      energyCost: 20
    },
    'Backstab': {
      description: '🗡️ Strike from behind with a critical hit guaranteed',
      effect: '• 180% damage\n• First use always crits\n• Requires positioning',
      animation: '🌑 You melt into the shadows...\n🗡️ BACKSTAB! The dagger plunges deep!\n💀 A perfect strike from behind!',
      cooldown: 3,
      energyCost: 30
    },
    'Shadow Step': {
      description: '🌑 Become one with shadows, evading the next attack',
      effect: '• Dodge next attack 100%\n• Can be used reactively\n• Short cooldown',
      animation: '🌑 You fade into darkness...\n💨 SHADOW STEP! Untouchable!\n👤 The attack passes through empty air!',
      cooldown: 2,
      energyCost: 20
    },
    'Poison Blade': {
      description: '☠️ Coat your weapon in deadly toxins',
      effect: '• 90% damage\n• Inflicts POISON (10% max HP/turn for 5 turns)\n• Reduces healing 50%',
      animation: '☠️ A sickly green liquid drips from your blade...\n🗡️ POISON BLADE! Toxins spread!\n🧪 The poison burns through their veins!',
      cooldown: 2,
      energyCost: 25
    },
    'Smoke Bomb': {
      description: '💨 Throw a smoke bomb to confuse enemies',
      effect: '• All enemies -50% accuracy for 2 turns\n• Can flee from battle\n• No damage',
      animation: '💨 You hurl a smoke bomb...\n💥 SMOKE BOMB! Thick black smoke erupts!\n🌫️ Enemies cough and stumble blindly!',
      cooldown: 4,
      energyCost: 15
    },
    'Death Mark': {
      description: '💀 Mark an enemy for death, increasing damage they take',
      effect: '• Target takes +50% damage from all sources\n• Lasts 3 turns\n• No damage',
      animation: '💀 You mark them with the sign of death...\n🎯 DEATH MARK! Their fate is sealed!\n⚡ A skull appears above their head!',
      cooldown: 4,
      energyCost: 30
    },
    'Assassination': {
      description: '🎯 A precise killing technique for eliminating weak enemies',
      effect: '• Instantly kills enemies <20% HP\n• Otherwise 300% damage\n• Cannot be blocked',
      animation: '🎯 You identify the perfect weak point...\n💀 ASSASSINATION! One perfect strike!\n⚰️ Swift and silent death!',
      cooldown: 5,
      energyCost: 50
    },
    'Shadow Clone': {
      description: '👥 Create illusory duplicates to confuse enemies',
      effect: '• Summon 2 clones\n• Each can attack once for 50% damage\n• Then vanish',
      animation: '👥 Shadows coalesce into perfect copies...\n🌑 SHADOW CLONE! Multiple attackers!\n💫 Enemies can\'t tell which is real!',
      cooldown: 4,
      energyCost: 40
    },
    'Void Strike': {
      description: '🌌 Channel void energy to bypass all defenses',
      effect: '• 200% damage\n• Ignores ALL armor and defense\n• Pure damage',
      animation: '🌌 Your blade turns pitch black...\n💀 VOID STRIKE! Reality tears!\n⚡ The attack passes through armor like it doesn\'t exist!',
      cooldown: 5,
      energyCost: 45
    },
    'Eviscerate': {
      description: '🗡️ Rip through enemy defenses brutally',
      effect: '• High damage if enemy <50% HP\n• Applies DEEP BLEED\n• Ignores armor',
      animation: '🗡️ You find the perfect weak point...\n💀 EVISCERATE! Brutal execution!\n🩸 Devastating wounds open up!',
      cooldown: 3,
      energyCost: 35
    },
    'Ambush': {
      description: '👤 Strike from the shadows unexpectedly',
      effect: '• Triple damage from stealth\n• 60% chance to SILENCE\n• Opens with advantage',
      animation: '👤 You lurk in the shadows...\n💀 AMBUSH! Fatal surprise!\n⚔️ They didn\'t know you were there!',
      cooldown: 4,
      energyCost: 40
    },
    
    // LEVELS 45-100 (NEW)
    'Throat Slit': {
      description: '🩸 Execute with surgical precision',
      effect: '• Instant kill <30% HP\n• Otherwise 250% damage\n• Lethal technique',
      animation: '🩸 Your blade finds the vital point!\n💀 THROAT SLIT! Instant death!\n🌑 Silent and lethal!',
      cooldown: 7,
      energyCost: 60
    },
    'Vanishing Act': {
      description: '💨 Disappear completely',
      effect: '• Invisibility\n• Next attack guaranteed crit\n• Untraceable',
      animation: '💨 You fade into nothingness!\n🌑 VANISHING ACT! Where did you go?\n⚡ Strike from nowhere!',
      cooldown: 6,
      energyCost: 55
    },
    'Poison Gas': {
      description: '☠️ Release deadly toxin cloud',
      effect: '• AOE poison\n• Blinds enemies\n• Toxic cloud',
      animation: '☠️ Green gas fills the air!\n💀 POISON GAS! Toxic cloud!\n🌫️ Everything withers!',
      cooldown: 6,
      energyCost: 60
    },
    'Shadow Step Mastery': {
      description: '🌑 Teleport through shadows',
      effect: '• Instant teleport\n• Backstab bonus\n• Shadow travel',
      animation: '🌑 You meld into darkness!\n⚡ SHADOW STEP! Instant transmission!\n💫 Behind your target!',
      cooldown: 5,
      energyCost: 50
    },
    'Deadly Dance': {
      description: '💃 Beautiful but lethal display',
      effect: '• Multiple hits\n• High dodge\n• Graceful death',
      animation: '💃 Your movements become art!\n🗡️ DEADLY DANCE! Grace and death!\n⚡ Every step cuts!',
      cooldown: 7,
      energyCost: 65
    },
    'Nightmare': {
      description: '😱 Inflict terror and pain',
      effect: '• Fears enemies\n• DOT damage\n• Psychological warfare',
      animation: '😱 You become their worst nightmare!\n💀 NIGHTMARE! Pure terror!\n🌑 They see only death!',
      cooldown: 6,
      energyCost: 60
    },
    'Perfect Assassination': {
      description: '🎯 Flawless execution technique',
      effect: '• 400% damage\n• Cannot miss\n• True damage',
      animation: '🎯 The perfect moment arrives!\n💀 PERFECT ASSASSINATION! Flawless!\n⚡ Death delivered expertly!',
      cooldown: 8,
      energyCost: 70
    },
    'Shadow Realm': {
      description: '🌑 Drag enemies into darkness',
      effect: '• Isolate target\n• Massive damage\n• Shadow prison',
      animation: '🌑 You pull them into shadow!\n💀 SHADOW REALM! No escape!\n⚫ Only darkness remains!',
      cooldown: 9,
      energyCost: 80
    },
    'Reaper\'s Mark': {
      description: '💀 Mark for certain death',
      effect: '• Dooms target\n• +100% damage taken\n• Death inevitable',
      animation: '💀 You mark them for the Reaper!\n☠️ REAPER\'S MARK! Doom sealed!\n⚰️ Their fate is death!',
      cooldown: 8,
      energyCost: 75
    },
    'Final Cut': {
      description: '🗡️ Ultimate assassination technique',
      effect: '• Ultimate damage\n• True damage\n• One-hit potential',
      animation: '🗡️ Your blade glows with finality!\n💀 FINAL CUT! No escape!\n🌑 Death incarnate!',
      cooldown: 99,
      energyCost: 100
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // NECROMANCER SKILLS (20 TOTAL - LEVELS 5-100)
  // ═══════════════════════════════════════════════════════════════
  Necromancer: {
    // LEVELS 5-40 (EXISTING)
    'Life Drain': {
      description: '🩸 Siphon life force from your enemy',
      effect: '• 100% magic damage\n• Heal for 50% of damage dealt\n• Weakens enemy',
      animation: '🩸 Dark tendrils extend from your hand...\n🌑 LIFE DRAIN! Vitality flows to you!\n💫 Their life force becomes yours!',
      cooldown: 2,
      manaCost: 25
    },
    'Summon Undead': {
      description: '☠️ Raise skeletal warriors from the ground',
      effect: '• Summon 2 skeletons\n• Each has 30% your stats\n• Last until destroyed',
      animation: '⚰️ Bones burst from the ground...\n💀 SUMMON UNDEAD! They rise!\n🧟 Skeletal warriors stand ready!',
      cooldown: 5,
      manaCost: 40
    },
    'Bone Spear': {
      description: '🦴 Launch a spear made of hardened bone',
      effect: '• 130% magic damage\n• Pierces through enemies\n• Can hit multiple targets',
      animation: '💀 Bones crack and reform...\n⚔️ BONE SPEAR! Sharp and deadly!\n🦴 The projectile pierces straight through!',
      cooldown: 2,
      manaCost: 30
    },
    'Corpse Explosion': {
      description: '💥 Detonate a corpse, damaging all nearby',
      effect: '• 150% magic damage AOE\n• Requires defeated enemy\n• Massive explosion',
      animation: '💀 You channel dark energy into the fallen...\n💥 CORPSE EXPLOSION! Devastating blast!\n🌋 Gore and magic tear through everything!',
      cooldown: 3,
      manaCost: 35
    },
    'Death Coil': {
      description: '🌀 Unleash spiraling death energy',
      effect: '• 120% magic damage to living\n• Heals undead for same amount\n• Versatile',
      animation: '🌀 Dark energy spirals around your hand...\n💀 DEATH COIL! Writhing death!\n⚡ Necrotic power lashes out!',
      cooldown: 2,
      manaCost: 30
    },
    'Army of the Dead': {
      description: '👻 Summon a massive horde of undead',
      effect: '• Summon 5 weak undead\n• Each attacks once then vanishes\n• Overwhelming',
      animation: '⚰️ The ground trembles as legions rise...\n💀 ARMY OF THE DEAD! A tide of death!\n🧟 Skeletal hordes swarm forth!',
      cooldown: 6,
      manaCost: 60
    },
    'Soul Harvest': {
      description: '👻 Reap souls of defeated enemies',
      effect: '• +10% ATK per defeated enemy\n• Max 50% bonus\n• Lasts entire battle',
      animation: '👻 You extend your hands to the fallen...\n🌑 SOUL HARVEST! Power surges!\n💫 Their souls empower you!',
      cooldown: 5,
      manaCost: 30
    },
    'Lich Form': {
      description: '💀 Transform into a powerful lich',
      effect: '• Revive with 50% HP when killed\n• Once per battle\n• Undeath',
      animation: '💀 Your flesh withers as power rises...\n👻 LICH FORM! Beyond mortality!\n⚡ Death cannot claim you!',
      cooldown: 99,
      manaCost: 50
    },
    'Plague': {
      description: '☠️ Spread a deadly disease',
      effect: '• POISON all nearby enemies\n• Spreads between targets\n• Lasts 6 turns',
      animation: '☠️ Disease spreads from your hands...\n🦠 PLAGUE! Infectious death!\n😷 Sickness corrupts everything!',
      cooldown: 5,
      manaCost: 45
    },
    'Death Nova': {
      description: '💀 Release a wave of death in all directions',
      effect: '• AOE dark damage\n• Heal for 50% damage dealt\n• Life-draining',
      animation: '💀 Death radiates from you in waves...\n🌑 DEATH NOVA! All-consuming!\n⚡ Life energy flows back to you!',
      cooldown: 4,
      manaCost: 40
    },
    
    // LEVELS 45-100 (NEW)
    'Plague Lord': {
      description: '☠️ Become embodiment of disease',
      effect: '• AOE poison\n• Healing reduction\n• Disease aura',
      animation: '☠️ Sickness radiates from your form!\n💀 PLAGUE LORD! All will suffer!\n🦠 Disease spreads rapidly!',
      cooldown: 7,
      manaCost: 70
    },
    'Soul Reap': {
      description: '👻 Harvest multiple souls',
      effect: '• Heals you\n• Restores mana\n• Power boost',
      animation: '👻 Ghostly forms swirl around you!\n💀 SOUL REAP! Their essence is mine!\n✨ Souls empower you!',
      cooldown: 6,
      manaCost: 65
    },
    'Bone Prison': {
      description: '🦴 Trap foes in bone cage',
      effect: '• Stuns all\n• Immobilizes\n• Bone trap',
      animation: '🦴 Skeletal hands burst from ground!\n💀 BONE PRISON! No escape!\n⛓️ Trapped and helpless!',
      cooldown: 6,
      manaCost: 70
    },
    'Zombify': {
      description: '🧟 Turn enemies into servants',
      effect: '• Converts enemy\n• Summons zombie\n• Death control',
      animation: '🧟 Death is not the end!\n💀 ZOMBIFY! Rise as my servant!\n🧟‍♂️ You serve me now!',
      cooldown: 8,
      manaCost: 75
    },
    'Death Bolt': {
      description: '💀 Pure death energy',
      effect: '• Massive dark damage\n• Ignores defenses\n• Death magic',
      animation: '💀 Concentrated death energy!\n🌑 DEATH BOLT! Pure necrotic power!\n⚡ Life extinguished!',
      cooldown: 5,
      manaCost: 60
    },
    'Lich Lord': {
      description: '💀 Ultimate lich transformation',
      effect: '• Massive stat boost\n• Undead powers\n• Immortal form',
      animation: '💀 You become a Lich Lord!\n👻 LICH LORD! Supreme undeath!\n✨ Death magic perfected!',
      cooldown: 10,
      manaCost: 90
    },
    'Mass Resurrection': {
      description: '🧟 Raise army of dead',
      effect: '• Summons many undead\n• Army control\n• Legion of death',
      animation: '🧟 The graveyard awakens!\n💀 MASS RESURRECTION! Legions rise!\n⚰️ An undead army!',
      cooldown: 9,
      manaCost: 85
    },
    'Soul Link': {
      description: '🔗 Link fates together',
      effect: '• Shared damage\n• Curse effect\n• Fate binding',
      animation: '🔗 A spiritual chain binds you!\n💀 SOUL LINK! Our fates entwined!\n⚡ Shared suffering!',
      cooldown: 7,
      manaCost: 75
    },
    'Reaper Call': {
      description: '💀 Summon Death itself',
      effect: '• Summons Reaper\n• Instant kill chance\n• Death arrives',
      animation: '💀 The Grim Reaper answers!\n⚰️ REAPER\'S CALL! Death comes for all!\n👻 No one escapes!',
      cooldown: 10,
      manaCost: 95
    },
    'Necrotic Apocalypse': {
      description: '☠️ Ultimate death magic',
      effect: '• Mass death\n• Ultimate power\n• End of all',
      animation: '☠️ Death magic floods the battlefield!\n💀 NECROTIC APOCALYPSE! The end of all!\n⚰️ Everything dies!',
      cooldown: 99,
      manaCost: 120
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // PALADIN SKILLS (20 TOTAL - LEVELS 5-100)
  // ═══════════════════════════════════════════════════════════════
  Paladin: {
    // LEVELS 5-40 (EXISTING)
    'Holy Strike': {
      description: '✨ Smite enemies with divine power',
      effect: '• 130% physical damage\n• 200% vs undead/demons\n• Heals allies 10%',
      animation: '✨ Divine light surrounds your weapon...\n⚡ HOLY STRIKE! Righteous fury!\n🌟 Evil is purged by sacred power!',
      cooldown: 2,
      holyCost: 20
    },
    'Divine Shield': {
      description: '🛡️ Surround yourself with holy light',
      effect: '• Invulnerable for 2 turns\n• Cannot attack\n• Cleanses debuffs',
      animation: '🛡️ A brilliant barrier encases you...\n✨ DIVINE SHIELD! Impenetrable!\n⚡ Protected by heaven itself!',
      cooldown: 6,
      holyCost: 50
    },
    'Smite': {
      description: '⚡ Call down divine judgment',
      effect: '• 140% magic damage\n• Stuns undead/demons 2 turns\n• Cannot miss',
      animation: '⚖️ You raise your hand to the heavens...\n⚡ SMITE! Divine wrath descends!\n🌩️ Holy judgment crashes down!',
      cooldown: 3,
      holyCost: 30
    },
    'Consecration': {
      description: '✨ Bless the ground with holy power',
      effect: '• Allies heal 5% HP/turn\n• Enemies take 20 holy damage/turn\n• Lasts 4 turns',
      animation: '✨ You touch the ground reverently...\n🌟 CONSECRATION! Sacred ground!\n⚡ Holy light radiates everywhere!',
      cooldown: 5,
      holyCost: 35
    },
    'Judgment': {
      description: '⚖️ Pass divine judgment on enemies',
      effect: '• Damage = 150% of damage enemy has dealt\n• Min 100% base damage\n• Retribution',
      animation: '⚖️ Your eyes glow with divine light...\n⚡ JUDGMENT! Sins are weighed!\n🌟 Punishment falls upon the wicked!',
      cooldown: 4,
      holyCost: 40
    },
    'Holy Wrath': {
      description: '☀️ Unleash divine fury against all evil',
      effect: '• 180% magic damage to all\n• 300% vs undead/demons\n• Purging',
      animation: '☀️ Divine wrath builds within you...\n⚡ HOLY WRATH! The fury of heaven!\n🌟 Sacred fire consumes all evil!',
      cooldown: 5,
      holyCost: 55
    },
    'Divine Storm': {
      description: '🌟 Spin with holy light erupting',
      effect: '• 120% physical damage AOE\n• Heals allies 20% of damage\n• Radiant',
      animation: '🌟 You spin as holy light trails...\n✨ DIVINE STORM! Righteous cyclone!\n⚡ Light cuts through darkness!',
      cooldown: 4,
      holyCost: 45
    },
    'Avenging Wrath': {
      description: '😇 Transform into an avatar of vengeance',
      effect: '• +60% ATK, +40% DEF\n• Immunity to CC\n• Lasts 3 turns',
      animation: '😇 Wings of light manifest behind you...\n✨ AVENGING WRATH! Angelic power!\n⚡ You become divine judgment incarnate!',
      cooldown: 6,
      holyCost: 60
    },
    'Hammer of Justice': {
      description: '🔨 Strike with the weight of justice',
      effect: '• High holy damage\n• Stuns evil enemies\n• +30% vs demons',
      animation: '🔨 Your weapon glows with holy light...\n⚡ HAMMER OF JUSTICE! Righteous blow!\n✨ Evil is struck down!',
      cooldown: 3,
      holyCost: 35
    },
    'Blessing of Light': {
      description: '🙏 Call upon divine protection',
      effect: '• Heal all allies 40%\n• +20% DEF for 3 turns\n• Removes debuffs',
      animation: '🙏 You pray for divine aid...\n✨ BLESSING OF LIGHT! Heaven answers!\n🌟 Holy radiance heals and protects!',
      cooldown: 4,
      holyCost: 40
    },
    
    // LEVELS 45-100 (NEW)
    'Angelic Descent': {
      description: '👼 Call celestial aid',
      effect: '• Summons angel\n• Heals all\n• Divine blessing',
      animation: '👼 Heaven\'s light shines upon you!\n✨ ANGELIC DESCENT! Angels arrive!\n🌟 Divine intervention!',
      cooldown: 8,
      holyCost: 75
    },
    'Righteous Fury': {
      description: '😇 Channel holy wrath',
      effect: '• Holy fire damage\n• Burns evil\n• Purifying flames',
      animation: '😇 Holy fire ignites your weapon!\n⚔️ RIGHTEOUS FURY! Justice burns!\n🔥 Purifying flames!',
      cooldown: 6,
      holyCost: 70
    },
    'Sacred Ground': {
      description: '✨ Consecrate battlefield',
      effect: '• Heals over time\n• Buffs allies\n• Holy zone',
      animation: '✨ Holy symbols glow around you!\n🌟 SACRED GROUND! This place is blessed!\n💫 Evil cannot prevail here!',
      cooldown: 7,
      holyCost: 75
    },
    'Divine Protection': {
      description: '🛡️ Ultimate divine shield',
      effect: '• Complete immunity\n• Reflects damage\n• God\'s protection',
      animation: '🛡️ Nexusen light surrounds you!\n✨ DIVINE PROTECTION! Untouchable!\n💫 God shields you!',
      cooldown: 10,
      holyCost: 85
    },
    'Hammer Strike': {
      description: '🔨 Divine hammer blow',
      effect: '• Massive holy damage\n• Stuns all\n• Justice delivered',
      animation: '🔨 A holy hammer materializes!\n⚖️ HAMMER STRIKE! Judgment falls!\n💥 Righteous impact!',
      cooldown: 6,
      holyCost: 70
    },
    'Lay on Hands': {
      description: '🙏 Miraculous healing',
      effect: '• Major heal\n• Removes all debuffs\n• Divine touch',
      animation: '🙏 Divine energy flows through you!\n✨ LAY ON HANDS! Miraculous healing!\n💚 Wounds close instantly!',
      cooldown: 7,
      holyCost: 75
    },
    'Crusader Strike': {
      description: '⚔️ Holy warrior\'s blow',
      effect: '• Holy damage\n• Self heal\n• Crusade power',
      animation: '⚔️ Your blade blazes with holy fire!\n✨ CRUSADER STRIKE! For the light!\n💥 Evil trembles!',
      cooldown: 5,
      holyCost: 65
    },
    'Blessing of Kings': {
      description: '👑 Supreme blessing',
      effect: '• All stats up\n• HP increase\n• Royal power',
      animation: '👑 A crown of light appears!\n✨ BLESSING OF KINGS! Royal power!\n💫 All stats increased!',
      cooldown: 8,
      holyCost: 80
    },
    'Exorcism': {
      description: '👻 Banish evil',
      effect: '• Massive vs undead\n• Banishes demons\n• Holy purge',
      animation: '👻 Holy words of power resound!\n✨ EXORCISM! Evil begone!\n💫 Purification!',
      cooldown: 7,
      holyCost: 75
    },
    'Divine Judgment': {
      description: '⚖️ Heaven\'s final verdict',
      effect: '• Ultimate holy damage\n• God\'s will\n• Absolute justice',
      animation: '⚖️ The heavens open!\n✨ DIVINE JUDGMENT! God\'s will!\n💥 Absolute justice!',
      cooldown: 99,
      holyCost: 100
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // DEVOURER SKILLS (20 TOTAL - LEVELS 5-100)
  // ═══════════════════════════════════════════════════════════════
  Devourer: {
    // LEVELS 5-40 (EXISTING)
    'Devour': {
      description: '👹 Consume enemy essence to gain their power',
      effect: '• 110% damage\n• Steal 5% enemy stats permanently\n• Grows stronger',
      animation: '👹 Your maw opens impossibly wide...\n🌑 DEVOUR! Essence consumed!\n💫 Their power becomes yours!',
      cooldown: 3,
      hungerCost: 25
    },
    'Hungering Strike': {
      description: '🦷 Attack that grows stronger with consumption',
      effect: '• 100% + (20% per enemy devoured)\n• Stacks infinitely\n• Insatiable',
      animation: '🦷 Hunger drives you into frenzy...\n⚔️ HUNGERING STRIKE! Ravenous!\n💀 The more you feed, the hungrier you become!',
      cooldown: 2,
      hungerCost: 20
    },
    'Dark Pulse': {
      description: '🌌 Open a portal to the void itself',
      effect: '• 160% damage to all\n• Heal 30% of total damage\n• Consuming',
      animation: '🌌 Reality tears open before you...\n💀 VOID MAW! All is consumed!\n🌑 Nothing escapes the void!',
      cooldown: 4,
      hungerCost: 45
    },
    'Adaptive Evolution': {
      description: '🧬 Adapt to enemy attacks in real-time',
      effect: '• Gain 25% resist to last damage type\n• Stacks 4 times\n• Evolves',
      animation: '🧬 Your body shifts and changes...\n⚡ ADAPTIVE EVOLUTION! Growing stronger!\n💫 You learn from pain!',
      cooldown: 3,
      hungerCost: 30
    },
    'Feast': {
      description: '🍖 Gorge on defeated enemies',
      effect: '• Requires corpse\n• Restore 50% HP & Energy\n• +30% stats for 5 turns',
      animation: '🍖 You fall upon the corpse ravenously...\n🦷 FEAST! Nothing is wasted!\n💪 Vitality and power restored!',
      cooldown: 4,
      hungerCost: 0
    },
    'Endless Hunger': {
      description: '🔥 Your hunger can never be satisfied',
      effect: '• Passive: +2% all stats per kill\n• No limit\n• Infinite growth',
      animation: '🔥 The endless hunger drives you forward...\n💀 ENDLESS HUNGER! Power grows!\n⚡ Each kill makes you stronger!',
      cooldown: 99,
      hungerCost: 50
    },
    'Unstoppable Force': {
      description: '💢 Nothing can stop your advance',
      effect: '• CC immunity for 4 turns\n• +50% movement speed\n• Relentless',
      animation: '💢 You roar with determination...\n⚡ UNSTOPPABLE FORCE! Nothing stops you!\n💪 Like a juggernaut, you advance!',
      cooldown: 5,
      hungerCost: 40
    },
    'Cataclysmic Devour': {
      description: '🌋 Consume everything in one ultimate feast',
      effect: '• 250% damage to all\n• Heal 100% of damage dealt\n• Once per battle',
      animation: '🌋 Ultimate hunger awakens...\n💀 CATACLYSMIC DEVOUR! All is consumed!\n⚡ The battlefield is scoured clean!',
      cooldown: 99,
      hungerCost: 80
    },
    'Soul Devour': {
      description: '👿 Consume souls for infinite power',
      effect: '• Each kill permanently increases stats\n• Bonus damage to wounded\n• Endless hunger',
      animation: '👿 Your hunger knows no bounds...\n💀 SOUL EATER! Soul consumed!\n⚡ You grow ever stronger!',
      cooldown: 3,
      hungerCost: 35
    },
    'Blood Feast': {
      description: '🩸 Feast on enemy blood',
      effect: '• Heal 50% of damage\n• Restore 15 Hunger\n• +20% lifesteal for 2 turns',
      animation: '🩸 You bite deep into flesh...\n🦷 BLOOD FEAST! Warm blood flows!\n💪 Vitality restored completely!',
      cooldown: 3,
      hungerCost: 25
    },
    
    // LEVELS 45-100 (NEW)
    'Blood Rage': {
      description: '🩸 Enter violent blood frenzy',
      effect: '• +80% ATK\n• Speed up\n• Lifesteal boost',
      animation: '🩸 Blood boils in your veins!\n😈 BLOOD RAGE! Uncontrollable fury!\n💥 Savage rampage!',
      cooldown: 7,
      hungerCost: 65
    },
    'Consume All': {
      description: '👹 Devour everything',
      effect: '• Massive lifesteal\n• Heal greatly\n• Ultimate feast',
      animation: '👹 Your maw opens impossibly wide!\n😱 CONSUME! Nothing remains!\n🩸 Their essence becomes yours!',
      cooldown: 8,
      hungerCost: 70
    },
    'Crimson Tide': {
      description: '🌊 Blood wave attack',
      effect: '• AOE blood damage\n• Self heal\n• Blinds enemies',
      animation: '🌊 A wave of blood crashes forth!\n🩸 CRIMSON TIDE! Drowning in red!\n💀 Everything stained crimson!',
      cooldown: 7,
      hungerCost: 75
    },
    'Hemorrhage': {
      description: '🩸 Cause internal bleeding',
      effect: '• Massive bleed\n• DOT damage\n• Reduces healing',
      animation: '🩸 Blood vessels burst inside them!\n💀 HEMORRHAGE! Bleeding out!\n💉 Life drains rapidly!',
      cooldown: 6,
      hungerCost: 70
    },
    'Cannibalize': {
      description: '😈 Feast on corpses',
      effect: '• Heals massively\n• Blood restore\n• Power boost',
      animation: '😈 You feed on their remains!\n🩸 CANNIBALIZE! Strength restored!\n💪 Their power is yours!',
      cooldown: 6,
      hungerCost: 50
    },
    'Vampiric Aura': {
      description: '🦇 All damage heals',
      effect: '• Lifesteal aura\n• Damage to heal\n• Vampire power',
      animation: '🦇 Dark energy surrounds you!\n🩸 VAMPIRIC AURA! Life from death!\n💚 Every hit heals!',
      cooldown: 8,
      hungerCost: 75
    },
    'Bloodlust Max': {
      description: '😤 Sacrifice for power',
      effect: '• HP to damage\n• Massive buff\n• Pain is power',
      animation: '😤 You offer your own blood!\n🩸 BLOODLUST! Pain is power!\n💥 Overwhelming might!',
      cooldown: 7,
      hungerCost: 70
    },
    'Devour Soul': {
      description: '👻 Consume essence',
      effect: '• Massive damage\n• Steal stats permanently\n• Soul theft',
      animation: '👻 You rip out their soul!\n😈 DEVOUR SOUL! Nothing left!\n✨ Ultimate consumption!',
      cooldown: 9,
      hungerCost: 80
    },
    'Blood Pact': {
      description: '🩸 Life for power',
      effect: '• HP sacrifice\n• Massive damage\n• Dark bargain',
      animation: '🩸 You make a dark bargain!\n😈 BLOOD PACT! Power at any cost!\n💀 Your life for theirs!',
      cooldown: 10,
      hungerCost: 85
    },
    'Abyssal Hunger': {
      description: '😈 Ultimate devouring',
      effect: '• Consumes all\n• Ultimate power\n• Infinite hunger',
      animation: '😈 Infinite hunger awakens!\n🌑 ABYSSAL HUNGER! Consume all!\n💀 Nothing escapes!',
      cooldown: 99,
      hungerCost: 100
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // ARCHER SKILLS (20 TOTAL - LEVELS 5-100)
  // ═══════════════════════════════════════════════════════════════
  Archer: {
    // LEVELS 5-40 (EXISTING)
    'Multi-Shot': {
      description: '🏹 Fire multiple arrows simultaneously',
      effect: '• Fires 3-5 arrows\n• Each 60% damage\n• Hits random enemies',
      animation: '🏹 You nock multiple arrows at once...\n💨 MULTI SHOT! Arrows rain down!\n🎯 Multiple enemies struck!',
      cooldown: 3,
      focusCost: 30
    },
    'Explosive Arrow': {
      description: '💣 Fire an arrow tipped with explosives',
      effect: '• High damage on impact\n• AOE explosion\n• 70% chance to BURN',
      animation: '💣 You light the arrow tip carefully...\n🏹 EXPLOSIVE ARROW! It streaks forward!\n💥 BOOM! Devastating explosion!',
      cooldown: 4,
      focusCost: 40
    },
    'Volley': {
      description: '🏹 Fire arrows into the sky',
      effect: '• 5-8 arrows rain down\n• Each 50% damage\n• Wide area coverage',
      animation: '🏹 You fire arrows skyward...\n☔ VOLLEY! Death from above!\n🎯 Deadly rain of arrows!',
      cooldown: 4,
      focusCost: 45
    },
    'Poison Arrow': {
      description: '☠️ Arrow coated in deadly toxins',
      effect: '• Applies POISON (15 dmg/turn, 5 turns)\n• Reduces healing 50%\n• Stacks',
      animation: '☠️ You coat the arrow in venom...\n🏹 POISON ARROW! The shot burns!\n🧪 Toxins spread rapidly!',
      cooldown: 3,
      focusCost: 25
    },
    'Headshot': {
      description: '🔭 Take careful aim for perfect shot',
      effect: '• Extreme damage\n• Ignores 80% defense\n• 50% instant kill if enemy <25% HP',
      animation: '🎯 You line up the perfect shot...\n🔇 SNIPER SHOT! Silent and deadly!\n💀 One shot, one kill!',
      cooldown: 5,
      focusCost: 50
    },
    'Arrow Barrage': {
      description: '⚡ Unleash a flurry of arrows',
      effect: '• Fire 6-8 arrows rapidly\n• Each 40% damage\n• Cannot be dodged',
      animation: '⚡ Your hands become a blur...\n🏹 RAPID FIRE! Arrow storm!\n💨 Too fast to avoid!',
      cooldown: 4,
      focusCost: 40
    },
    'Piercing Shot': {
      description: '🎯 Arrow that pierces through enemies',
      effect: '• 150% damage\n• Hits all enemies in line\n• Ignores 50% armor',
      animation: '🎯 You draw the bow to its limit...\n🏹 PIERCING SHOT! It tears through!\n💫 The arrow pierces everything!',
      cooldown: 3,
      focusCost: 35
    },
    'Eagle Eye': {
      description: '🦅 Perfect focus and accuracy',
      effect: '• +50% crit chance for 3 turns\n• +30% damage\n• Cannot miss',
      animation: '🦅 Your vision sharpens dramatically...\n🎯 EAGLE EYE! Perfect precision!\n✨ Every shot finds its mark!',
      cooldown: 5,
      focusCost: 30
    },
    'Ice Arrow': {
      description: '❄️ Arrow infused with frost',
      effect: '• 110% damage\n• 40% chance to FREEZE\n• Slows target',
      animation: '❄️ Frost crystallizes on the arrow...\n🏹 ICE ARROW! Frozen flight!\n💎 Cold spreads on impact!',
      cooldown: 2,
      focusCost: 25
    },
    'Hunter\'s Mark': {
      description: '🎯 Mark a target for increased damage',
      effect: '• Target takes +40% damage\n• Reveals hidden enemies\n• Lasts 4 turns',
      animation: '🎯 You mark your prey...\n👁️ HUNTER\'S MARK! Nowhere to hide!\n✨ The target is exposed!',
      cooldown: 4,
      focusCost: 20
    },
    
    // LEVELS 45-100 (NEW)
    'Arrow Storm': {
      description: '🌧️ Rain arrows from sky',
      effect: '• Massive AOE\n• Many hits\n• Covers battlefield',
      animation: '🌧️ The sky darkens with arrows!\n🏹 ARROW STORM! Nowhere to hide!\n💥 Hundreds of impacts!',
      cooldown: 7,
      focusCost: 70
    },
    'Lightning Arrow': {
      description: '⚡ Electrified shot',
      effect: '• Shock damage\n• Chain lightning\n• Stuns target',
      animation: '⚡ Lightning crackles on your arrow!\n🏹 LIGHTNING ARROW! Electric death!\n💥 Shocking impact!',
      cooldown: 6,
      focusCost: 65
    },
    'Frost Volley': {
      description: '❄️ Freezing arrow rain',
      effect: '• AOE freeze\n• Slows all\n• Ice storm',
      animation: '❄️ Frost coats every arrow!\n🏹 FROST VOLLEY! Frozen rain!\n💎 Everything freezes!',
      cooldown: 7,
      focusCost: 75
    },
    'Perfect Shot': {
      description: '🎯 Flawless arrow',
      effect: '• Guaranteed hit\n• Massive crit\n• Ignore armor',
      animation: '🎯 Time stops as you aim!\n🏹 PERFECT SHOT! Flawless execution!\n💫 The impossible made real!',
      cooldown: 8,
      focusCost: 80
    },
    'Phantom Arrow': {
      description: '👻 Impossible shot',
      effect: '• Phases through walls\n• Cannot miss\n• Spectral arrow',
      animation: '👻 Your arrow phases through reality!\n🏹 PHANTOM ARROW! Impossible shot!\n⚡ How did that hit?',
      cooldown: 7,
      focusCost: 75
    },
    'Flame Volley': {
      description: '🔥 Fire arrow storm',
      effect: '• Burns everything\n• AOE fire\n• Mass burn',
      animation: '🔥 Flaming arrows fill the sky!\n🏹 FLAME VOLLEY! Fire rain!\n💥 Everything burns!',
      cooldown: 7,
      focusCost: 75
    },
    'True Shot': {
      description: '🎯 Ultimate accuracy',
      effect: '• Never misses\n• True damage\n• Pierces all',
      animation: '🎯 The perfect arrow!\n🏹 TRUE SHOT! Absolute precision!\n💫 Nothing can stop it!',
      cooldown: 8,
      focusCost: 85
    },
    'Death Arrow': {
      description: '💀 Killing shot',
      effect: '• Execute <30% HP\n• Massive damage\n• One-shot potential',
      animation: '💀 You nock death itself!\n🏹 DEATH ARROW! Fatal shot!\n⚰️ One arrow, one death!',
      cooldown: 9,
      focusCost: 90
    },
    'Barrage': {
      description: '🏹 Endless arrows',
      effect: '• 20+ arrows\n• Covers area\n• Overwhelming',
      animation: '🏹 Arrows fly endlessly!\n💨 BARRAGE! Infinite shots!\n💥 The air is filled with death!',
      cooldown: 10,
      focusCost: 95
    },
    'Deadeye': {
      description: '👁️ Ultimate archer skill',
      effect: '• Ultimate accuracy\n• Massive crit\n• Perfect kill',
      animation: '👁️ Your aim is absolute!\n🏹 DEADEYE! Perfect shot!\n💀 Death delivered!',
      cooldown: 99,
      focusCost: 100
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // BERSERKER SKILLS (20 TOTAL - LEVELS 5-100)
  // ═══════════════════════════════════════════════════════════════
  Berserker: {
    // LEVELS 5-40 (EXISTING)
    'Rampage': {
      description: '😤 Enter uncontrollable rage',
      effect: '• +40% ATK, -20% DEF\n• Attack multiple times\n• Cannot be stopped',
      animation: '😤 Rage consumes you completely...\n💢 RAMPAGE! Unstoppable fury!\n⚔️ Wild and deadly attacks!',
      cooldown: 4,
      rageCost: 40
    },
    'Bloodlust': {
      description: '🩸 Feed on battle to grow stronger',
      effect: '• +50% ATK for 3 turns\n• Lifesteal 15%\n• Stacks with kills',
      animation: '👹 Your eyes turn blood red...\n🩸 BLOODLUST! Primal rage!\n💪 Power surges with each strike!',
      cooldown: 4,
      rageCost: 35
    },
    'Rage Strike': {
      description: '💢 Unleash wild, uncontrolled strikes',
      effect: '• 5-8 random attacks\n• Each 70% damage\n• Ignores pain',
      animation: '💢 You lose all control...\n⚔️ WILD FURY! Chaotic destruction!\n🌪️ Nothing can stop you!',
      cooldown: 5,
      rageCost: 50
    },
    'Savage Roar': {
      description: '🦁 Roar with primal fury',
      effect: '• Fears all enemies\n• +40% ATK for party\n• Intimidates bosses',
      animation: '🦁 You unleash a primal roar...\n📣 SAVAGE ROAR! Bestial fury!\n😱 Enemies cower in terror!',
      cooldown: 5,
      rageCost: 30
    },
    'Reckless Assault': {
      description: '⚔️ Abandon defense for pure offense',
      effect: '• +80% ATK\n• DEF becomes 0\n• Lasts 2 turns',
      animation: '⚔️ You throw caution to the wind...\n💢 RECKLESS ASSAULT! All-out attack!\n⚡ Pure destructive power!',
      cooldown: 5,
      rageCost: 45
    },
    'Blood Rage': {
      description: '🩸 Rage fueled by wounds',
      effect: '• +10% ATK per 10% HP lost\n• Cannot die for 3 seconds\n• Frenzied',
      animation: '🩸 Pain fuels your rage...\n😡 BLOOD RAGE! Wounded beast!\n💪 Stronger with each injury!',
      cooldown: 6,
      rageCost: 40
    },
    'Primal Scream': {
      description: '📣 Unleash bestial fury',
      effect: '• Removes all debuffs\n• +30% all stats\n• Intimidates enemies',
      animation: '📣 A primal scream erupts...\n🦁 PRIMAL SCREAM! Raw power!\n⚡ Your inner beast awakens!',
      cooldown: 4,
      rageCost: 30
    },
    'Berserk': {
      description: '😡 True berserker transformation',
      effect: '• +100% ATK, +50% SPD\n• -50% DEF\n• Lasts 4 turns',
      animation: '😡 Ultimate rage consumes you...\n💢 BERSERK! Pure destruction!\n🔥 You become a force of nature!',
      cooldown: 7,
      rageCost: 60
    },
    'Feral Instinct': {
      description: '🐺 Channel primal instincts',
      effect: '• +40% dodge chance\n• +30% crit chance\n• Enhanced reflexes',
      animation: '🐺 Animal instincts take over...\n⚡ FERAL INSTINCT! Lightning reflexes!\n💨 You move like a predator!',
      cooldown: 4,
      rageCost: 25
    },
    'Crushing Blow': {
      description: '💪 Strike with overwhelming force',
      effect: '• 200% damage\n• 60% chance to STUN\n• Breaks guards',
      animation: '💪 You gather all your strength...\n💥 CRUSHING BLOW! Devastating impact!\n⚡ The enemy crumples!',
      cooldown: 4,
      rageCost: 40
    },
    
    // LEVELS 45-100 (NEW)
    'Rage Incarnate': {
      description: '😡 Pure fury',
      effect: '• Massive ATK buff\n• Loss of control\n• Unstoppable',
      animation: '😡 Anger consumes everything!\n💢 RAGE INCARNATE! Unstoppable!\n💥 Nothing but destruction!',
      cooldown: 8,
      rageCost: 75
    },
    'Blood Frenzy': {
      description: '🩸 Low HP power',
      effect: '• +100% ATK at low HP\n• Lifesteal\n• Danger boost',
      animation: '🩸 Pain fuels your rage!\n😤 BLOOD FRENZY! Closer to death, closer to victory!\n💪 Power surges!',
      cooldown: 7,
      rageCost: 70
    },
    'Rampage Max': {
      description: '💢 Total chaos',
      effect: '• AOE multi-attack\n• Cannot stop\n• Smash everything',
      animation: '💢 You lose all restraint!\n😡 RAMPAGE! Smash everything!\n💥 Total chaos!',
      cooldown: 8,
      rageCost: 80
    },
    'Primal Rage': {
      description: '🦍 Ancient fury',
      effect: '• All stats up\n• Wild power\n• Savage strength',
      animation: '🦍 Ancient rage awakens!\n💢 PRIMAL RAGE! Savage strength!\n🔥 Raw and untamed!',
      cooldown: 9,
      rageCost: 85
    },
    'Death or Glory': {
      description: '⚔️ All-in attack',
      effect: '• Massive damage\n• Risky\n• Win or die',
      animation: '⚔️ You bet everything!\n💀 DEATH OR GLORY! Win or die!\n💥 Maximum power!',
      cooldown: 10,
      rageCost: 90
    },
    'Unstoppable': {
      description: '🚂 Cannot be halted',
      effect: '• Pierce all\n• Knockback\n• Immovable force',
      animation: '🚂 You barrel forward!\n💪 UNSTOPPABLE! Immovable meets!\n💥 Crash!',
      cooldown: 8,
      rageCost: 80
    },
    'Last Stand Max': {
      description: '⚔️ Fight at death door',
      effect: '• Survive lethal\n• Damage buff\n• Refuse to die',
      animation: '⚔️ You refuse to fall!\n💪 LAST STAND! Not yet!\n🔥 Burning defiance!',
      cooldown: 10,
      rageCost: 85
    },
    'Savage Might': {
      description: '💪 Peak strength',
      effect: '• Ultimate ATK\n• Break limits\n• Maximum power',
      animation: '💪 Your strength peaks!\n⚡ SAVAGE MIGHT! Beyond limits!\n💥 Unmatched power!',
      cooldown: 9,
      rageCost: 90
    },
    'Feral Rage': {
      description: '🐺 Beast unleashed',
      effect: '• Transform\n• Massive buffs\n• Wild beast',
      animation: '🐺 The beast within breaks free!\n😡 FERAL RAGE! Pure savagery!\n💢 Completely wild!',
      cooldown: 10,
      rageCost: 95
    },
    'Titan Wrath': {
      description: '⚡ Ultimate rage',
      effect: '• Godlike fury\n• Ultimate power\n• World-shatter',
      animation: '⚡ You channel titan rage!\n😡 TITAN\'S WRATH! Godlike fury!\n💥 World-shattering power!',
      cooldown: 99,
      rageCost: 100
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // DRAGON KNIGHT SKILLS (20 TOTAL - LEVELS 5-100)
  // ═══════════════════════════════════════════════════════════════
  DragonKnight: {
    // LEVELS 5-40 (EXISTING)
    'Dragon Breath': {
      description: '🐉 Unleash devastating dragon fire',
      effect: '• Massive fire damage\n• 70% BURN chance\n• Pierces 50% defense\n• AOE cone',
      animation: '🐉 You channel draconic power...\n🔥 DRAGON BREATH! Flames erupt!\n🌋 Everything burns in the inferno!',
      cooldown: 4,
      dragonCost: 50
    },
    'Dragon Claw': {
      description: '🐉 Strike with dragon-empowered claws',
      effect: '• High physical damage\n• Applies BLEED\n• Can crit',
      animation: '🐉 Your hands transform into claws...\n⚔️ DRAGON CLAW! Razor sharp!\n🩸 Deep gashes tear open!',
      cooldown: 2,
      dragonCost: 25
    },
    'Flame Breath': {
      description: '🔥 Breathe fire like a dragon',
      effect: '• Cone of fire damage\n• 80% BURN chance\n• Melts armor',
      animation: '🔥 You inhale deeply...\n🐉 FLAME BREATH! Inferno erupts!\n🌋 Scorching flames consume all!',
      cooldown: 3,
      dragonCost: 35
    },
    'Wing Buffet': {
      description: '💨 Create powerful gust with wings',
      effect: '• Knocks back enemies\n• AOE wind damage\n• Creates distance',
      animation: '💨 Wings sprout from your back...\n🌪️ WING BUFFET! Hurricane force!\n💫 Enemies blown away!',
      cooldown: 3,
      dragonCost: 30
    },
    'Dragon Ascension': {
      description: '🐲 Transform into a dragon',
      effect: '• +100% all stats for 3 turns\n• Gain flight\n• All attacks deal fire damage',
      animation: '🐲 Wings unfold massively...\n✨ DRAGON ASCENSION! Ultimate form!\n🔥 You BECOME the dragon!',
      cooldown: 99,
      dragonCost: 80
    },
    'Dragon Slash': {
      description: '⚔️ Slash with draconic force',
      effect: '• High physical damage\n• +50% vs armored\n• Ignores 30% defense',
      animation: '⚔️ Draconic power flows through you...\n🐉 DRAGON SLASH! Devastating cut!\n💥 Armor is rent apart!',
      cooldown: 2,
      dragonCost: 30
    },
    'Dragon Roar': {
      description: '🐲 Roar with dragon might',
      effect: '• Fears all enemies\n• +30% ATK for 3 turns\n• Reduces enemy DEF 20%',
      animation: '🐲 You unleash a deafening roar...\n📣 DRAGON ROAR! Terrifying power!\n😱 Enemies tremble in fear!',
      cooldown: 4,
      dragonCost: 35
    },
    'Dragon Wings': {
      description: '🦅 Summon draconic wings',
      effect: '• Dodge next attack\n• +20% speed\n• Aerial advantage',
      animation: '🦅 Wings unfold from your back...\n💨 DRAGON WINGS! Soaring high!\n✨ Untouchable in the air!',
      cooldown: 3,
      dragonCost: 25
    },
    'Tail Sweep': {
      description: '🐉 Sweep enemies with dragon tail',
      effect: '• AOE physical damage\n• Knocks down all enemies\n• Stunning impact',
      animation: '🐉 A massive tail materializes...\n💥 TAIL SWEEP! Crushing force!\n🌊 Enemies tumble like leaves!',
      cooldown: 3,
      dragonCost: 30
    },
    'Inferno Strike': {
      description: '🔥 Weapon infused with dragon fire',
      effect: '• 180% fire damage\n• 90% BURN chance\n• Explosive impact',
      animation: '🔥 Your weapon erupts in flames...\n⚔️ INFERNO STRIKE! Dragon\'s wrath!\n💥 Fiery devastation!',
      cooldown: 4,
      dragonCost: 45
    },
    
    // LEVELS 45-100 (NEW)
    'Dragon Heart': {
      description: '❤️ Dragon\'s heart beats',
      effect: '• Heal greatly\n• Buff all\n• Remove debuffs',
      animation: '❤️ Your heart burns with dragon fire!\n🐲 DRAGON HEART! Indomitable will!\n🔥 Never give up!',
      cooldown: 7,
      dragonCost: 70
    },
    'Meteor Dive': {
      description: '☄️ Plummet like falling star',
      effect: '• Massive damage\n• AOE stun\n• Crater impact',
      animation: '☄️ You soar high then dive!\n🐲 METEOR DIVE! Impact!\n💥 Catastrophic landing!',
      cooldown: 8,
      dragonCost: 75
    },
    'Elder Dragon': {
      description: '🐉 Ancient dragon form',
      effect: '• Full transform\n• Massive buffs\n• Primordial power',
      animation: '🐉 Your true form emerges!\n🦖 ELDER DRAGON! Legendary beast!\n✨ Primordial power!',
      cooldown: 10,
      dragonCost: 85
    },
    'Dragon Scale': {
      description: '🛡️ Dragon armor',
      effect: '• Massive defense\n• Damage reduction\n• Impenetrable',
      animation: '🛡️ Scales cover your body!\n🐲 DRAGON SCALE! Unbreakable!\n💎 Perfect defense!',
      cooldown: 7,
      dragonCost: 70
    },
    'Flame Nova': {
      description: '🔥 Fire explosion',
      effect: '• AOE fire\n• Burns all\n• Mass incineration',
      animation: '🔥 Fire explodes from you!\n🐲 FLAME NOVA! Everything burns!\n💥 Incineration!',
      cooldown: 8,
      dragonCost: 80
    },
    'Dragon Fury': {
      description: '🐲 Ultimate rage',
      effect: '• Massive buffs\n• Dragon power\n• Overwhelming',
      animation: '🐲 Dragon spirit merges!\n🔥 DRAGON FURY! Unstoppable!\n💥 Overwhelming power!',
      cooldown: 9,
      dragonCost: 85
    },
    'Sky Render': {
      description: '⚔️ Cut the sky',
      effect: '• Huge damage\n• Tears reality\n• Ultimate slash',
      animation: '⚔️ Your blade cuts the sky!\n🐲 SKY RENDER! Reality tears!\n💫 The heavens split!',
      cooldown: 9,
      dragonCost: 90
    },
    'Dragon Lord': {
      description: '👑 Supreme dragon',
      effect: '• Lord transformation\n• Ultimate stats\n• Dragon king',
      animation: '👑 You become Dragon Lord!\n🐲 DRAGON LORD! Supreme!\n✨ King of dragons!',
      cooldown: 10,
      dragonCost: 95
    },
    'Inferno Cannon': {
      description: '🔥 Ultimate fire beam',
      effect: '• Massive fire\n• Pierces all\n• Beam attack',
      animation: '🔥 You charge ultimate fire!\n🐲 INFERNO CANNON! Beam blast!\n💥 Everything melts!',
      cooldown: 10,
      dragonCost: 95
    },
    'Apocalyptic Flame': {
      description: '🔥 Ultimate dragon fire',
      effect: '• World burns\n• Everything ash\n• Dragon ultimate',
      animation: '🔥 Dragon fire beyond measure!\n🐲 APOCALYPTIC FLAME! World burns!\n💥 Everything reduced to ash!',
      cooldown: 99,
      dragonCost: 100
    }
  },

  // ═══ MONK (18 skills, every 5 levels 5→90) ═══════════════════
  Monk: {
    'Rapid Strikes':       { description: '👊 Lightning flurry — 3 hits at 60% each', effect: '• 3 hits × 60% DMG\n• 20% BLEED chance per hit\n• Ignores 15% DEF', animation: '💨 Hands blur at godspeed...\n👊👊👊 RAPID STRIKES!\n💥 Three hits land before they blink!', cooldown: 2, energyCost: 8 },
    'Chi Burst':           { description: '🌀 Focused Chi wave 140% damage', effect: '• 140% damage\n• 25% STUN 1 turn\n• Restores 15 energy', animation: '🌀 Chi concentrates at your core...\n💫 CHI BURST! Pure energy erupts!\n⭐ Enemy sent reeling!', cooldown: 3, energyCost: 15 },
    'Iron Body':           { description: '🪨 Harden body — next hit deals 0 damage', effect: '• +40% DEF for 3 turns\n• Immune to BLEED\n• Absorbs next hit entirely', animation: '💪 Your skin turns to iron...\n🪨 IRON BODY! Impenetrable!\n🛡️ You feel nothing!', cooldown: 5, energyCost: 20 },
    'Dragon Kick':         { description: '🐉 Dragon-powered kick 160% damage', effect: '• 160% damage\n• 35% STUN chance\n• 30% knockback (skip turn)', animation: '🔥 Dragon energy surges through your leg...\n🐉 DRAGON KICK! Unstoppable!\n💥 The impact cracks stone!', cooldown: 3, energyCost: 22 },
    'Pressure Point':      { description: '💉 Vital strike reduces enemy ATK 30%', effect: '• 120% damage\n• -30% enemy ATK 3 turns\n• Cannot miss', animation: '☝️ You locate the exact pressure point...\n💉 PRESSURE POINT! Pinpoint precision!\n😵 Their power drains away!', cooldown: 3, energyCost: 18 },
    'Wind Walk':           { description: '💨 Dodge +80% for 2 turns, next attack +50%', effect: '• +80% dodge for 2 turns\n• Next attack +50% DMG\n• Cannot be slowed', animation: '💨 You merge with the wind...\n🌪️ WIND WALK! Untouchable!\n👻 Strikes pass through you!', cooldown: 5, energyCost: 25 },
    'Thousand Palms':      { description: '🙌 Five rapid palm strikes 50% each', effect: '• 5 hits × 50% each\n• +5 Chi restored per hit\n• 15% crit chance per hit', animation: '🙌 Your palms multiply like ghosts...\n💨 THOUSAND PALMS! Five at once!\n⚡ The enemy has no escape!', cooldown: 4, energyCost: 30 },
    'Enlightenment':       { description: '✨ Heal 25%, +20% all stats, clear debuffs', effect: '• Heal 25% max HP\n• +20% all stats 3 turns\n• Clears all debuffs', animation: '🧘 You achieve perfect stillness...\n✨ ENLIGHTENMENT! Mind clears!\n🌟 Perfect peace and power!', cooldown: 6, energyCost: 35 },
    'Soul Fist':           { description: '👊 200% true damage + 50% FEAR', effect: '• 200% true damage\n• 50% FEAR chance\n• Drains 20 enemy energy', animation: '💀 Your fist glows with soul energy...\n👊 SOUL FIST! Strikes the spirit!\n😱 Their soul trembles!', cooldown: 4, energyCost: 40 },
    'Final Form':          { description: '🔥 +50% ATK/SPEED, all crits, 20% lifesteal', effect: '• +50% ATK & SPEED 4 turns\n• All attacks guaranteed crit\n• 20% lifesteal active', animation: '🔥 Flames ignite around your body...\n💥 FINAL FORM! Peak human achieved!\n⚡ You transcend all limits!', cooldown: 8, energyCost: 55 },
    'Chi Wave':            { description: '🌊 AOE Chi wave 130% to all enemies', effect: '• 130% AOE damage\n• 30% WEAKEN all (2 turns)\n• Restores 20 Chi', animation: '🌊 Chi radiates outward in waves...\n💫 CHI WAVE! Everything swept!\n⚡ All enemies stagger!', cooldown: 4, energyCost: 35 },
    'Iron Fist Mastery':   { description: '🦾 180% damage ignoring 40% armor', effect: '• 180% damage\n• Ignore 40% DEF\n• 40% chance STUN 1 turn', animation: '🦾 Decades of training focus here...\n👊 IRON FIST MASTERY! Perfected!\n💥 Even armor shatters!', cooldown: 4, energyCost: 38 },
    'Wind Dragon':         { description: '🐉 Combine wind and dragon — 220% AOE', effect: '• 220% damage + 80% AOE splash\n• SLOW all 2 turns\n• +40% your SPEED for 3 turns', animation: '🌪️🐉 Wind and dragon merge...\n⚡ WIND DRAGON! Devastating!\n💨 Everything is swept away!', cooldown: 5, energyCost: 45 },
    'Soul Shatter':        { description: '💀 Shatter enemy soul — 240% true dmg', effect: '• 240% true damage\n• -20% enemy max HP permanently\n• 60% FEAR 2 turns', animation: '💀 You reach for their soul itself...\n😱 SOUL SHATTER! Ripped apart!\n💥 Their spirit cracks!', cooldown: 5, energyCost: 50 },
    'One Punch':           { description: '👊 One perfect punch — 300% damage', effect: '• 300% damage, guaranteed crit\n• Ignores all DEF\n• 70% chance instant stun', animation: '👊 You draw back one fist...\n💥 ONE PUNCH! The ground cracks!\n😵 One hit. That is all.', cooldown: 6, energyCost: 55 },
    'Transcendent Form':   { description: '✨ Heal 50%, immune 2 turns, +60% all stats', effect: '• Heal 50% max HP\n• Immune to all effects 2 turns\n• +60% all stats 4 turns', animation: '✨ You surpass mortal limits...\n🌟 TRANSCENDENT FORM!\n⚡ You are beyond human!', cooldown: 8, energyCost: 65 },
    'Limitless':           { description: '♾️ Remove all self-limits — 350% true dmg', effect: '• 350% true damage\n• Cannot be reduced or blocked\n• +80% all stats for 3 turns after', animation: '♾️ Every limit in your mind vanishes...\n💥 LIMITLESS! Unrestricted!\n🔥 Pure unbounded power!', cooldown: 7, energyCost: 70 },
    'Martial Godhood':     { description: '🌟 Achieve godhood — 400% + full AOE', effect: '• 400% true damage to main target\n• 200% AOE to all others\n• All status effects, guaranteed', animation: '🌟 You ascend beyond martial mastery...\n⚡ MARTIAL GODHOOD! Transcended!\n💥 Even gods would yield to this!', cooldown: 10, energyCost: 80 },
  },

  // ═══ SHAMAN (18 skills) ══════════════════════════════════════
  Shaman: {
    'Hex Bolt':            { description: '☠️ 110% cursed magic, 35% WEAKEN', effect: '• 110% magic damage\n• 35% WEAKEN (-25% ATK, 2 turns)\n• Unblockable', animation: '☠️ Dark energy crackles...\n💀 HEX BOLT! Cursed!\n😰 Their strength fades!', cooldown: 2, energyCost: 12 },
    'Serpent Totem':       { description: '🐍 80% damage + 50% POISON 3 turns', effect: '• 80% damage\n• 50% POISON (3 turns)\n• Totem lingers 2 turns', animation: '🌿 A totem rises...\n🐍 SERPENT TOTEM!\n☠️ Venom flows!', cooldown: 3, energyCost: 10 },
    'Spirit Shield':       { description: '🛡️ Block 3 hits, reflect 15% damage', effect: '• Blocks next 3 hits (30% each)\n• Reflects 15% damage\n• Lasts 3 turns', animation: '👻 Spirits surround you...\n🛡️ SPIRIT SHIELD! Protected!\n✨ Ancestral barrier formed!', cooldown: 5, energyCost: 22 },
    'Rain of Frogs':       { description: '🐸 AOE 90% + SLOW all enemies', effect: '• AOE 90% damage\n• 40% SLOW all 2 turns\n• Hits all enemies', animation: '🌧️ Dark clouds form...\n🐸 RAIN OF FROGS!\n💥 Nature goes haywire!', cooldown: 4, energyCost: 25 },
    'Earthquake':          { description: '🌍 150% damage + 60% STUN', effect: '• 150% damage\n• 60% STUN 1 turn\n• -20% enemy DEF 2 turns', animation: '🌍 Earth begins to crack...\n💥 EARTHQUAKE!\n😵 Nothing stands!', cooldown: 4, energyCost: 32 },
    'Soul Link':           { description: '🔗 Link — enemy takes 30% of your hits', effect: '• Enemy reflects 30% damage you receive\n• Lasts 3 turns\n• Cannot be dispelled', animation: '🔗 A chain links your souls...\n✨ SOUL LINK! Fates tied!\n😱 What hurts you, hurts them!', cooldown: 5, energyCost: 28 },
    'Corruption':          { description: '🌑 Apply POISON + BLEED + WEAKEN at once', effect: '• POISON + BLEED + WEAKEN\n• Each lasts 3 turns\n• 70% chance each', animation: '🌑 Dark energy seeps in...\n☠️ CORRUPTION! Three curses!\n💀 Rots from within!', cooldown: 6, energyCost: 40 },
    "Ancestor's Wrath":    { description: '👴 Channel ancestral rage 170% + FEAR', effect: '• 170% damage\n• +30% ATK for 3 turns\n• 20% FEAR chance', animation: '👴 Ancient voices answer...\n⚡ ANCESTORS WRATH!\n💢 History itself strikes!', cooldown: 4, energyCost: 30 },
    "Nature's Fury":       { description: '🌿 200% nature AOE + 30% STUN all', effect: '• 200% nature damage\n• AOE 50% to all\n• 30% STUN all enemies', animation: '🌿 Nature answers your call...\n⚡ NATURES FURY!\n🌪️ Every element unleashed!', cooldown: 5, energyCost: 45 },
    'Spirit Ascension':    { description: '✨ Heal 40%, +40% stats, immune 3 turns', effect: '• Heal 40% max HP\n• +40% all stats 3 turns\n• Immune to status effects', animation: '✨ Your spirit rises above...\n🌟 SPIRIT ASCENSION!\n⚡ Peak spiritual power!', cooldown: 8, energyCost: 55 },
    'Blood Moon':          { description: '🌕 Blood moon rises — all attacks +25%', effect: '• Blood moon buff 4 turns\n• All damage +25%\n• Enemy healing blocked 50%', animation: '🌕 The moon turns red...\n🩸 BLOOD MOON! Crimson rises!\n😈 All power amplified!', cooldown: 5, energyCost: 40 },
    'Storm Call':          { description: '⛈️ Call lightning storm 180% + STUN', effect: '• 180% lightning damage\n• 50% STUN 2 turns\n• AOE 70% to nearby enemies', animation: '⛈️ Clouds darken violently...\n⚡ STORM CALL! Lightning strikes!\n😵 The sky answers your will!', cooldown: 4, energyCost: 42 },
    'Death Hex':           { description: '💀 Cursed hex drains 10% HP per turn', effect: '• 120% damage\n• Hex: 10% max HP drain/turn 4 turns\n• Cannot be cleansed', animation: '💀 Ancient curse words spoken...\n🌑 DEATH HEX! Doom sealed!\n☠️ Life fades inexorably!', cooldown: 5, energyCost: 48 },
    'Void Curse':          { description: '⚫ Curse reduces all enemy stats 40%', effect: '• 150% void damage\n• -40% all enemy stats 3 turns\n• Silence 2 turns', animation: '⚫ Void energy pours through you...\n💀 VOID CURSE! Everything reduced!\n😵 They are a shell of themselves!', cooldown: 6, energyCost: 52 },
    'Spirit Cannon':       { description: '💫 Condense spirit into 250% beam', effect: '• 250% concentrated spirit damage\n• Ignores all shields\n• 60% WEAKEN + SLOW', animation: '💫 You condense all spirit power...\n⚡ SPIRIT CANNON! Focused beam!\n💥 Nothing resists this!', cooldown: 6, energyCost: 58 },
    'World Tree':          { description: '🌳 World tree heals you 60% + buffs all', effect: '• Heal 60% max HP\n• +50% all stats 4 turns\n• Revive once if KOd this turn', animation: '🌳 The world tree answers...\n🌿 WORLD TREE! Life energy!\n✨ You are renewed completely!', cooldown: 8, energyCost: 65 },
    'Elder Shaman':        { description: '🦅 Become elder shaman — all debuffs immune', effect: '• 280% damage\n• Immune to all debuffs 5 turns\n• All stat buffs doubled', animation: '🦅 The spirits recognize you as Elder...\n🌟 ELDER SHAMAN! Ascended!\n⚡ Nature itself obeys!', cooldown: 8, energyCost: 70 },
    'God of Nature':       { description: '🌍 Become nature god — 400% + world shatter', effect: '• 400% damage to target\n• 200% AOE to all others\n• STUN + POISON + WEAKEN all', animation: '🌍 You become one with all of nature...\n💥 GOD OF NATURE! Shatter!\n🌿 The world bends to your will!', cooldown: 10, energyCost: 80 },
  },

  // ═══ BLOOD KNIGHT (18 skills) ════════════════════════════════
  BloodKnight: {
    'Blood Drain':         { description: '🩸 130% damage + 35% lifesteal', effect: '• 130% damage\n• 35% lifesteal\n• -40% enemy healing 2 turns', animation: '🩸 You reach with crimson hunger...\n💉 BLOOD DRAIN! Life siphoned!\n😱 Their vitality pours into you!', cooldown: 3, energyCost: 18 },
    'Crimson Strike':      { description: '🗡️ 140% + 60% BLEED, crit if bleeding', effect: '• 140% damage\n• 60% BLEED (3 turns)\n• Auto-crit if target is bleeding', animation: '🗡️ Your blade drips crimson...\n💢 CRIMSON STRIKE!\n🩸 The wound will not close!', cooldown: 3, energyCost: 20 },
    'Vampiric Aura':       { description: '🧛 +25% lifesteal, drain 5% HP/turn', effect: '• +25% lifesteal for 4 turns\n• Drain 5% max HP/turn\n• Heals from DoT damage too', animation: '🌑 Dark aura bleeds from you...\n🧛 VAMPIRIC AURA! Life flows to you!\n💚 Growing stronger by the moment!', cooldown: 5, energyCost: 25 },
    'Hemorrhage':          { description: '💉 120% + uncleansable BLEED 5 turns', effect: '• 120% damage\n• BLEED: 3% max HP/turn\n• 5 turns, cannot be cleansed', animation: '💉 You strike deep into tissue...\n🩸 HEMORRHAGE! Vessels rupture!\n☠️ Internal bleeding — unstoppable!', cooldown: 4, energyCost: 28 },
    'Blood Frenzy':        { description: '😤 +40% ATK vs bleeding, kill = +15% HP', effect: '• +40% ATK vs bleeding enemies\n• Each kill restores 15% HP\n• Lasts 3 turns', animation: '😤 The scent of blood drives you wild...\n💢 BLOOD FRENZY! Pure predator!\n🩸 Nothing will stop you now!', cooldown: 5, energyCost: 30 },
    'Death Coil':          { description: '💀 Drain 8% max HP/turn for 4 turns', effect: '• 100% damage\n• Drain 8% max HP/turn 4 turns\n• You heal equal amount each tick', animation: '💀 Dark tendrils wrap around them...\n🌑 DEATH COIL! Life drains!\n💚 As they weaken, you grow!', cooldown: 4, energyCost: 32 },
    'Sanguine Burst':      { description: '💥 180% + AOE 50% + 50% STUN', effect: '• 180% damage to target\n• 50% AOE splash\n• 50% STUN main target', animation: '💥 You compress the blood within...\n🩸 SANGUINE BURST! Explosion!\n😵 The impact is catastrophic!', cooldown: 4, energyCost: 38 },
    'Bloodbath':           { description: '🩸 AOE 160%, heal 20% per target hit', effect: '• 160% AOE damage\n• Heal 20% per enemy hit\n• +30% ATK for 3 turns after', animation: '🩸 You spread your arms to the carnage...\n💢 BLOODBATH! Crimson everywhere!\n💚 Their blood becomes your power!', cooldown: 6, energyCost: 42 },
    'Lifestealer':         { description: '💔 200%, 50% lifesteal, -10% max HP perm', effect: '• 200% damage\n• 50% lifesteal\n• Reduce enemy max HP by 10%', animation: '💔 You grasp their life force...\n😱 LIFESTEALER! Stolen!\n💚 Their essence completes you!', cooldown: 5, energyCost: 48 },
    'Crimson Apocalypse':  { description: '🌋 280% true + 40% HP lifesteal', effect: '• 280% true damage\n• 40% max HP as lifesteal\n• BLEED + WEAKEN 5 turns', animation: '🌋 The world turns crimson...\n💢 CRIMSON APOCALYPSE!\n🩸 Nothing survives the flood!', cooldown: 8, energyCost: 60 },
    'Blood Nova':          { description: '💥 250% blood explosion, full AOE', effect: '• 250% damage — full AOE hit\n• BLEED all enemies 3 turns\n• 40% WEAKEN all', animation: '💥 Blood detonates in a nova...\n🩸 BLOOD NOVA! Cascade!\n💀 Every enemy bleeds!', cooldown: 6, energyCost: 55 },
    'Dark Feast':          { description: '🍖 Consume bleed stacks — heal 30%', effect: '• Consumes all BLEED stacks\n• Heal 30% max HP per stack\n• Deal 200% to any who were bleeding', animation: '😤 You feast on the corruption...\n🩸 DARK FEAST! Consumed!\n💚 The blood was sustenance!', cooldown: 5, energyCost: 45 },
    'Eternal Hunger':      { description: '♾️ Infinite lifesteal — 50% all damage', effect: '• 50% lifesteal on ALL damage 4 turns\n• Cannot be healed through\n• +30% ATK', animation: '♾️ An endless hunger awakens...\n🧛 ETERNAL HUNGER! Feed!\n💚 Every blow heals you!', cooldown: 6, energyCost: 55 },
    'Sanguine God':        { description: '🩸 Become blood god — 300% + aura', effect: '• 300% damage\n• Blood god aura: drain 15%/turn 3t\n• Immune to WEAKEN & SLOW', animation: '🩸 Blood crowns your head...\n😈 SANGUINE GOD! Ascended!\n💀 Blood is your domain!', cooldown: 7, energyCost: 65 },
    'Blood World':         { description: '🌍 Flood battlefield with blood — all effects', effect: '• 280% AOE damage\n• BLEED + WEAKEN + SLOW all\n• Heal 20% for each target hit', animation: '🌍 The battlefield floods crimson...\n🩸 BLOOD WORLD! Drowned!\n😱 They cannot escape the tide!', cooldown: 8, energyCost: 68 },
    'Hemomancer':          { description: '🧙 Control blood — 350% true damage', effect: '• 350% true damage\n• Control enemy HP directly\n• Drain 30% their max HP', animation: '🧙 Blood bends to your will...\n💉 HEMOMANCER! Controlled!\n😱 Their own blood betrays them!', cooldown: 7, energyCost: 72 },
    'Scarlet Reaper':      { description: '⚰️ 380% true + execute <25% HP', effect: '• 380% true damage\n• Instant kill if enemy <25% HP\n• BLEED + FEAR guaranteed', animation: '⚰️ Death manifests in crimson...\n💀 SCARLET REAPER! Harvest!\n🩸 Your blade reaps souls!', cooldown: 8, energyCost: 75 },
    'Vampire Lord':        { description: '🦇 Become vampire lord — 450% + full drain', effect: '• 450% damage\n• Drain 50% enemy max HP as heal\n• All blood effects doubled for 5 turns', animation: '🦇 You ascend to Vampire Lord...\n😈 VAMPIRE LORD! ETERNAL!\n🩸 Blood is yours. Forever.', cooldown: 10, energyCost: 85 },
  },

  // ═══ SPELLBLADE (18 skills) ══════════════════════════════════
  SpellBlade: {
    'Spellstrike':         { description: '⚔️ 130% combined physical+magic damage', effect: '• 130% combined damage\n• 30% WEAKEN chance\n• Ignores magic resistance', animation: '💜 Runes ignite along the blade...\n⚔️ SPELLSTRIKE! Dual-nature!\n✨ Magic and steel as one!', cooldown: 2, energyCost: 16 },
    'Arcane Slash':        { description: '💜 120% damage + 40% BURN 2 turns', effect: '• 120% damage\n• 40% BURN 2 turns\n• +10 arcane generated', animation: '💜 Arcane energy traces your arc...\n⚡ ARCANE SLASH!\n🔥 The cut burns with magic fire!', cooldown: 2, energyCost: 14 },
    'Runic Ward':          { description: '🔷 +35% DEF, reflect 20% magic', effect: '• +35% DEF for 3 turns\n• Reflect 20% magic damage back\n• Immune to SILENCE', animation: '🔷 Ancient runes glow around you...\n✨ RUNIC WARD! Protected!\n🛡️ A runic barrier materializes!', cooldown: 4, energyCost: 22 },
    'Blade Storm':         { description: '🌪️ AOE 110% spinning blade slash', effect: '• AOE 110% damage\n• BLEED 2 turns to all\n• +15% ATK for 2 turns after', animation: '🌪️ You spin with blade extended...\n⚔️ BLADE STORM! Nothing survives!\n💨 Arcane whirlwind destroys all!', cooldown: 4, energyCost: 28 },
    'Arcane Surge':        { description: '⚡ +50% ATK & magic damage for 3 turns', effect: '• +50% ATK for 3 turns\n• +30% magic damage 3 turns\n• Each hit: -5 energy but +20% dmg', animation: '⚡ Arcane power flows through your arm...\n💥 ARCANE SURGE! Unstoppable!\n✨ Your weapon hums with raw energy!', cooldown: 5, energyCost: 30 },
    'Runic Explosion':     { description: '💥 170% magic AOE + 45% STUN', effect: '• 170% magic damage\n• AOE 60% splash\n• 45% STUN main target', animation: '🔴 The runes flash critical red...\n💥 RUNIC EXPLOSION! Detonated!\n😵 Everything blasted away!', cooldown: 4, energyCost: 35 },
    'Void Edge':           { description: '🌑 150% true damage + SILENCE', effect: '• 150% true damage\n• 40% SILENCE chance\n• Drain 15 enemy energy', animation: '🌑 Your blade turns void-black...\n⚔️ VOID EDGE! Reality cut!\n✨ Nothing withstands the void!', cooldown: 4, energyCost: 38 },
    'Arcane Overcharge':   { description: '⚡ +70% ATK, crit all, self 10% HP/turn', effect: '• +70% ATK & Magic 2 turns\n• Guaranteed crits\n• 10% self-damage per turn', animation: '⚡ Runes glow dangerously bright...\n💥 ARCANE OVERCHARGE! Beyond limits!\n😤 Power tears through you!', cooldown: 6, energyCost: 45 },
    'Spellblade Finale':   { description: '🌟 250% scaled by arcane energy spent', effect: '• 250% base + 2% per energy spent\n• Cannot miss\n• Clears all runes for bonus', animation: '🌟 Every rune on your body ignites...\n💥 SPELLBLADE FINALE! Released!\n⚡ Blinding arcane explosion!', cooldown: 7, energyCost: 50 },
    'Mythril Onslaught':   { description: '⚔️ 5 hits at 80% each, final hit +50%', effect: '• 5 hits × 80% damage\n• 25% crit chance per hit\n• Final hit +50% bonus', animation: '⚔️ You move beyond normal speed...\n💨 MYTHRIL ONSLAUGHT! Five strikes!\n💥 The final blow is earth-shattering!', cooldown: 6, energyCost: 55 },
    'Arcane Infusion':     { description: '🔮 Infuse weapon permanently +30% magic', effect: '• +30% magic damage permanent this battle\n• Weapon glows arcane\n• Each hit applies 20% WEAKEN', animation: '🔮 Arcane seeps into the metal...\n✨ ARCANE INFUSION! Bound!\n💜 Your weapon is now magic itself!', cooldown: 5, energyCost: 45 },
    'Runic Mastery':       { description: '🔷 Runes maximize — 200% true damage', effect: '• 200% true damage\n• All runes activate simultaneously\n• +50% all stats for 3 turns', animation: '🔷 Every rune reaches its peak...\n⚡ RUNIC MASTERY! All activated!\n💥 Maximum power achieved!', cooldown: 5, energyCost: 52 },
    'Void Blade':          { description: '🌑 Blade becomes void — 220% per hit', effect: '• 220% void damage per strike\n• Hits twice\n• Ignores invulnerability', animation: '🌑 Your blade phases into void...\n⚫ VOID BLADE! Absolute cuts!\n💀 Nothing is truly invincible!', cooldown: 5, energyCost: 55 },
    'Arcane Singularity':  { description: '🌀 Create magic singularity 280% damage', effect: '• 280% damage at singularity point\n• AOE 150% to nearby\n• SILENCE + STUN all hit', animation: '🌀 Arcane energy collapses inward...\n⚫ ARCANE SINGULARITY! Collapse!\n💥 Everything is pulled in and destroyed!', cooldown: 6, energyCost: 62 },
    'Runic God':           { description: '🔷 Become runic god — all runes mastered', effect: '• 320% true damage\n• All runes at max power permanently\n• +70% all stats 4 turns', animation: '🔷 The ancient runes recognize you...\n✨ RUNIC GOD! Mastered!\n⚡ You ARE the magic!', cooldown: 7, energyCost: 68 },
    'Magic Swordmaster':   { description: '⚔️ Perfect sword and magic — 350% dmg', effect: '• 350% combined damage\n• 100% crit rate\n• All physical and magic defenses ignored', animation: '⚔️ Sword and spell become one...\n🌟 MAGIC SWORDMASTER! Perfect!\n💥 The ultimate technique!', cooldown: 8, energyCost: 72 },
    'Arcane Transcendence':{ description: '✨ Transcend magic limits — 400% true', effect: '• 400% true damage\n• Immune to all magic debuffs forever\n• All arcane costs halved', animation: '✨ You transcend the laws of magic...\n⚡ ARCANE TRANSCENDENCE!\n🌟 Magic itself bows to you!', cooldown: 9, energyCost: 78 },
    'Spellblade Omega':    { description: '💠 Ultimate spellblade — 500% + all effects', effect: '• 500% damage, guaranteed crit\n• BURN + SILENCE + WEAKEN + STUN\n• Enemy reduced to 1 HP if <50% HP', animation: '💠 All magic and steel culminate...\n💥 SPELLBLADE OMEGA! ULTIMATE!\n⚡ The pinnacle of magic swordsmanship!', cooldown: 10, energyCost: 90 },
  },

  // ═══ SUMMONER (18 skills) ════════════════════════════════════
  Summoner: {
    'Summon Wraith':       { description: '👻 110% damage + 35% FEAR', effect: '• 110% damage via wraith\n• 35% FEAR 2 turns\n• Wraith persists 1 turn', animation: '🌑 A tear forms in reality...\n👻 SUMMON WRAITH! The dead answer!\n😱 A shrieking wraith attacks!', cooldown: 3, energyCost: 20 },
    'Void Pact':           { description: '🔮 150% + WEAKEN 3t, +20% your ATK', effect: '• 150% damage\n• 50% WEAKEN 3 turns\n• +20% your ATK for 2 turns', animation: '🔮 You speak void words...\n🌑 VOID PACT! Deal struck!\n💀 A void entity answers!', cooldown: 4, energyCost: 25 },
    'Summon Drake':        { description: '🐲 130% fire damage + 50% BURN', effect: '• 130% fire damage\n• 50% BURN 3 turns\n• Drake attacks again next turn', animation: '🔥 A fire portal opens...\n🐲 SUMMON DRAKE! Hellfire!\n💥 The drake breathes death!', cooldown: 3, energyCost: 22 },
    'Soul Army':           { description: '👥 3 constructs at 60% each + STUN', effect: '• 3 constructs × 60% each\n• 20% STUN chance per construct\n• Army lasts 1 turn', animation: '💀 Souls gather at your feet...\n👥 SOUL ARMY! March!\n😵 Three simultaneous attacks!', cooldown: 4, energyCost: 30 },
    'Void Rift':           { description: '🌌 170% void + SILENCE + drain 20 energy', effect: '• 170% void damage\n• 40% SILENCE 2 turns\n• Drain 20 enemy energy', animation: '🌌 Space tears open...\n⚫ VOID RIFT! Reality crumbles!\n😵 Pulled toward the abyss!', cooldown: 4, energyCost: 35 },
    "Leviathan's Grasp":   { description: '🌊 140% + guaranteed STUN + -25% DEF', effect: '• 140% damage\n• STUN guaranteed 1 turn\n• -25% DEF for 3 turns', animation: '🌊 Ancient waters surge...\n🐙 LEVIATHANS GRASP!\n😱 Tentacles seize and crush!', cooldown: 5, energyCost: 38 },
    'Arcane Familiar':     { description: '✨ +25% dmg, familiar 40%/turn, blocks hit', effect: '• +25% all damage 3 turns\n• Familiar attacks 40%/turn\n• Absorbs one hit for you', animation: '✨ A glowing creature forms...\n🌟 ARCANE FAMILIAR! Partner!\n⚡ Two fight as one!', cooldown: 5, energyCost: 40 },
    'Legion Rise':         { description: '💀 5 hits at 70% each, 30% STUN/hit', effect: '• 5 hits × 70% each\n• 30% STUN per hit\n• Full AOE effect', animation: '💀 The earth splits open...\n👥 LEGION RISE! The dead march!\n😵 Overwhelmed by the dead!', cooldown: 6, energyCost: 48 },
    'Elder God Pact':      { description: '🌌 220% + FEAR+WEAKEN+SILENCE all 60%', effect: '• 220% damage\n• FEAR + WEAKEN + SILENCE\n• 60% chance each', animation: '🌌 Something ancient awakens...\n😱 ELDER GOD PACT!\n💀 An eldritch being descends!', cooldown: 7, energyCost: 55 },
    'Apocalypse Summon':   { description: '☄️ 300% + all debuffs + 20% HP true dmg', effect: '• 300% damage\n• Every negative status effect\n• +20% max HP true damage', animation: '☄️ The sky goes dark...\n💥 APOCALYPSE SUMMON!\n💀 The end has come!', cooldown: 9, energyCost: 70 },
    'Gate of Summons':     { description: '🚪 Open grand gate — 5 summons attack', effect: '• 5 random summons, 80% each\n• Each has unique status effect\n• Gate stays open 1 turn', animation: '🚪 A grand gate tears reality...\n⚡ GATE OF SUMMONS! Open!\n💥 Five beings pour through!', cooldown: 7, energyCost: 62 },
    'Void Army':           { description: '⚫ Army of void entities — 300% AOE', effect: '• 300% AOE damage\n• All enemies SILENCED 2 turns\n• Drain 20 energy from all', animation: '⚫ The void disgorges an army...\n💀 VOID ARMY! Endless!\n😱 They pour from nothingness!', cooldown: 8, energyCost: 68 },
    'Elder Dragon':        { description: '🐉 Summon elder dragon — 350% + BURN', effect: '• 350% fire damage\n• 70% BURN 4 turns to all\n• Dragon fights for 2 turns', animation: '🐉 An ancient dragon descends...\n🔥 ELDER DRAGON! Ancient fire!\n💥 Dragonfire burns everything!', cooldown: 8, energyCost: 72 },
    'Cosmos Rift':         { description: '🌌 Rift through cosmos — 320% + reality break', effect: '• 320% damage\n• Enemy loses all buffs\n• -50% all stats 3 turns', animation: '🌌 A rift through the cosmos opens...\n⭐ COSMOS RIFT! Stars fall!\n💥 Reality cannot contain this!', cooldown: 7, energyCost: 75 },
    'Reality Tear':        { description: '⚫ Tear reality — 380% true + dimension lock', effect: '• 380% true damage\n• Enemy cannot dodge for 3 turns\n• SILENCE + FEAR guaranteed', animation: '⚫ You tear reality itself...\n💀 REALITY TEAR! Unraveled!\n😱 They fall through existence!', cooldown: 8, energyCost: 78 },
    'God Summon':          { description: '✨ Summon divine being — 400% + heal', effect: '• 400% damage via divine summon\n• Heal 30% max HP\n• +60% all stats 3 turns', animation: '✨ A divine being descends...\n🌟 GOD SUMMON! Divine!\n⚡ Heaven itself answers!', cooldown: 9, energyCost: 82 },
    'Infinite Legion':     { description: '♾️ Infinite undead — 500% total', effect: '• 10 hits × 50% each\n• Undying — legion never exhausted\n• POISON + BLEED all from hits', animation: '♾️ The dead come without end...\n💀 INFINITE LEGION! Endless!\n😱 There is no stopping them!', cooldown: 10, energyCost: 88 },
    'Summoner Omega':      { description: '🌌 Summon the universe — 600% true', effect: '• 600% true damage from cosmic summon\n• All status effects applied\n• Enemy to 1 HP if <60% HP', animation: '🌌 The universe itself is summoned...\n💥 SUMMONER OMEGA! COSMIC!\n😱 Even gods are summoned!', cooldown: 12, energyCost: 99 },
  },


  // ═══ ELEMENTALIST (18 skills) ════════════════════════════════
  Elementalist: {
    'Fire Bolt':          { description: '🔥 110% fire damage + 40% BURN', effect: '• 110% fire damage\n• 40% BURN 2 turns\n• Melts ice effects', animation: '🔥 Fire condenses in your palm...\n💥 FIRE BOLT! Scorching!\n🌡️ Burns everything it touches!', cooldown: 2, energyCost: 10 },
    'Ice Shard':          { description: '❄️ 100% ice damage + 30% FREEZE', effect: '• 100% ice damage\n• 30% FREEZE 1 turn\n• Slows enemy even if not frozen', animation: '❄️ Ice crystallizes around your hand...\n💎 ICE SHARD! Frozen!\n🥶 The cold seeps into their bones!', cooldown: 2, energyCost: 10 },
    'Lightning Strike':   { description: '⚡ 130% lightning + 25% STUN', effect: '• 130% lightning damage\n• 25% STUN 1 turn\n• Ignores 20% DEF', animation: '⚡ Lightning gathers above...\n💥 LIGHTNING STRIKE! From the sky!\n😵 Electricity jolts through them!', cooldown: 3, energyCost: 14 },
    'Earth Slam':         { description: '🌍 140% earth + -20% enemy DEF', effect: '• 140% earth damage\n• -20% enemy DEF 3 turns\n• 30% SLOW', animation: '🌍 The earth answers your call...\n💥 EARTH SLAM! Shockwave!\n😵 The ground cracks and crumbles!', cooldown: 3, energyCost: 16 },
    'Water Wave':         { description: '🌊 AOE 100% water + heal 15%', effect: '• 100% AOE water damage\n• Heal yourself 15% HP\n• 20% SLOW all', animation: '🌊 A wave rises at your command...\n💧 WATER WAVE! Sweeping!\n💚 The water heals as it destroys!', cooldown: 3, energyCost: 18 },
    'Flame Burst':        { description: '🔥 160% fire AOE + BURN all', effect: '• 160% fire damage + 60% AOE\n• 50% BURN 3 turns to all\n• Melts ice and freeze effects', animation: '🔥 Fire erupts from your core...\n💥 FLAME BURST! Everything burns!\n🌡️ The air itself ignites!', cooldown: 4, energyCost: 25 },
    'Blizzard':           { description: '❄️ AOE 120% + FREEZE all 40%', effect: '• 120% AOE ice damage\n• 40% FREEZE all 2 turns\n• -30% all enemy SPEED', animation: '❄️ A blizzard forms overhead...\n🌨️ BLIZZARD! The world freezes!\n🥶 Everything is buried in ice!', cooldown: 4, energyCost: 28 },
    'Thunder God':        { description: '⚡ 200% lightning + STUN + pierce', effect: '• 200% lightning damage\n• STUN guaranteed 1 turn\n• Ignores all DEF', animation: '⚡ You channel the thunder god...\n💥 THUNDER GOD! Divine lightning!\n😵 Struck by the gods themselves!', cooldown: 5, energyCost: 35 },
    'Magma Prison':       { description: '🌋 Trap enemy in magma 8%HP/turn', effect: '• 150% fire damage\n• BURN: 8% max HP/turn 4 turns\n• Enemy cannot dodge', animation: '🌋 Magma erupts around them...\n🔥 MAGMA PRISON! Trapped!\n😱 Surrounded by liquid fire!', cooldown: 5, energyCost: 38 },
    'Tsunami':            { description: '🌊 280% water AOE + clear all buffs', effect: '• 280% water damage + full AOE\n• Clear all enemy buffs\n• SLOW all 3 turns', animation: '🌊 A massive wave builds offshore...\n💧 TSUNAMI! Overwhelming!\n😵 Everything is swept away!', cooldown: 6, energyCost: 45 },
    'Storm of Ages':      { description: '⛈️ 250% storm + BURN+FREEZE+STUN', effect: '• 250% storm damage\n• BURN + FREEZE + STUN all\n• 50% chance each', animation: '⛈️ All elements combine in a storm...\n⚡ STORM OF AGES! Ancient power!\n💥 Fire, ice, and lightning together!', cooldown: 6, energyCost: 50 },
    'Primordial Fire':    { description: '🔥 300% primordial flame true damage', effect: '• 300% true fire damage\n• Cannot be resisted or reduced\n• BURN 6 turns guaranteed', animation: '🔥 Fire from before time ignites...\n💥 PRIMORDIAL FIRE! Ancient!\n🌋 The oldest flame burns bright!', cooldown: 7, energyCost: 55 },
    'Eternal Ice':        { description: '❄️ 280% ice, FREEZE 3t, -50% all stats', effect: '• 280% ice damage\n• FREEZE guaranteed 3 turns\n• -50% all enemy stats while frozen', animation: '❄️ Ice from the eternal void...\n💎 ETERNAL ICE! Absolute zero!\n🥶 They will never feel warm again!', cooldown: 7, energyCost: 55 },
    'World Thunder':      { description: '⚡ 320% lightning AOE to all enemies', effect: '• 320% lightning to all enemies\n• 60% STUN all 2 turns\n• Ignores all DEF', animation: '⚡ Thunder shakes the world...\n💥 WORLD THUNDER! Global strike!\n😵 All enemies struck simultaneously!', cooldown: 7, energyCost: 60 },
    'Element Master':     { description: '🌟 Cycle all elements — 4 hits 100% each', effect: '• 4 hits × 100% (fire, ice, lightning, earth)\n• Each applies its element status\n• +50% all stats for 3 turns after', animation: '🌟 All four elements answer...\n⚡ ELEMENT MASTER! Cycle!\n💥 Fire, ice, thunder, earth!', cooldown: 7, energyCost: 65 },
    'Elemental Fusion':   { description: '🌀 Fuse all elements — 400% true damage', effect: '• 400% true damage\n• All element effects applied\n• Immune to all elements for 3 turns', animation: '🌀 All elements merge into one...\n💥 ELEMENTAL FUSION! Unified!\n🌟 The ultimate elemental force!', cooldown: 8, energyCost: 72 },
    'Omega Element':      { description: '⭐ Fifth element — 450% reality damage', effect: '• 450% reality damage (true, AOE)\n• All negative effects applied\n• -70% all enemy stats 3 turns', animation: '⭐ A fifth element manifests...\n💥 OMEGA ELEMENT! Beyond nature!\n🌌 Reality itself becomes your weapon!', cooldown: 9, energyCost: 80 },
    'Elemental God':      { description: '🌍 Become elemental god — 600% all-AOE', effect: '• 600% damage, full AOE\n• Every element at once, all status effects\n• Enemy to 1 HP if <50%', animation: '🌍 You become the god of elements...\n⚡ ELEMENTAL GOD! Transcendent!\n💥 Nature itself bows to you!', cooldown: 11, energyCost: 95 },
  },

  // ═══ KNIGHT (18 skills) ══════════════════════════════════════
  Knight: {
    'Shield Bash':        { description: '🛡️ 100% damage + 30% STUN', effect: '• 100% damage\n• 30% STUN 1 turn\n• +10% DEF this turn', animation: '🛡️ You slam your shield forward...\n💥 SHIELD BASH! Staggering!\n😵 They reel from the impact!', cooldown: 3, energyCost: 12 },
    'Charge':             { description: '⚔️ 120% damage + 20% STUN', effect: '• 120% damage\n• 20% STUN 1 turn\n• Gain momentum: +10% ATK', animation: '⚔️ You charge forward at full speed...\n💥 CHARGE! Unstoppable!\n😵 Nothing can stop your momentum!', cooldown: 3, energyCost: 15 },
    'Taunt':              { description: '😤 Force enemy to target you, +30% DEF', effect: '• Force enemy attacks toward you\n• +30% DEF for 2 turns\n• Counter on next enemy attack', animation: '😤 You shout your challenge...\n🛡️ TAUNT! Face me!\n😡 They cannot ignore you!', cooldown: 3, energyCost: 10 },
    'Guardian Strike':    { description: '⚔️ 140% damage, protect ally, +20% DEF', effect: '• 140% damage\n• +20% DEF 3 turns\n• Protects lowest HP ally', animation: '⚔️ You strike to protect...\n🛡️ GUARDIAN STRIKE! Protected!\n💪 Your duty drives your blade!', cooldown: 3, energyCost: 18 },
    'Holy Slash':         { description: '✨ 150% holy damage, WEAKEN 25%', effect: '• 150% holy damage\n• 25% WEAKEN 2 turns\n• Bypasses dark resistance', animation: '✨ Holy light fills your blade...\n⚔️ HOLY SLASH! Divine!\n😵 Light cuts through darkness!', cooldown: 3, energyCost: 20 },
    'Iron Defense':       { description: '🪨 +60% DEF 3 turns, immune BLEED', effect: '• +60% DEF for 3 turns\n• Immune to BLEED\n• Reduce all damage by flat 20', animation: '🪨 You become a fortress...\n🛡️ IRON DEFENSE! Unbreakable!\n💪 Nothing penetrates this guard!', cooldown: 5, energyCost: 22 },
    'Champion Charge':    { description: '🏆 180% + guaranteed STUN + pierce', effect: '• 180% damage\n• STUN guaranteed 1 turn\n• Ignores 30% DEF', animation: '🏆 A champion charges forth...\n💥 CHAMPION CHARGE! Glory!\n😵 The force is undeniable!', cooldown: 4, energyCost: 25 },
    'Divine Shield':      { description: '✨ Block all damage 2 turns + reflect', effect: '• Block ALL damage 2 turns\n• Reflect 30% back\n• Counter attack after', animation: '✨ Divine light forms a shield...\n🛡️ DIVINE SHIELD! Absolute!\n✨ Nothing gets through!', cooldown: 6, energyCost: 30 },
    'Sword of Justice':   { description: '⚖️ 200% holy + execute evil enemies', effect: '• 200% holy true damage\n• WEAKEN + SILENCE\n• +50% damage vs cursed enemies', animation: '⚖️ Justice demands payment...\n⚔️ SWORD OF JUSTICE! Righteous!\n✨ The guilty cannot escape!', cooldown: 5, energyCost: 35 },
    'Indomitable':        { description: '💪 Survive lethal, then +80% ATK', effect: '• Survive one lethal blow (1 HP)\n• Then +80% ATK for 3 turns\n• +40% DEF for 3 turns', animation: '💪 You refuse to fall...\n🔥 INDOMITABLE! Will not die!\n⚡ Rising stronger from the ashes!', cooldown: 7, energyCost: 40 },
    'Holy Blade':         { description: '✨ 240% holy AOE + purge debuffs', effect: '• 240% holy AOE damage\n• Remove all your debuffs\n• WEAKEN all enemies 3 turns', animation: '✨ Holy power floods your blade...\n⚔️ HOLY BLADE! Purified!\n💥 Dark and light collide!', cooldown: 5, energyCost: 42 },
    'Aegis Strike':       { description: '🛡️ 260% + DEF converted to attack', effect: '• 260% damage\n• Your DEF adds to damage this hit\n• +30% DEF after', animation: '🛡️ Your defense becomes offense...\n💥 AEGIS STRIKE! Shield becomes sword!\n😵 Impossible to counter!', cooldown: 5, energyCost: 48 },
    'Knight Oath':        { description: '🏅 Oath of power: +50% all stats 4t', effect: '• +50% all stats for 4 turns\n• Cannot be debuffed while oath active\n• All skills +30% power', animation: '🏅 You swear a knight oath...\n✨ KNIGHT OATH! Sworn!\n⚡ Power flows from conviction!', cooldown: 7, energyCost: 52 },
    'Champion Burst':     { description: '🏆 300% + all allies buffed', effect: '• 300% damage to enemy\n• +40% ATK/DEF to all allies\n• Reduces all cooldowns by 2', animation: '🏆 Champion energy surges out...\n💥 CHAMPION BURST! Victory!\n⚡ Everyone is empowered!', cooldown: 6, energyCost: 58 },
    'Holy Judgement':     { description: '⚖️ 320% holy true + chain WEAKEN', effect: '• 320% holy true damage\n• WEAKEN chains to nearby enemies\n• SILENCE + BLIND guaranteed', animation: '⚖️ Heaven passes judgment...\n✨ HOLY JUDGEMENT! Divine verdict!\n😱 None are found worthy!', cooldown: 7, energyCost: 64 },
    'Undying Knight':     { description: '💀 Die and revive — comeback 100% HP', effect: '• Instantly revive if currently dead\n• Return at 100% HP\n• +100% ATK for 3 turns after', animation: '💀 Death refuses to claim you...\n🔥 UNDYING KNIGHT! Returned!\n⚡ A knight never truly falls!', cooldown: 10, energyCost: 70 },
    'Knight of God':      { description: '✨ Become divine knight — 400% holy', effect: '• 400% holy true damage\n• Divine protection: immune 3 turns\n• All holy skills doubled', animation: '✨ The divine recognizes you...\n🌟 KNIGHT OF GOD! Chosen!\n⚔️ A weapon of heaven!', cooldown: 9, energyCost: 78 },
    'Excalibur Omega':    { description: '⚔️ Draw Excalibur — 550% true + all', effect: '• 550% true holy damage\n• Ignores all defenses, immunities\n• STUN + WEAKEN + SILENCE all', animation: '⚔️ Excalibur is finally drawn...\n💥 EXCALIBUR OMEGA! THE SWORD!\n✨ The legendary blade strikes!', cooldown: 11, energyCost: 90 },
  },

  // ═══ RANGER (18 skills) ══════════════════════════════════════
  Ranger: {
    'Aimed Shot':         { description: '🎯 150% crit-focused shot + BLEED', effect: '• 150% damage, +20% crit chance\n• 40% BLEED 2 turns\n• Cannot be dodged', animation: '🎯 You take careful aim...\n💥 AIMED SHOT! Precision!\n🩸 The arrow finds its mark!', cooldown: 3, energyCost: 18 },
    'Rapid Fire':         { description: '🏹 3 arrows at 60% each + SLOW', effect: '• 3 hits × 60% each\n• 30% SLOW per hit\n• First hit always crits', animation: '🏹 Three arrows nocked at once...\n💨 RAPID FIRE! Three at once!\n🎯 Each finds its target!', cooldown: 2, energyCost: 12 },
    'Trap':               { description: '🪤 Set trap — next enemy move triggers', effect: '• Set a damage trap\n• Triggers on enemy action: 200%\n• Cannot be detected', animation: '🪤 You quickly set a trap...\n⚠️ TRAP! Concealed!\n💥 Waiting to be triggered!', cooldown: 4, energyCost: 20 },
    'Eagle Eye Strike':   { description: '👁️ 180% guaranteed crit + armor pen', effect: '• 180% damage, guaranteed crit\n• Ignores 40% DEF\n• BLEED 3 turns', animation: '👁️ Your eagle eyes lock on...\n🎯 EAGLE EYE STRIKE! Perfect aim!\n💥 Bullseye every time!', cooldown: 3, energyCost: 22 },
    'Explosive Arrow':    { description: '💥 200% AOE explosion arrow', effect: '• 200% damage + 80% AOE\n• 30% STUN main target\n• BURN 2 turns all', animation: '💥 You fire an explosive-tipped arrow...\n🔥 EXPLOSIVE ARROW! Boom!\n😵 The explosion catches all nearby!', cooldown: 4, energyCost: 28 },
    'Volley':             { description: '🏹 5 arrows at 50% each to all enemies', effect: '• 5 arrows × 50% AOE\n• 25% BLEED per arrow\n• Overwhelming barrage', animation: '🏹 You fire an overwhelming volley...\n💨 VOLLEY! Rain of arrows!\n🎯 The sky darkens with arrows!', cooldown: 4, energyCost: 30 },
    'Hunter Mark':        { description: '🎯 Mark target — all attacks +30% vs them', effect: '• Mark enemy for 5 turns\n• All attacks +30% vs marked\n• Marked enemy cannot stealth', animation: '🎯 You mark your prey...\n👁️ HUNTER MARK! Hunted!\n🩸 They cannot escape the hunt!', cooldown: 4, energyCost: 25 },
    'Shadow Arrow':       { description: '🌑 220% true damage + BLIND 2t', effect: '• 220% true damage\n• BLIND 2 turns guaranteed\n• Phased — cannot be blocked', animation: '🌑 A shadow-wreathed arrow forms...\n⚡ SHADOW ARROW! From darkness!\n😵 They never saw it coming!', cooldown: 4, energyCost: 35 },
    'Storm Arrow':        { description: '⛈️ 240% lightning + STUN + chain', effect: '• 240% lightning damage\n• STUN 1 turn\n• Chains to nearby for 80%', animation: '⛈️ Lightning empowers the arrow...\n⚡ STORM ARROW! Thunder!\n😵 Electricity chains between enemies!', cooldown: 5, energyCost: 40 },
    'Death Arrow':        { description: '💀 260% true + execute <25% HP', effect: '• 260% true damage\n• Execute: instant kill <25% HP\n• BLEED 5 turns, uncleansable', animation: '💀 The arrow of death is drawn...\n🎯 DEATH ARROW! Fatal!\n💀 One shot, one kill.', cooldown: 5, energyCost: 45 },
    'Predator Shot':      { description: '🐆 280% damage, double vs low HP', effect: '• 280% damage\n• Double damage if enemy <50% HP\n• BLEED + SLOW guaranteed', animation: '🐆 You become the apex predator...\n💥 PREDATOR SHOT! Hunt complete!\n🩸 The prey has no escape!', cooldown: 5, energyCost: 48 },
    'Void Arrow':         { description: '⚫ 300% void true damage + all pierce', effect: '• 300% void damage\n• Ignores DEF, shields, invulnerability\n• SILENCE + BLIND', animation: '⚫ The arrow phases into void...\n🌑 VOID ARROW! Reality pierced!\n💥 Nothing stops this shot!', cooldown: 6, energyCost: 55 },
    'Ranger Omega':       { description: '🏹 320% damage, 10 rapid fire shots', effect: '• 10 shots × 32% (total 320%)\n• Each has 30% crit chance\n• BLEED on all hits', animation: '🏹 Arrows fly too fast to count...\n💨 RANGER OMEGA! Rapid!\n🎯 Ten arrows in one breath!', cooldown: 6, energyCost: 58 },
    'Godslayer Shot':     { description: '🎯 350% — designed to kill gods', effect: '• 350% true damage\n• +100% damage vs boss/elite enemies\n• Ignores divine protection', animation: '🎯 This arrow was made to kill gods...\n💥 GODSLAYER SHOT! Divine!\n😱 Even gods fall to this!', cooldown: 7, energyCost: 65 },
    'True Aim':           { description: '👁️ Perfect aim — 400% guaranteed crit', effect: '• 400% damage, guaranteed crit\n• 100% crit damage\n• Cannot miss under any condition', animation: '👁️ Everything slows as you aim...\n⚡ TRUE AIM! Perfect!\n💥 The arrow was always going to hit!', cooldown: 7, energyCost: 70 },
    'Starfall Arrow':     { description: '⭐ Call stars to rain down — 500% AOE', effect: '• 500% total starfall damage\n• Full AOE — all enemies hit\n• BURN + STUN all', animation: '⭐ Stars align with your arrow...\n💥 STARFALL ARROW! From the heavens!\n🌟 The sky itself attacks!', cooldown: 8, energyCost: 78 },
    'Absolute Shot':      { description: '🎯 550% — the perfect shot', effect: '• 550% true damage\n• Guaranteed hit, guaranteed crit\n• Execute: instant kill <40%', animation: '🎯 The perfect shot exists...\n💥 ABSOLUTE SHOT! Inevitable!\n😱 It was always going to land!', cooldown: 9, energyCost: 85 },
    'Ranger God':         { description: '🏹 600% — become god of the hunt', effect: '• 600% damage, full AOE\n• Every arrow a guided missile\n• All enemies BLEED+SLOW+BLIND', animation: '🏹 The hunt god speaks through you...\n⚡ RANGER GOD! Apex predator!\n💥 No prey escapes the god!', cooldown: 11, energyCost: 95 },
  },

  // ═══ CHRONOMANCER (18 skills) ════════════════════════════════
  Chronomancer: {
    'Time Slow':          { description: '⌛ Slow enemy — 80% SLOW 3 turns', effect: '• 20% damage\n• 80% SLOW 3 turns guaranteed\n• Enemy acts last for 3 turns', animation: '⌛ Time bends to your will...\n🐢 TIME SLOW! Slowed!\n😵 They move through molasses!', cooldown: 4, energyCost: 18 },
    'Rewind':             { description: '⏪ Rewind time — heal 25% HP', effect: '• Heal 25% max HP\n• Remove 1 debuff\n• +10% ATK briefly', animation: '⏪ You rewind your own timeline...\n💚 REWIND! Recovered!\n✨ Injuries unmade!', cooldown: 6, energyCost: 25 },
    'Temporal Strike':    { description: '⌚ 130% damage, hits twice in time', effect: '• 130% damage × 2 (time echo)\n• Second hit from "the future"\n• 20% SLOW per hit', animation: '⌚ You strike across two timelines...\n💥 TEMPORAL STRIKE! Echo!\n⚡ Past and future hit together!', cooldown: 3, energyCost: 20 },
    'Time Lock':          { description: '🔒 Lock enemy in time — STUN 2 turns', effect: '• 100% damage\n• STUN guaranteed 2 turns\n• Enemy cannot use skills 3 turns', animation: '🔒 Time freezes around them...\n⌛ TIME LOCK! Frozen in time!\n😵 They are trapped in a single moment!', cooldown: 5, energyCost: 28 },
    'Clock Stop':         { description: '🕐 Stop time for everyone else 1 turn', effect: '• Extra turn: attack twice\n• Both attacks at full power\n• Enemy cannot react', animation: '🕐 All clocks stop...\n💥 CLOCK STOP! Extra turn!\n⚡ Time grants you two actions!', cooldown: 7, energyCost: 35 },
    'Age Accelerate':     { description: '👴 Age enemy rapidly — -40% all stats', effect: '• 140% damage\n• -40% all enemy stats 3 turns\n• 30% chance to age weapons (-20% ATK)', animation: '👴 You accelerate their aging...\n⌛ AGE ACCELERATE! Old!\n😵 Decades pass in seconds!', cooldown: 4, energyCost: 30 },
    'Time Rift':          { description: '🌀 Rift lets you dodge + counter', effect: '• 150% damage via time rift\n• Dodge next 2 attacks\n• Counter-attack for 80% each dodge', animation: '🌀 A time rift opens before you...\n⚡ TIME RIFT! Between moments!\n💥 Past self counters for you!', cooldown: 5, energyCost: 35 },
    'Paradox':            { description: '💭 Create paradox — enemy damages self', effect: '• 120% damage\n• Enemy takes 20% of their OWN attacks 3t\n• Cannot be dispelled', animation: '💭 You create a causal paradox...\n😵 PARADOX! Self-inflicted!\n🌀 Their timeline loops against them!', cooldown: 5, energyCost: 38 },
    'Time Shatter':       { description: '⌚ Shatter enemy timeline — 250% true', effect: '• 250% true damage\n• Shatters enemy cooldowns (all reset to max)\n• SILENCE 2 turns', animation: '⌚ You shatter their temporal thread...\n💥 TIME SHATTER! Broken!\n😱 Their timeline collapses!', cooldown: 6, energyCost: 48 },
    'Omega Clock':        { description: '⏰ Final hour — all cooldowns reset', effect: '• 200% damage\n• ALL your cooldowns instantly reset\n• +40% all stats 3 turns', animation: '⏰ The omega clock strikes...\n🌟 OMEGA CLOCK! Reset!\n⚡ All skills refreshed instantly!', cooldown: 8, energyCost: 55 },
    'Eternal Loop':       { description: '🔄 Loop combat — repeat last action', effect: '• Repeat your last action for free\n• Both at 100% power\n• +30% effectiveness on repeat', animation: '🔄 Time loops back to just now...\n⚡ ETERNAL LOOP! Again!\n💥 The same devastating move twice!', cooldown: 6, energyCost: 52 },
    'Time God':           { description: '🌟 Become time god — all speed +100%', effect: '• +100% SPEED permanently in battle\n• Act before everything\n• +40% all damage', animation: '🌟 Time itself bows to you...\n⌛ TIME GOD! Master of moments!\n⚡ You are time itself!', cooldown: 8, energyCost: 60 },
    'Reality Reset':      { description: '🔄 Reset enemy HP to battle start', effect: '• If enemy is below 50% HP: reset to 30%\n• Force WEAKEN + SLOW\n• All their buffs erased', animation: '🔄 You reset this moment in time...\n😈 REALITY RESET! Erased progress!\n😱 Their recovery is undone!', cooldown: 8, energyCost: 65 },
    'Chrono Burst':       { description: '⌛ 320% time explosion', effect: '• 320% damage\n• STUN + SLOW + SILENCE all\n• Resets 3 of your cooldowns', animation: '⌛ Chrono energy detonates...\n💥 CHRONO BURST! Time explosion!\n😵 The shockwave ripples through time!', cooldown: 7, energyCost: 68 },
    'Epoch End':          { description: '🌌 End the epoch — 380% true damage', effect: '• 380% true damage\n• Remove enemy invulnerability\n• -60% all stats 4 turns', animation: '🌌 An epoch comes to its end...\n💀 EPOCH END! Era over!\n😱 This age ends by your hand!', cooldown: 8, energyCost: 75 },
    'Timeline Erase':     { description: '⚫ Erase enemy from timeline permanently', effect: '• 400% true damage\n• -20% enemy max HP permanently\n• Remove all their future buffs', animation: '⚫ You erase them from the timeline...\n💀 TIMELINE ERASE! Gone!\n😱 As if they never existed!', cooldown: 9, energyCost: 80 },
    'Time Omega':         { description: '⌛ Omega time control — 500% true', effect: '• 500% true damage\n• Complete time stop 3 turns (enemy)\n• You act freely during', animation: '⌛ Time bends completely to Omega...\n💥 TIME OMEGA! Absolute control!\n😵 Frozen. Helpless. Defeated.', cooldown: 10, energyCost: 88 },
    'Chronomancer God':   { description: '🌌 God of time — 650% + rewrite time', effect: '• 650% true damage\n• Rewrite the battle: reset enemy to 50% HP\n• All status effects, permanent slows', animation: '🌌 The god of time has awoken...\n⚡ CHRONOMANCER GOD! ETERNAL!\n💥 You hold all of time in your hands!', cooldown: 12, energyCost: 99 },
  },

  // ═══ PHANTOM (18 skills) ═════════════════════════════════════
  Phantom: {
    'Phase Strike':        { description: '🌑 140% true damage + 55% BLIND', effect: '• 140% true damage\n• 55% BLIND 2 turns\n• +20% crit chance this turn', animation: '🌑 You phase out of existence...\n⚡ PHASE STRIKE! Inside their guard!\n😵 The blow comes from nowhere!', cooldown: 2, energyCost: 22 },
    'Shadow Collapse':     { description: '🌑 160% + 45% FEAR + -25% SPEED 3t', effect: '• 160% damage\n• 45% FEAR 2 turns\n• -25% SPEED 3 turns', animation: '🌑 Shadows converge on the target...\n💥 SHADOW COLLAPSE! Crushed!\n😱 Consumed by the dark!', cooldown: 3, energyCost: 28 },
    'Ghost Step':          { description: '👻 +100% dodge, next attack ignores 50% DEF', effect: '• +100% dodge for 1 turn\n• Next attack ignores 50% DEF\n• Movement silent — no detection', animation: '👻 You become translucent...\n💨 GHOST STEP! Between worlds!\n✨ Neither here nor there!', cooldown: 4, energyCost: 25 },
    'Nightmare':           { description: '😱 120% mental + guaranteed FEAR 3 turns', effect: '• 120% mental damage\n• FEAR guaranteed 3 turns\n• -40% ATK while feared', animation: '😱 Dark visions fill their mind...\n💀 NIGHTMARE! Real!\n😱 They see their worst fear!', cooldown: 4, energyCost: 32 },
    'Soul Pierce':         { description: '💀 200% true + ignore shields + 30% instakill', effect: '• 200% true damage\n• Ignores all shields & barriers\n• 30% instant kill if enemy <20% HP', animation: '💀 Your hand glows with death energy...\n👊 SOUL PIERCE! Through the soul!\n😱 Grasped something intangible!', cooldown: 4, energyCost: 38 },
    'Void Walk':           { description: '🌌 +150% dodge 2t, damage = dodged attacks', effect: '• +150% dodge for 2 turns\n• Deal damage equal to dodged hits\n• Cannot be targeted', animation: '🌌 You step into the void between...\n🌑 VOID WALK! Untargetable!\n⚡ Attacks phase through harmlessly!', cooldown: 5, energyCost: 40 },
    'Phantom Barrage':     { description: '👻 7 hits at 55% each + BLIND/hit', effect: '• 7 hits × 55% damage\n• 20% BLIND chance per hit\n• Final hit 100% bonus', animation: '👻 Phantom copies appear everywhere...\n💥 PHANTOM BARRAGE! Which is real?!\n😵 Seven strikes from every angle!', cooldown: 5, energyCost: 45 },
    "Oblivion's Touch":    { description: '🌑 250% true + -30% max HP + SILENCE+FEAR', effect: '• 250% true damage\n• -30% enemy max HP permanently\n• SILENCE + FEAR 3 turns', animation: '🌑 Your touch carries the void...\n😱 OBLIVIONS TOUCH! Erased!\n💀 Part of them ceases to exist!', cooldown: 6, energyCost: 52 },
    'Death Realm':         { description: '💀 200% + +20% dmg taken 3t + drain 40 energy', effect: '• 200% damage\n• +20% damage taken 3 turns\n• Drain 40 enemy energy', animation: '💀 A portal to death opens...\n🌑 DEATH REALM! Glimpse oblivion!\n😱 They return weakened forever!', cooldown: 6, energyCost: 55 },
    'Phantom Apocalypse':  { description: '🌌 350% true + all effects + 1HP if >80%', effect: '• 350% true damage\n• Every status effect applied\n• Enemy to 1 HP if >80% dealt', animation: '🌌 Reality tears apart completely...\n💥 PHANTOM APOCALYPSE! VOID!\n😱 Even existence fears you!', cooldown: 9, energyCost: 75 },
    'Reality Breach':      { description: '⚫ Breach reality — 280% + dimension lock', effect: '• 280% true damage\n• Enemy frozen in place (cannot dodge) 3t\n• BLIND + FEAR guaranteed', animation: '⚫ You punch a hole in reality...\n💀 REALITY BREACH! Torn!\n😱 They are trapped between worlds!', cooldown: 6, energyCost: 60 },
    'Soul Consume':        { description: '👊 Consume soul — 320% + drain all buffs', effect: '• 320% true damage\n• Steal ALL enemy buffs\n• Permanently remove 15% max HP', animation: '👊 You reach and grasp their soul...\n😱 SOUL CONSUME! Devoured!\n💀 Their power belongs to you!', cooldown: 7, energyCost: 65 },
    'Void Ascension':      { description: '🌌 Ascend to void — immune 3t + 350%', effect: '• 350% true damage\n• Immune to everything 3 turns\n• +80% all stats', animation: '🌌 You ascend into the void...\n⚫ VOID ASCENSION! Transcended!\n⚡ The void is your home now!', cooldown: 8, energyCost: 70 },
    'Phantom God':         { description: '👻 Become phantom god — 400% true', effect: '• 400% true damage\n• Cannot be countered or reflected\n• All phantom skills cost -30% energy', animation: '👻 Phantom energy crowns you...\n🌟 PHANTOM GOD! Divine!\n💀 The realm of death obeys!', cooldown: 8, energyCost: 72 },
    'Oblivion':            { description: '⚫ Pure oblivion — erase existence 450%', effect: '• 450% true damage\n• Bypass all defenses and immunities\n• STUN + SILENCE + FEAR + BLIND all', animation: '⚫ Pure oblivion flows through you...\n💀 OBLIVION! Erased!\n😱 They simply cease to exist!', cooldown: 9, energyCost: 78 },
    'Death Incarnate':     { description: '💀 Become death itself — 500% + execute', effect: '• 500% true damage\n• Execute: instant kill <30% HP\n• FEAR guaranteed, cannot resist', animation: '💀 You become death personified...\n😈 DEATH INCARNATE! Inevitable!\n💥 None escape death!', cooldown: 9, energyCost: 82 },
    'Void Emperor':        { description: '🌌 Rule the void — 550% + domination', effect: '• 550% true damage\n• Dominate: enemy cannot act 2 turns\n• All void skills bypass immunity', animation: '🌌 The void bows to its emperor...\n⚫ VOID EMPEROR! Ruled!\n😱 The void is your kingdom!', cooldown: 10, energyCost: 88 },
    'Phantom Omega':       { description: '💠 Ultimate phantom — 700% all-pierce', effect: '• 700% true damage\n• Pierces everything — immunity, DEF, shields\n• All status effects, guaranteed', animation: '💠 Every phantom ability culminates...\n💥 PHANTOM OMEGA! ABSOLUTE!\n😱 The void itself trembles!', cooldown: 12, energyCost: 99 },
  },

  Warlord: {
    'War Cry':           { description: '👑 Bellow a war cry that empowers your team', effect: '• +30% ATK for 3 turns\n• +15% DEF for 2 turns\n• Terrifies enemies -10% ATK', animation: '👑 Banner raised high...\n💢 WAR CRY! Battlefield trembles!\n⚔️ Fight harder!', cooldown: 4, energyCost: 10 },
    'Cleave':            { description: '⚔️ Sweep weapon in a wide arc', effect: '• 110% damage\n• AOE 50% splash\n• Ignores 20% DEF', animation: '⚔️ Massive swing...\n💥 CLEAVE! All are cut!\n🩸 Arc of destruction!', cooldown: 3, energyCost: 14 },
    'Shield Wall':       { description: '🛡️ Impenetrable shield wall', effect: '• +50% DEF for 3 turns\n• -20% incoming damage\n• Immune to knockback', animation: '🛡️ Shield wall rises...\n⚔️ SHIELD WALL! Unbreakable!\n💪 None pass!', cooldown: 5, energyCost: 18 },
    'Rallying Cry':      { description: '📣 Rally forces with a powerful cry', effect: '• Heal 20% HP\n• +25% ATK & DEF 2 turns\n• Clear one debuff', animation: '📣 Voice echoes...\n✨ RALLYING CRY! Morale soars!\n💪 Tide turns!', cooldown: 5, energyCost: 22 },
    'Conqueror Strike':  { description: '⚔️ Strike of a true conqueror', effect: '• 170% damage\n• -25% enemy DEF 3 turns\n• +10 Command', animation: '⚔️ Force of empires behind you...\n💥 CONQUEROR STRIKE!\n👑 Another field claimed!', cooldown: 3, energyCost: 26 },
    'Iron March':        { description: '🪖 March forward with iron will', effect: '• +40% ATK for 4 turns\n• Immune to slow/freeze\n• +20% speed', animation: '🪖 Boots thunder...\n⚔️ IRON MARCH! Unstoppable!\n💪 No terrain slows you!', cooldown: 5, energyCost: 28 },
    'Siege Breaker':     { description: '🏰 Attack with siege-level force', effect: '• 190% damage\n• Ignores shields/barriers\n• -30% DEF permanent', animation: '🏰 Siege force focuses...\n💥 SIEGE BREAKER! Walls crumble!\n😵 Nothing withstands this!', cooldown: 4, energyCost: 32 },
    'Warlord Smash':     { description: '👊 Signature move of a true warlord', effect: '• 210% damage\n• 50% STUN (2 turns)\n• AOE 70% all', animation: '👊 Gathering every ounce...\n💥 WARLORD SMASH! Earth-shattering!\n😵 Shockwave knocks all back!', cooldown: 4, energyCost: 36 },
    'Army of One':       { description: '⚔️ Fight as an entire army alone', effect: '• 5 strikes at 70% each\n• Each hit -5% DEF\n• Last hit 150%', animation: '⚔️ Moving through the field...\n💥 ARMY OF ONE! Five strikes!\n👑 You alone are enough!', cooldown: 5, energyCost: 40 },
    'Conquest':          { description: '🌍 The ultimate act of conquest', effect: '• 280% damage\n• WEAKEN + STUN applied\n• Drain 30% energy', animation: '🌍 Every war leads here...\n👑 CONQUEST! Absolute victory!\n💥 This is domination!', cooldown: 7, energyCost: 50 },
    'Dominion':          { description: '⚔️ Assert total dominion', effect: '• +60% ATK & DEF 3 turns\n• Enemies deal 20% less\n• Heal 15% HP', animation: '👑 Your presence fills the field...\n⚔️ DOMINION! Complete control!\n💪 All bow!', cooldown: 6, energyCost: 45 },
    'Tyrant Blow':       { description: '💀 Only tyrants can deliver this', effect: '• 240% true damage\n• 60% FEAR (3 turns)\n• Cannot be dodged', animation: '💀 Weight of a tyrant...\n👊 TYRANT BLOW! Brutality!\n😱 Fear runs through them!', cooldown: 5, energyCost: 48 },
    'World Breaker':     { description: '🌍 Break the world', effect: '• 270% AOE damage\n• STUN all (1 turn)\n• -40% all enemy stats 2 turns', animation: '🌍 Ground cracks...\n💥 WORLD BREAKER! Reality splits!\n😵 Field devastated!', cooldown: 6, energyCost: 55 },
    'Total War':         { description: '⚔️ Declare total war', effect: '• 300% damage\n• Triple hit\n• Immune 1 turn after', animation: '⚔️ No mercy. No retreat.\n💢 TOTAL WAR! Destruction!\n💥 Everything falls!', cooldown: 7, energyCost: 58 },
    'Eternal Conquest':  { description: '🏆 Conquer for eternity', effect: '• 320% damage\n• Permanent +10% ATK stack\n• Enemy max HP -15%', animation: '🏆 History remembers you...\n👑 ETERNAL CONQUEST!\n⚔️ They fall. You stand.', cooldown: 7, energyCost: 62 },
    'Supreme Warlord':   { description: '👑 Become the Supreme Warlord', effect: '• +80% all stats 4 turns\n• All skills free this turn\n• Heal 30% HP', animation: '👑 Supreme command...\n⚔️ SUPREME WARLORD!\n💥 The field is yours!', cooldown: 8, energyCost: 65 },
    'God of War':        { description: '⚔️ Embody the God of War', effect: '• 350% true damage\n• All status effects on enemy\n• +100% ATK 2 turns', animation: '⚔️ War bows to you...\n👑 GOD OF WAR! War incarnate!\n💥 Nothing survives!', cooldown: 9, energyCost: 70 },
    'Warlord Omega':     { description: '🔱 Ultimate warlord technique', effect: '• 400% damage\n• AOE to all\n• Enemies to 10% HP if above 50%', animation: '🔱 Every battle, every victory...\n💥 WARLORD OMEGA! The end!\n👑 Born for this moment!', cooldown: 10, energyCost: 80 },
  },
  ShadowDancer: {
    'Dance of Death':    { description: '💃 Deadly dance that cuts like knives', effect: '• 140% damage\n• 50% BLEED (3 turns)\n• +15% speed after each hit', animation: '💃 Movement becomes weapon...\n🌑 DANCE OF DEATH! Graceful!\n🩸 Each step leaves a wound!', cooldown: 3, energyCost: 18 },
    'Moonwalk':          { description: '🌙 Step through moonlight untouchable', effect: '• +100% dodge 1 turn\n• Next attack +60% damage\n• Move behind enemy', animation: '🌙 Moonlight surrounds...\n💫 MOONWALK! Slip away!\n👻 Nothing but shadows!', cooldown: 4, energyCost: 15 },
    'Twilight Slash':    { description: '🌆 Slash at light and dark edge', effect: '• 150% damage\n• 40% BLIND (2 turns)\n• Hits twice', animation: '🌆 Slash between light and shadow...\n⚡ TWILIGHT SLASH! Two worlds cut!\n😵 Vision fades!', cooldown: 3, energyCost: 20 },
    'Eclipse Strike':    { description: '🌑 Strike in total eclipse', effect: '• 170% true damage\n• Ignores dodge\n• 45% FEAR (2 turns)', animation: '🌑 Eclipse darkens...\n💥 ECLIPSE STRIKE! Darkness!\n😱 Terror in the dark!', cooldown: 3, energyCost: 24 },
    'Shadow Waltz':      { description: '🌑 Dance with shadow as partner', effect: '• Shadow copies for 80% extra\n• +30% dodge 2 turns\n• Both crit this turn', animation: '🌑 Shadow fights with you...\n💃 SHADOW WALTZ! Two as one!\n💥 Double the death!', cooldown: 5, energyCost: 28 },
    'Void Step':         { description: '⚫ Step through void between strikes', effect: '• 180% true damage\n• Cannot be blocked\n• Teleport behind enemy', animation: '⚫ Vanish into void...\n💨 VOID STEP! Behind them!\n💥 Never saw it coming!', cooldown: 4, energyCost: 30 },
    'Phantom Dance':     { description: '👻 Dance as a phantom', effect: '• 200% damage\n• 70% dodge 2 turns\n• 50% enemy hits themselves', animation: '👻 Reality blurs...\n💃 PHANTOM DANCE! Real?\n😵 They swing at nothing!', cooldown: 4, energyCost: 34 },
    'Death Rhythm':      { description: '💀 Rhythm that leads to death', effect: '• 3 strikes at 80% each\n• Each hit +10% crit\n• Crit guaranteed on 3rd', animation: '💀 1, 2, 3 rhythm of death...\n🎵 DEATH RHYTHM! Perfect timing!\n💥 Third beat kills!', cooldown: 4, energyCost: 36 },
    'Eternal Dance':     { description: '♾️ Dance that never ends', effect: '• +50% speed 4 turns\n• Each turn dodge +10%\n• Auto-counter on dodge', animation: '♾️ Eternal rhythm...\n💃 ETERNAL DANCE! Endless!\n⚡ Cannot be caught!', cooldown: 6, energyCost: 40 },
    'Shadow Carnival':   { description: '🎪 Carnival of shadowy violence', effect: '• 7 hits at 60% each\n• Random status effect each\n• 20% chance each', animation: '🎪 Carnival begins...\n💃 SHADOW CARNIVAL! Mayhem!\n💥 Seven strikes of chaos!', cooldown: 5, energyCost: 45 },
    'Soul Dance':        { description: '👻 Dance with fallen souls', effect: '• 250% damage\n• Drain 20% max HP heal\n• 3 shadow helpers +20% each', animation: '👻 Fallen warriors dance...\n💃 SOUL DANCE! Dead fight beside you!\n🌑 Spectral allies!', cooldown: 6, energyCost: 48 },
    'Oblivion Step':     { description: '⚫ Step that erases the target', effect: '• 270% true damage\n• -30% max HP permanent\n• 40% BLIND + FEAR', animation: '⚫ Foot falls like verdict...\n💀 OBLIVION STEP! Existence!\n😱 Part of them gone!', cooldown: 6, energyCost: 52 },
    'Perfect Rhythm':    { description: '🎵 Achieve perfect combat rhythm', effect: '• All attacks guaranteed crit 3 turns\n• +60% speed\n• Immune to slow and freeze', animation: '🎵 Everything clicks...\n⚡ PERFECT RHYTHM! Unstoppable!\n💥 Every move perfect!', cooldown: 7, energyCost: 55 },
    'Shadow God':        { description: '🌑 Become the God of Shadows', effect: '• +100% ATK 3 turns\n• Untargetable 1 turn\n• Shadow copies 3 turns', animation: '🌑 Shadows bow...\n🌑 SHADOW GOD! Darkness!\n💀 You ARE shadow!', cooldown: 7, energyCost: 60 },
    'Infinite Dance':    { description: '♾️ Dance without end', effect: '• 5 strikes at 90% each\n• Each generates free dodge\n• Final hit 200%', animation: '♾️ Dance never stops...\n💃 INFINITE DANCE! Carnage!\n💥 Final strike ends it!', cooldown: 8, energyCost: 65 },
    'Reaper Dance':      { description: '💀 Dance as the Reaper', effect: '• 350% damage\n• Every status effect\n• 30% instant kill <30% HP', animation: '💀 Death takes your hand...\n🌑 REAPER DANCE! Death leads!\n😱 The harvest begins!', cooldown: 8, energyCost: 68 },
    'Chaos Step':        { description: '🌪️ Step through pure chaos', effect: '• 380% true damage\n• Random position each turn\n• +200% dodge 1 turn after', animation: '🌪️ Chaos dance partner...\n💥 CHAOS STEP! Unpredictable!\n😵 Cannot catch the unseen!', cooldown: 9, energyCost: 72 },
    'ShadowDancer Omega':{ description: '🌑 Ultimate dance of death', effect: '• 430% true damage\n• Absolute dodge 2 turns\n• Enemy to 1 HP if missed 3 times', animation: '🌑 Every shadow cast...\n💃 SHADOWDANCER OMEGA! Final dance!\n💀 One last dance. Last breath.', cooldown: 10, energyCost: 80 },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // HEALER SKILLS (added 2026-07-24)
  // All skills are heal/buff (zero damage). Custom command: /heal <skill>
  // ═══════════════════════════════════════════════════════════════════════
  Healer: {
    'Healing Light': {
      description: '✨ A gentle wave of light restores health to a single ally',
      effect: '• Restores 25% of max HP\n• Fast cast, low energy cost',
      animation: '✨ A warm light gathers in your palm...\n💖 HEALING LIGHT! The wound closes with golden light!\n🌟 Pain fades.',
      cooldown: 3,
      manaCost: 18,
    },
    'Purify': {
      description: '🌊 Cleanse an ally of ailments and restore some HP',
      effect: '• Restores 20% of max HP\n• Removes 1 debuff\n• Strips poison/burn/bleed',
      animation: '🌊 Pure water flows from your hands...\n💧 PURIFY! The poison drains away!\n✨ A clean spirit heals.',
      cooldown: 5,
      manaCost: 24,
    },
    'Renew': {
      description: '💚 A burst of restorative energy fills an ally',
      effect: '• Restores 30% of max HP\n• Restores 15% of max energy',
      animation: '💚 Vines of light wrap around the wound...\n🌿 RENEW! Life returns to weary flesh!\n💪 Strength flows back.',
      cooldown: 6,
      manaCost: 32,
    },
    'Sanctuary': {
      description: '🏛️ A protective aura that heals the whole party',
      effect: '• Restores 18% max HP to ALL party members',
      animation: '🏛️ A radiant dome forms around the party...\n✨ SANCTUARY! Sacred ground beneath your feet!\n💖 All who stand here are healed.',
      cooldown: 12,
      manaCost: 40,
    },
    'Divine Grace': {
      description: '🌟 A supreme blessing that heals and purifies the party',
      effect: '• Restores 35% of max HP to all allies\n• Clears ALL debuffs from party',
      animation: '🌟 Heavenly light pours down from above...\n👼 DIVINE GRACE! The gods themselves reach down!\n✨ A second chance for all.',
      cooldown: 18,
      manaCost: 55,
    },
    'Mass Renewal': {
      description: '🌿 A wave of life energy that restores HP and energy to the entire party',
      effect: '• Restores 22% of max HP to all allies\n• Restores 8% of max energy to all allies',
      animation: '🌿 Vines of golden light burst from the ground...\n🌸 MASS RENEWAL! Life itself returns!\n💚 Every ally feels the warmth.',
      cooldown: 20,
      manaCost: 60,
    },
    'Blessed Shield': {
      description: '🛡️ Wrap an ally in a barrier of holy light',
      effect: '• Target gains a shield absorbing 40% of max HP\n• Lasts 3 turns\n• Stacks with other shields',
      animation: '🛡️ You raise your staff high...\n✨ A radiant dome forms around your ally!\n🛡️ BLESSED SHIELD! Holy protection!',
      cooldown: 10,
      manaCost: 28,
    },
    'Aura of Light': {
      description: '✨ Radiate healing energy that pulses on every ally',
      effect: '• Party heals 25% of damage taken for 2 turns\n• Stacks with Blessed Touch passive',
      animation: '✨ Light erupts from your core...\n🌟 AURA OF LIGHT! The air itself heals!\n💖 All who stand near you recover.',
      cooldown: 14,
      manaCost: 45,
    },
    'Mana Spring': {
      description: '💧 Channel pure mana into an ally',
      effect: '• Target restores 30% of max energy',
      animation: '💧 Mana flows like spring water through your hands...\n💙 MANA SPRING! Energy restored!\n⚡ Power returns to the weary.',
      cooldown: 8,
      manaCost: 22,
    },
    'Rebirth': {
      description: '💫 Call upon the divine to bring a fallen ally back',
      effect: '• Revives a KO\'d ally with 50% of max HP\n• One-time use per ally per battle',
      animation: '💫 You kneel and pray with all your soul...\n👼 REBIRTH! A soul returns from beyond!\n✨ Miracles are real.',
      cooldown: 60,
      manaCost: 90,
    },
    // Levels 55-90 (placeholders — fully fleshed out below)
    'Sanctuary Mastery': {
      description: '🏛️ Evoke a sanctuary that outheals any mortal wound',
      effect: '• Restores 28% max HP to all allies\n• +10% DEF for the party for 2 turns',
      animation: '🏛️ A golden temple materializes around the party...\n✨ SANCTUARY MASTERY! Sacred ground itself!\n💖 Pain is foreign here.',
      cooldown: 14,
      manaCost: 65,
    },
    'Light of Dawn': {
      description: '🌅 Summon the first light of a new day',
      effect: '• Restores 40% max HP to all allies\n• Removes all debuffs\n• Grants 2-turn regen (5% HP/turn)',
      animation: '🌅 The sun rises inside the room...\n🌟 LIGHT OF DAWN! A new day begins!\n💖 Darkness has no power here.',
      cooldown: 16,
      manaCost: 75,
    },
    'Grace Unending': {
      description: '🕊️ Channel a never-ending stream of divine grace',
      effect: '• HoT: 10% max HP healed per turn for 4 turns to all allies\n• Stacks with other HoTs',
      animation: '🕊️ A white dove circles overhead, leaving trails of light...\n🌟 GRACE UNENDING! Healing never stops!\n💖 Time itself bends to your mercy.',
      cooldown: 20,
      manaCost: 80,
    },
    'Miracle': {
      description: '🌠 Perform a true miracle that defies death',
      effect: '• Revives all KO\'d allies with 75% HP\n• Removes all debuffs from all allies\n• Heals all alive allies for 50% max HP',
      animation: '🌠 Light explodes from your staff...\n👼 MIRACLE! The laws of nature shatter!\n💀 Even death must yield to your word.',
      cooldown: 90,
      manaCost: 150,
    },
    'Resurrection': {
      description: '⚰️ Refuse to let the dead stay dead',
      effect: '• Revives all KO\'d allies with full HP\n• Heals all alive allies for 60% max HP\n• One use per battle',
      animation: '⚰️ You slam your staff into the ground...\n🌋 RESURRECTION! The earth itself rejects death!\n💀 "You will not die today."',
      cooldown: 120,
      manaCost: 200,
    },
    'Solar Brilliance': {
      description: '☀️ Become the sun — a beacon of unquenchable healing',
      effect: '• All allies healed for 45% max HP\n• Aura heals 15% of damage taken for 3 turns\n• +20% ATK for all allies for 3 turns',
      animation: '☀️ A miniature sun blazes above your head...\n🌟 SOLAR BRILLIANCE! The light of ten thousand stars!\n💖 Even the sun obeys you.',
      cooldown: 25,
      manaCost: 100,
    },
    'World Heal': {
      description: '🌍 Your light reaches every wounded soul in the world',
      effect: '• Heals every ally (including dead) for 100% HP\n• Grants immunity to damage for 1 turn\n• Removes all debuffs from everyone',
      animation: '🌍 Light floods the entire battlefield...\n✨ WORLD HEAL! Every wound is closed!\n💖 The world itself exhales in relief.',
      cooldown: 180,
      manaCost: 250,
    },
    'Transcendent Light': {
      description: '🌌 Step beyond mortality — become light itself',
      effect: '• Full party heal + revival + immunity + cleanse + damage boost\n• 3-turn duration on all effects\n• The ultimate expression of healing',
      animation: '🌌 Your body dissolves into pure light...\n✨ TRANSCENDENT LIGHT! You ARE the healing!\n🌟 Beyond gods. Beyond death. Beyond time.',
      cooldown: 300,
      manaCost: 500,
    },
  },

};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getSkillDescription(className, skillName) {
  // First check if the class and skill exist
  if (skillDatabase[className] && skillDatabase[className][skillName]) {
    return {
      className: className,
      ...skillDatabase[className][skillName]
    };
  }
  
  // If not found, search all classes
  for (const cls in skillDatabase) {
    if (skillDatabase[cls][skillName]) {
      return {
        className: cls,
        ...skillDatabase[cls][skillName]
      };
    }
  }
  
  // Return default fallback if skill not found
  return {
    className: 'Unknown',
    description: '⚔️ A powerful combat ability',
    effect: '• 150% damage\n• Deals damage to enemies\n• Powerful technique',
    animation: '✨ You channel your power...\n💥 The attack connects!\n⚡ Devastating impact!',
    cooldown: 3,
    cost: 30
  };
}

function getClassSkills(className) {
  return skillDatabase[className] || {};
}

function getAllClasses() {
  return Object.keys(skillDatabase);
}

function getSkillCount(className) {
  return Object.keys(skillDatabase[className] || {}).length;
}

function searchSkills(keyword) {
  const results = [];
  const searchTerm = keyword.toLowerCase();
  
  for (const className in skillDatabase) {
    for (const skillName in skillDatabase[className]) {
      const skill = skillDatabase[className][skillName];
      if (
        skillName.toLowerCase().includes(searchTerm) ||
        skill.description.toLowerCase().includes(searchTerm) ||
        skill.effect.toLowerCase().includes(searchTerm)
      ) {
        results.push({
          className: className,
          skillName: skillName,
          ...skill
        });
      }
    }
  }
  
  return results;
}

function getAllSkills() {
  const allSkills = [];
  
  for (const className in skillDatabase) {
    for (const skillName in skillDatabase[className]) {
      allSkills.push({
        className: className,
        skillName: skillName,
        ...skillDatabase[className][skillName]
      });
    }
  }
  
  return allSkills;
}

// ═══════════════════════════════════════════════════════════════
// MONSTER SKILLS DATABASE
// ═══════════════════════════════════════════════════════════════

const monsterSkills = {
  // Common Monsters
  'Bounce': { description: '🟢 The slime bounces with force!', damageMultiplier: 1.3, effect: null },
  'Acid Spit': { description: '🧪 Corrosive acid sprays!', damageMultiplier: 1.5, effect: 'poison', effectDuration: 3 },
  'Slash': { description: '🗡️ A vicious slash tears through!', damageMultiplier: 1.4, effect: 'bleed', effectDuration: 3 },
  'Backstab': { description: '🔪 A sneaky strike from shadows!', damageMultiplier: 2.0, effect: 'bleed', effectDuration: 2 },
  'Bite': { description: '🦷 Sharp fangs sink deep!', damageMultiplier: 1.5, effect: 'bleed', effectDuration: 4 },
  'Charge': { description: '💨 A powerful charging attack!', damageMultiplier: 1.8, effect: 'stun', effectDuration: 1 },
  'Web Trap': { description: '🕸️ Sticky webs entangle!', damageMultiplier: 1.2, effect: 'slow', effectDuration: 2 },
  'Poison Bite': { description: '☠️ Venomous fangs inject toxins!', damageMultiplier: 1.4, effect: 'poison', effectDuration: 4 },
  'Claw Swipe': { description: '🐾 Razor claws rake across!', damageMultiplier: 1.6, effect: 'bleed', effectDuration: 3 },
  'Howl': { description: '🐺 A terrifying howl weakens!', damageMultiplier: 1.3, effect: 'weaken', effectDuration: 3 },
  
  // Undead
  'Corpse Grab': { description: '🧟 Rotting hands grasp!', damageMultiplier: 1.4, effect: 'slow', effectDuration: 2 },
  'Bone Throw': { description: '💀 Sharpened bones fly!', damageMultiplier: 1.5, effect: null },
  'Death Grip': { description: '☠️ A chilling grasp drains life!', damageMultiplier: 1.7, effect: 'weaken', effectDuration: 3 },
  
  // Elemental
  'Fireball': { description: '🔥 A blazing sphere erupts!', damageMultiplier: 1.8, effect: 'burn', effectDuration: 3 },
  'Flame Burst': { description: '💥 Explosive flames engulf!', damageMultiplier: 2.0, effect: 'burn', effectDuration: 3 },
  'Ice Shard': { description: '❄️ Sharp ice shards pierce!', damageMultiplier: 1.6, effect: 'freeze', effectDuration: 2 },
  'Frost Breath': { description: '💨 Freezing cold numbs!', damageMultiplier: 1.5, effect: 'freeze', effectDuration: 2 },
  'Lightning Bolt': { description: '⚡ Electricity crackles!', damageMultiplier: 1.9, effect: 'stun', effectDuration: 1 },
  'Thunder Strike': { description: '⚡ A massive bolt crashes!', damageMultiplier: 2.2, effect: 'stun', effectDuration: 1 },
  
  // Flying
  'Dive Bomb': { description: '🦅 A devastating dive!', damageMultiplier: 2.0, effect: 'stun', effectDuration: 1 },
  'Wing Slash': { description: '🪶 Sharp wings slice!', damageMultiplier: 1.7, effect: 'bleed', effectDuration: 2 },
  'Dive Claw': { description: '🦅 Talons strike from above!', damageMultiplier: 1.8, effect: 'bleed', effectDuration: 3 },
  'Sonic Screech': { description: '🔊 A deafening screech!', damageMultiplier: 1.4, effect: 'stun', effectDuration: 1 },
  
  // Boss Skills
  'Inferno Wave': { description: '🔥 A wave of hellfire!', damageMultiplier: 2.5, effect: 'burn', effectDuration: 4 },
  'Dark Curse': { description: '🌑 Shadowy curse weakens!', damageMultiplier: 1.8, effect: 'weaken', effectDuration: 4 },
  'Demon Form': { description: '👿 Demonic power surges!', damageMultiplier: 2.8, effect: 'burn', effectDuration: 3 },
  'Soul Drain': { description: '💀 Life essence ripped away!', damageMultiplier: 2.2, effect: 'weaken', effectDuration: 5 },
  'Earthquake': { description: '🌍 The ground violently shakes!', damageMultiplier: 2.4, effect: 'stun', effectDuration: 2 },
  'Meteor Strike': { description: '☄️ A meteor crashes down!', damageMultiplier: 3.0, effect: 'burn', effectDuration: 4 },
  'Absolute Zero': { description: '❄️ Temperature plummets!', damageMultiplier: 2.6, effect: 'freeze', effectDuration: 3 },
  'Rage Mode': { description: '😡 Pure fury amplifies!', damageMultiplier: 2.8, effect: null },
  'Blood Frenzy': { description: '🩸 Bloodlust drives frenzy!', damageMultiplier: 2.5, effect: 'bleed', effectDuration: 5 },
  'Venom Nova': { description: '☠️ Toxic poison explodes!', damageMultiplier: 2.3, effect: 'poison', effectDuration: 5 },
  'Void Blast': { description: '🌌 Dark void tears reality!', damageMultiplier: 3.2, effect: 'weaken', effectDuration: 4 },
  
  // Dragon
  'Dragon Breath': { description: '🐉 Dragon flames incinerate!', damageMultiplier: 3.5, effect: 'burn', effectDuration: 5 },
  'Tail Sweep': { description: '🦎 Massive tail crushes!', damageMultiplier: 2.4, effect: 'stun', effectDuration: 2 },
  'Wing Tempest': { description: '🌪️ Powerful winds tear!', damageMultiplier: 2.6, effect: 'slow', effectDuration: 3 },
  
  // Insects
  'Poison Sting': { description: '🦂 Venomous stinger injects!', damageMultiplier: 1.6, effect: 'poison', effectDuration: 4 },
  'Paralyzing Bite': { description: '🕷️ Paralytic venom!', damageMultiplier: 1.5, effect: 'stun', effectDuration: 2 },
  'Swarm': { description: '🐝 Overwhelming stings!', damageMultiplier: 2.0, effect: 'poison', effectDuration: 3 }
};

function getMonsterSkill(skillName) {
  return monsterSkills[skillName] || {
    description: '💥 A powerful attack!',
    damageMultiplier: 1.5,
    effect: null
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  skillDatabase,
  getSkillDescription,
  getClassSkills,
  getAllClasses,
  getSkillCount,
  searchSkills,
  getAllSkills,
  getMonsterSkill  
};