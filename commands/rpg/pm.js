module.exports = {
  name: 'pm',
  description: 'Self-promote to group admin (requires bot to be admin)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: '❌ Group command only.' }, { quoted: msg });

    const db = getDatabase();
    const Mod = require('../../rpg/utils/ModerationUtils');
    if (!Mod.canModerate(db, sender)) return sock.sendMessage(chatId, { text: '❌ Bot admin only.' }, { quoted: msg });

    try {
      const meta = await sock.groupMetadata(chatId);
      const botPhone = (sock.user?.id || '').split(':')[0].split('@')[0];
      const BOT_IDS = meta.participants.filter(p => p.id.split(':')[0].split('@')[0] === botPhone).map(p => p.id);
      const botParticipant = meta.participants.find(p => BOT_IDS.includes(p.id));
      if (!botParticipant || !['admin','superadmin'].includes(botParticipant.admin)) {
        return sock.sendMessage(chatId, { text: "❌ I need to be a group admin first to promote you." }, { quoted: msg });
      }
      await sock.groupParticipantsUpdate(chatId, [sender], 'promote');
      return sock.sendMessage(chatId, { text: '✅ Done. You\'re now a group admin.' }, { quoted: msg });
    } catch(e) {
      return sock.sendMessage(chatId, { text: '❌ Failed: ' + e.message }, { quoted: msg });
    }
  }
};
