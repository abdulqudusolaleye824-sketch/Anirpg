const UI = require('../../rpg/utils/UI');
const GroupAdmin = require('../../rpg/utils/GroupAdmin');

module.exports = {
  name: 'gcdemote',
  description: 'Demote a user from group admin',
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
        return sock.sendMessage(chatId, { text: '❌ I need to be a group admin to demote others.' }, { quoted: msg });
      }

      const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                  || msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!target) return sock.sendMessage(chatId, { text: '❌ Tag a user: /gcdemote @user' }, { quoted: msg });
      if (PROTECTED.some(p => target.includes(p.split('@')[0])) || BOT_IDS.includes(target)) {
        return sock.sendMessage(chatId, { text: '❌ Cannot demote that user.' }, { quoted: msg });
      }

      const _db = getDatabase();
      // Display names first (registered RPG names, LID/PN-agnostic); raw @tags
      // only for unregistered users — and ALWAYS with a real mentions array so
      // the tag actually renders instead of showing a bare LID number.
      const displayFor = (jid) => {
      const forms = [
        jid,
        String(jid).replace(/@lid$/, '@s.whatsapp.net'),
        String(jid).replace(/@s.whatsapp.net$/, '@lid'),
      ];
      for (const f of forms) {
        const u = _db.users?.[f];
        if (u?.name) return { label: `*${u.name}*`, mention: null };
      }
      const b = GroupAdmin.bare(jid);
      const hit = Object.entries(_db.users || {}).find(([id, u]) => u?.name && GroupAdmin.bare(id) === b);
      if (hit) return { label: `*${hit[1].name}*`, mention: null };
      return { label: `@${b}`, mention: jid };
    };
      const tDisp = displayFor(target);
      const sDisp = displayFor(sender);
      const mentions = [tDisp.mention, sDisp.mention].filter(Boolean);
      await sock.groupParticipantsUpdate(chatId, [target], 'demote');
      const _pro = UI.isPro(_db.users[sender]);
      return sock.sendMessage(chatId, {
        text: [
          (_pro ? UI.PRO_BAR : UI.FREE_BAR),
          '⬇️ *DEMOTED*',
          `✅ ${tDisp.label} is no longer a group admin.`,
          _pro ? (UI.PRO_MINI + '\n⬇️ PRO GAVEL') : null,
          _pro ? `👮 Demoted by ${sDisp.label}` : null,
          (_pro ? UI.PRO_BAR : UI.FREE_BAR),
        ].filter(x => x !== null).join('\n'),
        mentions,
      }, { quoted: msg });
    } catch(e) {
      return sock.sendMessage(chatId, { text: '❌ Failed: ' + e.message }, { quoted: msg });
    }
  }
};
