// battle.js — Redirects to /dungeon
// The old battle system is now part of the Tower Dungeon System.

module.exports = {
  name: 'battle',
  description: 'Redirects to dungeon system',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ *BATTLE SYSTEM*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nBattles now happen inside the\n🏰 *TOWER DUNGEON SYSTEM!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *TO START FIGHTING:*\n1️⃣ /dungeon party create\n2️⃣ Friends join: /dungeon party join [ID]\n3️⃣ /dungeon ready\n4️⃣ /dungeon start [#]\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🗂️ *8 dungeon types, 20 floors each*\n👹 Boss every 5 floors!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 Type /dungeon help for full info`
    }, { quoted: msg });
  }
};
