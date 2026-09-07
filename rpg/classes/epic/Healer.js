// ═══════════════════════════════════════════════════════════════
// Astra — Healer class (EPIC)
// Pure support role. ZERO damage from skills — all skills heal
// or buff. Base-stat attacks still deal damage normally.
//
// Skills scale with quality and skill level (via LevelUpManager's
// upgrade system). Heals scale HP and energy in a reasonable
// proportion to the skill's maxPotency.
//
// Custom command: /heal  (see commands/rpg/heal.js)
// ═══════════════════════════════════════════════════════════════

'use strict';

module.exports = {
  name: 'Healer',
  emoji: '💖',
  lore: 'The battlefield is not measured in kills. It is measured in the breaths that follow the silence. You do not slay the enemy — you make the enemy irrelevant by keeping your team alive.',
  cmdName: 'heal',   // Custom command: /heal <skill_name> or /heal <target>
  maxBonuses: {
    hp: 150,           // High survivability (matches Paladin-tier)
    atk: 8,            // Near-zero ATK — base attacks are weak by design
    def: 20,           // Decent defense to survive while healing
    speed: 25,
    maxEnergy: 120,    // High energy pool — healing is energy-hungry
    magicPower: 60,    // Primary scaling stat for healing
    critChance: 0,     // No crits needed for a healer
  },
  skills: [
    // ── Self / single-target heals ──
    { name: 'Healing Light',   type: 'heal', maxPotency: 25,  desc: 'Restores {p}% max HP to a single ally' },
    { name: 'Purify',          type: 'heal', maxPotency: 20,  desc: 'Restores {p}% max HP + removes 1 debuff from a single ally' },
    { name: 'Renew',           type: 'heal', maxPotency: 30,  desc: 'Restores {p}% max HP and {p/2}% max energy to a single ally' },

    // ── Party-wide heals ──
    { name: 'Sanctuary',       type: 'heal', maxPotency: 18,  desc: 'Restores {p}% max HP to ALL party members' },
    { name: 'Divine Grace',    type: 'heal', maxPotency: 35,  desc: 'Restores {p}% max HP + clears all debuffs from the party' },
    { name: 'Mass Renewal',    type: 'heal', maxPotency: 22,  desc: 'Restores {p}% max HP and {p/3}% max energy to the entire party' },

    // ── Buffs / shields ──
    { name: 'Blessed Shield',  type: 'buff', maxPotency: 40,  desc: 'Target ally gains a shield absorbing {p}% of their max HP for 3 turns' },
    { name: 'Aura of Light',   type: 'buff', maxPotency: 25,  desc: 'All party members heal {p}% of damage taken back as HP for 2 turns' },
    { name: 'Mana Spring',     type: 'buff', maxPotency: 30,  desc: 'Target ally restores {p}% of their max energy' },

    // ── Resurrection ──
    { name: 'Rebirth',         type: 'heal', maxPotency: 50,  desc: 'Revives a fallen ally with {p}% of their max HP' },

    // ── Passives ──
    { name: 'Blessed Touch',   type: 'passive', maxPotency: 20,  desc: 'All heals +{p}% effectiveness' },
    { name: 'Sanctified Soul', type: 'passive', maxPotency: 15,  desc: 'Healing received by the Healer is {p}% stronger' },
  ],
};
