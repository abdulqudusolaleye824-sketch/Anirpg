// ═══════════════════════════════════════════════════════════════
// /pvp — Turn-by-Turn Unautomated PvP Battle System
//
// Commands:
//   /pvp challenge @user (or reply) — Issue challenge with chunky guide
//   /pvp accept                      — Accept pending challenge
//   /pvp reject / /pvp decline       — Reject pending challenge
//   /pvp attack [pattern_id]         — Choose attack / attack pattern
//   /pvp skill [name]                — Choose class skill
//   /pvp status                      — View current battle HP / state
//   /pvp surrender                   — Surrender match
//   /pvp rank                        — View ELO rank and record
// ═══════════════════════════════════════════════════════════════

'use strict';

const DB = require('../../rpg/utils/AttackPatternDB');
const { getClassCmdName } = require('../../rpg/utils/classcmd');

function bare(jid) {
  return String(jid || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
}

function getTargetJid(msg) {
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  if (mentioned) return mentioned;
  const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (quotedParticipant) return quotedParticipant;
  return null;
}

const PVP_RANKS = [
  { name: 'Unranked',    emoji: '⚪', minElo: 0    },
  { name: 'Bronze',      emoji: '🥉', minElo: 800  },
  { name: 'Silver',      emoji: '🥈', minElo: 1000 },
  { name: 'Gold',        emoji: '🥇', minElo: 1200 },
  { name: 'Platinum',    emoji: '💠', minElo: 1400 },
  { name: 'Diamond',     emoji: '💎', minElo: 1600 },
  { name: 'Master',      emoji: '🏆', minElo: 1800 },
  { name: 'Grandmaster', emoji: '👑', minElo: 2000 },
  { name: 'Legend',      emoji: '🌟', minElo: 2200 },
];

function getPvpRank(elo) {
  const e = elo || 1000;
  let r = PVP_RANKS[0];
  for (const rank of PVP_RANKS) if (e >= rank.minElo) r = rank;
  return r;
}

module.exports = {
  name: 'pvp',
  aliases: ['duel', 'fight'],
  description: '⚔️ Challenge players to turn-by-turn unautomated PvP combat',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You need to register first!' }, { quoted: msg });
    }

    const sub = (args[0] || 'help').toLowerCase();

    if (!db.pendingChallenges) db.pendingChallenges = {};

    // ── /pvp challenge @user or reply ────────────────────────────
    if (sub === 'challenge' || sub === 'duel') {
      const targetJid = getTargetJid(msg);
      if (!targetJid) {
        return sock.sendMessage(chatId, { text: '❌ Tag a user or reply to their message to challenge them!\nUsage: /pvp challenge @user' }, { quoted: msg });
      }

      if (bare(targetJid) === bare(sender)) {
        return sock.sendMessage(chatId, { text: '❌ You cannot challenge yourself!' }, { quoted: msg });
      }

      const opp = db.users?.[targetJid];
      if (!opp) {
        return sock.sendMessage(chatId, { text: '❌ That player is not registered!' }, { quoted: msg });
      }

      if (player.pvpBattle) {
        return sock.sendMessage(chatId, { text: '❌ You are already in an active PvP battle!' }, { quoted: msg });
      }

      if (opp.pvpBattle) {
        return sock.sendMessage(chatId, { text: '❌ That player is already in a battle!' }, { quoted: msg });
      }

      db.pendingChallenges[targetJid] = { challengerId: sender, chatId, timestamp: Date.now() };
      saveDatabase();

      const challengerRank = getPvpRank(player.pvpElo);
      const targetRank = getPvpRank(opp.pvpElo);

      const guideText = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `⚔️ *PVP CHALLENGE ISSUED!*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👤 *Challenger:* ${challengerRank.emoji} ${player.name} [${player.class || 'No Class'} Lv.${player.level || 1}]`,
        `🎯 *Target:* ${targetRank.emoji} @${targetJid.split('@')[0]}`,
        ``,
        `📖 *HOW PVP COMBAT WORKS:*`,
        `• *Turn-by-Turn Resolution:* Both players pick a move each turn.`,
        `• *Speed Priority:* The faster player's move executes first.`,
        `• *Sequential Breakdown:* Damage and move explanations are delivered in sequential messages.`,
        `• *Commands:*`,
        `  - */attack* or */attack <pattern_id>* (e.g. /attack 734)`,
        `  - */skill* or class skill trigger command (e.g. /heal, /call, /rage)`,
        `• Combat continues turn by turn until a player's HP reaches 0!`,
        ``,
        `⏰ *60 seconds to respond!*`,
        `✅ */pvp accept* — Accept challenge`,
        `❌ */pvp reject* — Decline challenge`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n');

      return sock.sendMessage(chatId, { text: guideText, mentions: [targetJid] }, { quoted: msg });
    }

    // ── /pvp accept ──────────────────────────────────────────────
    if (sub === 'accept') {
      const challenge = db.pendingChallenges[sender];
      if (!challenge) {
        return sock.sendMessage(chatId, { text: '❌ You have no pending PvP challenges.' }, { quoted: msg });
      }

      const challenger = db.users?.[challenge.challengerId];
      delete db.pendingChallenges[sender];

      if (!challenger) {
        saveDatabase();
        return sock.sendMessage(chatId, { text: '❌ Challenger is no longer available.' }, { quoted: msg });
      }

      if (challenger.pvpBattle || player.pvpBattle) {
        saveDatabase();
        return sock.sendMessage(chatId, { text: '❌ One of the players is already in a battle!' }, { quoted: msg });
      }

      // Initialize battle state
      challenger.pvpBattle = { opponentId: sender, turn: 1, pendingAction: null };
      player.pvpBattle = { opponentId: challenge.challengerId, turn: 1, pendingAction: null };

      saveDatabase();

      const p1Spd = (challenger.stats?.speed || 10) + (challenger.equipped?.weapon?.speed || 0);
      const p2Spd = (player.stats?.speed || 10) + (player.equipped?.weapon?.speed || 0);

      const stats1 = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `⚔️ *FIGHTER 1 BATTLE STATS*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👤 Name: *${challenger.name}*`,
        `🎭 Class: *${challenger.class || 'None'}* (Lv.${challenger.level || 1})`,
        `⭐ ELO: ${challenger.pvpElo || 1000}`,
        `❤️ HP: ${challenger.stats.hp}/${challenger.stats.maxHp}`,
        `⚔️ ATK: ${challenger.stats.atk || 10} | 🛡️ DEF: ${challenger.stats.def || 5}`,
        `⚡ Speed: ${p1Spd}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n');

      const stats2 = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `⚔️ *FIGHTER 2 BATTLE STATS*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👤 Name: *${player.name}*`,
        `🎭 Class: *${player.class || 'None'}* (Lv.${player.level || 1})`,
        `⭐ ELO: ${player.pvpElo || 1000}`,
        `❤️ HP: ${player.stats.hp}/${player.stats.maxHp}`,
        `⚔️ ATK: ${player.stats.atk || 10} | 🛡️ DEF: ${player.stats.def || 5}`,
        `⚡ Speed: ${p2Spd}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n');

      const startPrompt = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🎮 *PVP BATTLE STARTED — TURN 1*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `@${challenge.challengerId.split('@')[0]} & @${sender.split('@')[0]} — select your move!`,
        ``,
        `📌 *YOUR MOVES:*`,
        `• /attack or /attack <pattern_id>`,
        `• /skill or /<classcmd> (e.g. /heal, /call, /rage)`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n');

      return sock.sendMessage(chatId, {
        sections: [
          { text: stats1, mentions: [challenge.challengerId] },
          { text: stats2, mentions: [sender] },
          { text: startPrompt, mentions: [challenge.challengerId, sender] },
        ]
      });
    }

    // ── /pvp reject / /pvp decline ───────────────────────────────
    if (sub === 'reject' || sub === 'decline') {
      const challenge = db.pendingChallenges[sender];
      if (!challenge) {
        return sock.sendMessage(chatId, { text: '❌ No pending challenge to decline.' }, { quoted: msg });
      }

      delete db.pendingChallenges[sender];
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `❌ *${player.name}* declined the PvP challenge.`
      }, { quoted: msg });
    }

    // ── /pvp status ──────────────────────────────────────────────
    if (sub === 'status') {
      if (!player.pvpBattle) {
        return sock.sendMessage(chatId, { text: '❌ You are not in an active PvP battle.' }, { quoted: msg });
      }

      const opp = db.users?.[player.pvpBattle.opponentId];
      const turn = player.pvpBattle.turn || 1;
      const locked = player.pvpBattle.pendingAction ? '✅ Move locked in' : '⏳ Awaiting move';

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `⚔️ *PVP BATTLE STATUS — TURN ${turn}*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📌 Your Move: *${locked}*`,
          ``,
          `👤 *${player.name}*: ${player.stats.hp}/${player.stats.maxHp} ❤️`,
          `👤 *${opp?.name || 'Opponent'}*: ${opp?.stats?.hp || 0}/${opp?.stats?.maxHp || 100} ❤️`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── /pvp surrender ───────────────────────────────────────────
    if (sub === 'surrender' || sub === 'forfeit') {
      if (!player.pvpBattle) {
        return sock.sendMessage(chatId, { text: '❌ You are not in an active PvP battle.' }, { quoted: msg });
      }

      const oppId = player.pvpBattle.opponentId;
      const opp = db.users?.[oppId];

      player.pvpBattle = null;
      if (opp) opp.pvpBattle = null;

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `🏳️ *${player.name}* surrendered! *${opp?.name || 'Opponent'}* wins the match!`
      }, { quoted: msg });
    }

    // ── /pvp rank ────────────────────────────────────────────────
    if (sub === 'rank') {
      const elo = player.pvpElo || 1000;
      const rank = getPvpRank(elo);
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `${rank.emoji} *PVP RANK & STATS*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `👤 Hunter: *${player.name}*`,
          `⭐ ELO Rating: *${elo}* (${rank.name})`,
          `📊 Record: ✅ ${player.pvpWins || 0} Wins | ❌ ${player.pvpLosses || 0} Losses`,
          `🔥 Win Streak: ${player.pvpStreak || 0}`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── IN-BATTLE ACTION SUBMISSION ──────────────────────────────
    if (sub === 'attack' || sub === 'skill') {
      if (!player.pvpBattle) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a PvP battle! Challenge someone with /pvp challenge @user' }, { quoted: msg });
      }

      const battle = player.pvpBattle;
      if (battle.pendingAction) {
        return sock.sendMessage(chatId, { text: '⚠️ You have already locked in your move for this turn! Waiting for your opponent...' }, { quoted: msg });
      }

      const oppId = battle.opponentId;
      const opp = db.users?.[oppId];

      if (!opp || !opp.pvpBattle) {
        player.pvpBattle = null;
        saveDatabase();
        return sock.sendMessage(chatId, { text: '❌ Opponent is no longer in battle. Battle ended.' }, { quoted: msg });
      }

      // Lock in player's action
      battle.pendingAction = {
        type: sub,
        arg: args[1] || null,
        skillName: sub === 'skill' ? args.slice(1).join(' ') : null,
        patternId: sub === 'attack' ? args[1] : null,
      };

      saveDatabase();

      // Check if opponent has also locked in move
      if (opp.pvpBattle.pendingAction) {
        return resolveTurn(sock, chatId, player, opp, db, saveDatabase);
      } else {
        return sock.sendMessage(chatId, {
          text: `✅ *Move locked in!* Waiting for *@${oppId.split('@')[0]}* to choose their move...`,
          mentions: [oppId],
        }, { quoted: msg });
      }
    }

    // ── Default Help ─────────────────────────────────────────────
    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `⚔️ *PVP BATTLE SYSTEM*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Turn-by-Turn Unautomated Duels`,
        ``,
        `📌 *COMMANDS:*`,
        `/pvp challenge @user   — Issue challenge (or reply)`,
        `/pvp accept            — Accept challenge`,
        `/pvp reject            — Reject challenge`,
        `/attack [pattern_id]   — Attack in battle`,
        `/skill [name]          — Use skill in battle`,
        `/pvp status            — Battle HP & turn status`,
        `/pvp surrender         — Forfeit match`,
        `/pvp rank              — View ELO rating`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    }, { quoted: msg });
  }
};

// ── Turn Resolution Engine ────────────────────────────────────────
async function resolveTurn(sock, chatId, p1, p2, db, saveDatabase) {
  const p1Id = p1.id || p1.jid || p1.userId;
  const p2Id = p2.id || p2.jid || p2.userId;

  const p1Spd = (p1.stats?.speed || 10) + (p1.equipped?.weapon?.speed || 0);
  const p2Spd = (p2.stats?.speed || 10) + (p2.equipped?.weapon?.speed || 0);

  const p1First = p1Spd > p2Spd || (p1Spd === p2Spd && Math.random() < 0.5);

  const faster = p1First ? p1 : p2;
  const slower = p1First ? p2 : p1;
  const fasterId = p1First ? p1Id : p2Id;
  const slowerId = p1First ? p2Id : p1Id;

  const fasterAct = p1First ? p1.pvpBattle.pendingAction : p2.pvpBattle.pendingAction;
  const slowerAct = p1First ? p2.pvpBattle.pendingAction : p1.pvpBattle.pendingAction;

  const turnNum = p1.pvpBattle.turn || 1;

  // 1. Faster player's move
  const fasterRes = calcMoveDamage(faster, slower, fasterAct);
  slower.stats.hp = Math.max(0, (slower.stats.hp || 0) - fasterRes.damage);

  const msg1 = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⚔️ *TURN ${turnNum}: FASTER PLAYER STRIKES FIRST!*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⚡ *${faster.name}* (Speed ${p1First ? p1Spd : p2Spd}) acts first!`,
    `📜 *Action:* ${fasterRes.moveLabel}`,
    `${fasterRes.isCrit ? '💥 *CRITICAL HIT!* ' : ''}Dealt *${fasterRes.damage.toLocaleString()}* damage to *${slower.name}*!`,
    ``,
    `❤️ *${slower.name}* HP: ${slower.stats.hp.toLocaleString()}/${slower.stats.maxHp.toLocaleString()}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');

  // Check if slower player was defeated
  if (slower.stats.hp <= 0) {
    const PetManager = require('../../rpg/utils/PetManager');
    const sac = PetManager.checkPetSacrifice(slowerId, slower);
    if (sac && sac.sacrificed) {
      msg1 += `\n\n${sac.message}`;
    } else {
      return handlePvpVictory(sock, chatId, faster, slower, fasterId, slowerId, db, saveDatabase, turnNum, msg1);
    }
  }

  // 2. Slower player's move (since slower is still alive)
  const slowerRes = calcMoveDamage(slower, faster, slowerAct);
  faster.stats.hp = Math.max(0, (faster.stats.hp || 0) - slowerRes.damage);

  const msg2 = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⚔️ *SECOND PLAYER COUNTERS!*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🛡️ *${slower.name}* counters!`,
    `📜 *Action:* ${slowerRes.moveLabel}`,
    `${slowerRes.isCrit ? '💥 *CRITICAL HIT!* ' : ''}Dealt *${slowerRes.damage.toLocaleString()}* damage to *${faster.name}*!`,
    ``,
    `❤️ *${faster.name}* HP: ${faster.stats.hp.toLocaleString()}/${faster.stats.maxHp.toLocaleString()}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');

  // Check if faster player was defeated
  if (faster.stats.hp <= 0) {
    const PetManager = require('../../rpg/utils/PetManager');
    const sac = PetManager.checkPetSacrifice(fasterId, faster);
    if (sac && sac.sacrificed) {
      msg2 += `\n\n${sac.message}`;
    } else {
      return handlePvpVictory(sock, chatId, slower, faster, slowerId, fasterId, db, saveDatabase, turnNum, msg1 + '\n\n' + msg2);
    }
  }

  // 3. Advance to next turn
  p1.pvpBattle.turn = turnNum + 1;
  p2.pvpBattle.turn = turnNum + 1;
  p1.pvpBattle.pendingAction = null;
  p2.pvpBattle.pendingAction = null;

  saveDatabase();

  const msg3 = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🎮 *ADVANCING TO TURN ${turnNum + 1}*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 *${p1.name}*: ${p1.stats.hp.toLocaleString()}/${p1.stats.maxHp.toLocaleString()} ❤️`,
    `👤 *${p2.name}*: ${p2.stats.hp.toLocaleString()}/${p2.stats.maxHp.toLocaleString()} ❤️`,
    ``,
    `📌 Both players, select your next move:`,
    `• /attack or /attack <pattern_id>`,
    `• /skill or /<classcmd>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');

  return sock.sendMessage(chatId, {
    sections: [
      { text: msg1, mentions: [fasterId, slowerId] },
      { text: msg2, mentions: [fasterId, slowerId] },
      { text: msg3, mentions: [p1Id, p2Id] },
    ]
  });
}

function calcMoveDamage(attacker, defender, act) {
  const atk = (attacker.stats?.atk || 10) + (attacker.equipped?.weapon?.atk || attacker.equipped?.weapon?.bonus || 0);
  const def = (defender.stats?.def || 5) + (defender.equipped?.armor?.def || 0);

  let dmgMult = 1.0;
  let moveLabel = 'Basic Attack';

  const patternId = parseInt(act.patternId || act.arg);
  if (!isNaN(patternId) && patternId >= 1 && patternId <= 750) {
    const pattern = DB.generateAttack(patternId);
    if (pattern) {
      dmgMult = pattern.dmgMult || 1.2;
      moveLabel = `Attack Pattern #${pattern.id} (${pattern.name})`;
    }
  }

  if (act.type === 'skill') {
    const skillName = act.skillName;
    const skill = (attacker.classSkills || []).find(s => s.name?.toLowerCase() === skillName?.toLowerCase())
               || (attacker.skills?.active || []).find(s => s.name?.toLowerCase() === skillName?.toLowerCase());
    if (skill) {
      dmgMult = (skill.potency ? skill.potency / 100 + 1 : 1.5);
      moveLabel = `Class Skill: ${skill.name}`;
    } else {
      dmgMult = 1.4;
      moveLabel = `Class Skill: ${skillName || 'Ability'}`;
    }
  }

  let rawDmg = Math.floor(atk * dmgMult * (0.9 + Math.random() * 0.20));

  // ── CLASS INTERDEPENDENCY SYNERGIES ─────────────────────────
  const attClass = String(attacker.class || '').toLowerCase();
  const defClass = String(defender.class || '').toLowerCase();
  const activeStatus = defender.statusEffects || [];

  // Berserker vs Fear / DragonKnight target -> 3.0x Damage
  if ((attClass.includes('berserker') || attClass.includes('warrior')) && (activeStatus.includes('fear') || defClass.includes('dragon'))) {
    rawDmg = Math.floor(rawDmg * 3.0);
    moveLabel += ' (😱 FEAR SYNERGY ×3.0!)';
  }
  // SpellBlade vs Frozen / Burning target -> 2.5x Damage
  else if ((attClass.includes('spellblade') || attClass.includes('chronomancer')) && (activeStatus.includes('freeze') || activeStatus.includes('burn') || defClass.includes('elemental') || defClass.includes('mage'))) {
    rawDmg = Math.floor(rawDmg * 2.5);
    moveLabel += ' (❄️ ELEMENTAL SYNERGY ×2.5!)';
  }
  // BloodKnight / Devourer vs Bleeding target -> 2.0x Damage + Lifesteal
  else if ((attClass.includes('blood') || attClass.includes('devourer')) && (activeStatus.includes('bleed') || activeStatus.includes('curse') || defClass.includes('necro') || defClass.includes('rogue'))) {
    rawDmg = Math.floor(rawDmg * 2.0);
    const heal = Math.floor(rawDmg * 0.5);
    attacker.stats.hp = Math.min(attacker.stats.maxHp, (attacker.stats.hp || 0) + heal);
    moveLabel += ` (🩸 BLOOD SYNERGY ×2.0 +${heal} HP!)`;
  }
  // Monk / Ranger vs Cursed / Marked target -> Ignores DEF
  else if ((attClass.includes('monk') || attClass.includes('ranger')) && (activeStatus.includes('curse') || activeStatus.includes('mark'))) {
    rawDmg = Math.floor(atk * dmgMult * 2.0); // True damage
    moveLabel += ' (🎯 TRUE DAMAGE SYNERGY!)';
  }

  const critChance = (attacker.stats?.critChance || 5) / 100;
  const isCrit = Math.random() < critChance;
  if (isCrit) {
    const critMult = (attacker.stats?.critDamage || 150) / 100;
    rawDmg = Math.floor(rawDmg * critMult);
  }

  const netDmg = Math.max(5, rawDmg - Math.floor(def * 0.35));

  return { damage: netDmg, isCrit, moveLabel };
}

function handlePvpVictory(sock, chatId, winner, loser, wId, lId, db, saveDatabase, turns, lastTurnText) {
  const wElo = winner.pvpElo || 1000;
  const lElo = loser.pvpElo || 1000;
  const change = Math.round(32 * (1 - 1 / (1 + Math.pow(10, (lElo - wElo) / 400))));
  const loss = Math.round(change * 0.8);

  winner.pvpElo = wElo + change;
  loser.pvpElo = Math.max(100, lElo - loss);

  winner.pvpWins = (winner.pvpWins || 0) + 1;
  loser.pvpLosses = (loser.pvpLosses || 0) + 1;
  winner.pvpStreak = (winner.pvpStreak || 0) + 1;
  loser.pvpStreak = 0;

  const rewardNexus = 1000 + Math.floor((loser.level || 1) * 50);
  const rewardXP = 500 + Math.floor((loser.level || 1) * 30);

  winner.gold = (winner.gold || 0) + rewardNexus;
  winner.xp = (winner.xp || 0) + rewardXP;

  // Reset battle state
  winner.pvpBattle = null;
  loser.pvpBattle = null;

  saveDatabase();

  const victoryMsg = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏆 *PVP BATTLE OVER — VICTORY!*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👑 *${winner.name}* HAS DEFEATED *${loser.name}*!`,
    `⏱️ Total Turns: ${turns}`,
    ``,
    `📊 *ELO CHANGES:*`,
    `🥇 ${winner.name}: ${wElo} → *${winner.pvpElo}* (+${change})`,
    `🥈 ${loser.name}: ${lElo} → *${loser.pvpElo}* (−${loss})`,
    ``,
    `🎁 *REWARDS:*`,
    `💠 Nexus: +${rewardNexus.toLocaleString()}`,
    `✨ XP: +${rewardXP.toLocaleString()}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');

  return sock.sendMessage(chatId, {
    sections: [
      { text: lastTurnText, mentions: [wId, lId] },
      { text: victoryMsg, mentions: [wId, lId] }
    ]
  });
}
