// cooldowns.js — Show all active cooldowns for the player in one place

module.exports = {
  name: 'cooldowns',
  aliases: ['cd', 'timers'],
  description: '⏱️ Check all your active cooldowns',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register to start.' }, { quoted: msg });
    }

    const now = Date.now();
    const lines = [];

    const fmt = (ms) => {
      if (ms <= 0) return '✅ Ready';
      const s = Math.ceil(ms / 1000);
      if (s < 60) return `⏳ ${s}s`;
      const m = Math.floor(s / 60), rem = s % 60;
      if (m < 60) return `⏳ ${m}m ${rem}s`;
      const h = Math.floor(m / 60), remm = m % 60;
      return `⏳ ${h}h ${remm}m`;
    };

    // ── Daily reward ──────────────────────────────────────────
    const dailyCd = player.dailyQuest?.lastClaimed
      ? Math.max(0, (player.dailyQuest.lastClaimed + 24*60*60*1000) - now)
      : 0;
    lines.push(`📅 *Daily Reward:* ${fmt(dailyCd)}${dailyCd === 0 ? ' — /daily' : ''}`);

    // ── Heal (potion-based, no cooldown timer) ───────────────
    const hpPotions = player.inventory?.healthPotions || 0;
    const enPotions = player.inventory?.energyPotions || player.inventory?.manaPotions || 0;
    lines.push(`💊 *Heal:* ${hpPotions} HP potions | ${enPotions} Energy potions${hpPotions > 0 ? ' — /use heal' : ' — /shop to restock'}`);

    // ── Rob/steal cooldown ────────────────────────────────────
    const robCd = player.stealCooldown
      ? Math.max(0, player.stealCooldown - now)
      : 0;
    lines.push(`🦹 *Rob:* ${fmt(robCd)}${robCd === 0 ? ' — /rob @user' : ''}`);

    // ── PvP battle status ─────────────────────────────────────
    if (player.pvpBattle) {
      const opp = db.users[player.pvpBattle.opponentId];
      lines.push(`⚔️ *PvP:* 🔴 In battle vs *${opp?.name || 'Unknown'}* — Turn ${player.pvpBattle.turnNumber}`);
    } else {
      lines.push(`⚔️ *PvP:* ✅ Ready — /pvp challenge @user`);
    }

    // ── AFK status ────────────────────────────────────────────
    if (db.afkUsers?.[sender]) {
      const afkMins = Math.floor((now - db.afkUsers[sender].since) / 60000);
      lines.push(`💤 *AFK:* Active for ${afkMins}m — auto-clears in ${fmt(Math.max(0,(db.afkUsers[sender].since + 8*60*60*1000) - now))}`);
    }

    // ── Bank withdrawal cooldown ──────────────────────────────
    if (db.banks) {
      for (const bank of Object.values(db.banks)) {
        const acc = bank.accounts?.find(a => a.userId === sender);
        if (acc?.lastWithdrawal) {
          const wdCd = Math.max(0, (acc.lastWithdrawal + 60*60*1000) - now);
          lines.push(`🏦 *Bank Withdraw:* ${fmt(wdCd)}${wdCd === 0 ? ` — /bank withdraw` : ''}`);
          break;
        }
      }
    }

    // ── Casino per-game cooldowns (in-memory) ─────────────────
    const casinoGames = { slots: 30_000, blackjack: 15_000, roulette: 20_000, dice: 10_000 };
    const casinoLines = [];
    // We can't read the Map from here directly, but we can show a summary
    casinoLines.push(`🎰 *Casino:* Slots 30s • Blackjack 15s • Roulette 20s • Dice 10s`);
    lines.push(...casinoLines);

    // ── Quest check ───────────────────────────────────────────
    const activeQuests = (() => {
      try {
        const QM = require('../../rpg/utils/QuestManager');
        const qdata = QM.getPlayerData ? QM.getPlayerData(sender) : null;
        return qdata?.active?.length || 0;
      } catch(e) { return 0; }
    })();
    if (activeQuests > 0) lines.push(`📋 *Active Quests:* ${activeQuests} — /quest active`);

    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⏱️ *YOUR COOLDOWNS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${lines.join('\n')}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❤️ HP: ${player.stats.hp}/${player.stats.maxHp} | 💠 Nexus: ${player.gold || 0}`
    }, { quoted: msg });
  }
};
