'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Push #103b — CLASS REVAMP ADAPTER
//   rpg/data/ClassRevamp103.js holds the 27-class spec (20 core + 6 rank-locked
//   skills each) exactly as written. This module turns every spec line into
//   the raw shape SkillCatalog.normalise() already understands:
//     { name, type, effect (parseable bullet lines), description, energyCost,
//       cooldown, rankReq, scaleStat, hits }
//   Rules:
//     • damage multiplier = first "N% ATK|MP|DEF" in the text (multi-hit
//       "4 strikes × 50% each" → 200%; "per turn" DoTs ×1.5; "hit twice" ×2)
//     • MP skills scale off Magic Power, DEF skills off Defence (computeDamage)
//     • statuses / buffs / debuffs come from the text after light rewriting so
//       the EffectParser grammar catches them ("applies burn" → "inflict burn")
//     • energy: core 15–30 by slot, B-rank 45, A-rank 55, S-rank 75
//     • no core strike below 130% / no rank strike below 280% (strength floor)
// ═══════════════════════════════════════════════════════════════════════════
let SPEC = null;
try { SPEC = require('../data/ClassRevamp103'); } catch (e) { SPEC = null; }

const ALIAS = { SpellBlade: 'Spellblade' };
const RANK_COST = { B: 45, A: 55, S: 75 };
const RANK_FLOOR = { B: 280, A: 340, S: 420 };
const CORE_FLOOR = 130;

function specFor(className) {
  if (!SPEC || !className) return null;
  return SPEC[className] || SPEC[ALIAS[className]] || null;
}
function hasRevamp(className) { return !!specFor(className); }
function classNames() { return SPEC ? Object.keys(SPEC) : []; }

// ── text → parser-friendly text ────────────────────────────────────────────
function rewrite(t) {
  let s = ' ' + String(t || '').replace(/\s+/g, ' ').trim();
  s = s.replace(/\bMP\b/g, 'Magic Power').replace(/\bMagic Power damage\b/gi, 'Magic Power');
  // verbs → forms the parser knows
  s = s.replace(/\b(appl(?:y|ies|ying)|inflict(?:s|ing)|caus(?:es|ing))\s+(burn|poison|bleed|freeze|stun|fear|blind|silence|curse|paralysis|paralyze|weaken|slow)/gi, (m, v, st) => `inflict ${st.toLowerCase() === 'paralysis' ? 'paralyze' : st.toLowerCase()}`);
  s = s.replace(/\b(burns|poisons|freezes|stuns|blinds|silences|curses|paralyzes|bleeds|frightens|terrifies)\s+(?:the\s+)?(?:target|enemy|enemies|all enemies|foes?)\b/gi, (m, v) => `inflict ${({ burns: 'burn', poisons: 'poison', freezes: 'freeze', stuns: 'stun', blinds: 'blind', silences: 'silence', curses: 'curse', paralyzes: 'paralyze', bleeds: 'bleed', frightens: 'fear', terrifies: 'fear' })[v.toLowerCase()]}`);
  s = s.replace(/\b(\d+)%\s+(stun|burn|poison|bleed|freeze|fear|blind|silence|curse|paralyze|weaken)\s+chance\b/gi, '$1% chance to inflict $2');
  s = s.replace(/\bchance\s+to\s+(stun|burn|poison|freeze|blind|silence|curse|paralyze|bleed)\b/gi, 'chance to inflict $1');
  s = s.replace(/\b(bleeding|burning|poisoned|frozen|stunned|blinded|silenced|cursed|paralyzed|feared)\b/gi, (m) => ({ bleeding: 'inflict bleed', burning: 'inflict burn', poisoned: 'inflict poison', frozen: 'inflict freeze', stunned: 'inflict stun', blinded: 'inflict blind', silenced: 'inflict silence', cursed: 'inflict curse', paralyzed: 'inflict paralyze', feared: 'inflict fear' })[m.toLowerCase()]);
  s = s.replace(/\b(rooting|roots|root|entangl\w*|immobiliz\w*|snar\w*)\b/gi, 'inflict trueslow').replace(/\btrance\b/gi, 'inflict stun').replace(/\bmiss all attacks\b/gi, 'inflict blind');
  // buffs: "Increases ATK by 25%" / "boosting DEF by 40%" / "ATK and DEF +20%"
  s = s.replace(/\b(boost(?:s|ing)?|increas(?:es|ing)?|rais(?:es|ing)?|grant(?:s|ing)?|gain(?:s|ing)?)\s+(?:your\s+|own\s+|party\s+|allies'?\s+|all allies'?\s+)?(ATK|attack|DEF|defen[cs]e|SPD|speed|crit(?:ical)?(?:\s+(?:chance|rate))?|dodge|evasion|accuracy|all stats)(?:\s+and\s+(ATK|DEF|SPD|speed|crit|dodge|evasion))?\s+(?:by\s+|to\s+)?\+?(\d+)%/gi,
    (m, v, a, b, n) => `${norm(a)} +${n}%${b ? ` and ${norm(b)} +${n}%` : ''}`);
  s = s.replace(/\b(ATK|DEF|SPD|speed|crit|dodge|evasion)\s+and\s+(ATK|DEF|SPD|speed|crit|dodge|evasion)\s+\+(\d+)%/gi, (m, a, b, n) => `${norm(a)} +${n}% and ${norm(b)} +${n}%`);
  s = s.replace(/\bParty\s+(ATK|DEF|SPD|speed)\s+\+(\d+)%/gi, (m, a, n) => `party ${norm(a)} +${n}%`);
  // debuffs: "Decreases enemy ATK and DEF by 20%" / "lowering target DEF by 25%" / "Reduces target DEF by 30%"
  s = s.replace(/\b(?:decreas\w*|reduc\w*|lower\w*|cut\w*|strip\w*)\s+(?:the\s+)?(?:enemy|target|enemies|all enemies|foe)(?:'s)?\s+(ATK|attack|DEF|defen[cs]e|armor|SPD|speed|accuracy|evasion|dodge|magic resistance)(?:\s+and\s+(ATK|attack|DEF|defen[cs]e|SPD|speed|accuracy))?\s+(?:by\s+)?(\d+)%/gi,
    (m, a, b, n) => `enemy ${norm(a)} -${n}%${b ? `, enemy ${norm(b)} -${n}%` : ''}`);
  s = s.replace(/\b(?:enemy|target)\s+(ATK|attack|DEF|defen[cs]e|SPD|speed|accuracy|evasion|dodge)(?:\s+and\s+(ATK|DEF|SPD|speed|accuracy|evasion|dodge))?\s+-(\d+)%/gi, (m, a, b, n) => `enemy ${norm(a)} -${n}%${b ? `, enemy ${norm(b)} -${n}%` : ''}`);
  s = s.replace(/\bslow(?:s|ing)?\s+(?:target|enemy|all enemies|enemies)(?:'s)?\s+(?:speed|movement)?\s*(?:by\s+)?(\d+)%/gi, 'enemy SPD -$1% and slows target');
  s = s.replace(/\btakes?\s+(\d+)%\s+(?:more|increased|extra|bonus)\s+(?:\w+\s+)?damage/gi, 'target takes +$1% more damage');
  // heals
  s = s.replace(/\b(restor(?:es|ing)|recover(?:s|ing)|heal(?:s|ing)?)\s+(\d+)%\s+(?:of\s+)?(?:max(?:imum)?\s+)?HP\b/gi, 'heals $2% max HP');
  s = s.replace(/\bHP\s+regen(?:eration)?\s+(?:of\s+)?(\d+)%/gi, 'regenerates $1% max HP per turn');
  s = s.replace(/\bignor(?:es|ing)\s+(\d+)%\s+(?:of\s+)?(?:target\s+|enemy\s+)?(?:DEF|defen[cs]e|armor)\b/gi, 'ignores $1% defense');
  s = s.replace(/\blifesteal(?:s|ing)?\s+(?:for\s+|of\s+)?(\d+)%/gi, 'heals $1% of damage dealt').replace(/\bheal(?:s|ing)?\s+(?:for\s+|by\s+)?(\d+)%\s+of\s+(?:the\s+)?damage\b/gi, 'heals $1% of damage dealt');
  return s.trim();
}
function norm(k) {
  const l = String(k || '').toLowerCase();
  if (/^atk|attack/.test(l)) return 'ATK';
  if (/^def|armor/.test(l)) return 'DEF';
  if (/^spd|speed/.test(l)) return 'SPD';
  if (/crit/.test(l)) return 'crit';
  if (/dodge|evasion/.test(l)) return 'dodge';
  if (/all stats/.test(l)) return 'all stats';
  return l;
}

// ── damage multiplier + scaling stat from the spec text ────────────────────
function damageOf(text, type) {
  // Push #103h (BUG-117): "ignoring 30% DEF" is penetration, not the damage stat — strip it before reading the %.
  const t = String(text || '').replace(/(?:ignor\w*|penetrat\w*|bypass\w*)\s+\d{1,3}%\s*(?:of\s+)?(?:target\s+|enemy\s+)?(?:DEF|defen[cs]e|armou?r)/gi, '').replace(/(?:armou?r|defen[cs]e)\s+penetration\s*\d{1,3}%/gi, '');
  const m = t.match(/(\d{2,4})%\s*(?:of\s+)?(?:(?:current|total|max(?:imum)?)\s+)?(?:(?:mixed|combined|bonus)\s+)?(ATK|attack|Magic Power|MP|DEF|defen[cs]e|ATK\/MP|ATK\/Magic Power|HP)\b/i);
  if (!m) { const d = type === 'damage' && t.match(/(\d{2,4})%\s+(?:\w+\s+)?damage\b/i); return d ? { pct: parseInt(d[1], 10), stat: /hybrid|mixed|combined/i.test(t) ? 'hybrid' : 'atk' } : { pct: 0, stat: 'atk' }; } // Push #103h: "240% damage" = 240% ATK
  const stat = /HP/i.test(m[2]) ? 'hp' : /DEF|defen/i.test(m[2]) ? 'def' : /MP|Magic/i.test(m[2]) && !/ATK\//i.test(m[2]) ? 'magic' : 'atk';
  let pct = parseInt(m[1], 10);
  if (stat === 'hp') return { pct: 0, stat: 'atk' };
  const multi = t.match(/(\d+)\s+(?:rapid\s+)?(?:strikes?|hits?|slashes|shots?|arrows?|stabs?|blows?|kicks?|punches|attacks?|bolts?|cuts?|jabs?|volleys?|waves?|pulses?|missiles?)\b[^.]*?\d+%\s*(?:ATK|MP|Magic Power)\s*each/i) || t.match(/each\s+of\s+(\d+)/i);
  if (multi) pct = pct * Math.max(1, Math.min(8, parseInt(multi[1], 10)));
  else if (/\b(?:twice|two\s+hits|double\s+strike|2\s+hits)\b/i.test(t)) pct = pct * 2;
  else if (/per\s+turn|each\s+turn|every\s+turn/i.test(t) && type === 'damage') pct = Math.round(pct * 1.5);
  return { pct, stat };
}

// ── cost / cooldown by slot ────────────────────────────────────────────────
// Push #103f-3: per-skill cost tuning (name → multiplier). Ancestral Wrath: damage 260% → 130% and cost halved.
const COST_TUNE = {}; // Push #103g: Ancestral Wrath restored (260%, full cost) per owner
function costFor(index, rank, type, name) {
  if (type === 'passive') return 0;
  const tune = COST_TUNE[name] || 1;
  if (rank) return Math.max(5, Math.round((RANK_COST[rank] || 45) * tune));
  return Math.max(5, Math.round(Math.min(30, 15 + Math.round(index * 0.75)) * tune));
}
function cooldownFor(index, rank, type) {
  if (type === 'passive') return 0;
  if (rank) return rank === 'S' ? 6 : rank === 'A' ? 5 : 4;
  return 2 + Math.floor(index / 7);
}

// ── spec entry → SkillCatalog raw ──────────────────────────────────────────
function toRaw(className, sk, index) {
  const type = String(sk.type || 'damage').toLowerCase();
  const txt = rewrite(sk.text);
  const dm = damageOf(sk.text, type);
  const lines = [];
  const catType = type === 'summon' ? 'buff' : type === 'utility' ? 'debuff' : type;
  if (type === 'passive') lines.push(`• Passive: ${txt}`, `• Passive: ${sk.text}`);
  else {
    if (dm.pct) {
      const floor = sk.rank ? RANK_FLOOR[sk.rank] || 280 : (type === 'damage' ? CORE_FLOOR : 0);
      const pct = Math.max(dm.pct, floor);
      lines.push(`• Deals ${pct}% ${dm.stat === 'magic' ? 'Magic Power' : dm.stat === 'def' ? 'DEF' : 'ATK'} damage${/all enemies|all targets|all opposing|AoE|every enemy|across \d+ targets|hitting all/i.test(sk.text) ? ' to all enemies' : ''}`);
    } else if (type === 'damage') {
      lines.push(`• Deals ${sk.rank ? RANK_FLOOR[sk.rank] || 280 : CORE_FLOOR + Math.min(70, index * 4)}% ATK damage`);
    }
    lines.push(`• ${txt}`);
  }
  const displayEffect = [...lines.slice(0, lines.length - 1), `• ${sk.text}`].join('\n');
  // Push #103c: every skill speaks in its class's voice — lore above, the spec sentence (📜) below, mechanics after.
  let _lore = null; try { _lore = require('../data/SkillLore').lore(className, sk, sk._variant || null); } catch (e) {}
  return {
    name: sk.name, type: catType, emoji: sk.emoji,
    effect: lines.join('\n'), displayEffect,
    description: _lore ? `${sk.emoji || '✦'} _${_lore.lore}_\n📝 ${sk.text}` : `${sk.emoji || '✦'} ${sk.text}`,
    animation: _lore ? _lore.cast : undefined, loreTag: _lore ? _lore.tag : null,
    energyCost: costFor(index, sk.rank, type, sk.name), cooldown: cooldownFor(index, sk.rank, type),
    rankReq: sk.rank || null, scaleStat: dm.stat || 'atk', specText: sk.text, revamp: true, _spec: sk,
  };
}

// ── explicit mechanics from the spec sentence (merged AFTER the parser) ────
// The EffectParser reads most lines; this catches the phrasing it cannot
// ("reducing dodge to 0%", "guaranteed crit", "decoy absorbing the next hit",
// "seals skill casting", "charms", "unlimited energy"...), so NO active skill
// is ever a dead cast.
function mechanics(sk) {
  const t = String(sk.text || '').toLowerCase();
  const type = String(sk.type || '').toLowerCase();
  const m = { buffs: [], debuffs: [], statuses: [], party: false };
  const turns = (dflt) => { const x = t.match(/(\d+)\s*turns?/); return x ? Math.max(1, Math.min(5, parseInt(x[1], 10))) : dflt; };
  const pct = (re, dflt) => { const x = t.match(re); return x ? parseInt(x[1], 10) : dflt; };
  const buff = (stat, amount, dur) => { if (!m.buffs.some(b => b.stat === stat)) m.buffs.push({ stat, amount, duration: dur || turns(2) }); };
  const debuff = (stat, amount, dur) => { if (!m.debuffs.some(b => b.stat === stat)) m.debuffs.push({ stat, amount, duration: dur || turns(2) }); };
  const status = (type_, chance, dur) => { if (!m.statuses.some(b => b.type === type_)) m.statuses.push({ type: type_, chance: chance || 100, duration: Math.max(2, dur || turns(2)) }); };
  if (type === 'passive') return m;
  const enemyish = /\b(enemy|enemies|target|targets|foes?|opposing|opponent)\b/.test(t);
  m.party = /\b(party|allies|ally|all allies|team|teammates)\b/.test(t) && !/\benemy party\b/.test(t);

  // stat drops on the enemy
  for (const [re, stat] of [
    [/(?:reduc\w*|lower\w*|decreas\w*|cut\w*|shred\w*|strip\w*|drops?|-)\s*(?:the\s+)?(?:enemy|target|enemies|all enemies|foe|opposing)?(?:'s)?\s*(?:physical\s+|magic\s+|hit\s+)?(?:atk|attack(?:\s+power)?)(?:\s+and\s+\w+)?\s*(?:by|to|-)?\s*(\d+)%/, 'atk'],
    [/(?:reduc\w*|lower\w*|decreas\w*|cut\w*|shred\w*|strip\w*|-)\s*(?:the\s+)?(?:enemy|target|enemies|all enemies|foe)?(?:'s)?\s*(?:physical\s+)?(?:def(?:en[cs]e)?|armor(?:\s+rating)?)(?:\s+and\s+\w+)?\s*(?:by|to|-)?\s*(\d+)%/, 'def'],
    [/(?:reduc\w*|lower\w*|decreas\w*|slow\w*|cut\w*|-)\s*(?:the\s+)?(?:enemy|target|enemies|all enemies|foe|surrounding enemies'?)?(?:'s)?\s*(?:movement\s+|attack\s+)?(?:speed|spd)(?:\s+and\s+[\w\s]+?)?\s*(?:by|to|-)?\s*(\d+)%/, 'speed'],
    [/(?:reduc\w*|lower\w*|decreas\w*|-)\s*(?:the\s+)?(?:enemy|target|enemies|all enemies)?(?:'s)?\s*(?:hit\s+)?accuracy\s*(?:by|to|-)?\s*(\d+)%/, 'accuracy'],
    [/(?:enemy|target|enemies)\s+(?:hit\s+)?accuracy\s*-\s*(\d+)%/, 'accuracy'],
    [/(?:reduc\w*|lower\w*|decreas\w*)\s*(?:the\s+)?(?:enemy|target|enemies|all enemies)?(?:'s)?\s*(?:dodge|evasion)(?:\s+(?:chance|rate))?\s*(?:by|to)\s*(\d+)%/, 'dodge'],
    [/(?:enemy|target)\s+(?:dodge|evasion)\s+(?:reduced\s+)?(?:to|by|-)\s*(\d+)%/, 'dodge'],
    [/(?:reduc\w*|shred\w*|lower\w*)\s*(?:enemy\s+|target\s+)?(?:magic resistance|mr)\s*(?:by|to)\s*(\d+)%/, 'magicResist'],
  ]) {
    const x = t.match(re);
    if (x && (enemyish || type === 'debuff')) {
      let amt = parseInt(x[1], 10);
      if (/\bto\s+0%|to zero|to 0\b/.test(t) && (stat === 'dodge' || stat === 'def')) amt = 100;
      debuff(stat, Math.min(100, amt));
    }
  }
  // "ATK and DEF by 20%" — second stat shares the number
  { const x = t.match(/(atk|attack|def|defen[cs]e|speed|spd|accuracy|dodge|evasion|mr|magic resistance)\s+and\s+(atk|attack|def|defen[cs]e|speed|spd|accuracy|dodge|evasion|mr|magic resistance)(?:\s+(?:by|-|to))?\s*(?:by\s+)?(\d+)%/);
    if (x && (enemyish || type === 'debuff') && /reduc|lower|decreas|-\d|shred/.test(t) && type !== 'buff') { const n = parseInt(x[3], 10); for (const k of [x[1], x[2]]) debuff(normStat(k), Math.min(100, n)); }
    if (x && type === 'buff' && !/enemy|target/.test(t)) { const n = parseInt(x[3], 10); for (const k of [x[1], x[2]]) buff(normStat(k), n); } }
  { const x = t.match(/\b(?:enemy|target|enemies|all enemies)\s+([a-z\s\/]+?)\s*(?:-|reduced\s+(?:by|to)\s*|decreased\s+by\s*)(\d+)%/); if (x) { const n = parseInt(x[2], 10); for (const part of x[1].split(/\s+and\s+|,|\//)) { const st = normStat(part.replace(/\b(physical|hit|movement|attack\s+speed|rate|power|frequency)\b/g, (w) => w === 'attack speed' ? 'speed' : '').trim()); if (['atk', 'def', 'speed', 'accuracy', 'dodge', 'magicResist'].includes(st)) debuff(st, Math.min(100, /\bto\s*\d+%/.test(x[0]) && n === 0 ? 100 : n)); } } }
  if (/(?:enemy|target|enemies)[\w\s]*?armor(?:\s+rating)?\s+reduced\s+to\s+zero|armor[\w\s]*to zero/.test(t)) debuff('def', 100, 1);
  if (/(?:dodge|evasion)\s+(?:reduced\s+)?to\s+0%|dodge to 0%/.test(t)) debuff('dodge', 100);
  if (/takes?\s+\+?(\d+)%\s+(?:more|increased|extra|bonus)/.test(t) || /\+(\d+)%\s+(?:more\s+)?damage taken/.test(t)) debuff('damageTaken', pct(/(\d+)%\s+(?:more|increased|extra|bonus)/, 25), turns(3));

  // self / party stat ups
  if (type === 'buff' || type === 'heal' || type === 'summon' || type === 'utility') {
    for (const [re, stat] of [
      [/(?:atk|attack(?:\s+power)?)\s*(?:\+|by|increased by|up by|boosted by)\s*(\d+)%/, 'atk'],
      [/(?:\+|boost\w*|increas\w*|rais\w*|grant\w*|gain\w*)\s+(?:physical\s+|party\s+|allies'?\s+|all allies'?\s+|your\s+)?(?:atk|attack(?:\s+power)?)(?:\s+and\s+[\w\s]+?)?\s*(?:by|to)?\s*\+?(\d+)%/, 'atk'],
      [/(?:def(?:en[cs]e)?)\s*(?:\+|by|increased by)\s*(\d+)%/, 'def'],
      [/(?:boost\w*|increas\w*|rais\w*|grant\w*|gain\w*)\s+(?:party\s+|allies'?\s+|your\s+)?(?:def(?:en[cs]e)?)(?:\s+and\s+[\w\s]+?)?\s*(?:by|to)?\s*\+?(\d+)%/, 'def'],
      [/(?:speed|spd)\s*(?:\+|by|increased by)\s*(\d+)%/, 'speed'],
      [/(?:boost\w*|increas\w*|rais\w*|grant\w*|gain\w*)\s+(?:party\s+|allies'?\s+|your\s+|\w+\s+)?(?:speed|spd)(?:\s+and\s+[\w\s]+?)?\s*(?:by|to)?\s*\+?(\d+)%/, 'speed'],
      [/(?:dodge|evasion)(?:\s+(?:chance|rate|rates))?\s*(?:\+|by|increased by|reaches|to)\s*(\d+)%/, 'dodge'],
      [/(?:boost\w*|increas\w*|rais\w*|grant\w*|gain\w*)\s+(?:party\s+|allies'?\s+|your\s+)?(?:dodge|evasion)(?:\s+(?:chance|rate))?(?:\s+and\s+[\w\s]+?)?\s*(?:by|to)?\s*\+?(\d+)%/, 'dodge'],
      [/crit(?:ical)?(?:\s+(?:strike|hit))?(?:\s+(?:chance|rate|window))?\s*(?:\+|by|increased by|becomes|reaches|to)\s*(\d+)%/, 'crit'],
      [/(?:boost\w*|increas\w*|rais\w*|grant\w*)\s+(?:party\s+|allies'?\s+|ally\s+|your\s+)?crit(?:ical)?(?:\s+(?:strike|hit))?(?:\s+(?:chance|rate))?(?:\s+and\s+[\w\s]+?)?\s*(?:by|to)?\s*\+?(\d+)%/, 'crit'],
      [/(?:magic resistance|mr)\s*(?:\+|by|increased by)\s*(\d+)%/, 'magicResist'],
      [/(?:magic power|mp)\s*(?:\+|by|increased by)\s*(\d+)%/, 'atk'],
      [/(?:all\s+)?stats?\s+(?:increased\s+)?(?:by|\+)\s*(\d+)%/, 'all'],
    ]) {
      const x = t.match(re);
      if (!x) continue;
      const n = Math.min(100, parseInt(x[1], 10));
      if (stat === 'all') { buff('atk', n); buff('def', n); buff('speed', n); } else buff(stat, n);
    }
    if (/\bdoubled\b/.test(t) && /atk|attack/.test(t)) buff('atk', 100);
    if (/\bdoubled\b/.test(t) && /max hp|defen/.test(t)) buff('def', 50);
  }
  // guaranteed / 100% crit
  if (/guarantee\w*\s+(?:a\s+)?crit|auto(?:matically)?\s+crit|crit(?:ical)?(?:\s+hit)?\s+rate\s+(?:becomes|reaches)\s+100%|all attacks\s+(?:automatically\s+)?crit|crit(?:ical)?\s+(?:strike|hit)\s+(?:rate|chance)\s+becomes\s+100%/.test(t)) buff('crit', 100, turns(1));
  // guaranteed hit / stealth / bypass dodge → accuracy buff
  if (/guarantee\w*\s+hits?|bypass(?:es|ing)?\s+dodge|cannot\s+miss|never\s+miss/.test(t)) buff('accuracy', 50, turns(2));
  // extra turn / attack twice → counts as a double basic (handled by forceDamagePct)
  if (/extra\s+(?:basic\s+)?(?:attack\s+)?turn|extra\s+(?:basic\s+)?attack|attack\s+twice|immediate\s+extra\s+turn|second\s+action|act\s+twice/.test(t) && !/summons?\b/.test(t)) m.forceDamagePct = Math.max(m.forceDamagePct || 0, 200);
  // decoy / clone / phase / evade next hit → dodge spike + small shield
  if (type !== 'damage' && /decoy|clone|absorb(?:s|ing)?\s+(?:the\s+)?next\s+(?:single-target\s+)?(?:hit|strike|attack)|phas(?:es|ing)\s+through|evade\s+the\s+next|dodg(?:es|ing)\s+all|dodging all attacks|untargetable|teleports? to evade|slips?\s+past|intangib|phase state/.test(t) && !enemyOnly(t)) { buff('dodge', /dodg(?:es|ing)\s+all|dodge\s+reaches\s+9\d|absolute evasion|phase state|untargetable/.test(t) ? 90 : 45, turns(1)); m.shieldPct = Math.max(m.shieldPct || 0, 20); }
  // taunt / intercept / redirect
  if (/taunt|forces?\s+(?:all\s+)?enemies\s+to\s+target|intercept|takes?\s+the\s+incoming\s+damage|redirect\s+action/.test(t) && type !== 'heal') { buff('def', 25, turns(2)); debuff('atk', 15, turns(2)); }
  // silence / seal / cooldown lock
  if (/\bsilence|seals?\s+(?:target\s+)?(?:skill|spell|energy|casting)|cannot\s+(?:cast|use\s+skills)|locks?\s+(?:their\s+)?skills|blocking all incoming spellcasting/.test(t)) { if (enemyish || type === 'debuff') status('silence', 100, turns(1)); else m.damageTakenPct = Math.max(m.damageTakenPct || 0, 40); }
  // charm / confusion / illusion / fear
  if (/charm|confus|misdirect|phantom targets|illusion|hallucinat|fight each other|attack(?:s)? themselves|scrambl|redirect action/.test(t) && (enemyish || type === 'debuff')) { status('blind', 100, turns(2)); status('fear', 70, turns(2)); }
  if (/\b(terror|terrif|dread|despair|horror|frighten|panic)\b/.test(t) && (enemyish || type === 'debuff')) status('fear', 80, turns(2));
  if (/miss\s+(?:all\s+)?attacks|blind|darkens the battlefield|smoke/.test(t) && (enemyish || type === 'debuff')) status('blind', 100, turns(2));
  if (/\b(trance|sleep|lullaby|knock(?:s|ed)?\s+(?:down|back)|knocking down|paraly)/.test(t) && (enemyish || type === 'debuff')) status(/paraly/.test(t) ? 'paralyze' : 'stun', /knock/.test(t) ? 60 : 100, turns(1));
  if (/\b(stun|stunning|stuns)\b/.test(t) && (enemyish || type === 'debuff' || type === 'damage')) status('stun', pct(/(\d+)%\s+(?:chance\s+to\s+)?(?:inflict\s+)?stun|(\d+)%\s+stun/, 100), turns(1));
  if (/\b(freez\w+|frozen|ice prison|absolute zero|deep freeze)\b/.test(t) && (enemyish || type === 'debuff' || type === 'damage')) status('freeze', pct(/(\d+)%\s+(?:chance\s+to\s+)?(?:inflict\s+)?freeze/, 100), turns(1));
  if (/\b(root\w*|immobiliz\w*|entangl\w*|snare\w*|pins?\s+(?:the\s+)?target|binds?\s+|holds?\s+(?:the\s+)?(?:target|enemy)|slow\w*|stasis|time\s+(?:stop|freeze)|inactive)\b/.test(t) && (enemyish || type === 'debuff' || type === 'damage')) status('trueslow', 100, turns(2));
  if (/\b(burn\w*|fire|flame|scorch|hellfire|magma|pyre|ignite|blaz\w+|inferno|lava)\b/.test(t) && (type === 'damage' || type === 'debuff') && /burn|ignite|scorch|applies|inflict/.test(t)) status('burn', 100, turns(3));
  if (/\b(poison\w*|toxic|venom\w*|plague|pestilence|acid|necrotic|rot\w*|spore)\b/.test(t) && (type === 'damage' || type === 'debuff')) status('poison', 100, turns(3));
  if (/\b(bleed\w*|hemorrhag\w*|laceration|serrated|rend\w*)\b/.test(t) && (type === 'damage' || type === 'debuff')) status('bleed', 100, turns(3));
  if (/\b(curse\w*|hex\w*|doom|ruin|malediction|jinx|bane)\b/.test(t + ' ' + String(sk.name || '').toLowerCase()) && (type === 'debuff' || type === 'damage') && (enemyish || type === 'debuff')) status('curse', 100, turns(3)); // Push #103c: the NAME counts too (Hex, Curse of …)
  if (/\bweaken\w*|enfeebl\w*|sap\w*\s+strength/.test(t) && enemyish) status('weaken', 100, turns(2));

  // sustain
  { const x = t.match(/(?:restor\w*|heal\w*|recover\w*|regain\w*)\s+(\d+)%\s+(?:of\s+)?(?:max(?:imum)?\s+)?(?:hp|health)/); if (x && !enemyOnly(t)) m.healingPct = parseInt(x[1], 10); }
  { const x = t.match(/(?:restor\w*|regain\w*|recover\w*|grants?|gains?)\s+(\d+)%\s+(?:of\s+)?(?:max(?:imum)?\s+)?energy/) || t.match(/(\d+)%\s+(?:max\s+)?energy\s+(?:restored|back|regen)/); if (x) m.energyPct = parseInt(x[1], 10); }
  if (/unlimited\s+energy|costs?\s+0\s+energy|energy\s+costs?\s+(?:reduced\s+)?to\s+0|without\s+energy\s+cost|cooldowns?\s+reset|resets?\s+(?:all\s+)?cooldowns/.test(t)) m.energyPct = Math.max(m.energyPct || 0, 50);
  { const x = t.match(/(\d+)%\s+(?:hp|health)\s+(?:regen|recovery|per turn)/) || t.match(/regenerat\w*\s+(\d+)%\s+(?:max\s+)?hp\s+(?:per|each|every)\s+turn/); if (x && !enemyOnly(t)) m.regen = { pct: parseInt(x[1], 10), turns: turns(3) }; else if (/continuous\s+hp\s+recovery|hp\s+recovery\s+(?:to\s+allies\s+)?for\s+\d+\s+turns|regenerat\w*\s+hp/.test(t) && !enemyOnly(t)) m.regen = { pct: 6, turns: turns(3) }; }
  { const x = t.match(/absorb(?:s|ing)?\s+(\d+)%\s+of\s+(?:all\s+)?(?:incoming|all)\s+(?:magic\s+|physical\s+)?damage/) || t.match(/(?:incoming\s+)?damage\s+(?:taken\s+)?(?:is\s+)?reduced\s+(?:by\s+)?(\d+)%/) || t.match(/reduc\w*\s+(?:all\s+)?(?:incoming\s+)?damage(?:\s+to\s+the\s+\w+)?\s+(?:taken\s+)?by\s+(\d+)%/) || t.match(/takes?\s+(\d+)%\s+less\s+damage/); if (x && !enemyOnly(t)) m.damageTakenPct = Math.max(m.damageTakenPct || 0, Math.min(90, parseInt(x[1], 10))); }
  { const x = t.match(/reduc\w*\s+(?:all\s+)?(?:incoming\s+)?(?:[\w\/]+\s+)?damage(?:\s+taken)?\s+(?:to\s+(?:the\s+)?\w+\s+)?by\s+(\d+)%/); if (x && !enemyOnly(t)) m.damageTakenPct = Math.max(m.damageTakenPct || 0, Math.min(90, parseInt(x[1], 10))); }
  if (/near-absolute\s+(?:physical\s+)?(?:damage\s+)?mitigation|absolute\s+(?:damage\s+)?mitigation/.test(t)) m.damageTakenPct = Math.max(m.damageTakenPct || 0, 75);
  if (/takes?\s+(?:zero|no|0)\s+damage|absolute\s+(?:temporary\s+)?invulnerab|prevents?\s+damage\s+from\s+dropping|cannot\s+drop\s+below\s+1\s+hp|below\s+1\s+hp/.test(t) && !enemyOnly(t)) m.immuneTurns = Math.max(m.immuneTurns || 0, turns(1));
  if (/shatter\w*\s+(?:all\s+)?(?:enemy\s+|target\s+)?(?:energy\s+)?shields?|breaks?\s+(?:all\s+)?(?:enemy\s+)?shields?|destroys?\s+(?:all\s+)?shields?|with\s+shield\s+and|ignor\w*\s+(?:armor\s+and\s+)?barriers?|absorbs?\s+\d+%\s+of\s+(?:target|enemy)/.test(t)) m.noShield = true;
  if (type === 'damage' && /\b(?:summons?|phase state|decoy|clone)\b/.test(t) && !/conjur|deploys?|summons?\s+(?:a|an|\d+)\b/.test(t)) m.noSummonRider = true;
  if (/massive\s+stat\s+boosts?|all\s+attributes|all\s+stats\s+(?:up|boost)/.test(t) && type !== 'passive') { buff('atk', 40); buff('def', 40); buff('speed', 40); }
  { const x = t.match(/(?:shield|barrier|ward|wall|dome)[^.]*?(\d+)%\s+(?:of\s+)?(?:max\s+)?(?:hp|magic power|mp|energy)/) || t.match(/(\d+)%\s+(?:max\s+)?hp\s+(?:shield|barrier)/); if (x && !enemyOnly(t)) m.shieldPct = Math.max(m.shieldPct || 0, Math.min(100, parseInt(x[1], 10))); }
  if (/cannot\s+(?:drop|fall)\s+below\s+1\s+hp|cannot\s+be\s+killed|cannot\s+die|survives?\s+(?:any\s+)?(?:fatal|lethal)|hp\s+cannot\s+drop\s+below\s+1/.test(t)) m.immuneTurns = Math.max(m.immuneTurns || 0, 1);
  if (/(?:clear\w*|remov\w*|cleans\w*|purif\w*|strip\w*)\s+(?:all\s+)?(?:your\s+|party\s+|ally\s+)?(?:debuffs?|status|ailments?|negative)/.test(t) && !enemyOnly(t)) m.cleanse = true;
  if (/immun\w*\s+to\s+(?:all\s+)?(?:debuffs?|status|slows?|stuns?|cc|crowd)|debuff\s+immunity|status\s+immunity/.test(t)) { m.cleanse = true; buff('def', 15, turns(2)); }
  if (/\breflect\w*\s+(\d+)%/.test(t)) m.reflectPct = pct(/reflect\w*\s+(\d+)%/, 20);
  if (/heals?\s+(?:for\s+)?(\d+)%\s+of\s+(?:the\s+)?damage|lifesteal\w*\s+(?:of\s+|for\s+)?(\d+)%|(\d+)%\s+lifesteal/.test(t)) m.lifestealPct = pct(/(\d+)%\s+of\s+(?:the\s+)?damage|lifesteal\w*\s+(?:of\s+|for\s+)?(\d+)%|(\d+)%\s+lifesteal/, 20);
  // Fix (10-26, BUG-172/173/213): on a NON-damage cast, lifesteal is a SELF BUFF that rides every strike for the stated
  // turns ("all strikes gain extreme lifesteal for 2 turns" → lifesteal buff 40% × 2t; "converts 100% damage dealt to
  // health for 3 turns" → 100% × 3t). "Max HP +N%" is a real temporary max-HP boost, not a shield.
  if (type !== 'damage') {
    if (/extreme\s+lifesteal|all\s+strikes\s+gain\s+lifesteal|strikes\s+gain\s+(?:\w+\s+)?lifesteal/.test(t) && !m.lifestealPct) m.lifestealPct = 40;
    if (/converts?\s+(\d+)%\s+(?:of\s+)?damage\s+dealt\s+(?:to|into)\s+(?:health|hp)/.test(t)) m.lifestealPct = Math.max(m.lifestealPct || 0, pct(/converts?\s+(\d+)%\s+(?:of\s+)?damage\s+dealt/, 50));
    if (m.lifestealPct && !enemyOnly(t)) { buff('lifesteal', Math.min(100, m.lifestealPct), turns(2)); m.lifestealPct = 0; }
    { const x = t.match(/max(?:imum)?\s+hp\s*(?:pool\s*)?(?:\+|increased?\s+by\s+|up\s+by\s+|boost\w*\s+by\s+)(\d+)%/) || t.match(/\+(\d+)%\s+max(?:imum)?\s+hp/); if (x && !enemyOnly(t)) buff('maxHp', Math.min(100, parseInt(x[1], 10)), turns(3)); }
  }
  // summons: a conjured ally hits for the stated (or 170%) Magic Power and shields its master
  if (type === 'summon' || (/\b(conjures?|deploys?|raises?\s+(?:a|an|\d+)\s+(?:skeleton|minion|spirit)|reanimat\w+|summons?\s+(?:a|an|\d+)\s+\w+)\b/.test(t) && type !== 'passive' && !/all\s+(?:active\s+)?summons|and\s+summons\b/.test(t))) {
    m.summon = true;
    if (!m.shieldPct) m.shieldPct = 15;
    buff('atk', 20, 3);
  }
  return m;
}
function enemyOnly(t) { return /\b(enemy|enemies|target|foe)\b/.test(t) && !/\b(you|your|self|ally|allies|party|team|own)\b/.test(t) && !/absorb|shield|heal|restor|regen|protect/.test(t); }
function normStat(k) { const l = String(k).toLowerCase(); return /atk|attack/.test(l) ? 'atk' : /def|armor/.test(l) ? 'def' : /spd|speed/.test(l) ? 'speed' : /acc/.test(l) ? 'accuracy' : /dodge|evas/.test(l) ? 'dodge' : /mr|magic res/.test(l) ? 'magicResist' : /crit/.test(l) ? 'crit' : l; }

// Merge the explicit mechanics into a normalised catalog entry (fills gaps only).
function applyMechanics(entry, sk) {
  const m = mechanics(sk);
  entry.buffs = entry.buffs || []; entry.debuffs = entry.debuffs || []; entry.statuses = entry.statuses || [];
  for (const b of m.buffs) if (!entry.buffs.some(x => x && x.stat === b.stat)) entry.buffs.push(b);
  for (const d of m.debuffs) if (!entry.debuffs.some(x => x && x.stat === d.stat)) entry.debuffs.push(d);
  for (const s of m.statuses) if (!entry.statuses.some(x => x && x.type === s.type)) entry.statuses.push(s);
  if (m.party) entry.party = true;
  if (m.healingPct) entry.healingPct = Math.min(100, m.healingPct); // explicit "heals N% max HP" wins over the parser's nearest-% guess
  if (m.noShield) { entry.shieldPct = 0; entry.shieldTurns = 0; }
  if (m.energyPct && !entry.energyPct) entry.energyPct = Math.min(100, m.energyPct);
  if (m.regen && !entry.regen) entry.regen = m.regen;
  if (m.shieldPct && !entry.shieldPct) { entry.shieldPct = m.shieldPct; entry.shieldMode = entry.shieldMode || 'pool'; entry.shieldTurns = entry.shieldTurns || 3; }
  if (m.damageTakenPct && !entry.damageTakenPct) { entry.damageTakenPct = m.damageTakenPct; entry.damageTakenTurns = entry.damageTakenTurns || 2; }
  if (m.immuneTurns && !entry.immuneTurns) entry.immuneTurns = m.immuneTurns;
  if (m.cleanse) entry.cleanse = true;
  if (m.reflectPct && !entry.reflectPct) { entry.reflectPct = m.reflectPct; entry.reflectTurns = entry.reflectTurns || 2; }
  if (m.lifestealPct && !entry.lifestealPct) entry.lifestealPct = Math.min(60, m.lifestealPct);
  if (m.summon) entry.summon = true;
  if (m.forceDamagePct && entry.type !== 'passive') { entry.type = 'damage'; entry.damagePct = Math.max(entry.damagePct || 0, m.forceDamagePct); }
  // strength floor — every active cast does SOMETHING worth its energy
  if (entry.type !== 'passive' && entry.type !== 'damage') {
    const any = entry.buffs.length || entry.debuffs.length || entry.statuses.length || entry.healingPct || entry.energyPct || entry.regen || entry.shieldPct || entry.damageTakenPct || entry.immuneTurns || entry.cleanse || entry.reflectPct || entry.lifestealPct;
    if (!any) {
      if (entry.type === 'debuff') { entry.debuffs.push({ stat: 'atk', amount: 20, duration: 2 }, { stat: 'def', amount: 20, duration: 2 }); }
      else { entry.buffs.push({ stat: 'atk', amount: 20, duration: 2 }, { stat: 'def', amount: 20, duration: 2 }); }
    }
  }
  // "(MP vs MR check)" marks a resistible effect
  if (/mr check|vs mr|magic power > mr|magic power vs mr/i.test(sk.text || '')) entry.mrCheck = true;
  return entry;
}

function rawsFor(className, variant = null) {
  const spec = specFor(className);
  if (!spec) return null;
  // Push #103b: Monster VARIANTS — same 26 slots / same numbers, re-bodied from the
  // creature's anatomy (MonsterKits103): a mantis never bites, a golem has no mouth…
  if (className === 'Monster' && variant && !/^monster$/i.test(String(variant))) {
    try { const MK = require('../data/MonsterKits103'); const sk = MK.rosterSpec(variant); if (sk && sk.length === spec.skills.length) return sk.map((x, i) => toRaw(className, { ...x, _variant: variant }, i)); } catch (e) {}
  }
  return spec.skills.map((sk, i) => toRaw(className, sk, i));
}

module.exports = { SPEC, specFor, hasRevamp, classNames, rawsFor, toRaw, rewrite, damageOf, mechanics, applyMechanics, RANK_COST, RANK_FLOOR, CORE_FLOOR };
