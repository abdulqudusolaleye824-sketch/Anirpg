// ═══════════════════════════════════════════════════════════════
// /pm (/promoteme alias) — Promote caller to group admin (bot must be admin)
// ═══════════════════════════════════════════════════════════════

'use strict';

const GroupAdmin = require('../../rpg/utils/GroupAdmin');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'pm',
  aliases: ['promoteme', 'selfpromote'],
  description: 'Promote yourself to group admin (requires bot to be admin)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ Group command only.' }, { quoted: msg });
    }

    const db = getDatabase();

    // Bot Owners & Bot Staff / Mods are authorized to use /pm
    const isOwner = Perms.isBotOwner(db, sender);
    const isMod = Perms.isBotMod(db, sender);

    if (!isOwner && !isMod) {
      return sock.sendMessage(chatId, { text: '❌ Bot owners & bot mods only.' }, { quoted: msg });
    }

    try {
      const meta = await sock.groupMetadata(chatId);
      const botJid = sock.user?.id || '';
      const botLid = sock.user?.lid || '';
      const botBare = GroupAdmin.bare(botJid);
      const lidBare = GroupAdmin.bare(botLid);

      // Find bot participant matching JID, LID, or phone digits
      const botPart = meta.participants.find(p => {
        const pBare = GroupAdmin.bare(p.id);
        return p.id === botJid || p.id === botLid || (botBare && pBare === botBare) || (lidBare && pBare === lidBare);
      });

      const isBotAdmin = GroupAdmin.isAdminState(botPart) || meta.participants.some(p => GroupAdmin.isAdminState(p) && (GroupAdmin.bare(p.id) === botBare || (lidBare && GroupAdmin.bare(p.id) === lidBare)));

      if (!isBotAdmin) {
        return sock.sendMessage(chatId, { text: "❌ I need to be a group admin first to promote you." }, { quoted: msg });
      }

      await sock.groupParticipantsUpdate(chatId, [sender], 'promote');
      return sock.sendMessage(chatId, { text: '✅ Done! You are now a group admin.' }, { quoted: msg });
    } catch (e) {
      return sock.sendMessage(chatId, { text: '❌ Failed to promote: ' + e.message }, { quoted: msg });
    }
  }
};
