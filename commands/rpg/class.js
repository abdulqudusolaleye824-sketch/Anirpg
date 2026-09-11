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

    const rawSkills = (player.classSkills || data.skills || []);
    const skillLines = rawSkills.map((s, i) => {
      const sd = getSkillDescription(player.class, s.name) || {};
      const desc = s.desc || sd.description || 'No description.';
      const eff = sd.effect ? `\n     ✨ ${sd.effect.replace(/\n/g, '\n     ')}` : '';
      return `  ${i+1}. *${s.name}*\n     ${desc}${eff}`;
    });

    // Stat bonuses at this quality
    const bonusLines = Object.entries(data.maxBonuses || {}).map(([stat, max]) => {
      const actual = Math.floor(Math.max(0.10, quality/100) * max);
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
        `🎭 Class: *${player.class}*`,
        `📜 Description: _${data.lore || data.description || 'A unique awakener class.'}_`,
        ``,
        `✨ Quality: *${quality}%* ${stars}`,
        `   ${qualLabel}`,
        `📅 Awakened: ${awakenDate}`,
        ``,
        FRAME,
        `📊 *STAT BONUSES:*`,
        ...bonusLines,
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
