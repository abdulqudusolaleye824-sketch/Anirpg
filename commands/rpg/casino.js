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
  aviator:   30_000,  // 30 seconds
  avi:       30_000,
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
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    // Sessions persist in db (a restart wipes the in-memory Map). Restore here
    // and lazily expire — an open casino survives deploys, an expired one
    // reads as closed even if its auto-close timer died with the process.
    if (!db.casinoSessions) db.casinoSessions = {};
    for (const [cid, sess] of Object.entries(db.casinoSessions)) {
      if (!sess || sess.endTime <= Date.now()) delete db.casinoSessions[cid];
      else if (!activeCasinoSessions.has(cid)) activeCasinoSessions.set(cid, sess);
    }

    const game = args[0]?.toLowerCase();
    const betAmount = parseInt(args[1]);
    let _auraHit = 0; // casino-loss aura hit (10-20), set in each loss branch

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

      // Unmute the group for betting (re-locked on close/expiry if it was locked)
      let wasLocked = false, muteNote = '';
      if (chatId.endsWith('@g.us')) {
        try {
          const meta = await sock.groupMetadata(chatId);
          wasLocked = !!meta.announce;
          if (wasLocked) {
            await sock.groupSettingUpdate(chatId, 'not_announcement');
            muteNote = '\n🔓 Group unmuted for betting — re-locks when the casino closes.';
          }
        } catch (e) { muteNote = '\n⚠️ Could not unmute group (bot needs admin).'; }
      }

      activeCasinoSessions.set(chatId, {
        startTime: Date.now(),
        endTime: endTime,
        duration: minutes,
        openedBy: player.name,
        wasLocked
      });
      db.casinoSessions[chatId] = activeCasinoSessions.get(chatId);
      try { saveDatabase(); } catch (e) {}

      // Auto-close after time expires (re-locks the group if it was locked)
      setTimeout(async () => {
        if (activeCasinoSessions.has(chatId)) {
          const sess = activeCasinoSessions.get(chatId);
          activeCasinoSessions.delete(chatId);
          try { if (db.casinoSessions) delete db.casinoSessions[chatId]; } catch (e) {}
          let lockNote = '';
          if (sess?.wasLocked) {
            try { await sock.groupSettingUpdate(chatId, 'announcement'); lockNote = '\n🔒 Group re-locked.'; }
            catch (e) { lockNote = '\n⚠️ Could not re-lock group (bot needs admin).'; }
          }
          sock.sendMessage(chatId, {
            text: `${FRAME}
🎰 CASINO CLOSED 🎰
${FRAME}
⏰ Time's up! The casino has closed.

Thanks for playing! 🎲${lockNote}
${FRAME}`
          });
        }
      }, minutes * 60 * 1000);

      return sock.sendMessage(chatId, { 
        text: `${FRAME}
🎰 CASINO NOW OPEN! 🎰
${FRAME}
Opened by: ${player.name}
⏱️ Duration: ${minutes} minutes

${FRAME}
🎮 AVAILABLE GAMES:
${FRAME}
🎰 /casino slots [bet]
🃏 /casino blackjack [bet]
🎡 /casino roulette [bet] [choice]
🎲 /casino dice [bet] [over/under] [#]
✈️ /casino aviator [bet]

${FRAME}
💠 Min bet: 50 Nexus
💠 Max bet: 5,000 Nexus (10,000 for PRO)
⏱️ Cooldown: 3 seconds

🎉 Good luck everyone! 🎉${muteNote}
${FRAME}`
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

      const closingSess = activeCasinoSessions.get(chatId);
      activeCasinoSessions.delete(chatId);
      try { if (db.casinoSessions) delete db.casinoSessions[chatId]; saveDatabase(); } catch (e) {}
      let closeLockNote = '';
      if (closingSess?.wasLocked) {
        try { await sock.groupSettingUpdate(chatId, 'announcement'); closeLockNote = '\n🔒 Group re-locked.'; }
        catch (e) { closeLockNote = '\n⚠️ Could not re-lock group (bot needs admin).'; }
      }

      return sock.sendMessage(chatId, {
        text: `${FRAME}
🚪 CASINO CLOSED 🚪
${FRAME}
Closed by: ${player.name}

Thanks for playing! 🎲${closeLockNote}
${FRAME}` 
      }, { quoted: msg });
    }

    // ============================================
    // ADMIN COMMAND: /casino status
    // ============================================
    if (game === 'status') {
      if (!activeCasinoSessions.has(chatId)) {
        return sock.sendMessage(chatId, { 
          text: `${FRAME}
🎰 CASINO STATUS 🎰
${FRAME}
Status: 🔴 CLOSED

Admins can open with:
/casino open [minutes]
${FRAME}` 
        }, { quoted: msg });
      }

      const session = activeCasinoSessions.get(chatId);
      const elapsed = Math.floor((Date.now() - session.startTime) / 1000 / 60);
      const remaining = Math.ceil((session.endTime - Date.now()) / 1000 / 60);

      return sock.sendMessage(chatId, { 
        text: `${FRAME}
🎰 CASINO STATUS 🎰
${FRAME}
Status: 🟢 OPEN

Opened by: ${session.openedBy}
Duration: ${session.duration} minutes
Elapsed: ${elapsed} minutes
⏱️ Remaining: ${remaining} minutes

${FRAME}
Place your bets! 🎲
${FRAME}` 
      }, { quoted: msg });
    }

    // ============================================
    // CHECK IF CASINO IS OPEN (For all games)
    // ============================================
    if (game && ['slots', 'slot', 'blackjack', 'bj', 'roulette', 'roul', 'dice', 'aviator', 'avi'].includes(game)) {
      // Check if in group chat
      const isGroup = chatId.endsWith('@g.us');
      
      if (isGroup && !activeCasinoSessions.has(chatId)) {
        return sock.sendMessage(chatId, { 
          text: `${FRAME}
🔒 CASINO CLOSED 🔒
${FRAME}
The casino is not open in this group.

Admins can open with:
/casino open [minutes]

Example: /casino open 30
${FRAME}` 
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
      if (!player.casino) player.casino = { gamesPlayed: 0, totalWon: 0, totalLost: 0, biggestWin: 0, jackpotsHit: 0 };
      const net = (player.casino.totalWon || 0) - (player.casino.totalLost || 0);
      const text = UI.card(player, {
        icon: '🎰', title: 'ROYAL CASINO',
        lines: [
          `💠 Your Nexus: *${UI.num(player.gold)}*`,
          ``,
          `🎮 *GAMES AVAILABLE*`,
          `1️⃣ 🎰 SLOTS — /casino slots [bet] · 2x-500x`,
          `2️⃣ 🃏 BLACKJACK — /casino blackjack [bet] · 2x/2.5x`,
          `3️⃣ 🎡 ROULETTE — /casino roulette [bet] [choice] · 2x-36x`,
          `4️⃣ 🎲 DICE — /casino dice [bet] [over/under] [#]`,
          `5️⃣ ✈️ AVIATOR — /casino aviator [bet] · up to 50x!`,
          ``,
          `📊 *YOUR CASINO STATS*`,
          `🎮 Games: *${UI.num(player.casino.gamesPlayed)}* · 🏆 Biggest: *${UI.num(player.casino.biggestWin)}* · 💎 Jackpots: *${UI.num(player.casino.jackpotsHit)}*`,
          `⚠️ Min 50 · Max 30,000 · Cooldowns: S30s/BJ15s/R20s/D10s`,
        ],
        proLines: [`💎 *PRO HIGH ROLLER*`, `  📈 Net: *${net >= 0 ? '+' : ''}${UI.num(net)}* · Won ${UI.num(player.casino.totalWon)} / Lost ${UI.num(player.casino.totalLost)}`],
        tip: 'Aviator pays up to 100x — cash out before the crash',
      });
      return sock.sendMessage(chatId, { text }, { quoted: msg });
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

    // Max bet: 5,000 Nexus (10,000 for Pro). Casino payouts are NEVER
    // Pro-doubled — the higher cap is the Pro casino perk.
    const maxBet = pro ? 10000 : 5000;
    if (betAmount > maxBet) {
      return sock.sendMessage(chatId, {
        text: `❌ Maximum bet is ${maxBet.toLocaleString()} Nexus${pro ? '' : ' (10,000 for PRO)'}!`
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
    // GAME 5: AVIATOR ✈️ (crash multiplier)
    // ============================================
    if (game === 'aviator' || game === 'avi') {
      const Aviator = require('../../rpg/utils/Aviator');
      if (Aviator.getFlight(sender)) {
        return sock.sendMessage(chatId, {
          text: `✈️ You're already flying! Cash out with */cashout* or wait for the crash.`
        }, { quoted: msg });
      }
      const launched = await Aviator.startFlight({ sock, chatId, sender, bet: betAmount, player, saveDatabase, quoted: msg });
      if (!launched.ok) {
        return sock.sendMessage(chatId, {
          text: launched.error === 'already'
            ? `✈️ You're already flying! Cash out with */cashout* or wait for the crash.`
            : `❌ Could not launch your flight — your bet was refunded. Try again!`
        }, { quoted: msg });
      }
      // Cash-out button (separate message — the flight message itself is edited live)
      try {
        const BH = require('../../utils/buttonHelper');
        if (BH?.sendWithButtons && BH?.buildQuickReplies) {
          await BH.sendWithButtons(sock, chatId,
            { text: `💰 *${player.name}* is flying — tap to cash out!\n(or type */cashout*)`, footer: `Aviator • bet ${betAmount}` },
            BH.buildQuickReplies([['💰 CASH OUT', '/cashout']]), msg);
        }
      } catch (e) { /* button is a convenience — /cashout always works */ }
      return;
    }

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
        // Losing money in the casino costs 10-20 aura.
        _auraHit = 10 + Math.floor(Math.random() * 11);
        player.aura = Math.max(0, (player.aura || 0) - _auraHit);
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

      const result = `${FRAME}
🎰 SLOT MACHINE 🎰
${FRAME}

┏━━━━━━━━━━━━━┓
┃  ${reel1}  ${reel2}  ${reel3}  ┃
┗━━━━━━━━━━━━━┛

${message}

${FRAME}
💠 Bet: ${betAmount} Nexus
${winAmount >= 0 ? `💵 Won: ${winAmount} gold` : `💸 Lost: ${Math.abs(winAmount)} gold · 🌀 Aura \u2212${_auraHit}`}
💼 Balance: ${player.gold || 0} Nexus
${FRAME}${isJackpot ? '\n🏆 JACKPOT WINNER! 🏆' : ''}`;

      // ── Multi-message fan-out: header → spinning → reels → verdict ──
      return sock.sendMessage(chatId, {
        sections: [
          {
            text: [
              `${FRAME}`,
              `🎰 *SLOT MACHINE* 🎰`,
              `${FRAME}`,
              ``,
              `💠 Wager: ${betAmount.toLocaleString()} gold`,
              `${FRAME}`,
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
              `${FRAME}`,
              message,
              ``,
              `💠 Bet: ${betAmount.toLocaleString()} gold`,
              winAmount >= 0
                ? `💵 Won: +${winAmount.toLocaleString()} gold`
                : `💸 Lost: ${Math.abs(winAmount).toLocaleString()} gold · 🌀 Aura \u2212${_auraHit}`,
              `💼 Balance: *${(player.gold || 0).toLocaleString()}* gold`,
              ...(pro ? [`📊 Lifetime: +${UI.num(player.casino.totalWon)} / -${UI.num(player.casino.totalLost)}`] : []),
              isJackpot ? `\n🏆 *JACKPOT WINNER!* 🏆` : '',
              `${FRAME}`,
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
        // Losing money in the casino costs 10-20 aura.
        _auraHit = 10 + Math.floor(Math.random() * 11);
        player.aura = Math.max(0, (player.aura || 0) - _auraHit);
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

      const output = `${FRAME}
🃏 BLACKJACK 🃏
${FRAME}

👤 YOUR HAND (${playerScore})
   ${playerHand.map(c => c.display).join(' ')}

🎩 DEALER HAND (${dealerScore})
   ${dealerHand.map(c => c.display).join(' ')}

${FRAME}
${result}
${FRAME}
💠 Bet: ${betAmount} Nexus
${winAmount > 0 ? `💵 Won: ${winAmount} gold` : winAmount < 0 ? `💸 Lost: ${Math.abs(winAmount)} gold · 🌀 Aura \u2212${_auraHit}` : `➖ No change`}
💼 Balance: ${player.gold || 0} Nexus
${FRAME}`;

      // ── Multi-message fan-out: header → deal → reveal → verdict ──
      return sock.sendMessage(chatId, {
        sections: [
          {
            text: [
              `${FRAME}`,
              `🃏 *BLACKJACK* 🃏`,
              `${FRAME}`,
              ``,
              `💠 Wager: ${betAmount.toLocaleString()} gold`,
              `${FRAME}`,
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
              `${FRAME}`,
              result,
              ``,
              `💠 Bet: ${betAmount.toLocaleString()} gold`,
              winAmount > 0
                ? `💵 Won: +${winAmount.toLocaleString()} gold`
                : winAmount < 0
                  ? `💸 Lost: ${Math.abs(winAmount).toLocaleString()} gold · 🌀 Aura \u2212${_auraHit}`
                  : `➖ No change`,
              `💼 Balance: *${(player.gold || 0).toLocaleString()}* gold`,
              ...(pro ? [`📊 Lifetime: +${UI.num(player.casino.totalWon)} / -${UI.num(player.casino.totalLost)}`] : []),
              `${FRAME}`,
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
          text: `${FRAME}
🎡 ROULETTE 🎡
${FRAME}
📌 HOW TO PLAY
/casino roulette [bet] [choice]

🎯 CHOICES:
${FRAME}
red - Red numbers (2x)
black - Black numbers (2x)
odd - Odd numbers (2x)
even - Even numbers (2x)
1-36 - Specific number (36x!)
${FRAME}
📝 EXAMPLES:
/casino roulette 100 red
/casino roulette 200 17
/casino roulette 50 odd
${FRAME}`
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
        // Losing money in the casino costs 10-20 aura.
        _auraHit = 10 + Math.floor(Math.random() * 11);
        player.aura = Math.max(0, (player.aura || 0) - _auraHit);
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

      const output = `${FRAME}
🎡 ROULETTE 🎡
${FRAME}

🎲 SPINNING...

     ${color} ${spin} ${color}

${FRAME}
Your bet: ${choice}
Result: ${spin} (${spin === 0 ? 'Green' : isRed ? 'Red' : 'Black'})

${won ? `🎉 YOU WIN! ${multiplier}x payout! 🎉` : `❌ Better luck next time!`}
${FRAME}
💠 Bet: ${betAmount} Nexus
${winAmount > 0 ? `💵 Won: ${winAmount} gold` : `💸 Lost: ${Math.abs(winAmount)} gold · 🌀 Aura \u2212${_auraHit}`}
💼 Balance: ${player.gold || 0} Nexus
${FRAME}`;

      // ── Multi-message fan-out: header → spin → ball drops → verdict ──
      return sock.sendMessage(chatId, {
        sections: [
          {
            text: [
              `${FRAME}`,
              `🎡 *ROULETTE* 🎡`,
              `${FRAME}`,
              ``,
              `🎯 Your Bet: *${choice}*`,
              `💠 Wager: ${betAmount.toLocaleString()} gold`,
              `${FRAME}`,
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
              `${FRAME}`,
              won ? `🎉 *YOU WIN!* ${multiplier}x payout!` : `❌ *Better luck next time!*`,
              ``,
              `💠 Bet: ${betAmount.toLocaleString()} gold`,
              winAmount > 0
                ? `💵 Won: +${winAmount.toLocaleString()} gold`
                : `💸 Lost: ${Math.abs(winAmount).toLocaleString()} gold · 🌀 Aura \u2212${_auraHit}`,
              `💼 Balance: *${(player.gold || 0).toLocaleString()}* gold`,
              ...(pro ? [`📊 Lifetime: +${UI.num(player.casino.totalWon)} / -${UI.num(player.casino.totalLost)}`] : []),
              `${FRAME}`,
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
          text: `${FRAME}
🎲 DICE GAME 🎲
${FRAME}
📌 HOW TO PLAY
/casino dice [bet] [over/under] [number]

🎯 Predict if roll is OVER or UNDER target

${FRAME}
📝 EXAMPLES:
/casino dice 100 over 50
   (Win if roll > 50)

/casino dice 200 under 75
   (Win if roll < 75)
${FRAME}
⚠️ Target must be 1-99
💠 Higher risk = Higher payout!
${FRAME}`
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
        // Losing money in the casino costs 10-20 aura.
        _auraHit = 10 + Math.floor(Math.random() * 11);
        player.aura = Math.max(0, (player.aura || 0) - _auraHit);
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

      const output = `${FRAME}
🎲 DICE GAME 🎲
${FRAME}

🎯 Your Bet: ${prediction.toUpperCase()} ${target}

🎲 ROLLING...

     🎲 ${roll} 🎲

${FRAME}
${won ? `✅ YOU WIN! Roll is ${prediction} ${target}!` : `❌ YOU LOSE! Roll is not ${prediction} ${target}!`}
${FRAME}
💠 Bet: ${betAmount} Nexus
🎰 Multiplier: ${multiplier.toFixed(2)}x
${winAmount > 0 ? `💵 Won: ${winAmount} gold` : `💸 Lost: ${Math.abs(winAmount)} gold · 🌀 Aura \u2212${_auraHit}`}
💼 Balance: ${player.gold || 0} Nexus
${FRAME}`;

      // ── Multi-message fan-out: header → roll suspense → result → payout ──
      // Each section arrives as its own WhatsApp message with a brief
      // stagger, so the player sees the dice tumble in instead of one
      // wall-of-text card.
      return sock.sendMessage(chatId, {
        sections: [
          {
            text: [
              `${FRAME}`,
              `🎲 *DICE GAME* 🎲`,
              `${FRAME}`,
              ``,
              `🎯 Your Bet: *${prediction.toUpperCase()} ${target}*`,
              `💠 Wager: ${betAmount.toLocaleString()} gold`,
              `${FRAME}`,
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
              `${FRAME}`,
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
                : `💸 Lost: ${Math.abs(winAmount).toLocaleString()} gold · 🌀 Aura \u2212${_auraHit}`,
              `💼 Balance: *${(player.gold || 0).toLocaleString()}* gold`,
              ...(pro ? [`📊 Lifetime: +${UI.num(player.casino.totalWon)} / -${UI.num(player.casino.totalLost)}`] : []),
              `${FRAME}`,
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