// ═══════════════════════════════════════════════════════════════
// /catch — Universal Wild Pet Catching Command
//
// Works in both Solo Dungeons and Gate Raids!
// - 60 second catch window when a wild pet spawns
// - Costs Nexus + Mana Stones scaled by pet rarity
// - Cost deducted regardless of success or failure
// - Rolls up to 3 attempts per /catch execution
// ═══════════════════════════════════════════════════════════════

'use strict';

const PetManager = require('../../rpg/utils/PetManager');
const DungeonPartyManager = require('../../rpg/dungeons/DungeonPartyManager');
const AchievementManager = require('../../rpg/utils/AchievementManager');
const { PET_DATABASE } = require('../../rpg/utils/PetDatabase');

function bare(jid) {
  return String(jid || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
}

const CATCH_COSTS = {
  common:    { gold: 20000,   crystals: 500 },
  uncommon:  { gold: 40000,   crystals: 1000 },
  rare:      { gold: 80000,   crystals: 2000 },
  epic:      { gold: 200000,  crystals: 5000 },
  legendary: { gold: 500000,  crystals: 10000 },
  mythic:    { gold: 1000000, crystals: 20000 }
};

const BASE_CATCH_RATES = {
  common: 70,
  uncommon: 55,
  rare: 40,
  epic: 25,
  legendary: 15,
  mythic: 8
};

module.exports = {
  name: 'catch',
  aliases: ['capture', 'caught', 'capturepet', 'catchpet'],
  description: '🪤 Catch a wild pet in dungeons or gate raids',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You need to register first!' }, { quoted: msg });
    }
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const sBare = bare(sender);
    const now = Date.now();

    // ── 1. Find wild pet in Solo Dungeon or Gate Raid ───────────
    let petId = null;
    let wildRecord = null;
    let isDungeonPet = false;
    let party = DungeonPartyManager.getPartyByPlayer(sender);

    // Check Solo Dungeon pending pet
    if (party && party.status === 'active' && party.dungeon?.pendingPet) {
      petId = party.dungeon.pendingPet;
      isDungeonPet = true;
    }

    // Check Gate Raid wild pet in db.wildPets
    if (!petId && Array.isArray(db.wildPets)) {
      db.wildPets = db.wildPets.filter(w => w.expiresAt > now && (!w.caughtBy || !w.caughtBy.includes(sender)));
      wildRecord = db.wildPets.find(w => w.forJids && w.forJids.some(j => bare(j) === sBare));
      if (wildRecord) {
        petId = wildRecord.petId;
      }
    }

    if (!petId) {
      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `🪤 *WILD PET CATCH* 💎`, UI.PRO_BAR] : [`🪤 *WILD PET CATCH*`, UI.FREE_BAR]),
          `❌ No active wild pet to catch nearby!`,
          ``,
          `Wild pets appear after clearing dungeons or gate raids.`,
          `They flee after *60 seconds*!`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO CATCH* — no wild pets nearby`] : [UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    const petTemplate = PET_DATABASE[petId];
    if (!petTemplate) {
      return sock.sendMessage(chatId, { text: '❌ Unknown pet data encountered.' }, { quoted: msg });
    }

    const rarity = (petTemplate.rarity || 'common').toLowerCase();
    const cost = CATCH_COSTS[rarity] || CATCH_COSTS.common;
    const baseRate = BASE_CATCH_RATES[rarity] || 50;

    // Check funds
    if ((player.gold || 0) < cost.gold || (player.manaCrystals || 0) < cost.crystals) {
      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `❌ *INSUFFICIENT FUNDS TO CATCH!* 💎`, UI.PRO_BAR] : [`❌ *INSUFFICIENT FUNDS TO CATCH!*`, UI.FREE_BAR]),
          `${petTemplate.emoji} Target: *${petTemplate.name}* (${rarity.toUpperCase()})`,
          ``,
          `💸 Required: ${cost.gold.toLocaleString()} 💠 Nexus + ${cost.crystals.toLocaleString()} 💎 Mana Stones`,
          `💼 You have: ${(player.gold || 0).toLocaleString()} 💠 Nexus + ${(player.manaCrystals || 0).toLocaleString()} 💎 Mana Stones`,
          ``,
          `⚠️ The pet will flee if you don't catch it in 60s!`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO CATCH* — target: ${petTemplate.name}`] : [UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // Deduct cost immediately (failing costs as much as success)
    player.gold = (player.gold || 0) - cost.gold;
    player.manaCrystals = (player.manaCrystals || 0) - cost.crystals;
    if (!player.inventory) player.inventory = {};
    player.inventory.gold = player.gold;

    // Luck Potion check
    const luckIdx = (player.inventory?.items || []).findIndex(i => i.name === 'Luck Potion' || i.isLuckPotion);
    const luckBonus = luckIdx !== -1 ? 25 : 0;
    if (luckIdx !== -1) {
      player.inventory.items.splice(luckIdx, 1);
    }

    // Paladin class gets guaranteed catch
    const playerClass = typeof player.class === 'string' ? player.class : player.class?.name;
    const isGuaranteed = playerClass === 'Paladin';

    const finalRate = Math.min(95, baseRate + luckBonus);

    // Roll 3 catch attempts in 60s
    let rolls = [];
    let success = false;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const roll = Math.floor(Math.random() * 100) + 1;
      const pass = isGuaranteed || roll <= finalRate;
      if (pass) {
        rolls.push(`🎯 *Roll ${attempt}:* 🎉 *SUCCESS!* (${roll} ≤ ${finalRate}%)`);
        success = true;
        break;
      } else {
        rolls.push(`🎯 *Roll ${attempt}:* 💨 Broke free! (${roll} > ${finalRate}%)`);
      }
    }

    let resultMsg = '';

    if (success) {
      const catchRes = PetManager.attemptCatch(sender, petId, luckBonus, true);

      // Clean up wild pet
      if (isDungeonPet && party?.dungeon) {
        party.dungeon.pendingPet = null;
      }
      if (wildRecord) {
        wildRecord.caughtBy = wildRecord.caughtBy || [];
        wildRecord.caughtBy.push(sender);
      }

      saveDatabase();

      // Achievements & Quests via ActivityTracker
      try {
        const { trackActivity } = require('../../rpg/utils/ActivityTracker');
        const petCount = Object.keys(PetManager.getPlayerPets ? PetManager.getPlayerPets(sender) : {}).length;
        await trackActivity(player, 'pets_caught', 1, { rarity }, sock, sender, chatId);
        await trackActivity(player, 'pets_owned', petCount, {}, sock, sender, chatId);
      } catch (e) {}

      resultMsg = [
        ...(pro ? [UI.PRO_BAR, `🎉 *PET CAUGHT SUCCESSFULLY!* 💎`, UI.PRO_BAR] : [`🎉 *PET CAUGHT SUCCESSFULLY!*`, UI.FREE_BAR]),
        `${petTemplate.emoji} You caught a *${petTemplate.name}*!`,
        `⭐ Rarity: ${rarity.toUpperCase()}`,
        `🔮 Type: ${petTemplate.type || 'Companion'}`,
        ``,
        `💸 Cost Paid: ${cost.gold.toLocaleString()} 💠 + ${cost.crystals.toLocaleString()} 💎`,
        luckBonus > 0 ? `🍀 Luck Potion used (+25% catch rate)` : ``,
        ``,
        `📋 *CATCH ROLL BREAKDOWN (60s Window):*`,
        ...rolls,
        ``,
        `📌 Use */pet list* to view your active pets!`,
        FRAME,
        ...(pro ? [UI.PRO_MINI, `💎 *PRO CATCH* — ${petTemplate.name} · ${rarity.toUpperCase()}`] : [UI.upsell()]),
      ].filter(l => l !== '').join('\n');
    } else {
      // Failed all 3 rolls
      if (isDungeonPet && party?.dungeon) {
        party.dungeon.pendingPet = null;
      }
      saveDatabase();

      resultMsg = [
        ...(pro ? [UI.PRO_BAR, `💨 *WILD PET ESCAPED!* 💎`, UI.PRO_BAR] : [`💨 *WILD PET ESCAPED!*`, UI.FREE_BAR]),
        `${petTemplate.emoji} *${petTemplate.name}* broke free and fled!`,
        `⭐ Rarity: ${rarity.toUpperCase()}`,
        ``,
        `💸 Cost Paid: ${cost.gold.toLocaleString()} 💠 + ${cost.crystals.toLocaleString()} 💎 (attempt cost)`,
        luckBonus > 0 ? `🍀 Luck Potion consumed` : ``,
        ``,
        `📋 *CATCH ROLL BREAKDOWN (3 Attempts):*`,
        ...rolls,
        ``,
        `🏃 The wild pet escaped into the shadows. Better luck next time!`,
        FRAME,
        ...(pro ? [UI.PRO_MINI, `💎 *PRO CATCH* — ${petTemplate.name} fled`] : [UI.upsell()]),
      ].filter(l => l !== '').join('\n');
    }

    return sock.sendMessage(chatId, { text: resultMsg }, { quoted: msg });
  }
};
