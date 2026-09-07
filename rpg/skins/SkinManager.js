/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║               ✦ 𝐀𝐬𝐭𝐫𝐚™ — SkinManager.js                        ║
 * ║  Manages all skin ownership, equipping, gacha, and shop.     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

const {
  SKINS, SKIN_MAP, RARITY_EMOJI, RARITY_LABEL,
  getSkin, pullGacha, GACHA_POOL_BY_RARITY,
} = require('./SkinCatalog');
const { getSkinAssetPath } = require('./RigRenderer');

// ── Gacha costs ───────────────────────────────────────────────────────────────
const SINGLE_PULL_COST  = 120;   // Mana Stones
const MULTI_PULL_COUNT  = 10;
const MULTI_PULL_COST   = 1080;  // 10% discount
const PITY_THRESHOLD    = 90;    // pulls before guaranteed legendary+

// ── Ensure player has skin data fields ───────────────────────────────────────
function initSkinData(player) {
  if (!player.skins) {
    player.skins = {
      owned:       ['common_village_boy', 'common_village_girl'], // default starters
      equipped:    'common_village_boy',
      pulls:       0,          // total pulls this pity cycle
      totalPulls:  0,          // lifetime pulls
      lastPull:    0,          // timestamp
    };
  }
  if (!player.skins.owned)      player.skins.owned      = ['common_village_boy'];
  if (!player.skins.equipped)   player.skins.equipped   = player.skins.owned[0] || 'common_village_boy';
  if (player.skins.pulls  == null) player.skins.pulls   = 0;
  if (player.skins.totalPulls == null) player.skins.totalPulls = 0;
  return player;
}

// ── Equip a skin ──────────────────────────────────────────────────────────────
function equipSkin(player, skinId) {
  initSkinData(player);
  const skin = getSkin(skinId);
  if (!skin) return { success: false, error: `❌ Skin *${skinId}* does not exist.` };
  if (!player.skins.owned.includes(skinId)) {
    return { success: false, error: `❌ You don't own the *${skin.name}* skin.` };
  }
  player.skins.equipped = skinId;
  return { success: true, skin };
}

// ── Get equipped skin data ────────────────────────────────────────────────────
function getEquippedSkin(player) {
  initSkinData(player);
  const id   = player.skins.equipped || 'common_village_boy';
  const skin = getSkin(id) || getSkin('common_village_boy');
  return {
    ...skin,
    assetPath: getSkinAssetPath(skin.id, skin.rarity),
  };
}

// ── Buy a skin from the shop ──────────────────────────────────────────────────
function buySkin(player, skinId) {
  initSkinData(player);
  const skin = getSkin(skinId);
  if (!skin)                    return { success: false, error: `❌ Skin *${skinId}* not found.` };
  if (skin.source !== 'shop')   return { success: false, error: `❌ *${skin.name}* is not available in the shop.` };
  if (!skin.cost?.manaStones)     return { success: false, error: `❌ *${skin.name}* has no crystal price.` };
  if (player.skins.owned.includes(skinId)) return { success: false, error: `❌ You already own *${skin.name}*.` };

  const cost = skin.cost.manaStones;
  if ((player.manaStones || 0) < cost) {
    return { success: false, error: `❌ Not enough Mana Stones!\nNeed: *${cost}* 🔮\nHave: *${player.manaStones || 0}* 🔮` };
  }

  player.manaStones   -= cost;
  player.skins.owned.push(skinId);
  return { success: true, skin, cost };
}

// ── Single gacha pull ─────────────────────────────────────────────────────────
function singlePull(player) {
  initSkinData(player);

  if ((player.manaStones || 0) < SINGLE_PULL_COST) {
    return { success: false, error: `❌ Not enough Mana Stones!\nNeed: *${SINGLE_PULL_COST}* 🔮\nHave: *${player.manaStones || 0}* 🔮` };
  }

  player.manaStones  -= SINGLE_PULL_COST;
  player.skins.pulls   += 1;
  player.skins.totalPulls += 1;
  player.skins.lastPull = Date.now();

  const pity = player.skins.pulls >= PITY_THRESHOLD;
  const skin = pullGacha(player.skins.owned, pity);

  if (pity) player.skins.pulls = 0; // reset pity after guaranteed pull

  const isDupe = player.skins.owned.includes(skin.id);
  if (!isDupe) player.skins.owned.push(skin.id);

  return {
    success: true,
    skin,
    isDupe,
    pityActivated: pity,
    pullsUntilPity: Math.max(0, PITY_THRESHOLD - player.skins.pulls),
    dupeReward: isDupe ? Math.floor(skin.rarity === 'mythic' ? 500 : skin.rarity === 'legendary' ? 200 : skin.rarity === 'epic' ? 80 : skin.rarity === 'rare' ? 30 : 10) : 0,
  };
}

// ── Multi pull (10x) ──────────────────────────────────────────────────────────
function multiPull(player) {
  initSkinData(player);

  if ((player.manaStones || 0) < MULTI_PULL_COST) {
    return { success: false, error: `❌ Not enough Mana Stones!\nNeed: *${MULTI_PULL_COST}* 🔮\nHave: *${player.manaStones || 0}* 🔮` };
  }

  player.manaStones -= MULTI_PULL_COST;

  const results = [];
  for (let i = 0; i < MULTI_PULL_COUNT; i++) {
    player.skins.pulls   += 1;
    player.skins.totalPulls += 1;

    const pity = player.skins.pulls >= PITY_THRESHOLD;
    // Guarantee at least 1 rare in a 10x pull
    const forceRare = i === 9 && !results.some(r => ['rare','epic','legendary','mythic'].includes(r.skin.rarity));
    const skin = forceRare
      ? (() => { const pool = GACHA_POOL_BY_RARITY.rare; return pool[Math.floor(Math.random()*pool.length)]; })()
      : pullGacha(player.skins.owned, pity);

    if (pity) player.skins.pulls = 0;

    const isDupe = player.skins.owned.includes(skin.id);
    if (!isDupe) player.skins.owned.push(skin.id);

    const dupeReward = isDupe ? Math.floor(skin.rarity === 'mythic' ? 500 : skin.rarity === 'legendary' ? 200 : skin.rarity === 'epic' ? 80 : skin.rarity === 'rare' ? 30 : 10) : 0;
    if (isDupe) player.manaStones += dupeReward;

    results.push({ skin, isDupe, pityActivated: pity, dupeReward });
  }

  player.skins.lastPull = Date.now();

  return {
    success: true,
    results,
    pullsUntilPity: Math.max(0, PITY_THRESHOLD - player.skins.pulls),
  };
}

// ── Unlock skin via achievement ───────────────────────────────────────────────
function unlockSkin(player, skinId) {
  initSkinData(player);
  const skin = getSkin(skinId);
  if (!skin) return { success: false, error: `Unknown skin: ${skinId}` };
  if (player.skins.owned.includes(skinId)) return { success: false, alreadyOwned: true };
  player.skins.owned.push(skinId);
  return { success: true, skin };
}

// ── Format skin card for WhatsApp display ─────────────────────────────────────
function formatSkinCard(skin, owned = false, equipped = false) {
  const emoji   = RARITY_EMOJI[skin.rarity] || '⚪';
  const label   = RARITY_LABEL[skin.rarity] || skin.rarity;
  const cost    = skin.cost?.manaStones ? `${skin.cost.manaStones} 🔮` : 'Not in shop';
  const srcIcon = skin.source === 'gacha' ? '🎰' : skin.source === 'achievement' ? '🏆' : skin.source === 'default' ? '✅' : '🏪';

  return [
    `${emoji} *${skin.name}*`,
    `🎌 Theme: ${skin.theme}  |  ⚔️ ${skin.archetype}`,
    `✨ ${label} ${equipped ? '*(Equipped)*' : owned ? '*(Owned)*' : ''}`,
    `📖 _${skin.lore}_`,
    `${srcIcon} Source: ${skin.source}  |  🔮 ${cost}`,
  ].join('\n');
}

// ── Format inventory list ─────────────────────────────────────────────────────
function formatSkinInventory(player) {
  initSkinData(player);
  const owned    = player.skins.owned;
  const equipped = player.skins.equipped;

  if (owned.length === 0) return '❌ You have no skins yet.\nUse */summon* to pull from the gacha!';

  const grouped = { common:[], uncommon:[], rare:[], epic:[], legendary:[], mythic:[] };
  for (const id of owned) {
    const s = getSkin(id);
    if (s) grouped[s.rarity].push(s);
  }

  const lines = [];
  for (const [rarity, skins] of Object.entries(grouped)) {
    if (skins.length === 0) continue;
    const emoji = RARITY_EMOJI[rarity];
    lines.push(`\n${emoji} *${RARITY_LABEL[rarity]}* (${skins.length})`);
    for (const s of skins) {
      const eq = s.id === equipped ? ' ◀ equipped' : '';
      lines.push(`  • ${s.name}${eq}`);
    }
  }

  return lines.join('\n');
}

// ── Gacha banner display ──────────────────────────────────────────────────────
function formatGachaBanner(player) {
  initSkinData(player);
  const pulls    = player.skins.pulls   || 0;
  const total    = player.skins.totalPulls || 0;
  const until    = Math.max(0, PITY_THRESHOLD - pulls);
  const manaStones = player.manaStones  || 0;

  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🎰 *SKIN SUMMON BANNER*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `🔮 Your Mana Stones: *${manaStones}*`,
    ``,
    `📊 *RATES*`,
    `🔴 Mythic    —  2%`,
    `🟡 Legendary —  8%`,
    `🟣 Epic      — 20%`,
    `🔵 Rare      — 30%`,
    `🟢 Uncommon  — 40%`,
    ``,
    `🎯 *PITY SYSTEM*`,
    `Pulls until guaranteed Legendary+: *${until}*`,
    `Total pulls: *${total}*`,
    ``,
    `💸 *COST*`,
    `Single pull:  *${SINGLE_PULL_COST}* 🔮`,
    `10x pull:     *${MULTI_PULL_COST}* 🔮 _(10% off)_`,
    ``,
    `*COMMANDS*`,
    `/summon — Single pull`,
    `/summon 10 — 10x pull`,
    `/skin list — View owned skins`,
    `/skin equip [name] — Equip a skin`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');
}

// ── Format single pull result ─────────────────────────────────────────────────
function formatPullResult(result) {
  const { skin, isDupe, pityActivated, dupeReward, pullsUntilPity } = result;
  const emoji = RARITY_EMOJI[skin.rarity];
  const label = RARITY_LABEL[skin.rarity];

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    pityActivated ? `🎯 *PITY ACTIVATED!*` : `🎰 *SUMMON RESULT*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `${emoji} *${skin.name}*`,
    `✨ *${label}*`,
    `🎌 ${skin.theme}  ·  ${skin.archetype}`,
    ``,
    `📖 _${skin.lore}_`,
    ``,
  ];

  if (isDupe) {
    lines.push(`♻️ *Duplicate!* Converted to *+${dupeReward} 🔮*`);
  } else {
    lines.push(`✅ *New skin added to your collection!*`);
    lines.push(`Use */skin equip ${skin.id}* to wear it.`);
  }

  lines.push(``, `🎯 Pity in: *${pullsUntilPity}* pulls`, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  return lines.join('\n');
}

// ── Format 10x pull results ───────────────────────────────────────────────────
function formatMultiPullResults(multiResult) {
  const { results, pullsUntilPity } = multiResult;
  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🎰 *10x SUMMON RESULTS*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
  ];

  const newSkins  = [];
  const dupes     = [];
  let   dupeTotal = 0;

  for (const r of results) {
    const emoji = RARITY_EMOJI[r.skin.rarity];
    if (r.isDupe) {
      dupes.push(`  ♻️ ${emoji} ${r.skin.name} → +${r.dupeReward} 🔮`);
      dupeTotal += r.dupeReward;
    } else {
      newSkins.push(`  ✨ ${emoji} *${r.skin.name}*`);
    }
  }

  if (newSkins.length > 0) {
    lines.push(`🆕 *New Skins (${newSkins.length})*`);
    lines.push(...newSkins, ``);
  }
  if (dupes.length > 0) {
    lines.push(`♻️ *Duplicates (${dupes.length}) → +${dupeTotal} 🔮*`);
    lines.push(...dupes, ``);
  }

  const best = results.reduce((a,b) => {
    const order = ['mythic','legendary','epic','rare','uncommon','common'];
    return order.indexOf(a.skin.rarity) < order.indexOf(b.skin.rarity) ? a : b;
  });

  lines.push(`🏆 Best pull: *${best.skin.name}* ${RARITY_EMOJI[best.skin.rarity]}`);
  lines.push(`🎯 Pity in: *${pullsUntilPity}* pulls`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  return lines.join('\n');
}

module.exports = {
  initSkinData,
  equipSkin,
  getEquippedSkin,
  buySkin,
  singlePull,
  multiPull,
  unlockSkin,
  formatSkinCard,
  formatSkinInventory,
  formatGachaBanner,
  formatPullResult,
  formatMultiPullResults,
  SINGLE_PULL_COST,
  MULTI_PULL_COST,
  PITY_THRESHOLD,
};
