// /weekly — Weekly challenge system (harder than daily, better rewards)
// Resets Monday WAT (West Africa Time = UTC+1). Progress tracked per player.

const { nowWAT, formatDuration } = require('../../rpg/utils/NigerianTime');
const { weekKey: timeWeekKey, isValidTz } = require('../../rpg/utils/TimeUtil');

const WEEKLY_POOL = [
  { id:'pvp_5',    type:'pvp_win',        target:5,  desc:'Win 5 PvP battles',           emoji:'⚔️', rewards:{ gold:25000, crystals:50 } },
  { id:'pvp_10',   type:'pvp_win',        target:10, desc:'Win 10 PvP battles',           emoji:'⚔️', rewards:{ gold:60000, crystals:120 } },
  { id:'dung_3',   type:'dungeon_clear',  target:3,  desc:'Full-clear 3 dungeons',        emoji:'🏰', rewards:{ gold:40000, crystals:80, ticket:1 } },
  { id:'boss_3',   type:'boss_kill',      target:3,  desc:'Defeat 3 World Bosses',        emoji:'👹', rewards:{ gold:80000, crystals:150, ticket:1 } },
  { id:'streak_5', type:'daily_streak',   target:5,  desc:'Claim daily 5 days in a row',  emoji:'🔥', rewards:{ gold:30000, crystals:70 } },
  { id:'summon_20',type:'summon_pull',    target:20, desc:'Do 20 summon pulls',            emoji:'🎲', rewards:{ gold:30000, crystals:0, ticket:1 } },
  { id:'pvp_s',    type:'pvp_streak',     target:3,  desc:'Win 3 PvP battles in a row',   emoji:'🔥', rewards:{ gold:50000, crystals:100, ticket:1 } },
  { id:'gold_1m',  type:'earn_gold',      target:1000000, desc:'Earn 1M Nexus this week',  emoji:'💰', rewards:{ gold:100000, crystals:100 } },
];

// Seed by year+week number in the player's timezone (default Africa/Lagos).
// Timezone-aware so weekly resets hit Monday-local for international players.
function getWeekKey(tz) {
  return timeWeekKey(isValidTz(tz) || undefined);
}
function playerTz(player) { return isValidTz(player?.timezone) || null; }

function getThisWeeksChallenges() {
  const key = getWeekKey();
  let seed = 0;
  for (const c of key) seed = (seed * 31 + c.charCodeAt(0)) & 0xffffffff;
  const arr = [...WEEKLY_POOL];
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(seed) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 3);
}

function getPlayerWeekly(player) {
  const key = getWeekKey(playerTz(player) || undefined);
  if (!player.weeklyChallenges || player.weeklyChallenges.week !== key) {
    player.weeklyChallenges = { week: key, progress: {}, claimed: [] };
  }
  return player.weeklyChallenges;
}

function trackWeeklyProgress(player, type, count = 1) {
  const wc = getPlayerWeekly(player);
  const challenges = getThisWeeksChallenges();
  const completed = [];
  for (const c of challenges) {
    if (c.type !== type) continue;
    if (!wc.progress[c.id]) wc.progress[c.id] = 0;
    if (wc.progress[c.id] >= c.target) continue;
    wc.progress[c.id] = Math.min(c.target, wc.progress[c.id] + count);
    if (wc.progress[c.id] >= c.target) completed.push(c.id);
  }
  return completed;
}

// Expose for other modules
module.exports = {
  name: 'weekly',
  aliases: ['week', 'weekchallenges'],
  description: '📋 Weekly challenges — harder tasks, bigger rewards',
  trackWeeklyProgress, getPlayerWeekly, getThisWeeksChallenges,

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered!' }, { quoted: msg });

    const sub = (args[0] || '').toLowerCase();
    const wc  = getPlayerWeekly(player);
    const challenges = getThisWeeksChallenges();

    // ── /weekly claim ──────────────────────────────────────────
    if (sub === 'claim') {
      let claimed = 0, totalNexus = 0, totalCrystals = 0, totalTickets = 0;
      for (const c of challenges) {
        const prog = wc.progress[c.id] || 0;
        if (prog < c.target) continue;
        if (wc.claimed.includes(c.id)) continue;
        wc.claimed.push(c.id);
        player.gold = (player.gold||0) + c.rewards.gold;
        player.manaCrystals = (player.manaCrystals||0) + c.rewards.crystals;
        if (c.rewards.ticket) player.summonTickets = (player.summonTickets||0) + c.rewards.ticket;
        totalNexus += c.rewards.gold; totalCrystals += c.rewards.crystals;
        if (c.rewards.ticket) totalTickets += c.rewards.ticket;
        claimed++;
      }
      if (!claimed) return sock.sendMessage(chatId, { text: '❌ No completed weekly challenges to claim!' }, { quoted: msg });
      saveDatabase();
      let rewardMsg = `💠 +${totalNexus.toLocaleString()}g\n💎 +${totalCrystals}`;
      if (totalTickets) rewardMsg += `\n🎟️ +${totalTickets} Summon Ticket(s)`;
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏆 *WEEKLY REWARDS CLAIMED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ ${claimed} challenge(s) claimed!\n\n${rewardMsg}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── /weekly (show) ─────────────────────────────────────────
    // Days until reset (Monday WAT)
    const now = nowWAT();
    const day = now.getUTCDay(); // 0=Sun, 1=Mon
    const daysLeft = day === 1 ? 7 : ((8 - day) % 7) || 7;

    let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *WEEKLY CHALLENGES*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⏰ Resets in: *${daysLeft} day(s)*\n\n`;
    for (const c of challenges) {
      const prog   = wc.progress[c.id] || 0;
      const done   = prog >= c.target;
      const claimd = wc.claimed.includes(c.id);
      const icon   = claimd ? '✅' : done ? '🎁' : '⬜';
      const barFill = Math.min(10, Math.floor((prog/c.target)*10));
      const bar     = '█'.repeat(barFill) + '░'.repeat(10-barFill);
      txt += `${icon} ${c.emoji} *${c.desc}*\n`;
      txt += `   [${bar}] ${Math.min(prog,c.target)}/${c.target}\n`;
      txt += `   💠 ${c.rewards.gold.toLocaleString()} 💠  💎 ${c.rewards.crystals}${c.rewards.ticket?`  🎟️×${c.rewards.ticket}`:''}\n\n`;
    }
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/weekly claim — collect completed`;
    return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
  }
};