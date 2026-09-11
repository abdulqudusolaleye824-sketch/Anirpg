// /challenges — View and claim daily challenges
const DC = require('../../rpg/utils/DailyChallenges');

module.exports = {
  name: 'challenges',
  aliases: ['challenge', 'tasks', 'missions'],
  description: '📋 View and claim your 3 daily challenges',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const sub = args[0]?.toLowerCase();
    const dc = DC.getPlayerChallenges(player);
    const todays = DC.getTodaysChallenges();

    // ── /challenges claim [id] ─────────────────────────────
    if (sub === 'claim') {
      const challengeId = args[1];
      if (!challengeId) {
        // Try to auto-claim all completed unclaimed
        let claimed = 0;
        let totalNexus = 0, totalCrystals = 0;
        for (const c of todays) {
          const result = DC.claimChallenge(player, c.id);
          if (result.success) {
            claimed++;
            totalNexus += c.rewards.gold;
            totalCrystals += c.rewards.crystals;
          }
        }
        if (!claimed) return sock.sendMessage(chatId, { text: '❌ No completed challenges to claim!\nComplete them first, then use /challenges claim' }, { quoted: msg });
        if (totalNexus > 0) {
          try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'goldEarn', totalNexus, sock, sender, chatId); } catch(e){}
        }
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: (pro ? `${UI.PRO_BAR}\n🎁 *CHALLENGES CLAIMED!* 💎\n${UI.PRO_BAR}\n` : `🎁 *CHALLENGES CLAIMED!*\n${UI.FREE_BAR}\n`) + `✅ Claimed *${claimed}* challenge(s)!\n\n💠 +${totalNexus.toLocaleString()} Nexus\n💎 +${totalCrystals} Mana Stones\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO HUSTLE* — ${claimed} claimed today` : `\n${UI.upsell()}`)
        }, { quoted: msg });
      }

      const result = DC.claimChallenge(player, challengeId);
      if (!result.success) return sock.sendMessage(chatId, { text: `❌ ${result.reason}` }, { quoted: msg });
      if (result.challenge && result.challenge.rewards && result.challenge.rewards.gold > 0) {
        try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'goldEarn', result.challenge.rewards.gold, sock, sender, chatId); } catch(e){}
      }
      saveDatabase();
      const c = result.challenge;
      return sock.sendMessage(chatId, {
        text: `✅ *${c.emoji} ${c.desc}* — CLAIMED!\n💠 +${c.rewards.gold.toLocaleString()} 💠  💎 +${c.rewards.crystals} crystals`
      }, { quoted: msg });
    }

    // ── /challenges — show progress ────────────────────────
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()+1));
    const msLeft = midnight - now;
    const hLeft = Math.floor(msLeft/3600000);
    const mLeft = Math.floor((msLeft%3600000)/60000);

    let txt = pro ? `${UI.PRO_BAR}\n📋 *DAILY CHALLENGES* 💎\n${UI.PRO_BAR}\n⏰ Resets in: *${hLeft}h ${mLeft}m*\n\n` : `📋 *DAILY CHALLENGES*\n${UI.FREE_BAR}\n⏰ Resets in: *${hLeft}h ${mLeft}m*\n\n`;

    let allDone = true;
    let claimable = 0;
    for (const c of todays) {
      const prog = dc.progress[c.id] || { count: 0, completed: false };
      const icon = prog.claimed ? '✅' : prog.completed ? '🎁' : '⬜';
      const bar  = UI.bar(prog.count, c.target, 5, pro);
      txt += `${icon} ${c.emoji} *${c.desc}*\n`;
      txt += `   [${bar}] ${prog.count}/${c.target}\n`;
      txt += `   💠 +${c.rewards.gold.toLocaleString()} 💠  💎 +${c.rewards.crystals}\n`;
      if (prog.completed && !prog.claimed) { txt += `   → */challenges claim* to collect!\n`; claimable++; }
      txt += `\n`;
      if (!prog.claimed) allDone = false;
    }

    if (allDone) txt += `🌟 *All challenges complete!* Come back tomorrow for new ones.\n\n`;

    txt += `${FRAME}\n/challenges claim — collect completed rewards` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO HUSTLE* — ${claimable} ready to claim` : `\n${UI.upsell()}`);
    return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
  }
};
