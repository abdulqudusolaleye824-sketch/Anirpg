// ═══════════════════════════════════════════════════════════════
// /class — View your class, class descriptions, skills & activation guide
// ═══════════════════════════════════════════════════════════════

'use strict';

const { CLASS_DATA, formatClassInfo, getQualityLabel, ALL_CLASSES } = require('../../rpg/utils/ClassSystem');
const { getClassCmdName } = require('../../rpg/utils/classcmd');
const { getSkillDescription } = require('../../rpg/utils/SkillDescriptions');

module.exports = {
  name: 'class',
  aliases: ['myclass', 'cls'],
  description: 'View your class info, class guide, skills, and activation guide',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const UI = require('../../rpg/utils/UI');
    const viewer = db.users?.[sender];
    const pro = UI.isPro(viewer || {});
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const firstArg = (args[0] || '').toLowerCase().trim();

    // ── /class weapons [class] (Push #84) — class weapon progression ─────────
    if (firstArg === 'weapons' || firstArg === 'weapon' || firstArg === 'wpn') {
      const PM = require('../../rpg/player/PlayerManager');
      const defs = PM.classDefinitions || {};
      const q = args.slice(1).join(' ').trim().toLowerCase();
      const ownCls = viewer ? (typeof viewer.class === 'string' ? viewer.class : viewer.class?.name) : null;
      let names = Object.keys(defs);
      if (q) names = names.filter(n => n.toLowerCase() === q || n.toLowerCase().includes(q));
      else if (ownCls && defs[ownCls]) names = [ownCls];
      if (!names.length) return sock.sendMessage(chatId, { text: `❌ No class matching *${q}*. Try /class list.` }, { quoted: msg });
      const blocks = names.slice(0, 6).map(n => {
        const d = defs[n];
        const lw = [{ level: 1, ...d.weapon }, ...(d.levelWeapons || [])];
        const cur = viewer && ownCls === n ? (viewer.level || 1) : null;
        return [
          `${(CLASS_DATA[n] || {}).emoji || '🎭'} *${n}*`,
          ...lw.map(w => `  ${cur != null && cur >= w.level ? '✅' : '🔒'} Lv.${w.level}: *${w.name}* (+${w.bonus} ATK)`),
        ].join('\n');
      });
      return sock.sendMessage(chatId, { text: [
        ...(pro ? [UI.PRO_BAR, `🗡️ *CLASS WEAPONS* 💎`, UI.PRO_BAR] : [`🗡️ *CLASS WEAPONS*`, UI.FREE_BAR]),
        ``, ...blocks.join('\n\n').split('\n'), ``, FRAME,
        `💡 Class weapons auto-upgrade as you level. Store weapons (/store, /weapons) replace them when equipped.`,
        `📋 /class weapons <class> to view another class · /class list for all classes`,
        ...(pro ? [] : [UI.upsell()]),
      ].join('\n') }, { quoted: msg });
    }

    // ── LIST ALL CLASSES (/class list) ──────────────────────────────────────
    if (firstArg === 'list' || firstArg === 'all') {
      const classList = ALL_CLASSES.map(clsName => {
        const d = CLASS_DATA[clsName] || {};
        const cmd = getClassCmdName(clsName);
        return `${d.emoji || '🎭'} *${clsName}* (/${cmd})\n   _${d.lore || d.description || 'No description available.'}_`;
      });

      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `🎭 *HUNTER CLASS DIRECTORY (${ALL_CLASSES.length} CLASSES)* 💎`, UI.PRO_BAR] : [`🎭 *HUNTER CLASS DIRECTORY (${ALL_CLASSES.length} CLASSES)*`, UI.FREE_BAR]),
          ``,
          ...classList,
          ``,
          FRAME,
          `💡 Use */class <ClassName>* to view specific class details & skills!`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO CLASS* — ${ALL_CLASSES.length} classes`] : [UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── VIEW SPECIFIC CLASS BY NAME (/class Mage) ───────────────────────────
    const matchedClass = ALL_CLASSES.find(c => c.toLowerCase() === firstArg || c.toLowerCase() === args.slice(1).join(' ').toLowerCase());
    if (matchedClass) {
      const data = CLASS_DATA[matchedClass] || {};
      const cmd = getClassCmdName(matchedClass);
      const skills = data.skills || [];

      const skillDetails = skills.map((s, i) => {
        const sd = getSkillDescription(matchedClass, s.name) || {};
        const desc = sd.description || s.desc || 'No description.';
        const eff = sd.effect ? `\n     ✨ *Effect:* ${sd.effect.replace(/\n/g, '\n     ')}` : '';
        const cost = sd.energyCost ? ` | ⚡ Cost: ${sd.energyCost}` : '';
        const cd = sd.cooldown ? ` | ⌛ CD: ${sd.cooldown}t` : '';
        return `  ${i + 1}. *${s.name}*${cost}${cd}\n     ${desc}${eff}`;
      });

      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `${data.emoji || '🎭'} *${matchedClass.toUpperCase()} CLASS GUIDE* 💎`, UI.PRO_BAR] : [`${data.emoji || '🎭'} *${matchedClass.toUpperCase()} CLASS GUIDE*`, UI.FREE_BAR]),
          ``,
          `📜 *Description:*`,
          `_${data.lore || data.description || 'A powerful awakener class.'}_`,
          ``,
          `📌 *In-Battle Command:* */${cmd} <skill_name>*`,
          ``,
          FRAME,
          `⚡ *CLASS SKILLS:*`,
          ...skillDetails,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO CLASS* — ${matchedClass} · ${skills.length} skills`] : [UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // Allow viewing another player's class
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const targetId     = mentionedJid || sender;
    const player       = db.users?.[targetId];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: mentionedJid ? `❌ That player is not registered.` : `❌ Register first! Use /register`,
      }, { quoted: msg });
    }

    // ── No class yet ──────────────────────────────────────────────────────────
    if (!player.class) {
      const threshold = player.classAwakeningThreshold;
      const currentXp = player.totalXp || player.xp || 0;
      const remaining = threshold ? Math.max(0, threshold - currentXp) : null;

      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `🎭 *CLASS STATUS* 💎`, UI.PRO_BAR] : [`🎭 *CLASS STATUS*`, UI.FREE_BAR]),
          ``,
          `${player.name} has not awakened a class yet.`,
          ``,
          remaining !== null
            ? `⚡ Awakening threshold set. Keep earning XP...`
            : `⚡ Awakening triggers between 50,000–150,000 total XP.`,
          ``,
          `There are *${ALL_CLASSES.length}* possible classes.`,
          `The pull is random. Quality is random.`,
          `Neither can be changed.`,
          ``,
          `💡 Use */class list* to view all available classes!`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, remaining !== null ? `💎 *PRO CLASS* — ${remaining.toLocaleString()} XP to go` : `💎 *PRO CLASS* — keep grinding`] : [UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── Has class ─────────────────────────────────────────────────────────────
    const baseClass = player.classBase || player.class;
    const data      = CLASS_DATA[baseClass] || CLASS_DATA[player.class] || {};
    const quality   = player.classQuality || 0;
    const qualLabel = getQualityLabel(quality);
    const playerCmd = getClassCmdName(player.class);

    const stars = quality >= 90 ? '⭐⭐⭐⭐⭐'
                : quality >= 70 ? '⭐⭐⭐⭐'
                : quality >= 50 ? '⭐⭐⭐'
                : quality >= 30 ? '⭐⭐'
                : '⭐';

    // Only skills the player has actually UNLOCKED are listed. classSkills used
    // to dump the whole class kit regardless of level, which is what made the
    // co-owner look like "all skills unlocked after awakening".
    let SCc = null;
    try { SCc = require('../../rpg/utils/SkillCatalog'); SCc.syncPlayerSkills(player); } catch (e) {}
    let rawSkills;
    if (SCc && SCc.getRoster(player).length) {
      rawSkills = SCc.unlockedSkills(player).concat(SCc.passiveSkills(player));
    } else {
      rawSkills = (player.classSkills || data.skills || []).filter(s => {
        const need = s.unlocksAtLevel || s.unlockedAt || 0;
        return !need || (player.level || 1) >= need;
      });
    }
    const _clsName = SCc ? SCc.canonicalClassName(player) : (typeof player.class === 'object' ? player.class?.name : player.class);
    const skillLines = rawSkills.map((s, i) => {
      const sd = getSkillDescription(_clsName, s.name) || {};
      const desc = s.desc || sd.description || 'No description.';
      const eff = sd.effect ? `\n     ✨ ${sd.effect.replace(/\n/g, '\n     ')}` : '';
      return `  ${i+1}. *${s.name}*\n     ${desc}${eff}`;
    });

    // Stat bonuses at this quality — Push #74: these are now REALLY applied
    // (ClassPower.ensureClassBonuses) and shown from the applied record.
    try { require('../../rpg/utils/ClassPower').ensureClassBonuses(player); } catch (e) {}
    const _appliedB = (player.classBonusApplied && player.classBonusApplied.bonuses) || null;
    const bonusLines = Object.entries(data.maxBonuses || {}).map(([stat, max]) => {
      const _k = stat === 'hp' ? 'maxHp' : stat;
      const actual = _appliedB && _appliedB[_k] != null ? _appliedB[_k] : Math.floor((quality/100) * max);
      const label  = stat === 'hp' ? 'HP' : stat === 'atk' ? 'ATK' : stat === 'def' ? 'DEF'
        : stat === 'speed' ? 'Speed' : stat === 'maxEnergy' ? 'Energy' : stat === 'magicPower' ? 'Magic Pwr' : stat;
      return `  ${actual > 0 ? '+' : ''}${actual} ${label}`;
    }).filter(Boolean);

    const awakenDate = player.classAwakenedAt
      ? new Date(player.classAwakenedAt + 3600000).toISOString().slice(0,10)
      : 'Unknown';

    const exampleSkill = rawSkills[0]?.name || 'skill';

    return sock.sendMessage(chatId, {
      text: [
        ...(pro ? [UI.PRO_BAR, `${data.emoji || '🎭'} *${player.name}'s CLASS GUIDE* 💎`, UI.PRO_BAR] : [`${data.emoji || '🎭'} *${player.name}'s CLASS GUIDE*`, UI.FREE_BAR]),
        ``,
        `🎭 Class: *${typeof player.class === 'object' ? (player.class?.name || 'Unknown') : player.class}*`,
        `📜 Description: _${data.lore || data.description || 'A unique awakener class.'}_`,
        ``,
        `✨ Quality: *${quality}%* ${stars}`,
        `   ${qualLabel}`,
        `📅 Awakened: ${awakenDate}`,
        ``,
        FRAME,
        `📊 *STAT BONUSES* (applied to your stats, scaled by ${quality}% quality):`,
        ...bonusLines,
        ...(() => { try { const pm = require('../../rpg/utils/ClassPower').passiveMultipliers(player); const parts = []; if (pm.atk) parts.push(`ATK +${pm.atk.toFixed(0)}%`); if (pm.def) parts.push(`DEF +${pm.def.toFixed(0)}%`); if (pm.crit) parts.push(`Crit +${pm.crit.toFixed(0)}%`); if (pm.dodge) parts.push(`Dodge +${pm.dodge.toFixed(0)}%`); if (pm.dmgTaken) parts.push(`Dmg taken ${pm.dmgTaken.toFixed(0)}%`); return parts.length ? [`🌀 Passives (live): ${parts.join(' · ')}`] : []; } catch (e) { return []; } })(),
        ``,
        FRAME,
        `⚡ *CLASS SKILLS:*`,
        ...skillLines,
        ``,
        FRAME,
        `⚔️ *IN-BATTLE SKILL ACTIVATION:*`,
        `📌 Your Class Trigger: */${playerCmd} <skill_name>*`,
        `📌 Example: */${playerCmd} ${exampleSkill}*`,
        ``,
        `🎭 *CLASS COMMAND SHORTCUTS (23 CLASSES):*`,
        `• Healer: /heal <skill>`,
        `• Mage: /call or /cast <skill>`,
        `• Berserker: /rage <skill>`,
        `• Assassin: /strike <skill>`,
        `• Paladin: /prayer <skill>`,
        `• Necromancer: /hex <skill>`,
        `• Chronomancer: /rewind <skill>`,
        `• Shaman: /chant <skill>`,
        `• Warlord: /rally <skill>`,
        `• Phantom: /veil <skill>`,
        `• Devourer: /feast <skill>`,
        `• DragonKnight: /roar <skill>`,
        `• ShadowDancer: /dance <skill>`,
        `• Summoner: /summon <skill>`,
        `• BloodKnight: /drain <skill>`,
        `• SpellBlade: /slash <skill>`,
        `• Elementalist: /storm <skill>`,
        `• Warrior: /swing <skill>`,
        `• Archer: /aim <skill>`,
        `• Rogue: /sneak <skill>`,
        `• Knight: /shield <skill>`,
        `• Monk: /meditate <skill>`,
        `• Ranger: /hunt <skill>`,
        `• Senku: /science <skill>`,
        FRAME,
        ...(pro ? [UI.PRO_MINI, `💎 *PRO CLASS* — ${player.class} ${quality}% ${stars}`] : [UI.upsell()]),
      ].join('\n'),
    }, { quoted: msg });
  },
};
