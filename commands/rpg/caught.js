// ═══════════════════════════════════════════════════════════════
// CAUGHT — catch a wild pet spawned by a gate raid
//   /caught <token>
// A wild pet appears after clearing a gate. It flees in 60s.
// ═══════════════════════════════════════════════════════════════
'use strict';

const PetManager = require('../../rpg/utils/PetManager');
const { PET_DATABASE } = require('../../rpg/utils/PetDatabase');

function bare(jid) {
  return String(jid).split(':')[0].split('@')[0];
}

module.exports = {
  name: 'caught',
  aliases: ['capturepet', 'catchpet'],
  description: '🪤 Catch a wild pet spawned by a gate raid',
  usage: '/caught <token>',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first.' }, { quoted: msg });

    const token = (args[0] || '').trim();
    if (!token) {
      return sock.sendMessage(chatId, {
        text: `🪤 *WILD PET CATCH*\n\nUsage: /caught <token>\n\nA token is shown on the gate-clear message.\nThe pet flees in 60s!`,
      }, { quoted: msg });
    }

    if (!Array.isArray(db.wildPets)) db.wildPets = [];
    // Purge expired / already-caught
    db.wildPets = db.wildPets.filter(w => w.expiresAt > Date.now() && !w.caughtBy);

    const wild = db.wildPets.find(w => w.token === token);
    if (!wild) return sock.sendMessage(chatId, { text: '❌ That wild pet is no longer available (fled or expired).' }, { quoted: msg });

    if (!wild.forJids || !wild.forJids.some(j => bare(j) === bare(sender))) {
      return sock.sendMessage(chatId, { text: '❌ This wild pet only appears for the raid members who cleared the gate.' }, { quoted: msg });
    }

    const petTemplate = PET_DATABASE[wild.petId];
    if (!petTemplate) return sock.sendMessage(chatId, { text: '❌ Unknown pet data.' }, { quoted: msg });

    // Costed catch (attempt) — the pet is caught per-player
    const catchCosts = {
      common:    { gold: 20000,   crystals: 500 },
      uncommon:  { gold: 40000,   crystals: 1000 },
      rare:      { gold: 80000,   crystals: 2000 },
      epic:      { gold: 200000,  crystals: 5000 },
      legendary: { gold: 500000,  crystals: 10000 },
      mythic:    { gold: 1000000, crystals: 20000 },
    };
    const cost = catchCosts[wild.rarity] || catchCosts.common;

    if ((player.gold || 0) < cost.gold || (player.manaCrystals || 0) < cost.crystals) {
      return sock.sendMessage(chatId, {
        text: `❌ Not enough to catch *${wild.emoji} ${wild.name}* (${wild.rarity.toUpperCase()}).\n\n💠 Need: ${cost.gold.toLocaleString()} Nexus + ${cost.crystals} 💎\n💠 You have: ${(player.gold || 0).toLocaleString()} Nexus + ${(player.manaCrystals || 0)} 💎`,
      }, { quoted: msg });
    }

    player.gold = (player.gold || 0) - cost.gold;
    player.manaCrystals = (player.manaCrystals || 0) - cost.crystals;
    if (!player.inventory) player.inventory = {};
    player.inventory.gold = player.gold;

    const result = PetManager.attemptCatch(sender, wild.petId, 0, false);

    if (!result.success) {
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `💨 *${wild.name}* broke free! (${Math.floor(Math.max(5, (petTemplate.catchRate || 50) * 0.5))}% catch rate)\n\n💸 Attempt cost: ${cost.gold.toLocaleString()} 💠 + ${cost.crystals} 💎\nTry /caught ${token} again!`,
      }, { quoted: msg });
    }

    // Success — mark this player as having caught this spawn so it's consumed
    wild.caughtBy = wild.caughtBy || [];
    if (!Array.isArray(wild.caughtBy)) wild.caughtBy = [];
    wild.caughtBy.push(sender);
    if (wild.caughtBy.length >= (wild.forJids || []).length) {
      // everyone had a go — remove
      db.wildPets = db.wildPets.filter(w => w.token !== token);
    }
    saveDatabase();

    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🎉 *PET CAUGHT!*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `${result.pet.emoji} You caught a *${result.pet.name}*!`,
        `⭐ Rarity: ${result.pet.rarity.toUpperCase()}`,
        `🔮 Type: ${result.pet.type}`,
        ``,
        `💸 Paid: ${cost.gold.toLocaleString()} 💠 + ${cost.crystals} 💎`,
        result.isFirstPet ? `\n✨ This is your first pet!` : ``,
        ``,
        `Use /pet list to view it.`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].filter(l => l !== '').join('\n'),
    }, { quoted: msg });
  },
};
