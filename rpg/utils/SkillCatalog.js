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
function normalise(className, raw, index) {
  const name   = String(raw.name || `Skill ${index + 1}`).trim();
  const effect = ensureParseable(raw.effect || '• Deals 100% ATK damage');
  let   desc   = String(raw.description || raw.desc || raw.lore || '').trim();
  // Some source rows carry a stub ("💀 Killing shot"). Attack patterns never
  // read like that, and skills are meant to, so short lore is expanded with
  // the skill's real mechanics instead of shipping a one-liner.
  if (desc.length < 45) {
    const firstLine = effect.split('\n')[0].replace(/^[•\s]*/, '').replace(/\*\*/g, '');
    const theme = themeFor(className, name)[hashRand(name, themeFor(className, name).length)];
    desc = `${name} — ${titleCase(theme)} doctrine of ${className}. ${
      (raw.type || '').toLowerCase() === 'passive' ? 'Always running; no energy, no activation.'
      : (raw.type || '').toLowerCase() === 'heal' ? 'Bought with a turn of vulnerability and paid back in breath.'
      : (raw.type || '').toLowerCase() === 'buff' ? 'A priming technique: set the fight up before you swing for real.'
      : 'One opening, one commitment.'} ${
      (raw.type || '').toLowerCase() === 'passive' ? 'It never stops working.' : `In play: ${firstLine}.`
    }`;
  }

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
  }
  const isPassive = type === 'passive' || /•\s*passive/i.test(effect);

  const energyCost = Math.max(0, Number(
    raw.energyCost ?? raw.manaCost ?? raw.holyCost ?? raw.hungerCost ??
    raw.rageCost ?? raw.focusCost ?? raw.chiCost ?? raw.cost ?? (isPassive ? 0 : 20 + index * 2)
  ) || 0);

  // Damage as a % of ATK. If the description states a multiplier, honour it;
  // otherwise ramp by index so late skills are meaningfully stronger.
  const statedPct = parsed.damageMultiplier ? Math.round(parsed.damageMultiplier * 100) : 0;
  const damagePct = isPassive ? 0
    : type === 'heal' ? (statedPct || 40)
    : type === 'buff' ? (statedPct || 100) // Push #88: a buff skill still lands a full-strength strike, then the buff doubles what follows
    : (statedPct || 100 + index * 6);

  // Push #76: every description ends with a plain-language mechanics summary
  // (multiplier, buffs, debuffs, statuses, heal, cost) so a player knows
  // exactly what the skill does before spending energy on it.
  const _mech = [];
  if (!isPassive && damagePct > 0 && type !== 'heal' && type !== 'buff') _mech.push(`${damagePct}% ATK`);
  for (const b of (parsed.buffs || [])) _mech.push(`self ${String(b.stat).toUpperCase()} +${b.amount}% for ${b.duration || 2} turns`);
  for (const d of (parsed.debuffs || [])) _mech.push(d.stat === 'damageTaken' ? `target takes +${d.amount}% damage for ${d.duration || 3} turns` : `target ${String(d.stat).toUpperCase()} -${d.amount}% for ${d.duration || 3} turns`);
  for (const st of statuses) _mech.push(`${st.chance}% to inflict ${st.type.toUpperCase()} (${st.duration}t)`);
  if (selfHeal) _mech.push(`heals ${Math.round(selfHeal.percent)}% max HP`);
  if (!isPassive) _mech.push(`${energyCost} energy`);
  if (_mech.length && !/Mechanics:/.test(desc)) desc = `${desc.replace(/\s+$/, '')}${/[.!?]$/.test(desc) ? '' : '.'} Mechanics: ${_mech.join(' · ')}.`;

  return {
    name, className, index,
    type: isPassive ? 'passive' : type,
    isPassive, fromClassFile: !!raw.fromClassFile,
    description: desc,
    effect,
    animation: raw.animation || `⚡ ${name}!\n💥 The technique lands!`,
    cooldown: Math.max(0, Number(raw.cooldown ?? 2) || 0),          // turns (legacy unit)
    energyCost,
    damagePct,
    flatDamage: Number(raw.damage ?? 0) || 0,
    healingPct: _hpPct.heal != null ? _hpPct.heal : _hpPct.drain ? 0 : (Math.round(Number(selfHeal && selfHeal.percent) || 0) || (type === 'heal' ? 20 + index : 0)),
    // Push #88b: "% of HP" is a CONTRACT. drainPct = % of target max HP taken
    // (healed back to caster unless drainHeals=false); selfCostPct = % of own
    // max HP paid to cast. Engines apply exactly these numbers, nothing else.
    drainPct: _hpPct.drain || 0,
    drainHealPct: _hpPct.drainHeal || 0,
    selfCostPct: _hpPct.cost || 0,
    buffs: parsed.buffs || [],
    debuffs: parsed.debuffs || [],
    selfDebuffs: parsed.selfDebuffs || [],
    statuses,
    unlocksAtLevel: Math.min(100, (index + 1) * UNLOCK_STEP),
    level: 1,
    maxLevel: MAX_SKILL_LEVEL,
    _generated: !!raw._generated,
  };
}

// ── Per-class roster (memoised) ──────────────────────────────────────────────
const _rosterCache = new Map();

function buildRoster(className) {
  if (!className) return [];
  if (_rosterCache.has(className)) return _rosterCache.get(className);

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
          description: s.desc ? `${s.name} is a signature ${className} technique${cls.lore ? ` — "${String(cls.lore).replace(/\.$/, '')}"` : ''}. ${
            s.type === 'passive' ? 'It is always active, costs nothing and never needs to be cast.'
            : s.type === 'buff' ? 'Cast it before the exchange to tilt the fight in your favour.'
            : s.type === 'heal' ? 'A recovery technique that trades a moment of exposure for staying power.'
            : s.type === 'debuff' ? 'It cripples the target before the real blow lands.'
            : 'A committed strike that rewards good timing.'} In play: ${fill(s.desc)}.` : undefined,
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

  const roster = raws.map((r, i) => normalise(className, { ...r, unlocksAtLevel: (i + 1) * UNLOCK_STEP }, i));
  _rosterCache.set(className, roster);
  return roster;
}

function getRoster(player) { return buildRoster(canonicalClassName(player)); }

// Skill level → damage/cost/cooldown modifiers (identical maths to the old
// /skills so nobody's upgraded skills silently get weaker).
function levelBonus(skill) {
  const lv = Math.max(1, Math.min(MAX_SKILL_LEVEL, skill.level || 1));
  return { lv, dmgMult: 1 + (lv - 1) * 0.08, costReduction: (lv - 1) * 3, cdReduction: Math.floor((lv - 1) * 0.5) };
}

function effectiveCost(skill) {
  const b = levelBonus(skill);
  return Math.max(5, (skill.energyCost || 0) - b.costReduction);
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
  dmg = Math.max(1, Math.floor(dmg));
  if (opts.def) dmg = Math.max(1, dmg - Math.floor(Number(opts.def) * 0.35));
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
    debuffs: entry.debuffs,
    healingPct: entry.healingPct,
    drainPct: entry.drainPct || 0, drainHealPct: entry.drainHealPct || 0, selfCostPct: entry.selfCostPct || 0,
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
      else if (inPass.effect !== fresh.effect) { Object.assign(inPass, fresh, { level: inPass.level || 1 }); changed = true; }
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
              || !Array.isArray(holder.statuses)) {
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

  const asNum = parseInt(qRaw, 10);
  if (!isNaN(asNum) && String(asNum) === qRaw.split(' ')[0]) {
    const equipped = player.skills.active || [];
    const library  = player.availableSkills || [];
    if (asNum >= 1 && asNum <= equipped.length) {
      const s = equipped[asNum - 1];
      return { ok: true, skill: s, source: 'active', entry: findBy(s.name, roster) };
    }
    if (opts.allowLibrary !== false && asNum - equipped.length >= 1 && asNum - equipped.length <= library.length) {
      const s = library[asNum - equipped.length - 1];
      return { ok: true, skill: s, source: 'library', entry: findBy(s.name, roster) };
    }
  }

  const q = qRaw.toLowerCase().replace(/^\/?(skill|use|cast)\s*/i, '').trim();
  const byName = (arr) => Array.isArray(arr)
    ? (arr.find(s => String(s.name).toLowerCase() === q)
      || arr.find(s => String(s.name).toLowerCase().startsWith(q))
      || arr.find(s => String(s.name).toLowerCase().includes(q)))
    : null;

  const active = byName(player.skills.active);
  if (active) return { ok: true, skill: active, source: 'active', entry: findBy(active.name, roster) };

  if (opts.allowLibrary !== false) {
    const lib = byName(player.availableSkills);
    if (lib) return { ok: true, skill: lib, source: 'library', entry: findBy(lib.name, roster) };
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

  const unlockedN = roster.filter(r => !r.isPassive && isUnlockedFor(player, r)).length;
  return { ok: false, error: `❌ Skill *${qRaw}* not found.\nYou have ${unlockedN} unlocked skills — list them with /skill.` };
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

module.exports = {
  applyHpPercents,
  SKILLS_PER_CLASS, UNLOCK_STEP, MAX_SKILL_LEVEL, SUPPORTED_STATUS,
  canonicalClassName, buildRoster, getRoster, EXPLICIT,
  isUnlockedFor, syncPlayerSkills, resolveSkill,
  unlockedSkills, lockedSkills, passiveSkills,
  computeDamage, computeSkillDamage: computeDamage,
  effectiveCost, effectiveCooldownTurns, cooldownMs, skillUpgradeCost, levelBonus,
  onCooldown, setCooldown, toPlayerSkill, resetPlayerSkills,
  _rosterCache,
};
