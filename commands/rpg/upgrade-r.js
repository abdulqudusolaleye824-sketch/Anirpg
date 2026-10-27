/**
 * /upgrade-r <skill slot> @hunter   — OWNER ONLY (10-26, owner)
 * Resets the skill in that slot back to Lv.1 and REFUNDS what the upgrades cost:
 *   • levels bought with Nexus  → Nexus back (exact formula cost per level: 45,000 × 1.7^(lv−1))
 *   • levels bought with skill-upgrade credits (the "upgrade tickets" refunded by the revamp) → credits back
 * The skill remembers how each level was paid from now on (skill.upgradePaid); older levels are refunded in Nexus.
 */
'use strict';
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'upgrade-r',
  aliases: ['upgrader', 'skillreset-r', 'upgradereset'],
  description: '👑 Owner: reset a hunter\'s skill slot back to Lv.1 and refund the Nexus / upgrade credits spent',
  usage: '/upgrade-r <slot#> @hunter',
  category: 'admin',
  ownerOnly: true,
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return; // OWNER ONLY — silent for everyone else
    const slot = parseInt(String(args[0] || '').replace(/^#/, ''), 10);
    const T = require('../../utils/target'); const OG = require('../../rpg/utils/OwnerGrant');
    const targetJid = T.resolve(msg, args.slice(1));
    if (!Number.isFinite(slot) || slot < 1 || !targetJid) return sock.sendMessage(chatId, { text: `❌ Usage: */upgrade-r <slot#> @hunter* (or reply)\nExample: */upgrade-r 2 @Hunter*` }, { quoted: msg });
    const tp = OG.findUser(db, targetJid);
    if (!tp || !tp.name) return sock.sendMessage(chatId, { text: '❌ That hunter is not registered.' }, { quoted: msg });
    const equipped = (tp.skills && Array.isArray(tp.skills.active)) ? tp.skills.active : [];
    const skill = equipped[slot - 1];
    if (!skill) return sock.sendMessage(chatId, { text: `❌ *${tp.name}* has no skill in slot ${slot}.` }, { quoted: msg });
    const lv = Number(skill.level) || 1;
    if (lv <= 1) return sock.sendMessage(chatId, { text: `ℹ️ *${skill.name}* (slot ${slot}) is already Lv.1 — nothing to refund.` }, { quoted: msg });

    let costOf = (l) => Math.round(45000 * Math.pow(1.7, l - 1));
    try { const SC = require('../../rpg/utils/SkillCatalog'); if (typeof SC.skillUpgradeCost === 'function') costOf = (l) => Number(SC.skillUpgradeCost(l)) || Math.round(45000 * Math.pow(1.7, l - 1)); } catch (e) {}
    const paid = Array.isArray(skill.upgradePaid) ? skill.upgradePaid : []; // [{ from, to, nexus } | { from, to, credit: true }]
    let nexus = 0, credits = 0;
    for (let l = 1; l < lv; l++) {
      const rec = paid.find(r => r && Number(r.from) === l);
      if (rec && rec.credit) credits += 1;
      else if (rec && Number.isFinite(Number(rec.nexus))) nexus += Math.max(0, Math.floor(Number(rec.nexus)));
      else nexus += costOf(l);
    }
    // Strip the level bonuses the upgrades granted (same hook /skills upgrade uses, in reverse), then reset.
    try { const SK = require('./skills'); if (typeof SK.removeSkillLevelBonus === 'function') SK.removeSkillLevelBonus(skill, tp); } catch (e) {}
    const before = lv;
    skill.level = 1; skill.upgradePaid = [];
    try { require('../../rpg/utils/SkillCatalog').syncPlayerSkills(tp); } catch (e) {}
    tp.gold = (Number(tp.gold) || 0) + nexus;
    if (credits > 0) tp.skillUpgradeCredits = (Number(tp.skillUpgradeCredits) || 0) + credits;
    if (!Array.isArray(db.upgradeResets)) db.upgradeResets = [];
    db.upgradeResets.push({ by: sender, target: tp.jid || targetJid, slot, skill: skill.name, from: before, nexus, credits, at: Date.now() });
    if (db.upgradeResets.length > 500) db.upgradeResets.splice(0, db.upgradeResets.length - 500);
    saveDatabase();
    return sock.sendMessage(chatId, { text: [
      `♻️ *SKILL UPGRADE RESET*`,
      ``,
      `👤 *${tp.name}* · slot ${slot}: *${skill.name}* Lv.${before} → *Lv.1*`,
      nexus > 0 ? `💠 Refunded *${nexus.toLocaleString()} Nexus*` : null,
      credits > 0 ? `🎟️ Refunded *${credits}* skill-upgrade credit${credits === 1 ? '' : 's'}` : null,
      ``,
      `💠 ${tp.name}'s Nexus: *${(Number(tp.gold) || 0).toLocaleString()}*`,
    ].filter(l => l !== null).join('\n'), mentions: [tp.jid || targetJid] }, { quoted: msg });
  },
};
