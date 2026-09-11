// cooldowns.js — Show all active cooldowns for the player in one place

'use strict';

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
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const now = Date.now();
    const isPro = !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > now);
    const lines = [];

    if (isPro) {
      lines.push(`🌟 *PRO VIP STATUS ACTIVE:* 50% Reduced Cooldowns on all features!`);
      lines.push(``);
    }

    const fmt = (ms) => {
      if (ms <= 0) return '✅ Ready';
      const s = Math.ceil(ms / 1000);
      if (s < 60) return `⏳ ${s}s`;
      const m = Math.floor(s / 60), rem = s % 60;
      if (m < 60) return `⏳ ${m}m ${rem}s`;
      const h = Math.floor(m / 60), remm = m % 60;
      return `⏳ ${h}h ${remm}m`;
    };

    // ── Aura Farm Cooldown ────────────────────────────────────
    const auraCdMs = isPro ? (5 * 60 * 60 * 1000) : (10 * 60 * 60 * 1000);
    const lastAura = player.cooldowns?.auraFarm || 0;
    const auraCd = Math.max(0, (lastAura + auraCdMs) - now);
    lines.push(`✨ *Aura Farm:* ${fmt(auraCd)}${auraCd === 0 ? ' — /aura farm' : ''}`);

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
      const bankWdMs = isPro ? (30 * 60 * 1000) : (60 * 60 * 1000);
      for (const bank of Object.values(db.banks)) {
        const acc = bank.accounts?.find(a => a.userId === sender);
        if (acc?.lastWithdrawal) {
          const wdCd = Math.max(0, (acc.lastWithdrawal + bankWdMs) - now);
          lines.push(`🏦 *Bank Withdraw:* ${fmt(wdCd)}${wdCd === 0 ? ` — /bank withdraw` : ''}`);
          break;
        }
      }
    }

    // ── Casino per-game cooldowns (in-memory) ─────────────────
    lines.push(`🎰 *Casino Cooldowns:* ${isPro ? 'Slots 15s • BJ 7s • Roulette 10s • Dice 5s' : 'Slots 30s • BJ 15s • Roulette 20s • Dice 10s'}`);

    return sock.sendMessage(chatId, {
      text: (pro ? `${UI.PRO_BAR}\n⏱️ *YOUR COOLDOWNS* 💎\n${UI.PRO_BAR}\n\n${lines.join('\n')}\n\n${UI.PRO_BAR}\n❤️ HP: ${player.stats.hp}/${player.stats.maxHp} | 💠 Nexus: ${player.gold || 0}\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO TIMERS* — 50% reduced cooldowns active` : `⏱️ *YOUR COOLDOWNS*\n${UI.FREE_BAR}\n\n${lines.join('\n')}\n\n${UI.FREE_BAR}\n❤️ HP: ${player.stats.hp}/${player.stats.maxHp} | 💠 Nexus: ${player.gold || 0}\n${UI.FREE_BAR}\n${UI.upsell()}`)
    }, { quoted: msg });
  }
};
