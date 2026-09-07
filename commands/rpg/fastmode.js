module.exports = {
  name: 'fastmode',
  description: '⚡ Set slowmode to 0 in all groups instantly',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const ALLOWED = [
      '221951679328499@lid',
      '194592469209292@lid'
    ];

    if (!ALLOWED.includes(sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the bot owner can use this command.'
      }, { quoted: msg });
    }

    if (!db.groupSettings) db.groupSettings = {};

    // Set slowmode = 0 for every group in the database
    let count = 0;
    for (const groupId of Object.keys(db.groupSettings)) {
      if (groupId.endsWith('@g.us')) {
        db.groupSettings[groupId].slowmode = 0;
        count++;
      }
    }

    // Also cover groups that exist in users but may not have a groupSettings entry yet
    // by fetching all participating groups from WhatsApp directly
    let fetchedCount = 0;
    try {
      const groups = await sock.groupFetchAllParticipating();
      for (const groupId of Object.keys(groups)) {
        if (!db.groupSettings[groupId]) {
          db.groupSettings[groupId] = {};
        }
        db.groupSettings[groupId].slowmode = 0;
        fetchedCount++;
      }
    } catch (e) {
      console.error('groupFetchAllParticipating error:', e.message);
    }

    const total = Math.max(count, fetchedCount);
    saveDatabase();

    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ FASTMODE ACTIVATED\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Slowmode set to 0 in all groups\n📊 Groups updated: ${total}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg });
  }
};