// ═══════════════════════════════════════════════════════════════
// SKILL CATALOG — one canonical skill list per class
//
// Why this exists
// ───────────────
// Skills used to resolve through four sources that disagreed:
//   • LevelUpManager.skillUnlockSchedule — a hand-written level→name map
//     covering ~24 class names. Monster variants (player.class is the VARIANT
//     name, e.g. 'Magma Beetle'), Senku and Rogue were absent, so those
//     players never received a single skill.
//   • SkillDescriptions.skillDatabase — 22 classes, 18–27 skills each.
//   • rpg/classes/<tier>/<Class>.js — the class file's own `skills`.
//   • player.classSkills — quality-scaled, never read by any combat engine.
// Combat read ONLY player.skills.active, so everything outside that one array
// (unequipped library entries, class skills, monster classes) answered
// "Skill not found" — the report this module exists to fix.
//
// Rules enforced here:
//   • EVERY class has exactly SKILLS_PER_CLASS (20) skills, one unlocked per
//     5 levels (Lv.5 → Lv.100). Same count for every class, by design.
//   • Every skill carries lore (description), a battle `effect` block, an
//     `animation`, a cooldown and an energy cost — the same shape attack
//     patterns use, so a skill reads like a pattern in combat.
//   • Effect text is parsed ONCE with EffectParser (the parser combat already
//     uses) and every status it promises is checked against the list
//     StatusEffectManager implements. A description cannot advertise a status
//     the engine would silently drop.
//   • Locked ≠ owned: only skills whose unlock level is met are equipped or
//     listed (/skill, /class, /skills all read this).
//   • Skills are a MULTIPLIER of real ATK. The old maths used a flat
//     `skill.damage` (20–300), which is why a Lv.90 skill did roughly what a
//     base attack did.
//
// Energy: skills are the game's only energy sink (energy potions scrapped);
// energy refills out of battle only — see RegenManager.
// ═══════════════════════════════════════════════════════════════

'use strict';

const SKILLS_PER_CLASS = 20;          // identical for every class
const UNLOCK_STEP      = 5;           // Lv.5, 10, ... 100
const MAX_SKILL_LEVEL  = 5;

let SD = null;
try { SD = require('./SkillDescriptions'); } catch (e) { SD = null; }
let EffectParser = null;
try { EffectParser = require('./EffectParser'); } catch (e) { EffectParser = null; }

// Status effects StatusEffectManager actually implements. Anything promised in
// a skill description must be in here or it is a lie to the player.
const SUPPORTED_STATUS = new Set([
  'poison', 'burn', 'bleed', 'stun', 'freeze', 'weaken', 'weakness', 'weakened',
  'enfeeble', 'fear', 'trueslow', 'silence', 'blind', 'paralyze', 'curse', 'lifesteal',
]);

// ── Canonical class name ─────────────────────────────────────────────────────
// player.class may be a string ('Mage'), an object ({name:'Mage'} — legacy),
// or a MONSTER VARIANT name ('Magma Beetle') whose real class lives in
// player.classBase ('Monster').
function canonicalClassName(player) {
  if (!player) return null;
  let raw = player.class;
  if (raw && typeof raw === 'object') raw = raw.name || raw.className || null;
  raw = String(raw || '').trim();
  if (!raw) return null;

  if (SD && SD.skillDatabase && SD.skillDatabase[raw]) return raw;

  const base = String(player.classBase || '').trim();
  if (base && SD && SD.skillDatabase && SD.skillDatabase[base]) return base;

  try {
    const CS = require('./ClassSystem');
    if (CS.CLASS_DATA && CS.CLASS_DATA[raw]) return raw;
    if (CS.MONSTER_VARIANTS && CS.MONSTER_VARIANTS.some(v => v && v.name === raw)) return 'Monster';
  } catch (e) { /* ClassSystem unavailable */ }

  if (base) return base;
  return raw;
}

// Deterministic hash → [0,n). Generated filler skills must be stable across
// restarts, otherwise a player's skill list re-rolls every deploy.
function hashRand(str, n) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % n;
}

const THEME_WORDS = {
  fire:   ['Cinder','Ember','Pyre','Inferno','Solar','Ashen','Blazing'],
  ice:    ['Rime','Frost','Glacier','Hoarfrost','Absolute','Winter'],
  shadow: ['Umbral','Nightfall','Eclipse','Void','Phantom','Gloom'],
  holy:   ['Radiant','Halo','Sanctum','Aegis','Divine','Lumen'],
  blood:  ['Crimson','Sanguine','Redline','Gore','Thirst'],
  storm:  ['Thunder','Lightning','Tempest','Static','Stormcall'],
  steel:  ['Iron','Steel','Edge','Bulwark','Razor','Anvil'],
  beast:  ['Fang','Claw','Savage','Primal','Rend','Hunter'],
  arc:    ['Arcane','Rune','Aether','Ward','Sigil','Nexus'],
};

const VERB_PREFIX = ['Cleave','Burst','Strike','Wave','Lance','Requiem','Frenzy','Aegis','Judgement','Rend','Volley','Sigil','Overload','Cascade','Roar','Veil','Pounce','Execution','Hymn','Fracture'];

function themeFor(className, seedText) {
  const k = String(className || '').toLowerCase() + '|' + String(seedText || '').toLowerCase();
  const themes = Object.keys(THEME_WORDS);
  return THEME_WORDS[themes[hashRand(k, themes.length)]];
}

function titleCase(s) {
  return String(s || '').replace(/\b[a-z]/g, c => c.toUpperCase());
}

// Class files write flavour like "Deals {p}% ATK and inflicts BLEED (🩸)
// dealing damage each turn". EffectParser only reacts to an explicit
// "N% chance to inflict X" / "inflict X" phrasing, so those promises were
// silently dropped — the description advertised a status combat never applied.
// This rewrites a bare mention into a canonical, parseable line.
const STATUS_ALIASES = {
  burn:'burn', burning:'burn', bleed:'bleed', bleeding:'bleed', poison:'poison',
  stun:'stun', stunned:'stun', paralyze:'paralyze', paralysis:'paralyze',
  freeze:'freeze', frozen:'freeze', silence:'silence', blind:'blind',
  curse:'curse', fear:'fear', feared:'fear', weaken:'weaken', slow:'slow',
  enfeeble:'enfeeble',
};
function ensureParseable(effect) {
  try { return _ensureParseable(effect); } catch (e) { return String(effect || ''); }
}

function _ensureParseable(effect) {
  const text = String(effect || '');
  if (!text) return text;
  const lower = text.toLowerCase();
  const mentioned = new Set();
  for (const m of lower.matchAll(/(?:inflicts?|applies?|applied|causes?|deals? with|adds?)\s+(?:all (?:targets?|enemies)|the)?\s*[:\s]*([a-z]+)/g)) {
    const t = STATUS_ALIASES[m[1]];
    if (t) mentioned.add(t);
  }
  if (!mentioned.size) return text;
  const extra = [];
  for (let st of mentioned) {
    if (st === 'slow') st = 'trueslow';
    if (!SUPPORTED_STATUS.has(st)) continue;
    // Already stated with a chance? leave it to the parser as authored.
        const re = new RegExp(`(?:\\d+%\\s+chance[^\\n]*?${st}|(?:inflict|apply)\\s+${st}[^\\n]*?\\d+\\s*%?)`, 'i');
    if (re.test(text)) continue;
    const durM = text.match(new RegExp(`${st}[^\\n]*?(\\d+)\\s*turn`, 'i'));
    const guaranteed = /guarantee|always|100%/i.test(text);
    extra.push(`• ${guaranteed ? 100 : 60}% chance to inflict ${st} for ${durM ? Math.max(1, parseInt(durM[1])) : 2} turns`);
  }
  return extra.length ? `${text}\n${extra.join('\n')}` : text;
}

// Filler skill — only used when a class has fewer than 20 authored skills.
// Always states a parseable damage line and a real SUPPORTED_STATUS.
function generateSkill(className, index) {
  const words  = themeFor(className, `t${index}`);
  const words2 = themeFor(className, `v${index}`);
  const name = `${words[index % words.length]} ${VERB_PREFIX[(index * 7) % VERB_PREFIX.length]}`;
  const powerTier = Math.min(3, Math.floor(index / 6));
  const isPassive = index % 7 === 3;
  const isHeal    = !isPassive && index % 11 === 5;
  const isBuff    = !isPassive && !isHeal && index % 9 === 4;

  const dmgPct = 90 + index * 12 + powerTier * 10;
  const cost   = 18 + index * 2;
  const statusPool = ['burn','bleed','poison','stun','freeze','weaken','silence','blind','curse','enfeeble'];
  const status  = statusPool[hashRand(`${className}-${index}`, statusPool.length)];
  const chance  = 20 + hashRand(`${className}-c${index}`, 40);   // 20..59%
  const turns   = 1 + powerTier;

  let effect, type;
  if (isPassive) {
    type   = 'passive';
    effect = `• Passive: +${8 + powerTier * 4}% ATK while in battle\n• Reduces damage taken by ${4 + powerTier * 2}%\n• Always active, costs no energy`;
  } else if (isHeal) {
    type   = 'heal';
    effect = `• Heal ${12 + powerTier * 6}% of your max HP\n• Removes one debuff from you\n• Deals no damage this turn`;
  } else if (isBuff) {
    type   = 'buff';
    effect = `• +${15 + powerTier * 8}% ATK for ${2 + Math.floor(index / 8)} turns\n• Deals 40% ATK damage on cast`;
  } else {
    type   = 'damage';
    effect = `• Deals ${dmgPct}% ATK damage\n• ${chance}% chance to inflict ${status} for ${turns} turns`;
  }

  const lore = `${titleCase(words2)} doctrine of ${className}. ` + (
    isPassive ? 'It never stops working — the training is baked into the body.'
    : isHeal  ? 'A recovery art; the turns spent casting it are bought back in breath.'
    : isBuff  ? 'A priming technique. Strikers who skip it tend to regret it.'
    : 'One opening, one commitment. Lands or it does not.'
  );

  return {
    name, type, _generated: true,
    description: lore,
    effect,
    animation: `${isPassive ? '🌀' : isHeal ? '💚' : isBuff ? '🔺' : '💥'} ${name.toUpperCase()}!\n⚡ ${titleCase(words)} force is unleashed!\n${isPassive ? '🌀 Your body moves on its own.' : '💥 The strike connects!'}`,
    cooldown: isPassive ? 0 : 1 + Math.floor(index / 5),
    energyCost: isPassive ? 0 : cost,
    unlocksAtLevel: (index + 1) * UNLOCK_STEP,
  };
}

// ── Hand-authored rosters for classes SkillDescriptions never covered ────────
// Monster is a real awakenable class (50 variants share it) and Senku is the
// divine class — both previously had NO schedule entry, i.e. zero usable
// skills in combat.
const EXPLICIT = {
  Monster: [
    { name: 'Primal Strike',       type: 'damage',  effect: '• Deals 130% ATK damage\n• 35% chance to inflict bleed for 3 turns',                                     description: 'The first language a monster knows: hit it until it stops moving.' },
    { name: 'Acid Spit',           type: 'damage',  effect: '• Deals 120% ATK damage\n• 55% chance to inflict poison for 4 turns',                                     description: 'Your glands burn and the world gets a face full of stomach.' },
    { name: 'Monster Roar',        type: 'debuff',  effect: '• Deals 60% ATK damage\n• Target takes -35% ATK for 3 turns',                                            description: 'A sound below hearing that starts in the chest and ends in the legs.' },
    { name: 'Claw Swipe',          type: 'damage',  effect: '• Deals 150% ATK damage\n• 45% chance to inflict bleed for 3 turns',                                      description: 'Four lines of anatomy, taught by generations of hungry ancestors.' },
    { name: 'Mutant Physiology',   type: 'passive', effect: '• Passive: reduces all damage taken by 20%\n• Passive: +15% ATK',                                        description: 'Whatever killed the last one only made you stronger.' },
    { name: 'Thrash',              type: 'damage',  effect: '• Hits all enemies for 110% ATK damage\n• 25% chance to stun for 1 turn',                                description: 'You grab something and refuse to let physics have it.' },
    { name: 'Pack Tactics',        type: 'passive', effect: '• Passive: +15% ATK while allies fight beside you\n• Passive: +10% accuracy',                             description: 'Predators do not duel. They coordinate.' },
    { name: 'Terrifying Gaze',     type: 'debuff',  effect: '• Deals 80% ATK damage\n• 40% chance to inflict fear for 2 turns',                                       description: 'Prey looks away first. You do not.' },
    { name: 'Rending Bite',        type: 'damage',  effect: '• Deals 180% ATK damage\n• 50% chance to inflict bleed for 4 turns',                                      description: 'Teeth are the oldest weapons and still the rudest.' },
    { name: 'Devour',              type: 'damage',   effect: '• Deals 160% ATK damage\n• Heal 25% of damage dealt',                                                   description: 'The hunt ends in a meal. That is the entire point of the hunt.' },
    { name: 'Chitin Armor',        type: 'buff',    effect: '• +40% DEF for 3 turns\n• Reflects 10% of damage taken',                                                description: 'Your shell is a door that only opens outward.' },
    { name: 'Web Trap',            type: 'debuff',  effect: '• Deals 90% ATK damage\n• Inflicts trueslow for 3 turns\n• 30% chance to silence for 2 turns',            description: 'Patience, then absolutely no escape.' },
    { name: 'Feral Charge',        type: 'damage',  effect: '• Deals 210% ATK damage\n• 30% chance to stun for 1 turn',                                               description: 'Distance is just a countdown you run at full speed.' },
    { name: 'Toxic Barrage',       type: 'damage',  effect: '• Hits all enemies for 130% ATK damage\n• 60% chance to inflict poison for 4 turns',                     description: 'You inhale. They regret it.' },
    { name: 'Regeneration Factor', type: 'passive', effect: '• Passive: +20% DEF while below half HP\n• Passive: cures poison after 2 turns',                         description: 'Wounds are a rumour your body keeps correcting.' },
    { name: 'Alpha Howl',          type: 'buff',    effect: '• +25% ATK for 3 turns\n• +15% speed for 3 turns\n• Removes fear from allies',                            description: 'The pack moves when you say it moves.' },
    { name: 'Tail Sweep',          type: 'damage',  effect: '• Hits all enemies for 240% ATK damage\n• 40% chance to stun for 1 turn',                                 description: 'A limb they forgot you had, at a speed they forgot was possible.' },
    { name: 'Adaptive Evolution',  type: 'passive', effect: '• Passive: +10% ATK per status effect on you\n• Passive: -10% damage taken from magic',                   description: 'Kill me once and you have already lost — the second one learns.' },
    { name: 'Apex Predator',       type: 'damage',  effect: '• Deals 320% ATK damage\n• +15% damage against healthy targets\n• 20% chance to stun for 1 turn',         description: 'You were never in the food chain. You were the top of it.' },
    { name: 'Primal Fury',         type: 'damage',  effect: '• Deals 420% ATK damage\n• 60% chance to inflict bleed for 5 turns\n• You take 20% more damage for 2 turns', description: 'The last technique a monster uses is the one it was born with.' },
  ],
  Senku: [
    { name: 'Nitro Burst',         type: 'damage',  effect: '• Deals 210% ATK damage\n• 45% chance to inflict burn for 3 turns',                                      description: 'Glycerin, a steady hand, and a very confident explanation of what happens next.' },
    { name: 'Stone Formula',       type: 'damage',  effect: '• Deals 190% ATK damage\n• 40% chance to freeze for 2 turns',                                            description: 'Petrification is just very fast chemistry.' },
    { name: 'Science Is Power',    type: 'passive', effect: '• Passive: +20% skill damage\n• Passive: ignore 10% of target DEF',                                      description: 'The slogan is a stat line, if you measure it properly.' },
    { name: 'Revival Serum',       type: 'heal',    effect: '• Heal 35% of max HP\n• Removes all debuffs from you',                                                   description: 'Tastes like chalk and victory.' },
    { name: 'Smoke Screen',        type: 'debuff',  effect: '• Deals 70% ATK damage\n• Inflicts blind on all enemies for 2 turns',                                    description: 'Potassium nitrate, sugar, and a refusal to be hit.' },
    { name: 'Electric Spear',      type: 'damage',  effect: '• Deals 240% ATK damage\n• 35% chance to paralyze for 2 turns',                                          description: 'A battery, a coil, and someone else\'s bad day.' },
    { name: 'Ten Billion Plans',   type: 'damage',  effect: '• Hits all enemies for 150% ATK damage\n• -20% enemy DEF for 3 turns',                                    description: 'You do not improvise. You had this planned on Tuesday.' },
    { name: 'Alchemic Barrier',    type: 'buff',    effect: '• +45% DEF for 3 turns\n• Reflects 15% of damage taken',                                                 description: 'Glass is just sand that learned to say no.' },
    { name: 'Acid Flask',          type: 'damage',  effect: '• Deals 180% ATK damage\n• 60% chance to inflict poison for 4 turns',                                     description: 'Handle with tongs. Throw with confidence.' },
    { name: 'Radar Pulse',         type: 'buff',    effect: '• +20% accuracy for 3 turns\n• +15% crit chance for 3 turns',                                            description: 'You measured the fight before it noticed.' },
    { name: 'Concrete Sealing',     type: 'debuff',  effect: '• Deals 160% ATK damage\n• Inflicts silence on target for 2 turns',                                     description: 'Some problems are load-bearing. This one is not.' },
    { name: 'Gasoline Trail',      type: 'damage',  effect: '• Deals 200% ATK damage\n• 55% chance to inflict burn for 4 turns',                                       description: 'Chemistry, but with more consequences.' },
    { name: 'Prototype Exosuit',   type: 'buff',    effect: '• +30% ATK for 3 turns\n• +30% speed for 3 turns\n• Immune to trueslow while active',                     description: 'Version one. There will be a version two mid-fight.' },
    { name: 'Magnetic Rail',       type: 'damage',  effect: '• Deals 300% ATK damage\n• Ignores 50% of target DEF',                                                   description: 'The projectile arrives before the sound does.' },
    { name: 'Antivenom Mist',      type: 'heal',    effect: '• Heal 25% of max HP\n• Removes poison, bleed and burn from you',                                         description: 'The cure was synthesised an hour ago. You are welcome.' },
    { name: 'Thermite Cascade',    type: 'damage',  effect: '• Deals 360% ATK damage\n• 70% chance to inflict burn for 4 turns',                                      description: 'Rust, at a temperature that files a complaint.' },
    { name: 'Logical Advantage',   type: 'passive', effect: '• Passive: +25% damage against targets above 50% HP\n• Passive: -1 turn on all cooldowns',                description: 'You do not out-muscle anyone. You out-count them.' },
    { name: 'Kinetic Launcher',    type: 'damage',  effect: '• Deals 340% ATK damage\n• 40% chance to stun for 1 turn\n• -20% enemy accuracy for 2 turns',              description: 'Physics is free. Aiming is the expensive part.' },
    { name: 'Senku Overdrive',     type: 'buff',    effect: '• +60% ATK for 4 turns\n• +40% speed for 4 turns\n• Skills cost 30% less energy for its duration',         description: 'The hypothesis is that you lose. The experiment begins now.' },
    { name: 'Perseus Cannon',      type: 'damage',  effect: '• Deals 520% ATK damage\n• Ignores all DEF\n• 35% chance to stun for 1 turn',                             description: 'A mirror, a sun, and the audacity to aim both at one target.' },
  ],
};

// ── Normalise one raw entry into a catalog skill ─────────────────────────────
function isPassive0(effect) { return /•\s*passive/i.test(String(effect || '')); }
// ── Push #94: parse the SUPPORT CONTRACT out of an effect text ───────────────
function parseSupportFields(effect, parsed) {
  const out = { convertPct: 0, convertTurns: 2, shieldPct: 0, shieldMode: 'pool', shieldTurns: 3, immuneTurns: 0, energyPct: 0, regen: null, damageTakenPct: 0, damageTakenTurns: 3, reflectPct: 0, reflectTurns: 3, cleanse: false, party: false, any: false, extraBuffs: [] };
  const lines = String(effect || '').split('\n').map(l => l.toLowerCase().replace(/\*\*/g, ''));
  const whole = lines.join(' ');
  const turnsIn = (l, dflt) => { const m = l.match(/(\d+)\s*(?:turns?|rounds?)/); return m ? Math.max(1, Math.min(10, parseInt(m[1], 10))) : dflt; };
  const pctIn = (l) => { const m = l.match(/(\d{1,3})\s*%/); return m ? Math.max(1, Math.min(100, parseInt(m[1], 10))) : 0; };
  for (const l of lines) {
    if (!l.trim() || /^\s*•?\s*passive/.test(l)) continue;
    // Push #96h-t: "Converts 40% of damage taken into HP recovery next turn" → convertPct contract
    { const cm = l.match(/converts?\s+(\d{1,3})\s*%\s*of\s+(?:the\s+)?damage\s+taken\s+into\s+(?:hp|health)/); if (cm) { out.convertPct = Math.max(1, Math.min(100, parseInt(cm[1], 10))); out.convertTurns = turnsIn(l, 2); continue; } }
    const aboutEnemy = (/\b(enemy|enemies|foe|opponent)\b/.test(l) || (/\btarget'?s?\b/.test(l) && /deals?|damage|dmg|drain|steal|inflict|debuff|-\s*\d+%/.test(l) && !/gains?|shield|heal|restor|regen/.test(l))) && !/\b(you|your|self|ally|allies|party|team)\b/.test(l);
    // "+40% ATK/DEF" / "+30% ATK & DEF" → BOTH stats (the parser only reads the first)
    {
      const m = l.match(/\+\s*(\d{1,3})\s*%\s*(atk|attack|def|defen[cs]e|spd|speed)\s*(?:\/|&|and|,)\s*(atk|attack|def|defen[cs]e|spd|speed)\b/) || l.match(/(atk|attack|def|defen[cs]e|spd|speed)\s*(?:\/|&|and|,)\s*(atk|attack|def|defen[cs]e|spd|speed)\s*\+\s*(\d{1,3})\s*%/);
      if (m && !aboutEnemy && !/enemy|target/.test(l)) {
        const amt = parseInt(m[1].match(/^\d+$/) ? m[1] : m[3], 10);
        const names = (m[1].match(/^\d+$/) ? [m[2], m[3]] : [m[1], m[2]]).map(x => /^atk|attack/.test(x) ? 'atk' : /^def/.test(x) ? 'def' : 'speed');
        for (const st of names) out.extraBuffs.push({ stat: st, amount: amt, duration: turnsIn(l, 3) });
      }
    }
    // vague stat promises → concrete buffs ("All stats up", "Buffs allies", "Massive defense")
    if (!pctIn(l)) {
      if (/\ball\s+stats\s+(?:up|boost\w*|increas\w*|rais\w*)|boosts?\s+all\s+stats|empower\w*\s+(?:all|party|allies)/.test(l)) { for (const st of ['atk', 'def', 'speed']) out.extraBuffs.push({ stat: st, amount: 25, duration: turnsIn(l, 3) }); }
      else if (/^\W*buffs?\s+(?:all\s+)?(?:allies|party|all)\b|^\W*buffs?\s+allies/.test(l)) { for (const st of ['atk', 'def']) out.extraBuffs.push({ stat: st, amount: 15, duration: turnsIn(l, 3) }); }
      else if (/massive\s+defen[cs]e|impenetrable\s+(?:armou?r|defen[cs]e)|unbreakable\s+guard/.test(l)) out.extraBuffs.push({ stat: 'def', amount: 50, duration: turnsIn(l, 3) });
    }
    // shield / barrier / block
    if (/\bshield|barrier|\babsorbs?\b|blocks? (?:the )?next|\bward\b/.test(l) && !/breaks?\s+(?:enemy\s+)?shield|ignores?[^.]*shield|shield\s*(?:break|pierc|stance|bash|slam|charge|throw)|through\s+shield|bypass/.test(l) && !aboutEnemy) {
      const pct = pctIn(l);
      const rate = /of\s+(?:each|every|all|incoming|magic|physical|monster)?\s*(?:damage|hits?|dmg)|\d+%\s+each/.test(l);
      const hits = l.match(/next\s+(\d+)\s+hits?/);
      if (pct || hits) {
        out.shieldPct = Math.max(out.shieldPct, pct || 30);
        out.shieldMode = rate ? 'rate' : 'pool';
        out.shieldTurns = hits ? Math.max(2, parseInt(hits[1], 10)) : turnsIn(l, 3);
      } else if (/\bshield\b|\bbarrier\b/.test(l)) {
        out.shieldPct = Math.max(out.shieldPct, 30); out.shieldTurns = turnsIn(l, 3);
      }
    }
    // immunity / invulnerability / block all / untargetable / dodge all
    const immuneGeneral = /(?:complete|total|full)\s+immunity|immun(?:e|ity)\s*(?:to\s+(?:all\s+)?(?:damage|everything)|(?:for\s+)?\d+\s+turns?|$|[,.;)+&]|and\s|for\s|after\s|next\s)|^\W*immune\W*$|invulnerab|block(?:s)?\s+all\s+damage|cannot\s+be\s+(?:hit|damaged|targeted)|untargetable|dodge\s+all|become\s+invisible|invisible\s+for|phase\s+out/.test(l.trim() + ' ')
      && !/ignores?|bypass|pierc|cc\s+immun|status\s+immun|crowd|immun(?:e|ity)\s+to\s+(?:all\s+)?(?:cc|stun|status|fear|freez|slow|debuff|bleed|burn|poison|silence|knockback|weaken|elements?|magic|effects)/.test(l);
    if (immuneGeneral && !aboutEnemy) {
      out.immuneTurns = Math.max(out.immuneTurns, turnsIn(l, 1));
    }
    // energy restore
    if (/\benergy\b|\bmana\b(?!\s*stones?)/.test(l) && !/cost|spend|drain\w*\s+(?:enemy|target)|steal|-\s*\d+\s*energy/.test(l)) {
      const m = l.match(/(?:restor\w*|regain\w*|recover\w*|regenerat\w*|refill\w*|gains?|grants?)\s+(?:up\s+to\s+)?(?:\w+\s+){0,3}?(\d{1,3})\s*%\s*(?:of\s+)?(?:their\s+|your\s+)?(?:max(?:imum)?\s*)?(?:energy|mana)/)
        || l.match(/(\d{1,3})\s*%\s*(?:of\s+)?(?:max(?:imum)?\s*)?(?:energy|mana)\s+(?:restored|regen\w*|recovered|back)/)
        || l.match(/(?:energy|mana)\s*\+\s*(\d{1,3})\s*%/) || l.match(/\+\s*(\d{1,3})\s*%\s*(?:max\s+)?(?:energy|mana)\b/);
      if (m) out.energyPct = Math.max(out.energyPct, Math.min(100, parseInt(m[1], 10)));
    }
    // regen (HoT)
    if (/heal|regen|restor|recover/.test(l) && /(?:per|each|every)\s+turn|\/\s*turn|over\s+time|\bhot\b|over\s+\d+\s+turns/.test(l) && !/dmg\/turn|damage\/turn|damage per turn|poison|burn|bleed/.test(l) && !aboutEnemy) {
      const pct = pctIn(l) || 5;
      const turns = turnsIn(l, 3);
      if (!out.regen || pct > out.regen.pct) out.regen = { pct, turns };
    }
    // damage reduction on self / party
    if (!aboutEnemy) {
      const m = l.match(/(?:damage|dmg)\s+(?:taken\s+)?(?:reduced|reduction|-)\s*(?:by\s+)?(\d{1,3})\s*%/) || l.match(/(?:reduces?|reduc\w+|take|takes)\s+(?:all\s+)?(?:incoming\s+)?(?:damage|dmg)(?:\s+taken)?\s+(?:by\s+)?(\d{1,3})\s*%/) || l.match(/(?:takes?|take)\s+(\d{1,3})\s*%\s+less/) || l.match(/damage\s+taken\s*-\s*(\d{1,3})\s*%/) || l.match(/-\s*(\d{1,3})\s*%\s*(?:damage|dmg)\s+taken/);
      if (m) { out.damageTakenPct = Math.max(out.damageTakenPct, Math.min(90, parseInt(m[1], 10))); out.damageTakenTurns = turnsIn(l, 3); }
      else if (/massive defen[cs]e|impenetrable|fortress/.test(l) && !pctIn(l)) { out.damageTakenPct = Math.max(out.damageTakenPct, 40); out.damageTakenTurns = turnsIn(l, 3); }
    }
    // reflect
    if (/reflect/.test(l) && !/reflects?\s+(?:the\s+)?(?:enemy|target)|cannot\s+be[^.]*reflect|be\s+reflected|^\W*enem/.test(l)) {
      const pct = pctIn(l) || 30;
      out.reflectPct = Math.max(out.reflectPct, Math.min(100, pct)); out.reflectTurns = turnsIn(l, 3);
    }
    // cleanse
    if (/cleanse|purif|remov\w*\s+(?:all\s+|\d+\s+|one\s+|1\s+)?(?:your\s+|ally\s+|party\s+)?(?:debuffs?|status(?:\s+effects?)?|ailments?|curses?)|clears?\s+(?:all\s+)?(?:debuffs?|status)/.test(l) && !/enemy|target'?s?\s+buffs?|removes?\s+(?:all\s+)?(?:enemy\s+)?buffs|cannot\s+be\s+cleansed|can't\s+be\s+cleansed/.test(l)) out.cleanse = true;
  }
  const scope = whole.replace(/(?:all|every)\s+(?:your\s+)?(?:de)?buffs?/g, ' ').replace(/all\s+(?:status\s+)?(?:effects|ailments)/g, ' ').replace(/(?:all|every)\s+enem(?:y|ies)/g, ' ');
  out.party = /\b(all\s+(?:allies|party|members|alive\s+allies|ko'd\s+allies)|entire\s+party|every\s+ally|whole\s+party|party(?:\s+members|-wide)?|allies|team(?:mates)?|aoe\s+buff|area\s+buff|group\s+buff|aoe\s+heal)\b/.test(scope);
  out.any = !!(out.shieldPct || out.immuneTurns || out.energyPct || out.regen || out.damageTakenPct || out.reflectPct || out.cleanse || out.extraBuffs.length || (parsed && parsed.buffs && parsed.buffs.length));
  return out;
}

// ── Push #94: APPLY the support contract to one unit (self or an ally) ───────
// Returns { lines }. Shields use the generic absorb model (Necromancy.absorb);
// immunity = an unbreakable full-rate shield; regen/reflect/damage-taken ride
// in tempBuffs and tick down with UnifiedCombat.tickStatuses.
function applySupportFields(entry, caster, target, opts = {}) {
  const lines = [];
  if (!entry || !target || !target.stats) return { lines };
  const u = target;
  const who = opts.name || u.name || 'ally';
  const max = (() => { try { return (opts.effMaxOf && opts.effMaxOf(u)) || require('./GearSystem').effectiveMaxHp(u); } catch (e) { return u.stats.maxHp || 100; } })();
  const power = Number(opts.healPower) || 1;
  u.tempBuffs = u.tempBuffs || {};
  if (entry.convertPct > 0) {
    u.tempBuffs.convert = { pct: entry.convertPct, duration: (entry.convertTurns || 2) + 1, source: entry.name };
    lines.push(`🩸 *${who}* converts ${entry.convertPct}% of damage taken into HP next turn (${entry.convertTurns || 2} turns)`);
  }
  if (entry.immuneTurns > 0) {
    u.tempBuffs.shield = { amount: 1e9, pct: 1, duration: entry.immuneTurns + 1, source: `${entry.name} (immunity)`, immune: true };
    lines.push(`🛡️ *${who}* is IMMUNE to damage for ${entry.immuneTurns} turn${entry.immuneTurns === 1 ? '' : 's'}`);
  } else if (entry.shieldPct > 0) {
    const cur = u.tempBuffs.shield;
    if (!(cur && cur.immune)) {
      const rate = entry.shieldMode === 'rate';
      const pool = Math.max(1, Math.floor(max * (rate ? 0.6 : entry.shieldPct / 100) * power));
      u.tempBuffs.shield = { amount: pool, pct: rate ? entry.shieldPct / 100 : 1, duration: (entry.shieldTurns || 3) + 1, source: entry.name };
      lines.push(rate ? `🛡️ *${who}* warded — ${entry.shieldPct}% of every hit absorbed for ${entry.shieldTurns} turns (${pool} HP pool)` : `🛡️ *${who}* shielded for ${pool} HP (${entry.shieldPct}% max HP, ${entry.shieldTurns} turns)`);
    }
  }
  if (entry.energyPct > 0 && u.stats.maxEnergy) {
    const e = Math.floor(u.stats.maxEnergy * entry.energyPct / 100);
    const before = u.stats.energy || 0;
    u.stats.energy = Math.min(u.stats.maxEnergy, before + e);
    if (u.stats.energy - before > 0) lines.push(`⚡ *${who}* +${u.stats.energy - before} energy (${entry.energyPct}% max)`);
  }
  if (entry.regen && entry.regen.pct > 0) {
    u.tempBuffs.regen = { pct: entry.regen.pct, duration: entry.regen.turns + 1, source: entry.name, power };
    lines.push(`💞 *${who}* regenerates ${entry.regen.pct}% max HP per turn for ${entry.regen.turns} turns`);
  }
  if (entry.damageTakenPct > 0) {
    u.tempBuffs[`${entry.name}:dr`] = { stat: 'damageTaken', amount: -Math.abs(entry.damageTakenPct), duration: (entry.damageTakenTurns || 3) + 1 };
    lines.push(`🧱 *${who}* takes ${entry.damageTakenPct}% less damage for ${entry.damageTakenTurns} turns`);
  }
  if (entry.reflectPct > 0) {
    u.tempBuffs.reflect = { pct: entry.reflectPct, duration: (entry.reflectTurns || 3) + 1, source: entry.name };
    lines.push(`🪞 *${who}* reflects ${entry.reflectPct}% of damage taken for ${entry.reflectTurns} turns`);
  }
  if (entry.cleanse && Array.isArray(u.statusEffects) && u.statusEffects.length) {
    const n = u.statusEffects.length; u.statusEffects = [];
    lines.push(`✨ *${who}* cleansed (${n} effect${n === 1 ? '' : 's'})`);
  }
  try { if (lines.length && caster && (caster.jid || caster.dailyQuests)) require('./DailyQuestSystem').creditBuff(caster); } catch (e) {} // Push #96h: buff quest
  return { lines };
}

// ── Push #96h-k: THE TEXT IS THE CONTRACT ──────────────────────────────────
// EffectParser covers the common phrasings; everything it misses ("STUN + SLOW +
// SILENCE all", "Burns everything", "25% chance to PARALYZE", "+100% dodge for 1
// turn", "-40% all enemy stats 3 turns", "20% BLIND chance per hit" over 7 hits…)
// is picked up here so EVERY status, buff and debuff a description promises is a
// number the engines apply. Conditional / defensive mentions ("immune to", "vs
// bleeding enemies", "cannot be slowed", "melts freeze effects") are NOT statuses.
const STATUS_WORDS = [
  [/\bburn(?:s|ing|ed)?\b|\bignite/i, 'burn'], [/\bpoison(?:s|ed|ous)?\b|\bvenom/i, 'poison'], [/\bbleed(?:s|ing)?\b|\bhemorrhag/i, 'bleed'],
  [/\bstun(?:s|ned|ning)?\b|\bknock(?:s|ed)?\s*(?:down|back)|\bknockback|\bknockdown/i, 'stun'], [/\bfreez(?:e|es|ing)\b|\bfrozen\b/i, 'freeze'],
  [/\bfears?\b|\bfeared\b|\bterrif(?:y|ies|ied)|\bfrighten/i, 'fear'], [/\bsilence[sd]?\b/i, 'silence'], [/\bblind(?:s|ed|ing)?\b/i, 'blind'],
  [/\bparalyz(?:e|es|ed|ing)\b/i, 'paralyze'], [/\bcurse[sd]?\b/i, 'curse'], [/\bslow(?:s|ed)?\b/i, 'trueslow'], [/\bweaken(?:s|ed)?\b/i, 'weaken'],
];
const NOT_A_STATUS_LINE = /immun|resist|cleans|remov|strip|cure|purif|ignor|cannot be|can't be|\bvs\.?\b|against|if (?:the )?(?:target|enemy)|who were|consum\w* all|melts?|stacks?\b|thaw|dispel|unaffected|while (?:feared|stunned|bleeding|burning|poisoned|frozen|cursed|silenced|blinded)/i;
function _lineStatuses(line, whole = '') {
  const out = []; const raw = String(line || ''); if (!raw.trim()) return out;
  const l = raw.replace(/uncleansable|unremovable|undispellable/gi, '');
  if (NOT_A_STATUS_LINE.test(l)) return out;
  const found = []; for (const [rx, type] of STATUS_WORDS) { const m = l.match(rx); if (m) found.push({ type, at: m.index }); }
  if (!found.length) return out;
  const dur = (() => { const m = l.match(/(\d+)\s*(?:turns?|t\b|rounds?)/i); return m ? Number(m[1]) : 2; })();
  const hits = (() => { const src = `${l}\n${whole}`; const m = src.match(/(\d+)\s*(?:hits?|arrows?|strikes?|constructs?|shots?|impacts?)\s*[×x]/i) || src.match(/[×x]\s*(\d+)/i); return m ? Number(m[1]) : 0; })();
  const guaranteed = /guaranteed|\ball\b|applied|inflicts?|force|everything|always|\bon all\b/i.test(l);
  for (const f of found) {
    // the % nearest BEFORE the status word, else "N% chance" anywhere on the line
    const before = l.slice(0, f.at); const pm = [...before.matchAll(/(\d{1,3})\s*%\s*(?:chance\s*)?(?:to\s*(?:inflict\s*)?|of\s*)?$/gi)].pop() || [...before.matchAll(/(\d{1,3})\s*%\s*(?:chance\s*)?(?:to\s+)?(?:inflict\s+)?(?:\w+\s+){0,2}$/gi)].pop();
    let chance = pm ? Number(pm[1]) : (() => { const m = l.match(/(\d{1,3})\s*%\s*chance/i); return m ? Number(m[1]) : (guaranteed ? 100 : 70); })();
    if (/each|per (?:hit|arrow|strike|construct|shot)/i.test(l) && hits > 1 && chance < 100) chance = Math.round(100 * (1 - Math.pow(1 - chance / 100, hits)));
    out.push({ type: f.type, chance: Math.max(5, Math.min(100, chance)), duration: Math.max(2, dur) });
  }
  return out;
}
const STAT_ALIAS = { atk: 'atk', attack: 'atk', 'magic damage': 'atk', damage: 'atk', dmg: 'atk', 'magic power': 'atk', 'magic pwr': 'atk', def: 'def', defense: 'def', defence: 'def', armor: 'def', armour: 'def', spd: 'speed', speed: 'speed', agility: 'speed', crit: 'crit', 'crit chance': 'crit', 'critical chance': 'crit', 'crit rate': 'crit', dodge: 'dodge', evasion: 'dodge', accuracy: 'accuracy', 'all stats': 'all', 'all enemy stats': 'all', 'max hp': 'maxhp' };
for (const k of ['crit', 'crit chance', 'critical chance', 'crit rate']) STAT_ALIAS[k] = 'critChance'; // EffectParser's name for it
const STAT_RX = 'atk|attack|magic damage|magic power|magic pwr|damage|dmg|def|defen[cs]e|armou?r|spd|speed|agility|crit(?: chance| rate)?|critical chance|dodge|evasion|accuracy|all (?:enemy )?stats';
function augmentContract(effect, parsed, statuses) {
  const addS = [], addB = [], addD = [];
  const has = (arr, stat) => (arr || []).some(x => x && x.stat === stat);
  for (const line of String(effect || '').split('\n')) {
    const l = line.replace(/^[•\s]+/, '');
    if (/^passive/i.test(l)) continue;
    for (const st of _lineStatuses(l, effect)) if (!statuses.some(s => s.type === st.type) && !addS.some(s => s.type === st.type)) addS.push(st);
    const dur = (() => { const m = l.match(/(\d+)\s*(?:turns?|t\b|rounds?)/i); return m ? Number(m[1]) : null; })();
    // buffs: "+30% ATK", "ATK +30%", "Next attack +50% DMG", "+100% dodge for 1 turn"
    for (const m of l.matchAll(new RegExp(`\\+\\s*(\\d{1,3})\\s*%\\s*(${STAT_RX})\\b`, 'gi'))) {
      const pre = l.slice(Math.max(0, m.index - 24), m.index);
      if (/enemy|enemies|target|their|foe|opponent/i.test(pre) || /taken/i.test(l.slice(m.index, m.index + m[0].length + 8))) continue; // "+20% damage taken" is a debuff
      if (/vs|against|if\b/i.test(l.slice(m.index + m[0].length, m.index + m[0].length + 12)) && /damage|dmg/i.test(m[2])) continue; // "+100% damage vs boss" is a conditional multiplier, not a buff
      const stat = STAT_ALIAS[m[2].toLowerCase().replace(/defence/, 'defense').replace(/armour/, 'armor')] || 'atk'; if (stat === 'maxhp') continue;
      const d = dur || (/next (?:attack|hit|strike)|this turn/i.test(l) ? 1 : 2);
      for (const s of (stat === 'all' ? ['atk', 'def', 'speed'] : [stat])) if (!has(parsed.buffs, s) && !has(addB, s)) addB.push({ stat: s, amount: Math.min(300, Number(m[1])), duration: d });
    }
    for (const m of l.matchAll(new RegExp(`\\b(${STAT_RX})\\s*\\+\\s*(\\d{1,3})\\s*%`, 'gi'))) {
      const stat = STAT_ALIAS[m[1].toLowerCase()] || 'atk'; if (stat === 'maxhp') continue; if (/enemy|target|their/i.test(l.slice(Math.max(0, m.index - 24), m.index))) continue;
      if (/\d\s*%\s*(?:\w+\s+)?$/.test(l.slice(Math.max(0, m.index - 14), m.index))) continue; // "200% damage + 80% AOE" is arithmetic, not a buff
      for (const s of (stat === 'all' ? ['atk', 'def', 'speed'] : [stat])) if (!has(parsed.buffs, s) && !has(addB, s)) addB.push({ stat: s, amount: Math.min(300, Number(m[2])), duration: dur || 2 });
    }
    // debuffs: "-25% SPEED 3 turns", "-40% all enemy stats", "Terrifies enemies -10% ATK", "+20% damage taken"
    for (const m of l.matchAll(new RegExp(`[-−]\\s*(\\d{1,3})\\s*%\\s*(?:enemy\\s+|target\\s+|their\\s+|all\\s+enemy\\s+)?(${STAT_RX})\\b`, 'gi'))) {
      if (/\byour\b|\bself\b|\byou\b/i.test(l) && !/enemy|target|their/i.test(l)) continue; // self-debuffs are the parser's job
      if (/permanent/i.test(l) && /max hp/i.test(m[2])) continue;
      const stat = STAT_ALIAS[m[2].toLowerCase().replace(/defence/, 'defense').replace(/armour/, 'armor')] || 'atk'; if (stat === 'maxhp' || stat === 'dodge') continue;
      for (const s of (stat === 'all' ? ['atk', 'def', 'speed'] : [stat])) if (!has(parsed.debuffs, s) && !has(addD, s)) addD.push({ stat: s, amount: Math.min(90, Number(m[1])), duration: dur || 3 });
    }
    const dt = l.match(/\+\s*(\d{1,3})\s*%\s*(?:more\s+)?damage\s+taken/i); if (dt && !has(parsed.debuffs, 'damageTaken') && !has(addD, 'damageTaken') && !/\byou\b|\byour\b|self/i.test(l)) addD.push({ stat: 'damageTaken', amount: Number(dt[1]), duration: dur || 3 });
  }
  return { statuses: addS, buffs: addB, debuffs: addD };
}
// A status the text only mentions defensively ("Immune to slow/freeze", "Strips poison")
// is not a status the skill inflicts — drop it, whichever parser guessed it.
function pruneStatuses(effect, statuses) {
  const lines = String(effect || '').split('\n').map(l => l.replace(/uncleansable|unremovable/gi, ''));
  return statuses.filter(st => {
    const rx = STATUS_WORDS.find(([, t]) => t === st.type); if (!rx) return true; // engine-only types (ruin…) stay
    return lines.some(l => rx[0].test(l) && !NOT_A_STATUS_LINE.test(l));
  });
}

// Push #96h-m: per-class power multiplier (skills + buffs).
const CLASS_POWER = { Archer: 1.5, Berserker: 1.5 };
function normalise(className, raw, index) {
  const name   = String(raw.name || `Skill ${index + 1}`).trim();
  const effect = ensureParseable(raw.effect || '• Deals 100% ATK damage');
  let   desc   = String(raw.description || raw.desc || raw.lore || '').trim();
  // Some source rows carry a stub ("💀 Killing shot"). Attack patterns never
  // read like that, and skills are meant to, so short lore is expanded with
  // the skill's real mechanics instead of shipping a one-liner.
  // Push #94: short/stub/missing flavour → generated per skill (see
  // SkillFlavour): name-driven imagery + class voice + type structure + tier
  // note, deterministic, and distinct for every skill in the game. The exact
  // mechanics sentence is appended below once the type is known.
  let _needFlavour = desc.length < 45 || /doctrine of|is a signature .* technique/i.test(desc);

  let parsed = { damage: true, damageMultiplier: 0, statusEffects: [], buffs: [], debuffs: [], special: [] };
  try {
    if (EffectParser && typeof EffectParser.parseSkillEffects === 'function') {
      parsed = { ...parsed, ...(EffectParser.parseSkillEffects(effect) || {}) };
    }
  } catch (e) { /* parser drift must never brick a skill */ }

  let selfHeal = (parsed.special || []).find(s => s && s.type === 'selfHeal');

  // Push #71 — RECOVERY DETECTION FOR EVERY CLASS.
  // EffectParser only tagged "heal you / major heal / lay on hands", so
  // Healer's "Heals 40% max HP", Shaman's "Heal 60% max HP", Paladin's
  // "Allies heal 15%…", Monk's "Heal 25% HP + …" all came through as plain
  // damage with healingPct 0 → the button said "healed" nothing. Any effect
  // line that heals/restores/regenerates HP now yields a real heal %.
  if (!selfHeal) {
    const txt = `${effect}\n${desc}`;
    const isLifesteal = /lifesteal|drain|leech|siphon|steal/i.test(txt) && !/heal(?:s|ing)?\s+\d+%|restor/i.test(effect);
    const healLine = effect.split('\n').find(l => /\b(heal|heals|healing|restore|restores|regenerat\w*|recover|recovers|mend|renew\w*|revive|revives)\b/i.test(l) && /\bhp|health|max hp|wound|party|all(?:y|ies)|self|you\b/i.test(l) && !/damage.*heal|heal.*damage dealt/i.test(l));
    if (healLine && !isLifesteal) {
      const m = healLine.match(/(\d{1,3})\s*%/);
      let pct = m ? parseInt(m[1], 10) : 0;
      if (!pct) pct = /world|miracle|resurrect|revive|sanctuary|supreme|massive/i.test(healLine) ? 60 : /greatly|major|mass|full/i.test(healLine) ? 45 : 25;
      selfHeal = { type: 'selfHeal', percent: Math.max(5, Math.min(100, pct)), inferred: true };
    }
  }

  // Push #88b: exact HP percentages from the effect text.
  const _hpPct = (() => {
    const out = { heal: null, drain: 0, drainHeal: 0, cost: 0 };
    for (const raw0 of String(effect || '').split('\n')) {
      const l = raw0.toLowerCase();
      if (!/\bhp\b|health/.test(l)) continue;
      // the % nearest to the word HP ("200% ATK + steals 50% of target max HP" → 50)
      const all = [...l.matchAll(/(\d{1,3})\s*%/g)]; if (!all.length) continue;
      const hpAt = l.search(/\bhp\b|health/);
      let pm = all[0]; for (const m of all) if (Math.abs(m.index - hpAt) < Math.abs(pm.index - hpAt)) pm = m;
      const pct = Math.min(100, parseInt(pm[1], 10));
      if (/per turn|\/turn|hot:|over time/.test(l)) continue; // ticking effects handled as statuses
      if (/shield|absorb/.test(l)) continue;
      if (/(?:costs?|sacrific\w*|lose|spend|pay|consum\w*)\s+(?:\d+%\s*)?(?:of\s+)?(?:your\s+|own\s+)?(?:max\s+|current\s+)?hp|(\d+)%\s*(?:of\s+)?(?:your\s+)?(?:max\s+)?hp\s+(?:as\s+)?(?:cost|sacrific)/.test(l)) { out.cost = Math.max(out.cost, pct); continue; }
      const aboutEnemy = /enemy|enemies|target|their|foe|opponent/.test(l);
      const drainy = /drain|steal|siphon|leech|absorb|takes?|removes?|deals?\s+\d+%\s*(?:of\s+)?(?:max\s+)?hp|-\s*\d+%/.test(l);
      if (aboutEnemy && drainy && !/if\s+(?:enemy|target)|below|<|under|when\s+(?:enemy|target)/.test(l)) {
        const d = Math.min(50, pct); // hard cap: no single cast removes >50% of a max-HP pool
        out.drain = Math.max(out.drain, d);
        if (/drain|steal|siphon|leech|absorb|as heal|restores?/.test(l)) {
          const half = /half/.test(l);
          out.drainHeal = Math.max(out.drainHeal, half ? Math.round(d / 2) : d);
        }
        continue;
      }
      if (/heal|restor|recover|regenerat|reviv/.test(l) && !/damage dealt|of damage|damage taken/.test(l) && !aboutEnemy) {
        // Prefer the LIVING-ally heal line over the revive line when both exist.
        const isRevive = /reviv|ko'd|dead/.test(l);
        if (out.heal == null || (!isRevive && out._reviveOnly)) { out.heal = pct; out._reviveOnly = isRevive; }
      }
    }
    if (out.drain && out.heal == null && out.drainHeal) { /* drain heals handled by drainHealPct, not healingPct */ }
    delete out._reviveOnly;
    return out;
  })();

  const statuses = (parsed.statusEffects || [])
    .map(s => {
      if (!s || !s.type) return null;
      let t = String(s.type).toLowerCase();
      if (t === 'slow') t = 'trueslow';   // parser emits generic 'slow'; the engine owns 'trueSlow'
      return { ...s, type: t };
    })
    .filter(s => s && SUPPORTED_STATUS.has(s.type))
    .map(s => ({
      type: s.type,
      chance: Math.max(5, Math.min(100, Number(s.chance ?? s.percent ?? 100))),
      duration: Math.max(2, Number(s.duration ?? s.turns ?? 2)), // Push #72: multi-turn
    }));

  // Push #96h-k: everything else the text promises.
  try {
    const extra = augmentContract(effect, parsed, statuses);
    for (const s of extra.statuses) statuses.push(s);
    { const kept = pruneStatuses(effect, statuses); statuses.length = 0; statuses.push(...kept); }
    parsed.buffs = parsed.buffs || []; parsed.debuffs = parsed.debuffs || [];
    for (const b of extra.buffs) parsed.buffs.push(b);
    for (const d of extra.debuffs) parsed.debuffs.push(d);
  } catch (e) {}
  // Push #94: EXPLICIT SUPPORT CONTRACT — every shield / immunity / energy /
  // regen / reflect / damage-reduction / cleanse / party promise in the text
  // becomes a number the engines apply (no more regex-at-cast-time guessing).
  const support = parseSupportFields(effect, parsed);
  if (support.extraBuffs.length) {
    parsed.buffs = parsed.buffs || [];
    for (const b of support.extraBuffs) if (!parsed.buffs.some(x => x && x.stat === b.stat)) parsed.buffs.push(b);
  }

  let type        = String(raw.type || (statuses.length && !parsed.damageMultiplier ? 'debuff' : 'damage')).toLowerCase();
  // Push #71: a healing move with no stated ATK multiplier IS a heal skill.
  if (type === 'damage' && selfHeal && !parsed.damageMultiplier) type = 'heal';
  // Push #88c: a move whose text never states an ATK%/damage but heals,
  // cleanses, shields or buffs is SUPPORT — never a strike (Purify, Dominion,
  // Blood Frenzy, Aura of Light…). "It attacked instead of healing" bug.
  if (type === 'damage' && !isPassive0(effect)) {
    const lc = String(effect || '').toLowerCase();
    const lcD = lc.replace(/(?:damage|dmg)\s+(?:taken|reduction|reduced|less)|(?:reduce|less|-\s*\d+%)[^.\n]*?(?:damage|dmg)|deal\s+\d+%\s+less|heals?\s+\d+%\s+of\s+damage|of\s+damage\s+taken|immune[^\n]*/g, ' ');
    const statesDamage = /(?<![+\-−])\b\d+\s*%\s*(?:atk|attack|physical|magic|magical|holy|dark|fire|ice|true|aoe|water|blood|shadow|lightning|damage|dmg)|\b(?:deals?|dealing)\b|\bdamage\b|\bdmg\b|\bstrike\b|\bhits?\b|\bslash|\bshot\b|\barrow\b|\bbolt\b|\bblast|\bpierce|\bexecute|\bsmash|\bcrush|\bkill\b(?!\s+restores)|\bnova\b|\bstorm\b|\bbreath\b|\bclaw\b|\bbite\b/.test(lcD);
    const isSupportText = /\b(heal|heals|restores?|cleanse|purif|remov\w* (?:all |1 |one )?debuff|strips?\b|shield|barrier|\+\d+%\s*(?:atk|def|spd|speed|all stats|crit)|(?:atk|def|spd|speed|all stats)\s*\+\d+%|dodge all|immun|revive|reviv)/.test(lc);
    if (!statesDamage && isSupportText) {
      const firstLine = lc.split('\n')[0];
      const buffFirst = /[+]\d+%|\b(?:atk|def|spd|speed|all stats)\s*\+|dodge all|immun|shield|barrier/.test(firstLine);
      type = buffFirst ? 'buff' : (/heal|restores?|cleanse|purif|reviv/.test(lc) ? 'heal' : 'buff');
    }
    // Push #94: no stated ATK multiplier + a support contract (Iron Wall
    // "+200% DEF", Divine Shield "Block ALL damage", Blessing of Kings "All
    // stats up", Divine Protection "Complete immunity") = a BUFF, not a strike.
    else if (support.any && (() => {
      const lcS = lcD.replace(/block\w*\s+all\s+damage|immun\w*\s+to\s+(?:all\s+)?damage|reflects?\s+(?:\d+%\s+)?(?:of\s+)?(?:magic\s+|physical\s+)?damage|damage\s+reduction|damage\s+boost|of\s+damage|absorbs?[^.\n]*damage|(?:heals?|healed)\s+\d+%\s+of\s+damage/g, ' ');
      return !/(?<![+\-−])\b\d+\s*%\s*(?:atk|attack|physical|magic|magical|holy|dark|fire|ice|true|aoe|water|blood|shadow|lightning|void|spirit|damage|dmg)/.test(lcS) && !/\bdamage\b|\bdmg\b|\b(?:deals?|dealing|strikes?|hits?|slash\w*|shots?|arrows?|blasts?|pierc\w*)\b/.test(lcS);
    })()) {
      type = (selfHeal || support.regen) ? 'heal' : 'buff';
    }
  }
  const isPassive = type === 'passive' || /•\s*passive/i.test(effect);

  const energyCost = Math.max(0, Number(
    raw.energyCost ?? raw.manaCost ?? raw.holyCost ?? raw.hungerCost ??
    raw.rageCost ?? raw.focusCost ?? raw.chiCost ?? raw.cost ?? (isPassive ? 0 : 20 + index * 2)
  ) || 0);

  // Push #96h-k: a cost written in the effect text ("• 100 energy — …") IS the cost.
  const _statedCost = (() => { const m = String(effect || '').match(/(?:^|\n)[•\s]*(\d{1,3})\s*(?:energy|mana|rage|focus|chi|holy|hunger)\b/i) || String(effect || '').match(/costs?\s*(\d{1,3})\s*(?:energy|mana)/i); return m ? Number(m[1]) : null; })();
  const energyCostFinal = isPassive ? 0 : (_statedCost != null ? _statedCost : (energyCost > 0 ? energyCost : 20 + index * 2)); // no free active skills
  // Damage as a % of ATK. If the description states a multiplier, honour it;
  // otherwise ramp by index so late skills are meaningfully stronger.
  const statedPct = parsed.damageMultiplier ? Math.round(parsed.damageMultiplier * 100) : 0;
  let damagePct = isPassive ? 0
    : type === 'heal' ? (statedPct || 40)
    : type === 'buff' ? (statedPct || 100) // Push #88: a buff skill still lands a full-strength strike, then the buff doubles what follows
    : (statedPct || 100 + index * 6);
  // Push #96h-m: CLASS POWER — Archer & Berserker skills AND buffs are 50% stronger. Applied to
  // the contract numbers themselves so the listed Mechanics line and the engines agree.
  const _cp = CLASS_POWER[className] || 1;
  if (_cp !== 1) {
    if (damagePct > 0) damagePct = Math.round(damagePct * _cp);
    for (const b of (parsed.buffs || [])) if (b && b.amount > 0) b.amount = Math.round(b.amount * _cp);
    for (const d of (parsed.debuffs || [])) if (d && d.amount > 0) d.amount = Math.round(d.amount * _cp);
    if (support.shieldPct) support.shieldPct = Math.min(100, Math.round(support.shieldPct * _cp));
    if (support.regen && support.regen.pct) support.regen.pct = Math.round(support.regen.pct * _cp);
    if (support.damageTakenPct) support.damageTakenPct = Math.min(90, Math.round(support.damageTakenPct * _cp));
    if (support.reflectPct) support.reflectPct = Math.round(support.reflectPct * _cp);
    if (selfHeal && selfHeal.percent) selfHeal.percent = Math.round(selfHeal.percent * _cp);
    if (_hpPct.heal) _hpPct.heal = Math.round(_hpPct.heal * _cp);
  }

  // Push #76: every description ends with a plain-language mechanics summary
  // (multiplier, buffs, debuffs, statuses, heal, cost) so a player knows
  // exactly what the skill does before spending energy on it.
  if (_needFlavour) {
    try {
      const SF = require('./SkillFlavour');
      desc = SF.flavourFor({ className, name, type: isPassive ? 'passive' : type, index, total: SKILLS_PER_CLASS });
      if (raw._signature && raw._lore) desc = `${desc} Class creed: "${String(raw._lore).replace(/\.$/, '')}."`;
    } catch (e) { desc = `${name} — a ${className} technique.`; }
  }
  const _mech = [];
  if (!isPassive && damagePct > 0 && type !== 'heal' && type !== 'buff') _mech.push(`${damagePct}% ATK`);
  for (const b of (parsed.buffs || [])) _mech.push(`${support.party && !isPassive ? 'party' : 'self'} ${String(b.stat).toUpperCase()} +${b.amount}% for ${b.duration || 2} turns`);
  for (const d of (parsed.debuffs || [])) _mech.push(d.stat === 'damageTaken' ? `target takes +${d.amount}% damage for ${d.duration || 3} turns` : `target ${String(d.stat).toUpperCase()} -${d.amount}% for ${d.duration || 3} turns`);
  for (const st of statuses) _mech.push(`${st.chance}% to inflict ${st.type.toUpperCase()} (${st.duration}t)`);
  const _healingPct = _hpPct.heal != null ? _hpPct.heal : _hpPct.drain ? 0 : (Math.round(Number(selfHeal && selfHeal.percent) || 0) || (type === 'heal' ? 20 + index : 0));
  if (_healingPct > 0) _mech.push(`heals ${_healingPct}% max HP${support.party ? (className === 'Healer' ? ' to the whole party' : ' (self — party healing is a Healer power)') : ''}`);
  if (support.shieldPct) _mech.push(support.shieldMode === 'rate' ? `shield absorbs ${support.shieldPct}% of each hit for ${support.shieldTurns} turns` : `shield worth ${support.shieldPct}% max HP for ${support.shieldTurns} turns`);
  if (support.immuneTurns) _mech.push(`immune to damage for ${support.immuneTurns} turn${support.immuneTurns === 1 ? '' : 's'}`);
  if (support.energyPct) _mech.push(`restores ${support.energyPct}% max energy`);
  if (support.regen) _mech.push(`regenerates ${support.regen.pct}% max HP per turn for ${support.regen.turns} turns`);
  if (support.damageTakenPct) _mech.push(`damage taken -${support.damageTakenPct}% for ${support.damageTakenTurns} turns`);
  if (support.convertPct) _mech.push(`converts ${support.convertPct}% of damage taken into HP next turn (${support.convertTurns} turns)`);
  if (support.reflectPct) _mech.push(`reflects ${support.reflectPct}% of damage taken for ${support.reflectTurns} turns`);
  if (support.cleanse) _mech.push(`cleanses status effects`);
  if (support.party && !isPassive && !(parsed.buffs || []).length && !_healingPct) _mech.push(`reaches the whole party`);
  // Push #96h-t: show the REAL number — a non-Healer's heal lists the doubled cost it actually pays.
  if (!isPassive) _mech.push(type === 'heal' && className !== 'Healer' ? `${energyCostFinal * 2} energy (heals cost ×2 outside the Healer class)` : `${energyCostFinal} energy`);
  if (_mech.length && !/Mechanics:/.test(desc)) desc = `${desc.replace(/\s+$/, '')}${/[.!?]["”]?$/.test(desc) ? '' : '.'} Mechanics: ${_mech.join(' · ')}.`;
  else if (!_mech.length && isPassive && !/Mechanics:/.test(desc)) desc = `${desc.replace(/\s+$/, '')}${/[.!?]$/.test(desc) ? '' : '.'} Mechanics: passive — ${effect.split('\n')[0].replace(/^[•\s]*(?:passive:\s*)?/i, '').replace(/\*\*/g, '')}.`;

  return {
    name, className, index,
    type: isPassive ? 'passive' : type,
    isPassive, fromClassFile: !!raw.fromClassFile,
    description: desc,
    effect,
    animation: raw.animation || `⚡ ${name}!\n💥 The technique lands!`,
    cooldown: Math.max(0, Number(raw.cooldown ?? 2) || 0),          // turns (legacy unit)
    energyCost: energyCostFinal,
    damagePct,
    flatDamage: Number(raw.damage ?? 0) || 0,
    healingPct: _healingPct,
    // Push #88b: "% of HP" is a CONTRACT. drainPct = % of target max HP taken
    // (healed back to caster unless drainHeals=false); selfCostPct = % of own
    // max HP paid to cast. Engines apply exactly these numbers, nothing else.
    drainPct: _hpPct.drain || 0,
    drainHealPct: _hpPct.drainHeal || 0,
    selfCostPct: _hpPct.cost || 0,
    lifestealPct: _lifestealPct(effect, desc, parsed), // Push #96h-z20: "heals for X% of damage dealt" is a CONTRACT every engine pays
    buffs: parsed.buffs || [],
    debuffs: parsed.debuffs || [],
    selfDebuffs: parsed.selfDebuffs || [],
    statuses,
    // Push #94 support contract (applied by applySupportFields in every engine)
    shieldPct: support.shieldPct, shieldMode: support.shieldMode, shieldTurns: support.shieldTurns,
    immuneTurns: support.immuneTurns,
    energyPct: support.energyPct,
    regen: support.regen,
    damageTakenPct: support.damageTakenPct, damageTakenTurns: support.damageTakenTurns,
    reflectPct: support.reflectPct, reflectTurns: support.reflectTurns,
    convertPct: support.convertPct || 0, convertTurns: support.convertTurns || 2,
    cleanse: support.cleanse,
    party: support.party,
    unlocksAtLevel: Math.min(100, (index + 1) * UNLOCK_STEP),
    level: 1,
    maxLevel: MAX_SKILL_LEVEL,
    _generated: !!raw._generated,
  };
}

// ── Per-class roster (memoised) ──────────────────────────────────────────────
const _rosterCache = new Map();

function buildRoster(className, variant = null) {
  if (!className) return [];
  const cacheKey = className === 'Monster' && variant ? `Monster|${variant}` : className;
  if (_rosterCache.has(cacheKey)) return _rosterCache.get(cacheKey);

  let raws = [];
  if (EXPLICIT[className]) {
    raws = EXPLICIT[className].map(r => ({ ...r }));
  } else if (SD && SD.skillDatabase && SD.skillDatabase[className]) {
    const db = SD.skillDatabase[className];
    raws = Object.keys(db).map(name => ({ name, ...db[name] }));
  }

  // A class file's own signature moves come first, so a class always opens
  // with the skills its lore promises (Berserker's 'Rage', Warrior's 'Battle Cry').
  try {
    const CS = require('./ClassSystem');
    const cls = CS.CLASS_DATA && CS.CLASS_DATA[className];
    if (cls && Array.isArray(cls.skills)) {
      const seen = new Set(raws.map(r => String(r.name).toLowerCase()));
      for (const s of cls.skills) {
        if (!s || !s.name || seen.has(String(s.name).toLowerCase())) continue;
        seen.add(String(s.name).toLowerCase());
        // Fill {p} / {p/N} with the move's potency — the raw class file keeps
        // placeholders and they were leaking into /skills ("absorbing {p}%").
        const pot = Number(s.maxPotency) || 0;
        const fill = (t) => String(t || '').replace(/{p\/(\d+)}/g, (_, d) => String(Math.floor(pot / parseInt(d, 10)))).replace(/{p}/g, String(pot));
        raws.unshift({
          name: s.name, type: s.type, maxPotency: pot, fromClassFile: true,
          // Push #76: real lore, not a stub — class lore + what the move does.
          // Push #94: flavour is generated per skill (SkillFlavour) — the old
          // "is a signature <Class> technique" stamp read identically on 100+ skills.
          description: undefined, _signature: true, _lore: cls.lore || null,
          effect: s.desc ? `• ${fill(s.desc)}` : undefined,
          energyCost: s.type === 'passive' ? 0 : 25,
          cooldown: s.type === 'passive' ? 0 : 2,
        });
      }
    }
  } catch (e) { /* ClassSystem optional */ }

  // De-duplicate, then pad/trim to exactly SKILLS_PER_CLASS.
  const uniq = new Set();
  raws = raws.filter(r => {
    const k = String(r.name || '').toLowerCase();
    if (!k || uniq.has(k)) return false;
    uniq.add(k);
    return true;
  });
  // Passives go LAST in the ladder. Left in source order a class could put a
  // passive in slot 1, and a freshly awakened Lv.5 hunter would own nothing
  // castable — every /skill then reads as "no skills".
  const isPassiveRaw = (r) => {
    const t = String(r && r.type || '').toLowerCase();
    return t === 'passive' || /•\s*passive|passive:/i.test(String(r && r.effect || ''));
  };
  raws = [...raws.filter(r => !isPassiveRaw(r)), ...raws.filter(isPassiveRaw)];

  let gi = 0;
  while (raws.length < SKILLS_PER_CLASS) raws.push(generateSkill(className, raws.length + gi++));
  if (raws.length > SKILLS_PER_CLASS) raws = raws.slice(0, SKILLS_PER_CLASS);

  // Push #92: every Monster VARIANT has its own roster — names + element procs.
  if (className === 'Monster' && variant && !/^monster$/i.test(String(variant))) {
    try { const MVK = require('../data/MonsterVariantKits'); let ai = 0, pi = 0; raws = raws.map((r) => { const ps = isPassiveRaw(r); return MVK.reskin(r, variant, ps ? pi++ : ai++, ps); }); } catch (e) {}
  }
  const roster = raws.map((r, i) => normalise(className, { ...r, unlocksAtLevel: (i + 1) * UNLOCK_STEP }, i));
  // Push #88q: the Healer is a pure support class — every non-passive Healer
  // skill is a SUPPORT cast (heal/buff). Two library entries ("World Heal",
  // "Transcendent Light") were typed `damage` and hit for 100% ATK in PvP.
  if (className === 'Healer') for (const e of roster) { if (e && e.type !== 'passive' && e.type !== 'heal' && e.type !== 'buff') { e.type = (e.healingPct || 0) > 0 || !(e.buffs || []).length ? 'heal' : 'buff'; if (!(e.healingPct > 0) && e.type === 'heal') e.healingPct = 25; e.damagePct = 0; } }
  // Push #88w: MONSTER TRANSFORMATIONS — the Lv.10/20/30/40/50/60 slots of
  // the Monster ladder (every variant) are the six transformation forms; all
  // other slots keep their skills. Names carry the variant ("…: Blood Bat").
  if (className === 'Monster') {
    try {
      const TF = require('./Transformation');
      for (const raw of TF.rosterEntries(variant)) {
        const idx = roster.findIndex(e => e && e.unlocksAtLevel === raw.unlocksAtLevel);
        if (idx < 0) continue;
        const e = normalise(className, { ...raw }, idx);
        e.transform = raw.transform; e.type = 'buff'; e.damagePct = 0; e.buffs = []; e.debuffs = []; e.statuses = []; e.healingPct = 0;
        e.energyCost = raw.energyCost; e.cooldown = raw.cooldown; e.unlocksAtLevel = raw.unlocksAtLevel; e.isPassive = false;
        e.effect = raw.effect; e.description = raw.description; e.animation = raw.animation; e.name = raw.name;
        roster[idx] = e;
      }
    } catch (e) { /* transformations optional */ }
  }
  // Push #93: NECROMANCER REFORGED — Bone Wall / Soul Drain / Curse of Ruin
  // replace their slots (same unlock level) with the redesigned mechanics.
  try {
    const NX = require('./Necromancy');
    const ov = NX.REFORGED[className];
    if (ov) for (const [oldName, o] of Object.entries(ov)) {
      const idx = roster.findIndex(e => e && String(e.name).toLowerCase() === oldName.toLowerCase());
      if (idx < 0) continue;
      const { rename, ...rest } = o;
      roster[idx] = { ...roster[idx], ...rest, name: rename || roster[idx].name, isPassive: false, reforged: true, lifestealPct: _lifestealPct(rest.effect || roster[idx].effect, '', null) };
    }
  } catch (e) {}
  _rosterCache.set(cacheKey, roster);
  return roster;
}

function getRoster(player) {
  const cls = canonicalClassName(player);
  if (cls === 'Monster') { try { require('./ClassSystem').ensureMonsterVariant(player); } catch (e) {} try { return buildRoster('Monster', require('./Transformation').variantName(player)); } catch (e) {} }
  return buildRoster(cls);
}

// Skill level → damage/cost/cooldown modifiers (identical maths to the old
// /skills so nobody's upgraded skills silently get weaker).
function levelBonus(skill) {
  const lv = Math.max(1, Math.min(MAX_SKILL_LEVEL, skill.level || 1));
  return { lv, dmgMult: 1 + (lv - 1) * 0.08, costReduction: (lv - 1) * 3, cdReduction: Math.floor((lv - 1) * 0.5) };
}

function effectiveCost(skill, caster = null) {
  const b = levelBonus(skill);
  let c = Math.max(5, (skill.energyCost || 0) - b.costReduction);
  if (caster) { try { const ed = require('./JobSystem').mod(caster, 'energyDiscount'); if (ed) c = Math.max(5, Math.floor(c * (1 - ed / 100))); } catch (e) {} } // Push #95: Starforged
  // Push #88d: heals are a Healer's craft — every other class pays DOUBLE energy.
  if (caster && String(skill && skill.type || '').toLowerCase() === 'heal') {
    let base = '';
    try { base = String(require('./ClassPower').baseClassName(caster) || ''); } catch (e) { base = String(caster.classBase || caster.class || ''); }
    if (!/^healer$/i.test(base)) c = c * 2;
  }
  return c;
}

function effectiveCooldownTurns(skill) {
  return Math.max(0, (skill.cooldown || 0) - levelBonus(skill).cdReduction);
}

// Cooldowns are stored as real timestamps so they survive a redeploy.
function cooldownMs(skill) {
  const turns = effectiveCooldownTurns(skill);
  return Math.max(0, Math.round(turns * 2500));   // one turn ≈ 2.5s of chat cadence
}

function skillUpgradeCost(level) {
  const costs = [45000, 150000, 360000, 900000]; // Push #74: ×3 for all classes
  return costs[(level || 1) - 1] ?? null;
}

// ── Damage ───────────────────────────────────────────────────────────────────
function computeDamage(player, skill, opts = {}) {
  const st = player.stats || {};
  const b = levelBonus(skill);
  const atk = Number(st.atk || 10);
  const magic = Number(st.magicPower || 0);
  const base = opts.includeMagic ? (atk * 0.7 + magic * 0.5) : atk;
  const pct = ((skill.damagePct || 100) / 100) * b.dmgMult;
  let dmg = base * pct + (skill.flatDamage || 0) * b.dmgMult;
  if (opts.crit) dmg = dmg * (1 + (Number(st.critDamage || 150) - 100) / 100);
  // Push #96h-z19: job-skill riders (elite / execute bonuses, armor pen)
  if (skill.jobSkill && opts.target) {
    const tg = opts.target; const thp = tg.stats ? tg.stats.hp : tg.hp, tmax = tg.stats ? tg.stats.maxHp : tg.maxHp;
    if (skill.eliteBonus && (tg.isBoss || tg.boss || tg.elite)) dmg *= 1 + skill.eliteBonus / 100;
    if (skill.executeBonus && tmax > 0 && thp / tmax <= 0.35) dmg *= 1 + skill.executeBonus / 100;
  }
  dmg = Math.max(1, Math.floor(dmg));
  if (opts.def) dmg = Math.max(1, dmg - Math.floor(Number(opts.def) * (1 - Math.min(0.6, (Number(skill.armorPen) || 0) / 100)) * 0.35));
  if (opts.target) { // Push #72: status synergy
    try { const syn = require('./StatusSynergy').bonusFor(skill, opts.target); if (syn.mult !== 1) { dmg = Math.max(1, Math.floor(dmg * syn.mult)); if (opts.notes) opts.notes.push(...syn.notes); } } catch (e) {}
  }
  return dmg;
}

// ── Player-facing skill object ───────────────────────────────────────────────
function toPlayerSkill(player, entry) {
  return {
    name: entry.name,
    className: entry.className,
    type: entry.type,
    damage: entry.flatDamage || Math.round(((player.stats?.atk || 10) * (entry.damagePct / 100)) || 20),
    damagePct: entry.damagePct,
    energyCost: entry.energyCost,
    cooldown: entry.cooldown,
    level: entry.level || 1,
    maxLevel: MAX_SKILL_LEVEL,
    unlockedAt: entry.unlocksAtLevel,
    unlocksAtLevel: entry.unlocksAtLevel,
    description: entry.description,
    effect: entry.effect,
    animation: entry.animation,
    statuses: entry.statuses,
    buffs: entry.buffs,
    debuffs: entry.debuffs, selfDebuffs: entry.selfDebuffs || [],
    healingPct: entry.healingPct,
    drainPct: entry.drainPct || 0, drainHealPct: entry.drainHealPct || 0, selfCostPct: entry.selfCostPct || 0, lifestealPct: entry.lifestealPct || 0,
    isPassive: entry.isPassive,
  };
}

function isUnlockedFor(player, entry) {
  const lvl = Number(player?.level || 1);
  if (lvl >= (entry.unlocksAtLevel || 99)) return true;
  // Push #74c: class-file signature skills are level-gated ONLY — they were
  // never part of the old schedule, so an override for one can only have come
  // from the classSkills leak.
  if (entry.fromClassFile) return false;
  return !!(player?.skills?.unlockedOverrides || []).includes(entry.name);
}

// ── The one sync every path calls ────────────────────────────────────────────
/**
 * Make player.skills match the catalog for this class + level.
 *   • unlocks every skill whose level requirement is met (instantly — no
 *     waiting for a "special" tick)
 *   • auto-equips into empty slots (maxSkillSlots, default 5)
 *   • parks the rest in player.availableSkills (the library)
 *   • moves not-yet-unlocked entries to player.skills.locked
 *   • hoists passives to player.skills.passive (always on, never equipped)
 *   • refreshes stale copies whose numbers drifted from the catalog
 *   • prunes skills the catalog does not recognise (renames, and the old
 *     privileged "unlock everything" grants)
 * Idempotent and cheap — safe to call from any command.
 */
function syncPlayerSkills(player) {
  if (!player) return { changed: false, equipped: 0, unlocked: 0 };
  const roster = getRoster(player);
  if (!roster.length) return { changed: false, equipped: 0, unlocked: 0 };

  player.skills = player.skills || {};
  for (const k of ['active', 'locked', 'passive', 'unlockedOverrides']) {
    if (!Array.isArray(player.skills[k])) player.skills[k] = [];
  }
  if (!player.skills.cooldowns || typeof player.skills.cooldowns !== 'object') player.skills.cooldowns = {};
  if (!Array.isArray(player.availableSkills)) player.availableSkills = [];

  const maxSlots = Math.max(1, Number(player.maxSkillSlots || 5));
  let changed = false;
  const nameOf = (s) => String(s?.name || '').toLowerCase();
  // Push #93: renamed skills (Life Drain → Curse of Ruin) keep their level.
  try {
    const RN = require('./Necromancy').RENAMES;
    if (canonicalClassName(player) === 'Necromancer') {
      for (const arr of [player.skills.active, player.skills.locked, player.skills.passive, player.availableSkills]) for (const sk of arr) { const nn = RN[nameOf(sk)]; if (nn) { sk.name = nn; changed = true; } }
      player.skills.unlockedOverrides = player.skills.unlockedOverrides.map(n => RN[String(n).toLowerCase()] || n);
    }
  } catch (e) {}
  // Push #92: Monster hunters who still hold the old shared names ("Primal
  // Strike"…) are renamed slot-for-slot to their variant's roster — levels kept.
  try {
    if (canonicalClassName(player) === 'Monster') {
      const generic = buildRoster('Monster', null);
      const map = new Map();
      generic.forEach((g, i) => { if (g && roster[i] && g.name !== roster[i].name) map.set(String(g.name).toLowerCase(), roster[i].name); });
      if (map.size) for (const arr of [player.skills.active, player.skills.locked, player.skills.passive, player.availableSkills]) {
        for (const sk of arr) { const nn = map.get(nameOf(sk)); if (nn) { sk.name = nn; changed = true; } }
      }
      if (map.size) player.skills.unlockedOverrides = player.skills.unlockedOverrides.map(n => map.get(String(n).toLowerCase()) || n);
    }
  } catch (e) {}

  // A skill the player already owns stays theirs. The catalog re-ladders
  // unlock levels, so without this a Lv.40 hunter would WAKE UP missing the
  // skills they earned under the old schedule. Owners of the old privileged
  // "everything unlocked" grants are normalised by /fixskills, which clears
  // these overrides explicitly.
  // Push #74c: player.classSkills is the class's FULL kit (display data written
  // at awakening) — it was being fed in here as "already owned", which
  // unlocked every class-file skill at Lv.1 and gave hunters two overlapping
  // skill sets. Only genuinely owned arrays seed overrides now, and any
  // override that came from a class-file entry is revoked unless the level
  // requirement is really met.
  {
    const classFileNames = new Set(roster.filter(e => e.fromClassFile).map(e => e.name));
    const before = player.skills.unlockedOverrides.length;
    player.skills.unlockedOverrides = player.skills.unlockedOverrides.filter(n => !classFileNames.has(n));
    if (player.skills.unlockedOverrides.length !== before) changed = true;
  }
  const _cfNames = new Set(roster.filter(e => e.fromClassFile).map(e => e.name));
  for (const arr of [player.skills.active, player.availableSkills]) {
    if (!Array.isArray(arr)) continue;
    for (const s of arr) {
      const n = String(s?.name || '').trim();
      if (n && !_cfNames.has(n) && !player.skills.unlockedOverrides.includes(n)) {
        player.skills.unlockedOverrides.push(n);
        changed = true;
      }
    }
  }

  for (const entry of roster) {
    const n = entry.name.toLowerCase();
    const inActive = player.skills.active.find(s => nameOf(s) === n);
    const inLib    = player.availableSkills.find(s => nameOf(s) === n);
    const inPass   = player.skills.passive.find(s => nameOf(s) === n);
    const inLocked = player.skills.locked.find(s => nameOf(s) === n);
    const open     = isUnlockedFor(player, entry);
    const fresh    = toPlayerSkill(player, entry);

    if (entry.isPassive) {
      if (!inPass) { player.skills.passive.push(fresh); changed = true; }
      else if (inPass.effect !== fresh.effect || inPass.description !== fresh.description) { Object.assign(inPass, fresh, { level: inPass.level || 1 }); changed = true; }
      for (const arr of [player.skills.active, player.availableSkills, player.skills.locked]) {
        const i = arr.findIndex(s => nameOf(s) === n);
        if (i >= 0) { arr.splice(i, 1); changed = true; }
      }
      continue;
    }

    if (open) {
      if (inLocked) {
        const i = player.skills.locked.findIndex(s => nameOf(s) === n);
        const keptLevel = player.skills.locked[i]?.level || 1;
        player.skills.locked.splice(i, 1);
        const target = player.skills.active.length < maxSlots ? player.skills.active : player.availableSkills;
        if (!inActive && !inLib) target.push({ ...fresh, level: keptLevel });
        changed = true;
      }
      const holder = inActive || inLib;
      if (!holder) {
        (player.skills.active.length < maxSlots ? player.skills.active : player.availableSkills).push(fresh);
        changed = true;
      } else if (holder.effect !== fresh.effect || holder.damagePct !== fresh.damagePct
              || holder.energyCost !== fresh.energyCost || holder.cooldown !== fresh.cooldown
              || holder.description !== fresh.description || holder.type !== fresh.type // Push #94: new flavour / retyped support skills reach live hunters
              || !Array.isArray(holder.statuses) || JSON.stringify(holder.statuses) !== JSON.stringify(fresh.statuses) // Push #96h-k: contract changes reach live hunters
              || JSON.stringify(holder.buffs || []) !== JSON.stringify(fresh.buffs || []) || JSON.stringify(holder.debuffs || []) !== JSON.stringify(fresh.debuffs || [])) {
        Object.assign(holder, fresh, { level: holder.level || 1 });
        changed = true;
      }
    } else {
      if (inActive || inLib) {
        const src = inActive ? player.skills.active : player.availableSkills;
        const i = src.findIndex(s => nameOf(s) === n);
        src.splice(i, 1);
        player.skills.locked.push(fresh);
        changed = true;
      } else if (!inLocked) {
        player.skills.locked.push(fresh);
        changed = true;
      } else {
        Object.assign(inLocked, fresh, { level: inLocked.level || 1 });
      }
    }
  }

  // Prune anything the catalog does not own (old all-skills grants, renames).
  const rosterNames = new Set(roster.map(r => r.name.toLowerCase()));
  for (const arr of [player.skills.active, player.availableSkills, player.skills.locked, player.skills.passive]) {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (!rosterNames.has(nameOf(arr[i]))) { arr.splice(i, 1); changed = true; }
    }
  }
  // Push #88e: NO duplicate skills. The same skill can only live once across
  // the bar + library (kept the highest-level copy, bar copy wins ties).
  {
    const seen = new Map();
    const keyOf = (s) => String((s && s.name) || '').toLowerCase().trim();
    const all = [...player.skills.active.map((s, i) => ({ s, where: 'active', i })), ...player.availableSkills.map((s, i) => ({ s, where: 'lib', i }))];
    for (const e of all) {
      const k = keyOf(e.s); if (!k) continue;
      const prev = seen.get(k);
      if (!prev) { seen.set(k, e); continue; }
      const lvE = Number(e.s.level || 1), lvP = Number(prev.s.level || 1);
      if (lvE > lvP) { prev.drop = true; seen.set(k, e); } else { e.drop = true; }
      changed = true;
    }
    if (all.some(e => e.drop)) {
      const keepAct = all.filter(e => e.where === 'active' && !e.drop).map(e => e.s);
      const keepLib = all.filter(e => e.where === 'lib' && !e.drop).map(e => e.s);
      // a higher-level library copy replaces a dropped bar copy in place
      const droppedBar = all.filter(e => e.where === 'active' && e.drop);
      for (const d of droppedBar) { const winner = seen.get(keyOf(d.s)); if (winner && winner.where === 'lib') { const li = keepLib.indexOf(winner.s); if (li >= 0) { keepLib.splice(li, 1); keepAct.push(winner.s); } } }
      player.skills.active = keepAct;
      player.availableSkills = keepLib;
    }
  }
  while (player.skills.active.length > maxSlots) {
    player.availableSkills.unshift(player.skills.active.pop());
    changed = true;
  }

  // Push #74c: keep the bar full — unlocked skills that landed in the library
  // only because the bar was momentarily full move up when a slot frees.
  while (player.skills.active.length < maxSlots && player.availableSkills.length) {
    player.skills.active.push(player.availableSkills.shift());
    changed = true;
  }

  return { changed, equipped: player.skills.active.length, unlocked: player.skills.active.length + player.availableSkills.length };
}

// ── Tolerant resolution: name | "12" | prefix | index ────────────────────────
/** @returns {{ok:boolean, skill?:object, entry?:object, source?:string, locked?:boolean, unlockAt?:number, error?:string}} */
function resolveSkill(player, query, opts = {}) {
  if (!player) return { ok: false, error: 'No player.' };
  const roster = getRoster(player);
  if (!roster.length) {
    return { ok: false, error: '❌ You have no class yet — skills awaken with it. Check /class for your progress.' };
  }
  syncPlayerSkills(player);

  const qRaw = String(query ?? '').trim();
  if (!qRaw) return { ok: false, error: 'Which skill? Use /skill <name> or /skill <number>.' };

  // Push #96h-z19: JOB SKILLS resolve by exact name / key / "j1".."j3" before class skills (fuzzy after).
  let _jobFuzzy = null;
  try { const JSk = require('./JobSkills'); const jr = JSk.resolve(player, qRaw, { exactOnly: true }); if (jr) return jr; _jobFuzzy = JSk; } catch (e) {}

  const asNum = parseInt(qRaw, 10);
  if (!isNaN(asNum) && String(asNum) === qRaw.split(' ')[0]) {
    const equipped = player.skills.active || [];
    const library  = player.availableSkills || [];
    if (asNum >= 1 && asNum <= equipped.length) {
      const s = equipped[asNum - 1];
      return { ok: true, skill: s, source: 'active', entry: scaleEntry(findBy(s.name, roster), s.level) };
    }
    if (opts.allowLibrary !== false && asNum - equipped.length >= 1 && asNum - equipped.length <= library.length) {
      const s = library[asNum - equipped.length - 1];
      return { ok: true, skill: s, source: 'library', entry: scaleEntry(findBy(s.name, roster), s.level) };
    }
  }

  const q = qRaw.toLowerCase().replace(/^\/?(skill|use|cast)\s*/i, '').trim();
  const byName = (arr) => Array.isArray(arr)
    ? (arr.find(s => String(s.name).toLowerCase() === q)
      || arr.find(s => String(s.name).toLowerCase().startsWith(q))
      || arr.find(s => String(s.name).toLowerCase().includes(q)))
    : null;

  const active = byName(player.skills.active);
  if (active) return { ok: true, skill: active, source: 'active', entry: scaleEntry(findBy(active.name, roster), active.level) };

  if (opts.allowLibrary !== false) {
    const lib = byName(player.availableSkills);
    if (lib) return { ok: true, skill: lib, source: 'library', entry: scaleEntry(findBy(lib.name, roster), lib.level) };
  }

  const lock = byName(player.skills.locked);
  if (lock) {
    return { ok: false, locked: true, skill: lock, entry: findBy(lock.name, roster), unlockAt: lock.unlocksAtLevel,
             error: `🔒 *${lock.name}* is still locked — it unlocks at *Lv.${lock.unlocksAtLevel}* (you are Lv.${player.level || 1}).` };
  }

  const cat = byName(roster);
  if (cat) {
    if (isUnlockedFor(player, cat)) {
      const fresh = toPlayerSkill(player, cat);
      (player.skills.active.length < (player.maxSkillSlots || 5) ? player.skills.active : player.availableSkills).push(fresh);
      return { ok: true, skill: fresh, source: 'catalog', entry: cat };
    }
    return { ok: false, locked: true, entry: cat, unlockAt: cat.unlocksAtLevel,
             error: `🔒 *${cat.name}* unlocks at *Lv.${cat.unlocksAtLevel}* (you are Lv.${player.level || 1}).` };
  }

  try { if (_jobFuzzy) { const jr = _jobFuzzy.resolve(player, qRaw); if (jr) return jr; } } catch (e) {}
  const unlockedN = roster.filter(r => !r.isPassive && isUnlockedFor(player, r)).length;
  return { ok: false, error: `❌ Skill *${qRaw}* not found.\nYou have ${unlockedN} unlocked skills — list them with /skill.` };
}

// ── Push #96h-z19: SUPPORT EFFECTS GROW WITH SKILL LEVEL ─────────────────────
// Damage already scales via levelBonus().dmgMult; every buff / shield / regen /
// damage-reduction / reflect / energy / heal promise now scales too:
// ×1 → ×1.17 → ×1.33 → ×1.5 → ×1.67 (a 150% boost becomes 175% → 200% → 225% → 250%).
function supportMult(level) { const lv = Math.max(1, Math.min(MAX_SKILL_LEVEL, Number(level) || 1)); return 1 + (lv - 1) / 6; }
function scaleEntry(entry, level) {
  const lv = Math.max(1, Math.min(MAX_SKILL_LEVEL, Number(level) || 1));
  if (!entry || lv <= 1) return entry;
  const m = supportMult(lv); const up = (v, cap) => Math.min(cap, Math.round((Number(v) || 0) * m));
  const sb = (arr) => (arr || []).map(b => b && typeof b === 'object' ? { ...b, amount: Math.round((Number(b.amount) || 0) * m) } : b);
  const out = { ...entry, level: lv, _scaled: m,
    buffs: sb(entry.buffs), debuffs: sb(entry.debuffs), extraBuffs: sb(entry.extraBuffs),
    shieldPct: entry.shieldPct ? up(entry.shieldPct, 100) : entry.shieldPct,
    regen: entry.regen && entry.regen.pct ? { ...entry.regen, pct: up(entry.regen.pct, 30) } : entry.regen,
    damageTakenPct: entry.damageTakenPct ? up(entry.damageTakenPct, 85) : entry.damageTakenPct,
    reflectPct: entry.reflectPct ? up(entry.reflectPct, 100) : entry.reflectPct,
    energyPct: entry.energyPct ? up(entry.energyPct, 100) : entry.energyPct,
    convertPct: entry.convertPct ? up(entry.convertPct, 100) : entry.convertPct,
    healingPct: entry.healingPct ? up(entry.healingPct, 100) : entry.healingPct,
    immuneTurns: entry.immuneTurns ? entry.immuneTurns + (lv >= 5 ? 2 : lv >= 3 ? 1 : 0) : entry.immuneTurns,
  };
  return out;
}
function findBy(name, roster) {
  const n = String(name || '').toLowerCase();
  return roster.find(r => r.name.toLowerCase() === n) || null;
}

// ── Cooldown bookkeeping (timestamps, so a redeploy cannot reset them) ───────
function onCooldown(player, skill) {
  const key = String(skill?.name || '').toLowerCase();
  const stamp = Number((player.skillCooldowns || {})[key] || (player.skills?.cooldowns || {})[skill?.name] || 0);
  if (stamp > Date.now()) return { ready: false, msLeft: stamp - Date.now() };
  return { ready: true, msLeft: 0 };
}

function setCooldown(player, skill) {
  const ms = cooldownMs(skill);
  const key = String(skill?.name || '').toLowerCase();
  if (ms > 0) {
    player.skillCooldowns = player.skillCooldowns || {};
    player.skillCooldowns[key] = Date.now() + ms;
    if (player.skills) {
      player.skills.cooldowns = player.skills.cooldowns || {};
      player.skills.cooldowns[skill.name] = Date.now() + ms;
    }
  }
  player.lastSkillUse = player.lastSkillUse || {};
  player.lastSkillUse[skill.name] = Date.now();
}

// ── Display helpers (unlocked-only) ──────────────────────────────────────────
function unlockedSkills(player)  { return getRoster(player).filter(r => !r.isPassive && isUnlockedFor(player, r)); }
function lockedSkills(player)    { return getRoster(player).filter(r => !r.isPassive && !isUnlockedFor(player, r)); }
function passiveSkills(player)   { return getRoster(player).filter(r => r.isPassive); }

// ── Reset (used by /fixskills and awakening flows) ──────────────────────────
function resetPlayerSkills(player) {
  if (!player) return null;
  player.skills = { active: [], passive: [], locked: [], cooldowns: {}, unlockedOverrides: [] };
  player.availableSkills = [];
  player.skillCooldowns = {};
  player.lastSkillUse = {};
  return syncPlayerSkills(player);
}


// ── Push #96h-z20: LIFESTEAL contract ──────────────────────────────────────
// "Heal for 50% of damage dealt", "heals you for half the damage dealt", "35% lifesteal", "restores 20% of
// damage as HP" → lifestealPct. Applied by every engine AFTER the real damage is known (applyLifesteal).
function _lifestealPct(effect, desc, parsed) {
  const txt = `${effect || ''}\n${desc || ''}`;
  const lines = txt.split('\n');
  let pct = 0;
  for (const raw of lines) {
    const l = raw.toLowerCase();
    if (!/damage|lifesteal|leech|siphon/.test(l)) continue;
    if (/per turn|\/turn|over time|enemy heal|target heal|their heal|reduces? heal|damage taken|no heal|cannot heal|can't heal/.test(l)) continue;
    let m = l.match(/(?:heal|heals|restore|restores|recover|recovers|regain|regains|gain|gains|drain|drains|steal|steals|siphon|siphons|absorb|absorbs|converts?)[^%\n]{0,24}?(\d{1,3})\s*%\s*(?:of\s+)?(?:the\s+)?(?:total\s+)?damage(?:\s+dealt)?/);
    if (!m) m = l.match(/(\d{1,3})\s*%\s*(?:of\s+)?(?:the\s+)?damage(?:\s+dealt)?\s*(?:is\s+)?(?:(?:as|into|to)\s+(?:hp|health|life)|returned|back|restored|healed|heals|lifesteal)/);
    if (!m) m = l.match(/(\d{1,3})\s*%\s*lifesteal|lifesteal[^%\n]{0,12}?(\d{1,3})\s*%/);
    if (m) { pct = Math.max(pct, parseInt(m[1] || m[2], 10) || 0); continue; }
    if (/(?:heal|heals|restore|restores|recover|recovers)[^\n]{0,20}?\b(?:half|50%)\b[^\n]{0,12}?damage/.test(l)) { pct = Math.max(pct, 50); continue; }
    if (/(?:heal|heals|restore|restores|recover|recovers)[^\n]{0,20}?\b(?:a third|third)\b[^\n]{0,12}?damage/.test(l)) { pct = Math.max(pct, 33); continue; }
    if (/(?:heal|heals|restore|restores|recover|recovers)[^\n]{0,20}?\b(?:a quarter|quarter)\b[^\n]{0,12}?damage/.test(l)) { pct = Math.max(pct, 25); continue; }
    if (/\blifesteal\b/.test(l) && !/\d\s*%/.test(l)) pct = Math.max(pct, 30);
  }
  if (!pct && /\blifesteal\b|\bvampiric\b/i.test(txt) && !/no heal/i.test(txt)) { try { const sp = (parsed && parsed.special || []).find(x => x && x.type === 'lifesteal'); if (sp && sp.amount) pct = Number(sp.amount) || 0; } catch (e) {} }
  return Math.max(0, Math.min(100, pct));
}
function applyLifesteal(entry, caster, dmg, effMaxOf) {
  const pct = Number(entry && entry.lifestealPct) || 0; const d = Math.floor(Number(dmg) || 0);
  if (/soul drain/i.test(String(entry && entry.name || ''))) return { healed: 0, line: '' }; // Necromancy pays Soul Drain itself
  if (!pct || d <= 0 || !caster || !caster.stats || (caster.stats.hp || 0) <= 0) return { healed: 0, line: '' };
  let max = caster.stats.maxHp || 100; try { max = (effMaxOf && effMaxOf(caster)) || max; } catch (e) {}
  const before = caster.stats.hp || 0; caster.stats.hp = Math.min(max, before + Math.max(1, Math.floor(d * pct / 100)));
  const healed = caster.stats.hp - before;
  return { healed, line: healed > 0 ? `🩸 *${entry.name}* siphons *${healed}* HP (${pct}% of damage) → ${caster.stats.hp}/${max}` : '' };
}

// ── Push #88b: exact %-HP contract applied by every engine ──────────────────
// Returns { drained, healed, cost, lines[] }. Applies ONLY the stated numbers:
//   drainPct     → removes that % of TARGET max HP (never below 1 HP)
//   drainHealPct → caster recovers that % of TARGET max HP (capped at caster max)
//   selfCostPct  → caster pays that % of OWN max HP (never below 1 HP)
// healingPct is applied by the engines' existing heal path (unchanged).
function applyHpPercents(entry, caster, target, effMaxOf) {
  const out = { drained: 0, healed: 0, cost: 0, lines: [] };
  if (!entry || !caster || !caster.stats) return out;
  const maxOf = (u) => { try { return (effMaxOf && effMaxOf(u)) || u.stats.maxHp || 100; } catch (e) { return u.stats.maxHp || 100; } };
  const cost = Number(entry.selfCostPct) || 0;
  if (cost > 0) {
    const cm = maxOf(caster); const pay = Math.floor(cm * cost / 100);
    const before = caster.stats.hp || 0; caster.stats.hp = Math.max(1, before - pay); out.cost = before - caster.stats.hp;
    if (out.cost > 0) out.lines.push(`🩸 Paid ${out.cost} HP (${cost}% max HP)`);
  }
  const drain = Number(entry.drainPct) || 0;
  if (drain > 0 && target && target.stats) {
    const tm = maxOf(target); const take = Math.floor(tm * drain / 100);
    const before = target.stats.hp || 0; target.stats.hp = Math.max(1, before - take); out.drained = before - target.stats.hp;
    if (out.drained > 0) out.lines.push(`🧛 Drained ${out.drained} HP (${drain}% of ${target.name || 'target'}'s max HP)`);
    const dh = Number(entry.drainHealPct) || 0;
    if (dh > 0) {
      const cm = maxOf(caster); const give = Math.floor(tm * dh / 100);
      const b2 = caster.stats.hp || 0; caster.stats.hp = Math.min(cm, b2 + give); out.healed = caster.stats.hp - b2;
      if (out.healed > 0) out.lines.push(`💚 Recovered ${out.healed} HP`);
    }
  }
  return out;
}


// ── Push #88f: /recon carries skill PROGRESS across classes ──────────────────
// Snapshot the old class's unlocked skills (bar + library, in unlock order)
// with their levels; after the new class is synced, the new class's unlocked
// skills receive those levels positionally (old skill #1 Lv5 → new skill #1
// Lv5). If the new class has fewer unlocked skills at this level than the old
// one had, the next locked skills are force-unlocked so the COUNT matches too.
function snapshotSkillProgress(player) {
  const owned = [...(player?.skills?.active || []), ...(player?.availableSkills || [])].filter(s => s && s.name);
  owned.sort((a, b) => (Number(a.unlocksAtLevel) || 0) - (Number(b.unlocksAtLevel) || 0));
  return { count: owned.length, levels: owned.map(s => Math.max(1, Number(s.level) || 1)) };
}
function carrySkillProgress(player, snap) {
  if (!player || !snap) return { applied: 0 };
  syncPlayerSkills(player);
  const roster = getRoster(player).filter(e => !e.isPassive);
  player.skills = player.skills || {}; player.skills.unlockedOverrides = player.skills.unlockedOverrides || [];
  // top-up count: unlock the next locked (non-class-file) skills until counts match
  let owned = [...player.skills.active, ...player.availableSkills].length;
  if (owned < snap.count) {
    const locked = (player.skills.locked || []).slice().sort((a, b) => (Number(a.unlocksAtLevel) || 0) - (Number(b.unlocksAtLevel) || 0));
    for (const l of locked) {
      if (owned >= snap.count) break;
      const entry = roster.find(e => e.name === l.name);
      if (!entry || entry.fromClassFile) continue;
      if (!player.skills.unlockedOverrides.includes(l.name)) player.skills.unlockedOverrides.push(l.name);
      owned++;
    }
    syncPlayerSkills(player);
  }
  const now = [...player.skills.active, ...player.availableSkills].filter(s => s && s.name);
  now.sort((a, b) => (Number(a.unlocksAtLevel) || 0) - (Number(b.unlocksAtLevel) || 0));
  let applied = 0;
  for (let i = 0; i < now.length && i < snap.levels.length; i++) {
    const lv = Math.min(MAX_SKILL_LEVEL || 5, Math.max(1, snap.levels[i]));
    if (Number(now[i].level || 1) !== lv) { now[i].level = lv; applied++; }
  }
  return { applied, count: now.length, wanted: snap.count };
}
module.exports = { CLASS_POWER, supportMult, scaleEntry,
  augmentContract,
  parseSupportFields, applySupportFields,
  snapshotSkillProgress, carrySkillProgress,
  applyHpPercents, applyLifesteal, _lifestealPct,
  SKILLS_PER_CLASS, UNLOCK_STEP, MAX_SKILL_LEVEL, SUPPORTED_STATUS,
  canonicalClassName, buildRoster, getRoster, EXPLICIT,
  isUnlockedFor, syncPlayerSkills, resolveSkill,
  unlockedSkills, lockedSkills, passiveSkills,
  computeDamage, computeSkillDamage: computeDamage,
  effectiveCost, effectiveCooldownTurns, cooldownMs, skillUpgradeCost, levelBonus,
  onCooldown, setCooldown, toPlayerSkill, resetPlayerSkills,
  _rosterCache,
};
