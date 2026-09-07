// boss.js — Redirects to /worldboss
// The old solo boss system has been replaced by the World Boss Raid system.

module.exports = {
  name: 'boss',
  description: 'World Boss Raids (redirects to /worldboss)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;

    // If they typed /boss with subcommands, pass them through to worldboss
    if (args.length > 0) {
      const WorldBoss = require('./worldboss');
      return WorldBoss.execute(sock, msg, args, getDatabase, saveDatabase, sender);
    }

    // No args — show redirect message
    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👹 *BOSS RAIDS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nBoss raids have been upgraded to the\n🌍 *WORLD BOSS SYSTEM!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *COMMANDS:*\n/worldboss list         — View world bosses\n/worldboss create [#]   — Form a raid party\n/worldboss join [ID]    — Join a party\n/worldboss ready        — Mark ready\n/worldboss start        — Begin the raid\n/worldboss attack       — Attack the boss\n/worldboss defend       — Brace for big hits\n/worldboss skill [name] — Use a skill\n/worldboss status       — Check raid status\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 Short alias: */wb* works too!\nExample: /wb create 1\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg });
  }
};
