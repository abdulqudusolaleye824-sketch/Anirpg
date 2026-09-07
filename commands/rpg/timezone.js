/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║           Astra — /timezone                             ║
 * ╚══════════════════════════════════════════════════════════╝
 * Lets a player set their own timezone so daily quests and
 * weekly challenges reset at THEIR local midnight (e.g. players in
 * the US, India, Europe — not just Nigeria). No external API needed.
 *
 *   /timezone              → show your current zone
 *   /timezone <IANA zone>  → set it, e.g. /timezone America/New_York
 *   /timezone list         → show common zones
 */

'use strict';

const { isValidTz, DEFAULT_TZ, dayKey } = require('../../rpg/utils/TimeUtil');

const COMMON = [
  ['Africa/Lagos', 'Nigeria (WAT, UTC+1)'],
  ['Africa/Accra', 'Ghana (UTC+0)'],
  ['Europe/London', 'UK (UTC+0/+1)'],
  ['Europe/Paris', 'France (UTC+1/+2)'],
  ['America/New_York', 'USA East (UTC-5/-4)'],
  ['America/Chicago', 'USA Central (UTC-6/-5)'],
  ['America/Los_Angeles', 'USA West (UTC-8/-7)'],
  ['Asia/Calcutta', 'India (UTC+5:30)'],
  ['Asia/Tokyo', 'Japan (UTC+9)'],
  ['Asia/Dubai', 'UAE (UTC+4)'],
  ['Australia/Sydney', 'Australia East (UTC+10/+11)'],
  ['Europe/Berlin', 'Germany (UTC+1/+2)'],
  ['America/Sao_Paulo', 'Brazil (UTC-3)'],
];

module.exports = {
  name: 'timezone',
  aliases: ['tz', 'time'],
  description: 'Set your timezone so daily/weekly resets match your local time',
  usage: '/timezone <IANA zone>  — e.g. /timezone America/New_York',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    const cur = isValidTz(player?.timezone) || DEFAULT_TZ;

    if (args.length === 0) {
      return sock.sendMessage(chatId, {
        text: `🕐 Your timezone: *${cur}*\n\n⏰ Daily quests *(${dayKey(cur)})* and weekly challenges reset at midnight in YOUR timezone, so the bot is accurate for players worldwide.\n\nTo change it: /timezone <zone>\n\nExamples:\n/timezone America/New_York\n/timezone Asia/Tokyo\n/timezone list`,
      }, { quoted: msg });
    }

    const arg = args[0].toLowerCase();

    if (arg === 'list') {
      const list = COMMON.map(([z, n]) => `• ${z}  — ${n}`).join('\n');
      return sock.sendMessage(chatId, {
        text: `🗺️ *Common timezones:*\n${list}\n\n(Any IANA zone works, e.g. /timezone Asia/Kolkata)`,
      }, { quoted: msg });
    }

    // Normalize a few friendly names → IANA.
    const aliases = {
      'lagos': 'Africa/Lagos', 'nigeria': 'Africa/Lagos', 'wat': 'Africa/Lagos',
      'uk': 'Europe/London', 'london': 'Europe/London', 'england': 'Europe/London',
      'india': 'Asia/Calcutta', 'mumbai': 'Asia/Calcutta', 'delhi': 'Asia/Calcutta',
      'usa': 'America/New_York', 'new york': 'America/New_York',
      'japan': 'Asia/Tokyo', 'dubai': 'Asia/Dubai', 'uae': 'Asia/Dubai',
      'germany': 'Europe/Berlin', 'paris': 'Europe/Paris', 'france': 'Europe/Paris',
      'brazil': 'America/Sao_Paulo', 'australia': 'Australia/Sydney', 'ghana': 'Africa/Accra',
    };
    const zone = isValidTz(arg) ? arg
               : isValidTz(aliases[arg]) ? aliases[arg]
               : null;

    if (!zone) {
      return sock.sendMessage(chatId, {
        text: `❌ Unknown or invalid timezone: *${arg}*\n\nUse a valid IANA name like *America/New_York* or *Asia/Tokyo*.\nSee /timezone list for common ones.`,
      }, { quoted: msg });
    }

    if (!player) {
      return sock.sendMessage(chatId, {
        text: '❌ You are not registered yet. Use /start to create your account first.',
      }, { quoted: msg });
    }

    player.timezone = zone;
    saveDatabase();
    return sock.sendMessage(chatId, {
      text: `✅ Timezone set to *${zone}*.\n\nYour daily quests and weekly challenges now reset at midnight your time.\nToday (your zone): ${dayKey(zone)}`,
    }, { quoted: msg });
  },
};
