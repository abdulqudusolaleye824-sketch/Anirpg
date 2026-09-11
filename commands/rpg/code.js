// ═══════════════════════════════════════════════════════════════
// /code — view your referral code + referral stats
// ═══════════════════════════════════════════════════════════════
'use strict';

const UI = require('../../rpg/utils/UI');
const Referrals = require('../../rpg/utils/ReferralSystem');

module.exports = {
  name: 'code',
  aliases: ['referral', 'refcode'],
  description: '🔗 View your referral code and referral stats',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

    Referrals.ensureProfile(db, player);
    saveDatabase();

    const total = (player.referrals || []).length;
    const lvl3 = player.referralLvl3 || 0;
    const pts = player.referralPoints || 0;
    const monthly = Referrals.currentMonthCount(player);

    const text = UI.card(player, {
      icon: '🔗', title: 'REFERRAL CODE',
      lines: [
        `🎟️ Your code: *${player.referralCode}*`,
        ``,
        `👥 Successful referrals: *${total}*`,
        `⭐ Referred hunters at/above Lv.3: *${lvl3}*`,
        `🏆 Total points: *${pts}*`,
        `📅 This month: *${monthly}*`,
        ``,
        `💡 New hunters enter your code during /register.`,
        `💠 When a recruit hits Lv.3 you get *10,000 Nexus* instantly!`,
        `👑 Top recruiter each month wins a *Weekly Pro Card*!`,
      ],
      tip: '/lb referrals for the monthly race',
    });
    return sock.sendMessage(chatId, { text }, { quoted: msg });
  },
};
