// ═══════════════════════════════════════════════════════════════
// /use — Use consumable items (potions, revives, Guild Victory Cards)
//
// Usage:
//   /use              — show inventory
//   /use lower        — use Lower Health Potion (10% HP)
//   /use medium       — use Medium Health Potion (25% HP)
//   /use higher       — use Higher Health Potion (50% HP)
//   /use heal         — use highest available Health Potion
//   /use energy       — use an Energy Potion
//   /use revive       — use a Revive Token
//   /use GVC --gold   — use Gold Guild Victory Card
// ═══════════════════════════════════════════════════════════════

'use strict';

const { checkInBattle } = require('../../rpg/utils/RegenManager');

module.exports = {
  name: 'use',
  description: 'Use consumable items (potions, revives, Guild Victory Cards)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      await sock.sendMessage(chatId, { text: '❌ You are not registered! Use /register' }, { quoted: msg });
      return;
    }

    if (!player.inventory) {
      player.inventory = { lowerHealthPotions: 0, mediumHealthPotions: 0, higherHealthPotions: 0, healthPotions: 0, energyPotions: 0, reviveTokens: 0, cards: {} };
    }
    if (!player.inventory.cards) player.inventory.cards = {};

    const fullText = (args.join(' ') || '').toLowerCase();
    const action   = args[0]?.toLowerCase();

    // ═══════════════════════════════════════
    // 🏆 USE GUILD VICTORY CARDS (GVC)
    // ═══════════════════════════════════════
    if (action === 'gvc' || action === 'gvc_gold' || action === 'gvc_silver' || action === 'gvc_bronze' ||
        fullText.includes('gold') || fullText.includes('silver') || fullText.includes('bronze')) {

      let cardType = null;
      if (fullText.includes('gold'))   cardType = 'gvc_gold';
      if (fullText.includes('silver')) cardType = 'gvc_silver';
      if (fullText.includes('bronze')) cardType = 'gvc_bronze';

      if (!cardType) {
        return sock.sendMessage(chatId, {
          text: '❌ Specify card type!\nUsage: /use GVC --gold | /use GVC --silver | /use GVC --bronze'
        }, { quoted: msg });
      }

      const count = player.inventory.cards[cardType] || 0;
      if (count <= 0) {
        const label = cardType === 'gvc_gold' ? 'Gold' : cardType === 'gvc_silver' ? 'Silver' : 'Bronze';
        return sock.sendMessage(chatId, {
          text: `❌ You do not have a ${label} Guild Victory Card!\nEarn GVC cards by participating in the Weekly Guild War contest.`
        }, { quoted: msg });
      }

      player.inventory.cards[cardType]--;

      let nexusReward = 0;
      let manaReward  = 0;
      let label       = '';
      let emoji       = '';

      if (cardType === 'gvc_gold') {
        nexusReward = 15000;
        manaReward  = 3000;
        label       = 'GOLD GUILD VICTORY CARD';
        emoji       = '🥇';
      } else if (cardType === 'gvc_silver') {
        nexusReward = 10000;
        manaReward  = 2000;
        label       = 'SILVER GUILD VICTORY CARD';
        emoji       = '🥈';
      } else {
        nexusReward = 5000;
        manaReward  = 2000;
        label       = 'BRONZE GUILD VICTORY CARD';
        emoji       = '🥉';
      }

      player.gold = (player.gold || 0) + nexusReward;
      player.manaCrystals = (player.manaCrystals || 0) + manaReward;
      if (player.inventory) player.inventory.gold = player.gold;

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `${emoji} *${label} USED!*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `👤 Hunter: *${player.name}*`,
          ``,
          `✨ *REWARDS RECEIVED:*`,
          `💠 Nexus: *+${nexusReward.toLocaleString()}*`,
          `💎 Mana Stones: *+${manaReward.toLocaleString()}*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `💳 Cards Remaining: *${player.inventory.cards[cardType]}*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════
    // 📋 USE MENU
    // ═══════════════════════════════════════
    if (!action) {
      const lowerCount  = player.inventory.lowerHealthPotions || 0;
      const mediumCount = player.inventory.mediumHealthPotions || 0;
      const higherCount = player.inventory.higherHealthPotions || 0;
      const legacyCount = player.inventory.healthPotions || 0;

      const goldCards   = player.inventory.cards?.gvc_gold || 0;
      const silverCards = player.inventory.cards?.gvc_silver || 0;
      const bronzeCards = player.inventory.cards?.gvc_bronze || 0;

      const currentBattle = checkInBattle(player, db);
      let battleStatus = '\n✅ Available anytime\n';
      if (currentBattle) {
        if (currentBattle.type === 'pvp') battleStatus = '\n⚠️ *IN PVP BATTLE* - Health potions deal damage to opponent!\n';
        else if (currentBattle.type === 'gateraid') battleStatus = '\n⚔️ *IN GATE RAID* - Max 5 HP potions & 1 revive total per party!\n';
        else battleStatus = '\n⚔️ *IN BATTLE* - Potions active!\n';
      }

      const menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💊 USE ITEMS MENU 💊
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 YOUR HEALTH POTIONS:
🩹 Lower HP Potion (10%): ${lowerCount + legacyCount}
🧪 Medium HP Potion (25%): ${mediumCount}
🍷 Higher HP Potion (50%): ${higherCount}

${player.energyColor || '💙'} ${player.energyType || 'Mana'} Potions: ${player.inventory.energyPotions || player.inventory.manaPotions || 0}
   Restores: 50% ${player.energyType || 'Mana'}

🎫 Revive Tokens: ${player.inventory.reviveTokens || 0}
   Revives you on death

🥇 Gold Guild Victory Cards: ${goldCards}
🥈 Silver Guild Victory Cards: ${silverCards}
🥉 Bronze Guild Victory Cards: ${bronzeCards}
${battleStatus}━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/use lower         - Use Lower HP Potion (10% HP)
/use medium        - Use Medium HP Potion (25% HP)
/use higher        - Use Higher HP Potion (50% HP)
/use heal          - Use highest available HP Potion
/use energy        - Use Mana Potion
/use revive        - Use Revive Token
/use GVC --gold    - Use Gold Victory Card (15k Nexus + 3k MS)
/use GVC --silver  - Use Silver Victory Card (10k Nexus + 2k MS)
/use GVC --bronze  - Use Bronze Victory Card (10k Nexus + 2k MS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await sock.sendMessage(chatId, { text: menu }, { quoted: msg });
      return;
    }

    // ═══════════════════════════════════════
    // 🩹 USE HEALTH POTION (Lower / Medium / Higher / General)
    // ═══════════════════════════════════════
    if (['heal', 'health', 'hp', 'lower', 'lowerhp', 'medium', 'mediumhp', 'higher', 'higherhp'].includes(action)) {
      let chosenTier = null; // 'lower' | 'medium' | 'higher'
      if (action.startsWith('lower')) chosenTier = 'lower';
      else if (action.startsWith('medium')) chosenTier = 'medium';
      else if (action.startsWith('higher')) chosenTier = 'higher';
      else {
        // Auto-select highest available
        if ((player.inventory.higherHealthPotions || 0) > 0) chosenTier = 'higher';
        else if ((player.inventory.mediumHealthPotions || 0) > 0) chosenTier = 'medium';
        else if ((player.inventory.lowerHealthPotions || 0) > 0 || (player.inventory.healthPotions || 0) > 0) chosenTier = 'lower';
      }

      if (!chosenTier) {
        return sock.sendMessage(chatId, { text: '❌ You have no Health Potions!\nBuy them in /shop' }, { quoted: msg });
      }

      // Verify availability
      if (chosenTier === 'lower' && (player.inventory.lowerHealthPotions || 0) <= 0 && (player.inventory.healthPotions || 0) <= 0) {
        return sock.sendMessage(chatId, { text: '❌ You have no Lower Health Potions!' }, { quoted: msg });
      }
      if (chosenTier === 'medium' && (player.inventory.mediumHealthPotions || 0) <= 0) {
        return sock.sendMessage(chatId, { text: '❌ You have no Medium Health Potions!' }, { quoted: msg });
      }
      if (chosenTier === 'higher' && (player.inventory.higherHealthPotions || 0) <= 0) {
        return sock.sendMessage(chatId, { text: '❌ You have no Higher Health Potions!' }, { quoted: msg });
      }

      const pct = chosenTier === 'lower' ? 0.10 : chosenTier === 'medium' ? 0.25 : 0.50;
      const tierName = chosenTier === 'lower' ? 'Lower Health Potion' : chosenTier === 'medium' ? 'Medium Health Potion' : 'Higher Health Potion';
      const tierEmoji = chosenTier === 'lower' ? '🩹' : chosenTier === 'medium' ? '🧪' : '🍷';

      const inBattleInfo = checkInBattle(player, db);

      // ── GATE RAID POTION CHECK (PARTY CAP: MAX 5) ─────────────
      if (inBattleInfo?.type === 'gateraid') {
        const gate = inBattleInfo.battle;
        if ((gate.potionsUsed || 0) >= 5) {
          return sock.sendMessage(chatId, {
            text: `❌ *Gate Raid Potion Limit Reached!*\n\nCollective party cap: *5/5 Health Potions used* in this raid.`
          }, { quoted: msg });
        }
        gate.potionsUsed = (gate.potionsUsed || 0) + 1;
      }

      // ── PVP CORRUPTED POTIONS: DEALS DAMAGE INSTEAD OF HEALING ─
      if (inBattleInfo?.type === 'pvp') {
        // Deduct potion
        if (chosenTier === 'lower') {
          if (player.inventory.lowerHealthPotions > 0) player.inventory.lowerHealthPotions--;
          else if (player.inventory.healthPotions > 0) player.inventory.healthPotions--;
        } else if (chosenTier === 'medium') {
          player.inventory.mediumHealthPotions--;
        } else if (chosenTier === 'higher') {
          player.inventory.higherHealthPotions--;
        }

        // Find PvP target
        const pvpState = player.pvpBattle || Object.values(db.pendingChallenges || {}).find(c => c.active && (c.challenger === sender || c.target === sender));
        const opponentId = pvpState ? (pvpState.challenger === sender ? pvpState.target : pvpState.challenger) : null;
        const opponent = opponentId ? db.users[opponentId] : null;

        const targetHp = opponent ? opponent.stats.maxHp : player.stats.maxHp;
        const damage = Math.floor(targetHp * pct);

        if (opponent) {
          opponent.stats.hp = Math.max(0, (opponent.stats.hp || targetHp) - damage);
        }

        saveDatabase();

        return sock.sendMessage(chatId, {
          text: [
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🩸 *PVP CORRUPTED POTION!*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `${tierEmoji} *${player.name}* used a ${tierName}!`,
            ``,
            `☠️ In PvP battles, health potions corrupt and deal damage!`,
            `💥 Dealt *${damage} damage* (${Math.floor(pct * 100)}% Max HP) to *${opponent ? opponent.name : 'Opponent'}*!`,
            opponent ? `❤️ Opponent HP: *${opponent.stats.hp}/${opponent.stats.maxHp}*` : ``,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ].filter(Boolean).join('\n'),
        }, { quoted: msg });
      }

      // ── STANDARD HEAL OUTSIDE PVP ─────────────────────────────
      if (player.stats.hp >= player.stats.maxHp) {
        return sock.sendMessage(chatId, {
          text: `❌ Your HP is already full!\n\n❤️ HP: ${player.stats.hp}/${player.stats.maxHp}`
        }, { quoted: msg });
      }

      const healAmount = Math.floor(player.stats.maxHp * pct);
      const oldHp = player.stats.hp;
      player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healAmount);
      const actualHeal = player.stats.hp - oldHp;

      // Deduct item
      if (chosenTier === 'lower') {
        if ((player.inventory.lowerHealthPotions || 0) > 0) player.inventory.lowerHealthPotions--;
        else if ((player.inventory.healthPotions || 0) > 0) player.inventory.healthPotions--;
      } else if (chosenTier === 'medium') {
        player.inventory.mediumHealthPotions--;
      } else if (chosenTier === 'higher') {
        player.inventory.higherHealthPotions--;
      }

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `💚 *${tierName.toUpperCase()} USED* 💚`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `${tierEmoji} *${player.name}* used ${tierName}!`,
          ``,
          `✨ Restored: *+${actualHeal} HP* (+${Math.floor(pct * 100)}%)`,
          `❤️ HP: *${player.stats.hp}/${player.stats.maxHp}*`,
          inBattleInfo ? `\n⚔️ Used in ${inBattleInfo.type}!` : ``,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════
    // 💙 USE ENERGY POTION
    // ═══════════════════════════════════════
    if (action === 'energy' || action === 'mana' || action === 'stamina' ||
        action === 'focus' || action === 'rage' || action === 'faith' ||
        action === 'blood' || action === 'dragon' || action === 'force') {

      const energyPotions = player.inventory.energyPotions || player.inventory.manaPotions || 0;

      if (energyPotions <= 0) {
        await sock.sendMessage(chatId, {
          text: `❌ You have no ${player.energyType || 'Mana'} Potions!\n\nBuy them at /shop`
        }, { quoted: msg });
        return;
      }

      if (player.stats.energy >= player.stats.maxEnergy) {
        await sock.sendMessage(chatId, {
          text: `❌ Your ${player.energyType || 'Mana'} is already full!\n\n${player.energyColor || '💙'} ${player.energyType || 'Mana'}: ${player.stats.energy}/${player.stats.maxEnergy}`
        }, { quoted: msg });
        return;
      }

      const restoreAmount = Math.floor(player.stats.maxEnergy * 0.5);
      const oldEnergy = player.stats.energy;
      player.stats.energy = Math.min(player.stats.maxEnergy, player.stats.energy + restoreAmount);
      const actualRestore = player.stats.energy - oldEnergy;

      if (player.inventory.energyPotions) player.inventory.energyPotions--;
      else                                 player.inventory.manaPotions--;

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `${player.energyColor || '💙'} *${(player.energyType || 'Mana').toUpperCase()} POTION USED* ${player.energyColor || '💙'}`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `💙 *${player.name}* used ${player.energyType || 'Mana'} Potion!`,
          ``,
          `✨ Restored: *+${actualRestore} ${player.energyType || 'Mana'}*`,
          `${player.energyColor || '💙'} ${player.energyType || 'Mana'}: *${player.stats.energy}/${player.stats.maxEnergy}*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════
    // 🎫 USE REVIVE TOKEN
    // ═══════════════════════════════════════
    if (action === 'revive' || action === 'revive-token') {
      if ((player.inventory.reviveTokens || 0) <= 0) {
        await sock.sendMessage(chatId, {
          text: '❌ You have no Revive Tokens!\nBuy them at /shop'
        }, { quoted: msg });
        return;
      }

      const inBattleInfo = checkInBattle(player, db);

      // ── GATE RAID REVIVE CHECK (PARTY CAP: MAX 1 PER RAID) ──────
      if (inBattleInfo?.type === 'gateraid') {
        const gate = inBattleInfo.battle;
        if ((gate.revivesUsed || 0) >= 1) {
          return sock.sendMessage(chatId, {
            text: `❌ *Gate Raid Revive Limit Reached!*\n\nOnly 1 Revive Token can be used collectively per party in a Gate Raid.`
          }, { quoted: msg });
        }
        gate.revivesUsed = 1;
        // Re-add player to raiders if removed
        if (gate.raid && !gate.raid.members.some(m => m.id === sender)) {
          gate.raid.members.push({ id: sender, name: player.name, hp: Math.floor(player.stats.maxHp * 0.5), energy: player.stats.energy, ready: true });
        }
      }

      const restoreHp = Math.floor(player.stats.maxHp * 0.5);
      player.stats.hp = Math.min(player.stats.maxHp, restoreHp);
      player.inventory.reviveTokens--;
      saveDatabase();

      await sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎫 REVIVE TOKEN USED 🎫
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💫 *${player.name}* used a Revive Token!

✨ Restored: *${player.stats.hp}/${player.stats.maxHp} HP*
🎫 Tokens Left: ${player.inventory.reviveTokens}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
      return;
    }

    await sock.sendMessage(chatId, {
      text: '❌ Invalid option!\nUse: /use lower | /use medium | /use higher | /use heal | /use energy | /use revive'
    }, { quoted: msg });
  }
};
