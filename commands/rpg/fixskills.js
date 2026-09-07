const LevelUpManager = require('../../rpg/utils/LevelUpManager');
const { fixAllocations, getMaxAllocations, STAT_CONFIG } = require('../../rpg/utils/StatAllocationSystem');

module.exports = {
  name: 'fixskills',
  description: 'Grant missing skills and fix stat allocation caps for your level (Admin)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const ALLOWED_USERS = [
      '221951679328499@lid',
      '194592469209292@lid'
    ];

    if (!ALLOWED_USERS.includes(sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the bot owner or Naruto can use this command!'
      }, { quoted: msg });
    }

    let targetId = sender;
    if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
      targetId = msg.message.extendedTextMessage.contextInfo.participant;
    } else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
      targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }

    const player = db.users[targetId];
    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ Player not found!' }, { quoted: msg });
    }

    // 1️⃣ Grant missing skills
    const skillsGranted = LevelUpManager.grantMissingSkills(player);

    // 2️⃣ Fix stat allocation caps for current level (refunds over-cap UP)
    const { refunded, log: allocLog } = fixAllocations(player);

    // 3️⃣ Build cap info display
    const level = player.level || 1;
    const capLines = Object.entries(STAT_CONFIG)
      .map(([stat, cfg]) => {
        const current = player.statAllocations?.[stat] || 0;
        const cap = getMaxAllocations(stat, level);
        return '  ' + cfg.emoji + ' ' + cfg.name + ': ' + current + '/' + cap;
      })
      .join('\n');

    saveDatabase();

    let allocSection;
    if (refunded > 0) {
      allocSection =
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '🔧 ALLOCATION FIXES\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        allocLog.join('\n') + '\n' +
        '💎 Total UP Refunded: ' + refunded;
    } else {
      allocSection =
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '✅ ALLOCATION CAPS (Lv.' + level + ')\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        capLines + '\n' +
        '✅ All caps are correct for your level!';
    }

    const message =
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '✅ SKILLS + ALLOCS FIXED! ✅\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '👤 Player: ' + player.name + '\n' +
      '⭐ Level: ' + player.level + '\n' +
      '🔮 Class: ' + player.class.name + '\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '📊 SKILL RESULTS\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '✨ Skills Granted: ' + skillsGranted + '\n' +
      '🎯 Active Skills: ' + (player.skills?.active?.length || 0) + '/5\n' +
      '📚 Available Skills: ' + (player.availableSkills?.length || 0) + '\n' +
      allocSection + '\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      'Use /stats or /upgrade to review your character!\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    return sock.sendMessage(chatId, { text: message }, { quoted: msg });
  }
};