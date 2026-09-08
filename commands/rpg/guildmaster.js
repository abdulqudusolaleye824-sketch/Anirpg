// ═══════════════════════════════════════════════════════════════
// GUILDMASTER — Admin command to manage authorized guild masters
// Only the bot owner / super admins can use this.
// NOTE: there is NO cap on the number of authorized guild masters
// (the old 5-master limit that throttled guild creation is removed).
//
// /guildmaster authorize @user — give someone guild creation rights
// /guildmaster revoke @user   — take away guild creation rights
// /guildmaster list           — see all authorized guild masters
// ═══════════════════════════════════════════════════════════════

const Perms = require('../../utils/permissions');

module.exports = {
  name: 'guildmaster',
  aliases: ['gm', 'authguild'],
  description: '[ADMIN] Authorize guild masters',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();

    // Single source of truth — matches every other admin command.
    // (Old code used db.botOwner?? '194592469209292@lid' — the CO-OWNER's JID —
    //  so only the co-owner could ever use this. Owners now recognized properly.)
    if (!Perms.isBotOwner(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Bot owner only.' }, { quoted: msg });
    }

    if (!db.authorizedGuildMasters) db.authorizedGuildMasters = [];
    const sub = args[0]?.toLowerCase();
    const mentionedId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (sub === 'authorize' || sub === 'add') {
      if (!mentionedId) return sock.sendMessage(chatId, { text: '❌ Mention a user: /guildmaster authorize @user' }, { quoted: msg });
      if (db.authorizedGuildMasters.includes(mentionedId)) return sock.sendMessage(chatId, { text: '⚠️ Already authorized.' }, { quoted: msg });
      db.authorizedGuildMasters.push(mentionedId);
      saveDatabase();
      const target = db.users[mentionedId];
      return sock.sendMessage(chatId, {
        text: `✅ *${target?.name || mentionedId}* is now an authorized guild master.\n🏰 They can create guilds with /guild create`,
        mentions: [mentionedId],
      }, { quoted: msg });
    }

    if (sub === 'revoke' || sub === 'remove') {
      if (!mentionedId) return sock.sendMessage(chatId, { text: '❌ Mention a user.' }, { quoted: msg });
      db.authorizedGuildMasters = db.authorizedGuildMasters.filter(j => j !== mentionedId);
      saveDatabase();
      const target = db.users[mentionedId];
      return sock.sendMessage(chatId, {
        text: `❌ *${target?.name || mentionedId}*'s guild master authorization has been revoked.`,
        mentions: [mentionedId],
      }, { quoted: msg });
    }

    if (!sub || sub === 'list') {
      const list = db.authorizedGuildMasters.map((jid, i) => {
        const p = db.users[jid];
        return `${i + 1}. *${p?.name || jid.split('@')[0]}* — ${p?.guild ? `Guild: ${p.guild}` : 'No guild yet'}`;
      });
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🏰 *AUTHORIZED GUILD MASTERS*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          list.length > 0 ? list.join('\n') : 'None authorized yet.',
          ``,
          `${db.authorizedGuildMasters.length} authorized (no cap)`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📌 /guildmaster authorize @user`,
          `📌 /guildmaster revoke @user`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n')
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, { text: '/guildmaster [authorize|revoke|list] (@user)' }, { quoted: msg });
  }
};