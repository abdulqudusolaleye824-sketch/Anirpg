// /elb — Push #96h-z2: Jeju Raid leaderboard with kills · deaths · points · event level
const EventSystem = require('../../rpg/utils/EventSystem');
module.exports = {
  name: 'elb', aliases: ['eventlb', 'eventleaderboard', 'etop'], description: '🏆 Jeju Raid: top participants (kills, deaths, points, event level)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    try { EventSystem.tick(db); } catch (e) {}
    const n = Math.max(3, Math.min(25, parseInt(args[0], 10) || 10));
    const text = EventSystem.leaderboardText(db, n);
    const mentions = []; for (const m of text.matchAll(/@(\d{5,})/g)) { const key = Object.keys(db.users || {}).find(k => k.split('@')[0].split(':')[0] === m[1]); mentions.push(key || `${m[1]}@s.whatsapp.net`); }
    try { return await sock.sendMessage(chatId, { text, ...(mentions.length ? { mentions: [...new Set(mentions)] } : {}) }, { quoted: msg }); } catch (e) { console.error('[elb] send:', e.message); }
  },
};
