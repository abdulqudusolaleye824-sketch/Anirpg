// ═══════════════════════════════════════════════════════════════
// /globalskill — OWNER/CO-OWNER, DM ONLY (Push #74)
// Recalibrates EVERY awakened hunter: strips + re-applies their class's
// quality-scaled stat bonuses (ClassPower), rebuilds the skill ladder from
// the catalog, refreshes classSkills text, and normalises legacy
// `class: {name}` objects to strings. Idempotent — safe to run repeatedly.
// ═══════════════════════════════════════════════════════════════
'use strict';

const { OWNER_JID, COOWNER_JID } = require('../../utils/constants');
const ClassPower = require('../../rpg/utils/ClassPower');

function bare(j) { return String(j || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }

function runGlobalRecalibration(db) {
  const out = { total: 0, awakened: 0, statsChanged: 0, skillsChanged: 0, normalised: 0, errors: 0, byClass: {} };
  for (const [jid, u] of Object.entries(db.users || {})) {
    if (!u || typeof u !== 'object') continue;
    out.total++;
    try {
      if (u.class && typeof u.class === 'object') { u.class = u.class.name || u.class.className || null; out.normalised++; }
      if (!u.class) { if (u.classBonusApplied) { ClassPower.recalibrate(u); } continue; }
      out.awakened++;
      const r = ClassPower.recalibrate(u);
      if (r.statsChanged) out.statsChanged++;
      if (r.skills && r.skills.changed) out.skillsChanged++;
      const c = ClassPower.baseClassName(u) || 'Unknown';
      out.byClass[c] = (out.byClass[c] || 0) + 1;
    } catch (e) { out.errors++; }
  }
  return out;
}

module.exports = {
  name: 'globalskill',
  aliases: ['globalskills', 'recalibrate'],
  description: 'Recalibrate every awakened hunter\'s class stats + skills (owner, DM only)',
  runGlobalRecalibration,

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const privileged = new Set([OWNER_JID, COOWNER_JID].map(bare).filter(Boolean));
    let ok = privileged.has(bare(sender));
    try { const P = require('../../utils/permissions'); if (!ok && P.isBotOwner && P.isBotOwner(db, sender)) ok = true; } catch (e) {}
    if (!ok) return; // never acknowledge to non-owners
    if (String(chatId).endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '🔒 /globalskill runs from DM only.' }, { quoted: msg });
    }
    const t0 = Date.now();
    const r = runGlobalRecalibration(db);
    try { saveDatabase(); } catch (e) {}
    const top = Object.entries(r.byClass).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c, n]) => `  • ${c}: ${n}`);
    return sock.sendMessage(chatId, { text: [
      `🌐 *GLOBAL SKILL RECALIBRATION*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👥 Hunters scanned: *${r.total}*`,
      `🎭 Awakened: *${r.awakened}*`,
      `📊 Class stat bonuses corrected: *${r.statsChanged}*`,
      `⚡ Skill ladders rebuilt: *${r.skillsChanged}*`,
      `🧹 Legacy class objects normalised: *${r.normalised}*`,
      r.errors ? `⚠️ Errors: ${r.errors}` : null,
      ``,
      `*By class:*`, ...top,
      ``,
      `⏱ ${Date.now() - t0}ms · every awakened hunter now carries their quality-scaled class stats and passives.`,
    ].filter(Boolean).join('\n') }, { quoted: msg });
  },
};
