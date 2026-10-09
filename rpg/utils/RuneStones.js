'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Push #96h-z20 — RUNE STONES
//   From now on every skill a hunter earns (class ladder OR job skill) arrives as a RUNE STONE in the bag:
//   a soulbound keepsake of the technique — it cannot be gifted, traded, listed or sent (same rule as keys).
//   The skill itself still unlocks exactly as before; the stone is the record of it (and shows in /inv).
// ═══════════════════════════════════════════════════════════════════════════
const RARITY_BY_LEVEL = (lv) => lv >= 80 ? 'mythic' : lv >= 60 ? 'legendary' : lv >= 40 ? 'epic' : lv >= 20 ? 'rare' : lv >= 10 ? 'uncommon' : 'common';
const RARITY_BY_TIER = (u) => u >= 4 ? 'legendary' : u >= 2 ? 'epic' : 'rare';

function _items(player) { if (!player.inventory) player.inventory = {}; if (!Array.isArray(player.inventory.items)) player.inventory.items = []; return player.inventory.items; }
function has(player, skillName) { const n = String(skillName || '').toLowerCase(); return _items(player).some(i => i && i.isRuneStone && String(i.skill || '').toLowerCase() === n); }
function isSoulbound(item) { return !!(item && (item.isRuneStone || item.soulbound || item.transferable === false)); }

function grant(player, { skill, kind = 'class', source = '', level = 0, job = null, unlock = 0, lore = '' }) {
  if (!player || !skill || has(player, skill)) return null;
  const items = _items(player);
  const rarity = kind === 'job' ? RARITY_BY_TIER(unlock) : RARITY_BY_LEVEL(level);
  const item = {
    id: `rune-${String(skill).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
    name: `Rune Stone — ${skill}`, emoji: '🪨', type: 'Rune', rarity,
    isRuneStone: true, soulbound: true, transferable: false,
    skill, skillKind: kind, job: job || null, unlockLevel: level || null, unlockJobLevel: unlock || null,
    lore: lore || (kind === 'job' ? `A rune carved when ${player.name || 'the hunter'} mastered *${skill}* as a ${job || 'journeyman'}. Soulbound — it answers to no other hand.` : `A rune carved the day ${player.name || 'the hunter'} first wielded *${skill}* (Lv.${level}). Soulbound — it answers to no other hand.`),
    source: source || `skill:${kind}`, acquiredAt: Date.now(),
  };
  try { require('./InventoryCompactor').attach(item); } catch (e) {}
  items.push(item);
  return item;
}

// Class ladder unlock (LevelUpManager) — returns the stone or null.
function onClassSkill(player, skillName, level) { return grant(player, { skill: skillName, kind: 'class', level: level || player.level || 1, source: 'class_skill' }); }
// Job level-up (JobSystem.gainXp) — stones for every job skill crossed in (from, to]. Returns [stones].
function onJobLevel(player, jobKey, from, to) {
  const out = [];
  try {
    const JSk = require('./JobSkills'); const JS = require('./JobSystem');
    const job = JS.findJob ? JS.findJob(jobKey) : null;
    JSk.defsFor(jobKey).forEach((d, i) => { const u = JSk.UNLOCKS[i]; if (u > (from || 0) && u <= to) { const s = grant(player, { skill: d.name, kind: 'job', job: (job && job.name) || jobKey, unlock: u, source: 'job_skill' }); if (s) out.push(s); } });
  } catch (e) {}
  return out;
}
function line(stone) { return stone ? `🪨 *${stone.name}* — soulbound, in your bag` : ''; }

module.exports = { grant, has, isSoulbound, onClassSkill, onJobLevel, line, RARITY_BY_LEVEL, RARITY_BY_TIER };
