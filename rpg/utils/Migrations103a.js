// Push #103a: one-shot data repairs (run once at boot, keyed in db.migrations).
//   • leakedDomainText_103a — BUG-100: the domain DM setup swallowed unrelated DM text; the one hit on live
//     (description "astra2026") is cleared so the hunter can submit a real one via /domain desc (owner-approved).
//   • ghostRaids_103a — BUG-093: expire 'recruiting' parties that never started (members were held hostage).
//   • antiLinkMuteKeys_103a — BUG-090: anti-link mutes were written under the full JID with no mutedBy; drop them.
'use strict';
function run(db) {
  if (!db) return 0; if (!db.migrations) db.migrations = {}; let n = 0;
  if (!db.migrations.leakedDomainText_103a) {
    for (const u of Object.values(db.users || {})) {
      const d = u && u.domain; if (!d) continue;
      if (/^astra\s*20\d\d$/i.test(String(d.desc || '').trim())) { d.desc = ''; delete d.descEdited; n++; }
      if (/^astra\s*20\d\d$/i.test(String(d.name || '').trim())) { try { const DS = require('./DomainSystem'); d.name = DS.effectFor(d.class, d.idx).name; } catch (e) {} n++; }
    }
    db.migrations.leakedDomainText_103a = { at: Date.now(), fixed: n };
  }
  if (!db.migrations.ghostRaids_103a) {
    let g = 0;
    try { const GR = require('../dungeons/GateRaid'); for (const gate of Object.values(db.activeGates || {})) { if (gate && gate.raid && GR.raidIsGhost(gate) && gate.raid.status !== 'expired') { GR.expireGhostRaid(gate, null); g++; } } } catch (e) {}
    db.migrations.ghostRaids_103a = { at: Date.now(), expired: g }; n += g;
  }
  if (!db.migrations.antiLinkMuteKeys_103a) {
    let m = 0;
    for (const [k, r] of Object.entries(db.mutedUsers || {})) if (k.includes('@') && r && !r.mutedBy) { delete db.mutedUsers[k]; m++; }
    db.migrations.antiLinkMuteKeys_103a = { at: Date.now(), dropped: m }; n += m;
  }
  return n;
}
module.exports = { run };
