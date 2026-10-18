// Push #103f: MAGIC RESISTANCE BASELINE (one-shot, db.migrations.magicResist_103f).
//   Every hunter receives stats.magicResist = max(current, MagicResist.baseline(player)) — level × 2 + Hunter Rank + class
//   affinity. Never lowers an existing value; upgrade points already spent on MR stay on top.
'use strict';
function run(db) {
  if (!db) return 0; if (!db.migrations) db.migrations = {};
  if (db.migrations.magicResist_103f) return 0;
  const MR = require('./MagicResist'); let players = 0, total = 0;
  for (const u of Object.values(db.users || {})) {
    if (!u || typeof u !== 'object' || !u.stats) continue;
    if (u.stats.magicResist == null) u.stats.magicResist = 0;
    const g = MR.grantBaseline(u); if (g > 0) { players++; total += g; }
  }
  db.migrations.magicResist_103f = { at: Date.now(), players, total };
  return players;
}
module.exports = { run };
