// Push #97: ONE place that answers "is this hunter already in a fight somewhere?"
// Nobody may be in two gates/parties/instances/duels at once; a hunter inside an instance or the
// labyrinth is "not on this realm" and cannot be pulled into raids or duels.
'use strict';

function _raid(sender) {
  try { const GR = require('../dungeons/GateRaid'); return GR.findOtherRaid ? GR.findOtherRaid(sender, null) : null; } catch (e) { return null; }
}
// Returns null when free, else { kind, text }.
function whereBusy(db, sender, player, opts = {}) {
  const skip = new Set(opts.ignore || []);
  const p = player || (db && db.users ? db.users[sender] : null);
  if (p && !skip.has('instance') && p.instance && p.instance.active) return { kind: 'instance', text: `🌀 You are inside an *instance dungeon* (floor ${p.instance.floor || 1}). Leave it first — */instance leave*.` };
  if (p && !skip.has('labyrinth') && p.labyrinth && p.labyrinth.active) return { kind: 'labyrinth', text: `🧭 You are inside the *labyrinth*. Leave it first — */labyrinth leave*.` };
  if (p && !skip.has('pvp') && p.pvpBattle && p.pvpBattle.opponentId) return { kind: 'pvp', text: `⚔️ You are in a *PvP duel*. Finish or forfeit it first.` };
  if (!skip.has('gate')) { const g = _raid(sender); if (g) return { kind: 'gate', text: `🚫 You are already in a *gate raid* (${g.rank || '?'}-Rank · ${g.code || g.keyCode || g.id || '?'}). Finish it, fall in it, or wait for it to end.` }; }
  return null;
}
module.exports = { whereBusy };
