// guildwar.js — Guild War System
// Guilds declare war on each other. War lasts 48 hours.
// Members earn WAR POINTS by doing dungeons, PvP, boss kills.
// Winning guild gets gold bonus + exclusive title.

const SeasonManager = require('../../rpg/utils/SeasonManager');

// Active wars stored in memory (also persisted to db.guildWars)
// db.guildWars = { warId: { ... } }

function getWars(db) {
  if (!db.guildWars) db.guildWars = {};
  return db.guildWars;
}

function getGuild(db, name) {
  if (!db.guilds) return null;
  return Object.values(db.guilds).find(g => g.name?.toLowerCase() === name?.toLowerCase()) || null;
}

function getPlayerGuild(db, playerId) {
  if (!db.guilds) return null;
  return Object.values(db.guilds).find(g => g.members?.includes(playerId)) || null;
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

const WAR_DURATION = 48 * 60 * 60 * 1000; // 48 hours
module.exports = {
  name: 'guildwar',
  aliases: ['gw', 'war'],
  description: 'Declare war on another guild! 48-hour battle for glory.',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const player = db.users[sender];

    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! /register' }, { quoted: msg });

    const wars  = getWars(db);
    const myGuild = getPlayerGuild(db, sender);
    const sub   = args[0]?.toLowerCase();

    // ── HELP / STATUS ──────────────────────────────────────
    if (!sub || sub === 'help') {
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ *GUILD WAR SYSTEM*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nDeclare war on a rival guild!\nWar lasts 48 hours. Earn War Points by:\n• 🏰 Dungeon floors cleared (+1 per floor)\n• ⚔️ PvP wins (+5 per win)\n• 👹 Boss kills (+10 per boss)\n• 🌍 World Boss kills (+50)\n\nWinning guild gets:\n💠 ${WAR_PRIZE_GOLD.toLocaleString()} Nexus per member\n💎 ${WAR_PRIZE_CRYSTALS} Mana Stones per member\n🏆 *WAR VETERAN* title\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/guildwar declare [guild name] — Declare war\n/guildwar status               — Current war status\n/guildwar score                — War scoreboard\n/guildwar history              — Past wars\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── DECLARE ────────────────────────────────────────────
    if (sub === 'declare' || sub === 'challenge') {
      if (!myGuild) return sock.sendMessage(chatId, { text: '❌ You are not in a guild!\n/guild create to start one.' }, { quoted: msg });
      if (myGuild.leader !== sender) return sock.sendMessage(chatId, { text: '❌ Only the guild leader can declare war!' }, { quoted: msg });

      const targetName = args.slice(1).join(' ');
      if (!targetName) return sock.sendMessage(chatId, { text: '❌ Usage: /guildwar declare [guild name]' }, { quoted: msg });

      const targetGuild = getGuild(db, targetName);
      if (!targetGuild) return sock.sendMessage(chatId, { text: `❌ Guild "*${targetName}*" not found!\n/guild list to see all guilds.` }, { quoted: msg });
      if (targetGuild.name === myGuild.name) return sock.sendMessage(chatId, { text: '❌ You cannot declare war on your own guild!' }, { quoted: msg });

      const key = warKey(myGuild.name, targetGuild.name);
      const existing = wars[key];
      if (existing && isWarActive(existing)) return sock.sendMessage(chatId, { text: `⚔️ You are already at war with *${targetGuild.name}*!\n/guildwar status to see the score.` }, { quoted: msg });

      // Start the war
      wars[key] = {
        id: key,
        guilds: [myGuild.name, targetGuild.name],
        status: 'active',
        startTime: Date.now(),
        endTime:   Date.now() + WAR_DURATION,
        scores: {
          side1: {}, // guildName1 member scores
          side2: {}, // guildName2 member scores
        },
        declared_by: player.name,
      };

      saveDatabase();

      const endTime = new Date(Date.now() + WAR_DURATION);
      const endStr  = `${endTime.getHours()}:${String(endTime.getMinutes()).padStart(2,'0')}`;

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ *WAR DECLARED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🏴 *${myGuild.name}*\n         ⚔️ VS ⚔️\n🏴 *${targetGuild.name}*\n\n⏰ War ends in *48 hours*\n\n💡 *Earn War Points by:*\n🏰 Dungeon floors → +1 WP/floor\n⚔️ PvP wins → +5 WP\n👹 Boss kills → +10 WP\n🌍 World Boss → +50 WP\n\n🏆 *Winner gets:*\n💠 ${WAR_PRIZE_GOLD.toLocaleString()} Nexus per member\n💎 ${WAR_PRIZE_CRYSTALS} Mana Stones per member\n🎖️ "War Veteran" title\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*FIGHT FOR YOUR GUILD!* ⚔️`,
        mentions: []
      }, { quoted: msg });
    }

    // ── STATUS ─────────────────────────────────────────────
    if (sub === 'status') {
      if (!myGuild) return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });

      const myWar = Object.values(wars).find(w =>
        w.guilds.includes(myGuild.name) && isWarActive(w)
      );

      if (!myWar) return sock.sendMessage(chatId, { text: `😴 *${myGuild.name}* is not at war.\n\n/guildwar declare [guild name] to start one!` }, { quoted: msg });

      const g1  = myWar.guilds[0], g2 = myWar.guilds[1];
      const s1  = calcWarScore(myWar, g1);
      const s2  = calcWarScore(myWar, g2);
      const rem = myWar.endTime - Date.now();
      const hrs = Math.floor(rem / 3600000);
      const min = Math.floor((rem % 3600000) / 60000);
      const lead = s1 > s2 ? g1 : s2 > s1 ? g2 : 'TIED';

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ *WAR STATUS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⏰ Time left: *${hrs}h ${min}m*\n\n🏴 *${g1}*\n   ⚔️ ${s1.toLocaleString()} War Points\n\n🏴 *${g2}*\n   ⚔️ ${s2.toLocaleString()} War Points\n\n${lead === 'TIED' ? '🤝 *TIED!* — fight harder!' : `🏆 *${lead}* is leading!`}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/guildwar score — per-member breakdown`
      }, { quoted: msg });
    }

    // ── SCORE ──────────────────────────────────────────────
    if (sub === 'score') {
      if (!myGuild) return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });
      const myWar = Object.values(wars).find(w => w.guilds.includes(myGuild.name) && isWarActive(w));
      if (!myWar) return sock.sendMessage(chatId, { text: '❌ No active war!' }, { quoted: msg });

      const side  = myWar.guilds[0] === myGuild.name ? 'side1' : 'side2';
      const scores = myWar.scores[side] || {};

      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ *${myGuild.name} WAR SCORES*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      const sorted = Object.entries(scores).sort((a,b) => b[1] - a[1]);
      if (sorted.length === 0) {
        txt += '😴 No War Points earned yet!\nDo dungeons, PvP, and boss fights!';
      } else {
        sorted.forEach(([pid, pts], i) => {
          const p = db.users[pid];
          txt += `${i+1}. *${p?.name || 'Unknown'}* — ${pts} WP\n`;
        });
      }
      txt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTotal: *${sorted.reduce((s,[,v])=>s+v,0)} WP*`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── HISTORY ────────────────────────────────────────────
    if (sub === 'history') {
      const past = Object.values(wars).filter(w => w.status === 'completed').slice(-5).reverse();
      if (past.length === 0) return sock.sendMessage(chatId, { text: '📜 No past wars recorded yet.' }, { quoted: msg });

      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📜 *WAR HISTORY*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      past.forEach(w => {
        const s1 = calcWarScore(w, w.guilds[0]);
        const s2 = calcWarScore(w, w.guilds[1]);
        const winner = s1 > s2 ? w.guilds[0] : w.guilds[1];
        const date = new Date(w.startTime).toLocaleDateString();
        txt += `⚔️ *${w.guilds[0]}* vs *${w.guilds[1]}*\n   🏆 Winner: ${winner} | ${date}\n\n`;
      });
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    return sock.sendMessage(chatId, { text: '❌ Unknown subcommand. /guildwar help' }, { quoted: msg });
  }
};

// ── EXPORTED HELPERS — called from other commands to add war points ──
module.exports.addWarPoints = function(db, playerId, points, saveDatabase) {
  try {
    if (!db.guildWars) return;
    const playerGuild = Object.values(db.guilds || {}).find(g => g.members?.includes(playerId));
    if (!playerGuild) return;

    const war = Object.values(db.guildWars).find(w =>
      w.guilds.includes(playerGuild.name) && w.status === 'active' && Date.now() < w.endTime
    );
    if (!war) return;

    const side = war.guilds[0] === playerGuild.name ? 'side1' : 'side2';
    if (!war.scores[side]) war.scores[side] = {};
    war.scores[side][playerId] = (war.scores[side][playerId] || 0) + points;

    // Check if war ended
    if (Date.now() >= war.endTime) {
      resolveWar(war, db, saveDatabase);
    }
  } catch(e) {}
};

function resolveWar(war, db, saveDatabase) {
  if (war.status !== 'active') return;
  war.status = 'completed';

  const s1 = Object.values(war.scores.side1 || {}).reduce((s,v)=>s+v,0);
  const s2 = Object.values(war.scores.side2 || {}).reduce((s,v)=>s+v,0);
  const winnerName = s1 >= s2 ? war.guilds[0] : war.guilds[1];
  const winnerGuild = Object.values(db.guilds || {}).find(g => g.name === winnerName);

  if (winnerGuild) {
    (winnerGuild.members || []).forEach(pid => {
      const p = db.users[pid];
      if (!p) return;
      p.gold         = (p.gold         || 0) + WAR_PRIZE_GOLD;
      p.manaCrystals = (p.manaCrystals || 0) + WAR_PRIZE_CRYSTALS;
      if (!p.titles) p.titles = [];
      if (!p.titles.includes('War Veteran')) p.titles.push('War Veteran');
    });
  }

  war.winner = winnerName;
  if (saveDatabase) saveDatabase();
}

module.exports.resolveExpiredWars = function(db, saveDatabase) {
  if (!db.guildWars) return;
  Object.values(db.guildWars).forEach(war => {
    if (war.status === 'active' && Date.now() >= war.endTime) {
      resolveWar(war, db, saveDatabase);
    }
  });
};
