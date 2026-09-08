// awaken.js — Prestige/Awakening System
// Tier 1: Level 50  → First Awakening  (powerful boost + new passive)
// Tier 2: Level 75  → Second Awakening (massive boost + class evolution)
// Tier 3: Level 100 → True Awakening   (legendary boost + divine passive)

const LevelUpManager = require('../../rpg/utils/LevelUpManager');

const AWAKENING_TIERS = {
  1: {
    name: 'First Awakening',
    emoji: '✨',
    levelReq: 50,
    cost: { crystals: 1000, gold: 100000 },
    statBoosts: { maxHp: 500, maxEnergy: 100, atk: 80, def: 50, speed: 15 },
    description: 'Your power breaks its first seal. A new form awaits.',
    passive: 'Awakened Core — +15% all damage dealt. Immune to one-hit kills.',
    titleUnlock: 'The Awakened',
  },
  2: {
    name: 'Second Awakening',
    emoji: '🔥',
    levelReq: 75,
    cost: { crystals: 5000, gold: 500000 },
    statBoosts: { maxHp: 1500, maxEnergy: 250, atk: 200, def: 120, speed: 30 },
    description: 'Your class evolves. Ancient power stirs in your veins.',
    passive: 'Class Transcendence — Class special costs 0 momentum. +25% skill damage.',
    titleUnlock: 'Transcendent',
  },
  3: {
    name: 'True Awakening',
    emoji: '👑',
    levelReq: 100,
    cost: { crystals: 20000, gold: 2000000 },
    statBoosts: { maxHp: 5000, maxEnergy: 500, atk: 500, def: 300, speed: 50 },
    description: 'You have reached the apex of human potential. You are something more.',
    passive: 'Divine Essence — +50% all stats in PvP. Boss damage +100%. Cannot be stunned.',
    titleUnlock: 'The Divine',
  }
};

// Class evolution names for Second Awakening
const CLASS_EVOLUTIONS = {
  Warrior:      'War God',          Mage:         'Archmage',
  Archer:       'Hawkeye',          Rogue:        'Phantom Thief',
  Knight:       'Holy Paladin',     Monk:         'Grand Master',
  Shaman:       'Nature Deity',     Warlord:      'Supreme Warlord',
  Paladin:      'Divine Crusader',  Necromancer:  'Death Sovereign',
  Assassin:     'Silent Reaper',    Elementalist: 'Elemental God',
  Ranger:       'Forest Sovereign', BloodKnight:  'Blood God',
  SpellBlade:   'Runic Sovereign',  Berserker:    'Chaos God',
  DragonKnight: 'Dragon Emperor',   Summoner:     'Grand Summoner',
  ShadowDancer: 'Void Dancer',      Devourer:     'Void God',
  Chronomancer: 'Time God',         Phantom:      'Death God',
  Senku:        'Senku Overdriven',
};

module.exports = {
  name: 'awaken',
  aliases: ['ascend', 'prestige'],
  description: 'Awaken your power — massive stat boosts at levels 50, 75, 100',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! /register' }, { quoted: msg });

    const sub = args[0]?.toLowerCase();
    const awakenTier = player.awakenTier || 0;
    const className  = typeof player.class === 'string' ? player.class : player.class?.name  || 'Awaiting';

    // ── STATUS / INFO ──────────────────────────────────────
    if (!sub || sub === 'info' || sub === 'status') {
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✨ *AWAKENING SYSTEM*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      txt += `👤 *${player.name}* [${className}] Lv.${player.level}\n`;
      txt += `⚡ Current Tier: ${awakenTier > 0 ? `✨ Tier ${awakenTier}` : 'None (mortal)'}\n\n`;

      Object.entries(AWAKENING_TIERS).forEach(([tier, data]) => {
        const tierNum  = parseInt(tier);
        const unlocked = awakenTier >= tierNum;
        const canDo    = player.level >= data.levelReq && awakenTier === tierNum - 1;
        const status   = unlocked ? '✅ UNLOCKED' : canDo ? '🔓 AVAILABLE' : `🔒 Req. Lv${data.levelReq}`;

        txt += `${data.emoji} *${data.name}* — ${status}\n`;
        txt += `   📊 +${data.statBoosts.atk} ATK | +${data.statBoosts.def} DEF | +${data.statBoosts.maxHp} HP\n`;
        txt += `   💡 ${data.passive}\n`;
        if (!unlocked) {
          txt += `   💠 Cost: ${data.cost.crystals.toLocaleString()} 💎 | ${data.cost.gold.toLocaleString()} 💠\n`;
        }
        txt += '\n';
      });

      if (awakenTier < 3) {
        const next = AWAKENING_TIERS[awakenTier + 1];
        txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        txt += `📋 *NEXT: ${next.name}* (Lv.${next.levelReq})\n`;
        txt += `💠 ${next.cost.crystals.toLocaleString()} 💎 + ${next.cost.gold.toLocaleString()} 💠\n`;
        txt += `/awaken confirm — Awaken now!\n`;
      } else {
        txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👑 *TRUE AWAKENING ACHIEVED*\nYou have reached the apex.\n`;
      }
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── CONFIRM AWAKENING ──────────────────────────────────
    if (sub === 'confirm' || sub === 'do' || sub === 'go') {
      const nextTier = awakenTier + 1;
      const tierData = AWAKENING_TIERS[nextTier];

      if (!tierData) {
        return sock.sendMessage(chatId, { text: '👑 You have already achieved True Awakening!\nYou have surpassed all limits.' }, { quoted: msg });
      }

      if (player.level < tierData.levelReq) {
        return sock.sendMessage(chatId, {
          text: `❌ *${tierData.name}* requires Level *${tierData.levelReq}*!\nYou are Level ${player.level}.\n\n💡 Keep grinding! ${tierData.levelReq - player.level} levels to go.`
        }, { quoted: msg });
      }

      if ((player.manaCrystals || 0) < tierData.cost.crystals) {
        return sock.sendMessage(chatId, {
          text: `❌ Not enough Mana Stones!\nNeed: ${tierData.cost.crystals.toLocaleString()} 💎\nHave: ${(player.manaCrystals||0).toLocaleString()} 💎`
        }, { quoted: msg });
      }

      if ((player.gold || 0) < tierData.cost.gold) {
        return sock.sendMessage(chatId, {
          text: `❌ Not enough Nexus!\nNeed: ${tierData.cost.gold.toLocaleString()} 💠\nHave: ${(player.gold||0).toLocaleString()} 💠`
        }, { quoted: msg });
      }

      // Apply cost
      player.manaCrystals -= tierData.cost.crystals;
      player.gold         -= tierData.cost.gold;

      // Apply stat boosts
      const b = tierData.statBoosts;
      player.stats.maxHp     = (player.stats.maxHp     || 100) + b.maxHp;
      player.stats.hp        = player.stats.maxHp; // full heal on awaken
      player.stats.maxEnergy = (player.stats.maxEnergy || 100) + b.maxEnergy;
      player.stats.energy    = player.stats.maxEnergy;
      player.stats.atk       = (player.stats.atk || 10) + b.atk;
      player.stats.def       = (player.stats.def || 5)  + b.def;
      player.stats.speed     = (player.stats.speed || 100) + b.speed;

      // Set tier
      player.awakenTier = nextTier;

      // Apply title
      if (!player.titles) player.titles = [];
      if (!player.titles.includes(tierData.titleUnlock)) player.titles.push(tierData.titleUnlock);

      // Store passive for later use
      if (!player.awakenPassives) player.awakenPassives = [];
      player.awakenPassives.push(tierData.passive);

      // Class evolution on Tier 2
      let evolutionMsg = '';
      if (nextTier === 2) {
        const evo = CLASS_EVOLUTIONS[className];
        if (evo) {
          player.evolvedClass = evo;
          evolutionMsg = `\n\n🔥 *CLASS EVOLVED!*\n${className} → *${evo}*\nYour class has transcended its limits!`;
        }
      }

      saveDatabase();

      const lines = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `${tierData.emoji} *${tierData.name.toUpperCase()} ACHIEVED!*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `💭 "${tierData.description}"`,
        ``,
        `📊 *STAT BOOSTS:*`,
        `❤️ +${b.maxHp} Max HP → ${player.stats.maxHp}`,
        `⚡ +${b.maxEnergy} Max Energy → ${player.stats.maxEnergy}`,
        `⚔️ +${b.atk} ATK → ${player.stats.atk}`,
        `🛡️ +${b.def} DEF → ${player.stats.def}`,
        `💨 +${b.speed} SPD → ${player.stats.speed}`,
        ``,
        `✨ *NEW PASSIVE:*`,
        tierData.passive,
        ``,
        `🎖️ Title Unlocked: *"${tierData.titleUnlock}"*`,
        evolutionMsg,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        nextTier < 3
          ? `📋 Next: *${AWAKENING_TIERS[nextTier+1].name}* at Lv.${AWAKENING_TIERS[nextTier+1].levelReq}`
          : `👑 *YOU HAVE REACHED THE APEX.*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].filter(l => l !== null).join('\n');

      return sock.sendMessage(chatId, { text: lines }, { quoted: msg });
    }

    return sock.sendMessage(chatId, { text: '❌ Usage: /awaken or /awaken confirm' }, { quoted: msg });
  }
};
