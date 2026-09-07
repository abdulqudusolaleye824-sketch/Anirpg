/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║               ✦ 𝐀𝐬𝐭𝐫𝐚™ — SkinCatalog.js                        ║
 * ║  Master catalog of all 230 player skins.                     ║
 * ║  Rarities: Common(70) Uncommon(50) Rare(40)                  ║
 * ║            Epic(40)   Legendary(20) Mythic(10)               ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Each skin:
 *   id         — unique snake_case key, matches filename in assets/skins/<rarity>/<id>.png
 *   name       — display name
 *   rarity     — common | uncommon | rare | epic | legendary | mythic
 *   theme      — anime/genre source inspiration
 *   archetype  — warrior | mage | rogue | archer | tank | support | special
 *   lore       — 1-sentence flavour text shown on /skin view
 *   cost       — { Mana Stones } for shop, or null if not directly purchasable
 *   source     — shop | gacha | achievement | event (how it's obtainable)
 *   tags       — searchable keywords
 */

'use strict';

const SKINS = [

  // ══════════════════════════════════════════════════════════════
  // COMMON — 70 skins  (plain, minimal design, low detail)
  // ══════════════════════════════════════════════════════════════

  { id:'common_village_boy',      name:'Village Boy',         rarity:'common', theme:'Generic',        archetype:'warrior',  lore:'Just a kid from the village who picked up a sword.',                          cost:{manaStones:0},   source:'default',     tags:['starter','male','simple'] },
  { id:'common_village_girl',     name:'Village Girl',        rarity:'common', theme:'Generic',        archetype:'support',  lore:'She left home the day the gate appeared.',                                    cost:{manaStones:0},   source:'default',     tags:['starter','female','simple'] },
  { id:'common_trainee',          name:'Hunter Trainee',      rarity:'common', theme:'Solo Leveling',  archetype:'warrior',  lore:'Ranked E. Assigned to the lowest gates. For now.',                           cost:{manaStones:80},  source:'shop',        tags:['solo leveling','beginner'] },
  { id:'common_farmer',           name:'Farmhand',            rarity:'common', theme:'Generic',        archetype:'tank',     lore:'Traded the plow for a shield. Not much changed.',                             cost:{manaStones:80},  source:'shop',        tags:['simple','rural'] },
  { id:'common_street_kid',       name:'Street Rat',          rarity:'common', theme:'Generic',        archetype:'rogue',    lore:'Survived the slums long before gates were a thing.',                          cost:{manaStones:80},  source:'shop',        tags:['rogue','urban'] },
  { id:'common_squire',           name:'Squire',              rarity:'common', theme:'Medieval',       archetype:'warrior',  lore:'Assigned to carry swords. Decided to use one instead.',                       cost:{manaStones:80},  source:'shop',        tags:['knight','medieval'] },
  { id:'common_apprentice',       name:'Mage Apprentice',     rarity:'common', theme:'Fantasy',        archetype:'mage',     lore:'Two weeks into magic school. Three weeks from quitting.',                      cost:{manaStones:80},  source:'shop',        tags:['mage','student'] },
  { id:'common_scout',            name:'Scout',               rarity:'common', theme:'Generic',        archetype:'archer',   lore:'Sees danger before anyone else. Runs afterward.',                             cost:{manaStones:80},  source:'shop',        tags:['archer','recon'] },
  { id:'common_monk_novice',      name:'Novice Monk',         rarity:'common', theme:'Generic',        archetype:'support',  lore:'Peaceful by training. Devastating by accident.',                              cost:{manaStones:80},  source:'shop',        tags:['monk','peaceful'] },
  { id:'common_rebel',            name:'Rebel',               rarity:'common', theme:'Generic',        archetype:'rogue',    lore:"Doesn't follow rules. Doesn't follow orders. Still wins.",                    cost:{manaStones:80},  source:'shop',        tags:['rebel','casual'] },
  { id:'common_grunt',            name:'Grunt',               rarity:'common', theme:'Military',       archetype:'warrior',  lore:'First in, last out. Always.',                                                 cost:{manaStones:80},  source:'shop',        tags:['military','tough'] },
  { id:'common_wanderer',         name:'Wanderer',            rarity:'common', theme:'Generic',        archetype:'rogue',    lore:'No destination. No regrets.',                                                  cost:{manaStones:80},  source:'shop',        tags:['traveller','loner'] },
  { id:'common_healer',           name:'Field Medic',         rarity:'common', theme:'Generic',        archetype:'support',  lore:'Patches wounds with one hand, fights with the other.',                        cost:{manaStones:80},  source:'shop',        tags:['healer','medic'] },
  { id:'common_thug',             name:'Back-Alley Brawler',  rarity:'common', theme:'Generic',        archetype:'warrior',  lore:'No technique. Just fists and a bad attitude.',                                cost:{manaStones:80},  source:'shop',        tags:['brawler','street'] },
  { id:'common_child_prodigy',    name:'Child Prodigy',       rarity:'common', theme:'Generic',        archetype:'mage',     lore:'Age 12. Already smarter than the guild master.',                              cost:{manaStones:80},  source:'shop',        tags:['young','smart'] },
  { id:'common_ranger',           name:'Forest Ranger',       rarity:'common', theme:'Generic',        archetype:'archer',   lore:'Knows every tree. Trusts none of them.',                                      cost:{manaStones:80},  source:'shop',        tags:['forest','nature'] },
  { id:'common_mercenary',        name:'Mercenary',           rarity:'common', theme:'Generic',        archetype:'warrior',  lore:'Nexus first. Questions second.',                                               cost:{manaStones:80},  source:'shop',        tags:['mercenary','gruff'] },
  { id:'common_bandit',           name:'Reformed Bandit',     rarity:'common', theme:'Generic',        archetype:'rogue',    lore:"Claims to have reformed. Still picks pockets by habit.",                      cost:{manaStones:80},  source:'shop',        tags:['bandit','shady'] },
  { id:'common_shrine_maiden',    name:'Shrine Maiden',       rarity:'common', theme:'Japanese',       archetype:'support',  lore:'Sweeps the shrine at dawn. Fights demons by noon.',                           cost:{manaStones:80},  source:'shop',        tags:['japanese','spiritual'] },
  { id:'common_ninja_student',    name:'Ninja Student',       rarity:'common', theme:'Naruto',         archetype:'rogue',    lore:'Graduated the academy. Now the real training begins.',                        cost:{manaStones:80},  source:'shop',        tags:['naruto','ninja'] },
  { id:'common_fisherman',        name:'Fisherman',           rarity:'common', theme:'One Piece',      archetype:'support',  lore:'Traded his net for a sword. Still smells like fish.',                         cost:{manaStones:80},  source:'shop',        tags:['one piece','sea'] },
  { id:'common_street_mage',      name:'Street Mage',         rarity:'common', theme:'Fantasy',        archetype:'mage',     lore:'Self-taught. Unaccredited. Surprisingly effective.',                          cost:{manaStones:80},  source:'shop',        tags:['mage','urban'] },
  { id:'common_inn_keeper',       name:'Innkeeper',           rarity:'common', theme:'Fantasy',        archetype:'tank',     lore:'Thirty years behind the counter made him unbreakable.',                       cost:{manaStones:80},  source:'shop',        tags:['innkeeper','sturdy'] },
  { id:'common_blacksmith',       name:'Young Blacksmith',    rarity:'common', theme:'FMA',            archetype:'warrior',  lore:'Hammers steel by day. Hammers enemies when necessary.',                       cost:{manaStones:80},  source:'shop',        tags:['fma','crafting'] },
  { id:'common_delivery_boy',     name:'Delivery Boy',        rarity:'common', theme:'Generic',        archetype:'rogue',    lore:'Fastest runner in the city. Nobody knows why.',                               cost:{manaStones:80},  source:'shop',        tags:['fast','urban'] },
  { id:'common_odd_jobs',         name:'Odd-Jobs',            rarity:'common', theme:'Gintama',        archetype:'warrior',  lore:"Takes any job. Complains the whole time. Gets it done.",                      cost:{manaStones:80},  source:'shop',        tags:['gintama','odd'] },
  { id:'common_soldier',          name:'Foot Soldier',        rarity:'common', theme:'AOT',            archetype:'warrior',  lore:'Trained for the Walls. Served with honour.',                                  cost:{manaStones:80},  source:'shop',        tags:['aot','soldier'] },
  { id:'common_titan_recruit',    name:'Titan Corps Recruit', rarity:'common', theme:'AOT',            archetype:'warrior',  lore:'First year. Already seen more than veterans.',                                cost:{manaStones:80},  source:'shop',        tags:['aot','recruit'] },
  { id:'common_exorcist',         name:'Exorcist Novice',     rarity:'common', theme:'Blue Exorcist',  archetype:'support',  lore:'The academy was harder than the demons.',                                     cost:{manaStones:80},  source:'shop',        tags:['exorcist','spiritual'] },
  { id:'common_pirate_deckhand',  name:'Pirate Deckhand',     rarity:'common', theme:'One Piece',      archetype:'warrior',  lore:'Joined the crew last week. Fit right in.',                                    cost:{manaStones:80},  source:'shop',        tags:['one piece','pirate'] },
  { id:'common_ghost_hunter',     name:'Ghost Hunter',        rarity:'common', theme:'Bleach',         archetype:'rogue',    lore:'Can see what others cannot. That is enough.',                                 cost:{manaStones:80},  source:'shop',        tags:['bleach','spirit'] },
  { id:'common_qi_student',       name:'Qi Student',          rarity:'common', theme:'Generic',        archetype:'mage',     lore:'Barely scratched the surface of inner energy.',                               cost:{manaStones:80},  source:'shop',        tags:['qi','student'] },
  { id:'common_punk',             name:'Punk',                rarity:'common', theme:'Generic',        archetype:'warrior',  lore:'Loud music. Louder fists.',                                                   cost:{manaStones:80},  source:'shop',        tags:['modern','attitude'] },
  { id:'common_cleric',           name:'Cleric',              rarity:'common', theme:'Fantasy',        archetype:'support',  lore:'Heals first. Judges silently.',                                               cost:{manaStones:80},  source:'shop',        tags:['cleric','holy'] },
  { id:'common_samurai_pupil',    name:'Samurai Pupil',       rarity:'common', theme:'Japanese',       archetype:'warrior',  lore:'Learning the blade from a master who barely speaks.',                         cost:{manaStones:80},  source:'shop',        tags:['samurai','japanese'] },
  { id:'common_cave_hunter',      name:'Cave Hunter',         rarity:'common', theme:'Solo Leveling',  archetype:'warrior',  lore:'E-rank. Assigned to caves. Absolutely fine with this.',                      cost:{manaStones:80},  source:'shop',        tags:['solo leveling','cave'] },
  { id:'common_courier',          name:'Courier',             rarity:'common', theme:'Generic',        archetype:'rogue',    lore:'Delivers messages between guilds. Reads all of them.',                        cost:{manaStones:80},  source:'shop',        tags:['spy','fast'] },
  { id:'common_seer',             name:'Seer',                rarity:'common', theme:'Generic',        archetype:'support',  lore:'Sees the future. Still gets hit by falling rocks.',                           cost:{manaStones:80},  source:'shop',        tags:['seer','mystic'] },
  { id:'common_street_fighter',   name:'Street Fighter',      rarity:'common', theme:'Generic',        archetype:'warrior',  lore:'No technique. Pure instinct.',                                                cost:{manaStones:80},  source:'shop',        tags:['brawler','instinct'] },
  { id:'common_archer_student',   name:'Archer Student',      rarity:'common', theme:'HxH',            archetype:'archer',   lore:'Still training. Already hits targets others miss.',                           cost:{manaStones:80},  source:'shop',        tags:['hxh','archer'] },
  { id:'common_sand_drifter',     name:'Sand Drifter',        rarity:'common', theme:'Naruto',         archetype:'warrior',  lore:'Came from the desert. Brought the heat with them.',                           cost:{manaStones:80},  source:'shop',        tags:['naruto','desert'] },
  { id:'common_alchemist',        name:'Alchemist',           rarity:'common', theme:'FMA',            archetype:'mage',     lore:'Equivalent exchange. Fair trade only.',                                       cost:{manaStones:80},  source:'shop',        tags:['fma','science'] },
  { id:'common_tailor',           name:'Battle Tailor',       rarity:'common', theme:'Generic',        archetype:'support',  lore:'Sews armour by night. Wears it into battle by day.',                          cost:{manaStones:80},  source:'shop',        tags:['crafter','support'] },
  { id:'common_dock_worker',      name:'Dock Worker',         rarity:'common', theme:'One Piece',      archetype:'tank',     lore:'Built like a ship. Moves like one in water.',                                 cost:{manaStones:80},  source:'shop',        tags:['one piece','strong'] },
  { id:'common_cave_troll_slayer',name:'Troll Slayer',        rarity:'common', theme:'Fantasy',        archetype:'warrior',  lore:'Specialises in one monster type. Very good at it.',                           cost:{manaStones:80},  source:'shop',        tags:['monster','slayer'] },
  { id:'common_wind_student',     name:'Wind Breather',       rarity:'common', theme:'Demon Slayer',   archetype:'rogue',    lore:'Breath of Wind — barely mastered. Already dangerous.',                       cost:{manaStones:80},  source:'shop',        tags:['demon slayer','breath'] },
  { id:'common_lost_soul',        name:'Lost Soul',           rarity:'common', theme:'Re:Zero',        archetype:'support',  lore:'Arrived here by accident. Refuses to go back.',                               cost:{manaStones:80},  source:'shop',        tags:['rezero','mystery'] },
  { id:'common_idol',             name:'Battle Idol',         rarity:'common', theme:'Generic',        archetype:'special',  lore:'Sings between fights. Surprisingly intimidating.',                            cost:{manaStones:80},  source:'shop',        tags:['idol','unique'] },
  { id:'common_ghost',            name:'Haunting Presence',   rarity:'common', theme:'Bleach',         archetype:'rogue',    lore:'Half in the spirit world. Fully in your face.',                               cost:{manaStones:80},  source:'shop',        tags:['bleach','ghost'] },
  { id:'common_time_lost',        name:'Time-Lost',           rarity:'common', theme:'Steins;Gate',    archetype:'special',  lore:'Fell through a divergence. Landed here.',                                     cost:{manaStones:80},  source:'shop',        tags:['steins gate','time'] },
  { id:'common_summoner',         name:'Companion Summoner',        rarity:'common', theme:'Generic',        archetype:'support',  lore:'Cannot fight alone. So they never do.',                                       cost:{manaStones:80},  source:'shop',        tags:['summoner','companion'] },
  { id:'common_poison_user',      name:'Poison User',         rarity:'common', theme:'Naruto',         archetype:'rogue',    lore:'Slow death is still death.',                                                  cost:{manaStones:80},  source:'shop',        tags:['naruto','poison'] },
  { id:'common_ice_user',         name:'Ice User',            rarity:'common', theme:'Naruto',         archetype:'mage',     lore:'From the Hidden Mist. Cold in more ways than one.',                           cost:{manaStones:80},  source:'shop',        tags:['naruto','ice'] },
  { id:'common_fire_user',        name:'Fire User',           rarity:'common', theme:'Naruto',         archetype:'mage',     lore:'Fire jutsu — technique 1 of 3. That\'s enough.',                             cost:{manaStones:80},  source:'shop',        tags:['naruto','fire'] },
  { id:'common_shadow_user',      name:'Shadow User',         rarity:'common', theme:'Naruto',         archetype:'rogue',    lore:'Shadow clone. Shadow blade. Shadow everything.',                              cost:{manaStones:80},  source:'shop',        tags:['naruto','shadow'] },
  { id:'common_blind_swordsman',  name:'Blind Swordsman',     rarity:'common', theme:'Generic',        archetype:'warrior',  lore:'Cannot see. Never misses.',                                                   cost:{manaStones:80},  source:'shop',        tags:['warrior','unique'] },
  { id:'common_fallen_noble',     name:'Fallen Noble',        rarity:'common', theme:'Generic',        archetype:'warrior',  lore:'Lost title, land, and name. Kept the sword.',                                 cost:{manaStones:80},  source:'shop',        tags:['noble','fallen'] },
  { id:'common_beast_tamer',      name:'Beast Tamer',         rarity:'common', theme:'Generic',        archetype:'support',  lore:'Animals listen. People rarely do.',                                           cost:{manaStones:80},  source:'shop',        tags:['tamer','animal'] },
  { id:'common_plague_doctor',    name:'Plague Doctor',       rarity:'common', theme:'Generic',        archetype:'support',  lore:'The mask stays on. For everyone\'s sake.',                                    cost:{manaStones:80},  source:'shop',        tags:['doctor','mask'] },
  { id:'common_stage_performer',  name:'Stage Performer',     rarity:'common', theme:'Generic',        archetype:'special',  lore:'Life is a stage. The gates are just a new act.',                              cost:{manaStones:80},  source:'shop',        tags:['performer','unique'] },
  { id:'common_ronin',            name:'Ronin',               rarity:'common', theme:'Japanese',       archetype:'warrior',  lore:'Masterless. Purposeless. Still the most dangerous person here.',              cost:{manaStones:80},  source:'shop',        tags:['ronin','samurai'] },
  { id:'common_puppet_user',      name:'Puppet Master',       rarity:'common', theme:'Naruto',         archetype:'special',  lore:'Controls the strings from a distance.',                                       cost:{manaStones:80},  source:'shop',        tags:['naruto','puppet'] },
  { id:'common_clone',            name:'The Clone',           rarity:'common', theme:'Generic',        archetype:'special',  lore:'Identical to someone else. No one knows who.',                                cost:{manaStones:80},  source:'shop',        tags:['clone','mystery'] },
  { id:'common_duelist',          name:'Duelist',             rarity:'common', theme:'Generic',        archetype:'warrior',  lore:'Never attacks first. Never needs to.',                                        cost:{manaStones:80},  source:'shop',        tags:['duelist','honour'] },
  { id:'common_outlander',        name:'Outlander',           rarity:'common', theme:'Generic',        archetype:'warrior',  lore:'Came from outside the known world. Barely speaks the language.',              cost:{manaStones:80},  source:'shop',        tags:['outsider','mystery'] },
  { id:'common_night_watch',      name:'Night Watch',         rarity:'common', theme:'Generic',        archetype:'warrior',  lore:'Stands guard all night. Fights all day. Sleeps eventually.',                  cost:{manaStones:80},  source:'shop',        tags:['guard','night'] },
  { id:'common_gatekeeper',       name:'Gatekeeper',          rarity:'common', theme:'Solo Leveling',  archetype:'tank',     lore:'Ironic that a gatekeeper now enters gates.',                                  cost:{manaStones:80},  source:'shop',        tags:['gate','ironic'] },
  { id:'common_scribe',           name:'Battle Scribe',       rarity:'common', theme:'Generic',        archetype:'support',  lore:'Records every fight. Then enters the next one.',                              cost:{manaStones:80},  source:'shop',        tags:['scholar','notes'] },
  { id:'common_berserker_pup',    name:'Young Berserker',     rarity:'common', theme:'Generic',        archetype:'warrior',  lore:'All rage. No control. Working on the control part.',                          cost:{manaStones:80},  source:'shop',        tags:['berserker','young'] },

  // ══════════════════════════════════════════════════════════════
  // UNCOMMON — 50 skins  (distinct silhouette, simple colour theme)
  // ══════════════════════════════════════════════════════════════

  { id:'unc_shadow_hunter',       name:'Shadow Hunter',       rarity:'uncommon', theme:'Solo Leveling',  archetype:'rogue',    lore:'Hunts in the dark where others fear to go.',                               cost:{manaStones:200},  source:'shop',        tags:['solo leveling','shadow'] },
  { id:'unc_ice_mage',            name:'Ice Mage',            rarity:'uncommon', theme:'Generic',        archetype:'mage',     lore:'Freezes first. Explains later.',                                           cost:{manaStones:200},  source:'shop',        tags:['mage','ice'] },
  { id:'unc_fire_fist',           name:'Fire Fist',           rarity:'uncommon', theme:'One Piece',      archetype:'warrior',  lore:'Fire burns in both fists. The heart is even hotter.',                      cost:{manaStones:200},  source:'gacha',       tags:['one piece','fire'] },
  { id:'unc_wind_slash',          name:'Wind Slash',          rarity:'uncommon', theme:'Demon Slayer',   archetype:'warrior',  lore:'Breath of Wind, Seventh Form. Piercing Wind.',                             cost:{manaStones:200},  source:'shop',        tags:['demon slayer','wind'] },
  { id:'unc_thunder_fist',        name:'Thunder Fist',        rarity:'uncommon', theme:'HxH',            archetype:'warrior',  lore:'Lightning in every punch. No warning.',                                    cost:{manaStones:200},  source:'shop',        tags:['hxh','lightning'] },
  { id:'unc_archer_elite',        name:'Elite Archer',        rarity:'uncommon', theme:'Generic',        archetype:'archer',   lore:'Every arrow hits. Every shot counts.',                                     cost:{manaStones:200},  source:'shop',        tags:['archer','precise'] },
  { id:'unc_ghost_blade',         name:'Ghost Blade',         rarity:'uncommon', theme:'Bleach',         archetype:'warrior',  lore:'The sword is drawn before you hear the sound.',                            cost:{manaStones:200},  source:'gacha',       tags:['bleach','sword'] },
  { id:'unc_void_walker',         name:'Void Walker',         rarity:'uncommon', theme:'Solo Leveling',  archetype:'special',  lore:'Steps between dimensions. Never fully here.',                              cost:{manaStones:200},  source:'shop',        tags:['void','dimension'] },
  { id:'unc_sand_ninja',          name:'Sand Ninja',          rarity:'uncommon', theme:'Naruto',         archetype:'rogue',    lore:'Sand flows through every technique.',                                      cost:{manaStones:200},  source:'shop',        tags:['naruto','sand'] },
  { id:'unc_water_dancer',        name:'Water Dancer',        rarity:'uncommon', theme:'Generic',        archetype:'rogue',    lore:'Flowing like water. Striking like a wave.',                                 cost:{manaStones:200},  source:'shop',        tags:['water','fluid'] },
  { id:'unc_iron_monk',           name:'Iron Monk',           rarity:'uncommon', theme:'Generic',        archetype:'tank',     lore:'Decades of meditation made the body steel.',                               cost:{manaStones:200},  source:'shop',        tags:['monk','iron'] },
  { id:'unc_thunder_clad',        name:'Thunder Clad',        rarity:'uncommon', theme:'MHA',            archetype:'warrior',  lore:'Lightning quirk, half-controlled. All power.',                             cost:{manaStones:200},  source:'shop',        tags:['mha','lightning'] },
  { id:'unc_blood_knight',        name:'Blood Knight',        rarity:'uncommon', theme:'Generic',        archetype:'warrior',  lore:'Fights until the red runs out. It never does.',                            cost:{manaStones:200},  source:'gacha',       tags:['knight','blood'] },
  { id:'unc_storm_caller',        name:'Storm Caller',        rarity:'uncommon', theme:'Generic',        archetype:'mage',     lore:'Calls the storm before the fight begins.',                                  cost:{manaStones:200},  source:'shop',        tags:['storm','weather'] },
  { id:'unc_snake_eyes',          name:'Snake Eyes',          rarity:'uncommon', theme:'Naruto',         archetype:'rogue',    lore:'Sees through illusions. Weaves them just as well.',                        cost:{manaStones:200},  source:'shop',        tags:['naruto','snake'] },
  { id:'unc_forest_spirit',       name:'Forest Spirit',       rarity:'uncommon', theme:'Generic',        archetype:'support',  lore:'The trees answer. The enemies regret asking.',                             cost:{manaStones:200},  source:'shop',        tags:['nature','spirit'] },
  { id:'unc_fallen_angel',        name:'Fallen Angel',        rarity:'uncommon', theme:'Generic',        archetype:'special',  lore:'Lost the wings. Kept the power.',                                          cost:{manaStones:200},  source:'gacha',       tags:['angel','fallen'] },
  { id:'unc_cursed_arm',          name:'Cursed Arm',          rarity:'uncommon', theme:'JJK',            archetype:'warrior',  lore:'The cursed arm is a burden. Also the best weapon here.',                   cost:{manaStones:200},  source:'shop',        tags:['jjk','curse'] },
  { id:'unc_sea_knight',          name:'Sea Knight',          rarity:'uncommon', theme:'One Piece',      archetype:'tank',     lore:'Marine trained. Sea-hardened. Hard to sink.',                              cost:{manaStones:200},  source:'shop',        tags:['one piece','marine'] },
  { id:'unc_phantom_thief',       name:'Phantom Thief',       rarity:'uncommon', theme:'Generic',        archetype:'rogue',    lore:'Takes things. Leaves confusion. Never caught.',                            cost:{manaStones:200},  source:'gacha',       tags:['thief','phantom'] },
  { id:'unc_shrine_warrior',      name:'Shrine Warrior',      rarity:'uncommon', theme:'Japanese',       archetype:'warrior',  lore:'Blessed by the gods. Armed by choice.',                                    cost:{manaStones:200},  source:'shop',        tags:['shrine','japanese'] },
  { id:'unc_dark_cleric',         name:'Dark Cleric',         rarity:'uncommon', theme:'Generic',        archetype:'support',  lore:'Heals allies. Does not ask where the power comes from.',                   cost:{manaStones:200},  source:'shop',        tags:['dark','cleric'] },
  { id:'unc_ronin_elite',         name:'Elite Ronin',         rarity:'uncommon', theme:'Japanese',       archetype:'warrior',  lore:'Found a cause. Deadlier for it.',                                          cost:{manaStones:200},  source:'shop',        tags:['ronin','elite'] },
  { id:'unc_rune_knight',         name:'Rune Knight',         rarity:'uncommon', theme:'Fantasy',        archetype:'warrior',  lore:'Magic on armour. Sword in hand. Best of both.',                            cost:{manaStones:200},  source:'shop',        tags:['rune','knight'] },
  { id:'unc_void_mage',           name:'Void Mage',           rarity:'uncommon', theme:'Solo Leveling',  archetype:'mage',     lore:'Draws magic from the space between things.',                               cost:{manaStones:200},  source:'gacha',       tags:['void','mage'] },
  { id:'unc_earth_shaker',        name:'Earth Shaker',        rarity:'uncommon', theme:'Generic',        archetype:'tank',     lore:'Every step leaves a crack in the ground.',                                 cost:{manaStones:200},  source:'shop',        tags:['earth','power'] },
  { id:'unc_blade_dancer',        name:'Blade Dancer',        rarity:'uncommon', theme:'Generic',        archetype:'rogue',    lore:'Fights like it\'s choreographed. It isn\'t. It just looks that way.',      cost:{manaStones:200},  source:'gacha',       tags:['dancer','blade'] },
  { id:'unc_plague_witch',        name:'Plague Witch',        rarity:'uncommon', theme:'Generic',        archetype:'mage',     lore:'Every potion is poison. Every poison is a gift.',                          cost:{manaStones:200},  source:'shop',        tags:['witch','poison'] },
  { id:'unc_titan_scout',         name:'Titan Scout',         rarity:'uncommon', theme:'AOT',            archetype:'rogue',    lore:'ODM gear mastered. Titans avoided. Mostly.',                               cost:{manaStones:200},  source:'shop',        tags:['aot','scout'] },
  { id:'unc_cursed_soldier',      name:'Cursed Soldier',      rarity:'uncommon', theme:'JJK',            archetype:'warrior',  lore:'Sorcerer-grade cursed energy. Soldier-grade loyalty.',                     cost:{manaStones:200},  source:'shop',        tags:['jjk','soldier'] },
  { id:'unc_wind_cutter',         name:'Wind Cutter',         rarity:'uncommon', theme:'Demon Slayer',   archetype:'warrior',  lore:'Blade meets air. Air loses.',                                              cost:{manaStones:200},  source:'shop',        tags:['demon slayer','speed'] },
  { id:'unc_wolf_warrior',        name:'Wolf Warrior',        rarity:'uncommon', theme:'Generic',        archetype:'warrior',  lore:'Raised by wolves. Slightly more civilised now.',                           cost:{manaStones:200},  source:'shop',        tags:['wolf','feral'] },
  { id:'unc_dusk_archer',         name:'Dusk Archer',         rarity:'uncommon', theme:'Generic',        archetype:'archer',   lore:'Best at dusk. Something about the light.',                                 cost:{manaStones:200},  source:'shop',        tags:['archer','dusk'] },
  { id:'unc_arcane_fist',         name:'Arcane Fist',         rarity:'uncommon', theme:'Generic',        archetype:'warrior',  lore:'Magic channelled through bare knuckles.',                                  cost:{manaStones:200},  source:'gacha',       tags:['magic','fist'] },
  { id:'unc_oni_heir',            name:'Oni Heir',            rarity:'uncommon', theme:'Re:Zero',        archetype:'warrior',  lore:'Half-demon lineage. Full demon fury when pushed.',                         cost:{manaStones:200},  source:'shop',        tags:['oni','demon'] },
  { id:'unc_nether_mage',         name:'Nether Mage',         rarity:'uncommon', theme:'Generic',        archetype:'mage',     lore:'Magic from below the earth. Dark and cold.',                               cost:{manaStones:200},  source:'shop',        tags:['nether','dark'] },
  { id:'unc_dragon_acolyte',      name:'Dragon Acolyte',      rarity:'uncommon', theme:'Generic',        archetype:'mage',     lore:'Studies dragons. Starts to resemble one.',                                 cost:{manaStones:200},  source:'gacha',       tags:['dragon','mage'] },
  { id:'unc_spectral_knight',     name:'Spectral Knight',     rarity:'uncommon', theme:'Generic',        archetype:'warrior',  lore:'Semi-translucent. Fully dangerous.',                                       cost:{manaStones:200},  source:'shop',        tags:['ghost','knight'] },
  { id:'unc_twin_blade',          name:'Twin Blade',          rarity:'uncommon', theme:'SAO',            archetype:'warrior',  lore:'Dual Blades — the rarest skill in the game.',                             cost:{manaStones:200},  source:'gacha',       tags:['sao','dual'] },
  { id:'unc_bone_breaker',        name:'Bone Breaker',        rarity:'uncommon', theme:'Generic',        archetype:'tank',     lore:'Self-explanatory.',                                                        cost:{manaStones:200},  source:'shop',        tags:['tank','brutal'] },
  { id:'unc_illusion_mage',       name:'Illusion Mage',       rarity:'uncommon', theme:'Naruto',         archetype:'mage',     lore:'What you see is what they want you to see.',                               cost:{manaStones:200},  source:'shop',        tags:['genjutsu','illusion'] },
  { id:'unc_crimson_guard',       name:'Crimson Guard',       rarity:'uncommon', theme:'Generic',        archetype:'tank',     lore:'The red armour has never been explained. Nobody asks.',                    cost:{manaStones:200},  source:'shop',        tags:['guard','crimson'] },
  { id:'unc_sky_dancer',          name:'Sky Dancer',          rarity:'uncommon', theme:'Generic',        archetype:'rogue',    lore:'Fights best at altitude.',                                                 cost:{manaStones:200},  source:'gacha',       tags:['aerial','dancer'] },
  { id:'unc_spider_silk',         name:'Spider Silk',         rarity:'uncommon', theme:'Generic',        archetype:'rogue',    lore:'Webs everything. Traps everything.',                                       cost:{manaStones:200},  source:'shop',        tags:['spider','trap'] },
  { id:'unc_wrath_priest',        name:'Wrath Priest',        rarity:'uncommon', theme:'Generic',        archetype:'support',  lore:'Heals. Then calls down holy fire. Sequence matters.',                      cost:{manaStones:200},  source:'shop',        tags:['priest','wrath'] },
  { id:'unc_frozen_samurai',      name:'Frozen Samurai',      rarity:'uncommon', theme:'Japanese',       archetype:'warrior',  lore:'Blade coated in eternal ice. Heart even colder.',                         cost:{manaStones:200},  source:'gacha',       tags:['samurai','ice'] },
  { id:'unc_hunter_b_rank',       name:'B-Rank Hunter',       rarity:'uncommon', theme:'Solo Leveling',  archetype:'warrior',  lore:'B-rank. Respectable. Wants S.',                                           cost:{manaStones:200},  source:'shop',        tags:['solo leveling','rank'] },
  { id:'unc_thunder_dancer',      name:'Thunder Dancer',      rarity:'uncommon', theme:'MHA',            archetype:'rogue',    lore:'Lightning trail follows every step.',                                      cost:{manaStones:200},  source:'shop',        tags:['mha','speed'] },
  { id:'unc_obsidian_blade',      name:'Obsidian Blade',      rarity:'uncommon', theme:'Generic',        archetype:'warrior',  lore:'Volcanic glass sword. Shatters enemies, never itself.',                   cost:{manaStones:200},  source:'gacha',       tags:['volcanic','blade'] },
  { id:'unc_hex_witch',           name:'Hex Witch',           rarity:'uncommon', theme:'Generic',        archetype:'mage',     lore:'Every hex lands. Every curse sticks.',                                     cost:{manaStones:200},  source:'shop',        tags:['witch','hex'] },

  // ══════════════════════════════════════════════════════════════
  // RARE — 40 skins  (strong design, visible power, bold colour)
  // ══════════════════════════════════════════════════════════════

  { id:'rare_shadow_monarch',     name:'Shadow Monarch',      rarity:'rare', theme:'Solo Leveling',  archetype:'special',  lore:'Arise. The command that changed everything.',                              cost:{manaStones:500},  source:'gacha',       tags:['solo leveling','shadow','monarch'] },
  { id:'rare_flame_pillar',       name:'Flame Pillar',        rarity:'rare', theme:'Demon Slayer',   archetype:'warrior',  lore:'Flame Breathing, Ninth Form — Rengoku.',                                   cost:{manaStones:500},  source:'gacha',       tags:['demon slayer','flame','hashira'] },
  { id:'rare_wind_hashira',       name:'Wind Hashira',        rarity:'rare', theme:'Demon Slayer',   archetype:'warrior',  lore:'The wind never stops. Neither do they.',                                   cost:{manaStones:500},  source:'gacha',       tags:['demon slayer','wind','hashira'] },
  { id:'rare_sound_hashira',      name:'Sound Hashira',       rarity:'rare', theme:'Demon Slayer',   archetype:'warrior',  lore:'Flamboyant. Explosive. Undeniably effective.',                             cost:{manaStones:500},  source:'gacha',       tags:['demon slayer','sound','hashira'] },
  { id:'rare_lightning_god',      name:'God of Lightning',    rarity:'rare', theme:'Naruto',         archetype:'warrior',  lore:'Raikage-level power. Zero patience.',                                      cost:{manaStones:500},  source:'gacha',       tags:['naruto','lightning','kage'] },
  { id:'rare_susanoo',            name:'Susano\'o',           rarity:'rare', theme:'Naruto',         archetype:'warrior',  lore:'The perfect warrior — colossal and absolute.',                             cost:{manaStones:500},  source:'gacha',       tags:['naruto','uchiha','susanoo'] },
  { id:'rare_gear_second',        name:'Gear Second',         rarity:'rare', theme:'One Piece',      archetype:'warrior',  lore:'Blood boils. Speed triples. Punch becomes legend.',                        cost:{manaStones:500},  source:'gacha',       tags:['one piece','luffy','gear'] },
  { id:'rare_haki_warrior',       name:'Haki Warrior',        rarity:'rare', theme:'One Piece',      archetype:'warrior',  lore:'Armament Haki coats every blow.',                                          cost:{manaStones:500},  source:'gacha',       tags:['one piece','haki'] },
  { id:'rare_cursed_king',        name:'Cursed King',         rarity:'rare', theme:'JJK',            archetype:'special',  lore:'Innate domain. Unlimited cursed energy.',                                  cost:{manaStones:500},  source:'gacha',       tags:['jjk','sukuna','cursed'] },
  { id:'rare_black_flash',        name:'Black Flash',         rarity:'rare', theme:'JJK',            archetype:'warrior',  lore:'Black Flash achieved. Power multiplied exponentially.',                    cost:{manaStones:500},  source:'gacha',       tags:['jjk','flash','power'] },
  { id:'rare_esper_class',        name:'Esper Class',         rarity:'rare', theme:'Mob Psycho',     archetype:'mage',     lore:'Psychic power at 99%. Holding back the rest.',                             cost:{manaStones:500},  source:'gacha',       tags:['mob psycho','esper','psychic'] },
  { id:'rare_chimera_ant',        name:'Chimera Ant',         rarity:'rare', theme:'HxH',            archetype:'warrior',  lore:'Evolved beyond humanity. Fights with Nen and instinct.',                   cost:{manaStones:500},  source:'gacha',       tags:['hxh','chimera','nen'] },
  { id:'rare_assassin_elite',     name:'Zoldyck Heir',        rarity:'rare', theme:'HxH',            archetype:'rogue',    lore:'Born to kill. Chosen not to. Usually.',                                    cost:{manaStones:500},  source:'gacha',       tags:['hxh','zoldyck','assassin'] },
  { id:'rare_grim_reaper',        name:'Grim Reaper',         rarity:'rare', theme:'Bleach',         archetype:'warrior',  lore:'Soul Society captain. Released bankai early.',                             cost:{manaStones:500},  source:'gacha',       tags:['bleach','captain','shinigami'] },
  { id:'rare_hollow',             name:'Hollow King',         rarity:'rare', theme:'Bleach',         archetype:'special',  lore:'The hollow within took the throne.',                                       cost:{manaStones:500},  source:'gacha',       tags:['bleach','hollow','vasto'] },
  { id:'rare_fullmetal',          name:'Fullmetal',           rarity:'rare', theme:'FMA',            archetype:'warrior',  lore:'Alchemy in both arms. Determination in both eyes.',                        cost:{manaStones:500},  source:'gacha',       tags:['fma','edward','alchemy'] },
  { id:'rare_homunculus',         name:'Homunculus',          rarity:'rare', theme:'FMA',            archetype:'special',  lore:'Born from the stone. Sins made flesh.',                                    cost:{manaStones:500},  source:'gacha',       tags:['fma','homunculus','sin'] },
  { id:'rare_s_rank_hunter',      name:'S-Rank Hunter',       rarity:'rare', theme:'Solo Leveling',  archetype:'warrior',  lore:'Top of the hunter hierarchy. Below only one.',                             cost:{manaStones:500},  source:'gacha',       tags:['solo leveling','s-rank'] },
  { id:'rare_reincarnated',       name:'Reincarnated',        rarity:'rare', theme:'Re:Zero',        archetype:'special',  lore:'Return by Death. Every failure is data.',                                  cost:{manaStones:500},  source:'gacha',       tags:['rezero','subaru','loop'] },
  { id:'rare_titan_shifter',      name:'Titan Shifter',       rarity:'rare', theme:'AOT',            archetype:'warrior',  lore:'Crystallised armour. Indestructible will.',                                cost:{manaStones:500},  source:'gacha',       tags:['aot','titan','shifter'] },
  { id:'rare_ackerman',           name:'Ackerman',            rarity:'rare', theme:'AOT',            archetype:'warrior',  lore:'Awakened power. One of the strongest ever born.',                          cost:{manaStones:500},  source:'gacha',       tags:['aot','ackerman','power'] },
  { id:'rare_dragon_slayer',      name:'Dragon Slayer',       rarity:'rare', theme:'Generic',        archetype:'warrior',  lore:'Has slain seventeen dragons. Counting.',                                   cost:{manaStones:500},  source:'gacha',       tags:['dragon','slayer'] },
  { id:'rare_time_mage',          name:'Time Mage',           rarity:'rare', theme:'Steins;Gate',    archetype:'mage',     lore:'Bends time. Pays the price.',                                              cost:{manaStones:500},  source:'gacha',       tags:['steins gate','time','mage'] },
  { id:'rare_infinity_user',      name:'Infinity User',       rarity:'rare', theme:'JJK',            archetype:'special',  lore:'Infinity is always on. Nothing reaches you.',                             cost:{manaStones:500},  source:'gacha',       tags:['jjk','gojo','infinity'] },
  { id:'rare_blood_hashira',      name:'Blood Hashira',       rarity:'rare', theme:'Demon Slayer',   archetype:'warrior',  lore:'Blood Breathing — a form thought lost forever.',                          cost:{manaStones:500},  source:'gacha',       tags:['demon slayer','blood','hashira'] },
  { id:'rare_void_sovereign',     name:'Void Sovereign',      rarity:'rare', theme:'Solo Leveling',  archetype:'special',  lore:'Commands the void. The void obeys.',                                      cost:{manaStones:500},  source:'gacha',       tags:['solo leveling','void','sovereign'] },
  { id:'rare_spirit_king',        name:'Spirit King',         rarity:'rare', theme:'Bleach',         archetype:'special',  lore:'Above Soul Society. Below none.',                                          cost:{manaStones:500},  source:'achievement', tags:['bleach','spirit king'] },
  { id:'rare_gear_fourth',        name:'Gear Fourth',         rarity:'rare', theme:'One Piece',      archetype:'warrior',  lore:'Boundman. Armament haki at maximum. Clock ticking.',                       cost:{manaStones:500},  source:'gacha',       tags:['one piece','luffy','gear4'] },
  { id:'rare_tailed_beast',       name:'Tailed Beast Cloak',  rarity:'rare', theme:'Naruto',         archetype:'special',  lore:'Full nine-tails chakra cloak. Overwhelming.',                              cost:{manaStones:500},  source:'gacha',       tags:['naruto','bijuu','cloak'] },
  { id:'rare_sorcerer_grade1',    name:'Grade 1 Sorcerer',    rarity:'rare', theme:'JJK',            archetype:'warrior',  lore:'Grade 1 — just below special grade. That gap is enormous.',               cost:{manaStones:500},  source:'gacha',       tags:['jjk','sorcerer','grade1'] },
  { id:'rare_pro_hero',           name:'Pro Hero',            rarity:'rare', theme:'MHA',            archetype:'warrior',  lore:'Number-ranked. Public loved. Enemies feared.',                             cost:{manaStones:500},  source:'gacha',       tags:['mha','hero','pro'] },
  { id:'rare_nen_master',         name:'Nen Master',          rarity:'rare', theme:'HxH',            archetype:'mage',     lore:'All four properties mastered. Specialist category.',                       cost:{manaStones:500},  source:'gacha',       tags:['hxh','nen','master'] },
  { id:'rare_chimera_queen',      name:'Chimera Queen',       rarity:'rare', theme:'HxH',            archetype:'special',  lore:'Born of the ant queen. Evolved beyond measure.',                          cost:{manaStones:500},  source:'achievement', tags:['hxh','queen','chimera'] },
  { id:'rare_stone_world',        name:'Stone World',         rarity:'rare', theme:'Dr. Stone',      archetype:'mage',     lore:'Science is the ultimate power.',                                           cost:{manaStones:500},  source:'gacha',       tags:['dr stone','science','senku'] },
  { id:'rare_winter_general',     name:'Winter General',      rarity:'rare', theme:'AOT',            archetype:'warrior',  lore:'Marleyan warrior. First generation. Devastating.',                         cost:{manaStones:500},  source:'gacha',       tags:['aot','warrior','marley'] },
  { id:'rare_chaos_demon',        name:'Chaos Demon',         rarity:'rare', theme:'Chainsaw Man',   archetype:'special',  lore:'Chaotic power. Impossible to control. Effective.',                         cost:{manaStones:500},  source:'gacha',       tags:['chainsaw man','demon','chaos'] },
  { id:'rare_devil_contract',     name:'Devil Contract',      rarity:'rare', theme:'Chainsaw Man',   archetype:'warrior',  lore:'Contracted with a devil. The price is paid in blood.',                    cost:{manaStones:500},  source:'gacha',       tags:['chainsaw man','devil','contract'] },
  { id:'rare_phantom_thief_s',    name:'Phantom Thief S',     rarity:'rare', theme:'Generic',        archetype:'rogue',    lore:'Special grade thief. Steals things that shouldn\'t be stealable.',        cost:{manaStones:500},  source:'gacha',       tags:['thief','special'] },
  { id:'rare_dragon_knight',      name:'Dragon Knight Elite', rarity:'rare', theme:'Generic',        archetype:'warrior',  lore:'Bonded with a dragon. Two wills, one body.',                              cost:{manaStones:500},  source:'gacha',       tags:['dragon','knight'] },
  { id:'rare_sea_emperor',        name:'Sea Emperor',         rarity:'rare', theme:'One Piece',      archetype:'special',  lore:'One of four emperors. The ocean bows.',                                    cost:{manaStones:500},  source:'achievement', tags:['one piece','yonko','emperor'] },

  // ══════════════════════════════════════════════════════════════
  // EPIC — 40 skins  (complex design, unique visual motif, aura)
  // ══════════════════════════════════════════════════════════════

  { id:'epic_igris',              name:'Igris the Red',       rarity:'epic', theme:'Solo Leveling',  archetype:'warrior',  lore:'The red knight. Monarch\'s most loyal shadow soldier.',                  cost:{manaStones:1200}, source:'gacha',       tags:['solo leveling','shadow','red knight'] },
  { id:'epic_beru',               name:'Beru the Ant',        rarity:'epic', theme:'Solo Leveling',  archetype:'warrior',  lore:'Marshal-grade ant general. "Your wish is my command, my king."',        cost:{manaStones:1200}, source:'gacha',       tags:['solo leveling','ant','beru'] },
  { id:'epic_sukuna_4fingers',    name:'Sukuna Four Fingers',rarity:'epic',  theme:'JJK',            archetype:'special',  lore:'Four fingers — already impossible to stop.',                              cost:{manaStones:1200}, source:'gacha',       tags:['jjk','sukuna','fingers'] },
  { id:'epic_gojo_blindfolded',   name:'Blindfolded Gojo',    rarity:'epic', theme:'JJK',            archetype:'special',  lore:'Eyes covered. Six Eyes still see everything.',                            cost:{manaStones:1200}, source:'gacha',       tags:['jjk','gojo','blindfold'] },
  { id:'epic_zenitsu_sleep',      name:'Asleep Zenitsu',      rarity:'epic', theme:'Demon Slayer',   archetype:'warrior',  lore:'Asleep. Godspeed active. No one survives the first flash.',               cost:{manaStones:1200}, source:'gacha',       tags:['demon slayer','zenitsu','thunder'] },
  { id:'epic_akaza',              name:'Akaza Upper Moon 3',  rarity:'epic', theme:'Demon Slayer',   archetype:'warrior',  lore:'Upper moon 3. Destruction Style — Compass Needle.',                       cost:{manaStones:1200}, source:'gacha',       tags:['demon slayer','upper moon','akaza'] },
  { id:'epic_doma',               name:'Doma Upper Moon 2',   rarity:'epic', theme:'Demon Slayer',   archetype:'special',  lore:'Ice blooms. Devotees fall. Upper Moon 2 advances.',                       cost:{manaStones:1200}, source:'gacha',       tags:['demon slayer','upper moon','doma'] },
  { id:'epic_killua_godspeed',    name:'Godspeed Killua',     rarity:'epic', theme:'HxH',            archetype:'rogue',    lore:'Godspeed activated. Faster than the eye. Faster than thought.',           cost:{manaStones:1200}, source:'gacha',       tags:['hxh','killua','godspeed'] },
  { id:'epic_netero',             name:'Chairman Netero',     rarity:'epic', theme:'HxH',            archetype:'mage',     lore:'Hundred-Type Guanyin Bodhisattva. Beyond comprehension.',                 cost:{manaStones:1200}, source:'gacha',       tags:['hxh','netero','guanyin'] },
  { id:'epic_yhwach',             name:'Yhwach',              rarity:'epic', theme:'Bleach',          archetype:'special',  lore:'The Almighty. Every future belongs to him.',                              cost:{manaStones:1200}, source:'gacha',       tags:['bleach','quincy','yhwach'] },
  { id:'epic_aizen',              name:'Aizen Transcendent',  rarity:'epic', theme:'Bleach',          archetype:'special',  lore:'Hogyoku absorbed. Transcended shinigami and hollow.',                     cost:{manaStones:1200}, source:'gacha',       tags:['bleach','aizen','hogyoku'] },
  { id:'epic_madara',             name:'Madara Uchiha',       rarity:'epic', theme:'Naruto',          archetype:'special',  lore:'Six Paths Sage. Limbo. Absolute power reclaimed.',                        cost:{manaStones:1200}, source:'gacha',       tags:['naruto','madara','six paths'] },
  { id:'epic_kaguya',             name:'Kaguya',              rarity:'epic', theme:'Naruto',          archetype:'special',  lore:'The original. All chakra traces back to her.',                            cost:{manaStones:1200}, source:'gacha',       tags:['naruto','kaguya','goddess'] },
  { id:'epic_gear5',              name:'Gear Fifth',          rarity:'epic', theme:'One Piece',       archetype:'special',  lore:'Sun God Nika. The freest power in the world.',                            cost:{manaStones:1200}, source:'gacha',       tags:['one piece','luffy','gear5','nika'] },
  { id:'epic_shanks',             name:'Red-Haired',          rarity:'epic', theme:'One Piece',       archetype:'warrior',  lore:'Conqueror\'s Haki alone stops fleets.',                                   cost:{manaStones:1200}, source:'gacha',       tags:['one piece','shanks','haki'] },
  { id:'epic_whitebeard',         name:'Whitebeard',          rarity:'epic', theme:'One Piece',       archetype:'warrior',  lore:'The world\'s strongest. Quake fruit shook the world.',                   cost:{manaStones:1200}, source:'gacha',       tags:['one piece','whitebeard','tremor'] },
  { id:'epic_reigen_aura',        name:'Reigen Aura',         rarity:'epic', theme:'Mob Psycho',      archetype:'special',  lore:'"I am the greatest psychic of the 21st century." He believes it.',        cost:{manaStones:1200}, source:'gacha',       tags:['mob psycho','reigen','aura'] },
  { id:'epic_mob_100pct',         name:'Mob at 100%',         rarity:'epic', theme:'Mob Psycho',      archetype:'special',  lore:'100%. There is no ceiling above this.',                                   cost:{manaStones:1200}, source:'gacha',       tags:['mob psycho','mob','100'] },
  { id:'epic_lelouch',            name:'Zero',                rarity:'epic', theme:'Code Geass',      archetype:'special',  lore:'Geass of absolute obedience. Strategy of absolute victory.',             cost:{manaStones:1200}, source:'gacha',       tags:['code geass','lelouch','zero'] },
  { id:'epic_saitama',            name:'Caped Baldy',         rarity:'epic', theme:'One Punch Man',   archetype:'warrior',  lore:'One punch. Every time. The training was simple.',                         cost:{manaStones:1200}, source:'gacha',       tags:['opm','saitama','one punch'] },
  { id:'epic_garou_cosmic',       name:'Cosmic Garou',        rarity:'epic', theme:'One Punch Man',   archetype:'warrior',  lore:'Cosmic fear mode. Awakened beyond human limits.',                         cost:{manaStones:1200}, source:'gacha',       tags:['opm','garou','cosmic'] },
  { id:'epic_levi',               name:'Captain Levi',        rarity:'epic', theme:'AOT',             archetype:'rogue',    lore:'Humanity\'s strongest. ODM mastery — unmatched.',                         cost:{manaStones:1200}, source:'gacha',       tags:['aot','levi','strongest'] },
  { id:'epic_eren_founding',      name:'Founding Titan',      rarity:'epic', theme:'AOT',             archetype:'special',  lore:'Rumbling activated. The world shivers.',                                   cost:{manaStones:1200}, source:'gacha',       tags:['aot','eren','founding','rumbling'] },
  { id:'epic_meruem',             name:'Meruem',              rarity:'epic', theme:'HxH',             archetype:'special',  lore:'Perfected Nen. King of the Chimera Ants. Unchallenged.',                  cost:{manaStones:1200}, source:'gacha',       tags:['hxh','meruem','king'] },
  { id:'epic_gon_adult',          name:'Adult Gon',           rarity:'epic', theme:'HxH',             archetype:'warrior',  lore:'All potential sacrificed for one moment of absolute power.',              cost:{manaStones:1200}, source:'gacha',       tags:['hxh','gon','sacrifice'] },
  { id:'epic_demon_lord',         name:'Demon Lord Form',     rarity:'epic', theme:'Generic',         archetype:'special',  lore:'True form revealed. The hierarchy of demons ends here.',                  cost:{manaStones:1200}, source:'gacha',       tags:['demon','lord','true form'] },
  { id:'epic_dragon_emperor',     name:'Dragon Emperor',      rarity:'epic', theme:'Generic',         archetype:'special',  lore:'Dragon scales fused with the body. Fire breathes from within.',           cost:{manaStones:1200}, source:'gacha',       tags:['dragon','emperor','scales'] },
  { id:'epic_undead_king',        name:'Undead King',         rarity:'epic', theme:'Overlord',        archetype:'special',  lore:'Ainz Ooal Gown. Ruler of the Great Tomb of Nazarick.',                    cost:{manaStones:1200}, source:'gacha',       tags:['overlord','undead','ainz'] },
  { id:'epic_rimuru',             name:'Slime Sovereign',     rarity:'epic', theme:'That Time I Got Reincarnated',  archetype:'special', lore:'Absorbed all powers. Now rules as Demon Lord.',           cost:{manaStones:1200}, source:'gacha',       tags:['rimuru','slime','demon lord'] },
  { id:'epic_giyu',               name:'Water Hashira',       rarity:'epic', theme:'Demon Slayer',    archetype:'warrior',  lore:'Water Breathing, Eleventh Form — Dead Calm.',                             cost:{manaStones:1200}, source:'gacha',       tags:['demon slayer','giyu','water hashira'] },
  { id:'epic_deku_100',           name:'Deku Full Cowl 100%', rarity:'epic', theme:'MHA',             archetype:'warrior',  lore:'One For All at 100%. Detroit Smash — world shaking.',                    cost:{manaStones:1200}, source:'gacha',       tags:['mha','deku','full cowl'] },
  { id:'epic_shigaraki',          name:'Shigaraki Awakened',  rarity:'epic', theme:'MHA',             archetype:'special',  lore:'Decay. Everything crumbles at the touch.',                                cost:{manaStones:1200}, source:'gacha',       tags:['mha','shigaraki','decay'] },
  { id:'epic_law',                name:'Surgeon of Death',    rarity:'epic', theme:'One Piece',       archetype:'special',  lore:'ROOM. Anything inside can be rearranged.',                                cost:{manaStones:1200}, source:'gacha',       tags:['one piece','law','room'] },
  { id:'epic_zoro_king',          name:'King of Hell',        rarity:'epic', theme:'One Piece',       archetype:'warrior',  lore:'Three swords. Supreme King Haki. Asura manifested.',                     cost:{manaStones:1200}, source:'gacha',       tags:['one piece','zoro','asura'] },
  { id:'epic_sanji_ifrit',        name:'Ifrit Jambe',         rarity:'epic', theme:'One Piece',       archetype:'warrior',  lore:'Ifrit Jambe — raid suit fused with genetic modification.',                cost:{manaStones:1200}, source:'gacha',       tags:['one piece','sanji','ifrit'] },
  { id:'epic_rayleigh',           name:'Dark King',           rarity:'epic', theme:'One Piece',       archetype:'warrior',  lore:'Conqueror\'s Haki master. Roger\'s right hand.',                          cost:{manaStones:1200}, source:'gacha',       tags:['one piece','rayleigh','dark king'] },
  { id:'epic_void_beast',         name:'Void Beast',          rarity:'epic', theme:'Solo Leveling',   archetype:'special',  lore:'Born from the void between gates. Not human. Not monster.',              cost:{manaStones:1200}, source:'achievement', tags:['solo leveling','void','beast'] },
  { id:'epic_sung_jinwoo',        name:'Sung Jin-Woo',        rarity:'epic', theme:'Solo Leveling',   archetype:'warrior',  lore:'The Weakest Hunter. Then the strongest being on Earth.',                 cost:{manaStones:1200}, source:'gacha',       tags:['solo leveling','jinwoo','monarch'] },
  { id:'epic_shadow_exchange',    name:'Shadow Exchange',     rarity:'epic', theme:'Solo Leveling',   archetype:'special',  lore:'Exchange complete. Two monarchs\' power, one vessel.',                   cost:{manaStones:1200}, source:'achievement', tags:['solo leveling','exchange','monarch'] },
  { id:'epic_time_vessel',        name:'Time Vessel',         rarity:'epic', theme:'Generic',         archetype:'special',  lore:'Contains every timeline they\'ve ever lived.',                            cost:{manaStones:1200}, source:'gacha',       tags:['time','vessel','loops'] },
  { id:'epic_perfect_cell',       name:'Perfect Form',        rarity:'epic', theme:'Dragon Ball',     archetype:'special',  lore:'Perfection achieved. Perfect Cell smiles.',                               cost:{manaStones:1200}, source:'gacha',       tags:['dragon ball','cell','perfect'] },

  // ══════════════════════════════════════════════════════════════
  // LEGENDARY — 20 skins  (iconic, fully realised, particle effects)
  // ══════════════════════════════════════════════════════════════

  { id:'leg_monarch_arise',       name:'Monarch of Shadows',  rarity:'legendary', theme:'Solo Leveling',  archetype:'special',  lore:'Every shadow on Earth kneels. This is what absolute authority looks like.',   cost:{manaStones:3500}, source:'gacha',       tags:['solo leveling','monarch','arise'] },
  { id:'leg_muzan',               name:'Demon King Muzan',    rarity:'legendary', theme:'Demon Slayer',   archetype:'special',  lore:'Original demon. Blood flows as naturally as commands.',                        cost:{manaStones:3500}, source:'gacha',       tags:['demon slayer','muzan','demon king'] },
  { id:'leg_ryomen_sukuna',       name:'Ryomen Sukuna',       rarity:'legendary', theme:'JJK',            archetype:'special',  lore:'The King of Curses. Malevolent Shrine — Cleave everything.',                   cost:{manaStones:3500}, source:'gacha',       tags:['jjk','sukuna','king of curses'] },
  { id:'leg_hagoromo',            name:'Sage of Six Paths',   rarity:'legendary', theme:'Naruto',         archetype:'special',  lore:'Creator of ninjutsu. First wielder of all chakra. Father of peace.',           cost:{manaStones:3500}, source:'gacha',       tags:['naruto','hagoromo','sage','six paths'] },
  { id:'leg_roger',               name:'Pirate King',         rarity:'legendary', theme:'One Piece',      archetype:'special',  lore:'"I\'ll give it to whoever finds it." The greatest pirate who ever lived.',      cost:{manaStones:3500}, source:'gacha',       tags:['one piece','roger','king'] },
  { id:'leg_ichigo_final',        name:'True Bankai Ichigo',  rarity:'legendary', theme:'Bleach',         archetype:'special',  lore:'True Zangetsu. Merged hollow and shinigami. Unstoppable.',                     cost:{manaStones:3500}, source:'gacha',       tags:['bleach','ichigo','bankai','true'] },
  { id:'leg_zeno',                name:'Omni-King',           rarity:'legendary', theme:'Dragon Ball',    archetype:'special',  lore:'King of all kings. Erased universes with a thought. Smiled.',                  cost:{manaStones:3500}, source:'gacha',       tags:['dragon ball','zeno','omni king'] },
  { id:'leg_ultra_instinct',      name:'Ultra Instinct Goku', rarity:'legendary', theme:'Dragon Ball',    archetype:'special',  lore:'The technique even the gods struggle to master. Mastered.',                    cost:{manaStones:3500}, source:'gacha',       tags:['dragon ball','goku','ultra instinct'] },
  { id:'leg_beerus',              name:'God of Destruction',  rarity:'legendary', theme:'Dragon Ball',    archetype:'special',  lore:'Hakai. Existence erased. Purple flames of divine destruction.',                cost:{manaStones:3500}, source:'gacha',       tags:['dragon ball','beerus','hakai'] },
  { id:'leg_toji',                name:'Sorcerer Killer',     rarity:'legendary', theme:'JJK',            archetype:'warrior',  lore:'No cursed energy. No weakness. The heavenly restriction is a gift.',           cost:{manaStones:3500}, source:'gacha',       tags:['jjk','toji','sorcerer killer'] },
  { id:'leg_gon_peak',            name:'Gon Peak Power',      rarity:'legendary', theme:'HxH',            archetype:'special',  lore:'Adult Gon — all of what he could be given at once. Tragic. Absolute.',         cost:{manaStones:3500}, source:'gacha',       tags:['hxh','gon','peak','sacrifice'] },
  { id:'leg_muichiro',            name:'Mist Hashira',        rarity:'legendary', theme:'Demon Slayer',   archetype:'warrior',  lore:'Mist Breathing, Seventh Form — Obscuring Clouds. Demon mark activated.',       cost:{manaStones:3500}, source:'gacha',       tags:['demon slayer','muichiro','mist'] },
  { id:'leg_void_monarch',        name:'Void Monarch',        rarity:'legendary', theme:'Solo Leveling',  archetype:'special',  lore:'Ruler of the void. Commands both sides of life and death.',                    cost:{manaStones:3500}, source:'gacha',       tags:['solo leveling','void','monarch'] },
  { id:'leg_esdeath',             name:'Esdeath',             rarity:'legendary', theme:'Akame ga Kill',  archetype:'special',  lore:'Ice over everything. The strongest in the empire. Cold without limits.',       cost:{manaStones:3500}, source:'gacha',       tags:['akame ga kill','esdeath','ice'] },
  { id:'leg_gilgamesh',           name:'King of Heroes',      rarity:'legendary', theme:'Fate',           archetype:'special',  lore:'Gate of Babylon opens. Every Noble Phantasm is his to command.',              cost:{manaStones:3500}, source:'gacha',       tags:['fate','gilgamesh','gate of babylon'] },
  { id:'leg_emiya',               name:'Archer EMIYA',        rarity:'legendary', theme:'Fate',           archetype:'archer',   lore:'I am the bone of my sword. Unlimited Blade Works deployed.',                  cost:{manaStones:3500}, source:'gacha',       tags:['fate','emiya','unlimited blade works'] },
  { id:'leg_darkness_monarch',    name:'Darkness Monarch',    rarity:'legendary', theme:'Solo Leveling',  archetype:'special',  lore:'The true king of all monarchs. Shadow and light bow equally.',                cost:{manaStones:3500}, source:'achievement', tags:['solo leveling','darkness','monarch'] },
  { id:'leg_final_form_vegeta',   name:'Ultra Ego Vegeta',    rarity:'legendary', theme:'Dragon Ball',    archetype:'warrior',  lore:'Ultra Ego — embraces destruction. Grows stronger as damage increases.',        cost:{manaStones:3500}, source:'gacha',       tags:['dragon ball','vegeta','ultra ego'] },
  { id:'leg_kenpachi',            name:'Kenpachi Unleashed',  rarity:'legendary', theme:'Bleach',         archetype:'warrior',  lore:'Zaraki with eyepatch removed, Yachiru revealed, bankai awakened.',            cost:{manaStones:3500}, source:'gacha',       tags:['bleach','kenpachi','zaraki','bankai'] },
  { id:'leg_will_of_d',           name:'Will of D',           rarity:'legendary', theme:'One Piece',      archetype:'special',  lore:'The initial D. A name the Celestial Dragons fear. A will that never dies.',   cost:{manaStones:3500}, source:'achievement', tags:['one piece','will','d','dynasty'] },

  // ══════════════════════════════════════════════════════════════
  // MYTHIC — 10 skins  (transcendent, unique frame effects, animated glow)
  // ══════════════════════════════════════════════════════════════

  { id:'mythic_shadow_king',      name:'Shadow King',         rarity:'mythic', theme:'Solo Leveling',  archetype:'special',  lore:'You stand before the Monarch of Shadows. Every shadow he commands. Every army answers.',          cost:null,            source:'gacha',       tags:['solo leveling','monarch','shadow king','transcendent'] },
  { id:'mythic_void_god',         name:'Void God',            rarity:'mythic', theme:'Generic',        archetype:'special',  lore:'Before the universe there was the void. This is its personification.',                          cost:null,            source:'gacha',       tags:['void','god','creation','transcendent'] },
  { id:'mythic_demon_king_true',  name:'True Demon King',     rarity:'mythic', theme:'Demon Slayer',   archetype:'special',  lore:'Muzan at absolute peak. The original demon in true final form.',                               cost:null,            source:'gacha',       tags:['demon slayer','muzan','true form','mythic'] },
  { id:'mythic_all_for_one',      name:'All For One',         rarity:'mythic', theme:'MHA',            archetype:'special',  lore:'Every quirk that ever existed. Every power stolen across centuries.',                          cost:null,            source:'gacha',       tags:['mha','all for one','quirk','mythic'] },
  { id:'mythic_infinite_sukuna', name:'Sukuna Unlimited',     rarity:'mythic', theme:'JJK',            archetype:'special',  lore:'All twenty fingers. Malevolent Shrine at maximum range. The cursed world ends here.',           cost:null,            source:'gacha',       tags:['jjk','sukuna','twenty fingers','mythic'] },
  { id:'mythic_true_ultra',       name:'Perfected Ultra Instinct', rarity:'mythic', theme:'Dragon Ball', archetype:'special', lore:'Not the technique — the state. Mastered. Every attack, every defence, without thought.',       cost:null,            source:'gacha',       tags:['dragon ball','goku','ultra instinct','perfected','mythic'] },
  { id:'mythic_world_ender',      name:'World Ender',         rarity:'mythic', theme:'Generic',        archetype:'special',  lore:'There are things that exist at the end of all things. This is one of them.',                   cost:null,            source:'achievement', tags:['world','end','transcendent','mythic'] },
  { id:'mythic_gate_sovereign',   name:'Gate Sovereign',      rarity:'mythic', theme:'Solo Leveling',  archetype:'special',  lore:'Does not pass through gates. Gates open for them.',                                           cost:null,            source:'achievement', tags:['gate','sovereign','solo leveling','mythic'] },
  { id:'mythic_sin_incarnate',    name:'Sin Incarnate',       rarity:'mythic', theme:'FMA',            archetype:'special',  lore:'Every sin. Every human failing. Embodied in one perfect form.',                               cost:null,            source:'gacha',       tags:['fma','sin','homunculus','mythic'] },
  { id:'mythic_origin',           name:'The Origin',          rarity:'mythic', theme:'Generic',        archetype:'special',  lore:'Before any anime. Before any world. The first fighter. The only one who was always here.',     cost:null,            source:'achievement', tags:['origin','first','mythic','transcendent'] },

];

// ── Lookup helpers ─────────────────────────────────────────────────────────────

const SKIN_MAP = Object.fromEntries(SKINS.map(s => [s.id, s]));

function getSkin(id) {
  return SKIN_MAP[id] || null;
}

function getSkinsByRarity(rarity) {
  return SKINS.filter(s => s.rarity === rarity);
}

function getSkinsBySource(source) {
  return SKINS.filter(s => s.source === source);
}

function getGachaSkins() {
  return SKINS.filter(s => s.source === 'gacha' || s.source === 'shop');
}

function getAllSkinIds() {
  return SKINS.map(s => s.id);
}

// ── Rarity weights for gacha ───────────────────────────────────────────────────
const GACHA_WEIGHTS = {
  common:    0.00,  // Common skins are shop-only, not in gacha pool
  uncommon:  40.0,
  rare:      30.0,
  epic:      20.0,
  legendary:  8.0,
  mythic:     2.0,
};

// Gacha pool — only gacha-eligible skins
const GACHA_POOL = SKINS.filter(s => s.source === 'gacha');

const GACHA_POOL_BY_RARITY = {
  uncommon:  GACHA_POOL.filter(s => s.rarity === 'uncommon'),
  rare:      GACHA_POOL.filter(s => s.rarity === 'rare'),
  epic:      GACHA_POOL.filter(s => s.rarity === 'epic'),
  legendary: GACHA_POOL.filter(s => s.rarity === 'legendary'),
  mythic:    GACHA_POOL.filter(s => s.rarity === 'mythic'),
};

/**
 * Pull a random rarity based on weights.
 */
function rollRarity() {
  const roll = Math.random() * 100;
  let acc = 0;
  for (const [rarity, weight] of Object.entries(GACHA_WEIGHTS)) {
    if (weight === 0) continue;
    acc += weight;
    if (roll < acc) return rarity;
  }
  return 'uncommon';
}

/**
 * Pull a random skin from the gacha pool.
 * @param {string[]} ownedIds  — player's already-owned skin IDs (avoids dupes if possible)
 * @param {boolean}  pity      — if true, guarantees at least legendary
 */
function pullGacha(ownedIds = [], pity = false) {
  const rarity   = pity ? (Math.random() < 0.2 ? 'mythic' : 'legendary') : rollRarity();
  const pool     = GACHA_POOL_BY_RARITY[rarity] || GACHA_POOL_BY_RARITY.uncommon;
  const unowned  = pool.filter(s => !ownedIds.includes(s.id));
  const source   = unowned.length > 0 ? unowned : pool;
  return source[Math.floor(Math.random() * source.length)];
}

// ── Rarity display helpers ─────────────────────────────────────────────────────
const RARITY_EMOJI = {
  common:    '⚪',
  uncommon:  '🟢',
  rare:      '🔵',
  epic:      '🟣',
  legendary: '🟡',
  mythic:    '🔴',
};

const RARITY_LABEL = {
  common:    'Common',
  uncommon:  'Uncommon',
  rare:      'Rare',
  epic:      'Epic',
  legendary: 'Legendary',
  mythic:    'Mythic',
};

const RARITY_COUNTS = {
  common: 70, uncommon: 50, rare: 40, epic: 40, legendary: 20, mythic: 10,
};

module.exports = {
  SKINS,
  SKIN_MAP,
  GACHA_WEIGHTS,
  GACHA_POOL,
  GACHA_POOL_BY_RARITY,
  RARITY_EMOJI,
  RARITY_LABEL,
  RARITY_COUNTS,
  getSkin,
  getSkinsByRarity,
  getSkinsBySource,
  getGachaSkins,
  getAllSkinIds,
  rollRarity,
  pullGacha,
};
