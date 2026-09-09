const { updatePlayerNexus } = require('../../rpg/utils/NexusManager');
const { logTransaction } = require('../../rpg/utils/TransactionLog');
const DC = require('../../rpg/utils/DailyChallenges');

// Anti-spam: Per-game cooldowns (ms)
const lastPlayTime = new Map(); // key: `${sender}:${game}`
const GAME_COOLDOWNS = {
  slots:     30_000,  // 30 seconds
  slot:      30_000,
  blackjack: 15_000,  // 15 seconds
  bj:        15_000,
  roulette:  20_000,  // 20 seconds
  roul:      20_000,
  dice:      10_000,  // 10 seconds
};

// ✅ NEW: Store active casino sessions per group chat
const activeCasinoSessions = new Map();

module.exports = {
  name: 'casino',
  description: 'Try your luck at the casino!',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { 
        text: '❌ You are not registered!' 
      }, { quoted: msg });
    }

    const game = args[0]?.toLowerCase();
    const betAmount = parseInt(args[1]);

    // ============================================
    // ADMIN COMMAND: /casino open [minutes]
    // ============================================
    if (game === 'open') {
      const Mod = require('../../rpg/utils/ModerationUtils');
      if (!Mod.canModerate(db, sender)) {
        return sock.sendMessage(chatId, { 
          text: '❌ Only admins can open casino sessions!' 
        }, { quoted: msg });
      }

      // Check if already open
      if (activeCasinoSessions.has(chatId)) {
        const session = activeCasinoSessions.get(chatId);
        const remaining = Math.ceil((session.endTime - Date.now()) / 1000 / 60);
        return sock.sendMessage(chatId, { 
          text: `⚠️ Casino is already open!\n\n⏱️ Time remaining: ${remaining} minutes` 
        }, { quoted: msg });
      }

      const minutes = parseInt(args[1]) || 10; // Default 10 minutes
      
      if (minutes < 1 || minutes > 1440) { // Max 24 hours
        return sock.sendMessage(chatId, { 
          text: '❌ Duration must be between 1-1440 minutes (1 min - 24 hours)!' 
        }, { quoted: msg });
      }

      const endTime = Date.now() + (minutes * 60 * 1000);
      
      activeCasinoSessions.set(chatId, {
        startTime: Date.now(),
        endTime: endTime,
        duration: minutes,
        openedBy: player.name
      });

      // Auto-close after time expires
      setTimeout(() => {
        if (activeCasinoSessions.has(chatId)) {
          activeCasinoSessions.delete(chatId);
          sock.sendMessage(chatId, { 
            text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎰 CASINO CLOSED 🎰
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ Time's up! The casino has closed.

Thanks for playing! 🎲
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
          });
        }
      }, minutes * 60 * 1000);

      return sock.sendMessage(chatId, { 
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎰 CASINO NOW OPEN! 🎰
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Opened by: ${player.name}
⏱️ Duration: ${minutes} minutes

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 AVAILABLE GAMES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎰 /casino slots [bet]
🃏 /casino blackjack [bet]
🎡 /casino roulette [bet] [choice]
🎲 /casino dice [bet] [over/under] [#]

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Min bet: 50 Nexus
💠 Max bet: 30,000 Nexus
⏱️ Cooldown: 3 seconds

🎉 Good luck everyone! 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
      }, { quoted: msg });
    }

    // ============================================
    // ADMIN COMMAND: /casino close
    // ============================================
    if (game === 'close') {
      const Mod = require('../../rpg/utils/ModerationUtils');
      if (!Mod.canModerate(db, sender)) {
        return sock.sendMessage(chatId, { 
          text: '❌ Only admins can close casino sessions!' 
        }, { quoted: msg });
      }

      if (!activeCasinoSessions.has(chatId)) {
        return sock.sendMessage(chatId, { 
          text: '❌ Casino is not open in this chat!' 
        }, { quoted: msg });
      }

      activeCasinoSessions.delete(chatId);

      return sock.sendMessage(chatId, { 
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚪 CASINO CLOSED 🚪
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Closed by: ${player.name}

Thanks for playing! 🎲
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
      }, { quoted: msg });
    }

    // ============================================
    // ADMIN COMMAND: /casino status
    // ============================================
    if (game === 'status') {
      if (!activeCasinoSessions.has(chatId)) {
        return sock.sendMessage(chatId, { 
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎰 CASINO STATUS 🎰
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: 🔴 CLOSED

Admins can open with:
/casino open [minutes]
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
        }, { quoted: msg });
      }

      const session = activeCasinoSessions.get(chatId);
      const elapsed = Math.floor((Date.now() - session.startTime) / 1000 / 60);
      const remaining = Math.ceil((session.endTime - Date.now()) / 1000 / 60);

      return sock.sendMessage(chatId, { 
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎰 CASINO STATUS 🎰
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: 🟢 OPEN

Opened by: ${session.openedBy}
Duration: ${session.duration} minutes
Elapsed: ${elapsed} minutes
⏱️ Remaining: ${remaining} minutes

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Place your bets! 🎲
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
      }, { quoted: msg });
    }

    // ============================================
    // CHECK IF CASINO IS OPEN (For all games)
    // ============================================
    if (game && ['slots', 'slot', 'blackjack', 'bj', 'roulette', 'roul', 'dice'].includes(game)) {
      // Check if in group chat
      const isGroup = chatId.endsWith('@g.us');
      
      if (isGroup && !activeCasinoSessions.has(chatId)) {
        return sock.sendMessage(chatId, { 
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 CASINO CLOSED 🔒
━━━━━━━━━━━━━━━━━━━━━━━━━━━
The casino is not open in this group.

Admins can open with:
/casino open [minutes]

Example: /casino open 30
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
        }, { quoted: msg });
      }
    }

    // Initialize casino stats
    if (!player.casino) {
      player.casino = {
        totalWon: 0,
        totalLost: 0,
        gamesPlayed: 0,
        biggestWin: 0,
        jackpotsHit: 0
      };
    }

    // ============================================
    // MAIN CASINO MENU (No cooldown for viewing menu)
    // ============================================
    if (!game) {
      return sock.sendMessage(chatId, { 
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎰 ROYAL CASINO 🎰
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Your Nexus: ${player.gold || 0}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 GAMES AVAILABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ 🎰 SLOTS - Spin the reels!
   /casino slots [bet]
   💠 Payouts: 2x-500x
   🎯 Jackpot: 0.5% chance

2️⃣ 🃏 BLACKJACK - Beat the dealer!
   /casino blackjack [bet]
   💠 Win: 2x | Blackjack: 2.5x
   🎯 House edge: Low

3️⃣ 🎡 ROULETTE - Bet on numbers!
   /casino roulette [bet] [choice]
   💠 Payouts: 2x-36x
   🎯 Choices: red/black/odd/even/1-36

4️⃣ 🎲 DICE - Roll the dice!
   /casino dice [bet] [over/under] [number]
   💠 Payout: Based on odds
   🎯 Example: /casino dice 100 over 50
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 YOUR CASINO STATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 Games Played: ${player.casino.gamesPlayed}
💠 Total Won: ${player.casino.totalWon}
💸 Total Lost: ${player.casino.totalLost}
🏆 Biggest Win: ${player.casino.biggestWin}
💎 Jackpots Hit: ${player.casino.jackpotsHit}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Min bet: 50 Nexus
⚠️ Max bet: 30,000 Nexus
⏱️ Cooldowns: Slots 30s • Blackjack 15s • Roulette 20s • Dice 10s
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ============================================
    // ANTI-SPAM CHECK (Per-game cooldowns)
    // ============================================
    const now = Date.now();
    const isPro = !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > now);
    let cooldownMs = GAME_COOLDOWNS[game] || 10_000;
    if (isPro) cooldownMs = Math.floor(cooldownMs * 0.5);

    const cooldownKey = `${sender}:${game}`;
    const lastPlay = lastPlayTime.get(cooldownKey) || 0;
    const timeSinceLastPlay = now - lastPlay;

    if (timeSinceLastPlay < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - timeSinceLastPlay) / 1000);
      return sock.sendMessage(chatId, { 
        text: `⏱️ *${game.toUpperCase()}* cooldown!\nWait *${remaining}s* before playing again.${isPro ? ' (🌟 PRO 50% Reduced Cooldown)' : ''}` 
      }, { quoted: msg });
    }

    // Validate bet
    if (!betAmount || isNaN(betAmount) || betAmount < 50) {
      return sock.sendMessage(chatId, { 
        text: '❌ Minimum bet is 50 Nexus!' 
      }, { quoted: msg });
    }

    if (betAmount > 30000) {
      return sock.sendMessage(chatId, { 
        text: '❌ Maximum bet is 30,000 Nexus!' 
      }, { quoted: msg });
    }

    if ((player.gold || 0) < betAmount) {
      return sock.sendMessage(chatId, { 
        text: `❌ Not enough Nexus!\n\nYou have: ${player.gold || 0}\nNeed: ${betAmount}` 
      }, { quoted: msg });
    }

    // ============================================
    // UPDATE LAST PLAY TIME (After validation)
    // ============================================
    lastPlayTime.set(cooldownKey, now);

    // ============================================
    // GAME 1: SLOT MACHINE 🎰
    // ============================================
    if (game === 'slots' || game === 'slot') {
      const symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣', '⭐'];
      const weights = [30, 25, 20, 15, 8, 1.5, 0.4, 0.1]; // % chance
      
      // Weighted random selection
      function spinReel() {
        const rand = Math.random() * 100;
        let cumulative = 0;
        for (let i = 0; i < symbols.length; i++) {
          cumulative += weights[i];
          if (rand < cumulative) return symbols[i];
        }
        return symbols[0];
      }

      const reel1 = spinReel();
      const reel2 = spinReel();
      const reel3 = spinReel();

      let winAmount = 0;
      let message = '';
      let isJackpot = false;

      // Check for wins
      if (reel1 === reel2 && reel2 === reel3) {
        // ALL MATCH!
        const payouts = {
          '🍒': 2,
          '🍋': 3,
          '🍊': 5,
          '🍇': 8,
          '🔔': 15,
          '💎': 50,
          '7️⃣': 100,
          '⭐': 500
        };
        
        const multiplier = payouts[reel1] || 2;
        winAmount = betAmount * multiplier;
        
        if (reel1 === '⭐') {
          isJackpot = true;
          player.casino.jackpotsHit++;
        }

        message = isJackpot 
          ? `🎊 ✨ JACKPOT!!! ✨ 🎊\n\nYou hit the MEGA jackpot!`
          : `🎉 WINNER! 🎉\n\nTriple ${reel1}! ${multiplier}x payout!`;

      } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
        // TWO MATCH
        winAmount = Math.floor(betAmount * 0.5);
        message = `💫 Minor Win! 💫\n\nTwo symbols match!`;
      } else {
        // NO MATCH
        winAmount = -betAmount;
        message = `❌ No luck this time...`;
      }

      // Update Nexus
      updatePlayerNexus(player, winAmount, saveDatabase);
      // Log casino transaction
      if (winAmount > 0) {
        logTransaction(player, { type: 'casino_win', amount: winAmount, currency: '💠', note: `${game} +${winAmount} 💠` });
        DC.trackProgress(player, 'casino_win', 1);
        try { const BP2=require('../../rpg/utils/BattlePass'); BP2.addPassXP(player,'casino_win'); } catch(e) {}
        try{if(winAmount>0)require('./weekly').trackWeeklyProgress(player,'earn_gold',winAmount);}catch(e){}
      } else if (winAmount < 0) {
        logTransaction(player, { type: 'casino_loss', amount: Math.abs(winAmount), currency: '💠', note: `${game} -${Math.abs(winAmount)} 💠` });
      }
      DC.trackProgress(player, 'casino_play', 1);
      
      // Update stats
      player.casino.gamesPlayed++;
      if (winAmount > 0) {
        player.casino.totalWon += winAmount;
        if (winAmount > player.casino.biggestWin) {
          player.casino.biggestWin = winAmount;
        }
      } else {
        player.casino.totalLost += Math.abs(winAmount);
      }

      saveDatabase();

      const result = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎰 SLOT MACHINE 🎰
━━━━━━━━━━━━━━━━━━━━━━━━━━━

┏━━━━━━━━━━━━━┓
┃  ${reel1}  ${reel2}  ${reel3}  ┃
┗━━━━━━━━━━━━━┛

${message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Bet: ${betAmount} Nexus
${winAmount >= 0 ? `💵 Won: ${winAmount} gold` : `💸 Lost: ${Math.abs(winAmount)} gold`}
💼 Balance: ${player.gold || 0} Nexus
━━━━━━━━━━━━━━━━━━━━━━━━━━━${isJackpot ? '\n🏆 JACKPOT WINNER! 🏆' : ''}`;

      // ── Multi-message fan-out: header → spinning → reels → verdict ──
      return sock.sendMessage(chatId, {
        sections: [
          {
            text: [
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              `🎰 *SLOT MACHINE* 🎰`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              ``,
              `💠 Wager: ${betAmount.toLocaleString()} gold`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ].join('\n'),
          },
          { text: '🎰 *Spinning the reels…*' },
          {
            text: [
              `┏━━━━━━━━━━━━━┓`,
              `┃  ${reel1}  ${reel2}  ${reel3}  ┃`,
              `┗━━━━━━━━━━━━━┛`,
            ].join('\n'),
          },
          {
            text: [
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              message,
              ``,
              `💠 Bet: ${betAmount.toLocaleString()} gold`,
              winAmount >= 0
                ? `💵 Won: +${winAmount.toLocaleString()} gold`
                : `💸 Lost: ${Math.abs(winAmount).toLocaleString()} gold`,
              `💼 Balance: *${(player.gold || 0).toLocaleString()}* gold`,
              isJackpot ? `\n🏆 *JACKPOT WINNER!* 🏆` : '',
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ].filter(Boolean).join('\n'),
          },
        ],
      }, { quoted: msg });
    }

    // ============================================
    // GAME 2: BLACKJACK 🃏
    // ============================================
    if (game === 'blackjack' || game === 'bj') {
      const cards = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      const suits = ['♠️', '♥️', '♣️', '♦️'];

      function drawCard() {
        const card = cards[Math.floor(Math.random() * cards.length)];
        const suit = suits[Math.floor(Math.random() * suits.length)];
        return { card, suit, display: `${card}${suit}` };
      }

      function calculateScore(hand) {
        let score = 0;
        let aces = 0;

        for (const c of hand) {
          if (c.card === 'A') {
            aces++;
            score += 11;
          } else if (['J', 'Q', 'K'].includes(c.card)) {
            score += 10;
          } else {
            score += parseInt(c.card);
          }
        }

        while (score > 21 && aces > 0) {
          score -= 10;
          aces--;
        }

        return score;
      }

      // Deal initial cards
      const playerHand = [drawCard(), drawCard()];
      const dealerHand = [drawCard(), drawCard()];

      const playerScore = calculateScore(playerHand);
      const dealerScore = calculateScore(dealerHand);

      let result = '';
      let winAmount = 0;

      // Check for blackjack (21 with 2 cards)
      const playerBlackjack = playerScore === 21 && playerHand.length === 2;
      const dealerBlackjack = dealerScore === 21 && dealerHand.length === 2;

      if (playerBlackjack && dealerBlackjack) {
        result = '🤝 Push! Both have Blackjack!';
        winAmount = 0;
      } else if (playerBlackjack) {
        result = '🎊 BLACKJACK! 🎊';
        winAmount = Math.floor(betAmount * 2.5);
      } else if (dealerBlackjack) {
        result = '😢 Dealer has Blackjack!';
        winAmount = -betAmount;
      } else if (playerScore > 21) {
        result = '💥 BUST! You went over 21!';
        winAmount = -betAmount;
      } else if (dealerScore > 21) {
        result = '🎉 Dealer BUSTS! You win!';
        winAmount = betAmount * 2;
      } else if (playerScore > dealerScore) {
        result = '✅ You beat the dealer!';
        winAmount = betAmount * 2;
      } else if (playerScore < dealerScore) {
        result = '❌ Dealer wins!';
        winAmount = -betAmount;
      } else {
        result = '🤝 Push! Tie game!';
        winAmount = 0;
      }

      // Update Nexus
      updatePlayerNexus(player, winAmount, saveDatabase);
      // Log casino transaction
      if (winAmount > 0) {
        logTransaction(player, { type: 'casino_win', amount: winAmount, currency: '💠', note: `${game} +${winAmount} 💠` });
        DC.trackProgress(player, 'casino_win', 1);
        try { const BP2=require('../../rpg/utils/BattlePass'); BP2.addPassXP(player,'casino_win'); } catch(e) {}
        try{if(winAmount>0)require('./weekly').trackWeeklyProgress(player,'earn_gold',winAmount);}catch(e){}
      } else if (winAmount < 0) {
        logTransaction(player, { type: 'casino_loss', amount: Math.abs(winAmount), currency: '💠', note: `${game} -${Math.abs(winAmount)} 💠` });
      }
      DC.trackProgress(player, 'casino_play', 1);
      
      // Update stats
      player.casino.gamesPlayed++;
      if (winAmount > 0) {
        player.casino.totalWon += winAmount;
        if (winAmount > player.casino.biggestWin) {
          player.casino.biggestWin = winAmount;
        }
      } else if (winAmount < 0) {
        player.casino.totalLost += Math.abs(winAmount);
      }

      saveDatabase();

      const output = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🃏 BLACKJACK 🃏
━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 YOUR HAND (${playerScore})
   ${playerHand.map(c => c.display).join(' ')}

🎩 DEALER HAND (${dealerScore})
   ${dealerHand.map(c => c.display).join(' ')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
${result}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Bet: ${betAmount} Nexus
${winAmount > 0 ? `💵 Won: ${winAmount} gold` : winAmount < 0 ? `💸 Lost: ${Math.abs(winAmount)} gold` : `➖ No change`}
💼 Balance: ${player.gold || 0} Nexus
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      // ── Multi-message fan-out: header → deal → reveal → verdict ──
      return sock.sendMessage(chatId, {
        sections: [
          {
            text: [
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              `🃏 *BLACKJACK* 🃏`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              ``,
              `💠 Wager: ${betAmount.toLocaleString()} gold`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ].join('\n'),
          },
          { text: '🃏 *Dealing the cards…*' },
          {
            text: [
              `👤 *YOUR HAND* (${playerScore})`,
              `   ${playerHand.map(c => c.display).join('  ')}`,
              ``,
              `🎩 *DEALER HAND* (${dealerScore})`,
              `   ${dealerHand.map(c => c.display).join('  ')}`,
            ].join('\n'),
          },
          {
            text: [
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              result,
              ``,
              `💠 Bet: ${betAmount.toLocaleString()} gold`,
              winAmount > 0
                ? `💵 Won: +${winAmount.toLocaleString()} gold`
                : winAmount < 0
                  ? `💸 Lost: ${Math.abs(winAmount).toLocaleString()} gold`
                  : `➖ No change`,
              `💼 Balance: *${(player.gold || 0).toLocaleString()}* gold`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ].join('\n'),
          },
        ],
      }, { quoted: msg });
    }

    // ============================================
    // GAME 3: ROULETTE 🎡
    // ============================================
    if (game === 'roulette' || game === 'roul') {
      const choice = args[2]?.toLowerCase();
      
      if (!choice) {
        return sock.sendMessage(chatId, { 
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎡 ROULETTE 🎡
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 HOW TO PLAY
/casino roulette [bet] [choice]

🎯 CHOICES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
red - Red numbers (2x)
black - Black numbers (2x)
odd - Odd numbers (2x)
even - Even numbers (2x)
1-36 - Specific number (36x!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 EXAMPLES:
/casino roulette 100 red
/casino roulette 200 17
/casino roulette 50 odd
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      // Spin the wheel (0-36)
      const spin = Math.floor(Math.random() * 37);
      
      const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      const isRed = redNumbers.includes(spin);
      const isBlack = spin !== 0 && !isRed;
      const isOdd = spin % 2 === 1;
      const isEven = spin !== 0 && spin % 2 === 0;

      let won = false;
      let multiplier = 0;

      // Check win conditions
      if (choice === 'red' && isRed) {
        won = true;
        multiplier = 2;
      } else if (choice === 'black' && isBlack) {
        won = true;
        multiplier = 2;
      } else if (choice === 'odd' && isOdd) {
        won = true;
        multiplier = 2;
      } else if (choice === 'even' && isEven) {
        won = true;
        multiplier = 2;
      } else if (!isNaN(parseInt(choice))) {
        const chosenNumber = parseInt(choice);
        if (chosenNumber >= 0 && chosenNumber <= 36 && chosenNumber === spin) {
          won = true;
          multiplier = 36;
        }
      }

      const winAmount = won ? betAmount * multiplier : -betAmount;

      // Update Nexus
      updatePlayerNexus(player, winAmount, saveDatabase);
      // Log casino transaction
      if (winAmount > 0) {
        logTransaction(player, { type: 'casino_win', amount: winAmount, currency: '💠', note: `${game} +${winAmount} 💠` });
        DC.trackProgress(player, 'casino_win', 1);
        try { const BP2=require('../../rpg/utils/BattlePass'); BP2.addPassXP(player,'casino_win'); } catch(e) {}
        try{if(winAmount>0)require('./weekly').trackWeeklyProgress(player,'earn_gold',winAmount);}catch(e){}
      } else if (winAmount < 0) {
        logTransaction(player, { type: 'casino_loss', amount: Math.abs(winAmount), currency: '💠', note: `${game} -${Math.abs(winAmount)} 💠` });
      }
      DC.trackProgress(player, 'casino_play', 1);
      
      // Update stats
      player.casino.gamesPlayed++;
      if (winAmount > 0) {
        player.casino.totalWon += winAmount;
        if (winAmount > player.casino.biggestWin) {
          player.casino.biggestWin = winAmount;
        }
      } else {
        player.casino.totalLost += Math.abs(winAmount);
      }

      saveDatabase();

      const color = spin === 0 ? '🟢' : isRed ? '🔴' : '⚫';

      const output = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎡 ROULETTE 🎡
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎲 SPINNING...

     ${color} ${spin} ${color}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your bet: ${choice}
Result: ${spin} (${spin === 0 ? 'Green' : isRed ? 'Red' : 'Black'})

${won ? `🎉 YOU WIN! ${multiplier}x payout! 🎉` : `❌ Better luck next time!`}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Bet: ${betAmount} Nexus
${winAmount > 0 ? `💵 Won: ${winAmount} gold` : `💸 Lost: ${Math.abs(winAmount)} gold`}
💼 Balance: ${player.gold || 0} Nexus
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      // ── Multi-message fan-out: header → spin → ball drops → verdict ──
      return sock.sendMessage(chatId, {
        sections: [
          {
            text: [
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              `🎡 *ROULETTE* 🎡`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              ``,
              `🎯 Your Bet: *${choice}*`,
              `💠 Wager: ${betAmount.toLocaleString()} gold`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ].join('\n'),
          },
          { text: '🎲 *Spinning the wheel…*' },
          {
            text: [
              ``,
              `      ${color}  *${spin}*  ${color}`,
              ``,
              `Result: *${spin}* (${spin === 0 ? 'Green' : isRed ? 'Red' : 'Black'})`,
            ].join('\n'),
          },
          {
            text: [
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              won ? `🎉 *YOU WIN!* ${multiplier}x payout!` : `❌ *Better luck next time!*`,
              ``,
              `💠 Bet: ${betAmount.toLocaleString()} gold`,
              winAmount > 0
                ? `💵 Won: +${winAmount.toLocaleString()} gold`
                : `💸 Lost: ${Math.abs(winAmount).toLocaleString()} gold`,
              `💼 Balance: *${(player.gold || 0).toLocaleString()}* gold`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ].join('\n'),
          },
        ],
      }, { quoted: msg });
    }

    // ============================================
    // GAME 4: DICE 🎲
    // ============================================
    if (game === 'dice') {
      const prediction = args[2]?.toLowerCase(); // over/under
      const target = parseInt(args[3]);

      if (!prediction || !target || target < 1 || target > 99) {
        return sock.sendMessage(chatId, { 
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎲 DICE GAME 🎲
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 HOW TO PLAY
/casino dice [bet] [over/under] [number]

🎯 Predict if roll is OVER or UNDER target

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 EXAMPLES:
/casino dice 100 over 50
   (Win if roll > 50)

/casino dice 200 under 75
   (Win if roll < 75)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Target must be 1-99
💠 Higher risk = Higher payout!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }

      if (!['over', 'under'].includes(prediction)) {
        return sock.sendMessage(chatId, { 
          text: '❌ Choose "over" or "under"!' 
        }, { quoted: msg });
      }

      // Roll dice (1-100)
      const roll = Math.floor(Math.random() * 100) + 1;
      
      let won = false;
      if (prediction === 'over' && roll > target) won = true;
      if (prediction === 'under' && roll < target) won = true;

      // Calculate multiplier based on odds
      let multiplier = 0;
      if (prediction === 'over') {
        const winChance = (100 - target) / 100;
        multiplier = (0.98 / winChance); // 98% RTP (2% house edge)
      } else {
        const winChance = target / 100;
        multiplier = (0.98 / winChance);
      }

      // Ensure win is at least the bet (principal back) plus a tiny profit on extreme boundaries
      // Math.floor at target=1 or 99 produces ~0.99x which would lose money on a "win"
      const winAmount = won ? Math.max(betAmount + 1, Math.floor(betAmount * multiplier)) : -betAmount;

      // Update Nexus
      updatePlayerNexus(player, winAmount, saveDatabase);
      // Log casino transaction
      if (winAmount > 0) {
        logTransaction(player, { type: 'casino_win', amount: winAmount, currency: '💠', note: `${game} +${winAmount} 💠` });
        DC.trackProgress(player, 'casino_win', 1);
        try { const BP2=require('../../rpg/utils/BattlePass'); BP2.addPassXP(player,'casino_win'); } catch(e) {}
        try{if(winAmount>0)require('./weekly').trackWeeklyProgress(player,'earn_gold',winAmount);}catch(e){}
      } else if (winAmount < 0) {
        logTransaction(player, { type: 'casino_loss', amount: Math.abs(winAmount), currency: '💠', note: `${game} -${Math.abs(winAmount)} 💠` });
      }
      DC.trackProgress(player, 'casino_play', 1);
      
      // Update stats
      player.casino.gamesPlayed++;
      if (winAmount > 0) {
        player.casino.totalWon += winAmount;
        if (winAmount > player.casino.biggestWin) {
          player.casino.biggestWin = winAmount;
        }
      } else {
        player.casino.totalLost += Math.abs(winAmount);
      }

      saveDatabase();

      const output = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎲 DICE GAME 🎲
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Your Bet: ${prediction.toUpperCase()} ${target}

🎲 ROLLING...

     🎲 ${roll} 🎲

━━━━━━━━━━━━━━━━━━━━━━━━━━━
${won ? `✅ YOU WIN! Roll is ${prediction} ${target}!` : `❌ YOU LOSE! Roll is not ${prediction} ${target}!`}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Bet: ${betAmount} Nexus
🎰 Multiplier: ${multiplier.toFixed(2)}x
${winAmount > 0 ? `💵 Won: ${winAmount} gold` : `💸 Lost: ${Math.abs(winAmount)} gold`}
💼 Balance: ${player.gold || 0} Nexus
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      // ── Multi-message fan-out: header → roll suspense → result → payout ──
      // Each section arrives as its own WhatsApp message with a brief
      // stagger, so the player sees the dice tumble in instead of one
      // wall-of-text card.
      return sock.sendMessage(chatId, {
        sections: [
          {
            text: [
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              `🎲 *DICE GAME* 🎲`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              ``,
              `🎯 Your Bet: *${prediction.toUpperCase()} ${target}*`,
              `💠 Wager: ${betAmount.toLocaleString()} gold`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ].join('\n'),
          },
          { text: '🎲 *Rolling…*' },
          {
            text: [
              `🎲 *Result:*`,
              ``,
              `      *${roll}*`,
              ``,
              `Target was *${prediction.toUpperCase()} ${target}*`,
            ].join('\n'),
          },
          {
            text: [
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              won
                ? `✅ *YOU WIN!*`
                : `❌ *YOU LOSE!*`,
              won
                ? `Roll is ${prediction} ${target} — payout locked in!`
                : `Roll is not ${prediction} ${target} — better luck next time.`,
              ``,
              `🎰 Multiplier: ${multiplier.toFixed(2)}x`,
              winAmount > 0
                ? `💵 Won: +${winAmount.toLocaleString()} gold`
                : `💸 Lost: ${Math.abs(winAmount).toLocaleString()} gold`,
              `💼 Balance: *${(player.gold || 0).toLocaleString()}* gold`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ].join('\n'),
          },
        ],
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, { 
      text: '❌ Invalid game! Use /casino to see available games.' 
    }, { quoted: msg });
  }
};