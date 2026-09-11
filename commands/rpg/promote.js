/**
 * /promote — Promote a user to group admin.
 * Group-admin tier: the user AND the bot must both be group admins.
 * (Replaces the old /gcpromote.)
 */

'use strict';

const GroupAdmin = require('../../rpg/utils/GroupAdmin');
const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'promote',
  description: '⭐ Promote a user to group admin',
  category: 'admin',
  usage: '/promote @user',
  availability: 'Group admins (bot must be admin)',
  where: 'Groups only',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const proP = UI.isPro(db.users[sender]);
    const gate = await GroupAdmin.requireGroupAdmin(sock, chatId, sender, db);
    if (!gate.ok) return sock.sendMessage(chatId, { text: gate.err }, { quoted: msg });

    const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (!target) return sock.sendMessage(chatId, { text: '❌ Tag a user: /promote @user' }, { quoted: msg });

    // Cannot promote the bot itself, or protect admins
    if (GroupAdmin.bare(target) === GroupAdmin.bare(gate.botJid)) {
      return sock.sendMessage(chatId, { text: '❌ Cannot promote the bot.' }, { quoted: msg });
    }

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
        const u = db.users?.[f];
        if (u?.name) return { label: `*${u.name}*`, mention: null };
      }
      const b = GroupAdmin.bare(jid);
      const hit = Object.entries(db.users || {}).find(([id, u]) => u?.name && GroupAdmin.bare(id) === b);
      if (hit) return { label: `*${hit[1].name}*`, mention: null };
      return { label: `@${b}`, mention: jid };
    };
    const tDisp = displayFor(target);
    const sDisp = displayFor(sender);
    const mentions = [tDisp.mention, sDisp.mention].filter(Boolean);

    try {
      await sock.groupParticipantsUpdate(chatId, [target], 'promote');
      return sock.sendMessage(chatId, {
        text: [
          (proP ? UI.PRO_BAR : UI.FREE_BAR),
          '⭐ *PROMOTED*',
          `✅ ${tDisp.label} is now a group admin!`,
          proP ? (UI.PRO_MINI + '\n⭐ PRO GAVEL') : null,
          proP ? `👮 Promoted by ${sDisp.label}` : null,
          (proP ? UI.PRO_BAR : UI.FREE_BAR),
        ].filter(x => x !== null).join('\n'),
        mentions,
      }, { quoted: msg });
    } catch (e) {
      return sock.sendMessage(chatId, { text: '❌ Failed to promote: ' + e.message }, { quoted: msg });
    }
  },
};
