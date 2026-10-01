// ═══════════════════════════════════════════════════════════════
// /class — View your class, class descriptions, skills & activation guide
// ═══════════════════════════════════════════════════════════════

'use strict';

const { CLASS_DATA, formatClassInfo, getQualityLabel, ALL_CLASSES } = require('../../rpg/utils/ClassSystem');
const { getClassCmdName } = require('../../rpg/utils/classcmd');
const { getSkillDescription, describeSkill } = require('../../rpg/utils/SkillDescriptions');

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
      let defs = PM.classDefinitions || {};
      // Push #92: a Monster hunter sees THEIR variant's natural-weapon ladder.
      let _monsterVariant = null;
      try {
        const CPm = require('../../rpg/utils/ClassPower'); const TFm = require('../../rpg/utils/Transformation');
        if (viewer && /^monster$/i.test(CPm.baseClassName(viewer) || '')) {
          const v = TFm.variantName(viewer);
          if (v && !/^monster$/i.test(v) && defs.Monster) { _monsterVariant = v; defs = { ...defs, Monster: { ...defs.Monster, ...require('../../rpg/data/MonsterVariantKits').weaponDef(v) } }; }
        }
      } catch (e) {}
      const CPw = require('../../rpg/utils/ClassPower');
      // Push #92: /class weapons buy <level|name> — class weapons are purchased, not auto-unlocked.
      if (/^(buy|purchase)$/i.test(String(args[1] || '')) ) {
        if (!viewer) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
        const r = CPw.buyClassWeapon(viewer, args.slice(2).join(' '));
        if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
        saveDatabase();
        return sock.sendMessage(chatId, { text: [
          ...(pro ? [UI.PRO_BAR, `🗡️ *CLASS WEAPON BOUGHT!* 💎`, UI.PRO_BAR] : [`🗡️ *CLASS WEAPON BOUGHT!*`, UI.FREE_BAR]),
          `*${r.weapon.name}* (+${r.weapon.bonus} ATK) — ${r.cls}`,
          `💠 −${r.price.toLocaleString()} Nexus · left ${(viewer.gold || 0).toLocaleString()}`,
          r.equipped ? `✅ Equipped.` : `📦 Owned — a store weapon stays equipped; it is your class fallback.`,
          FRAME,
        ].join('\n') }, { quoted: msg });
      }
      const q = args.slice(1).join(' ').trim().toLowerCase();
      const ownCls = viewer ? (typeof viewer.class === 'string' ? viewer.class : viewer.class?.name) : null;
      let names = Object.keys(defs);
      if (q) names = names.filter(n => n.toLowerCase() === q || n.toLowerCase().includes(q));
      else if (_monsterVariant) names = ['Monster'];
      else if (ownCls && defs[ownCls]) names = [ownCls];
      if (!names.length) return sock.sendMessage(chatId, { text: `❌ No class matching *${q}*. Try /class list.` }, { quoted: msg });
      const blocks = names.slice(0, 6).map(n => {
        const d = defs[n];
        const lw = [{ level: 1, ...d.weapon }, ...(d.levelWeapons || [])];
        const cur = viewer && (ownCls === n || (n === 'Monster' && _monsterVariant)) ? (viewer.level || 1) : null;
        return [
          `${(CLASS_DATA[n] || {}).emoji || '🎭'} *${n === 'Monster' && _monsterVariant ? _monsterVariant + ' (Monster)' : n}*`,
          ...lw.map(w => { const owned = cur != null && (w.level <= 1 || CPw.ownsClassWeapon(viewer, n, w.name) || (viewer.weapon && viewer.weapon.name === w.name)); const can = cur != null && cur >= w.level; return `  ${owned ? '✅' : can ? '🛒' : '🔒'} Lv.${w.level}: *${w.name}* (+${w.bonus} ATK)${w.level > 1 ? ` — 💠 ${CPw.classWeaponPrice(w.level).toLocaleString()}` : ' — free'}${!owned && can ? ` · /class weapons buy ${w.level}` : ''}`; }),
        ].join('\n');
      });
      return sock.sendMessage(chatId, { text: [
        ...(pro ? [UI.PRO_BAR, `🗡️ *CLASS WEAPONS* 💎`, UI.PRO_BAR] : [`🗡️ *CLASS WEAPONS*`, UI.FREE_BAR]),
        ``, ...blocks.join('\n\n').split('\n'), ``, FRAME,
        `💡 Class weapons are BOUGHT once you reach their level: */class weapons buy <level>* (Lv10 25k · Lv20 60k · Lv30 150k · Lv40 350k · Lv50 750k). Store weapons (/store, /weapons) replace them when equipped.`,
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
        const sd = describeSkill(matchedClass, s.name) || {};
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
          ...(/^healer$/i.test(String(matchedClass)) ? [``, `🩸 *Healer's Price:* healing ANOTHER hunter costs you HP (12% max HP single · more for party heals). Skill upgrades cut that backlash (Lv5 −80%) instead of adding damage. Healing a hunter under 10% HP stuns you for 1 turn. Self-heals are free.`] : []),
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
    const mentionedJid = require('../../utils/target').resolve(msg, []);
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
    try { require('../../rpg/utils/ClassSystem').ensureMonsterVariant(player); } catch (e) {} // Push #88y: Monsters are always a named variant
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
      const sd = describeSkill(_clsName, s.name) || {};
      let desc = s.description || s.desc || sd.description || 'No description.';
      // Push #96h-k: the Mechanics cost shows what THIS hunter is really charged.
      try { if (SCc) { const _rc = SCc.effectiveCost(s, player); desc = desc.replace(/(\d+) energy(?: \(×2 for non-Healers\))?/, `${_rc} energy`); } } catch (e) {}
      const _eff = s.effect || sd.effect;
      const eff = _eff ? `\n     ✨ ${String(_eff).replace(/\n/g, '\n     ')}` : '';
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

    // Push #88y: Monster guide — variant identity + the full transformation ladder.
    const _mv = player.monsterVariant && typeof player.monsterVariant === 'object' ? player.monsterVariant : null;
    const _isMon = _clsName === 'Monster' || !!_mv;
    const _tfLines = [];
    if (_isMon) {
      try {
        const TF = require('../../rpg/utils/Transformation');
        const vn = TF.variantName(player);
        _tfLines.push(``, FRAME, `🧬 *TRANSFORMATIONS* (${vn} form — ×ALL stats, everywhere):`);
        for (const t of TF.TIERS) {
          const ok = (player.level || 1) >= t.level;
          _tfLines.push(`  ${ok ? '🔓' : '🔒'} Lv.${t.level} *${t.name}: ${vn}* — ×${t.mult} for ${t.turns} turns`);
        }
        _tfLines.push(`  💔 Aftermath when a form ends: Weaken 10t · Stun 2t · Bleed 7t`);
        _tfLines.push((player.level || 1) < TF.BERSERK_LEVEL
          ? `  😈 Innate: ${Math.round(TF.BERSERK_CHANCE * 100)}%/turn BERSERK Quarter surge — the beast fights for you until Lv.${TF.BERSERK_LEVEL}`
          : `  🧬 Innate: ${Math.round(TF.PASSIVE_CHANCE * 100)}%/turn random Quarter surge (×5, 3 turns)`);
        _tfLines.push(`  📌 Cast: */${playerCmd} ${TF.TIERS[0].name}*`);
      } catch (e) {}
    }

    return sock.sendMessage(chatId, {
      text: [
        ...(pro ? [UI.PRO_BAR, `${(_mv && _mv.emoji) || data.emoji || '🎭'} *${player.name}'s CLASS GUIDE* 💎`, UI.PRO_BAR] : [`${(_mv && _mv.emoji) || data.emoji || '🎭'} *${player.name}'s CLASS GUIDE*`, UI.FREE_BAR]),
        ``,
        _isMon
          ? `${(_mv && _mv.emoji) || '👹'} Variant: *${_mv ? _mv.name : (typeof player.class === 'object' ? player.class?.name : player.class)}* _(Monster)_`
          : `🎭 Class: *${typeof player.class === 'object' ? (player.class?.name || 'Unknown') : player.class}*`,
        `📜 Description: _${(_mv && _mv.lore) || data.lore || data.description || 'A unique awakener class.'}_`,
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
        ..._tfLines,
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
