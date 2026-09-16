// ═══════════════════════════════════════════════════════════════
// /fixskills — reconfigure a player's skills to the canonical ladder
//
// Push #54 behaviour:
//   • The skill set is REBUILT from rpg/utils/SkillCatalog.js rather than only
//     "granting missing" entries. That matters for the co-owner (and anyone an
//     older build over-granted): skills handed out by the old privileged
//     awakening are not in the catalog for their class, so they are pruned and
//     the player is left with exactly the ladder their level earns.
//   • Works for every class, including Monster (whose player.class is a variant
//     name like 'Magma Beetle') and Senku.
//   • Accepts a target: /fixskills, reply to a player, or /fixskills @user.
//   • Keeps the stat-allocation cap fix it always had.
// ═══════════════════════════════════════════════════════════════

const LevelUpManager = require('../../rpg/utils/LevelUpManager');
const SkillCatalog = require('../../rpg/utils/SkillCatalog');
const { fixAllocations, getMaxAllocations, STAT_CONFIG } = require('../../rpg/utils/StatAllocationSystem');
const { OWNER_JID, COOWNER_JID } = require('../../utils/constants');

// player.class is a STRING in the current schema and an OBJECT in old docs.
function classLabel(player) {
  const raw = player?.class;
  if (!raw) return 'Classless';
  if (typeof raw === 'object') return raw.name || raw.className || 'Classless';
  return String(raw);
}

module.exports = {
  name: 'fixskills',
  description: 'Rebuild a player\'s skill ladder from the class catalog + fix stat allocation caps (Admin)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const bare = (j) => String(j || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    const privileged = new Set([OWNER_JID, COOWNER_JID].map(bare).filter(Boolean));
    if (!privileged.has(bare(sender))) {
      return sock.sendMessage(chatId, { text: '❌ Only the bot owner or co-owner can use this command!' }, { quoted: msg });
    }

    // Target: self by default, else reply-to or first mention.
    let targetId = sender;
    if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
      targetId = msg.message.extendedTextMessage.contextInfo.participant;
    } else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
      targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }

    let player = db.users?.[targetId];
    if (!player) {
      // @lid ↔ @s.whatsapp.net drift is common — retry on the bare number.
      const tBare = bare(targetId);
      const alt = Object.keys(db.users || {}).find(u => bare(u) === tBare);
      if (alt) { targetId = alt; player = db.users[alt]; }
    }
    if (!player) return sock.sendMessage(chatId, { text: '❌ Player not found!' }, { quoted: msg });

    const before = {
      active: (player.skills?.active || []).length,
      library: (player.availableSkills || []).length,
      passive: (player.skills?.passive || []).length,
      locked: (player.skills?.locked || []).length,
    };

    // ── 1️⃣ Rebuild the ladder from the catalog ─────────────────────────
    let rebuilt = null;
    const roster = SkillCatalog.getRoster(player);
    if (roster.length) {
      rebuilt = SkillCatalog.resetPlayerSkills(player);   // prune + level-gate
    }
    // Legacy fallback for classless/unknown classes and for the old
    // SkillDescriptions-driven schedule.
    const legacyGranted = roster.length ? 0 : LevelUpManager.grantMissingSkills(player);

    // ── 2️⃣ Fix stat allocation caps for the current level ──────────────
    const { refunded, log: allocLog } = fixAllocations(player);

    const level = player.level || 1;
    const capLines = Object.entries(STAT_CONFIG).map(([stat, cfg]) => {
      const current = player.statAllocations?.[stat] || 0;
      return `  ${cfg.emoji} ${cfg.name}: ${current}/${getMaxAllocations(stat, level)}`;
    }).join('\n');

    saveDatabase();

    const after = {
      active: (player.skills?.active || []).length,
      library: (player.availableSkills || []).length,
      passive: (player.skills?.passive || []).length,
      locked: (player.skills?.locked || []).length,
    };

    const allocSection = refunded > 0
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔧 ALLOCATION FIXES\n${allocLog.join('\n')}\n💎 Total UP Refunded: ${refunded}`
      : `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ ALLOCATION CAPS (Lv.${level})\n${capLines}\n✅ All caps are correct for your level!`;

    const message = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `✅ SKILLS RECONFIGURED ✅`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 Player: ${player.name}`,
      `⭐ Level: ${level}`,
      `🔮 Class: ${classLabel(player)}${player.classBase && player.classBase !== player.class ? ` (${player.classBase})` : ''}`,
      `📚 Skill source: ${roster.length ? `SkillCatalog (${roster.length}-skill ladder)` : 'legacy schedule'}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📊 SKILL RESULTS`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      roster.length
        ? `Before → After (active/library/passive/locked)`
        : `✨ Skills Granted: ${legacyGranted}`,
      roster.length
        ? `   ${before.active}/${before.library}/${before.passive}/${before.locked}  →  ${after.active}/${after.library}/${after.passive}/${after.locked}`
        : `   Active: ${after.active}/5 · Library: ${after.library}`,
      `🎯 Equipped slots: ${after.active}/${player.maxSkillSlots || 5}`,
      `🔒 Locked until higher levels: ${after.locked}`,
      `💡 Pruned entries the catalog does not own for this class (old over-grants).`,
      allocSection,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Use /skill for the ladder, /skills to manage slots.`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].filter(l => l !== '').join('\n');

    return sock.sendMessage(chatId, { text: message }, { quoted: msg });
  },
};
