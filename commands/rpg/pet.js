const PetManager = require('../../rpg/utils/PetManager');
const { PET_DATABASE, PET_FOOD, EGG_TYPES } = require('../../rpg/utils/PetDatabase');

module.exports = {
  name: 'pet',
  aliases: ['pets', 'companion'],
  description: 'Manage your pet companions',
  usage: '/pet <list|eggs|hatch|info|active|feed|evolve|rename|release|foods>',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    try {
      const chatId = msg.key.remoteJid;
      const db     = getDatabase();
      const player = db.users[sender];

      if (!player) {
        return sock.sendMessage(chatId, { text: '❌ Use /register first!' }, { quoted: msg });
      }

      PetManager.updateHunger(sender);
      const sub = (args[0] || 'list').toLowerCase();

      // ── LIST PETS ───────────────────────────────────────────
      if (sub === 'list' || sub === 'collection' || sub === 'all') {
        const pets = PetManager.getPlayerPets(sender);
        const eggs = PetManager.getPlayerEggs(sender);
        const active = PetManager.getActivePet(sender);

        if (pets.length === 0 && eggs.length === 0) {
          return sock.sendMessage(chatId, {
            text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🐾 *NO PETS YET*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nFind eggs in dungeons and hatch them!\n\n🥚 Eggs drop from dungeon floors\n🐣 /pet hatch [#] to hatch an egg\n⚔️ Attack pets fight with you\n💚 Support pets heal you\n💠 Scavenger pets find extra loot\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          }, { quoted: msg });
        }

        const roleEmoji = { attack: '⚔️', support: '💚', scavenger: '💰' };
        let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🐾 *YOUR PETS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

        pets.forEach((pet, i) => {
          const isActive = active?.instanceId === pet.instanceId;
          const re = roleEmoji[pet.role] || '⚔️';
          txt += `${isActive ? '▶️' : `${i+1}.`} ${pet.emoji} *${pet.nickname || pet.name}* ${re}\n`;
          txt += `   Lv.${pet.level} | ${pet.rarity.toUpperCase()} | ${pet.role?.toUpperCase()}\n`;
          txt += `   💕 ${pet.bonding}/100 | 😊 ${pet.happiness}/100 | 🍖 ${pet.hunger}/100\n\n`;
        });

        if (eggs.length > 0) {
          txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🥚 *EGGS (${eggs.length}/5)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          eggs.forEach((egg, i) => {
            txt += `${i+1}. ${egg.emoji} *${egg.name}* [${egg.rarity.toUpperCase()}]\n   ${egg.desc}\n\n`;
          });
          txt += `/pet hatch [#] to hatch an egg\n`;
        }

        txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/pet info [#] | /pet active [#]\n/pet feed [#] [food] | /pet evolve [#]`;
        return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
      }

      // ── EGGS ────────────────────────────────────────────────
      if (sub === 'eggs' || sub === 'egg') {
        const eggs = PetManager.getPlayerEggs(sender);
        if (eggs.length === 0) {
          return sock.sendMessage(chatId, {
            text: `🥚 *No eggs yet!*\nFind eggs by exploring dungeons.\n\nEgg rarities:\n⚪ Common Egg — 65% chance\n🔥 Fire Egg — 25% chance\n🌑 Shadow Egg — 8% chance\n✨ Ancient Egg — 2% chance`
          }, { quoted: msg });
        }
        let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🥚 *YOUR EGGS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        eggs.forEach((egg, i) => {
          txt += `*${i+1}.* ${egg.emoji} *${egg.name}* [${egg.rarity.toUpperCase()}]\n   ${egg.desc}\n\n`;
        });
        txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/pet hatch [#] to hatch`;
        return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
      }

      // ── HATCH EGG ────────────────────────────────────────────
      if (sub === 'hatch') {
        const eggIdx = parseInt(args[1]) - 1;
        if (isNaN(eggIdx) || eggIdx < 0) {
          return sock.sendMessage(chatId, { text: '❌ Usage: /pet hatch [egg number]\nSee /pet eggs' }, { quoted: msg });
        }
        const result = PetManager.hatchEgg(sender, eggIdx);
        return sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
      }

      // ── PET INFO ────────────────────────────────────────────
      if (sub === 'info' || sub === 'view' || sub === 'stats') {
        const idx = parseInt(args[1]) - 1;
        const pets = PetManager.getPlayerPets(sender);
        if (isNaN(idx) || !pets[idx]) {
          return sock.sendMessage(chatId, { text: `❌ Choose 1-${pets.length}\n/pet list to see your pets` }, { quoted: msg });
        }
        const pet = pets[idx];
        const statsStr = PetManager.getPetStatsString(pet);
        const roleDesc = {
          attack:    '⚔️ *Attack* — Fights alongside you, dealing damage',
          support:   '💚 *Support* — Heals you and buffs your stats',
          scavenger: '💠 *Scavenger* — Finds extra gold and items after fights (but is weak!)',
        }[pet.role] || '⚔️ Attack';

        let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${statsStr}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${roleDesc}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ *Abilities:*\n`;
        pet.abilities.forEach(a => { txt += `• *${a.name}* — ${a.desc}\n`; });
        if (pet.evolution) {
          txt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌟 *Evolution* (Lv.${pet.evolution.level}):\n`;
          pet.evolution.options.forEach(o => { txt += `• ${o.name}\n`; });
          txt += `/pet evolve ${idx+1} [id] to evolve`;
        }
        return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
      }

      // ── SET/SHOW ACTIVE PET ─────────────────────────────────
      if (sub === 'active' || sub === 'set' || sub === 'current') {
        const pets = PetManager.getPlayerPets(sender);
        if (args[1]) {
          const idx = parseInt(args[1]) - 1;
          if (isNaN(idx) || !pets[idx]) return sock.sendMessage(chatId, { text: `❌ Choose 1-${pets.length}` }, { quoted: msg });
          const result = PetManager.setActivePet(sender, pets[idx].instanceId);
          return sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
        }
        const pet = PetManager.getActivePet(sender);
        if (!pet) return sock.sendMessage(chatId, { text: '❌ No active pet! Use /pet active [#]' }, { quoted: msg });
        return sock.sendMessage(chatId, { text: `▶️ Active pet:\n${PetManager.getPetStatsString(pet)}` }, { quoted: msg });
      }

      // ── FEED ────────────────────────────────────────────────
      if (sub === 'feed') {
        const idx = parseInt(args[1]) - 1;
        const foodName = args.slice(2).join(' ');
        const pets = PetManager.getPlayerPets(sender);
        if (isNaN(idx) || !pets[idx] || !foodName) {
          return sock.sendMessage(chatId, { text: '❌ Usage: /pet feed [#] [food]\nSee /pet foods' }, { quoted: msg });
        }
        const result = PetManager.feedPet(sender, pets[idx].instanceId, foodName);
        return sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
      }

      // ── FOODS LIST ──────────────────────────────────────────
      if (sub === 'foods' || sub === 'food') {
        let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🍖 *PET FOOD*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        Object.values(PET_FOOD).forEach(f => {
          txt += `${f.emoji} *${f.name}* — ${f.cost.toLocaleString()}g\n`;
          txt += `   Hunger -${f.hungerRestore} | Bonding +${f.bondingBonus} | XP +${f.xpBonus}\n\n`;
        });
        txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/pet feed [#] [food name]`;
        return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
      }

      // ── EVOLVE ──────────────────────────────────────────────
      if (sub === 'evolve') {
        const idx = parseInt(args[1]) - 1;
        const choice = args[2];
        const pets = PetManager.getPlayerPets(sender);
        if (isNaN(idx) || !pets[idx]) {
          return sock.sendMessage(chatId, { text: '❌ Usage: /pet evolve [#] [evolution_id]\nSee /pet info [#] for options' }, { quoted: msg });
        }
        const pet = pets[idx];
        if (!pet.evolution) return sock.sendMessage(chatId, { text: '❌ This pet cannot evolve!' }, { quoted: msg });
        if (!choice) {
          let txt = `🌟 *${pet.name}* can evolve at Lv.${pet.evolution.level}!\n\n*Options:*\n`;
          pet.evolution.options.forEach(o => { txt += `• \`${o.id}\` — ${o.name}\n`; });
          txt += `\nUse: /pet evolve ${idx+1} [id]`;
          return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
        }
        const result = PetManager.evolvePet(sender, pet.instanceId, choice);
        return sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
      }

      // ── RENAME ──────────────────────────────────────────────
      if (sub === 'rename' || sub === 'nickname') {
        const idx = parseInt(args[1]) - 1;
        const name = args.slice(2).join(' ');
        const pets = PetManager.getPlayerPets(sender);
        if (isNaN(idx) || !pets[idx] || !name) {
          return sock.sendMessage(chatId, { text: '❌ Usage: /pet rename [#] [name]' }, { quoted: msg });
        }
        const result = PetManager.renamePet(sender, pets[idx].instanceId, name);
        return sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
      }

      // ── RELEASE ─────────────────────────────────────────────
      if (sub === 'release' || sub === 'delete') {
        const idx = parseInt(args[1]) - 1;
        const pets = PetManager.getPlayerPets(sender);
        if (isNaN(idx) || !pets[idx]) {
          return sock.sendMessage(chatId, { text: '❌ Usage: /pet release [#]' }, { quoted: msg });
        }
        const result = PetManager.releasePet(sender, pets[idx].instanceId);
        return sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
      }

      // ── DEFAULT / HELP ───────────────────────────────────────
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🐾 *PET SYSTEM*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🥚 Find eggs in dungeons\n🐣 Hatch them to get pets\n📈 Level pets up through battles\n🌟 Evolve at level 10\n\n*Pet Roles:*\n⚔️ Attack — fights with you\n💚 Support — heals & buffs you\n💠 Scavenger — finds extra gold/loot\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *COMMANDS*\n/pet list           — All pets\n/pet eggs           — Your eggs\n/pet hatch [#]      — Hatch egg\n/pet info [#]       — Pet details\n/pet active [#]     — Set active\n/pet feed [#] [food] — Feed pet\n/pet foods          — Food list\n/pet evolve [#]     — Evolve\n/pet rename [#] [name] — Rename\n/pet release [#]    — Release\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });

    } catch(err) {
      console.error('[Pet] Error:', err.message);
      return sock.sendMessage(msg.key.remoteJid, { text: '❌ Pet system error. Try again.' }, { quoted: msg });
    }
  }
};