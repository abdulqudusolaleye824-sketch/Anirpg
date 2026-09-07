// ═══════════════════════════════════════════════════════════════
// DAILY CHALLENGE SYSTEM
// 3 rotating challenges per day. Each player gets the same set
// (seeded by UTC date), tracking their own progress.
// ═══════════════════════════════════════════════════════════════

const CHALLENGE_POOL = [
  // PvP challenges
  { id:'pvp_win_1',    type:'pvp_win',       target:1,  desc:'Win 1 PvP battle',       emoji:'⚔️',  rewards:{ gold:1500,  crystals:20 } },
  { id:'pvp_win_3',    type:'pvp_win',       target:3,  desc:'Win 3 PvP battles',      emoji:'⚔️',  rewards:{ gold:5000,  crystals:60 } },
  { id:'pvp_play_2',   type:'pvp_participate',target:2, desc:'Participate in 2 PvP battles', emoji:'🤝', rewards:{ gold:800, crystals:10 } },
  // Dungeon challenges
  { id:'dung_1',       type:'dungeon_clear', target:1,  desc:'Clear 1 dungeon',        emoji:'🏰',  rewards:{ gold:2000,  crystals:30 } },
  { id:'dung_5floors', type:'dungeon_floor', target:5,  desc:'Clear 5 dungeon floors', emoji:'🗡️', rewards:{ gold:3000,  crystals:40 } },
  // Casino challenges
  { id:'casino_3',     type:'casino_play',   target:3,  desc:'Play casino 3 times',    emoji:'🎰',  rewards:{ gold:1000,  crystals:15 } },
  { id:'casino_win_1', type:'casino_win',    target:1,  desc:'Win at casino once',     emoji:'💎',  rewards:{ gold:2500,  crystals:25 } },
  // Economy challenges
  { id:'rob_1',        type:'rob_attempt',   target:1,  desc:'Attempt to rob someone', emoji:'🦹',  rewards:{ gold:500,   crystals:10 } },
  { id:'send_gold',    type:'send_gold',     target:1,  desc:'Send gold to a player',  emoji:'💸',  rewards:{ gold:300,   crystals:5  } },
  // Boss challenges
  { id:'boss_1',       type:'boss_kill',     target:1,  desc:'Defeat a World Boss',    emoji:'👹',  rewards:{ gold:8000,  crystals:100} },
  { id:'skill_use_5',  type:'skill_use',     target:5,  desc:'Use skills 5 times',     emoji:'✨',  rewards:{ gold:500,   crystals:8  } },
  { id:'daily_streak', type:'claim_daily',   target:1,  desc:'Claim your daily reward',emoji:'📅',  rewards:{ gold:200,   crystals:3  } },
];

// Get today's 3 challenges (same for everyone, resets at midnight UTC)
function getTodaysChallenges() {
  const today = new Date();
  const seed  = today.getUTCFullYear() * 10000 + (today.getUTCMonth()+1) * 100 + today.getUTCDate();
  // Simple seeded shuffle
  const arr = [...CHALLENGE_POOL];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 3);
}

function getTodayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
}

// Get or init a player's daily challenge state
function getPlayerChallenges(player) {
  const todayKey = getTodayKey();
  if (!player.dailyChallenges || player.dailyChallenges.date !== todayKey) {
    const challenges = getTodaysChallenges();
    player.dailyChallenges = {
      date: todayKey,
      progress: Object.fromEntries(challenges.map(c => [c.id, { count: 0, completed: false }])),
      allClaimed: false,
    };
  }
  return player.dailyChallenges;
}

// Increment progress for a challenge type. Returns array of newly completed challenge ids.
function trackProgress(player, type, count = 1) {
  const todayKey = getTodayKey();
  if (!player.dailyChallenges || player.dailyChallenges.date !== todayKey) {
    getPlayerChallenges(player); // init
  }
  const dc = player.dailyChallenges;
  const challenges = getTodaysChallenges();
  const completed = [];
  for (const c of challenges) {
    if (c.type !== type) continue;
    const prog = dc.progress[c.id];
    if (!prog || prog.completed) continue;
    prog.count = (prog.count || 0) + count;
    if (prog.count >= c.target) {
      prog.count = c.target;
      prog.completed = true;
      completed.push(c.id);
    }
  }
  return completed;
}

// Claim reward for a completed challenge
function claimChallenge(player, challengeId) {
  const c = CHALLENGE_POOL.find(x => x.id === challengeId);
  if (!c) return { success: false, reason: 'Unknown challenge' };
  const dc = getPlayerChallenges(player);
  const prog = dc.progress[c.id];
  if (!prog?.completed) return { success: false, reason: 'Not completed yet' };
  if (prog.claimed)    return { success: false, reason: 'Already claimed' };
  prog.claimed = true;
  player.gold = (player.gold||0) + c.rewards.gold;
  player.manaCrystals = (player.manaCrystals||0) + c.rewards.crystals;
  return { success: true, challenge: c };
}

module.exports = { getTodaysChallenges, getPlayerChallenges, trackProgress, claimChallenge, CHALLENGE_POOL };
