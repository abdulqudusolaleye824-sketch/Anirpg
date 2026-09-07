'use strict';
const PlayerMigration = require('../../rpg/utils/PlayerMigration');
const { getEquippedBonuses } = require('../../rpg/utils/GearSystem');
const { applyAllocationsToStats } = require('../../rpg/utils/StatAllocationSystem');
const { AWAKENING_RANKS, calculatePowerRating, getPowerLabel } = require('../../rpg/utils/SoloLevelingCore');
const { getQualityLabel } = require('../../rpg/utils/ClassSystem');

module.exports = {
  name: 'stats',
  description: 'View your battle stats',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    let player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You are not registered! Use /register to start.' }, { quoted: msg });
    }

    // ── COMPARE MODE: /stats @user ────────────────────────────
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (mentioned && mentioned !== sender) {
      const other = db.users[mentioned];
      if (!other) return sock.sendMessage(chatId, { text: '❌ That player is not registered!' }, { quoted: msg });

      const getStats = (p) => {
        const g = getEquippedBonuses(p);
        const w = p.weapon?.bonus || 0;
        return {
          atk:  (p.stats.atk||0) + (g.atk||0) + w,
          def:  (p.stats.def||0) + (g.def||0),
          hp:   (p.stats.maxHp||100) + (g.hp||0),
          spd:  (p.stats.speed||0) + (g.speed||0),
          crit: (p.stats.critChance||0) + (g.crit||0),
        };
      };
      const ps = getStats(player);
      const os = getStats(other);
      const cmp = (a, b) => a > b ? '🟢' : a < b ? '🔴' : '🟡';
      const pClass = player.class?.name || player.class || '?';
      const oClass = other.class?.name || other.class || '?';
      const pRank  = AWAKENING_RANKS[player.awakenRank] || AWAKENING_RANKS['E'];
      const oRank  = AWAKENING_RANKS[other.awakenRank] || AWAKENING_RANKS['E'];
      const pElo   = player.pvpElo || 1000;
      const oElo   = other.pvpElo || 1000;
      const pPow   = calculatePowerRating(player.stats, [], null);
      const oPow   = calculatePowerRating(other.stats, [], null);

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `⚔️ *STAT COMPARISON*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `${pRank.emoji} *${player.name}*  vs  ${oRank.emoji} *${other.name}*`,
          `📖 ${pClass} Lv.${player.level}  ↔  ${oClass} Lv.${other.level}`,
          `⭐ ELO: ${pElo}  ↔  ${oElo}`,
          ``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `❤️  HP:    ${cmp(ps.hp,os.hp)} *${ps.hp}*  ↔  *${os.hp}* ${cmp(os.hp,ps.hp)}`,
          `⚔️  ATK:   ${cmp(ps.atk,os.atk)} *${ps.atk}*  ↔  *${os.atk}* ${cmp(os.atk,ps.atk)}`,
          `🛡️  DEF:   ${cmp(ps.def,os.def)} *${ps.def}*  ↔  *${os.def}* ${cmp(os.def,ps.def)}`,
          `💨 SPD:   ${cmp(ps.spd,os.spd)} *${ps.spd}*  ↔  *${os.spd}* ${cmp(os.spd,ps.spd)}`,
          `💥 CRIT:  ${cmp(ps.crit,os.crit)} *${ps.crit}%*  ↔  *${os.crit}%* ${cmp(os.crit,ps.crit)}`,
          `💪 PWR:   ${cmp(pPow,oPow)} *${pPow}*  ↔  *${oPow}* ${cmp(oPow,pPow)}`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🟢 = Higher  🔴 = Lower  🟡 = Equal`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
        mentions: [sender, mentioned],
      }, { quoted: msg });
    }

    player = PlayerMigration.migratePlayer(player);
    db.users[sender] = player;
    saveDatabase();

    try { applyAllocationsToStats(player); } catch(e) {}

    // ── Gear bonuses ──────────────────────────────────────────
    const gear       = getEquippedBonuses(player);
    const weaponBonus = player.weapon?.bonus || 0;

    // ── Title + Constellation bonuses ────────────────────────
    let titleBonus = { atk:0, def:0, speed:0, maxHp:0 };
    try { titleBonus = require('../../rpg/utils/TitleSystem').getEquippedBoost(player) || {}; } catch(e) {}
    let consBonus  = { atk:0, def:0, speed:0, maxHp:0 };
    try { consBonus = require('../../rpg/utils/ConstellationSystem').getSponsorBonus(player) || {}; } catch(e) {}

    const totalAtk  = (player.stats.atk   || 0) + (gear.atk  || 0) + weaponBonus + (titleBonus.atk||0) + (consBonus.atk||0);
    const totalDef  = (player.stats.def   || 0) + (gear.def  || 0) + (titleBonus.def||0) + (consBonus.def||0);
    const totalHp   = (player.stats.maxHp || 100) + (gear.hp || 0) + (titleBonus.maxHp||0) + (consBonus.maxHp||0);
    const totalSpd  = (player.stats.speed || 0) + (gear.speed || 0) + (titleBonus.speed||0) + (consBonus.speed||0);
    const totalCrit = (player.stats.critChance || 0) + (gear.crit || 0);

    const breakdown = (base, bonus) => bonus > 0 ? ` _(${base} + ${bonus})_` : '';

    // ── XP progress ───────────────────────────────────────────
    const nextLevelXp  = Math.floor(200 * Math.pow(player.level, 1.8));
    const xpProgress   = Math.min(100, Math.floor(((player.xp || 0) / nextLevelXp) * 100));
    const xpBarFilled  = Math.floor(xpProgress / 10);
    const xpBar        = '█'.repeat(xpBarFilled) + '░'.repeat(10 - xpBarFilled);

    // ── Awakening rank ────────────────────────────────────────
    const rankKey   = player.awakenRank || 'E';
    const rankData  = AWAKENING_RANKS[rankKey] || AWAKENING_RANKS['E'];
    const rankEmoji = rankData.emoji;
    const rankLabel = rankData.label;

    // ── Class + quality ───────────────────────────────────────
    const className   = player.class?.name || player.class || null;
    const quality     = player.classQuality || 0;
    const qualLabel   = className ? getQualityLabel(quality) : null;

    // ── Power rating ──────────────────────────────────────────
    const powerRating = calculatePowerRating({ atk: totalAtk, def: totalDef, maxHp: totalHp, speed: totalSpd, critChance: totalCrit, magicPower: player.stats.magicPower||0 }, [], null);
    const powerLabel  = getPowerLabel(powerRating);

    // ══ Build message ═════════════════════════════════════════
    let msg2 = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚔️ *BATTLE STATS*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 *${player.name}*`,
      `${rankEmoji} Awakening: *${rankLabel}*`,
      `⭐ Level: *${player.level}*`,
      ``,
      `📊 [${xpBar}] ${xpProgress}%`,
    ].join('\n');

    if (className) {
      const { CLASS_DATA } = require('../../rpg/utils/ClassSystem');
      const cData = CLASS_DATA[className];
      msg2 += `\n${cData?.emoji || '🎭'} Class: *${className}* ${qualLabel || ''}`;
      if (quality > 0) msg2 += `\n   Quality: *${quality}%*`;
    } else {
      msg2 += `\n🎭 Class: _Awaiting awakening..._`;
    }

    msg2 += `\n${powerLabel.emoji} Power: *${powerRating.toLocaleString()}* (${powerLabel.label})`;

    msg2 += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💪 *COMBAT STATS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    msg2 += `\n❤️  HP:    *${player.stats.hp}/${totalHp}*${breakdown(player.stats.maxHp, (gear.hp||0)+(titleBonus.maxHp||0)+(consBonus.maxHp||0))}`;
    msg2 += `\n⚔️  ATK:   *${totalAtk}*${breakdown(player.stats.atk, (gear.atk||0)+weaponBonus+(titleBonus.atk||0)+(consBonus.atk||0))}`;
    msg2 += `\n🛡️  DEF:   *${totalDef}*${breakdown(player.stats.def, (gear.def||0)+(titleBonus.def||0)+(consBonus.def||0))}`;
    msg2 += `\n${player.energyColor || '💙'} ${player.energyType || 'Energy'}: *${player.stats.energy || 0}/${player.stats.maxEnergy || 100}*`;
    if (totalSpd > 0)  msg2 += `\n💨 SPD:   *${totalSpd}*${breakdown(player.stats.speed, (gear.speed||0)+(titleBonus.speed||0)+(consBonus.speed||0))}`;
    if (totalCrit > 0) msg2 += `\n💥 CRIT:  *${totalCrit}%*${breakdown(player.stats.critChance||0, gear.crit||0)}`;
    if ((player.stats.critDamage||0) > 0) msg2 += `\n🔥 CRIT DMG: *${player.stats.critDamage}%*`;
    if ((player.stats.lifesteal||0) > 0)  msg2 += `\n💚 LIFESTEAL: *${player.stats.lifesteal}%*`;
    if ((player.stats.magicPower||0) > 0) msg2 += `\n✨ MAGIC PWR: *${player.stats.magicPower}*`;

    // ── Attack Patterns ───────────────────────────────────────
    const ownedPatterns = player.attackPatterns?.owned || [];
    const equippedPat   = player.attackPatterns?.equipped || [];
    if (ownedPatterns.length > 0) {
      msg2 += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🥋 *ATTACK PATTERNS*`;
      msg2 += `\n📦 Owned: *${ownedPatterns.length}* | 🎯 Equipped: *${equippedPat.length}*`;
      if (equippedPat.length > 0) {
        const { generateAttack, RANK_EMOJI } = require('../../rpg/utils/AttackPatternDB');
        equippedPat.slice(0, 3).forEach(id => {
          const atk = generateAttack(id);
          if (atk) {
            const re = RANK_EMOJI[atk.rank] || '⬜';
            msg2 += `\n  ${re} *#${atk.id}* ${atk.name} [${atk.rank}] ×${atk.dmgMult}`;
            if (atk.effect) msg2 += ` ${atk.effect.emoji}`;
          }
        });
      }
      msg2 += `\n💡 /attacks — manage patterns`;
    }

    // ── Equipment ─────────────────────────────────────────────
    msg2 += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🗡️ *EQUIPMENT*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    if (player.weapon?.name) {
      msg2 += `\n🗡️ ${player.weapon.name} (+${weaponBonus} ATK)`;
      if (player.weapon.passive) msg2 += `\n   ⚡ *${player.weapon.passive.name}* — ${player.weapon.passive.desc}`;
    } else {
      msg2 += `\n🗡️ _No weapon_`;
    }
    if (player.equippedGear && Object.keys(player.equippedGear).length > 0) {
      for (const [slot, piece] of Object.entries(player.equippedGear)) {
        if (!piece) continue;
        const statStr = Object.entries(piece.stats || {})
          .filter(([k]) => k !== 'special')
          .map(([k, v]) => `+${v} ${k.toUpperCase()}`)
          .join(', ');
        const rarity = piece.rarity || 'common';
        const rarEmoji = { mythic:'🌌', legendary:'🟠', epic:'🟣', rare:'🔵', uncommon:'🟢', common:'⚪' }[rarity] || '📦';
        msg2 += `\n${rarEmoji} [${slot}] ${piece.name}${statStr ? ` — ${statStr}` : ''}`;
      }
    }

    // ── Class Skills ──────────────────────────────────────────
    const classSkills = player.classSkills || [];
    if (classSkills.length > 0) {
      msg2 += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎭 *CLASS SKILLS* (${className})`;
      classSkills.forEach((s, i) => {
        msg2 += `\n  ${i+1}. *${s.name}* — ${s.desc}`;
      });
    }

    // ── Active skills ─────────────────────────────────────────
    const activeSkills = player.skills?.active || [];
    if (activeSkills.length > 0) {
      msg2 += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✨ *SKILLS* (${activeSkills.length})`;
      activeSkills.forEach(skill => {
        const cost = skill.energyCost || skill.manaCost || 10;
        msg2 += `\n🔮 *${skill.name}* [Lv.${skill.level}/${skill.maxLevel||10}]`;
        msg2 += `\n   💥 ${skill.damage} dmg | ${player.energyColor || '💙'} ${cost} | ⏰ ${skill.cooldown||10}s`;
      });
    }

    // ── Passives ──────────────────────────────────────────────
    const passives = player.skills?.passive || [];
    if (passives.length > 0) {
      msg2 += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌟 *PASSIVE ABILITIES*`;
      passives.forEach(p => { msg2 += `\n⚡ ${p.name}: ${p.effect}`; });
    }

    // ── PvP record ────────────────────────────────────────────
    const elo = player.pvpElo || 1000;
    const PVP_TIERS = [
      {name:'Bronze',min:0,emoji:'🟫'},{name:'Silver',min:1100,emoji:'⬜'},
      {name:'Nexus',min:1300,emoji:'🟨'},{name:'Platinum',min:1500,emoji:'🩵'},
      {name:'Diamond',min:1700,emoji:'💎'},{name:'Master',min:1900,emoji:'🔴'},
      {name:'Grandmaster',min:2100,emoji:'🌟'},
    ];
    const tier = PVP_TIERS.slice().reverse().find(t => elo >= t.min) || PVP_TIERS[0];
    msg2 += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ *PVP RECORD*`;
    msg2 += `\n${tier.emoji} *${tier.name}* — ${elo} ELO`;
    msg2 += `\n📊 ${player.pvpWins||0}W / ${player.pvpLosses||0}L`;
    if ((player.pvpStreak||0) > 2) msg2 += ` | 🔥 ${player.pvpStreak} streak`;

    // ── Title ─────────────────────────────────────────────────
    try {
      const TS = require('../../rpg/utils/TitleSystem');
      TS.checkAndAwardTitles(player);
      const owned    = player.titles || [];
      const equipped = player.equippedTitle;
      if (owned.length) {
        msg2 += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎖️ *TITLES* (${owned.length})`;
        if (equipped && TS.TITLES[equipped]) {
          const td = TS.TITLES[equipped];
          msg2 += `\n✅ *${td.display}* ← EQUIPPED\n   ⚡ ${td.boostDesc}`;
        }
        const others = owned.filter(t => t !== equipped).slice(0, 3);
        if (others.length) msg2 += '\n' + others.map(t => `🎖️ ${TS.TITLES[t]?.display||t}`).join('\n');
        if (owned.length > 4) msg2 += `\n...and ${owned.length-4} more — /title to view all`;
      }
    } catch(e) {}

    // ── Battle Pass ───────────────────────────────────────────
    try {
      const BP = require('../../rpg/utils/BattlePass');
      const bp  = BP.getPassState(player);
      const pct = Math.min(100, Math.floor((bp.xp / BP.XP_PER_LEVEL) * 100));
      const bar = '█'.repeat(Math.floor(pct/10)) + '░'.repeat(10 - Math.floor(pct/10));
      msg2 += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎖️ *BATTLE PASS*`;
      msg2 += `\n${bp.premium?'💎 Premium':'🆓 Free'} | Level *${bp.level}/${BP.PASS_LEVELS}*`;
      msg2 += `\n[${bar}] ${bp.xp}/${BP.XP_PER_LEVEL}`;
    } catch(e) {}

    msg2 += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 /profile — social card\n💡 /attacks — attack patterns\n💡 /gear — manage equipment\n💡 /skills — manage skills\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return sock.sendMessage(chatId, { text: msg2 }, { quoted: msg });
  }
};
