// ═══════════════════════════════════════════════════════════════
// HELP COMMAND - Compact command list & detailed command guides
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const KNOWN_SUBCOMMANDS = {
  reset: ['@user', 'restore', 'cooldown'],
  spawnstatus: ['dm', 'gc'],
  bank: ['create', 'register', 'deposit', 'withdraw', 'info', 'accounts', 'list', 'collect'],
  guild: ['create', 'join', 'leave', 'info', 'members', 'deposit', 'withdraw', 'hire', 'accept', 'decline', 'disband', 'war', 'vault'],
  guildwar: ['challenge', 'accept', 'status', 'list'],
  gw: ['challenge', 'accept', 'status', 'list'],
  gate: ['info', 'buy', 'apply', 'accept', 'start', 'leave', 'raid', 'cancel'],
  gates: ['info', 'buy', 'apply', 'accept', 'start', 'leave', 'raid', 'cancel'],
  gateraid: ['apply', 'accept', 'start', 'status', 'leave'],
  raid: ['apply', 'accept', 'start', 'status', 'leave'],
  gr: ['apply', 'accept', 'start', 'status', 'leave'],
  setgroup: ['show', 'link', 'reset', 'support', 'pvp', 'dungeon', 'casino', 'guild', 'mods'],
  setgc: ['show', 'link', 'reset', 'support', 'pvp', 'dungeon', 'casino', 'guild', 'mods'],
  casino: ['slots', 'blackjack', 'roulette', 'dice', 'coinflip'],
  market: ['list', 'buy', 'cancel', 'search', 'mylistings'],
  trade: ['offer', 'accept', 'decline', 'cancel', 'status'],
  shop: ['potions', 'gear', 'weapons', 'armor', 'buy'],
  craft: ['list', 'recipe', 'craft'],
  forge: ['list', 'recipe', 'craft'],
  pet: ['info', 'feed', 'train', 'play', 'level', 'equip', 'unequip', 'list'],
  caught: ['info', 'feed', 'train', 'play', 'level', 'equip', 'unequip', 'list'],
  catchpet: ['info', 'feed', 'train', 'play', 'level', 'equip', 'unequip', 'list'],
  inventory: ['weapons', 'armor', 'potions', 'artifacts', 'accessories', 'materials', 'keystones'],
  inv: ['weapons', 'armor', 'potions', 'artifacts', 'accessories', 'materials', 'keystones'],
  set: ['antilink', 'slowmode', 'allowed', 'spawn'],
  gcset: ['antilink', 'slowmode', 'allowed', 'spawn'],
  botpersonality: ['start', 'switch', 'hi', 'setainame', 'bots', 'stopbot'],
  bots: ['start', 'switch', 'hi', 'setainame', 'bots', 'stopbot'],
  switch: ['personality_name'],
  daily: ['claim', 'info', 'list'],
  quest: ['info', 'claim', 'list'],
  pvp: ['challenge', 'accept', 'decline', 'stats', 'leaderboard'],
  cctv: ['status', 'report', 'list'],
  allowgc: ['pvp', 'dungeon', 'support', 'casino', 'guild', 'mods'],
  ssub: ['list', 'add', 'remove'],
  awaken: ['check', 'ascend', 'prestige'],
  ascend: ['check', 'ascend', 'prestige'],
  prestige: ['check', 'ascend', 'prestige'],
  attacks: ['list', 'set', 'info'],
  attack: ['list', 'set', 'info'],
  ap: ['list', 'set', 'info'],
  class: ['change', 'info', 'list'],
  myclass: ['change', 'info', 'list'],
  cls: ['change', 'info', 'list'],
  aura: ['info', 'equip', 'unequip'],
  auras: ['info', 'equip', 'unequip'],
  constellation: ['info', 'activate'],
  worldboss: ['status', 'attack', 'info'],
  wb: ['status', 'attack', 'info'],
  dungeon: ['enter', 'info', 'status'],
  artifact: ['list', 'equip', 'unequip', 'info'],
  killspawn: ['clear'],
  quote: ['text_or_reply'],
  q: ['text_or_reply'],
  steal: ['pack | author', 'reply_sticker'],
  s: ['pack | author', 'reply_sticker'],
  sticker: ['pack | author', 'reply_image'],
  party: ['status', 'ready', 'raid', 'join', 'leave', 'kick'],
  friend: ['add', 'remove', 'list'],
  setserf: ['@bot'],
  approveserf: ['accept', 'decline'],
  restart: ['[bot_name]'],
  profile: ['view', 'bio'],
  p: ['view', 'bio'],
  me: ['view', 'bio'],
  stats: ['view', 'allocate'],
};

let commandMapCache = null;

function getAllCommands() {
  if (commandMapCache) return commandMapCache;
  const map = new Map();
  const dirs = [
    path.join(__dirname, '..', '..', 'commands'),
    path.join(__dirname, '..', '..', 'commands', 'rpg')
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith('.js')) continue;
      try {
        const mod = require(path.join(dir, file));
        if (!mod || typeof mod !== 'object') continue;
        if (mod.name && typeof mod.execute === 'function') {
          map.set(mod.name.toLowerCase(), mod);
          if (Array.isArray(mod.aliases)) {
            mod.aliases.forEach(a => map.set(a.toLowerCase(), mod));
          }
        } else {
          for (const sub of Object.values(mod)) {
            if (sub && sub.name && typeof sub.execute === 'function') {
              map.set(sub.name.toLowerCase(), sub);
              if (Array.isArray(sub.aliases)) {
                sub.aliases.forEach(a => map.set(a.toLowerCase(), sub));
              }
            }
          }
        }
      } catch (e) {}
    }
  }
  commandMapCache = map;
  return map;
}

module.exports = {
  name: 'help',
  aliases: ['h', 'menu', 'commands'],
  description: 'Display help and command list',
  usage: '/help [command]',
  category: 'system',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    // 🔹 /help <command> or /h <command>
    if (args[0]) {
      const cmdName = args[0].toLowerCase();
      const allCommands = getAllCommands();
      const command = allCommands.get(cmdName);

      if (!command) {
        return sock.sendMessage(
          chatId,
          { text: `❌ Unknown command: *${cmdName}*\nUse /help to see all commands.` },
          { quoted: msg }
        );
      }

      const aliases = Array.isArray(command.aliases) && command.aliases.length
        ? command.aliases.map(a => '/' + a).join(', ')
        : 'none';

      const rawSub = command.subcommands || command.subCommands || KNOWN_SUBCOMMANDS[cmdName] || KNOWN_SUBCOMMANDS[command.name];
      const subcommands = Array.isArray(rawSub) && rawSub.length
        ? rawSub.join(', ')
        : null;

      const detailMessage = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📘 *COMMAND DETAILS*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `🔹 *Name:* /${command.name}`,
        `📝 *Description:* ${command.description || 'No description available'}`,
        `📌 *Usage:* ${command.usage || `/${command.name}`}`,
        `🔁 *Aliases:* ${aliases}`,
        `📂 *Category:* ${command.category || 'general'}`,
        subcommands ? `⚡ *Subcommands:* ${subcommands}` : ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].filter(l => l !== '').join('\n');

      return sock.sendMessage(chatId, { text: detailMessage }, { quoted: msg });
    }

    // 🔹 Main Help Page (Categorized list of all main commands)
    const message = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📋 *✦ 𝐀𝐬𝐭𝐫𝐚™ COMMAND MENU*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 *BASIC & PLAYER:*`,
      `  /register, /profile (/p, /me), /stats, /inventory (/inv), /balance (/bal), /daily, /quest, /cooldowns, /achievements`,
      ``,
      `⚔️ *COMBAT & DUNGEONS:*`,
      `  /dungeon, /raid (/gateraid, /gr), /gate (/gates), /pvp, /duel, /worldboss (/wb), /leaderboard (/top), /coop, /party`,
      ``,
      `🔧 *PROGRESSION & GEAR:*`,
      `  /class, /awaken, /attacks, /summon, /craft, /forge, /enchant, /upgrade, /pet, /artifact, /aura, /constellation, /skin, /title`,
      ``,
      `🏰 *GUILD & ECONOMY:*`,
      `  /guild, /guildwar (/gw), /market, /trade, /shop, /bank, /casino`,
      ``,
      `🌍 *SOCIAL & UTILITY:*`,
      `  /steal (/s), /sticker, /quote (/q), /rob, /imagine, /lyrics, /ytmp3, /afk, /friend, /suggest, /bug`,
      ``,
      `👑 *ADMIN & MODERATION:*`,
      `  /kick, /promote, /demote, /mute, /unmute, /ban, /unban, /tagall, /killspawn, /reset, /spawnstatus, /restart`,
      ``,
      `🤖 *SYSTEM & CONFIG:*`,
      `  /setgroup, /allowgc, /setserf, /approveserf, /renew, /ssub, /bots, /start, /switch, /restart`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💡 Type */help <command>* (or */h <cmd>*) for subcommands & details!`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');

    try {
      const bannerPath = path.join(__dirname, '..', '..', 'assets', 'help_banner.jpg');
      if (fs.existsSync(bannerPath)) {
        await sock.sendMessage(chatId, { image: fs.readFileSync(bannerPath), caption: message }, { quoted: msg });
      } else {
        await sock.sendMessage(chatId, { text: message }, { quoted: msg });
      }
    } catch (e) {
      await sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }
  }
};
