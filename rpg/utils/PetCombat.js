// ═══════════════════════════════════════════════════════════════
// Push #55 — PetCombat: the single place every battle engine asks
// about pets.
//
// Before this, only ONE engine (solo dungeon) read `getPetBattleBonus`
// and only for raw ATK. Support pets never healed, scavengers never
// scavenged, and no pet ability could ever fire — `usePetAbility` had
// zero callers. So from a player's side, pets "did nothing".
//
// Every combat engine (dungeon, party dungeon, gate raid, boss, PvP)
// now calls the same helpers, so a pet behaves identically everywhere:
//   attack    → ATK/DEF/SPD bonus + occasional independent strike
//   support   → heals a slice of max HP every combat round
//   scavenger → extra Nexus + a loot find on the clear
//   any       → XP for the pet after a fight, sacrifice on a lethal hit
// All of it is deliberately fail-soft: a broken pet row must never
// break a battle.
// ═══════════════════════════════════════════════════════════════
'use strict';

const PetManager = require('./PetManager');

const FAINT_RECOVER_MS = 10 * 60 * 1000; // a fainted pet is back after 10 min
const ABILITY_CHANCE   = Number(process.env.PET_ABILITY_CHANCE || 0.22);

function safe(fn, fallback) {
  try { return fn(); } catch (e) { return fallback; }
}

/** The active pet, with the faint timer expired if it is due. */
function activePet(playerId) {
  return safe(() => {
    const pet = PetManager.getActivePet(playerId);
    if (!pet) return null;
    if (pet.isFainted && pet.faintedAt && Date.now() - pet.faintedAt > FAINT_RECOVER_MS) {
      pet.isFainted = false;
      delete pet.faintedAt;
      safe(() => PetManager.save());
    }
    return pet;
  }, null);
}

function battleBonus(playerId) {
  const pet = activePet(playerId);
  if (!pet || pet.isFainted) return null;
  const pb = safe(() => PetManager.getPetBattleBonus(playerId), null);
  return pb && pb.pet ? pb : null;
}

function bonusStat(playerId, key) {
  const pb = battleBonus(playerId);
  const v = pb?.bonuses?.[key];
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** Flat ATK the player's pet contributes to one hit. */
function atkBonus(playerId) { return bonusStat(playerId, 'atk'); }
/** Flat DEF the player's pet contributes. */
function defBonus(playerId) { return bonusStat(playerId, 'def'); }
/** Flat SPD the player's pet contributes (initiative / double-strike rolls). */
function spdBonus(playerId) { return bonusStat(playerId, 'spd'); }

/** Support-pet heal for this round (0 when the pet can't or won't). */
function supportHeal(playerId, player) {
  return safe(() => {
    const pb = battleBonus(playerId);
    if (!pb || !pb.canUseAbility) return 0;
    const maxHp = Math.max(1, player?.stats?.maxHp || 100);
    // Support pets heal off their own heal power; keep the bonus meaningful
    // at high levels by letting it scale with the player's max HP too.
    const direct = Number(PetManager.getSupportHeal(playerId, maxHp)) || 0;
    const floor = Math.floor(maxHp * 0.02); // 2% of max HP per round
    const raw = Math.max(direct, floor);
    return Math.max(0, Math.min(Math.floor(maxHp * 0.12), raw)); // capped at 12%
  }, 0);
}

/** Apply a support heal and clamp to max HP. Returns { healed, hp }. */
function healPlayer(playerId, player) {
  const amount = supportHeal(playerId, player);
  if (amount <= 0 || !player?.stats) return { healed: 0, hp: player?.stats?.hp || 0 };
  const maxHp = Math.max(1, player.stats.maxHp || 100);
  const before = Math.max(0, player.stats.hp || 0);
  if (before >= maxHp) return { healed: 0, hp: before };
  player.stats.hp = Math.min(maxHp, before + amount);
  const pet = activePet(playerId);
  return {
    healed: player.stats.hp - before,
    hp: player.stats.hp,
    petName: pet?.nickname || pet?.name || 'Pet',
    emoji: pet?.emoji || '🐾',
  };
}

/** Highest-ranked ability the pet has actually learned. */
function learnedAbility(pet) {
  const list = Array.isArray(pet?.abilities) ? pet.abilities : [];
  if (!list.length) return null;
  const lvl = Number(pet.level || 1);
  const eligible = list.filter(a => !Number.isFinite(a?.level) || a.level <= lvl);
  return (eligible.length ? eligible[eligible.length - 1] : null) || list[0];
}

/**
 * The pet's own strike this round. Only attack pets swing; the damage scales
 * with pet level and is clamped to 15% of the target's remaining HP so a pet
 * can accelerate a fight but never decide one.
 */
function abilityStrike(playerId, target, opts = {}) {
  return safe(() => {
    const pb = battleBonus(playerId);
    if (!pb || !pb.isAttack || !pb.canUseAbility) return null;
    const chance = Number.isFinite(opts.chance) ? opts.chance : ABILITY_CHANCE;
    if (Math.random() > chance) return null;
    const pet = pb.pet;
    const ability = learnedAbility(pet);
    if (!ability) return null;
    const level = Number(pet.level || 1);
    const raw = Math.max(1, Number(ability.damage || 0)) * (1 + level * 0.35) * 0.45;
    const targetMax = Math.max(1, Number(target?.maxHp || target?.hp || target?.stats?.maxHp || 0));
    const cap = Math.max(10, Math.floor(targetMax * 0.15));
    const dmg = Math.max(1, Math.min(cap, Math.floor(raw)));
    if (target && Number.isFinite(target.hp)) target.hp = Math.max(0, target.hp - dmg);
    return {
      name: ability.name || 'Strike',
      type: ability.type || 'physical',
      effect: ability.effect || null,
      damage: dmg,
      emoji: pet.emoji || '🐾',
      petName: pet.nickname || pet.name || 'Pet',
      line: `${pet.emoji || '🐾'} *${pet.nickname || pet.name || 'Pet'}* used *${ability.name || 'Strike'}* — *${dmg.toLocaleString()}* damage!`,
    };
  }, null);
}

/** Scavenger payout for a clear: extra Nexus + an item find roll. */
function scavenge(playerId, baseAmount) {
  return safe(() => {
    const pb = battleBonus(playerId);
    if (!pb || !pb.isScavenger) return { bonus: 0, foundItem: null };
    const base = Math.max(0, Number(baseAmount) || 0);
    const rate = Number(pb.scavengeBonus || 0.1);
    const bonus = Math.max(pb.pet.level >= 5 ? 50 : 20, Math.floor(base * rate));
    const finds = 0.18 + (Number(pb.pet.stats?.scavengeRate || 0.1) || 0.1);
    return { bonus, foundItem: Math.random() < finds ? true : null, pet: pb.pet };
  }, { bonus: 0, foundItem: null });
}

/** Reward the pet with XP after a fight; returns a message line if it levelled. */
function rewardPet(playerId, { won = true, exp = 0 } = {}) {
  return safe(() => {
    const pet = activePet(playerId);
    if (!pet || pet.isFainted) return null;
    const gained = Math.max(5, Math.floor(exp || (won ? 60 : 20)));
    const before = Number(pet.exp || 0);
    const res = PetManager.addPetExp(playerId, pet.instanceId, gained, won);
    const leveled = res?.leveled || (res?.newLevel && res.newLevel > (pet.level || 1));
    const lines = [];
    if (leveled) lines.push(`🎉 *${pet.nickname || pet.name}* reached Lv.${pet.level}!`);
    if (res?.evolutionAvailable || res?.canEvolve) lines.push(`🥚 *${pet.nickname || pet.name}* can evolve — /pet evolve`);
    if (res?.message && typeof res.message === 'string' && res.message.includes('Lv.')) lines.push(res.message);
    return lines.length ? lines : null;
  }, null);
}

/** One-line status shown in battle menus and /pet info. */
function statusLine(playerId) {
  return safe(() => {
    const pet = activePet(playerId);
    if (!pet) return '🐾 No active pet — /pet list, /pet active <name>.';
    const mood = pet.happiness >= 70 ? 'beaming' : pet.happiness >= 40 ? 'content' : pet.happiness >= 15 ? 'moody' : 'miserable';
    const bellied = pet.hunger >= 80 ? 'starving' : pet.hunger >= 55 ? 'hungry' : 'fed';
    const state = pet.isFainted ? '💀 fainted (recovering)' : `😺 ${mood}, ${bellied}`;
    const pb = battleBonus(playerId);
    const role = String(pet.role || 'attack').toLowerCase();
    const effect = role === 'support'
      ? `heals ${pb ? 'each round' : 'when happy'}`
      : role === 'scavenger'
        ? `+${Math.round((pb?.scavengeBonus || 0.1) * 100)}% loot on clears`
        : `+${pb?.bonuses?.atk || 0} ATK, +${pb?.bonuses?.def || 0} DEF`;
    return `${pet.emoji || '🐾'} *${pet.nickname || pet.name}* Lv.${pet.level} (${role}) — ${state} · ${effect}`;
  }, '');
}

module.exports = {
  activePet,
  battleBonus,
  atkBonus,
  defBonus,
  spdBonus,
  supportHeal,
  healPlayer,
  abilityStrike,
  scavenge,
  rewardPet,
  statusLine,
  learnedAbility,
  FAINT_RECOVER_MS,
};
