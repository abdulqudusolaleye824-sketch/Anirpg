// ═══════════════════════════════════════════════════════════════
// MONSTER TYPES — Push #96h
// Every beast family gets the body it deserves. Pure BUFFS (≥ ×1 / +0) on
// top of whatever scaling already happened — nothing is ever reduced.
//   construct / reptile  → armour (DEF, some HP)
//   beast / elf / goblin → sleek (SPEED, crit)
//   insect / slime / undead → bulk (HP)
//   demon                → savage (ATK, crit)
// Idempotent: a monster is typed once (flag _typed) — scaling code that
// recomputes from _base calls `mults()` instead and multiplies itself.
// ═══════════════════════════════════════════════════════════════
'use strict';
const TYPE_BUFFS = {
  construct: { label: '🪨 Armoured',  hp: 1.15, atk: 1.00, def: 1.60, speed: 1.00, crit: 0  },
  reptile:   { label: '🐊 Scaled',    hp: 1.10, atk: 1.05, def: 1.35, speed: 1.05, crit: 0  },
  beast:     { label: '🐺 Sleek',     hp: 1.00, atk: 1.05, def: 1.00, speed: 1.40, crit: 10 },
  elf:       { label: '🧝 Precise',   hp: 1.00, atk: 1.10, def: 1.00, speed: 1.30, crit: 15 },
  goblinoid: { label: '👺 Cunning',   hp: 1.00, atk: 1.10, def: 1.00, speed: 1.15, crit: 5  },
  insect:    { label: '🐜 Hive',      hp: 1.50, atk: 1.00, def: 1.10, speed: 1.15, crit: 0  },
  slime:     { label: '🟢 Amorphous', hp: 1.60, atk: 1.00, def: 1.10, speed: 1.00, crit: 0  },
  undead:    { label: '💀 Relentless',hp: 1.30, atk: 1.00, def: 1.15, speed: 1.00, crit: 0  },
  demon:     { label: '😈 Savage',    hp: 1.00, atk: 1.30, def: 1.00, speed: 1.10, crit: 8  },
  wild:      { label: '🌿 Wild',      hp: 1.00, atk: 1.00, def: 1.00, speed: 1.00, crit: 0  },
};
function familyOf(monster) {
  if (!monster) return 'wild';
  if (monster.family && TYPE_BUFFS[monster.family]) return monster.family;
  try { const f = require('../dungeons/GateManager').monsterFamily(monster.name || monster.baseName || ''); if (f && TYPE_BUFFS[f]) return f; } catch (e) {}
  return 'wild';
}
function mults(monster) { return TYPE_BUFFS[familyOf(monster)] || TYPE_BUFFS.wild; }
function label(monster) { return mults(monster).label; }
// Apply once to a flat monster ({hp,maxHp,atk,def,speed}) or a {stats:{}} monster.
function apply(monster) {
  if (!monster || monster._typed) return monster;
  const m = mults(monster); const st = monster.stats && typeof monster.stats === 'object' ? monster.stats : monster;
  const pct = (typeof st.hp === 'number' && typeof st.maxHp === 'number' && st.maxHp > 0) ? st.hp / st.maxHp : 1;
  if (typeof st.maxHp === 'number') { st.maxHp = Math.round(st.maxHp * m.hp); st.hp = Math.max(1, Math.round(st.maxHp * pct)); }
  else if (typeof st.hp === "number") st.hp = Math.round(st.hp * m.hp);
  if (typeof st.atk === 'number') st.atk = Math.floor(st.atk * m.atk);
  if (typeof st.def === 'number') st.def = Math.floor(st.def * m.def);
  if (typeof st.speed === 'number') st.speed = Math.round(st.speed * m.speed);
  monster.critBonus = (Number(monster.critBonus) || 0) + m.crit;
  monster._typed = familyOf(monster); monster.typeLabel = m.label;
  return monster;
}
module.exports = { TYPE_BUFFS, familyOf, mults, label, apply };
