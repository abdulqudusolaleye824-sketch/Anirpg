// Push #103c: SKILL LEVEL RESTORE (one-shot, db.migrations.skillLevels_103c).
//   The revamp re-laddered every class and the sync re-locked skills at Lv.1 — upgrade levels hunters had PAID for
//   were dropped. Levels were recovered from the pre-revamp snapshot (snap-20261018-001952) into
//   rpg/data/OldSkillLevels103c.json (jid → { name, class, levels: { skillName: level } }).
//     • a skill that still exists in the hunter's roster (same name, any slot: bar / library / locked / passive)
//       gets its old level back (never lowered)
//     • a skill that no longer exists → the lost levels become SKILL UPGRADE CREDITS (player.skillUpgradeCredits);
//       `/skills upgrade` spends a credit before it spends Nexus, on any skill the hunter chooses
'use strict';
const path = require('path');
let DATA = null;
function data() { if (DATA) return DATA; try { DATA = require(path.join(__dirname, '..', 'data', 'OldSkillLevels103c.json')); } catch (e) { DATA = {}; } return DATA; }
function restorePlayer(u, rec) {
  if (!u || !rec || !rec.levels) return { restored: 0, credits: 0 };
  let restored = 0, credits = 0;
  const arrs = [u.skills?.active, u.availableSkills, u.skills?.locked, u.skills?.passive].filter(Array.isArray);
  const norm = (x) => String(x || '').toLowerCase().trim();
  for (const [name, lv] of Object.entries(rec.levels)) {
    const want = Math.max(1, Math.min(5, Number(lv) || 1)); if (want <= 1) continue;
    let hit = null;
    for (const a of arrs) { const f = a.find(s => s && norm(s.name) === norm(name)); if (f) { hit = f; break; } }
    if (hit) { if ((Number(hit.level) || 1) < want) { hit.level = want; restored++; } }
    else credits += want - 1;
  }
  if (credits) u.skillUpgradeCredits = (Number(u.skillUpgradeCredits) || 0) + credits;
  return { restored, credits };
}
function run(db) {
  if (!db) return 0; if (!db.migrations) db.migrations = {};
  if (db.migrations.skillLevels_103c) return 0;
  const D = data(); let players = 0, restored = 0, credits = 0;
  for (const [jid, rec] of Object.entries(D)) {
    const u = (db.users || {})[jid]; if (!u) continue;
    try { require('./SkillCatalog').syncPlayerSkills(u); } catch (e) {}
    const r = restorePlayer(u, rec); if (r.restored || r.credits) players++; restored += r.restored; credits += r.credits;
  }
  db.migrations.skillLevels_103c = { at: Date.now(), players, restored, credits };
  return players;
}
module.exports = { run, restorePlayer };
