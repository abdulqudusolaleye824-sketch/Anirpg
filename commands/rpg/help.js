// ═══════════════════════════════════════════════════════════════
// HELP COMMAND - Compact command list & detailed command guides
// ═══════════════════════════════════════════════════════════════

module.exports = {
  name: 'help',
  aliases: ['h'],
  description: 'Display help and command list',
  usage: '/help [command]',
  category: 'system',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    // 🔹 /help <command>
    if (args[0]) {
      const cmdName = args[0].toLowerCase();

      const commandFiles = Object.values(require.cache)
        .map(m => m.exports)
        .filter(
          c =>
            c &&
            typeof c === 'object' &&
            c.execute &&
            typeof c.execute === 'function' &&
            c.name
        );

      const command = commandFiles.find(
        c => c.name === cmdName || (Array.isArray(c.aliases) && c.aliases.includes(cmdName))
      );

      if (!command) {
        return sock.sendMessage(
          chatId,
          { text: `❌ Unknown command: *${cmdName}*\nUse /help to see all commands.` },
          { quoted: msg }
        );
      }

      const aliases = Array.isArray(command.aliases) && command.aliases.length
        ? command.aliases.map(a => '/' + a).join(', ')
        : null;

      const detailMessage = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📘 *COMMAND DETAILS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔹 *Name:* /${command.name}
📝 *Description:* ${command.description || 'No description available'}
📌 *Usage:* ${command.usage || `/${command.name}`}
${aliases ? `🔁 *Aliases:* ${aliases}\n` : ''}📂 *Category:* ${command.category || 'general'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();

      return sock.sendMessage(chatId, { text: detailMessage }, { quoted: msg });
    }

    // Main help page
    const message = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *SYSTEM COMMANDS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎮 *BASIC*
/register, /stats, /me, /top, /ranking, /profile, /inventory, /skills, /help, /sticker, /daily, /quest

⚔️ *DUNGEONS & RAIDS*
/dungeon, /gateraid, /worldboss

🥊 *PVP & COMBAT*
/pvp, /duel, /leaderboard

🔧 *PROGRESSION & CLASS*
/upgrade, /awaken, /challenges, /summon, /use, /class, /skillchoice

🏰 *GUILD & GUILD WAR*
/guild, /guildwar

🏪 *ECONOMY & MARKET*
/market, /send, /trade, /history, /steal, /rob, /bank, /casino

🌍 *SOCIAL & EVENT*
/event, /afk, /cooldowns, /community, /support

👑 *GROUP ADMIN*
/kick, /promote, /demote, /delete, /open, /close

🔧 *MODERATION & ADMIN*
/mute, /unmute, /ban, /unban, /admin, /broadcast

🤖 *BOT & SYSTEM*
/bots, /start, /switch, /hi, /stopbot, /setgroup, /allowgc, /renew, /ssub, /addpc, /pc

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *For detailed explanations & usage on any command, type:*
`/help <command>` (e.g. `/help pvp`, `/help guild`, `/help dungeon`)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();

    try {
      const fs = require('fs');
      const path = require('path');
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
