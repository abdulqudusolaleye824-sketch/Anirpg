// PetManager.js — Full Pet System with Eggs, Roles, Scavenging, Support

const { PET_DATABASE, PET_FOOD, EGG_TYPES, rollEggType, hatchEgg } = require('./PetDatabase');
const fs   = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class PetManager {
  constructor() {
    const dataDir = process.env.DATA_DIR
      ? path.join(process.env.DATA_DIR, 'rpg_data')
      : path.join(__dirname, '../data');
    fsSync.mkdirSync(dataDir, { recursive: true });
    this.petsFile   = path.join(dataDir, 'playerPets.json');
    this.playerPets = new Map();
    this._loaded    = false;
    this._init();
  }

  _init() {
    try {
      const raw = fsSync.readFileSync(this.petsFile, 'utf8');
      const obj = JSON.parse(raw);
      this.playerPets = new Map(Object.entries(obj));
      this._loaded = true;
    } catch(e) {
      this.playerPets = new Map();
      this._loaded = true;
    }
  }

  save() {
    try {
      const obj = Object.fromEntries(this.playerPets);
      fsSync.writeFileSync(this.petsFile, JSON.stringify(obj, null, 2));
    } catch(e) { console.error('PetManager save error:', e.message); }
  }

  // Used by /clear (and test hooks): drop all in-memory pet data AND reset the
  // on-disk store to {}, so the cached pets don't get re-saved after a wipe.
  clearAll() {
    this.playerPets = new Map();
    try { fsSync.writeFileSync(this.petsFile, '{}', 'utf-8'); } catch (e) { console.error('PetManager clearAll error:', e.message); }
  }

  getPlayerData(playerId) {
    if (!this.playerPets.has(playerId)) {
      this.playerPets.set(playerId, { pets: [], eggs: [], activePet: null, storage: [] });
    }
    const d = this.playerPets.get(playerId);
    if (!d.eggs) d.eggs = [];
    return d;
  }

  // ── CREATE PET INSTANCE ────────────────────────────────────
  createPet(template) {
    return {
      instanceId:   `${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
      id:           template.id,
      name:         template.name,
      nickname:     null,
      rarity:       template.rarity,
      role:         template.role || 'attack',
      type:         template.type,
      emoji:        template.emoji,
      level:        1,
      exp:          0,
      stats:        { ...template.baseStats },
      bonding:      0,
      happiness:    100,
      hunger:       0,
      lastFed:      Date.now(),
      battles:      0,
      wins:         0,
      defeats:      0,
      abilities:    template.abilities.filter(a => a.level <= 1),
      evolution:    template.evolution || null,
      vulnerable:   template.vulnerable || false,
      acquiredDate: Date.now(),
    };
  }

  // ── EGG SYSTEM ────────────────────────────────────────────

  // Give player a random egg (called by dungeon/spawn system)
  giveEgg(playerId, eggId = null) {
    const pd = this.getPlayerData(playerId);
    if (pd.eggs.length >= 5) return { success: false, message: '❌ Egg bag full! (Max 5 eggs)' };
    const id = eggId || rollEggType();
    const egg = EGG_TYPES[id];
    if (!egg) return { success: false, message: '❌ Unknown egg type!' };
    const eggInstance = {
      instanceId: `egg_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
      eggId: id,
      name: egg.name,
      emoji: egg.emoji,
      rarity: egg.rarity,
      desc: egg.desc,
      hatchLevel: egg.hatchLevel,
      obtainedAt: Date.now(),
    };
    pd.eggs.push(eggInstance);
    this.save();
    return { success: true, egg: eggInstance, message: `🥚 You found a *${egg.name}*!\n${egg.desc}\nHatch it with /pet hatch [#]` };
  }

  // Hatch an egg into a pet
  hatchEgg(playerId, eggIndex) {
    const pd = this.getPlayerData(playerId);
    if (!pd.eggs[eggIndex]) return { success: false, message: '❌ No egg at that slot!' };
    if (pd.pets.length >= 20) return { success: false, message: '❌ Pet storage full! (Max 20)' };
    const eggInst = pd.eggs[eggIndex];
    const template = hatchEgg(eggInst.eggId);
    if (!template) return { success: false, message: '❌ Egg hatching failed!' };
    const newPet = this.createPet(template);
    pd.pets.push(newPet);
    pd.eggs.splice(eggIndex, 1);
    if (!pd.activePet) pd.activePet = newPet.instanceId;
    this.save();
    return {
      success: true,
      pet: newPet,
      isFirstPet: pd.pets.length === 1,
      message: `🐣 The egg hatched!\n${newPet.emoji} *${newPet.name}* appeared!\nRole: *${newPet.role.toUpperCase()}*\n\nLevel up your pet to evolve it!`,
    };
  }

  // ── CATCH A PET DIRECTLY (from dungeon encounter) ──────────
  attemptCatch(playerId, petId, bonusRate = 0, guaranteed = false) {
    const petTemplate = PET_DATABASE[petId];
    if (!petTemplate) return { success: false, message: '❌ Unknown pet!' };
    const pd = this.getPlayerData(playerId);
    if (pd.pets.length >= 20) return { success: false, message: '❌ Pet storage full! (Max 20)' };

    if (guaranteed) {
      const newPet = this.createPet(petTemplate);
      pd.pets.push(newPet);
      if (!pd.activePet) pd.activePet = newPet.instanceId;
      this.save();
      return { success: true, pet: newPet, isFirstPet: pd.pets.length === 1, message: `✨ Guaranteed catch! You caught ${petTemplate.name}!` };
    }

    const baseRate = Math.max(5, (petTemplate.catchRate || 50) * 0.5);
    const catchRate = Math.min(85, baseRate + bonusRate);
    if (Math.random() * 100 > catchRate) {
      return { success: false, message: `💨 ${petTemplate.name} broke free! (${Math.floor(catchRate)}% chance)` };
    }

    const newPet = this.createPet(petTemplate);
    pd.pets.push(newPet);
    if (!pd.activePet) pd.activePet = newPet.instanceId;
    this.save();
    return { success: true, pet: newPet, isFirstPet: pd.pets.length === 1, message: `✨ You caught ${petTemplate.name}!` };
  }

  // ── PET EXP & LEVEL UP ────────────────────────────────────
  addPetExp(playerId, petInstanceId, expAmount, won = true) {
    const pd = this.getPlayerData(playerId);
    const pet = pd.pets.find(p => p.instanceId === petInstanceId);
    if (!pet) return null;

    const template = PET_DATABASE[pet.id];
    pet.exp += expAmount;
    pet.battles++;
    if (won) pet.wins++; else pet.defeats++;

    const levelsGained = [];
    while (pet.exp >= this.getExpReq(pet.level)) {
      pet.exp -= this.getExpReq(pet.level);
      pet.level++;
      levelsGained.push(pet.level);
      if (template) {
        pet.stats.hp  += template.growthRates.hp  || 10;
        pet.stats.atk += template.growthRates.atk || 3;
        pet.stats.def += template.growthRates.def || 2;
        pet.stats.spd += template.growthRates.spd || 2;
        if (template.growthRates.healPower && pet.stats.healPower) pet.stats.healPower += template.growthRates.healPower;
        if (template.growthRates.scavengeRate && pet.stats.scavengeRate) pet.stats.scavengeRate += template.growthRates.scavengeRate;
        // Unlock new abilities
        const newAbs = template.abilities.filter(a => a.level === pet.level && !pet.abilities.find(x => x.name === a.name));
        pet.abilities.push(...newAbs);
      }
    }
    this.save();
    return { pet, levelsGained };
  }

  getExpReq(level) { return Math.floor(50 * Math.pow(level, 1.5)); }

  // ── EVOLVE PET ────────────────────────────────────────────
  evolvePet(playerId, petInstanceId, evolutionChoice) {
    const pd = this.getPlayerData(playerId);
    const pet = pd.pets.find(p => p.instanceId === petInstanceId);
    if (!pet) return { success: false, message: '❌ Pet not found!' };
    if (!pet.evolution) return { success: false, message: '❌ This pet cannot evolve!' };
    if (pet.level < pet.evolution.level) return { success: false, message: `❌ Need level ${pet.evolution.level} to evolve!` };
    const opt = pet.evolution.options.find(o => o.id === evolutionChoice);
    if (!opt) return { success: false, message: '❌ Invalid evolution choice!' };
    const newTemplate = PET_DATABASE[evolutionChoice];
    if (!newTemplate) return { success: false, message: '❌ Evolution data missing!' };
    const oldName = pet.name;
    pet.id = newTemplate.id;
    pet.name = newTemplate.name;
    pet.emoji = newTemplate.emoji;
    pet.rarity = newTemplate.rarity;
    pet.role = newTemplate.role || pet.role;
    pet.type = newTemplate.type;
    pet.evolution = newTemplate.evolution || null;
    pet.vulnerable = newTemplate.vulnerable || false;
    // Big stat boost on evolution
    pet.stats.hp  += 80;
    pet.stats.atk += 25;
    pet.stats.def += 15;
    pet.stats.spd += 10;
    pet.abilities = [...pet.abilities, ...newTemplate.abilities.filter(a => a.level <= pet.level && !pet.abilities.find(x => x.name === a.name))];
    this.save();
    return { success: true, message: `🌟 *${oldName}* evolved into *${newTemplate.name}*! 🎉\nRole: ${newTemplate.role?.toUpperCase() || 'UNKNOWN'}`, pet };
  }

  // ── FEED PET ──────────────────────────────────────────────
  feedPet(playerId, petInstanceId, foodName) {
    const pd = this.getPlayerData(playerId);
    const pet = pd.pets.find(p => p.instanceId === petInstanceId);
    if (!pet) return { success: false, message: '❌ Pet not found!' };
    const foodKey = foodName.toLowerCase().replace(' ', '_');
    const food = PET_FOOD[foodKey] || Object.values(PET_FOOD).find(f => f.name.toLowerCase() === foodName.toLowerCase());
    if (!food) return { success: false, message: `❌ Unknown food: ${foodName}\nSee /pet foods` };

    const isPreferred = Array.isArray(food.types) && food.types.includes((pet.type || '').toLowerCase());
    const bondingGain = isPreferred ? food.bondingBonus * 2 : food.bondingBonus;
    const xpGain      = isPreferred ? Math.floor(food.xpBonus * 1.5) : food.xpBonus;

    pet.hunger    = Math.max(0, pet.hunger - food.hungerRestore);
    pet.happiness = Math.min(100, pet.happiness + Math.floor(bondingGain * 0.5));
    pet.bonding   = Math.min(100, pet.bonding + bondingGain);
    pet.exp      += xpGain;
    pet.lastFed   = Date.now();
    pet.isFainted = false;

    this.save();

    const prefNote = isPreferred ? '\n💖 *PREFERRED FOOD!* 2× Bonding & +50% EXP bonus!' : '';
    return {
      success: true,
      message: `${pet.emoji} *${pet.nickname || pet.name}* enjoyed the ${food.name}!${prefNote}\n💕 Bonding +${bondingGain} (${pet.bonding}/100) | 😊 Happiness up | 🍖 Hunger -${food.hungerRestore}\n✨ +${xpGain} EXP`
    };
  }

  // ── PLAY WITH PET ──────────────────────────────────────────
  playWithPet(playerId, petInstanceId) {
    const pd = this.getPlayerData(playerId);
    const pet = pd.pets.find(p => p.instanceId === petInstanceId);
    if (!pet) return { success: false, message: '❌ Pet not found!' };
    if ((pet.hunger || 0) >= 80) return { success: false, message: `❌ ${pet.name} is too hungry to play! Feed it first.` };
    const gain = 3 + Math.floor(Math.random() * 4);
    pet.bonding = Math.min(100, (pet.bonding || 0) + gain);
    pet.happiness = Math.min(100, (pet.happiness || 0) + 10);
    pet.hunger = Math.min(100, (pet.hunger || 0) + 5);
    this.save();
    return { success: true, message: `🎾 You played with ${pet.emoji} *${pet.nickname || pet.name}*!\n💕 Bonding +${gain} (${pet.bonding}/100) | 😊 Happiness +10` };
  }

  // ── TRAIN PET ─────────────────────────────────────────────
  trainPet(playerId, petInstanceId) {
    const pd = this.getPlayerData(playerId);
    const pet = pd.pets.find(p => p.instanceId === petInstanceId);
    if (!pet) return { success: false, message: '❌ Pet not found!' };
    if ((pet.hunger || 0) >= 80) return { success: false, message: `❌ ${pet.name} is too hungry to train!` };
    const xpGain = 100 + Math.floor(Math.random() * 100);
    pet.hunger = Math.min(100, (pet.hunger || 0) + 15);
    pet.happiness = Math.max(0, (pet.happiness || 0) - 5);
    const res = this.addPetExp(playerId, petInstanceId, xpGain, true);
    return { success: true, message: `🥊 Trained ${pet.emoji} *${pet.nickname || pet.name}*!\n✨ +${xpGain} Pet EXP ${res.levelsGained.length ? `\n🎉 Level Up! Now Lv.${pet.level}` : ''}` };
  }

  // ── PET SACRIFICE MECHANISM ────────────────────────────────
  checkPetSacrifice(playerId, player) {
    const pet = this.getActivePet(playerId);
    if (!pet || pet.isFainted || (pet.bonding || 0) < 80 || (pet.hunger || 0) >= 80) return null;

    pet.isFainted = true;
    pet.faintedAt = Date.now();
    pet.happiness = Math.max(0, (pet.happiness || 0) - 30);
    this.save();

    const restoredHp = Math.max(1, Math.floor((player.stats?.maxHp || 100) * 0.25));
    player.stats.hp = restoredHp;

    return {
      sacrificed: true,
      petName: pet.nickname || pet.name,
      petEmoji: pet.emoji || '🐾',
      restoredHp,
      message: `🛡️ *PET SACRIFICE!* Your loyal pet ${pet.emoji || '🐾'} *${pet.nickname || pet.name}* leaped in front of you and took the fatal strike! You survive with ${restoredHp}/${player.stats.maxHp} HP!`
    };
  }

  // ── BATTLE BONUSES ────────────────────────────────────────
  getPetBattleBonus(playerId) {
    const pet = this.getActivePet(playerId);
    if (!pet) return null;
    const bondMod = pet.bonding / 100;
    const happMod = pet.happiness / 100;
    const total   = (bondMod + happMod) / 2;

    if (pet.role === 'scavenger') {
      // Scavengers don't fight — they just scavenge
      return {
        pet, bonuses: { atk: 0, def: 0, spd: 0 },
        scavengeBonus: pet.stats.scavengeRate || 0.10,
        canUseAbility: false,
        isScavenger: true,
      };
    }

    if (pet.role === 'support') {
      return {
        pet,
        bonuses: { atk: 0, def: Math.floor(pet.stats.def * total * 0.3), spd: 0 },
        healBonus: Math.floor((pet.stats.healPower || 10) * total),
        canUseAbility: pet.happiness > 30 && pet.hunger < 80,
        isSupport: true,
      };
    }

    // Attack pet
    return {
      pet,
      bonuses: {
        atk: Math.floor(pet.stats.atk * total * 0.45),
        def: Math.floor(pet.stats.def * total * 0.30),
        spd: Math.floor(pet.stats.spd * total * 0.20),
      },
      canUseAbility: pet.happiness > 30 && pet.hunger < 80,
      isAttack: true,
    };
  }

  usePetAbility(playerId, abilityIndex = 0) {
    const pet = this.getActivePet(playerId);
    if (!pet) return null;
    if (pet.happiness < 30) return { success: false, message: `${pet.emoji} Too unhappy to help!` };
    if (pet.hunger > 80)    return { success: false, message: `${pet.emoji} Too hungry to help!` };
    const ability = pet.abilities[abilityIndex];
    if (!ability) return { success: false, message: '❌ No ability!' };
    pet.happiness = Math.max(0, pet.happiness - 5);
    this.save();
    const scaled = ability.damage > 0 ? { ...ability, damage: Math.floor(ability.damage * 0.45) } : ability;
    return { success: true, ability: scaled, pet, message: `${pet.emoji} *${pet.nickname || pet.name}* used *${ability.name}*!` };
  }

  // Get scavenger Nexus/loot bonus after a fight
  getScavengeReward(playerId, baseNexus) {
    const pb = this.getPetBattleBonus(playerId);
    if (!pb?.isScavenger) return { goldBonus: 0, findItem: false };
    const rate = pb.scavengeBonus;
    const goldBonus = Math.floor(baseNexus * rate);
    const findItem  = Math.random() < (pb.pet.stats.scavengeRate || 0.10) * 0.5;
    return { goldBonus, findItem, pet: pb.pet };
  }

  // Get support pet heal amount (called after player takes damage)
  getSupportHeal(playerId, playerMaxHp) {
    const pb = this.getPetBattleBonus(playerId);
    if (!pb?.isSupport || !pb.canUseAbility) return 0;
    // Support pet heals a % of max HP each turn
    const healPct = (pb.healBonus / 100) * 0.05; // 5% of healPower as % of maxHp
    return Math.floor(playerMaxHp * Math.min(0.10, healPct)); // cap at 10% per turn
  }

  // ── OTHER METHODS ─────────────────────────────────────────
  getActivePet(playerId) {
    const pd = this.getPlayerData(playerId);
    if (!pd.activePet) return null;
    return pd.pets.find(p => p.instanceId === pd.activePet) || null;
  }

  setActivePet(playerId, petInstanceId) {
    const pd = this.getPlayerData(playerId);
    const pet = pd.pets.find(p => p.instanceId === petInstanceId);
    if (!pet) return { success: false, message: '❌ Pet not found!' };
    pd.activePet = petInstanceId;
    this.save();
    return { success: true, message: `${pet.emoji} *${pet.nickname || pet.name}* is now your active pet!\nRole: *${pet.role?.toUpperCase() || 'ATTACK'}*` };
  }

  renamePet(playerId, petInstanceId, name) {
    const pd = this.getPlayerData(playerId);
    const pet = pd.pets.find(p => p.instanceId === petInstanceId);
    if (!pet) return { success: false, message: '❌ Pet not found!' };
    if (name.length > 20) return { success: false, message: '❌ Max 20 characters!' };
    pet.nickname = name;
    this.save();
    return { success: true, message: `✅ Renamed to "${name}"!` };
  }

  releasePet(playerId, petInstanceId) {
    const pd = this.getPlayerData(playerId);
    const idx = pd.pets.findIndex(p => p.instanceId === petInstanceId);
    if (idx === -1) return { success: false, message: '❌ Pet not found!' };
    const pet = pd.pets[idx];
    pd.pets.splice(idx, 1);
    if (pd.activePet === petInstanceId) pd.activePet = pd.pets[0]?.instanceId || null;
    this.save();
    return { success: true, message: `👋 Released ${pet.emoji} ${pet.nickname || pet.name}.` };
  }

  updateHunger(playerId) {
    const pd = this.getPlayerData(playerId);
    const now = Date.now();
    const hrs = (now - (pd.lastHungerCheck || now)) / 3600000;
    if (hrs < 1) return;
    pd.pets.forEach(pet => {
      pet.hunger    = Math.min(100, pet.hunger + hrs * 5);
      if (pet.hunger > 70) pet.happiness = Math.max(0, pet.happiness - hrs * 2);
    });
    pd.lastHungerCheck = now;
    this.save();
  }

  getPlayerPets(playerId) { return this.getPlayerData(playerId).pets; }
  getPlayerEggs(playerId)  { return this.getPlayerData(playerId).eggs; }

  getPetStatsString(pet) {
    const expReq = this.getExpReq(pet.level);
    const expPct = Math.floor((pet.exp / expReq) * 100);
    const roleEmoji = { attack: '⚔️', support: '💚', scavenger: '💰' }[pet.role] || '⚔️';
    let s = `${pet.emoji} *${pet.nickname || pet.name}* ${roleEmoji}\n`;
    s += `Lv.${pet.level} | ${pet.rarity.toUpperCase()} | ${pet.role?.toUpperCase()}\n\n`;
    s += `❤️ HP: ${pet.stats.hp} | ⚔️ ATK: ${pet.stats.atk}\n`;
    s += `🛡️ DEF: ${pet.stats.def} | ⚡ SPD: ${pet.stats.spd}\n`;
    if (pet.stats.healPower) s += `💚 Heal Power: ${pet.stats.healPower}\n`;
    if (pet.stats.scavengeRate) s += `🔍 Scavenge: +${Math.floor(pet.stats.scavengeRate * 100)}% Nexus\n`;
    s += `\n📊 EXP: ${pet.exp}/${expReq} (${expPct}%)\n`;
    s += `💕 Bonding: ${pet.bonding}/100 | 😊 ${pet.happiness}/100 | 🍖 ${pet.hunger}/100\n`;
    if (pet.evolution) s += `\n🌟 Evolves at Lv.${pet.evolution.level}`;
    return s;
  }
}

module.exports = new PetManager();