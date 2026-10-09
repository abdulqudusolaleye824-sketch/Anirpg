'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Push #95 — JOB SYSTEM (20 Jobs × 5 Job Levels)
//   • Class = combat identity (25). Job = a second progression layer on top.
//   • A Job unlocks (becomes AVAILABLE) at its player level; taking it or
//     changing to it needs a cleared JOB CHANGE QUEST (instance dungeon,
//     key from daily-quest completion — see InstanceDungeon.js).
//   • Job Lv.1→5 rises with JOB XP earned from activity (raid/dungeon/PvP
//     wins, floors, kills). Each level strengthens the job's identity —
//     the numbers below are REAL: they flow into ClassPower.passiveMultipliers
//     (atk/def/speed/crit/dodge/dmgTaken/skillDmg/lifesteal/armorPen/reflect/
//     healPower), plus job-specific hooks (execute vs low-HP, pet power,
//     loot chance, XP gain, potion power, gear bonus, reward multiplier).
// ═══════════════════════════════════════════════════════════════════════════

const JOB_XP_PER_LEVEL = [0, 300, 900, 2000, 4000]; // cumulative XP to reach Job Lv 1..5 (Lv1 on take)

// tier → per-Job-level scaling helper (L = 1..5)
// Push #96: G(minLv, a, b) — a perk that only exists from Job level `minLv` (scales a→b from there to Lv5).
const G = (minLv, a, b) => (lv) => { const l = Math.max(1, Math.min(5, lv)); if (l < minLv) return 0; return Math.round((a + (b - a) * ((l - minLv) / Math.max(1, 5 - minLv))) * 10) / 10; };
const L = (a, b) => (lv) => Math.round((a + (b - a) * ((Math.max(1, Math.min(5, lv)) - 1) / 4)) * 10) / 10;

const JOBS = [
  { key: 'wolf_assassin', name: 'Wolf Assassin', emoji: '🐺', unlock: 5, tier: 'Street',
    levels: ['Wolf\'s Instinct', 'Predatory Step', 'Pack Hunter', 'Blood Scent', 'Fenrir\'s Fang'],
    lore: ['Your senses sharpen. You become better at detecting weakened enemies and striking vulnerable targets.', 'Your movement becomes quieter and faster, allowing you to close distance before enemies can react.', 'Attacking an enemy that is already engaged by another player or ally increases your effectiveness.', 'Wounded enemies become easier to track, and your attacks become more dangerous against low-HP targets.', 'You awaken the instincts of an apex predator. Your attacks become devastating against isolated or weakened prey.'],
    mods: { crit: L(3, 10), speed: L(2, 12), vsLowHp: L(8, 35), packBonus: L(0, 12) } },
  { key: 'brawler', name: 'Brawler', emoji: '👊', unlock: 10, tier: 'Street',
    levels: ['Street Fighter', 'Iron Fists', 'Counter Fighter', 'Unbreakable', 'Fighting Spirit'],
    lore: ['You learn to fight with nothing but your body, gaining improved effectiveness in close-range combat.', 'Repeated strikes build momentum, making consecutive attacks increasingly powerful.', 'Successfully avoiding or enduring an enemy attack creates an opening for a stronger counterattack.', 'Your resistance to knockback and interruption increases as you remain in close combat.', 'At maximum Job mastery, every exchange builds fighting spirit, allowing you to become more dangerous the longer the battle lasts.'],
    mods: { atk: L(4, 12), momentumPerHit: L(1, 4), counter: G(3, 15, 30), ccResist: L(5, 40), dmgTaken: L(-2, -10) } },
  { key: 'bounty_hunter', name: 'Bounty Hunter', emoji: '🏹', unlock: 15, tier: 'Street',
    levels: ['Contract Seeker', 'Tracker', 'Hunter\'s Mark', 'High Value Target', 'Master Hunter'],
    lore: ['You can accept hunting contracts and earn additional rewards for designated targets.', 'Marked targets become easier to locate and track across dangerous areas.', 'You can place a mark on a target, increasing your effectiveness against that specific enemy.', 'More difficult targets provide greater rewards when successfully defeated.', 'You become a professional target hunter capable of taking contracts against exceptionally powerful enemies.'],
    mods: { rewardMult: L(10, 40), mark: G(3, 10, 25), vsElite: L(5, 25), crit: L(2, 8) } },
  { key: 'beast_tamer', name: 'Beast Tamer', emoji: '🐾', unlock: 20, tier: 'Street',
    levels: ['Beast Whisperer', 'Companion Bond', 'Pack Bond', 'Alpha Tamer', 'Beastmaster'],
    lore: ['You gain the ability to form stronger bonds with tameable creatures.', 'Your bonded beast becomes stronger and gains improved loyalty.', 'Multiple bonded creatures can cooperate more effectively during encounters.', 'Rare and powerful beasts become more willing to recognize you as their master.', 'Your bond with creatures reaches its peak, allowing you to command exceptionally powerful companions.'],
    mods: { petPower: L(10, 50), petHeal: L(5, 25), bondGain: L(10, 50), rareHatch: G(4, 25, 50) } },
  { key: 'alchemist', name: 'Alchemist', emoji: '⚗️', unlock: 25, tier: 'Professional',
    levels: ['Apprentice Alchemist', 'Refined Mixtures', 'Advanced Alchemy', 'Master Formula', 'Philosopher\'s Hand'],
    lore: ['You learn to create basic potions and consumable mixtures.', 'Your creations become more potent and waste less material.', 'You gain access to stronger potions, catalysts, and specialized mixtures.', 'You can create rare compounds with powerful temporary effects.', 'Your mastery of alchemy allows you to create extraordinary mixtures from rare materials.'],
    mods: { potionPower: L(10, 50), craftDiscount: L(5, 30), healPower: L(3, 12) } },
  { key: 'blacksmith', name: 'Blacksmith', emoji: '⚒️', unlock: 30, tier: 'Professional',
    levels: ['Apprentice Smith', 'Reinforcement', 'Master Forging', 'Rare Craftsmanship', 'Master Blacksmith'],
    lore: ['You can forge basic weapons, armor, and equipment.', 'You become capable of improving existing equipment beyond its original condition.', 'Higher-quality materials can now be transformed into significantly stronger equipment.', 'You can forge rare equipment with unique properties.', 'Your craftsmanship reaches a legendary level, allowing you to create exceptional equipment from the rarest materials.'],
    mods: { gearBonus: L(5, 25), durabilitySave: L(10, 50), craftDiscount: L(5, 25), def: L(2, 8) } },
  { key: 'enchanter', name: 'Enchanter', emoji: '✨', unlock: 35, tier: 'Professional',
    levels: ['Minor Enchantment', 'Dual Infusion', 'Arcane Imbuement', 'Greater Enchantment', 'Grand Enchanter'],
    lore: ['You learn to imbue equipment with simple magical properties.', 'Equipment can hold more complex enchantments without losing stability.', 'Powerful magical effects can be embedded into weapons and armor.', 'You can create rare combinations of enchantments with specialized effects.', 'You become capable of placing exceptionally powerful magical properties onto high-grade equipment.'],
    mods: { skillDmg: L(4, 18), gearBonus: L(3, 15), statusChance: L(5, 25) } },
  { key: 'treasure_hunter', name: 'Treasure Hunter', emoji: '🗺️', unlock: 40, tier: 'Professional',
    levels: ['Keen Eye', 'Treasure Sense', 'Hidden Hoards', 'Fortune Seeker', 'Legendary Treasure Hunter'],
    lore: ['You become better at noticing hidden loot, secret passages, and unusual objects.', 'Rare items become easier to distinguish from ordinary dungeon loot.', 'You gain access to discoveries that ordinary explorers would overlook.', 'Your expeditions have an increased chance of uncovering valuable treasures.', 'You become renowned for finding treasures thought to have been lost forever.'],
    mods: { lootChance: L(10, 50), nexusMult: L(5, 30), rareFind: L(2, 15) } },
  { key: 'dungeon_delver', name: 'Dungeon Delver', emoji: '🏚️', unlock: 45, tier: 'Professional',
    levels: ['Dungeon Sense', 'Survivor', 'Deep Explorer', 'Dungeon Veteran', 'Abyssal Delver'],
    lore: ['You become more familiar with dungeon layouts, traps, and environmental dangers.', 'You become better equipped to survive prolonged dungeon expeditions.', 'Greater dungeon depths become accessible to you, revealing more dangerous encounters and better rewards.', 'You gain significant experience from surviving difficult dungeon environments.', 'You become an experienced explorer capable of venturing into the deepest and most dangerous dungeons.'],
    mods: { xpMult: L(10, 50), dmgTaken: L(-3, -15), regenPct: L(1, 4) } },
  { key: 'relic_hunter', name: 'Relic Hunter', emoji: '🧿', unlock: 50, tier: 'Professional',
    levels: ['Relic Seeker', 'Ancient Knowledge', 'Relic Awakening', 'Lost Legacy', 'Relic Master'],
    lore: ['You learn to identify ancient artifacts and relics hidden throughout the world.', 'You begin understanding the origins and functions of mysterious relics.', 'You can uncover dormant properties hidden within certain ancient artifacts.', 'Rare relics become more valuable and reveal increasingly powerful secrets.', 'You become a master of ancient artifacts, capable of unlocking the potential of exceptionally rare relics.'],
    mods: { artifactBonus: L(10, 50), lootChance: L(5, 20), crit: L(2, 6) } },
  { key: 'void_walker', name: 'Void Walker', emoji: '🌑', unlock: 55, tier: 'Supernatural',
    levels: ['Void Touched', 'Rift Step', 'Void Passage', 'Spatial Rupture', 'Void Walker'],
    lore: ['You gain a connection to the mysterious energy of the Void.', 'You gain limited ability to manipulate space around yourself, improving movement and evasion.', 'Your connection deepens, allowing you to traverse dangerous spaces with greater ease.', 'You can channel concentrated Void energy capable of disrupting enemies and defenses.', 'You become a true traveler of the Void, bending space itself to your advantage.'],
    mods: { dodge: L(4, 15), speed: L(3, 12), armorPen: L(5, 30), atk: L(0, 8) } },
  { key: 'beast_king', name: 'Beast King', emoji: '🐉', unlock: 60, tier: 'Supernatural',
    levels: ['Alpha Presence', 'King\'s Roar', 'Primal Dominion', 'Apex Authority', 'Beast King'],
    lore: ['Beasts recognize your overwhelming presence and become less likely to challenge you.', 'Your presence can intimidate weaker creatures and strengthen allied beasts.', 'Your influence over beasts expands to stronger and rarer species.', 'Powerful beasts begin recognizing you as an equal or superior.', 'You become a supreme authority among beasts, commanding respect from creatures that once ruled entire territories.'],
    mods: { petPower: L(20, 80), monsterDmgTaken: L(-4, -20), atk: L(3, 12), fearImmune: L(0, 1) } },
  { key: 'storm_warden', name: 'Storm Warden', emoji: '⚡', unlock: 65, tier: 'Supernatural',
    levels: ['Storm Calling', 'Lightning Heart', 'Tempest Control', 'Eye of the Storm', 'Storm Warden'],
    lore: ['You begin manipulating atmospheric energy and summoning minor storms.', 'Your connection to lightning grows stronger, increasing the potency of storm-based effects.', 'You can manipulate wind and lightning together to create powerful battlefield effects.', 'You become exceptionally difficult to overwhelm while surrounded by your storm.', 'You command the battlefield like a living tempest, unleashing devastating combinations of wind and lightning.'],
    mods: { skillDmg: L(6, 25), speed: L(4, 15), onHitStun: L(3, 12), dmgTaken: L(-2, -12) } },
  { key: 'grave_lord', name: 'Grave Lord', emoji: '💀', unlock: 70, tier: 'Supernatural',
    levels: ['Grave Touched', 'Grave Command', 'Lord of Bones', 'Death\'s Dominion', 'Grave Lord'],
    lore: ['You gain a deeper connection to the forces surrounding death.', 'You gain greater authority over undead creatures and death-related entities.', 'Your influence extends over stronger undead, allowing you to command increasingly powerful servants.', 'The presence of death itself begins responding to your authority.', 'You become a sovereign of the grave, commanding the dead with an authority few living beings can challenge.'],
    mods: { lifesteal: L(5, 20), vsLowHp: L(5, 25), surviveLethal: L(0, 1), atk: L(2, 10) } },
  { key: 'demon_lord', name: 'Demon Lord', emoji: '👹', unlock: 75, tier: 'Supernatural',
    levels: ['Demonic Awakening', 'Demon Blood', 'Infernal Authority', 'Demon Sovereignty', 'Demon Lord'],
    lore: ['A fragment of demonic power awakens within you.', 'Your demonic energy grows stronger, granting greater resistance and destructive potential.', 'Lesser demons begin recognizing your growing power.', 'You gain authority over powerful demonic creatures and infernal forces.', 'You ascend as a true Demon Lord, wielding overwhelming demonic authority.'],
    mods: { atk: L(6, 22), dmgTaken: L(-3, -12), reflect: L(3, 15), crit: L(2, 8) } },
  { key: 'starforged', name: 'Starforged', emoji: '☄️', unlock: 80, tier: 'Transcendent',
    levels: ['Cosmic Spark', 'Astral Core', 'Starbound', 'Celestial Force', 'Starforged'],
    lore: ['A fragment of celestial energy awakens within you.', 'Your body begins adapting to cosmic energy, increasing your ability to channel it.', 'You gain access to increasingly powerful astral abilities.', 'You can manipulate concentrated stellar energy with devastating power.', 'Your existence becomes intertwined with celestial energy, granting you power worthy of the stars.'],
    mods: { skillDmg: L(8, 30), energyDiscount: L(5, 25), healPower: L(4, 15), def: L(3, 12) } },
  { key: 'abyss_walker', name: 'Abyss Walker', emoji: '🕳️', unlock: 85, tier: 'Transcendent',
    levels: ['Abyss Touched', 'Abyssal Sight', 'Abyssal Step', 'Abyssal Authority', 'Abyss Walker'],
    lore: ['You survive contact with the Abyss and emerge changed.', 'You gain the ability to perceive things hidden beyond ordinary senses.', 'You learn to traverse spaces touched by the Abyss without being consumed by them.', 'The deeper forces of the Abyss begin responding to your presence.', 'You have mastered the boundary between the world and the Abyss, becoming something few can comprehend.'],
    mods: { dodge: L(6, 20), crit: L(5, 18), armorPen: L(8, 35), dmgTaken: L(-2, -10) } },
  { key: 'world_breaker', name: 'World Breaker', emoji: '🌌', unlock: 90, tier: 'Transcendent',
    levels: ['Destructive Potential', 'Breaker Force', 'Cataclysmic Power', 'World Shatterer', 'World Breaker'],
    lore: ['Your power begins reaching a level capable of seriously damaging powerful structures and defenses.', 'Your attacks become increasingly effective against fortified targets.', 'You can unleash devastating bursts of destructive energy.', 'Even the strongest defenses can no longer be taken for granted in your presence.', 'You have reached a level of power capable of threatening the foundations of entire battlefields.'],
    mods: { atk: L(8, 30), armorPen: L(15, 60), shieldBreak: L(20, 100), vsElite: L(8, 30) } },
  { key: 'demon_emperor', name: 'Demon Emperor', emoji: '👑', unlock: 95, tier: 'Transcendent',
    levels: ['Imperial Blood', 'Infernal Crown', 'Emperor\'s Command', 'Infernal Sovereignty', 'Demon Emperor'],
    lore: ['Your demonic power evolves beyond that of an ordinary Demon Lord.', 'Demons of lower ranks recognize your authority and power.', 'Your influence extends over powerful demonic entities.', 'You establish yourself as an overwhelming force within the demonic hierarchy.', 'You ascend beyond the rank of Demon Lord and claim supreme authority over the infernal realm.'],
    mods: { atk: L(12, 35), def: L(6, 20), lifesteal: L(5, 18), reflect: L(5, 20), crit: L(4, 12) } },
  { key: 'shadow_monarch', name: 'Shadow Monarch', emoji: '👤', unlock: 100, tier: 'Monarch',
    levels: ['Shadow Awakening', 'Shadow Authority', 'Monarch\'s Presence', 'Eternal Shadow', 'Shadow Monarch'],
    lore: ['You awaken the first fragment of Monarch-level shadow power.', 'Your control over shadows expands, allowing you to manipulate them with extraordinary precision.', 'Your presence alone becomes enough to command fear and respect from beings sensitive to shadow power.', 'Your connection to the Shadow Realm deepens, granting you immense control over shadow-based abilities.', 'You reach the pinnacle of the Job system. The shadows recognize you as their sovereign, and your name becomes synonymous with the darkness itself.'],
    mods: { atk: L(15, 45), def: L(8, 25), speed: L(6, 20), crit: L(6, 18), dodge: L(4, 15), lifesteal: L(4, 15), skillDmg: L(10, 35), armorPen: L(10, 40) } },
];
const BY_KEY = Object.fromEntries(JOBS.map(j => [j.key, j]));

const MOD_LABEL = { rareHatch: 'Chance an egg hatch re-rolls and keeps the rarer beast', counter: 'Counter damage (next hit after being struck or dodging)', mark: "Hunter's Mark — damage vs your first-engaged target", atk: 'ATK', def: 'DEF', speed: 'SPD', crit: 'Crit', dodge: 'Dodge', dmgTaken: 'Damage taken', skillDmg: 'Skill damage', lifesteal: 'Lifesteal', armorPen: 'Armor pierce', reflect: 'Reflect', healPower: 'Heal power', vsLowHp: 'Damage vs prey under 35% HP', packBonus: 'Damage when an ally already engaged the target', momentumPerHit: 'ATK per consecutive hit (max 10)', ccResist: 'Resist stun/freeze/paralyze', rewardMult: 'Win rewards', vsElite: 'Damage vs elites & bosses', petPower: 'Pet ATK/DEF', petHeal: 'Support-pet heals', bondGain: 'Pet bond gain', potionPower: 'Potion strength', craftDiscount: 'Crafting material cost', gearBonus: 'Equipped gear stats', durabilitySave: 'Chance to skip durability loss', statusChance: 'Status proc chance', lootChance: 'Loot drop chance', nexusMult: 'Nexus from wins', rareFind: 'Rare-drop upgrade chance', xpMult: 'XP from wins', regenPct: 'HP regen per turn (% max HP)', artifactBonus: 'Artifact stats', monsterDmgTaken: 'Damage taken from beasts/monsters', fearImmune: 'Immune to FEAR', onHitStun: 'Chance to STUN on hit', energyDiscount: 'Skill energy cost', shieldBreak: 'Damage vs shields', surviveLethal: 'Survive a lethal blow (1/2h)' };
const NEG_GOOD = new Set(['dmgTaken', 'craftDiscount', 'monsterDmgTaken', 'energyDiscount']);

function findJob(q) {
  if (!q) return null;
  const s = String(q).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/^\d+$/.test(s)) return JOBS[parseInt(s, 10) - 1] || null;
  return JOBS.find(j => j.key.replace(/_/g, '') === s || j.name.toLowerCase().replace(/[^a-z0-9]/g, '') === s) || JOBS.find(j => j.name.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(s)) || null;
}

function ensure(player) {
  if (!player) return null;
  if (!player.job || typeof player.job !== 'object') player.job = { key: null, level: 0, xp: 0, history: [] };
  if (!Array.isArray(player.job.history)) player.job.history = [];
  // Push #96d: UNLOCKED jobs — every job you have ever held (and, for hunters who were
  // already deep in the ladder, every job below it) stays unlocked for free switching.
  if (!Array.isArray(player.job.unlocked)) {
    const set = new Set();
    const held = [player.job.key, ...player.job.history.map(h => h && h.key)].filter(Boolean);
    let top = -1; for (const k of held) { const i = JOBS.findIndex(j => j.key === k); if (i > top) top = i; }
    for (let i = 0; i <= top; i++) set.add(JOBS[i].key);
    player.job.unlocked = [...set];
  }
  return player.job;
}
function unlockedKeys(player) { const j = ensure(player); return j ? j.unlocked : []; }
function isUnlocked(player, job) { return !!job && unlockedKeys(player).includes(job.key); }
// The ONE job you may quest for next: the first locked job in the ladder (no skipping),
// provided your level allows it.
function nextQuestJob(player) {
  const un = unlockedKeys(player);
  const idx = JOBS.findIndex(j => !un.includes(j.key));
  if (idx < 0) return null;
  const job = JOBS[idx];
  return isAvailable(player, job) ? job : null;
}
function questable(player) { const j = nextQuestJob(player); return j ? [j] : []; }
function unlock(player, job) { const j = ensure(player); if (j && job && !j.unlocked.includes(job.key)) j.unlocked.push(job.key); }
function current(player) { const j = ensure(player); return j && j.key ? BY_KEY[j.key] || null : null; }
function level(player) { const j = ensure(player); return j && j.key ? Math.max(1, Math.min(5, Number(j.level) || 1)) : 0; }
function available(player) { const lv = Number(player && player.level) || 1; return JOBS.filter(j => j.unlock <= lv); }
function isAvailable(player, job) { return !!job && (Number(player && player.level) || 1) >= job.unlock; }

// Numeric modifiers for the hunter's current job at its current level.
function mods(player) {
  const job = current(player); const out = {};
  if (!job) return out;
  const lv = level(player);
  for (const [k, fn] of Object.entries(job.mods)) out[k] = fn(lv);
  return out;
}
function mod(player, key) { const m = mods(player); return Number(m[key]) || 0; }

// XP → Job level. Returns { gained, levelUp, from, to } for callers to announce.
function gainXp(player, amount, why) {
  const j = ensure(player); if (!j || !j.key) return null;
  const add = Math.max(0, Math.floor(Number(amount) || 0)); if (!add) return null;
  const from = level(player);
  j.xp = (Number(j.xp) || 0) + add;
  let to = from;
  while (to < 5 && j.xp >= JOB_XP_PER_LEVEL[to]) to++;
  j.level = to;
  let runeStones = [];
  if (to > from) { try { runeStones = require('./RuneStones').onJobLevel(player, j.key, from, to); } catch (e) {} } // Push #96h-z20: job skills arrive as soulbound rune stones
  return { gained: add, levelUp: to > from, from, to, why: why || '', name: BY_KEY[j.key].name, title: BY_KEY[j.key].levels[to - 1], runeStones };
}
const XP_FOR = { pvp: 60, dungeon: 45, gate: 55, instance: 30, kill: 6, floor: 12, boss: 120, generic: 25 };
function xpFor(type) { return XP_FOR[type] || XP_FOR.generic; }
function xpToNext(player) { const j = ensure(player); const lv = level(player); if (!j || !j.key || lv >= 5) return null; return Math.max(0, JOB_XP_PER_LEVEL[lv] - (Number(j.xp) || 0)); }

// Take / change job. Requires a cleared job-change quest for THIS job unless opts.force.
function setJob(player, job, opts = {}) {
  const j = ensure(player); if (!j || !job) return { ok: false, error: 'Unknown job.' };
  if (!isAvailable(player, job)) return { ok: false, error: `${job.emoji} *${job.name}* unlocks at Lv.${job.unlock} (you are Lv.${player.level || 1}).` };
  if (j.key === job.key) return { ok: false, error: `You already walk the path of the ${job.name}.` };
  if (!opts.force && !isUnlocked(player, job)) {
    const cleared = player.jobQuest && player.jobQuest.cleared === job.key;
    if (!cleared) {
      const nx = nextQuestJob(player);
      return { ok: false, error: `${job.emoji} *${job.name}* is still locked. Jobs unlock *in order* — no skipping.${nx ? ` Next on your ladder: ${nx.emoji} *${nx.name}* (clear its Job Change Quest — /instance).` : ''}\n🔁 Switch between jobs you already unlocked with */job switch <job>*.` };
    }
    const idx = JOBS.findIndex(x => x.key === job.key);
    if (idx > 0 && !isUnlocked(player, JOBS[idx - 1])) return { ok: false, error: `You must unlock ${JOBS[idx - 1].emoji} *${JOBS[idx - 1].name}* before ${job.emoji} *${job.name}* — no skipping.` };
    delete player.jobQuest.cleared;
  }
  unlock(player, job);
  if (j.key) j.history.push({ key: j.key, level: j.level, xp: j.xp, left: Date.now() });
  const prev = j.history.find(h => h.key === job.key); // returning to an old job keeps its progress
  j.key = job.key; j.level = prev ? Math.max(1, prev.level) : 1; j.xp = prev ? prev.xp : 0; j.since = Date.now();
  let runeStones = []; try { runeStones = require('./RuneStones').onJobLevel(player, job.key, 0, j.level); } catch (e) {} // Push #96h-z20: Job Lv1 skill → rune stone
  return { ok: true, job, level: j.level, runeStones };
}

function describeMods(job, lv) {
  const lines = [];
  for (const [k, fn] of Object.entries(job.mods)) {
    const v = fn(lv); if (!v) continue;
    const label = MOD_LABEL[k] || k;
    if (k === 'fearImmune' || k === 'surviveLethal') { lines.push(`• ${label}`); continue; }
    const sign = v > 0 ? '+' : '';
    lines.push(`• ${label} ${NEG_GOOD.has(k) ? `${v}%` : `${sign}${v}%`}`);
  }
  return lines;
}

function card(player) {
  const job = current(player); const lv = level(player);
  if (!job) return null;
  return `${job.emoji} *${job.name}* — Job Lv.${lv} · _${job.levels[lv - 1]}_`;
}

// Target-aware damage multiplier (prey under 35% HP, elites/bosses, pack
// bonus when an ally already engaged the target, shield break).
function targetMult(player, target, ctx = {}) {
  const m = mods(player); if (!Object.keys(m).length || !target) return 1;
  let mult = 1;
  const hp = target.stats ? target.stats.hp : target.hp, max = target.stats ? target.stats.maxHp : target.maxHp;
  if (m.vsLowHp && max > 0 && hp / max <= 0.35) mult *= 1 + m.vsLowHp / 100;
  if (m.vsElite && (target.elite || target.isBoss || target.boss || ctx.boss)) mult *= 1 + m.vsElite / 100;
  if (m.packBonus && (ctx.engagedByAlly || (target.lastHitBy && target.lastHitBy !== (player.jid || player.id)))) mult *= 1 + m.packBonus / 100;
  if (m.shieldBreak && target.tempBuffs && target.tempBuffs.shield) mult *= 1 + m.shieldBreak / 100;
  // Push #96: Bounty Hunter's Mark — the first enemy you engage in a fight is marked; you hit it harder.
  if (m.mark) { const pid = player.jid || player.id || player.name; if (!target._bountyMark) target._bountyMark = pid; if (target._bountyMark === pid) mult *= 1 + m.mark / 100; }
  // Push #96: Brawler counter — after being struck or dodging, the next attack hits harder (consumed here).
  if (m.counter && player._counterReady) { mult *= 1 + m.counter / 100; player._counterReady = false; }
  return mult;
}
// Combat bookkeeping: consecutive-hit momentum (Brawler) resets on miss.
// Combat bookkeeping: the player was struck / dodged → counter window opens (Brawler Lv3+).
function noteStruck(player) { if (player && player.job) player._counterReady = true; }
function noteHit(player, landed) { if (!player) return; player._comboHits = landed ? Math.min(10, (Number(player._comboHits) || 0) + 1) : 0; }

// Some engines (PetManager) only know a playerId — index.js registers a lookup.
let _lookup = null;
function setPlayerLookup(fn) { _lookup = typeof fn === 'function' ? fn : null; }
function byId(id) { try { return _lookup ? _lookup(id) : null; } catch (e) { return null; } }
function petMult(playerId) { const p = byId(playerId); return p ? 1 + mod(p, 'petPower') / 100 : 1; }
function bondMult(playerId) { const p = playerId && typeof playerId === 'object' ? playerId : byId(playerId); return p ? 1 + mod(p, 'bondGain') / 100 : 1; } // Push #96: Beast Tamer bonds faster
function petHealMult(playerId) { const p = byId(playerId); return p ? 1 + mod(p, 'petHeal') / 100 : 1; }

// Push #96h-z20: one line per rune stone granted by a job level-up / job change (announce in chat).
function runeLines(r) { try { return ((r && r.runeStones) || []).filter(Boolean).map(st => `🪨 *Rune Stone forged:* ${st.skill} — soulbound, in your bag (/skills)`); } catch (e) { return []; } }
module.exports = { runeLines, unlockedKeys, isUnlocked, nextQuestJob, questable, unlock, setPlayerLookup, byId, petMult, petHealMult, bondMult, noteStruck, targetMult, noteHit, JOBS, BY_KEY, JOB_XP_PER_LEVEL, MOD_LABEL, findJob, ensure, current, level, available, isAvailable, mods, mod, gainXp, xpFor, xpToNext, setJob, describeMods, card };
