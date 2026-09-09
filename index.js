// Load .env file FIRST — before any other code reads process.env
require('dotenv').config();

const fs = require('fs');
let cachedConfig = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const path = require('path');
const readline = require('readline');
const { MongoClient } = require('mongodb');
const rpgCommandHandler = require('./handlers/rpgCommandHandler');
const PlayerMigration = require('./rpg/utils/PlayerMigration');
const RegenManager = require('./rpg/utils/RegenManager');
const GateManager = require('./rpg/dungeons/GateManager');
const SeasonManager = require('./rpg/utils/SeasonManager');
const Announcer = require('./rpg/utils/Announcer');
const GuildWar = require('./commands/rpg/guildwar');

// ── Astra Multi-Bot System ───────────────────────────────────────────────────
const PersonalityManager  = require('./bots/PersonalityManager');
const AIHandler           = require('./bots/AIHandler');
const MultiSocketManager  = require('./bots/MultiSocketManager');
const { recordCommand }   = require('./bots/CCTVManager');
const GateKeyManager      = require('./rpg/dungeons/GateKeyManager');
const SerfManager         = require('./rpg/utils/SerfManager');
const Perms               = require('./utils/permissions');

// ── OWNER DIAGNOSTIC ────────────────────────────────────────────────────────
// Prints the owner/co-owner the bot is using, and the normalised number, so
// you can see at a glance whether OWNER_JID is being read from .env.
// If this shows a "placeholder"/wrong number, OWNER_JID isn't set in .env.
{
  const o = process.env.OWNER_JID || require('./utils/constants').OWNER_JID || '(none)';
  const c = process.env.COOWNER_JID || require('./utils/constants').COOWNER_JID || '(none)';
  const norm = (j) => String(j || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  console.log(`🧑‍💼 OWNER_JID   = ${o}  (normalised: ${norm(o)})`);
  console.log(`🤝 COOWNER_JID = ${c}  (normalised: ${norm(c)})`);
  console.log('   Sending /start as a different number than these = "Only owner" message.');
}

// Register linked WhatsApp numbers → personalities from env
const PERSONALITY_KEYS = ['hinata','lunar','aria','kira','zephyr','nova','void','seraph','echo','raven','jinx'];
for (const key of PERSONALITY_KEYS) {
  const envJid = process.env[`BOT_${key.toUpperCase()}`];
  if (envJid) {
    PersonalityManager.registerLinkedNumber(envJid.trim(), key);
    console.log(`🤖 Registered bot: ${key} → ${envJid}`);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ── MongoDB setup (OPTIONAL) ─────────────────────────────────
// Mongo is used when MONGODB_URI is set. If it's missing, the bot
// runs fully on the local JSON database instead — so you can host
// it locally with no DB setup. A Mongo URI is only needed for
// production/multi-device deployments.
const MONGO_URI = process.env.MONGODB_URI || '';
if (!MONGO_URI) {
  console.log('ℹ️  MONGODB_URI not set — running on local JSON database (Mongo optional).');
}
let mongoClient = null;
let mongoDb = null;
let mongoCollection = null;

// ── Owner / co-owner JIDs (single source of truth) ──────────────────────────
const { OWNER_JID, COOWNER_JID, PRIVILEGED_JIDS } = require('./utils/constants');

// ── Bot lifecycle ────────────────────────────────────────────────────────────
// ALL bots are equal. Every bot:
//   - Handles RPG commands in groups
//   - Reacts to AI chat in groups when its personality is active
//   - Sends DMs to its serf (welcome DM is the only bypass)
//
// "AstraLink host" — whichever bot socket we use to issue pairing codes —
// is just whichever socket the HTTP API happens to call. There is no
// special "primary" bot anymore.
let _astralinkHostKey = null;
let _astralinkHostSock = null;

async function connectMongo() {
  if (!MONGO_URI) return false; // Mongo optional — no URI means local JSON DB only
  try {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    mongoDb = mongoClient.db('rpgbot');
    mongoCollection = mongoDb.collection('database');
    console.log('✅ MongoDB connected successfully!');
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    return false;
  }
}

async function loadFromMongo() {
  try {
    const doc = await mongoCollection.findOne({ _id: 'main' });
    if (doc) {
      delete doc._id;
      database = doc;
      console.log(`✅ Database loaded from MongoDB (${Object.keys(database.users || {}).length} players)`);
      return true;
    }
    return false;
  } catch (err) {
    console.error('❌ MongoDB load failed:', err.message);
    return false;
  }
}

let saveTimeout = null;
let pendingMongoWrite = null;
async function saveToMongo() {
  if (!mongoCollection) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    pendingMongoWrite = (async () => {
      try {
        await mongoCollection.replaceOne(
          { _id: 'main' },
          { _id: 'main', ...database },
          { upsert: true }
        );
      } catch (err) {
        console.error('❌ MongoDB save failed:', err.message);
        try {
          fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
          fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2));
          console.warn('⚠️  Wrote JSON fallback after Mongo failure');
        } catch(e) {
          console.error('❌ JSON fallback also failed:', e.message);
        }
      } finally {
        pendingMongoWrite = null;
      }
    })();
  }, 2000);
}

// ── Persistent data paths ─────────────────────────────────────
const DATA_DIR   = process.env.DATA_DIR || __dirname;
const AUTH_DIR   = process.env.AUTH_DIR || path.join(DATA_DIR, 'auth');
const DB_PATH    = path.join(DATA_DIR, 'database', 'database.json');

const fs_sync = require('fs');
[AUTH_DIR, path.dirname(DB_PATH)].forEach(d => {
  if (!fs_sync.existsSync(d)) fs_sync.mkdirSync(d, { recursive: true });
});

// Initialize database
let database = { users: {}, banlist: {}, dailyQuests: {}, botMods: [], botOwners: [] };
const loadDatabase = () => {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      database = JSON.parse(data);

      PlayerMigration.migrateAllPlayers(database);

      // ── Migrate botAdmins → botMods (one-shot, July 2026) ────────
      if (database.botAdmins) {
        if (!database.botMods) database.botMods = [];
        const OWNER_JID  = require('./utils/constants').OWNER_JID;
        const COOWNER_JID = require('./utils/constants').COOWNER_JID;
        for (const jid of database.botAdmins) {
          if (jid === OWNER_JID || jid === COOWNER_JID) continue;
          if (!database.botMods.includes(jid)) database.botMods.push(jid);
        }
        delete database.botAdmins;
        console.log('🔄 Migrated botAdmins → botMods');
      }
      if (!database.botMods)   database.botMods   = [];
      if (!database.botOwners) database.botOwners = [];

      let fixedPlayers = 0;
      let removedPlayers = 0;

      for (const userId in database.users) {
        const player = database.users[userId];

        if (!player) {
          console.log(`⚠️ Removing corrupted player: ${userId}`);
          delete database.users[userId];
          removedPlayers++;
          continue;
        }

        if (!player.statusEffects) player.statusEffects = [];
        if (!player.comboCount) player.comboCount = 0;

        if (!player.stats) {
          console.error(`⚠️ Player ${userId} has no stats! Removing.`);
          delete database.users[userId];
          removedPlayers++;
          continue;
        }

        let leveled = false;
        while (true) {
          const xpNeeded = Math.floor(200 * Math.pow(player.level, 1.8));
          if (player.xp >= xpNeeded) {
            player.level++;
            player.xp -= xpNeeded;
            player.stats.maxHp += 10;
            player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + 10);

            if (player.stats.maxMana !== undefined && player.stats.maxEnergy === undefined) {
              player.stats.maxEnergy = player.stats.maxMana;
              player.stats.energy = player.stats.mana;
              delete player.stats.mana;
              delete player.stats.maxMana;
            }

            player.stats.maxEnergy += 5;
            player.stats.energy = Math.min(player.stats.maxEnergy, player.stats.energy + 5);
            player.stats.atk += 3;
            player.stats.def += 2;
            leveled = true;
          } else {
            break;
          }
        }

        if (player.pvpElo    === undefined) player.pvpElo    = 1000;
        if (player.pvpWins   === undefined) player.pvpWins   = 0;
        if (player.pvpLosses === undefined) player.pvpLosses = 0;
        if (player.pvpStreak === undefined) player.pvpStreak = 0;
        if (!Array.isArray(player.titles))  player.titles    = [];
        if (!player.bannerState)            player.bannerState = {};
        if (!player.summonArtifacts)        player.summonArtifacts = [];
        if (!player.summonWeapons)          player.summonWeapons = {};
        if (!player.constellations)          player.constellations = {};

        if (player.gold < 0) {
          console.log(`⚠️ Fixed negative gold for ${player.name}: ${player.gold} → 0`);
          player.gold = 0;
          leveled = true;
        }

        if (!player.inventory) {
          player.inventory = {
            healthPotions: 0,
            manaPotions: 0,
            energyPotions: 0,
            reviveTokens: 0
          };
          leveled = true;
        }

        if (leveled) {
          fixedPlayers++;
        }
      }

      if (database.guilds) {
        let guildsFixed = 0;
        let guildsRemoved = 0;
        for (const guildId in database.guilds) {
          const guild = database.guilds[guildId];
          if (!guild.leader) {
            delete database.guilds[guildId];
            guildsRemoved++;
            continue;
          }
          if (!database.users[guild.leader]) {
            delete database.guilds[guildId];
            guildsRemoved++;
            continue;
          }
          if (!guild.members || !Array.isArray(guild.members)) {
            guild.members = [{ id: guild.leader, name: database.users[guild.leader]?.name || 'Unknown', rank: 'Leader', joinedAt: Date.now() }];
            guildsFixed++;
          }
          const validMembers = guild.members.filter(m => database.users[m.id]);
          if (validMembers.length !== guild.members.length) {
            guild.members = validMembers;
            guildsFixed++;
          }
          if (!guild.members.some(m => m.id === guild.leader)) {
            guild.members.push({ id: guild.leader, name: database.users[guild.leader]?.name || 'Unknown', rank: 'Leader', joinedAt: Date.now() });
            guildsFixed++;
          }
        }
        if (guildsFixed > 0 || guildsRemoved > 0) {
          console.log(`✅ Fixed ${guildsFixed} guild(s), removed ${guildsRemoved} broken guild(s)`);
        }
      }

      if (fixedPlayers > 0 || removedPlayers > 0) {
        saveDatabase();
        console.log(`✅ Auto-fixed ${fixedPlayers} player(s), removed ${removedPlayers} corrupted player(s)`);
      }

      let battlesCleared = 0;
      const BATTLE_STALE_MS = 10 * 60 * 1000;
      for (const userId in database.users) {
        const player = database.users[userId];
        if (player?.pvpBattle && Date.now() - (player.pvpBattle.startTime || 0) > BATTLE_STALE_MS) {
          const b = player.pvpBattle;
          if (b.petPassiveAtk) player.stats.atk = Math.max(0, (player.stats.atk||0) - b.petPassiveAtk);
          if (b.petPassiveDef) player.stats.def = Math.max(0, (player.stats.def||0) - b.petPassiveDef);
          if (b.petPassiveSpd) player.stats.speed = Math.max(0, (player.stats.speed||0) - b.petPassiveSpd);
          player.pvpBattle = null;
          player.statusEffects = [];
          player.buffs = [];
          battlesCleared++;
        }
      }
      if (battlesCleared > 0) {
        console.log(`⚔️ Cleared ${battlesCleared} orphaned PvP battle(s) on startup`);
        saveDatabase();
      }

      if (database.pendingChallenges) {
        const now = Date.now();
        let staleChallenges = 0;
        for (const targetId in database.pendingChallenges) {
          if (now - (database.pendingChallenges[targetId].timestamp || 0) > 90_000) {
            delete database.pendingChallenges[targetId];
            staleChallenges++;
          }
        }
        if (staleChallenges > 0) console.log(`🧹 Cleared ${staleChallenges} stale PvP challenge(s)`);
      }

      if (database.pendingTrades) {
        const now = Date.now();
        const TRADE_EXPIRE_MS = 24 * 60 * 60 * 1000;
        let staleTrades = 0;
        for (const userId in database.pendingTrades) {
          const t = database.pendingTrades[userId];
          if (!t || (t.timestamp && now - t.timestamp > TRADE_EXPIRE_MS)) {
            delete database.pendingTrades[userId];
            staleTrades++;
          }
        }
        if (staleTrades > 0) console.log(`🧹 Cleared ${staleTrades} stale trade offer(s)`);
      }

      console.log('✅ Database loaded successfully');
      console.log(`👥 ${Object.keys(database.users).length} players loaded`);
    } else {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      saveDatabase();
      console.log('✅ New database created');
    }
  } catch (error) {
    console.error('❌ Error loading database:', error);
  }
};

const getDatabase = () => database;

// ── JSON write queue ─────────────────────────────────────────────────────────
let _jsonWriteRunning = false;
let _jsonWriteDirty  = false;
let _jsonWriteInFlight = null;

async function _writeJsonBackup() {
  if (_jsonWriteRunning) { _jsonWriteDirty = true; return _jsonWriteInFlight; }
  _jsonWriteRunning = true;
  _jsonWriteInFlight = (async () => {
    try {
      const snapshot = JSON.stringify(database, null, 2);
      const tmpPath = DB_PATH + '.tmp';
      await fs.promises.mkdir(path.dirname(DB_PATH), { recursive: true });
      await fs.promises.writeFile(tmpPath, snapshot);
      await fs.promises.rename(tmpPath, DB_PATH);
    } catch (e) {
      console.error('❌ JSON backup save failed:', e.message);
    } finally {
      _jsonWriteRunning = false;
      _jsonWriteDirty  = false;
      _jsonWriteInFlight = null;
      if (_jsonWriteDirty) {
        setImmediate(() => _writeJsonBackup());
      }
    }
  })();
  return _jsonWriteInFlight;
}

const saveDatabase = () => {
  saveToMongo();
  _writeJsonBackup();
};

async function flushJsonBackup() {
  if (_jsonWriteInFlight) {
    await Promise.race([
      _jsonWriteInFlight,
      new Promise((_, rej) => setTimeout(() => rej(new Error('json flush timeout')), 3000))
    ]);
  }
}

// ── Group join/leave announcers (shared by all bots) ──────────────
// Only the active bot in the group posts the group announcement.
// The welcome DM is NOT sent here — it's sent after the user
// completes /register (in commands/rpg/register.js), and that DM
// uses safeSendDM with the `welcome` bypass flag.
const CREATOR_ID  = require('./utils/constants').OWNER_NUMBER;
const COOWNER_ID  = '194592469209292';

const JOIN_NARUTO = [
  "⚡ *THE CHOSEN ONE ARRIVES.*\nNaruto — creator of this world — has entered the server.\nAll who stand before him, bow. 🌀",
  "🌟 The heavens tremble. *@naruto* steps in.\nWhere he walks, legends are born.",
  "💥 Reality cracks. The bot's creator materializes from thin air.\n*Naruto* is here. You're in safe hands.",
  "🌀 *CREATOR ONLINE.* The architect of this realm descends.\nAll hail the one who built your adventure.",
  "⚡ A familiar energy fills the room. The one who made it all possible — *Naruto* — has arrived."
];

const JOIN_COOWNER = [
  "👑 *CO-OWNER IN THE BUILDING.*\nThe second throne is occupied. Walk carefully.",
  "🔥 Co-owner detected. Adjust your behavior accordingly. *Or don't — see what happens.*",
  "💎 A pillar of the server just walked in. Respect where it's due.",
  "🌑 The co-owner arrives. The energy shifts. The vibe changes. Welcome.",
  "⚔️ Co-owner online. The chain of command is complete."
];

const JOIN_MSGS = [
  `⚔️ *A new soul has entered the battlefield.*\n\n@{tag} just walked through the gates. The dungeon doesn't care if you're ready.\n\nWill you rise... or be forgotten like the rest?\n\n🩸 *Welcome to the guild. Don't die on the first floor.*`,
  `🌀 *The gates creak open.*\n\n@{tag} steps into the unknown. No map. No guide. Just instinct.\n\n📌 */register [name]* — your legend starts now.`,
  `💥 *NEW CHALLENGER DETECTED.*\n\n@{tag} has arrived. The monsters are already watching.\n\nDon't let them feast. 🔥`,
  `🌟 *A familiar energy stirs in the air...*\n\n@{tag} descended from somewhere better and chose HERE.\n\nHonored. Now prove you belong. ⚡`,
  `🐉 *Even the dragons looked up.*\n\n@{tag} just walked in. Something about them feels... dangerous.\n\n📌 */register [name]* to begin your ascent.`,
  `🌌 *From the void, a warrior emerges.*\n\n@{tag} has joined the realm. The board shifts.\n\nEvery legend starts somewhere. This is yours.`,
  `🎯 *Locked in. Loaded. Ready.*\n\n@{tag} just entered the arena and the crowd went silent.\n\nLet's see if the hype is real. ⚔️`,
  `🌊 *The tide brought something new.*\n\n@{tag} arrived. Whether storm or calm, only time will tell.\n\nWelcome. */register [name]* to start.`,
  `🔮 *Fate led you here.*\n\n@{tag} answered the call that most people ignore.\n\nThe dungeon awaits. Are you ready?`,
  `👊 *They didn't knock. They just walked in.*\n\n@{tag} owns this entrance energy and we respect it.\n\nGet registered. Get strong. Get legendary. 💎`,
  `🏹 *A shadow moves at the edge of the forest.*\n\n@{tag} has arrived, silent and purposeful.\n\nThe hunt begins. */register [name]*`,
  `⭐ *One more star added to the sky.*\n\n@{tag} joins the constellation of warriors who dared to show up.\n\nShine bright. Or burn out. Your choice. 🔥`,
  `🗡️ *Steel hits the floor as the newcomer draws their blade.*\n\n@{tag} is here. No pleasantries. Just purpose.\n\nWelcome to the battlefield.`,
  `💀 *The grim reaper looked up... and put the pen down.*\n\n@{tag} isn't going anywhere yet. They just got here.\n\n📌 */register [name]* — let the journey begin.`,
  `🌿 *Something stirs in the wilderness.*\n\n@{tag} emerged from wherever they were hiding.\n\nThe real world is overrated anyway. Welcome home. ⚔️`,
  `🔥 *Heat signature detected. New warrior incoming.*\n\n@{tag} has entered the compound.\n\nThe monsters have been notified. Good luck.`,
  `🏆 *The trophy case just got more competitive.*\n\n@{tag} stepped into the arena.\n\nEvery rank starts at zero. Grind or be left behind.`,
  `💫 *A ripple in the server. Then silence. Then —*\n\n@{tag} appeared.\n\nThe timeline adjusted itself. Welcome.`,
  `🌑 *From the darkness, a presence emerges.*\n\n@{tag} walks among us now.\n\nFriend or foe? Only the dungeons will decide. ⚔️`,
  `🎮 *Player spawned.*\n\n@{tag} loaded into the world. Stats: unknown. Potential: limitless.\n\nStart your journey — */register [name]*`
];

const LEAVE_MSGS = [
  `💔 *The battlefield lost a soldier.*\n\n@{tag} has left. No fanfare. No explanation.\n\nJust an empty seat and a story that ends here.`,
  `🌑 *A light went out.*\n\n@{tag} departed. The server felt it.\n\nMay wherever they went treat them better than the dungeon did.`,
  `🚶 *They walked away without looking back.*\n\n@{tag} is gone. Some people know when to leave.\n\nRespect the exit.`,
  `❄️ *Gone cold.*\n\n@{tag} ghosted without a goodbye. No message. No warning.\n\nJust... gone. We'll pour one out.`,
  `💨 *Blink and you'd have missed it.*\n\n@{tag} vanished like smoke.\n\nThe void claims another.`,
  `🌊 *Returned to the sea.*\n\n@{tag} sailed off. The horizon swallowed them whole.\n\nFair winds, warrior. Fair winds.`,
  `🎭 *The curtain fell.*\n\n@{tag} left the stage.\n\nThe show continues without them.`,
  `⚡ *Signal lost.*\n\n@{tag} disconnected. The server grid has one fewer node.\n\nMaybe they'll respawn somewhere better.`,
  `🌌 *Returned to the void.*\n\n@{tag} faded. All things come and go.\n\nThe dungeon remembers everyone it loses.`,
  `🕯️ *The torch goes dark.*\n\n@{tag}'s flame is out.\n\nSomeone else will carry it now.`,
  `🏃 *No warning. No countdown.*\n\n@{tag} dipped. Clean exit.\n\nNot everyone needs a goodbye.`,
  `💀 *Name removed from the roster.*\n\n@{tag} has been erased from the active ranks.\n\nThe dungeon doesn't pause for departures.`,
  `🌙 *Last login: now.*\n\n@{tag} logged off and didn't come back.\n\nPeace to wherever they ended up.`,
  `📭 *An empty seat remains.*\n\n@{tag} left it behind. Someone else will fill it eventually.`,
  `🎲 *Cashed out.*\n\n@{tag} folded their hand and walked away from the table.\n\nSmart exit or early quit — only time will tell.`,
  `🗺️ *Left to find other realms.*\n\n@{tag} packed up and headed somewhere unknown.\n\nMay the dungeons out there be kinder.`,
  `🔇 *Silence where there was sound.*\n\n@{tag} went quiet. Permanently.\n\nThe server noticed the gap they left.`,
  `🎯 *Missed the mark and moved on.*\n\n@{tag} is gone.\n\nCome back when you're ready to aim again.`,
  `🌿 *Back to the wild.*\n\n@{tag} returned to wherever adventurers go when they disappear.`,
  `⚔️ *The sword is sheathed.*\n\n@{tag} chose to walk away from the fight.\n\nEvery warrior picks their battles. This one's done.`
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── onGroupJoin: dispatched by whichever bot is active in the group.
// All bots in the group receive the join event, but only the active one
// posts the group announcement. The welcome DM is sent separately after
// the user completes /register (see commands/rpg/register.js).
async function onGroupJoin(sock, personalityKey, chatId, participants, action) {
  if (action !== 'add' && action !== 'remove') return;
  const db = getDatabase();
  const settings = db.groupSettings?.[chatId];
  if (settings?.announcements === false) return;

  // For groups: only the active bot handles group announcements.
  // (Every bot receives the event, but only the active one actually
  // posts the message.)
  const activeKey = PersonalityManager.getActiveBot(chatId);
  if (activeKey && activeKey !== personalityKey) return; // not the active bot — stay silent

  for (const participant of participants) {
    const numStr  = participant.replace(/[^0-9]/g, '');
    const tag     = participant;
    const tagNum  = numStr;
    let text = '';
    const mentions = [participant];

    if (action === 'add') {
      if (numStr === CREATOR_ID) {
        text = pick(JOIN_NARUTO) + '\n\n@' + tagNum;
        try { await sock.sendMessage(chatId, { text, mentions }); } catch(e) { console.error('Greeting send error:', e.message); }
      } else if (numStr === COOWNER_ID) {
        text = pick(JOIN_COOWNER) + '\n\n@' + tagNum;
        try { await sock.sendMessage(chatId, { text, mentions }); } catch(e) { console.error('Greeting send error:', e.message); }
      } else {
        text = pick(JOIN_MSGS).replace('{tag}', tagNum);
        try { await sock.sendMessage(chatId, { text, mentions }); } catch(e) { console.error('Greeting send error:', e.message); }
      }
    } else {
      text = pick(LEAVE_MSGS).replace('{tag}', tagNum);
      try { await sock.sendMessage(chatId, { text, mentions }); } catch(e) { console.error('Leave msg send error:', e.message); }
    }
  }
}

// ── AstraLink API + Health check server ───────────────────────
const http = require('http');
const HEALTH_PORT = parseInt(process.env.PORT || '3000');

const UI_PATH = process.env.ASTRALINK_UI_PATH
  || path.join(__dirname, 'astralink.html');

http.createServer(async (req, res) => {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/astralink' || req.url === '/astralink.html')) {
    try {
      const html = fs.readFileSync(UI_PATH, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end(`AstraLink UI not found at ${UI_PATH}\n${e.message}\n`);
    }
  }

  // ── Health check ──────────────────────────────────────
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      botsConnected: Object.values(MultiSocketManager.getAllSockets() || {})
        .filter(s => s?.user?.id).length,
      uptime: process.uptime(),
    }));
  }

  // ── GET /api/bot-status ──────────────────────────────────────
  if (req.method === 'GET' && req.url === '/api/bot-status') {
    try {
      const allSockets = MultiSocketManager.getAllSockets();
      const linkedJids = Object.keys(PersonalityManager.linkedNumbers || {});
      const bots = [];
      const seen = new Set();
      for (const jid of linkedJids) {
        const key = PersonalityManager.linkedNumbers[jid];
        if (seen.has(key)) continue;  // dedupe double-registered numbers
        seen.add(key);
        const displayName = PersonalityManager.getDisplayName(key);
        const connected = !!allSockets[key] && !!allSockets[key].user?.id;
        const botJid = connected ? (allSockets[key].user?.id || null) : null;

        let activeNow = false;
        try { activeNow = PersonalityManager.anyActive(key); } catch (e) {}
        bots.push({
          key, displayName,
          emoji: PersonalityManager.getPersonalityInfo(key)?.emoji || '🤖',
          theme: PersonalityManager.getPersonalityInfo(key)?.theme || 'Unknown',
          jid: botJid || jid, connected, active: activeNow,
        });
      }

      const primaryConnected = !!_astralinkHostSock && !!_astralinkHostSock.user?.id;
      const primaryJid = primaryConnected ? _astralinkHostSock.user?.id : null;
      const primaryObj = {
        displayName: 'Primary Host',
        connected: primaryConnected,
        jid: primaryJid,
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ primary: primaryObj, bots, total: bots.length, serverTime: Date.now() }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  // ── GET /api/personalities ───────────────────────────────────
  if (req.method === 'GET' && req.url === '/api/personalities') {
    const personalities = PersonalityManager.getAllPersonalities()
      .map(k => PersonalityManager.getPersonalityInfo(k));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ personalities }));
  }

  // ── GET /api/qr?personality=XXX ─────────────────────────────
  // Returns the most recent QR code generated by Baileys as a scannable PNG data URI.
  if (req.method === 'GET' && req.url.startsWith('/api/qr')) {
    const u = new URL(req.url, 'http://localhost');
    const personality = (u.searchParams.get('personality') || '').toLowerCase();
    if (!personality) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Missing personality parameter' }));
    }

    if (!PersonalityManager.getAllPersonalities().includes(personality)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: `Unknown personality: ${personality}` }));
    }

    const { startAstraLink, getPairingSession, getLatestQr } = MultiSocketManager;

    let session = getPairingSession(personality);
    const existingSock = MultiSocketManager.getSocket(personality);

    // If no session exists or socket is not connected/ready, initiate QR connection
    if (!session || (!session.qr && !session.qrDataUrl && !existingSock?.user?.id)) {
      await startAstraLink(personality, AUTH_DIR, getDatabase, saveDatabase, {
        pairingMode: 'qr',
        forceRelink: true,
      });
    }

    // Wait up to 6 seconds for QR code generation
    for (let t = 0; t < 12; t++) {
      session = getPairingSession(personality);
      if (session && (session.qr || session.qrDataUrl)) break;
      await new Promise(r => setTimeout(r, 500));
    }

    const qrData = getLatestQr(personality);
    if (!qrData || (!qrData.qr && !qrData.dataUri)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Generating QR code... Please wait a moment and refresh.'
      }));
    }

    let dataUri = qrData.dataUri;
    if (!dataUri && qrData.qr) {
      try {
        const QRCode = require('qrcode');
        dataUri = await QRCode.toDataURL(qrData.qr, {
          width: 300,
          margin: 2,
          color: { dark: '#061018', light: '#ffffff' }
        });
      } catch (e) {
        console.error('QR dataUri generation error:', e.message);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      qr: qrData.qr,
      dataUri: dataUri || null
    }));
  }

  // ── POST /api/request-pairing-code ───────────────────────────
  // Body: { phoneNumber: "2348012345678", personality: "hinata" }
  if (req.method === 'POST' && req.url === '/api/request-pairing-code') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { phoneNumber, personality } = JSON.parse(body);

        if (!phoneNumber || !personality) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Missing phoneNumber or personality' }));
        }

        if (!PersonalityManager.getAllPersonalities().includes(personality)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: `Unknown personality: ${personality}` }));
        }

        // CRITICAL: a pairing code MUST be requested on the socket that will
        // actually pair for THIS personality (its pending socket). Using an
        // unrelated already-connected bot generates a code for the wrong
        // account, which is why WhatsApp said "Couldn't link device".
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (cleanNumber.length < 7 || cleanNumber.length > 15) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Invalid phone number length' }));
        }

        const { startAstraLink, getPairingSession } = MultiSocketManager;
        const started = await startAstraLink(personality, AUTH_DIR, getDatabase, saveDatabase, {
          pairingMode: 'code',
          pairingPhone: cleanNumber,
          forceRelink: true,
        });

        if (!started || !started.success) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: started?.error || 'Failed to start AstraLink for this personality.' }));
        }

        let session = null;
        for (let t = 0; t < 50; t++) {          // up to ~25s for the socket + code
          await new Promise(r => setTimeout(r, 500));
          const s = getPairingSession(personality);
          if (s && (s.status === 'code_ready' || s.status === 'connected')) { session = s; break; }
          if (s && s.status === 'error') {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: s.error || 'AstraLink pairing failed.' }));
          }
        }

        const code = session?.code;
        if (!code) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Timed out waiting for the pairing code. Click Link again.' }));
        }

        const formatted = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
        const pInfo = PersonalityManager.getPersonalityInfo(personality);
        console.log(`🔗 AstraLink pairing code issued: +${cleanNumber} → ${pInfo?.displayName || personality} | ${formatted}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, code: formatted, personality: pInfo }));

      } catch (err) {
        console.error('❌ AstraLink pairing code error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ── POST /api/link-success ────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/link-success') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { phoneNumber, personality } = JSON.parse(body);
        const pInfo = PersonalityManager.getPersonalityInfo(personality);

        const allSockets = MultiSocketManager.getAllSockets();
        const targetSock = allSockets[personality] || MultiSocketManager.getAnySocket();
        if (!targetSock) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Bot socket not ready' }));
        }

        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        const botSelfJid = targetSock.user?.id;

        if (botSelfJid) {
          const displayName = pInfo?.displayName || personality;
          const emoji = pInfo?.emoji || '🤖';
          const theme = pInfo?.theme || 'Unknown';

          const dmText =
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${emoji} *AstraLink — Connection Successful*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `✅ A new number has been linked to Astra!\n\n` +
            `📱 *Number:* +${cleanNumber}\n` +
            `🎭 *Personality:* ${displayName}\n` +
            `🎌 *Theme:* ${theme}\n\n` +
            `The bot is now active on this number as *${displayName}*.\n` +
            `Use */start ${personality}* in any group to activate this personality.\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

          await targetSock.sendMessage(botSelfJid, { text: dmText });
          console.log(`✅ AstraLink self-DM sent: +${cleanNumber} → ${displayName}`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));

      } catch (err) {
        console.error('❌ AstraLink link-success DM error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));

}).listen(HEALTH_PORT, () => {
  console.log(`🌐 AstraLink API server on port ${HEALTH_PORT}`);
});
// ─────────────────────────────────────────────────────────────

// ── Crash protection ───────────────────────────────────────────
let _unhandledCount = 0;
let _lastUnhandledLog = 0;

process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION — saving DB before crash:', err);
  try { saveDatabase(); } catch(e) { console.error('DB save on crash failed:', e); }
});

process.on('unhandledRejection', (reason, promise) => {
  _unhandledCount++;
  const now = Date.now();
  if (now - _lastUnhandledLog > 30_000) {
    console.error(`⚠️  [SILENT unhandledRejection] total in last window: ${_unhandledCount}`);
    console.error('   Reason:', reason);
    _lastUnhandledLog = now;
    _unhandledCount = 0;
  } else {
    _unhandledCount++;
  }
});

// Auto-save every 2 minutes
setInterval(saveDatabase, 2 * 60 * 1000);

// Daily quest reset — timezone-aware (BOT_TIMEZONE, default Africa/Lagos/WAT)
const { getWATDayKey, ensureDailyQuests } = require('./rpg/utils/DailyQuestSystem');
const TimeUtil = require('./rpg/utils/TimeUtil');
let _lastWATDayKey = getWATDayKey();

function _wipeAndReseedAllDailyQuests() {
  if (database.dailyQuests) {
    for (const uid of Object.keys(database.dailyQuests)) {
      const entry = database.dailyQuests[uid];
      if (!entry || entry.dayKey !== _lastWATDayKey) {
        delete database.dailyQuests[uid];
      }
    }
  }
  let reseeded = 0;
  for (const uid of Object.keys(database.users || {})) {
    const player = database.users[uid];
    if (!player) continue;
    if (!player.dailyQuests || player.dailyQuests.dayKey !== _lastWATDayKey) {
      const streak = player.dailyQuests?.streak || 0;
      const milestones = player.dailyQuests?.milestones || [];
      player.dailyQuests = { streak, milestones, dayKey: null, quests: [] };
      const refreshed = ensureDailyQuests(player);
      if (refreshed) reseeded++;
    }
  }
  return reseeded;
}

function _scheduleNextWATMidnight() {
  const utcMs = Date.now();
  const nextMidnightUTC = TimeUtil.nextMidnight(TimeUtil.DEFAULT_TZ, utcMs);
  const waitMs = nextMidnightUTC - utcMs;
  const safeWait = Math.max(60_000, Math.min(waitMs, 24 * 60 * 60 * 1000));
  console.log(`⏰ Next local-midnight refresh (${TimeUtil.DEFAULT_TZ}) in ${Math.round(safeWait/60000)} min (at ${new Date(nextMidnightUTC).toISOString().replace('T', ' ').slice(0, 16)} UTC)`);
  setTimeout(() => {
    _lastWATDayKey = getWATDayKey();
    const count = _wipeAndReseedAllDailyQuests();
    console.log(`🌅 WAT midnight! Re-seeded daily quests for ${count} players`);
    try {
      if (database.community?.main_groupId) {
        MultiSocketManager.getAnySocket()?.sendMessage(database.community.main_groupId, {
          text: '🌅 *DAILY QUEST REFRESH!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nNew 4 quests for today — /quest daily to see them!\n\n💡 Quests auto-complete as you play and rewards are granted instantly.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        }).catch(()=>{});
      }
    } catch(e) {}
    saveDatabase();
    _scheduleNextWATMidnight();
  }, safeWait);
}

setInterval(() => {
  const currentKey = getWATDayKey();
  if (currentKey !== _lastWATDayKey) {
    _lastWATDayKey = currentKey;
    const count = _wipeAndReseedAllDailyQuests();
    console.log(`🌅 WAT day-key changed → re-seeded daily quests for ${count} players`);
    saveDatabase();
  }
}, 60 * 1000);

// Out-of-battle passive HP regeneration (E:1, D:3, C:5, B:7, A:10, S:20 HP/sec)
setInterval(() => {
  if (!database?.users) return;
  const { applyPassiveRegen } = require('./rpg/utils/RegenManager');
  for (const uId in database.users) {
    applyPassiveRegen(database.users[uId], database);
  }
}, 5000);

setTimeout(() => {
  const count = _wipeAndReseedAllDailyQuests();
  if (count > 0) console.log(`📋 Initial daily quest re-seed on startup: ${count} players`);
  _scheduleNextWATMidnight();
}, 10_000);

// Bank interest — check every 6 hours, pay monthly
setInterval(() => {
  if (!database.banks) return;
  const BankingSystem = require('./rpg/banking/BankingSystem');
  let paid = 0;
  for (const bankId in database.banks) {
    const result = BankingSystem.collectMonthlyInterest(database, bankId);
    if (result.success && result.interest > 0) {
      const bank = database.banks[bankId];
      const owner = database.users[bank.owner];
      if (owner) {
        owner.gold = (owner.gold || 0) + result.interest;
        console.log(`🏦 Bank interest paid: ${result.interest}g to ${owner.name} (${bank.name})`);
        paid++;
      }
    }
  }
  if (paid > 0) saveDatabase();
}, 6 * 60 * 60 * 1000);

setTimeout(() => {
  if (!database.seasonStart) {
    database.seasonStart = Date.now();
    saveDatabase();
    console.log('📅 Season 1 started');
  }
}, 3000);

setInterval(() => {
  if (!database.afkUsers) return;
  const now = Date.now();
  const AFK_EXPIRE_MS = 8 * 60 * 60 * 1000;
  let expired = 0;
  for (const [userId, afk] of Object.entries(database.afkUsers)) {
    if (now - afk.since > AFK_EXPIRE_MS) {
      delete database.afkUsers[userId];
      expired++;
    }
  }
  if (expired > 0) {
    saveDatabase();
    console.log(`🧹 Auto-cleared ${expired} expired AFK status(es)`);
  }
}, 30 * 60 * 1000);

// ── Bot scheduler: every bot handles RPG commands + AI chat ─────────
function startBotScheduler(personalityKey) {
  // Each bot's connectBot call passes an `onGroupJoin` callback that
  // knows the bot's personalityKey, so the join handler can filter out
  // non-active bots (preventing multiple welcome messages).
  //
  // There is no "first" / "primary" bot. Every bot is equal. The
  // first to successfully connect becomes the "AstraLink host" —
  // purely for code organization (it provides the socket used by the
  // HTTP API to issue pairing codes for the loopback handler).
  const isFirstBot = !_astralinkHostKey;
  MultiSocketManager.connectBot(personalityKey, AUTH_DIR, getDatabase, saveDatabase, {
    rpgCommandHandler,
    onGroupJoin: async (sock, chatId, participants, action) => {
      // The bot's own personalityKey is already known to the handler
      // via the connectBot binding; we pass it through here.
      await onGroupJoin(sock, personalityKey, chatId, participants, action);
    },
  }).then(sock => {
    if (isFirstBot) {
      _astralinkHostKey = personalityKey;
      _astralinkHostSock = sock;
      console.log(`🌟 ${personalityKey} is the AstraLink host (first bot connected)`);
    }

    // Per-bot init: regen system (any bot that connects, runs it)
    try {
      RegenManager.initAllPlayers(getDatabase, saveDatabase, sock);
      const playerCount = Object.keys(database.users || {}).length;
      console.log(`🌟 Regen system ready (${personalityKey}, ${playerCount} players)`);
    } catch (error) {
      console.error('❌ Failed to initialize regeneration:', error.message);
    }

    // Per-bot init: start gate spawning for every group that has /set spawn --true.
    // Idempotent (one timer per chat). Uses the bot's own socket.
    try {
      const GateSpawner = require('./handlers/gateSpawner');
      const spawns = (database.gateSpawns || {});
      for (const [chatId, enabled] of Object.entries(spawns)) {
        if (enabled && chatId.endsWith('@g.us')) {
          GateSpawner.initialize(sock, chatId, getDatabase);
        }
      }
    } catch (e) {
      console.error('❌ GateSpawner bootstrap error:', e.message);
    }
  }).catch(err => {
    console.error(`❌ Failed to start bot [${personalityKey}]:`, err.message);
  });
}

// ========================================
// BOOT ALL CONFIGURED BOTS
// ========================================
async function startup() {
  const mongoOk = await connectMongo();
  if (mongoOk) {
    const loaded = await loadFromMongo();
    if (!loaded) {
      loadDatabase();
      await saveToMongo();
      console.log('📦 Migrated existing JSON data to MongoDB!');
    }
  } else {
    loadDatabase();
  }

  GateKeyManager.loadFromDB(getDatabase());
  console.log('🚪 GateKeyManager loaded');

  // Restore per-group active/present bot choices so a redeploy/restart does
  // NOT silently reset which bot each group is on (the "bots switched on
  // their own after redeploy" bug). Only /start or /switch changes a group's
  // active bot; those choices persist in the DB.
  try {
    PersonalityManager.bindPersistence(getDatabase, saveDatabase);
    PersonalityManager.loadPersisted();
    console.log('👑 Active/present bot mappings restored from DB');
  } catch (e) {
    console.error('⚠️ Could not restore personality mappings:', e.message);
  }

  setInterval(() => {
    try {
      GateKeyManager.checkExpiredKeys(null, getDatabase(), saveDatabase);
    } catch(e) {
      console.error('Gate key expiry check error:', e.message);
    }
  }, 30 * 60 * 1000);

  // ── Weekly guild-hire contract payouts ────────────────────────────────
  // Auto-deducts each active contract's weekly wage from the guild treasury
  // and pays the hired hunter once per elapsed week.
  setInterval(() => {
    try {
      const CM = require('./rpg/utils/GuildContractManager');
      const db = getDatabase();
      let any = false;
      for (const guildId of Object.keys(db.guilds || {})) {
        const res = CM.processWeeklyPay(db, guildId, null);
        if (res.length) any = true;
      }
      if (any) saveDatabase();
    } catch(e) {
      console.error('Guild contract payout error:', e.message);
    }
  }, 6 * 60 * 60 * 1000); // every 6h — idempotent, catches up elapsed weeks

  // ── Spawn ALL configured bots in parallel ─────────────────────
  // No "primary" or "secondary" — every bot is equal. We boot every bot that
  // is either (a) configured via a BOT_* env var OR (b) already linked through
  // AstraLink (has a saved auth session). This reconciles the two ways bots
  // get set up, so bots linked on the website still reconnect after a restart
  // and don't show as "dormant".
  const ALL_PERSONALITY_KEYS = PersonalityManager.getAllPersonalities();
  const linkedKeys = [];
  for (const key of PERSONALITY_KEYS) {
    if (process.env['BOT_' + key.toUpperCase()]) linkedKeys.push(key);
  }
  // Also include any personality with a saved AstraLink session (creds.json
  // that's registered). Link via AstraLink even without BOT_* env vars.
  for (const key of ALL_PERSONALITY_KEYS) {
    const authDir = path.join(AUTH_DIR, key);
    try {
      const creds = JSON.parse(fs.readFileSync(path.join(authDir, 'creds.json'), 'utf8'));
      if (creds && creds.registered && creds.me) {
        if (!linkedKeys.includes(key)) linkedKeys.push(key);
      }
    } catch (e) { /* no saved session for this personality */ }
  }

  if (linkedKeys.length === 0) {
    console.log('ℹ️  No bots configured/linked. Add BOT_HINATA= to .env or link via the AstraLink site.');
    return;
  }

  console.log(`🤖 Booting/linking ${linkedKeys.length} bot(s): ${linkedKeys.join(', ')}`);
  for (const key of linkedKeys) {
    startBotScheduler(key);
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log('✅ All bots startup initiated');

  // ── Init per-system schedulers that don't depend on any particular bot ─
  setInterval(() => {
    try {
      const db = getDatabase();
      GuildWar.resolveExpiredWars(db, saveDatabase);
    } catch(e) {}
  }, 10 * 60 * 1000);
  console.log('⚔️ Guild War system initialized');
}

startup();
