// ═══════════════════════════════════════════════════════════════
// GUILD WAR SYSTEM — 48-Hour Battle for Glory
// ═══════════════════════════════════════════════════════════════

'use strict';

const WAR_DURATION       = 48 * 60 * 60 * 1000; // 48 hours
const WAR_PRIZE_GOLD     = 50000; // Nexus per member
const WAR_PRIZE_CRYSTALS = 2500;  // Mana Stones per member

function normaliseJid(jid) {
  if (!jid) return '';
  const raw = String(jid).split('@')[0].split(':')[0].toLowerCase();
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.length > 0 ? digits : raw;
}

function getWars(db) {
  if (!db.guildWars) db.guildWars = {};
  return db.guildWars;
}

function getGuild(db, name) {
  if (!db.guilds) return null;
  const searchName = String(name || '').toLowerCase();
  return Object.values(db.guilds).find(g => g.name?.toLowerCase() === searchName) || null;
}

function getPlayerGuild(db, playerId) {
  if (!db.guilds) return null;
  const pNum = normaliseJid(playerId);
  if (!pNum) return null;
  return Object.values(db.guilds).find(g =>
    g.members && g.members.some(m => {
      const id = typeof m === 'object' ? m.id : m;
      return normaliseJid(id) === pNum;
    })
  ) || null;
}

function isWarActive(war) {
  return war && war.status === 'active' && Date.now() < war.endTime;
}

function warKey(g1, g2) {
  return [g1, g2].sort().join('__vs__');
}

function calcWarScore(war, guildName) {
  const side = war.guilds[0] === guildName ? 'side1' : 'side2';
  return Object.values(war.scores[side] || {}).reduce((s, v) => s + v, 0);
}

module.exports = {
  name: 'guildwar',
  aliases: ['gw', 'war'],
  description: '⚔️ Declare war on another guild! 48-hour battle for glory.',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const player = db.users?.[sender];

    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

    // Check for expired wars
    module.exports.resolveExpiredWars(db, saveDatabase);

    const wars    = getWars(db);
    const myGuild = getPlayerGuild(db, sender);
    const sub     = (args[0] || 'help').toLowerCase();

    // ── HELP / MENU ──────────────────────────────────────────────
    if (sub === 'help' || !args[0]) {
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `⚔️ *GUILD WAR SYSTEM*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Declare war on a rival guild!`,
          `War lasts 48 hours. Earn War Points by:`,
          `• 🏰 Dungeon floors cleared (+1 WP/floor)`,
          `• ⚔️ PvP wins (+5 WP/win)`,
          `• 👹 Gate Boss kills (+10 WP/kill)`,
          `• 🌍 World Boss kills (+50 WP/kill)`,
          ``,
          `🏆 *WINNING GUILD REWARDS:*`,
          `• 💠 ${WAR_PRIZE_GOLD.toLocaleString()} Nexus per member`,
          `• 💎 ${WAR_PRIZE_CRYSTALS.toLocaleString()} Mana Stones per member`,
          `• 🏰 100,000 Nexus + 5,000 Mana Stones to Guild Treasury`,
          `• 🎖️ *"War Veteran"* exclusive title`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📌 *COMMANDS:*`,
          `/guildwar declare [guild name] — Declare war`,
          `/guildwar status               — View current war status`,
          `/guildwar score                — Member scoreboard`,
          `/guildwar history              — View past war history`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── DECLARE / CHALLENGE ──────────────────────────────────────
    if (sub === 'declare' || sub === 'challenge') {
      if (!myGuild) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a guild!\nUse /guild create or /guild join to belong to a guild.' }, { quoted: msg });
      }

      const sNum = normaliseJid(sender);
      const isGM = normaliseJid(myGuild.leader) === sNum;
      const isVice = (myGuild.officers || []).some(o => normaliseJid(o) === sNum);

      if (!isGM && !isVice) {
        return sock.sendMessage(chatId, { text: '❌ Only the Guildmaster or Vice Guildmaster can declare war!' }, { quoted: msg });
      }

      const targetName = args.slice(1).join(' ').trim();
      if (!targetName) {
        return sock.sendMessage(chatId, { text: '❌ Usage: /guildwar declare <guild name>\nExample: /guildwar declare Shadows' }, { quoted: msg });
      }

      const targetGuild = getGuild(db, targetName);
      if (!targetGuild) {
        return sock.sendMessage(chatId, { text: `❌ Guild "*${targetName}*" not found!\nUse /guild list to view all registered guilds.` }, { quoted: msg });
      }

      if (targetGuild.name.toLowerCase() === myGuild.name.toLowerCase()) {
        return sock.sendMessage(chatId, { text: '❌ You cannot declare war on your own guild!' }, { quoted: msg });
      }

      // Check if my guild is already in an active war
      const myActiveWar = Object.values(wars).find(w => w.guilds.includes(myGuild.name) && isWarActive(w));
      if (myActiveWar) {
        const rival = myActiveWar.guilds.find(g => g !== myGuild.name);
        return sock.sendMessage(chatId, {
          text: `⚔️ *${myGuild.name}* is already at war with *${rival}*!\nUse /guildwar status to view current score.`
        }, { quoted: msg });
      }

      // Check if target guild is already in an active war
      const targetActiveWar = Object.values(wars).find(w => w.guilds.includes(targetGuild.name) && isWarActive(w));
      if (targetActiveWar) {
        return sock.sendMessage(chatId, {
          text: `⚔️ *${targetGuild.name}* is already engaged in another war right now!`
        }, { quoted: msg });
      }

      const key = warKey(myGuild.name, targetGuild.name);

      wars[key] = {
        id: key,
        guilds: [myGuild.name, targetGuild.name],
        status: 'active',
        startTime: Date.now(),
        endTime:   Date.now() + WAR_DURATION,
        scores: {
          side1: {},
          side2: {},
        },
        declared_by: player.name || sender.split('@')[0],
      };

      saveDatabase();

      const endTime = new Date(Date.now() + WAR_DURATION);

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `⚔️ *GUILD WAR DECLARED!*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🏴 *${myGuild.name.toUpperCase()}*`,
          `         ⚔️ VS ⚔️`,
          `🏴 *${targetGuild.name.toUpperCase()}*`,
          ``,
          `⏰ Duration: *48 hours*`,
          `📅 Ends: *${endTime.toUTCString().replace(' GMT', ' WAT')}*`,
          ``,
          `💡 *EARN WAR POINTS (WP):*`,
          `🏰 Dungeon Floors → +1 WP`,
          `⚔️ PvP Wins → +5 WP`,
          `👹 Gate Boss Kills → +10 WP`,
          `🌍 World Boss Kills → +50 WP`,
          ``,
          `🏆 *WINNER REWARDS:*`,
          `• 💠 ${WAR_PRIZE_GOLD.toLocaleString()} Nexus / member`,
          `• 💎 ${WAR_PRIZE_CRYSTALS.toLocaleString()} Mana Stones / member`,
          `• 🏰 Guild Treasury Bonus`,
          `• 🎖️ "War Veteran" Title`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🔥 *FIGHT FOR YOUR GUILD GLORY!* ⚔️`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── STATUS ───────────────────────────────────────────────────
    if (sub === 'status') {
      if (!myGuild) {
        return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });
      }

      const myWar = Object.values(wars).find(w => w.guilds.includes(myGuild.name) && isWarActive(w));
      if (!myWar) {
        return sock.sendMessage(chatId, { text: `😴 *${myGuild.name}* is not currently at war.\n\nDeclare war with /guildwar declare [guild name]!` }, { quoted: msg });
      }

      const g1  = myWar.guilds[0];
      const g2  = myWar.guilds[1];
      const s1  = calcWarScore(myWar, g1);
      const s2  = calcWarScore(myWar, g2);
      const rem = Math.max(0, myWar.endTime - Date.now());
      const hrs = Math.floor(rem / 3600000);
      const min = Math.floor((rem % 3600000) / 60000);
      const lead = s1 > s2 ? g1 : s2 > s1 ? g2 : 'TIED';

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `⚔️ *WAR STATUS*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `⏰ Time Remaining: *${hrs}h ${min}m*`,
          ``,
          `🏴 *${g1}*`,
          `   ⚔️ *${s1.toLocaleString()} War Points*`,
          ``,
          `🏴 *${g2}*`,
          `   ⚔️ *${s2.toLocaleString()} War Points*`,
          ``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          lead === 'TIED' ? `🤝 *TIED BATTLE!* Fight harder!` : `🏆 *${lead}* is leading!`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📌 Run */guildwar score* for member score breakdown`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── SCOREBOARD ───────────────────────────────────────────────
    if (sub === 'score' || sub === 'scores' || sub === 'board') {
      if (!myGuild) return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });

      const myWar = Object.values(wars).find(w => w.guilds.includes(myGuild.name) && isWarActive(w));
      if (!myWar) return sock.sendMessage(chatId, { text: '❌ Your guild is not currently in an active war.' }, { quoted: msg });

      const side   = myWar.guilds[0] === myGuild.name ? 'side1' : 'side2';
      const scores = myWar.scores[side] || {};

      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ *${myGuild.name.toUpperCase()} MEMBER WAR SCORES*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      const sorted = Object.entries(scores).sort((a,b) => b[1] - a[1]);

      if (sorted.length === 0) {
        txt += '😴 No War Points earned yet!\nClear dungeons, win PvP battles, and kill bosses to earn WP!\n';
      } else {
        sorted.forEach(([pid, pts], i) => {
          const p = db.users?.[pid];
          txt += `${i+1}. *${p?.name || pid.split('@')[0]}* — *${pts} WP*\n`;
        });
      }

      const totalWP = sorted.reduce((s, [, v]) => s + v, 0);
      txt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏰 Total Guild Score: *${totalWP.toLocaleString()} WP*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── HISTORY ──────────────────────────────────────────────────
    if (sub === 'history') {
      const past = Object.values(wars).filter(w => w.status === 'completed').slice(-5).reverse();
      if (past.length === 0) {
        return sock.sendMessage(chatId, { text: '📜 No completed guild wars recorded yet.' }, { quoted: msg });
      }

      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📜 *PAST GUILD WAR HISTORY*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      past.forEach((w, i) => {
        const s1 = calcWarScore(w, w.guilds[0]);
        const s2 = calcWarScore(w, w.guilds[1]);
        const winner = w.winner || (s1 > s2 ? w.guilds[0] : s2 > s1 ? w.guilds[1] : 'TIED');
        const date = new Date(w.startTime).toLocaleDateString();
        txt += `${i+1}. ⚔️ *${w.guilds[0]}* (${s1} WP) vs *${w.guilds[1]}* (${s2} WP)\n   🏆 Winner: *${winner}* | Date: ${date}\n\n`;
      });

      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    return sock.sendMessage(chatId, { text: '❌ Unknown subcommand. Usage: /guildwar [declare|status|score|history]' }, { quoted: msg });
  }
};

// ── EXPORTED HELPERS — Called by combat/dungeon systems to award War Points ──
module.exports.addWarPoints = function(db, playerId, points, saveDatabase) {
  try {
    if (!db || !db.guildWars || !playerId || !points) return;
    const playerGuild = getPlayerGuild(db, playerId);
    if (!playerGuild) return;

    const wars = getWars(db);
    const war = Object.values(wars).find(w =>
      w.guilds.includes(playerGuild.name) && w.status === 'active' && Date.now() < w.endTime
    );
    if (!war) return;

    const side = war.guilds[0] === playerGuild.name ? 'side1' : 'side2';
    if (!war.scores[side]) war.scores[side] = {};
    war.scores[side][playerId] = (war.scores[side][playerId] || 0) + points;

    if (Date.now() >= war.endTime) {
      resolveWar(war, db, saveDatabase);
    } else if (saveDatabase) {
      saveDatabase();
    }
  } catch(e) {}
};

function resolveWar(war, db, saveDatabase) {
  if (war.status !== 'active') return;
  war.status = 'completed';

  const s1 = Object.values(war.scores.side1 || {}).reduce((s,v)=>s+v,0);
  const s2 = Object.values(war.scores.side2 || {}).reduce((s,v)=>s+v,0);
  const winnerName = s1 > s2 ? war.guilds[0] : s2 > s1 ? war.guilds[1] : war.guilds[0];
  const winnerGuild = getGuild(db, winnerName);

  if (winnerGuild) {
    // Member rewards
    (winnerGuild.members || []).forEach(m => {
      const pid = typeof m === 'object' ? m.id : m;
      const p = db.users?.[pid];
      if (!p) return;
      p.gold         = (p.gold         || 0) + WAR_PRIZE_GOLD;
      p.manaCrystals = (p.manaCrystals || 0) + WAR_PRIZE_CRYSTALS;
      if (!p.titles) p.titles = [];
      if (!p.titles.includes('War Veteran')) p.titles.push('War Veteran');
    });

    // Treasury bonus
    winnerGuild.treasury = (winnerGuild.treasury || 0) + 100000;
    winnerGuild.manaTreasury = (winnerGuild.manaTreasury || 0) + 5000;
    winnerGuild.wins = (winnerGuild.wins || 0) + 1;
  }

  war.winner = winnerName;
  if (saveDatabase) saveDatabase();
}

module.exports.resolveExpiredWars = function(db, saveDatabase) {
  if (!db?.guildWars) return;
  Object.values(db.guildWars).forEach(war => {
    if (war.status === 'active' && Date.now() >= war.endTime) {
      resolveWar(war, db, saveDatabase);
    }
  });
};
