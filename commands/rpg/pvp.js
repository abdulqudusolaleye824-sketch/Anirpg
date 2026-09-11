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

function getClassName(player) {
  if (!player || !player.class) return 'No Class';
  if (typeof player.class === 'string') return player.class;
  if (typeof player.class === 'object') return player.class.name || 'No Class';
  return 'No Class';
}

function getPlayerName(player, fallback = 'Hunter') {
  if (!player) return fallback;
  return player.name || fallback;
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
    let db = getDatabase();
    if (!db) db = {};
    if (!db.users) db.users = {};
    if (!db.pendingChallenges) db.pendingChallenges = {};
    const player = db.users?.[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You need to register first!' }, { quoted: msg });
    }
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

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
        ...(pro ? [UI.PRO_BAR, `⚔️ *PVP CHALLENGE ISSUED!* 💎`, UI.PRO_BAR] : [`⚔️ *PVP CHALLENGE ISSUED!*`, UI.FREE_BAR]),
        `👤 *Challenger:* ${challengerRank.emoji} ${getPlayerName(player)} [${getClassName(player)} Lv.${player.level || 1}]`,
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
        ...(pro ? [FRAME, UI.PRO_MINI, `💎 *PRO SCOUT* — ELO ${player.pvpElo || 1000} (you) vs ${opp.pvpElo || 1000} (${targetRank.name})`] : [FRAME, UI.upsell()]),
      ].join('\n');

      return sock.sendMessage(chatId, { text: guideText, mentions: [targetJid] }, { quoted: msg });
    }

    // ── /pvp accept ──────────────────────────────────────────────
    if (sub === 'accept') {
      if (!db.pendingChallenges) db.pendingChallenges = {};
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

      const cPro = UI.isPro(challenger);
      const stats1 = [
        ...(cPro ? [UI.PRO_BAR, `⚔️ *FIGHTER 1 BATTLE STATS* 💎`, UI.PRO_BAR] : [`⚔️ *FIGHTER 1 BATTLE STATS*`, UI.FREE_BAR]),
        `👤 Name: *${getPlayerName(challenger)}*`,
        `🎭 Class: *${getClassName(challenger)}* (Lv.${challenger.level || 1})`,
        `⭐ ELO: ${challenger.pvpElo || 1000}`,
        `❤️ HP: ${challenger.stats?.hp || 100}/${challenger.stats?.maxHp || 100}`,
        `⚔️ ATK: ${challenger.stats?.atk || 10} | 🛡️ DEF: ${challenger.stats?.def || 5}`,
        `⚡ Speed: ${p1Spd}`,
        cPro ? UI.PRO_BAR : UI.FREE_BAR,
      ].join('\n');

      const stats2 = [
        ...(pro ? [UI.PRO_BAR, `⚔️ *FIGHTER 2 BATTLE STATS* 💎`, UI.PRO_BAR] : [`⚔️ *FIGHTER 2 BATTLE STATS*`, UI.FREE_BAR]),
        `👤 Name: *${getPlayerName(player)}*`,
        `🎭 Class: *${getClassName(player)}* (Lv.${player.level || 1})`,
        `⭐ ELO: ${player.pvpElo || 1000}`,
        `❤️ HP: ${player.stats?.hp || 100}/${player.stats?.maxHp || 100}`,
        `⚔️ ATK: ${player.stats?.atk || 10} | 🛡️ DEF: ${player.stats?.def || 5}`,
        `⚡ Speed: ${p2Spd}`,
        `${FRAME}`,
      ].join('\n');

      const __challengerPlayer = db.users?.[challenge.challengerId];
      const __senderPlayer = db.users?.[sender];
      const __challengerName = __challengerPlayer ? getPlayerName(__challengerPlayer) : challenge.challengerId.split('@')[0];
      const __senderName = __senderPlayer ? getPlayerName(__senderPlayer) : sender.split('@')[0];
            const startPrompt = [
        ...(pro ? [UI.PRO_BAR, `🎮 *PVP BATTLE STARTED — TURN 1* 💎`, UI.PRO_BAR] : [`🎮 *PVP BATTLE STARTED — TURN 1*`, UI.FREE_BAR]),
        `⚔️ ${__challengerName} vs ${__senderName} — select your move!`,
        ``,
        `📌 *YOUR MOVES:*`,
        `• /attack or /attack <pattern_id>`,
        `• /skill or /<classcmd> (e.g. /heal, /call, /rage)`,
        `${FRAME}`,
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
      if (!db.pendingChallenges) db.pendingChallenges = {};
      const challenge = db.pendingChallenges[sender];
      if (!challenge) {
        return sock.sendMessage(chatId, { text: '❌ No pending challenge to decline.' }, { quoted: msg });
      }

      delete db.pendingChallenges[sender];
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `❌ *${getPlayerName(player)}* declined the PvP challenge.`
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
          ...(pro ? [UI.PRO_BAR, `⚔️ *PVP BATTLE STATUS — TURN ${turn}* 💎`, UI.PRO_BAR] : [`⚔️ *PVP BATTLE STATUS — TURN ${turn}*`, UI.FREE_BAR]),
          `📌 Your Move: *${locked}*`,
          ``,
          `👤 *${getPlayerName(player)}*: ${player.stats?.hp || 0}/${player.stats?.maxHp || 100} ❤️`,
          `👤 *${getPlayerName(opp, 'Opponent')}*: ${opp?.stats?.hp || 0}/${opp?.stats?.maxHp || 100} ❤️`,
          ...(pro ? [FRAME, UI.PRO_MINI, `💎 *PRO READ* — you ${Math.round(100 * (player.stats?.hp || 0) / (player.stats?.maxHp || 100))}% · foe ${Math.round(100 * (opp?.stats?.hp || 0) / (opp?.stats?.maxHp || 100))}%`] : [FRAME, UI.upsell()]),
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
        text: `🏳️ *${getPlayerName(player)}* surrendered! *${getPlayerName(opp, 'Opponent')}* wins the match!`
      }, { quoted: msg });
    }

    // ── /pvp rank ────────────────────────────────────────────────
    if (sub === 'rank') {
      const elo = player.pvpElo || 1000;
      const rank = getPvpRank(elo);
      const w = player.pvpWins || 0, l = player.pvpLosses || 0;
      const wr = (w + l) ? Math.round(100 * w / (w + l)) : 0;
      const text = UI.card(player, {
        icon: rank.emoji, title: 'PVP RANK & STATS',
        lines: [
          `👤 Hunter: *${getPlayerName(player)}*`,
          `⭐ ELO Rating: *${elo}* (${rank.name})`,
          `📊 Record: ✅ ${w} Wins | ❌ ${l} Losses`,
          `🔥 Win Streak: ${player.pvpStreak || 0}`,
        ],
        proLines: [`💎 *PRO ARENA* — win rate *${wr}%* across ${w + l} bouts`],
        tip: '/pvp challenge @user to climb',
      });
      return sock.sendMessage(chatId, { text }, { quoted: msg });
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

      // Validate pattern choice: must be owned AND equipped (no free legendaries)
      if (sub === 'attack' && args[1] != null && String(args[1]).trim() !== '') {
        const _pid = parseInt(args[1]);
        if (isNaN(_pid) || _pid < 1 || _pid > 750) {
          return sock.sendMessage(chatId, { text: '❌ Invalid pattern! Usage: /attack <pattern_id 1-750>\nOr plain /attack for a basic strike.' }, { quoted: msg });
        }
        const _owned = player.attackPatterns?.owned || [];
        const _equipped = player.attackPatterns?.equipped || [];
        if (!_owned.includes(_pid)) {
          return sock.sendMessage(chatId, { text: `❌ You don't own Attack #${_pid}!\nAcquire it first: /attacks shop` }, { quoted: msg });
        }
        if (!_equipped.includes(_pid)) {
          return sock.sendMessage(chatId, { text: `❌ Attack #${_pid} is not equipped!\nEquip it first: /attacks equip ${_pid}` }, { quoted: msg });
        }
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
        battle.turnExpiresAt = Date.now() + 20000;
        const curTurn = battle.turn || 1;
        const meId = sender;
        const myName = getPlayerName(player, 'Hunter');
        setTimeout(async () => {
          try {
            const me = db.users?.[meId];
            const them = db.users?.[oppId];
            if (!me?.pvpBattle || !them?.pvpBattle) return;
            if (me.pvpBattle.turn !== curTurn || them.pvpBattle.turn !== curTurn) return;
            if (them.pvpBattle.pendingAction) return; // opponent locked in time
            if (!me.pvpBattle.pendingAction) return; // i was cleared?
            // Opponent timed out — auto-resolve with opponent skipped
            // Create a dummy skipped action for opponent
            them.pvpBattle.pendingAction = { type: 'attack', arg: null, _timedOut: true, _skip: true };
            await resolveTurn(sock, chatId, me, them, db, saveDatabase);
          } catch(e) {}
        }, 20000);
        return sock.sendMessage(chatId, {
          text: `✅ *Move locked in!* Waiting for *@${oppId.split('@')[0]}* to choose their move... ⏳ 20s to lock or turn will be skipped.`,
          mentions: [oppId],
        }, { quoted: msg });
      }
    }

    // ── Default Help ─────────────────────────────────────────────
    const helpText = UI.card(player, {
      icon: '⚔️', title: 'PVP BATTLE SYSTEM',
      lines: [
        `Turn-by-Turn Unautomated Duels`,
        ``,
        `📌 *COMMANDS:*`,
        `/pvp challenge @user — Issue challenge (or reply)`,
        `/pvp accept · /pvp reject`,
        `/attack [pattern_id] — Attack in battle`,
        `/skill [name] — Use skill in battle`,
        `/pvp status · /pvp surrender · /pvp rank`,
      ],
      proLines: [`💎 *PRO ARENA* — *${player.pvpWins || 0}W–${player.pvpLosses || 0}L* · ELO *${player.pvpElo || 1000}*`],
      tip: 'Speed strikes first — stack it',
    });
    return sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
  }
};

// ── Turn Resolution Engine — Unified + Cooldown + Slow Drop ────────────────────────────────────────
const UC = require('../../rpg/utils/UnifiedCombat');
const BarSystemPVP = require('../../rpg/utils/BarSystem');
const AttackDBPVP = require('../../rpg/utils/AttackPatternDB');
const UI = require('../../rpg/utils/UI');
// Shared duel display: deluxe frame if EITHER duelist is Pro.
function pvpFrame(p1, p2) {
  try { return (UI.isPro(p1) || UI.isPro(p2)) ? UI.PRO_BAR : UI.FREE_BAR; }
  catch (e) { return UI.FREE_BAR; }
}

async function resolveTurn(sock, chatId, p1, p2, db, saveDatabase) {
  const FRAME = pvpFrame(p1, p2);
  if (!db) db = {};
  if (!db.users) db.users = {};
  // Resolve jids for mentions — try to find keys in db.users
  let id1 = null, id2 = null;
  for (const [k,v] of Object.entries(db.users)) {
    if (v === p1) id1 = k;
    if (v === p2) id2 = k;
  }
  // fallback to stored opponentId / pending
  if (!id1 || !String(id1).includes('@')) {
    if (p1.pvpBattle?.opponentId) id1 = p2.pvpBattle?.opponentId ? Object.keys(db.users).find(k=>db.users[k]===p1) || p1.pvpBattle.opponentId : id1;
  }
  if (!id2 || !String(id2).includes('@')) {
    if (p2.pvpBattle?.opponentId) id2 = p1.pvpBattle?.opponentId ? Object.keys(db.users).find(k=>db.users[k]===p2) || p2.pvpBattle.opponentId : id2;
  }
  if (!id1) id1 = p1.jid || p1.id || 'unknown@s.whatsapp.net';
  if (!id2) id2 = p2.jid || p2.id || 'unknown@s.whatsapp.net';
  if (!String(id1).includes('@')) id1 = String(id1) + '@s.whatsapp.net';
  if (!String(id2).includes('@')) id2 = String(id2) + '@s.whatsapp.net';

  const battle1 = p1.pvpBattle;
  const battle2 = p2.pvpBattle;
  const turnNum = (battle1?.turn || battle2?.turn || 1);

  function buildMove(player, act) {
    if (!act) return null;
    if (act.type === 'attack') {
      const pid = parseInt(act.patternId || act.arg);
      if (!isNaN(pid) && pid >= 1 && pid <= 750) {
        // Safety net (lock-in already validated): unowned/unequipped → basic strike
        const _o = player.attackPatterns?.owned || [];
        const _e = player.attackPatterns?.equipped || [];
        if (_o.includes(pid) && _e.includes(pid)) {
          const atk = AttackDBPVP.generateAttack(pid);
          if (atk) return atk;
        }
      }
      return UC.basicStrike();
    }
    if (act.type === 'skill') {
      const skillName = act.skillName || act.arg || 'Skill';
      return {
        id: 0,
        rank: 'C',
        name: skillName,
        flavour: 'Class technique',
        description: 'A class-bound skill channeled through practiced form. Not a martial pattern, but the unified engine treats its Atk/Def/Speed/Crit/Accuracy the same way — the calculations are identical across all battle systems.',
        dmgMult: 1.5,
        atkMult: 1.2,
        defMult: 1.1,
        speedMult: 1.1,
        critMult: 1.6,
        accuracy: 88,
        effect: null,
        cooldownMs: 30000,
        cooldownSec: 30,
      };
    }
    return UC.basicStrike();
  }

  // Silenced fighters cannot channel skills — downgrade to a basic strike (noted on their segment)
  try {
    const _SEMs = require('../../rpg/utils/StatusEffectManager');
    if (battle1?.pendingAction?.type === 'skill' && _SEMs.isSilenced(p1)) battle1.pendingAction = { type: 'attack', arg: null, _silenced: true };
    if (battle2?.pendingAction?.type === 'skill' && _SEMs.isSilenced(p2)) battle2.pendingAction = { type: 'attack', arg: null, _silenced: true };
  } catch(e){}
  const m1 = buildMove(p1, battle1?.pendingAction);
  const m2 = buildMove(p2, battle2?.pendingAction);
  const name1 = getPlayerName(p1, 'Hunter');
  const name2 = getPlayerName(p2, 'Hunter');

  const act1 = battle1?.pendingAction;
  const act2 = battle2?.pendingAction;
  const _fx1 = UC.canAct(p1);
  const _fx2 = UC.canAct(p2);
  const cd1 = m1 && m1.id ? UC.isOnCooldown(p1, m1.id) : { onCd: false };
  const cd2 = m2 && m2.id ? UC.isOnCooldown(p2, m2.id) : { onCd: false };

  let res1 = null, res2 = null;
  let p1Skipped = false, p2Skipped = false;
  let skipMsg1 = '', skipMsg2 = '';

  if (act1 && (act1._skip || act1._timedOut)) {
    p1Skipped = true;
    skipMsg1 = `⏳ *${name1}'s attack failed — no move locked in 20s. Turn skipped (0 dmg, status -1).`;
    res1 = { damage: 0, missed: false, crit: false, effective: 'skipped', _skipped: true };
  } else if (!_fx1.canAct) {
    p1Skipped = true;
    { const _m1 = { frozen: ['❄️', 'FROZEN solid'], stunned: ['💫', 'STUNNED'], paralyzed: ['🔱', 'PARALYZED'], feared: ['😱', 'FEARED'] };
      const [_e1, _w1] = _m1[_fx1.reason] || ['💫', 'STUNNED'];
      skipMsg1 = `${_e1} *${name1} is ${_w1} and cannot move!* Turn skipped (0 dmg, status -1).`; }
    res1 = { damage: 0, missed: false, crit: false, effective: 'skipped', _skipped: true };
  } else if (cd1.onCd) {
    p1Skipped = true;
    skipMsg1 = `⏳ *${name1}'s attack failed — still on cooldown* ${UC.formatCd(cd1.remaining)} remaining. Turn skipped (0 dmg, status -1).`;
    res1 = { damage: 0, missed: false, crit: false, effective: 'skipped', _skipped: true };
  }
  if (act2 && (act2._skip || act2._timedOut)) {
    p2Skipped = true;
    skipMsg2 = `⏳ *${name2}'s attack failed — no move locked in 20s. Turn skipped (0 dmg, status -1).`;
    res2 = { damage: 0, missed: false, crit: false, effective: 'skipped', _skipped: true };
  } else if (!_fx2.canAct) {
    p2Skipped = true;
    { const _m2 = { frozen: ['❄️', 'FROZEN solid'], stunned: ['💫', 'STUNNED'], paralyzed: ['🔱', 'PARALYZED'], feared: ['😱', 'FEARED'] };
      const [_e2, _w2] = _m2[_fx2.reason] || ['💫', 'STUNNED'];
      skipMsg2 = `${_e2} *${name2} is ${_w2} and cannot move!* Turn skipped (0 dmg, status -1).`; }
    res2 = { damage: 0, missed: false, crit: false, effective: 'skipped', _skipped: true };
  } else if (cd2.onCd) {
    p2Skipped = true;
    skipMsg2 = `⏳ *${name2}'s attack failed — still on cooldown* ${UC.formatCd(cd2.remaining)} remaining. Turn skipped (0 dmg, status -1).`;
    res2 = { damage: 0, missed: false, crit: false, effective: 'skipped', _skipped: true };
  }

  if (!p1Skipped && m1) {
    res1 = UC.calcMoveDamage(p1, p2, m1);
    if (m1.id) UC.setCooldown(p1, m1.id, m1);
    if (m1.id) { try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(p1, 'pattern', 1, sock, id1, chatId); } catch(e){} }
  }
  if (!p2Skipped && m2) {
    res2 = UC.calcMoveDamage(p2, p1, m2);
    if (m2.id) UC.setCooldown(p2, m2.id, m2);
    if (m2.id) { try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(p2, 'pattern', 1, sock, id2, chatId); } catch(e){} }
  }

  const p1Spd = (p1.stats?.speed || 50) * (m1?.speedMult || 1);
  const p2Spd = (p2.stats?.speed || 50) * (m2?.speedMult || 1);
  const p1First = p1Spd > p2Spd || (p1Spd === p2Spd && Math.random() < 0.5);
  const order = p1First ? [{p:p1,opp:p2,move:m1,res:res1,name:name1,oppName:name2,skipped:p1Skipped,skipMsg:skipMsg1},
                           {p:p2,opp:p1,move:m2,res:res2,name:name2,oppName:name1,skipped:p2Skipped,skipMsg:skipMsg2}]
                        : [{p:p2,opp:p1,move:m2,res:res2,name:name2,oppName:name1,skipped:p2Skipped,skipMsg:skipMsg2},
                           {p:p1,opp:p2,move:m1,res:res1,name:name1,oppName:name2,skipped:p1Skipped,skipMsg:skipMsg1}];

  let accumulated = '';
  let battleEnded = false;
  let winner = null, loser = null, winnerId = null, loserId = null;

  for (let idx = 0; idx < order.length; idx++) {
    const o = order[idx];
    if (battleEnded) break;
    let segment = '';
    if (o.skipped) {
      const segHead = (UI.isPro(o.p) || UI.isPro(o.opp)) ? [UI.PRO_BAR, `⚔️ *TURN ${turnNum} — ${o.name}'s Move* 💎`, UI.PRO_BAR] : [`⚔️ *TURN ${turnNum} — ${o.name}'s Move*`, UI.FREE_BAR];
      segment = [
        ...segHead,
        o.skipMsg,
        `${FRAME}`,
        `❤️ ${name1}: ${BarSystemPVP.getHPBar(p1.stats?.hp || 0, p1.stats?.maxHp || 100, UC.isPro(p1))}`,
        `❤️ ${name2}: ${BarSystemPVP.getHPBar(p2.stats?.hp || 0, p2.stats?.maxHp || 100, UC.isPro(p2))}`,
        `${FRAME}`,
      ].join('\n');
      UC.tickStatuses(o.p);
      UC.tickStatuses(o.opp);
    } else {
      if (!o.res.missed) {
        o.opp.stats.hp = Math.max(0, (o.opp.stats?.hp || 0) - o.res.damage);
        const eff = UC.tryApplyEffect(o.move, o.p, o.opp);
        segment = UC.buildTurnMessage(o.p, o.opp, o.move, o.res);
        segment = segment.replace(UI.FREE_BAR + '\n', `${FRAME}\n⚔️ *TURN ${turnNum} — ${o.name}'s Move*${FRAME === UI.PRO_BAR ? ' 💎' : ''}\n${FRAME}\n`);
        if (eff) segment += `\n${eff.emoji || '✨'} *${eff.type} applied!* (${eff.duration}t)`;
      } else {
        segment = UC.buildTurnMessage(o.p, o.opp, o.move, o.res);
        segment = segment.replace(UI.FREE_BAR + '\n', `${FRAME}\n⚔️ *TURN ${turnNum} — ${o.name}'s Move*${FRAME === UI.PRO_BAR ? ' 💎' : ''}\n${FRAME}\n`);
      }
      const tickLogs = UC.tickStatuses(o.opp);
      if (tickLogs.length) segment += `\n` + tickLogs.join('\n');
      const selfTick = UC.tickStatuses(o.p);
      if (selfTick.length) segment += `\n` + selfTick.join('\n');
      if ((o.p === p1 && act1 && act1._silenced) || (o.p === p2 && act2 && act2._silenced)) segment = `🤐 *${o.name} is SILENCED — skill fizzles, basic strike instead!*\n` + segment;
    }

    const target = o.opp;
    if ((target.stats?.hp || 0) <= 0) {
      const PetManager = require('../../rpg/utils/PetManager');
      const oppJid = (o.opp === p1 ? id1 : id2);
      const sac = PetManager.checkPetSacrifice(oppJid, target);
      if (sac && sac.sacrificed) {
        segment += `\n\n${sac.message}`;
        accumulated += (accumulated ? '\n\n' : '') + segment;
        await UC.slowSend(sock, chatId, { text: segment, mentions: [id1, id2] });
      } else {
        winner = o.p; loser = o.opp;
        winnerId = (o.p === p1 ? id1 : id2);
        loserId = (o.opp === p1 ? id1 : id2);
        battleEnded = true;
        accumulated += (accumulated ? '\n\n' : '') + segment;
        await UC.slowSend(sock, chatId, { text: segment, mentions: [id1, id2] });
        return handlePvpVictory(sock, chatId, winner, loser, winnerId, loserId, db, saveDatabase, turnNum, accumulated);
      }
    } else {
      accumulated += (accumulated ? '\n\n' : '') + segment;
      await UC.slowSend(sock, chatId, { text: segment, mentions: [id1, id2] });
    }
  }

  if (battleEnded) return;

  if (p1.pvpBattle) {
    p1.pvpBattle.turn = turnNum + 1;
    p1.pvpBattle.pendingAction = null;
    p1.pvpBattle.turnExpiresAt = Date.now() + 20000;
  }
  if (p2.pvpBattle) {
    p2.pvpBattle.turn = turnNum + 1;
    p2.pvpBattle.pendingAction = null;
    p2.pvpBattle.turnExpiresAt = Date.now() + 20000;
  }
  saveDatabase();

  const isPro1 = UC.isPro(p1);
  const isPro2 = UC.isPro(p2);
  // Build status summary for next turn start
  function statusSummary(pl) {
    if (!pl.statusEffects || pl.statusEffects.length===0) return null;
    const lines = [];
    for (const e of pl.statusEffects) {
      const em = e.emoji || ({ bleed:'🩸', burn:'🔥', poison:'☠️', stun:'⚡', freeze:'❄️', paralyze:'🔱', weaken:'💔', curse:'💀', fear:'😱', enfeeble:'🐢', silence:'🤐', blind:'🌫️', trueslow:'🐌' }[e.type] || '✨');
      let desc = '';
      if (e.type==='bleed') desc = `🩸 -4% max HP/turn`;
      else if (e.type==='burn') desc = `🔥 -5% max HP/turn`;
      else if (e.type==='poison') desc = `☠️ -3% max HP/turn`;
      else if (e.type==='stun') desc = `⚡ skip next turn`;
      else if (e.type==='freeze') desc = `❄️ skip turn + frost DoT, -20% DEF`;
      else if (e.type==='paralyze') desc = `🔱 70% skip, -50% ATK`;
      else if (e.type==='weaken') desc = `💔 -30% ATK`;
      else if (e.type==='curse') desc = `💀 -15% DEF`;
      else if (e.type==='fear') desc = `😱 40% skip, -20% ATK`;
      else if (e.type==='enfeeble') desc = `🐢 -30% DEF`;
      else if (e.type==='silence') desc = `🤐 skills locked`;
      else if (e.type==='blind') desc = `🌫️ -50% accuracy`;
      else if (e.type==='trueslow') desc = `🐌 -35% speed`;
      else desc = e.desc || '';
      lines.push(`${em} *${e.type}* (${e.duration}t) — ${desc}`);
    }
    return lines.join('\n');
  }
  const s1 = statusSummary(p1);
  const s2 = statusSummary(p2);
  const statusBlock = (s1||s2) ? `\n${FRAME}\n⚠️ *STATUS EFFECTS*\n${s1 ? `👤 ${name1}:\n${s1}` : ''}${s1&&s2?'\n':''}${s2 ? `👤 ${name2}:\n${s2}` : ''}\n${FRAME}` : '';
  const nextHead = FRAME === UI.PRO_BAR ? [UI.PRO_BAR, `🎮 *TURN ${turnNum + 1} — CHOOSE YOUR MOVE* 💎`, UI.PRO_BAR] : [`🎮 *TURN ${turnNum + 1} — CHOOSE YOUR MOVE*`, UI.FREE_BAR];
  const nextMsg = [
    ...nextHead,
    `❤️ ${name1}: ${BarSystemPVP.getHPBar(p1.stats?.hp || 0, p1.stats?.maxHp || 100, isPro1)}${s1 ? `\n  ${s1.split('\n')[0]}` : ''}`,
    `❤️ ${name2}: ${BarSystemPVP.getHPBar(p2.stats?.hp || 0, p2.stats?.maxHp || 100, isPro2)}${s2 ? `\n  ${s2.split('\n')[0]}` : ''}`,
    statusBlock,
    ``,
    `📌 20s to lock move:`,
    `• /attack or /attack <pattern_id>`,
    `• /skill or /<classcmd>`,
    `${FRAME}`,
  ].filter(Boolean).join('\n');

  await UC.slowSend(sock, chatId, { text: nextMsg, mentions: [id1, id2] });
  setTimeout(async () => {
    try {
      const cur1 = db.users?.[id1];
      const cur2 = db.users?.[id2];
      if (!cur1?.pvpBattle || !cur2?.pvpBattle) return;
      if (cur1.pvpBattle.turn !== turnNum + 1) return;
      if (cur1.pvpBattle.pendingAction || cur2.pvpBattle.pendingAction) return;
      UC.tickStatuses(cur1);
      UC.tickStatuses(cur2);
      cur1.pvpBattle.turn = turnNum + 2;
      cur2.pvpBattle.turn = turnNum + 2;
      cur1.pvpBattle.pendingAction = null;
      cur2.pvpBattle.pendingAction = null;
      saveDatabase();
      const timeoutMsg = `⏳ *Turn ${turnNum + 1} timed out* — no move locked in 20s. Both turns skipped (status -1).\n` +
                         `❤️ ${getPlayerName(cur1)}: ${BarSystemPVP.getHPBar(cur1.stats?.hp || 0, cur1.stats?.maxHp || 100, UC.isPro(cur1))}\n` +
                         `❤️ ${getPlayerName(cur2)}: ${BarSystemPVP.getHPBar(cur2.stats?.hp || 0, cur2.stats?.maxHp || 100, UC.isPro(cur2))}`;
      await sock.sendMessage(chatId, { text: timeoutMsg, mentions: [id1, id2] });
    } catch(e) {}
  }, 20000);
}

function calcMoveDamage(attacker, defender, act) {
  const atk = (attacker.stats?.atk || 10) + (attacker.equipped?.weapon?.atk || attacker.equipped?.weapon?.bonus || 0);
  const def = (defender.stats?.def || 5) + (defender.equipped?.armor?.def || 0);
  let dmgMult = 1.0;
  let moveLabel = 'Basic Attack';
  const patternId = parseInt(act?.patternId || act?.arg);
  if (!isNaN(patternId) && patternId >= 1 && patternId <= 750) {
    const pattern = AttackDBPVP.generateAttack(patternId);
    if (pattern && pattern.name) {
      dmgMult = pattern.dmgMult || 1.2;
      moveLabel = `Attack Pattern #${pattern.id || patternId} (${pattern.name})`;
    }
  }
  let rawDmg = Math.floor(atk * dmgMult * (0.9 + Math.random() * 0.20));
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
  const FRAME = pvpFrame(winner, loser);
  const winnerName = getPlayerName(winner, 'Winner');
  const loserName  = getPlayerName(loser, 'Loser');

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

  // Loser stakes: aura slips 10–15 (flat — never Pro-doubled),
  // loser's guild drops 10 GP (flat).
  const _auraLoss = 10 + Math.floor(Math.random() * 6);
  loser.aura = Math.max(0, (loser.aura || 0) - _auraLoss);

  const isProWinner = !!((winner.isPro || winner.proStatus) && winner.proExpiresAt && Date.now() < winner.proExpiresAt);
  const proMultPvP = isProWinner ? 2 : 1;
  // Winner's guild cut doubles for Pro winners; loser's guild always −10.
  const winnerGP = 15 * proMultPvP;
  try {
    const GPS = require('../../rpg/utils/GuildPointsSystem');
    GPS.addGuildGP(db, wId, winnerGP, 'PvP win vs ' + loserName, { quest: true, sock, jid: wId, chatId });
    GPS.addGuildGP(db, lId, -10, 'PvP loss vs ' + winnerName);
  } catch(e){}

  let rewardNexus = 1000 + Math.floor((loser.level || 1) * 50);
  let rewardXP = 500 + Math.floor((loser.level || 1) * 30);
  let rewardBp = 100;
  let rewardPass = 50;
  // Winner aura: +[20-35], doubled for Pro (→ [40-70]).
  let rewardAura = 20 + Math.floor(Math.random() * 16);
  rewardNexus = Math.floor(rewardNexus * proMultPvP);
  rewardXP = Math.floor(rewardXP * proMultPvP);
  rewardBp = Math.floor(rewardBp * proMultPvP);
  rewardPass = Math.floor(rewardPass * proMultPvP);
  rewardAura = Math.floor(rewardAura * proMultPvP);

  winner.gold = (winner.gold || 0) + rewardNexus;
  winner.xp = (winner.xp || 0) + rewardXP;
  winner.aura = (winner.aura || 0) + rewardAura;
  // Battle Pass XP (direct amount — NOT multiplied by the source table)
  try { const BP = require('../../rpg/utils/BattlePass'); if (BP.addPassXPAmount) { BP.addPassXPAmount(winner, rewardBp); } else if (BP.addPassXP) { BP.addPassXP(winner, 'pvp_win'); } else { winner.battlePassXp = (winner.battlePassXp||0)+rewardBp; } } catch(e){ winner.battlePassXp=(winner.battlePassXp||0)+rewardBp; }
  // Astra Pass (direct amount into the pass object)
  try { const AP = require('../../rpg/utils/AstraPass'); if (AP.addPassXPAmount) AP.addPassXPAmount(winner, rewardPass); else winner.astraPassXp=(winner.astraPassXp||0)+rewardPass; } catch(e){ winner.astraPassXp=(winner.astraPassXp||0)+rewardPass; }

  // Daily quests: exactly ONE pvp win credit (+dungeon-duel bonus if fought in a dungeon GC)
  try {
    const QD = require('../../rpg/utils/QuestDispatcher');
    QD.trackAndNotify(winner, 'pvp', 1, sock, wId, chatId);
    QD.trackAndNotify(winner, 'goldEarn', rewardNexus, sock, wId, chatId);
    let _inDg = false;
    try { const _GKM = require('../../rpg/dungeons/GateKeyManager'); _inDg = !!(_GKM.getDungeonGC && _GKM.getDungeonGC(chatId)); } catch(e){}
    if (_inDg) QD.trackAndNotify(winner, 'pvpFloor', 1, sock, wId, chatId);
  } catch(e){}

  // Also give general exp via LevelUpManager check
  try { const LUM = require('../../rpg/utils/LevelUpManager'); LUM.checkAndApplyLevelUps(winner, saveDatabase, sock, chatId); } catch(e){}

  // Reset battle state
  winner.pvpBattle = null;
  loser.pvpBattle = null;

  saveDatabase();

  const vicHead = FRAME === UI.PRO_BAR ? [UI.PRO_BAR, `🏆 *PVP BATTLE OVER — VICTORY!* 💎`, UI.PRO_BAR] : [`🏆 *PVP BATTLE OVER — VICTORY!*`, UI.FREE_BAR];
  const victoryMsg = [
    ...vicHead,
    `👑 *${winnerName}* HAS DEFEATED *${loserName}*!`,
    `⏱️ Total Turns: ${turns}`,
    ``,
    `📊 *ELO CHANGES:*`,
    `🥇 ${winnerName}: ${wElo} → *${winner.pvpElo}* (+${change})`,
    `🥈 ${loserName}: ${lElo} → *${loser.pvpElo}* (−${loss})`,
    ``,
    `🎁 *REWARDS:*${isProWinner?' 🌟 PRO 2×':''}`,
    `💠 Nexus: +${rewardNexus.toLocaleString()}${isProWinner?' (2×)':''}`,
    `✨ XP: +${rewardXP.toLocaleString()}${isProWinner?' (2×)':''} (general)`,
    `🌀 Aura: +${rewardAura.toLocaleString()}${isProWinner?' (2×)':''}`,
    `🏰 Guild: +${winnerGP} GP (winner)${isProWinner?' (2×)':''} | −10 GP (loser)`,
    `📉 ${loserName} aura: −${_auraLoss}`,
    `🎖️ Battle Pass XP: +${rewardBp}${isProWinner?' (2×)':''}`,
    `🌟 Astra Pass: +${rewardPass}${isProWinner?' (2×)':''}`,
    `${FRAME}`,
  ].join('\n');

  return sock.sendMessage(chatId, {
    sections: [
      { text: lastTurnText, mentions: [wId, lId] },
      { text: victoryMsg, mentions: [wId, lId] }
    ]
  });
}

// Test hook (no prod effect): exposes the victory resolver to harnesses.
module.exports._handlePvpVictory = handlePvpVictory;
