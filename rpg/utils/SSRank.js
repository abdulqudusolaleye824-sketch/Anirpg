'use strict';
// 10-26 (owner): SS-RANK perks — the rank above S. Only /bleep SS grants it (never awakening / Reawakening).
//   • 50% stronger than S (RankPower MULT.SS = 1.5 × S)
//   • legendary title PINNACLE OF EVOLUTION (TitleSystem, auto with the rank)
//   • +30% aura-farm success (commands/rpg/aura.js)
//   • custom entrance ("glaze") line whenever an SS hunter joins a raid or a party (this file)
const LINES = [
  '💠 The air thickens. *{name}* — PINNACLE OF EVOLUTION — has entered. Everything else in this {where} is now a supporting cast.',
  '💠 Gates tremble when *{name}* walks in. An SS-rank hunter just joined the {where}; the beasts should start praying.',
  '💠 Silence. *{name}* — SS-rank, PINNACLE OF EVOLUTION — stands with the {where}. Victory has stopped being a question.',
  '💠 *{name}* did not join the {where}. The {where} was granted the honour of *{name}*. SS-rank. Act accordingly.',
  '💠 Evolution ended with *{name}*. SS-rank. The {where} now outranks the gate it is about to enter.',
];
function isSS(p) { return !!p && String(p.awakenRank || '').toUpperCase() === 'SS'; }
function joinLine(p, where = 'party') {
  if (!isSS(p)) return null;
  const n = String(p.name || 'Hunter');
  const l = LINES[Math.floor(Math.random() * LINES.length)];
  return l.split('{name}').join(n).split('{where}').join(where);
}
module.exports = { isSS, joinLine, LINES };
