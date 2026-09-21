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
      const UI = require('../../rpg/utils/UI');
      const pro = UI.isPro(player);
      const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

      PetManager.updateHunger(sender);
      const sub = (args[0] || 'list').toLowerCase();

      // ── LIST PETS ───────────────────────────────────────────
      if (sub === 'list' || sub === 'collection' || sub === 'all') {
        const pets = PetManager.getPlayerPets(sender);
        const eggs = PetManager.getPlayerEggs(sender);
        const active = PetManager.getActivePet(sender);

        if (pets.length === 0 && eggs.length === 0) {
          return sock.sendMessage(chatId, {
            text: (pro ? `${UI.PRO_BAR}\n🐾 *NO PETS YET* 💎\n${UI.PRO_BAR}\n` : `🐾 *NO PETS YET*\n${UI.FREE_BAR}\n`) + `Find eggs in dungeons and hatch them!\n\n🥚 Eggs drop from dungeon floors\n🐣 /pet hatch [#] to hatch an egg\n⚔️ Attack pets fight with you\n💚 Support pets heal you\n💠 Scavenger pets find extra loot\n${FRAME}` + (pro ? '' : `\n${UI.upsell()}`)
          }, { quoted: msg });
        }

        const roleEmoji = { attack: '⚔️', support: '💚', scavenger: '💰' };
        let txt = pro ? `${UI.PRO_BAR}\n🐾 *YOUR PETS* 💎\n${UI.PRO_BAR}\n` : `🐾 *YOUR PETS*\n${UI.FREE_BAR}\n`;

        pets.forEach((pet, i) => {
          const isActive = active?.instanceId === pet.instanceId;
          const re = roleEmoji[pet.role] || '⚔️';
          let _g = ''; try { _g = require('../../rpg/utils/PetBreeding').genderIcon(pet); } catch (e) {}
          txt += `${isActive ? '▶️' : `${i+1}.`} ${pet.emoji} *${pet.nickname || pet.name}* ${_g} ${re}\n`;
          txt += `   Lv.${pet.level} | ${pet.rarity.toUpperCase()} | ${pet.role?.toUpperCase()}\n`;
          txt += `   💕 ${pet.bonding}/100 | 😊 ${pet.happiness}/100 | 🍖 ${pet.hunger}/100\n\n`;
        });

        if (eggs.length > 0) {
          txt += `${FRAME}\n🥚 *EGGS (${eggs.length}/5)*\n${FRAME}\n`;
          eggs.forEach((egg, i) => {
            txt += `${i+1}. ${egg.emoji} *${egg.name}* [${egg.rarity.toUpperCase()}]\n   ${egg.desc}\n\n`;
          });
          txt += `/pet hatch [#] to hatch an egg\n`;
        }

        txt += `${FRAME}\n/pet info [#] | /pet active [#]\n/pet feed [#] [food] | /pet evolve [#]` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO PACK* — ${pets.length} pets · active: ${active ? (active.nickname || active.name) : 'none'}` : `\n${UI.upsell()}`);
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
        let txt = pro ? `${UI.PRO_BAR}\n🥚 *YOUR EGGS* 💎\n${UI.PRO_BAR}\n` : `🥚 *YOUR EGGS*\n${UI.FREE_BAR}\n`;
        eggs.forEach((egg, i) => {
          txt += `*${i+1}.* ${egg.emoji} *${egg.name}* [${egg.rarity.toUpperCase()}]\n   ${egg.desc}\n\n`;
        });
        txt += `${FRAME}\n/pet hatch [#] to hatch` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO CLUTCH* — ${eggs.length}/5 eggs` : `\n${UI.upsell()}`);
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
          scavenger: '💠 *Scavenger* — Finds extra Nexus and items after fights (but is weak!)',
        }[pet.role] || '⚔️ Attack';

        let txt = `${FRAME}\n${statsStr}${pro ? ' 💎' : ''}\n${FRAME}\n${roleDesc}\n${FRAME}\n⚡ *Abilities:*\n`;
        pet.abilities.forEach(a => { txt += `• *${a.name}* — ${a.desc}\n`; });
        if (pet.evolution) {
          txt += `\n${FRAME}\n🌟 *Evolution* (Lv.${pet.evolution.level}):\n`;
          pet.evolution.options.forEach(o => { txt += `• ${o.name}\n`; });
          txt += `/pet evolve ${idx+1} [id] to evolve`;
        }
        // Push #55: lore + origin card, and what the pet actually does in a fight.
        let _loreBlock = '';
        try { _loreBlock = require('../../rpg/utils/PetLore').render(pet); } catch (e) {}
        let _liveLine = '';
        try { _liveLine = require('../../rpg/utils/PetCombat').statusLine(sender); } catch (e) {}
        if (_loreBlock) txt += `\n${FRAME}\n${_loreBlock}\n${FRAME}`;
        const _isActive = PetManager.getActivePet(sender)?.instanceId === pet.instanceId;
        if (_isActive && _liveLine) txt += `\n${_liveLine}`;
        txt += `\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO BOND* — 💕 ${pet.bonding}/100 · 😊 ${pet.happiness}/100 · 🍖 ${pet.hunger}/100` : `\n${UI.upsell()}`);
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

      // ── PLAY ────────────────────────────────────────────────
      if (sub === 'play') {
        const idx = parseInt(args[1]) - 1;
        const pets = PetManager.getPlayerPets(sender);
        const targetPet = isNaN(idx) ? PetManager.getActivePet(sender) : pets[idx];
        if (!targetPet) return sock.sendMessage(chatId, { text: '❌ No pet selected! Choose a pet: /pet play [#]' }, { quoted: msg });
        const result = PetManager.playWithPet(sender, targetPet.instanceId);
        return sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
      }

      // ── TRAIN ───────────────────────────────────────────────
      if (sub === 'train') {
        const idx = parseInt(args[1]) - 1;
        const pets = PetManager.getPlayerPets(sender);
        const targetPet = isNaN(idx) ? PetManager.getActivePet(sender) : pets[idx];
        if (!targetPet) return sock.sendMessage(chatId, { text: '❌ No pet selected! Choose a pet: /pet train [#]' }, { quoted: msg });
        const result = PetManager.trainPet(sender, targetPet.instanceId);
        if (result && result.success) {
          try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'pet', 1, sock, sender, chatId); } catch(e){}
          saveDatabase();
        }
        return sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
      }

      // ── FEED ────────────────────────────────────────────────
      if (sub === 'feed') {
        const idx = parseInt(args[1]) - 1;
        const foodName = args.slice(2).join(' ');
        const pets = PetManager.getPlayerPets(sender);
        if (isNaN(idx) || !pets[idx] || !foodName) {
          return sock.sendMessage(chatId, { text: '❌ Usage: /pet feed [#] [food]\nSee /pet foods' }, { quoted: msg });
        }
        const result = PetManager.feedPet(sender, pets[idx].instanceId, foodName, player);
        if (result && result.success) {
          try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'feed', 1, sock, sender, chatId); } catch(e){}
          saveDatabase();
        }
        return sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
      }

      // ── BUY FOOD (Push #71: shop → inventory → feed) ────────
      if (sub === 'buy') {
        const PDB = require('../../rpg/utils/PetDatabase');
        const qty = Math.max(1, Math.min(99, parseInt(args[args.length - 1]) || 1));
        const nameArgs = (!isNaN(parseInt(args[args.length - 1])) && args.length > 2) ? args.slice(1, -1) : args.slice(1);
        const food = PDB.resolvePetFood(nameArgs.join(' '));
        if (!food) return sock.sendMessage(chatId, { text: '❌ Usage: /pet buy <food> [qty]\nSee /pet foods for names.' }, { quoted: msg });
        const total = food.cost * qty;
        if ((player.gold || 0) < total) {
          return sock.sendMessage(chatId, { text: `❌ Not enough Nexus.\n${food.emoji} ${food.name} ×${qty} = 💠 ${total.toLocaleString()}\nYou have: 💠 ${(player.gold || 0).toLocaleString()}` }, { quoted: msg });
        }
        player.gold -= total;
        if (player.inventory) player.inventory.gold = player.gold;
        const now = PDB.addPetFood(player, food.id, qty);
        try { require('../../rpg/utils/TransactionLog').logSpend(player, 'pet_food', total, 0, `${food.name} ×${qty}`); } catch (e) {}
        saveDatabase();
        return sock.sendMessage(chatId, { text: `${FRAME}\n🛍️ *PET FOOD BOUGHT*\n${FRAME}\n${food.emoji} *${food.name}* ×${qty} → 🎒 inventory (now ×${now})\n💠 Paid: ${total.toLocaleString()} Nexus · Balance: ${(player.gold || 0).toLocaleString()}\n\n🍖 Feed: /pet feed [#] ${food.id}\n${FRAME}` }, { quoted: msg });
      }

      // ── FOODS LIST ──────────────────────────────────────────
      if (sub === 'foods' || sub === 'food' || sub === 'shop') {
        const PDB = require('../../rpg/utils/PetDatabase');
        PDB.normalisePetFood(player);
        let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🍖 *PET FOOD SHOP* (💠 Nexus)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💠 Balance: *${(player.gold || 0).toLocaleString()}*\n\n`;
        Object.entries(PET_FOOD).forEach(([id, f]) => {
          const have = PDB.petFoodCount(player, id);
          txt += `${f.emoji} *${f.name}* — 💠 ${f.cost.toLocaleString()} Nexus${have ? `  _(owned ×${have})_` : ''}\n`;
          txt += `   Hunger -${f.hungerRestore} | Bonding +${f.bondingBonus} | XP +${f.xpBonus}  ·  \`/pet buy ${id}\`\n\n`;
        });
        txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🛒 /pet buy <food> [qty]  →  🎒 /food  →  🍖 /pet feed [#] <food>`;
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
      // ── Push #74: MATING / GIVE ───────────────────────────────
      if (sub === 'mate' || sub === 'breed') {
        const PB = require('../../rpg/utils/PetBreeding');
        const a1 = (args[1] || '').toLowerCase();
        // Push #84: multi-message mating session (5 scenes → egg reveal).
        const _playMating = async (r) => {
          if (!r.success || !r.male || !r.female) return sock.sendMessage(chatId, { text: r.message }, { quoted: msg });
          const scenes = PB.courtshipScenes(r.male, r.female, r);
          for (const sc of scenes) {
            try { await sock.sendMessage(chatId, { text: sc }); } catch (e) {}
            await new Promise(res => setTimeout(res, 1800));
          }
          return sock.sendMessage(chatId, { text: r.message }, { quoted: msg });
        };
        if (a1 === 'accept') { const r = PB.accept(sender); return _playMating(r); }
        if (a1 === 'decline' || a1 === 'reject') { const r = PB.decline(sender); return sock.sendMessage(chatId, { text: r.message }, { quoted: msg }); }
        const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
        const other = ctx.mentionedJid?.[0] || ctx.participant || null;
        if (!args[1]) {
          return sock.sendMessage(chatId, { text: [
            `💞 *PET MATING*`,
            `/pet mate <my#> <my#>            — two of your own pets (♂️ + ♀️)`,
            `/pet mate <my ♂️#> @player <their ♀️#> — cross-player (they /pet mate accept)`,
            `/pet mate accept | decline`,
            ``,
            `Rules: opposite genders, both Lv.${PB.MIN_LEVEL}+, happy & fed, compatible species. The ♀️ owner gets the egg. Hybrids happen!`,
            `Genders show in /pet list (♂️/♀️).`,
          ].join('\n') }, { quoted: msg });
        }
        if (other && other !== sender) {
          const male = PB.findPet(sender, args[1]);
          const theirRef = args.find((a, i) => i >= 2 && /^\d+$/.test(a)) || args[args.length - 1];
          const female = PB.findPet(other, theirRef);
          if (!male) return sock.sendMessage(chatId, { text: '❌ Your pet not found. /pet list' }, { quoted: msg });
          if (!female) return sock.sendMessage(chatId, { text: `❌ Their pet #${theirRef} not found.` }, { quoted: msg });
          const r = PB.propose(sender, male, other, female);
          return sock.sendMessage(chatId, { text: r.message, mentions: [other] }, { quoted: msg });
        }
        const p1 = PB.findPet(sender, args[1]); const p2 = PB.findPet(sender, args[2]);
        if (!p1 || !p2) return sock.sendMessage(chatId, { text: '❌ Usage: /pet mate <#> <#> — see /pet list' }, { quoted: msg });
        const male = PB.genderOf(p1) === 'male' ? p1 : p2; const female = male === p1 ? p2 : p1;
        const r = PB.breed(sender, male, sender, female);
        return _playMating(r);
      }
      if (sub === 'give' || sub === 'gift' || sub === 'transfer') {
        const PB = require('../../rpg/utils/PetBreeding');
        const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
        const to = ctx.mentionedJid?.[0] || ctx.participant || null;
        if (!to) return sock.sendMessage(chatId, { text: '❌ Usage: /pet give <#> @player (mention or reply)' }, { quoted: msg });
        const pet = PB.findPet(sender, args[1]);
        if (!pet) return sock.sendMessage(chatId, { text: '❌ Pet not found. /pet list' }, { quoted: msg });
        const r = PB.givePet(sender, pet, to);
        return sock.sendMessage(chatId, { text: r.message + (r.success ? `\n→ @${String(to).split('@')[0]}` : ''), mentions: r.success ? [to] : [] }, { quoted: msg });
      }

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
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🐾 *PET SYSTEM*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🥚 Find eggs in dungeons\n🐣 Hatch them to get pets\n📈 Level pets up through battles\n🌟 Evolve at level 10\n\n*Pet Roles:*\n⚔️ Attack — fights with you\n💚 Support — heals & buffs you\n💠 Scavenger — finds extra Nexus/loot\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *COMMANDS*\n/pet list           — All pets\n/pet eggs           — Your eggs\n/pet hatch [#]      — Hatch egg\n/pet info [#]       — Pet details\n/pet active [#]     — Set active\n/pet feed [#] [food] — Feed pet\n/pet foods          — Food list\n/pet evolve [#]     — Evolve\n/pet rename [#] [name] — Rename\n/pet release [#]    — Release\n/pet mate <#> <#>   — Breed (♂️+♀️) → egg\n/pet give <#> @user — Give a pet\n/eggs · /egg <#>    — Egg bag & info\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });

    } catch(err) {
      console.error('[Pet] Error:', err.message);
      return sock.sendMessage(msg.key.remoteJid, { text: '❌ Pet system error. Try again.' }, { quoted: msg });
    }
  }
};