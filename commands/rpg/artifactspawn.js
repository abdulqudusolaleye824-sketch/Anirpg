// artifactspawn.js — Group Artifact Spawn System
// Rare artifact drops in group every 2-3 hours
// First to claim it wins. Based on luck + speed.
// Usage: auto-triggered by scheduler, or /artifactspawn (admin)
// Players claim with: /claim

const ArtifactSystem = require('../../rpg/utils/ArtifactSystem');
const Announcer = require('../../rpg/utils/Announcer');

// ═══════════════════════════════════════════════════════════════
// SPAWN CATALOG — what can drop
// ═══════════════════════════════════════════════════════════════
const SPAWN_ARTIFACTS = [
  // ── COMMON (drops most often) ──────────────────────────────
  { name: 'Iron Sword',             emoji: '⚔️',  rarity: 'common',   type: 'weapon', bonus: { atk: 15 },              desc: 'A reliable blade. Not fancy, but it gets the job done.' },
  { name: 'Wooden Shield',          emoji: '🛡️',  rarity: 'common',   type: 'armor',  bonus: { def: 12 },              desc: 'Rough around the edges, but it has saved lives.' },
  { name: 'Leather Boots',          emoji: '👢',  rarity: 'common',   type: 'armor',  bonus: { def: 8, speed: 5 },     desc: 'Light and worn. Good for running away.' },
  { name: 'Copper Ring',            emoji: '💍',  rarity: 'common',   type: 'ring',   bonus: { hp: 80 },               desc: 'Simple and plain. But there is warmth in it.' },
  { name: 'Herb Pouch',             emoji: '🌿',  rarity: 'common',   type: 'tome',   bonus: { hp: 60, energy: 20 },   desc: 'Dried herbs tied with twine. A traveller\'s best friend.' },
  { name: 'Rusty Dagger',           emoji: '🗡️',  rarity: 'common',   type: 'weapon', bonus: { atk: 12, crit: 5 },    desc: 'Old and chipped. Still bites.' },
  { name: 'Cloth Robe',             emoji: '👘',  rarity: 'common',   type: 'armor',  bonus: { def: 10, energy: 15 },  desc: 'Thin and simple. Mages swear by it.' },
  { name: 'Stone Amulet',           emoji: '📿',  rarity: 'common',   type: 'ring',   bonus: { def: 10, hp: 50 },      desc: 'A carved stone worn around the neck. Said to ward off evil.' },

  // ── RARE (occasional drop) ────────────────────────────────
  { name: 'Silver Bow',             emoji: '🏹',  rarity: 'rare',     type: 'weapon', bonus: { atk: 50, crit: 10 },   desc: 'Crafted by elven smiths. Accurate and swift.' },
  { name: 'Knight\'s Pauldrons',    emoji: '🦺',  rarity: 'rare',     type: 'armor',  bonus: { def: 55, hp: 150 },    desc: 'Shoulder guards of a fallen knight. Still holds its shape.' },
  { name: 'Mage\'s Tome',           emoji: '📘',  rarity: 'rare',     type: 'tome',   bonus: { atk: 45, energy: 60 }, desc: 'Filled with half-decoded spells. Powerful if you can read it.' },
  { name: 'Hunter\'s Ring',         emoji: '💍',  rarity: 'rare',     type: 'ring',   bonus: { atk: 30, crit: 15 },   desc: 'Worn by veteran hunters. Sharpens the killer instinct.' },
  { name: 'Steel Gauntlets',        emoji: '🥊',  rarity: 'rare',     type: 'armor',  bonus: { def: 45, atk: 20 },    desc: 'Heavy fists of steel. Your punch lands differently.' },
  { name: 'Wind Blade',             emoji: '💨',  rarity: 'rare',     type: 'weapon', bonus: { atk: 55, speed: 20 },  desc: 'Light as air. Faster than thought.' },
  { name: 'Jade Pendant',           emoji: '🟢',  rarity: 'rare',     type: 'ring',   bonus: { hp: 250, def: 20 },    desc: 'Warm green stone. Healers prize it above most things.' },

  // ── EPIC (uncommon drop) ──────────────────────────────────
  { name: 'Void Cleaver',           emoji: '⚫', rarity: 'epic',      type: 'weapon', bonus: { atk: 140, pen: 20 },    desc: 'A blade that cuts through reality itself. Armor is meaningless to it.' },
  { name: 'Shadow Fang',            emoji: '🌑', rarity: 'epic',      type: 'weapon', bonus: { atk: 130, evade: 15 },  desc: 'A dagger that moves through shadows. You see it only when it is too late.' },
  { name: 'Phoenix Wand',           emoji: '🔥', rarity: 'epic',      type: 'weapon', bonus: { atk: 145, hp: 500 },    desc: 'Channels rebirth energy. User regenerates between battles.' },
  { name: 'Shadow Shroud',          emoji: '🌑', rarity: 'epic',      type: 'armor',  bonus: { def: 150, evade: 25 },  desc: 'Absorbs light itself. Enemies struggle to target you.' },
  { name: 'Celestial Robe',         emoji: '✨', rarity: 'epic',      type: 'armor',  bonus: { def: 120, atk: 80 },    desc: 'Woven from starlight. Provides both power and protection.' },
  { name: 'Amulet of Catastrophe',  emoji: '🔮', rarity: 'epic',      type: 'ring',   bonus: { atk: 100, crit: 40 },   desc: 'Amplifies destructive energy. Every crit is catastrophic.' },
  { name: "Berserker's Pendant",    emoji: '🩸', rarity: 'epic',      type: 'ring',   bonus: { atk: 160, def: -30 },   desc: 'The more you bleed, the stronger you get. Pain is power.' },
  { name: 'Mana Stone of Pure Power',  emoji: '💎', rarity: 'epic',      type: 'tome',   bonus: { atk: 120, energy: 100 }, desc: 'A crystallized mana core. Spells cost less and hit harder.' },

  // ── LEGENDARY (very rare drop) ────────────────────────────
  { name: "Dragonslayer's Edge",    emoji: '🗡️', rarity: 'legendary', type: 'weapon', bonus: { atk: 180, crit: 25 },  desc: 'Forged from the fang of the first dragon. Every strike carries ancient fury.' },
  { name: 'Stormcaller Staff',      emoji: '⚡', rarity: 'legendary', type: 'weapon', bonus: { atk: 160, speed: 30 },  desc: 'Crackles with endless lightning. Calls storms from clear skies.' },
  { name: 'Titan Maul',             emoji: '🔨', rarity: 'legendary', type: 'weapon', bonus: { atk: 200, def: -20 },   desc: 'So heavy it bends the earth. One hit ends fights.' },
  { name: 'Celestial Bow',          emoji: '🏹', rarity: 'legendary', type: 'weapon', bonus: { atk: 170, crit: 30 },   desc: 'Arrows of starlight. They never miss.' },
  { name: 'Dragon Scale Mail',      emoji: '🐉', rarity: 'legendary', type: 'armor',  bonus: { def: 200, hp: 800 },    desc: 'Shed scales of the Dragon Emperor. Nothing can pierce it cleanly.' },
  { name: 'Titan Plate',            emoji: '⛰️', rarity: 'legendary', type: 'armor',  bonus: { def: 240, hp: 600 },    desc: 'Carved from the hide of a mountain titan. Impenetrable.' },
  { name: 'Void Carapace',          emoji: '🕳️', rarity: 'legendary', type: 'armor',  bonus: { def: 220, nullify: 1 }, desc: 'Absorbs one hit completely per battle. The void protects.' },
  { name: 'Ring of the Eternal',    emoji: '💍', rarity: 'legendary', type: 'ring',   bonus: { hp: 1200, regen: 1 },   desc: 'Worn by immortals. The wearer does not bleed out — they persist.' },
  { name: 'Grimoire of Ruin',       emoji: '📕', rarity: 'legendary', type: 'tome',   bonus: { atk: 150, skillDmg: 30 }, desc: 'A spellbook written in blood. Every spell causes more destruction.' },

  // ── MYTHIC (extremely rare — once in a blue moon) ─────────
  { name: 'Crown of the Void King', emoji: '👑', rarity: 'mythic',    type: 'ring',   bonus: { atk: 200, def: 100, hp: 1000 }, desc: 'The crown of a conquered dimension. Its weight is crushing. Its power is absolute.' },
  { name: 'Soul Stone',             emoji: '🌀', rarity: 'mythic',    type: 'tome',   bonus: { atk: 180, crit: 50, hp: 500 }, desc: 'Contains a trapped god. Its power cannot be measured.' },
  // ── MENDING STONE (durability restore) ───────────────────
  { name: 'Mending Stone',          emoji: '🛠️', rarity: 'epic',     type: 'material', bonus: {}, desc: 'Restores durability of your equipped gear. Use /inventory to apply.', isMendingStone: true },
  // ── RANDOM MATERIALS (claimable) ─────────────────────────
  { name: 'Wood',                   emoji: '🪵', rarity: 'common',   type: 'material', bonus: {}, desc: 'Basic crafting material.' },
  { name: 'Stone',                  emoji: '🪨', rarity: 'common',   type: 'material', bonus: {}, desc: 'Sturdy stone for crafting.' },
  { name: 'Iron Ore',               emoji: '⛏️', rarity: 'common',   type: 'material', bonus: {}, desc: 'Raw iron ore.' },
  { name: 'Leather',                emoji: '🦌', rarity: 'common',   type: 'material', bonus: {}, desc: 'Tanned hide.' },
  { name: 'String',                 emoji: '🧵', rarity: 'common',   type: 'material', bonus: {}, desc: 'Useful for crafting.' },
  { name: 'Flint',                  emoji: '🪨', rarity: 'common',   type: 'material', bonus: {}, desc: 'Sharp flint shard.' },
  { name: 'Mana Fragment',          emoji: '💠', rarity: 'rare',     type: 'material', bonus: {}, desc: 'Pulsing mana fragment.' },
  { name: 'Crystal Shard',          emoji: '🔮', rarity: 'rare',     type: 'material', bonus: {}, desc: 'Glowing crystal.' },
  { name: 'Shadow Essence',         emoji: '🌑', rarity: 'rare',     type: 'material', bonus: {}, desc: 'Dark shadow essence.' },
  { name: 'Dragon Scale',           emoji: '🐉', rarity: 'epic',     type: 'material', bonus: {}, desc: 'Rare dragon scale.' },
];

// Push #91: EVERY epic crafting material can spawn as a single epic drop —
// the Epic recipe pool (Demonic Alloy, Abyssal Stone, Void Metal, …) plus the
// catalog epics (Dragon Scale). Never only Dragon Scale.
function pickEpicMaterial() {
  const out = [];
  try {
    const MSP = require('../../rpg/utils/MaterialSpawnPool');
    for (const [name, w] of Object.entries(MSP.build().epic || {})) out.push({ name, emoji: MSP.emojiFor(name), rarity: 'epic', type: 'material', bonus: {}, desc: `Epic crafting material — ${w} recipe${w === 1 ? '' : 's'} call for it.`, w });
  } catch (e) {}
  for (const a of SPAWN_ARTIFACTS) if (a.rarity === 'epic' && String(a.type).toLowerCase() === 'material' && !(a.isMendingStone || a.name === 'Mending Stone') && !out.some(o => o.name === a.name)) out.push({ ...a, w: 1 });
  if (!out.length) return null;
  const total = out.reduce((s, o) => s + (o.w || 1), 0); let r = Math.random() * total;
  for (const o of out) { r -= (o.w || 1); if (r <= 0) return o; }
  return out[out.length - 1];
}
const GLOBAL_SPAWN_EVERY_MS = 24 * 60 * 60 * 1000; // global spawn once a day (Pro GC spawns every 3h — ProGC.js)

// ─── RARITY ANNOUNCEMENT STYLES ──────────────────────────────
const RARITY_STYLES = {
  common:    { color: '⚪', stars: '⭐',           header: '📦 AN ITEM APPEARS!',             urgency: '👆 First to /claim wins!' },
  rare:      { color: '🔵', stars: '⭐⭐⭐',        header: '💙 RARE ITEM APPEARS!',           urgency: '⚡ First to /claim wins!' },
  epic:      { color: '🟣', stars: '⭐⭐⭐⭐',      header: '💫 EPIC ARTIFACT APPEARS!',       urgency: '⚡ First to /claim wins!' },
  legendary: { color: '🟠', stars: '⭐⭐⭐⭐⭐',    header: '🔥 LEGENDARY ARTIFACT APPEARS!',  urgency: '🔥 Rush! /claim NOW!' },
  mythic:    { color: '🔴', stars: '✨✨✨✨✨✨',   header: '☄️ MYTHIC ARTIFACT APPEARS!!!',   urgency: '☄️ ONCE IN A GENERATION! /claim IMMEDIATELY!' },
};

// ─── FLAVOUR LINES ─────────────────────────────────────────────
const SPAWN_FLAVOUR = [
  '💭 The ground shakes. Something ancient awakens...',
  '✨ A blinding flash illuminates the chat room.',
  '🌌 Rifts in reality tear open and something falls through.',
  '🌑 Darkness ripples. Something powerful has arrived.',
  '⚡ Lightning strikes repeatedly. The sky turns red.',
  '🔮 Ancient wards shatter. A relic long lost is found.',
  '🌋 A rumble from deep within the earth shakes everything.',
  '👁️ The eye of fate opens. It watches you.',
];

// ─── CLAIM TIMER ─────────────────────────────────────────────
// Each active spawn
const activeSpawns = new Map(); // chatId → { artifact, spawnTime, claimed, claimedBy }

// ═══════════════════════════════════════════════════════════════
// SPAWN ENGINE
// ═══════════════════════════════════════════════════════════════
async function spawnArtifact(sock, chatId, db, saveDatabase, forcedArtifact) {
  // Don't double-spawn
  if (activeSpawns.has(chatId)) return;
  // Respect /set spawn --true — only spawn where gates are allowed (integrated)
  if (!forcedArtifact && db.gateSpawns && db.gateSpawns[chatId] !== true) return;
  // GLOBAL DAILY LIMITER: only ONE spawn per 24h across ALL GCs (common->epic once daily)
  if (!forcedArtifact) {
    if (!db.globalSpawn) db.globalSpawn = {};
    const last = db.globalSpawn.lastSpawnAt || 0;
    if (Date.now() - last < GLOBAL_SPAWN_EVERY_MS) return;
  }

  // Pick artifact — LIMITED to common->epic for global daily (per request)
  let artifact;
  if (forcedArtifact) {
    artifact = forcedArtifact;
  } else {
    // Weights for global daily: Common 55% | Rare 30% | Epic 15% (no legendary/mythic for daily)
    // Push #76: weapons/armor/rings/tomes come ONLY from /store now. Spawns
    // are materials + the Mending Stone (which now really spawns: 20%).
    // Push #88f: spawns are RECIPE materials (bundle of 3, weighted by how many
    // recipes need them) — never just "Dragon Scale". Mending Stone stays 20%.
    const mending = SPAWN_ARTIFACTS.find(a => a.isMendingStone || a.name === 'Mending Stone');
    const _r = Math.random();
    if (mending && _r < 0.20) {
      artifact = mending;
    } else if (_r < 0.40 && pickEpicMaterial()) {
      artifact = pickEpicMaterial(); // Push #91: single epic material (any of them)
    } else {
      const MSP = require('../../rpg/utils/MaterialSpawnPool');
      const tier = MSP.rollTier();
      const bundle = MSP.rollBundle(tier, 3);
      artifact = { name: `${tier === 'epic' ? 'Epic' : tier === 'rare' ? 'Rare' : 'Common'} Material Cache`, emoji: '🧰', rarity: tier, type: 'material_bundle', bonus: {}, bundle,
                   desc: `${bundle.reduce((a, b) => a + b.qty, 0)} crafting materials the forge is asking for.` };
    }
  }
  // Mark global spawn time after picking (before announcement to avoid race)
  if (!forcedArtifact) {
    if (!db.globalSpawn) db.globalSpawn = {};
    db.globalSpawn.lastSpawnAt = Date.now();
    db.globalSpawn.lastChatId = chatId;
    db.globalSpawn.lastArtifact = artifact.name;
    try { saveDatabase(); } catch(e){}
  }

  const style   = RARITY_STYLES[artifact.rarity];
  const flavour = SPAWN_FLAVOUR[Math.floor(Math.random() * SPAWN_FLAVOUR.length)];

  // Register the spawn
  activeSpawns.set(chatId, {
    artifact,
    spawnTime: Date.now(),
    claimed: false,
    claimedBy: null
  });

  // Build bonus display
  const bonusLines = Object.entries(artifact.bonus)
    .map(([k, v]) => v > 0 ? `+${v} ${k.toUpperCase()}` : `${v} ${k.toUpperCase()}`)
    .join(' | ');

  const contentLines = artifact.bundle
    ? [`📦 *CONTENTS:*`, require('../../rpg/utils/MaterialSpawnPool').describe(artifact.bundle)]
    : (bonusLines ? [`📊 *STATS:*`, bonusLines] : []);
  const msg = [`━━━━━━━━━━━━━━━━━━━━━━━━━━━`, `${style.color} ${style.header}`, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`, ``, flavour, ``,
    `${artifact.emoji} *${artifact.name}*`, `${style.stars} ${artifact.rarity.toUpperCase()}`, ``, `💭 "${artifact.desc}"`, ``,
    ...contentLines, ``, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`, `⏰ *Available for 5 minutes!*`, style.urgency, `🎯 Type */claim* to grab it!`, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`].join('\n');

  // Push #88f: ONE message — the member ping rides on the spawn itself
  // (the separate Announcer alert was a second, duplicate message).
  let _mentions = [];
  try { const meta = await sock.groupMetadata(chatId); _mentions = (meta.participants || []).map(p => p.id); } catch (e) { _mentions = []; }
  // Push #96h-n: every spawn carries a tap-to-CLAIM button (text fallback keeps the ping).
  let _sentBtn = false;
  try { const B = require('../../utils/buttons'); if (B && B.sendButtons) { await B.sendButtons(sock, chatId, { text: msg, buttons: B.quickReplies([[`🎯 Claim ${artifact.name}`.slice(0, 20), '/claim']]), mentions: _mentions }); _sentBtn = true; } } catch (e) { _sentBtn = false; }
  if (!_sentBtn) await sock.sendMessage(chatId, { text: msg, mentions: _mentions });

  // Expire after 5 minutes
  setTimeout(() => {
    const spawn = activeSpawns.get(chatId);
    if (spawn && !spawn.claimed) {
      activeSpawns.delete(chatId);
      sock.sendMessage(chatId, { text: `⌛ *${artifact.emoji} ${artifact.name}* faded away...\n💭 No one was fast enough to claim it.` }).catch(() => {});
    }
  }, 5 * 60 * 1000);
}

// ═══════════════════════════════════════════════════════════════
// CLAIM COMMAND
// ═══════════════════════════════════════════════════════════════
async function handleClaim(sock, msg, args, getDatabase, saveDatabase, sender) {
  const chatId = msg.key?.remoteJid;
  const db = typeof getDatabase === 'function' ? getDatabase() : getDatabase;
  const spawn  = activeSpawns.get(chatId);

  if (!spawn) {
    return sock.sendMessage(chatId, { text: '❌ No artifact to claim right now!\n⏰ Wait for the next spawn (daily; Pro GC every 3 hours).' }, { quoted: msg });
  }

  if (spawn.claimed) {
    const winner = db.users[spawn.claimedBy];
    return sock.sendMessage(chatId, { text: `❌ Already claimed by *${winner?.name || 'someone'}*!` }, { quoted: msg });
  }

  const player = db.users[sender];
  if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! /register' }, { quoted: msg });

  // ── LUCK CHECK ──────────────────────────────────────────────
  const hasLuckPotion = (player.inventory?.items || []).some(i => i.isLuckPotion);
  const luckBonus     = hasLuckPotion ? ' 🍀 *[LUCK POTION ACTIVE]*' : '';

  // Mark claimed
  spawn.claimed   = true;
  spawn.claimedBy = sender;
  activeSpawns.delete(chatId);

  const art = spawn.artifact;

  // ── Push #87: spawned items go to the REAL inventory, wired to their
  // category — never to the /artifact relic bucket.
  //   • Mending Stone → inventory.items (isMendingStone) → /mend, /inv, /equip use
  //   • materials     → player.materials[name] (crafting) + inventory.items entry
  //   • anything else → RewardInventory.grantItem (gear shape for wearables)
  const RI = require('../../rpg/utils/RewardInventory');
  RI.ensureInventory(player);
  let whereLine = '';
  if (art.isMendingStone || art.name === 'Mending Stone') {
    RI.grantItem(player, { name: 'Mending Stone', type: 'material', rarity: 'epic', emoji: '🛠️', isMendingStone: true, desc: 'Restores all durability to 100%. Use /mend.' }, 'spawn');
    whereLine = '💡 Use */mend* to restore your gear to 100% durability!';
  } else if (art.potionTier) {
    // Push #88q: health potion spawn (3 tiers, capped like every other source)
    const PT = require('../../rpg/utils/PotionTiers');
    PT.add(player, art.potionTier, art.qty || 1);
    whereLine = `💡 Potion added — check */inv* and */use*!`;
  } else if (art.petFoodId) {
    // Push #88q: pet food spawn
    const PDB = require('../../rpg/utils/PetDatabase');
    PDB.addPetFood(player, art.petFoodId, art.qty || 1);
    whereLine = `💡 Pet food added — */pet feed* when your companion is hungry!`;
  } else if (art.bundle && Array.isArray(art.bundle)) {
    require('../../rpg/utils/MaterialSpawnPool').grantBundle(player, art.bundle);
    whereLine = '💡 Materials added — check */inv* and */craft*!';
  } else if (String(art.type || '').toLowerCase() === 'material') {
    if (!player.materials || typeof player.materials !== 'object') player.materials = {};
    player.materials[art.name] = (player.materials[art.name] || 0) + 1;
    RI.grantItem(player, { name: art.name, type: 'material', rarity: art.rarity, emoji: art.emoji, desc: art.desc, isMaterial: true }, 'spawn');
    whereLine = '💡 Added to your materials — check */inv* and */craft*!';
  } else {
    RI.grantItem(player, { name: art.name, type: art.type, rarity: art.rarity, emoji: art.emoji, desc: art.desc, ...(art.bonus || {}) }, 'spawn');
    whereLine = '💡 Added to your inventory — check */inv*!';
  }

  // Consume luck potion if used
  if (hasLuckPotion) {
    const idx = player.inventory.items.findIndex(i => i.isLuckPotion);
    if (idx >= 0) player.inventory.items.splice(idx, 1);
  }

  saveDatabase();

  const style     = RARITY_STYLES[art.rarity] || RARITY_STYLES.common;
  const bonusLines = Object.entries(art.bonus || {})
    .map(([k, v]) => v > 0 ? `+${v} ${k.toUpperCase()}` : `${v} ${k.toUpperCase()}`)
    .join(' | ');

  const elapsed = Math.floor((Date.now() - spawn.spawnTime) / 1000);

  return sock.sendMessage(chatId, {
    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${style.color} *CLAIMED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 *${player.name}* got the ${art.bundle ? 'cache' : 'artifact'}!${luckBonus}\n⚡ Reaction time: ${elapsed}s\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${art.emoji} *${art.name}*\n${style.stars} ${art.rarity.toUpperCase()}\n${art.bundle ? require('../../rpg/utils/MaterialSpawnPool').describe(art.bundle) : bonusLines ? `📊 ${bonusLines}` : `📦 ${art.desc || ''}`}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${whereLine}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    mentions: [sender]
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// AUTO SCHEDULER
// ═══════════════════════════════════════════════════════════════
function startSpawnScheduler(sock, getDatabase, saveDatabase, groupChatIds) {
  if (!groupChatIds || groupChatIds.length === 0) return;

  // Filter to only GCs where spawn is enabled (/set spawn --true)
  function getSpawnEnabledIds(db) {
    if (!db.gateSpawns) return [];
    return groupChatIds.filter(id => db.gateSpawns[id] === true);
  }

  function scheduleNext() {
    // Push #91: check every 10 min; spawn when 3h have passed since the last one
    const delay = 10*60*1000;
    setTimeout(async () => {
      try {
        const db = getDatabase();
        const enabled = getSpawnEnabledIds(db);
        if (enabled.length === 0) { scheduleNext(); return; }
        const last = db.globalSpawn?.lastSpawnAt || 0;
        if (Date.now() - last < GLOBAL_SPAWN_EVERY_MS) { scheduleNext(); return; }
        // Pick ONE random GC among enabled to spawn the daily item
        const pick = enabled[Math.floor(Math.random()*enabled.length)];
        await spawnArtifact(sock, pick, db, saveDatabase);
      } catch(e) {
        console.error('[ArtifactSpawn] Scheduler error:', e.message);
      }
      scheduleNext();
    }, delay);
  }

  // First spawn check after 5-15 minutes
  const firstDelay = (5 * 60 * 1000) + Math.floor(Math.random() * 10 * 60 * 1000);
  setTimeout(async () => {
    try {
      const db = getDatabase();
      const enabled = getSpawnEnabledIds(db);
      if (enabled.length === 0) { scheduleNext(); return; }
      const last = db.globalSpawn?.lastSpawnAt || 0;
      if (Date.now() - last < GLOBAL_SPAWN_EVERY_MS) { scheduleNext(); return; }
      const pick = enabled[Math.floor(Math.random()*enabled.length)];
      await spawnArtifact(sock, pick, db, saveDatabase);
    } catch(e) {}
    scheduleNext();
  }, firstDelay);

  console.log(`[ArtifactSpawn] Global spawn scheduler started (every 24h across all GCs where /set spawn --true). First check in ${Math.floor(firstDelay/60000)} minutes.`);
}

// ═══════════════════════════════════════════════════════════════
// Push #88q: DIVERSIFIED SPAWN POOL — shared by the Pro GC 5-hour spawn and
// the mod /spawn command. Weighted: Mending Stone 20% · Health potion 25%
// (lower 50 / medium 35 / higher 15) · Pet food 15% · Material cache 30%
// (dungeon-loot crafting materials) · Epic material 10% (Dragon Scale etc.).
// Never only Dragon Scales again.
function pickDiversifiedSpawn(opts = {}) {
  const roll = Math.random() * 100;
  const mending = SPAWN_ARTIFACTS.find(a => a.isMendingStone || a.name === 'Mending Stone');
  if (roll < 20 && mending) return mending;
  if (roll < 45) {
    const PT = require('../../rpg/utils/PotionTiers');
    const r = Math.random(); const tier = r < 0.5 ? 'lower' : r < 0.85 ? 'medium' : 'higher';
    const t = PT.TIERS ? PT.TIERS.find(x => x.tier === tier) : null;
    const qty = tier === 'lower' ? 2 : 1;
    return { name: (t && t.name) || `${tier} Health Potion`, emoji: (t && t.emoji) || '🧪', rarity: (t && t.rarity) || 'common', type: 'potion', potionTier: tier, qty, bonus: {}, desc: `${qty}× restores ${(t && t.pct) || 10}% HP. /use it in battle.` };
  }
  if (roll < 60) {
    const { PET_FOOD } = require('../../rpg/utils/PetDatabase');
    const ids = Object.keys(PET_FOOD || {});
    if (ids.length) {
      const id = ids[Math.floor(Math.random() * ids.length)]; const f = PET_FOOD[id];
      const rare = (f.hungerRestore || 0) >= 60;
      return { name: f.name, emoji: f.emoji || '🍖', rarity: rare ? 'rare' : 'common', type: 'petfood', petFoodId: id, qty: rare ? 1 : 2, bonus: {}, desc: `${rare ? 1 : 2}× pet food (+${f.hungerRestore} hunger, +${f.xpBonus} pet XP).` };
    }
  }
  if (roll < 90 || opts.noEpic) {
    const MSP = require('../../rpg/utils/MaterialSpawnPool');
    const tier = opts.proGC ? (Math.random() < 0.5 ? 'rare' : 'epic') : MSP.rollTier();
    const bundle = MSP.rollBundle(tier, 3);
    return { name: `${tier === 'epic' ? 'Epic' : tier === 'rare' ? 'Rare' : 'Common'} Material Cache`, emoji: '🧰', rarity: tier, type: 'material_bundle', bonus: {}, bundle,
             desc: `${bundle.reduce((a, b) => a + b.qty, 0)} crafting materials the forge is asking for.` };
  }
  return pickEpicMaterial() || mending;
}

// ═══════════════════════════════════════════════════════════════
// COMMAND MODULE (admin force-spawn + /claim)
// ═══════════════════════════════════════════════════════════════
module.exports = {
  name: 'artifactspawn',
  aliases: ['spawn'],
  description: 'Artifact spawn system (admin/debug)',

  activeSpawns,
  spawnArtifact,
  handleClaim,
  startSpawnScheduler,
  SPAWN_ARTIFACTS,
  pickDiversifiedSpawn,
  pickEpicMaterial,

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const Mod = require('../../rpg/utils/ModerationUtils');
    // Push #88s: /spawn is OWNER / CO-OWNER level only.
    if (!Mod.isOwnerLike(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ This command is for the bot owner only.' }, { quoted: msg });
    }

    const sub = args[0]?.toLowerCase();

    // Push #88q: /spawn → a forced, diversified spawn (mending stones, potions,
    // pet food, material caches, epic materials) claimable by anyone in the chat.
    // /spawn pet [rarity] → a wild pet only the SPAWNER can /catch (60 s).
    if (sub === 'pet') {
      const { PET_DATABASE } = require('../../rpg/utils/PetDatabase');
      const want = args.slice(1).join(' ').trim().toLowerCase();
      let pool = Object.values(PET_DATABASE);
      if (want) {
        // exact name/id first, then rarity, then partial name
        const exact = pool.filter(p => String(p.name || '').toLowerCase() === want || String(p.id || '').toLowerCase() === want);
        if (exact.length) pool = exact;
        else {
          const byRarity = pool.filter(p => String(p.rarity || '').toLowerCase() === want);
          pool = byRarity.length ? byRarity : pool.filter(p => String(p.name || '').toLowerCase().includes(want));
        }
      }
      if (!pool.length) return sock.sendMessage(chatId, { text: `❌ No pet matches *${args[1]}*. Try a rarity (common/uncommon/rare/epic/legendary/mythic) or a pet name.` }, { quoted: msg });
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      if (!Array.isArray(db.wildPets)) db.wildPets = [];
      const now = Date.now();
      db.wildPets = db.wildPets.filter(w => w && w.expiresAt > now && !(w.forJids || []).some(j => String(j).split('@')[0] === String(sender).split('@')[0]));
      db.wildPets.push({ token: `WP-${now}-${Math.floor(Math.random() * 999)}`, petId: chosen.id, name: chosen.name, emoji: chosen.emoji, rarity: chosen.rarity, gate: 'spawn', spawnedAt: now, expiresAt: now + 60 * 1000, caughtBy: null, attemptsUsed: 0, attemptLog: [], forJids: [sender], spawnedBy: sender });
      saveDatabase();
      { const _pt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🐾 *A WILD PET APPEARS!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${chosen.emoji} *${chosen.name}* — ${String(chosen.rarity || 'common').toUpperCase()}\n👤 Only *@${String(sender).split('@')[0]}* can catch it.\n⏰ It flees in *60 seconds*!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🪤 */catch* — FREE & guaranteed for the spawner`;
        try { const B = require('../../utils/buttons'); return await B.sendButtons(sock, chatId, { text: _pt, buttons: B.quickReplies([[`🪤 Catch ${chosen.name}`.slice(0, 20), '/catch']]), mentions: [sender] }, msg); } catch (e) {} // Push #96h-n: catch button
        return sock.sendMessage(chatId, { text: _pt, mentions: [sender] }, { quoted: msg }); }
    }

    // Push #88u: bare /spawn → the full spawn CATALOG in the owner's DM.
    if (!sub || sub === 'catalog' || sub === 'list' || sub === 'help') {
      const lines = [];
      try {
        const { TIERS } = require('../../rpg/utils/PotionTiers');
        const PD = require('../../rpg/utils/PetDatabase');
        const foods = Object.entries(PD.PET_FOOD || {});
        const pets = Object.values(PD.PET_DATABASE || {});
        const byRarity = {};
        for (const pt of pets) { const r = String(pt.rarity || 'common').toLowerCase(); (byRarity[r] = byRarity[r] || []).push(`${pt.emoji || '🐾'} ${pt.name}`); }
        const epics = (() => { const seen = new Set(); const arr = []; for (let i = 0; i < 400; i++) { const e = pickEpicMaterial(); if (e && !seen.has(e.name)) { seen.add(e.name); arr.push(e); } } return arr.sort((a, b) => a.name.localeCompare(b.name)); })();
        const F = '━━━━━━━━━━━━━━━━━━━━━━━━━━━';
        lines.push(F, '📜 *SPAWN CATALOG* (owner)', F, '',
          '*Commands*',
          '• /spawn force — random diversified spawn (anyone can /claim)',
          '• /spawn mending — 🪨 Mending Stone',
          '• /spawn potion — 🧪 health potion (random tier)',
          '• /spawn food — 🍖 pet food (random)',
          '• /spawn materials — 🧰 crafting material cache · /spawn materials <E|D|C|B|A|S|common|rare|epic|legendary> — cache of that tier',
          '• /spawn material <name> — ANY single crafting material, every tier',
          '• /spawn pet <name|rarity> — wild pet, only YOU can /catch (free, guaranteed, 60 s)',
          '• /spawn status · /spawn clear', '',
          `*🧪 Health potions* (${TIERS.length})`, ...TIERS.map(t => `• ${t.emoji} ${t.name} — heals ${t.pct}% (${t.rarity})`), '',
          `*🍖 Pet food* (${foods.length})`, ...foods.map(([id, f]) => `• ${f.emoji || '🍖'} ${f.name} (\`${id}\`) — +${f.hungerRestore} hunger, +${f.xpBonus} pet XP`), '',
          `*🧰 Material caches* — Common / Rare / Epic (3 forge materials each)`, '',
          `*💎 Epic materials* (${epics.length})`, ...epics.map(a => `• ${a.emoji || '✨'} ${a.name}`), '',
          `*🐾 Pets* (${pets.length}) — /spawn pet <name> or a rarity`);
        for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']) if (byRarity[r]) lines.push(`_${r.toUpperCase()}_ (${byRarity[r].length}): ${byRarity[r].join(', ')}`);
        for (const r of Object.keys(byRarity)) if (!['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].includes(r)) lines.push(`_${r.toUpperCase()}_ (${byRarity[r].length}): ${byRarity[r].join(', ')}`);
        lines.push('', F);
      } catch (e) { lines.push(`⚠️ Catalog error: ${e.message}`); }
      let dmNum = String(sender).split('@')[0].split(':')[0];
      if (String(sender).endsWith('@lid')) { try { const ph = db.lidMap && db.lidMap[dmNum]; if (ph) dmNum = String(ph).split('@')[0].split(':')[0]; } catch (e) {} }
      const dm = `${dmNum}@s.whatsapp.net`;
      const text = lines.join('\n');
      // WhatsApp caps long texts — split at ~3500 chars on line boundaries.
      const chunks = []; let cur = '';
      for (const ln of text.split('\n')) { if ((cur + '\n' + ln).length > 3500) { chunks.push(cur); cur = ln; } else cur = cur ? cur + '\n' + ln : ln; }
      if (cur) chunks.push(cur);
      let sent = true;
      for (const c of chunks) { try { await sock.sendMessage(dm, { text: c }); } catch (e) { sent = false; break; } }
      if (String(chatId).endsWith('@g.us')) await sock.sendMessage(chatId, { text: sent ? '📬 Spawn catalog sent to your DM. Use */spawn force* to spawn here.' : '❌ Could not DM you the catalog — message the bot first, then retry.' }, { quoted: msg });
      else if (!sent) await sock.sendMessage(chatId, { text: '❌ Could not send the catalog.' }, { quoted: msg });
      return;
    }

    // Push #96h-n: /spawn material <name> — ANY crafting material of ANY tier (bestiary drops, base
    // materials, forge pools). /spawn materials <E|D|C|B|A|S|common|rare|epic|legendary> — a cache of that tier.
    const _allMats = () => { const out = {}; try { const Rc = require('../../rpg/utils/Recycler'); for (const [k, v] of Object.entries(Rc.materialRanks ? Rc.materialRanks() : {})) out[k] = { name: v.name, rank: v.rank }; } catch (e) {}
      try { const MSP = require('../../rpg/utils/MaterialSpawnPool'); const b = MSP.build(); for (const [tier, map] of Object.entries(b)) for (const n of Object.keys(map)) { const k = n.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); if (!out[k]) out[k] = { name: n, rank: tier === 'epic' ? 'A' : tier === 'rare' ? 'C' : 'E' }; } } catch (e) {}
      return out; };
    const _rarOfRank = (r) => ({ E: 'common', D: 'common', C: 'rare', B: 'rare', A: 'epic', S: 'legendary' }[String(r).toUpperCase()] || 'common');
    if (sub === 'material' || sub === 'mat' || sub === 'item') {
      if (activeSpawns.has(chatId)) return sock.sendMessage(chatId, { text: '⚠️ There is already an unclaimed spawn here — /claim it first (or /spawn clear).' }, { quoted: msg });
      const want = args.slice(1).join(' ').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const all = _allMats(); const keys = Object.keys(all);
      if (!want) return sock.sendMessage(chatId, { text: `Usage: */spawn material <name>* — ${keys.length} materials across every tier.\nTier caches: */spawn materials <E|D|C|B|A|S|common|rare|epic|legendary>*` }, { quoted: msg });
      const k = keys.find(x => x === want) || keys.find(x => x.startsWith(want)) || keys.find(x => x.includes(want));
      if (!k) return sock.sendMessage(chatId, { text: `❌ No material matches *${args.slice(1).join(' ')}*.` }, { quoted: msg });
      const m = all[k]; const MSP = require('../../rpg/utils/MaterialSpawnPool');
      await spawnArtifact(sock, chatId, db, saveDatabase, { name: m.name, emoji: MSP.emojiFor(m.name), rarity: _rarOfRank(m.rank), type: 'material', bonus: {}, desc: `${m.rank}-rank crafting material. Forge it with /craft.` });
      return;
    }
    if ((sub === 'materials' || sub === 'cache') && args[1]) {
      if (activeSpawns.has(chatId)) return sock.sendMessage(chatId, { text: '⚠️ There is already an unclaimed spawn here — /claim it first (or /spawn clear).' }, { quoted: msg });
      const t = String(args[1]).toLowerCase(); const MSP = require('../../rpg/utils/MaterialSpawnPool');
      const tierMap = { common: ['E', 'D'], rare: ['C', 'B'], epic: ['A'], legendary: ['S'], e: ['E'], d: ['D'], c: ['C'], b: ['B'], a: ['A'], s: ['S'] };
      const ranks = tierMap[t]; if (!ranks) return sock.sendMessage(chatId, { text: `❌ Unknown tier *${args[1]}*. Use E/D/C/B/A/S or common/rare/epic/legendary.` }, { quoted: msg });
      const pool = Object.values(_allMats()).filter(m => ranks.includes(String(m.rank).toUpperCase()));
      if (!pool.length) return sock.sendMessage(chatId, { text: `❌ No materials registered for *${args[1]}*.` }, { quoted: msg });
      const seen = new Set(); const bundle = [];
      for (let i = 0; i < 30 && bundle.length < 3; i++) { const m = pool[Math.floor(Math.random() * pool.length)]; if (seen.has(m.name)) continue; seen.add(m.name); bundle.push({ name: m.name, qty: ranks[0] === 'A' || ranks[0] === 'S' ? 1 : 2 + Math.floor(Math.random() * 3), rarity: _rarOfRank(m.rank), emoji: MSP.emojiFor(m.name), type: 'material' }); }
      const rar = _rarOfRank(ranks[0]);
      await spawnArtifact(sock, chatId, db, saveDatabase, { name: `${ranks.join('/')}-Rank Material Cache`, emoji: '🧰', rarity: rar, type: 'material', bonus: {}, bundle, desc: `A sealed cache of ${ranks.join('/')}-rank crafting materials.` });
      return;
    }
    if (sub === 'force' || sub === 'random' || ['mending', 'stone', 'potion', 'food', 'petfood', 'materials', 'cache'].includes(sub)) {
      if (activeSpawns.has(chatId)) return sock.sendMessage(chatId, { text: '⚠️ There is already an unclaimed spawn here — /claim it first (or /spawn clear).' }, { quoted: msg });
      let art;
      if (sub === 'mending' || sub === 'stone') art = SPAWN_ARTIFACTS.find(a => a.isMendingStone);
      else {
        for (let i = 0; i < 25 && !art; i++) {
          const c = pickDiversifiedSpawn({});
          if (sub === 'force' || sub === 'random') { art = c; break; }
          if (sub === 'potion' && c.potionTier) art = c;
          if ((sub === 'food' || sub === 'petfood') && c.petFoodId) art = c;
          if ((sub === 'materials' || sub === 'cache') && c.bundle) art = c;
        }
      }
      if (!art) art = pickDiversifiedSpawn({});
      await spawnArtifact(sock, chatId, db, saveDatabase, art);
      return;
    }

    if (sub === 'clear') {
      activeSpawns.delete(chatId);
      return sock.sendMessage(chatId, { text: '✅ Active spawn cleared.' }, { quoted: msg });
    }

    if (sub === 'status') {
      const spawn = activeSpawns.get(chatId);
      if (!spawn) return sock.sendMessage(chatId, { text: '❌ No active spawn.' }, { quoted: msg });
      const elapsed = Math.floor((Date.now() - spawn.spawnTime) / 1000);
      return sock.sendMessage(chatId, { text: `Active: ${spawn.artifact.name}\nClaimed: ${spawn.claimed}\nAge: ${elapsed}s` }, { quoted: msg });
    }
  }
};