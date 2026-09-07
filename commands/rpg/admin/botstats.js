const Perms = require('../../../utils/permissions');

module.exports = {
  name: 'botstats',
  description: '📊 View bot statistics',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!db.botMods) db.botMods = [];
    
    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot admins can view bot statistics!'
      }, { quoted: msg });
    }
    
    // Calculate stats
    const totalUsers = Object.keys(db.users || {}).length;
    const totalAdmins = (db.botMods || []).length;
    const totalBanned = Object.keys(db.bannedUsers || {}).length;
    const totalGuilds = Object.keys(db.guilds || {}).length;
    
    // Level distribution
    const users = Object.values(db.users || {});
    const levels = users.map(u => u.level || 1);
    const avgLevel = levels.length > 0 ? Math.floor(levels.reduce((a, b) => a + b, 0) / levels.length) : 0;
    const maxLevel = levels.length > 0 ? Math.max(...levels) : 0;
    
    // Nexus/Mana Stone totals
    const totalNexus = users.reduce((sum, u) => sum + (u.gold || 0), 0);
    const totalCrystals = users.reduce((sum, u) => sum + (u.manaCrystals || 0), 0);
    
    // Active users (last 24h)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const activeUsers = users.filter(u => u.lastActive && u.lastActive > oneDayAgo).length;
    
    // Classes distribution
    const classCount = {};
    users.forEach(u => {
      if (u.class?.name) {
        classCount[u.class.name] = (classCount[u.class.name] || 0) + 1;
      }
    });
    
    const topClass = Object.keys(classCount).reduce((a, b) => 
      classCount[a] > classCount[b] ? a : b, 'None'
    );
    
    const stats = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BOT STATISTICS 📊
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Date: ${new Date().toLocaleDateString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 USERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Users: ${totalUsers}
Active (24h): ${activeUsers}
👑 Admins: ${totalAdmins}
🚫 Banned: ${totalBanned}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 GUILDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Guilds: ${totalGuilds}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⭐ LEVELS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Average Level: ${avgLevel}
Highest Level: ${maxLevel}
Most Popular Class: ${topClass}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 ECONOMY
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Nexus: ${totalNexus.toLocaleString()} 💠
Total 💎 Mana Stones: ${totalCrystals.toLocaleString()} 💎
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    
    await sock.sendMessage(chatId, { text: stats }, { quoted: msg });
  }
};