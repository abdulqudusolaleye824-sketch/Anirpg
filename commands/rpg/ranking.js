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
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(me);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

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
    const bar = (r) => UI.bar(r.total - r.rank, r.total, 10, pro);

    const cls = me.class?.name || me.class || '?';
    const pvpWins = me.pvpWins || 0;
    const pvpLosses = me.pvpLosses || 0;

    return sock.sendMessage(chatId, {
      text: (pro ? `${UI.PRO_BAR}\n📊 *${me.name}'s RANKING* 💎\n${UI.PRO_BAR}\n` : `📊 *${me.name}'s RANKING*\n${UI.FREE_BAR}\n`) + `👤 ${cls} | Lv.${me.level} | ELO ${me.pvpElo||1000}\n\n` +
        `⭐ *Level:*   [${bar(lvl)}] ${fmt(lvl)}\n` +
        `⚔️ *PvP ELO:* [${bar(elo)}] ${fmt(elo)} (${pvpWins}W/${pvpLosses}L)\n` +
        `💠 *Wealth:*  [${bar(Nexus)}] ${fmt(Nexus)}\n` +
        `🏰 *Gates:*   [${bar(gates)}] ${fmt(gates)}\n` +
        `👹 *Bosses:*  [${bar(boss)}] ${fmt(boss)}\n\n` +
        `${FRAME}\n` +
        `💡 /top — see who's #1 | /leaderboard — full list` +
        (() => {
          if (!pro) return `\n${UI.upsell()}`;
          const cats = [['Level', lvl], ['PvP', elo], ['Wealth', Nexus], ['Gates', gates], ['Bosses', boss]];
          cats.sort((a, b) => a[1].rank - b[1].rank);
          return `\n${UI.PRO_MINI}\n💎 *PRO CLIMB* — best: #${cats[0][1].rank} ${cats[0][0]}`;
        })()
    }, { quoted: msg });
  }
};
