module.exports = {
  name: 'gcpromote',
  description: 'Promote a user to group admin',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: '❌ Group command only.' }, { quoted: msg });

    const PROTECTED = ['221951679328499@lid','194592469209292@lid'];

    try {
      const meta = await sock.groupMetadata(chatId);
      const senderPart = meta.participants.find(p => p.id === sender || p.id.includes(sender.split('@')[0]));
      if (!senderPart || !['admin','superadmin'].includes(senderPart.admin)) {
        return sock.sendMessage(chatId, { text: '❌ Group admins only.' }, { quoted: msg });
      }

      const botPhone = (sock.user?.id || '').split(':')[0].split('@')[0];
      const BOT_IDS = meta.participants.filter(p => p.id.split(':')[0].split('@')[0] === botPhone).map(p => p.id);
      const botPart = meta.participants.find(p => BOT_IDS.includes(p.id));
      if (!botPart || !['admin','superadmin'].includes(botPart.admin)) {
        return sock.sendMessage(chatId, { text: '❌ I need to be a group admin to promote others.' }, { quoted: msg });
      }

      const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                  || msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!target) return sock.sendMessage(chatId, { text: '❌ Tag a user: /gcpromote @user' }, { quoted: msg });
      if (PROTECTED.some(p => target.includes(p.split('@')[0])) || BOT_IDS.includes(target)) {
        return sock.sendMessage(chatId, { text: '❌ Cannot promote that user.' }, { quoted: msg });
      }

      await sock.groupParticipantsUpdate(chatId, [target], 'promote');
      return sock.sendMessage(chatId, { text: '✅ Promoted to group admin!' }, { quoted: msg });
    } catch(e) {
      return sock.sendMessage(chatId, { text: '❌ Failed: ' + e.message }, { quoted: msg });
    }
  }
};
