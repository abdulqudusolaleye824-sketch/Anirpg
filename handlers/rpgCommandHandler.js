const fs = require('fs');
const path = require('path');
const PlayerMigration = require('../rpg/utils/PlayerMigration');
const AutoRedirect = require('../rpg/utils/AutoRedirect');
const { OWNER_JID, stripDevice } = require('../utils/constants');
const Mod = require('../rpg/utils/ModerationUtils');

const BotPersonality = require('../commands/rpg/botpersonality');
const personalityCmds = {
  start:      BotPersonality.start,
  switch:     BotPersonality.switchBot,
  hi:         BotPersonality.hi,
  setainame:  BotPersonality.setainame,
  bots:       BotPersonality.bots,
  stopbot:    BotPersonality.stopbot,
};

const Utility = require('../commands/rpg/utility');
const utilityCmds = {
  imagine:    Utility.imagine,
  yt:         Utility.yt,
  tt:         Utility.tt,
  tiktok:     Utility.tt,
  pinterest:  Utility.pinterest,
  math:       Utility.math,
  search:     Utility.search,
};

const CCTVManager = require('../bots/CCTVManager');
const { awardCommandXP } = require('../rpg/utils/SilentXP');
const cctvCmds = {
  cctv:         CCTVManager.cctv,
  statusreport: CCTVManager.statusreport,
};

const CHUNK_SIZE = 3500;

async function sendChunked(sock, chatId, text, options = {}) {
  const cleanOptions = { ...options };
  delete cleanOptions.text;

  if (!text || text.length <= CHUNK_SIZE) {
    try {
      return await sock.sendMessage(chatId, { text, ...cleanOptions });
    } catch (e) {
      delete cleanOptions.quoted;
      return await sock.sendMessage(chatId, { text, ...cleanOptions });
    }
  }

  const parts = [];
  let remaining = text;
  while (remaining.length > CHUNK_SIZE) {
    let splitAt = remaining.lastIndexOf('\n\n', CHUNK_SIZE);
    if (splitAt < CHUNK_SIZE * 0.5) splitAt = remaining.lastIndexOf('\n', CHUNK_SIZE);
    if (splitAt <= 0) splitAt = CHUNK_SIZE;
    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining.length) parts.push(remaining);

  for (let i = 0; i < parts.length; i++) {
    const isFirst = i === 0;
    try {
      await sock.sendMessage(chatId, {
        ...cleanOptions,
        text: parts[i] + (parts.length > 1 ? `\n_(${i+1}/${parts.length})_` : ''),
        ...(isFirst ? options.quoted ? { quoted: options.quoted } : {} : {})
      });
    } catch (e) {
      delete cleanOptions.quoted;
      await sock.sendMessage(chatId, {
        ...cleanOptions,
        text: parts[i] + (parts.length > 1 ? `\n_(${i+1}/${parts.length})_` : ''),
      });
    }
    if (i < parts.length - 1) await new Promise(r => setTimeout(r, 600));
  }
}

const commands = {};

const rpgPath = path.join(__dirname, '..', 'commands', 'rpg');
fs.readdirSync(rpgPath).forEach(file => {
  if (!file.endsWith('.js') || file.includes('backup') || file.includes('original') || file.endsWith('.bak')) return;
  const commandName = file.replace('.js', '');
  try {
    const mod = require(path.join(rpgPath, file));
    if (!mod || typeof mod !== 'object') {
      console.log(`⏭️ Skipped non-command module: ${commandName}`);
      return;
    }
    if (mod.name && typeof mod.execute === 'function') {
      commands[commandName] = mod;
      if (mod.name.toLowerCase() !== commandName) {
        commands[mod.name.toLowerCase()] = mod;
      }
      console.log(`✅ Loaded RPG command: ${commandName}${mod.name.toLowerCase() !== commandName ? ` (as ${mod.name})` : ''}`);
      return;
    }
    const values = Object.values(mod).filter(v => v && typeof v === 'object');
    const allAreCommands = values.length > 0 && values.every(
      v => v.name && typeof v.execute === 'function'
    );
    if (allAreCommands) {
      let count = 0;
      for (const sub of values) {
        const subName = sub.name.toLowerCase();
        commands[subName] = sub;
        count++;
      }
      console.log(`✅ Loaded RPG command bundle: ${commandName} (${count} commands: ${values.map(v => v.name).join(', ')})`);
      return;
    }
    console.log(`⏭️ Skipped non-command module: ${commandName}`);
  } catch (error) {
    console.error(`❌ Failed to load RPG command ${commandName}:`, error.message);
  }
});

const adminPath = path.join(__dirname, '..', 'commands');
fs.readdirSync(adminPath).forEach(file => {
  const filePath = path.join(adminPath, file);
  if (fs.statSync(filePath).isDirectory()) return;
  if (file.endsWith('.js')) {
    const commandName = file.replace('.js', '');
    try {
      commands[commandName] = require(filePath);
      console.log(`✅ Loaded admin command: ${commandName}`);
    } catch (error) {
      console.error(`❌ Failed to load admin command ${commandName}:`, error.message);
    }
  }
});

console.log(`🎮 Total commands loaded: ${Object.keys(commands).length}`);

const GateCmds = require('../commands/rpg/gates');
const GateRaidCmd = require('../commands/rpg/gateraid');
const CaughtCmd = require('../commands/rpg/caught');
const gateCmds = {
  gate:          GateCmds.gate,
  gates:         GateCmds.gate,
  affiliate:     GateCmds.affiliate,
  setdungeon:    GateCmds.setdungeon,
  removedungeon: GateCmds.removedungeon,
  dungeons:      GateCmds.dungeons,
  gateraid:      GateRaidCmd,
  raid:          GateRaidCmd,
  gr:            GateRaidCmd,
  caught:        CaughtCmd,
  capturepet:    CaughtCmd,
  catchpet:      CaughtCmd,
};

const SetCmd = require('../commands/rpg/set');
const settingsCmds = {
  set:      SetCmd,
  settings: SetCmd,
  gcset:    SetCmd,
};
const CraftCmd   = require('../commands/rpg/craft');
const AwakenCmd  = require('../commands/rpg/awaken');
const AttacksCmd = require('../commands/rpg/attacks');
const ClassCmd   = require('../commands/rpg/class');
const progressCmds = {
  craft:    CraftCmd,
  forge:    CraftCmd,
  awaken:   AwakenCmd,
  ascend:   AwakenCmd,
  prestige: AwakenCmd,
  attacks:  AttacksCmd,
  attack:   AttacksCmd,
  ap:       AttacksCmd,
  patterns: AttacksCmd,
  class:    ClassCmd,
  myclass:  ClassCmd,
  cls:      ClassCmd,
};

Object.assign(commands, personalityCmds, utilityCmds, cctvCmds, gateCmds, progressCmds, settingsCmds);

const setserf    = require('../commands/rpg/setserf');
const approveserf = require('../commands/rpg/approveserf');
commands.setserf     = setserf;
commands.approveserf = approveserf;
commands.serf        = setserf;
commands.approve     = approveserf;

console.log(`🤖 Personality commands registered: ${Object.keys(personalityCmds).join(', ')}`);
console.log(`🛠️  Utility commands registered: ${Object.keys(utilityCmds).join(', ')}`);
console.log(`📹 CCTV commands registered: ${Object.keys(cctvCmds).join(', ')}`);
console.log(`🚪 Gate commands registered: ${Object.keys(gateCmds).join(', ')}`);
console.log(`⚒️  Progress commands registered: ${Object.keys(progressCmds).join(', ')}`);
console.log(`⚙️  Settings commands registered: ${Object.keys(settingsCmds).join(', ')}`);
console.log(`⚓ Serf commands registered: /setserf, /approveserf`);

const ALIASES = {
  'p':           'profile',
  'q':           'quote',
  'stat':        'stats',
  'artifacts':   'artifact',
  'inv':         'inventory',
  'h':           'help',
  'remove':      'kick',
  'del':         'delete',
  'pc':          'procoin',
  'addpc':       'procoin',
  'addprocoin':  'procoin',
  'wallet':      'balance',
  'bal':         'balance',
  'wb':          'worldboss',
  'spawn':       'artifactspawn',
  'groupstatus': 'spawnstatus',
  'gstatus':     'spawnstatus',
  'read':        'scroll',
  'scrolls':     'scroll',
};

const NO_ADMIN_REQUIRED = new Set([
  'register','profile','stats','inventory','inv','help','achievements',
  'daily','find','gear','friend','leaderboard','pm','botid'
]);

for (const [cmdName, cmd] of Object.entries(commands)) {
  if (!cmd || typeof cmd !== 'object') continue;
  if (Array.isArray(cmd.aliases)) {
    cmd.aliases.forEach(alias => {
      if (!ALIASES[alias]) ALIASES[alias] = cmdName;
    });
  }
}

function cleanJid(jid) {
  if (!jid) return '';
  const str = String(jid).trim();
  const domain = str.endsWith('@g.us') ? '@g.us' : str.endsWith('@lid') ? '@lid' : '@s.whatsapp.net';
  const bare = str.split('@')[0].split(':')[0];
  return bare ? `${bare}${domain}` : str;
}

module.exports = async (sock, msg, messageText, config, getDatabase, saveDatabase) => {
  const chatId = cleanJid(msg.key.remoteJid);

  const OfflineBackupManager = require('../rpg/utils/OfflineBackupManager');
  if (OfflineBackupManager.isLockdown()) {
    return sock.sendMessage(
      chatId,
      {
        text: OfflineBackupManager.getLockdownMessage()
      },
      { quoted: msg }
    );
  }

  const args = messageText.slice(config.prefix.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();

  const isGroup = msg.key.remoteJid?.endsWith('@g.us');

  const contextInfo =
    msg.message?.extendedTextMessage?.contextInfo ||
    msg.message?.imageMessage?.contextInfo ||
    msg.message?.videoMessage?.contextInfo ||
    msg.message?.documentMessage?.contextInfo ||
    msg.message?.stickerMessage?.contextInfo ||
    msg.message?.buttonsResponseMessage?.contextInfo ||
    msg.message?.listResponseMessage?.contextInfo;

  const rawSender = isGroup
    ? (msg.key.participant || msg.participant || contextInfo?.participant || msg.key.remoteJid)
    : msg.key.remoteJid;

  const sender = cleanJid(rawSender);

  const isValidSender = isGroup
    ? !!sender
    : (sender?.endsWith('@s.whatsapp.net') || sender?.endsWith('@lid'));

  if (!isValidSender) {
    console.log(`⚠️ Invalid sender format: ${sender} in chat ${chatId}`);
    return;
  }

  if (!commandName) {
    return sock.sendMessage(
      chatId,
      {
        text: `📜 *ASTRA RPG COMMAND MENU*\n\nType */help* to see all commands!\nType */start <botname>* to activate a bot personality!\nType */profile* to view your stats.`
      },
      { quoted: msg }
    );
  }

  const resolvedCommand = ALIASES[commandName] || commandName;
  console.log(`[COMMAND] ${resolvedCommand}${resolvedCommand !== commandName ? ` (alias: ${commandName})` : ''} | Sender: ${sender} | Chat: ${chatId}`);

  const db = getDatabase();

  // ── Referral safety net: settle any pending Lv.3 payout for the sender ──
  // (Battle sites celebrate it loudly; this silent settle guarantees the
  // 10k Nexus can never be missed no matter where the level-up happened.)
  try {
    const _r = require('../rpg/utils/ReferralSystem').onLevelUp(db, db.users?.[sender]);
    if (_r) { try { saveDatabase(); } catch (e) {} }
  } catch (e) {}

  // ── Monthly referral contest: finalize on month rollover + announce ──
  try {
    const Ref = require('../rpg/utils/ReferralSystem');
    const fin = Ref.finalizeIfNewMonth(db);
    if (fin) {
      try { saveDatabase(); } catch (e) {}
      if (fin.winner) {
        const ann = [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `👑 *MONTHLY TOP RECRUITER — ${fin.closedMonth}*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `🎉 Congratulations *${fin.winner.name}* — *${fin.count}* successful referrals!`,
          ``,
          `🎫 Reward: *Weekly Pro Card* (added to your cards — use /prostore use weekly when ready)`,
          ``,
          `🔗 New race is on! Share your code: /code`,
          `📊 Standings: /lb referrals`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n');
        try {
          const MSM = require('../bots/MultiSocketManager');
          const all = MSM.getAllSockets ? MSM.getAllSockets() : {};
          const firstKey = Object.keys(all).find(k => all[k]?.user?.id);
          const bsock = (firstKey && all[firstKey]) || sock;
          const gcs = Object.keys(db.registeredGCs || {});
          for (const gc of gcs.slice(0, 20)) {
            try { await bsock.sendMessage(gc, { text: ann }); } catch (e) {}
          }
          if (!gcs.includes(chatId)) { try { await sock.sendMessage(chatId, { text: ann }); } catch (e) {} }
        } catch (e) {}
      }
    }
  } catch (e) {}

  const Perms = require('../utils/permissions');
  const isPrivilegedUser = Perms.isBotOwner(db, sender) || Perms.isBotMod(db, sender);

  // /start is MODS + OWNERS ONLY (group admins and Pro users included in the block).
  if ((commandName === 'start' || resolvedCommand === 'start') && !isPrivilegedUser) {
    return sock.sendMessage(chatId, { text: '\u274C Only bot mods and the owner can use /start.' }, { quoted: msg });
  }

  // ── DM Command Access Control (Only Owner / Co-Owner / Mods allowed in DM, ONLY for Mod commands) ──
  const MOD_DM_COMMANDS = new Set([
    'killspawn', 'spawnstatus', 'spawnsstatus', 'gstatus', 'groupstatus',
    'cctv', 'statusreport', 'botid', 'disable', 'enable', 'restart',
    'maintenance', 'banned', 'ban', 'unban', 'mute', 'unmute',
    'setgroup', 'setgc', 'ssub', 'renew', 'allowgc', 'groupinfo',
    'setdungeon', 'removedungeon', 'dungeons', 'set', 'settings', 'gcset',
    'help', 'menu', 'reset', 'start', 'switch', 'stop', 'stopbot',
    'bots', 'hi', 'setainame', 'promotedm', 'demotedm', 'profaq', 'botstats', 'clearactivebots',
    'announce', 'globalannounce', 'broadcast', 'tagall'
  ]);

  const isDM = !chatId.endsWith('@g.us');
  if (isDM) {
    if (!isPrivilegedUser) {
      return sock.sendMessage(
        chatId,
        {
          text: `🚫 *COMMANDS DISABLED IN DM*\n\nBot commands can only be used in authorized group chats.\nJoin an official RPG group to play!`
        },
        { quoted: msg }
      );
    }

    if (!MOD_DM_COMMANDS.has(commandName) && !MOD_DM_COMMANDS.has(resolvedCommand)) {
      return sock.sendMessage(
        chatId,
        {
          text: `🚫 *PLAYER COMMANDS DISABLED IN DM*\n\nRegular RPG commands (/profile, /daily, /pass, /dungeon, /casino, etc.) can only be used in group chats!\n\n_DM is reserved exclusively for Mod commands (/killspawn, /groupstatus, etc.)._`
        },
        { quoted: msg }
      );
    }
  }
  const { applyPassiveRegen } = require('../rpg/utils/RegenManager');
  if (db?.users?.[sender]) {
    const player = db.users?.[sender];
    applyPassiveRegen(player, db);

    const isPro = !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());

    if (isPro) {
      if (player.customEmoji) {
        try {
          sock.sendMessage(chatId, { react: { text: player.customEmoji, key: msg.key } }).catch(() => {});
        } catch (_) {}
      }

      // Random 25% chance for 🌟 star reaction (triggers 100% /aurafarm for the next 5s!)
      // — but NEVER while the aura-farm cooldown is still running (a star you
      // can't use is just noise).
      const _farmOnCd = (Date.now() - (player.cooldowns?.auraFarm || 0)) < (5 * 60 * 60 * 1000);
      if (!_farmOnCd && Math.random() < 0.25) {
        player.auraFarmBoostUntil = Date.now() + 5000;
        try {
          sock.sendMessage(chatId, { react: { text: '🌟', key: msg.key } }).catch(() => {});
          setTimeout(() => {
            sock.sendMessage(chatId, { react: { text: '', key: msg.key } }).catch(() => {});
          }, 2000);
        } catch (_) {}
      }
    }
  }
  const OWNER_ID = OWNER_JID;
  const isOwner = sender === OWNER_ID;

  if (!db.antiLinkStrikes) db.antiLinkStrikes = {};

  if (!db.groupSettings) db.groupSettings = {};
  if (!db.groupSettings[chatId]) {
    db.groupSettings[chatId] = {
      antiLink: false,
      slowmode: 0
    };
    saveDatabase();
  }

  if (!db.afkUsers) db.afkUsers = {};

  if (db.bannedUsers?.[Mod.bare(sender)]) {
    const rec = db.bannedUsers[Mod.bare(sender)] || db.bannedUsers[sender];
    const _youName = db.users?.[sender]?.name || ('@' + Mod.bare(sender));
    const _bannerName = rec.bannedBy ? (db.users?.[rec.bannedBy]?.name || ('@' + Mod.bare(rec.bannedBy))) : 'Unknown';
    const bannedBy = rec.bannedBy ? (_bannerName + ' (@' + Mod.bare(rec.bannedBy) + ')') : 'Unknown';
    const gmt = rec.bannedAtGMT || (rec.bannedAt ? new Date(rec.bannedAt).toUTCString() : 'Unknown');
    const gcName = rec.gcName || rec.gc || 'Unknown';
    return sock.sendMessage(
      chatId,
      {
        text:
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🚫 *YOU ARE BANNED*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 You: ${_youName} (@${Mod.bare(sender)})\n` +
          `📝 Reason: ${rec.reason || 'No reason provided'}\n` +
          `👮 Banned by: ${bannedBy}\n` +
          `📍 GC: ${gcName}\n` +
          `🕒 Time (GMT): ${gmt}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `_Contact a mod to appeal._`,
        mentions: [sender].concat(rec.bannedBy ? [rec.bannedBy] : [])
      },
      { quoted: msg }
    );
  }

  if (db.mutedUsers && db.mutedUsers[Mod.bare(sender)]) {
    const muteData = db.mutedUsers[Mod.bare(sender)];
    if (muteData.endsAt && Date.now() > muteData.endsAt) {
      delete db.mutedUsers[Mod.bare(sender)];
      saveDatabase();
    } else {
      return;
    }
  }

  if (chatId.endsWith('@g.us')) {
    const settings = db.groupSettings?.[chatId];

    let antiLinkOn = !!settings?.antiLink;
    if (!antiLinkOn) {
      try {
        const AG = require('../rpg/utils/AstralGroups');
        const entry = AG.getEntry(db, chatId);
        if (entry && entry.isMain) antiLinkOn = true;
      } catch (e) { /* ignore */ }
    }

    if (antiLinkOn && !isPrivilegedUser) {
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        '';

      const anyLinkRegex = /(https?:\/\/|www\.)/i;
      const allowedDomains = (settings?.allowed && settings.allowed.length)
        ? settings.allowed
        : ['instagram.com', 'pinterest.', 'pinterest.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'chat.whatsapp.com', 'wa.me'];
      const whitelistRegex = new RegExp('(' + allowedDomains.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'i');

      if (anyLinkRegex.test(text) && !whitelistRegex.test(text)) {
        try {
          await sock.sendMessage(chatId, { delete: msg.key });

          if (!db.antiLinkStrikes[sender]) {
            db.antiLinkStrikes[sender] = { count: 0 };
          }

          db.antiLinkStrikes[sender].count++;
          const strikes = db.antiLinkStrikes[sender].count;
          saveDatabase();

          if (strikes === 1) {
            await sock.sendMessage(chatId, {
              text:
                `⚠️ *@${sender.split('@')[0]} WARNING*\n` +
                `Links are not allowed here. Please send it to my DM instead.\n\n` +
                `⛔ Next: *Mute (5 mins)*`,
              mentions: [sender]
            }, { quoted: msg });
          } else if (strikes === 2) {
            if (!db.mutedUsers) db.mutedUsers = {};
            db.mutedUsers[sender] = { endsAt: Date.now() + 5 * 60 * 1000 };
            saveDatabase();
            await sock.sendMessage(chatId, {
              text: `🔇 *@${sender.split('@')[0]} muted for 5 minutes*\nReason: Repeated links`,
              mentions: [sender]
            });
          } else if (strikes >= 3) {
            await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
            delete db.antiLinkStrikes[sender];
            saveDatabase();
            await sock.sendMessage(chatId, {
              text: `🪓 *@${sender.split('@')[0]} kicked*\nReason: Repeated link spam`,
              mentions: [sender]
            });
          }
          console.log(`🔗 AntiLink strike ${strikes} → ${sender}`);
          return;
        } catch (err) {
          console.error('❌ AntiLink failed:', err);
        }
      }
    }
  }

  if (chatId.endsWith('@g.us')) {
    const settings = db.groupSettings?.[chatId];

    if (settings?.slowmode && !isPrivilegedUser) {
      if (!db.userCooldowns) db.userCooldowns = {};

      const key = `${chatId}_${sender}`;
      const now = Date.now();
      const last = db.userCooldowns[key] || 0;

      const player = db.users?.[sender];
      const isPro = player && (player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > now;
      const slowmodeMs = isPro ? Math.floor((settings.slowmode * 1000) * 0.5) : (settings.slowmode * 1000);

      if (now - last < slowmodeMs) {
        const remaining = Math.ceil((slowmodeMs - (now - last)) / 1000);
        return sock.sendMessage(chatId, {
          text: `⏳ Slowmode active.\nWait ${remaining}s between commands. Baka${isPro ? ' (🌟 PRO 50% Reduced Cooldown)' : ''}`
        }, { quoted: msg });
      }

      db.userCooldowns[key] = now;
      saveDatabase();
    }
  }

  if (chatId.endsWith('@g.us') && db.userCooldowns && Math.random() < 0.01) {
    const now = Date.now();
    let pruned = 0;
    for (const k of Object.keys(db.userCooldowns)) {
      if (now - (db.userCooldowns[k] || 0) > 60 * 60 * 1000) {
        delete db.userCooldowns[k];
        pruned++;
      }
    }
    if (pruned > 0) console.log(`🧹 Pruned ${pruned} stale userCooldown entries`);
  }

  if (!db.system) db.system = {};
  if (typeof db.system.maintenance !== 'boolean') {
    db.system.maintenance = false;
    saveDatabase();
  }
  if (
    db.system.maintenance &&
    !isPrivilegedUser &&
    commandName !== 'maintenance' &&
    commandName !== 'help'
  ) {
    return sock.sendMessage(
      chatId,
      {
        text:
          '🔧 *MAINTENANCE MODE: ON*\n\n' +
          '🚧 Non-mod commands will be silently ignored.\n' +
          'Mods/owners can still use all commands.',
      },
      { quoted: msg }
    );
  }

  if (db.users?.[sender]) {
    try {
      if (db.users?.[sender]) db.users[sender] = PlayerMigration.migratePlayer(db.users[sender]);
      saveDatabase();
    } catch (error) {
      console.error('⚠️ Migration error:', error);
    }
  }

  if (!db.disabledCommands) db.disabledCommands = [];

  if (commandName === 'disable' && isPrivilegedUser) {
    const target = args[0]?.toLowerCase();
    if (!target) {
      return sock.sendMessage(chatId, { text: '❌ Usage: /disable <command>' }, { quoted: msg });
    }

    if (!commands[target]) {
      return sock.sendMessage(chatId, { text: `❌ Command ${target} does not exist!` }, { quoted: msg });
    }

    if (db.disabledCommands.find(c => c.name === target)) {
      return sock.sendMessage(chatId, { text: `❌ Command ${target} is already disabled.` }, { quoted: msg });
    }

    db.disabledCommands.push({
      name: target,
      by: sender,
      timestamp: Date.now(),
    });
    saveDatabase();

    return sock.sendMessage(
      chatId,
      {
        text: `✅ Command *${target}* disabled by @${sender.split('@')[0]}`,
        mentions: [sender],
      },
      { quoted: msg }
    );
  }

  if (commandName === 'enable' && isPrivilegedUser) {
    const target = args[0]?.toLowerCase();
    if (!target) {
      return sock.sendMessage(chatId, { text: '❌ Usage: /enable <command>' }, { quoted: msg });
    }

    const index = db.disabledCommands.findIndex(c => c.name === target);
    if (index === -1) {
      return sock.sendMessage(chatId, { text: `❌ Command ${target} is not disabled.` }, { quoted: msg });
    }

    db.disabledCommands.splice(index, 1);
    saveDatabase();

    return sock.sendMessage(
      chatId,
      {
        text: `✅ Command *${target}* enabled by @${sender.split('@')[0]}`,
        mentions: [sender],
      },
      { quoted: msg }
    );
  }

  const disabled = db.disabledCommands.find(c => c.name === commandName);
  if (disabled) {
    return sock.sendMessage(
      chatId,
      {
        text: `❌ Command *${commandName}* is disabled.\n(by @${disabled.by.split('@')[0]})`,
        mentions: [disabled.by],
      },
      { quoted: msg }
    );
  }

  const PersonalityManager = require('../bots/PersonalityManager');
  let activeKey = chatId.endsWith('@g.us') ? PersonalityManager.getActiveBot(chatId) : null;

  if (chatId.endsWith('@g.us') && activeKey) {
    try {
      const MSM = require('../bots/MultiSocketManager');
      const activeSock = MSM.getSocket(activeKey);
      const isOnline = !!(activeSock?.user?.id);
      if (!isOnline) {
        const failoverKey = MSM.getFirstOnlineSocketKey();
        if (failoverKey) {
          PersonalityManager.activateBot(chatId, failoverKey);
          activeKey = failoverKey;
          console.log(`🔄 Failover active bot in ${chatId} to online bot: ${failoverKey}`);
        }
      }
    } catch (e) {}
  }

  const BOOTSTRAP_COMMANDS = new Set([
    'start', 'switch', 'stop', 'stopbot', 'bots', 'hi', 'setainame',
    'setgroup', 'setgc', 'ssub', 'renew', 'allowgc', 'groupinfo', 'groupstatus',
    'setdungeon', 'removedungeon', 'dungeons', 'set', 'settings', 'gcset',
    'help', 'menu', 'reset', 'spawnstatus', 'spawnsstatus', 'killspawn',
    'cctv', 'statusreport', 'botid', 'disable', 'enable', 'restart', 'clearactivebots'
  ]);

  if (chatId.endsWith('@g.us') && !activeKey && !BOOTSTRAP_COMMANDS.has(commandName) && !BOOTSTRAP_COMMANDS.has(resolvedCommand)) {
    return sock.sendMessage(
      chatId,
      {
        text: `💤 *NO BOT ACTIVE IN THIS GROUP*\n\nBot commands require an active bot in this group chat.\nUse */start <botname>* to activate a bot personality!\n\n📋 Type */bots* to see available personalities.`
      },
      { quoted: msg }
    );
  }

  const AstralGroups = require('../rpg/utils/AstralGroups');
  const manageCmds = new Set([
    'start', 'switch', 'stopbot', 'bots', 'hi', 'setainame',
    'setgroup', 'setgc', 'ssub', 'renew', 'allowgc', 'groupinfo', 'groupstatus',
    'setdungeon', 'removedungeon', 'dungeons', 'set', 'settings', 'gcset',
    'help', 'menu', 'reset', 'spawnstatus', 'spawnsstatus', 'killspawn',
    'cctv', 'statusreport', 'botid', 'disable', 'enable', 'restart'
  ]);
  if (chatId.endsWith('@g.us') && !manageCmds.has(commandName) && !manageCmds.has(resolvedCommand)) {
    const gate = AstralGroups.gate(db, chatId);
    if (!gate.allow) {
      if (gate.silent) return;
      if (gate.expired) {
        return sock.sendMessage(chatId, { text: gate.msg }, { quoted: msg });
      }
    }
  }

  const adminOnlyCommands = ['disable', 'enable', 'maintenance', 'groupinfo'];
  
  if (!adminOnlyCommands.includes(commandName) && !isDM) {
    const redirectCheck = AutoRedirect.checkCommand(chatId, commandName, db);
    
    if (!redirectCheck.allowed && redirectCheck.redirect) {
      const message = AutoRedirect.getRedirectMessage(redirectCheck);
      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }
  }

  if (db.users?.[sender]) {
    try {
      const PetManager = require('../rpg/utils/PetManager');
      const petData = PetManager.getPlayerData(sender);
      if (petData?.activePet && petData.pets?.length) {
        const now = Date.now();
        const minutesPassed = (now - (petData.lastHungerCheck || now)) / (1000 * 60);
        if (minutesPassed >= 1) {
          const activePet = petData.pets.find(p => p.instanceId === petData.activePet);
          if (activePet) {
            activePet.hunger = Math.min(100, (activePet.hunger || 0) + Math.floor(minutesPassed * 1));
            if (activePet.hunger > 70) {
              activePet.happiness = Math.max(0, (activePet.happiness || 100) - 1);
            }
            petData.lastHungerCheck = now;
            PetManager.save();
          }
        }
      }
    } catch (petErr) {}
  }

  if (chatId.endsWith('@g.us') && db.community) {
    const COMMAND_GROUP_MAP = {
      pvp:       'pvp',
      casino:    'casino',
      dungeon:   'dungeon',
      worldboss: 'dungeon',
      wb:        'dungeon',
      coop:      'dungeon',
      gate:      'dungeon',
      market:    'trading',
      trade:     'trading',
      send:      'trading',
      bank:      'trading',
      casino_r:  'trading',
    };

    const GROUP_DISPLAY = {
      pvp:     { emoji: '⚔️',  name: 'AlinRPG PvP',    desc: 'Challenge players, check ELO, and battle!' },
      casino:  { emoji: '🎰',  name: 'AlinRPG Casino',  desc: 'Slots, blackjack, roulette & more!' },
      dungeon: { emoji: '🏰',  name: 'AlinRPG Dungeon', desc: 'Gate runs, world boss raids & co-op!' },
      trading: { emoji: '💰',  name: 'AlinRPG Market',  desc: 'Trade, market listings & bank!' },
    };

    const requiredType = COMMAND_GROUP_MAP[resolvedCommand] || COMMAND_GROUP_MAP[commandName];

    if (requiredType) {
      const groupLink = db.community[requiredType];
      const designatedGroupId = db.community[`${requiredType}_groupId`];

      if (groupLink && designatedGroupId && chatId !== designatedGroupId) {
        const info = GROUP_DISPLAY[requiredType];

        await sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${info.emoji} *WRONG GROUP!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n@${sender.split('@')[0]}, */${commandName}* is only available in the *${info.name}* group!\n\n🔗 Join here → sent to your DM!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [sender]
        }, { quoted: msg });

        try {
          await sock.sendMessage(sender, {
            text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${info.emoji} *${info.name}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${info.desc}\n\n🔗 *Join here:*\n${groupLink}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nYou tried to use */${commandName}* in the wrong group.\nUse it there and it'll work! 🎮`
          });
        } catch(e) {
          await sock.sendMessage(chatId, {
            text: `🔗 ${info.name}: ${groupLink}`,
            mentions: [sender]
          });
        }

        return;
      }
    }
  }

  if (commands[resolvedCommand] && typeof commands[resolvedCommand].execute === 'function') {
    if (db.users?.[sender]) {
      db.users[sender].lastActive = Date.now();
    }

    if (chatId.endsWith('@g.us')) {
      const senderName = db.users?.[sender]?.name || sender.split('@')[0];
      CCTVManager.recordCommand(chatId, sender, senderName, resolvedCommand, db);
    }

    const { sendMulti } = require('../utils/multiMessage');
    const chunkedSock = new Proxy(sock, {
      get(target, prop) {
        if (prop === 'sendMessage') {
          return async (jid, content, opts) => {
            if (!content || typeof content !== 'object') {
              return target.sendMessage(jid, content, opts);
            }
            if (Array.isArray(content.sections)) {
              return sendMulti(target, jid, content, {
                quoted: opts?.quoted,
                ...content,
              });
            }
            const MEDIA_KEYS = ['image','video','audio','sticker','document','ptt'];
            const hasMedia = MEDIA_KEYS.some(k => content[k] !== undefined);
            if (!hasMedia && content.text && content.text.length > CHUNK_SIZE) {
              return sendChunked(target, jid, content.text, opts);
            }
            try {
              return await target.sendMessage(jid, content, opts);
            } catch (err) {
              const cleanOpts = { ...opts };
              delete cleanOpts.quoted;
              return await target.sendMessage(jid, content, cleanOpts);
            }
          };
        }
        return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
      }
    });
    try {
      if (db.users?.[sender]) {
        try {
          const { ensureTodayQuests } = require('../rpg/utils/QuestDispatcher');
          ensureTodayQuests(db.users[sender]);
          saveDatabase();
        } catch(e) {}
      }

      await commands[resolvedCommand].execute(
        chunkedSock,
        msg,
        args,
        getDatabase,
        saveDatabase,
        sender
      );

      const _db = getDatabase();
      if (_db.users?.[sender]) {
        const player = _db.users[sender];
        awardCommandXP(player, saveDatabase, chunkedSock, chatId);

        try {
          const { checkSnapshotAchievements } = require('../rpg/utils/ActivityTracker');
          // NOTE: daily-quest progress is tracked at the point of ACTUAL completion
          // inside each command (kill on kill, pvp on win, craft on craft, ...).
          // The old generic per-command map counted mere command INVOCATIONS
          // (e.g. /pvp status counted as a duel win, /attacks shop as pattern
          // use) and double-counted alongside in-command dispatches — removed.
          await checkSnapshotAchievements(player, chunkedSock, sender, chatId);
          saveDatabase();
        } catch(e) {}
      }

    } catch (error) {
      console.error(`❌ Error executing ${resolvedCommand}:`, error);

      // Hardened: if the error card itself can't send (e.g. WhatsApp
      // rate-overlimit), swallow it instead of rejecting unhandled (which
      // surfaces to the user as total command silence).
      try {
        await sock.sendMessage(
          chatId,
          {
            text:
              '❌ An error occurred while executing the command.\n\n' +
              `Command: ${resolvedCommand}\n` +
              `Error: ${error.message}`,
          },
          { quoted: msg }
        );
      } catch (sendErr) {
        console.error(`❌ Error-card send failed for ${resolvedCommand}:`, sendErr.message);
      }
    }
  } else {
    const allCmds = Object.keys(commands);
    let bestMatch = null;
    let bestScore = 0;
    if (commandName && commandName.length > 1) {
      for (const cmd of allCmds) {
        let score = 0;
        const a = commandName.toLowerCase();
        const b = cmd.toLowerCase();
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
          if (a[i] === b[i]) score += 2; else break;
        }
        for (const ch of a) if (b.includes(ch)) score++;
        score -= Math.abs(a.length - b.length);
        if (score > bestScore) { bestScore = score; bestMatch = cmd; }
      }
    }
    const suggestion = bestMatch && bestScore > 2
      ? `\n\n🤔 Did you mean *${config.prefix}${bestMatch}*?`
      : `\n\nUse *${config.prefix}help* to see all commands.`;
    await sock.sendMessage(
      chatId,
      {
        text: `❌ No such command: *${config.prefix}${commandName}*${suggestion}`,
      },
      { quoted: msg }
    );
  }
};
