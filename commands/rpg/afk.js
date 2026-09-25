const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'afk',
  description: '💤 Set AFK status (auto-welcome-back when you return) · Pro: /afk default <message>',
  usage: '/afk [reason]  |  /afk default <message>  (Pro)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!db.afkUsers) db.afkUsers = {};
    const player = db.users?.[sender];
    const mentionText = `@${sender.split('@')[0]}`;
    const BAR = '━━━━━━━━━━━━━━━━━━━━━━';

    // ── Push #88m: /afk default <message> — Pro: the reason used by auto-AFK ──
    if ((args[0] || '').toLowerCase() === 'default') {
      if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
      if (!UI.isPro(player)) return sock.sendMessage(chatId, { text: `💎 *PRO ONLY*\n${BAR}\nA default auto-AFK message is a Pro perk.\n${UI.upsell()}` }, { quoted: msg });
      const rest = args.slice(1).join(' ').trim();
      if (!rest) {
        return sock.sendMessage(chatId, { text: `${UI.PRO_BAR}\n💤 *AUTO-AFK DEFAULT*\n${UI.PRO_BAR}\n📝 Current: ${player.afkDefault ? `*${player.afkDefault}*` : '_none (plain "AFK")_'}\n\n/afk default <message> — set it\n/afk default clear — remove it\n${UI.PRO_BAR}` }, { quoted: msg });
      }
      if (/^(clear|none|off|reset)$/i.test(rest)) {
        delete player.afkDefault; saveDatabase();
        return sock.sendMessage(chatId, { text: `${UI.PRO_BAR}\n💤 Auto-AFK default cleared — plain *AFK* will be used.\n${UI.PRO_BAR}` }, { quoted: msg });
      }
      player.afkDefault = rest.slice(0, 120);
      saveDatabase();
      return sock.sendMessage(chatId, { text: `${UI.PRO_BAR}\n💤 *AUTO-AFK DEFAULT SET*\n${UI.PRO_BAR}\n👤 ${mentionText}\n📝 When you go quiet for 30 min I'll mark you AFK with:\n*${player.afkDefault}*\n${UI.PRO_BAR}`, mentions: [sender] }, { quoted: msg });
    }

    const reason = args.join(' ').trim() || 'AFK';
    db.afkUsers[sender] = { reason, since: Date.now() };
    saveDatabase();

    return sock.sendMessage(chatId, {
      text: `${BAR}\n💤 *YOU ARE NOW AFK*\n${BAR}\n\n👤 ${mentionText}\n📝 Reason: ${reason}\n\n_Type anything in a group to come back — I'll greet you._\n${BAR}`,
      mentions: [sender]
    }, { quoted: msg });
  }
};
