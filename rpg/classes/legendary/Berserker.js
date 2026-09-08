// ═══════════════════════════════════════════════════════════════
// Astra — Berserker class (LEGENDARY)
// 2nd strongest legendary class — pure rage incarnate.
// Manually maintained: stats/skills tuned to stand above Devourer/Phantom/Chronomancer.
// ═══════════════════════════════════════════════════════════════

'use strict';

module.exports = {
  name: 'Berserker',
  emoji: '💢',
  lore: 'The anger is the gift. The blood is the proof. Below 50% HP, fear becomes fuel — below 30%, you are the nightmare they should have never woken.',
  maxBonuses: {
    hp: 220,           // Highest HP in the legendary tier (Devourer: 160)
    atk: 60,           // Highest ATK in the legendary tier (Devourer/Phantom: 55)
    def: 8,            // Glass cannon — intentionally low
    speed: 20,         // Slow but relentless
    maxEnergy: 40,
    critChance: 8,     // +8% crit — risk/reward for going all-in
    lifesteal: 8,      // Sustains through sheer violence
  },
  skills: [
    // ── Active skills (damage & status effects) ──
    { name: 'Rage',           type: 'buff',    maxPotency: 80,  desc: 'ATK +{p}% for 3 turns, takes 20% more damage' },
    { name: 'Savage Cleave',  type: 'damage',  maxPotency: 320, desc: 'Deals {p}% ATK and inflicts BLEED (🩸) dealing damage each turn' },
    { name: 'Earthquake Slam',type: 'damage',  maxPotency: 450, desc: 'Deals {p}% ATK, ignores 50% target DEF, and STUNS (⚡) for 1 turn' },
    { name: 'Crimson Cyclone',type: 'damage',  maxPotency: 280, desc: 'Spinning axe: {p}% ATK as AoE and inflicts BLEED (🩸) on all targets' },
    { name: 'Terror Howl',    type: 'debuff',  maxPotency: 50,  desc: 'Inflicts FEAR (😱) on enemies: ATK -{p}% & target deals 50% reduced damage' },
    // ── Active skills (utility) ──
    { name: 'War Shout',      type: 'debuff',  maxPotency: 35,  desc: 'Inflicts FEAR (😱) and STUN (⚡) on all enemies for 1 turn' },
    { name: 'Last Breath',    type: 'heal',    maxPotency: 35,  desc: 'Restore {p}% max HP, but removes all buffs' },
    // ── Passives ──
    { name: 'Blood Frenzy',        type: 'passive', maxPotency: 60,  desc: 'Below 30% HP: ATK +{p}%, lifesteal +10%' },
    { name: 'Unbreakable Will',    type: 'passive', maxPotency: 25,  desc: 'Cannot be killed below 1 HP once per fight' },
    { name: 'Pain is Power',       type: 'passive', maxPotency: 30,  desc: 'ATK +{p}% per 10% HP missing (max 3 stacks)' },
  ],
};
