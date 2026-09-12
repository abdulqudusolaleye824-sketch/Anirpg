/**
 * ✦ 𝐀𝐬𝐭𝐫𝐚™ — Anime Quiz Command
 *
 * Commands (games GC only):
 *   /quiz <num>       — Start a quiz (1–20 questions)
 *   /a <A/B/C/D>      — Answer current question (anyone can join mid-quiz)
 *   /quiz stop        — Host/admin stops the quiz early
 *   /quiz scores      — Show current leaderboard mid-quiz
 *   /quiz stats       — Your all-time quiz stats
 *
 * Rules:
 *   • Only works in a designated --games GC
 *   • 3-minute cooldown per player between games
 *   • 30 seconds per question
 *   • Anyone can join by answering
 *   • XP goes to Astra Pass
 *   • Nexus reward split among correct answers
 */

'use strict';

const { getRandomQuestions, formatQuestion, QUIZ_STATS } = require('../../rpg/data/anime_quiz_200');
const UI = require('../../rpg/utils/UI');
const AstralGroups = require('../../rpg/utils/AstralGroups');

// ── Active sessions: one per group chat ────────────────────────────────────────
// { chatId: SessionObject }
const activeSessions = {};

// ── Player cooldowns: { chatId_sender: timestamp } ────────────────────────────
const playerCooldowns = {};

// ── Quiz constants ─────────────────────────────────────────────────────────────
const QUESTION_TIME_MS    = 30_000;   // 30s per question
const COOLDOWN_MS         = 3 * 60 * 1000; // 3 minutes
const MAX_QUESTIONS       = 20;
const MIN_QUESTIONS       = 1;

// ── Rewards ───────────────────────────────────────────────────────────────────
const NEXUS_PER_CORRECT   = 150;   // per correct answer
const ASTRA_XP_PER_Q     = 40;    // Astra Pass XP per correct answer
const ASTRA_XP_PARTICIPATE = 10;   // XP just for answering (right or wrong)
const NEXUS_WIN_BONUS     = 500;   // bonus for top scorer at the end
const SPEED_BONUS_MS      = 5_000; // answer within 5s = speed bonus
const SPEED_BONUS_NEXUS   = 75;

// ── Difficulty XP multipliers ─────────────────────────────────────────────────
const DIFF_MULT = { easy: 1, medium: 1.5, hard: 2 };

// ─────────────────────────────────────────────────────────────────────────────
// SESSION OBJECT
// ─────────────────────────────────────────────────────────────────────────────

function createSession(chatId, hostJid, questions) {
  return {
    chatId,
    hostJid,
    questions,
    currentIndex:  0,
    questionTimer: null,
    startedAt:     Date.now(),
    active:        true,
    scores: {},      // { jid: { correct, wrong, nexus, xp, name } }
    answered: new Set(), // jids who answered this question
    questionStartedAt: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getPlayerCooldownKey(chatId, sender) {
  return `${chatId}__${sender}`;
}

function isOnCooldown(chatId, sender) {
  const key  = getPlayerCooldownKey(chatId, sender);
  const last = playerCooldowns[key];
  if (!last) return false;
  return (Date.now() - last) < COOLDOWN_MS;
}

function setCooldown(chatId, sender) {
  playerCooldowns[getPlayerCooldownKey(chatId, sender)] = Date.now();
}

function cooldownRemaining(chatId, sender) {
  const key  = getPlayerCooldownKey(chatId, sender);
  const last = playerCooldowns[key];
  if (!last) return 0;
  return Math.max(0, Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000));
}

function ensurePlayer(session, jid, name) {
  if (!session.scores[jid]) {
    session.scores[jid] = { correct: 0, wrong: 0, nexus: 0, xp: 0, name: name || jid.split('@')[0] };
  }
}

function formatLeaderboard(session, title = 'CURRENT SCORES', pro = false) {
  const entries = Object.entries(session.scores)
    .sort((a, b) => b[1].correct - a[1].correct || b[1].nexus - a[1].nexus);

  if (entries.length === 0) return `No answers yet!`;

  const lines = [
    (pro ? UI.PRO_BAR : UI.FREE_BAR),
    `🏆 *${title}*`,
    pro ? (UI.PRO_MINI + '\n' + '🎌 PRO SCHOLAR') : null,
    pro ? `📊 *${Object.keys(session.scores).length}* scholars ranked` : null,
    pro ? `` : null,
    ``,
  ].filter(x => x !== null);

  const medals = ['🥇','🥈','🥉'];
  entries.forEach(([, data], i) => {
    const medal = medals[i] || `${i + 1}.`;
    lines.push(`${medal} *${data.name}* — ${data.correct} correct | +${data.nexus.toLocaleString()} Nexus`);
  });

  lines.push((pro ? UI.PRO_BAR : UI.FREE_BAR));
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// QUIZ FLOW
// ─────────────────────────────────────────────────────────────────────────────

async function sendQuestion(sock, session, db, saveDatabase) {
  if (!session.active) return;

  const q         = session.questions[session.currentIndex];
  const total     = session.questions.length;
  const current   = session.currentIndex + 1;

  session.answered         = new Set();
  session.questionStartedAt = Date.now();

  const text = formatQuestion(q, current, total, UI.isPro(db.users?.[session.hostJid]));
  await sock.sendMessage(session.chatId, { text });

  // Auto-advance after 30 seconds if no one answered / time up
  session.questionTimer = setTimeout(async () => {
    if (!session.active) return;
    // Reveal answer
    const correct = q.options[q.answer];
    await sock.sendMessage(session.chatId, {
      text: [
        `⏰ *Time's up!*`,
        ``,
        `✅ The correct answer was: *${q.answer}. ${correct}*`,
        ``,
        session.answered.size === 0
          ? `No one answered this one!`
          : `${session.answered.size} player(s) answered.`,
      ].join('\n'),
    });

    await advanceQuestion(sock, session, db, saveDatabase);
  }, QUESTION_TIME_MS);
}

async function advanceQuestion(sock, session, db, saveDatabase) {
  if (!session.active) return;

  session.currentIndex++;

  if (session.currentIndex >= session.questions.length) {
    // Quiz over
    await endQuiz(sock, session, db, saveDatabase);
  } else {
    // Short pause between questions
    setTimeout(() => sendQuestion(sock, session, db, saveDatabase), 2500);
  }
}

async function endQuiz(sock, session, db, saveDatabase) {
  if (!session.active) return;
  session.active = false;
  clearTimeout(session.questionTimer);

  const chatId = session.chatId;
  delete activeSessions[chatId];

  // Find winner
  const entries = Object.entries(session.scores)
    .sort((a, b) => b[1].correct - a[1].correct || b[1].nexus - a[1].nexus);

  // Award win bonus to top scorer
  if (entries.length > 0) {
    const [winnerJid, winnerData] = entries[0];
    winnerData.nexus += NEXUS_WIN_BONUS;
    winnerData.xp    += 100;
  }

  // Apply rewards to DB
  for (const [jid, data] of entries) {
    const player = db.users?.[jid];
    if (!player) continue;
    if (!player.nexus) player.nexus = 0;
    player.nexus += data.nexus;
    // Astra Pass XP
    if (!player.astraPassXP) player.astraPassXP = 0;
    player.astraPassXP += data.xp;
    // Update quiz stats
    if (!player.quizStats) player.quizStats = { correct: 0, wrong: 0, gamesPlayed: 0, nexusEarned: 0 };
    player.quizStats.correct      += data.correct;
    player.quizStats.wrong        += data.wrong;
    player.quizStats.gamesPlayed  += 1;
    player.quizStats.nexusEarned  += data.nexus;
    // Set cooldown
    setCooldown(chatId, jid);
  }

  saveDatabase(db);

  // Build result message
  const proQ = UI.isPro(db.users?.[session.hostJid]);
  const totC = entries.reduce((a, [, d]) => a + d.correct, 0);
  const totN = entries.reduce((a, [, d]) => a + d.nexus, 0);
  const lines = [
    (proQ ? UI.PRO_BAR : UI.FREE_BAR),
    '🎌 *QUIZ COMPLETE!*',
    proQ ? (UI.PRO_MINI + '\n' + '🎌 PRO SCHOLAR') : null,
    proQ ? `📊 *${totC}* correct answers · 💠 *${totN.toLocaleString()}* Nexus paid out` : null,
    proQ ? `` : null,
    ``,
  ].filter(x => x !== null);

  if (entries.length === 0) {
    lines.push(`No one participated. Better luck next time!`);
  } else {
    const medals = ['🥇','🥈','🥉'];
    entries.forEach(([jid, data], i) => {
      const medal = medals[i] || `${i + 1}.`;
      lines.push(`${medal} *${data.name}*`);
      lines.push(`   ✅ ${data.correct} correct  ❌ ${data.wrong} wrong`);
      lines.push(`   💠 +${data.nexus.toLocaleString()} Nexus  ✨ +${data.xp} Astra XP`);
      lines.push(``);
    });

    if (entries.length > 0) {
      lines.push(`🏆 *Winner:* ${entries[0][1].name} gets +${NEXUS_WIN_BONUS} bonus Nexus!`);
    }
  }

  lines.push((proQ ? UI.PRO_BAR : UI.FREE_BAR));
  await sock.sendMessage(chatId, { text: lines.join('\n') });
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND HANDLER
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  name: 'quiz',
  description: '🎌 Anime quiz mini-game',
  usage: '/quiz <1-20> | /a <A/B/C/D>',
  category: 'games',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId   = msg.key.remoteJid;
    const db       = getDatabase();
    const player   = db.users?.[sender];
    const sub      = args[0]?.toLowerCase();

    // ── Check games GC ─────────────────────────────────────────────────────────
    // A GC becomes a Games GC via /setgroup games --main (AstralGroups registry).
    if (!AstralGroups.hostsActive(db, chatId, 'games')) {
      return sock.sendMessage(chatId, {
        text: `❌ The quiz only works in a designated *Games GC*.\nAsk an admin to set one up with */setgroup games --main*`,
      }, { quoted: msg });
    }

    // ── /quiz scores ───────────────────────────────────────────────────────────
    if (sub === 'scores' || sub === 'score') {
      const session = activeSessions[chatId];
      if (!session) return sock.sendMessage(chatId, { text: `❌ No quiz is currently running.` }, { quoted: msg });
      return sock.sendMessage(chatId, { text: formatLeaderboard(session, 'CURRENT SCORES', UI.isPro(player)) }, { quoted: msg });
    }

    // ── /quiz stats ────────────────────────────────────────────────────────────
    if (sub === 'stats') {
      if (!player) return sock.sendMessage(chatId, { text: `❌ You're not registered.` }, { quoted: msg });
      const s = player.quizStats || { correct: 0, wrong: 0, gamesPlayed: 0, nexusEarned: 0 };
      const acc = s.correct + s.wrong > 0
        ? Math.round((s.correct / (s.correct + s.wrong)) * 100)
        : 0;
      return sock.sendMessage(chatId, {
        text: [
          (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
          '🎌 *YOUR QUIZ STATS*',
          UI.isPro(player) ? (UI.PRO_MINI + '\n' + '🎌 PRO SCHOLAR') : null,
          UI.isPro(player) ? `⚡ Avg per game: *${s.gamesPlayed ? Math.round((s.nexusEarned || 0) / s.gamesPlayed).toLocaleString() : 0}* Nexus` : null,
          UI.isPro(player) ? `` : null,
          ``,
          `🎮 Games played: *${s.gamesPlayed}*`,
          `✅ Correct answers: *${s.correct}*`,
          `❌ Wrong answers: *${s.wrong}*`,
          `🎯 Accuracy: *${acc}%*`,
          `💠 Total Nexus earned: *${(s.nexusEarned || 0).toLocaleString()}*`,
          ``,
          (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
        ].filter(x => x !== null).join('\n'),
      }, { quoted: msg });
    }

    // ── /quiz stop ─────────────────────────────────────────────────────────────
    if (sub === 'stop' || sub === 'end') {
      const session = activeSessions[chatId];
      if (!session) return sock.sendMessage(chatId, { text: `❌ No quiz is running.` }, { quoted: msg });

      // Only host or admin can stop
      const isHost  = session.hostJid === sender;
      const isAdmin = db.groups?.[chatId]?.admins?.includes(sender);
      const isOwner = sender === (require('../../config.json').ownerNumber);
      if (!isHost && !isAdmin && !isOwner) {
        return sock.sendMessage(chatId, { text: `❌ Only the quiz host or an admin can stop the quiz.` }, { quoted: msg });
      }

      clearTimeout(session.questionTimer);
      await endQuiz(sock, session, db, saveDatabase);
      return;
    }

    // ── /quiz <number> — start a new quiz ──────────────────────────────────────
    const numQ = parseInt(sub);
    if (isNaN(numQ) && sub !== undefined) {
      return sock.sendMessage(chatId, {
        text: [
          (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
          '🎌 *ANIME QUIZ*',
          UI.isPro(player) ? (UI.PRO_MINI + '\n' + '🎌 PRO SCHOLAR') : null,
          UI.isPro(player) ? `🎓 Hard questions pay *2×* Nexus + XP — hunt them!` : null,
          UI.isPro(player) ? `` : null,
          ``,
          `*Commands:*`,
          `/quiz <1-20>     — Start a quiz`,
          `/a A/B/C/D       — Answer a question`,
          `/quiz scores     — Mid-quiz leaderboard`,
          `/quiz stats      — Your all-time stats`,
          `/quiz stop       — End quiz early (host/admin)`,
          ``,
          `*Rewards per correct answer:*`,
          `💠 ${NEXUS_PER_CORRECT} Nexus  ✨ ${ASTRA_XP_PER_Q} Astra XP`,
          `⚡ Speed bonus (under 5s): +${SPEED_BONUS_NEXUS} Nexus`,
          `🏆 Top scorer: +${NEXUS_WIN_BONUS} Nexus bonus`,
          ``,
          `*Question bank:* ${QUIZ_STATS.total} questions`,
          `Easy: ${QUIZ_STATS.byDifficulty.easy}  Medium: ${QUIZ_STATS.byDifficulty.medium}  Hard: ${QUIZ_STATS.byDifficulty.hard}`,
          (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
        ].filter(x => x !== null).join('\n'),
      }, { quoted: msg });
    }

    if (activeSessions[chatId]) {
      return sock.sendMessage(chatId, {
        text: `❌ A quiz is already running in this group!\nUse */quiz scores* to see current standings or */a* to answer.`,
      }, { quoted: msg });
    }

    // Cooldown check
    if (isOnCooldown(chatId, sender)) {
      const secs = cooldownRemaining(chatId, sender);
      return sock.sendMessage(chatId, {
        text: `⏳ You're on cooldown! Try again in *${secs}s*.`,
      }, { quoted: msg });
    }

    const count = Math.min(Math.max(numQ || 10, MIN_QUESTIONS), MAX_QUESTIONS);
    const questions = getRandomQuestions(count);

    const session = createSession(chatId, sender, questions);
    activeSessions[chatId] = session;

    const hostName = player?.name || sender.split('@')[0];

    await sock.sendMessage(chatId, {
      text: [
        (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
        '🎌 *ANIME QUIZ STARTING!*',
        UI.isPro(player) ? (UI.PRO_MINI + '\n' + '🎌 PRO SCHOLAR') : null,
        UI.isPro(player) ? `🎮 Your quiz game *#${(player?.quizStats?.gamesPlayed || 0) + 1}* — good luck, host!` : null,
        UI.isPro(player) ? `` : null,
        ``,
        `Host: *${hostName}*`,
        `Questions: *${count}*`,
        `Time per question: *30 seconds*`,
        ``,
        `Anyone can join by answering with */a A/B/C/D*`,
        ``,
        `First question in 3 seconds...`,
        (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
      ].filter(x => x !== null).join('\n'),
    });

    setTimeout(() => sendQuestion(sock, session, db, saveDatabase), 3000);
  },

  // ── /a <option> — answer handler ─────────────────────────────────────────────
  async handleAnswer(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId  = msg.key.remoteJid;
    const db      = getDatabase();
    const session = activeSessions[chatId];

    if (!session || !session.active) return; // no active quiz

    const option = args[0]?.toUpperCase();
    if (!['A','B','C','D'].includes(option)) {
      return sock.sendMessage(chatId, {
        text: `❌ Invalid answer. Use */a A*, */a B*, */a C* or */a D*.`,
      }, { quoted: msg });
    }

    // Already answered this question?
    if (session.answered.has(sender)) {
      return sock.sendMessage(chatId, {
        text: `❌ You already answered this question!`,
      }, { quoted: msg });
    }

    session.answered.add(sender);

    const player   = db.users?.[sender];
    const name     = player?.name || sender.split('@')[0];
    const q        = session.questions[session.currentIndex];
    const isCorrect = option === q.answer;
    const timeTaken = Date.now() - session.questionStartedAt;
    const isSpeed   = timeTaken <= SPEED_BONUS_MS;
    const diffMult  = DIFF_MULT[q.difficulty] || 1;

    ensurePlayer(session, sender, name);

    if (isCorrect) {
      const baseNexus  = Math.floor(NEXUS_PER_CORRECT * diffMult);
      const speedBonus = isSpeed ? SPEED_BONUS_NEXUS : 0;
      const totalNexus = baseNexus + speedBonus;
      const xp         = Math.floor(ASTRA_XP_PER_Q * diffMult);

      session.scores[sender].correct += 1;
      session.scores[sender].nexus   += totalNexus;
      session.scores[sender].xp      += xp;

      const speedMsg = isSpeed ? ` ⚡ Speed bonus +${SPEED_BONUS_NEXUS} Nexus!` : '';

      await sock.sendMessage(chatId, {
        text: [
          `✅ *${name}* got it right!${speedMsg}`,
          `+${totalNexus} Nexus  ✨ +${xp} Astra XP`,
        ].join('\n'),
      });
    } else {
      session.scores[sender].wrong += 1;
      session.scores[sender].xp   += ASTRA_XP_PARTICIPATE;

      await sock.sendMessage(chatId, {
        text: `❌ *${name}* — Wrong answer! ✨ +${ASTRA_XP_PARTICIPATE} Astra XP for trying`,
      });
    }

    // Check if everyone who could answer has answered
    // (We don't force advance on first correct — everyone gets a chance)
    // Advance only when time runs out (handled in timer above)
    // But if all active players answered, auto-advance after 3s
    // We can't know "all players" in a WhatsApp group easily, so we rely on timer
  },
};
