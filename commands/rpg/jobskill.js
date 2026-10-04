// Push #96h-z19: /jobskill — the three skills of your ACTIVE job (support · strike · signature).
//   /jobskill            → card (tiers, effects now, next-tier preview, lore)
//   /jobskill <1-3|name> → use it (routes to PvP / dungeon / gate raid exactly like /skill)
const UI = require('../../rpg/utils/UI');
module.exports = {
  name: 'jobskill',
  aliases: ['js', 'jskill', 'jobskills'],
  description: '🧭 Your job\'s three skills — view or use them',
  usage: '/jobskill [1-3|name]',
  category: 'progression',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase(); const player = db.users?.[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ You are not registered. Use /register first.' }, { quoted: msg });
    const JSk = require('../../rpg/utils/JobSkills');
    if (!args.length) return sock.sendMessage(chatId, { text: UI.card(player, { icon: '🧭', title: 'JOB SKILLS', lines: JSk.card(player), tip: '/jobskill <1-3|name> to use one · /job for the ladder' }) }, { quoted: msg });
    const q = /^[1-3]$/.test(args[0]) ? `j${args[0]}` : args.join(' ');
    const r = JSk.resolve(player, q);
    if (!r) return sock.sendMessage(chatId, { text: `❌ No job skill matches *${args.join(' ')}*. /jobskill lists yours.` }, { quoted: msg });
    if (!r.ok) return sock.sendMessage(chatId, { text: r.error }, { quoted: msg });
    return require('./skill').execute(sock, msg, [r.entry.name, ...args.slice(/^[1-3]$/.test(args[0]) ? 1 : args.length)], getDatabase, saveDatabase, sender);
  },
};
