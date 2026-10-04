// Push #96h-z19: /sackstatus <serial> — a guild member's sack standing (Guild Master / Vice GM).
module.exports = {
  name: 'sackstatus',
  aliases: ['sackinfo'],
  description: '🪓 [GM/Vice] Sack status of a guild member by serial',
  usage: '/sackstatus <#>',
  category: 'guild',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase(); const player = db.users?.[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ You are not registered. Use /register first.' }, { quoted: msg });
    const CM = require('../../rpg/utils/GuildContractManager'); const GSk = require('../../rpg/utils/GuildSack');
    const guild = CM.resolvePlayerGuild(db, sender, player);
    if (!guild) return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });
    const rank = guild.members?.find(m => (typeof m === 'object' ? m.id : m) === sender)?.rank || (guild.leader === sender ? 'Leader' : 'Member');
    if (!(guild.leader === sender || /leader|guild master|vice/i.test(String(rank)))) return sock.sendMessage(chatId, { text: '❌ Only the Guild Master or Vice GM can check sack status.' }, { quoted: msg });
    if (!args[0]) return sock.sendMessage(chatId, { text: GSk.list(db, guild) + '\n\nUsage: */sackstatus <#>* (serial from */guild members*)' }, { quoted: msg });
    const r = GSk.statusOf(db, guild, args[0]);
    return sock.sendMessage(chatId, { text: r.ok ? r.text : r.error }, { quoted: msg });
  },
};
