// ═══════════════════════════════════════════════════════════════
// HealerBacklash — Push #91
//   • A Healer who heals ANOTHER hunter pays with their own HP:
//       single ally : 12% of the healer's max HP
//       party heal  : 8% + 0.4% per heal-% (the old party toll)
//     Skill level cuts the toll: Lv1 100% · Lv2 80% · Lv3 60% · Lv4 40% · Lv5 20%.
//     (Healer skill upgrades no longer raise damage — their skills deal none —
//      they lower this backlash instead.)  Self-heals cost nothing.
//   • Healing a SEVERELY WOUNDED hunter (<10% HP before the heal) is a
//     shock to the Healer: they are STUNNED for 1 turn (lose their next strike).
//   • The toll never kills: HP floors at 1.
// ═══════════════════════════════════════════════════════════════
const SINGLE_TOLL_PCT = 12;
const PARTY_BASE_PCT = 8, PARTY_PER_HEAL_PCT = 0.4, PARTY_MAX_PCT = 60;
const SEVERE_HP_PCT = 10;
const STUN_TURNS = 1;

function levelFactor(level) {
  const lv = Math.max(1, Math.min(5, Number(level) || 1));
  return Math.max(0.2, 1 - (lv - 1) * 0.2);
}
function reductionPct(level) { return Math.round((1 - levelFactor(level)) * 100); }

// Toll (in % of the healer's max HP) for a cast. `others` = number of healed hunters other than the healer.
function tollPct({ party = false, healPct = 20, level = 1, others = 1 } = {}) {
  if (!others || others <= 0) return 0;
  const base = party ? Math.min(PARTY_MAX_PCT, PARTY_BASE_PCT + PARTY_PER_HEAL_PCT * (Number(healPct) || 20)) : SINGLE_TOLL_PCT;
  return Math.round(base * levelFactor(level) * 100) / 100;
}
function tollHp(maxHp, opts) { return Math.floor((Number(maxHp) || 100) * tollPct(opts) / 100); }

function isSevere(stats) {
  const max = Number(stats && stats.maxHp) || 100; const hp = Number(stats && stats.hp) || 0;
  return hp > 0 && hp / max < SEVERE_HP_PCT / 100;
}

// Apply the stun to the healer (refreshes an existing one).
function stunHealer(healer) {
  if (!healer) return null;
  if (!Array.isArray(healer.statusEffects)) healer.statusEffects = [];
  // Combat ticks statuses at the START of the healer's next turn (before the
  // can-act check), so store turns+1 → exactly STUN_TURNS lost strike(s).
  const dur = STUN_TURNS + 1;
  const ex = healer.statusEffects.find(e => String(e.type || '').toLowerCase() === 'stun');
  if (ex) { ex.duration = Math.max(Number(ex.duration) || 0, dur); return ex; }
  const eff = { type: 'stun', duration: dur, source: 'healer_backlash' };
  healer.statusEffects.push(eff);
  return eff;
}

function describe(level) {
  return `🩸 Backlash: healing another hunter costs you ${tollPct({ level }).toFixed(1)}% max HP (party heals more) — Lv${Math.max(1, Math.min(5, level || 1))} cuts it by ${reductionPct(level)}%. Healing a hunter under ${SEVERE_HP_PCT}% HP stuns you for ${STUN_TURNS} turn.`;
}

module.exports = { SINGLE_TOLL_PCT, PARTY_BASE_PCT, PARTY_PER_HEAL_PCT, SEVERE_HP_PCT, STUN_TURNS, levelFactor, reductionPct, tollPct, tollHp, isSevere, stunHealer, describe };
