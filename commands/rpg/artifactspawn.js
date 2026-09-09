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
];

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

  // Pick artifact
  let artifact;
  if (forcedArtifact) {
    artifact = forcedArtifact;
  } else {
    // Realistic rarity weights:
    // Common: 55% | Rare: 30% | Epic: 12% | Legendary: 2.5% | Mythic: 0.5%
    const roll = Math.random() * 100;
    let pool;
    if (roll < 55)       pool = SPAWN_ARTIFACTS.filter(a => a.rarity === 'common');
    else if (roll < 85)  pool = SPAWN_ARTIFACTS.filter(a => a.rarity === 'rare');
    else if (roll < 97)  pool = SPAWN_ARTIFACTS.filter(a => a.rarity === 'epic');
    else if (roll < 99.5) pool = SPAWN_ARTIFACTS.filter(a => a.rarity === 'legendary');
    else                 pool = SPAWN_ARTIFACTS.filter(a => a.rarity === 'mythic');
    artifact = pool[Math.floor(Math.random() * pool.length)];
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

  const msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${style.color} ${style.header}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${flavour}\n\n${artifact.emoji} *${artifact.name}*\n${style.stars} ${artifact.rarity.toUpperCase()}\n\n💭 "${artifact.desc}"\n\n📊 *STATS:*\n${bonusLines}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⏰ *Available for 5 minutes!*\n${style.urgency}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(chatId, { text: msg });

  // Ping @everyone with artifact alert
  try { await Announcer.announceArtifactSpawn(sock, chatId, artifact); } catch(e) {}

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
    return sock.sendMessage(chatId, { text: '❌ No artifact to claim right now!\n⏰ Wait for the next spawn (every 2-3 hours).' }, { quoted: msg });
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

  // ── SAVE TO ARTIFACT INVENTORY ─────────────────────────────
  // Register artifact in ArtifactSystem so it can be used with /artifact commands
  try {
    const ArtifactSystem = require('../../rpg/utils/ArtifactSystem');
    if (!ArtifactSystem.getArtifact(art.name)) {
      // Register it dynamically
      ArtifactSystem.ARTIFACT_DATABASE[art.name] = {
        name:        art.name,
        emoji:       art.emoji,
        rarity:      art.rarity,
        type:        art.type,
        description: art.desc,
        stats:       art.bonus,   // ← must be 'stats' to match ArtifactSystem
        requirements: {},
      };
    }
  } catch(e) {}

  // Initialize artifact inventory if needed
  if (!player.artifacts || typeof player.artifacts !== 'object' || Array.isArray(player.artifacts)) {
    player.artifacts = { inventory: [], equipped: { weapon: null, armor: null, helmet: null, gloves: null, ring: null, amulet: null, tome: null }, enhanced: {} };
  }
  if (!player.artifacts.inventory) player.artifacts.inventory = [];
  if (!player.artifacts.equipped) player.artifacts.equipped = { weapon: null, armor: null, helmet: null, gloves: null, ring: null, amulet: null, tome: null };
  if (!player.artifacts.enhanced) player.artifacts.enhanced = {};

  // Save artifact name as string (compatible with /artifact commands)
  player.artifacts.inventory.push(art.name);

  // Consume luck potion if used
  if (hasLuckPotion) {
    const idx = player.inventory.items.findIndex(i => i.isLuckPotion);
    if (idx >= 0) player.inventory.items.splice(idx, 1);
  }

  saveDatabase();

  const style     = RARITY_STYLES[art.rarity];
  const bonusLines = Object.entries(art.bonus)
    .map(([k, v]) => v > 0 ? `+${v} ${k.toUpperCase()}` : `${v} ${k.toUpperCase()}`)
    .join(' | ');

  const elapsed = Math.floor((Date.now() - spawn.spawnTime) / 1000);

  return sock.sendMessage(chatId, {
    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${style.color} *CLAIMED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 *${player.name}* got the artifact!${luckBonus}\n⚡ Reaction time: ${elapsed}s\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${art.emoji} *${art.name}*\n${style.stars} ${art.rarity.toUpperCase()}\n📊 ${bonusLines}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 Use /artifact equip to put it on!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    mentions: [sender]
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// AUTO SCHEDULER
// ═══════════════════════════════════════════════════════════════
function startSpawnScheduler(sock, getDatabase, saveDatabase, groupChatIds) {
  if (!groupChatIds || groupChatIds.length === 0) return;

  function scheduleNext() {
    // 2-3 hours in ms
    const delay = (2 * 60 * 60 * 1000) + Math.floor(Math.random() * 60 * 60 * 1000);
    setTimeout(async () => {
      try {
        const db = getDatabase();
        for (const chatId of groupChatIds) {
          await spawnArtifact(sock, chatId, db, saveDatabase);
        }
      } catch(e) {
        console.error('[ArtifactSpawn] Scheduler error:', e.message);
      }
      scheduleNext();
    }, delay);
  }

  // First spawn after 30min to 1hr on bot start
  const firstDelay = (30 * 60 * 1000) + Math.floor(Math.random() * 30 * 60 * 1000);
  setTimeout(async () => {
    try {
      const db = getDatabase();
      for (const chatId of groupChatIds) {
        await spawnArtifact(sock, chatId, db, saveDatabase);
      }
    } catch(e) {}
    scheduleNext();
  }, firstDelay);

  console.log(`[ArtifactSpawn] Scheduler started. First spawn in ${Math.floor(firstDelay/60000)} minutes.`);
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

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const Mod = require('../../rpg/utils/ModerationUtils');
    // Owner / co-owner / mods can force spawn (fix co-owner blocked)
    if (!Mod.canModerate(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ This command is for admins only (mods/owners).' }, { quoted: msg });
    }

    const sub = args[0]?.toLowerCase();

    if (sub === 'force' || !sub) {
      await spawnArtifact(sock, chatId, db, saveDatabase);
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