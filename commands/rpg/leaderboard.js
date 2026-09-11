module.exports = {
  name: 'leaderboard',
  description: 'View top hunters ranking',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: '❌ You are not registered!\nUse /register to start.'
      }, { quoted: msg });
    }
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const category = args[0]?.toLowerCase() || 'level';

    // ✅ FIX: Filter out null/undefined players
    let players = Object.values(db.users).filter(p => p && p.name && p.level);
    
    // ✅ FIX: Add userId to each player for mentions
    players = players.map(p => {
      const uid = Object.keys(db.users).find(id => db.users[id] === p);
      // #11: Include bank balance in wealth calculation
      let banked = 0;
      try {
        if (db.banks) {
          for (const bank of Object.values(db.banks)) {
            const acc = bank.accounts?.find(a => a.userId === uid);
            if (acc) { banked = acc.balance || 0; break; }
          }
        }
      } catch(e) {}
      return { ...p, userId: uid, _totalWealth: (p.gold || 0) + banked, _banked: banked };
    });

    let title, sortBy, formatter;

    switch (category) {
      case 'level':
        title = '⭐ TOP HUNTERS BY LEVEL';
        sortBy = (a, b) => b.level - a.level || b.xp - a.xp;
        formatter = (p, rank) => {
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
          return `${medal} ${rank}. ${p.name} - Lv.${p.level}`;
        };
        break;
      
      case 'dungeon':
      case 'gate':
        title = '🏰 TOP GATE CLEARERS';
        sortBy = (a, b) => (b.dungeon?.gatesCleared || 0) - (a.dungeon?.gatesCleared || 0);
        formatter = (p, rank) => {
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
          return `${medal} ${rank}. ${p.name} - ${p.dungeon?.gatesCleared || 0} gates`;
        };
        break;
      
      case 'boss':
        title = '👑 TOP BOSS SLAYERS';
        sortBy = (a, b) => (b.bossesDefeated || 0) - (a.bossesDefeated || 0);
        formatter = (p, rank) => {
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
          return `${medal} ${rank}. ${p.name} - ${p.bossesDefeated || 0} bosses`;
        };
        break;
      
      case 'wealth':
      case 'gold':
      case 'money':
        title = '💠 WEALTHIEST HUNTERS (wallet + bank)';
        sortBy = (a, b) => (b._totalWealth || 0) - (a._totalWealth || 0);
        formatter = (p, rank) => {
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
          const bankNote = p._banked > 0 ? ` (🏦 ${p._banked.toLocaleString()} banked)` : '';
          return `${medal} ${rank}. ${p.name} - ${(p._totalWealth || 0).toLocaleString()} 💠${bankNote}`;
        };
        break;
      
      case 'pvp':
      case 'elo':
      case 'rank': {
        title = '⚔️ TOP PVP FIGHTERS (ELO)';
        sortBy = (a, b) => (b.pvpElo || 1000) - (a.pvpElo || 1000);
        const pvpRankTiers = [
          { name:'Grandmaster', emoji:'👑', minElo:2000 },
          { name:'Master',      emoji:'🏆', minElo:1800 },
          { name:'Diamond',     emoji:'💎', minElo:1600 },
          { name:'Platinum',    emoji:'💠', minElo:1400 },
          { name:'Nexus',        emoji:'🥇', minElo:1200 },
          { name:'Silver',      emoji:'🥈', minElo:1000 },
          { name:'Bronze',      emoji:'🥉', minElo:800  },
          { name:'Unranked',    emoji:'⚪', minElo:0    },
        ];
        const getPvpTier = (elo) => pvpRankTiers.find(r => (elo||1000) >= r.minElo) || pvpRankTiers[pvpRankTiers.length-1];
        formatter = (p, rank) => {
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
          const tier = getPvpTier(p.pvpElo);
          const wins = p.pvpWins || 0;
          const losses = p.pvpLosses || 0;
          return `${medal} ${rank}. ${tier.emoji} *${p.name}* — ${p.pvpElo || 1000} ELO\n     ⚔️ ${wins}W / ${losses}L`;
        };
        break;
      }

      default:
        return sock.sendMessage(chatId, { 
          text: `❌ Invalid category!

📊 Available categories:
- level  — Top by level
- gate   — Most gates cleared
- boss   — Most bosses defeated
- wealth — Most Nexus
- pvp    — Top ELO fighters

Example: /leaderboard pvp`
        }, { quoted: msg });
    }

    players.sort(sortBy);
    const top10 = players.slice(0, 10);

    // Find player rank
    const playerRank = players.findIndex(p => p.userId === sender) + 1;

    let message = pro ? `${UI.PRO_BAR}\n🏆 ${title} 🏆 💎\n${UI.PRO_BAR}\n\n` : `🏆 ${title} 🏆\n${UI.FREE_BAR}\n\n`;

    if (top10.length === 0) {
      message += `No hunters found in this category!\n\n`;
    } else {
      top10.forEach((p, i) => {
        message += `${formatter(p, i + 1)}\n\n`;
      });
    }

    message += `${FRAME}\n`;
    
    if (playerRank > 0 && playerRank <= 10) {
      message += `🎉 You're in the top 10! (#${playerRank})\n`;
    } else if (playerRank > 10) {
      message += `📍 Your Rank: #${playerRank}\n`;
    }

    message += `${FRAME}
📊 OTHER CATEGORIES
${FRAME}
/leaderboard level
/leaderboard gate
/leaderboard boss
/leaderboard wealth
/leaderboard pvp
${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO STANDINGS* — #${playerRank} ${category}` : `\n${UI.upsell()}`);

    return sock.sendMessage(chatId, { 
      text: message
    }, { quoted: msg });
  }
};