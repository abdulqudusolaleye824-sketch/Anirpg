// ═══════════════════════════════════════════════════════════════
// HELP COMMAND - Compact command list & detailed command guides
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const KNOWN_SUBCOMMANDS = {
  bank: ['create', 'register', 'deposit', 'withdraw', 'info', 'accounts', 'list', 'collect'],
  guild: ['create', 'join', 'leave', 'info', 'members', 'deposit', 'withdraw', 'promote', 'demote', 'kick', 'war', 'vault', 'invite'],
  gate: ['info', 'buy', 'apply', 'accept', 'start', 'leave', 'raid', 'cancel'],
  gates: ['info', 'buy', 'apply', 'accept', 'start', 'leave', 'raid', 'cancel'],
  setgroup: ['show', 'link', 'reset', 'support', 'pvp', 'dungeon', 'casino', 'guild'],
  setgc: ['show', 'link', 'reset', 'support', 'pvp', 'dungeon', 'casino', 'guild'],
  casino: ['slots', 'blackjack', 'roulette', 'dice', 'coinflip'],
  market: ['list', 'buy', 'cancel', 'search', 'mylistings'],
  craft: ['list', 'recipe', 'craft'],
  forge: ['list', 'recipe', 'craft'],
  pet: ['info', 'feed', 'train', 'play', 'level', 'equip', 'unequip', 'list'],
  caught: ['info', 'feed', 'train', 'play', 'level', 'equip', 'unequip', 'list'],
  catchpet: ['info', 'feed', 'train', 'play', 'level', 'equip', 'unequip', 'list'],
  inventory: ['weapons', 'armor', 'potions', 'artifacts', 'accessories', 'materials', 'keystones'],
  inv: ['weapons', 'armor', 'potions', 'artifacts', 'accessories', 'materials', 'keystones'],
  set: ['antilink', 'slowmode', 'allowed'],
  gcset: ['antilink', 'slowmode', 'allowed'],
  botpersonality: ['start', 'switch', 'hi', 'setainame', 'bots', 'stopbot'],
  bots: ['start', 'switch', 'hi', 'setainame', 'bots', 'stopbot'],
  daily: ['claim', 'info', 'list'],
  quest: ['info', 'claim', 'list'],
  pvp: ['challenge', 'accept', 'decline', 'stats', 'leaderboard'],
  cctv: ['status', 'report', 'list'],
  allowgc: ['pvp', 'dungeon'],
  ssub: ['subscriber_name'],
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
  gateraid: ['apply', 'accept', 'start'],
  raid: ['apply', 'accept', 'start'],
  gr: ['apply', 'accept', 'start'],
  artifact: ['list', 'equip', 'unequip', 'info'],
  killspawn: ['clear'],
  quote: ['text_or_reply'],
  q: ['text_or_reply'],
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

    // 🔹 Compact Main Help Page
    const message = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📋 *✦ 𝐀𝐬𝐭𝐫𝐚™ COMMAND MENU*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Basic:* /register, /profile, /stats, /me, /inv, /daily, /quest`,
      `⚔️ *Combat:* /pvp, /duel, /dungeon, /raid, /wb, /leaderboard`,
      `🔧 *Class:* /class, /awaken, /craft, /attacks, /summon`,
      `🏰 *Guild:* /guild, /guildwar, /market, /trade, /bank, /casino`,
      `🌍 *Social:* /rob, /steal, /quote, /imagine, /yt, /event, /afk`,
      `👑 *Admin:* /kick, /promote, /demote, /mute, /ban, /tagall, /killspawn`,
      `🤖 *System:* /setgroup, /allowgc, /renew, /ssub, /bots, /start`,
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
