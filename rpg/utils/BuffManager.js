// BuffManager.js — Manages active shop buffs for players
// Buffs: xpBooster, goldMult, shieldScroll, mightElixir

const BUFF_DEFINITIONS = {
  xpBooster:   { name: 'XP Booster',       emoji: '✨', maxUses: 3,  effect: 'xpMult',    value: 1.5  },
  goldMult:    { name: 'Nexus Multiplier',   emoji: '💠', maxUses: 3,  effect: 'goldMult',  value: 2.0  },
  shieldScroll:{ name: 'Shield Scroll',     emoji: '🛡️', maxUses: 1,  effect: 'shield',    value: 1    },
  mightElixir: { name: 'Elixir of Might',  emoji: '💪', maxUses: 5,  effect: 'atkBoost',  value: 20   },
  luckPotion:  { name: 'Luck Potion',       emoji: '🍀', maxUses: 999,effect: 'luck',      value: 0.25 },
  gvcGold:    { name: 'Gold EXP Buff',      emoji: '🥇', maxUses: 3,  effect: 'xpMult',    value: 2.0  },
  gvcSilver:  { name: 'Silver EXP Buff',    emoji: '🥈', maxUses: 3,  effect: 'xpMult',    value: 1.5  },
  gvcBronze:  { name: 'Bronze EXP Buff',    emoji: '🥉', maxUses: 3,  effect: 'xpMult',    value: 1.25 },
};

function initBuffs(player) {
  if (!player.activeBuffs) player.activeBuffs = {};
}

function activateBuff(player, buffKey) {
  initBuffs(player);
  const inv = player.inventory || {};
  const def = BUFF_DEFINITIONS[buffKey];
  if (!def) return { success: false, msg: '❌ Unknown buff!' };
  // Push #103k (BUG-145): the shop stores an XP Booster as an ITEM ({ isXpBooster, charges }) while /buff counted inventory.xpBooster — accept both.
  let fromItems = -1;
  if (buffKey === 'xpBooster' && !(inv[buffKey] > 0) && Array.isArray(inv.items)) fromItems = inv.items.findIndex(it => it && (it.isXpBooster || /^xp booster$/i.test(String(it.name || ''))));
  if (!(inv[buffKey] > 0) && fromItems < 0) return { success: false, msg: `❌ You don't have ${def.name}!` };
  if (player.activeBuffs[buffKey] && player.activeBuffs[buffKey].usesLeft > 0) return { success: false, msg: `⏳ *${def.name}* is already active (${player.activeBuffs[buffKey].usesLeft} uses left).` };
  player.activeBuffs[buffKey] = { usesLeft: def.maxUses, activated: Date.now() };
  if (fromItems >= 0) inv.items.splice(fromItems, 1); else { inv[buffKey]--; if (inv[buffKey] <= 0) delete inv[buffKey]; }
  
  return { success: true, msg: `${def.emoji} *${def.name}* activated! (${def.maxUses} uses)` };
}

function consumeBuff(player, buffKey) {
  initBuffs(player);
  const buff = player.activeBuffs[buffKey];
  if (!buff || buff.usesLeft <= 0) return false;
  buff.usesLeft--;
  if (buff.usesLeft <= 0) delete player.activeBuffs[buffKey];
  return true;
}

function hasBuff(player, buffKey) {
  return !!(player.activeBuffs?.[buffKey]?.usesLeft > 0);
}

// Push #103k: non-consuming look — gate floors use it per floor; one use is burned per gate clear (BattleRewards/GateRaid).
function peekXpMultiplier(player) {
  initBuffs(player);
  let v = 1;
  for (const k of ['gvcGold', 'gvcSilver', 'gvcBronze', 'xpBooster']) { const b = player.activeBuffs?.[k]; if (b && b.usesLeft > 0) v = Math.max(v, BUFF_DEFINITIONS[k].value); }
  return v;
}
function getXpMultiplier(player) {
  initBuffs(player);
  // GVC EXP buffs take priority (highest tier wins), then regular XP Booster
  let best = null;
  for (const k of ['gvcGold', 'gvcSilver', 'gvcBronze']) {
    const b = player.activeBuffs?.[k];
    if (b && b.usesLeft > 0 && (!best || BUFF_DEFINITIONS[k].value > BUFF_DEFINITIONS[best].value)) best = k;
  }
  if (best) { consumeBuff(player, best); let au = 1; try { au = require('./AuraSystem').AuraSystem.expMult(player); } catch (e) {} return BUFF_DEFINITIONS[best].value * au; }
  // Push #103k (BUG-145): XP Booster is REAL again — +50% XP for 3 battles (it is still sold in the shop and guild shop). Pro stacks on top.
  if (player.activeBuffs?.xpBooster?.usesLeft > 0) { consumeBuff(player, 'xpBooster'); let au = 1; try { au = require('./AuraSystem').AuraSystem.expMult(player); } catch (e) {} return BUFF_DEFINITIONS.xpBooster.value * au; }
  // Push #96f: aura title EXP% rides on this multiplier (dungeon totals).
  try { return require('./AuraSystem').AuraSystem.expMult(player); } catch (e) { return 1.0; }
}

function getNexusMultiplier(player) {
  // Push #87: Nexus Multiplier scrapped — leftover stock is inert.
  return 1.0;
}

function getAtkBoost(player) {
  if (hasBuff(player, 'mightElixir')) return 20;
  return 0;
}

function hasShield(player) {
  return hasBuff(player, 'shieldScroll');
}

function consumeShield(player) {
  return consumeBuff(player, 'shieldScroll');
}

function getActiveBuff_Display(player) {
  initBuffs(player);
  const lines = [];
  for (const [key, buff] of Object.entries(player.activeBuffs)) {
    const def = BUFF_DEFINITIONS[key];
    if (!def || !buff.usesLeft) continue;
    lines.push(`${def.emoji} ${def.name} (${buff.usesLeft} uses left)`);
  }
  return lines.length ? lines.join('\n') : 'None';
}

module.exports = { peekXpMultiplier, activateBuff, consumeBuff, hasBuff, getXpMultiplier, getNexusMultiplier, getAtkBoost, hasShield, consumeShield, getActiveBuff_Display, BUFF_DEFINITIONS };