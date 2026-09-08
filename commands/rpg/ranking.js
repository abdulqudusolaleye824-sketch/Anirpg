// /ranking — Show the calling player's rank across all categories at once
module.exports = {
  name: 'ranking',
  aliases: ['myrank', 'rank'],
  description: '📊 See your position across all leaderboard categories',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const me = db.users[sender];
    if (!me) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });

    const players = Object.values(db.users).filter(p => p?.name && p.level);
    const myId = sender;

    const rankIn = (sortFn) => {
      const sorted = players.slice().sort(sortFn);
      const idx = sorted.findIndex(p => {
        const uid = Object.keys(db.users).find(id => db.users[id] === p);
        return uid === myId;
      });
      return { rank: idx + 1, total: sorted.length };
    };

    const lvl   = rankIn((a,b) => b.level - a.level || b.xp - a.xp);
    const elo   = rankIn((a,b) => (b.pvpElo||1000) - (a.pvpElo||1000));
    const Nexus  = rankIn((a,b) => (b.gold||0) - (a.gold||0));
    const gates = rankIn((a,b) => (b.dungeon?.gatesCleared||0) - (a.dungeon?.gatesCleared||0));
    const boss  = rankIn((a,b) => (b.bossesDefeated||0) - (a.bossesDefeated||0));

    const fmt = (r) => `#${r.rank} of ${r.total}`;
    const bar = (r) => {
      const pct = Math.max(0, Math.min(10, Math.round(((r.total - r.rank) / r.total) * 10)));
      return '█'.repeat(pct) + '░'.repeat(10 - pct);
    };

    const cls = me.class?.name || me.class || '?';
    const pvpWins = me.pvpWins || 0;
    const pvpLosses = me.pvpLosses || 0;

    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 *${me.name}'s RANKING*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 ${cls} | Lv.${me.level} | ELO ${me.pvpElo||1000}\n\n` +
        `⭐ *Level:*   [${bar(lvl)}] ${fmt(lvl)}\n` +
        `⚔️ *PvP ELO:* [${bar(elo)}] ${fmt(elo)} (${pvpWins}W/${pvpLosses}L)\n` +
        `💠 *Wealth:*  [${bar(gold)}] ${fmt(gold)}\n` +
        `🏰 *Gates:*   [${bar(gates)}] ${fmt(gates)}\n` +
        `👹 *Bosses:*  [${bar(boss)}] ${fmt(boss)}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 /top — see who's #1 | /leaderboard — full list`
    }, { quoted: msg });
  }
};
