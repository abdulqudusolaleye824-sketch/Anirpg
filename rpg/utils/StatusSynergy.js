// ═══════════════════════════════════════════════════════════════
// STATUS SYNERGY — Push #72
// Some attacks hit HARDER when the target is already under a status.
// Works for players AND monsters (any entity with statusEffects[]).
//   bonusFor(move, target) → { mult, notes[] }
// Rules match on the move's own effect type / name / element keywords.
// ═══════════════════════════════════════════════════════════════
'use strict';

// [targetStatus, moveMatcher (regex on `${effectType} ${name} ${desc}`), multiplier, note]
const RULES = [
  ['freeze',   /burn|fire|flame|ember|inferno|magma|lava|blaze|hellfire|solar/i,           1.50, '🔥❄️ Shatter — fire vs frozen'],
  ['freeze',   /crush|hammer|maul|smash|slam|quake|blow|axe|colossus|titan/i,             1.35, '💥❄️ Shatter — blunt vs frozen'],
  ['stun',     /./,                                                                        1.20, '💫 Helpless — target stunned'],
  ['paralyze', /./,                                                                        1.20, '🔱 Helpless — target paralyzed'],
  ['bleed',    /rend|cut|slash|blade|fang|claw|bite|dagger|edge|reap|artery|savage/i,     1.30, '🩸 Open wound — cutting vs bleeding'],
  ['bleed',    /drain|lifesteal|vampir|feast|hunger|leech|siphon/i,                        1.40, '🩸💚 Feast — drain vs bleeding'],
  ['burn',     /wind|gale|tempest|storm|gust|breath|explosion|blast|ignite/i,              1.35, '🔥💨 Flare-up — wind/blast vs burning'],
  ['burn',     /frost|ice|glacial|freeze|snow|blizzard/i,                                  0.80, '❄️🔥 Steam — ice dampened by burn'],
  ['poison',   /venom|toxic|plague|acid|corrupt|rot|decay|curse|hex/i,                     1.30, '☠️ Virulent — toxin vs poisoned'],
  ['weaken',   /execute|finisher|final|death|end|doom|apex|supreme|ultimate/i,             1.30, '💔 Execution — finisher vs weakened'],
  ['weakened', /execute|finisher|final|death|end|doom|apex|supreme|ultimate/i,             1.30, '💔 Execution — finisher vs weakened'],
  ['fear',     /shadow|dark|void|phantom|terror|nightmare|dread|howl|roar/i,               1.30, '😱 Dread — shadow vs feared'],
  ['blind',    /arrow|shot|snipe|pierce|lunge|thrust|strike|mark/i,                        1.25, '🌫️ Unseen — precision vs blinded'],
  ['curse',    /holy|light|divine|sacred|purify|radiant|dawn|blessing/i,                   1.35, '☀️💀 Cleansing fire — holy vs cursed'],
  ['silence',  /arcane|mana|spell|magic|rune|sigil|mind|psychic/i,                         1.25, '🤐 Unanswered — magic vs silenced'],
  ['enfeeble', /pierce|lance|spear|thrust|drill|impale|puncture/i,                         1.30, '🐢 Cracked guard — piercing vs enfeebled'],
  ['trueslow', /rapid|barrage|flurry|swift|quick|dash|blink|volley/i,                      1.25, '🐌 Outpaced — rapid vs slowed'],
];

function moveText(move) {
  if (!move) return '';
  const eff = move.effect && (move.effect.type || move.effect) || '';
  const statuses = Array.isArray(move.statuses) ? move.statuses.map(s => s.type).join(' ') : '';
  return `${eff} ${statuses} ${move.name || ''} ${move.description || move.desc || move.effectText || ''}`.toLowerCase();
}

function bonusFor(move, target) {
  const fx = (target && target.statusEffects) || [];
  if (!fx.length) return { mult: 1, notes: [] };
  const text = moveText(move);
  let mult = 1; const notes = []; const used = new Set();
  for (const [status, re, m, note] of RULES) {
    if (used.has(status)) continue;
    if (!fx.some(e => String(e.type || '').toLowerCase() === status)) continue;
    if (!re.test(text)) continue;
    used.add(status); mult *= m; notes.push(`${note} ×${m.toFixed(2)}`);
  }
  return { mult: Math.max(0.5, Math.min(2.5, mult)), notes };
}

module.exports = { RULES, bonusFor };
