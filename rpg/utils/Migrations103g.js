// Push #103g: one-shot refunds (db.migrations.refunds_103g).
//   BUG-103 — Zeref re-bought skill levels with Nexus right after the #103c reset; the migration then restored the levels
//   and left the Nexus gone. Refund 300,000 💠 once.
'use strict';
const REFUNDS = [{ key: '64699454501028@lid', name: 'Zeref', gold: 300000, why: 'BUG-103 skill-upgrade Nexus spent before the #103c level restore' }];
function run(db) {
  if (!db) return 0; if (!db.migrations) db.migrations = {};
  if (db.migrations.refunds_103g) return 0;
  const done = [];
  for (const r of REFUNDS) {
    const u = db.users && (db.users[r.key] || Object.values(db.users).find(x => x && x.name === r.name));
    if (!u) continue;
    u.gold = (Number(u.gold) || 0) + r.gold; done.push({ key: r.key, gold: r.gold });
  }
  db.migrations.refunds_103g = { at: Date.now(), done };
  return done.length;
}
module.exports = { run, REFUNDS };
