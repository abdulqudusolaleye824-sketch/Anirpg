// /top — instant leaderboard snapshot (all 5 categories)
module.exports = {
  name: 'top',
  aliases: ['rankings'],
  description: '🏆 Quick top 5 across all leaderboard categories',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!db.users[sender]) return sock.sendMessage(chatId, { text: '❌ Not registered!' }, { quoted: msg });

    const players = Object.values(db.users).filter(p => p?.name && p.level);

    const top = (sortFn, n = 3) => players.slice().sort(sortFn).slice(0, n);
    const medal = i => ['🥇','🥈','🥉'][i] || `${i+1}.`;

    const lvlTop  = top((a,b) => b.level - a.level);
    const eloTop  = top((a,b) => (b.pvpElo||1000) - (a.pvpElo||1000));
    const goldTop = top((a,b) => (b.gold||0) - (a.gold||0));
    const gateTop = top((a,b) => (b.dungeon?.gatesCleared||0) - (a.dungeon?.gatesCleared||0));

    const fmt = (list, fn) => list.map((p,i) => `${medal(i)} ${p.name} — ${fn(p)}`).join('\n') || '—';

    // Find sender rank
    const myLvlRank  = players.slice().sort((a,b) => b.level-a.level).findIndex(p=>p.name===db.users[sender].name)+1;
    const myEloRank  = players.slice().sort((a,b)=>(b.pvpElo||1000)-(a.pvpElo||1000)).findIndex(p=>p.name===db.users[sender].name)+1;

    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 *ANI R.P.G TOP HUNTERS*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⭐ *LEVEL*\n${fmt(lvlTop, p => `Lv.${p.level}`)}\n\n` +
        `⚔️ *PVP ELO*\n${fmt(eloTop, p => `${p.pvpElo||1000} ELO (${p.pvpWins||0}W)`)}\n\n` +
        `💠 *WEALTH*\n${fmt(goldTop, p => `${(p.gold||0).toLocaleString()} 💠`)}\n\n` +
        `🏰 *GATES CLEARED*\n${fmt(gateTop, p => `${p.dungeon?.gatesCleared||0} gates`)}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 Your rank: #${myLvlRank} level | #${myEloRank} ELO\n` +
        `💡 /leaderboard [level/pvp/gate/boss/wealth] — full list`
    }, { quoted: msg });
  }
};
