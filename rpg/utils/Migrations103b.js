// Push #103b: CLASS REVAMP migration (one-shot, keyed in db.migrations.runes_103b).
//   Every classed hunter:
//     • skill ownership moves to player.skills.learned (empty — nothing is auto-learned)
//     • old keepsake rune stones whose skill no longer exists in the revamped ladder are removed
//     • a Rune Stone is placed in the bag for EVERY skill the hunter is entitled to
//       (core slots ≤ level, rank slots ≤ live Hunter Rank) → they get their skills back via /rune use
//     • bar / library / passives are re-synced (all locked until runes are used)
//     • Magic Resistance stat initialised (stats.magicResist / statAllocations.magicResist)
'use strict';
function migratePlayer(u) {
  if (!u || typeof u !== 'object') return { stones: 0 };
  if (!u.stats || typeof u.stats !== 'object') u.stats = {};
  if (u.stats.magicResist == null) u.stats.magicResist = 0;
  if (u.baseStats && typeof u.baseStats === 'object' && u.baseStats.magicResist == null) u.baseStats.magicResist = 0;
  if (u.statAllocations && typeof u.statAllocations === 'object' && u.statAllocations.magicResist == null) u.statAllocations.magicResist = 0;
  if (!u.class) return { stones: 0 };
  if (!u.skills || typeof u.skills !== 'object') u.skills = {};
  u.skills.learned = [];
  u.skills.unlockedOverrides = [];
  let stones = 0;
  try {
    const SC = require('./SkillCatalog'); const SR = require('./SkillRunes');
    const names = new Set(SC.getRoster(u).map(e => String(e.name).toLowerCase()));
    const items = (u.inventory && Array.isArray(u.inventory.items)) ? u.inventory.items : [];
    for (let i = items.length - 1; i >= 0; i--) { const it = items[i]; if (it && it.isRuneStone && (it.skillKind || 'class') === 'class' && !names.has(String(it.skill || '').toLowerCase())) items.splice(i, 1); }
    stones = SR.grantEntitled(u, 'revamp_103b').length;
    SC.syncPlayerSkills(u);
  } catch (e) {}
  return { stones };
}
function run(db) {
  if (!db) return 0; if (!db.migrations) db.migrations = {};
  if (db.migrations.runes_103b) return 0;
  let players = 0, stones = 0;
  for (const u of Object.values(db.users || {})) { const r = migratePlayer(u); if (r.stones) players++; stones += r.stones; }
  db.migrations.runes_103b = { at: Date.now(), players, stones };
  return players;
}
module.exports = { run, migratePlayer };
