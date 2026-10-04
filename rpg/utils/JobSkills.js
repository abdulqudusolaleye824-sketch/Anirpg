'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Push #96h-z19 — JOB SKILLS (3 per job, 20 jobs = 60 skills)
//   • Every job carries THREE skills: a SUPPORT art, a STRIKE and a SIGNATURE.
//   • They unlock as the job levels (Job Lv1 / Lv2 / Lv4) and grow with every
//     job level after that — the TIER of a skill = jobLv - unlock + 1 (1..5).
//   • Usable ONLY while that job is your ACTIVE job (switch job → its skills
//     fall silent until you return; their tier is remembered per job level).
//   • They flow through the same contract every engine already honours
//     (SkillCatalog.resolveSkill → entry: damagePct / buffs / debuffs /
//     statuses / shieldPct / regen / damageTakenPct / reflectPct / immuneTurns),
//     so /skill, /attack <skill>, gate raids, instances, PvP and Jeju all
//     accept them by NAME or via /jobskill <n>.
// ═══════════════════════════════════════════════════════════════════════════
const JS = require('./JobSystem');

const UNLOCKS = [1, 2, 4]; // support, strike, signature
const t = (base, step) => (T) => Math.round(base + step * (T - 1)); // tier 1..5 scaling

// Each job: [support, strike, signature]. `fx(T)` returns contract fields for tier T.
const CATALOG = {
  wolf_assassin: [
    { key: 'lupine_dash', name: 'Lupine Dash', kind: 'support', cost: 35, cd: 4,
      lore: 'The wolf does not run — it arrives. You fold the distance between you and your prey into a single breath.',
      text: (T) => `+${t(100, 25)(T)}% SPD and +${t(10, 5)(T)}% crit chance for 3 turns`,
      fx: (T) => ({ buffs: [{ stat: 'speed', amount: t(100, 25)(T), duration: 3 }, { stat: 'critChance', amount: t(10, 5)(T), duration: 3 }] }) },
    { key: 'wolf_bite', name: "Wolf's Bite", kind: 'attack', cost: 45, cd: 3,
      lore: 'Fangs find the artery first. A wound the prey carries to the end of the hunt.',
      text: (T) => `${t(190, 35)(T)}% ATK — bleeds ${T >= 3 ? 'heavily ' : ''}for 3 turns`,
      fx: (T) => ({ damagePct: t(190, 35)(T), statuses: [{ type: 'bleed', chance: t(70, 7)(T), duration: 3 }] }) },
    { key: 'fenrir_hunt', name: "Fenrir's Hunt", kind: 'special', cost: 70, cd: 6,
      lore: 'The old wolf-god hunted the sun. You settle for whatever bleeds in front of you.',
      text: (T) => `${t(260, 45)(T)}% ATK, +50% vs targets under 35% HP, -${t(15, 5)(T)}% enemy DEF for 3 turns`,
      fx: (T) => ({ damagePct: t(260, 45)(T), executeBonus: 50, debuffs: [{ stat: 'def', amount: t(15, 5)(T), duration: 3 }] }) },
  ],
  brawler: [
    { key: 'iron_guard', name: 'Iron Guard', kind: 'support', cost: 30, cd: 4,
      lore: 'No shield, no armour — just forearms that have stopped a thousand fists.',
      text: (T) => `Take ${t(25, 7)(T)}% less damage and +${t(20, 8)(T)}% DEF for 3 turns`,
      fx: (T) => ({ damageTakenPct: t(25, 7)(T), damageTakenTurns: 3, buffs: [{ stat: 'def', amount: t(20, 8)(T), duration: 3 }] }) },
    { key: 'haymaker', name: 'Haymaker', kind: 'attack', cost: 40, cd: 3,
      lore: 'Wind it up from the heel. The street taught you that the first punch is the only one that counts.',
      text: (T) => `${t(200, 35)(T)}% ATK, ${t(25, 8)(T)}% chance to STUN`,
      fx: (T) => ({ damagePct: t(200, 35)(T), statuses: [{ type: 'stun', chance: t(25, 8)(T), duration: 2 }] }) },
    { key: 'fighting_spirit', name: 'Fighting Spirit', kind: 'special', cost: 60, cd: 6,
      lore: 'Knocked down nine times. The tenth time you stand, the crowd goes quiet.',
      text: (T) => `+${t(30, 10)(T)}% ATK for 4 turns, regenerate ${t(4, 1)(T)}% HP/turn, ${T >= 3 ? 'reflect ' + t(10, 5)(T) + '% damage' : 'and steady your footing'}`,
      fx: (T) => ({ buffs: [{ stat: 'atk', amount: t(30, 10)(T), duration: 4 }], regen: { pct: t(4, 1)(T), turns: 4 }, reflectPct: T >= 3 ? t(10, 5)(T) : 0, reflectTurns: 4 }) },
  ],
  bounty_hunter: [
    { key: 'hunters_mark', name: "Hunter's Mark", kind: 'support', cost: 30, cd: 4,
      lore: 'A chalk cross on the door, a name in the ledger. Marked men do not escape the Guild.',
      text: (T) => `Target takes +${t(20, 6)(T)}% damage and loses ${t(10, 4)(T)}% SPD for 3 turns`,
      fx: (T) => ({ damagePct: 0, debuffs: [{ stat: 'damageTaken', amount: t(20, 6)(T), duration: 3 }, { stat: 'speed', amount: t(10, 4)(T), duration: 3 }], utility: true }) },
    { key: 'bolt_volley', name: 'Bolt Volley', kind: 'attack', cost: 45, cd: 3,
      lore: 'Three bolts, one breath. The second is for the target that dodged the first.',
      text: (T) => `${t(185, 32)(T)}% ATK, ${t(30, 8)(T)}% chance to BLIND for 2 turns`,
      fx: (T) => ({ damagePct: t(185, 32)(T), statuses: [{ type: 'blind', chance: t(30, 8)(T), duration: 2 }] }) },
    { key: 'dead_or_alive', name: 'Dead or Alive', kind: 'special', cost: 75, cd: 6,
      lore: 'The poster never said which. You have always preferred the cheaper option.',
      text: (T) => `${t(250, 45)(T)}% ATK, +${t(30, 10)(T)}% vs elites & bosses, -${t(20, 5)(T)}% enemy DEF 3 turns`,
      fx: (T) => ({ damagePct: t(250, 45)(T), eliteBonus: t(30, 10)(T), debuffs: [{ stat: 'def', amount: t(20, 5)(T), duration: 3 }] }) },
  ],
  beast_tamer: [
    { key: 'wild_bond', name: 'Wild Bond', kind: 'support', cost: 35, cd: 4,
      lore: 'You share breath with the beast beside you. What it feels, you feel; what you decide, it does.',
      text: (T) => `+${t(25, 8)(T)}% ATK and +${t(15, 6)(T)}% DEF for 3 turns; regenerate ${t(3, 1)(T)}% HP/turn`,
      fx: (T) => ({ buffs: [{ stat: 'atk', amount: t(25, 8)(T), duration: 3 }, { stat: 'def', amount: t(15, 6)(T), duration: 3 }], regen: { pct: t(3, 1)(T), turns: 3 } }) },
    { key: 'pack_lunge', name: 'Pack Lunge', kind: 'attack', cost: 45, cd: 3,
      lore: 'The pack moves as one throat. The prey never sees which set of teeth closes first.',
      text: (T) => `${t(180, 30)(T)}% ATK, ${t(40, 8)(T)}% chance to inflict FEAR`,
      fx: (T) => ({ damagePct: t(180, 30)(T), statuses: [{ type: 'fear', chance: t(40, 8)(T), duration: 2 }] }) },
    { key: 'alphas_call', name: "Alpha's Call", kind: 'special', cost: 70, cd: 6,
      lore: 'One howl. Every creature in the valley answers, and the valley is suddenly very small for your enemy.',
      text: (T) => `${t(230, 40)(T)}% ATK, poisons for 3 turns, +${t(20, 8)(T)}% SPD for 3 turns`,
      fx: (T) => ({ damagePct: t(230, 40)(T), statuses: [{ type: 'poison', chance: t(60, 10)(T), duration: 3 }], buffs: [{ stat: 'speed', amount: t(20, 8)(T), duration: 3 }] }) },
  ],
  alchemist: [
    { key: 'elixir_of_vigor', name: 'Elixir of Vigor', kind: 'support', cost: 35, cd: 4,
      lore: 'Quicksilver, nightshade, a single drop of your own blood. The recipe is older than the Guild.',
      text: (T) => `Heal ${t(18, 5)(T)}% HP, restore ${t(15, 5)(T)}% energy, cleanse debuffs`,
      fx: (T) => ({ type: 'heal', healingPct: t(18, 5)(T), energyPct: t(15, 5)(T), cleanse: true }) },
    { key: 'acid_flask', name: 'Acid Flask', kind: 'attack', cost: 45, cd: 3,
      lore: 'The glass breaks. Whatever it touches remembers the touch for a long time.',
      text: (T) => `${t(170, 30)(T)}% ATK, poisons 3 turns, -${t(15, 5)(T)}% enemy DEF`,
      fx: (T) => ({ damagePct: t(170, 30)(T), statuses: [{ type: 'poison', chance: t(75, 5)(T), duration: 3 }], debuffs: [{ stat: 'def', amount: t(15, 5)(T), duration: 3 }] }) },
    { key: 'philosophers_flame', name: "Philosopher's Flame", kind: 'special', cost: 75, cd: 6,
      lore: 'Lead into gold, flesh into ash. The Great Work was never about metals.',
      text: (T) => `${t(240, 42)(T)}% ATK, BURNS 3 turns, heal ${t(8, 3)(T)}% of max HP`,
      fx: (T) => ({ damagePct: t(240, 42)(T), statuses: [{ type: 'burn', chance: 100, duration: 3 }], healingPct: t(8, 3)(T) }) },
  ],
  blacksmith: [
    { key: 'tempered_plate', name: 'Tempered Plate', kind: 'support', cost: 35, cd: 4,
      lore: 'You hammered this steel yourself. You know exactly where it will hold.',
      text: (T) => `Shield ${t(25, 7)(T)}% max HP for 3 turns, +${t(20, 6)(T)}% DEF`,
      fx: (T) => ({ shieldPct: t(25, 7)(T), shieldMode: 'pool', shieldTurns: 3, buffs: [{ stat: 'def', amount: t(20, 6)(T), duration: 3 }] }) },
    { key: 'anvil_crash', name: 'Anvil Crash', kind: 'attack', cost: 45, cd: 3,
      lore: 'A smith\'s hammer weighs the same as a warrior\'s. It simply knows more about breaking things.',
      text: (T) => `${t(200, 35)(T)}% ATK, ${t(20, 8)(T)}% chance to STUN, ignores ${t(10, 5)(T)}% armor`,
      fx: (T) => ({ damagePct: t(200, 35)(T), statuses: [{ type: 'stun', chance: t(20, 8)(T), duration: 2 }], armorPen: t(10, 5)(T) }) },
    { key: 'masterwork_edge', name: 'Masterwork Edge', kind: 'special', cost: 65, cd: 6,
      lore: 'The blade you quench tonight will outlive you. Tonight it only needs to outlive them.',
      text: (T) => `+${t(35, 10)(T)}% ATK and +${t(15, 5)(T)}% crit for 4 turns, reflect ${t(10, 5)(T)}% damage`,
      fx: (T) => ({ buffs: [{ stat: 'atk', amount: t(35, 10)(T), duration: 4 }, { stat: 'critChance', amount: t(15, 5)(T), duration: 4 }], reflectPct: t(10, 5)(T), reflectTurns: 4 }) },
  ],
  enchanter: [
    { key: 'runic_ward', name: 'Runic Ward', kind: 'support', cost: 35, cd: 4,
      lore: 'Seven sigils, drawn in the air faster than a blade can cross it.',
      text: (T) => `Absorb ${t(30, 8)(T)}% of every hit for 3 turns, +${t(15, 5)(T)}% energy`,
      fx: (T) => ({ shieldPct: t(30, 8)(T), shieldMode: 'rate', shieldTurns: 3, energyPct: t(15, 5)(T) }) },
    { key: 'arcane_lash', name: 'Arcane Lash', kind: 'attack', cost: 45, cd: 3,
      lore: 'The enchantment was meant for a sword. You skipped the sword.',
      text: (T) => `${t(185, 32)(T)}% ATK, ${t(30, 8)(T)}% chance to SILENCE 2 turns`,
      fx: (T) => ({ damagePct: t(185, 32)(T), statuses: [{ type: 'silence', chance: t(30, 8)(T), duration: 2 }] }) },
    { key: 'grand_imbuement', name: 'Grand Imbuement', kind: 'special', cost: 70, cd: 6,
      lore: 'Every rune you ever carved ignites at once. For four turns you ARE the enchanted weapon.',
      text: (T) => `+${t(40, 10)(T)}% ATK, +${t(20, 6)(T)}% SPD for 4 turns, next hits ${t(30, 10)(T)}% likelier to CURSE`,
      fx: (T) => ({ buffs: [{ stat: 'atk', amount: t(40, 10)(T), duration: 4 }, { stat: 'speed', amount: t(20, 6)(T), duration: 4 }], damagePct: t(150, 25)(T), statuses: [{ type: 'curse', chance: t(30, 10)(T), duration: 3 }] }) },
  ],
  treasure_hunter: [
    { key: 'lucky_step', name: 'Lucky Step', kind: 'support', cost: 30, cd: 4,
      lore: 'The trap was there. Your foot simply was not, at the moment it mattered.',
      text: (T) => `+${t(30, 10)(T)}% dodge and +${t(40, 15)(T)}% SPD for 3 turns`,
      fx: (T) => ({ buffs: [{ stat: 'dodge', amount: t(30, 10)(T), duration: 3 }, { stat: 'speed', amount: t(40, 15)(T), duration: 3 }] }) },
    { key: 'whip_crack', name: 'Whip Crack', kind: 'attack', cost: 40, cd: 3,
      lore: 'Twelve feet of braided leather, and the loudest sound in any tomb.',
      text: (T) => `${t(180, 30)(T)}% ATK, ${t(30, 8)(T)}% chance to SLOW 2 turns`,
      fx: (T) => ({ damagePct: t(180, 30)(T), statuses: [{ type: 'trueslow', chance: t(30, 8)(T), duration: 2 }] }) },
    { key: 'fortunes_favor', name: "Fortune's Favor", kind: 'special', cost: 65, cd: 6,
      lore: 'Luck is a resource. You have been hoarding it for exactly this moment.',
      text: (T) => `${t(230, 40)(T)}% ATK with +${t(25, 8)(T)}% crit, +${t(20, 6)(T)}% crit for 3 turns`,
      fx: (T) => ({ damagePct: t(230, 40)(T), critBonus: t(25, 8)(T), buffs: [{ stat: 'critChance', amount: t(20, 6)(T), duration: 3 }] }) },
  ],
  dungeon_delver: [
    { key: 'second_wind', name: 'Second Wind', kind: 'support', cost: 35, cd: 4,
      lore: 'Floor forty. Torch dying. You breathe in once and the dungeon breathes with you.',
      text: (T) => `Regenerate ${t(5, 1)(T)}% HP/turn for 4 turns, take ${t(15, 5)(T)}% less damage`,
      fx: (T) => ({ regen: { pct: t(5, 1)(T), turns: 4 }, damageTakenPct: t(15, 5)(T), damageTakenTurns: 4 }) },
    { key: 'pickaxe_swing', name: 'Pickaxe Swing', kind: 'attack', cost: 40, cd: 3,
      lore: 'It was made for rock. Skulls are softer.',
      text: (T) => `${t(190, 32)(T)}% ATK, ignores ${t(15, 5)(T)}% armor, -${t(10, 4)(T)}% enemy DEF`,
      fx: (T) => ({ damagePct: t(190, 32)(T), armorPen: t(15, 5)(T), debuffs: [{ stat: 'def', amount: t(10, 4)(T), duration: 3 }] }) },
    { key: 'abyssal_resolve', name: 'Abyssal Resolve', kind: 'special', cost: 70, cd: 7,
      lore: 'You have seen what lives at the bottom. Nothing up here frightens you anymore.',
      text: (T) => `IMMUNE to damage for ${T >= 4 ? 2 : 1} turn${T >= 4 ? 's' : ''}, then +${t(25, 8)(T)}% ATK/DEF for 3 turns`,
      fx: (T) => ({ immuneTurns: T >= 4 ? 2 : 1, buffs: [{ stat: 'atk', amount: t(25, 8)(T), duration: 4 }, { stat: 'def', amount: t(25, 8)(T), duration: 4 }] }) },
  ],
  relic_hunter: [
    { key: 'relic_sight', name: 'Relic Sight', kind: 'support', cost: 30, cd: 4,
      lore: 'The artifact hums. You learned to listen; now it tells you where the enemy is weakest.',
      text: (T) => `+${t(20, 6)(T)}% crit and +${t(15, 5)(T)}% ATK for 3 turns, target takes +${t(10, 4)(T)}% damage`,
      fx: (T) => ({ buffs: [{ stat: 'critChance', amount: t(20, 6)(T), duration: 3 }, { stat: 'atk', amount: t(15, 5)(T), duration: 3 }], debuffs: [{ stat: 'damageTaken', amount: t(10, 4)(T), duration: 3 }], utility: true }) },
    { key: 'ancient_discharge', name: 'Ancient Discharge', kind: 'attack', cost: 45, cd: 3,
      lore: 'The relic was sealed for a reason. You pulled the pin.',
      text: (T) => `${t(190, 33)(T)}% ATK, ${t(30, 8)(T)}% chance to PARALYZE`,
      fx: (T) => ({ damagePct: t(190, 33)(T), statuses: [{ type: 'paralyze', chance: t(30, 8)(T), duration: 2 }] }) },
    { key: 'lost_legacy', name: 'Lost Legacy', kind: 'special', cost: 75, cd: 6,
      lore: 'Every civilisation that fell left one weapon behind. You carry all of them.',
      text: (T) => `${t(250, 45)(T)}% ATK, CURSES 3 turns, shield ${t(15, 5)(T)}% max HP`,
      fx: (T) => ({ damagePct: t(250, 45)(T), statuses: [{ type: 'curse', chance: 100, duration: 3 }], shieldPct: t(15, 5)(T), shieldMode: 'pool', shieldTurns: 3 }) },
  ],
  void_walker: [
    { key: 'rift_step', name: 'Rift Step', kind: 'support', cost: 35, cd: 4,
      lore: 'Here. There. The space between was never real; you simply stopped pretending.',
      text: (T) => `+${t(40, 12)(T)}% dodge and +${t(60, 20)(T)}% SPD for 3 turns`,
      fx: (T) => ({ buffs: [{ stat: 'dodge', amount: t(40, 12)(T), duration: 3 }, { stat: 'speed', amount: t(60, 20)(T), duration: 3 }] }) },
    { key: 'void_rend', name: 'Void Rend', kind: 'attack', cost: 50, cd: 3,
      lore: 'The cut has no edge. It is simply a place where the enemy stops existing.',
      text: (T) => `${t(200, 35)(T)}% ATK, ignores ${t(25, 8)(T)}% armor, ${t(20, 6)(T)}% chance to SILENCE`,
      fx: (T) => ({ damagePct: t(200, 35)(T), armorPen: t(25, 8)(T), statuses: [{ type: 'silence', chance: t(20, 6)(T), duration: 2 }] }) },
    { key: 'spatial_rupture', name: 'Spatial Rupture', kind: 'special', cost: 80, cd: 6,
      lore: 'You tear the room in half and stand on the half that survives.',
      text: (T) => `${t(270, 48)(T)}% ATK, ${t(35, 8)(T)}% chance to STUN, take ${t(15, 5)(T)}% less damage 3 turns`,
      fx: (T) => ({ damagePct: t(270, 48)(T), statuses: [{ type: 'stun', chance: t(35, 8)(T), duration: 2 }], damageTakenPct: t(15, 5)(T), damageTakenTurns: 3 }) },
  ],
  beast_king: [
    { key: 'kings_roar', name: "King's Roar", kind: 'support', cost: 40, cd: 4,
      lore: 'Lesser beasts go flat to the earth. Greater ones remember who they answer to.',
      text: (T) => `Enemy -${t(15, 5)(T)}% ATK and -${t(15, 5)(T)}% DEF 3 turns; you +${t(20, 8)(T)}% ATK`,
      fx: (T) => ({ debuffs: [{ stat: 'atk', amount: t(15, 5)(T), duration: 3 }, { stat: 'def', amount: t(15, 5)(T), duration: 3 }], buffs: [{ stat: 'atk', amount: t(20, 8)(T), duration: 3 }], utility: true }) },
    { key: 'primal_maul', name: 'Primal Maul', kind: 'attack', cost: 50, cd: 3,
      lore: 'Claw, not blade. Nothing refined about it, and nothing survives it twice.',
      text: (T) => `${t(210, 36)(T)}% ATK, bleeds 3 turns, ${t(20, 6)(T)}% chance to FEAR`,
      fx: (T) => ({ damagePct: t(210, 36)(T), statuses: [{ type: 'bleed', chance: 80, duration: 3 }, { type: 'fear', chance: t(20, 6)(T), duration: 2 }] }) },
    { key: 'apex_dominion', name: 'Apex Dominion', kind: 'special', cost: 80, cd: 6,
      lore: 'The jungle has one law and you are reading it aloud.',
      text: (T) => `${t(260, 45)(T)}% ATK, +${t(30, 10)(T)}% ATK and regenerate ${t(4, 1)(T)}% HP/turn for 4 turns`,
      fx: (T) => ({ damagePct: t(260, 45)(T), buffs: [{ stat: 'atk', amount: t(30, 10)(T), duration: 4 }], regen: { pct: t(4, 1)(T), turns: 4 } }) },
  ],
  storm_warden: [
    { key: 'static_veil', name: 'Static Veil', kind: 'support', cost: 35, cd: 4,
      lore: 'The air around you crackles. Anyone who touches it pays in nerves.',
      text: (T) => `Reflect ${t(20, 7)(T)}% damage and +${t(40, 12)(T)}% SPD for 3 turns`,
      fx: (T) => ({ reflectPct: t(20, 7)(T), reflectTurns: 3, buffs: [{ stat: 'speed', amount: t(40, 12)(T), duration: 3 }] }) },
    { key: 'chain_lightning', name: 'Chain Lightning', kind: 'attack', cost: 50, cd: 3,
      lore: 'It finds the shortest path to the ground. Today the shortest path is through them.',
      text: (T) => `${t(195, 34)(T)}% ATK, ${t(30, 8)(T)}% chance to PARALYZE 2 turns`,
      fx: (T) => ({ damagePct: t(195, 34)(T), statuses: [{ type: 'paralyze', chance: t(30, 8)(T), duration: 2 }] }) },
    { key: 'eye_of_the_storm', name: 'Eye of the Storm', kind: 'special', cost: 80, cd: 6,
      lore: 'In the centre it is perfectly calm. Everything else is being torn apart.',
      text: (T) => `${t(270, 48)(T)}% ATK, STUNS ${t(40, 10)(T)}%, take ${t(20, 6)(T)}% less damage 3 turns`,
      fx: (T) => ({ damagePct: t(270, 48)(T), statuses: [{ type: 'stun', chance: t(40, 10)(T), duration: 2 }], damageTakenPct: t(20, 6)(T), damageTakenTurns: 3 }) },
  ],
  grave_lord: [
    { key: 'bone_pall', name: 'Bone Pall', kind: 'support', cost: 35, cd: 4,
      lore: 'The dead lend you their stillness. Blades find only old bone where your flesh should be.',
      text: (T) => `Shield ${t(25, 7)(T)}% max HP 3 turns, convert ${t(20, 7)(T)}% of damage taken into HP`,
      fx: (T) => ({ shieldPct: t(25, 7)(T), shieldMode: 'pool', shieldTurns: 3, convertPct: t(20, 7)(T), convertTurns: 3 }) },
    { key: 'grave_touch', name: 'Grave Touch', kind: 'attack', cost: 45, cd: 3,
      lore: 'Cold climbs from the wound toward the heart. It is in no hurry.',
      text: (T) => `${t(185, 32)(T)}% ATK, drains ${t(8, 3)(T)}% of target max HP to you, CURSES`,
      fx: (T) => ({ damagePct: t(185, 32)(T), drainPct: t(8, 3)(T), drainHealPct: 100, statuses: [{ type: 'curse', chance: t(50, 10)(T), duration: 3 }] }) },
    { key: 'deaths_dominion', name: "Death's Dominion", kind: 'special', cost: 80, cd: 7,
      lore: 'Every grave in the field opens at your word. The enemy is standing on a lot of graves.',
      text: (T) => `${t(250, 45)(T)}% ATK, FEARS 3 turns, lifesteal ${t(20, 8)(T)}% for 3 turns`,
      fx: (T) => ({ damagePct: t(250, 45)(T), statuses: [{ type: 'fear', chance: t(70, 7)(T), duration: 3 }, { type: 'lifesteal', chance: 100, duration: 3 }], buffs: [{ stat: 'lifesteal', amount: t(20, 8)(T), duration: 3 }] }) },
  ],
  demon_lord: [
    { key: 'infernal_skin', name: 'Infernal Skin', kind: 'support', cost: 40, cd: 4,
      lore: 'Hellfire runs where blood should. Touch it and burn.',
      text: (T) => `Reflect ${t(25, 8)(T)}% damage, take ${t(15, 5)(T)}% less, +${t(15, 5)(T)}% ATK — 3 turns`,
      fx: (T) => ({ reflectPct: t(25, 8)(T), reflectTurns: 3, damageTakenPct: t(15, 5)(T), damageTakenTurns: 3, buffs: [{ stat: 'atk', amount: t(15, 5)(T), duration: 3 }] }) },
    { key: 'hellfire_claw', name: 'Hellfire Claw', kind: 'attack', cost: 50, cd: 3,
      lore: 'Five furrows, each one a furnace.',
      text: (T) => `${t(205, 36)(T)}% ATK, BURNS 3 turns`,
      fx: (T) => ({ damagePct: t(205, 36)(T), statuses: [{ type: 'burn', chance: 100, duration: 3 }] }) },
    { key: 'demon_sovereignty', name: 'Demon Sovereignty', kind: 'special', cost: 85, cd: 6,
      lore: 'The lesser demons kneel. Everything else learns why.',
      text: (T) => `${t(280, 50)(T)}% ATK, enemy -${t(20, 6)(T)}% ATK/DEF 3 turns, +${t(20, 6)(T)}% crit 3 turns`,
      fx: (T) => ({ damagePct: t(280, 50)(T), debuffs: [{ stat: 'atk', amount: t(20, 6)(T), duration: 3 }, { stat: 'def', amount: t(20, 6)(T), duration: 3 }], buffs: [{ stat: 'critChance', amount: t(20, 6)(T), duration: 3 }] }) },
  ],
  starforged: [
    { key: 'astral_mantle', name: 'Astral Mantle', kind: 'support', cost: 40, cd: 4,
      lore: 'Starlight has crossed ten thousand years to reach you. It is not stopping for a sword.',
      text: (T) => `Absorb ${t(35, 8)(T)}% of every hit 3 turns, restore ${t(20, 6)(T)}% energy, heal ${t(8, 3)(T)}% HP`,
      fx: (T) => ({ shieldPct: t(35, 8)(T), shieldMode: 'rate', shieldTurns: 3, energyPct: t(20, 6)(T), healingPct: t(8, 3)(T), type: 'buff' }) },
    { key: 'meteor_fist', name: 'Meteor Fist', kind: 'attack', cost: 55, cd: 3,
      lore: 'A falling star, aimed.',
      text: (T) => `${t(220, 38)(T)}% ATK, BURNS, ${t(20, 6)(T)}% chance to STUN`,
      fx: (T) => ({ damagePct: t(220, 38)(T), statuses: [{ type: 'burn', chance: 100, duration: 3 }, { type: 'stun', chance: t(20, 6)(T), duration: 2 }] }) },
    { key: 'supernova', name: 'Supernova', kind: 'special', cost: 95, cd: 7,
      lore: 'A star dies so brightly that for one moment there are no shadows left to hide in.',
      text: (T) => `${t(320, 55)(T)}% ATK, BLINDS 2 turns, +${t(30, 10)(T)}% ATK 3 turns`,
      fx: (T) => ({ damagePct: t(320, 55)(T), statuses: [{ type: 'blind', chance: 100, duration: 2 }], buffs: [{ stat: 'atk', amount: t(30, 10)(T), duration: 3 }] }) },
  ],
  abyss_walker: [
    { key: 'abyssal_veil', name: 'Abyssal Veil', kind: 'support', cost: 40, cd: 4,
      lore: 'Light goes in. Nothing comes out — not sight, not sound, not the blade meant for your throat.',
      text: (T) => `+${t(50, 12)(T)}% dodge and +${t(25, 8)(T)}% crit for 3 turns`,
      fx: (T) => ({ buffs: [{ stat: 'dodge', amount: t(50, 12)(T), duration: 3 }, { stat: 'critChance', amount: t(25, 8)(T), duration: 3 }] }) },
    { key: 'deep_cut', name: 'Deep Cut', kind: 'attack', cost: 50, cd: 3,
      lore: 'Not deep into the flesh. Deep into somewhere else.',
      text: (T) => `${t(210, 36)(T)}% ATK, ignores ${t(30, 8)(T)}% armor, bleeds 3 turns`,
      fx: (T) => ({ damagePct: t(210, 36)(T), armorPen: t(30, 8)(T), statuses: [{ type: 'bleed', chance: 85, duration: 3 }] }) },
    { key: 'abyssal_authority', name: 'Abyssal Authority', kind: 'special', cost: 85, cd: 6,
      lore: 'The Abyss looked back. You did not blink. Now it does what you say.',
      text: (T) => `${t(290, 50)(T)}% ATK, FEARS & SLOWS 3 turns, +${t(20, 6)(T)}% SPD 3 turns`,
      fx: (T) => ({ damagePct: t(290, 50)(T), statuses: [{ type: 'fear', chance: t(60, 10)(T), duration: 3 }, { type: 'trueslow', chance: 100, duration: 3 }], buffs: [{ stat: 'speed', amount: t(20, 6)(T), duration: 3 }] }) },
  ],
  world_breaker: [
    { key: 'unyielding_stance', name: 'Unyielding Stance', kind: 'support', cost: 40, cd: 4,
      lore: 'Mountains have tried to move you. Mountains are shorter now.',
      text: (T) => `Take ${t(30, 8)(T)}% less damage, +${t(30, 8)(T)}% DEF and +${t(15, 5)(T)}% ATK for 3 turns`,
      fx: (T) => ({ damageTakenPct: t(30, 8)(T), damageTakenTurns: 3, buffs: [{ stat: 'def', amount: t(30, 8)(T), duration: 3 }, { stat: 'atk', amount: t(15, 5)(T), duration: 3 }] }) },
    { key: 'fault_line', name: 'Fault Line', kind: 'attack', cost: 55, cd: 3,
      lore: 'You hit the ground. The ground hits everything standing on it.',
      text: (T) => `${t(225, 40)(T)}% ATK, ignores ${t(35, 8)(T)}% armor, -${t(20, 5)(T)}% enemy DEF 3 turns`,
      fx: (T) => ({ damagePct: t(225, 40)(T), armorPen: t(35, 8)(T), debuffs: [{ stat: 'def', amount: t(20, 5)(T), duration: 3 }] }) },
    { key: 'world_shatter', name: 'World Shatter', kind: 'special', cost: 100, cd: 7,
      lore: 'There is a crack in everything. You are the reason.',
      text: (T) => `${t(340, 60)(T)}% ATK, STUNS ${t(40, 10)(T)}%, +${t(50, 10)(T)}% vs elites & bosses`,
      fx: (T) => ({ damagePct: t(340, 60)(T), statuses: [{ type: 'stun', chance: t(40, 10)(T), duration: 2 }], eliteBonus: t(50, 10)(T) }) },
  ],
  demon_emperor: [
    { key: 'imperial_aegis', name: 'Imperial Aegis', kind: 'support', cost: 45, cd: 4,
      lore: 'The crown is forged from the horns of every lord who challenged it.',
      text: (T) => `Shield ${t(30, 8)(T)}% max HP, reflect ${t(20, 7)(T)}%, +${t(20, 6)(T)}% ATK/DEF — 3 turns`,
      fx: (T) => ({ shieldPct: t(30, 8)(T), shieldMode: 'pool', shieldTurns: 3, reflectPct: t(20, 7)(T), reflectTurns: 3, buffs: [{ stat: 'atk', amount: t(20, 6)(T), duration: 3 }, { stat: 'def', amount: t(20, 6)(T), duration: 3 }] }) },
    { key: 'infernal_decree', name: 'Infernal Decree', kind: 'attack', cost: 55, cd: 3,
      lore: 'You speak a sentence. The enemy serves it.',
      text: (T) => `${t(230, 40)(T)}% ATK, BURNS & CURSES 3 turns, drains ${t(6, 2)(T)}% target max HP`,
      fx: (T) => ({ damagePct: t(230, 40)(T), statuses: [{ type: 'burn', chance: 100, duration: 3 }, { type: 'curse', chance: 100, duration: 3 }], drainPct: t(6, 2)(T), drainHealPct: 100 }) },
    { key: 'infernal_sovereignty', name: 'Infernal Sovereignty', kind: 'special', cost: 100, cd: 7,
      lore: 'Hell has had many lords. It has had one Emperor.',
      text: (T) => `${t(330, 58)(T)}% ATK, enemy -${t(25, 6)(T)}% all stats 3 turns, lifesteal ${t(20, 8)(T)}% 3 turns`,
      fx: (T) => ({ damagePct: t(330, 58)(T), debuffs: [{ stat: 'atk', amount: t(25, 6)(T), duration: 3 }, { stat: 'def', amount: t(25, 6)(T), duration: 3 }, { stat: 'speed', amount: t(25, 6)(T), duration: 3 }], buffs: [{ stat: 'lifesteal', amount: t(20, 8)(T), duration: 3 }] }) },
  ],
  shadow_monarch: [
    { key: 'shadow_exchange', name: 'Shadow Exchange', kind: 'support', cost: 45, cd: 4,
      lore: 'You swap places with your own shadow. The blade that was meant for you finds only darkness.',
      text: (T) => `+${t(60, 15)(T)}% dodge, +${t(60, 20)(T)}% SPD for 3 turns, take ${t(20, 6)(T)}% less damage`,
      fx: (T) => ({ buffs: [{ stat: 'dodge', amount: t(60, 15)(T), duration: 3 }, { stat: 'speed', amount: t(60, 20)(T), duration: 3 }], damageTakenPct: t(20, 6)(T), damageTakenTurns: 3 }) },
    { key: 'rulers_authority', name: "Ruler's Authority", kind: 'attack', cost: 60, cd: 3,
      lore: 'An unseen hand closes. The enemy is lifted, crushed, discarded.',
      text: (T) => `${t(240, 42)(T)}% ATK, ignores ${t(30, 8)(T)}% armor, ${t(35, 8)(T)}% chance to STUN`,
      fx: (T) => ({ damagePct: t(240, 42)(T), armorPen: t(30, 8)(T), statuses: [{ type: 'stun', chance: t(35, 8)(T), duration: 2 }] }) },
    { key: 'monarchs_domain', name: "Monarch's Domain", kind: 'special', cost: 100, cd: 7,
      lore: 'Darkness falls at noon. Inside it, only one will is permitted.',
      text: (T) => `${t(350, 60)(T)}% ATK, FEARS 3 turns, +${t(35, 10)(T)}% ATK & lifesteal ${t(20, 8)(T)}% for 4 turns`,
      fx: (T) => ({ damagePct: t(350, 60)(T), statuses: [{ type: 'fear', chance: t(70, 7)(T), duration: 3 }], buffs: [{ stat: 'atk', amount: t(35, 10)(T), duration: 4 }, { stat: 'lifesteal', amount: t(20, 8)(T), duration: 4 }] }) },
  ],
};

const KIND_ICON = { support: '🌀', attack: '⚔️', special: '💥' };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function defsFor(jobKey) { return CATALOG[jobKey] || []; }
function allDefs() { return Object.entries(CATALOG).flatMap(([jobKey, arr]) => arr.map((d, i) => ({ ...d, jobKey, unlock: UNLOCKS[i] }))); }

// Tier for a skill at job level `jobLv` (0 = locked).
function tierOf(def, jobLv) { const u = def.unlock || 1; return jobLv >= u ? Math.max(1, Math.min(5, jobLv - u + 1)) : 0; }

/** The three skills of the player's ACTIVE job with their current tier (0 = locked). */
function listFor(player) {
  const job = JS.current(player); if (!job) return { job: null, skills: [] };
  const lv = JS.level(player);
  const skills = defsFor(job.key).map((d, i) => { const def = { ...d, jobKey: job.key, unlock: UNLOCKS[i] }; return { def, tier: tierOf(def, lv) }; });
  return { job, level: lv, skills };
}

/** Build an engine-ready entry (same shape as a SkillCatalog roster entry). */
function toEntry(def, tier) {
  const T = Math.max(1, Math.min(5, tier || 1));
  const fx = def.fx(T) || {};
  const isDmg = (fx.damagePct || 0) > 0;
  const type = fx.type || (isDmg ? (def.kind === 'special' ? 'special' : 'attack') : 'buff');
  return {
    name: def.name, className: 'Job', index: -1, type, isPassive: false, fromClassFile: false, jobSkill: true, jobKey: def.jobKey, kind: def.kind, tier: T,
    description: def.lore, effect: def.text(T), lore: def.lore,
    animation: `${KIND_ICON[def.kind] || '✨'} ${def.name}!\n${def.lore}`,
    cooldown: def.cd, energyCost: def.cost,
    damagePct: fx.damagePct || 0, flatDamage: 0, healingPct: fx.healingPct || 0,
    drainPct: fx.drainPct || 0, drainHealPct: fx.drainHealPct || 0, selfCostPct: 0,
    buffs: fx.buffs || [], debuffs: fx.debuffs || [], selfDebuffs: [], extraBuffs: [],
    statuses: (fx.statuses || []).map(s => ({ type: s.type, chance: Math.max(5, Math.min(100, s.chance)), duration: Math.max(2, s.duration || 2) })),
    shieldPct: fx.shieldPct || 0, shieldMode: fx.shieldMode || 'pool', shieldTurns: fx.shieldTurns || 3,
    immuneTurns: fx.immuneTurns || 0, energyPct: fx.energyPct || 0, regen: fx.regen || null,
    damageTakenPct: fx.damageTakenPct || 0, damageTakenTurns: fx.damageTakenTurns || 3,
    reflectPct: fx.reflectPct || 0, reflectTurns: fx.reflectTurns || 3,
    convertPct: fx.convertPct || 0, convertTurns: fx.convertTurns || 2,
    cleanse: !!fx.cleanse, party: false,
    armorPen: fx.armorPen || 0, eliteBonus: fx.eliteBonus || 0, executeBonus: fx.executeBonus || 0, critBonus: fx.critBonus || 0,
    unlocksAtLevel: 1, level: 1, maxLevel: 5, _generated: false,
  };
}

/**
 * Resolve a query ("Lupine Dash", "lupine", "j1", "job 2") to the player's
 * active-job skill. Returns { ok, skill, entry } | { ok:false, locked, error } | null (not a job skill).
 */
function resolve(player, query, opts = {}) {
  const q = String(query || '').trim(); if (!q) return null;
  const all = allDefs(); const nq = norm(q);
  let def = all.find(d => norm(d.name) === nq) || all.find(d => norm(d.key) === nq);
  let idx = -1; const m = q.match(/^(?:j|job|jobskill|js)\s*([1-3])$/i); if (m) idx = parseInt(m[1], 10) - 1;
  const cur = JS.current(player);
  if (!def && !m) { if (!cur || opts.exactOnly) return null; const mine = defsFor(cur.key); def = mine.find(d => norm(d.name).startsWith(nq)) || mine.find(d => norm(d.name).includes(nq)); if (!def || nq.length < 4) return def ? defDone(def) : null; }
  if (m) { if (!cur) return { ok: false, error: '🧭 You have no job yet — /job to take one.' }; def = defsFor(cur.key)[idx]; if (!def) return null; }
  return defDone(def);
  function defDone(d) {
    const jobKey = d.jobKey || Object.keys(CATALOG).find(k => CATALOG[k].includes(d));
    const i = CATALOG[jobKey].indexOf(CATALOG[jobKey].find(x => x.key === d.key));
    const full = { ...d, jobKey, unlock: UNLOCKS[i] };
    const owner = JS.BY_KEY[jobKey];
    if (!cur || cur.key !== jobKey) return { ok: false, locked: true, error: `🔒 *${full.name}* belongs to ${owner.emoji} *${owner.name}* — it only answers while that is your active job (/job switch).` };
    const tier = tierOf(full, JS.level(player));
    if (!tier) return { ok: false, locked: true, error: `🔒 *${full.name}* awakens at ${owner.emoji} ${owner.name} *Job Lv.${full.unlock}* (you are Job Lv.${JS.level(player)}).` };
    const entry = toEntry(full, tier);
    const skill = { name: entry.name, type: entry.type, level: 1, energyCost: entry.energyCost, cooldown: entry.cooldown, description: entry.effect, effect: entry.effect, damagePct: entry.damagePct, jobSkill: true, tier };
    return { ok: true, skill, entry, source: 'job', def: full, tier };
  }
}

/** Card lines for /jobskill (names, tiers, effects at current tier, next-tier preview). */
function card(player) {
  const { job, level, skills } = listFor(player);
  if (!job) return ['🧭 You have no job yet — */job* to see the ladder.'];
  const out = [`${job.emoji} *${job.name}* — Job Lv.${level} · _${job.levels[level - 1]}_`, ''];
  skills.forEach(({ def, tier }, i) => {
    const ic = KIND_ICON[def.kind];
    if (!tier) { out.push(`${i + 1}. ${ic} *${def.name}* 🔒 — unlocks at Job Lv.${def.unlock}`); out.push(`   _${def.lore}_`); return; }
    out.push(`${i + 1}. ${ic} *${def.name}* — Tier ${tier}/5 · ⚡${def.cost} · ${def.cd}t cd`);
    out.push(`   ${def.text(tier)}`);
    if (tier < 5 && level < 5) out.push(`   ↗ next: ${def.text(tier + 1)}`);
  });
  out.push('', '📌 /jobskill <1-3|name> · also works as /skill <name> and /attack <name> in Jeju');
  return out;
}

module.exports = { CATALOG, UNLOCKS, KIND_ICON, defsFor, allDefs, tierOf, listFor, toEntry, resolve, card };
